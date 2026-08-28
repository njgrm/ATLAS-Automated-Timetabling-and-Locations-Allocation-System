# Plan: Dynamic Timetable Sync & Performance Optimizations

This document outlines the phase-by-phase implementation plan to address the performance of the Timetable Review Console (specifically loading visibility and caching) and to introduce a dynamic timetable synchronization mechanism. This mechanism allows the scheduler to sync changes in the teaching load, curriculum subjects/sections, or scheduling policies directly into an active, generated run without needing a full regeneration.

---

## The Core Problems

1. **Bare Loading Visibility on Run Transition:**
   - On first page load, a full screen skeleton (`TimetableSkeleton.tsx`) is rendered.
   - However, when the user switches between runs in the dropdown or clicks "Refresh", the `draft` state remains populated with the previous run's data.
   - The UI skips the initial skeleton check and remains fully static and interactive while the background API calls complete.
   - The user gets no visual confirmation of background loading, apart from a tiny spinner on the Refresh toolbar icon.
   - Background loading of a large run and violations report can take 3–8 seconds on the live Tailnet environment, leading to a perception of freezing.

2. **Redundant Network Waterfall on Load/Refresh:**
   - Whenever `loadAll` is called (on refresh, run switch, or tab switch), `fetchReferenceData` is triggered.
   - Although it attempts to use a memory cache, it initiates a background refresh of reference data (subjects, sections, teachers, buildings) *every single time*.
   - This launches 4 parallel HTTP calls to fetch large database catalogs, which causes heavy CPU layout calculations and re-renders upon completion.

3. **Stale Run Snapshot vs. Live Database Setup:**
   - Completed `GenerationRun` records store `draftEntries` and `unassignedItems` as JSON snapshots at the moment of generation.
   - If a scheduler makes changes on the **Teaching Load** page (`/teaching-load`), deactivates a subject in **Subjects** (`/subjects`), or alters a **Scheduling Policy** (`/policy`), the active run's entries and unassigned lists become stale.
   - There is currently no way to "import" new or displaced curriculum sessions into the timetable review workspace, nor to automatically update the draft entries' assigned teachers to match new assignments without triggering a full, time-consuming timetable regeneration.

---

## Phase-by-Phase Implementation Plan

### Phase 1: Timetable Loading Visibility & Cache Optimization (Performance)

#### 1.1 Timetable Skeleton & Loading Overlays
- **Workspace-Level Loading State:** Expose the `loading` state to the `ScheduleReviewWorkspaceBody` layout.
- **Translucent Loading Overlay:** Render a semi-transparent loading glassmorphism overlay containing a spinner and a *"Loading run data..."* message over the active timetable grid and left/right rails when `loading` is true and a `draft` is already populated.
- **Section Transition Skeleton:** Add a localized skeleton or fade-in animation inside the class matrix grid during section switches to avoid visual popping.

#### 1.2 Reference Data Cache Tightening
- **Avoid Redundant Background Refreshes:** Modify `fetchReferenceData` and `fetchRuns` to avoid triggering a background refetch if the cached data is fresh (less than 2 minutes old).
- **Manual Force Refresh:** Expose a `forceRefresh` flag to `loadAll()`. Trigger reference data fetches *only* when the user explicitly clicks the "Refresh" button in the toolbar, eliminating background waterfalls on simple tab or run switching.

---

### Phase 2: Backend Dynamic Setup Sync API (Data Integrity)

#### 2.1 Re-evaluation Endpoint
- **New Endpoint:** `POST /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/sync-setup`
- **Scoping and Access:** Restrict to `admin`, `officer`, or `SYSTEM_ADMIN` roles. Centralize logic in a new service file: `timetable-sync-setup.service.ts`.
- **Database Transaction Steps:**
  1. **Load Current Setup:** Fetch active subjects, section mirrors, class templates, and live `SubjectSectionOwnership` data.
  2. **Update Roster Assignments:**
     - Match each entry in the run's `draftEntries` by `subjectId` and `sectionId`.
     - Update the entry's `facultyId` to match the live `SubjectSectionOwnership` assignment.
     - If the subject or section has been deleted or deactivated in the setup database, remove the scheduled entry from the draft.
  3. **Track Displaced & New Sessions (Unassigned Items):**
     - Recalculate the expected class sessions based on active sections, subjects, and curriculum templates.
     - Identify sessions that are **not** present in the run's `draftEntries`.
     - For each missing session, create/update an `UnassignedItem` record (specifying the blocker reason, e.g., `NO_QUALIFIED_FACULTY` or `NO_AVAILABLE_SLOT`).
     - Rebuild the run's `unassignedItems` list.
  4. **Re-validate Constraints:**
     - Execute the full hard and soft constraint validation rules (`validateHardConstraints`) on the newly updated `draftEntries` against active scheduling policies.
     - Update the run's `violations` list.
  5. **Update Metrics:** Re-compute summary statistics (e.g., total assigned, unassigned, hard violations, and soft warning counts).
  6. **Persist Snapshot:** Save the updated `draftEntries`, `unassignedItems`, `violations`, and `summary` to the `GenerationRun`, incrementing the `version` field.

---

### Phase 3: Timetable Review Console Sync UI & Real-Time Sync (UX)

#### 3.1 "Sync with Setup" Action
- **Toolbar Action:** Add a "Sync with Setup" button (with a database/sync icon) in the header toolbar of `ScheduleReviewWorkspaceHeader.tsx` (placed next to the "Refresh" button).
- **Stale Notification Banner:** If the run's `summary.inputSnapshot` check returns `STALE` (using the existing comparison logic), display an inline amber banner at the top of the workspace:
  > [!WARNING]
  > This timetable draft is out-of-sync with current teaching load assignments or scheduling policies.  
  > **[Sync Timetable with Setup]**
- **Interaction Feedback:** Clicking the sync button opens a confirmation dialog showing what will change (e.g., *"This will update teacher assignments to match the live Teaching Load page and scan for any new/displaced classes. Progressed manual edits in this run will be preserved."*).
- **Trigger Sync Processing:** Show the full loading skeleton/overlay during API execution. On success, show a detailed success toast: *"Timetable Synced: Updated 4 teacher assignments, added 2 new unassigned sessions, recomputed 6 violations."*

#### 3.2 Real-Time Collaboration Propagation
- **WebSocket Event Broadcast:** When a sync is applied, broadcast a `TIMETABLE_EDIT_COMMITTED` or new `TIMETABLE_SYNCED` event via the room preference collaboration WebSocket channel.
- **Client Auto-Refresh:** Other active schedulers connected to the same run will receive the event and automatically trigger a background data refresh to keep grids in sync.

---

### Phase 4: Integration Testing & Verification

#### 4.1 Automated Backend Tests
- Create `__tests__/timetable-sync-setup.test.ts` to test the sync logic:
  - Verify that changing section owners in `SubjectSectionOwnership` updates the run's scheduled entries after sync.
  - Verify that deleting or deactivating a subject removes it from the run's scheduled entries after sync.
  - Verify that adding a new section or subject triggers new unassigned sessions in the run after sync.

#### 4.2 Browser Verification
- Use Playwright/browser tests to verify:
  - Visual overlay shows up during run loading/switching.
  - Clicking the "Sync" action updates the grid and populates the unassigned list with live displaced sessions.

---

## Verification Gates & Metrics

| Gate ID | Verification Item | Success Criteria |
| :--- | :--- | :--- |
| **GATE-PERF-01** | Caching & Waterfall reduction | Switching between tabs/runs does not launch reference data fetches if cached data is < 2 minutes old. |
| **GATE-PERF-02** | Loading feedback | Background loads or run switches show a clear, centered visual overlay over the timetable workspace. |
| **GATE-SYNC-01** | Live Teaching Load updates | Changes made on `/teaching-load` propagate to `/timetable` draft entries after triggering setup sync. |
| **GATE-SYNC-02** | Live new/displaced additions | Adding a new subject or de-scheduling a class creates a new `UnassignedItem` visible in the unassigned sidebar. |
| **GATE-SYNC-03** | Constraint re-evaluation | Violations index is updated and saved using the newly active policies after setup sync. |
