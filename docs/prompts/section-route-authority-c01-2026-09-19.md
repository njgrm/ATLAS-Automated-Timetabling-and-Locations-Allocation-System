# SECTION-ROUTE-AUTHORITY-C01 — close actor-school scope on the sibling home-room and sync routes

- Stream: `SECTION-ROUTE-AUTHORITY-C01`
- Kind: `CYCLE`, server source. Risk: `MEDIUM` (authority boundary, no live write).
- Base: `8f7c855d` (re-verify; main is moving)
- Writable worktree: `E:/ATLAS-worktrees/section-route-authority-c01` (planner-provisioned)
- Branch: `work/section-route-authority-c01`
- Additive commits only.
- Recommended executor reasoning: `high`

## 0. The defect (found by independent QA, verified by the planner)

`HOME-ROOM-AUTO-ASSIGN-C01` added an actor-school authority check to the auto-assign
route only. Its **siblings still accept a caller-supplied `schoolId`** with no
actor-school cross-check:

| Route | Location |
| --- | --- |
| `GET /api/v1/sections/home-rooms/:schoolYearId` | `atlas-server/src/routes/section.router.ts:163` |
| `PUT /api/v1/sections/home-rooms/:schoolYearId` | `atlas-server/src/routes/section.router.ts:185` |
| `POST /api/v1/sections/sync` | `atlas-server/src/routes/section.router.ts:116` |

**Line numbers are from QA's report at the time of finding — re-locate them yourself
and report the actual locations.** Do not trust these numbers.

An actor authenticated for school A can pass `schoolId=B` and read or write school
B's section home-room data. That is a fail-open tenant-scope path.

## 1. Required outcomes

**R1 — Enforce actor school on all three routes.**
Reuse the existing actor-school authority helper that `auto-assign` now uses. Do not
author a second authority mechanism; a parallel implementation is a defect, not a fix.

**R2 — Fail closed with a typed error and zero writes.**
A cross-school actor must be rejected before any read of the target scope and before
any write. Prove zero downstream dispatch and zero writes on rejection.

**R3 — Preserve the legitimate path.**
A same-school actor with a privileged role must continue to work unchanged. Prove it.

**R4 — Do not change the response shape** for legitimate callers.

## 2. Mandatory evidence

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Cross-school actor rejected on each of the three routes | **Failing-first**: assert the pre-fix behaviour accepts the cross-school `schoolId`. The test must fail on base bytes and pass after the fix. Capture both. |
| 2 | Zero writes on rejection | Before/after row signature on the home-room assignment table; assert zero delta |
| 3 | Same-school privileged actor still succeeds | Assert the legitimate path returns success and the expected payload |
| 4 | Missing / invalid JWT | Typed rejection, zero dispatch |
| 5 | System token path | Confirm whether a system token is permitted by the existing helper, and prove the behaviour is deliberate, not accidental |
| 6 | Actor school absent from the token | Typed rejection, never a default to school 1 |
| 7 | No scope widening | Confirm no unrelated route behaviour changed |

## 3. Forbidden

- No live database write, migration, generation, publication, deployment, or data apply.
- Do not weaken or bypass an existing check to make a test pass.
- Do not edit `docs/**`, `CHANGELOG.md`, or the living state file.
- Do not push, merge, rebase, or amend. Commit on `work/section-route-authority-c01` only.
- Companion repositories are READ_ONLY.

## 4. Decisive commands

- `npm --prefix "<worktree>\atlas-server" run build` (tsc)
- the focused server test file you create or extend, run with the worktree's `tsx`

## 5. Return contract

One `REVIEW_REQUIRED` handoff: verdict; base SHA; candidate SHA; exact changed paths;
the `requirement -> production path -> negative control -> result` table; the captured
failing-first evidence; the actual route line numbers you found; and any
`BLOCKED`/`DEFERRED` row named explicitly. Do not self-accept.
