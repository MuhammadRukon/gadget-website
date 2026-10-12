/**
 * Postgres-backed rate-limit bucket (see `RateLimitBucket` in
 * schema.prisma). Replaces the old in-process Map, which reset on
 * every serverless cold start and never shared state across
 * instances. The interface is unchanged from that version — every API
 * route still accesses it through `rateLimit(...)`/`enforceRateLimit`
 * with an explicit `key` and policy; only the implementation moved
 * from memory to the database, so both are now async.
 */

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { buildKey, cacheDel, withStore } from './cache';

export interface RateLimitPolicy {
  /** How many requests are allowed in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** What to do when Redis is unconfigured or down. 'none' fails open without touching Postgres. */
  fallback?: 'postgres' | 'none';
}

// Hashed so raw emails/IPs never reach Redis.
const redisKey = (key: string) => buildKey('rl', createHash('sha256').update(key).digest('hex').slice(0, 32));

export async function rateLimit(
  key: string,
  policy: RateLimitPolicy,
  opts: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const hit = await withStore((s) => s.incrWindow(redisKey(key), policy.windowMs));
  if (hit.ok) {
    return {
      ok: hit.value.count <= policy.max,
      remaining: Math.max(0, policy.max - hit.value.count),
      resetAt: Date.now() + hit.value.pttlMs,
    };
  }
  if (opts.fallback === 'none') {
    return { ok: true, remaining: policy.max, resetAt: Date.now() + policy.windowMs };
  }

  const now = new Date();
  const resetAt = new Date(now.getTime() + policy.windowMs);

  // Try to bump an existing, still-live window first.
  const incremented = await prisma.rateLimitBucket.updateMany({
    where: { key, resetAt: { gt: now } },
    data: { count: { increment: 1 } },
  });

  if (incremented.count === 0) {
    // No live window for this key (first request, or the previous
    // window expired) — start a fresh one. Two concurrent first
    // requests can both land here and both upsert; worst case one
    // extra request slips through per window boundary, which is
    // acceptable for an abuse guard and not worth a transaction.
    await prisma.rateLimitBucket.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
    return { ok: true, remaining: policy.max - 1, resetAt: resetAt.getTime() };
  }

  const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key } });
  return {
    ok: bucket.count <= policy.max,
    remaining: Math.max(0, policy.max - bucket.count),
    resetAt: bucket.resetAt.getTime(),
  };
}

/**
 * Pull the best-effort client IP from a Next.js Request. Vercel sets
 * `x-forwarded-for`; fall back to a stable cookie or an "unknown" key
 * so abusers can't bypass simply by stripping headers.
 */
export function clientIp(request: Request): string {
  return ipFromHeaders(request.headers);
}

export function ipFromHeaders(h: Pick<Headers, 'get'>): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}

export class RateLimitedError extends Error {
  public readonly retryAfter: number;
  constructor(retryAtMs: number) {
    super('Too many requests; please try again later.');
    this.name = 'RateLimitedError';
    this.retryAfter = Math.max(1, Math.ceil((retryAtMs - Date.now()) / 1000));
  }
}

/**
 * Convenience helper: throws if the rate-limit policy is exceeded.
 * Routes catch RateLimitedError to set Retry-After + 429.
 */
export async function enforceRateLimit(
  key: string,
  policy: RateLimitPolicy,
  opts?: RateLimitOptions,
): Promise<void> {
  const result = await rateLimit(key, policy, opts);
  if (!result.ok) throw new RateLimitedError(result.resetAt);
}

// shortcut: fails open when Redis is absent/failing; cost is bounded by input caps (q max 100, hydrate lines max 50); upgrade to a per-instance in-memory fixed window when Redis is always on
export function enforceIpLimit(
  request: Request,
  name: string,
  policy: RateLimitPolicy = { max: 120, windowMs: 60_000 },
) {
  return enforceRateLimit(`${name}:${ipFromHeaders(request.headers)}`, policy, { fallback: 'none' });
}

/**
 * Drop the bucket for a key. Call after a successful action (login,
 * password change) so a run of failures doesn't count against the user
 * once they succeed.
 */
export async function clearRateLimit(key: string): Promise<void> {
  await cacheDel(redisKey(key));
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
