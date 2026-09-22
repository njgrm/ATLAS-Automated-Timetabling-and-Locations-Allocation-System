# ZONE-IMBALANCE-PRECONDITION-C01 — stop the false-positive zone warning (gate it, don't delete it)

**Status:** `PREPARED`. **Risk:** MEDIUM (production warning behaviour). **Owner:** Lane A.
**Custody note:** the change is **server-side** (`atlas-server/src/**`), which the Lane B charter
reserves for Planner B. Planner B has stopped; the operator directed Lane A to take this stream. No
Lane B work is in flight — all their worktrees are merged into `main` (one dirty residual,
`timetable-scheduler-simplicity-c01`, is left untouched). Recorded so the boundary stays provable.

## 0. The question, answered with evidence

The operator asked whether `ZONE_IMBALANCE_WARNING` is necessary at all, leaning toward removing it.
The measurements say: **the warning as written is a false positive, but the feature it needs is real
and wired up.** So the correct fix is a **precondition**, not a deletion.

**Live data (published run 315, the live school/year):**

| fact | value |
| --- | --- |
| `ZONE_IMBALANCE_WARNING` rows in run 315 | **3** (of 335 SOFT) |
| their `meta.zone` | **`UNSPECIFIED`** — all three |
| their `meta.percent` / counts | **100%**, `zoneEntryCount 920` of `total 920` |
| rooms with a `building_zone_id` | **0 of 103** |

So it is not detecting a scheduling imbalance. With no room zoned, every entry falls into one
`UNSPECIFIED` bucket, which is trivially 100% — the warning restates "you have not filled in a
configuration field". Its own action text ("Rebalance rooms across configured zones") is impossible
to follow. It is pure noise in the operator's warning list.

**But it is not dead code.** `buildingZoneId` is a real, editable room field with a UI:
`atlas-client/src/components/BuildingPanel.tsx:715-717` (edit), `:243` (save), `:168` (create). A
school that zones its buildings would get a meaningful signal. Deleting the feature to remove today's
noise would throw away wired-up capability.

## 1. Deliverable

**Make the warning fire only when the data can support the judgement.** In
`atlas-server/src/services/generation.service.ts` (the zone block at ~`:825-857`):

1. **Exclude unzoned entries.** An entry whose room resolves to `UNSPECIFIED` must not be counted —
   an unzoned bucket cannot be rebalanced.
2. **Require at least two distinct configured zones** among the zoned entries. With fewer, there is
   nothing to balance against and no warning may be emitted (this is the precondition that is missing
   today).
3. **Keep the >50% threshold**, but compute it over the **zoned** denominator.
4. The **message must state the zoned denominator** truthfully (e.g. "…has 72% of zoned scheduled
   entries (n of m zoned; k entries have no configured zone)") so a reader can see what was measured.
5. Remove the now-unreachable `raw.meta?.zone === 'UNSPECIFIED'` suppression at `:1581` (nothing can
   produce it any more) — or keep it and say why; do not leave a suppression that hides a live path.

**Expected effect on the live run:** the warning is **silent** (0 of 103 rooms are zoned), so run 315's
three noise rows stop being produced on the next generation. Historical rows already stored are
untouched and must keep rendering.

## 2. Boundaries — do not break

- **Writable:** `atlas-server/src/services/generation.service.ts`, plus the server tests that assert
  this code's behaviour, plus the **client presentation copy** only if it becomes inaccurate.
- **Do not delete the code** from `VIOLATION_CODES`, the presentation maps, `types.ts`, or the
  constraint-config allowlist. It remains a valid, configurable warning; only its precondition changes.
  (If you find a surface whose copy is now wrong, correct the copy — do not remove the code.)
- Do not touch `atlas-client/src/components/timetable/**` (Planner B's active surface), `docs/**`,
  `CHANGELOG.md`, or any companion repo.
- Do not change any other warning's behaviour, severity, or count.
- Keep `ROOM_CAPACITY_EXCEEDED` SOFT and never a hard blocker (standing invariant).

## 3. Tests

- Add a case proving the **precondition**: with zero or one configured zone the warning is **not**
  emitted (today it is); with two or more zones and >50% concentration it **is** emitted, with the
  correct zoned denominator and resolvable `entities.entryIds`.
- Keep every existing assertion; where an existing test asserts the old unconditional behaviour,
  update it to the new contract **and say so** — do not delete it.
- Preserve `tt-warning-realism-c07a` and `warning-readability-c01` intent (identical results across
  generation / manual-edit / quick-place / pre-generation / sync / publication-readiness).

## 4. Gates (run and paste literal results)

1. `npm run test:server-suite` — must stay green (275 + your additions).
2. `npm run test:server-db` — must stay green (53 files).
3. `npm run test:client-suite` — must stay green (846).
4. `npm run build` in **both** packages.
5. `git diff --check`.

## 5. Return (one page)

Base SHA · candidate SHA · exact changed paths · the precondition's literal test evidence (silent at
0/1 zones, fires at ≥2) · confirmation that no warning code was deleted and historical rows still
render · the gate results · risks marked `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
