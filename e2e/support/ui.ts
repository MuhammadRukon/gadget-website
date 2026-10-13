import type { Page } from '@playwright/test';

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

/** The only menu trigger in the header is the account menu (rendered once the session is known). */
export const accountMenu = (page: Page) => page.locator('header button[aria-haspopup="menu"]');

export const addToCart = (page: Page) => page.getByRole('button', { name: 'Add to cart' }).click();

/** The product detail page title. */
export const productName = (page: Page) => page.getByRole('heading', { level: 1 }).innerText();
