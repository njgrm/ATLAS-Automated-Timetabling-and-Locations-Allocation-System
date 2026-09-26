# Planner A3 — non-timetable UI/UX remediation handoff

**Disposition:** `KEEP_ACTIVE` until A3 has created bounded implementation packets.

**Writable home:** `E:/ATLAS-worktrees/lane-a3-ui-ux-ledger`, branch `docs/a3-ui-ux-ledger`. The earlier Codex-managed copy at `C:/Users/njgro/.codex/worktrees/lane-a3-ui-ux-handoff/ATLAS` is frozen as history and must not be modified; see the 2026-09-27 relocation entry in the Progress log.

## Purpose and source of truth

This is A3's working progress record for the non-timetable UI/UX findings verified on the live Tailnet on 2026-09-27. The full requirement ledger remains the user-supplied file:

- `D:/ATLAS/ATLAS-FIXES-CODEX-PLANNER-HANDOFF.md`

That root file is user-owned and currently untracked in the shared checkout. Do not edit it from an implementation lane. A3 must record progress **in this file** after each verification or implementation milestone, preserving the baseline below.

## Ownership boundary — A3 only

### In scope

- Sections and room-map UI: Fixes 01–12.
- Subjects UI: Fixes 09, 15, 17, 19, 20, 31, 32, 33A, 33B.
- Teachers and Teaching Load UI: Fixes 13, 14, 16, 18, 21–26, 29, 30.

### Explicitly out of scope — A2 timetable ownership

Do not edit, plan, test, or change:

- `/timetable`, Class Schedule, Room Schedules, published schedules, exports, generation, publication, revisions, or schedule reads.
- `atlas-client/src/pages/Timetable*` or `atlas-client/src/components/timetable/**`.
- Server timetable/generation routes, term-selection logic, run state, published-run data, or timetable query shape.
- A shared UI component when its change would alter timetable behavior or styling, unless A2 accepts that dependency in writing.

Specific fences:

- Fix 22 applies only to Teachers and Teaching Load; Class Schedule name rendering stays with A2.
- Fix 26 must not add or alter a “Proceed to Timetable” action.
- Fix 33B is presentational only. Preserve rotation/shared-session data, persistence, and scheduling semantics.

## Baseline evidence

- Live origin: `https://njgrm.buru-degree.ts.net`
- Live release observed: `0da104f96696aef7de7016e5364f29b50d0ed00f`
- Primary QA viewport: desktop `1366×768`; only a brief `390×844` Subjects smoke was performed.
- No records, assignments, swaps, saves, publications, or timetable data were changed during the audit.
- Browser console: no errors on the exercised Sections, Subjects, Teachers, Teaching Load, and Map routes. Authenticated API requests returned 200 in the captured desktop session.
- Focused test: `npm --prefix atlas-client run test:teaching-load-clarity` passed 8/8.
- Do not treat `test:visual:faculty` as a passing gate: it references a missing Playwright spec. The Teaching Load visual script was blocked by its separate terminal credential requirement.

## Current finding ledger

Status meaning: `REPRODUCED` was observed on the current desktop runtime; `VERIFIED_FIXED` was exercised without the historical defect; `SOURCE_CONFIRMED` is exact deployed-source evidence needing a targeted interaction; `PARTIAL` is partly resolved; `NEEDS_REPRO` needs a specific scenario; `SOURCE_GAP` has no valid requirement.

| Fix | Baseline status | A3 next action | A3 progress |
|---|---|---|---|
| 01 | VERIFIED_FIXED | Preserve; regression-test picker scroll containment. | TODO |
| 02 | VERIFIED_FIXED | Preserve; regression-test one picker layer. | TODO |
| 03 | REPRODUCED | Widen/reflow picker occupancy text; test long occupant name. | IMPLEMENTED_PENDING_QA |
| 04 | SOURCE_CONFIRMED | Exercise occupied-room change; retain confirmation and zero-write Cancel control. | IMPLEMENTED_PENDING_QA |
| 05 | SOURCE_CONFIRMED | Verify direct map entry; do not regress it. | IMPLEMENTED_PENDING_QA |
| 06 | NEEDS_REPRO | Test BuildingView pan/zoom on floor-level state before changing bounds. | IMPLEMENTED_PENDING_QA |
| 07 | SOURCE_CONFIRMED | Audit interior room-card overlap at usable zoom. | IMPLEMENTED_PENDING_QA |
| 08 | PARTIAL | Obtain product decision: deselect versus unassign. | BLOCKED_PRODUCT_DECISION |
| 09 | REPRODUCED | Replace oversized technical Subjects warning with calm, actionable state copy. | IMPLEMENTED_PENDING_QA |
| 10 | SOURCE_CONFIRMED | Increase map typography and badge legibility. | IMPLEMENTED_PENDING_QA |
| 11 | SOURCE_CONFIRMED | Rework premature room-name truncation. | IMPLEMENTED_PENDING_QA |
| 12 | SOURCE_CONFIRMED | Add persistence-aware success/error feedback; distinguish queued from saved. | IMPLEMENTED_PENDING_QA |
| 13 | PARTIAL | Use grade display treatment in workload detail without changing timetable surfaces. | IMPLEMENTED_PENDING_QA |
| 14 | PARTIAL | Improve Teaching Load desktop density without page-level scroll. | IMPLEMENTED_PENDING_QA |
| 15 | REPRODUCED | Make primary Subjects filters directly visible. | IMPLEMENTED_PENDING_QA |
| 16 | REPRODUCED | Reduce Teaching Load click/load density; keep controls mouse-first. | IMPLEMENTED_PENDING_QA |
| 17 | REPRODUCED | Convert targeted desktop review drawers to responsive dialogs; preserve mobile sheets where useful. | IMPLEMENTED_PENDING_QA |
| 18 | PARTIAL | Standardize grade treatment only in A3-owned routes. | IMPLEMENTED_PENDING_QA |
| 19 | SOURCE_CONFIRMED | Prevent wrapping/clipping in A3-owned action menus; avoid broad primitive change. | IMPLEMENTED_PENDING_QA |
| 20 | PARTIAL | Add truthful post-save feedback and maintain internal dialog scrolling. | IMPLEMENTED_PENDING_QA |
| 21 | REPRODUCED | Remove redundant Next Teacher strip and reclaim roster space. | IMPLEMENTED_PENDING_QA |
| 22 | REPRODUCED | Standardize display casing in A3-owned Teacher/Load UI only. | IMPLEMENTED_PENDING_QA |
| 23 | REPRODUCED | Use Fix 17 dialog pattern for Teacher profile detail. | IMPLEMENTED_PENDING_QA |
| 24 | REPRODUCED | Update Teachers menu copy and keep labels on one line. | IMPLEMENTED_PENDING_QA |
| 25 | REPRODUCED | Replace default navigation with in-page workload review dialog. | IMPLEMENTED_PENDING_QA |
| 26 | REPRODUCED | Remove permanent desktop inspector; reuse workload content in an audit modal. | IMPLEMENTED_PENDING_QA |
| 27 | SOURCE_GAP | Do not implement. | BLOCKED_SOURCE_GAP |
| 28 | SOURCE_GAP | Do not implement. | BLOCKED_SOURCE_GAP |
| 29 | SOURCE_CONFIRMED | Restrict swap to a dedicated control and require confirmation; prove Cancel = zero draft change. | IMPLEMENTED_PENDING_QA |
| 30 | SOURCE_CONFIRMED | Separate Select checked and hover states in a route-safe way. | IMPLEMENTED_PENDING_QA |
| 31 | REPRODUCED | Display `BEC` for persisted `REGULAR`; do not migrate enum/schema. | IMPLEMENTED_PENDING_QA |
| 32 | REPRODUCED | Filter Faculty Room/Office only from Subject room-need options. | IMPLEMENTED_PENDING_QA |
| 33A | REPRODUCED | Make Advanced Scheduling Rules always visible. | IMPLEMENTED_PENDING_QA |
| 33B | REPRODUCED | Hide Shared class session UI while preserving logic/schema; elevate Rotates by term. | IMPLEMENTED_PENDING_QA |
| 34 | SOURCE_GAP | Do not implement. | BLOCKED_SOURCE_GAP |

## Required progress discipline

After every meaningful A3 action, update the corresponding **A3 progress** cell and append a dated entry below. Do not replace baseline evidence with an unsupported claim.

Allowed progress values:

- `TODO`
- `REPRODUCED`
- `VERIFIED_FIXED`
- `IMPLEMENTED_PENDING_QA`
- `QA_PASSED`
- `BLOCKED_<reason>`
- `SUPERSEDED_<reason>`

Each dated entry must contain:

1. Fix IDs and intended outcome.
2. Base SHA and candidate SHA, when a candidate exists.
3. Exact changed paths.
4. Focused test command/result.
5. Desktop browser result at `1366×768`, including accessibility, console, and network status.
6. For a mutation-capable flow: a negative control proving Cancel/non-action made zero changes.
7. Any A2 dependency or explicitly retained risk.

## Progress log

### 2026-09-27 — live baseline captured

- Owner: Planner A3 (handoff prepared; no implementation started).
- Evidence: live desktop audit and exact deployed-source inspection.
- Outcome: 01 and 02 verified fixed; 03, 09, 15–17, 21–26, 31–33B reproduced; 27, 28, and 34 remain source gaps; remaining rows are targeted source/interaction follow-ups.
- A2 dependency: none permitted without an explicit ownership transfer.

### 2026-09-27 — source-level root-cause re-confirmation at `3cfe79a8`

1. **Fixes/IDs and intended outcome.** Read-only re-derivation against the current base, not the audited release `0da104f9`. Eight `SOURCE_CONFIRMED` rows upgraded to source-confirmed `REPRODUCED` with exact root causes: 04 (`pages/Sections.tsx:467-495,965-970`), 05 (`pages/Sections.tsx:794-805`), 10 (`components/sections/SectionRoomMapModal.tsx:171-388`; `components/BuildingView.tsx:491-599`), 11 (`components/BuildingView.tsx:321-331`), 12 (`pages/Sections.tsx:967-968` crossed with `386-441`), 19 (`ui/dropdown-menu.tsx:66,85`), 29 (`components/faculty-assignments/SubjectRow.tsx:489-496`), 30 (`ui/select.tsx:117`). 07 proven by geometry (`BuildingView.tsx:321-331,382-400,414-434`: room name occupies x4-86/y6-18, program badge x66-86/y6-16, utilization bar x76-86/y8-58, inside a 90x70 card; name-badge and badge-bar both overlap). Also located: 13 (`components/faculty-assignments/WorkloadInspector.tsx:224`), 14 (`pages/TeachingLoad.tsx:628,670,672,725`), 15 (`components/admin-workspace/AdminWorkspace.tsx:264`), 16 (`components/faculty-assignments/TeacherGridMode.tsx:229-236,284`), 17/23 (`components/subjects/SubjectCoverageSheet.tsx:65-66`; `components/faculty/FacultyProfileSheet.tsx:75-76`), 21/24/25 (`pages/Faculty.tsx:647-674,791-812,901`), 26 (`pages/TeachingLoad.tsx:811-834`), 31 (`lib/subject-constants.ts:19`), 32 (`components/subjects/SubjectFormModal.tsx:475`), 33A/33B (`SubjectFormModal.tsx:71,84,206,632-660,665`).
2. **Base SHA.** `3cfe79a883df92a24e3436a42f7e180bb2d768b8` (`main`, clean apart from the untracked user-owned root ledger). **Candidate SHA:** none; no implementation started. This ledger now lives in worktree `E:/ATLAS-worktrees/lane-a3-ui-ux-ledger` on branch `docs/a3-ui-ux-ledger` at `d22c7f21`, clean.
3. **Exact changed paths.** Product paths: none. This entry changed only `docs/handoffs/planner-a3-non-timetable-ui-ux-handoff.md`.
4. **Focused test command/result.** None run this session. The 2026-09-27 baseline result `npm --prefix atlas-client run test:teaching-load-clarity` (8/8) stands unchanged. `test:visual:faculty` remains invalid (missing Playwright spec) and is not cited as a gate.
5. **Desktop browser result at 1366x768.** **Not performed this session.** No accessibility, console, or network capture. Every status in this entry is source-level only and must be runtime-confirmed before implementation acceptance. Nothing was promoted to `VERIFIED_FIXED`.
6. **Negative control.** Not performed; no mutation-capable flow was exercised. `pages/Sections.tsx:467-495` shows the Cancel path is structurally zero-write (`setPendingAssignment(null)` with no `performHomeRoomUpdate` call), but that is a source reading, not an executed control.
7. **A2 dependency / explicitly retained risk.**
   - **Fix 30 requires an A2 dependency handoff.** `ui/select.tsx` has four A2-owned consumers: `components/timetable/simple/SchedulerExportCenterDialog.tsx`, `SimpleBeneficiaryControls.tsx`, `SimpleHeaderHelpers.tsx`, `SimpleMoreMenuContent.tsx`. Held. Route-scoped `SelectItem` mitigation planned in A3-owned routes instead. The primitive fix would restore the `data-[state=checked]:bg-accent` pairing that `ui/dropdown-menu.tsx:101` already demonstrates.
   - **Fix 19** planned route-scoped (`whitespace-nowrap` at A3 call sites) for the same reason; `ui/dropdown-menu.tsx` stays untouched.
   - **Fix 18 must not create a third grade palette.** Two exist: `GRADE_COLORS` (`lib/grade-labels.ts:17`, used by `pages/Subjects.tsx:30,815,867`) and `GRADE_BADGE` (`components/ManualEditPanel.tsx:167`). Owner of `ManualEditPanel` to be confirmed with A2. Mitigating evidence: only 4 `dark:` occurrences exist across the client, so the app is effectively light-only and `GRADE_COLORS` is safe to adopt as-is. Recorded as measured, not assumed.
   - **Fix 08 remains `BLOCKED_PRODUCT_DECISION`**, now with a materially narrower brief: `SectionRoomMapModal.tsx:142-145` passes a possibly-null `selectedRoomId` to `onSelect`, and `pages/Sections.tsx:470-478` routes that to `UnassignConfirmationModal`, so the review's "Confirm Assignment silently behaves as a destructive unassign" case is already unreachable. The residual is naming and semantics only, narrowing the decision to Option A versus Option B.
   - **AGENTS.md section 8 line cap is the top execution risk.** `pages/Subjects.tsx` 989/1000, `pages/Faculty.tsx` 990/1000, `pages/Sections.tsx` 983/1000, `pages/TeachingLoad.tsx` 925/1000. Extraction of a sub-component is mandatory before editing these four, not optional.
   - **Test-gate reachability (section 11).** No A3-owned test script exists yet. Each stream must register its new test in `atlas-client/package.json` in the same commit, or the evidence does not count.
   - **`BuildingView` has exactly one consumer** (`pages/Sections.tsx`), so the Fix 07/11/10 card-layout pass carries no timetable blast radius. `ROOM_TYPE_LABELS` is also read by `pages/Subjects.tsx`, so room-type changes must be additive.

**Verdict:** baseline statuses re-confirmed and made actionable at `3cfe79a8`. Two rows are blocked on an A2 dependency decision (30 firm, 19 soft). No browser evidence obtained this session.

### 2026-09-27 — ledger relocated; two planner corrections

- **Ledger home.** This file moved from the Codex-managed worktree `C:/Users/njgro/.codex/worktrees/lane-a3-ui-ux-handoff/ATLAS` (branch `work/planner-a3-ui-ux-handoff`, `d22c7f21`) to a planner-provisioned worktree `E:/ATLAS-worktrees/lane-a3-ui-ux-ledger` (branch `docs/a3-ui-ux-ledger`, `d22c7f21`). Reason: the session's write permission resolves to `D:/ATLAS`, `D:/ATLAS-worktrees`, `E:/ATLAS-worktrees` and opencode config paths only, so the Codex-managed copy was not writable. The old checkout is a **Codex-managed worktree** and is listed in `docs/reference/agent-worktree-lifecycle.md` under "Never retire or modify", so it was **not** moved or removed; it is frozen as history and this branch is the single writable successor. Disposition of the old checkout: `PRESERVE_FOR_DECISION`.
- **Correction 1 (withdrawn claim).** The previous planner turn reported the AGENTS.md section 3 cap of 12 task worktrees as exceeded (~22 `lane-*` registrations) and raised it as a blocker. That reading is wrong and is withdrawn. The lifecycle reference states the cap is on *active* worktrees, never the registered total, because `git worktree list` necessarily includes Codex-managed worktrees and retained release trees; a registry count above 12 is explicitly not a blocker. This is the same misreading recorded on 2026-09-21. No capacity gate applies to A3 stream provisioning. Measured free space for the record: E: 49.20 GiB before this worktree, 48.62 GiB after (588 MiB checkout), both far above the 25 GiB warning line.
- **Correction 2 (relocation was never available).** A straight relocation was assessed and rejected as prohibited, not merely unavailable, per the same lifecycle reference.

### 2026-09-27 — Fix 30 dependency resolved: primitive-wide (operator decision)

- **Decision.** Fix 30 is authorized **primitive-wide**: A3 will edit `ui/select.tsx` itself rather than applying route-scoped `SelectItem` overrides in A3-owned routes.
- **Authority relied on.** Explicit operator instruction to Planner A3 on 2026-09-27 ("primitive wide, commit, and proceed"). This is the A2-accepted dependency handoff required by `AGENTS.md` section 3 of the A3 ownership boundary, granted at operator level rather than by A2 directly.
- **Blast radius, stated up front.** `ui/select.tsx` is consumed by four A2-owned timetable files: `components/timetable/simple/SchedulerExportCenterDialog.tsx`, `SimpleBeneficiaryControls.tsx`, `SimpleHeaderHelpers.tsx`, `SimpleMoreMenuContent.tsx`, plus 7 pages and 3 other components app-wide. The change is confined to the `SelectItem` class list at `ui/select.tsx:117`: add the `data-[state=checked]:bg-accent` (and matching `data-[state=checked]:text-accent-foreground` if the existing token pairing needs it) that `ui/dropdown-menu.tsx:101` already demonstrates for the sibling primitive. No prop, API, or exported-name change.
- **Retained risk carried by the executor.** The selected-item state must remain visibly distinct from the highlighted state, since the historical defect was precisely that checked had a foreground but no background. A route-scoped regression control in A3 routes is not sufficient evidence on its own; a control must assert the state against a timetable `Select` consumer too, or the primitive change is unproven. A3 does not edit those timetable files; the control only renders them.
- **Fix 19 unchanged.** Still route-scoped. `ui/dropdown-menu.tsx` is not in scope for this decision and is not edited.
- **Status effect.** Fix 30 moves from A2-dependency-blocked to dispatchable. Fix 19 remains the only soft dependency, and it is resolved by scoping, not by an approval.

### 2026-09-27 — three candidates produced; three planner premises refuted by the executors

1. **Fixes/IDs and outcome.** 29 of 34 rows now `IMPLEMENTED_PENDING_QA` across three candidates, all from base `3cfe79a8`. Unchanged: 01 and 02 (`TODO`, preservation controls only), 08 (`BLOCKED_PRODUCT_DECISION`), 27/28/34 (`BLOCKED_SOURCE_GAP`).
2. **Base SHA and candidate SHAs.** Base `3cfe79a883df92a24e3436a42f7e180bb2d768b8`.
   - S1 Sections and room map: **`13f1f189`**, 12 paths. Worktree `E:/ATLAS-worktrees/lane-a3-sections-map`, branch `work/a3-sections-map`.
   - S2 Subjects: **`6ba386dc`**, 10 paths. Worktree `E:/ATLAS-worktrees/lane-a3-subjects`, branch `work/a3-subjects`.
   - S3 Teachers and Teaching Load: **`f56ef29e`**, 19 paths. Worktree `E:/ATLAS-worktrees/lane-a3-teachers-load`, branch `work/a3-teachers-load`.
   All three confirmed reachable from the integration boundary with `git cat-file -t`. None pushed. All three worktrees clean, unintegrated, `PRESERVE_FOR_DECISION`.
3. **Exact changed paths.** Streams are disjoint except `atlas-client/package.json`, where each adds exactly one distinct script key (`test:a3-sections-map`, `test:a3-subjects`, `test:a3-teachers-load`). Pure single-line additions, so the three will auto-union at integration. Every new test file is reachable from a committed script in the same commit, per section 11.
4. **Focused test command/result.** S1 `test:a3-sections-map` 15/15, `test:global-scrollbars` exit 0, build exit 0. S2 `test:a3-subjects` 19/19, `test:global-scrollbars` 1/1, `test:client-quality` 34/34, `test:ux-guardrails` 31/31, build exit 0. S3 `test:a3-teachers-load` 33/33, `test:global-scrollbars` exit 0, `test:ux-guardrails` 31/31 including `gate-reachability.test.ts`, build exit 0. All `git diff --check` clean.
5. **Desktop browser result at 1366x768.** **Not performed for any stream.** No accessibility, console or network capture exists yet. Every pixel-density, legibility and contrast claim in all three commit messages is structural only and is labelled as such. S1 discloses that effective card text is 9.0px for five-floor buildings (11 to 15.4px for up to three floors) because the authored size is 11px and the fit scale is width/height bound. S3 discloses its density claim is structural only. These are browser-acceptance rows, not source rows.
6. **Negative control.** Failing-first controls were proven, not assumed. S1 proved the Fix 12 control fails on the current shape and passes after. S2 restored the base `SubjectFormModal` via `git restore --source=3cfe79a8 --worktree`, observed 2 controls fail including `no result region rendered for outcome saved`, then byte-restored and verified the SHA. S3 proved the Fix 29 swap control failing-first at base with `actual: [[41, 700, 4, 9]]`, a real transfer dispatched by a body click, going from 1 pass/4 fail to 5/5, restore verified by SHA-256. Mutation-capable flows (Fix 12 home-room, Fix 29 swap, Fix 25/26 return path, Fix 20 cancel) all carry zero-change Cancel controls as required.
7. **A2 dependency and explicitly retained risk.**
   - **BLOCKING, needs an A2 or operator decision: the Fix 07/11 card re-layout reaches A2-owned code.** See the premise-failure record below. `BuildingView` is rendered by `timetable/CenterWorkspace.tsx`, which A3 must not change the behaviour of. The candidate does not edit that file, but it changes the rendering contract underneath it. This must be adjudicated before integration, not after.
   - **S3 Fix 30 deviation accepted and better than the packet.** The packet told the executor to copy `ui/dropdown-menu.tsx:101` (`bg-accent`/`text-accent-foreground`). The executor proved at source that `--accent` aliases `--primary` and `--accent-foreground` is white, so that pairing would render checked pixel-identical to highlighted, reintroducing the exact defect. It used `--secondary` instead, and proved the state against the A2-owned `SimpleBeneficiaryControls` without editing it.
   - **S3 Fix 25 deviation accepted.** `Faculty.tsx:901` row navigation is deliberately left in place: it carries a `task=` intent consumed by `useTeachingLoadRouteIntent`, which is not an A3 file, and it drives the repair queue. The two page-level `Review load` links were converted in place, which is the Fix 25 scope.
   - **S2 scope note, NON_BLOCKING.** `programFullLabel` in `deped-glossary.ts:33` still renders "Regular Program" inside the coverage dialog. That file is shared and outside Fix 31's stated scope, and a primitive-wide change has no authority here.
   - **Two evidence-integrity items carried into QA, both disclosed rather than hidden.** S3 made a whitespace-only edit at `SubjectRow.tsx:582` AFTER its gate runs, with staged and stripped SHA-256s recorded and the lines proven token-identical; QA must confirm the committed bytes are the tested bytes. S3 also demoted control F23-4, which no longer claims pointerdown-outside dismissal because Radix routes it through `dispatchDiscreteCustomEvent` and it is unreachable from a JSDOM-dispatched event; the row names it a browser-acceptance item rather than deleting it. Under section 16 a correction must be additive, so QA must confirm both rows still exist and carry their limits.
   - **Pre-existing failures, proven not regressions.** 12 `test:client-suite` failures and 4 typecheck errors (an undeclared `playwright` import in A2 timetable tests) exist at base and reference none of the changed paths. S3 additionally reduced its own client-suite to 1 failure by running after the others; `SchedulingPolicyPane.tsx` is blob `ab49e4ae5d75ad9284f878ac4ce7cedc5a95ac48` at base and in the candidate.
   - **Donor verification, S3.** The `node_modules` copy was removed and the donor proven unchanged: 156 top-level entries, 17,348 files, 229,100,225 bytes and a recursive path|length|mtime manifest SHA-256 `ECBD1506…03D5` identical before and after. Donor reparse points 0, worktree reparse points 0, junction-free.

#### Planner premise failures — recorded because they changed the work

Three claims the planner asserted as verified evidence were false. Both executors caught them independently and were right. The cause was the same: a `Select-String` glob (`atlas-client\src\**\*.tsx`) that does not recurse, so the searches measured almost nothing while reporting a confident number.

1. **"BuildingView has exactly one consumer."** False. It has four: `sections/SectionRoomMapModal.tsx`, `dashboard/CampusReadinessCard.tsx`, `campus-map/CampusMapOverview.tsx`, and A2-owned `timetable/CenterWorkspace.tsx`. The search matched only `from '@/components/BuildingView'` and missed every `lazy(() => import('@/components/BuildingView')...)` form. This is the cause of the BLOCKING item above, and it is why the packet asserted the card re-layout had no timetable blast radius.
2. **"Only 4 `dark:` occurrences exist across the client, so the app is effectively light-only and `GRADE_COLORS` is safe to adopt as-is. Recorded as measured, not assumed."** False and doubly misleading: it was 15 across 5 files, and the claim was dressed as a measurement when it was an artefact of the broken glob. A2 timetable files carry full dark variants. Presenting a broken search as verified evidence is the specific failure section 11 warns about, and it is recorded here so the pattern is not repeated.
3. **"`GRADE_COLORS` uses `amber` for G8 where the directive says yellow" and "two grade palettes exist."** Both false. G8 is `yellow-100/700` in `lib/grade-labels.ts` and in `components/GradeLevelBadge.tsx`, so no reconciliation was ever needed. Six palettes exist, and `components/GradeLevelBadge.tsx` already is the DepEd-correct, dark-aware badge Fix 18 asked for. The S3 packet pushed the executor toward creating the very duplicate palette it was told to avoid. The bounded correction reversed it: `components/faculty/GradeBadge.tsx` on `GRADE_COLORS` was deleted and replaced with a zero-palette adapter in `components/faculty-assignments/GradeBadge.tsx` that imports `GradeLevelBadge` and contributes only `aria-label` and data attributes. One palette is now in play across `WorkloadInspector` and `FacultyProfileSheet`, asserted at source, with dark variants verified for all four grades.

**Verdict:** three candidates exist and are reachable; nothing is pushed or integrated. 29 rows are `IMPLEMENTED_PENDING_QA`; no row was promoted to `QA_PASSED` because no independent review has run and no browser evidence exists. One BLOCKING cross-lane decision is outstanding.

## Planned stream boundaries (proposed, not dispatched)

Three streams, three worktrees, one writer each, all under `E:/ATLAS-worktrees/lane-a3-*` from base `3cfe79a8`. Consolidated pairs preserved: 13+18, 14+16, 17+23, 25+26, 33A+33B.

**S1 - Sections and room map** (`work/a3-sections-map`): fixes 03, 06, 07, 10, 11, 12; 08 held.
Paths: `components/sections/SectionRoomPicker.tsx` (304), `components/sections/SectionRoomMapModal.tsx` (417), `components/BuildingView.tsx` (612), `components/sections/SectionHomeRoomModals.tsx` (210), `pages/Sections.tsx` (983, extract first), plus new extraction modules.

**S2 - Subjects** (`work/a3-subjects`): fixes 09, 15, 17, 19, 20, 31, 32, 33A, 33B; 23 lands with S3's dialog pattern.
Paths: `components/subjects/SubjectFormModal.tsx` (806), `SubjectFilterToolbar.tsx` (124), `SubjectCoverageSheet.tsx` (293), `SubjectRow.tsx` (239), `lib/subject-constants.ts`, `components/admin-workspace/AdminWorkspace.tsx` (301), `pages/Subjects.tsx` (989, extract first).

**S3 - Teachers and Teaching Load** (`work/a3-teachers-load`): fixes 13, 14, 16, 18, 21, 22, 23, 24, 25, 26, 29, and 30 route-scoped only.
Paths: `components/faculty-assignments/WorkloadInspector.tsx` (387), `SubjectRow.tsx` (651), `TeacherGridMode.tsx` (604), `TeachingLoadModals.tsx` (71), `components/faculty/FacultyProfileSheet.tsx` (293), `components/faculty/FacultyRow.tsx` (651), `lib/grade-labels.ts` (167), `pages/TeachingLoad.tsx` (925, extract first), `pages/Faculty.tsx` (990, extract first).

## Execution sequence

1. Reconfirm the baseline in a clean A3 worktree and close 01, 02, 04, 05, 06, and 14 before proposing changes.
2. Plan Sections/Map as one stream: 03, 07, 08, 10–12.
3. Plan Subjects as one stream: 09, 15, 17, 19, 20, 31, 32, 33A/B.
4. Plan Teachers/Teaching Load as one stream: 13, 16, 18, 21–26, 29, 30.
5. Keep 13+18, 14+16, 17+23, 25+26, and 33A+33B as consolidated changes rather than independent patches.

## Handoff completion condition

Return one compact ledger update against this file with every row in a terminal or explicitly blocked state. Include the candidate range, exact changed paths, decisive tests, browser evidence, known risks, and a clear verdict. Do not claim timetable acceptance, deployment, publication, or data mutation evidence.
