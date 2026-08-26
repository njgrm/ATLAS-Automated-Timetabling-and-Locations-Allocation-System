# Audit & Specialization Mapping Implementation Plan

This document outlines the plan to address critical bugs and UX improvements in the `Audit` and `Specialization Mapping` pages.

## 1. Audit Page (/audit)

### 🔴 Critical Fixes
- **Dynamic School Year:** Replace hardcoded `schoolYearId: 1` with values from `fetchPublicSettings`.
- **Readiness Verdict:** Add a summary banner at the top (e.g., "Ready for Generation" in green vs. "Action Required" in red) based on critical error counts.

### 🟠 High Priority
- **Tab Badges:** Add count badges to each tab trigger (e.g., "Mismatches (5)").
- **Facilities Filtering:** Default the Facilities tab to show only gaps, with a toggle to "Show All Subjects with Requirements".
- **Utilization Summary:** Replace the full roster list with a summary view (e.g., "3 Overloaded", "12 Underloaded") or a more compact chart.
- **Stat Card Breakdown:** Split "Critical Errors" into two distinct cards or add sub-labels for "Mismatches" and "Facility Gaps".

### 🟡 Medium Priority
- **Search inputs:** Add a search/filter bar to Mismatches, Roster Integrity, and Constraint Clashes tabs.
- **Improved Labels:** Reword "Optimization" tab descriptions into plain English.
- **Tab Sorting:** Sort lists by priority (e.g., Mismatches by load, Roster Gaps by Grade -> Section).
- **Page Title:** Change "Qualification Audit" to "Scheduling Readiness Audit".

### 🔵 Low Priority
- **High-contrast Buttons:** Change "Fix →" ghost buttons to `variant="outline"` or `variant="link"`.
- **Empty States:** Add clear empty-state messages for the Facilities tab.

---

## 2. Specialization Mapping Page (/specialization-mapping)

### 🔴 Critical Fixes
- **Quick Resolve Race Condition:** Modify `handleAdd` to accept `canonical` as an argument to avoid React state lag during one-click resolves.

### 🟠 High Priority
- **Plain English Labels:** 
    - Change "Canonical" to "ATLAS Learning Area".
    - Change "Alias" to "EnrollPro Specialization Term".
- **Delete Confirmation:** Add a `ConfirmationDialog` or use a native `confirm()` before removing a mapping.
- **Impact Explanation:** Add a tooltip or expand the orphan warning to explain *how* this affects the scheduler (e.g., "These teachers will not be selectable for their learning areas").

### 🟡 Medium Priority
- **Micro-confirmation Step:** In Quick Resolve, require a click on an "Add" button after selecting from the dropdown rather than immediate submission.
- **Smart Canonical Select:** Filter the initial subject list to those that actually define `allowedSpecializations`.
- **Search in Active Mappings:** Add a search bar to filter the list of existing mappings.
- **Bidirectional View:** Add a small list or indicator for "Subjects without defined mappings" to ensure coverage.

### 🔵 Low Priority
- **Arrow Icon:** Replace the text `→` with a proper `ArrowRight` icon.
- **Visual Feedback:** Add a temporary highlight animation to newly added mapping rows.

---

## Execution Order
1. **[CRITICAL]** Fix `Audit.tsx` school year hardcoding and `SpecializationMapping.tsx` state race condition.
2. **[HIGH]** Add tab badges and readiness banner to `Audit.tsx`.
3. **[HIGH]** Implement delete confirmation and label updates in `SpecializationMapping.tsx`.
4. **[MEDIUM]** Add search bars and filter defaults.
5. **[POLISH]** Visual refinements and empty states.
