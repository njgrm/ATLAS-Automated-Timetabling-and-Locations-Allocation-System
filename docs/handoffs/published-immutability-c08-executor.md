# PUBLISHED-IMMUTABILITY-C08 — Executor Progress Ledger

- Stream: `PUBLISHED-IMMUTABILITY-C08` (source-only, MEDIUM)
- Worktree: `E:/ATLAS-worktrees/published-immutability-c08`
- Branch: `work/published-immutability-c08`
- Base SHA: `47e062a32f04266acaf84ebf8662d6d397566fcd`
- Governing packet: `docs/prompts/published-immutability-c08-2026-09-16.md`
- Status: `REVIEW_REQUIRED`

## Objective

Make one published revision a historically reproducible artifact: after
publication, later changes to subject, faculty, room, building, section,
specialization, cohort, policy, special-event, term-authority, active-year, or
signatory records must not alter that revision's rendered public, authenticated,
archived, or exported truth.

## Design

- Frozen snapshot stored in the base `PublishedScheduleRevision.metadata` JSON at
  key `publishedIdentitySnapshot`. **No migration, no new column/model/enum.**
- Built from a preflight read **inside the existing Serializable publication
  transaction**, after the existing freshness comparison. A covered-input change
  fails closed via `PUBLICATION_INPUTS_STALE` before anything is written.
- Frozen `displaySlots` / `specialEvents` are validated for mutual consistency at
  publish time (`PUBLICATION_SNAPSHOT_INCONSISTENT`, zero writes).
- Published payloads carry `snapshotState: 'FROZEN' | 'LEGACY_LIVE_PROJECTION'`
  plus a typed `snapshotGaps` list. Legacy publications are never reported as
  immutably reproduced.
- Frozen-first resolution on every published read and every official export.
  Archived/published term resolution uses the frozen `orderedTermContract`, never
  the live active-year mirror cache.

## Changed paths (candidate)

Product source:

- `atlas-server/src/services/published-identity-snapshot.service.ts` (new)
- `atlas-server/src/services/publication-contract.service.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/academic-term.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/class-program-slot.service.ts`
- `atlas-server/src/services/workbook-export.service.ts`
- `atlas-server/src/services/room-program-export.service.ts`
- `atlas-server/src/services/class-program-matrix.service.ts`
- `atlas-server/src/services/teacher-program-export.service.ts`
- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/routes/generation.router.ts`

Tests:

- `atlas-server/src/__tests__/published-immutability-c08.test.ts` (new)

Ledger:

- `docs/handoffs/published-immutability-c08-executor.md` (this file)

## Preserved strengths

Run-wide zero-hard-blocker gate; actor-school authorization; `Serializable`
transaction + `pg_advisory_xact_lock` + run-version CAS; replay idempotency;
exactly one publication audit and one notification; draft/published separation;
revision effective-date overlay; frozen signatory revision; no public
draft/policy/internal-run leakage.

## Known residuals

- School name and school-year label are not part of the frozen snapshot contract
  (§4.3 enumerates the frozen fields and excludes them); they remain live-sourced.
- Teacher-profile presentation fields (`plantillaPosition`, `designationTitle`,
  degrees, `avatarUrl`) are outside the §3.2 snapshot contract and remain
  live-sourced; the published teacher **display name** and **employee id** are
  frozen.
- Class-program canonical template rows and adviser bindings are frozen as a
  documented extension beyond §3.2 so §4.8 holds for those outputs.

## Evidence

- `npm run build` (atlas-server `tsc`): clean.
- `npx tsx src/__tests__/published-immutability-c08.test.ts`: `passed=103 failed=0`.
