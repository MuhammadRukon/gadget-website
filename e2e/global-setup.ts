import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { E2E_DB_NAME } from './support/db-guard';
import { e2eDatabaseUrl, serverEnv } from './support/env';

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

  run('npx --no-install prisma migrate reset --force --skip-seed');
  run('npx --no-install tsx prisma/seed.ts');

  // Seeded users are unverified; login throws UnverifiedEmailError until set.
  const seeded = new PrismaClient({ datasourceUrl: e2eDatabaseUrl });
  try {
    await seeded.user.updateMany({ where: { emailVerified: null }, data: { emailVerified: new Date() } });
  } finally {
    await seeded.$disconnect();
  }
}
