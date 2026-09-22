# ZONE-WARNING-REMOVAL-C01 — remove `ZONE_IMBALANCE_WARNING` entirely

**Status:** `PREPARED`. **Risk:** MEDIUM (production warning behaviour). **Owner:** Lane A.

## 0. Why — the operator's decision, 2026-09-22

> *"schools don't have the luxuries to flesh out classes across a campus if they are in a tight
> situation, that should not be a warning in any way."*

That is the decisive product judgement, and it is correct on the merits: the warning asks a school to
spread classes across campus, which a school in a tight situation **cannot act on**. A warning must be
actionable; this one fails that test. It is not a scheduling defect, it is a constraint the school
cannot change.

This **supersedes** `ZONE-IMBALANCE-PRECONDITION-C01` (`47081de3`), which gated the warning behind a
≥2-configured-zones precondition instead of removing it. The precondition was correct engineering but
the wrong call — the feature should not exist. `ZONING-CLARITY-C01` (`10716aa1`) improved the copy of a
warning that is now being deleted; its **non-warning** parts (the "Campus zone" config label) stay.

**Live effect today:** run 315 carries 3 of these rows; with 0 of 103 rooms zoned they are pure noise.
After this change no new generation can produce one.

## 1. Deliverables

**D1 — remove the producer.** In `atlas-server/src/services/generation.service.ts`: delete
`buildZoneImbalanceWarnings` and its call site (the `zoneWarningViolations` input to
`applyConstraintOverrides`), and `buildZoneDistributionByTerm` **if nothing else consumes it** — check
first and say what you found. No new generation may emit the code.

**D2 — keep stored runs honest (follow the precedent).** `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` is the
in-repo precedent for retiring a warning code: its **producer and config are gone** but a
**presentation entry survives** so historical rows still render, worded as historical. Mirror that
exactly for `ZONE_IMBALANCE_WARNING`:
- keep the code in the `ViolationCode` union (`atlas-client/src/types.ts`) and in the server's
  `VIOLATION_CODES`, because a complete `Record<ViolationCode, …>` presentation map requires it;
- reword its presentation entry (both `atlas-client/src/lib/violation-presentation.ts` and the server
  map in `constraint-validator.ts`) to say it is **no longer calculated** and that an older run
  recorded it — not an action to take.
- **Keep** the `raw.meta?.zone === 'UNSPECIFIED'` suppression in the merged-violation loop so stored
  noise does not resurface.

**D3 — remove the actionable surfaces.** Delete the zone warning from the surfaces that present it as
something to act on: `atlas-client/src/components/timetable/simplePublishReadiness.ts` (the
"Zone imbalance" / "Campus zone imbalance" label) and
`atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts` (the rail label) — unless
those maps are complete records that require an entry, in which case keep the key with historical
wording. **Say which applies.**

**D4 — the config field stays.** `BuildingPanel.tsx`'s "Campus zone" room field and the
`ZONING-CLARITY-C01` help line remain (the field is not the warning). Do not remove the field.

**D5 — tests.** Update only assertions that pin the removed/actionable behaviour, and say which. Add
one assertion that the producer no longer emits the code and one that a stored row still renders with
historical wording.

## 2. Boundaries — do not break

- **Writable:** `atlas-server/src/services/generation.service.ts`,
  `atlas-server/src/services/constraint-validator.ts`, `atlas-client/src/lib/violation-presentation.ts`,
  `atlas-client/src/types.ts`, `atlas-client/src/components/timetable/simplePublishReadiness.ts`,
  `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`, and the tests that pin
  this behaviour.
- Do not remove the `ViolationCode` union member or the server code list — see D2.
- No other warning's behaviour, severity or count may change. `ROOM_CAPACITY_EXCEEDED` stays SOFT.
- No `docs/**`, `CHANGELOG.md`, or companion repo.

## 3. Gates (run and paste literal results)

1. `npm run test:server-suite` — must stay green.
2. `npm run test:server-db` — must stay green (53 files).
3. `npm run test:client-suite` — must stay green.
4. `npm run build` in **both** packages.
5. `git diff --check`.

## 4. Return (one page)

Base SHA · candidate SHA · exact changed paths · whether `buildZoneDistributionByTerm` had other
consumers · whether D3's maps required an entry (and what you did) · the two new assertions with
literal output · confirmation no `ViolationCode` union member was removed and stored rows still render
· gate results · risks marked `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
