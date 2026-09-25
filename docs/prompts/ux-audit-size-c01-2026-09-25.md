# UX-AUDIT-SIZE-C01 packet (2026-09-25)

Land **R1 only** — absolute, viewport-stable font sizes — on top of the **accepted** `origin/main`
contract for the class-schedule UX audit. Everything else from `UX-AUDIT-FINDINGS-C01` is already on
main (`6ba6197b`) or was deliberately reworked/rejected there; do not re-open it.

- Base SHA: `4cb8b130101e9fae2bab560140e506b7fad3000b`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/ux-size-c01` / `fix/ux-audit-size-c01`
- Gates: `docs/reference/agent-verification-gates.md`, AGENTS §8.

## Why

Main's grid uses `text-sm` for the table/time/subject/teacher-room text and `text-xs` for the flags.
`index.css` applies `@media (max-width:640px){:root{font-size:15px}}`, so `text-sm` renders **13.125 px**
on a 390×844 viewport (`.875rem × 15px`) — below the audit's ≥14 px target. (Independent second
acceptance pass, finding 4.)

## Required change (R1 only)

- Make the grid's **table base, time label, entry subject, and teacher/room line** render an **absolute
  ≥14 px** at both `1366×768` (root 16 px) and `390×844` (root 15 px) — use absolute px values, not a rem
  token the mobile root override shrinks.
- Give the ceremony/placement and other small grid flags an **absolute ≥12 px** floor.
- Preserve the no-scroll architecture (§8): differences stay inside the grid's own
  `flex-1 min-h-0 overflow-auto` region; no global scrollbar.
- Update the existing R1 size assertions in
  `atlas-client/src/components/timetable/__tests__/ux-audit-findings-c01.test.tsx` and
  `…-dom.test.tsx` to assert the **rendered/absolute** size (resolve rem against the viewport root), not
  merely the class token — the current class-only assertions cannot catch the mobile shrink.

## Owned paths

- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/timetable/__tests__/ux-audit-findings-c01.test.tsx`
- `atlas-client/src/components/timetable/__tests__/ux-audit-findings-c01-dom.test.tsx`

Nothing else. **Do NOT touch** the read-only/disclosure contract or its owners:
`TimetableDraggableEntry.tsx`, `ScheduleReviewWorkspace.tsx`, `TimetableSimpleHeader.tsx`,
`ScheduleReviewWorkspaceHeader.tsx`, `TimetableGridConflictBadge.tsx`; nor the More menu /
daily-task placement; nor `atlas-server/**`, `prisma/**`, `docs/plans/**`. Do **not** re-add
`data-testid="timetable-simple-daily-tasks"` — main's accepted contract keeps the daily tools in More
(`ux-audit-findings-c01-dom.test.tsx` asserts it is `null`).

## Acceptance

1. **Failing-first:** on the base, the table/entry text is a rem token rendering **13.125 px** at a 390×844
   root (15 px) — the new assertion fails on base and passes on the candidate.
2. `1366×768` (root 16 px) and `390×844` (root 15 px): base/time/subject/teacher-room render **≥14 px**;
   flags **≥12 px**.
3. No global scrollbar; the grid scrolls internally.
4. **Main's accepted controls stay green:** `test:ux-audit-findings` (incl. the disclosure/read-only
   assertions and `warning-readonly-disclosure-c01`), the 15 pre-existing client-suite failures unchanged,
   the pre-existing `gate-reachability` trio unchanged.
5. `TimetableGrid.tsx` stays ≤1000 physical lines (B5; it is already near the cap — keep the edit minimal).

## Evidence

One commit + short handoff: base · candidate SHA · changed paths · what changed and why · the failing-first
control · the rendered-size proof at both roots · decisive commands with results (incl. that the disclosure
tests stayed green) · each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a fresh
independent QA. No push, no amend.
