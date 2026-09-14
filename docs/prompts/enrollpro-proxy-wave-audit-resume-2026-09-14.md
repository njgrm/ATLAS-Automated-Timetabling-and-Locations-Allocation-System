# ENROLLPRO-PROXY-RECOVERY-C01 — stalled wave-audit recovery handoff

Status: **CYCLE ON — resume at `INTEGRATED_AUDIT_PENDING`; do not rerun source
implementation and do not execute the prepared HIGH live packet.**

Canonical directive: current tracked `origin/main:AGENTS.md`, LF-normalized
SHA-256 `F4F86185F2A0B4D78B50E8375F72E35B9F6E8A788A6F558952C2B29BE174CE64`.
Read the Wave Completion Auditor contract before dispatch.

## Verified recovery state

- Current `origin/main`: `3ba4fac0ab81c28adb5c58e147ef468ab703d565`
- Source candidate: `54dce67b8392cbce09aa810813c37f9c87a67159`
- Source integration merge: `bc61ecd5`
- Integration/docs commits: `399117cd`, `3ba4fac0`
- Integration worktree:
  `D:/ATLAS-worktrees/integration-enrollpro-proxy-recovery-c01`, branch
  `integration/enrollpro-proxy-recovery-c01-20260914`, clean and equal to
  `origin/main` at recovery capture.
- Fresh candidate QA already returned `ACCEPT_READY` 14/14/0/0 under task
  `ses_f61b68675ffeBSr746jvBqOGXN`. Reuse that unchanged candidate evidence;
  do not commission duplicate candidate QA.
- Prepared but unapproved HIGH packet:
  `docs/prompts/enrollpro-proxy-recovery-live-2026-09-14.md`.
- The living register consistently marks the source
  `INTEGRATED_AUDIT_PENDING` and the live action `HIGH_APPROVAL_REQUIRED`; its
  awaited-return section says the Wave Completion Audit is in flight, but no
  active worktree-owning process was found. Treat that auditor as lost/stalled.

## Required continuation

1. Refresh `origin/main` and verify the exact chain, clean integration tree,
   candidate-to-merge product-tree parity, changed-path attribution, and that
   the prepared HIGH packet still binds the integrated reviewed release.
2. Spawn exactly one **fresh** `ROLE: WAVE_COMPLETION_AUDITOR` using the
   strongest available planner model at max reasoning (high only if max is
   unavailable, with disclosure). Give it only the bounded evidence required by
   `AGENTS.md`; do not inherit the prior planner's conclusions.
3. The auditor is read-only. It shall inspect all direct proxy/config/runtime
   consumers, launch gates, durable environment semantics, production build
   inputs, rollback ordering, current live preconditions, and successor unlock.
   It may perform read-only probes, but no login, environment change, release
   install, task/process change, database mutation, or companion edit.
4. Require one of `AUDIT_CLEAR`, `CORRECTION_REQUIRED`, or
   `PLANNER_DECISION_REQUIRED` with a complete tally and machine-checkable
   capsule. If the remedy is deterministic, the auditor must include the
   copy-ready correction; it must not say “available on request.”
5. The planner independently validates the audit. On `AUDIT_CLEAR`, commit only
   the compact capsule at
   `docs/reviews/enrollpro-proxy-recovery-20260914/wave-completion-audit.md`,
   reconcile every literal register occurrence from `INTEGRATED_AUDIT_PENDING`
   to `COMPLETE`, preserve the separate live row as
   `HIGH_APPROVAL_REQUIRED`, verify the exact docs-only diff, and push.
6. Stop and return to the head planner after audit closure. Present the exact
   live approval sentence from the prepared packet, but do not infer or execute
   approval. Any product/test correction reopens bounded correction + fresh QA
   + fresh auditor.

## Boundaries

No source reimplementation, duplicate candidate QA, live proxy repair,
environment edit, release install, supervisor/process/task change, browser
login, database mutation, term-cache action, Teaching Load action, generation,
publication, schema/migration, or companion-repository edit.

PLANNER_SESSION_ROUTE: FRESH_REQUIRED prior planner/auditor stopped after source
integration without the mandatory Wave Completion Audit return
EXECUTOR_SESSION_ROUTE: NONE source candidate is already accepted and integrated
QA_SESSION_ROUTE: FRESH_REQUIRED one Wave Completion Auditor for the integrated
wave; no duplicate candidate QA

Suggested commit after `AUDIT_CLEAR`:

```text
docs(runtime): close EnrollPro proxy recovery wave audit
```
