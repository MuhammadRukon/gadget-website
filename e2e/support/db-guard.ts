import { assertLocalDatabase } from '../../src/server/common/db-target';

export const E2E_DB_NAME = 'gadget_e2e';

/** Throws unless `raw` is a local-host URL for the `gadget_e2e` database; every message contains "refusing". */
export function assertE2eDatabaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error('refusing to run e2e: E2E_DATABASE_URL is not set');
  try {
    assertLocalDatabase({ databaseUrl: raw });
  } catch (err) {
    // The wrapped messages never echo credentials (see db-target.ts).
    throw new Error(`refusing to run e2e: ${err instanceof Error ? err.message : 'bad database URL'}`);
  }
  if (new URL(raw).pathname !== `/${E2E_DB_NAME}`) {
    throw new Error(`refusing to run e2e: database name must be exactly ${E2E_DB_NAME}`);
  }
  return raw;
}
