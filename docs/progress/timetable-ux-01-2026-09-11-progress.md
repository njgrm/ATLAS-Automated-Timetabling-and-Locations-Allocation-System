# TT-UX01 — Timetable Operator Readiness One-Shot — Progress Ledger

Prompt: `docs/prompts/timetable-ux-one-shot-ttux01-2026-09-11.md`
Worktree: `D:/ATLAS-worktrees/timetable-ux-01` · Branch: `work/timetable-ux-01`
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
| TTX-01 | FIXED | Center no-run branch (CenterWorkspace.tsx) no longer renders `timetable-empty-primary-actions` / `Start Pre-Generation Draft`; it defers to the header action. RED `TTX-01` → GREEN. |
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

## Failing-first testsNew tracked tests appended to `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts`
(production-consumer source assertions + existing pure helpers).

- RED (before fix): `npm run test:timetable-operator-ux` → tests 34, pass 24, fail 10
  (all ten `TTX-*` tests failing).
- GREEN (after fix): `npm run test:timetable-operator-ux` → tests 34, pass 34, fail 0.
- Full tracked client suite (18 files, lib + hooks) → tests 155, pass 155, fail 0.

## Gates (clean worktree)

- `npm run test:timetable-operator-ux` → 34/34 (exit 0).
- Full tracked client suite (`tsx --test` over `lib/__tests__` + `hooks/__tests__`) → 155/155.
- `npx tsc --noEmit` (atlas-client) → exit 0.
- `npm run build` (atlas-client) → exit 0.
- `git diff --check` → exit 0 (see commit evidence).

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
