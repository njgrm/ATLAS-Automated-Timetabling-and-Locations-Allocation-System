# A8 g1 approach note — spread a section's weekly classes across days (train 11)

Extends packet `docs/prompts/a8-g1-spread-sessions-2026-09-29.md`. Same service area as A8 c5; this note is
the pre-action review subject. Risk tier **HIGH** (generation quality), one review pass pre-action over this
note + the satisfiability lint, one post-action pass over the candidate range.

## The user and the feeling

The user is an older, mouse-first scheduler opening a teacher's program in Simple Timetable. Today Grade 8 -
Makatao reads "Filipino, Filipino, Filipino, Filipino, Filipino — Monday". It looks broken, so the scheduler
does not trust the run and starts editing it by hand. The change should feel like the timetable finally
notices the week is five days long: a subject's classes land on different days and the teacher's program
reads like a week, not a queue. Nothing new appears on screen — the schedule simply stops repeating itself.

## What the code does today (read on `origin/main` 5e03e0c4)

`atlas-server/src/services/schedule-constructor.ts`, placement loop per demand item:

- `daysUsedForPair` (line 2635) is a per-`(section|cohort, subject)` set of days already used.
- Candidate score (lines 2680-2701, 2695-2701): `score = 1`; `+2.5` when `daysUsedForPair.has(day)`
  (SECTION) or `+1.5` (COHORT); then home-room terms `-0.5` free / `+2` occupied.
- Sort (lines 2710-2715): `score`, then `DAYS.indexOf` (Mon…Fri), then start time.
- `daysUsedForPair.add(...)` at line 3105 on the placement that succeeded.

**Root cause, in one sentence:** the spread signal is a *weighted soft tie-breaker* whose swing (2.5) is
exactly cancelled by the home-room term's swing (2.5), and the final tie-break is *earliest day*, so when
the home room is free on Monday and busy on the other days the fifth session folds back onto Monday.

## The change (three parts, no schema, no migration)

1. **Lexicographic day-count key instead of a weighted penalty.** Candidate ordering becomes
   `(sessionsAlreadyPlacedForThisPairOnThisDay, score, DAYS.indexOf(day), startTime)`. The count dominates
   every soft signal, so home-room and room-quality preferences can no longer outrank "a day this pair has
   not used". Counting (not a boolean) is what makes the packet's rule 2 — "fill Mon-Fri evenly before
   doubling any day" — fall out for free when a subject has more sessions than days.
2. **Typed report when a spread placement does not exist.** Two-pass per session: first pass restricts
   candidates to days with count 0 (and to a declared block subject, if any); if nothing places, a second
   pass re-runs the same loop over all days, and the fallback placement is recorded as
   `SpreadWarning { code: 'SAME_DAY_REPEAT_NO_SPREAD_AVAILABLE', sectionId, subjectId, subjectLabel, day,
   count, message }` on the new `ConstructorResult.spreadWarnings`. Message wording is the packet's:
   `"Filipino for 8-Makatao has 2 classes on Monday (no other day was free)"`. Modelled on the existing
   `ModularWarning` (line 1400) so the shape is not invented. Carried into the run summary next to
   `unassignedCount` so it reaches the run receipt; the packet only requires the receipt, not new UI.
3. **Block definition — no schema change.** `Subject` has no block/double-period field (verified on
   `prisma/schema.prisma`: `minMinutesPerWeek`, `durationPerSession`, `modularGroupId`, `rotationFamily`,
   `schedulingDisposition` only). So the rule is data-driven and defaults to **no block subjects**: every
   same-day repeat is a `SAME_DAY_REPEAT_NO_SPREAD_AVAILABLE` exception, and the "non-block" target is
   every same-day repeat. The block escape hatch is a named predicate the code consults, so a future
   declared block is one predicate, not a rewrite. Consecutive periods are **not** by themselves a block —
   otherwise a 5-week subject would legitimately become 2+2+1 and the target would never be 0.

## What is explicitly not done

- No migration, no `Subject` column, no new UI surface, no new hard violation, no change to the strict
  publication predicate, no change to `unassignedItems` reasons, no change to the readiness diagnostic.
- `hasPublishedMarkers` / summary shape stay backward compatible: `spreadWarnings` is additive and
  optional, and a run created before this change still reads.

## Proof (staging copy of live, nothing live)

- `npm run backup` (read-only against `atlas_staging`, which `atlas-server/.env` already points at) →
  `src/scripts/atlas-restore-drill.ts --archive … --manifest … --target atlas_restore_drill_20260929_a8g1`
  → a disposable DB whose contents are the live-shaped data. The drill script already proves live is
  untouched and drops the target afterwards.
- Generation runs **only** against that disposable DB (built server on a non-live port, or an offline
  script calling the same service the route calls). Never on live, never on staging, never through the
  supervised 5001/5174 runtime.
- Before/after, recorded in one table: same-day repeat pairs (target 0 non-block), unplaced (910/920 now),
  teacher overlaps (0), section overlaps (0), room overlaps, hard violations (0), run seconds.
- Fixture test per packet rule 4: 5 sessions/week, tight rooms → 5 distinct days.
- `test:server-suite`, `test:server-db` (or the decisive subset), `tsc`, `build`, `git diff --check`,
  `npm run test:encoding`.

## Satisfiability lint (answers before the review, not after)

- *Is "hard when a spread placement exists" satisfiable?* Yes — implemented as a two-pass loop, not as a
  filter that empties the candidate list, so the fallback is explicit and counted.
- *Could the count key raise the unplaced count?* Only if every unused day is genuinely blocked; then the
  fallback pass places it anyway, so unplaced is unchanged **by construction**. The proof measures it.
- *Could it create an overlap?* No: occupancy marking is unchanged and the fallback pass re-enters the same
  loop with the same guards.
- *Does it change the published run?* No. Live Run 347 is a published artifact; this only affects future
  generations. No live action is authorized by this lane.
