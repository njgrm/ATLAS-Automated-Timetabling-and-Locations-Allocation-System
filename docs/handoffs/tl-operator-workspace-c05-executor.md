# TL-OPERATOR-WORKSPACE-C05 — Executor Handoff

**Role:** EXECUTOR · **Risk tier:** MEDIUM source-only · **Verdict:** `REVIEW_REQUIRED`

| Field | Value |
|---|---|
| Accepted base SHA | `0c20342394ca2ca800cecc6dd69825e07625c66d` (refreshed `origin/main` tip; verified ancestor) |
| Candidate SHA | `d0fd7e9222342935f896a154e83c22526ca0074e` |
| Branch | `work/tl-operator-workspace-c05` |
| Worktree | `E:/ATLAS-worktrees/tl-operator-workspace-c05` |
| Candidate range | `0c203423..d0fd7e92` (3 additive commits) |
| Commit 1 | `3c8646b5` fix(teaching-load): make the TL operator workspace correct and comprehensible |
| Commit 2 | `b64ec7cb` fix(teaching-load): remove the duplicate advanced-grid reveal control |
| Commit 3 | `d0fd7e92` fix(teaching-load): discard suggestion replies from an obsolete scope |
| Canonical directive | tracked `origin/main:AGENTS.md`, LF-normalized SHA-256 `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5` (local `D:/ATLAS/AGENTS.md` recomputed and matched byte-for-byte) |
| Worktree disposition | `RETIRE_AFTER_INTEGRATION` (not retired here) |

## Dependency approach

No junction/shared tree was used. `E:` had 73.41 GiB free at start (floor 15 GiB).
Isolated `npm ci` was run per workspace after verifying the committed lockfiles:

- `atlas-client/package-lock.json` SHA-256 `CE1AE84ED088BE75F27542CB039ABF338395ECE1C9E9A5D2139C2C65CF3B9F1E` → 235 packages
- `atlas-server/package-lock.json` SHA-256 `ECF06AEF5C385591A0CF4C03F6852018B283182375F9B23656210BF13794B6E5` → 252 packages
- `npx prisma generate --schema ../prisma/schema.prisma` (writes only `node_modules/.prisma/client`; tracked tree untouched) was required before the server type-check.

## Exact changed paths (16)

```
M  atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx
M  atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
M  atlas-client/src/components/faculty-assignments/TeachingLoadModals.tsx
D  atlas-client/src/components/faculty-assignments/TeachingLoadReconciliationPanel.tsx
M  atlas-client/src/components/faculty-assignments/TeachingLoadRepairQueue.tsx
M  atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx
M  atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
M  atlas-client/src/hooks/useTeachingLoadUI.ts
M  atlas-client/src/lib/__tests__/teaching-load-distribution-ui.test.ts
A  atlas-client/src/lib/__tests__/tl-operator-workspace-c05.test.ts
M  atlas-client/src/lib/faculty-assignment-helpers.ts
A  atlas-client/src/lib/scope-request-epoch.ts
M  atlas-client/src/lib/teaching-load-suggestion-diagnostics.ts
A  atlas-client/src/lib/teaching-load-suggestion-presentation.ts
M  atlas-client/src/pages/TeachingLoad.tsx
M  atlas-client/src/types.ts
```

**Zero server paths changed.** No `package.json`, lockfile, `CHANGELOG.md`, register,
`docs/plans/**`, `docs/reference/**`, `ui/**`, `lib/api.ts`, `app-shell/**`, `runtime/**`,
`timetable/**`, `faculty-dashboard/**`, export surface, or ops file was touched.

## Control inventory and dispositions

### `pages/TeachingLoad.tsx` (now 807 physical lines, cap 1000)

| Control | Location | Handler / API | Disposition |
|---|---|---|---|
| Full-page "Retry Connection" | ~568 | `data.fetchData()` → GET summary | **KEEP** — renders only in the early-return `data.error && dataSource === 'none'` branch, where the toolbar is not mounted. Mutually exclusive, not a duplicate retry path. |
| Mobile "View profile" | ~787 | `setMobileInspectorOpen(true)` | KEEP |
| Mobile inspector `Sheet` | ~795 | same | KEEP |
| Route-intent applier | 86 | `useTeachingLoadRouteIntent` | KEEP |
| Scope-reset effect | ~100 | `scopeEpochRef.begin()` + reset + clear suggestion state | **EXTENDED (R9)** |

### `WorkspaceToolbar.tsx`

| Control | Location | Handler / API | Disposition |
|---|---|---|---|
| Source-state `Badge` + tooltip | 167–180 | none (status) | KEEP — correctly a non-interactive badge, not a button |
| `SmartHelpTrigger` "Help" | ~184 | opens help | KEEP |
| Primary action button | 213–223 | `onAutoFillClick` (POST `suggestion-proposals`, zero-write preview) or `onRetrySource` (GET summary) | KEEP |
| "More Teaching Load tools" dropdown | ~234 | opens menu | KEEP |
| Coverage-mode radio group | ~240 | `onCoverageModeChange` | KEEP |
| Tabs Teachers / Sections | 258–262 | `onViewModeChange` | KEEP — **REMOVED** the dead `'subjects'` literal from the value cast |
| `% staffed` chip | ~270 | none | KEEP — non-interactive `div` |
| Unassigned pairs chip | ~280 | none | KEEP — non-interactive `div` |
| Alert chip "Above weekly max" | 123–133 | `onShowExcessTeachingLoad` | KEEP — distinct policy threshold |
| Alert chip "Excess teaching load" | 134–144 | `onShowExcessTeachingLoad` | KEEP — distinct policy threshold (above standard). Both chips encode different rules; labels, tooltips and tests keep them distinct. Never both at once (weekly-max wins). |
| Alert chip "Temporary substitutes" | 145–155 | `onShowTemporarySubstitutes` (new) | **FIXED** — was `onClick: undefined` rendered as a live `<Button>` |

### `TeachingLoadModals.tsx`

| Control | Location | Disposition |
|---|---|---|
| Suggestion confirm `ConfirmationModal` | was 47–56 | **REMOVED** — unreachable |
| `AutoFillSummaryModal` | 58–65 | KEEP |
| Save-warning confirm | 67–75 | KEEP |
| Discard confirm | 77–85 | KEEP |

### `AutoFillSummaryModal.tsx` (746 lines) and `SectionGridMode.tsx` (409)

| Control | Disposition |
|---|---|
| Shortage department accordion, Close, "Apply suggested Teaching Load" | KEEP |
| Section row (`role=button`), owner-picker trigger, owner option, search, mode `Select` | KEEP |
| Owner option new "Verify dept" affordance | **NEW** — marks `unknown` authority without hiding the candidate |
| `onReviewManually` prop | **REMOVED** (dead) |
| `WorkloadInspector.onClose` prop | **REMOVED** (dead; no caller) |
| `SectionGridMode` dead props `savedOwnershipMap`, `pendingOwnershipMap`, `onSelectTeacher`, `onHoverTeacher`, `onClearHover`, `onSave`, `hasDraft` | **REMOVED** |
| `TeachingLoadRepairQueue` "Browse all" + `onToggleAdvancedGrid` | **REMOVED** — duplicate target and duplicate test id |
| `TeachingLoadReconciliationPanel.tsx` | **DELETED** — proven zero importers (only historical review docs referenced it) |

### Removed-control evidence — no remaining route or caller

- `rg`-equivalent searches over the worktree confirm no remaining reference to
  `autoFillDialogOpen`, `setAutoFillDialogOpen`, `onReviewManually`,
  `WorkloadInspector`'s `onClose`, `onToggleAdvancedGrid`, or `Browse all`.
- `teaching-load-advanced-grid-toggle` is now declared by **exactly one** file
  (`TeachingLoadGuidedModePlaceholder.tsx`); asserted in
  `tl-operator-workspace-c05.test.ts`.
- `TeachingLoadReconciliationPanel.tsx` no longer exists; asserted by a
  file-absence plus page-absence test.

## R4 fixture and mutant results

Fixture: overloaded Filipino (`42h`, FIL), overloaded ESP (`42h`, ESP),
zero-load FIL (`0h`), zero-load ESP (`0h`), zero-load blank department (`0h`),
all active. Exercised through the extracted production predicate
`selectEligibleOwnerCandidates`.

- FIL subject → `[101, 105, 103]` — the zero-load FIL teacher **and** the
  blank-department teacher are candidates; the ESP teacher is excluded.
- ESP subject → `[102, 105, 104]` — symmetric.

**Failing-first mutant (performed, then reverted):** the retired pre-emption
`if (!normalizedFaculty) return 'ineligible'` was reintroduced into
`faculty-assignment-helpers.ts`.

- File blob before mutant: `a29c3b26fe02ced53d233868814fe1066ec4f319`
- Mutant blob: `72d2ef955712acb8ae493c89d60538a32e380162`
- Result: **23 tests, 19 pass, 4 fail** — exactly the four R4 controls
  (tri-state, boolean, fixture, and the mutant-reconstruction test) failed.
- Restore: `git checkout --` → blob `a29c3b26fe02ced53d233868814fe1066ec4f319`
  (byte-exact), `git status --porcelain=v2` empty, `git diff --quiet` exit 0.

## Workload policy behaviour (R6)

- The Teaching Load data path consumes the persisted effective policy from
  `GET /faculty-assignments/summary` (+ the client cache) only. A regression test
  asserts `useTeachingLoadData.ts` never calls `/policies/scheduling`
  (the auto-creating route) — view/refresh therefore dispatch zero writes.
- `policyReady` remains strict (`workloadPolicyStatus === 'CONFIGURED' && workloadPolicy != null`);
  an unconfigured policy renders the fail-closed "Teaching standard not configured"
  readiness card instead of inventing `30h/5h`.

## Desktop / mobile evidence (R2)

Rendered-component and structural contracts only, per the packet:

- Owner picker: `max-h-75` (fixed 300px clip) → `max-h-[min(60vh,26rem)]`;
  width `w-80` → `w-[min(22rem,calc(100vw-1.5rem))]`.
- Suggestion move list: `max-h-64` → `max-h-[min(55vh,30rem)]`.
- No-scroll shell contract preserved: `h-[calc(100svh-3.5rem)]`, root
  `flex flex-col`, internal `flex-1 min-h-0` / `flex-1 overflow-auto`.

**Live pixel measurement at 1366×768 and 390×844 is
`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`** — the packet authorizes no login,
no browser, and no runtime; only structural/class contracts ship.

## Database target identity

**No DB-backed suite was run.** No server file changed, and no disposable
database was provisioned, so the disposable-only rule could not be satisfied
without creating one; running against the live/shared database is forbidden.
Resolved host/database were therefore never opened.

## Trace table — requirement → production path → negative control → command

| R | Production path | Negative / adversarial control | Verification | Status |
|---|---|---|---|---|
| R1 | `ownershipDepartmentEligibility`, `WorkspaceToolbar`, `TeachingLoadModals`, `SectionGridMode`, `WorkloadInspector`, `TeachingLoadRepairQueue`, `TeachingLoad.tsx` | rendered toolbar chip is a real `<button>`; source scans for every removed flag/prop/literal; duplicate-testid single-ownership; file-absence for the deleted panel | `npx tsx --test src/lib/__tests__/tl-operator-workspace-c05.test.ts` | **PASS** |
| R2 | `SectionGridMode` popover, `AutoFillSummaryModal` move list | viewport-relative class assertions; `max-h-75`/`max-h-64` absence; shell-contract presence | same | **PASS (structural only)** — live pixels `BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)` |
| R3 | — | — | — | **DEFERRED — `SAFE_TO_CONTINUE`** (see Residuals) |
| R4 | `ownershipDepartmentEligibility`, `matchesOwnershipDepartment`, `selectEligibleOwnerCandidates`, `SectionGridMode` picker | reintroduced null-department pre-emption mutant → 4 tests fail; overloaded FIL/ESP + zero-load-both-depts fixture | same | **PASS** |
| R5 | `teaching-load-suggestion-diagnostics`, `AutoFillSummaryModal` diagnostics panel | every reason label must not be a raw enum/snake_case code; unknown-reason fallback | same | **PASS** |
| R6 | `useTeachingLoadData`, `useTeachingLoadUI.policyReady`, `WorkloadInspector` readiness card | no `/policies/scheduling` in the TL data path; strict `policyReady` | same | **PASS** |
| R7 | `resolveSuggestionPreviewState`, `AutoFillSummaryModal` header + `data-preview-state` | mutant dropping the evaluated guard yields `imbalance` where production yields `unevaluated` | same | **PASS** |
| R8 | `TeachingLoad.tsx` suggestion preview/apply | client still sends no fingerprint; apply still targets the server proposal id; **zero server diffs** | same + server `tsc` | **PASS** (no enforcement weakened) |
| R9 | `scope-request-epoch.ts`, `TeachingLoad.tsx` preview/apply/cancel guards, scope effect | epoch discard control (before/after `begin()`); ≥3 guarded handlers + ≥3 discards asserted | same | **PASS** for the suggestion path; page `resetForScope` preserved |
| R10 | Inventory above encoded as tests | duplicate-target/testid ownership control; per-chip distinctness | same | **PASS** |
| R11 | Pre-existing repair-queue-first shell + toolbar | no regression in shell/repair-queue assertions | existing suites | **PASS (preserved)** |
| R12 | HG canonical code, proposal/apply contract, term/actor paths | source assertions | same | **PASS** |

## Decisive commands and observed results

| Command | Result |
|---|---|
| `git update-index --refresh && git status --porcelain=v2 && git diff --quiet` | empty / exit 0 (clean at dispatch and at finalization) |
| `npx tsc --noEmit -p tsconfig.json` (client) | exit 0 |
| `npm run build` (client, `vite build`) | `✓ built` |
| `npx tsx --test` over the C05 suite + `teaching-load-*.test.ts` + `faculty-assignment-helpers` + `tt-tl-modules-*` + `useTeachingLoadRouteIntent` + `ux-guardrails` | **187 tests, 187 pass, 0 fail** |
| `npm run test:ux-guardrails` | 21 tests, 21 pass, 0 fail |
| `npx tsc --noEmit -p tsconfig.json` (server, after `prisma generate`) | exit 0 |
| `git diff --check` / `git diff --cached --check` | exit 0 |
| Component line counts (cap 1000) | max = `TeachingLoad.tsx` 807 |

## Existing-test change (justified, coverage preserved)

`atlas-client/src/lib/__tests__/teaching-load-distribution-ui.test.ts` line 43
asserted the removed inline ternary shape `/: !distributionEvaluated/`. The
header now derives from a single pure authority, so the assertion was rebound to
that authority (`unevaluated: 'Coverage complete, balance not evaluated'` and
`resolveSuggestionPreviewState(`). The asserted user-visible copy is unchanged
and the original intent — *the header must not assert balance when distribution
was not evaluated* — is preserved and strengthened. No assertion was deleted and
no coverage was reduced. All other existing tests pass unmodified.

## Residuals and remaining risks

**BLOCKING:** none identified in the changed scope.

- `NON_BLOCKING (SAFE_TO_CONTINUE)` — **R3** (canonical current-year
  derived-demand truth panel: required/assigned/unresolved pairs, actual
  minutes, policy capacity, overload/remaining, zero-load faculty, adviser
  status, HG/reference-only rows) was **not implemented** in this candidate. It
  needs read-path summary additions and dedicated rendered assertions.
- `BLOCKED_EXTERNAL(AUTH_SESSION_REQUIRED)` — live desktop/mobile pixel
  measurement (R2), and any browser click-path evidence.
- `NON_BLOCKING (environment)` — the server unit/DB suites were **not run**:
  the candidate changes zero server files, so they cannot regress from this
  diff. The server type-check (the gate a server change would break) passes.
  A fresh worktree also needs `prisma generate` before server type-check —
  recorded above as an environment prerequisite, not a defect.
- `NON_BLOCKING (blast radius, disclosed)` — `matchesOwnershipDepartment` is
  also consumed by `components/timetable/TacticalSandboxDock.helpers.ts`
  (outside this packet's owned paths). The change is a visibility widening for
  blank/unknown departments only; known non-matching departments are still
  excluded. That file was not edited and its behavior was not separately
  re-tested here; QA should confirm the sandbox candidate list.
- `NON_BLOCKING (residual)` — the suggestion **redistribution summary** panel and
  the remaining `resetForScope` selection/hover paths were reviewed but not
  re-asserted beyond existing coverage; hover clearing already runs through
  `resetForScope`.
- `NON_BLOCKING (pre-existing)` — `subject.ownerDepartment` /
  `allowedOwnerDepartments` remain client-supplied projections of the server's
  persisted qualification authority; the client still cannot *prove* eligibility,
  only avoid pre-empting it. Apply remains server-authoritative.

## Zero-mutation statement

No deployment, runtime, login, browser session, generation, publication,
migration, schema change, live/shared database mutation, companion-repo edit,
worktree retirement, branch deletion, merge, rebase, amend, force-push, or push
occurred. No HIGH action was executed. Nothing outside the owned paths was
modified. `D:/ATLAS` and every other worktree were untouched.

## Return

`REVIEW_REQUIRED` — candidate `d0fd7e9222342935f896a154e83c22526ca0074e` on
`work/tl-operator-workspace-c05`, base
`0c20342394ca2ca800cecc6dd69825e07625c66d`. A fresh independent QA delegate
follows; this executor does not self-approve, integrate, or push.
