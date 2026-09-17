# CONSOLIDATED-DEPLOYMENT-C10 — HIGH shared-runtime deployment packet

Status: authored 2026-09-17 (Asia/Manila). Prepared, NOT approved and NOT
executable until every prerequisite below is satisfied and the exact approval
sentence is returned by the operator after a fresh independent pre-action review.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.
- Base: re-verified at dispatch 2026-09-17 on
  `43341ac7cb908f9ca692dbc93f8da8ef26ec52b0`, the `origin/main` tip at dispatch
  and the ancestry root of the frozen pin.
- Target pin: the `origin/main` tip AFTER `MIG-APPLY-0002-0003` has **applied**,
  AFTER `SLOT-BREAK-AUTHORITY-C11` (and `WF-C10-TRANSITION-GUARD-HARDENING`, needed
  only so this gate can be recorded truthfully) have integrated, and AFTER
  **`G9G10-FLAG-SOURCE-LANE`** (`cca958d7` / integration `ec235689` / closure
  `479e5423`) has integrated. `G9G10` is **mandatory** in this pin: it changes the
  canonical `class-program-slot.service.ts` catalog, so a deployment pinning the
  old catalog would make the subsequent `DATA-CORRECTION-C01` reseed fail closed in
  the opposite direction (`CANONICAL_TEMPLATE_INCOMPLETE`). Refresh and report the
  base if it moved; do not pin a non-existent tip. The literal 40-hex pin
  (`<PIN40>`) is frozen at dispatch as the `origin/main` tip that contains this
  amended packet plus the C10 register revision, and is recorded in the register
  and in the returned approval sentence. It is deliberately not written into this
  packet, so the packet never has to state the SHA of the commit that contains it.
- Known post-cutover state to record, not to fix: once this release is live the
  catalog expects the corrected grid while the database still holds the old one, so
  generation fails closed until `DATA-CORRECTION-C01` reseeds. Acceptance for this
  action is its own rows, **not** a full readiness pass.
- Risk tier: HIGH (shared-runtime deployment + durable env change).
- Worktree: `E:/ATLAS-worktrees/consolidated-deploy-c10` (build/verify only),
  branch `chore/consolidated-deploy-c10`, disposition `RETIRE_AFTER_INTEGRATION`.

## 1. Why now

The incumbent release `54dce67b8392cbce09aa810813c37f9c87a67159` predates every
accepted correction after 2026-09-14, including:

- `AUTHZ-CLASS-TEMPLATE-C07R1` — the live runtime still serves the pre-fix
  unauthenticated cross-tenant write-on-read class-template route. Deployed
  `class-template.router.ts` blob `2b77bbee` equals pre-fix base `917da8be`;
  `origin/main` is fixed at `09720cc3`. The fix `d15be919` is an ancestor of main.
- `PUBLISHED-IMMUTABILITY-C08` / `C08R1` (frozen published identity).
- `TT-WARNING-AUTHORITY-C04`, `TT-WARNING-REALISM-C07R1` (warning counts/policy).
- `BENEFICIARY-EXPORT-PARITY-C05`, `EXPORT-PRESENTATION-SCHEMA-GUARD-C06B`.
- `GENERATION-AUTHORITY-REALISM-C07` / `C07R1` including the R3 term-authority
  canonicalization (`459304ce`, merged `be2d99a9`), which removes the false
  `TERM_AUTHORITY_STALE` blocker.
- `TL-DIAGNOSTICS-LOADING-C06`, `WF-SEED-INVENTORY-C02`, `WF-SEED-PIN-C01`.

Exposure is established from source and deployed-blob evidence only. Do NOT probe
anonymous `GET /api/v1/class-templates` or `/:id` to "confirm" it: that route
performs a write on read.

## 2. Prerequisites (all mandatory, all zero-cost, before consuming any approval)

1. `MIG-APPLY-0002-0003` applied and verified (`0002_companion_sso_code`,
   `0003_teacher_program_presentation`). The target server code requires those
   tables: `model CompanionSsoCode` (`prisma/schema.prisma:339`) and
   `model TeacherProgramPresentationRevision` (`:1313`) are consumed by
   `routes/auth.router.ts`, `services/companion-sso.service.ts`, and
   `services/export-presentation.service.ts`. Deploying ahead of the migration
   mounts those routes against absent tables.
2. `SLOT-BREAK-AUTHORITY-C11` integrated (break/shift authority must consume the
   canonical `classProgramSlot` grid) — or the operator explicitly defers it and
   accepts that deployed warnings will use the retired 11:55–12:55 lunch window.
3. `WF-C10-TRANSITION-GUARD-HARDENING` integrated, so this HIGH gate's
   approval and execution can be recorded through the sanctioned transitions
   rather than under-reported.
4. `FACULTY-SYNC-PUBLICATION-CAS-C01` is NOT a prerequisite for this action. It
   guards against un-publishing a published run and the database has zero
   `PublishedScheduleRevision` rows. It must land before publication, not before
   deployment.
5. Re-confirm task/process/listener identity immediately before the listener
   change. Any divergence from the recorded pre-state is a STOP.
6. Build the target release on ALTERNATE ports in an isolated directory and smoke
   it; never bind 5001/5174 during preflight. Prove the rollback release starts.
7. **O1 preflight — migration-file line-ending/checksum integrity (required
   before any Prisma migration command).** `.gitattributes` LF coverage omits
   `prisma/migrations/**`, so those files are `w/crlf` with an empty `attr/`
   column (`git ls-files --eol prisma/migrations`). The persisted
   `_prisma_migrations.checksum` values are **mixed form**: `0001`, `0002`, and
   `0003` equal the CRLF bytestream digest of their `migration.sql`, while `0000`
   equals its LF digest. Require that `git ls-files --eol prisma/migrations` still
   shows `w/crlf` **or** that each recomputed `migration.sql` digest equals the
   persisted `_prisma_migrations.checksum` for that migration; on any mismatch
   STOP. Do **not** add an LF rule for `prisma/migrations/**` while the persisted
   checksums are CRLF-form — that would itself create checksum drift.

### 2.1 Dispatch-time prerequisite status (verified 2026-09-17, read-only)

| Prerequisite | Status |
|---|---|
| `MIG-APPLY-0002-0003` applied and verified | SATISFIED — the stream is `INTEGRATED`; `0002_companion_sso_code` and `0003_teacher_program_presentation` were applied 2026-09-17 under the operator's exact HIGH approval with 12/12 acceptance rows and protected-domain delta 0. Its remaining closure item is a bounded **docs-only** correction (`EXPORT-PRESENTATION-PREMISE-SWEEP-C02`: the term-cache packet still asserts a 2-row registry and a pending `0002`), not a product, schema, or runtime defect, and it does not block this deployment |
| `SLOT-BREAK-AUTHORITY-C11` integrated | SATISFIED — `COMPLETE`; `C11R` also `COMPLETE` |
| `WF-C10-TRANSITION-GUARD-HARDENING` integrated | SATISFIED — `COMPLETE`; this is why §9's sanctioned approval and execution transitions exist |
| `G9G10-FLAG-SOURCE-LANE` integrated | SATISFIED — `COMPLETE`; candidate `cca958d7`, integration `ec235689`, register tip `479e5423`, wave-audited `AUDIT_CLEAR` 12/12/0/0 |
| Directive pin at the dispatch tip | SATISFIED — `origin/main:AGENTS.md` blob `051ad26a…`, LF-SHA-256 `76631646…`, equal to the operating copy at dispatch |
| §2.5 and §2.6 listener identity, alternate-port build, rollback startability | EXECUTION-TIME — re-confirm immediately before the listener change; any divergence from the recorded pre-state is a STOP |
| §2.7 O1 migration-encoding preflight | NOT TRIGGERED — this action runs no Prisma migration command. It remains mandatory if any migration command is ever added to this boundary |

## 3. Verified starting authority (elevated read-only, 2026-09-16/17)

| Item | Verified value |
|---|---|
| Task | `\ATLAS-Runtime-Supervisor` — Enabled, State Running, SYSTEM, ServiceAccount, Highest, ONSTART, `PT0S`, IgnoreNew |
| Task action | `"C:\Program Files\nodejs\node.exe" "D:\ATLAS-runtime-supervised-54dce67b-20260914\ops\runtime\cli.mjs" start` |
| Start In | `D:\ATLAS-runtime-supervised-54dce67b-20260914` |
| Boot recovery | Last Run 2026-09-16 05:30:57 (+08, boot +12s); Last Result 267009 |
| Supervisor | PID 4020 (parent 3456) |
| Children | 5001 → 13244 `atlas-server/dist/server.js`; 5174 → 13260 `ops/runtime/host.mjs` |
| Health | local `/api/v1/health` 200; `/api/v1/health/ready` 200 (`database: ok`); host `/__host/live` + `/__host/ready` 200; Tailnet health 200 |
| Invariants | `ATLAS_SUPERVISED=true`, `ROLLOVER_AUTO_SYNC_ENABLED=false` |
| Durable env | `D:\ATLAS-runtime-config\atlas-server.env` (+ `backups\` sibling). **14 keys at dispatch**, not 13: the authoring-time count was stale because `ENROLLPRO_PROXY_ORIGIN` was recovered 2026-09-15. File SHA-256 `eb941b11231a16e38056a92ffa7cea5835f35c3cf7aaa161c6720e04d7b7bdfa`. Key names only: `ATLAS_AUTH_DISABLE_RATE_LIMIT`, `ATLAS_DEFAULT_SCHOOL_ID`, `ATLAS_SYSTEM_TOKEN`, `CLIENT_URL`, `CORS_EXTRA_ORIGINS`, `DATABASE_URL`, `ENROLLPRO_API`, `ENROLLPRO_CLIENT_URL`, `ENROLLPRO_PROXY_ORIGIN`, `ENROLLPRO_SERVICE_TOKEN`, `FACULTY_ADAPTER`, `JWT_SECRET`, `PORT`, `SECTION_SOURCE_MODE`. No `SSO`/`COMPANION` key is present |
| Disk | C: 16.52 GiB, D: 31.26 GiB, E: 67.14 GiB free at dispatch — above floors |

Dispatch re-verification (2026-09-17, read-only): task `\ATLAS-Runtime-Supervisor`
Enabled, State Running, SYSTEM, "Task To Run" and "Start In" both still
`D:\ATLAS-runtime-supervised-54dce67b-20260914`; listeners exactly 5001 to PID
13244 (`atlas-server/dist/server.js`) and 5174 to PID 13260
(`ops/runtime/host.mjs`), each with exactly one owner. The supervisor PID,
parent, boot-recovery fields, health results, and the
`ATLAS_SUPERVISED`/`ROLLOVER_AUTO_SYNC_ENABLED` invariants above remain the
authoring-time capture and are re-confirmed at execution under §2.5.

### 3.1 Declared durable-env change (operator decisions 2026-09-17)

This action removes exactly one key from the durable env file:

- **REMOVE `ATLAS_DEFAULT_SCHOOL_ID`** — vestigial. Its login-provisioning
  fallback was intentionally removed (`CHANGELOG.md:2129`, `:2141`, `:4550` —
  "Zero references to `ATLAS_DEFAULT_SCHOOL_ID` in auth service"), no code reads
  it, and the live value is `1` (`sha256("1")`). The `.env.example` line was
  already removed by the 2026-09-17 decisions commit.

Not changed by this action (recorded for the next one):

- **KEEP `ATLAS_AUTH_DISABLE_RATE_LIMIT`** for the acceptance login below, then
  DISABLE it before publication in a separate reviewed HIGH env change. Live value
  is `true` (`sha256("true")`, `b5bea41b…`); it bypasses all login rate limiting
  (`local-auth.service.ts:12-14`).
- Keep `ENROLLPRO_PROXY_ORIGIN` and `ENROLLPRO_API` as recovered 2026-09-15.
- **ADD the EnrollPro companion-SSO keys (operator decision 2026-09-17)** so the SSO
  integration can be tested with EnrollPro without a second restart. The ATLAS SSO code is
  already live (`c989f03d` is an ancestor of `54dce67b`) and the routes are mounted on Tailnet
  (read-only probes return 401, not 404, for `/api/v1/auth/sso/authorize` and
  `/api/v1/auth/sso/exchange`), but **no `SSO`/`COMPANION` key exists in the durable env**, so
   the service fails closed with `COMPANION_SSO_NOT_CONFIGURED`. Required, from the paired values
   provisioned by the operator and EnrollPro (per `docs/handoffs/companion-sso-live-prep-c02-evidence.md`):
   `ENROLLPRO_SSO_CLIENT_SECRET` (>= 32 chars, identical on both sides),
   `ENROLLPRO_SSO_CALLBACK_URL` (EnrollPro's exact reverse callback URL), and `ENROLLPRO_BASE_URL`
   (**required as its own key** — no code path derives it from `ENROLLPRO_API`, and the upstream
   exchange fails closed without it, `companion-sso.service.ts:337-341`). Optionally, for the client build,
   `VITE_ENROLLPRO_SSO_START_URL` as an explicit reverse-start override.
   **Also required, and easy to miss:** `ATLAS_SSO_REVERSE_CLIENT_SECRET` — the vendor-shared
   *inbound* bearer that EnrollPro presents to `POST /api/v1/auth/sso/exchange`. ATLAS resolves the
   outbound secret by preferring `ENROLLPRO_SSO_CLIENT_SECRET` then falling back to
   `ATLAS_SSO_CLIENT_SECRET`, but resolves the inbound expected secret by preferring
   **`ATLAS_SSO_REVERSE_CLIENT_SECRET`** then falling back to `ENROLLPRO_REVERSE_CLIENT_SECRET`
   (`companion-sso.service.ts:131-143`), compared with `timingSafeEqual` at `:170`. With only the
   three keys above set, ATLAS can *call* EnrollPro but rejects EnrollPro's reverse-exchange bearer,
   so the reverse leg fails closed. Set the key under its canonical (EnrollPro) name from their
   configuration block; do not set both the canonical and legacy name for the same direction.
  **Never invent, print, or log a secret value.** Record only key names and a checksum of the file.
  This amendment is DROPPED (and the SSO keys become a separate HIGH env action) if the paired
  values are not available at approval time — say so in the approval rather than deploying a
  half-configured integration.

  **The declared set is FOUR keys, not three.** `ENROLLPRO_SSO_CLIENT_SECRET`,
  `ATLAS_SSO_REVERSE_CLIENT_SECRET`, `ENROLLPRO_SSO_CALLBACK_URL`, and
  `ENROLLPRO_BASE_URL`. The inbound reverse secret was added upstream at
  `8e1e203b`, which supersedes the earlier three-key wording. Note also that
  `docs/handoffs/enrollpro-companion-sso-response-2026-09-17.md` §5 row 3 still
  lists only three pending keys — that row is stale, and this packet is the
  authority.

  **The paired values are known-compromised and must be rotated first.** The
  same reply, §3 F3/F4, records that EnrollPro published both secrets in a
  plaintext document and that both must be treated as compromised and
  re-provisioned out of band (`ATLAS_SSO_CLIENT_SECRET` is `sha256("test")`,
  verified). Deploying the leaked values would ship a known-weak shared secret.
  This clause therefore executes ONLY against rotated values; if the operator has
  not re-provisioned them out of band before execution, the clause is DROPPED.

  **Provisioning channel — required for the ADD to be executable at all.** The
  values are paired with EnrollPro and must arrive out of band (never inside an
  issue, pull request, commit, log, screenshot, or chat transcript). The declared
  channel is an operator-only file outside every Git worktree:

  `D:\ATLAS-runtime-config\sso-provisioning-20260917.local.env`

  written by the operator before execution and containing exactly the declared
  key names. The executor merges those keys into the durable env without
  printing, logging, echoing, or committing any value, and records key names, the
  durable-env file checksums, and the provisioning file's existence only. The
  operator's returned approval sentence names the actual provisioning path.

  **Client build input (non-secret).** The reverse-start link is omitted by
  design unless the client build sets `VITE_ENROLLPRO_URL`
  (`atlas-client/src/lib/companion-config.ts:28-32,55-59`), so §4 step 2 sets it
  explicitly rather than shipping a disabled link.
- Leave port 5175, unrelated processes, Tailscale Serve, and every other key
  untouched.

### 3.2 Expected durable-env key set after this action

Conditional on the operator's returned sentence:

- **With the SSO clause:** `ATLAS_DEFAULT_SCHOOL_ID` removed and the four
  declared companion-SSO keys added — **17 keys**, being the 13 remaining
  dispatch keys plus the four above.
- **Without the SSO clause (dropped):** `ATLAS_DEFAULT_SCHOOL_ID` removed only —
  **13 keys**.

Row 5 is scored against exactly the set the returned sentence authorizes: every
other key name byte-identical, and no key added or removed beyond that declared
delta.

## 4. Execution shape (no impossible zero-downtime claims)

1. Record the incumbent identity (task fields, PIDs, listeners, health, env-file
   hash) into the execution evidence.
2. Build `atlas-server` (with explicit `.js` ESM runtime-import proof) and
   `atlas-client` at the pinned SHA, setting the non-secret client build input
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` so the EnrollPro
   links resolve; install to `D:\ATLAS-runtime-supervised-<pin12>-<date>`. Smoke
   the built server and host on ALTERNATE ports only; never bind 5001/5174.
3. Explicitly stop ONLY the supervisor-owned processes.
4. Apply the declared env change — remove `ATLAS_DEFAULT_SCHOOL_ID`, plus the
   four declared companion-SSO keys when the returned sentence authorizes the
   SSO clause — recording the before/after key-name set and file checksums, never
   printing values, then remove the provisioning file if it was used.
5. Start via the registered task: `schtasks /run /tn ATLAS-Runtime-Supervisor`,
   after re-pointing the task action + working directory and
   `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` to the new release.
6. Health/ready/host/Tailnet checks. On any mandatory failure, perform the
   symmetric rollback and prove startup.

Rollback: symmetric re-point + relaunch to `54dce67b`, then the supervised
`9d293879` (`D:\ATLAS-runtime-supervised-20260912`); the non-supervised
`d44f29e0` fallback at `D:\ATLAS-runtime-fallback-d44-20260912` remains a manual
last resort only.

### 4.1 Launch ownership (mechanical closure invariant — was missing before `f8d99b16`)

The four launch-ownership fields are now named explicitly. The durable resident
owner is the **registered task**, never the executor shell.

| Field | Value |
| --- | --- |
| `launchOwner` | Windows scheduled task `\ATLAS-Runtime-Supervisor` — principal `SYSTEM`, trigger at system startup (ONSTART), execution time limit `PT0S`, multiple-instances policy `IgnoreNew` (the task carries **no** startup delay; the live XML shows `<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>` and no `<Delay>` element). It, and not the invoking executor process, is the durable resident owner |
| `launchMechanism` | (a) re-point the task action to `"C:\Program Files\nodejs\node.exe" "D:\ATLAS-runtime-supervised-<pin12>-<date>\ops\runtime\cli.mjs" start`, with the task working directory and `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` updated to the new release; then (b) `schtasks /run /tn ATLAS-Runtime-Supervisor`. `ops/runtime/cli.mjs` is then the resident parent that owns the 5001 (`server.js`) and 5174 (`host.mjs`) children |
| `rollbackLaunchOwner` | The same registered task `\ATLAS-Runtime-Supervisor` |
| `rollbackLaunchMechanism` | Symmetric re-point of the same task back to `54dce67b` at `D:\ATLAS-runtime-supervised-54dce67b-20260914`, `schtasks /run /tn ATLAS-Runtime-Supervisor`, then the same health/ready/host/Tailnet proof; failing that, the supervised `9d293879` at `D:\ATLAS-runtime-supervised-20260912`. `d44f29e0` at `D:\ATLAS-runtime-fallback-d44-20260912` is a **manual, non-supervised** last resort and is not a durable launch mechanism |

**Forbidden launch mechanism.** Starting the long-lived runtime as a child of the
executor's agent command, terminal, or a temporary wrapper is prohibited, as is
any `Start-Process`/foreground `node` invocation that leaves the resident process
parented to the executor shell. If the task cannot be re-pointed and run, the
action stops and reports the blocker rather than substituting an attached
process.

**Acceptance obligation added by this subsection.** Beyond the §5 rows, the
execution evidence must prove that the **task-launched** resident process — not an
executor-started one — owns the 5001 and 5174 children and listeners, and that it
remains healthy **after the invoking executor shell exits**.

## 5. Acceptance matrix

| # | Row | Pass condition |
|---|---|---|
| 1 | Release identity | supervisor status + installed HEAD equal the pin |
| 2 | Listeners | exactly one owner per port (5001, 5174) |
| 3 | Health | local health + ready (`database: ok`), host live/ready, Tailnet health all 200 |
| 4 | Rollover automation | `ROLLOVER_AUTO_SYNC_ENABLED=false` |
| 5 | Env change | `ATLAS_DEFAULT_SCHOOL_ID` absent; every companion-SSO key the returned sentence authorizes is present (**key names only — values are never printed**); all other keys unchanged against the §3.2 set |
| 6 | Anonymous class-template read | `GET /api/v1/class-templates` and `/:id` → 401 with `class_templates` row-count delta 0. **Sequencing:** §1 currently forbids probing this route pre-fix, so this row runs only after row 1 confirms the pin is live |
| 7 | False authority blocker removed | `GET /api/v1/generation/1/9/readiness/diagnostic` (authenticated privileged session, zero-write) emits ZERO `TERM_AUTHORITY_STALE`, and no returned blocker is an authority blocker. A `CANONICAL_TEMPLATE_INCOMPLETE` blocker IS EXPECTED here per §5.1 and does not fail this row |
| 8 | Published-revision immutability | the frozen-revision read path resolves the persisted revision authority rather than the live tables; with zero `PublishedScheduleRevision` rows the probe returns its defined typed empty result and does not fall back to live tables. The executor names the exact probe and expected typed result in the preflight evidence |
| 9 | Actor scope | `/api/v1/runtime/context` matrix returns the authenticated actor's school; no fail-open default |
| 10 | Login footprint | exactly one `LOCAL_LOGIN_SUCCESS` row + that actor's `last_login_at`; both named in advance |
| 11 | Session cleanup | logout → `/api/v1/auth/me` 401 `NO_TOKEN`; custody owner named |
| 12 | Rollback startable | rollback release proven startable (not executed unless row 2–4 fail) |
| 13 | Zero data mutation | all other recorded signatures delta 0 |

Row 7 is the failing-first anchor: the same request against `54dce67b` returns
the false authority blocker.

### 5.1 Acceptance caveat — this is NOT a readiness pass (recorded per operator instruction)

Immediately after this cutover the live catalog expects the NEW
`classProgramSlot` grid while the database still holds the retired grid, because
`G9G10-FLAG-SOURCE-LANE` is integrated in the deployed code but
`DATA-CORRECTION-C01` has not yet reseeded the live rows. Canonical generation
therefore fails closed with `CANONICAL_TEMPLATE_INCOMPLETE` until that reseed
happens, and no generation may be attempted in between. This deployment's
acceptance is its own 13 numbered rows — release identity, one listener per port,
health/ready/host/Tailnet, the anonymous class-template 401 with row-count delta
0, the SSO key names present, published-revision immutability, the actor-scope
matrix, the login footprint, session cleanup, rollback startability, and zero
data mutation. Those 13 rows are the *numbered* matrix; the two launch-ownership
obligations added in §4.1 (the task-launched resident owns 5001/5174, and it
stays healthy after the invoking executor shell exits) are equally mandatory and
are verified as part of row 2. It is explicitly **not** a full generation-readiness pass;
`CANONICAL_TEMPLATE_INCOMPLETE` is reported truthfully rather than suppressed or
counted as a failure.

### 5.2 Authentication budget per row (satisfiability)

- **Row 7 uses the SAME single authorized authenticated session as rows 9-11.**
  A system token does NOT authenticate this route: at the pin,
  `atlas-server/src/routes/generation.router.ts:3` imports only `authenticate`,
  and `atlas-server/src/middleware/authenticate.ts:176-191` verifies only a JWT -
  it never reaches `isSystemTokenMatch` (`:74`), which is reachable solely through
  `authenticateWithSystemToken` (`:135`). A `Bearer` `ATLAS_SYSTEM_TOKEN` on this
  route returns `401 INVALID_TOKEN`. An earlier revision of this packet mis-cited
  `authenticateWithSystemToken` plus `requirePrivilegedRole` at
  `generation.router.ts:142`; that mechanism belongs to a different router, and
  the same code shape holds at this packet's own base `43341ac7`, so this was a
  mis-citation rather than drift. The route remains zero-write.
- Rows 7, 9, 10, and 11 share the single authorized login: row 7 the
  `/api/v1/generation/1/9/readiness/diagnostic` zero-write read, row 9 the
  `/api/v1/runtime/context` actor-school matrix, row 10 the
  `LOCAL_LOGIN_SUCCESS` plus `last_login_at` delta, row 11 logout and
  `/api/v1/auth/me` 401 `NO_TOKEN`. The whole action still produces **exactly
  one** login footprint - one `LOCAL_LOGIN_SUCCESS` row plus that actor's
  `last_login_at`. One login, one named custody owner, cleaned up in row 11.
- Rows 1-6, 8, 12, and 13 are unauthenticated, read-only, or local process and
  file checks.

**Probe-method note (recorded so it is not re-litigated).** A `GET` on the SSO
routes returns `404` because they are `POST`-only (`auth.router.ts:109,150`), while
an unauthenticated `POST` returns `401`. Confirm route *mounting* with the correct
method — verified 2026-09-17: unauth `POST /api/v1/auth/sso/authorize` → `401` and
`POST /api/v1/auth/sso/exchange` → `401`, so §3.1's "401, not 404" claim holds for
the real method. Separately, `cli.mjs status` reports `live: false` for both
targets from a stale persisted health snapshot (`updatedAt` 2026-09-15) while
direct probes return `200`; do **not** use that field as liveness evidence — use
rows 2 and 3.

## 6. Boundaries

No data mutation, generation, publication, Teaching Load apply, term-cache apply,
rollover, migration, or companion edit. Companions READ_ONLY. Do not touch port
5175, unrelated processes, Tailscale Serve, or any durable-env key other than the
declared delta in §3.1 and §3.2 (one removal, plus the four SSO additions only
when the returned sentence authorizes that clause).

## 7. Return contract

Pin, install directory, task action/working-directory diff, env key-name
before/after plus checksums and the SSO key-name presence proof (names only, never
values), the provisioning file's final disposition, PID/listener before and after,
health results, the 13-row acceptance matrix with the login delta and the
`TERM_AUTHORITY_STALE` row plus the truthful `CANONICAL_TEMPLATE_INCOMPLETE`
statement required by §5.1, rollback proof, worktree disposition, running/awaited
roles, push status, single next action, safe parallel work, locked successors.

## 8. Approval (to be returned only after the fresh pre-action review passes)

> "I approve CONSOLIDATED-DEPLOYMENT-C10 exactly as reviewed: build and install a
> release pinned at `<PIN40>`, including the alternate-port preflight smoke and
> the rollback startability proof, with the non-secret client build input
> `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`; remove the vestigial
> `ATLAS_DEFAULT_SCHOOL_ID` key from `D:\ATLAS-runtime-config\atlas-server.env`
> and add exactly the four declared companion-SSO keys
> (`ENROLLPRO_SSO_CLIENT_SECRET`, `ATLAS_SSO_REVERSE_CLIENT_SECRET`,
> `ENROLLPRO_SSO_CALLBACK_URL`, `ENROLLPRO_BASE_URL`) from the operator-only
> provisioning file `<PROVISIONING_PATH>`, using the rotated out-of-band values
> only, and deleting that provisioning file after the env change is verified;
> re-point and restart the `\ATLAS-Runtime-Supervisor` task on the
> supervisor-owned ports 5001/5174; and run the 13-row acceptance matrix with
> exactly one authorized login (`LOCAL_LOGIN_SUCCESS` + `last_login_at` delta
> named in advance) followed by logout. No data mutation, generation,
> publication, Teaching Load apply, term-cache apply, rollover, migration, or
> companion change is approved. Rollback to `54dce67b` (then `9d293879`) is
> pre-authorized only if a mandatory acceptance row fails."

Two substitutions are required: the literal `<PIN40>` and the actual
`<PROVISIONING_PATH>`.

**Drop variant (when the SSO clause is not executable).** If the rotated paired
values are not available out of band before execution, the operator returns the
sentence with the entire SSO clause removed — from "and add exactly the four
declared companion-SSO keys" through "after the env change is verified" —
leaving the `ATLAS_DEFAULT_SCHOOL_ID` removal as the only env change. Row 5 is
then scored against the 13-key set in §3.2, and the four keys become a separate
HIGH env action. Do not deploy the leaked pre-rotation values under any wording.

## 9. Registration annex

Register only after `WF-TRANSITION-TERMINAL-RECONCILE-C09` releases its register
window and after `WF-C10-TRANSITION-GUARD-HARDENING` integrates. **Both are now
satisfied** (`WF-TRANSITION-TERMINAL-RECONCILE-C09` `COMPLETE`,
`WF-C10-TRANSITION-GUARD-HARDENING` `COMPLETE`). This packet is
hash-pinned by `record-approval`, so record its pin as
`blob <git-sha1> + LF-SHA-256 <hash> + the exact reproducing command` (never a
working-copy-only hash; `docs/prompts/**` is LF-forced at checkout by the
2026-09-17 decisions commit). Registration uses the atomic-lease form: a
`PLANNED` record may not hold an `ACTIVE` lease (`PLANNED_WITH_LIVE_LEASE`),
`lease-update` never changes a stream's state, and `create-stream` refuses lease
flags unless the spec's state is `RUNNING`. So register at dispatch time with a
`RUNNING` spec and one atomic

```
node ops/workflow/transition.mjs --transition create-stream \
  --state docs/plans/atlas-delivery-cycles.json --expect-revision <R> \
  --stream-spec ops/workflow/specs/register/CONSOLIDATED-DEPLOYMENT-C10.json \
  --packet-path docs/prompts/consolidated-deployment-c10-2026-09-17.md \
  --observed-origin-main <origin/main tip> \
  --lease-id lease-consolidated-deployment-c10 --lease-role executor \
  --by primary-planner:consolidated-deployment-c10-registration
```

**Register only; do NOT run `coordination-update`.** `coordination.activeCycleId`
is single-valued and is already held by the concurrent RUNNING peer
`ROLLOVER-GRADED-AUTONOMY-C01` (registered at revision 310 with an `ACTIVE`
executor lease). The workflow contract is explicit: the first claimant keeps the
pointer and every additional concurrent cycle is represented by its own stream
row, not by stealing `coordination-update`. This stream is therefore represented
by its row and its `ACTIVE` lease. Declare **no** register window: a reservation
is only correct when its holder is the sole active register writer, and two peer
cycles are running. Re-read `registry.revision` immediately before every
transition — it was 314 at dispatch and the peer is pushing concurrently — never
guess a revision, and never hand-edit the register.

Then `record-approval` with the reviewed packet pin, and `record-execution` after
the action.
