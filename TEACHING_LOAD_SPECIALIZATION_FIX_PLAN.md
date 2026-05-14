# Audit & Fix Plan: Teacher Specialization & Teaching Load Integration

## 1. Current State Assessment

### 1.1 Specialization Mapping Disconnect
- **Finding:** The `Specialization Mapping` page (`/specialization-mapping`) allows administrators to map EnrollPro specialization terms (e.g., "Algebra") to specific ATLAS subjects (e.g., "MATH7", "MATH8"). These mappings are stored in the `specialization_aliases` table.
- **Problem:** The `Teaching Load` / `Faculty Assignments` page (`/faculty-assignments`) uses a frontend-only qualification matcher (`getQualificationTier`) that **does not consult the specialization mappings**. It only checks if the teacher's specialization string exactly matches one of the strings in the subject's `allowedSpecializations` array (which is often empty or uses broad terms like "MATHEMATICS").
- **Backend Problem:** The `QualificationService` on the backend treats specialization mappings as "Tier 3" (Fuzzy) and incorrectly validates them against `allowedSpecializations` instead of the mapped `subject.code`.

### 1.2 HG Advisory Teaching Load
- **Finding:** Homeroom Guidance (HG) is treated as a regular subject in the teaching load UI.
- **Problem:** Every class advisor is required to teach HG to their own advisory class. Currently, this must be assigned manually, which is error-prone and redundant since the advisor-section relationship is already known from the sync.

### 1.3 Missing Automation
- **Finding:** Teaching load assignment is currently a 100% manual process. 
- **Opportunity:** We have the data (specialization mappings, load caps, section rosters) to implement an "Auto-Assign" algorithm that can provide a baseline teaching load for the entire school in one click.

---

## 2. Fix Plan

### 2.1 Integrate Specialization Mapping into Qualification Logic
- [ ] **Data Fetching:** Update `FacultyAssignments.tsx` to fetch the `SpecializationAlias` catalog on mount.
- [ ] **Frontend Tier Logic:** Update `getQualificationTier` in `grade-labels.ts` to accept the alias catalog.
    - **Tier 1 (Explicit):** If the teacher's specialization has a mapping in `SpecializationAlias` that points to the current `subject.code`.
    - **Tier 2 (Structural):** If the teacher's department/specialization matches `subject.allowedSpecializations` (legacy fallback).
    - **Tier 3 (Keywords):** Fuzzy keyword match.
- [ ] **Backend Alignment:** Update `QualificationService.ts` to reflect the same tier priority and correctly validate `alias.canonical` against `subject.code`.

### 2.2 Automatic HG Advisory Assignment
- [ ] **Backend Service:** Modify `getAssignmentsByFaculty` and `getAssignmentSummary` in `faculty-assignment.service.ts` to **inject** a virtual HG assignment for advisors.
    - If `member.isClassAdviser` is true and `member.advisedSectionId` is set, automatically add an assignment for the "HG" subject for that section.
- [ ] **Backend Validation:** Update `setAssignments` to ensure that HG assignments for advisory sections are **immutable**. They cannot be removed or assigned to anyone else if the advisor is active.
- [ ] **Frontend UI:**
    - In `SubjectRow.tsx`, identify the HG assignment.
    - If it's the advisor's own section, display it as "System Assigned" and disable the checkbox (read-only).
    - Add a tooltip explaining: "Automatically assigned based on Class Advisership."

### 2.3 Teaching Load Auto-Assignment Algorithm
- [ ] **Algorithm Design:** Implement a greedy assignment loop in a new `teaching-load-automation.service.ts`.
    - **Step 1:** Assign HG to all advisors (System Mandatory).
    - **Step 2:** Group sections by grade level and subject.
    - **Step 3:** For each subject-section pair, identify qualified teachers using Tier 1 (Mapped Specialization).
    - **Step 4:** Assign to the qualified teacher with the lowest current load (least minutes per week).
    - **Step 5:** Respect `maxHoursPerWeek` capping rules (DepEd DO 010 s.2024).
- [ ] **UI Integration:** Add an "Auto-Assign All" button to the `Faculty Assignments` page header with a confirmation dialog.

## 3. Verification Strategy
- **Unit Test:** `QualificationService` should correctly return Tier 1 for a mapped specialization.
- **Integration Test:** `GET /faculty-assignments/summary` should return the automatic HG assignment for advisors even if not manually saved.
- **Visual Audit:** Check that HG checkboxes are disabled and labeled correctly for advisors in the UI.
