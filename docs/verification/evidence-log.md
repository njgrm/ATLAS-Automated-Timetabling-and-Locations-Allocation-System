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
