---
applyTo: "{src/components/**/*,src/pages/**/*}"
---

# Frontend Instructions (React PWA)

## MVC View Layer Scope
- Treat this layer as View in strict MVC.
- Keep business rules in backend services; frontend orchestrates presentation and user interactions.
- Consume versioned REST endpoints under `/api/v1/...` only.

## Platform and UX Scope
- Build a single mobile-responsive web app, not a native mobile app.
- Prioritize Android smartphone browser usability while remaining functional on desktop.
- Keep students unauthenticated and public schedule lookup simple and fast.

## Role-Based Experience
- Scheduling Officer: admin portal with setup, review, adjustments, and publish workflows.
- Teacher/Faculty: authenticated portal for preference submission and personal schedule viewing.
- Student/Public: view-only section schedule pages with no login.

## Manual QA Login (Direct ATLAS Protected Pages)
- For QA on authenticated ATLAS routes in this phase, login directly in ATLAS first.
- Local runtime prerequisites:
  - ATLAS running (`npm run dev`)
- Direct QA credentials:
  - Admin: `admin@deped.edu.ph` / `Incorrect_404`
  - Faculty: `maria.santos@deped.edu.ph` / `DepEd2026!`
- EnrollPro bridge-auth remains optional for integration-only checks and is not required baseline evidence for protected-page QA in this pass.

## Lifecycle-Aware UI
- Reflect enforced phase order in UI controls.
- Disable or hide actions that violate current lifecycle state.
- Display hard-constraint issues as blocking in Review.
- Display soft-constraint issues as warnings.

## Offline-First UI Behavior
- Use service-worker-backed caching for app shell and previously viewed schedules.
- Queue offline writes (preferences, adjustments) and show sync status.
- On sync validation failure, show actionable error messaging and resubmission path.
- Clearly indicate features requiring active connection (generation, receiving published updates).

## Frontend Priority Realignment (2026-05-07)
- Shift frontend work away from non-critical timetable UX polish.
- Implement objective-critical frontend slices in this order:
  1. Standalone ATLAS login experience for faculty (mobile-first).
  2. PWA baseline wiring (manifest registration, installability, offline shell indicators).
  3. Generated-view parity blockers only (functional issues, not cosmetic-only tweaks).
  4. Faculty published schedule page (`/my/schedule`).
  5. Student/public published schedule pages.
- Unless it is a blocker, defer additional timetable polish tasks until the objective-critical slices above are completed.

## PWA Guidance (Context7-aligned)
- Prefer a managed PWA setup that supports explicit service worker strategy control.
- Use cache strategies intentionally:
  - static assets: stale-while-revalidate or cache-first as appropriate
  - schedule API reads: network-first with fallback for previously viewed data
- Ensure service worker update behavior is explicit (prompted or auto-update policy).
- Avoid over-caching sensitive authenticated responses.

## UI Skill Requirement
- For all frontend design and component generation tasks, apply the 21st Dev skill in `.github/skills/atlas-21st-dev-frontend/SKILL.md`.
- For any faculty-facing page or component (`/my/*`, `FacultyPreferences`, `FacultyRoomPreferences`, `MyDashboard`, `AppShell` faculty path), **also** apply the mobile faculty UX skill in `.github/skills/atlas-mobile-faculty-ux/SKILL.md` before generating code.
- For non-trivial UI implementation, also apply:
  - `.github/skills/atlas-design-system-enforcer/SKILL.md`
  - `.github/skills/atlas-ux-audit-gate/SKILL.md`
  - `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- For faculty-focused UX hardening, also apply:
  - `.github/skills/atlas-faculty-usability-first/SKILL.md`
- For manual browser QA runs, also apply:
  - `.github/skills/atlas-shared-browser-qa/SKILL.md`
- For offline/realtime behavior changes, also apply:
  - `.github/skills/atlas-offline-realtime-reliability/SKILL.md`
- For UX/UI decisions and implementation prompts, **always** reference:
  - `docs/DESIGN.md`
  - `docs/DESIGN-INSPIRATION.md`
  - `docs/phases/faculty-mobile-wireframe-spec.md` (faculty surfaces)

## Context7 Preflight (Mandatory)
- Before non-trivial UI/realtime/offline/accessibility implementation:
  - resolve library IDs,
  - pull 2-3 relevant docs,
  - cite applied pattern in prompt output.
- Use `docs/context7-library-map.md` for approved sources.
- Timetable panel work must cite:
  - `react-resizable-panels` for dynamic `Panel` sizing (`minSize`, `maxSize`, `defaultSize`, `onResize`, imperative `resize()`).
  - Radix `ScrollArea` for native keyboard/touch scrolling in localized panel viewports.

## Manual shared-browser QA (frontend)
- Before judging UX in a browser, read `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, and `docs/context7-library-map.md`.
- Use Context7 when verifying Sheet/Dialog, ScrollArea, motion, or a11y against current docs.
- Faculty gates: `docs/prompts/faculty-ux-expert-hardening-pass.md`; run `npm run test:visual:faculty` for faculty route screenshots.

## Campus Map UI Rules
- Implement two explicit modes:
  - Editor mode: Scheduling Officer only.
  - View mode: Faculty + Public read-only.
- Editor mode behavior:
  - Render uploaded campus image as static map background.
  - Use `react-konva` to draw and label building rectangles.
  - Open a BuildingPanel sidebar for building/room management: room name, floor, type (`classroom`, `laboratory`, `computer_lab`), capacity.
  - Use `react-zoom-pan-pinch` for map pan/zoom interactions.
- View mode behavior:
  - Render same map and building overlays without edit affordances.
  - Overlay published schedule occupancy for current time slot.
  - Allow building/room click to inspect assigned class details only.
  - No editing and no drag-and-drop scheduling.

## Konva and 21st Dev Boundary
- Konva canvas is a controlled exception to 21st Dev component usage.
- Use 21st Dev for surrounding UI only (sidebar, forms, modals, controls).
- Never render 21st Dev components inside the Konva Stage tree.

## Map Data Contract
- Persist and consume map data per school:
  - `campus_image_url` (cloud storage URL)
  - `buildings` JSON column with shape data and nested rooms
- Always scope map CRUD and fetch operations by `school_id`.

## State and Data Handling
- Keep server state and UI state clearly separated.
- Handle optimistic locking conflicts with clear reload/retry UX.
- Keep forms resilient to refresh and offline transitions where feasible.
- Make edits directly in the target source files; do not create Python/Node script files to mass-edit frontend code.

## Accessibility and Clarity
- Maintain keyboard navigability and sufficient contrast.
- Use clear labels for schedule statuses, conflicts, and sync state.
- Ensure touch targets are mobile-friendly.

## Framer Motion + React Router v6 Transitions
- Never use `<Outlet />` directly inside `<AnimatePresence mode="wait">`. React Router's `<Outlet />` dynamically reads the new location context on every render, including during the exit animation of the old route, causing the old route's `Suspense` boundary to flash the new route's fallback (the "blinking bug").
- Freeze the route output by capturing `useOutlet()` at the layout shell level and rendering `{outlet}` instead of `<Outlet />`.
- Reference: `src/components/AppShell.tsx` uses `const outlet = useOutlet()` combined with `React.cloneElement(outlet, { ... })`. Do not disturb this setup.

## UI Components & Design System Enforcement
- Always use existing Shadcn components from `@/ui` (e.g. `<Select>`, `<DropdownMenu>`, `<Badge>`, `<Button>`). Do not reinvent standard inputs.
- Native `<select>` and generic `<button className="...">` are banned. Route all inputs through UI library tokens to align with EnrollPro's design.
- Use `motion/react` (framer-motion) for new route structures and overlays. Do not write hand-rolled CSS animations via `className`.
- Respect existing container rules: `AppLayout` dimensions, `overflow-hidden` constraints, and localized `h-[calc(100svh-3.5rem)] flex-col` root with `flex-1 min-h-0 overflow-auto` for main scrolling regions to prevent global browser scrollbars.
- **Timetable Panel Reflow Contract:** Left rail, right detail panel, task drawer, policy pane, and unresolved-session panels must never allow text overlap at any supported width. Use viewport-aware `ResizablePanel` min/default/max contracts, compact/icon/stacked states before content becomes unreadable, `min-w-0`, wrapping for instructional text, truncation only for secondary labels, and one primary local scroll region per panel.
- **Unresolved Session Navigation:** Timetable unresolved/unassigned panels must be search-first, filterable, keyboard-scrollable, and tappable. Long explanations and diagnostics stay behind explicit detail actions; the collapsed row must show the next safe action without misleading labels.
- **NO HUGE CARDS FOR METRICS:** Always display layout metrics (e.g., Utilization, Projected Load) within a compact single-row `Inline Stat Banner` alongside the toolbar.
- **DepEd Color Codes:** Map explicitly to tokens for Grades (G7 = Green, G8 = Yellow, G9 = Red, G10 = Blue).
- **Tooltips/Details:** For extra breakdowns/info, never use raw `<details>` or `title` attributes. Strictly use `shadcn/ui` based `<HoverCard>`, `<Tooltip>`, or `<Popover>`.
- **File Size & Component Extraction Rule (MANDATORY):** No single React component file shall exceed 1000 lines of code. If a file approaches this limit, stop feature development and immediately extract logical sub-components (for example: sidebars, modals, forms, grids) into a sibling `components/` subdirectory.

## Dependencies
- Icons: `lucide-react` only. No other icon library.
- Use installed helpers (`class-variance-authority`, `clsx`, `tailwind-merge`) for complex variant strings. Do not write inline className concatenations.
