# Deployment packet — `main` client-presentation release (client-only, no migration) — **R2**

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (deployment) · Status: **CORRECTED after
independent pre-action review `CORRECTION_REQUIRED` 8/14 (4 blocking) — requires a fresh pre-action pass**

Supersedes R1 at `b43f470a`. Every correction below answers a numbered finding from that review; the source
range it reviews was verified clean and additive (rows 9–11 passed) and is **unchanged** by this revision.

## 1. Exact target

| Field | Value |
| --- | --- |
| Product to build | **`origin/main` = `26f7c907`** |
| New release directory | `E:\ATLAS-runtime-supervised-26f7c907-**20260926**` (R1 said `20260726` — wrong date, F5) |
| Live release being replaced | `116a765814bf56fdd30aec02c611869aaff42190` at `E:\ATLAS-runtime-supervised-116a7658-20260726` |
| Rollback basis | **`116a7658`** (intact, retained), second `861d89a2` |
| Cutover owner | **`ops/runtime/deploy-runner.ps1`**, invoked from the **incumbent** release, **elevated** |
| Env file | `D:\ATLAS-runtime-config\atlas-server.env` (never printed, never echoed) |
| Task | `ATLAS-Runtime-Supervisor` (default `-TaskName`) |

## 2. Reconciliation proof (unchanged, independently reproduced by the review)

`116a7658` is not an ancestor of `main` (exit 1), so this cannot fast-forward. `git log --oneline
origin/main..116a7658` returns exactly two commits, `d07cac05` and `116a7658`, and their product blobs are
byte-identical on `main` (`timetableDriftRouting.ts` `664c7b2c`, `published-schedule.service.ts` `1b46c877`,
`…-drift.test.ts` `8357571`, c08 test `d7a55c10`). The single differing file is a **test**. **No live product
byte is lost; the deployment is additive.**

## 3. Expected delta

- `atlas-server/`: **empty diff.** `prisma/migrations/`: **empty.** `*.env*`, `vite.config*`, `ops/`: **empty.**
- `atlas-client/package.json`: `scripts` only — **no dependency added or removed**, so no new install.
- `atlas-client/src/`: **64 files**, timetable surface. Non-test files that could touch data, auth, writes or
  navigation were swept: the only hit is `SimplePublishReadinessSheet.tsx onNavigate(group.actionHref, …)` —
  a third argument to an existing in-app handler, no route change. `useTimetableData` reshapes labels only;
  `useTimetableState` adds a `matchMedia` hook; `SimpleSessionDetails` is presentational.
- **F8 correction — this is not presentation-only.** `useScheduleReviewWorkspaceState.ts:1046` changes what is
  *sent*: with exactly one teaching space the placement resolver now returns that room where it previously
  returned `null`. That is a placement default, reviewed inside C1's accepted scope. R1's "no new write path,
  no new persistence" was too strong; the accurate claim is **no new write path, no new persistence, and one
  placement default changed** (a manual placement becomes the resolver's answer when there is only one
  candidate room). Acceptance row **A12** now observes it.

## 4. Authority and verdict lineage

- **Approval:** operator granted HIGH authority for this program in three queued instructions on 2026-09-26
  while asleep. The packet's authority surface (client-only deploy, no migration, no write) does not exceed a
  client-presentation deploy grant. **F6 disclosure:** those grants are operator-side text and are **not
  quotable from the repository**; this line is a planner's summary of them, not the grant itself.
- **Per-cycle verdict lineage for everything reaching production for the first time** (F-row 12 disclosure;
  §11 permits a bounded correction without a full re-review, so this is disclosure, not a gate):
  C2 `ACCEPT_READY` 16/16/0/0 · J2/J3 `ACCEPT_READY` 20/20/0/0 after `CORRECTION_REQUIRED` 18/20 · C1 4/7 →
  planner-reviewed bounded correction · C3 5/8 → same · J2 8/9 → D2 closed by `1ccdf4dd`. **No cycle reaching
  this release is open or blocked.**

## 5. Execution steps

**Elevated shell required** — `deploy-runner.ps1` calls `Assert-Administrator`.

1. Preflight and record: supervisor action + status, machine `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA`, listeners on 5001/5174 with owning PIDs, `/api/v1/health`,
   `/api/v1/health/ready`, DB-backed read `GET /api/v1/subjects?schoolId=1`, live release HEAD, and six-table
   DB digests as the **zero-write baseline**.
2. Create `E:\ATLAS-runtime-supervised-26f7c907-20260926` as a **registered worktree** at `26f7c907` (never a
   clone). Dependencies by **`robocopy /E` real copy from `E:\ATLAS-runtime-supervised-861d89a2-20260925`**
   (client 156 entries, server 209, `tsx` and `prisma` present, not a reparse point). **No junction, no
   junction chain, no junction to the live release, and no `npm ci`.**
3. `prisma generate` from `atlas-server` with `--schema` at the **repo-root** schema. Build/codegen only: it
   makes **no database connection** and **no migration is run**.
4. Build with the fail-closed guard satisfied — **F2 correction, R1 could not produce a bundle**:
   `$env:VITE_ENROLLPRO_URL = "https://dev-jegs.buru-degree.ts.net"` **in the build process environment**
   before the client build. `atlas-client/vite.config.ts` hard-fails without it and emits no bundle. It is an
   origin URL, never a secret. Neither process nor machine scope currently carries it.
5. Prove the built target in isolation: start it on port **5198** with `PORT=5198` and
   `ROLLOVER_AUTO_SYNC_ENABLED=false` in the child environment; require health 200, ready 200 with
   `database:"ok"`, and a DB-backed 200; stop the actual listener PID and prove 5198 released.
6. Prove the build is new by fetching an asset chunk that exists **only** in this build.
7. **Record the new release in the register BEFORE cutover — F1 ordering correction.**
   `deploy-runner.ps1` calls `Assert-LiveReleaseRecorded`, reading `docs/plans/live-state.md` from
   `-LiveStateRef` (default **`origin/main`**, i.e. a *committed* ref, independent of any working tree). So
   `docs/plans/live-state.md` must **name `26f7c907` and its rollback basis `116a7658`, and be committed and
   pushed to `origin/main`, before the runner executes.** R1 recorded it after the switch, which would have
   failed this gate.
8. **Cutover — F1 and F3 correction. R1's hand-written steps are replaced by the repo-owned runner.** R1
   re-pointed only the task action; the runner is the only audited cutover path and it sets **three** things
   (task XML, `ATLAS_RUNTIME_SOURCE_DIR`, `ATLAS_RUNTIME_RELEASE_SHA`), does `taskkill /PID /T /F` on the
   supervisor tree, sleeps 10 s, **asserts** 5001/5174 cleared, then `schtasks /run` — reverting env + XML and
   restarting on any throw. R1's separate `cli.mjs stop` step was also a **no-op**: `cli.mjs` resolves the
   release from the **process**-scope `ATLAS_RUNTIME_SOURCE_DIR`, which currently names the **retired**
   `c5e167d7` release. **Never call `cli.mjs` unqualified in a fresh shell.** Dry run first, then execute,
   with identical arguments:

```
& "E:\ATLAS-runtime-supervised-116a7658-20260726\ops\runtime\deploy-runner.ps1" `
  -TargetSha "26f7c907bfe6d64e992090933f423b806f120cbd" `
  -TargetSourceDir "E:\ATLAS-runtime-supervised-26f7c907-20260926" `
  -IncumbentSha "116a765814bf56fdd30aec02c611869aaff42190" `
  -IncumbentSourceDir "E:\ATLAS-runtime-supervised-116a7658-20260726" `
  -EnvFile "D:\ATLAS-runtime-config\atlas-server.env"
```

The dry run must report the target/incumbent identities, `mutates=false`, `secretsPrinted=false`, a single
supervisor lineage, and a rollback plan. **No credential value may be echoed, printed, or recorded.**

9. Post-cutover verification: health 200, ready 200 `database:"ok"`, DB-backed read 200, the new chunk
   fetchable on 5174, supervisor action **and both machine env vars** naming the new release, and six-table
   digests **identical** to step 1 (zero write).

**Rollback:** the runner's own `catch` reverts env + task XML and restarts. If a failure happens outside the
runner's try-block, invoke the same script with `-TargetSha`/`-TargetSourceDir` set to the **incumbent**
values, which re-points all three authorities back. `116a7658` is retained and intact for this.

## 6. Acceptance rows (each names its harness)

| # | Row | Harness | Expected |
| --- | --- | --- | --- |
| A1 | Release identity: installed HEAD `26f7c907`; supervisor action **and both machine env vars** name the new release | `cli.mjs status` + `git -C <release> rev-parse HEAD` + machine env | PASS |
| A2 | New-build proof: a chunk present only in this build is served on 5174 | HTTP fetch | PASS |
| A3 | Health 200, ready 200 `database:"ok"`, DB-backed read 200 | HTTP | PASS |
| A4 | **Zero write:** six-table digests identical to preflight | SQL digests, planner-recorded | PASS |
| A5 | **Scoped to the 64 changed files:** no engine token, raw enum or de-snake-cased code reaches the operator surface **there** | **Browser**, authenticated | PASS |
| A6 | An unmapped rule renders the one honest sentence; an absent value renders the em dash | **Browser** | PASS |
| A7 | No new console errors and no failed requests on the timetable workspace | **Browser** | PASS |
| A8 | Client suite at the release SHA: 16 fails across the same 11 files as `5960cfce`, zero new | `npm run test:client-suite` | PASS |
| A9 | `typecheck` adds zero errors (baseline exactly 4, all pre-existing) | `npm run typecheck` | PASS |
| A10 | **Rollback target intact:** `116a7658` resolves to that SHA, is **not** a reparse point, and contains `ops/runtime/cli.mjs`, `atlas-server/dist/server.js`, `atlas-client/dist/index.html` | filesystem + git, no start | PASS |
| A11 | **Known dated residual, non-blocking:** `Run #<id>` / `account #<id>` / `Subject #<id>` and two de-snake-casing sites survive **outside** the changed set — `PublicationApprovalInbox.tsx:77`, `TimetableTaskDrawer.tsx:139`, `ManualEditPanel.tsx:929,948`, `QuickPlaceSummaryModal.tsx:58`, `SectionRoomMapModal` — each verified byte-unchanged vs live. Recorded as the surviving J2 sweep, not asserted clean | **Browser**, spot-check that these are unchanged from live | PASS as a *recorded residual* |
| A12 | Placement default: with exactly one teaching space the resolver now returns that room (was `null`) | **Browser** on the placement surface | PASS |

**F4-B correction:** R1's A5 asserted "no `Run #id`" globally, which is **provably unsatisfiable** —
`PublicationApprovalInbox.tsx:77` still renders `Run #{request.runId}` and is byte-unchanged by this
deployment. A5 is now scoped to the changed files, and the real surviving sweep is recorded honestly as A11
rather than being asserted away.

## 7. Capacity judgement (corrected — F4)

R1 claimed the E: release set was "exhausted". That is true of `E:\ATLAS-runtime-*` but **false of the E:
worktree set**: ~8.7 GiB sits in ten finished lane worktrees (`lane-c-demo-departure-swap` 1.46,
`lane-c-post-publish-c01` 1.46, `lane-c-plain-tokens-c04-20260926` 1.09, `lane-c-schedule-clarity-c03` 1.08,
`lane-c-teaching-load-clarity-c02` 0.78, and five at 0.57). **A fresh §3 manifest is therefore available, not
mandatory** — those rows are other lanes' custody and retiring them is not this packet's to do. Measured E:
**48.73 GiB**, D: **60.67 GiB**; the build needs ~2 GiB against a 25 GiB fail-closed, so capacity is
sufficient. The register's line that the next build re-triggers §3 stands as written; this packet relies on
capacity sufficiency, not on a waiver. Clearing the 50 GiB warning still needs the operator's decision on
`E:\ATLAS-runtime-supervised-4893cbde-20260923` (1.80 GiB, `PRESERVE_FOR_DECISION`, a standalone clone).

## 8. Not authorized by this packet

Any migration, live-data write, generation, publication, term-cache apply, Teaching Load apply, availability
write, rollover sync, companion-repository action, or any env/task change beyond the runner's own three-part
cutover and its rollback. A5–A7 and A12 are **browser rows** labelled as such; the acceptance owner is
**Lane A**, which holds the seeded profile `C:\Users\njgro\.config\opencode\playwright-profile` (token key
`atlas_local_token`). Use the **Tailnet root origin only** (`https://njgrm.buru-degree.ts.net`) — never an
asset URL or `robots.txt`. Live browser evidence proves the deployed surface, never undeployed source bytes.
