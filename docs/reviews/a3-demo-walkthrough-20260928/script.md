# A3 c1 — demo walkthrough, non-timetable half (Wednesday 2026-09-30)

**Written 2026-09-28 01:15 +08 by Planner A3, at `origin/main` `025ac7d8`.**

**The operator walks older, mouse-first schedulers through: Dashboard → Sections → Subjects →
Teachers / Teaching Load → Exports / Setup.** One numbered step per action, with the words the
operator says, the click, and what the screen must show.

## Grading status — read this before using the script

**Both live walks were not performed.** The shared browser profile was held by Lane A2 for the whole
window (evidence in `docs/reviews/a3-c1-audit-20260928/route-table.md` §"Read this first"), so:

- **Walk 1 (before the c1 fixes): NOT PERFORMED** — every grade cell below reads `UNWALKED`.
- **Walk 2 (after): NOT PERFORMED** — same reason.

**Every grade cell in this document is `UNWALKED`, and no step has been graded from expectation.**
The steps, the words and the entry conditions below are real and taken from the routes and the
navigation registry; the *grades* are the missing half, and a grade invented without a screen would
be worse than no grade. **This is a script ready to walk, not a walkthrough that happened.**

**The timetable half's entry point is A2's and is handed over as one line**, per the packet: from the
non-timetable Dashboard the click into the timetable is sidebar group **Class Schedule → Class
Schedule** (`/timetable`, `navigation.ts` `timetableNav`). A2 owns every word and every control on
that screen.

**Two facts about the live release that change what the operator will see, both measured:**

- **Live is `c0d91827` (machine-scope `ATLAS_RUNTIME_SOURCE_DIR`), not `025ac7d8`.** Everything A3
  did tonight, and everything from `1e417694`, is **on `main` and undeployed**. The operator walking
  this on Wednesday sees the **old** screens unless a release containing `c5cffa72` and `1e417694`
  ships first. That is A2's call and it is the single highest-leverage thing in this document.
- `1e417694` is what decides step 7's appearance. Until it is deployed the map will show the
  pre-fix behaviour.

---

## Walk 1 — the screen as the operator will actually meet it (before fixes)

`UNWALKED`. Base for grading: live `c0d91827`, origin `https://njgrm.buru-degree.ts.net`, viewport
**1366x768**, `window.location.origin` asserted on every step, A3's profile session.

## Walk 2 — after the c1 fixes

`UNWALKED`. Base for grading: the first release containing `c5cffa72`. **Not deployable by A3** — A2
owns every release.

---

## The script

Each step: **say** (the operator's words) · **click** (one control, named as it reads on screen) ·
**must show** (what proves the step worked). Entry conditions are stated once at the top.

**Global entry conditions for both walks:** Tailnet origin `https://njgrm.buru-degree.ts.net`, assert
`window.location.origin` on every step; desktop viewport 1366x768; mouse only, no keyboard
shortcuts; a seeded session or the walk is `NEEDS_SESSION(<agent>/<profile>)` and stops.

### 1. Dashboard — "where do I stand?"

| # | Say | Click | Must show |
|---|---|---|---|
| 1.1 | "Let's start at the top." | sidebar **Dashboard** | the active school year and active term are visible without scrolling; no page-level scrollbar at 1366x768 |
| 1.2 | "Is everything ready for this year?" | nothing — read | one honest readiness statement. **Check:** no bare `0%` and no bare "ready"; unavailable must read as unavailable |
| 1.3 | "Which rooms can I use?" | nothing — read | the Campus Readiness card lists real rooms, or says plainly that nothing is measurable. **This is `#53`; it reads "unavailable" until `1e417694` ships** |
| 1.4 | — | — | **KNOWN INCONSISTENCY to watch:** the page hero says `Scheduling Dashboard` while the sidebar and the breadcrumb say `Dashboard`. Record whether an older user notices |

### 2. Sections — "give my sections rooms"

| # | Say | Click | Must show |
|---|---|---|---|
| 2.1 | "Which sections still need a room?" | sidebar **Sections** | the section list, and the page title visible (after `c5cffa72` it comes from the shared `AdminWorkspaceFrame` strip) |
| 2.2 | "Let me see the rooms." | the room-map control on a section | the room map opens; **0 canvases render until *Open map* is clicked** — click *Open map*, then the canvas appears at 616x500 |
| 2.3 | "Is this room free?" | a room on the map | occupancy, capacity and utilisation each readable, none truncated. **After `c5cffa72`'s ancestor fix, "Admin and Learning Commons" must render in full — it rendered as `Learning.` on `9b28c572`** |
| 2.4 | "Can I move this section to a room someone else has?" | the occupied room | the swap confirmation names **both** sections and what changes, in words |
| 2.5 | **"Actually, never mind."** | **Cancel** | **B5 — the load-bearing row.** The dialog closes and **nothing changes**. Record the before and after: the section ids, home-room ids, and `audit_logs` max id. **This has never been performed in two overnight cycles** |

### 3. Subjects — "what are we teaching"

| # | Say | Click | Must show |
|---|---|---|---|
| 3.1 | "Let me see our subjects." | sidebar **Subjects** | the subject list; three filters directly visible with no expansion |
| 3.2 | "What does this one need?" | a subject row | the detail opens as a dialog on desktop, not a drawer hanging off the side; scrolling stays inside the dialog |
| 3.3 | "Is anything wrong with it?" | the same subject | any problem stated calmly and actionably, not as a red technical wall |

### 4. Teachers / Teaching Load — "who is carrying what"

| # | Say | Click | Must show |
|---|---|---|---|
| 4.1 | "Who is teaching what?" | sidebar **Teachers** | **no page scrollbar** and **more than one roster row visible** at 1366x768 (accepted row 16 — re-check it, `1e417694` widens a cell by ~40px) |
| 4.2 | "What is that teacher's load?" | a teacher row | the workload detail opens in a dialog; grade chips follow DepEd colour (**G7 green, G8 yellow, G9 red, G10 blue**) |
| 4.3 | "Let me look at the whole year." | sidebar **Teaching Load** | **no page scrollbar** and more than one roster row (accepted row 14 — same re-check) |
| 4.4 | "What is this percentage of?" | nothing — read | the readout says what it is: `15.0h · 50% OF STANDARD`. A teacher with no standard set reads `no standard set`, never a bare `15.0h` |
| 4.5 | "Let me look at the teachers one by one." | **Review teachers** | a real `role="dialog"` opens. **The Next Step banner's copy of this label was dead on `9b28c572` — it focused and opened nothing. It was fixed in `c4a9960e`; confirm it still works** |
| 4.6 | "Escape out of that." | `Escape` | the roster returns with an **identical** filter set, scroll position, selection and draft state |

### 5. Campus & Rooms — "which room do I actually use"

| # | Say | Click | Must show |
|---|---|---|---|
| 5.1 | "Let me see the campus." | sidebar **Campus & Rooms** | **0 canvases until *Open map* is clicked.** Click it |
| 5.2 | "Is this room measured?" | a building, then its rooms | **A2's tri-state:** a teaching room shows `Not available` or a real `NN%`. **A room that was never computed must never read `0%`, and the unknown case must show no bar fill at all.** A genuine 0% must still read `0%` — if everything says `Not available`, the fix over-corrected |
| 5.3 | "Switch to the other building." | the building switcher | **#52 — the first frame must match the building in the sidebar.** *Finding for the operator to make:* find the `More`/switcher entry and record it. Two suspects are already ruled out: `roomScheduleIndicators` is memoised **globally, not per-building**, and `selectBuilding`/`focusedRoom` already reset correctly. The class grid is painted to canvas, so this needs per-frame pixel sampling cross-referenced against the sidebar's building identity. **`UNPERFORMED` twice — not fixed, not disproven** |
| 5.4 | "Same answer on both screens?" | compare with step 1.3 | the map and the Dashboard card **agree**. They were near-duplicate components reading the same `?? 0`, so they could disagree; `1e417694` gives both one tri-state |

### 6. Exports / Setup — the timetable half, handed to A2

| # | Say | Click | Must show |
|---|---|---|---|
| 6.1 | "Now the schedule side." | sidebar **Class Schedule → Class Schedule** | **A2's surface from here.** `/timetable/setup` and `/timetable/exports` are also A2's. A3 neither graded nor changed them — see the scope conflict in the route table |

---

## What the next holder inherits, ranked

1. **Walk this script twice** on 1366x768 with the origin asserted, and fill in every `UNWALKED`
   cell. Nothing else on this list matters as much.
2. **B5, step 2.5.** Never performed, two cycles running. Needs the before/after ids and
   `audit_logs` max id. A3-owned surface (`/sections` → `components/sections/`), so no cross-lane
   coordination is needed.
3. **#52, step 5.3.** Unperformed twice, with the precondition and two ruled-out suspects already
   recorded above so it is not re-investigated from scratch.
4. **Re-check accepted rows 14 and 16** on steps 4.1 and 4.3 after the next deploy.
5. **Decide whether a release containing `c5cffa72` + `1e417694` ships before Wednesday.** If it
   does not, the operator demonstrates the old screens and the demo loses the map fix and the six
   new page titles.

## Grading rule I am handing over with the script

Grade every step **pass / stumble / fail** for an older mouse-first user, and record a stumble as a
concrete observable — *"looked for the title for 4 seconds"*, *"clicked *Edit* and nothing
happened"*, *"could not tell which of two buttons was primary"* — never as a feeling. A step that
passes for me and would stump a 60-year-old scheduler is a **stumble**, and the rubric's own words
are the test: fewest words that still tell the truth, one verb per action, a visual cue beside every
status, less is more, mouse-first, no hover-only information, and no page-level scroll where the task
fits.
