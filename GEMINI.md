# A.T.L.A.S. (Automated Timetabling and Locations Allocation System)

ATLAS is a Progressive Web Application (PWA) designed for automated academic schedule generation in Philippine Junior High Schools (Grades 7–10). It follows DepEd DO 010 s.2024 standards.

## Tech Stack
- **Client:** React 19 (Vite 8), Tailwind CSS 4, shadcn/ui, Framer Motion, Konva.js, Radix UI.
- **Server:** Node.js (Express 5), TypeScript 5.9+, tsx.
- **Database:** PostgreSQL 16, Prisma 6.
- **Testing:** Playwright 1.59+, integration tests in `src/__tests__`.

## Directory Structure
- `atlas-client/`: React PWA frontend.
  - `src/components/`: Reusable UI components.
  - `src/pages/`: Page views.
  - `src/hooks/`: Business logic and state (e.g., `useTimetableData`, `useTimetableMutations`).
- `atlas-server/`: Express API backend.
  - `src/routes/`: REST endpoints (`*.router.ts`).
  - `src/services/`: Core logic (`*.service.ts`).
  - `src/middleware/`: Auth, authz, and error handling.
  - `src/scripts/`: Seeding and verification tools.
- `prisma/`: Shared database schema (`schema.prisma`) and migrations.
- `EnrollPro/`: Integrated student management system (Sub-project).
- `mcp-servers/`: Specialized agents for file processing (Excel, Word, PDF).
- `docs/`: Project documentation and phase plans.
- `qa-artifacts/`: QA reports, screenshots, and Playwright test specs.

## Development Conventions
- **Naming:**
  - Logic/Router files: `kebab-case.ts`.
  - React components: `PascalCase.tsx`.
  - API endpoints: `/api/v1/` prefix.
- **Backend Pattern:** Router -> Service -> Prisma.
- **Frontend Pattern:** Custom Hooks for data fetching and mutations.
- **Database:** All changes via `prisma/schema.prisma`. Output client to `atlas-server/node_modules/.prisma/client`.
- **Testing:** 
  - Backend integration tests use `tsx` to run individual test files.
  - Frontend/E2E tests via Playwright in `qa-artifacts/`.

## Common Commands
- `npm run dev`: Starts both client and server.
- `npm run db:bootstrap`: Generates Prisma client and runs migrations.
- `npm run db:seed`: Seeds the database with demo data.
- `npm run test:visual`: Runs Playwright visual regression tests.
- `npm run verify:enrollpro-source`: Validates integration with EnrollPro.

## Integration with EnrollPro
ATLAS can run in `stub` mode (mock data) or `enrollpro` mode (live integration). Integration requires matching `JWT_SECRET` values between both systems to validate bridge tokens.

