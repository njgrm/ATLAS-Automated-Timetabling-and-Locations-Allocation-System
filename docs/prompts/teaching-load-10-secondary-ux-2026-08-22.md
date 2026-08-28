# Prompt 10 — Teaching Load Secondary Views UX & Micro-text Cleanup

## Goal
Complete the Teaching Load UX cleanup by targeting the secondary views (Section Grid Mode, AutoFill Summary Modal, Roster Sidebar). We need to fix a logical bug in the Staffing Audit modal and eradicate the remaining micro-text violations across these components.

## Context
Following the initial UX cleanup (Prompt 09), a deeper audit of the secondary processes (like the "Review saved coverage" modal and the "Section view" mode) revealed:
1. **Logical UI Bug in Staffing Audit Modal**: When a user clicks "Review saved coverage", `AutoFillSummaryModal.tsx` opens with `reviewOnly={true}`. However, it still inappropriately renders the `applyDisabledReason` amber warning box (which says "ATLAS needs to save this preview as a proposal before it can be applied"). This warning makes no sense in read-only review mode because the user isn't trying to apply anything.
2. **Remaining Micro-text**: `AutoFillSummaryModal.tsx`, `RosterSidebar.tsx`, `SectionGridMode.tsx`, and a few other files still contain `text-[0.55rem]`, `text-[0.6rem]`, and `text-[0.65rem]` tailwind classes. `GEMINI.md` mandates that operator-facing copy should not fall below `text-xs` (or an absolute minimum of `text-[10px]` if strictly required inside a badge).

## Target files
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- `atlas-client/src/components/faculty-assignments/RosterSidebar.tsx`
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/TeachingLoadLockRecoveryDialog.tsx`
- `atlas-client/src/components/faculty-assignments/TeachingLoadRepairQueue.tsx`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx`

## Tasks

1. **Fix the Staffing Audit Modal Bug**:
   - In `AutoFillSummaryModal.tsx`, locate the block that renders `applyDisabledReason`. 
   - Modify the rendering condition so that it NEVER renders if `reviewOnly` is true. For example:
     ```tsx
     {applyDisabledReason && !reviewOnly && (
         <p data-testid="teaching-load-suggestion-feedback" className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800" aria-live="polite">
             {applyDisabledReason}
         </p>
     )}
     ```

2. **Eradicate Remaining Micro-text**:
   - Do a global find in `atlas-client/src/components/faculty-assignments/` for `text-[0.55rem]`, `text-[0.6rem]`, and `text-[0.65rem]`.
   - Bump these classes up to `text-xs` (or `text-[10px]` if space is strictly constrained, like inside a `size-6` badge or heavily crowded table header).
   - This explicitly applies to `AutoFillSummaryModal`, `RosterSidebar`, `SectionGridMode`, `TeachingLoadLockRecoveryDialog`, `TeachingLoadRepairQueue`, `WorkspaceToolbar`, and `StaffingAuditSheet`.

## UX requirements
- The "Review saved coverage" modal must not show the proposal application warning since there is no proposal being applied.
- Text must be legible. Normal operator-facing copy should be `text-xs` minimum.

## Acceptance criteria
- [ ] `AutoFillSummaryModal.tsx` correctly suppresses `applyDisabledReason` when `reviewOnly` is true.
- [ ] A regex search for `text-\[0\.[56]` yields 0 results across `faculty-assignments`.

## Verification commands
```bash
# Verify no micro-text remains in the affected directory
Get-ChildItem -Recurse -Filter "*.tsx" atlas-client/src/components/faculty-assignments | Select-String "text-\[0\.[56]"

# Build check
npm run build
```

## Report requirements
- Confirm that the `applyDisabledReason` bug is fixed.
- Summarize the micro-text replacements made across the secondary components.
