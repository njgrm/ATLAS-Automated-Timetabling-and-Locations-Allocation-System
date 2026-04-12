# A.T.L.A.S.

> **Automated Timetabling and Locations Allocation System**

A Progressive Web Application (PWA) for automated academic schedule generation designed for Philippine Junior High Schools (Grades 7–10). Built on the PERN stack with full compliance to DepEd DO 010 s.2024.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Timetabling Algorithm](#timetabling-algorithm)
- [Installation Guide](#installation-guide)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Public API Endpoints](#public-api-endpoints)
- [Integration with EnrollPro](#integration-with-enrollpro)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

---

## Features

### Core Capabilities

- **🏫 Multi-School Support** — School-agnostic design with configurable policies per school
- **📅 Automated Schedule Generation** — Constraint-aware timetabling with greedy baseline algorithm
- **✏️ Manual Adjustment Workflow** — Drag-and-drop edits with real-time violation preview
- **👨‍🏫 Faculty Preference Integration** — Time slot preferences factor into slot scoring
- **🗺️ Interactive Campus Map** — Building/room management with DepEd standard colors
- **📱 PWA Support** — Offline-first with service worker caching
- **🔌 Public API** — REST endpoints for downstream system integration

### DepEd Compliance

- 8 JHS Learning Areas + Homeroom Guidance
- Minimum weekly minutes per DO 010 s.2024
- Standard 50-minute period duration
- Grade-level color coding (G7=Green, G8=Yellow, G9=Red, G10=Blue)

### Constraint System

| Type | Purpose |
|------|---------|
| **Hard Constraints** | Must be resolved before publishing (zero-tolerance) |
| **Soft Constraints** | Generate warnings but allow publishing |

**Hard Constraints:**
- Faculty time conflicts (double-booking)
- Room time conflicts
- Faculty overload (weekly hours)
- Room type mismatch
- Faculty-subject qualification
- Daily max periods exceeded

**Soft Constraints:**
- Consecutive teaching limit (>4 periods)
- Break requirements
- Idle gap optimization
- Early/late preference violations
- Travel/wellbeing checks

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ATLAS Client (React PWA)                      │
│                        Port 5174 (Vite Dev)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard │ │ Schedule │ │ Teaching │ │   Map    │ │ Subjects │  │
│  │          │ │  Review  │ │   Load   │ │  Editor  │ │   CRUD   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP REST (/api/v1/...)
┌───────────────────────────────┼─────────────────────────────────────┐
│                       ATLAS Server (Express)                        │
│                           Port 5001                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Controllers (thin)                         │  │
│  │  auth │ subjects │ faculty │ generation │ map │ preferences   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Services Layer                            │  │
│  │  Generation │ Constraint Validator │ Manual Edit │ Adapters   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Prisma ORM
┌───────────────────────────────┴─────────────────────────────────────┐
│                          PostgreSQL                                  │
│  Schools │ Buildings │ Rooms │ Subjects │ Faculty │ GenerationRuns  │
└─────────────────────────────────────────────────────────────────────┘
          ▲                                           │
          │ Swappable Adapter                         │ Public API
          ▼                                           ▼
┌─────────────────────┐                   ┌─────────────────────────┐
│     EnrollPro       │                   │   Downstream Systems    │
│  (Faculty/Sections) │                   │   (Your Integration)    │
└─────────────────────┘                   └─────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Express 5, TypeScript, Node.js |
| Database | PostgreSQL 16, Prisma 6 ORM |
| Canvas | Konva.js, react-konva |
| State | React Query (planned), Context API |
| Auth | JWT |

---

## Timetabling Algorithm

ATLAS uses a **deterministic greedy baseline constructor** with constraint validation. The algorithm processes demands in a fixed order to ensure reproducible results.

### Algorithm Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  1. TRIGGER                                                      │
│     Officer clicks "Generate Schedule"                          │
│     POST /api/v1/generation/:schoolId/:schoolYearId/runs        │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. DATA COLLECTION                                              │
│     • Sections (from EnrollPro/stub adapter)                    │
│     • Faculty + qualifications (FacultySubject mappings)        │
│     • Rooms (teaching spaces with types and capacities)         │
│     • Subjects (8 JHS + custom, with weekly minute requirements)│
│     • Faculty preferences (time slot preferences per faculty)   │
│     • Scheduling policy (algorithm configuration)               │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. DEMAND COMPUTATION                                           │
│     For each Section × Subject pair:                            │
│       sessionsPerWeek = ⌈minMinutesPerWeek / 50⌉                │
│                                                                  │
│     Example: Math requires 250 min/week → 5 sessions/week       │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. TIME SLOT CONSTRUCTION                                       │
│     Build available periods: 07:00 – 17:00 (50-min each)        │
│     Exclude lunch window from policy (e.g., 12:00–13:00)        │
│     Result: ~10 periods × 5 days = 50 slots per week            │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. GREEDY ASSIGNMENT LOOP                                       │
│     Process in deterministic order: Grade 7→10, Section ID,     │
│     Subject ID                                                   │
│                                                                  │
│     For each demand item:                                        │
│       a) Find qualified faculty (FacultySubject match)          │
│       b) Score candidate slots:                                  │
│          • PREFERRED preference = 0 points                       │
│          • AVAILABLE preference = 1 point                        │
│          • Other = +100 points (penalty)                         │
│          • Same day as existing = +10 points (spread penalty)   │
│       c) Check constraints during placement:                     │
│          • Faculty occupancy (not double-booked)                │
│          • Consecutive teaching limit (≤4 periods)              │
│          • Daily max periods                                     │
│       d) Pick lowest-score slot → Find compatible room          │
│       e) Mark occupancy, update load trackers                   │
│                                                                  │
│     If no valid placement: add to unassignedItems[]             │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. CONSTRAINT VALIDATION                                        │
│     Run validateHardConstraints() on complete draft             │
│     Generate violations[] with codes, messages, affected IDs    │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. PERSIST & RESPOND                                            │
│     Save GenerationRun with:                                    │
│       • status: COMPLETED                                        │
│       • draftEntries: JSON array of scheduled entries           │
│       • violations: JSON array of constraint violations         │
│       • summary: { classesProcessed, unassignedCount, ... }     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Algorithm Components

| Component | File | Purpose |
|-----------|------|---------|
| `constructBaseline()` | `atlas-server/src/services/schedule-constructor.ts` | Main greedy algorithm |
| `OccupancyTracker` | `atlas-server/src/services/schedule-constructor.ts` | Slot availability tracking |
| `validateHardConstraints()` | `atlas-server/src/services/constraint-validator.ts` | Post-generation validation |
| `VIOLATION_CODES` | `atlas-server/src/services/constraint-validator.ts` | All 16 constraint definitions |

### Post-Generation Workflow

1. **Review** — Officer views draft with violations highlighted
2. **Manual Edits** — Drag-and-drop with preview showing violation delta
3. **Fix Suggestions** — AI-powered actionable remediation hints
4. **Publish** — Only allowed when `hardViolationCount === 0`

---

## Installation Guide

### Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | ≥ 18.x | `node --version` |
| npm | ≥ 9.x | `npm --version` |
| PostgreSQL | ≥ 14.x | `psql --version` |
| Git | Any | `git --version` |

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/atlas.git
cd atlas
```

### Step 2: Install Dependencies

```bash
# Install root dependencies (includes concurrently for dev scripts)
npm install

# Install server dependencies
cd atlas-server
npm install
cd ..

# Install client dependencies
cd atlas-client
npm install
cd ..
```

### Step 3: Set Up PostgreSQL Database

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database and user
CREATE DATABASE atlas_db;
CREATE USER atlas_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE atlas_db TO atlas_user;

-- Grant schema permissions (PostgreSQL 15+)
\c atlas_db
GRANT ALL ON SCHEMA public TO atlas_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO atlas_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO atlas_user;

\q
```

### Step 4: Configure Environment Variables

```bash
# Copy example environment files
cp .env.example .env
cp atlas-server/.env.example atlas-server/.env
cp atlas-client/.env.example atlas-client/.env
```

Edit each `.env` file with your configuration (see [Environment Configuration](#environment-configuration)).

### Step 5: Initialize Database Schema

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed default data
npm run db:seed
```

### Step 6: Start the Application

```bash
# Development mode (both server and client)
npm run dev

# Or start individually:
npm run dev:server  # Express server on port 5001
npm run dev:client  # Vite dev server on port 5174
```

### Step 7: Access the Application

- **Client:** http://localhost:5174
- **Server API:** http://localhost:5001/api/v1
- **Prisma Studio:** `npm run db:studio` → http://localhost:5555

---

## Environment Configuration

### Root `.env`

```env
# Database connection (used by Prisma)
DATABASE_URL=postgresql://atlas_user:your_password@localhost:5432/atlas_db?schema=public
```

### Server `atlas-server/.env`

```env
# Database
DATABASE_URL=postgresql://atlas_user:your_password@localhost:5432/atlas_db?schema=public

# Authentication
JWT_SECRET="your-random-32-char-minimum-secret-key"

# Server
PORT=5001
CLIENT_URL=http://localhost:5174

# EnrollPro Integration
ENROLLPRO_API=http://localhost:5000/api

# Faculty Adapter Mode
# Options: "stub" (mock data) | "enrollpro" (live integration)
FACULTY_ADAPTER=stub

# Required when FACULTY_ADAPTER=enrollpro
ENROLLPRO_SERVICE_TOKEN=

# Section Source Mode
# Options: "stub" | "enrollpro" | "auto"
SECTION_SOURCE_MODE=stub
```

### Client `atlas-client/.env`

```env
# EnrollPro API for cross-navigation (optional)
VITE_ENROLLPRO_API=http://localhost:5000/api
```

### Adapter Modes Explained

| Mode | `FACULTY_ADAPTER` | `SECTION_SOURCE_MODE` | Use Case |
|------|-------------------|----------------------|----------|
| **Standalone** | `stub` | `stub` | Development without EnrollPro |
| **Integrated** | `enrollpro` | `enrollpro` | Production with EnrollPro |
| **Hybrid** | `stub` | `auto` | Testing with fallback |

---

## Running the Application

### Development

```bash
# Start both client and server with hot reload
npm run dev
```

### Production Build

```bash
# Build server
cd atlas-server
npm run build

# Build client
cd atlas-client
npm run build

# Start production server
cd atlas-server
npm start
```

### Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:push        # Push schema changes (dev only)
npm run db:seed        # Seed default data
npm run db:studio      # Open Prisma Studio
npm run db:bootstrap   # Generate + Migrate (fresh setup)
```

---

## Public API Endpoints

ATLAS exposes REST endpoints for integration with downstream systems. All endpoints are versioned under `/api/v1/`.

### Subject Endpoints (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/subjects` | List all subjects |
| `GET` | `/api/v1/subjects/:id` | Get subject by ID |

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "schoolId": 1,
      "name": "Mathematics",
      "shortCode": "MATH",
      "color": "#3b82f6",
      "minMinutesPerWeek": 250,
      "requiredRoomType": "CLASSROOM",
      "isActive": true
    }
  ]
}
```

### Published Schedule Endpoints (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/schools/:schoolId/schedules/published` | Current term published schedule |
| `GET` | `/api/v1/schools/:schoolId/schedules/published/:termId` | Specific term schedule |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "termId": "2025-2026-1",
    "publishedAt": "2025-08-15T00:00:00.000Z",
    "entries": [
      {
        "entryId": "uuid",
        "sectionId": 1,
        "sectionName": "Grade 7 - Newton",
        "subjectId": 1,
        "subjectName": "Mathematics",
        "facultyId": "uuid",
        "facultyName": "Juan Dela Cruz",
        "roomId": 5,
        "roomName": "Room 101",
        "dayOfWeek": "MONDAY",
        "startTime": "07:00",
        "endTime": "07:50"
      }
    ]
  }
}
```

### Room Schedule Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/room-schedules/:schoolId/:schoolYearId` | Room occupancy data |

### Integration Headers

For authenticated endpoints, include:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Integration with EnrollPro

ATLAS integrates with EnrollPro for faculty and section data through swappable adapters.

### Data Flow

```
EnrollPro                         ATLAS
┌─────────────┐                  ┌─────────────┐
│   Faculty   │ ──── Sync ────▶ │FacultyMirror│
│   Records   │                  │   (cache)   │
└─────────────┘                  └─────────────┘
                                       │
┌─────────────┐                        ▼
│  Sections   │ ──── Fetch ───▶ Generation Run
│  (live)     │    (on demand)
└─────────────┘
```

### Enabling EnrollPro Integration

1. **Start EnrollPro** on port 5000
2. **Generate Service Token** in EnrollPro with `SYSTEM_ADMIN` role
3. **Configure ATLAS:**

```env
# atlas-server/.env
ENROLLPRO_API=http://localhost:5000/api
FACULTY_ADAPTER=enrollpro
ENROLLPRO_SERVICE_TOKEN=your_enrollpro_jwt_token
SECTION_SOURCE_MODE=enrollpro
```

4. **Sync Faculty:**
   - Navigate to Faculty page in ATLAS
   - Click "Sync from EnrollPro"

### Stub Mode (Standalone)

For development without EnrollPro:

```env
FACULTY_ADAPTER=stub
SECTION_SOURCE_MODE=stub
```

Stub mode provides:
- 10 mock faculty members
- 10 sections (2–3 per grade level)
- 334 total enrolled students

---

## Project Structure

```
atlas/
├── atlas-client/               # React PWA frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route-level pages
│   │   ├── hooks/              # Custom React hooks
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── lib/                # Utilities
│   │   └── types.ts            # TypeScript definitions
│   └── package.json
│
├── atlas-server/               # Express API backend
│   ├── src/
│   │   ├── routes/             # Express routers
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, error handling
│   │   └── lib/                # Utilities
│   └── package.json
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Migration history
│   └── seed.js                 # Seed data
│
├── docs/
│   ├── SYSTEM-OVERVIEW.md      # Detailed system docs
│   ├── phases/                 # Phase execution docs
│   └── verification/           # Test artifacts
│
├── generated/                  # Prisma generated client
├── package.json                # Root workspace scripts
├── phasePlan.md                # Project phase tracker
└── README.md                   # This file
```

### Key Files Reference

| File | Purpose |
|------|---------|
| `atlas-server/src/services/generation.service.ts` | Run orchestration |
| `atlas-server/src/services/schedule-constructor.ts` | Greedy algorithm |
| `atlas-server/src/services/constraint-validator.ts` | Constraint checks |
| `atlas-server/src/services/manual-edit.service.ts` | Edit preview/commit |
| `atlas-client/src/pages/ScheduleReview.tsx` | Main review UI |
| `atlas-client/src/components/ManualEditPanel.tsx` | Drag-drop editor |
| `atlas-client/src/components/BuildingView.tsx` | 2D building render |

---

## Development

### Code Style

- **TypeScript** strict mode
- **Prisma** naming: Models=PascalCase, fields=camelCase, enums=UPPER_SNAKE_CASE
- **API** versioning: `/api/v1/...`
- **MVC** enforcement: Controllers thin, business logic in services

### Running Tests

```bash
# Type checking
cd atlas-client && npx tsc --noEmit
cd atlas-server && npx tsc --noEmit
```

### Viewing Database Schema

```bash
# Prisma Studio (recommended)
npm run db:studio

# Opens browser at http://localhost:5555
```

### Useful Commands

```bash
# View Prisma schema as SQL
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma

# Reset database (caution: destroys data)
npx prisma migrate reset

# Format Prisma schema
npx prisma format
```

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ | Platform foundation |
| Phase 1 | ✅ | Setup completion |
| Phase 2 | ✅ | Faculty preferences |
| Phase 3 | ✅ | Schedule generation |
| Phase 4 | 🔄 | Review & adjustment |
| Phase 5 | ⏳ | Publish & dissemination |
| Phase 6 | ⏳ | Exceptions & archive |

---

## License

This project is proprietary software. All rights reserved.

---

## Support

For issues and feature requests, please open a GitHub issue or contact the development team.

---

**Built with ❤️ for Philippine Education**
