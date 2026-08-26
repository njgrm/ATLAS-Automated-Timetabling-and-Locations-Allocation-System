# SMART-Parity Cross-Page UX/UI Overhaul Plan

## Summary

ATLAS is technically close on Timetable and Teaching Load, but the whole product is not yet visually indistinguishable from a SMART-family sister system. This plan formalizes SMART parity, audits every major surface, and applies shared page patterns to Dashboard, setup, Teaching Load, Campus/Rooms, Schedules/Publish, Faculty, and Public views while keeping Timetable in release-candidate maintenance.

## Execution Waves

### Wave A — Contract and audit

- Create the SMART parity contract and seven implementation prompts.
- Add a cross-page browser audit that measures no-scroll behavior, horizontal overflow, first useful content, visible source status, obvious primary action, help availability, and text overlap.
- Produce a page-by-page GO/NO-GO report before deeper changes.

### Wave B — One-decision pages and guidance

- Apply a shared page anatomy: source/status chip, next-step copy, one primary action, Help, More, and localized content scrolling.
- Generalize the manual tutorial/help model from Timetable to other role surfaces.
- Keep advanced tools behind More, Details, or Advanced controls.

### Wave C — Dense-surface simplification and visual consistency

- Convert mobile setup/schedule surfaces away from squeezed tables into card/list patterns.
- Normalize spacing, badges, buttons, empty states, error states, loading states, sheet footers, and More menu grouping.
- Add shared `Smart*` primitives where they reduce one-off UI drift.

### Wave D — Release proof

- Run static/build gates and Tailnet browser gates.
- Capture screenshots across desktop, mobile portrait, and mobile landscape.
- Create an Antigravity review prompt with exact expected behavior and blockers.

## Design Contract

- SMART parity means shared rhythm, not copied domain behavior.
- EnrollPro/HNHS tokens remain the school identity source.
- Every page shall expose one obvious next action before advanced tools.
- Every page shall keep first useful content visible early on desktop, mobile portrait, and mobile landscape.
- Every page shall avoid global browser scrollbars and horizontal overflow.
- Every visible error or disabled action shall explain what happened and what to do next.
- Faculty and public pages shall remain mobile-first and use plain language.

## Verification Gates

- `cd atlas-client && npx tsc --noEmit`
- `cd atlas-client && npm run build`
- `cd atlas-client && npm run test:ux-guardrails`
- `cd atlas-client && npm run test:timetable-conflict`
- Tailnet cross-page SMART parity Playwright spec
- Existing setup-first, Teaching Load, Timetable, EnrollPro, faculty/public smoke specs where relevant

## Acceptance Criteria

- ATLAS feels like a SMART-family system across admin, faculty, and public pages.
- Timetable remains release-candidate.
- Teaching Load and Teachers remain guided and source-truth safe.
- Dashboard, Campus/Rooms, Schedules, Faculty, and Public pages follow the same visual and interaction language.
- No generation truth, Teaching Load truth, publish gates, role permissions, or EnrollPro ownership rules change.
