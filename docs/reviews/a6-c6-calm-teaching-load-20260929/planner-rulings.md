# A6 c6 — planner rulings on the fresh QA verdict, and the base proof

`e6aeb3edeb944b1d9dec92ec9840b1681ec2423e` · QA `PLANNER_DECISION_REQUIRED`, **mandatory 32 / passed 30 / blocked 1 / unperformed 1**, no `REJECT_UX`, no source defect, encoding provably intact.

The reviewer returned two decisions that are the planner's, and one evidence row that was blocked for a reason I caused. All three are closed here. Nothing below is a source fix; nothing below is a new gate.

---

## Ruling 1 — `test:a5-p3-picker-guard` moving 7 pass → 6 pass / 1 skip SATISFIES §4's "base-or-better"

**RULED: satisfied.** §4's requirement is about coverage and red, not about a count of live rows, and a `skip` is neither a pass nor a failure.

The reasoning, and it is not a rationalisation:

1. **The control it removed directed its own removal, in its own failure text.** `A5-C3-P3-2b` read: *"expected exactly 2 uppercased Switch labels in the Teaching Load row, found 0 — if this slice restyled them, remove this exception row with the restyle."* A6 c6 restyled them. The exception no longer exists, so the row's claim is now false by design; a live row demanding it be re-introduced would be a row demanding the defect return.
2. **The replacement is strictly stronger, and it is a different kind of claim.** `A5-C3-P3-2b` counted class strings — an allowance for the defect. `A6C6-1` asserts both labels are Lane C's **exact two sentences** *and* that neither carries `uppercase` or `tracking-`. A relabelling and a re-shouting are both red. The narrower claim was replaced by the wider one, not the other way round.
3. **Nothing was deleted.** The row is retained in `a5-p3-picker-guard.test.ts` with the reason attached **to the skip itself**, so the next reader learns why it does not run rather than finding a mystery skip (`AGENTS.md` §16).

**If a future sweep re-shouts those labels, `A6C6-1` goes red.** That is the regression path, and it is live.

**Recorded, because it is a real number that moved:** `test:a3-teachers-load` is 43 pass / **7 skip** against a 43 / 0 base. Same rule, same reasoning: `F14-1` out, `F14-1b` in, and `F14-1b` re-asserts everything `F14-1` asserted that still holds (one wrapping row, no second row, the fixed non-elastic `w-[240px]` search, all four daily filters reachable without a disclosure, the switch ids, the order of what remains) **plus** the two plain sentences and the popover path. QA independently measured this as net equal and called it legitimate.

---

## Ruling 2 — §2's failing-first-at-the-base row is CLOSED, measured, not asserted

QA was right to refuse it: the record was executor-asserted, and a read-only reviewer must not materialise a base tree to check it. That is the planner's job, and it is now done.

**Method, recorded literally (AGENTS.md §11 "record what you actually ran").**

```
git worktree add --detach E:\ATLAS-worktrees\lane-a6-c6-baseproof a1f0c727
cmd /c mklink /J <worktree>\atlas-client\node_modules <candidate-worktree>\atlas-client\node_modules
```

The new gate file was copied onto the base tree with **one** change: its `import { TEMPORARY_ROLE_BUCKET_KEY, TEMPORARY_ROLE_BUCKET_LABEL } from '@/hooks/useTeachingLoadUI'` line — a module that does not exist at `a1f0c727` — was replaced by a **6-line inline shim carrying the candidate's own two constant values**, marked as a shim in the file. Every other line is byte-equal to the committed gate. The shim cannot make a row green that the base would otherwise pass: it supplies two strings, and the base hook contains neither the exported names nor the plain label.

```
cd E:\ATLAS-worktrees\lane-a6-c6-baseproof\atlas-client
npx tsx --test --test-reporter=tap \
  src/components/faculty-assignments/__tests__/a6-c6-calm-teaching-load.test.tsx
```

**Result at the base `a1f0c727` — `tests 10 · pass 0 · fail 10`. Every row red, by name, TAP output:**

| # | row | why it is red at the base |
|---|---|---|
| 1 | `A6C6-1` the two inclusion switches carry Lane C's exact plain sentences | `TypeError: Cannot read properties of null (reading 'dispatchEvent')` — the `More filters` popover the row opens does not exist at the base |
| 2 | `A6C6-1b` the temporary-role group heading is a plain label, not a code | `AssertionError: the placeholder branch must group under the exported key` |
| 3 | `A6C6-2` the editor's outside-the-department heading | `AssertionError: … saw ["Cross-Department","Filipino",…]` |
| 4 | `A6C6-3` every composed picker face fits its `@/ui` budget | `AssertionError: @/ui/picker-trigger must publish 'pickerTriggerFaceFits' — a page cannot hold a width promise the primitive does not` |
| 5 | `A6C6-4` ONE primary action, `Load summary` from `More` | `AssertionError: 'Load summary' must NOT be a row-1 control any more: row 1 is title, tabs, the two status chips, Help, ONE primary act…` |
| 6 | `A6C6-5` the four withheld statuses are plain sentences | `AssertionError: offline: the withheld status must be the plain sentence, byte-for-byte` |
| 7 | `A6C6-6` the degraded pill leads plainly | `AssertionError: OFFLINE: the pill must lead with the plain sentence and nothing else` |
| 8 | `A6C6-7` the teacher row carries no department line / Subjects / dead node | `AssertionError: the per-teacher department line restates the group heading the row is inside; it must be gone from the row` |
| 9 | `A6C6-8` the row is search + four pickers + `More filters` | `AssertionError: the row carries the five named controls in order, then 'More filters'` |
| 10 | `A6C6-9` PRESERVATION | `TypeError` — the `teaching-load-more-filters` testid it preserves does not exist at the base |

**Two honest notes on this table.** Rows 1 and 10 fail by `TypeError` rather than by `AssertionError`, because the elements they reach for do not exist at the base; a red row is a red row, but the failure is a *setup* failure and is recorded as one. And `A6C6-9` is red here even though the packet said it is a **preservation** row not claimed as failing-first — it is, and the packet's claim was right: it asserts the preservation of *this candidate's* testids, which do not exist at the base. It is not counted among the nine.

At the candidate the same command is `10 pass / 0 fail` (§4, `test:a6-c6-calm-tl`).

**Teardown, recorded because a junction is a hazard, not a convenience.** The `node_modules` junction was removed with `cmd /c rmdir` **first** (a recursive delete through a junction destroys the *target* — the candidate's real dependency tree), the one untracked shim file was deleted, `git worktree remove` ran **non-forced** (rc 0), then `git worktree prune`. Candidate `node_modules\.bin\tsx.cmd` verified present afterwards. The worktree no longer exists. No force flag, no glob, no computed path.

---

## Ruling 3 — the blocked browser row was my omission, and here is what I did about it

QA reported `BLOCKED(1)`: on a fresh loopback session `/teaching-load` redirects to `/login`, **the planner's `/api/v1` mock was not committed and is not reproducible from the packet**, so the reviewer could not take its own 1366×768 capture and the `REJECT_UX` score rests on my renders.

That is the correct finding and it is a defect in the evidence chain, not in the candidate. A reviewer's verdict that depends on evidence only the author can reproduce is a weaker verdict than it looks.

**What I did about it, and what I did not.** I did **not** re-run the reviewer's row for them, and I did **not** re-take my own capture and call the row closed — that is the "do not re-verify a stable fact for reassurance" rule, and it would have produced a green row that decides nothing.

**The row stays open, with a named owner and a named route to closure.** It is a **release-acceptance** item, not a source item:

- **`A6C6-1b` (`Temporary substitutes`) has NO rendered evidence and is not claimed to have any.** The default filter excludes temporary roles in the mock, so the heading never mounts. Its evidence is a source guard plus a mutant, and QA confirmed the source claim is real while explicitly declining to claim it saw it on screen. **Lane C's staging walk on `https://njgrm.buru-degree.ts.net:8443` after A4 deploys is what closes it.** Assert `window.location.origin` on that row; a loopback capture can never close it.
- §4's per-trigger `scrollWidth <= clientWidth`, the header control count and the first teacher row's height are **measured and reported in the handoff**, from the base and the candidate in the same worktree at the same viewport with the same mock. They are **planner-measured evidence, labelled as such**, and they become independent evidence when Lane C repeats them on staging.

The mock harness is described in the handoff in full (endpoints, shapes, the three shape traps: `/runtime/context` needs `activeSchoolYearId` not a nested object, `/runtime/rollover-status` needs `drift.status` or `RolloverGuidanceCard` throws on `.status`, and the roster arrives inside the `/faculty-assignments/summary` response, not from a `/faculty` call).

---

## Two packet corrections that must not be quoted again

1. **§1.3.2's "one line at 1235px of 1326px" is wrong on the real page.** The row **wraps to two lines** in both the before and the after capture, because `draftControls` (undo / redo / `Discard` / `Save changes`) shares that row and the packet's arithmetic omitted it. **Nothing clips** and §0.1 deliberately keeps `draftControls` visible, so this is an incomplete calculation in the packet, not a product defect. Do not quote 1235px again.
2. **`useTeachingLoadUI.ts` is a fourteenth changed file the packet did not enumerate.** It is additive, client-only, in service of §1.1's "sweep the page for any other all-caps code", and it was found by **rendering** rather than by grep — which is the packet's own §11 rule, applied to the row that enforces it. It changes only the temporary-role group's *label*; the `Map` key stays a code on purpose, because it is group identity.

---

## Residual, for the next slice, not this one

`NO STANDARD SET` (`TeacherLoadReadout.tsx`, an **unchanged** file) is still shouted on every teacher row, and so is the `Draft` badge's `uppercase`. Neither is a code and §1.1 explicitly excluded a repaint hunt, so neither is a §1.1 failure. They are the next obvious rubric item and they belong on a follow-up row.

`WorkspaceToolbar.tsx` is at **966 physical lines** — 34 of headroom under the §8 cap. The next change to that file must extract first.
