import { describe, expect, it } from 'vitest';

import { getFeeNoticeState } from '../fee-state';

const pay = (feeStatus: string, method = 'COD') => ({ method, feeStatus }) as never;

describe('getFeeNoticeState', () => {
  it('is pending only for a PENDING order whose fee is PENDING', () => {
    expect(getFeeNoticeState('PENDING', pay('PENDING'))).toBe('pending');
    expect(getFeeNoticeState('CONFIRMED', pay('PENDING'))).toBe('none');
    expect(getFeeNoticeState('CANCELLED', pay('PENDING'))).toBe('none');
  });

  it('is rejected only while the order is still PENDING', () => {
    expect(getFeeNoticeState('PENDING', pay('REJECTED'))).toBe('rejected');
    expect(getFeeNoticeState('CANCELLED', pay('REJECTED'))).toBe('none');
  });

  it('shows verified for any non-cancelled order (verify confirms the order)', () => {
    expect(getFeeNoticeState('CONFIRMED', pay('VERIFIED'))).toBe('verified');
    expect(getFeeNoticeState('SHIPPED', pay('VERIFIED'))).toBe('verified');
    expect(getFeeNoticeState('CANCELLED', pay('VERIFIED'))).toBe('none');
  });

  it('shows nothing for WAIVED, NONE, non-COD or a missing payment', () => {
    expect(getFeeNoticeState('PENDING', pay('WAIVED'))).toBe('none');
    expect(getFeeNoticeState('PENDING', pay('NONE'))).toBe('none');
    expect(getFeeNoticeState('PENDING', pay('PENDING', 'BKASH'))).toBe('none');
    expect(getFeeNoticeState('PENDING', undefined)).toBe('none');
  });
});
