# ATLAS Live State

Current operational truth only, kept under 60 lines. Update it when a live fact changes; do not append history.
Full history to 2026-09-30: `docs/archive/2026-09/live-state-to-20260930.md` (and Git).

Last reconciled: 2026-10-03 15:35 MPST (2026-10-03 train live; runtime and changed-screen browser acceptance verified).

## Objective

A correct, calm ATLAS for school 1 on EnrollPro's active year: dependable Teaching Load, a term-aware timetable that
schedulers can hand-fix and publish, official printouts, and SMART-family visual cohesion (`DESIGN.md`).

## Live release
- LIVE: `e44d49256715cd2fa955e009b795904a9abb7b9d` (prefix `e44d4925`), 2026-10-03 train, deployed 2026-10-03 12:20
  MPST at `E:\ATLAS-worktrees\lane-a4-release-20261003-e44d4925`. SYSTEM task result
  `20261003-121858-e44d4925` is LIVE; independent post-action runtime and Terra live browser acceptance are complete for the changed screens.
- Rollback basis: incumbent `a46710d6aa9c0312c18d0f9881a4cd622f51b959` (prefix `a46710d6`) at
  `E:\ATLAS-worktrees\lane-a4-release-20261003-a46710d6`; prior accepted P06c remains the historical fallback.
- Acceptance: live Tailnet browser checks passed for Class Schedule/Health Break, Subjects, Teachers filters, and
  Teaching Load Edit/Save at desktop viewport; no console errors and origin asserted. Mobile visual judgement remains
  unperformed for this train.
- Runtime: API 5001, client 5174, funnel `https://njgrm.buru-degree.ts.net`; staging API 5101 (not responding
  2026-09-30 17:00, unverified since).

## Live data
- Database `atlas_recovery_clean_rebuild_20260905` on localhost:5432. Live data is school test data.
- Latest reviewed published output: run 360 (zero HARD, 108 SOFT violations; handoff corrected 2026-10-03). Its 156
  lunch warnings predate decision 15; regenerating clears them (needs operator approval).
- Run 356 is stuck RUNNING (a deploy restarted the server mid-Generate); harmless, mark stale when convenient.

## Open items
- Makabansa generator repair (decision 14): the generator should move one blocking class instead of giving up.
- Relaxed header, one row above the grid: preserved candidate `70c49489` in `lane-a7-relaxed-header` is clean but
  239 commits behind `origin/main`; a no-commit salvage merge hit semantic conflicts in `atlas-client/package.json`,
  `TimetableSubNav.tsx`, and the header-budget test. It also reintroduces the retired `Draft`/`Published` fallback
  words after D1. No A7 source is integrated; restart from current main is required.
- Fast release path: a fixed script run by an elevated scheduled task; no AI holds admin (Lane C proposal, 30 Sep).
- SMART/AIMS direct federation: EnrollPro only today; companion repos stay read-only.

## Where things are
- Rules: `AGENTS.md`, `CLAUDE.md`. Decisions (locked): `docs/plans/operator-decisions.md`. Design: `DESIGN.md`,
  `PRODUCT.md`.
- Manager: `ops/lane-c/codex/MANAGER.md`, `PLANNERS.md` (queue); run state `D:/ATLAS-lane-c/manager-state.md`.
- Channels: `docs/handoffs/lane-c-to-a2.md`, `docs/handoffs/lane-a-to-c.md` (short; history archived).
