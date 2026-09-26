# Deployment packet — client presentation delta (`2f86ffee` + `9b1ec14a`), no migration

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (deployment) · Status: **DRAFT — requires an independent
pre-action review before any execution**

## 1. Target

| Field | Value |
| --- | --- |
| Live release being replaced | `26f7c907a37185e036e71cf0d82423794689b318` at `E:\ATLAS-runtime-supervised-26f7c907-20260926` |
| Target to build | **`origin/main` = `5152bff0`** |
| New release directory | `E:\ATLAS-runtime-supervised-5152bff0-20260926` |
| **Rollback basis** | **`26f7c907`** (the incumbent), verified runner-eligible per A10 |
| Relationship | `git merge-base --is-ancestor 26f7c907 origin/main` → **exit 0, so this is a fast-forward.** No reconciliation is needed, unlike the previous deployment. |
| Cutover owner | **`ops/runtime/deploy-runner.ps1`**, elevated, invoked from the incumbent release |
| Env file | `D:\ATLAS-runtime-config\atlas-server.env` (never printed, never echoed) |

## 2. Expected delta — client-only, 5 production files

`git diff --name-only 26f7c907 origin/main` = 17 paths: **5 production client files, 4 client test files, 9 docs.**

- `atlas-client/src/components/ManualEditPanel.tsx` — the §8 extraction (1012 → 933 physical lines)
- `atlas-client/src/components/manual-edit/useManualEditOptionGroups.ts` — new sibling hook holding the moved derivation
- `atlas-client/src/components/timetable/simplePublishReadiness.ts` — lunch title added to `VIOLATION_WARNING_LABELS`
- `atlas-client/src/lib/violation-presentation.ts` — lunch title/meaning/action added to `VIOLATION_PRESENTATION`
- `atlas-client/src/types.ts` — the `ViolationCode` union member (forced: the presentation map is a total `Record`)

**Zero** changes to `atlas-server/`, `prisma/`, `atlas-client/vite.config.ts`, `vite.config.ts`,
`atlas-client/package.json`, root `package.json`, any `.env*`, `ops/`, or any lockfile. **No migration is applied and
none is authorized.** Both cycles are already integrated and independently accepted:
`2f86ffee` (`ACCEPT_READY` 20/20 after a `CORRECTION_REQUIRED` 16/17) and `9b1ec14a` (`ACCEPT_READY` 10/10).

**Why it is worth deploying:** `9b1ec14a` closes the live walk's BLOCKING-for-trust finding — the largest warning
group on the schedule, 100 of 194, was rendering the raw engine code `FACULTY_LUNCH_WINDOW_VIOLATION`. That fix is
currently on `main` and **not live**.

## 3. Capacity — obligation not currently triggered

`AGENTS.md:43` requires the retention reclaim when a volume crosses its warning. **E: is at 56.4 GiB, above the
50 GiB warning**, so no reclaim is owed before this build. Measure and record it at execution; if E: has fallen below
50 GiB by then, **STOP** and run a successor reclaim first.

## 4. Execution steps

**Elevated shell required** (`Assert-Administrator`).

> **`cli.mjs` rule.** `cli.mjs:16-19` resolves the release from **process**-scope `ATLAS_RUNTIME_SOURCE_DIR`. Every
> `cli.mjs` invocation in this packet sets `ATLAS_RUNTIME_SOURCE_DIR` and `ATLAS_RUNTIME_RELEASE_SHA` explicitly, in
> the same command.

1. Confirm the §0 precondition: `/ops/runtime/logs/` is present in `D:\ATLAS\.git\info\exclude`, and **all three**
   retained bases (`…-5152bff0` once built, `…-26f7c907-20260926`, `…-116a7658-20260726`) return **empty**
   `git status --short`. Record the literal outputs. **If the rule is absent, STOP** — do not add it.
2. Preflight and record: supervisor action + status, machine `ATLAS_RUNTIME_SOURCE_DIR` /
   `ATLAS_RUNTIME_RELEASE_SHA`, listeners on 5001/5174 with owning PIDs, `/api/v1/health`,
   `/api/v1/health/ready`, DB-backed read `GET /api/v1/subjects?schoolId=1`, live release HEAD, and the **six-table
   `md5` digests as the verbatim zero-write baseline** (A4 depends on this; record the SQL and serialization).
   Also record the known `cli.mjs status` **`live: false`** false-negative (`cli.mjs:81-89` builds a fresh
   `Supervisor` with an empty children map, so `supervisor.mjs:401` computes `false` regardless of health), so the
   post-cutover comparison has a baseline for it.
3. Create `E:\ATLAS-runtime-supervised-5152bff0-20260926` as a **registered worktree** at the target SHA (never a
   clone). Dependency trees by **`robocopy /E` real copy** from `E:\ATLAS-runtime-supervised-861d89a2-20260925`
   (client 156 entries / 0.213 GiB, server 209 / 0.368 GiB, `tsx` and `prisma` present, 0 reparse points
   tree-wide). **No junction, no junction chain, no junction to the live release, no `npm ci`.**
4. `prisma generate` from `atlas-server` with `--schema` at the **repo-root** schema. Codegen only — **no database
   connection, and no migration is run.**
5. Build with the fail-closed guard satisfied:
   `$env:VITE_ENROLLPRO_URL = "https://dev-jegs.buru-degree.ts.net"` in the **build process environment**.
   `atlas-client/vite.config.ts` requires it (`REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, the only
   required var) and emits no bundle without it. An origin URL, never a secret.
6. Prove the built target in isolation: start it on port **5198** with `PORT=5198` and
   `ROLLOVER_AUTO_SYNC_ENABLED=false`, plus explicit `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA`.
   Require health 200, ready 200 `database:"ok"`, DB-backed 200; stop the actual listener PID and prove 5198
   released.
   **6b. GATE — the target must be clean after the isolation run:**
   `git -C E:\ATLAS-runtime-supervised-5152bff0-20260926 status --short` must be **empty**. Record the literal output.
   If non-empty, **STOP**.
7. Prove the build is new by fetching an asset chunk that exists **only** in this build, and record the incumbent
   chunk's response for contrast.
8. **Record the new release in the register BEFORE cutover — on a main-based docs branch, NOT in the release
   worktree.** The runner calls `Assert-LiveReleaseRecorded`, reading `docs/plans/live-state.md` from `-LiveStateRef`
   (default **`origin/main`**, a *committed* ref) and requiring the **8-char target prefix** inside the
   `## Live release` section. **The register commit must be made on a main-based docs branch and committed and
   pushed before `-Execute`.** Committing inside the release worktree would move its HEAD off the target SHA, fail
   the runner's `Get-GitIdentity`, and destroy the new release's eligibility as a rollback basis — that exact mistake
   stopped a previous attempt. Keep the `26f7c907` and `116a7658` entries in that section, since the rollback run
   needs one of them. This lane writes only the `## Live release` block and its own Lane A section.
9. **Cutover — the repo-owned runner only.** It sets task XML **and** both machine env vars, `taskkill /PID /T /F`
   on the supervisor tree, sleeps 10 s, **asserts** 5001/5174 cleared, then `schtasks /run`, reverting env + XML and
   restarting on any throw. **The dry run is not purely read-only:** `Save-SchtasksXml` (`:270`) and
   `Replace-TaskSourceBytes` (`:271`) write under `C:\ProgramData\ATLAS\release-audit\<sha8>-<timestamp>\` before the
   `-Execute` branch at `:278` — benign, outside the repo, and disclosed as a write. Dry run first, then `-Execute`,
   with identical arguments (§6). **No `-Force`, no glob, no hand-written cutover.**
10. Post-cutover verification: health 200, ready 200 `database:"ok"`, DB-backed read 200, the new chunk fetchable on
    5174 and the incumbent chunk no longer served, the supervisor action **plus both machine env vars** naming the
    new release, and **`git -C <target> status --short` empty again (10b)** — starting the supervisor writes the
    state file, so the cleanliness gate must be repeated.

**Rollback.** The runner's `catch` reverts env + XML and restarts. Outside that try-block it is the **full argument
swap** — changing only the target pair fails closed at `Get-MachineIdentity` (machine env would not match the
declared incumbent) and at `Replace-TaskSourceBytes` (the target XML no longer holds two references to the declared
incumbent): target becomes `26f7c907…` / `E:\ATLAS-runtime-supervised-26f7c907-20260926`, incumbent becomes the new
release. **A10 must be satisfied for the swap to be executable.** Never hand-roll it.

## 5. Acceptance rows

| # | Row | Harness | Expected |
| --- | --- | --- | --- |
| A1 | Release identity: installed HEAD == target; supervisor action **and both machine env vars** name the new release; listeners belong to it | `cli.mjs status` **with explicit env** + `git -C <release> rev-parse HEAD` + machine env | PASS |
| A2 | New-build proof: the new-only chunk is served 200 on 5174 and byte-identical to the on-disk build; the incumbent chunk is not served | HTTP + `Get-FileHash` | PASS |
| A3 | Health 200, ready 200 `database:"ok"`, DB-backed read 200 | HTTP | PASS |
| A4 | **Zero write:** six-table digests identical to step 2's verbatim baseline | SQL digests — **recomputed independently by QA**, not taken from the executor | PASS |
| A5 | The lunch-window rule renders its plain name on **both** operator surfaces and **no** raw code or de-snake-cased token appears for it | **Browser** | PASS |
| A6 | No canonical violation code renders as a raw engine code; the widened guard passes | Committed test + **Browser** spot-check | PASS |
| A7 | No new console errors or failed requests on the timetable workspace, **attributing the two known EnrollPro proxy 502s** (external outage, `dev-jegs.buru-degree.ts.net` TCP 443 dead) rather than waiving them | **Browser** | PASS |
| A8 | Client suite at the release SHA: **13 failures across 9 files**, zero new vs `26f7c907` | `npm run test:client-suite`, compared by failing **test name** | PASS |
| A9 | `typecheck` adds zero errors (baseline exactly 4, all pre-existing `playwright`/implicit-any) | `npm run typecheck` | PASS |
| A10 | **Rollback basis runner-eligible:** `26f7c907` clean at its declared SHA (empty `status --short`), not a reparse point, with `ops/runtime/cli.mjs`, `atlas-server/dist/server.js`, `atlas-client/dist/index.html` present, and its entry retained in `## Live release` | filesystem + `git`, **nothing started** | PASS |
| A11 | Line-cap sweep unchanged: **7** client files over 1000 physical lines (1 `.tsx`) at this revision | own sweep | PASS |
| A12 | `ManualEditPanel` renders as before the extraction — public props, `SearchableSelect` wiring, and the option groups are unchanged | **Browser** | PASS |

**A12 note:** the §8 extraction is source-verified (byte-identical move, 89 lines, comments 36→36) but has **no
render test** because the panel is `lazy()`-imported and untested. A prior review held that a missing render control
is not a permanent waiver; it built a temporary SSR probe for the equivalent change. **A12 closes that gap for
real.**

## 6. Post-action QA owner and authority

**Owner: `atlas-qa` (fresh, independent, read-only), dispatched by the planner after the runner returns.** It closes
every row including A4's zero-write corroboration, which it must **recompute itself**, and returns a real
`passed / total`, `blocked: N`, `unperformed: N` with **no row declared not applicable**. Deployment and acceptance
are **separate outcomes**; a healthy process may be `DEPLOYED` while acceptance is incomplete. Browser rows A5–A7
and A12 run under **Lane A**, using the **Tailnet root origin only** — never an asset URL or `robots.txt`.

**Authority:** `live-state.md:219-222` records a standing authorization for this program covering deployment and
browser acceptance with gates retained; the operator additionally granted HIGH authority in queued instructions on
2026-09-26. The packet's authority surface is a **client-only deployment with no migration, no live-data write, and
no env mutation beyond the runner's own three-part cutover** — narrower than the previous deployment, which is
already live. **Not authorized:** any migration, live-data write, generation, publication, availability write,
term-cache apply, Teaching Load apply, `ATLAS_RUNTIME_LOG_DIR` or any other env mutation, any `ops/runtime/` source
change, or any companion-repository action.

**Literal provenance** for every value in this packet is in the table below; nothing here was asserted without the
command that produced it.

| Literal | Command |
| --- | --- |
| target `5152bff0` | `git rev-parse origin/main` |
| incumbent `26f7c907a37185e036e71cf0d82423794689b318` | `git rev-parse 26f7c907` |
| target is a descendant of the incumbent | `git merge-base --is-ancestor 26f7c907 origin/main` → exit 0 |
| delta 17 paths: 5 production client, 4 test, 9 docs | `git diff --name-only 26f7c907 origin/main` |
| zero server / prisma / vite / package.json / env / ops / lockfile | the same diff with each pathspec |
| `861d89a2` donor 156 / 0.213 GiB client, 209 / 0.368 GiB server, 0 reparse points | `Get-ChildItem -Recurse -File \| Measure-Object Length -Sum`; `(Get-Item).Attributes` |
| `ATLAS_RUNTIME_LOG_DIR` / default `ops/runtime/logs` / `maxBytes 5242880` / `maxFiles 5` | `Get-Content ops/runtime/runtime-contract.json \| ConvertFrom-Json` → `.logs` |
| runner cleanliness gate `:74-75`; dry-run writes `:266,270,271` before `:278`; env sets `:289-290`, reverts `:301-302` | file read |
| `Assert-LiveReleaseRecorded` needs the 8-char target in the Live release section | `deploy-runner.ps1:198-217`, `:178-196` |
| `cli.mjs` resolves the release from **process** scope | `ops/runtime/cli.mjs:16-19` |
| `cli.mjs status` `live:false` false negative | `cli.mjs:81-89` with `supervisor.mjs:401` |
| `REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL']`, only required var | `atlas-client/vite.config.ts:13,23-24` |
| A8 baseline 13 failures / 9 files at `5152bff0` | `npm run test:client-suite`, compared by failing name |
| A9 baseline exactly 4 | `npm run typecheck` |
| A11 base 7 client files over 1000 | own sweep; the committed `R3 component files stay under the 1000 physical line cap` row |
| E: 56.4 GiB | `Get-PSDrive E` |
