# Changelog

## [2026-08-28] — Timetable Status Key 200 Percent Reflow Prompt

### Added
- Added Prompt 13 to close the remaining Status key 200% reflow accessibility caveat.
- Added explicit testing requirements for Status key reachability, direct definitions, More-menu closure, local scroll, focus behavior, and no root overflow at 200% text size.
- Added source-guard requirements so Status key dialog-open failures cannot be hidden as fixture-limited skips.

### Changed
- Extended the timetable old-scheduler remaining-issues sequence with a final accessibility closure prompt after Prompt 12.

### Decisions Made
- Status key failure at 200% is an old-scheduler accessibility blocker, not a harmless fixture limitation.
- Generated unassigned queue fixture limits must be separated from Status key accessibility proof.

### Open Questions
- Whether passing Prompt 13 is sufficient for Technical GO, or whether moderated older-scheduler validation will still be required before product signoff.

## [2026-08-28] — Timetable Old-Scheduler Remaining Issues Sequence

### Added
- Added a four-prompt continuation sequence for the remaining timetable old-scheduler release blockers.
- Added Prompt 09 for stale Playwright label and release-contract alignment.
- Added Prompt 10 for deterministic teacher-departure save/revert proof after generation.
- Added Prompt 11 for touch queue, focus/cancel, draft-planning, and readiness-sheet fixture repair.
- Added Prompt 12 for cumulative release proof across live Tailnet, source guards, and focused browser gates.

### Changed
- Continued the existing Simple timetable old-scheduler numbering after Prompt 08 instead of overwriting prior finalization work.

### Decisions Made
- Full post-generation teacher-leaving readiness requires an isolated reversible mutation proof, not only UI reachability or preview success.
- Stale active specs must be corrected to assert current plain-language UX instead of old dialog/menu labels.
- Fixture-limited states are acceptable only after a deterministic fixture path has been attempted.

### Open Questions
- Whether moderated Product GO will be run separately after Technical GO, or explicitly deferred by the user.

## [2026-08-28] — Timetable Old-Scheduler Release Proof Cleanup

### Added
- Added the missing `07-exhaustive-surface-proof` artifact directory with screenshot references, `surface-proof-metrics.json`, and `fixture-limitations.json`.

### Changed
- Replaced the remaining stale Advanced timetable helper copy that referenced `Review occupied-slot swap` with the current `Swap these two classes?` wording.
- Updated the old-scheduler UX guardrail to reject the stale occupied-slot swap wording.

### Decisions Made
- The exhaustive artifact JSON records copied screenshot provenance separately from the current source cleanup so the proof does not overstate fixture coverage.

### Open Questions
- Draft parity and blocked swap recovery remain fixture-limited until deterministic non-destructive fixtures are available.

## [2026-08-28] — Timetable Simple Old-Scheduler Finalization Follow-Up Prompts

### Added
- Added Prompt 06 to remediate independent Codex NO-GO findings for Status key, More-menu layer lifecycle, swap preview failure, and stale test contracts.
- Added Prompt 07 to require exhaustive non-mutating Tailnet proof across every reachable timetable surface.
- Added explicit wall-of-text measurement thresholds for timetable modals, sheets, drawers, popovers, and menus.

### Changed
- Extended the Simple old-scheduler finalization sequence from Prompts 00-05 to Prompts 00-07.
- Updated the phase ledger to state that the Prompt 00-05 completion report is not sufficient for Technical GO after independent QA.

### Decisions Made
- The executor must fix the real NO-GO issues before running exhaustive proof.
- The final proof must open all reachable timetable surfaces rather than relying only on focused smoke specs.
- Product GO remains pending moderated older-scheduler validation unless explicitly deferred or accepted by the user.

### Open Questions
- Whether fixture-limited draft and blocked swap states can be made deterministic without live destructive timetable writes.

## [2026-08-28] — Timetable Simple Old-Scheduler Finalization Prompts

### Added
- Added a six-phase executor prompt sequence for finalizing the Simple timetable old-scheduler UX.
- Added phase prompts covering regression guards, help/status repair, persistent next-action guidance, More menu decompression, decision-state parity, and cumulative release proof.
- Added a phase-level sequence ledger mirroring recent ATLAS prompt-sequence conventions.

### Changed
- Folded the known swap regression-spec caveat into the new Prompt 00 baseline instead of treating it as a separate manual follow-up.

### Decisions Made
- The executor must test itself before moving from each phase to the next.
- Final QA will happen after Prompt 05, with one cumulative evidence report instead of per-prompt Codex QA handoffs.
- Product GO remains separate from Technical GO until moderated older-scheduler validation occurs or is explicitly deferred.

### Open Questions
- None for prompt sequencing.

## [2026-08-27] — Timetable Swap Landscape Action-Sheet Pattern Prompt

### Added
- Added `docs/prompts/timetable-swap-old-scheduler-08-landscape-action-sheet-pattern-2026-08-27.md` for the remaining Prompt 07 live Tailnet failure.
- Added explicit requirements to replace the short-height landscape pattern instead of continuing to shrink the centered modal.
- Added hard `844x390` gates for `recommendedIntersectsFooter=false`, zero strategy rows intersecting the footer, visible selected status before scroll, and no unreadably tiny decision-control text.

### Changed
- Updated the timetable swap old-scheduler sequence to include Prompt 08 after the mobile landscape decision-fit prompt.

### Decisions Made
- Prompt 07 remains `NO-GO` because live Tailnet reproduced `recommendedIntersectsFooter=true`.
- The next fix must change layout structure for short-height landscape, not rely on smaller font sizes or reduced padding.
- Product GO remains pending real older-scheduler moderated validation even after technical gates pass.

### Open Questions
- Whether the executor will choose a bottom action sheet, a two-column decision layout, or another equivalent short-height pattern that keeps the recommendation fully above the footer.

## [2026-08-27] — Timetable Swap Mobile Landscape Decision-Fit Prompt

### Added
- Added `docs/prompts/timetable-swap-old-scheduler-07-mobile-landscape-decision-fit-2026-08-27.md` for the remaining old-scheduler QA blocker after Prompt 06.
- Added explicit `844x390` acceptance criteria for visible strategy rows, visible selected blocker/warning status, footer geometry, and old-scheduler decision-readiness.
- Added requirements for the Playwright visual-decision spec to fail when strategy rows are hidden behind the footer or the chosen status is only visible after scrolling.

### Changed
- Updated the timetable swap old-scheduler sequence to include Prompt 07 after the QA blocker fix prompt.

### Decisions Made
- Mobile landscape must be decision-first, even if desktop and mobile portrait keep the relaxed three-region layout.
- Blocked recovery must not be reported as `PASS` unless a blocked state is actually rendered and asserted.
- The old-scheduler QA verdict is based on whether the scheduler can choose or cancel without first scrolling.

### Open Questions
- Whether the executor should keep the separate selected-status card outside short-height landscape or fully merge selected status into the strategy rows across all responsive states.

## [2026-08-27] — Timetable Swap Old-Scheduler QA Blocker Fix Prompt

### Added
- Added `docs/prompts/timetable-swap-old-scheduler-06-qa-blocker-fix-2026-08-27.md` as a follow-up executor prompt for the Prompt 05 `NO-GO` findings.
- Added explicit blocker-fix requirements for raw native controls, actual modal body geometry, footer overlap, blocked-state proof, draft parity proof, and committed-scope evidence.
- Added Tailnet viewport evidence requirements for `1366x768`, `390x844`, and `844x390`.

### Changed
- Updated the timetable swap old-scheduler sequence to include Prompt 06 after the original release-proof prompt.

### Decisions Made
- The next executor pass must not claim `GO` unless blocked recovery is actually exercised or explicitly remains `NO-GO`.
- Skipped draft checks must be reported as fixture-limited instead of counted as full pass evidence.
- QA artifacts must either be tracked intentionally or documented as local-only evidence.

### Open Questions
- Whether durable Playwright regression specs should be moved into a tracked test directory or force-added from the ignored `qa-artifacts/` path.

## [2026-08-27] — AIMS/SMART Term-Aware API Context

### Added
- Added `docs/reference/aims-smart-term-aware-api-context-2026-08-27.md` as a consolidated handoff for AIMS and SMART term-aware integration.
- Documented active-term runtime context, published schedule `termIndex` filtering, workbook export filtering, term-scoped violations, and affected-term notification metadata.
- Added explicit term-aware rotating subject guidance for `SCIENCE` and TLE rotation families, including Teaching Load fields and peak-term crediting rules.

### Changed
- Clarified that legacy `/schedules/published/:termId` routes are compatibility-only and new consumers must use explicit school-year routes plus `?termIndex=...`.

### Decisions Made
- AIMS and SMART should treat EnrollPro active term as runtime current-state context and ATLAS entry `termIndex` as durable schedule truth.
- Consumers should use `termIndex=active` only when ATLAS can verify EnrollPro active term, otherwise fall back to explicit numeric terms or all-term reads.

### Open Questions
- Whether this consolidated handoff should replace or be cross-linked from the existing AIMS published schedule guide and SMART rollover endpoint guide.

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

## [2026-08-27] — Timetable Swap Decision Clarity Prompt

### Added
- Added Prompt 09 for closing Prompt 08's old-scheduler release gaps with an explicit three-region generated swap decision panel.
- Added verification requirements for affected-class visibility, selected-status visibility, action-region overlap, calm warning copy, and full swap Playwright proof.

### Changed
- Extended the timetable swap old-scheduler sequence with a Prompt 09 row and Prompt 08 follow-up QA evidence.
- Replaced fragile section-count release criteria with explicit primary-region instrumentation requirements for generated swap.

### Decisions Made
- Prompt 08 remains `NO-GO` because the live `844x390` body still scrolls, affected-class/status content intersects the action band, and browser specs fail.
- The next fix must prioritize scheduler decision clarity over further pixel shaving.

### Open Questions
- Whether a deterministic blocked-swap fixture can be created without live destructive timetable writes remains unresolved.

## [2026-08-27] — Timetable Swap Real Footer Regression Prompt

### Added
- Added Prompt 10 to close Prompt 09's remaining target-user QA failures.
- Added mandatory fail-first proof so the executor must demonstrate the current candidate fails the intended old-scheduler contract before fixing it.
- Added exact requirements for measuring the real footer/action bar, exact primary-region count, mobile portrait clipping, and `844x390` no-scroll decision proof.

### Changed
- Extended the timetable swap old-scheduler sequence with a Prompt 10 row and Prompt 09 follow-up QA evidence.
- Tightened the required browser proof so passing tests cannot rely on an inner placeholder action region or relaxed `primaryRegionCount >= 1` assertions.

### Decisions Made
- Prompt 09 remains `NO-GO` despite passing Playwright because the tests did not measure the real footer and the live target-user probe still showed overlap and scroll.
- The next executor pass must repair the regression test contract before claiming a UI fix.

### Open Questions
- Whether blocked recovery can be proven with a deterministic non-mutating fixture remains unresolved and must stay fixture-limited until proven.

## [2026-08-28] — Repository Declutter and Ignore Rules

### Added
- Added root cleanup folders under `docs/`, `stakeholderFiles/root-reference/`, and ignored `qa-artifacts/root-*` buckets.
- Added granular `.gitignore` rules for local caches, editor folders, runtime logs, generated QA artifacts, Playwright traces, build output, and environment files.

### Changed
- Moved root API/user/integration guides into `docs/guides/`.
- Moved root audit/design/prompt notes into `docs/audits/`, `docs/design/`, and `docs/prompts/archive/`.
- Moved root stakeholder Office/PDF reference files into `stakeholderFiles/root-reference/`.
- Moved one-off root QA scripts, screenshots, logs, and text outputs into ignored `qa-artifacts/root-*` folders.
- Updated current documentation references that pointed at old root guide and workbook paths.

### Decisions Made
- Kept canonical root project files in place: `README.md`, `package.json`, `package-lock.json`, `playwright.config.ts`, `prisma.config.ts`, `ATLAS_AGENT_KI.md`, `GEMINI.md`, `CHANGELOG.md`, and `phasePlan.md`.
- Kept reusable QA source files eligible for tracking while excluding generated QA evidence from future `git add .` runs.
- Kept `AGENTS.md` ignored because it contains local operational instructions and credentials.

### Open Questions
- None for this cleanup pass.
