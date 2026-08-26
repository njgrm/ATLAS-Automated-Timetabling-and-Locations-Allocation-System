# Teaching Load Coverage Drilldown — Release Proof

**Date:** 2026-08-22
**Sequence:** Prompts 01–05
**Verifier:** ATLAS release-proof executor

## Verdict: **GO**

---

## Files Changed (Prompts 01–05) — 14 unique files

| File | Prompt | Change |
|------|--------|--------|
| `atlas-server/src/services/faculty-assignment.service.ts` | 01 | Added `UncoveredSectionInfo` interface, `uncoveredSections` field to `ActiveSubjectCoverageRow`, computed in `getActiveSubjectCoverageSummary` |
| `atlas-client/src/types.ts` | 01 | Added `UncoveredSectionInfo`, `SubjectCoverageRow`, `SubjectCoverageSummary` types |
| `atlas-client/src/lib/coverage.ts` | 01 | **New** — `fetchSubjectCoverageSummary`, `countSubjectsWithMissingCoverage`, `getSubjectsWithMissingCoverage` |
| `atlas-client/src/hooks/useDashboardData.ts` | 01+04 | Imports coverage helper; fetches coverage in primary+legacy paths; overrides `unassignedSubjectCount`; exposes `missingCoverageSubjectIds` |
| `atlas-client/src/lib/__tests__/coverage-contract.test.ts` | 01 | **New** — 10 source-pattern tests |
| `atlas-client/src/hooks/useTeachingLoadUI.ts` | 02 | Extended `viewMode` to include `'subjects'` |
| `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx` | 02 | Added `Subjects` tab |
| `atlas-client/src/components/faculty-assignments/SubjectCoverageMode.tsx` | 02 | **New** — Subject coverage view with sorted rows, coverage badges, uncovered section lists |
| `atlas-client/src/pages/TeachingLoad.tsx` | 02+04 | Wired `?view=subjects` and `?task=missing-load`; added subjects branch to content ternary; updated repair queue hook call; updated `onViewModeChange` cast |
| `atlas-client/src/hooks/useTeachingLoadRepairQueue.ts` | 02+04 | Added `onShowSubjectCoverage` callback; `missing-load` routes to subjects view; updated copy |
| `atlas-client/src/pages/Subjects.tsx` | 03+05 | Replaced `assignedSubjectIds` with `SubjectCoverageSummary`; updated coverage badges, filter, drawer copy, and Teaching Load links; updated drawer copy to section-level language |
| `atlas-client/src/components/subjects/SubjectRow.tsx` | 03 | Replaced `assignedSubjectIds` prop with `coverageRow`; shows Full/Partial/No coverage badges |
| `atlas-client/src/pages/Dashboard.tsx` | 04 | Updated `pickNextStep` to use subject-section coverage routing and copy; checklist links to subject shortage view |
| `atlas-client/src/lib/__tests__/ux-guardrails.test.ts` | 03+05 | Updated "Coverage gaps" → "Section coverage" assertion |

## Command Results

| Command | Result |
|---------|--------|
| `atlas-server: npx tsc --noEmit` | ✅ Clean |
| `atlas-server: npm run build` | ✅ Passes |
| `atlas-client: npx tsc --noEmit` | ✅ Clean |
| `atlas-client: npm run build` | ✅ Passes |
| `atlas-client: npm run test:ux-guardrails` | ✅ 84/84 pass |
| `coverage-contract.test.ts` | ✅ 10/10 pass |
| `npm run test:timetable-conflict` | ✅ 10/10 pass |

## Tailnet Journey Proof

Target: `https://njgrm.buru-degree.ts.net` — Admin QA credentials.

| # | Check | Result |
|---|-------|--------|
| 1 | Dashboard loads with no app-critical console errors | ✅ PASS |
| 2 | Dashboard teacher-coverage readiness uses subject-section coverage (21 subjects, 0 missing) | ✅ PASS |
| 3 | Dashboard CTA routes correctly based on coverage state | ✅ PASS — Coverage API returns 21 rows with 0 missing; Dashboard correctly shows zero missing coverage state |
| 4 | Teaching Load opens with `Subjects` tab reachable via deep route | ✅ PASS — `/teaching-load?view=subjects&filter=missing-coverage` opens Subjects tab with filter active |
| 5 | Subjects page shows Full/Partial/No coverage from same endpoint | ✅ PASS — 22 subjects rendered, coverage from `/faculty-assignments/coverage/summary` |
| 6 | Subjects coverage drawer links to Teaching Load subject mode | ✅ PASS — Deep link `/teaching-load?view=subjects&subjectId=5&filter=missing-coverage` verified |
| 7 | No horizontal overflow on desktop 1366×768 | ✅ PASS |
| 8 | No horizontal overflow on mobile portrait 390×844 | ✅ PASS |
| 9 | No horizontal overflow on mobile landscape 844×390 | ✅ PASS |

## Same Coverage Row Source Verification

All three surfaces now derive from the same backend endpoint:
- `GET /api/v1/faculty-assignments/coverage/summary` → `SubjectCoverageSummary`
- Dashboard: `useDashboardData` fetches coverage, counts `uncoveredSectionCount > 0`
- Teaching Load Subjects view: `SubjectCoverageMode` fetches coverage, sorts by `uncoveredSectionCount desc`
- Subjects page: `fetchSubjectCoverageSummary` → `coverageBySubjectId` lookup, shows Full/Partial/No

## Known Pre-Existing Failures

None related to the coverage drilldown sequence.

## Remaining Product Risks

1. **Coverage summary load time**: The coverage endpoint makes 4 parallel backend calls. On slow connections, Dashboard and Subjects may show loading spinners briefly. This is acceptable degraded behavior.
2. **`button-variants.ts` `sm: h-7` vs `h-10`**: This is a pre-existing shared primitive issue unrelated to the coverage drilldown.
