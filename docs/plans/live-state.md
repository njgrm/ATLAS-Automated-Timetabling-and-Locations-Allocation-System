# ATLAS Live State

Current operational truth only, kept under 60 lines. Update it when a live fact changes; do not append history.
Full history to 2026-09-30: `docs/archive/2026-09/live-state-to-20260930.md` (and Git).

Last reconciled: 2026-10-03 01:54 Asia/Manila (A2/A5 supervised cutover; browser acceptance pending).

## Objective

A correct, calm ATLAS for school 1 on EnrollPro's active year: dependable Teaching Load, a term-aware timetable that
schedulers can hand-fix and publish, official printouts, and SMART-family visual cohesion (`DESIGN.md`).

## Live release
- LIVE: `a46710d6aa9c0312c18d0f9881a4cd622f51b959` (prefix `a46710d6`), narrow A2 move/swap and A5
  unassigned timetable controls, deployed 2026-10-03 01:54 Asia/Manila at
  `E:\ATLAS-worktrees\lane-a4-release-20261003-a46710d6`. SYSTEM task result
  `20261003-015201-a46710d6` is LIVE; independent post-action runtime and Terra live browser acceptance are pending.
- Rollback basis: prior accepted P06c `4b046877803fad0f57341114db1155a0c72fc362` at
  `E:\ATLAS-worktrees\lane-a4-release-20261002-4b046877`; the runner audit captured pre-cutover task XML and machine
  runtime variables.
- Next: live browser acceptance of A2/A5, then separate placement-feasibility A6 scope. Do not equate the task
  LIVE receipt with rendered acceptance.
- Runtime: API 5001, client 5174, funnel `https://njgrm.buru-degree.ts.net`; staging API 5101 (not responding
  2026-09-30 17:00, unverified since).

## Live data
- Database `atlas_recovery_clean_rebuild_20260905` on localhost:5432. Live data is school test data.
- Latest reviewed draft: run 359 (0 must-fix after the operator reassigned Makabansa's TLE, 30 Sep). Its 156 lunch
  warnings predate decision 15; regenerating clears them (needs operator approval).
- Run 356 is stuck RUNNING (a deploy restarted the server mid-Generate); harmless, mark stale when convenient.

## Open items
- Makabansa generator repair (decision 14): the generator should move one blocking class instead of giving up.
- Relaxed header, one row above the grid (worktree `lane-a7-relaxed-header`, 19 uncommitted files: triage first).
- Fast release path: a fixed script run by an elevated scheduled task; no AI holds admin (Lane C proposal, 30 Sep).
- SMART/AIMS direct federation: EnrollPro only today; companion repos stay read-only.

## Where things are
- Rules: `AGENTS.md`, `CLAUDE.md`. Decisions (locked): `docs/plans/operator-decisions.md`. Design: `DESIGN.md`,
  `PRODUCT.md`.
- Manager: `ops/lane-c/codex/MANAGER.md`, `PLANNERS.md` (queue); run state `D:/ATLAS-lane-c/manager-state.md`.
- Channels: `docs/handoffs/lane-c-to-a2.md`, `docs/handoffs/lane-a-to-c.md` (short; history archived).
