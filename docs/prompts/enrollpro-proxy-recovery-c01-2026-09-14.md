# ENROLLPRO-PROXY-RECOVERY-C01 — source correction and live-recovery preparation

Status: **PLANNED — ordinary source cycle may run end to end; live runtime
mutation is not approved.**

Prepared: 2026-09-14 (Asia/Manila) by the head planner.

Risk: **MEDIUM source correction.** Any edit to
`D:\ATLAS-runtime-config\atlas-server.env`, machine environment, the supervised
release, Windows task, or processes on ports 5001/5174 is a later **HIGH**
action requiring an exact reviewed packet and explicit operator approval.

Canonical directive: read `D:/ATLAS/AGENTS.md` directly. Its LF-normalized
SHA-256 at preparation time is
`4A501E7B0E90CD6D8AE8523DEF8B1B6EF932A7ADEC3FC0DF796C20192DBE5007`.
If the hash has changed, re-read the root directive and carry the new hash in
the executor and QA handoffs; the root copy wins.

## 1. Verified defect and current boundary

Start from refreshed `origin/main` at or after
`41f00e9243865303a791367896f1c701df79c2fb`. Create a fresh worktree and branch;
do not use the dirty/stale `D:/ATLAS` checkout as an integration boundary.

Read-only probes on 2026-09-14 established:

- `GET https://dev-jegs.buru-degree.ts.net/api/settings/public` = 200.
- `GET https://dev-jegs.buru-degree.ts.net/api/integration/v1/health` = 200.
- `GET https://njgrm.buru-degree.ts.net/api/v1/health` = 200.
- `GET https://njgrm.buru-degree.ts.net/api/v1/health/ready` = 200.
- `GET https://njgrm.buru-degree.ts.net/enrollpro-api/settings/public` = 502.
- The durable runtime environment contains `ENROLLPRO_API` pointing at the old
  raw Tailnet-IP API and contains no `ENROLLPRO_PROXY_ORIGIN`.
- `ops/runtime/runtime-contract.json` therefore supplies its localhost default
  (`http://127.0.0.1:5000`) to the production host.
- `ops/runtime/lib/supervisor.mjs::buildTargets` builds `baseEnv` from process
  environment plus the operator-owned durable environment, but resolves the
  proxy target from the original `env` object instead of `baseEnv`. A value in
  the durable environment can therefore be ignored.

Conclusion: this is an ATLAS proxy configuration/propagation defect, not an
EnrollPro outage and not a reason to use localhost browser evidence.

## 2. Objective

Make the supervised ATLAS production host consume one explicit, durable,
HTTPS EnrollPro origin for `/enrollpro-api` and `/enrollpro-uploads`, fail
closed on invalid production configuration, preserve degraded ATLAS operation
when EnrollPro is temporarily unavailable, and prepare—but do not execute—the
smallest reversible live recovery.

The current EnrollPro browser entry point is
`https://dev-jegs.buru-degree.ts.net/personnel/login`; the proxy/API **origin**
is `https://dev-jegs.buru-degree.ts.net` (never append the personnel login path
to proxy targets). EnrollPro source remains **READ_ONLY**.

## 3. Required source correction

1. In the supervisor target builder, resolve the EnrollPro target from the
   fully composed child environment (`baseEnv`) so an operator-owned durable
   `ENROLLPRO_PROXY_ORIGIN` is honored. Define and test precedence explicitly:
   durable environment values override inherited process values; pinned
   invariants remain unaffected.
2. Validate the target as a normalized HTTP(S) origin before spawning either
   child. Reject credentials, fragments, query strings, and non-origin paths.
   Reject malformed, empty, and non-HTTP(S) values with a stable typed error
   and zero child spawns. A trailing slash may normalize to the same origin.
3. Keep local development usable, but do not silently treat the localhost
   development fallback as a valid supervised production upstream. The
   supervised runtime contract or exact CLI start gate shall require an
   explicit `ENROLLPRO_PROXY_ORIGIN`; missing production configuration must
   stop before listener replacement/spawn with a typed diagnostic.
4. Preserve production-host rewrite behavior exactly:
   `/enrollpro-api/x?y=1 -> <origin>/api/x?y=1` and
   `/enrollpro-uploads/x -> <origin>/uploads/x`. Preserve method, request body,
   response status/body/headers needed by the client, SSE behavior, and safe
   WebSocket upgrade behavior.
5. An upstream request failure shall return a bounded 502 response for that
   request without crashing the ATLAS server, production host, or supervisor.
   ATLAS `/api`, SPA fallback, and health/readiness must remain available; do
   not make EnrollPro availability a prerequisite for ATLAS process readiness.
6. Remove stale raw-IP defaults from ATLAS client runtime examples and active
   fallback code touched by this contract. Do not replace them with a
   school-specific hard-coded production default. Companion navigation shall
   use explicit configuration and fail closed/disable the link when unresolved.
   The configured EnrollPro personnel login path and companion SSO start path
   remain distinct contracts.
7. Update the runtime source-of-truth map and runtime documentation with the
   final environment ownership, precedence, degraded behavior, and exact live
   recovery boundary.

Do not change EnrollPro, AIMS, or SMART. Do not edit the durable environment,
machine variables, supervisor task, release directory, listeners, or live data
in this source cycle.

## 4. Required failing-first controls

Use the real `ops/runtime` entry points rather than helper/source-string-only
proofs.

- A fixture with the proxy origin only in injected durable `envValues` must
  make the production-host child receive that exact normalized HTTPS origin.
  The pre-fix code must fail this control.
- A conflicting inherited value must lose to the durable value.
- Missing supervised production configuration, credentials in URL, path,
  query, fragment, invalid protocol, empty value, and malformed URL must each
  fail before any spawn/listener mutation.
- A real temporary HTTPS or protocol-equivalent upstream fixture must prove
  both rewrite routes, query preservation, a non-2xx pass-through, and response
  body parity. Include an upstream-unreachable case proving bounded 502 while
  ATLAS host liveness remains healthy.
- Production contract/CLI start coverage must prove the explicit variable is
  consumed by the exact gate. Include a mutant that switches resolution back
  from `baseEnv` to `env` and must fail.
- Client tests must prove unresolved companion configuration does not navigate
  to the retired raw IP and the configured personnel/SSO routes remain exact.

Run focused runtime-supervisor/production-host/companion-link suites,
server/client TypeScript checks, server/client production builds, built-module
imports or isolated startup appropriate to the changed paths, and
`git diff --check`.

## 5. Planner-led cycle and QA contract

This is one source cycle that shall proceed without asking the operator for
authorization: fresh executor -> frozen candidate -> fresh independent QA ->
bounded corrections in the same executor session -> final QA -> clean
current-main integration -> combined decisive gates -> Wave Completion Audit ->
push and register reconciliation under standing source-integration authority.

Do not stop merely because the later live recovery is HIGH. The terminal source
report must be `COMPLETE` or name a genuine source/external blocker. QA must
verify the exact immutable range, every changed path, the real CLI/production
host path, the load-bearing mutant, and zero live mutation. A reviewer summary
that only repeats executor tests is insufficient.

After source integration, prepare a separate fingerprinted live packet and
return control to the head planner/operator. Do not execute it.

## 6. Required live-recovery packet (prepare only)

The prepared HIGH packet shall bind the accepted integrated release SHA and:

1. Re-probe the EnrollPro HTTPS settings and integration-health endpoints,
   ATLAS local/Tailnet health, exact supervisor release/task/listener identity,
   and current sanitized relevant environment-key presence before mutation.
2. Back up the durable environment file to an operator-only location without
   displaying or committing any value.
3. Change only these intended settings:
   `ENROLLPRO_PROXY_ORIGIN=https://dev-jegs.buru-degree.ts.net` and, after
   verifying server contract parity,
   `ENROLLPRO_API=https://dev-jegs.buru-degree.ts.net/api`.
4. Build/install the accepted release and restart only supervisor-owned ATLAS
   processes on ports 5001/5174 using the existing registered supervisor
   boundary. Keep `ROLLOVER_AUTO_SYNC_ENABLED=false`; do not touch port 5175,
   unrelated processes, Tailscale Serve, or companion runtimes.
5. Require local health/ready 200, Tailnet health 200, public proxy settings
   200 with response parity to the direct upstream, upload proxy reachability,
   SPA/API continuity, one owner per port, and bounded/redacted logs.
6. Prove no database delta. No login is needed for the public proxy repair.
   A later authenticated term-cache preview retains its own one-login
   authorization and is not part of this recovery.
7. On failure, restore the backed-up environment and prior supervised release,
   then require the prior health state. Record honestly that this rollback
   restores service continuity even if the old EnrollPro proxy remains broken.

The packet must contain the exact proposed HIGH approval sentence with the
accepted release SHA, current PIDs/task identity discovered at preflight,
environment backup identity, two allowed key changes, restart boundary,
acceptance probes, rollback, and all exclusions.

## 7. Return contract

Return one terminal report containing:

- immutable base/candidate/integration/final-main SHAs and changed paths;
- executor, fresh-QA, and auditor IDs/verdict tallies;
- failing-first and mutant evidence;
- direct-upstream versus ATLAS-proxy status matrix;
- confirmation that EnrollPro and live runtime/data were untouched;
- the path and commit containing the prepared HIGH live packet;
- the copy-ready approval sentence, clearly marked **NOT GRANTED**;
- one next action, awaited returns, safe parallel work, and locked successors.

Suggested source commit:

```text
fix(runtime): honor durable EnrollPro proxy origin
```
