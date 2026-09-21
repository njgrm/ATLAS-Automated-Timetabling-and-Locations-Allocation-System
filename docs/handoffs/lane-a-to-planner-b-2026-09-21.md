# Lane A → Planner B — handoff, 2026-09-21

You are the operator-authorized parallel planner ("Planner B") on the ATLAS repository. Lane A owns
the client surface, the continuity documents, deployment and the browser controller; you work in
parallel on **disjoint files**. Read this before your next stream.

## 1. State correction — two items you have as "operator-gated" are CLOSED

Verified 2026-09-21 from the **live database**, not from a document:

| You have | Actual |
| --- | --- |
| term-cache apply pending / operator-gated | **applied 2026-09-18** — mirror **551** (upstream year **10**), `termContractCachedAt 2026-09-18T04:51:01.797Z`, `TERM_CACHE_SYNC_APPLIED` = **2** |
| readiness → generation preview → generation → publication pending | `GenerationRun` = **4**, and **published run 315 / revision 42 carries zero HARD violations** (335 acknowledged SOFT rows). The generation/publication core is **met** |

Do not spend a cycle or a login on the term-cache chain. The packet
`docs/prompts/term-cache-catchup-apply-2026-09-21.md` exists and is **closed** — do not execute it.
The earlier "remains locked and unbound" line was undated and stale; that failure mode is now
`AGENTS.md` §15's dated-blocker rule.

## 2. Your candidate `TEST-GATE-REACHABILITY-C01` is integrated

`f4462374` → merge `fc0f86d6` on `main`. Lane A review (LOW, no independent QA): all **29** test
files referenced by the removed scripts are absent; each removed aggregate (`test:auth`,
`test:phase1`, `test:phase2`, `test:phase2-regression`, `test:faculty-priority-slice`) was composed
entirely of dead members; **no surviving script references any of the 32 removed names**;
`git diff --check` clean. **No gate was lost.** Your worktree is clean — fetch and continue from
`main`.

## 3. Your next stream — the actor-school residual authority lane

Source-only, inside your files:

1. `atlas-server/src/routes/runtime.router.ts:244` — `GET /rollover-recovery/preview` still uses the
   defaulting `parseSchoolId`, so an authenticated JWT can read with a **school-1 fallback**. Give it
   the same treatment `ACTOR-SCOPE-C01` gave the other read routes.
2. `:424` — `parseStrictTermAuthoritySchoolId` lacks the non-string/non-number guard
   (`true → 1`, `[1] → 1`). Not cross-tenant today (those routes are actor-matched) — apply for
   consistency.
3. Harness: add body-vs-query precedence and hex/exponent/padded numeric input (`'0x10'`, `'1e2'`,
   `'01'`, `' 1 '`, `'+1'`), plus an aggregate script entry.

## 4. Higher-value alternative — tell us which you are taking

`/public/schedules` renders every cell **3×** (2,760 entries = 920 × 3 terms). The 2026-09-20
handoff records it as owned by "the other planner" — if that is you, do it **before** the residual
lane; it is far more user-visible. If you take it, Lane A stays out of
`PublicPublishedSchedule.tsx` and its query.

## 5. File ownership is by FILE now, not by directory

Two lanes working in server code means directory ownership no longer works. Lane A owns
`atlas-server/src/services/constraint-validator.ts` (starting `warning-readability-c01`) plus all
client, continuity, deployment and browser files. **Your files:** `runtime.router.ts`, the
actor-school test file, `atlas-server/package.json`. Name your files in your packet so the split
stays provable.

## 6. How we share the state — `docs/plans/live-state.md` now has a writing protocol

- Edit **only your own section** (`Lane B — current lane`) plus the `Live release` block when you
  deploy. Never rewrite another lane's section; on a merge conflict inside another lane's section,
  **take theirs**.
- **Every blocker or "not done" line carries `as of <date>` and what proves it.** Verify a blocker
  against the runtime or the database before acting on it, or delete it.
- Keep it short — no narrative, no history. Your detail goes in your own handoff file.

## 7. Push discipline

- `fetch` + merge before every `:main` push, and verify the pushed range contains only accepted
  commits.
- A lane in an integration closure holds an **exclusive `main` push window** (`AGENTS.md` §14) —
  announce it and the other lane holds its pushes until it lands.

## 8. Report back with

Stream name · packet path · base and candidate SHA · exact changed paths · the decisive commands
with results · verdict (`REVIEW_REQUIRED` / `BLOCKED(reason)`) · and **which** of §3 or §4 you are
taking.
