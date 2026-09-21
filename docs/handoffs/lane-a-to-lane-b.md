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
