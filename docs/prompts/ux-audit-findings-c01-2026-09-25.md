# UX-AUDIT-FINDINGS-C01 packet (2026-09-25)

Fix the class-schedule UX audit findings **3, 4, 6, 7** and re-verify **2, 9** on the current build.
Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` follow-up. Source: independent second
acceptance pass on `ff87b06b` (Lane A). Tier: **MEDIUM client UI**. No deployment, generation,
publication, or login.

- Base SHA: `18c80288328d54cc6412593bf585daea3474c9a9`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/ux-audit-c01` / `fix/ux-audit-findings-c01`
- Read `docs/reference/agent-verification-gates.md`, `docs/reference/agent-live-browser-qa.md`, and AGENTS §8.

## Verified findings and evidence

- **F3 — warning triangle has no explanation.** `TimetableGrid.tsx:501` renders a bare
  `<AlertTriangle className="size-3.5 shrink-0 text-amber-500" />`; 20/21 triangles carried a name, **1 did
  not** (near the "Working from saved data" surface).
- **F4 — text too small.** `TimetableGrid.tsx:891` table `text-xs`, `:912` time cell `text-xs`, `:480/481/485`
  entry `text-xs` (12 px), `:367/394` `text-[0.6rem]` (9.6 px).
- **F6 — published cells look editable.** `:480/481` `cursor-pointer`, `:486` `<GripVertical>`,
  `:455` aria-label `Select …`; on the **published** run the cells are still `button "Select …"` with a
  pointer cursor (no drag handles observed, but the affordance remains).
- **F7 — everyday tasks only under "More".** `simple/SimpleMoreMenuContent.tsx:71-90` holds the four daily
  tasks; the header surfaces only lifecycle/Download/New version/More. The release grouped them
  ("Daily tasks" / "Expert tools" / "Help & display") but did not surface them.
- **F2, F9 — re-verify only.** F2: the published view shows "New version", not "Generate" (looks fixed).
  F9: the standalone "Term: Term 2" control (`TimetableSimpleHeader.tsx`) — do not regress.

## Required changes

- **F3:** give the per-entry warning indicator a truthful accessible name **and** a hover/focus explanation
  via the `@/ui` `Tooltip`/`HoverCard`/`Popover` primitives — **never** a native `title` or `<details>`
  (AGENTS §8). No unlabelled warning glyph may remain.
- **F4:** raise the grid's time labels, entry subject, and teacher/room line to **≥14 px**, and the 9.6 px
  flags to a legible size, **while preserving the no-scroll architecture** (§8: root stays
  `h-[calc(100svh-3.5rem)]`; difference is absorbed only inside the grid's own
  `flex-1 min-h-0 overflow-auto` region — no global browser scrollbar). If ≥14 px cannot fit every surface,
  document the chosen size and the layout change per viewport.
- **F6:** make a **published** run genuinely read-only — no drag handle, no grab/pointer cursor, no
  `Select …` action; a draft keeps its edit affordances. Drive it from the published state
  (`isRunPublished`), not from CSS alone.
- **F7:** surface the **daily** tasks (Place unresolved sessions, Swap sessions, Teacher leaving /
  Reassign load, Review room requests) as labelled header actions (or an equivalent always-visible
  control), keeping the expert tools under More. Do not change their behaviour.
- **F2/F9:** verify, do not change.

## Owned paths

`atlas-client/src/components/timetable/TimetableGrid.tsx`, `TimetableDraggableEntry.tsx`,
`TimetableGridConflictBadge.tsx`, `TimetableSimpleHeader.tsx`,
`simple/SimpleMoreMenuContent.tsx`, `TimetableToolbar.tsx` (only if a header control needs it), tests, and
`atlas-client/package.json` (only your own `test:ux-audit-findings` line).

**Do NOT touch** the just-deployed swap/revision lane's files: `ScheduleReviewWorkspace.tsx`,
`TeacherDepartureRecoverySheet.tsx`, `modals/PublishedSwapRevisionPanel.tsx`,
`modals/TimetablePlacementDialogs.tsx`, `lib/timetable-swap-routing.ts`, `lib/published-revision-client.ts`;
or any `atlas-server/**`; or `docs/plans/**`.

## Acceptance

1. **Failing-first** where provable: on the published run, edit affordances (drag/`Select …`/pointer) are
   present before and absent after; F3 shows an unlabelled triangle before and a labelled one after.
2. Two viewports (`1366×768`, `390×844`): no global scrollbar (§8), grid region scrolls internally; the
   F4 sizes are the rendered ones; the daily tasks are reachable without opening More.
3. No regression to F2/F9 and to the lifecycle controls; existing tests updated additively only.
4. New suite registered as `test:ux-audit-findings`; client suite + `gate-reachability` green; every touched
   React component file ≤ 1000 physical lines (B5).

## Evidence

One commit + short handoff: base · candidate SHA · changed paths · what changed and why · the failing-first
controls · decisive commands with results · each risk `BLOCKING`/`NON_BLOCKING` · verdict
`REVIEW_REQUIRED`. Then a fresh independent `atlas-qa`. `atlas-client/package.json` is resolved by union at
integration.
