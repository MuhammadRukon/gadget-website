import type { PaymentMethod } from '@prisma/client';

import { FREE_THRESHOLD, INSIDE_DHAKA, OUTSIDE_DHAKA } from '@/server/checkout/shipping';
import { log } from '@/server/common/logger';
import {
  effectiveMethods,
  paymentSettingsService,
} from '@/server/settings/payment-settings.service';

export interface StorefrontFacts {
  /** Methods a customer can actually pay with right now (admin-enabled and configured). */
  methods: PaymentMethod[];
  shipping: { insideDhakaCents: number; outsideDhakaCents: number; freeFromCents: number };
}

const SHIPPING: StorefrontFacts['shipping'] = {
  insideDhakaCents: INSIDE_DHAKA,
  outsideDhakaCents: OUTSIDE_DHAKA,
  freeFromCents: FREE_THRESHOLD,
};

/**
 * Delivery and payment terms shown across the storefront. Reads no request
 * state, so ISR pages can render it. A settings read failure (e.g. build
 * without a database) shows the shipping terms with no payment methods
 * rather than guessing which ones are on.
 */
export const storefrontFactsService = {
  async get(): Promise<StorefrontFacts> {
    try {
      const settings = await paymentSettingsService.get();
      return { methods: effectiveMethods(settings), shipping: SHIPPING };
    } catch (err) {
      log.warn('storefront facts: settings read failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { methods: [], shipping: SHIPPING };
    }
  },
};
