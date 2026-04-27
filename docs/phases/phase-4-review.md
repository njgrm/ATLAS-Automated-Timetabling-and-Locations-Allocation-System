# Phase 4 Plan - Review And Manual Adjustment

## Status
- State: In Progress
- Started: 2026-04-02

## Scope
- Officer review workspace for generated schedules
- Conflict/warning visibility and resolution workflow
- Manual adjustments with optimistic locking and auditability

## Planned Deliverables
- [x] Review console UI with conflict overlays and filtering (Batch 1)
- [x] Generate + Publish workflow with violation guardrails (Batch 2)
- [x] Grid pivot modes: View By Section / Faculty / Room (Batch 2)
- [x] Room identity clarity + integrity hardening (Batch 3)
- [ ] Manual move/reassign actions with validation guards
- [ ] Revalidation trigger and updated violation report after edits
- [ ] Audit log entries for manual adjustments

## Batch 1 — Review Console UI Foundation (2026-04-02)
- Unlocked Timetable sidebar nav for admin/officer/SYSTEM_ADMIN
- Created `ScheduleReview.tsx` page at `/timetable` route
- Three-panel layout: violation panel (left), timetable grid (center), entry detail (right)
- Run selector (latest + specific run ID) and section filter
- Filter chips: All / Hard / Soft / Conflicts
- Inline stat banner: status, assigned/total, hard violations, total violations, duration, timestamp
- Violation panel with search, grouped by code, severity badges, click-to-highlight
- Timetable grid with day x time matrix, color-coded entries by violation severity
- Entry detail panel with subject/section/faculty/room info, linked violations, DepEd grade badges
- Placeholder action buttons (Reassign Faculty, Move Timeslot, Change Room) with tooltip "Phase 4 edit API pending"
- Mark for Follow-up session-local triage tag
- Loading skeletons, empty states (no runs, no entries, no violations), error state with retry
- Types added: GenerationRun, RunSummary, ScheduledEntry, Violation, ViolationReport, DraftReport

## Batch 2 — Review UI Workflow Expansion (2026-04-02)
- **Generate New Timetable:** Play button triggers `POST /generation/:schoolId/:schoolYearId/runs`; confirmation dialog warns if follow-up flags exist; disabled while generating/loading
- **Publish Schedule:** Send button disabled when hard violations > 0; dialog with soft violation summary + acknowledgment Checkbox; publish action is Phase 5 placeholder (toast)
- **Grid Pivot Modes:** View By selector (Section / Faculty / Room) in toolbar; client-side pivot with `pivotEntityIds`, `pivotLabel`, `pivotKeyOf`; room reference data from buildings endpoint
- Installed `@radix-ui/react-checkbox`; created `atlas-client/src/ui/checkbox.tsx` (shadcn Checkbox)
- Enhanced empty state: no-runs now includes Generate button
- Room map loaded from buildings API at `/map/schools/:schoolId/buildings`

## Batch 3 — Room Identity Clarity + Integrity Hardening (2026-04-02)
- **Building.shortCode** field added to Prisma schema (nullable, `short_code` column)
- Short-code generator: `generateBuildingShortCode()` in `atlas-server/src/lib/building-short-code.ts`
  - Strips filler words (and/the/of), takes uppercase initials, appends trailing numbers
  - Examples: `Main Building 1` → `MB1`, `Science and Technology Building` → `STB`
- `getBuildingsBySchool()` backfills missing shortCodes for existing buildings (non-destructive)
- `upsertBuilding()` auto-generates shortCode on create; `updateBuilding()` regenerates if name changes and no custom code set
- Building shortCode passthrough: map router accepts `shortCode` in create/update payloads for manual override
- **Room creation integrity:** `addRoom()` forces `isTeachingSpace=false` when parent building is non-teaching
- **Generation room query hardened:** `prisma.room.findMany` now requires `isTeachingSpace: true` AND `building.isTeachingBuilding: true`
- **Frontend `RoomInfo` enriched map:** roomMap now holds building context (buildingName, buildingShortCode, floor)
- **Entry detail panel:** shows `RoomName · BuildingLabel (Floor X)` with stale-room badge fallback
- **Grid cells:** show compact `RoomName · BuildingLabel` in all view modes
- **Room pivot sort:** rooms sorted by building label → room name (not numeric ID)
- **Historical fallback:** missing roomIds display `Unknown Room (#id)` with amber "stale" badge
- Frontend `Building` type updated with `shortCode: string | null`
- `CampusMapEditor.tsx` new-building creation includes `shortCode: null`

## Batch 4 — UX/Functional Correction Pass (2026-04-03)

### A: Fix Pseudo-Pivot Filtering
- View By Section/Faculty/Room now filters `gridEntries` by the selected entity's actual field (sectionId/facultyId/roomId), not just labels
- `sectionFilter` state replaced with generic `entityFilter` (string, default `'all'`)
- Entity filter `<Select>` dynamically shows `pivotEntityIds` with `pivotLabel` for the active view mode
- `setEntityFilter('all')` resets on viewMode change

### B: Split Header into Two Rows
- Row 1 (Run Management): run selector, Generate button, Publish button, Refresh button, inline stat banner (status, assigned, hard violations, duration) pushed right via `ml-auto`
- Row 2 (Grid Controls): View By pivot select, entity filter select, separator, severity filter chips (All/Hard/Soft/Conflicts)
- Removed standalone stat banner row; stats integrated into Row 1 tail

### C: Unassigned Queue Tab
- Added `leftTab` state (`'violations' | 'unassigned'`) with tab switcher at top of left panel
- Violations tab: search + grouped violations (existing)
- Unassigned tab: classes processed/assigned/unassigned/policy-blocked metrics, coverage by section with DepEd grade badges and entry counts, success checkmark when all assigned
- Badge counts on each tab header

### D: Explicit Section Names
- Fetch `GET /sections/summary/:schoolYearId?schoolId=:id` to build `sectionMap: Map<number, ExternalSection>`
- `sectionLabel()` now resolves to real section names (e.g. "7-Einstein") instead of "Section #id"
- `gradeForSection()` prefers section adapter grade data, falls back to subject-based inference
- Applied in ScheduleReview.tsx and RoomSchedules.tsx
- Added `ExternalSection` and `SectionSummaryResponse` types to `types.ts`

### E: Dashboard Room Schedule Preview
- New `RoomSchedulePreview` component in Dashboard.tsx
- Fetches room schedule via `GET /room-schedules/:schoolId/:schoolYearId/rooms/:roomId?source=latest`
- Shows compact day grid (M/T/W/Th/F) with slot count per day
- Displays utilization %, entry count, conflict count
- "View Full Schedule" link to `/room-schedules`
- Handles non-teaching rooms, loading, and empty states gracefully

### F: RoomSchedules Section Labels
- Covered by D; RoomSchedules.tsx now resolves section names via `sectionMap`

### G: Follow-Up Flags Persistence
- **Database:** `FollowUpFlag` model added to Prisma schema (id, runId, entryId, note, createdBy, createdAt; unique [runId, entryId]; index on runId); migration `0002_add_follow_up_flags` applied
- **Service:** `follow-up-flag.service.ts` with `listByRun()`, `toggleFlag()`, `removeFlag()`
- **Router:** `follow-up-flag.router.ts` mounted at `/api/v1/follow-up-flags` with GET/PUT/DELETE endpoints, `authenticate` + role check
- **Client:** ScheduleReview.tsx `followUps` state now loaded from API on run fetch, toggle is optimistic with server `PUT` and revert on failure

## Cross-Phase Hardening — Wave 3.5.2 EnrollPro-First Seeding + Strict Qualification Fix (2026-04-21)
- User-approved corrective batch executed during Phase 4 to harden source-of-truth behavior before further review tooling work.
- Added shared realistic JHS dataset and EnrollPro `db:seed-atlas-source` path so EnrollPro owns the 154-teacher / 83-section / special-program source dataset.
- `atlas-server/src/scripts/seed-realistic.ts` now defaults to `enrollpro-source` and only uses `atlas-fixture` when `--confirmFixtureBypass=true` is supplied explicitly.
- Faculty sync now consumes the school-year-aware EnrollPro faculty-sync contract; section auto mode no longer drops to stub data; cohort auto mode now uses cached upstream data instead of silent stub fallback.
- EnrollPro sections and curriculum controllers now count `NULL` `eosyStatus` rows as active and expose explicit cohort data for ATLAS.
- Faculty assignment qualification logic now fails closed for missing/unknown departments, with Homeroom Guidance as the explicit cross-department exception.
- Verification evidence logged in `docs/verification/evidence-log.md` for live EnrollPro sync, cached upstream fallback, and strict qualification smoke tests.

## Cross-Repo Kickoff — Wave 3.5.3 + Wave 4.0 Hardening (2026-04-21)
- Fixed the EnrollPro build blocker by making router typing portable in `eosy.router.ts` and restoring Prisma-compatible mutable where-input typing in sections/curriculum controllers.
- Locked the authoritative EnrollPro contract surface for ATLAS by documenting and exposing stable shapes for `/api/teachers/atlas/faculty-sync`, `/api/sections/:ayId`, and `/api/curriculum/:ayId/scp-config`.
- EnrollPro sections now emit explicit `programCode`, `programName`, `adviserId`, and `adviserName` fields in addition to the normalized `advisingTeacher` payload so ATLAS can consume a stable source-of-truth contract without ad hoc inference.
- Added aligned root/server scripts plus `atlas-server/src/scripts/verify-cross-repo-source-gate.ts` to automate the full source-of-truth gate: EnrollPro authoritative seed, ATLAS live mirror reset, live verification, and cached-upstream verification.
- `ScheduleReview.tsx` now uses a dedicated helper module for program and entry-kind filtering, pushes cohort/program/adviser metadata through fix-suggestion requests, and renders cohort-aware fallback copy when upstream fix suggestions are absent.
- `fix-suggestions.service.ts` now returns cohort-aware labels, details, and remediation copy for unassigned cohort sessions instead of generic section-only wording.
- `faculty.router.ts` route order was corrected so `/sync`, `/advisers`, and `/:id/homeroom-hint` are no longer shadowed by `/:id`.
- `FacultyAssignments.tsx` now surfaces adviser-backed homeroom guidance inline for the selected faculty member when an adviser mapping exists.
- Verification evidence logged in `docs/verification/evidence-log.md` for the repaired EnrollPro build, ATLAS server/client typechecks, Wave 4 test expansion, cross-repo gate, and manual browser QA on `/timetable` and `/assignments`.

## Wave 4.1 — Teaching Load Precision Gate (2026-04-21)
- Added authoritative section-level persistence for faculty assignments via `FacultySubject.sectionIds` and migration `0011_wave4_1_teaching_load_precision`, while preserving legacy `gradeLevels` compatibility through normalization.
- Added shared scope normalization in `faculty-assignment-scope.service.ts` so assignment reads, saves, generation, and manual edit validation all converge on the same subject-plus-section contract.
- `faculty-assignment.service.ts` and `faculty-assignment.router.ts` now require `schoolYearId` and optimistic `version`, reject duplicate `subjectId + sectionId` ownership, and return section-aware summary metrics.
- Generation and manual edit validation now qualify faculty by section membership instead of grade membership, preventing section drift between assignment storage and schedule validation.
- `FacultyAssignments.tsx` was rebuilt around explicit section checklists, section-based load math, and a session-local pending ownership board that remains visible while switching faculty and blocks overlapping drafts across teachers.
- Added focused regression coverage in `qa-artifacts/wave4-teaching-load-precision.test.ts` and updated the existing Phase 4 cohort review fixtures for the new section-aware contracts.
- Local verification included standard Prisma client regeneration, server/client builds, both Phase 4 regression suites, confirmation that the new migration was already applied locally, and live browser QA of the Teaching Load workflow with an EnrollPro admin bridge session.

## Wave 4.2 — Room Preference Request Workflow Closeout (2026-04-21)
- Added latest-run stale-data validation in the generation service so room-preference latest bootstraps fail explicitly with `STALE_RUN_DATA` when the newest completed draft no longer maps to current active `faculty_mirrors`.
- Extended the shared server error envelope and both room-preference pages so stale-run failures surface an operator action hint instead of a generic load error.
- Regenerated the latest completed draft after the mirror reseed, producing `Run #52` with `2521` draft entries and `146/146` draft faculty IDs matching current active faculty mirrors.
- Live browser QA passed on both room-request portals: the faculty page loaded non-empty assigned sessions, saved a draft request, and submitted it; the officer page loaded the submitted request, opened the review preview, and completed the review path with the correct disabled-approve guard and successful rejection action.

## Wave 4.3 — Timetable Workspace Finalization (2026-04-22)
- Sidebar behavior hardened in `AppShell.tsx` so entering `/timetable` collapses the shell to icon mode by default while still allowing manual re-expand.
- Room-request review sheet hardened in `ScheduleReview.tsx`:
  - fixed preview field bindings (`hardViolations`/`softViolations`) to remove runtime crashes.
  - added explicit blocked-preview panel with actionable conflict details.
  - disabled Approve when preview disallows the request.
  - fixed duplicate React keys for repeated conflict rows.
  - added `allowSoftOverride` on Approve when preview has soft warnings, aligning with backend `SOFT_OVERRIDE_REQUIRED` contract.
- Added QA-only deterministic seeding command `npm --prefix atlas-server run seed:qa-room-requests` via `atlas-server/src/scripts/seed-qa-room-requests.ts`.
- QA seed evidence produced against `runId=53`:
  - request `id=2` (GUERRERO, GRACE) seeded as approvable and reviewed to `APPROVED`.
  - request `id=3` (AQUINO, CARMEN) seeded as blocked-preview and reviewed to `REJECTED`.
- Manual bridged QA reconfirmed:
  - `/timetable` opens with collapsed sidebar icon state.
  - right panel starts collapsed/empty prompt.
  - conflict inspector remains visible in the workspace.
  - Requests tab loads deterministic pending items and supports in-page review decisions.

## Wave 4.4 — UX + Pre-Generation Workspace Unification (2026-04-27)
- Added a dedicated `/timetable` center workspace state for `Pre-Generation Draft`, separate from generated-run review.
- New Pre-Generation Draft now opens the center grid workspace; repeat clicks with existing draft anchors prompt a destructive reset confirmation.
- The left Pins panel now acts as the pre-generation source palette with unassigned demand plus existing pinned/draft entries; sources drop into the shared timetable grid.
- Building and room navigation no longer opens the separate read-only room schedule table path; room selection filters the shared editable grid by room context.
- Generation anchor coverage was extended so a manual pre-placement is retained and the constructor schedules remaining sessions around its occupied faculty/room/section slot.
- Verification completed:
  - `npm --prefix atlas-client run build`: PASS
  - `npm --prefix atlas-server run build`: PASS
  - `npx tsc --noEmit` in `atlas-client`: PASS
  - `npx tsc --noEmit` in `atlas-server`: PASS
  - `npm --prefix atlas-server run test:wave4-precision`: PASS
  - `npm --prefix atlas-server run test:phase4-review`: PASS
  - `npm --prefix atlas-server run test:wave4.3`: PASS (expanded Wave 4.4 pre-generation anchor coverage)
- Manual bridged browser QA: NOT RUN in this pass; requires live EnrollPro bridge session plus local ATLAS client/server.

## Exit Criteria
- Officer can resolve findings and revalidate
- Publish path is blocked while hard violations remain
- Edit conflicts are safely handled and communicated
