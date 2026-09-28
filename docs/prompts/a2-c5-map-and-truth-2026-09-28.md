# Packet c5-map — A2 — items 2, 3, 4: the stale grid, the map occupancy, and the two unmeasured numbers — 2026-09-28

Lane C c5 items 2–4. **Tier: MEDIUM** (client presentation + one server export). Loop per §11:
executor → one fresh QA → planner integration. Disjoint from `a2-c5-l1-session-lifetime-2026-09-28.md`, which owns
`atlas-server/src/routes/auth.router.ts`, `atlas-server/src/services/local-auth.service.ts` and `ops/runtime/`.

**Ownership boundary (one writer per stream).** This packet owns
`atlas-client/src/components/timetable/**`, `atlas-client/src/components/CampusMap.tsx`,
`atlas-client/src/lib/timetable-plain-language.ts`, the generate-dialog surface, and the server class-program
workbook writer. It touches **no** auth file, no `prisma/`, and no migration.

---

## Item 2 — #52: `/timetable/map` shows the previous section's grid for ~2 s — **FIX**

Lane C measured it at 01:35 (`ss_2662embwr`): entering `/timetable/map` from More renders the GR7 · Luna
Mon–Fri grid before the map. Verified in source at base `bd789d86`:

- `atlas-client/src/components/timetable/CenterWorkspace.tsx:585` switches to the map pane on
  `centerView === 'map'`.
- `atlas-client/src/components/timetable/TimetableRouteViewSync.tsx:222-269` is the effect that moves `centerView`
  from `'schedule'` to `'map'` when the pathname becomes `/timetable/map`. **It runs after the first paint**, so
  the first paint is the schedule grid. That is the whole defect: the route entry is asynchronous with respect to
  paint, and nothing in between says "loading".
- The `Suspense` at `CenterWorkspace.tsx:607` wraps only the lazy `CampusMap` chunk. It does **not** cover the view
  transition, so a fast chunk load does not mask the stale grid.
- `atlas-client/src/components/timetable/timetable-route-loading-intent.ts:7` already declares the correct intent
  (`/timetable/map` → "Checking rooms and schedule information."), but the helper's own comment scopes it to
  "while run data is unresolved" — which is a different condition from "the view has not switched yet".

**The fix:** from the first render whose route resolves to `'map'` but whose `centerView` is not yet `'map'`, render
the map loading intent instead of the previous view's grid. The intent text already exists and is already the
operator-approved copy; reuse it through the single existing export rather than adding a fourth variant. A stale
grid is worse than a blank panel for an older, mouse-first user: it looks like data.

Acceptance:
- **M2-A** entering `/timetable/map` (in-app *and* by direct URL) never paints a schedule grid after the intent
  applies — no previous-section cells are in the DOM during the transition.
- **M2-B** the intent shown is `resolveTimetableLoadingIntent('/timetable/map')`, asserted by value.
- **M2-C** **failing-first:** at base `bd789d86` M2-A fails, because `centerView` is `'schedule'` on first paint
  while the pathname is already `/timetable/map`.
- **M2-D** the other six route intents (`pre-generation`, `policies`, `manual-edit`, `building`, `runs`, `setup`)
  are unchanged; an existing route-intent suite stays green.

## Item 3 — #53 remainder: a real `buildingOccupancy` — **DECIDED, honest branch**

c5 item 3 offers two acceptable outcomes: a real occupancy "from the published run, **or** A3's labelled
not-available state." Verified at base:

- `atlas-client/src/components/CampusMap.tsx:24` declares `buildingOccupancy?: Map<number, number>` and
  `CampusMap.tsx:117-118` reads it, guarding with `isBuildingOccupancyKnown`.
- `CenterWorkspace.tsx:608` renders `<CampusMap buildings={buildings} activeBuildingId={mapBuildingId} onSelect={…} />`
  with **no `buildingOccupancy`**, so every wing renders `BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL`.
- A3's `a3-c4-map-truth.test.ts` pins that: `buildingOccupancyTileLabel(undefined, 1)` and `(null, 1)` both return
  the unknown label, and a **measured** `0` still returns a real `0%`. A3's state is correct and shipped.

**Planner decision, recorded rather than deferred:** the fabricated "0% FILLED" is already gone; the honest label is
live. This packet's job is to determine **with evidence** whether a real per-building occupancy is derivable from
data this surface already loads, and then to take exactly one branch:

- **If a real occupancy is already derivable** from data present in this surface (a loaded run whose entries carry
  `roomId`, or an existing per-building period count), compute and pass it, and prove it. Define occupancy in one
  sentence in the handoff — the denominator must be the building's schedulable periods, not a raw entry count, and
  it must be labelled in the UI so a scheduler can read it.
- **If it is not derivable here**, change **nothing**, and record the successor with the evidence of what is missing
  (which data, which endpoint, which run state). Do **not** fabricate, approximate, or partially derive a number
  whose denominator is undefined.

Rationale, and it is the same rule this lane has already applied twice tonight: an unmeasured number in a status
position is worse than an honest unknown, and this lane's own history is a list of fabricated zeros being removed.
Lane C's 01:35 evidence is that a *measured* use beside capacity is what answers "is this room free?" in place.

## Item 4a — the residual "Locked classes kept" unmeasured 0 — **FIX**

Recorded as residual **R1** in the c2 handoff: `Locked classes kept` can still print `0` via `?? 0` when the board
summary is absent, because only the headline was converted to a tri-state (`null` → "Not checked", measured `0` →
emerald). Label at `atlas-client/src/lib/timetable-plain-language.ts:544`
(`GENERATE_DIALOG_LOCKED_LABEL`); the `?? 0` is in the generate-dialog surface. **Apply the same conversion the
headline already received:** thread `null` through, and render the row in the neutral state — never `0` — when the
summary was not fetched. A secondary grey row may still print a *measured* `0`.

Acceptance: **M4a-A** with the board summary absent the row reads the not-checked state and contains no digit `0`;
**M4a-B** with a measured zero it reads `0`; **M4a-C** failing-first at base.

## Item 4b — the `tt-output-c03r` workbook drops columns in production data — **FIX, and it has a red harness**

`test:server-suite` has **4 failing files, all in `tt-output-c03r`**, independently reproduced at base `bd789d86` and
at every c2 candidate with an identical file set (c2 handoff §5). The defect: the class-program workbook renders
`A1:G29` where `A1:H` is expected — it drops the **`TEACHER`** and **`No. of Learners - MALE:`** columns. This is a
real production-data export defect in the timetable's own export surface, so c5 item 4 assigns it to this lane
("take ownership if it is timetable export" — it is). Writer: the class-program workbook path
(`atlas-server/src/services/class-program-*.ts` and whatever renders the sheet).

**Acceptance:** **M4b-A** all four `tt-output-c03r` files pass; **M4b-B** the emitted sheet's last column is `H` and
its header row contains `TEACHER` and `No. of Learners - MALE:`; **M4b-C** failing-first at base with the exact
`A1:G29` vs `A1:H` shape already recorded. Do **not** delete or skip a failing assertion to reach green (§16) — if a
test is wrong, correct it additively and say why.

**Baseline discipline (§11).** Record, before and after, the `typecheck` error count and its file list. This lane
is on a **known 5-error / 4-file baseline at `main`** (`timetable-truth-labels-a2.test.ts:443` `TS2367` from
`f02c693c`, 3× `TS2307 playwright`, 1× `TS7006`). A candidate that does not change that count is correct; a
candidate that *raises* it is not. Do not fix the pre-existing 5 as part of this packet — but do not hide a sixth.

## Gates for every row above

- No `test()` is removed anywhere; corrections are additive and supersession is marked, never deleted (§16).
- Each new/changed test file is reachable from a committed `package.json` script in the same commit (§11) — a test no
  gate runs is not evidence.
- Any acceptance row needing a browser is a **deployment-acceptance clause** and must be labelled as one, with the
  origin `https://njgrm.buru-degree.ts.net` named. `127.0.0.1:5174` is a different origin and never ATLAS acceptance.
