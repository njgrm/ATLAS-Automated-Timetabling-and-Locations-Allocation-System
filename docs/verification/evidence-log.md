# 2026-05-27 - Phase 3 Teaching Load Closure Read/Write, STE Contract, And MAPEH Redistribution
- Phase: Phase 3 generator-readiness stream, teaching-load closure pass
- Operator: GitHub Copilot
- Scope gate: PARTIAL (live backend/data closure reached; Tailnet browser shell still serves an older frontend bundle)
- Safety gate: PASS (service-layer redistribution patch preserved section specialization truth; live apply executed only after preview showed 16 moves and 0 blockers)
- Files changed in this pass:
  - atlas-client/src/hooks/useTeachingLoadData.ts
  - atlas-server/src/services/faculty-assignment.service.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Teaching Load writability evidence now accepts section-first assigned-classes data, so cached ATLAS-owned section evidence can unlock safe writes instead of forcing a false read-only state.
  2. SPA/SPS redistribution now allows baseline MAPEH generalists to receive special-program rows without requiring fabricated capability overrides.
  3. Special-program redistribution now preserves the section's stored specialization metadata (`specializationCode` / `specializationLabel`) when ownership moves, so breakout truth is not rewritten to the destination teacher profile.

- Verification:
  - npm --prefix atlas-client run build -> PASS
  - npm --prefix atlas-server run build -> PASS
  - Tailnet GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55 -> active eligible MAPEH at 0 load before apply = 6 (`ILAGAN, WENDY`, `MACALINTAL, VICTOR`, `NAVARRO, ZACARIAS`, `QUINTO, YOLANDA`, `TUASON, XAVIER`, `YAMBAO, ALICIA`)
  - Tailnet POST /api/v1/faculty-assignments/coverage/rebalance-special-programs (preview) -> 16 proposed moves, 0 blocked subjects
  - Tailnet POST /api/v1/faculty-assignments/coverage/rebalance-special-programs (apply) -> appliedMoves = 16
  - Tailnet GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55 after apply -> active eligible MAPEH at 0 load = 0
  - Tailnet GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55&includeDiagnostics=true after apply -> SPA owner breadth = 8, SPS owner breadth = 8
  - Tailnet GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55&includeDiagnostics=true after apply -> STE samples (`SIRIUS`, `VEGA`, `ARCTURUS`) stayed at assigned=12, rotation=3, unassigned=0
  - Tailnet browser check after storage/service-worker reset -> still renders `READ-ONLY` in `/teaching-load`, indicating the Tailnet frontend shell is older than the workspace client code even though the live backend/API state reflects this pass
  - Local browser check against http://localhost:5174/login -> sign-in currently returns 500, so fresh local UI validation is blocked by a separate runtime issue

- Verdict: NO-GO for full frontend closure, GO for backend/data closure. Remaining blocker is environmental deployment/runtime drift in the served frontend shell, not the Teaching Load service logic.

# 2026-05-27 - Phase 3 Teaching Load Refactor Stabilization and Regression Closure
- Phase: Phase 3 generator-readiness stream, teaching-load stabilization
- Operator: Gemini CLI
- Scope gate: PASS (Rotation truth restored; Global reset re-exposed; Coverage mode functional; Language humanized; Runtime hardened)
- Safety gate: PASS (No changes to backend data or staffing logic; restricted to frontend stability and UX alignment)
- Files changed in this pass:
  - `atlas-client/src/lib/faculty-assignment-helpers.ts`
  - `atlas-client/src/hooks/useTeachingLoadUI.ts`
  - `atlas-client/src/hooks/useTeachingLoadData.ts`
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`
  - `atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx`
  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
  - `docs/verification/evidence-log.md`

- Stabilization delivered:
  1. **Restored Rotational Truth**: Fixed the regression where term-bucket data was flattened. The authoritative `loadProfile` now correctly wires per-term detail to the rotation sheet.
  2. **Re-exposed Global Reset**: Added a new "Settings" dropdown to the workspace toolbar, restoring the discoverable entrypoint for Year-55 maintenance and global resetting.
  3. **Restored Coverage Mode Control**: Re-enabled the operator-facing staffing mode selector (Standard vs Hard Cap vs Hybrid) within the settings menu.
  4. **Reduced Render Pressure**: Implemented row-local map filtering in `AssignmentWorkspace`. Each `SubjectRow` now receives only its relevant subset of ownership/conflict data, significantly improving performance.
  5. **Humanized Terminology**: Replaced technical phrases like "Repair pending" and "Integrity sync" with professional scheduler language like "Assignments temporarily locked while data review finishes."
  6. **Hardened Runtime Stability**: Applied defensive null-checks to `Object.entries` calls in `WorkspaceToolbar` and `AssignmentWorkspace` to prevent runtime crashes during transient data states.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Data check: Verified rotational detail sheet now correctly displays Term 1/2/3 values for Science teachers.
  - Interaction check: Verified the Global Reset button triggers the real confirmation modal.
  - Stability check: Confirmed the "Cannot convert undefined to object" error is resolved by the new defensive logic.

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load Major Frontend Refactor and Workflow Clarity
... rest of file ...
`r`n## 2026-05-27: Teaching Load Dual-Mode Grid and Inspector Refactor`r`n- **Scope**: Frontend UX refactor of Teaching Load page.`r`n- **Files Changed**: `r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n- **Components**: `r`n  - `By Teacher` mode: `TeacherGridMode``r`n  - `By Section / Shortage` mode: `SectionGridMode``r`n  - Inspector: `WorkloadInspector` (Persistent right-hand drawer)`r`n- **Removal UX**: Preserved inline removal in `SubjectRow` (accessible via `TeacherGridMode`).`r`n- **Tooltips**: Replaced raw `title` usage in `WorkspaceToolbar` with proper `Tooltip` primitives.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
`r`n## 2026-05-27: Teaching Load Usability and Semantics Correction`r`n- **Scope**: Usability refinement of the recently refactored Teaching Load table.`r`n- **Files Changed**: `r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx``r`n- **Discovery Controls**: Restored search, department filter, and status filter in `By Teacher` mode.`r`n- **Outside Dept**: Cross-department subjects are now hidden by default and accessible via a toggle.`r`n- **Semantics**: Renamed `By Section / Shortage` to `Section Allocation` for honesty. Added \"Unassigned Only\" filter.`r`n- **Allocation UX**: Clicking a candidate in section mode now performs a real assignment action. Removed aggressive hover mutation.`r`n- **Scrolling**: Reduced inline padding and spacing to ease vertical scroll pressure.`r`n- **Tooltips**: Replaced remaining raw `title` attributes with proper `Tooltip` primitives.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
`r`n## 2026-05-27: Teaching Load Coverage and Burndown UX Correction`r`n- **Scope**: Semantic and interaction correction of the Teaching Load page.`r`n- **Files Changed**: `r`n  - `atlas-client/src/hooks/useTeachingLoadData.ts``r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx``r`n  - `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx` (New)`r`n- **Coverage Alignment**: `Section Allocation` now only shows rows matching the headline coverage contract. Non-coverage demand is hidden.`r`n- **Burn-down UX**: `Section Allocation` is now section-first. Sections expand to show subjects. Completion is signaled via green icons/states.`r`n- **Writable Behavior**: Read-only gating relaxed. Writes allowed whenever verified school year is active and backend is reachable.`r`n- **Staffing Audit**: Restored the real report sheet. Wired both \"Staffing Audit\" and \"Review Needed\" buttons to open it.`r`n- **Sticky Actions**: Teacher-row action strips are now sticky within their expanded block scope.`r`n- **Metrics**: Replaced \"Classes\" with separate \"Subjects\" and \"Sections\" counts in teacher rows.`r`n- **Load Colors**: `> 30h` is warning (amber), `> 40h` is danger (red).`r`n- **Session Cards**: Enforced uniform 3-column left-aligned grid for session cards.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
# 2026-05-27 - Phase 3 SPA/SPS Breakout Dissemination And Homeroom Model Repair
- Phase: Phase 3 generator-readiness stream, SPA/SPS breakout dissemination
- Operator: GitHub Copilot
- Scope gate: PASS (SPA/SPS breakout lanes exposed; MAPEH normalized as default staffing pool; approval-gated special-program queue removed from live split-brain and teaching-load surfaces; homeroom-centric model preserved)
- Safety gate: PASS (Changes stayed within subject ownership normalization, teaching-load semantics, split-brain counters, UI copy, and runtime/docs evidence)
- Files changed in this pass:
  - atlas-server/src/services/subject-ownership.service.ts
  - atlas-server/src/services/subject.service.ts
  - atlas-server/src/services/faculty-assignment.service.ts
  - atlas-server/src/services/teaching-load-automation.service.ts
  - atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
  - atlas-client/src/components/faculty-assignments/OverviewHeader.tsx
  - atlas-client/src/pages/FacultyAssignments.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - ATLAS-PUBLIC-API.md
  - api/ATLAS-PUBLIC-API.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. MAPEH Normalization: SPA/SPS specialization ownership now normalizes to MAPEH in both resolver logic and subject-contract backfill.
  2. Approval Queue Removal: The split-brain reconcile path no longer emits SPECIAL_PROGRAM_APPROVAL_REQUIRED or a non-zero special-program approval candidate queue for normal MAPEH staffing.
  3. Teaching Load Cleanup: Special-program approval copy was removed from teaching-load summary UI surfaces so the old gating model no longer appears in operator warnings.
  4. Track Exposure Preserved: POST /api/v1/subjects/sync-offerings still exposes active SPA/SPS specialization tracks from persisted specialization ownership truth.
  5. Downstream Clarity: Public API docs now call out explicit breakout lane fields on published entries.

- Verification:
  - npm --prefix atlas-server run build -> PASS
  - npm --prefix atlas-client run build -> PASS
  - npm --prefix atlas-server run test:phase4-review -> PASS (23/23)
  - npm --prefix atlas-server run test:faculty-assignment-pass5 -> PASS (48/48)
  - Tailnet POST /api/v1/subjects/sync-offerings -> 200 with active SPA/SPS tracks exposed individually
  - Tailnet POST /api/v1/faculty-assignments/integrity/reconcile-split-brain -> specialProgramApprovalCandidates=0, reasonCodes excluded SPECIAL_PROGRAM_APPROVAL_REQUIRED
  - Tailnet GET /api/v1/subjects?schoolId=1 -> SPA_SPEC.ownerDepartment=MAPEH, SPS_SPEC.ownerDepartment=MAPEH
  - Teaching-load browser check -> visible text no longer contains approval-gate wording or special-program approval queue language

- Verdict: GO
 
## 2026-05-27 - Phase 3 Teaching Load Grade Scope and Section Allocation Workflow Fix

- **Scope**: Repair Teaching Load refactor for honest By Teacher and Section Allocation workflows.
- **Files Changed**:
  - atlas-client/src/pages/TeachingLoad.tsx
  - atlas-client/src/hooks/useTeachingLoadData.ts
  - atlas-client/src/hooks/useTeachingLoadUI.ts
  - atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
  - atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx
  - atlas-client/src/components/faculty-assignments/SubjectRow.tsx
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx (New)
- **Verified Outcomes**:
  - [x] Grade-level subject scope enforced (STE subjects no longer leak).
  - [x] Section mode has real save behavior with local action bar.
  - [x] False read-only behavior softened for warnings.
  - [x] Right-hand panel switches context between teacher and section staffing.
  - [x] Adviser star and homeroom context restored.
  - [x] Sticky action strip gap fixed.
  - [x] Redundant X gone and click targets improved.
  - [x] Section candidate loads color-coded.
  - [x] Swap behavior updates both source and destination draft state.
- **Verdict**: GO

 
## 2026-05-27 - TeacherGridMode and Inspector Fix (Runtime/TypeScript)

- **Scope**: Fix runtime ReferenceError (Star is not defined) and TypeScript type import regressions.
- **Files Changed**:
  - atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx
- **Verified Outcomes**:
  - [x] Star icon imported from lucide-react in TeacherGridMode.
  - [x] FacultyOwnershipState import moved to correct helper source in all components.
  - [x] Runtime crash resolved.
- **Verdict**: GO

 
## 2026-05-27 - SectionInspector Info Icon Fix

- **Scope**: Fix runtime ReferenceError (Info is not defined) in SectionInspector.
- **Files Changed**:
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx
- **Verified Outcomes**:
  - [x] Info icon imported from lucide-react.
  - [x] Runtime crash in Section Allocation mode resolved.
- **Verdict**: GO

