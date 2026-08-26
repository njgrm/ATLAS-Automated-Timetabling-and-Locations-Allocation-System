# UX Rehaul Prompt 11: Teaching Load State Clarity One-Shot

## Mission

Harden `/teaching-load` so it communicates state and next action clearly without changing staffing math or backend truth.

This is a UX/UI pass for the existing dense operator workspace.

Do not touch `/timetable`.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/prompts/ux-rehaul-07-admin-shared-list-pattern-one-shot-prompt.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/components/faculty-assignments/*`

## Current UX Findings

- Live sampling showed a confusing first state: `Teaching Load`, `READ-ONLY`, `TOTAL COVERAGE 0 / 0`, `UNASSIGNED 0`, and a blank `Select a teacher` state.
- The page has strong operator functionality, but degraded/read-only states are not explained enough.
- Tabs such as `BY TEACHER`, `SECTION ALLOCATION`, `STAFFING AUDIT`, `AUTO-FILL` need task-oriented framing.
- A raw `title="Dismiss Review Warning"` exists and must be replaced with `Tooltip` plus `aria-label`.

## Scope

Allowed source files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts` only for UI-state support, not math changes
- `atlas-client/src/components/faculty-assignments/*`
- docs/evidence files

Do not change backend staffing calculations, assignment persistence contracts, or Auto-Fill logic.

## Mandatory Outcomes

### 1. Explain The Workspace State

The page must clearly state:

- whether assignment data is live, checking, saved, read-only, or unavailable
- why write actions are enabled or disabled
- what the operator should do next

When coverage is `0 / 0`, explain whether this means loading, no data, no active school year, unavailable source, or empty assignment universe.

### 2. Improve Top Workflow Band

Keep compact density, but improve copy and hierarchy:

- page title: `Teaching Load`
- purpose: `Assign subjects and sections to teachers before generation.`
- inline stats with labels that distinguish real coverage from placeholder/synthetic coverage where applicable
- primary action changes by state: save draft, sync/retry, or auto-fill only when safe

### 3. Task-Oriented Mode Labels

Retain current functionality but clarify labels:

- `By teacher` -> inspect and adjust one teacher at a time
- `Section allocation` -> fill section coverage gaps
- `Staffing audit` -> review staffing risks
- `Auto-fill` -> preview automated assignment help

Use tooltip or helper text, not long static paragraphs.

### 4. Empty/Loading/Error States

Every mode must have a useful state for:

- loading
- no selected teacher/section
- no data available
- read-only/degraded mode
- save conflict or write-blocked state

### 5. Remove Bad Primitives

Replace raw `title=` usage with `Tooltip` and `aria-label`.

Confirm no native `<select>` or `<details>` are introduced.

### 6. Preserve Dense Workspace

Do not make the page card-heavy.

Do not add global page scroll.

Keep the inspector and grid usable on laptop/tablet viewports.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/teaching-load` desktop
- `/teaching-load` tablet/mobile width
- teacher mode empty/selected state
- section allocation mode
- staffing audit sheet
- auto-fill dialog

Check:

- no raw `title=` remains in touched Teaching Load files
- read-only/degraded states are understandable
- no global horizontal overflow
- no file exceeds 1000 lines

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-teaching-load-desktop-after.png`
- `qa-artifacts/playwright/20260530-admin-teaching-load-readonly-after.png`
- `qa-artifacts/playwright/20260530-admin-teaching-load-mobile-after.png`

## Required Output

Return files changed, state-copy changes, mode-label changes, screenshots, build result, and `GO`/`NO-GO`.
