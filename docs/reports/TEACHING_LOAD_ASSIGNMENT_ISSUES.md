# Teaching Load Assignment & Faculty Integration Issues - Investigation Report

**Date:** May 15, 2026
**Investigator:** Gemini CLI

## 1. Issue: Unselectable classes (e.g., Grade 9 Mathematics - Tulip/Sampaguita)

### Observed Behavior
A faculty member (specifically for Grade 9 Mathematics) can see her classes, but the checkboxes are unselectable/disabled. This occurred after the "Auto-Fill Remaining" function was used.

### Root Cause Analysis
Based on the code analysis of `SubjectRow.tsx` and `teaching-load-automation.service.ts`:

1.  **Ownership Conflicts:** The UI disables checkboxes (`blocked = true`) if a section is already owned by someone else in the database (`isSavedOther`) or in another teacher's active draft (`isPendingOther`).
    ```typescript
    // SubjectRow.tsx
    const blocked = !isSelected && (!programCompatible || isPendingOther || isSavedOther || isHardConflict);
    ```
2.  **Auto-Fill Side Effects:** The "Auto-Fill" algorithm searches for "best-qualified" candidates using **Specialization Aliases**. 
    - If a Science teacher has a specialization alias that matches "Mathematics" (or vice-versa, depending on mapping), the Auto-Fill algorithm might have assigned those Math sections to Science teachers because they were technically unassigned at the time the button was clicked.
    - If the Math teacher had these sections in her **draft** but had not yet **saved** them, the backend "Auto-Fill" (which only sees saved data) would consider those sections unassigned and give them to someone else.
3.  **Locking Mechanism:** Once "Auto-Fill" saves those assignments to another teacher, the sections show up as "Saved: [Other Teacher Name]" on the original teacher's page. The checkboxes are disabled to prevent duplicate ownership unless an explicit **Swap** is performed.

### Recommended Fix
- Users should check the labels on the blocked sections to see who the "Saved" owner is.
- If an incorrect assignment was made by Auto-Fill, the administrator should either:
    - Use the "Swap" button (if available and enabled).
    - Manually remove the assignment from the incorrect teacher first.
- **Improvement:** Auto-Fill should perhaps prioritize "Draft" ownership if possible, or warn if sections being assigned are currently in someone's draft.

---

## 2. Issue: Reset Assignments Functionality

### Current Behavior
The "Reset Assignments" button in the `FacultyAssignments.tsx` page performs a **Local Draft Reset**.

1.  **Scope:** It only affects the **currently selected faculty member**.
2.  **Action:** It clears all **mutable** assignments in the current draft.
3.  **Preservation:** It explicitly preserves **Homeroom Guidance (HG)** assignments for active class advisers (per DepEd standards).
4.  **Draft-only:** It does NOT clear saved assignments in the database immediately. It updates the draft state. To persist the "reset" state, the user must click "Save Teaching Load" after resetting.

### Why it feels like it "does nothing"
If a user expects a **Global Reset** (clearing everyone) or an **Instant Database Wipe**, this button will not meet that expectation. It only reverts the current teacher's draft to an "empty" (or HG-only) state.

### Planned Enhancement
A "Global Reset" feature is being requested to wipe all teaching loads back to zero for the entire school year. This is currently not implemented to prevent accidental mass data loss.

---

## 3. Issue: Missing Teacher Employee IDs

### Root Cause Analysis
The investigation of `atlas-server/src/services/faculty.service.ts` revealed a bug in the synchronization logic.

1.  **Data Fetching:** The `FacultyAdapter` correctly fetches `employeeId` from the EnrollPro API.
2.  **Mapping Error:** In `faculty.service.ts`, the `syncFacultyFromExternal` function performs an `upsert` operation on the `FacultyMirror` table. However, the `employeeId` field is **omitted** from both the `create` and `update` blocks.
    ```typescript
    // atlas-server/src/services/faculty.service.ts (Buggy lines ~375)
    await prisma.facultyMirror.upsert({
      where: { schoolId_externalId: { schoolId, externalId: f.id } },
      update: {
        firstName: f.firstName,
        lastName: f.lastName,
        // MISSING: employeeId: f.employeeId
        // ...
      },
      create: {
        externalId: f.id,
        // MISSING: employeeId: f.employeeId
        // ...
      }
    });
    ```
3.  **UI Impact:** Since the field is never saved to the database, the frontend always receives `null` or `undefined` for `employeeId`, resulting in the "No ID" display.

### Recommended Fix
Update the `upsert` call in `faculty.service.ts` to include the `employeeId` field.
