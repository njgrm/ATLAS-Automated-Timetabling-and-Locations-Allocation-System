# UX/UI & Logic Audit: Specialization Mapping

**Target Page:** `/specialization-mapping`
**Status:** Audit Completed
**Date:** May 14, 2026

---

## 1. Executive Summary
The Specialization Mapping page is a critical configuration bridge between external EnrollPro specialization strings and internal ATLAS subjects. While functional, the current implementation suffers from significant usability bottlenecks, logical gaps in suggestion algorithms, and scalability issues that will hinder large-school deployments.

---

## 2. UI/UX Audit Findings

### 2.1 The "Locked List" Problem (ComboBox Scrollability)
**Issue:** The specialization mapping ComboBox (`MappingMultiSelect`) is frequently reported as unscrollable or difficult to navigate.
- **Root Cause Analysis:** 
    - The `ScrollArea` component inside the `PopoverContent` uses a fixed `max-h-72`. While this should work, the interaction between `Radix UI Popover` (which uses a portal and focus traps) and `ScrollArea` can lead to scroll event blocking, especially if the `PopoverContent` does not have a defined `height` or if the `Viewport` is not correctly sized.
    - **Pointer Events:** The `PopoverContent` component in `atlas-client/src/ui/popover.tsx` defaults to `w-[var(--radix-popover-trigger-width)]`, which is often too narrow for the complex subject names, leading to massive text truncation and making the "scroll" feel useless if the user can't even read the options.
- **Impact:** Administrators cannot reach subjects at the bottom of the list without searching, creating a "dead-end" feel if the search query is unknown.

### 2.2 The "Artificial Ignorance" Problem (Smart Suggestions)
**Issue:** "Smart suggestions are not as smart."
- **Root Cause Analysis:** 
    - The current `isSuggested` logic in `SpecializationMapping.tsx` uses a simple token/substring match between the Specialization name and the Subject name/code.
    - **Missing Context:** It completely ignores the `allowedSpecializations` array defined in the `Subject` model.
    - **No Department Affinity:** It does not prioritize subjects from the same department as the specialization being mapped.
    - **Token Noise:** Common tokens like "Grade", "Level", or "JHS" trigger false positives, cluttering the "Suggested" section with irrelevant subjects.
- **Impact:** Users must manually search for subjects that the system should already know are compatible.

### 2.3 Table View Efficiency & Scalability
**Issue:** The List View is inefficient for large datasets.
- **Performance:** 
    - Every row rendering involves looking up mapped subject names in a flat array (`subjects.find(...)`). In a school with 500+ specializations and 100+ subjects, this becomes an O(N*M) operation on every render.
    - **No Virtualization:** The page renders the entire list into the DOM. For a typical large school (Grade 7-10), this can exceed 1000 DOM nodes in the table alone, causing scroll lag.
- **Usability:**
    - **Badge Bloat:** As specializations move to 1-to-many mappings (e.g., Science mapping to 4 modular subjects), the table rows expand vertically, breaking the visual rhythm and making scanning difficult.
    - **Manual Bulk Actions:** Bulk mapping requires checking boxes manually. There is no shift-select or "Select All in Department" functionality.

---

## 3. Logic & Backend Discrepancies

### 3.1 Terminology Disconnect
- **Backend Model:** Uses `canonical` and `alias`.
- **Frontend UI:** Uses `Subject` and `Specialization`.
- **EnrollPro Data:** Uses `Specialization` and `Department`.
- *Discrepancy:* The mapping of "canonical" to "Subject Code" is implicit and not strictly enforced in the database schema (it's just a string). If a subject code changes, existing mappings will break silently.

### 3.2 Modular Subject Handling
- **The "Enrichment" Trap:** The frontend `enrichWithModularSiblings` logic automatically adds all siblings in a `modularGroupId`.
- *Issue:* This happens silently in the state. A user might select "Science 7 - Biology" and find that Chemistry and Physics were also added without explicit confirmation. While technically correct for DepEd standards, the lack of transparency in the UI can be confusing.

### 3.3 API Atomicity
- **Batch Processing:** The `POST /specialization-aliases/batch` endpoint is atomic within a transaction, which is good.
- **Delete-then-Create:** The current logic deletes all existing mappings for an alias before creating new ones.
- *Discrepancy:* If a user accidentally saves an empty selection, all mappings for that term are wiped. There is no "Soft Delete" or "Confirmation" for clearing established mappings.

---

## 4. Recommendations (Implementation Strategy)

### Phase 1: Immediate UX Fixes
1. **Fix ComboBox Scroll:** 
    - Set a explicit `height` or `min-height` on the `ScrollArea` if content is present.
    - Increase `PopoverContent` width to `w-120` or use `w-full` relative to a container to prevent truncation.
2. **Improve Suggestion Logic:**
    - Incorporate `subject.allowedSpecializations` into the `isSuggested` check.
    - Implement a simple "Department Match" weight (e.g., if Spec Dept == Subject Dept, boost score).
3. **Table View Row Height:** Use a fixed-height row with a "Expand" or "Scrollable Badges" container for mapped subjects to maintain scanability.

### Phase 2: Algorithmic & Structural
1. **Virtualization:** Implement `react-window` or `tanstack-virtual` for the List View to handle hundreds of rows smoothly.
2. **Shift-Select:** Add range selection for checkboxes in List View.
3. **Modular Transparency:** When modular siblings are added, show a small "i" icon or tooltip explaining *why* they were added (e.g., "Automatically included as part of Science modular group").

### Phase 3: Backend Hardening
1. **Foreign Key Integrity:** Consider linking `SpecializationAlias.canonical` to `Subject.id` instead of `Subject.code` string to prevent breakage on code refactors.
2. **Audit Logging:** Ensure every batch update is logged with the `actorId` (currently missing from the batch endpoint logic).

---
*Report generated by ATLAS AI Auditor.*
