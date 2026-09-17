# CONSOLIDATED-DEPLOYMENT-C10 — cutover execution evidence (resumed, steps 4–6)

- **Role:** `ROLE: EXECUTOR` (fresh context; one HIGH shared-runtime deployment under the already-granted operator approval).
- **Outcome:** `REVIEW_REQUIRED` — cutover **executed**; the new release is live and healthy; rows 1–8, 10–13 **PASS**; row 9 **BLOCKED/NOT PERFORMED** by an executor evidence-sequencing defect (see §6 and §12). No rollback was executed; the decision is returned to the planner.
- **Cutover executed:** **YES** — supervisor-owned 5001/5174 stopped, task re-pointed to the staged release, task restarted, new release live.
- **Zero-mutation statement:** outside the declared login delta, all 46 public tables are delta 0; the durable env file, its ACL, and the git `safe.directory` configuration are unchanged. Companion repositories were read-only and untouched.

---

## 1. Immutable identity

| Item | Value |
|---|---|
| Target pin (`PIN40`) | `8eb0511baa537d4212f24a007ac40e2dded38c0e` |
| Governing packet | `docs/prompts/consolidated-deployment-c10-2026-09-17.md` |
| Packet blob | `7c650dcb54c28875467a34703a8cc6012ba4f0a9` (assigned identity) |
| Packet LF-SHA-256 | `ec7817fc8f8d9aaaed13edd7e00ee80b61ef39981a735ef00afd33110095b1a5` (assigned identity) |
| Base SHA | `8eb0511baa537d4212f24a007ac40e2dded38c0e` (`PIN40`; ancestor of the branch tip, `merge-base --is-ancestor` exit 0) |
| Worktree / branch | `E:/ATLAS-worktrees/consolidated-deploy-c10` @ `9783c635` on `chore/consolidated-deploy-c10`; clean (`--porcelain=v2` empty) before and after |
| Install directory | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| Approved boundary | **drop variant** in force (the four companion-SSO keys are **not** part of this approval); row 5 scored against the 13-key set |
| Register | revision 333, stream `CONSOLIDATED-DEPLOYMENT-C10`, approval granted (`operator:njgrm`, 2026-09-17T14:39:44.685Z), `execution: null` (not edited by this executor) |

---

## 2. Pre-stop pin gate (packet prerequisite — satisfied, not modified)

Command and output (re-run immediately before any listener change):

```
git -C D:\ATLAS-runtime-supervised-8eb0511baa53-20260917 rev-parse HEAD
-> 8eb0511baa537d4212f24a007ac40e2dded38c0e
   exit 0
```

Verified `safe.directory` precondition (read-only; **no config entry was added or changed**):

```
git config --global --get-all safe.directory
-> E:/ATLAS-worktrees/*
   D:/ATLAS-runtime-supervised-54dce67b-20260914
   D:/ATLAS-runtime-supervised-8eb0511baa53-20260917
```

Session elevated (`IsInRole(Administrator) = True`). Because the gate returned `PIN40`, the incumbent was stopped.

Staged release contents re-verified present: `atlas-server/dist/server.js`, `atlas-client/dist/index.html`, `ops/runtime/cli.mjs`, and a real `.git`.

---

## 3. Step 4 — stop of the supervisor-owned tree

| Stage | Action | Result |
|---|---|---|
| 4a | `node ops/runtime/cli.mjs stop` from `D:\ATLAS-runtime-supervised-54dce67b-20260914` | exit 0; `state: stopped`; targets `pid: null` |
| 4b | ≥10 s settle, then listener check | the resident supervisor had restarted its children: 5001→20668, 5174→55160, both parented to supervisor 4020 |
| 4c | `taskkill /PID 4020 /T /F` (supervisor-owned tree only) | exit 0; terminated 4020, 20668, 55160 and their own children (51696, 42988, 10008) |
| 4d | 10 s settle, re-verify | 5001/5174 **free**; no `54dce67b` node process remained; task status `Ready` |

Port 5175, Tailscale Serve, all non-supervisor PIDs, and unrelated PIDs 25648/12692/43816 were never touched.

---

## 4. Step 5 — re-point and start

### 4.1 Task before/after diff (mechanism: `Set-ScheduledTask -Action`)

Only two XML lines changed; every other registration property is byte-identical.

| XML element | Before | After |
|---|---|---|
| `<Arguments>` | `"D:\ATLAS-runtime-supervised-54dce67b-20260914\ops\runtime\cli.mjs" start` | `"D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\ops\runtime\cli.mjs" start` |
| `<WorkingDirectory>` | `D:\ATLAS-runtime-supervised-54dce67b-20260914` | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| `<Command>` | `C:\Program Files\nodejs\node.exe` | unchanged |
| `<Principal>` | `S-1-5-18` (SYSTEM), `HighestAvailable` | unchanged |
| `<Triggers>` | `<BootTrigger />` (no `<Delay>`) | unchanged |
| `<Settings>` | `ExecutionTimeLimit PT0S`, `MultipleInstancesPolicy IgnoreNew`, `StartWhenAvailable true`, `DisallowStartIfOnBatteries false`, `StopIfGoingOnBatteries false`, IdleSettings, `UseUnifiedSchedulingEngine true` | unchanged |
| `<RegistrationInfo>` | description + URI `\ATLAS-Runtime-Supervisor` | unchanged |
| Enabled state | enabled (no `<Enabled>false</Enabled>`) | unchanged |

`Compare-Object` on the before/after XML produced exactly those two changed lines and nothing else.

### 4.2 Machine-scope variables (not durable-env keys)

| Variable (Machine scope) | Before | After |
|---|---|---|
| `ATLAS_RUNTIME_SOURCE_DIR` | `D:\ATLAS-runtime-supervised-54dce67b-20260914` | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| `ATLAS_RUNTIME_RELEASE_SHA` | `54dce67b8392cbce09aa810813c37f9c87a67159` | `8eb0511baa537d4212f24a007ac40e2dded38c0e` |

`ATLAS_RUNTIME_ENV_FILE` was **not** changed (`D:\ATLAS-runtime-config\atlas-server.env`, read-only confirmation only).

### 4.3 Start

`schtasks /run /tn "\ATLAS-Runtime-Supervisor"` → `SUCCESS` (exit 0). The runtime was **not** launched from the executor shell.

---

## 5. PID / listener / health before and after

| Item | Before | After |
|---|---|---|
| Task | `\ATLAS-Runtime-Supervisor` Running, Enabled, SYSTEM, ONSTART, `PT0S`, `IgnoreNew`, action/Start-In `…\54dce67b…` | Running, Enabled, SYSTEM, ONSTART, `PT0S`, `IgnoreNew`, action/Start-In `…\8eb0511baa53…` |
| Supervisor | PID 4020, parent 3456 | PID 54804, parent 3456 (`svchost.exe -k netsvcs -p -s Schedule` = Task Scheduler) |
| Listener 5001 | PID 13244 (`…\54dce67b…\atlas-server\dist\server.js`) | PID 18348 (`…\8eb0511baa53…\atlas-server\dist\server.js`) |
| Listener 5174 | PID 13260 (`…\54dce67b…\ops\runtime\host.mjs`) | PID 48244 (`…\8eb0511baa53…\ops\runtime\host.mjs`) |
| Owners per port | exactly one | exactly one |
| Local health | 200 | 200 `{"status":"ok","service":"atlas"}` |
| Local ready | 200 `database: ok` | 200 `{"status":"ready","service":"atlas","checks":{"database":"ok"}}` |
| Host live | 200 | 200 |
| Host ready (artifact) | `…\54dce67b…\atlas-client\dist` | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\atlas-client\dist`, `upstream: ready` |
| Tailnet health | 200 | 200 |

### 5.1 §4.1 launch-ownership and survivorship proof

- `launchOwner` = registered task `\ATLAS-Runtime-Supervisor` (SYSTEM, ONSTART, `PT0S`, `IgnoreNew`), not the executor shell.
- `launchMechanism` = task action re-point + machine variables + `schtasks /run` (§4).
- The live supervisor **54804** is parented to **3456 = Task Scheduler** (`svchost … -s Schedule`), not to any executor process.
- **Survivorship:** every shell that invoked `schtasks /run` and every subsequent evidence command has since exited. At the final check the same PIDs (54804 → 18348, 48244) were still live, each port still had exactly one owner, task `Status: Running` / `Last Result: 267009` (`0x41301` = currently running), and local + Tailnet health remained 200. No executor-started process owns the runtime.

---

## 6. Acceptance matrix (§5) — 12 PASS, 1 BLOCKED

| # | Row | Status | Evidence |
|---|---|---|---|
| 1 | Release identity | **PASS** | `cli.mjs status` (fresh-env, see §11 method note): `releaseSha 8eb0511baa537d4212f24a007ac40e2dded38c0e`, `sourceDir D:\ATLAS-runtime-supervised-8eb0511baa53-20260917`, state `running`, `restartFailures 0`; staged state file `ownedPids {server:18348, client:48244}`; installed HEAD = `PIN40`; scored on `releaseSha`/`sourceDir`/HEAD, **not** on the known-stale `live` flags |
| 2 | Listeners + §4.1 survivorship | **PASS** | §5 / §5.1: exactly one owner per port under task-launched supervisor 54804, healthy after all invoking shells exited |
| 3 | Health | **PASS** | §5: local health/ready (`database: ok`), host live/ready, Tailnet health all 200 |
| 4 | Rollover automation | **PASS** | Contract `ops/runtime/runtime-contract.json` `invariants.ROLLOVER_AUTO_SYNC_ENABLED = "false"`; `validateContract` accepts only literal `"true"`/`"false"` and hard-pins `ATLAS_SUPERVISED="true"` (`ops/runtime/lib/contract.mjs:59-69`); live `cli status` reports `{ATLAS_SUPERVISED:"true", ROLLOVER_AUTO_SYNC_ENABLED:"false"}` |
| 5 | Env change | **PASS** | `D:\ATLAS-runtime-config\atlas-server.env` SHA-256 `21AB1FAD1F0B778186F571AFFF300E64CE8F2575CD29B26FC0822D10C50BB334`, 2334 bytes, **13 keys**; `ATLAS_DEFAULT_SCHOOL_ID` **absent**; **zero** `SSO`/`COMPANION` keys; all 13 expected names present (`ATLAS_AUTH_DISABLE_RATE_LIMIT`, `ATLAS_SYSTEM_TOKEN`, `CLIENT_URL`, `CORS_EXTRA_ORIGINS`, `DATABASE_URL`, `ENROLLPRO_API`, `ENROLLPRO_CLIENT_URL`, `ENROLLPRO_PROXY_ORIGIN`, `ENROLLPRO_SERVICE_TOKEN`, `FACULTY_ADAPTER`, `JWT_SECRET`, `PORT`, `SECTION_SOURCE_MODE`); ACL/`AreAccessRulesProtected` unchanged; **verified only, never modified** |
| 6 | Anonymous class-template read | **PASS** | `GET /api/v1/class-templates` → **401** `{"code":"NO_TOKEN"}`; `GET /api/v1/class-templates/1` → **401** `{"code":"NO_TOKEN"}`; `class_templates` row count 4 → 4 (**delta 0**); probed only after row 1 confirmed the pin live |
| 7 | False authority blocker removed | **PASS** | Authenticated (privileged) `GET /api/v1/generation/1/9/readiness/diagnostic` → HTTP 200; **`TERM_AUTHORITY_STALE` occurrences = 0**; 31 returned blockers, codes exactly `CANONICAL_TEMPLATE_INCOMPLETE` (8), `CANONICAL_SHAPE_CAPACITY_EXCEEDED` (16), `FLAG_CEREMONY_SCOPE_INVALID` (8). No returned blocker is a term-authority blocker. `CANONICAL_TEMPLATE_INCOMPLETE` is the **expected** post-cutover fail-closed state per §5.1 (stale `classProgramSlot` grid) |
| 8 | Published-revision immutability | **PASS (honest observable)** | Public `GET /api/v1/schools/1/schedules/published` → **404** `{"code":"CURRENT_PUBLISHED_RUN_NOT_FOUND","message":"No published schedule is available for the current school year (9) yet."}` with **zero schedule entries**. **Recorded limitation:** this state does **not** exercise the frozen-revision path positively, and the published-run term resolver still falls back to live term authority at `published-schedule.service.ts:892` (unreachable only because no published run exists). No positive immutability proof is claimed |
| 9 | Actor scope (`/api/v1/runtime/context` matrix) | **BLOCKED — NOT PERFORMED** | **Executor sequencing defect:** the single authorized session token was used for row 7 in one shell and not retained; the shell exited, discarding it. A second login is **not authorized** by the approval (the named delta is exactly one `LOCAL_LOGIN_SUCCESS`), so the row was deliberately left unperformed rather than substituting a system token (which bypasses the actor-school check at `runtime.router.ts:81-95` and cannot prove the row). See §12 |
| 10 | Login footprint | **PASS** | **Exactly one** new `audit_logs` row: id **800**, action `LOCAL_LOGIN_SUCCESS`, `school_id` 1, `actor_id` 46, `target_ids [46]`, `createdAt 2026-09-17T16:00:46.961Z`; login response `user.userId = 46`, `role = officer`, `authSource = local`. **Actor 46 `atlas_auth_accounts` write:** `last_login_at` `2026-09-17T08:02:53.582Z` → `2026-09-17T16:00:46.356Z`; engine-managed `updated_at` `2026-09-17T08:02:54.171Z` → `2026-09-17T16:00:46.954Z`; `faculty_id` null, `failed_login_count` 0, `locked_until` null (already at target values, unchanged); `role`/`school_id`/`is_active`/`created_at` unchanged. No failed-login row. This is the complete §5.3 delta |
| 11 | Session cleanup | **PASS** | `GET /api/v1/auth/me` without a token → **401** `{"code":"NO_TOKEN"}`. No server-side logout/revoke endpoint exists at the pin (source search: none), so cleanup is client-side session discard; the token was held only in the transient shell process, was never written to disk/env/logs, and is gone. Custody owner: this executor session |
| 12 | Rollback startable | **PASS** | Primary rollback `D:\ATLAS-runtime-supervised-54dce67b-20260914` (`54dce67b`) was proven startable in this action's step 2 on alternate ports 15004/15176 (server health 200, ready `database: ok`, host live 200, zero module errors); it also served 5001/5174 as the live incumbent until this cutover. Not executed (rows 2–4 passed). Secondary `9d293879` remains withdrawn as unstartable |
| 13 | Zero data mutation | **PASS** | Full 46-table census, before vs after: table set identical (`missing []`, `added []`); **only `audit_logs` 248 → 249** (the single row-10 login), which is inside the declared §5.3 delta. `atlas_auth_accounts` count 44 → 44; `class_templates` 4 → 4; `published_schedule_revisions` 0 → 0; `_prisma_migrations` 4 → 4; every other table delta 0 |

**Tally: 12 PASS / 0 FAIL / 1 BLOCKED.** The matrix is not complete, so `ACCEPT_READY` is not claimed.

### 6.1 Truthful `CANONICAL_TEMPLATE_INCOMPLETE` statement (§5.1)

Immediately after this cutover the live catalog expects the corrected `classProgramSlot` grid while the database still holds the retired grid (`G9G10-FLAG-SOURCE-LANE` is in the deployed code; `DATA-CORRECTION-C01` has not reseeded). Canonical generation therefore fails closed with `CANONICAL_TEMPLATE_INCOMPLETE` until the reseed. This deployment is **not** a generation-readiness pass, and no generation was attempted.

---

## 7. Durable-env verification record (rows 5, and the W7 term-authority precondition)

- Key-name set (names only, values never read/printed): the 13 names in row 5.
- File SHA-256 `21AB1FAD1F0B778186F571AFFF300E64CE8F2575CD29B26FC0822D10C50BB334`, 2334 bytes, unchanged before and after.
- ACL SDDL unchanged and still inheritance-protected read-only: `O:BAG:S-1-5-21-1398962778-519386765-65508979-1001D:PAI(A;;FR;;;SY)(A;;FR;;;BA)(A;;FR;;;S-1-5-21-1398962778-519386765-65508979-1001)`, `AreAccessRulesProtected = True`.
- **W7 term-authority capture (row 7 precondition):** `enrollpro_school_year_mirrors` id **223**, school 1, `enrollpro_school_year_id` 9, `year_label` `2030-2031`, `is_active true`, `is_archived false`, `term_contract_cache` **populated** (`TRIMESTER`, T1/T2/T3), `term_contract_cached_at 2026-09-16T03:59:21.236Z`; exactly one active non-archived mirror for school 1. Present before and after (no delta).

---

## 8. Rollback status

**Not executed.** Rows 2–4 passed and the release came up healthy, so the rollback condition (a failed mandatory row or an unhealthy start) was not met on those grounds. Row 9 is unperformed rather than failed, and the rollback pre-authorization is conditioned on a mandatory acceptance row **failing**; this executor did not unilaterally cross that HIGH boundary. The primary rollback target `54dce67b` is proven startable (row 12). The secondary `9d293879` tier stays **withdrawn** as unstartable. The rollback decision for the row-9 gap is returned to the planner/operator (§12).

---

## 9. Zero-mutation / zero-residue

| Signature | Before | After | Delta |
|---|---|---|---|
| 46 public tables | set as captured | identical set | 0 (only `audit_logs` +1, inside §5.3) |
| `audit_logs` high-water / total | 799 / 248 | 800 / 249 | +1 row (id 800, `LOCAL_LOGIN_SUCCESS`, actor 46) |
| `atlas_auth_accounts` id 46 | §1 baseline | §6 row 10 | only the declared login write |
| Durable env SHA-256 / keys | `21ab1fad…` / 13 | identical | 0 |
| Env ACL SDDL / protected | `…(A;;FR;;;SY)(A;;FR;;;BA)(A;;FR;;;S-1-5-21-…1001)` / True | identical | 0 |
| Task action / Start-In / machine vars | `…\54dce67b…` | `…\8eb0511baa53…` | intended cutover delta only |
| git global `safe.directory` | 3 entries | identical | 0 |
| Supervisor / listeners | 4020 → 13244, 13260 | 54804 → 18348, 48244 | intended cutover delta only |
| Unrelated PIDs 25648 / 12692 / 43816 | alive | alive | 0 |
| Port 5175 / Tailscale Serve | untouched | untouched | 0 |
| Disk | D: 29.77 GiB free | D: 29.77 GiB free | above the 25 GiB warn and 15 GiB fail-closed floors |

No data mutation, generation, publication, Teaching Load apply, term-cache apply, rollover, migration, or companion edit occurred. No secret was printed, logged, or committed.

---

## 10. Packet-accuracy notes found during this execution (all NON_BLOCKING)

- **W1** §1's motivation list wrongly includes `TT-WARNING-AUTHORITY-C04`, which the incumbent already contained.
- **W2** §5.1's illustrative row list omits rows 4 and 7.
- **W3** Row 4 should cite the supervisor contract invariants (`runtime-contract.json` + `validateContract`), not only a status field.
- **W4** §2.7's DB-side `_prisma_migrations` checksum claim is not read-only verifiable from the executor context and is inert here (no migration command ran; `_prisma_migrations` stayed at 4).
- **W5** §5.3's “exactly two writes” is scoped to a **successful** login; a failed attempt adds its own account update and `LOCAL_LOGIN_FAILED` row.
- **W6** The drop variant needs only the pin substitution (no provisioning path).
- **W7** Row 7 depends on the persisted term authority still being present; it was captured (§7).
- **W8 (new)** §5 row 11's “logout” has no server endpoint at the pin (no `logout`/`revoke` source exists); the row is only satisfiable as client-side token discard plus a no-token 401, and should say so.
- **W9 (new)** §5.2's row-9 matrix is unsatisfiable if the executor's single login token is not retained across separate process invocations; the packet should require the authenticated rows to run inside one session context, or explicitly assign row 9 to the QA login budget.

---

## 11. Method note (reproducibility)

`node ops/runtime/cli.mjs status` resolves its source from `ATLAS_RUNTIME_SOURCE_DIR` in the **invoking process env**. A shell opened before the machine-variable update still sees the old value and reports the old release/state; row 1 was therefore read with `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` set to their **new Machine values** for the probe process (no persistent change). The first `status` invocation (stale process env) is discarded as non-evidence, exactly as the packet discards the stale `live` flags.

---

## 12. Divergence / STOP statement (row 9)

The single authorized login was consumed **once** (row 10 confirms exactly one `LOCAL_LOGIN_SUCCESS`) and was used for row 7. Because it was not retained after that shell exited, rows 9 and 11 could not all share it. **Row 9 was not performed.** A second login was **not** attempted: it is outside the approval's named delta and would have made row 10's “exactly one `LOCAL_LOGIN_SUCCESS`” false and violated row 13.

Per “if a mandatory precondition diverges, STOP and report rather than substituting a workaround”, the executor stopped at this gap and did not roll back or re-login. The **recommended remedy** is resolution inside already-granted authority: the fresh post-action independent acceptance review is explicitly authorized to perform its own disclosed logins after this matrix and is the correct role to execute the row-9 `/api/v1/runtime/context` matrix (positive actor-school-1 200; missing/empty/malformed `schoolId` → 400 `INVALID_PARAM`; cross-school → 403 `CROSS_SCHOOL_DENIED`; no token → 401 `NO_TOKEN`). If the operator instead requires rollback on the unperformed row, that is a separate planner/operator decision.

---

## 13. Worktree disposition and roles

| Artifact | Disposition |
|---|---|
| `E:/ATLAS-worktrees/consolidated-deploy-c10` | `RETIRE_AFTER_INTEGRATION` (packet §0); clean before and after |
| `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` | **Live deployed release**; retained for rollback/forward history |
| `D:\ATLAS-runtime-supervised-54dce67b-20260914` | Primary rollback tier, retained |

- Changed paths in this candidate: this file only (docs-only candidate).
- Push status: **not pushed** (executor does not push).
- Running/awaited: the fresh post-action independent acceptance review and the fresh Wave Completion Auditor.
- Single next action: complete the row-9 authenticated matrix under the QA login authority, or return an explicit rollback/keep decision on the unperformed row.
- Locked successors (unchanged): `DATA-CORRECTION-C01` reseed, generation, publication, Teaching Load apply, term-cache apply, rollover, and migration all remain locked.
