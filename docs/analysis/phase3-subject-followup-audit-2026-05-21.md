# Phase 3 Subject Follow-Up Audit

Date: 2026-05-21

## Purpose

Re-audit the `Subjects` pass after the first subject-domain reset landed and validate the remaining defects against:
- current live DB state
- current live Tailnet subject API
- the stakeholder baseline and MATATAG TLE reset
- the scheduler workflow clarified by the user

This audit exists to define the next subject-focused repair prompt precisely.

## Executive Summary

The first subject-domain pass improved the contract shape, but it is not ready for closure.

What is correct now:
- subject reads now expose ownership-style metadata
- delete blockers are now categorized
- passive seeding on page load is gone
- SPA/SPS specialization detail is at least inspectable

What is still wrong:
- ownership metadata is still heuristic-only, not a real operator-controlled subject contract
- the delete flow is truthful but still incomplete as an operator workflow
- the page is still visually overloaded
- specialization restriction is still editable in CRUD when it should mostly be sync-driven and view-only
- regular TLE is still represented too literally as both one family row and four exploratory rows without a clear operator abstraction
- duration defaults are still misaligned for several special-program rows

## 1. Delete Blocker Validation

The reported `ADVANCED_CHEMISTRY` blocker is real.

Direct DB check:
- subject: `ADVANCED_CHEMISTRY`
- active assignments: `46`
- historical assignments: `2`

So the current delete refusal is correct.
The problem is not that deletion is failing incorrectly.
The real problem is that the scheduler does not have an adequate remediation path from that blocker state.

### What is missing

The blocker modal currently shows:
- active assignment count
- historical assignment count
- archive button
- cleanup historical + delete button only when historical cleanup is eligible

But it still does **not** provide:
- a direct action to inspect/remove the active assignments causing the block
- a route into the teaching-load page already filtered to that subject
- an archived subject workflow or archive list

Conclusion:
- your concern is valid
- the backend guard is correct
- the operator flow is incomplete

## 2. Ownership Snapshot Validation

The new ownership metadata is not coming from an operator-controlled data field yet.

It is currently computed by heuristics in:
- `atlas-server/src/services/subject-ownership.service.ts`

Examples:
- prefix-based owner inference
- hardcoded department normalization
- hardcoded rotation-family inference such as:
  - `SCI_* -> SCIENCE`
  - `TLE* -> TLE_ROTATION`

So your concern is correct:
- there are currently no real controls for that snapshot
- it is useful as a temporary read model
- but it is not sufficient as the long-term subject authority contract

Conclusion:
- this metadata should become persisted subject contract data
- seed/inference can bootstrap it
- but the scheduler must be able to inspect and adjust it in CRUD

## 3. TLE Family Decision

Current live active rows:
- `TLE`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`
- `TLE_IA_EXP`

All five currently expose:
- Grades `7-10`
- `240` minutes for the TLE family rows
- department ownership `TLE`
- normalized output label `TLE`

This creates a real operator ambiguity:
- one visible umbrella row
- four visible child rows
- all pointing to the same outward-facing schedule concept

### Recommended decision

Do **not** delete the exploratory child rows yet if generation still needs them for internal rotation logic.

Instead:
- keep one visible scheduler-facing TLE family row
- treat the four exploratory rows as system-managed rotation members
- hide or collapse those child rows from normal CRUD/listing
- expose them only in an advanced/internal breakdown if needed

That best matches the stakeholder output, which shows `TLE`, not four independent regular-track TLE subjects.

Conclusion:
- your concern is valid
- the right next step is not to flatten immediately at the DB layer
- the right next step is to separate **operator-facing family** from **internal rotation members**

## 4. Specialization Restriction Validation

Your criticism is correct for most of the current subject CRUD.

Current state:
- `SubjectFormModal` still lets operators toggle `allowedSpecializations`
- the source is no longer faculty-specialization scraping, which is an improvement
- but it is still the wrong everyday control for most scheduler work

### Correct direction

For regular-track work:
- specialization restriction should not be a primary editable control

For SPA/SPS:
- enabled specialization values should be sync-driven from upstream
- visible and inspectable
- not casually hand-toggled by the scheduler in normal CRUD

For STE:
- if a specialization-like constraint still matters, it should be treated as explicit subject contract metadata, not ad hoc chip toggles

Conclusion:
- the specialization-restriction editor should mostly become view-only
- only real upstream/sync-aware subject contract refresh should change those values by default

## 5. Duration Validation

Current live subject durations:
- regular core rows: mostly `240`
- `HG`: `60`
- `TLE` family rows: `240`
- `SPA_SPEC`: `45`
- `SPS_SPEC`: `45`
- many `STE_*` rows: `45`

Your proposed rule:
- all subjects should be `240` except `HG`

### Assessment

The stakeholder class-program PDFs show that special-program blocks occupy the same visible timetable slot lengths as regular subjects.

Examples directly visible in the PDFs:
- Grade 7:
  - `SPECIALIZATION` occupies `3:15-4:00`
  - `RESEARCH` or another specialization block occupies `4:00-4:45`
- Grade 8:
  - `BIOTECH`, `SPA SPECIALIZATION`, `DEVL READING`, `ICT`, and `RESEARCH` all sit in standard `45` minute slots
- Grade 9:
  - `APPLIED CHEMISTRY`
  - `SPECIALIZATION SPA`
  all use the same `3:15-4:00` and `4:00-4:45` blocks as regular subjects
- Grade 10:
  - `APPLIED PHYSICS`
  - `SPECIALIZATION 1`
  - `SPECIALIZATION 2`
  all use the same visible `45` minute slots as regular subjects

So the stakeholder outputs support this narrower conclusion:
- special-program blocks use the same **slot length**
- but they do **not** prove that every internal canonical subject row should be assigned `240` min/week

Why that distinction matters:
- a subject can occupy the same `45` minute slot size while still being one member of a rotating or term-scoped family
- blindly forcing every internal `STE` / `SPA` / `SPS` row to `240` would still radically change template math and may overcount rotational overlays

Conclusion:
- regular core + regular TLE = yes, `240`
- `HG = 60`
- stakeholder PDFs confirm same **slot durations**, not necessarily same **weekly-minute identity** for every internal special-program row
- the next pass should use this to simplify operator-facing duration logic and family modeling, but should still avoid a blind blanket `240` reset for all internal special-program rows unless the data model is also simplified

## 6. UX/UI Findings Still Open

### 6.1 Subject name column is overloaded

Current subject-name cell still stacks:
- subject name
- modular badge
- DepEd core badge
- program-scope badges
- owner badge
- qualification badge
- rotation badge

This is too dense for the primary table.

Your concern is valid.

### 6.2 Inter-section column is low value

Current inter-section column is still consuming table width and visual complexity.

Given the current scheduler priorities:
- this is not one of the top operator signals
- moving program scope into that slot is a better trade

Your concern is valid.

### 6.3 Archive affordance is too hidden

Archive currently exists only as a blocker-remediation path.
There is no explicit:
- archive action in the normal row action set
- archived subject view/state
- archive-oriented management flow

Your concern is valid.

### 6.4 Subject-to-teaching-load jump is missing

When deletion is blocked by active assignments, the scheduler should be able to:
- jump directly to Teaching Load
- already scoped to the blocking subject

That is currently missing.

### 6.5 Hidden active assignment behavior is real

The current Teaching Load page loads only active subjects into the subject list.

That means:
- inactive subjects can still have active `FacultySubject` rows
- those rows can continue to block subject deletion
- but the normal Teaching Load subject view does not surface them clearly

This matches the user-reported confusion and is a real workflow defect.

Conclusion:
- inactive-subject assignment rows must either be surfaced clearly in remediation flows
- or be explicitly reset/removed through safe bulk controls
- or both

### 6.6 Global teaching-load reset is now justified

Given the current subject-normalization work, a privileged global teaching-load assignment reset is justified.

Why:
- inactive subjects can still retain active `FacultySubject` rows
- those rows can block delete/archive cleanup
- those rows are not surfaced clearly enough in the normal Teaching Load workflow

That reset should be:
- privileged-only
- school-year scoped
- explicit about destructive impact
- previewable before apply
- able to preserve historical audit visibility where needed

This is especially important now that the subject page is being normalized around:
- department ownership
- view-first specialization state
- cleaner TLE family handling

### Recommended delete/remediation rule

Deleting an inactive subject should not silently fail because of hidden stale assignments.

Recommended behavior:
- if active assignments still exist, block delete but expose direct remediation actions
- allow bulk removal of active assignments for that inactive subject from the blocker flow
- allow historical assignment cleanup separately
- if the user explicitly confirms full cleanup for an inactive subject, the system may remove both active and historical `FacultySubject` rows tied to that subject before deleting it

That is safer than either:
- silently deleting hidden rows with no operator confirmation
- or leaving the user stuck with a blocker they cannot resolve from the UI

Because hidden/stale assignment rows are still shaping subject cleanup and generator realism, a global privileged reset action is justified for this normalization phase.

Recommended behavior:
- privileged-only
- school-year-scoped
- explicit confirmation
- preview of rows to be removed
- clear statement of what is preserved, if anything

This should exist as an operator tool for normalization and baseline repair, not as a casual everyday action.

### 6.5 Specialization inspectability improved but is still not final

The new inspect dialog is better than the old count badge.
But the page still treats this as a generic extra detail instead of presenting it as:
- upstream-synced offering detail
- scheduler-read-only contract state

## 7. Live Data Correctness Versus What We Know

What matches our current understanding:
- regular TLE split/cohort logic is gone from active generation
- TLE family rows are all now `240`
- subject reads now expose normalized output labels
- SPA/SPS still exist as umbrella subject rows with specialization lists
- `ADVANCED_CHEMISTRY` delete blocker counts are real

What still drifts from the desired model:
- ownership snapshot is heuristic, not persisted
- SPA/SPS/STE duration values are still partly legacy
- regular TLE operator representation is too fragmented
- subject archive/remediation workflow is incomplete
- CRUD still exposes too much specialization editing power

## 8. Recommended Next Prompt Goals

The next prompt should do all of the following in one pass:

1. make subject ownership a real persisted contract field or explicit persisted subject metadata
2. turn regular TLE into a single visible scheduler-facing family while keeping internal rotation support if needed
3. make specialization values mostly sync-driven and view-only
4. add subject archive management and delete remediation flows
5. add jump-to-Teaching-Load remediation for active delete blockers
6. add a global teaching-load assignment reset workflow for normalization and hidden-row cleanup
7. simplify the table by reducing badge noise and replacing the inter-section column with more useful contract state

## 9. One Ambiguity To Treat Carefully

The only remaining significant ambiguity is special-program duration:
- whether all `STE` / `SPA` / `SPS` subject rows should also be forced to `240`

Do not blindly encode that in the next pass without explicit evidence or a deliberate operator-confirmed decision.
