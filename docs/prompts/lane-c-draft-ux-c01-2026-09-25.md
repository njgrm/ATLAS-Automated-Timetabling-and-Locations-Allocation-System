# DRAFT-UX-C01 — scheduler header, desktop session modal, cell warnings, unassigned access (Lane C, 2026-09-25)

Owner: Lane C. Tier: **MEDIUM** (client-only production UI; no server, Prisma, migration, generation,
publication or timetable-data change). Loop: `atlas-executor → one atlas-qa → planner integration`.
Base: `origin/main` `d6ff9a44`. Branch `work/lane-c-draft-ux-c01`, worktree
`E:/ATLAS-worktrees/lane-c-draft-ux-c01` (registered, clean at creation). Load `atlas-timetable-invariants`
and follow `AGENTS.md` §8 (frontend constraints: `@/ui` primitives only, no `title`/`<details>`, ≤1000
lines per component file) and §10.

## Evidence (live `eb0e3038`, draft run 318, Term 2)

Browser reproduction (Claude in Chrome, 1366×768, read-only, 5/0/0) plus the operator's screenshot
`E:/ATLAS-worktrees/lane-c-draft-ux-docs/qa-artifacts/lane-c-draft-ux-2026-09-25/operator-warning-cell-bottom-sheet-1917w.png` (local; `qa-artifacts/` is git-ignored) (1917 px wide):

- Header row: 10 controls — `194 warnings` · `School information` · "Term" label + `Term 2` · "View type"
  label + `Section` · `GR7 - Luna` · `Download schedules` · `Generate` · `Publish schedule` ·
  `Review warnings` · `More`. The page top bar also shows `Active Term: T2`.
- Cells show inline "⚠ Schedule note · N" badges instead of the earlier warning signs.
- Clicking a session **with a warning** at 1917 px opens a full-width bottom sheet ("Simple class summary"),
  i.e. the mobile drawer on desktop. Its **TIME** card reads `Section view · GR7 · GR7 - Luna`, not the
  session's day and time (the time appears only inside the notes box). Actions are listed twice (an
  ACTIONS list and a button row). Clicking a session without a warning opens only the inline bottom bar.
- Unassigned sessions: 0 `[aria-label^="Unassigned session"]` nodes, no Unassigned panel, and nothing in
  More leads there. Root cause: `ScheduleReviewWorkspaceBody.tsx:65` returns the `layoutMode === 'simple'`
  body without `LeftRail`, and the Unassigned tab and its panel live only in `LeftRail` /
  `LeftRailContent.tsx:184` (`leftTab === 'unassigned'`). The simple (default) layout therefore has no
  path to unassigned sessions. Whether run 318 has unassigned items is unverified (the API read was not
  permitted); the fix must work for any count, including 0.

## Required changes (operator decisions, 2026-09-25)

1. **Remove the "Term" text label** beside the term dropdown, and the "View type" label likewise; keep
   accessible names (`aria-label`) on both controls.
2. **Relax the header to at most 6 visible controls at ≥1280 px**: Term · View · Section/teacher/room
   picker · one merged warnings control (the count badge and `Review warnings` become one button) ·
   **one primary action** · `More`. Primary action rule (operator): **`Generate` when the school year/term
   has no generated run; `Publish schedule` once a run exists** (the other then moves into More).
   `Download schedules` and `School information` move into More. Every action that was reachable stays
   reachable (More gets a clear group for them); no capability is removed. Behaviour of each action is
   unchanged; only placement changes.
3. **Cell warnings back to warning signs**: replace the "Schedule note · N" cell badge with a compact
   severity icon (Must fix vs warning, distinct icon and colour; the count may sit beside the icon when
   N>1). The note text moves to a `@/ui` Tooltip/HoverCard on the icon and to the session details. Keep
   the words "Must fix" / "warning" as the accessible label. Do not change which violations are shown.
4. **Desktop session details = a centred modal (`@/ui` Dialog), mobile keeps the drawer.** At ≥768 px
   (use the codebase's existing desktop breakpoint helper if there is one; name it in the handoff),
   clicking any session opens the same content in a centred dialog (max width about 720 px, scrolls
   internally, no global scrollbar). Below the breakpoint the current drawer stays. Improve the
   content while there: the TIME card shows the session's **day and start–end time** (fix the
   `Section view · …` value); show warnings with the same severity icons as the cell; show actions once
   (one button row: Move time, Change room, Swap, Change owner, Expert details, Close). No action changes
   behaviour.
5. **Unassigned sessions reachable in the simple layout**: when the active draft has unassigned items,
   the simple layout shows a visible entry with the count (e.g. a header chip or a `More` item
   "Unassigned sessions (N)") that opens the existing unassigned panel content (reuse
   `GeneratedUnassignedPanel` / `DraggableUnassignedPin`; placement by drag or by the panel's existing
   action must keep working). With 0 items, the entry shows 0 or is disabled with a reason; it must not
   vanish silently in a way that hides a non-zero count. Term filtering follows the selected term only
   (invariant 2: never Term 1 by default).

## Acceptance rows (harness named)

- S1 (unit/component, executor): header renders ≤6 visible controls; primary action = Generate with no
  run, Publish with a run; Download/School information/the other primary are in More. Failing-first.
- S2 (component): no visible "Term" or "View type" text label; the dropdowns keep accessible names.
- S3 (component): a cell with a SOFT note renders the warning icon (no "Schedule note ·" text in the
  cell); a HARD violation renders the Must-fix icon. Fixture taken from the real violation shape (the
  run 318 `IDLE_GAP`-style message "has 90 minutes idle gaps on Tuesday, exceeds limit of 60 minutes").
- S4 (component): at desktop width, selecting a session with a warning opens `role="dialog"` centred,
  not the drawer; at mobile width the drawer. TIME card shows day + start–end time.
- S5 (component, **prove the outcome**): in the simple layout with a draft carrying ≥1 unassigned item
  for the selected term, the user can reach the unassigned list from the visible entry and see the item;
  with an item only in another term, it is not counted.
- S6 (preservation): the client suite shows no new failures against base `d6ff9a44` (known baseline:
  pre-existing failures reproduce on base; list them); `tsc`/build pass; no component file >1000 lines.
- D1 (deployment acceptance, browser, **Lane C via atlas-browser-qa on Claude in Chrome**, after a
  release): rows S1–S5 on the live draft at 1366×768 and 390×844. Not a source row.

## Out of scope

Server/API changes, violation computation, the `Active Term: T2` page-top chip, EnrollPro
reachability (`dev-jegs` offline — host/network, not ATLAS), F1–F3, A3.

## Handoff

`docs/handoffs/lane-c-draft-ux-c01-2026-09-25.md` on the work branch, `AGENTS.md` §10 format, including
failing-first evidence per row and `subagent_tokens` if known. Commit per coherent item (checkpoint
every 45–60 minutes). Push the branch; do not merge to `main`.
