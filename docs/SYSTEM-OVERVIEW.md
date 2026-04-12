# A.T.L.A.S. — System Overview & Architecture Guide

> **Automated Timetabling and Locations Allocation System**  
> Version: 1.0 (Phase 4 — Review and Manual Adjustment)  
> Last Updated: April 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Data Model](#data-model)
4. [Timetable Generation Algorithm](#timetable-generation-algorithm)
5. [API Reference](#api-reference)
6. [Frontend Structure](#frontend-structure)
7. [Key Source Code Reference](#key-source-code-reference)
8. [Viewing the Database Schema](#viewing-the-database-schema)
9. [Phase Plan & Status](#phase-plan--status)

---

## Introduction

A.T.L.A.S. is a Progressive Web Application (PWA) designed for Philippine Junior High Schools (Grades 7–10) to automate academic schedule generation. The system follows a strict MVC architecture with PERN stack (PostgreSQL, Express, React, Node.js).

### Core Capabilities

- **Multi-school support** — School-agnostic design with configurable policies
- **DepEd DO 010 s.2024 compliance** — 8 JHS learning areas + Homeroom Guidance
- **Constraint-aware scheduling** — Hard constraints block publish; soft constraints generate warnings
- **Manual adjustment workflow** — Drag-and-drop with violation preview
- **Faculty preference integration** — Time slot preferences factor into slot scoring
- **Campus map visualization** — Interactive room/building management with DepEd standard colors

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ATLAS Client (React PWA)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard │ │ Schedule │ │  Faculty │ │   Map    │ │ Subjects │  │
│  │          │ │  Review  │ │Preferences│ │  Editor  │ │   CRUD   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP REST (/api/v1/...)
┌───────────────────────────────┼─────────────────────────────────────┐
│                         ATLAS Server (Express)                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        Controllers (thin)                      │  │
│  │   auth │ subjects │ faculty │ generation │ map │ preferences   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        Services Layer                          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │  │
│  │  │  Generation     │  │  Constraint     │  │  Manual Edit  │  │  │
│  │  │  Service        │  │  Validator      │  │  Service      │  │  │
│  │  └─────────────────┘  └─────────────────┘  └───────────────┘  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │  │
│  │  │  Schedule       │  │  Faculty        │  │  Fix          │  │  │
│  │  │  Constructor    │  │  Adapter        │  │  Suggestions  │  │  │
│  │  └─────────────────┘  └─────────────────┘  └───────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Prisma ORM
┌───────────────────────────────┼─────────────────────────────────────┐
│                          PostgreSQL                                  │
│   Schools │ Buildings │ Rooms │ Subjects │ FacultyMirror │ Runs     │
└─────────────────────────────────────────────────────────────────────┘
```

### Microservice Boundaries

- ATLAS is an **isolated microservice** — never shares database with other services
- External dependencies:
  - **EnrollPro** — Source of faculty records (via swappable adapter)
  - **Sections** — Student sections from EnrollPro (via adapter)
- Public endpoints expose subjects and published schedules for downstream consumers

---

## Data Model

### Core Entities

| Model | Purpose | Key Search Keyword |
|-------|---------|-------------------|
| `School` | Multi-school root | `model School` |
| `Building` | Campus structures | `model Building` |
| `Room` | Teaching/non-teaching spaces | `model Room`, `RoomType` |
| `Subject` | DepEd learning areas | `model Subject` |
| `FacultyMirror` | Local faculty cache | `model FacultyMirror` |
| `FacultySubject` | Teacher-subject qualifications | `model FacultySubject` |
| `FacultyPreference` | Time slot preferences | `model FacultyPreference` |
| `SchedulingPolicy` | Algorithm config | `model SchedulingPolicy` |
| `GenerationRun` | Schedule attempt | `model GenerationRun` |
| `ManualScheduleEdit` | Manual adjustments | `model ManualScheduleEdit` |

### Enums

```prisma
// Search: "enum RoomType"
enum RoomType {
  CLASSROOM
  LABORATORY
  COMPUTER_LAB
  TLE_WORKSHOP
  LIBRARY
  GYMNASIUM
  FACULTY_ROOM
  OFFICE
  OTHER
}

// Search: "enum DayOfWeek"
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
}

// Search: "enum TimeSlotPreference"
enum TimeSlotPreference {
  PREFERRED
  AVAILABLE
  UNAVAILABLE
}
```

**Schema File:** [prisma/schema.prisma](../prisma/schema.prisma)

---

## Timetable Generation Algorithm

### Overview

ATLAS uses a **deterministic greedy baseline constructor** with constraint validation. The algorithm processes demands in a fixed order (Grade 7→10, Section ID, Subject ID) to ensure reproducible results.

### Algorithm Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. TRIGGER RUN                                                  │
│     POST /api/v1/generation/:schoolId/:schoolYearId/runs        │
│     Search: "triggerGenerationRun"                               │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. DATA COLLECTION                                              │
│     - Sections (from adapter)                                    │
│     - Faculty + FacultySubjects                                  │
│     - Rooms (teaching spaces only)                               │
│     - Subjects with weekly minute requirements                   │
│     - Faculty preferences                                        │
│     - Scheduling policy                                          │
│     Search: "generation.service.ts"                              │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. DEMAND COMPUTATION                                           │
│     For each Section × Subject:                                  │
│       sessionsPerWeek = ⌈minMinutesPerWeek / 50⌉                 │
│     Search: "computeDemand"                                      │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. SLOT CONSTRUCTION                                            │
│     Build time slots: 07:00 – 17:00 (50-min periods)            │
│     Exclude: Lunch window (policy.lunchWindowStart/End)          │
│     Search: "buildPeriodSlots"                                   │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. GREEDY ASSIGNMENT LOOP                                       │
│     For each demand (deterministic order):                       │
│       a) Find qualified faculty (FacultySubject match)           │
│       b) Score candidate slots:                                  │
│          - PREFERRED = 0, AVAILABLE = 1, else +100               │
│          - +10 if same day as existing assignment (day spread)   │
│       c) Check constraints:                                      │
│          - Faculty occupancy (OccupancyTracker)                  │
│          - Consecutive teaching limit                            │
│          - Daily max periods                                     │
│       d) Pick best slot → Find compatible room                   │
│       e) Mark occupancy, update load trackers                    │
│     Search: "constructBaseline", "OccupancyTracker"              │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  6. CONSTRAINT VALIDATION                                        │
│     Run validateHardConstraints() on final draft                 │
│     Search: "validateHardConstraints", "VIOLATION_CODES"         │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  7. PERSIST RESULTS                                              │
│     Status: COMPLETED                                            │
│     Data: draftEntries, violations, summary stats                │
└──────────────────────────────────────────────────────────────────┘
```

### Constraint System

#### Hard Constraints (Publish Blockers)

| Code | Description | Search Keyword |
|------|-------------|----------------|
| `FACULTY_TIME_CONFLICT` | Same teacher double-booked | `FACULTY_TIME_CONFLICT` |
| `ROOM_TIME_CONFLICT` | Same room double-booked | `ROOM_TIME_CONFLICT` |
| `FACULTY_OVERLOAD` | Weekly hours exceeded | `FACULTY_OVERLOAD` |
| `ROOM_TYPE_MISMATCH` | Subject-room incompatibility | `ROOM_TYPE_MISMATCH` |
| `FACULTY_SUBJECT_NOT_QUALIFIED` | Teacher lacks qualification | `FACULTY_SUBJECT_NOT_QUALIFIED` |
| `FACULTY_DAILY_MAX_EXCEEDED` | Daily periods exceeded | `FACULTY_DAILY_MAX_EXCEEDED` |

#### Soft Constraints (Warnings)

| Code | Description | Search Keyword |
|------|-------------|----------------|
| `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` | >4 consecutive periods | `CONSECUTIVE_LIMIT` |
| `FACULTY_BREAK_REQUIREMENT_VIOLATED` | No break within 4 periods | `BREAK_REQUIREMENT` |
| `FACULTY_IDLE_GAP_EXCEEDED` | Large gaps in schedule | `IDLE_GAP` |
| `FACULTY_EARLY_PREFERENCE_VIOLATED` | Early start despite preference | `EARLY_PREFERENCE` |
| `FACULTY_LATE_PREFERENCE_VIOLATED` | Late end despite preference | `LATE_PREFERENCE` |

**Constraint Validator File:** [atlas-server/src/services/constraint-validator.ts](../atlas-server/src/services/constraint-validator.ts)

### Manual Edit Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User drags entry to new slot                                    │
│  Search: "ManualEditPanel", "previewManualEdit"                  │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Preview Request                                                 │
│  POST /api/v1/generation/.../manual-edits/preview               │
│  Returns: validationDelta (before/after violation counts)        │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  User confirms → Commit                                          │
│  POST /api/v1/generation/.../manual-edits/commit                │
│  Uses optimistic locking (version mismatch → conflict error)    │
│  Search: "commitManualEdit", "optimistic lock"                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/subjects` | List all subjects |
| GET | `/api/v1/subjects/:id` | Get subject details |
| GET | `/api/v1/schools/:schoolId/schedules/published` | Published schedules |

### Protected Endpoints (Officer)

| Method | Endpoint | Description | Search Keyword |
|--------|----------|-------------|----------------|
| POST | `/api/v1/generation/:schoolId/:schoolYearId/runs` | Trigger generation | `triggerGenerationRun` |
| GET | `/api/v1/generation/:schoolId/:schoolYearId/runs/latest` | Latest run | `getLatestRun` |
| GET | `.../latest/violations` | Run violations | `getRunViolations` |
| GET | `.../latest/draft` | Draft entries | `getRunDraft` |
| POST | `.../manual-edits/preview` | Preview edit | `previewManualEdit` |
| POST | `.../manual-edits/commit` | Commit edit | `commitManualEdit` |
| POST | `.../fix-suggestions` | Get AI suggestions | `getFixSuggestions` |
| GET/PUT | `/api/v1/policies/scheduling/:schoolId/:schoolYearId` | Policy config | `scheduling-policy` |

### Route Files

| Route Prefix | File | Search Keyword |
|--------------|------|----------------|
| `/auth` | [auth.router.ts](../atlas-server/src/routes/auth.router.ts) | `authRouter` |
| `/subjects` | [subject.router.ts](../atlas-server/src/routes/subject.router.ts) | `subjectRouter` |
| `/faculty` | [faculty.router.ts](../atlas-server/src/routes/faculty.router.ts) | `facultyRouter` |
| `/generation` | [generation.router.ts](../atlas-server/src/routes/generation.router.ts) | `generationRouter` |
| `/map` | [map.router.ts](../atlas-server/src/routes/map.router.ts) | `mapRouter` |
| `/preferences` | [preference.router.ts](../atlas-server/src/routes/preference.router.ts) | `preferenceRouter` |

---

## Frontend Structure

### Pages

| Page | Route | Purpose | Search Keyword |
|------|-------|---------|----------------|
| Dashboard | `/` | Campus map, setup checklist | `Dashboard.tsx` |
| Schedule Review | `/timetable` | Violations, manual edits | `ScheduleReview.tsx` |
| Faculty Assignments | `/assignments` | Teaching load management | `FacultyAssignments.tsx` |
| Map Editor | `/map` | Building/room CRUD | `MapEditor.tsx` |
| Room Schedules | `/room-schedules` | Room utilization | `RoomSchedules.tsx` |
| Subjects | `/subjects` | Subject CRUD | `Subjects.tsx` |
| Faculty | `/faculty` | Faculty sync | `Faculty.tsx` |
| Officer Preferences | `/faculty/preferences` | Preference monitoring | `OfficerPreferences.tsx` |
| My Preferences | `/my/preferences` | Faculty self-service | `FacultyPreferences.tsx` |
| How It Works | `/timetabling/how-it-works` | Algorithm explainer | `HowItWorks.tsx` |

### Key Components

| Component | Purpose | Search Keyword |
|-----------|---------|----------------|
| AppShell | Sidebar navigation | `AppShell.tsx` |
| SchedulingPolicyPane | Policy config UI | `SchedulingPolicyPane.tsx` |
| ManualEditPanel | Drag-drop editor | `ManualEditPanel.tsx` |
| ExplainabilityDrawer | Fix suggestions UI | `ExplainabilityDrawer.tsx` |
| ConflictInspectorSheet | Violation details | `ConflictInspectorSheet.tsx` |
| BuildingView | 2D building render | `BuildingView.tsx`, `DEPED_COLORS` |
| CampusMapEditor | Map canvas | `CampusMapEditor.tsx` |
| RoomScheduleOverlay | Room time grid | `RoomScheduleOverlay.tsx` |
| TutorialOverlay | Onboarding hints | `TutorialOverlay.tsx` |
| PolicyImpactSummary | Edit delta preview | `PolicyImpactSummary.tsx` |

### Type Definitions

**File:** [atlas-client/src/types.ts](../atlas-client/src/types.ts)

Key types to search:
- `Building`, `Room`, `RoomType`
- `Subject`, `FacultyMirror`, `FacultySubject`
- `ScheduledEntry`, `Violation`, `ViolationCode`
- `UnassignedItem`, `UnassignedReason`
- `FixSuggestion`, `FixSuggestionsResponse`
- `TimeSlotPreference`, `PreferenceStatus`

---

## Key Source Code Reference

### Server — Core Algorithm

| File | Purpose | Key Functions |
|------|---------|---------------|
| [generation.service.ts](../atlas-server/src/services/generation.service.ts) | Run orchestration | `triggerGenerationRun`, `getLatestRun` |
| [schedule-constructor.ts](../atlas-server/src/services/schedule-constructor.ts) | Greedy algorithm | `constructBaseline`, `computeDemand`, `OccupancyTracker` |
| [constraint-validator.ts](../atlas-server/src/services/constraint-validator.ts) | Validation engine | `validateHardConstraints`, `VIOLATION_CODES` |
| [manual-edit.service.ts](../atlas-server/src/services/manual-edit.service.ts) | Manual edits | `previewManualEdit`, `commitManualEdit` |
| [fix-suggestions.service.ts](../atlas-server/src/services/fix-suggestions.service.ts) | AI suggestions | `getFixSuggestions` |
| [scheduling-policy.service.ts](../atlas-server/src/services/scheduling-policy.service.ts) | Policy config | `getOrCreatePolicy`, `POLICY_DEFAULTS` |

### Server — Adapters (Integration Points)

| File | Purpose | Key Functions |
|------|---------|---------------|
| [faculty-adapter.ts](../atlas-server/src/services/faculty-adapter.ts) | Faculty source | `fetchFacultyFromEnrollPro` |
| [section-adapter.ts](../atlas-server/src/services/section-adapter.ts) | Section source | `fetchSectionsFromEnrollPro` |

### Client — Schedule Review

| File | Purpose | Key Functions |
|------|---------|---------------|
| [ScheduleReview.tsx](../atlas-client/src/pages/ScheduleReview.tsx) | Main review page | ~2900 lines, violations tab, unassigned tab, timetable grid |
| [ManualEditPanel.tsx](../atlas-client/src/components/ManualEditPanel.tsx) | Edit forms | Room/faculty/timeslot selection |
| [ExplainabilityDrawer.tsx](../atlas-client/src/components/ExplainabilityDrawer.tsx) | Fix display | Violation/unassigned explanations |

### Client — Campus Map

| File | Purpose | Key Functions |
|------|---------|---------------|
| [BuildingView.tsx](../atlas-client/src/components/BuildingView.tsx) | 2D render | `DEPED_COLORS`, room visualization |
| [CampusMapEditor.tsx](../atlas-client/src/components/CampusMapEditor.tsx) | Map canvas | Building placement/rotation |
| [BuildingPanel.tsx](../atlas-client/src/components/BuildingPanel.tsx) | Side panel | Room CRUD |

---

## Viewing the Database Schema

### Option 1: Prisma Studio (Recommended)

```bash
cd d:\ATLAS
npx prisma studio
```

Opens a browser UI at `http://localhost:5555` with:
- Visual table browser
- Record inspection/editing
- Relationship navigation

### Option 2: Prisma ERD Visualizers

Several ERD generators work with Prisma:

1. **prisma-erd-generator** — Generates SVG/PNG diagrams
   ```bash
   npm install -D prisma-erd-generator @mermaid-js/mermaid-cli
   # Add to schema.prisma:
   # generator erd {
   #   provider = "prisma-erd-generator"
   # }
   npx prisma generate
   ```

2. **Prisma Editor (VS Code Extension)** — Real-time schema visualization

3. **prismaliser.app** — Online schema visualizer (paste schema.prisma content)

### Option 3: PGAdmin

For direct PostgreSQL access:

1. Connect to your database in PGAdmin
2. Navigate to: Server → Database → Schemas → public → Tables
3. Right-click any table → ERD For Database (requires pgAdmin 4.20+)

### Option 4: Direct Schema Inspection

```bash
# View raw schema
cat prisma/schema.prisma

# After generation, view SQL
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

---

## Phase Plan & Status

| Phase | Status | Description | Key Deliverables |
|-------|--------|-------------|------------------|
| **Phase 0** | ✅ Complete | Platform foundation | Core CRUD, auth, map |
| **Phase 1** | ✅ Complete | Setup completion | Readiness checklist, subjects |
| **Phase 2** | ✅ Complete | Preference collection | Faculty preferences, reminders |
| **Phase 3** | ✅ Complete | Schedule generation | Algorithm, constraint validation |
| **Phase 4** | 🔄 In Progress | Review & adjustment | Manual edits, fix suggestions |
| **Phase 5** | Not Started | Publish & dissemination | Public schedules, notifications |
| **Phase 6** | Not Started | Exceptions & archive | Substitutes, absence handling |

**Phase Plan File:** [phasePlan.md](../phasePlan.md)

---

## Search Keyword Index

For quick code navigation, search these keywords:

| Keyword | What You'll Find |
|---------|------------------|
| `constructBaseline` | Greedy algorithm entry point |
| `OccupancyTracker` | Slot occupancy management |
| `VIOLATION_CODES` | All constraint code definitions |
| `validateHardConstraints` | Constraint validation entry |
| `triggerGenerationRun` | Run orchestration |
| `previewManualEdit` | Edit preview logic |
| `getFixSuggestions` | AI fix suggestion logic |
| `DEPED_COLORS` | Building color constants |
| `ViolationGroup` | Violations UI component |
| `TimetableGrid` | Schedule grid renderer |
| `SearchableSelect` | Grouped combo-box |
| `POLICY_DEFAULTS` | Default algorithm config |

---

## Commit Message

```
docs(system): add comprehensive SYSTEM-OVERVIEW.md with algorithm, API, and code reference

- Document greedy baseline construction algorithm with flow diagram
- List all hard/soft constraints with search keywords
- Map API routes to service functions
- Index key source files with search keywords
- Add database schema viewing options (Prisma Studio, ERD, PGAdmin)
- Include phase plan status table
```
