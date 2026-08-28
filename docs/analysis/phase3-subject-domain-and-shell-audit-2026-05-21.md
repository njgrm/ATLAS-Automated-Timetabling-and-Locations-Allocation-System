# Phase 3 Subject Domain And Shell Audit

Date: 2026-05-21

## Purpose

This audit resets the next ATLAS workstream away from generator-only tuning and back toward the operator pages that still shape bad runtime data.

The goal is to identify:
- what is still wrong in the `Subjects` and `Teaching Load` workflow
- whether the `Specialization Mapping` page should remain a first-class scheduler surface
- how the sidebar should be reordered to reflect the real chronological scheduler process
- which subject-domain fixes should land before more broad generator passes

This audit uses:
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- stakeholder files already reviewed in prior audits
- current ATLAS code and live DB state

## Executive Summary

The latest MATATAG TLE reset proved that the system can stop solving the wrong TLE problem.
But the remaining NO-GO pressure is now clearly being amplified by page-level contract drift, especially in `Subjects`, `Teaching Load`, and shell navigation.

The next work should not be another broad generator-only prompt.
It should be:

1. a **subject-domain and teaching-load reset**
2. then a **sidebar and process information-architecture reset**

The strongest reasons:
- the subject contract is still modeled too much around specialization gating and not enough around department ownership
- the subject page still hides important state and uses the wrong source for specialization choices
- inactive subjects cannot be deleted because historical faculty-subject rows still exist in the DB even when they no longer appear in the visible teaching-load workflow
- the scheduler shell still does not communicate the actual chronological workflow

## 1. Latest Runtime Context After MATATAG Reset

Latest evidence entry:
- `2026-05-21 - Phase 3 MATATAG TLE Reset + Generation Gate One-Shot (Tailnet + DB)`

What improved:
- stale TLE cohort dependence is gone from active generation
- `cohortCount=0`
- `cohortizedClassCount=0`
- `modularWarnings=0`
- `policyBlockedCount` contracted from `1357` to `201`
- `hardViolationCount` contracted from `1077` to `827`
- `unassignedCount` contracted from `1205` to `997`

What remains open:
- `UNASSIGNED_SECTION=757`
- `SPECIALIZED_ROOM_UNAVAILABLE=240`
- `FACULTY_EXCESSIVE_IDLE_GAP=317`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=678`
- `FACULTY_SUBJECT_NOT_QUALIFIED=70`

This means the current generator is now reflecting page/data contract drift more honestly than before.

## 2. Subject Page Data-Contract Findings

### 2.1 Subject catalog is still carrying obsolete assignment history

Live DB snapshot:
- `42` total subjects
- `26` active subjects

Inactive subjects still blocked from deletion because they have historical `FacultySubject` rows:
- `ADVANCED_CHEMISTRY` (`48`)
- `ADVANCED_PHYSICS` (`40`)
- `ADVANCED_STATISTICS` (`24`)
- `BASIC_STATISTICS` (`13`)
- `BIOTECHNOLOGY` (`19`)
- `CONSUMERS_CHEMISTRY` (`14`)
- `ELECTRONICS` (`58`)
- `ELECTRONICS_ROBOTICS` (`15`)
- `ENV_SCI` (`14`)
- `SCI_PHYS` (`18`)
- `TLE_SPEC_HE_COOKERY` (`1`)
- `TLE_SPEC_IA_CARPENTRY` (`1`)

Total assignment rows still pointing at inactive subjects:
- `265`

Implication:
- the delete rule in `subject.service.ts` is checking any historical `facultySubjects` row
- the UI does not surface that dependency clearly
- the visible teaching-load page can appear clean while DB-level historical rows still block scheduler actions

### 2.2 Regular TLE is still too specialization-shaped in the operator contract

Current active TLE family:
- `TLE`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`
- `TLE_IA_EXP`

Current active shape:
- all four exploratory rows apply to Grades `7-10`
- `modularGroupId = TLE_EXPLORATORY`
- `termGroupId = TLE_EXPLORATORY`
- two rows still prefer non-classroom room types:
  - `TLE_ICT_EXP -> COMPUTER_LAB`
  - others -> `CLASSROOM`

This is acceptable for internal rotation mechanics, but the operator-facing subject page is still exposing the contract as if specialization restriction were the main idea.

That is now the wrong operator abstraction.

The new correct abstraction is:
- TLE is a section-scoped rotating family across Grades `7-10`
- department ownership is `TLE`
- specialization detail is secondary metadata, not the main scheduler decision surface

### 2.3 SPA and SPS specialization detail exists but is not visible enough

Current live rows:
- `SPA_SPEC` with `7` enabled specialization values
- `SPS_SPEC` with `16` enabled specialization values

Current UI behavior on `/subjects`:
- only shows a badge like `locked 7 specs` / `locked 16 specs`
- does not let the scheduler inspect the actual values directly on the list
- modal sources specialization choices from `/faculty/specializations`, which is the wrong authority for subject contract state

Implication:
- the subject page hides important upstream-driven detail
- the page is not trustworthy enough for scheduler validation of SPA/SPS offerings

### 2.4 The subject page mutates too much on load

Current page behavior:
- `fetchSubjects()` calls `POST /subjects/seed` before every list load

Implication:
- page open is not read-only
- scheduler cannot easily distinguish viewing from contract mutation
- this weakens trust and makes auditability worse

### 2.5 The subject form still violates the frontend rule set

Current `SubjectFormModal` still uses multiple raw `<button>` chip controls for:
- grade selection
- program scope selection
- specialization selection
- minute presets
- minute/hour toggle

That violates the project’s stated design-system rule against raw styled buttons as form controls.

## 3. Teaching Load Workflow Findings

### 3.1 The real business authority is manual faculty placement, not specialization aliasing

Stakeholder workflow now clarified:
- department heads decide many teacher-to-section placements
- scheduler manually translates those decisions into the system
- auto-fill is only a fallback where manual decisions are absent
- saved/manual placements must be respected and not removed by generation or autofill

Current ATLAS status:
- manual assignments are already preserved better than before
- auto-fill still contains specialization- and alias-driven reasoning that remains heavier than the real workflow

The next subject-domain pass should therefore strengthen:
- department-based defaults
- lock-respect semantics
- explicit operator visibility for locked/manual ownership

### 3.2 Teaching Load and Subjects are still misaligned for deletion and cleanup

Because historical `FacultySubject` rows survive even when subjects are inactive:
- the subject page blocks deletion
- the teaching-load page may not make the blocker visible in a useful way

This is a domain-cleanup problem, not just a toast-message problem.

## 4. Is Specialization Mapping Still Important?

Decision: **not as a first-class scheduler page**

Why:
- the school’s real workflow is department-head driven, not alias-mapping driven
- the specialization page adds cognitive load and setup overhead
- recent MATATAG TLE change further reduces the centrality of regular-track specialization routing

Recommended direction:
- move the main qualification baseline to **subject -> department ownership**
- keep specialization detail only where it materially matters:
  - SPA
  - SPS
  - possibly selected STE overlays
- demote `Specialization Mapping` from main scheduler flow
- either:
  - hide it behind an advanced/admin section, or
  - plan its removal after subject-level department ownership fully replaces it

## 5. Sidebar And Scheduler Process Audit

Current sidebar groups:
- `Navigation`
- `Scheduling`
- `Campus`
- `Insights`

This is not aligned with the actual scheduler process.

Problems:
- setup pages and execution pages are mixed together
- `Specialization Mapping` sits beside core daily workflow pages
- `Map Editor` is visually detached from the setup flow
- the shell does not show clear progression from setup -> staffing -> inputs -> generation -> validation

### Recommended scheduler order

For privileged scheduler/admin users:

1. `Dashboard`

2. `School Setup`
- `Sections`
- `Campus & Rooms` (rename from `Map Editor`)
- `Subjects`

3. `Faculty Planning`
- `Faculty`
- `Teaching Load`

4. `Input Collection`
- `Preferences`
- `Room Requests`

5. `Build & Validate`
- `Timetable`
- `Room Schedules`
- `Audit`

6. `Advanced`
- `Specialization Mapping` only if retained

Design notes:
- the sidebar should communicate chronology, not database domain grouping
- locked or optional advanced tools should not compete visually with the core scheduler path

## 6. Subject-Domain Direction To Implement Next

The next subject pass should do all of the following:

### A. Reset ownership modeling
- add or expose subject-level department ownership as the default qualification baseline
- make this visible in subject CRUD
- make autofill and qualification logic lean on it first

### B. Keep specialization only where it truly matters
- remove specialization-heavy regular TLE treatment from the operator experience
- keep SPA/SPS enabled specialization visibility
- ensure those values come from upstream offering state or synced ATLAS subject contract, not faculty-specialization list scraping

### C. Repair delete and cleanup semantics
- expose why a subject cannot be deleted
- differentiate:
  - active blocker
  - historical blocker
  - safe cleanup candidate
- provide safe cleanup/archive behavior for stale inactive-subject assignment rows

### D. Improve subject UX
- explicit sync actions
- visible specialization/department/rotation metadata
- read-only versus mutating actions clearly separated
- no hidden seeding on passive page load
- use proper UI primitives instead of raw button chips

### E. Preserve normalized stakeholder outputs
- class-program and section/master schedule labels remain normalized:
  - `SCIENCE`
  - `TLE`
  - `SPECIALIZATION`
  - `RESEARCH`
- internal canonical rows may stay more granular if generation still needs them

## 7. Recommended Next Prompt Order

1. `phase3-subject-domain-reset-and-ux-one-shot-prompt.md`
2. `phase3-shell-process-ia-one-shot-prompt.md`

Reason:
- fix the subject contract and teaching-load authority first
- then reorganize navigation around the final intended workflow

## 8. Explicit Decisions

- Do not reopen stale TLE cohort work.
- Do not treat the specialization-mapping page as the primary qualification tool anymore.
- Do not rely on faculty specializations endpoint as the source of subject-contract specialization options.
- Do not keep blocking inactive-subject deletion purely because historical `FacultySubject` rows still exist with no useful active scheduler meaning.
