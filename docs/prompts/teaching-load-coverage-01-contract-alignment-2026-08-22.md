# Prompt 01 — Teaching Load Coverage Contract Alignment

## Role

You are the ATLAS coverage-contract executor. Implement only this prompt. Do not build the Teaching Load subject view yet.

## Problem

Dashboard and Subjects currently use weak subject-level coverage signals. A subject may show `Ready` if any teacher has that subject, even when one or more required section-subject rows are uncovered. ATLAS already has a better backend endpoint: `/api/v1/faculty-assignments/coverage/summary`.

## Target files

- `atlas-client/src/types.ts`
- `atlas-client/src/lib` or `atlas-client/src/hooks` for a focused coverage-summary helper
- `atlas-client/src/hooks/useDashboardData.ts`
- `atlas-client/src/pages/Subjects.tsx` only for wiring preparation, not UI overhaul
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- Tests near existing frontend/backend coverage or readiness tests

## Out of scope

- Adding the Teaching Load `Subjects` tab.
- Redesigning `/subjects`.
- Changing Teaching Load ownership rows.
- Changing generation or publish gates.

## Requirements

- The system shall expose subject-section coverage as the canonical setup-readiness signal for teacher coverage.
- The system shall preserve `/subjects/stats/:schoolId` compatibility if existing callers still use it.
- The client shall have a typed coverage-summary shape with at least:
  - `subjectId`
  - `subjectCode`
  - `subjectName`
  - `relevantSectionCount`
  - `ownedSectionCount`
  - `ownedByRealFacultyCount`
  - `ownedByPlaceholderCount`
  - `uncoveredSectionCount`
  - `coveragePercent`
  - `status`
- If practical, the backend coverage row shall include uncovered section identifiers and labels. Keep it additive and backward compatible:
  - `uncoveredSections: Array<{ sectionId: number; sectionName: string; gradeLevel: number; programType: string }>`
- Dashboard readiness shall derive `unassignedSubjectCount` from coverage rows with `uncoveredSectionCount > 0`, not from active subjects with no faculty subject rows.
- If coverage summary cannot load, then Dashboard shall keep its existing degraded/source-state behavior and avoid falsely showing zero missing coverage.

## Implementation guidance

- Reuse `getActiveSubjectCoverageSummary` in `faculty-assignment.service.ts`.
- Keep backend additions lightweight. Do not load generation payloads or timetable drafts.
- Keep auth behavior consistent with existing `/faculty-assignments/coverage/summary`.
- Add a small client helper such as `fetchTeachingLoadCoverageSummary` if that matches current API patterns.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Add or update focused tests proving:

- partially covered subjects are counted as missing coverage;
- fully covered subjects are not counted as missing coverage;
- zero-coverage subjects are counted as missing coverage;
- legacy `/subjects/stats/:schoolId` behavior is either preserved or explicitly documented as legacy.

## Acceptance criteria

- One typed coverage-summary contract exists on the client.
- Dashboard teacher-coverage readiness uses subject-section coverage.
- No Teaching Load ownership rows are modified.
- Prompt 02 can consume the coverage rows without recomputing the coverage universe in the browser.

## Final report required

Report files changed, coverage contract shape, command results, tests added, and whether Prompt 02 can proceed.
