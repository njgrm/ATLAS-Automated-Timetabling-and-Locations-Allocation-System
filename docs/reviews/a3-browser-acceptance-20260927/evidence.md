# A3 browser acceptance — 2026-09-27, live release `9b28c572`

Origin asserted on **every** row: `https://njgrm.buru-degree.ts.net` (`AGENTS.md` §12). No
loopback row appears in this file; nothing here is an isolated check.

Context: release `9b28c572` was deployed by **Lane A2** at 2026-09-27 20:34 +08 and contains
Lane A3's `c4a9960e` corrections (`merge-base --is-ancestor c4a9960e 9b28c572` exits 0), so the
four rows A3 had been holding as `IMPLEMENTED_PENDING_QA` were finally decidable against a
**deployed** build. Browser custody: lock `E:/ATLAS-worktrees/.browser-lock` taken
`A3 2026-09-27T21:55+08:00` and released on completion; no other agent held it.

Viewports: `1366x768` primary, `390x844` for the mobile menu variant.

## Console and network — attributed, not absorbed

Two console errors on every route, on this release, before and after any of the rows below:

| Resource | Status | Attribution |
|---|---|---|
| `/enrollpro-api/settings/public` | **502** | The recorded host-side `UPSTREAM_UNREACHABLE` observation (live-state "Open items", O1, as of 2026-09-21) — EnrollPro `dev-jegs` unreachable from the host. **Pre-existing, not introduced by `9b28c572`, and not A3's surface.** |
| `/enrollpro-uploads/55a414b8-….png` | **502** | Same upstream. An ATLAS-hosted avatar served through the EnrollPro proxy. |

Neither is a regression and neither is absorbed by this cycle. Every route below rendered its
real content with `Working from saved data`, so the degraded upstream did not mask any row.

---

## Row 14 / 16 — Teaching Load desktop density — **PASS**

Method: navigate to `/teaching-load` at `1366x768`, let the roster settle, then read geometry
from the live DOM. No screenshot inference.

| Measurement | Value | Requirement |
|---|---|---|
| `document.documentElement.scrollHeight` | **768** | — |
| `document.documentElement.clientHeight` | **768** | — |
| Page-level scrollbar | **false** (`scrollHeight === clientHeight`) | §8 no-scroll architecture |
| Roster region height | **328 px** | — |
| Roster region `scrollHeight` | **3295 px** | scrolls internally, not the page |
| Interactive rows total | **50** | — |
| Interactive rows **visible at once** | **6** | **> 1 assignment row** |
| Visible row labels | `ARALING PANLIPUNAN`, `GV`, `JF`, `JR`, `EDUKASYON SA PAGPAPAKATAO`, `JC` | real teacher rows, not placeholders |

Both halves of the row pass at the required viewport: the page never scrolls, and six teacher rows
are on screen at once.

**Measurement caveat, recorded rather than glossed:** the roster rows carry **no `data-testid`** on
the live build, so the row count was taken over visible `button` / `[role="button"]` / `li` / `tr`
elements intersected with the region rect, not over a testid selector. An earlier attempt matched
`[data-testid*="teacher-row"]` inside the roster and returned **0**; that was a selector miss, not an
empty roster, and is recorded so the next session does not re-report it as a defect.

## Row 23 — Teacher profile is a dialog and dismisses on an outside pointer-down — **PASS**

Both halves, not just the conversion.

1. **Conversion.** Clicking `teacher-row-profile-action` opens
   `[data-testid="faculty-profile-dialog"]` with `role="dialog"`,
   `aria-labelledby="radix-_r_6b_"`, `aria-describedby`, `data-state="open"`, classes
   `fixed left-[50%] top-[50%] z-50 … max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto`
   — the fix-17 responsive-dialog pattern, not the old side drawer. Geometry at `1366x768`:
   x 347, y 38, **672 x 691**. Accessible name resolves to the teacher's full name
   (`FERNANDEZ, JANELLA MARIE`).
2. **Dismissal.** A **real** mouse event at `(100, 400)` — outside the dialog rect
   (x 347..1019) — closed it: `[data-testid="faculty-profile-dialog"]` count **1 → 0**, and
   `document.querySelector('[role="dialog"]')` is `null` afterwards. No dialog is left mounted and
   focus is not trapped on a dead node.

Note: the click had to be dispatched as a coordinate mouse event, not a Playwright element click.
An element click on the overlay is *correctly* refused — the dialog intercepts pointer events at
the overlay's centre. That refusal is the harness working, not a failure, and is recorded so the
next session does not read the timeout as a defect.

## Row 24 — Teachers menu labels on one line — **PASS**

Longest faculty name in the roster: **`FERNANDEZ, JANELLA MARIE`** (41 characters), found by
scanning all 50 `teacher-row-profile-action` `aria-label`s rather than assuming a row.

Measured by `Range.getClientRects()` over the **text nodes** of each menu item, counting distinct
line boxes. Element-box height is *not* a valid discriminator here and produced a false positive
first: a 40 px button with a 19 px line height is one line plus padding, not a wrap.

| Viewport | Labels measured | Line boxes each | `white-space` | Clipped |
|---|---|---|---|---|
| `1366x768` | `Add temporary`, `Refresh roster` | **1** | `nowrap` | **no** |
| `390x844` | `Review`, `Add temporary`, `Refresh roster` | **1** | `nowrap` | **no** |

`anyMultiLine: false` and `anyClipped: false` at both viewports.

**Measurement caveat:** the two viewports could not be measured in one continuous pass — the
Radix popover auto-closes on viewport resize, and the mobile layout has no
`aria-label="Teachers more actions"` trigger to re-open. The two measurements are therefore from
**two separate passes**, each with its own re-open, and each is labelled with the viewport it was
actually taken at. The `390x844` figures above were captured in the earlier pass; the
`1366x768` figures in the later one.

---

## Findings that became source work, with the live evidence attached

These are not acceptance rows for already-integrated fixes; they are Lane C findings whose
mechanism I confirmed in source while holding the browser. Evidence is here so the executor starts
from a measurement, not a rumour.

### #53 — an unlabelled percentage is live on the Teaching Load roster (exact, with its meaning derived)

Walked every visible text node containing `%` on `/teaching-load` at `1366x768`. The roster card
subtitle renders as a single `<p>`:

```
class="text-xs font-semibold tabular-nums cursor-help text-emerald-…"   w 85px  h 16px
15.0h · 50%      18.8h · 62.7%      22.5h · 75%
```

Deriving the denominator from the data settles what the number *is*: `15.0/30 = 50%`,
`18.8/30 = 62.7%`, `22.5/30 = 75%`. It is **teaching hours against the 30 h standard**, i.e.
utilisation of load — a real, correctly computed figure.

The defect is presentation, and it is the same class the packet calls the worst outcome:

- The number is **bare**. Nothing beside it says what it is a percentage *of*.
- Its only explanation is a `cursor-help` **Tooltip** — a **hover-only** affordance, invisible to
  the mouse-first, older scheduler the packet grades for, and not a keyboard or touch path. The
  packet's own criterion is "a visual cue beside every status"; a hover tooltip is not that.
- **The same metric is labelled on the dashboard** and bare here. On the dashboard readiness card
  the identical figure is introduced by `% staffed`
  (`text-xs uppercase tracking-wide opacity-75`, 71x16) with the percentage in a bold
  `text-sm tabular-nums` span. So the inconsistency is internal to ATLAS, which makes it a defect
  rather than a house style.
- When `utilization == null` (or the member is a placeholder) the percentage **silently vanishes**
  and only `15.0h` remains — a third state presented as though it were the first.

Source: `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx:347`, with the
branch that computes it at `:275` and the Tooltip at `:349-351`.

### #53 — the room-utilisation `0%` is a fabricated number (source-confirmed, six sites)

`roomUtilization` is a `Map<number, number>` that is populated **only** when `pivotDraftToView`
returns `ok`:

```ts
if (!result.ok) continue;                       // no honest single-term percentage
utilization.set(room.id, Math.min(100, result.view.summary.utilizationPercent));
```

Every render site then reads it as `roomUtilization?.get(room.id) ?? 0`. So **"we cannot compute
this" is rendered as a confident "0%"** — the fail-closed case is displayed as a measured zero.
Six sites, two duplicated components:

| File | Line | What it renders |
|---|---|---|
| `components/BuildingView.tsx` | 405 | `?? 0` into the Konva room card |
| `components/BuildingView.tsx` | 580 | `` text={`${Math.round(utilization)}%`} `` — the Building view figure |
| `components/campus-map/CampusMapOverview.tsx` | 617 / 659 | `?? 0` into the campus map room card |
| `components/campus-map/CampusMapOverview.tsx` | 704 | `Weekly Utilization: 0%` in the focused-room detail |
| `components/campus-map/CampusMapOverview.tsx` | 296 | `(roomUtilization.get(id) ?? 0) > 0` → `selectedHasSchedule`, so the "has a timetable" label is wrong too |
| `components/dashboard/CampusReadinessCard.tsx` | 577 / 619 / 664 | the same three shapes, duplicated |

The `?? 0` is literal in every one of them. `campus-map/CampusMapOverview.tsx` and
`dashboard/CampusReadinessCard.tsx` are near-duplicates, so the fix must land in both or the two
screens will disagree again.

**Not claimed:** I did not get the map to render its canvas on this pass (`/map` loaded with
`canvases: 0` and no utilisation text on screen), so I have **not** observed the live `0%` myself.
The mechanism above is source-confirmed and decisive, and the *number* itself is a fabrication
regardless of which room it lands on; but the browser reproduction is **UNPERFORMED**, and it is
handed to the executor as a reproduce-first row rather than reported as reproduced.

### #52 — Building view first render from More — **NOT REPRODUCED, reproduce-first**

I could not isolate this. What I checked and ruled out, so the next session does not repeat it:

- `roomScheduleIndicators` (`CampusMapOverview.tsx:301`) is memoised on `[scheduleReport, sectionMap]`
  and is **global**, not per-building, so a building switch does not invalidate it and it is not
  the stale source.
- `selectBuilding` (`:349`) resets `focusedRoomId` to `null`, and `focusedRoom` (`:359-361`)
  re-resolves against `selectedBuilding`, returning `null` when the id is not in the new building.
  Both are already correct.

The remaining suspect is a first-render transient somewhere in the `BuildingView` prop path
(`roomOccupancy` / `roomSectionData` are global `roomId`-keyed maps passed straight through at
`:492-493`). I am **not** asserting a line, because I have not proven one. This goes to the
executor as a bounded reproduce-first task whose permitted success is `NOT_REPRODUCED`.

### Inventory rows 249/250 — `Empty floor` vs `Empty`

`BuildingView.tsx:594` renders `text="Empty floor"` in the Konva canvas for a floor with no rooms.
The bare `Empty` in `OccupancyTemplatePreview.tsx:133` is a different component on a different
surface, and `CenterWorkspace.tsx:680` is **A2's timetable** and out of my scope. So the two words
are not currently on one screen in the way the inventory row implies. The consistency decision is
still worth making, and it is bounded to the word A3 owns.
