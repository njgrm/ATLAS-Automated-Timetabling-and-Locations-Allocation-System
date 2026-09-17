# CONSOLIDATED-DEPLOYMENT-C10 — execution evidence (PREFLIGHT COMPLETE; CUTOVER NOT EXECUTED — STOPPED)

- **Role:** `ROLE: EXECUTOR` (one HIGH shared-runtime deployment under an exact, already-granted operator approval).
- **Outcome:** `STOP` before the listener change. Steps 1–2 (incumbent capture, build + install + alternate-port preflight + rollback startability) completed. Step 3 (the approved durable-env change) is **not executable as approved** — see §4. Steps 4–6 were **not** started.
- **Cutover executed:** **NO.** No listener was stopped, no scheduled task was changed, no runtime was started, no login was performed, no data was written.
- **Zero-mutation statement:** the incumbent runtime, the scheduled task, both machine-scope variables, the durable env file, port 5175, every unrelated process, and all 46 public database tables are byte/identity-identical to the pre-action capture. Evidence in §10.

---

## 1. Immutable identity

| Item | Value |
|---|---|
| Target pin (`PIN40`) | `8eb0511baa537d4212f24a007ac40e2dded38c0e` |
| Pin subject | `docs(prompts): close round-3 pre-action finding on the CONSOLIDATED-DEPLOYMENT-C10 login delta` (2026-09-17 21:37:07 +08) |
| Governing packet | `docs/prompts/consolidated-deployment-c10-2026-09-17.md` |
| Packet blob | `7c650dcb54c28875467a34703a8cc6012ba4f0a9` — **matches** the assigned identity |
| Packet LF-SHA-256 | verified by `node ops/workflow/pins.mjs check --packet docs/prompts/consolidated-deployment-c10-2026-09-17.md` → `{"status":"ok","checked":1,"errors":0}`, exit `0` |
| Directive | `AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88` — **matches** |
| Worktree / branch | `E:/ATLAS-worktrees/consolidated-deploy-c10` @ `713e6929` on `chore/consolidated-deploy-c10` |
| `PIN40` ancestry of branch tip | `git merge-base --is-ancestor 8eb0511b… HEAD` → exit `0` |
| Branch tip delta above `PIN40` | docs/register only: `docs/plans/atlas-delivery-cycles.json`, `docs/plans/atlas-active-delivery-streams.generated.md` — **product source is byte-identical to `PIN40`** |
| Install directory | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| Approved boundary | drop variant in force (SSO clause removed); row 5 scored against the **13-key** set in packet §3.2 |

---

## 2. Step 1 — incumbent capture (all values match packet §3 exactly; no divergence → no STOP)

| Item | Captured | Packet §3 | Verdict |
|---|---|---|---|
| Task | `\ATLAS-Runtime-Supervisor` Enabled / Running / SYSTEM / ONSTART | same | MATCH |
| Task action | `"C:\Program Files\nodejs\node.exe" "D:\ATLAS-runtime-supervised-54dce67b-20260914\ops\runtime\cli.mjs" start` | same | MATCH |
| Task "Start In" | `D:\ATLAS-runtime-supervised-54dce67b-20260914` | same | MATCH |
| Task XML invariants | `<BootTrigger/>` (no `<Delay>`), `<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>`, `<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>`, `S-1-5-18`, `HighestAvailable` | ONSTART, PT0S, IgnoreNew, SYSTEM, Highest | MATCH |
| Supervisor | PID `4020`, parent `3456` | PID 4020 (parent 3456) | MATCH |
| Child 5001 | PID `13244` — `…\54dce67b…\atlas-server\dist\server.js` | 13244 | MATCH |
| Child 5174 | PID `13260` — `…\54dce67b…\ops\runtime\host.mjs` | 13260 | MATCH |
| Listeners | exactly one owner per port | same | MATCH |
| Machine vars | `ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-54dce67b-20260914`; `ATLAS_RUNTIME_RELEASE_SHA=54dce67b8392cbce09aa810813c37f9c87a67159` | not recorded in §3 | captured |
| Durable env file | `D:\ATLAS-runtime-config\atlas-server.env`, **14 keys**, SHA-256 `eb941b11231a16e38056a92ffa7cea5835f35c3cf7aaa161c6720e04d7b7bdfa`, CRLF, 2358 bytes, 37 lines | 14 keys, same SHA-256 | MATCH |
| SSO/COMPANION keys | **none present** | no `SSO`/`COMPANION` key | MATCH |
| Health | local health 200; local ready 200 (`database: ok`); host `/__host/live` 200 + `/__host/ready` 200 (artifact = release `54dce67b` client dist, upstream ready); Tailnet health 200 | 200/200/200/200 | MATCH |
| Disk (governed volume) | `D:` 31.26 GiB free at capture (C: 18.05, E: 65.39) — above the 25 GiB warn and 15 GiB fail-closed floors | D: 31.26 GiB | MATCH |

**§5.3 pre-state for the login actor (captured per instruction; §3 records no actor baseline, so no divergence applies):**

- `atlas_auth_accounts` id `46` — role `officer`, `school_id` 1, `is_active` true, `last_login_at` `2026-09-17 08:02:53.582`, `faculty_id` NULL, `failed_login_count` 0, `locked_until` NULL, `updated_at` `2026-09-17 08:02:54.171`, `created_at` `2026-09-06 16:55:04.939`.
- `audit_logs` high-water `799`, total `248`.
- **Persisted term authority present** (W7 capture): active mirror id `223`, school 1 / year 9 / `2030-2031`, `is_active=true`, `is_archived=false`, `term_contract_cache` **populated** (`is not null = true`), `term_contract_cached_at = 2026-09-16 03:59:21.236`, `updated_at = 2026-09-16 03:59:21.249`. Exactly one active non-archived mirror for school 1.
- Database target (sanitized): `atlas_recovery_clean_rebuild_20260905`, user `atlas_user`, PostgreSQL 18.1, local (`::1`). Matches the DB named in the approval.

**Unrelated processes present at capture and never touched:** PIDs `25648`, `12692`, `43816` (all alive after this action). Port 5175, Tailscale Serve, and all non-supervisor-owned PIDs were untouched.

---

## 3. Step 2 — build + install at `PIN40` (completed, listener-free)

### 3.1 Install mechanism and identity

The durable release checkout was created with the project's own sanctioned mechanism (the same one used for every incumbent release directory, per `docs/prompts/tt-tl-runtime-acceptance-2026-09-12.md:122-124`):

```
git -C D:/ATLAS worktree add --detach D:\ATLAS-runtime-supervised-8eb0511baa53-20260917 8eb0511baa537d4212f24a007ac40e2dded38c0e
```

- `.git` = `gitdir: D:/ATLAS/.git/worktrees/ATLAS-runtime-supervised-8eb0511baa53-20260917` (a **real** `.git`, required by `verifyProductPin`).
- `git -C <install> rev-parse HEAD` = `8eb0511baa537d4212f24a007ac40e2dded38c0e` = `PIN40`.
- `git merge-base --is-ancestor PIN40 HEAD` → exit `0`.
- `git -C <install> status --short` → empty (a clean checkout at the pin).

### 3.2 Dependency provenance (isolated staging — no install command, no shared tree mutated)

The harness denied `npm ci` / `npm install`, and the only verified lockfile-matching trees were shared trees. `vite build` demonstrably writes `<project>\node_modules\.vite-temp` (that directory exists in the incumbent client tree), so a shared junction would have been mutated. Dependency trees were therefore **copied** into the release checkout and every build write stayed inside `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917`:

| Root | Lockfile blob at `PIN40` | `D:/ATLAS` working copy | incumbent `54dce67b` | Identity |
|---|---|---|---|---|
| `package-lock.json` | `5d87e856aeae…` | `5d87e856aeae…` | `5d87e856aeae…` | MATCH |
| `atlas-server/package-lock.json` | `ee29339c156a…` | `ee29339c156a…` | `ee29339c156a…` | MATCH |
| `atlas-client/package-lock.json` | `1fe57327aa89…` | `1fe57327aa89…` | `1fe57327aa89…` | MATCH |

- Copy source for all three roots: the proven incumbent tree `D:\ATLAS-runtime-supervised-54dce67b-20260914` (read-only source; junction targets: **none**).
- `.vite-temp` after the build: present **only** inside the release dir; absent from `D:/ATLAS/node_modules` and from the incumbent root tree.
- Disk: `D:` 30.68 → **29.79 GiB free** after staging (still above both floors). No `node_modules` target was counted, shared, or deleted.
- **Disclosure:** the harness subsequently denies `git worktree add/remove`, so retirement of the release checkout is a planner/integration action, not an executor one (§12).

### 3.3 Prisma client regeneration (required — the schema changed at `PIN40`)

`prisma/schema.prisma` differs between `54dce67b` and `PIN40` (+34 lines: `model TeacherProgramPresentationRevision` plus its `School` relation). The copied client was therefore regenerated against the `PIN40` schema:

```
& <install>\node_modules\.bin\prisma.cmd generate     # workdir = <install>
→ "Generated Prisma Client (v6.19.2) to .\atlas-server\node_modules\.prisma\client", exit 0
```

- No Prisma **migration** command was run; `_prisma_migrations` stayed at 4 rows across this entire action (§10).
- Verified `TeacherProgramPresentationRevision` is present in the regenerated `index.d.ts`.

### 3.4 Builds (S2 / S3)

| Gate | Command | Result |
|---|---|---|
| S2 server build | `npm run build --prefix atlas-server` (`tsc`) | exit `0`; `atlas-server/dist/server.js` present (789 dist files) |
| S3 client build | `npm run build --prefix atlas-client` (`vite build`) with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` | exit `0`; `atlas-client/dist/index.html` present (201 dist files) |

**Non-secret client build input honored (positive check):** `atlas-client/dist/assets/index-BpNxUQA8.js:21` contains the inlined literal
`VITE_ENROLLPRO_URL:\`https://dev-jegs.buru-degree.ts.net\`` — the approved non-secret origin, not a raw IP and not a stale default.

**`.js` ESM runtime-import proof (S2):** the built server was actually started under Node and served requests (no `ERR_MODULE_NOT_FOUND`), which is the load-bearing proof for the runtime import graph. One static-scan match exists — `atlas-server/dist/__tests__/teaching-load-overload-capacity-totals.test.js:3` imports `'../services/teaching-load-reconciliation.service'` without `.js` (and line 105 is only its own `sourceMappingURL`). This file is a compiled test artifact with **no production referrer**: a scan of every other `dist/**/*.js` module for `teaching-load-overload-capacity-totals` returns **no reference**, so it is off the server's runtime import graph. Recorded truthfully as `NON_BLOCKING` with its exact path (see §11, F3).

### 3.5 Alternate-port preflight smoke (never bound 5001/5174)

| Probe | Port | Result |
|---|---|---|
| `PIN40` built server | 15001 | health `200` after ~6 s; ready `200` `{"status":"ready","checks":{"database":"ok"}}` |
| `PIN40` built host | 15174 | `/__host/live` `200`; `/__host/ready` `200`, `artifact=D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\atlas-client\dist`, `upstream=ready` |
| Error logs | — | 0 lines; `ERR_MODULE_NOT_FOUND` **false**, `EADDRINUSE` **false** |

Post-smoke: both alternate ports **released**; ports 5001/5174 still owned by `13244`/`13260`.

### 3.6 Rollback startability proof (row 12)

| Rollback tier | Release dir | Proof | Verdict |
|---|---|---|---|
| Primary | `D:\ATLAS-runtime-supervised-54dce67b-20260914` (`54dce67b`) | Alternate-port start on 15004/15176: server health `200` in ~4 s, ready `200` `database: ok`; host live `200`; zero module errors. (It is also the incumbent currently serving 5001/5174.) | **PASS** |
| Secondary | `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) | Alternate-port start on 15002/15175: host live `200`, but the **server failed to boot** — 19 stderr lines, `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'helmet' imported from D:\ATLAS-runtime-supervised-20260912\atlas-server\dist\app.js` | **FAIL — see §11 F1** |
| Last resort (manual, non-supervised) | `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0`) | Not exercised (manual last resort only) | not exercised |

Both alternate ports released afterwards; 5001/5174 untouched throughout.

---

## 4. Step 3 — the approved durable-env change: **BLOCKED (STOP condition)**

**Required by the approved boundary:** remove the vestigial `ATLAS_DEFAULT_SCHOOL_ID` key from `D:\ATLAS-runtime-config\atlas-server.env`; expect 14 → 13 keys; no SSO/COMPANION key.

**Result: the write is denied by the file's own ACL. Zero mutation occurred.**

- The executor shell **is elevated** (`elevated=True`), so elevation is not the constraint.
- The file's DACL is **protected against inheritance** and grants **only** `FILE_GENERIC_READ`:

  ```
  SDDL: O:BAG:S-1-5-21-1398962778-519386765-65508979-1001D:PAI
        (A;;FR;;;SY)(A;;FR;;;BA)(A;;FR;;;S-1-5-21-1398962778-519386765-65508979-1001)
  AreAccessRulesProtected = True
  ```

  i.e. `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators`, and the executing operator account each have **Read, Synchronize — no write of any kind**, and no `WRITE_DAC`.
- Exact failure: `System.UnauthorizedAccessException: Access to the path 'D:\ATLAS-runtime-config\atlas-server.env' is denied.`
- The containing directory **is** writable (a temp-file probe in `D:\ATLAS-runtime-config` succeeded and was removed), so the **file-level ACL is the sole blocker**.
- Post-attempt file identity is **unchanged**: SHA-256 `eb941b11231a16e38056a92ffa7cea5835f35c3cf7aaa161c6720e04d7b7bdfa`, 2358 bytes, key set still **14** with `ATLAS_DEFAULT_SCHOOL_ID` present.

**Why this is a STOP and not a workaround.** The only way to perform the authorized removal is to first modify the file's security descriptor — the owner is `BUILTIN\Administrators`, so an elevated process could re-grant itself write and then edit the key. That is a **security-configuration mutation of the runtime environment**, it is not among the seven `approvedActions`, and this ACL is deliberate hardening authored by the `RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE` packet ("Apply an ACL on the durable file readable only by the executing operator/task account, `SYSTEM`, and `Administrators`"). The governing instruction is explicit: *"If a mandatory precondition diverges or the task cannot be re-pointed, STOP and report the blocker rather than substituting a workaround."* Relaxing a reviewed read-only ACL to satisfy one line of scope would substitute an unauthorized security change for the approved mechanism. **Not performed.**

**Steps 4–6 were therefore not started:**

- Step 4 (stop the supervisor-owned tree) — **not performed**; the incumbent is still running.
- Step 5 (re-point the task, update both Machine-scope variables, `schtasks /run`) — **not performed**; the task still points at `54dce67b`.
- Step 6 (13-row matrix, §4.1 survivorship proof) — **not performed**; the new release is not live.
- Rollback was **not** performed: nothing was changed, so no rollback is applicable (and the pre-authorization is conditioned on a *failed mandatory acceptance row*).

---

## 5. Acceptance matrix — honest statuses

Rows are scored against the **deployed pin being live**, which it is not. Rows 1–11 and 13 are therefore not satisfied by the cutover; only the preflight and zero-mutation rows can be scored.

| # | Row | Status | Evidence |
|---|---|---|---|
| 1 | Release identity | **NOT_PERFORMED** | Preflight only: install HEAD = `PIN40` exactly, real `.git`, pin ancestry exit 0. `cli.mjs status` cannot report a `releaseSha` until the new release has actually started, so this row stays unperformed rather than being scored on the stale `live` flags. |
| 2 | Listeners (+ §4.1 survivorship) | **NOT_PERFORMED** | No cutover. Incumbent still exactly one owner per port (`5001→13244`, `5174→13260`) under supervisor `4020`; no task-launched survivorship proof exists because no task was run. |
| 3 | Health (local health/ready, host live/ready, Tailnet) | **NOT_PERFORMED** | Incumbent health recorded at 200/200/200/200 (§2). New release health was proven only on alternate ports (§3.5). |
| 4 | `ROLLOVER_AUTO_SYNC_ENABLED=false` | **NOT_PERFORMED** | Contract string at `PIN40` is `"false"` (`ops/runtime/runtime-contract.json`; `validateContract` accepts only the literal strings `"true"`/`"false"` and hard-pins `ATLAS_SUPERVISED="true"`) and the incumbent composition carries the same invariant. Row 3/4 semantics require the live cutover. |
| 5 | Env change (`ATLAS_DEFAULT_SCHOOL_ID` absent; no SSO keys; other names unchanged) | **BLOCKED — not executable as approved** | §4. File unchanged: 14 keys, `ATLAS_DEFAULT_SCHOOL_ID` still present, SHA-256 `eb941b11…`, **zero** `SSO`/`COMPANION` keys added. |
| 6 | Anonymous class-template 401 + `class_templates` delta 0 | **NOT_PERFORMED — deliberately not probed** | The packet forbids probing this route while the pre-fix incumbent is live. Row 1 never confirmed the pin live, so this route was **not requested even once**. `class_templates` = 4 rows before and after (§10). |
| 7 | Zero `TERM_AUTHORITY_STALE`, no authority blocker | **NOT_PERFORMED** | Requires the single authenticated session; not consumed (see §7). Persisted term authority is confirmed present (mirror 223, §2) so the row is satisfiable once a live cutover exists. The truthful `CANONICAL_TEMPLATE_INCOMPLETE` statement required by §5.1 is **not made**, because the diagnostic was never run: claiming it without the probe would be an unevidenced assertion. |
| 8 | Published-revision immutability | **NOT_PERFORMED** | Public read-only row, but defined against the deployed pin. Not probed. The §5.1/row-8 recorded limitation (the published-run term resolver falls back to live term authority at `published-schedule.service.ts:892`, unreachable while no published run exists) is **not** claimed as a positive immutability proof. |
| 9 | Actor scope (`/api/v1/runtime/context`) | **NOT_PERFORMED** | Same single-session dependency. |
| 10 | Login footprint (exactly one `LOCAL_LOGIN_SUCCESS` + named account write) | **NOT_PERFORMED — zero logins** | No login was performed. Observed delta is exactly zero: audit high-water `799 → 799`, total `248 → 248`; actor 46 row byte-identical (§10). |
| 11 | Session cleanup (logout → `/auth/me` 401 `NO_TOKEN`) | **NOT_PERFORMED** | No session was created, so there is nothing to clean up. No token, cookie, or pending context was left anywhere. |
| 12 | Rollback startable | **PASS (preflight)** | Primary rollback release `54dce67b` proven startable on alternate ports (§3.6): server + host healthy, ready `database: ok`, zero module errors. Secondary `9d293879` **failed** startability (F1). Rollback was correctly **not executed** (rows 2–4 were never reached). |
| 13 | Zero data mutation (all other signatures delta 0) | **PASS** | Complete 46-table census plus audit high-water/total and the actor-46 row are identical pre/post (§10). The full §5.3 login delta expected by the packet is **empty in practice** — no `audit_logs` row, no `last_login_at`/`faculty_id`/`failed_login_count`/`locked_until`/`updated_at` change — because no login occurred. |

**Honest summary: 2 of 13 rows scored (row 12 preflight PASS, row 13 PASS). 1 row BLOCKED (row 5). 10 rows NOT_PERFORMED because the cutover did not occur.** No row is claimed as passed on the strength of an unexecuted step.

---

## 6. §4.1 launch ownership — not exercised

`launchOwner` / `launchMechanism` / `rollbackLaunchOwner` / `rollbackLaunchMechanism` are defined in the packet §4.1 and were **not invoked**: no task re-point, no `schtasks /run`, and therefore no task-launched resident and no post-shell-exit survivorship claim. The runtime was never started as a child of the executor shell — the only processes this action started were the four short-lived alternate-port smoke processes (PIDs 24636/42896, 32640/24964, 14936/+), each explicitly stopped and their ports released.

---

## 7. The single authorized login — not consumed

The one authorized privileged login (actor 46, `officer`, school 1) was **not used**. Consuming it before a live cutover would have (a) spent the single-login budget against rows 7/9/10/11 that cannot exist without the deployed pin, and (b) written the §5.3 delta for no acceptance value. It remains fully available for the re-attempted cutover.

**Observed login delta for this action: none.**

| Expected by §5.3 | Observed |
|---|---|
| One `audit_logs` row, action `LOCAL_LOGIN_SUCCESS` | none (high-water 799 → 799, total 248 → 248) |
| `atlas_auth_accounts` id 46: `last_login_at`, `faculty_id`, `failed_login_count` → 0, `locked_until` → null, engine-managed `updated_at` advance | none — row byte-identical |
| Failed-login attempts (would add `LOCAL_LOGIN_FAILED` + an account update) | none |

The post-action independent acceptance review's separate login authorization was likewise **not used**.

---

## 8. Rollback status

**No rollback was performed, and none is applicable.** The pre-authorization is conditioned on a mandatory acceptance row failing; the blocking row here (row 5) is an **env-write authority** failure discovered *before* any listener change, so no incumbent was displaced and there is nothing to restore. The env key was never removed, so the "restore the env key you removed" clause of the rollback path is not triggered either.

---

## 9. Explicitly not done

No listener stop/start; no scheduled-task change; no machine-variable change; **no durable-env change**; no ACL change; no login; no logout; no data mutation; no generation, publication, Teaching Load apply, term-cache apply, rollover, migration, or companion-repository action; no Tailscale Serve change; no port-5175 or unrelated-process action; no register, packet, or spec edit; no push; no SSO/COMPANION key added; no provisioning file created or used.

---

## 10. Zero-mutation proof (before → after)

| Signature | Before | After | Delta |
|---|---|---|---|
| `audit_logs` high-water | 799 | 799 | 0 |
| `audit_logs` total | 248 | 248 | 0 |
| `atlas_auth_accounts` id 46 | `officer\|1\|true\|2026-09-17 08:02:53.582\|NULL\|0\|NULL\|2026-09-17 08:02:54.171` | identical | 0 |
| Durable env SHA-256 | `eb941b11231a16e38056a92ffa7cea5835f35c3cf7aaa161c6720e04d7b7bdfa` | identical | 0 |
| Durable env key count | 14 | 14 | 0 |
| Task action / Start In | `…\54dce67b-20260914…` | identical | 0 |
| Machine vars | `54dce67b-20260914` / `54dce67b…` | identical | 0 |
| Supervisor / children | 4020 → 13244, 13260 | identical | 0 |
| **All 46 public tables** | census in §2 | **identical for all 46** (`_prisma_migrations` 4, `class_templates` 4, `published_schedule_revisions` 0, `faculty_subjects` 183, `generation_runs` 1, `teaching_load_cycles` 2, …, `school_year_term_configs` 1) | 0 |
| EnrollPro mirror 223 | `…\|true\|true\|2030-06-08…` | identical | 0 |
| Health (local health/ready, host live, Tailnet) | 200/200/200/200 | 200/200/200/200 | 0 |
| Ports 5001/5174 owners | 13244 / 13260 | 13244 / 13260 | 0 |
| Unrelated PIDs 25648 / 12692 / 43816 | alive | alive | 0 |

---

## 11. Findings

### BLOCKING

**F1 — Secondary rollback release `9d293879` is not startable as stored.** `D:\ATLAS-runtime-supervised-20260912` is missing `helmet` in `atlas-server/node_modules`; its built server throws `ERR_MODULE_NOT_FOUND: Cannot find package 'helmet' imported from …\atlas-server\dist\app.js` and never binds. Its host child starts, but the tier is not a functional fallback. Impact: the first-tier rollback (`54dce67b`) is proven startable, so this does **not** block a rollback of this deployment; it blocks any claim that the *second* rollback tier is operational. Classification: `BLOCKING` for the fallback-tier claim; `NON_BLOCKING` for the primary rollback path. Owner: primary planner (repair or re-scope the declared second tier before/with the re-attempted cutover).

**F2 — The approved env change is not executable under the current file ACL.** See §4. Classification: `BLOCKING` for this packet's completion; the re-attempt needs one of (a) a revised approval that explicitly authorizes the exact ACL adjustment and its restore, (b) an operator-run env edit with the executor verifying key names/checksums only, or (c) a reviewed mechanism that holds write on that file for the duration of the change. Not for the executor to choose.

### NON_BLOCKING

**F3 — One extensionless relative import exists in a compiled test artifact.** `atlas-server/dist/__tests__/teaching-load-overload-capacity-totals.test.js:3` imports `'../services/teaching-load-reconciliation.service'` without `.js`. Off the server runtime import graph (no other dist module references it; the only other occurrence is its own `sourceMappingURL`), and the live alternate-port start proved the runtime graph resolves. Source-level cleanliness only; suggest a successor lint for `atlas-server/src/__tests__/**`.

**W-notes — packet-accuracy notes found by the pre-action review, recorded so they are not lost (all `NON_BLOCKING`):**

- **W1** §1's motivation list wrongly includes `TT-WARNING-AUTHORITY-C04`; the incumbent release already contains it.
- **W2** §5.1's illustrative row list omits rows 4 and 7, and states the SSO keys unconditionally (the approved sentence is the drop variant).
- **W3** Row 4 should cite the supervisor contract invariants (`ops/runtime/runtime-contract.json` + `validateContract`), not only a status field.
- **W4** §2.7's DB-side migration-checksum claim is not read-only verifiable from the executor context and is inert for this action (no migration command runs; `_prisma_migrations` stayed at 4).
- **W5** §5.3's "exactly two writes" is scoped to a *successful* login; failed attempts add their own row/update.
- **W6** The drop variant needs only the pin substitution — no provisioning path.
- **W7** Row 7 depends on the persisted term authority still being present, so it must be captured in step 1 — it was (§2: mirror 223, `term_contract_cache` populated). No separate provisioning artifact is needed for a re-attempt.

**Additional executor-disclosed notes (NON_BLOCKING, process):**

- **N1** The durable release checkout is a Git **linked worktree** of `D:/ATLAS` (the sanctioned mechanism used by every incumbent release dir, packet §4 step 2, `tt-tl-runtime-acceptance-2026-09-12.md:122-124`). It is a runtime-release checkout, not a task worktree, and it did not exist before this action. The harness's executor rules deny `git worktree add/remove`, so the executor cannot retire it; retirement is a planner/integration action (§12).
- **N2** `npm ci` / `npm install` are denied by the harness; dependencies were staged by copy from the lockfile-verified incumbent tree, so every build write stayed inside the release checkout and no shared tree or junction target was modified (§3.2).
- **N3** A prior cycle wrote this same env file on 2026-09-16 (mtime + a `backups\atlas-server.env.bak-20260915T172050Z` sibling exists) while the current ACL is read-only for all principals. Worth reconciling how that write was authorized — relevant to F2's remedy.

---

## 12. Worktree disposition

| Artifact | Disposition |
|---|---|
| `E:/ATLAS-worktrees/consolidated-deploy-c10` (branch `chore/consolidated-deploy-c10`) | `RETIRE_AFTER_INTEGRATION` per packet §0. Clean (`git status --short` empty before and after this action). |
| `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` (detached `PIN40`, registered worktree, built, smoke-verified) | **Staged release artifact, retained.** Not deployed. Recommend `PRESERVE_FOR_DECISION` until the F2 remedy is decided; if the planner prefers retirement, it must be done by a role permitted to run `git worktree remove` + `git worktree prune` (the executor is not). No branch was created; no branch deletion is implied. |
| `D:\ATLAS-runtime-supervised-54dce67b-20260914` / `20260912` / `fallback-d44-20260912` | Untouched (the `20260912` tier's pre-existing `helmet` gap is F1). |

---

## 13. Return contract

- **Verdict:** `REVIEW_REQUIRED` — `STOP` before cutover; deployment **not executed**; incumbent untouched.
- **Base SHA:** `PIN40` = `8eb0511baa537d4212f24a007ac40e2dded38c0e`.
- **Candidate SHA:** see the commit that contains this file (recorded in the executor handoff).
- **Changed paths:** `docs/reviews/consolidated-deployment-c10/deployment-evidence-2026-09-17.md` (docs-only candidate).
- **Rollback status:** not performed; not applicable (no listener/task/env change occurred).
- **Push status:** **not pushed** (executor does not push).
- **Roles:** executor only; the packet's fresh post-action independent acceptance review was **not** commissioned, because there is no deployment to accept.
- **Single next action:** the primary planner decides the F2 remedy (the exact authority needed to modify `D:\ATLAS-runtime-config\atlas-server.env` under its read-only ACL) and re-issues the cutover with a corrected env-change mechanism; the built release at `PIN40` is already staged and smoke-verified, and the one authorized login is unconsumed. Fold in F1 (second-tier fallback not startable) before the re-attempt.
- **Safe parallel work:** none needed — no shared-runtime, database, or product surface was left in an intermediate state.
- **Locked successors:** generation, publication, term-cache apply, Teaching Load apply, rollover, and migration remain locked and were not touched.
