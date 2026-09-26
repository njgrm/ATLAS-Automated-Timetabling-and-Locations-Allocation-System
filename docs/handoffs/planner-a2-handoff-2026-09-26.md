# Handoff — Planner A2 → next session (2026-09-26)

Read this first, then `docs/plans/live-state.md` (Lane A2 section + `## Live release` + `## Capacity`).
Everything below is measured, not inherited. Commands are given so nothing needs re-deriving.

## 1. Verified state (check before acting; the runtime may have moved)

| Fact | Value | How to confirm |
| --- | --- | --- |
| **Live release** | `e4989b725394204898ebcd429db74daaf7316323` | `schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v` → **must** name the target. Never infer from a directory existing |
| Release dir | `E:\ATLAS-runtime-supervised-e4989b72-20260926` | — |
| `origin/main` | `ae523c9d` | `git -C D:/ATLAS fetch origin --prune` then `rev-parse origin/main` |
| Health | 5001 health 200, ready 200, DB-backed subjects 200, 5174 200 | `Invoke-WebRequest` each |
| Rollback basis | `400a6909` (retained, never executed); `26f7c907` and `116a7658` also on disk | do not delete |
| Dependency donor | `861d89a2` — **never retire**, lanes copy `node_modules` from it | — |
| `E:` free | 49.84 GiB (5.4%) — **below the 50 GiB warn line** | `Get-PSDrive E` |
| `C:` free | 42.91 GiB (19%) — fine | — |

**Reclaim owed before the next release build** (§3 requires acting on the *warning*, not the fail-closed
line). Three superseded dirs, **4.36 GiB**, restores E: to ~54.2 GiB:
`26f7c907-20260926` (1.47) · `eb0e3038-20260925` (1.46) · `4893cbde-20260923` (1.43).
Read `docs/reference/agent-worktree-lifecycle.md` first. Non-forced removal; verify the target's
`node_modules` entry count before and after so a junction is not followed; confirm nothing is bound to it.
**Delete no branch or Git ref.**

## 2. CLOSED — candidate 1, Room Schedules term scoping

The live BLOCKING defect is **fixed, deployed and accepted**. G7 Room 103 reported **10 invented
conflicts**; the inspector showed three APs and three Math in one Monday slot linked to T1/T2/T3.

Root cause: the Rooms view never sent a term (the server already accepted and failed closed on
`termIndex`), and Teachers/Sections pivoted the whole draft client-side with `pivotDraftToView`, which also
mapped a missing term to **Term 1**.

Accepted on the live deployment:
- the term resolves — `verified: true`, `termIndex: 2`, `T2`, 3 ordered terms
- page renders **"Showing TERM 2"**; view selector reads `TERM 2`
- scoped request → `termIndexes [2]`, `maxEntriesInOneCell 1`, `entryCount 2`
- **the page reports no conflicts**

Note `reachable: false` (EnrollPro down) — the server took its documented **persisted-contract fallback**
and resolved anyway. That is the resilience path working, not a workaround.

**Residual worth fixing:** an *unscoped* request still returns `[1,2,3]`, 3 per cell — the server keeps its
default all-term read. Every audited surface now scopes, so it is defence in depth, but the server default
is still fail-open for any future caller that forgets.

## 3. The bug class most likely to still be biting you

`settings.ts:597` defaulted `verifyUpstream = false`; `runtime.router.ts:204` treats an absent param as
false; `runtime-context.service.ts:375` uses `options?.verifyUpstream !== false`, i.e. **intends true**.
The route silently overrode the service's intent and `/runtime/context` answered unverified to every
caller that did not know to ask. It cost a live fail-closed page and several hours.

**Audit other endpoints for this shape.** A `!== false` / absent-is-false default pair announces nothing.

## 4. Open work, in order

**4.1 C2 — one shared lifecycle model (model done, NOT wired).** `src/lib/schedule-lifecycle.ts` +
9 tests, registered. The live walk found four surfaces disagreeing: dashboard *"Schedule published / live"*,
timetable *"Draft"*, `/my` **60 rows badged `Live`** beside *"Draft schedules may still change."*, public
*"PUBLISHED TIMETABLE" / TERM 1*. Facts: run **317** published (rev 43, 2026-09-22) + run **318** newer
draft (2026-09-25, `hardViolationCount 0`).
**Blocker:** `useDashboardData` exposes only the boolean `activeTermPublished`, not publication facts. Add
run / revision / `publishedAt` / `termIndex` / `termVerified`, then wire the model. Do **not** half-wire.
**Also unresolved and upstream of it:** the surfaces disagree on the current term — `/my` says T2,
the public page says TERM 1. A model that printed "published, Term 1" on one page and "Term 2" on another
would satisfy the letter of the requirement and relocate the defect.

**4.2 C4** — 390 px drift banner: `components/timetable/simple/SimpleDriftBanner.tsx:147`, fixed
non-shrinking actions near `:229` and `:252-263`. Fix the layout; do not weaken the regeneration guards or
turn the read-only preview into a write.

**4.3 C5** — Runs loading vs empty: while runs are pending, no *"No generation runs yet"* may be
announced; after an empty fulfilled response, exactly once. Needs a deferred-request test.

**4.4** — Review-issues **"Must fix"** wording (the handoff's remaining wording item).

**4.5** — Older-scheduler UX/UI/functions/flow/controls sweep, judged on the **deployed** build.

**4.6** — Remaining acceptance rows needing the timetable tab and a placed session (A12(b)-class) are
**Lane C's** browser rows, not A2's.

## 5. Process rules that will bite you

- **Register before cutover.** `deploy-runner.ps1` refuses to swap unless `docs/plans/live-state.md` on
  `origin/main` already names the target prefix **and** its rollback basis in `## Live release`. Commit and
  push that *first*.
- **Full 40-char SHAs.** The runner validates against `^[0-9a-f]{40}$` and **rejects 8-char prefixes**.
- Always dry-run first (`mutates: false`, `secretsPrinted: false`), read the plan under
  `C:\ProgramData\ATLAS\release-audit`, then the same arguments with `-Execute` **elevated**.
- Prove a deploy by fetching a **chunk that exists only in the new build** and comparing byte-for-byte.
  `400a6909`'s proof was the `schedules-selected-term` / `schedules-view-term` test-ids appearing live.
- Release dirs own their `node_modules`; `npm ci` inside. **Never junction.** Verify 0 reparse points.
- `prisma generate --schema ../prisma/schema.prisma` from `atlas-server` (repo-root schema).
- Client build needs `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` or it exits 1 silently.
- Test every harness actually runs. Registering three orphan test files that no script ran took the suite
  13 → 12 failures and turned `gate-reachability` green.
- Client suite baseline: **12 failures across 8 files**, all pre-existing. Four `playwright` typecheck
  errors are also pre-existing. Compare **by failing test name**, never by count.

## 6. My own mistakes, so you don't repeat them

- I shipped the term-scoping fix **before** the term resolver it depends on, after diagnosing that
  dependency myself. The page sat fail-closed in production. Sequence dependencies first.
- I used the **EnrollPro** school-year id `551` where the API wants ATLAS's `school_year_id` `10`, and
  nearly reported an "unshippable" finding that was pure typo. Verify identifiers in the database.
- I used **localhost** for browser QA when the directive names the Tailnet origin; a different origin has
  separate storage, so it falsely looked like no session existed. **No seeding was ever needed** —
  `atlas_local_token` is on the Tailnet origin.
- I dumped a ~740 KB API payload into context and spent a long stretch hunting a component through a
  production build with no React debug source. Filter every probe; check `node_modules` and `dist` for
  strings before reading source.
- I repeatedly deferred a deploy I had already pre-verified, converting caution into delay. With HIGH
  authority, a pre-verified cutover plus its proof is the job — not something to keep asking about.

## 7. Repo state

Branch `work/a2-timetable-custody`, worktree `E:\ATLAS-worktrees\lane-a2-timetable-custody`, clean at
`ae523c9d`. 16 client test files were fixed in place this cycle and three orphan files registered; those
paths are no longer failures. No stashes, no residue, no branch deletions.
