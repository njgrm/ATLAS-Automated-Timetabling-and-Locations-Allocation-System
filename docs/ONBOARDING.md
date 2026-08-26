# Onboarding Guide: A.T.L.A.S.

## Overview
A.T.L.A.S. (Automated Timetabling and Locations Allocation System) is a Progressive Web Application (PWA) built to automate academic scheduling for Philippine Junior High Schools (Grades 7–10), adhering to DepEd DO 010 s.2024 standards.

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x / 6.x |
| Frontend | React (Vite) | 19.x |
| Backend | Node.js (Express) | 5.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 6.x |
| Testing | Playwright | 1.59.x |
| Styling | Tailwind CSS | 4.x |

## Architecture
ATLAS follows a classic Client-Server architecture with a shared database.

- **Frontend (`atlas-client/`)**: React-based PWA using Vite for bundling and shadcn/ui for components. Business logic is encapsulated in custom hooks.
- **Backend (`atlas-server/`)**: Express API with a service-oriented architecture. Logic is contained in `src/services/` and exposed via `src/routes/`.
- **Database (`prisma/`)**: Managed via Prisma. The schema is the source of truth for the data model.
- **Integration**: Bridges with **EnrollPro** for faculty and section data via specific adapters.

## Key Entry Points
- **Client**: `atlas-client/src/main.tsx` — App initialization.
- **Server**: `atlas-server/src/server.ts` — Server entry point.
- **Routing (Client)**: `atlas-client/src/App.tsx` — React Router configuration.
- **Routing (Server)**: `atlas-server/src/app.ts` — Express route registration.
- **Database**: `prisma/schema.prisma` — Core data model.

## Directory Map
- `atlas-client/src/components/` → Reusable UI components.
- `atlas-client/src/pages/` → Top-level page components.
- `atlas-client/src/hooks/` → Core frontend business logic and state management.
- `atlas-server/src/routes/` → REST API endpoints.
- `atlas-server/src/services/` → Core business logic (scheduling, validation, sync).
- `atlas-server/src/middleware/` → Auth and error handling.
- `EnrollPro/` → Integrated sub-project (Student Management).
- `mcp-servers/` → Specialized agents for file processing (Excel, Word, PDF).

## Request Lifecycle (Example)
1.  **UI**: User clicks "Sync Faculty".
2.  **Client**: `useTimetableMutations.ts` calls `POST /api/v1/faculty/sync`.
3.  **Router**: `atlas-server/src/routes/faculty.router.ts` validates parameters.
4.  **Service**: `atlas-server/src/services/faculty.service.ts` coordinates with `faculty-adapter.ts`.
5.  **Adapter**: Fetches data from EnrollPro or a stub.
6.  **Persistence**: `FacultySnapshot` is updated via Prisma.
7.  **Response**: JSON result returned to client.

## Conventions
- **Naming**: `kebab-case.ts` for logic/routers, `PascalCase.tsx` for components.
- **API**: Versioned REST endpoints (`/api/v1/...`).
- **Logic**: Prefer Services in the backend and Hooks in the frontend.
- **Styling**: Tailwind CSS 4 with DepEd-standard colors (G7=Green, G8=Yellow, G9=Red, G10=Blue).

## Common Tasks
- **Start Dev Environment**: `npm run dev` (from root).
- **Update Database**: `npm run db:bootstrap` or `npx prisma migrate dev`.
- **Run Visual Tests**: `npm run test:visual`.
- **Seed Data**: `npm run db:seed`.

## Where to Look
| I want to... | Look at... |
|--------------|-----------|
| Add an API endpoint | `atlas-server/src/routes/` |
| Add business logic | `atlas-server/src/services/` |
| Add a UI component | `atlas-client/src/components/` |
| Add a page | `atlas-client/src/pages/` and `App.tsx` |
| Modify data model | `prisma/schema.prisma` |
| Change scheduling rules | `atlas-server/src/services/constraint-validator.ts` |
