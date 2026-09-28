# A6 packet c5 — real teacher outage: shortage you can act on, one click to cover it, placeholders that say so

Base `316534f2` (`origin/main`), branch `work/a6-c5-outage-placeholders`, worktree
`E:/ATLAS-worktrees/lane-a6-tl-header`. **Client only** (`atlas-client/**` plus this packet and its tests).
A8 c2's server half is on main at `195b52fe`; A9's non-teaching filter is on main. Touch no server file.
Risk tier: **MEDIUM** (a new write path from Teaching Load). Loop: executor → one fresh QA (source rows +
design gate + browser rows) → planner integration.

## Who this is for

An older, mouse-first scheduler on Wednesday morning. There is no substitute. Nine sections in MAPEH,
four in English, and nothing loaded. They open Teaching Load. What they must not meet is a percentage, a
queue, or a word like "unresolved". What they should meet is one sentence a primary-school teacher could
read out loud — "MAPEH: 9 classes need a teacher" — and one button that starts fixing it.

Today they meet `87% staffed · 12 classes need a teacher`, a `Temporary substitutes: 25` chip, a repair
queue item titled "Assign teachers to open classes", and a 1000-line page. They must click into Subject
Coverage to learn *which subject* is short. That is the tedium this packet removes.

**What should feel different:** calmer and shorter, and one obvious next step. Not a new dashboard.

## The three screens

### 1. The shortage line (row 2 of the header, replacing what is there)

One line, in plain words, per short subject, in descending order of class count, capped at three subjects
with a `+N more` link into the existing coverage detail:

> `MAPEH: 9 classes need a teacher · English: 4 classes need a teacher · 2 more subjects`

Each entry carries the figure it was computed from **and the date of that data** (`from the 12 Sept
roster` — use the source-state date the page already holds; if there is none, use the last successful
fetch, never invent one). The figure comes from saved coverage, never from a withheld placeholder string.
A `withheld` sentence is allowed only when ATLAS genuinely cannot verify the source (offline /
refreshing / none / EnrollPro unreachable) — that behaviour is correct today and must stay.

**Subtract, do not add.** This line *replaces* the `alertChip` and the repair queue's
"Assign teachers to open classes" item. It does not sit beside them. Two chips that say the same fact is
a §8 violation and the operator named it on live.

### 2. Cover these classes (one step, no detour)

From a short subject in that line: `Cover these classes` → a dialog on the same screen. No side-nav
detour, no route change, no page reload.

The dialog offers the decision in three options, each **one line of consequence and one preview number**,
each number produced by the server's zero-write preview before anything is written:

| Option | One line of consequence | Preview number |
| --- | --- | --- |
| `30 hours a week` | "A standard load. Leaves the other classes for a teacher you already have." | "covers 6 of the 9" |
| `Stretch to 40 hours` | "Only for a subject specialist. A heavier load for one person." | "covers 9 of the 9" |
| `Leave it open` | "Nothing is saved. These classes stay on the shortage line." | — |

Then one primary action, `Assign this teacher now`, and one preview, `See what it will assign`:
`apply:false` first, always, before the primary action is enabled. The preview lists **class names**, not
ids. After apply the dialog names what it assigned and what is still open, in class names, and leaves the
shortage line updated.

**`teach outside department` is NOT in this packet.** The A8 endpoint takes `maxHoursPerWeek` and
`teacherName` and nothing else; a control promising it would be a control that lies. Record it as a
follow-up row naming the missing server field. Do not stub it, do not disable it with a shrug tooltip.

### 3. Placeholders say what they are

Everywhere a placeholder appears in Teaching Load, it says `to be hired — not a real person yet`:

- the roster row (today: a bare one-word footnote `temporary`),
- the sections grid (today: nothing at all — the percentage is simply suppressed),
- the suggestion preview row (today: an empty Teacher cell and a colour-only chip).

And the two figures that currently lie about placeholders must stop:

- `% staffed` counts a placeholder-held class as staffed. It must not.
- `Still without a teacher` counts unowned pairs only, so it reads 0 while 25 classes sit on temporary
  records. It must count what a scheduler means: no *real* teacher.

## Already done — verify, do not rebuild

- **Guided mode is gone from `main`** (A6 c4, `91a9b8fb`). `TeachingLoadGuidedModePlaceholder.tsx` is
  deleted and no user-visible "Guided" string is reachable. Do **not** rename
  `buildGuidedEmptyTeachingLoadMessage` — the identifier is not user-visible and two accepted controls
  import it.
- **The 3 hidden teachers are gone from `main`** (A9 removes non-teaching personnel at fetch). Do **not**
  build a `Needs a department` cue for records that must not exist. Verify the roster count and the
  zero-load list are truthful, and stop.
- **`N classes still need a real teacher` exists** (`lib/teaching-load-suggestion-presentation.ts`) but
  only inside the summary modal's description, and the *preview* toast at
  `pages/TeachingLoad.tsx:315` still carries pre-hotfix wording. Put the note where a scheduler reads it.

## Server contract — read it, do not re-derive it

`POST /faculty-assignments/coverage/repair`, `atlas-server/src/routes/faculty-assignment.router.ts:465`.
Authenticated, `requirePrivilegedRole`, `rejectCapabilityOverrideScope`. **No `schoolId` default exists on
this route** — `CreatePlaceholderDialog.tsx:23` hard-codes `DEFAULT_SCHOOL_ID = 1` and that is a known
defect you must not inherit. Pass the page's own `data.schoolId` and `data.activeSchoolYearId`.

Request: `{ schoolId, schoolYearId, subjectCodes?, subjectIds?, maxHoursPerWeek?, teacherName?, apply }`.

`PlaceholderCoverageRepairResult` (`services/faculty-assignment.service.ts:1315`):
`applied`, `before`, `after`, `createdPlaceholders[]`, `reusedPlaceholders[]`,
`sectionsCoveredByPlaceholder`, `placeholderAssignmentsUpserted`, `resolvedSubjectCodes[]`,
`stillUncoveredSubjectCodes[]`, `plannedAssignments[]` (identical for `apply:false` and `apply:true`),
`teachers[]`, `assignedPairs[]`, `stillUncoveredPairs[]`, `unresolvedSubjectRefs[]`.

`PlaceholderCoveragePlanRow`: `{ subjectId, subjectCode, subjectName, minMinutesPerWeek,
uncoveredSectionIds[], assignableSectionIds[], deferredSectionIds[], plannedPairCount, teacherName,
maxHoursPerWeek }`.
`PlaceholderCoverageAssignedPair`: `{ subjectId, subjectCode, sectionId, facultyId }`.

Both pair lists are **ids**. Map them to class names with the section and subject data the page already
has loaded. A row that renders `sectionId: 412` is a rejected row.

Apply-409 on the *suggestion* path carries `details.{ driftScope, changedPairs, changedPairCount,
remainingChangedPairCount }` where `changedPairs` is `[{ subjectId, sectionId, currentFacultyId }]`, bounded
at 10 (`services/teaching-load-suggestion-proposal.service.ts:170-184`). Name those classes in plain words
and offer `Review again`.

Never render `created`, `assignmentsCreated` or `uniqueTeachersAffected` as work done. A8 c2 changed
`created`/`assignmentsCreated` to count persisted inserts only; they are not a delivered-coverage figure.
The delivered figure is `applyResult.stillNeedRealTeacher` and `teacherXResolution.unsavedSubstituteRows`.

## Design judgement gate — how this is judged

Before any JSX, write the layout note to `docs/reviews/a6-c5-outage-placeholders/layout-note.md`: what
stays, what goes, what moves behind a Tooltip / `More` / a detail link. Then hold to it.

- **Subtract first.** Row 2 gets shorter, not longer. Count the words before and after; the after number
  must not be larger.
- **Header budget, §8:** at most two calm rows at 1366x768. No sentence cut with an ellipsis. No helper
  sentence under a button. One status per fact — no second chip restating the shortage. `More` holds
  anything idle.
- **One look per control, §8:** every new control is a `@/ui` primitive with the same trigger size,
  border, placeholder and search behaviour as `TeachingLoadFilterBar`. No native `<select>`, no raw
  `<button>`, no `<details>`, no `title` attribute. `@/ui` is `atlas-client/src/ui/` — **`HoverCard` does
  not exist**; use `Tooltip` or `Popover`.
- **Nothing dense or intimidating.** No metric cards, no grids of numbers, no abbreviations the operator
  has to decode, no raw ids anywhere a name exists.
- **No file over 1000 physical lines.** `pages/TeachingLoad.tsx` is at 981. Every new component goes in
  `atlas-client/src/components/faculty-assignments/`.
- Copy the page pattern that already does it best. A2's header and A5's `FilterPicker` are the two
  references; do not invent a local variant.

## Acceptance rows — each names its harness

Source rows (`npm run` in `atlas-client`, the new test file reachable from a committed script in the
same commit — add it to `test:client-suite` **and** give it a dedicated `test:a6-c5-outage` script):

| # | Row | Harness |
| --- | --- | --- |
| S1 | No user-visible `Guided` text is reachable from `/teaching-load`. | render assertion + the existing c4 deletion control |
| S2 | The shortage line is per subject, descending, capped at 3 + `+N more`, and carries the data date. Mutant: change the fixture and the line must change. | new test |
| S3 | `% staffed` and `Still without a teacher` never count a placeholder-held class as staffed. Mutant: a synthetic placeholder must move both. | new test |
| S4 | Preview is `apply:false` first and the primary action is disabled until it resolves. The preview names classes, not ids. | new test, asserts the request body's `apply` |
| S5 | 30 h / 40 h / leave open each carry their consequence line and a preview number; the number changes with the option. | new test |
| S6 | Apply 409 → plain-words changed-class list (≤10 named, plus "and N more") and a `Review again` control that re-previews. | new test |
| S7 | Roster row, sections grid and suggestion preview row all read `to be hired — not a real person yet`. | new test, three surfaces |
| S8 | After apply, the surface names what is still open and the next step. The word "complete" is not shown for an incomplete result. | new test |
| S9 | The `N classes still need a real teacher` note is on the page, not only in the modal description; the pre-hotfix preview-toast wording is gone. | new test |
| S10 | Header holds ≤2 rows at 1366x768 with no truncation; every new control is a `@/ui` primitive; no raw `<select>`/`<button>`/`<details>`/`title=`. | extend `test:a6-tl-header-budget` or the new test |
| S11 | The roster count and zero-load list exclude non-teaching personnel; no department-setting affordance was added. | new test |
| S12 | `npm run tsc` (client) exit 0. | shell |

Browser rows (Playwright MCP, loopback preview → staging, `ISOLATED_LOCAL_BROWSER`, assert
`window.location.origin` on every row; start the preview only with
`powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port <p>`):

| # | Row |
| --- | --- |
| B1 | `/teaching-load` loads from loading to resolved data with no error boundary and no console error. |
| B2 | Before/after at 1366x768 of the header with a real shortage on staging. |
| B3 | The cover flow: preview shows class names, apply, and the after-state names what is still open. |

Design rows, scored by the reviewer who did not build it against `ux-communication-rubric`, on the B2
pair: one primary action · no truncation · no jargon or raw codes · one status per fact · controls match
other pages · nothing cramped. Any miss is `REJECT_UX` even with every test green.

## Do not

- touch `atlas-server/**` — A8 owns it;
- rename `buildGuidedEmptyTeachingLoadMessage` or delete a committed control (§16: corrections are additive
  to evidence);
- render `created` / `assignmentsCreated` as delivered work;
- reuse `CreatePlaceholderDialog` or its `DEFAULT_SCHOOL_ID = 1` default;
- invent a `teach outside department` control;
- add a chip, a line or a control to row 2 without removing at least as much;
- run the suggestion **apply** against staging or live. Preview and `apply:false` only. Live data apply is
  HIGH and is not authorised by this packet.

## Follow-up rows to record, not to build

1. `teach outside department` in the cover dialog — the A8 endpoint has no
   `canTeachOutsideDepartment`; needs a server field first.
2. `buildGuidedEmptyTeachingLoadMessage` identifier still says Guided (not user-visible).
3. `AutoFillSummaryModal.tsx:207` hard-codes the three coverage-mode labels that
   `lib/teaching-helpers.ts` already owns — fold to the helper, do not invent a fourth wording.
4. `CreatePlaceholderDialog` hard-codes `schoolId: 1` on `POST /faculty/placeholders` (Faculty page,
   another lane's surface).
