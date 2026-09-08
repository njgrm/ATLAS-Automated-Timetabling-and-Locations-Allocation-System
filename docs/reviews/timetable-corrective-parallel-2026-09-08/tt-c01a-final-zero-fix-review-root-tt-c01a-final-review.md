# TT-C01A Final Changed-Scope Advisory Review

- Review date: 2026-09-08
- Implementer context: `/root`
- Reviewer context: `/root/tt_c01a_final_review`
- Reviewed base commit: `f4ec1e766b4805d9333ce0827692fa1e6086ea77`
- Review type: fresh post-fix changed-scope advisory review
- Reviewed source identities:
  - `atlas-client/src/hooks/useTimetableCollaboration.ts`: SHA-256 `6B8EF17AF85BCE857F6970C5A304594B1334214ECDB030245E7FB150485DC265`
  - `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`: SHA-256 `F48558D4F578352DD98CB1B9D266E53F5999DC0F71D261A2F25454C882A88D88`
  - `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts`: SHA-256 `197796D7C1E0D6DB07E27F0C58648590557F9591B01BB581AD827E7B5C50EBCD`

## Scope and clauses reviewed

- TT-C01A nullable actor-school collaboration input and removal of the caller assertion.
- Positive-integer school, school-year, and run validation plus token presence before socket construction, join, or selection transmission.
- Cleanup on school-scope transition: socket closure, connected/presence/remote-selection reset, pending-timer cancellation, and connection/socket reference clearing.
- Production-hook transition tests using a deterministic hook runtime and recording socket.
- Test-owned unsafe mutant as the negative control, with no production guard override.
- Preservation of the narrow TT-C01 and TT-C01A mutation boundary.

## Prior finding closure

### F1 - CLOSED - Tests now execute the production hook lifecycle

The focused suite imports and invokes `useTimetableCollaboration` itself. Its harness preserves hook state, refs, effects, and cleanups across rerenders. The school 1 to null case opens the production connection, populates presence, sends one immediate selection, queues another throttled selection, rerenders to null scope, waits past the throttle interval, and proves the old socket closed, collaboration state cleared, no stale send occurred, and the connection, socket, and timer refs are null. The school 1 to school 2 case rerenders the same hook and proves the old socket closes while the new socket joins and sends only school 2 scope.

### F2 - CLOSED - Production scope validation is no longer bypassable

The production connection API has no `scopeGuard` or equivalent validation override. `isPositiveInteger` is applied to school, school year, and run before socket construction, and a missing token also returns before construction. The deliberately unsafe no-school-guard mutant exists only in the focused test; the assertion demonstrably fails when that mutant constructs a forbidden null-school socket.

### F3 - CLOSED - Client TypeScript gate is green

The prior out-of-scope Dashboard diagnostic is absent in this run. `npx tsc --noEmit` completes successfully with no TT-C01A or concurrent-work diagnostics.

## Independent command matrix

| Command | Result |
|---|---|
| `npx tsx --test src/hooks/__tests__/useTimetableCollaboration.test.ts` | PASS, 4/4 |
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts` | PASS, 9/9 |
| `npx tsx --test src/lib/__tests__/simple-timetable-state.test.ts src/lib/__tests__/simple-timetable-undo-contract.test.ts src/lib/__tests__/timetable-swap-routing.test.ts src/lib/__tests__/timetable-term-filter.test.ts src/lib/__tests__/timetable-display-slots.test.ts` | PASS, 62/62 |
| `npx tsc --noEmit` | PASS |
| `git diff --check` | PASS; line-ending warnings only |

No production build or Tailnet browser matrix was rerun. TT-C01A does not change rendered behavior, and the prompt explicitly preserves the existing authenticated Tailnet evidence.

## Boundary and preservation review

- The TT-C01A production change is in the explicitly authorized `atlas-client/src/hooks/useTimetableCollaboration.ts`.
- The single focused collaboration test is `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts`.
- The existing TT-C01-authorized caller now passes nullable `schoolId` directly; no cast, default-school constant, nullish `0`/`1`, or other school fallback remains at this boundary.
- The production hook creates no socket for null, zero, negative, fractional, or otherwise invalid tested scope; changed scope retires the captured old connection before a new connection is created.
- No test deletion or assertion reduction was identified in the reviewed scope.
- Other dirty Dashboard, Curriculum, Teaching Load, server, decision-workspace, and user-artifact files were treated as concurrent out-of-scope work and were not edited by this reviewer.
- No timetable generation, data mutation, service restart, schema/migration operation, external-repository edit, production build, or browser interaction was performed.

## Findings

No material findings. No required fixes.

## Verdict

`zeroFix: true`.

The post-fix TT-C01A changed scope satisfies the nullable actor-school, fail-closed socket construction/join/send, scope-transition cleanup, executable production-hook negative-control, verification, and parallel-boundary requirements. This advisory review supports ledger reconciliation and a `REVIEW_REQUIRED` handoff. It does not constitute Product GO and does not authorize TT-C02 or any runtime mutation.
