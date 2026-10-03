# forReview — verified packet list for the overnight goal session

**Status: OUTLINE ONLY. No code changed, no packet dispatched, no deployment.**
Written 2026-10-03 by Hermes. Verified against `origin/main` = `e8362627` and the live Tailnet,
not against the triage ledger's stale base (`4c4682b9`).

The 88-row member ledger lives only in `C:\Users\njgro\AppData\Local\Temp\atlas-triage-ledger.md`
— uncommitted, in a pruned directory. **Commit it or lose it.**

Scope note: the companion timetable work is scoped separately in
`docs/plans/timetable-manual-edit-outline.md`. This document covers everything else in
`forReview/` so the night can start on non-timetable work immediately.

---

## 0. Constraints for the night

1. **Another planner is actively merging.** `origin/main` moved four times during the writing of
   this document. Re-check before every commit: `git fetch origin && git log --oneline -1 origin/main`.
2. **Rendered evidence is a command now:**
   ```bash
   node ops/qa/atlas-live-acceptance.mjs --route /campus-rooms --name map-review --mobile
   node ops/qa/atlas-live-acceptance.mjs --all-known
   ```
   It asserts the Tailnet origin, waits 8s before asserting rendered state, records every non-GET
   as a write, and measures DOM geometry.
3. **Replicate before building.** One sweep reported three scrollbar defects that two later sweeps
   could not reproduce, and cost 75 minutes of agent time. Capture twice before believing it.
4. **One batched cutover.** Three production cutovers happened in 90 minutes for chip labels.
5. **The operator is discussing the decision-blocked rows with members tomorrow.** Do not build
   MR-14, MR-15, MR-17 placement, MR-10, MR-13, MR-61 or MR-79. See §4.

---

## 1. Confirmed done — close cheaply, no build (verify on live, then close)

These read as open in the ledger but the source already does the work.

| Row | Ask | Evidence in current source |
|---|---|---|
| **MR-08** | "-> Teacher Preference" (singular) | Ships as **"Teacher Preferences"** (plural) — `components/app-shell/navigation.ts:53`; a guard test rejects the singular (`a3-c8-room-preferences-reachability.test.tsx:386-422`). **Locked plural wins.** Close. |
| **MR-09** | "do not put review load in teacher menu" | `Review load` exists only on Teaching Load rows; Teachers rows carry `Assign teaching load` — `faculty/FacultyRowActions.tsx:60,73` |
| **MR-31 / MR-44** | program badges should follow their colour scheme | `PROGRAM_SCOPE_BADGE` in `lib/subject-constants.ts:44-51` already carries per-scope colours (REGULAR sky, STE emerald, SPA purple, SPS orange, OTHER gray). **Another planner owns the program-label revert — do not touch these files.** |
| **MR-18** | "change color of HEALTH BREAK" | Shipped as `ca761217` — dark pink band, `aria-label`, contrast-safe text. Verify on live, don't rebuild. |
| **MR-19 / MR-20** | "Light gray is assumed to be unable to click" (tabs) | Shipped as `419c270b` — tab affordance fix. Verify on live. |

---

## 2. Confirmed OPEN, buildable tonight — real defects, no operator decision needed

### F1 — Teaching Load sticky filter escapes its container (MR-30) — **root cause found**

The member wrote: *"the container is floating up until the top when scrolled up in its outside
container."* Not reproducible by reading; **found in source**:

```
faculty-assignments/TeacherGridMode.tsx:598
  <div className="sticky top-[calc(0px-1.5rem)] z-20 ... bg-background/95 backdrop-blur-sm ...">
```

A sticky element with a **negative top offset** (`0px - 1.5rem`). That is the floating-up defect
verbatim: as the outer container scrolls, the sticky header sticks 1.5rem *above* its container's
top edge and appears to float away. Fix is the `top` value — one line, one file.

Also check `TeachingLoadFilterBar.tsx:80` and `TeacherGridMode.tsx:122,320`, which carry comments
about a "bottom sticky footer" that may be a related leftover.

- **Owns:** `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
- **Test:** assert the sticky header's `top` is not negative; assert it stays within its container
  when the container scrolls. Wire into a committed `package.json` script.
- **Evidence:** rendered before/after at 1366x768 **and** 390x844, plus a scrolled-state capture.

### F2 — Floor tooltip clips off-screen on bottom floors (MR-26) — **root cause found**

*"the information appeared as I hover the F1. It is going down which cuts off the other parts of the
information."* The shared `@/ui` tooltip primitive already portals to `document.body` with collision
bounds (`ui/tooltip.tsx:95-105`), **so the general tooltip fix cannot reach this one**. The floor
hover is Konva-drawn:

```
components/BuildingView.tsx:395-396
  const [hoveredRoomId, setHoveredRoomId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x, y, roomId } | null>(null);
```

A canvas-drawn tooltip with its own positioning, which will not flip upward near the viewport bottom.
Fix: flip the tooltip above the cursor when `tooltipPos.y + height > viewportHeight`.

- **Owns:** `atlas-client/src/components/BuildingView.tsx`
- **Caution:** Konva measurement work. §8's 1000-line file limit — check the file size first.
- **Evidence:** hover F1 (a bottom floor) on live, before/after, both viewports.

### F3 — Campus map editor canvas clips when zoom-dragged (MR-22 / MR-24)

*"the canvas should automatically expand if box exceeds to it. Especially that if you zoom in and
drag it."* `campusEditorCanvas.ts` handles +x/+y dynamic bounds; the **negative-coordinate half is
the open one**.

**Blocked on one question:** does auto-expand persist offsets server-side, or stay client-side?
If persisted, this is HIGH (coordinate model + migration). Check `map.router.ts` before sizing it.

- **Owns:** `campus-map/campusEditorCanvas.ts`, `CampusMapCanvasPreview.tsx`, `CampusMapEditorZoomControls.tsx`
- **Do not touch:** `campus-map/CampusMapOverview.tsx`

### F4 — Room hover contrast regression (MR-28)

*"look at what's happening when you hover a room in the side navigation that has a section using it.
It changes the color text and the background which makes it not readable."* Reproduce on live —
`/campus-rooms` currently renders clean on structural checks (ZERO-WRITE, no scrollbar, no page
error), so this is specifically the hover state. Check contrast tokens against WCAG AA.

- **Owns:** `components/campus-map/CampusMapOverview.tsx` or the side-nav component once identified

### F5 — Teaching Load filter container width (MR-29)

*"look at the filter button, adjust the container based on the length of the text. And remove the
show all sections. Display it already"* The `More filters` disclosure was already deleted
(`TeachingLoadFilterBar.tsx:5-16,250`); what remains is per-label auto-width. Small, subtractive.

- **Owns:** `components/faculty-assignments/TeachingLoadFilterBar.tsx`

---

## 3. Blocked — do not build, operator is deciding tomorrow

Per the operator's instruction these wait. Recommendations are in
`docs/plans/timetable-manual-edit-outline.md` §2 and the conversation record; recorded here so a
`goal` session does not stall on them.

| Row | Ask | Why blocked |
|---|---|---|
| MR-14 | occupied / conflict / available colours | Needs the semantic decision; do not accept member hex values (§8 forbids a second palette) |
| MR-15 | "automatic BLOCKED" instead of warnings | Direct contradiction with locked decision 1 |
| MR-17 | where EDIT sits | Placement in the 2-row header budget is an operator decision |
| MR-10 / MR-13 | Substitute; with-load/non-load | "Substitute" has no backing data in EnrollPro; per §4 this is a companion handoff, not an ATLAS build |
| MR-61 | sort-header tooltips | Fix-2 doc states keep *and* remove as alternatives |
| MR-79 | remove the browser room map? | It is a member *question*, not a request |
| MR-01–MR-06 | the role model | HIGH; needs the capability matrix signed first |
| MR-21 | "that menu is where the interface is now" | Appears to be a report about a different product; confirm with the member |

---

## 4. Suggested packet order

Independent VISUAL/LOW first, then MEDIUM. No two packets own the same file.

- **P1 — F1 sticky-header defect.** Root cause known, one file, one line. Cheapest real fix here.
- **P2 — F5 filter container width.** Small and disjoint from P1's file.
- **P3 — F2 floor tooltip flip.** Konva work; medium effort, clear root cause.
- **P4 — F3 canvas auto-grow.** Only after the persistence question is answered. Highest risk.
- **P5 — F4 room hover contrast.** Needs live reproduction first.

Each packet: failing-first test → fix → rendered evidence from the acceptance script → one commit
per branch → **one batched train at the end, one cutover.**

---

## 5. Pre-flight

```bash
git fetch origin --prune && git log --oneline -1 origin/main
cd D:/ATLAS && git worktree add E:/ATLAS-worktrees/lane-forreview -b work/forreview-ui origin/main

cd E:/ATLAS-worktrees/lane-forreview/atlas-client && npm ci
npm exec -- prisma generate --schema ../prisma/schema.prisma
node ops/qa/atlas-live-acceptance.mjs --route /campus-rooms --name map-before --mobile
```

**Hard rules:** never `vite preview`/`npm run dev`/`node dist/server.js` in the foreground; never
run DB-writing tests against live; never echo a credential; one writer per worktree; give every
long gate its own tool call (a chained lint+typecheck exceeded a 420s ceiling and killed a
75-minute agent); report any unverifiable row `BLOCKED` rather than done.