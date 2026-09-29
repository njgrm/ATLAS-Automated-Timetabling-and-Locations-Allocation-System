# A8 g1 handoff — spread a section's weekly classes across days

**Worktree** `E:\ATLAS-worktrees\lane-a8-g1` · **branch** `work/a8-g1-spread-sessions`
**Base** `5e03e0c460dfd2881cadb2183f28e6e4510e798a`, merged forward to `bfd14a96`
**Candidate tip** `0adc9a1e` (R2) · **Disposition** `PRESERVE_FOR_DECISION`

| SHA | What |
|---|---|
| `31addf09bb17dc0eac5864c118d38874e164c30e` | the accepted source change + tests |
| `49ca2ff92d99309bce0dc991f6538508f55de36c` | first proof harness (superseded, kept) |
| `f143f5bbc93594654f96a04ea7960c96cad3d589` | coordination record |
| `8ac05f8b1b480db0db81e4e6e8811fcb60c77576` | R1 `spreadOrdering` test seam (D1) |
| `99ec93fc039a1efcbe800e40b2a8307f0d5fda90` | R1 sound frame + term-keyed overlaps (D1/D2) |
| `48008dd79b94611ce4eda4d6970d14cf86a5620c` | R1 test-only type fix |
| `f339298b82b726f017f546c90a344ffe247cb824` | R1 handoff |
| `133b367f…` | planner evidence commit (not mine) |
| **`0adc9a1e…`** | **R2 production algorithm + representation guard (D3)** — current tip |

`git push` and `git merge` are **denied to this executor**; the planner pushes. Planner evidence
`docs/reviews/a8-g1-spread-sessions/proof-attempt-1.md` and `proof-attempt-2.log` are read-only inputs and
were not edited or deleted.

## 0. Round 2 — the frame was sound but VACUOUS (D3)

Attempt 2's `repeats 0 -> 0` proved nothing: the before side could not see the defect. Two independent
causes, both fixed.

**Cause 1 — the harness was not running production's algorithm.** It called `constructBaseline` directly.
`generation.service.ts:1006` calls `runHybridScheduler(constructorInput)`: seven seed profiles, best by
fewest-unassigned then fitness, then `repairHardConflicts` and `repairUnassignedByEjection`. That is what
produced live Run 347, so attempt 2 measured an algorithm **no run uses** — which is why it read 855/65
against production's 910/10, and why its legacy side spread perfectly. The harness now calls
`runHybridScheduler` for both sides. It takes the same `ConstructorInput`, so `spreadOrdering` reaches every
profile through the scheduler's `{ ...input, demandOverride }` spread.

I checked the planner's first hypothesis too, and it is **not** the cause: `useHomeRoomPriority` was
already on (`roomerStrategy: 'HOME_ROOM_FIRST'` was passed) and the 855/65-vs-910/10 gap is the algorithm
difference, not a missing home-room binding. A restored frame fed to a bare constructor spreads under
*both* orderings, which is exactly what attempt 2 showed.

**Cause 2 — nothing required the before side to reproduce the defect.** Equal frames are necessary but not
sufficient. `frameRepresentationProblem()` is now a **permanent** guard: the LEGACY ordering must show
≥ 1 repeated pair and a worst cell ≥ 3, against live Run 347's 31 pairs and worst 15. Otherwise the run
fails closed with `FRAME_NOT_REPRESENTATIVE` and prints `A8G1_NOT_REPRESENTATIVE` with the legacy figures.

**D3 — `holder=tnone` was a measurement artifact, corrected at the source.** All 71 "teacher overlaps" in
attempt 2 printed `holder=tnone`. `schedule-constructor.ts:3203` emits
`facultyId: isModularUnified ? null : facId`, so a modular-unified lane carries **no single teacher** — its
per-term teachers are resolved elsewhere. Keying every one of them on a single placeholder holder
manufactured 71 phantom overlaps and made a real signal unfalsifiable. Entries with no `facultyId` are now
excluded from the teacher counter and **reported** as `entriesWithUnresolvedFaculty` on every `A8G1_SIDE`
line and in the verdict — excluded, never dropped. A genuine collision between two real teachers is still
counted and still fatal (row `11b` pins that this is not an escape hatch; row `11c` pins the constructor
behaviour the exclusion rests on).

## 1. The packet's frame, stated plainly

**`unplaced 65 -> 65` is equal, not "not rising above live", and it does NOT satisfy packet rule 3.**
Rule 3 is stated against live Run 347's **910/920**; the table's frame is this run's own
`sessions demanded` (920) with 855 placed. The harness now prints
`A8G1_PACKET_REFERENCE` on every run saying exactly that, so the two frames can never be conflated again.

**No production change in R2.** `schedule-constructor.ts` and `generation.service.ts` are untouched apart
from the `spreadOrdering` seam already accepted in R1. `UNPLACED_RAISED`, `OVERLAP_INTRODUCED` and
`HARD_VIOLATIONS` remain fatal; nothing was weakened to make a row pass.

## 2. What I expect the next run to print

```
A8G1_SIDE ordering=LEGACY_SOFT_PENALTY demanded=920 placed=<n> unplaced=<m> repeats=<R> worst=<W> \
  overlaps(t/s/r)=0/0/0 noFaculty=<k> hard=0 hybrid=true profile=<P> seconds=<t>
A8G1_SIDE ordering=DAY_COUNT_FIRST     demanded=920 placed=<n> unplaced=<m> repeats=0 worst=0 \
  overlaps(t/s/r)=0/0/0 noFaculty=<k> hard=0 hybrid=true profile=<P> seconds=<t>
A8G1_REPRESENTATIVE legacy_repeats=<R> legacy_worst=<W> (live Run 347: 31 pairs, worst 15)
```

Expected: `R > 0` and `W >= 3` on the legacy side (that is what `FRAME_NOT_REPRESENTATIVE` otherwise
refuses), `0` on the production side, teacher overlaps `0` now that `tnone` is excluded, and `noFaculty` ≈
the modular-unified lane count. The run then prints the table, four `A8G1_VERDICT` lines, the
`A8G1_PACKET_REFERENCE` line, and either `A8G1_PROOF_OK` or a fatal code.

**The exact command to re-run**, from `atlas-server/`, with the staging URL injected exactly as in attempts
1 and 2 (never printed):

```
npx tsx src/scripts/a8-g1-live-shape-proof.ts --target atlas_restore_drill_20260929_a8g1r3
```

## 3. How I know the frame is production-representative, and how I know the R2 fix should reproduce the defect

I cannot prove this without the staging URL, so I state the reasoning and the falsifiable predictions:

1. **Algorithm identity is now pinned by test, not by my word.** Row `9` asserts
   `generation.service.ts` still calls `runHybridScheduler(constructorInput)`, so a future change that
   routes generation through a bare constructor makes the suite red. Row `9b` asserts every
   `constructBaseline` call inside `hybrid-scheduler.ts` spreads `...input`, so `spreadOrdering` cannot be
   silently dropped for all but one profile — which would make the two sides differ by more than one
   variable. Row `9b` also asserts the production path still emits `spreadReport`, so the receipt survives
   the hybrid path and not only the bare one.
2. **Attempt 2's own numbers are the prediction.** It measured 855 placed / 65 unplaced on this exact
   restored database with bare `constructBaseline`. Run 347 was produced by the hybrid path from the same
   data and read 910/10. If the hybrid path is the difference, the legacy side should now land near
   **910/10** with repeats in the tens-to-hundreds and a worst cell near 15, not 855/65 with zero repeats.
   **If it still prints 855/65 and zero repeats, `FRAME_NOT_REPRESENTATIVE` fires** — which is the correct
   outcome, not a failure of the harness: it would mean the restored frame no longer reproduces live and
   the row must be reported `UNPROVEN_FRAME_NOT_REPRESENTATIVE` rather than argued.
3. **The defect's precondition is present in the data.** The tie that produces "Filipino ×5 — Monday"
   needs the section's home room busy on the other days, and the restored database carries 100 sections and
   103 rooms with the home-room contention the packet observed. Attempt 2's legacy side spread *because it
   ran the wrong algorithm*, not because the contention was absent.

## 4. Changed paths (R2)

| Path | Change |
|---|---|
| `atlas-server/src/scripts/a8-g1-live-shape-proof.ts` | measure via `runHybridScheduler` (production path); `frameRepresentationProblem` + `FRAME_NOT_REPRESENTATIVE`; `entriesWithUnresolvedFaculty` and the null-faculty exclusion; `A8G1_PACKET_REFERENCE`; `A8G1_REPRESENTATIVE`; `hybrid`/`profile` on each side line |
| `atlas-server/src/__tests__/a8-g1-spread-sessions.test.ts` | rows `9`, `9b`, `10`, `10b`, `10c`, `10d`, `11`, `11b`, `11c` (10 → 27 rows) |

No other path changed. `atlas-server/package.json` keeps `test:a8-g1-spread-sessions` in the same commit as
the test file it names.

## 5. Decisive commands, real results

From `E:\ATLAS-worktrees\lane-a8-g1\atlas-server` unless noted.

| Command | Result |
|---|---|
| `npm run test:a8-g1-spread-sessions` | `tests 27 / pass 27 / fail 0`, exit 0 (was 18/27) |
| `npm run test:timetable-scheduling-quality-c03` | `pass 16 / fail 0`, exit 0 |
| `npm run test:hybrid-scheduler` | `pass 5 / fail 0`, exit 0 |
| `npm run test:timetable-sync-setup` | `pass 1 / fail 0`, exit 0 |
| `npm run test:readiness-stall` | `pass 7 / fail 0`, exit 0 |
| `npm run test:disposable-db-guard` | `pass 9 / fail 0`, exit 0 |
| `npm run test:warning-count-scope-warn62` | `pass 7 / fail 0`, exit 0 |
| `npm run test:generation-completion-copy-c2` | `pass 11 / fail 0`, exit 0 |
| `npx --no-install tsc --noEmit -p tsconfig.json` | no output, exit 0 |
| `npm run build` | `> tsc`, exit 0 |
| `npm run test:encoding` (repo root) | `pass 1 / fail 0`, exit 0 |
| `git diff --check` / `--cached --check` | exit 0 (only the repo LF→CRLF checkout warning) |
| `npx tsx src/scripts/a8-g1-live-shape-proof.ts --self-test` | `A8G1_SELF_TEST_OK`, **33 checks** (was 26) |
| `… --target atlas_restore_drill_20260929_a8g1r3` (no `DATABASE_URL`) | `A8G1_PROOF_FAILED code=CONFIG_MISSING`, exit 1 |
| `… --target atlas_db` | `A8G1_PROOF_FAILED code=TARGET_NOT_DISPOSABLE`, exit 1 |

**The before/after table's real numbers still require the staging URL**, which I hold no authority to
obtain. They come from three commands inside one run: `measure()` (per side, printed as `A8G1_SIDE`),
`renderTable` (the table), `A8G1_VERDICT` (the deltas).

## 6. Risks

**BLOCKING**

- **B1 — the rule-3 row is still unmeasured.** The harness is now production-path, frame-guarded and
  representation-guarded, but nobody has run it since. Until the planner does, the spread result is unproven
  on live-shaped data.
- **B2 (falsifiable, and I want it stated as a prediction) — if the re-run prints
  `legacy repeats=0`, `FRAME_NOT_REPRESENTATIVE` fires and the row must be reported
  `UNPROVEN_FRAME_NOT_REPRESENTATIVE`.** That would mean the restored frame no longer reproduces live's
  home-room contention for a reason I have not identified, and no amount of harness work would make the
  row decidable. I have not ruled that out; I have made it loud instead of quiet.

**NON_BLOCKING**

- **N1** the receipt is not surfaced in any UI — by design; §8 and the UX rules apply if a later slice
  reads it.
- **N2** `spreadReport` is uncapped in `summary` jsonb; live had 31 such pairs.
- **N3** home-room preference survives as a *within-day* tie-break — intended per r2.
- **N4** `schedule-constructor.ts` is ~3,150 lines, over the §8 1,000-line rule. Pre-existing; the packet
  forbids splitting it.
- **N5** `spreadOrdering` widens `ConstructorInput` for a test purpose — code-only, no UI, production never
  passes it.
- **N6** the branch is unpushed and `origin/main` is ahead of `bfd14a96`; the planner owns pushing.
- **N7** the unplaced rise is still unresolved. Attempt 2's `65 -> 65` was on the wrong algorithm, so it
  said nothing about the rise. On the production path both sides should land near 10; if the production side
  is materially higher, that is a real regression and `UNPLACED_RAISED` fires.
