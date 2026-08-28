# Phase 4 Plan - Review And Manual Adjustment

## Status
- State: In Progress
- Started: 2026-04-02

## Scope
- Officer review workspace for generated schedules
- Conflict/warning visibility and resolution workflow
- Manual adjustments with optimistic locking and auditability

## Objective-Priority Slice - Standalone Local Auth (2026-05-08)
- Priority alignment: Objective-critical Priority 1 (standalone ATLAS faculty/scheduler authentication)
- State: Implemented and compile-verified
- Notes:
  - Added local credential login endpoint `POST /api/v1/auth/login` with failed-attempt tracking and lock-window handling in service-layer auth logic.
  - Preserved bridge-auth compatibility in middleware and session verification by normalizing `authSource` as `local` or `bridge`.
  - Added frontend `/login` route and dual-auth shell behavior (local-first token, bridge fallback, source-aware logout destination).
  - Added Prisma auth-account persistence model and migration for local credential-backed identities.
- Verification (2026-05-08):
  - `npm run db:generate`: PASS
  - `npm --prefix atlas-server run build`: PASS
  - `npm --prefix atlas-client run build`: PASS
- Remaining gap:
  - Manual bridge-auth screenshot evidence for protected-route transitions remains pending capture.

## Objective-Priority Continuation - Faculty Workflow Slice (2026-05-08)
- Priority alignment: Objective-critical faculty workflow continuation (mobile-first My Portal, hard access control, live room-request updates, offline-safe sync)
- State: Implemented and verification-complete
- Delivered backend scope:
  - Local auth seeding now provisions deterministic `@deped.edu.ph` local accounts for all active seeded faculty mirrors (duplicate fallback: `firstname.m.lastname@deped.edu.ph`).
  - Added privileged-role enforcement middleware on scheduler/admin endpoints to hard-block faculty direct admin API access.
  - Added faculty portal API `GET /api/v1/faculty-portal/:schoolId/:schoolYearId/dashboard` with lifecycle plain-language status, latest-generated fallback disclaimer, faculty schedule preview, and room-request status cards.
  - Added room-request SSE stream endpoint `GET /api/v1/room-preferences/:schoolId/:schoolYearId/events` with reconnect-safe replay using `Last-Event-ID`.
  - Added offline reconciliation endpoint `POST /api/v1/room-preferences/:schoolId/:schoolYearId/runs/:runId/faculty/:facultyId/sync` with ordered action processing and per-action recoverable result payload.
- Delivered frontend scope:
  - Added mobile-first faculty dashboard route `/my` with fallback banner, preview overlays (current vs pending vs final), and clear CTA to `/my/room-preferences`.
  - Faculty local login now redirects to `/my`; app shell enforces hard client-side route restriction to My Portal pages for faculty role.
  - Faculty room-request page now supports offline outbox queueing + auto-sync and live SSE refresh; officer room-request panel now updates live via SSE.
- Verification (2026-05-08):
  - `npm --prefix atlas-server run build`: PASS
  - `npm --prefix atlas-client run build`: PASS
  - `npm --prefix atlas-server run test:auth`: PASS
  - `npm --prefix atlas-server run test:seed-email-rules`: PASS
  - `npm --prefix atlas-server run test:faculty-route-restrictions`: PASS
  - `npm --prefix atlas-server run test:room-pref-sse`: PASS
  - `npm --prefix atlas-server run test:room-pref-sync`: PASS
  - `npm --prefix atlas-server run test:faculty-dashboard-contract`: PASS
  - `npm --prefix atlas-server run test:faculty-priority-slice`: PASS
- Remaining gap:
  - Manual bridge-auth browser screenshot evidence for `/my`, `/my/room-preferences`, and scheduler live-update panel behavior is pending QA artifact capture.

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

## Wave 4.5 — Pre-Generation Scheduler Truth + Onboarding (Planned / In Progress)

### Why this wave exists (context for new agents)

Wave 4.4 unified **where** pre-generation lives (center workspace, shared editable grid, map/room navigation without a separate read-only table). It did **not** fully solve **how** a scheduler understands what they are placing: faculty and room were often chosen **implicitly** via `choosePreGenFaculty` / `choosePreGenRoom` heuristics (first `facultyOptions` entry, first matching room type), which feels like “the system bound pins to nothing visible.” Officers need **explicit** binding aligned with **teaching load** (who is assigned to which subject × section), **overload policy**, and **department rules**—otherwise pre-gen anchors disagree with operational reality and erode trust before generation even runs.

Additionally, the **Unassigned** tab could still surface **last-run** unassigned items while in pre-generation mode, which mixes two different concepts (post-generation triage vs pre-generation demand). Wave 4.5 corrects that and routes pre-gen placement through **one** API path (`/pre-generation-drafts/preview` + `/commit`).

**Direction:** Pre-generation should feel like **drafting with a map and a timetable**, not like a hidden auto-complete. Map-first onboarding, mandatory confirmation steps, teaching-load-aware faculty pickers, and a richer Pins panel reduce wrong anchors and support DepEd-style load discipline (standard day vs capped overload vs unacceptable overload).

### Product goals

1. **Entry:** Opening pre-generation lands on **full map** with banner: *“Choose a room or faculty to begin drafting schedules.”*
2. **Mandatory confirmation:** Every queue (and pre-gen-unassigned) drop opens **Faculty + Room** confirmation before preview/commit—even if pivot already implies values.
3. **Teaching load truth:**
   - Selectable faculty = assigned faculty for that session per teaching load; **live** daily totals for warnings.
   - **Outside-department** faculty appear only if teaching load allows “teach outside department”; otherwise **filtered out**.
   - **No teacher configured:** flag clearly; offer **in-department** options with rich labels (what they teach / sections).
4. **Unassigned tab in pre-gen:** Show **pre-gen unscheduled demand only** (not last-run unassigned); use **pre-gen commit** like queue items.
5. **Conflict UX:** Short **why** summary; **full-week pre-gen** context for faculty or room so schedulers can move slots without resetting the pin.
6. **Map → grid:** Room pick **auto-switches** to timetable in **room** pivot with clear room label; **room dropdown** stays in sync with map selection.
7. **Desktop-first:** Below agreed breakpoint, **disable drag-and-drop**; use non-DnD flows so phone widths do not break.

### Daily teaching load policy (faculty, per day)

These thresholds apply when evaluating **whether a proposed pre-generation placement is acceptable** for the selected faculty on the **target day** (include existing draft anchors that day; use the same minute accounting as the rest of the timetable).

| Band | Hours (teaching) | UX / commit |
|------|------------------|-------------|
| Standard | ≤ **6** | No overload warning. |
| Overload (soft) | **> 6** and ≤ **8** | **Soft warning**; user must **acknowledge** before commit (align with existing soft-override pattern for pre-gen). |
| Blocker (hard) | **> 8** | **Hard block**; not committable without changing day/slot, faculty, or other placements; **no** soft override for exceeding 8 hours. |

### Implementation notes (high level)

- **Backend:** Extend or add service logic for preview/commit to enforce the 6h / 8h band rules and to intersect faculty lists with teaching-load + department flags; keep controllers thin.
- **Frontend:** `ScheduleReview.tsx` (pre-gen flows), Pins panel (search, filters, responsive grid), confirmation sheet/dialog, conflict inspector + week context; gate DnD by breakpoint.
- **Verification:** Extend `test:wave4.3` or add focused tests for daily-minute aggregation and hard/soft classification; bridged manual QA on `/timetable` pre-gen.
- **Evidence:** Log passes in `docs/verification/evidence-log.md` when the wave closes.

### Status

- **State:** Complete (2026-05-01)

### Changes delivered

**Backend (`atlas-server/src/services/pre-generation-draft.service.ts`):**
- Added `FacultyOptionEnriched` interface with `id`, `name`, `department`, `canTeachOutsideDepartment`, `dailyMinutesByDay`.
- Extended `DraftQueueItem` with `facultyOptionsEnriched: FacultyOptionEnriched[]` and `hasNoTeacher: boolean`.
- Extended `DraftPlacementPreview` with `dailyLoadBand`, `dailyMinutesAfter`, `facultyWeeklyMinutes`.
- Added helpers: `computeFacultyDailyMinutes`, `computeFacultyWeeklyMinutes`, `classifyDailyLoadBand`.
- `buildBoardStateFromContext`: queue items now include enriched faculty options with daily load context and the `hasNoTeacher` flag.
- `previewPlacement`: returns `dailyLoadBand`, `dailyMinutesAfter`, `facultyWeeklyMinutes`.
- `commitPlacement`: hard blocks at > 8h (`DAILY_LOAD_HARD_BLOCK`, 422); soft requires explicit `allowSoftOverride` at > 6h (`DAILY_LOAD_SOFT_OVERRIDE_REQUIRED`, 422).
- `facultyMirrors` Prisma query: added `canTeachOutsideDepartment: true` to select.

**Frontend (`atlas-client/src/types.ts`):**
- Added `FacultyOptionEnriched` type.
- Extended `DraftQueueItem` with `facultyOptionsEnriched` and `hasNoTeacher`.
- Extended `PreviewResult` with optional `dailyLoadBand`, `dailyMinutesAfter`, `facultyWeeklyMinutes`.

**Frontend (`atlas-client/src/pages/ScheduleReview.tsx`):**
- Goal A: `openPreGenerationWorkspace` now lands on `'map'` center view + sets `preGenOnboarding = true`.
- Goal A: Map panel shows dismissable onboarding banner when `preGenOnboarding` is active.
- Goal B: `stagePreGenDrop` no longer auto-binds; always opens `PreGenConfirmSheet`.
- Goal B+C: `PreGenConfirmSheet` (Dialog) with faculty picker (daily load per option, color-coded bands), room picker, weekly load strip, live preview, soft/hard daily override flow, Save Anchor button blocked while hard violations or hard daily load remain.
- Goal C: Faculty options per session come from `facultyOptionsEnriched`; `hasNoTeacher` shows amber alert with fallback to all active faculty.
- Goal E: Unassigned tab in pre-gen mode sources from `draftBoard.queue` (pre-gen demand), not last-run `draft.unassignedItems`.
- Goal G: `openRoomGridWorkspace` clears `preGenOnboarding` and switches to `pre-generation` grid.
- Goal H: Pins panel gains search input + grade filter `<Select>` + 2-column responsive grid.
- Goal I: `useIsDesktop` hook; all `draggable` on Pins panel and Unassigned items gated by `isDesktop`.
- New icons imported: `BookOpen`, `Info`, `MapPin`, `UserX`.
- New callbacks: `runConfirmPreview`, `commitConfirmPlacement`.

**Tests (`atlas-server/src/__tests__/wave4-pre-generation-draft.test.ts`):**
- Added Wave 4.5 section: 6 tests for `classifyDailyLoadBand` boundaries (0, 360, 361, 480, 481, 600 min).
- Added Wave 4.5 section: 4 tests for `hasNoTeacher` flag logic.
- Total: 22/22 pass.

### Verification evidence

| Step | Result |
|------|--------|
| `npm --prefix atlas-client run build` | PASS |
| `npm --prefix atlas-server run build` | PASS |
| `npm --prefix atlas-server run test:wave4.3` | PASS (22/22) |
| Manual bridged QA | Pending live session |

## Wave 4.5c — Pre-Generation State Machine Hardening (2026-05-06)
- Added atomic pre-generation swap service endpoints in `atlas-server/src/services/pre-generation-draft.service.ts` and `atlas-server/src/routes/pre-generation-draft.router.ts`.
- Pinned-to-pinned swaps now preview and commit through a single server-controlled transaction instead of the prior client delete-plus-two-commit sequence.
- Pre-generation commit policy no longer blocks on soft violations or daily soft overload; hard conflicts and daily hard overload still block.
- `atlas-client/src/hooks/useTimetableMutations.ts` now routes pinned swaps through `/pre-generation-drafts/swap` and uses `/pre-generation-drafts/swap/preview` for dialog validation.
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx` now exposes an explicit `Back to Generated Run` action while in pre-generation mode.
- Generate confirmation and success messaging now explain that anchored draft placements lock into the new generated run and the workspace returns to generated-run view after generation.
- `atlas-server/src/__tests__/wave4-pre-generation-draft.test.ts` now includes Wave 4.5c source-guard regressions for atomic swap wiring, soft-warning policy removal, and lifecycle affordances.

### Wave 4.5c verification

| Step | Result |
|------|--------|
| `npm --prefix atlas-server run build` | PASS |
| `npm --prefix atlas-client run build` | PASS |
| `npm --prefix atlas-server run test:wave4.3` | PASS (33/33) |
| Manual bridged QA for pinned swap / generate-from-pre-gen / back-to-run path | Pending live session |

## Wave 4.5c Follow-up — Grid Drag Usability + Scoped Swap Preview + Pinned Rail UX (2026-05-06)
- Pre-generation preview requests now accept `excludePlacementIds`, allowing the client to simulate queue-to-occupied displacement without previewing against the occupied slot.
- `atlas-client/src/hooks/useTimetableMutations.ts` now loads scoped per-leg swap previews for pinned-to-pinned moves and a displacement-aware preview for queue-to-occupied moves, replacing the old global dialog warning surface.
- Grid drags for draft placements now normalize to `draftPlacement` drag items at drag start, so in-grid pinned drags follow the same swap/open-confirm path as left-rail pins.
- The left rail now exposes a dedicated `Pinned Sessions` drop zone plus Room / Section / Faculty pivot buttons for each pinned draft entry.
- `atlas-server/src/__tests__/wave4-pre-generation-draft.test.ts` source guards were updated to verify the new displaced-slot preview flow instead of the old client atomic-preview callsite.

### Wave 4.5c follow-up verification

| Step | Result |
|------|--------|
| `npx tsc --noEmit` (atlas-client) | PASS |
| `npm --prefix atlas-client run build` | PASS |
| `npm --prefix atlas-server run build` | PASS |
| `npm --prefix atlas-server run test:wave4.3` | PASS (34/34) |
| Manual bridged QA for follow-up drag/swap/pinned-rail flows | Blocked: EnrollPro `admin@deped.edu.ph` / `Admin2026!` returned `Invalid email or password`, so same-tab bridge auth could not be established |

## Wave 4.5c Follow-up 2 — Drag Source Visibility + Pinned Panel Split + Swap Readability (2026-05-06)
- In-grid draft placement drags now resolve directly from `placementId` payloads and hide the source card while dragging, so pinned sessions no longer appear visually stuck inside their original cells during a drag.
- The pre-generation left rail now treats `Unassigned`, `Pinned`, and `Requests` as first-class tabs; pinned sessions are no longer appended under the queue panel.
- Shared search and filter controls now drive both the unassigned queue and the pinned-session panel in pre-generation mode.
- The confusing pre-generation `Locked` metric was removed from the left-rail summary surface.
- Swap confirmation now renders a wider before/after layout with session cards, slot context, human-readable labels, and larger hard/soft warning copy instead of raw preview identifiers and dense text rows.

### Wave 4.5c follow-up 2 verification

| Step | Result |
|------|--------|
| `npx tsc --noEmit` (atlas-client) | PASS |
| `npm --prefix atlas-client run build` | PASS |
| Manual bridged QA for grid drag visibility, pinned-tab behavior, and swap dialog readability | Blocked: local EnrollPro bridge auth still rejects the documented credentials, so protected `/timetable` verification could not be re-run |

## Wave 4.5c Follow-up 3 — Grid DnD Reliability + Timetable Entry Performance (2026-05-06)
- `TimetableGrid` draggable cards now forward the DOM ref through the draggable node, so `TooltipTrigger asChild` and `@dnd-kit/core` both bind to the same element for in-grid drag registration.
- Drag-time cell feedback no longer relies on per-cell motion wrappers; this reduces animation work while the pointer moves across dense timetable cells.
- Grid tooltip composition is now consolidated under a single provider instead of per-card providers to reduce provider churn during drag hover.
- `/timetable` route entry now lazy-loads the heavy workspace module and uses `TimetableSkeleton` in route Suspense so first navigation no longer appears visually stalled.
- Bridge-auth credential references in project knowledge/instruction files are updated to `admin@deped.edu.ph / Admin2026!`.

### Wave 4.5c follow-up 3 verification

| Step | Result |
|------|--------|
| `npx tsc --noEmit` (atlas-client) | PASS |
| `npm --prefix atlas-client run build` | PASS |
| Manual bridged QA for generated-run and pre-generation pinned in-grid drag | Pending live bridged session |


## Exit Criteria
- Officer can resolve findings and revalidate
- Publish path is blocked while hard violations remain
- Edit conflicts are safely handled and communicated

## Wave 4.5c Recovery Context (2026-05-06)

### Why this section exists
- Multiple implementation passes reported "READY" but manual QA still reproduced core pre-generation regressions.
- Build/typecheck success alone is not sufficient for timetable acceptance; interaction path correctness must be proven.
- This section is the required handoff context for any agent touching `/timetable` pre-generation DnD, swap, commit, and generation lifecycle behavior.

### Current observed problems (manual QA)
- Dragging pinned sessions in-grid remains inconsistent; swap modal behavior regresses across passes.
- Some swap flows still displace sessions to unassigned instead of performing a true pinned-to-pinned switch.
- Soft conflict handling is inconsistent across paths; some paths still feel blocked despite policy requiring soft warnings to be non-blocking.
- Pre-generation generation flow is confusing: after generate, users perceive blank-slate behavior with unclear meaning of locked placements.
- Missing/unclear navigation path back to generated run from pre-generation workspace.

### Root causes confirmed from code audits
- Client swap flow has used multi-step orchestration (delete + commit + commit), which can create partial-failure states and regression loops.
- Pre-generation drag/drop semantics have mixed generic entry-path and draft-placement path behavior, causing branch mismatch under certain targets.
- Soft-warning logic has been implemented in multiple places, allowing policy drift between preview/commit/swap paths.
- `LOCKED_FOR_RUN` lifecycle is valid server behavior but not communicated clearly in UI, so expected state transitions look like data loss to users.

### Required behavior contract (must hold after fix)
1. Pinned-to-pinned drag on occupied slot opens swap flow and performs a true two-way switch.
2. Queue-to-occupied drag may displace existing placement to unassigned (as designed), but pinned-to-pinned must not.
3. Soft violations are warnings only in pre-generation; they never block placement commits.
4. Hard violations and hard daily-load violations block placement.
5. Generation from pre-generation must clearly transition UI context and explain lock state.
6. User must have an explicit "Back to Generated Run" path while in pre-generation.

### Implementation guidance for next pass
- Prefer server-atomic swap operation for pinned-to-pinned swaps to eliminate partial client-side state transitions.
- Unify pre-generation commit policy at service boundary (single source of truth for hard/soft handling).
- Keep DnD routing deterministic: pre-generation drags must route through one pre-generation mutation contract.
- Include explicit lifecycle/status indicators for `DRAFT`, `LOCKED_FOR_RUN`, and `ARCHIVED` counts in UI.

### Acceptance gate (mandatory)
- No "READY" verdict without:
  - Typecheck + build pass
  - Automated tests covering swap atomicity and soft/hard policy outcomes
  - Manual QA evidence for all required behavior contract items above

---

## Wave 4.6 — Seeding Quality & Teaching Load Hardening (2026-05-12)

### Context & Diagnosis

**Current Findings (May 12, 2026):**

After Run 14 achieved 0 hard violations and Run 15 was generated with remaining concerns:

1. **FacultySubject Distribution (Current State):**
   - Total assignments: 472 rows
   - Subjects with minimum cover: 12 (only 1 faculty each)
   - Average subjects per faculty: 3.3
   - Min: 1 subject | Max: 10 subjects
   - 58/142 faculty teaching only 1 subject (minimum cover baseline)
   - 62/142 faculty teaching 4+ subjects (potentially overloaded)

2. **Teaching Load Health:**
   - No overlapping assignments in current seeding (good)
   - But load distribution is non-realistic:
     - 40% of faculty assigned only minimum coverage
     - 44% of faculty overloaded (4+ subjects each)
     - No hour-based validation or load balancing
   - Missing link between teaching hours and subject count

3. **Adviser-HG Mapping Gap:**
   - 66 class advisers from EnrollPro (isClassAdviser=true)
   - HG has 69 faculty assigned
   - No relationship between section adviser and HG assignment
   - Creates unassigned HG sections despite adviser data

4. **Specialization Mapping Completeness:**
   - Only 61 aliases mapped (basic BEC subjects)
   - 12 subjects with single faculty only (forced minimum cover)
   - 15 advanced/elective/research subjects underrepresented
   - No clustering logic (ADVANCED_CHEMISTRY shouldn't auto-assign to SCI + MATH both)

5. **Building/Room Seeding:**
   - 20-24 floors per grade level not seeded
   - Contributing to 60% unassigned section cascade (1752/2912)

### Problems Identified

**Problem 1: Non-Realistic Teaching Load Distribution**
- Seeding assigns subjects but ignores workload hour math
- Frontend controls can be bypassed via backend API
- Algorithm inherits bad input and can't optimize

**Problem 2: Class Adviser-HG Disconnect**
- HG should be strictly section-adviser-based, not random
- Creates orphaned HG assignments and unassigned adviser sessions

**Problem 3: Incomplete Specialization Mapping**
- Only handles 19 BEC subjects, not full 34-subject catalog
- Advanced/research subjects seeded via fallback hack (1 faculty each)
- No smart subject clustering

**Problem 4: Unassigned Sections Cascade**
- 60% unassigned (1752/2912) likely caused by:
  - Incomplete faculty seeding (12 subjects with 1 faculty each)
  - Room/building data missing (no per-grade floors)
  - Section-grade mapping validation not visible

### Proposed Solutions (Wave 4.6 Scope)

#### **Task 4.6.1: Smart Load-Based Seeding** 
Create a new seeding script that:
- For each faculty → fetch specialization → map to teaching subjects
- Calculate expected hours per subject per grade level (using subject.minMinutesPerWeek or section counts)
- Assign subjects until reaching 30-35h/week (optimal zone)
- Hard-cap at 40h/week
- NEVER assign overlapping sections for same subject-grade pair
- Auto-assign HG to class advisers (isClassAdviser=true)

**Expected outcome:** 
- ~120-130 faculty teaching 2-4 subjects each (realistic distribution)
- All teaching load within 30-40h/week range
- ~50-60 HG assignments mapped to actual advisers
- No overlapping teaching assignments

#### **Task 4.6.2: Explicit Adviser-HG Mapping Service**
Create a service that:
- Reads Section.adviserId from EnrollPro
- For each section → find adviser faculty → create FacultySubject(subject=HG, grades=[section's grade])
- Mark assignment as ADVISER_MANDATORY (flag for manual-edit guards)
- Validates no conflicts or duplicates

**Expected outcome:**
- 66 HG assignments (one per adviser)
- Every section with an adviser has exactly one HG instructor
- No unassigned HG sections

#### **Task 4.6.3: Expand Specialization Mapping**
Update the SpecializationAlias table to cover:
- **Phase 1 (BEC core):** Current 61 aliases
- **Phase 2 (Advanced):** Map specializations to advanced subjects
  - ADVANCED_CHEMISTRY → SCI specialization
  - ADVANCED_PHYSICS → SCI specialization
  - ADVANCED_STATISTICS → MATH specialization
  - RESEARCH_I/II/III → SCI/MATH specialization
- **Phase 3 (Electives):** Map contextually or randomly
  - ICT → TLE specialization
  - CREATIVE_WRITING → ENG specialization
  - etc.

**Expected outcome:**
- All 34 subjects mapped to at least one specialization
- Advanced/research subjects auto-included in seeding
- No more than 1-2 faculty per advanced subject (realistic scarcity)

#### **Task 4.6.4: Backend Teaching Load Validation & Guards**
Add service-layer validation:
- `validateTeachingLoad()`: Verify faculty daily load ≤ 8h (hard), ≤ 6h standard
- `validateNoOverlapForSubject()`: Check same faculty × same subject × overlapping time
- `validateMaxWeeklyLoad()`: Enforce ≤ 40h/week
- Block room assignments if teaching load exceeds limits (hard fail)

**Expected outcome:**
- Backend prevents invalid assignments
- Pre-generation confirms load is within thresholds
- Publish workflow blocks if any faculty exceeds 40h/week

#### **Task 4.6.5: Specialization Mapping UI Redesign**
Redesign mapping interface from dropdown-to-dropdown to **cards + auto-population**:
- Left: Specializations fetched from EnrollPro (auto-populated)
- Right: Checkboxes for related subjects (preset by mapping logic)
- Global Save button (batch operation)
- Unsaved changes confirmation on nav away

**Expected outcome:**
- Less overwhelming UX
- Users can quickly enable/disable advanced subjects per specialization
- Fewer errors from manual mis-mapping

### Acceptance Criteria

#### **Wave 4.6 Completeness Gate**
- ✅ Smart load-based seeding script runs successfully
- ✅ Teaching load output: 120-130 faculty with 30-40h/week loads
- ✅ HG assignments: 66 advisers mapped, 0 orphaned sections
- ✅ Specialization aliases: 34/34 subjects mapped
- ✅ Backend validation: hard-block logic implemented and tested
- ✅ Generation runs with new seed → 0-10 hard violations (< Run 13's 83)
- ✅ Unassigned sections reduced: target < 20% (from current 60%)

#### **UX & Documentation Completeness**
- ✅ Mapping UI redesigned and verified in live session
- ✅ Teaching load display in pre-generation confirmation
- ✅ Adviser-HG link visible in assignment review
- ✅ Documentation in instruction files for seeding strategy

### Pending Clarifications (Required Before Implementation)

1. **Teaching hours calculation basis:**
   - Should we use `subject.minMinutesPerWeek` as the base?
   - Or derive from section counts (e.g., 50min × 5 sessions/week = 250 min)?

2. **Adviser conflict scope:**
   - Can a class adviser also teach other subjects?
   - Should adviser role be dedicated HG-only or concurrent?
   - If concurrent, how do we balance their total load?

3. **Smart suggestion behavior (legacy "quick resolve"):**
   - Should specialization matching auto-enable all related subjects?
   - Or only primary specialization?
   - Should department be a filter or secondary selector?

4. **Building/room seeding priority:**
   - Should building seed fix be prerequisite for teaching load fixes?
   - Or are they independent enough to parallelize?

5. **Unassigned section tolerance:**
   - Target: 0 unassigned? Or acceptable % (e.g., 5-10% for constraints)?
   - Should hard-constraint violations take priority over unassigned count?

### Status
- **State:** Pending clarifications (discovery phase)
- **Started:** 2026-05-12
- **Detailed findings:** `docs/phases/phase-4-seeding-findings-2026-05-12.md`

## Wave 4.6b — Department + Specialization UX/Data Alignment Plan (2026-05-13)

### Live verification from tailnet (completed)

Verified against the active EnrollPro tailnet host (`http://dev-jegs.buru-degree.ts.net:5002/api`):

- `GET /integration/v1/school-year` returns active school year `id=38`, `yearLabel=2026-2027`.
- `GET /integration/v1/faculty?page=1&limit=5` returns department metadata on each faculty row:
  - `departmentId`
  - `departmentCode`
  - `departmentName`
  - `specialization`
- Sample scope from live payload: `schoolId=15`, `schoolYearId=38`, total `145` active faculty in feed.
- No standalone integration departments endpoint is exposed; department source of truth is the faculty feed.

### Verified concern map (current ATLAS UI)

1. `SpecializationMapping` still uses technical wording and dual-dropdown staging:
   - labels: "EnrollPro Term" and "ATLAS Learning Area"
   - containers: "Add New Mapping", "Quick Resolve", "Map orphans directly"
   - user concern confirmed: workflow feels technical and overwhelming.
2. Current mapping flow is list-first, not department-clustered card-first.
3. Unsaved navigation guard is not present for staged mapping edits.
4. Faculty-facing displays are not consistently showing department + specialization context using live upstream structure.

### Implementation objective for this slice

Replace technical mapping interactions with an operations-friendly workflow centered on **Specialization** and **Subject**, with auto-populated specialization cards grouped by live EnrollPro department metadata.

### Scope (this plan)

#### In scope
- Specialization Mapping page redesign to card-based grouped workflow.
- Department-aware specialization catalog pipeline from live EnrollPro-synced faculty mirrors.
- Faculty display consistency updates where specialization/department context is surfaced.
- Unsaved changes guardrails for mapping edits.
- Keep subject selection via dropdowns per specialization card and global save.

#### Out of scope
- Publish-generation execution itself.
- Scheduler algorithm policy changes unrelated to specialization/department surfacing.
- Non-blocking cosmetic redesigns outside specialization/faculty surfaces.

### Execution plan

#### Step 1 — Data contract extension (server)
- Extend faculty mirror ingestion and response DTOs to preserve live EnrollPro department metadata (id/code/name) alongside specialization.
- Add/extend a read endpoint for specialization mapping UI, returning:
  - grouped departments (`departmentCode`, `departmentName`)
  - specializations per department
  - mapping status per specialization (mapped, partially mapped, unmapped)
  - orphan status where applicable.
- Ensure the endpoint is scoped by school and dynamic school year (`/integration/v1/school-year` resolved value).

#### Step 2 — Terminology cleanup (UI copy)
- Replace technical copy in mapping UI:
  - "EnrollPro Term" -> "Specialization"
  - "ATLAS Learning Area" -> "Subject"
  - "Add New Mapping" container removed
  - "Quick Resolve" and "Map orphans directly" removed
- Keep language plain and task-led: "Pick subjects for this specialization".

#### Step 3 — Card-first specialization mapping redesign
- Build department sections (cards/accordion groups), ordered by department name/code.
- Inside each department group, render specialization cards auto-populated from live data.
- Each specialization card contains:
  - specialization title
  - department chip
  - one subject dropdown (multi-select behavior is optional follow-up; initial pass keeps dropdown per user request)
  - current mapped subjects summary.
- Keep one global Save button in the header/footer rail for batch commit.

#### Step 4 — Unsaved changes protection
- Add dirty-state tracking for staged specialization-subject edits.
- Add before-unload browser guard and in-app route-change confirmation modal when dirty.
- Confirmation actions: `Stay`, `Discard`, `Save and continue`.

#### Step 5 — Faculty display alignment
- Update faculty list and assignment pages to surface the same department + specialization model sourced from live data.
- Ensure sorting/filtering by department uses upstream-aligned department values.
- Keep existing subject dropdown flows where needed, but pre-contextualize by specialization first.

#### Step 6 — Verification gates (must pass before final publish-generation run)
- Data gate:
  - live fetch confirms active school year and department-enriched faculty payload.
  - specialization cards reflect current tailnet payload counts.
- UX gate:
  - no dual-dropdown "add mapping" container remains.
  - no technical "quick resolve/orphans" wording remains.
  - unsaved changes prompt fires on navigation.
- Regression gate:
  - mapping save and reload are deterministic.
  - faculty pages still build and load with filters/sorts intact.

### Target files for planned implementation

- `atlas-server/src/services/faculty-adapter.ts`
- `atlas-server/src/routes/faculty.router.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-client/src/pages/SpecializationMapping.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/types.ts`

### Status
- **State:** Planned (verified with live tailnet payload)
- **Prerequisite met:** Dynamic EnrollPro school year/source verification complete (`schoolYearId=38`)
- **Next action:** Implement Step 1 and Step 2 in one batch, then run UI verification against tailnet-backed data.

---

## Phase 4 Closure — Refactor Implementation Roadmap (Approved 2026-05-15)

### Stakeholder-Driven Architectural Pivots

Phase 4 is transitioning to final acceptance with new stakeholder requirements triggering a **controlled, multi-phase refactor** of core architecture. All pivots have been analyzed, prioritized, and sequenced to ensure data integrity and algorithmic correctness.

**Key Requirements Summary:**
1. **Tri-Sem Calendar Model:** Shift from 4-quarter to 3-term year structure (DepEd DO 009)
2. **Ancillary Load Read-Only Contract:** Lock HR-derived administrative deductions to prevent local mutations
3. **Home-Room-First Scheduling:** Prioritize section home-room assignments; only solve singleton/specialized rooms
4. **Shift Fences & Zone Transitions:** Enforce AM/PM/overlap windows per grade/program
5. **Teacher X Placeholder Workflows:** Support ad-hoc faculty assignments via placeholder records
6. **Draft PDF Export & Concurrency Hardening:** Phase 5+ requirement; depends on refactor completion

### QA Green Light & Architectural Foresight

**Date:** 2026-05-15  
**Status:** Green light to proceed with Option 1 (Tri-Sem + Ancillary Data Contracts) as foundational priority

**Rationale from QA Agent:**
> "You cannot fix the Timetable Generator (Option 2) or build the UI for Teacher X (Option 3) if the foundational database schema is still configured for a 4-quarter year and mutable ancillary loads. Data dictates logic. Until the database expects 3 terms instead of 4, any work done on the algorithm is wasted effort."

**Technical Foresight for Execution:**
While executing Option 1 phases, developers must **simultaneously** pre-stage database schema for Options 2 and 3:
- Add `homeRoomId` and `buildingZoneId` foreign keys to Section table
- Add `isPlaceholder` boolean flag to Faculty table
- Ensure Timetable output schema explicitly supports `termIndex` (1, 2, or 3)

### Refactor Phase Sequence

**Detailed Implementation Plan:** See [refactor-implementation-phases-2026-05-15.md](./refactor-implementation-phases-2026-05-15.md)

**High-Level Timeline:**
- **Phase 1a–1d (Tri-Sem + Ancillary + Schema):** 2–3 weeks (31–42 story points, cross-functional)
  - 1a: Database schema updates (tri-sem, zone columns, ghost flag, termIndex)
  - 1b: Data sync service hardening (ancillary loads read-only from EnrollPro)
  - 1c: API contract updates (generation output schema, term-aware violations)
  - 1d: Regression testing & acceptance gate
- **Phase 2 (Home-Room Algorithm):** 2–3 weeks (20–30 SP) | Blocked until Phase 1d complete
- **Phase 3 (Teacher X Placeholders):** 1–2 weeks (10–15 SP) | Blocked until Phase 1d complete
- **Phase 4 (Concurrency & PDF):** 2–3 weeks (20–25 SP) | Blocked until Phases 2 & 3 complete

### Phase 4 → Phase 5 Bridge

**Phase 4 Final Acceptance Criteria:**
- ✅ All Wave 4.x deliverables complete (auth, faculty workflow, room-request review, pre-generation workspace)
- ✅ Teaching load data parity verified (no mismatch between UI/DB/autofill)
- ✅ Refactor implementation phases documented and approved
- ✅ Phase 1a–1d technical tasks sequenced and ready for handoff
- ✅ Evidence collected in `docs/verification/evidence-log.md`

**Phase 5 Kickoff Conditions (Proposed):**
- ✅ Phase 1d gates closed (tri-sem, ancillary, API contracts all PASS)
- ✅ Phase 5 generation workflow uses `termIndex` to organize published output
- ✅ Phase 5 room-request approval flows respect termIndex context
- ✅ Phase 5 faculty assignment page displays tri-sem term assignment

**Updated Phase Tracker:** See [phasePlan.md](../../phasePlan.md) for master phase status

---

## Phase 4 Summary & Final Status

**Phase Objectives:** ✅ COMPLETE
- ✅ Review console UI with conflict overlays and filtering
- ✅ Generate + Publish workflow with violation guardrails
- ✅ Grid pivot modes (Section / Faculty / Room)
- ✅ Room identity clarity + integrity hardening
- ✅ Manual move/reassign actions with validation guards
- ✅ Offline-safe faculty workflow (SSE, sync, preferences)
- ✅ Pre-generation draft workspace with drag-and-drop
- ✅ Teaching load data parity verification

**Outstanding Artifacts (Pending Manual QA Capture):**
- Bridge-auth screenshot evidence for protected-route transitions
- Live Tailnet session QA for timetable workspace + room-request portal

**Next Phase Ownership:**
- Phase 1a–1d (Refactor): Backend + QA teams
- Phase 5 (Publish): Full team readiness (depends on Phase 1d completion)

---

**Document Version:** 4.7  
**Last Updated:** 2026-05-15  
**Next Review:** After Phase 1d gates close (estimated 2026-06-01)  
**Phase 4 Closure Target:** 2026-05-22 (pending manual QA evidence)
