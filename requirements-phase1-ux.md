# Requirements: Phase 1 UX Fixes & EnrollPro UI Standardization

## Overview
This feature specification covers the necessary UX/UI adjustments required to complete Phase 1 setup. It ensures that the ATLAS frontend adheres to the same interaction patterns and UI component standards as the broader EnrollPro suite, while addressing specific usability gaps discovered during the QC audit of the Map Editor, Dashboard, Subjects, and Faculty UI.

## Scope
### In Scope
- Porting structural `shadcn` components from EnrollPro (`Select`, `DropdownMenu`, `AnimatePresence`, variants).
- Refactoring existing ATLAS pages (`Subjects.tsx`, `Dashboard.tsx`, `FacultyAssignments.tsx`) to replace raw HTML form elements with standard components.
- Fixing Dashboard missing quick actions.
- Fixing Map Editor capacity default.
- Fixing Subject minutes vs hours UX and core subject tagging.
- Fixing Faculty Assignments loaded UI calculation warnings and missing teacher surface area.

### Out of Scope
- Building or modifying the actual timetable generation algorithm [v2].
- Implementing the push notification or offline sync mechanisms [v2].
- Implementing the public student schedule viewing screens [v2].
- Adjusting any API route logic other than basic payload compatibility for the time selector.

## Actors
| Actor | Description |
|-------|-------------|
| Scheduling Officer | Authenticated Admin who configures the school map, subjects, and assigns teachers. |

## Requirements

### Functional Requirements

#### [FR-01] Dashboard UI & Quick Actions
- FR-01.1: The system shall display a "Quick Actions" widget dynamically based on the current lifecycle phase.
- FR-01.2: While the phase is SETUP, the system shall provide quick links to "Configure Subjects" and "Manage Faculty" in the Quick Actions widget.
- FR-01.3: The system shall scale the side-by-side Map View proportionately to prevent horizontal scrolling on screens down to 1024px width.

#### [FR-02] Subjects Management
- FR-02.1: Where a subject has `isSeedable` set to true, the system shall display a visual badge labeled "DepEd Core" next to the subject name.
- FR-02.2: When adding or editing a subject, the system shall provide a toggle selector enabling the user to input time as either "Minutes/Week" or "Hours/Week".
- FR-02.3: If the user inputs time in "Hours/Week", then the system shall multiply the input by 60 before saving to the `minMinutesPerWeek` database field.
- FR-02.4: The system shall provide quick-select helper buttons for standard MATATAG weekly limits (e.g., 200 min, 225 min) in the subject configuration form.

#### [FR-03] Faculty Assignments Context
- FR-03.1: The system shall display a tooltip icon next to the "Teaching Load" summary explicitly stating: "This measures assigned subject types. True teaching load depends on section generation."
- FR-03.2: If there are Active subjects with zero faculty assigned, then the system shall display a prominent "Subjects Lacking Faculty" warning panel mapping those specific subjects on the Assignments page.

#### [FR-04] Map Editor Polish
- FR-04.1: When the user clicks to add a new Room, the system shall default the "Capacity" input to 45 by default.

#### [FR-05] EnrollPro UI Standardization
- FR-05.1: The system shall use the `framer-motion` `AnimatePresence` wrapper around route transitions for smooth page fade/slide.
- FR-05.2: The system shall utilize `shadcn` standardized `<Select>` and `<DropdownMenu>` components instead of raw HTML `<select>` tags in all dropdown contexts.
- FR-05.3: The system shall share `button-variants.ts` and `badge-variants.ts` from EnrollPro's codebase to enforce identical shadow, hover, and radius aesthetics.
- FR-05.4: The system shall adapt the structural look of `AppLayout.tsx` (a persistent top-bar separated from scrollable content) while retaining ATLAS-specific logic.

### Non-Functional Requirements

#### [NFR-01] Performance
- NFR-01.1: The system shall complete page transitions (fade-in) within 200ms using `framer-motion`.

## Acceptance Criteria
| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Quick Actions active | Clicking "Configure Subjects" from the Dashboard routes successfully. |
| AC-02 | Hours/Week toggle works | Selecting "3.3 Hours" saves exactly `198` (or closest logical rounding, e.g. 200 via preset) to the backend. |
| AC-03 | Missing Faculty warning | A subject with no assigned faculty is explicitly listed in a warning container on the Faculty Assignments screen. |
| AC-04 | UI Standard alignment | Inspecting DOM on dropdowns reveals `radix-ui` attributes instead of raw `<select>` elements. |
| AC-05 | AppLayout matches | The ATLAS layout renders a distinct top navigation bar replicating the layout spacing found in `EnrollPro/client/src/shared/layouts/AppLayout.tsx`. |

## Open Questions
- [ ] Will the `framer-motion` peer dependency trigger conflicts with `react-konva` events on route unmount?

## Assumptions
- The database schema does not need to change to support the Minutes/Hours toggle, as it will be handled at the React component layer.
- EnrollPro's `button-variants.ts` will drop cleanly into the ATLAS project without circular dependency issues.

## Dependencies
- `@radix-ui/react-select`
- `@radix-ui/react-dropdown-menu`
- `motion` (framer-motion)

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2026-04-01 | [name] | Initial draft |
