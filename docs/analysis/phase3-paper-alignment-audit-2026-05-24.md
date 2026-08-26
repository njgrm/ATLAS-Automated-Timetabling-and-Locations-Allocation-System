# Phase 3 Paper Alignment Audit - 2026-05-24

## Purpose

This audit checks whether the current ATLAS system still matches the claims in [Curio_Gilera_Gromea_ATLAS_BSIT3B.pdf](/d:/ATLAS/Curio_Gilera_Gromea_ATLAS_BSIT3B.pdf), especially:

- the stated objectives
- the claimed system behavior
- the claimed operator and user flows
- the current live state of the `Teaching Load` stream

This is not just a code scan. It is a paper-vs-system audit using:

- the capstone paper itself
- current repository routes, services, and docs
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- direct local database inspection
- current live Tailnet behavior where possible

## Executive Verdict

ATLAS is **substantially real as a product**, but it is **not yet fully accurate to the paper's strongest claims**.

The best summary is:

- the administrative scheduler platform is real and already broad
- the priority and review model is real
- the teacher preference portal is real but still incomplete against the paper's full teacher-facing promise
- the generation and review pipeline is real, but it is **not yet safe to describe as fully conflict-free or closure-grade**
- the paper's **PWA/offline** and **Genetic Algorithm** claims are currently stronger than the implementation truth
- the current highest-risk functional gap is no longer basic CRUD or dashboard work; it is **generation/publish readiness plus teaching-load clarity and staffing fidelity**

## What The Paper Claims

### Paper claims about product scope

From pages 8 to 14 and 43 to 45, the paper claims that ATLAS is:

- a mobile-accessible web application
- centered on a web-based administrative portal
- equipped with a drag-and-drop scheduling interface
- equipped with configurable scheduling priorities
- equipped with teacher authentication and preference submission
- capable of generating conflict-free timetables
- able to deploy finalized schedules to synchronized teacher and student views
- selectively offline-capable through local caching and deferred sync

### Paper objectives

From page 9, the paper's explicit technical objectives are:

1. web-based administrative portal with drag-and-drop scheduling interface
2. configurable scheduling priority management module
3. mobile teacher authentication with schedule preference submission
4. automated timetable generation system

### Paper architectural and behavioral claims

From pages 11 to 14, 44 to 45, and 55 to 73, the paper also claims:

- a centralized but browser-based scheduling system
- student public schedule access
- teacher-specific synchronized schedule access
- offline-capable selected actions with later synchronization
- real-time or synchronized schedule dissemination
- a Genetic Algorithm as the core generation engine
- data structures for mirrors, policies, runs, manual edits, follow-up flags, locked sessions, snapshots, specialization aliases, and class templates

## Current System Reality

### What is clearly real already

The current system already has strong implementation depth in these areas:

- scheduler shell and core admin pages
- `Subjects`, `Teachers`, `Teaching Load`, `Sections`, `Map`, `Timetable`, and `Audit` surfaces
- subject contract management with department ownership, program scope, and rotation metadata
- teacher mirror sync and local auth
- generation run lifecycle, review workspace, and manual edit scaffolding
- published schedule APIs
- section-first assigned-classes APIs
- faculty preference and room-preference workflows
- room-request review and synchronization flows

Current main routes in [App.tsx](/d:/ATLAS/atlas-client/src/App.tsx:1) confirm the implemented scheduler and faculty surfaces:

- `/subjects`
- `/teachers`
- `/teaching-load`
- `/sections`
- `/timetable`
- `/my`
- `/my/preferences`
- `/my/room-preferences`

### What is only partially true

The following paper claims are only partially met:

- teacher-facing schedule dissemination
- student/public synchronized viewing experience
- offline-first PWA behavior
- final timetable quality / publish readiness
- term-aware teaching-load clarity for schedulers

### What is currently inaccurate relative to the paper

Two important paper-level claims are materially inaccurate today:

1. **Genetic Algorithm as the core engine**
   - The current implemented core is documented as a deterministic greedy baseline constructor in [docs/SYSTEM-OVERVIEW.md](/d:/ATLAS/docs/SYSTEM-OVERVIEW.md:143) and [schedule-constructor.ts](/d:/ATLAS/atlas-server/src/services/schedule-constructor.ts:3).
   - There is hybrid scheduling work in the repo, but the live operational truth is not "GA-first" in the clean way the paper describes.

2. **Offline-capable PWA behavior**
   - Current docs still explicitly record that there is **no full service worker / manifest / workbox baseline**.
   - See [objectives-priority-progress-check-2026-05-07.md](/d:/ATLAS/docs/progress/objectives-priority-progress-check-2026-05-07.md:42).
   - Some pages have degraded read or queued sync behavior, but ATLAS is not yet a complete offline-first PWA in the stronger sense used by the paper.

## Objective-by-Objective Audit

### Objective 1.1 - Web-based administrative portal with drag-and-drop scheduling interface

**Status:** Mostly aligned

**Why:**

- The scheduler-facing shell is real.
- The review console and manual edit workflow exist.
- Drag-and-drop and manual placement behavior exist in timetable and pre-generation review surfaces.
- `Subjects`, `Teachers`, `Teaching Load`, `Sections`, and `Map` together clearly satisfy the "administrative portal" part.

**Remaining gap:**

- The manual-edit and assignment surfaces still need UX closure and stronger live QA evidence.
- `Teaching Load` in particular has been accurate in parts, but unstable in clarity and live reliability.

**Practical assessment:** around `85%` to `90%` aligned.

### Objective 1.2 - Configurable scheduling priority management module

**Status:** Mostly aligned

**Why:**

- Scheduling policy entities and routes exist.
- The policy workspace is real.
- Constraint and scheduling policy records are part of the current schema and service layer.
- The runtime docs and generation services already treat policy as a real input, not a placeholder concept.

**Remaining gap:**

- Policy effectiveness still depends on generator readiness and final publish quality.
- Some policy concepts in the paper are more mature than the live runtime evidence.

**Practical assessment:** around `90%` to `95%` aligned.

### Objective 1.3 - Mobile teacher authentication with schedule preference submission

**Status:** Partially aligned

**What is already true:**

- local ATLAS login exists via [auth.router.ts](/d:/ATLAS/atlas-server/src/routes/auth.router.ts:1)
- faculty self-service routes exist:
  - `/my`
  - `/my/preferences`
  - `/my/room-preferences`
- preference submission is real
- room preference workflow is real
- mobile-first faculty dashboard work exists

**What is still missing or weaker than the paper:**

- no completed faculty published schedule view at `/my/schedule`
- no strong app-wide PWA baseline
- offline queueing exists in room-preference workflows, but not as a clean whole-product faculty offline story

**Practical assessment:** around `70%` to `75%` aligned to the paper's stronger teacher-experience promise, even though auth and preference submission themselves are real.

### Objective 1.4 - Automated timetable generation system

**Status:** Partially aligned

**What is real:**

- generation routes and services exist
- draft runs, summaries, violations, and review workflow exist
- published schedule APIs exist
- manual intervention and repair workflows are real

**What blocks full paper-level alignment:**

- the system cannot yet honestly be presented as consistently producing a publish-ready, conflict-free timetable in live operations
- current runtime docs still treat generator readiness as open
- generation quality is still affected by real coverage gaps, subject-contract evolution, and review-stage correction needs

**Practical assessment:** around `70%` to `80%` aligned as a working feature family, but **not yet aligned enough** to the paper's "conflict-free timetable" framing.

## System Behavior Audit Against Paper Claims

### Claim: mobile-responsive web app

**Verdict:** Accurate

The system is clearly a browser-based React application with explicit mobile-aware faculty flows.

### Claim: teacher and student synchronized finalized schedules

**Verdict:** Partially accurate

What exists:

- published schedule APIs exist, including section and faculty views

What does not yet match the paper cleanly:

- there is no completed faculty schedule page at `/my/schedule`
- there is no clearly finished student/public front-end schedule viewer in the main client
- image-download student experience is not established as a completed user-facing product flow

### Claim: selective offline capability with deferred sync

**Verdict:** Partially accurate

What exists:

- some offline/degraded-state handling
- room-request queue and sync behavior
- read-only fallback behavior on some scheduler pages

What does not yet match the paper:

- no manifest/service worker baseline
- no broad offline-first contract for the app as a whole
- offline behavior is still workflow-specific, not platform-wide

### Claim: conflict-free timetable generation

**Verdict:** Not yet safe to claim

The system has a real generator and a real review process, but the paper's phrasing is stronger than current live truth.

Current documentation and runtime evidence still treat generator readiness and publish quality as open concerns. ATLAS is not a fake prototype, but it is also not yet at the point where "conflict-free timetable" should be used as an unconditional factual claim.

### Claim: Genetic Algorithm core engine

**Verdict:** Not accurate to current implementation truth

The current operational core is better described as:

- deterministic greedy baseline construction
- with hybrid/refactor work around it

If the paper is retained as-is, this should be treated as a documentation mismatch unless the live engine is later brought back into full alignment with that description.

## Data Model Alignment Audit

### Strong alignment

The paper's schema direction is substantially reflected in the real database:

- `School`
- `Building`
- `Room`
- `Subject`
- `FacultyMirror`
- `SectionMirror`
- `SchedulingPolicy`
- `GenerationRun`
- `ManualScheduleEdit`
- `AuditLog`
- `FollowUpFlag`
- `LockedSession`
- `GradeShiftWindow`
- snapshots and aliasing support
- class templates

### Partial or stale alignment

Some paper-era data concepts no longer match the best current product direction exactly:

- `session_pattern` is not central in the current subject contract direction
- specialization mapping as a scheduler-facing surface is being removed/demoted
- umbrella `TLE` assumptions in the paper are stale relative to the current MATATAG contract reset
- instructional cohort logic is no longer the right primary explanation for current TLE handling

So the paper is still broadly aligned at the schema level, but some of its conceptual explanations are already behind the actual product evolution.

## Teaching Load Reality Check

### What is now fixed

The current `Teaching Load` stream has improved materially:

- stale ownership has been reconciled
- section-first assigned-classes APIs exist
- special-program assignment identity now lives at assignment level
- staffing reporting distinguishes raw uncovered rows from concurrent shortage
- synthetic placeholder masking is no longer treated as normal success

### What still blocks closure

The remaining live problem is no longer hidden stale data. It is:

- real Science-family staffing shortage
- real TLE family-member coverage shortage
- weak scheduler-facing rotation clarity
- incomplete special-program distribution strategy

### DB findings that matter

Direct DB inspection confirms:

- multiple active `MAPEH` teachers still carry `0h` real section-owned load
- `SPA_SPEC` and `SPS_SPEC` are fully owned, but distribution is concentrated
- assignment-level specialization labels are real on ownership rows, for example:
  - `DANCE`
  - `FINE ARTS`
  - `MAJOR IN MUSIC EDUCATION`
  - `THEATER / PERFORMING ARTS`
  - `SPORTS SCIENCE`

That means specialization **does matter**, but not as the old scheduler-facing qualification gate. It matters as a **distribution signal and assignment identity layer**.

### Current teaching-load truth

The best current interpretation is:

- stale ownership is fixed
- staffing impact is mostly truthful now
- remaining shortages are real coverage problems, not hidden stale-data bugs
- per-term rotation math exists in the load model, but the scheduler still does not see it clearly enough during manual assignment

### Current live reliability caveat

During this audit, authenticated live probes to teaching-load summary and staffing endpoints intermittently returned:

- `SERVER_ERROR`
- `fetch failed`

That does not invalidate the entire stream, but it means the runtime is still operationally fragile enough that "fully stabilized" would be too strong a claim.

## Are These The Right Next Steps?

The proposed steps were:

1. add a special-program distribution pass for `SPA_SPEC` / `SPS_SPEC`
2. add a rotation-family clarity pass for `SCIENCE` and `TLE_ROTATION`
3. keep staffing reporting math, but add a second operator-facing view for:
   - coverage shortage
   - underutilized teachers by department
   - re-distributable special-program ownership

## Verdict On Those Steps

### For Teaching Load specifically

**Yes, these are the right next steps.**

Why:

- stale ownership has already been fixed, so reopening truth repair is no longer the best use of effort
- current remaining blockers are distribution and clarity, not basic integrity drift
- `MAPEH` underutilization plus assignment-level special-program identity makes a distribution pass appropriate
- current teacher-side per-term math exists, but scheduler-side communication is still weak, so a rotation-clarity pass is necessary
- operators need a better distinction between:
  - shortage caused by actual uncovered sections
  - shortage caused by weak distribution
  - shortage that is not actually recoverable inside the current department/specialization mix

### For the broader capstone objectives

**No, these steps are not sufficient by themselves to accomplish the full paper objectives.**

They are the right next steps for closing `Teaching Load`, but they do not close the bigger paper-alignment gaps:

- faculty published schedule page
- student/public finished schedule experience
- image-export/student-friendly dissemination
- true PWA baseline
- generator/publish closure confidence
- paper/documentation correction around algorithm truth

## Recommended Sequencing From Here

### Teaching Load closure track

1. **Special-program distribution pass**
   - use assignment-level specialization identity for `SPA_SPEC` / `SPS_SPEC`
   - treat idle `MAPEH` teachers as redistribution candidates only where specialization identity supports it

2. **Rotation-family clarity pass**
   - keep one canonical adjusted teaching load
   - show raw row impact versus adjusted concurrent impact during manual placement
   - expose term-family behavior plainly for `SCIENCE` and `TLE_ROTATION`

3. **Operator shortage view**
   - separate:
     - raw uncovered rows
     - concurrent weekly shortage
     - underutilized teachers by department
     - redistributable special-program ownership

### Objective-closure track beyond Teaching Load

After the teaching-load closure work, the bigger objective-closing priorities should be:

1. faculty published schedule view
2. student/public published schedule experience
3. actual PWA baseline
4. publish/generator readiness proof
5. paper/documentation correction on algorithm truth if the engine remains greedy-first

## Bottom Line

ATLAS is already much more than a prototype, and the paper is not fundamentally detached from the system. But the paper currently **overstates** several things:

- PWA/offline maturity
- synchronized teacher/student schedule experience
- fully conflict-free generation readiness
- Genetic Algorithm accuracy as the live core implementation

The recommended next Teaching Load steps are correct, but they should be treated as:

- **the right next steps for Teaching Load closure**
- **not the final steps for total capstone-objective closure**

The most accurate current project statement is:

> ATLAS already satisfies most of the scheduler-admin platform and policy-management goals, partially satisfies the teacher workflow goal, and still needs publish-facing, offline, and generation-readiness closure to fully match the strongest claims in the paper.
