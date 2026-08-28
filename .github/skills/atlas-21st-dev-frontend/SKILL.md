---
name: atlas-21st-dev-frontend
description: Mandatory frontend UI/UX skill for ATLAS using 21st.dev component patterns. Use for every frontend prompt, including admin, faculty, and public pages.
argument-hint: describe target role, page purpose, and required interactions
user-invocable: true
---

# ATLAS 21st Dev Frontend Skill

This is a mandatory skill for all frontend work in ATLAS.

## When To Use
- Any task that creates or updates UI in role-based dashboards or public schedule pages.
- Any task requiring component selection, page layout, theme tokens, or interaction design.

## Install and Configure (Context7-aligned)
1. Use React project setup with Tailwind CSS.
2. Install 21st-compatible components through the published registry pattern.
3. Example install command pattern:
   - npx shadcn@latest add "https://21st.dev/r/shadcn/<component-name>"
4. Keep component installs auditable and committed as source files in the project.

## Usage Conventions
- Compose pages from reusable components rather than one-off markup.
- Use consistent spacing, typography, and state styling across roles.
- Keep role-specific layouts cohesive:
  - Scheduling Officer: dense data, controls, review status visibility.
  - Faculty: mobile-first cards/forms with clear sync state.
  - Public: simple lookup + read-only timetable clarity.

## Context7-Backed UX Standards (Mandatory)

These standards are validated against current component and animation docs from Context7 (`/shadcn-ui/ui`, `/grx7/framer-motion`, `/websites/vaul_emilkowal_ski`).

### 1) Overlay Accessibility Contract
- Every `Dialog`, `Sheet`, and `Drawer` content must include a title and description for screen readers.
- If the title should not be visible, keep it in the DOM with `sr-only`.
- Never ship unnamed overlays.

### 2) Faculty Mobile Action Pattern
- For mobile review/submit flows, use `Drawer` (Vaul-backed) instead of `Sheet`.
- Use bottom-anchored actions with clear primary CTA labels.
- Use snap points only when partial states improve comprehension; otherwise keep a single clear open state.

### 3) Form Clarity Pattern
- Prefer structured field group patterns (`FieldGroup`, labeled controls, inline description, inline error).
- Each field must answer:
  - What is this?
  - Why does it matter?
  - What is wrong when invalid?
- Do not hide validation until submit when it blocks key progression.

### 4) Motion and Transition Discipline
- Use `AnimatePresence` for route/panel transitions where exit context matters.
- Prefer `mode="wait"` for step-to-step transitions that require sequence clarity.
- Keep transitions short and purposeful; avoid decorative motion that delays task completion.
- Ensure reduced-motion compatibility for users with motion sensitivity.

### 5) Progressive Disclosure Rule
- Show only the minimum required context for first action.
- Place advanced/global context behind explicit user actions (toggle, reveal, "show more").
- Default views for non-technical users should optimize task completion, not data density.

### 6) Faculty Language Rule
- Use plain-language instruction copy for every step.
- Avoid technical backend terms (`run`, `gate`, `context`, `version conflict`) in primary instructional text.
- Required copy pattern per step:
  - "What this step is"
  - "What to press next"
  - "What happens after"

## UX Quality Gate (Apply Before Merging)

### First-Action Test
- First actionable control visible without scrolling on supported viewport.
- User can explain next action in under 5 seconds based on visible copy.

### Interaction Load Test
- Count clicks/taps to complete a basic happy-path task.
- If count is high because of navigation overhead, simplify default flow.

### Mobile Stability Test
- Portrait and landscape must avoid clipping, overlap, and nested-scroll traps.
- Sticky/fixed action bars must not block core content.

### State Feedback Test
- Show explicit states for: loading, empty, offline, syncing, success, and error.
- Error states must include a recovery action (retry/reload/reopen flow).

## Recommended Component Selection Heuristics
- Use `Drawer` for mobile step review and submit confirmation.
- Use `Sheet` for side-panel utilities and desktop secondary workflows.
- Use `Dialog` for destructive confirmations and short blocking decisions.
- Use `Tooltip`/`HoverCard` for secondary explanation, never as the only instruction source.

## Agent Behavior Requirement (Expanded)
- Before generating frontend code, identify needed 21st-style components and token usage.
- Prefer existing installed components; install new ones only when necessary.
- Document which 21st-style components were used and why.
- Explicitly log UX blockers discovered during audit and map each blocker to a concrete UI change.

## Design Tokens and Theming
- Define shared CSS variables/tokens for color, spacing, radius, typography, and elevation.
- Support semantic tokens for status states:
  - published, review, warning, conflict, offline, syncing.
- Use accessible contrast and clear focus states.
- Avoid role-specific hardcoded color logic; map role themes via token sets.

## Agent Behavior Requirement
- Before generating frontend code, identify needed 21st-style components and token usage.
- Prefer existing installed components; install new ones only when necessary.
- Document which 21st-style components were used and why.
