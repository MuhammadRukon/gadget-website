import { expect, test as setup } from '@playwright/test';

// shortcut: seed credentials hard-coded, upgrade by exporting from prisma/seed.ts when it is next touched.
const users = [
  { file: 'e2e/.auth/admin.json', email: 'admin@tecnologia.test', password: 'admin12345' },
  { file: 'e2e/.auth/customer.json', email: 'customer@tecnologia.test', password: 'customer12345' },
];

for (const { file, email, password } of users) {
  setup(`log in ${email}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
    await page.context().storageState({ path: file });
  });
}
