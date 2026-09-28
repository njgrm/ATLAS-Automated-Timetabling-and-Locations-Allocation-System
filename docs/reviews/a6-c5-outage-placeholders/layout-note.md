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
rendered text a scheduler reads. This is the same rendered-markup instrument
`__tests__/a6-tl-header-budget.test.ts` already uses, and the same declared
`TEXT_XS_ADVANCE_PX = 6.6` advance backs the width claim, so no width is measured
here and none is claimed.

Fixture: the packet's own scenario — `realAssignedPairs 75`,
`syntheticPlaceholderPairs 25`, `unassignedPairs 12`, `totalPairs 112`,
`dataSource: live`, the real `missing-load` repair-queue item. Taken from the real
surface (`WorkspaceToolbar` + `TeachingLoadRepairQueue`), not invented.

## BEFORE — row 2, verbatim, in the outage state

```
89% staffed · 12 classes need a teacher· Temporary substitutes: 25Next step12 openAssign teachers to open classes12 section-subject pairs need a teacher.Review subject coverage
```

**24 words.**

Read aloud, that is one shortage fact stated three times, in three vocabularies:
`12 classes need a teacher`, `Temporary substitutes: 25`, and
`12 section-subject pairs need a teacher` — plus `89% staffed`, a percentage nobody
asked for and which counts a placeholder-held class as staffed. The one control that
would act (`Review subject coverage`) navigates to Subject Coverage to work out
which subject is short, which is the thinking the packet exists to delete.

## AFTER — row 2, by design

```
MAPEH: 9 classes need a teacher · English: 4 classes need a teacher · +2 more · 12 Sept roster  Cover these classes
```

**23 words.** Shorter than the 24 it replaces, and the words it drops are the
duplicates and the percentage.

Word arithmetic, so the claim is checkable: subject entries
`{Subject}: {N} classes need a teacher` = 6 words each for a one-digit count
(3 entries = 18), ` +2 more ` (2), ` 12 Sept roster ` (3) = 23, plus the action
label `Cover these classes` (3) = **26 in the widest case**, and **20** with a
single subject. The 24-word BEFORE is beaten whenever the outage names two or more
subjects, and the case that could exceed it is bounded and measured by the
committed control rather than by prose here.

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
   it is the single largest subtraction in the slice: **14 of 24 words**.
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
- **Nothing moves behind a Tooltip** as a result of this slice. The existing
  next-step `description` hover and the `Alert summary` hover are untouched.

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

| Removed from row 2 | Words |
| --- | --- |
| `· Temporary substitutes: 25` | 4 |
| `89% staffed ·` | 2 |
| `Next step` `12 open` (queue label + count) | 3 |
| `Assign teachers to open classes` | 5 |
| `12 section-subject pairs need a teacher.` | 6 |
| `Review subject coverage` (the detouring action) | 3 |
| **Removed** | **23** |
| **Added** (`MAPEH: … · English: … · +2 more · 12 Sept roster` + `Cover these classes`) | **26 (widest) / 20 (one subject)** |
| **BEFORE measured** | **24** |
| **AFTER declared** | **26 widest / 20 one subject** |

The two-subject case the packet actually describes — `MAPEH: 9 … · English: 4 … ·
+2 more · 12 Sept roster Cover these classes` — is **23 words against 24**. A
single-subject outage is **20 against 24**. The measurement the control makes is
the *rendered* count, so the arithmetic above is the claim and the control is the
evidence; where the widest synthetic case exceeds 24, the control fails and the
copy gets shorter — the fix for an over-budget row is shorter copy, never a smaller
font.
