# TT-SHAPE-DIAGNOSTIC-C02 advisory review 01

Date: 2026-09-12
Role: independent changed-scope advisory reviewer
Reviewed tree: `D:\ATLAS-worktrees\tt-shape-diagnostic-c02`
Base/HEAD at review: `8f48a2fe6ea883189221e196c7a3d28ddcb629b8` with the candidate changes uncommitted (there is no candidate SHA yet).

## Recommendation

`REVIEW_REQUIRED` — do not integrate or treat this candidate as GO. The pure policy tests pass and the server production build completes, but two production-path gaps can allow an invalid shape to be treated as ready, and the required canonical entry-point coverage is incomplete.

## Evidence captured

| Check | Result |
|---|---|
| `npx tsx src/__tests__/timetable-shape-diagnostic-c02.test.ts` (atlas-server) | PASS, 8/8 |
| `npx tsx src/__tests__/generation-stakeholder-shape-genc02r.test.ts` (atlas-server) | PASS, 12/12; existing canonical scheduler/readiness coverage |
| `npm run build` (atlas-server) | PASS, `tsc` exit 0 |
| `git diff --check` | PASS |
| Live generation/publication/mutation | Not run, per boundary |
| Browser/Tailnet | Not needed for this read-only source review |

## Findings

### [P1] Empty derived demand can still report `READY`

`atlas-server/src/services/generation-readiness.service.ts:175-252` runs the scheduler whenever `assembly.schedulerCanRun` is true, then computes `generateAllowed` from `sortedBlockers.length === 0`, `scheduler.ran`, zero hard violations, and zero writes. There is no assertion that the derived authority has at least one timetable line/pair or that the result has at least one assigned entry. With active sections, policy, rooms, and canonical slots but an empty derived demand, the scheduler can run with zero entries and zero unassigned items; the shape validator has no lines to inspect and readiness can become `READY`. This violates the explicit requirement that an empty schedule must never be reported ready.

Required correction: add a production-path typed blocker (or reuse an existing non-empty-demand blocker) before `generateAllowed` is computed, and add a real `buildGenerationReadiness` regression fixture with zero demand/zero output that fails the old behavior.

### [P1] Custom flag ceremony scope is not validated on the real policy input

The policy validator only examines the optional normalized `flagCeremony` object (`atlas-server/src/services/timetable-shape-policy.service.ts:184-186`). The preflight call hard-codes `dayOfWeek: 'MONDAY'` whenever `policyRow.enableFlagCeremony` is true (`atlas-server/src/services/generation-preflight.service.ts:907-908`); it does not pass or inspect the enabled `specialEvents` rows loaded at `:700`. A persisted/custom `FLAG CEREMONY` row with `dayOfWeek: 'TUESDAY'`, `WEEKDAYS`, or null is therefore accepted by the production diagnostic. Additionally, when canonical rows exist, `buildTimetableShapeContract` takes the canonical branch and maps special rows without carrying `dayOfWeek` (`atlas-server/src/services/schedule-constructor.ts:442-454`), so the output display shape cannot prove Monday-only scope.

Required correction: validate the actual policy special-event records (event type/label, enabled state, day scope, and non-demand row kind) and preserve day scope through canonical/display shape construction. Add a mounted preflight/readiness negative control that injects a non-Monday flag row and expects `FLAG_CEREMONY_SCOPE_INVALID`.

### [P2] Section/teacher/room output parity is helper-only, not bound to the canonical output entry point

`validateTimetableShapePolicy` checks `outputProjections` only when a caller supplies that optional field (`atlas-server/src/services/timetable-shape-policy.service.ts:205-211`). The readiness path passes entries but never supplies section, teacher, and room projections (`atlas-server/src/services/generation-readiness.service.ts:199-208`), and no changed production call constructs those projections. The new test proves the optional helper with synthetic arrays, but it does not prove the real schedule output shape parity contract. A mismatch in one consumer projection can therefore evade this candidate's diagnostic.

Required correction: bind parity to the actual canonical section/teacher/room output builders (or explicitly prove those builders already enforce identical entry identities) and add a real entry-point mutant that drops one projection row.

### [P2] Required real canonical diagnostic coverage is missing

`atlas-server/src/__tests__/timetable-shape-diagnostic-c02.test.ts` exercises pure validators and `buildSpecialEventSlots`, but does not call `buildGenerationPreflight`, `buildGenerationReadiness`, or the production schedule-constructor assembly. The existing stakeholder suite passes, but it predates these new blockers and does not assert the new typed blockers or custom-event scope. The handoff explicitly requires real canonical diagnostic/schedule-constructor entry-point tests; this candidate's new test suite does not meet that gate.

Required correction: add disposable-client tests through `buildGenerationPreflight`/`buildGenerationReadiness` with zero-write assertions, including missing rooms, stale/missing term authority, non-Monday flag event, HG/ARAL demand, cross-shift output, and empty output.

## Positive observations

- Ordered term validation is data-driven: TRIMESTER requires three contiguous terms, QUARTERS requires four, and the tests correctly preserve future Q4 support without adding Q4 to the current trimester.
- HG/ARAL demand is rejected by the new validator and the preflight subject filter excludes both codes.
- The constructor's policy fallback annotates the global flag ceremony as `MONDAY`, and the focused constructor test passes.
- Cross-shift entry times and mismatched optional projection keys are rejected by the pure contract.
- The source remains read-only for the requested lane: no generation, publication, migration, deployment, or live mutation was run.

## Scope and diff notes

Changed source is limited to `generation-preflight.service.ts`, `generation-readiness.service.ts`, `schedule-constructor.ts`, plus the new policy service and focused test. No `derived-demand.service.ts`, generation assembly, publication, Teaching Load, or shared planning document was edited. The worktree is dirty and uncommitted; the primary planner must record the eventual candidate SHA after correction and rerun fresh QA.

## Next planner action

Keep the stream at `REVIEW_REQUIRED`; return the two P1 findings to the executor for correction, require real mounted canonical entry-point mutants and zero-write evidence, then obtain a fresh changed-scope advisory/QA review before any integration decision. Do not run generation or publication.

## Fresh changed-scope rerun after corrections

Review boundary: the same uncommitted worktree after the executor added `EMPTY_DERIVED_DEMAND`/`EMPTY_SCHEDULE_OUTPUT`, custom `FLAG_OR_HGP` scope plumbing, and readiness-side projection parity. The tree still has no candidate commit SHA; `HEAD` remains `8f48a2fe6ea883189221e196c7a3d28ddcb629b8`.

| Check | Result |
|---|---|
| Focused `timetable-shape-diagnostic-c02.test.ts` | PASS, 8/8 |
| Existing `generation-stakeholder-shape-genc02r.test.ts` | PASS, 12/12 |
| `npm run build` (atlas-server) | PASS, `tsc` exit 0 |
| `git diff --check` | PASS on the changed tracked files |
| Live generation/publication/mutation | Not run |

The empty-schedule finding is corrected in the production flow: preflight now emits `EMPTY_DERIVED_DEMAND` and disables `schedulerCanRun` for zero demand (`generation-preflight.service.ts:897-898, 977`), while readiness adds `EMPTY_SCHEDULE_OUTPUT` for zero entries (`generation-readiness.service.ts:185-202`). Custom event day scope is now carried into the effective event/shape (`policy-special-events.ts:21-31, 138`; `schedule-constructor.ts:443-462`) and preflight inspects `FLAG_OR_HGP` (`generation-preflight.service.ts:909-923`).

### Remaining [P1] schema/contract regression: ordinary `FLAG_OR_HGP` rows have no day field

The persisted `PolicySpecialEvent` model has no `dayOfWeek` column (`prisma/schema.prisma:721-738`), and the existing special-event write API accepts no day field (`policy-special-event.service.ts:31-55, 109-155`). Therefore a normal persisted `FLAG_OR_HGP` row arrives at preflight with `configuredFlagEvent.dayOfWeek === undefined`; the new expression converts that to `null` (`generation-preflight.service.ts:923`). The policy validator treats null/undefined as not Monday (`timetable-shape-policy.service.ts:178-180`) and emits `FLAG_CEREMONY_SCOPE_INVALID`. This can block every school that has an enabled flag/HGP special-event row, even though the existing schema's only representable scope is the fixed Monday contract.

The focused test does not catch this: it tests a synthetic Tuesday constructor row and a direct `dayOfWeek: 'MONDAY'` validator input, but no schema-shaped row with the field absent. Add a regression proving a schema-shaped `FLAG_OR_HGP` row defaults to Monday (or explicitly add and migrate a persisted day field under a separately authorized schema change), while still rejecting an explicitly non-Monday input if that future authority is introduced.

### Remaining [P2] readiness parity assertion is tautological

Readiness now supplies all three projection arrays, but it constructs each array from the same `result.entries` and the same key `${entry.entryId}:section` (`generation-readiness.service.ts:222-226`). The validator therefore cannot observe a section/teacher/room consumer mismatch; all three sets are guaranteed equal by construction. The changed test only invokes `validateOutputShapeParity` with synthetic arrays (`timetable-shape-diagnostic-c02.test.ts:137-142`), not the real projection builders. Bind this check to the actual distinct section, teacher, and room output projections or add a negative control that mutates one real projection before validation.

### Remaining [P2] real canonical entry-point gate is still unproven

The new focused test remains pure-validator plus constructor coverage. It does not invoke `buildGenerationPreflight` or `buildGenerationReadiness` with a disposable client, does not prove the new typed blockers through the route/service boundary, and does not prove zero-write behavior for the custom flag or empty-demand mutants. The existing stakeholder suite passes, but it predates these added policy blockers. The handoff's required real canonical diagnostic/schedule-constructor gate therefore remains incomplete.

## Fresh recommendation

`REVIEW_REQUIRED` remains. The empty-output correction is accepted, and the focused suites/build remain green, but the schema-shaped flag-event regression is a production P1 blocker. Projection parity and real entry-point coverage remain P2 review gaps. Correct the flag default/authority contract, add mounted zero-write negative controls, and obtain another fresh advisory plus QA before integration. Do not run generation or publication.

## Executor correction after fresh rerun

The executor subsequently corrected the schema-shaped flag case in
`generation-preflight.service.ts`: an absent `dayOfWeek` on an existing
`FLAG_OR_HGP` record now resolves to the fixed contract day `MONDAY`, while an
explicit non-Monday value remains visible to `FLAG_CEREMONY_SCOPE_INVALID`.
The P1 is therefore closed for this candidate without changing the Prisma
schema or special-event write API. The two P2 findings remain: readiness
projection parity is constructed from the same entry set, and the new C02
suite does not independently mount disposable `buildGenerationPreflight` /
`buildGenerationReadiness` mutants. Final disposition remains
`REVIEW_REQUIRED`.

## Final fresh review at committed HEAD

Reviewed commit: `96987627f347d8c505a6fdf13f68483fdc6fa824` (`fix(timetable): add shape policy diagnostics`). The worktree was clean before this advisory update; no source files were changed during review.

| Check | Result |
|---|---|
| `timetable-shape-diagnostic-c02.test.ts` | PASS, 8/8 |
| `generation-stakeholder-shape-genc02r.test.ts` | PASS, 12/12 |
| `npm run build` (atlas-server) | PASS, `tsc` exit 0 |
| `git diff --check HEAD^ HEAD` | PASS |
| Schema-shaped Monday default probe | PASS: an absent `dayOfWeek` on `FLAG_OR_HGP` is normalized to `MONDAY` at `generation-preflight.service.ts:909-912`; direct Monday policy validation returns no blocker |
| Explicit non-Monday control | PASS at pure policy layer: `WEEKDAYS` returns `FLAG_CEREMONY_SCOPE_INVALID` |
| Generation/publication/mutation | Not run, per boundary |

The prior P1 schema-shaped flag regression is closed. The committed correction preserves the no-schema-change contract: an absent `dayOfWeek` on the existing `FLAG_OR_HGP` model defaults to Monday, while an explicitly supplied non-Monday value remains rejectable. Empty demand/output guards are also present at `generation-preflight.service.ts:897-907, 977` and `generation-readiness.service.ts:188-201`.

Remaining findings:

### [P2] Readiness projection parity remains tautological

The readiness validator receives section, teacher, and room projection arrays, but all three are generated from the same `result.entries` and the same `${entry.entryId}:section` key (`generation-readiness.service.ts:222-226`). This proves only that the diagnostic's three locally synthesized arrays agree; it cannot detect a mismatch in a distinct downstream projection builder. The focused test's mismatch control is synthetic (`timetable-shape-diagnostic-c02.test.ts:137-142`).

### [P2] Real canonical diagnostic entry-point coverage remains incomplete

The new C02 test suite remains pure policy/constructor coverage. It does not independently mount `buildGenerationPreflight` or `buildGenerationReadiness` with a disposable client, assert the new typed blockers through those production entry points, or prove zero-write behavior for the custom flag, missing-room, HG/ARAL, stale-term, and empty-output mutants. The existing stakeholder suite exercises broader assembly/readiness behavior, but it predates these C02-specific blockers.

## Final recommendation

`REVIEW_REQUIRED` — the committed candidate is materially corrected and passes the focused source/build gates, including the schema-shaped `FLAG_OR_HGP` Monday default. Do not mark GO or integrate until the P2 output-parity binding and real canonical entry-point/zero-write tests are addressed or explicitly accepted by the planner. Do not run generation or publication.
