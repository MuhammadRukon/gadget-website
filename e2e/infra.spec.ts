import { expect, test } from '@playwright/test';
import { assertE2eDatabaseUrl } from './support/db-guard';

const accepted = [
  'postgresql://u:p@localhost:5433/gadget_e2e',
  'postgresql://u:p@127.0.0.1:5433/gadget_e2e',
  'postgresql://u:p@[::1]:5433/gadget_e2e',
];

const rejected: Array<[string, string | undefined]> = [
  ['host db.prisma.io', 'postgresql://u:p@db.prisma.io:5432/gadget_e2e'],
  ['db gadget_dev', 'postgresql://u:p@localhost:5433/gadget_dev'],
  ['db gadget_e2e_x', 'postgresql://u:p@localhost:5433/gadget_e2e_x'],
  ['host localhost.evil.com', 'postgresql://u:p@localhost.evil.com:5433/gadget_e2e'],
  ['not-a-url', 'not-a-url'],
  ['undefined', undefined],
];

test('[E2E-INFRA-01] db guard accepts only local gadget_e2e', () => {
  for (const url of accepted) {
    expect(() => assertE2eDatabaseUrl(url), url).not.toThrow();
  }
  for (const [label, url] of rejected) {
    expect(() => assertE2eDatabaseUrl(url), label).toThrow(/refusing/);
  }
});
