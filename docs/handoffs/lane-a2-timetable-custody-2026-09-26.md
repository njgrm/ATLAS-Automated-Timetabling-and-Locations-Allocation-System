# Handoff — timetable custody returns to Planner A2 (2026-09-26 11:30 +08)

**Operator decision (2026-09-26):** Planner A2 owns timetable work (client and server timetable, schedule
review, violations, manual edits, publication UX). Planner A keeps general / non-timetable work. This ends
the overnight arrangement in which both planners wrote timetable candidates and collided on the
plain-language module (J2/J3, reconciled as `de392cf8`). Written by the Claude Code Lane C session that
walked live; it takes no timetable work itself.

## Custody rule (to stop the next collision)

- **One timetable writer.** Before creating a timetable worktree, list `git worktree list` and
  `git ls-remote origin 'refs/heads/work/*'` for anything touching the same files. If another lane holds an
  open candidate, **take it over or wait — never start a parallel one**.
- Planner A is to finish or park the one in-flight item below and then stop timetable work.

## In flight at handoff — do not duplicate

- **Unnamed-violation class fix (Planner A, started 11:26).** Worktree
  `E:/ATLAS-worktrees/lane-a-violation-label-guard-20260926`, branch `work/lane-a-violation-label-guard`
  (not pushed), base `e6500884`, **dirty**: `violation-presentation.ts`, `types.ts`,
  `simplePublishReadiness.ts`, and three tests. Planner A measured the gap: the server's canonical
  `VIOLATION_CODES` (`constraint-validator.ts:39`, 26 codes) has exactly one code without a client label,
  `FACULTY_LUNCH_WINDOW_VIOLATION`; the fix is that label plus a structural guard that every server code has a
  client label. **A2's first action:** confirm with the operator whether Planner A pushes this candidate
  (A2 then runs `atlas-qa` and integrates) or hands the dirty worktree over. Preserve it either way (§3).

## State

- **Live:** `26f7c907` since 09:41 (health 200, ready 200). Acceptance **incomplete**: A5 partial, A7 pass
  (8 console errors, all EnrollPro proxy 502 — upstream `dev-jegs` down), A6 and A12(b) not reached.
  Rollback basis `116a7658`. `main` is ahead of live with `aa7f6f67` (repo-wide 1000-line cap, ManualEditPanel
  split) and docs only.
- **Live walk:** `docs/reviews/timetable-live-walk-20260926/findings.md` (Claude in Chrome, 11 observed /
  2 blocked). Top items: (1) the unnamed lunch-window group, 100/194 warnings — being fixed above;
  (2) the Review-issues panel still says `Hard/Soft/SOFT/hard blockers`, not "Must fix"; (3) no
  draft/published label in the header; (4) no Undo in Simple; (5) Room view has no empty state; phone
  390×844 unverified (Chrome window would not resize).
- **Overnight audit:** `docs/reviews/timetable-ux-audit-20260926/audit.md`. C1, C2, C3, J2, J3 landed and are
  live. Still open from it: finding 6 (drift hides the term-authority notice, §7), finding 7 (unassigned
  evidence surface unreachable), finding 10 (Undo/Redo absent in Simple) — verify each on `main` before acting.
- **A2's own registered residuals:** 6 J2 sweep items (de-snake-case fallback in `ManualEditPanel.tsx` and
  `QuickPlaceSummaryModal.tsx` — confirmed on live by Planner A — plus `Subject #<id>`,
  `PublicationApprovalInbox`), the server `actorName` for manual-edit history, and the §7 fail-closed
  term guard.
- **Constraint-severity line (Planner A) is CLOSED, not fixable by a planner.** A live flaw lets a
  `PLACE_UNASSIGNED` proposal carrying client `metadata` (`deferredRoomTypePreference` or
  `roomAssignmentReason: 'MODULAR_POOL_ASSIGNED'`) turn `ROOM_FEATURE_MISMATCH` from HARD to SOFT
  (`manual-edit.service.ts:692`, `constraint-validator.ts:869-872`). Packets R1–R3 were withdrawn; R3's
  review (`CORRECTION_REQUIRED` 2/12) proved the obvious fix breaks Quick Place and Teaching Load repair
  (`cbde91d0`). Decisions D1–D3 in `74e7b744` await the **operator**. Do not re-packet without them.

## Operator decisions awaited (timetable)

1. Constraint severity D1–D3 (above).
2. Lunch-window and 180-minute-block violations: keep as non-blocking warnings, or make them block publishing?
3. Undo/Redo in the Simple layout?
4. Who finishes the in-flight label fix (Planner A push → A2 QA, or A2 takes the worktree)?

## Cost

This Claude session's browser walks: 68,237 (blocked, no sign-in) + 132,100 `subagent_tokens`.
