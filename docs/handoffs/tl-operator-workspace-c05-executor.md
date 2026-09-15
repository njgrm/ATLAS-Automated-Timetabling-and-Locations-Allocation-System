# TL-OPERATOR-WORKSPACE-C05 — Executor Handoff

**Role:** EXECUTOR · **Risk tier:** MEDIUM source-only · **Verdict:** `REVIEW_REQUIRED`

| Field | Value |
|---|---|
| Accepted base SHA | `0c20342394ca2ca800cecc6dd69825e07625c66d` (= refreshed `origin/main`; verified ancestor) |
| Product/test candidate | `51800840b5655e2b49f88017582e36b25896f6cb` |
| Frozen tip (incl. this handoff) | see the final tip recorded in the return message |
| Branch | `work/tl-operator-workspace-c05` |
| Worktree | `E:/ATLAS-worktrees/tl-operator-workspace-c05` |
| Range | `0c203423..51800840`, 11 commits total (9 product/test + 2 handoff docs), 26 paths, +2740 / −595 |
| Directive pin | LF-normalized `origin/main:AGENTS.md` SHA-256 `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5` (recomputed from `D:/ATLAS/AGENTS.md`; matched) |
| Worktree disposition | `RETIRE_AFTER_INTEGRATION` (not retired here) |

## Commit list

| # | SHA | Message |
|---|---|---|
| 1 | `3c8646b5` | fix(teaching-load): make the TL operator workspace correct and comprehensible |
| 2 | `b64ec7cb` | fix(teaching-load): remove the duplicate advanced-grid reveal control |
| 3 | `d0fd7e92` | fix(teaching-load): discard suggestion replies from an obsolete scope |
| 4 | `e6b91211` | docs(teaching-load): add TL-OPERATOR-WORKSPACE-C05 executor handoff |
| 5 | `ed5736ea` | feat(teaching-load): surface canonical derived-demand truth (R3) |
| 6 | `66bfcc34` | fix(teaching-load): restrict the eligibility widening to blank departments |
| 7 | `a588b416` | docs(teaching-load): record R3, server tally, and blast radius in the C05 handoff |
| 8 | `61b58b6d` | fix(teaching-load): unit-coherent capacity and excess metrics (correction C-2) |
| 9 | `51800840` | fix(teaching-load): close the producer/consumer rejection-reason gap (correction C-3: F1 + F2) |

## Dependency approach

Isolated `npm ci` per workspace after verifying committed lockfiles
(`atlas-client` `CE1AE84E…`, `atlas-server` `ECF06AEF…`); no junction/shared
tree. `npx prisma generate --schema ../prisma/schema.prisma` was required before
the server type-check (writes only `node_modules/.prisma/client`). `E:` free at
start 73.41 GiB (floor 15 GiB).

## Correction C-3 — producer/consumer rejection-reason parity (F1) and diagnostics supersession (F2)

### F1 — producer inventory (verified)

Exactly one producer contract for `TeachingLoadCandidateRejection.reason`:

| Producer location | Emits |
|---|---|
| `teaching-load-automation.service.ts:166-173` | the union type — the authority |
| `teaching-load-automation.service.ts:1464`, `:3313` | `PROGRAM_SCOPE_INCOMPATIBLE` / `NOT_QUALIFIED` |
| `teaching-load-automation.service.ts:1481`, `:3335` | `HARD_CAP_EXCEEDED` |
| `teaching-load-automation.service.ts:3281` | `CURRENT_OWNER` |
| `teaching-load-automation.service.ts:3293` | `PLACEHOLDER_FACULTY` |
| `teaching-load-automation.service.ts:3397` | `OUTSIDE_CANONICAL_DEMAND` |

`qualification-evaluator.service.ts` and `teaching-load-reconciliation.service.ts`
carry *different* contracts (`ADVISER_*`, qualification outcomes); the automation
service maps qualification outcomes into this union at 1464/3313. **Full emitted
set: the 6 union members.** No other file emits this contract, and no server fix
was required — the correction is client-side.

**Defect (confirmed):** the client union/labels/details/order omitted
`OUTSIDE_CANONICAL_DEMAND`, and `summarizeCandidateRejections` iterated only
`CANDIDATE_REJECTION_ORDER`, so that reason was silently dropped from the grouped
body while the header still counted it.

**Fix:** reason added to the client union, labels, details, and order with terse
scheduler-facing copy; the operator-mandated R5 vocabulary
(`INACTIVE_FACULTY`, `WRONG_SCHOOL`, `DEPARTMENT_RESTRICTED`, `UNAVAILABLE`,
`STALE_AUTHORITY`) is retained as explicitly *reserved/defensive* copy, no longer
presented as the producer set; and the unknown path is now live — unmatched
reasons group under `UNKNOWN_REASON` with safe copy, preserving
`sum(group.count) === totalCandidateRejections(list)`.

The diagnostics body was extracted into `TeachingLoadCandidateDiagnostics.tsx`
so the grouping is directly renderable/assertable (the modal renders through a
Radix portal and is not server-renderable).

### F2 — diagnostics supersession guard

`useTeachingLoadData.ts` now captures a scope epoch token before dispatching the
read-only `/faculty-assignments/authority-diagnostics` GET and discards any reply
that lands after a school/year change; the scope effect opens a new epoch before
clearing the state it owns. The suggestion handlers already used the same
`scope-request-epoch` primitive.

**Disclosed residual (out of this correction's bound):** the pre-existing
summary/subjects/sections setters in the same hook are NOT epoch-guarded. They
are overwritten by the next fetch and were not reworked here.

### C-3 failing-first mutants (performed, restored byte-exact)

| Mutant | Mutation | Baseline blob | Mutant blob | Result | Restore |
|---|---|---|---|---|---|
| F1-M1 | remove `OUTSIDE_CANONICAL_DEMAND` from the client map (labels/details/order) | `1a775fb0cf9e71547ca3728f472c66d4c127f133` | `0dcf66349bb97b5af72c6965e60c857b808f1e33` | 32 tests, **29 pass / 3 fail** — producer parity ("missing from the client union"), rendered count equality, grouped-summary | byte-exact |
| F2-M1 | remove the diagnostics scope guard | `e3298b87ce03689a42f552367a2b4b231e8f83e6` | `e5d63b5fad27fde7114921ac3d42df88b1aca908` | 32 tests, **31 pass / 1 fail** — "the success path must discard an obsolete reply" | byte-exact |

Both restores verified by blob equality and `git diff --quiet` exit 0.

## Exact changed paths (26)

```
M  atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx
M  atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
M  atlas-client/src/components/faculty-assignments/TeachingLoadModals.tsx
D  atlas-client/src/components/faculty-assignments/TeachingLoadReconciliationPanel.tsx
A  atlas-client/src/components/faculty-assignments/TeachingLoadCandidateDiagnostics.tsx   <- C-3
M  atlas-client/src/components/faculty-assignments/TeachingLoadRepairQueue.tsx
A  atlas-client/src/components/faculty-assignments/TeachingLoadTruthPanel.tsx
M  atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx
M  atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
M  atlas-client/src/hooks/useTeachingLoadData.ts
M  atlas-client/src/hooks/useTeachingLoadUI.ts
M  atlas-client/src/lib/__tests__/teaching-load-distribution-ui.test.ts
A  atlas-client/src/lib/__tests__/tl-operator-workspace-c05-blast-radius.test.ts
A  atlas-client/src/lib/__tests__/tl-operator-workspace-c05-r3-truth.test.ts
A  atlas-client/src/lib/__tests__/tl-operator-workspace-c05.test.ts
M  atlas-client/src/lib/faculty-assignment-helpers.ts
A  atlas-client/src/lib/scope-request-epoch.ts
A  atlas-client/src/lib/teaching-load-authority-truth.ts
M  atlas-client/src/lib/teaching-load-suggestion-diagnostics.ts
A  atlas-client/src/lib/teaching-load-suggestion-presentation.ts
M  atlas-client/src/pages/TeachingLoad.tsx
M  atlas-client/src/types.ts
A  atlas-server/src/__tests__/teaching-load-overload-capacity-totals.test.ts   <- C-2
M  atlas-server/src/services/teaching-load-reconciliation.service.ts           <- C-2 (read-path only)
A  docs/handoffs/tl-operator-workspace-c05-executor.md
```

Two server paths changed, both for correction C-2 and both **read-path/test only**:
a pure exported helper plus its hermetic test. No write behaviour, route,
migration, schema, or persistence change. No `package.json`, lockfile,
`CHANGELOG.md`, `docs/plans/**`, `docs/reference/**`, register, receipt, `ui/**`,
`lib/api.ts`, `app-shell/**`, `runtime/**`, `timetable/**` (audit-only, unedited),
`faculty-dashboard/**`, export surface, or ops file was touched.

## Control inventory and dispositions

### `pages/TeachingLoad.tsx` (847 physical lines, cap 1000)

| Control | Location | Handler / API | Disposition |
|---|---|---|---|
| Full-page "Retry Connection" | ~568 | `data.fetchData()` → GET summary | **KEEP** — early-return branch; the toolbar is not mounted there, so it is not a duplicate retry path |
| Mobile "View profile" | ~830 | `setMobileInspectorOpen(true)` | KEEP |
| Mobile inspector `Sheet` | ~838 | same | KEEP |
| Route-intent applier | 86 | `useTeachingLoadRouteIntent` | KEEP |
| Scope-reset effect | ~100 | `scopeEpochRef.begin()` + reset + clear suggestion state | **EXTENDED (R9)** |

### `WorkspaceToolbar.tsx`

| Control | Location | Handler / API | Disposition |
|---|---|---|---|
| Source-state `Badge` + tooltip | 167–180 | none (status) | KEEP — non-interactive badge |
| `SmartHelpTrigger` "Help" | ~184 | opens help | KEEP |
| Primary action button | 213–223 | `onAutoFillClick` (POST `suggestion-proposals`, zero-write preview) / `onRetrySource` (GET summary) | KEEP |
| "More Teaching Load tools" dropdown | ~234 | opens menu | KEEP |
| Coverage-mode radio group | ~240 | `onCoverageModeChange` | KEEP |
| Tabs Teachers / Sections | 258–262 | `onViewModeChange` | KEEP; **REMOVED** dead `'subjects'` literal from the cast |
| `% staffed` chip | ~270 | none | KEEP — non-interactive `div` |
| Unassigned pairs chip | ~280 | none | KEEP — non-interactive `div` |
| Alert chip "Above weekly max" | 123–133 | `onShowExcessTeachingLoad` | KEEP — distinct policy threshold |
| Alert chip "Excess teaching load" | 134–144 | `onShowExcessTeachingLoad` | KEEP — distinct threshold; never both at once (weekly-max wins vs excess) |
| Alert chip "Temporary substitutes" | 145–155 | `onShowTemporarySubstitutes` (new) | **FIXED** — was `onClick: undefined` on a live `<Button>` |

### Modals / grids

| Control | Disposition |
|---|---|
| Suggestion confirm `ConfirmationModal` | **REMOVED** — unreachable (its open flag was never set true anywhere) |
| `AutoFillSummaryModal`, save-warning confirm, discard confirm | KEEP |
| Shortage accordion, Close, Apply suggestion | KEEP |
| Section row (`role=button`), owner-picker trigger, owner option, search, mode `Select` | KEEP |
| Owner-option "Verify dept" affordance | **NEW** — marks `unknown` authority without hiding the candidate |
| `onReviewManually`, `WorkloadInspector.onClose` | **REMOVED** (dead) |
| `SectionGridMode` dead props `savedOwnershipMap`, `pendingOwnershipMap`, `onSelectTeacher`, `onHoverTeacher`, `onClearHover`, `onSave`, `hasDraft` | **REMOVED** |
| `TeachingLoadRepairQueue` "Browse all" + `onToggleAdvancedGrid` | **REMOVED** — duplicate target AND duplicate `data-testid` |
| `TeachingLoadReconciliationPanel.tsx` | **DELETED** — proven zero importers |

### Removed-control evidence

No remaining reference to `autoFillDialogOpen`, `setAutoFillDialogOpen`,
`onReviewManually`, `WorkloadInspector`'s `onClose`, `onToggleAdvancedGrid`, or
`Browse all`. `teaching-load-advanced-grid-toggle` is declared by exactly one
file (`TeachingLoadGuidedModePlaceholder.tsx`), asserted by a single-ownership
test. `TeachingLoadReconciliationPanel.tsx` no longer exists (file-absence test).

## R3 — canonical derived-demand truth

**Authority: read-only `GET /faculty-assignments/authority-diagnostics`**
(router `faculty-assignment.router.ts:373`, payload
`TeachingLoadAuthorityDiagnostics` in `teaching-load-reconciliation.service.ts:322`,
built by `buildTeachingLoadAuthorityDiagnostics`). Inspected, and it already
carries every required field — **no server read-path addition was needed and no
server file was changed.** `/faculty-assignments/summary` supplies the persisted
policy status.

New: `lib/teaching-load-authority-truth.ts` (pure derivation, `known | unknown`
per metric) and `components/faculty-assignments/TeachingLoadTruthPanel.tsx`
(summary chips + on-demand Popover). Fetch is a **non-fatal read-only GET** in
`useTeachingLoadData.ts`.

| R3 metric | Canonical source | Rendering |
|---|---|---|
| Required subject/section pairs | `demandedSubjectSectionPairs.length` | chip |
| Assigned pairs (real vs placeholder) | `ownedSubjectSectionPairs` split by roster `isPlaceholder` | chip `N (R real, P temp)` |
| Unresolved pairs | set difference `demanded \ owned` by `pairKey` — never aggregate subtraction | chip |
| Actual teaching minutes | `overloadCapacityTotals.beforeTeachingMinutes` | chip in hours |
| Persisted policy capacity | `teachingStandardMinutes` / `hardCapMinutes` | chips |
| Overload count + excess minutes | `beforeOverStandardCount` / `beforeOverHardCapCount` + **`beforeExcessMinutes`** (sum of per-faculty over-standard minutes) | chips |
| Remaining capacity | **`capacityMinutes − beforeTeachingMinutes`**, where `capacityMinutes = standard × active-faculty count` | chip |
| Zero-load active faculty | `unownedActiveFaculty` | count chip + names on demand |
| Adviser status | `validAdviserMappings` (roster authority) | count chip + names on demand |
| Advisory credit | `advisoryCreditEligibility` — **policy-bound** | chip, unknown without policy |
| Excluded HG/reference-only rows | `legacyHgOwnershipRows` | count chip + explanation on demand |

**Fail-closed rules (proven):** no diagnostics ⇒ every metric `unknown`; or an
`UNCONFIGURED` totals block / `UNCONFIGURED` summary status / non-positive
standard, **or a null canonical basis (`capacityMinutes` / `beforeExcessMinutes`)**,
⇒ capacity, overload, remaining, actual, and advisory credit are `unknown` with
the operator-visible reason. No invented `0`/`30h`/`5h`.

### Correction C-2 — unit-coherent capacity and excess

A planner review found two unit-incoherent derivations in the first R3 cut, and
the finding was independently confirmed against the real producer
(`buildTeachingLoadAuthorityDiagnostics`): `beforeTeachingMinutes` is an aggregate
over `plan.facultyWorkloads` (active, non-stale, non-placeholder faculty,
including zero-load — constructed at `teaching-load-reconciliation.service.ts:1208-1221`).

| Retired (unit-incoherent) | Corrected |
|---|---|
| `remaining = max(0, standard × ownedPairCount − beforeMinutes)` | `remaining = max(0, capacityMinutes − beforeMinutes)` where `capacityMinutes = standard × facultyCount` |
| `excess = max(0, beforeMinutes − standard)` (aggregate minus ONE standard) | `excess = beforeExcessMinutes` = Σ `max(0, row.beforeMinutes − standard)` |

Server read-path addition (no write-behaviour change): a new exported pure
function `computeOverloadCapacityTotals(facultyWorkloads, policy)` plus
`OverloadCapacityTotals` with `capacityMinutes` and `beforeExcessMinutes`, and the
builder now delegates to it so the payload and the helper cannot drift. The dead
`policyConfigured ? NO_AUTHORITY : NO_STANDARD` ternary in the actual-minutes
unknown reason was removed.

### R3 failing-first mutants (performed, then restored byte-exact)

Baseline blob `4d56a72aafb073598f7bb9a9b411e67e39f8af01`.

| Mutant | Mutation | Result | Restore |
|---|---|---|---|
| M1 | null-authority branch fabricates `known(0)` | 16 tests, **15 pass / 1 fail** — "a missing canonical authority renders typed unknown" | byte-exact |
| M2 | summary-`UNCONFIGURED` override guard removed | 16 tests, **15 pass / 1 fail** — "a summary that reports UNCONFIGURED overrides a stale configured totals block" | byte-exact |
| M3 | policy-configured guards removed, standard defaulted to 1800 | 16 tests, **13 pass / 3 fail** — UNCONFIGURED fail-closed, the override test, and the C-2 null-basis control | byte-exact |
| M4 | C-2 formulas reverted to the mixed-unit versions | 16 tests, **13 pass / 3 fail** — the rendered chip shows `2 (+95h)` instead of the canonical `2 (+45h)`, plus both C-2 basis tests | byte-exact |

All four restores verified: blob returns to `4d56a72a…`, `git status --porcelain=v2`
empty, `git diff --quiet` exit 0.

## Server suite tally (explicit operator requirement)

### Hermetic — executed, PASSED

| Suite | Result |
|---|---|
| `derived-demand-authority.test.ts` | 10/10 pass |
| `derived-demand-correction-c01r.test.ts` | 10/10 pass |
| `teaching-load-carry-forward-authority.test.ts` | 12/12 pass |
| `teaching-load-distribution-plan.test.ts` | 13/13 pass |
| `teaching-load-effective-workload-policy.test.ts` | 56/56 pass |
| `teaching-load-suggestion-apply-parity.test.ts` | 34/34 pass |
| `teaching-load-reconciliation.test.ts` **Part A** (hermetic) | 83 passed / 0 failed; Part B skipped (`requires DATABASE_URL`) |
| `teaching-load-suggestion-authority.test.ts` **Part A** (hermetic) | 4 passed / 0 failed; Part B skipped |
| `teaching-load-overload-capacity-totals.test.ts` **(new, C-2)** | 7/7 pass |
| `generation-passive-teaching-load.test.ts` | PASS (GEN-ZW01 source/entry-point guards) |
| `teaching-load-write-authority.test.ts` | PASS for the source-scan/authority guards; DB-backed mounted-route rows not exercised |

### Executed without a DB, full tally, zero failures

| Suite | Result |
|---|---|
| `derived-demand-correction-c01r2.test.ts` | 7/7 pass |
| `teaching-load-suggestion-authority-c03.test.ts` | 64/64 pass |
| `teaching-load-suggestion-derived-demand-c03r2.test.ts` | 77/77 pass |
| `uxc01r-derived-demand-route.test.ts` | 5 tests, 4 pass, 0 fail, **1 skipped** (DB row) |

### `BLOCKED_EXTERNAL(DISPOSABLE_DB_UNAVAILABLE)` — not run

| Suite | Evidence |
|---|---|
| `teaching-load-summary-zero-write-route.test.ts` | `[FAIL] DATABASE_URL is unavailable; cannot run the live zero-write route test.` |
| `teaching-load-reconciliation-route.test.ts` | `[FAIL] DATABASE_URL is unavailable.` |
| `teaching-load-carry-forward-postgres.test.ts` | `RESULT: 0 passed, 0 failed` — fully DB-gated, no hermetic assertions |
| Part B of `teaching-load-reconciliation` / `teaching-load-suggestion-authority` / `uxc01r-derived-demand-route` / `teaching-load-write-authority` | `[SKIP] … requires DATABASE_URL` |

**Exact reason.** The local PostgreSQL 18 cluster (`127.0.0.1:5432`) requires
SCRAM password authentication; a credential-free probe returned
`SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`. There is no
sanctioned credential source for this worktree (`atlas-server/.env` absent,
`psql` not on `PATH`), and the only known credential file
(`D:\ATLAS-runtime-config\atlas-server.env`) is explicitly off-limits by this
packet. Provisioning a test-marked disposable database would therefore require
reading a live credential, so the packet's fallback applies: **do not run, never
against live/shared data.**

**No DB was created, migrated, or dropped.** Resolved host/port: `127.0.0.1:5432`
(service `postgresql-x64-18`, Running). No database name was ever opened; no
secret was read or printed. **Cleanup: nothing to clean up — zero database
mutation occurred.** No live/shared database was touched.

The two server paths in this range are a pure exported helper plus its hermetic
test (correction C-2); the diagnostics payload gained two fields read from the
same `plan.facultyWorkloads` basis the builder already used, with no write
behaviour change. The server `tsc --noEmit` and `npm run build` both exit 0, and
the full hermetic server TL set is green.

## Shared-predicate blast radius (Section 3)

`matchesOwnershipDepartment` is also consumed by
`components/timetable/TacticalSandboxDock.helpers.ts` — **not edited**.

A dedicated control (`tl-operator-workspace-c05-blast-radius.test.ts`, 6 tests)
proves the widening is **blank/unknown-department-only**:

- Known non-matching department + declared owner departments → `ineligible`
  (checked across `ESP, MATH, SCI, ENG, AP, TLE, MAPEH, SPS, UNKNOWN-DEPT`).
- Only `null` / `undefined` / `''` / whitespace / tab become `unknown` (visible).
- With **no** declared owner departments, known departments keep the legacy
  verdict **exactly** (field-for-field parity against `isDepartmentMatch` across
  8 departments, both the tri-state and the boolean).
- The timetable consumer still imports and calls the shared boolean API and
  contains no local re-implementation.

**Disclosure:** commit 5 (`ed5736ea`) briefly widened the no-authority fallback
beyond blank departments. That hole was found by this control and closed in
commit 6 (`66bfcc34`); QA should review the range as a whole.

## Test, build, and shell evidence

| Gate | Result |
|---|---|
| Client TL suite (C05 ×3 + `teaching-load-*` + helpers + `tt-tl-modules-*` + route-intent + ux-guardrails) | **213/213 pass, 0 fail** |
| `npm run test:ux-guardrails` | 21/21 pass |
| Client `tsc --noEmit` / `vite build` | exit 0 / `✓ built` |
| Server hermetic TL set (11 suites incl. the new C-2 suite) | all pass / 0 fail |
| Server `tsc --noEmit` and `npm run build` | exit 0 / exit 0 |
| `git diff --check` / `--cached --check` | exit 0 |
| Component line cap (1000, physical) | max = `TeachingLoad.tsx` **906**, `AutoFillSummaryModal.tsx` 720, `SubjectRow.tsx` 672, `TeacherGridMode.tsx` 594, `SectionGridMode.tsx` 434, `TeachingLoadTruthPanel.tsx` 283, `TeachingLoadCandidateDiagnostics.tsx` 79 |
| No-scroll shell | `h-[calc(100svh-3.5rem)]`, root `flex flex-col`, `flex-1 min-h-0` preserved; truth panel is horizontal-overflow only, suppressed under `max-height:640px` |
| Zero-write | `useTeachingLoadData.ts` contains the diagnostics GET and **no** `atlasApi.post/put/patch/delete`; no `/policies/scheduling` in the hook or the new modules |

**Live desktop/mobile pixel measurement remains
`BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)`** — the packet authorizes no login,
browser, or runtime. Only structural/class and rendered-markup contracts ship.

## Trace table — R1–R12

| R | Production path | Negative / adversarial control | Status |
|---|---|---|---|
| R1 | `WorkspaceToolbar`, `TeachingLoadModals`, `SectionGridMode`, `WorkloadInspector`, `TeachingLoadRepairQueue`, `TeachingLoad.tsx` | rendered chip is a real `<button>`; removal scans for every flag/prop/literal; duplicate-testid single ownership; file-absence for the deleted panel | **PASS** |
| R2 | `SectionGridMode` popover, `AutoFillSummaryModal` move list, truth panel | viewport-relative class assertions; `max-h-75`/`max-h-64` absent; shell contract present | **PASS (structural)** — live pixels `BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)` |
| R3 | `teaching-load-authority-truth.ts`, `TeachingLoadTruthPanel.tsx`, `useTeachingLoadData.ts` diagnostics GET, server `computeOverloadCapacityTotals` | rendered harness for all 12 metrics; null-authority fail-closed; UNCONFIGURED fail-closed; C-2 null-basis fail-closed; four failing-first mutants restored byte-exact | **PASS** |
| R4 | `ownershipDepartmentEligibility`, `matchesOwnershipDepartment`, `selectEligibleOwnerCandidates` | null-department pre-emption mutant fails 4 tests; overloaded FIL/ESP + zero-load-both-depts fixture; blast-radius parity across 8 departments | **PASS** |
| R5 | `teaching-load-suggestion-diagnostics`, `TeachingLoadCandidateDiagnostics` | producer-parity control reads the server union and every emitted reason; rendered count-equality control with an unknown code; failing-first mutant removed a producer reason and failed 3 controls | **PASS** |
| R6 | `useTeachingLoadData` (summary + diagnostics), `policyReady`, `WorkloadInspector`, truth panel | no `/policies/scheduling`; strict `policyReady`; policy-bound capacity/overload/remaining/advisory | **PASS** |
| R7 | `resolveSuggestionPreviewState`, `AutoFillSummaryModal` header + `data-preview-state` | mutant dropping the evaluated guard yields `imbalance` where production yields `unevaluated` | **PASS** |
| R8 | `TeachingLoad.tsx` preview/apply | client sends no fingerprint; apply targets the server proposal id; zero server diffs | **PASS** |
| R9 | `scope-request-epoch.ts`, page preview/apply/cancel guards, scope effect, diagnostics read guard (F2) | epoch discard control; ≥3 guarded suggestion handlers and ≥3 discards asserted; scope change clears suggestion state; failing-first mutant removed the diagnostics guard | **PASS** |
| R10 | Inventory above, encoded as tests | duplicate-target/testid ownership control; per-chip distinctness | **PASS** |
| R11 | Repair-queue-first shell, toolbar, truth strip | no regression in shell/repair-queue assertions | **PASS** |
| R12 | HG canonical code, proposal/apply contract, term/actor paths | source assertions | **PASS** |

**No `DEFERRED` safe work remains.**

## Existing-test change (justified, coverage preserved)

`teaching-load-distribution-ui.test.ts` line 43 asserted the removed inline
ternary shape `/: !distributionEvaluated/`. The header now derives from a single
pure authority, so the assertion was rebound to that authority
(`unevaluated: 'Coverage complete, balance not evaluated'` and
`resolveSuggestionPreviewState(`). The asserted user-visible copy is unchanged
and the intent is preserved and strengthened. No assertion was deleted and no
coverage reduced.

## Remaining risks

**BLOCKING:** none.

- `BLOCKED_EXTERNAL(DISPOSABLE_DB_UNAVAILABLE)` — the DB-gated TL suites and Part B
  rows listed above (exact reason recorded). Their hermetic Parts passed
  (`teaching-load-reconciliation` 83/0, `teaching-load-suggestion-authority` 4/0,
  `uxc01r-derived-demand-route` 4/5 with 1 skip) and the new C-2 helper is proven
  hermetically in 7/7 assertions, but **the DB-backed rows remain unexecuted** —
  QA must not treat them as passed.
- `BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)` — live desktop/mobile pixel
  measurement and browser click-path evidence.
- `NON_BLOCKING` — advisory credit is treated as policy authority, so it renders
  `unknown` when the policy is unconfigured even if the server emits eligible
  rows; this is the fail-closed direction.
- `NON_BLOCKING (environment)` — a fresh worktree needs `prisma generate` before
  the server type-check.
- `NON_BLOCKING (pre-existing)` — `subject.ownerDepartment` /
  `allowedOwnerDepartments` remain client projections of the server's persisted
  qualification authority; the client avoids pre-empting it but cannot prove
  eligibility. Apply stays server-authoritative.
- `NON_BLOCKING (disclosed residual, F2)` — the summary/subjects/sections setters
  in `useTeachingLoadData.ts` remain un-epoch-guarded; only the
  authority-diagnostics read was guarded this round. They are overwritten by the
  next fetch and were deliberately left outside the bounded correction.
- `NON_BLOCKING (disclosed residual, out of scope)` — the timetable consumer
  `components/timetable/TacticalSandboxDock.helpers.ts` still uses the boolean
  `matchesOwnershipDepartment` while the tri-state helper carries richer copy;
  that copy asymmetry is a disclosed out-of-scope residual and the file was not
  touched.

## Zero-mutation statement

No deployment, runtime, login, browser session, generation, publication,
migration, schema change, live/shared database read or write, disposable-database
creation, companion-repo edit, worktree retirement, branch deletion, merge,
rebase, amend, force-push, or push. No HIGH action was executed. Nothing outside
the owned paths was modified; `D:/ATLAS` and every other worktree were untouched.

## Return

`REVIEW_REQUIRED` — product/test candidate
`66bfcc34cff35a15269eb0d989e9be2aa676dc0f` on `work/tl-operator-workspace-c05`,
base `0c20342394ca2ca800cecc6dd69825e07625c66d`. A fresh independent QA delegate
follows; this executor does not self-approve, integrate, or push.

---

# Combined correction append — C-4 (ancillary/effective-load parity) + C-5 (F2-COLD-LOAD)

Supersedes the "Return" paragraph above. That stale candidate SHA is historical
and is **not** re-asserted here; this section deliberately makes **no
self-referential final-SHA claim**.

- Full-range base: `c669c77cfc4f8895c5635be6920b9079ab0c259f` (refreshed `origin/main`)
- Correction base: `7e38f9b49b22e2658c9ea0c187293b9c5fde4fba` (planner `-x` cherry-pick of `ea9b498d` onto `c669c77c`)
- Branch/worktree: `work/tl-operator-workspace-c05-combined` @ `E:/ATLAS-worktrees/tl-operator-workspace-c05-combined`
- Directive pin (LF-normalized `origin/main:AGENTS.md`): `C1E05AB0AAC280B9C335A0EA7FE41CCD9250B42AC5ADD9960F69508F566DCCA7` — recomputed and matched.

## C-4 — ancillary / effective-load parity (frozen input, not modified)

`Total Teaching Load = Actual Teaching Load + effective Class Advising credit`.
Ancillary Work, ARAL, HG/HGP, and scheduled breaks contribute **zero** teaching-load
credit. Implemented by `resolveEffectiveLoadBaselineHours` in
`faculty-assignment-helpers.ts`, consumed by `useTeachingLoadUI.loadProfile` and
`TeachingLoad.resolveSectionHoverDeltaMinutes`, with five parity controls in
`teaching-load-effective-load-parity.test.ts`.

**Provenance (truthful):** the lane rewrote its local `e1c417d8` into the
authoritative `ea9b498d`. `e1c417d8` is **not consumed** by this candidate and must
not be cited as an ancestor.

The four C-4 blobs were re-verified unchanged at the new tip:

| Path | Blob |
|---|---|
| `atlas-client/src/hooks/useTeachingLoadUI.ts` | `73538e71fbd2cc7ace4caf65b6284a253b1e8ac6` |
| `atlas-client/src/lib/__tests__/teaching-load-effective-load-parity.test.ts` | `6ebee29a1ab57cb8908cc2b49c7a55f7dc613679` |
| `atlas-client/src/lib/faculty-assignment-helpers.ts` | `1b5ec43ce440a9ea0255f9a53ca1d258b50dec21` |
| `atlas-client/src/pages/TeachingLoad.tsx` | `1d07d5c7ca523e00a4555337fd1c19ed7f9af3aa` |

## C-5 / F2-COLD-LOAD — the authority-diagnostics read was dead on the first load

**Defect.** In `useTeachingLoadData.ts` the diagnostics token capture (`:264`) and
dispatch (`:267`) ran in the SAME synchronous continuation as the scope-resolving
setter (`:232`, after the awaited `Promise.all` at `:178`), so React's scope effect
(`:456-467`, `diagnosticsEpochRef.current.begin()` at `:465`) ran afterwards and
self-invalidated the captured token. On a cold cache the first
`GET /faculty-assignments/authority-diagnostics` reply was discarded at `:274`/`:277`,
`:280` declined to clear the loading flag, and `TeachingLoadTruthPanel` stayed on
"Checking source" with every metric unknown.

**Fix.** The epoch is now owned by the **resolving fetch**, not by a render-time
effect:

- `openDiagnosticsScope(scopeRef, epoch, scopeId)` opens an epoch only when the
  RESOLVED scope identity actually changed;
- `loadAuthorityDiagnosticsForScope({ epoch, scopeRef, scopeId, request, setPayload, setLoading })`
  opens the epoch **before** capturing the token, then persists + clears loading for
  the current scope, or returns `'discarded'` **without touching state** for a
  superseded scope;
- the scope effect clears the panel only and never opens an epoch.

**Harness note (disclosed limitation).** This repository has no DOM implementation
(no `jsdom`, `react-test-renderer`, `happy-dom`, `linkedom`, `@testing-library/react`)
and dependencies are frozen, so a DOM-mounted hook render is not available. The
controls therefore drive the real exported production seams that `fetchData` calls
and render the real `TeachingLoadTruthPanel` through the established
`renderToStaticMarkup` harness.

**Controls** (`tl-authority-diagnostics-cold-load.test.ts`, 8 tests):
1. Cold cache + first resolved scope persists the payload and clears loading.
2. Loading clears after success **and** after failure (typed unknown rendered).
3. Same scope re-resolved does not self-invalidate (`openDiagnosticsScope` + loader).
4. A genuinely superseded-scope response is discarded.
5. A superseded response — success **or failure** — cannot clear the current scope's
   loading flag.
6. Zero-write: read-only GET only; no `atlasApi.post/put/patch/delete`; no
   `/policies/scheduling`; the loader itself has no transport and no cache write.
7. The real panel renders known values ("Source verified", `data-metric-state="known"`,
   required-pairs = 2) instead of "Checking source".

## Failing-first mutant proofs (byte-exact restores)

| # | Mutation | Blob | Result |
|---|---|---|---|
| A | literal currently-integrated pre-F2 hook (`git checkout` of `useTeachingLoadData.ts`) | `e3298b87ce03689a42f552367a2b4b231e8f83e6` | 8 tests, **0 pass / 8 fail** — the pre-F2 hook exposes no drivable seam ("the loader must be exported"), so the control cannot pass at all |
| B | stale-scope ordering mutant: capture the token BEFORE the epoch opens (the pre-F2 ordering expressed in the seam) | `7b81231ea3d25faffe68381ce9d6d58eb305d1c8` | 8 tests, **4 pass / 4 fail** — "the scope-resolving reply must be persisted", "the panel must not be stuck on the loading badge", failure-path loading, same-scope re-resolve |
| — | fixed hook (restored) | `fad12c9ab69af8c2150460c582f2a9c80bd5e8d8` | restore verified by blob equality, `git diff --quiet` exit 0, `git status --porcelain=v2` empty |

Mutant B is the load-bearing proof: it reproduces the exact production ordering
defect and fails for the right reason. The adversarial cross-scope discard controls
stayed **green under both mutants**.

## Gate results

| Gate | Result |
|---|---|
| 1. C-5 cold-load production-seam suite | **8/8 pass** |
| 2. `teaching-load-effective-load-parity.test.ts` (C-4) | **5/5 pass** |
| 3. C05/R3 suites (`tl-operator-workspace-c05`, `-r3-truth`, `-blast-radius`, `teaching-load-distribution-ui`, `teaching-load-suggestion-diagnostics-ui`) | **all green** (73/73 across gates 1-3 in one run) |
| 4. `teaching-load-effective-workload-policy.test.ts` (server) | **Total: 56, Passed: 56, Failed: 0**; server `tsc --noEmit` exit 0 |
| 5. client `npx tsc --noEmit` | **exit 0 — zero errors** |
| 6. client `npm run build` | **✓ built** |
| 7. `git diff --check` | **exit 0** |
| 8. changed-path inventory + C-4 blob re-verification | recorded in the return message; C-4 blobs unchanged |

Dependencies: isolated `npm ci` in `atlas-client` (lockfile SHA-256
`CE1AE84ED088BE75F27542CB039ABF338395ECE1C9E9A5D2139C2C65CF3B9F1E`, unchanged) and
in `atlas-server` (`ECF06AEF5C385591A0CF4C03F6852018B283182375F9B23656210BF13794B6E5`,
unchanged), followed by `npx prisma generate --schema ../prisma/schema.prisma`. No
other worktree's `node_modules` was reused. A stray root-level `node_modules`
(created by a mis-targeted first install) exists but is gitignored and untracked.

## Known risks

- `BLOCKING`: none.
- `NON_BLOCKING (harness limitation, disclosed)`: no DOM implementation is available
  and dependencies are frozen, so the cold-load control drives the real production
  loader seam rather than a DOM-mounted hook render. The rendered assertions use the
  real panel component.
- `NON_BLOCKING (pre-existing)`: the summary/subjects/sections setters in
  `useTeachingLoadData.ts` remain un-epoch-guarded; only the diagnostics read is
  scope-guarded by this correction.
- `BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)`: live browser/pixel evidence is not
  authorized by this packet.

## Zero-mutation statement

No push, merge, rebase, amend, force-push, or register edit. The legacy worktree
`E:/ATLAS-worktrees/tl-operator-workspace-c05` and
`E:/ATLAS-worktrees/integration-tl-operator-workspace-c05-20260915` were **not**
entered, read-modified, cleaned, stashed, or committed. No browser, login, database,
runtime, deployment, migration, generation, or publication action occurred. The four
C-4 files were not modified.

---

# C-6 — sibling authority feeds bound to the dispatch scope

Full-range base: `56b317c5189169666ba14c0c081be94f9b85dceb` (refreshed `origin/main`; the
wave merge `61761a1e` is already integrated here). Branch/worktree:
`work/tl-operator-workspace-c05-scope-epoch` @
`E:/ATLAS-worktrees/tl-operator-workspace-c05-scope-epoch`. Directive pin (LF-normalized
`origin/main:AGENTS.md`): `7663164608A330AF5440A6E0EA1FFADE20987B49A7BB0D939F3B50F1AA2DF0A3`
— recomputed and matched. This section makes **no self-referential final-SHA claim**.

## Defect

C-5 guarded only the diagnostics read. `fetchData` still wrote every other authority feed
unconditionally — `setFaculty`, `setSubjects`, `setSectionSummary`,
`setSectionAssignedClassesIndex`, `setCoverageTotals`, `setWorkloadPolicy(Status)`,
`setDataSource`, `setDegradedNotice`, `setError`, and the page `setLoading` — in three
paths (warm-cache branch, cold-success path, catch/fallback path). A reply that landed
after a school/year transition therefore overwrote (or cleared) the current scope's state.

## Fix

One shared `ScopeBoundWrite` binding — `{ scopeRef, epoch, scopeId, token }` with the
token captured at dispatch — opened by the **resolving fetch** (never an effect), then
used at every write site:

- `openDiagnosticsScope(diagnosticsScopeRef, diagnosticsEpochRef.current, resolvedScopeId)`
  runs immediately after the scope resolves and **before** the token is captured;
- `isScopeCurrent(binding)` is the single currency predicate (the C-5 loader now delegates
  to it — `scopeRef.current === scopeId && epoch.isCurrent(...)` has exactly one
  implementation);
- `commitScopeBoundWrite(binding, write)` applies a write only when current;
- the warm-cache branch condition, the cold-success block, both catch/fallback branches,
  and the `finally` loading clear are all gated; an unresolved scope binding is
  deliberately **not** blocked, so an early actor-school failure still surfaces its error.

Zero-write preserved: read-only GETs only; no `atlasApi.post/put/patch/delete`; no
`/policies/scheduling`.

## Controls and mutant proofs

New committed control `tl-scope-epoch-sibling-feeds.test.ts` (7 tests) drives the real
production guard: an obsolete-scope reply must write **nothing** across the whole sibling
feed set; an obsolete reply must not clear the newer fetch's loading flag; a repeated
same-scope dispatch stays current (no self-invalidation); an unresolved binding never
blocks; the hook wiring gates every required feed; the currency predicate has one
implementation; the guarded path stays read-only.

| Probe | Blob (base → mutant) | Result |
|---|---|---|
| P1 weaken `isScopeCurrent` to `return true` | `4281f8605b06be21cea1881ebc4ba23b31938b4c` → `33c8e1da44c1127c907cd633623c8ead6f969914` | scope suite 7 tests, **5 pass / 2 fail** — "A is superseded once B resolves", "an obsolete fetch must not clear the newer fetch's loading flag" |
| P2 remove `OUTSIDE_CANONICAL_DEMAND` from the client mapping (**removed producer member**) | `f4a4d00171209dc40ea442e3c30ad1a89edcaa16` → `d9ebc2cddf8166bafd1ef64b14168caab09deafe` | C05 suite 35 tests, **31 pass / 4 fail** — C-6 mutant A ("every producer reason must have a client entry") plus the R5 parity/count/grouped controls |
| P3 drop the unmatched group in `summarizeCandidateRejections` (**dropped unknown value**) | `f4a4d00171209dc40ea442e3c30ad1a89edcaa16` → `9ca07329181f2b5541304d838b368e95f104869a` | C05 suite 35 tests, **32 pass / 3 fail** — C-6 mutant B ("the conservation check must count every row") plus the rendered count-equality and unknown-path controls |

All three probes restored byte-exact (blob equality; `git diff --quiet` exit 0; porcelain
empty). The two C-6 rendering mutants are committed additive controls: they pass on the
current code (full producer-domain coverage; `grouped === total`) and fail when the
corresponding guard is weakened.

## Gate table

| Gate | Result |
|---|---|
| 1. scope-transition control (green on tip + failing-first P1) | **7/7** on tip; P1 → 5/2 |
| 2. rendering mutants in both directions (P2 → 31/4, P3 → 32/3) | proven both ways |
| 3. `tl-authority-diagnostics-cold-load.test.ts` (C-5) | **8/8** |
| 4. `teaching-load-effective-load-parity.test.ts` (C-4) | **5/5** |
| 5. C05/R3 suites (5 files) | all green — **82/82** across gates 1–5 |
| 6. client `npx tsc --noEmit` | **exit 0 — zero errors** |
| 7. client `npm run build` | **✓ built** |
| 8. `git diff --check` | **exit 0** |
| 9. inventory + C-4 blobs + C-5 seam | recorded in the return message; all four C-4 blobs unchanged; C-5 seam still present |

Dependencies: isolated `npm ci` in `atlas-client` (lockfile SHA-256
`CE1AE84ED088BE75F27542CB039ABF338395ECE1C9E9A5D2139C2C65CF3B9F1E`, unchanged). Server
dependencies were **not** installed or needed. No other worktree's `node_modules` was used.

## Optional item

The `WorkloadInspector.tsx` "advisory/ancillary" → advisory-only wording correction was
**skipped**: it would add a fifth path to a scope-epoch correction with no bearing on the
authorized C-6 behavior, i.e. pure path churn. Flagged for a future cosmetic pass.

## Known risks

- `BLOCKING`: none.
- `NON_BLOCKING (harness limitation, unchanged from C-5)`: no DOM implementation is
  available and dependencies are frozen, so controls drive the real exported production
  seams and render real components via `renderToStaticMarkup`.
- `NON_BLOCKING (pre-existing)`: `setSchoolId` / `setActiveSchoolYearLabel` /
  `setActiveTermIndex` are written during scope resolution itself (before the binding
  exists) and are intentionally not gated; they establish the scope rather than consume a
  reply.
- `NON_BLOCKING`: same-scope concurrent fetches share one token and may both write; they
  describe the same scope, and no cross-scope overwrite is possible.
- `BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)`: live browser/pixel evidence is not authorized.

## Zero-mutation statement

No push, merge, rebase, amend, force-push, or register edit. The worktrees
`tl-operator-workspace-c05`, `tl-operator-workspace-c05-combined`, and
`integration-tl-operator-workspace-c05-20260915` were **not** entered, modified, cleaned,
stashed, or committed. No browser, login, database, runtime, deployment, migration,
generation, or publication action occurred. The four C-4 files were not modified.
