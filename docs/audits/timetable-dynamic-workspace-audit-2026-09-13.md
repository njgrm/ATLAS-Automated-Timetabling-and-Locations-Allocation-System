# Timetable dynamic-workspace audit — 2026-09-13

Cycle: TT-DYNAMIC-AUDIT-C04 (planner-led read-only audit)
Status: AUDIT COMPLETE (source); browser-only rows `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`
Product baseline: `f3ac4809002dfc0a78eb4834e86400e702a10421` (ancestor of
`origin/main`; docs-only commits above it)
Worktree: `D:\ATLAS-worktrees\planner-tt-dynamic-audit-c04` (`codex/tt-dynamic-audit-c04`)
Audit lanes (read-only, no mutation): A `ses_f6542af30ffekz7dBallM2PtL9`,
B `ses_f6542960bffe0TFEV47qvtiilR`, C `ses_f65427af3ffeK1z3rFBsZQQ1iY`
Planner: independent verification of all P0/P1 claims listed below; browser probe
2026-09-13 20:27 +08.

## 1. Outcome

The Timetable workspace is a functioning shell with two visible modes built on
one mounted component, but Simple is not yet a safe primary experience and the
warning stack contains at least one P0 correctness defect and one P0 authority
defect:

- **P0/C-02**: soft daily/consecutive/vacant/compression checks group entries by
  `faculty+day` **without term identity** while the validator consumes
  per-term-resolved entries. A normal three-term year fabricates
  `FACULTY_DAILY_MAX_EXCEEDED` as HARD, which blocks publication and blocks
  every manual edit (`manual-edit.service.ts:1190-1192`).
- **P0/B-01**: all Timetable Teaching Load repair and reconciliation routes
  enforce role but never compare the URL `schoolId/schoolYearId` with the
  authenticated actor school; cross-school/archived-year writes are reachable
  by any privileged user (`timetable-teaching-load-repair.router.ts:65-186` vs
  `faculty-assignment.router.ts:33-45`).
- The Euclidean-canvas-as-meters travel warning is confirmed false precision and
  is scheduled for retirement + identity/floor replacement (decision already
  made; execution pending).
- Publication truth is inconsistent: strict `isPublished === true` in the
  canonical service, loose `publishedAt/publishedBy` marker checks in four
  other server/client paths, and a term-filtered client gate vs run-wide server
  gate.
- Simple cannot see stale inputs/term drift/rollover drift, cannot review room
  requests, and its Swap strip control is mis-wired; Advanced owns several
  material workflows.

No product, runtime, database, or repository mutation was performed by this
audit. All three lanes were read-only; the planner performed read-only Git and
browser probes only.

## 2. Evidence boundary

- **Browser**: the persistent Playwright profile holds no reusable session.
  Planner probe: navigated to `https://njgrm.buru-degree.ts.net/timetable`
  (redirected to `/login`), `window.location.origin` asserted
  `https://njgrm.buru-degree.ts.net`, `GET /api/v1/auth/me` → 401, zero cookies
  and zero `sessionStorage` keys. **No login was performed**; the cycle forbids
  login. Every browser-only acceptance row in all three lanes is labeled
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`.
- **Source**: all findings trace production paths in the worktree above; lane
  reports were independently spot-checked by the planner at the exact cited
  lines. Product tree is byte-identical to the baseline
  (`git diff --stat f3ac4809..HEAD -- atlas-server atlas-client prisma` empty;
  only `CHANGELOG.md`, `docs/` changed).
- **Git drift during audit**: `origin/main` advanced from `7baafcaf` to
  `e0a10ebc` via two docs-only commits (`a8fe0dfa` directive pin refresh,
  `e0a10ebc` unrelated Teaching Load packet + CHANGELOG). Product tree
  unchanged. The canonical `D:/ATLAS/AGENTS.md` advanced to normalized SHA-256
  `29C1BD0600937B18C9B387B7F0A71A464E7EE8F7BC15D8A12B14AEE9CB41F81E`; the
  refreshed prompt pin matches; the planner re-read the operative directive
  from disk.

## 3. Consolidated findings (severity-ranked, deduped by root cause)

Legend — Verification: `PV` = planner-verified at source this cycle; `LA` =
lane-verified, source-anchored line evidence, not planner-rechecked (P2 items).
Owner streams: **S1** TT-DYNAMIC-WORKSPACE-C04, **S2** TT-WARNING-AUTHORITY-C04,
**S3** TT-TL-MODULES-C04 (locked behind S1), **S4** TT-SOURCE-FRESHNESS-C04
(registered successor), **D#** operator decision.

### P0

| ID | Finding | Evidence | Verification | Owner |
|---|---|---|---|---|
| C-02 | Term-blind soft-check grouping fabricates HARD `FACULTY_DAILY_MAX_EXCEEDED` (and false SOFT daily/consecutive/vacant/overcompressed) for any 3-term year; blocks publication and all manual edits | Resolver expands year-long entries per term `per-term-schedule-resolution.service.ts:184-195`; validator groups by `${facultyId}:${day}` only `constraint-validator.ts:534-541,625-632,723-730,799-806,836-844`; daily sum `:548-566`; publish block `publication-contract.service.ts:249-254`; edit block `manual-edit.service.ts:1190-1192` | PV | S2 |
| B-01 | Timetable TL repair/reconciliation routes enforce role only; no actor-school comparison, so cross-school/archived-year writes are reachable | `timetable-teaching-load-repair.router.ts:19,65-72,74-186` (never reads `req.user.schoolId`); contrast `faculty-assignment.router.ts:33-45` (`rejectSchoolScopeConflict`) | PV | S3 |

### P1

| ID | Finding | Evidence | Verification | Owner |
|---|---|---|---|---|
| A-01 | Client publish gate uses term-filtered HARD count while the server publishes against run-wide persisted violations; hidden blockers in unselected terms | `useTimetableData.ts:492-503,542`; `useScheduleReviewWorkspaceState.ts:1547`; headers `TimetableSimpleHeader.tsx:171-198`, `ScheduleReviewWorkspaceHeader.tsx:242,441`; server `publication-contract.service.ts:249-254` | PV | S1 (client gate) + S2 (count read-model, C-10/C-15) |
| A-02 | Soft-acknowledgement scope mismatch: client ack counts/checkbox term-filtered; server requires ack for all run soft warnings (dead-end 422) | `useTimetableMutations.ts:765-776`; `TimetableWorkflowDialogs.tsx:108-110`; `publication-contract.service.ts:274-279` | PV | S1 |
| A-04 / B-11 | Publication-predicate drift on superseded runs: loose `publishedAt/publishedBy` markers show "published" affordances in Advanced center/sandbox/departure sheet, while strict paths reject (`PUBLISHED_SOURCE_REQUIRED`, `RUN_ALREADY_PUBLISHED`); four different outcomes | loose `ScheduleReviewWorkspace.tsx:130-137`, `CenterWorkspace.tsx:360-367`; strict headers `TimetableSimpleHeader.tsx:120`, `ScheduleReviewWorkspaceHeader.tsx:232`; canonical doctrine `publication-contract.service.ts:240-242,292-308`; loose write guards `manual-edit.service.ts:400-411`, `timetable-teaching-load-repair.service.ts:1024-1043`, `timetable-quick-place.service.ts:447`, `timetable-sync-setup.service.ts:283,667` | PV | S1 (client) + S2/S3/S4 (each server file aligns to the strict predicate) |
| A-05 | Selected-class strip/sheet `Swap` only re-sets component state: unarmed in Simple, no-op in Advanced; the advertised two-class swap from the strip cannot complete | `ScheduleReviewWorkspace.tsx:198-214,322-325,546-556` vs correct wiring `TimetableSimpleHeader.tsx:300-305` → `ScheduleReviewWorkspace.tsx:371-375`; Advanced body omits the drawer `ScheduleReviewWorkspaceBody.tsx:84-109` | LA (line evidence; browser row blocked) | S1 |
| A-11 / B-06 / B-14 | Simple is blind to stale inputs, rollover drift, and term-authority state; stale banner is Advanced-only and offers one generic action set with no targeted repair; upstream ordered-term drift is invisible to run freshness (preflight compares the persisted cache with itself) | Advanced-only banner `ScheduleReviewWorkspaceHeader.tsx:220-222,226,247,869-938`; no Simple consumer; `generation-preflight.service.ts:631-651`; production trigger passes no `termContract` `generation.service.ts:575-577`; persisted-cache read `derived-demand.service.ts:1038-1053` | PV (B-06 nuance: check runs but is tautological vs cache) | S1 (UI) + S4 (binding) |
| B-02 | `applyRunReconciliation` returns `APPLIED` + `runVersion+1` but writes only an audit row; the run is never updated (phantom version) | `reconciliation.service.ts:77-138` (tx `:105-128` audit-only; `newVersion` never persisted); route `timetable-teaching-load-repair.router.ts:155-186`; no client caller found | PV | S3 (D3) |
| B-03 | Generation persists an input snapshot computed **after** scheduling via the global client, unbound to the preflight assembly; a concurrent change makes a stale-built run appear FRESH | `generation.service.ts:592-604` (preflight revalidation) → `:684` (schedule) → `:813` (`computeGenerationInputSnapshot` global client) → `:854-865` (persist); snapshot service default client `generation-input-snapshot.service.ts:152-155` | PV | S4 |
| B-04 | TL repair and quick-place rewrite the entire input snapshot without proving entries were computed from it; an unrelated repair clears pre-existing room/policy/subject STALE | `timetable-teaching-load-repair.service.ts:1055-1056` vs output prepared `:1002-1014` on a global read; same pattern `timetable-quick-place.service.ts:539,552` → `manual-edit.service.ts:1351-1361` | LA | S3 (TL repair) + S4 (quick-place/sync) |
| B-05 | Faculty availability is not a generation input at all (`timeSlots: []`); no fingerprint, no repair module; legacy gate defaults off | `generation-preflight.service.ts:698,1138`; constructor expectation `schedule-constructor.ts:183-187`; `preference.service.ts:76-79` | PV | D1 |
| B-07 | Timetable owner repair creates `FacultySubject`/ownership rows for an unqualified target; no `evaluateTeachingLoadReceiverQualification` call | `timetable-teaching-load-repair.service.ts:905-923`; canonical checks exist `teaching-load-suggestion-proposal.service.ts:617-625` | PV | S3 |
| C-01 | `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` computes Euclidean distance over `Building.x/y` canvas pixels and labels it in meters; promotable to hard; default-enabled | `constraint-validator.ts:645-677`; canvas geometry `CampusMapEditor.tsx:41-42,719-758`; schema `prisma/schema.prisma:141-144`; label `SchedulingPolicyPane.tsx:950-957`; default on `scheduling-policy.service.ts:74` | PV | S2 |
| C-03 | No cross-floor transition warning exists despite persisted `Room.floor`; vertical movement is invisible | `schema.prisma:176-177`; validator room refs carry no floor `constraint-validator.ts:124-129,162-165`; floor used only for ordering (`home-room-auto-assign.service.ts:134`) | PV | S2 |
| C-04 | One master `enableTravelWellbeingChecks` switch couples six codes (travel, transitions, buffer, idle, early, late); early/late additionally disabled by default config | `constraint-validator.ts:619,719`; defaults `scheduling-policy.service.ts:74,136-143`; UI `SchedulingPolicyPane.tsx:937-999` | PV | S2 |
| C-05 | Client default `ROOM_CAPACITY_EXCEEDED.treatAsHard:true` vs server default `false`; generation reads the raw policy row so a UI-saved setting can promote room capacity to a HARD publication blocker while manual edit normalizes it away | `PolicyPanePrimitives.tsx:22` vs `scheduling-policy.service.ts:147`; raw read `generation-preflight.service.ts:586`; normalizer only on `getOrCreatePolicy` `scheduling-policy.service.ts:715-739,840-855`; promotion `constraint-validator.ts:905-914` | PV | S2 |
| C-06 | No server allowlist or trust guard on `treatAsHard`; every unreliable family is promotable to a hard publication blocker | `scheduling-policy.service.ts:586-603`; promotion `constraint-validator.ts:905-914`; publication `publication-contract.service.ts:249-254` | PV | S2 |
| C-07 | Client contract omits `ROOM_FEATURE_MISMATCH`: server can persist it, but the client union/labels lack it and search dereferences the missing label (TypeError) | server `constraint-validator.ts:430-456`; client union `types.ts:984-1008` absent; label map `useTimetableData.ts:43-68`; crash `useTimetableData.ts:525`; only `ExplainabilityDrawer.tsx:31` knows it | PV | S2 |
| C-08 | Manual edits and pre-gen previews build validator contexts without `features`/`requiredFeatures`, so the same schedule is judged differently per surface | generation has them `generation-preflight.service.ts:688,695`; manual `manual-edit.service.ts:220-235`; pre-gen `pre-generation-draft.service.ts:602-613,819-821` | PV | S2 |
| C-09 | Faculty overload threshold differs by surface: effective ancillary-deducted hours vs raw `maxHoursPerWeek` | `generation-preflight.service.ts:683,1131-1135,1166-1170` vs `manual-edit.service.ts:214`, `pre-generation-draft.service.ts:594-597`; consumed `constraint-validator.ts:380-397` | PV | S2 |
| C-10 / C-15 | Selected-term displays use filtered violations but `counts.byCode`/summary counts are run-wide and unfiltered; hidden blockers or repeated cross-term warnings | client filter `useTimetableData.ts:492-503`; server filter `generation.service.ts:1379-1389`; unfiltered counts `:1402-1413,1427-1438` | PV (C-10 client/server divergence; C-15 read-model) | S2 (read-model) + S1 (gate) |

### P2 (technical/UX debt; still owning-stream mapped)

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| A-03 | `/campus-rooms` repair links are dead (no route; catch-all redirects to Dashboard) | links `SimpleTaskDrawerHelpers.tsx:31-32`, `simplePublishReadiness.ts:66-67`, `TimetableSimpleHeader.tsx:849`; no route in `App.tsx` | S1 |
| A-06 | Clean placements auto-commit while drawer/overlay copy says a review always happens | `useScheduleReviewWorkspaceState.ts:1004-1030`; copy `TimetableTaskDrawer.tsx:74-81`; tutorial `SimpleHeaderHelpers.tsx:101-107` | S1 |
| A-07 | Advanced "visible Undo" sits in an `sr-only` container; no Redo exists anywhere | `ScheduleReviewWorkspaceHeader.tsx:836-866` (`timetable-visible-undo` at 857) | S1 |
| A-08 | Component-local sheets/task/selection state survives school/year/run/term changes; no remount path on scope change | `ScheduleReviewWorkspace.tsx:62-93`; scope resets only in hooks `useTimetableData.ts:1542-1614` | S1 |
| A-09 | Privileged UI derives from mutable `localStorage.userRole` instead of authenticated actor authority (server still enforces) | `useScheduleReviewWorkspaceState.ts:167-168`; consumers `LeftRailContent.tsx:105,576`, `TimetableWorkflowDialogs.tsx:98-100` | S1 |
| A-10 | No-active-year/error state is Retry-only; the Year Setup repair is unreachable | `useTimetableData.ts:1542-1547,1601-1614`; error UI `ScheduleReviewWorkspace.tsx:143-156` | S1 |
| A-12 | Advanced `Requests` toolbar button sets the tab without expanding the collapsed rail (appears dead on mobile) | `ScheduleReviewWorkspaceHeader.tsx:599-614` vs `openLeftTask :270-274,326-336` | S1 |
| A-13 | Advanced renders two selected-class action surfaces with different flows | `ScheduleReviewWorkspace.tsx:278-357` + `RightPanel.tsx:370-442` | S1 |
| A-14 | Only `gates.generation` is consumed; the shared capability model is not the production guard for publish/move/swap/requests | `timetable-capabilities.ts:172-202`; consumers `TimetableSimpleHeader.tsx:123-141`, `ScheduleReviewWorkspaceHeader.tsx:234-252`; tests only | S1 |
| A-15 | Advanced allows re-publish of an already-published run and toasts success on server replay; Simple blocks it | `ScheduleReviewWorkspaceHeader.tsx:437-449`; replay `publication-contract.service.ts:206-239`; client ignores `replayed` `useTimetableMutations.ts:772-780` | S1 |
| A-16 | Policy fetch failure leaves a permissive hook default `{teacherMoveEnabled:true}` and suppresses the hidden-row alignment warning | `useScheduleReviewWorkspaceState.ts:121,541-543,1562-1593` (pane itself fail-closed `SchedulingPolicyPane.tsx:309-311`) | S1 |
| A-17 | `/timetable?...` deep links drop view/run/entity/severity context; page never reads query params | writers `ConflictInspectorSheet.tsx:197,216,232`, `Audit.tsx:504,520`; no `useSearchParams` reader | S1 |
| A-18 | Readiness-sheet "Open Teaching Load" drops teacher/section/subject identity | `TimetableSimpleHeader.tsx:840-842` vs route intents `useTeachingLoadRouteIntent.ts:50-55` | S1 |
| A-19 | Advanced tutorial does not pass `userRole`; role-gated steps render for everyone | `ScheduleReviewWorkspaceOverlays.tsx:29-33`; `TutorialOverlay.tsx:36` | S1 |
| B-08 | `applyAnnualTeachingLoadChange` has no version/fingerprint CAS (parameter ignored), no actor-school guard, preview computes `currentRun` but never shows timetable impact | `timetable-teaching-load-repair.service.ts:1248-1264,1194-1208` | S3 |
| B-09 | Sync's declared read snapshot performs hidden writes: `loadRunContext` → `getOrCreatePolicy` creates/normalizes the policy row | `timetable-sync-setup.service.ts:280-281`; `manual-edit.service.ts:236`; `scheduling-policy.service.ts:840-876` | S4 |
| B-10 | Client run-data cache (120 s TTL) can show stale `inputState`/version with no age indicator | `useTimetableData.ts:126,1249-1250,1584` | S1 |
| B-12 | Pre-generation anchors are one-shot (`LOCKED_FOR_RUN` excluded later); dialog count shows DRAFT only; no operator warning | `generation.service.ts:887`; `pre-generation-draft.service.ts:1671,1772-1785`; dialog `TimetableWorkflowDialogs.tsx:56-58` | S1 (copy) + D2 |
| B-13 | Sync dialog promises "slot swaps and pins preserved" but retained entries re-bind teachers to live ownership | `ScheduleReviewWorkspaceDialogs.tsx:65-67`; `timetable-sync-setup.service.ts:447-451,430-442` | S1 (copy) + S4 (behavior) + D5 |
| B-14 | One generic stale-banner action set for every changed domain; `SetupImpactDialog` is read-only | `ScheduleReviewWorkspaceHeader.tsx:221,869-938`; `ScheduleReviewWorkspaceDialogs.tsx:13-42` | S1 |
| B-15 | No client entry points for capability overrides, department authority, over-cap rebalance, or reconciliation readiness | routes exist `faculty-assignment.router.ts:68-113,527-572,769-840`; grep finds no client consumers | S3 |
| B-16 | Archived mode absent from the workspace; lifecycle has no archived state; workspace binds the runtime-active year | `timetable-capabilities.ts:11-27`; `useTimetableData.ts:1152-1195` | S1 + D4 |
| C-11 | Pre-gen preview drops persisted `LockedSession.termIndex`, validating placements as year-round | `schema.prisma:943`; `pre-generation-draft.service.ts:332-374`; `effective-scheduled-resources.ts:20-24` | S2 |
| C-12 | `SESSION_PATTERN_VIOLATED` is a dead policy key with no producer; unused `SchedulingPolicySheet.tsx` carries divergent defaults | `scheduling-policy.service.ts:146`; `constraint-validator.ts:28-54`; `SchedulingPolicySheet.tsx:32-41` (no importers) | S2 |
| C-13 | `FACULTY_DAILY_STANDARD_EXCEEDED`/`FACULTY_DAILY_MAX_EXCEEDED` have no `constraintConfig` rows; 6-hour standard hardcoded | `constraint-validator.ts:530`; defaults `scheduling-policy.service.ts:135-148` | S2 |
| C-14 | Room floor authority is dual (`floor` vs nullable `floorNumber`); undefined precedence | `schema.prisma:176-177`; writers set `floor` only `map.router.ts:133-135` | S2 |
| C-16 | All soft-wellbeing/daily/consecutive codes have zero deterministic coverage; every test disables the travel flag or builds policy-less contexts | test-tree census (0 matches for the code names); flag-off contexts listed in lane C H5 | S2 |

### Root-cause clusters (dedupe view)

| Cluster | IDs | Root cause | Single correct fix direction |
|---|---|---|---|
| CP-1 Count/parity | A-01, A-02, C-10, C-15 | Term-scoped display and run-wide gating are mixed without a documented contract | One run-wide gate source (`summary.hardViolationCount` + persisted violations) and explicit term-scoped display; server counts consistent with both |
| CP-2 Publication predicate | A-04, B-11 (+ four server loose checks) | Legacy marker compatibility vs canonical strict truth | Strict `isPublished === true` everywhere: S1 owns the client surfaces; S2 owns `manual-edit.service.ts`; S3 owns the TL repair service; S4 carries `timetable-quick-place.service.ts:447` and `timetable-sync-setup.service.ts:283,667` |
| CP-3 Source-change invisibility | A-11, B-06, B-14, B-10 | Freshness authority exists server-side but has no Simple consumer and no binding for term/availability changes | Typed domain surfaces in the workspace + server binding for every consumed input |
| CP-4 Scope survival | A-08 (+ ordered-term invariant 6) | Component-local state not keyed to school/year/run/term | Clear/revalidate all scope-bound state on scope change |
| CP-5 Warning promotion | C-01, C-05, C-06, C-13 | No trust boundary between unreliable soft metrics and hard publication blockers | Server promotion allowlist; retire false metric; align client/server defaults |
| CP-6 Validator-context parity | C-08, C-09, C-11, B-05 | Each surface builds its own validator inputs | One shared context-builder contract; availability decided (D1) |
| CP-7 Snapshot binding | B-03, B-04, B-09 | Outputs computed before the final write without a transaction-bound recomputation | Bind computed output to the same snapshot (existing pattern `timetable-sync-setup.service.ts:689-731`) |
| CP-8 TL authority | B-01, B-07, B-08, B-15, D3 | Timetable TL path duplicates write authority without the canonical guards | Reuse `assertTeachingLoadWriteAuthority` + qualification evaluator; retire phantom endpoint |

## 4. Refuted hypotheses (checked and rejected)

- "Preview demand is a dead control" — REFUTED: opens a working preview-only
  flow (`UnassignedInsertionWorkflow.tsx:116-121,181`).
- "Policy-read failure enables Save" — REFUTED for the mounted pane: `local`
  stays null and Save is disabled (`SchedulingPolicyPane.tsx:309-311,653-656`);
  only the unused hook default remains (A-16).
- "Simple can reach room requests through the task drawer" — REFUTED: no Simple
  path sets `leftTab='requests'`.
- "Undo can revert an edit from a different run" — REFUTED for cross-run:
  `expectedVersion` CAS + run-scoped `apiBase` clear history
  (`useTimetableMutations.ts:822-829,1042-1045`).
- "Auto-save is undisclosed after saving" — REFUTED post-commit: a visible
  `Saved … Undo` strip renders (`ScheduleReviewWorkspace.tsx:245-277`); only
  pre-click copy is wrong (A-06).
- "Publication does not check input freshness" — REFUTED: publication compares
  complete snapshots in a Serializable transaction
  (`publication-contract.service.ts:262-272`).
- "Selected-term views use raw compact entries" — REFUTED: canonical per-term
  resolution feeds generation/readiness/sync.
- "Manual edits can silently rewrite published truth" — REFUTED: published
  changes require revisions (`manual-edit.service.ts:408-411`).
- "Faculty availability already affects generation through constructor
  preferences" — REFUTED: `timeSlots: []` (`generation-preflight.service.ts:1138`).

## 5. Test gaps (must close inside owning streams)

1. No deterministic test names any soft wellbeing/daily/consecutive code; every
   generation test either disables `enableTravelWellbeingChecks` or builds a
   policy-less validator context (C-16).
2. Term-blind grouping has no failing-first control: add a 3-term fixture where
   per-term daily minutes are legal but the summed total would exceed the hard
   max; the fixed validator must emit zero HARD.
3. Publication-promotion: no test proves a persisted `treatAsHard` for a
   retired/unreliable code is rejected or inert server-side (C-06).
4. Client `ROOM_FEATURE_MISMATCH` contract has no render/search test (C-07).
5. Cross-school/archived-year rejection has no mounted route test for the TL
   repair family (B-01) — mandatory matrix in the S3 packet.
6. Snapshot-binding interleave: no control proves generation/TL-repair writes
   fail closed when a non-demand input changes mid-run (B-03/B-04, S4).
7. Browser-only rows remain unexecuted (see §2) and must be covered by the
   post-deployment acceptance matrix, not this source cycle.

## 6. Merge-conflict forecast (as of `e0a10ebc`)

- No active executor candidate exists in the register; most listed worktrees
  are closed historical boundaries. The only concurrent writer observed this
  cycle is the operator's docs-only stream (two commits on `origin/main`).
- This docs package adds new files (contract, audit, three prompts) and edits
  `CHANGELOG.md`, `docs/plans/atlas-active-delivery-streams.md`, and
  `.gitignore` (the `docs/audits/` allowlist). The original planner-cycle
  prompt file is untouched. Forecasted conflicts:
  `CHANGELOG.md` (append-only union, low risk) and the register (single-writer,
  low risk). No product file is touched, so no product conflict is possible.
- Integration boundary must be re-verified against `origin/main` immediately
  before push; if new docs-only commits arrive, reconcile as a union.

## 7. Lane tallies

| Lane | Mandatory total | Passed | Blocked | Unperformed | Notes |
|---|---|---|---|---|---|
| A (`ses_f6542af30ffekz7dBallM2PtL9`) | 15 | 9 | 6 | 0 | Blocked rows are browser-rendered confirmations; all source traces complete |
| B (`ses_f6542960bffe0TFEV47qvtiilR`) | 14 | 12 | 1 | 1 | Blocked: authenticated signal confirmation; unperformed: runtime interleave (not authorized) |
| C (`ses_f65427af3ffeK1z3rFBsZQQ1iY`) | 11 | 9 | 1 | 1 | Blocked: rendered label/search row; unperformed: live persisted-policy/features DB check (no DB probe authorized) |
| Planner consolidation | 5 | 5 | 0 | 0 | (1) P0/P1 independent verification, (2) dedupe/root-cause, (3) harm-ranked owner mapping, (4) merge forecast, (5) durable outputs |

No lane or planner row was silently dropped. Browser-blocked rows are labeled
`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`; they do not block this source/docs
cycle.

## 8. Open data-conditioned uncertainties (not resolvable read-only here)

1. Live `scheduling_policies.constraint_config` for the active year: any stored
   `treatAsHard:true` (especially travel/room-capacity) and the active
   `enableTravelWellbeingChecks` value. Arming C-05/C-06 in production depends
   on this.
2. Subjects with non-empty `requiredFeatures` and rooms lacking them: reachability
   of `ROOM_FEATURE_MISMATCH` and the C-07 search crash on live data.
3. Whether year 9 currently resolves an active ordered term (termFilter default
   `all` vs one term) — determines A-01/A-02 default reachability.
4. Whether `floorNumber` is backfilled in production or always null (C-14
   precedence before implementing floor transitions).
5. Whether any external consumer calls `/reconciliation/apply` before D3 retires
   it (no repository client caller exists).
6. Runtime behavioral confirmation of B-03/B-04 interleaves (requires an
   authorized disposable-DB test inside S4; not part of this audit).

## 9. Verdict

`AUDIT_COMPLETE_SOURCE` — the durable contract
(`docs/reference/timetable-dynamic-workspace-and-warning-contract.md`) and the
three implementation packets are authored from this evidence; browser-only rows
remain externally blocked and must be closed during post-deployment acceptance.
No product, data, or runtime mutation occurred.
