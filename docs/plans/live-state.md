# ATLAS Live State

Current operational truth only, kept under 60 lines. Update it when a live fact changes; do not append history.
Full history to 2026-09-30: `docs/archive/2026-09/live-state-to-20260930.md` (and Git).

Last reconciled: 2026-10-02 evening (Lane C, p07 supervised cutover).

## Objective

A correct, calm ATLAS for school 1 on EnrollPro's active year: dependable Teaching Load, a term-aware timetable that
schedulers can hand-fix and publish, official printouts, and SMART-family visual cohesion (`DESIGN.md`).

## Live release
- LIVE: `4b046877803fad0f57341114db1155a0c72fc362` (prefix `4b046877`), narrow P06c timetable-control clarity
  release, deployed 2026-10-02 20:43 Asia/Manila. Tree
  `E:\ATLAS-worktrees\lane-a4-release-20261002-4b046877`; the SYSTEM release task confirmed `/api/v1/health/ready`,
  client 200, and that the 5001 listener runs from this tree. Independent post-action QA confirmed machine SHA/source,
  listeners 5001/5174, health 200, database-backed subjects 200, and an exact Tailnet-to-build asset match
  (`index-DEIh8rCq.js`, SHA-256 `0069a578ad6d4ecb35b2d816d7b37d5e299b8a77d97994ea86ef84948f98fe75`).
  Terra browser QA accepted 7/7 rows in authenticated Brave at 1366x768 and 390x844: published Term 1 Run 360,
  P06c warning copy, retained P07 Flag/HGP controls, no overflow or console errors. A page-load 201 from the
  collaboration-ticket endpoint issues a 60-second in-memory ticket; its client and server blobs are unchanged from
  the P07 release and it is not evidence of a durable timetable write.
- Rollback basis: prior accepted P07 release `5b084c7591d45a85e609aa05aec7ef76c68e4d98` at
  `E:\ATLAS-runtime-supervised-5b084c75-20261002`; the runner audit captures the pre-cutover task XML and machine
  runtime variables.
- Pending narrow A2/A5 release target: `a46710d6aa9c0312c18d0f9881a4cd622f51b959` (prefix `a46710d6`),
  prepared at `E:\ATLAS-worktrees\lane-a4-release-20261003-a46710d6`. The current LIVE release
  `4b046877803fad0f57341114db1155a0c72fc362` (prefix `4b046877`) is the cutover rollback basis.
  This line authorizes no claim that the target is live; record a cutover only after the SYSTEM task and post-action QA.
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
