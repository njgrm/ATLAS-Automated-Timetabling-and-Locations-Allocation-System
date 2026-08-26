# Prompt 10E: Component Extraction And Repo Hygiene

## Context

You reduced `ScheduleReviewWorkspace.tsx`, but complexity moved into:

- `useScheduleReviewWorkspaceState.ts` over 1400 lines
- `ScheduleReviewDialogs.tsx` over 1400 lines

The latest commits also included generated `dist` churn, Playwright report artifacts, screenshots, and ad hoc root scripts. This makes the repo harder to review and maintain.

## Mission

Finish extraction honestly and clean repository hygiene.

## Required Changes

### 1. Split `useScheduleReviewWorkspaceState.ts`

Split into focused hooks:

- run selection/bootstrap
- drag/drop state
- dialog state
- collaboration state
- repair/placement actions
- view/filter state

### 2. Split `ScheduleReviewDialogs.tsx`

Split into smaller dialog components:

- publish dialog
- room request dialog
- assignment picker
- swap/placement confirmation
- edit history
- blocker/soft-warning dialogs

### 3. Reduce `any` Usage

- Replace broad `as any` context construction with typed context interfaces.
- Keep unavoidable casts localized and documented.

### 4. Repo Hygiene

- Remove ad hoc root QA scripts unless formalized under `qa-artifacts` with package scripts.
- Do not commit generated `dist` artifacts unless this repo intentionally tracks them.
- Do not commit transient Playwright reports/screenshots unless they are documented baselines.

## Verification

Run:

- `npm --prefix atlas-client run build`
- line-count scan for touched React/hook files
- primitive scan for touched React files

## Acceptance

- No touched React/hook file over 1000 lines.
- No new raw native controls.
- No temp root scripts.
- Changes are reviewable by feature area.

## Required Output

Return:

- files changed
- extraction map
- removed artifacts/scripts
- line-count evidence
- build result
- prompt-scope `GO` or `NO-GO`

