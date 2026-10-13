import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Passw0rd!e2e';

async function signUp(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Name').fill('E2E Tester');
  await page.getByLabel('Email').fill(email);
  // App bug: the "optional" phone is validated as '' (min 6) before the submit handler maps it to undefined, so an empty phone blocks signup.
  await page.getByLabel('Phone').fill('+8801700000000');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

// Unique per call so a re-run against a non-wiped DB cannot collide.
const uniqueEmail = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;

test('[E2E-AUTH-01] signup, verify with dev code, then login', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);

  await expect(page).toHaveURL(/\/verify-email\?.*devCode=\d{6}/);
  const code = new URL(page.url()).searchParams.get('devCode')!;
  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page).toHaveURL('/login');

  await logIn(page, email, PASSWORD);
  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('[E2E-AUTH-02] wrong password shows an error and stays on /login', async ({ page }) => {
  await logIn(page, 'customer@tecnologia.test', 'wrong-password');
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL('/login');
});

test('[E2E-AUTH-03] unverified user is sent to /verify-email', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL(/\/verify-email/);

  await logIn(page, email, PASSWORD);
  await expect(page.getByText('Please verify your email before logging in.')).toBeVisible();
  await expect(page).toHaveURL(`/verify-email?email=${encodeURIComponent(email)}`);
});

test('[E2E-AUTH-04] signup with an existing email is rejected', async ({ page }) => {
  await signUp(page, 'customer@tecnologia.test');
  await expect(page.getByText('An account with this email already exists')).toBeVisible();
});
