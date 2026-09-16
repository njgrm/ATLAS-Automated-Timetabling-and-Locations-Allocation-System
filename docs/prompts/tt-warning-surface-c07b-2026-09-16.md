# TT-WARNING-SURFACE-C07B — Client warning and publish-readiness truth

ROLE: EXECUTOR (Lane B of the parent cycle `TT-WARNING-REALISM-C07R1`).

## 0. Immutable boundary

- Base SHA (frozen): `c950e6944f148343b8c864bea5aa080bd6a19426`
- Worktree: `E:/ATLAS-worktrees/tt-warning-surface-c07b` (already created, clean)
- Branch: `work/tt-warning-surface-c07b`
- Directive: read `AGENTS.md` in this worktree (byte-identical to
  `origin/main:AGENTS.md`; LF-normalized SHA-256
  `FFD1452004753AA0F2B7EF21D990CB1DF6E540C2850155B30DECE990B8B82BD5`).
- Dependency tree: `atlas-client/node_modules` and `atlas-server/node_modules`
  are junctions to the verified read-only shared install
  `E:/ATLAS-worktrees/.deps-c950e694/<pkg>/node_modules`. Never run an install
  through the junction.
- Risk tier: `MEDIUM` (source + tests only).

## 1. Settled product policy (authoritative, do not relitigate)

1. Distance-between-buildings is retired.
2. Laboratory scheduling is optional configuration; ordinary Science uses
   CLASSROOM. LABORATORY requirements apply only when explicitly configured.
3. Health Break and Lunch are configured break windows, not idle time.
4. Ancillary Work is not Teaching Load.
5. Warnings displayed as publication blockers must use the same
   server-owned promotion allowlist as publication.
6. Selected-term issue lists may be term-scoped, but publish readiness is
   **always run-wide**.

## 2. Objective

Make every client warning / publish-readiness surface tell the truth: the
run-wide gate decides publication, selected-term rails are labeled and never
silently mixed with run-wide totals, every displayed action really works, the
promotable allowlist is honored, and no dead residue of retired warnings
remains.

## 3. Required outcomes

### B1. `SimplePublishReadinessSheet` renders run-wide blocker truth
File: `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
and its derivation `atlas-client/src/components/timetable/simplePublishReadiness.ts`.
- Current defect: `deriveSimplePublishReadiness` never reads the run-wide
  summary (`ViolationReport.counts.runWide`). It mixes the whole-draft
  `unassignedItems` with a **term-filtered** `violations` array.
- It must not say "Ready to publish" from a selected-term list while another
  term still has a blocking hard violation or run-wide unassigned requirement.
- Drive the gate from the run-wide authority
  (`counts.runWide.blockingHard` and the run-wide unassigned requirement), and
  use the selected-term list only as supporting per-term detail.
- Wire the run-wide authority through the real mount path
  (`atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`, which
  already computes `blockingHardCount` — see its lines ~140 and ~186-196).

### B2. Selected-term rails are labeled and never mixed with run-wide totals
Files: `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`,
`atlas-client/src/hooks/useTimetableData.ts`,
`atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`.
- Current defect: the rail header at `GeneratedRunRailPanels.tsx:161` renders a
  run-wide count (`{hardViolationCount} run-wide hard`) while the per-code
  badges (line ~165), the `topBlockers` loop, and the "All / Hard / Soft"
  filter counts (lines ~219-223) all use the term-filtered `violations` with no
  term label. `ScheduleReviewWorkspace.tsx:495-497` passes term-filtered
  `violations` alongside a run-wide unfiltered `hardCount`/`softCount`.
- Label selected-term scopes explicitly and never present a merged
  run-wide + selected-term total under one unexplained number.

### B3. Every displayed action works
- Remove no-op "Review issue" buttons. `SimpleTaskDrawerHelpers.tsx`
  `BlockerGroupCard` action (lines ~189-213) and the sheet's `BlockerGroupRow`
  action (lines ~87-98) must route to a real destination.
- Route resolvable violations to the correct term/entity/repair surface
  (the real dispatchers already exist in
  `TimetableSimpleHeader.tsx:770-798` and `TimetableTaskDrawer.tsx:225-226`;
  reuse them, do not invent a parallel router).
- Aggregate warnings must expose every affected entry or navigate to a real
  grouped repair view.

### B4. `Treat as Hard` / `Blocks publish` only for the promotable allowlist
File: `atlas-client/src/components/scheduling-policy/PolicyPanePrimitives.tsx`
(lines ~200-213) and its consumer
`atlas-client/src/components/SchedulingPolicyPane.tsx` (lines ~228, ~960-971).
- The render list currently comes from the client-local
  `DEFAULT_CONSTRAINT_CONFIG` / `SOFT_CONSTRAINT_LABELS` maps. Render the
  promotion control (and the "Blocks publish" badge) **only** for codes present
  in the server-owned promotable allowlist. Rejected promotion must not be
  offered as a working control.
- Keep the client allowlist mirror (`simplePublishReadiness.ts` lines
  ~111-135) byte-equal to the server set
  (`atlas-server/src/services/scheduling-policy.service.ts`
  `PROMOTABLE_CONSTRAINT_CODES`); the existing drift test must keep passing.

### B5. `ExplainabilityDrawer` uses server publication semantics
File: `atlas-client/src/components/ExplainabilityDrawer.tsx`.
- Current defect: lines ~168-178 and ~225 label "Publish blocker" purely from
  `severity === 'HARD'`. `HARD` alone does not mean publication blocker for a
  code that is not on the allowlist.
- Use the allowlist-aware predicate (`isBlockingHardViolation`) so a
  non-publication-blocking HARD code is not labeled a publish blocker.

### B6. `PublishChecklistContent` groups real production violation codes
File: `atlas-client/src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx`
(`PublishChecklistContent` lines ~80-187, `buildBlockerGroups` lines ~35-78).
- Current defect: grouping keys are unassigned **reason** keys
  (`UNASSIGNED_GROUP_MAP`, lines ~27-33), so real production HARD violation
  codes are dropped by the `if (!groupConfig) continue;` branch.
- Group by real production violation codes and/or explicit reason keys that
  actually occur, with truthful counts. Also make the publish button's disable
  condition consistent with the run-wide gate of B1 (currently it uses the
  unfiltered `hardCount`).

### B7. Remove dead UI/config/type residue; reconcile `types.d.ts`
- Remove client residue for `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` (currently in
  `ExplainabilityDrawer.tsx`, `simplePublishReadiness.ts`,
  `ScheduleReviewWorkspace.constants.ts` `VIOLATION_LABELS`/`WELLBEING_CODES`,
  `useTimetableData.ts`, `PolicyImpactSummary.tsx`, `types.ts`).
- Remove residue for retired vacant/overcompressed/early-late families that
  Lane A retires (server-side). Coordinate by observing that the *client*
  union in `atlas-client/src/types.ts` is independent of the server union; if
  a code is retired, remove it consistently from `types.ts` and every
  exhaustive map keyed by `ViolationCode`.
- `atlas-client/src/types.d.ts` is a stale duplicate authority (its
  `ViolationCode` union at line ~514 omits `ROOM_FEATURE_MISMATCH` and
  `FACULTY_FLOOR_TRANSITION` while still containing the retired travel code).
  Reconcile it to the live `types.ts` authority or delete it. If deleted,
  prove `tsc` and `vite build` still pass and that nothing imports it.
- Remove the `estimatedDistanceMeters` / `maxWalkingDistanceMetersPerTransition`
  display residue in `TimetableShared.tsx:193-194` when the corresponding
  server field is retired.

### B8. Preserve accessibility and navigation
Keep accessible controls, 44px mobile touch targets, keyboard navigation,
responsive layout, Simple-first navigation, and term-switching state hygiene
(a term/school/year change clears or revalidates scope-bound selection,
preview, dialog and error state).

## 4. Controls (mandatory; decisive proof, not regex-only)

Use the real `renderToStaticMarkup` + `node:test` + `MemoryRouter` component
harness already used in
`atlas-client/src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts`,
with **real production-shaped violation objects** and real `ViolationReport`
`counts.runWide` shapes. Create/own one decisive suite, e.g.
`atlas-client/src/lib/__tests__/tt-warning-surface-realism-c07b.test.ts`.

Required positive controls:
1. `SimplePublishReadinessSheet` says "Ready to publish" only when the run-wide
   gate is clean; with a selected term clean but another term blocking, it must
   NOT say "Ready to publish".
2. Selected-term rail counts are visibly labeled as selected-term scoped, and no
   single number merges run-wide and selected-term totals.
3. Every rendered action dispatches a real destination (assert the dispatch
   callback / navigation target is reached from a rendered click path, not just
   that a string exists).
4. `Treat as Hard` / `Blocks publish` is rendered only for allowlisted codes.
5. `ExplainabilityDrawer` labels a non-allowlisted HARD code as NOT a publish
   blocker and an allowlisted HARD code as a publish blocker.
6. `PublishChecklistContent` groups real production violation codes with
   correct counts.
7. Retired-code residue assertions: no client reference remains for the retired
   codes removed in B7.

### Mutants (each must fail a decisive test)
- Run-wide gate substituted with the selected-term list.
- All soft codes shown as promotable.
- `HARD` blindly labeled publish blocker.
- No-op default action restored.
- Reason-key grouping restored.

Source-text/regex assertions alone are **not** acceptable as the decisive proof
for B1-B6. `tsx --test` only; do not weaken existing assertions.

## 5. Combined gates (run and report exact results)

- `npx tsx --test src/lib/__tests__/tt-warning-surface-realism-c07b.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts`
- `npx tsx --test src/lib/__tests__/tt-source-freshness-client-c04.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-dynamic-workspace-publication.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-operator-workflow-state.test.ts`
- `npx tsx --test src/lib/__tests__/uxc01r-generation-readiness.test.ts`
- the C04 Simple-workspace / publication suites under
  `src/lib/__tests__/timetable-dynamic-workspace-*.test.ts`
- `npx tsc --noEmit` and `npm run build` (client)
- `git diff --check`

## 6. Boundaries (forbidden)

- No live data mutation, database/schema/migration action, generation,
  publication, deployment, runtime restart/task/env change, companion edit.
- No edits outside `atlas-client/**` and the docs you are explicitly asked for.
  Do **not** edit `atlas-server/**` (Lane A owns it) and do not edit
  `docs/plans/atlas-delivery-cycles.json` or the generated register.
- No `git push`, merge, rebase, reset, or stash. Commit only on
  `work/tt-warning-surface-c07b`.
- No browser login and no Playwright session; browser rows are deferred.

## 7. Deliverables and return contract

Commit the candidate with a conventional commit on `work/tt-warning-surface-c07b`,
then return `REVIEW_REQUIRED` with:

- base SHA and candidate SHA;
- exact changed-path list;
- the run-wide gate wiring (which prop/authority now decides readiness);
- promotion-allowlist parity confirmation against the server set;
- the retired-code client residue inventory;
- the `types.d.ts` disposition (reconciled or deleted) with evidence;
- the requirement → production path → negative control → verification command
  trace table with each row PASS / BLOCKED / DEFERRED;
- mutant results;
- gates tally (total / passed / failed / blocked / unperformed);
- known risks classified BLOCKING or NON_BLOCKING.

Stop after the candidate commit; do not self-approve and do not integrate.
