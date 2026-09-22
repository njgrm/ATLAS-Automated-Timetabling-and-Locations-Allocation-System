# TIMETABLE-RELAXED-MAIN-C01 — relaxed main Class Schedule workspace (bundled cycle)

**Status:** `READY`. **Risk:** MEDIUM client source; the bundled deployment + browser acceptance are
HIGH and run under the operator's **standing authorization** for this program (`AGENTS.md` §13). No
gate is waived: independent pre-action review, one executor per candidate, one fresh independent
post-action QA, browser rows labelled as browser rows, and a real `passed/blocked/unperformed` tally.
**Owner:** Lane A. **Disposition:** `KEEP_ACTIVE` until the release closes.

**Executor worktree (already provisioned — do not create another, do not clone):**
`E:\ATLAS-worktrees\timetable-relaxed-main-c01`, branch `work/timetable-relaxed-main-c01`, base
`origin/main` = `384e74a6d4c53987836e5d0d3cae2ae1f18738d3`, clean. `atlas-client` dependencies
installed.

**Baseline evidence (the measured before-state; re-measure and show deltas):**
`docs/reviews/timetable-relaxed-main-c01/baseline-qa.md` (committed with this packet).
**Design source:** `docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md` — its §3 finding
register, §6 relaxed-header contract, §6.2 relaxed-view rules and §7 interaction inventory are
normative for this packet where they do not conflict with the operator's checklist.
**Invariants:** `docs/reference/agent-timetable-invariants.md` — read before touching term scope,
schedule views, latest-run reads or query shaping.

**Read-only reference, do NOT merge or cherry-pick:** `work/timetable-live-term-authority-c01`
(`b8e2e48e`, 5 unreviewed commits) already attempted the term-authority gate. It is stale-based and
conflicts with current `main` (4 of its files moved). Read it for approach; implement fresh here.

---

## 0. What this cycle is

The operator's verdict: the subpage-header correction is live and correct, but **the main Class
Schedule workspace is still dense and hard to read at a glance.** This cycle finishes the relaxation
on the main workspace, the placement/swap interaction, and the data layer behind them, then deploys
and browser-accepts the result.

The governing rule (audit §6): **the grid is the page; everything else is one click away.**

Two candidates, one release, sequential commits in the same worktree:

- **Candidate A — `C01`**: the "understandable at a glance" work (term authority, density collapse,
  one next action, term labels, coherent authority state, sub-page/nav hygiene, scroll restoration,
  router warnings, typography floor, warning prioritisation).
- **Candidate B — `C02`**: the interaction and data-layer work (universal inline preview-before-save,
  short contextual guidance, request-waterfall reduction, mobile first paint, both-viewport
  re-verification).

**Commit a coherent candidate at each boundary** (`AGENTS.md` §11 checkpointing). Candidate B is
additive on top of A; both are reviewed together as one range.

---

## 1. Candidate A — deliverables (all measurable)

### A1 — Term authority: verified active term, fail-closed on ambiguity
- On load the term switcher selects the **verified** active ordered term (currently Term 2). The
  verification must come from the canonical ordered-term authority, not from a cached school-year
  context alone.
- **Term 1 is used only when no terms are configured at all.** When term identity is unknown,
  unverified, or ambiguous, the surface must say so in plain language and **must not silently select
  Term 1**. Missing term identity is unresolved authority (`agent-timetable-invariants.md`).
- The switcher must not merge terms or encode rotation as a badge.

### A2 — Term labels on stacked entries (and kill the duplicated label)
- Fix the literal duplicated trigger text **"TERM TERM 2(active)"** → a single clean label.
- Every stacked entry in a cell under `All terms` must carry a **visible term label**, so
  `TLE / P. CRUZ · Room 103 · G7AW` ×3 becomes three distinguishable entries. All term-specific
  sessions stay rendered **immediately** — do not introduce any "Show 1 more class" reveal (none
  exists today; do not add one).

### A3 — Density collapse on the main workspace
- **One status region**, replacing the current **8** status surfaces. One plain-language chip:
  *"Ready to generate"* / *"4 issues to fix"* / *"Published"*.
- **One primary action**, derived from lifecycle state. The `NEXT STEP` row must name **the same**
  action as the primary — not a seventh competing action.
- Cap simultaneous header controls at **~5**; everything else goes to a sub-page or `More`.
- Relocate to `/timetable/setup`: `Fix Rooms`, `Preview impact`, `Sync with setup`. Remove the
  duplicate `Generate schedule` from `More`. Move `Status key`, `Tutorial`, `Download` and
  `Day options` out of the main header row (More, or their sub-page).
- **Measured target:** grid top **≤ ~180 px** of a 768 px viewport (from 332 px), and the header
  bands from 5 → 2.

### A4 — One coherent authority state (no contradiction)
- *"Run inputs are stale"* and *"Verified with EnrollPro · …"* must **never** render simultaneously.
  Derive one status from one source and render one. An unreachable upstream is a distinct typed
  state, not a second banner contradicting the first.
- No raw enum codes, "fingerprint", "confirmation text", "capability override" or
  `<codes.join(', ')>` on any scheduler-facing surface.

### A5 — Sub-page and navigation hygiene
- Sub-pages must **not** repeat the schedule header's status surfaces (`/setup` and `/exports`
  currently advertise that they do).
- The draft surface gets a sub-nav home: add **Draft** (`/timetable/pre-generation`) to the sub-nav.
  `/map`, `/manual-edit`, `/building` stay in-flow tools but each must be reachable from a **labelled
  control** on the index — no orphan route.
- Clear the **49** `"Matched leaf route … does not have an element or Component"` warnings across the
  nine `/timetable*` routes.

### A6 — Draft surface renders (the unperformed baseline row)
- `/timetable/pre-generation` must render the pre-generation draft when the ordered-term authority is
  available. **First reproduce the baseline failure with EnrollPro confirmed healthy** (it was 200 at
  baseline close). If it does not reproduce, record it as a transient upstream condition with the
  evidence and do **not** chase it; if it does reproduce, fix the state machine so the page never
  claims *"No active school year found"* while the same app shows an active year.

### A7 — Scroll restoration
- Preserve the grid's `scrollTop` across `/timetable` → sub-page → `/timetable`. Run, term, layout,
  filters, entity and view mode already survive — do not regress them.

### A8 — Warning prioritisation and typography floor
- Warning markers must **prioritise**: only cells in the active review set carry a marker, and
  severity is differentiated. Do not flag every cell identically.
- Typography floor **12 px** everywhere inside Timetable, including the `/map` 10 px leaf.

### A9 — Preserve (regression guards)
Subpage chrome relaxation from `7dbb3b90`; the no-scroll architecture at **1366×768 and 390×844**;
**no workspace remount** on sub-nav; state preservation; jargon-free surfaces; the inline place/swap
panels and their copy; ordered-term authority; actor-school scope; the strict publication predicate;
and the scope-clear hygiene in `ScheduleReviewWorkspace.tsx`.

---

## 2. Candidate B — deliverables

### B1 — Universal inline preview-before-save
- Ordinary placement must **preview the consequence before saving, inline** — not only for warned
  slots. Today a clean slot commits immediately. Add an inline ghost/preview with the consequence
  stated and a single **Confirm**, then keep **Undo**. **No modal per placement.**
- Swap keeps its inline preview. Unassigned-session placement keeps its inline queue, with the
  consequence visible before saving and less copy.

### B2 — Short contextual guidance
- Keep the good Simple copy; make the plain-language guidance **visible to sighted users** in the
  Advanced header too (`#timetable-foolproof-help` is currently `sr-only`). Keep it short — no walls
  of instructional text, no 7-step wall as the only entry point.

### B3 — Request waterfall and first paint
- Deduplicate the per-sub-page fetches (baseline: setup 17, policies 16, runs 16, building 15,
  manual-edit 14, exports 12, pre-generation 11) so navigating index → sub-page → index does **not**
  repeat an endpoint already resolved in the same session.
- Make the first paint **progressive**: shell + sub-nav + a skeleton render immediately; the grid
  fills when the latest run resolves. The baseline blocked at 390×844 with 0 visible controls for
  **> 8 s**.
- **Record the measured before/after numbers and the literal method.** Treat an upstream 502 as an
  environmental factor, not a defect to chase; state upstream reachability at the moment you measure.

### B4 — Both viewports re-verified
- Re-measure 1366×768 and 390×844: no global scrollbar, no horizontal clipping, readable controls,
  no overflow. Preserve the clean baseline numbers.

---

## 3. Boundaries — do not break

- **Client source only** (`atlas-client/**`), plus the two test manifests if a new script is needed.
  **No server, DB, migration, generation, publication, or schema change.**
- No `docs/**` or `CHANGELOG.md` edits (the planner owns continuity docs).
- No companion-repo edits (EnrollPro/AIMS/SMART are READ_ONLY).
- Do not weaken the publication gate, ordered-term identity, actor-school scope, or the scope-clear
  hygiene.
- No file above the **1000 physical line** cap; `@/ui` primitives only — no raw unstyled `<button>`,
  no `title`, no raw `<details>`, no native `<select>`.
- Do not add a "Show N more" reveal anywhere.
- Do not merge, cherry-pick, or modify `work/timetable-live-term-authority-c01`.

## 4. Gates — run and paste literal results

1. `npm run test:client-suite` (record the tally; must be green).
2. `npm run build` with `VITE_ENROLLPRO_URL` exported (the fail-closed guard exits 1 without it).
3. `npm run typecheck`.
4. `git diff --check` and `git diff --cached --check`.
5. **New/changed tests must be reachable from a committed `package.json` script** (`AGENTS.md` §11).
   Add a focused script for this stream and name every new file in it.
6. **Failing-first control** for at least one behaviour claim: the term-authority fail-closed path
   (unknown/ambiguous identity must not become Term 1) or the preview-before-save consequence.
7. **Fixtures come from the real surface** — take the term/entry fixture from the real authority
   shape, never a fixture that already contains the expected text.
8. **Prove the outcome, not the wiring:** exercise the real entry path (route entry, the click, the
   deep link) and assert the resulting state.

## 5. Browser acceptance (post-deployment, fresh QA, both viewports)

Labelled **browser rows**, decided on the **deployed** release at
`https://njgrm.buru-degree.ts.net`, asserting `window.location.origin`, at **1366×768 and 390×844**:

1. Main workspace: one status region, one primary action, grid top ≤ ~180 px, header controls ≤ 5.
2. Term: verified active term selected on load; unknown/ambiguous identity never silently becomes
   Term 1; `All terms` shows every term session immediately **and labelled**; no "TERM TERM N".
3. No contradictory authority banners; no jargon or raw codes on any of the nine routes.
4. Draft surface renders (or a typed, honest state), reachable from the sub-nav.
5. Placement: inline preview with the consequence visible before saving, one Confirm, **no modal**;
   Undo works. Swap and unassigned placement likewise.
6. Scroll position survives `/timetable` → sub-page → `/timetable`; term/entity/view/filter survive.
7. No workspace remount on sub-nav.
8. 1366×768 and 390×844: no global scrollbar, no clipping, readable controls, no overflow.
9. Console: zero router element-less warnings; zero new errors.
10. **Older-scheduler lifecycle pass**: draft → repair → review → published, read-only except
    authorised draft placement/undo. No Generate, Publish, Sync, Apply, Delete, capability override,
    or published-revision mutation.

## 6. Evidence to return (one page per candidate)

Base SHA · candidate SHA · exact changed paths · what changed per deliverable · the literal command
and result for every gate · the measured before/after for A3 (grid top, header bands, status
surfaces, controls) and B3 (calls per route, first paint) · known risks each marked `BLOCKING` or
`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Corrections are additive commits on the same branch —
never amend, rebase, or force-push.
