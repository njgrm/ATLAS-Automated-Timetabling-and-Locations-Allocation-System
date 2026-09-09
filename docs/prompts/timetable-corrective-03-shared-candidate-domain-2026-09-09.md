# TT-C03 — Shared Timetable Candidate Domain

## Objective

Unify the invariant candidate checks used by timetable construction, repair,
and the TT-C02 preview so that the same room-capacity, compatibility,
occupancy, and interval rules produce the same answer on every path. Preserve
specialized generator behavior and report truthfully where a preview does not
prove global feasibility.

This is a `MEDIUM` source/test task under the default commit-based workflow.
It authorizes no live data write, timetable generation, publication, runtime
restart, schema change, migration, or companion-repository edit.

## Execution setup

1. Use a fresh session. From `D:\ATLAS`, fetch `origin` and create or reuse the
   clean worktree `D:\ATLAS-worktrees\timetable-ttc03` on branch
   `work/timetable-ttc03`, based on current `origin/main`.
2. Before editing, record the exact base SHA, prove the worktree is clean, and
   prove `7f7aa8146f2c2a56568a52af46fef5bf89ad7599` is an ancestor.
3. Read `AGENTS.md`, `ATLAS_AGENT_KI.md`,
   `docs/reference/atlas-runtime-source-of-truth-map.md`,
   `docs/verification/timetable-scheduler-successor-map-2026-09-08.md`, and
   the TT-C02 production call paths.
4. If the worktree path already belongs to another branch or contains changes,
   do not reset, clean, stash, or absorb them. Stop with the exact conflict.

## Parallel boundary

TL-C02 is active in another worktree. Do not edit Teaching Load UI, routers,
services, policy/qualification/reconciliation code, faculty-assignment code,
curriculum authority, subjects, dashboard evaluation, schema/migrations,
authentication, backup/recovery, `.env`, or external EnrollPro/AIMS/SMART
clones. Consume their committed contracts only. If correctness requires an
unmerged TL-C02 API or a TL-owned edit, stop with the exact dependency rather
than crossing the boundary.

The initial TT-C03 boundary is timetable construction, repair, validation,
preview services, and focused timetable tests. Inspect the real call graph
before choosing the smallest exact changed-path set. New shared code must have
real production consumers; do not add an isolated helper used only by tests.

## Required implementation

1. Inventory the candidate-acceptance rules in the canonical constructor,
   conflict repair/manual edit path, and TT-C02 preview. Record overlaps and
   path-specific rules before changing code.
2. Extract or extend one pure shared candidate domain for rules genuinely
   common to those paths, including:
   - positive identifiers and valid day/time interval shape;
   - half-open interval conflict detection for faculty, section, and room,
     including different-start-time overlaps;
   - canonical room capacity using persisted section enrollment;
   - room compatibility and persisted scope restrictions already enforced by
     the canonical generator;
   - explicit rejection of Homeroom Guidance as standalone timetable demand.
3. Wire every applicable production path to the shared domain. Keep rules that
   are unique to the generator, repair strategy, or preview in their owning
   layer; do not claim full-policy or joint-feasibility equivalence unless it
   is actually established.
4. Remove superseded duplicate predicates only after production consumers and
   focused equivalence tests prove the shared rule. Preserve deterministic
   candidate ordering and bounded search behavior.
5. Preserve source authority: curriculum demand comes from the persisted
   current-year Curriculum Requirements contract; faculty ownership and
   qualification come from canonical annual Teaching Load contracts. Do not
   infer, seed, or repair assignments.
6. Keep timetable latest-run reads memory-sensitive: do not broadly load or
   clone heavy generation JSON merely to evaluate candidates.

## Required verification

Add focused failing-first and post-fix tests against real production exports or
routes. At minimum prove:

- constructor, repair/manual candidate evaluation, and TT-C02 preview agree on
  the shared invariant result for representative accepted and rejected cases;
- a room with capacity 34 rejects enrollment 35 and exact capacity 35 accepts;
- different-start-time overlaps reject for faculty, section, and room while
  boundary-touching half-open intervals do not conflict;
- incompatible room type/scope and non-teaching facilities reject consistently;
- HG never becomes a schedulable demand line or candidate;
- deterministic ordering remains stable; and
- no live write, generation, publication, curriculum mutation, or Teaching
  Load mutation occurs.

Run only the focused affected timetable suites, server TypeScript, client
TypeScript only if client code changes, the affected production build(s), and
`git diff --check`. Run an isolated built-server smoke only if runtime imports
or routes change. Do not restart port 5001 and do not run historical broad
matrices.

## Review and immutable handoff

Obtain one fresh advisory review of the complete changed scope. Fix every
material finding; if fixes were made, obtain one changed-scope review. Do not
repeat zero-finding reviews. Then stage only the authorized durable source,
tests, and concise progress/review evidence, verify the staged path list and
`git diff --cached --check`, and create a conventional commit. Do not merge,
rebase, amend, force-push, or push.

Return `REVIEW_REQUIRED` with:

- base SHA and candidate SHA;
- exact changed paths;
- before/after production call-path map;
- which rules are shared versus deliberately path-specific;
- focused test/build results and failing-first controls;
- query/memory-shape evidence where relevant;
- advisory findings and their disposition;
- collision-boundary and zero-live-mutation proof; and
- the single remaining planner action.

Time budget: 90 minutes. At 75 minutes, freeze scope and finish decisive tests,
review, commit, and handoff. Do not weaken a safety or correctness gate to fit
the clock.
