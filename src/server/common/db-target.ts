/**
 * Guard against pointing local tooling (dev server, tests, seed, migrate...) at a
 * non-local database. Pure: callers pass the URLs in; nothing is read from the environment.
 *
 * Error messages expose only host and pathname, never credentials, query strings or the
 * raw input.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const HOST_OVERRIDE_PARAMS = new Set(['host', 'hostaddr']);

function parse(raw: string, label: string): URL {
  try {
    return new URL(raw);
  } catch {
    // Never echo the input: it may contain a password.
    throw new Error(`${label} is not a valid URL`);
  }
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase();
}

/** `<host[:port]><pathname>` of a connection URL, without credentials or query. */
export function describeTarget(raw: string): string {
  const url = parse(raw, 'database URL');
  return `${url.host.toLowerCase()}${url.pathname}`;
}

function assertLocal(raw: string, label: string): URL {
  const url = parse(raw, label);
  const host = hostOf(url);

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `${label} points to a non-local host: ${host || '(none)'}${url.pathname}. ` +
        'Only localhost, 127.0.0.1 and [::1] are allowed.',
    );
  }

  for (const key of url.searchParams.keys()) {
    if (HOST_OVERRIDE_PARAMS.has(key.toLowerCase())) {
      throw new Error(
        `${label} must not contain a host or hostaddr query parameter ` +
          `(target ${host}${url.pathname}).`,
      );
    }
  }

  return url;
}

function identity(url: URL): string {
  return `${hostOf(url)}:${url.port}${url.pathname}`;
}

export function assertLocalDatabase({
  databaseUrl,
  shadowUrl,
}: {
  databaseUrl?: string;
  shadowUrl?: string;
}): void {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const database = assertLocal(databaseUrl, 'DATABASE_URL');

  if (shadowUrl) {
    const shadow = assertLocal(shadowUrl, 'SHADOW_DATABASE_URL');
    if (identity(shadow) === identity(database)) {
      throw new Error(
        `SHADOW_DATABASE_URL shadow must differ from DATABASE_URL ` +
          `(both are ${hostOf(shadow)}${shadow.pathname}).`,
      );
    }
  }
}
