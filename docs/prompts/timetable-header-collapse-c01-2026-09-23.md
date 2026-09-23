# TIMETABLE-HEADER-COLLAPSE-C01 — close the three remaining declutter gaps

**Status:** `READY`. **Risk:** MEDIUM client source; the bundled deployment is HIGH under the
operator's standing authorization (`AGENTS.md` §13). **Owner:** Lane A.
**Base:** `origin/main` = `0213d326189718edc13ffc26175bd4c4596f497d`; live release `28f6f03f`.
**Executor worktree (provisioned — do not create another, do not clone):**
`E:\ATLAS-worktrees\timetable-header-collapse-c01`, branch `work/timetable-header-collapse-c01`,
clean, `atlas-client` dependencies installed.

## 0. Why

The relaxed main workspace shipped and was independently accepted (`ACCEPT_READY`), but the operator
reviewed the result and named three remaining gaps. All three are measured facts on the live release at
1366×768, not opinions:

1. **The header is two bands, not one row.** The audit's relaxed-header contract is a single row
   (`Breadcrumb │ S.Y. + Term │ status chip │ primary │ More`). The live header renders a status region
   **and** an action row; grid top is **180 px** — at the stated ≤180 px limit, not inside it.
2. **In the published state the visually largest control is `Generate`.** The schedule is now published
   and read-only (run #317, revision 43), so `Generate` is **not** the next action — yet it is the
   biggest button on screen (there are zero filled/brand-coloured buttons in that state).
3. **`Generate` prominence generally.** It must stay reachable (two committed contracts require it in
   the header render) but must not be the dominant control when it is not the next action.

## 1. Deliverables

- **D1 — one-row header.** Collapse the status region and the action row into a **single row** at
  ≥1366 px, keeping exactly **one** status region and exactly **one** visually dominant primary. The
  header must **not wrap** at 1366×768. **Target grid top ≤ ~140 px** (from 180 px). If a genuine
  layout constraint makes one row impossible at 1366 px, a two-row fallback is acceptable **only** if
  you document the constraint and still reach ≤ ~150 px — prefer one row.
- **D2 — published-state primary.** When the selected run is published, the lifecycle primary must
  reflect the **read-only published** state. `Generate` must **not** be the visually dominant action.
  The published state's dominant affordance must be honest about what a published schedule allows
  (e.g. a read-only/next-publication affordance), not a generate action.
- **D3 — `Generate` prominence.** `Generate` must not be the single largest control whenever it is not
  the next action. It stays **present** in the header render (committed contracts), but demoted in
  size/emphasis relative to the lifecycle primary.

## 2. Boundaries — do not break

- **Client source only** (`atlas-client/**` plus the test manifest). No server, DB, migration,
  generation, publication or schema change.
- No `docs/**`, no `CHANGELOG.md`, no companion-repo edits.
- **Preserve everything already accepted:** exactly one status region; no header wrap; the rehaul bar
  (sub-nav on the index and all nine `/timetable*` routes, one solid primary, one status surface);
  no global scrollbar at **1366×768 and 390×844**; the **12 px** floor; zero router element-less
  warnings; no jargon/raw codes; per-entry term labels; the draft surface and its sub-nav entry; grid
  scroll restoration; the inline preview → one Confirm → zero modals placement contract with working
  Undo; no workspace remount; the scope-clear hygiene and the strict publication predicate.
- **Keep the committed contracts** that require `Generate`, `Publish schedule` and the term-bound
  export trigger to be **present** in the `TimetableSimpleHeader` render
  (`ux-quickfix-c01-header-actions.test.ts`, `timetable-simple-term-export-c03r2.test.ts`). D2/D3
  change **prominence**, not presence — so those contracts should survive. If any assertion must
  change, it must be a **genuine** contract change and named in your handoff.
- No file above **1000 physical lines** (`[IO.File]::ReadAllLines`) — the committed B5 cap guard must
  stay green.
- `@/ui` primitives only: no raw unstyled `<button>`, no `title`, no raw `<details>`, no native
  `<select>`.

## 3. Gates — run and paste literal results

1. `npm run test:client-suite` (must be green; record the tally).
2. `npm run test:timetable-relaxed-main` (must be green; includes the B5 cap guard).
3. `npm run typecheck`.
4. `npm run build` with `VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'` (the fail-closed
   guard emits no bundle without it).
5. `git diff --check`.
6. Any new or changed test file must be named by a **committed `package.json` script** in the same
   commit.
7. **Failing-first control** for D2/D3: a test that fails on the current behaviour (published state ⇒
   `Generate` is the dominant/largest control) and passes after. Do not cite a pre-existing test.
8. **Fixtures from the real surface.** Prove the outcome, not the wiring — exercise the real header
   entry path and assert the resulting state.

## 4. Evidence to return (one page)

Base SHA · candidate SHA · exact changed paths · what changed per D1–D3 · the literal command and
result for every gate · the structural proof for D1 (single row / no wrap) **and an explicit statement
that the pixel grid-top value is a post-deployment browser row, not measured here** · the failing-first
control with its literal before/after · line counts of touched components · known risks each marked
`BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Additive commits only — never amend, rebase or
push.
