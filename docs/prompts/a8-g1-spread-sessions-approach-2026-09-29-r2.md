# A8 g1 approach note — spread a section's weekly classes across days (train 11), **revision 2**

Extends packet `docs/prompts/a8-g1-spread-sessions-2026-09-29.md`. Same service area as A8 c5.
Risk tier **HIGH** (generation quality). Revision 2 answers the pre-action review
(`ses_f12cfe61cffepaM64N9Hf7rhna`, `VERDICT: PRE_ACTION_CORRECTION_REQUIRED`, 4/8) row by row. The review's
record is preserved; this note supersedes revision 1 (`363f2887`) and does not delete it.

The user is an older, mouse-first scheduler opening a teacher's program in Simple Timetable. Today Grade 8 -
Makatao reads "Filipino, Filipino, Filipino, Filipino, Filipino — Monday". It looks broken, so the scheduler
does not trust the run and starts editing it by hand. The change should feel like the timetable finally
notices the week is five days long. Nothing new appears on screen.

## R1 — root cause (reviewer: PASS, confirmed)

`atlas-server/src/services/schedule-constructor.ts`: `daysUsedForPair` is a per-`(section|cohort, subject)`
`Set<string>` (2635) read as a **weighted soft penalty** `+2.5` SECTION / `+1.5` COHORT (2681, 2696); the
home-room term swings `-0.5` free / `+2` occupied (2682-2684, 2697-2699) — the identical 2.5 swing; the
final tie-break is `DAYS.indexOf(day)`, Mon first (2710-2715). So a used day whose home room is free
(3.5 − 0.5 = 3.0) ties an unused day whose home room is busy (1 + 2 = 3.0) and Mon wins. `daysUsedForPair`
is added at 3105 on the placement that succeeded.

## R2 — the fix: ONE ordered pass, no second pass (reviewer: CORRECTION_REQUIRED → corrected)

The review is right that a two-pass structure is unnecessary and carries four accumulator / reason-priority
hazards (`placed` flag reuse, `sessionFailureReasons` double-add, `assignedCount`/`unassignedCount`,
`policyBlockedForSession`, `sawFacultySlotUnavailable`). **Revision 2 uses a single pass.** The whole fix is
one new FIRST sort key on the existing candidate list:

```
possibleSlots.sort((a, b) => {
  if (a.dayUseCount !== b.dayUseCount) return a.dayUseCount - b.dayUseCount;   // DOMINANT
  if (a.score !== b.score) return a.score - b.score;                           // unchanged soft terms
  const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);                    // unchanged tie-break
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
});
```

`dayUseCount` replaces the boolean `daysUsedForPair.has(day)` penalty: it is the **count** of sessions of
this pair already placed on that day. Consequences, all in one pass with no new branch:

- Count 0 beats count 1+ regardless of home-room/room quality → the packet's "hard when a spread placement
  exists", because the loop tries every count-0 candidate before any count-1 candidate.
- If every count-0 candidate fails on faculty, room, capacity or policy, the loop continues into the
  count-1+ candidates and places it anyway. Unplaced is unchanged **by construction** (R5) and overlaps are
  unchanged because occupancy marking, the hard daily/consecutive guards (2893-2915) and
  `getQualifiedFacultyIds(..., sessionTermIndex)` (2742) are untouched.
- Counting (not a boolean) gives packet rule 2 for free: the min-count day wins, so a subject with more
  sessions than days fills Mon-Fri evenly before doubling any day.
- The existing `daysUsedForPair.add(day)` (3105) becomes a counter increment. The COHORT 1.5/2.5 asymmetry
  is kept as-is in the `score` term so cohort packing behaviour is unchanged.

**Cap (`R8.1`, "Never 5 on one day").** With `dayUseCount` dominating, a 5-session subject over 5 days gets
5 distinct days whenever any free day exists. 5-on-one-day is then only reachable when all four other days
are genuinely blocked for that pair at every valid period. `preferredMaxPerDay = ceil(sessionsPerWeek / 5)`
is asserted as a post-condition of the run, and any pair above it is reported (below). The packet's rule 1
("if none exists, place it and report it") governs over the cap, because packet rule 3 forbids raising
unplaced; the receipt states the count, day and reason so the condition is visible rather than hidden.
This is the stricter-reading reconciliation and it is the planner's call, not a silent choice.

**Locked entries (`R2.d`, reviewer's new finding — accepted).** `lockSessionCounts` (2294-2354) reduces
`sessionsNeeded` but never seeds day usage, so on the keep-my-edits path a locked Monday block is invisible
to the spread rule. Revision 2 requires the day usage map to be seeded from `lockedEntries` for the same
pair key (`getDemandAssignmentKey`) before the session loop, so a locked placement counts as a day use.

**Receipt path (`R3` / reviewer's finding — accepted, note was wrong).** Revision 1 proposed carrying the
report "like `modularWarnings`". That is wrong: `generation.service.ts:1013-1014` maps `modularWarnings` into
`Violation[]`, and `publication-contract.service.ts:361` throws `PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS` when
soft violations are unacknowledged. A spread exception is **not** a violation and must never become one.
Revision 2 therefore adds a **separate, non-violation** summary field:

```
spreadReport?: {
  sameDayRepeatPairs: number;         // pairs with >1 session on a day
  exceptions: SpreadException[];      // { code, sectionId, sectionLabel, subjectId, subjectLabel, day, count, message }
}
```

`SpreadException.code = 'SAME_DAY_REPEAT_NO_SPREAD_AVAILABLE'`, message exactly
`"Filipino for 8-Makatao has 2 classes on Monday (no other day was free)"` — built from the real section and
subject labels that are already in scope in the constructor. It goes on `ConstructorResult` and on
`RunSummary` beside `unassignedCount` (the packet asks only for the run receipt, **not** new UI), never into
`violations`, never into the readiness diagnostic, never into the strict publication predicate.
`generationRun.summary` is a JSON blob (`asSummaryRecord`, `generation.service.ts:89`), so an additive key is
backward compatible: a run created before this change still reads. `hasPublishedMarkers` is untouched.

## R4 — block rule (reviewer: PASS, confirmed; `R8.4` restated)

`prisma/schema.prisma` `model Subject` has no block/double-period field — only `minMinutesPerWeek`,
`modularGroupId`, `rotationFamily`, `schedulingDisposition`, `termCount`, `gradeLevels`. **No data source
defines a block**, so a migration would be required and is out of scope. Revision 2 keeps a single named
predicate `isDeclaredBlockSubject(subject)` that consults nothing but existing fields and returns `false`
for every current subject; it is code-only, adds no user-facing setting, and is documented as "no subject in
the current schema declares a block". Consecutive periods are **not** by themselves a block — otherwise a
5-week subject would legitimately become 2+2+1 and the "0 non-block" target could never be reached. Every
same-day repeat is therefore a reportable exception today.

## R5 — satisfiability lint

- *Hard-when-spread-exists without a second pass?* **Yes** — revision 2 is a single sort-key change (R2).
- *Unplaced provably unchanged?* **By construction** — the loop still tries every candidate, in an order
  that only changed. Measured anyway.
- *Overlaps provably unchanged?* **Yes** — occupancy marking and the hard guards are not modified.
- *Receipt path reachable with real labels?* **Yes** — section and subject labels are in scope; the field
  path is `ConstructorResult.spreadReport` → `generation.service.ts` RunSummary JSON. The executor must
  assert the message string in a test with the real label shape.
- *Harness per row.* Fixture row = source test. Live-shaped before/after row = a **new proof harness the
  executor writes** (see below) — it does not exist yet, which the review correctly flagged.

**The live-shaped proof harness (executor deliverable, not yet built).** `scripts/run-db-suite.mjs` cannot
serve it: it builds an empty template (`prisma migrate deploy`, no data) at :151-155 and drops every
database at :218-222. `src/scripts/atlas-restore-drill.ts` restores and then drops its target. So revision 2
requires a new `atlas-server/src/scripts/a8-g1-live-shape-proof.ts` that, modelled on `run-db-suite.mjs`:

1. Refuses to start unless `DATABASE_URL` names `^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$` and is neither
   `atlas_db` nor `atlas_recovery_clean_rebuild_20260905` (`run-db-suite.mjs:36-38,115-121`; the same guard
   `disposable-db-write-guard.test.ts` pins).
2. **Whole-database copy, not a hand-written table copier (C5 correction, round 2).** Restore a full
   `pg_dump` of the staging database into exactly one guarded `atlas_restore_drill_*` target, reusing the
   already-guarded primitives in `atlas-restore-drill.ts` — `createdb -T template0` (`:142`),
   `pg_restore` (`:158`), `assertRestoreTargetAllowed` (`:124`), `runWithGuaranteedCleanup` (`:153`),
   `assertCleanupTargetAllowed` (`:223`) and `database-backup.service.ts`. There is **no hand-written
   per-table copy**: the production preflight reads ~20 tables in FK order
   (`generation-preflight.service.ts:801-844`), and a hand-written copier either fails on FK order or
   silently omits a table the constructor reads, producing a decisive-looking but wrong before/after table.
   The source is `npm run backup`'s `pg_dump` of `atlas_staging` (per §5, `atlas-server/.env` points at
   `atlas_staging`, not live) and it is reached through a **separate `childEnvFor`-style env**
   (`atlas-restore-drill.ts:49-59`), never through the `DATABASE_URL`-bound Prisma singleton
   (`atlas-server/src/lib/prisma.ts:14` binds at import time, so reusing it would silently read the drill
   DB and record the wrong source signature). Source counts are recorded before and after and must match.
3. Sets `ROLLOVER_AUTO_SYNC_ENABLED=false` (as the drill does at `:205`).
4. Runs generation **only** against the drill DB — never live, never staging, never the supervised
   5001/5174 runtime — then prints the before/after table: same-day repeat pairs (target 0 non-block),
   unplaced, teacher/section/room overlaps, hard violations, run seconds.
5. Proves the staging source's counts are unchanged after the run, drops the drill DB, and proves zero
   residue over exactly the names it created.
6. Never prints a credential; never reads `D:\ATLAS-runtime-config\*`.

If the harness cannot be made to run, the row is reported `BLOCKED` with the reason — never silently dropped
(§16). **`UNPERFORMED` is not pre-authorised for this row** (r2 first draft wrongly allowed it; a
whole-database restore makes it decidable, and the packet's central proof row must be decided by a harness,
not waved through).

## R6 — test/gate reachability (reviewer: PASS)

`gate-reachability.test.ts:26-58` turns the suite red for any test file no `test:*` script names, so the
same commit adds `"test:a8-g1-spread-sessions": "tsx --test src/__tests__/a8-g1-spread-sessions.test.ts"`.
Preservation suites that must stay green: `test:timetable-scheduling-quality-c03`, `test:hybrid-scheduler`,
`test:timetable-sync-setup`, `test:readiness-stall`, `test:disposable-db-guard`,
`test:warning-count-scope-warn62` (soft-violation count authority — the row at risk from the receipt path),
`test:generation-completion-copy-c2`, plus server `tsc`, `build`, `git diff --check` and
`npm run test:encoding`. The fixture row must carry a **discriminating control**: assert that the pre-change
ordering (the +2.5 penalty, i.e. the base commit) puts all 5 sessions on one day, so the row cannot be
vacuously green. Precondition: `node_modules` is absent in this worktree; the E: free-space check (below)
gates `npm ci`.

## R7 — coordination with A8 c5 (reviewer: CORRECTION_REQUIRED → corrected)

- **Same surface.** A8 c5's rule 4 and its 19:58 addendum build the same run receipt. A merge does not
  resolve two lanes writing one receipt. Before the executor touches the receipt, it must `git merge
  origin/main`, read c5's current receipt shape, and fold this change into it — **one** receipt, not a second
  list. `spreadReport` is a grouped object with a count and a bounded exception list, never a raw
  `string[]` dumped into the receipt, and never a raw count alone. If c5 has already landed a receipt
  redesign, the spread report rides inside it; c5 owns the receipt surface, this lane owns the spread
  content. If the receipt becomes user-visible, §8 (header budget) and the 2026-09-29 UX-regression rules
  apply and this lane owes a screenshot set at 1366x768.
- **The constructor conflict is semantic, not mechanical.** The newest commit touching the file introduced
  `isPreferredAtSlot` (the soft availability ranking now at 2745-2760) inside the very candidate scan this
  change restructures, alongside the hard daily/consecutive guards (2893-2915) and the per-term faculty
  lookup (2742). On conflict the executor keeps the spread count as the FIRST sort key and leaves the
  availability `PREFERRED` ranking as a candidate-level soft key; it must never resolve by taking "ours"
  wholesale, and a semantic conflict goes back to the owning lane rather than being papered over. Per packet
  line 21 the executor commits and pushes a `wip(...)` checkpoint **before** each merge so the merge never
  holds the only copy of the work.

## R8 — what revision 1 did not satisfy (reviewer: CORRECTION_REQUIRED → all answered)

1. "Never 5 on one day" → the `dayUseCount` cap + post-condition + reported exception (R2). Planner
   adjudication: rule 1 governs over the literal cap because rule 3 forbids raising unplaced; the receipt
   makes the count visible.
2. "Prove on a staging copy of live" → the new fail-closed proof harness (R5). Previously undecidable.
3. "5 sessions/week × tight rooms: 5 different days" → the fixture states rooms per day and carries the
   discriminating base-behaviour control (R6), so a legitimate same-day fallback is distinguishable from a
   regression.
4. Block rule → a predicate with no user-facing setting (R4).
