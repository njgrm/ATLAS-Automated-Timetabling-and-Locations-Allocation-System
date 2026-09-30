# ATLAS Live State

Current operational truth only, kept under 60 lines. Update it when a live fact changes; do not append history.
Full history to 2026-09-30: `docs/archive/2026-09/live-state-to-20260930.md` (and Git).

Last reconciled: 2026-09-30 evening (Lane C, trim after the demo).

## Objective

A correct, calm ATLAS for school 1 on EnrollPro's active year: dependable Teaching Load, a term-aware timetable that
schedulers can hand-fix and publish, official printouts, and SMART-family visual cohesion (`DESIGN.md`).

## Live release
- LIVE: `fdae67ec64a4713d7c5c2446e03c25c29ddf704f` (prefix `fdae67ec`), train 21, deployed 2026-09-30 11:17 +08.
  Tree `E:\ATLAS-worktrees\lane-a4-release-20260930-21prod`. Includes decision 15 (teacher lunch) and the header
  hotfix `c82b8636`.
- Rollback basis: `c82b8636` (train 20), tree `E:\ATLAS-worktrees\lane-a4-release-20260930-20prod`.
- Next: train 22 (move-swap c2 `8c1b9218`, unassigned panel `22b34170`, placement feasibility `8766c084`/`fffa830c`),
  after the 3 header tests are updated. The deploy gate (`ops/runtime/deploy-runner.ps1`) requires the target
  prefix to be written in THIS section before cutover.
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
