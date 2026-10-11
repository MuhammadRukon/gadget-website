import { describe, expect, it } from 'vitest';

import { assertLocalDatabase, describeTarget } from '../db-target';

const LOCAL = 'postgresql://u:p@localhost:5433/gadget_dev';

/** Run the guard and return the thrown message (fails the test if it does not throw). */
function messageOf(args: { databaseUrl?: string; shadowUrl?: string }): string {
  try {
    assertLocalDatabase(args);
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    return (err as Error).message;
  }
  throw new Error('expected assertLocalDatabase to throw');
}

/** Error messages must never leak credentials or a full connection string. */
function expectNoCredentialLeak(message: string) {
  expect(message).not.toMatch(/:\/\/[^\s]*:[^\s]*@/);
}

describe('db-target: assertLocalDatabase allowed hosts', () => {
  it('accepts localhost', () => {
    expect(() => assertLocalDatabase({ databaseUrl: LOCAL })).not.toThrow();
  });

  it('accepts 127.0.0.1', () => {
    expect(() =>
      assertLocalDatabase({ databaseUrl: 'postgresql://u:p@127.0.0.1:5433/gadget_dev' }),
    ).not.toThrow();
  });

  it('accepts [::1]', () => {
    expect(() =>
      assertLocalDatabase({ databaseUrl: 'postgresql://u:p@[::1]:5433/gadget_dev' }),
    ).not.toThrow();
  });
});

describe('db-target: assertLocalDatabase missing url', () => {
  it('throws when databaseUrl is undefined', () => {
    expect(messageOf({ databaseUrl: undefined })).toContain('DATABASE_URL is not set');
  });

  it('throws when databaseUrl is an empty string', () => {
    expect(messageOf({ databaseUrl: '' })).toContain('DATABASE_URL is not set');
  });
});

describe('db-target: assertLocalDatabase remote hosts', () => {
  it('rejects a remote host and names host and path without credentials', () => {
    const message = messageOf({
      databaseUrl: 'postgresql://u:secretpw@db.prisma.io:5432/postgres',
    });
    expect(message).toContain('db.prisma.io');
    expect(message).toContain('/postgres');
    expect(message).not.toContain('secretpw');
    expect(message).not.toContain('u:secretpw');
    expectNoCredentialLeak(message);
  });

  it('rejects a malformed url without echoing the input', () => {
    const input = 'not a url with secretpw';
    const message = messageOf({ databaseUrl: input });
    expect(message).not.toContain(input);
    expect(message).not.toContain('secretpw');
    expectNoCredentialLeak(message);
  });

  it('rejects a host that merely starts with localhost (no suffix matching)', () => {
    const message = messageOf({ databaseUrl: 'postgresql://u:p@localhost.evil.com:5432/x' });
    expect(message).toContain('localhost.evil.com');
    expectNoCredentialLeak(message);
  });

  it('rejects the userinfo trick where localhost is the username', () => {
    const message = messageOf({ databaseUrl: 'postgresql://localhost@db.prisma.io:5432/x' });
    expect(message).toContain('db.prisma.io');
    expectNoCredentialLeak(message);
  });
});

describe('db-target: assertLocalDatabase host override params', () => {
  it('rejects a host query param', () => {
    const message = messageOf({ databaseUrl: `${LOCAL}?host=db.prisma.io` });
    expectNoCredentialLeak(message);
    expect(message).not.toContain('db.prisma.io');
  });

  it('rejects a hostaddr query param', () => {
    const message = messageOf({ databaseUrl: `${LOCAL}?hostaddr=1.2.3.4` });
    expectNoCredentialLeak(message);
    expect(message).not.toContain('1.2.3.4');
  });

  it('rejects host override params regardless of case', () => {
    expect(() => assertLocalDatabase({ databaseUrl: `${LOCAL}?HOST=db.prisma.io` })).toThrow();
    expect(() => assertLocalDatabase({ databaseUrl: `${LOCAL}?HostAddr=1.2.3.4` })).toThrow();
  });

  it('still accepts unrelated query params', () => {
    expect(() =>
      assertLocalDatabase({ databaseUrl: `${LOCAL}?schema=public&connection_limit=5` }),
    ).not.toThrow();
  });
});

describe('db-target: assertLocalDatabase shadow database', () => {
  it('accepts an absent shadowUrl (undefined)', () => {
    expect(() => assertLocalDatabase({ databaseUrl: LOCAL, shadowUrl: undefined })).not.toThrow();
  });

  it('accepts an absent shadowUrl (empty string)', () => {
    expect(() => assertLocalDatabase({ databaseUrl: LOCAL, shadowUrl: '' })).not.toThrow();
  });

  it('accepts a distinct local shadowUrl', () => {
    expect(() =>
      assertLocalDatabase({
        databaseUrl: LOCAL,
        shadowUrl: 'postgresql://u:p@localhost:5433/gadget_shadow',
      }),
    ).not.toThrow();
  });

  it('rejects a shadowUrl identical to databaseUrl', () => {
    const message = messageOf({ databaseUrl: LOCAL, shadowUrl: LOCAL });
    expect(message.toLowerCase()).toContain('shadow must differ');
    expectNoCredentialLeak(message);
  });

  it('rejects a shadowUrl with the same host, port and path but different credentials', () => {
    const message = messageOf({
      databaseUrl: LOCAL,
      shadowUrl: 'postgresql://other:otherpw@localhost:5433/gadget_dev',
    });
    expect(message.toLowerCase()).toContain('shadow must differ');
    expect(message).not.toContain('otherpw');
  });

  it('rejects a remote shadowUrl', () => {
    const message = messageOf({
      databaseUrl: LOCAL,
      shadowUrl: 'postgresql://u:secretpw@db.prisma.io:5432/shadow',
    });
    expect(message).toContain('db.prisma.io');
    expect(message).not.toContain('secretpw');
    expectNoCredentialLeak(message);
  });
});

describe('db-target: describeTarget', () => {
  it('returns host:port and pathname only', () => {
    expect(
      describeTarget('postgresql://u:secretpw@localhost:5433/gadget_dev?sslmode=disable'),
    ).toBe('localhost:5433/gadget_dev');
  });

  it('omits the port when none is given', () => {
    expect(describeTarget('postgresql://u:secretpw@localhost/gadget_dev')).toBe(
      'localhost/gadget_dev',
    );
  });
});
