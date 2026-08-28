# UX/UI Audit: Specialization Mapping

**Target Page:** `/specialization-mapping`  
**Goal:** Improve scheduler efficiency and accuracy when mapping EnrollPro specialization terms to ATLAS subjects.

---

## 1. Current Functionality Overview

The Specialization Mapping page is a configuration bridge that links external specialization strings (from EnrollPro) to internal ATLAS subjects. This mapping directly affects faculty qualification checks used during automated scheduling.

### Existing Features:
- **Categorized View:** Specializations are grouped by Department (e.g., MATHEMATICS, ENGLISH).
- **Status Indicators:** Individual cards show "Mapped" (green) or "Needs subject" (amber).
- **Smart Sorting:** The subject dropdown sorts subjects that match the department name to the top.
- **Orphan Detection:** A header badge warns if any specializations from the live catalog are unmapped.
- **Unsaved Changes Guard:** Uses a router blocker to prevent data loss on navigation.
- **Live Sync:** Fetches live data from EnrollPro departments and specialization catalogs.

---

## 2. Critical Weaknesses & Friction Points

### A. Selection UI Scalability (The "Dropdown Problem")
- **List Overload:** The `Select` component renders a flat list of all subjects. In a typical school with 50+ subjects, finding a specific option is slow and error-prone.
- **No Internal Search:** Once the dropdown is open, there is no way to type-to-filter within the list.
- **Mobile Unfriendly:** Long select lists are notoriously difficult to navigate on mobile devices.

### B. Navigation and Discovery
- **Lack of Filtering:** Users cannot filter the page to show "Only Unmapped" specializations. In a large school, users must scroll through hundreds of cards to find the amber "Needs subject" indicators.
- **No Global Search:** There is no way to search for a specific specialization across all departments.
- **Information Density:** The grid layout (3-cols on XL) makes it hard to scan specialization names quickly due to the large card borders and padding.

### C. Performance and Reliability
- **Inefficient Batching:** `saveAllChanges` performs sequential `DELETE` then `POST` requests for every changed item.
    - **Risk:** If the network fails midway, some mappings are deleted but never recreated, causing inconsistent mapping state.
    - **Speed:** 20 changes = 40 network requests. This creates visible lag and long "Saving..." states.
- **Sequential Awaits:** The use of `await` inside a `for` loop blocks the next request until the previous one finishes, maximizing the total save time.

### D. Interaction Model
- **Purely Manual:** There are no bulk actions. If multiple specialization terms map to the same subject, users repeat the same selection many times.
- **"One-Click" Resolve Absence:** There is no "Quick Suggest" button that uses the smart-sort logic to automatically map high-confidence matches with one click.

### E. The "1-to-Many" Structural Blocker (Critical Failure)
- **The Reality:** Due to DepEd rotating schedules (e.g., JHS Science rotating 4 teachers per year), ATLAS uses *Modular Subjects* (`SCI_BIO`, `SCI_CHEM`, etc.).
- **The UI Failure:** The current mapping table enforces a strict 1-to-1 relationship. The UI only allows selecting *one* ATLAS Subject per EnrollPro Specialization.
- **The Impact:** If an HR profile says `"MAJOR IN SCIENCE"`, the admin must map it to Biology, Chemistry, Earth Science, and Physics simultaneously. Because the UI restricts this to a single choice, qualification matching for modular subjects can fail during generation.

---

## 3. Bad Practices Identified

1. **Non-Atomic Operations:** Updating a mapping should be atomic. The current "delete-then-create" pattern increases failure risk. The backend should expose a single batch-capable endpoint that accepts an array of `subjectIds` per specialization and executes within one Prisma `$transaction`.
2. **Naming Disconnect:** 
    - **Backend:** `canonical` and `alias`.
    - **Frontend:** `Subject` and `Specialization`.
    - *Correction:* The UI should use scheduler-friendly terminology (e.g., "ATLAS Learning Area" and "EnrollPro Term").
3. **Redundant Rendering:** Re-fetching the entire catalog and subject list after every save is heavy. Partial state updates would be smoother.
4. **State Lag:** As noted in `AUDIT_SPECIALIZATION_FIX_PLAN.md`, there is a known race condition in state management when performing rapid updates.

---

## 4. Proposed UX Improvements (Prioritized)

### Phase 1: High Impact / Low Effort
1. **Multi-Select Combobox:** Replace the single `Select` with a **Multi-Select Combobox** (or tag input). Administrators must be able to assign an array of subject IDs (e.g., `[SCI_BIO, SCI_CHEM, SCI_ES, SCI_PHYS]`) to one specialization term.
2. **Intelligent Department Grouping (Smart Sort):** The Multi-Select Combobox should use grouped data. It should read the department name of the current EnrollPro specialization and pin ATLAS subjects from that same department to the top under a "Suggested" section.
3. **Inactive Subject Warning:** If an administrator maps to an ATLAS subject with `isActive: false` (for example, legacy generic subjects), the UI should display a clear warning that the mapping will not be used during generation.
4. **Filter by Status:** Add a toggle to "Show Unmapped Only" at the top of the page.
5. **Global Search:** Add a search bar to filter the specialization cards by name.

### Phase 2: Structural Improvements
1. **Bulk Map:** Allow users to select multiple specializations within a department and map them in one action.
2. **Modular Group Smart-Suggest:** If a user maps an EnrollPro term to `SCI_BIO`, the UI should detect the `modularGroupId` and prompt: *"Map the remaining Science modules in this group as well?"*
3. **One-Click Auto-Mapping:** Add a "Magic Wand" icon to unmapped specializations that appears if the smart-sort logic finds a 90%+ confidence match.
4. **Batch API Endpoint:** Add a batch endpoint (for example, `POST /api/v1/specialization-aliases/batch`) that accepts an array of mappings and applies changes in a single transaction.

### Phase 3: Visual Refinement
1. **Compact View Toggle:** Provide a "Table View" or "List View" option for faster scanning of hundreds of items. The Table View should display the Mapped Subjects as wrapped 'Chips' or 'Badges' to accommodate the new multi-mapping requirement without breaking the layout.
2. **Progress Visualization:** Change the header badge into a progress bar to give a better sense of "Completion toward Readiness".

---

## 5. Summary Verdict
The current implementation is functional but **not yet scalable for real deployment volume**. It works for small datasets but becomes a bottleneck when hundreds of specialization variants must be reconciled. The current 1-to-1 mapping constraint is the primary structural blocker because it does not support modular DepEd subject structures. Moving to a **search-first**, **multi-select capable**, and **batch-oriented** workflow is necessary for production readiness.

---

## 6. Live Testing Plan (Tailscale/Tailnet)

To validate these recommendations against real-world edge cases, proposed changes should be tested using live EnrollPro-connected data through the Tailscale network.

**Target Environment:** `https://njgrm.buru-degree.ts.net` (Live Tailnet)

### Testing Directives
1. **Connect & Fetch:** Sync the local development environment with live Tailnet endpoints to retrieve the actual EnrollPro specialization catalog and ATLAS subject configurations.
2. **Audit Live Data Diversity:** Verify whether additional modular groupings exist beyond Science (for example, TLE and MAPEH) that 1-to-many suggestions must support.
3. **Performance Baseline:** Measure current load time and state lag when mapping 20+ specializations, then compare against the batch API and UI improvements.
