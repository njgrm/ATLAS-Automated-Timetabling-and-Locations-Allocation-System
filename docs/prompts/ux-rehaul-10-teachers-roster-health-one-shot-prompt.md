# UX Rehaul Prompt 10: Teachers Roster Health One-Shot

## Mission

Redesign `/teachers` as a roster health and scheduling-readiness page.

This page should help a scheduling officer know whether the teacher roster is current, who has scheduling load, who needs attention, and where to fix assignments.

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

- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- teacher profile/detail sheet components used by the page

## Current UX Findings

- Live sampling showed `Teachers`, `Verifying runtime`, and roster rows, but the page does not clearly summarize roster readiness before showing the table.
- Source state copy is too technical: `Verifying runtime context`, `Working from saved data`, `No Saved Data`.
- Rows emphasize identity and raw load, but the page should better communicate scheduling readiness: active, excluded, overloaded, no load, adviser context.
- The primary action should be clearly framed as roster refresh/sync, not a mysterious data operation.

## Scope

Allowed source files:

- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/*`
- shared admin pattern components from Prompt 07
- docs/evidence files

Do not rename routes. `/faculty` remains a redirect to `/teachers`.

## Mandatory Outcomes

### 1. Page Header And Purpose

Add a clear header:

- title: `Teachers`
- purpose: `Review the teacher roster and scheduling load before assigning classes.`
- primary action: `Sync teachers` or `Refresh teacher roster`

The header must state whether the page is live, checking, saved, or unavailable.

### 2. Roster Health Summary

Add compact inline stats:

- active teachers
- teachers with load
- teachers without load
- overloaded/review-needed teachers
- last sync time when available

### 3. Plain Source-State Copy

Use the shared labels:

- `Verified live`
- `Checking source`
- `Using saved data`
- `No saved data`

Do not show raw `runtime` wording as primary copy.

### 4. Row Improvements

Improve row communication:

- teacher name remains primary
- department/specialization is secondary
- adviser section is visible but calm
- load state uses readable status labels: `Within load`, `Needs review`, `No teaching load`, `Excluded`
- action text makes the destination clear: `Review teaching load`

### 5. Profile/Detail Surface

Teacher detail/profile sheet must have accessible title/description and answer:

- current scheduling load
- assigned subjects/sections
- adviser/home-room context
- source freshness
- next action to fix load if needed

### 6. Empty/Error States

When no teachers are available, show:

- what happened
- why it matters
- a clear `Sync from EnrollPro` or retry action

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/teachers` desktop
- `/teachers` mobile portrait
- filter/search behavior
- teacher detail/profile sheet

Check:

- no raw `runtime` copy in primary visible state labels
- no native `<select>`, no raw `title`, no `<details>`
- no global horizontal overflow
- source-state tooltip is understandable

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-teachers-desktop-after.png`
- `qa-artifacts/playwright/20260530-admin-teachers-profile-after.png`
- `qa-artifacts/playwright/20260530-admin-teachers-mobile-after.png`

## Required Output

Return files changed, roster-health summary, copy changes, screenshots, build result, and `GO`/`NO-GO`.
