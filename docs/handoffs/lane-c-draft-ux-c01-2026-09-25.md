# Handoff: DRAFT-UX-C01 (Lane C, 2026-09-25)

Tier MEDIUM, client-only. Packet: `origin/docs/lane-c-draft-ux:docs/prompts/lane-c-draft-ux-c01-2026-09-25.md`.
Next step: one `atlas-qa` on range `d6ff9a44...<candidate>`, then planner integration. D1 is Lane C's
deployment row (browser, after a release). It is not a source row.

- **Base:** `d6ff9a44` (clean registered worktree `E:/ATLAS-worktrees/lane-c-draft-ux-c01`, branch `work/lane-c-draft-ux-c01`)
- **Candidate:** the branch head. Commits: `f7d1098b` (S3/S4), `3e894d0e` (S1/S2/S5), then this handoff.
- **Verdict (executor):** READY_FOR_QA

## Changed paths (30)

Production (13):
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`: the header now renders at most 6 visible controls. It uses a merged warnings control, picks one primary with `resolveSimpleHeaderPrimary`, and passes More ▸ Schedule actions plus the unassigned entry.
- `atlas-client/src/components/timetable/simple/SimpleHeaderActions.tsx` (new): pure decisions (`resolveSimpleHeaderPrimary`, `resolveWarningsControlDispatch`, `lifecycleStepNeedsMoreEntry`, `countUnassignedForSelectedTerm`), `SimpleWarningsControl`, `SimpleMoreScheduleActions`, `SimpleUnassignedSessionsItem`.
- `atlas-client/src/components/timetable/simple/SimpleSessionDetails.tsx` (new): a Dialog at ≥768 px and a Sheet below it. The TIME card shows day plus start–end, warnings show severity signs, and actions sit in one row.
- `atlas-client/src/components/timetable/TimetableGridConflictBadge.tsx`: adds `SeveritySign` and `severitySummary`. `EntrySeverityIndicator` now renders a sign plus a count when N>1 (S3).
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`: the inline details Sheet is replaced by `<SimpleSessionDetails>`. Handlers are the same and the redo strip is passed as `topSlot`.
- `atlas-client/src/hooks/useTimetableState.ts`: adds `useMediaMinWidth(px)` and `SESSION_DETAILS_DIALOG_MIN_WIDTH = 768`. `useIsDesktop` (1024 px) is untouched.
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`: new task `unassigned-sessions`, which renders `SimpleUnassignedSessionsPanel`.
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`: adds `renderUnassignedReasonBadgeFor` (shared) and `SimpleUnassignedSessionsPanel`, which is the same `GeneratedUnassignedPanel`.
- `atlas-client/src/components/timetable/LeftRailContent.tsx`: uses the shared reason-badge renderer. Output is identical.
- `atlas-client/src/components/timetable/TimetableSimpleTypes.ts`: adds `'unassigned-sessions'` to `TimetableSimpleTask`.
- `atlas-client/src/components/timetable/simple/SimpleMoreMenuContent.tsx`: new `unassignedEntry` slot at the head of Daily tasks.
- `atlas-client/src/components/timetable/simple/SimpleBeneficiaryControls.tsx`, `SimpleHeaderHelpers.tsx`: the "Term" and "View type" labels are removed. `SimpleGenerateAction` gains `primary`. Tutorial steps are retargeted to live controls.

Tests: the new file `atlas-client/src/components/timetable/__tests__/draft-ux-c01.test.tsx` (10 tests) is wired as
`test:draft-ux-c01` and into `test:client-suite` (`atlas-client/package.json`). 15 existing test files were
re-pinned where the operator decision replaced a contract. Each changed assertion is kept as a comment marked
`SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25)`. The 15 files: `scheduler-warning-clarity-c01`,
`timetable-header-collapse-c01`, `timetable-relaxed-main-c01`, `ux-audit-findings-c01`, `ux-audit-findings-c01-dom`,
`ux-r03b-center-view-routes`, `ux-r03e-timetable-runs-setup`, `schedule-clarity-c03`,
`timetable-dynamic-workspace-rendered`, `timetable-dynamic-workspace-truth-fixes`, `timetable-operator-workflow-state`,
`timetable-scheduler-clarity-c01`, `timetable-ux-rehaul-c01`, `ux-quickfix-c01-header-actions`, `ux-r02-simple-stripdown`.
Commit `3e894d0e`'s message says "14". The correct count is 15.

## Rows: failing-first then pass (literal commands, from `atlas-client/`)

Base run: `npx tsx --test src/components/timetable/__tests__/draft-ux-c01.test.tsx` on `d6ff9a44` sources gave
**0 pass / 9 fail**. That run used the first nine tests. Afterwards only selectors and the Move-time call order were
corrected, and a tenth test (the tutorial guard) was added. The candidate run of `npm run -s test:draft-ux-c01` gave **10 / 0**.

| Row | Base failure (decisive) | Candidate |
|---|---|---|
| S1 | `expected ≤6 visible controls at ≥1280 px, got 9: review-setup · term · view · picker · download · generate · publish · primary-action · more` (run state); 8 in the no-run state | pass. No run: Generate is the solid primary. Run: Publish is solid and exactly 6 controls show. Download, School information and Generate are in More. The warnings control dispatches `review-issues`, and More drops the duplicate. The tutorial targets all exist. |
| S2 | `no visible "Term" label (visible texts: … Term · Term 2 · View type …)` | pass. `aria-label="Term"` and `aria-label="View type"` are kept. |
| S3 | `no "Schedule note ·" text in the cell` (fixture: real `FACULTY_EXCESSIVE_IDLE_GAP` shape, 90 min on TUESDAY, limit 60) | pass. SOFT shows `data-severity-icon="warning"` with aria "1 warning". HARD+SOFT shows `must-fix` with a count of 2 and aria containing "Must fix". |
| S4 | module `simple/SimpleSessionDetails` absent | pass. At 1366 px the `role="dialog"` is centred (`left-[50%] top-[50%]`, `max-w-[720px]`, `overflow-y-auto`) with no sheet. At 390 px the sheet shows. TIME reads `Tuesday · 09:00–10:00`. Six action buttons appear once each. |
| S5 | `More carries an "Unassigned sessions (N)" entry` not found | pass. This is an outcome test with the real header and drawer. With a Term 2 item and a Term 1 item it shows "(1)". Clicking it opens `#panel-unassigned` with the pin `Unassigned session 701-31-3`. With only a Term 1 item it shows "(0)", disabled with "No unassigned sessions in Term 2." |

**S6 preservation.** `npm run -s <script>` was run for all 35 `test:*` scripts on the base and on the candidate
(runner: a scratchpad loop over `package.json` scripts).
- `test:client-suite`: base 961 pass / 17 fail, candidate 971 / 17. The failure set is identical by name (`diff` → IDENTICAL_FAILSET).
- Every other script matches base. Pre-existing failures that reproduce on base:
  - `test:publish-drift-revision-s4-client` 1 (R6 drift banner)
  - `test:timetable-relaxed-main` 4 (A8 marker, B5 1000-line cap on `TimetableGrid.tsx`, and two playwright files)
  - `test:timetable-post-deploy-c04/c05` and `test:timetable-scheduling-quality-c03` (`playwright` is not installed)
  - `test:ux-guardrails` 1 (a test file with no script)
  - `test:warning-readability` 2 (R1/R2 server-code copy)
  - the client-suite 17, which include the ones above plus the beneficiary-export, C04 sync-toast and empty-state operator-sentence rows
- `npx tsc --noEmit -p tsconfig.json` → only the pre-existing `Cannot find module 'playwright'` errors (3 files) and one TS7006 in `timetable-scheduling-quality-c03`. No error in a touched file.
- `VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net' npm run build` → `✓ built in 4.15s`. The build guard requires the non-secret origin. This was a local build only; nothing was deployed.
- Component line counts: all ≤1000. The largest are `TimetableTaskDrawer.tsx` 986, `SimpleHeaderHelpers.tsx` 873 and `TimetableSimpleHeader.tsx` 849.

## Decisions defaulted (operator may override)

1. **Breakpoint.** The existing `useIsDesktop` is 1024 px, not 768. The packet says ≥768, so I added `useMediaMinWidth` with `SESSION_DETAILS_DIALOG_MIN_WIDTH = 768` (Tailwind `md`). This matches the task drawer's `md:` layout.
2. **"Clicking any session" (S4).** The dialog replaces the drawer wherever the details opened before: a click on a session with a warning, and "View class details". A click on a session without a warning still opens only the inline selection bar. Opening a modal on every click would block swap and move picking on the grid.
3. **Published run.** The primary slot is the published status surface, and "New version" (Generate) moves into More. From the working draft with a published run there is no primary, as before (B9).
4. **Former lifecycle next steps.** These were Retry schedule check, Open Year Setup/Teaching Load repair, Start draft, Try generating again and Review follow-ups. Each is one More ▸ Schedule actions entry, "Next step: …". Fix blockers and Review warnings are the merged warnings control.

## Risks

- NON_BLOCKING: when generation is blocked with no run, the visible primary is a disabled Generate. It has a reason tooltip and aria text. The repair ("Recheck generation readiness" or the Teaching Load link) is now one click deeper, in More. This follows the operator's primary rule. D1 should look at whether a first-time user finds it.
- NON_BLOCKING: the merged warnings control wraps the shared `SimpleReadinessChip` (a `div` Badge) inside a `button`. It renders and works, but the HTML content model prefers phrasing content inside a button.
- NON_BLOCKING: the unassigned count uses `draft.unassignedItems` filtered by `termFilter`. The panel list uses the hook's term-, program- and kind-filtered list. Simple resets the program and kind filters, so the two agree there.
- NON_BLOCKING: test environment. The worktree has no own `node_modules`. `atlas-client/node_modules` is a junction to `E:/ATLAS-worktrees/lane-c-schedule-clarity-c03/atlas-client/node_modules`, which is the same `package-lock.json` hash (`ACEF8E37…`) and is not a release. Nothing was installed. Vite touched its transient `.vite-temp`, which is now empty. The junction was removed (`cmd /c rmdir`, link only) before handoff, so QA has to supply its own tree.
- `subagent_tokens`: none (no dispatch).
