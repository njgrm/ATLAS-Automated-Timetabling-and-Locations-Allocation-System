# Audit and Specialization Mapping Layout Refactor Plan

## Context
The current implementation of the **Audit** and **Specialization Mapping** pages follows a generic web-page pattern (centered content with `max-w-*`, standard scrolling) rather than the "desktop-first, no-scroll" architecture used in the **Timetable Review** and **Dashboard**. This creates a visual and operational inconsistency within the ATLAS system.

## Concerns to Address
1.  **Centered Layout:** Content is currently constrained to `max-w-6xl` or `max-w-5xl` and centered with `mx-auto`, wasting significant screen real estate on desktop monitors.
2.  **Scrolling Architecture:** These pages use traditional document scrolling instead of fixed-viewport layouts with independent scroll areas for list content.
3.  **Lack of Role-Based UX Separation:** No clear distinction between mobile and desktop views, whereas other critical pages (like Timetable) have optimized interactions for each.
4.  **Double Headers:** The presence of large titles inside the content area conflicts with the `AppShell` breadcrumbs and doesn't match the compact header pattern used in newer workspaces.

## Implementation Strategy

### 1. Architectural Alignment
- **Container:** Adopt `h-[calc(100svh-3.5rem)] flex flex-col overflow-hidden` for the root container of both pages.
- **Header:** Implement a compact sub-header (`PageHeader`) that contains the title, breadcrumb-like context, and primary actions (e.g., Refresh, Add Mapping).
- **Workspace Layout:** Use a multi-panel grid or flex layout:
    - **Left Rail (Fixed Width):** For filters, search, and status summaries.
    - **Center (Fluid):** For the primary data lists/tables using `ScrollArea`.
    - **Right Panel (Optional/Collapsible):** For detailed inspection of an audit finding or mapping rule.

### 2. Audit Page Refactor (`Audit.tsx`)
- **Top Summary:** Move the "Readiness Verdict Banner" and the 4 status cards into a compact summary bar below the header or a pinned left rail.
- **Tabs Integration:** Align the `TabsList` with the sub-header or left rail.
- **Data Tables:** Convert the simple `divide-y` lists into a more robust grid that utilizes the expanded horizontal space, allowing for more columns or clearer metadata (e.g., Department, Grade Level).
- **Mobile View:** Use a mobile-specific layout that collapses the left rail into a filter drawer.

### 3. Specialization Mapping Refactor (`SpecializationMapping.tsx`)
- **Split Workspace:**
    - **Left Rail:** "Quick Resolve Orphaned" and "Add New Mapping" form.
    - **Center Area:** "Active Mappings" list with a clean, full-width grid.
- **Orphaned Terms Banner:** Move the "Unmapped Terms" alert to a fixed-position notice or a dedicated tab in the left rail to reduce vertical shifting.

### 4. Shared UI Components
- Utilize `ScrollArea` for all list containers to maintain the "no-scroll" core.
- Standardize the `PageHeader` across these two pages to match the `ScheduleReviewWorkspaceHeader` vibe.
- Ensure consistent padding (`px-6 py-4`) that aligns with the Dashboard.

## Verification Gates
- **Desktop Check:** Content fills the viewport without `mx-auto` constraints.
- **Scroll Check:** The page header and rail summaries stay fixed while the data list scrolls.
- **Consistency Check:** Font sizes, spacing, and card styles match the Dashboard and Timetable Review.
- **Mobile Check:** The page remains usable on small screens via responsive column wrapping or drawers.

## Success Metrics
- 100% viewport utilization on desktop.
- Zero whole-page scrollbars on desktop.
- Visual parity with the `ScheduleReviewWorkspace` layout pattern.
