# COMPANION-SSO-LIVE-PREP-C02 — executor handoff

Status: `REVIEW_REQUIRED`. This is the executor's single handoff for the
preparation candidate. It is not approval, integration, or a `GO`. The executor
does not self-accept, merge, rebase, push, or plan successors.

**Candidate classification: `PREPARED_WITH_EXTERNAL_GATE`.** All docs-candidate
checks pass; the only unfinished row is row 10's EnrollPro half, carried as an
external **activation** precondition (fail-closed, `EXTERNALLY_BLOCKED(LIVE_TAILNET)`
while the EnrollPro host is offline). This is **not** `ACCEPT_READY` 15/15 and it
claims **no live SSO readiness**.

Governing packet: `docs/prompts/companion-sso-live-prep-c02-2026-09-15.md`.
Full matrices and sanitized evidence:
`docs/handoffs/companion-sso-live-prep-c02-evidence.md`.
Prepared HIGH packets (both **NOT GRANTED**):
`docs/prompts/companion-sso-migration-live-c02-2026-09-15.md`,
`docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`.
Companion developer handoff:
`docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md`.

## 1. Immutable identity

| Item | Value |
| --- | --- |
| Worktree | `E:/ATLAS-worktrees/companion-sso-live-prep-c02` |
| Branch | `work/companion-sso-live-prep-c02` |
| Dispatch base (additive base) | `6409a2a8c2977a7e96db114b1d1a2d84a0d01afb` |
| Prompt-authoring base (packet) | `234046f80effa5b963295bb27f83a90020b4f544` |
| Merge-base with `origin/main` | `234046f80effa5b963295bb27f83a90020b4f544` |
| `origin/main` tip at executor turn | `53a781a4fdb6e254bd1277c47fcef0700e0e769d` (advanced to `0c20342394ca2ca800cecc6dd69825e07625c66d` by correction time) |
| Drift `234046f8..53a781a4` (executor turn) | docs-only (10 files under `docs/plans`, `docs/prompts`, `docs/reviews`); no product-tree change |
| Drift `53a781a4..0c203423` (correction time) | docs-only (2 files: `docs/plans/atlas-active-delivery-streams.generated.md`, `docs/plans/atlas-delivery-cycles.json`; +48/-38) |
| Release-pin delta (corrected) | tip is **not** docs-only above `c989f03d`; see Correction 1 below |
| Required ancestor | `c989f03d67fa246ac8b168a59012a7615458be4f` (COMPANION-SSO-C01 merge) is an ancestor of `origin/main` (exit 0) |
| Commit 1 | `62da5e7b81c3ae6b7307d7db0537cb8f6c32386d` — `docs(sso): record companion SSO live-prep evidence` |
| Commit 2 | `faa2422ea81df91e7a87a3529d6115f47b11bdea` — `docs(sso): prepare companion migration and runtime activation gates` |
| Commit 3 | `61b1de5cbe1e9e305ef5d8d7b0e441dd320ab3ad` — `docs(sso): correct activation release-delta claim` |
| Commit 4 | `b7ffe61cf0223fce9d32b818bb6c9c5277d2ce03` — `docs(sso): gate activation on proxy origin and fix audit findings` |
| Commit 5 (tip) | this correction commit — `docs(sso): record proxy approval, option A, and fresh-signature migration gates`; exact SHA in the executor return |
| Candidate range | `6409a2a8...<tip>` (five additive commits) |
| Directive `origin/main:AGENTS.md` LF-normalized SHA-256 | `5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5` |
| Directive recorded at prompt authoring | `0cf68d62d9c6c6bb37b737c6038118a8eed7efc2d403a2100de9d64f02c871d6` (superseded; newer wins) |

Changed paths (five files; created by commits 1–2 and amended by the correction commits):

1. `docs/handoffs/companion-sso-live-prep-c02-evidence.md`
2. `docs/handoffs/companion-sso-live-prep-c02-executor.md`
3. `docs/prompts/companion-sso-migration-live-c02-2026-09-15.md`
4. `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`
5. `docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md`

No owned-path-5 condition was skipped: EnrollPro defects **were** found, so the
handoff was produced.

## 2. Companion inspection (READ_ONLY)

| Mirror | Inspected SHA | Dirty lines before/after | Action |
| --- | --- | --- | --- |
| `D:/EnrollPro` | `5887d685b834db31600be258e96be3bdd0bccacb` | 0 / 0 | read-only `git grep`/`git show` |
| `D:/AIMS` | `2332d92ef3395ae65e9a067bd8ef6cce1191940c` | 0 / 0 | read-only `git grep`/`git show` |
| `D:/smart-final-capstone` | `1bda23399204414f8d21c9fddbdf6b41a8e440d4` | 0 / 0 | read-only `git grep`; SMART remote `main` at authoring was `065600a6…` (not fetched) |

Inspection notes: EnrollPro production source
(`server/src/features/auth/companion-sso.service.ts`,
`companion-sso-reverse.service.ts`, `companion-sso.controller.ts`,
`auth.router.ts`, `shared/src/schemas/companion-sso.schema.ts`,
`shared/src/constants/index.ts`, `server/prisma/schema.prisma`) is the authority
for the two-flow matrix. Guides and `server/.env.example` are treated as claims;
the examples contain two contradictory ATLAS reverse blocks with wrong paths.
AIMS has a server + client SSO implementation with placeholder config
(`CONFIGURATION_REQUIRED`); SMART has no SSO source (`NOT_IMPLEMENTED`). Two
EnrollPro-owned defects are documented in the companion handoff; neither was
implemented by ATLAS.

## 3. Trace table (requirement → production path → negative control → verification)

| # | Requirement | Production path | Negative control | Verifying command | Result |
| --- | --- | --- | --- | --- | --- |
| T1 | Refreshed Git/directive identity + SSO ancestry | `c989f03d` ancestry; `origin/main:AGENTS.md` | — | `git merge-base --is-ancestor c989f03d origin/main`; LF-normalized SHA-256 | PASS |
| T2 | Complete route/env-reader inventory | `atlas-server/src/app.ts:103`; `auth.router.ts:82,109,150`; `companion-sso.service.ts:113-139`; `companion-config.ts:28-59` | live `POST /api/v1/auth/sso/*` → 404 (routes absent on the deployed release) | `git grep`; live HTTP probes | PASS |
| T3 | EnrollPro contract matrix, every URL classified | EnrollPro `auth.router.ts:59-85`, `companion-sso.service.ts`, `companion-sso-reverse.service.ts`, `shared/src/schemas/companion-sso.schema.ts` | example-vs-source contradiction recorded; real ATLAS/EnrollPro mounts used as authority | `git -C D:/EnrollPro grep/show` | PASS |
| T4 | AIMS/SMART classification, no scope expansion | AIMS `server/src/routes/auth.routes.ts:36-39`; SMART docs-only | ATLAS rows remain disabled (`integrated-systems.ts:41-44`) | `git -C D:/AIMS grep`; `git -C D:/smart-final-capstone grep`; client SSO test | PASS |
| T5 | SSO tests, typechecks, builds, isolated startup | mounted suite + `tsc` + builds + `dist/server.js` | suite runs against a disposable DB, not live; isolated port 5317 | §3 of the evidence doc | PASS |
| T6 | Read-only live migration/table state + before/after signatures | `_prisma_migrations`, `to_regclass`, row counts | before/after delta must be 0 | read-only `psql` queries | PASS |
| T7 | Disposable apply/status/rollback/replay + zero residue | `prisma migrate deploy --schema prisma/schema.prisma`; mounted suite | rollback → clean re-apply; `pg_database` residue count | evidence doc §5.2 | PASS |
| T8 | Secret-safe config presence inventory | `D:\ATLAS-runtime-config\atlas-server.env` key names only | no value printed/hashed/committed | key-name extraction | PASS |
| T9 | Runtime/release/supervisor/rollback inventory, zero mutation | `cli.mjs status`; listener ownership; rollback dirs | sentinel PIDs unchanged across the isolated probe | `cli.mjs status`; `Get-NetTCPConnection`; `git rev-parse` on rollback dirs | PASS |
| T10 | Tailnet-only public preflight, exact origins, two viewports | `https://njgrm.buru-degree.ts.net/login` (1366×768 and 390×844, origin asserted) | **EnrollPro origin offline at capture** | browser origin assertion; HTTP probes; `tailscale status` | **BLOCKED** (ATLAS PASS; EnrollPro `EXTERNALLY_BLOCKED(LIVE_TAILNET)`) |
| T11 | Migration HIGH packet complete + satisfiable | `docs/prompts/companion-sso-migration-live-c02-2026-09-15.md` | fail-closed preflight; no config/deploy/login authority | packet review | PASS |
| T12 | Runtime activation HIGH packet complete, dependency-bound, satisfiable | `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md` | NOT GRANTED; §5 gating preconditions; no AIMS/SMART/MRF bundling | packet review | PASS |
| T13 | Companion defect handoff with exact evidence, no companion edit | `docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md` | `D:/EnrollPro` clean before/after | `git -C D:/EnrollPro status --porcelain` | PASS |
| T14 | Claim classification without current-state/successor contradiction | evidence doc §12 lint | — | manual lint | PASS |
| T15 | `git diff --check`, attribution, no secrets, no unauthorized mutation | candidate diff | live DB + runtime + mirror signatures unchanged | `git diff --check`; `git status --porcelain=v2`; signatures | PASS |

## 4. Fifteen-row tally

| # | Row | Status |
| --- | --- | --- |
| 1 | Refreshed Git/directive identity and source ancestry | PASS |
| 2 | Complete ATLAS production-route and environment-reader inventory | PASS |
| 3 | EnrollPro production-source contract matrix with every URL classified | PASS |
| 4 | AIMS/SMART read-only roadmap classification without scope expansion | PASS |
| 5 | Existing SSO production-path tests, typechecks, builds, isolated startup | PASS |
| 6 | Read-only live migration/table state and before/after zero-write signatures | PASS |
| 7 | Disposable PostgreSQL apply/status/rollback/replay plus zero residue | PASS |
| 8 | Secret-safe configuration presence inventory with zero values disclosed | PASS |
| 9 | Runtime/release/supervisor/rollback inventory with zero mutation | PASS |
| 10 | Tailnet-only public browser preflight, exact origins, two viewports, serialized custody | **BLOCKED** — EnrollPro `dev-jegs` offline at capture |
| 11 | Separate migration HIGH packet complete and satisfiable | PASS |
| 12 | Separate runtime activation HIGH packet complete, dependency-bound, satisfiable | PASS |
| 13 | Companion defect has an ATLAS-owned developer handoff, no companion edit | PASS |
| 14 | Claim classification contains no current-state/successor contradiction | PASS |
| 15 | `git diff --check`, changed-path attribution, no secret-like content, no unauthorized mutation | PASS |

**Tally: 14 / 15 passed / 1 blocked / 0 unperformed.** Row 10's EnrollPro half is
an external live-state condition, captured with evidence and encoded as a
fail-closed precondition in both prepared packets. Candidate classification:
**`PREPARED_WITH_EXTERNAL_GATE`** (external **activation** precondition on that
row; not `ACCEPT_READY` 15/15; no live SSO readiness claimed).

## 5. Decisive command results

| Gate | Command | Result |
| --- | --- | --- |
| Server mounted SSO suite | `npx tsx --test src/__tests__/companion-sso-http.test.ts` (disposable `DATABASE_URL`, `JWT_SECRET` set) | 18 pass / 0 fail |
| Client SSO suite | `npx tsx --test src/lib/__tests__/companion-sso-client.test.ts` | 14 pass / 0 fail |
| Server tsc | `npx tsc --noEmit` (`atlas-server`) | exit 0 |
| Client tsc | `npx tsc --noEmit` (`atlas-client`) | exit 0 |
| Server build | `npm run build` (`atlas-server`) | exit 0 |
| Client build | `npm run build` (`atlas-client`) | exit 0 |
| Isolated startup | `node dist/server.js`, `PORT=5317`, disposable `DATABASE_URL` | `/api/v1/health` 200; port released; 5001/5174 sentinels unchanged |
| Live DB before/after | read-only `psql` | migrations 2→2; `companion_sso_codes` absent→absent; schools 2→2; auth accounts 44→44; audit 242→242; sy_mirrors 2→2; faculty_mirrors 42→42 |
| Disposable rehearsal | create → `prisma migrate deploy` → schema proof → suite → status → replay → rollback → re-apply → drop | all steps exit 0; residue 0 |
| Live SSO route presence | `POST /api/v1/auth/sso/{exchange,authorize}` | 404 (deployed release predates SSO) |
| Tailnet public | `https://njgrm.buru-degree.ts.net/` and `/login` | 200 |
| Tailnet EnrollPro | `https://dev-jegs.buru-degree.ts.net/personnel/login` | timeout / connection refused (peer offline) |

Disposable databases used and dropped this turn:
`atlas_restore_drill_20260915_sso026821` (full rehearsal) and
`atlas_restore_drill_20260915_sso02c086` (isolated startup probe). Both are
asserted different from the configured database name; residue count 0 for the
`atlas_restore_drill_20260915_sso02%` namespace.

## 6. Zero-mutation statement

- No live/shared database migration, schema mutation, seed, reset, or data
  write. `0002_companion_sso_code` remains **unapplied** on the live database.
- No login, SSO launch, authorization-code issue/exchange/consume, or session
  creation in ATLAS or any companion.
- No secret value displayed, hashed, copied, logged, or written to the
  repository. Configuration keys are reported by name and PRESENT/ABSENT only.
- No companion-repository edit, fetch, fast-forward, install, migration, seed,
  snapshot, or history rewrite.
- No shared-runtime stop/start/restart, Windows task or environment edit, port
  ownership change, or Tailscale change. Ports 5001/5174 kept their incumbent
  PIDs (19792 / 19000) across the isolated probe.
- No localhost browser evidence (localhost use was an isolated non-browser test
  harness only).
- No `CHANGELOG.md`, runtime source-of-truth map, `docs/plans/*`, `docs/reviews/*`,
  product source, or test edit. No other path was modified.
- No merge, rebase, reset, amend, squash, other-worktree cleanup, or push.

## 7. Risks

| ID | Risk | Class |
| --- | --- | --- |
| R1 | Flow B reverse assertion role/name contract mismatch (`faculty`/`officer` vs uppercase `RoleEnum`) makes ATLAS→EnrollPro SSO fail with 502 even after migration + config | **BLOCKING** for live SSO acceptance; remedy documented in the companion handoff; activation packet gates on it |
| R2 | EnrollPro `.env.example` reverse URLs/`client_id` contradictory and wrong | **BLOCKING** for a correct-configuration claim; activation packet binds the verified matrix |
| R3 | `ENROLLPRO_BASE_URL` / `ENROLLPRO_SSO_*` / `ATLAS_SSO_REVERSE_*` absent; `ENROLLPRO_API` is a raw Tailnet IP with `/api` | **BLOCKING** for activation; bound as explicit PRESENT-gate preconditions |
| R4 | EnrollPro `dev-jegs` offline at capture → blocks the EnrollPro half of the preflight and every live SSO acceptance row | **BLOCKING** for activation acceptance; fail-closed preflight required |
| R5 | Deployed runtime predates SSO (404 on `/api/v1/auth/sso/*`) | **BLOCKING** for live SSO; owned by the activation packet |
| R6 | `schtasks /query` denied to the non-elevated executor; the boot task definition could not be re-read this turn | NON_BLOCKING for preparation; mandatory elevated precondition for the HIGH action |
| R7 | `atlas-server/.env.example` documents none of the four SSO keys | NON_BLOCKING documentation gap (companion handoff D3) |
| R8 | Playwright browser build `chromium-1244` was missing and was installed out-of-repo | NON_BLOCKING; resolved |
| R9 | EnrollPro Flow A requires a companion identifier but ATLAS maps accounts only by `employeeId`/`accountName` (ignores `lrn`) | NON_BLOCKING (learners excluded by the role allowlist) |

## 8. Not executed (explicit list)

- Live migration apply, configuration write, secret creation, release install,
  supervisor restart, and every authenticated/live SSO acceptance row.
- The EnrollPro half of the public browser preflight (peer offline).
- Any AIMS/SMART/MRF activation or ATLAS-row enablement.
- Any product-source or test change (the R1 correction belongs to a successor
  packet with its own authority).

## 9. Correction 1 (planner review)

| Field | Detail |
| --- | --- |
| Defect 1 (MATERIAL) | The activation packet §2 claimed "the commits above `c989f03d` to this tip are docs-only". False. |
| Fix | `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md` §2 now states the measured truth (tip is not docs-only; the only docs-only drift is the branch base `234046f8..53a781a4`, with `53a781a4..0c203423` also docs-only), records both exact shortstats and their top-level non-docs scopes, and states plainly that installing the re-pinned tip deploys the entire integrated main product tree since the incumbent pin `d44f29e0`, not SSO alone. §5 gained precondition 6 (full-delta review + operator acknowledgment; `PRECONDITION_RELEASE_DELTA_UNRECORDED` stop). §8 row 1 now requires the recorded deltas as release-identity evidence. §10 approval sentence records the delta requirement without widening authority. §11 requires both delta records in the return. |
| Defect 2 (MINOR) | The evidence doc §3 described the isolated `node_modules` trees as pre-existing from "earlier the same day". |
| Fix | §3 now gives the truthful provenance (created during this preparation cycle's execution turn on 2026-09-15: root 11:12:57, `atlas-server` 11:10:21, `atlas-client` 11:11:01 +08) and records the recomputed lockfile SHA-256 values. |
| Evidence corpus sync | The evidence doc §6.4 gained a compact "Correction 1" delta row so the evidence matches the corrected packet. |
| Verification | `git diff --shortstat c989f03d 0c203423` = 299 files, 40938+/3034-; non-docs 230 files. `git diff --shortstat d44f29e0 0c203423 -- . ":(exclude)docs"` = 270 files, 39367+/2863-. `git diff --shortstat d44f29e0 0c203423` = 366 files, 54059+/2938-. `git diff --shortstat 53a781a4 0c203423` = 2 files, 48+/38- (docs-only). Lockfile SHA-256 recomputed and matched: `ecf06aef…b6e5`, `ce1ae84e…9f1e`. Docs-only; `git diff --check` exit 0; worktree clean. |

## 10. Correction 2 (completion audit)

| Finding | Detail | Fix | Verification |
| --- | --- | --- | --- |
| F1 (BLOCKING, safety gate) | The activation packet did not account for the re-pinned release's supervised launch gate, which requires `ENROLLPRO_PROXY_ORIGIN`. | Activation packet §4 gained an `ENROLLPRO_PROXY_ORIGIN` row (bare origin `https://dev-jegs.buru-degree.ts.net`, owned by `ENROLLPRO-PROXY-RECOVERY-LIVE`, not written by this packet) plus an explanatory paragraph; §5 gained precondition 7 (`PRECONDITION_PROXY_ORIGIN_MISSING`); §6.2 scopes the "no other key" rule to the four SSO keys this packet writes and requires `ENROLLPRO_PROXY_ORIGIN`/`ENROLLPRO_API` to remain intact; §6.6 references the gate and forbids bypassing `ENROLLPRO_PROXY_ORIGIN_MISSING`; §8 rows 1/2/4 require the recorded presence check, spawned children with no `ENROLLPRO_PROXY_ORIGIN_MISSING`, and the 401-not-404 mounted-route proof on the new release; §10 approval sentence adds the precondition without authorizing the key write; §11 requires the presence check in the return. | `ops/runtime/cli.mjs:36-39` `assertLaunchEnrollProOrigin`, called at `:46` (`runStart`) and `:97` (`runRollback`); `stop`/`status` exempt (`:33-34`). `ops/runtime/lib/enrollpro-origin.mjs:96-104` (`requireExplicit` → `ENROLLPRO_PROXY_ORIGIN_MISSING`). `ops/runtime/runtime-contract.json` → `upstream.enrollProOriginVariable = ENROLLPRO_PROXY_ORIGIN`. Incumbent `D:\ATLAS-runtime-supervised-3d916b26-20260912\ops\runtime\cli.mjs` has **no** gate/origin references (file read directly; the directory is not a safe git dir for this user). `ENROLLPRO_PROXY_ORIGIN` **ABSENT**, `ENROLLPRO_API` **PRESENT** in `D:\ATLAS-runtime-config\atlas-server.env`. Owner packet `origin/main:docs/prompts/enrollpro-proxy-recovery-live-2026-09-14.md:119,127,167-168` sets exactly the bare origin and warns never to bypass the missing-code. **Proxy-lane status (verified against `origin/main` `docs/plans/atlas-delivery-cycles.json` at `0c203423`):** approval **GRANTED** (2026-09-15T12:00:04+08, `operator:njgrm`, stream state `EXTERNALLY_BLOCKED`); execution **pending** (EnrollPro host offline, `obs-enrollpro-reachability` FAIL), so `ENROLLPRO_PROXY_ORIGIN` is **not yet proven installed**. |
| F2 (NON_BLOCKING) | Wrong `runStatus` citation `ops/runtime/cli.mjs:63-72`. | Corrected to `:81-91` in activation §3 and evidence §6.3. | Verified directly: `runStatus` block is lines 81–91. |
| F3 (NON_BLOCKING) | Wrong `getStatus`/`live` citation `supervisor.mjs:371-401` / `:397`. | Corrected to `getStatus()` at `:375` and the `live:` computation at `:401` in activation §3 and evidence §6.3. | Verified directly: `getStatus() {` at line 375; `live: liveChildren[...]` at line 401. |
| F4 (NON_BLOCKING) | The governing packet's authoring-time directive pin `0cf68d62…` is unreproducible. | Added a parenthetical recovery note at the pin (original value not rewritten): audit could not reproduce it under LF/raw/UTF-16LE/UTF-8-BOM/the packet base `234046f8`; the execution authority is `5f920670…`. | Planner-authorized edit (the governing packet is normally untouched); the `5f920670…` value was independently re-verified in R1. |
| F5 (NON_BLOCKING) | Evidence §1 tagged `origin/main 53a781a4` as `CURRENT_STATE`. | Re-tagged `HISTORICAL` with the supersession note (capture-boundary observation superseded by correction-time tip `0c203423`; see §6.4 Correction 1). | Tag legend is defined in evidence §0. |
| F6 (NON_BLOCKING) | The governing packet's Workflow-state verification of `docs/plans/atlas-delivery-cycles.json` was not recorded. | Added evidence §6.5 with the read-only observed values and the intentional-unregistered rationale. | `coordination.mode = MANUAL`, `activeCycleId = null`, `leases` empty, `browserCustody` custody/logins empty, 6 `streams` with no `COMPANION-SSO-LIVE-PREP-C02` entry. |

## 11. Correction 3 (head-planner pre-integration correction)

| Correction | Fix | Verification |
| --- | --- | --- |
| 1+2 — proxy-recovery approval-status truth (four-way distinction) | Activation §4 explanatory paragraph rewritten: owner packet's approval is **GRANTED** (machine-state `docs/plans/atlas-delivery-cycles.json` at `origin/main` `0c203423`: `approval.granted = true`, `operator:njgrm`, `approvedAt 2026-09-15T12:00:04+08:00`, stream state `EXTERNALLY_BLOCKED`), execution **NOT PERFORMED** (EnrollPro host offline, `obs-enrollpro-reachability` FAIL), so `ENROLLPRO_PROXY_ORIGIN` is **not yet proven installed**; §4 table row aligned; §5.7 adds the status and keeps the hard STOP; §10 sentence clause changed to "approval GRANTED 2026-09-15; execution pending on EnrollPro host recovery"; the F1 row above gained the same one-line status. | Read `origin/main:docs/plans/atlas-delivery-cycles.json` (not the stale worktree copy): `granted=true`, `operatorIdentity=operator:njgrm`, `approvedAt=2026-09-15T12:00:04+08:00`, `presentedReady=false`, `state=EXTERNALLY_BLOCKED`, `execution=null`; `coordination.mode=CYCLE_ACTIVE`, `activeCycleId=ENROLLPRO-PROXY-RECOVERY-LIVE`; observation `obs-enrollpro-reachability` status `FAIL`. `tailscale status`: `dev-jegs` (100.120.169.123) offline, last seen 1 h before this correction. `ENROLLPRO_PROXY_ORIGIN` remains **ABSENT** in the durable env. |
| 3 — migration packet: historical snapshot, fresh signatures, fail-closed deltas | §3 relabelled "HISTORICAL CONTEXT ONLY … not an execution-time invariant or pass condition"; §5.6 now requires a fresh pre-action signature block (migrations count/rows, `to_regclass`, row counts incl. role distribution); §7.4 replaced with an exact comparison against the §5.6 block permitting only the one new migration row and `companion_sso_codes` (zero rows), every other delta fail-closed → STOP + §8 rollback; §8.3 rollback verification now compares to the fresh §5.6 state rather than a hard-coded count; §9 approval sentence replaced the stale-number clause; the execution-record section (§10, the packet's only execution-record section) requires the fresh block and the delta comparison. | §5.1/§5.2 identity/state checks kept (database name, `0002` ABSENT, prior migrations finished) as preflight facts; §3 numbers retained as historical facts only. **Note for the planner:** the correction brief called the execution-record section "§11"; the migration packet has 10 sections, so the edit landed on §10 "Execution record required" (its only execution-record section). |
| 4 — R1 uses Option A | Companion handoff D1 gained a "Decision (head planner, 2026-09-15): Option A selected" block (Option B not required for D1; D2 stays EnrollPro-owned; the D1 acceptance matrix stays mandatory for the correction stream; this worktree implements nothing). Activation §5.2 records the decision and keeps Flow B fail-closed with `PRECONDITION_ROLE_CONTRACT_UNRESOLVED` until the correction is complete, QA'd, integrated, and re-pinned/bound. Evidence §4.5 gained a recorded-decision row tagged `REQUIREMENT`. | Cross-read of the three files; the gate code/behaviour is unchanged (docs-only). |
| 5 — candidate classification | Executor handoff and evidence doc top status now carry **`PREPARED_WITH_EXTERNAL_GATE`** with the one-line definition, and both 15-row tally statements carry the same classification next to the honest `14/15 passed / 1 blocked` figure. | `grep` shows the classification at both tops and both tally statements, paired with "not `ACCEPT_READY` 15/15" and "no live SSO readiness". |

## 12. Approval sentences (NOT GRANTED)

- `COMPANION-SSO-MIGRATION-LIVE-C02` — exact sentence in section 9 of
  `docs/prompts/companion-sso-migration-live-c02-2026-09-15.md`; **NOT GRANTED**.
- `COMPANION-SSO-RUNTIME-ACTIVATION-C02` — exact sentence in section 10 of
  `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`; **NOT
  GRANTED**.

## 13. Return contract

`REVIEW_REQUIRED`. Control returns to the primary planner for immutable-range
validation and a fresh independent QA pass. The executor does not integrate,
push, or plan successors.
