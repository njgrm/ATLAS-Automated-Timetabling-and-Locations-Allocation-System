# TT-UX01 — Timetable Operator Readiness One-Shot — Progress Ledger

Prompt: `docs/prompts/timetable-ux-one-shot-ttux01-2026-09-11.md`
Worktree: `D:/ATLAS-worktrees/timetable-ux-01` Â· Branch: `work/timetable-ux-01`
Risk tier: MEDIUM client/UI with HIGH interaction guardrails (no live mutation)
Base SHA: `aab8fb002fb54d0f009525fd68ddc99b9baa5f88` (refreshed `origin/main`, clean worktree)

Live-tree divergence: the Tailnet serves `D:\ATLAS` at `f6c86e06` (pre-TT-C04);
`origin/main` is `aab8fb00` and already contains `84d64437` (TT-C04) and
`f94cfbcf` (TT-C04R2). Live evidence therefore shows both open and already-fixed
defects. Every TTX item below was re-proved against the refreshed base; live
screenshots were captured for the divergence record only.

## TTX disposition (re-proved against base)

| ID | Status | Evidence |
|---|---|---|
| TTX-01 | FIXED | Center no-run branch (CenterWorkspace.tsx) no longer renders `timetable-empty-primary-actions` / `Start Pre-Generation Draft`; it defers to the header action. RED `TTX-01` â†’ GREEN. |
| TTX-02 | FIXED | `GeneratedRunRailPanels.tsx` gates "schedule is clean"/"No violations found" on `hasGeneratedRun`; `TimetableTaskDrawer.tsx` gates the empty claim on `context.summary`. RED/GREEN `TTX-02`. |
| TTX-03 | FIXED | Advanced badge renders `No generated run yet` when `activeGeneratedRunId == null`, never `#-`. RED/GREEN `TTX-03`. |
| TTX-04 | FIXED | Readiness + failed-run copy is no longer `hidden ... sm:block` or `truncate`; wraps fully and is visible on all widths. Playwright: `clipped:false` at 1280x720, 640x360, 390x844. RED/GREEN `TTX-04`. |
| TTX-05 | FIXED | `Place unresolved sessions`, `Swap sessions`, `Review issues` are `disabled={!runToolsAvailable}` with an sr-only reason and test ids. RED/GREEN `TTX-05`; Playwright asserts `aria-disabled=true`. |
| TTX-06 | FIXED | Entity `SearchableSelect` is disabled with an accessible reason when the option source is empty; `disabled`/`disabledReason` added to the primitive. RED/GREEN `TTX-06`; Playwright combo disabled. |
| TTX-07 | FIXED | Tutorial `Show me` reports `timetable-simple-tutorial-unavailable` when the target is absent instead of silently no-opping. RED/GREEN `TTX-07`; Playwright asserts visible feedback. |
| TTX-08 | FIXED | Tutorial trigger has `aria-label="Open timetable tutorial"` and 44px mobile target; More trigger and the mobile schedule-sheet trigger also 44px on mobile. RED/GREEN `TTX-08`. |
| TTX-09 | FIXED (by TTX-01/TTX-04) | The clipped 640x360 center CTA is removed and the reason is now visible; local center ScrollArea preserves a scroll path. Playwright: no global overflow at any required viewport. |
| TTX-10 | ALREADY-FIXED UPSTREAM + tooltip | At base the 509-char guidance is `sr-only` (no visual clip) and the run-source note is `sr-only`. Added a `Tooltip` disclosure on the visible source-truth badge. |
| TTX-11 | FIXED | `loadRoomRequestSummary` treats `NO_ACTIVE_DRAFT` as an empty summary (no error); the duplicate standalone effect is removed; `loadAll` only requests when a `COMPLETED` run exists. Playwright: zero `/room-preferences/.../latest/summary` 404s. RED/GREEN `TTX-11`. |
| TTX-12 | FIXED | The permanently hidden `timetable-simple-publish-action` (and its tooltip block) is removed. RED/GREEN `TTX-12`. |

## Failing-first tests

New tracked tests appended to `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts`
(production-consumer source assertions + existing pure helpers).

- RED (before fix): `npm run test:timetable-operator-ux` â†’ tests 34, pass 24, fail 10
  (all ten `TTX-*` tests failing).
- GREEN (after fix): `npm run test:timetable-operator-ux` â†’ tests 34, pass 34, fail 0.
- Full tracked client suite (18 files, lib + hooks) â†’ tests 155, pass 155, fail 0.

## Gates (clean worktree)

- `npm run test:timetable-operator-ux` â†’ 34/34 (exit 0).
- Full tracked client suite (`tsx --test` over `lib/__tests__` + `hooks/__tests__`) â†’ 155/155.
- `npx tsc --noEmit` (atlas-client) â†’ exit 0.
- `npm run build` (atlas-client) â†’ exit 0.
- `git diff --check` â†’ exit 0 (see commit evidence).

## Packaging defect (recorded, not repaired)

`npm run test:timetable-conflict`, `npm run test:ux-guardrails`, and
`npm run test:auth-session` reference client test files that are not tracked at
`origin/main`. `test:timetable-conflict` fails with
`Could not find 'src/lib/__tests__/timetable-live-conflict.test.ts, .../tactical-sandbox-dock-helpers.test.ts'`.
These are pre-existing durability defects; no untracked files were copied from
`D:\ATLAS`. The valid clean-worktree gate is `npm run test:timetable-operator-ux`.

## Live read-only QA (observation-only)

- Live origin: `https://njgrm.buru-degree.ts.net` (tree `f6c86e06`).
- Viewports: 1440x900, 1366x768, 1280x720, 1024x768, 390x844, 360x800, 640x360.
- Mutation guard recorded zero issued writes; one unique `/room-preferences/1/9/latest/summary` 404.
- Before/after live signature identical (runtime school 1 / year 9 / `2030-2031` /
  `atlas-persisted` / drift `aligned`; runs 0; Teaching Load `POPULATED v2`, 265
  assignments; room summary 404). Only live effect is the disclosed login
  `lastLoginAt`/audit write.
- Artifacts: `qa-artifacts/ttux01-2026-09-11/live-*.{png,json}` (uncommitted).

## Isolated candidate QA through Tailnet (no live writes)

- Candidate served from this worktree on port 5183 bound `0.0.0.0`, opened as
  `http://100.88.55.125:5183`, proxying `/api/v1` to the live API read-only.
- Viewports: 1280x720, 640x360, 390x844 (screenshots captured).
- Blocked no-run: exactly one primary `Fix Curriculum Requirements`; no center
  write CTA; no false clean claims; readiness visible and `clipped:false`;
  selectors/menu items disabled with reasons; tutorial unavailable feedback;
  Advanced badge `No generated run yet`; zero room-pref 404s; zero issued writes.
- Ready no-run fixture (intercepted `readiness`+`runs`): single `Start draft`,
  one pre-generation open request, zero generation writes.
- Failed-latest fixture (intercepted FAILED run + ready): single
  `Try generating again`, zero generation writes before confirmation.
- All candidate mutations were intercepted and fulfilled locally; zero forwarded.
- Artifacts: `qa-artifacts/ttux01-2026-09-11/candidate-*.{png,json}` (uncommitted).

## Files changed

- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/simple/SimpleHeaderHelpers.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts`
- `atlas-client/src/ui/searchable-select.tsx`
- `CHANGELOG.md`, this ledger

## Independent advisory review

- Reviewer 01 (fresh context `ses_f7332929effevVLe1LILg1r2Lo`, did not implement):
  base `aab8fb00` ... candidate `4f92374e`; verdict `CORRECTION_REQUIRED`.
  - F1 BLOCKING: the mobile `SimpleScheduleSheet` trigger was 28px wide (label
    hidden below 420px), failing AC-10's 44px hit-area requirement.
  - F2 NON_BLOCKING: behavioral negative controls live in uncommitted QA
    artifacts; tracked TTX tests are production-consumer source assertions.
  - F3 NON_BLOCKING: dead CenterWorkspace prop + always-false branch in the
    no-run room-request path.
  - F4 NON_BLOCKING: `SearchableSelect` only fails closed when `disabled` is
    passed explicitly; the one in-scope caller passes it.
- Correction commit: added `min-h-11 min-w-11` + testid to the schedule-sheet
  trigger and a tracked TTX-08 pin; simplified the no-run room-request branch.
  Re-ran `test:timetable-operator-ux` 34/34, `tsc --noEmit` exit 0, and the
  candidate Playwright blocked/ready/failed fixtures (all pass, sheet trigger
  measured >=44x44 at 390x844). F2/F4 remain accepted as NON_BLOCKING.

## Safety confirmation

No merge, push, migration, live mutation, generation, publication, server change,
term/Teaching Load/derived-demand change, or companion-repository edit was made.
Port 5001 and the live Vite process on 5174 were not restarted. The isolated
candidate dev server on 5183 is stopped after QA.

---

# TT-UX01R2 — Simple Timetable operator closure (overnight one-shot)

Prompt: `docs/prompts/timetable-simple-operator-one-shot-ttux01r2-2026-09-11.md`
(from commit `0da881ca`; read only, not merged or cherry-picked).
Review base: `aab8fb00`. Starting candidate: `aa38d784`.
Branch/worktree: `work/timetable-ux-01` Â· `D:/ATLAS-worktrees/timetable-ux-01`.

## Correction scope (R1–R8)

| ID | Status | Evidence |
|---|---|---|
| R1 | DONE | New `src/lib/timetable-capabilities.ts` is the single generation/capability decision; Simple + Advanced both call `deriveTimetableCapabilities`. Advanced Generate/Regenerate route through the gate and show the Year Setup repair when blocked. Generation confirmation now lists school year, source, retained anchors, unassigned, and what generation does/does not do. |
| R2 | DONE | `/curriculum-requirements` removed from Timetable navigation/copy; `fix-setup` routes to `YEAR_SETUP_HREF` (`/admin/year-setup`). `describeSetupState` never names the superseded page. |
| R3 | DONE | Selected-class menu adds `Change room` (manual-edit room) and `Change Teaching Load owner` deep-link; `Teacher leaving (all classes)` replaces the misleading one-class `Change teacher`. Details sheet mirrors the actions. |
| R4 | DONE | `TimetableGrid` renders `placement-target-label` with `Place`/`Swap` icon+text; hard/soft cells keep `Blocked`/`Warning`; Simple header carries a persistent `TimetableStatusLegend`. |
| R5 | DONE | `ConflictDetails` renders human conflict titles/details with bounded list + Expand; draft/generated swap commit disabled on any hard blocker; blocked generated swap lists decisive blockers and hides commit. |
| R6 | PARTIAL | Tutorial/help now state the real review-or-one-click+Undo contract; stale/failure guidance preserved in dialog copy. No server contract change. Remaining risk: the clean one-click path still relies on the existing auto-save + Undo strip rather than a before/after review, which is one of the two contracts R6 permits. |
| R7 | DONE | `simpleTutorialSteps(lifecycle)` yields no-run / generated / published step sets; no-run help teaches setup+generation only. |
| R8 | DONE | Per-action gates (`viewSelection`, `setupInputStatus`, `roomRequests`, `move`, `changeRoom`, `swap`, `ownerRepair`, `issueReview`, `generation`, `publication`) each carry `enabled`, `reason`, `repair`. |

## Gates (candidate worktree)

- `npm run test:timetable-operator-ux` â†’ 57/57 (exit 0); new capability 13/13 and
  repair 10/10.
- Full tracked client suite (`tsx --test` over `lib/__tests__` + `hooks/__tests__`)
  â†’ 178/178 (exit 0).
- `npx tsc --noEmit` (atlas-client) â†’ exit 0.
- `npm run build` (atlas-client) â†’ exit 0.
- `git diff --check aab8fb00..HEAD` â†’ clean.

## Controlled Playwright fixtures (real production components)

- Harness: `qa-artifacts/playwright/ttux01r2/fixtures.ts` (hermetic `/api/v1/**`
  interception; no request forwarded).
- Spec: `qa-artifacts/playwright/specs/ttux01r2-simple-operator.spec.ts` â†’
  7/7 passed against the candidate dev server on `127.0.0.1:5183`.
- Scenarios: setup-blocked, ready no-run + generation confirmation boundary,
  failed latest run, generated-clean selected-class repair menu, generated-issues
  readiness, published read-only, and a console/pageerror health sweep.
- Every scenario asserts zero non-GET requests.
- Screenshots: `qa-artifacts/ttux01r2-2026-09-11/generated-*.png`.

## Live Tailnet read-only matrix

- Spec: `qa-artifacts/playwright/specs/ttux01r2-live-readonly.spec.ts` â†’
  1 passed; viewports 1280x720, 390x844, 720x720 (zoom-equivalent).
- Runtime observed: school year 9 / `2030-2031` / `atlas-persisted` / drift
  `aligned`.
- Zero POST/PUT/PATCH/DELETE page requests; generation confirmation opened only
  if reachable and cancelled. No live generation.
- No global horizontal overflow, no mojibake, no page errors.
- Screenshots: `qa-artifacts/ttux01r2-2026-09-11/live-*.png`.
- Note: the live Tailnet bundle is `D:\ATLAS` (pre-correction); live evidence is
  a read-only baseline, and corrected behavior is proven on the candidate.

## Files changed (source/tests/docs)

- `atlas-client/src/lib/timetable-capabilities.ts` (new)
- `atlas-client/src/lib/__tests__/timetable-capabilities.test.ts` (new)
- `atlas-client/src/lib/__tests__/timetable-operator-repair.test.ts` (new)
- `atlas-client/src/lib/simple-timetable-state.ts`
- `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/timetable/simple/SimpleHeaderHelpers.tsx`
- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
- `atlas-client/src/components/timetable/modals/TimetableWorkflowDialogs.tsx`
- `atlas-client/src/components/timetable/timetableContexts.types.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/package.json` (test script)
- `docs/verification/timetable-simple-operator-click-path-matrix-2026-09-11.md`
- `CHANGELOG.md`, this ledger

## Independent review

- Reviewer 01 (fresh context `ses_f72502d2fffervntv95QVqHz6l`, did not
  implement): base `aab8fb00` ... candidate `3a721ba4`; verdict
  `CORRECTION_REQUIRED`.
  - F1 BLOCKING: the Simple More "Teacher leaving / Reassign load" item was an
    enabled run-only action with no generated run (R1 violation).
  - F2 NON_BLOCKING: Advanced `Requests` button ignores the derived
    `roomRequests` gate (read-only navigation; pre-existing).
  - F3 NON_BLOCKING: Advanced `Publish` uses an inline predicate without the
    `isPublished` guard (pre-existing; server-authoritative).
  - F4 NON_BLOCKING: click-path matrix and Playwright harness are gitignored /
    uncommitted evidence.
  - Reviewer reran `test:timetable-operator-ux` 57/57, full client suite
    178/178, `tsc --noEmit` exit 0, `git diff --check` clean.
- Correction commit: gated the teacher-departure menu item on
  `runToolsAvailable` with the screen-reader reason, pinned it in the TTX-05
  and a new R1 repair test, and re-ran `test:timetable-operator-ux` 58/58 plus
  the controlled Playwright fixture matrix 8/8. F2/F3 remain recorded as
  NON_BLOCKING pre-existing.
- Reviewer 02 (fresh changed-scope context `ses_f724793b2ffeg18BV8zET5KLLC`):
  base `aab8fb00` ... candidate `cf03ed78`; verdict `ACCEPT_READY`.
  - F1 CLOSED at the production path; no ungated `onOpenTeacherDeparture` call
    site remains.
  - F5 NON_BLOCKING: the ledger carried mojibake from a local re-save. Corrected
    in `a1e1bce6` (docs-only; em/en dashes restored to UTF-8).
  - Reran `test:timetable-operator-ux` 58/58, full client suite 179/179,
    `tsc --noEmit` exit 0, `git diff --check` clean.

## Remaining risks / next planner action

- No React component-render test harness exists; R3/R4/R5/R7 component behavior
  is covered by source-wiring tests plus Playwright. A rendered component test
  harness is the durable follow-up.
- R6 clean path is one-click + Undo (permitted contract); confirm the product
  owner accepts it over explicit before/after review.
- F2 (Advanced Requests gate) and F3 (Advanced duplicate-publish guard) are
  pre-existing, out of this prompt's edit scope, and recorded for the planner.
- Final code acceptance is at `cf03ed78` (Reviewer 02). `a1e1bce6` is a
  docs-only ledger encoding correction on top of it; rerun code gates only if
  integration rebases source.

