# A8 g1 handoff — spread a section's weekly classes across days

**Worktree** `E:\ATLAS-worktrees\lane-a8-g1` · **branch** `work/a8-g1-spread-sessions`
**Base** `5e03e0c460dfd2881cadb2183f28e6e4510e798a`, merged forward to `bfd14a96`
**Candidates**
| SHA | What |
|---|---|
| `31addf09bb17dc0eac5864c118d38874e164c30e` | the accepted source change + tests |
| `49ca2ff92d99309bce0dc991f6538508f55de36c` | first proof harness (superseded, kept) |
| `f143f5bbc93594654f96a04ea7960c96cad3d589` | coordination record |
| `8ac05f8b…` | **R1** `spreadOrdering` test seam (D1) |
| `99ec93fc…` | **R1** sound frame + term-keyed overlaps (D1/D2) + new evidence rows |
| `48008dd7…` | **R1** test-only type fix so tsc/build are clean |
| `133b367f…` | planner evidence commit (not mine) |

`git push` and `git merge` are **denied to this executor**; the planner pushes.
**Disposition** `PRESERVE_FOR_DECISION` — the rule-3 proof row is still `BLOCKED`, but it is now
**decidable by one run**; see §5.

## 0. Correction round 1 — what changed and what the two defects were

**D1 — the two sides were different frames. Fixed.** Attempt 1 measured "before" from run 347's stored
rows (2730 entries = the whole 3-term year) and "after" from one constructor invocation (855 + 65 = 920
sessions = one week). Nothing checked the frame, so the table read as decisive while every row in it was
unquotable. Both sides are now produced by the same code over the **same constructor input object in the
same process**, with exactly one variable changed: `ConstructorInput.spreadOrdering`. The before side is
the pre-change comparator reached through that seam — not a saved run, not a hand-copied comparator. The
table now prints `ordering` (the variable) and `sessions demanded` (the frame) as rows, and the pure
guard `frameMismatchReason()` fails closed with `FRAME_MISMATCH` / `FRAME_EMPTY`.

**D2 — overlaps are now term-keyed.** Keyed on `(holder, TERM, day, interval)`. A rotation/modular lane
legitimately re-teaches the same teacher the same slot in T1 and again in T2; counting that is what
produced 1675/1820/1820. A concurrent lane keeps its own `CONCURRENT` bucket, because `constructBaseline`
leaves `termIndex` undefined for it (`termIndex: sessionTermIndex`, undefined unless a modular cycle). A
teacher genuinely double-booked **inside one term** still collides, is still counted, and is now reported
per term and slot with a `samePair` flag. **The 75 are not yet decided** — the next run prints each
survivor as an `A8G1_OVERLAP` line. Nothing was weakened: `UNPLACED_RAISED`, `OVERLAP_INTRODUCED` and
`HARD_VIOLATIONS` all still exit non-zero, and each now also fails when the AFTER side is worse than the
BEFORE side on the same frame.

**Verdict on the "75 teacher overlaps": NOT attributable to this change, and the corrected harness will
prove it rather than assert it.** The structural reason is in the code: `facultyOcc`, `roomOcc` and
`sectionOcc` gate **every** candidate before a placement is made, and A8-G1 reorders only the candidate
list — it changes no guard, no occupancy mark and no placement rule. A same-term teacher double-book
therefore cannot be produced by reordering. Test row `7d` pins this by running **both** orderings and
asserting 0/0/0 for each. If the next run shows the same count on the legacy side, it is an
order-independent pre-existing defect that needs its own lane, and the harness says so loudly
(`A8G1_WARNING`) rather than passing silently. If it shows a HIGHER count after than before, that is a
BLOCKING defect in this change and `OVERLAP_INTRODUCED` fires.

**A weakness in my own fixture, found and fixed.** The tight-room locks covered only period 0, which left
the home room free at periods 1–4 on Tue–Fri — so the **legacy comparator spread too**, and the fixture
had stopped reproducing the defect it exists to reproduce. My local mutant also treated the room as busy
for a whole day, so the mutant and the fixture were describing different states. The locks now cover every
period; legacy genuinely puts all five sessions on Monday and production puts them on five distinct days.
This strengthens rows 1, 2-control and 6, and it means attempt 1's fixture-level claims were weaker than
they looked.

## 1. What changed, per file, and why

| Path | Change | Why |
|---|---|---|
| `atlas-server/src/services/schedule-constructor.ts` | `daysUsedForPair` `Set<string>` → `Map<string, number>`; `dayUseCount` first sort key; `+2.5`/`+1.5` term guarded out of the production path; `lockDayUseByPair` seeded inside the lock-accept branch; `sectionLabelById`; `isDeclaredBlockSubject`; `SpreadException`/`SpreadReport`; `ConstructorResult.spreadReport`; **`spreadOrdering` test seam** | The day-reuse signal was a soft `+2.5` that the home-room `-0.5` exactly cancelled, so a used day with a free home room tied an unused day with a busy one at 3.0 and Monday won `DAYS.indexOf`. The seam exists only so both proof sides share one code path. |
| `atlas-server/src/services/generation.service.ts` | `RunSummary.spreadReport?` + `spreadReport: result.spreadReport` beside `unassignedCount` | The packet asks for the run **receipt**, not a screen. `generation_runs.summary` is jsonb and is returned verbatim by `getRunDraft`/`getLatestRunDraft`. |
| `atlas-server/src/__tests__/a8-g1-spread-sessions.test.ts` | 18 rows (was 10) | D1 frame rows, D2 term-key rows, mechanism row, plus the four packet gates. |
| `atlas-server/src/scripts/a8-g1-live-shape-proof.ts` | rewritten measurement; whole-DB copy path unchanged | D1 and D2. |
| `atlas-server/package.json` | `test:a8-g1-spread-sessions` | `gate-reachability.test.ts:26-58`. |
| `docs/handoffs/a8-g1-spread-sessions.md` | this file | — |

## 2. Decisions, and which way they went

1. **The `+2.5`/`+1.5` day term is out of the production path** — now *guarded* (`useLegacyDayPenalty`)
   rather than absent, so the legacy seam can reconstruct the old comparator exactly. At the default it is
   unreachable dead weight; it is reinstated only under the seam. Not "fixed twice".
2. **The exception condition is `count > max(1, ceil(sessionsPerWeek/5))`**, the packet's own
   post-condition — not `count >= 2`. An 8-session subject cannot beat 2/day, and reporting that as *"no
   other day was free"* would be false. 8 sessions come out 2/2/2/1/1 and report nothing; a 5-session week
   (the live case) reports every repeat. Count and list cannot disagree.
3. **`sameDayRepeatPairs` counts pairs above the cap.** For live 5-session subjects that equals the "31
   pairs" of Run 347.
4. **`spreadReport` is always present** (0/[] on a clean run), and optional on `RunSummary` so a run
   written before this change still reads.
5. **No c5 receipt redesign exists on `origin/main`** (`git grep -l "spreadReport\|runReceipt" origin/main
   -- atlas-server/src` → no match), so there was nothing to fold into. `spreadReport` is already the
   grouped shape c5's rule 4 asks for: one object, a count and a bounded typed list.
6. **`isPreferredAtSlot` untouched** — it orders *candidates within a slot*; `dayUseCount` orders *slots*.
7. **`spreadOrdering` is a code-only test seam with no user-facing control** and no default change. It is
   the minimum needed to make D1 expressible: without it, "before" can only come from a saved run, which is
   exactly the defect. It is a branch over an already-accepted behaviour, so a difference in the measured
   table is attributable to the ordering and nothing else.

## 3. The three label derivations

- **subject** — `subject.name?.trim() || subject.code?.trim() || \`Subject ${id}\`` (`name` is optional on
  `SubjectInput`).
- **section** — not stored anywhere; `DemandItem` carries no section name. Composed
  `<gradeLevelName minus "Grade ">-<sectionName>`, read off the section first, falling back to the
  enclosing `sectionsByGrade` group, tolerating neither. `"8-Makatao"` = `Grade 8` → `8` + `-` + `Makatao`.
- **day** — `MONDAY` → `Monday`.

Asserted exactly: `"Filipino for 8-Makatao has 5 classes on Monday (no other day was free)"`, plus the
packet's literal `2`-class example as a template string on the next line.

## 4. The authority traps

- **Not a violation.** `modularWarnings` → `generation.service.ts:1013-1014` →
  `PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS`. Never entered. `hasPublishedMarkers`, the readiness diagnostic
  and the publication predicate untouched. The compiler enforces disjointness: `ModularWarning.code` is a
  closed union that cannot hold the spread code.
- **No migration.** `model Subject` has no block/double-period column. `isDeclaredBlockSubject` returns
  `false` for every current subject; test `4b` reads `prisma/schema.prisma` and fails if a block-like
  column appears. Consecutive periods are a break rule, not a block.
- **Locked entries.** Seeded inside the accept branch, never by walking `lockedEntries`; test `5b` pins
  both halves.

## 5. Proof row: still `BLOCKED`, but now decidable in one run

I hold no credential authority: no ambient `DATABASE_URL`; no `atlas-server/.env` in this worktree; the
only reachable one is Lane C's credential file. Verified fail-closed:
`A8G1_PROOF_FAILED code=CONFIG_MISSING …` exit 1.

**The command the planner should run**, from `atlas-server/`, with the staging URL injected exactly as in
attempt 1 (never printed):

```
npx tsx src/scripts/a8-g1-live-shape-proof.ts --target atlas_restore_drill_20260929_a8g1r2
```

It now prints, per side: `A8G1_SIDE ordering=… demanded=… placed=… unplaced=… repeats=… worst=…
overlaps(t/s/r)=… hard=… seconds=…`, then the table, then
`A8G1_VERDICT repeats|unplaced|overlaps … -> …`, then one `A8G1_OVERLAP` line per surviving overlap with
its term, day, slot, count, kinds and `samePair`.

**The substantive question, and the honest answer.**

*Is the rise real?* **Undecided, and the corrected harness decides it in one run.** Attempt 1's `10 → 65`
compared a 3-term run's `unassignedItems` against one week's `unassignedCount`; those are different
populations and the `10` in particular is not the number the packet's `910/920` refers to. The new run
prints the legacy side's unplaced **on the same frame**, which is the first time that number has been
measured. Two outcomes, and they mean opposite things:
- legacy `unplaced` ≈ 10 → the rise is real and attributable to the ordering. **BLOCKING on this change.**
- legacy `unplaced` ≈ 65 → the rise was a frame artifact after all, and the constructor is exonerated.

*Mechanism.* The planner's hypothesis is the right one and I can pin its signature offline (test row `8`).
Spreading does **not** consume more work — the pair occupies the **same five section-slots** either way
(also asserted). What changes is **which days** the section is busy on. Legacy leaves 4 of 5 periods free
on one day and all 5 free on the other four; the spread leaves 4 free on *every* day. The constructor is
greedy in `orderedDemand` order, so a later subject for the same section — or a different section competing
for a grade-scoped room — now finds a thinner residual grid on every day instead of one intact day. The
binding resource on live is the room/teacher grid at ~920 sessions against 103 rooms; when it is tight,
that redistribution converts placements into `NO_COMPATIBLE_ROOM` / `NO_AVAILABLE_SLOT`.

*Can a cap-aware ordering recover them?* **Partly, and not without giving something up — and I cannot
claim a number without measuring, so I am not claiming one.* A cap-aware ordering would keep `dayUseCount`
first but stop spreading a pair once it reaches `ceil(sessionsPerWeek/5)` on its lightest day, falling back
to the cheapest `score` among the rest. That would preserve most of the `144 → 0` and recover some of the
55, because it returns exactly the placements whose only cost was a second session on an already-used day.
But it is **not free**: the packets' own target is `same-day repeat pairs → 0`, and for a 5-session subject
the cap is 1, so a cap-aware ordering with cap 1 *is* the current implementation. The only room left is to
relax the cap for subjects whose light days are all expensive, which directly trades away repeats on a
data-dependent basis — a heuristic, not a proof, and it needs its own measurement on the restored inputs
before it could be recommended. **My judgement: the two goals genuinely conflict on live-shaped data at
the current cap, and the conflict is decidable only by the re-run.** I am not going to report a green row
on a fixture I built to suit the answer.

## 6. Environment

`npm_modules` and the Prisma client are now installed in this worktree, so every gate below ran against
this worktree's own toolchain — no borrowed junction this round, and the earlier one was `rmdir`'d with the
donor verified intact at 208 entries. E: free was 22.78 GiB when measured (WARNING band, fail-closed below
15); nothing was installed or deleted by me this round.

## 7. Decisive commands, real results

From `E:\ATLAS-worktrees\lane-a8-g1\atlas-server` unless noted.

| Command | Result |
|---|---|
| `npm run test:a8-g1-spread-sessions` | `tests 18 / pass 18 / fail 0`, exit 0 (was 10/10) |
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
| `npx tsx src/scripts/a8-g1-live-shape-proof.ts --self-test` | `A8G1_SELF_TEST_OK`, **26 checks** |
| `… --target atlas_restore_drill_20260929_a8g1` (no `DATABASE_URL`) | `A8G1_PROOF_FAILED code=CONFIG_MISSING`, exit 1 |
| `… --target atlas_db` | `A8G1_PROOF_FAILED code=TARGET_NOT_DISPOSABLE`, exit 1 |
| `tsx -e "import('./src/scripts/a8-g1-live-shape-proof.js')"` | `IMPORTED_OK guards: function frameGuard: function` — importing does **not** start a restore |
| `Select-String` for the fatal codes in the harness | `UNPLACED_RAISED`, `OVERLAP_INTRODUCED`, `HARD_VIOLATIONS`, `FRAME_MISMATCH`, `FRAME_EMPTY`, `TARGET_NOT_DISPOSABLE`, `CONFIG_MISSING` all present |

The before/after **table** with real numbers cannot be produced by me — it needs the staging URL. Every
number in the table comes from one of three commands inside a single run, and the run prints its own
provenance: `A8G1_SIDE` (per side), `renderTable` (the table itself, including the `ordering` and
`sessions demanded` rows), and `A8G1_VERDICT` (the three before→after deltas).

## 8. Risks

**BLOCKING**

- **B1 — the rule-3 row is still unmeasured.** The harness is now sound and decidable, but nobody has run
  it since the fix. Until the planner does, the unplaced and overlap claims rest on construction (only
  candidate order changed; occupancy gates every candidate) plus fixtures, **not** on live-shaped data.
- **B2 (conditional) — if the re-run shows `unplaced` higher on the DAY_COUNT_FIRST side than on
  LEGACY_SOFT_PENALTY, the constructor change is wrong and must be corrected, not the harness.** The
  harness will exit non-zero with `UNPLACED_RAISED` and the exact delta.

**NON_BLOCKING**

- **N1** the receipt is not surfaced in any UI — by design; §8 and the UX rules apply if a later slice
  reads it.
- **N2** `spreadReport` is uncapped in `summary` jsonb; live had 31 such pairs.
- **N3** home-room preference survives as a *within-day* tie-break — intended per r2.
- **N4** `schedule-constructor.ts` is ~3,150 physical lines, over the §8 1,000-line rule. Pre-existing; the
  packet forbids splitting it.
- **N5** `spreadOrdering` widens the `ConstructorInput` surface for a test purpose. It is code-only, has
  no UI, and production never passes it; if the planner prefers a narrower seam, the alternative is a
  second exported comparator function, which is a larger change to the same region.
- **N6** the branch is unpushed and `origin/main` is ahead of `bfd14a96`; the planner owns pushing.
