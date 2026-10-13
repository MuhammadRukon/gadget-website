import { PrismaClient } from '@prisma/client';
import { E2E_DB_NAME } from './db-guard';
import { e2eDatabaseUrl } from './env';

export const IPHONE_SKU = 'APL-IP15P-256';

/** Read-only. One short-lived client per call; env.ts guarded the URL, this re-checks the live database name. */
async function read<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: e2eDatabaseUrl });
  try {
    const [row] = await db.$queryRaw<{ db: string }[]>`select current_database() as db`;
    if (row.db !== E2E_DB_NAME) throw new Error(`refusing to run e2e: connected to ${row.db}`);
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

export const variantStock = (sku: string) =>
  read(async (db) => (await db.productVariant.findUniqueOrThrow({ where: { sku } })).stock);

export const variantId = (sku: string) =>
  read(async (db) => (await db.productVariant.findUniqueOrThrow({ where: { sku } })).id);
