# ATLAS Live State

Current operational truth only, kept under 60 lines. Update it when a live fact changes; do not append history.
Full history to 2026-09-30: `docs/archive/2026-09/live-state-to-20260930.md` (and Git).

Last reconciled: 2026-10-03 15:35 MPST (desktop acceptance complete for the current release; mobile deliberately unperformed; A7 relaxed-header restart is a clean review candidate, not integrated).

## Objective

A correct, calm ATLAS for school 1 on EnrollPro's active year: dependable Teaching Load, a term-aware timetable that
schedulers can hand-fix and publish, official printouts, and SMART-family visual cohesion (`DESIGN.md`).

## Live release
- LIVE: `e44d49256715cd2fa955e009b795904a9abb7b9d` (prefix `e44d4925`), deployed 2026-10-03 12:20 MPST at
  `E:\ATLAS-worktrees\lane-a4-release-20261003-e44d4925`; desktop Tailnet acceptance passed for Class Schedule,
  Subjects, Teachers, and Teaching Load. Mobile acceptance remains unperformed by explicit operator direction.
- Rollback basis: `a46710d6` (full SHA retained in the release packet) at the preceding release worktree.
- Next: no cutover. Review the A7 candidate once, then assemble one batch of outstanding corrections; do not regenerate or
  publish live data without a separate HIGH approval.
- Runtime: API 5001, client 5174, funnel `https://njgrm.buru-degree.ts.net`; staging API 5101 (not responding
  2026-09-30 17:00, unverified since).

## Live data
- Database `atlas_recovery_clean_rebuild_20260905` on localhost:5432. Live data is school test data.
- Latest reviewed draft: run 359 (0 must-fix after the operator reassigned Makabansa's TLE, 30 Sep). Its 156 lunch
  warnings predate decision 15; regenerating clears them (needs operator approval).
- Run 356 is stuck RUNNING (a deploy restarted the server mid-Generate); harmless, mark stale when convenient.

## Open items
- Makabansa generator repair (decision 14): the generator should move one blocking class instead of giving up.
- Relaxed header, one row above the grid (candidate `6da50e65`, worktree `E:\ATLAS-worktrees\lane-a7-relaxed-header-r1`, clean;
  focused A7 4/4, A2 header rows 8/8, C11 16/16, header budget 29/29, and production build pass; independent QA and rendered
  loopback evidence still required before integration).
- Fast release path: a fixed script run by an elevated scheduled task; no AI holds admin (Lane C proposal, 30 Sep).
- SMART/AIMS direct federation: EnrollPro only today; companion repos stay read-only.

## Where things are
- Rules: `AGENTS.md`, `CLAUDE.md`. Decisions (locked): `docs/plans/operator-decisions.md`. Design: `DESIGN.md`,
  `PRODUCT.md`.
- Manager: `ops/lane-c/codex/MANAGER.md`, `PLANNERS.md` (queue); run state `D:/ATLAS-lane-c/manager-state.md`.
- Channels: `docs/handoffs/lane-c-to-a2.md`, `docs/handoffs/lane-a-to-c.md` (short; history archived).
