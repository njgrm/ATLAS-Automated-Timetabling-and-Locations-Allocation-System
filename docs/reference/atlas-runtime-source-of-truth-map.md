# ATLAS Runtime Source-of-Truth Map

Last updated: 2026-08-26
Primary phase context: Phase 3 generator readiness

## Purpose
This is the living runtime map for ATLAS.

Use it to answer:
- what each current ATLAS page depends on
- which system owns each data domain
- when ATLAS persists data versus derives or synthesizes it
- which pages are healthy versus which pages can look healthy while generation is still NO-GO

This file should be updated whenever any of these change:
- page routes or page purpose
- API dependencies
- EnrollPro ownership boundaries
- persistence versus fallback behavior
- generator-readiness assumptions that affect live QA

Primary stakeholder output references now include:
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`

## Maintenance Rules
- `phasePlan.md` remains the canonical phase-status ledger.
- `docs/verification/evidence-log.md` remains the canonical proof log.
- This file is the operational map that connects pages, data owners, and runtime caveats.
- If a runtime-sensitive change lands without updating this map, the documentation is incomplete.

## Current Live Snapshot
Snapshot basis:
- Tailnet QA target: `https://njgrm.buru-degree.ts.net`
- Direct DB probe via local Prisma runtime against the active ATLAS database
- Date: 2026-05-27

Active-year rollover update (`2026-08-06`):
- EnrollPro is the active school-year authority for ATLAS rollover decisions.
- ATLAS now persists EnrollPro school-year mirror metadata in `enrollpro_school_year_mirrors`.
- `/api/v1/runtime/context` exposes `activeYearDrift` with `aligned`, `atlas-stale`, `enrollpro-unreachable`, or `mapping-conflict`.
- `/api/v1/runtime/rollover-status`, `/api/v1/runtime/rollover-sync/preview`, `/api/v1/runtime/rollover-sync/apply`, and `/api/v1/runtime/rollover-sync/reset-dummy-year` are the runtime rollover endpoints.
- Generation now blocks with `ACTIVE_YEAR_DRIFT` when EnrollPro is reachable and the requested generation year is not the EnrollPro active year.
- Dummy reset proof on `2026-08-06`: local conflicting `schoolYearId=1` dummy artifacts were reset through explicit confirmation, EnrollPro `1 / 2026-2027` was synced as canonical, and runtime drift now reports `aligned`.
- Current new-year mirror proof on `2026-08-06`: `20` EnrollPro sections, `24` active faculty, `setup-review-required` mirror status, `0` generation runs, and `0` Teaching Load ownership rows.
- Follow-up Tailnet sanity check on `2026-08-07`: EnrollPro now reports active `3 / 2026-2027`, while ATLAS still has selected/mirrored `schoolYearId=1`; runtime drift correctly reports `atlas-stale`, rollover status recommends `RUN_ROLLOVER_SYNC`, and live counts are `20` sections and `23` faculty. Treat EnrollPro active-year IDs and counts as runtime data, not constants.
- Tailnet dummy reset closure on `2026-08-08`: the live reset failure was caused by the client sending `confirmationText='CONFIRMED'` while the server requires the explicit dummy reset confirmation phrase. A preview-only probe confirmed the reset was safe for dummy data (`canResetDummyYear=true`, `publishedResetBlocked=false`, `20` section mirrors and `530` Teaching Load ownership rows targeted). The confirmed reset/apply was executed against `https://njgrm.buru-degree.ts.net`, after which runtime context reported `activeSchoolYearId=3`, `activeSchoolYearLabel=2026-2027`, `source=enrollpro-verified`, and drift `aligned`. Rollover status reported EnrollPro mirror counts of `20` sections and `23` faculty.
- Teaching Load is not auto-copied or auto-seeded into a new active year; officers must review/build it before generation.
- Active-year generation now also blocks with `TEACHING_LOAD_REVIEW_REQUIRED` while the canonical Teaching Load is empty.
- Follow-up new-year readiness proof on `2026-08-06`: Dashboard and Campus readiness widgets no longer request `/runs/latest/timetable` before latest-run metadata confirms a current-year run exists; they now show a no-current-timetable empty state instead. Tailnet Playwright verification passed on desktop, mobile portrait, and mobile landscape.
- Rollover contract note: `docs/reference/enrollpro-rollover-contract-2026-2027.md`.

Current persisted state:
- Subjects: `42` total, `28` active
- Faculty mirrors: `145` active/non-stale
- Placeholder faculty: `0`
- Active section mirrors for SY `55`: `82`
- Program mix in section mirrors: `58 REGULAR`, `8 STE`, `8 SPA`, `8 SPS`
- Scheduling policies for `(schoolId=1, schoolYearId=55)`: `1` persisted row
- Scheduling policy day-shape controls are now persisted in the local code path as `periodLengthMinutes` and `periodsPerDay`; the live Tailnet policy endpoint still needs a redeploy/restart to surface them in the response payload.
- Grade/program shift windows for `(1,55)`: `16`
- Active instructional cohorts: `10`
- Active dynamic `TLE_SPEC_*` subjects: `0`
- Shared-facility rooms: `25`
- Building grade scope: `gradeScope Int[]` field on `Building` model (added 2026-08-26); `[]` = any grade, `[7]` = Grade 7 only, etc.
- Home-room auto-assign: `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` endpoint (added 2026-08-26); supports preview/apply modes, respects building grade scope, preserves existing assignments by default.
- Sections page: auto-assign button visible when sections need rooms; dialog shows preview, allows overwrite/cross-grade options, applies after operator confirmation.

Current generator snapshot:
 Latest completed run summary now shows `runId=94`, `assignedCount=2704`, `unassignedCount=150`, `hardViolationCount=630`
 `homeRoomSuccessRate=82.95`
 `policyBlockedCount=85`
 `cohortCount=10`
 `termCounts={ term1: 2352, term2: 176, term3: 176 }`
 `timetableDisplaySlots=9` from the canonical primary display contract, not the mixed union of every program shape
 Dominant live blockers in run `94`:
  - `UNASSIGNED_SECTION=150`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=125`
  - `FACULTY_EXCESSIVE_IDLE_GAP=94`
  - `ROOM_TYPE_MISMATCH=73`
  - `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS=2`
  - `FACULTY_SUBJECT_NOT_QUALIFIED=1`
- Generator readiness is still `NO-GO` even though major setup/control pages now have persisted backing.
  - Breakout verification run (`runId=80`, local runtime `2026-05-27`) confirms cohortized dissemination is active:
    - `cohortCount=10`
    - `cohortizedClassCount=4`
    - SPA/SPS lane cohorts are sourced from persisted specialization ownership and used as teacher-concurrency demand inputs.

Latest root-cause remediation verification (`2026-05-27`, Tailnet runtime, baseline `runId=101` vs post-fix `runId=108`):
- KPI deltas:
  - `assignedCount`: `3310 -> 3425` (`+115`)
  - `unassignedCount`: `180 -> 30` (`-150`)
  - `hardViolationCount`: `180 -> 30` (`-150`)
  - `durationMs` (run `108`): `26603`
- Root-cause lane shift (unassigned taxonomy truth):
  - Baseline run `101`: `roomAssignmentReason=FALLBACK_UNRESOLVED (180)` + `homeRoomFallbackCause=HOME_ROOM_OCCUPIED (180)`.
  - Post-fix run `108`: `roomAssignmentReason=FACULTY_SLOT_UNAVAILABLE (30)` + `homeRoomFallbackCause=POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE (30)`.
  - Trapped home-room fallback dead-end bucket (`FALLBACK_UNRESOLVED + HOME_ROOM_OCCUPIED`) dropped from `180` to `0`.
- Runtime diagnostics now confirm bounded cross-building recovery is active:
  - `roomAssignmentReasonCounts.CROSS_BUILDING_FALLBACK_ASSIGNED=90`
  - `homeRoomFallbackDiagnostics.crossBuildingStandardRoomExhausted=0`
- Readiness note: room-locality dead-ends are no longer the dominant blocker for this slice; remaining pressure is policy/slot/faculty feasibility and still keeps overall phase closure at `NO-GO`.

Residual-closure verification (`2026-05-28`, Tailnet runtime):
- Intermediate policy-relaxed run (`runId=113`) reduced the residual lane to one section-subject pair:
  - `assigned=3450`, `unassigned=5`, `hard=5`, `policyBlocked=0`
  - residual target: `sectionId=2978`, `subjectId=7 (ESP)`
- Ownership rebalance sweep identified a winning ESP reassignment for that residual pair:
  - moved `sectionId=2978`, `subjectId=7` ownership to faculty `18196`
- Final closure run (`runId=121`):
  - `assigned=3455`, `unassigned=0`, `hardViolationCount=0`, `policyBlockedCount=0`
  - no residual unassigned sections remain in the active `(schoolId=1, schoolYearId=55)` verification surface
- Active control state used for closure rerun:
  - `maxTeachingMinutesPerDay=600`
  - `maxConsecutiveTeachingMinutesBeforeBreak=600`
  - `minBreakMinutesAfterConsecutiveBlock=5`
  - `allowFlexibleSubjectAssignment=false`

Wellbeing semantics alignment + realistic-policy closure (`2026-05-28`, Tailnet runtime):
- Baseline latest run before this pass: `runId=124`
  - `assigned=3425`, `unassigned=30`, `hardViolationCount=30`, `policyBlockedCount=30`
- After constructor/validator hard-vs-soft semantics alignment, realistic-policy rerun `runId=125`:
  - policy pinned at `maxTeachingMinutesPerDay=480`, `maxConsecutiveTeachingMinutesBeforeBreak=120`, `minBreakMinutesAfterConsecutiveBlock=15`, `allowFlexibleSubjectAssignment=false`
  - `assigned=3450`, `unassigned=5`, `hardViolationCount=5`, `policyBlockedCount=0`
  - residual narrowed to one lane: `sectionId=2978`, `subjectId=7 (ESP)` with `roomAssignmentReason=FACULTY_SLOT_UNAVAILABLE`
- Final realistic-policy closure rerun `runId=126` after targeted ESP ownership rebalance (`2978:7`, faculty `18191 -> 18196`):
  - `assigned=3455`, `unassigned=0`, `hardViolationCount=0`, `policyBlockedCount=0`
- Runtime interpretation:
  - Remaining post-fix blockers were true slot/coverage feasibility (not policy-hardness leakage), and were resolved without returning to `600/600/5` policy inflation.

Latest fresh run check (`2026-05-27`, Tailnet runtime):
- Active latest completed run: `runId=84`.
- Verified live output:
  - `/generation/1/55/runs/latest/draft` -> `summary.assignedCount=2289`, `summary.unassignedCount=565`, `summary.hardViolationCount=838`, `summary.homeRoomSuccessRate=58.62`, `summary.policyBlockedCount=257`.
  - `summary.timetableDisplaySlots.length=9` and the slots now come from one canonical display contract instead of the mixed program-shape union.
  - `summary.cohortCount=10`.
  - `summary` no longer exposes `cohortizedClassCount`.
  - The draft still carries `contractWarnings`, but the timetable header no longer surfaces the stale cohort/TLE warning banner.
- Map inventory and run output truth:
  - `/map/schools/1/buildings` still includes `G9` rooms.
  - Run `84` places `0` entries in the `G9` building, so the map truth and timetable placement truth are distinct.
- Conclusion: the timetable contract cleanup is live, but the generator remains `NO-GO` because hard violations are still high.

Latest run-baseline truth check (`2026-05-27`, Tailnet runtime):
- Active latest completed run: `runId=81`.
- Verified contract consistency:
  - `/generation/1/55/runs/latest/draft` -> `summary.assignedCount=2095`, `summary.unassignedCount=759`, draft `entries.length=2095`, `unassignedItems.length=759`.
  - `/generation/1/55/runs/latest/violations` -> hard count `0`, soft count `1112`, and computed code-count totals exactly match `summary.violationCounts`.
- Conclusion: no latest-run summary contradiction was found for run `81`; reporting contract repair was not required in this pass.

Timetable swap interaction verification (`2026-05-27`, Tailnet runtime):
- Occupied-slot drag in generated-run mode now consistently opens the regular swap confirmation modal (`Confirm Occupied-Slot Swap`) instead of falling through to direct move/commit behavior.
- Pre-generation queue-to-occupied placement now opens the pre-generation swap review modal (`Review Placement Swap`) for both drag and keyboard-source placement flows.
- Pre-generation occupied-slot routing now resolves non-`draft-placement-*` entry identities through placement lookup before swap evaluation, preventing stale-ID routing misses.
- Multi-occupant ambiguity guard is now explicit in routing logic and test-covered; no silent overlap fallback was observed in live occupied-slot interactions.

Phase 3 G9 placement + room-mismatch follow-up (`2026-05-27`, Tailnet runs `93-94`):
- Implemented runtime contract repairs now visible in live runs:
  - `HG` is no longer emitted in timetable artifacts (`hgAssigned=0`, `hgUnassigned=0`).
  - Lower-grade cross-building spill into `G10` was removed (`lowerToG10=0` on runs `89` and `90`).
  - `ROOM_TYPE_MISMATCH` for modular fallback is now diagnostic-soft (`SOFT|MODULAR_POOL_ASSIGNED|deferred=true`, no hard room-type mismatch bucket for this path).
  - Subject/manual cleanup intent now persists through sync + generation (`STE_ROBOTICS` stayed inactive across `/subjects/sync-offerings` and rerun generation).
  - Regular Grade 9 zero-placement starvation is cleared on the latest run (`runId=94`, `regularG9Sections=12`, `regularG9Entries=480`, `regularG9Unassigned=0`).
- Remaining active blocker:
  - SPA/SPS residual slot pressure remains in latest live rerun (`runId=94`, `SPA:NO_AVAILABLE_SLOT=70`, `SPS:NO_AVAILABLE_SLOT=70`).
  - Generator readiness remains NO-GO until this residual special-program blockage and overall hard-violation budget are reduced to gate thresholds.

Implementation note (`2026-05-27`, local code-path update; Tailnet rerun still pending):
- `HOME_ROOM_FIRST` section scheduling now defers specialized-room fit for section-facing master schedules.
- Runtime contract intent:
  - ordinary section entries stay on home-room / normal-classroom placement first
  - specialized room-type and feature mismatches become soft diagnostics when they are intentionally deferred by the homeroom-first master-schedule path
  - same-room collisions and explicit shared-facility collisions remain hard-protected
- This is a product alignment change for stakeholder class-program replication, not proof that the live generator metrics have already improved; a fresh Tailnet run is still required.

Implementation note (`2026-05-27`, local code-path update; Tailnet rerun timed out):
- Demand normalization now preserves authoritative weekly subject minutes (`sourceMinutesPerWeek`) so session-count normalization uses real required minutes instead of reconstructed `sessions x duration` artifacts.
- Constructor qualification candidate expansion is now Teaching-Load-authority-first for this phase: tiered department fallback is no longer used unless `allowFlexibleSubjectAssignment` is explicitly enabled.
- Generation now injects persisted policy day-shape fields (`periodLengthMinutes`, `periodsPerDay`) into constructor policy input so active block math follows the scheduling-policy contract directly.
- Timetable right-rail and header copy now frame manual placement as residual recovery tooling, not normal schedule completion flow.
- Live baseline before this pass remained unchanged in Tailnet (`FACULTY_SUBJECT_NOT_QUALIFIED=3`, mixed `225`-minute session distributions including many `6`-session rows); a post-change fresh Tailnet rerun was attempted but aborted by request timeouts, so closure evidence remains pending.

Timetable room/building parity check (`2026-05-27`):
- Map source remains authoritative for building inventory: `/map/schools/1/buildings` includes `G9`.
- Run `81` schedule entries include `0` classes in `G9`, so entry-only room pivoting can hide `G9` in room-mode selector paths even when the map is correct.
- `/timetable` room pivot contract now includes all teaching-space rooms from reference map data (`useTimetableData`), preventing building-group disappearance caused by zero-entry latest-run slices.

Homeroom-first master-schedule contraction (`2026-05-27`, second re-entry pass):
- Constructor contract update: in `HOME_ROOM_FIRST`, all section-level specialized room preferences now defer to classroom-first master-schedule placement (including sections missing `homeRoomId`), while preserving deferred specialized-room diagnostics in metadata.
- Downgraded assumptions from hard placement truth to diagnostics for section master schedules:
  - specialist room-type preference (`ROOM_TYPE_MISMATCH`) when deferred
  - specialist room-feature preference (`ROOM_FEATURE_MISMATCH`) when deferred
  - specialist-room unavailability as a non-blocking diagnostic path for section output
- Hard constraints intentionally retained:
  - `ROOM_TIME_CONFLICT` remains hard (real room double-booking)
  - shared/singleton facility double-booking remains hard through room occupancy conflict checks
- No topology reseed was applied in this pass; section placement integrity remained coherent after rerun:
  - `missingHomeRoom = 0`
  - `missingBuildingZone = 0`
  - `/sections/home-rooms/:schoolYearId` still resolves coherent room options (`157`)
- Latest completed run comparison (`run 81 -> run 82`):
  - `assignedCount`: `2095 -> 2286`
  - `unassignedCount`: `759 -> 568`
  - `hardViolationCount`: `0 -> 844` (still not phase-closure-ready)
  - `SPECIALIZED_ROOM_UNAVAILABLE`: `0 -> 0`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`: `788 -> 764`
  - `FACULTY_EXCESSIVE_IDLE_GAP`: `324 -> 304`
  - `homeRoomSuccessRate` now reported at `58.57` on run `82`

Published-run integrity snapshot (`2026-05-26`):
- Legacy contradictory rows (`status=FAILED` with publish markers) were reconciled by clearing publish markers.
- Dissemination truth now aligns across DB and APIs: no valid published run currently exists for school `1`.
- Runtime contract guardrail: public/faculty published payload resolution now performs integrity reconciliation on non-completed runs before selecting a published candidate.
- Publish contract guardrail: `POST /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/publish` rejects hard-violation runs (`PUBLISH_BLOCKED_HARD_VIOLATIONS`) and requires `acknowledgeSoftViolations=true` when soft warnings exist (`PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS`).

Published revision foundation, date-aware reads, and UI creation (`2026-05-31`, Prompts 6a-6c):
- ATLAS persists published-schedule revision records in `PublishedScheduleRevision` for future mid-semester repairs, scoped by school, school year, source published run, optional source revision, effective date, actor, reason, changed entries, previous values, new values, and audit metadata.
- Protected revision endpoints exist under `/api/v1/generation/:schoolId/:schoolYearId/runs/:runId/published-revisions` for creation/listing by scheduling officers/admins.
- Public published schedule reads now resolve revision-effective truth by date. All published full/section/faculty/room endpoints accept optional `date=YYYY-MM-DD` or `asOfDate=...`; no query parameter resolves current active truth. Historical dates before a revision return the original published run, while dates on/after an effective revision overlay that revision without mutating source `GenerationRun` rows.
- Published schedule response `source` now includes `requestedDate`, `resolvedForDate`, `activeRevisionId`, `activeRevisionEffectiveDate`, `appliedRevisionIds`, and `revisionMarker` so downstream clients and offline caches can distinguish base published truth from revision-effective truth.
- The `/timetable` Tactical Teaching Load Dock now uses this contract for published runs: staged teacher changes open an effective-date revision dialog and create `PublishedScheduleRevision` records with `CHANGE_FACULTY` before/after snapshots instead of calling draft manual-edit commit endpoints or mutating the source published run.
- Targeted slice reads for published schedules (`getPublishedSectionSchedule`, `getPublishedFacultySchedule`, `getPublishedRoomSchedule`) now use query push-down and lightweight candidate selection to prevent massive memory mapping when retrieving a single filtered schedule slice (`2026-06-02`, Prompt 9a).

Quick Place solver & manual edit persistence alignment (`2026-07-08`, Prompt 10A):
- The Quick Place solver (greedy unassigned session allocator) sources subject names directly from `subject.name` rather than grade-level strings.
- Room allocation reason metadata (`roomAssignmentReason` as `HOME_ROOM_ASSIGNED`, `PREFERRED_ROOM_TYPE_ASSIGNED`, or `FALLBACK_ROOM_ASSIGNED`) and `deferredRoomTypePreference: true` (for soft-warning room type fallbacks) are dynamically resolved and persisted to the database.
- Quick Place saves are committed atomically through `commitManualEditBatch` under a single version-guarded database transaction, avoiding out-of-transaction summary updates.
- Manual overrides that place classes in mismatched room types are post-processed in `commitManualEditBatch` to automatically attach `deferredRoomTypePreference: true`, allowing validation to treat them as soft warnings.

Dynamic unassigned Teaching Load repair closure (`2026-07-11`, Prompt 10B follow-up):
- Unpublished timetable Teaching Load repair remains a single transaction over canonical `SubjectSectionOwnership`, derived `FacultySubject.sectionIds`, affected `FacultyMirror.version` values, generated-run entries/unassigned items, validation results, summary, manual-edit history, and audit history.
- The run `inputSnapshot` is computed from transaction-visible post-repair canonical ownership and persisted with the same version-guarded run update; it must not be computed from pre-repair ownership.
- Optional placement is bound to exactly one normalized unassigned identity: subject, section, session, target teacher, entry kind, unassigned key, and cohort marker where applicable. A scope mismatch performs no write.
- Placement suggestions compare candidate hard violations with the projected baseline. Existing unrelated violations remain visible but do not erase a conflict-free suggestion for the selected session.
- Run and affected-faculty optimistic versions are rechecked inside the write transaction before canonical ownership changes.

Timetable workflow recovery source boundaries (`2026-07-18`, Phase 0-2 UX recovery):
- Generated-run review remains sourced from the latest selected `GenerationRun` draft/violations payloads; generated unassigned placement and occupied-slot swap now open visible review flows before any write.
- Pre-generation draft board navigation reads use `GET /api/v1/generation/:schoolId/:schoolYearId/pre-generation-drafts?preferCachedSections=true`, which prefers the latest saved EnrollPro section snapshot to avoid blocking navigation on a slow upstream section fetch.
- Pre-generation placement preview and commit still load the full draft context and run validation; the cached-section fast path is only for board/list hydration and not a correctness shortcut for writes.
- The `/timetable` `Plan before generating` action switches the user into the draft workspace immediately, then hydrates the full queue asynchronously. Live proof on `2026-07-18` returned `queue=1313` in `987ms` for `(schoolId=1, schoolYearId=55)`.
- Touch/mobile pre-generation queue cards are normal project buttons rather than disabled draggable wrappers; desktop keeps draggable queue cards.
- Development clients do not register the production PWA service worker, preventing cache-first script handling from interfering with Vite module updates; production service-worker behavior is unchanged.
- Phase 3 adds a compact task guide for `Review schedule`, `Place unassigned`, `Switch sessions`, `Draft planner`, and `Review room requests`. These controls only switch visible workflow modes or open existing flows; they do not change generation truth, placement preview/commit validation, or room-request ownership.
- Task-mode controls expand the left rail before switching to `violations`, `unassigned`, or `requests`, preventing collapsed-rail states from hiding the requested workflow.
- On short-height mobile landscape viewports, redundant helper copy and the left-rail title strip compress/hide while preserving tab labels, counts, task controls, and local rail scrolling.


Dashboard readiness summary endpoint (`2026-06-01`, Prompt 9b):
- The admin dashboard now takes its first setup/readiness snapshot from `/api/v1/dashboard/readiness-summary?schoolId=:schoolId` instead of independently starting the map, campus image, subject stats, faculty, runtime, section summary, latest run, and latest-violations waterfall. `/api/v1/dashboard/summary` remains a compatibility alias for the same service-layer contract.
- The summary endpoint is protected for scheduler/admin roles and aggregates persisted ATLAS data in the service layer: runtime context, campus buildings/rooms, subject coverage counts, faculty mirror count, section mirror count, latest generation status, violation total, and source-state metadata.
- The dashboard still lets the campus preview card load richer room/timetable overlay details after the first snapshot, so the summary endpoint is the first meaningful readiness source, not a replacement for room drilldown data.
- Source honesty states now include `verified_live`, `checking_source`, `using_saved_data`, `no_saved_data`, and `partial_degraded`; the UI renders the matching compact badge before the phase badge.

Audit repair console and dashboard drilldowns (`2026-06-01`, Prompt 8):
- `/audit` now frames each readiness group as a repair action group with `what is blocked`, `why it matters`, a primary fix action, and optional inspect action. Finding-level links carry known subject, teacher, section, room, or timetable query context where available.
- `/` dashboard stat cards now drill into the same setup/fix surfaces used by Audit (`/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/audit`, `/timetable`) and explain why each item can block generation or publish.
- `/timetable` generated-run left rail is split so generated violations and generated unassigned sessions live in `GeneratedRunRailPanels.tsx`, while the parent `LeftRailContent.tsx` remains under the 1000-line React cap. Generated unassigned sessions now render through `VirtualizedRailList.tsx`, which keeps only the visible rail window mounted while preserving the existing ATLAS generation-run data contract.
- The dashboard exposes `Check for updates`, which reruns the readiness-summary load/fallback contract without introducing a new backend endpoint.
- `/teaching-load` accepts `?sectionId=` alongside existing `?facultyId=` and `?subjectId=` focus parameters so Audit can open the Section Allocation context for known section-subject blockers.

Timetable KISS UX critique repair and PWA cache note (`2026-06-11`):
- `/timetable` keeps the KISS header contract as run selector, visible `Refresh schedule`, eligible publish, and a single More menu. Secondary navigation/actions are not mounted as hidden duplicate toolbar controls.
- Generated-run violation rail rows are presentation-scrubbed: leading internal entry IDs are removed, subject/section/room/faculty numeric references are mapped to readable labels where the client has reference data, and remaining numeric references fall back to plain `this subject` / `this section` / `this room` / `this teacher` copy.
- Timetable grid entries expose stable accessible selection labels and `data-timetable-entry` hooks so mouse and keyboard selection open the Teaching Load / published-revision dock from the visible class block.
- PWA service worker version is now `atlas-v1.0.2`; cached runtime/faculty API reads use a `10000ms` network-first timeout to avoid false Tailnet failures before falling back to saved API data.

## Page Inventory

| Route | Page | Main Purpose | Primary APIs / Data | Source of Truth | Current Notes |
|---|---|---|---|---|---|
| `/login` | Login | Direct ATLAS authentication | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | ATLAS auth tables plus bridge token verification | Uses local-token session validation with cached identity fallback on transient network failures and cached shell-branding identity (no EnrollPro-first bootstrap requirement). EnrollPro delegated staff accounts may omit email; ATLAS stores a deterministic internal fallback email from the employee/account identifier while preserving EnrollPro employee ID/account name as the login truth. |
| `/` | Dashboard | Setup snapshot, campus map view, room overlay health | `/dashboard/readiness-summary?schoolId=:schoolId` for the first readiness snapshot; campus preview still uses detail endpoints such as `/subjects`, `/faculty`, `/sections/summary/:schoolYearId`, `/generation/:schoolId/:schoolYearId/runs/latest/timetable`, and `/room-schedules/.../rooms/:id` for room overlay drilldown | Mixed ATLAS service aggregation over runtime context, map inventory, subject/faculty/section mirrors, and latest generation run; EnrollPro is used only for runtime verification/branding refresh, not as the first dashboard render dependency | Dashboard can look healthy while generation still fails; it is not a phase-closure signal. The route now surfaces a compact source badge (`Verified live`, `Checking source`, `Using saved data`, `No saved data`, or `Partial data`) and falls back to the older client-side reads only if the summary endpoint is unavailable. |
| `/subjects` | Subjects | Subject catalog management, ownership inspection, and subject coverage drilldown | `/subjects/sync-offerings`, `/subjects`, `/subjects/:id`, `/subjects/:id/archive`, `/subjects/:id/reactivate`, `/faculty-assignments/summary` | ATLAS `Subject` is authoritative; department ownership is the active qualification baseline and manual Teaching Load placement remains authoritative | Page load is read-only (no passive seed mutation). Subject activation/materialization refresh is operator-triggered through explicit sync. Delete blockers now distinguish active assignments vs historical rows and expose archive/cleanup paths. Global teaching-load reset controls were moved out of this page to `/teaching-load` (legacy `/assignments` redirect retained); this page keeps subject-scoped remediation only. |
| `/teachers` | Teachers | Faculty mirror roster health, sync status, and scheduling-load readiness | `/runtime/context`, `/faculty`, `/faculty/sync`, `/faculty-assignments/summary` with optional `page`, `pageSize`, `query`, `scheduling`, `assignment`, `department`, `sortField`, and `sortDir` | EnrollPro is upstream owner; ATLAS `FacultyMirror` is the persisted scheduling cache and ATLAS runtime context resolves school-year bootstrap | Page now uses ATLAS-owned runtime-context resolution plus cached assignment-summary snapshot for degraded read continuity, then uses server-shaped pagination/search for live list reads. The summary endpoint preserves the legacy full `faculty` response when list params are omitted; list reads additionally return `items`, `page`, `pageSize`, `total`, `totalPages`, `query`, `departments`, and full-roster `rosterStats`. The UI presents normalized source-state labels (`Verified live`, `Checking source`, `Using saved data`, `No saved data`) and roster-health stats for active teachers, teachers with/without load, approval-review teachers above the 30h credited-workload standard but still within cap, over-cap teachers needing repair, and last sync. Teacher rows expose readable credited-workload states (`At standard`, `Above standard - approval needed`, `Over cap - must fix`, `Below standard`, `No teaching load`, `Excluded`) plus a visible `Review teaching load` action that deep-links to Teaching Load with `facultyId`. Legacy `/faculty` route remains a compatibility redirect. |
| `/teaching-load` | Teaching Load | Subject-grade-section assignment management and state-clear load review | `/runtime/context`, `/faculty-assignments/summary`, `/subjects`, `/sections/summary/:schoolYearId`, `/sections/assigned-classes`, `/faculty-assignments/reset`, assignment repair/autofill endpoints, `/faculty-assignments/report/staffing-needs`, `/faculty-assignments/coverage/rebalance-special-programs`, `/faculty-assignments/coverage/recover-real-faculty`, `/faculty-assignments/integrity/reconcile-stale-ownership`, `/faculty-assignments/capability-overrides` | ATLAS `FacultySubject`, `SubjectSectionOwnership`, assignment services, and ATLAS runtime context for school-year bootstrap | Page now caches summary/subjects/section bootstrap payloads and can reopen from last-good snapshot when live fetch fails. Cached warm-load now enters transient `refreshing` verification and keeps write actions gated until live/runtime year validation settles. In cached degraded mode, safe ATLAS-owned writes are now enabled when runtime evidence is sufficient (active school-year context + section-first assigned-classes evidence or section summary + subjects + faculty summary), while destructive/reset operations remain live-mode only. If no cached bootstrap exists during failure, the page remains in explicit network-error/no-data state with mutation controls disabled. The top workflow band now states the workspace state (`Verified live`, `Checking source`, `Using saved data`, `Read-only saved data`, `Offline saved data`, or `No assignment data`), why write actions are enabled or blocked, and the next operator action. Teaching Load now treats credited workload as active teaching hours plus advisory/ancillary credits: exactly `30h` is `At standard`, `>30h` through `40h` is `Above standard - approval needed`, and `>40h` is `Over cap - must fix`; stacked workload bars visually separate teaching time from non-teaching credits while marking the 30h standard and 40h cap. Coverage totals now explain 0 / 0 as loading, no active school year, no assignment universe, or unavailable data instead of presenting zeroes without context. `By teacher`, `Section allocation`, `Staffing audit`, and `Preview auto-fill` are framed as task modes/actions with helper text while preserving existing staffing math and persistence contracts. Subject-focused deep links (`?subjectId=`) remain supported, and global teaching-load reset stays preview-first with typed confirmation. Summary payload now exposes `coverageTotals` + `integrityDiagnostics` and rotation-family load detail fields (`sectionTeachingHoursRaw`, `rotationFamilyOvercountHours`, `rotationFamilyLoadDetails`) for inspectable operator truth. Section Allocation now consumes the exact section-first contract from `/sections/assigned-classes` rather than rebuilding section demand from broad subject applicability, and save-all draft persistence now spans every mutated faculty row instead of only the currently selected teacher. Coverage totals now distinguish active-scheduling truth from diagnostic raw ownership (`assignedPairs`/`unassignedPairs` vs `rawAssignedPairs`/`rawUnassignedPairs`) to prevent headline drift against coverage and staffing endpoints. Headline coverage still separates real staffed pairs from synthetic placeholder coverage (`realFacultyAssignedPairs`, `syntheticPlaceholderPairs`) so placeholder closure cannot masquerade as normal staffing success. Synthetic rows are quarantined behind an explicit toggle and grouped separately from normal teacher workflow. Special-program umbrella subjects remain schedulable as `SPA_SPEC` / `SPS_SPEC`, while section-scoped taught identity now persists on `SubjectSectionOwnership.specializationCode` / `specializationLabel` instead of fragmenting the subject catalog. Special-program redistribution preview now also returns operator diagnostics (`redistributionInsights`) for concentration risk, specialization-constrained sections, underutilized MAPEH candidate signals, and approved capability-override-aware candidate support; live redistribution can now move SPA/SPS rows onto baseline MAPEH generalists while preserving the section's specialization metadata instead of rewriting breakout truth to the destination teacher profile. Auto-fill persistence now uses conflict-safe insert semantics (`createMany + skipDuplicates`) so duplicate ownership collisions do not poison the transaction. Integrity diagnostics now include explicit stale ownership buckets (`staleOwnershipRowCount`, `staleOwnedCurrentYearPairCount`, placeholder/non-placeholder split, and sample rows) and reconcile this debt through preview/apply endpoint `POST /api/v1/faculty-assignments/integrity/reconcile-stale-ownership`. Split-brain reconcile now clears out-of-subject ownership rows from both `FacultySubject.sectionIds` and `SubjectSectionOwnership`, and post-apply pending counters are computed from final runtime summary state (not pre-apply previews). Quarantine counters now separate extreme load outliers (`trueLoadOutlierRows`) from review-only overloads (`loadReviewRows`) and approval-linked load (`approvalLinkedLoadRows`) for operator-honest incident messaging. Incident banner is now severity-aware: big amber "Incident" banners are reserved for integrity blocks or active quarantine; clean-integrity states with only review-level warnings (like Year 55) now show a compact "Review Required" status instead. Rotational load presentation now handles tied peaks honestly (e.g. "Tied: Term 1, Term 3") instead of picking a single winner. Staffing-needs now exposes qualification-aware recoverability (`recoverableConcurrent*`, `constrainedConcurrent*`) and explicit section data provenance (`sectionSource`, `sectionFallbackReason`) so degraded-mode staffing reads are truthful during EnrollPro outages. Teaching-load control actions now use a shared local-first section-source contract to avoid EnrollPro timeout tax when ATLAS section evidence exists, and assignment read rows now expose per-section lane-impact fields (`assignmentRotationFamily`, `assignmentRotationLaneId`, `assignmentRawMinutesPerWeek`, `assignmentConcurrentDeltaMinutesPerWeek`, `assignmentExpandsConcurrentDemand`) for rotation-truthful manual placement UX. The targeted real-faculty recovery endpoint can now fill uncovered subject-section pairs in addition to transferring placeholder-owned rows. Legacy `/assignments` route remains a compatibility redirect. |
| `/sections` | Sections | Section mirror view, sync, home-room assignment, and section-first class ownership read model | `/runtime/context`, `/sections/summary/:schoolYearId`, `/sections/home-rooms/:schoolYearId`, `/sections/sync`, `/sections/special-program-placement/overlay`, `/sections/:sectionId/assigned-classes`, `/sections/assigned-classes` | EnrollPro owns section roster upstream; ATLAS `SectionMirror` is the persisted scheduling cache plus home-room/zone overlays, with ATLAS runtime context for school-year bootstrap and degraded reads | Section-first endpoints now return assigned classes directly per section without faculty inversion. Normal class rows exclude stale and synthetic placeholder ownership, while optional diagnostics (`includeDiagnostics=true`) expose `staleOwnership` and `unassignedExpectedClasses` separately for parity/audit workflows. Cached warm-load now enters transient verification and auto-promotes from cached/atlas-mirror style status to `live` in the same page load when both section-summary live source and runtime verification succeed. Home-room updates keep a local outbox in degraded mode and replay on reconnect when runtime evidence is sufficient, and edit controls remain blocked while runtime source is still verifying. |
| `/faculty/preferences` | Officer Preferences | Scheduler view of teacher support preferences | `/runtime/context`, `/preferences/:schoolId/:schoolYearId/...` | ATLAS preference records with ATLAS runtime-context bootstrap for school-year resolution | Weekly time preferences are no longer collected or scheduler-reviewed in the active flow. Scheduler review now focuses on teacher support needs/notes, which are manual review signals rather than automatic hard timetable blockers. |
| `/my/preferences` | Teacher Preferences | Teacher self-service support preferences | `/runtime/context`, `/faculty/me`, `/preferences/:schoolId/:schoolYearId/...` | ATLAS preferences scoped to canonical teacher identity with ATLAS runtime-context bootstrap | Bootstrap now runs ATLAS-context-only (`allowEnrollProFallback=false`) with cached identity fallback, last-good preference snapshot fallback, and explicit offline write lock (`Save Draft`/`Submit Final` disabled while offline). New draft/submission writes omit `PreferenceTimeSlot` rows unless `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES=true`. Stale preference ownership is resolved to the canonical assignment-bearing teacher identity where possible. Source-honesty banner is hidden when runtime is live (`source` in `enrollpro-verified` / `atlas-persisted` / `enrollpro` and `!stale`); the "Working from saved data" notice is reserved for genuine `cache`/`stale` reads. Preference SSE (`/preferences/.../events`) now resolves teacher identity through the canonical resolver so the stream stays open for teachers whose `facultyMirror.externalId` does not equal token `userId`. |
| `/faculty/room-preferences` | Scheduler Room Preferences | Scheduler view of teacher room requests and review workflow | `/runtime/context`, `/room-preferences/:schoolId/:schoolYearId/...` | ATLAS room-preference records and review state with ATLAS runtime-context bootstrap | Separate from base room map; used for appeals/review, not for canonical room inventory. Latest queue includes submitted/reviewed requests from superseded draft runs so pending teacher requests do not disappear when the active draft advances, and SSE alerts surface new teacher submissions. |
| `/my/room-preferences` | Teacher Room Requests | Teacher self-service room requests | `/runtime/context`, `/faculty/me`, `/room-preferences/.../latest/me`, `/faculty-portal/:schoolId/:schoolYearId/dashboard`, `/map/schools/:schoolId/buildings`, `/map/schools/:schoolId/campus-image`, `/room-preferences/:schoolId/:schoolYearId/events` | ATLAS room-preference records over ATLAS map inventory with ATLAS runtime-context bootstrap and assignment identity from the faculty-portal aggregation | Bootstrap now runs ATLAS-context-only (`allowEnrollProFallback=false`) with cached identity fallback and cached bootstrap snapshot fallback. Self-service bootstrap reads through `/room-preferences/:schoolId/:schoolYearId/latest/me`, which resolves canonical faculty identity server-side via `resolveCanonicalFacultyFromAuthPayload` and removes the `facultyMirrorId` URL coupling that previously produced spurious 403s. Existing outbox sync remains authoritative for offline queued room-request writes where safe. Room-request bootstrap snapshots are now stored under school-year/faculty plus active run, run version, generated-at, publish, and revision marker segments when those fields are available; a live refresh removes older same-prefix snapshots so a newer draft/publish context cannot be overwritten by a same-day stale saved view. SSE room-request events, including reviewed decisions and sync completion, reload the bootstrap state. Empty/error states distinguish no teaching load from assignment-bearing teachers whose classes are not yet plotted in the active review draft. Mobile starts at class selection unless a valid entry deep link is present, filters target slots by day/free/swap/all, and shows recent scheduler decisions from current and superseded drafts. Occupied-slot changes are framed as scheduler-reviewed swap requests, not immediate timetable edits. Source-honesty copy uses plain saved/offline language, and queued outbox state is persistently visible as `N requests waiting to send`. |
| `/timetable` | Schedule Review Workspace | Generation, policy/window controls, violations, repair workflows, rooming review | `/runtime/context`, `/generation/:schoolId/:schoolYearId/...`, `/policies/scheduling/:schoolId/:schoolYearId`, `/generation/:schoolId/:schoolYearId/grade-windows`, pre-generation draft endpoints, room-schedule overlays, manual-edit preview/commit endpoints, published-revision endpoints, `/generation/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/preview`, `/generation/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/apply` | Mixed runtime contract; this page is the main convergence point of all setup data, with runtime-context-first school-year bootstrap | This is the primary NO-GO page. Most persistent blockers show up here first. Current code-path intent for the next pass is homeroom-first section scheduling for stakeholder class-program replication, with specialized-room fit deferred to soft diagnostics unless a real explicit facility assignment is still used. Under simulated EnrollPro settings outage, the page still resolves and renders run controls from ATLAS runtime evidence. Occupied-slot swap routing is now verified in live Tailnet for generated-run drag and pre-generation drag/keyboard-source placement flows, with modal-first handling restored and no silent occupied-slot commit fallback observed in tested paths. Load-path hardening now reuses warm route-lifetime cache for runs/reference/draft payloads with background refresh and intentionally defers non-critical rail diagnostics (draft-board + room-request summary) until after the main workspace is interactive; draft-board context falls back to cached `SectionSnapshot` when EnrollPro sections are unreachable. Draft responses now include optional `inputState` based on `GenerationRun.summary.inputSnapshot` versus current Teaching Load, policy, room, section, and subject metadata; the page marks generated runs as fresh, stale, or unknown and shows preview/manual-repair/regenerate actions without mutating the snapshot or auto-regenerating. Historical run selection remains explicit and is not reset to latest by bootstrap refresh. The page now defaults to a compact `Schedule review` workflow: run selector, refresh, eligible publish, and one More menu for secondary tools; the left rail groups violations, unassigned entries, and requests under `Needs attention`. The Tactical Teaching Load Dock now shows when the visible timetable teacher and canonical Teaching Load owner differ, uses a three-step `Current teacher / Choose teacher / Preview and save` progression, and hides exact workload bars behind `Details`. For unpublished completed runs, `Save Teaching Load and update timetable` calls the privileged teaching-load repair apply endpoint, which updates `SubjectSectionOwnership`, `FacultySubject.sectionIds`, every generated `draftEntries` item in the selected subject/section scope, violations, summary, manual-edit records, audit log, and run version without creating a new generation run. For published runs, the same dock stays revision-only through `PublishedScheduleRevision`; canonical Teaching Load is not rewritten from a published repair and the primary action is `Create timetable revision`. |
| `/timetabling/how-it-works` | How It Works | Static/operator explainer | no critical runtime dependency | Static ATLAS content | Does not validate runtime readiness. |
| `/schedules`, `/room-schedules` | Schedules | User-facing schedule browser for room, teacher, and section review; `/room-schedules` remains a compatibility alias for direct room links | `/runtime/context`, `/map/schools/:schoolId/buildings`, `/subjects`, `/faculty`, `/sections/summary/:schoolYearId`, `/room-schedules/:schoolId/:schoolYearId/rooms/:roomId`, latest/run timetable endpoints for teacher and section pivots | Mixed: ATLAS runtime context + ATLAS map + ATLAS mirrors + latest generation output | Bootstrap is runtime-context-first with cached active-year fallback. The SMART browser now states the review purpose, separates Rooms/Teachers/Sections as task modes, explains Latest vs Run ID, validates Run ID inline, and avoids internal-ID fallback labels in room, teacher, section, subject, and faculty schedule cells. |
| `/map` | Campus and Rooms | Read-first campus readiness overview plus explicit map editor for building, room, floor, and campus image management | `/map/schools/:schoolId/buildings`, `/map/schools/:schoolId/campus-image`, building/room CRUD endpoints, latest timetable/section/faculty/subject reads for room schedule drilldown | ATLAS `Building` and `Room` are authoritative; latest generation output is read-only context for room schedule overlays | Shared-facility protection now depends on this page's room inventory being correct. `/map` defaults to the overview-led campus readiness view with selected-building room/floor/schedule indicators and room-click schedule overlay access. `/map?mode=editor` keeps the restored Konva editor model with Select, Draw, Rooms, Photo, History, and Save task grouping, visible save state, token-primary selected canvas state, and collapsed advanced placement controls. |
| `/audit` | Audit Readiness Report | Operator readiness report that turns teacher assignments, section coverage, rooms/facilities, teacher constraints, and saved/live data checks into action groups before scheduling review | `/faculty-assignments/summary`, `/subjects`, `/specialization-aliases`, `/preferences/.../audit`, `/sections/summary/:schoolYearId`, `/class-templates`, `/map/schools/:schoolId/buildings`, `/runtime/context` | Aggregated from multiple ATLAS persisted domains and latest ATLAS runtime evidence | Audit now presents a SMART-family report with the verdicts `Cannot check readiness yet`, `Ready for scheduling review`, or `Needs fixes before scheduling`; action groups route only to setup surfaces (`/teaching-load`, `/sections`, `/subjects`, `/teachers`, `/map`) and do not gateway operators into `/timetable/generate`. Partial/degraded reads still surface saved-evidence status, missing-data reasons, and source warnings instead of failing silently. |
| `/specialization-mapping` | Specialization Mapping | Legacy alias-management surface retained for compatibility only | not part of current operator navigation flow | Legacy ATLAS alias records only | Removed from normal scheduling workflow; qualification and assignment flows now run on department ownership baseline plus explicit Teaching Load assignments. |
| `/my` | My Dashboard | Faculty-facing personal dashboard | `/faculty-portal/:schoolId/:schoolYearId/dashboard` | ATLAS faculty-portal aggregation over auth, preferences, active draft schedule state, objective readiness state, and assignment identity summary | Bootstrap now runs ATLAS-context-only (`allowEnrollProFallback=false`) and persists last-good dashboard snapshots under school-year plus faculty/run/version/generated-at markers for degraded reopen continuity when live dashboard fetch fails. Dashboard objective state now separates linked teaching load from draft timetable plotting and exposes assignment rotation metadata for term-based Science/TLE communication before publish. The page exposes a plain `Check for updates` action and saved-data copy avoids internal run/gate language. |
| `/my/schedule` | My Published Schedule | Faculty-facing published timetable view | `/runtime/context`, `/faculty/me`, `/schools/:schoolId/schedules/published/:termId/faculty/:facultyId?date=YYYY-MM-DD` | Revision-aware published generation-run payload scoped to faculty assignment identity, with ATLAS runtime-context bootstrap | Faculty route uses published-truth contract only (no draft synthesis), requests the current date so effective revisions appear on the correct school day, stores last-good snapshots under date/run/published-at/revision/effective-date-aware keys for degraded reads, and removes older same-prefix saved snapshots after a live read so same-day publishes or effective revisions do not reuse stale saved data. The page exposes `Refresh schedule`, uses `Checking for updates` / `Showing latest saved schedule` copy, and returns explicit not-published guidance when no published run exists. View renders the published timetable in a table-first matrix for stakeholder-style reading. |
| `/public/schedules` | Public Published Schedule Family | Public/unauthenticated published schedule lookup for sections, teachers, and rooms | `/schools/:schoolId/schedules/published?date=YYYY-MM-DD` | Revision-aware published generation-run payload only (no draft/review reads), with client-side saved snapshot fallback for transient network failures | URL-state filters (`mode`, `sectionId`, `facultyId`, `roomId`, `q`, `grade`, `program`, `day`, optional `date`) are shareable and reopenable. Route must never call draft, review, or faculty self-service APIs. Saved snapshots are date/run/publish/revision-aware so current and historical published truth do not overwrite each other. The surface presents a shared table-first timetable matrix for all published entity modes. |

## Data Ownership Map

| Data Domain | Upstream Owner | ATLAS Persisted Owner | Derived / Fallback Behavior | Pages Most Affected |
|---|---|---|---|---|
| Branding, logo, active school year | EnrollPro public settings (branding) + ATLAS runtime-context derivation (active school-year bootstrap) | ATLAS derives and serves last-known runtime school-year context from persisted evidence via `/api/v1/runtime/context` | Branding reads `/enrollpro-api/settings/public`; scheduler-critical bootstrap now prefers ATLAS runtime context with EnrollPro as refresh/verification fallback; app shell branding now uses a local cache fallback so school identity remains readable during outage windows. Runtime year selection now uses weighted multi-signal ranking (mirror/snapshot/generation evidence over stale policy rows) with upstream verification tie-break, and scheduler pages treat warm cache as transient verification instead of final truth. When EnrollPro is reachable but its active year differs from ATLAS persisted evidence, ATLAS must treat this as rollover/context drift and block new-year generation until an explicit rollover sync maps or creates the active ATLAS school-year context. | App shell, dashboard, sections, teachers, teaching-load, subjects, audit |
| Faculty roster | EnrollPro | `FacultyMirror` | ATLAS can keep stale cached rows if upstream is unavailable | Faculty, assignments, subjects, preferences |
| Faculty login identity | Local ATLAS account plus EnrollPro employee ID/email | Canonical `FacultyMirror` link; newest ATLAS `FacultySnapshot` is the first exact-match hydration source and the live EnrollPro faculty feed is the fallback | Exact employee ID is preferred, exact email is secondary, and ambiguous matches are rejected; successful hydration persists the mirror/account link without invalidating generation runs | `/faculty/me`, faculty dashboard, published schedule, preferences, room requests |
| Placeholder faculty | None upstream | Transitional current state: `FacultyMirror.isPlaceholder`; target state: dedicated ATLAS-only overlay or sync-exempt placeholder registry | Current implementation works as a repair shim but pollutes the upstream faculty mirror boundary | Faculty, assignments, timetable |
| Section roster | EnrollPro | `SectionMirror` | ATLAS uses durable mirror and can apply persisted special-program placement overlays via `/sections/special-program-placement/overlay` when upstream placement is absent | Sections, assignments, timetable, audit |
| TLE ownership on sections | Historical only | `SectionMirror.tleProgramId/tleSpecialization/tleProgramCategory` remains in schema but current upstream feed no longer populates it | As of `2026-05-21`, active EnrollPro sections expose no TLE split metadata; ATLAS should no longer derive TLE cohorts from section ownership | Sections, timetable, subject activation |
| SCP offering flags | EnrollPro | mirrored indirectly through sync logic and activation behavior | SPA/SPS offerings may exist upstream even when there are no live section mirrors yet | Subjects, templates, timetable planning |
| Subject catalog | Mixed | `Subject` | ATLAS owns schedulable rows and minutes plus persisted ownership contract fields (`outputLabel`, `ownerDepartment`, `qualificationPriority`, `rotationFamily`, `isSystemManaged`) and explicit additional owner-department markers (`requiredFeatures` entries with `OWNER_DEPT:*`); runtime qualification uses multi-department ownership baseline and explicit Teaching Load assignments; special-program activation/materialization is explicitly refreshable via `/subjects/sync-offerings` using upstream offerings + mirrored section demand | Subjects, assignments, templates, timetable |
| Assignment specialization identity | None upstream | `SubjectSectionOwnership.specializationCode`, `SubjectSectionOwnership.specializationLabel` | Used only when assignment-level taught identity must be more precise than umbrella subject code; regular subject rows continue to use canonical subject identity without extra specialization metadata | Teaching load, faculty dashboard, teacher-facing assignment detail |
| Class templates | ATLAS | `ClassTemplate`, `ClassTemplateSubject` | No upstream fallback; generator uses live persisted templates | Audit, timetable |
| Scheduling policy | ATLAS | `SchedulingPolicy` | Old synthetic fallback path existed; current requirement is persisted row, not fallback-only response | Timetable, policy pane |
| Scheduling policy day-shape | ATLAS | `SchedulingPolicy.periodLengthMinutes`, `SchedulingPolicy.periodsPerDay` | Local code now treats the policy row as the active block contract; live Tailnet still needs a redeploy/restart to expose the new fields in the API response | Timetable, policy pane |
| Grade/program shift windows | ATLAS | `GradeShiftWindow` | Generator enforces these after policy/template shape is built | Timetable, policy pane |
| Instructional cohorts | Mixed (`settings/scp-config` + ATLAS specialization ownership fallback) | `InstructionalCohort` | TLE fallback remains disabled when ownership metadata is absent, but SPA/SPS breakout cohorts are now actively derived from specialization ownership (`derived:special-program-ownership`) and consumed by generation as concurrency lanes. | Timetable, teaching-load, section-first surfaces |
| Buildings and rooms | ATLAS | `Building`, `Room` | No upstream dependency | Dashboard, map, room schedules, timetable |
| Shared-facility protection | ATLAS | `Room.isSharedFacility` | If flags are wrong, generator overuses or underprotects singleton rooms | Map, room schedules, timetable |
| Preferences and room requests | ATLAS | preference tables and room-request flows | no meaningful upstream owner in current flow | Faculty/officer preference pages, timetable review |
| Generation runs and violations | ATLAS | `GenerationRun` | no fallback; this is the runtime truth of scheduling health. Invalid non-completed rows carrying legacy publish markers are now reconciled by clearing publish markers before published-payload resolution, and publish now enforces hard-block plus explicit soft-warning acknowledgment semantics. | Timetable, room schedules, audit |
| Published schedule revisions | ATLAS | `PublishedScheduleRevision` | Revision records preserve mid-semester change facts and audit metadata without mutating the source published run. The `/timetable` Tactical Dock can create future-dated teacher-change revisions for published runs, while published schedule read services apply non-draft revisions only when the requested/current date is on or after the revision effective date, preserving historical truth before that date. | Timetable, faculty schedule, public schedule, audit |

## Current Runtime Findings By Domain

### 1. Subject and Template Math
- Local code-path contract hardening (`2026-05-28`, rerun pending):
  - `SCI_PHYS` is retired from the canonical default subject catalog and treated as deprecated transition debt rather than an active default row.
  - `DEVL_READING` defaults to `SPA` / `SPS`, not `STE` / `SPA`.
  - `TLE_ICT_EXP`, `TLE_AFA_EXP`, and `TLE_FCS_EXP` now default to all active section programs instead of `REGULAR`-only.
  - Default class-template bundles were aligned to that contract so `sync-offerings` / generation cannot silently reseed the old snapshot shape.
- The current live template math is still infeasible:
  - `REGULAR`: `3420` subject minutes vs `2400` weekly capacity
  - `STE`: `2580` subject minutes vs `2250` weekly capacity
  - `SPA`: `2265` subject minutes vs `2250` weekly capacity
  - `SPS`: `2220` subject minutes vs `2250` weekly capacity
- This means many timetable failures are structural before the search even gets a fair chance.
- The timetable page is correctly showing NO-GO behavior because the underlying contract is still overloaded.

### 2. Program Mix Parity
- Program parity for the active school year is currently aligned across upstream feed, API summary, and persisted mirror.
- Live mirrored mix for `(schoolId=1, schoolYearId=55)` is now:
  - `REGULAR=58`
  - `STE=8`
  - `SPA=8`
  - `SPS=8`
- EnrollPro upstream feed still remains the source-of-truth input for section demand; ATLAS `SectionMirror` is the persisted cache used by generation and review surfaces.

### 2a. Stakeholder-School Fidelity Is Still Low
- The new schoolwide stakeholder PDFs show a real operating roster that does not match the current seeded ATLAS section naming and placement model closely.
- Current ATLAS mirrors use placeholder-like special section names such as `SPA A`, `SPA B`, `SPS A`, `SPS B` and astronomy-themed STE sections.
- The stakeholder PDFs use school-specific section names, explicit room labels, and a full-day class-program structure.
- This means current KPI progress is still measuring platform readiness more than stakeholder-school fidelity.

### 3. Faculty Baseline Is Now A Parity Problem, Not Just A Coverage Problem
- Current active EnrollPro faculty feed and ATLAS mirror align at the department-code level:
  - `SCI=18`, `MATH=25`, `ENG=33`, `TLE=13`, `FIL=14`, `ESP=11`, `MAPEH=14`, `AP=14`
- Stakeholder-provided official department counts do **not** match that upstream baseline:
  - `SCI=19`, `MATH=22`, `ENG=22`, `TLE=22`, `FIL=16`, `ESP=11`, `MAPEH=21`, `AP=13`
- This means the next faculty-sensitive work should not assume EnrollPro and stakeholder headcounts already agree.
- Teacher X is currently back to `0` persisted placeholder rows, which supports moving it out of the synced faculty mirror boundary.

### 3a. Teaching-Load Summary Is Not Yet Policy-Truthful
- Teaching-load summary now exposes explicit policy-aligned fields:
  - `sectionTeachingHours`
  - `gradeTeachingHours`
  - `advisoryHours`
  - `ancillaryHours`
  - `policyCreditedHours`
  - `policyLoadPercentage`
  - `loadSignalMode` (`STANDARD` vs `SYNTHETIC_PLACEHOLDER`)
- Ancillary minutes are now included in the policy load calculation.
- Placeholder rows are explicitly tagged as synthetic coverage in the summary contract so operators can distinguish them from standard workload signals.

### 3b. Targeted Real-Faculty Recovery Is Live; Current Gap Shape Is Mostly Uncovered, Not Placeholder-Masked
- New recovery contract is now live at `POST /api/v1/faculty-assignments/coverage/recover-real-faculty` with preview/apply modes and per-subject deltas.
- Latest Tailnet apply run (`2026-05-23`) applied `3` real-faculty assignments, all in `HG` (`79 -> 82` real-owned).
- In the same run, target subject placeholders were `0` for `SCI_ES`, `TLE_FCS_EXP`, and `SCI_CHEM`; residual gaps remain uncovered-pair shortages:
  - `SCI_ES`: `82` uncovered
  - `TLE_FCS_EXP`: `54` uncovered
  - `SCI_CHEM`: `35` uncovered
- Operational implication: for these subjects, the active blocker is real-faculty depth/qualification capacity, not placeholder masking in current live data.

### 3c. Saved-Truth Reconciliation Contract Is Now Explicit (`2026-05-27`)
- Teaching-load workspace now provides a dedicated operator action (`Reconcile Saved Coverage`) that calls `POST /api/v1/faculty-assignments/integrity/reconcile-split-brain` in preview/apply mode so saved-truth scope drift and recoverable staffing debt can be repaired without leaving the page.
- Recoverable split-brain states (`INTEGRITY_OUT_OF_SUBJECT_SCOPE`, `TRUTH_RECONCILE_PENDING`, `REAL_FACULTY_RECOVERY_PENDING`) now remain warning-only in the live workspace instead of forcing full-page read-only; hard integrity contradictions still block writes.
- Auto-fill apply flow now runs split-brain reconcile preflight first, preventing saved-truth drift from silently blocking recovered pair persistence.
- Draft save persistence now uses the optimistic-lock contract `PUT /api/v1/faculty-assignments/:facultyId`, which restores both By Teacher and Section Allocation writes after the retired batch endpoint drifted out of sync with the server.
- Staffing/source warnings now explicitly distinguish mirror-preferred runtime control from true upstream outage:
  - mirror-preferred fallback -> `ATLAS mirror-backed section data by runtime policy (not due to an upstream outage)`.
- With split-brain reconcile + auto-fill apply, saved assignment summary (`/faculty-assignments/summary`) and staffing truth (`/faculty-assignments/report/staffing-needs`) now converge on the same baseline instead of showing recoverable-but-unpersisted drift.

### 4. SPA/SPS Breakout Cohorts Are Now Active
- Cohort sync now merges upstream cohort payloads with ATLAS-derived SPA/SPS breakout cohorts from `SubjectSectionOwnership.specializationCode`/`specializationLabel`.
- Current local runtime (`2026-05-27`) now persists `10` active specialization cohorts for SY `55` with `sourceRef='derived:special-program-ownership'`:
  - SPA lanes include `DANCE`, `FINE_ARTS`, `MAJOR_IN_MAPEH`, `MAJOR_IN_MUSIC_EDUCATION`, `THEATER / PERFORMING ARTS`
  - SPS lane includes `SPORTS_SCIENCE`
  - Subject sync now normalizes `SPA_SPEC` / `SPS_SPEC` owner-department truth to `MAPEH` instead of synthetic `SPA` / `SPS` ownership, and ordinary MAPEH staffing no longer depends on approval-gated special-program candidates.
- Subject sync now exposes these active tracks directly through `POST /api/v1/subjects/sync-offerings` as `activeSpecialProgramTracks`.
- Generation no longer uses a TLE-only gate before cohort loading; active instructional cohorts are now consumed whenever available, enabling specialization-lane teacher-concurrency truth in generated demand.

### 5. Shared Facilities Are Persisted, But Specialized Scarcity Remains
- Shared-facility flags now exist and are populated:
  - `LABORATORY=11`
  - `COMPUTER_LAB=4`
  - `TLE_WORKSHOP=5`
  - `GYMNASIUM=5`
- After room-demand contract reset and subsequent feasibility passes (`run 76`), specialized scarcity remains `SPECIALIZED_ROOM_UNAVAILABLE=123` (still far below `864` in `run 55`).
- The rooming issue remains secondary to broader feasibility pressure (`UNASSIGNED_SECTION=705`, `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=704`, `hardViolationCount=705`).
- Current pass-2 code direction narrows this further: specialized-room scarcity is no longer intended to block section-facing master-schedule replication when homeroom-first placement is explicitly chosen.

### 5c. Specialized-Room Pressure May Be Over-Modeled
- The stakeholder class-program PDFs are strongly section-room anchored and do not provide strong evidence for frequent per-subject room switching.
- The current implementation direction now follows that artifact shape directly: section master schedules prioritize the persisted home room and downgrade specialist-room fit to deferred diagnostics when the pass is explicitly running in homeroom-first mode.
- Current live contract after reset is now predominantly classroom-first with narrow explicit exceptions:
  - active subject room-type mix is `CLASSROOM=25`, `COMPUTER_LAB=2`, `LABORATORY=1`
  - regular-scope subject demand now allocates `330` non-classroom minutes out of `3990`
  - remaining non-classroom subjects are `TLE_ICT_EXP` (`COMPUTER_LAB`, `240`) and `ENVIRONMENTAL_SCIENCE` (`LABORATORY`, `90`)
- This confirms that prior over-specialization pressure was materially reduced; remaining NO-GO pressure now comes from assignment/policy feasibility, not broad room-type over-constraint.

### 5a. Special-Program Placement Overlay Is Now Persisted
- The null-placement gap for active special-program sections has been repaired through an explicit ATLAS overlay contract.
- Tailnet and DB verified after repair:
  - `SPA` rows: `8`, `missing homeRoomId=0`, `missing buildingZoneId=0`
  - `SPS` rows: `8`, `missing homeRoomId=0`, `missing buildingZoneId=0`
- Contract behavior:
  - EnrollPro remains source-of-truth for section roster/program membership.
  - ATLAS persists special-program placement overlays in `SectionMirror` (including `homeRoomId`, `preferredRoomId`, `buildingZoneId`) when upstream placement is not provided.
  - Overlay application is explicit and auditable via `POST /api/v1/sections/special-program-placement/overlay`.

### 5b. Campus Topology Is Not Yet Stakeholder-Faithful
- Current live ATLAS uses a generic seeded campus model with building codes such as:
  - `G7`, `G8`, `G9`, `G10`, `STEX`, `SPA`, `SPS`, `SCI`, `TLE`
- Stakeholder outputs instead reference numbered buildings and room labels such as:
  - `BLDG 3`, `BLDG 9`, `BLDG 10`, `BLDG 11`, `BLDG 12`, `BLDG 13`, `BLDG 14`, `BLDG 21`, `BLDG 23`, `BLDG 26`
- The strongest rooming issue is not yet proven to be raw room-count shortage.
- The stronger issue is mismatch in:
  - campus topology
  - section-to-building placement
  - special-program room ownership assumptions

### 6. Term Distribution Is No Longer Collapsed
- Latest live run now has:
  - `term1=1974`
  - `term2=105`
  - `term3=100`
- The prior term-collapse indicator is now repaired at runtime; remaining NO-GO pressure comes from unresolved feasibility/hard-violation clusters.

### 6a. Policy Block Pressure Contracted; Slot Pressure Still Dominates
 Policy block pressure is no longer the only dominant blocker, and the current latest run now shows `policyBlockedCount=201`.
- The remaining blocker mix now reflects a combination of:
  - slot scarcity / unresolved placement mass
  - faculty qualification distribution gaps
  - faculty depth / travel pressure
- Do not use older post-run72 counts as the active baseline after the MATATAG reset.

### 6b. TLE Contract Reset Is Applied In Generation
 The active generation path no longer depends on cohort fallback for unsplit TLE contracts.
 Post-reset breakout run now shows:
  - `cohortCount=10`
  - `cohortizedClassCount=4`
  - `modularWarnings=0`
 Current remaining blockers are still measured in slot-fit, room scarcity, and faculty qualification distribution terms rather than stale TLE cohort language.

### 7. Specialization Mapping Is Out Of Normal Product Flow
- `/specialization-mapping` is no longer part of the default scheduling operator navigation.
- Department ownership now serves as the default qualification baseline for generation, auto-fill, and assignment seeding.
- Manual Teaching Load placement in `/teaching-load` remains authoritative and can intentionally override baseline distribution (legacy `/assignments` redirect retained).
- Legacy specialization-alias data may remain in storage for compatibility, but it is not part of the normal qualification path.

### 8. Subject Sync For Special Programs Is Explicit And Auditable
- ATLAS now exposes an explicit operator-facing sync contract for special-program subject state via `POST /api/v1/subjects/sync-offerings`.
- Since SPA/SPS sections now exist upstream, subject activation/materialization is no longer modeled as passive seed behavior and must be intentionally refreshed by operators.
- The sync path remains the runtime contract until SSE-level orchestration supersedes it, and the generated subject contract fields are persisted in `Subject` rows rather than recomputed only in view logic.

### 8d. TLE Umbrella Row Is Compatibility-Only And No Longer Seedable-Protected
- As of `2026-05-23`, the umbrella `TLE` row remains active for compatibility/reference continuity, but is explicitly `isSeedable=false`.
- Active schedulable TLE family behavior remains on exploratory rows (`TLE_AFA_EXP`, `TLE_ICT_EXP`, `TLE_FCS_EXP`) under `rotationFamily=TLE_ROTATION`.
- Subject deletion contract is now maintenance-oriented:
  - deletion is blocked only by operational state (active/historical assignment dependencies) with remediable actions
  - deletion is no longer permanently blocked by `isSeedable=true` status
- `TLE` and previously seedable rows now surface the same operational blocker model (`ACTIVE_ASSIGNMENTS` / cleanup flow), aligning subject maintenance with curriculum-change requirements.

### 8b. Stakeholder-Facing Subject Outputs Are Now Normalized
- Internal canonical subject granularity remains intact for generation and qualification:
  - `SCI_BIO`, `SCI_CHEM`, `SCI_ES`
  - `TLE_ICT_EXP`, `TLE_AFA_EXP`, `TLE_FCS_EXP`, `TLE_IA_EXP`
  - `SPA_SPEC`, `SPS_SPEC`
- Stakeholder-facing output contract is now explicit and live:
  - `/api/v1/subjects` and `/api/v1/subjects/:id` provide `displayCode` for normalized labels.
  - `/api/v1/room-schedules/:schoolId/:schoolYearId/rooms/:roomId` entries provide `subjectDisplayLabel`.
  - `/api/v1/room-preferences/:schoolId/:schoolYearId/latest/faculty/:facultyId` entries provide `subjectDisplayLabel`.
  - Timetable/review surfaces resolve labels from canonical `subjectId` via subject `displayCode` mapping.
- Verified normalized samples include:
  - `SCI_BIO -> SCIENCE`
  - `TLE_ICT_EXP -> TLE`
  - `SPA_SPEC -> SPECIALIZATION`
  - `STE_RESEARCH -> RESEARCH`

### 8c. Master-Schedule Teacher Visibility Should Stay Lighter Than Teacher-Facing Schedules
- The stakeholder class-program PDFs include partial specialist attribution patterns such as `TEACHER X` and `TEACHER Y`, especially around some Grade 9-10 TLE/specialist blocks.
- This supports a split output contract:
  - section-facing master schedules may omit or simplify teacher attribution
  - teacher-facing schedules should still keep resolved teacher identity and assignment detail
- This split is now implemented in timetable surfaces:
  - section mode passes `showTeacherDetails=false` to `TimetableGrid`, suppressing teacher initials/names in section-facing cells
  - `ClassProgramMatrixView` now renders room-only secondary labels and section-only aria labels without faculty names
  - non-section surfaces (faculty/room views) keep teacher attribution behavior via default `showTeacherDetails=true`

### 8d. Specialization Identity Now Lives On Assignment Ownership, Not Subject Explosion
- `SPA_SPEC` and `SPS_SPEC` remain the live schedulable umbrella subjects for operator workflows and master-schedule surfaces.
- Precise taught identity now persists on `SubjectSectionOwnership.specializationCode` / `specializationLabel`, which lets assignment detail resolve values such as `DANCE` or `SPORTS SCIENCE` per section without creating one top-level subject row per specialization.
- `Subject.allowedSpecializations` remains available as reference metadata, but its runtime role is narrowed: it no longer reintroduces specialization-tier gating for scheduler assignment eligibility.
- Teacher-facing assignment payloads may surface the assignment-level specialization label even when stakeholder-facing schedule labels stay normalized to `SPECIALIZATION`.
- `TLE_SPEC_*` dynamic specialization rows remain compatibility-only in the current contract and are not the active MATATAG scheduling identity path.

### 8a. Schoolwide Day Shape Is Now Dual-Mode Aligned
- Tailnet-verified controls now support both required modes:
  - full-day baseline schoolwide model:
    - policy envelope `07:30-17:00`
    - lunch `11:30-13:00`
    - grade/program windows `07:30-17:00`
  - temporary `SY 2026-2027` half-day override mode:
    - policy envelope `06:00-18:00`
    - lunch `11:30-12:30`
    - grade/program windows `G7/8=06:00-12:00`, `G9/10=12:00-18:00`
- Latest run shape contracts confirm representability for the full-day model:
  - regular contract reaches `17:00` with late-day slots (`15:00-16:00`, `16:00-17:00`)
  - STE contract reaches `16:45` with late specialization/research capacity (`15:15-16:00`, `16:00-16:45`)
  - break events include both `RECESS` (`09:45-10:00`) and `LUNCH BREAK` (`11:30-13:00` display window)
- Artifact authority used for this alignment remains:
  - primary: schoolwide stakeholder PDFs (via deep-dive fallback doc in this session)
  - corroborating: Grade 8 workbook pattern
  - secondary: Grade 10 monitoring workbook

### 8e. Timetable-Embedded Teaching Load Repair Runtime Contract
- `/timetable` remains the review surface for generated and published timetable artifacts.
- The active run shown in the command row is the user-selected runtime source for dock behavior:
  - latest published/completed run reads stay published-revision-only when the selected run is published
  - historical unpublished completed run reads stay canonical Teaching Load repair capable when the selected run is not published
- Client run-data hydration must not let delayed `latest` or background-refresh responses overwrite a selected historical run.
- Unpublished Teaching Load repairs use the existing generation review repair endpoints:
  - preview: `/api/v1/generation/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/preview`
  - apply: `/api/v1/generation/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/apply`
- The repair payload accepts legacy scheduled-entry `changes[]` as `ENTRY` changes and explicit `UNASSIGNED` changes keyed by `subjectId`, `sectionId`, `session`, `entryKind`, and optional `cohortCode`.
- `UNASSIGNED` repair preview resolves the current canonical owner, proposed owner, plain placement readiness, top blocker copy, and up to three placement suggestions without requiring an existing timetable block.
- `UNASSIGNED` repair apply updates canonical `SubjectSectionOwnership` and matching `FacultySubject.sectionIds`; the unassigned rail item remains visible until the scheduler explicitly places it or regenerates the run.
- When `placementProposal` is provided, the apply flow projects the Teaching Load repair first and then routes the placement through the existing manual-edit placement path in the same transaction.
- Successful unpublished repair apply refreshes draft entries, unassigned items, violations, summary, and input snapshot trust state while preserving the current run identity and not creating a new generation run.
- Published timetable repairs remain revision-only through the published revision flow; they must not rewrite canonical Teaching Load ownership from a published schedule repair.
- Teaching Load owner mismatch is derived by comparing the selected timetable entry faculty against canonical `FacultySubject` / `SubjectSectionOwnership` ownership loaded through the faculty mirror/assignment payloads.
- Tailnet QA on 2026-06-11 verified:
  - run `127` remains selected after delayed background reads
  - run `127` unpublished Teaching Load preview/save flow works from `/timetable`
  - run `128` published class selection exposes revision-only copy and action
  - run `127` contains natural mismatch data for `entry-2`, subject `3078`, section `2968`, timetable faculty `21624`, and canonical owner `21538`
- Follow-up QA on 2026-06-11 verified that a mini Teaching Load save on unpublished run `127` for FIL/COPPER transferred canonical `SubjectSectionOwnership`, updated every selected-run FIL/COPPER draft entry, and was consumed by a fresh generated run `141`.
- Dynamic unassigned repair pass on 2026-06-11 closed the prior scheduled-entry-only limitation: generated-run unassigned rows and default `UNASSIGNED_SECTION` blocker rows can now open the embedded Teaching Load repair dock through `Fix teacher`, save canonical ownership, refresh run readiness, and stay queued for explicit placement or regeneration.
- Generation now attempts live section sync first, but if EnrollPro section sync is unreachable and non-stale ATLAS section mirrors exist, generation continues from saved section data instead of failing the run.
- Dynamic unassigned slot suggestions and atomic transactional summary updates were implemented and validated via database-backed integration checks on 2026-07-08.
- Repair preview blocking is delta-based: pre-existing run violations remain part of recomputed persisted truth, but only newly introduced violation identities can veto the proposed Teaching Load or placement change.
- Tailnet QA on 2026-07-11 proved the unpublished unassigned apply path on run `127`: a suggested slot was selected, the placement was applied transactionally, and the active run queue changed from 25 to 24 unassigned sessions without creating a new run.
- The timetable command row is task-first: run selection, refresh, eligible publish, and `More` remain primary; setup, generation, policy, map, requests, history, and guidance remain secondary actions.
- Timetable frontend ownership is now split by responsibility without changing API or persistence truth:
  - `useScheduleReviewWorkspaceState` composes data, mutations, and typed view contexts.
  - `useTimetableCollaboration` owns scheduler presence and remote selection lifecycle.
  - `useTimetableDragDrop` owns pointer drag normalization and pinned/unassign drop behavior.
  - `useTimetableLookupHelpers` owns reference-label resolution and grouped selector data.
  - `useTimetableViewNavigation` owns panel restoration and center-view transitions.
  - timetable dialogs are grouped into workflow/request, placement/swap, and assignment/history surfaces.

### 8f. Timetable First-Load Runtime Contract
- `/timetable` first-load readiness depends on a lightweight run-history selector plus the selected run's draft and violation slices; the run-history selector is not a source for full timetable payloads.
- `/api/v1/generation/:schoolId/:schoolYearId/runs` now returns metadata-only run rows for selector/history use:
  - included: run identity, school/school-year IDs, status, run type, trigger actor, timestamps, duration, error, version, created/updated timestamps
  - excluded: `summary`, `draftEntries`, `violations`, and `unassignedItems`
- Full generated-run content remains owned by the explicit detail/slice endpoints:
  - `/api/v1/generation/:schoolId/:schoolYearId/runs/:runId`
  - `/api/v1/generation/:schoolId/:schoolYearId/runs/:runId/draft`
  - `/api/v1/generation/:schoolId/:schoolYearId/runs/:runId/violations`
  - latest aliases for draft/timetable/violations
- `/api/v1/runtime/context` defaults to persisted ATLAS evidence for page-load speed and returns `source=atlas-persisted` when upstream verification is skipped.
- Upstream active-school-year verification remains available through `/api/v1/runtime/context?verifyUpstream=true`; this path can wait on EnrollPro reachability and should not block primary timetable grid rendering.
- Reference-data hydration can complete after the first grid render; guided workflows must therefore open their review surfaces before requiring auto-selected room/faculty defaults.
- Pre-generation draft placement keeps `Review draft placement` visible when defaults are incomplete, treats Teaching Load ownership as read-only source truth, hydrates reference room data before interactive placement, and requires a valid room plus readable save-state reason before preview/save.
- Phase 4 Tailnet proof on 2026-07-18:
  - run-history selector: `5,992` bytes in `43.6ms`, with heavy fields omitted
  - runtime context default path: `185.9ms`
  - explicit upstream verification path: `4021.6ms`
  - timetable performance harness: `cold=1322ms`, `warm=1088ms`

### 8g. Setup-Page Source-Clarity UI Contract

- As of 2026-07-28, setup pages must show source truth visibly in the compact command header instead of relying only on hover text.
- `/sections`, `/subjects`, and `/faculty` use `AdminWorkspaceFrame` with:
  - visible source chip states: `Verified live`, `Checking source`, `Using saved data`, or `No saved data`
  - desktop visible source summary text through `admin-source-truth-summary`
  - screen-reader source announcements through a polite live region
- `/teaching-load` keeps its custom command header but now exposes the same visible source-truth summary pattern through `teaching-load-source-truth-summary`.
- `/dashboard` now separates source-health guidance from setup repair steps:
  - source decision states are shown in a dedicated `Source connection` strip
  - saved/unavailable source copy explicitly tells operators to review saved data now and wait for EnrollPro before final sync
  - verified source copy does not show outage language
  - setup repair links remain visible without implying that saved data has become the upstream authority
  - lower campus room details are lazy-loaded after the first dashboard action surface is visible
- This UI contract does not change runtime source ownership:
  - EnrollPro-backed domains remain upstream-owned where documented.
  - ATLAS saved data remains fallback or persisted evidence according to each page contract.
  - Generation truth, publish lifecycle gates, and persisted ownership rules are unchanged by this source-clarity pass.

### 8h. Teaching Load Suggestion Proposal and EnrollPro Rollover Proof Contract

- EnrollPro remains the source of active school-year identity, section identity, faculty identity, and public settings.
- ATLAS owns Teaching Load, Teaching Load suggestion proposals, scheduling policies, generation runs, timetable review state, and published schedule artifacts.
- The officer-facing `Suggest Teaching Load draft` workflow is now a persisted ATLAS review artifact:
  - preview creates a `TeachingLoadSuggestionProposal` with status `PENDING`;
  - closing or cancelling the review marks the pending proposal `CANCELLED`;
  - starting a newer preview supersedes older pending proposals for the same school/year;
  - applying a suggestion is allowed only from a persisted `PENDING` proposal and marks it `APPLIED`;
  - preview and cancel do not write `FacultySubject` or `SubjectSectionOwnership` rows;
  - apply writes Teaching Load through the existing ATLAS Teaching Load service after officer confirmation.
- Rollover services resolve `ENROLLPRO_API` at request time for upstream reads so active-year drift checks can follow the current EnrollPro endpoint in long-running dev/test processes.
- Backend rollover readiness now includes a non-destructive simulated EnrollPro next-year proof:
  - a fake EnrollPro HTTP endpoint reports `schoolYearId=2 / 2027-2028`;
  - ATLAS reports `atlas-stale` and recommends `RUN_ROLLOVER_SYNC`;
  - stale generation against the previous active year is blocked with `ACTIVE_YEAR_DRIFT`;
  - the simulation performs no local ATLAS writes and does not run EnrollPro's destructive lifecycle reset script.

### 8i. Unified SSE Notification Contract

- ATLAS exposes a unified authenticated SSE stream at `/api/v1/notifications/:schoolId/:schoolYearId/events`.
- The stream is school-year scoped and accepts `accessToken` query authentication for browser `EventSource` compatibility.
- Privileged users receive privileged operational events for generation, timetable edits, publish/revision, and upstream sync actions.
- Faculty users are resolved through canonical faculty identity and receive global published-schedule notifications plus only faculty-scoped events that affect them.
- The unified stream bridges existing ATLAS event services instead of replacing them:
  - preference events remain available at `/api/v1/preferences/:schoolId/:schoolYearId/events`;
  - room-request events remain available at `/api/v1/room-preferences/:schoolId/:schoolYearId/events`;
  - published-schedule events remain available at `/api/v1/schools/:schoolId/:schoolYearId/schedules/published-events`.
- The unified stream adds cross-system notifications for EnrollPro-facing sync boundaries:
  - faculty sync;
  - section sync;
  - subject-offerings sync;
  - cohort sync;
  - rollover apply/reset;
  - generation-time subject/section sync degradation when saved ATLAS data is used.
- Publish now emits `SCHEDULE_PUBLISHED` through the published-schedule event service after the run is marked published, so faculty clients and downstream notification consumers can observe the first official-schedule availability event.
- The AppShell subscribes once to the unified stream for the active school year and surfaces global toasts for generation, timetable, publish/revision, and upstream sync events. Page-specific preference and room-request refresh behavior remains owned by their existing specialized streams.


## What Healthy Pages Do Not Prove
- A healthy Dashboard does not prove generator readiness.
- A persisted Scheduling Policy row does not prove timetable feasibility.
- A successful placeholder coverage repair does not prove faculty adequacy.
- Existing cohorts do not prove cohortized scheduling is happening in output.
- A room inventory with `isSharedFacility=true` does not prove specialized-room sufficiency.

## What Still Drives Phase 3 NO-GO
1. Template math remains overloaded.
2. Slot-fit and fallback pressure remains high (`UNASSIGNED_SECTION=757`, `hardViolationCount=827`).
3. Room topology and specialized-room pressure remain open (`SPECIALIZED_ROOM_UNAVAILABLE=240`).
4. Faculty feasibility remains open (`FACULTY_SUBJECT_NOT_QUALIFIED=70`, `FACULTY_EXCESSIVE_IDLE_GAP=317`, `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=678`).
5. Faculty baseline parity with stakeholder department counts is still mismatched and may be masking true staffing depth.
6. Day-shape controls are now dual-mode representable, but generation remains `NO-GO` due unresolved math/policy/assignment feasibility blockers.
7. Current campus topology and generator feasibility remain blockers even after output-label normalization is repaired.

## Update Protocol
Update this file whenever any of the following happen:
- a page adds or removes a primary API dependency
- a persisted entity changes owner, fallback rules, or upstream source
- a synthetic/fallback path is replaced by real persistence
- a new generator blocker is proven live
- EnrollPro integration changes what ATLAS should sync versus derive

Minimum required update fields for each change:
- affected page or data domain
- previous source of truth
- new source of truth
- whether the change is persisted, derived, or fallback-only
- which phase gate or prompt sequence it affects
