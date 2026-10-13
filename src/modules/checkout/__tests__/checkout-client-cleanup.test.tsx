// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Node's own `localStorage` getter shadows jsdom's; the cart store reads it at import time.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
    configurable: true,
  });
});
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/modules/account/components/address-form', () => ({ AddressForm: () => null }));
vi.mock('@/modules/checkout/components/checkout-payment-card', () => ({
  CheckoutPaymentCard: () => null,
}));
vi.mock('@/modules/checkout/components/order-summary-card', () => ({
  OrderSummaryCard: ({ placeOrderDisabled }: { placeOrderDisabled: boolean }) =>
    createElement('button', { disabled: placeOrderDisabled }, 'Place order'),
}));

import { toast } from 'sonner';
import type { CartLine } from '@/contracts/cart';
import { CheckoutClient } from '../components/checkout-client';

const line = (id: string, over: Partial<CartLine> = {}): CartLine => ({
  itemId: `item-${id}`,
  variantId: id,
  productId: '',
  productSlug: id,
  productName: id.toUpperCase(),
  variantName: null,
  sku: id,
  imageUrl: null,
  unitPriceCents: 1000,
  originalUnitPriceCents: 1000,
  quantity: 1,
  stock: 10,
  isActive: true,
  ...over,
});

const hasIssue = (l: CartLine) => !l.isActive || l.stock === 0 || l.quantity > l.stock;

/** A server whose quote answers 409 for as long as the cart still holds a bad line. */
function stubServer(initial: CartLine[]) {
  let lines = initial;
  const json = (status: number, body: unknown) => ({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(body),
  });
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const id = url.split('/').pop();
    // The cart calls are slower than the config and addresses, as on the real network.
    if (url.startsWith('/api/cart') && url !== '/api/cart?view=summary') {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (method === 'DELETE') lines = lines.filter((l) => l.itemId !== id);
    if (method === 'PATCH') {
      const { quantity } = JSON.parse(String(init?.body));
      lines = lines.map((l) => (l.itemId === id ? { ...l, quantity } : l));
    }
    if (url === '/api/cart?view=summary') {
      return json(200, {
        subtotalCents: 0,
        itemCount: lines.reduce((n, l) => n + l.quantity, 0),
        hasIssues: lines.some(hasIssue),
      });
    }
    if (url === '/api/checkout/config') {
      return json(200, {
        methods: ['COD'],
        cod: { feeEnabled: false, type: 'FLAT', value: 0 },
        qrImageUrl: null,
        contactNumber: null,
        paymentNote: null,
      });
    }
    if (url === '/api/addresses') return json(200, { items: [{ id: 'addr-1' }] });
    if (url === '/api/checkout/quote') {
      if (lines.some(hasIssue)) {
        return json(409, {
          code: 'CONFLICT',
          message: 'an item is no longer available',
          meta: { reason: 'unavailable' },
        });
      }
      return json(200, {
        subtotalCents: 1000,
        discountCents: 0,
        shippingCents: 0,
        totalCents: 1000,
        couponCode: null,
        codFeeCents: 0,
        dueOnDeliveryCents: 1000,
        codFeeRule: null,
      });
    }
    return json(200, { lines, subtotalCents: 0, itemCount: lines.length });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(createElement(CheckoutClient), { wrapper });
}

beforeEach(() => vi.mocked(toast.error).mockClear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CheckoutClient with cart issues on entry', () => {
  it.each([
    ['an unavailable line', line('gone', { isActive: false })],
    ['an over-stock line', line('over', { quantity: 5, stock: 2 })],
  ])('enables Place order once %s is cleaned up, with no error toast', async (_name, bad) => {
    stubServer([bad, line('ok')]);
    mount();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Place order' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});
