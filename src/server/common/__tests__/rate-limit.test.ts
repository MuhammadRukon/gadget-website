import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RateLimitedError,
  enforceRateLimit,
  rateLimit,
} from '../rate-limit';

const policy = { max: 3, windowMs: 1000 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rate-limit: rateLimit', () => {
  it('allows up to `max` calls within the window then rejects', () => {
    const key = `test:${Math.random()}`;
    expect(rateLimit(key, policy).ok).toBe(true);
    expect(rateLimit(key, policy).ok).toBe(true);
    expect(rateLimit(key, policy).ok).toBe(true);
    const fourth = rateLimit(key, policy);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('refills after the window elapses', () => {
    const key = `test:${Math.random()}`;
    rateLimit(key, policy);
    rateLimit(key, policy);
    rateLimit(key, policy);
    expect(rateLimit(key, policy).ok).toBe(false);

    vi.advanceTimersByTime(1100);

    expect(rateLimit(key, policy).ok).toBe(true);
  });

  it('isolates different keys', () => {
    const a = `test-a:${Math.random()}`;
    const b = `test-b:${Math.random()}`;
    rateLimit(a, policy);
    rateLimit(a, policy);
    rateLimit(a, policy);
    expect(rateLimit(a, policy).ok).toBe(false);
    expect(rateLimit(b, policy).ok).toBe(true);
  });
});

describe('rate-limit: enforceRateLimit', () => {
  it('throws RateLimitedError with retryAfter once exhausted', () => {
    const key = `test:${Math.random()}`;
    enforceRateLimit(key, policy);
    enforceRateLimit(key, policy);
    enforceRateLimit(key, policy);

    let caught: unknown;
    try {
      enforceRateLimit(key, policy);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RateLimitedError);
    expect((caught as RateLimitedError).retryAfter).toBeGreaterThanOrEqual(1);
  });
});
