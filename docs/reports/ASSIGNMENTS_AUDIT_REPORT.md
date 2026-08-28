# ATLAS Assignments & Auto-Fill Audit Report (2026-05-15)

## 1. Issue: Program Scope Ignored in Assignments
**Confirmed:** Both the frontend UI and the backend auto-fill service currently ignore the `programScopes` defined for a subject when determining assignable sections. They only filter by `gradeLevel`.

### Evidence
- **Frontend (`FacultyAssignments.tsx`):**
  The list of sections passed to the `SubjectRow` component is filtered only by `gradeLevels`:
  ```tsx
  sections={allKnownSections.filter((sec) => 
    subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder)
  )}
  ```
  *Note: `sec.displayOrder` is used here as a proxy for grade level.*

- **Backend (`teaching-load-automation.service.ts`):**
  The `workQueue` for the auto-fill algorithm is built by matching subjects to sections solely based on grade level:
  ```typescript
  const relevantSections = subject.gradeLevels.length > 0
    ? allSectionIds.filter((sid) => {
        const gl = sectionGradeLevel.get(sid) ?? 0;
        return subject.gradeLevels.includes(gl);
      })
    : allSectionIds;
  ```

### Impact
Subjects like "Advanced Chemistry" (STE-only) are showing checkboxes for regular sections. If an officer checks one of these, it creates a curriculum mismatch that can lead to violations during schedule generation.

---

## 2. Issue: Auto-Fill Algorithm Favoritism (Science Department)
**Confirmed:** The auto-fill algorithm appears to favor Science department teachers because the qualification tier resolution is more "hit-heavy" for science-related keywords and specialization aliases.

### Root Causes
- **Keyword Matching:** The `matchesLegacyKeywords` function in the backend has a robust set of keywords for 'SCIENCE' (e.g., 'sci', 'biology', 'physics', 'chemistry'). If "Advanced Chemistry" (code: `ADV_CHEM`) is processed, it easily matches a Science teacher via Tier 3 (Outside Department but Keyword Match).
- **Specialization Aliases:** The system relies on the `specialization_aliases` table. If aliases for other departments (like English or Math) are missing or don't match the specific subject codes used in ATLAS, those teachers will fall to Tier 3 or get rejected entirely if `canTeachOutsideDepartment` is false.
- **Capacity Limits:** If science teachers are assigned first and hit their cap (Standard 30h/Hard 40h), the algorithm will stop assigning to them. However, if the subjects being processed first are Science-related, they will consume the load of Science teachers before moving to others.

### Recommendation
- Verify that `specialization_aliases` exist for all departments and canonical subject names.
- Ensure all teachers have `canTeachOutsideDepartment` set appropriately.
- Add "Program Scope" check to `findBestCandidate` to prevent illegal assignments.

---

## 3. Comprehensive UX/UI Audit: Assignments Page

### Current State
- **Functional:** Supports manual assignments, auto-fill, and staffing needs reporting.
- **Informative:** Shows teaching load percentages and compliance status colors.
- **Safe:** Includes Undo/Redo history and "Discard Draft" options.

### Identified Gaps & Improvements
1. **Program Visibility:** The section checkboxes should visually distinguish between Regular, STE, and Special programs (e.g., using different colored badges or grouping).
2. **Conflict Prevention:** Disable checkboxes for sections that don't match the subject's `programScopes`. Add a tooltip explaining *why* it's disabled (e.g., "This is an STE-only subject").
3. **Department Grouping:** The faculty list on the left should be groupable by department to help officers focus on one department at a time.
4. **Bulk Actions:** Add buttons for "Assign all [Grade] [Subject] sections to this teacher" to reduce repetitive clicking.
5. **Real-time Violation Feedback:** Instead of just showing a load percentage, show specific warnings if a selection causes a "Hard Violation" (e.g., "Subject specialization mismatch").
6. **Conflict Resolution View:** If a section is assigned to multiple teachers (DB-level conflict), provide a "Compare" view to see both teachers' loads and resolve the duplicate.
7. **Enhanced Staffing Report:** The "View Staffing Needs" modal should allow clicking on a "Shortage" to see exactly which sections are missing teachers.

---

## 4. Proposed Fix Strategy (Non-Implementation)

### Frontend Fix
Update `FacultyAssignments.tsx` to include program type filtering:
```tsx
sections={allKnownSections.filter((sec) => {
  const gradeMatch = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder);
  const programMatch = subject.programScopes.includes(sec.programType as any);
  return gradeMatch && programMatch;
})}
```

### Backend Fix
Update `teaching-load-automation.service.ts` to include program type filtering in the work queue:
```typescript
const relevantSections = allSectionIds.filter((sid) => {
    const section = sectionMap.get(sid);
    if (!section) return false;
    const gradeMatch = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(section.displayOrder);
    const programMatch = subject.programScopes.includes(section.programType as any);
    return gradeMatch && programMatch;
});
```

### Data Audit
Run a script to verify `SpecializationAlias` coverage for all core subjects to ensure auto-fill treats all departments equally.
