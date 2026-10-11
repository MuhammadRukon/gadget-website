## Summary

<!-- What does this PR do and why? One or two sentences. -->

## Changes

<!-- Bullet list of what changed. Keep it to the meaningful bits. -->

-

## How it was verified

<!-- Tests, typecheck, and manual checks. Say what you actually ran. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check (describe what you clicked through or called):

## Risks / follow-ups

<!-- Anything reviewers should watch for, plus work deliberately left for later. "None" is fine. -->

## Checklist

- [ ] `npm run typecheck` and `npm test` pass locally
- [ ] No secrets or `.env*` values in the diff
- [ ] CI / Vercel preview build passes
- [ ] Migration applied to production? (n/a if no schema change)

  Note: `prisma migrate deploy` against production is manual: pull the production URL from Vercel for that one command in a one-off shell; never store it in a local file. The localhost-only `npm run db:*` guard intentionally blocks remote databases.
