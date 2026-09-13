# TT-WARNING-AUTHORITY-C04 — executor handoff

- Lane: S2 `TT-WARNING-AUTHORITY-C04` (parallel with S1 `TT-DYNAMIC-WORKSPACE-C04`
  and S3 `TT-TL-AUTHORITY-GUARD-C04`).
- Worktree: `D:\ATLAS-worktrees\tt-warning-authority-c04`
- Branch: `work/tt-warning-authority-c04`
- Base SHA: `e3882ca0356e04545fadaa9dbfa5cd1261ba64b5`
- Candidate tip: this commit (the commit that adds this file); immutable range
  `e3882ca0...<tip>`.
- Risk tier: MEDIUM full-stack source (validator, policy, read models, client
  labels) with HIGH publication-authority implications. No live mutation,
  deployment, generation, publication, migration, restart, or login.
- Return: `REVIEW_REQUIRED`.

## Changed paths (all inside packet §2 owned paths)

Server:
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/generation-preflight.service.ts`
- `atlas-server/src/services/pre-generation-draft.service.ts`
- `atlas-server/src/services/manual-edit.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/publication-contract.service.ts`
- `atlas-server/src/__tests__/timetable-warning-authority-c04.test.ts` (new)
- `atlas-server/src/__tests__/timetable-candidate-domain.test.ts`
- `atlas-server/src/__tests__/publication-contract-readiness.test.ts`

Client:
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`
- `atlas-client/src/components/timetable/simplePublishReadiness.ts`
- `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`
- `atlas-client/src/components/ExplainabilityDrawer.tsx`
- `atlas-client/src/components/PolicyImpactSummary.tsx`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/scheduling-policy/PolicyPanePrimitives.tsx`
- `atlas-client/src/components/SchedulingPolicySheet.tsx` (deleted — no importers)
- `atlas-client/src/lib/__tests__/timetable-warning-authority-contract.test.ts` (new)

No forbidden path was touched (no other `components/timetable/**`,
`useScheduleReviewWorkspaceState.ts`, `useTimetableMutations.ts`,
`timetable-*.service.ts` outside owned list, `generation-input-snapshot.service.ts`,
`CHANGELOG.md`, living register, or runtime map).

## Trace table — requirement -> production path -> negative control -> verification

| Req | Production path | Negative control | Verification | Status |
|---|---|---|---|---|
| R1 retire travel | `constraint-validator.validateHardConstraints` no longer emits `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` or reads `Building.x/y`; UI master switch + walking-distance field removed (`SchedulingPolicyPane.tsx`, `PolicyPanePrimitives.tsx`); `publication-contract.countBlockingHardViolations` excludes it | Legacy persisted HARD travel has zero publication effect; source assertions (`estimatedDistanceMeters`, `.x-`, `.y-` absent) | `tsx src/__tests__/timetable-warning-authority-c04.test.ts` R1 rows | PASS |
| R2 floor/building | validator §7 identity-based transitions; new `FACULTY_FLOOR_TRANSITION`; `buildingTransitionBufferMinutes` policy field; `Room.floor` authority only; term-aware | 1/2-floor no-warn, 3-floor warns; gap 4 warns / 5,6 no; cross-building no floor warning; per-term counts | R2 rows, same suite | PASS |
| R3 family decoupling | `resolveWarningFamilyPolicy`; `DEFAULT_CONSTRAINT_CONFIG`; `getOrCreatePolicy` read normalization; UI families independent | master OFF does not gate idle/early/late; raw `ROOM_CAPACITY_EXCEEDED.treatAsHard` cannot promote | R3 rows, same suite | PASS |
| R4 promotion allowlist | `PROMOTABLE_CONSTRAINT_CODES`/`isPromotableConstraintCode`; `upsertPolicy` typed 400 `CONSTRAINT_NOT_PROMOTABLE`; `normalizeConstraintConfigPromotion` read coercion; validator promotion gate; publication derives hard only from allowlist | mutation fixture: raw HARD building-transition promotion stays SOFT and blocks nothing; `publication-contract-readiness` non-allowlisted HARD publishes | R4 rows + `tsx src/__tests__/publication-contract-readiness.test.ts` | PASS |
| R5 term-aware grouping | `groupEntriesByTerm` used by daily/consecutive/break/idle/early/late/vacant/compression/transitions | 3-term 4×45 fixture: 0 HARD; term-blind merge reproduces 540-min block; genuine same-term overload still HARD | R5 rows, same suite | PASS |
| R6 context parity | `manual-edit.buildValidatorCtx`, `pre-generation-draft` context and `generation-preflight.buildPreflightValidatorContext` carry features/requiredFeatures/floor/effective hours/family flags; `LockedSession.termIndex` survives preview | dropping features hides mismatch; raw hours hides overload | R6 rows, same suite | PASS |
| R7 client contract | `types.ts` codes + count scope; `useTimetableData` `resolveViolationLabel`/`matchesViolationSearch`/`resolveHardViolationCount`; `generation.buildViolationReport` `counts.scope`+`runWide`; rail labels | unknown code no throw; run-wide hard vs selected-term display; ordering preserved | `tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts` | PASS |
| R8 coverage | new server 28-row suite + client 5-row suite cover every touched family and publication effect; no policy-less context relied on | failing-first mutants in suite | both new suites | PASS |
| R9 strict predicate | `manual-edit.isPublishedSummary` (`=== true`), `assertRunIsEditable`, consumed by `loadRunContext` | superseded run with retained markers passes; genuine published run 409 | R9 rows, same suite | PASS |

## Production-shape parity row

- Real producer: `constraint-validator.validateHardConstraints` → persisted
  `GenerationRun.violations`; read-model `generation.buildViolationReport`.
- Real consumer: `atlas-client/src/hooks/useTimetableData.ts` (label resolver,
  search, run-wide hard gate) → `GeneratedRunRailPanels.tsx` / gate consumers.
- Conservation: code identity (`ROOM_FEATURE_MISMATCH`, `FACULTY_FLOOR_TRANSITION`
  present in server `VIOLATION_CODES`, client union, and both label maps);
  severity preserved; **run-wide** `counts.runWide.hard` vs **selected-term**
  `violations`/`counts.total`; display order preserved through the filter.
- Negative controls: R5 term-blind 540-minute mutant; R4 raw `treatAsHard`
  promotion mutant; unknown-code label/search mutant. Result: PASS.

## Decisive command results

Server (`atlas-server`):
- `npm run build` / `npx tsc --noEmit`: PASS (exit 0).
- `tsx src/__tests__/timetable-warning-authority-c04.test.ts`: 28 pass / 0 fail.
- `npm run test:timetable-sync-setup`: 16 pass / 0 fail / 0 skip (disposable
  PostgreSQL; zero-write controls A–I and R5-A–D included).
- `tsx src/__tests__/tt-output-c03r3.test.ts`: 12 pass / 0 fail.
- `tsx src/__tests__/timetable-candidate-domain.test.ts`: 12 pass / 0 fail.
- `tsx src/__tests__/generation-canonical-readiness-genc02.test.ts`: 16 pass / 0 fail.
- `tsx src/__tests__/generation-stakeholder-shape-genc02r.test.ts`: 12 pass / 0 fail.
- `tsx src/__tests__/generation-rotation-totals-genc02r1.test.ts`: 7 pass / 0 fail.
- `tsx src/__tests__/generation-production-trigger-genc02r1.test.ts`: 5 pass / 0 fail.
- `tsx src/__tests__/publication-contract-readiness.test.ts`: PASS (exit 0).
- `tsx src/__tests__/derived-demand-correction-c01r2.test.ts`: PASS (exit 0).
- `npm run test:hybrid-scheduler`, `npm run test:timetable-quick-place`,
  `npm run test:preference-wellbeing`: BLOCKED(BASE_TEST_UNTRACKED_4794bd9e).
- `git diff --check`: clean.

Client (`atlas-client`):
- `npm ci`: 235 packages.
- `npx tsc --noEmit`: PASS (exit 0).
- `npm run build`: PASS (exit 0; chunk-size warning only).
- `npm run test:timetable-operator-ux`: 58 pass / 0 fail.
- `npx tsx --test src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts`: 21 pass / 0 fail.
- `npx tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts`:
  5 pass / 0 fail.
- `npm run test:ux-guardrails`: BLOCKED(BASE_TEST_UNTRACKED_4794bd9e).

## Base-defect blocked rows (base `e3882ca0`, ancestor commit `4794bd9e`)

`chore(repo): remove local-only files from tracking` untracked these test files;
they are absent from the tracked tree in this clean worktree and were **not**
copied in or re-added:

- `atlas-server/src/__tests__/hybrid-scheduler.test.ts`
- `atlas-server/src/__tests__/timetable-quick-place.test.ts`
- `atlas-server/src/__tests__/preference-wellbeing.test.ts`
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `atlas-client/src/lib/__tests__/public-schedule-grade.test.ts`

## Browser rows

`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` for all rendered policy-pane and
rail-label rows: the persistent Playwright profile holds no reusable Tailnet
session and login is not authorized by this packet. No browser row was executed;
no `ISOLATED_LOCAL_BROWSER` build was used.

## Risks

- BLOCKING: none identified in-scope.
- NON_BLOCKING:
  1. Five packet-referenced test suites are untracked at the base; their
     substitutes above are the mandatory evidence.
  2. R4 intentionally excludes `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` /
     `FACULTY_BREAK_REQUIREMENT_VIOLATED` HARD severities from publication
     blocking (allowlist is structural-only). Documented in
     `PROMOTABLE_CONSTRAINT_CODES`.
  3. `SchedulingPolicyPane.tsx` was pre-existing over 1000 lines; reduced to 995
     by extracting `WarningFamilyFields` into the owned primitives file.
  4. Disposable-PostgreSQL evidence is via `test:timetable-sync-setup`; no new
     Prisma schema/migration was introduced.

`REVIEW_REQUIRED`
