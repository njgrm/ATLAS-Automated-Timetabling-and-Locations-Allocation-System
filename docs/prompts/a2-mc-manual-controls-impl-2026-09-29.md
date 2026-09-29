# A2 mc — timetable manual controls speak plainly (implementation packet)

Worktree `E:/ATLAS-worktrees/lane-a2-mc-manual-controls`, branch `work/a2-mc-manual-controls`,
base `c57b8e1d` (origin/main tip). Run beside A2 c15 and c17. Target train 11.

Source packet: `docs/prompts/a2-timetable-manual-controls-2026-09-29.md`.
Walk standard: `docs/plans/codex-walk-standard.md`.

**You are the sole writer in this worktree.** Do not touch `D:\ATLAS`.

---

## 0. The user, the task, what should feel different

The user is an older, mouse-first school scheduler. Their job on `/timetable` is to clear the
things standing between a generated draft and a publishable schedule: find the must-fix items,
know which term they belong to, and move, swap or place a class without guessing what the
system will do.

Today the surface answers with numbers that do not add up, rows that cannot say who they are
about, a move target list that dead-ends, a preview that leaks engine text, and — after a
successful change — either a receipt that omits what changed or no receipt at all.

**What should feel different:** one honest count, one complete list, one obvious next step per
item, and a sentence after every change that says what moved and whether anything got worse.
Calmer, not louder. Subtraction first: this slice removes hidden must-fix items and raw engine
strings before it adds anything.

---

## 1. Ownership — files you own, files you must not touch

**Yours (client):**
`atlas-client/src/components/timetable/simplePublishReadiness.ts`,
`SimplePublishReadinessSheet.tsx`,
`simple/SimpleTaskDrawerHelpers.tsx`,
`timetableMoveTargets.ts`,
`TimetableMoveStatusLine.tsx`,
`atlas-client/src/components/ManualEditPanel.tsx`,
`atlas-client/src/components/manual-edit/manual-edit-foundation.ts`,
`atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`,
`atlas-client/src/components/timetable/modals/TimetableAssignmentDialogs.tsx`,
`atlas-client/package.json` (script line only — see §7),
plus new files you create under `atlas-client/src/lib/` and `atlas-client/src/components/timetable/__tests__/`.

**Yours (server):** `atlas-server/src/services/manual-edit.service.ts` — `buildHumanConflicts`
and the manual-candidate invariant message only. Nothing else in that file.

**Not yours — do not edit:** anything A2 c15 owns
(`useTimetableLookupHelpers.ts`, `schedule-review-helpers.ts`, `sections-sort.ts`,
`teaching-load-helpers.ts`, `faculty-assignment-helpers.ts`, `pages/Sections.tsx`,
`components/faculty/**`, `components/faculty-assignments/GradeBadge.tsx`,
`atlas-server/src/services/section*.ts`, `grade-level-resolver.ts`, `derived-demand.service.ts`,
`locked-session.service.ts`, `published-*.ts`, `workbook-export.service.ts`,
`official-program-docx.service.ts`, `pre-generation-draft.service.ts`,
`teaching-load-carry-forward.service.ts`, `types.ts`, `atlas-server/package.json`);
anything A2 c17 owns (`CenterWorkspacePaneSurface.tsx`, `PreferenceAdherenceLine.tsx`,
`lib/preference-adherence.ts`, `preference-adherence.service.ts`, `generation.router.ts`);
anything A8 c5 owns (`generation*.service.ts`, `constraint-validator.ts`,
`schedule-constructor.ts`, `write-school-year-authority.ts`, `faculty.router.ts`,
`section.router.ts`).

**`atlas-client/src/types.ts` is c15's.** If you need a new type, declare it in a new file under
`src/lib/` and import it. Do not add to `types.ts`.

If a change seems to need a file you do not own, stop and write it in the handoff as a blocked
row. Do not negotiate it in the code.

---

## 2. §8 file-size cap — read this before you add a line

`atlas-client/src/components/ManualEditPanel.tsx` is **996 physical lines**. The AGENTS.md §8 cap
is 1000. Any JSX you add there breaks the cap.

**Extract first.** The natural seams, in this order of preference:

- the Conflict Inspector body (lines ~695–992: header, results, baseline, sticky footer) →
  `atlas-client/src/components/manual-edit/ManualEditConflictInspector.tsx`;
- the left Action form (lines ~371–693) → `ManualEditActionForm.tsx`.

Whatever you extract keeps its existing testids, classes and props exactly. A moved component
is not a changed component. State that holds across the extraction (`previewResult`,
`pendingProposal`, `lastPreviewSummary`, the form fields) may stay in the parent — that is the
cheap path and it avoids new threading bugs.

Every other file you touch must also stay at or under 1000 physical lines when you finish.
Check with:

```
(Get-Content <file> | Measure-Object -Line).Lines
```

and state the count for every file in your handoff.

---

## 3. Slice 1 — one count, one list (packet item 1)

### The defect, measured from the source at `c57b8e1d`

Four numbers wear the same word and describe three different populations:

| Surface | Source | Population it actually counts |
|---|---|---|
| Header chip `6 Must fix` | `simple/SimpleHeaderHelpers.tsx:139` via `context.blockingHardCount` → `timetableWorkspaceTruth.ts:155` | run-wide allowlisted HARD violations |
| Publish Readiness `6 Must fix · 10 sessions still to place` | `simplePublishReadiness.ts:637,640` (`runWideBlockingHard`, `runWideUnassigned`) | run-wide HARD + unresolved sessions |
| Selected term `2 Must fix` | `simplePublishReadiness.ts:632` (`selectedTermBlockingHard`) | allowlisted HARD in the **selected term** |
| Blocker group `No allowed time slot was found · 10 sessions affected` + `Show 7 more` | `simplePublishReadiness.ts:606-619` + `SimplePublishReadinessSheet.tsx:94,148` | the `unassignedItems`/resource-diagnostic population, capped at 3 visible |

The blocker-group list is built from `buildItemsFromUnassigned` / `buildItemsFromResourceDiagnostics`
(`simplePublishReadiness.ts:471-510,592-604`), which is a **different set** from the HARD
violations the header counts. So the group count legitimately differs from the header count —
but nothing on screen says so, and 7 of the group's 10 items are behind a disclosure the operator
must click to discover, on the one list that blocks publishing.

### What to build

**S1a — must-fix items are never behind a disclosure.**
`BlockerGroupRow` in `SimplePublishReadinessSheet.tsx` currently renders
`group.items.slice(0, 3)` plus `Show ${group.items.length - 3} more`. Remove the slice for
blocker groups: render **every** item. Keep the disclosure exactly as it is for
`WarningGroupRow` — warnings are reviewable and do not block, and the packet says nothing about
them here.

**S1b — every must-fix item carries its own fix button.**
Each item row gets the group's `actionLabel` as a real control, dispatching the same
`onNavigate(href, reason, group.count)` the group header already uses, plus the item's own
identity so the repair deep-link resolves to *that* item. `resolveRepairIdentity`
(`SimplePublishReadinessSheet.tsx:63-90`) currently resolves identity from the **first**
unassigned item or the **first** matching violation — extend it to accept the specific item, so
a row's button carries that row's `sectionId`/`subjectId`/`facultyId`.

Per AGENTS.md and the operator rule: the button must look clickable — a visible border or fill,
a verb in the label, pointer cursor, hover and focus states. Reuse `@/ui/button` with the
`variant="outline"` `size="sm"` `h-11` treatment the group header already uses. Do not invent
a page-local variant (AGENTS.md §8 One look per control).

**S1c — every count says what it covers.**
The header chip is a two-row-budget surface; do **not** grow it and do not add a band to it.
Instead, in the Publish Readiness sheet:

- the scope block (`SimplePublishReadinessSheet.tsx:243-256`) already distinguishes run-wide
  from selected term — keep that and keep it correct;
- each blocker group's count line must state the population and the scope it counts, in the
  existing `<Badge data-testid="timetable-simple-blocker-scope">` slot
  (`SimplePublishReadinessSheet.tsx:108-110`) plus a short clause. Use the existing
  `plainScopeLabel(scope)` and the shared `CLASS_NOUN` / `classesNeedingTime` vocabulary from
  `lib/timetable-plain-language.ts`. No new nouns.
- `blockerGroups` is a **rendering list** (the comment at `simplePublishReadiness.ts:621-624`
  says so). Do not change which numbers feed `hasBlockers`, `runWideBlockingHard` or
  `runWideUnassigned` — those are the publication gate and A2-C7 owns them. You are labelling
  and completing the list, not re-deriving the gate.

**S1d — `Show N more` for must-fix is gone; a warning disclosure is not.**
Add a control row asserting no `timetable-simple-blocker-expand`-shaped disclosure exists for
blocker groups. Keep the existing warning expand testid `timetable-simple-warning-expand`.

---

## 4. Slice 2 — every warning row names its real section and subject (packet item 2)

### The defect

`simplePublishReadiness.ts:528-529` and `:556-557`:

```ts
sectionLabel: v.entities.sectionId != null ? sectionLabel(v.entities.sectionId) : 'Unknown section',
subjectLabel: v.entities.subjectId != null ? subjectLabel(v.entities.subjectId) : 'Unknown subject',
```

`buildSectionLabel` / `buildSubjectLabel` (`lib/timetable-reference-labels.ts:28,61`) resolve
by the real numeric primary key and never return `Unknown section`. So the literal
`Unknown section · Unknown subject` on screen means one thing only: **the violation carries no
`sectionId` and no `subjectId` at all.**

`atlas-server/src/services/constraint-validator.ts` emits exactly that shape for several
codes — `entities: { facultyId, day, entryIds }` with no section/subject (lines 824, 1009,
1018, 1040, 1073, 1179, 1194, 1246). The client has the evidence anyway: `Violation.entities.entryIds`
names the run's entries, and the draft's `entries` carry `sectionId` and `subjectId`.

### What to build

**S2a — resolve section and subject from the violation's own entries.**
Where the violation has no `sectionId`/`subjectId`, resolve them from `entities.entryIds`
against the run's entries. The readiness derivation already receives `draft` (whose `.entries`
is the run's entry set) in `deriveSimplePublishReadiness` (`simplePublishReadiness.ts:579`);
thread it into `buildItemsFromViolations` and `buildWarningGroups`. When several entries
disagree, take the first in `entryIds` order and say nothing false — a row that names one real
class of a conflict is better than a row that names neither.

**S2b — the fallback must be honest and rare.**
After S2a, when nothing resolves, keep an honest fallback — but make it say what is missing in
the operator's words, not the string `Unknown`. Suggested: `No section on this record` /
`No subject on this record`. Do not print a raw id (§ AGENTS.md P4, and A3 c16 owns
no-codes-on-screen).

Apply the same treatment in `simple/SimpleTaskDrawerHelpers.tsx:126-127`, which has the same
`'Unknown section'` / `'Unknown subject'` literals.

**S2c — proof.**
A control that fails when the fallback fires and passes when `entryIds` resolution works, built
from a violation shaped exactly like the ones `constraint-validator.ts` emits.

**Id-space caution (A2 c15 overlap):** c15 owns the grade/identity authority and is changing
`useTimetableLookupHelpers.ts` in parallel. You must not depend on any grade reading. Take
`sectionId`/`subjectId` from the entry record and render whatever `sectionLabel(id)` /
`subjectLabel(id)` already return. If a label still reads `Section #<n>`, that is c15's or
A3 c16's surface, not yours — record it as a follow-up row, do not fix it here.

---

## 5. Slice 3 — a move must always have a target (packet item 3)

### The defect

`legalMoveTargets` (`timetableMoveTargets.ts:68-84`) excludes any slot occupied by another
entry. When a section has a class in every period, the list is empty, so
`describeMoveTargets` returns `{ kind: 'none', sentence: NO_LEGAL_TARGET_IN_VIEW }` and
`TimetableMoveStatusLine.tsx:60-71` renders one sentence plus a Cancel. The operator is stuck
with no route forward, and `ManualEditPanel`'s Target Time Slot select
(`ManualEditPanel.tsx:500-511`) strikes through every option and appends ` (occupied)` to each,
with a helper line explaining only why they are struck.

A swap already exists as a first-class workflow (`Swap with another class`,
`timetableSwapArming.ts`, `TimetablePlacementDialogs`), and `findRegularSwapCandidate`
(`lib/timetable-swap-routing.ts:96-119`) already encodes which occupant is a legal swap
partner: same section, same teacher or same room, same term. The move surfaces simply never
offer it.

### What to build

**S3a — one derivation of the move offer, three consumers.**
In `timetableMoveTargets.ts`, extend the derivation so that when there are no free targets it
also computes the **swap offers** for occupied slots in view, using the same overlap and
term rules. Export a shape that carries, per offer: the target slot, the occupant's
`subjectLabel`, the occupant's `teacherLabel`, and whether the swap is allowed or why not.

Do **not** re-implement the partner rule. Reuse `findRegularSwapCandidate` from
`lib/timetable-swap-routing.ts` for partner selection and keep
`timetableMoveTargets.ts` as the single owner of "which slots are legal targets in this view".
If you need a per-slot allow/deny reason rather than a single best partner, extend
`findRegularSwapCandidate` additively — do not fork its scoring.

**S3b — the status line offers the swap.**
When `kind === 'none'` and at least one swap is allowed, the status line must show the offers
as real, focusable controls labelled `Swap with <subject> (<teacher>)`, and say plainly in one
line which swaps are allowed and which are not. When no move and no swap is possible, one line
says why — naming the reason (special-event row only, no free slot, or no legal swap partner),
not the current flat sentence.

Keep the Cancel in both cases (`timetable-move-no-target-cancel` stays reachable in every
state that arms a move).

**S3c — the Timeslot menu offers it too.**
`ManualEditPanel.tsx:500-516`: for each occupied slot, the option must state who is there and
that it is a swap, not just ` (occupied)`. Keep the `@/ui` `Select` primitives and
`SearchableSelect`; no native `<select>`. The helper sentence under the select (`:513-516`)
must go or be rewritten — AGENTS.md §8 forbids a helper sentence under a button, and after S3a
it is no longer true.

**S3d — grammar and length.**
The label is `Swap with <subject> (<teacher>)`. Where the teacher is unassigned, drop the
parenthetical rather than print `Unassigned` twice. No ellipsis in the label (§8). Buttons at
`h-11`, ≥ 32px target (§ walk standard MINOR floor).

---

## 6. Slice 4 — the preview speaks plain words (packet item 4)

### The defect

Three separate leaks in the preview path:

1. **No "checking" state.** `ManualEditPanel.tsx:677-691` renders a spinner inside the Preview
   button and nothing else. There is no `Checking this change…` anywhere in the client.
2. **Raw engine codes.** `atlas-server/src/services/manual-edit.service.ts:919`
   `const title = VIOLATION_TITLES[v.code] ?? v.code;` — `VIOLATION_TITLES` (`:867-884`) has no
   entry for `SECTION_TIME_CONFLICT`, `ROOM_CAPACITY_EXCEEDED`, `UNASSIGNED_SECTION` or
   `INCOMPLETE_MODULAR_GROUP`, so the raw code is what renders.
3. **Raw invariant text.** `manual-edit.service.ts:451`
   `message: \`Manual candidate ${entry.entryId} rejected by shared invariant: ${reason}.\``
   reaches the operator as `humanDetail`, because `buildHumanConflicts` falls back to
   `v.message` (`:920`) for any code without a `case`.

Plus: soft warnings render one card per violation (`ManualEditPanel.tsx:826-847`) — 525 rows
on the operator's drill.

### What to build

**S4a — "Checking this change…" at once.**
The instant a preview starts, show `Checking this change…` in the Conflict Inspector, before
the await resolves. Render it in the same place the results appear, so the operator's eye does
not move. `previewLoading` already exists as a prop.

**S4b — never a raw code, never the engine sentence.**
In `buildHumanConflicts` (`manual-edit.service.ts`):

- extend `VIOLATION_TITLES` so every code the manual-edit path can emit has a plain title.
  Reuse the wording already approved on the client in
  `simple/SimpleTaskDrawerHelpers.tsx:59-71` (`HARD_VIOLATION_GROUP_MAP`) so the preview and
  Publish Readiness cannot drift — one idea, one name.
- the fallback for an unmapped code must be a plain sentence, never `v.code`.
- the manual-candidate invariant message must be composed for the operator, or suppressed in
  favour of the mapped title + the invariant reason rendered in words. The literal string
  `rejected by shared invariant` and the raw entry id must be unreachable from any rendered
  human conflict.

**S4c — blockers first, deduplicated, in plain words.**
In the Conflict Inspector, render HARD conflicts before SOFT, deduplicated by
`(code, humanTitle, humanDetail)` so the same blocker reported for ten sections appears once
with a count. The packet's example sentence is the shape:
`Mr Cruz already teaches 8-Luna at that time`. `buildHumanConflicts:934-939` already produces
that sentence for `FACULTY_TIME_CONFLICT` — the leak is the codes it does not handle.

**S4d — soft warnings summarised by cause with counts.**
Group SOFT conflicts by cause (code + title) and render one line per cause with its count and
its plain next step, instead of one card per violation. At 525 rows the per-row card list is
the defect; a per-cause summary is the fix. Keep the full list reachable behind a disclosure
if you judge it needed — but the summary line must come first and must carry the count.

**S4e — proof that the codes are unreachable.**
A control that renders a real preview containing every code the manual-edit path can emit and
asserts that no rendered text matches `/SECTION_TIME_CONFLICT|rejected by shared invariant|Manual candidate/`.
This is a rendered assertion on the real component, not a source-text assertion.

---

## 7. Slice 5 — a receipt after every committed change (packet item 5)

### The defect

After a committed move, `useScheduleReviewWorkspaceState.ts:2035-2040` (and the parallel path
at `:1909-1913`) sets:

```
Moved to MONDAY 07:00–08:00. Undo below.
```

It does not say **which class**, where it came **from**, or whether the change made anything
worse. The soft-warning branch says `Move applied with N soft warning(s).` — a count, not a
sentence. The Schedule history dialog (`TimetableAssignmentDialogs.tsx:139-260`) renders a
Badge of the edit type, a timestamp, `Changed by a signed-in account. This record does not show
which person.`, and (for swap auto-fix only) `describeEditAutoMoveNamed`. The two surfaces do
not use the same words, and the history row names no class either.

The walk standard's receipts rule: *what was done, how many, what was not done and why, and the
next step.* A missing or vague receipt on a primary path is MAJOR.

### What to build

**S5a — ONE derivation of the receipt sentence.**
New file `atlas-client/src/lib/timetable-edit-receipt.ts`. Pure function(s), no React, no fetch.

Input: the committed edit (`editType`), the resolved class label, the from-slot and to-slot, and
the resulting problem counts. Output: the receipt sentence and, separately, the short form for
history.

Target shape, from the packet:

> `Moved TLE for 7-Rizal from Mon 6:00 to Tue 7:30. No new problems.`

Rules:
- name the **class** (subject) and the **section** when both resolve;
- `from` and `to` in `Mon 6:00` form — short day, no seconds, no raw `MONDAY`;
- the problem clause is plain and always present: `No new problems.` /
  `1 new problem: Mr Cruz already teaches 8-Luna at that time.` /
  `2 problems now; 1 was already there.` (state the delta honestly);
- no ellipsis, no truncation, no raw code, no raw id.

Derive from the **committed** record, not from the optimistic proposal, so the sentence cannot
describe a change that did not land.

**S5b — the inline status uses it.**
Replace both move-receipt messages (`useScheduleReviewWorkspaceState.ts:1909-1913` and
`:2035-2040`) with the receipt. Also cover the swap path (`:1976-1979` in
`useTimetableMutations.ts` → `:1976-1990`) and the place path, so **every** committed
move/swap/place produces the same kind of receipt. Name each path you covered and each you did
not, in the handoff.

**S5c — Schedule history uses the same words.**
`TimetableAssignmentDialogs.tsx` history rows must carry the same sentence (or its short form),
derived from the same module. The row may keep its type Badge — the receipt is additive beside
it, never in place of it (AGENTS.md §16, and the C11 T2 precedent at `:221-231`).

Do not remove `Changed by a signed-in account. This record does not show which person.` — the
actor-name gap is an owed server follow-up (see the comment at `:202-212`), not this slice's
to close.

**S5d — the toast must not double-speak.**
`useTimetableMutations.ts:1095-1099` already suppresses toasts for `MOVE_ENTRY` and
`PLACE_UNASSIGNED`. If a receipt now renders on the page for those paths, keep the suppression
for every path the receipt covers, so the operator reads one sentence, not two.

---

## 8. Gates you must run, and the rows each one decides

Run in this order. Record the **literal command** and the **actual tally** in the handoff. A
row without its real number is not evidence.

| # | Gate | Command (from `atlas-client/`) | Decides |
|---|---|---|---|
| G1 | Your new tests | `npm run test:ux-a2-mc-manual-controls` | S1a-d, S2a-c, S3a-d, S4a-e, S5a-d |
| G2 | Readiness + warning surfaces preserved | `npx tsx --max-old-space-size=6144 --test src/lib/__tests__/timetable-operator-workflow-state.test.ts src/lib/__tests__/tt-warning-surface-realism-c07b.test.ts` | S1, S2 |
| G3 | Move/swap preserved | `npx tsx --test src/lib/__tests__/departure-swap-demo-c04.test.ts src/components/timetable/__tests__/timetable-swap-custody-a2.test.tsx` | S3 |
| G4 | Edit-history + undo preserved | `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/timetable-edit-history-truth-a2.test.tsx src/components/timetable/__tests__/timetable-edit-history-undone-a2.test.tsx src/components/timetable/__tests__/timetable-undo-single-surface-a2.test.tsx` | S5 |
| G5 | Manual edit + draft actions | `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/a2-c11-draft-actions.test.tsx src/components/timetable/__tests__/a2-c11-draft-actions-correction.test.tsx src/lib/__tests__/a2-c12-entity-index-p1.test.ts` | S3, S4, §2 extraction |
| G6 | Header + plain language | `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/a2-header-budget-2026-09-29.test.tsx src/lib/__tests__/plain-language-j2j3-c01.test.ts` | S1c, §8 one-look |
| G7 | Full client suite | `npm run test:client-suite` | blast radius |
| G8 | Type check | `npx tsc --noEmit -p tsconfig.json` | compile |
| G9 | Encoding | `npm run test:encoding` (repo root) | AGENTS.md operator rule |
| G10 | Server type check | `npx tsc --noEmit` (from `atlas-server/`) | S4b |

**Baseline first.** Run G7 and G8 on the **base commit** in a second throwaway worktree (or
`git stash`-free: `git worktree add --detach` a second path at `c57b8e1d`, `npm ci` there only
if the gates fail to run without it). Report base tallies beside candidate tallies and name
every failure that is **byte-identical at base** as pre-existing. Never absorb a pre-existing
failure silently and never delete or edit an existing failing row to make a gate green
(AGENTS.md §16) — mark it **SUPERSEDED in place** with its original assertion retained and your
replacement beside it.

**The §8 cap is a gate row.** State the physical line count of every file you touched.

---

## 9. Test wiring — non-negotiable

A test no gate runs is not evidence (AGENTS.md §11). In the **same commit** that adds your test
files, add one script line to `atlas-client/package.json`:

```json
"test:ux-a2-mc-manual-controls": "tsx --max-old-space-size=6144 --test <your test files, space separated>"
```

Use `--max-old-space-size=6144` for any `.tsx` render test — A2 c12's OOM incident
(`live-state.md`, 2026-09-29) is why. Assert in your own suite that `package.json` names every
file you created, so the wiring cannot rot.

`atlas-client/package.json` is touched by c15 and c17 too. **Add your line; do not reorder,
reformat or resolve anybody else's line.** An integration merge will union it.

---

## 10. Failing-first discipline

Each slice needs at least one control that **fails on the base behaviour** and passes on your
change. Prove it: run the control against the base file (`git stash` is forbidden — instead
`git show c57b8e1d:<path> > $env:TEMP/<name>.base.tsx` into a temp harness, or temporarily
revert the one hunk in place and restore it byte-exact). Record what the control printed on base.

Never leave a mutated file behind. `git status --short` must show only your intended changes.

---

## 11. Design judgement gate (AGENTS.md §11, operator 2026-09-29)

Before you report, and before you claim done:

1. **Subtract first.** A change may not add visible words, chips, lines or controls to a region
   without removing at least as much. Concretely: you are deleting 7 hidden must-fix items'
   worth of disclosure, a helper sentence under a select, and raw engine strings. Say what you
   removed beside what you added. If you added a band anywhere, justify it.
2. **Nothing cramped.** No new row in the header (two-row budget, §8). No new band in the
   grid. The status line and the Conflict Inspector already exist — extend them.
3. **One look per control.** `@/ui` primitives only. Same trigger size, border, placeholder
   and search behaviour as Teaching Load. No page-local `className` override that changes a
   primitive's look.
4. **Clickable must look clickable.** Every new control: visible shape, verb or chevron in the
   label, `cursor-pointer`, hover **and** focus states. A bare text link that opens something is
   a defect.
5. **Read-only must not look pressable.** A plain count must not wear button chrome.
6. **One status per fact.** Do not print the same count twice in a row.

You cannot discharge this gate with a unit test. Write the layout note in your handoff: what
stays, what goes, what moved behind a Tooltip, `More` or a detail.

---

## 12. Handoff — one page, this exact shape

```
A2 mc — timetable manual controls speak plainly — REVIEW_REQUIRED
Base            c57b8e1d
Candidate       <your sha>
Worktree        E:/ATLAS-worktrees/lane-a2-mc-manual-controls (clean)
Changed paths   <git diff --name-only c57b8e1d..<candidate>>

SLICES
  S1 one count, one list          DONE / PARTIAL / NOT DONE — <one line of evidence>
  S2 real section + subject       DONE / PARTIAL / NOT DONE — <one line>
  S3 a move always has a target   DONE / PARTIAL / NOT DONE — <one line>
  S4 plain-words preview          DONE / PARTIAL / NOT DONE — <one line>
  S5 receipt after every change   DONE / PARTIAL / NOT DONE — <one line>

FILE SIZES (§8, cap 1000)
  <path> <n>
  <path> <n>

GATES  (literal command — actual tally — base tally)
  G1 …  G2 …  G3 …  G4 …  G5 …  G6 …  G7 …  G8 …  G9 …  G10 …

FAILING-FIRST  <control> printed <literal> on base c57b8e1d
PRE-EXISTING FAILURES  <id> — byte-identical at base, owner <lane>, not absorbed

DESIGN NOTE  what stays / what goes / what moved behind More·Tooltip·detail; what was removed

NOT DONE, dated 2026-09-29  <every row, with its reason>
NEXT ACTION  <one thing, and who owns it>
```

Claim nothing you did not run. "0 fixes live and seen" is the honest count for this slice: it is
source only, and **you have not deployed and must not** (AGENTS.md §14 — A4 deploys).

---

## 13. Hard boundaries

- No deploy, no build for release, no supervisor, task or environment change.
- No generation, no publication, no migration, no live-data or shared-database write.
- No browser session against live. Staging screenshots are the planner's job, not yours.
- Never open, read or echo `D:\ATLAS-runtime-config\atlas-server.env`.
- Never write in `D:\ATLAS`.
- Commit and push `wip(...)` to `work/a2-mc-manual-controls` at least every 30 minutes and
  before any long step.
