# Deployment packet — `main` client-presentation release (client-only, no migration) — **R3**

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (deployment) · Status: **CORRECTED after two
independent pre-action reviews — `CORRECTION_REQUIRED` 8/14 (R1) and 9/13 (R2). R3 requires a fresh
pre-action pass and is BLOCKED at step 0.**

Supersedes R2 (`27db39db`), supersedes R1 (`b43f470a`).

> ## PROCESS DEFECT IN R1/R2, disclosed before anything else
>
> **R1 and R2 both carried a `-TargetSha` literal that I fabricated.** I wrote
> `26f7c907bfe6d64e992090933f423b806f120cbd`; `git cat-file -t` on it returns *could not get object info*,
> and the `bfe6d64e…` fragment is not a valid object anywhere in the repository. The real target is
> `26f7c907a37185e036e71cf0d82423794689b318`. I never ran `git rev-parse` for that value — I completed the
> short SHA by pattern. In a HIGH-action artifact that is the most serious class of error available: a
> fabricated identifier reads as a verified one. The runner's `Get-GitIdentity` would have aborted before any
> mutation, so the blast radius was nil — **but only by luck of a fail-closed check I had not verified.**
>
> **Standing rule from here: no full SHA, path, count, or hash enters any artifact unless the command that
> produced it is recorded beside it.** Every literal in R3 §9 carries the command that derived it.

## 1. Exact target

| Field | Value |
| --- | --- |
| Product to build | **`26f7c907a37185e036e71cf0d82423794689b318`** (short `26f7c907`) |
| New release directory | `E:\ATLAS-runtime-supervised-26f7c907-20260926` |
| Live release being replaced | `116a765814bf56fdd30aec02c611869aaff42190` at `E:\ATLAS-runtime-supervised-116a7658-20260726` |
| Rollback basis | **`116a7658`** (intact, retained), second `861d89a2` |
| Cutover owner | **`ops/runtime/deploy-runner.ps1`**, invoked from the incumbent release, **elevated** |
| Env file | `D:\ATLAS-runtime-config\atlas-server.env` (never printed, never echoed) |
| Task | `ATLAS-Runtime-Supervisor` (runner default `-TaskName`) |

## 2. Reconciliation proof (independently reproduced twice; unchanged)

`116a7658` is not an ancestor of `main` (exit 1), so this cannot fast-forward. `git rev-list origin/main..116a7658`
returns exactly two commits, `d07cac05` and `116a7658`, and their product blobs are byte-identical on `main`:
`timetableDriftRouting.ts` `664c7b2c`, `published-schedule.service.ts` `1b46c877`, `…-drift.test.ts` `8357571`,
c08 test `d7a55c10`. The single differing file is a **test**. **No live product byte is lost; the deployment is
additive.**

## 3. Expected delta

- `atlas-server/`, `prisma/`, `*.env*`, `vite.config*`, `ops/`: **empty diffs.**
- `atlas-client/package.json`: `scripts` only — **no dependency added or removed**, so no new install.
- `atlas-client/src/`: **64 files** (39 production, 25 tests), timetable surface.
- **Not presentation-only:** `useScheduleReviewWorkspaceState.ts:1050` returns `teachingSpaces[0].id` when
  `teachingSpaces.length === 1` and `null` otherwise (`teachingSpaces` = `roomMap` values filtered by
  `isTeachingSpace`, `:1023-1025`). One placement default changed; no new write path, no new persistence.

## 4. Authority

- **In-repo standing authorization:** `docs/plans/live-state.md:219-222` records a standing authorization for
  this program, which covers a client-only deployment of this class. (R2 understated this as "three queued
  grants not quotable from the repo"; that was wrong — a quotable standing authorization exists.)
- The operator additionally granted HIGH authority in three queued instructions on 2026-09-26 while asleep.
- The packet's authority surface — client-only deploy, no migration, no live-data write — does not exceed
  either.
- **Per-cycle verdict lineage** (§11 permits a bounded correction without a full re-review; disclosure, not a
  gate): C2 `ACCEPT_READY` 16/16/0/0 · J2/J3 `ACCEPT_READY` 20/20/0/0 after `CORRECTION_REQUIRED` 18/20 ·
  C1 `CORRECTION_REQUIRED` 4/7 → planner-reviewed bounded correction · C3 5/8 → same · J2 8/9 → D2 closed by
  `1ccdf4dd`. `98289573` is superseded by the reviewed `de392cf8`. **No cycle shipping now is open or
  unreviewed.**

## 5. Execution steps

**Elevated shell required** — the runner calls `Assert-Administrator`.

> **`cli.mjs` rule (B6).** `cli.mjs:16-19` resolves the release from the **process**-scope
> `ATLAS_RUNTIME_SOURCE_DIR`, which currently names the **retired** `c5e167d7` release. **Every** `cli.mjs`
> invocation in this packet therefore sets both variables explicitly, in the same command, as the first step of
> that step. An unqualified `cli.mjs` call reads a dead state file and silently does nothing.

0. **BLOCKING — the §3 capacity obligation is not waived (B2).** `AGENTS.md:43` is normative: *"When either
   volume crosses its warning, run the release-directory retention reclaim before the next release build."*
   E: is **48.73 GiB**, below the 50 GiB warning, and `live-state.md:246` records that the next release build
   *"needs its own fresh manifest and pre-action audit"*. R2's claim that a fresh manifest was "available, not
   mandatory" and that the packet relied "on capacity sufficiency, not on a waiver" was a **waiver this lane
   has no authority to grant.** Capacity sufficiency is not the §3 test. **Reclaim `20260926c` and its
   independent pre-action audit must complete before step 1.** No operator deviation is being assumed; if the
   operator wishes to waive it, the deviation must be recorded verbatim. Note the E: **release** set has no
   further retirable row, and the E: **worktree** rows belong to other lanes, so `20260926c` will most likely
   record an exhausted set plus the `4893cbde` decision — an honest report, not a blocker.
1. Preflight and record: supervisor action + status, machine `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA`, listeners on 5001/5174 with owning PIDs, `/api/v1/health`,
   `/api/v1/health/ready`, DB-backed read `GET /api/v1/subjects?schoolId=1`, live release HEAD, and six-table DB
   digests as the **zero-write baseline** (recorded verbatim, because A4 depends on it).
2. Create `E:\ATLAS-runtime-supervised-26f7c907-20260926` as a **registered worktree** at the target SHA (never
   a clone). Dependencies by **`robocopy /E` real copy** from `E:\ATLAS-runtime-supervised-861d89a2-20260925`
   (client 156 entries, server 209, `tsx` and `prisma` present, not reparse points). **No junction, no
   junction chain, no junction to the live release, no `npm ci`.**
3. `prisma generate` from `atlas-server` with `--schema` at the **repo-root** schema. Codegen only — **no
   database connection, and no migration is run.**
4. Build with the fail-closed guard satisfied: `$env:VITE_ENROLLPRO_URL = "https://dev-jegs.buru-degree.ts.net"`
   in the build process environment before the client build. `atlas-client/vite.config.ts` requires it
   (`REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, the **only** required var) and emits no bundle
   without it. It is an origin URL, never a secret.
5. Prove the built target in isolation: start it on port **5198** with `PORT=5198` and
   `ROLLOVER_AUTO_SYNC_ENABLED=false` in the child environment; require health 200, ready 200 with
   `database:"ok"`, and a DB-backed 200; stop the actual listener PID and prove 5198 released. Identity of the
   child is read with **explicit** `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA`, per the rule above.
6. Prove the build is new by fetching an asset chunk that exists **only** in this build.
7. **Record the new release in the register BEFORE cutover.** The runner calls `Assert-LiveReleaseRecorded`,
   which reads `docs/plans/live-state.md` from `-LiveStateRef` (default **`origin/main`** — a *committed* ref,
   independent of any working tree) and requires the **8-char target prefix** to appear inside the
   `## Live release` section. So the register must name `26f7c907` in that section, **committed and pushed to
   `origin/main`**, before the runner executes. This lane may write only the `## Live release` block and its own
   Lane A section.
8. **Cutover — the repo-owned runner only.** It sets task XML **and** both machine env vars, does
   `taskkill /PID /T /F` on the supervisor tree, sleeps 10 s, **asserts** 5001/5174 cleared, then
   `schtasks /run`, reverting env + XML and restarting on any throw. Dry run first, then `-Execute`, with
   identical arguments (§9):

```
& "E:\ATLAS-runtime-supervised-116a7658-20260726\ops\runtime\deploy-runner.ps1" `
  -TargetSha "26f7c907a37185e036e71cf0d82423794689b318" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-26f7c907-20260926" `
  -IncumbentSha "116a765814bf56fdd30aec02c611869aaff42190" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-116a7658-20260726" `
  -EnvFile "D:\ATLAS-runtime-config\atlas-server.env"
```

The dry run must report the target and incumbent identities, `mutates=false`, `secretsPrinted=false`, a single
supervisor lineage, and a rollback plan. **No credential value may be echoed, printed, or recorded.**

9. Post-cutover verification: health 200, ready 200 `database:"ok"`, DB-backed read 200, the new chunk
   fetchable on 5174, and the supervisor action **plus both machine env vars** naming the new release. Identity
   reads use **explicit** env overrides per the `cli.mjs` rule.

**Rollback (B5 — R2's instruction was unexecutable).** Re-invoking the script with only `-TargetSha` /
`-TargetSourceDir` changed **fails closed and changes nothing**: `Get-MachineIdentity` requires the machine env
to equal the declared *incumbent*, and after a successful cutover it names the target; and
`Replace-TaskSourceBytes` needs exactly two references to the declared incumbent, which the target XML no
longer contains. A real rollback is the **full argument swap** — target becomes the incumbent:

```
  -TargetSha "116a765814bf56fdd30aec02c611869aaff42190" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-116a7658-20260726" `
  -IncumbentSha "26f7c907a37185e036e71cf0d82423794689b318" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-26f7c907-20260926"
```

It also requires the **`116a7658` entry to remain in the `## Live release` section** so the swapped run passes
`Assert-LiveReleaseRecorded`; the Live release block must therefore retain both entries across the deployment,
not replace one with the other. Inside the runner's own `try`, its `catch` reverts env + XML and restarts
automatically.

## 6. Acceptance rows (each names a harness that can decide it)

| # | Row | Harness | Expected |
| --- | --- | --- | --- |
| A1 | Release identity: installed HEAD `26f7c907`; supervisor action **and both machine env vars** name the new release | `cli.mjs status` **with explicit env overrides** + `git -C <release> rev-parse HEAD` + machine env | PASS |
| A2 | New-build proof: a chunk present only in this build is served on 5174 | HTTP fetch | PASS |
| A3 | Health 200, ready 200 `database:"ok"`, DB-backed read 200 | HTTP | PASS |
| A4 | **Zero write:** six-table digests identical to step 1's verbatim baseline | SQL digests | PASS |
| A5 | **Scoped to the 39 changed production files:** no engine token, raw enum or de-snake-cased code reaches the operator surface **there**. Includes `TimetableTaskDrawer.tsx`, which **is** in the changed set (live `73e61b9a` → main `182f0e4a`, additive unassigned-sessions panel) and where the `Subject #<id>` default **survives at `:139`**, its only caller passing a real label (`ScheduleReviewWorkspaceBody.tsx:88`) | **Browser**, authenticated | PASS |
| A6 | An unmapped rule renders the one honest sentence; an absent value renders the em dash | **Browser** | PASS |
| A7 | No new console errors and no failed requests on the timetable workspace | **Browser** | PASS |
| A8 | Client suite at the release SHA: 16 fails across the same 11 files as `5960cfce`, zero new | `npm run test:client-suite` | PASS |
| A9 | `typecheck` adds zero errors (baseline exactly 4, all pre-existing) | `npm run typecheck` | PASS |
| A10 | **Rollback target intact:** `116a7658` resolves to that SHA, is **not** a reparse point, and contains `ops/runtime/cli.mjs`, `atlas-server/dist/server.js`, `atlas-client/dist/index.html` | filesystem + `git rev-parse`, **nothing started** | PASS |
| A11 | **Dated residual, recorded not asserted clean** — the surviving J2 sweep, **restored to the three blobs that are genuinely outside the changed set and byte-identical** (B3): `PublicationApprovalInbox.tsx` (`5d4eda24`, renders `Run #<id>` / `account #<id>`), `ManualEditPanel.tsx` (`e6fdb0b1`, `v.code.replace(/_/g,' ')` at `:929,948`), `QuickPlaceSummaryModal.tsx` (`a0406331`, de-snake-cased quick-place reason) | **`git rev-parse 116a7658:<path>` vs `git rev-parse 26f7c907:<path>` for each** — a byte-identity harness, not a browser spot-check | PASS as a *recorded residual* |
| A12 | **Split, because the one-space branch is unreachable live (B4).** (a) the one-teaching-space case: the placement resolver returns that room and the many-space case returns `null` | **committed unit row** in the C1 suite; script name to be named in the handoff before execution | PASS |
| | (b) the observable many-space path renders today's manual-placement behaviour with no regression | **Browser** on the placement surface | PASS |

**A12 note, stated rather than hidden:** the independent review measured **98** teaching spaces for school 1
via `GET /api/v1/map/schools/1/buildings`, so `teachingSpaces.length === 1` is unreachable in the live
database and a browser can never witness the changed branch. R2's A12 was therefore undecidable — a
false-report generator. (b) is the browser row; (a) is decidable only as a unit row. The executor must re-derive
the teaching-space count before execution and record the command.

## 7. Post-action QA owner (B-row (d) — non-waivable)

**Owner: `atlas-qa` (fresh, independent, read-only), dispatched by the planner after the runner returns.** It
closes every post-cutover row including A4's zero-write corroboration, and must return a real
`passed / total`, `blocked: N`, `unperformed: N` tally with **no row declared not applicable**. Deployment and
acceptance remain **separate outcomes**: a healthy deployed process may be `DEPLOYED` while acceptance is
incomplete. Browser rows A5–A7 are executed under **Lane A**, which holds the seeded profile
`C:\Users\njgro\.config\opencode\playwright-profile` (token key `atlas_local_token`), using the **Tailnet root
origin only** (`https://njgrm.buru-degree.ts.net`) — never an asset URL or `robots.txt`. Live browser evidence
proves the deployed surface, never undeployed source bytes.

## 8. Not authorized

Any migration, live-data write, generation, publication, term-cache apply, Teaching Load apply, availability
write, rollover sync, companion-repository action, or any env/task change beyond the runner's own three-part
cutover and its rollback. This lane will **not** edit Lane B's or Lane C's live-state sections: roughly ten
dated "NOT deployed" claims in Lane C's section become stale on cutover, so **Lane A's section records a dated
supersession request naming them** and Lane C updates its own text.

## 9. Every literal and the command that produced it

| Literal | Command |
| --- | --- |
| target `26f7c907a37185e036e71cf0d82423794689b318` | `git rev-parse 26f7c907` |
| incumbent `116a765814bf56fdd30aec02c611869aaff42190` | `git rev-parse 116a7658` |
| live-only commits = `d07cac05`, `116a7658` | `git rev-list origin/main..116a7658` |
| blob `664c7b2c` `timetableDriftRouting.ts` | `git rev-parse 116a7658:<path>` = `git rev-parse 26f7c907:<path>` |
| blob `1b46c877` `published-schedule.service.ts` | same, both sides equal |
| blob `8357571` `…-drift.test.ts` · `d7a55c10` c08 test | same, both sides equal |
| `TimetableTaskDrawer` live `73e61b9a` → main `182f0e4a` | `git rev-parse 116a7658:<path>` / `git rev-parse 26f7c907:<path>` |
| A11 blobs `5d4eda24` / `e6fdb0b1` / `a0406331` | `git rev-parse` both sides, equal |
| `861d89a2` donor 156 / 209 entries | `Get-ChildItem <dir>\atlas-{client,server}\node_modules` |
| E: 48.73 GiB · D: 60.67 GiB | `Get-PSDrive D,E` |
| `ATLAS_RUNTIME_SOURCE_DIR` (process) = retired `c5e167d7` | `$env:ATLAS_RUNTIME_SOURCE_DIR` |
| `cli.mjs` resolves source from **process** env | `ops/runtime/cli.mjs:16-19` |
| `Assert-LiveReleaseRecorded` reads `-LiveStateRef`, needs the 8-char target in the Live release section | `ops/runtime/deploy-runner.ps1:198-217`, `:178-196` |
| `REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, the only required var | `atlas-client/vite.config.ts:13,23-24` |
| placement default at `:1050` | `useScheduleReviewWorkspaceState.ts:1050`, `teachingSpaces` at `:1023-1025` |
| 98 teaching spaces (school 1) | reviewer's `GET /api/v1/map/schools/1/buildings`; **re-derive before execution** |
