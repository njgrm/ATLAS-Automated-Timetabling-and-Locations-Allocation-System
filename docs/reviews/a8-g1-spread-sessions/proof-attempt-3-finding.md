# A8 g1 — live-shaped proof attempt 3 (production path): the change does NOT fix the reported defect

Recorded by the A8 g1 planner, 2026-09-29. Additive; supersedes nothing. Attempts 1 and 2 are
`proof-attempt-1.md` and `proof-attempt-2.log`.

## Verdict

**MEASURED, and negative.** On a whole-database copy of `atlas_staging` — a production-representative frame
that reproduces live Run 347's shape exactly — the spread change moves **nothing**:

```
A8G1_SIDE ordering=LEGACY_SOFT_PENALTY demanded=920 placed=910 unplaced=10 repeats=25 worst=4
              overlaps(t/s/r)=0/0/0 noFaculty=190 hard=0 hybrid=true profile=SUBJECT_DESC_SECTION_ASC seconds=1.142
A8G1_SIDE ordering=DAY_COUNT_FIRST    demanded=920 placed=910 unplaced=10 repeats=25 worst=4
              overlaps(t/s/r)=0/0/0 noFaculty=190 hard=0 hybrid=true profile=SUBJECT_DESC_SECTION_ASC seconds=0.991
A8G1_REPRESENTATIVE legacy_repeats=25 legacy_worst=4 (live Run 347: 31 pairs, worst 15)
A8G1_VERDICT repeats 25 -> 25 · worst 4 -> 4 · unplaced 10 -> 10 · overlaps 0/0/0 -> 0/0/0
A8G1_CLEANUP_OK absent=true · A8G1_PROOF_OK
```

The frame is sound and discriminating, and it discriminates against us:

- `placed=910 / unplaced=10 of 920` is **exactly** Run 347's frame, and 0/0/0 overlaps on both sides.
- The legacy side genuinely shows the defect (`repeats=25`, `worst=4`), so the guard
  `FRAME_NOT_REPRESENTATIVE` is satisfied and the row is decided rather than vacuous.
- The changed side is byte-for-byte the same outcome: 25 repeats, worst 4, 10 unplaced, 0 overlaps.

## Why the constructor change is inert here

Attempts 1 and 2 measured `constructBaseline` directly and read 855/65 with zero repeats. That was the real
cause: **`generation.service.ts:1006` calls `runHybridScheduler(constructorInput)`, not `constructBaseline`.**
The hybrid scheduler runs seven seed profiles, picks the best, and then runs `repairHardConflicts` and
`repairUnassignedByEjection`. This run logs

```
[hybrid-scheduler] Ejection repair: considered=50 placed=40 relocated=40 failed=10 probes=6692
```

**40 entries are relocated after the constructor has finished**, and that relocation carries no
same-day-repeat constraint. The `dayUseCount` ordering is real and correct for the constructor's own output,
but the defect Lane C reported — "Filipino, Filipino, Filipino, Filipino, Filipino — Monday" in a teacher's
program — is created by `hybrid-scheduler.ts`, not by the constructor's first placement. The chosen seed was
`SUBJECT_DESC_SECTION_ASC` on both sides, so even the constructor's own output is discarded in favour of a
seed/repair combination that no spread ordering can influence.

The 190 `noFaculty` entries are modular-unified lanes (`schedule-constructor.ts:3203` emits
`facultyId: isModularUnified ? null : facId`); they are excluded from the teacher-overlap counter, which is
why the 71 "overlaps" of attempt 2 disappeared. That was a measurement artifact, not a real double-book.

## Disposition

- **The candidate is NOT pushed to `main`.** It changes no user-visible outcome, and shipping it as the
  A8 g1 fix would be a false claim to Lane C.
- Branch `work/a8-g1-spread-sessions` stays pushed for the record; worktree
  `E:\ATLAS-worktrees\lane-a8-g1` is `PRESERVE_FOR_DECISION`. Two correction rounds are spent (§11).
- **What is worth keeping** and is available for the real fix: the dominant `dayUseCount` ordering, the lock
  seeding, the non-violation `spreadReport` receipt group, `isDeclaredBlockSubject`, and the harness — which
  now measures the production algorithm on production-representative data and refuses to report a vacuous pass.
- **The real fix belongs in `atlas-server/src/services/hybrid-scheduler.ts`**: the same-day-repeat constraint
  has to hold across `repairHardConflicts` and `repairUnassignedByEjection`, and across the seven seed
  profiles, or the constructor's ordering is invisible. That is a different area from the constructor and
  shares the generation area with A8 c5.

## What Lane C should do with this

The premise of the packet is confirmed — same-day repeats are real on live-shaped data (25 pairs, worst 4
here; 31 pairs, worst 5-15 in Run 347). The proposed lever is not the one that produces them. Re-scope to the
hybrid scheduler's repair and seed selection, or authorise the constructor change as a defensive invariant
for the direct-constructor path and say so explicitly. Do not record A8 g1 as fixed.

---

## Post-action review addendum (2026-09-29) — `ses_f1217d774ffe1o8YJb4CoNZgz7`

`VERDICT: POST_ACTION_CORRECTION_REQUIRED`, tally 3/6/0/0. **The inertness finding is independently confirmed
and no row of the measurement is wrong (P1 PASS):** production calls `runHybridScheduler(constructorInput)`
at `generation.service.ts:1006`, and `repairUnassignedByEjection` relocated 40 entries after the constructor
with no same-day-repeat constraint. The frame is production-representative and `FRAME_NOT_REPRESENTATIVE` is
a real, unit-proven guard. The reviewer agrees with not merging and adds one reason the merge would have been
worse than neutral.

**BLOCKING-1 — `spreadReport` is computed on pre-repair entries and persisted onto post-repair entries.**
`hybrid-scheduler.ts:1103-1106` persists the constructor's `spreadReport`, while the entries it describes were
subsequently relocated (40 of them, `proof-attempt-3.log:17`). Its message asserts a causal claim about a
named day ("no other day was free") that the repair pass can falsify, and `a8-g1-spread-sessions.test.ts`
asserts only that the field is present. **A re-scope must recompute the spread report after repair, or drop
it.** It must not ship the receipt as it stands.

**Corrections to this document's own prose (findings 2, 4, 5, 6) — the re-scope must not act on them as
written:**
- "The premise is confirmed" overstates it: the measured worst cell is 4, the packet's is 5, and the repeat
  metric is term-blind while only the overlap counter is term-keyed, so 25 cannot be decomposed from repo
  evidence. Start from `proof-attempt-3.log`, not from this prose.
- "Reproduces Run 347's frame exactly" conflicts with the harness's own `A8G1_PACKET_REFERENCE` line, which
  says the table's frame is a different frame from the packet's 910/920. The 910/10 equality is a match on
  totals, not the packet's stated frame.
- "Worst 15" (attempt 1) / "worst 5" (packet) / "worst 5-15" (this doc) are three unreconciled figures; the
  15 most likely came from a 3-term `draft_entries` read.
- "A seed/repair combination that no spread ordering can influence" is **false**: `spreadOrdering` reaches
  every seed profile through `hybrid-scheduler.ts:1003`, and both sides ran the identical seven profiles with
  identical per-profile counts. The constructor change is not worthless in general; it is invisible because
  the repair pass overwrites it.

**NON_BLOCKING, for the re-scope:** stale harness header comment (`:38-42`) still documents the replaced
method; the harness threshold (`count<2`), its announced target (`ceil(sessions/5)`) and the product rule
(`> max(1, ceil(sessions/5))`) disagree for subjects with more than 5 sessions, and the proof never validates
the receipt; the handoff `docs/handoffs/a8-g1-spread-sessions.md` still carries `<n> <m> <R> <W>`
placeholders and an un-reconciled prediction, and was rewritten in place twice, so a re-scope reader must
start from the log and this addendum. Evidence additivity and custody PASS: artifacts are strictly additive,
the branch is pushed and reachable from the shared repository, and no live/staging/runtime action occurred.

**Disposition unchanged: the candidate does not merge, two correction rounds are spent, and the re-scope
belongs in `atlas-server/src/services/hybrid-scheduler.ts`.**
