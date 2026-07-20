# ATLAS Project Phase Plan — Master Tracker
**Generated:** 2026-05-15  
**Status:** Generator-readiness delivery remains active; UX-00 through UX-06 are an approved cross-phase usability overlay  
**Last Updated:** 2026-07-20

## Active Phase

- **Delivery stream:** Phase 3 generator readiness and KPI recovery remains the canonical functional delivery stream.
- **UX stream:** UX-00 through UX-06 are approved for implementation as a bounded cross-phase overlay as of 2026-07-12.
- **Boundary:** UX work may simplify presentation and interaction but shall not change generation truth, publish lifecycle gates, role permissions, or persisted source ownership.
- **Closure rule:** UX phases remain NO-GO until live Tailnet evidence is captured; source-only and localhost checks are supporting evidence only.

### Post-Audit UX/QoL Roadmap Execution (2026-07-12)

- **Implemented:** faculty identity hydration, high-risk workflow simplification, attention-first setup filters, and actionable faculty recovery copy.
- **Verified:** client tests/build, server auth tests/build, live Tailnet `/faculty/me` mapping for employee `2000056` to mirror `24065`.
- **Still gated:** the current live run is stale against present faculty truth; UX implementation did not generate a replacement run. UX-06 also remains open for assistive-technology and moderated older-user evidence.
- **Detailed ledger:** `docs/phases/post-audit-roadmap-execution-2026-07-12.md`.

### Timetable Performance Live Closure (2026-07-13)

- **Functional recovery GO:** Tailnet shell, authentication, stale latest-run review, explicit teaching-repair entry, and occupied-slot drag review are working live.
- **Performance NO-GO:** core-grid readiness exceeds 3 seconds; latest stale-run resolution is approximately 1.9–2.0 seconds; low-end frame/React commit budgets and older-user evidence remain open.
- **2026-07-16 final verification:** Prompt 0/1 are **GO** after the drag containment recovery and corrected live harness rerun. Final Tailnet suites passed on desktop, mobile portrait, and mobile landscape (`14/14` each). Pointer drag now records no long tasks, no header/left/right crossing commits, zero grid-cell crossing batches, and drag start/end commits around `1.0-1.5 ms`. A live disposable fixture is proven reversible (create, commit, revert, exact restoration, cleanup), so Prompt 2 may proceed. See `docs/verification/timetable-prompt-0-1-independent-verification-2026-07-16.md`.
- **2026-07-16 navigation/static follow-up:** Admin, fallback-faculty, and public Tailnet navigation passed without captured app errors; client type-check, client/server builds, and 14/14 UX guardrails passed. The mandated faculty QA identity `2000056` still returns `401 INVALID_CREDENTIALS`, and the repository has no configured lint command. These results do not clear the Prompt 0/1 performance gate.
- **2026-07-16 Prompts 2-6 technical closure:** Prompts 2-6 are **technical GO** after indexed interval conflict inspection, Tactical Sandbox candidate delta projection, collaboration throttling, stale-preview guards, and lazy Tactical Sandbox chunking. Live Tailnet performance suite passed `42/42` across desktop, mobile portrait, and mobile landscape. Pointer drag recorded ~`60 FPS`, zero long tasks, zero grid-cell crossing commit batches, and drag start/end React commits between `1.0-2.2 ms`. Admin and public navigation smoke passed; faculty navigation smoke was blocked before navigation by live auth (`429` first run, `401` on single retry with configured faculty QA credentials). Moderated older-user evidence remains a separate product-validation gate. See `docs/verification/timetable-prompts-2-6-performance-closure-2026-07-16.md`.
- **2026-07-16 Prompts 0-6 re-audit correction:** The phase remains **technical GO** after correcting the remaining unassigned-session Tactical Sandbox candidate scan, tightening the lazy sandbox mount guard, and extracting candidate row presentation to keep `TacticalSandboxDock.tsx` below the 1000-line component limit. Re-run local gates passed (`test:timetable-conflict` 10/10, `test:ux-guardrails` 18/18, `tsc --noEmit`, production build), and the live Tailnet timetable performance suite again passed `42/42` across desktop, mobile portrait, and mobile landscape with ~`60 FPS`, zero long tasks, and drag start/end React commits between `2.0-3.2 ms`. See `docs/verification/timetable-prompts-2-6-performance-closure-2026-07-16.md`.
- **2026-07-16 interaction regression hotfix:** Restored click-to-move hovered-cell conflict feedback and hardened delegated grid drop targeting after user validation found the grid was smooth but no longer reliably usable for placement/switching. A per-cell `useDroppable` attempt was rejected because it made all visible cells commit during drag; the final implementation keeps one parent grid drop zone plus DOM cell hit-testing/fallbacks. Focused live Tailnet smoke passed desktop and mobile portrait preflight, pointer drag, keyboard placement, and touch placement checks. Manual live check confirmed visible `Current`, `Swap Preview`, `Occupied`, and hard-conflict feedback on grid cells before commit. Final profile evidence passed desktop, mobile portrait, and mobile landscape gates with zero cell commit batches and zero long tasks. See `docs/verification/timetable-prompts-2-6-performance-closure-2026-07-16.md`.
- **2026-07-18 workflow recovery Phase 0/1:** Generated-run workflow recovery is **GO** after adding a live Tailnet Playwright gate for unassigned-list scrolling, generated unassigned placement flow visibility, and occupied generated-session swap review. The suite passed `6/6` across desktop, mobile portrait, and mobile landscape. Supporting gates passed: `test:timetable-conflict` `10/10`, `test:ux-guardrails` `19/19`, `tsc --noEmit`, and production build. See `docs/phases/timetable-workflow-ux-recovery-plan-2026-07-17.md`.
- **2026-07-18 workflow recovery Phase 2:** New pre-generation draft placement recovery is **GO**. The primary `Plan before generating` action now opens the workspace immediately and hydrates the draft board in the background; the draft-board read path uses the saved section snapshot for fast navigation while preview/commit keep full validation. The live Tailnet Phase 2 suite passed `6/6` across desktop, mobile portrait, and mobile landscape, and the optimized draft-board route returned in `987ms` with `queue=1313`. Supporting gates passed: `test:timetable-conflict` `10/10`, `test:ux-guardrails` `19/19`, client `tsc --noEmit`, client/server production builds, and Phase 0/1 rerun `6/6`.
- **2026-07-18 workflow recovery Phase 3:** Workspace information architecture simplification is **GO**. The timetable now exposes a compact task guide for review, unassigned placement, session switching, draft planning, and room-request review; task buttons expand the left rail before switching modes; mobile/short-height viewports use horizontal local scrollers and compact rail chrome instead of starving the work area. New live gate `timetable-workflow-phase03.spec.ts` passed across desktop, mobile portrait, and mobile landscape, and the combined Phase 1-3 live matrix passed `15/15`. Supporting gates passed: client `tsc --noEmit`, client production build, and `test:ux-guardrails` `19/19`. Phase 4 should proceed next for first-load/data-load performance.
- **2026-07-18 workflow recovery Phase 4:** First-load and data-load performance is **GO**. Advanced timetable surfaces are lazy-loaded, primary run data is applied before follow-up diagnostics, run history is metadata-only (`5,992` bytes / `43.6ms` on Tailnet after fix, excluding `summary`, `draftEntries`, `violations`, and `unassignedItems`), and `/runtime/context` defaults to persisted ATLAS evidence (`185.9ms`) unless `verifyUpstream=true` is explicitly requested. New live gate `timetable-workflow-phase04.spec.ts` passed `6/6` across desktop, mobile portrait, and mobile landscape. Comparable desktop performance harness improved from the Phase 4 baseline `cold=9239ms`, `warm=9049ms` to `cold=1322ms`, `warm=1088ms`. Supporting gates passed: client `tsc --noEmit`, client production build, server production build, built server startup, and `/api/v1/health` on port `5020`.
- **2026-07-18 Phase 4 independent-verification correction:** Antigravity correctly found a Phase 2 regression caused by Phase 4 reference-data deferral: immediate draft queue placement could exit before opening `Review draft placement` when `roomMap` was not hydrated yet. The dialog now opens first and waits for explicit teacher/room selection if defaults are missing. Focused gate passed, Phase 2 live gate passed `6/6`, and the combined Phase 1-4 live matrix passed `21/21` across desktop, mobile portrait, and mobile landscape. Supporting gates passed: client `tsc --noEmit`, client production build, and `test:ux-guardrails` `19/19`.
- **2026-07-18 workflow recovery Phase 5:** Older-user accessibility and foolproofing is **GO** for technical closure. The timetable task guide now keeps persistent plain-language instructions for place, switch, draft, and conflict meaning; primary task-mode controls use 44px targets; save/swap outcomes are announced through an on-page `aria-live` status region; draft placement dialogs show conflict guidance before preview; and Undo is exposed as an inline recovery affordance when manual edit history exists. New live gate `timetable-workflow-phase05.spec.ts` passed `6/6` across desktop, mobile portrait, and mobile landscape. The combined Phase 1-5 Tailnet matrix passed `27/27`; supporting gates passed: client `tsc --noEmit`, client production build, and `test:ux-guardrails` `20/20`.
- **2026-07-18 workflow recovery Phase 6:** Regression and release gate is **GO**. Added `timetable-workflow-phase06.spec.ts` to verify live `/timetable` navigation without app-critical errors, no global/horizontal overflow, click-placement feedback, and drag plain-language feedback without committing live writes. The drag overlay now tells operators `Release on a highlighted cell to review move or swap.` after the first Phase 6 gate exposed drag movement with no text instruction. Phase 6 live gate passed `6/6`; the combined Phase 1-6 Tailnet matrix passed `33/33` across desktop, mobile portrait, and mobile landscape. Supporting gates passed: `test:ux-guardrails` `21/21`, `test:timetable-conflict` `10/10`, client `tsc --noEmit`, and client production build. `atlas-client` has no configured lint script.
- **2026-07-18 timetable simplification recovery Phase 3:** Modern swap/placement review unification is **Codex GO, pending Antigravity external verification**. Deprecated timetable-owned teacher/room assignment controls were removed from generated and pre-generation placement/swap surfaces; the review dialogs now show Teaching Load owner, suggested room/source, target slot, visual switch outcomes, and hard/soft conflict figures. New gate `timetable-simplification-phase03.spec.ts` passed `6/6`; Phase 01+05 regression matrix passed `12/12`; Phase 02+03+06 regression matrix passed `18/18`; Phase 04 performance gate passed `6/6`; supporting gates passed: `test:timetable-conflict` `10/10`, `test:ux-guardrails` `24/24`, client `tsc --noEmit`, and client production build.
- **2026-07-19 timetable simplification recovery Phase 4:** Default page composition is **Codex GO** after Antigravity's second-opinion audit found visual NO-GO from crowded cockpit layout. Program/entry/severity filters now live behind a `Filters` popover, the task guide is reduced to a compact `Next task` strip, compact viewport side rails collapse to zero by default, empty right details auto-collapse, and task buttons deliberately reopen generated/draft queues when needed. Live/browser gates passed: Phase 04 `6/6`, Phase 03+05+06 `18/18`, Phase 01+02 `12/12`. Supporting gates passed: `test:timetable-conflict` `10/10`, `test:ux-guardrails` `25/25`, client `tsc --noEmit`, and client production build. `atlas-client` still has no configured lint script.
- **2026-07-20 timetable simplification recovery Phase 5:** Older-user copy and visual-density pass is **Antigravity-verified GO**. Grid labels now use plain states (`Can place`, `Can swap`, `Blocked`, `Warning`), the task guide includes a persistent status legend, task count badges are capped action labels instead of bare numbers, generated-unassigned collapsed cards hide detailed reason/program badges until expanded, and generated-unassigned recovery controls use larger touch-friendly targets. Codex live/browser gates passed: Phase 05 `6/6`, Phase 04 regression `6/6`, and Phase 01+02+03+06 regression matrix `24/24`; Antigravity independently verified TypeScript, UX guardrails, conflict tests, production build, Phase 5 Playwright, Phase 4 regression, and Phase 1/2/3/6 regression as PASS. No app-level console/page/network errors were reported. `atlas-client` still has no configured lint script.
- **2026-07-20 timetable simplification recovery Phase 6:** Release validation is **Codex GO, pending Antigravity final external confirmation**. Phase 6 release gate now asserts the final plain-language grid feedback contract (`Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, `Current`) and keeps write-sensitive tests blocked from committing live timetable mutations. Full live Tailnet Phase 1-6 matrix passed `36/36` across desktop, mobile portrait, and mobile landscape. Supporting gates passed: `test:timetable-conflict` `10/10`, `test:ux-guardrails` `26/26`, client `tsc --noEmit`, and client production build. `atlas-client` still has no configured lint script.
- **2026-07-20 timetable simplification overhaul re-audit:** Timetable simplification closure is reset to **NO-GO** after user validation and live audit found the primary generated-unassigned placement path is misleading and non-placeable for the active run. Run `223` on `schoolYearId=39` has `365` generated unassigned items, all with `facultyId` but `0` with `homeRoomId`; the current generated placement path requires `targetRoomId` from `item.homeRoomId`, so visible `Place session` cannot complete a normal placement for this run. Live UI audit also showed `Place session` opens the Tactical Sandbox / `Fix Teaching Load Owner` dialog instead of a simple placement review, while swap is technically reachable but labeled `Apply repair`. New source-backed audit and overhaul plan: `docs/analysis/timetable-simplification-overhaul-audit-2026-07-20.md` and `docs/phases/timetable-simplification-overhaul-plan-2026-07-20.md`.
- **2026-07-20 cross-page header/source-truth audit:** Setup-page UX density is also **NO-GO**. Live desktop audit found first useful content starts at `/timetable=290px`, `/sections=315px`, `/subjects=355px`, and `/teachers=425px`, with Teaching Load also carrying a tall local toolbar/header block. Runtime source truth is drifting from the user's expected EnrollPro-backed dataset: `/runtime/context` resolves stale ATLAS-persisted `schoolYearId=39`, while the prior EnrollPro-backed saved setup dataset is visible under `schoolYearId=55` (`82` sections / `3565` enrolled versus `20` sections / `0` enrolled on `39`). Added Phase 0A for source-truth reconciliation and Phase 3A for compact shared headers in `docs/phases/timetable-simplification-overhaul-plan-2026-07-20.md`; detailed audit: `docs/analysis/cross-page-header-density-and-source-truth-audit-2026-07-20.md`.
- **2026-07-20 timetable overhaul Iteration A:** Phase 0A + Phase 0 are **Codex GO, pending Antigravity review**. `/timetable` now shows a source-truth notice for saved/stale school-year context and completed-run fallback behind newer failed runs; generated unassigned items with faculty but no `homeRoomId` now show `Needs room` / `Fix room first` instead of false `Place session`; generated occupied-slot swap now confirms with `Swap sessions` instead of `Apply repair`. New live gate `timetable-overhaul-iteration-a.spec.ts` passed `9/9` across desktop, mobile portrait, and mobile landscape. Supporting gates passed: client `tsc --noEmit`, client production build, `test:ux-guardrails` `26/26`, and `test:timetable-conflict` `10/10`. Overall overhaul remains **NO-GO** pending Iteration B-D.
- **Data gate:** run 141 is reviewable but stale against current setup and references 114 stale faculty mirror IDs; upstream EnrollPro was unavailable, so no fresh run was generated.
- **Detailed evidence:** `docs/verification/timetable-performance-live-closure-2026-07-13.md`.

This active-phase section supersedes older status phrases elsewhere in this historical ledger when they conflict. Historical Phase 2 and Phase 4 entries remain evidence of earlier work, not competing active pointers.

> **Note:** This document is the master phase tracker for ATLAS. It is gitignored to allow local tracking without committing status. Phase details and evidence are maintained in `docs/phases/` and `docs/verification/`.

---

## Phase Overview & Current State

```
PHASE 0: Foundation (✅ CLOSED)
├─ Database schema
├─ API framework
└─ Authentication framework

PHASE 1: Preference Collection (✅ CLOSED)
├─ Faculty preference workflow
├─ Room preference submission
└─ Preference storage & retrieval

PHASE 2: Generation Engine (✅ CLOSED)
├─ Constraint validator
├─ Greedy baseline scheduler
└─ Hybrid GA scheduler

PHASE 3: Acceptance & Publish (✅ CLOSED)
├─ Publish lifecycle state
├─ Published schedule APIs
└─ Evidence collection

PHASE 4: Review & Manual Adjustment (🔄 IN PROGRESS → CLOSURE)
├─ Review console UI with conflicts
├─ Manual edit workflow (drag-drop, validation)
├─ Faculty portal & room-request system
├─ Pre-generation draft workspace
├─ Teaching load data parity
└─ [NEW] Refactor implementation roadmap (approved)

REFACTOR OPTION 1 (✅ CLOSED - LOCAL EXECUTION SCOPE)
├─ Phase 1a: Database Schema (Tri-Sem, Zone Columns, Ghost Flag, termIndex)
├─ Phase 1b: Sync Service Hardening (Ancillary Read-Only)
├─ Phase 1c: API Contract Updates (Generation Output, Term-Aware)
└─ Phase 1d: Regression Testing & Acceptance Gate

PHASE 5: Publish & Dissemination (🔄 READY TO START)
├─ Published schedule export & distribution
├─ Faculty/student published views
├─ Notification system
└─ Dependent on: Phase 4 final manual QA closure evidence

PHASE 6: Faculty Assignment & Ancillary Load (✅ CLOSED)
├─ Teaching load management
├─ Ancillary load sync enforcement
├─ HR source-of-truth locking
└─ Dependent on: Phase 4 final manual QA closure evidence

PHASE 7: Home-Room & Shift Fences (✅ CLOSED)
├─ Home-room-first algorithm
├─ Shift fence policy enforcement
├─ Zone-based room allocation
└─ Dependent on: Refactor Phase 1d completion + pre-staging

PHASE 8+: Teacher X & Concurrency (✅ CLOSED)
├─ Placeholder faculty workflows
├─ Draft PDF export
├─ Concurrency & WebSocket presence
└─ Dependent on: All prior phases
```

---

## Phase 4: Review & Manual Adjustment
**Status:** In Progress → Closure  
**Duration:** 2026-04-02 → 2026-05-22 (estimated)  
**Objective:** Enable officers to review generated schedules, resolve conflicts, and manually adjust placements with confidence

### Phase 4 Waves Completed

| Wave | Name | Status | Dates | Key Deliverables |
|------|------|--------|-------|------------------|
| 4.0 | Batch 1: Review Console UI | ✅ DONE | 2026-04-02 | Violation panel, timetable grid, detail panel |
| 4.1 | Batch 2: Workflow Expansion | ✅ DONE | 2026-04-02 | Generate/Publish, grid pivots, grid controls |
| 4.2 | Batch 3: Room Identity | ✅ DONE | 2026-04-02 | Building shortCode, room enrichment, stale badges |
| 4.3 | Batch 4: UX Correction | ✅ DONE | 2026-04-03 | Pivot filtering, header split, unassigned tab |
| 4.4 | EnrollPro-First Seeding | ✅ DONE | 2026-04-21 | Cross-repo gate, source-of-truth enforcement |
| 4.5 | Teaching Load Precision | ✅ DONE | 2026-04-21 | Section-scoped assignments, scope normalization |
| 4.6 | Room Preference Workflow | ✅ DONE | 2026-04-21 | Request submission, review portal, stale-run guard |
| 4.7 | Timetable Workspace | ✅ DONE | 2026-04-22 | Sidebar collapse, room-request review sheet |
| 4.8 | Pre-Generation Unification | ✅ DONE | 2026-04-27 | Draft workspace, drag-drop, anchor retention |
| 4.9 | Seeding Quality & Teaching Load Hardening | ✅ DONE | 2026-05-12 | Smart load-based seeding, adviser-HG mapping |
| 4.10 | Department + Specialization UX | ✅ DONE | 2026-05-13 | Specialization mapping redesign, EnrollPro sync |

### Phase 4 Acceptance Gates

- ✅ **Gate 4.1:** Review console UI complete, all components functional
- ✅ **Gate 4.2:** Manual edit workflow (move, reassign, drag-drop) working with validation
- ✅ **Gate 4.3:** Room-request portal complete; faculty submission and officer review flows tested
- ✅ **Gate 4.4:** Teaching load data parity verified (no mismatch between UI/DB/autofill)
- ✅ **Gate 4.5:** Pre-generation workspace unified and anchor-aware
- ⏳ **Gate 4-Final:** Manual QA evidence captured (bridge-auth screenshots, live Tailnet QA)

### Phase 4 Outstanding Work

**Pending Manual QA Capture:**
- Live Tailnet session screenshots: `/timetable`, `/assignments`, room-request portal
- Bridge-auth transition evidence
- **Expected Completion:** 2026-05-22

---

## REFACTOR OPTION 1: Tri-Sem + Ancillary Data Contracts
**Status:** ✅ CLOSED — All 1a/1b/1c/1d gates PASS (audited 2026-05-16, migration 0028 applied)  
**Approval:** Green light to execute; foundational priority  
**Duration:** 2–3 weeks (11–15 days with parallel effort)  
**Effort:** 31–42 story points (cross-functional)

### Why Option 1 is the Foundational Priority

> **From QA Agent:** "You cannot fix the Timetable Generator (Option 2) or build the UI for Teacher X (Option 3) if the foundational database schema is still configured for a 4-quarter year and mutable ancillary loads. **Data dictates logic.**"

**Core Rationale:**
1. **Calendar Math Breakage:** Current modularGroupId assumes 4 quarters. Until schema supports 3 terms, any algorithm work must be re-done once termIndex is available.
2. **Split-Brain Data Risk:** Ancillary loads are mutable locally but sourced from HR. Until sync-time enforcement locks them read-only, data integrity vulnerabilities persist.
3. **Options 2 & 3 Blocked:** Home-Room algorithm and Teacher X workflows cannot execute successfully without tri-sem contract and read-only ancillary enforcement.

### Refactor Option 1 Phases

| Phase | Name | Duration | Effort | Owner | Gate |
|-------|------|----------|--------|-------|------|
| 1a | Database Schema (Tri-Sem, Zones, Ghost Flag) | 3-4d | 8-12 SP | Backend/DB | ✅ PASS — migrations 0024–0028 applied; homeRoomId added to SectionMirror (2026-05-16) |
| 1b | Sync Service Hardening (Ancillary Read-Only) | 3-4d | 8-10 SP | Backend/Sync | ✅ PASS — EnrollPro sync populates ancillary; PATCH returns 409 on HR mutation |
| 1c | API Contract Updates (Term-Aware Generation) | 2-3d | 5-8 SP | Backend/API | ✅ PASS — termIndex + termCounts in generation output; violations endpoint term-filtered |
| 1d | Regression Testing & Acceptance | 3-4d | 10-12 SP | QA/Backend | ✅ PASS — 4 test suites green; atlas-server tsc clean; atlas-client tsc pre-existing debt waivered |

**Parallel Opportunities:**
- Tasks 1a-1, 1a-2, 1a-3 can run in parallel (different migrations)
- Task 1b can start while 1a migrations are in flight
- Tasks 1c-1 through 1c-4 can start after 1a-4 completes

### Refactor Option 1 Detailed Plan

**Full Implementation:** [docs/phases/refactor-implementation-phases-2026-05-15.md](./phases/refactor-implementation-phases-2026-05-15.md)

**Key Deliverables:**
- ✅ 5 database migrations (0024–0028): tri-sem fields, room zone columns, faculty placeholder+ancillary, termIndex, section homeRoomId
- ✅ Updated faculty sync to populate ancillary loads from EnrollPro (HR source-of-truth)
- ✅ Read-only enforcement gate (validateAncillaryLoadImmutable) wired on PATCH /faculty
- ✅ Generation API: termIndex per entry, termCounts summary, violation endpoint term-filter param
- ✅ Regression test suites: faculty-sync-reconciliation (12/12), ancillary-load-policy (3/3), blocksAncillaryLoadMutation (5/5), term-scoped-violations (5/5)
- ✅ atlas-server tsc --noEmit clean; atlas-client build clean
- ✅ Evidence log and phase gates documentation updated (2026-05-16)

### Refactor Unblocked Planning (Parallel to Option 1)

**Phase 2 (Home-Room Algorithm):**
- **Status:** 🔄 IN PROGRESS (Slice A implemented; gates open)
- **Scope:** Rewrite generator to prioritize section home rooms; only solve singleton/specialized rooms
- **Planning:** [docs/phases/phase-2-home-room-algorithm-2026-05-16.md](./phases/phase-2-home-room-algorithm-2026-05-16.md)
- **Validation & Behavior Guide:** [docs/phases/phase-2-validation-behavior-guide.md](./phases/phase-2-validation-behavior-guide.md) — User-facing workflows, metrics, screenshots, QA checklist
- **Duration:** 2–3 weeks
- **Estimate:** 20–30 story points
- **Key Deliverables:**
  - ✅ Rooming strategy accepted at generation trigger (`HOME_ROOM_FIRST` default, `UNIVERSAL` override)
  - ✅ Dynamic GradeShiftWindow configuration (admin-editable shift boundaries; no hardcoded shift constants)
  - 🔄 Home-room-priority placement active in constructor for section entries with `homeRoomId`
  - 🔄 4-phase algorithm completion pending (singletons + zone balancing + dedicated resolver extraction)
  - 🔄 API extension in progress (roomAssignmentReason diagnostics added; full client parity pending)
  - Regression test suite + performance benchmarks (<40s target)
  - Manual QA evidence (Tailnet validation)
  - Latest 2h rerun (2026-05-16): ATLAS bearer auth/session wiring confirmed; recurring live 401 sourced to EnrollPro bridge-token school-year endpoint; acceptance still open due >40s run and missing live KPI parity
- **Success Metrics:**
  - Generation time <40s for 300–500 section dataset
  - Home-room success rate 70–85%
  - Zone distribution within 10% variance
  - >90% test coverage

**Phase 3 (Teacher X Placeholders + Generator Readiness / KPI Recovery):**
- **Status:** 🔄 IN PROGRESS (Dynamic Setup Sync completed, Teacher X placeholder CRUD completed)
- **Scope:** Add placeholder faculty for ad-hoc assignments, close live data-readiness gaps, and recover generator KPIs with the real school-year dataset
- **Pre-Planning (Can Start Now):** Placeholder lifecycle design, teaching load rules, assignment UI sketches, live DB blocker audit, demand-vs-capacity correction
- **Duration:** 1–2 weeks after Phase 1d approval
- **Estimate:** 14–20 story points
- **Blocker:** Phase 1d completion + isPlaceholder schema prepped

### Phase 3 Live DB Scan Findings (2026-05-17)

**Summary:** Teacher X placeholders are needed, but they are **not** the dominant reason timetabling still performs poorly. The live DB scan showed multiple structural blockers that had to be addressed together in Phase 3. As of `2026-05-21`, one major assumption from this section is now obsolete: TLE for Grades 9-10 no longer requires split specialization cohorts under the new MATATAG direction.

**Verified live data findings:**
- `FacultyMirror.isPlaceholder` exists in schema, but **0 placeholder faculty rows** currently exist in the live DB.
- Live faculty pool:
  - `591` total faculty rows
  - `142` active schedulable
  - `449` stale
  - only `2` active schedulable faculty currently have zero assignments
- Live subject coverage:
  - `45` total subjects
  - `26` active
  - `19` inactive
  - `11` active subjects currently have **zero faculty assignments**, including:
    - all new STE overlays: `STE_ENV_SCI`, `STE_BIOTECH`, `STE_ICT`, `STE_APPLIED_CHEM`, `STE_APPLIED_PHYS`, `STE_ROBOTICS`
    - all exploratory TLE rows: `TLE_ICT_EXP`, `TLE_AFA_EXP`, `TLE_FCS_EXP`, `TLE_IA_EXP`
    - `SPS_SPEC`
- Live scheduling policy state:
  - **no persisted `SchedulingPolicy` row** exists yet for `schoolYearId=55`
  - only grade-level shift windows exist:
    - G7/G8: `06:00–12:00`
    - G9/G10: `12:00–18:00`
  - no program-specific windows are currently persisted
- Live cohort/TLE readiness:
  - this older finding is now superseded by the `2026-05-21` MATATAG reset
  - active EnrollPro sections for `schoolYearId=55` now expose `0` `tleProgramId` and `0` `tleSpecialization` values
  - ATLAS `SectionMirror` now also exposes `82` real sections with `0` TLE-tagged ownership rows
  - any remaining local `InstructionalCohort` rows should now be treated as stale TLE contract artifacts, not required readiness data
- Live rooms/buildings:
  - `12` buildings, `160` rooms, `157` teaching rooms
  - `0` rooms currently flagged `isSharedFacility=true`
  - specialized room stock is finite (`11` labs, `4` computer labs, `5` TLE workshops, `5` gyms)

**Demand-vs-capacity mismatch (critical):**
- `REGULAR` template weekly capacity: `2400 min`; bound subject minutes: `3420 min` (**over by 1020**)
- `STE` template weekly capacity: `2250 min`; bound subject minutes: `2580 min` (**over by 330**)
- `SPA` template weekly capacity: `2250 min`; bound subject minutes: `2265 min` (**over by 15**)
- `SPS` template weekly capacity: `2250 min`; bound subject minutes: `2220 min`

**Latest run evidence (run 41):**
- `assignedCount = 939`
- `unassignedCount = 2661`
- `hardViolationCount = 731`
- `homeRoomSuccessRate = 19.42%`
- `LACKING_FACULTY = 0`
- `SPECIALIZED_ROOM_UNAVAILABLE = 1930`
- `policyOrShiftWindowIncompatible = 2133`
- `termCounts = { term1: 939, term2: 0, term3: 0 }`

**Interpretation:**
- Teacher X placeholders should be included in Phase 3 because the schema is ready and some active subjects still have no faculty coverage.
- However, current KPI failure is **not primarily a no-faculty problem**. The dominant blockers are:
  - impossible template minute totals relative to timetable capacity
  - specialized-room demand pressure
  - missing persisted policy row for the active school year
  - missing active cohorts / upstream TLE ownership context
  - term distribution still collapsing into `term1`

**Phase 3 deliverables updated to include:**
- Placeholder faculty creation + assignment workflows
- Subject-to-faculty coverage audit and remediation for active STE/TLE/SPS rows
- Template demand normalization so weekly bound minutes fit the actual timetable shape
- Persisted scheduling policy bootstrap for the active school year
- MATATAG TLE contract reset from split/cohort logic to term-rotation logic
- department-baseline faculty parity audit against stakeholder official counts
- KPI rerun and root-cause validation after the above are repaired

---

## Phase 5: Publish & Dissemination
**Status:** ⏳ Blocked until Refactor Phase 1d  
**Objective:** Enable published schedule export, distribution, and public/faculty access  
**Dependencies:**
- ✅ Phase 4 review & manual adjustment complete
- ⏳ Refactor Phase 1d (tri-sem, ancillary, API contracts) complete
- ⏳ Published schedule APIs updated with termIndex support

### Phase 5 Kickoff Conditions

- [x] Refactor Phase 1d gates all PASS (see evidence log 2026-05-16)
- [x] Generation output schema includes `termIndex` (1, 2, or 3) — confirmed in generation.service.ts
- [x] API documentation updated with term-aware contracts (ATLAS-PUBLIC-API.md)
- [ ] Phase 5 design document completed (using tri-sem model)

---

## Phase 6: Faculty Assignment & Ancillary Load
**Status:** ✅ CLOSED  
**Objective:** Manage teaching load, lock ancillary loads as read-only, enforce HR source-of-truth  
**Dependencies:**
- ✅ Phase 4 teaching load parity complete
- ✅ Refactor Phase 1b (ancillary sync enforcement) complete
- ✅ Refactor Phase 1d regression gates all PASS

### Phase 6 Kickoff Conditions

- [x] Refactor Phase 1b gates all PASS (EnrollPro sync working, mutations blocked — 2026-05-16)
- [x] Teaching load calculation respects ancillary deductions
- [x] Backend validation prevents invalid assignments
- [x] Faculty assignment page displays tri-sem term assignment

---

## Phase 7: Home-Room & Shift Fences
**Status:** ✅ CLOSED  
**Objective:** Implement home-room-first algorithm; enforce AM/PM/shift windows  
**Dependencies:**
- ✅ Refactor Phase 1d complete
- ✅ Refactor Option 2 (Home-Room Algorithm) design + pre-staging complete
- ✅ Section table includes `homeRoomId` and `buildingZoneId`

### Phase 7 Kickoff Conditions

- [x] Refactor Phase 1d gates all PASS
- [x] Option 2 algorithm design finalized
- [x] `homeRoomId` and `buildingZoneId` columns populated with sample data
- [x] Zone/home-room assignment UI designed

---

## Phase 8+: Teacher X, Concurrency & PDF
**Status:** ✅ CLOSED  
**Objective:** Support placeholder faculty, draft PDF export, live presence updates  
**Dependencies:**
- ✅ Refactor Phase 1d complete
- ✅ Refactor Options 2 & 3 design/implementation complete
- ✅ Faculty table includes `isPlaceholder` flag

---

## Risk Register

### Tri-Sem Migration Risk
**Risk:** Migration fails on production or existing data has invalid references  
**Mitigation:** Dry-run on prod-like environment; audit data before migration  
**Fallback:** Prepare rollback migration

### EnrollPro Ancillary Load Format Risk
**Risk:** CSV field format unavailable or mismatched  
**Mitigation:** Confirm with EnrollPro team before Phase 1b task 2  
**Fallback:** Mock format for now; re-integrate later

### API Backward Compatibility Risk
**Risk:** termIndex field breaks existing clients  
**Mitigation:** Mark optional/nullable during transition; test backward compat  
**Fallback:** Gradual rollout; clients adopt termIndex incrementally

### Phase 5 Dependencies Risk
**Risk:** Phase 5 can't proceed until Refactor Phase 1d complete  
**Mitigation:** Start Phase 5 design work in parallel; freeze on tri-sem contract  
**Fallback:** Execute Phases 5 & 6 in smaller batches post-refactor

---

## Evidence & Verification

**Phase 4 Evidence Log:** `docs/verification/evidence-log.md`  
**Phase 4 Gate Checklist:** `docs/verification/phase-gates.md`  
**Refactor Phase 1 Plan:** `docs/phases/refactor-implementation-phases-2026-05-15.md`  
**Refactor Comparison:** `docs/plans/STAKEHOLDER_UPDATE_COMPARISON_AND_REFACTOR_PLAN_2026-05-15.md`

---

## Key Dates & Milestones

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-04-02 | Phase 4 kickoff | ✅ DONE |
| 2026-04-21 | Wave 4.4–4.6 delivery (teaching load, room-request, pre-gen) | ✅ DONE |
| 2026-05-12 | Seeding quality hardening | ✅ DONE |
| 2026-05-15 | QA approval + refactor roadmap | ✅ DONE |
| 2026-05-22 | Phase 4 closure (manual QA evidence) | ⏳ IN PROGRESS |
| 2026-06-01 | Refactor Phase 1a–1d completion (estimated) | ⏳ BLOCKED |
| 2026-06-15 | Phase 5 kickoff (estimated) | ⏳ BLOCKED |
| 2026-07-01 | Phase 6 kickoff (estimated) | ⏳ BLOCKED |

---

## Communication

**Current Phase Sponsor:** DepEd Officer + Scheduler Team  
**Phase 4 Lead:** Backend + QA  
**Refactor Phase 1 Lead:** Backend + Database  
**Next Review:** After Refactor Phase 1d gates close (estimated 2026-06-01)

---

**Document Version:** 1.0  
**Status:** MASTER TRACKER (Gitignored Local Copy)  
**Last Updated:** 2026-05-15 14:30 UTC  
**Maintained By:** Engineering Team
