# Teaching Load, Timetable Repair, and Freshness Prompt Sequence - 2026-05-31

## Purpose

Use this sequence to execute the implementation ladder from `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`.

Each prompt is intentionally self-contained and includes audit, implementation, verification, and a bounded repair loop so one chat can fix what it finds before returning `GO` or `NO-GO`.

## Required Operating Rules For Every Prompt

- Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `.github/copilot-instructions.md`, `phasePlan.md`, `docs/reference/atlas-runtime-source-of-truth-map.md`, `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, and this sequence before editing.
- Apply `atlas-21st-dev-frontend`, `atlas-design-system-enforcer`, `atlas-ux-audit-gate`, and `atlas-copy-and-microcopy` for UI prompts.
- Apply `atlas-mobile-faculty-ux`, `atlas-faculty-usability-first`, and `atlas-offline-realtime-reliability` for faculty `/my/*` prompts.
- Apply `atlas-express-api`, `atlas-mvc-enforcement`, and `atlas-prisma-database` for backend/API/schema prompts.
- Keep controllers thin and transport-only. Put business logic in services and persistence logic in repositories/model access.
- Keep React files under 1000 lines. If a touched file approaches the limit, extract components before adding behavior.
- Do not use raw native `<button>`, native `<select>`, `<details>`, or raw `title=` in touched React surfaces.
- Use shadcn/Radix primitives, lucide icons, named overlays, and plain-language microcopy.
- Prefer Tailnet/manual QA for runtime-sensitive checks. Local build success is not enough for a prompt that changes live behavior.
- Update `docs/reference/atlas-runtime-source-of-truth-map.md` when page ownership, persistence, fallback, publish/revision behavior, or cache semantics change.
- Update `docs/verification/evidence-log.md` with what was verified.
- Final output must include files changed, tests run, evidence, unresolved risks, and prompt-scope `GO` or `NO-GO`.

## Standard Repair Loop

Every prompt must execute this loop before returning:

1. Audit the current implementation and record concrete findings.
2. Implement the smallest coherent fix for the prompt scope.
3. Run required builds/tests/smoke checks.
4. If verification fails, repair once within the same session and rerun the failed checks.
5. If a blocker remains after the repair loop, return `NO-GO` with the exact blocker and next action.
6. If all prompt-scoped checks pass, return `GO` with evidence.

## Prompt Order

1. `docs/prompts/tl-timetable-01-teaching-load-semantics-foundation-prompt.md`
2. `docs/prompts/tl-timetable-02-teachers-admin-data-table-pilot-prompt.md`
3. `docs/prompts/tl-timetable-02b-teachers-admin-data-table-followup-fix-prompt.md`
4. `docs/prompts/tl-timetable-03-timetable-stale-input-contract-prompt.md`
5. `docs/prompts/tl-timetable-04-tactical-bottom-dock-live-sandbox-prompt.md`
6. `docs/prompts/tl-timetable-05-sandbox-draft-commit-path-prompt.md`
7. `docs/prompts/tl-timetable-05b-sandbox-draft-commit-closure-prompt.md`
8. `docs/prompts/tl-timetable-05c-sandbox-browser-closure-and-ui-hardening-prompt.md`
9. `docs/prompts/tl-timetable-06a-published-revision-data-model-audit-contract-prompt.md`
10. `docs/prompts/tl-timetable-06b-effective-date-read-resolution-prompt.md`
11. `docs/prompts/tl-timetable-06c-timetable-revision-ui-workflow-prompt.md`
12. `docs/prompts/tl-timetable-07-faculty-trust-and-freshness-repair-prompt.md`
13. `docs/prompts/tl-timetable-08-audit-repair-console-dashboard-drilldowns-prompt.md`
14. `docs/prompts/tl-timetable-09a-published-schedule-query-shaping-prompt.md`
15. `docs/prompts/tl-timetable-09b-dashboard-readiness-summary-endpoint-prompt.md`
16. `docs/prompts/tl-timetable-09c-admin-server-pagination-search-prompt.md`
17. `docs/prompts/tl-timetable-09d-virtualization-component-extraction-prompt.md`

## Dependency Notes

- Prompt 1 must land before Tactical Dock work because the dock reuses Teaching Load status semantics.
- Prompt 2 should land before broader admin table conversions because `/teachers` is the UI-only table pilot.
- Prompt 2b should run immediately after Prompt 2 when the pilot lands, because it closes the verified handoff, sort-semantics, and summary-state regressions before later prompts inherit the broken Teachers contract.
- Prompt 3 must land before sandbox commit work because stale-input detection is the safety rail.
- Prompt 4 can build the local sandbox only; Prompt 5 persists draft commits.
- Prompt 5b should run immediately after Prompt 5 if Prompt 5 lands with conditional evidence only, because explicit soft-warning acknowledgement and authenticated valid/invalid commit proof are part of the same persistence gate, not optional polish.
- Prompt 5c should run after Prompt 5b if API-level closure is strong but the browser-valid save path is still unproven or the dock UI is still too messy to trust as the durable operator workflow.
- Prompts 6a, 6b, and 6c must run in order and must not be compressed into one oversized pass.
- Prompt 7 has two lanes: runtime/source honesty can run early if faculty pages are already broken, but revision-aware freshness depends on Prompts 6a-6c.
- Prompt 8 should run after exact repair targets are available.
- Prompts 9a-9d are follow-up performance passes and should run only after UI contracts are stable.
