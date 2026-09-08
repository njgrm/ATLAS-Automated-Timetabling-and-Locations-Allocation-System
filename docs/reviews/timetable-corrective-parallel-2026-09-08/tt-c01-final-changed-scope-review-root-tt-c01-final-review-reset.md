# TT-C01 Final Changed-Scope Advisory Review After Usage Reset

- Covered tasks: TT-C01.1, TT-C01.2, TT-C01.3, TT-C01.4, TT-C01.5, TT-C01.6, TT-C01.R
- Reviewer context: `/root/tt_c01_final_review_reset`
- Implementer context: `/root`
- Prior reviews: `tt-c01-advisory-review-root-tt-c01-review.md`; `tt-c01-changed-scope-rereview-root-tt-c01-rereview.md`
- Review type: fresh changed-scope advisory review after the R1 scoped-client fix
- Reviewed tracked-diff identity: `992d89d6af862684162626c2b21dbee4c4d397b7` (`git hash-object --stdin` over the tracked diff for `useTimetableMutations.ts`, `useScheduleReviewWorkspaceState.ts`, `timetableSchoolScope.ts`, and `timetable-runtime-truth.test.ts`; the two new files are untracked and were inspected directly)
- Verdict: `NO-GO`
- zeroFix: `false`

## Files inspected

- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/components/timetable/timetableSchoolScope.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/lib/__tests__/timetable-runtime-truth.test.ts`
- `docs/progress/timetable-corrective-parallel-2026-09-08-progress.md`
- both prior review artifacts named above

## Independently rerun commands

| Command | Result |
|---|---|
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts` | PASS, 9/9, exit 0 |
| `npx tsc --noEmit` | PASS, exit 0, zero diagnostics |
| `git diff --check` | PASS, exit 0, line-ending warnings only |
| targeted source scan for `createTimetableScopedClient`, scope sentinels, nullable casts, readiness guards, actor rebind, and mojibake signatures | Scoped proxy wiring is present; actor rebind/readiness/mojibake remain intact; the material residual below remains |

## Verified changed-scope behavior

- `useTimetableMutations` routes its local `atlasApi` calls through `createTimetableScopedClient(schoolId, atlasApiClient)`.
- The scoped client validates a positive integer school ID synchronously before invoking the raw client method. Its executable fake-client test covers `get`, `post`, `put`, `patch`, and `delete`; unresolved scope leaves the raw-call count unchanged.
- The school-2 executable path is `/generation/2/8/runs`.
- Actor scope is re-resolved through `/auth/me`; a changed resolved school clears runs, draft, violations, and selected-run state before the dependency-driven refetch.
- The readiness guard, single repair action, and known-mojibake scan remain present and pass their focused checks.
- No product source, ledger, runtime process, Tailnet configuration, generation state, publication state, or database state was mutated by this reviewer.

## Material finding requiring a fix

### F1 - The prior R1 no-sentinel requirement is still not implemented

The previous review required removal of the `?? 0` workspace-context sentinels. They remain at `useScheduleReviewWorkspaceState.ts:1489`, `:1490`, and `:1492`. The focused test also positively requires this residual via `assert.match(contents[2], /schoolId: schoolId \?\? 0/)`, so the passing 9/9 result protects the defect instead of rejecting its reintroduction.

The immediately preceding `if (!schoolId) return {}` makes these three expressions currently evaluate to the resolved school during normal control flow, but that does not satisfy the explicit changed-scope correction or the fail-closed contract. It retains a fabricated school identity in request-capable context construction and makes the negative control inconsistent with the reviewed requirement. The same hook also uses `schoolId as number` for collaboration context at line 801, which is a compile-time assertion rather than runtime validation; the implementation should carry a validated positive school ID into all request-capable contexts without sentinel substitution or unchecked casts.

Required fix: after the positive school-scope guard, pass the narrowed validated school ID directly to all workspace and collaboration contexts; remove all three `?? 0` substitutions and the unchecked nullable cast; change the focused source contract so it rejects sentinel/cast reintroduction. Rerun the 9-test runtime-truth file, client TypeScript, and `git diff --check`, reconcile TT-C01.2 and TT-C01.R in the ledger, then obtain one new fresh changed-scope review.

## Ledger consequence

The ledger says review 2 R1 is fixed, safe incomplete tasks are zero, and only reviewer availability was missing. F1 makes that stale: TT-C01.2 remains safe incomplete work, the prior R1 is not fully closed, and TT-C01.R cannot be marked zero-fix. The conservative source state remains `SOURCE_IMPLEMENTATION=IN_PROGRESS` until the residual is corrected and freshly reviewed.

## Boundary and evidence notes

- Parallel boundary: this review inspected only TT-C01 allowed product files, tests, and artifacts. Other dirty active-stream files were not attributed to TT-C01 and were not edited.
- Tests: no removed or reduced assertions were observed in this changed-scope review; the issue is that one new assertion enforces the wrong sentinel contract.
- Runtime: authenticated desktop/mobile Timetable evidence remains separately blocked as recorded in the ledger; this source finding is safe to fix and is not externally blocked.

## Final verdict

`NO-GO`, `zeroFix: false`. The scoped raw-client dispatch guard is sound for the five tested HTTP methods, but the final review cannot close while the prior R1 no-sentinel requirement remains in production and is positively enforced by the focused test.
