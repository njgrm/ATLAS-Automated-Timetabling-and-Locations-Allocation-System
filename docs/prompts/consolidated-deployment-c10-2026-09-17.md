# CONSOLIDATED-DEPLOYMENT-C10 — HIGH shared-runtime deployment packet

Status: authored 2026-09-17 (Asia/Manila). Prepared, NOT approved and NOT
executable until every prerequisite below is satisfied and the exact approval
sentence is returned by the operator after a fresh independent pre-action review.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.
- Base: re-verify at dispatch. Placeholder base recorded at authoring:
  `f4ff7c8a8e5f058438af38e0c0684cb3ee394bef`.
- Target pin: the `origin/main` tip AFTER `MIG-APPLY-0002-0003` has applied and
  AFTER `SLOT-BREAK-AUTHORITY-C11` (and `WF-C10-TRANSITION-GUARD-HARDENING`,
  needed only so this gate can be recorded truthfully) have integrated. Refresh
  and report the base if it moved; do not pin a non-existent tip.
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
| Durable env | `D:\ATLAS-runtime-config\atlas-server.env` (+ `backups\` sibling), 13 keys |
| Disk | C: 20.22 GiB, D: 31.28 GiB, E: ~73 GiB free — above floors |

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
  (if not already implied by `ENROLLPRO_API`). Optionally, for the client build,
  `VITE_ENROLLPRO_SSO_START_URL` as an explicit reverse-start override.
  **Never invent, print, or log a secret value.** Record only key names and a checksum of the file.
  This amendment is DROPPED (and the SSO keys become a separate HIGH env action) if the paired
  values are not available at approval time — say so in the approval rather than deploying a
  half-configured integration.
- Leave port 5175, unrelated processes, Tailscale Serve, and every other key
  untouched.

## 4. Execution shape (no impossible zero-downtime claims)

1. Record the incumbent identity (task fields, PIDs, listeners, health, env-file
   hash) into the execution evidence.
2. Build `atlas-server` (with explicit `.js` ESM runtime-import proof) and
   `atlas-client` (with the EnrollPro origin) at the pinned SHA; install to
   `D:\ATLAS-runtime-supervised-<pin12>-<date>`.
3. Explicitly stop ONLY the supervisor-owned processes.
4. Apply the declared env change (remove `ATLAS_DEFAULT_SCHOOL_ID`), recording
   the before/after key-name set and a checksum, never printing values.
5. Start via the registered task: `schtasks /run /tn ATLAS-Runtime-Supervisor`,
   after re-pointing the task action + working directory and
   `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` to the new release.
6. Health/ready/host/Tailnet checks. On any mandatory failure, perform the
   symmetric rollback and prove startup.

Rollback: symmetric re-point + relaunch to `54dce67b`, then the supervised
`9d293879` (`D:\ATLAS-runtime-supervised-20260912`); the non-supervised
`d44f29e0` fallback at `D:\ATLAS-runtime-fallback-d44-20260912` remains a manual
last resort only.

## 5. Acceptance matrix

| # | Row | Pass condition |
|---|---|---|
| 1 | Release identity | supervisor status + installed HEAD equal the pin |
| 2 | Listeners | exactly one owner per port (5001, 5174) |
| 3 | Health | local health + ready (`database: ok`), host live/ready, Tailnet health all 200 |
| 4 | Rollover automation | `ROLLOVER_AUTO_SYNC_ENABLED=false` |
| 5 | Env change | `ATLAS_DEFAULT_SCHOOL_ID` absent; the companion-SSO keys present (**key names only — values are never printed**); all other keys unchanged |
| 6 | Anonymous class-template read | `GET /api/v1/class-templates` and `/:id` → 401 with `class_templates` row-count delta 0 |
| 7 | False authority blocker removed | school 1 / year 9 generation preflight emits ZERO `TERM_AUTHORITY_STALE`; row 4 no longer reports an authority blocker (truthful soft/hard blockers may remain) |
| 8 | Published-revision immutability | spot check resolves frozen identity, not live tables |
| 9 | Actor scope | `/api/v1/runtime/context` matrix returns the authenticated actor's school; no fail-open default |
| 10 | Login footprint | exactly one `LOCAL_LOGIN_SUCCESS` row + that actor's `last_login_at`; both named in advance |
| 11 | Session cleanup | logout → `/api/v1/auth/me` 401 `NO_TOKEN`; custody owner named |
| 12 | Rollback startable | rollback release proven startable (not executed unless row 2–4 fail) |
| 13 | Zero data mutation | all other recorded signatures delta 0 |

Row 7 is the failing-first anchor: the same request against `54dce67b` returns
the false authority blocker.

## 6. Boundaries

No data mutation, generation, publication, Teaching Load apply, term-cache apply,
rollover, migration, or companion edit. Companions READ_ONLY. Do not touch port
5175, unrelated processes, Tailscale Serve, or any env key other than the one
declared in §3.1.

## 7. Return contract

Pin, install directory, task action/working-directory diff, env key-name
before/after plus checksum, PID/listener before and after, health results, the
13-row acceptance matrix with the login delta and the `TERM_AUTHORITY_STALE` row,
rollback proof, worktree disposition, running/awaited roles, push status, single
next action, safe parallel work, locked successors.

## 8. Approval (to be returned only after the fresh pre-action review passes)

> "I approve CONSOLIDATED-DEPLOYMENT-C10 exactly as reviewed: build and install a
> release pinned at `<PIN40>`, remove the vestigial `ATLAS_DEFAULT_SCHOOL_ID` key
> from `D:\ATLAS-runtime-config\atlas-server.env`, re-point and restart the
> `\ATLAS-Runtime-Supervisor` task on the supervisor-owned ports 5001/5174, and
> run the 13-row acceptance matrix with exactly one authorized login
> (`LOCAL_LOGIN_SUCCESS` + `last_login_at` delta named in advance) followed by
> logout. No data mutation, generation, publication, Teaching Load apply,
> term-cache apply, rollover, migration, or companion change is approved.
> Rollback to `54dce67b` (then `9d293879`) is pre-authorized only if a mandatory
> acceptance row fails."

## 9. Registration annex

Register only after `WF-TRANSITION-TERMINAL-RECONCILE-C09` releases its register
window and after `WF-C10-TRANSITION-GUARD-HARDENING` integrates. This packet is
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
  --observed-origin-main <origin/main tip> \
  --lease-id lease-consolidated-deployment-c10 --lease-role executor \
  --by primary-planner:consolidated-deployment-c10-registration
```

followed by `coordination-update --mode CYCLE_ACTIVE --active-cycle-id
CONSOLIDATED-DEPLOYMENT-C10 --by primary-planner:consolidated-deployment-c10-registration`,
then `record-approval` with the reviewed packet pin, then `record-execution`
after the action. Re-read `registry.revision` before every transition; never
guess a revision; never hand-edit the register.
