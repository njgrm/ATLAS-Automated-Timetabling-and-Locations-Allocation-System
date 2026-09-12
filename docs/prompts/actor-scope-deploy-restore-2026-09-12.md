# ACTOR-SCOPE-DEPLOY-RESTORE-2026-09-12 — HIGH Deploy-as-Restore and Acceptance Packet

**Status: PREPARED — NOT APPROVED.** No process may be started and no acceptance
login may be attempted until the operator returns the exact approval sentence in
section 9, and only against the recorded product pin in section 1.

**Risk:** HIGH — shared-runtime service restoration (ATLAS server 5001 and client
5174), plus one separately authorized acceptance login if no reusable session
exists.

**Supersedes:** `docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md`
(the RR-TERM-CACHE-LIVE-DEPLOY stop-then-start swap). The confirmed outage
invalidated that packet's incumbent-health preflight and its
rollback-to-the-incumbent assumptions; it is not executable under the current
precondition and must not be reused with swap wording.

**Prepared:** 2026-09-12 (Asia/Manila) by the primary planner.

## 0. Confirmed starting condition (verified before preparation)

- Tailnet `https://njgrm.buru-degree.ts.net` returns **502**.
- **No listener exists on 5001 or 5174.**
- The recorded W1 processes (server PID 11564, client PID 6756) are absent;
  machine boot (2026-09-11 20:58) predates the W1 deploy, so this is a
  post-deploy stop/crash, not a reboot.

**Mandatory immediate pre-execution re-verification (read-only):**

```powershell
Get-NetTCPConnection -LocalPort 5001,5174 -ErrorAction SilentlyContinue
```

If ANY listener appears on 5001 or 5174, **STOP and return for replanning**.
Never stop, replace, or treat an unknown listener as an incumbent; this packet
has no incumbent.

## 1. Target identity

- **Product target SHA:** `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` — the
  integration merge of the QA-accepted candidate `98ab5e04` onto `a4dcd061`.
  The primary planner verified the merged product tree is byte-identical to the
  reviewed candidate (`git diff 98ab5e04 d44f29e0 -- atlas-client atlas-server`
  is empty). Any docs-only commit above the pin shares this exact product tree;
  deployment identity is the product tree at the pin.
  - **Reviewed candidate:** branch `work/actor-scope-c01`, base
    `a4dcd0613ff807f8b76b55d184742c090701328e`, candidate tip
    `98ab5e04a22c67b2e09801010adeb4485df4655d`. Fresh independent QA:
    `ACCEPT_READY` — mandatory 18/18, blocked 0, unperformed 0, with two
    independent mutant controls.
- **Fallback artifact (last accepted live deployment):**
  `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22` (W1-RUNTIME-DEPLOY product).
  Product tree available from `D:/ATLAS-worktrees/w1-runtime-deploy`
  (`1ead5622`, docs-only above the pin — verified) and
  `D:/ATLAS-worktrees/integration-tlrr01r-20260911` (checked out at
  `fdd0c8c7`). Build and start it with the same procedure below if the new
  target fails.
- **Database target (sanitized):** local PostgreSQL at `localhost:5432`,
  database `atlas_recovery_clean_rebuild_20260905` (as recorded for the W1
  runtime). Re-verify read-only at execution time; never print credentials.
- **Environment source:** the operator-maintained `atlas-server/.env` (present
  at `D:/ATLAS-worktrees/integration-rrtc01r-20260912/atlas-server/.env` on this
  machine; never committed, never printed). The W1 worktree env files were
  removed at cleanup, so the executor must re-resolve the env source at
  preflight, record the sanitized DB target, and label the deployment
  `EPHEMERAL_DEPLOYMENT` if the runtime still depends on a transient env file
  or an unmanaged process.

## 2. Exact process boundary

Start ONLY the two ATLAS listeners (the runtime is currently down):

- ATLAS server on **5001**
- ATLAS client on **5174**

Do not stop, start, restart, or reconfigure PostgreSQL, EnrollPro/SMART/AIMS,
Tailscale/serve, or any other process. No other port is part of this action.
Rollover automation must be disabled: `ROLLOVER_AUTO_SYNC_ENABLED=false`.

**There is no incumbent.** This is service restoration after an outage, not a
swap. Do not claim, describe, or imply a stop-then-start swap, zero-downtime, or
a planned listener interruption.

## 3. Deploy-as-restore steps (for the eventual HIGH executor)

1. **Preflight (read-only).** Re-run the 5001/5174 emptiness check (section 0).
   Record Tailnet 502, the resolved env source, the sanitized database target,
   and every BEFORE signature in section 6. If any listener appeared, STOP.
2. **Build and stage first — no listener is touched (the outage continues).**
   Create a fresh clean worktree from the recorded pin; verify `git rev-parse
   HEAD` and a clean tree. Provision `npm ci` (root, `--prefix atlas-server`,
   `--prefix atlas-client`); from `atlas-server` run
   `npx prisma generate --schema ..\prisma\schema.prisma`; copy the deployment
   environment (never commit/print it); build server (`npm run build`) and
   client (`npm run build`).
3. **Start the new server on 5001.** From `atlas-server`:
   `node dist/server.js` with process env `ROLLOVER_AUTO_SYNC_ENABLED=false`
   plus the resolved environment. Require ALL of:
   - exactly one listener on 5001 owned by the new PID;
   - log `[ATLAS] Server listening on http://localhost:5001`;
   - log `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`
     once and `[rollover-automation] Starting` zero times;
   - localhost `http://127.0.0.1:5001/api/v1/health` → 200;
   - the process stays alive and healthy for at least 60 seconds.
   **On failure:** stop only the new server PID; the runtime remains down
   (there is nothing to restore); either start the `fdd0c8c7` fallback
   (section 4) or leave the outage in place and report.
4. **Start the new client on 5174.** From `atlas-client` (recorded W1
   procedure): `node node_modules/vite/bin/vite.js --host --port 5174`.
   Require exactly one listener on 5174 and immediately verify Tailnet
   (`/api/v1/health` 200 and `/` 200). **On failure:** stop only the new client
   PID and start the `fdd0c8c7` fallback client; replace the server with the
   fallback only if the failure is attributable to the new server.
5. **Tailnet rendered-origin verification.** `window.location.origin ===
   "https://njgrm.buru-degree.ts.net"` on `/login` at desktop 1366×768 and
   mobile 390×844; record console errors; confirm the served client bundle
   matches the fresh build of the pinned tree.
6. **Record restartability.** Capture the exact launch commands, the env source,
   and the sanitized DB target. If the runtime depends on a transient env file
   or an unmanaged process, label the deployment `EPHEMERAL_DEPLOYMENT` and
   state the exact recovery requirement instead of claiming restart readiness.

## 4. Fallback procedure (startable fdd0c8c7 artifact)

- Build the `fdd0c8c7` product tree from
  `D:/ATLAS-worktrees/w1-runtime-deploy` (docs-only above the pin) or
  `D:/ATLAS-worktrees/integration-tlrr01r-20260911` using the same provisioning
  and build steps as section 3.2.
- Start server and client with the same commands as sections 3.3–3.4, verify
  local and Tailnet health 200, and confirm the mounted interfaces render.
- Record that any acceptance-login audit delta persists and that no other
  mutation occurred. The last accepted artifact remains the operational
  fallback; this packet never destroys it.

## 5. Acceptance (Stage C — bounded, live Tailnet)

Browser-origin invariant: every browser step must execute with
`window.location.origin === "https://njgrm.buru-degree.ts.net"`; record the
exact URL and the assertion. Localhost is invalid evidence.

- **C1 Login:** reuse the persistent Playwright session/profile if one is valid.
  If no reusable session exists, exactly ONE acceptance login is authorized by
  the Manual QA Login Protocol admin credential in `AGENTS.md` (never write the
  password into any artifact). Capture the before/after footprint of that login
  as the only authorized write delta.
- **C2 Actor-school assertion:** read `/auth/me`; record the authenticated user
  and school. Every subsequent request must use that school; a school-1 or
  cross-school dispatch is a FAIL.
- **C3 Read-only rollover status:**
  `GET /api/v1/runtime/rollover-status?schoolId=<actor school>` — record the
  `drift` and `termAuthority` states.
- **C4 Zero-write term-authority preview:**
  `POST /api/v1/runtime/term-authority/preview {schoolId:<actor school>}` —
  expect 200 with ordered terms, revisions, and fingerprint; prove zero writes
  via the section-6 signatures. The preview must be authorized by the browser
  JWT session (a system token must be rejected).
- **C5 Canonical generation readiness diagnostic:**
  `GET /api/v1/generation/<actor school>/<active year>/readiness/diagnostic` —
  record every blocker. `TERM_STRUCTURE_UNAVAILABLE` is expected until the
  separately approved catch-up.
- **C6 UI at 1366×768 and 390×844:** Dashboard and `/admin/year-setup` rollover
  card render truthfully (no school-1 data, no false readiness); capture
  accessibility snapshots/screenshots and console errors; classify the known
  benign 404 noise (`runs/latest`, `room-preferences/.../summary`) as expected.
- **C7 Unauthenticated responsive spot-check:** login page and public schedule
  surfaces at both viewports.
- **C8 ACTOR-SCOPE-C01 regression check (read-only):** confirm the deployed
  client serves the pinned tree and that a same-tab session change on a mounted
  page dispatches no school-1 request for runtime/year/status reads.

**Rollback triggers:** server startup failure or local health not 200 (3.3),
Tailnet health not 200 (3.4), process crash, or an authenticated surface failure
attributable to a stage.

## 6. Before/after database signatures (read-only, sanitized)

Record BEFORE and AFTER using read-only queries (never print credentials):

- `schools` count
- `_prisma_migrations` count
- `enrollProSchoolYearMirror` rows for the actor school: count by
  `isActive`/`isArchived`; active mirror `termContractCachedAt` (null or value)
- `auditLog` count where `action='TERM_CACHE_SYNC_APPLIED'` (actor school)
- user/session/`auditLog` deltas attributable to the authorized login (only if
  a login is performed)
- `facultySubject` count, `generationRun` count, `publishedScheduleRevision`
  count (actor school)

Expected deltas: only the authorized login footprint; zero changes to the
mirror cache, `TERM_CACHE_SYNC_APPLIED` audits, Teaching Load, generation, and
publication rows.

## 7. Mutation exclusions (hard stop)

STOP before: `POST /api/v1/runtime/term-authority/apply`, rollover
sync/apply/archive/reset-dummy-year, Teaching Load mutations, suggestion apply,
generation, publication, schema/migration, and any broad data apply. The ONLY
permitted write in this packet is the single acceptance login (if no reusable
session), disclosed in the before/after signatures.

## 8. Evidence and reporting

- Return `DEPLOYED` with the new live SHA and process identity, or
  `DEPLOYED_ACCEPTANCE_INCOMPLETE` with the exact blocked rows. Never report
  `COMPLETE` while any mandatory row is unperformed.
- Record restartability (`EPHEMERAL_DEPLOYMENT` when applicable).
- No passwords in artifacts; no committed screenshots; no untracked residue in
  `D:\ATLAS`.
- The term-cache catch-up apply remains a separate HIGH action requiring its own
  reviewed preview, independent QA, and explicit approval. This packet
  authorizes neither the apply nor generation nor publication.

## 9. Proposed operator approval sentence (NEW — do not reuse the swap sentence)

> I approve HIGH action ACTOR-SCOPE-DEPLOY-RESTORE-2026-09-12: restore the ATLAS
> shared runtime from the confirmed outage by starting the reviewed product
> tree at `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` (the recorded integration
> pin) as new ATLAS server and client processes on ports 5001 and 5174 only,
> with `ROLLOVER_AUTO_SYNC_ENABLED=false`; verify both ports are still empty
> immediately before starting and stop for replanning if any unknown listener
> appeared; treat the last accepted `fdd0c8c7` build as the startable fallback
> if the new target fails; run the bounded authenticated Tailnet acceptance at
> 1366×768 and 390×844, including at most one recorded acceptance login by the
> Manual QA Login Protocol admin credential if no reusable session exists; keep
> the database read-only apart from that login's disclosed audit delta; and stop
> before term-cache apply, rollover sync, Teaching Load mutation, generation, or
> publication.
