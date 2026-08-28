---
name: atlas-design-system-enforcer
description: Enforces mandatory mapping of UI work to ATLAS design standards and blocks prompts that do not cite required design references.
user-invocable: true
---

# ATLAS Design System Enforcer Skill

Use this skill on every non-trivial UI prompt before implementation starts.

## Mandatory References
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- Relevant phase design spec under `docs/phases/` when available

## Prompt Gate
- Reject prompts that do not cite applicable design rules.
- Reject prompts using banned primitives or conflicting layout patterns.
- Require a short mapping from requested UI changes to design rules.

## Mapping Template
- `Design Rule`: the specific rule being applied.
- `Implementation Target`: files/routes affected.
- `Verification`: how compliance will be checked.

## Non-Compliance Action
- If mapping is incomplete, request revision before coding.
- If implementation drifts, mark `NO-GO` until aligned.
