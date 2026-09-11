# ATLAS × SMART UX Convergence Contract

- **Stream:** `SMART-UX-AUDIT-C01`
- **Status:** design contract for review. **This document is not product implementation authority.**
  It defines the target surface so the primary planner can author bounded executor streams; nothing
  here authorizes code changes, migrations, deployment, generation, or publication.
- **Evidence base:** `docs/reports/smart-registrar-teacher-ux-identity-audit-2026-09-12.md`
- **SMART reference:** `D:\smart-final-capstone` at `c3806e12` (READ_ONLY)
- **ATLAS base:** `origin/main` `904818d4`
- **Binding rule:** SMART is a visual/interaction benchmark. ATLAS remains the scheduling authority,
  retains the EnrollPro/HNHS branding contract, and preserves all specialized Teaching Load and
  Timetable functional structures. Simplicity must never hide an actionable blocker.

---

## 0. Principles

1. **Restraint is the aesthetic.** One accent (`--primary`), neutral surfaces, white cards, no
   decorative gradients on routine app chrome, no glassmorphism.
2. **Hierarchy through weight, not size.** A page has exactly one title level; sections use weight and
   muted labels, never oversized hero text.
3. **One canonical shell, one canonical header, one canonical table, one canonical state set.**
   Consistency is the product.
4. **Fewer simultaneous primary actions.** A page exposes at most one visually dominant primary
   action; everything else is secondary, in "More", or in context.
5. **Empty, loading, degraded, and error states are features**, each with a next action where one
   exists.
6. **Blockers stay visible.** Never reduce functional safety, never hide a hard blocker, never let a
   calm surface imply readiness that the diagnostic has not proven.
7. **Complexity is disclosed, not deleted.** Teaching Load and Timetable keep their workspaces; the
   convergence makes their hierarchy legible and their state truthful.

---

## 1. Shell and navigation

### 1.1 Contract

- **Single shell:** `atlas-client/src/components/AppShell.tsx` owns the frame. Pages must not create
  competing app frames.
- **Header height:** standardize on one height (recommend `h-14`, the current ATLAS value) for every
  authenticated route. SMART uses `h-16`; ATLAS may keep `h-14` but must be uniform.
- **Header content:** back/trigger control, breadcrumb eyebrow + page title, right-side context badges
  (active year, active term), accessibility menu, and at most one global offline/sync badge.
- **Sidebar:** grouped, uppercase section labels at ~10px, pill-shaped active item filled with
  `--primary`, `rounded-full`, icon `w-5 h-5`. Keep the existing `AppSidebar` +
  `app-shell/navigation.ts` group model (`Navigation`, `School Setup`, `Teachers and Rooms`,
  `Timetable`, `Review and Publish`, `Audit`, `My Portal`).
- **Mobile:** drawer + bottom nav for faculty. Preserve the current `MobileNavigationDrawer` and
  `FacultyMobileBottomNav`.
- **Year/term badges:** the shell shows "Active year: …" and "Active Term: …" derived from the one
  authoritative resolver (`AppShell.tsx` `verifyActiveSchoolYear`), never from a page-local guess.
- **Discoverability exception:** `/admin/year-setup` stays deliberately out of nav (destructive/archive
  semantics) but must always be linked from the Dashboard readiness checklist and the rollover notice.

### 1.2 ADOPT / ADAPT / DO_NOT_COPY

| Item | Class | Rationale |
|---|---|---|
| Grouped pill sidebar with uppercase group labels | ADOPT | Directly reduces scanning cost; ATLAS already matches. |
| Single sticky, blurred topbar with eyebrow + title + context badges | ADOPT | ATLAS already matches (`AppShell.tsx:455-504`). |
| Sidebar collapse persisted in a cookie/localStorage | ADAPT | SMART uses role-specific localStorage; ATLAS uses a `sidebar:state` cookie. Keep the cookie, do not add a second key. |
| SMART's fixed 280px/70px widths | ADOPT | Same rhythm; ATLAS sidebar tokens already exist. |
| SMART's per-role duplicate layouts (`RegistrarLayout`/`TeacherLayout`) | DO_NOT_COPY | ATLAS has one shell with role-aware nav; duplicating layouts invites drift. |

---

## 2. Page headers

### 2.1 Contract

- Introduce **one** `PageHeader` (or promote `SmartCommandBar` to that role) and deprecate hand-rolled
  page titles. Target shape:
  - eyebrow (optional, uppercase, `text-[0.65rem] font-bold text-primary`)
  - title (`text-2xl font-bold tracking-tight text-foreground`)
  - one-line subtitle (`text-sm text-muted-foreground`)
  - source/status chip (optional)
  - right-aligned actions: at most one primary, the rest `outline`/`ghost`, overflow into a `More`
    menu when > 3.
- The existing `SmartCommandBar` (`atlas-client/src/components/smart/SmartPageShell.tsx:97-147`)
  already implements title/eyebrow/subtitle/source/next-action/primary/help/more. **ADAPT** it into
  the single header rather than writing a new one.
- Every primary page must use it. No page may render its own `<h1>` except DepEd document/print
  surfaces (sanctioned exception).

### 2.2 ADOPT / ADAPT / DO_NOT_COPY

| Item | Class | Rationale |
|---|---|---|
| SMART `PageHeader` (title + optional description + actions + badge) | ADOPT | ATLAS has none; this is the largest single consistency win. |
| `SmartCommandBar` as the ATLAS header | ADAPT | Already present; unify rather than duplicate. |
| Eyebrow + title + context badges in the topbar | ADOPT | ATLAS already has it; keep. |
| SMART's per-page duplicate `h1` on document/school-form pages | DO_NOT_COPY | Official SF grids are documents, not app chrome. |

---

## 3. Year and term context

- **Single authority:** all year/term labels derive from the shell's verified context
  (`resolveActiveSchoolYearContext` / `activeTerm`). Pages must not hardcode S.Y. strings. The
  teacher dashboard fallback `"2029-2030"` is a defect to remove, not a pattern to copy.
- **Context badges:** "Active year" and "Active Term" appear in the shell; pages may show a
  term-scoped label inside their own header subtitle but must not contradict the shell.
- **Historical distinction:** when viewing an archived year, the header must carry a visible
  read-only/archived indicator (ATLAS already has the rollover notice and `?view=history` route).
- **ADOPT:** visible S.Y. badge (SMART `RegistrarLayout.tsx:359-363`). **ADAPT:** add term badge
  (ATLAS already does). **DO_NOT_COPY:** hardcoded fallback years.

---

## 4. Typography

| Role | Classes | Token source |
|---|---|---|
| Page title | `text-2xl font-bold tracking-tight text-foreground` | `PageHeader` contract |
| Page subtitle | `text-sm text-muted-foreground` | semantic tokens |
| Card/section title | `text-base font-semibold text-foreground` | `ui/card` `CardTitle` |
| Card description | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | `ui/card` `CardDescription` |
| Table header | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | table primitive |
| Table cell | `text-sm text-foreground` | table primitive |
| Stat label | `text-xs font-medium text-muted-foreground` | stat card |
| Stat value | `text-2xl font-bold tabular-nums text-foreground` | stat card |
| Eyebrow | `text-[0.65rem] font-bold uppercase tracking-wide text-primary` | command bar |

- **One family strategy.** SMART uses one family (DM Sans) with weights carrying hierarchy. ATLAS
  currently splits body `Inter Variable` and headings `Poppins` (`index.css:12-13`). **ADAPT:** keep
  ATLAS's branding freedom (HNHS/EnrollPro contract), but freeze the **roles** above so hierarchy is
  stable; do not add a third family.
- **Ban:** `font-black` on app chrome (reserve for login hero only), and raw `text-slate-*/zinc-*/gray-*`.
- **ADOPT:** SMART's modest page title scale. **DO_NOT_COPY:** SMART's `font-black` dashboard hero
  and 5xl login title bleeding into app chrome.

---

## 5. Spacing and density

- Page root: `space-y-6`; use the full-height shell pattern
  `flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden` + `flex-1 min-h-0 overflow-auto` (ATLAS
  global frontend constraint; SMART is a normal document scroll — **do not copy SMART's page scroll**).
- Grids: `gap-4` for dense stat rows, `gap-6` for section columns.
- Card padding: `px-6 py-4` header, `px-6 py-5` content, `p-4` compact variant.
- Max content width: `max-w-[1440px]` for dashboards, `max-w-7xl` for lists (already used).
- **Density target:** no first-viewport page may show more than ~6 primary surfaces. Collapse the
  rest behind disclosure or a tab.

---

## 6. Cards and visual grouping

- One `Card` primitive (`atlas-client/src/ui/card.tsx`) with `rounded-xl`, border, layered soft
  shadow, `bg-white`, `CardHeader` muted band, `CardContent`, optional `CardFooter`.
- **Hard rule:** `ui/card.tsx` must use semantic tokens, not `zinc-*`. Current hardcoded
  `zinc-200/80`, `zinc-50/60`, `zinc-100`, `zinc-900`, `zinc-400`
  (`atlas-client/src/ui/card.tsx:10,26,36,47`) are violations.
- Group inner content with `bg-muted/50` flat rows, not nested bordered boxes.
- Stat tiles: prefer `StatCard`-style tiles (label/value/icon/tone) over bespoke gradient tiles.
- **ADOPT:** SMART neutral card + muted header band. **DO_NOT_COPY:** gradient hero cards, glass/
  backdrop-blur decorative overlays, or 19-card dashboards.

---

## 7. Actions

- **Primary:** at most one per page/view; `--primary` fill, `rounded-xl`, `h-10`.
- **Secondary:** `outline`; **tertiary:** `ghost`; **overflow:** `More` dropdown for > 3 actions.
- **Destructive:** tinted `bg-destructive/10 text-destructive` (SMART's restrained treatment), never
  a solid red button unless it is the single confirmed destructive primary in a confirmation dialog.
- **Labels are verbs and outcomes.** Ban ambiguous names ("Process", "Run", "Submit"). Use
  "Generate timetable", "Publish schedule", "Sync from EnrollPro".
- **No dead controls.** Any `href="#"` or `onClick`-less button is a defect (see audit P0-1).
- **Every mutation** must show an in-flight state and a success/failure result; destructive actions
  must confirm with an explicit object name.
- **ADOPT:** SMART's tinted destructive + single-primary discipline. **DO_NOT_COPY:** SMART's
  dead "Forgot password?"/legal links and non-functional "Remember me".

---

## 8. Tables and lists

- Standard lists use the canonical table system:
  `atlas-client/src/components/admin-workspace/AdminDataTable.tsx` where suitable, or a promoted
  equivalent of SMART's `DataTable` family, with:
  - toolbar (search + filters + actions) — search `pl-9 w-full sm:w-64`, debounced ~300ms
  - loading skeleton mirroring column geometry
  - empty state (icon + title + hint + optional action)
  - error state (destructive tint + Retry)
  - footer: "Showing X to Y of Z", rows-per-page select, first/prev/pages/next/last
- **1-based pagination everywhere.** Kill the 0-based/1-based split.
- **No page may hand-roll a second pagination convention** when the canonical footer exists.
- Exceptions: the class-record ledger, SF form grids, and print matrices keep raw primitives.
- **ADOPT:** SMART `DataTable`/`TableStates`/`TableToolbar`/`TablePagination`. **ADAPT:** rows-per-page
  set and defaults to ATLAS's current values. **DO_NOT_COPY:** SMART's `ui/pagination.tsx` orphan and
  the bespoke `StudentRecords` footer.

---

## 9. Dialogs, drawers, and sheets

- Prefer a **sheet/drawer** for record inspection and a **dialog** for focused confirmations.
- **Modal-overload budget:** if a page needs > ~4 modal types, move persistent context into the page
  and reserve modals for confirmation or short forms.
- Every dialog: explicit title, one-sentence description, `Cancel` + one primary, focus trap, `sr-only`
  close label, escape-to-close.
- Destructive confirmations name the object and consequence (SMART's `EOSYConfirmDialog` is a good
  template).
- **ADOPT:** SMART's focused confirm dialog. **DO_NOT_COPY:** 20–30 dialog refs per page.

---

## 10. Loading, empty, degraded, and error states

| State | Contract |
|---|---|
| Loading | Skeleton that mirrors the real layout; no full-page spinner for in-page fetches; retain shell/header. |
| Empty | Icon + plain title + one-line hint + one next action. Search-aware copy. |
| Degraded | Amber banner ("Showing saved data") with the source and age, plus exactly one Retry. Never imply readiness. |
| Error | Destructive-tinted card + specific recovery copy + Retry. Distinguish offline vs unauthorized vs server error. |
| Offline | Reuse the shell offline badge; queued-write surfaces must say what is queued. |

- ATLAS already has `SmartEmptyState`, `SmartErrorState`, `SmartLoadingState`
  (`SmartPageShell.tsx:298-357`) — **ADAPT** these as the single state set rather than per-page copies.
- **ADOPT:** SMART's state components. **DO_NOT_COPY:** decorative "igniting your dashboard" spinners
  and generic "Oops!" copy.

---

## 11. Blocker and repair presentation

- A blocker is **never** hidden to look calm. Contract:
  1. one plain-language statement of the blocker,
  2. the smallest true repair (single link/action),
  3. where to verify the repair succeeded.
- ATLAS `pickNextStep`/`deriveDerivedDemandRepair` (`Dashboard.tsx:181-316`) is the model: authority
  order (source → term structure → subject metadata → coverage → rooms → generation). **ADOPT** and
  reuse across Teaching Load and Timetable, do not fork a second blocker taxonomy.
- The Dashboard's "source health" popover pattern (`Dashboard.tsx:463-499`) is a good ADAPT: a chip
  that opens the exact repair links.
- **DO_NOT_COPY:** SMART's "Stale (Xm)"-only badge with no repair path.

---

## 12. Responsive behavior

- Breakpoints: `lg` 1024px for sidebar/drawer swap; `sm` for compact badges; `md` for table→card.
- Mobile targets: minimum 44px hit area (`index.css:195-200` already enforces this).
- Table-heavy pages must provide a mobile card list (SMART `StudentRecords.tsx:411-491` is the
  reference) instead of horizontal scroll alone.
- **ADOPT:** SMART's table→card mobile transform. **DO_NOT_COPY:** print-first 2000-line forms as the
  default mobile surface.

---

## 13. Archived / historical context

- Archived years are read-only and visually distinct: a persistent muted "Archived" chip in the
  header, disabled mutation controls, and a clear "Return to active year" action.
- Never allow an archived surface to look like the active one; never let archived data populate an
  active-year readiness verdict.
- **ADOPT:** ATLAS already models this (`AdminYearSetup.tsx:117-138`, `teaching-load?view=history`);
  standardize the archived chip across routes.

---

## 14. Teaching Load adaptations

**Objective:** keep the allocation workspace; adopt SMART's calm hierarchy.

- Keep `TeachingLoad.tsx` + `TeacherGridMode`/`SectionGridMode`/`WorkloadInspector`/
  `SectionInspector`/`TeachingLoadDraftActionBar`.
- Replace the bespoke `WorkspaceToolbar` header with the unified page header; move mode/filter
  controls into a secondary toolbar row.
- One primary action at a time (e.g. "Save draft" only when dirty; otherwise the next guided step).
- Blockers (missing coverage, cap exceeded) use the shared blocker card and link to the repair queue.
- Guided vs expert mode stays; guided mode is the default for ordinary work.
- **ADOPT:** SMART's single-primary + muted toolbar. **ADAPT:** SMART's `StackedWorkloadBar` idea for
  load distribution. **DO_NOT_COPY:** generic dashboards replacing the allocation grid.

---

## 15. Simple Timetable adaptations

**Objective:** keep the grid, placement, and repair workflows; adopt SMART navigation/feedback/disclosure.

- Keep `ScheduleReviewWorkspace`, rails, matrix, and dialogs.
- Adopt the unified header; keep the rail workspace but make the current lifecycle phase and the one
  next action unmistakable.
- Feedback: every placement/undo must confirm the resulting state (ATLAS's one-click clean placement
  + prominent Undo is the accepted contract — preserve it).
- Disclosure: hard blockers in a persistent, readable panel; soft violations behind a confirm dialog
  that names each violation.
- Never hide a hard blocker to reduce visual load.
- **ADOPT:** SMART's `SmartCommandBar`/`SmartNextStepCard` progress language. **ADAPT:** SMART's
  `RotationBanner` three-term disclosure for ATLAS rotation subjects. **DO_NOT_COPY:** collapsing the
  grid into a generic card list.

---

## 16. ADOPT / ADAPT / DO_NOT_COPY matrix

| SMART pattern | Class | ATLAS action |
|---|---|---|
| Grouped pill sidebar + uppercase group labels | ADOPT | Already aligned; keep. |
| Sticky topbar with eyebrow + page title + S.Y. badge | ADOPT | Keep; add term badge (already present). |
| Single `PageHeader` component | ADOPT | Create/promote one; remove per-page `<h1>`. |
| Neutral card + muted header band | ADOPT | Fix `ui/card.tsx` tokens. |
| `DataTable` + states + canonical pagination | ADOPT | Promote one canonical list system. |
| Tinted destructive action | ADOPT | Standardize. |
| Table→card mobile transform | ADOPT | Apply to list pages. |
| Search-aware empty state with next action | ADOPT | Standardize. |
| Blocker chip that opens repair links | ADAPT | Reuse `pickNextStep` authority order. |
| Three-term rotation disclosure banner | ADAPT | Apply to rotation subjects in Timetable. |
| Live "in session now" class card | ADAPT | Keep ATLAS faculty dashboard value, in a compact card. |
| SMART 280px/70px sidebar widths | ADAPT | Keep ATLAS cookie state; unify widths. |
| Two font families (body + heading) | ADAPT | Freeze roles; do not add a third family. |
| Gradient page wash | ADAPT | Keep ATLAS's token-driven wash; do not add decorative card gradients. |
| Per-role duplicate layouts | DO_NOT_COPY | ATLAS keeps one shell. |
| Gradient/`font-black` dashboard heroes | DO_NOT_COPY | Use the command bar + stat tiles. |
| 19-card / 3×-KPI dashboards | DO_NOT_COPY | One next step, ≤4 stat tiles, disclosure for the rest. |
| 20–30 modal refs per page | DO_NOT_COPY | Sheet/inline for context; dialogs for confirmation. |
| 2000-line print-first form files | DO_NOT_COPY | Keep document renders isolated; extract app chrome. |
| `href="#"` legal/recovery links, non-functional "Remember me" | DO_NOT_COPY | Every control must do something or be removed. |
| Synthesized sparklines | DO_NOT_COPY | Show only measured data. |
| Hardcoded red focus rings / hardcoded fallback years | DO_NOT_COPY | Use tokens and the live resolver. |

---

## 17. Non-negotiable safety invariants

1. No recommendation in this contract may reduce functional safety, hide an actionable blocker, or
   weaken a confirmation on a destructive action.
2. Teaching Load, Timetable, Generation, and Publication authorities are unchanged.
3. SMART remains READ_ONLY; no stream may edit SMART.
4. ATLAS branding stays contract-driven from the EnrollPro public settings surface; the default
   emerald and a school maroon must both render correctly.
5. The global frontend constraints in `AGENTS.md` (no-scroll shell, inline stat banners, DepEd grade
   colors, shadcn primitives, 1000-line file cap) remain in force.
