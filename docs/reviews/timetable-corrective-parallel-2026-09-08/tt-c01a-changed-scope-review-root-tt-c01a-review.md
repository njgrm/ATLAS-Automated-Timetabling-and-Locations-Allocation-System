# TT-C01A Changed-Scope Advisory Review

- Review date: 2026-09-08
- Implementer context: `/root`
- Reviewer context: `/root/tt_c01a_review`
- Reviewed base commit: `f4ec1e766b4805d9333ce0827692fa1e6086ea77`
- Review scope: `atlas-client/src/hooks/useTimetableCollaboration.ts`, `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts`, the collaboration call in `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`, and the TT-C01 ledger/review artifacts
- Source identities at review: collaboration hook SHA-256 `4D6894E2C7E4C451F01CD648178BD30D1E3E8E888C58068B23C424690424A6E6`; caller SHA-256 `F48558D4F578352DD98CB1B9D266E53F5999DC0F71D261A2F25454C882A88D88`; focused test SHA-256 `1CEB37AE5B2F156362141D0B07BB6CAE9ABF34D8E904FBEAFC2D47DA94DB5CF1`

## Clauses inspected

- Nullable actor-school collaboration input with no `0`, `1`, or other fallback.
- Positive integer school, school year, and run plus token before socket construction, join, or send.
- Scope transition cleanup of the previous socket, connected state, presence, remote selections, timers, and socket references.
- Executable production-hook negative controls for unresolved and changed scope, including a guard-bypass control.
- TT-C01A's narrow mutation boundary and its required verification commands.

## Findings

### F1 — HIGH — The required transition controls do not execute the production hook lifecycle

`useTimetableCollaboration.test.ts` imports and calls the extracted connection and send helpers directly. Its “school 1 to null” case explicitly calls `school1.close()` and then creates a separate null connection; its “school 1 to school 2” case explicitly closes one helper connection and creates another. Neither case renders or rerenders `useTimetableCollaboration`. Consequently, the suite does not prove that a real dependency change invokes the hook cleanup, clears `connected`, `presence`, and `remoteSelections`, cancels `pendingSelectionTimerRef`, clears `connectionRef`/`socketRef`, or prevents a timer queued by the old render from sending after scope becomes unresolved. This misses the central behavior required by TT-C01A’s “using the production hook” and scope-transition clauses.

Required fix: exercise `useTimetableCollaboration` itself through a hook-capable test harness and an injected/recording socket boundary. Rerender the same mounted hook from school 1 to null and from school 1 to school 2, populate collaboration state through emitted events, queue a throttled selection before the transition, and assert the old socket closes, exposed state clears, the timer cannot send, and only the new school joins/sends.

### F2 — HIGH — The test-only guard override is a production invariant bypass

`CreateTimetableCollaborationConnectionOptions.scopeGuard` is accepted by production code and replaces the mandatory school validator. Passing a predicate that returns true constructs a socket with a null runtime school ID. The negative-control test demonstrates this bypass and catches an intentionally failing assertion with `assert.throws`, but the production boundary itself remains bypassable. A required fail-closed invariant must not be configurable by a caller.

Required fix: remove the injectable `scopeGuard` from the production API. Implement the negative control outside the production boundary (for example, a test-owned mutant/harness that deliberately omits the school guard) so it proves the assertions detect the forbidden behavior without adding a bypass to shipped code.

### F3 — GATE — Client TypeScript is blocked by unrelated concurrent work

`npx tsc --noEmit` fails at `src/hooks/__tests__/dashboard-lifecycle-truth.test.ts(89,9)` because `assert.notMatch` is not defined on the imported strict assertion type. The error is outside TT-C01A’s authorized files and no TT-C01A TypeScript diagnostic appeared. This is an external gate blocker, not authorization to edit the Dashboard stream, but the mandatory TypeScript gate is not currently PASS.

## Independent command matrix

| Command | Result |
|---|---|
| `npx tsx --test src/hooks/__tests__/useTimetableCollaboration.test.ts` | PASS, 5/5 |
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts` | PASS, 9/9 |
| `npx tsx --test src/lib/__tests__/simple-timetable-state.test.ts src/lib/__tests__/simple-timetable-undo-contract.test.ts src/lib/__tests__/timetable-swap-routing.test.ts src/lib/__tests__/timetable-term-filter.test.ts src/lib/__tests__/timetable-display-slots.test.ts` | PASS, 62/62 |
| `npx tsc --noEmit` | FAIL, one out-of-scope Dashboard test diagnostic described in F3 |
| `git diff --check` | PASS; line-ending warnings only |

No production build or Tailnet browser matrix was rerun, as TT-C01A does not change rendered behavior and the prompt preserves the prior authenticated Tailnet evidence.

## Boundary and preservation review

- The caller now passes nullable `schoolId` directly; the collaboration call contains no cast or fallback.
- The reviewed collaboration source and focused test remain within TT-C01A’s explicit expansion.
- No test deletion or assertion reduction was identified in the reviewed scope.
- Other dirty Dashboard, Curriculum, Teaching Load, server, and user-artifact changes were treated as concurrent out-of-scope work and were not edited by this reviewer.

## Verdict

`NO-GO` for TT-C01A closure. `zeroFix: false`.

The source has a reasonable inactive-connection guard and cleanup structure, and the focused commands other than TypeScript pass. However, two material corrections remain: the tests do not exercise real hook transitions, and the shipped helper exposes a guard-bypass seam. After those are fixed, rerun the specified gates and obtain a new fresh changed-scope review. The separate TypeScript failure must also clear before the ledger can report every required gate as PASS and return `REVIEW_REQUIRED`.
