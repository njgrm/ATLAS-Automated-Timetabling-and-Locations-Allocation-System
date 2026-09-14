# TT-SOURCE-FRESHNESS-C04 — Governing One-Shot Packet (S4)

- Stream: `TT-SOURCE-FRESHNESS-C04` (contract §7 stream S4)
- Risk: `MEDIUM` source/authority; deployment, generation, and publication remain
  separately gated `HIGH` actions and are NOT part of this packet.
- Directive pin: LF-normalized `AGENTS.md` SHA-256
  `CFA7BFABF3B05A9FEDC2FC98B632A3A6A3823C5E7E68E0F10D92594D8AB1E7E4` (verified
  by the planner on the worktree copy).
- Worktree: `D:\ATLAS-worktrees\tt-source-freshness-c04`
- Branch: `work/tt-source-freshness-c04`
- Base: `be1a2d6f` (freshly fetched `origin/main`; descendant of the handoff SHA
  `29284ac6`, docs-only delta: term-cache capture integration).
- Governing references (read in this order):
  1. `docs/reference/timetable-dynamic-workspace-and-warning-contract.md`
     (§3 freshness table, §7 successor registry, ordered-term invariants)
  2. `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md`
     (findings B-03, B-04, B-06, B-09, B-11, B-13)
  3. `docs/reviews/tt-c04-authority-wave-20260913/wave-completion-audit.md`
     (F1, F2, F3, F4)
  4. `docs/reviews/tt-tl-modules-c04r1-recovery-20260914/wave-completion-audit.md`
     (F-D Serializable assertion note) and `...-r2.md`
  5. `docs/plans/atlas-active-delivery-streams.md` (TT-SOURCE-FRESHNESS-C04 row)

## 0. Planner preflight (facts verified at `be1a2d6f`)

- Dependencies satisfied: S2 `d9b1cd4a` (TT-WARNING-AUTHORITY-C04) and S3
  `7b31c592` (TT-TL-AUTHORITY-GUARD-C04) are contained in `origin/main`; the
  C04R1 correction (`e7916315`/`b7c4d386`/merge `eb60d78b`) is integrated.
  `TT-SYNC-TERM-C03R5` (`5163a335`, merge `bbd6b0df`) is the binding pattern to
  REUSE, not duplicate.
- Exact anchors (verified by the planner at this base):
  - `generation.service.ts:583-612` read-only preflight + `revalidateGenerationPreflight`;
    `:615-629` QUEUED/RUNNING reservation writes; `:688-709` assembly → scheduler →
    per-term resolution; `:821` post-scheduling `computeGenerationInputSnapshot`
    via the GLOBAL client; `:854` snapshot attached to summary; `:863-874`
    COMPLETED persist; `:897-916` success notification; `:919-964` FAILED
    lifecycle (existing contract).
  - `generation-input-snapshot.service.ts:152-156`
    `computeGenerationInputSnapshot(schoolId, schoolYearId, client = getDataContext())`;
    `:359-378` `compareCurrentInputsForRun`.
  - `generation-preflight.service.ts:566-612` `buildGenerationPreflight` /
    `buildGenerationPreflightWithContext`; `:1093-1113` `revalidateGenerationPreflight`;
    `:1115` `buildPreflightConstructorInput`; `buildPreflightValidatorContext`.
    NOTE: the packet list in the operator brief named
    `generation-input-assembly.service.ts`; that file does not exist at base —
    the shared assembly lives in `generation-preflight.service.ts`. Do not
    create a new assembly module.
  - `timetable-quick-place.service.ts:443-452` run lookup (by id only) +
    `isPublishedSummary` strict gate + version CAS; `:455` `solveQuickPlace`;
    `:488-539` recalculated diagnostics on global reads; `:539` post-computation
    `computeGenerationInputSnapshot` (global client); `:552` attach; `:556`
    `commitManualEditBatch(..., summaryOverrides)`.
  - `timetable-quick-place.router.ts:38-75` mounted preview/apply; privilege gate
    only — NO actor-school/year equality check today. QA tally row 9 requires
    this authority on the mounted path.
  - `timetable-sync-setup.service.ts:36-55` binding doctrine; `:574` read
    snapshot via read transaction client; `:689-731` final Serializable write
    transaction recomputation + `SOURCE_AUTHORITY_STALE` at `:692/:711/:728`;
    `:750` persist. REUSE this pattern.
  - `manual-edit.service.ts:236` `loadRunContext` → `getOrCreatePolicy` hidden
    write (B-09); `:696-724` `mergePreservedSummaryFields` (F3: preserve list
    lacks `blockingHardViolationCount`, run-wide counts, term counts, freshness,
    generation diagnostics).
  - `scheduling-policy.service.ts:147-162` `PROMOTABLE_CONSTRAINT_CODES`;
    `:840-876` `getOrCreatePolicy` (hidden write source).
  - `faculty-assignment.service.ts:3711-3802` `applyCapabilityOverride`
    (Serializable at `:3799`, tx revision + fingerprint revalidation, conflict
    `:3802`); `:3391` `upsertTeachingLoadCapabilityOverride` and `:3434`
    `deleteTeachingLoadCapabilityOverride` have ZERO consumers at base (retired
    PUT/DELETE return typed 410 at `faculty-assignment.router.ts:843-855`).
  - `simplePublishReadiness.ts:62-68` repair map (`/campus-rooms` at `:66-67`
    for `NO_COMPATIBLE_ROOM` / `ROOM_CAPACITY_EXCEEDED`); `:116-131`
    `PUBLICATION_BLOCKING_CODES` (11 codes) consumed by
    `isBlockingHardViolation` / `isInformationalHardViolation`.
  - Client strict-predicate/parity suites already exist:
    `atlas-client/src/lib/__tests__/timetable-warning-authority-contract.test.ts`,
    `timetable-operator-workflow-state.test.ts` (imports
    `deriveSimplePublishReadiness`); `SimplePublishReadinessSheet.tsx:10,27,142-144`
    is the real render consumer that receives `onNavigateToRepair`.
  - `generation.service.ts:93-98` loose helper: residual only. Change it ONLY
    if a real mutation/publication call path is proven to consume it; otherwise
    report it as a bounded residual (registered in the C04 wave audit F4).

## 1. Objective

Ensure generation, Quick Place, and Timetable setup synchronization never save
outputs computed from stale or inconsistent source authority. Preserve complete
run-wide publication summary truth and make setup-sync teacher-pin behavior
truthful for manually reviewed assignments. Close ONLY the registered S4
findings; do not broaden this into another Timetable UI redesign.

## 2. Standing boundaries (hard)

ALLOWED to touch (product/test paths, smallest necessary scope):

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/generation-input-snapshot.service.ts`
- `atlas-server/src/services/generation-preflight.service.ts` (assembly/binding only)
- `atlas-server/src/services/timetable-quick-place.service.ts`
- `atlas-server/src/services/timetable-sync-setup.service.ts`
- `atlas-server/src/services/manual-edit.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts` (only if a passive
  read mode is required to remove the hidden write)
- `atlas-server/src/services/faculty-assignment.service.ts` (test-only
  production assertion or the smallest necessary correction; §10/§11)
- `atlas-server/src/routes/timetable-quick-place.router.ts` (only the smallest
  fail-closed actor-school/year authority correction required by tally row 9)
- `atlas-client/src/components/timetable/simplePublishReadiness.ts`
- Focused server/client tests (new suites + minimal edits to existing suites)
- ONE progress ledger: `docs/progress/tt-source-freshness-c04-progress.md`

FORBIDDEN (do not edit, do not reformat, do not "fix while here"):

- Teaching Load suggestion/apply/carry-forward/department authority services
  (`teaching-load-suggestion-proposal.service.ts`,
  `teaching-load-reconciliation.service.ts`,
  `teaching-load-carry-forward.service.ts`, `teaching-load-automation.service.ts`,
  `department-authority.service.ts`) and `timetable-teaching-load-repair.service.ts`
- Publication services (`publication-contract.service.ts`,
  `published-revision.service.ts`)
- Prisma schema and migrations (`prisma/**`)
- Dashboard, authentication/authorization middleware
- Runtime supervisor (`ops/**`), EnrollPro proxy/env configuration
- Companion repositories (read-only mirrors)
- `CHANGELOG.md`, `docs/plans/atlas-active-delivery-streams.md`, and
  `docs/reference/atlas-runtime-source-of-truth-map.md` (planner/integration
  owner consolidates; include a proposed one-line delta in the handoff if
  documented behavior changed)
- Live ATLAS database, live data, any login, any browser/Playwright use
- `constraint-validator.ts` and the S2/S3-owned warning/TL-repair files: read-only
  reference. If you find a defect there, REPORT it in the handoff; do not fix it.

## 3. Required production corrections

### 3.1 Generation source-snapshot binding — B-03

- Establish ONE canonical source snapshot/fingerprint before scheduling. The
  preflight assembly (`buildGenerationPreflight`) already resolves the consumed
  authority: derived demand, ordered-term contract, ownership, rooms, policies,
  shifts, periods, sections, subjects, retained drafts. Bind that captured
  assembly to the scheduling computation.
- Do NOT compute a fresh post-scheduling snapshot with the global client and
  attach it to output built from older inputs (`generation.service.ts:821` is
  the defect).
- Before persisting a successful result, recompute the COMPLETE fingerprint
  inside the final Serializable write transaction (transaction client only; no
  global Prisma, no network). Compare it with the captured source fingerprint.
- If it differs, reject with typed `SOURCE_AUTHORITY_STALE` (409 with code and a
  truthful action hint). The stale computation must never become the
  completed/current run and must not emit a success notification.
- Preserve the existing GenerationRun lifecycle honestly: the trigger already
  creates QUEUED→RUNNING before scheduling; a stale rejection may be recorded as
  FAILED only under that existing lifecycle contract (no completed timetable,
  no success audit, no success notification). The route must surface the typed
  stale error; do not silently convert it into a generic failure.
- Persisted `inputSnapshot` must equal the source truth used for computation.
  Canonical per-term session totals must not change; no missing term may become
  Term 1 (ordered-term invariants).

### 3.2 Quick Place freshness — B-04

- Bind solver output and ALL recalculated diagnostics to one captured source
  snapshot (rooms, policies, subjects, ownership, ordered-term authority,
  shifts, periods, sections, derived demand, and every other consumed input).
- Recompute the complete fingerprint with the TRANSACTION client before
  committing proposals.
- If any covered input changed, return typed `SOURCE_AUTHORITY_STALE`.
- On rejection: zero timetable-entry changes, zero run-version increment, zero
  manual-edit history, zero success audit, zero notification.
- Do not replace the run's snapshot with a later unrelated snapshot merely
  because Quick Place changed entries: the persisted snapshot must be the
  tx-verified snapshot that produced the committed entries.
- Keep the existing strict publication gate (`isPublishedSummary` at `:447`)
  and the version CAS. Do not revive `publishedAt`/`publishedBy` marker
  authority.

### 3.3 Sync setup verification and remaining corrections — B-04/B-09

`TT-SYNC-TERM-C03R5` protections already exist in
`timetable-sync-setup.service.ts`. Inspect, verify, and REUSE; do not duplicate
or weaken them:

- computation reads use ONE Serializable read snapshot;
- the final write transaction revalidates the full fingerprint;
- stale inputs return `SOURCE_AUTHORITY_STALE`;
- no global Prisma or network read escapes the bound path;
- replay/no-change remains idempotent (zero writes);
- version CAS and actor-school/year authority remain intact.

Close the remaining hidden-write behavior in the declared read snapshot:

- passive snapshot construction (`loadRunContext` → `getOrCreatePolicy`,
  `manual-edit.service.ts:236`; `scheduling-policy.service.ts:840-876`) must NOT
  create or normalize a scheduling-policy row;
- a missing persisted policy may resolve to in-memory defaults for the READ,
  but persistence requires a separately authorized write path;
- source inspection alone is insufficient — INSTRUMENT model writes (count
  policy create/update calls) in the test.

### 3.4 Ordered-term authority freshness — B-06 server

- The snapshot must bind the exact persisted, verified ordered-term semantic
  revision consumed by derived demand and scheduling.
- Term identity and ordering must be part of the fingerprint.
- A changed, missing, stale, inactive, duplicated, or malformed ordered-term
  contract must fail closed.
- Do NOT fetch EnrollPro over the network inside a write transaction.
- Do NOT create a second term-authority model; consume the existing persisted
  term contract authority.

### 3.5 Teacher-pin behavior during setup sync — B-13/D5

Adopt this bounded product decision (D5 resolved as follows):

- PRESERVE an existing manually reviewed teacher assignment when it remains
  valid under current ownership, qualification, availability already consumed
  by current authority, section, and term constraints.
- If it is no longer valid, do NOT silently replace it with a live owner.
  Surface it as an explicit typed sync conflict requiring operator review.
- Preserve valid slot swaps and manual placements.
- The response and client copy must state exact retained and conflicted totals.
- Do NOT implement new faculty-availability authority; D1 remains separate.

### 3.6 Run-wide summary preservation — audit F3

Every post-generation summary merge — manual edit, Quick Place, setup sync,
repair, and replay/no-change paths — must preserve authoritative fields the
operation does not recompute, especially:

- `blockingHardViolationCount`
- run-wide violation counts (`violationCounts`, `hardViolationCount`)
- term-aware counts (`termCounts`)
- `inputSnapshot`
- publication markers (`isPublished`, `publishedAt`, `publishedBy`,
  `publicationIntegrity`, `publishedSoftViolationCount`,
  `softViolationsAcknowledged`)
- freshness state
- generation diagnostics (`resourceDiagnostics`, `timetableDisplaySlots`,
  `timetableShapeContracts`, etc.)

A partial summary object must never erase these fields. Operations that DO
recompute a field (Quick Place/sync recompute `inputSnapshot` and diagnostics)
must persist their tx-verified value. Preserve strict `summary.isPublished ===
true` authority.

### 3.7 Strict publication predicate verification — B-11 remainder

- Verify through production-path tests that Quick Place and setup sync gate on
  the strict predicate (`isPublishedSummary` / canonical
  `summary.isPublished === true`) and do not revive `publishedAt`/`publishedBy`
  marker authority.
- Do not introduce another predicate.
- The loose helper in `generation.service.ts:93-98` is NOT automatically in
  scope: change it only if a real mutation/publication call path is proven to
  consume it; otherwise record it as a bounded residual in the handoff.

### 3.8 Targeted client correction — audit F1

- In `atlas-client/src/components/timetable/simplePublishReadiness.ts`, change
  the stale repair destinations at `:66-67` from the unmounted `/campus-rooms`
  to the mounted `/map` route.
- Add route-resolution coverage for the real render consumer
  (`SimplePublishReadinessSheet` → `onNavigateToRepair`), asserting the
  resolved href is a mounted route (not only a string equality).

### 3.9 Promotion allowlist parity — audit F2

- Add a deterministic contract test proving the client publication-blocking
  code set matches the server promotable-constraint set
  (`PUBLICATION_BLOCKING_CODES` vs `PROMOTABLE_CONSTRAINT_CODES`).
- Prefer exercising the REAL client consumer functions
  (`isBlockingHardViolation`/`isInformationalHardViolation`) so the test fails
  on drift in behavior, not only in a mirrored list.
- Avoid introducing a second manually maintained authority if the existing
  server-owned contract can be consumed safely; document the chosen mechanism
  in the handoff.

### 3.10 Capability-override transaction assertion

The production apply already passes `{ isolationLevel: 'Serializable' }`
(`faculty-assignment.service.ts:3799`). Add an executable regression control
that OBSERVES this exact transaction option on both:

- a successful apply;
- a stale-source/fingerprint rejection.

The test must fail if Serializable isolation is removed (load-bearing mutant).
It is not sufficient to re-read the service source text.

### 3.11 Legacy/dead-export inventory

Inventory the capability-override and retired reconciliation exports referenced
by the C04R1 residual (see `docs/reviews/tt-tl-modules-c04r1-recovery-20260914/`).
Planner-identified candidates at base (re-verify mechanically):

- `upsertTeachingLoadCapabilityOverride` (`faculty-assignment.service.ts:3391`)
- `deleteTeachingLoadCapabilityOverride` (`:3434`)
- their parameter interfaces (`TeachingLoadCapabilityOverrideMutationInput`,
  `TeachingLoadCapabilityOverrideDeleteInput`) and any internal helper used only
  by those two functions.

Rules:

- Remove ONLY symbols proven to have zero production, route, client, and test
  consumers (search routes, clients, tests, and dynamic imports).
- Preserve typed retired-route responses that remain part of the HTTP contract
  (the PUT/DELETE 410 handlers in `faculty-assignment.router.ts`).
- Do not turn cleanup into an API redesign.
- Report retained symbols with their real consumer or compatibility reason.

## 4. Required failing-first controls

### A. Generation interleave controls

Use the real trigger/assembly/scheduler/persistence path. Introduce
deterministic interleaves AFTER output computation but BEFORE final persistence:

1. room authority change;
2. scheduling policy change;
3. subject/derived-demand authority change;
4. ownership change;
5. ordered-term semantic revision change.

Each must prove the stale output cannot become a successful completed run
(no COMPLETED timetable, no success audit, no success notification; typed
`SOURCE_AUTHORITY_STALE` surfaced; FAILED lifecycle only if that is the
existing contract).

Positive unchanged-source control must prove:

- the run completes;
- persisted `inputSnapshot` equals the source truth used for computation;
- canonical per-term session totals remain unchanged;
- no missing term becomes Term 1.

### B. Quick Place interleave controls

Use the mounted/production Quick Place path (router → service → commit) and
mutate at least:

- room or policy authority;
- teacher ownership;
- ordered-term authority.

Assert typed stale rejection and zero schedule/version/history/audit/notification
writes. Include one positive successful Quick Place case. Include the mounted
actor-school/year/version authority matrix (missing JWT, missing actor school,
cross-school, malformed scope, archived year, version conflict — each with zero
downstream dispatch/writes).

### C. Sync controls

Rerun the complete C03R4/C03R5 sync suite and add or retain controls proving:

- no hidden policy write during snapshot reads (instrumented model writes);
- valid teacher pin retained;
- invalid teacher pin reported (typed conflict with exact totals) rather than
  silently rebound;
- valid swaps/manual placements preserved;
- stale source and stale run version remain DISTINCT typed failures;
- replay remains zero-write.

### D. Summary conservation controls

Begin with a summary containing nonzero:

- `blockingHardViolationCount`;
- run-wide blocking and informational counts;
- term counts;
- `inputSnapshot`;
- publication/freshness fields.

Exercise manual edit, Quick Place, sync, and replay/no-change. Assert untouched
authoritative fields remain byte/semantic equivalent after each merge; assert
recomputed fields equal their tx-verified values.

### E. Required load-bearing mutants (each must fail its intended test; restore byte-for-byte)

1. restore the former post-scheduling snapshot replacement;
2. remove the final fingerprint comparison;
3. route one covered read through global Prisma;
4. allow passive policy creation;
5. silently rebind an invalid teacher pin;
6. drop `blockingHardViolationCount` during a summary merge;
7. remove `Serializable` from capability-override apply;
8. restore `/campus-rooms`.

Record the mutant diff, the failing test, and the byte-exact restoration proof
in the progress ledger.

## 5. Required QA tally (QA grades all 14; `ACCEPT_READY` needs 14/14/0/0)

1. generation snapshot bound to computation source;
2. generation interleave fail-closed;
3. Quick Place interleave fail-closed and zero-write;
4. sync snapshot/global-read/hidden-write integrity;
5. ordered-term semantic revision freshness;
6. valid/invalid teacher-pin behavior;
7. summary-field conservation;
8. strict publication predicate parity;
9. mounted actor-school/year/version authority;
10. client `/map` repair-link resolution;
11. server/client publication-blocking allowlist parity;
12. capability-override Serializable assertion;
13. legacy/dead-export inventory correctness;
14. regression suite/build/ESM startup/diff hygiene.

## 6. Verification gates (shortest decisive commands)

Run from the worktree root; server commands from `atlas-server/`, client from
`atlas-client/`.

Server (each must exit 0; disposable-DB suites print their own tallies):

- `npx tsx src/__tests__/<new tt-source-freshness suites>.test.ts`
- `npx tsx src/__tests__/generation-production-trigger-genc02r1.test.ts`
- `npx tsx src/__tests__/generation-canonical-readiness-genc02.test.ts`
- `npx tsx src/__tests__/derived-demand-authority.test.ts`
- `npx tsx src/__tests__/derived-demand-correction-c01r2.test.ts`
- `npx tsx src/__tests__/tt-output-c03r3.test.ts`
- `npx tsx src/__tests__/tt-output-c03r3-placement-term.test.ts`
- `npx tsx src/__tests__/timetable-sync-setup.test.ts`
- `npx tsx src/__tests__/timetable-candidate-domain.test.ts`
- `npx tsx src/__tests__/publication-contract-readiness.test.ts`
- `npx tsx src/__tests__/capability-override-mount.test.ts`
- `npx tsx src/__tests__/timetable-warning-authority-c04.test.ts`
- `npx tsc --noEmit`
- `npm run build` + built-server import/startup probe with ESM-safe `.js`
  imports (server `<sourceDir>/dist/server.js` boots; `/api/v1/health` 200).

Client:

- `npx tsx --test src/lib/__tests__/<new client suites>.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-operator-workflow-state.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-dynamic-workspace-drift.test.ts`
- `npx tsx --test src/lib/__tests__/uxc01r-generation-readiness.test.ts`
- `npx tsc --noEmit`
- `npm run build`

Repository:

- `git diff --check` (clean)
- worktree `git status --short` (empty at handoff)

Disposable PostgreSQL rules: isolated fixtures only; provision through the
repo's guarded pattern (`atlas_restore_drill_YYYYMMDD_<suffix>`, generated from
`DATABASE_URL` server, `npx prisma migrate deploy --schema=../prisma/schema.prisma`,
drop `WITH (FORCE)` in `finally`, zero-residue assertion). Never target the
configured database, never touch live rows, never run reset-style commands.
Host note: D: carried only ~95 MB free at cycle start (operator restored ~7 GB
before checkout). Do not leave fixtures, dumps, or build artifacts behind.

Browser QA is NOT required and is NOT authorized: do not use the persistent
Playwright profile, do not log in, do not navigate the live environment. The
term-cache stream owns live browser custody.

## 7. Commit and handoff contract

- Build the compact trace table BEFORE editing:
  `requirement -> production path -> negative control -> verification command`,
  marked PASS/BLOCKED/DEFERRED before the commit. A row without production-path
  evidence cannot be PASS.
- One or more additive commits on `work/tt-source-freshness-c04`; suggested:
  `fix(timetable): bind generated and repaired output to source authority`.
  Do not amend after handoff, do not rebase, do not push, do not merge.
- Update `docs/progress/tt-source-freshness-c04-progress.md` with status,
  decisions, changed paths, tests, mutants, and remaining risks.
- Return exactly `REVIEW_REQUIRED` with:
  - base SHA, candidate SHA, worktree/branch, clean-status evidence;
  - exact changed paths;
  - the trace table and mandatory matrix tallies (A–E, mutants, DB names +
    zero-residue proof, production-shape parity row);
  - known risks classified `BLOCKING`/`NON_BLOCKING` with reasons;
  - proposed runtime-map/CHANGELOG delta if behavior documentation changed;
  - explicit confirmation that no deployment, login, live-data mutation,
  generation, publication, migration, schema, or companion action occurred.

## 8. Outcome definitions

- All mandatory rows PASS with production-path evidence: candidate is ready for
  independent QA.
- Any required row BLOCKED/DEFERRED: report the exact blocker; do not claim
  completion. Live/external blockers do not stop hermetic source work.
