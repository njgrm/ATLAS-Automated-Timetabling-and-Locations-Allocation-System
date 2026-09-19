# SECTION-ROUTE-AUTHORITY-C03 — actor scope on the section-scoped read route

- Stream: `SECTION-ROUTE-AUTHORITY-C03`
- Kind: `CYCLE`, server source. Risk: `MEDIUM` (authority boundary, read-only route).
- Base: `5058a1b3` (re-verify; main is moving)
- Writable worktree: `E:/ATLAS-worktrees/section-route-authority-c03` (planner-provisioned)
- Branch: `work/section-route-authority-c03`
- Additive commits only.
- Recommended executor reasoning: `high`

## 0. The residual

Flagged independently by the C02 executor and by independent QA:

`GET /api/v1/sections/:sectionId/assigned-classes` —
`atlas-server/src/routes/section.router.ts` (around line 138 at packet authoring) — uses
`authenticateWithSystemToken` + `requirePrivilegedRole`, takes **only** `sectionId`
(path) and `schoolYearId` (query), and resolves the school **server-side from the
section**. There is **no actor-school check**.

Consequence: any privileged caller — a JWT actor for school A, or any valid system
token — can read the assigned classes of **any section in the active school-year**,
including one belonging to another school.

**Line numbers are from authoring — re-locate them yourself and report the actual
locations.**

## 1. Required outcomes

**R1 — Enforce actor school on this route.**
Reuse the existing `requireActorSchool` / `actorSchoolIdOf` helpers that C01 and C02
introduced. Do not write a second authority mechanism.

**R2 — Preserve 404 semantics; do not leak existence.**
The route currently returns `404 NOT_FOUND` when the section is not in the active
school-year scope. A cross-school caller must **not** be able to distinguish
"section does not exist" from "section exists but belongs to another school".
Choose the response shape deliberately, state your reasoning, and prove it with a
control. Do not introduce a `403` that leaks existence unless you can justify it.

**R3 — C01 Option A shape for machine callers.**
This is a machine route (`authenticateWithSystemToken`). Apply the shape established by
C01/C02: a system token is acceptable **with an explicit `schoolId`**, and a missing or
non-numeric `schoolId` must fail closed with a typed error and zero dispatch. A
JWT/bridge actor must be cross-checked against the section's school.

**R4 — Enumerate the consumers before gating.**
Report every caller: client, machine/system-token, scripts, and any pending packet or
register spec that depends on this route. A prior packet in this series was corrected
precisely because a gate silently broke a documented system-token caller. Known client
caller to verify: `atlas-client/src/components/.../SectionDetailsSheet.tsx` (around line
135) — confirm it passes an actor-derived scope.

**R5 — Preserve the legitimate path and the response shape.**

## 2. Mandatory evidence

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Cross-school read rejected | **Failing-first against real base bytes.** Prove the pre-fix route returns 200 (or the section payload) for a cross-school `sectionId`. Run it against a real base checkout — `git archive` extraction is acceptable; a hand-built mock is not. Report base pass/fail and candidate pass/fail counts. |
| 2 | No existence leak | Prove a non-existent section and an other-school section are indistinguishable to a cross-school caller |
| 3 | Zero dispatch on rejection | Instrumented data-context recorder asserting `ops === 0`; prove the recorder records by asserting `ops > 0` on a positive row |
| 4 | Same-school actor still succeeds | Assert 200 and the unchanged payload shape |
| 5 | System token + explicit `schoolId` | Accepted (Option A); missing / non-numeric → typed rejection, zero dispatch |
| 6 | Missing / invalid JWT | `401`, zero dispatch |
| 7 | No scope widening | No unrelated route changed |
| 8 | Consumer enumeration | Report the full set, including pending packets |

The test must be **hermetic** — runnable with `DATABASE_URL` unset, using an unreachable
placeholder plus an injected instrumented context.

## 3. Forbidden

- No live database write, migration, generation, publication, deployment, or data apply.
- Do not delete, weaken, or remove any existing test, assertion, or evidence row.
  Corrections are **additive to evidence**.
- Do not run `git stash` — it is denied and leaves residue.
- Do not declare a mandatory row "not applicable". Run it, or report it `BLOCKED` or
  `UNPERFORMED` with the reason.
- Do not claim "zero residue" unless the stash list, reflog, untracked files, and worktree
  status are all clean.
- Never read credential, secret, token, key, or environment files.
- Do not edit `docs/**`, `CHANGELOG.md`, or the living state file.
- Do not push, merge, rebase, or amend. Commit on `work/section-route-authority-c03` only.
- Companion repositories are READ_ONLY.

## 4. Preservation controls (must stay green)

- `npm --prefix "<worktree>\atlas-server" run test:home-room-auto-assign` → 10/10
- `npm --prefix "<worktree>\atlas-server" run test:section-route-authority` → 19/19
- `npm --prefix "<worktree>\atlas-server" run test:section-route-authority-c02` → 21/21
- `npm --prefix "<worktree>\atlas-server" run build` (tsc)

Note: `prisma generate --schema ..\prisma\schema.prisma` may be required from
`atlas-server` before any suite runs. That is node_modules-only codegen; no repo bytes
change.

## 5. Return contract

One `REVIEW_REQUIRED` handoff: verdict; base SHA; candidate SHA; exact changed paths; the
`requirement -> production path -> negative control -> result` table; the failing-first
evidence from real base bytes; the actual route line numbers you located; your R2
response-shape decision with reasoning; the consumer enumeration; and any
`BLOCKED`/`UNPERFORMED` row named explicitly. Do not self-accept.
