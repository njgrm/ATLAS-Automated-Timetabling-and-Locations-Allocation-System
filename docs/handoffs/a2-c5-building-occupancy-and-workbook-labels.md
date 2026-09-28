# Named successors from A2 C5 (2026-09-28) — items 3, 4b, and the overriding rule

Candidate `6833047b` + its correction commit, branch `work/a2-c5-map`, base
`bd789d86`. Each item below was **decided, not deferred**: the branch taken is
recorded with the evidence that decided it, and what a successor would have to
supply. Nothing here changes production behaviour; these are the questions this
packet deliberately did **not** answer on its own authority.

## 1. Item 3 — a real `buildingOccupancy` for the campus map (#53 remainder)

**Branch taken: NO. Nothing was changed.** A3's honest not-available state ships
and is correct. `CenterWorkspace` passes no `buildingOccupancy` to `CampusMap`,
so every wing renders `USE N/A` via `buildingOccupancyTileLabel`.

### Why a real occupancy is not derivable on this surface

A real figure must have **the building's schedulable periods** as its
denominator, not a raw entry count. Three measured blockers stop that here:

1. **The denominator is self-referential, and yields a fabricated 100%.**
   `RunSummary.timetableDisplaySlots` is optional (`atlas-client/src/types.ts`).
   When it is absent, `pivotDraftToView` derives the display slots *from the
   occupied entries themselves* (`atlas-client/src/lib/schedule-pivot.ts:128-136`).
   `availableMinutes` is then `slotMinutesTotal × DAYS.length` over those
   self-derived slots, so a room with one lesson in one period has a denominator
   of one period and reports **100%**. That is a fabricated figure wearing a
   measured-figure label — the exact class of defect this lane exists to remove.
2. **No verified ordered active term reaches `CenterWorkspace`.**
   `CampusMapOverview` and `CampusReadinessCard` each resolve a *verified* term
   themselves via `isVerifiedOrderedActiveTerm` and refuse to compute anything
   when it is null. `CenterWorkspace` carries no such value: the timetable header
   has to verify separately that `activeTermContext.verified === true` and that
   the term appears in `orderedTerms` (`ScheduleReviewWorkspaceHeader.tsx:388-391`).
   The project's own live history records this authority as frequently
   unresolved (`ACTIVE_TERM_UNRESOLVED`, `TERM_STRUCTURE_UNAVAILABLE`).
3. **Per-entry term identity is optional.**
   `ScheduledEntry.termIndex?: number`. `pivotDraftToView` fails closed with
   `TERM_IDENTITY_UNAVAILABLE` if any entry for the entity lacks a numeric
   `termIndex`, so a partially-identified draft can never yield a single-term
   percentage.

### Why the existing producer is not the answer

`deriveBuildingOccupancy` (`atlas-client/src/components/sections/buildingOccupancy.ts`)
is the only current producer, used by `Sections.tsx`. It computes
`occupied teaching spaces / teaching spaces in that building` — a **room-count
ratio**, not a period ratio. It would be wrong twice over: the figure would wear
the toolbar legend `Use = share of periods in use` while measuring something
else, and it hard-codes `map.set(b.id, 0)` for a building with no teaching rooms,
which is an unmeasured zero presented as a measurement.

### What a successor needs

- **Data:** a `DraftReport` whose `summary` is non-null and whose
  `timetableDisplaySlots` is populated — the authoritative period structure, not
  slots derived from the entries.
- **Endpoint:** the same latest-run report read that `CampusMapOverview` performs
  in its own effect (`setScheduleReport(reportRes.data)`), scoped to the actor
  school and school year. `CenterWorkspace` does not request it today, and a
  successor must add that read (with actor-school authority) rather than infer
  from what the grid already holds.
- **Run state:** a term-resolved run — a **verified ordered active term**, with
  every entry for each room carrying a numeric `termIndex`. Without that the
  correct output is an empty map and every wing stays `USE N/A`.
- **Then:** building occupancy = placed minutes in that building's teaching
  rooms ÷ those rooms' schedulable periods for the resolved term, aggregated
  across rooms (not per room), and labelled in the DOM so a scheduler can read
  what the percentage means.

**Failing-first note for whoever takes it:** assert the *absence* case first. A
test that only proves a real figure appears will also pass against the
self-derived denominator's fabricated 100%, so it does not discriminate.

## 2. Item 4b — the class-program learner labels

**Reverted in the correction round.** `1b272c3e` (2026-09-24 17:00, "add
official program exports") deliberately set the identity-row labels to the bare
`MALE` / `FEMALE` and folded the total into `TOTAL: n`. An earlier draft of this
candidate restored the long C05 reference form
(`No. of Learners — MALE:` / `FEMALE:`, from `f29a9667`) on the theory that the
writer had drifted from the parity contract. That was a revert of an
intentional, **later** decision on an **official** export, with no packet row
mandating it, and it is not shipped.

**Open question for a successor:** which label set is correct for the official
program? `f29a9667` pinned the long form as C05 parity copy; `1b272c3e`
replaced it ten minutes later as part of the official-export design. The two
commit messages do not state the reason for the substitution, so the decision
needs the author, not a diff. The figures (columns 4 and 6) are unaffected
either way.

## 3. Item 4b — the daily totals row arithmetic

**Reverted in the correction round; base behaviour is shipped.** The row sums
the **placed entries** (`dailyMinutes[day] += entry.minutes`) and puts the
five-day sum (`weekTotalMinutes`) in column 2, under a label that reads
`TOTAL MINUTES PER DAY`. The block's own comment above it claims the row is
"reconciled to the configured period structure", which the code does not do.

Measured on the committed fixture in `tt-output-c03r.test.ts` (two 45-minute
lessons, both on Monday, in a three-period class-slot structure):

| cell | base behaviour | period-structure behaviour |
|---|---|---|
| col 2 (`weekTotalMinutes`) | 90 | 135 |
| col 3 (Monday) | 90 | 135 |

**Why it was reverted rather than shipped:** the suite's only totals assertion
(`getCell(2) === 135` and `getCell(3) === 135`) is arithmetically **identical**
under both implementations, so no test discriminates. Changing the arithmetic of
an official export with no discriminating control is an unasserted change, and
this is an official export.

**Open question for a successor, in two parts:**

1. Which figure is correct — placed-entry minutes, or the configured period
   structure? The two differ exactly when a day has unplaced periods, which is
   the normal state of a draft.
2. Whatever is chosen, column 2 sits under a label that says "PER DAY" but
   currently carries a five-day sum. That label/value mismatch is independent of
   part 1 and looks like a genuine defect on its own.

A successor **must** add a discriminating fixture before changing the
arithmetic — for example one lesson on Monday and one on Tuesday, so col 2 and
col 3 diverge and the two implementations can no longer be confused. The
existing fixture puts every lesson on one day, which is why it cannot tell them
apart.

## 4. Overriding an acceptance row is a planner decision

Recorded because it nearly went the other way here. The packet's M4b-B read
"the emitted sheet's last column must be `H` and its header row contains
`TEACHER`". A committed test asserting exactly that was red, and making it green
by changing the writer would have been the obvious path. It was wrong: `2558d322`
and `1b272c3e` are the two halves of one deliberate decision to remove column 8,
and the red test was a **stale** test, not a red product.

**The rule, for the next lane:** when an acceptance row and a committed test
disagree, neither is automatically right. Check whether the test is *stale*
(superseded by a later commit that the test was never updated for) or the
product is *wrong* (the test still describes the intended behaviour). Only the
second justifies changing behaviour. If a packet row cannot be met without
overriding a decision the packet did not mention, that is a planner call to make
explicitly — **flag the temptation, do not act on it.**
