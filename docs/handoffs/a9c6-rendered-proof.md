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
- Fresh independent QA over `7d008db7..08620fbd`: `CORRECTION_REQUIRED`, 26/27 rows
  passed, 0 blocked, 0 unperformed. Both judgement questions answered YES: the
  `TeacherAttentionFilters.tsx` change is justified and minimal under §8, and the
  `BuildingView.tsx:834` decline is correct with the packet's line reference exact at
  base. The single BLOCKING finding (B-1) and both documentation findings (NB-1, NB-3)
  are closed in the tip commit; NB-4 (indentation) is closed there too.
- `test:client-suite` **1257 pass / 39 fail of 1296**, across **24** failing files, ALL
  timetable / teaching-load / year-setup and none in this range's blast radius. The
  base `7d008db7` was measured at **1257 / 39** in a separate detached checkout, so
  this range's delta on the full suite is **zero**. (An earlier revision of this file
  recorded `1256/26`: that was the pre-`f39f4718` figure, before the `BuildingView.tsx`
  line-cap fix removed the one failure this range had introduced. QA caught the stale
  number; the corrected figure is the one above, measured at the candidate tip.)

Worktree disposition: KEEP_ACTIVE until the train ships.
