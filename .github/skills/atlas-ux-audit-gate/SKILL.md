---
name: atlas-ux-audit-gate
description: Enforces pre-code UX audit, post-code UX verification, severity triage, screenshot evidence, and explicit GO/NO-GO gate decisions.
user-invocable: true
---

# ATLAS UX Audit Gate Skill

Use this skill before and after any non-trivial UI change.

## Required Sequence
1. Pre-code audit on current behavior.
2. Implementation pass.
3. Post-code verification against the same checklist.
4. Gate decision with evidence links.

## Pre-Code Audit Output
- Severity-tagged findings: `Critical`, `Major`, `Minor`, `Nit`.
- User impact summary per finding.
- Affected route + viewport + role context.

## Post-Code Verification Output
- For each prior finding: `Resolved`, `Partially Resolved`, or `Unresolved`.
- Regression check for unaffected neighboring flows.
- Updated risk summary.

## Screenshot Evidence Rules
- Capture desktop + mobile portrait + mobile landscape when applicable.
- Include before/after pairs for every `Critical` and `Major` finding.
- Save artifacts using deterministic names:
  - `YYYYMMDD-role-route-viewport-state.png`
  - Example: `20260509-faculty-my-room-preferences-mobile-portrait-after.png`

## GO/NO-GO Rubric
- `NO-GO` if any `Critical` issue remains unresolved.
- `NO-GO` if evidence is incomplete for any claimed fix.
- `CONDITIONAL GO` only when unresolved items are `Minor`/`Nit` with accepted follow-ups.
- `GO` only when all `Critical`/`Major` items are resolved and evidence is complete.
