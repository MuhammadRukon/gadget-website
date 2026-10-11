# Implementation Report: Score-Based Product Search

## Summary
Replaced the strict substring product search with relevance-scored ranking. Added a pure scoring module (`search-score.ts`) that weighs name/SKU/brand/description matches with prefix and fuzzy-typo bonuses, and wired a ranked path into `catalogService.listPublicProducts` used by the header search preview, `/products?q=`, and brand/category pages. No frontend or contract changes were needed.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 8/10 | Matched — one real gap found and fixed during implementation (see Deviations) |
| Files Changed | 6 (2 create, 4 update) | 8 (3 create, 5 update — added a bonus test file) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Create pure scoring module | Complete | `src/server/catalog/search-score.ts` |
| 2 | Wire ranked path into `listPublicProducts` | Complete | Deviated on candidate-widening strategy — see below |
| 3 | Contract check | Complete | No change needed, confirmed |
| 4 | Unit tests for scoring | Complete | 18 tests, `search-score.test.ts` |
| 5 | Remove TODO markers | Complete | Both removed |
| 6 | Live-DB integration test (optional) | Complete | 2 tests, including a typo regression added post-manual-test |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | Pass | Zero errors |
| Lint | Not run | Pre-existing, unrelated tooling breakage — see Issues Encountered |
| Unit Tests | Pass | 57/57 across full suite (20 new: 18 scoring + 2 catalog integration) |
| Build | Pass | `npm run build` succeeded, all routes compiled |
| Integration | Pass | Live-DB tests against `DATABASE_URL` |
| Edge Cases | Pass | See scoring test table; internal-typo case caught by manual test and fixed |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `src/server/catalog/search-score.ts` | CREATED | +140 |
| `src/server/catalog/__tests__/search-score.test.ts` | CREATED | +108 |
| `src/server/catalog/__tests__/catalog.service.test.ts` | CREATED | +122 |
| `src/server/catalog/catalog.service.ts` | UPDATED | +~110 / -~30 |
| `src/hooks/use-header-search-preview.ts` | UPDATED | -2 (TODO comment) |
| `src/app/components/header/header.tsx` | UPDATED | -1 (TODO comment) |
| `.claude/PRPs/plans/score-based-search.plan.md` | CREATED (prior turn) | plan artifact |

## Deviations from Plan

**WHAT**: `candidateTerms` (the helper that widens the SQL `where` clause so scoreable rows actually get fetched) was changed from "truncate each token to its first 4 characters" (as written in the plan) to "every 3-character sliding-window substring (trigram) of each token."

**WHY**: Manual verification during implementation ("iphne" against a product named "iPhone 15") surfaced a real gap: the plan's own GOTCHA note flagged that "internal typos are only caught when another term already makes the row a candidate," but this undersold the impact — a dropped/substituted letter *anywhere but the tail* of a token (the most common typo shape) produced zero DB candidates, so the row never reached the in-memory `scoreProduct` fuzzy-match logic at all, regardless of how well that logic would have scored it. Trigram substrings fix this: a single edit can invalidate at most 2–3 overlapping trigrams, so a token of reasonable length always keeps at least one trigram in common with its correctly-spelled form, guaranteeing DB-level retrieval before the real fuzzy scoring runs. Added a regression test (`catalog.service.test.ts`, "drops an internal letter") that fails against the plan's original prefix-truncation approach and passes with trigrams.

## Issues Encountered

- **Lint tooling is broken independent of this change**: `npm run lint` (`next lint`) fails with `Invalid project directory provided, no such directory: .../lint` (appears to mis-parse its own invocation), and a direct `npx eslint .` fails with `TypeError: Converting circular structure to JSON` inside `@eslint/eslintrc`'s config validator (circular `react` plugin config). Both failures reproduce with no relation to the files touched here. Lint was not run as a result — flagging so it's tracked as a separate pre-existing issue, not swept under this change.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `src/server/catalog/__tests__/search-score.test.ts` | 18 tests | `scoreProduct` weighting/ordering, `compareScored` tiebreaks, `isFuzzyTokenMatch` edit-distance bounds, empty/unicode/case-insensitivity edge cases |
| `src/server/catalog/__tests__/catalog.service.test.ts` | 2 tests | End-to-end ranking via live DB: name-match-beats-description-match, and the internal-letter-typo regression |

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Investigate the pre-existing `next lint`/`eslint` breakage separately (unrelated to this feature)
- [ ] Create PR via `/prp-pr`
