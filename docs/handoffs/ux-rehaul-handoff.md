# Handoff — ATLAS Timetable Relaxed-View Rehaul (UX-REHAUL-C01)

- **Audience:** the implementing agent taking over this program.
- **Author:** primary planner (OpenCode), 2026-09-18 Asia/Manila.
- **Status:** planning + audit complete enough to start; **no implementation has begun**.
- **Nature of this file:** context transfer. It names the authority, the evidence, the
  decisions taken, the decisions still open, and the exact files to read.

---

## 0. TL;DR

ATLAS's Timetable is the operator's daily tool and it reads as overwhelming, technical,
and dense. The operator's complaint is confirmed by live measurement, not just opinion.
The intended remedy is a **relaxed Simple view + breadcrumbs + moving policy/setup out of
the page**, inspired by the sibling SMART system.

**One correction changed the plan:** the client has **no data cache at all** and loads
`/timetable` through a 10-request, 15-sequential-await waterfall. Splitting the page into
sub-pages **before** fixing the data layer would make navigation *worse*. So a data-layer
stream (`UX-P01`) is now the prerequisite.

**Nothing has been implemented, deployed, or merged to `main`.**

---

## 1. Immutable identity (verify these before trusting anything)

| Item | Value |
|---|---|
| ATLAS repo | `D:\ATLAS` (local checkout is **stale** — see trap T1) |
| `origin/main` at audit time | `74c1f12a` — **now advanced to `1333b7fd` and still moving** |
| Live deployed release | **`f0d65a53`** (runtime dir `D:/ATLAS-runtime-supervised-f0d65a531e34-20260918`) |
| Audit artifact | `docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md` @ `54f2991a` |
| Audit branch | `docs/ux-audit-c01` (pushed to `origin`) |
| This handoff | same branch, same commit range |
| SMART reference mirror | `D:\smart-final-capstone` @ **`1bda233`** — **READ_ONLY** |
| Un-integrated UX prior art | branch `work/smart-ux-audit-c01` @ `7d047989` |
| Live SMART origin | `https://laptop-pfvh73qk.buru-degree.ts.net` — **currently OFFLINE** (`tailscale status`: `offline, last seen 30m`) |

**A sibling session is actively pushing to `origin/main`.** Re-fetch and re-pin before
every dispatch; the base above is already superseded.

---

## 2. Required reading (in this order)

### 2.1 Authority / workflow (read first)

| # | File | Why |
|---|---|---|
| 1 | `AGENTS.md` | Sole normative authority: roles, gates, risk tiers, login boundary, no-scroll rule, worktree rules. **Read the current `origin/main` version.** |
| 2 | `docs/reference/atlas-runtime-source-of-truth-map.md` | Runtime/page/data ownership map. |
| 3 | `docs/plans/atlas-active-delivery-streams.md` | The living register — **KNOWN STALE**, see task T-0. Do not trust its SMART pin or its stream list. |

### 2.2 This program's evidence

| # | File | Why |
|---|---|---|
| 4 | `docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md` | **The audit.** F-01…F-18, continuity findings C-01…C-05, live measurements, the Simple interaction inventory (partial), Round 2 (perf + SMART patterns + the nine capstone verdicts + revised stream order). |
| 5 | `docs/reviews/ux-audit-c01/smart-ux-convergence-contract.md` | **The SMART unified-design contract**, landed byte-identical (blob `d6df7e90…`) from `work/smart-ux-audit-c01` @ `7d047989`. 17 sections incl. §14 Teaching Load and §15 Simple Timetable. **Recommended UX baseline (pending D-1).** |
| 6 | `docs/reviews/ux-audit-c01/smart-ux-convergence-contract-DELTA-2026-09-18.md` | **Read immediately after #5.** Corrects the stale pins, adds the Base-UI-vs-Radix engine finding, the SMART usage-reality caveat, the performance prerequisite, §1.1/§2/§4/§8 amendments, the nine capstone requirements, and the revised stream order. |
| 7 | `docs/reviews/ux-audit-c01/smart-registrar-teacher-ux-identity-audit.md` | SMART source/live audit — the evidence base for the ADOPT/ADAPT/DO_NOT_COPY matrix (blob `1df05b4e…`). |

### 2.3 ATLAS client source you will actually change

| # | File | Why |
|---|---|---|
| 8 | `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx` | The Simple header. ~981 lines. Carries Generate/Publish (`74c1f12a`), the task prompt, drift banner, filters, status key. |
| 9 | `atlas-client/src/components/timetable/simple/SimpleHeaderHelpers.tsx` | `useSimpleTasks`, `SimpleGenerateAction/PublishAction/PublishedState`, `SimpleFiltersContent`, `SimpleScheduleControls`, `SimpleTutorialControl`, `chooseRecommendedTask`, gating helpers. |
| 10 | `atlas-client/src/components/timetable/simple/SimpleMoreMenuContent.tsx` | The **17-item, 4-group** More menu (F-04). |
| 11 | `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx` | Workspace shell + transient strips + **`buildScopeKey`/`clearScopeState` (preserve!)**. |
| 12 | `atlas-client/src/components/timetable/CenterWorkspace.tsx` | The **six center views** (`schedule`/`pre-generation`/`policy`/`manual-edit`/`map`/`building`). Route-split target. |
| 13 | `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx` | Advanced header (~1018 lines / ~77 control refs). **Do not rehaul**; only demote. |
| 14 | `atlas-client/src/hooks/useTimetableData.ts` | **The perf hotspot**: 15 sequential awaits vs 3 `Promise.all`. |
| 15 | `atlas-client/src/hooks/useTimetableMutations.ts` | 1735 lines; write paths. |
| 16 | `atlas-client/src/components/smart/SmartPageShell.tsx` | `SmartCommandBar` / `SmartPageFrame` / `SmartEmptyState` / `SmartErrorState` / `SmartLoadingState` — the existing relaxed pattern. **Promote, don't rewrite.** |
| 17 | `atlas-client/src/components/AppShell.tsx` | Shell, breadcrumb computation (currently renders only eyebrow+title), sidebar auto-collapse. |
| 18 | `atlas-client/src/components/app-shell/navigation.ts` | Nav + `breadcrumbGroups`. Items 4 (rename) lives here. |
| 19 | `atlas-client/src/ui/breadcrumb.tsx` | Complete shadcn breadcrumb set with **zero importers** (F-02). |
| 20 | `atlas-client/src/ui/card.tsx` | Hardcoded `zinc-*` token drift (F-13). |
| 21 | `atlas-client/src/index.css` | Token system; comments say **"SMART-aligned"** / **"SMART-compatible theme aliases"**. |
| 22 | `atlas-client/src/pages/Subjects.tsx` | Capstone items 1 & 2: `label="Grades / program"` at **line 663**; `ownerDepartment` wiring. |
| 23 | `atlas-client/src/components/subjects/SubjectFormModal.tsx` | Item 2 (department label). |
| 24 | `atlas-client/src/components/subjects/SubjectFilterToolbar.tsx` | Item 1 ("All Grades"). |
| 25 | `atlas-client/src/components/timetable/TacticalSandboxDock.parts.tsx` | Technical/admin leakage (F-08): alias editors, raw `blockerCodes`. |

### 2.4 SMART reference (READ_ONLY — never edit)

| # | Path | Why |
|---|---|---|
| 26 | `D:\smart-final-capstone\src\components\layout\PageHeader.tsx` | 42-line header anatomy to port. |
| 27 | `D:\smart-final-capstone\src\index.css` | 154 tokens incl. 7-level shadow scale. Adopt **structure**, not values. |
| 28 | `D:\smart-final-capstone\src\layouts\RegistrarLayout.tsx` (+ `TeacherLayout`, `AdminLayout`) | Shell geometry (`w-[280px]` / `lg:w-[70px]`). **Do not copy the duplicate-role-layout pattern or `min-h-screen` scroll.** |
| 29 | `D:\smart-final-capstone\src\components\data-table\DataTable.tsx`, `TableStates.tsx` | Table + state conventions (owned but unused in SMART — copy the *shape*). |

---

## 3. What was discovered (summary — full detail in the audit)

**Structural / P0–P1**

- **F-01** `/timetable` hosts **six center views** in one route; several (`/map`, `/teaching-load`, `/faculty/preferences`) already exist as separate nav destinations → duplicated IA.
- **F-02** **No breadcrumb trail.** `ui/breadcrumb.tsx` exists with **0 importers**; `AppShell` renders only a two-line eyebrow + title.
- **F-03** The "Simple" view renders **11 simultaneous surfaces**; the live header is **3 stacked rows**.
- **F-04** Simple **More menu = 17 items in 4 groups**. Public page More = **2**.
- **F-06** A warning triangle renders on **essentially every cell** (113 warnings) → no prioritisation.
- **F-07** Per-cell redundancy: `P. CRUZ · G7 Room 103 · G7AW` — grade repeated twice; 211×16 px, clipped.
- **F-08** DB-admin vocabulary on the operator surface (`blockerCodes`, alias editors, confirmation phrases).

**Measured (live, 1366×768)**

| Metric | `/timetable` (Simple) | `/public/schedules` |
|---|---|---|
| Visible controls | 61 (13 shell + 8 header + 40 cells) | 28 |
| Header rows | 3 + column header | 1 command bar |
| More-menu items | **17** | **2** |
| Leaf text < 12 px | 16 | **397** (260 at **9 px**) |
| Global window scroll | none ✅ | none ✅ |
| Console errors | 0 | 0 |
| Live data | S.Y. 2031-2032 · T1 · Run #316 · 113 warnings · Section "Luna" | 2,760 classes / 20 sections |

**Performance (Round 2)**

- **No cache library**; `prefetch`/`staleTime`/`keepPreviousData`/`useQuery` = **0 occurrences**.
- `useTimetableData.ts`: **15 sequential awaits** vs 3 `Promise.all`.
- 23 lazy routes; every mount refetches; 10 API calls; 2-phase render.

**SMART comparison**

- SMART uses **Base UI** (`@base-ui/react`), **zero Radix**; ATLAS uses **14 `@radix-ui/*` packages**. Both use shadcn/ui + Tailwind v4. **The engine is invisible to users — do not migrate.**
- SMART's `breadcrumb`, `PageHeader`, `DataTable` all have **0 usage sites** → copy their visual language, not their discipline.
- ATLAS is **already partially SMART-aligned** at the token layer (its own CSS says so).

---

## 4. What was planned

```
UX-P01   Data layer: TanStack Query + parallel fetches + prefetch + keepPreviousData   ← PREREQUISITE
UX-R00   Register reconciliation + land/refresh SMART-UX-AUDIT-C01 baseline
UX-R01   Primitives: PageHeader (promote SmartCommandBar) + breadcrumbs + token fixes
UX-R01a  Shared visual language: SMART PageHeader anatomy, shadow/token structure,
         type-role unification (12px chrome floor), canonical state set
UX-R02   Simple strip-down: visible filters w/ count, one status region, one primary,
         one action alignment, affordance fixes
UX-R03   Nested layout route (grid stays mounted) + sub-page panels      ← depends on UX-P01
UX-R04   Move admin/diagnostics off the operator surface
UX-R05   Advanced demotion to "Expert" (entry point only)
UX-R06   Micro-copy: capstone items 1, 2, 4 (+ resolve "Schedules" ambiguity)   ← safe NOW
```

**Six navigation/perf patterns (A–F)** are specified in audit §10.2 — persistent layout
route, TanStack Query cache, hover prefetch, waterfall collapse, chunk prefetch,
stale-while-revalidate UI.

---

## 5. What was decided

**Operator directives (treat as authoritative):**

1. **Desktop-first.** Mobile explicitly de-prioritized.
2. **Advanced view is not being rehauled** ("a lost cause") — demote it, don't fix it.
3. **Build on Simple.** Confirmed by real operator state: `atlas_timetable_layout_mode = "simple"`, `atlas_pregen_active = "1"`.
4. **E: is the default worktree root.** `D:` mentions are about PostgreSQL headroom only.
5. **Navigation must not get slower** — back-and-forth between timetable and sub-pages must be optimized, not degraded.
6. **ATLAS must look like a unified system** with the sibling apps (SMART/EnrollPro).

**Planner verdicts on the nine capstone items** (audit §10.6): items 1, 2, 3, 6, 7, 9 →
**agree** (2 with a naming caution); item 4 → agree with an ambiguity warning
(`/schedules` already exists); item 5 → agree in principle, needs one published-state
check on Run #316; item 8 → **disagree as stated** (see below).

**Explicitly rejected:**

- ❌ Migrating ATLAS off Radix to Base UI (cost, no user-visible gain).
- ❌ Copying SMART's duplicate role layouts; SMART's `min-h-screen` document scroll; SMART's DM Sans family wholesale (ATLAS has an EnrollPro/HNHS branding contract).
- ❌ Putting timetable internals into the sidebar nav (item 8). Use **domain-level nav items** + **sub-tabs inside the workspace**.
- ❌ Copying `AppShell`'s existing defaulting `schoolId = 1` patterns or the remaining fail-open parse sites.

---

## 6. What is NOT decided (needs the operator)

| # | Decision | Why it blocks |
|---|---|---|
| D-1 | Adopt/refresh `SMART-UX-AUDIT-C01` as the UX authority, or supersede it? | Baseline for UX-R00/R01a |
| D-2 | Cycle activation + scope tier | Nothing dispatches without it |
| D-3 | Is `UX-P01` (data layer) authorized? | Blocks UX-R03 entirely |
| D-4 | Deploy `74c1f12a`? | Simple Generate/Publish are not live |
| D-5 | Second login for the remaining live interaction rows? | Rows 14–27 of the inventory |
| D-6 | Item 5: is Run #316 (or any published run) showing warnings? | Correctness, not cosmetics |

---

## 7. Boundaries — do not break these

1. **Publication gates, ordered-term identity, actor-school scope** are load-bearing from earlier waves.
2. **`ScheduleReviewWorkspace.tsx` `buildScopeKey`/`clearScopeState`** — scope-change hygiene must survive any route split.
3. **No-scroll architecture** — root `flex flex-col h-[calc(100svh-3.5rem)]` + `flex-1 min-h-0 overflow-auto`. Never introduce a global window scroll.
4. **shadcn/Radix primitives only** — no native `<select>`/raw buttons. (Clean today: 0 `<select>`.)
5. **1000-line component cap** — `useTimetableMutations.ts` (1735), `useTimetableData.ts` (1687), `useScheduleReviewWorkspaceState.ts` (1648) already exceed it and need extraction as you touch them.
6. **HIGH actions stay locked** — deployment, term-cache apply, generation, publication, migrations, shared-runtime. This program is **client source only**.
7. **Companion repos are READ_ONLY** — never edit `D:\smart-final-capstone`, EnrollPro, AIMS.

---

## 8. Task T-0 (do this first)

**Reconcile the living register before dispatching anything.** Known concrete defects:

- `docs/plans/atlas-active-delivery-streams.md:600` claims *"SMART remains at `c3806e12`"* — the mirror is actually at **`1bda233`**.
- The register was last reconciled **2026-09-14**; `origin/main` has since carried `release/client-quality-01`, `export-presentation-*`, `rollover-graded-autonomy`, `timetable-cell-info`, `ux-quickfix-c01`, and `74c1f12a`/`1333b7fd`.
- It has **no entry** for `UX-AUDIT-C01`, for `SMART-UX-AUDIT-C01` (unregistered, unintegrated), or for this program.
- 109 registered worktrees exist (guideline is 12 active); `D:` free ≈ 23.31 GiB.

Then update the register with one compact recovery bullet for `UX-REHAUL-C01` and link
the audit artifact. Do not rewrite historical prose.

---

## 9. Recommended first implementation streams

**Start with `UX-R06`** — it is tiny, independent, and safe (no architecture, no perf):

| Item | Change | Exact location |
|---|---|---|
| 1 | `Grades / program` → **`Grade level / program`** | `pages/Subjects.tsx:663`; `SubjectMobileCard.tsx:76`; `SubjectFilterToolbar.tsx:90` |
| 2 | Modal label `Owner department` → **`Department`**; keep the field name; distinguish the additional-departments control | `components/subjects/SubjectFormModal.tsx` |
| 4 | `Timetable` → **`Class Schedule`** (item **and** group), and disambiguate `/schedules` (`Schedules` → `Room Schedules`) | `components/app-shell/navigation.ts:38,60` |

Constraints: no behaviour change, no route/URL change, desktop-first, keep the file-size cap.

**Then `UX-P01` (data layer)** — the enabler for everything structural. Sequence:
parallelise the 15 sequential awaits → introduce TanStack Query with stable query keys
scoped by `(schoolId, schoolYearId, runId, termIndex)` → `staleTime` + `placeholderData:
keepPreviousData` → hover/focus prefetch → chunk prefetch. Do **not** change the responder
contract; this is a client data-layer refactor with byte-identical payload expectations.

---

## 10. Verification expectations for the next agent

- **Immutable range review**: base SHA → candidate SHA, full changed-path attribution, clean worktree (`git update-index --refresh`, `git status --porcelain=v2`, `git diff --quiet`).
- **Production-path proof**, not helper-only tests. A green helper test never substitutes for a real mounted-route/browser row.
- **Focused gates**: `atlas-client` typecheck + build; the changed module's suites; the operator-workflow suite (`lib/__tests__/timetable-operator-workflow-state.test.ts`, `ux-quickfix-c01-header-actions.test.ts`) for header/action changes.
- **Preserve** the no-scroll, scope-clear, ordered-term, and publication-gate invariants — add a negative control where you touch them.
- **Fresh independent QA** on the frozen candidate before integration. `ACCEPT_READY` requires `passed == total`, `blocked: 0`, `unperformed: 0`.
- **Do not** self-integrate to `main` without planner acceptance.

---

## 11. Environment, credentials, and traps

**Live QA credentials**
- Resolve `%USERPROFILE%\.config\opencode\atlas-qa-credentials.local.md` at run time.
- It is local-only: **never** stage, commit, quote, copy into prompts, or print.
- **TRAP T2:** the values are wrapped in **markdown backticks**. A naive `key: value`
  parse yields `` `1234567` `` / `` `password` `` and the login returns **401**. Strip
  leading/trailing backticks and quotes.
- Keys present: `Origin`, `Admin identifier`, `Admin password`, plus a
  "Faculty login selection" prose section (no second credential set).
- **Login is a mutation boundary**: a fresh login creates a `LOCAL_LOGIN_SUCCESS` audit
  row + updates the actor's `last_login_at`. Declare that delta before logging in.
- Browser origin must be `https://njgrm.buru-degree.ts.net`; a testid census is useless
  without asserting `window.location.origin`.

**Traps**

| ID | Trap |
|---|---|
| T1 | `D:\ATLAS` is a **stale checkout** and shows a false "dirty" status from a stale index / `core.autocrlf=true`. Run `git diff --quiet` — it reports clean. Always audit from a worktree at a **pinned** commit in `E:\ATLAS-worktrees`. |
| T2 | Backtick-wrapped credentials (above). |
| T3 | `origin/main` **moves during sessions** (another session pushed `74c1f12a`, then `1333b7fd`, mid-audit). Re-fetch and re-pin; a worktree's HEAD can move under you. |
| T4 | `docs/design/**` and `docs/reports/**` are **gitignored**. Tracked doc locations are `docs/reviews/**`, `docs/handoffs/**`, `docs/plans/**`, `docs/prompts/**`. (This is why the SMART contract never landed.) |
| T5 | The live deploy (`f0d65a53`) is **behind** `origin/main` — a missing UI element may be un-deployed, not broken. Scan the **served bundle** before calling it a bug. |
| T6 | `TacticalSandboxDock` exposes **apply/confirmation-phrase** actions and SMART exposes a one-click EnrollPro/ATLAS **sync** — never click those during read-only QA. |
| T7 | The `/timetable` page renders a **2-phase** load; wait for the grid before measuring, or you will census a loading skeleton (I recorded 13 controls before waiting, 61 after). |

---

## 12. Worktree and capacity notes

- Default root is **`E:\ATLAS-worktrees`** (`E:` free ≈ 60.1 GiB). `D:\ATLAS-worktrees` is legacy retention only.
- 109 worktrees are registered — **cleanup debt**. If you create one, name its disposition (`KEEP_ACTIVE` / `RETIRE_AFTER_INTEGRATION` / `PRESERVE_FOR_DECISION`).
- `D:` free ≈ 23.31 GiB — below the 25 GiB warn line; PostgreSQL lives there. Prefer `E:` for anything heavy.
- Retire with non-forced `git worktree remove <exact path>` + `git worktree prune`. Never `--force`, never a glob, never delete branches as part of retirement.

---

## 13. Recovery commands

```powershell
# this handoff + the full audit
git show origin/docs/ux-audit-c01:docs/handoffs/ux-rehaul-handoff.md
git show origin/docs/ux-audit-c01:docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md

# the SMART unified-design baseline (now landed in the tracked tree)
git show origin/docs/ux-audit-c01:docs/reviews/ux-audit-c01/smart-ux-convergence-contract.md
git show origin/docs/ux-audit-c01:docs/reviews/ux-audit-c01/smart-ux-convergence-contract-DELTA-2026-09-18.md
git show origin/docs/ux-audit-c01:docs/reviews/ux-audit-c01/smart-registrar-teacher-ux-identity-audit.md

# provenance check (landed files are byte-identical to the original branch)
git cat-file -p d6df7e90c95473841db8028027a1d1451c3ea829 | git hash-object --stdin
git log --oneline -1 7d047989

# fresh worktree at the current base
git -C D:\ATLAS fetch origin
git -C D:\ATLAS worktree add E:\ATLAS-worktrees\<stream> -b work/<stream> origin/main
```

---

## 14. Change log

| Date | Change |
|---|---|
| 2026-09-18 | Initial handoff created alongside audit Round 2. No implementation performed. |
