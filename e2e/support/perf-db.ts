import { PrismaClient } from '@prisma/client';
import { E2E_DB_NAME } from './db-guard';
import { e2eDatabaseUrl } from './env';

export const IPHONE_SLUG = 'iphone-15-pro';
export const IPHONE_SKU = 'APL-IP15P-256';

/** One short-lived client per call. env.ts already guarded the URL; this re-checks the live database name. */
async function withDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: e2eDatabaseUrl });
  try {
    const [row] = await db.$queryRaw<{ db: string }[]>`select current_database() as db`;
    if (row.db !== E2E_DB_NAME) throw new Error(`refusing to run e2e: connected to ${row.db}`);
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

export const variantIdBySku = (sku: string) =>
  withDb(async (db) => (await db.productVariant.findUniqueOrThrow({ where: { sku } })).id);

/** Sets the variant's `isActive` and returns a function that puts the previous value back. */
export async function setVariantActive(sku: string, isActive: boolean): Promise<() => Promise<void>> {
  const previous = await withDb(async (db) => {
    const v = await db.productVariant.findUniqueOrThrow({ where: { sku } });
    await db.productVariant.update({ where: { sku }, data: { isActive } });
    return v.isActive;
  });
  return () =>
    withDb(async (db) => {
      await db.productVariant.update({ where: { sku }, data: { isActive: previous } });
    });
}

const REVIEW_COUNT = 12;
const REVIEWER_EMAILS = ['e2e-perf-anika@example.test', 'e2e-perf-sufia@example.test'];
const NAMES = ['Anika Rahman', 'Sufia'] as const;
/** Zero-padded so "review-1" is never a substring of "review-10". */
export const reviewBody = (n: number) => `perf-review-${String(n).padStart(2, '0')}`;
/** Odd reviews are written by the two-word name, even ones by the single-word name. */
export const reviewAuthor = (n: number) => (n % 2 === 1 ? 'Anika R.' : 'Sufia');

/**
 * Inserts 12 approved reviews on the iPhone (review 1 newest) and returns a function that removes
 * everything it created. Reviews need an OrderItem each, so an order of 12 items is created too.
 */
export async function seedReviews(): Promise<() => Promise<void>> {
  const cleanup = () =>
    withDb(async (db) => {
      // Order delete cascades to items and reviews; user delete cascades to the address.
      await db.order.deleteMany({ where: { user: { email: { in: REVIEWER_EMAILS } } } });
      await db.user.deleteMany({ where: { email: { in: REVIEWER_EMAILS } } });
    });

  await cleanup(); // leftovers from a crashed earlier run
  try {
    await withDb(async (db) => {
      const variant = await db.productVariant.findUniqueOrThrow({ where: { sku: IPHONE_SKU } });
      const users = await Promise.all(
        REVIEWER_EMAILS.map((email, i) => db.user.create({ data: { email, name: NAMES[i] } })),
      );
      const address = await db.address.create({
        data: { userId: users[0].id, recipientName: 'E2E', recipientPhone: '0', line1: 'E2E', city: 'Dhaka' },
      });
      const order = await db.order.create({
        data: {
          orderNumber: `T-E2EPERF-${Date.now().toString(16).slice(-6).toUpperCase()}`,
          userId: users[0].id,
          addressId: address.id,
          status: 'DELIVERED',
          shipRecipient: 'E2E',
          shipPhone: '0',
          shipLine1: 'E2E',
          shipCity: 'Dhaka',
          shipCountry: 'BD',
          subtotalCents: 0,
          totalCents: 0,
          items: {
            create: Array.from({ length: REVIEW_COUNT }, () => ({
              variantId: variant.id,
              productId: variant.productId,
              productName: 'iPhone 15 Pro',
              sku: IPHONE_SKU,
              buyingPriceCents: 0,
              unitPriceCents: 0,
              quantity: 1,
            })),
          },
        },
        include: { items: true },
      });
      const now = Date.now();
      for (let n = 1; n <= REVIEW_COUNT; n++) {
        await db.review.create({
          data: {
            userId: users[n % 2 === 1 ? 0 : 1].id,
            productId: variant.productId,
            orderItemId: order.items[n - 1].id,
            rating: 5,
            title: `perf-title-${String(n).padStart(2, '0')}`,
            body: reviewBody(n),
            createdAt: new Date(now - n * 3_600_000),
          },
        });
      }
    });
  } catch (err) {
    await cleanup();
    throw err;
  }
  return cleanup;
}
