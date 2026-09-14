# TT-SOURCE-FRESHNESS-C04 — progress ledger

- Packet: `docs/prompts/timetable-source-freshness-one-shot-c04-2026-09-14.md`
- Worktree: `D:\ATLAS-worktrees\tt-source-freshness-c04` · branch `work/tt-source-freshness-c04`
- Base: `7f1fc7f6ad11abacb195d3848eb10b9484298121` (planner packet commit over `origin/main` `be1a2d6f`)
- Risk: MEDIUM source/authority. No deployment/login/live-data/generation/publication/migration/schema/companion action.
- Status: `REVIEW_REQUIRED` (candidate committed; see handoff)

## Decisions

- B-03 generation binding: capture ONE snapshot after preflight revalidation and before
  the QUEUED write; recompute the complete fingerprint with the transaction client
  inside the final Serializable persist transaction; typed `SOURCE_AUTHORITY_STALE`
  rethrown to the route after the existing FAILED lifecycle record.
- B-04 Quick Place: capture the snapshot before the solver; pass the expected
  fingerprint into `commitManualEditBatch`, which recomputes via the transaction
  client before any write and persists its tx-verified snapshot.
- B-09 hidden write: `loadRunContext` now uses a passive policy resolver
  (`resolveSchedulingPolicyForRead`) that never creates/normalizes; legacy promotions
  are normalized in memory only.
- B-06 ordered terms: `derivedDemand` snapshot domain already binds the canonical
  `termStructureRevision`; added explicit `termIdentities` (`order:identity`) so a
  changed/missing/reordered contract always changes the fingerprint.
- B-13/D5: a non-null retained `facultyId` is a reviewed pin. Valid (active +
  qualified for the subject/section) pins are preserved and counted; invalid pins
  abort the sync with typed `TEACHER_PIN_CONFLICT` and exact retained/conflicted
  totals. No silent rebinding. Correction C1 (below) completes the §3.5 client copy
  that states those totals.
- F3: added `blockingHardViolationCount` and `termCounts` to the manual-edit summary
  preserve list; Quick Place/sync already spread the persisted summary.
- F1: `/campus-rooms` → `/map` in `simplePublishReadiness.ts`; repair hrefs now
  resolve to a mounted route.
- F2: client parity test derives the server allowlist mechanically from the single
  server authority and exercises the real client consumers behaviorally.
- §3.10: executable test observes `{ isolationLevel: 'Serializable' }` on a
  successful apply and a stale rejection.
- §3.11: removed `upsertTeachingLoadCapabilityOverride`,
  `deleteTeachingLoadCapabilityOverride`, and their input interfaces after a
  mechanical zero-consumer search; retired 410 routes and shared helpers retained.
- Tally row 9: quick-place router enforces role, actor-school/active-year authority
  (reusing canonical `assertTeachingLoadWriteAuthority`), and run↔(school,year)
  identity before any service dispatch.
- `generation.service.ts:93-98` loose helper left untouched (no proven mutation/
  publication consumer) — reported as a bounded residual.

## Correction C1 (planner-directed, additive; base `eeb42697`)

- Defect: packet §3.5 requires "The response and client copy must state exact
  retained and conflicted totals." The server response carried both counts and the
  typed 409 `TEACHER_PIN_CONFLICT` message carried only the conflicted total; the
  client copy stated neither, and `SDK` classification fell through to `UNKNOWN`.
- Server `timetable-sync-setup.service.ts`: the typed `TEACHER_PIN_CONFLICT` message
  now states BOTH exact integers, interpolating the same `facultyPinConflicts.length`
  and `retainedFacultyPinCount` expressions used by `details`. No decision/zero-write
  logic, snapshot binding, or Serializable path changed.
- Client `lib/timetable-sync-setup.ts`: `SyncSetupSuccessData` now carries
  `retainedFacultyPinCount`/`conflictedFacultyPinCount`; `ERROR_KIND_BY_CODE` maps
  `TEACHER_PIN_CONFLICT: 'BLOCKED'`. Chosen kind: `BLOCKED` is an existing
  non-retryable kind (`retryable === kind === 'STALE'`) and no consumer branches on
  `kind` beyond the message/`retryable`, so it is the least-ripple review-required
  classification. One-line comment records the choice; no enum widening.
- Client copy: Advanced (`ScheduleReviewWorkspaceHeader`) and Simple
  (`SimpleDriftBanner`) success toasts state the exact retained reviewed-assignment
  count when > 0; `SyncTimetableConfirmDialog` copy now states that valid reviewed
  assignments/slot swaps are preserved, that an invalid reviewed assignment stops the
  sync with a conflict list for operator review, and that the result reports exact
  retained/conflicted totals. No layout/design change.

## Changed paths

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/generation-input-snapshot.service.ts`
- `atlas-server/src/services/manual-edit.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/timetable-quick-place.service.ts`
- `atlas-server/src/services/timetable-sync-setup.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/routes/timetable-quick-place.router.ts`
- `atlas-client/src/components/timetable/simplePublishReadiness.ts`
- `atlas-server/src/__tests__/helpers/tt-source-freshness-db.ts` (new)
- `atlas-server/src/__tests__/tt-source-freshness-generation-c04.test.ts` (new)
- `atlas-server/src/__tests__/tt-source-freshness-quick-place-c04.test.ts` (new)
- `atlas-server/src/__tests__/tt-source-freshness-sync-pin-c04.test.ts` (new)
- `atlas-server/src/__tests__/tt-source-freshness-capability-c04.test.ts` (new)
- `atlas-client/src/lib/__tests__/tt-source-freshness-client-c04.test.ts` (new)
- `docs/progress/tt-source-freshness-c04-progress.md`

Correction C1 additionally edits (additive commit on top of `eeb42697`):
- `atlas-server/src/services/timetable-sync-setup.service.ts` (message text only)
- `atlas-client/src/lib/timetable-sync-setup.ts`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceDialogs.tsx`
- `atlas-server/src/__tests__/tt-source-freshness-sync-pin-c04.test.ts`
- `atlas-client/src/lib/__tests__/tt-source-freshness-client-c04.test.ts`

## Gates run (all green on the final tree)

Server (disposable `atlas_restore_drill_*` DBs; no configured-DB writes):
- 5 new suites + `timetable-sync-setup` (each self-provisions a drill DB).
- `generation-production-trigger-genc02r1`, `generation-canonical-readiness-genc02`,
  `derived-demand-authority`, `derived-demand-correction-c01r2`, `tt-output-c03r3`,
  `tt-output-c03r3-placement-term`, `timetable-candidate-domain`,
  `publication-contract-readiness`, `capability-override-mount`,
  `timetable-warning-authority-c04`.
- `npx tsc --noEmit`; `npm run build`; built `dist/server.js` boot with
  `/api/v1/health` 200 and DB-backed `/api/v1/subjects?schoolId=1` 200.

Client:
- 5 new/existing suites (`timetable-warning-authority-contract`,
  `timetable-operator-workflow-state`, `timetable-dynamic-workspace-drift`,
  `uxc01r-generation-readiness`, `tt-source-freshness-client-c04`).
- `npx tsc --noEmit`; `npm run build`.

Repository: `git diff --check` clean.

### Correction C1 focused reruns (all exit 0 on the restored tree, SHA-256-verified)

- Server: `npx tsx src/__tests__/tt-source-freshness-sync-pin-c04.test.ts` (5/5,
  0 skipped) and `npx tsx src/__tests__/timetable-sync-setup.test.ts` (16/16,
  0 skipped, `DATABASE_URL` resolved from the durable runtime env; each
  self-provisions + drops an `atlas_restore_drill_*` DB); `npx tsc --noEmit`;
  `npm run build`.
- Client: `npx tsx --test src/lib/__tests__/timetable-sync-setup-contract.test.ts
  src/lib/__tests__/tt-source-freshness-client-c04.test.ts
  src/lib/__tests__/timetable-dynamic-workspace-drift.test.ts` (21/21, 0 skipped);
  `npx tsc --noEmit`; `npm run build`.

## Mutants (each failed its intended test; restored byte-for-byte by SHA-256)

| # | Mutant | Failing test | Restoration hash match |
|---|---|---|---|
| 1 | post-scheduling global snapshot replacement in generation | generation S2 ×5 | yes |
| 2 | remove final fingerprint comparison (generation) | generation S2 ×5 | yes |
| 3 | drop Quick Place tx-bound snapshot binding | quick-place Q2 ×3 | yes |
| 4 | allow passive policy creation | sync-pin C1 | yes |
| 5 | silently rebind an invalid teacher pin | sync-pin C3 | yes |
| 6 | drop `blockingHardViolationCount` from the summary merge | generation S1 | yes |
| 7 | remove `Serializable` from capability-override apply | capability P1/P2 | yes |
| 8 | restore `/campus-rooms` (client) | client F1 | yes |
| 9 | C1: remove exact totals from the server conflict message + all three client copy surfaces | sync-pin C3 (exit 1), client C04 dialog/toast copy ×2 (exit 1) | yes |

## Remaining risks

- BLOCKING: none identified.
- NON_BLOCKING: `generation.service.ts:93-98` loose `hasPublishedMarkers` helper
  (no proven consumer; residual). The former "client sync-dialog copy is S1-owned"
  residual is resolved by correction C1 (server message + all three client copy
  surfaces now state the exact retained/conflicted totals). Browser/render-consumer
  proof of `SimplePublishReadinessSheet` is limited to the real pure consumer +
  mounted-route resolution + wiring assertions at the node-test level (no jsdom
  available); correction C1 copy proof uses the same established static-source
  pattern.
