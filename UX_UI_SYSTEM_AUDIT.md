# ATLAS System-Wide UX/UI Audit: Keeping It Simple & SMART

## Executive Summary
This document provides a comprehensive UX/UI audit of the **Automated Timetabling and Locations Allocation System (ATLAS)**. The objective of this audit is to identify usability bottlenecks, layout issues, and design inconsistencies across all **17 page routes** and recommend concrete, actionable changes to make the system as **"simple and stupid" (KISS)** as possible for the scheduling operator while maintaining the clean, premium feel of the **SMART** design system.

The audit was conducted programmatically using automated Playwright-based viewport checks (desktop and mobile) and visual analysis. 

### Key Audit High-Level Findings
1. **No-Scroll Architecture (PASS)**: All audited pages successfully adhere to the No-Scroll guidelines. Viewports are constrained to `h-[calc(100svh-3.5rem)]` with content scrollbars localized inside cards or grids. No global browser scrollbars were triggered.
2. **Input Standardization (PARTIAL PASS)**: Select controls are fully standardized using Radix-based custom dropdowns (`@/ui/select`). However, raw HTML `<button>` elements styled with inline Tailwind classes persist in [Login.tsx](file:///d:/ATLAS/atlas-client/src/pages/Login.tsx), [OfficerPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerPreferences.tsx), and [OfficerRoomPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerRoomPreferences.tsx).
3. **Excessive Micro-Text (FAIL)**: There is a widespread dependency on microscopic text (e.g., `text-[10px]`, `text-[11px]`, `text-[0.6rem]`, `text-[0.65rem]`) across primary tables, table headers, and badges in [Subjects.tsx](file:///d:/ATLAS/atlas-client/src/pages/Subjects.tsx), [Sections.tsx](file:///d:/ATLAS/atlas-client/src/pages/Sections.tsx), [RoomSchedules.tsx](file:///d:/ATLAS/atlas-client/src/pages/RoomSchedules.tsx), and [OfficerRoomPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerRoomPreferences.tsx). This violates the guideline that operator-facing text should not go below `text-xs` (`12px`).
4. **Visual Overload / Badge Spam**: Multiple badges are rendered side-by-side inside lists and tables (e.g., displaying subjects, status, and rotation metadata simultaneously). This "skittles" effect increases visual noise and cognitive load.
5. **Workflow Separation**: Technical terms (e.g., "stale run version", "split-brain sync data") leak into operator-facing copy, causing friction. Everyday scheduling workflows are sometimes placed alongside destructive or repair actions.

---

## Global UX/UI Compliance Dashboard

| Page / Route | Scroll Compliance | Input Compliance | Typography Compliance | Design Hierarchy | Primary Issues |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Admin Pages** | | | | | |
| [Dashboard](file:///d:/ATLAS/atlas-client/src/pages/Dashboard.tsx) (`/`) | ✅ Pass | ✅ Pass | ⚠️ Warn | ✅ Pass | Micro-text `text-[11px]` in lifecycle subtitle |
| [Subjects](file:///d:/ATLAS/atlas-client/src/pages/Subjects.tsx) (`/subjects`) | ✅ Pass | ✅ Pass | ❌ Fail | ⚠️ Warn | 7-column table is too dense; badge spam in drawer; micro-text in table headers (`text-[0.7rem]`) |
| [Teachers](file:///d:/ATLAS/atlas-client/src/pages/Faculty.tsx) (`/teachers`) | ✅ Pass | ✅ Pass | ⚠️ Warn | ✅ Pass | Dense layout on narrow desktops; sync status could be more prominent |
| [Teaching Load](file:///d:/ATLAS/atlas-client/src/pages/TeachingLoad.tsx) (`/teaching-load`) | ✅ Pass | ✅ Pass | ⚠️ Warn | ⚠️ Warn | Extremely dense, multiple task modes create cognitive load; stacked bars lack clear standard indicators |
| [Sections](file:///d:/ATLAS/atlas-client/src/pages/Sections.tsx) (`/sections`) | ✅ Pass | ✅ Pass | ❌ Fail | ✅ Pass | Custom pagination uses `text-[0.7rem]`; table headers are microscopic |
| [Officer Preferences](file:///d:/ATLAS/atlas-client/src/pages/OfficerPreferences.tsx) (`/faculty/preferences`) | ✅ Pass | ❌ Fail | ❌ Fail | ⚠️ Warn | Raw `<button>` on tabs; amber warnings disrupt daily flows; microscopic text in badges |
| [Officer Room Prefs](file:///d:/ATLAS/atlas-client/src/pages/OfficerRoomPreferences.tsx) (`/faculty/room-preferences`) | ✅ Pass | ❌ Fail | ❌ Fail | ⚠️ Warn | Raw `<button>` wraps request cards; visualization text size is `0.7rem` |
| [Map Editor](file:///d:/ATLAS/atlas-client/src/pages/MapEditor.tsx) (`/map`) | ✅ Pass | ✅ Pass | ✅ Pass | ⚠️ Warn | Canvas drawer controls are highly complex and non-standard |
| [Audit Report](file:///d:/ATLAS/atlas-client/src/pages/Audit.tsx) (`/audit`) | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | Text-heavy descriptions; needs primary visual actions |
| [Timetable Workspace](file:///d:/ATLAS/atlas-client/src/pages/ScheduleReview.tsx) (`/timetable`) | ✅ Pass | ✅ Pass | ⚠️ Warn | ❌ Fail | Visual clutter with violations; drag-drop overlays are noisy; three-panel layout feels cramped |
| [How It Works](file:///d:/ATLAS/atlas-client/src/pages/HowItWorks.tsx) (`/timetabling/how-it-works`) | ✅ Pass | ✅ Pass | ✅ Pass | ⚠️ Warn | Dense wall of static text; lacks diagrams |
| [Room Schedules](file:///d:/ATLAS/atlas-client/src/pages/RoomSchedules.tsx) (`/room-schedules`) | ✅ Pass | ✅ Pass | ❌ Fail | ⚠️ Warn | Selector is custom popover button; text sizes go down to `text-[9px]` |
| **Faculty Pages** | | | | | |
| [My Dashboard](file:///d:/ATLAS/atlas-client/src/pages/MyDashboard.tsx) (`/my`) | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | Empty states look generic; lacks visual calendar preview |
| [My Schedule](file:///d:/ATLAS/atlas-client/src/pages/MySchedule.tsx) (`/my/schedule`) | ✅ Pass | ✅ Pass | ⚠️ Warn | ✅ Pass | Grid view on mobile shrinks text below readable thresholds |
| [My Preferences](file:///d:/ATLAS/atlas-client/src/pages/FacultyPreferences.tsx) (`/my/preferences`) | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | Form wizard navigation tabs feel redundant for short lists |
| [My Room Requests](file:///d:/ATLAS/atlas-client/src/pages/FacultyRoomPreferences.tsx) (`/my/room-preferences`) | ✅ Pass | ✅ Pass | ✅ Pass | ⚠️ Warn | Complexity in choosing slot (free vs swap vs occupied); needs wizard guidance |
| **Public Pages** | | | | | |
| [Public Schedules](file:///d:/ATLAS/atlas-client/src/pages/PublicPublishedSchedule.tsx) (`/public/schedules`) | ✅ Pass | ✅ Pass | ⚠️ Warn | ✅ Pass | Long section/teacher lists; mobile sidebar filters are cramped |

---

## Detailed Page-by-Page Audit Findings

### 1. Login Page (`/login`)
* **File Pointer**: [Login.tsx](file:///d:/ATLAS/atlas-client/src/pages/Login.tsx)
* **Weaknesses**:
  - **Raw HTML Button**: The password visibility toggle (Eye/EyeOff icon) at line 517 is a raw `<button type="button">` element with styling rather than using a standard `<Button>` primitive.
  - **Micro-Text**: The footer terms text at line 568 is hardcoded to `text-[10px]`. Schedulers and faculty using the portal shouldn't have to squint to read basic guidance.
* **Proposed KISS Improvements**:
  - Convert the eye toggle button to a standard button primitive or wrap it inside an icon button component.
  - Upgrade `text-[10px]` to `text-xs` (`12px`) with a muted color (`text-muted-foreground`).

### 2. Scheduling Dashboard (`/`)
* **File Pointer**: [Dashboard.tsx](file:///d:/ATLAS/atlas-client/src/pages/Dashboard.tsx)
* **Weaknesses**:
  - **Micro-Text**: Line 621 uses `text-[11px]` for the uppercase category label (`Scheduling lifecycle`).
  - **Setup Checklist Clarity**: The setup readiness checklist is a vertical list. If elements are unchecked (e.g., "Buildings and rooms ready"), the user is given a link, but there is no primary visual clue showing that this is the exact thing stopping them from generating.
* **Proposed KISS Improvements**:
  - Update `text-[11px]` to `text-xs` (`12px`) with `tracking-wider` to maintain design aesthetic while improving legibility.
  - Highlight the *first uncompleted* task in the checklist with a subtle amber outline or primary indicator to draw immediate focus to the next required action.

### 3. Subjects Catalog (`/subjects`)
* **File Pointer**: [Subjects.tsx](file:///d:/ATLAS/atlas-client/src/pages/Subjects.tsx)
* **Weaknesses**:
  - **Excessive Columns**: The table contains 7 columns, resulting in high horizontal density. "Programs and owner", "Status", and "Actions" are squished.
  - **Badge Spam in Drawer**: When clicking on a subject to open the coverage drawer, multiple badges (such as subject code, rotation flag, and term indices) are placed together. This causes cognitive overload.
  - **Microscopic Text**: The table headers use `text-[0.7rem]`. Badges use `text-[0.65rem]` and `text-[0.6rem]`.
* **Proposed KISS Improvements**:
  - **Simplify Columns**: Reduce the default table view to 5 columns: `Subject & Code`, `Weekly Time`, `Room Category`, `Grades`, and `Status/Actions`. Move secondary details (like allowed specializations and program owner groups) into a details sheet or expanding row.
  - **Remove Badge Spam**: Replace the multiple tag pill badges inside the drawer with a clean, structured table or plain text strings with muted icons.
  - Upgrade all headers from `text-[0.7rem]` to `text-xs` (`12px`) and capitalize normally instead of using all-caps microscopic labels.

### 4. Teachers Roster (`/teachers`)
* **File Pointer**: [Faculty.tsx](file:///d:/ATLAS/atlas-client/src/pages/Faculty.tsx)
* **Weaknesses**:
  - **Visual Density**: The roster renders the teacher list with multiple columns (Teacher, Department, Teaching Load, Credited Workload, Load State, Actions). On smaller desktop screens (like 1280px), columns overlap or truncate heavily.
  - **Sync Action Placement**: The "Refresh teacher roster" primary button is styled very boldly, but sync is a setup action that is rarely triggered after initial roster import.
* **Proposed KISS Improvements**:
  - Implement progressive disclosure: show Name, Department, and Load State in the primary table. Move the list of assigned subjects and specific hourly workload breakdowns to a slide-out details panel.
  - De-emphasize the "Refresh teacher roster" button to `variant="outline"` to reduce visual weight, and keep the focus on everyday reviewing.

### 5. Teaching Load Workspace (`/teaching-load`)
* **File Pointer**: [TeachingLoad.tsx](file:///d:/ATLAS/atlas-client/src/pages/TeachingLoad.tsx)
* **Weaknesses**:
  - **High Cognitive Load**: The page presents 4 different task modes (`By Teacher`, `Section Allocation`, `Staffing Audit`, and `Preview Auto-fill`) without visual separation, making it difficult for an operator to figure out where to start.
  - **Credited Workload Bars**: The workload bars combine teaching load, advisory, and ancillary credits. They are visually noisy and do not clearly mark the 30h standard vs. the 40h cap in a way that stands out immediately to a non-technical user.
* **Proposed KISS Improvements**:
  - Create a simplified **Wizard-driven workflow** at the top of the page: "Step 1: Check Staffing Needs" $\rightarrow$ "Step 2: Auto-Fill Base Load" $\rightarrow$ "Step 3: Manually Adjust Outliers".
  - Simplify the workload visualization: use a simple progress bar with a vertical line marking the `30h` standard, changing color from green (under-load) to blue (at standard) to red (over-cap).

### 6. Sections Mirror View (`/sections`)
* **File Pointer**: [Sections.tsx](file:///d:/ATLAS/atlas-client/src/pages/Sections.tsx)
* **Weaknesses**:
  - **Micro-Text in Pagination**: The custom pagination container at line 908 uses `text-[0.7rem]` for the page numbers. 
  - **Microscopic Headers**: Lines 930-931 use `text-[0.7rem]` for column headers like "Home-room readiness".
* **Proposed KISS Improvements**:
  - Standardize pagination using a shared UI footer component that defaults to `text-xs` (`12px`) or `text-sm`.
  - Upgrade table headers to standard `text-xs` (`12px`) or `text-sm`.

### 7. Officer Preferences Review (`/faculty/preferences`)
* **File Pointer**: [OfficerPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerPreferences.tsx)
* **Weaknesses**:
  - **Raw HTML Button**: The filter tabs for "Submitted", "Draft", "Missing", and "All" at line 391 are raw `<button>` elements with custom conditional borders.
  - **Cluttered Status Badges**: The counters inside the buttons use custom `text-[10px]` tags with aggressive color shading (green, yellow, red), creating a "colorful warning" look even for ordinary statuses.
* **Proposed KISS Improvements**:
  - Convert the status tabs to a standard `@/ui/tabs` component.
  - Remove the aggressive color coding from the status filter counts. Keep them neutral (gray/slate badges) to avoid visual noise, reserving colors for urgent issues (e.g., actual validation failures).

### 8. Officer Room Request Queue (`/faculty/room-preferences`)
* **File Pointer**: [OfficerRoomPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerRoomPreferences.tsx)
* **Weaknesses**:
  - **Raw HTML Button Wrapping Card**: Line 458 uses a raw `<button>` tag to wrap the entire room preference card.
  - **Micro-Text**: The "Before" and "After" column labels inside the comparison component use `text-[0.7rem]`.
  - **Action Bar Density**: The action buttons at the bottom of the review sheet are placed closely together, making it easy to click "Reject" or "Approve" accidentally.
* **Proposed KISS Improvements**:
  - Refactor the card wrapper to use a structured div with a standard link/button trigger or a standard `<Button variant="ghost">` that wraps only the action target.
  - Upgrade the comparison label text to `text-xs` (`12px`).
  - Add a confirmation dialog for "Approve" and "Reject" actions, or visually separate the destructive "Reject" button (using outline/red text) from the primary "Approve" button.

### 9. Map and Campus Editor (`/map`)
* **File Pointer**: [MapEditor.tsx](file:///d:/ATLAS/atlas-client/src/pages/MapEditor.tsx)
* **Weaknesses**:
  - **Complexity Overload**: Schedulers are not drafting experts. The editor uses a complex Konva-based grid canvas with multiple editor states (`Select`, `Draw`, `Rooms`, `Photo`, `History`) that can easily confuse an administrator who simply wants to register a room.
* **Proposed KISS Improvements**:
  - Provide a simple **Form-Based Fallback Grid** alongside the Canvas. Schedulers should be able to type "Building A, Floor 1, Room 101" into a clean form and click "Add Room" without touching the canvas drawing tools.

### 10. Audit Readiness Report (`/audit`)
* **File Pointer**: [Audit.tsx](file:///d:/ATLAS/atlas-client/src/pages/Audit.tsx)
* **Weaknesses**:
  - **Too Text-Heavy**: The report lists errors in long prose blocks, requiring administrators to read paragraphs to figure out what is wrong.
  - **Vague Action Targets**: Some issues show "Needs fixes" but do not provide a clear, one-click button to fix the problem directly.
* **Proposed KISS Improvements**:
  - Redesign the audit list using standard, color-coded collapsible cards (Accordions).
  - Each item should have a clear **Primary Action Button** (e.g., "Assign Teachers" or "Register Rooms") that deep-links directly to the page where the issue can be resolved, pre-filtering the target page to the conflicting item.

### 11. Timetable Review Workspace (`/timetable`)
* **File Pointer**: [ScheduleReview.tsx](file:///d:/ATLAS/atlas-client/src/pages/ScheduleReview.tsx)
* **Weaknesses**:
  - **Visual Clutter in the Left Rail**: The "Needs Attention" left rail combines unassigned classes and hard constraint violations. This creates a wall of red and amber warning items that is difficult to parse.
  - **Grid Layout Overload**: The central timetable grid displays subject code, grade, section, teacher, and room in a tiny slot block. When zoomed out, it becomes an unreadable mass of text.
  - **Fragile Hover Cards**: Hover cards are triggered very easily on grid mouse-over, causing popovers to constantly spawn and block the operator's view.
* **Proposed KISS Improvements**:
  - **Group Warnings**: Separate the left rail into distinct tabs: "Blocker Conflicts (Hard)" and "Unassigned Classes".
  - **Clean Timetable Blocks**: Simplify grid blocks to show only `Subject Code` and `Room` by default. Use color-coding for grade levels. Show full details (teacher name, section, schedule minutes) in the right dock only when a slot is explicitly clicked.
  - **Click to Inspect**: Disable auto-trigger hover cards on grid blocks. Force the operator to click a block to open the dock details, reducing visual noise during scrolling.

### 12. How It Works Explainer (`/timetabling/how-it-works`)
* **File Pointer**: [HowItWorks.tsx](file:///d:/ATLAS/atlas-client/src/pages/HowItWorks.tsx)
* **Weaknesses**:
  - **Wall of Text**: This is a purely static markdown page with long paragraphs. It lacks clear visual anchors or diagrams explaining the scheduling flow.
* **Proposed KISS Improvements**:
  - Integrate a **Mermaid sequence diagram** illustrating the schedule life cycle (Setup $\rightarrow$ Preference $\rightarrow$ Generate $\rightarrow$ Review $\rightarrow$ Publish).
  - Break up paragraphs into visual cards with large numbers (1, 2, 3, 4, 5) representing each step.

### 13. Room Schedules Browser (`/room-schedules`)
* **File Pointer**: [RoomSchedules.tsx](file:///d:/ATLAS/atlas-client/src/pages/RoomSchedules.tsx)
* **Weaknesses**:
  - **Microscopic Selector Text**: The selector uses a custom popover button containing `text-[11px]` and `text-[0.68rem]`.
  - **Visual Density**: The schedule view renders full timetables for rooms, which looks very cluttered when a room has complex shared occupancies.
* **Proposed KISS Improvements**:
  - Replace the custom popover dropdown with a standard searchable Select component that uses `text-sm` for options.
  - Simplify occupancy indicators: show simple color blocks representing "Occupied" or "Free", and reveal the subject/section details only on hover or click.

### 14. Faculty Dashboard (`/my`)
* **File Pointer**: [MyDashboard.tsx](file:///d:/ATLAS/atlas-client/src/pages/MyDashboard.tsx)
* **Weaknesses**:
  - **No Calendar Preview**: The dashboard shows a list of teaching load statistics but does not display a quick calendar layout of the teacher's schedule.
* **Proposed KISS Improvements**:
  - Render a mini weekly overview calendar directly on the dashboard page, showing which days have scheduled classes at a glance.

### 15. Faculty Schedule View (`/my/schedule`)
* **File Pointer**: [MySchedule.tsx](file:///d:/ATLAS/atlas-client/src/pages/MySchedule.tsx)
* **Weaknesses**:
  - **Mobile Grid Truncation**: When viewed on mobile viewports (e.g., 390x844), the 5-day timetable grid is squeezed horizontally, forcing class names to wrap and overlap.
* **Proposed KISS Improvements**:
  - **Mobile-Responsive List View**: When on mobile screens, automatically swap the grid view for a vertical list view grouped by day (e.g., Monday: 3 classes, Tuesday: 4 classes) with clear, full-width time cards.

### 16. Faculty Support Preferences Form (`/my/preferences`)
* **File Pointer**: [FacultyPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/FacultyPreferences.tsx)
* **Weaknesses**:
  - **Over-engineered Navigation**: The preference form is split into three steps (Support, Notes, Submit) controlled by wizard tabs. For a form with only 4 checkboxes and 1 textarea, this layout feels overly complex.
* **Proposed KISS Improvements**:
  - Merge the form into a single, clean vertical card: support needs checkboxes on top, notes textarea in the middle, and the "Submit Preferences" button at the bottom.

### 17. Faculty Room Request Form (`/my/room-preferences`)
* **File Pointer**: [FacultyRoomPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/FacultyRoomPreferences.tsx)
* **Weaknesses**:
  - **Confusing Slot Picking**: The slot picker grid shows green/blue/red blocks for free/swap/occupied slots. Teachers often get confused about which slots are requestable and what a "swap request" means.
* **Proposed KISS Improvements**:
  - Add a simple 3-step wizard with text guidance:
    1. "Choose your class to move."
    2. "Select a new slot (Available slots are highlighted; occupied slots will request a swap)."
    3. "Enter your rationale and submit."

### 18. Public Schedules Browser (`/public/schedules`)
* **File Pointer**: [PublicPublishedSchedule.tsx](file:///d:/ATLAS/atlas-client/src/pages/PublicPublishedSchedule.tsx)
* **Weaknesses**:
  - **Visual Noise**: Displays section lists in a dense grid of card buttons. On mobile, this creates an extremely long scrolling page.
* **Proposed KISS Improvements**:
  - Replace the large section cards with a simple search input and list layout. Users (mostly students and parents) should be able to type their grade or section name (e.g., "BONIFACIO") and get immediate suggestions.

---

## Actionable KISS & SMART Compliance Checklist

Below is the list of visual polish tickets to implement:

- [ ] **Standardize Buttons**: Replace raw `<button>` elements with standard `<Button>` components in:
  - [Login.tsx](file:///d:/ATLAS/atlas-client/src/pages/Login.tsx#L517) (Password visibility toggle)
  - [OfficerPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerPreferences.tsx#L391) (Status filters)
  - [OfficerRoomPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/OfficerRoomPreferences.tsx#L458) (Request cards wrapper)
- [ ] **Eliminate Micro-Text**: Update styling of text blocks to use `text-xs` (or `text-sm`) instead of custom brackets in:
  - [Subjects.tsx](file:///d:/ATLAS/atlas-client/src/pages/Subjects.tsx#L646) (Table headers $\rightarrow$ standard `text-xs`)
  - [Sections.tsx](file:///d:/ATLAS/atlas-client/src/pages/Sections.tsx#L908) (Pagination and headers $\rightarrow$ standard `text-xs`)
  - [RoomSchedules.tsx](file:///d:/ATLAS/atlas-client/src/pages/RoomSchedules.tsx#L519) (Selectors and descriptions $\rightarrow$ standard `text-xs`)
  - [Login.tsx](file:///d:/ATLAS/atlas-client/src/pages/Login.tsx#L568) (Footer links $\rightarrow$ standard `text-xs`)
- [ ] **Reduce Subjects Table Columns**: Remove secondary details from [Subjects.tsx](file:///d:/ATLAS/atlas-client/src/pages/Subjects.tsx) main table, placing them in an expandable sheet.
- [ ] **Add Form-Based Room Setup**: Provide a simple text form alongside the canvas editor in [MapEditor.tsx](file:///d:/ATLAS/atlas-client/src/pages/MapEditor.tsx) to allow adding rooms without drawing.
- [ ] **Group Timetable Warnings**: Separate the left-rail in [ScheduleReview.tsx](file:///d:/ATLAS/atlas-client/src/pages/ScheduleReview.tsx) into distinct tabs for hard conflicts and unassigned classes.
- [ ] **Mobile-Responsive List for Faculty Schedule**: In [MySchedule.tsx](file:///d:/ATLAS/atlas-client/src/pages/MySchedule.tsx), render a vertical day list instead of a squished grid on screens smaller than `640px`.
- [ ] **Collapse Preference Wizard**: Consolidate the 3-step preference form in [FacultyPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/FacultyPreferences.tsx) into a single page layout.
