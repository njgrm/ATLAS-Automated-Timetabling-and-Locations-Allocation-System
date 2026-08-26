# ATLAS Progress Check - Objectives Priority Realignment (2026-05-07)

## Purpose
This document records the current system progress against the capstone objectives and sets an immediate execution direction: prioritize objective-completion work over additional timetable UX polish.

## System Identity Match
- `projectIntro.md` defines ATLAS as a mobile-responsive web scheduling system for JHS on local/LAN deployment.
- The codebase confirms PERN architecture, school scoping, and multi-school-ready patterns.
- Current lifecycle status from planning/evidence docs: Phase 4 is active, Phases 0-3 are closed, Phases 5-6 are not started.

## Objective Progress Snapshot

### Objective 1.1 - Web admin portal with drag-and-drop scheduling
- Status: Mostly complete (~85%).
- Confirmed complete areas:
  - Officer portal shell, routing, role-based navigation.
  - Timetable review workspace (three-panel model).
  - DnD flows in pre-generation and generated review contexts.
  - Grid pivots (section/faculty/room), conflict overlays, preview+commit pathways.
  - Map editor with building/room CRUD and floor-aware behavior.
- Remaining gaps:
  - Generated-view parity edge cases (especially unassigned placement behavior and swap UX consistency on all paths).

### Objective 1.2 - Configurable scheduling priority management module
- Status: Substantially complete (~95%).
- Confirmed complete areas:
  - `SchedulingPolicy` persistence and CRUD API.
  - Constraint severity and policy toggles consumed in generation/review services.
  - Daily load, break, lunch, travel/wellbeing, grade-window, and TLE-specific controls.
- Remaining gap:
  - Intro text framing references "dynamic weighted control" while implementation centers on toggles/thresholds and per-constraint overrides.

### Objective 1.3 - Mobile faculty authentication + preference submission
- Status: Partially complete (~50%).
- Confirmed complete areas:
  - Faculty preference submission (`/my/preferences`).
  - Officer preference monitoring/reminders (`/faculty/preferences`).
  - Faculty room preference requests + officer review.
- Critical gaps:
  - No standalone ATLAS faculty login flow (current auth is bridge token based).
  - No faculty published schedule page (`/my/schedule`).
  - No PWA/offline implementation (no service worker/manifest/workbox integration).

### Objective 1.4 - Automated timetable generation system
- Status: Mostly complete (~90%).
- Confirmed complete areas:
  - Deterministic constructor, hard/soft validation, run lifecycle, pre-gen draft workspace.
  - Cohort-aware generation support and benchmark evidence below 60-second target.
- Remaining gaps:
  - Publish action is still placeholder in UI.
  - Published schedule APIs and dissemination flows are not implemented.

## Contradiction Log (Project Intro vs Implemented System)
1. "Mobile faculty authentication" vs bridge-only auth, no standalone ATLAS faculty login (High).
2. "Offline-first by default" vs no PWA infrastructure in client (High).
3. "Offline action sync on reconnect" vs no offline queue/sync mechanism (High).
4. Student synchronized schedule access + image export vs no student-facing schedule pages/export flow yet (Medium).
5. Genetic algorithm narrative vs deterministic greedy constructor in current engine (Low, documentation alignment issue).
6. "No installation/download" statement can be misread: true for end users, but on-prem hosting still needs server runtime setup (Low).
7. "Real-time synchronization" claims vs no WebSocket/SSE/push implementation yet (Medium).

## Phase Summary
- Phase 0: Complete
- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete
- Phase 4: In Progress (active)
- Phase 5: Not Started
- Phase 6: Not Started

## Priority Realignment Decision (Immediate)
From this checkpoint forward, team effort should shift away from non-critical timetable UX polish unless it blocks objective validation. Priority should move to objective-critical implementation gaps.

## Critical Priority Backlog (Execution Order)
1. Standalone ATLAS faculty authentication flow (unblocks objective 1.3 validation).
2. PWA/offline shell baseline (manifest + service worker + controlled caching strategy).
3. Generated-view parity blockers only (limit to objective-blocking defects).
4. Publish lifecycle implementation and hard-violation publish guard enforcement.
5. Faculty published schedule page (`/my/schedule`).
6. Student/public published schedule pages and API-backed read-only views.
7. Push notification pipeline for publish and faculty-impact changes.
8. Final UX/accessibility/ISO polish once objective-critical paths are complete.

## Scope Steering Rule
- Until priorities 1-6 are implemented, avoid opening new timetable UX-only enhancements that are not direct blockers to objective acceptance.
- Timetable work remains allowed only for:
  - functional parity bugs,
  - correctness bugs,
  - performance defects that block usability on low-end devices.

## Linked Sources
- `projectIntro.md`
- `phasePlan.md`
- `docs/phases/phase-4-review.md`
- `docs/phases/phase-5-publish.md`
- `docs/verification/evidence-log.md`
- `docs/verification/phase-gates.md`
