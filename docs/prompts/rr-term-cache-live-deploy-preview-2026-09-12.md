# RR-TERM-CACHE-LIVE-DEPLOY-2026-09-12 — HIGH Deployment and Acceptance Packet

**Status: PREPARED — NOT APPROVED.** No process may be replaced and no acceptance
login may be attempted until the operator returns the exact approval sentence in
section 8.

**Risk:** HIGH — shared-runtime deployment/cutover (ATLAS server 5001 and client
5174), plus one separately authorized acceptance login if no reusable session
exists.

**Prepared:** 2026-09-12 (Asia/Manila) by the primary planner.

## 1. Target identity

- **Product target SHA:** `2e871007806179ac2fa3b0b5e47f158c862330c9`
  (`origin/main` after the RR-TERM-CACHE-C01R integration, verified remote at
  preparation time).
  - Integration merge: `a1256506` (candidate `86376ba7` onto base `904818d4`).
  - Accepted candidate: `86376ba7a63cffa2b19ee8f1e97bbe953dbdd9f1`
    (`fix(rollover): close term-authority scope and active-year gaps`).
  - Fresh independent QA: `ACCEPT_READY` — mandatory 17/17, blocked 0,
    unperformed 0.
  - Any packet commit above `2e871007` is docs-only and shares this exact
    product tree; deployment identity is `2e871007`.
- **Expected current live SHA:** `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22`
  (W1-RUNTIME-DEPLOY). Last recorded processes: server PID 11564 + client
  PID 6756 from `D:/ATLAS-worktrees/w1-runtime-deploy`. Re-verify the live
  identity and PIDs immediately before replacement; do not assume PIDs.
- **Expected database target (sanitized):** local PostgreSQL at
  `localhost:5432`, database `atlas_recovery_clean_rebuild_20260905` (as
  recorded in the local worktree environment used by the current runtime).
  Re-verify read-only at execution time; never print credentials.

## 2. Exact process boundary

Replace ONLY the two ATLAS listeners:

- ATLAS server on **5001**
- ATLAS client on **5174**

Do not stop, restart, or reconfigure PostgreSQL, EnrollPro/SMART/AIMS,
Tailscale, or any other process. No other port is part of this action.
Rollover automation must remain disabled: `ROLLOVER_AUTO_SYNC_ENABLED=false`.

## 3. Deployment steps (for the eventual HIGH executor)

1. **Preflight (read-only):** record the current live SHA/processes, Tailnet
   health 200, the sanitized database target, `schools` count,
   `_prisma_migrations` count, and every signature in section 6 (BEFORE).
2. Create a fresh clean worktree from `origin/main` at the packet commit (e.g.
   `D:/ATLAS-worktrees/rr-term-cache-live-deploy-20260912`); verify
   `git rev-parse HEAD` matches the reviewed commit and the tree is clean.
3. Provision: `npm ci` at root, `npm ci --prefix atlas-server`,
   `npm ci --prefix atlas-client`; from `atlas-server` run
   `npx prisma generate --schema ..\prisma\schema.prisma`; copy the deployment
   environment from the recorded live worktree (never commit it); build server
   (`npm run build`) and client (`npm run build`).
4. Start the new server on 5001 and new client on 5174 with
   `ROLLOVER_AUTO_SYNC_ENABLED=false`; confirm the
   `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` log
   line and local health 200.
5. Swap processes: stop the previous server/client only after the new listeners
   are healthy (or a brief sequential swap with a health check between steps).
6. Post-swap: Tailnet health 200; confirm the served product identity; confirm
   rollover automation remains disabled.
7. Record restartability: the exact launch procedure and environment source. If
   the runtime depends on a transient env file or an unmanaged process, label
   the deployment `EPHEMERAL_DEPLOYMENT` and give the exact recovery
   requirement instead of claiming restart readiness.

## 4. Acceptance (Stage C — authenticated, live Tailnet)

Browser-origin invariant: every browser step must execute with
`window.location.origin === "https://njgrm.buru-degree.ts.net"`; record the
exact URL and the assertion. Localhost is invalid evidence.

- **C1 Login:** reuse the persistent Playwright session/profile if one is valid.
  If no reusable session exists, exactly ONE acceptance login is authorized by
  the Manual QA Login Protocol admin credential in `AGENTS.md` (never write the
  password into any artifact). Capture the before/after footprint of that login
  as the only authorized write delta.
- **C2 Actor-school assertion:** read `/auth/me`; record the authenticated user
  and school. Every subsequent request must use that school. A school-1 or
  cross-school dispatch is a FAIL.
- **C3 Read-only rollover status:**
  `GET /api/v1/runtime/rollover-status?schoolId=<actor school>` — record the
  `drift` and `termAuthority` states.
- **C4 Zero-write term-authority preview:**
  `POST /api/v1/runtime/term-authority/preview {schoolId:<actor school>}` —
  expect 200 with ordered terms, revisions, fingerprint. Prove zero writes via
  the section-6 signatures (mirror cache and `TERM_CACHE_SYNC_APPLIED` audit
  unchanged). The preview must be authorized by the browser JWT session; a
  system token must be rejected.
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

**Rollback triggers:** Tailnet health not 200, process crash, or an
authenticated surface failure attributable to the swap.

**Rollback procedure:** stop only the two new processes; restart the previous
accepted artifact `fdd0c8c7` from the recorded deployment worktree and launch
procedure; verify health 200; record that any login audit delta persists and
that no other mutation occurred.

## 5. Mutation exclusions (hard stop)

STOP before: `POST /api/v1/runtime/term-authority/apply`, rollover sync/archive,
Teaching Load mutations, suggestion apply, generation, publication,
schema/migration, and any broad data apply. The ONLY permitted write in this
packet is the single acceptance login (if no reusable session), disclosed in the
before/after signatures.

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

## 7. Evidence and reporting

- Return `DEPLOYED` with the new live SHA and process identity, or
  `DEPLOYED_ACCEPTANCE_INCOMPLETE` with the exact blocked rows. Never report
  `COMPLETE` while any mandatory row is unperformed.
- No passwords in artifacts; no committed screenshots; no untracked residue in
  `D:\ATLAS`.
- The term-cache catch-up apply remains a separate HIGH action requiring its own
  reviewed preview, independent QA, and explicit approval. This packet authorizes
  neither the apply nor generation nor publication.

## 8. Proposed operator approval sentence

> I approve HIGH action RR-TERM-CACHE-LIVE-DEPLOY-2026-09-12: deploy product
> `2e871007806179ac2fa3b0b5e47f158c862330c9` to ATLAS server/client processes
> 5001 and 5174 only; keep rollover automation disabled; run the bounded
> authenticated Tailnet Stage C acceptance at 1366×768 and 390×844, including at
> most one recorded acceptance login by the Manual QA Login Protocol admin
> credential if no reusable session exists; keep the database read-only apart
> from that login's disclosed audit delta; and stop before term-cache apply,
> generation, or publication.
