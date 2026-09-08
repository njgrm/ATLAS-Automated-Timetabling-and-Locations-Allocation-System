# TT-C01B-R Restore and Seal Changed-Scope Advisory Review

- Review date: 2026-09-08
- Implementer context: `/root`
- Reviewer context: `/root/tt_c01b_restore_review`
- Reviewed base commit: `f4ec1e766b4805d9333ce0827692fa1e6086ea77`
- Review type: fresh TT-C01B-R changed-scope advisory review
- Reviewed file inventory:
  - `atlas-client/src/hooks/useTimetableCollaboration.ts` — SHA-256 `5AD9F45A4401B14A42212528679EA5FF186DC5D0E635D7A6A1BD9E4E58D1B973`
  - `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts` — SHA-256 `1C2F541343D6C1F627C346E2359C1687E20BFA6FEEC6599EFB38BB6DD1E8F434`

## Scope and production-path review

The review covered only the restored TT-C01B-R collaboration cleanup in `useTimetableCollaboration.ts` and the unchanged five-test executable contract. The focused test invokes and rerenders the exported production hook with a deterministic hook runtime and a recording socket implementation at the production socket boundary; its assertions are not source-regex substitutes.

The production connection requires positive integer school, school-year, and run IDs plus an authentication token before socket construction. It captures the validated school scope for its join, marks the connection inactive before closing its socket, ignores late events from an inactive socket, and permits selection transmission only through the active validated connection. No school `0`, school `1`, or other fallback is introduced.

React effect identity includes the school ID, school-year ID, run ID, and current authentication token. A change or loss of any identity runs the prior effect cleanup. That cleanup closes the prior connection and resets connected state, presence, remote selections, last error, self connection ID, last-selection timestamp, and any pending selection timer. It then clears the matching connection and socket references. Authentication-token loss therefore closes and clears the existing connection without constructing a replacement.

## Executable lifecycle evidence

- Invalid scope constructs zero sockets for null, zero, negative, or fractional school IDs, an invalid year, and an invalid run.
- School 1 to unresolved scope closes the old socket, clears collaboration state and references, removes the prior error, cancels the queued timer, and produces no stale selection send after the throttle deadline.
- School 1 to school 2 closes the old socket, joins only school 2, retains a school-2 participant whose connection ID equals the former school-1 self ID, and sends the first school-2 selection immediately. This proves both self-identity isolation and throttle reset.
- Authentication loss closes the active socket, clears state and references, and creates no replacement socket.
- The test-owned unsafe mutant deliberately bypasses the school guard and proves the zero-socket assertion fails. No guard-bypass seam exists in production.

## Independent command matrix

| Command | Result |
|---|---|
| `npx tsx --test src/hooks/__tests__/useTimetableCollaboration.test.ts` | PASS, 5/5 |
| `npx tsx --test src/lib/__tests__/timetable-runtime-truth.test.ts` | PASS, 9/9 |
| `npx tsx --test src/lib/__tests__/simple-timetable-state.test.ts src/lib/__tests__/simple-timetable-undo-contract.test.ts src/lib/__tests__/timetable-swap-routing.test.ts src/lib/__tests__/timetable-term-filter.test.ts src/lib/__tests__/timetable-display-slots.test.ts` | PASS, 62/62 |
| `npx tsc --noEmit` | PASS |
| `git diff --check` | PASS; line-ending warnings only |

No production build, Tailnet browser matrix, runtime restart, database operation, generation, publication, TT-C02 work, or external-repository action was performed.

## Boundary and preservation review

- The implementation change is confined to `atlas-client/src/hooks/useTimetableCollaboration.ts`.
- The existing test file was reviewed as the executable contract and matches the supplied unchanged SHA-256 value.
- This reviewer did not edit the production source, focused test, or progress ledger.
- No test deletion or assertion reduction was identified in the reviewed scope.
- Other dirty worktree files were treated as concurrent work and were not reviewed as TT-C01B-R changes.

## Findings

No material findings. No required fixes.

## Verdict

`zeroFix: true`

The restored production source matches the reviewed TT-C01B hash and satisfies the unchanged five-test contract. This artifact records the hashes that the implementer must compare byte-for-byte during the post-review immutability seal. It is advisory evidence only and does not authorize TT-C02, Product GO, or runtime mutation.
