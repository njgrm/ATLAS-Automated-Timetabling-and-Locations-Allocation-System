# TIMETABLE-RELAXED-MAIN-C01 — baseline QA of the deployed timetable (2026-09-23)

Read-only inspection of the **live release `7dbb3b90`** on `https://njgrm.buru-degree.ts.net`, one
authorised login, logged out at the end (`/auth/me` → 401 `NO_TOKEN`). No Save/Apply/Generate/
Publish/Sync/Delete/placement/capability-override was invoked. One occupied cell was *selected* (no
placement). Method: live DOM, `getBoundingClientRect` + `getComputedStyle`, `performance.getEntriesByType('resource')`.
This artifact is the design input for `TIMETABLE-RELAXED-MAIN-C01`; the QA of that candidate must
re-measure these numbers and show the deltas.

## 1. Measured baseline

| Metric | `/timetable` (Simple) | Notes |
| --- | --- | --- |
| Visible interactive controls | **74** (16 `button`, 16 `a[href]`, 3 combobox, **39 `div[role=button]`** grid entries) | prior audit measured 61 |
| Status surfaces | **8** | status-region, input-drift, rollover-guidance, rollover-dismiss, source-chip, readiness-chip, task-prompt, status-legend |
| Full-width header bands | **5** | input-drift@104, rollover card@132, chip row@165, day options@219, NEXT STEP@247 |
| Chrome above the grid | **grid starts at y=332 of 768 → ~35 % of the viewport** | the single most damaging number |
| More-menu items | **10** in 2 groups | prior audit 17 |
| Visible leaf text < 12 px | `/timetable` **0**; `/map` **1 @10 px** | 12 px floor otherwise holds |
| 1366×768 | `scrollH == clientH == 768`, `scrollW == clientW == 1366` | no global bar, no clip |
| 390×844 | `scrollH == clientH == 844`, `scrollW == clientW == 390` | numerically clean |
| Mobile first paint | body still "Loading timetable: finding the latest run first…" at **8 s**, **0 visible controls**; rendered at **16 s** | |
| API calls, first load `/timetable` | **17** (incl. 2 × 502) | |
| API calls per sub-page | setup **17**, policies 16, runs 16, building 15, manual-edit 14, exports 12, pre-generation 11 | no dedupe across navigation |
| Workspace remount on sub-nav | **none** — `timetable-center-panel` same DOM node | do not break |
| State preserved across SPA nav | term ✓, entity ✓, view mode ✓, active filter ✓, **scroll ✗ (`scrollTop` → 0)** | |
| Console | **49 ×** router warning "Matched leaf route … does not have an element or Component"; 14 × 502 `UPSTREAM_UNREACHABLE read ECONNRESET` | |

## 2. Findings

**P0 — none.**

**P1 (all `NON_BLOCKING` for the deployed release — density/comprehension, not functional regressions)**
- **P1.1 Density persists.** 74 controls, 5 stacked header bands, 8 status surfaces, grid at y=332.
  Controls to delete from the header: `Fix Rooms`, `Preview impact`, `Sync with setup` (all duplicate
  `/timetable/setup`), the duplicate `Generate schedule` in More, `Status key`, `Tutorial`,
  `Download`, `Day options`.
- **P1.2 No single next action.** Six concurrent actions (`Generate`, `Publish schedule`,
  `Review warnings`, `Fix Rooms`, `Preview impact`, `Sync with setup`) plus `NEXT STEP / Review
  warnings` naming a seventh.
- **P1.3 All-terms entries are indistinguishable.** With `All terms`, 39 cells × 3 entries = 117
  detail nodes; every entry reads identically (e.g. `TLE / P. CRUZ · Room 103 · G7AW` ×3) with **no
  term label**, while `data-timetable-entry-id="entry-3::t1"` proves they are different terms. All
  sessions *are* rendered immediately — there is **no** `Show 1 more class` reveal left to remove.
- **P1.4 Pre-generation draft surface did not render (UNPERFORMED row).** `/timetable/pre-generation`
  once showed *"No active school year found. Retry Open Year Setup"* while the same app concurrently
  showed *"Active year: 2031-2032"*; on other loads it sat at *"Loading timetable: finding the latest
  run first…"*. No draft grid was reachable. **EnrollPro was verified healthy (200) after this pass**,
  so this must be re-tested before being treated as a code defect rather than a transient upstream
  condition.
- **P1.5 Contradictory authority banners.** *"Run inputs are stale"* rendered simultaneously with
  *"Verified with EnrollPro · 2031-2032 · Run #316"*; earlier the same session showed *"Can't reach
  EnrollPro right now … Using cached school year"* then flipped to Verified.
- **P1.6 Mobile first paint > 8 s.**

**P2**
- **P2.1 "TERM TERM N" duplication confirmed.** Switcher trigger text is literally
  **"TERM TERM 2(active)"** / **"TERM TERM 3"** (the dropdown options themselves are clean).
- **P2.2 Sub-pages repeat the schedule header's status surfaces** (`/setup`: "The same setup controls
  as the schedule header"; `/exports`: "The same official downloads as the schedule header").
- **P2.3 Orphan routes.** Sub-nav has only Schedule/Setup/Policies/Runs/Exports; `/timetable/pre-generation`,
  `/map`, `/manual-edit`, `/building` have **no navigation entry** (URL/in-flow only).
- **P2.4 Scroll position lost** on navigation (term/entity/view/filter survive).
- **P2.5 Plain-language guidance is `sr-only` in the Advanced header** (`#timetable-foolproof-help`
  contains "No precision dragging required." + place/swap instructions). Simple *does* show equivalent
  guidance visibly.
- **P2.6 49 router warnings** for the element-less `/timetable*` leaf routes.

**P3** — `/timetable/map` single 10 px leaf; `Day options 1 hidden` occupies a full 24 px row.

## 3. What is already good — do not break

1. No-scroll architecture holds at **both** 1366×768 and 390×844.
2. Typography floor: 12 px minimum on Timetable views (except `/map`).
3. **No workspace remount** on sub-nav — node identity preserved.
4. Term, entity, view mode and the active filter survive SPA navigation, with a visible `Filters 1`
   badge, removable chip and `Clear all`.
5. Plain-language place/swap guidance is visible in Simple and genuinely good ("A clean slot saves
   immediately…", "Teachers stay assigned to their classes").
6. **Jargon is absent** from Timetable surfaces — 0 hits for `fingerprint`, `confirmation text`,
   `capability override`, `codes.join`, `enum`, `allowlist` on all nine routes.
7. More menu already reduced 17 → 10; Generate/Publish are surfaced.
8. Place and swap are **inline, mouse-first, 0 modals**; unassigned-session surface is a clear inline
   queue with good copy.

## 4. Placement / swap as found

- **Place unresolved sessions** — inline, 0 modals. Copy: *"Choose one session from the queue, then
  choose a green slot on the grid. A clean slot saves immediately (Undo appears after); a slot with
  warnings shows a review before saving."* → **preview-before-save is not universal**: only warned
  slots review; clean slots commit immediately.
- **Swap class times** — inline, 0 modals, preview before save. *"Teachers stay assigned to their
  classes."*
- Modals appear only for Filters, Tutorial (7 steps) and sign-out confirmation.

## 5. Not verifiable read-only

The pre-generation draft grid; any published-run state (no published run exists — run #316 is
COMPLETED/Reviewing); all write-risk controls; Teacher/Room pivot modes; Advanced internals;
Accessibility menu; Download menu; the **verified** active term via EnrollPro (upstream intermittently
unreachable during the pass; healthy afterwards); the ambiguous-term state (not forceable without a
mutation).

## 6. Operator checklist mapping (as found)

| # | Item | Result |
| --- | --- | --- |
| 1 | default to verified active term | partial — defaults `TERM 2(active)` ✓, verification cached only |
| 2 | All Terms shows all sessions immediately | pass-with-defect — all rendered, but unlabelled (P1.3) |
| 3 | reduce density / one next action | **fail** (P1.1, P1.2) |
| 4 | no jargon / no irrelevant notifications | jargon pass; **fail** on contradictory banners (P1.5) |
| 5 | preserve focused subpages | partial (P2.2, P2.3) |
| 6 | compact smart header | **fail** (P1.1) |
| 7 | QA starts from a draft | **unperformed** (P1.4) |
| 8 | short contextual guidance | pass in Simple / fail in Advanced (P2.5) |
| 9 | mouse-first, preview-before-save, inline | partial (inline + mouse-first ✓; preview only for warned slots) |
| 10 | modals only for high-impact | pass |
| 11 | simpler unassigned surface | pass |
| 12 | measured waterfalls, fewer fetches/remounts | partial (no remount ✓; 11–17 fetches/sub-page ✗) |
| 13 | preserve run/term/layout/filters/scroll | partial (scroll lost, P2.4) |
| 14 | 1366×768 + 390×844 clean | pass numerically; slow mobile paint (P1.6) |
