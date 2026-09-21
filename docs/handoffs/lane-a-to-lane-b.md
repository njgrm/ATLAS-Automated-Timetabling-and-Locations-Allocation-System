# Lane A review — `ACTOR-SCHOOL-MUTATIONS-C01` plan (Lane B)

**Verdict: `APPROVED_FOR_IMPLEMENTATION`** — the plan is accepted as written, with two
recorded successors that must **not** be folded into it.

**Range reviewed:** `c08cc7d37e57ae2c31ac3432f3d0df917cadf506...70ab797ef989dec877125f68513ce219b6c95fcd`
(one commit, two documents, **no reserved path touched**).

## Independently verified

- **The count of eight is exactly right.** My own grep of `runtime.router.ts` finds eight
  `POST` routes calling `parseSchoolId(req.body?.schoolId ?? req.query.schoolId)` at lines
  164, 189, 233, 258, 276, 329, 375 and 393 — no more, no fewer.
- **Its exclusions are correct**: `GET /rollover-recovery/preview` (line 215) is a defaulting
  *read* route and is out of a mutation inventory; the term-authority routes (lines 468, 482)
  already use the separate JWT-only `authorizeTermAuthorityCaller`.
- **Calibration passed.** Reserved files untouched; unperformed rows declared honestly rather
  than claimed; the packet follows the house shape with **every acceptance row naming its
  deciding harness**; and it refused to broaden its own scope without review — which is the
  behaviour I most wanted to see.

## Accepted as-is

MEDIUM tier; the authorized-path set; the split between an explicit system-token target and a
JWT caller that must be privileged with a matching actor school; the rejection point before
locks, services, upstream calls, audit writes and notifications; the failing-first
verification sequence; the §11 script-reachability row (A7); and the isolated-port rule (A8).

## Two recorded successors — do not add them to this packet

Its own boundary rule ("do not broaden this packet without a separate inventory and review")
is right, so these are recorded, not absorbed:

1. **`ACTOR-SCHOOL-MUTATIONS-C02` — `faculty.router.ts:371`.**
   `DELETE /faculty/:id` uses `Number(req.query.schoolId ?? req.body.schoolId ?? 1)` under
   `authenticate` + `requirePrivilegedRole`. Same defect class, different router, same
   missing actor-school cross-check. Inventory and review it separately.
2. **`ROLLOVER-YEAR-IDENTITY-C01` — `runtime.router.ts:288` and `:341`.**
   `schoolYearId = Number(result.enrollProActiveYear?.id ?? 1)` silently turns a missing
   upstream active year into **year 1**. That is the same failure shape the timetable
   invariant forbids for terms — "missing term identity never becomes Term 1" — sitting on
   the rollover-sync path. It is deliberately **not** in this packet: changing how rollover
   resolves its year alters live-data behaviour and needs its own review.

## What I will verify when the implementation lands

Reproduce A1-A3 and A5-A6 with my own negative matrix; confirm the zero-dispatch counters are
genuinely instrumented rather than asserted; confirm A7's script actually reaches the new
test file; re-run one preservation suite; and check that no reserved path moved. Keep the
candidate immutable after reporting — corrections are new commits on the same branch.

## One process note

68% of your step budget for a plan-only deliverable is heavy. The charter plus `AGENTS.md` is
a large one-time read; front-load it once and then work leaner on the implementation run.

---

# Lane A response — integration boundary and the worktree-count rule (2026-09-21)

**Verdict on your integration blocker: `APPROVED_WITH_CORRECTION`.** Two thirds of it is a
rule misreading; the remaining third is a legitimate request, and it is granted below.

## 1. The "58 registered worktrees exceeds the 12 maximum" reading is wrong

`AGENTS.md` §3 caps **active task worktrees** at 12 — not the registry total. The registered
list necessarily includes trees that must be **preserved by rule**: dirty worktrees, unmerged
candidates, `node_modules` junction anchors, the never-retire `D:\ATLAS-runtime-*` release
trees, the three Codex-managed worktrees, and `D:/ATLAS` itself. The count is not a gate, and
treating it as one is what stranded you.

It is also already handled: on 2026-09-21 Lane A retired **56** clean, contained, unanchored,
inactive worktrees (112 → 57 registered; `D:` 15.81 → 40.76 GiB; `E:` 55.7 → 66.13 GiB), with
an independent pre-action audit and a post-action QA (`docs/reviews/worktree-reclaim-20260921/`).
What remains is policy-preserved, not neglected. **Do not retire anything to make room.**

Also: `D:/ATLAS` is the dirty historical root and is **never** an integration boundary. Its
dirty state is expected and is not a blocker for you.

## 2. Integration worktree — granted, exact path

Create exactly:

- path `E:/ATLAS-worktrees/integration-actor-school-mutations-c01`
- branch `integration/actor-school-mutations-c01`
- base: **current** `origin/main` (`65fe0728`)

Operator sanction: `E:` is the designated root for new worktrees. Lane A confirms the
12-active cap has room for this one. Disposition: `RETIRE_AFTER_INTEGRATION` — retire it in the
same closure that pushes, and do not delete the branch.

## 3. Your acceptance is now stale on the base, not on the content

**Your candidate `5735f0dc` is 11 ahead / 13 behind `origin/main` and no longer contains it.**
`main` advanced after your acceptance (`4c7c0bd9` → `65fe0728`): Lane A integrated
`DUP-READ-CALLERS-C01R` (candidate `360c026b`, per-token-epoch `/auth/me` memo) plus continuity
commits. So this is no longer a fast-forward.

On the new boundary: merge `5735f0dc` (do **not** amend or rebase your reported candidate),
expect a clean auto-union — Lane A's moved paths are client (`atlas-client/src/lib/settings.ts`)
and docs, yours are `atlas-server/**` — **re-run the combined gates on the merged tree**, then
push. If a real conflict appears, resolve it explicitly and record what you resolved.

## 4. Boundaries unchanged

No deploy, browser, login, credential, runtime or shared-data action from Lane B. The live
release stays **`4c7c0bd9`**, and Lane A owns deployment and is mid-cycle (the re-release of
`360c026b` is the current next action). Your candidate's only Lane A-adjacent paths are the
continuity docs — leave them alone; integration takes Lane A's copies from `main`.

## 5. Consequence worth stating plainly

The live release `4c7c0bd9` **predates your fix**, so runtime mutation actor-school enforcement
is **not live** until a release carrying it ships. That is expected, and it is Lane A's release
to make — not a reason to widen your scope.

## 6. Noted, non-blocking

The stale package scripts pointing at missing unrelated test files are a known baseline issue
(Lane A independently observed `test:auth-session` and `test:timetable-conflict` naming files
deleted at `4794bd9e`). Not yours to fix in this stream.

**Repo-wide rule this episode earns:** reading a workspace limit as a registry total — rather
than as a cap on *active* work — will strand any lane. Cite the rule's own noun.
