docs(handoffs): A9 c6 rendered proof, the active-filter correction, and the honest gate table

Adds the planner's second, additive commit to the A9 c6 candidate and records
what the loopback render against REAL staging data actually found.

- Rendered evidence, origin http://127.0.0.1:5231 backed by the staging API on
  127.0.0.1:5101, at 1366x768, staging QA login:
    - 103 rooms / 78 Ready / 0 Needs attention / 25 Unavailable, `aria-pressed`
      exclusive on every filter, and the operator's sentence verbatim:
      "No rooms currently marked as Needs attention."
    - natural order confirmed on real names: G8 Room 101..106, 201..206, 301..306,
      401..406, then G9 Room 101...
    - BuildingView: surface x=297 w=628, canvas x=322 w=578 -> a 25px inset
      (1px border + 24px of `md:px-6`) on BOTH sides, so `contentRect.width`
      really does exclude the padding and the Stage does not overflow; toolbar
      height still 28px, so the three fixed-height callers are unaffected; the
      legend sits 24px inside the surface's right border.
    - CampusMapOverview Room Directory: room name `textOverflow: clip`,
      `overflowWrap: break-word`, no ellipsis character in the rendered text.
- CORRECTION (commit 3b55d47c): the active filter chip was invisible. Measured
  `background rgb(243,244,246)` with a TRANSPARENT border for the active chip
  against `rgb(255,255,255)` with `rgb(229,231,235)` for the inactive ones, i.e.
  the pressed chip looked LESS bordered than its neighbours. `secondary` ->
  `default` (`bg-primary`), plus `cursor-pointer` (the shared `@/ui` Button sets
  no cursor at all) and `opacity-80` on the count (dark slate on filled green).
  The same two changes went into `TeacherAttentionFilters.tsx` because AGENTS.md
  section 8 makes the two filter rows ONE control; both rows measured identical
  before this, so neither was the one doing it best.
- Gates: 14 focused suites green (185 tests). `test:a3-c8-warning-token` 13/14 -
  the pre-existing repo-wide raw amber/yellow FILE-COUNT pin (66 vs measured 67);
  this range changes 0 such lines in production (BuildingView 1->1,
  CampusMapOverview 5->5, RoomReadinessList 2->2, CampusMap and
  TeacherAttentionFilters clean at both revisions), so it is not re-pinned.
- `typecheck` 5 errors, all in files this range does not touch.
- `test:client-suite` 1256/1296, 26 failing files, ALL timetable / teaching-load /
  year-setup and none in this range's blast radius. The base comparison at
  7d008db7 is recorded in the commit message.

Worktree disposition: KEEP_ACTIVE until the train ships.
