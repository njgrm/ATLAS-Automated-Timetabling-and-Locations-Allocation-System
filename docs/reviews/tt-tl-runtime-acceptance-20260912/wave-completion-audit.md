# Wave Completion Audit — `tt-tl-runtime-acceptance-20260912` (final pre-action)

Compact capsule for the corrected-packet final audit of the TT/TL runtime
acceptance HIGH action. Committed by the primary planner; no full transcript is
preserved here.

## Capsule

- Auditor task/session ID (planner-relayed): `ses_f6a02e067ffecMsB3E1Wrzr1hV`
- Model / reasoning: `opencode-go/deepseek-v4.1-flash`; no reasoning-variant
  selector exposed by the harness — strongest-model/max-reasoning fallback
  disclosed.
- Verdict: `AUDIT_CLEAR` — mandatory 10 / 10 passed, 0 blocked, 0 unperformed.
- Reviewed `origin/main`: `9221864b2c8484d307a1ff915b49ada95eb5f241`
  (correction range `c6f4171d..9221864b`: packet + register).
- Prior audit in the same stream: `ses_f6a0e829bffeYKI1HEUwT13EjU`
  (`CORRECTION_REQUIRED`, F1/F2/F3) — now resolved.

## New checks actually run (auditor)

Git identity/scope; `ops/runtime` source contract read at the reviewed commit
(`cli.mjs`, `supervisor.mjs`, `listeners.mjs`, `backoff.mjs`, `contract.mjs`,
`state.mjs`, `runtime-contract.json`, `README.md`); R3 audit spec + packet +
register read in full; live read-only probes (listeners, process parent chain,
local + Tailnet health/readiness, worktree HEADs, task XML, machine-env
metadata only, target ancestry, state file, incumbent log); stale/leak scans.

## Findings

- F1 (resident-supervisor quiesce) — RESOLVED: step 2 + rollback + §8 + evidence
  semantics now terminate the exact `cli.mjs start` supervisor process tree and
  run `cli.mjs stop`, then hold a released-port settle window ≥10 s (strictly
  greater than the 2 s restart backoff). Tree kill is real
  (`listeners.mjs:94-98`); the boot task has no `RestartOnFailure`, so tree
  termination is durably quiescent.
- F2 ("schema" in §8) — RESOLVED. F3 (filesystem-owner report) — RESOLVED.
- NB1/NB2 non-blocking documentation notes only; no new blocking findings;
  no secret exposure; no unauthorized scope.

## Reused evidence validated

The prior F1 premise was re-derived: the incumbent log signature
`Ports still busy after stop … Stopped (portsReleased=false)` matches
`runStop` terminating recorded PIDs while live listeners were relaunched ones;
`backoffBaseMs=2000` and `shutdownGraceMs=10000` confirmed at the contract.

## Live-precondition snapshot (2026-09-12 22:22:55 +08:00)

Resident supervisor PID 32632 (parent 3344 gone) owns 15388 (5001) / 22272
(5174); 5175→14268 untouched; local + Tailnet health/readiness 200; incumbent
`D:\ATLAS-runtime-supervised-20260912` at `9d293879`; rollback
`D:\ATLAS-runtime-fallback-d44-20260912` at `d44f29e0`; boot task
ONSTART/PT0S/SYSTEM/IgnoreNew; legacy task Disabled; target `3d916b26` in main;
new release dir absent (expected).

## Required primary-planner action (as returned)

Validate this capsule, then present the exact R3 approval sentence to the
operator; no executor dispatch, session preflight, or runtime mutation may
begin before the operator returns it.
