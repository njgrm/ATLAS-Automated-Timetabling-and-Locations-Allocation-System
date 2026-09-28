# A6 c5 — layout note: the Teaching Load shortage line (design judgement gate, AGENTS.md §11)

Written **before** any JSX, per AGENTS.md §11 "Design before code". Bound: packet
`docs/prompts/a6-c5-outage-placeholders-2026-09-29.md`, base `b768dba8`.

## The user and the task

An older, mouse-first scheduler, Wednesday morning. No substitute exists. Nine MAPEH
sections and four English sections have no teacher. They open Teaching Load and have
to learn *which subject* is short from a percentage, a chip, and a repair-queue item
that routes them to a different tab. The task on this screen is: **cover these
classes**. What should feel different: calmer, shorter, and one obvious next step —
not a new dashboard.

## The counting method, stated up front (AGENTS.md §11)

A **word** is a whitespace-separated token in the *rendered* text of
`[data-testid="teaching-load-readiness-strip"]` (row 2), whitespace-collapsed and
trimmed. Punctuation-only tokens (the `·` separators) count, because they are
rendered text a scheduler reads.

**AMENDED 2026-09-29 (correction round 1 — QA finding B3).** One more rule is
needed, and finding it is what made this instrument able to catch the defect the
correction was written for. **An element boundary is a word boundary.** JSDOM's
`textContent` glues adjacent nodes that have no whitespace between them, so the
row

```
… 12 Sept roster  |  +3 more  |  Cover these classes
```

came back as `roster+3` and `moreCover` — **two tokens standing for four**. A row
could grow by two words and the count would not move, which is a control that
cannot discriminate (AGENTS.md §11). So every rendered text *run* is counted and
runs are joined with a space.

**The three instruments disagree, and the disagreement is recorded rather than
resolved in the note's favour.** On the same BEFORE, measured in JSDOM:

| instrument | BEFORE |
| --- | --- |
| collapse across element boundaries (this note's original method, and QA's finding B1 table) | 24 |
| QA's rendered measurement, as reported in the finding | 19 |
| **every text run counted as its own words — ADOPTED** | **30** |

The third is adopted because it is the **upper bound**: it can only ever
over-report. The rule being defended is "the after number must not be larger",
and an instrument that flatters the candidate is the wrong tool for it. Hover text
is not row text, and it is not in the DOM — Radix does not render closed tooltip
content, so no filtering is required and none is faked. What *is* counted is the
repair queue's own `data-testid="teaching-load-repair-status"` span, because that
is visible text on the chip; excluding it would have flattered the BEFORE by six
words.

This is the same instrument `__tests__/a6-c5-outage-derivation.test.tsx`
(`A6C5-WORD-1`) commits, and the declared `TEXT_XS_ADVANCE_PX = 6.6` advance
still backs the width claim, so no width is measured here and none is claimed.

Fixture: the packet's own scenario — `realAssignedPairs 75`,
`syntheticPlaceholderPairs 25`, `unassignedPairs 12`, `totalPairs 112`,
`dataSource: live`, the real `missing-load` repair-queue item, and the packet's
per-subject figures MAPEH 9 / English 4 / Fil 2 / Esp 1 / Sci 1. Taken from the
real surface (`WorkspaceToolbar` + `TeachingLoadRepairQueue` +
`TeachingLoadOutageSurface` + `useTeachingLoadOutage`), not invented.

## BEFORE — row 2, verbatim, in the outage state

```
67% staffed · 12 classes need a teacher · Temporary substitutes: 25
Next step 12 open Assign teachers to open classes
12 section-subject pairs need a teacher.
Review subject coverage
```

**30 words, measured.** (This section previously declared 24. That figure came
from the element-collapsing instrument above, which merged `teacher· Temporary`,
`25Next`, `openAssign` and `teacher.Review` into single tokens. The 24 is
superseded, not deleted — it is the same BEFORE read by a weaker instrument.)

The committed control mounts the **candidate's** no-shortage row, which reads
`67% staffed` because S3 already corrected the lying percentage. The row this
packet replaced at the base read `89% staffed`. The two differ by one token
(`89%` → `67%`), so the 30 is the count for both, and the control's 30 is the
figure the candidate is measured against.

Read aloud, that is one shortage fact stated three times, in three vocabularies:
`12 classes need a teacher`, `Temporary substitutes: 25`, and
`12 section-subject pairs need a teacher` — plus `67% staffed`, a percentage
nobody asked for and which counts a placeholder-held class as staffed. The one
control that would act (`Review subject coverage`) navigates to Subject Coverage
to work out which subject is short, which is the thinking the packet exists to
delete.

## AFTER — row 2, by design

```
16 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster  +1 more  Cover these classes
```

**18 words, measured** — the widest state. Shorter than the 30 it replaces by 12
words, and the words it drops are the duplicates, the percentage, and the
per-subject repetition of one verb.

### The measured state table — and the arithmetic is no longer in this note

The counting lives in a committed control, so it is the evidence rather than the
claim. `A6C5-WORD-1` renders the real toolbar with the real surface in its
`shortageLineSlot` and the real repair queue in its `stateLineSlot`, for every
state below, and fails if any shortage state exceeds **19 words** or exceeds the
**30-word BEFORE**. `A6C5-WORD-2` then fails if the per-subject figures or the
data date were ever bought out of the budget.

| state | before (30-word row) | after | rendered |
| --- | --- | --- | --- |
| 0 subjects | 30 | 30 | the base row, untouched by this slice |
| 1 subject | 13 | **12** | `9 classes short: MAPEH 9 · 12 Sept roster Cover these classes` |
| 2 subjects | 20 | **14** | `13 classes short: MAPEH 9, English 4 · 12 Sept roster Cover these classes` |
| 3 subjects (the cap) | 27 | **16** | `15 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster Cover these classes` |
| 4 subjects (cap + overflow) | 33 | **18** | `16 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster +1 more Cover these classes` |
| 6 subjects (widest) | 33 | **18** | `19 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster +3 more Cover these classes` |

Three changes produce that, and each is a subtraction:

1. **The verb is paid for once.** The superseded line repeated
   `classes need a teacher` per subject — five words × the cap, which is why the
   row got *longer* in exactly the states the cap was designed for. The head
   clause carries `N classes short` and each subject carries only its name and
   its figure.
2. **The overflow is stated once, not twice.** The superseded sentence ended
   `· N more subjects ·` while a separate `+N more` control rendered the same
   fact beside it: one fact, two vocabularies, one row, which is the §8
   violation. The sentence no longer mentions the overflow at all; the control
   is the row's single statement of it, and its hover now says what it OPENS
   rather than repeating how many it hides.
3. **The workspace total is stated, because the list cannot sum to it.** With
   the cap at three, the named figures do not add up to the workspace's total, so
   a row of per-subject counts alone would understate the outage by exactly the
   part it cannot show. The head clause is the total; the list after the colon
   is its breakdown.

**What the budget covers, stated rather than implied.** It bounds the states this
slice renders, on this fixture, whose subject names are single tokens. A two-word
subject name would add a token per named subject, and the cap of three is what
bounds how many times that can happen — so the cap, not the number, is what keeps
an unforeseen roster bounded. The zero-subject state is measured against the
BEFORE (30 against 30) rather than the 19 budget, because in that state the row is
the base row — `% staffed`, the alert chip and the `missing-load` next step —
which other committed rows pin and which this slice has no authority to rewrite.
Asserting ≤19 there would be a claim about another slice's sentence.

## What stays, what goes, what moves

**Stays in row 1** (untouched by this packet): title, Teachers/Sections switch, the
source-verification chip, the draft chip, `Help`, `Load summary`,
`Suggest assignments`, `More` (which already holds `Archived load` and the staffing
mode).

**Stays in row 2:** the `stateLineSlot` for every *other* next step (unsaved draft,
a teacher with no load, over-cap, a placeholder to replace) and its one primary
action. The slot is untouched; only the shortage's own claim-bearing content moves.

### GOES from row 2

1. **The `alertChip` clause** — the whole clause, `· Temporary substitutes: 25`
   and equally `· Above weekly max: N` / `· Excess teaching load: N`. Rationale
   recorded honestly: the packet says the line "replaces the `alertChip`".

   **AMENDED 2026-09-29 (A6 c5, the over-cap resolution). The prior wording of
   this item said the over-cap and excess clauses "survive only when there is no
   shortage", which described the clause as still being rendered. That was
   imprecise about WHERE the fact lives, and imprecision here is how a blocker
   disappears between two screens. The precise adjudication, measured and
   committed:**

   - The `alertChip` is **replaced by two things at once**: the shortage line
     (which carries the placeholder/`Temporary substitutes: 25` clause's own
     fact) **and the repair queue's `over-cap` item**, which stays on row 2
     inside `stateLineSlot` and is unaffected by this slice.
   - So **`Above weekly max: N` now lives in the repair queue, named once**:
     `Alcantara, Roberto is over the weekly max · 32.0h used / 30h max`, with a
     `Move classes` action. It is stated **exactly once**, not twice in two
     vocabularies — which is §8's actual rule ("one status per fact", "never two
     chips that say the same thing"), and a strict improvement on the
     chip-plus-queue pair it replaces. One status per fact, never zero.
   - **Measured, not assumed:** the queue builds its `over-cap` items
     unconditionally, so no shortage state can suppress them, and
     `A6C5-OVERCAP-1` mounts the REAL hook with a shortage AND an over-cap
     teacher and asserts the item renders while the chip does not.
     `A6C5-OVERCAP-2` asserts the no-shortage state is unchanged, chip and
     `data-alert-key` included.
   - The `data-alert-key` / `data-testid` contracts and the a3-c10 T7 row that
     read them are untouched: they render this component WITHOUT the slot, which
     is the no-shortage state, and in that state the sentence and the alert
     render exactly as they always have.

   What is NOT claimed: the `Excess teaching load: N` clause has no
   per-teacher queue item — it is an advisory facet count, not a generation
   blocker. In a shortage state it is therefore **withheld while a shortage is
   being fixed**, and returns in full the moment the shortage line is not
   claiming the row. Recorded here rather than hidden, because an advisory figure
   that disappears with an unrelated blocker is a cheaper loss than a hard
   blocker that does.
2. **The `missing-load` repair-queue item** (`Assign teachers to open classes`,
   `12 open`, `12 section-subject pairs need a teacher.`, `Review subject coverage`).
   The shortage line carries that claim now, per subject, in words a primary-school
   teacher can read out loud, and its action opens the cover dialog on this screen
   instead of routing to Subject Coverage. This is the packet's own "replaces", and
   it is the single largest subtraction in the slice: **18 of the 30 measured
   words** (this note previously said 14 of 24; both figures were computed on the
   element-collapsing instrument and are superseded by the measurement).
3. **The `% staffed` figure.** §8 forbids a status line that competes with itself,
   and it is the figure that lies (S3): it counts a placeholder-held class as
   staffed. It is not reworded and not moved — it is removed from row 2. It remains
   available, truthfully computed, in the `Load summary` dialog.
4. **The `review-ready` fallback while a shortage exists.** With the `missing-load`
   item gone, a shortage page would otherwise fall through to
   `Teaching Load looks ready · 23 of 24 classes have a teacher.` — the queue
   contradicting the line directly above it. The fallback is suppressed while the
   shortage line is showing. The queue's other items are unaffected.

### MOVES

- **`Assigned pairs` / `% staffed`** (the truth panel's figure) → unchanged in the
  `Load summary` dialog, now computed without counting a placeholder-held class as
  staffed (S3).
- **The data date** → visible in row 2 as `12 Sept roster`, from
  `data.sectionSummary.fetchedAt`, the only timestamp the client holds. No date, no
  clause: the packet forbids inventing one.
- **`Still without a teacher`** → the `Load summary` dialog and the suggestion
  modal, recounted as "no *real* teacher" (S3).
- **The page-level S9 note** — `teaching-load-still-need-real-teacher` in
  `pages/TeachingLoad.tsx`. **It was missing from this ledger entirely** (finding
  B3), so the note was not a truthful record of a change it made. Where it sits
  and why:

  - **Where:** the first line of the main column, immediately below the command
    strip and above the roster — `px-3 pt-1 text-xs font-semibold
    text-muted-foreground`, `hidden` below a 640px-tall viewport to match the
    rollover card, and deliberately **not** a `shrink-0` band, because it is
    content that scrolls with the roster and `a3-c10` T4 requires the main column
    to carry exactly one `shrink-0` band.
  - **What it says:** the workspace's own honest reading of the staffing figures
    (`N classes still need a real teacher.`, from
    `teachingLoadShortageNote`), rendered only while
    `withoutRealTeacherCount > 0`.
  - **Why it is here and not on row 2:** it is the ONE statement of the count
    that reaches a scheduler who never opens a dialog and never looks at the
    header. Row 2 now carries the per-subject line, and moving this sentence
    onto that row would have put the same fact in two vocabularies on one row
    again — the defect this slice exists to remove. It is also the reason the
    row-2 budget could be met without deleting the total: the workspace figure
    lives here, so row 2 may spend its words on the breakdown that row 2 is for.
  - **What it is not:** it is not a next step and carries no control. Row 2 owns
    the action (`Cover these classes`).
- **Nothing moves behind a Tooltip** as a result of this slice. The existing
  next-step `description` hover and the `Alert summary` hover are untouched. The
  one hover whose content this slice CHANGED is `+N more`, which now describes
  its destination instead of restating the count beside it (finding B2).

## The one new control

`Cover these classes` — a `@/ui` `Button`, `size="sm"`, `variant="outline"`, the
same `h-7 … text-xs` chrome as every other row-2 action (`Review subject coverage`
today), so §8 "one look per control" holds without a page-local override. It opens
`CoverShortageDialog` on this screen: no route change, no side-nav detour, no reload.

The dialog's three options are `@/ui` `RadioGroup` items, not `<select>` and not
cards. Its one primary action is `Assign this teacher now`, disabled until an
`apply:false` preview has resolved — the preview is always first.

## What this note does NOT claim

Not measured: glyph widths and the 1366px fit. JSDOM performs no layout and this
worktree runs no browser, so the width claim is a declared advance, and the
committed control fails if the steady state stops fitting. Not built: the
`teach outside department` option (no server field — follow-up 1), the `+N more`
target beyond the existing coverage detail, and any rename of
`buildGuidedEmptyTeachingLoadMessage` (follow-up 2).

## Subtraction ledger

**AMENDED 2026-09-29 (correction round 1 — QA finding B3).** Every figure below
was wrong, and the table measured nothing. What the slice took OFF row 2 is still
itemised, because *what* went is the design record — but the table below is a
CONTENT ledger, not a subtraction, and it deliberately carries no "removed"
total: the BEFORE and the AFTER are different outage states, so their word counts
do not subtract to a meaningful number. The decision is the measured state table
above, and the two figures that decide it are the **30-word row this slice
replaces** and the **19-word budget the correction set**.

| Content removed from row 2 | Words |
| --- | --- |
| `· Temporary substitutes: 25` | 4 |
| `67% staffed` + its separator | 3 |
| `12 classes need a teacher` (the workspace-wide clause) | 5 |
| `Next step` (queue label) | 2 |
| `12 open` (queue count badge) | 2 |
| `Assign teachers to open classes` | 5 |
| `12 section-subject pairs need a teacher.` (the chip's own status) | 6 |
| `Review subject coverage` (the detouring action) | 3 |
| **Row-2 content the slice removed, in the state it removed it from** | **30** |

Two entries of the earlier ledger are gone as separate rows because they were the
defect rather than a subtraction: `classes need a teacher` repeated per subject is
now paid for ONCE (the head clause carries `N classes short`, and each subject
carries its own figure), and `2 more subjects` is gone because the overflow is
stated once, by the `+N more` control. Neither is a word this note may spend, so
neither belongs in a ledger of what was taken.

The two-subject case the packet actually describes is 14 words against the 30-word
row it replaces; a single-subject outage is 12; the cap is 16; and both overflow
states are 18. The measurement is the *rendered* count, taken by the committed
control `A6C5-WORD-1`, so that control is the evidence and this note is only the
record of it. Where a state ever exceeds 19 the control fails and the copy gets
shorter — the fix for an over-budget row is shorter copy, never a smaller font.

**What the earlier version of this ledger claimed, and why each figure was
wrong.** It declared BEFORE 24 (an instrument artefact, above), AFTER 23, one
subject 20 and "26 widest" — and the widest case exceeded its own stated budget,
which the note acknowledged in prose while attributing the measurement to "the
committed control". No such control existed: `a6-c5-outage.test.tsx`'s `row2()`
only LOCATES the strip, and no assertion anywhere in the client compared a
rendered word count to any number. The claim was unearned, the row grew past the
BEFORE in three of five states, and the arithmetic was the only witness. The
control is now committed and is what decides it.
