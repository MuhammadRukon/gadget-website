import { assertLocalDatabase } from './src/server/common/db-target';

/**
 * Runs once before any test file. `npx vitest` skips the `pretest` npm hook, so this
 * repeats the localhost guard; a throw here aborts the whole run.
 */
export default function setup(): void {
  assertLocalDatabase({
    databaseUrl: process.env.DATABASE_URL,
    shadowUrl: process.env.SHADOW_DATABASE_URL,
  });
}
