# TT-WARNING-AUTHORITY-C04 — executor handoff

- Lane: S2 `TT-WARNING-AUTHORITY-C04` (parallel with S1 `TT-DYNAMIC-WORKSPACE-C04`
  and S3 `TT-TL-AUTHORITY-GUARD-C04`).
- Worktree: `D:\ATLAS-worktrees\tt-warning-authority-c04`
- Branch: `work/tt-warning-authority-c04`
- Base SHA: `e3882ca0356e04545fadaa9dbfa5cd1261ba64b5`
- Correction round: 1 of 2 (F1 blocking parity gap + F2 server half).
- Candidate tip: this commit (the commit that updates this file); immutable range
  `e3882ca0...<tip>`.
- Risk tier: MEDIUM full-stack source with HIGH publication-authority
  implications. No live mutation, deployment, generation, publication,
  migration, restart, or login.
- Return: `REVIEW_REQUIRED`.

## Correction delta (round 1, commit `b0b6c98a`)

- F1: `pre-generation-draft.service.ts` now exports
  `buildPreGenerationValidatorContext` with an exported structural
  `PreGenerationValidatorContextSource`; all internal call sites renamed; new
  R6 parity test assembles the same representative schedule through generation
  `buildPreflightValidatorContext`, manual `buildValidatorCtx`, and the pre-gen
  builder and asserts identical `{code,severity}` multisets, with a
  requiredFeatures-drop mutant proving the control is load-bearing.
- F2: `generation.service.ts` `RunSummary.blockingHardViolationCount` computed
  with `isPromotableConstraintCode` over run-wide violations (keeps
  `hardViolationCount` for display); `buildViolationReport` exposes run-wide
  `counts.runWide.blockingHard`; client `resolveHardViolationCount` prefers
  `blockingHard` (legacy fallback to `hard` = fail-closed); `simplePublishReadiness`
  classifies non-allowlisted HARD codes as informational via
  `isBlockingHardViolation`/`isInformationalHardViolation`.

## Changed paths (all packet §2 owned)

Server services: `constraint-validator.ts`, `scheduling-policy.service.ts`,
`generation-preflight.service.ts`, `pre-generation-draft.service.ts`,
`manual-edit.service.ts`, `generation.service.ts`,
`publication-contract.service.ts`.
Server tests: new `__tests__/timetable-warning-authority-c04.test.ts`;
updated `timetable-candidate-domain.test.ts`,
`publication-contract-readiness.test.ts`.
Client: `hooks/useTimetableData.ts`, `types.ts`,
`components/timetable/ScheduleReviewWorkspace.constants.ts`,
`components/timetable/simplePublishReadiness.ts`,
`components/timetable/GeneratedRunRailPanels.tsx`,
`components/ExplainabilityDrawer.tsx`, `components/PolicyImpactSummary.tsx`,
`components/SchedulingPolicyPane.tsx`,
`components/scheduling-policy/PolicyPanePrimitives.tsx`, deleted
`components/SchedulingPolicySheet.tsx` (no importers), new
`lib/__tests__/timetable-warning-authority-contract.test.ts`.
Handoff: `docs/handoffs/tt-warning-authority-c04-executor.md`.

No forbidden path touched (verified: no register, `CHANGELOG.md`, runtime map,
`useScheduleReviewWorkspaceState.ts`, `useTimetableMutations.ts`, other
`components/timetable/**`, `generation-input-snapshot.service.ts`,
`timetable-*.service.ts` outside the owned list, or `reconciliation*`).

## Trace table — requirement -> production path -> negative control -> verification

| Req | Production path | Negative control | Verification | Status |
|---|---|---|---|---|
| R1 retire travel | validator no longer emits `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` or reads `Building.x/y`; UI master + walking-distance field removed; publication excludes it | legacy HARD travel zero publication effect; source assertions | R1 rows in new suite | PASS |
| R2 floor/building | `FACULTY_FLOOR_TRANSITION`; `buildingTransitionBufferMinutes` policy field; `Room.floor`-only; term-aware | 1/2-floor no-warn, 3-floor warn; gap 4 warns / 5,6 no; cross-building none | R2 rows | PASS |
| R3 family decoupling | `resolveWarningFamilyPolicy`; read normalization; aligned defaults | master OFF does not gate idle/early/late; raw room-cap promotion inert | R3 rows | PASS |
| R4 promotion allowlist | allowlist; typed 400 `CONSTRAINT_NOT_PROMOTABLE`; on-read coercion; validation + publication allowlist-only | raw HARD promotion stays SOFT; non-allowlisted HARD publishes | R4 rows + `publication-contract-readiness` | PASS |
| R5 term-aware grouping | `groupEntriesByTerm` across daily/consecutive/break/idle/early/late/vacant/compression/transitions | 3-term 4×45 → 0 HARD; term-blind 540-min mutant; genuine same-term overload still HARD | R5 rows | PASS |
| R6 context parity | manual, pre-gen, and generation builders consume features/requiredFeatures/floor/effective hours/term identity from one contract; pre-gen builder now exported for the parity leg | **parity control: generation == manual == pre-gen `{code,severity}` multisets**; requiredFeatures-drop mutant breaks parity; existing manual features/effective-hours mutants | R6 parity rows + mutants | PASS |
| R7 client contract | `types.ts` codes+count scope; guarded label/search/gate resolvers; `buildViolationReport` `scope`/`runWide`/`blockingHard` | unknown code no throw; run-wide vs selected-term; ordering | client suite | PASS |
| R8 coverage | every touched family + publication effect covered; no policy-less context relied on | failing-first mutants | both new suites | PASS |
| R9 strict predicate | `isPublishedSummary === true`; `assertRunIsEditable`; `loadRunContext` | superseded passes; genuine published 409 | R9 rows | PASS |
| F2 blocking-hard | `RunSummary.blockingHardViolationCount`; `counts.runWide.blockingHard`; client gate consumes it; readiness classifies non-allowlisted HARD informational | `buildViolationReport` fixture: hard 3 vs blockingHard 2; retired travel HARD is informational in client | F2 rows (server + client) | PASS |

## Production-shape parity row

- Real producer: `constraint-validator.validateHardConstraints` → persisted
  `GenerationRun.violations`; read-model `generation.buildViolationReport`.
- Real consumer: `useTimetableData` (label/search, run-wide gate) →
  `simplePublishReadiness` blocker classification and rail rendering.
- Conservation: code identity (`ROOM_FEATURE_MISMATCH`,
  `FACULTY_FLOOR_TRANSITION`) across server `VIOLATION_CODES`, client union, and
  both label maps; severity preserved; **run-wide** `counts.runWide.blockingHard`
  (gate) vs selected-term `violations` (display); display ordering preserved.
- Negative controls: R5 term-blind mutant; R4 raw-promotion mutant; F2
  allowlist vs every-HARD fixture; R6 requiredFeatures-drop parity mutant;
  unknown-code label/search mutant. Result: PASS.

## Legacy-run residual (F2, explicit)

No owned read/projection path rewrites persisted run summaries. `buildDraftReport`
returns the raw persisted `summary`, so **legacy runs created before this change
lack `summary.blockingHardViolationCount`**. The gate path is nevertheless
covered for legacy runs because `buildViolationReport` derives
`counts.runWide.blockingHard` from the persisted `violations` array for any run
(read at `GET .../runs/:id/violations` and `.../latest/violations`), and the
client gate prefers `counts.runWide.blockingHard`; when both server fields are
absent the client falls back to the unfiltered `runWide.hard`, which is
fail-closed (may over-block, never under-block). Call path verified:
`getRunViolations`/`getLatestRunViolations` → `buildViolationReport` →
`useTimetableData.resolveHardViolationCount`.

## Decisive command results (post-correction)

Server (`atlas-server`):
- `npx tsc --noEmit` / `npm run build`: PASS (exit 0).
- `tsx src/__tests__/timetable-warning-authority-c04.test.ts`: **31 pass / 0 fail**
  (incl. F2 and R6 parity + parity mutant).
- `npm run test:timetable-sync-setup`: **16 pass / 0 fail / 0 skip** (disposable
  PostgreSQL; zero-write controls A–I and R5-A–D).
- `tt-output-c03r3`: exit 0; `timetable-candidate-domain`: exit 0;
  `publication-contract-readiness`: exit 0.
- Generation suites (`generation-canonical-readiness-genc02`,
  `generation-stakeholder-shape-genc02r`, `generation-rotation-totals-genc02r1`,
  `generation-production-trigger-genc02r1`): all exit 0.
- `git diff --check`: clean.
- `test:hybrid-scheduler`, `test:timetable-quick-place`,
  `test:preference-wellbeing`: BLOCKED(BASE_TEST_UNTRACKED_4794bd9e).

Client (`atlas-client`):
- `npx tsc --noEmit`: PASS (exit 0); `npm run build`: PASS (exit 0).
- `npm run test:timetable-operator-ux`: **58 pass / 0 fail**.
- `npx tsx --test src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts`: **21 pass / 0 fail**.
- `npx tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts`:
  **6 pass / 0 fail** (incl. F2 informational classification).
- `test:ux-guardrails`: BLOCKED(BASE_TEST_UNTRACKED_4794bd9e).

## Base-defect blocked rows

`4794bd9e` untracked these files; not copied in, not re-added:
`atlas-server/src/__tests__/hybrid-scheduler.test.ts`,
`timetable-quick-place.test.ts`, `preference-wellbeing.test.ts`,
`atlas-client/src/lib/__tests__/ux-guardrails.test.ts`,
`public-schedule-grade.test.ts`.

## Browser rows

`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` for all rendered policy-pane and
rail-label rows (no reusable Tailnet session; login not authorized). No
`ISOLATED_LOCAL_BROWSER` build used.

## Risks

- BLOCKING: none identified in-scope.
- NON_BLOCKING:
  1. Five packet-referenced test suites are untracked at the base; substitutes
     above are the mandatory evidence.
  2. Legacy runs without `summary.blockingHardViolationCount` rely on
     `counts.runWide.blockingHard` (derived from persisted violations) or, if
     absent, the fail-closed unfiltered display fallback — documented above.
  3. R4 allowlist is structural-only (consecutive/break HARD severities are not
     publication blockers), documented in `PROMOTABLE_CONSTRAINT_CODES`.
  4. `SchedulingPolicyPane.tsx` reduced to 995 lines via `WarningFamilyFields`
     extraction (pre-existing >1000 at base).

`REVIEW_REQUIRED`
