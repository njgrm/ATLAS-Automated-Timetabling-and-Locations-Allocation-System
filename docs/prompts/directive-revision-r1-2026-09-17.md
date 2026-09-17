# DIRECTIVE-REVISION-R1 - cut the ceremony, add the missing gates

ROLE: PRIMARY_PLANNER (with one executor for the code gates lane). Risk tier:
**HIGH only for the directive change itself** (it invalidates declared pins); the
cuts remove ceremony, they do not add authority.

## Objective

Reduce the delivery ceremony that has delayed development while allowing live
defects to ship, and add the three cheap mechanical gates that would have caught
them. Apply as **one** deliberate `AGENTS.md` revision, after
`CONSOLIDATED-DEPLOYMENT-C10` closes.

## Evidence base

From the C10 cycle and this audit:

- C10 required **four** pre-action review rounds before execution; every round
  traced to prose about code, not to code behaviour.
- After execution, closure took **three** correction rounds (auditor B1/B2, then
  a fresh QA F1) - all register-wording defects.
- The pin was invalidated **three times** by unrelated register-only pushes.
- The release shipped with **a live crash on the demo-critical page** (`/timetable`
  React #310) and **an unreachable-page crash** (`remainingHours` null deref).
  No gate executed a single page.

The process exonerated itself on records while the product broke. That is the
misallocation to fix.

## Part A - cuts

### C1. Two-tier risk model

- **Tier A (ordinary):** product source, tests, docs, client work, ops tooling.
  No receipt, no lease, no Wave Completion Auditor, at most **one** reviewer.
  Gates: lint, typecheck, focused tests, and (client) the route smoke crawl.
- **Tier B (HIGH):** schema/data apply, publication, generation, shared-runtime
  change, auth/tenant authority. Everything currently required.

Move the default: the majority of lanes are Tier A and stop paying Tier B prices.

### C2. Delete receipt chains for Tier A

Integrity for ordinary work is the commit SHA and the Git tree. Receipts,
per-file manifests, and pin files remain only where a human approval must bind
exact bytes: destructive data work, migrations, publication, cutover.

### C3. Cap review rounds mechanically

One review plus one bounded correction is normal. A **second** substantive
correction on the same artifact requires a planner decision; the transition
layer must refuse a third `record-qa-result` round on the same candidate.

### C4. Retire the prose register and the cross-section consistency chore

Keep one machine-readable register plus its generated projection. The
multi-location reconciliation obligation (R14) exists only because the same state
is written in several prose places; removing the duplication removes the chore.
Delete the hand-maintained prose register.

### C5. Narrow the Wave Completion Auditor

Required **only** for Tier B. Low/medium integrated work does not need an
adversarial second planner. (In C10 an auditor blocked on a register-staleness
finding while a live crash sat in production.)

### C6. Docs-only changes are commits, not streams

A documentation change needs no stream, lease, registration, receipt, or review
chain. It is a commit.

### C7. Collapse the operational state set

Use six states in practice: `PLANNED`, `RUNNING`, `REVIEW`, `BLOCKED`, `DONE`,
and `HIGH_APPROVAL_REQUIRED`. The remaining enum members become historical, not
reachable in new transitions.

### C8. Batch lanes

Prefer the largest coherent one-shot. A lane that cannot be reviewed
independently of three others is a lane that should have been one lane.

## Part B - the missing gates

### G1. ESLint with the React Hooks plugin (the single highest-value addition)

`react-hooks/rules-of-hooks` as **error** catches the `/timetable` crash
statically: a `useCallback` declared after conditional early returns is the
canonical violation. `@typescript-eslint/no-explicit-any` catches the
`loadProfile: any` that hid the `remainingHours` null deref. Wire it into the
build/gate sequence with a ratchet baseline for existing violations.

### G2. Client type-check

Add `tsc --noEmit` for `atlas-client` to the gate sequence. The server build runs
`tsc`; the client currently has **no** static gate, and `vite build` does not
type-check.

### G3. Route smoke crawl

A Playwright spec that loads every route, opens the primary non-mutating controls,
and **fails on any page error / React error / unexpected >= 400 response** (the
documented benign 404s allow-listed). Run at the integration boundary for any
wave touching the client.

### G4. Acceptance-matrix row

Every client-touching lane's matrix must carry: *"no new page or console errors on
affected routes."* This is the row absent from all four C10 rounds.

## Part C - already staged

R1-R17 in `docs/plans/directive-revision-proposal-2026-09-17.md` (pin semantics,
citation verification, sentence templates, dispatch preflight, stale-wording
reconciliation, successor gating, step order, machine-scope verification). This
revision applies them together with Part A and Part B.

## Execution of this revision

1. Wait for `CONSOLIDATED-DEPLOYMENT-C10` to close (invariant #1: no successor
   HIGH approval while its auditor verdict is not `AUDIT_CLEAR`).
2. Land `UI-REGRESSION-GATES-C01` (Part B) first, so its evidence accompanies the
   directive change.
3. Apply Part A + Part C as **one** `AGENTS.md` commit.
4. Re-pin the directive and reconcile every packet that declares the old hash
   `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`, in the same turn (R14).
5. Replace the one-state-per-step enforcement for Tier A lanes; record the new
   tier on each active stream.

## Measurement

| Metric | C10 baseline | Target |
| --- | --- | --- |
| Pre-action review rounds per HIGH packet | 4 | <= 2 |
| Closure correction rounds | 3 | <= 1 |
| Pin invalidations from unrelated pushes | 3 | 0 |
| Product pages executed in acceptance | 0 | every route (G3) |
| Static gates on client source | 0 | 2 (G1, G2) |
| Live crashes reaching the deployed release | 2 | 0 |

## Boundaries

The cuts remove process obligations; they must **not** relax any Tier B control:
boundary, approval, execution-record, and post-action acceptance requirements for
schema/data, publication, generation, shared-runtime, and auth/tenant authority
are unaffected.
