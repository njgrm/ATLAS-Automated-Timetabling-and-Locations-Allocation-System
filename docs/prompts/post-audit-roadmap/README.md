# ATLAS Post-Audit Roadmap Execution Prompts

Run these prompts serially. Each wave must meet its exit gate before the next wave may claim GO.

| Order | Prompt | Primary result |
|---:|---|---|
| 1 | `01-live-faculty-access-and-proof.md` | Real faculty identity resolves consistently across every My Portal route. |
| 2 | `02-high-risk-scheduler-workflows.md` | Teaching Load, Timetable, Room Schedules, and Audit become task-first and safer. |
| 3 | `03-setup-qol-and-progressive-disclosure.md` | Subjects, Sections, Teachers, and Campus Map reduce repetitive operator work. |
| 4 | `04-cross-role-trust-and-usability-closure.md` | Shared status/recovery patterns and final live usability evidence are consistent. |

## Invariants

- Phase 3 generator readiness remains the functional delivery stream; these prompts are a UX/QoL overlay.
- Do not alter schedule truth, role permissions, publish gates, or EnrollPro ownership.
- Use `@/ui/*`, `motion/react`, and `lucide-react`; do not add raw styled controls.
- Preserve the no-scroll shell and selected-run timetable contract.
- Use RED→GREEN tests for logic or contract changes.
- Keep every React component below 1,000 lines.
- Verify live Tailnet routes and record exact evidence; localhost-only evidence cannot close a live gate.
