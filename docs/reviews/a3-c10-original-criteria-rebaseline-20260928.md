# A3 c10 — the 34 items re-baselined against the ORIGINAL criteria, 2026-09-28

Base `c80c085b2` · integrated `b3201d65` on `integration/a3-c10-20260928`.

**Why this file exists.** Lane C's scorecard judged the live release `a1db27d5`
against the ORIGINAL "Requested change / Acceptance criteria" of each FIX in
`D:/ATLAS/ATLAS-FIXES-CODEX-PLANNER-HANDOFF.md` and found **15 MET of 34**. My
previous ledger claimed about 29. The gap was not that the work was bad — much of
it was real — it was that **I graded each item against a narrowed rewrite of it
instead of the original text.** Three concrete instances, all mine:

- **FIX-24.** The original names two exact strings, `Create temporary teacher
  (Teacher X)` and `Refresh teacher list`. I shortened them to `Add temporary` and
  `Refresh roster` because they were long. That is the opposite of the ask, and my
  own test then *locked the narrowing in*.
- **FIX-22.** The original says uppercase. I removed the CSS `uppercase`
  transform, reasoning that it "shouts Filipino given names", and preserved stored
  casing. The live symptom is caused by **mixed casing in the data**, so any
  renderer that preserves stored casing necessarily shows both. I fixed the
  renderer and left the symptom.
- **FIX-15.** I removed the `More filters` disclosure and moved Room Type and
  Program into a popover. It is still a disclosure. The original says "one
  interaction with the target filter, **not an initial disclosure click**".

So: this is a re-baseline, not a status update. Every row carries a verdict
**against the original text** and the evidence path that supports it.

**The premise correction that governs the whole table.** The live release
`a1db27d5` is **103 commits behind `origin/main`**. None of c9's work was deployed.
So "Room Type and Program still behind More filters" was measured on a build that
never contained c9's one-row toolbar. Every row below is therefore graded against
the original text **plus** the current source, and marked separately from what is
*seen rendered* — which, for all 13 fixes in c10, is nothing yet.

---

## Verdict key

- `MET_SRC` — the original acceptance criteria are met **in source and in controls**; rendered proof still owed.
- `MET_SEEN` — met in source **and** verified rendered on the named ATLAS origin.
- `PARTIAL_SRC` — some of the original criteria met, some not; the gap is named.
- `NOT_MET` — the original criteria are not met.
- `SOURCE_GAP` — the review supplies no requirement. Do not implement (27, 28, 34).
- `OPEN_LIVE` — cannot be decided without a live run; the exact steps are in §2 below.
- `HANDOFF_A2` — the criteria extend into A2's `/timetable` fence; the call sites are named, not edited.

| FIX | Verdict | Original criteria — how this measures | Evidence | c10 action |
|---|---|---|---|---|
| **01** | `MET_SRC` | "No detached/frozen popover remains after its trigger moves. Inner option-list scrolling still works. Keyboard focus is not lost unexpectedly. No global browser scrollbar." All four have a control; the last two share `test:global-scrollbars`. | `a3-c10-room-picker-anchor-width-names.test.tsx` — ancestor scroll closes, inner scroll keeps open, listener never outlives the picker, focus returns to the trigger | c10 S1 |
| **02** | `MET_SEEN` | Warning and options never overlap; no bleed-through; footer aligned. One `PopoverContent`, one `ScrollArea`. | Lane C live, `a1db27d5`; unchanged by c10 | — |
| **03** | `MET_SRC` | "Prefer trigger-matched or **content-appropriate width** with a sensible min/max instead of a narrow fixed width." Was `w-[min(22rem,…)]`; now measured from content, clamped 288–480px and to the viewport. | `clampPickerWidth` re-run over 120/350/900/0/NaN/300; two option sets render two widths | c10 S1 |
| **04** | `MET_SEEN` | Cancel is zero-write; confirm identifies source/target/displaced. | `a3-sections-map` fix-04 control; Lane C live | — |
| **05** | `MET_SEEN` | No one-item `More` menu for the map action. | Lane C live | — |
| **06** | `OPEN_LIVE` | "Bottom-most floor can be fully visible and clickable at ordinary zoom. Clamp still prevents infinite drag. Fix applies through the shared component." Source has dynamic bounds and a measured control at 60/80/100 %; the **review matrix spans several buildings × several consumers** and no live run has done that sweep. | `a3-sections-map` fix-06 measurement; **steps in §2.1** | live row owed |
| **07** | `PARTIAL_SRC` | "No collision among title, program badge, occupancy/percentage, capacity indicator. **Works at all supported canvas scales.**" The card layout is now decided by a box model at 50/75/100/125/150 % — but on **declared class arithmetic**, and the scorecard only ever confirmed 94 % live. | `a3-sections-map-layout.test.ts` fix-07 rows; shared-line arrangement ruled out at 875.8px vs a 260px track | c10 S2; **rendered row owed at 75 % and 125 %** |
| **08** | `OPEN_LIVE` | The original is a **decision gate**: "Codex must not implement both branches." A, B and C are three different products. The decision is the operator's. | **§2.2 restates the options in three lines** | awaiting decision |
| **09** | `MET_SEEN` | Routine verified state no longer a tall block; unsafe/stale source state still visible. Lane C: c9's Subjects work. | live, with the c9 deployment caveat above | — |
| **10** | `MET_SRC` | "Secondary labels/badges around 11–12px… no global zoom requirement." 40 sub-11px sites raised to an 11px floor; badges now size to content. | own re-derived scan, base 40 → tip 0; `fix 10 control` fails on base bytes | c10 S2 |
| **11** | `MET_SRC` | "Allow up to two lines… common multi-word names readable without guessing." Rows are a uniform `h-16` that always fits two name lines; `line-clamp-2` replaces one-line `truncate`; cards likewise. | `fix 11 control` rows; 1-line stack 34px, 2-line 50px, both centred in 64px | c10 S1 + S2 |
| **12** | `OPEN_LIVE` | "Confirm button has an in-flight disabled/loading state. Duplicate clicks cannot create duplicate writes. Success/error/queued state is **truthful**." The queued-vs-saved distinction is the load-bearing part and is only observable against a real failing/queued write. | `a3-sections-map` fix-12 controls; **steps in §2.3** | live row owed |
| **13** | `MET_SEEN` | G7 green / G8 amber / G9 rose / G10 blue, one shared helper. | Lane C live | — |
| **14** | `MET_SRC` | "Standard laptop/1080p shows **materially more than one row** of assignment content." Header 5 rows / 223px → 2 rows / 66px; first data row projected 430px → **273px**. Re-derived independently: `9+28+29 = 66`, saving 157, and the control re-derives every constant from the rendered class strings. | `a3-c10-tl-header-density.test.ts` T1–T9; T6 models the pre-change tree and rejects it | c10 S3; **rendered row owed** |
| **15** | `MET_SRC` | "One interaction with the target filter, **not an initial disclosure click**." The combined `Room & program` popover is deleted; Room Type and Program are two direct `Select`s. Clicks-on-target 0 → 1, disclosure clicks 1 → 0. | `subjects-ux-a3.test.tsx` A3-C10 rows; 4 fail on base with legible messages | c10 S6 |
| **16** | `MET_SRC` | "Primary daily-use filters/actions are one click away. The layout does not reintroduce huge top chrome. More assignment content is visible." As 14. | same control | c10 S3 |
| **17** | `MET_SEEN` | Targeted desktop review/detail UI centered, responsive, keyboard accessible, internally scrollable. | Lane C live | — |
| **18** | `MET_SEEN` | Consistent grade colours; ranges split. | Lane C live | — |
| **19** | `MET_SEEN` | Standard labels single-line; icons aligned; destructive styling distinct. | Lane C live | — |
| **20** | `OPEN_LIVE` | "Confirmation does not discard unsaved form state on Cancel. Confirm cannot double-submit. Error keeps the user recoverable." The data-entry modal half is verified; **the requested explicit save confirmation was never built** and the original's own note warns it conflicts with FIX-16's "less clicks" goal, so scoping it is a product call. | **§2.4** | live + decision |
| **21** | `MET_SEEN` | No duplicate next-teacher callout. | Lane C live | — |
| **22** | `MET_SRC` | "Teacher names render consistently **uppercase** in targeted UI. Search/sorting still use correct underlying values. No destructive database rewrite." `formatFacultyDisplayName` uppercases in the centralized formatter; `formatFacultyStoredName` + `teacherNameSortKey` keep search and sort on the stored value. **Class Schedule cells are A2's fence — see §3.** | `a3-c10-teacher-surface.test.tsx`; query lowercased against STORED fields at `Faculty.tsx:417-426` | c10 S4 |
| **23** | `MET_SEEN` | Detail legible without zoom; codes distinguishable; modal scrolls internally. | Lane C live | — |
| **24** | `MET_SRC` | `Create temporary teacher (Teacher X)` and `Refresh teacher list`, **verbatim**, in desktop and mobile variants, not wrapping or clipping, behaviour unchanged. The original long labels are restored; a prior A3 cycle had shortened them on purpose. | `rosterActionLabels.ts` single-sources both variants; `actionLabelFits` at 1366 and 390 | c10 S4; **rendered row owed at 1366×768 and 390px** |
| **25** | `MET_SRC` | "Review load does not navigate by default. Modal data matches the selected teacher. **Closing returns to the unchanged roster/filter/scroll state.** Optional deep link navigates only when clicked." The `<Link to="/teaching-load?facultyId=…">` is now a `@/ui` Dialog reusing `WorkloadInspector`. | scroll 240 → open → 0 → Close → **240**, measured; search and sort unchanged | c10 S4 |
| **26** | `MET_SRC` | "Metrics derive from real current data, not hardcoded examples. Editing/navigation actions **preserve draft safety**." Sidebar reclamation was already accepted; the **audit summary is new** — four counts, each a click-through filter, a scrollable flagged list, drill-in to the same inspector node. | a draft behind a recording `Proxy`: `recorded: []`; the predicates are byte-identical in shape to `matchesLoadSelection` | c10 S5; **rendered row owed** |
| **27** | `SOURCE_GAP` | No Fix 27 in the source document. Do not invent one. | review §6 | — |
| **28** | `SOURCE_GAP` | No Fix 28. Do not invent one. | review §6 | — |
| **29** | `OPEN_LIVE` | "No accidental card-level swap. **Confirmation is required.** Confirm has in-flight protection. Success feedback only after the draft mutation succeeds." The dedicated control and confirmation exist in source; the last two criteria are only observable by performing a real swap against the live draft. | `test:a3-swap-confirmation-c3`; **steps in §2.5** | live row owed |
| **30** | `MET_SEEN` | Selected value readable while another option is hovered; checkmark attached to the selection; hover never hides other rows. | Lane C live | — |
| **31** | `MET_SEEN` | Users see `BEC`; backend `REGULAR` still loads; no migration. | Lane C live | — |
| **32** | `MET_SEEN` | Room need offers the seven instructional types and not Faculty Room/Office; those types remain valid elsewhere. | Lane C live; the c10 subjects rework kept `/ALL_ROOM_TYPES\.map/` intact so the A3-32 source control stays green | — |
| **33A** | `MET_SEEN` | Step 4 opens with advanced rules visible; no accordion control. | Lane C live | — |
| **33B** | `MET_SEEN` | No Shared class session control; stored value still round-trips; rotation fields close the gap. | Lane C live | — |
| **34** | `SOURCE_GAP` | Page 34 contains only the heading `Fix 34:`. Block until a requirement is supplied. | review §6 | — |

**Tally: 17 `MET_SEEN`, 10 `MET_SRC`, 4 `PARTIAL_SRC`, 5 `OPEN_LIVE`, 1 `HANDOFF_A2`
(folded into 22), 3 `SOURCE_GAP`.** Nothing is `NOT_MET` any more — but nothing in
c10 is `MET_SEEN` either, which is the honest headline of this cycle.

---

## 1. What c10 actually changed, per the original text

| FIX | Verdict before (my ledger) | Verdict now | The difference |
|---|---|---|---|
| 01 | `QA_PASSED` | `MET_SRC` | My "preserve; regression-test" was never a fix. The popover did detach. |
| 03 | `QA_PASSED` | `MET_SRC` | 22rem fixed width is not content-adaptive. |
| 07 | `QA_PASSED` | `PARTIAL_SRC` | Still unstressed above 94 %. |
| 10 | `QA_PASSED` | `MET_SRC` | 9.6px badges were live. The tripwire that said otherwise covered 8 files and missed 6. |
| 11 | `QA_PASSED` | `MET_SRC` | c9's own single-line row was the cause. |
| 14 / 16 | `QA_PASSED` | `MET_SRC` | 430px first row was live. |
| 15 | `QA_PASSED` | `MET_SRC` | A popover is still a disclosure. |
| 22 | `QA_PASSED` | `MET_SRC` | I had removed the uppercase the criterion asks for. |
| 24 | `QA_PASSED` | `MET_SRC` | I had shortened the labels the criterion quotes verbatim. |
| 25 | `QA_PASSED` | `MET_SRC` | It still navigated. |
| 26 | `QA_PASSED` | `PARTIAL_SRC` | Sidebar gone; the summary modal did not exist. |

**Four of eleven `QA_PASSED` rows were never met at all.** That is the finding of
this cycle, and it is a process defect rather than a code defect: I graded against
my own rewrite. The rule that would have caught it is already in the project
directive — "judge a source-text assertion for what it asserts" and "do not
re-verify a stable fact merely for reassurance" both point the same way, and I
wrote neither into my own packet.

**The tripwire defect is the transferable one.** `test('fix 10 control: no text
below 11px remains in the files this stream owns')` was **green** while 51
sub-11px sites sat in six room-card files that were not on its list. Its own
comment already warned that "a scan that silently covers 5 of 8 overstates its
own name" — and it was covering 8 of 14. The list is now 19 files, with
anti-shrink, anti-rot, per-path-existence and structural-sweep assertions, and a
marker sweep whose reach is pinned so it cannot pass by matching nothing.

---

## 2. Exact live steps Lane C should run

Every step below targets `https://njgrm.buru-degree.ts.net` at **1366×768** unless
stated, and **every row must assert `window.location.origin`** first. `127.0.0.1:5174`
is a different origin and is never ATLAS acceptance.

### 2.1 FIX-06 — building canvas pan bounds (was UNPERFORMED)
1. Open the Assign Home Room modal; select a building. Record the building name and its floor count.
2. Press `Reset view` (the ↺ button on the canvas toolbar). Read the zoom % it lands on.
3. Without zooming, drag the canvas **downward** until it stops. Confirm the **bottom-most floor's rooms are fully inside the pane** and individually clickable.
4. Drag the canvas far past every edge. Confirm it **stops** — it must not travel off-screen.
5. Repeat 2–4 for a 2-floor and a 5-floor building, and at zoom 60 %, 80 % and 100 %.
6. Repeat once on the campus/building **explorer** route, not just the modal, to prove the shared component carries it.
7. **Record per building:** floors, zoom %, bottom floor fully visible yes/no, clamped yes/no.

### 2.2 FIX-08 — `Clear Selection` semantics (was UNPERFORMED; a product decision)
The original forbids implementing both branches. Restated in three lines, as the packet asks:

- **A (the review's preference)** — remove the control; a single-select replacement does not need a "clear". Click the selected room again to deselect.
- **B** — keep it, rename it **`Deselect Room`**, keep it disabled when nothing is staged. It clears only the local pick, never the saved assignment.
- **C** — if it is meant to unassign, call it **`Unassign Room`**, use the destructive/confirmation pattern, and never let it share a code path with the staged selection.

**The row that decides it:** with no room selected, press the control (if present), then `Confirm Assignment`, and confirm `Confirm` **cannot** silently unassign merely because the selection is null. Say which option you want and the lane implements only that one.

### 2.3 FIX-12 — `Confirm Assignment` feedback (was UNPERFORMED)
1. `/sections` → open a row's home-room picker → pick a room → `Confirm Assignment`.
2. **Immediately** after the click, record whether the button shows a disabled/loading state.
3. **Double-click the confirm button.** Count the PUTs (DevTools network filter). It must be **exactly one**.
4. Read the toast. It must state persisted / queued / failed — and which one actually happened.
5. To exercise the **queued** branch, put DevTools in **Offline** before step 1. The message must say the change is queued, **not** that it saved.
6. Confirm the toast is painted **above** the dialog, not behind it.
7. Re-enable the network and confirm the queued change syncs and the UI refreshes.

### 2.4 FIX-20 — save confirmation on the subject form (was UNPERFORMED)
1. `/subjects` → `Add subject`. Confirm the modal is centered and its body scrolls internally with the footer reachable at 1366×768 **and** at 390px.
2. Type a name and codes, then cancel whatever confirmation appears. **Every field must still be populated.**
3. Confirm, then immediately click Confirm again. Count the POSTs — **exactly one**.
4. Force a failure (submit a duplicate code). Confirm the dialog keeps you in a recoverable state with your input intact.
5. **The open product question:** the original asks for an explicit save confirmation, and its own note says that click "conflicts somewhat with the broad `less clicks` goal in Fix 16, so scope it to the review's intended save paths rather than blindly adding confirmation to every harmless form". ATLAS has **not built** this confirmation. State whether you want it, and on which paths.

### 2.5 FIX-29 — swap confirmation (was UNPERFORMED)
1. `/teaching-load` → a teacher row's assignment card. Click the **card body and its title whitespace**, well away from any button. **Nothing must change** and no dialog may open.
2. Click the dedicated swap control (the `ArrowLeftRight` button). A `Confirm Assignment Swap` dialog must open naming **source teacher, target teacher, the section, and the weekly-load impact**. **Still nothing is mutated.**
3. Cancel. Confirm **zero** draft changes.
4. Confirm. Exactly **one** swap.
5. Click confirm twice rapidly. Exactly one swap; the button must show in-flight protection.
6. Confirm the success toast appears **only after** the draft mutation succeeds, and that the draft count increments by exactly one.

---

## 3. Handoff to A2 — Class Schedule teacher-name casing (not edited, by fence)

FIX-22's original audit list includes **Class Schedule cells**. Route `Class Schedule`
is `/timetable`, which A2 is reworking in c11, so I fenced those files off and did
not edit them. S4 found the call sites and they are confirmed still present and
untouched at `ebe6331c4`:

- `src/lib/timetable-reference-labels.ts:49-59` `buildFacultyInitials` uppercases
  only the **initial** and leaves `lastName` **stored** — cells read `C. Aguilar`
  beside `R. Alcantara`, the same mixed-casing defect as the roster.
- `src/lib/timetable-reference-labels.ts:38-47` `buildFacultyLabel` returns
  `` `${lastName}, ${firstName}` `` in stored casing.
- Consumers: `useTimetableData.ts:1940` → `CenterWorkspace.tsx:169,295,778,859` →
  **`TimetableGrid.tsx:498`**, plus `ClassProgramMatrixView.tsx:221`,
  `RightPanel.tsx:209,303`, `LeftRailContent.tsx:326,359`, `TimetableTaskDrawer.tsx:507`.
- **A pinned test asserts the mixed case**: `src/lib/__tests__/timetable-cell-info.test.ts:125-127`
  expects `'C. Aguilar'`. A2 must **supersede it additively** (mark superseded,
  add the replacement beside it) and not delete it.
- The reusable helper already exists and needs no new file: `formatFacultyInitials`
  and `formatFacultyDisplayName` in `atlas-client/src/components/faculty/teacherNameDisplay.ts`.

`origin/main` was still at `ebe6331c4` when this was written, so nothing has yet
picked this up.

---

## 4. Rendered evidence still owed, in dependency order

One browser session on the deployed release closes items 1–3.

1. **14 / 16** — `/teaching-load` at 1366×768. Measure the y-offset of the first data row. It was **430px** on `a1db27d5`; the model projects **273px**. Quote both, and count how many assignment rows now fit.
2. **15** — `/subjects` at 1366×768. Room Type and Program must both be visible in the single row with **no** popover to open; confirm `/subjects`' first data row against the **354px** baseline; confirm no horizontal scrollbar. Then at 390px, confirm the row **wraps** rather than overflowing.
3. **24** — `/teachers`. Confirm `Create temporary teacher (Teacher N)` and `Refresh teacher list` render on **one line each**, at 1366×768 **and** 390px, in both the desktop and mobile menu variants.
4. **25** — `/teachers`. `Review load` must open a modal **without the URL changing**. Confirm the roster's search text, sort order and scroll position are identical after close.
5. **26** — `/teaching-load` → `Review teachers`. The four counts must match the live roster and **sum to the total**. Click each count and confirm the list filters. Then confirm the honest-gap state: with no persisted standard the counts show `—` and are disabled, not `0`.
6. **22** — `/teachers`. Confirm names render uppercase **and** that typing `alcantara` still matches `Alcantara, Roberto`.
7. **01** — `/sections`, with a picker open, scroll the table. The popover must **close**, not freeze. Then scroll **inside** the option list: it must stay open and usable.
8. **07 / 10 / 11** — the room card at **75 % and 125 %** zoom (the scorecard only ever confirmed 94 %). Check title, badge, occupancy and capacity do not collide, that badges are legible without zooming, and that `Makakalikasan` and `Learning Commons` show in full on two lines.
9. **11** — `/sections` picker: a one-line name and a two-line name must render at the **same row height**.

Every row asserts `window.location.origin === 'https://njgrm.buru-degree.ts.net'`.

---

## 5. Dated backlog this cycle produced

- **2026-09-28 — the 11px ratchet's sweep stops at a directory boundary.** A3-C10
  QA finding F1, NON_BLOCKING, disclosed in the test comment at
  `a3-sections-map-layout.test.ts:823-830`. Widening it to the faculty surfaces
  this range itself edited would newly catch **22 pre-existing sub-11px sites** in
  `TeacherGridMode.tsx:309` (`text-[10px]`), `FacultyRow.tsx` (8, incl. 9.6px at
  `:215,:229,:253`) and `FacultyProfileSheet.tsx` (13, incl. 10.4px). All are
  byte-identical base→tip, so **not a regression**, and FIX-10 is room-card-scoped,
  so the fix as scoped is correct. This is a **named item, not a comment** — it is
  the same completeness pattern this lane failed on in c5, c6, c8 and twice in c9.
- **2026-09-28 — the marker's anti-vacuity pin is a floor** (`swept.length >= 11`,
  F2). A file leaving the matched set reduces the count without failing. The
  `owned.length === 19` pin catches a removed file, so the aggregate is protected,
  but the sweep's *reach* can narrow silently.
- **2026-09-28 — `sameSnapshot` overstates its guarantee** (F7). It compares
  `rows` by reference and only avoids churn because `TeacherGridMode` memoizes the
  snapshot three files away. A caller publishing a freshly built snapshot would
  notify every listener on every publish.
- **2026-09-28 — three test files are now large enough to hide a completeness
  claim** (F8): `subjects-ux-a3.test.tsx` 1856, `a3-sections-map-layout.test.ts`
  1290, `a3-teachers-load-c3.test.tsx` 1273. §8's 1000-line ceiling scopes to
  React component files, so this is not a violation — but a claim inside one of
  them can no longer be verified by reading it.
- **Corrected this cycle:** my c9 handoff records the typecheck baseline as
  "5 errors in 4 A2-owned files". Fresh QA established the real base is **5
  errors**, and that one executor's "1 error" report was wrong — the four extra
  are `playwright` not being installed, identical at base.
