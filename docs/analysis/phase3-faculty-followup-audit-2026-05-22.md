# Phase 3 Faculty Follow-Up Audit - 2026-05-22

## Purpose

This audit reviews the current `Faculty` page after the first modernization pass and the first narrow blocker follow-up.

It focuses on:

- data accuracy
- drawer completeness
- navigation targeting
- filter ergonomics
- pagination UX
- remaining scheduler-facing confusion

This is a code-and-contract audit of the current repo state.
It is not a full live Tailnet browser QA pass.

## Executive Verdict

- The page is visually improved and materially better than the legacy version.
- The remaining problems are no longer about broad modernization.
- They are now about truthfulness, workflow continuity, and secondary UX friction.

The page is still **not closure-grade**.

## Confirmed User Concerns

### 1. Subject drawer still does not show section ownership detail

Confirmed.

In [FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:177), the drawer only lists:
- subject name
- subject code
- weekly minutes
- grade badges

It does **not** show the actual sections under each subject that the teacher manages from Teaching Load.

This is a real gap because the page currently claims to help with quick faculty inspection, but it still hides the most practical assignment detail.

### 2. Latest published teacher schedule is not surfaced

Confirmed.

There is no published-schedule preview or drilldown in the current faculty drawer.

If a latest published run is available, the drawer currently gives no visibility into:
- the teacher's latest published schedule
- whether a schedule is available at all
- where to inspect it quickly

This is a valid next-step improvement.

### 3. Weekly Hours on Faculty is structurally inaccurate

Confirmed.

The `Faculty` page still computes "weekly load" locally from `faculty.facultySubjects` only:
- [FacultyRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyRow.tsx:29)
- [FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:40)
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:151)

That logic uses subject minutes and grade counts only.

It does **not** include:
- advisory equivalent hours
- ancillary hours
- policy credited hours

But the `Teaching Load` page already uses policy-aligned values from the summary contract:
- [faculty-assignment.service.ts](/d:/ATLAS/atlas-server/src/services/faculty-assignment.service.ts:887)
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1060)

So your Aquino example is explained by a real contract split:
- `Faculty` = raw local calculation
- `Teaching Load` = policy-credited calculation

This is not acceptable long-term if `Faculty` is supposed to show the current scheduler-truthful workload.

### 4. `Manage Teaching Load` does not reliably retarget the selected teacher

Confirmed.

`FacultyAssignments` reads `facultyId` from search params only in the initial `useState` initializer:
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:144)

There is no follow-up effect that re-syncs `selectedId` from `searchParams` after navigation changes.

The page does react to `subjectId`, but not to later `facultyId` URL changes:
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:223)

So if the page is already mounted, navigating from `Faculty` can leave the old teacher selected.

### 5. Advisory classes are not surfaced in Faculty table or drawer

Confirmed.

The faculty drawer and row do not show:
- adviser status in a meaningful way
- advised section metadata
- advisory credited hours

Yet those are already available elsewhere in the system and directly affect load truth.

This omission also contributes to the false impression that the faculty page load is lower than the Teaching Load page.

### 6. Filter expansion steals vertical space from the table

Confirmed.

In [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:235), the filters expand into a second row below the main header controls.

This makes the page feel heavier and reduces table height when filters are open.

Your concern is valid.

This is not strictly wrong, but it is a weaker interaction than keeping controls on the primary line or using a more compact inline disclosure pattern.

### 7. Faculty pagination is weak and inconsistent

Confirmed.

The Faculty page currently uses:
- only previous/next
- a page count display
- page sizes capped at `50`

Worse, it uses rotated `ArrowUpDown` icons for pagination:
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:422)
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:436)

That is visually weaker than the clearer chevron approach already used on `Subjects`.

Also confirmed:
- no first/last page jump
- no manual page entry or direct page picker
- inconsistent pagination pattern between `Faculty` and `Subjects`

### 8. The three-dot menu is redundant

Confirmed.

In [FacultyRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyRow.tsx:139), the overflow menu mostly repeats exposed actions:
- `Manage Teaching Load`
- `View Full Profile`

And the extra `View in EnrollPro` action is disabled and non-functional.

This is unnecessary noise on a page that is supposed to be calmer.

### 9. `Active for scheduling` is questionable on this page

Partly confirmed.

The column is still present:
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:332)
- [FacultyRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyRow.tsx:95)

Your product concern is valid:
- if schedulers do not control this state here
- and stale/inactive retention is not part of the intended workflow

then this may not deserve top-level table-column prominence.

At minimum, it likely should be demoted rather than removed blindly.

### 10. `Close Profile` styling is too weak

Confirmed.

In [FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:215), the `outline` button with muted text reads visually close to a disabled action at a glance, especially compared with the strong primary CTA above it.

This is a real perception issue.

## Additional Findings

### 1. `Faculty` is still using the wrong source for load truth

This is the biggest remaining product issue.

The page still fetches `/faculty`, not `/faculty-assignments/summary`.

That means:
- it cannot show policy-credited load accurately
- it cannot show actual/credited/advisory split accurately
- it cannot reflect the same truth model as Teaching Load

If the page is meant to show real current workload, it likely needs either:
- richer `/faculty` payloads, or
- a lightweight summary payload reuse

### 2. Faculty profile content is still grade-focused, not section-focused

The drawer shows grade badges but not actual sections under each assignment.

That is backwards for scheduler inspection.

The teacher's concrete section ownership is higher-value than just the grade list.

### 3. The page still contains too much micro-text

Even after modernization, there is still repeated use of:
- `text-[0.625rem]`
- `text-[0.65rem]`
- `text-[0.7rem]`

This is improved from earlier states but still not ideal.

### 4. Faculty and Subjects pagination should converge

`Subjects` still has its own pagination issues too, including lingering mojibake in the display string.

The two pages should use one stronger pagination pattern instead of drifting separately.

## Best-Practice Direction For Pagination

For pages like `Faculty` and `Subjects`, the better UX direction is:

- keep a reasonable page-size selector
- support larger sizes than `50` where the dataset justifies it
- add first/last page navigation
- add direct page jump or compact page-picker for multi-page datasets
- use explicit chevrons, not rotated sort icons
- keep the pagination pattern shared across list pages

Recommended page-size options:
- `25`
- `50`
- `100`

For a dataset like `146` faculty, `50` as the top option is unnecessarily low.

## Priority Ranking

### P0
- unify Faculty load truth with Teaching Load policy-credited data
- show actual sections under each assigned subject in the profile drawer
- fix `facultyId` retargeting when navigating into Teaching Load

### P1
- add advisory visibility in the Faculty row/drawer
- remove redundant overflow menu and dead EnrollPro action
- improve filter layout so expanded filters do not steal as much workspace height
- upgrade pagination controls and standardize them with Subjects

### P2
- decide whether the scheduling-status column should remain a full table column or become secondary metadata
- polish the profile drawer secondary action styling

## Final Conclusion

The remaining `Faculty` issues are real and mostly workflow-truth issues, not visual polish issues.

The next pass should not be another generic modernization prompt.
It should be a precise follow-up for:
- load accuracy
- assignment detail completeness
- teacher-targeting continuity
- pagination and filter ergonomics
- removal of redundant controls
