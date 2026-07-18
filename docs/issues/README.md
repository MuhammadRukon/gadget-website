# Known Flaws — Fix List

Findings from a full codebase review (2026-07-11). Organized by area; each file lists issues with severity, evidence (file:line), impact, and a suggested fix that respects the free-tier hosting constraint.

| File | Scope |
| --- | --- |
| [00-fix-scope.md](./00-fix-scope.md) | **Current fix pass** — what's in scope now vs. deferred, and why |
| [01-security.md](./01-security.md) | Exploitable vulnerabilities and auth weaknesses |
| [02-correctness.md](./02-correctness.md) | Race conditions, data-integrity bugs, logic errors |
| [03-architecture.md](./03-architecture.md) | Structural/scalability concerns |
| [04-frontend-ux.md](./04-frontend-ux.md) | Frontend bugs, a11y, performance, UX flaws |

SEO findings live separately in [../SEO-AUDIT.md](../SEO-AUDIT.md); missing features in [../product/FEATURE-GAPS.md](../product/FEATURE-GAPS.md).

## Priority order (fix in roughly this sequence)

| # | Issue | Severity | Where |
| --- | --- | --- | --- |
| 1 | ~~Payment success callbacks forgeable via `sandbox_` prefix~~ (✅ completed) | **CRITICAL** | security §1 |
| 2 | ~~No amount verification on gateway callbacks~~ (✅ completed) | HIGH | security §2 |
| 3 | ~~Stock oversell race in checkout~~ (✅ completed) | HIGH | correctness §1 |
| 4 | ~~Coupon usage-limit race~~ (✅ completed) | HIGH | correctness §2 |
| 5 | ~~In-memory rate limiting useless on Vercel serverless~~ (✅ completed) | HIGH | security §3 |
| 6 | ~~Admin payment verify defaults to SUCCEEDED on empty body~~ (✅ completed) | MEDIUM | security §4 |
| 7 | ~~Stock leaks on abandoned online payments (no restock/expiry)~~ (⚠️ restock completed; expiry sweep deferred) | MEDIUM | correctness §3 |
| 8 | ~~Order status transitions unvalidated (any → any)~~ (✅ completed) | MEDIUM | correctness §4 |
| 9 | Price sort only sorts the current page | MEDIUM | correctness §5 |
| 10 | Category page locks the wrong filter (brand ⇄ category mix-up) | MEDIUM | frontend §1 |
| 11 | No server-side pagination on any admin list | MEDIUM | architecture §3 |
| 12 | ~~Default admin credentials in seed script~~ (✅ completed) | MEDIUM | security §5 |
| 13 | ~~`allowDangerousEmailAccountLinking` enabled~~ (✅ completed) | MEDIUM | security §6 |
| 14 | ~~JWT role staleness; middleware checks cookie presence only~~ (✅ completed) | MEDIUM | security §7 |
| 15 | Image uploader destroys Cloudinary assets before save | MEDIUM | frontend §2 |
| 16 | Everything else (LOW) | LOW | all files |
