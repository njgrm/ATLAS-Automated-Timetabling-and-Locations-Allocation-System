# Teaching Load Year-9 Allocation Diagnostic

Status: `CORRECTION_REQUIRED`

## Live authority inspected

Read-only production-service probes against school 1 and the sole active,
non-archived EnrollPro mirror: year 9, `2030-2031`. The persisted workload
policy is 1,800 teaching minutes, 300 advisory-credit minutes, and a 2,400-minute
absolute hard cap. No Teaching Load row was changed.

## Finding 1: the displayed excess is real, but it is not an absolute-hard-cap breach

Seven faculty currently carry 2,250 teaching minutes (37.5 hours) each. That is
7.5 hours above the 30-hour teaching standard and their persisted individual
`maxHoursPerWeek=30`, while remaining below the school policy's 40-hour absolute
hard cap.

- ESP: Juan Miguel Cruz and Teresita Domingo
- FIL: Divina Escarez and Alfredo Marquez
- ENG: Corazon Ramirez and Jose Gabriel Santos
- MATH: Maria Angela Reyes

The UI must describe these consistently as above the teaching standard or
individual weekly maximum, not as exceeding the 40-hour absolute hard cap.

## Finding 2: qualified same-department capacity exists

Five active ESP/FIL teachers have zero teaching minutes and are correctly
resolved as mapped department members:

- FIL: Carlo Miguel Aguilar, Carlo Miguel Castillo, Nathaniel Jose De Leon
- ESP: Miguel Andre Salazar, Vincent Lorenzo Santos

The production over-cap rebalance preview sees them. Its zero-write year-9
preview proposes 14 exact section moves in total, including four ESP moves to
Salazar/Santos and four FIL moves to Aguilar/Castillo/De Leon. The preview would
reduce each of the seven 37.5-hour teachers by two 225-minute sections.

Therefore this is not an EnrollPro roster gap, department-label gap, or faculty
qualification failure.

## Finding 3: Suggested Teaching Load uses the wrong job boundary

`createTeachingLoadSuggestionProposal()` delegates to `autoFill()`. `autoFill()`
builds work only for subject-section pairs without an owner, preserves every
existing owner as `KEPT_EXISTING`, and merely emits text warnings for existing
overloads. With 265/265 pairs already owned, the live preview returns:

- preserved: 265
- new suggestions: 0
- unresolved: 0
- seven overload warnings
- no receiver assignment, despite available qualified faculty

The separate `previewOrApplyOverCapRebalance()` path can find receivers, but the
Teaching Load page does not invoke it; its repair action only filters/selects
the overloaded teacher for manual editing. This split explains the observed
behavior.

## Finding 4: TL-UX-C01 currently makes a false success claim

Candidate `1f867eb82124c181c79cfcb9cf5227c4577efad3` renders “Suggested Teaching
Load covers all rows” and “everyone is within their workload capacity” whenever
there are no uncovered pairs. That condition ignores the same result's overload
warnings. The candidate also explicitly deferred the prompt-required
adviser-section suggestion preference.

## Required correction

Keep one user-facing suggestion workflow. Its preview must distinguish coverage
from balance, include exact reallocation proposals for existing excess when
qualified capacity exists, apply the approved combined plan atomically, and
implement the bounded adviser-section ranking preference. The dedicated legacy
rebalance route may remain a protected compatibility/recovery surface, but it
must not be a competing daily UI authority.
