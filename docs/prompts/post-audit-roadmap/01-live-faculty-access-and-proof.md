# Prompt 1 — Live Faculty Access and Proof

## Objective

Make the documented faculty account resolve to one canonical `FacultyMirror` across authentication, dashboard, schedule, preferences, room requests, collaboration, and published-schedule event paths.

## Context

- Live account: employee `2000056`.
- Current behavior: authentication succeeds but `/my`, `/my/schedule`, `/my/preferences`, and `/my/room-preferences` return mapping-required recovery states.
- Canonical resolver: `atlas-server/src/services/faculty-identity.service.ts`.
- EnrollPro and ATLAS mirror identity must be matched through durable employee/external/account identity; do not hardcode the QA employee.

## Tasks

1. Capture the authenticated payload and relevant ATLAS account/mirror candidates without exposing credentials or tokens.
2. Add a failing resolver test reproducing the live identity shape.
3. Repair normalization/candidate collection or safe account linking so all faculty endpoints resolve the same canonical mirror.
4. Reject ambiguous candidates instead of guessing; return actionable diagnostics.
5. Verify `/faculty/me`, faculty portal dashboard, published faculty schedule, preferences, room requests, and collaboration identity.
6. Capture mobile Tailnet evidence for all four faculty routes.

## Exit Gate

GO only when the documented account loads data-backed states on all four faculty routes and the canonical resolver tests pass. Authentication success alone is not GO.
