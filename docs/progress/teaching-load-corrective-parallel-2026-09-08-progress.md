# TL-C01 — Teaching Load Metrics, Faculty Visibility, Contextual Filters — Progress Ledger

Plan source: user prompt TL-C01 (2026-09-08) + planner immediate correction "dynamic policy boundary" (same session).
Unique ledger per parallel boundary.
Status: `REVIEW_REQUIRED` is the max terminal state; formal GO is out of scope.
`SOURCE_IMPLEMENTATION`: IN_PROGRESS. `LIVE_RUNTIME`: BLOCKED_EXTERNAL (no live probe; ephemeral only).

Ownership: TL-C01 edits Teaching Load page + owned components/hooks/helpers + focused TL tests only,
plus the correction-authorized minimal backend changes (read-only effective-policy resolver,
`getAssignmentSummary` read path, TL-specific `/summary` response mapping).
SCA-03E files, shared CHANGELOG.md / phasePlan.md / manifests: DO NOT TOUCH.
No git stage/commit/stash/reset/checkout. No port-5001 restart. No live mutation.

## HONEST CORRECTION RECORD (planner direction, same session)

- The first implementation pass (Phases 1–4 as originally recorded DONE below) rested on
  client-side policy constants (`STANDARD_WEEKLY_TEACHING_HOURS = 30`,
  `CLASS_ADVISER_EQUIVALENT_HOURS = 5`, `MAX_WEEKLY_TEACHING_HOURS = 40`) and locally
  defaulted status math. That was NON-COMPLIANT with the dynamic-policy boundary:
  statuses must consume the effective school/year policy and canonical backend fields,
  and a passive Teaching Load read must not create policy.
- Those earlier DONE claims are SUPERSEDED by the correction recorded in this ledger
  ("CORRECTION" sections). Completion is claimed ONLY on the corrected implementation.
- The first advisory review (`advisory-review-01.md`, zeroFix:true) reviewed the
  non-compliant implementation and MISSED the dynamic-policy boundary. It is SUPERSEDED;
  a fresh changed-scope review is required (T7.2).
- Scoping decisions made honestly under the parallel boundary:
  - Legacy constant exports are RETAINED in `faculty-assignment-helpers.ts` (with a
    deprecation note) because out-of-tree, non-TL-owned consumers import them
    (`FacultyRow`, `FacultyProfileSheet`, `TacticalSandboxDock[.parts]`, legacy
    `deriveWorkloadCapacity`/`deriveLoadStatus` defaults). Deleting the exports would
    break those surfaces; migrating them is a separate cross-surface follow-up.
    The TL path references none of them (proven by the no-constant scan test).
  - `StackedWorkloadBar.tsx` (shared with the timetable dock) keeps legacy fallback
    behavior when `standardHours` is omitted; TL callers always pass the explicit
    effective standard. Exempted from the scan with an in-code rationale; follow-up
    migrates the timetable caller.
  - Capability-override `getOrCreatePolicy` call sites (list/upsert/delete) and the
    automation/allocation/generation policy resolutions are untouched (mutation paths
    or separate authority, read-only-owned for TL-C01).

## Phase 0 — Reproduce current truth

- T0.1 Read mandatory docs + inspect git status/diff — DONE (2026-09-08).
  - `git status --short`: SCA-03E owns `M atlas-server/src/routes/curriculum-requirements.router.ts`,
    `M docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`,
    `?? atlas-server/src/services/curriculum-decision-candidates.service.ts`. Untouched by TL-C01.
  - TL-DR-01/02/03/04/05/06/06r/06r3/07/08 sequence files exist under
    `docs/prompts/teaching-load-dynamic-recovery-*.md` (earlier read used wrong filenames for 03/05/06; corrected).
  - Backend `faculty-assignment.service.ts` summary builder (lines ~5386-5476) is ALREADY canonical:
    `actualTeachingHours = sectionTeachingHours`, `computeWorkload()` from `workload-policy.service.ts`
    (actual-only utilization, clamped remaining/excess), plus legacy credited fields
    (`policyCreditedHours`, `policyLoadPercentage = credited/max`, `subjectHours = credited`).
  - Backend roster stats (`computeAssignmentSummaryRosterStats`) already use actual teaching. No server change needed.
  - Risk: LOW (read-only). Evidence: this ledger + code citations.
- T0.2 Trace each displayed value to production calculation — DONE.
  - `getFacultyComparableLoadHours()` (`faculty-assignment-helpers.ts:67-72`) falls back to
    `policyCreditedHours ?? subjectHours` (credited) when actual fields absent → overload miscount source (9 vs 7).
  - `deriveWorkloadCapacity()` (`:206-228`) derives status + toStandard/toCap/overStandard/overCap from
    `creditedTotalHours` → advisory creates false overload; 26.25h teaching + 5h advisory reads "At standard".
  - `useTeachingLoadUI.loadProfile.remainingHours` (`useTeachingLoadUI.ts:195`) = `maxHoursPerWeek - creditedTotal`
    → can go negative; uses cap instead of standard.
  - `TeacherGridMode` row shows `policyLoadPercentage` (credited/max) as "Load Status" (`:324`) with hardcoded
    40/30 color breaks (`:385`) → adviser-only 0-teaching shows 17% (300/1800 via maxHours? 5/30=16.7%→17%).
  - `filterStatus` assigned/unassigned counts assignment ROWS, not teaching minutes (`:99-103`).
  - `loadFilter` thresholds hardcoded `>30 / 25-30 / <25` on credited-comparable hours (`:119-123`).
  - Department filter is raw `member.department === departmentFilter` (`:105`).
  - `WorkloadInspector` header "Credited Workload X / maxH" (`:136`), "Remaining" shows negative in rose (`:153-157`).
  - `TeachingLoad.tsx overCapCount` (`:512-515`) already actual-based (> maxHoursPerWeek) — disagrees with
    credited-based row counts shown beside it.
- T0.3 Failing-first focused tests — DONE. New `atlas-client/src/lib/__tests__/teaching-load-canonical-workload.test.ts`
  (15/15 GREEN post-fix; RED pre-fix on missing exports + superseded semantics). Rewrote 3 superseded
  credited-cap assertions in `faculty-assignment-helpers.test.ts` (15/15 GREEN).
  Inventory: no test removed without replacement; superseded expectations rewritten to canonical semantics.
- T0.4 Live dynamic counts — BLOCKED_EXTERNAL unless a read-only probe succeeds; calculation defects are
  data-independent and proven by fixture. Live Tailnet re-verification remains a residual risk.

## Phase 1 — Canonical workload semantics (risk: MEDIUM)

- T1.1 `faculty-assignment-helpers.ts` — DONE.
  - `getFacultyComparableLoadHours` + `getFacultyLoadSortRank`: actual-only (`actualTeachingHours ?? sectionTeachingHours ?? 0`); credited fallbacks removed.
  - `deriveWorkloadCapacity`: status/remaining/excess from actual teaching only; added `resolveTeachingActualHours`, `teachingUtilizationPercentFor`, `isSameDepartment`, `deriveTeachingLoadFacet`, `computeTeachingLoadFacets`.
  - Removed ENG→FIL legacy shortcut in `matchesOwnershipDepartment` (must be explicit policy per TL-DR-03 or removed).
  - No new policy constants introduced; existing `STANDARD_WEEKLY_TEACHING_HOURS`/`MAX_WEEKLY_TEACHING_HOURS` reused; backend persisted policy remains authority (summary rows already carry canonical metrics).
- T1.2 `useTeachingLoadUI.ts` remaining/excess override — DONE (standard-based, clamped; `excessTeachingHours` added; `LoadProfile.excessTeachingHours?` added to `types.ts`).
- T1.3 Tests — DONE (T0.3). Server `workload-policy.test.ts` untouched, 8/8 PASS (no server change needed).

## Phase 2 — Faculty inclusion + department identity (risk: MEDIUM)

- T2.1 Normalized department comparison (`isSameDepartment` both sides) in `filteredFaculty` + `computeTeachingLoadFacets`; explicit `UNMAPPED` department option; `UNASSIGNED DEPARTMENT` group retained and reachable. DONE.
- T2.2 All-view inclusion verified by construction: `useTeachingLoadData.activeFacultyIds` = all summary faculty (no assignment gate); `filteredFaculty` starts from full `faculty` list; negative-control test proves assignment-derived enumeration would drop zero-load faculty while the production path keeps them. DONE.

## Phase 3 — Context-aware filtering (risk: MEDIUM)

- T3.1 Canonical vocabularies: filterStatus `all|teaching-assigned|no-teaching|adviser-only` (actual-minutes based, draft-aware via `effectiveActualHours`); loadFilter `all|below-standard|at-standard|excess` (actual vs standard). DONE.
- Contextual counts (`statusFacetCounts`, `departmentFacetOptions` with counts); zero-count options disabled; impossible selections reset to `all` with `filterAnnouncement` (aria-live `role=status`); active-filter chips + Clear-all (`onClearTeachingLoadFilters`); shadcn Select/Badge/Button only; keyboard-operable rows untouched; no-scroll architecture preserved. DONE.
- Route intent + repair-queue callers migrated (`over-cap→excess`, `missing-load→no-teaching`); `parseRouteIntent` task strings unchanged so existing route-intent tests pass unmodified. DONE.

## Phase 4 — Card + summary semantics (risk: LOW)

- T4.1 WorkloadInspector: primary "Teaching load X / 30h standard", advisory/ancillary as separate credited line, credited total explicitly "not teaching load"; below→nonnegative remaining; at→"At standard 0.0h"; above→"Excess teaching load +Xh" (preferred label); removed local `const STANDARD_WEEKLY_HOURS = 30` duplicate. DONE.
- T4.2 TeacherGridMode rows: `Xh · Y%` teaching utilization with explanatory Tooltip; colors on actual vs standard/max. DONE.
- T4.3 WorkspaceToolbar: new `Excess teaching load: N` chip (actual-based `statusFacetCounts['excess']`, equals row-level canonical count when unfiltered); over-cap chip retained as generation-blocker alert. `TeachingLoad.tsx` wires `excessTeachingCount` + `showExcessTeachingLoad`. StaffingAuditSheet + SectionGridMode candidate badges also moved to actual-based utilization. DONE.

## Phase 5 — Suggested-load diagnostics, read-only (risk: LOW)

- T5.1 Trace completed, no code changed (automation service is read-only-owned). DONE.
  - Pool: `teaching-load-automation.service.ts:1517` fetches ALL active non-stale scheduling mirrors — zero-load faculty ARE in `realFaculty`; no assignment-count gate.
  - Demand: work queue = all teachable pairs minus resolved (`:1688-1722`) — genuinely unassigned pairs enter search.
  - Gates that can exclude a qualified zero-load teacher (data/policy results, NOT TL-C01 defects):
    a) qualification tier null (dept/specialization/alias/`canTeachOutsideDepartment`);
    b) `spareMinutes <= 0` (`:762-764`) — cap minus used minus advisory/ancillary (`resolveRealFacultyCapMinutes`, `:388-396`);
    c) staffing-report simulation skips blank-department faculty (`:766`) and has no cross-dept fallback;
    d) teachable-pair set depends on subject/program-scope configuration — incomplete until SCA-03E/SCA-04 curriculum authority lands.
  - No TL-C01-owned UI filter sits between the suggestion preview and the pool (preview is server-computed); the operator-visibility gap (credited filters hiding zero-load teachers) is fixed by T3.1.
  - Representative code-derived matrix:
    - Filipino, 0h, qualified FIL, spare>0 → INCLUDED (subject/program scope must be configured).
    - Filipino, 0h, blank dept → EXCLUDED (missing canonical dept mapping; persisted alias/policy gap, not TL-C01).
    - Adviser, 0h teaching + 300 advisory → INCLUDED (spare = cap−300).
    - AP adviser 26.3h + 5h advisory → below standard, not a rebalance source (credited "overload" was a UI artifact).
  - Deferred (later allocation pass / SCA): rebalance search quality, Teacher-X handling, curriculum-driven demand completeness.

## Phase 6 — Focused verification (risk: LOW)

- T6.1 Evidence — SUPERSEDED by "Corrected verification evidence" below. Original (non-compliant)
  run is retained for history: canonical 15/15, helpers 15/15, combined 51/51, server workload 8/8,
  client tsc clean, vite build success, diff-check clean, server tsc/build skipped at that time,
  ux-guardrails 153/5 (5 unrelated Subjects failures), live probes blocked.

## TL-C01R — Dynamic-policy and verification-gap closure (same session)

Scope note: TL-C01R items R1–R6 executed here. No new process/validator infrastructure.
No SCA-03E contact. All changes unstaged.

### R1 — Genuinely read-only policy resolver + transitive detector (DONE)

- Removed `ensureSchedulingPolicyColumns()` from `getEffectiveWorkloadPolicy()`: the read path
  now executes exactly one `findUnique`; schema drift returns UNCONFIGURED.
- Replaced the source-string test with a transitive call-graph detector (same-file + imported
  service callees, depth-limited) flagging `$executeRaw*`, model create/upsert/update/delete*,
  `$queryRaw` write keywords, and ensure/migrate calls, with block+line comments stripped.
- Positive controls: detector flags `getOrCreatePolicy` (create + transitive `$executeRawUnsafe`)
  and a synthetic raw-write span.
- Backend effective-policy suite: 56/56 PASS (was 46/46 before R1/R3 additions).

### R2 — Workload-bar actual-hours rendering (DONE)

- `resolveWorkloadBarState` (helpers, pure): width/tone/marker/excess/over-cap from ACTUAL
  teaching vs explicit standard; credit widens only a neutral slate segment; unknown standard →
  `unconfigured` tone with no marker and honest copy. Component consumes it; required `maxHours`,
  optional `standardHours` (timetable dock caller compiles unchanged, renders unconfigured).
- Legacy constant fallback REMOVED from the bar; bar added to the no-constant scan (passes).
- Visual proof: 26.3+5 → below-standard, teaching 65.75% / credit 12.5% / marker 75%;
  credit 5→15 never changes tone; 37.5 → excess 7.5; 41 → over-cap.

### R3 — Persisted department authority (DONE)

- Backend: `loadCanonicalDepartmentMap` (one batched `Promise.all` over persisted
  `DepartmentAlias` + `DepartmentLabel`), pure `resolveCanonicalDepartmentIdentity`
  (alias hit → code, exact code hit → code, else UNMAPPED; no keyword/prefix inference),
  per-row `departmentCode/departmentLabel/departmentStatus` in the summary (4th member of the
  existing `Promise.all`, still set-based, no N+1).
- Client: filters/grouping/labels compare the server-supplied code with exact equality;
  client alias table no longer authorities the TL path (legacy `isSameDepartment` retained
  for out-of-tree callers only); cache prefix bumped v4→v5 to invalidate code-less snapshots.
- Negative controls: server alias set A vs B/retarget flips Filipino FIL↔UNMAPPED↔ENG with no
  rebuild; client regroup test proves data-driven regrouping.
- LIVE DATA FINDING (read-only probe): `department_aliases`/`department_labels` are EMPTY for
  school 1 → all 42 faculty resolve UNMAPPED live (raw codes FIL/SCI/MATH/ESP/TLE/ENG/AP/MAPEH
  present but unmapped). Per the R3 contract this is correct behavior, but department filtering
  stays single-bucket until alias/label rows are configured — REQUIRED data-remediation
  follow-up with explicit approval (no code invention; no seed/migration performed here).

### R4 — Count/row equality contract (DONE)

- `computeTeachingLoadFacets` returns statusCounts (base: dept+load+search), loadCounts (base:
  dept+status+search), departmentCounts (base: status+load+search). `No teaching load` includes
  ALL zero-teaching faculty; `Adviser only` is its subset (counted + filterable as subset).
- New pure `applyTeachingLoadFilters` shared by the hook and tests: every displayed option count
  was proven equal to its resulting rows (status × load × department + Filipino contextual sets).
- Hook grouped grid by server code/label; grid labels updated (subset annotation).

### R5 — Actor school + dynamic year (DONE)

- `DEFAULT_SCHOOL_ID = 1` REMOVED from `useTeachingLoadData.ts` and `TeachingLoad.tsx`.
- Actor school resolves via `/auth/me` (`resolveActorSchoolId`) through pure enforced
  `teachingLoadScopeParams` (typed SCHOOL_UNRESOLVED/SCHOOL_YEAR_UNRESOLVED, never falls back);
  all fetches, cache keys, saves, resets, suggestions, staffing reports, and split-brain checks
  use the resolved school. Unresolved actor → explicit error state.
- `Build 2026-2027 …` literal REMOVED; guided message uses pure
  `buildGuidedEmptyTeachingLoadMessage(activeSchoolYearLabel)` (generic fallback, no literal).
- Wider runtime chain (`fetchAtlasRuntimeContext(1,…)`, cache `schoolId: 1`) is shared
  infrastructure outside TL scope — left untouched; TL path does not depend on it for school.
- Tests: scope-params unit + typed-throw negative control + label interpolation + hardcode scan.

### R6 — Current evidence (DONE, read-only)

- Read-only probe (TEMP script, SELECT-only `findMany` + production pure functions, deleted after;
  repo probe file also deleted): school 1, active year 8 (2029-2030, synced).
  - ACTIVE_FACULTY=42, ASSIGNED=37, ZERO=5, ADVISER_ONLY=5, BELOW=32, AT=3, EXCESS=7 —
    reproduces the TL-DR baseline exactly (no 42/7/9/5 assumption; independently recomputed).
    Zero/adviser sets are pair-presence exact; minutes via production rotation-peak semantics
    (generated client lacks rotationTerm* columns — modular-order fallback; stated caveat).
  - POLICY CONFIGURED persisted {1800, 300, 2400} via the production resolver.
  - FIL_ALL=0 / FIL_ASSIGNED=0 / FIL_ZERO=0 BECAUSE alias tables are empty (all 42 UNMAPPED);
    raw FIL faculty exist (AGUILAR, CASTILLO, DE LEON, Escarez, …). See R3 data finding.
- Ephemeral UI (fresh `vite build` served via `vite preview` on isolated port 5199; killed after;
  port 5001 untouched; combined worktree NOT deployed): Playwright/Chromium matrix —
  desktop 1366×768 login/shell renders, mobile 390×844 login renders, `/teaching-load`
  unauthenticated guard renders with keyboard Tab reaching controls, 200%-zoom equivalent
  renders; ZERO horizontal overflow on all four; ZERO app errors (only expected 401 API guards
  without a session). Screenshots in TEMP. Authenticated-grid QA still requires Tailnet.

### R-gates evidence (this worktree)

- Client focused: 65/65 PASS, exit 0 (canonical incl. 12 negative controls + helpers 15 + route-intent 21).
- Server effective-policy: 56/56 PASS. Server workload-policy: 8/8 PASS.
- Client `tsc --noEmit`: clean. Server `tsc --noEmit`: clean.
- Single client build AFTER all corrections: success (`vite build`, one invocation).
  Server has no build script beyond `tsc` (already clean).
- `git diff --check`: clean.
- Full `test:ux-guardrails` re-run NOT repeated (unchanged since the earlier 153/5 run with 5
  unrelated Subjects failures on untouched files; no TL file affects those scans).

## Changed-file inventory (TL-C01R cumulative, unstaged; SHA-256 at R-gates time)

- `atlas-client/src/lib/faculty-assignment-helpers.ts` — C6CFBFF3
- `atlas-client/src/hooks/useTeachingLoadUI.ts` — C54AAF47
- `atlas-client/src/hooks/useTeachingLoadData.ts` — 14ACDA95
- `atlas-client/src/hooks/useTeachingLoadRouteIntent.ts` — 184E6368 (unchanged)
- `atlas-client/src/pages/TeachingLoad.tsx` — D7518DCF
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` — D0BB63E3
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx` — 2F234882 (unchanged by R)
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx` — 0FDBE68F (unchanged by R)
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` — 7DCB78F6 (unchanged by R)
- `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx` — 93A9CC31 (unchanged by R)
- `atlas-client/src/components/faculty-assignments/StackedWorkloadBar.tsx` — 30836D28
- `atlas-client/src/types.ts` — 54E52AB1
- `atlas-client/src/lib/faculty-teaching-load-cache.ts` — CCAC4603
- `atlas-client/src/lib/__tests__/faculty-assignment-helpers.test.ts` — BD2FF47C (unchanged)
- `atlas-client/src/lib/__tests__/teaching-load-canonical-workload.test.ts` — 719F1011
- `atlas-server/src/services/faculty-assignment.service.ts` — 3F29AFFB
- `atlas-server/src/services/scheduling-policy.service.ts` — F8935A57
- `atlas-server/src/routes/faculty-assignment.router.ts` — FEA62761 (unchanged by R)
- `atlas-server/src/__tests__/teaching-load-effective-workload-policy.test.ts` — 3C86C658
- `atlas-server/src/services/workload-policy.service.ts` — UNCHANGED.
- Ledger + `docs/reviews/teaching-load-corrective-parallel-2026-09-08/` (gitignored paths).
- NOT TL-C01 (concurrent streams, untouched): `atlas-client/src/App.tsx`,
  `atlas-client/src/pages/CurriculumRequirements.tsx`,
  `atlas-server/src/routes/curriculum-requirements.router.ts`,
  `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`,
  untracked `atlas-server/src/services/curriculum-decision-candidates.service.ts`,
  `atlas-client/src/pages/DecisionWorkspace.tsx`, `atlas-client/src/components/decision-workspace/`,
  `atlas-client/src/lib/decision-draft.ts`, `letter-for-facebook-page.docx`.

## TL-C01R2 — Final source closure and department remediation preview (same session)

Scope note: TL-C01R2 items 1–6 executed here. No new process/validator infrastructure.
No SCA-03E contact. All changes unstaged.

### R2-1 — Advisory policy authority (DONE)

- New `resolveAdvisoryCreditHours(member, policy)`: valid adviser
  (`isClassAdviser`, validity decided server-side) → persisted effective
  `advisoryCreditMinutes`; otherwise 0. The EnrollPro mirror field
  `advisoryEquivalentHours` is display-only and never overrides policy — no ATLAS
  per-faculty advisory override model exists in schema (verified), so policy-only
  is the honest precedence. Both `||` sites (hook loadProfile, page hover) migrated.
- Backend summary builder: valid-adviser `advisoryHours` now derives from the resolved
  effective policy (UNCONFIGURED → 0); mirror field remains a passthrough display fact.
- Tests: policy-wins-over-mirror (4h mirror vs 5h policy → 5h), non-adviser zero,
  persisted-advisory change flows without rebuild, advisory-only change alters credited
  workload with utilization/remaining/excess/status invariant.

### R2-2 — Projected workload bar (DONE)

- `resolveWorkloadBarState` gains `incomingTeachingHours` → `projectedTeachingHours`,
  `projectedTone`, `projectedOverCap` computed from actual+incoming TEACHING only.
  Component ghost/ring/aria/legend project from teaching; credit stays neutral.
- Negative control: 26h + 5h advisory + 1h incoming → projected 27h below-standard,
  never the buggy 32h credited warning; current tone unaffected by credit/incoming.

### R2-3 — Persisted department labels (DONE)

- Hook facet options now use the server `departmentLabel` verbatim (glossary re-mapping
  removed from the TL path). Custom-label test: 'Filipino (Mother Tongue)' surfaces
  without rebuild. Groups/rows already used server labels.

### R2-4 — Passive cycle reads + live zero-write instrumentation (DONE)

- New `readTeachingLoadCycleSource`: existing → serialized as-is; missing → typed
  UNCONFIGURED source; state/observed mismatch → `CYCLE_STATE_MISMATCH` diagnostic, never
  repaired on GET. Creation/version updates remain on ensure/refresh (mutation paths only).
- Summary GET switched to it; return + route gain additive `cycleDiagnostic`;
  `EffectiveTeachingLoadSourceV2.state` widened additively (`tsc` union fix, v2 contract
  suite 140/140 still green).
- Static detector extended: summary entry must also have zero teachingLoadCycle
  writes and zero ensure/refresh references (passes).
- LIVE route proof (`teaching-load-summary-zero-write-route.test.ts`, 12/12 PASS):
  real `getAssignmentSummary(1,8)` through the exact production path via
  `withDataContext` + `$extends` interception — ZERO writes across all models
  (10 reads observed), contract fields present. (`$use` is unavailable in this
  generated client; `$extends` proven working.)
- Positive control: no-op `schedulingPolicy:update` inside a rolled-back transaction —
  recorder observed the real write; persisted values verified unchanged afterward.

### R2-5 — Department remediation preview (DONE, read-only, no mutation)

- TEMP SELECT-only generator (deleted after run; repo script file also deleted; verified
  no stray tmp files): distinct faculty departments (8 code-shaped raws), existing
  alias/label rows (0), subject ownership codes, prefix rows, permission counts.
- Artifact: `docs/reviews/teaching-load-corrective-parallel-2026-09-08/department-remediation-preview-1254230c7809.json`
  SHA-256 `1254230c78090251f7e0a9f4292dd0d15d7968d71271341d3edeeea89e7a70bb` —
  8 proposed identity aliases + 8 labels (all `approved:false`), exact rollback
  delete-rows, before/after values, affected counts, 0 unresolved. Familiar
  equivalences (Filipino→FIL) listed as UNDECIDED operator options, never pre-selected.
  `authorizesMutation:false`. Live alias/label tables remain EMPTY (no rows written).

### R2-6 — Focused gates (this worktree)

- Client canonical: 69/69 PASS (incl. 19 negative controls). Helpers + route-intent included.
- Server effective-policy: 56/56 PASS. Server workload-policy: 8/8 PASS.
- Server zero-write route (live): 12/12 PASS. Server v2 contract: 140/140 PASS.
- Client `tsc --noEmit`: clean. Server `tsc --noEmit`: clean (after additive union fix).
- `git diff --check`: clean (CRLF notices only). No build per R2 gate list (single R-build
  already taken; R2 changed sources after it — recorded; ephemeral R6 UI evidence covered
  shell/overflow/keyboard unaffected by R2 logic deltas).
- R6 live counts (42/37/5/5/32/3/7, policy CONFIGURED, FIL 0/0/0 with 42 UNMAPPED) stand as
  current evidence with stated caveats.

## Changed-file inventory (TL-C01R2 cumulative, unstaged; SHA-256 at R2-gates time)

- `atlas-client/src/lib/faculty-assignment-helpers.ts` — DC244B11
- `atlas-client/src/hooks/useTeachingLoadUI.ts` — 33973AF5
- `atlas-client/src/hooks/useTeachingLoadData.ts` — 14ACDA95 (unchanged by R2)
- `atlas-client/src/hooks/useTeachingLoadRouteIntent.ts` — 184E6368 (unchanged)
- `atlas-client/src/pages/TeachingLoad.tsx` — 9B6B859C
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` — D0BB63E3 (unchanged by R2)
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx` — 2F234882 (unchanged by R2)
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx` — 0FDBE68F (unchanged by R2)
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` — 7DCB78F6 (unchanged by R2)
- `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx` — 93A9CC31 (unchanged by R2)
- `atlas-client/src/components/faculty-assignments/StackedWorkloadBar.tsx` — D304EFF5
- `atlas-client/src/types.ts` — 54E52AB1 (unchanged by R2)
- `atlas-client/src/lib/faculty-teaching-load-cache.ts` — CCAC4603 (unchanged by R2)
- `atlas-client/src/lib/__tests__/faculty-assignment-helpers.test.ts` — BD2FF47C (unchanged)
- `atlas-client/src/lib/__tests__/teaching-load-canonical-workload.test.ts` — B63D83A8
- `atlas-server/src/services/faculty-assignment.service.ts` — B613EBC2
- `atlas-server/src/services/scheduling-policy.service.ts` — F8935A57 (unchanged by R2)
- `atlas-server/src/services/teaching-load-cycle.service.ts` — AB0AB52D
- `atlas-server/src/routes/faculty-assignment.router.ts` — 6464E10E
- `atlas-server/src/__tests__/teaching-load-effective-workload-policy.test.ts` — EB3056BE
- `atlas-server/src/__tests__/teaching-load-summary-zero-write-route.test.ts` — 0189A318 (NEW, live-DB)
- `atlas-server/src/services/workload-policy.service.ts` — UNCHANGED.
- Preview artifact (gitignored): `docs/reviews/teaching-load-corrective-parallel-2026-09-08/department-remediation-preview-1254230c7809.json`.
- NOT TL-C01 (concurrent streams, untouched): `atlas-client/src/App.tsx`,
  `atlas-client/src/pages/CurriculumRequirements.tsx`,
  `atlas-server/src/routes/curriculum-requirements.router.ts`,
  `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`,
  untracked `atlas-server/src/services/curriculum-decision-candidates.service.ts`,
  `atlas-client/src/pages/DecisionWorkspace.tsx`, `atlas-client/src/components/decision-workspace/`,
  `atlas-client/src/lib/decision-draft.ts`, `letter-for-facebook-page.docx`.

## TL-C01R4 — Department authority production apply path (workflow only, no mutation)

Operator decision recorded: approve 8 DepartmentLabel rows + 0 aliases from decision
`5147D2ADEF09822134F420179E074584245CDCE0644236F78FF4D66B3A85EFE3`. This authorizes
workflow implementation ONLY — no row application, no direct SQL, no mutation,
no deployment, no TL-C02. ATLAS source only; SCA-03E untouched.

### R4.0 — Preflight (DONE, read-only)

- Decision hash recomputed via shared `canonicalHash()`: match (`5147D2A…`).
- Decision content: 8 labels, 0 aliases. Live tables verified empty before AND after
  all R4 work (`LIVE_ALIASES=0 LIVE_LABELS=0` post route-tests).
- Target: school 1, active year 8 (2029-2030, synced); local Postgres per server `.env`.
- Changed-file boundaries recorded below. All work unstaged.

### R4.1 — Production service (DONE)

- NEW `atlas-server/src/services/department-authority.service.ts`: read/list, deterministic
  preview, fingerprinted apply, before/after + rollback receipt. Actor-school scope
  (403 on conflict), exact confirmation constant, fingerprint/source-revision 409s,
  one Serializable transaction with in-tx re-read + revalidation, whole-tx abort on
  conflict, exact matches as no-op (replay path opens NO transaction), writes only the
  two department tables, ESM-safe `.js` imports, shared canonical hashing.

### R4.2 — Transport-only routes (DONE)

- `faculty-assignment.router.ts` (+ existing mount, no `app.ts` change):
  `GET /department-authority`, `POST /department-authority/preview`,
  `POST /department-authority/apply` — all `authenticateWithSystemToken` +
  `requirePrivilegedRole`, param validation, actor-school 403, service errors via
  `next(err)`. Registration order safe (static paths before `/:facultyId`).

### R4.3 — Focused tests (DONE, 37/37, zero residue)

- NEW `department-authority-apply.test.ts` on a disposable fixture school
  (`TL-C01R4 FIXTURE SCHOOL — SAFE TO DELETE`, removed in `finally` with count
  proof aliases=0/labels=0/school=0): exact 8-create/0-alias preview; order-independent
  fingerprint; 400/409/403 zero-write gates (confirmation, forged fingerprint,
  cross-school, drift); conflict whole-tx abort with pre-state intact; concurrent
  drift 409; apply writes only `DepartmentLabel:create` ×8 scoped to fixture;
  idempotent replay with zero writes; rollback receipt scoped to created rows;
  forbidden-model write scan clean; recorder negative control (direct create flagged).
- Live DB touched ONLY by fixture create/delete cycles (authorized disposable-fixture
  pattern); live school 1 data untouched (verified 0/0 after).

### R4.4 — Fresh live preview only (DONE, no apply)

- Production `previewDepartmentAuthority(1, 8 labels)` live: 8 label creates, 0 aliases,
  fingerprint `3CFAE3A18AD4487B63EA1F8D5EB7E2FA0C71BA70BB569DBF959C2690669BF1B1`;
  counts 0/0 before AND after (DB unchanged).
- Apply artifact: `D:/ATLAS/docs/verification/department-authority-apply-3978787df101.json`
  SHA-256 `3978787DF101B68D650203D209A4222A355068627DDBD79FB29916B735D0888E`
  + `.sha256` sidecar (independently recomputed: EMBEDDED + SIDECAR match).
  Contains exact rows, rollback deletes, source revision, and the exact ASCII approval
  sentence: `APPROVE APPLY 5147D2ADEF09822134F420179E074584245CDCE0644236F78FF4D66B3A85EFE3: create the 8 DepartmentLabel rows for school 1 exactly as fingerprinted.`
- Fingerprint NOT applied. Generator scripts deleted (verified no strays).

### R4.5 — Focused verification (this worktree)

- New suite 37/37; effective-policy 56/56; workload-policy 8/8; v2 contract 140/140;
  client canonical 69/69 (helpers + route-intent included).
- Server `tsc --noEmit`: clean (incl. additive v2-union fix + rollback annotation fix).
  Client `tsc`: clean.
- Single server build (`npm run build` = tsc emit, gitignored dist).
- Built-server smoke on isolated port 5099: `/api/v1/health` 200; live route matrix
  7/7 (GET 200, preview 200 with 8/0, typed 400 INVALID_PARAM/INVALID_DEPARTMENT_AUTHORITY/
  CONFIRMATION_REQUIRED, 409 FINGERPRINT_MISMATCH); server killed after; port 5001 untouched.
- `git diff --check`: clean. No unrelated matrices.

## Changed-file inventory (TL-C01R4 cumulative, unstaged; SHA-256 at R4-gates time)

- `atlas-server/src/services/department-authority.service.ts` — 498728EF (NEW)
- `atlas-server/src/routes/faculty-assignment.router.ts` — 554EE9E5
- `atlas-server/src/__tests__/department-authority-apply.test.ts` — 28A2E40C (56/56 incl. validation edges)
- `atlas-server/src/services/faculty-assignment.service.ts` — B613EBC2 (R2 changes; unchanged by R4)
- `atlas-server/src/services/scheduling-policy.service.ts` — F8935A57 (unchanged by R4)
- `atlas-server/src/services/teaching-load-cycle.service.ts` — AB0AB52D (unchanged by R4)
- `atlas-server/src/__tests__/teaching-load-effective-workload-policy.test.ts` — EB3056BE (unchanged by R4)
- `atlas-server/src/__tests__/teaching-load-summary-zero-write-route.test.ts` — 0189A318 (unchanged by R4)
- Client TL files/tests — unchanged by R4 (hashes as in TL-C01R2 inventory).
- Apply artifact + sidecar (gitignored docs/verification).
- NOT TL-C01 (concurrent streams, untouched): `atlas-client/src/App.tsx`,
  `atlas-client/src/pages/CurriculumRequirements.tsx`,
  `atlas-server/src/routes/curriculum-requirements.router.ts`,
  `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`,
  untracked `atlas-server/src/services/curriculum-decision-candidates.service.ts`,
  `atlas-client/src/pages/DecisionWorkspace.tsx`, `atlas-client/src/components/decision-workspace/`,
  `atlas-client/src/lib/decision-draft.ts`, `letter-for-facebook-page.docx`.

## TL-C01R4B — Normalize the department-authority apply boundary (no mutation)

Authorized edits: faculty-assignment.router.ts + department-authority-gates.test.ts +
TL artifacts only. No live rows applied. No TL-C02. SCA-03E untouched.

### Change

- Apply handler previously parsed schoolId via `parseStrictPositiveInt` but passed
  `req.body?.schoolId` (raw) into `applyDepartmentAuthority` — validating one value,
  passing another. Corrected to pass the already validated/normalized `schoolId`.
  Preview and GET handlers audited (they pass parsed values positionally — no defect).
- RED→GREEN: a numeric-string schoolId on the apply route previously hit the service's
  typed 400 (raw string rejected) — the new real-route proof (numeric-string preview and
  apply succeed with one fingerprint + eight rows) genuinely discriminates the boundary.

### Real-route proofs added to gates suite (now 82/82)

- numeric-string schoolId has identical contract on preview and apply (one fingerprint,
  200 + 8 created rows);
- empty/idempotent apply exercises the route with `replayed:true` and zero writes (0/0 rows);
- fractional/infinite/junk/zero/negative/empty/missing schoolId → 400 INVALID_PARAM;
  cross-school → 403 SCHOOL_MISMATCH; missing-actor → 403 ACTOR_SCHOOL_REQUIRED;
  system-token → 401 — all on the apply route;
- live school-1 tables 0/0 and fixture residue 0/0/0 after all fixtures.

### Gates (this worktree)

- gates 82/82; apply 63/63; server `tsc --noEmit` clean; `npm run build` exit 0;
  `git diff --check` clean. (Transient dashboard-lifecycle tsc noise from a concurrent
  stream cleared on rerun.)

### Semantic preview validity

- Service file byte-identical to R4A (27495D68); artifact `department-authority-apply-r4a.json`
  unchanged (byte SHA D1D8E74E…); E9/E10 service-recomputed fingerprint === D99894F1…
  re-proven. R4B did not touch fingerprint/revision/apply logic.
  **Existing semantic preview remains VALID — no regeneration required.**

### Advisory review

- T7.8 reviewer ses_f7eb8de0dffe22f04BcjF0GWDQ → advisory-review-08.md, zeroFix:true.
  Delta = exactly the two authorized files; reruns green; boundary confirmed.

## TL-C01R4A — Department authority apply integrity gaps (correction pass, no mutation)

Seven verified defects corrected. No live rows applied. No TL-C02. SCA-03E untouched.

### RED (failing-first, recorded before fixes)

New gate suite run against unfixed code: 5 failures — `parseStrictPositiveInt`
not exported; preview/apply with missing actor school did NOT throw (fail-open,
apply returned 409/SOURCE_DRIFT instead of 403); `revisionHash` absent;
`revalidatedInTransaction` absent. All turned GREEN after the fix.

### A — Operator authentication and school scope (DONE)

- POST preview/apply routes now use normal JWT `authenticate` (operator preview/apply).
  System-token-only application returns 401 (no machine-mutation contract invented).
- Service requires positive-integer actor school: missing → 403 ACTOR_SCHOOL_REQUIRED;
  mismatch → 403 SCHOOL_MISMATCH. GET retains documented integration-token read access
  (read-only; school isolation explicitly tested: cross-school rows never leak).
- Strict `parseStrictPositiveInt` (exported, unit-tested): fractional/Infinity/junk/
  zero/negative/empty/non-numeric → typed 400 (no floor-coercion, unlike the legacy helper).

### B — Canonical source revision (DONE)

- `revisionHash = canonicalHash({schemaVersion TL-C01R4A.1, schoolId, sorted normalized
  alias/department + code/label pairs})`. Counts/maxCreatedAt remain diagnostic only.
- In-place value change flips the hash with identical counts (proven); count-only
  tampering does NOT gate (proven). Fingerprint binds the hash-bearing revision.

### C — Transactional apply and replay (DONE)

- Single Serializable transaction: re-read → revision recompute/compare → fingerprint
  recompute/compare → classify → atomic abort → create-only → receipt. Replay succeeds
  only after in-tx checks (`revalidatedInTransaction:true`, zero writes, no pre-tx return).
- P2034 → typed 409 TRANSACTION_CONFLICT (re-preview + retry, no partial writes).
  No bounded retry (no ATLAS precedent; STALE_WRITE-style 409 pattern followed instead).

### D — Approval authority and artifact hashing (DONE)

- `3978787D` artifact + decision-bound approval sentence SUPERSEDED (marker sidecar;
  files preserved). Defects: wrong authority binding + semantic-vs-byte SHA ambiguity.
- Replacement: `D:/ATLAS/docs/verification/department-authority-apply-r4a.json`
  - preview fingerprint `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`
    (the exact value the endpoint accepts);
  - semantic payload hash `EAF49D08141E9B2F37E685D1B94A93BEA1B66E7D620755C37CFAAC6E352950BE`
    (canonicalHash of `.semanticPayload`);
  - byte SHA-256 `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF`
    (exact file bytes; file carries NO self-hash — sidecar pattern);
  - sidecar documents all three meanings explicitly.
  - approval sentence: `APPROVE PREVIEW D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A: create the 8 DepartmentLabel rows for school 1 exactly as fingerprinted by the department-authority preview endpoint.`
  - Verified: byte recompute match, semantic recompute match, approval binds preview fp,
    8 labels / 0 aliases, tables still 0/0 (NOT applied).
- No approval requested in this pass.

### E — Negative controls + focused gates (this worktree)

- Gates suite (`department-authority-gates.test.ts`): 54/54 PASS — E1 system-token 401s,
  E2 403 ACTOR_SCHOOL_REQUIRED, E3 403 SCHOOL_MISMATCH, E4 12 malformed-ID 400s,
  E5 in-place flip + stale 409 + zero writes, E6/E7 drift 409s + zero writes,
  E8 replay zero-write + revalidated flag, E9 byte/sidecar match, E10 approval==preview-fp,
  recorder sensitivity, zero-residue fixture.
- Apply suite: 63/63 PASS (incl. 19 validation edges + tamper-proof + conflict mapper).
- Effective-policy 56/56, workload-policy 8/8, v2 contract 140/140 (rerun).
- Server `tsc`: clean. Server build (`tsc` emit, gitignored dist): success.
- `git diff --check`: clean. No broad matrices. No client changes in R4A.

## Changed-file inventory (TL-C01R4A cumulative, unstaged; SHA-256)

- `atlas-server/src/services/department-authority.service.ts` — 27495D68 (A+B+C)
- `atlas-server/src/routes/faculty-assignment.router.ts` — 1BD576C8 (R4B normalize-once)
- `atlas-server/src/__tests__/department-authority-apply.test.ts` — 488C3B54 (contract migration)
- `atlas-server/src/__tests__/department-authority-gates.test.ts` — 9E2DC26E (82/82 incl. R4B route proofs + E9/E10)
- Prior TL files/tests — unchanged by R4A (hashes as in R4 inventory).
- Replacement artifact + sidecar + supersede marker (gitignored docs/verification).
- NOT TL-C01: SCA-03E set unchanged (see standing list).

## Phase 7 — Advisory review

- T7.1 (`advisory-review-01.md`) — SUPERSEDED. T7.2 (`advisory-review-02.md`) — SUPERSEDED.
- T7.3 (`advisory-review-03.md`, zeroFix:true) — SUPERSEDED by TL-C01R2 corrections.
- T7.4 Fresh TL-C01R2 changed-scope review — DONE, zero material findings.
  - Reviewer task: ses_f804155b7ffeYH4zgKa5ySnsnv. Artifact: `advisory-review-04.md`
    (reviewer-written; implementer made no edits to it).
  - All recomputed hashes match the cumulative inventory exactly.
  - All gates independently rerun green (server 56/56 + 12/12 live + 8/8 + v2 140/140,
    client 69/69, both tsc clean).
  - Items 1–6 verified from source; adversarial probes re-derived and passing.
  - Boundary confirmed (no SCA contact, no schema/migration, nothing staged, no restart,
    no live mutation by reviewer; generator/probe/dbg scripts absent from the repo).
  - Process observations (follow-ups, NOT required fixes):
    - P-01 fingerprint canonicalization — CLOSED by implementer: preview SHA-256 reproduces
      exactly as `SHA256_HEX(JSON.stringify(previewMinusSha256))`, compact separators,
      insertion order (verified match of stored `1254230c…89e7a70bb`).
    - P-02 `**/__tests__/` gitignored convention (hashes recorded here).
    - P-03 concurrent-stream worktree sharing isolated by hash match.
    - P-04 no reviewer spawn ID supplied (independence basis recorded instead).
  - Verdict: zeroFix:true (advisory only, no formal GO). Loop closed per the
    zero-material-finding rule; no further review iteration required.
- T7.5 Fresh TL-C01R4 changed-scope review — DONE, zero material findings.
  - Reviewer task: ses_f7fa4ac5fffeW6ZGNe6NgVASCl. Artifact: `advisory-review-05.md`
    (reviewer-written; implementer made no edits to it).
  - All recomputed hashes match; all gates independently rerun green (apply 37/37,
    effective-policy 56/56, zero-write 12/12, workload 8/8, client 69/69, both tsc).
  - R4.0–R4.5 verified; adversarial probes re-derived and passing; live tables 0/0
    before AND after (fingerprint NOT applied); boundary confirmed.
  - Post-review implementer addition: 19 validation-edge assertions (blank/duplicate/
    overlong/non-array/non-string + empty-preview fingerprint), suite now 56/56.
    Test-only strengthening of a reviewer-suggested edge, all green, no source change.
  - Verdict: zeroFix:true (advisory only, no formal GO). Loop closed per the
    zero-material-finding rule; no further review iteration required.

## Task-review log

- T7.1 reviewer ses_f80f2960bffer1RGIe0BoOrCWb → advisory-review-01.md, zeroFix:true — SUPERSEDED
  (non-compliant scope; missed the dynamic-policy boundary the planner then corrected).
- T7.2 reviewer ses_f80d7b864ffe7qiHdTH7IoJm0V → advisory-review-02.md, zeroFix:true on the
  CORRECTED scope — SUPERSEDED by TL-C01R corrections.
- T7.3 reviewer ses_f808a0906ffetvJ1dlFUp10R5y → advisory-review-03.md, zeroFix:true on the
  TL-C01R scope — SUPERSEDED by TL-C01R2 corrections.
- T7.4 reviewer ses_f804155b7ffeYH4zgKa5ySnsnv → advisory-review-04.md, zeroFix:true on the
  TL-C01R2 scope — SUPERSEDED by TL-C01R4 corrections.
- T7.5 reviewer ses_f7fa4ac5fffeW6ZGNe6NgVASCl → advisory-review-05.md, zeroFix:true on the
  TL-C01R4 scope. No material findings; no fixes; loop closed.
- T7.6 Fresh TL-C01R4A changed-scope review — DONE (advisory-review-06.md, zeroFix:false
  solely over docs finding F-01: ledger claimed executable E9/E10 assertions the gates
  suite lacked; no product defect).
- T7.7 F-01 closure + delta re-review — DONE, zero material findings.
  - Implementer added real executable E9 (byte/sidecar + no-self-hash) and E10
    (service-recomputed preview fp + approval binding + authorizesMutation:false)
    assertions; gates suite 59/59, server tsc clean. Test-only delta, no source change.
  - Reviewer task: ses_f7f5889abffe5KkMu1CdE8GQAA. Artifact: `advisory-review-07.md`.
    Gates-file hash 228BE876 verified; 59/59 rerun green; isolation confirmed
    (all other files SHA-identical to review-06; SCA untouched).
  - Verdict: zeroFix:true (delta scope). F-01 CLOSED. Loop complete.

## Changed-file inventory (TL-C01 only, unstaged; SHA-256 at CORRECTED verification time)

- `atlas-client/src/lib/faculty-assignment-helpers.ts` — 3631408C
- `atlas-client/src/hooks/useTeachingLoadUI.ts` — A7DD0BBD
- `atlas-client/src/hooks/useTeachingLoadData.ts` — 6A4115F8
- `atlas-client/src/hooks/useTeachingLoadRouteIntent.ts` — 184E6368 (unchanged by correction)
- `atlas-client/src/pages/TeachingLoad.tsx` — 467CF9DD
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` — 50CA92D0
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx` — 2F234882
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx` — 0FDBE68F
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` — 7DCB78F6
- `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx` — 93A9CC31
- `atlas-client/src/components/faculty-assignments/StackedWorkloadBar.tsx` — 6E0CAE67 (additive optional `standardHours`; legacy fallback documented exemption)
- `atlas-client/src/types.ts` — D7ABF427 (row derived fields honestly `number | null`)
- `atlas-client/src/lib/faculty-teaching-load-cache.ts` — F766DCBB (contract additions + strict normalization)
- `atlas-client/src/lib/__tests__/faculty-assignment-helpers.test.ts` — BD2FF47C (legacy tests, unchanged)
- `atlas-client/src/lib/__tests__/teaching-load-canonical-workload.test.ts` — FB954812 (rewritten policy-parametric)
- `atlas-server/src/services/faculty-assignment.service.ts` — 65B094BF (correction-authorized read path)
- `atlas-server/src/services/scheduling-policy.service.ts` — 8B998C12 (read-only resolver)
- `atlas-server/src/routes/faculty-assignment.router.ts` — FEA62761 (additive passthrough)
- `atlas-server/src/__tests__/teaching-load-effective-workload-policy.test.ts` — 4E1DB8D0 (NEW, hermetic)
- `atlas-server/src/services/workload-policy.service.ts` — UNCHANGED.
- Ledger itself (gitignored `docs/` path) + review dir `docs/reviews/teaching-load-corrective-parallel-2026-09-08/`.
- NOT TL-C01 (concurrent streams, untouched): `atlas-client/src/App.tsx`,
  `atlas-client/src/pages/CurriculumRequirements.tsx`,
  `atlas-server/src/routes/curriculum-requirements.router.ts`,
  `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`,
  untracked `atlas-server/src/services/curriculum-decision-candidates.service.ts`,
  `atlas-client/src/pages/DecisionWorkspace.tsx`, `atlas-client/src/components/decision-workspace/`,
  `atlas-client/src/lib/decision-draft.ts`, `letter-for-facebook-page.docx`.

## Corrected verification evidence (2026-09-08, this worktree)

- Client focused: 55/55 PASS, exit 0 (canonical 19 incl. 8 negative controls + helpers 15 + route-intent 21).
- Server effective-policy: 46/46 PASS, exit 0. Server workload-policy (unchanged): 8/8 PASS.
- Client `tsc --noEmit`: clean, exit 0. Server `tsc --noEmit`: clean, exit 0.
- Client production build (`vite build`): success, exit 0. `git diff --check`: clean.
- Browser QA: BLOCKED_EXTERNAL (no live probe; port-5001 restart forbidden). Static substitute:
  no-scroll architecture intact, `role=status aria-live` announcement + `teaching-load-active-filters`
  chips + `teaching-load-alert-excess` + `teaching-load-policy-readiness` +
  `teaching-load-profile-readiness` testids verified present; keyboard handlers untouched; shadcn only.
- Full `test:ux-guardrails`: 153 pass / 5 fail — all 5 are Subjects/setup-page source-scan guardrails
  (#32, #87, #89, #90, #91) on files TL-C01 never touched (concurrent SCA stream). Unrelated, unrepaired.
- Live dynamic counts + live Tailnet proof: BLOCKED_EXTERNAL residual risks for formal QA.

## Task-review log

- (append per task: reviewer context, findings, fixes)

## Phase-review log

- (append per phase)

## TL-C01R3 — Department authority decision preview (read-only correction pass)

Verdict boundary: read-only. No inserts/updates/deletes/seeds/migrations/restarts/deploys.
TL-C02 not begun. Zero source files changed in R3 (`git diff --check` clean).

### Rejected preview

- `docs/reviews/teaching-load-corrective-parallel-2026-09-08/department-remediation-preview-1254230c7809.json`
  SHA-256 `1254230c78090251f7e0a9f4292dd0d15d7968d71271341d3edeeea89e7a70bb`
  is marked SUPERSEDED_NON_APPLICABLE via sidecar marker
  `department-remediation-preview-1254230c7809.SUPERSEDED_NON_APPLICABLE`
  (rejected JSON preserved unmodified for audit). Defects: 8 identity aliases
  (FIL→FIL, …) with no necessity evidence; code-as-label rows (AP→"AP").
  It authorizes nothing.

### R3.0 — Fresh read-only census (school 1, active year 8, 2029-2030, SELECT-only)

- Distinct active faculty departments (42 active scheduling mirrors): 8 values —
  AP(3), ENG(5), ESP(4), FIL(5), MAPEH(6), MATH(3), SCI(11), TLE(5).
- Subject ownership department codes: AP, ENG, ESP, FIL, MAPEH, MATH, SCI, TLE (same set).
- DepartmentAlias rows: 0. DepartmentLabel rows: 0. Alias/label max-createdAt: null.
- Every proposed alias checked for necessity: all 8 live source values already equal
  canonical codes → zero aliases necessary. No membership inferred from names or keywords.

### R3.1 — Redundant aliases removed

- Proposed DepartmentAlias rows: ZERO. Identity aliases (FIL→FIL etc.) are not proposed:
  no real persisted source variant differs from a canonical code.
- Proposed DepartmentLabel rows: 8 (one per observed code).

### R3.2 — Human-readable label decisions (all PENDING_OPERATOR_DECISION)

- AP→Araling Panlipunan, ENG→English, ESP→Edukasyon sa Pagpapakatao, FIL→Filipino,
  MAPEH→MAPEH, MATH→Mathematics, SCI→Science, TLE→Technology and Livelihood Education.
- Catalog validation: ATLAS glossary DEPARTMENT_LABELS agrees on all eight; the only
  "Values Education" occurrence in the client is a legacy code-alias fallback, never
  catalog display terminology — no silent substitution; ESP row carries the explicit
  naming-decision note for the operator.
- Every row: decisionStatus PENDING_OPERATOR_DECISION + observed evidence + proposed
  code/label + accept impact + reject impact + exact rollback delete-row.
- Unresolved count 8 = pending decisions 8. No silent equivalences; familiar mappings
  remain undecided options, never pre-selected rows.

### R3.3 — Artifact placement and fingerprint

- Replacement: `D:/ATLAS/docs/verification/department-authority-decision-5147d2adef09.json`
  SHA-256 `5147D2ADEF09822134F420179E074584245CDCE0644236F78FF4D66B3A85EFE3`
  + sidecar `.sha256` (independently recomputed: EMBEDDED-MATCH + SIDECAR-MATCH true).
- Shared `canonicalHash()`/`canonicalStringify()` from `atlas-server/src/lib/canonical-json.ts`
  used for generation; no insertion-order dependence. Hash binds schema version
  (TL-C01R3.1), school/year scope, source revisions (row counts + max timestamps),
  exact observed values, exact proposed rows (empty aliases), before values, rollback
  rows, conflict/idempotency expectations. `generatedAt` excluded from the hash payload.

### R3.4 — Future apply contract (defined, NOT executed)

- 10-clause contract documented in the artifact (actor-school auth, fingerprint match,
  source-revision revalidation, Serializable transaction, unique-key conflicts,
  create-missing/exact-state-only, noMutationScope, idempotent replay, exact rollback,
  before/after + zero-unrelated-write evidence).
- Apply path: APPLY_PATH_MISSING — zero writers of alias/label tables exist in
  atlas-server (verified). A dedicated approved endpoint must be built; ad hoc SQL is
  not the normal workflow.

### R3.5 — Focused validation (all PASS)

- JSON parse + schema/contract assertions (8 labels, all PENDING, accept/reject/rollback/
  evidence present, no identity aliases, no duplicate codes, proposed ⊆ observed,
  before empty, unresolved==pending==8).
- Canonical fingerprint recomputation via shared implementation: match.
- Fresh read-only census in the generating run (same process).
- Duplicate/identity-alias negative controls: pass.
- `git diff --check`: clean. No test matrices rerun (per R3 scope). Generator scripts
  deleted from the repo (verified no tmp/probe strays).

## Stop-eligibility matrix (all must be zero at stop)

- safe incomplete tasks: 0 (R2-1–R2-6 DONE; T7.4 closed with zero findings)
- required deferred/absent/collapsed tasks: 0 (alias/label data approval+application,
  authenticated Tailnet grid QA, legacy-constant full deletion, timetable-bar migration are
  documented follow-ups, not required tasks)
- invalid/missing required reviews: 0 (T7.4 fresh changed-scope review complete, zeroFix:true)
- unexplained test removals: 0 (superseded assertions rewritten with replacement coverage, inventoried)
- ledger/report status disagreements: 0
- accessible required read-only routes not probed: live Tailnet probe blocked (recorded residual risk)
