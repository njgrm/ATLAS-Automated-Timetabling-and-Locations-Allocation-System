# UX-AUDIT-FINDINGS-C01 correction packet (2026-09-25)

Bounded correction over reviewed candidate `6ba6197b`. Governing packet:
`docs/prompts/ux-audit-findings-c01-2026-09-25.md`; this addendum overrides where they differ.

- Prior candidate (must stay an ancestor): `6ba6197ba246f1082faebcbad0f7c784510ad134`
- Branch / worktree: `fix/ux-audit-findings-c01` / `E:/ATLAS-worktrees/ux-audit-c01`
- Fresh independent QA returned `CORRECTION_REQUIRED` 11/13. Add **one** new commit; do not amend.

## R1 (BLOCKING) — F4 rendered size fails at 390×844

`text-sm` renders **13.125 px** on mobile because `:root{font-size:15px}` applies `@media (width<=640px)`
and `--text-sm: .875rem`. The brief requires rendered **≥14 px at both** viewports.
- Use an **absolute** size for the grid base, time-label, entry-subject and teacher/room line so both
  viewports render ≥14 px (e.g. `text-[14px]`/`style`-absolute — not a rem token that the mobile root
  override shrinks). Give the ceremony/placement flags an **absolute ≥12 px** floor too.
- Keep the no-scroll architecture (differences absorbed only in the grid's own
  `flex-1 min-h-0 overflow-auto` region).
- Update the tests so they assert the **rendered/absolute** size (resolve rem against the viewport root, or
  assert the absolute class/value), not merely `text-sm` — the current class-only assertions cannot catch
  this.

## R2 — finish F6 for the Advanced layout (close the defect class)

The published-read-only signal is set only by `TimetableSimpleHeader`, which renders only in
`layoutMode === 'simple'`; a **published** run in the Advanced layout still shows drag handles / `role="button"`
/ pointer / `Select …`. Publish the read-only signal from a place that covers **both** layouts (the
container `ScheduleReviewWorkspace.tsx` and/or `ScheduleReviewWorkspaceHeader.tsx`), driven by the same
published predicate (`isRunPublishedStrict`). A **draft** keeps its affordances in both layouts.
- Failing-first: with a published run in Advanced, the cells are editable before and read-only after.
- If a deliberate product reason keeps Advanced published editing, STOP and report it rather than forcing
  read-only — do not guess.

## Owned paths (additions to the governing packet)

The above plus `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx` and
`ScheduleReviewWorkspaceHeader.tsx` (now free — the swap/revision lane landed). Everything else stays as
the governing packet: do not touch `TeacherDepartureRecoverySheet.tsx`, `modals/*`,
`lib/timetable-swap-routing.ts`, `lib/published-revision-client.ts`, `atlas-server/**`, `docs/plans/**`.

## Preserve / prove

- `6ba6197b` remains an ancestor; reviewed paths not touched by R1/R2 keep their `6ba6197b` blobs.
- Re-run: `npm run test:ux-audit-findings`, `npm run test:client-suite`, client `gate-reachability`,
  `npm run typecheck`, `npm run build` (with `VITE_ENROLLPRO_URL`), `git diff --check`. The 15 client-suite
  failures and the gate-reachability trio are pre-existing — reproduce/confirm, don't fix.
- Every touched React file ≤ 1000 physical lines (B5; `TimetableGrid.tsx` is at 995 — prefer moving the
  new absolute-size logic without growing it past the cap).

## Evidence

One new commit (no push). Handoff: prior candidate · correction SHA · changed paths · what changed and why
· the failing-first control for R2 · the rendered-size proof for R1 at both viewports · confirmation that
`6ba6197b` is an ancestor · each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a fresh
independent QA over the correction's blast radius.
