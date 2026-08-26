# Context7 Library Map (ATLAS)

This file defines the approved documentation sources to use during Context7 preflight checks.

## Policy

- For every non-trivial UI or UX task, run Context7 preflight before coding.
- Resolve library IDs first, then pull 2-3 relevant documentation references.
- In prompt output, cite which pattern was applied and which references informed it.
- If no approved library entry covers the task, add a candidate entry here before continuing.

## Expert UX / QA bar (use together)

- **`docs/DESIGN.md`** — authoritative ATLAS UX rules (one obvious action, progressive disclosure, mobile vs desktop first-class, plain language).
- **`docs/DESIGN-INSPIRATION.md`** — pattern mapping (guided flows, Polaris-style empty states, Carbon density discipline).
- **`docs/phases/faculty-mobile-wireframe-spec.md`** — faculty mobile blueprint.

**Manual shared-browser QA:** agents must read the three docs above **and** this map before judging pass/fail. Use Context7 to validate implementation details (focus traps, scroll regions, component APIs) against current library docs.

## Approved Libraries

### Product / design systems (rationale and patterns)

- **Atlassian Design System**
  - Guided workflows, onboarding, status and navigation clarity.
- **Shopify Polaris**
  - Action hierarchy, empty/error states, admin clarity without clutter.
- **Carbon Design System**
  - Responsive dense layouts, enterprise shell discipline, accessibility-forward patterns.

### Implementation (ATLAS stack)

- **shadcn/ui** (Radix primitives)
  - Sheet, Dialog, Select, ScrollArea, focus management, composition. Use Context7 for the exact package namespace in your MCP (e.g. `shadcn-ui/ui` or project mirror).
- **Motion** (`motion`, formerly Framer Motion)
  - Page and drawer transitions; avoid layout thrash; `AnimatePresence` usage.
- **React Router**
  - Route layouts, nested routes, outlet patterns (see project `AppShell` freeze-outlet rule).

### Accessibility

- **W3C WAI-ARIA Authoring Practices**
  - Dialog modal pattern, focus movement, grid/table keyboard behavior.

## Preflight Output Template

- `Task Type`: UI pattern / realtime pattern / offline sync / accessibility.
- `Library IDs`: [resolved IDs from Context7].
- `References`: [2-3 links or doc identifiers].
- `Applied Pattern`: [name + where used + expected user outcome].

## QA rubric reminder (Context7 + design docs)

During gate QA, confirm against `DESIGN.md`:

1. First primary action visible within ~5 seconds.
2. No blocking banner stack above that action on mobile.
3. Single primary scroll region on mobile where applicable; no nested scroll traps.
4. Touch targets and focus states are visible.
5. Offline/sync/realtime states are understandable without jargon.
