### UI Implementation Directive: Teaching Load Clarity, Visual Separation & Modal Refinement

**Target File(s):** 
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

**Framework Requirements:** `shadcn/ui`, `lucide-react`, `Tailwind CSS`, framer-motion for any necessary animation polish.

**Layout & Styling Constraints:**
- **Typography Floor:** Strictly raise all `0.55rem` and `0.6rem` text to a minimum of `text-[0.65rem]` (font-bold) or `text-xs`.
- **Section Separation:** Abandon the current borderless/shadow-only grid. Each section item in the subject grid must have a distinct `border-border/80` or `border-primary/20` (when selected) and a subtle background shift (`bg-muted/30` or `bg-primary/5`) to ensure they are visually distinct from the parent container and each other.
- **Action Visibility:** "Take" and "Fix" buttons must be persistently visible (or at least have a higher baseline opacity) to ensure touch-screen compatibility and clearer affordance.
- **Modal Proportions:** Headers in modals should not exceed `text-xl` or `text-2xl` and should use moderate padding (`p-6` instead of `p-10`). Content areas must maximize available viewport height without feeling "trapped" by oversized static footers.

**Terminology Normalization:**
- Rename **"Synthetic Coverage"** to **"Unstaffed Assignments"**.
- Rename **"Placeholder Rows"** to **"Temporary Roles"**.
- Rename **"Integrity Diagnostics"** to **"Assignment Health Audit"**.
- Expand **"R"** and **"S"** abbreviations in the status bar to **"Real"** and **"Temp"**.

**Developer Instructions for Gemini:**
"Refactor the Teaching Load surface to improve clarity and structural balance for non-technical schedulers.

1. **Visual Separation & Actionability:** 
    - In `SubjectRow.tsx`, update the section mapping to render as a defined grid of cards. Apply `border border-border/60 rounded-md p-2 bg-card` to each section item.
    - When a section is selected, use `border-primary/40 bg-primary/5`.
    - Change 'Take/Fix' buttons from `ghost` to `variant="outline"` and ensure they are always visible (opacity-100) or have a high-contrast hover state that doesn't rely on transparency alone.

2. **Staffing Impact Modal (`AutoFillSummaryModal.tsx`) Refinement:**
    - **Header:** Reduce the `DialogHeader` padding and font sizes. Change `text-3xl` to `text-xl` or `text-2xl`.
    - **Grade Labels:** Fix the broken regex `item.sectionName.match(/\d+/)?.[0] || '?'`. Ensure it correctly pulls the grade number or uses the `section.displayOrder` property if available in the data contract.
    - **Content Spacing:** Remove the fixed `h-[85svh]` and instead use a flexible container that allows the scroll area to breathe. Increase padding within the shortage cards and reduce the size of decorative background icons.

3. **Workspace De-cluttering (Structural Shift):**
    - Move the **'Jump List'** and **'Assignment Health Audit'** (formerly Integrity Diagnostics) into a right-aligned **`Sheet` (Drawer)** or a persistent side-panel. This reclaims horizontal space in the main workspace and prevents the 'System Tools' dropdown from feeling like a dumping ground.
    - Ensure the 'Jump List' buttons are larger, more readable, and clearly labeled by department name.

4. **Typography & Language Pass:** 
    - Scan all touched files for `text-[0.55rem]` or `text-[0.6rem]` and upgrade to `text-[0.65rem] font-bold`.
    - Replace all technical jargon (Synthetic/Placeholder/Integrity) with the friendly alternatives defined in the directive. 
    - Add tooltip hovers to the coverage metrics in the footer to explain exactly what 'Real' and 'Temp' assignments mean (e.g., 'Real: Assignments given to actual teachers', 'Temp: Coverage assigned to temporary roles to identify gaps')."

