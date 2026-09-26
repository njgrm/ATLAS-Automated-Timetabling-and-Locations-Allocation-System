# Deployment packet — `main` client-presentation release (client-only, no migration) — **R4**

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (deployment + machine env) · Status: **CORRECTED
after three independent pre-action reviews — `CORRECTION_REQUIRED` 8/14 (R1), 9/13 (R2), 11/12 (R3). R4
addresses a SYSTEMIC defect R3 surfaced: every started release is permanently dirty, so no release directory is
usable as a deploy target or a rollback basis. Requires a fresh pre-action pass.**

Supersedes R3 (`64b4d1af`), R2 (`27db39db`), R1 (`b43f470a`).

> **Inherited process defects, disclosed.** R1/R2 carried a **fabricated** `-TargetSha`. The `20260926c`
> manifest asserted worktree dispositions that did not exist, and its own correction was **subtractive**. All
> three were caught by review, not care. **R4's §9 is the binding control: no literal enters this packet
> without the command that produced it, and every count in it was re-derived in this session.** Treat any
> pre-R4 packet literal as unverified.

## 1. Exact target

| Field | Value |
| --- | --- |
| Product to build | **`26f7c907a37185e036e71cf0d82423794689b318`** (short `26f7c907`) |
| New release directory | `E:\ATLAS-runtime-supervised-26f7c907-20260926` |
| Live release being replaced | `116a765814bf56fdd30aec02c611869aaff42190` at `E:\ATLAS-runtime-supervised-116a7658-20260726` |
| Rollback basis | **`116a7658`** (retained; see A10 — it is currently *not* runner-eligible) |
| Cutover owner | **`ops/runtime/deploy-runner.ps1`**, invoked from the incumbent release, **elevated** |
| Env file | `D:\ATLAS-runtime-config\atlas-server.env` (never printed, never echoed) |

## 2. The systemic defect R3 surfaced, and the fix

`deploy-runner.ps1`'s `Get-GitIdentity` (`:74-75`, reached at `:262`) **fails any target whose
`git status --short` is non-empty**. The supervisor writes its log directory **inside the release worktree it
runs from** — default `ops/runtime/logs` — so **every started release is permanently dirty**. Measured: all
three retained bases report exactly `?? ops/runtime/logs/`, untracked **and** unignored (root `.gitignore` has a
`# Server logs` comment with no rule for it). Consequences: **no rollback basis is runner-eligible**, and the
**forward path also fails**, because the packet's own port-5198 pre-check would dirty the target before step 8.

**Fix — the repo's own supported override, not a git-ignore patch.**
`ops/runtime/lib/contract.mjs:328-337` `resolveLogDirectory({ contract, sourceDir, env })` honours
`contract.logs.directoryVariable`, which `ops/runtime/runtime-contract.json` sets to **`ATLAS_RUNTIME_LOG_DIR`**,
and it must be an **absolute path** when set. It is currently **unset in process and machine scope**. R4 points
it at **`C:\ProgramData\ATLAS\runtime-logs`** — outside every worktree, outside the repo, and beside the
runner's own `AuditRoot` (`C:\ProgramData\ATLAS\release-audit`). Footprint is bounded by the contract
(`maxBytes 5242880` × `maxFiles 5` ≈ **25 MiB** per base), so C: at 5.48 GiB free is sufficient.

**Why not `.git/info/exclude`:** the obvious root-cause fix is **unavailable to this lane** — both the `write`
and `edit` tools are refused for `D:\ATLAS\.git\info\exclude` by the current permission rules, so that route
needs an operator action. The env route is better regardless: it is tracked, supported, and prevents recurrence
rather than masking a symptom.

## 3. Reconciliation proof and expected delta (unchanged, reproduced three times)

`116a7658` is not an ancestor of `main` (exit 1), so this cannot fast-forward. `git rev-list origin/main..116a7658`
returns exactly two commits, `d07cac05` and `116a7658`, whose product blobs are byte-identical on `main`:
`timetableDriftRouting.ts` `664c7b2c`, `published-schedule.service.ts` `1b46c877`, `…-drift.test.ts` `8357571`,
c08 test `d7a55c10`. The one differing file is a **test**. **No live product byte is lost; the deployment is
additive.** `atlas-server/`, `prisma/`, `*.env*`, `vite.config*`, `ops/` diffs are **empty**;
`atlas-client/package.json` is `scripts`-only with **no dependency change**; the client delta is **64 files**
(39 production, 25 tests). **Not presentation-only:** `useScheduleReviewWorkspaceState.ts:1051` returns
`teachingSpaces[0].id` when `teachingSpaces.length === 1`, else `null` (`teachingSpaces` = `roomMap` values
filtered by `isTeachingSpace`, `:1023-1025`).

## 4. Authority

- **In-repo standing authorization:** `docs/plans/live-state.md:219-222` covers a client-only deployment of this
  class. The operator additionally granted HIGH authority in queued instructions on 2026-09-26.
- This packet's authority surface now includes a **machine-scope environment change**
  (`ATLAS_RUNTIME_LOG_DIR`), which is HIGH under `AGENTS.md` and is named explicitly in step 2b.
- **Per-cycle verdict lineage:** C2 `ACCEPT_READY` 16/16/0/0 · J2/J3 `ACCEPT_READY` 20/20/0/0 after
  `CORRECTION_REQUIRED` 18/20 · C1 `CORRECTION_REQUIRED` 4/7 → planner-reviewed bounded correction · C3 5/8 →
  same · J2 8/9 → D2 closed by `1ccdf4dd`. `98289573` is superseded by the reviewed `de392cf8`. **No cycle
  shipping now is open or unreviewed.**

## 5. Execution steps

**Elevated shell required** (`Assert-Administrator`).

> **`cli.mjs` rule.** `cli.mjs:16-19` resolves the release from **process**-scope `ATLAS_RUNTIME_SOURCE_DIR`,
> which currently names the **retired** `c5e167d7`. **Every** `cli.mjs` invocation sets
> `ATLAS_RUNTIME_SOURCE_DIR` and `ATLAS_RUNTIME_RELEASE_SHA` explicitly, in the same command.

0. **§3 capacity gate: satisfied.** Reclaim `20260926c` ran, its audit confirmed the E: release set is genuinely
   exhausted and the obligation discharged, and its additive disposition restoration is recorded. E: 48.73 GiB,
   D: 60.67 GiB, against a ~2 GiB build and a 25 GiB fail-closed.
1. Preflight and record: supervisor action + status, machine `ATLAS_RUNTIME_SOURCE_DIR`,
   `ATLAS_RUNTIME_RELEASE_SHA`, `ATLAS_RUNTIME_LOG_DIR`, listeners on 5001/5174 with owning PIDs,
   `/api/v1/health`, `/api/v1/health/ready`, DB-backed read `GET /api/v1/subjects?schoolId=1`, live release HEAD,
   and six-table DB digests as the **zero-write baseline** (recorded verbatim — A4 depends on it).
2. Create `E:\ATLAS-runtime-supervised-26f7c907-20260926` as a **registered worktree** at the target SHA (never a
   clone). Dependencies by **`robocopy /E` real copy** from `E:\ATLAS-runtime-supervised-861d89a2-20260925`
   (client 0.213 GiB / 156 entries, server 0.368 GiB / 209 entries, `tsx` and `prisma` present, 0 reparse points
   tree-wide). **No junction, no junction chain, no junction to the live release, no `npm ci`.**
   **2b. Set the log directory (HIGH, machine scope).** `New-Item -ItemType Directory -Force
   C:\ProgramData\ATLAS\runtime-logs`, then
   `[Environment]::SetEnvironmentVariable('ATLAS_RUNTIME_LOG_DIR','C:\ProgramData\ATLAS\runtime-logs','Machine')`
   **before** the runner is invoked. **Disclosure:** the runner manages only `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA`, so its rollback will **not** revert this variable. That is deliberate and benign —
   the log location is release-independent — but it is a machine value that outlives a rollback and is named here
   so no later session is surprised by it.
   **2c. Relocate the two non-live bases' in-worktree log directories** so a rollback basis can pass the
   runner's cleanliness gate. `E:\ATLAS-runtime-supervised-861d89a2-20260925\ops\runtime\logs` and
   `…-eb0e3038-20260925\ops\runtime\logs` move to `C:\ProgramData\ATLAS\runtime-logs\pre-cutover\<sha>\`,
   recording each directory's file list, byte total and per-file SHA-256 **before** the move. Blast radius: two
   untracked runtime log directories, 2 files each, already superseded, with their evidence preserved at the
   destination. **`116a7658` is LIVE and its logs are being written — its directory must NOT be moved.** If the
   live release is ever needed as a rollback basis, A10 will show it ineligible and step 2d applies.
   **2d. If `116a7658` must become rollback-eligible**, the only supported route is that it be restarted once
   with `ATLAS_RUNTIME_LOG_DIR` set, so its supervisor writes outside the worktree; its existing in-worktree
   log directory is then relocated as in 2c. That is an additional HIGH action (runtime restart) and is
   **not** authorized by this packet unless the operator grants it — so **A10 is expected to show
   `116a7658` ineligible at plan time**, and the executor must report that rather than proceed silently.
3. `prisma generate` from `atlas-server` with `--schema` at the **repo-root** schema. Codegen only — **no
   database connection, and no migration is run.**
4. Build with the fail-closed guard satisfied:
   `$env:VITE_ENROLLPRO_URL = "https://dev-jegs.buru-degree.ts.net"` in the build process environment.
   `atlas-client/vite.config.ts` requires it (`REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, the
   only required var) and emits no bundle without it. An origin URL, never a secret.
5. Prove the built target in isolation: start it on port **5198** with `PORT=5198`,
   `ROLLOVER_AUTO_SYNC_ENABLED=false`, **and `ATLAS_RUNTIME_LOG_DIR=C:\ProgramData\ATLAS\runtime-logs`**, plus
   explicit `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA`. Require health 200, ready 200 with
   `database:"ok"`, DB-backed 200; stop the actual listener PID and prove 5198 released.
   **5b. NEW GATE — the target must still be clean.** After the child is stopped, run
   `git -C E:\ATLAS-runtime-supervised-26f7c907-20260926 status --short` and **require empty output**. If it is
   not empty, **stop**: something the runtime writes is landing in the worktree, `Get-GitIdentity` will abort the
   cutover, and proceeding would repeat R3's failure one step later. Record the literal output either way.
6. Prove the build is new by fetching an asset chunk that exists **only** in this build.
7. **Record the new release in the register BEFORE cutover.** The runner calls `Assert-LiveReleaseRecorded`,
   reading `docs/plans/live-state.md` from `-LiveStateRef` (default **`origin/main`** — a *committed* ref) and
   requiring the **8-char target prefix** inside the `## Live release` section. Commit and push it before
   `-Execute`. **Retain the `116a7658` entry** in that section as well, because the rollback run's swapped
   invocation needs it. This lane writes only the `## Live release` block and its own Lane A section.
8. **Cutover — the repo-owned runner only.** It sets task XML **and** both machine env vars, does
   `taskkill /PID /T /F` on the supervisor tree, sleeps 10 s, **asserts** 5001/5174 cleared, then
   `schtasks /run`, reverting env + XML and restarting on any throw. **The dry run is not purely read-only:**
   `Save-SchtasksXml` (`:270`) and `Replace-TaskSourceBytes` (`:271`) write under
   `C:\ProgramData\ATLAS\release-audit\<sha8>-<timestamp>\` before the `-Execute` branch at `:278`. That is
   benign and outside the repo, but it is a write and is disclosed as one. Dry run first, then `-Execute`, with
   identical arguments (§9).

9. Post-cutover verification: health 200, ready 200 `database:"ok"`, DB-backed read 200, the new chunk fetchable
   on 5174, and the supervisor action **plus both machine env vars** naming the new release. Identity reads use
   **explicit** env overrides per the `cli.mjs` rule.

**Rollback.** The runner's own `catch` reverts env + XML and restarts. A rollback **outside** that try-block is
the **full argument swap** — changing only the target pair fails closed at `Get-MachineIdentity` (machine env
would not match the declared incumbent) and at `Replace-TaskSourceBytes` (the target XML no longer contains two
references to the declared incumbent):

```
  -TargetSha "116a765814bf56fdd30aec02c611869aaff42190" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-116a7658-20260726" `
  -IncumbentSha "26f7c907a37185e036e71cf0d82423794689b318" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-26f7c907-20260926"
```

**A10 must be satisfied for this to be executable** — the rollback target must return an empty
`git status --short`, or the swapped run aborts at `:262` before any mutation.

## 6. Acceptance rows

| # | Row | Harness | Expected |
| --- | --- | --- | --- |
| A1 | Release identity: installed HEAD `26f7c907`; supervisor action **and both machine env vars** name the new release | `cli.mjs status` **with explicit env overrides** + `git -C <release> rev-parse HEAD` + machine env | PASS |
| A2 | New-build proof: a chunk present only in this build is served on 5174 | HTTP fetch | PASS |
| A3 | Health 200, ready 200 `database:"ok"`, DB-backed read 200 | HTTP | PASS |
| A4 | **Zero write:** six-table digests identical to step 1's verbatim baseline | SQL digests | PASS |
| A5 | **Scoped to the 39 changed production files:** no engine token, raw enum or de-snake-cased code reaches the operator surface there. Includes `TimetableTaskDrawer.tsx`, which **is** in the changed set (live `73e61b9a` → main `182f0e4a`, additive unassigned-sessions panel) and where the `Subject #<id>` default **survives at `:139`**, its only caller passing a real label (`ScheduleReviewWorkspaceBody.tsx:88`) | **Browser**, authenticated | PASS |
| A6 | An unmapped rule renders the one honest sentence; an absent value renders the em dash | **Browser** | PASS |
| A7 | No new console errors and no failed requests on the timetable workspace | **Browser** | PASS |
| A8 | Client suite at the release SHA. **Baseline provenance:** measured at base `5960cfce` as **1062 tests / 1046 pass / 16 fail across 11 files** with a self-owned dependency tree, and at candidate `de392cf8` as **1079 / 1063 / 16 across the same 11 files** — so the expected result is 16 fails / 11 files, zero new | `npm run test:client-suite` | PASS |
| A9 | `typecheck` adds zero errors. **Baseline provenance:** exactly **4** errors, all in 3 test files this range never touches (`timetable-post-deploy-c04.test.ts`, `-c05.test.ts`, `timetable-scheduling-quality-c03.test.tsx`; 3× TS2307 undeclared `playwright`, 1× TS7006) | `npm run typecheck` | PASS |
| A10 | **Rollback target runner-eligible (extended).** For each of `…-116a7658-20260726`, `…-861d89a2-20260925`, `…-eb0e3038-20260925`: `git -C <dir> rev-parse HEAD` equals the declared SHA, the path is **not** a reparse point, `ops/runtime/cli.mjs`, `atlas-server/dist/server.js`, `atlas-client/dist/index.html` are present, **and `git -C <dir> status --short` returns empty**. All three outputs recorded verbatim in §9. `116a7658` is **expected to be ineligible** until 2d is authorized — report it, do not work around it | filesystem + `git`, **nothing started** | PASS |
| A11 | **Dated residual, recorded not asserted clean** — the surviving J2 sweep, restricted to blobs genuinely outside the changed set and byte-identical: `PublicationApprovalInbox.tsx` (`5d4eda24`, renders `Run #<id>` / `account #<id>`), `ManualEditPanel.tsx` (`e6fdb0b1`, `v.code.replace(/_/g,' ')` at `:929,948`), `QuickPlaceSummaryModal.tsx` (`a0406331`, de-snake-cased quick-place reason) | **`git rev-parse 116a7658:<path>` vs `git rev-parse 26f7c907:<path>` for each** — byte identity, not a browser spot-check | PASS as a *recorded residual* |
| A12 | (a) the one-teaching-space case returns that room and the many-space case returns `null` — **committed and gate-reachable** at `atlas-client/src/components/timetable/__tests__/timetable-relaxed-main-b02.test.tsx:243` and `:370`, reachable via `npm run test:client-suite`; (b) the observable many-space path renders today's manual-placement behaviour with no regression | (a) the named committed test; (b) **Browser** | PASS |
| A13 | **Log-directory separation (new).** `ATLAS_RUNTIME_LOG_DIR` is set machine-scope and resolves outside every release worktree; `E:\ATLAS-runtime-supervised-26f7c907-20260926\ops\runtime\logs` **does not exist** after cutover; and the new release's `git status --short` is empty | machine env read + `Test-Path` + `git status --short` | PASS |

**A12 note.** The review measured **98** teaching spaces for school 1, so `teachingSpaces.length === 1` is
unreachable in the live database and a browser can never witness that branch — which is why (a) is a unit row and
only (b) is a browser row. The count must be re-derived by the executor and the command recorded.

## 7. Post-action QA owner

**Owner: `atlas-qa` (fresh, independent, read-only), dispatched by the planner after the runner returns.** It
closes every post-cutover row including A4's zero-write corroboration and must return a real
`passed / total`, `blocked: N`, `unperformed: N` tally with **no row declared not applicable**. Deployment and
acceptance remain **separate outcomes**: a healthy deployed process may be `DEPLOYED` while acceptance is
incomplete. Browser rows A5–A7, A12(b) run under **Lane A**, which holds the seeded profile
`C:\Users\njgro\.config\opencode\playwright-profile` (token key `atlas_local_token`), using the **Tailnet root
origin only** (`https://njgrm.buru-degree.ts.net`) — never an asset URL or `robots.txt`. Live browser evidence
proves the deployed surface, never undeployed source bytes.

## 8. Not authorized

Any migration, live-data write, generation, publication, term-cache apply, Teaching Load apply, availability
write, rollover sync, companion-repository action, or any env/task change beyond step 2b's log-directory
variable and the runner's own three-part cutover with its rollback. **Step 2d's runtime restart of the live
release is NOT authorized.** This lane will **not** edit Lane B's or Lane C's live-state sections: on cutover,
**4** dated `not deployed` claims in Lane C's section (lines 311, 483, 515, 549) become stale, so **Lane A's
section records a dated supersession request naming them** and Lane C updates its own text.

## 9. Every literal and the command that produced it

| Literal | Command |
| --- | --- |
| target `26f7c907a37185e036e71cf0d82423794689b318` | `git rev-parse 26f7c907` |
| incumbent `116a765814bf56fdd30aec02c611869aaff42190` | `git rev-parse 116a7658` |
| `116a7658` not an ancestor of `main` | `git merge-base --is-ancestor 116a7658 origin/main` → exit 1 |
| live-only commits `d07cac05`, `116a7658` | `git rev-list origin/main..116a7658` |
| blobs `664c7b2c` / `1b46c877` / `8357571` / `d7a55c10` | `git rev-parse 116a7658:<path>` = `git rev-parse 26f7c907:<path>` |
| `TimetableTaskDrawer` `73e61b9a` → `182f0e4a` | same, both sides |
| A11 blobs `5d4eda24` / `e6fdb0b1` / `a0406331` | same, both sides, equal |
| A8 baseline 1062/1046/16 in 11 files; candidate 1079/1063/16 | `npm run test:client-suite` on the base control worktree and on the candidate |
| A9 baseline exactly 4 errors in 3 files | `npm run typecheck`; `git diff --name-status 116a7658 26f7c907 -- <those 3 paths>` → unchanged |
| `ATLAS_RUNTIME_LOG_DIR`, default `ops/runtime/logs`, `maxBytes 5242880`, `maxFiles 5` | `Get-Content ops/runtime/runtime-contract.json \| ConvertFrom-Json` → `.logs` |
| log-dir override honours the variable, absolute-path required | `ops/runtime/lib/contract.mjs:328-337` |
| runner sets only `ATLAS_RUNTIME_SOURCE_DIR` and `ATLAS_RUNTIME_RELEASE_SHA` (lines 289-290, 301-302) | `Select-String deploy-runner.ps1 'SetEnvironmentVariable'` |
| runner cleanliness gate `deploy-runner.ps1:74-75`, reached at `:262` | file read |
| dry-run writes `AuditRoot` (default `C:\ProgramData\ATLAS\release-audit`) at `:266,270,271` before the `-Execute` branch at `:278` | file read |
| `861d89a2` donor client 156 entries / 0.213 GiB, server 209 / 0.368 GiB, 0 reparse points | `Get-ChildItem -Recurse -File \| Measure-Object Length -Sum`; `(Get-Item).Attributes` |
| all three bases report exactly `?? ops/runtime/logs/` | `git -C <each> status --short` |
| `C:\ProgramData\ATLAS` and `…\release-audit` exist; `…\runtime-logs` does not | `Test-Path` per path |
| C: 5.48 GiB free · E: 48.73 GiB · D: 60.67 GiB | `Get-PSDrive C,E,D` |
| placement default at `:1051`; `teachingSpaces` at `:1023-1025` | file read (R3 cited `:1050`, a comment line) |
| A12(a) assertions at `timetable-relaxed-main-b02.test.tsx:243` and `:370` | file read; reachable via `npm run test:client-suite` |
| 4 strict `not deployed` claims in Lane C at 311/483/515/549 | `Select-String` over Lane C's section only; **not** the whole file, which also matches Lane A's own text |
| 98 teaching spaces, school 1 | reviewer's `GET /api/v1/map/schools/1/buildings`; **re-derive before execution** |
| process-scope `ATLAS_RUNTIME_SOURCE_DIR` = retired `c5e167d7` | `$env:ATLAS_RUNTIME_SOURCE_DIR` |
| `Assert-LiveReleaseRecorded` needs the 8-char target in the Live release section | `deploy-runner.ps1:198-217`, `:178-196` |
| `REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, only required var | `atlas-client/vite.config.ts:13,23-24` |
