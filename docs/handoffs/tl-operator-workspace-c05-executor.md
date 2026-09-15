# TL-OPERATOR-WORKSPACE-C05 — Executor Handoff

**Role:** EXECUTOR · **Risk tier:** MEDIUM source-only · **Verdict:** `REVIEW_REQUIRED`

| Field | Value |
|---|---|
| Accepted base SHA | `0c20342394ca2ca800cecc6dd69825e07625c66d` (= refreshed `origin/main`; verified ancestor) |
| Product/test candidate | `51800840b5655e2b49f88017582e36b25896f6cb` |
| Frozen tip (incl. this handoff) | see the final tip recorded in the return message |
| Branch | `work/tl-operator-workspace-c05` |
| Worktree | `E:/ATLAS-worktrees/tl-operator-workspace-c05` |
| Range | `0c203423..51800840`, 9 commits, 26 paths, +2740 / −595 |
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
