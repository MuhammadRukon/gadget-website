import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, SEED } from './support/seed';
import { logIn } from './support/ui';

for (const role of ['admin', 'customer'] as const) {
  setup(`log in ${SEED[role].email}`, async ({ page }) => {
    await logIn(page, SEED[role].email, SEED[role].password);
    await expect(page).toHaveURL('/');
    await page.context().storageState({ path: AUTH_FILE[role] });
  });
}
