# Changelog

## [2026-08-26] — Generation Fallback Grade-Scope Fix

### Fixed
- Generation constructor now filters CLASSROOM fallback candidates by `building.gradeScope` — Grade 8/9/10 sections can no longer consume Grade 7-only classrooms during fallback
- Homeroom candidate also requires grade-scope compatibility before being added to the fallback pool
- Capacity overflow fallback (specialized rooms) also respects grade scope
- Extended `RoomInput` with `buildingGradeScope: number[]` field
- Extended Prisma room query to include `building.gradeScope` in generation input
- Added `isRoomGradeScopeCompatible` helper function

### Tests
- 6 new grade-scope fallback tests in `phase2-home-room-strategy.test.ts` covering: cross-grade fallback blocked, matching fallback eligible, any-grade fallback, cross-building same-grade, exhaustion, no cross-grade displacement
- All 38 tests pass

## [2026-08-26] — Home-Room Auto-Assign QA Blocker Fix Prompt

### Added
- Follow-up Prompt 06 for closing grade-scoped home-room auto-assignment QA blockers.
- Explicit backend test requirements for preview/apply, grade-scope matching, validation, capacity behavior, and skip reasons.
- Final proof requirements for generated artifact cleanup, oversized component extraction, Tailnet invalid-input probes, and fresh generation comparison.

### Changed
- The sequence now has a dedicated QA blocker closure prompt after the initial five-prompt implementation chain.

### Decisions Made
- Invalid auto-assign payloads must return `400` instead of silently coercing to defaults.
- Capacity behavior must be implemented or explicitly documented and tested as waived.
- Fresh generation proof is required before claiming hard violations are resolved.

### Open Questions
- Whether the executor is authorized to mutate Tailnet building grade scopes for live proof, or must use local/disposable scoped-building proof only.

## [2026-08-26] — Home-Room Auto-Assign and Building Grade Scope

### Added
- `gradeScope Int[]` field on `Building` Prisma model (migration 0037) — `[]` means any grade, `[7,8]` means Grade 7 or 8 only
- Building create/update API validates grade scope values (7, 8, 9, 10 only), normalizes duplicates, sorts uniquely
- BuildingPanel grade scope editing UI with DepEd-colored grade chips (G7=green, G8=yellow, G9=red, G10=blue)
- CampusMapEditor includes gradeScope in save payload
- `home-room-auto-assign.service.ts` — preview/apply auto-assignment logic respecting building grade scope, room teaching-space status, and section grade
- `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` endpoint with `mode=preview|apply`, `overwriteExisting`, `allowCrossGradeFallback` options
- `HomeRoomAutoAssignDialog.tsx` — compact preview/apply UI with grade-grouped assignments, skipped-section reasons, overwrite/cross-grade toggles
- Sections page "Auto-assign rooms" button (visible when sections need rooms)
- 3 new UX guardrail tests for auto-assign workflow

### Changed
- Building type now includes `gradeScope: number[]`
- Sections page "start here" banner now mentions "Auto-assign rooms" as an option
- UX guardrail test updated for new banner text

### Decisions Made
- Grade scope is persisted as `Int[]` on Building (not on Room) — buildings are the grade-confinement unit
- Empty grade scope `[]` means "any grade can use rooms in this building"
- Auto-assign defaults: `overwriteExisting=false`, `allowCrossGradeFallback=false`
- Grade number extracted from `gradeLevelName` (e.g., "Grade 7" → 7), not from `gradeLevelId` (which is an internal ID)
- Capacity check is not enforced in auto-assign (dummy data capacity is unreliable per Prompt 01 analysis)

### Open Questions
- Whether to set grade scope on existing academic wing buildings to match their names (e.g., "Grade 7 Academic Wing" → `[7]`) — left as operator decision
- Whether to run a fresh generation after auto-assign to prove reduced violations — requires live Tailnet server restart

## [2026-08-26] — Timetable Swap Old-Scheduler UX Prompt Sequence

### Added
- Added `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md` for end-to-end executor sequencing.
- Added five prompt files covering baseline fixture capture, generated swap visual redesign, draft review parity, blocked auto-fix/manual actions, and release proof.

### Changed
- Framed swap redesign as a phased executor handoff with live Tailnet gates before each dependent prompt.

### Decisions Made
- Treat automated browser proof as technical evidence only; Product GO still requires real older-scheduler moderated validation or explicit stakeholder deferral.
- Keep all non-mutating swap browser gates from committing live timetable writes.

### Open Questions
- Whether the executor can create a safe draft-swap fixture live without committing writes; Prompt 03 must classify this explicitly.
