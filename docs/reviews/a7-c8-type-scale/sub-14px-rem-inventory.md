# A7 C8 — sub-14px arbitrary font-size inventory (production)

**Recorded:** 2026-09-29 · **Slice:** A7 C8 slice 1 (`d8abfd4c`) · **Owner of the fix:** A7 C8 **re-fit pass** (next slice)

Scanning rule: every `text-[<number><unit>]` arbitrary font size in
`atlas-client/src`, **excluding** `__tests__` and `*.test.*`, with JSX/JS comments
stripped first. A value is sub-14px when `rem × 16 < 14` or `px < 14`. Values at or
above the floor (`text-[0.875rem]` = 14px, `text-[14px]`, `text-[15px]`, `text-[22px]`)
are not listed — they are correct.

Reproduce with `npm run test:ux-type-scale-a7c8` (row **A7C8-6**), which fails if
this table and the code drift apart in either direction.

## Totals

| | |
|---|---|
| Sub-14px occurrences, all units | **264** |
| — of which `rem` | **255** |
| — of which `px` (`text-[13px]`, pre-existing) | **9** |
| Distinct `file \| value` keys | **89** |
| Distinct files | **57** |

**Base → candidate production total: `401 → 264`.** The 137 removed by this slice
were all px literals (`text-[9|10|11|12]px` → `text-xs`). Every one of the 264
listed below is **pre-existing on base `7c278d0d`**; this slice added none of them.

## Why this is a ratchet and not a red `main`

264 occurrences of real, user-visible sub-14px type are shipped today. Fixing them is
a separate, larger slice, and it is not a search-and-replace: several sit inside
**fixed-height boxes**, so a blind bump to `text-xs` clips them rather than fixing
them. That is why the gate records them as a dated, owner-tagged allowlist that fails
on growth, on a new value, **and on removal** — so each fix is a reviewable edit to
this file rather than a silent drift.

The px hard-fail on the 137 sites this slice fixed (**A7C8-1**) is *not* in that
allowlist and is unchanged by this correction.

## Per-value breakdown

| Value | px | Occurrences | Files (`count`) |
|---|---|---|---|
| `text-[0.5rem]` | 8 | 2 | `components/LockPanel.tsx` (2) |
| `text-[0.55rem]` | 8.8 | 5 | `components/ManualEditPanel.tsx` (5) |
| `text-[0.5625rem]` | 9 | 13 | `components/LockPanel.tsx` (4), `components/ManualEditPanel.tsx` (5), `components/dashboard/RoomSchedulePreview.tsx` (2), `components/PolicyImpactSummary.tsx` (1), `components/scheduling-policy/PolicyPanePrimitives.tsx` (1) |
| `text-[0.6rem]` | 9.6 | 7 | `components/faculty/FacultyRow.tsx` (3), `components/subjects/SubjectRow.tsx` (1), `components/subjects/ProgramScopeChips.tsx` (1), `components/subjects/SyncPreviewSheet.tsx` (1), `components/timetable/TeacherDepartureRecoverySheet.tsx` (1) |
| `text-[0.625rem]` | 10 | 53 | `components/LockPanel.tsx` (20), `components/ManualEditPanel.tsx` (9), `components/ExplainabilityDrawer.tsx` (6), `components/dashboard/RoomSchedulePreview.tsx` (4), `components/PolicyImpactSummary.tsx` (3), `components/ConflictInspectorSheet.tsx` (2), `components/SchedulingPolicyPane.tsx` (2), `components/scheduling-policy/PolicyPanePrimitives.tsx` (2), `components/dashboard/SetupChecklist.tsx` (1), `components/room-schedules/OccupancyTemplatePreview.tsx` (1), `components/TutorialOverlay.tsx` (1), `components/timetable/SimplePublishReadinessSheet.tsx` (1), `components/timetable/simple/SimpleTaskDrawerHelpers.tsx` (1) |
| `text-[0.64rem]` | 10.24 | 1 | `components/timetable/TeacherDepartureRecoverySheet.tsx` (1) |
| `text-[0.65rem]` | 10.4 | 34 | `components/faculty/FacultyRow.tsx` (6), `components/faculty/FacultyProfileSheet.tsx` (5), `components/ManualEditPanel.tsx` (4), `components/admin-workspace/AdminWorkspace.tsx` (3), `components/CampusMapEditor.tsx` (2), `components/subjects/SubjectMobileCard.tsx` (2), `components/subjects/SubjectRow.tsx` (2), `components/timetable/SimplePublishReadinessSheet.tsx` (2), `components/dashboard/NextActionPanel.tsx` (1), `components/smart/AccessibleInfo.tsx` (1), `components/subjects/SubjectMutationDetailPopover.tsx` (1), `components/subjects/SyncPreviewSheet.tsx` (1), `components/timetable/ScheduleReviewWorkspaceTaskModes.tsx` (1), `components/timetable/TacticalSandboxDock.parts.tsx` (1), `components/timetable/TimetableTaskDrawer.tsx` (1), `pages/SpecializationMapping.tsx` (1) |
| `text-[0.68rem]` | 10.88 | 10 | `components/timetable/TimetableTaskDrawer.tsx` (4), `components/audit/AuditFindingsPanel.tsx` (2), `components/timetable/ScheduleReviewWorkspaceHeader.tsx` (1), `components/timetable/TimetableStatusLegend.tsx` (1), `components/timetable/modals/ReviewActionSheet.tsx` (1), `components/timetable/modals/TimetablePlacementDialogs.tsx` (1) |
| `text-[0.6875rem]` | 11 | 94 | `components/BuildingPanel.tsx` (23), `components/LockPanel.tsx` (11), `components/sections/SectionDetailsSheet.tsx` (11), `components/SchedulingPolicyPane.tsx` (8), `components/ManualEditPanel.tsx` (6), `components/sections/SectionRow.tsx` (5), `components/campus-map/BuildingPlacementFields.tsx` (4), `components/scheduling-policy/SchedulingPolicyDialogs.tsx` (4), `components/scheduling-policy/ShiftSettingsEditor.tsx` (4), `components/campus-map/BuildingGradeScopeControl.tsx` (2), `components/ConflictInspectorSheet.tsx` (2), `components/dashboard/RoomSchedulePreview.tsx` (2), `components/scheduling-policy/PolicyPanePrimitives.tsx` (2), `components/scheduling-policy/PolicyPaneSchedulingMode.tsx` (2), `components/timetable/GeneratedRunRailPanels.tsx` (2), `components/timetable/simple/SimpleTaskDrawerHelpers.tsx` (2), `components/dashboard/LifecycleSummary.tsx` (1), `components/PolicyImpactSummary.tsx` (1), `components/scheduling-policy/PolicyPaneConstraintWeights.tsx` (1), `pages/HowItWorks.tsx` (1) |
| `text-[0.7rem]` | 11.2 | 25 | `components/faculty/FacultyProfileSheet.tsx` (7), `components/admin-workspace/AdminDataTable.tsx` (5), `components/faculty-assignments/AutoFillSummaryModal.tsx` (3), `components/subjects/SubjectRow.tsx` (3), `components/CampusMapEditor.tsx` (2), `components/sections/SectionDetailsSheet.tsx` (2), `components/subjects/SubjectFormModal.tsx` (1), `components/timetable/TimetableTaskDrawer.tsx` (1), `components/timetable/UnassignedInsertionWorkflow.tsx` (1) |
| `text-[0.72rem]` | 11.52 | 7 | `components/BuildingPanel.tsx` (5), `components/campus-map/BuildingGradeScopeControl.tsx` (1), `components/campus-map/BuildingPlacementFields.tsx` (1) |
| `text-[0.75rem]` | 12 | 2 | `components/CampusMapEditor.tsx` (1), `components/faculty-assignments/SubjectRow.tsx` (1) |
| `text-[0.8rem]` | 12.8 | 1 | `ui/button-variants.ts` (1) |
| `text-[0.8125rem]` | 13 | 1 | `components/BuildingPanel.tsx` (1) |
| `text-[13px]` | 13 | 9 | `components/faculty-dashboard/MobileDashboardLayout.tsx` (3), `components/faculty-dashboard/TeachingIdentityPanel.tsx` (3), `components/faculty-dashboard/ActionQueue.tsx` (1), `components/faculty-dashboard/FacultyObjectiveStateCard.tsx` (1), `components/faculty-shared/FacultyGlobalHeader.tsx` (1) |
| | | **264** | |

## Re-fit pass — what this scopes

The three pages the planner measured as still broken (`Sections`, `Subjects`,
`Teachers`; audit MAJOR 17/21/15) are driven by a small subset:

| Page | Dominant offenders |
|---|---|
| `Sections` | `components/sections/SectionDetailsSheet.tsx` (13), `components/sections/SectionRow.tsx` (5) — all `text-[0.6875rem]` / `text-[0.7rem]` |
| `Subjects` | `components/subjects/SubjectRow.tsx` (6), `SubjectMobileCard.tsx` (2), `SubjectMutationDetailPopover.tsx` (1), `ProgramScopeChips.tsx` (1), `SyncPreviewSheet.tsx` (2) |
| `Teachers` | `components/faculty/FacultyRow.tsx` (9), `FacultyProfileSheet.tsx` (12), `components/faculty-dashboard/*` (8), `components/faculty-shared/FacultyGlobalHeader.tsx` (1) |

Two hot spots deserve a deliberate decision rather than a bump, because a 10px face
becoming 14px is a 40% growth inside a fixed box:

- `components/LockPanel.tsx` — 37 occurrences, the densest file in the repo.
- `components/BuildingPanel.tsx` — 29 occurrences, several inside fixed-height rows.

For each, the re-fit pass must either give the row more height or accept the larger
face, and must carry rendered proof at 1366x768 (per `docs/plans/codex-walk-standard.md`).
Trimming the text to make a larger face fit is the wrong answer: the operator asked
for larger default text, not less of it.

## Rendered clip measurement (2026-09-29, A7 c8 planner, staging 1366x768)

Raising `--text-xs` to 14px while `--text-xs--line-height` stayed `1.25rem` (20px)
gave every single-line pill a 20px line box inside a smaller fixed box, and
`overflow-hidden` cut the glyphs. Representative rendered measurement, taken on
staging at 1366x768 at `font-size: 14px`:

| Box | `clientHeight` | `scrollHeight` | Verdict |
|---|---|---|---|
| `ui/badge-variants.ts` base class (`h-5 text-xs`, no `leading-*`) | 18 | 21 | ~3px internal clip |

Chips observed clipping through `<Badge>`: the role chip `Admin` (every page),
`Active Term: T1`, `Full coverage`, `Ready`, `Needs rooms`, `Live source`, `7 ready`.

**Fixed by this commit.** `ui/badge-variants.ts` base class gains `leading-none`.
Arithmetic: `h-5` = 20px border-box, minus `border` 1px x2, minus `py-0.5` 2px x2
leaves a 14px content box; `leading-none` makes the line box 14px, which fits
exactly. The pill stays 20px tall - it is not grown. This is the only `@/ui`
primitive that paired a fixed `h-4..h-6` box with `text-xs` + `overflow-hidden` and
no `leading-*`, so the one class corrects every `<Badge>` chip at once
(AGENTS.md §8, one look per control).

**Not fixed here - re-fit pass.** The pre-existing sub-14px `rem` population above.
Counting method: `Select-String` over `atlas-client/src/**/*.tsx` counting *lines*
matching `<Badge[^>]*text-\[0\.[0-9]+rem` = **45 lines across 17 files**
(323 `<Badge` element lines in total; a different method gave the planner's 266
usages, recorded rather than reconciled):

| Count | File |
|---|---|
| 9 | `components/BuildingPanel.tsx` |
| 7 | `components/LockPanel.tsx` |
| 6 | `components/sections/SectionDetailsSheet.tsx` |
| 5 | `components/ManualEditPanel.tsx` |
| 3 | `components/faculty/FacultyRow.tsx` |
| 2 | `components/subjects/SubjectMobileCard.tsx` |
| 2 | `components/subjects/SubjectRow.tsx` |
| 2 | `components/timetable/SimplePublishReadinessSheet.tsx` |
| 1 each | `components/timetable/TimetableStatusLegend.tsx`, `components/PolicyImpactSummary.tsx`, `components/SchedulingPolicyPane.tsx`, `components/room-schedules/OccupancyTemplatePreview.tsx`, `components/faculty/FacultyProfileSheet.tsx`, `components/dashboard/RoomSchedulePreview.tsx`, `components/timetable/TacticalSandboxDock.parts.tsx`, `components/timetable/simple/SimpleTaskDrawerHelpers.tsx`, `components/subjects/SyncPreviewSheet.tsx` |

`leading-none` removes the *inherited* 20px line box for these too, but their own
face is 10-11.2px in an `h-4` (16px) box whose content box is 10px, so a residual
sub-pixel clip remains. These clip on `main` too and belong to the re-fit pass,
not to this slice.

**Page-local pills, not `<Badge>`.** 5 lines pair a fixed `h-*` box with a
sub-14px `rem` face; 4 of the 5 already carry `leading-none`
(`components/faculty/FacultyRow.tsx:166,328`,
`components/subjects/ProgramScopeChips.tsx:62`,
`components/subjects/SubjectRow.tsx:188`) - the house pattern this fix adopts. The
fifth, `components/CampusMapEditor.tsx:609`, does not, and is the map room status
pill the planner saw clip. Fixed-height sub-14px **Buttons** are a separate
population (`components/LockPanel.tsx:444,447,450`,
`components/dashboard/RoomSchedulePreview.tsx:141,148`).

**Re-fit pass to-do, in order.** (1) Re-measure rendered `scrollHeight` vs
`clientHeight` per Part 2 page on staging at 1366x768 and record the per-page clip
count - this slice recorded static counts only, because the rendered per-page walk
belongs to the re-fit pass. (2) Decide box-vs-face for each `h-4` cluster above,
`h-4` = 16px cannot carry a 14px face with 1px borders and 2px padding. (3) Fix
`CampusMapEditor.tsx:609`. Do not raise the pill height where it breaks row rhythm;
give the row room instead.
