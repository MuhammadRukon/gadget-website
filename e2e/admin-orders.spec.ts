import { expect, test, type Page } from '@playwright/test';
import { ok, orderAsCustomer } from './support/orders';
import { AUTH_FILE } from './support/seed';

test.use({ storageState: AUTH_FILE.admin });

const statusButton = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });

test('[E2E-ADMIN-01] admin finds an order and moves it to PROCESSING', async ({ page, playwright }) => {
  await orderAsCustomer(playwright); // a second order, so the search must reduce the list rather than show the only row
  const order = await orderAsCustomer(playwright);

  await page.goto('/dashboard/orders');
  await expect.poll(() => page.locator('tbody tr').count()).toBeGreaterThanOrEqual(2); // unfiltered list
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await page.getByPlaceholder('Search by order number, name, phone, or email').fill(order.orderNumber);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: order.orderNumber }).click();

  await expect(page.getByRole('heading', { level: 1, name: `Order ${order.orderNumber}` })).toBeVisible();
  const status = page.getByTestId('admin-order-status');
  await expect(status).toHaveText('Confirmed');
  for (const name of ['PROCESSING', 'CANCELLED']) await expect(statusButton(page, name)).toBeEnabled();
  for (const name of ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'PENDING']) {
    await expect(statusButton(page, name)).toBeDisabled();
  }

  const audit = page.locator('[data-slot="card"]').filter({ hasText: 'Audit trail' }).getByRole('listitem');
  const eventsBefore = await audit.count();
  await statusButton(page, 'PROCESSING').click();

  await expect(page.getByText('Order updated')).toBeVisible();
  await expect(status).toHaveText('Processing');
  await expect(statusButton(page, 'SHIPPED')).toBeEnabled();
  await expect(statusButton(page, 'PROCESSING')).toBeDisabled();
  await expect(audit).toHaveCount(eventsBefore + 1);
});

test('[E2E-ADMIN-02] admin cannot skip from PROCESSING to DELIVERED', async ({ request, playwright }) => {
  const order = await orderAsCustomer(playwright);

  const patch = (status: string) => request.patch(`/api/admin/orders/${order.id}`, { data: { status } });
  await ok(await patch('PROCESSING'), 'PATCH');

  const res = await patch('DELIVERED');
  expect(res.status()).toBe(409);
  expect(await res.json()).toMatchObject({ message: 'Cannot move order from PROCESSING to DELIVERED' });
});
