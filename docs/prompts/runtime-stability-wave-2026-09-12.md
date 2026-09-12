# RUNTIME-STABILITY-WAVE-2026-09-12

**Status:** PREPARED. The source-only supervision lane may start immediately.
The authenticated acceptance lane remains blocked until the operator supplies
the exact additional-login approval in section 2.

**Current remote base at preparation:** `23c85ae69515df26061a7334c0c971b91460f4c6`.
Refresh `origin/main` before dispatch and record any newer base. Do not use the
dirty `D:/ATLAS` checkout as an execution or integration boundary.

## 1. Objective and topology

Run two bounded lanes in parallel:

1. Close the authenticated acceptance of the already restored product pin
   `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` without changing that runtime.
2. Implement and independently review a durable ATLAS runtime-supervision
   contract using fake children or isolated ports only. Live installation is a
   later, separately reviewed `HIGH` action.

The primary planner owns integration, the living register, successor unlocks,
and the Wave Completion Audit. Executors and QA do not merge or push.

## 2. Missing authority for Lane A

The following sentence must be supplied by the operator in the active ATLAS
Planner chat before Lane A starts. It is a grant, not text that an agent may
self-authorize:

> I approve one additional recorded acceptance login for ACTOR-SCOPE-DEPLOY-RESTORE-2026-09-12: authorize the fresh independent QA delegate to perform exactly one login with the Manual QA Login Protocol admin credential against `https://njgrm.buru-degree.ts.net` to re-verify Stage C rows C2, C3, C4-positive, C5, C6, and C8 on the live runtime, with the expected database delta limited to one `LOCAL_LOGIN_SUCCESS` audit row (id > 761) and the actor's `last_login_at`, and no other mutation; then integrate the accepted evidence and run the Wave Completion Audit.

Do not substitute a waiver unless the operator explicitly chooses incomplete
acceptance. The fresh QA role owns the sole additional login and all six
authenticated rows; no executor may consume it. Do not enable Remember Me,
export/copy a JWT, or persist credentials.

## 3. Lane A — authenticated acceptance closure

**Role:** fresh independent QA delegate.

**Review range:**
`d44f29e04d359ad9b18e4443b0fd4fed1daeaecd...534832bc7244d0f1128d31960fb0298fe7804fb1`
in `D:/ATLAS-worktrees/actor-scope-deploy-restore-20260912`.

Re-verify the complete corrected docs-only range and current live identity.
Then perform exactly one approved login and independently execute C2, C3,
C4-positive, C5, C6, and C8 at both `1366x768` and `390x844` where applicable.
Every browser row must assert
`window.location.origin === "https://njgrm.buru-degree.ts.net"`.

Before and after, prove that the only database delta is one
`LOCAL_LOGIN_SUCCESS` audit row with id greater than 761 plus the same actor's
`last_login_at`. Do not call term-authority apply, rollover sync/apply,
Teaching Load mutation, generation, publication, migration, or schema tools.
Do not stop, restart, or replace ports 5001/5174. Return one formal verdict and
the exact mandatory passed/blocked/unperformed tally.

If QA returns `ACCEPT_READY`, the planner shall integrate the evidence from a
clean integration worktree, push, and reconcile every occurrence of the stream
in the living register to one identical state. The planner then runs the fresh
Wave Completion Auditor required for actor authority and a shared-runtime HIGH
cycle. The auditor does not log in; it reuses the accepted QA evidence.

## 4. Lane B — RUNTIME-SUPERVISION-C01 source/test

**Role:** executor, followed by one fresh independent QA delegate.

Create:

- worktree `D:/ATLAS-worktrees/runtime-supervision-c01`
- branch `work/runtime-supervision-c01`
- base: refreshed `origin/main`

### Required outcome

Implement a repository-owned, testable supervision and production-hosting
contract that can later be installed on this Windows host. It shall provide:

1. an immutable reviewed product/release pin and a durable operator-owned
   environment-path reference without copying or printing secrets;
2. exactly one owner for server 5001 and client 5174, with unknown-listener
   rejection and no broad process killing;
3. a reviewed production static host/proxy for the built `atlas-client/dist`
   artifact—never Vite dev/HMR as the durable runtime—with SPA fallback and
   parity for `/api`, `/uploads`, `/enrollpro-api`, `/enrollpro-uploads`, SSE,
   and WebSocket upgrade behavior;
4. boot/start recovery plus bounded restart/backoff after an unexpected child
   exit, duplicate-instance prevention, and a healthy-process survival gate;
5. separate liveness and dependency-readiness checks; the current constant
   `/api/v1/health` response alone is insufficient;
6. `ROLLOVER_AUTO_SYNC_ENABLED=false` as a pinned runtime invariant;
7. durable bounded logs with timestamps and deterministic status output;
8. clean server termination after an uncaught exception once supervision is
   active, so the supervisor replaces a potentially corrupted process;
9. reversible start/stop/status/install-preview/uninstall-preview/rollback
   operations; and
10. read-only inventory and explicit supersession handling for the legacy
    `ATLAS-DevServer-Temp2` task. Source work must not modify that task.

Prefer repository source under `ops/runtime/**` plus the smallest necessary
server/client/package/test changes. Keep controllers transport-only and server
runtime imports ESM-safe. Do not embed machine usernames, passwords, database
URLs, worktree-only env paths, or a school id.

### Mandatory proofs

- failing-first controls for duplicate ownership, unknown listener, child
  crash/restart/backoff, stale/mismatched pin, missing environment reference,
  failed dependency readiness, disabled rollover invariant, log bounds, and
  rollback;
- production-host tests for deep-link SPA fallback, static asset caching,
  HTTP proxy rewrites, SSE pass-through, and WebSocket upgrade;
- isolated end-to-end lifecycle using non-live ports and disposable processes;
- process-tree cleanup with zero surviving listeners, tasks, services, or temp
  files;
- server/client type-checks and builds, relevant focused suites, runtime import
  check, and `git diff --check`;
- one fresh changed-scope QA review of the immutable candidate.

### Hard boundary

Do not touch or probe the live 5001/5174 processes beyond an initial/final
read-only identity check coordinated outside active browser QA. Do not modify
Tailnet, Windows Scheduled Tasks/services, the registry, machine startup,
firewall, `.env`, database state, companion repositories, or live logs. Do not
deploy or install the supervisor. Do not apply term cache or Teaching Load data,
generate, or publish.

Commit the bounded candidate and return `REVIEW_REQUIRED` with base/candidate
SHAs, exact paths, test results, isolated lifecycle evidence, remaining risks,
and the proposed—not executed—live installation boundary.

## 5. Planner completion and successors

Lane A may close as soon as its QA, integration, and Wave Completion Audit are
complete; it does not wait for Lane B. Lane B may continue independently on
isolated ports. After Lane B reaches `ACCEPT_READY`, integrate and push it from
a clean boundary, then run the required Wave Completion Auditor before asking
for a live-supervisor installation approval.

The live supervisor installation/cutover remains a separate `HIGH` packet.
Term-cache catch-up apply, rollover sync, Teaching Load mutation, generation,
and publication remain independently previewed, reviewed, and approved actions.

