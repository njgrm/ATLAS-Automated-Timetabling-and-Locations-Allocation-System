# TT-C01 Changed-Scope Advisory Re-review

- Covered tasks: TT-C01.1, TT-C01.2, TT-C01.3, TT-C01.4, TT-C01.5, TT-C01.6, TT-C01.R
- Reviewer context: `/root/tt_c01_rereview`
- Implementer context: `/root`
- Prior review: `tt-c01-advisory-review-root-tt-c01-review.md`
- Review type: fresh changed-scope advisory re-review after F1-F3 fixes
- Reviewed tracked-diff identity: `a9b28a024ee9aa41d8c7152285e92f9ed879f41a` (`git hash-object --stdin` over the scoped tracked diff)
- Verdict: `NO-GO`
- zeroFix: `false`

## Files inspected

- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/components/timetable/timetableSchoolScope.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/lib/__tests__/timetable-runtime-truth.test.ts`
- `docs/progress/timetable-corrective-parallel-2026-09-08-progress.md`
- prior review artifact named above

## Independently rerun commands

| Command | Result |
|---|---|
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts src/lib/__tests__/simple-timetable-state.test.ts src/lib/__tests__/simple-timetable-decision-flow.test.ts` | PASS, 31/31 |
| `npx tsc --noEmit` | PASS, exit 0, zero diagnostics |
| `git diff --check` | PASS, zero whitespace errors; existing line-ending warnings only |
| targeted source scan for scope guards, sentinels, and nullable request interpolation | FAIL; material boundary below |

## Re-review results

- Actor scope is re-resolved on every `loadAll`/refresh through `await fetchSchoolYear()`.
- A resolved school change clears runs, draft, violations, and selected-run state, then the dependency-driven reload refetches using the new school.
- The school-2 path helper is executable and produces `/generation/2/8/runs`.
- The no-run readiness guard, single Curriculum Requirements repair action, server blocker copy, and known-mojibake scan remain correct.
- The ledger is substantially reconciled and truthfully retains TT-C01.5 as externally blocked and TT-C01.R pending.

## Material finding requiring a fix

### R1 — Unresolved actor scope is still not fail-closed at production mutation boundaries

`useTimetableMutations` derives `schoolId` as nullable (`schoolYearContext?.schoolId ?? null`) but most request-producing callbacks guard only `schoolYearId`, then interpolate `schoolId` directly. Representative paths include room-request preview/appeals/review, follow-up flags, generation, publish, pre-generation preview/commit/swap/delete, manual edits, Teaching Load repairs, reconciliation, and violation refreshes. `apiBase` and `teachingLoadRepairBase` also become request-capable `/generation/null/...` strings whenever a stale/non-null year and run coexist with unresolved actor scope.

The new test does not execute `useTimetableMutations` and does not spy on those production dispatches. It calls only `buildTimetableGenerationPath`, so its “unresolved actor scope dispatches no request” name overstates its proof. Its source contract also explicitly requires `schoolId: schoolId ?? 0` in workspace contexts. Although the current context-builder IIFE returns early when `schoolId` is absent, retaining the sentinel contradicts the requested no-sentinel boundary and does not repair the independently request-capable mutation hook.

Required fix: resolve a validated positive school ID before constructing every request base/path; make every covered callback fail closed when scope is unresolved; remove the `?? 0` context sentinels; and add executable production-hook/request-spy coverage for school 2, unresolved scope with zero requests across generation/publish/edit/reconciliation/quick-placement/repair/export operations, and actor-school rebinding. Include a negative control that fails when the production guard is bypassed.

## Ledger reconciliation consequence

The ledger currently reports TT-C01.2 DONE, safe incomplete tasks `0`, and only the fresh review as missing. R1 makes those claims stale: TT-C01.2 and its proof remain incomplete and safe to continue. Until fixed, `SOURCE_IMPLEMENTATION` must remain `IN_PROGRESS`, the stop matrix must count at least one safe incomplete task, and TT-C01.R cannot close.

## Final verdict

`NO-GO`, `zeroFix: false`. One material product/safety finding remains. Readiness and mojibake checks are unchanged and passing; the required unresolved-scope production proof and corresponding ledger reconciliation are not complete.
