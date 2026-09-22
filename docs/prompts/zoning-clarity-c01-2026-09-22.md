# ZONING-CLARITY-C01 — make zoning legible to a scheduler

**Status:** `PREPARED`. **Risk:** LOW (copy-only + one help line; no behaviour, no data).
**Owner:** Lane A (client surface). **Worktree:** provisioned by the planner.

## 0. The problem — measured, not asserted

The same concept is called two different things in two places, and neither explains what it is for:

| Surface | Today |
| --- | --- |
| Room edit form (`BuildingPanel.tsx:711-717`) | label **"Zone / Annex"**, placeholder `e.g. MAIN, ANNEX` |
| Room list badge (`BuildingPanel.tsx:857-861`) | the raw value in a purple badge, unexplained |
| Warning title (`violation-presentation.ts:32`) | **"Campus zone concentration"** |
| Warning meaning | "Too many selected-term classes are concentrated in one configured campus zone." |
| Warning action | "Rebalance rooms across configured zones or explicitly accept the concentration." |
| Server message (`generation.service.ts`) | `Term 1 zone North has 66.67% of zoned scheduled entries (100 of 150 zoned; 770 entries have no configured zone), exceeding the 50% balancing threshold.` |

So a scheduler sees "Zone / Annex" while configuring, then "Campus zone concentration" in a warning,
with nothing anywhere saying **what a zone is for** or **what the warning is telling them to do**. The
warning only fires when ≥2 zones are configured and >50% of zoned classes sit in one
(`ZONE-IMBALANCE-PRECONDITION-C01`, `47081de3`).

## 1. Deliverables

**D1 — one vocabulary.** Use a single term for the concept everywhere it is shown to a user. Choose
**"Campus zone"** (it is already the warning's term) and apply it to the config label, the placeholder
context, and the room-list badge's tooltip/help. No other surface may keep "Zone / Annex".

**D2 — say what it is for, where it is configured.** Add a short help line under the zone input
explaining, in plain words, that a campus zone groups rooms by part of campus and that ATLAS warns
when most of a term's classes sit in one zone. Keep it to one sentence; do not turn it into a
paragraph. Use `@/ui` primitives — **no `title` attribute, no raw `<details>`**.

**D3 — make the warning readable at a glance.** Rewrite the zone entry in
`atlas-client/src/lib/violation-presentation.ts` so the three fields are decidable without reading the
server message:
- **title** — names the zone and the share, not an abstraction (e.g. "Most classes are in one campus
  zone" rather than "Campus zone concentration");
- **meaning** — one plain sentence: what was measured and against what threshold, in scheduler words;
- **action** — one concrete step a scheduler can take (rebalance specific classes, or accept it), not
  "rebalance rooms across configured zones" generically.

Keep it consistent with the same entry in
`atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts` and
`atlas-client/src/components/timetable/simplePublishReadiness.ts`.

**D4 — stay truthful.** The copy must not overstate: the warning is **SOFT**, it is about the
**selected term**, and it counts only **zoned** classes. If the copy needs the numbers, they come from
the violation's own `meta` (the server message already carries `percent`, the zoned denominator and
`unzonedCount`) — do not invent or recompute them.

## 2. Boundaries — do not break

- **Writable:** `atlas-client/src/lib/violation-presentation.ts`,
  `atlas-client/src/components/BuildingPanel.tsx` (label + help copy only),
  `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`,
  `atlas-client/src/components/timetable/simplePublishReadiness.ts`, and the client tests that assert
  this copy.
- **No server change.** Do not touch `atlas-server/**`, `generation.service.ts`, or the warning's
  producer/threshold. This is presentation only.
- **No behaviour change:** no new warning, no severity change, no new computation, no data change.
- Do not touch `docs/**`, `CHANGELOG.md`, or any companion repo.
- `@/ui` primitives only: no native `<select>`, no raw unstyled `<button>`, no `title` attributes, no
  raw `<details>`.

## 3. Tests

- Update only the assertions that pin the changed copy, and add one assertion that the zone
  presentation entry carries a title/meaning/action that names the concept consistently. Keep every
  other assertion; where a test pins the old string, update it **and say so**.
- `npm run test:client-suite` must stay green (845).

## 4. Gates (run and paste literal results)

1. `npm run test:client-suite` — expect 845, exit 0.
2. `npm run build` with `$env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'`.
3. `git diff --check`.

## 5. Return (one page)

Base SHA · candidate SHA · exact changed paths · the before/after copy for each surface · the test
changes and why · gate results · confirmation no server file and no behaviour changed · risks marked
`BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
