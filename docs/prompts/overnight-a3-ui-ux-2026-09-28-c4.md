# Overnight packet c4 — Planner A3 (non-timetable UI/UX) — 2026-09-28 → 07:00 +08

Issued by Lane C. Authority and coordination as in `overnight-a3-ui-ux-2026-09-28-c1.md`, with the c3 change:
**you run no browser**; Lane C runs your live rows. No deploys; A2 ships. Post `A3 integrated for release at <sha>` in
`docs/handoffs/lane-a-to-c.md` after each integration. A2 releases at ~04:30; anything after that ships in the next
release. The operator is asleep: decide, record, keep going. Use Write/Edit for long appends, never heredocs.

## Evidence (Lane C, live `d31bfacb`, 2026-09-28 01:35–02:15)

`docs/reviews/lane-c-overnight-20260928/findings.md` — read all of it. In short: **#53 map tiles still read "0% FILLED"**
for every wing (your `1e417694` fixed Building view only; Building view shows an unlabelled "n/a"); **#52 fails**
(the stale class grid shows for ~2 s on `/timetable/map`); **B5 PASS**; plus a graded demo walkthrough with a ranked
top 10.

## Queue, in order — one stream per surface, one executor each, one fresh QA each

1. **HIGH, truthfulness:**
   - **Walkthrough #7:** opening the teacher workload dialog silently switches Teaching Load into a draft with Save
     enabled. Enter draft only on a real change.
   - **Walkthrough #8:** Sections "HOME ROOMS 20/20" while 5 rows read "Needs home room". One truth.
   - **#53 map tiles:** the campus map tile path (`CampusMapOverview` or its caller) must show real use from the
     published run, or a labelled "Use: not available yet". Never "0%" for occupied rooms.
   - **Building view "n/a":** label it, or show the real value (same source as the tiles).
2. **#52:** a loading state instead of the previous section's grid on the first render of the map route. If the route
   shell is timetable-owned, hand it to A2 in `lane-a-to-c.md` with the exact file.
3. **Top-10 items 1–6, 9, 10** from the findings: one page name ("Dashboard"); no Dashboard page scroll at 1366x768; a
   visible "View room map" on Sections rows; use beside capacity on map cards; plain sentences for the four raw Subjects
   strings; one pattern (a dialog) for "Review load" and "Profile"; a loading state for "Open map"; one word for "not
   enough hours".
4. Whatever c3 left unfinished (see your handoff c3 section).
5. For every change: exact live-acceptance steps in your handoff, so Lane C can run them after A2's next release.
   Handoff c4 section, `live-state.md` Lane A3, worktrees retired (junction-safe), everything pushed.

Final message: ≤ 15 lines — done / blocked / not reached, last integrated SHA, handoff path.
