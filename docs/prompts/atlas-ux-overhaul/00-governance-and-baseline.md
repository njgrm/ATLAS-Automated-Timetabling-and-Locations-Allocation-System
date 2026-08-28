# Prompt UX-00 — Governance and Baseline

## Objective

Reconcile the contradictory active-phase story and create a reliable route-level UX baseline before implementation.

## Directive

1. Compare `phasePlan.md`, `docs/phases/ux-refactor-master-plan.md`, current phase documents, and the runtime map.
2. Propose one active UX stream with explicit relationship to generator-readiness and publish work. Ask the stakeholder before changing the active phase pointer.
3. Inventory every routed page, role, permission, source of truth, primary task, primary action, empty state, error state, and mobile behavior.
4. Mark non-routed or compatibility-only surfaces, including `SpecializationMapping.tsx` and `MapView.tsx`, as retain, merge, or remove. Do not delete them without approval.
5. Define measurable baselines: task completion, first-action discovery, target sizes, text sizes, overflow, keyboard completion, error recovery, and file-size compliance.
6. Capture live Tailnet screenshots at 1440, 768, 375 portrait, and mobile landscape when the environment is reachable.

## Deliverables

- Updated phase governance only after stakeholder approval.
- Route and role inventory.
- Baseline evidence entry with explicit verified/unverified labels.
- Prioritized backlog mapped to UX-01 through UX-06.

## Exit Gate

GO only when one canonical active UX stream and its boundaries are explicit. Otherwise record NO-GO and the exact decision required.
