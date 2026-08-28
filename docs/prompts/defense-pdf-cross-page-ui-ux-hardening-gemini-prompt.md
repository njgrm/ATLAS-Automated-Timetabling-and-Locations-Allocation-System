# Defense PDF Cross-Page UI/UX Hardening - Gemini Prompt

## Goal

Implement the cross-page UI/UX improvements proposed in [question_prompt.pdf](/d:/ATLAS/question_prompt.pdf), but only where those suggestions align with current ATLAS routes, components, and design-system rules.

This pass is not a broad redesign.

It is a focused hardening pass across:

- `Faculty`
- `Sections`
- `Dashboard`
- `Map Editor`
- global sidebar behavior
- shared avatar / initials rendering

## Out Of Scope

- Do not reopen `Teaching Load` architecture in this pass.
- Do not change backend contracts unless a tiny route or payload adjustment is absolutely required for existing UI functionality.
- Do not introduce native HTML form controls.
- Do not introduce a global browser scrollbar.
- Do not globally rename grade labels from `G7/G8/G9/G10` to `GR7/GR8/GR9/GR10`.
  - Current shared convention in [grade-labels.ts](/d:/ATLAS/atlas-client/src/lib/grade-labels.ts:1) explicitly says user-facing grade labels use `Gx`.
  - If you believe this convention should change, report it in evidence instead of silently migrating the UI.

## Required References

- [AGENTS.md](/d:/ATLAS/AGENTS.md)
- [ATLAS_AGENT_KI.md](/d:/ATLAS/ATLAS_AGENT_KI.md)
- [docs/reference/atlas-runtime-source-of-truth-map.md](/d:/ATLAS/docs/reference/atlas-runtime-source-of-truth-map.md)
- [docs/DESIGN.md](/d:/ATLAS/docs/DESIGN.md)
- [docs/DESIGN-INSPIRATION.md](/d:/ATLAS/docs/DESIGN-INSPIRATION.md)
- [question_prompt.pdf](/d:/ATLAS/question_prompt.pdf)

## Context7 Preflight Summary

Before editing, verify and apply current guidance for:

1. `shadcn/ui` `Sheet`, `DropdownMenu`, `Tooltip`, and sidebar-compatible overlay patterns
2. `framer-motion` / `motion` sidebar and drawer transitions
3. keyboard-accessible hover-preview or disclosure patterns that do not break focus management

Record the exact references used in `docs/verification/evidence-log.md` as an appended entry only.

## Hard Scope

### 1. Faculty Profile Sheet: Fix the false-disabled close action

Target:

- [atlas-client/src/components/faculty/FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:230)

Required change:

- The `Close Profile` button must no longer look disabled.
- Restyle it as a clear secondary action using project-standard button variants.
- Preserve strong contrast and obvious clickability.

### 2. Faculty and Sections: Remove redundant ellipsis menus only where duplication is real

Targets:

- [atlas-client/src/pages/Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:1)
- [atlas-client/src/components/sections/SectionRow.tsx](/d:/ATLAS/atlas-client/src/components/sections/SectionRow.tsx:1)

Required behavior:

- Audit whether the three-dots menu duplicates actions already exposed as direct row buttons.
- If duplicate, remove the ellipsis menu and keep the direct low-click actions visible.
- Do not remove overflow menus blindly if they still contain non-duplicated actions.

### 3. Professionalize user-facing labels, but do not expand academic codes

Targets:

- Start with:
  - [atlas-client/src/components/faculty/FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:107)
  - [atlas-client/src/pages/Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:472)
  - [atlas-client/src/pages/Sections.tsx](/d:/ATLAS/atlas-client/src/pages/Sections.tsx:1)
  - [atlas-client/src/pages/Dashboard.tsx](/d:/ATLAS/atlas-client/src/pages/Dashboard.tsx:346)

Required behavior:

- Replace informal UI abbreviations like `Dept` or `DEPT` with `Department` where they are visible conversational labels.
- Do not expand structural academic subject codes or database-style keys:
  - examples: `AP`, `ESP`, `TLE`, `SCI_ES`, `TLE_ICT_EXP`

### 4. Preserve `Gx` grade labels

Targets:

- [atlas-client/src/lib/grade-labels.ts](/d:/ATLAS/atlas-client/src/lib/grade-labels.ts:1)
- all grade-badge call sites

Required behavior:

- Do not migrate the app to `GR7/GR8/GR9/GR10`.
- Instead, verify that current `G7/G8/G9/G10` usage is visually consistent and presentable.
- If you find isolated grade-label inconsistency, normalize it back to the existing `Gx` shared helper.

### 5. Map Editor: Add background removal and dynamic canvas growth

Targets:

- [atlas-client/src/components/CampusMapEditor.tsx](/d:/ATLAS/atlas-client/src/components/CampusMapEditor.tsx:532)
- [atlas-client/src/pages/MapEditor.tsx](/d:/ATLAS/atlas-client/src/pages/MapEditor.tsx:1)

Required behavior:

- Add a clear `Remove Background` or `Clear Background` action through the existing background workflow.
- Do not overload `Reset View` unless the UX remains obvious.
- Prevent building nodes from visually overflowing the canvas background.
- Compute minimum canvas bounds from the furthest building extents plus safe padding.
- Preserve no-scroll architecture by keeping scrolling local to the workspace, not the browser window.

### 6. Dashboard: Replace cramped persistent analytics rail with contextual drawer behavior

Targets:

- [atlas-client/src/pages/Dashboard.tsx](/d:/ATLAS/atlas-client/src/pages/Dashboard.tsx:1)
- [atlas-client/src/components/RoomScheduleOverlay.tsx](/d:/ATLAS/atlas-client/src/components/RoomScheduleOverlay.tsx:1)

Required behavior:

- The dashboard should prioritize the map canvas by default.
- The right-side detailed building or room information must not remain a cramped always-open column.
- Clicking a building or room should open a contextual right-hand drawer or sheet with enough width for readable analytics and floor-plan details.
- The drawer must dismiss cleanly through:
  - close button
  - backdrop click where appropriate
  - deselection behavior if compatible

### 7. Global Sidebar: Add hover-preview plus click-to-lock

Targets:

- [atlas-client/src/components/AppShell.tsx](/d:/ATLAS/atlas-client/src/components/AppShell.tsx:527)
- [atlas-client/src/ui/sidebar.tsx](/d:/ATLAS/atlas-client/src/ui/sidebar.tsx:1)

Required behavior:

- When the sidebar is minimized, hovering it should temporarily expand it as an overlay.
- This hover-preview must not reflow or shrink the main page content.
- Clicking the explicit sidebar toggle should still lock the sidebar open in a persistent layout-aware state.
- Manage this through a clear state model such as:
  - locked
  - temporarily previewed
  - collapsed
- Preserve keyboard access and focus sanity.

### 8. Avatar initials: respect surname-first display order

Targets:

- [atlas-client/src/lib/timetable-utils.ts](/d:/ATLAS/atlas-client/src/lib/timetable-utils.ts:21)
- reusable avatar and initials call sites across:
  - `Faculty`
  - `Dashboard`
  - profile sheets
  - timetable side panels

Required behavior:

- If the visible display convention is `SURNAME, FIRSTNAME`, the initials must match that visual order.
- Example:
  - `AQUINO, ELPIDIO` -> `AE`
- Audit the shared helper and any duplicated initials logic.
- Fix globally where this surname-first display format is used.

## Interaction Rules

- Use `Sheet`, `DropdownMenu`, `Tooltip`, and existing `@/ui/*` primitives only.
- Do not use native `<select>`, raw browser tooltips, or ad-hoc modal markup.
- Keep page-level scrolling local through `flex-1 min-h-0 overflow-auto`.
- Use `motion` only where it improves clarity:
  - drawer open/close
  - hover-preview sidebar width transition
- Avoid decorative motion that harms density or readability.

## Verification Gates

### Automated

- `npm --prefix atlas-client run build`

### Manual QA

Validate these routes:

- `/teachers`
- `/sections`
- `/map`
- `/`

Check specifically:

1. `Close Profile` no longer looks disabled.
2. redundant ellipsis actions are removed only where duplication exists.
3. `Department` wording is professionalized without corrupting subject codes.
4. grade labels remain `G7/G8/G9/G10` consistently.
5. map background can be removed.
6. map canvas bounds prevent visual overflow.
7. dashboard right-side detail is contextual and readable.
8. minimized sidebar hover-preview works without layout shift.
9. click-to-lock sidebar still works.
10. surname-first initials render correctly wherever that display format is used.

### Evidence

- Append one dated entry to `docs/verification/evidence-log.md`.
- Do not overwrite, truncate, or clean up prior evidence.
- Include:
  - touched files
  - Context7 refs used
  - route-by-route manual verification summary
  - GO / NO-GO verdict

## GO / NO-GO Rubric

### GO only if

- the client builds cleanly
- no global scrollbar is introduced
- the sidebar hover-preview works as overlay, not layout shift
- the dashboard drawer improves readability without hiding primary map interaction
- avatar initials are globally corrected where surname-first display is used
- no global `GR7` migration is introduced

### NO-GO if

- the pass silently changes grade-label convention
- the sidebar hover behavior traps focus or breaks no-scroll layout
- the dashboard still ships with a cramped always-open analytics rail
- the map can still visually overflow its own background area
- the evidence log is rewritten instead of appended
