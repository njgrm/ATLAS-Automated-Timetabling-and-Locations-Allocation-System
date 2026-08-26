# Phase 4 Bundle A QC Checklist

Date: 2026-03-31  
Owner: Planner/QC  
Execution owner: Claude (Copilot)

## Purpose

Pass/fail gate for Bundle A before proceeding to Bundle B.

## 1) Technical Validation

### Server

- [ ] `cd atlas-server && npx tsc --noEmit` passes with zero errors.
- [ ] New faculty profile fields compile in Prisma client usage.
- [ ] No router/service import or type regressions.

### Client

- [ ] `cd atlas-client && npx tsc --noEmit` passes with zero errors.
- [ ] New/updated type definitions align with API responses.
- [ ] No build-time regressions in pages touched by Bundle A.

## 2) Backend Contract Checks

- [ ] `PATCH /api/v1/faculty/:id` accepts and persists:
  - `employmentStatus`
  - `isClassAdviser`
  - `advisoryEquivalentHours`
  - `canTeachOutsideDepartment`
- [ ] Optimistic lock still returns conflict (`409`) on stale `version`.
- [ ] `GET /api/v1/faculty?schoolId=...` includes new fields.

## 3) Teaching Load UX Checks

- [ ] Assignment page clearly separates:
  - `Primary Subjects (Qualified)`
  - `Other Subjects (Outside Department)`
- [ ] `Allow outside department (emergency)` exists and defaults OFF.
- [ ] When toggle is OFF, outside-department items are visibly disabled.
- [ ] When toggle is ON, outside-department items become selectable.
- [ ] Subject search works within assignment UI.
- [ ] Load legend/tooltips reflect `30h soft / 40h hard`.

## 4) Drilldown Flow Checks

- [ ] Faculty page has a clear “open teaching load details” path per teacher.
- [ ] Subjects page supports per-subject teacher coverage drilldown by grade.
- [ ] Subject drilldown exposes room allocation references where data exists.
- [ ] Room allocation rows include deep-link to map context.

## 5) Grade Label Normalization

- [ ] `Sections`, `Subjects`, `ScheduleReview`, and `FacultyAssignments` use `Gx` labels.
- [ ] No remaining user-facing `Grade 7/8/9/10` strings in these target views (except static help text intentionally kept).

## 6) Regression Sweep

- [ ] `ScheduleReview` manual edit flow still works (open panel, preview, commit).
- [ ] Unassigned list remains visible and interactive.
- [ ] Existing room schedule pages and dashboard room overlays still render.

## Exit Criteria

Bundle A passes only when all critical checks are green:

- Technical Validation (server + client) = pass
- Backend Contract Checks = pass
- Teaching Load UX Checks = pass
- Drilldown Flow Checks = pass
- Grade Label Normalization = pass
- Regression Sweep = pass

