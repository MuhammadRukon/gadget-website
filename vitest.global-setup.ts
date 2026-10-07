import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Safety net: the suite hits a real Postgres (creating and deleting rows,
 * mutating the PaymentSettings singleton). Abort unless DATABASE_URL points
 * at a local database.
 *
 * Prisma falls back to `.env` (the remote DB) when DATABASE_URL isn't in the
 * shell, so we resolve the URL the same way: shell first, then `.env`.
 * Escape hatch for CI or an intentionally remote test DB:
 * ALLOW_NON_LOCAL_TEST_DB=1.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function readDotEnvDatabaseUrl(): string | undefined {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    const match = text.match(/^\s*DATABASE_URL\s*=\s*(.*)$/m);
    return match?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') || undefined;
  } catch {
    return undefined;
  }
}

export default function setup() {
  if (process.env.ALLOW_NON_LOCAL_TEST_DB === '1') return;

  const url = process.env.DATABASE_URL || readDotEnvDatabaseUrl();
  let host: string | null = null;
  try {
    host = url ? new URL(url).hostname : null;
  } catch {
    host = null;
  }

  if (!host || !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL host is "${host ?? 'unset/invalid'}", not localhost.\n` +
        'The suite writes to the database. Load the local dev DB first:\n' +
        '  bash:        set -a; . ./.env.dev; set +a\n' +
        '  PowerShell:  Get-Content .env.dev | Where-Object { $_ -match \'^[A-Z_]+=\' } | ForEach-Object { $k,$v = $_ -split \'=\',2; Set-Item "env:$k" $v }\n' +
        'To deliberately target a non-local database set ALLOW_NON_LOCAL_TEST_DB=1.',
    );
  }
}
