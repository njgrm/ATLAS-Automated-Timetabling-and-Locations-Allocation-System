# A5 C3 — AMENDMENT R3 (2026-09-29): the label spec was mine, not the operator's

Parent: `a5-subjects-table-2026-09-29-r1.md` + `-r2.md`. **R3 supersedes both on the two points
below and changes nothing else.** Read it as a correction, not a new brief.

Your checkpoint is preserved and correct: `6cb5f8b0` (layout note) committed, slice A source
uncommitted, preservation set red, and you were right not to commit a red candidate. This file
unblocks the next step and shrinks its scope.

---

## 1. The filter labels — I over-specified, and you inherited my error

Your NON_BLOCKING finding is that A1's labels make the cluster wrap 3+2 at 1366 (1420px of
content against ~1062px available). That is real, and **the cause is my packet, not your code.**

R1 A1 asked for `Grade: All grades`, `Program: All programs`. The operator's own words — the
parent packet, `docs/prompts/a5-subjects-table-2026-09-29.md` line 16 and
`docs/handoffs/lane-c-to-a2.md` 2026-09-29 00:15 — are:

> "each filter shows its name (e.g. **`Grade: All`, `Program: All`**) untruncated at 1366 wide"

`Grade: All`, not `Grade: All grades`. I lengthened the operator's example by four words per
filter, and the new §11 rule 1 says a packet's literal limit is not the goal — here I broke my own
rule before you started. **Fix the spec, not the layout.**

**The rule, exactly:**

| | |
|---|---|
| **Trigger visible text** | `{ShortName}: {ShortValue}` — `Status: All` · `Grade: All` · `Program: All` · `Room: All` · `Term: All` |
| **Short names** | `Status`, `Grade`, `Program`, `Room`, `Term` (R1 A1's `Room type` is `Room` — five words back) |
| **Short value** | `All` when unset; otherwise the option's own short label (`GR7`, `STE`, `Classroom`, `Term 1`) |
| **Option list inside the popover** | keeps the **full** labels (`All grades`, `Science, Technology, and Engineering`) — the popover has the room and that is where the scheduler reads the choices |
| **Accessible name** | unchanged and still long: `SearchableSelect` composes it from `ariaLabel`, so a screen reader gets `Filter by grade level` with the full option label. Nothing is lost by the compact trigger. |

Compact trigger, full option list, one long accessible name — that is what `/timetable`'s entity
picker already does, so it is "copy what works" (R2-6), not an invention. **Record the
compact-trigger/full-option decision in the layout note with that reason**; rule 5 requires the
reference to be named, and the reference is `/timetable`'s picker, not a local variant.

Do **not** solve the wrap by narrowing the triggers, by shrinking the font, or by moving a filter
into `More`. The width arithmetic is: 5 × one even width + 4 gaps + the Reset button must fit
~1062px at 1366. Measure it and report the number; if the even width that fits leaves the search
box with no room, say so in your handoff and I will rule on it — do not invent a fourth width.

**Re-derive the wrap yourself and report before/after content width in px at 1366.** D1 in your
layout note stands as a design note, but the 3+2 wrap is no longer expected: a shorter label
removes ~120px per filter, and the row should fit one line again.

---

## 2. Two corrections to your handoff's blockers — both are path/pointer errors, not gates

**2.1 `a5-c2b-surface-truth.test.ts` is not missing and its gate is not unverified.** The real
path is **`atlas-client/src/__tests__/a5-c2b-surface-truth.test.ts`** (24 424 bytes), wired by
`"test:a5-c2b-surface-truth": "tsx --test src/__tests__/a5-c2b-surface-truth.test.ts"`. There is
no copy under `src/components/subjects/__tests__/` — do not go looking for one. Your line numbers
were right. Re-run that script and report its literal tally.

Its three relevant tests, so you do not re-derive them:

- **`A5-C2B-7a` (line 424)** — the primary read never shows the marker. **Unchanged by this
  slice; do not touch it.** It already passes.
- **`A5-C2B-7b` (line 454)** — titled *"the stored marker stays reachable in the detail"*, and
  line 456 is `assert.match(help, /OWNER_DEPT:MAPEH/, 'the stored marker is no longer reachable
  anywhere')`. **J6 removes that literal from the detail**, so 7b must be **re-titled and
  re-pointed, not deleted**: the honest replacement is *the owning **code** stays reachable in the
  detail* — assert `MAPEH` is present and `OWNER_DEPT` is **absent**. That preserves the control's
  real intent (the diagnostic reaches the operator) while implementing the operator's "no raw
  `OWNER_DEPT:` anywhere". Keep the old assertion visible in a comment as superseded; never
  silently drop it (§16).
- **Line 471** — `assert.equal(ownerDepartmentPhrase(...), 'OWNER_DEPT:MAPEH')`. **Leave it
  alone**, as R1 J7 said. That function keeps the stored-marker phrase for diagnostics and is not
  operator-visible after J6.

**2.2 The two `a3-c4-subjects-copy` rows about code reachability are a real decision, not an
obstacle — but R1 A2 decides it.** R1 A2: drop the code chip from the row, in `SubjectRow.tsx`
**and** `SubjectMobileCard.tsx`. Two A3 controls assert the raw code is reachable *on the row*.
The operator's words are "drop the code chip from the row; the name is enough" — so the chip goes,
and those two controls are re-pointed to the surface that legitimately carries the code instead
(the form modal and the coverage sheet), with the **replacement assertion added beside** the
superseded one. Do not delete them, do not skip them, and do not re-add the chip to satisfy them.

---

## 3. Your scope for this next pass — slice A only, then STOP and return

Slice A is a coherent candidate and it should be reviewable **today**. Do not start slice B.
Everything below is the remaining slice-A work:

1. Apply §1's label rule; measure and report the cluster's content width at 1366.
2. Re-point the three red suites with **update + add**, never delete: `test:a5-subjects-c1`
   (2 rows), `test:a3-c4-subjects-copy` (5 rows, per 2.2), `test:a5-c2b-surface-truth` (per 2.1).
   For each, state the assertion before and after.
3. Re-run the **whole** R1 §3 preservation set, not just the three: `test:a3-subjects`,
   `test:a5-subjects-c1`, `test:a5-c2b-surface-truth`, `test:a5-c2a-term-truth`,
   `test:a3-c4-copy`, `test:ux-guardrails`, `test:client-quality`, plus any `subjects`/`faculty`/
   `teaching-load`/`sections` suite touching a control you converted. Report each literal tally.
4. `npm run build` (client) — exit 0. `npx tsc --noEmit` — same **5** pre-existing errors, none
   in a changed file; if a sixth appears, it is yours.
5. `git diff --check`; `git status --short` = exactly the paths you mean to commit.
6. **One additive commit** for slice A on `work/a5-c3-20260929`, conventional message. No amend,
   no rebase, no force, **no push**.
7. `git diff --name-only f02ed64a...HEAD` must show no `atlas-server/`, `prisma/`, `ops/`,
   `package-lock.json`, and no `AGENTS.md` edit by you.

Then **stop and return the handoff** — do not begin slice B1-B5 in this pass. I will QA slice A
and dispatch slice B as its own checkpoint.

Your two harness findings (a test that throws with a mounted tree leaves the child at `-1` with a
bare `test failed`; an open Radix `Popover` `aria-hidden`s its siblings and silently empties the
next test's DOM) are good and **documented in the test file is the right place for them** — keep
them there. They are also NON_BLOCKING findings against the shared harness; I am recording them as
backlog, not fixing them in this cycle.
