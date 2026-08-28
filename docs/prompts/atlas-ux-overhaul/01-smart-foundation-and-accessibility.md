# Prompt UX-01 — SMART Foundation and Accessibility

## Objective

Make every page feel like one SMART-family product and establish an older-user-safe interaction baseline.

## Scope

- `AppShell`, sidebar, mobile drawer, faculty bottom navigation, shared page headers, buttons, inputs, notices, empty states, error states, loading states, badges, tooltips, dialogs, and typography.

## Implementation Directive

1. Create or normalize one shared page-header contract with consistent title, purpose, primary action, and secondary overflow action.
2. Preserve token-driven school branding. Remove brand use of hard-coded colors while retaining semantic success, warning, destructive, and grade colors.
3. Set primary and high-frequency targets to at least 40px; use 44px on mobile where practical. Keep 24px as an absolute WCAG floor only for tightly packed secondary controls.
4. Restrict `text-xs` to metadata. Promote instructions, status explanations, form labels, and recovery guidance to readable body sizing.
5. Replace native `title` help with `Tooltip`, `HoverCard`, `Popover`, or visible helper text. Ensure icon actions have accessible names.
6. Standardize messages to state: what happened, what to do next, and whether data was saved.
7. Verify focus visibility, dialog focus containment/restoration, keyboard order, reduced motion, 200% zoom, and 400% reflow.
8. Extract `ManualEditPanel.tsx` below 1,000 lines before adding functionality to it.

## Non-Goals

- Do not redesign role workflows in this phase.
- Do not alter API contracts, lifecycle permissions, or schedule truth.

## Exit Gate

GO when shared surfaces pass WCAG 2.2 AA checks, no modified page uses title-based help, no modified component exceeds 1,000 lines, and the shell remains stable at all required viewports.
