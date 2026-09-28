# A8 packet c2 — correction round 1 (QA `CORRECTION_REQUIRED` on `4c806de3`)

Base `4c806de3`, branch `work/tl-shortage-server-c2`. Additive commit; no amend/rebase/reset.
Scope: server only. Lane A6's client paths untouched.

## B1 (BLOCKING) — `created` / `assignmentsCreated` counted undelivered substitutes

**Was:** `teaching-load-automation.service.ts` computed
`totalCreated = created + teacherXRowsClosed` and returned it as both fields. `teacherXRowsClosed`
is the count of preview-only `TEMPORARY_SUBSTITUTE` rows (`facultyId: null`, stripped from the
distribution plan, never persisted), so a run that persisted nothing reported
`assignmentsCreated: 1`. The candidate's own comment at `:3261` already called that number "NOT
delivered coverage" and then added it to the created count.

**Now:** `created` and `assignmentsCreated` are the number of distribution `INSERT`s — exactly what a
reviewed apply writes as `subjectSectionOwnership` rows — and `uniqueTeachersAffected` is the
distinct teachers on those inserts. Substitute reporting is unchanged and still truthful in
`teacherXResolution.rowsClosedByTeacherX` / `unsavedSubstituteRows`; `stillNeedRealTeacher` is still
the real uncovered count. Meanings documented at the `AutoFillResult` declaration.

**API-contract delta (material):** `created` / `assignmentsCreated` in a Teacher-X preview now
exclude substitutes, and `uniqueTeachersAffected` now reflects the insert teachers (it was
structurally always `0` — `affectedTeacherIds` was never populated and
`teacherXPlaceholderTeacherCount` was always `0`). In non-Teacher-X modes `created` now equals the
insert count instead of a constant `0`. Apply-path results are unchanged
(`teaching-load-suggestion-proposal.service.ts` already reports the persisted `created`).

**Failing-first:** 4 new controls in `tl-shortage-teacherx-truth-c02.test.ts`, **4 failed / 10
pre-existing passed** before the fix. Observed deltas: substitute run `created` actual 1 → expected 0;
real-teacher run actual 0 → expected 1; placeholder run actual 0 → expected 2.

## B2 (BLOCKING) — one cap must govern both over-cap and move eligibility

**Was:** two different rules in one function. Over-cap reporting used
`evaluateWeeklyLoad(...)` (the teacher's own floored cap, net of ancillary); the receiver gate at
`:4136` re-derived `min(maxHours*60, effectiveStandardMinutes)` inline, ignoring both the contract
and the ancillary credit. A 30h teacher with 600 ancillary minutes was reported over cap (1440
teaching vs a 1200 applicable cap) **and in the same run received a move**, because the retired gate
saw `1800-1440 = 360` spare minutes.

**Now:** the receiver gate calls the same `evaluateWeeklyLoad`, so the coherence rule is structural
— a receiver the evaluation calls over limit has no spare capacity and is rejected with
`HARD_CAP_EXCEEDED` like any other over-committed teacher. No second copy of the cap rule remains,
and the inline `min(...)` is gone.

**Failing-first:** new `B2: a teacher the shared evaluation calls over cap is never a move target`
asserted `true !== false` (a move *was* proposed into the over-cap receiver). A companion control
proves the fixture is non-vacuous: both teachers are genuinely over cap under the shared rule
(`aboveStandardFaculty === 2`), so the coherence assertion cannot pass for an unrelated reason.

**B3 re-based, not deleted.** The old 30h/600 fixture made the receiver genuinely over cap
(1440 > 1200), so "NOT flagged" and "stays capacity-eligible" were mutually exclusive under the new
definition — the old B3 was asserting that a rule the generator would also flag was harmless. The
fixture is now a 40h contract: cap `2400-600 = 1800`, teaching 1440, 360 real spare. The assertion
now means *"advisory/ancillary credit is neutral for overload classification"* — he is not flagged
even though his credited total (2040) exceeds **both** his own cap and the 1800 school standard. That
is still a real control: an implementation folding advisory minutes into teaching load flags him and
fails. B3 is additionally joined by a coherence loop over `proposedMoves`. Suite: **62 passed,
0 failed** (was red at B3).

## N1 — RETAIN drift comment corrected (truthfulness, not safety)

The comment claimed the pair "must still be owned by the teacher the reviewer saw". The check runs
against `refreshedPlan.retains`, and `distributionPlanSignature` does not bind `retains`, so it is a
narrow preview→transaction window check. The comment now states exactly what is guaranteed and why
that is sufficient: retains are never written, the transaction is `Serializable`, and a changed
owner surfaces as a conflicting INSERT or a re-validated move. No silent-overwrite hole (QA
confirmed; no behaviour change).

## N2 — threat-model inventory corrected

`docs/prompts/atlas-system-token-rotation-2026-09-26.md` no longer lists `POST /coverage/repair` as a
system-token route. Verified at the source: the route is `authenticate, requirePrivilegedRole` with
`rejectCapabilityOverrideScope` at `:477`, while the two routes that remain system-token
(`coverage/rebalance-special-programs`, `coverage/recover-real-faculty`) both still use
`authenticateWithSystemToken`. Zero callers repo-wide. Faculty-assignment write routes drop 3 → 2.
Minimal additive edit; document not restructured.

## Gates (literal results)

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` (atlas-server) | exit 0 |
| `npm run test:server-suite` | **419/419 pass, 0 fail** (was 413; +6 new B1/B2 controls) |
| `npm run test:server-db` | **49 pass / 9 fail**, 0 skipped-known-red, residue 0 |
| `npx tsx --test src/__tests__/gate-reachability.test.ts` | 1/1 |
| A8 + TL DB suites (8 files, targeted) | 8/8 pass, incl. the re-based B3 file |
| Client | not touched (no client code changed) |

No new test file was added, so no `test:*` script change was required; the reachability guard was
re-run and passes. Client `tsc` was not attempted: the shared `D:\ATLAS` client donor is incomplete
(missing `@radix-ui`, `@dnd-kit`, `@esbuild/win32-x64`, no `node_modules/.bin`) — environmental, and
no client source was modified by this correction.

## Pre-existing-red note (measured, not assumed)

QA reported one pre-existing failure (`teaching-load-suggestion-derived-demand-c03r2.test.ts`). The
full suite actually reports **9**, and all 9 are pre-existing and candidate-independent:

- `enrollpro-rollover-automation`, `published-immutability-c08`,
  `teaching-load-carry-forward-postgres`, `teaching-load-suggestion-derived-demand-c03r2`,
  `timetable-ttc02-insertion`, `tt-source-freshness-generation-c04`,
  `tt-source-freshness-quick-place-c04`, `tt-source-freshness-sync-pin-c04`,
  `tt-warning-realism-c07a`.

Attribution was **measured, not asserted**: with my two production files checked out at the
candidate's exact bytes (`git checkout HEAD --`), the same 9 failed (0 pass / 9 fail). With the
whole `atlas-server/src` tree restored to the pre-candidate base `256abde4`, the same 9 failed
identically. None of the 9 imports an A8 module, and their failures are term-contract
(`TERM_FILTER_NOT_READY`), period-length and section-scope assertions. Not attributed to this
candidate; not fixed here.

**Honest caveat:** one full run reported 50 pass / 8 fail. The 9 failing files above failed in every
run, so the variance is a *different* file flaking in that run rather than one of these 9 going
green. The DB-suite tally is therefore `49-50 pass / 8-9 fail` with the same 9 core pre-existing
failures. I did not chase the flake further; it is outside this packet's scope and outside the
changed code.

## Open / for the planner

- **N3 and N4 left untouched** as instructed (source-text controls in
  `tl-shortage-single-cap-rule-c02.test.ts`; item-1/item-5 control files importing the new shared
  module). Both remain recorded residuals.
- The 9 pre-existing DB failures above need their own owner; this packet neither caused nor fixed
  them.
- Environment note: the disposable admin database used for the run was
  `atlas_restore_drill_20260929_a8corr1` (created once; the runner creates and drops its own
  per-file databases and reported residue 0).
