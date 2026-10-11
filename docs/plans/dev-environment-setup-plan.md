# Plan: Local dev environment + environment separation

Status: **APPROVED (planning only, no code changed).** Revises and replaces the earlier draft of this file. The draft's Vercel/DB-separation content carries forward as Phase 4. Steps marked **[USER]** are manual (secret values, vendor dashboards); secret values must never be pasted into chat, logs, docs or commits.

## Summary

`.env.dev` is dead config today: Next.js loads only `.env`, `.env.local`, `.env.development`, `.env.production` and `.env.test`, and the Prisma CLI, Prisma client, `tsx` seed and Vitest read only the repo-root `.env`. That `.env` points `npm run dev`, `npm test`, `db:seed` and `prisma migrate` at the remote `db.prisma.io` database that Vercel Production uses. Goal: every local command runs against local Postgres (`localhost:5433`: `gadget_dev`, shadow `gadget_shadow`), with guardrails so a local command cannot mutate production, and with Vercel Production behavior unchanged.

## Context & findings

- Env loading: `.env.dev` is loaded by nothing. The Prisma client self-loads `../../../.env` (`node_modules/.prisma/client/index.js:519-521`); `vitest.config.ts:1-11` loads no env; `prisma/seed.ts:11-14` and `prisma/backfill-email-verified.ts:10-12` use bare `new PrismaClient()`.
- Validation: `src/env.ts:11` + `instrumentation.ts:1-5` fail fast on 7 required keys (`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). `.env.dev` has 4 keys only (`DATABASE_URL`, `SHADOW_DATABASE_URL`, `UPSTASH_*`).
- `.env` `DATABASE_URL` and `SHADOW_DATABASE_URL` both target `db.prisma.io` and are identical. `prisma/schema.prisma:5-8` has no `shadowDatabaseUrl`, so the shadow variable is ignored today.
- Live-DB tests: 7 files under `src/server/{auth,orders,payments,catalog,common,checkout}/__tests__/` (e.g. `orders.service.test.ts:9`, `rate-limit.test.ts:12`).
- Seed fallback credentials `admin12345` / `customer12345` outside `NODE_ENV=production` (`prisma/seed.ts:17-26`).
- Mail and uploads: `src/server/common/mailer.ts:25-26` log-only when `RESEND_API_KEY` is unset; `src/server/media/cloudinary.ts:12-26` reads `CLOUDINARY_UPLOAD_FOLDER`.
- Auth host trust: `src/server/auth/authOptions.ts:56` trusts the host only if `AUTH_TRUST_HOST==='true'` or `NODE_ENV!=='production'` (Vercel Preview builds run with `NODE_ENV=production`).
- `.gitignore:34` (`.env*`) also ignores `.env.example`. `package.json:5-19` has `lint: next lint` (removed in Next 16, unverified), no `engines`, no `.nvmrc`. `tsconfig.json:31-41` typechecks `**/*.ts` (a new `scripts/` file is typechecked). `eslint.config.mjs:1-21` has no ignores block. `tsx ^4.21.0` is available (`package.json:87`); `dotenv-cli` is not installed (`dotenv` 16.6.1 is transitive only, `package-lock.json:5789`).
- Docs needing edits: `README.md:28-31,36-44`; `CLAUDE.md:15-23,34`; `docs/context/01-overview.md:30-58` (stale lines 32, 36, 45); `docs/context/06-conventions.md:36-37` (claims `migrate dev` uses `SHADOW_DATABASE_URL`, false until Phase 2).
- Deployment: Vercel only; `main` auto-deploys, `dev` is the integration branch; Vercel builds do not run migrations. Dashboard holds its own production `DATABASE_URL` (user-confirmed).
- Reuse: `tsx`, Vitest, the existing `src/env.ts` validation (not duplicated), the "pure functions in `src/server/common`" test convention, and the Vercel/DB-separation content of the earlier draft.

## Constraints, assumptions, risks, unknowns

- Constraint: production behavior unchanged. Only `build`, `start` and Vercel dashboard variables affect production. Phases 1-3 do not touch them; the one build-path change is `shadowDatabaseUrl` (Phase 2), covered by an acceptance criterion.
- Constraint: no secret values in chat, logs, docs or commits. Steps name keys only. Moving secret values between env files is a manual user step.
- Assumption (user-confirmed): local Postgres on `:5433` has `gadget_dev` migrated. `gadget_shadow` existence is unverified; Phase 1 checks it. Production DB = the current `db.prisma.io` DB. Vercel dashboard has its own production `DATABASE_URL`.
- Assumption: shell-level env (set by `dotenv-cli`) beats `.env` for Next, Prisma, tsx and Vitest. Phase 1 proves it. If false, fall back to making `.env` itself the dev file.
- Risk: with `.env` DB URLs blanked, a local `next build` may need `DATABASE_URL`. Mitigation: Phase 1 step 6 checks it; Phase 3 documents `dotenv -e .env.dev -- next build`.
- Risk: `NODE_ENV=production` locally changes seed, trustHost and dev-only behaviors. Mitigation: documented in Phase 3.
- Risk: a shell `DATABASE_URL` beats `.env.dev` (`dotenv-cli` does not override existing env). Mitigation: the Phase 2 guard runs after loading and catches it.
- Risk: direct `npx prisma ...` bypasses the guard. Mitigation: blanked `.env` makes unwrapped commands fail closed.
- Risk: `engines.node` is read by Vercel and can override the project Node version, changing the production runtime. Mitigation: Phase 3 gates the pin on the Vercel dashboard major.
- Risk: Preview deployments are internet-reachable and the seed falls back to default credentials. Mitigation: strong `SEED_*` values for the remote seed run; Deployment Protection check (Phase 4).
- Open (owner: user): Prisma Postgres free-tier database limit for the second remote DB (verify in console, Phase 4).

## Workspace setup (first step, always)

Branch strategy: **worktree**. Base `main`; branch `chore/local-dev-environment`; PR target `dev` (per git-hygiene). From the main checkout:

1. `git worktree add ..\gadget-website-local-dev -b chore/local-dev-environment main`
2. In the worktree: `git cherry-pick 4371fb1` (brings the earlier draft of this file), then overwrite `docs/plans/dev-environment-setup-plan.md` with this approved plan and commit it.
3. In the worktree: `npm ci`. **[USER]** manually copy `.env`, `.env.dev` and `.env.example` from the main checkout (gitignored, not carried by the worktree).
4. Git rules: git-hygiene format, no attribution trailers, specific files staged only. Commits during an approved execution are pre-authorized. Push, PR creation and merge are not.

Env-file edits in Phase 1 are made on the **worktree's copies**. The main checkout's `.env` and `.env.dev` stay untouched until Cross-Validation passes; the user replicates the edits there after the branch merges.

## Skills for the executor

`Desktop/gadget-website:git-hygiene` (all git work), `tdd` (guard script), `verify` and `run` (smoke checks), `code-review` (once, in Cross-Validation), `Desktop/gadget-website:execute-with-me` (to run this plan).

## Phase 1: Local env loading (`dotenv-cli`, self-contained `.env.dev`, neutered `.env`)

**Scope:** `package.json` and `package-lock.json` (new devDependency, scripts); `.env.dev` and `.env` worktree copies (gitignored, edited by the user). No `src/` or `prisma/` code changes.

**Steps**
1. `npm install -D dotenv-cli` (exact resolved version stays in the lockfile).
2. Rewrite these `package.json` scripts, leaving `build`, `start`, `postinstall` and `typecheck` untouched:
   - `dev`: `dotenv -e .env.dev -- next dev --turbopack`
   - `test`: `dotenv -e .env.dev -- vitest run`
   - `test:watch`: `dotenv -e .env.dev -- vitest`
   - `db:seed`: `dotenv -e .env.dev -- tsx prisma/seed.ts`
   - `db:studio`: `dotenv -e .env.dev -- prisma studio`
   - New: `db:migrate` (`prisma migrate dev`), `db:status` (`prisma migrate status`), `db:backfill-email` (`tsx prisma/backfill-email-verified.ts`), each prefixed with `dotenv -e .env.dev --`.
3. **[USER, values never pasted into chat]** Make `.env.dev` self-contained. Key names:
   - the 7 required keys, plus `AUTH_TRUST_HOST`;
   - `CLOUDINARY_UPLOAD_FOLDER=gadget-website-dev`;
   - `EMAIL_FROM`, and `RESEND_API_KEY` present but empty;
   - `GOOGLE_*`, `SSLCOMMERZ_*`, `BKASH_*` empty; `SSLCOMMERZ_SANDBOX=true`;
   - `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` set to `http://localhost:3000`;
   - a **new** `NEXTAUTH_SECRET` generated for dev, different from production;
   - Cloudinary credentials copied from `.env` (same account, different folder);
   - `UPSTASH_*` removed.
4. **[USER]** In `.env`, set `DATABASE_URL=` and `SHADOW_DATABASE_URL=` to empty and remove `UPSTASH_*`. First confirm the Vercel dashboard has Production `DATABASE_URL` set (user already confirmed it does).
5. Verify `gadget_shadow` exists on `:5433` (`CREATE DATABASE gadget_shadow;` if missing, run by the user).
6. Run `dotenv -e .env.dev -- next build` once and record whether plain `npm run build` also works locally with the blanked `.env`. Feeds the Phase 3 docs.

**Acceptance criteria**
- [ ] `npx dotenv -e .env.dev -- node -e "const u=new URL(process.env.DATABASE_URL);console.log(u.host+u.pathname)"` prints exactly `localhost:5433/gadget_dev`. The same one-liner on `SHADOW_DATABASE_URL` prints `localhost:5433/gadget_shadow`.
- [ ] `npm run db:status` exits 0, prints "Database schema is up to date!", and lists exactly the migrations in `prisma/migrations` (`0_init`, `20260718000000_add_rate_limit_bucket` on this branch).
- [ ] **Precedence proof:** temporarily set `.env` `DATABASE_URL` to the dummy `postgresql://u:p@invalid.example:5432/x`. `npm run db:status` still reports the `localhost:5433/gadget_dev` result above, and `npm test` exits 0. Restore the empty value afterwards. No real production credential is used.
- [ ] **Unwrapped commands fail closed (blanked `.env`):** `npx prisma migrate status` exits non-zero with an empty/missing datasource URL error. `npx vitest run` fails its 7 live-DB suites with a connection or empty-URL error (pure-logic suites still pass). Neither makes a network connection to `db.prisma.io`.
- [ ] `npm run dev` boots with no `src/env.ts` validation error. `GET http://localhost:3000/` and `GET /products` return 200, rendering products from `gadget_dev`. With the `:5433` Postgres stopped, `GET /products` fails with a Prisma "Can't reach database server at `localhost:5433`" error and recovers (200) after restart.
- [ ] `npm test` exits 0 with 0 failed tests; all 7 DB-backed suites run.
- [ ] `npm run db:seed` exits 0. Run twice, the second run leaves exactly one `User` row for the seeded admin email in `gadget_dev` (idempotent).
- [ ] An image uploaded via the admin catalog form lands in the Cloudinary folder `gadget-website-dev`, and nothing new appears in `gadget-website`.
- [ ] `POST /api/auth/forgot` for a seeded email logs the mailer's skip message (`src/server/common/mailer.ts:25-26`) and sends no email.
- [ ] Key-name check with values stripped (`(Get-Content .env.dev) -replace '=.*','='`): contains the 7 required keys, `CLOUDINARY_UPLOAD_FOLDER`, `RESEND_API_KEY`, no `UPSTASH_*`. The same listing on `.env` shows `DATABASE_URL=` and `SHADOW_DATABASE_URL=` empty.
- [ ] `git diff main -- package.json` shows `build`, `start`, `postinstall` and `typecheck` byte-identical. `git status` lists no env file. `git diff` contains no key values.
- [ ] `npm run typecheck` exits 0. The exit code of `dotenv -e .env.dev -- next build` is recorded in the commit body or Phase 3 docs.

## Phase 2: Safety (DB-target guard, `shadowDatabaseUrl`)

**Scope:** new `src/server/common/db-target.ts` (pure logic) and `src/server/common/__tests__/db-target.test.ts` (inside the `src/**` include of `vitest.config.ts:7-8`); new `scripts/assert-db-target.ts` (thin CLI wrapper, typechecked via `tsconfig.json:31-38`); `package.json` scripts; `prisma/schema.prisma:5-8`. Follows the existing "pure functions in `src/server/common`" convention.

**Steps** (invoke `tdd`: tests first, see red, then green)
1. Write `db-target.test.ts` first. `assertLocalDatabase({ databaseUrl, shadowUrl })` throws or returns ok. Cases:
   - `postgresql://u:p@localhost:5433/gadget_dev`, `127.0.0.1`, `[::1]` pass.
   - Missing or empty URL throws "DATABASE_URL is not set".
   - `db.prisma.io` throws; the message names host and database only, never the password.
   - Malformed string throws without echoing the input.
   - `localhost.evil.com` (no suffix matching) and `postgresql://localhost@db.prisma.io/x` (userinfo trick) throw.
   - Any `host` or `hostaddr` query param throws.
   - `shadowUrl` identical to `databaseUrl` (host plus path) throws.
   - A remote `shadowUrl` throws.
   - An absent `shadowUrl` passes.
2. Implement `db-target.ts`: parse with `new URL`, host allowlist `{localhost, 127.0.0.1, [::1]}`, error messages expose only `host` and `pathname`.
3. Write `scripts/assert-db-target.ts`: read `process.env.DATABASE_URL` and `SHADOW_DATABASE_URL` after `dotenv-cli` loaded them, call the pure function, print `DB target OK: <host><path>` or the error, exit 1 on failure. No env-var escape hatch.
4. Add `"db:guard": "dotenv -e .env.dev -- tsx scripts/assert-db-target.ts"` and npm lifecycle hooks `predev`, `pretest`, `pretest:watch`, `predb:seed`, `predb:studio`, `predb:migrate`, `predb:backfill-email`, each `npm run db:guard`.
5. In `schema.prisma` datasource, add `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`. Leave `url` untouched.
6. Document the known bypass: a shell `DATABASE_URL` beats `.env.dev`; the guard runs after loading and catches it. Direct `npx prisma ...` skips the guard but is blocked by the blanked `.env`.

**Acceptance criteria**
- [ ] `npx vitest run src/server/common/__tests__/db-target.test.ts` exits 0, with every case in step 1 a separate passing test (written first and seen failing before implementation).
- [ ] `npm run db:guard` exits 0 and prints `DB target OK: localhost:5433/gadget_dev`.
- [ ] With the shell variable `DATABASE_URL=postgresql://u:p@invalid.example:5432/x` set: `npm run dev`, `npm test`, `npm run db:seed`, `npm run db:migrate` and `npm run db:studio` each exit non-zero at the guard. Output names `invalid.example` and `/x` and contains neither `u:p` nor the full URL. The dev server, vitest, seed and prisma processes never start.
- [ ] With `SHADOW_DATABASE_URL` equal to `DATABASE_URL` in the shell, `npm run db:migrate` exits non-zero at the guard with a "shadow must differ" message, before Prisma runs.
- [ ] With `SHADOW_DATABASE_URL=postgresql://u:p@localhost:5433/does_not_exist` in the shell, `npm run db:migrate` passes the guard and fails inside Prisma with a shadow-database error. With the correct `gadget_shadow` restored, `npm run db:migrate -- --create-only --name noop_check` exits 0 and creates no migration folder (schema in sync). This proves the shadow URL is now read.
- [ ] **Production build path:** in a clean shell with `DATABASE_URL` and `SHADOW_DATABASE_URL` both unset, `npx prisma generate` exits 0 (what Vercel's `postinstall` runs), and `git diff main -- prisma/schema.prisma` shows only the single added `shadowDatabaseUrl` line.
- [ ] `npm run typecheck` exits 0 with `scripts/assert-db-target.ts` included. `npm test` (all suites) exits 0 with the guard hook active.
- [ ] No test or script output in any criterion above contains a password or full connection string (grep captured output for `://.*:.*@`).

## Phase 3: Cleanups and docs (Node pin, `.env.example`, lint, documentation)

**Scope:** `package.json` (`engines`, `lint`, new `db:deploy` script), new `.nvmrc`, `.gitignore:34`, `.env.example`, `eslint.config.mjs`, `README.md`, `CLAUDE.md`, `docs/context/01-overview.md`, `docs/context/06-conventions.md`. No `src/` logic changes.

**Steps**
1. **Node pin.** **[USER]** read the Node.js Version setting in Vercel (Project, Settings, General) and tell the executor the major. The executor checks Next 16.2.4's minimum Node requirement and Node's current LTS status from official docs (do not guess). Set `.nvmrc` and `engines.node` to a version whose **major equals the Vercel setting** and satisfies Next's minimum. Local Node 26 is not pinned to. If the Vercel major is unsupported or too old for Next 16, stop and ask the user before changing Vercel.
2. **`.env.example`.** Add `!.env.example` after `.gitignore:34`. Update the file:
   - header comments: "copy to `.env.dev` for local; production values live only in the Vercel dashboard";
   - placeholder-only values (never real secrets), with `DATABASE_URL` and `SHADOW_DATABASE_URL` as `localhost:5433` example placeholders;
   - add `AUTH_TRUST_HOST`, `CLOUDINARY_UPLOAD_FOLDER=gadget-website-dev`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`; `AUTH_SECRET` as a commented-out fallback (`src/proxy.ts:31`);
   - no `UPSTASH_*`.
3. **Lint.** On a clean checkout first run `npm run lint` and record the baseline (error count or the exact "next lint" failure). Then set `"lint": "eslint ."` and add an `ignores` block to `eslint.config.mjs` (`.next/**`, `node_modules/**`, `public/**`, `.agents/**`, `src/generated/**`). Do not fix pre-existing violations.
4. **`db:deploy` script.** Add `db:deploy` (`dotenv -e .env.dev -- prisma migrate deploy`) with a `predb:deploy` guard hook so a fresh clone can build the local schema.
5. **Docs.**
   - `README.md:28-31`: new getting-started sequence (`npm ci`, copy `.env.example` to `.env.dev`, fill values, `npm run db:deploy`, `npm run db:seed`, `npm run dev`).
   - `README.md:36-44`: scripts table including the guard hooks; fix the "Vitest unit tests" row to say DB-backed against local `gadget_dev`.
   - `CLAUDE.md:15-23,34`: commands block, `.env.dev` instead of "copy to `.env`", a line that tests hit the local DB through the guard.
   - `docs/context/01-overview.md:30-58`: env section. Remove the stale "No `.env.example` exists" (line 32) and the stale `NEXT_PUBLIC_BASE_URL` (lines 36, 45), after grepping `src` to confirm nothing reads it.
   - `docs/context/06-conventions.md:36-37`: shadow DB now wired; `migrate dev`, `migrate reset` and `db:seed` are local-only.
   - In all of them: the `NODE_ENV=production` local-run caveat, the Phase 1 `next build` result, and the production rule (`migrate deploy` is manual against production, URL pulled from Vercel for that one command and never stored in a local file).

**Acceptance criteria**
- [ ] `.nvmrc` and `package.json` `engines.node` major equals the Vercel dashboard major reported by the user and satisfies the minimum Node for Next 16.2.4, with the executor citing the source doc. If the user cannot confirm the Vercel major, no `engines` field is added (only `.nvmrc`).
- [ ] `git check-ignore -v .env.example` prints nothing (not ignored). `git check-ignore -v .env .env.dev` still reports both ignored via `.gitignore:34`.
- [ ] `.env.example` contains the key names `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`, `AUTH_TRUST_HOST`, `CLOUDINARY_UPLOAD_FOLDER`, and no `UPSTASH`. `git diff` shows only placeholders (no random-looking value over 8 characters, no `db.prisma.io`).
- [ ] `npm run lint` runs ESLint (no "unknown option" or removed-command error) and reports no files under `.next/`. Violation count is less than or equal to the recorded baseline; baseline and result are quoted in the commit body.
- [ ] `npm run db:deploy` exits 0 against `localhost:5433/gadget_dev` ("No pending migrations") and fails at the guard when `DATABASE_URL` is a remote host.
- [ ] Doc greps: `rg "NEXT_PUBLIC_BASE_URL|No \.env\.example" README.md CLAUDE.md docs/context` returns 0 hits. `rg "\.env\.dev" README.md CLAUDE.md docs/context` returns hits in `README.md`, `CLAUDE.md` and `docs/context/01-overview.md`.
- [ ] Following the `README.md` getting-started verbatim in the worktree (user supplies `.env.dev` values) ends with `GET http://localhost:3000/` returning 200.
- [ ] `git diff main -- package.json` shows `build`, `start` and `postinstall` still unchanged.

## Phase 4: Remote dev DB and Vercel variable scoping (manual dashboard work)

**Scope:** Prisma Console (new DB), Vercel dashboard (variables, Preview protection), new `.github/pull_request_template.md`. Production-scoped variable values are not edited. Production is touched read-only only.

**Steps**
1. **[USER]** In the Prisma Console, create the remote dev database `gadget-dev` (check the free-tier DB limit first). Keep the URL in a password manager only, never in chat, `.env*` or docs.
2. **[USER, shell only]** Apply the schema to the remote dev DB without storing the URL anywhere: set `DATABASE_URL` in the shell, then run `npx prisma migrate deploy` directly (not via `npm run`, so the localhost-only guard does not block it). Seed it the same way with strong `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_*` set in that shell, because `prisma/seed.ts:23-26` falls back to `admin12345` / `customer12345` and Preview URLs are internet-reachable. Close the shell afterwards.
3. **[USER]** Before editing Vercel, record variable **names and scopes only** (no values) for the Production list.
4. **[USER]** In Vercel, for each environment-specific variable currently scoped "All Environments" (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CLOUDINARY_UPLOAD_FOLDER`, `AUTH_TRUST_HOST` if present): **first** add the Preview-scoped entry, **then** narrow the old entry to Production only. Preview values:
   - the remote dev `DATABASE_URL`;
   - a different `NEXTAUTH_SECRET`;
   - `CLOUDINARY_UPLOAD_FOLDER=gadget-website-dev`;
   - `AUTH_TRUST_HOST=true` (see `authOptions.ts:56`; Preview builds run with `NODE_ENV=production`);
   - `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` set to the stable `dev`-branch alias (required by `src/env.ts`; PR-preview URLs rely on `AUTH_TRUST_HOST`);
   - gateway credentials empty, `RESEND_API_KEY` unset.
5. **[USER]** Check Preview Deployment Protection (Vercel Authentication) is on. Otherwise a seeded dev admin account is publicly reachable.
6. Add `.github/pull_request_template.md` with a "Migration applied to production? (n/a if no schema change)" checkbox and the reminder that `migrate deploy` against production is manual.
7. **[USER, read-only, optional]** Baseline: `npx prisma migrate status` against production in a shell with the URL pulled from Vercel for that command only.

**Acceptance criteria**
- [ ] With the remote dev URL in the shell, `npx prisma migrate status` prints "Database schema is up to date!" and lists the same migrations as `prisma/migrations`.
- [ ] The three DB targets (local, remote dev, production) have pairwise-different `host + pathname`, checked with a one-off `node -e` that prints only `distinct` or `COLLISION`, never the URLs.
- [ ] In the Vercel dashboard, none of `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CLOUDINARY_UPLOAD_FOLDER`, `AUTH_TRUST_HOST` is scoped "All Environments". The Production-scoped name list matches the pre-edit record, and their "last updated" timestamps are unchanged except for the scope narrowing.
- [ ] A Preview deployment of branch `dev`: sign-in as the seeded admin reaches `/dashboard`. Login with `admin@tecnologia.test` / `admin12345` fails with invalid credentials.
- [ ] On that Preview, a COD test order raises the remote dev DB `Order` count by exactly 1, and the production DB `Order` count is identical before and after (user reads both counts read-only).
- [ ] An image uploaded on the Preview appears in the Cloudinary folder `gadget-website-dev` and not `gadget-website`. A password-reset request on the Preview sends no email (`RESEND_API_KEY` unset).
- [ ] After the next normal Production deploy, `/`, `/products` and `/login` on the production URL return 200 with existing data intact. No Production variable value was edited in this phase.
- [ ] Opening a Preview URL in a private window shows Vercel's authentication wall, or the user records an explicit decision to leave it public.
- [ ] `git ls-files .github` lists `.github/pull_request_template.md`, whose text contains "Migration applied to production".

## Cross-Validation Phase (final, always)

Run after all phases, in the worktree:

1. **Full suite.** `npm run typecheck` exits 0. `npm run lint` shows violations at or below the recorded baseline. `npm test` exits 0 with 0 failed (guard hook active, all 7 DB suites running). `npx dotenv -e .env.dev -- next build` exits 0.
2. **End-to-end flows** (invoke `verify`, and `run` to launch the app) against `gadget_dev` on localhost: browse `/` and `/products`, sign in as the seeded admin and reach `/dashboard`, place a COD order and see it in the dashboard orders, upload a catalog image (lands in `gadget-website-dev`), request a password reset (mail skipped). Demonstrate each guard failure from Phase 2 once with a dummy remote shell `DATABASE_URL`.
3. **Production non-regression.** `git diff main -- package.json` shows `build`, `start`, `postinstall` unchanged. `npx prisma generate` passes with `DATABASE_URL` and `SHADOW_DATABASE_URL` unset. Vercel Preview and Production smoke checks from Phase 4 pass.
4. **Secret hygiene.** Over `git diff main...HEAD` and the new files, a search for `postgres(ql)?://[^ ]*:[^ ]*@`, `re_[A-Za-z0-9]{10,}` and the Cloudinary key names with values returns nothing. `git ls-files` lists no `.env`, `.env.dev` or `.env.local`.
5. **Reconcile.** Walk every acceptance checkbox in Phases 1-4 and the original requirements (local-only DB, production unchanged, no secrets, `.env.dev` actually loaded, Cloudinary dev folder, Resend off, shadow wired, guard, Node pin, `.env.example`, lint, docs, remote dev DB and Vercel scoping). Produce a pass/fail table with evidence. Any fail blocks hand-off.
6. **Single final code review** (`code-review`, once, over the whole branch diff). Blocking findings are fixed; advisory ones are listed.
7. **Post-merge [USER].** Replicate the `.env` and `.env.dev` edits in the main checkout and re-run `npm run db:status` there.

## Out of scope

- Real payment gateway credentials, business registration, production Resend domain.
- CI/CD migration pipeline (GitHub Actions), backups and point-in-time recovery, monitoring, a staging environment.
- Docker or docker-compose.
- Fixing pre-existing lint violations or any `src/` feature code.
- The Redis/Upstash implementation (`feature/redis-implementation`) and the COD-fee migration sequencing (`feature/admin-payment-methods-cod-fee`).
- Editing any Production-scoped Vercel value, rotating production secrets, moving off Vercel or Prisma Postgres.

## Rollback note (worktree strategy)

- **Code:** from the main checkout, `git worktree remove ..\gadget-website-local-dev --force`, then `git branch -D chore/local-dev-environment`. If it was ever pushed (needs the user's explicit yes), the remote branch is also deleted by explicit request. The earlier draft stays intact on `chore/dev-environment-setup`.
- **Local env:** the main checkout's `.env` and `.env.dev` are not modified before merge, so nothing to restore. If the edits were already replicated there, restore the production `DATABASE_URL` from the Vercel dashboard or the password manager.
- **Vercel and Prisma Console:** restore the pre-edit variable scopes recorded in Phase 4 step 3, delete the Preview-scoped entries, delete the remote `gadget-dev` database. Production data and Production values are never modified by this plan.

## Hand-off

Execution is a separate step: run this plan with `execute-with-me` (or subagent-driven-development). Planning made no code changes.

## Execution Progress

**Status: in progress**

_Last updated: 2026-10-11 — Branch: chore/local-dev-environment — Workspace: worktree at C:\Users\muhammad\Desktop\gadget-website-local-dev_

Final commit list: `178012a` (cherry-picked draft plan), `ac52ec6` (revised plan), `ce78b21` (progress tracking), `aa34d52` (dotenv-cli scripts)

| Phase | Status | Commit | Review | Notes |
| --- | --- | --- | --- | --- |
| 1. Local env loading | done (3 items open) | `aa34d52` | deferred | Code by general-purpose agent (needs shell). At user's instruction the orchestrator built worktree `.env`/`.env.dev` from main `.env` (DB URLs blanked in `.env`, dev DB URLs + fresh NEXTAUTH_SECRET in `.env.dev`; user will replace `.env.dev` values later). Verified: targets, db:status, precedence proof, fail-closed, 95 tests pass, dev boot 200s, seed idempotent, mail skipped, typecheck, wrapped build exit 0. Plain `npm run build` fails by design (ZodError DATABASE_URL). Open: `gadget_shadow` DB missing on :5433 (needed Phase 2); AC "Postgres stopped -> Can't reach localhost:5433" not run (would stop user's DB service); AC Cloudinary upload to gadget-website-dev deferred to Cross-Validation e2e. |
| 2. Safety (DB-target guard, shadowDatabaseUrl) | pending | — | deferred | — |
| 3. Cleanups and docs | pending | — | deferred | — |
| 4. Remote dev DB and Vercel scoping | pending | — | deferred | — |
| Cross-Validation | pending | — | pending | — |
