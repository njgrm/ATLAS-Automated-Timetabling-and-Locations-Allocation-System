# SECTION-ROUTE-AUTHORITY-C02 — close the remaining ungated section routes

- Stream: `SECTION-ROUTE-AUTHORITY-C02`
- Kind: `CYCLE`, server source. Risk: `MEDIUM` (authority boundary, one write route).
- Base: `6a78b1a9` (re-verify; main is moving)
- Writable worktree: `E:/ATLAS-worktrees/section-route-authority-c02` (planner-provisioned)
- Branch: `work/section-route-authority-c02`
- Additive commits only.
- Recommended executor reasoning: `high`

## 0. Context

`SECTION-ROUTE-AUTHORITY-C01` closed `GET`/`PUT /home-rooms/:schoolYearId`,
`POST /sync`, and `POST /home-rooms/:schoolYearId/auto-assign`. Independent QA then
found the remaining siblings in `atlas-server/src/routes/section.router.ts` still
accept a caller-supplied `schoolId` with no actor cross-check.

**Line numbers below are from the current `origin/main` at packet authoring — re-locate
them yourself and report the actual locations.** Do not trust these numbers.

| Line | Route | Auth middleware | `schoolId` source |
| --- | --- | --- | --- |
| 49 | `GET /summary/:schoolYearId` | `authenticate, requirePrivilegedRole` | none in the request |
| 82 | `GET /assigned-classes` | `authenticateWithSystemToken, requirePrivilegedRole` | `Number(req.query.schoolId)` |
| 108 | `GET /:sectionId/assigned-classes` | `authenticateWithSystemToken, requirePrivilegedRole` | none (section-scoped) |
| 356 | `POST /special-program-placement/overlay` | `authenticate, requirePrivilegedRole` | `Number(req.body.schoolId)` |

## 1. Required outcomes

**R1 — `POST /special-program-placement/overlay` is the priority.**
It is an **actor** route (`authenticate`, not `authenticateWithSystemToken`) that takes a
**caller-supplied `schoolId`** and performs a **write**. An actor authenticated for
school A can currently target school B. Apply the same `requireActorSchool` helper the
`C01` packet introduced — do not write a second authority mechanism.

**R2 — `GET /summary/:schoolYearId`.**
Determine from the source whether it scopes its reads to the **actor's** school. If it
derives scope from anything caller-influenced, or defaults to a fixed school, close it
with the same helper. Report exactly what you found either way — if it is already
correctly actor-scoped, say so with the code path that proves it, and change nothing.

**R3 — `GET /assigned-classes`.**
This is a **machine** route (`authenticateWithSystemToken`). Apply the `C01` **Option A**
shape: a system token is acceptable, but an explicit `schoolId` must be present, and a
missing or non-numeric `schoolId` must fail closed with a typed error and zero dispatch.
`GET /:sectionId/assigned-classes` is section-scoped — verify whether it needs any school
check and report your reasoning; change nothing if it does not.

**R4 — Preserve every legitimate caller.**
Before adding any gate, enumerate and report the route's consumers: machine callers,
client callers, and any pending packet that depends on it. The `C01` packet was
corrected precisely because a gate silently broke a documented system-token caller —
do not repeat that. Report the consumer set explicitly.

**R5 — Do not change response shapes** for legitimate callers.

## 2. Mandatory evidence

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Cross-school actor rejected on the overlay write route | **Failing-first**: assert the pre-fix behaviour accepts a cross-school `schoolId`. The test must fail on **base bytes** and pass after the fix. Run it against a scratch checkout of the base, not a hand-built mock. |
| 2 | Zero writes on rejection | Before/after row signature, or an instrumented data-context recorder proving `ops === 0` and `writes === 0`. Prove the recorder actually records by asserting `ops > 0` on a positive row. |
| 3 | Same-school privileged actor still succeeds | Assert success and the expected payload for the overlay route |
| 4 | `GET /summary` scoping | State the finding; if changed, prove the actor scope with a negative control |
| 5 | System-token `schoolId` required on `GET /assigned-classes` | Missing / non-numeric `schoolId` → typed rejection, zero dispatch |
| 6 | Missing / invalid JWT | `401`, zero dispatch, on every changed route |
| 7 | No scope widening | No unrelated route behaviour changed |
| 8 | Consumer enumeration | Report the full consumer set for every route you touch, including pending packets |

The test must be **hermetic** — runnable with `DATABASE_URL` unset, using an unreachable
placeholder plus an injected instrumented context. A test that needs a live database is
not admissible evidence.

## 3. Forbidden

- No live database write, migration, generation, publication, deployment, or data apply.
- Do not delete, weaken, or remove any existing test, assertion, or evidence row.
  Corrections are **additive to evidence**.
- Do not run `git stash` — it is denied and leaves residue. To test base behaviour, use a
  separate scratch checkout.
- Do not declare a mandatory row "not applicable". Run it, or report it `BLOCKED` or
  `UNPERFORMED` with the reason.
- Do not claim "zero residue" unless the stash list, reflog, untracked files, and worktree
  status are all clean.
- Do not edit `docs/**`, `CHANGELOG.md`, or the living state file.
- Do not push, merge, rebase, or amend. Commit on `work/section-route-authority-c02` only.
- Companion repositories are READ_ONLY.

## 4. Decisive commands

- `npm --prefix "<worktree>\atlas-server" run build` (tsc)
- `npm --prefix "<worktree>\atlas-server" run test:home-room-auto-assign` (preservation control — must stay 10/10)
- `npm --prefix "<worktree>\atlas-server" run test:section-route-authority` (must stay 19/19)
- your new focused test, run with the worktree's `tsx`

## 5. Return contract

One `REVIEW_REQUIRED` handoff: verdict; base SHA; candidate SHA; exact changed paths; the
`requirement -> production path -> negative control -> result` table; the captured
failing-first evidence from real base bytes; the actual route line numbers you located;
the consumer enumeration from R4; and any `BLOCKED`/`UNPERFORMED` row named explicitly.
Do not self-accept.
