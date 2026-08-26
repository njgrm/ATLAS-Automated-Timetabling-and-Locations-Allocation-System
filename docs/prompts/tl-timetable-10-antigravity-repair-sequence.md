# TL Timetable 10: Antigravity Repair Sequence

## Purpose

This sequence closes the QA/QC gaps found after the latest Antigravity timetable commits:

- `55bab39 feat(timetable): implement dynamic setup sync and client caching optimization`
- `fb09010 fix(timetable): resolve typescript and type definition compile errors`

Those commits added useful pieces: setup sync, Quick Place preview/apply, Quick Place UI, published schedule event tests, and large timetable component extraction. They did not fully close the dynamic timetable, KISS UX, source-honesty, frontend guardrail, or maintainability objectives.

## Required Order

Run these prompts in order:

1. `tl-timetable-10a-quick-place-trust-and-contract-repair-prompt.md`
2. `tl-timetable-10b-unassigned-teaching-load-repair-completion-prompt.md`
3. `tl-timetable-10c-timetable-kiss-regression-cleanup-prompt.md`
4. `tl-timetable-10d-frontend-guardrail-readability-cleanup-prompt.md`
5. `tl-timetable-10e-component-extraction-repo-hygiene-prompt.md`

## Why This Order

1. Quick Place must first become source-honest and contract-compatible because later unassigned repair and UX flows depend on trustworthy placement output.
2. Unassigned Teaching Load repair is the main missing product behavior. It turns `/timetable` from a scheduled-entry editor into a truly dynamic repair workspace.
3. KISS cleanup should happen after the underlying behavior is correct so copy and workflow labels match the real system.
4. Frontend guardrail/readability cleanup should then remove primitive and typography violations across touched surfaces.
5. Component extraction and repo hygiene should run last so the final implementation is reviewable and maintainable without interrupting product behavior fixes.

## Completion Standard

The sequence is not complete until all five prompts return `GO`, with:

- server and client builds passing where applicable
- targeted tests passing
- Tailnet browser QA evidence for `/timetable`
- no raw native controls or raw DOM `title=` in touched React files
- no touched React/hook file over 1000 lines
- no misleading Quick Place labels or room-assignment metadata
- unassigned rows supporting Teaching Load repair from inside `/timetable`

