/**
 * The implementation is now Postgres-backed (see `RateLimitBucket` in
 * schema.prisma), so these tests run against the real `prisma` client
 * configured via DATABASE_URL rather than a mock — there is no
 * existing Prisma-mocking convention in this repo to mirror, and
 * introducing a mocking library for one test file would be more
 * machinery than this warrants. Every key is randomised so runs don't
 * collide, and each test cleans up its own rows.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';

import { RateLimitedError, enforceRateLimit, rateLimit } from '../rate-limit';

const policy = { max: 3, windowMs: 1000 };

const usedKeys: string[] = [];
function freshKey(prefix: string) {
  const key = `${prefix}:${Math.random()}`;
  usedKeys.push(key);
  return key;
}

afterEach(async () => {
  if (usedKeys.length > 0) {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: usedKeys.splice(0) } } });
  }
});

describe('rate-limit: rateLimit', () => {
  it('allows up to `max` calls within the window then rejects', async () => {
    const key = freshKey('test');
    expect((await rateLimit(key, policy)).ok).toBe(true);
    expect((await rateLimit(key, policy)).ok).toBe(true);
    expect((await rateLimit(key, policy)).ok).toBe(true);
    const fourth = await rateLimit(key, policy);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('refills after the window elapses', async () => {
    const key = freshKey('test');
    await rateLimit(key, policy);
    await rateLimit(key, policy);
    await rateLimit(key, policy);
    expect((await rateLimit(key, policy)).ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect((await rateLimit(key, policy)).ok).toBe(true);
  });

  it('isolates different keys', async () => {
    const a = freshKey('test-a');
    const b = freshKey('test-b');
    await rateLimit(a, policy);
    await rateLimit(a, policy);
    await rateLimit(a, policy);
    expect((await rateLimit(a, policy)).ok).toBe(false);
    expect((await rateLimit(b, policy)).ok).toBe(true);
  });
});

describe('rate-limit: enforceRateLimit', () => {
  it('throws RateLimitedError with retryAfter once exhausted', async () => {
    const key = freshKey('test');
    await enforceRateLimit(key, policy);
    await enforceRateLimit(key, policy);
    await enforceRateLimit(key, policy);

    let caught: unknown;
    try {
      await enforceRateLimit(key, policy);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RateLimitedError);
    expect((caught as RateLimitedError).retryAfter).toBeGreaterThanOrEqual(1);
  });
});
