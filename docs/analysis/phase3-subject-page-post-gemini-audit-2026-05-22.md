# Phase 3 Subject Page Post-Gemini Audit

Date: 2026-05-22

## Purpose

Audit the current `Subjects` page after the Gemini-led overhaul and determine:
- what genuinely improved
- what remains functionally wrong
- what still creates scheduler friction
- what must be fixed in the next one-shot pass before this page can be considered trustworthy

This audit is based on:
- `docs/verification/evidence-log.md`
- direct code inspection of the current worktree
- the stakeholder schedule files already analyzed
- the current subject-page workflow expectations established in previous Phase 3 audits

## Verdict

The Gemini pass improved visual structure, but the page is still **not ready for closure**.

The improvements are real:
- table density is better than the earlier badge-stacking version
- row rendering was split out into `SubjectRow.tsx`
- teacher coverage moved into a side sheet, which is cleaner than inline expansion
- destructive cleanup tooling now exists in the page

But the remaining issues are significant:
- there are still real contract bugs
- several interactions are touch-hostile or hidden
- the form violates project UI rules in multiple places
- some of the ownership/contract information is still not visible enough to be operator-trustworthy
- live runtime verification is currently blocked because `/api/v1/subjects` is failing with a Prisma datasource error on Tailnet

## 1. What Improved

### 1.1 Better information hierarchy

The table is less chaotic than the pre-Gemini version.

Good changes:
- `Subject & Code` merged into one identity column
- scope and owner are grouped more compactly
- teacher coverage moved to a sheet instead of inline row expansion

### 1.2 Better destructive tooling exists

The implementation now includes:
- subject archive action
- blocker-aware delete flow
- subject-scoped reset support
- global reset support

This is directionally correct and matches the scheduler-repair workflow better than before.

### 1.3 Subject-focused teaching-load deep linking exists

`FacultyAssignments.tsx` now reads `?subjectId=...`, so the remediation flow is conceptually present.

That is a real improvement.

## 2. High-Severity Functional Problems

### 2.1 Teacher coverage and assignment actions are hardcoded to `schoolYearId = 1`

This is a real bug in the current `Subjects.tsx`.

Observed in:
- `fetchTeacherCoverage`
- `handleAssignTeacher`
- `/faculty-assignments/summary` fetch for coverage

Impact:
- the page can assign or inspect coverage against the wrong school year
- the remediation loop is not reliable for the active year
- scheduler trust is broken if the row-level subject state is current but the coverage sheet is pointed at stale year data

This is one of the most important remaining bugs.

### 2.2 Live `/subjects` verification is currently broken

The latest evidence entry is only a **local GO**.

Current live Tailnet verification is blocked because `/api/v1/subjects?schoolId=1` is returning a Prisma datasource failure (`P6001`) instead of subject data.

Impact:
- current subject-page claims are not live-verified
- no honest Tailnet GO can be issued until the runtime datasource issue is fixed

### 2.3 Ownership contract is persisted, but not fully operator-legible

The evidence log is correct that ownership fields now persist in `Subject`.

However, the current UI still does not expose the full contract clearly enough.

Examples:
- `outputLabel` is passed around in page state but not meaningfully surfaced in the form
- `rotationFamily` is present in state but not clearly editable/inspectable in the current modal
- the “Persisted Offerings Contract” callout is informative but still incomplete as a real operator contract panel

Conclusion:
- backend persistence improved
- frontend contract transparency still lags

## 3. UX/UI Problems Still Open

### 3.1 Actions are too hidden for touch and keyboard users

`SubjectRow.tsx` still hides the action cluster behind:
- `opacity-0 group-hover:opacity-100`

That is bad for:
- touch screens
- tablet schedulers
- keyboard discoverability

The row should always expose at least one visible action affordance, typically the overflow trigger.

The same issue exists in the teacher coverage sheet:
- assign button appears only on hover inside eligible rows

That is not acceptable for mobile-responsive scheduling workflows.

### 3.2 Raw HTML buttons were reintroduced

This directly violates the project UI rules.

Observed in `SubjectFormModal.tsx`:
- time-mode switch buttons
- grade-level chip buttons
- program-scope chip buttons
- inter-section grade buttons
- feature-remove button inside requirement badges

Observed in `SubjectRow.tsx`:
- specialization count button

These should be rebuilt using project primitives instead of raw buttons.

### 3.3 “Archived” is still overloaded and unclear

Inactive rows are labeled `Archived`, but the page still does not provide a proper archive management mode.

Current state:
- status filter uses `inactive -> Archived`
- row badge uses `Archived`
- archive action exists
- but there is still no clear archive workflow surface

This is better than before, but still semantically muddy for operators.

### 3.4 Reset Load is placed too close to everyday toolbar actions

`Reset Load` is now available, which is good.

But its placement in the top primary toolbar, next to sync and add, is too casual for a destructive admin repair action.

This should likely move into:
- an “Advanced tools” overflow
- or a dedicated repair panel/sheet

### 3.5 Pagination summary is wrong

The current footer says:
- `Showing {Math.min(totalFiltered, pageSize)} of {totalFiltered} results`

That is wrong on later pages because it does not reflect:
- start offset
- current visible range

This is a smaller bug, but it contributes to operator confusion during large-list review.

## 4. Subject-Specific Workflow Problems

### 4.1 SPA/SPS specialization visibility is still too thin

The new row-level “N specs” link is better than nothing, but it is still too compressed for the workflow we now understand.

The scheduler needs:
- clear inspection of which enabled specializations are active from EnrollPro
- visibility without having to infer from a count alone
- stronger distinction between:
  - subject output label
  - qualification baseline
  - specialization set being sourced upstream

### 4.2 TLE family remains technically cleaner but still cognitively noisy

The page does have a `Show System` toggle, which helps.

But the scheduler-facing story is still not quite resolved:
- `TLE` family abstraction exists
- exploratory TLE members still exist underneath
- system-managed visibility is optional rather than being more strongly framed as an internal breakdown

This is improved, but still not fully “easy by default.”

### 4.3 Delete/remediation is improved but still not fully finished

The code now supports:
- archive
- active assignment cleanup
- historical cleanup
- full cleanup
- global reset

But the audit concern remains:
- the scheduler still needs a clearer, more guided blocker resolution experience
- the remediation decision tree is still too implicit
- “what should I click next?” is still not obvious enough

## 5. Alignment With Stakeholder Reality

### 5.1 Special-program slot length conclusion still holds

The stakeholder PDFs support:
- specialization and research blocks using the same visible slot lengths as regular subjects

They still do **not** prove:
- every internal special-program canonical row should be forced to `240` weekly minutes

So the current cautious duration stance remains correct.

### 5.2 Department-based qualification remains the right simplification direction

Nothing in the Gemini pass changes the strategic conclusion:
- the scheduler should not have to manage specialization mapping as a primary setup page
- department ownership should remain the main baseline
- subject-specific manual placement and teaching-load authority should remain possible where stakeholders require it

## 6. What The Next Pass Must Fix

The next one-shot should focus on:
- fixing `schoolYearId` hardcoding in all coverage/remediation calls
- repairing live `/subjects` runtime verification blocker if it is caused by this pass
- making row actions touch-visible and always discoverable
- replacing raw HTML button clusters with approved primitives
- improving ownership contract visibility in the form
- making specialization inspection stronger and more explicit
- moving destructive reset actions into a safer advanced-tools interaction
- correcting pagination range math
- tightening the delete/remediation UX so the scheduler always knows the next safe action

## Final Decision

The Gemini pass is a **partial UX improvement**, not a closure pass.

Use it as the new baseline, but do not treat the page as production-ready for scheduler workflow yet.
