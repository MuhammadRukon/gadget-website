/**
 * Lightweight in-process token bucket. Good enough for a single
 * Next.js instance running on Vercel's regional functions; for
 * horizontal scale-out plug in `@upstash/ratelimit` or Redis.
 *
 * The interface is deliberately minimal so the implementation can be
 * swapped without touching call sites: every API route accesses it
 * through `rateLimit(...)` with an explicit `key` and policy.
 */

interface BucketState {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, BucketState>();

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

export function rateLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: BucketState = {
      tokens: policy.max - 1,
      resetAt: now + policy.windowMs,
    };
    buckets.set(key, fresh);
    return { ok: true, remaining: fresh.tokens, resetAt: fresh.resetAt };
  }
  if (existing.tokens <= 0) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.tokens -= 1;
  return { ok: true, remaining: existing.tokens, resetAt: existing.resetAt };
}

/**
 * Pull the best-effort client IP from a Next.js Request. Vercel sets
 * `x-forwarded-for`; fall back to a stable cookie or an "unknown" key
 * so abusers can't bypass simply by stripping headers.
 */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
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
export function enforceRateLimit(key: string, policy: RateLimitPolicy): void {
  const result = rateLimit(key, policy);
  if (!result.ok) throw new RateLimitedError(result.resetAt);
}
