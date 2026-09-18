# ATLAS Timetable Relaxed-View UX Audit (UX-AUDIT-C01)

- **Status:** `OPEN — INCOMPLETE`. This is a durable evidence capture so the team can
  circle back. It is **not** an acceptance record and authorizes **no** product,
  deployment, generation, or publication action.
- **Audit base:** `origin/main` `74c1f12a` (see §1.3 — the base advanced mid-audit).
- **Live deployment audited:** client bundle built from `f0d65a53`.
- **Environment:** live Tailnet `https://njgrm.buru-degree.ts.net` (origin asserted on
  every browser row).
- **Date:** 2026-09-18 (Asia/Manila).
- **Author:** primary planner (browser + source evidence).
- **Scope:** Timetable UX/UI, desktop-first. Mobile explicitly deprioritized by the
  operator. Advanced view explicitly out of rehaul scope ("a lost cause").
- **Companion prior art:** `docs/design/atlas-smart-ux-convergence-contract.md`
  (on unintegrated branch `work/smart-ux-audit-c01` @ `7d047989`).

---

## 1. Evidence provenance and honesty statement

### 1.1 Evidence classes used below

| Class | Meaning |
|---|---|
| `RENDERED-LIVE` | Observed in a real browser on the live Tailnet this session. Strongest. |
| `SOURCE-TRACED` | Read from repository source at a named commit. Not visually confirmed. |
| `MEASURED` | Numeric measurement taken via DOM/`getComputedStyle` on the live page. |
| `NOT-YET-VERIFIED` | Enumerated from source but **not** interacted with in the browser. |

### 1.2 What the browser session actually covered

- **Authenticated session:** one fresh login was authorized by the operator. Expected
  database delta was named as **+1 `LOCAL_LOGIN_SUCCESS` row** plus the actor's
  `last_login_at`, all other signatures `0`. One prior login attempt returned **401**
  due to a credential-parsing defect (see §2.5); that attempt may have produced a
  failure audit row and is disclosed here.
- **Read-only discipline:** no Save / Apply / Generate / Publish / Delete / Sync was
  invoked. Network capture of the `/timetable` session shows **reads only** (all 200).
- **Session cleanup:** the local token was cleared and `/timetable` was re-probed,
  redirecting to `/login` with no token remaining. No persistent JWT left behind.
- **Console:** zero errors on `/timetable`. The only console error in the session was
  the deliberate 401 from the mis-parsed first login attempt.

### 1.3 Base-move disclosure (important)

`origin/main` **advanced during the audit**: `f0d65a53` → `74c1f12a`
(`fix(timetable): surface Generate and Publish in the Simple header action row`).
The audited worktree `release-client-quality-01` also moved to `74c1f12a`, so early
source reads in this session reflect `f0d65a53` and later reads reflect `74c1f12a`.
Every finding below names its class; where source and render disagree, the render is
reported as authoritative and the commit for each is stated.

### 1.4 Explicit gaps (do not over-read this document)

- Only **one** ATLAS timetable surface was reachable pre-login
  (`/public/schedules`); the scheduler workspace required login.
- The **Simple-view interaction matrix is partial** — see §7 for exactly which
  controls were exercised and which remain `NOT-YET-VERIFIED`.
- No **rendered** evidence was captured for `Teacher`/`Room` grid pivot modes,
  the selection strip, the details sheet, filters, the left rail, the right panel,
  or the Advanced view in this session.
- Credential values were never read into this document, echoed to shell output, or
  committed.

---

## 2. Continuity findings (planner-owned, must close before successor dispatch)

### C-01 — Living register is stale (BLOCKING for sequencing)
`docs/plans/atlas-active-delivery-streams.md` was last reconciled **2026-09-14**.
`origin/main` has since carried `release/client-quality-01`, `export-presentation-*`,
`rollover-graded-autonomy`, `timetable-cell-info`, `ux-quickfix-c01`, and more.
The register must be reconciled before any successor handoff.

### C-02 — Orphaned prior art: `SMART-UX-AUDIT-C01` (BLOCKING for scope)
Branch `work/smart-ux-audit-c01` @ `7d047989` holds ~1,153 lines of directly relevant
work and is **not** in `origin/main` and **not** in the register:
- `docs/reports/smart-registrar-teacher-ux-identity-audit-2026-09-12.md`
- `docs/design/atlas-smart-ux-convergence-contract.md` (17 sections, incl. §15 Simple
  Timetable adaptations)
- `docs/handoffs/atlas-smart-ux-convergence-handoff-2026-09-12.md`

Its ATLAS findings (`ui/card.tsx` zinc hardcoding, no shared `PageHeader`) are **still
live** at `74c1f12a` (see F-13, F-14). **Recommendation: adopt/refresh it as the UX
authority rather than authoring a competing contract.**

### C-03 — Base moved mid-audit (PROCESS)
See §1.3. Another session pushed to `origin/main` while this audit ran. Future audits
must pin a commit and re-verify it at completion.

### C-04 — Worktree capacity (PROCESS)
109 registered worktrees; `D:` free 23.31 GiB (**below the 25 GiB warn threshold**);
`E:` free 60.15 GiB. This audit used `E:` per the directive and retires its worktree
after pushing the artifact branch.

### C-05 — QA credential file is markdown-backtick-wrapped (PROCESS)
The local credential file wraps values in inline-code backticks, so a naive
`key: value` parse yields `` `https://…` ``, `` `1234567` ``, `` `password` ``.
Submitting the backtick-wrapped values produced the 401 in §1.2. **Future agents must
strip leading/trailing backticks and quotes before use.** (No values recorded here.)

---

## 3. Finding register

Severity: `P0` blocks the operator workflow · `P1` major comprehension/effort cost ·
`P2` consistency/accessibility · `P3` polish.

| ID | Sev | Class | Finding | Evidence |
|---|---|---|---|---|
| **F-01** | P0 | SOURCE-TRACED | `/timetable` hosts **six** center views in one route: `schedule`, `pre-generation`, `policy`, `manual-edit`, `map`, `building` — plus 2 presentation modes × 2 layout modes × 4 left-rail tabs × right panel × dock. Several already exist as their own nav entries (`/map`, `/teaching-load`, `/faculty/preferences`), so the same concept is implemented twice. | `CenterWorkspace.tsx:377-490,558-733`; `ScheduleReviewWorkspaceHeader.tsx:565-590`; `navigation.ts:26-43` |
| **F-02** | P0 | RENDERED-LIVE + SOURCE-TRACED | **No breadcrumb trail exists.** `ui/breadcrumb.tsx` is a complete shadcn breadcrumb set with **zero importers**. `AppShell` computes a `breadcrumbs` array then renders only a two-line eyebrow + title. There is no clickable ancestor path and no depth indicator. | grep: 0 consumers of `ui/breadcrumb.tsx`; `AppShell.tsx:438-452,507-516`; live header shows only "Timetable" |
| **F-03** | P0 | RENDERED-LIVE | **The "Simple" view is not simple.** Rendered header = 3 stacked rows (source/warnings/controls row, hidden-rows row, NEXT STEP row) over the grid, plus a drift banner and a fixed bottom selection strip when a class is selected. Source-level, the workspace renders **11 simultaneous surfaces**. | Live screenshot 2026-09-18; `ScheduleReviewWorkspace.tsx:283-425,553-592`; `TimetableSimpleHeader.tsx:386,517,878-905` |
| **F-04** | P1 | RENDERED-LIVE / MEASURED | The **More menu contains 17 items in 4 groups** (Daily tasks 5 · Help 3 · Expert tools 5 · Schedule data 4). By contrast the public page's More menu has **2 items**. | Live enumeration, `/timetable`, 2026-09-18; `SimpleMoreMenuContent.tsx:56-205` |
| **F-05** | P1 | SOURCE-TRACED + MEASURED | **Advanced header = 1018 lines / ~77 control references.** Visible at once: status badge, source badge, run selector, Refresh, Publish, Plan-before-generating, Continue-draft, More-tools, 5 task buttons, input-state banner (4 actions), toolbar (5 selects/toggles) + 5 filter chips, stats, presence avatars. Out of rehaul scope per operator decision, but it is why the page reads as overwhelming. | `ScheduleReviewWorkspaceHeader.tsx` (1018 lines); grep counts |
| **F-06** | P1 | RENDERED-LIVE | **A warning triangle is rendered on essentially every grid cell** (113 warnings; every one of the ~40 visible cells carries ⚠). Ubiquitous warnings convey no prioritisation and make the grid visually alarming. | Live screenshot 2026-09-18; `readinessLabel` → "113 warnings"; `TimetableSimpleHeader.tsx:170-189` |
| **F-07** | P1 | RENDERED-LIVE / MEASURED | **Per-cell text is dense and partly redundant.** A cell renders subject + `TEACHER · G7 Room 103 · G7AW`, repeating the grade twice ("G7 Room 103" and "G7AW"). Detail lines measure 211×16 px with `overflow:hidden` → truncated. | `data-testid="timetable-cell-detail"` ×~40, each `211×16`, `overflowHidden:true`; `TimetableGrid.tsx:531-558` |
| **F-08** | P1 | SOURCE-TRACED | **Database-administration vocabulary is on the operator surface.** The tactical dock exposes a "Qualification / department authority" module with alias/label key-value row editors and a server confirmation-phrase apply gate, plus a redistribution panel that prints raw enum codes to the user: `Canonical blockers: <codes.join(', ')>`. | `TacticalSandboxDock.parts.tsx:115-119,167-240` |
| **F-09** | P1 | MEASURED | **Sub-12 px text.** Public schedule: **397** visible leaf nodes <12 px, of which **260 are exactly 9 px** (grade badges `GR7`, line-height 12.86 px) and 134 at 11 px. Timetable Simple workspace: **16** leaf nodes <12 px (9–11.2 px) — materially better than the public page, but still below a comfortable floor for older desktop users. | `getComputedStyle` measurements, 2026-09-18 |
| **F-10** | P1 | SOURCE-TRACED | In the Advanced header the plain-language guidance block (`#timetable-foolproof-help`, incl. the genuinely good line *"No precision dragging required."*) is wrapped in `sr-only`, so **sighted users never see it** and must rely on one of 126 tooltips. Simple compensates with a **7-step tutorial dialog**. | `ScheduleReviewWorkspaceHeader.tsx:849-859`; live tutorial "Step 1 of 7" |
| **F-11** | P2 | RENDERED-LIVE + SOURCE-TRACED | **Status key is duplicated three ways:** the `TimetableStatusLegend` component, a separate "Status key" entry in the More menu, and a hand-rolled copy of the six `STATUS_ITEMS` inside the Simple header's own dialog. Two source copies invite drift. | `TimetableStatusLegend.tsx:12-19` vs `TimetableSimpleHeader.tsx:602-616` |
| **F-12** | P2 | RENDERED-LIVE | Duplicated label in the term switcher: renders **"TERM TERM 1"** (label "TERM" + value "TERM 1"). | Live aria text `TermTERM 1Available terms…` |
| **F-13** | P2 | RENDERED-LIVE | **Design-token drift.** `ui/card.tsx` hardcodes `zinc-200/50/100/900/400`; `SmartCommandBar` hardcodes `text-slate-900`/`slate-500`. Live DOM confirms `bg-zinc-50/60`, `text-zinc-900`, `text-zinc-400`, `text-slate-900`, `text-slate-500` on rendered pages. | `ui/card.tsx:9,22,33,44`; `smart/SmartPageShell.tsx:134-135`; live class census |
| **F-14** | P2 | SOURCE-TRACED + RENDERED-LIVE | **The best ATLAS UX is on the least important page.** `SmartCommandBar` (eyebrow + title + subtitle + status chips + one NEXT STEP card + one primary + Help + More) is exactly the requested "relaxed view" — and it is used by `/public/schedules`, `Dashboard`, `MapEditor`, `MySchedule`, `RoomSchedules`. **Timetable and Teaching Load use none of it.** | `PublicPublishedSchedule.tsx:475`; importer scan; live public screenshot |
| **F-15** | P2 | RENDERED-LIVE | Collapsed sidebar shows truncated text bleed at the bottom left (partial glyphs "A", "CUR", "N", "E" visible over the grid edge). | Live screenshot 2026-09-18 |
| **F-16** | P2 | RESOLVED | "Generate"/"Publish" are absent from the live Simple header. **Root cause: not a live bug** — the deployed bundle is built from `f0d65a53`, while `74c1f12a` (committed during this audit) surfaces them. Live bundle scan confirms `timetable-simple-more-trigger` present but `-generate-action`/`-publish-action` absent. **Pending deployment, not a defect.** | Live bundle scan of `ScheduleReviewWorkspace-CrDesWav.js`; `74c1f12a` commit |
| **F-17** | P3 | RENDERED-LIVE | The `1 earlier row hidden` chip plus a `Show full day` button occupy an entire header row for a rare case, at 24 px height. | Live screenshot; `TimetableSimpleHeader.tsx:534-571` |
| **F-18** | P3 | SOURCE-TRACED | The Simple primary action renders a `ChevronDown` affordance although it dispatches an action rather than opening a menu — a **possible false affordance** requiring verification. | `TimetableSimpleHeader.tsx:793,806` (`ChevronDown` inside action buttons) |

---

## 4. What is already good — do not break

1. **Simple/Advanced split exists** and the operator's last real choice was **Simple**
   (`atlas_timetable_layout_mode = "simple"`, `atlas_pregen_active = "1"`). Finish
   Simple rather than abandon it.
2. **No-scroll architecture holds.** `htmlScrollHeight == clientHeight == 768`; the only
   scrollbar is the sanctioned inner `flex-1 min-h-0 overflow-auto` region.
3. **No horizontal clipping at 1366×768** in the Simple grid (Mon–Fri all visible).
   (The public matrix does clip: `overflow-x-auto` `scrollWidth 900` vs `clientWidth 853`.)
4. **Readability in Simple is materially better than the public page** (16 vs 397
   sub-12 px nodes).
5. **Scope hygiene is hard-won** — `buildScopeKey`/`clearScopeState` clears
   sheet/task/swap state on school/year/run/term change. Any route split must preserve it.
6. **Ordered-term authority, actor-scope, and the strict publication predicate** are
   load-bearing invariants from earlier waves.
7. **Zero console errors** and clean read-only network behaviour on `/timetable`.

---

## 5. Rendered measurements (2026-09-18)

| Metric | Timetable Simple (`/timetable`) | Public schedule (`/public/schedules`) |
|---|---|---|
| Visible interactive controls | 61 total = 13 shell + 8 header + 40 grid entries | 28 |
| Header structure | 3 stacked rows + column header | single command bar |
| More-menu items | **17** in 4 groups | **2** |
| Visible leaf text < 12 px | 16 (9–11.2 px) | **397** (260 at 9 px) |
| Global window scroll | none ✅ | none ✅ |
| Horizontal clipping | none at 1366×768 ✅ | **47 px clipped** |
| Console errors | 0 | 0 |
| Live data | S.Y. 2031-2032, Term T1, Run #316, 113 warnings, Section "Luna" | 2,760 classes / 20 sections |

---

## 6. Target information architecture (relaxed view)

Governing rule: **the grid is the page; everything else is one click away.**

```
ATLAS / Timetable                       ← breadcrumb trail (ui/breadcrumb.tsx)
├── /timetable            Relaxed grid + ONE status + ONE primary action
├── /timetable/setup      Readiness, input freshness, drift, "what's missing"
├── /timetable/policies   Scheduling policy, shift windows, soft weights
├── /timetable/runs       Run history, run selector, revisions, edit history
├── /timetable/exports    Beneficiary downloads + presentation settings
├── /timetable/help       Status key (one copy), tutorial, how-it-works
└── /map                  Campus/rooms (dedupe the in-Timetable map views)
```

### 6.1 Relaxed header contract (one row)

`Breadcrumb │ S.Y. + Term │ [one status chip] │ [one primary action] │ More`

- One primary action, derived from lifecycle state.
- Status chip in plain language only: *"Ready to generate"*, *"4 issues to fix"*,
  *"Published"*.
- Cap simultaneous header controls at ~5; everything else → sub-page or `More`.
- No `More` item may be a different page's feature wearing a wrong label (today
  "Input status" silently navigates to `/faculty/preferences`).

### 6.2 Relaxed view rules

1. **One status region** replacing the stacked strips/banners.
2. **Typography floor:** nothing below `0.75rem` (12 px) inside Timetable; body 14 px.
3. **Copy rule:** no enum codes, "fingerprint", "confirmation text", or "capability
   override" on operator surfaces; diagnostics go behind an explicit Admin gate.
4. **One help entry point** per page; one `STATUS_ITEMS` source.
5. **Breadcrumbs everywhere**, built on `ui/breadcrumb.tsx` + `breadcrumbGroups`.
6. **Advanced view:** stop investing; keep it reachable behind an "Expert" entry.
7. **Warning signal must prioritise** — do not flag every cell identically.

---

## 7. Simple-view interaction inventory (the "circle back" checklist)

Executed this session (read-only): **open + enumerate**, then close.

| # | Control | Status | Result / note |
|---|---|---|---|
| 1 | View-mode select (`timetable-simple-view-mode-select`) | ✅ INTERACTED | 3 options: Section, Teacher, Room |
| 2 | Entity select (`timetable-simple-entity-select`) | ⚠ PARTIAL | Rendered as "Luna"; list not enumerated |
| 3 | Term switcher (`timetable-simple-term-filter`) | ✅ INTERACTED | 4 options: All terms, TERM 1, TERM 2, TERM 3 |
| 4 | Tutorial (`timetable-simple-tutorial-trigger`) | ✅ INTERACTED | 7 steps; Back disabled at step 1; Show me present |
| 5 | Download (`timetable-simple-export-trigger`) | ✅ INTERACTED | 3 items: Summary workbook, Class program, Teacher program signatories |
| 6 | More (`timetable-simple-more-trigger`) | ✅ INTERACTED | 17 items in 4 groups (F-04) |
| 7 | Status key (`timetable-status-legend`) | ✅ INTERACTED | 6 states; duplicates `STATUS_ITEMS` (F-11) |
| 8 | Show full day (`timetable-show-full-day-toggle`) | ❌ NOT INTERACTED | Mutates view state; deferred |
| 9 | Primary action (`timetable-simple-primary-action` = "Review warnings") | ❌ NOT INTERACTED | Enters workflow mode |
| 10 | Drift banner (`SimpleDriftBanner`) repairs | ❌ NOT INTERACTED | Not visible in this state |
| 11 | Task prompt / NEXT STEP row | ✅ OBSERVED | Renders "Review warnings · 113 warnings" |
| 12 | Filters dialog (More → Filters) | ❌ NOT INTERACTED | 3 selects (Program, Entry type, Attention) per source |
| 13 | Publish-readiness summary / sheet | ❌ NOT INTERACTED | Not rendered in this state |
| 14 | Grid entry click → selection strip | ❌ NOT INTERACTED | Required next |
| 15 | Selection-strip More menu | ❌ NOT INTERACTED | Required next |
| 16 | Simple details sheet | ❌ NOT INTERACTED | Required next |
| 17 | Left rail tabs (Violations/Unassigned/Pinned/Requests) | ❌ NOT INTERACTED | Not visible in this Simple state |
| 18 | Right panel | ❌ NOT INTERACTED | Advanced path |
| 19 | Cell "Show N more classes" overflow | ❌ NOT INTERACTED | No >2-entry cell in view |
| 20 | Hidden-rows chip tooltip | ❌ NOT INTERACTED | Hover only |
| 21 | Sidebar collapse/expand, user menu, sign-out | ⚠ PARTIAL | Token cleared programmatically, not via UI |
| 22 | Accessibility options (`AccessibilityMenu`) | ❌ NOT INTERACTED | |
| 23 | Simple→Advanced toggle | ❌ NOT INTERACTED | Out of rehaul scope |
| 24 | Teacher/Room pivot modes | ❌ NOT INTERACTED | Only Section rendered |
| 25 | `UnassignedInsertionWorkflow` ("Preview demand") | ❌ NOT INTERACTED | Not rendered in this state |
| 26 | `ExportPresentationSettingsDialog` | ❌ NOT INTERACTED | |
| 27 | `TacticalSandboxDock` modules | ❌ NOT INTERACTED | Not visible in Simple state |

**Write-risk controls deliberately not touched:** Generate, Publish, Sync with Setup,
Plan draft / "Plan before generating", Teacher-leaving reassignment, Teaching Load
owner apply, capability-override apply, any Save/Apply/Delete.

**To complete the audit:** re-authenticate, then exercise rows 2, 8–10, 12–27 in one
pass, capturing console + network per interaction. Rows 14–16 (selection → repair
actions) are the highest-value remaining interaction because they carry the daily
operator loop.

---

## 8. Proposed staged streams (all client source; no HIGH actions)

| Stream | Scope | Risk | Depends on |
|---|---|---|---|
| **UX-R00** | Reconcile the living register with `origin/main`; land/refresh `SMART-UX-AUDIT-C01` as the UX baseline and fix its stale base | LOW docs | — |
| **UX-R01** | Primitives: promote `SmartCommandBar` → single `PageHeader`; wire `ui/breadcrumb.tsx` into `AppShell`; fix `ui/card.tsx` + `SmartCommandBar` tokens; typography scale tokens | LOW/MED | UX-R00 |
| **UX-R02** | **Simple strip-down**: one status region, one primary, one help; exports/setup/filters/sheets to sub-page links; typography floor; warning-prioritisation | MED | UX-R01 |
| **UX-R03** | **Route split**: `/timetable/policies`, `/runs`, `/setup`, `/exports`; dedupe `/map`; preserve scope-clear + ordered-term invariants | MED | UX-R02 |
| **UX-R04** | Move `TacticalSandboxDock` technical modules + raw enum codes to an Admin surface | MED | UX-R03 |
| **UX-R05** | Advanced-view demotion to "Expert" (entry point only) | LOW | UX-R03 |

**Non-negotiable boundaries for every stream:** do not weaken publication gates,
ordered-term identity, actor-school scope, or the scope-clear hygiene in
`ScheduleReviewWorkspace.tsx:104-137`. No server, DB, migration, generation,
publication, deployment, or shared-runtime changes. Desktop-first.

---

## 9. Open decisions

1. **Baseline:** adopt/refresh `SMART-UX-AUDIT-C01` as the UX authority (recommended),
   or supersede it with a new contract?
2. **Activation:** confirm the scope tier and activate the cycle so `UX-R01` can be
   dispatched against a pinned `origin/main`.
3. **Deployment:** `74c1f12a` (Simple Generate/Publish surfacing) is integrated in
   `origin/main` but **not deployed**. Decide whether a bounded deploy is in scope.
4. **Full live interaction pass:** authorize a second login to complete §7 rows
   14–27 (the daily operator loop).
5. **Register/worktree hygiene:** close C-01 (register) and C-04 (109 worktrees;
   `D:` at 23.31 GiB, under the 25 GiB warn line).

---

## 10. Change log

| Date | Author | Change |
|---|---|---|
| 2026-09-18 | primary planner | Initial capture: live rendered + source-traced audit, continuity findings, interaction inventory (partial). |
