# TT-C01 Advisory Review

- Covered tasks: TT-C01.1, TT-C01.2, TT-C01.3, TT-C01.4, TT-C01.5, TT-C01.6
- Reviewer context: `/root/tt_c01_review`
- Implementer context: `/root`
- Review type: fresh advisory changed-scope review
- Reviewed diff identity: `git hash-object --stdin` over the allowed tracked TT-C01 diff = `7b7ed02a4828a665956edd23c60adf3797c00de4`
- Verdict: `NO-GO`
- zeroFix: `false`

## Files inspected

- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/lib/__tests__/timetable-runtime-truth.test.ts`
- `docs/verification/timetable-tailnet-route-preview-2026-09-08.md`
- `docs/verification/timetable-scheduler-successor-map-2026-09-08.md`
- `docs/progress/timetable-corrective-parallel-2026-09-08-progress.md`
- `atlas-client/src/lib/enrollpro-public-settings.ts` (read-only dependency inspection)
- `atlas-server/src/services/hybrid-scheduler.ts` (read-only dependency inspection)

## Independently rerun decisive commands

| Command | Result |
|---|---|
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts src/lib/__tests__/simple-timetable-state.test.ts src/lib/__tests__/simple-timetable-decision-flow.test.ts` | PASS, 29/29 |
| `npx tsc --noEmit` | PASS, zero diagnostics |
| `git diff --check` | PASS, zero diagnostics |
| `tailscale serve status` | Funnel proxies `https://njgrm.buru-degree.ts.net/` to `http://127.0.0.1:5174` |
| targeted source scans for school fallbacks, request paths, cache keys, readiness guards, and known mojibake signatures | Exposed the findings below; no known mojibake remained in the two corrected components |

## Findings and required fixes

### F1 — Product/runtime — actor-school change does not invalidate or refetch timetable state (material)

The prompt explicitly requires changing actor school to invalidate/refetch scoped Timetable state. Production code resolves `/auth/me` only inside `fetchSchoolYear()`, while `loadAll()` skips `fetchSchoolYear()` whenever `schoolYearId` is already populated (`useTimetableData.ts:1499`). Therefore a session whose authenticated actor changes from school 1 to school 2 can retain the old `schoolId`, runs, selected run, draft, and references. School-qualified cache keys prevent cross-school reuse only after a new school ID is actually resolved; they do not cause actor scope to be re-resolved.

Required fix: make actor scope an explicit bootstrap/refetch dependency, clear all school-scoped page state when it changes, and refetch the active year and Timetable slices for the new actor school. Add a behavioral negative-control test that drives school 1 -> school 2 and asserts old state is invalidated and subsequent requests use school 2.

### F2 — Safety/test enforcement — unresolved scope is not proven fail-closed across mutation/request paths (material)

The new test is a source-regex test. It rejects `DEFAULT_SCHOOL_ID` and checks cache-key text, but it never executes the request-producing hooks, never supplies actor school 2, and never proves zero requests for an unresolved actor. Production also substitutes `schoolId ?? 0` into collaboration and built contexts (`useScheduleReviewWorkspaceState.ts:801,1488-1491`), while mutation URLs interpolate a nullable school ID derived from `schoolYearContext` (`useTimetableMutations.ts:415`). The visible error/skeleton normally limits reachability, but this is not an explicit fail-closed request boundary and the required negative control is absent.

Required fix: reject unresolved scope before constructing/dispatching every covered data and mutation request, avoid sentinel school `0`, and add executable hook/request-spy coverage for school 2, unresolved scope with zero generation/publish/edit/reconciliation/quick-placement/repair/export requests, and actor-school change invalidation. The negative control must demonstrably fail if the guard is bypassed.

### F3 — Process/docs — progress ledger is stale and cannot support handoff (material until reconciled)

The ledger still marks TT-C01.1 `IN_PROGRESS`, TT-C01.2 through TT-C01.6 `TODO`, and the review pending even though source, tests, and verification artifacts exist. It also does not contain the current test/build/rendered evidence or an accurate stop-eligibility matrix. Under the shared fail-closed rules, the conservative state is `SOURCE_IMPLEMENTATION=IN_PROGRESS` and the prompt cannot be handed off as `REVIEW_REQUIRED` yet.

Required fix: after product fixes and reruns, reconcile task statuses, exact commands/counts, changed-file inventory, runtime evidence, reviewer context/artifact, remaining risks, and stop-eligibility matrix in the ledger. This reviewer did not edit the planner/implementer-owned ledger.

## Other reviewed boundaries

- Mojibake: the known malformed sequences in `TimetableSimpleHeader.tsx` and `TimetableTaskDrawer.tsx` are corrected; the focused scan passes.
- Readiness: generation reaches a readiness guard and the simple no-run surface exposes one Curriculum Requirements repair link for a blocked server response. No generation was invoked in this review.
- Tailnet: current Serve target remains `127.0.0.1:5174`; the preview is read-only and authorizes no mutation. This review did not alter Serve or any process.
- Scheduler: the successor artifact correctly describes the inspected scheduler as relocating already-scheduled entries without inserting `unassignedItems`.
- Parallel boundary: the reviewed product diff is confined to allowed Timetable files. Other dirty forbidden-stream files were present but were not reviewed as TT-C01 implementation and were not edited by this reviewer.
- Rendered evidence: no independent desktop/mobile browser rerun was completed in this advisory pass; existing implementer evidence cannot cure F1/F2.
- Mutation proof: this reviewer performed read-only source inspection, tests, type checking, Git checks, and Serve observation only.

## Final verdict

`NO-GO`, `zeroFix: false`. Fix F1 and F2, reconcile F3, rerun affected focused gates, and obtain one fresh changed-scope advisory review as required by TT-C01.R.
