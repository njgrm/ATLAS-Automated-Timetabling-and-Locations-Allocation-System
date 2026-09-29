# A2 mc — correction R2: the receipt tells the truth, and items 6–9

Worktree `E:/ATLAS-worktrees/lane-a2-mc-manual-controls`, branch `work/a2-mc-manual-controls`.
Merge-base for this correction: `4c59b3c1` (this branch with `origin/main` merged in — train 11
is live, A2 c18 and A7 c10 have landed). Prior candidate `d2abf1f2`.

**This is correction round 2 of at most 2** (AGENTS.md §11 throughput). After this round the
planner either ships or records the remainder as dated follow-up rows. Make it count.

Independent QA verdict on `c57b8e1d..d2abf1f2`: **`CORRECTION_REQUIRED`, 35 passed / 45 total,
0 blocked, 1 unperformed.** Four BLOCKING findings. Three are ordinary source defects in code
this lane wrote. One is a planner scope return.

Read first, in full:
- `docs/prompts/a2-timetable-manual-controls-2026-09-29.md` — the requester's own words. **It now
  has NINE items.** Items 6–9 and the operator's 21:50 addendum were appended to it AFTER this
  lane's base commit. That is B4, and it is on the planner, not on you.
- `docs/prompts/a2-mc-manual-controls-impl-2026-09-29.md` — what you were told to build (items 1–5).
- `docs/plans/codex-walk-standard.md`, and `AGENTS.md` at the repo root.

---

## 1. B1 — BLOCKING — the receipt states a false delta

`atlas-client/src/lib/timetable-edit-receipt.ts:149-164`, `receiptProblemClause`.

There is no `before < now` branch. The `before >= now` branch exists; the one case where the
edit **created** problems falls through to `` return `${now} new ${pluralProblemWord(now)}.` ``.

QA executed the module on the operator's own drill data (525 soft warnings, 6 must-fix already
on the run) and got:

```
move ADDS 5 problems (525 soft + 6 hard already there) -> "531 new problems."
```

Every committed move/swap/place receipt on that run claims all 531 problems are new. Five are.
The module's own doc comment promises it "states the TOTAL now and the DELTA", and the packet
says: *"`2 problems now; 1 was already there.` (state the delta honestly)"*. A receipt that
inflates its own count is worse than no receipt: the operator learns to distrust it.

The test at `a2-mc-edit-receipt.test.ts:109` is titled "states the DELTA honestly" and covers
`now:0`, `now:2 before:3`, `now:2` (no `before`), and `null` — never `before < now`. The green
gate did not cover the case that matters.

**Fix:** when `before` is a finite number, derive `added = now - before` and use `added` in the
count — in every branch, not only the one that exists today. `now` is the run total, not the
number of new problems; conflating them is the defect. Keep the existing `before >= now` wording
(`2 problems now; 1 was already there.`) and extend the same honesty to the added case
(`5 new problems: <first, in words>.` and, when nothing else resolves, `5 new problems.`).

**Proof:** add the `before < now` case to the EXISTING S5b test — no new test file. The new
assertion must fail against `d2abf1f2`'s `receiptProblemClause` and pass after your fix. Record
both literal outputs.

## 2. B2 — BLOCKING — the receipt names a category, not the problem

`atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts:1941` and `:2083`:

```ts
firstNewSentence: scopedPreview.humanConflicts.find((c) => c.severity === 'HARD')?.humanTitle ?? null,
```

`humanTitle` for `FACULTY_TIME_CONFLICT` is `"Teacher double-booked"`. The packet's own example
sentence is `"Mr Cruz already teaches 8-Luna at that time."` — that is `humanDetail`, and
`buildHumanConflicts` already produces it (`manual-edit.service.ts:934-939`). A title tells the
operator a category; a detail tells them what to do.

**Fix:** pass `humanDetail`, scrubbed through the existing `plainConflictDetail` if that is the
scrub the preview path already uses — read `lib/manual-edit-conflict-summary.ts` first and reuse
its scrubber rather than writing a second one. Two tokens at two sites.

**Proof:** one rendered assertion that a receipt naming a teacher conflict carries the teacher's
name and the section, not the string `Teacher double-booked`. Fail on `d2abf1f2`.

## 3. B3 — BLOCKING — the history row asserts two destinations for one class

`atlas-client/src/lib/timetable-edit-receipt-record.ts:63-65`. For `SWAP_ENTRIES` the history
row composes `to` from `before.entryB`. That is the true destination only for a clean exchange.
`timetable-edit-history-truth.ts:136-166` shows an `AUTO_FIX_MOVE_*` swap relocated A to
`after.entryA` — and `TimetableAssignmentDialogs.tsx:167-170` renders `Also moved <A> to
<afterA>` on that very row. So the row states two different destinations for the same class.

**Fix:** prefer `after.entryA` / `after.entryB` when the payload carries them, and suppress the
receipt clause entirely on a row where `describeEditAutoMoveNamed` already renders a destination
— one change, one sentence about where a class went. (AGENTS.md §16: this is additive; do not
delete the existing auto-move sentence.)

**Proof:** one rendered assertion on a `SWAP_ENTRIES` row with an auto-fix payload, asserting the
two rendered destinations agree.

## 4. B4 — items 6, 7, 8, 9 — the operator named these for this lane

The 20:38 addendum names them **BLOCKERs for the demo**, and the 21:50 operator addendum says
this lane fixes behaviour: *"swap stall, lock, place, preview speed, readiness counts from one
source"*.

QA verified zero lines in the range match `Lock this class`, `No free time`, `double-books`, or
`Locked classes kept`. Item 6's own named surface — `TimetablePlacementDialogs.tsx:735`,
`"Checking options..."` with Swap disabled — is untouched.

**Do all four. They are behaviour, and behaviour is exactly this lane's job.**

### 4a — Item 6: the swap stall (the demo blocker)

More > Swap sessions; pick TLE (7-Rizal, Mon 6:00) and SCIENCE (same section, Mon 8:15). The
dialog sits on `"Checking options..."` with Swap disabled indefinitely.

The client path is `openRegularSwapPrompt` in `atlas-client/src/hooks/useTimetableMutations.ts`
(now around `:1504` after the merge). It sets `regularSwapPreview` to `loading: true`, POSTs
`${apiBase}/swap/preview`, and clears `loading` in both the success and the `catch` branch.

**Diagnose before you fix.** Establish which of these it is, with evidence:
1. the request never resolves or is very slow server-side; or
2. the request rejects in a way the `catch` does not convert; or
3. the request resolves and the response is shape-mismatched, so the UI stays in its loading
   state.

A UI timeout alone is a band-aid. If the cause is server-side slowness on
`POST .../manual-edits/swap/preview` (`atlas-server/src/routes/manual-edit.router.ts:281`), then
that route's service is the fix and it is a **server performance** change, not a presentation
one. Find the truth and report it. If you cannot establish the cause from source, say so plainly
and implement the honest-user-visible half only: a bounded wait that then says in plain words why
the options are not ready, instead of a spinner that never resolves.

Requirements either way: a swap of two classes of the same section **answers within a few
seconds or says plainly why not**; then saves; **Undo and Redo work**; and **Schedule history
lists it**. The receipt for the swap must come from `timetable-edit-receipt.ts` like every other
committed change (item 5) — one vocabulary, not two.

### 4b — Item 7: Lock/pin is not reachable

Make `Lock this class` visible from the normal selected-class actions on `/timetable`; show
what a locked class looks like; and show that Generate keeps it (`Locked classes kept 1`).

**Read the 21:50 addendum as a hard boundary:** *"A2 mc ... adds NO control, banner or sentence
to the header."* The selected-class action strip and the More menu are **not** the header — the
`Lock this class` action belongs beside the other selected-class actions
(`ScheduleReviewWorkspace.tsx`, the selection strip / More dropdown), exactly where `Choose a new
time`, `Change room` and `Swap with another class` already live. Put it there. If you find
yourself editing `TimetableSimpleHeader.tsx` or any header file, you are in the wrong place —
**stop and report**.

**Note the orphan:** `atlas-client/src/components/LockPanel.tsx` is not imported by anything —
A2 c18 proved that on 2026-09-29 and fixed its raw ids. The real lock surface is
`TimetablePlacementDialogs.tsx` / `RightPanel.tsx` / `useScheduleReviewWorkspaceState.ts`. Do not
wire the orphaned component; find the lock action that actually exists and surface it. If the
lock capability does not exist server-side, say so in your handoff rather than building a
disabled button — a control that cannot act is the defect class this whole slice is about.

### 4c — Item 8: Place session says nothing

Placing an unplaced class offered no candidate and no words. It must say
`No free time: every time double-books <teacher> or <room>` in those words, and offer the nearest
swap. Reuse the swap-offer derivation from item 3 (`timetableMoveTargets.ts`) rather than
writing a second one, and reuse the receipt module for the committed result.

### 4d — Item 9: Print from Room Schedules

`Print this schedule` did not open a print view within the wait; check it opens promptly.
`atlas-client/src/lib/scheduler-print-requests.ts` and the Room Schedules print path. If the cause
is outside every file this lane may touch, say exactly which file and route, and record it as a
follow-up row — do not widen your ownership to force a green.

---

## 5. Non-blocking findings you may fix cheaply — your judgement

QA listed these. Fix any that is a small, safe, clearly-right change in a file you already own;
record the rest as dated follow-up rows. Do not let a polish item grow the change.

- `SimplePublishReadinessSheet.tsx:154` — **one count, two nouns**: `10 sessions affected — classes
  with no time yet in this list`, beside the banner's `10 classes needing a time` and the scope
  block's `10 sessions still to place`. `CLASS_NOUN` in `timetable-plain-language.ts` says
  "Nothing user-facing says 'session'". This is the most likely thing to look wrong on screen.
- `SimplePublishReadinessSheet.tsx:176-206` — 11 identical `Place manually` buttons (group header
  + 10 items). The group-header button is now redundant; a subtraction was available and not taken.
- `SimplePublishReadinessSheet.tsx:152` — a `<p>` wraps a `<Badge>` `<div>`, which React reports as
  invalid DOM nesting (a hydration error). The slice's added `<span>` sits inside it.
- `TimetableMoveStatusLine.tsx:137` — the blocked row reads `Swap with FIL (Mr Luna) — not
  allowed: …`: it leads with the imperative and then refuses. Lead with the reason.
- `ManualEditPanel.tsx:571` — page-local `text-amber-700` on a `@/ui` `SelectItem`. This one is
  **§8 "one look per control"** and QA marked it a FAIL row; fix it or justify it explicitly.
- `ManualEditConflictInspector.tsx` — the soft-cause summary prints one unlabelled example detail
  that reads as *the* problem rather than an example; and `This change adds 1 blocking conflict
  and adds 5 warnings.` uses the same verb twice.
- Server `VIOLATION_TITLES` has no committed test pinning its completeness. The fail-safe holds
  (`plainViolationTitle` → `UNNAMED_RULE_TITLE`), so no raw code can reach a consumer, but nothing
  stops a future code being added without a title.
- `ScheduleReviewWorkspace.tsx:47-52` — the rewritten A2 C13 block dropped the clause "§8 says
  EXTRACT, **never delete a comment**" and states "stood at 995 physical lines" when the file was
  at **963** at both base and candidate. Correct the record; a comment that misstates the history
  is a defect.

---

## 6. Ownership for this round

Your previous ownership list still stands (impl packet §1), **plus**:

- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx` (item 6's named
  surface, item 8's place surface)
- `atlas-client/src/components/timetable/CenterWorkspacePaneSurface.tsx` — **only** if item 7's
  action placement genuinely requires it, and only after checking A2 c17 owns it. **If c17 owns
  it, you may not edit it** — report the conflict instead.
- `atlas-client/src/lib/timetable-edit-receipt.ts`, `timetable-edit-receipt-record.ts` (B1, B3)
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts` (B2)
- the server service behind `POST .../manual-edits/swap/preview` **only if** 4a's diagnosis proves
  the cause is server-side. That file is `atlas-server/src/services/manual-edit.service.ts`, which
  you already own for the presentation change. No other server file.

Still NOT yours: `atlas-client/src/types.ts` (A2 c15), `lib/schedule-review-helpers.ts`,
`pages/Sections.tsx`, `components/faculty/**`, `components/faculty-assignments/**`,
`CenterWorkspacePaneSurface.tsx` if c17 owns it, `lib/preference-adherence.ts`,
`preference-adherence.service.ts`, `generation.router.ts`, `atlas-server/src/services/generation*.ts`,
`constraint-validator.ts`, `schedule-constructor.ts`, `section*.ts`, and any header file
(`TimetableSimpleHeader.tsx`, `ScheduleReviewWorkspaceHeader.tsx`, `simple/SimpleHeaderHelpers.tsx`,
`simple/SimpleMoreMenuContent.tsx`) — A7 c10 owns the header's wording now.

Verify before you touch `CenterWorkspacePaneSurface.tsx`:

```
git diff --name-only 4c59b3c1 origin/work/a2-c17-preferences-kept | Select-String CenterWorkspacePaneSurface
```

If it prints, that file is c17's — do not edit it.

---

## 7. Gates

Re-run all of these and report the literal command with the actual tally, beside the tally at
`d2abf1f2` **and** beside a fresh `origin/main` (`4c59b3c1`) baseline where the count moved:

| Gate | Command (from `atlas-client/`) |
|---|---|
| G1 | `npm run test:ux-a2-mc-manual-controls` |
| G3 | `npx tsx --test src/lib/__tests__/departure-swap-demo-c04.test.ts src/components/timetable/__tests__/timetable-swap-custody-a2.test.tsx` |
| G5 | `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/a2-c11-draft-actions.test.tsx src/components/timetable/__tests__/a2-c11-draft-actions-correction.test.tsx src/lib/__tests__/a2-c12-entity-index-p1.test.ts` |
| G7 | `npm run test:client-suite` — the suite list itself changed on `main`; report the new totals and compare failure SETS element-by-element, not just counts |
| G8 | `npx tsc --noEmit -p tsconfig.json` |
| G9 | `npm run test:encoding` (repo root) |
| G10 | `npx tsc --noEmit` (from `atlas-server/`) — run it detached with a log; it exceeds 2 min |
| G-new | `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/timetable-relaxed-main-b02.test.tsx` (the B5 repo-wide cap guard) |

**Known pre-existing failures — do NOT absorb, do NOT delete, do NOT edit to go green.** Mark any
row you supersede **in place** with its original assertion retained and your replacement beside it
(AGENTS.md §16). Carry these forward unchanged unless you can prove base parity:
`timetable-operator-workflow-state` 1 fail · `tt-warning-surface-realism-c07b` 2 fails ·
`a2-header-budget-2026-09-29` 2 fails · `a2-c11-draft-actions` 1 fail ·
`timetable-truth-labels-a2` 1 tsc error.

**`git stash`, `git checkout --`, `git reset --hard` and `git clean` are FORBIDDEN.** Use
`git show <rev>:<path>` into a temp harness (inside `src/` so `@/` resolves, deleted afterwards)
for base comparisons, restore byte-exact, and verify `git status --short`.

Any test file you add must be named in the ONE existing `test:ux-a2-mc-manual-controls` script
line. Do not add a second script line.

---

## 8. Handoff — this exact shape, nothing else

```
A2 mc R2 — the receipt tells the truth, and items 6–9 — REVIEW_REQUIRED
Merge-base     4c59b3c1   Prior candidate  d2abf1f2
Candidate      <your sha>  (additive commits; the merge is already committed)
Worktree       E:/ATLAS-worktrees/lane-a2-mc-manual-controls (clean, no stash)
Changed paths  <git diff --name-only 4c59b3c1..HEAD>

B1 false delta            RESOLVED / PARTIAL — base output → candidate output
B2 title vs detail        RESOLVED / PARTIAL — base output → candidate output
B3 two destinations       RESOLVED / PARTIAL — base output → candidate output
B4a item 6 swap stall     DONE / PARTIAL / NOT DONE — <THE DIAGNOSIS, in one line: which of the
                            three causes it is, with the evidence. This is the row I most want.>
B4b item 7 lock reachable DONE / PARTIAL / NOT DONE — <where the action now lives; confirm you
                            touched no header file>
B4c item 8 place words    DONE / PARTIAL / NOT DONE
B4d item 9 print          DONE / PARTIAL / NOT DONE — <if out of ownership, name file + route>

POLISH TAKEN   <which of the non-blocking findings you fixed>
FOLLOW-UP ROWS <the rest, dated 2026-09-29, owner named>
FILE SIZES     <every file touched>
GATES          G1 · G3 · G5 · G7 · G8 · G9 · G10 · G-new — literal command, actual tally,
               d2abf1f2 tally, origin/main tally
DESIGN NOTE    what was added to the screen, what was removed, and what it cost
NOT DONE, dated 2026-09-29
NEXT ACTION    one line
```

Claim only what you ran. **"0 fixes live and seen"** remains the honest count: source only, no
deploy, no browser session, no staging build, no database write, nothing generated or published.
The screenshots and `ux-audit.js` JSON the packet asks for are a **staging walk** and belong to
the planner and Lane C, not to you.

## 9. Hard boundaries (unchanged)

No deploy, no release build, no supervisor/task/env change, no generation, no publication, no
migration, no database write, no live or staging browser session, never read or echo
`D:\ATLAS-runtime-config\atlas-server.env`, never write in `D:\ATLAS`. Never start a foreground
server or watcher in a tool call. Commit and push a `wip(...)` checkpoint to
`work/a2-mc-manual-controls` at least every 30 minutes and before any long step. If you approach
a step limit: commit, push, and report what landed and what did not.
