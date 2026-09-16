# GENERATION-AUTHORITY-REALISM-C07 — R3 bounded correction packet

Planner-authored correction authority for the `CORRECTION_REQUIRED` wave-audit verdict
(`ses_f5783f732ffeyGMZfEuQ9Qrf5Y`). Authoritative alongside
`docs/prompts/generation-authority-realism-c07-2026-09-16.md` (§1–§15); this file adds only the R3
scope. Additive commits only; no rebase/amend/reset/squash/force-push.

- **Role:** `ROLE: EXECUTOR` — recommended variant `high`; disclose any lower-variant substitution.
- **Worktree:** `E:/ATLAS-worktrees/generation-authority-realism-c07`
- **Branch:** `work/generation-authority-realism-c07`
- **Base for additive commits:** the worktree HEAD at dispatch time (the pinned reviewed tip
  `6460e5facf4645bca67680984050bdd51dacb9e2` plus this planner correction-prompt commit). Additive
  commits only; the overall reviewed range becomes `750cafcb...<correction tip>`.
- **Risk tier:** MEDIUM (source/tests only)
- **PLANNER_SESSION_ROUTE:** `EXISTING` (C07 planner chat)
- **EXECUTOR_SESSION_ROUTE:** `EXISTING` if the C07 executor context is still available, otherwise `FRESH_REQUIRED`
- **QA_SESSION_ROUTE:** `FRESH_REQUIRED`

## Blocking findings to close

### B1 — bind persisted `PolicySpecialEvent` authority into the generation freshness snapshot

The wave made the persisted special-event rows operative generation input (R1/R2), but they are not
covered by any freshness fingerprint, so a post-run edit leaves the run reported `FRESH` and
publication can proceed against changed authority.

Evidence at the accepted candidate:
- `atlas-server/src/services/policy-special-event.service.ts:109-189` writes only
  `policy_special_events`; it never touches `scheduling_policies`.
- `atlas-server/src/services/generation-input-snapshot.service.ts:266-269` (exact digest) covers only
  `scheduling_policies` + `grade_shift_windows`; `:341-348` signals are `policyId`/`policyUpdatedAt`/
  `gradeWindow*`.
- The rows now drive output via `generation-preflight.service.ts:925-936` and `:1259-1261` →
  `schedule-constructor.ts:249-265`, `:331-347`, `:588-611`.
- Fail-open consequence: `generation.service.ts:1547` (`getRunDraft().inputState`) and
  `publication-contract.service.ts:286-291`.

Required change:
1. Extend the `policy` exact-digest subquery with an enabled-agnostic arm
   `UNION ALL SELECT 'specialEvent', id, to_jsonb(e.*) FROM policy_special_events e WHERE e.school_id = $1 AND e.school_year_id = $2`
   keeping the existing deterministic `ORDER BY x."tableName", x.id`.
2. Add `policy` signals from `client.policySpecialEvent.aggregate({ where: { schoolId, schoolYearId } })`:
   `specialEventCount`, `specialEventMaxId`, `specialEventMaxUpdatedAt` (include it in the
   `Promise.all` destructuring).
3. **Keep `GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION = 3`** (planner decision): the required-domain set
   is unchanged; because no v3 run exists in any deployed runtime, every existing snapshot simply
   recomputes a different `policy` fingerprint and fails closed as `STALE`. Do not silently leave the
   binding out and do not reinterpret any run as fresh.

### B2 — re-evidence `C07-S04` on a reachable production path

`PolicySpecialEvent` has no `day_of_week` column, `SpecialEventInput` has no day field, and
`toConstructorSpecialEvents` always maps `dayOfWeek: null`, so the explicit-non-Monday rejection can
never fire for real persisted rows. Its current acceptance evidence is a fixture carrying a property
the producer cannot emit (production-shape equivalence gate items 2 and 6).

Required change:
1. Re-evidence `C07-S04` through the **reachable** path with persisted-shaped rows only
   (`eventType`/`label`/`startTime`/`endTime`/`gradeGroup`/`programType`/`enabled`): a persisted
   Flag/HGP window **not contained by exactly one canonical CLASS row** (including the zero-row case)
   must produce the typed `FLAG_CEREMONY_SCOPE_INVALID` blocker with a concrete `owningSurface` and
   `nextAction`, and the real `triggerGenerationRun` must fail `GENERATION_PREFLIGHT_BLOCKED` with
   zero writes; a contained persisted window must stay ready (positive control, so the blocker is
   load-bearing). Assert the constructor also emits no synthesized overlay for the rejected row.
2. Keep the explicit-non-Monday predicate as **forward-compatibility only**: re-caption its test as a
   forward-compatibility contract ("not a persisted production path; `policy_special_events` has no
   day field; requires a schema/migration decision") and stop it being the sole `C07-S04` evidence.

### Optional (planner-approved, one line)

N2: in `schedule-constructor.ts:259`, replace the literal `evt.eventType === 'FLAG_OR_HGP'` day
inference with the shared label-aware predicate (`resolveFlagCeremonyDayAuthority` /
`resolveSpecialEventDayOfWeek`) so `buildPeriodSlots` and the shape contract cannot disagree about a
label-identity flag row.

## Not in scope (recorded residuals; do not absorb)

- N1 availability-caused exclusions currently surface as `WORKLOAD_POLICY_BLOCK`; typed, HARD and
  non-silent — residual, not this round.
- N3 cohort lane authority (`cohort.preferredRoomType`) vs the validator's `subject.preferredRoomType`
  basis — pre-existing divergence; needs a read-only live check before a future generation preview.
- Persisted day authority for `policy_special_events` requires a schema/migration decision: register
  as a **successor policy requirement**, never invent a fallback.

## Owned paths

- `atlas-server/src/services/generation-input-snapshot.service.ts`
- `atlas-server/src/__tests__/generation-authority-realism-c07.test.ts`
- `atlas-server/src/__tests__/generation-authority-realism-c07-trigger.test.ts`
- `atlas-server/src/services/schedule-constructor.ts` (optional N2 line only)
- `atlas-server/src/__tests__/timetable-shape-diagnostic-c02.test.ts` and
  `atlas-server/src/__tests__/timetable-output-export-c03.test.ts` (only if the re-caption requires it)

## Forbidden

No `prisma/**` or any migration/schema/seed command; no `docs/plans/**`, `CHANGELOG.md`,
`docs/reference/**`, `AGENTS.md`, `ops/**`, or packet edits; no live/shared-DB write, generation,
publication, deployment, runtime/task/env change, login, or browser action; no `npm install`/`ci`;
no push/merge/rebase/amend/`--force`/`git reset --hard`; no test deleted, skipped, or reduced.

## Negative controls (must fail before the fix)

1. **F1a** Complete a run, then change one persisted special event → `getRunDraft().inputState.status`
   must be `STALE` with `policy` in `changedDomains`; with the digest arm removed it must report
   `FRESH` (so the arm is load-bearing).
2. **F1b** A special-event change between the captured pre-scheduling snapshot and the
   transaction-bound recomputation → typed `SOURCE_AUTHORITY_STALE` with zero `COMPLETED`/success
   writes (no COMPLETED status, no persisted draft entries for that run, no success audit, no
   completion notification); the pre-existing `FAILED` finalization must be asserted explicitly.
3. **F2** Persisted-shaped Flag/HGP window not contained by one canonical CLASS row → typed
   `FLAG_CEREMONY_SCOPE_INVALID` + `GENERATION_PREFLIGHT_BLOCKED` with zero writes and no synthesized
   overlay; a contained window stays ready (positive control).
4. **F3** (if N2 is applied) `buildPeriodSlots` with a `CUSTOM` row labelled as a flag ceremony and no
   canonical rows must not block every weekday.

## Decisive gates

```
npm run build                                     (atlas-server)
npx tsx src/__tests__/generation-authority-realism-c07.test.ts
npx tsx src/__tests__/generation-authority-realism-c07-trigger.test.ts
npx tsx src/__tests__/generation-authority-realism-c07-availability.test.ts   (guarded disposable PG, skip-safe, zero residue)
npx tsx src/__tests__/derived-demand-correction-c01r2.test.ts
npx tsx src/__tests__/publication-contract-readiness.test.ts
npx tsx src/__tests__/timetable-shape-diagnostic-c02.test.ts
npx tsx src/__tests__/timetable-output-export-c03.test.ts
git diff --check
```
`git status --porcelain=v2` empty and `git diff --quiet` exit 0 after the final command;
test-declaration counts must not decrease in any touched suite.

## Return contract

`ROLE: EXECUTOR`, worktree, branch, base `6460e5fa`, new candidate SHA, `REVIEW_REQUIRED`; the exact
`git diff --name-status <base>...<candidate>`; the requirement → production path → negative control →
command trace table; the corrected `C07-S04` evidence naming the real producer; the F1a/F1b/F2
failing-first evidence; the assertion-change inventory (no removals, no declaration-count reduction);
known risks; worktree disposition `KEEP_ACTIVE`. Do not self-accept, merge, push, or edit the register.
