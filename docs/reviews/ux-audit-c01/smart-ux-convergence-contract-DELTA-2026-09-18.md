# DELTA — ATLAS × SMART UX Convergence Contract (rev. 2026-09-18)

- **Companion to:** `docs/reviews/ux-audit-c01/smart-ux-convergence-contract.md`
  (landed **byte-identical**, blob `d6df7e90…`, original at `work/smart-ux-audit-c01` @ `7d047989`).
- **Evidence base companion:** `docs/reviews/ux-audit-c01/smart-registrar-teacher-ux-identity-audit.md`
  (blob `1df05b4e…`).
- **Why this file exists:** the contract was authored 2026-09-12 against base `904818d4` with the
  SMART pin at `c3806e12`. Both have moved. This delta records what still holds, what is now
  **wrong or incomplete**, and what must be added. **Read the contract first, then this.**
- **Authority:** the contract describes itself as *"a design contract for review … not product
  implementation authority."* This delta does **not** promote it. Promotion is operator decision **D-1**.

---

## 1. What still holds (unchanged)

Sections 0–17 of the contract remain valid guidance, in particular:

- §0 principles (restraint, one primary action, blockers stay visible).
- §1.1 single shell + grouped sidebar.
- §3 single year/term authority.
- §7 actions (one primary, verbs, no dead controls).
- §11 blocker presentation (statement → smallest repair → where to verify).
- §17 safety invariants (never hide a blocker; authorities unchanged; SMART stays READ_ONLY).

---

## 2. Corrections — facts that changed

| Contract claim | Reality at 2026-09-18 | Action |
|---|---|---|
| SMART reference pin `c3806e12` | SMART mirror is at **`1bda233`** (register `atlas-active-delivery-streams.md:600` is stale) | Use `1bda233`; correct the register (task T-0) |
| ATLAS base `904818d4` | `origin/main` was `74c1f12a`, now **`1333b7fd`** and still moving | Re-pin before dispatch |
| §6 "`ui/card.tsx` hardcodes `zinc-*`" flagged as P0-3 | **Still live** at `74c1f12a` (`ui/card.tsx:9,22,33,44`) | Unfixed — fold into `UX-R01` |
| Contract implies SMART is a component-discipline model | **SMART's `breadcrumb`, `PageHeader`, `DataTable` all have 0 usage sites** | Copy SMART's *visual language*, not its usage discipline |

---

## 3. New findings the contract does not cover

### 3.1 Primitive engine — **answered definitively**

| | SMART | ATLAS |
|---|---|---|
| Headless engine | `@base-ui/react` v1.3.0 — **zero Radix** | **14 `@radix-ui/*` packages** |
| Component system | shadcn/ui (`shadcn` ^4.1.1) | shadcn/ui |
| Conventions | CVA, `clsx`, `tailwind-merge`, `lucide-react`, Tailwind v4 | identical |

**Verdict: keep Radix. Do not migrate to Base UI.** A Radix `Dialog` and a Base UI `Dialog`
render identically under the same tokens; the engine is invisible to users and is **not** one of
the levers that makes two apps look unified. Migrating 26 ATLAS primitives is cost with no
user-visible gain.

### 3.2 The four levers that actually produce a unified look

1. **Tokens** — colour, radius, shadow scale, type scale.
2. **Layout conventions** — shell, nav, page-header anatomy.
3. **Component anatomy** — button/card/table metrics.
4. **State conventions** — loading / empty / degraded / error.

ATLAS is **already partially aligned**: its own `atlas-client/src/index.css` says
*"Base surface tokens (light slate / white, **SMART-aligned**)"*, *"Default accent: emerald
(**SMART scheduling portal identity**)"*, *"**SMART-compatible theme aliases**"*.
ATLAS has **83** token vars vs SMART's **154** — adopt SMART's **structure** (esp. the 7-level
shadow scale `--shadow-xs…2xl`, `--shadow-glow`, `--shadow-emerald`), not its values.

### 3.3 Performance prerequisite — **blocks the route split**

Measured on the live `/timetable`:

- **No server-state cache.** `prefetch` / `staleTime` / `keepPreviousData` / `useQuery` = **0 occurrences**.
- `hooks/useTimetableData.ts`: **15 sequential `await`s** vs **3** `Promise.all` → request waterfall.
- **10 API calls** per load; a deliberate **2-phase** render ("finding the latest run first, then
  adding labels and secondary diagnostics").
- 23 lazy routes; every mount refetches everything.

**Consequence:** splitting `/timetable` into sub-pages *before* fixing this multiplies the cost by
the number of sub-pages. The contract's §15 ("keep the rail workspace") must be read with this
constraint: **`UX-P01` (data layer) is a prerequisite for `UX-R03` (route split).**

Six patterns that fix back-and-forth navigation (detail in the audit §10.2):

- **A** persistent layout route (grid never unmounts) · **B** TanStack Query cache
  (`staleTime` + `placeholderData: keepPreviousData` + `gcTime`) · **C** hover/focus prefetch ·
  **D** collapse the waterfall into parallel `Promise.all` groups · **E** chunk prefetch ·
  **F** stale-while-revalidate UI instead of a full skeleton.

### 3.4 Amendments to specific contract sections

- **§1.1 shell** — SMART shells use `min-h-screen` + document scroll (`AdminLayout.tsx:160`).
  **Do not copy.** ATLAS keeps `flex flex-col h-[calc(100svh-3.5rem)]` + `flex-1 min-h-0 overflow-auto`.
  SMART sidebar geometry (`w-[280px]` / collapsed `lg:w-[70px]`) is adoptable.
- **§2 page headers** — SMART's real anatomy is 42 lines:
  `h1 text-2xl font-bold tracking-tight text-foreground` + badge, with
  `text-sm text-muted-foreground` description and an actions cluster, `flex justify-between gap-4`.
  ATLAS's `SmartCommandBar` is ~80 % of this — **promote, do not rewrite.**
- **§4 typography** — add a hard floor: **no text below `0.75rem` (12 px) in app chrome.**
  Live measurements: public schedule **397** leaf nodes < 12 px (260 at **9 px** grade badges);
  Timetable Simple **16** nodes < 12 px. SMART base is `16px/1.6`, `letter-spacing:-0.011em`.
  Unify **roles and scale**, not the family (ATLAS keeps Inter + Poppins under the EnrollPro contract).
- **§8 tables** — ATLAS has **no canonical `ui/table.tsx`**; it uses a bespoke
  `admin-workspace/AdminDataTable`. SMART owns `table.tsx` + `data-table/DataTable.tsx` +
  `TableStates.tsx` (unused). Decide one canonical table system.

---

## 4. Operator capstone requirements (new — treat as authoritative product input)

From the 2026-09-18 capstone review. Planner verdicts in the audit §10.6.

| # | Requirement | Verdict |
|---|---|---|
| 1 | `Grades / program` → `Grade level / program` | Agree — `pages/Subjects.tsx:663` |
| 2 | Add-subject modal `Owner department` → `Department` | Agree with caution (rename label only; keep `ownerDepartment` field; distinguish additional departments) |
| 3 | All clickable buttons visible; make active filtering obvious | **Agree — verified defect** (Filters is item 15 of 17 in the More menu) |
| 4 | Nav `Timetable` → `Class Schedule` | Agree + ambiguity warning (`/schedules` already exists) |
| 5 | Remove warnings once published | Partially agree — verify which run is considered published first |
| 6 | Panels not separated; panel display clear | Agree (inverted: in Simple they are *merged*, not separated) |
| 7 | Clarify button arrangement | **Agree — measured** (3 different alignments in one header) |
| 8 | Put sub-menus into the main menu | **Disagree as stated** — use domain nav + workspace sub-tabs |
| 9 | Controls on one side; emphasise clickability | Agree (ghost chips read as badges; false `ChevronDown` affordance) |

---

## 5. Revised stream order (supersedes contract §15's implied sequence)

```
UX-P01   Data layer: TanStack Query + parallel fetches + prefetch + keepPreviousData   ← PREREQUISITE
UX-R00   Register reconciliation + land/refresh the SMART UX baseline (D-1)
UX-R01   Primitives: PageHeader (promote SmartCommandBar) + breadcrumbs + token fixes
UX-R01a  Shared visual language: PageHeader anatomy, shadow/token structure,
         type-role unification (12px chrome floor), canonical state set
UX-R02   Simple strip-down: visible filters w/ count, one status region, one primary,
         one action alignment, affordance fixes
UX-R03   Nested layout route (grid stays mounted) + sub-page panels      ← depends on UX-P01
UX-R04   Move admin/diagnostics off the operator surface
UX-R05   Advanced demotion to "Expert" (entry point only)
UX-R06   Micro-copy: items 1, 2, 4 (+ resolve "Schedules" ambiguity)   ← safe now
```

---

## 6. Status of the contract itself

- The contract is now **present in the tracked tree** (this delta's companion), removing the
  dependency on the unintegrated branch `work/smart-ux-audit-c01`.
- **D-1 (operator):** promote the contract (as amended by this delta) to the UX authority, or
  supersede it. Until D-1 is answered, treat it as strong guidance, not authority.

---

## 7. Change log

| Date | Change |
|---|---|
| 2026-09-18 | Initial delta: engine finding (Base UI vs Radix), usage-reality caveat, performance prerequisite, §1.1/§2/§4/§8 amendments, capstone requirements, revised stream order. |
