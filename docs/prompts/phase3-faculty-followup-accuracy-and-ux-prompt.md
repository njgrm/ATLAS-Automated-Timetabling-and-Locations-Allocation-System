# Gemini Execution Prompt: Phase 3 Faculty Follow-Up Accuracy And UX

## Objective

Close the remaining `Faculty` page issues after the modernization and narrow blocker fixes.

This pass is about:

- load truthfulness
- assignment detail completeness
- teacher-targeting continuity
- pagination and filter ergonomics
- removal of remaining redundant controls
- scheduler-friendly naming and copy cleanup
- route and label alignment from `Faculty` / `Assignments` toward `Teachers` / `Teaching Load`

Do not treat this as a fresh redesign.
This is a targeted follow-up.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`
- `docs/analysis/phase3-faculty-followup-audit-2026-05-22.md`

Inspect directly:
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/routes/faculty.router.ts`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Subjects.tsx`

## Context7 Preflight Summary

Before importing or changing UI primitives or any pagination/control pattern:
- inspect local repo usage first
- use Context7 if import paths or version-sensitive UI behavior are unclear
- do not guess component APIs from memory

Record in your final output:
1. whether Context7 was needed
2. what it confirmed
3. which local pattern you reused

## Facts To Treat As Settled

- The `Faculty` page should remain roster-first.
- `Teaching Load` remains the authoritative assignment-editing page.
- The current Faculty load display is structurally inaccurate because it derives from raw `facultySubjects` minutes instead of the policy-credited summary logic already used in Teaching Load.
- The profile drawer still does not show the actual sections under each assigned subject.
- Navigating from `Faculty` to `Teaching Load` does not reliably retarget the selected teacher because `facultyId` is only read from the URL on initial mount.
- Advisory information matters and should be surfaced if available because it materially affects credited load.
- The overflow menu is currently redundant.
- The disabled `View in EnrollPro` menu action should not remain.
- Pagination and filter behavior on `Faculty` is still weaker than it should be and currently drifts from `Subjects`.
- The page should move toward user-facing `Teachers` language, not `Faculty`, where the surface is explicitly scheduler-facing.
- The route and navigation language should move away from vague `assignments` wording toward `teaching-load`.
- Operator-facing copy should prefer full words, not shorthand like `Dept` or `Info`.
- `GR7`, `GR8`, `GR9`, and `GR10` are now the preferred grade labels in UI text and badges.

## Scope

### In Scope

#### A. Make Faculty load truthful

The Faculty page must stop showing a weaker workload model than Teaching Load.

Required direction:
- use data that reflects policy-credited load, not just raw subject-minute totals
- ensure the value shown in Faculty is intentionally aligned with the scheduler-truth model
- make it clear whether the page is showing actual, credited, or both

Do not leave the page with a misleading lower number when the system already knows the real credited load.

#### B. Show concrete assignment detail in the profile drawer

For each assigned subject in the profile drawer, show the actual sections the teacher manages.

This should be explicit and easy to scan.
Grade-only visibility is not enough.

If latest published schedule data is already available through a safe existing path, add read-only visibility or a clear entrypoint for that too.
If it is not ready, say so explicitly in the final output and do not fake it.

#### C. Fix teacher targeting into Teaching Load

When navigating from `Faculty` into `Teaching Load`, the selected teacher must reliably update to the requested `facultyId` even when the page is already mounted.

#### D. Surface advisory information

Show advisory-relevant info in a way that helps explain credited load.

At minimum, reassess:
- adviser status
- advised section if available
- advisory credit visibility in the drawer and/or table

#### E. Improve filter ergonomics

The current expanded filter row takes too much vertical space from the table.

Rework the interaction so filters feel lighter and less disruptive.

Keep the header calm and do not create an awkward multi-row workspace penalty for simply opening filters.
Prefer keeping search, primary actions, and lightweight filters on the same horizontal plane where feasible.

#### F. Upgrade pagination

Improve Faculty pagination and bring it closer to a better shared list-page pattern.

Required direction:
- replace the rotated sort arrows used as pagination controls
- support first/last navigation
- support stronger page-size choices than the current low ceiling
- make it easier to jump across pages

Also inspect the current `Subjects` pagination pattern and align direction where appropriate.

Required direction for UX:
- stop relying on weak previous/next-only paging
- support first/last navigation
- support direct page selection or similarly strong jump behavior
- increase page-size choices beyond the current low ceiling where it materially helps scan larger rosters

#### G. Rename and simplify scheduler-facing language

Required cleanup:
- rename the scheduler-facing page title, breadcrumb, and sidebar label from `Faculty` to `Teachers`
- rename the relevant frontend route and navigation wording from `assignments` to `teaching-load`
- use full words in copy:
  - `Identity & Department`, not `Identity & Dept`
  - `Contact Information`, not `Contact Info`
- use `GR7`, `GR8`, `GR9`, and `GR10` consistently in visible UI text and badges

Database and backend model names do not need to change just because UI naming changes.

#### H. Remove redundant actions and reassess low-value columns

Required cleanup:
- remove the redundant three-dot menu if it adds no real value
- remove the dead EnrollPro action
- reassess whether the `Active for scheduling` column deserves full column prominence on this page
- improve the `Close Profile` action styling so it does not look disabled at a glance

#### I. Improve drawer readability and detail quality

Required direction:
- make identity text visibly larger and easier to scan; do not compress important IDs or labels into tiny text
- surface concrete section ownership under each assigned subject
- if published teacher schedule detail is already safely available through an existing path, expose it read-only in the drawer or through a clear secondary view without closing the drawer
- remove assignment-authoring actions from this drawer; it should remain inspection-first

### Out Of Scope

Do not:
- redesign Teaching Load in this prompt
- rewrite the whole Faculty page layout again
- change unrelated shell/sidebar IA
- fake schedule-preview functionality if the current data path is not truly ready

## UX Requirements

- Keep `Faculty` roster-first.
- Keep the page calm even if the visible label becomes `Teachers`.
- Do not add noisy controls back into the page.
- Maintain the no-scroll architecture.
- Use shared UI primitives only.
- Prefer explicit truthful labels over technically incomplete simplifications.
- If showing credited load, label it clearly.
- Do not use shorthand labels where full words fit comfortably.
- Do not use micro-text for primary identity information.

## Implementation Steps

1. Audit the exact data source mismatch between Faculty and Teaching Load.
2. Refactor Faculty load display so it uses the right truth model.
3. Add concrete section detail to the profile drawer.
4. If available, expose published teacher schedule detail through the drawer without turning it into an editing surface.
5. Fix `facultyId` retargeting in Teaching Load.
6. Add advisory visibility where it helps explain load.
7. Rework filter expansion behavior.
8. Upgrade pagination and remove the rotated-arrow pattern.
9. Apply scheduler-facing naming cleanup for `Teachers`, `Teaching Load`, full words, and `GR7`-style grade labels.
10. Remove redundant overflow/dead actions and polish low-confidence controls.
11. Run verification.

## Verification Gates

Required:
- client build
- direct code verification that Faculty load now reflects the intended credited or clearly labeled load source
- direct verification that assignment sections are visible in the drawer
- direct verification that identity text and core labels are not reduced to micro-text
- direct verification that changing `facultyId` in the route updates the selected teacher in Teaching Load
- direct verification that pagination no longer uses rotated sort arrows
- direct verification that scheduler-facing labels use `Teachers`, `Teaching Load`, and `GR7`/`GR8`/`GR9`/`GR10` where changed
- direct verification that redundant overflow items are removed

If a live check is available, verify:
- a faculty row with meaningful load
- profile drawer assignment detail
- navigation into Teaching Load for a non-default teacher
- visible copy clarity for page title, breadcrumb, and drawer sections

## Required Output

Return:
1. before-state issues fixed
2. files changed
3. final Faculty load-truth model used
4. assignment-detail additions made to the drawer
5. teacher-targeting fix made for Teaching Load
6. advisory visibility changes made
7. naming and route changes made
8. filter and pagination improvements made
9. redundant action/column decisions made
10. verification results
11. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- Faculty no longer shows misleadingly low load relative to Teaching Load
- the drawer shows actual sections under assigned subjects
- navigation to Teaching Load reliably selects the intended teacher
- page and route naming are materially clearer for schedulers
- pagination is materially improved and no longer uses rotated sort arrows
- dead or redundant actions are removed
- advisory information is visible enough to explain load better

If not, return `NO-GO` with the exact remaining blocker.
