import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { E2E_DB_NAME } from './support/db-guard';
import { BASE_URL, e2eDatabaseUrl, serverEnv } from './support/env';
import { IPHONE_SLUG } from './support/seed';

export default async function globalSetup() {
  const env = { ...process.env, ...serverEnv };
  const run = (cmd: string) => execSync(cmd, { env, stdio: 'inherit' });

  const prisma = new PrismaClient({ datasourceUrl: e2eDatabaseUrl });
  try {
    const [row] = await prisma.$queryRaw<{ db: string }[]>`select current_database() as db`;
    if (row.db !== E2E_DB_NAME) throw new Error(`refusing to run e2e: connected to ${row.db}`);
  } catch (err) {
    // Missing DB (errorCode is undefined for it, so match the message): nothing to destroy, `migrate reset` below creates it.
    if (!String((err as Error).message).includes(`${E2E_DB_NAME}\` does not exist`)) throw err;
  } finally {
    await prisma.$disconnect();
  }

  run('npx --no-install prisma migrate reset --force --skip-seed --skip-generate');
  run('npx --no-install tsx prisma/seed.ts');

  // Seeded users are unverified; login throws UnverifiedEmailError until set.
  const seeded = new PrismaClient({ datasourceUrl: e2eDatabaseUrl });
  try {
    await seeded.user.updateMany({ where: { emailVerified: null }, data: { emailVerified: new Date() } });
  } finally {
    await seeded.$disconnect();
  }

  await warmUp();
}

// Routes the suite visits. A cold `next dev` compiles each on first hit, so do it here instead of inside a test.
// Best effort only: failures, non-2xx and the time cap are ignored, and no test relies on it.
const WARM_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/products',
  `/products/${IPHONE_SLUG}`,
  '/cart',
  '/checkout',
  '/dashboard',
  '/dashboard/orders',
  '/account',
  '/api/catalog/products?q=iph&limit=8',
  '/api/reviews?productId=x',
];

async function warmUp() {
  const signal = AbortSignal.timeout(60_000);
  await Promise.allSettled(WARM_ROUTES.map((route) => fetch(BASE_URL + route, { signal }).then((res) => res.arrayBuffer())));
}
