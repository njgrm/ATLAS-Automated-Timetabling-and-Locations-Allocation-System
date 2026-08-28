# 2026-05-16 — Phase 6 Live Tailnet Validation (Faculty Assignment Grid, Auto-Fill, Command Center, Manual Actions)

### Added
- Live tailnet validation evidence for officer/admin login, navigation, smart grid, auto-fill, assignment grid health indicators, and manual assignment/swap/reset/undo/redo actions in docs/verification/evidence-log.md
- Screenshot artifact and findings for manual assignment, swap, reset, undo/redo actions: docs/verification/artifacts/phase6-faculty-assignment-manual-actions-2026-05-16.md

### Changed
- None (validation only, no code changes)

### Decisions Made
- Confirmed backend and frontend Phase 6 requirements are met in live tailnet environment for officer/admin role
- Confirmed manual assignment, swap, reset, undo/redo, and edge case handling all function as required

### Open Questions
- None (all Phase 6 validation steps complete)
# Changelog

## [2026-05-15] — Faculty Assignments Master Plan (Phase 6)

### Added
- Created `docs/phases/requirements-phase6-faculty-assignment-master.md` bridging UI UX fixes and backend Algorithm safeguards.
- Defined requirements for Strict Tier 1 aliasing to eliminate implicit Science favoritism in the Auto-Fill queue.
- Defined "Smart Grid" upgrades including Load Impact Previews, Conflict Visibility (Swap capability), Bulk Select, and Section Health Indicators.
- Overhauled the Auto-Fill feedback loop to suppress toasts and use a unified Staffing Shortage Report Modal.
- Added explicit UI toggle requirements for `canTeachOutsideDepartment` to bypass Tier 1 strictness.
- Added intelligent Staffing Shortage recommendations to explicitly suggest cross-assignment for under-loaded teachers.
- Added quick-filter chips for Load Status (Overloaded, Optimal, Under-loaded) and Unmapped Specializations (Action Required) to the Left Panel.
- Added strict tailnet validation for 100% assignment coverage and testing of the "teaching outside department" constraint.

### Added
- Created `docs/phases/requirements-phase5-faculty-assignment-fixes.md` to formally document the required fixes for the Teaching Load module.
- Defined strict alias-only matching requirements for `getQualificationTier` to stop fuzzy/smart match fallbacks.
- Outlined structural UX fixes: relocating the Auto-Fill button to a global scope with execution feedback, splitting the filter dropdowns into searchable Department/Specialization comboboxes, removing the redundant adviser banner, and fixing the "Assigned" metrics to exclude system-generated HG records.
- Added AC-06 mandating live tailnet testing to ensure 100% assignment coverage without overlapping faculty.
- Added a Verification & Documentation requirement to explicitly log algorithm edge cases and test results for continuous optimization.
- Added FR-06 for State Management, requiring Undo/Redo buttons, Ctrl+Z/Ctrl+Y hotkeys, and a Reset function that strictly preserves HG advisory records.

### Added
- Created `docs/phases/requirements-subjects-ui-sync.md` to formally document the required fixes for `SubjectFormModal.tsx` and legacy database overlaps.
- Drafted exact execution steps for frontend modal restructuring (3 logical sections: Basic Identity, Grid & Time Constraints, Advanced Grouping).
- Defined seed updates for 60-minute alignment (ENG, MATH to 240m) and grid-exclusion for Homeroom Guidance (`isSeedable: false`).
- Added Prisma upsert warning to ensure seed scripts actively overwrite `isActive`, `isSeedable`, `minMinutesPerWeek`, and `name`.
- Added seed deactivations for specialized TLE ICT (7-10) and individual SPA arts (Dance, Music, etc.).
- Added requirements to seed the new unified `SPA_SPEC` and `DEVL_READING` subjects as active, while completely removing NRP/NMP.
- Added requirement for an "Active Status Toggle" in the Basic Identity section of the UI to gracefully disable subjects instead of deleting them.
- Added AC-07 to verify seed updates actively push to the tailscale live environment via the public ATLAS subject endpoints.

### Added
- Completed `docs/phases/requirements-science-rotation.md` with EARS syntax.
- Added `[FR-05] Seed Data Standardization & Corrections` to the PRD, encompassing all validated CSV fixes (TLE cohorts, SPA specs, NRP/NMP, 240m shifts, and renaming logic).
- Added `FR-02.3` and `FR-02.4` to define how the unified Demand Item inherits its `preferredRoomType` and `subjectCode` during aggregation.
- Added `FR-04.3` to gracefully flag "Incomplete Modular Group" warnings if a scheduler completely omits a modular quarter during assignment.

### Changed
- Updated Acceptance Criteria (AC-02, AC-03) to explicitly enforce testing against live EnrollPro-synced sections and faculty instead of hardcoded placeholder names, aligning with the tailscale operational environment.
- Decided on `metadata.modularAssignments` array structure instead of overriding `facultyId` for modular merged subjects.
- Decided to introduce `modularGroupId` and `modularOrder` into the `Subject` model instead of overloading the `SessionPattern` enum.

### Decisions Made
- Confirmed that DO 005 s.2024 calculates load by exact minutes (45 vs 60), validating the current 225-minute seed and Teaching Load UI color-coding logic.
- Decided to flag incomplete modular assignments with "Lacking Faculty" warnings rather than applying hard generation blockers to reflect real-world staffing delays.

### Open Questions
- None. Implementation is ready to proceed.

## [2026-05-13] - Wave 4.6 Implementation Plan and Checklist Draft

### Added
- Expanded `docs/phases/wave-4-6-execution-plan-2026-05-12.md` into an actionable checklist with source alignment, faculty mirror, specialization mapping, auth, generation, and evidence gates.

### Changed
- The Wave 4.6 plan now explicitly states the operational 142-faculty target while preserving 145 upstream records for traceability.
- The plan now documents the ASDF traceability decision and the requirement to exclude those records from operational seeding.

### Decisions Made
- Keep the ASDF faculty in the upstream mirror for traceability.
- Exclude the ASDF faculty from assignment selection and timetabling.
- Treat funnel-hosted client/server source alignment and JWT propagation as explicit acceptance gates.

### Open Questions
- None for the plan draft itself; remaining work is execution and verification.

## [2026-05-12] - Wave 4.6 Tailscale Source Execution and Load Seeding Repair

### Added
- Tailscale-host execution evidence using `ENROLLPRO_API=http://dev-jegs.buru-degree.ts.net:5002/api` for live EnrollPro sync/seeding.
- One-run generation benchmark artifact at `atlas-server/docs/verification/artifacts/phase3-benchmark-2026-05-12T15-37-54-639Z-school1-year1-runs1.json`.

### Changed
- `atlas-server/src/services/seeded-teaching-load.service.ts` now qualifies faculty by specialization first, then department, with `SpecializationAlias` canonicalization before subject matching.
- Seed input loading for deterministic assignments now pulls `FacultyMirror.specialization` and school-level specialization alias mappings.

### Decisions Made
- EnrollPro-source runtime checks and seeding should run against the Tailscale hostname endpoint, not the old IP fallback.
- Assignment seeding matching now treats specialization as a primary signal to avoid zero-coverage outcomes when upstream departments are null.

### Open Questions
- `verify-enrollpro-source` currently re-syncs and re-prunes scopes before diagnostics; should verification include a no-sync mode to avoid masking post-seed assignment state?
- Current generation runtime exceeded target (`183845ms`); additional optimization pass is still required to satisfy the `<60s` objective.

## [2026-05-12] - Teaching Load Validation and Specialization Mapping Batch Save

### Added
- Daily-load warning propagation for review/explainability surfaces using `FACULTY_DAILY_STANDARD_EXCEEDED`.
- Staged add/delete buffering with save/undo controls in `atlas-client/src/pages/SpecializationMapping.tsx`.

### Changed
- `atlas-server/src/services/manual-edit.service.ts` and `atlas-server/src/services/pre-generation-draft.service.ts` now describe the new daily-load warning consistently.
- `atlas-client/src/components/ExplainabilityDrawer.tsx` and `atlas-client/src/components/PolicyImpactSummary.tsx` now surface the 6-hour daily warning.
- `atlas-client/src/pages/SpecializationMapping.tsx` now uses a batch-save workflow instead of immediate writes.

### Decisions Made
- Daily teaching load now has a soft warning at 6 hours and a hard block at 8 hours.
- Specialization mapping edits should be staged locally until the user commits them.

### Open Questions
- Whether the batch-save workflow should also persist a change summary for audit/history.

## [2026-05-12] - Wave 4.6 Execution Plan Draft

### Added
- `docs/phases/wave-4-6-execution-plan-2026-05-12.md` with the execution order for EnrollPro-sourced teaching-load seeding, specialization coverage repair, adviser-to-HG mapping, realistic building verification, and generation retry/root-cause logging.

### Decisions Made
- Faculty data for load seeding must come from EnrollPro-fetched mirrors and snapshots rather than synthetic seeded faculty.
- The generation retry should target zero unassigned classes, with any remaining blockers documented by root cause.

### Open Questions
- Which cached EnrollPro faculty snapshot should be treated as canonical if more than one is available.

## [2026-05-10] - Publish Phase Teacher-Move Prompt Draft

### Added
- `docs/prompts/publish-phase-teacher-move-execution-prompt.md` as a self-contained implementation prompt for the publish-phase teacher-move policy toggle and occupancy-plan room-count alignment.

### Decisions Made
- Teacher-move should be explicit in the header at all times, with editing kept in the policy panes.
- Building seed alignment should be treated as a prerequisite to publish-phase work.

## [2026-05-11] - Subject Normalization and Specialty Coverage

### Added
- `prisma/migrations/0017_normalize_subject_ve_to_esp/migration.sql` to normalize any existing `VE` subject rows to `ESP` and rename the subject to `Edukasyon sa Pagpapakatao`.
- `docs/prompts/enrollpro-subject-normalization.md` as a programmer handoff note for correcting the EnrollPro teacher subject checklist format.

### Changed
- `prisma/seed.js` now seeds `ESP` instead of `VE`, updates the two faculty seeds that referenced `VE`, and adds the STE/SPA specialty subjects needed to match the current EnrollPro subject checklist.

### Decisions Made
- The database subject code should be normalized to `ESP` rather than retaining `VE`.
- STE and SPA specialty coverage should follow the current EnrollPro checklist entries instead of generic placeholder track subjects.
- The occupancy-plan doc indicates 20-room and 24-room classroom layout templates, but no ATLAS seed change was made from that file yet.

### Open Questions
- Whether EnrollPro also needs a data migration for any persisted teacher subject values that still use `VALUES EDUCATION`.
- Whether the occupancy-plan templates should drive a future adjustment to the ATLAS building seed room inventory.

## [2026-05-11] - Hybrid Multi-Seed Scheduler (H-ALG-1 through H-ALG-5)

### Added
- `atlas-server/src/services/hybrid-scheduler.ts` — new hybrid orchestrator implementing 4 deterministic seed profiles (`GRADE_ASC_SUBJECT_ASC`, `MOST_CONSTRAINED_FIRST`, `GRADE_DESC_SUBJECT_ASC`, `SESSION_PATTERN_PRIORITY`), fitness scoring (`scoreFitness`), and hard-conflict repair (`repairHardConflicts`).
- `atlas-server/src/__tests__/hybrid-scheduler.test.ts` — 35 unit tests covering fitness scoring (H-ALG-2), repair operator (H-ALG-3), and integration (H-ALG-1); all passing.
- `atlas-server/src/scripts/benchmark-hybrid.ts` — H-ALG-4 benchmark harness with synthetic dense fixture (8 sections, 9 subjects, 10 faculty, 10 rooms); GO gate confirmed.

### Changed
- `atlas-server/src/services/schedule-constructor.ts` — `ConstructorInput` gains `demandOverride?: DemandItem[]` to allow the hybrid orchestrator to inject pre-computed demand; `computeDemand` exported as pure function.
- `atlas-server/src/services/generation.service.ts` — replaced `constructBaseline` call with `runHybridScheduler`; `RunSummary` extended with `hybridEnabled`, `selectedSeedProfile`, `seedQuality`, `repairImpact`.
- `atlas-server/package.json` — added `test:hybrid-scheduler` and `benchmark:hybrid` npm scripts.

### Benchmark Results (H-ALG-4 — GO)
| Metric | Baseline | Hybrid |
|---|---|---|
| Completion rate | 71.8 % | 72.2 % |
| Policy blocked | 267 | 194 |
| Runtime max | 9.5 ms | 24.3 ms |
| Selected profile | — | SESSION_PATTERN_PRIORITY |

## [2026-05-10] - EnrollPro Source-of-Truth Reset Hardening (Execution Pass 1)

### Added
- Added deterministic prune reset API behavior in `atlas-server/src/routes/faculty.router.ts`:
  - `POST /api/v1/faculty/sync/reset`
  - requires `confirmPrune=true`
  - returns reconciliation and cleanup diagnostics.
- Added reconciliation/parity helper tests in `atlas-server/src/__tests__/faculty-sync-reconciliation.test.ts`.
- Added npm script `test:faculty-sync-reconciliation` in `atlas-server/package.json`.

### Changed
- Updated `atlas-server/src/services/faculty.service.ts`:
  - introduced sync modes (`reconcile` and `prune`),
  - deterministic reconciliation counters (`inserted`, `updated`, `removed`, `skipped`, `deactivated`),
  - hard prune of missing faculty in prune mode,
  - section-scope cleanup for `facultySubject.sectionIds` and `gradeLevels`,
  - completed-run invalidation trigger when source-truth drift is repaired.
- Updated `atlas-server/src/scripts/verify-enrollpro-source.ts` to accept `--expectedFacultyCount` and `--expectedSectionsCount` gates.

### Decisions Made
- Source-of-truth reset now supports hard delete parity mode instead of stale-flag-only behavior when explicitly requested.
- Dependent assignment mappings are reconciled against live section scope as part of sync/reset flow.

### Open Questions
- Whether to add a dedicated DB-backed integration test that executes prune mode end-to-end against seeded EnrollPro payloads.

## [2026-05-10] - New Prompts: EnrollPro Source-of-Truth Reset + Hybrid Algorithm Refactor

### Added
- Added `docs/prompts/enrollpro-source-truth-reset-execution-prompt.md`:
  - deterministic stale-data wipe/prune requirements for faculty/sections/loads,
  - source-of-truth sync hardening gates and count-parity validation.
- Added `docs/prompts/hybrid-algorithm-refactor-execution-prompt.md`:
  - formal execution prompt mapped to `algorithm-hybrid-refactor-plan.md`,
  - batch sequence, benchmark gates, and reproducibility criteria.

### Changed
- Updated `docs/prompts/README.md` to index both new prompts.

### Decisions Made
- EnrollPro source-of-truth enforcement and hybrid algorithm refactor now have explicit queue-ready execution prompts with test/evidence gates.

### Open Questions
- Whether to add a dedicated combined gate prompt linking source-truth reset completion as a hard prerequisite before algorithm benchmarking.

## [2026-05-10] - Class Program Matrix + Occupancy Preview Wiring

### Added
- Added workbook-style class-program matrix preview in `atlas-client/src/components/timetable/ClassProgramMatrixView.tsx` and wired it into the schedule review workspace.
- Added printable occupancy preview in `atlas-client/src/components/room-schedules/OccupancyTemplatePreview.tsx` and wired it into room schedules.

### Changed
- Extended schedule review workspace context/header plumbing to support `presentationMode` switching between workflow and matrix views.
- Extended room schedules toolbar to switch between room schedule and occupancy preview modes, including `11x6` and `13x6` template variants.

### Decisions Made
- Implemented the requested parity surfaces as client-side previews rather than adding a new export pipeline.
- Kept server-side scheduling logic unchanged for this pass.

### Open Questions
- Whether a dedicated Playwright smoke spec should be added for the new matrix and occupancy preview states once the login selector ambiguity is fixed.

## [2026-05-10] - Combined Gate-Closure Prompt for Class Program + Occupancy Deliverables

### Added
- Added `docs/prompts/class-program-and-occupancy-gate-closure-prompt.md`:
  - strict combined closure gate for both new deliverables,
  - mandatory Excel/Word/PDF MCP verification requirements,
  - hard NO-GO blockers for missing parity evidence,
  - unified evidence-log update contract.

### Changed
- Updated `docs/prompts/README.md` to index the new combined gate prompt.

### Decisions Made
- Completion for class-program matrix and occupancy exports now requires one final combined gate with explicit MCP parity proof.

### Open Questions
- Whether to replicate this combined gate format for future report/export initiatives by default.

## [2026-05-10] - New Execution Prompts for Class Program Matrix and Occupancy Export Parity

### Added
- Added `docs/prompts/class-program-matrix-execution-prompt.md`:
  - stakeholder workbook-familiar matrix mode implementation prompt,
  - mandatory MCP validation (Excel-focused),
  - required Context7 preflight and gate criteria.
- Added `docs/prompts/occupancy-form-export-execution-prompt.md`:
  - occupancy export template parity prompt for `11x6` / `13x6`,
  - mandatory Word/PDF MCP checks pre/post implementation,
  - strict structural GO/NO-GO gates.

### Changed
- Updated `docs/prompts/README.md` template index to include both new queue-ready prompts.

### Decisions Made
- New prompt set explicitly requires MCP-based structure verification so Copilot validates quantity/format parity against stakeholder office files before claiming completion.

### Open Questions
- Whether to enforce these same MCP parity gates for future scheduler/admin report exports by default.

## [2026-05-10] - Excel MCP Replacement (haris-musa) + Format Alignment Findings Update

### Changed
- Switched Excel MCP configuration in `C:/Users/njgro/.cursor/mcp.json` from failing `@negokaz/excel-mcp-server` to Python-based `haris-musa/excel-mcp-server` (`python -m excel_mcp stdio`).
- Updated `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md`:
  - Excel MCP status updated to startup-pass,
  - additional workbook structure findings from `CLASS SCHEDULES`,
  - expanded UI/export alignment recommendations for class-program matrix and occupancy preview parity.

### Decisions Made
- Use the Python-based Excel MCP server as the primary Excel ingestion path on this Windows environment.
- Keep placeholder names while preserving real quantitative structure for report/UI parity.

### Open Questions
- Whether to add a dedicated ATLAS export mode that exactly reproduces the multi-band `CLASS SCHEDULES` workbook layout in a printable workbook template.

## [2026-05-10] - Office Files MCP Setup + Extraction Baseline + Alignment Plan

### Added
- Added `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md` with:
  - MCP setup/testing status (Word/PDF startup pass, Excel startup failure details),
  - extracted office-file structure quantities (docx/xlsx/pdf),
  - workflow-fit gap scan and phased implementation plan,
  - operational instructions for MCP-based office-file extraction.

### Changed
- Updated `C:/Users/njgro/.cursor/mcp.json` to include:
  - `word-document-server`
  - `excel`
  - `pdf-reader`
- Updated instruction files with office-file MCP ingestion guidance:
  - `.cursor/instructions.md`
  - `.github/copilot-instructions.md`
- Updated `docs/phases/README.md` to index the new office-file ingestion plan.

### Decisions Made
- Preserve placeholder names in downstream artifacts while using real extracted quantities/layout structure for output/UI alignment.
- Treat Excel MCP binary launch issue as a blocker to resolve early in Phase 1 of the office-ingestion plan.

### Open Questions
- Whether to pin a known-good `@negokaz/excel-mcp-server` version or use a source-built launcher on this Windows environment.

## [2026-05-10] - Faculty UX Expert Hardening Prompt + Playwright Faculty Matrix + QA Instructions

### Added
- `docs/prompts/faculty-ux-expert-hardening-pass.md`: high-bar faculty pass (Context7 design standards, map/building polish, live conflict inspector on mobile + desktop, stricter GO/NO-GO).
- `qa-artifacts/playwright/specs/faculty-full-matrix.spec.ts`: logged-in faculty screenshots for `/my`, `/my/preferences`, `/my/room-preferences` × 3 viewports → `qa-artifacts/screenshots/faculty-ux-refactor/`.
- Root npm script: `test:visual:faculty`.

### Changed
- Expanded `docs/context7-library-map.md` with shadcn/Radix, Motion, and manual QA rubric tied to `DESIGN.md`.
- `docs/prompts/faculty-ux-ui-refactor-execution-prompt.md`: points to expert hardening + faculty Playwright requirement.
- `docs/prompts/faculty-ux-gate-closure-prompt.md`: expert bar, required `npm run test:visual:faculty`, design + Context7 manual QA section.
- `docs/prompts/README.md`, `qa-artifacts/playwright/README.md`: document expert prompt and faculty matrix.
- `.cursor/instructions.md`, `.cursor/instructions/frontend.instructions.md`, `.github/copilot-instructions.md`, `.github/instructions/frontend.instructions.md`: shared-browser QA must reference design docs + Context7 map; faculty gate prompts + Playwright.

### Decisions Made
- Faculty UX has an explicit expert-tier prompt and automated screenshot path separate from guest-only CI visuals.

### Open Questions
- Whether to extend Playwright to multi-step room-request flows (sheet open, map/building tabs) with stable test IDs.

## [2026-05-10] - Faculty Prompt Queue Additions (Gate Closure + Post-GO Polish)

### Added
- Added queue-ready prompt file:
  - `docs/prompts/faculty-ux-gate-closure-prompt.md`
- Added queue-ready prompt file:
  - `docs/prompts/faculty-ux-post-go-polish-prompt.md`

### Changed
- Updated `docs/prompts/README.md` to include both new faculty prompt templates in the suggested template list.

### Decisions Made
- Faculty UX prompt sequence is now explicitly staged:
  1) execution
  2) strict gate-closure + patching
  3) post-GO polish only

### Open Questions
- Whether to mirror this 3-prompt queue pattern for scheduler/admin/public UX refactor tracks next.

## [2026-05-10] - Faculty UX Execution Prompt Hardening (Structural Refactor Enforcement)

### Added
- Added explicit "Critical Clarification" to `docs/prompts/faculty-ux-ui-refactor-execution-prompt.md` that this pass is a structural layout refactor, not a shared-component-only update.
- Added minimum required changed files and required mobile/desktop layout evidence criteria.
- Added required screenshot storage path and before/after evidence requirements.

### Changed
- Tightened GO/NO-GO rubric to automatically fail:
  - shared-component/copy-only passes without page structure changes
  - missing manual screenshot matrix
  - mobile/desktop layout parity failures

### Decisions Made
- Faculty refactor completion now requires visible IA/layout divergence across mobile and desktop for all three faculty pages.

### Open Questions
- Whether to enforce the same "structural refactor required" rule immediately for scheduler/admin/public execution prompts.

## [2026-05-09] - Faculty UX Shared Components Integration (/my, /my/preferences, /my/room-preferences)

### Added
- Added reusable faculty UX components:
  - `atlas-client/src/components/faculty-shared/StepFlowHeader.tsx`
  - `atlas-client/src/components/faculty-shared/StatusRail.tsx`
  - `atlas-client/src/components/faculty-shared/PlainLanguageNotice.tsx`
  - `atlas-client/src/components/faculty-shared/ConflictInspector.tsx`

### Changed
- Updated `atlas-client/src/pages/MyDashboard.tsx` to use shared step flow, status rail, and plain-language notice patterns.
- Updated `atlas-client/src/pages/FacultyPreferences.tsx` to use shared step flow, status rail, and plain-language notices for locked/submitted/review states.
- Updated `atlas-client/src/pages/FacultyRoomPreferences.tsx` to use the shared status rail for offline/sync/realtime visibility.
- Updated `atlas-client/src/components/faculty-room-preferences/RoomRequestSheet.tsx` to use shared conflict inspection and reason-capture behavior.

### Decisions Made
- Standardized faculty-facing status/copy/step guidance into reusable components to keep `/my*` surfaces behaviorally consistent.
- Preserved existing request, outbox, SSE, and collaboration behavior while unifying UX presentation.

### Open Questions
- Whether to further extract `RoomRequestHeader` into the shared step-flow primitive in a follow-up cleanup pass.

## [2026-05-09] - Faculty UX/UI Execution Prompt Template

### Added
- Added `docs/prompts/faculty-ux-ui-refactor-execution-prompt.md` as a ready-to-run Copilot prompt with:
  - explicit scope for `/my`, `/my/preferences`, `/my/room-preferences`
  - mandatory design/phase/skill references
  - required Context7 preflight section
  - ordered implementation slices
  - automated + manual verification gates
  - evidence-log update requirements
  - final GO/NO-GO rubric

### Changed
- No runtime code changes; this pass adds execution prompt governance only.

### Decisions Made
- Faculty UX refactor execution now has a standardized one-file prompt contract aligned with project skill and verification gates.

### Open Questions
- Whether to create equivalent execution prompt templates next for scheduler, admin, and public/student UX refactor phases.

## [2026-05-09] - Faculty UX/UI Refactor Execution Plan (Tool-Enforced Mobile + Desktop)

### Added
- Added `docs/phases/faculty-ux-ui-refactor-execution-plan.md` as the concrete faculty refactor blueprint covering:
  - mobile and desktop first-class targets for `/my`, `/my/preferences`, `/my/room-preferences`
  - mandatory skill stack usage order
  - Context7 preflight requirements
  - component-level checklist
  - Playwright + shared-browser QA requirements
  - explicit GO/NO-GO criteria and delivery slices

### Changed
- Updated `docs/phases/README.md` to include the new faculty UX/UI execution plan in planning references.

### Decisions Made
- Faculty UX refactor now follows a tooling-enforced gate flow instead of ad-hoc prompting.
- Mobile and desktop are treated as separate first-class layouts with shared behavior contracts.

### Open Questions
- Whether to immediately add a companion execution prompt template under `docs/prompts/` for one-command Copilot runs against this new plan.

## [2026-05-09] - Faculty Room UX Continuation Verification Delta (My-Schedule-First)

### Added
- Added continuation verification evidence entry in `docs/verification/evidence-log.md` for:
	- my-schedule-first follow-up validation
	- mobile full-context toggle screenshot capture
	- fresh command reruns (`atlas-client` build and `atlas-server` phase2 regression)

### Changed
- Recorded current caveats explicitly in the verification log:
	- intermittent local `401`/SSE noise during shared-browser sessions
	- prior transient `Sheet is not defined` signal not reproducible in this rerun

### Decisions Made
- Treated this pass as a continuation evidence delta only (no new feature-code changes), preserving existing implementation scope.

### Open Questions
- Whether to execute one more clean-session manual browser pass for complete guided-tour and list/building/map mode screenshot matrix under stable auth/realtime conditions.

## [2026-05-09] - Playwright CI Workflow + Snapshot Assertion Mode

### Added
- Added CI workflow at `.github/workflows/visual-regression.yml`:
  - Runs Playwright visual checks on pull requests.
  - Supports manual `workflow_dispatch` inputs for target roles and optional snapshot assertions.
  - Uploads visual report, test results, screenshots, and client logs as artifacts.
- Added `wait-on` root dev dependency for deterministic client startup checks in CI.

### Changed
- Updated visual spec `qa-artifacts/playwright/specs/role-viewport-visual.spec.ts`:
  - Added role filtering via `PLAYWRIGHT_TARGET_ROLES`.
  - Added optional snapshot assertions via `PLAYWRIGHT_ASSERT_SNAPSHOTS=1`.
  - Kept deterministic screenshot capture for evidence regardless of assertion mode.
- Updated `playwright.config.ts` with explicit `snapshotPathTemplate`.
- Updated root scripts in `package.json`:
  - `test:visual:ci`
  - `test:visual:assert`
- Updated `qa-artifacts/playwright/README.md` with CI/assertion usage and snapshot baseline notes.

### Decisions Made
- CI defaults to guest-only capture mode to avoid auth/environment coupling while preserving role-matrix support for local/manual runs.
- Snapshot assertion mode is opt-in until baseline images are committed and stabilized.

### Open Questions
- Whether to promote faculty/admin snapshot assertions in CI once dedicated seeded runtime and baseline stability are guaranteed.

## [2026-05-09] - Playwright Visual Regression Scaffold (Role x Viewport Matrix)

### Added
- Added root Playwright config at `playwright.config.ts` with 3 viewports:
  - `desktop` (`1366x768`)
  - `mobile-portrait` (`390x844`)
  - `mobile-landscape` (`844x390`)
- Added visual matrix spec:
  - `qa-artifacts/playwright/specs/role-viewport-visual.spec.ts`
  - Covers `guest`, `faculty`, and `admin` routes with deterministic screenshot output.
- Added Playwright usage guide:
  - `qa-artifacts/playwright/README.md`
- Added npm scripts in root `package.json`:
  - `test:visual:install`
  - `test:visual`
  - `test:visual:update`

### Changed
- Added `@playwright/test` as a root dev dependency for stable Playwright test-runner usage.

### Decisions Made
- Standardized screenshot naming to match shared QA policy:
  - `YYYYMMDD-role-route-viewport-baseline.png`
- Chosen first implementation step for tooling rollout is visual regression scaffolding before CI budget enforcement.

### Open Questions
- Whether to add snapshot assertions (`toHaveScreenshot`) immediately or keep this pass as capture-first baseline generation.

## [2026-05-09] - Copilot Supercharge Skills + Context7 Preflight Governance

### Added
- Added 8 new Copilot skills under `.github/skills/`:
  - `atlas-ux-audit-gate`
  - `atlas-faculty-usability-first`
  - `atlas-shared-browser-qa`
  - `atlas-offline-realtime-reliability`
  - `atlas-design-system-enforcer`
  - `atlas-phase-gate-enforcer`
  - `atlas-algorithm-benchmark-gate`
  - `atlas-copy-and-microcopy`
- Added `docs/context7-library-map.md` to lock approved Context7 reference sources and preflight output format.
- Added `docs/prompts/README.md` to enforce prompt template sections and quality gates.
- Added `docs/phases/copilot-supercharge-rollout.md` with practical 2-week rollout order and fast-ROI tooling additions.

### Changed
- Updated `.github/skills/README.md` to index the new skills and call out mandatory usage for UI/faculty workflows.
- Updated instruction and frontend guidance files to mandate new skills and Context7 preflight discipline:
  - `.cursor/instructions.md`
  - `.cursor/instructions/frontend.instructions.md`
  - `.github/copilot-instructions.md`
  - `.github/instructions/frontend.instructions.md`
- Updated `docs/phases/README.md` to include the Copilot supercharge rollout reference.

### Decisions Made
- Non-trivial UI/realtime/offline/accessibility work now requires Context7 preflight with library-ID resolution and 2-3 reference docs.
- Prompt-driven delivery now enforces explicit UX audit gates, evidence naming standards, design-system mapping, and phase gate checks.

### Open Questions
- Which tooling addition should be implemented first in code/CI: Playwright snapshots, Lighthouse CI budgets, Storybook state coverage, or Axe CI checks.

## [2026-05-09] - Faculty Room-Preferences Layout Split Refactor (Mobile/Desktop First-Class)

### Added
- New extracted view components for room-request UX separation:
	- `atlas-client/src/components/faculty-room-preferences/RoomRequestHeader.tsx`
	- `atlas-client/src/components/faculty-room-preferences/MobileRoomRequestLayout.tsx`
	- `atlas-client/src/components/faculty-room-preferences/DesktopRoomRequestLayout.tsx`
- Verification log entry for this pass with screenshot evidence pointers and audit caveats.

### Changed
- Refactored `atlas-client/src/pages/FacultyRoomPreferences.tsx` to delegate mobile and desktop layouts as first-class flows while preserving behavior contracts (active draft wiring, request actions, realtime/offline status surfaces).
- Reduced pre-action cognitive load by replacing the large advisory block with compact guidance plus expandable "Learn more".

### Decisions Made
- Kept behavioral contracts unchanged while optimizing first-action visibility and breakpoint-specific usability.
- Recorded session instability and embedded viewport constraints as explicit verification caveats instead of overstating manual measurement certainty.

### Open Questions
- Whether to run one additional dedicated manual pass in an unconstrained browser viewport to capture strict per-breakpoint numeric measurements without embedded-run limitations.

## [2026-05-09] - Faculty UX Gate Recovery Pass (NO-GO to GO)

### Added
- Final manual evidence matrix for the recovery gate pass in `docs/verification/evidence-log.md`, including offline lifecycle and timed non-technical acceptance outcomes.

### Changed
- Updated `docs/verification/faculty-final-gate-checklist-2026-05-09.md` from NO-GO to GO after re-verifying all previously failed critical criteria.
- Recorded completed lifecycle evidence (queued-offline, syncing, queued, synced, failed + retry, retry trigger) and mobile portrait/landscape timing results under 2 minutes.

### Decisions Made
- Final faculty UX recovery pass is accepted as GO for this gate slice.

### Open Questions
- None for this recovery pass.

## [2026-05-09] - Faculty/Scheduler Room-Request UX Hardening (Mobile + Scoped Conflicts)

### Added
- Request-level visualization blocks (Before vs After) in room-request review surfaces for scheduler workflows.
- Selected-session summary and searchable target-room input in faculty request sheet.

### Changed
- Removed mobile sidebar layout reservation by conditionally mounting desktop sidebar only outside mobile viewport in `AppShell`.
- Smoothed mobile hamburger open/close transitions with tuned timing and GPU-friendly animation hints.
- Scoped room-request preview conflicts to the request candidate slot in faculty and scheduler flows to avoid global soft-conflict leakage.
- Updated faculty room-request status banner behavior so online state does not duplicate a dedicated "Connected" strip; warning/action-required states remain visible.
- Improved mobile request-sheet ergonomics (`88dvh`, safe-area bottom padding) and action-button visibility in review drawers via sticky action bars.
- Disabled faculty collaboration WebSocket initialization unless explicitly enabled by `VITE_ROOM_PREF_COLLAB=true` to reduce noisy local WS failures.
- Removed generation gate bootstrap fetch in faculty room preferences to avoid repeated forbidden gate calls in this page flow.

### Decisions Made
- Room-request review UX now prioritizes request-scoped conflict context and decision controls over global run-level conflict dumps.
- Faculty room-preferences view treats collaboration socket as opt-in in local/dev unless feature flag is explicitly enabled.

### Open Questions
- Final backend policy for generation gate visibility and collaboration socket auth in local QA remains to be confirmed if these endpoints should be broadly reachable for faculty views.

## [2026-05-09] - Phase 1 Active-Draft Request Workflow, Gate Enforcement, and QA Protocol Update

### Added
- Added new Phase 1 regression tests:
	- `atlas-server/src/__tests__/phase1-active-draft-contract.test.ts`
	- `atlas-server/src/__tests__/phase1-unified-request.test.ts`
	- `atlas-server/src/__tests__/phase1-request-gate.test.ts`
	- `atlas-server/src/__tests__/phase1-request-sync.test.ts`
- Added new npm scripts in `atlas-server/package.json`:
	- `test:phase1-active-draft-contract`
	- `test:phase1-unified-request`
	- `test:phase1-request-gate`
	- `test:phase1-request-sync`
	- `test:phase1` (aggregate)

### Changed
- Fixed faculty room-preferences bootstrap gate fetch assignment in `atlas-client/src/pages/FacultyRoomPreferences.tsx` by properly destructuring `Promise.all` response values.
- Updated manual QA protocol documentation to prioritize direct ATLAS login (with Admin and Faculty credentials) and de-emphasize EnrollPro bridge as optional for this pass:
	- `AGENTS.md`
	- `.cursor/instructions.md`
	- `.cursor/instructions/api.instructions.md`
	- `.cursor/instructions/frontend.instructions.md`
	- `.github/copilot-instructions.md`
	- `.github/instructions/api.instructions.md`
	- `.github/instructions/frontend.instructions.md`

### Decisions Made
- For this phase pass, protected-route QA evidence uses direct ATLAS authentication as baseline.
- EnrollPro bridge-auth remains available for legacy integration validation but is no longer a prerequisite for protected-page checks in this slice.
- Phase 1 verification includes active-draft resolver contract, unified request model actions, generation decision gate behavior, and offline sync result determinism.

### Open Questions
- Manual browser evidence capture for direct-login and offline queue UX remains pending if screenshot artifacts are required by gate reviewers.

## [2026-05-08] - EnrollPro Sections Fetch Realignment for Teaching Load and Sections Summary

### Added
- Compatibility parsing for EnrollPro integration sections payloads returned as a flat `data` array, including grade-level regrouping and adviser/program normalization.

### Changed
- Updated ATLAS sections adapter upstream path from legacy sections endpoint to EnrollPro public integration feed: `/api/integration/v1/sections?schoolYearId=...`.
- Removed EnrollPro bearer-token forwarding for section fetches on this path, aligning with the public integration contract and avoiding upstream 401 failures when ATLAS local JWTs are present.

### Decisions Made
- Use EnrollPro integration endpoints as the canonical source contract for ATLAS ingestion in v1, consistent with the prior faculty sync bridge fix.

### Open Questions
- None for this fix slice.

## [2026-05-08] - EnrollPro Teacher User Auto-Provisioning Validated + Faculty Auth Ready for Portal

### Added
- Verification evidence entry documenting successful EnrollPro teacher User account auto-provisioning during runtime CRUD operations.
- Backfill verification: all 142 seeded teachers now have loginable User records in EnrollPro.
- End-to-end ATLAS faculty auth test: delegated faculty login with EnrollPro credentials now succeeds with correct token identity (userId = FacultyMirror.externalId).
- Faculty protected endpoint validation: /auth/me and other guarded routes now properly recognize and authorize faculty sessions.

### Changed
- Pulled latest EnrollPro main branch (commit 29efe1e): new teacher User provisioning is now automatic during teacher.store() endpoint.
- Updated evidence-log.md with comprehensive end-to-end auth validation results.

### Decisions Made
- EnrollPro teacher User auto-provisioning unblocks faculty portal design. All critical faculty auth pathways validated. Ready to begin designing /my/* faculty pages and faculty dashboard.

### Next Steps
- Faculty portal page implementation (Dashboard, Preferences, Room Preferences, Assignments)
- Manual browser QA with bridge-auth from EnrollPro
- PWA offline-first enhancements for faculty schedule viewing

## [2026-05-08] - Delegated Faculty Auth Hardening and EnrollPro Repo Cleanup

### Added
- Regression coverage for delegated faculty login to verify ATLAS issues faculty JWT identity from `FacultyMirror.externalId` and links provisioned accounts through stable upstream identifiers.
- Verification log entry for the auth hardening pass and EnrollPro cleanliness check.

### Changed
- Hardened delegated faculty login in ATLAS to prefer stable upstream faculty identifiers before falling back to contact-info matching.
- Corrected first delegated faculty login token issuance so faculty sessions use the same identity dimension expected by downstream faculty route checks.
- Restored the embedded `EnrollPro/` repository to a clean pullable state with no remaining local changes.

### Decisions Made
- Kept the defensive improvement entirely ATLAS-side so future EnrollPro account provisioning can plug into the existing delegated auth path without requiring another identity-model change.

### Open Questions
- Manual end-to-end QA for newly provisioned faculty users still depends on EnrollPro creating loginable teacher `User` records during normal runtime flows.

## [2026-05-08] - Faculty Priority Slice Verification Refresh

### Added
- Additional verification evidence run for faculty continuity slice covering build/auth plus targeted scripts for seeded email rules, faculty route restrictions, SSE propagation, offline sync reconciliation, and faculty dashboard fallback contract.

### Changed
- Updated Phase 4 execution verification bullets to include individual objective-priority script outcomes alongside aggregate `test:faculty-priority-slice`.
- Updated verification ledger with explicit command-level pass counts from this run.
- Re-ran mandatory command gate in this pass: backend build, client build, auth tests, and all faculty-priority targeted scripts.

### Decisions Made
- No additional feature-code gaps were identified against requirements A-F in this pass; implementation is treated as complete pending manual bridge-auth screenshot capture.

### Open Questions
- Manual bridge-auth visual evidence for `/my`, `/my/room-preferences`, and scheduler live-update panel remains pending capture.

## [2026-05-08] - Faculty Priority Slice Verification Refresh (Execution Pass)

### Added
- Executed the full required verification command set in this pass and recorded pass outcomes in phase/evidence docs.

### Changed
- Confirmed no additional code fixes were needed after rerunning all mandatory build and test gates for A-F behavior.

### Decisions Made
- Kept implementation scope unchanged because all objective-priority checks passed in this execution pass.

### Open Questions
- Manual bridge-auth screenshot capture remains the only pending artifact outside automated verification.

## [2026-05-08] - Faculty Priority Continuation Slice (My Portal + SSE + Offline Sync)

### Added
- Faculty My Portal dashboard route `/my` with mobile-first status cards, lifecycle plain-language copy, latest-generated fallback banner, schedule preview, and room-request CTA.
- Faculty portal API `GET /api/v1/faculty-portal/:schoolId/:schoolYearId/dashboard` to provide role-scoped status, fallback, and preview payloads.
- Room-request SSE stream endpoint `GET /api/v1/room-preferences/:schoolId/:schoolYearId/events` with replay support and heartbeat.
- Offline queue reconciliation endpoint `POST /api/v1/room-preferences/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/sync` for ordered queued action processing.
- New backend verification scripts/tests:
	- `test:seed-email-rules`
	- `test:faculty-route-restrictions`
	- `test:room-pref-sse`
	- `test:room-pref-sync`
	- `test:faculty-dashboard-contract`
	- aggregate `test:faculty-priority-slice`

### Changed
- Local auth seeding now creates deterministic local accounts for all active seeded faculty mirrors using `@deped.edu.ph` emails with duplicate fallback `firstname.m.lastname@deped.edu.ph`.
- Faculty local login now redirects to `/my`.
- Client-side faculty hard-route guard added in app shell: faculty users are redirected away from scheduler/admin routes to My Portal.
- Backend authorization hardened for scheduler/admin routes by enforcing privileged role checks on faculty listings, assignment summary/updates, section summary, map mutation endpoints, and subject management/stats endpoints.
- Faculty room-request page now supports offline action queueing and auto-sync with recoverable status UX.
- Officer room-request panel now updates live via SSE without manual refresh.

### Decisions Made
- Keep bridge auth fully compatible in parallel while expanding standalone local faculty flow.
- Use SSE + in-memory event buffer for room-request live updates in Phase 4 scope.
- Treat queued sync action failures as recoverable per-action errors while preserving a latest authoritative state snapshot.

### Open Questions
- Manual bridge-auth browser artifact capture for `/my` and scheduler live-update panel is still pending.

## [2026-05-08] - Priority 1 Standalone Local Login (Faculty + Scheduler Officer)

### Added
- Standalone local login flow for ATLAS via `POST /api/v1/auth/login` with local credential validation, lock handling, and JWT issuance.
- New local login UI route `/login` with email/password submission, password visibility toggle, error handling, and role-aware redirect behavior.
- Shared client auth helpers for local token storage, preferred-token resolution (local first, bridge fallback), and unified auth-session cleanup.
- Prisma auth account model + migration for local credential-backed accounts tied to school and faculty mirror context.

### Changed
- `GET /api/v1/auth/me` now returns normalized auth-source metadata for dual-mode sessions (`local` or `bridge`).
- Auth middleware now supports dual token payload shapes while preserving bridge token compatibility.
- App shell session verification and logout behavior now branch correctly by auth source:
	- bridge sessions route back to EnrollPro login path
	- local sessions route back to ATLAS `/login`
- Realistic seed flow now provisions baseline local auth accounts for officer/faculty login QA.

### Decisions Made
- Dual-auth compatibility is preserved: local login is primary for standalone ATLAS, while bridge-auth remains supported for integration and protected-page QA flows.
- Local token takes precedence in API authorization headers; bridge token remains fallback.

### Open Questions
- Dedicated automated auth acceptance tests (TC-AUTH-01..08 equivalent coverage) are not yet implemented in the server/client test suites and remain a follow-up task.

## [2026-05-07] - Objectives Priority Realignment and Phase Steering Update

### Added
- `docs/progress/objectives-priority-progress-check-2026-05-07.md` with full objective-by-objective status, contradiction log, and deployment-critical execution order.
- `docs/phases/phase-4-priority-realignment-2026-05-07.md` defining the temporary scope shift away from non-critical timetable UX work.

### Changed
- Updated `phasePlan.md` with a 2026-05-07 priority realignment section and objective-critical focus order.
- Updated `AGENTS.md` with an explicit objective-priority override tied to the new progress documents.
- Updated instruction files to enforce phase-by-phase execution with objective-critical precedence:
  - `.cursor/instructions.md`
  - `.cursor/instructions/api.instructions.md`
  - `.cursor/instructions/architecture.instructions.md`
  - `.cursor/instructions/frontend.instructions.md`
  - `.cursor/instructions/database.instructions.md`
  - `.github/copilot-instructions.md`
  - `.github/instructions/api.instructions.md`
  - `.github/instructions/architecture.instructions.md`
  - `.github/instructions/frontend.instructions.md`
  - `.github/instructions/database.instructions.md`

### Decisions Made
- While remaining phase-based, immediate development priority is shifted to objective blockers: standalone faculty auth, PWA/offline baseline, publish/dissemination, and published schedule views.
- Timetable UI/UX work is now limited to parity/correctness/performance blockers until objective-critical gaps are closed.

### Open Questions
- Final auth design choice for standalone ATLAS login (fully local credential authority vs bridge-compatible dual mode) needs confirmation before implementation starts.

## [2026-05-07] - Auth Role Clarification for Instructions and Identity

### Added
- Explicit role distinction text across instruction and identity files:
  - Scheduler Officer = scheduling operator
  - IT Admin = platform/account admin with scheduler-equivalent access for testing
  - Teacher/Faculty = preference and schedule consumer

### Changed
- Updated role wording in:
  - `AGENTS.md`
  - `ATLAS_AGENT_KI.md`
  - `.cursor/instructions.md`
  - `.github/copilot-instructions.md`

### Decisions Made
- Officer and Admin are now treated as distinct roles in project guidance.
- IT Admin retains scheduler-equivalent capability for QA/verification workflows while remaining a separate system identity from Scheduler Officer.

### Open Questions
- Whether the first local-login implementation includes IT Admin in the same login route or reserves a dedicated admin login route is still pending.

## [2026-05-06] - Wave 4.5c Follow-up 4 Canonical Generated Swap and Drag Hot-Path Cleanup

### Added
- Generated-run occupied-slot swap preview pathway via `POST /manual-edits/swap/preview`, including direct-swap and auto-fix preview payloads and a recommended strategy contract.
- Generated-run swap commit strategy support (`DIRECT_SWAP` or `AUTO_FIX_RELOCATE`) with optional `autoFixTarget` in manual-edit swap API and client mutation path.
- Strategy-aware generated swap confirmation UI in timetable dialogs, including blocked-state prevention and auto-fix recommendation messaging.

### Changed
- Pre-generation drop staging now routes through canonical confirm/swap prompt flow instead of immediate pre-commit preview execution for occupied interactions.
- Removed timetable drag debug traces from workspace/grid/mutation paths and removed parent workspace drag-over drop-target state writes.
- Updated swap hover confirmation visuals to emerald styling and set timetable skeleton to render immediately on first route load.

### Decisions Made
- Treat pre-generation swap/confirm flow as canonical interaction model for both pre-generation and generated occupied-slot operations.
- Keep scheduler decisioning for generated occupied swaps server-side, with client consuming recommendation + preview payloads.

### Open Questions
- Manual bridged runtime profiling artifacts (render-count traces and drag FPS captures) are still needed to complement compile/build evidence.

## [2026-05-06] — Deployment Step Verification (Local Offline)

### Changed
- Clarified the local deployment narrative to reflect ATLAS’ PERN stack requirements (Node/Express + React + local PostgreSQL).
- Corrected the “entirely offline” claim by adding an explicit setup dependency for EnrollPro/source sync via LAN or CSV fallback.
- Updated wording to remove any cross-system naming and to reflect the assumed monolithic on-prem deployment model.

### Decisions Made
- Keep the methodology aligned with v1 operational constraints: single on-prem server in a school LAN, with offline client access and locally sourced data imports.

### Open Questions
- Whether beneficiaries will run EnrollPro locally on the same LAN for source sync, or will use CSV/manual imports only.

## [2026-05-06] - Wave 4.5c Follow-up 3 Grid DnD Reliability and Timetable Entry Performance

### Added
- Lazy-loaded `/timetable` route composition in `atlas-client/src/pages/ScheduleReview.tsx` with `TimetableSkeleton` suspense fallback so first navigation shows immediate loading UI while workspace code loads.

### Changed
- Updated `atlas-client/src/components/timetable/TimetableGrid.tsx` draggable entry composition to use a forwarded DOM ref, ensuring compatibility with `TooltipTrigger asChild` and `dnd-kit` node registration for in-grid drags.
- Reduced drag-time render overhead in `TimetableGrid` by removing per-cell motion-based drop badges, consolidating tooltip providers, and narrowing entry transitions away from `transition-all`.
- Updated bridge-auth credential references to `Admin2026!` across instruction and planning knowledge files.

### Decisions Made
- Keep one `DragOverlay` owner in the workspace and harden the grid-level draggable node wiring instead of introducing additional drag contexts.
- Prioritize deterministic drag behavior and render-cost reduction in the center grid before introducing broader architectural changes.

### Open Questions
- Manual bridged QA for generated-run and pre-generation in-grid drag behavior is still needed to confirm runtime interaction parity after this pass.

## [2026-05-06] - Wave 4.5c Follow-up 2 Drag and Swap UX

### Added
- Visual before/after swap confirmation cards with human-readable slot, faculty, room, and session context in the timetable review dialogs.
- Dedicated pre-generation `Pinned` tab behavior in the left rail alongside `Unassigned` and `Requests`.

### Changed
- Pre-generation grid drags now hide the original source card during drag and resolve direct draft-placement payloads from the grid path.
- The pinned-session surface now uses the same search/filter model as the pre-generation queue instead of being appended below it.
- Removed the confusing pre-generation `Locked` metric from the left-panel summary.

### Decisions Made
- Treat pinned sessions as a first-class navigation surface, not as overflow content inside the unassigned pins panel.
- Prefer visual swap-state communication over raw preview text for pre-generation confirmation flows.

### Open Questions
- Manual bridge-auth QA for the updated drag and swap UX remains blocked until local EnrollPro accepts the documented credentials again.

## [2026-05-05] - Multi-Scheduler DFD Alignment Planning

### Added
- `docs/phases/multi-scheduler-dfd-alignment.md` documenting target-state DFD alignment for future multi-scheduler implementation.
- Mermaid diagrams for revised DFD Level 0 (context) and Level 1 (functional decomposition), including EnrollPro as an external dependency and public student read-only access.

### Changed
- Captured finalized planning decisions from stakeholder clarification: scheduler-owned publish, partial-generation support, role separation, scope override warnings, and cross-scheduler placement negotiation.

### Decisions Made
- Keep `System Administrator` and `Academic Scheduler` as separate actors with distinct authority boundaries.
- Model EnrollPro as an external source system and not part of ATLAS internal process space.
- Target future-state collaborative drafting with scope governance and negotiation logs before final generation.

### Open Questions
- Final technical policy for unresolved cross-scheduler placement disputes (timeout/escalation/auto-reject) remains to be specified during implementation design.

## [2026-05-05] - Wave 4.5 Pass 6 Monolith Dismantling

### Added
- `atlas-client/src/lib/timetable-utils.ts` to host extracted pure timetable helpers previously defined in the ScheduleReview monolith.
- `atlas-client/src/components/timetable/TimetableShared.tsx` containing shared review UI sub-components (`FilterChip`, `StatItem`, `ViolationGroup`).
- Hook scaffolds for page-level composition:
	- `atlas-client/src/hooks/useTimetableState.ts`
	- `atlas-client/src/hooks/useTimetableData.ts`
	- `atlas-client/src/hooks/useTimetableMutations.ts`
- Extracted modal components under `atlas-client/src/components/timetable/modals/`:
	- `HardBlockerDialog.tsx`
	- `SoftViolationConfirmDialog.tsx`
- New workspace component entrypoint at `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`.

### Changed
- Replaced `atlas-client/src/pages/ScheduleReview.tsx` with a thin layout/context container (`36` lines) that delegates rendering to `ScheduleReviewWorkspace`.
- Updated `ScheduleReviewWorkspace` to consume extracted utility/shared/modal modules and removed duplicated in-file helper and shared component definitions.

### Decisions Made
- Enforced the hard 1000-line guardrail on `ScheduleReview.tsx` by keeping it transport/composition-only and moving rendering logic to dedicated modules.
- Treated modal extraction incrementally in this pass (hard-blocker + soft-confirm dialogs) while preserving all existing timetable behavior.

### Open Questions
- Should the remaining inline `Dialog`/`Sheet` blocks in `ScheduleReviewWorkspace` be extracted in a follow-up pass into `src/components/timetable/modals/` for full modal parity?

## [2026-05-02] — Wave 4.5 Pre-Generation Spec (Docs)

### Added
- `docs/phases/phase-4-review.md`: **Wave 4.5** section with newcomer context (why implicit binding and mixed unassigned sources are problems), product goals, **daily load policy** (6h standard, >6–≤8h soft overload, >8h hard block), and implementation/verification pointers.
- `phasePlan.md`: Phase 4 bullet pointing to Wave 4.5 and the phase review doc.

### Decisions Made
- Daily teaching cap for pre-gen: **8 hours** maximum with acknowledgment in the overload band; **over 8 hours** is never committable via soft override.

### Open Questions
- Implementation and evidence log updates remain for the coding agent pass.

## [2026-04-27] — Wave 4.4 Timetable Workspace Unification

### Added
- Dedicated `/timetable` pre-generation center workspace and reset confirmation flow.
- Pre-generation source palette for unassigned demand and existing pinned draft entries.
- Regression coverage for generation scheduling around manual anchors.

### Changed
- Building/room navigation now filters the shared editable timetable grid instead of opening a separate room schedule table.
- Client typecheck was unblocked by normalizing nullable room-schedule `runId` values before opening the conflict inspector.
- Phase 4 and verification evidence logs were updated with build/test results.

### Decisions Made
- Manual browser QA evidence is recorded as pending rather than marked passed without a live bridged auth session.
- Existing saved pre-generation anchors remain the reset guard boundary for destructive draft clearing.

### Open Questions
- Manual bridged browser QA still needs to confirm live drag/drop, reset modal behavior, and room/building grid navigation with screenshots.
## [2026-04-21] — Wave 4.2 Room Preference Request Workflow

### Added
- Durable backend room-request workflow with Prisma persistence, latest-run faculty/officer endpoints, version-aware review actions, and request deletion support for mistaken drag targets.
- Faculty drag-and-drop room request page at `/my/room-preferences` using `@dnd-kit`, plus officer review queue and preview sheet at `/faculty/room-preferences`.
- Shared client contracts for room-request state, summary queues, and preview responses.

### Changed
- Sidebar navigation now exposes room-request review for officers and room-request submission for faculty.
- Approval flow now reuses the existing manual-edit commit path so room-request approvals inherit the same draft validation and run-version checks as direct scheduler edits.

### Decisions Made
- One durable request row is stored per `(runId, entryId)` so faculty draft/submit state stays separate from the generated draft entries until an officer explicitly approves the change.
- Faculty bootstrap uses room-preference latest-run endpoints instead of broadening generation-route permissions for non-privileged users.

### Open Questions
- Browser QA for the new room-request pages still requires a valid bridge-auth token; this pass only verified server/client builds and existing Phase 4 regressions.

## [2026-04-21] — Wave 4.2 Gate-Close Fixes

### Added
- Deterministic post-seed teaching-load baseline generation with diagnostics covering section-subject ownership, adviser homeroom coverage, faculty utilization, and MTB-free verification.
- Cross-repo source-gate assertions for the post-MTB baseline and seeded load-balance contract.
- Windows Prisma runbook guidance for clearing migrate-history drift and engine DLL locks during local repair.
- Latest-run stale-data guards for room-preference bootstraps, including `STALE_RUN_DATA` responses with action hints surfaced in both faculty and officer pages.

### Changed
- Reconciled local Prisma migration state by clearing the stale rolled-back history row and applying `0012_wave4_2_room_preferences`.
- Aligned `FacultyRoomPreference` Prisma timestamp fields with the applied snake_case database columns so the room-preference pages no longer fail at runtime.
- Updated source verification to the MTB-clean baseline: 146 active faculty, 83 sections, 3311 enrolled learners, 12 cohorts, and 0 MTB-specialized faculty.
- Regenerated the latest completed draft as `Run #52`, restoring room-preference ownership against the current `faculty_mirrors` set and unblocking authenticated browser QA.

### Decisions Made
- The seeded post-MTB assignment baseline must guarantee full section-subject coverage, zero unassigned faculty, zero duplicate ownership, and adviser-backed homeroom guidance before Wave 4.2 is considered healthy.
- Wave 4.2 is accepted after a fresh completed run bound to current faculty mirrors passed the faculty submit flow and the officer review flow end to end.

### Open Questions
- Should `seed-realistic --reset` also remove or invalidate stale generation runs so room-preference QA and faculty-authenticated workflows cannot point at pre-reset draft ownership?

## [2026-04-21] — Teaching Load UI/UX Refactor

### Added
- Omnisearch filter for subjects and sections.
- Grade-level dropdown filter in the Faculty Assignments toolbar.
- Advisory "Star" badges integrated directly into the faculty profile summary and placed dynamically beside the section name.
- Explicit `Pencil` (request) and `CheckCircle2` (saved) icon badges with full faculty names rendered below assigned section tiles.

### Changed
- Re-architected Section Tile UI: Relocated ownership status badges to stack below section names, ensuring section names never truncate horizontally.
- Removed exponentially-growing 'Session Pending Ownership' ribbon to reclaim vertical interface space.
- Subject list sorting refactored: "Homeroom" subjects now explicitly float to the bottom of the active/primary department subjects.
- Applied DepEd-mapped color coding (`border` and `bg-muted`) to the Grade Level accordion containers instead of primary badge fills.

### Decisions Made
- Optimized for horizontal grid space and information density over verbose linear lists.

### Open Questions
- None.

## [2026-04-21] — Wave 4.1 Teaching Load Precision QA Closeout

### Added
- Manual browser QA evidence for pending ownership carryover, cross-teacher section blocking, and draft discard reset on `/assignments`.

### Changed
- Normalized `FacultyAssignments` teaching-load separators to ASCII so the page no longer renders replacement glyphs in the live browser.
- Corrected the Wave 4.1 evidence trail to reflect the working local verification path: standard Prisma client regeneration plus confirmation that the migration was already applied.

### Decisions Made
- Local runtime and browser QA for this workspace must use `npm run db:generate`; `--no-engine` is incompatible with the current classic Prisma setup.

### Open Questions
- None

## [2026-04-27] — Cursor Native Instructions Mirror

### Added
- Added native Cursor instruction files to mirror the existing `.github` instruction set:
  - `.cursor/instructions.md`
  - `.cursor/instructions/architecture.instructions.md`
  - `.cursor/instructions/api.instructions.md`
  - `.cursor/instructions/database.instructions.md`
  - `.cursor/instructions/frontend.instructions.md`

### Changed
- No behavior or runtime code changes; this update is documentation/instruction parity for Cursor-native guidance.

### Decisions Made
- Kept `AGENTS.md` and `phasePlan.md` as primary authority, while mirroring `.github` constraints into `.cursor` so Cursor-native flows consume the same guardrails.
- Preserved active-phase discipline by documenting current planning references without introducing cross-phase implementation work.

### Open Questions
- Should future updates treat `.cursor` and `.github` instruction trees as strict lockstep mirrors (required dual-edit), or is `.cursor` intended to become the primary source?

## [2026-04-21] — Wave 3.5.3 Cross-Repo Source Gate + Wave 4.0 Hardening

### Added
- Cross-repo `verify:cross-repo-source-gate` automation plus aligned root/server scripts for authoritative EnrollPro seeding, live ATLAS mirror reset, live verification, and cached-upstream verification.
- Shared review-helper module for program and entry-kind filtering, plus expanded Phase 4 regression coverage for fallback-to-section behavior and review-helper logic.

### Changed
- Repaired the EnrollPro build by fixing `eosy.router.ts` router typing and Prisma where-input typing in sections/curriculum controllers.
- Stabilized the EnrollPro-to-ATLAS contract surface: `/api/teachers/atlas/faculty-sync`, `/api/sections/:ayId`, and `/api/curriculum/:ayId/scp-config` are now explicitly documented, and sections emit stable program/adviser fields.
- `ScheduleReview` now sends cohort/program/adviser metadata into fix-suggestion requests and renders cohort-aware fallback detail; `fix-suggestions.service.ts` now returns cohort-aware labels and remediation copy.
- `FacultyAssignments` now renders adviser-backed homeroom guidance, and the faculty router no longer shadows `/sync`, `/advisers`, or `/:id/homeroom-hint`.

### Decisions Made
- EnrollPro remains the single source of truth for teachers, sections, adviser mappings, special-program metadata, and cohort-specialization metadata; ATLAS only mirrors and caches upstream state.
- Cached upstream snapshots remain allowed during verification when EnrollPro is unreachable, but `stub`, `auto-fallback`, and `preserved-existing` sources remain disallowed for production-like gates.

### Open Questions
- The current live review sample used for browser QA did not include cohort unassigned cards, so cohort-specific unassigned copy remains browser-unverified even though the automated Wave 4 test now covers that path.

## [2026-04-21] — Wave 3.5.2 EnrollPro-First Seeding + Strict Qualification Fix

### Added
- Shared realistic JHS source dataset module plus an EnrollPro-side `db:seed-atlas-source` script that seeds 154 teachers, 83 sections, adviser designations, SCP configs, and 3311 enrolled learners in the dedicated EnrollPro source database.
- ATLAS `verify:enrollpro-source` CLI for reproducible live-sync and cached-upstream fallback verification.

### Changed
- `seed-realistic.ts` now defaults to `mode=enrollpro-source`, mirrors EnrollPro contracts instead of creating canonical faculty/section/cohort records locally, and keeps `atlas-fixture` as an explicit `--confirmFixtureBypass=true` dev-only fallback.
- Faculty sync now targets the school-year-aware EnrollPro `/teachers/atlas/faculty-sync` contract, section auto mode no longer falls back to stub data, and cohort auto mode now uses cached upstream cohorts instead of silent stub injection.
- EnrollPro sections/curriculum contracts now count `NULL` `eosyStatus` rows as active enrollment and expose explicit `cohorts` payloads for ATLAS.
- Faculty assignment qualification logic now fails closed for missing or unknown departments while keeping Homeroom Guidance as the explicit exception; UI copy now distinguishes `Qualified by Department` from `Outside Department (Emergency)`.

### Decisions Made
- EnrollPro remains the single source of truth for faculty, sections, adviser mappings, and special-program metadata; ATLAS stores mirrors, snapshots, and cached upstream state only.
- Cached upstream snapshots are acceptable fallback when EnrollPro is unavailable; implicit fixture/stub fallback is not.
- Local EnrollPro verification should use the dedicated `enrollpro` database instead of the shared ATLAS `atlas_db` public schema.

### Open Questions
- `EnrollPro/server` still has an unrelated build failure in `src/features/enrollment/eosy.router.ts` that predates this batch and was not modified here.

## [2026-04-21] — Wave 4.0 Cohort-Aware Generation + Special Program Review UX

### Added
- Cohort-aware generation flow that consumes stored `InstructionalCohort` rows, emits cohort metadata in draft/unassigned payloads, and validates cohort room-capacity impact.
- Review-console filters for program type and entry kind, plus cohort/program/adviser context across the grid, detail panel, unassigned list, and explainability drawer.
- Contract alignment note at `docs/contracts/wave-4-cohort-contract-alignment.md` and focused regression coverage in `atlas-server/src/__tests__/phase4-cohort-review.test.ts`.

### Changed
- `section-adapter.ts` now normalizes live EnrollPro section `programType` values and nested `advisingTeacher` fields into ATLAS program/adviser metadata and surfaces contract warnings during fallback.
- `cohort.service.ts` now treats live `scpProgramConfigs` as the verified upstream shape, derives fallback TLE cohorts from section rosters when explicit cohorts are missing, and preserves existing local cohorts instead of destructive empty syncs.
- `generation.service.ts`, `schedule-constructor.ts`, `constraint-validator.ts`, and `manual-edit.service.ts` now preserve cohort/program/adviser metadata through construction, validation, preview, commit, and revert flows.

### Decisions Made
- Upstream contract translation remains isolated in service adapters; the review UI only consumes normalized ATLAS-facing data.
- Inter-section subjects use cohort demand only when `interSectionEnabled` is active for the grade and cohort records exist; all other generation paths remain section-based.
- Missing live cohort payloads are treated as a contract gap, not as authorization to delete local cohorts.

### Open Questions
- Manual browser QA for the updated review console was not executed in this pass and should be completed in a fully running local bridge-auth environment.

## [2026-04-21] — Wave 3.5.1 Safe Seed + Map Verification

### Added
- Safe-mode realistic seeding with explicit `--seedMap` and `--resetMap` flags, preflight reset/preserve summary, and deterministic JHS campus map seeding.
- Manual verification evidence for map editor drag persistence, room add/edit/delete flows, and building metadata save behavior.

### Changed
- `seed-realistic.ts` now resets only wave-3.5 data domains by default and preserves buildings, rooms, and campus image unless map reset is explicitly requested.
- Section sourcing now defaults to `auto` fallback mode instead of forcing EnrollPro-only reads.
- Map service validation now blocks invalid floor-count reductions and forces non-teaching room behavior consistently.
- Map editor UI now supports building short-code edits, room edit dialogs, clearer save feedback, and better floor/teaching guardrails.

### Decisions Made
- Default seeding behavior must never delete or overwrite map data without an explicit map-reset flag.
- Realistic campus seeding is additive and idempotent, matching seeded buildings by stable identity instead of duplicating them on rerun.
- Manual map QA should leave the seeded dataset clean; temporary browser edits used for verification were reverted before final evidence capture.

### Open Questions
- The standalone local shell still emits unrelated 502s for non-map bridge/public-settings requests during browser QA; map editor verification passed with a valid bridge token.

---

## [2026-04-02] — Phase 4 Review & Validation Requirements

### Added
- **PRD**: `docs/phases/requirements-phase4-review.md` written using EARS syntax to formalize the Generaton Trigger, Grid Pivots, Unsaved Edits handling, and Publish blocks.

### Changed
- Clarified UI/UX Prompt Directive for the `ScheduleReview.tsx` Phase 4 batch to encompass the newly approved layout interactions.

### Decisions Made
- **Generate Rule:** Re-generating forces a new run and prompts a discard-warning if unsaved edits exist. Configurable advanced parameters deferred to v2.
- **Publish Rule:** Hard violations absolutely block publishing. Soft violations permit publishing but require explicit administrative checkbox acknowledgment.
- **Grid Rule:** The Timetable Grid supports views by Section, Faculty, and Room. When pivoted, it auto-selects the first alphabetical entity to avoid blank screens.
- **Triage UX:** Unassigned classes are tracked in a left-panel tab beside Violations. Follow-up flags are persisted server-side (run-scoped) to support multi-officer triage.

### Open Questions
- The `DraftReport` payload currently only returns a `summary` of unassigned counts, not the list of unplaced classes. Action needed to update the backend schedule payload.

---

## [2026-04-01] — Phase 1 UX Fixes & EnrollPro UI Standardization

### Added
- **PRD**: `requirements-phase1-ux.md` detailing exact EARS requirements for porting EnrollPro UI components to ATLAS.
- **Checklists**: `task.md` outlining the execution order for the Phase 1 UX enhancements.

### Changed
- Dashboard, Subjects, and Faculty UI specs revised to explicitly mandate standard `shadcn` implementations over raw HTML `<select>`.

### Decisions Made
- ATLAS layout will adopt EnrollPro's `AppLayout.tsx` structure and `framer-motion` page transition animations.
- Subjects module will natively handle Hours/Week calculations before saving backwards to the database.

### Open Questions
- Will the `framer-motion` peer dependency trigger conflicts with `react-konva` events on route unmount?

---

## [2026-03-31] — Section & Enrollment Data Pipeline

### Added
- **EnrollPro seed**: 12 JHS sections (3 per grade, G7-G10) with Filipino hero names and advising teachers
- **EnrollPro seed**: 388 enrolled students (applicants with ENROLLED status + enrollment records) with varied fill per section (25-38 of 40 cap)
- **ATLAS section adapter**: `enrolledCount` field on `ExternalSection` interface; `totalEnrolled` and `enrolledByGradeLevel` on `SectionSummary`
- **ATLAS Sections page**: Total Enrolled summary card, per-grade student counts, per-section detail table with enrolled/capacity/fill% columns
- **Service token fallback**: Section and faculty adapters fall back to `ENROLLPRO_SERVICE_TOKEN` env var when no user auth token is available

### Changed
- Fixed `ENROLLPRO_SERVICE_TOKEN` — regenerated with valid admin userId (was userId: 0 which doesn't exist)
- Fixed env var mismatch in section adapter (`ENROLLPRO_API_URL` → `ENROLLPRO_API`)
- Section adapter stub data updated with realistic `enrolledCount` values
- Section service aggregates enrollment counts per grade level

### Decisions Made
- Student enrollment counts flow from EnrollPro → ATLAS via the existing sections API (no new endpoint needed)
- Fill percentage badge thresholds: ≥90% red (destructive), ≥70% default, <70% secondary
- Enrollment seeding uses randomized Filipino names and age-appropriate birth dates per grade level

### Open Questions
- None

---

## [2025-07-17] — Map Editor Improvements (8 Fixes)

### Added
- **FIX 1 — Anchored resize**: `boundBoxFunc` returns `oldBox` when below minimum dimensions, preventing origin drift
- **FIX 2 — Rotation support**: Canva-style rotation via Konva Transformer with 45° snaps; persisted `rotation` field on Building; counter-rotated text labels
- **FIX 3 — Non-teaching building flag**: `isTeachingBuilding` on Building model; toggle cascades to all rooms; hatch overlay on canvas
- **FIX 4 — Floor count & floor visualization**: `floorCount` on Building, `floorPosition` on Room; floor tab switcher; @dnd-kit/sortable drag-to-reorder rooms per floor
- **FIX 5 — Dashboard checklist fix**: "Buildings & rooms set up" validates teaching buildings are named and have ≥1 room; non-teaching buildings exempt
- **FIX 6 — Dashboard rooms stat**: Stat card shows teaching rooms only; sub-label shows total and non-teaching excluded count
- **FIX 7 — Context-aware status bar**: 5-state status bar reflecting current tool and interaction state
- **FIX 8 — Undo/Redo system**: History stack (max 30) with Ctrl+Z/Ctrl+Y keyboard shortcuts and toolbar buttons

### Changed
- Prisma schema: Building +`rotation`, +`floorCount`, +`isTeachingBuilding`; Room +`floorPosition`
- Server `map.service.ts`: room ordering by floor+floorPosition; updateBuilding cascades isTeachingBuilding to rooms; addRoom auto-calculates floorPosition
- Dashboard stat card renamed "Rooms" to "Teaching Rooms"
- BuildingPanel JSX rebuilt with floor tabs, DndContext sortable rooms, non-teaching toggle, floor count input
- MapEditor orchestrator manages undo/redo state and passes props to children

### Decisions Made
- Non-teaching building cascade: marking non-teaching forces all rooms to `isTeachingSpace=false` server-side
- Floor position drag reorder uses fire-and-forget PATCH calls (optimistic UI)
- Undo/redo snapshots entire buildings array; max 30 entries

### Open Questions
- None

---

## [2026-03-31] — Phase-Based Planning and QC Tracker

### Added
- Added `phasePlan.md` as a shared, phase-by-phase delivery and verification ledger for all coding agents.
- Added phase status definitions, scope boundaries, and exit criteria from Phase 0 through Phase 6.
- Added explicit quality-control workflow (scope, architecture, behavior, regression gates) for batch acceptance.

### Changed
- Updated `AGENTS.md` with a new "Delivery Phases And Progress Tracking" section.
- Added canonical pointer in `AGENTS.md` to `phasePlan.md` as the active phase source.
- Updated `projectUpdate.md` header to mark it as historical context and redirect active planning to `phasePlan.md`.

### Decisions Made
- Active implementation and verification flow is now phase-driven, not feature-isolated.
- Current execution focus is Phase 1 (Setup Completion), while preserving flexibility to shift phases by user direction.
- Cross-service out-of-scope modules (LMS, registrar, admission, MRF) remain explicitly excluded from ATLAS implementation scope.

### Open Questions
- Confirm whether "reuse previous term schedule as generation seed" is included in v1 or deferred.
- Confirm when gates/landmark map markers should be scheduled (Phase 1 extension vs later phase).

## [2025-07-18] — Subjects, Faculty, Assignments & Scheduling Lifecycle

### Added
- **Prisma schema**: Overhauled `Subject` model (minMinutesPerWeek, preferredRoomType, gradeLevels, isActive, isSeedable). New `FacultyMirror` model with optimistic locking. New `FacultySubject` junction model. `TLE_WORKSHOP` added to `RoomType` enum.
- **Subject service & routes**: Full CRUD + auto-seed of 9 MATATAG JHS subjects, stats endpoint with unassigned subject count.
- **Faculty adapter**: Swappable interface with `StubFacultyAdapter` (15 mock faculty) and `EnrollProFacultyAdapter` placeholder, controlled by `FACULTY_ADAPTER` env var.
- **Faculty service & routes**: Sync from external adapter, CRUD with optimistic locking, stats.
- **Faculty-assignment service & routes**: Transactional set/replace assignments, summary with weekly hours calculation.
- **Subjects page** (`/subjects`): Full CRUD UI — DepEd standard badge, inline edit for seedable subjects, add custom subject form, grade level toggles, delete protection.
- **Faculty page** (`/faculty`): Sync Now button, search, table with department/load/status, bridge-down warning.
- **Faculty Assignments page** (`/faculty/assignments`): Two-panel layout — left panel with faculty list (filter by assigned/unassigned), right panel with subject checkboxes, per-subject grade scope, teaching load summary with RA 4670 capacity status.
- **ComingSoon placeholder** for Sections and Timetable routes.
- **Sidebar navigation refactor**: Grouped into Navigation, Scheduling, Campus, Insights, Platform. Disabled items show lock icon.
- **Dashboard lifecycle widget**: 6-phase stepper with setup checklist. Updated stat cards with subject/faculty counts and warning badges.

### Changed
- Dashboard campus map `CANVAS_HEIGHT` fixed from 500 to 580 to match editor, fixing building/background misalignment.
- Seed script updated for new subject fields and correct Prisma client path.
- `BuildingPanel.tsx` updated with TLE_WORKSHOP room type option.
- Dashboard quick actions updated to link to Faculty and Subjects pages.

### Decisions Made
- v1 lifecycle phase hardcoded to SETUP until generation is implemented.
- Faculty adapter defaults to stub; set `FACULTY_ADAPTER=enrollpro` to switch.
- Seedable subjects only allow name/minutes edits; code and room type are locked.
- Teaching load limits follow RA 4670 guidelines.

---

## [2026-03-30] — Major UX Upgrade: Routing, Interactive Map Editor, AppShell

### Added
- **Root dev command**: `npm run dev` runs both atlas-server and atlas-client concurrently using `concurrently` with named/colored labels.
- **Room model expansion**: Added `floor` (Int), `type` (RoomType enum), `capacity` (Int?) to Room model via Prisma migration `add_room_details`.
- **RoomType enum**: CLASSROOM, LABORATORY, COMPUTER_LAB, LIBRARY, GYMNASIUM, FACULTY_ROOM, OFFICE, OTHER.
- **Campus image upload**: `POST /api/v1/map/schools/:schoolId/campus-image` with multer (5 MB limit, PNG/JPEG/WebP) and `GET` endpoint. `campusImageUrl` field on School model via migration `add_campus_image_url`.
- **Static file serving**: `/uploads` served from atlas-server for campus images.
- **React Router**: Installed react-router-dom with `createBrowserRouter` for route-based navigation (/, /map, /map/editor).
- **AppShell component** (`src/components/AppShell.tsx`): Route-aware collapsible sidebar with NavLink active states, WCAG dynamic accent theming, bridge token auth, role badge, EnrollPro back link, collapse toggle.
- **Dashboard page** (`src/pages/Dashboard.tsx`): Stat cards (buildings/rooms count), quick-action cards linking to Map View and Map Editor.
- **CampusMapEditor component** (`src/components/CampusMapEditor.tsx`): Interactive Konva canvas with Transformer for resize (min 60x40), draggable buildings, click-to-add tool, save button for batch API persistence, background image support, dirty state indicators, zoom controls.
- **BuildingPanel component** (`src/components/BuildingPanel.tsx`): Side panel for selected building — name editing, color picker, position display, room list with type/capacity badges, add room form (name/floor/type/capacity), room deletion, building deletion.
- **MapView page** (`src/pages/MapView.tsx`): Read-only campus map viewer with zoom/pan, building inspector with room type and capacity display.
- **MapEditor page** (`src/pages/MapEditor.tsx`): Combines CampusMapEditor + BuildingPanel in a flex layout with data fetching and state management.
- **UI components**: button.tsx, input.tsx, badge.tsx (shadcn/CVA pattern).
- **Updated types**: Room type expanded with floor, type, capacity, buildingId. Added BridgeUser type. Added RoomType union.
- **Seed data**: Updated with room floor, type, and capacity values for all demo rooms.

### Changed
- **App.tsx**: Replaced monolithic single-page layout with React Router + lazy-loaded pages.
- **Root package.json**: Added `dev`, `dev:server`, `dev:client` scripts.
- **map.service.ts**: `addRoom` now accepts floor, type, capacity. Added `getCampusImage`/`setCampusImage`.
- **map.router.ts**: Room creation accepts new fields. Added campus-image upload/get endpoints with multer.
- **app.ts**: Added static serving for `/uploads` directory and path import.
- **vite.config.ts**: Added `/uploads` proxy to atlas-server.

### Decisions Made
- React Router chosen over single-page for scalability — dedicated pages make the system maintainable as features grow.
- Map Editor is role-guarded in sidebar (admin only); Map View is accessible to all.
- Campus images stored in local `/uploads` directory (not cloud) per v1 scope.
- Building dirty-state tracked client-side; batch save to API on explicit user action.
- Transformer min sizes: 60x40. Rotation disabled.
- Room CRUD requires building to be saved first (enforced in BuildingPanel).

### Open Questions
- None for this implementation pass.

## [2026-03-30] — Planning Artifacts Requirements

### Added
- Finalized Project Knowledge in AGENTS.md for A.T.L.A.S. using confirmed v1 scope and constraints.
- Added .github/copilot-instructions.md with global project rules.
- Added instruction files for architecture, database, frontend, and API guidance under .github/instructions/.

### Changed
- Replaced AGENTS.md Project Knowledge placeholders with concrete project facts, role model, lifecycle model, and acceptance thresholds.

### Decisions Made
- Confirmed greenfield delivery on PERN stack as a mobile-responsive PWA, not a native mobile app.
- Confirmed v1 includes multi-school support and school-agnostic configurability.
- Confirmed authenticated roles are Scheduling Officer and Teacher/Faculty only; student schedule viewing is public.
- Confirmed best-effort generation policy, hard-constraint publish blocking, optimistic locking, and offline sync conflict handling.
- Confirmed LIS/HR API primary import path with CSV fallback.
- Confirmed external service scope: push notifications in scope; email/SMS, analytics, backups, and monitoring tooling out of scope.

### Open Questions
- None for this planning artifact pass.

## [2026-03-30] — Architecture Finalization and Skills Setup

### Added
- Added project skills under `.github/skills/` using documented `SKILL.md` format:
	- `atlas-prisma-database`
	- `atlas-express-api`
	- `atlas-react-view-patterns`
	- `atlas-pwa-service-worker`
	- `atlas-genetic-scheduler`
	- `atlas-mvc-enforcement`
	- `atlas-interservice-http`
	- `atlas-21st-dev-frontend` (mandatory frontend UI/UX skill)
- Added `.github/skills/README.md` to index project skills.

### Changed
- Updated `AGENTS.md` Project Knowledge with strict MVC enforcement, Prisma naming rules, microservice boundaries, simulated faculty adapter requirement, and explicit public API endpoints.
- Updated `.github/copilot-instructions.md` with MVC rules, versioned API policy, microservice isolation, endpoint contracts, and skills usage requirements.
- Updated `.github/instructions/architecture.instructions.md` with MVC layer definitions, service-layer enforcement, microservice isolation, and public cross-service data rules.
- Updated `.github/instructions/api.instructions.md` with adapter pattern requirements, versioned route policy, inter-service HTTP patterns, and public endpoint constraints.
- Updated `.github/instructions/database.instructions.md` and `.github/instructions/frontend.instructions.md` to align with Prisma + MVC and mandatory frontend skill usage.

### Decisions Made
- Confirmed Prisma as the preferred ORM for PostgreSQL in ATLAS.
- Confirmed strict MVC with `/services` business layer and thin Express controllers.
- Confirmed ATLAS as an isolated microservice with HTTP REST-only inter-service communication and no shared database.
- Confirmed public exposure of subjects and published schedules via `/api/v1` endpoints only.
- Confirmed faculty integration via swappable adapter with realistic stub in v1 and CSV fallback.

### Open Questions
- None for this architecture and skills finalization pass.

## [2026-03-30] — Campus Map Feature Planning Update

### Added
- Added campus map feature architecture guidance to `.github/instructions/architecture.instructions.md`:
	- Editor/View mode split
	- School-scoped `campus_image_url` + `buildings` JSON contract
	- Read-only published schedule overlays in view mode
	- Service boundary rules for map composition
- Added detailed frontend implementation rules to `.github/instructions/frontend.instructions.md`:
	- `react-konva` building rectangle editing rules
	- `react-zoom-pan-pinch` pan/zoom requirement
	- BuildingPanel field requirements and room typing
	- 21st Dev boundary rule outside Konva Stage only
- Bootstrapped npm dependencies for PERN scaffolding and map libraries.

### Changed
- Updated `.gitignore` to keep private planning/customization artifacts from public versioning:
	- `.github/instructions/`
	- `.github/skills/`
	- `.github/copilot-instructions.md`
	- `AGENTS.md`
	- `.vscode/mcp.json`

### Decisions Made
- Campus map canvas editing is restricted to Scheduling Officer editor mode.
- Faculty and public map access is read-only with current-slot published schedule overlays.
- Konva canvas remains a controlled exception to 21st Dev, with 21st Dev used for surrounding UI only.
- Per-school map persistence uses image URL plus JSON building geometry and room metadata.

### Open Questions
- None for this campus map planning update.

## [2026-04-21] - Agent Knowledge Base & UI/UX Role Context

### Added
- Added `ATLAS_AGENT_KI.md` as a condensed session-start knowledge file for ATLAS agent roles, active frontend guardrails, phase-aware workflow, and prompt augmentation rules.

### Changed
- Updated `AGENTS.md` to point future sessions to `ATLAS_AGENT_KI.md` as a companion knowledge file.
- Updated `.github/copilot-instructions.md` so non-trivial work now begins by reading `ATLAS_AGENT_KI.md` before phase-planning documents.

### Decisions Made
- The primary active operating role for future frontend work is `atlas-uiux-expert`, with `atlas-prd-architect` activated when the user asks for requirements.
- The knowledge file is intentionally condensed and defers to `AGENTS.md` and `phasePlan.md` when conflicts exist.
- The file explicitly encodes evidence-first UX work: inspect relevant pages, preserve established patterns, and verify version-sensitive UI behavior with official docs when needed.

### Open Questions
- None

## [2026-05-06] - Wave 4.5c Generated View Unification + Performance Pass

### Added
- Global timetable top loading strip (2px) tied to expensive workspace operations, plus denser inline operation status messaging for generated non-swap move/place actions.
- Expanded generated occupied-slot swap controls with directional quick actions: direct swap, auto-fix blocking session, and auto-fix source session.
- Swap preview caching and manual-edit preview caching keyed by run/version+proposal for reduced repeated preview latency.

### Changed
- Pre-generation empty-slot drop path now runs preview+commit directly (no confirm modal), while occupied-slot conflicts still route to swap confirmation.
- Generated non-swap move and unassigned placement handling now reports hard-block outcomes inline instead of opening blocker modal loops.
- Timetable skeleton visual hierarchy updated with stronger contrast and immediate top loading signal.
- Manual edit swap backend strategy contract expanded from single auto-fix relocation to directional strategies (AUTO_FIX_MOVE_BLOCKING and AUTO_FIX_MOVE_SOURCE).

### Decisions Made
- Kept swap modal scope focused on occupied-slot conflicts while shifting non-swap generated interactions to inline preview/commit feedback.
- Preserved optimistic-lock/version semantics and existing swap endpoint shape by reusing strategy + autoFixTarget payload contract.

### Open Questions
- Whether the manual resolve path should auto-reopen the swap dialog after the blocking session is moved remains for follow-up UX refinement.


## [2026-05-12] - Audit Wave 4: Specialization & Qualification Refactor

### Added
- New \SpecializationAlias\ model for dynamic mapping of teacher specializations to subject requirements.
- Centralized \QualificationService\ on the backend for unified eligibility logic.
- \Audit View\ (/audit) to proactively identify qualification mismatches and subject coverage gaps.
- \Specialization Mapping\ (/specialization-mapping) UI for non-hardcoded synonym management.

### Fixed
- Corrected \/faculty/specializations\ API to return unique specializations instead of departments.
- Fixed teacher coverage drilldown in Subjects page to show eligible unassigned teachers.

### Changed
- Refactored Teaching Load UI to use Tiered Qualification (Specialization > Department > Fuzzy).
- Enhanced faculty list with visual Load Percentage indicators and specialization labels.

## [2026-05-12] - Officer View Strengthening Wave 1

### Added
- Orphan Specialization Detection: The Specialization Mapping UI now flags unmapped terms from EnrollPro.
- Granular Scheduler Failure Reasons: The scheduler now provides specific reasons for unassigned classes (Preference Conflict vs. Capacity vs. No Qualified Faculty).
- New implementation plan tracking file: OFFICER_STRENGTHENING_PLAN.md.

## [2026-05-12] - Officer View Strengthening Wave 2

### Added
- Constraint Clash Auditor: Identifies faculty whose restrictive preferences ( >50% unavailable) will likely cause scheduling failures for their specialized subjects.
- Subject Roster Integrity Report: Cross-references Section program templates (STE, SPA, REG) to ensure 100% curriculum coverage (flagging sections missing teachers for core subjects).
- New Audit View KPIs: Added 'Constraint Clashes' and 'Roster Gaps' to the main dashboard.

## [2026-05-12] - Officer View Strengthening Wave 3

### Added
- Granular Room Suitability: Added 'Required Features' to Subjects and 'Features' to Rooms (e.g., Greenhouse, ICT-Lab).
- Room Suitability Audit: Identifies subjects that cannot be scheduled because no room meets their feature requirements.
- Specialist Optimization Audit: Flags under-utilized specialists who are teaching general load while their specialty is assigned to others.

### Changed
- Genetic Scheduler now enforces feature-matching during room allocation.
- Subject and Map Editor UIs updated to support feature tagging with semantic badges.

## [2026-05-12] - Officer View Strengthening Wave 4

### Added
- Scheduling Safety Rails: Manual Edit panel is now fully qualification and feature aware.
- Qualification Indicators: Real-time Tier 1/2/3 badges in Faculty reassignment dropdowns.
- Room Feature Matching: Visual warnings and hard constraint enforcement for specialized room requirements (e.g., Lacks Greenhouse).
- Explainability Upgrade: Explainability Drawer now provides plain-language reasons for feature and qualification violations.

## [2026-05-12] - Officer View Strengthening Wave 5

### Added
- Section Durable Caching: Implemented \SectionMirror\ model to persist structural section data from EnrollPro.
- Section Manual Sync: Added 'Sync' button to the Sections page to reconcile external changes manually.
- High Availability Scheduler: The Genetic Scheduler now uses the durable \SectionMirror\ cache, ensuring runs succeed even if the EnrollPro bridge is temporarily down.

### Changed
- Sections UI updated to show 'Last Synced' status and proactive fallback banners.
