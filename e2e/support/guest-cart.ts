import type { Page } from '@playwright/test';
import { BASE_URL } from './env';

export const CART_KEY = 'Cryptech.guestCart';
export const AUTH_HINT_KEY = 'Cryptech.authHint';

export const guestLines = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).state.lines as { variantId: string; quantity: number }[]) : [];
  }, CART_KEY);

/** The persisted guest cart as the zustand store writes it (version 1). Lines are `unknown` so tests can corrupt them. */
export const guestCartJson = (lines: unknown[]) => JSON.stringify({ state: { lines, lastValidatedAt: null }, version: 1 });

/** Writes the raw persisted guest cart; the page must already be on the app origin. */
export const seedGuestCart = (page: Page, value: string) =>
  page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: CART_KEY, value });

/** `browser.newContext({ storageState })` that starts with `value` as the guest cart, so no seeding page load is needed. */
export const guestCartStorage = (value: string) => ({
  cookies: [],
  origins: [{ origin: BASE_URL, localStorage: [{ name: CART_KEY, value }] }],
});
