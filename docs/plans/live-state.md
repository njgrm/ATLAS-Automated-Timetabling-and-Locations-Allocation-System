# ATLAS Live State

Current operational truth only, kept under 60 lines. Update it when a live fact changes; do not append history.
Full history to 2026-09-30: `docs/archive/2026-09/live-state-to-20260930.md` (and Git).

Last reconciled: 2026-10-02 evening (Lane C, p07 supervised cutover).

## Objective

A correct, calm ATLAS for school 1 on EnrollPro's active year: dependable Teaching Load, a term-aware timetable that
schedulers can hand-fix and publish, official printouts, and SMART-family visual cohesion (`DESIGN.md`).

## Live release
- Pending approved cutover: `4b046877803fad0f57341114db1155a0c72fc362` (prefix `4b046877`), narrow P06c timetable-control clarity release at `E:\ATLAS-runtime-supervised-f973e0e7-20261002`; rollback remains the current `5b084c7591d45a85e609aa05aec7ef76c68e4d98` runtime source.
- LIVE: `5b084c7591d45a85e609aa05aec7ef76c68e4d98` (prefix `5b084c75`), p07 Flag/HGP timetable controls,
  deployed 2026-10-02. Tree `E:\ATLAS-runtime-supervised-5b084c75-20261002`; supervised API 5001 and client
  5174 are target-owned. Post-cutover health and database-backed subjects read are 200; the Tailnet client serves
  `SchedulingPolicyPane-C01uMS9A.js` with the recorded target hash and `HGP` marker.
- Rollback basis: incumbent `fdae67ec64a4713d7c5c2446e03c25c29ddf704f`, with predecessor `c82b8636`; runner
  audit captures the pre-cutover task XML and machine runtime variables.
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
