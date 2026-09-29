# A6 c7 — the shortage line must survive a saved roster, "Assign teacher", an Undo, and one plain line

**Stream owner:** Lane A6. **Worktree:** `E:/ATLAS-worktrees/lane-a6-c7-tl-shortage` (provisioned, registered). **Branch:** `work/a6-c7-tl-shortage-owner-undo`. **Base:** `4244cd3e74e99fe2c4face573cc410901242a8d7` (`origin/main` at 10:37, includes c6 at `a3819321`).
**Client only.** Every changed path is under `atlas-client/`. Zero `atlas-server/`, `prisma/`, `ops/`, lockfile, `.env`, migration or seed paths.
**Risk tier: MEDIUM** — item 1 changes when a production surface renders (a gate), items 2–4 are user-facing copy and one control. No HIGH action is authorised. No deploy, no generation, no publication, no live-data write, no runtime/task/env change. **A4 owns the deploy; A6 does not deploy.**

**Source of the work:** Lane C's Codex walk of staging train 7 (`e9ddda71`), `docs/reviews/codex-staging-train7-e9ddda71/report.md` — B1 FAIL, the Teaching Load MAJOR/MINOR bug lines 24–25 and the older-user concerns on lines 30–32 — as made binding by **Addendum 11:00** at the end of `docs/prompts/a6-c6-calm-teaching-load-2026-09-29.md` (commit `7a8edd7b`, on `main`).
**Grade against those words.** A narrower rewrite of any item below is not this item.

---

## 0. The design judgement gate, applied BEFORE any JSX (AGENTS.md §11)

**The user:** an older, mouse-first scheduler, in a school year whose roster ATLAS could not confirm. They are not a power user; they read, they use the mouse, and they are under time pressure.

**The task on this screen:** find out which classes have no teacher, and put one on them.

**What must feel different:** the page answers the question it is asked, in the state it is actually in. Today, on staging, it silently withheld the answer: the only thing on the row was the generic `25 classes still need a real teacher.` from the repair queue, with no subject, no count, and no way to act. A scheduler cannot use a number they cannot attribute and cannot act on.

**A limit is not the goal.** "Keep the degraded suppression" is a constraint this change may cross; it is the constraint that produced the defect. **Subtract first:** nothing on this slice may add a chip, a line or a control to a region without removing at least as much (§0.2 of the c6 packet, and rule 3 of the design gate).

### 0.1 The layout note — what stays, what goes, what moves

| | |
|---|---|
| **STAYS, visible** | Everything c5/c6 put in the header: the degraded pill, `Next step` chip + its one action, `Load summary` in `More`, the one primary action. The Sections view's subject/section rows, their owner picker and the emerald/amber confirmation block. |
| **GOES** | The `Last saved data — ` prefix the repair queue prepends to every item title when the source is degraded (`useTeachingLoadRepairQueue.ts:388`). The saved-roster fact already has a home — the degraded pill and the one status clause on the chip — and a prefix is that fact stated a second time in different words. |
| **GOES (naming)** | `Set owner` / `Change owner` → `Assign teacher` / `Change teacher`. "Owner" is a data-model word, not a school word; an older scheduler does not know it and cannot act on it. **Identifiers, `data-testid`s and prop names that say `owner` stay** — they are stable DOM/API hooks, not visible text. |
| **NEW** | One `Undo` beside the assignment confirmation in the Sections view, visible **only while that change is still a draft**. Nothing else new is added anywhere. |
| **MOVES BEHIND** | Nothing. The only qualification added by item 1 is inside the cover button's existing `Tooltip`, which already exists. |
| **NOT CHANGED** | The pickers, the `xl` widths and `shortLabels` (c6 §1.3), the c6 copy, the two inclusion switches and their ids, `TEACHING_LOAD_HEADER_MODEL`, `ROW_1_COMMAND_PX`, the no-scroll architecture, the timetable's own `Change owner` action (a different page, out of scope — do not touch `timetable/`). |

### 0.2 The subtraction ledger

| Added | Removed | Net |
|---|---|---|
| `Undo` beside a draft assignment confirmation | — (it is the control the addendum asked for; it replaces nothing on screen) | 0 chips, +1 control **in the one view where the change is unconfirmed** |
| one honest qualifier on the shortage line, when the roster is saved | the entire hidden-line state: 25 classes, no subject, no figures, no action | **+1 line's worth of fact, −0 words of layout** |
| `Assign teacher` / `Change teacher` | the `Last saved data — ` prefix on every repair-queue title | **−1 clause per item, in every state** |

---

## 1. The four items, with Lane C's exact words

### 1.1 The c5 surface must render whenever classes lack a teacher (MAJOR bug line 24; addendum sentence 1–2)

**Why it did not render — the planner has already established this, and the executor must not re-derive it from scratch:**

`useTeachingLoadOutage.ts:124` computes
`isLive = !isTeachingLoadSourceDegraded({dataSource, isOnline, dataSourceNotice}) && shortageLine.visible.length > 0`
and `TeachingLoadOutageSurface.tsx:46` does `if (!isLive) return <>{children}</>`, with `TeachingLoad.tsx:689` not even wiring the slot. Staging was `cached`, so `isTeachingLoadSourceDegraded` was true, so **the entire c5 surface — the per-subject line and the `Cover these classes` button — was suppressed**, leaving only the repair queue's generic sentence. The gate was a source-freshness predicate answering a *visibility* question.

**The fix (planner ruling; implement this, not a variation of it): split the two questions the current `isLive` conflates.**

1. `figuresVerified` = `!isTeachingLoadSourceDegraded({...})` — the existing predicate, unchanged, still the one answer to "are these figures confirmed?".
2. `hasShortageToShow` = `shortageLine.visible.length > 0` — the claim is renderable **whenever classes lack a teacher**, from the saved roster as much as from the live one.
3. The surface renders when `hasShortageToShow`. The cover action stays enabled on the page's own `writeBlockedReason` only — **source freshness must not disable it**.
4. When `!figuresVerified`, the line carries **one** honest qualifier, not a new surface: keep the existing `· <date> roster` clause from `formatShortageDataDate(fetchedAt)` (add nothing new if the client holds no timestamp), and state in the cover button's **existing** `Tooltip` that the preview is computed from the last saved roster and is re-checked against the live one when it is applied. `CoverShortageDialog` already exposes `drift` — that server-side re-check is the safety property c5's gate was protecting, so record in the code comment that **the safety is preserved by the drift check at apply, not by hiding the button**, and that hiding it is what produced the defect.
5. `TeachingLoad.tsx:579` (`hasShortage`) and `:681` (`hasShortageLine`) follow the new `hasShortageToShow`, so the placeholder chip stays suppressed consistently in every state.
6. **`isLive` no longer exists as a name** — the name would lie. Update the three consumers and every test that names it. Per §3 a test that names it is superseded **additively**, not deleted.

**Do not** add a second filled warning surface on row 2 (c4 G2.1 already decided one), and do not reword the degraded pill: it is c6's accepted copy and it is the single place that says the roster is the last saved one.

### 1.2 `Set owner` / `Change owner` → `Assign teacher` / `Change teacher` (older-user concern line 32)

`SectionGridMode.tsx:437` renders `{isStaffed ? 'Change owner' : 'Set owner'}` on `data-testid="teaching-load-owner-picker-trigger"`. Change the two **strings** to **`Change teacher`** and **`Assign teacher`**.

- Leave the trigger's chrome (`h-9 … uppercase tracking-widest text-xs`) exactly as it is. The complaint was the *word*, not the casing, and repainting one button in a view whose other controls are uppercase would create the §8 "one look per control" mismatch. The all-caps sweep belongs to a separate, whole-view slice; note it in the handoff as a follow-up, do not do it here.
- Do **not** touch the timetable's `Change owner` (`SimpleSessionDetails.tsx`, `draft-ux-c01.test.tsx`) — different page, different meaning, accepted rows assert it.
- Do **not** rename identifiers, `data-testid`s, props or the `…owner…` helper names.

### 1.3 An obvious Undo beside the confirmation after an assign (MINOR bug line 25; addendum sentence 3)

Report B1: after assigning MAPEH in Aguinaldo the page showed `Draft — not saved`, the section left the filtered list, and **no visible Undo in the Sections view**.

- Render one `Undo` control **inside the existing confirmation block** in `SectionGridMode` (`teaching-load-section-subject-row`), so it sits beside the state it describes. `@/ui` `Button`, `size="sm"`, the same chrome as the trigger beside it (§8 one look per control). Visible text `Undo`; accessible name names the section, e.g. `Undo the teacher assignment for <section name>`.
- **It appears only while that row's change is still a draft** (`owner.isPending`). This is the honest reading of "Undo": a *saved* change is **changed**, not undone, and offering Undo there would be a control that lies. For a saved owner the existing `Change teacher` trigger is already the right control, and it stays.
- It restores **the previously saved owner** for that subject+section — not "unassign". The page already holds the saved map (`data.savedOwnershipMap`) and the assign path already threads the previous owner through `onSwapSectionOwnership(subjectId, sectionId, fromFacultyId, toFacultyId)`; reuse that path, do not invent new ownership state. Wire one new optional prop from `TeachingLoad.tsx`; the view's other props and call sites are unchanged.
- Disabled while `saving` or `isReadOnlyMode`, like every other write control on the row.

### 1.4 One plain line, not a stacked one (MINOR older-user concern line 31; addendum sentence 4)

Observed: `Next step  Last saved data — Assign teachers to open classes  Unverified`.

- Delete the `Last saved data — ` prefix at `useTeachingLoadRepairQueue.ts:388`. The chip then reads `Next step · <count> · Assign teachers to open classes · <c6's plain status sentence>` — the task, then one status. The saved-roster fact is stated once, by the degraded pill and the status clause.
- This applies to **every** item title, including the two teacher-specific ones (`Last saved data — Bautista, Ana has no load`).
- The `Unverified` wording itself is **already fixed by c6** (`teachingLoadUnverifiedStatus`'s four plain sentences). Do not re-word it, and do not re-open `A6C6-5`.
- At 1366×768 the chip must stay **one line** — no wrap into a second band and no `truncate` (c4 G2.2 already settled that). Measure and record it.

---

## 2. Failing-first, then implement (AGENTS.md §11)

**Order: write the rows, run them against the UNCHANGED base, record that they fail for the right reason, then implement.**

One new committed gate file and one new `package.json` script, in the same commit as the change (a test no gate runs is not evidence):

- `atlas-client/src/components/faculty-assignments/__tests__/a6-c7-shortage-owner-undo.test.tsx`
- script: `"test:a6-c7-shortage-undo": "tsx --test src/components/faculty-assignments/__tests__/a6-c7-shortage-owner-undo.test.tsx"`

| Row | Decides |
|---|---|
| `A6C7-1` | **FAILS FIRST.** With a `cached` (degraded) source and a real shortage, the page renders `teaching-load-shortage-line` **with the per-subject figures**, `teaching-load-cover-open` is present, and it is **enabled** when `writeBlockedReason` is null. At the base: neither node exists. **Mutant row:** put the degraded predicate back into the visibility condition → red. |
| `A6C7-2` | Preservation of c5 in the verified state: with a `live` source and a shortage, the line, the button and the cover dialog behave exactly as `test:a6-c5-outage` already proves. **And** with no shortage (every class staffed) nothing renders, in **both** source states. |
| `A6C7-3` | When degraded, the line carries at most **one** saved-roster qualifier (the existing date clause; no invented timestamp when `fetchedAt` is null) and row 2 gains **no second filled warning surface** — assert the count of amber/warning-filled elements on the state line is unchanged from the live state, and that no string matching `/last saved/i` is added to the line or the chip **beyond** the status clause and the existing pill. **Mutant row:** add a second qualifier → red. |
| `A6C7-4` | The cover button is **disabled with its reason** when `writeBlockedReason` is set, in **both** source states — the new visibility must not become a write that ignores the page's gate. |
| `A6C7-5` | The Sections trigger reads exactly `Assign teacher` (unstaffed) and `Change teacher` (staffed) as both visible text and accessible name; neither `Set owner` nor `Change owner` appears anywhere in the Teaching Load client surface; the trigger's `data-testid` and the `…owner…` identifiers are unchanged; the **timetable's** `Change owner` is still present. **Mutant row:** restore `Set owner` → red. |
| `A6C7-6` | After a draft assign, a control whose visible text is `Undo` renders **inside the confirmation block**, its accessible name names the section, it is enabled, and invoking it restores that key's **saved** owner. With no pending change for that section the control is **absent** (not disabled). **Mutant row:** make the handler a no-op → red. |
| `A6C7-7` | No repair-queue item title carries the `Last saved data — ` prefix, in **every** source state and for both the generic and the teacher-specific items; the chip's own status clause is still present and still the only saved-roster claim on the chip. **Mutant row:** re-add the prefix → red. |
| `A6C7-8` | **PRESERVATION.** `TEACHING_LOAD_HEADER_MODEL` and `ROW_1_COMMAND_PX` unchanged; `teaching-load-summary-open`, `teaching-load-degraded-notice`, `show-outside-dept`, `show-unmapped-specialization` all still resolve; no file over 1000 physical lines; and **no exported `isLive` remains** in `useTeachingLoadOutage`. Not claimed as failing-first; must not be made to fail at the base. |

**Record the failing-first evidence literally:** the exact command, the tally at the base, and the failing assertion text for each of rows 1–7. "It failed" is not evidence; the failing row name and its message are.

**The two harness facts c6 established, carried over verbatim** (they are not weakened assertions, they are how a row survives JSDOM):

1. **Never assert on a live DOM node.** A failing `actual` that is a DOM node makes node's reporter `util.inspect` a JSDOM document and hangs the run. Assert on a serialisable value (`textContent`, `getAttribute`, an array of strings).
2. **A row that opens a Radix menu or dialog must dispose its own mount.** An open modal plus the next row's dropdown deadlocks JSDOM. Rows that interact call `dispose()`.

`A6C7-8` is a **PRESERVATION** row: not claimed as failing-first, and it must not be made to fail at the base.

## 3. Additive supersession only (AGENTS.md §16)

Corrections are **additive**. Never delete an assertion, a control or an evidence row to close a finding — mark it superseded **in place, with a comment saying what replaced it and why**, and add the replacement beside it.

| Conflicting row / assertion | File | What replaces it |
|---|---|---|
| Any assertion that row 2 shows **no** shortage line while the source is degraded, or that the cover button is absent/unreachable in a degraded state | `a6-c5-outage*.test.tsx` | Mark superseded, naming §1.1. The replacement asserts visibility in **both** states and adds the degraded-state row `A6C7-1`. **Do not delete the old row** — its `isLive` rationale is the historical record of why c5 shipped the gate. |
| `/Last saved data — Assign teachers to open classes/`, `/Last saved data — Bautista, Ana has no load/`, `/Last saved data — Cruz, Rene is over the weekly max/` (`a6-teaching-load-surface.test.tsx` ≈2684, 2693, 2724) | same | Mark superseded, naming §1.4. Replacement: the titles are unprefixed in every state, and the chip still carries exactly one status claim. |
| Any test naming the exported `isLive` | wherever | Mark superseded, naming §1.1; the replacement asserts `hasShortageToShow`/`figuresVerified` behaviour, not the old name. |
| `A6C6-5` (`teachingLoadUnverifiedStatus`'s four plain sentences) and the c6 `xl`-width rows | `a6-c6-calm-teaching-load.test.tsx` | **Keep unchanged.** c7 does not re-word c6's copy. If a c6 row breaks, that is a real regression to fix in the source, never to weaken the row. |
| Timetable `Change owner` rows | `draft-ux-c01.test.tsx`, `timetable-truth-labels-a2.test.ts` | **Out of scope. Do not touch.** |

## 4. Gates to run, and the baseline you are judged against

Run **every** gate below at the UNCHANGED base first, record the literal tally, then again at the candidate. Required: **base-or-better on every gate**, with any failure that is present at the base named as pre-existing by its exact failing-row name, plus the new `test:a6-c7-shortage-undo` green, plus `npm run typecheck` with **zero new** errors.

| gate | why it is in the list |
|---|---|
| `test:a6-c5-outage` | owns the surface §1.1 changes; the supersession table lives in it |
| `test:a6-c6-calm-tl` | c6's own gate; the header, the pickers and the copy must be untouched |
| `test:a6-c7-shortage-undo` | **new** |
| `test:a6-teaching-load` | owns the repair-queue chip and the draft action bar (§1.4, §1.3) |
| `test:a6-tl-header-budget` | polices row 2's height and control count at 1366 |
| `test:a3-teachers-load` | owns `C2-5` / `a3-teaching-load-review-c2` and the `Edit assignments` entry §1.2's judgement depends on |
| `test:a3-c4-tl-truth` | owns the draft truth + the draft action bar's Undo/Redo/Discard/Save |
| `test:a3-c10-tl-density` | polices header density at 1366 |
| `test:a3-c10-workload-audit` | shares the repair-queue vocabulary |
| `test:tl-no-demand-hotfix` | owns the `N classes still need a real teacher` sentence §1.1 must not disturb |
| `npm run typecheck` | baseline recorded by you at the base; **zero new** errors |

If a gate is red at the base, record the literal failing row name and leave it alone unless this change is what broke it.

**Rendered evidence is required and is not optional (AGENTS.md §11 "Done means seen").** A source assertion is not acceptance evidence for a user-facing change. Capture at **1366×768**, before and after, with mocked `/api/v1` routes, in the **degraded (`cached`)** state and the healthy (`live`)** state, and record:

1. `/teaching-load`: the shortage line's **exact text** in both states, whether `teaching-load-cover-open` exists and is enabled, the number of visible chips on row 2, and the chip's full text (one line, no truncation) — the before must show the generic sentence and no line/button.
2. `/teaching-load` in the **Sections** view: a draft assignment, with the confirmation block and the `Undo` control in the same screenshot, plus the trigger's visible text (`Assign teacher` / `Change teacher`).
3. The header's control count and the first teacher row's height, unchanged unless §1.1/§1.4 changed them — state the number either way.

Use `scripts/dev/start-preview.ps1 -ClientDir <dir> -Port <p>` with `VITE_ATLAS_API=http://127.0.0.1:5101` (**staging** — never the default `127.0.0.1:5001`, which is LIVE, AGENTS.md §5) and the Playwright MCP. Label every capture `ISOLATED_LOCAL_BROWSER`; it is not ATLAS acceptance. If staging is not answering, record the row `BLOCKED(staging-unreachable)` with the command and its output — do not substitute a guess, and do not point the preview at live.

## 5. Hard boundaries

- **Client only.** Any `atlas-server/`, `prisma/`, `ops/`, lockfile, `.env` or migration path in your diff: stop and report it.
- **No `Get-Content | Set-Content` round-trip on any repository file** (AGENTS.md §2). Use the Edit tool.
- **No `npm ci`/`npm install` in this worktree** — its `atlas-client/node_modules` is already installed from `package-lock.json` and is a real directory, not a junction. Do not delete it.
- Do not start a server in a foreground tool call. `scripts/dev/start-preview.ps1` for previews; `scripts/dev/start-detached.ps1` for anything else. Long gates over ~10 minutes go through `start-detached.ps1` with a log you poll.
- Do not touch `docs/plans/live-state.md`, `docs/handoffs/lane-c-to-a2.md`, any other lane's files, or the c6 packet. The planner owns the continuity documents.
- AGENTS.md §8 1000-physical-line cap. **`TeachingLoad.tsx` is at 990** — extract before you add, do not cross 1000. `SectionGridMode.tsx` is at 534, `TeachingLoadRepairQueue.tsx` at 219, `useTeachingLoadOutage.ts` at 148.
- One commit, conventional message, only your assigned paths, `git diff --cached --check` clean before committing. **Additive corrections are a new commit; never amend.**

## 6. Handoff to return (one page, no transcripts)

- Base SHA · candidate SHA · exact changed paths.
- **Why c5's surface did not render on staging**, in one paragraph, with the file and line that decided it.
- The §0.1 layout note **as implemented**, with any deviation named and why.
- The failing-first evidence: literal command, per-row failing assertion text at the base, and the command that turned it green.
- The §4 gate table **as measured**, base and candidate, with pre-existing failures named.
- The rendered capture: the exact texts and numbers from §4.3, in both states, before and after.
- Follow-ups recorded, not done here: the Sections view's all-caps styling; the identical `…owner…` question on the timetable page.
- Known risks, each marked `BLOCKING` or `NON_BLOCKING`.
- Verdict. Worktree disposition: `KEEP_ACTIVE` (the planner retires it after integration).

## Addendum 11:40 — planner correction round 1 (independent QA `CORRECTION_REQUIRED`, 10/12 mandatory, 1 unperformed)

**This is a bounded correction round, not a redesign. One additive commit on the same branch. Never amend `951bec35`.**

QA (`mandatory 12 / passed 10 / blocked 0 / unperformed 1`) verified the source, the gates (8/8, 23/23, 11/11, 31/31, 9/9, typecheck 5 pre-existing), the additive supersession and the failing-first split as **clean**. Two things must be closed.

### C1 (BLOCKING) — in the degraded state, the pill and the shortage line must not both render

The executor changed `WorkspaceToolbar.tsx:905-923` from c5's either/or ternary into siblings, so the amber pill and the shortage line now render **together** whenever the source is degraded and classes lack a teacher. QA's finding, which is the substance of this correction:

- No gate measures that state. `a6-tl-header-budget.test.ts:178-186` renders row 2 with only `stateLineSlot`, so the only state this slice changes is unmeasured.
- On that gate's own declared basis (`TEXT_XS_ADVANCE_PX = 6.6`), the declared worst state was **1306.8px of 1334px = 27.2px of slack (4.1 chars)**, with wrap declared a fallback, not the design. The new line alone declares **396px**, plus `+2 more` 46px and `Cover these classes` 125px, on a text-only basis that ignores chrome. Row 2 is `flex-wrap`, so the projected outcome is a second line inside the band — the always-wrapped header c6 removed and the operator rejected.

**Ruling — invert the precedence; do not shorten a fact.** c5's ternary was `degradedLead ? <pill> : hasShortageLine ? <line> : <sentence>`, and the degraded pill winning that order is the original defect: the surface vanished exactly when the scheduler most needs it. The corrected order is **`hasShortageLine ? <line> : degradedLead ? <pill> : <sentence>`** — the shortage line takes the slot, and the pill returns when there is **no** shortage to show.

Why this is the right composition and not a silencing:

- **Two chips that say the same thing is a §8 violation, before width enters it.** The pill says the roster is the last saved one; the shortage line's existing `· <date> roster` clause says the same thing. Rendering both was always the "two claims, one fact" defect; this slice merely made it visible. The saved-roster fact now has one home on the row.
- **No capability is lost by not rendering the pill in that state.** c6 §1.5.3 made the header's **primary action** the retry; the pill was never the retry. When there is no shortage, the pill returns unchanged with its c6 copy and its technical `Tooltip`.
- **Every figure survives.** The per-subject breakdown, the total, the date clause, `+N more`, `Cover these classes` and the cover dialog's drift re-check are all untouched.
- Record the precedence in a code comment at the site, with this reasoning in two or three lines.

**New row `A6C7-9`** (in the same committed file and the same `test:a6-c7-shortage-undo` script — a row no gate runs is not evidence): with a **cached** source **and** a shortage, row 2 renders the shortage line and the degraded pill is **absent**; with a cached source and **no** shortage, the pill renders and the line is absent; with a **live** source and a shortage, the line renders and the pill is absent. **Mutant row:** restore the pill-first precedence → red. Also keep the existing one-filled-amber-surface ratchet check in `A6C7-3` — with the line taking the slot in the degraded state, the band carries **no** filled amber surface at all, and the row must say so.

### C2 (BLOCKING) — the rendered row (§4.3) is still owed, and it is not a formality

QA recorded it `UNPERFORMED`; the executor's session ended on it. It must be performed and it must be performed **on the corrected tree**. Concrete recipe, so the second attempt is not the first attempt again:

1. **Get past the auth guard.** `AppShell` calls `verifySessionWithinDeadline()`, which short-circuits to `no-token` and redirects to `/login` **before** any request — which is why the executor's `page.route` catch-all never fired. Seed the token before the app boots: `page.addInitScript` writing `sessionStorage.setItem('atlas_local_token', 'qa-mock-token')` (key from `src/lib/auth.ts:2`), then route `**/api/v1/**`.
2. **Answer exactly what the page asks.** Read the fetch list out of `src/hooks/useTeachingLoadData.ts` plus the page's own calls, and answer each one from a fixture. A route you have not implemented must `fulfill` a `501` and log the URL, so a missing fixture is loud instead of silently falling through to a real staging call.
3. **One fixture, two states.** Drive `dataSource` (`cached` vs `live`) and the degraded notice from a flag in the mock handler, so the before/after pair differs only in that state.
4. Serve the client with `scripts/dev/start-preview.ps1 -ClientDir <dir> -Port <p>` (never in a foreground call; the script pins `VITE_ATLAS_API` to staging `5101`, and **no** mocked call may escape to it), capture with the Playwright MCP at **1366×768**, and assert `window.location.origin` on every capture. Label every capture `ISOLATED_LOCAL_BROWSER`.
5. Report, per state: the shortage line's exact text, whether `teaching-load-cover-open` exists and is enabled, **row 2's chip count and its exact composition** (which of pill / line / sentence rendered), the chip's full text, the header's control count, the first teacher row's height, and **row 2's `scrollHeight` vs its single-line height** — the wrap question is the point of C1, so measure it.
6. A **before** capture of the same surfaces is wanted: build one preview from the base sources (`git checkout 4244cd3e -- <the 9 product paths>`, capture, then `git checkout HEAD -- <those paths>` — the candidate is committed, so this is safe), or state plainly that the before is unavailable and why.

**If a faithful full-page fixture is still unreachable, do not fake it and do not return nothing.** Report `UNPERFORMED` with the literal endpoint list that blocked it, after a bounded attempt, and commit the C1 fix with its gates green. A committed C1 with an honest unperformed row is worth more to the integrator than a soft render.

### C3 (NON_BLOCKING, cheap — fix while you are in the file)

1. `a6-teaching-load-surface.test.tsx:2673` — the supersession comment names `useTeachingLoadQueue.ts`; the real file is `useTeachingLoadRepairQueue.ts`.
2. `A6C7-8:852` counts lines with `split('\n').length`, which reports `TeachingLoad.tsx` as **1000** — at the cap by that method while the file physically holds **999**. Count physical lines the way the rest of the repo's rows do, and report the number you actually measured.
3. `A6C7-3`, `A6C7-5`, `A6C7-7` label clauses `MUTANT` that exercise a **local detector string**, not a mutated implementation. Relabel them `DETECTOR self-test` (or make them real implementation mutants). Do not leave a row wearing a name it does not earn — a gate that claims to discriminate something it does not is a false report.
