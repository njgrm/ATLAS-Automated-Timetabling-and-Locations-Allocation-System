# Copilot Supercharge Rollout (2 Weeks)

## Goal
Institutionalize skill-driven prompt governance, Context7 preflight discipline, and evidence-based gates for UI, QA, reliability, and algorithm refactors.

## Scope
### In Scope
- Introduce 8 new skills under `.github/skills/`.
- Enforce Context7 preflight policy and approved library map.
- Add prompt-template guardrails in `docs/prompts/`.
- Define fast-follow tooling additions for CI and UX quality.

### Out of Scope
- Full implementation of Playwright/Lighthouse/Storybook/Axe in this doc-only pass.
- Rewriting existing phase specs unrelated to these governance controls.

## Week 1
1. `atlas-ux-audit-gate` + `atlas-shared-browser-qa`
2. `atlas-design-system-enforcer`
3. Context7 preflight policy activation (`docs/context7-library-map.md`)

## Week 2
1. `atlas-offline-realtime-reliability`
2. `atlas-phase-gate-enforcer`
3. `atlas-algorithm-benchmark-gate`
4. `atlas-faculty-usability-first` + `atlas-copy-and-microcopy`

## Tooling Additions (Fast ROI)
- Playwright visual regression snapshots with role + viewport matrix.
- Lighthouse CI budgets for mobile performance regression control.
- Storybook states for shared components (`empty`, `loading`, `error`, `offline`).
- Axe accessibility checks in CI.
- Prompt templates under `docs/prompts/` with mandatory gates.

## Exit Criteria
- New prompts include Context7 preflight references.
- Non-trivial UI prompts include design-rule mapping.
- Manual QA evidence follows shared-browser naming and log format.
- Completion claims include phase-gate proof and updated evidence logs.
