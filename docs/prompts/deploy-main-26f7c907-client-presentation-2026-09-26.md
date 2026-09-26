# Deployment packet — `main` client-presentation release (client-only, no migration) — **R5**

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (deployment) · Status: **CORRECTED after four
independent pre-action reviews — 8/14 (R1), 9/13 (R2), 11/12 (R3), 7/12 (R4). R5 removes the machine-env and
source-change approaches entirely and gates on one verified precondition. Requires a fifth pre-action pass.**

Supersedes R4 (`27ec8611`), R3 (`64b4d1af`), R2, R1.

## 0. GATE — the one operator action this packet depends on

R4's central fix was wrong, and the review proved it by execution. `ATLAS_RUNTIME_LOG_DIR` moves the supervisor's
**log file**, but the file that actually makes a release worktree dirty is **`supervisor-state.json`**, written
by a separate hardcoded resolver:

```
ops/runtime/cli.mjs:21-23
  function statePathFor(sourceDir, contract) {
      return resolve(sourceDir, contract.logs.defaultDirectory, contract.state.fileBaseName);
  }
```

It never calls `resolveLogDirectory` and never reads `ATLAS_RUNTIME_LOG_DIR`, so the state file always lands in
`<release>\ops\runtime\logs\`. And it is the **only** unignored file there — `.gitignore:83` is `*.log`, so the
log file is *already* ignored. R4 therefore moved the already-ignored half and left the half that matters.

**The fix is one line in the shared repository excludes, and it is an operator action because this lane's file
tools are refused for `D:\ATLAS\.git\info\exclude`** (both `write` and `edit` are rejected by the current
permission rules, despite an apparent `D:/ATLAS/**` allow entry). To add, to the end of
`D:\ATLAS\.git\info\exclude`:

```
/ops/runtime/logs/
```

**Verified effect, measured in-session and non-invasively** (a temporary excludes file passed via
`git -c core.excludesFile=<temp>`, so the shared file itself was never touched):

| Release directory | `git status --short` before | after the rule | clean |
| --- | --- | --- | --- |
| `…-116a7658-20260726` (**LIVE**) | `?? ops/runtime/logs/` | *(empty)* | **yes** |
| `…-861d89a2-20260925` | `?? ops/runtime/logs/` | *(empty)* | **yes** |
| `…-eb0e3038-20260925` | `?? ops/runtime/logs/` | *(empty)* | **yes** |

**This single line resolves every blocker R4 could not**, and is strictly better than either alternative it
replaces:

| R4 approach | Why it is dropped |
| --- | --- |
| Step 2b, machine-scope `ATLAS_RUNTIME_LOG_DIR` | does not govern the state file (proved by execution); and as a durable machine-env mutation it is **not covered** by the standing authorization, which R4's review flagged as unevidenced |
| Changing `cli.mjs:21-23` to honour the log directory | a source change to the audited runtime supervisor, needing its own review cycle, to work around a configuration gap that the exclude closes |

And it delivers what R4 could not: **`116a7658` becomes a runner-eligible rollback basis while still live**, so
the rollback keeps **both F1/F2 fixes** and no live restart is needed.

**Precondition for every step below: the executor must first confirm the rule is present, by reading the shared
file.** If it is absent, **STOP** and report — do not proceed, do not add it, do not work around it.

## 1. Target

| Field | Value |
| --- | --- |
| Product to build | **`26f7c907a37185e036e71cf0d82423794689b318`** (short `26f7c907`) |
| New release directory | `E:\ATLAS-runtime-supervised-26f7c907-20260926` |
| Live release being replaced | `116a765814bf56fdd30aec02c611869aaff42190` at `E:\ATLAS-runtime-supervised-116a7658-20260726` |
| **Rollback basis** | **`116a7658`** — eligible only once the §0 rule is present; verified in A10 |
| Cutover owner | **`ops/runtime/deploy-runner.ps1`**, elevated, from the incumbent release |
| Env file | `D:\ATLAS-runtime-config\atlas-server.env` (never printed, never echoed) |

## 2. Reconciliation proof and expected delta (reproduced four times; unchanged)

`116a7658` is not an ancestor of `main` (exit 1), so this cannot fast-forward. `git rev-list origin/main..116a7658`
is exactly `d07cac05` and `116a7658`, whose product blobs are byte-identical on `main`: `timetableDriftRouting.ts`
`664c7b2c`, `published-schedule.service.ts` `1b46c877`, `…-drift.test.ts` `8357571`, c08 test `d7a55c10`. The one
differing file is a **test**. **No live product byte is lost; the deployment is additive.** `atlas-server/`,
`prisma/`, `*.env*`, `vite.config*`, `ops/` diffs **empty**; `atlas-client/package.json` is `scripts`-only, **no
dependency change**; client delta **64 files** (39 production, 25 tests). **Not presentation-only:**
`useScheduleReviewWorkspaceState.ts:1051` returns `teachingSpaces[0].id` when `teachingSpaces.length === 1`, else
`null` (`teachingSpaces` = `roomMap` values filtered by `isTeachingSpace`, `:1023-1025`).

## 3. Authority

- **In-repo standing authorization:** `docs/plans/live-state.md:219-222` — HIGH actions, deployment and browser
  acceptance, gates retained. The operator additionally granted HIGH authority in queued instructions on
  2026-09-26. **R5's authority surface is a client-only deployment with no migration, no live-data write, and no
  machine-env mutation** — the two HIGH surfaces R4 needed beyond that grant are gone, along with the unevidenced
  authority R4's review flagged.
- **Per-cycle verdict lineage:** C2 `ACCEPT_READY` 16/16/0/0 · J2/J3 `ACCEPT_READY` 20/20/0/0 after
  `CORRECTION_REQUIRED` 18/20 · C1 4/7 and C3 5/8 → planner-reviewed bounded corrections · J2 8/9 → D2 closed by
  `1ccdf4dd`. `98289573` is superseded by the reviewed `de392cf8`. **No cycle shipping now is open or unreviewed.**

## 4. Execution steps

**Elevated shell required** (`Assert-Administrator`).

> **`cli.mjs` rule.** `cli.mjs:16-19` resolves the release from **process**-scope `ATLAS_RUNTIME_SOURCE_DIR`,
> which names the **retired** `c5e167d7`. **Every** `cli.mjs` invocation sets `ATLAS_RUNTIME_SOURCE_DIR` and
> `ATLAS_RUNTIME_RELEASE_SHA` explicitly, in the same command.

0. **§3 capacity gate: satisfied.** Reclaim `20260926c` ran, its audit confirmed the E: release set is exhausted
   and the obligation discharged, and the additive disposition restoration is recorded. E: 48.73 GiB, D: 60.67.
1. **Confirm the §0 precondition.** Read `D:\ATLAS\.git\info\exclude` and confirm `/ops/runtime/logs/` is
   present. Then confirm all three bases return **empty** `git status --short`. **If the rule is absent, stop.**
2. Preflight and record: supervisor action + status, machine `ATLAS_RUNTIME_SOURCE_DIR` /
   `ATLAS_RUNTIME_RELEASE_SHA`, listeners on 5001/5174 with owning PIDs, `/api/v1/health`,
   `/api/v1/health/ready`, DB-backed read `GET /api/v1/subjects?schoolId=1`, live release HEAD, and six-table DB
   digests as the **zero-write baseline** (verbatim — A4 depends on it).
3. Create `E:\ATLAS-runtime-supervised-26f7c907-20260926` as a **registered worktree** at the target SHA (never a
   clone). Dependencies by **`robocopy /E` real copy** from `E:\ATLAS-runtime-supervised-861d89a2-20260925` — its
   `node_modules` trees are 156 entries / 0.213 GiB (client) and 209 / 0.368 GiB (server), `tsx` and `prisma`
   present, 0 reparse points tree-wide. **No junction, no junction chain, no junction to the live release, no
   `npm ci`.**
4. `prisma generate` from `atlas-server` with `--schema` at the **repo-root** schema. Codegen only — **no database
   connection, and no migration is run.**
5. Build with the fail-closed guard satisfied: `$env:VITE_ENROLLPRO_URL = "https://dev-jegs.buru-degree.ts.net"`
   in the build process environment. `atlas-client/vite.config.ts` requires it
   (`REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, the only required var) and emits no bundle without
   it. An origin URL, never a secret.
6. Prove the built target in isolation: start it on port **5198** with `PORT=5198` and
   `ROLLOVER_AUTO_SYNC_ENABLED=false`, plus explicit `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA`.
   Require health 200, ready 200 with `database:"ok"`, DB-backed 200; stop the actual listener PID and prove 5198
   released. **6b. GATE — the target must be clean after the isolation run:**
   `git -C E:\ATLAS-runtime-supervised-26f7c907-20260926 status --short` must be **empty**. Record the literal
   output either way; if non-empty, **stop**.
7. Prove the build is new by fetching an asset chunk that exists **only** in this build.
8. **Record the new release in the register BEFORE cutover.** `Assert-LiveReleaseRecorded` reads
   `docs/plans/live-state.md` from `-LiveStateRef` (default **`origin/main`** — a committed ref) and requires the
   **8-char target prefix** inside the `## Live release` section. **Keep the `116a7658` and `861d89a2` entries**
   there, since the rollback run's swapped invocation needs one of them. Commit and push before `-Execute`. This
   lane writes only the `## Live release` block and its own Lane A section.
9. **Cutover — the repo-owned runner only.** It sets task XML **and** both machine env vars, `taskkill /PID /T /F`
   on the supervisor tree, sleeps 10 s, **asserts** 5001/5174 cleared, then `schtasks /run`, reverting env + XML
   and restarting on any throw. **The dry run is not purely read-only:** `Save-SchtasksXml` (`:270`) and
   `Replace-TaskSourceBytes` (`:271`) write under `C:\ProgramData\ATLAS\release-audit\<sha8>-<timestamp>\` before
   the `-Execute` branch at `:278` — benign, outside the repo, and disclosed. Dry run first, then `-Execute`, with
   identical arguments (§7).
10. Post-cutover verification: health 200, ready 200 `database:"ok"`, DB-backed read 200, the new chunk fetchable
    on 5174, the supervisor action **plus both machine env vars** naming the new release, **and — repeated from
    6b, because starting the supervisor writes the state file — `git -C <target> status --short` empty again**
    (10b). Identity reads use **explicit** env overrides per the `cli.mjs` rule.

**Rollback.** The runner's `catch` reverts env + XML and restarts. Outside that try-block it is the **full
argument swap** — changing only the target pair fails closed at `Get-MachineIdentity` (machine env would not
match the declared incumbent) and at `Replace-TaskSourceBytes` (the target XML no longer holds two references to
the declared incumbent):

```
  -TargetSha "116a765814bf56fdd30aec02c611869aaff42190" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-116a7658-20260726" `
  -IncumbentSha "26f7c907a37185e036e71cf0d82423794689b318" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-26f7c907-20260926"
```

**`116a7658` is the rollback target and it keeps both F1/F2 production fixes.** R4's alternative — falling back to
`861d89a2` — would have reintroduced the availability-drift routing defect and the published-export term-identity
defect into production, because `861d89a2` is `116a7658` **minus** `d07cac05` and `116a7658`. That floor is
acceptable only if the §0 rule is absent, and in that case **this deployment does not run**; it is recorded, not
chosen.

## 5. Acceptance rows

| # | Row | Harness | Expected |
| --- | --- | --- | --- |
| A1 | Release identity: installed HEAD `26f7c907`; supervisor action **and both machine env vars** name the new release | `cli.mjs status` **with explicit env overrides** + `git -C <release> rev-parse HEAD` + machine env | PASS |
| A2 | New-build proof: a chunk present only in this build is served on 5174 | HTTP fetch | PASS |
| A3 | Health 200, ready 200 `database:"ok"`, DB-backed read 200 | HTTP | PASS |
| A4 | **Zero write:** six-table digests identical to step 2's verbatim baseline | SQL digests | PASS |
| A5 | **Scoped to the 39 changed production files:** no engine token, raw enum or de-snake-cased code reaches the operator surface there. Includes `TimetableTaskDrawer.tsx`, **in** the changed set (live `73e61b9a` → main `182f0e4a`, additive unassigned-sessions panel), where the `Subject #<id>` default **survives at `:139`**, its only production caller passing a real label (`ScheduleReviewWorkspaceBody.tsx:88`) | **Browser**, authenticated | PASS |
| A6 | An unmapped rule renders the one honest sentence; an absent value renders the em dash | **Browser** | PASS |
| A7 | No new console errors and no failed requests on the timetable workspace | **Browser** | PASS |
| A8 | Client suite at the release SHA. **Baseline:** base `5960cfce` = 1062/1046/**16 fails across 11 files**; candidate `de392cf8` = 1079/1063/**16 across the same 11 files** — measured on a self-owned dependency tree | `npm run test:client-suite` | PASS |
| A9 | `typecheck` adds zero errors. **Baseline: exactly 4**, being 3× TS2307 undeclared `playwright` in `timetable-post-deploy-c04.test.ts` and `-c05.test.ts` (both untouched by this range) plus 1× TS7006 in `timetable-scheduling-quality-c03.test.tsx`, which this range **does** modify — so the baseline must be re-derived at the release SHA, not assumed from the earlier range | `npm run typecheck` at the release SHA, compared to `5960cfce` | PASS |
| A10 | **Rollback basis runner-eligible.** For `…-116a7658-20260726`: `rev-parse HEAD` equals the declared SHA, the path is **not** a reparse point, `ops/runtime/cli.mjs` / `atlas-server/dist/server.js` / `atlas-client/dist/index.html` are present, and **`git status --short` is empty**. Outputs recorded verbatim in §7 | filesystem + `git`, **nothing started** | PASS |
| A11 | **Dated residual, recorded not asserted clean** — surviving J2 sweep, restricted to blobs outside the changed set and byte-identical: `PublicationApprovalInbox.tsx` (`5d4eda24`, renders `Run #<id>` / `account #<id>`), `ManualEditPanel.tsx` (`e6fdb0b1`, `v.code.replace(/_/g,' ')` at `:929,948`), `QuickPlaceSummaryModal.tsx` (`a0406331`, de-snake-cased quick-place reason) | **`git rev-parse 116a7658:<path>` vs `git rev-parse 26f7c907:<path>`** per path | PASS as a *recorded residual* |
| A12 | (a) one-teaching-space case returns that room, many-space returns `null` — committed at `timetable-relaxed-main-b02.test.tsx:243` and `:370`, reachable via `npm run test:client-suite`; (b) the observable many-space path renders today's manual-placement behaviour unchanged | (a) the named committed test; (b) **Browser** | PASS |
| A13 | **Cleanliness separation (restated to be satisfiable).** (i) `git -C <target> status --short` is empty **after** a supervisor start (6b and again at 10b); (ii) `supervisor-state.json` exists under the target's `ops/runtime/logs/` and is **ignored**, which is what the §0 rule guarantees; (iii) the §0 rule is present in the shared excludes. **R4's clause "`<target>\ops\runtime\logs` does not exist" is dropped** — `statePathFor` writes there in-worktree by design, and that is precisely why the ignore rule is the correct fix | `git status --short` + `git check-ignore -v` + read of the excludes file | PASS |

**A12 note.** The review measured **98** teaching spaces for school 1, so `teachingSpaces.length === 1` is
unreachable live and a browser cannot witness that branch — hence (a) is a unit row and only (b) is a browser row.
The count must be re-derived and the command recorded.

## 6. Post-action QA owner

**Owner: `atlas-qa` (fresh, independent, read-only), dispatched by the planner after the runner returns.** It
closes every post-cutover row including A4's zero-write corroboration and must return a real
`passed / total`, `blocked: N`, `unperformed: N` tally with **no row declared not applicable**. Deployment and
acceptance remain **separate outcomes**. Browser rows A5–A7 and A12(b) run under **Lane A** with the seeded profile
`C:\Users\njgro\.config\opencode\playwright-profile` (token key `atlas_local_token`), using the **Tailnet root
origin only** — never an asset URL or `robots.txt`. Live browser evidence proves the deployed surface only.

## 7. Not authorized, and the literals behind this packet

No migration, live-data write, generation, publication, term-cache apply, Teaching Load apply, availability write,
rollover sync, companion-repository action, **machine-environment mutation**, **source change to
`ops/runtime/`**, or any env/task change beyond the runner's own three-part cutover and its rollback. This lane
will **not** edit Lane B's or Lane C's live-state sections: on cutover the **4** dated `not deployed` claims in
Lane C's section (lines 311, 483, 515, 549) become stale, so Lane A records a dated supersession request and Lane
C updates its own text.

| Literal | Command |
| --- | --- |
| target `26f7c907a37185e036e71cf0d82423794689b318` | `git rev-parse 26f7c907` |
| incumbent `116a765814bf56fdd30aec02c611869aaff42190` | `git rev-parse 116a7658` |
| `116a7658` not an ancestor of `main` | `git merge-base --is-ancestor 116a7658 origin/main` → exit 1 |
| live-only commits `d07cac05`, `116a7658` | `git rev-list origin/main..116a7658` |
| `861d89a2` is `116a7658` minus F1/F2 | `git log --oneline 861d89a2..116a7658`; `git diff --name-status 861d89a2 116a7658` |
| blobs `664c7b2c` / `1b46c877` / `8357571` / `d7a55c10` | `git rev-parse 116a7658:<path>` = `git rev-parse 26f7c907:<path>` |
| `TimetableTaskDrawer` `73e61b9a` → `182f0e4a` | same, both sides |
| A11 blobs `5d4eda24` / `e6fdb0b1` / `a0406331` | same, both sides, equal |
| state path ignores the log-dir variable | `ops/runtime/cli.mjs:21-23`; executed control with the variable set and unset |
| the log file **is** already ignored; the state file is not | `git check-ignore -v` on both, exit 0 vs 1; `.gitignore:83` = `*.log` |
| the §0 rule makes all three bases clean | `git -C <dir> -c core.excludesFile=<temp> status --short` → empty, for all three |
| runner gates only the **target**, not the incumbent | `deploy-runner.ps1:262` calls `Get-GitIdentity $TargetSourceDir`; the incumbent is checked by `Get-MachineIdentity :263` on machine env only |
| cleanliness gate `:74-75`; dry-run writes `:266,270,271` before `:278`; env sets `:289-290`, reverts `:301-302` | file read |
| `Assert-LiveReleaseRecorded` needs the 8-char target in the Live release section | `deploy-runner.ps1:198-217`, `:178-196` |
| donor `node_modules` 156 / 0.213 GiB client, 209 / 0.368 GiB server, 0 reparse points | `Get-ChildItem <dir>\atlas-client\node_modules` (and `atlas-server`), `Measure-Object Length -Sum`, `(Get-Item).Attributes` |
| E: 48.73 · D: 60.67 · C: 5.48 GiB | `Get-PSDrive E,D,C` |
| placement default `:1051`; `teachingSpaces` `:1023-1025` | file read |
| A12(a) at `timetable-relaxed-main-b02.test.tsx:243`, `:370`, in `test:client-suite` | file read; `ConvertFrom-Json` on the script |
| 4 strict `not deployed` claims in Lane C at 311/483/515/549 | `Select-String` over **Lane C's section only** — a whole-file grep also matches Lane A's text and inflates the count |
| 98 teaching spaces, school 1 | `GET /api/v1/map/schools/1/buildings`; **re-derive before execution** |
| `ATLAS_RUNTIME_LOG_DIR` / default `ops/runtime/logs` / `maxBytes 5242880` / `maxFiles 5` | `Get-Content ops/runtime/runtime-contract.json \| ConvertFrom-Json` → `.logs` |
| `ops/runtime/atlas-logs.ps1:29` hardcodes the in-worktree log path and takes no override | file read — **so the documented log-tail command goes silent under the §0 route; use the file in the release's own `ops/runtime/logs/` instead** |
