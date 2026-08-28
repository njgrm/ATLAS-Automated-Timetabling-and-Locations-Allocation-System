# UX Rehaul Prompt 07: Admin Shared List Pattern One-Shot

## Mission

Create the reusable SMART-family admin page pattern that the next prompts will apply to `/sections`, `/subjects`, and `/teachers`.

This is a frontend UI/UX foundation pass. Do not redesign `/timetable` and do not change backend APIs.

The goal is to stop each admin setup page from feeling like an isolated engineering table and give all setup/catalog pages the same role-aware structure: clear page purpose, readiness summary, source-state honesty, primary action, filters, data table, and recovery states.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`

Apply these skills:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/app-shell/navigation.ts`
- existing local `@/ui/*` primitives

## Current UX Findings To Address

- `/sections`, `/subjects`, and `/teachers` currently open as dense toolbar/table surfaces with weak visible page framing at tablet/mobile widths.
- The first-screen copy does not consistently explain what the page is for or what the scheduling officer should do next.
- Source-state language varies across pages and can read like runtime/debug copy: `Saved Data`, `Verifying runtime`, `No Saved Data`.
- The pages share similar structure but duplicate one-off toolbar/table patterns.
- The pages are close to the 1000-line extraction threshold: `Sections.tsx` ~881 lines, `Subjects.tsx` ~823 lines, `Faculty.tsx` ~602 lines.

## Scope

Allowed source files:

- new files under `atlas-client/src/components/admin-workspace/*` or another clearly named shared admin UI folder
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- docs/evidence files only as needed

Do not change:

- `/timetable` routes or components
- backend APIs
- Prisma schema
- scheduler algorithms
- auth behavior
- faculty `/my/*` surfaces

## Mandatory Outcomes

### 1. Shared Page Frame

Create or identify reusable components/helpers for:

- page title + short purpose copy
- compact inline stat banner
- source-state chip with tooltip/explanation
- primary/secondary action cluster
- search + filter toolbar
- local scroll table shell
- empty/error/degraded state panel

The shared pattern must support dense admin data without creating global browser scrollbars.

### 2. SMART-Family Identity Rules

Required:

- use token-derived brand classes (`bg-primary`, `text-primary`, `border-primary`, `shadow-primary-glow`) for brand/primary action states
- keep HNHS Tailnet maroon behavior intact
- use emerald only for success/correctness states
- keep cards/surfaces light slate/white and task-first
- keep grade colors exact only when encoding grade meaning: G7 green, G8 yellow, G9 red, G10 blue

### 3. Source-State Copy System

Normalize labels and explanations:

- `Verified live` -> data was checked against the live source
- `Checking source` -> the page is usable while verification finishes
- `Using saved data` -> ATLAS is showing the last safe local copy
- `No saved data` -> the user must reconnect or sync before this page can work

Each state must answer:

- what is being shown
- why it matters
- what the user can do next

### 4. Component Contract

Use existing `@/ui/*` primitives only.

Do not introduce native `<select>`, native `title`, raw styled `<button className=...>`, or `<details>`.

Icon-only controls must have `aria-label` and `Tooltip`.

### 5. Extraction Guard

Do not let any touched React component exceed 1000 lines.

If the shared pattern adds weight to a page near the threshold, extract row/toolbar/banner components first.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Check:

- no touched file exceeds 1000 lines
- no native `<select>` in touched files
- no raw `title=` in touched files
- no global horizontal overflow on `/sections`, `/subjects`, `/teachers`
- page purpose/title is visible in the accessible page snapshot for each page after the pattern is applied

## Required Output

Return:

1. Files changed.
2. Shared components/patterns created.
3. Before/after line counts for touched page files.
4. SMART design mapping.
5. Source-state copy mapping.
6. Accessibility and primitive-compliance notes.
7. Build and route smoke-check results.
8. `GO` or `NO-GO`.
