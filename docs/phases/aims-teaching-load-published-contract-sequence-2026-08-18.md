# AIMS Teaching Load and Published Schedule Contract Sequence — 2026-08-18

## Purpose

This sequence turns the current AIMS/ATLAS scheduling integration into a safe, explicit contract. It prevents Teaching Load suggestions from being mistaken for saved Teaching Load, prevents historical/dummy published schedules from being exposed as the current schedule, and gives AIMS stable school-year and EnrollPro identity fields to consume.

Run these prompts one at a time. After each prompt, stop and report back to Codex QA for review before continuing.

## Current confirmed evidence

Observed on Tailnet `https://njgrm.buru-degree.ts.net` on 2026-08-18:

- Runtime active school year resolved to `2` during the probe.
- Creating a Teaching Load suggestion preview did not change canonical Teaching Load:
  - before preview: `assignedPairs=2`, `unassignedPairs=263`
  - after preview: `assignedPairs=2`, `unassignedPairs=263`
  - after cancelling: `assignedPairs=2`, `unassignedPairs=263`
- The suggestion proposal was persisted as a `TeachingLoadSuggestionProposal` and then cancelled.
- `GET /api/v1/schools/1/schedules/published` returned published run `425` from `schoolYearId=5`, even though runtime active school year was `2`.
- `GET /api/v1/schools/1/schedules/published/2` returned `404`.
- `GET /api/v1/schools/1/schedules/published/5` returned run `425`.
- The route named `GET /api/v1/schools/:schoolId/schedules/published/:termId` currently passes that path parameter into the published schedule service as a school-year filter, not a term filter.
- Public schedule entries currently expose nested `faculty.id` as an ATLAS internal faculty mirror ID, not an EnrollPro external teacher ID.

Treat those numeric IDs as live evidence, not permanent constants. Every prompt must derive the active school year dynamically in tests.

## Sequence and gates

| Iteration | Prompt file | Scope | Gate to proceed |
|---:|---|---|---|
| 01 | `docs/prompts/mimo-aims-tl-01-baseline-and-proposal-isolation-2026-08-18.md` | Lock current behavior and prove suggestion preview isolation | Backend and Tailnet proof show preview/cancel does not mutate Teaching Load or published schedules |
| 02 | `docs/prompts/mimo-aims-tl-02-current-year-published-guard-2026-08-18.md` | Make the default public endpoint current-year only | Default `/published` cannot return a historical run when active year has no published run |
| 03 | `docs/prompts/mimo-aims-tl-03-explicit-school-year-published-routes-2026-08-18.md` | Add explicit school-year published schedule routes | AIMS can request a school year explicitly and historical access remains intentional |
| 04 | `docs/prompts/mimo-aims-tl-04-term-route-contract-correction-2026-08-18.md` | Remove term/school-year ambiguity | Term routes no longer masquerade as school-year filters |
| 05 | `docs/prompts/mimo-aims-tl-05-external-id-payload-contract-2026-08-18.md` | Add EnrollPro-compatible identity fields | Published payload contains ATLAS IDs and EnrollPro external IDs with clear names |
| 06 | `docs/prompts/mimo-aims-tl-06-aims-documentation-handoff-2026-08-18.md` | Update AIMS guide and integration warnings | AIMS docs clearly say which endpoints to use and which not to use |
| 07 | `docs/prompts/mimo-aims-tl-07-ui-cleanup-and-release-proof-2026-08-18.md` | Minor UI cleanup and full release proof | All gates pass and Tailnet evidence confirms the contract end to end |

## Global executor rules

- Do not write to EnrollPro, SMART, or AIMS.
- Do not make AIMS consume Teaching Load suggestions.
- Do not expose proposal previews through public schedule endpoints.
- Do not weaken publish rules.
- Do not mark draft/generated schedules as published for convenience.
- Do not assume hardcoded active school-year IDs in tests.
- Do not use `GET /api/v1/generation/:schoolId/:schoolYearId/runs/latest/timetable` as an AIMS final-sync contract.
- Preserve public published schedule read performance. Do not load every completed run with full JSON payloads to select a candidate.
- Keep server runtime imports ESM-safe with explicit `.js` endings.
- Use only reversible live writes in Tailnet tests and clean up proposals in `finally`.

## Required final report format for each prompt

Mimo must report:

1. `GO` or `NO-GO`.
2. Files changed.
3. Exact commands run and results.
4. Tailnet endpoint outputs used as proof.
5. Whether any proposal/run/test artifact was created.
6. Cleanup proof for created artifacts.
7. Remaining caveats.
8. Whether Codex QA can proceed to the next prompt.

## Suggested commit after all prompts

```text
fix(api): stabilize AIMS published schedule integration contract
```
