# SMART Registrar & Teacher UX/UI Identity Audit — ATLAS Convergence Evidence

- **Stream:** `SMART-UX-AUDIT-C01`
- **Audit date:** 2026-09-12 (Asia/Manila)
- **Mode:** read-only, evidence-first, non-destructive click-path
- **Return verdict:** `REVIEW_REQUIRED` (this document is a bounded candidate, not an acceptance)
- **ATLAS base SHA:** `904818d4aa6365df267a1a2c8a37857ec7e848d7` (`origin/main`)
- **ATLAS audit branch/worktree:** `work/smart-ux-audit-c01` @ `D:\ATLAS-worktrees\smart-ux-audit-c01`
- **SMART repository:** `D:\smart-final-capstone`, READ_ONLY
- **SMART inspected SHA:** `c3806e12eb7852c58337149c403b7edc4e12abf3` (branch `main`, `git status --short` empty before and after)
- **SMART remote:** `https://github.com/madebyseaan/smart-final-capstone.git`

---

## 1. Method, boundaries, and honest coverage

This audit inspected SMART's Registrar and Teacher experiences plus the shared shell, login, theme,
and UI primitives those roles consume. The SMART Admin portal and the entire AIMS system were out of
scope. No SMART or ATLAS product source, test, configuration, lockfile, database, or generated file
was modified. The only ATLAS writes are the three documentation files named in the governing packet.

### 1.1 SMART pin and remote drift

- Local SMART clone was clean (`git status --short` produced no output) at the packet-observed commit
  `c3806e12`.
- `git fetch origin --prune` showed `origin/main` advanced to `1bda23399204414f8d21c9fddbdf6b41a8e440d4`.
- `git merge-base --is-ancestor c3806e12 origin/main` exited `0`, so the packet-pinned commit is a
  valid ancestor of the new remote tip.
- **Decision:** the audit is pinned to the packet-named `c3806e12` and the local clone was **not**
  fast-forwarded, so findings are reproducible against the exact commit named in the packet. The
  remote advance to `1bda233` is disclosed and was not inspected.

### 1.2 Live SMART origin discovery (not guessed)

Trusted evidence chain, in order:

1. `D:\smart-final-capstone\docs\ARCHITECTURE_MICROSERVICES.md:32-34` documents *"SMART (Grading &
   Academic Records) … Tailscale Host: `100.93.66.120` (Port 5003)"*.
2. `tailscale status` mapped `100.93.66.120` to device `laptop-pfvh73qk` (owner `seanromaa`, the
   SMART repository author).
3. `Resolve-DnsName laptop-pfvh73qk.buru-degree.ts.net` returned `100.93.66.120`.
4. `GET https://laptop-pfvh73qk.buru-degree.ts.net/` returned HTTP 200 with
   `<title>SMART - Academic Grading System</title>` and the built Vite bundle
   (`/assets/index-BuIs8gNJ.js`).
5. `GET https://laptop-pfvh73qk.buru-degree.ts.net/api/health` returned HTTP 200
   `{"status":"ok","timestamp":"2026-09-11T16:11:32.925Z"}`.

**Confirmed live SMART browser origin: `https://laptop-pfvh73qk.buru-degree.ts.net`.** The ATLAS
Funnel (`njgrm.buru-degree.ts.net`) was confirmed by `tailscale serve status` to proxy only to
`http://127.0.0.1:5174` (ATLAS), and was not used as SMART evidence.

### 1.3 Browser coverage actually achieved

| Surface | Status | Evidence |
|---|---|---|
| Shared login `/login` | Audited live | Playwright MCP, origin asserted |
| Registrar login `/login/registrar` | Audited live | Playwright MCP snapshot + network |
| Admin login `/login/admin` | Out of scope | Not tested |
| Authenticated Registrar routes | `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` | `sessionStorage` empty on the live origin; no reusable session existed |
| Authenticated Teacher routes | `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` | Same; a fresh login was not authorized by the packet |

The packet states: *"If no authenticated session exists, do not perform a fresh login unless the
active instruction explicitly authorizes its possible audit/session mutation."* The active packet
did not authorize a login write, and SMART logs logins (`README.md:168-170`). A fresh login was
therefore **not** performed. All authenticated Registrar/Teacher findings below are **source-traced**
and are explicitly not presented as live browser proof.

The shared Playwright persistent profile held one pre-existing tab on
`tfrog.buru-degree.ts.net` showing `chrome-error://chromewebdata/` (not SMART). It was left untouched.
A separate tab was opened for SMART and closed after capture.

### 1.4 Browser viewports

- Desktop `1366x768`
- Mobile `390x844`

### 1.5 Zero-mutation statement

- SMART: `git status --short` empty at start and after the audit; no SMART process was started,
  stopped, or replaced.
- ATLAS: no product source or tests touched; no database, generation, publication, migration, or
  live write performed. The only browser writes were the browser's own theme cache read
  (`localStorage: smart_theme_cache`) which pre-existed; no form was submitted.

---

## 2. Inspected source inventory

### 2.1 SMART shared authority

| File | Role |
|---|---|
| `src/App.tsx` | Route mounting for all portals |
| `src/pages/LoginPage.tsx` | Teacher/shared login |
| `src/pages/RegistrarLoginPage.tsx` | Registrar login |
| `src/layouts/RegistrarLayout.tsx` | Registrar shell (391 lines) |
| `src/layouts/TeacherLayout.tsx` | Teacher shell (375 lines) |
| `src/contexts/ThemeContext.tsx` | Branding + `--theme-*` tokens + SSE settings stream |
| `src/index.css` | Tailwind v4 theme, fonts, shadows, print rules |
| `src/components/layout/PageHeader.tsx` | Canonical page header |
| `src/components/layout/StatCard.tsx` | Canonical stat card |
| `src/components/data-table/{DataTable,TableStates,TableToolbar,TablePagination}.tsx` | Canonical table system |
| `src/components/ui/{button,card,badge,dialog,tabs,skeleton}.tsx` | Base UI primitives |
| `src/hooks/useSyncStream.ts` | SSE sync version + ATLAS/EnrollPro liveness |

### 2.2 SMART Registrar pages (line counts are real file lines)

| Page | Lines | `PageHeader` | `<Card>` | `<Button>` | Dialog refs |
|---|---|---|---|---|---|
| `Dashboard.tsx` | 704 | yes | 0 | 2 | 0 |
| `StudentRecords.tsx` | 602 | yes | 2 | 10 | 4 |
| `SchoolForms.tsx` | 2061 | yes | 22 | 15 | 0 |
| `RemedialTracker.tsx` | 711 | yes | 2 | 8 | 23 |
| `SectionRosterViewer.tsx` | 714 | yes | 2 | 16 | 10 |
| `EOSYFinalization.tsx` | 761 | yes | 2 | 5 | 20 |
| `AlumniStudents.tsx` | 504 | yes | 2 | 8 | 0 |
| `Transferees.tsx` | 507 | yes | 2 | 6 | 21 |
| `FormViewer.tsx` | 275 | no | 4 | 5 | 0 |
| `PrintCenter.tsx` | 334 | yes | 20 | 2 | 0 |

Components under `src/pages/registrar/components/` were traced through imports:
`StudentRecordsTable`, `StudentDetailDialog`, `RolloverReadinessCard`, `EOSY*` tabs, `SF1Form`,
`SF5Form`, `RemedialStudentRow`, `RemedialHistoryTable`, `StudentSelectionTable`,
`CompleteRemedialDialog`, `EOSYConfirmDialog`, `EOSYPromotionBreakdown`.

### 2.3 SMART Teacher pages

| Page | Lines | `PageHeader` | `<Card>` | `<Button>` | Dialog refs |
|---|---|---|---|---|---|
| `Dashboard.tsx` | 1085 | no | 19 | 5 | 0 |
| `Schedule.tsx` | 565 | yes | 10 | 2 | 0 |
| `ClassRecordsList.tsx` | 870 | yes | 7 | 15 | 30 |
| `ClassRecordView.tsx` | 414 | no | 0 | 1 | 24 |
| `MyAdvisory.tsx` | 489 | yes | 5 | 6 | 0 |
| `StudentGradeProfile.tsx` | 537 | yes | 15 | 2 | 0 |
| `Attendance.tsx` | 735 | yes | 11 | 6 | 19 |
| `AttendanceReports.tsx` | 647 | yes | 15 | 2 | 0 |

Teacher components/hooks traced: `ClassRecordTable`, `ClassRecordMobileList`, `ClassRecordHero`,
`ClassRecordStats`, `ClassRecordTour`, `AimsPanel`, `AssessmentHeader`, `GradeEditModal`,
`EditRequestModal`, `RotationBanner`, `classRecordActions`, and hooks
`useClassRecord`/`useAssessmentMeta`/`useEditAccess`/`useMobileEditor`/`useStickyLayout`.

### 2.4 Dead/unmounted checks

`src/App.tsx` mounts every file listed above. `ui/pagination.tsx` is the one confirmed orphan: its
own `DESIGN_SYSTEM_PLAN.md:36` records it is imported by zero pages and should be deleted or
re-exported. `data-table/Dash.tsx` is a 5-line placeholder cell used by the record tables.

---

## 3. State and side-effect map

### 3.1 Storage keys

| Key | Location | Writer | Reader |
|---|---|---|---|
| `user_registrar`, `token_registrar`, `refreshToken_registrar` | `sessionStorage` | `RegistrarLoginPage.tsx:51-57` | `RegistrarLayout.tsx:87` |
| `user_teacher`, `token_teacher`, `refreshToken_teacher` | `sessionStorage` | `LoginPage.tsx:53-61` | `TeacherLayout.tsx:68` |
| `user`, `token` (legacy) | `sessionStorage` | both login pages | layouts, `useSyncStream.ts:124` |
| `registrarSidebarCollapsed` / `teacherSidebarCollapsed` | `localStorage` | layouts `toggleSidebarCollapse` (`RegistrarLayout.tsx:112-116`, `TeacherLayout.tsx:93-97`) | layout initial state |
| `teacher_transfer_notice_ack` | `sessionStorage` | `teacher/Dashboard.tsx:620-621` | `teacher/Dashboard.tsx:153-155` |
| `smart_theme_cache` | `localStorage` | `ThemeContext.tsx:149-163` | `ThemeContext.tsx:166-173` |

### 3.2 Contexts and streams

- `ThemeContext` (`ThemeContext.tsx:165-315`) fetches `/api/admin/settings`, applies
  `--theme-primary/secondary/accent`, caches to `localStorage`, and opens a same-origin
  `EventSource` to `/api/admin/settings/stream` that re-applies branding on every message.
- `useSyncStream` (`useSyncStream.ts:78-216`) opens `GET /api/integration/sync/stream?token=…` with
  `fetch` + `ReadableStream`, exposes `syncVersion`, `isConnected`, `atlasOffline`,
  `enrollproOffline`, and reconnects with exponential backoff (2s → 30s). On HTTP 403 it attempts
  `POST /api/auth/refresh` and, on failure, hard-redirects `window.location.href = '/login'`
  (`useSyncStream.ts:133`). This is a full-page navigation that discards in-page state.

### 3.3 Action → state read → state written → incidental reset → API effect

| Action | Reads | Writes | Incidental reset | API effect |
|---|---|---|---|---|
| Login | form fields | `sessionStorage` role keys + legacy keys | — | `POST /api/auth/login` |
| Sidebar collapse | `localStorage` flag | `localStorage` flag | — | none |
| Registrar Dashboard "Sync" | — | modal status | — | `registrarApi.runSync()` (write) |
| Student search/filter (`StudentRecords.tsx:126-128`) | debounced query | `currentPage` reset to 1 | page reset on every filter | client-side filter only |
| Grade/room change (`StudentRecords.tsx:131-138`) | selected grade | `selectedSection` reset to `all` | section filter silently dropped | none |
| `syncVersion` bump | SSE event | `useEffect` refetch on mounted lists | refetch resets pagination where wired that way | re-`GET` list endpoints |
| ATLAS offline banner (`TeacherLayout.tsx:372-388`) | `atlasOffline` | local dismiss state | banner returns on reload | none |
| Term switch (`teacher/Dashboard.tsx:266-278`) | selected term | honors data | — | `GET /api/grades/advisory-honors?term=` |

### 3.4 Race and state-leak observations (source)

- `teacher/Dashboard.tsx:225-256` fires five parallel requests keyed on `[syncVersion, location.key]`
  while `selectedGradeLevel`/`selectedSection` drive a **separate** effect
  (`teacher/Dashboard.tsx:259-263`). A filter change while a dashboard refetch is in flight can
  resolve mastery data from an older filter because there is no request-sequencing guard.
- `ClassRecordView`/`ClassRecordTable` (documented in `docs/CLASS_RECORDS/CLASS_RECORD_VIEW_FIX_PLAN.md:112-140`)
  performs optimistic score updates that deliberately leave server-calculated fields stale until the
  refetch lands — the plan records a "displayed grade stays at its old value" window.
- `ThemeContext` writes `--primary` at runtime (`ThemeContext.tsx:102`), which is a global side
  effect shared by every mounted page. A settings SSE message repaints all portals mid-task without
  any user-visible acknowledgement.

---

## 4. Registrar page-by-page findings (source-traced unless noted)

### 4.1 Registrar Dashboard (`src/pages/registrar/Dashboard.tsx`)

- Hero gradient card with the `PageHeader` composed inside it, then a 4-up mini-stat strip
  (`:233-283`).
- A second `RolloverReadinessCard` (`:286`) then a **third** KPI layer of six sparkline cards
  (`:289-367`), then four chart panels (`:369-562`), then data-quality and quick-actions
  (`:652-700`). The dashboard repeats the same enrollment numbers three times (hero strip, KPI cards,
  charts). **Over-instrumented for a first glance.**
- `getSparklineData` (`:52-77`) synthesizes fake sparkline shapes from a single scalar; the charts
  are decorative, not measured.
- No `<Card>` usage (0) while other Registrar pages standardize on Card — a visual inconsistency.
- Loading state (`:161-180`) uses `bg-muted/30 animate-pulse` blocks keyed to the real layout. Good.

### 4.2 Student Records (`src/pages/registrar/StudentRecords.tsx`)

- Canonical `PageHeader` with Sync/Refresh/Export (`:287-318`); Export is a `Tooltip`-wrapped button
  with **no `onClick`** (`:310-315`) — a dead control.
- Four `StatCard`s (`:321-332`), then a hand-rolled Card+toolbar rather than the shared `DataTable`
  (which exists at `src/components/data-table/DataTable.tsx`). The shared system is bypassed here.
- Filters: school year, search (with a `⌘K` hint at `:368-370`), grade, section. The shortcut at
  `:114-123` binds `Ctrl+K` **and** `/`, but the visible hint shows only the Mac `⌘K` glyph.
- Mobile card view (`:411-491`) and desktop table (`:494-503`) are hand-written duplicates of the same
  row semantics.
- Pagination (`:507-585`) is a bespoke footer, not `TablePagination`.

### 4.3 School Forms (`src/pages/registrar/SchoolForms.tsx`, 2061 lines)

- Largest Registrar surface; 22 `<Card>` blocks and official DepEd SF grids. Uses `PageHeader`.
- DepEd document renders are a sanctioned exception in SMART's own design plan
  (`docs/DESIGN_SYSTEM_PLAN.md:68-70`) and should not be forced into generic cards.
- Single file > 1000 lines — same file-size pressure ATLAS's global frontend constraint forbids
  (`AGENTS.md` "File Size & Component Extraction Rule").

### 4.4 Remedial Tracker (`src/pages/registrar/RemedialTracker.tsx`, 711 lines)

- 23 dialog references: completion, history, and per-student resolution all live in modals. Modal
  overload risk is real; the page has no inline "current remediation" workspace.
- Uses `PageHeader` + 2 cards; the working surface is modal-first.

### 4.5 Section Roster Viewer (`src/pages/registrar/SectionRosterViewer.tsx`, 714 lines)

- 10 dialog references, 16 buttons, 6 empty-state strings. Roster browsing is selection-driven;
  empty states carry a next action ("Try adjusting…").

### 4.6 EOSY Finalization (`src/pages/registrar/EOSYFinalization.tsx`, 761 lines)

- Three tabs (`TabsList` count 3): overview, learner records, grade locking. 20 dialog references,
  including `EOSYConfirmDialog`. Finalization is correctly guarded by a confirmation dialog, but the
  number of modal confirmations is high.
- `EOSYConfirmDialog.tsx` is only 48 lines and is a clean, focused destructive confirmation — a
  reusable pattern.

### 4.7 Alumni / Former Students (`AlumniStudents.tsx`, 504) and Transferees (`Transferees.tsx`, 507)

- Both use `PageHeader` + 2 cards; Transferees carries 21 dialog references (intake/transfer flows).
- Alumni/Transferees are list-first with clear status badges; these are the calmest Registrar pages.

### 4.8 Form Viewer (`FormViewer.tsx`, 275) / Print Center (`PrintCenter.tsx`, 334)

- `FormViewer` has **no `PageHeader`** and is a document surface (sanctioned exception).
- `PrintCenter` has 20 `<Card>` blocks and no dialogs; it is a print-catalogue surface.

---

## 5. Teacher page-by-page findings (source-traced unless noted)

### 5.1 Teacher Dashboard (`src/pages/teacher/Dashboard.tsx`, 1085 lines)

- **No `PageHeader`.** A bespoke `rounded-3xl` gradient hero (`:371-493`) with a live "In Session Now"
  card, then 4 hand-rolled stat cards (`:496-539`), removal/transfer banners (`:541-662`),
  Performance Mastery chart (`:664-757`), Grading Status grid (`:759-851`), Academic Honors
  (`:853-959`), and Students Needing Attention (`:961-onward`). This is the least calm SMART page.
- Live class detection (`:170-208`) recomputes every 30s (`:163-167`). This is a strong, user-centered
  pattern worth adapting, but it is buried inside an oversized page.
- The default school year fallback is hardcoded `"2029-2030"` (`:391`) — a staleness risk.
- 19 cards and no shared `StatCard` despite `StatCard.tsx` existing.

### 5.2 My Schedule (`src/pages/teacher/Schedule.tsx`, 565 lines)

- **Best teacher surface.** Uses `PageHeader` with `S.Y.` + class count (`:295-309`), a grade-level
  legend (`:311-325`), a weekly grid with derived break rows (`:327-451`), today's classes
  (`:454-507`), and an explicit empty state with three feature hints (`:245-286`).
- Grade colors (`:63-96`) map G7→emerald, G8→amber, G9→rose, G10→blue — a four-color semantic ramp.
- `getTimeSlots` (`:530-565`) derives recess/lunch from gaps ≥ 15 min; deterministic and testable.

### 5.3 Class Records List (`src/pages/teacher/ClassRecordsList.tsx`, 870 lines)

- Uses `PageHeader`; 7 cards, 30 dialog references. Class discovery and edit-request flows are
  modal-heavy.

### 5.4 Class Record View (`src/pages/teacher/ClassRecordView.tsx`, 414 lines)

- **No `PageHeader`**; 24 dialog references; delegates the ledger to `ClassRecordTable` (1018 lines)
  and mobile editing to `ClassRecordMobileList` + `useMobileEditor`. The ledger is a sanctioned
  exception (SMART `DESIGN_SYSTEM_PLAN.md:233`), but the surrounding chrome is bespoke.

### 5.5 My Advisory (`MyAdvisory.tsx`, 489) / Student Grade Profile (`StudentGradeProfile.tsx`, 537)

- Advisory uses `PageHeader` + 5 cards. Grade Profile uses `PageHeader` + 15 cards and no dialogs; it
  reads as a calm, card-grouped profile.

### 5.6 Attendance (`Attendance.tsx`, 735) / Attendance Reports (`AttendanceReports.tsx`, 647)

- Attendance: `PageHeader`, 11 cards, 19 dialog refs. Reports: `PageHeader`, 15 cards, 2 buttons.
- Both are date/term-scoped; `GradeStatusBanner.tsx` and `RotationBanner.tsx` provide honest
  read-only/past-term/rotation context (see §7).

---

## 6. Click-path inventory and totals

Because authenticated SMART routes were `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`, click-path
totals are split into **live-executed** and **source-traced, not executed** so no unexecuted control
is counted as a pass.

### 6.1 Live-executed (shared login surfaces)

| # | Route | Control | Expected | Actual final state | Network | Mutates | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `/login/registrar` | navigate | login renders | split branding + form rendered | `GET /api/admin/settings` 200 | no | PASS |
| 2 | `/login/registrar` | Password eye toggle | reveal/hide password | input type toggles (source `:332-338`) | none | no | PASS (source-confirmed) |
| 3 | `/login/registrar` | "Forgot password?" link | recovery flow | `href="#"`, no handler | none | no | **DEFECT (dead)** |
| 4 | `/login/registrar` | "Terms"/"Privacy Policy" | policy docs | `href="#"`, no handler | none | no | **DEFECT (dead)** |
| 5 | `/login/registrar` | "Remember me" checkbox | remember session | uncontrolled checkbox, no state | none | no | **DEFECT (non-functional)** |
| 6 | `/login` | navigate | teacher login renders | rendered, title HNHS | `GET /api/admin/settings` 200 | no | PASS |

Live click-path executed: **6**; defects found: **3 dead/non-functional controls**.

### 6.2 Source-traced controls (not executed — auth blocked)

The following control classes were located and traced but not clicked live. They are reported as
inventory, not as verified behavior: role nav (2 sidebars × 4 groups), collapse/expand, mobile nav
drawer, page-header actions, tabs (EOSY 3 tabs), filters/search (≥4 per list), sorting, pagination,
term/year/class/section selectors, disclosure toggles (failing-students, removal, transfer),
dropdown menus, tooltips, drawers/sheets, dialogs (≈170 `Dialog` references across the 18 pages),
cancel actions, row-detail actions, and print previews.

Mutation-capable controls identified and **not** submitted: Sync (Registrar Dashboard, Student
Records), Create/Save (subject/faculty/student modals), Delete, Archive, Finalize (EOSY), Promote,
Transfer, Import, Edit Grade, Lock, Print-with-write. Their handlers were traced to write endpoints;
no request was submitted.

**Click-path total:** 6 live-executed controls; ~15 control classes and ~170 dialog references
source-traced. No unexecuted control is claimed as a pass.

---

## 7. Design-system scores (0–10, with evidence and limits)

Scores reflect the **source + live login runtime** observed at `c3806e12`, not the aspirational
`DESIGN_SYSTEM_PLAN.md`. Each score names its limitation.

| Dimension | Score | Evidence | Limitation |
|---|---|---|---|
| Color consistency | 6 | `index.css:9-123` defines one emerald accent; live `--primary` = `#861313` (HNHS maroon) via `ThemeContext.tsx:102`. But login focus rings hardcode `focus:ring-red-100`/`border-red-700` (`LoginPage.tsx:299,326`), and `ShiftLayout`/admin pages use raw palette classes. | Could not inspect admin-only or authenticated inline styles live. |
| Typography hierarchy | 8 | `index.css:149-168` sets heading scale + `--sans: DM Sans`; live computed `font-family` = `"DM Sans", system-ui, …`; `PageHeader.tsx:27` uses one page-title scale. | `teacher/Dashboard.tsx` uses `text-3xl sm:text-4xl font-black` (`:405`), violating the documented scale. |
| Spacing rhythm | 7 | `space-y-6` page roots and `gap-4/6` grids are consistent in list pages; `CardContent p-6`/`CardHeader px-6 py-4` are uniform. | Dashboards interleave `p-4`, `p-6`, `p-8`, `py-10`, `py-20`. |
| Component consistency | 7 | Canonical `PageHeader`, `StatCard`, `DataTable`, card/button/badge variants. | 17 pages hand-roll tables/pagination; `StudentRecords` bypasses `DataTable`; `ui/pagination.tsx` orphan. |
| Navigation clarity | 8 | Grouped sidebar with uppercase 10px section labels and pill nav (`RegistrarLayout.tsx:44-73,205-288`); topbar repeats role + page title + `S.Y.` badge (`:349-363`). | `/login/admin` is reachable but not linked from the shared login; SMART-branded `acronym` used for every role. |
| Responsive behavior | 7 | Mobile card view in `StudentRecords.tsx:411-491`; sidebar collapses to 70px; login left panel hides `<lg`. | No route-level mobile evidence for authenticated pages; 2061-line `SchoolForms` grids are print-first. |
| Accessibility | 6 | Semantic labels on inputs (`RegistrarLoginPage.tsx:283,310`), `sr-only` close buttons, `aria-expanded` on disclosures (`teacher/Dashboard.tsx:574`). | Password toggle has `tabIndex={-1}` (`RegistrarLoginPage.tsx:336`); `⌘K` hint is Mac-only; mobile menu button lacks `aria-label` (`RegistrarLayout.tsx:196-201`). |
| Information density | 5 | Registrar Dashboard repeats KPIs 3×; Teacher Dashboard is 1085 lines/19 cards. | Density is the single largest intimidation driver. |
| Task guidance | 7 | `SmartNextStepCard`-style next-step copy, empty-state hints with next actions (`Schedule.tsx:251-253`), deadline banner logic (`GradeStatusBanner.tsx`). | Guidance is not centralized; each page re-implements it. |
| Polish | 7 | Soft shadow scale, restrained 200–400ms motion, gradient page wash. | Residual `animate-ping`/`animate-pulse`, fake sparklines, and dead `href="#"` links reduce trust. |

**Aggregate: 68/100.** SMART is calm and consistent at the shell/page/table level and genuinely
better than a stock admin template, but its **dashboards and record editors are heavier than its own
design plan prescribes**.

---

## 8. Visual identity extraction (with source + rendered evidence)

1. **Brand and semantic colors.** Default accent emerald `oklch(0.696 0.17 162.48)` ≈ `#10b981`
   (`index.css:76,94`); school override applied at runtime. Live rendered `--primary` = `#861313`
   (HNHS maroon). Ledger category tokens `--ledger-ww/pt/ta/grade/aims` (`index.css:35-44`).
2. **Page/nav backgrounds.** Body = `linear-gradient(135deg, #fafbfc, #f0fdf4, #ecfdf5)`
   (`index.css:136-140`), live-confirmed. Sidebar = `#fafafa` with `border-slate-200`
   (`RegistrarLayout.tsx:149`). Topbar = `bg-white/80 backdrop-blur-md` (`:332`).
3. **Typography.** DM Sans everywhere (`index.css:46,49`); h1 `clamp(1.875rem,4vw,2.5rem)` weight 700;
   h2 `clamp(1.25rem,2.5vw,1.5rem)` weight 600; page title `text-2xl font-bold tracking-tight`
   (`PageHeader.tsx:27`); body line-height 1.7.
4. **Spacing rhythm.** Page roots `space-y-6`; grids `gap-4`/`gap-6`; card padding `px-6 py-4` /
   `px-6 py-5` (`card.tsx:90-102`); sections separated by `border-b border-border`.
5. **Border/radius/shadow.** `--radius: 0.75rem`; cards `rounded-xl` with
   `shadow-[0_2px_8px_-3px…,0_10px_22px_-6px…]` (`card.tsx:15-22`); a full `--shadow-xs…2xl` scale
   plus emerald glow (`index.css:21-32`).
6. **Card vs flat grouping.** `CardHeader` uses `bg-muted/50` + `border-b` (`card.tsx:37-39`);
   `CardDescription` is uppercase tracked muted (`card.tsx:69`). Flat `bg-muted/50` rows group inner
   content without a second border (e.g. `teacher/Dashboard.tsx:791`).
7. **Iconography.** Lucide, `w-5 h-5` nav icons with `strokeWidth={2.2}`
   (`RegistrarLayout.tsx:224-227`); `w-4 h-4` in buttons via `[&_svg]:size-4` (`button.tsx:7`).
8. **Action hierarchy.** `Button` variants `default/outline/secondary/ghost/destructive/link`,
   default height `h-8` (`button.tsx:22-34`). Destructive is tinted `bg-destructive/10` rather than
   solid red — a deliberate restraint.
9. **Interaction states.** `hover:bg-muted`, `focus-visible:ring-3`, `disabled:opacity-50`,
   `data-active` tab styling (`tabs.tsx:59-61`), `animate-pulse` skeletons (`skeleton.tsx:10`).
10. **Table/list density.** `LoadingSkeleton` clamps to 6–10 rows (`TableStates.tsx:33`); pagination
    offers `ROWS_PER_PAGE_OPTIONS` with default 25 (`TablePagination.tsx:56`).
11. **Empty states.** Canonical `EmptyState` with icon circle + title + hint + optional action
    (`TableStates.tsx:59-94`); search-aware copy ("No results for …", `:67-72`).
12. **Loading.** `LoadingSkeleton` mirrors real column geometry via `SkeletonHint`
    (`TableStates.tsx:7-20`) — better than a generic spinner.
13. **Responsive breakpoints.** `lg` = 1024px for sidebar/mobile split (`RegistrarLayout.tsx:338`);
    `sm` for compact badges; login splits at `lg` (`LoginPage.tsx:103,168`).
14. **Progressive disclosure.** `SmartNextStepCard`-style advice, failing-student dropdown
    (`registrar/Dashboard.tsx:531-560`), removal/transfer expansion
    (`teacher/Dashboard.tsx:592-606,645-655`), `ScrollArea` for long honor lists
    (`teacher/Dashboard.tsx:1041`).
15. **Animation restraint.** 200–400ms fades/slides (`index.css:190-286`), sidebar width
    `duration-200 cubic-bezier(0.4,0,0.2,1)` (`RegistrarLayout.tsx:149`). Exceptions: `animate-ping`
    live dot (`teacher/Dashboard.tsx:388`) and a 1000ms progress fill (`:809`).
16. **Whitespace.** `max-w-7xl`/`max-w-[1400px]` content widths with `p-4 lg:p-8` main padding
    (`RegistrarLayout.tsx:385`); cards separated by `gap-4/6`.

---

## 9. P0–P3 material findings

### P0 — misleading or broken user-facing behavior

- **P0-1 (SMART, dead controls).** "Forgot password?", "Terms", and "Privacy Policy" are `href="#"`
  with no handler (`LoginPage.tsx:357,385-387`; `RegistrarLoginPage.tsx:359,387-389`). The
  "Remember me" checkbox is uncontrolled and non-functional (`RegistrarLoginPage.tsx:345-348`).
  Users are offered recovery/legal affordances that do nothing.
- **P0-2 (SMART, synthesized metrics).** Registrar Dashboard sparklines are generated by
  `getSparklineData` from a single scalar (`registrar/Dashboard.tsx:52-77`). The visual implies a
  trend that is not measured.
- **P0-3 (ATLAS, contract only — not a defect fix here).** ATLAS `ui/card.tsx` hardcodes
  `zinc-200/zinc-50/zinc-100/zinc-900/zinc-400` (`atlas-client/src/ui/card.tsx:10,26,36,47`),
  contradicting ATLAS's own token contract and SMART's documented ban on mixed gray scales.

### P1 — comprehension and task-guidance defects

- **P1-1 (SMART).** Registrar Dashboard repeats enrollment KPIs three times; Teacher Dashboard is
  1085 lines with 19 cards and no `PageHeader`. Both are the most intimidating surfaces.
- **P1-2 (SMART).** Modal overload in record editors: `ClassRecordsList` 30 dialog refs,
  `ClassRecordView` 24, `RemedialTracker` 23, `Transferees` 21, `EOSYFinalization` 20,
  `Attendance` 19. Recovery from a mistaken modal action depends on remembering the prior state.
- **P1-3 (SMART).** Pagination/filter conventions still diverge across pages despite a canonical
  `DataTable` (`StudentRecords.tsx:507-585` is bespoke; `AlumniStudents` was 0-based, per
  `DESIGN_SYSTEM_PLAN.md:36-40`).
- **P1-4 (ATLAS).** No shared `PageHeader` exists; only `PublicPublishedSchedule.tsx:475` uses
  `SmartCommandBar`. 14 TSX files render a raw `<h1>`, and page headers are hand-rolled per page.

### P2 — consistency and accessibility defects

- **P2-1 (SMART).** Hardcoded red focus rings on login inputs break the maroon/emerald token system
  (`LoginPage.tsx:299,326`; `RegistrarLoginPage.tsx:301,328`).
- **P2-2 (SMART).** Password visibility toggle is removed from the tab order (`tabIndex={-1}`,
  `RegistrarLoginPage.tsx:336`); the mobile sidebar close button has no accessible name
  (`RegistrarLayout.tsx:196-201`).
- **P2-3 (SMART).** The `⌘K` search hint is Mac-specific while the binding is `Ctrl+K`
  (`StudentRecords.tsx:114-123,368-370`).
- **P2-4 (ATLAS).** 55 TSX files contain raw `slate|zinc|gray` palette classes; 5 contain
  `font-black`; `Dashboard.tsx:624` mixes `bg-zinc-50/60` with `text-slate-900` in one header.

### P3 — polish and maintenance

- **P3-1.** `ui/pagination.tsx` is dead (`DESIGN_SYSTEM_PLAN.md:36`).
- **P3-2.** `SchoolForms.tsx` is 2061 lines; `ClassRecordTable.tsx` 1018; `teacher/Dashboard.tsx`
  1085 — all exceed the 1000-line extraction threshold.
- **P3-3.** Teacher Dashboard hardcodes `"2029-2030"` as a fallback year (`teacher/Dashboard.tsx:391`).
- **P3-4 (ATLAS).** `/admin/year-setup` is intentionally absent from nav (`AdminYearSetup.tsx:26`)
  and is only reachable from a rollover notice or a dashboard checklist link — discoverability by
  design, but a first-run operator may not find it.

---

## 10. Console and network classification

Live captures at `https://laptop-pfvh73qk.buru-degree.ts.net`:

- `playwright_browser_console_messages(level=error)` → **0 errors, 0 warnings** on both
  `/login/registrar` and `/login`.
- `playwright_browser_network_requests(filter="/api/")` → a single
  `GET /api/admin/settings => 200` per page (theme payload). No 4xx/5xx.
- 28 static requests per page (bundle/CSS/fonts) not individually audited.
- **Classified as expected/benign:** theme fetch is required for branding; no generation/preference
  404s were triggered because authenticated routes never mounted.

---

## 11. Temporary screenshot index

Browser artifacts were written under `%TEMP%\opencode\pw-mcp-output\` (the configured MCP output
dir) and the audit scratch dir `%TEMP%\opencode\smart-ux-audit-c01\`:

| Artifact | Content | Notes |
|---|---|---|
| `page-2026-09-11T16-11-48-859Z.yml` | Navigator snapshot stub for `/login/registrar` | auto-capture on navigate |
| `page-2026-09-11T16-14-57-934Z.yml` | Navigator snapshot stub for `/login` | auto-capture on navigate |
| Accessible-tree snapshot (inline) | `/login/registrar` @ 390×844: branding panel, "Employee ID or Email", "Password", "Remember me", "Forgot password?", "Sign In", legal links, notification region | authoritative a11y evidence |
| `registrar-login-desktop-1366x768.png` | Registrar login desktop screenshot | named save; path resolved by MCP host cwd |

No screenshot or artifact was committed. The accessibility snapshot (inline above) is the primary
evidence; screenshots are secondary.

---

## 12. Honest coverage limitations

1. **No authenticated SMART browser evidence.** Registrar/Teacher routes were
   `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`; a fresh login was not authorized. All page-by-page
   findings for those routes are source-traced, not live-clicked.
2. **Mobile evidence is limited to unauthenticated login.** The `390x844` viewport could not render
   authenticated mobile layouts.
3. **Remote drift.** SMART `origin/main` advanced to `1bda233`; the audit pinned `c3806e12` per the
   packet and did not inspect the newer commits.
4. **Partial file sampling.** `SchoolForms.tsx` (2061), `ClassRecordTable.tsx` (1018),
   `teacher/Dashboard.tsx` (1085), and the remaining large pages were structurally censused and
   spot-read, not exhaustively line-read.
5. **No mutation verified.** Every write control was traced only; HTTP method/status for writes is
   inferred from handler/endpoint code, not observed.
6. **Shared browser constraint.** A pre-existing errored tab (AIMS-side `tfrog`) was not closed or
   taken over; only a new SMART tab was used and then closed.

---

## 13. Conclusion

SMART is a strong but imperfect benchmark. Its **calm** comes from one accent color, a token-driven
shell, grouped pill navigation, a single `PageHeader`, a single `DataTable` family with proper
loading/empty/error states, restrained shadows, and generous whitespace. Its **intimidation** comes
from over-instrumented dashboards, modal-heavy record editors, and a 2000-line form file — patterns
ATLAS must not copy. ATLAS has already begun a SMART convergence (the `components/smart/` primitives
and pixel-grid shell), but adoption is inconsistent: no shared `PageHeader`, ~55 files drifting on
raw gray tokens, and a Dashboard that mirrors SMART's least-calm gradient hero instead of its calm
command bar.

The companion convergence contract and handoff translate this into a bounded, ranked adoption plan.
