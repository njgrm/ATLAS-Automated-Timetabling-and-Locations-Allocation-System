# A5 c5 — Room Schedules layout note (written BEFORE any JSX)

`AGENTS.md` §8 "Design judgement gate", rule 2. Not a review artifact; the handoff carries the verdict.

**Who / task / feeling.** An older, mouse-first scheduler lands here to answer one of three plain
questions: *what is in Room 101 on Tuesday?* · *where is this teacher at 10:00 Monday?* · *what is
Grade 7 – X's week?* Today the page makes them learn a data model first: a **"Generation run ID"**
number box (`Use a whole number above 0.`), a Latest/Run toggle, a `Tools` popover whose only
contents are those two, a `How to browse schedules` panel, a second term picker used only by a
download, and a stat banner ending `Run #412 · COMPLETED`. It reads as a database console wearing a
school uniform. It must read as a **notebook page**: land, pick a name, read the week.

**Subtract first.** Every deletion below is a deletion, not a rewording.

## What stays

The three view modes — they *are* the three questions. The searchable name picker (with its
building / department / grade grouping). The Mon–Fri grid and the mobile cards. The one term
control, conditional on the year actually having differing terms. Conflict inspection on click. The
unified Word/Excel official-program dialog. CSV export of the current view. The room occupancy
sheet. Refresh.

## What goes

| Deleted | Why |
|---|---|
| `Generation run ID` input + `Use a whole number above 0.` + Latest/Run toggle + the whole `Tools` popover that housed them | A run id is not a thing a scheduler types. The packet forbids an id on screen. |
| `Run #{runId} · {status}` in the stat banner (old line 684) | Same. Replaced by one quiet sentence in words. |
| The `Run / #{id} · {status}` row inside the conflict sheet | It is reachable from this page by one click, so it is on this page. Replaced by `Made on <date>`. |
| `Download schedules` button + its **separate** `Schedule download term` picker | Two term controls is what the packet forbids. Print/download now uses the term actually on screen. |
| `How to browse schedules` help panel | Two of its four steps described controls that no longer exist. The page explains itself. |
| `Export CSV` full-width button from the filter band | Second full-width button below the pickers. Moves to `More`. |
| The `12 rooms available.` sentence under the picker | A helper sentence under a control — banned by §8, and it states nothing a scheduler needs. |
| The `Schedules` eyebrow + the `Showing {term}` chip | The chip restated the term picker: two chips/controls saying the same fact. |
| `Occupancy` toggle + `Refresh` from the filter row | Filter row is for filters. Both move to `More`. |

## What moves behind `More`

Refresh · Export this view as CSV · Download official Word/Excel schedules · Room occupancy sheet
(rooms only). `More` is the §8 home for "real but rarely wanted".

## What moves behind a Tooltip

Why the week is one term at a time (the ROOM-SCHEDULES-TERM-C01 invariant: merging terms in a
weekly grid is what invented the old 10-conflict reports). This was operator knowledge buried in a
help panel; it is now one hover on the term control, present only when the term control is.

## The quiet source line

One line, plain words, tail of row 2:
`Showing the timetable made on 29 Sept · First Term` — and when an older one is pinned,
`Showing the timetable made on 4 Sept, an older one`. It reads `state.data.source.generatedAt`
(the date of the timetable actually on screen), never a run id. The `Show an older timetable`
disclosure lists **dates** from `GET /generation/:schoolId/:schoolYearId/runs` and carries the run
id in state only.

## Shape

- **Row 1** — `Schedules` · ONE status chip · `Print this schedule` (primary) · `More`.
- **Row 2** — `Show:` · `[Rooms][Teachers][Sections]` · name picker (fill) · `[Term]` *only when the
  active year has ≥ 2 terms* · the quiet source line.
- **Below** — the grid in `flex-1 min-h-0 overflow-auto`, unchanged, so the root never scrolls.

## §8 checks made before writing

Picker is `SearchableSelect` with `triggerClassName={pickerTriggerClass('fill')}` — the A5 c4
shared chrome (`@/ui/picker-trigger`), replacing the page's own `h-10 text-sm w-full rounded-xl
bg-white shadow-sm` override. Term picker likewise. No `<select>`, no raw `<button>`, no `<details>`,
no `title=`. `More` is `@/ui/dropdown-menu`; the term explainer is `@/ui/tooltip`. No sentence
under a button. One status per fact. The page must end SHORTER than 814 lines.

## Click counts from landing

Room 101 → 1 (Rooms is the default mode, then pick). Teacher → 2 (Teachers, then pick). Section → 2.
A `?roomId=` deep link from the Dashboard or the campus map → 0.
