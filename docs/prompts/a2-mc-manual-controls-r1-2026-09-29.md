# A2 mc — correction R1: wire the swap offers into the grid move path (B1)

Worktree `E:/ATLAS-worktrees/lane-a2-mc-manual-controls`, branch `work/a2-mc-manual-controls`.
Base `c57b8e1d`. Candidate under correction `c605df85`. Target train 11.

This is **correction round 1 of at most 2** (AGENTS.md §11 throughput). Read
`docs/prompts/a2-mc-manual-controls-impl-2026-09-29.md` §5 (slice 3) first — it is the
requirement this correction closes.

---

## 1. The one finding

**BLOCKING — packet item 3 is not true in production.** The derivation, the component, the label
grammar and the Cancel are all built and proven. The grid's only caller passes none of it:

`atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx:52-53`

```ts
type MoveOccupant = { entryId: string; day: string; startTime: string; endTime: string };
const toMoveOccupants = (es: Array<Record<string, unknown>>): MoveOccupant[] =>
	es.map((e) => ({ entryId: String(e.entryId), day: String(e.day), startTime: String(e.startTime), endTime: String(e.endTime) }));
```

and the `describeMoveTargets` call at `:310-316` passes `slots`, `occupants` and `movingEntry`
only. Therefore:

- `describeMoveSwapOffers` returns `[]` (it requires identity on the moving entry and the
  occupants — `hasSwapIdentity`, `timetableMoveTargets.ts:235`);
- `TimetableMoveStatusLine` therefore renders the reason sentence and the Cancel and **no offer
  at all**;
- `onSelectSwap` is never passed, so even an offer would render as plain words, not a control.

The operator on `/timetable` still gets the dead end the packet named. The ManualEditPanel path
(item 3's other half) is genuinely fixed — the `Select` at `ManualEditPanel.tsx:552-575` names
who is in each occupied period and whether the two can swap. **One half of item 3 ships, the
other does not.**

The executor was right to stop: `ScheduleReviewWorkspace.tsx` was not in its ownership list.

---

## 2. Ownership is now granted

You may edit **`atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`**, and only
that file, for this correction.

Verify first that no parallel lane has taken it:

```
git diff --name-only origin/main...origin/work/a2-c15-grade-identity | Select-String ScheduleReviewWorkspace
git diff --name-only origin/main...origin/work/a2-c17-preferences-kept | Select-String ScheduleReviewWorkspace
git diff --name-only origin/main...origin/work/a8-c5-generation-fixable | Select-String ScheduleReviewWorkspace
```

All three must print nothing. If any prints a path, STOP and report — do not edit.

**Hard limit: that file is 963 physical lines against AGENTS.md §8's 1000-line cap, with 37 lines
of headroom.** If your change does not fit inside those 37 lines, you must EXTRACT rather than
grow — the natural seam is the `toMoveOccupants` / occupant-type block itself, which belongs in
`timetableMoveTargets.ts` next to the derivation that consumes it. Report the final count.

---

## 3. What to change — one additive wiring change, four parts

### 3a — the occupant projection carries identity

`MoveOccupant` and `toMoveOccupants` must carry what `describeMoveSwapOffers` needs: `sectionId`,
`facultyId`, `roomId`, `termIndex`. Read `timetableMoveTargets.ts` for the exact field list and
its nullability before you write it — do not guess.

`movingEntry` must also carry identity. It is built at `:312-315` from `state.selectedEntry`,
which already has those fields.

Guard every conversion: these come off `draftEntries` typed `unknown`, so a missing field must
degrade to `null`/absent, never `NaN` and never `String(undefined)`.

### 3b — pass the two label resolvers

`describeMoveTargets` takes optional `subjectLabel` / `facultyLabel`; without both it produces no
offers at all (`if (input.subjectLabel && input.facultyLabel)`). The workspace already has both:
`state.subjectLabel` and `state.facultyLabel` (they are used at `:632` and `:675`). Pass them.

This is the change that makes the offers exist. Without it nothing below renders.

### 3c — pass `onSelectSwap` so the offers are real controls

`TimetableMoveStatusLine` renders offers as `<Button>` **only** when `onSelectSwap` is supplied;
otherwise it falls back to plain `<span>` text. The executor's own comment states the rule it
implemented: *a control that cannot do anything must not look like one.* So supply the handler.

It must arm the **existing** swap workflow, not invent one. `ScheduleReviewWorkspace.tsx` already
has, in scope: `openRegularSwapPrompt` (used at `:717` area and threaded through
`dialogContext`), `selectedEntry`, `captureReviewFocusReturn`, `state.setInlineActionStatus`, and
`state.setKbSelectedSource`. Follow the existing pattern at `useScheduleReviewWorkspaceState.ts:1975-1980`,
which is the same decision this path is making:

```ts
const swapCandidate = findRegularSwapCandidate(fakeItem.entry, slotEntries);
if (swapCandidate) { ... openRegularSwapPrompt(fakeItem.entry, swapCandidate); return; }
```

Set the status message to the same plain sentence that path uses —
`Review swap before saving. This occupied slot will exchange the two sessions.` — so the two
paths cannot drift into two vocabularies.

If, after reading the surrounding code, you conclude `openRegularSwapPrompt` cannot be reached
from here without threading new context through several files, STOP and report that as a narrower
blocked row naming the files. Do not fake the handler with a `console.log`, a `setTimeout`, or an
empty function — a button that lies is exactly the defect this slice exists to remove.

### 3d — disarm when an offer is taken

Choosing an offer must clear the armed move exactly as choosing a grid target does
(`state.setKbSelectedSource(null)`), so the operator is never left with an armed move and no
status line. The existing `onDisarm` at the `TimetableMoveStatusLine` call site is the model.

---

## 4. What you must NOT change

Everything the correction round already accepted is **frozen**. Do not touch:

- `timetableMoveTargets.ts` — unless and only unless 3a's projection genuinely belongs there for
  the §8 extraction. If you do, the derivation's exported behaviour must not change; only where
  the occupant *type* is declared.
- `TimetableMoveStatusLine.tsx` — the component is done. If you find a real defect in it, report
  it; do not patch it inside this correction.
- `simplePublishReadiness.ts`, `SimplePublishReadinessSheet.tsx`, `SimpleTaskDrawerHelpers.tsx`
  (S1/S2), `ManualEditPanel.tsx`, `ManualEditConflictInspector.tsx` (S3c/S4),
  `timetable-edit-receipt*.ts` and their callers (S5), `atlas-server/.../manual-edit.service.ts`
  (S4b).
- Any file owned by another lane. The full list is packet §1 and still stands.

---

## 5. Proof — failing-first is mandatory for this correction

Add to your existing `atlas-client/src/components/timetable/__tests__/a2-mc-move-swap-offers.test.tsx`
(or a sibling in the same directory, wired into the same `package.json` script — **do not add a
second script line**):

- **C1 (the load-bearing row).** Render the REAL `ScheduleReviewWorkspace` production wiring path —
  or, if a full mount is impractical, at minimum assert the three facts the caller supplies are
  now present and consumed: identity fields reach the derivation, both label resolvers are passed,
  and `onSelectSwap` is passed to the status line. Prefer the real mount; a source-text assertion
  is NOT acceptance evidence for a wiring claim (AGENTS.md §11, "Prove the outcome, not the
  wiring" — this row exists precisely because the wiring was wrong while every other gate passed).
- **C2 (discriminating).** With every slot occupied and one legal swap partner, the status line
  must render at least one `[data-testid="timetable-move-swap-offer"]` whose `data-swap-allowed`
  is `true` — a real `<button>`, not a span.
- **C3 (the negative).** With no legal partner, it renders `timetable-move-swap-blocked` text and
  **zero** `timetable-move-swap-offer` buttons.
- **C4 (no regression).** The Cancel testid `timetable-move-no-target-cancel` stays reachable in
  every no-target state, and `timetable-move-status-message` still renders exactly the `message`
  prop.

Run C1-C4 against the **base caller** and record what they printed. The honest expectation is
that C2 fails at `c605df85` with `0` offers, because that is the defect. Use
`git show c605df85:<path>` into a temp harness under `$env:TEMP` — `git stash`, `git checkout --`,
`git reset --hard` and `git clean` are forbidden. Restore byte-exact and verify `git status
--short`.

---

## 6. Gates

Re-run, and report the literal command with the actual tally beside the tally you already
recorded for `c605df85`:

| Gate | Command (from `atlas-client/`) |
|---|---|
| G1 | `npm run test:ux-a2-mc-manual-controls` |
| G3 | `npx tsx --test src/lib/__tests__/departure-swap-demo-c04.test.ts src/components/timetable/__tests__/timetable-swap-custody-a2.test.tsx` |
| G5 | `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/a2-c11-draft-actions.test.tsx src/components/timetable/__tests__/a2-c11-draft-actions-correction.test.tsx` |
| G7 | `npm run test:client-suite` |
| G8 | `npx tsc --noEmit -p tsconfig.json` |
| G-new | the repo-wide cap guard: `npx tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/timetable-relaxed-main-b02.test.tsx` (its B5 row walks every non-test `.tsx` under `src` and asserts none exceeds 1000 physical lines — it passed 26/26 on `c605df85`; it must still pass) |
| §8 | report the physical line count of `ScheduleReviewWorkspace.tsx` after your change |

The server needs no re-check: `atlas-server` `npx tsc --noEmit` is clean at `c605df85` (after
`prisma generate`), which closes the earlier B3. Do not touch `atlas-server`.

---

## 7. Handoff — this exact shape, nothing else

```
A2 mc R1 — wire the swap offers into the grid move path — REVIEW_REQUIRED
Base            c57b8e1d
Prior candidate c605df85
Candidate       <your sha>   (additive commits on work/a2-mc-manual-controls)
Worktree        E:/ATLAS-worktrees/lane-a2-mc-manual-controls (clean, no stash)
Changed paths   <git diff --name-only c605df85..HEAD>

B1 STATUS      RESOLVED / PARTIAL / STILL BLOCKED — <one line, and if still blocked, the exact
                file and symbol that stops it>

OWNERSHIP CHECK  c15 <result> · c17 <result> · a8-c5 <result>
FILE SIZE      ScheduleReviewWorkspace.tsx <n> physical lines (cap 1000, 963 at c605df85)

WHAT CHANGED   3a identity · 3b resolvers · 3c onSelectSwap · 3d disarm — DONE/NOT DONE each
FROZEN-SURFACE PROOF  <which of the four frozen areas you touched, and why it was necessary;
                       "none" is the expected answer>

PROOF          C1 <literal base output> → <literal candidate output>
               C2 · C3 · C4 likewise
GATES          G1 · G3 · G5 · G7 · G8 · G-new — literal command, actual tally, c605df85 tally
DESIGN NOTE    what was added to the screen, and what it cost
NOT DONE, dated 2026-09-29
NEXT ACTION    one line
```

Claim only what you ran. "0 fixes live and seen" remains the honest count: source only, no
deploy, no browser session, no staging build, no database write.

## 8. Hard boundaries (unchanged)

No deploy, no build for release, no supervisor/task/env change, no generation, no publication,
no migration, no database write, no live or staging browser session, never read or echo
`D:\ATLAS-runtime-config\atlas-server.env`, never write in `D:\ATLAS`. Commit and push a `wip(...)`
checkpoint at least every 30 minutes and before any long step. If you approach a step limit,
commit, push, and report what landed and what did not.
