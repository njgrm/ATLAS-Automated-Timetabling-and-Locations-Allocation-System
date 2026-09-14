# COMPANION-SSO-LIVE-PREP-C02 — EnrollPro ↔ ATLAS activation readiness and HIGH packet preparation

`CYCLE ON: COMPANION-SSO-LIVE-PREP-C02`

## Role and terminal objective

Act as `atlas-planner` and run one complete, bounded preparation cycle. Use the
repository-owned workflow roles: delegate evidence gathering to an
`atlas-executor`, freeze its docs candidate, commission a fresh `atlas-qa`
review of that immutable range, correct any blocking findings through the same
planner, and commission `atlas-wave-auditor` before closure.

This is **preparation only**. End with reviewed, copy-ready HIGH packets for the
remaining live work. Do not perform a live migration, configure a secret,
deploy or restart ATLAS, log in, initiate or exchange an SSO code, or mutate an
ATLAS or companion database.

Return a terminal report to the head planner. Do not stop merely because a
companion contract mismatch is found: document it, produce the bounded
developer handoff or packet that resolves it, and complete every other safe
preparation row.

## Immutable starting context

- Prompt-authoring base: `origin/main` at
  `234046f80effa5b963295bb27f83a90020b4f544`.
- Minimum required ATLAS ancestor: COMPANION-SSO-C01 integration merge
  `c989f03d` (candidate correction `fbb9dc6367fc9a20372e4a71d908f6a9d81a5411`).
- COMPANION-SSO-C01 is source-integrated and wave-audited, but not deployed or
  live-configured.
- Directive authority at prompt authoring:
  `origin/main:AGENTS.md`, LF-normalized SHA-256
  `0cf68d62d9c6c6bb37b737c6038118a8eed7efc2d403a2100de9d64f02c871d6`.
- Preparation worktrees belong under `E:/ATLAS-worktrees/`; do not create new
  worktrees on `D:`. Check free space before creation and again before any
  disposable PostgreSQL rehearsal.
- Shared runtime currently predates the SSO source. Resolve its actual release,
  supervisor identity, ports, and health at execution time; never trust a PID or
  release copied from an older report.
- Source references:
  - `docs/prompts/companion-sso-c01-2026-09-13.md`
  - `docs/handoffs/companion-sso-c01-executor.md`
  - `docs/reviews/companion-sso-and-term-cache-prep-20260913/wave-completion-audit.md`
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `prisma/migrations/0002_companion_sso_code/migration.sql`
  - `atlas-server/src/routes/auth.router.ts`
  - `atlas-server/src/services/companion-sso.service.ts`
  - `atlas-client/src/lib/companion-config.ts`
  - `atlas-client/src/lib/integrated-systems.ts`

Before dispatch, fetch `origin/main`. If it advanced, use the refreshed tip as
the true base, re-check the required ancestor and changed-path ownership, and
record both the prompt-authoring base and refreshed base. Read the current
`origin/main:AGENTS.md`; if its normalized hash changed, the newer directive
wins and must be recorded in every handoff.

## Companion-repository boundary

`D:/EnrollPro`, `D:/AIMS`, and `D:/smart-final-capstone` are **READ_ONLY
REFERENCE MIRRORS**. Never edit, stage, commit, reset, stash, clean, migrate,
seed, install dependencies, update snapshots, or rewrite their history.

At prompt authoring, the observed clean identities were:

| Mirror | Local HEAD | Remote main observation |
| --- | --- | --- |
| EnrollPro | `5887d685b834db31600be258e96be3bdd0bccacb` | `5887d685b834db31600be258e96be3bdd0bccacb` |
| AIMS | `2332d92ef3395ae65e9a067bd8ef6cce1191940c` | `2332d92ef3395ae65e9a067bd8ef6cce1191940c` |
| SMART | `1bda23399204414f8d21c9fddbdf6b41a8e440d4` | `065600a6ab577e232ffad85824a2930df40cb40c` |

Re-verify cleanliness and remote identity. A clean mirror may be fetched and
fast-forwarded for reference inspection only. If a mirror is dirty or cannot
fast-forward, leave it untouched, record the blocker for that mirror, and use a
fresh read-only clone on `E:` only if needed and disk preflight passes.

## Current product truth that must not be overclaimed

1. ATLAS implements EnrollPro ↔ ATLAS SSO source only. Its Integrated Systems
   area deliberately leaves AIMS, SMART, and MRF disabled. This cycle must not
   claim unified live SSO across all applications.
2. ATLAS production endpoints are:
   - Flow A callback: `GET /api/v1/auth/enrollpro/callback`
   - Flow B browser page: `GET /auth/enrollpro/authorize`
   - Flow B authorize API: `POST /api/v1/auth/sso/authorize`
   - Flow B exchange API: `POST /api/v1/auth/sso/exchange`
   - SPA result page: `GET /auth/sso/callback`
3. ATLAS server configuration names are:
   `ENROLLPRO_BASE_URL`, `ENROLLPRO_SSO_CLIENT_SECRET` (legacy alias
   `ATLAS_SSO_CLIENT_SECRET`), `ENROLLPRO_SSO_CALLBACK_URL`, and
   `ATLAS_SSO_REVERSE_CLIENT_SECRET` (legacy alias
   `ENROLLPRO_REVERSE_CLIENT_SECRET`). Client configuration is
   `VITE_ENROLLPRO_URL` and optional `VITE_ENROLLPRO_SSO_START_URL`.
4. EnrollPro dynamically reads `ATLAS_SSO_CALLBACK_URL`,
   `ATLAS_SSO_CLIENT_SECRET`, `ATLAS_SSO_REVERSE_AUTHORIZE_URL`,
   `ATLAS_SSO_REVERSE_EXCHANGE_URL`, `ATLAS_SSO_REVERSE_CLIENT_ID`, and
   `ATLAS_SSO_REVERSE_CLIENT_SECRET`.
5. The current EnrollPro `.env.example` contains duplicate ATLAS reverse
   examples with inconsistent paths. Treat examples as claims, not authority.
   Verify production source and ATLAS mounts. In particular, do not accept
   `/api/auth/enrollpro/exchange`, `/auth/sso/authorize`, or any other path
   merely because an example documents it.
6. Migration `0002_companion_sso_code` creates the hash-only, single-use
   `companion_sso_codes` table. Its live state must be re-read; older evidence
   that only `0000` and `0001` were applied is not current proof.

## Mandatory preparation work

### A. Git, directive, and source identity

1. Verify the refreshed ATLAS base, COMPANION-SSO-C01 ancestry, exact SSO source
   paths, current directive hash, worktree cleanliness, and available `E:` and
   PostgreSQL-volume free space.
2. Trace the mounted server routes, SPA routes, environment readers, database
   model, migration, AppShell entry point, and existing mounted tests. Evidence
   must distinguish `CURRENT_STATE`, `REQUIREMENT`, `SUCCESSOR`, and
   `HISTORICAL` claims in verdicts, matrices, preserve lists, handoffs, and
   acceptance rows.
3. Re-run the shortest decisive existing SSO server/client suites, both
   TypeScript checks, both production builds, built-server import/startup or
   route-mount proof on an isolated port, and `git diff --check`. Keep relative
   server imports ESM-safe.

### B. Read-only companion contract inspection

4. Inspect the current clean EnrollPro source, not only its guides or
   `.env.example`. Produce an exact two-flow matrix containing:
   initiating system, browser URL, server exchange URL, HTTP method, auth
   mechanism, `client_id`, registered `redirect_uri`, state/cookie behavior,
   allowed roles, active-year fields, one-time-code lifetime, replay behavior,
   expected success writes, and typed failure responses.
5. Compare each EnrollPro-configured ATLAS URL with the real ATLAS production
   mount. A path is `MATCH`, `MISMATCH`, or `UNPROVEN`; visual sidebar presence
   is not proof. Add a mounted or hermetic reachability check where safe.
6. If EnrollPro source/config documentation is wrong, create an ATLAS-owned
   developer handoff under `docs/handoffs/` naming the inspected EnrollPro SHA,
   exact EnrollPro paths/lines, exact ATLAS paths/lines, required corrections,
   negative controls, and acceptance matrix. Do not edit EnrollPro.
7. Inspect current AIMS and SMART sidebar/SSO implementations read-only and
   classify them only for roadmap truth: `IMPLEMENTED_SOURCE`,
   `CONFIGURATION_REQUIRED`, `DEPLOYMENT_REQUIRED`, `CONTRACT_MISMATCH`, or
   `NOT_IMPLEMENTED`. Do not enable their ATLAS rows and do not expand this
   cycle into direct companion-to-companion federation.

### C. Migration and database readiness — zero live writes

8. Read the sanitized live ATLAS database identity and migration/table state.
   Use read-only SQL only. Record whether migration `0002` and
   `companion_sso_codes` are absent, present, or divergent. Capture schema and
   relevant row-count/signature evidence before and after the cycle.
9. On a uniquely named disposable PostgreSQL database:
   - restore or deploy the real migration chain through `0002` using the guarded
     canonical Prisma schema path;
   - prove the table, columns, indexes, FK, defaults, and constraints exactly;
   - run the mounted companion SSO suite;
   - prove replay/idempotent migration status;
   - rehearse the documented rollback and, if required, a clean re-apply;
   - drop the disposable database in `finally` and prove zero residue.
10. Do not apply `0002` to the shared/live database. A migration preview is not
    migration approval.

### D. Configuration and release readiness — names/presence only

11. Inventory required configuration by **key name, owner, purpose, minimum
    shape, and PRESENT/ABSENT status only**. Never print, hash, copy, compare, or
    commit secret values. Reject placeholders and secrets shorter than the
    production minimum without exposing them.
12. Verify exact public origins and route shapes:
    - ATLAS: `https://njgrm.buru-degree.ts.net`
    - EnrollPro browser entry:
      `https://dev-jegs.buru-degree.ts.net/personnel/login`
    - EnrollPro server base: determine from production source/config; never
      substitute a retired raw Tailnet IP, localhost, or an old hostname.
13. Resolve the shared runtime's installed source directory, release SHA,
    supervisor/task identity, durable env-file path, listeners, and rollback
    release read-only. Determine the minimum reviewed ATLAS product SHA that
    contains COMPANION-SSO-C01 and all required runtime infrastructure. Do not
    install or switch it.

### E. Public/browser preflight — no authentication

14. Confirm the Playwright MCP tools exist before declaring browser automation
    unavailable. Browser control is serialized through one named custody lease.
15. Without logging in, capture public/login reachability at both exact Tailnet
    origins, assert `window.location.origin`, and record desktop `1366x768` and
    mobile `390x844` snapshots plus console/network status. A final login page
    is expected and does not prove or disprove protected SSO.
16. Mark protected Flow A/Flow B execution `NOT_AUTHORIZED_IN_PREP`, not passed,
    failed, or externally blocked. Do not use an accidentally reusable session,
    and do not issue an SSO code.

### F. Produce two separate HIGH packets

17. Produce `COMPANION-SSO-MIGRATION-LIVE-C02`, a fingerprinted migration
    preview/apply packet that binds the verified live database, exact migration
    SHA/content, expected DDL only, backup/restore evidence, before/after
    signatures, guarded command, rollback, hard stops, and a copy-ready operator
    approval sentence. It must not authorize configuration, deployment, login,
    code exchange, or companion mutation.
18. Produce `COMPANION-SSO-RUNTIME-ACTIVATION-C02`, dependent on the accepted
    migration result. It must bind:
    - exact reviewed product/release SHA and install directory;
    - exact supervisor-owned 5001/5174 boundary and rollback release;
    - configuration key names and verified cross-system URL matrix;
    - secret creation/delivery procedure that never exposes values;
    - ATLAS and EnrollPro runtime configuration owners;
    - one serialized browser-custody plan covering both directions;
    - exact expected database/audit/session deltas in **both** systems for each
      authorized login, issued code, consumed code, and local session;
    - desktop/mobile AppShell and return-routing checks;
    - wrong role, wrong school/year, expired/replayed code, wrong secret,
      unreachable companion, open-redirect, and logout/session-cleanup checks;
    - post-action independent QA and Wave Completion Audit;
    - rollback for configuration, release, and runtime failure.
19. The activation packet must stop before execution and request explicit HIGH
    approval. It must not bundle AIMS/SMART/MRF activation or claim that their
    disabled ATLAS items are complete.

## Mandatory acceptance tally for this preparation candidate

QA shall report one immutable candidate range and all of these rows:

1. Refreshed Git/directive identity and source ancestry.
2. Complete ATLAS production-route and environment-reader inventory.
3. EnrollPro production-source contract matrix with every URL classified.
4. AIMS/SMART read-only roadmap classification without scope expansion.
5. Existing SSO production-path tests, typechecks, builds, and isolated startup.
6. Read-only live migration/table state and before/after zero-write signatures.
7. Disposable PostgreSQL apply/status/rollback/replay plus zero residue.
8. Secret-safe configuration presence inventory with zero values disclosed.
9. Runtime/release/supervisor/rollback inventory with zero mutation.
10. Tailnet-only public browser preflight, exact origins, two viewports, and
    serialized custody; no login or SSO code.
11. Separate migration HIGH packet is complete and satisfiable.
12. Separate runtime activation HIGH packet is complete, dependency-bound, and
    satisfiable.
13. Any companion defect has an ATLAS-owned developer handoff with exact source
    evidence and no companion edit.
14. Claim classification contains no current-state/successor contradiction.
15. `git diff --check`, changed-path attribution, no secret-like content, and no
    unauthorized product/runtime/database/companion mutation.

`ACCEPT_READY` is invalid unless the tally is exactly `15 / 15 passed / 0
blocked / 0 unperformed`. A safe discovery that live prerequisites are absent
does not excuse an unfinished packet: encode the prerequisite and a fail-closed
preflight into the packet. Use `PLANNER_DECISION_REQUIRED` only for a genuine
product/operator choice that cannot be safely resolved from the governing
contracts.

## Workflow-state and ownership rules

- Use `docs/plans/atlas-delivery-cycles.json` as current-state authority and
  `ops/workflow/transition.mjs` for lifecycle changes. Never hand-edit the
  machine state or historical prose register.
- Before activation, verify the current workflow state and ensure no active
  stream owns the same docs, companion mirror, disposable DB namespace, browser
  profile, runtime inventory, or SSO packet paths. Use leases and exact
  single-writer ownership.
- Checkpoint after source/contract inventory, after disposable rehearsal, after
  packet freeze, and before final QA if context is growing. A harness step limit
  is not permission for the planner to silently implement unfinished executor
  work.
- Shared docs (`CHANGELOG.md`, runtime map, machine state, generated register)
  remain planner/integration-owner surfaces. The executor owns only the prompt's
  declared analysis, handoff, review, and prepared-packet files.
- Do not integrate or push the preparation candidate automatically. Return it
  frozen to the head planner for current-main validation because other workflow
  streams may advance `origin/main` concurrently.

## Forbidden actions

- No live/shared migration, schema mutation, seed, reset, or data write.
- No login, SSO launch, authorization-code issue/exchange/consume, or session
  creation in ATLAS or any companion.
- No secret value display, storage, copy, hashing, logging, or repository write.
- No edit of EnrollPro, AIMS, SMART, MRF, their configs, or Git metadata beyond
  a clean read-only fetch/fast-forward used for reference inspection.
- No shared runtime deploy/restart/stop, task/env edit, port ownership change,
  Tailscale Serve change, generation, publication, Teaching Load mutation, or
  rollover action.
- No localhost browser evidence. Isolated localhost HTTP stubs and built-server
  probes are allowed only when explicitly labeled non-browser test harnesses.
- No merge, rebase, reset, amend, squash, cleanup of another worktree, or push.

## Required return

Return `REVIEW_REQUIRED` with:

- refreshed base, branch/worktree, candidate SHA, directive hash, exact changed
  paths, clean status, and companion SHAs inspected;
- the two-flow URL/contract matrix and AIMS/SMART roadmap classification;
- sanitized live migration state and disposable rehearsal results;
- configuration key presence matrix with no values;
- runtime/release inventory and exact no-mutation proof;
- the complete 15-row executor tally;
- fresh QA verdict/tally and all blocking/non-blocking findings;
- Wave Auditor verdict/tally and any corrective rounds;
- exact paths to the migration packet, activation packet, and any external-dev
  handoff;
- what is running or awaited, one next action, safe parallel work and ownership
  boundaries, locked successors, and integration/push status;
- copy-ready approval sentences labeled **NOT GRANTED**.

Suggested commit message for the eventual frozen preparation candidate:

```text
docs(sso): prepare companion migration and runtime activation gates
```
