# Teaching Load Coverage Drilldown Sequence — 2026-08-22

Use this sequence to repair the dashboard-to-Teaching-Load path where ATLAS says a subject still needs a teacher but the operator cannot tell which subject-section pair is missing coverage.

## Background

Current observed behavior:

- Dashboard reports missing teacher coverage and sends users to `/teaching-load`.
- Teaching Load visibly exposes `Teachers` and `Sections`, but not a dedicated subject shortage view.
- Subjects has a `Teacher coverage` column, but it treats a subject as ready if any teacher has that subject. That hides partial subject-section gaps.
- The backend already has the stronger coverage source at `/api/v1/faculty-assignments/coverage/summary`, including `uncoveredSectionCount`, `ownedSectionCount`, `relevantSectionCount`, `coveragePercent`, and `status`.

## Sequence

| Order | Prompt file | Outcome |
|---:|---|---|
| 1 | `teaching-load-coverage-01-contract-alignment-2026-08-22.md` | Establish one coverage truth source and typed client helpers. |
| 2 | `teaching-load-coverage-02-subject-shortage-view-2026-08-22.md` | Add a visible Teaching Load `Subjects` view focused on uncovered subject-section rows. |
| 3 | `teaching-load-coverage-03-subjects-page-coverage-2026-08-22.md` | Make `/subjects` table and drawer show real subject-section coverage. |
| 4 | `teaching-load-coverage-04-dashboard-routing-2026-08-22.md` | Route dashboard readiness directly to the actionable shortage view. |
| 5 | `teaching-load-coverage-05-release-proof-2026-08-22.md` | Verify the full journey and document GO/NO-GO evidence. |

## Rules

- Do not change canonical Teaching Load ownership in prompts 01, 03, 04, or 05.
- Prompt 02 may add/edit drafts only through existing Teaching Load controls; it must not create a new write path.
- Treat subject-section pairs as the actionable coverage unit.
- Do not use `/subjects/stats/:schoolId` as the teacher-coverage readiness source after Prompt 01 unless retained only for legacy compatibility.
- Preserve the ATLAS no-scroll frontend contract.
- Use `@/ui/*` primitives, Radix/shadcn controls, `lucide-react` icons, and existing SMART-family page patterns.

## Required run order

Run prompts in order. Do not start Prompt 02 until Prompt 01 is GO, because the UI must depend on a stable coverage contract. Do not start Prompt 04 until Prompt 02 and Prompt 03 are GO, because dashboard routing must link to implemented destinations.

## Final sequence acceptance

The sequence is GO only when:

- Dashboard names or routes to the exact missing coverage work.
- Teaching Load has a visible subject coverage/shortage view.
- Subjects table can show partial coverage such as `19/20 covered`, not just `Ready`.
- A user can answer: "Which subject still needs a teacher, and which section is missing it?"
- Build, focused tests, UX guardrails, and Tailnet journey proof are recorded.
