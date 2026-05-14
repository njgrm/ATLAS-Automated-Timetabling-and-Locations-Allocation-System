Here is the finalized, 100% bulletproof **Audit & Fix Plan**. It incorporates all the architectural safety measures we established (the physical database persistence of HG, the idempotent algorithm, and DO 005 s.2024 compliance) while seamlessly patching the three minor gaps your agent identified (the Sync Trigger, the Partial Modular Fallback, and the React Hook prop-drilling fix).

You can copy and paste this directly to your development team for execution.

---

# Audit & Fix Plan: Teacher Specialization & Teaching Load Integration

## 1. Current State Assessment

### 1.1 Specialization Mapping Disconnect

* **Finding:** The `Specialization Mapping` page (`/specialization-mapping`) allows administrators to map EnrollPro specialization terms to specific ATLAS subjects. These mappings are stored in the `specialization_aliases` table.
* **Problem:** The `Teaching Load` / `Faculty Assignments` page (`/faculty-assignments`) uses a frontend-only qualification matcher (`getQualificationTier`) that **does not consult the specialization mappings**. It only checks if the teacher's specialization string exactly matches one of the strings in the subject's `allowedSpecializations` array.
* **Backend Problem:** The `QualificationService` on the backend treats specialization mappings as "Tier 3" (Fuzzy) and incorrectly validates them against `allowedSpecializations` instead of the mapped `subject.code`.

### 1.2 HG Advisory Teaching Load

* **Finding:** Homeroom Guidance (HG) is treated as a regular subject in the teaching load UI.
* **Problem:** Every class advisor is required to teach HG to their own advisory class. Currently, this must be assigned manually, which is error-prone and redundant since the advisor-section relationship is already known from sync.
* **Architectural Risk:** A GET-only virtual HG assignment causes workload undercounts in all load-based services and auto-assignment algorithms.

### 1.3 Missing Automation

* **Finding:** Teaching load assignment is currently a 100% manual process.
* **Opportunity:** We have the data (specialization mappings, load caps, section rosters) to implement an "Auto-Fill" algorithm that respects existing manual assignments while filling in the blanks.

---

## 2. Fix Plan

### 2.1 Integrate Specialization Mapping into Qualification Logic

* [ ] **Data Fetching & State Management:** Update `FacultyAssignments.tsx` to fetch the `SpecializationAlias` catalog on mount. To prevent severe prop-drilling across hundreds of UI rows, wrap this logic in a custom hook (e.g., `useQualificationTier`) or a React Context, ensuring the catalog is fetched only once and accessed efficiently.
* [ ] **Frontend Tier Logic:** Update `getQualificationTier` in `grade-labels.ts` to accept the alias catalog.
* **Tier 1 (Explicit):** If the teacher's specialization has a mapping in `SpecializationAlias` that points to the current `subject.code`.
* **Tier 2 (Structural):** If the teacher's department/specialization matches `subject.allowedSpecializations` (legacy fallback).
* **Tier 3 (Keywords):** Fuzzy keyword match.


* [ ] **Backend Alignment:** Update `QualificationService.ts` to reflect the exact same tier priority and correctly validate `alias.canonical` against `subject.code`.

### 2.2 Event-Driven HG Advisory Assignment

* [ ] **Sync Integration:** Hook the HG injection logic directly into the synchronization adapter (`sync-enrollpro.service.ts`). Whenever a faculty member is synced/upserted, or their `advisedSectionId` is updated, the system must automatically write a physical `SubjectSectionOwnership` record for the `HG` subject to the database.
* [ ] **Backend Validation:** Update `setAssignments` to ensure that HG assignments for advisory sections are **immutable**. They cannot be removed or assigned to anyone else if the advisor is active.
* [ ] **Frontend UI:**
* In `SubjectRow.tsx`, identify the HG assignment.
* If it's the advisor's own section, display it as "System Assigned" and disable the checkbox (read-only).
* Add a tooltip explaining: *"Automatically assigned based on Class Advisership."*



### 2.3 Teaching Load Auto-Assignment Algorithm (Auto-Fill Remaining)

* [ ] **Algorithm Design:** Implement a state-preserving greedy assignment loop in a new `teaching-load-automation.service.ts`.
* **Step 1 (State Initialization):** Query the database for all existing manual `SubjectSectionOwnership` assignments. Deduct these minutes from the respective faculty's workload capacity. Mark these subject-section pairs as "Resolved" so the algorithm skips them.
* **Step 2:** Assign HG to all advisors (System Mandatory - should already be handled by the sync hook, but verify).
* **Step 3:** For each unresolved subject-section pair, identify qualified teachers using Tier 1 (Mapped Specialization).
* *Modular Subjects Fallback Rule:* For subjects possessing a `modularGroupId` (e.g., SCIENCE), attempt to fulfill all modules. If the algorithm hits workload caps before finding teachers for all modules, **do not roll back the transaction**. Persist the partial assignment (e.g., Q1 and Q2) and flag the remaining as "Lacking Faculty" to allow manual intervention later.
* *Cohort Subjects:* Allocate the required number of concurrent faculty based on `InstructionalCohort` groupings.


* **Step 4:** Assign to the qualified teacher with the lowest current load (least minutes per week).
* **Step 5:** Respect `maxHoursPerWeek` capping rules strictly based on **DepEd DO 005 s.2024** (calculating exact minute sums up to 1,800 min/week standard, 2,400 min/week hard cap).


* [ ] **UI Integration:** - Rename the header button to **"Auto-Fill Remaining"**.
* Add a confirmation dialog: *"This will automatically assign teachers to all unassigned subjects based on specialization and current workload. Your existing manual assignments will not be overwritten."*
* Ensure algorithm-generated rows (excluding HG) remain editable by administrators post-run.



---

## 3. Verification Strategy

### 3.1 Unit & Service Tests

* [ ] `QualificationService` returns Tier 1 for a mapped specialization based on `alias.canonical`.
* [ ] Algorithm correctly skips pre-existing manual assignments during state initialization.
* [ ] Workload capacity calculation dynamically adjusts based on DepEd DO 005 s.2024 caps.
* [ ] Cohort allocator assigns multiple concurrent teachers when required.

### 3.2 Integration Tests

* [ ] `sync-enrollpro.service.ts` successfully creates or updates physical HG `SubjectSectionOwnership` records upon advisership sync.
* [ ] `GET /faculty-assignments/summary` reflects persisted HG records from DB (not virtual response-only injection).
* [ ] Auto-fill allows "partial finalization" of modular bundles if workload caps are hit, triggering a "Lacking Faculty" warning rather than a complete transaction failure.

### 3.3 UI and Manual QA

* [ ] HG advisor-owned checkbox appears disabled with "System Assigned" label and explanatory tooltip.
* [ ] The qualification catalog is accessed via a custom hook (`useQualificationTier`) without severe prop-drilling.
* [ ] Header button label is "Auto-Fill Remaining" and the confirmation dialog copy explicitly states manual assignments are preserved.
* [ ] Post-run, algorithm-generated rows (excluding HG) are editable by administrators.

## 4. Implementation Notes for Developers

* Keep controller layer transport-only; implement logic in services.
* Keep all operations school-scoped and API versioned under `/api/v1/...`.
* Preserve optimistic edit behavior where applicable to avoid silent overwrite conflicts.
* Treat automation output as a draft baseline, not a final locked state.