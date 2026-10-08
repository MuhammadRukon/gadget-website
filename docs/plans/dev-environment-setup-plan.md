# Plan: Separate dev environment (Vercel + Prisma Postgres)

Status: **DRAFT, not yet reviewed with the user.** Written so it can be picked up later. No interview or exploration beyond the repo files listed under "Current state". Verify the vendor-console details marked (verify) in the dashboards before relying on them.

## Summary

Today local development, Vercel Preview and Vercel Production all point at one Prisma Postgres database (`db.prisma.io`), and `SHADOW_DATABASE_URL` points at the same host. The project is still in its development phase, so nothing real is at risk yet. The goal is to separate environments before real customers and orders exist: a dev database for local work and Vercel Previews, a production database used only by Vercel Production, and a migration workflow that never touches production by accident.

## Current state (from the repo)

- `.env` (untracked, gitignored) holds `DATABASE_URL` and `SHADOW_DATABASE_URL`, both on `db.prisma.io`. `.env.example` documents the variables.
- `package.json`: `build` is plain `next build`; `postinstall` is `prisma generate`. **Vercel builds do not run migrations.** Schema changes reach a database only when someone runs `prisma migrate deploy` against it.
- `prisma/seed.ts` is dev-only (`npm run db:seed`), with a guard requiring `SEED_ADMIN_*` env vars.
- `src/env.ts` fail-fast validates env at boot via `instrumentation.ts`; a missing required variable crashes the server.
- Git flow: `main` auto-deploys to Vercel production; `dev` is the integration branch.
- Tests (`npm run test`) are live-DB tests and run against whatever `DATABASE_URL` points to.
- Cloudinary uploads go to `CLOUDINARY_UPLOAD_FOLDER` (default `gadget-website`). Payment gateways fall back to sandbox when credentials are unset; email is log-only when `RESEND_API_KEY` is unset.

## Target setup

| Environment | Database | Where its variables live | Cloudinary folder | Gateways / email |
|---|---|---|---|---|
| Local | Dev DB (Prisma Postgres) or local Docker Postgres | `.env` (untracked) | `gadget-website-dev` | creds empty (sandbox), `RESEND_API_KEY` empty (log-only) |
| Vercel Preview (branch `dev`, and PR previews) | Dev DB | Vercel env vars, scope **Preview** | `gadget-website-dev` | same as local |
| Vercel Production (`main`) | Production DB | Vercel env vars, scope **Production** | `gadget-website` | real creds when business registration is done |
| Shadow DB (for `prisma migrate dev` only) | Separate empty database, never the dev or production DB | `SHADOW_DATABASE_URL` in `.env` only | n/a | n/a |

## Decisions to make before starting (open questions)

1. **Which database becomes production?** Recommendation: keep the existing database as **production** (Vercel Production already points at it) and create a **new** dev database. Alternative: create a fresh production DB later, at launch, and treat the current DB as dev until then. Owner: user.
2. **Local database:** a second Prisma Postgres database (zero install, but counts against the free-tier database limit (verify)) versus Docker Postgres on the Windows machine (free, offline, good for the shadow DB, but needs Docker). Recommendation: dev DB on Prisma Postgres for Preview and shared use, Docker Postgres for the local shadow DB if Docker is available, otherwise a second Prisma Postgres database for shadow.
3. **Preview scope:** should every PR preview use the dev DB, or only the `dev` branch? Recommendation: all Previews use the dev DB (Vercel Preview scope), since no preview should ever touch production data.
4. **Migrations in CI:** keep manual `migrate deploy` (recommended for now) or add a GitHub Action that runs it on merge to `main`.

## Phase D1: Create the databases and decide the baseline

**Steps**
1. In the Prisma Console, create database `gadget-dev` (and, if using Prisma Postgres for it, `gadget-shadow`). Copy the connection strings into a password manager, not into the repo or chat.
2. Decide per open question 1 which database is production. Record the production host name (not the password) in `docs/context/01-overview.md` so it can be recognized in a shell.
3. Run `npx prisma migrate deploy` against the dev DB (temporarily set `DATABASE_URL` in the shell, not in a committed file) to create the schema from `prisma/migrations`. Then run `npm run db:seed` against the dev DB only.

**Acceptance criteria**
- [ ] `npx prisma migrate status` against the dev DB prints "Database schema is up to date" with the same migration list as `prisma/migrations`.
- [ ] After seeding, signing in at `http://localhost:3000/login` as the seeded admin reaches `/dashboard`, and the dev DB contains the demo catalog.
- [ ] The dev, shadow and production connection strings are three different hosts or database names (compare `new URL(x).host + pathname` for each; no two equal).
- [ ] No connection string appears in `git diff`, `git log -p` for this change, or any file under `docs/`.

## Phase D2: Point local development at the dev DB

**Steps**
1. Edit the local `.env`: `DATABASE_URL` and `SHADOW_DATABASE_URL` to the dev and shadow databases; `CLOUDINARY_UPLOAD_FOLDER=gadget-website-dev`; leave gateway credentials and `RESEND_API_KEY` empty.
2. Update `.env.example` comments to say which environment each value is for, and add a line "never put production credentials in a local `.env`".
3. Run the app and the test suite locally.

**Acceptance criteria**
- [ ] `npm run dev` boots with no `src/env.ts` validation error, and `/` renders products from the dev DB.
- [ ] `npm run test` passes against the dev DB, and a row count of `User` and `Order` in the production DB is identical before and after the run (tests never touched production).
- [ ] An image uploaded through the admin catalog form appears in the Cloudinary folder `gadget-website-dev`, not `gadget-website`.
- [ ] `npx prisma migrate dev --create-only --name noop_check` (then deleted) runs without a shadow-DB error.

## Phase D3: Scope Vercel environment variables

**Steps** (Vercel dashboard → Project → Settings → Environment Variables)
1. **Production** scope: production `DATABASE_URL`, production `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_SECRET` (unique to production), `CLOUDINARY_UPLOAD_FOLDER=gadget-website`, and any real gateway or email credentials.
2. **Preview** scope: dev `DATABASE_URL`, a different `NEXTAUTH_SECRET`, `CLOUDINARY_UPLOAD_FOLDER=gadget-website-dev`, empty gateway credentials, `RESEND_API_KEY` unset. Optionally add branch-specific values for the `dev` branch (Vercel supports per-branch Preview variables (verify)).
3. **Auth on preview URLs.** `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` are per-deployment on Preview. Check `src/server/auth/authOptions.ts` and `src/proxy.ts` for host trust behavior (Auth.js v5 `trustHost` / `AUTH_URL`) and decide whether the preview needs a stable alias for the `dev` branch.
4. Optionally pull the Development scope into a local file with `vercel env pull` for reference. Never commit it.

**Acceptance criteria**
- [ ] In the Vercel dashboard, no variable is set to "All Environments" if its value is environment-specific (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CLOUDINARY_UPLOAD_FOLDER`).
- [ ] A Preview deployment of branch `dev`: sign-in works, and a test order created on it appears in the dev DB and **not** in the production DB (count `Order` rows in both before and after).
- [ ] The Production deployment still serves the existing site unchanged after the variable edits (smoke test `/`, `/products`, `/login`).
- [ ] `NEXTAUTH_SECRET` differs between Preview and Production (compare the values in the dashboard, do not paste them anywhere).

## Phase D4: Migration workflow and guardrails

**Steps**
1. Document the rule in `CLAUDE.md` and `docs/context/06-conventions.md`: schema changes are created with `prisma migrate dev` against the **dev** DB only; a PR that adds a migration must say so; before merging `dev` into `main`, run `prisma migrate deploy` against the production DB (the production URL fetched from Vercel for that one command, not stored in `.env`).
2. Add a short checklist item "migration applied to production?" to the PR body template used for `dev → main` promotions.
3. Optional guardrail: a tiny script (for example `scripts/assert-db-target.ts`) that reads `DATABASE_URL`, compares its host and database name with a `PRODUCTION_DB_HOST` environment variable kept only on the maintainer's machine, and exits non-zero. Wire it in front of `db:seed` and document using it before any manual `prisma migrate` or `prisma db` command.
4. Later (not now): decide whether to run `migrate deploy` from CI on merge to `main`.

**Acceptance criteria**
- [ ] `CLAUDE.md` and `docs/context/06-conventions.md` contain the dev-DB-only rule for `migrate dev`, `migrate reset` and `db:seed`, and the manual production `migrate deploy` step.
- [ ] If the optional guard is added: running `npm run db:seed` with `DATABASE_URL` set to the production host exits non-zero with a message and writes nothing; with the dev host it proceeds.
- [ ] A trial migration (for example adding then reverting a nullable column) goes dev DB → `migrate deploy` on production, and `npx prisma migrate status` against production prints "up to date" afterwards.
- [ ] The `dev → main` PR template includes the migration checkbox.

## Sequencing with the COD-fee feature

The plan `docs/plans/admin-payment-methods-cod-fee-plan.md` is being executed now against the current single database (the user confirmed it is a development-phase database). When this dev-environment plan is done, remember that the COD-fee migration (`20261007120000_payment_settings_cod_fee`) is already applied to the database that will become production if open question 1 keeps it as production, so Phase D1 `migrate deploy` on the new dev DB will apply it there too. If a fresh production DB is created instead, apply all migrations to it with `migrate deploy` before the first production deploy.

## Out of scope

- Real payment gateway credentials and business registration.
- Production Resend domain verification.
- Staging environment separate from the dev environment, CI/CD pipelines, database backups and point-in-time recovery, monitoring.
- Moving off Prisma Postgres or Vercel.

## Rollback note

All changes are configuration only (Vercel variables, local `.env`, docs, optional script). To roll back: restore the previous Vercel variable values (keep a copy before editing), restore the old local `.env`, and delete the dev and shadow databases in the Prisma Console. The production database and its data are never modified by this plan except by the trial migration in D4, which is additive and reversible.
