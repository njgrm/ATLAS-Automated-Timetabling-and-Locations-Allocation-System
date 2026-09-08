# TT-C01B Final Collaboration-State Changed-Scope Advisory Review

- Review date: 2026-09-08
- Implementer context: `/root`
- Reviewer context: `/root/tt_c01b_review`
- Reviewed base commit: `f4ec1e766b4805d9333ce0827692fa1e6086ea77`
- Review type: fresh TT-C01B changed-scope advisory review
- Reviewed file inventory:
  - `atlas-client/src/hooks/useTimetableCollaboration.ts` — SHA-256 `5AD9F45A4401B14A42212528679EA5FF186DC5D0E635D7A6A1BD9E4E58D1B973`
  - `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts` — SHA-256 `1C2F541343D6C1F627C346E2359C1687E20BFA6FEEC6599EFB38BB6DD1E8F434`

## Scope and production-path review

The review covered only the TT-C01B collaboration-state correction and its focused production-hook tests. `useTimetableCollaboration` remains the production caller-visible hook; the test imports and rerenders that hook with a deterministic React-hook runtime and a recording implementation of the real socket boundary.

The connection effect identifies school, school year, run, authentication token, socket factory, and event callback in its dependencies. A transition in any scope identity runs the prior cleanup before attempting a replacement connection. The production connection factory rejects null, zero, negative, fractional, or otherwise non-positive-integer school/year/run scope and rejects missing authentication before socket construction. There is no school `0`, school `1`, or other fallback.

On cleanup, the old connection becomes inactive before its socket is closed. The reset clears connected state, presence, remote selections, last error, self connection ID, last-selection timestamp, and the pending timer. The effect cleanup then clears matching connection and socket references. The inactive connection guard prevents late old-socket events, and selection dispatch requires the current active connection with positive captured scope.

## Executable lifecycle evidence

- School 1 to null: the production hook receives connected, identity, error, presence, and selection state; it sends one immediate selection, queues a throttled selection, then rerenders unresolved. The old socket closes once, state and references clear, and waiting beyond the throttle deadline produces no stale send. The old error is absent.
- School 1 to school 2: cleanup closes the first socket and resets identity and timestamp. The new socket joins only school 2. A school-2 snapshot retains a participant whose connection ID equals the old school-1 self ID, proving the old ID cannot filter the new snapshot. The first school-2 selection sends synchronously despite the immediately preceding school-1 selection, proving the prior throttle timestamp was cleared.
- Authentication loss: rerendering the production hook without a token closes the live socket, creates no replacement, and clears connected/error/reference state.
- Invalid scope: null, zero, negative, fractional school IDs, an invalid year, and an invalid run construct zero sockets.
- Negative control: the test-owned unsafe mutant deliberately constructs on null scope, and the zero-construction assertion demonstrably throws. No guard-bypass seam exists in production.

## Independent command matrix

| Command | Result |
|---|---|
| `npx tsx --test src/hooks/__tests__/useTimetableCollaboration.test.ts` | PASS, 5/5 |
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts` | PASS, 9/9 |
| `npx tsx --test src/lib/__tests__/simple-timetable-state.test.ts src/lib/__tests__/simple-timetable-undo-contract.test.ts src/lib/__tests__/timetable-swap-routing.test.ts src/lib/__tests__/timetable-term-filter.test.ts src/lib/__tests__/timetable-display-slots.test.ts` | PASS, 62/62 |
| `npx tsc --noEmit` | PASS |
| `git diff --check` | PASS; line-ending warnings only |

No production build, browser matrix, service restart, database operation, generation, publication, TT-C02 work, or external-repository action was performed.

## Boundary and preservation review

- The implementation edit is confined to `atlas-client/src/hooks/useTimetableCollaboration.ts`.
- The test edit is confined to `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts`; this file is ignored by the repository's broad `*.test.*` rule and will require explicit force-add if later committed.
- The TT-C01B progress and review artifacts are within the explicitly authorized artifact boundary.
- The caller contains no `schoolId as number`, `schoolId ?? 0`, or `schoolId ?? 1` collaboration fallback.
- No test deletion or assertion reduction was identified in the reviewed scope.
- All other dirty timetable, Curriculum, Teaching Load, Dashboard, server, decision-workspace, and user files were treated as concurrent work and were not edited by this reviewer.

## Findings

No material findings. No required fixes.

## Verdict

`zeroFix: true`

The first fresh TT-C01B changed-scope review has zero material findings. It supports ledger reconciliation and a `REVIEW_REQUIRED` handoff. It is advisory evidence only and does not authorize TT-C02, Product GO, or runtime mutation.
