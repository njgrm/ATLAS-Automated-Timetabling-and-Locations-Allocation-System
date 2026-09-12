# Wave Completion Audit — runtime-stability-wave-20260912 (Lane B pre-install gate)

**Role:** `ROLE: WAVE_COMPLETION_AUDITOR` (read-only, independent second-planner check).
**Harness task ID:** `ses_f6b61fda2ffeA6zv472Ly5o7i0` (the auditor reports no self-visible spawn identifier; the parent harness issued this ID).
**Model / reasoning:** `opencode-go/deepseek-v4.1-flash`; reasoning variant not reported by the harness.
**Verdict:** `CORRECTION_REQUIRED` — new checks 10 / 8 passed / 0 blocked / 0 unperformed / 2 failed.

## Reviewed boundary

- Reviewed `origin/main`: `f1f9e37f960527dd09fdc692d83ff19b75c30f58` (re-fetched; unchanged).
- Lineage: `3a880726` merge (parents `58e7e521` + `17009872`); `17009872` → `aa699b2c` linear, unamended; product parity `git diff 17009872 f1f9e37f -- ops/runtime atlas-server package.json` empty.
- Live preconditions: PIDs 38468 (:5001) / 38460 (:5174); Tailnet health 200; `EPHEMERAL_DEPLOYMENT`; no drift.

## Findings

- **F1 — BLOCKING (product/contract defect).** The reviewed `productPin` (`d44f29e0`) is unsatisfiable on any tree containing the supervisor: `ops/runtime/lib/contract.mjs:260` requires `actualSha === productPin`; `d44f29e0` contains no `ops/runtime` (`git ls-tree -r d44f29e0 -- ops/runtime` empty); any supervisor-containing commit has a different SHA, and pinning the containing commit is a fixed point. Outcome §4.1 is not production-reachable. Bounded remedy (dispatched as a correction): verify `productPin` as an ancestor of the deployed HEAD; require the operator-declared exact release SHA (`ATLAS_RUNTIME_RELEASE_SHA`) to equal HEAD, failing closed when absent/mismatched; record the installed release SHA distinctly from the reviewed pin in state/status; failing-first controls over a real supervisor-containing tree.
- **F2 — BLOCKING (register continuity, docs-only).** The register contained stale "wave audit pending/running" wording while the Lane A audit was `AUDIT_CLEAR`; reconciled in the commit that adds this capsule.
- **F3 — NON_BLOCKING.** The runtime map lacked a RUNTIME-SUPERVISION-C01 / `GET /api/v1/health/ready` entry; added in the commit that adds this capsule.
- **F4 — NON_BLOCKING.** `cli.mjs inventory` printed legacy-task `Task To Run` / `HostName` / `Start In` verbatim; bundled into the correction (redaction).
- **F5 — NON_BLOCKING (packet precondition).** `supervisor-state.json` lives under `sourceDir/ops/runtime/logs/` and is not gitignored; the install packet must treat the durable source dir as runtime-mutable.
- **F6 — NON_BLOCKING (packet precondition).** The preview falls back to `REPO_ROOT` when `ATLAS_RUNTIME_SOURCE_DIR` is unset; the install packet must set it explicitly.

## New checks actually run (read-only; live ports never bound)

Git identity/ancestry/parity PASS; ops suite 52/52 PASS; install/uninstall previews and inventory inert/read-only PASS; crash-policy opt-in PASS (install must rebuild/restart to activate); hygiene PASS; ten §4 outcomes production-reachable PASS; pin installability FAIL (F1); sequencing/rollback/env/legacy/rollover preconditions PASS-as-requirements; register consistency FAIL (F2); live drift PASS (none).

## Required install-packet contents (recorded for the corrected packet)

- Preconditions: frozen SHAs (installed release HEAD; `d44f29e0` proven ancestor; declared release SHA == HEAD); durable source dir with built artifacts + `ops/runtime/**` at one HEAD; operator env file outside the source dir (`DATABASE_URL`, `JWT_SECRET`, `ATLAS_RUNTIME_SOURCE_DIR`, optional durable `ATLAS_RUNTIME_LOG_DIR`); recorded incumbent identity (PIDs 38468/38460); a startable previous-release artifact plus an explicit rollback record (first-start `previous` is null → `ROLLBACK_UNAVAILABLE`); legacy task not running and disposition recorded; rollover invariant pinned false; approval sentence naming the exact PIDs, supervised start, boot-task registration, legacy-task disable, rollback artifact, and state/log writes inside the source dir.
- Sequence: offline build/preflight (no binding) → freeze + verify SHAs → stop incumbents by exact PID only, zero listeners before start → seed/confirm rollback target → durable env → register boot task → supervised start with liveness AND dependency readiness per port → live SPA/proxy/SSE/WS parity + invariants → legacy-task disable after supervisor health → record status/logs.
- Post-install acceptance (re-prove, not reuse source tests): one owner per port + unknown-listener negative control; live liveness-vs-readiness (real DB round trip; 503 → bounded restart); restart-on-exit/backoff/give-up + corrupt-state exit; SPA/proxy/SSE/WS on the live origin; rollback restores previous release paths; bounded logs/status across restart; boot-task recovery; exact installed HEAD recorded secret-free; zero unauthorized writes.
- Rollback boundary: no zero-downtime claim; outage window accepted; on failure stop supervised children by owned PID, restore the accepted `d44f29e0` artifact, record evidence.

## Required primary-planner action (dispatched)

- Bounded pin-contract correction + inventory redaction in the same executor session; fresh QA and a fresh Wave Completion Auditor follow. No install packet may be authored until the correction clears.
