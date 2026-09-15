# TL-OPERATOR-WORKSPACE-C05 wave completion audit — post-C-6 (CORRECTION_REQUIRED)

- Auditor: delegated read-only adversarial context (`atlas-qa-delegate` shell),
  `deepseek-v4.1-flash` at `high` (no fallback).
- Auditor task/session: `ses_f5a84e712ffe5apLeArTOcUfOx` (returned to the
  planner after the task completed).
- Reviewed `origin/main`: `08cbfeadf68a54a0b8bfa6c77b8b8ef72a7078c3`;
  integration `246ba41ea5701d54a16f58db912fc44ef5bda0c4` (parents `8bd50453` +
  `b632b3f4`).
- Base / candidate / register: `56b317c5…` / `b632b3f4…` / revision 70.
- Directive pin (byte-exact recompute): `76631646…` — matched (operator
  Decision A: the live directive governs).
- Mandatory tally: **9 total / 8 passed / 0 blocked / 0 unperformed / 1 failed**.
- Verdict: **CORRECTION_REQUIRED**.

## Findings

### F-1 — BLOCKING (governing rule 2): the `scopeBinding == null` branch is supersession-blind

`useTeachingLoadData.ts:243` `const scopeBindingIsCurrent = () => scopeBinding == null || isScopeCurrent(scopeBinding);`
stays permissive from dispatch until the actor-school/year resolves (`:275-280`).
In that window the failure path is unconditionally live (`:422-446`, `:450`):
a superseded older invocation whose resolution fails can still
`setDataSource('none')`, clear `coverageTotals`/`workloadPolicy`/
`sectionAssignedClassesIndex`/`authorityDiagnostics`, clear `loading`, and render
a spurious error over a newer successful fetch. Reachable in production:
`TeachingLoad.tsx:618` "Retry Connection" (no `disabled`) and `:659`
`onRetrySource`; no `AbortController`/dispatch sequence exists (probe AUDIT-C).
The committed control models only the bound case and asserts the fail-open.

### F-2 — BLOCKING (same root): no dispatch-order precedence

Probe AUDIT-A with the real exported seams: after binding B for `1:10`, an older
fetch re-resolving `1:9` via `openDiagnosticsScope` makes
`isScopeCurrent(bindingB) === false` and `isScopeCurrent(bindingA) === true` —
the guard adopts the older scope and discards the newer fetch's reply.
`openDiagnosticsScope` (`:97-106`) compares scope-id strings only and has no
forward-only/ordering guard.

### F-3 — BLOCKING (same root): pre-binding identity setters unguarded

`useTeachingLoadData.ts:263-264,267` (`setSchoolId`, `setActiveSchoolYearLabel`,
`setActiveTermIndex`) run after two awaits and before any binding, with no
dispatch-time guard; they are actor-school/year authority state setters that
drive `scopeKey` (`:228`) and therefore draft/selection invalidation.

### NON_BLOCKING

- **N-1** The rule-13 accounting is truthful and load-bearing (mutants M2/M3
  reproduced), but `register.gates` stores counts without an enumerable per-gate
  list; the `MANDATORY_SOURCE 8/8` judgment rests on arithmetic consistency plus
  the recorded QA/executor gate tables.
- **N-2** `register.git.worktree` still names the candidate worktree and
  `remoteObservation` names `246ba41e` while the tip is `08cbfead` — accurate at
  write, to be reconciled at closure.
- **N-3** Out-of-contract residuals remain backlog (Timetable sandbox ancillary
  credit; `WorkloadInspector` wording; sibling-branch citation).

## Checks run vs reused

- **New:** directive recompute; integration identity (parents, 5-path delta,
  product parity, `atlas-client` tree `00900c35…` at candidate and merge,
  superseded `93bab0ab` absent from `origin/main`); rule-2 write-site enumeration;
  AUDIT-A/B/C probes (F-2/F-1/F-3 confirmed); mutants M1 (`isScopeCurrent→true`:
  sibling suite 5/2 fail), M2 (removed producer member: C05 suite 31/4), M3
  (dropped unmatched group: C05 suite 30/5); preservation (four C-4 blobs, C-5
  seam, zero-write, no assertion removal, sibling suite a pure addition);
  register/acceptance consistency (`verify-cycle` ok, no receipt); custody
  (collided worktree untouched; artifacts `56FEA3C5…`/`B2B68EDC…`; branches
  retained; both retirement targets clean and ancestors of `origin/main`);
  hermetic reruns 55/55.
- **Reused:** C-6 QA (`ses_f5aa60a54ffeYulHvXevM61Ms5`) and C-4/C-5 QA
  (`ses_f5b130e2effe6zBR4fibdDO9A3`) as register records; the prior
  `PLANNER_DECISION_REQUIRED` capsule as history. All probes ran in an isolated
  temp copy with a junctioned read-only `node_modules` (removed afterwards).

## Live-precondition snapshot

Source-only; no runtime/deployment/login/browser/database/generation/
publication/migration/companion action by the cycle or the audit. No HIGH action
is unlocked. Worktree retirement of `-combined` and `-scope-epoch` remains blocked
until the corrected candidate is integrated and pushed; the collided legacy
worktree `E:/ATLAS-worktrees/tl-operator-workspace-c05` stays untouched.

## Required primary-planner action

Author and dispatch the bounded rule-2 completion (C-6R) on
`work/tl-operator-workspace-c05-scope-epoch`: a dispatch-time guard that is
current only when the invocation is the latest **and** its scope is in force, so
a superseded older fetch writes nothing (feeds and loading flag alike), covering
the null-binding catch/finally branch and the pre-binding identity setters; plus
one committed failing-first control that dispatches two overlapping fetches,
resolves the newer scope, then fails/resolves the older one late and asserts the
newer scope's state and loading flag survive. Fresh QA and a fresh Wave
Completion Auditor are then required before `AUDIT_CLEAR`, the closure receipt,
or worktree retirement.
