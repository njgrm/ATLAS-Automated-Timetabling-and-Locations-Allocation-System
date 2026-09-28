# A5 C3 — AMENDMENT R2 (2026-09-29): the new §11 Design judgement gate, and the executor's findings

Parent: `docs/prompts/a5-subjects-table-2026-09-29-r1.md` (committed `d131868c`). This file
**supersedes R1 where they differ** and is additive everywhere else. Read R1 first, then this.

`origin/main` moved 3 docs-only commits above R1's base. `2fc6f75c` adds **`AGENTS.md` §11
"Design judgement gate (operator, 2026-09-29)"**, and it names **this exact slice** as one of the
four live defects it was written about:

> "Subjects filters as pills beside rectangular pickers, two reading `All...`, spelled-out program
> names, raw `OWNER_DEPT:` strings. Each passed its tests, its QA **and a screenshot**."

So R1 as written would have produced exactly the failure the directive was written to stop: every
test green, a screenshot on file, and a worse screen. Re-read `AGENTS.md` §11 in full before you
write any JSX. New base for the branch: `2fc6f75c` (docs-only delta from `f02ed64a`; zero product
paths).

---

## 1. The five new rules, and what each one demands of you

| Rule | What it requires of this cycle |
|---|---|
| 1. Packets state intent | The user is an **older, mouse-first scheduler** who came to `/subjects` to find one subject and see whether it is covered. What must feel different: **calmer** — one obvious next step, nothing crammed, nothing to decode. "Five even filters" is a limit, not the goal. Meeting it by cramming fails. |
| 2. Design before code | **A layout note, written and committed BEFORE the JSX.** `docs/reviews/a5-subjects-2026-09-29/layout-note.md`: for each region you touch — what **stays**, what **goes**, what **moves behind a Tooltip / `More` / a detail affordance** — and the §8 page pattern you are copying. QA judges this note; it is not decoration. |
| 3. Subtract first | **A subtraction ledger, in the same note.** For every region: what was removed, counted. A region where you added visible words, chips, lines or controls and removed nothing or less is a **finding unless R1/the parent packet says why**. Say why, explicitly. |
| 4. Judged, not just seen | A reviewer **who did not build it** compares before/after screenshots at **1366x768** and scores them. Any miss = `REJECT_UX`, even with every test green. You do not self-judge this; the planner runs the gate. |
| 5. Copy what works | Name the page you are copying, per surface, in the layout note. **Do not invent a local variant.** |

### 1.1 The rubric the reviewer scores against

`ux-communication-rubric` is a scoring memory, not a repo file. Its axes (from
`docs/prompts/overnight-a3-ui-ux-2026-09-28-c1.md:48`) applied to `/subjects`:

- the task the scheduler came to do, and whether it is still obvious
- **words on first screen** (fewer is better)
- **distinct action labels** (fewer distinct verbs is better)
- **status cues** — an icon/colour cue beside every status
- **clicks to finish the task**
- **top 3 stumbles** from the older-user view

Plus §11 rule 4's own list: one primary action · no truncation · no jargon or raw codes · one status
per fact · controls matching other pages · nothing cramped.

**Your subtraction ledger is the input to the `words` and `clicks` axes.** A ledger that shows a
net increase on `/subjects` is a `REJECT_UX` risk before a reviewer even looks, so produce a real
one.

---

## 2. R2 decisions that change R1

**R2-1 — `pages/TeachingLoad.tsx` is 962 physical lines, not 995.** R1 §Step 4's "995/1000" is
wrong. The instruction is unchanged and stronger: **do not add to it** (a 38-line margin, and A6
owns it). Re-derive any line count you rely on; do not copy R1's.

**R2-2 — J6 is page-scope, and its scope is now stated exactly.** The operator's words are "no raw
`OWNER_DEPT:AP` strings **anywhere**". There are **79 `OWNER_DEPT` matches across
`atlas-client/src`**; most are server-contract comments and tests, which are not operator-visible
and are out of scope. The page-scope assertion is:

- **IN scope (A5-owned, all on the `/subjects` screen):** `SubjectRow.tsx`,
  `SubjectMobileCard.tsx`, `SubjectCoverageSheet.tsx` (opened from the row's `Review` button), and
  the row-level presentation helper.
- **OUT of scope, named as a NON_BLOCKING follow-up in your handoff:** `SubjectFormModal.tsx:855`
  (the edit form is a different task on a different screen). Do not edit it. Do not claim it fixed.

**R2-3 — the J6 assertions that already exist are the ones to update, never delete.** Your own
read found them: `atlas-client/src/components/subjects/__tests__/a5-c2b-surface-truth.test.ts`
line ~465 asserts `assert.match(help, /ATLAS records the owning code as OWNER_DEPT:MAPEH\./)` and
line ~471 pins `ownerDepartmentPhrase(...) === 'OWNER_DEPT:MAPEH'`. Those are A3-C4-1c's
reachability controls. Under J6 they must be **re-pointed at the new honest sentence** (plain
owning codes, no `OWNER_DEPT:` literal) and the replacement asserted alongside. §16: a correction
that removes evidence fails review. Update and add; never delete and never skip.

**R2-4 — A5 is answered on A5 (source level), and the answer is "already fixed, except J6".**
`ac8adf09` already replaced the marker on the **primary** line: `SubjectRow.tsx:124` and `:230`
use the no-marker read and `a5-c2b-surface-truth.test.ts:424-445` pins
`assert.doesNotMatch(ownerDepartmentRead(...), /OWNER_DEPT|department/i)`. The operator's screenshot
is of a build that predates it. So A5 becomes: **prove it in the rendered row, report honestly, and
do not re-fix what works.** The remaining J6 work is the detail surface only. A change that
"improves" the already-correct primary line is a regression risk and a `REJECT_UX` risk — leave it.

**R2-5 — the search box is a design decision, and it is decided. The search input is NOT shown for
a short option list.** R1's J1 said "the same primitive … and search behaviour", and the natural
reading — a search box on every filter — is the *wrong* build for the user named in rule 1. An
older mouse-first scheduler filtering `Grade: All grades` over five options gains nothing from a
search box and loses the calm. So:

- `FilterPicker` (the shared `@/ui` wrapper R1 J2 already requires) takes a documented
  `searchable` behaviour and renders the search input **only when the option list exceeds 8
  items**. The threshold is a named exported constant in `@/ui`, not a literal at a call site, and
  a committed test pins both sides of the boundary (7 items → no search input; 9 items → search
  input). One rule, one primitive, every page gets it.
- Implement it as a **prop on the shared wrapper with a default that preserves current
  behaviour**. Do **not** change `SearchableSelect`'s own default and do **not** touch
  `/timetable`'s entity picker — it has a long list and must keep its search box unchanged.
- Record this as a **NON_BLOCKING design decision** in your handoff with the reason, and expect
  Lane C to judge it in the older-user walk.

**R2-6 — the reference pages, named as rule 5 requires.**

| Surface | Copy from | Why |
|---|---|---|
| Filter control look | the **Section** and **Teacher** pickers — they are the pair the operator said already agree (`lane-c-to-a2.md` 2026-09-29 00:15: *"Subject dropdowns look different from the Section and Teacher dropdowns"*) | the operator's own frame, not an invented one |
| Picker primitive | `@/ui/searchable-select`, as `/timetable` already uses it | §8 one look per control |
| Table row shape | keep `SubjectRow.tsx`'s existing row geometry; **subtract** from it | the row's action cell and grade chips were already accepted in c2b — do not re-lay it out |

**Do not copy `/timetable`'s header.** The operator judged that header "regressed — messy" and
cramped on 2026-09-29. It is a counter-example, not a model.

**R2-7 — `npm ci` is DONE; the STEP 0 blocker is cleared.** The planner ran it in
`E:\ATLAS-worktrees\lane-a5-c3-20260929\atlas-client`: `added 278 packages, and audited 279
packages in 14s`, exit 0. `E:` free **26.86 GiB** after the install — above the §3 25 GiB warn
line, so the cycle is inside the capacity gate. **Do not re-run it.** Do not junction
`node_modules`; do not touch `package-lock.json`.

---

## 3. Corrected status of the branch and base

- `work/a5-c3-20260929` HEAD `d131868c` (packet R1) on base `f02ed64a`.
- `origin/main` is `2fc6f75c`. Merge it into the branch before your first JSX commit so the packet
  amendment, `AGENTS.md` and the product tree are all current, and so the closure integrates
  cleanly. The delta is `AGENTS.md` + two docs files — **zero product paths**; record that
  `git diff --name-only f02ed64a..2fc6f75c` says so.
- Gate proof at closure: `git diff --name-only f02ed64a...HEAD` must contain **no**
  `atlas-server/`, `prisma/`, `ops/`, `package-lock.json` and **no** `AGENTS.md` edit by you.

## 4. Deliverable changes from R1

Add to R1 §6: the **layout note** (rule 2) and the **subtraction ledger** (rule 3) as committed
files, and in the one-page handoff — the R2-1 line count correction, the R2-2 in/out scope, the
R2-4 honest answer on A5, the R2-5 decision with its reason, the R2-6 reference per surface, and
the `SubjectFormModal.tsx:855` follow-up you did **not** take.
