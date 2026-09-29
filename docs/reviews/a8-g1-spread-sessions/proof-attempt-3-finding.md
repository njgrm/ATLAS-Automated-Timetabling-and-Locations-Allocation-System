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
