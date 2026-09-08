# TT-C01 Fresh Final Changed-Scope Advisory Review

- Covered tasks: TT-C01.1, TT-C01.2, TT-C01.3, TT-C01.4, TT-C01.5, TT-C01.6, TT-C01.R
- Reviewer context: `/root/tt_c01_zero_fix_review`
- Implementer context: `/root`
- Review type: fresh independent changed-scope advisory review after review-3 fixes
- Reviewed scoped-diff identity: `3a627b7361e302b3cdce265c7e88ab4daa53310bdd2c01271d64f5e2cd8899dc` (SHA-256 of the current diff for Timetable components, the four Timetable hooks present in the diff, and the scoped state/data/mutation files)
- Verdict: `NO-GO`
- zeroFix: `false`

## Governing clauses inspected

- TT-C01 strict parallel boundary: edits are limited to `atlas-client/src/components/timetable/**`, `useTimetableData.ts`, `useTimetableMutations.ts`, `useScheduleReviewWorkspaceState.ts`, Timetable-specific tests, and Timetable-specific artifacts.
- TT-C01 boundary stop rule: if required work crosses that boundary, document the dependency and stop that task rather than absorbing another stream's file.
- TT-C01.2: actor school must be resolved dynamically; unresolved scope must fail closed without school-1 fallback; school-2 paths and actor rebinding require negative controls.
- TT-C01.3: no-run generation must be gated by the server-owned curriculum-readiness result and expose one repair route.
- TT-C01.5: source tests, client TypeScript, diff checks, and desktop/mobile rendered evidence are required without generating or publishing.
- Shared fail-closed rules: a reviewer report cannot weaken the prompt boundary, and a phase cannot close while required safe work or an invalid review remains.

## Files inspected

- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/components/timetable/timetableSchoolScope.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/hooks/useTimetableCollaboration.ts`
- `atlas-client/src/lib/__tests__/timetable-runtime-truth.test.ts`
- `docs/progress/timetable-corrective-parallel-2026-09-08-progress.md`
- the three prior TT-C01 advisory-review artifacts
- `docs/verification/timetable-tailnet-route-preview-2026-09-08.md`
- `docs/verification/timetable-scheduler-successor-map-2026-09-08.md`

## Independently rerun commands

| Command | Result |
|---|---|
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts` | PASS, 9/9, exit 0 |
| `npx tsc --noEmit` | PASS, exit 0, zero diagnostics |
| `git diff --check` | PASS, exit 0; line-ending warnings only |
| scoped scans for `DEFAULT_SCHOOL_ID`, `schoolId ?? 0`, `schoolId as number`, and known mojibake signatures | PASS within the authorized Timetable component/data/mutation/state scope |

## Verified behavior

- The three `schoolId ?? 0` sentinels and the `schoolId as number` cast identified by review 3 are gone from `useScheduleReviewWorkspaceState.ts`.
- The focused source contract now rejects either sentinel or cast in that hook.
- `createTimetableScopedClient` validates scope before invoking the underlying client. The executable fake-client test proves one school-2 POST and zero raw dispatches for unresolved scope across GET, POST, PUT, PATCH, and DELETE.
- Run-list construction produces `/generation/2/8/runs` for actor school 2.
- `useTimetableData` re-resolves `/auth/me`; actor-school change clears run, draft, violations, and selected-run state before dependency-driven reload.
- No-run generation is guarded unless curriculum readiness is `ready`; the header contains one Curriculum Requirements repair action and renders the server-owned message.
- The focused UTF-8 scan finds none of the known malformed sequences in the corrected rendered-string components.
- The updated ledger records authenticated Tailnet evidence at 1280x720 and 390x844: no horizontal overflow or mojibake, one keyboard-focusable 44px repair target, and generation controls absent from the accessibility snapshot. This reviewer inspected that recorded evidence but did not independently repeat browser automation.
- The scoped HTTP guard itself is within the allowed files and has a valid executable negative control.

## Material finding requiring a fix

### F1 - The final correction edits a source file outside TT-C01's strict parallel boundary

The current diff changes `atlas-client/src/hooks/useTimetableCollaboration.ts`, but that hook is not in TT-C01's allowed-source list. The change widens `schoolId` from `number` to `number | null` and adds nullable guards before socket join and selection send. Its runtime intent is sound: null scope returns before socket creation/join/send and no school fallback is introduced. However, TT-C01 explicitly says required work that crosses the listed files must be documented and stopped, not absorbed. Review 3's request to remove the caller cast did not authorize widening the prompt boundary, and a reviewer finding cannot override the authoritative plan.

Required resolution: remove the out-of-boundary source edit from the TT-C01 package and record the collaboration typing/nullable boundary as a separate dependency, or obtain explicit planner/operator authorization that names `useTimetableCollaboration.ts` as writable scope. If authorization is granted, add a focused negative control that rejects a collaboration school fallback and proves unresolved scope reaches neither socket join nor selection send; the current 9-test file does not inspect or execute the collaboration hook.

## Other boundary observations

- The TT-C01 product edits other than `useTimetableCollaboration.ts` are confined to the listed Timetable components and three authorized hooks.
- Dirty Curriculum/Decision and Teaching Load files remain outside this review package. This reviewer did not edit them.
- No tests or assertions were removed in the reviewed package.
- No runtime process, Tailscale configuration, generation run, publication state, database state, or companion repository was mutated by this review.
- The Tailnet and scheduler artifacts remain read-only and state that they authorize no mutation.

## Ledger consequence

The ledger currently says TT-C01.2 is in review with zero safe incomplete implementation tasks and describes the collaboration change as part of the package. Because that source edit violates the authoritative mutation boundary, TT-C01.R cannot close with a zero-fix verdict. The ledger must conservatively count this boundary resolution as incomplete until the file is removed from the package or its scope is explicitly authorized and the missing collaboration negative control is added.

## Final verdict

`NO-GO`, `zeroFix: false`. The actor-school HTTP boundary, readiness behavior, UTF-8 closure, and recorded rendered evidence are sound, but the final package is not parallel-safe while it contains an unauthorized edit to `useTimetableCollaboration.ts`.
