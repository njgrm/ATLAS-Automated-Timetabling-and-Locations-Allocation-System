# Prompt 09 — Teaching Load UX Cleanup & Micro-text Removal

## Goal
Clean up the UX of the Teaching Load page by removing redundant header badges, correcting a minor typography issue in subject rows, removing dead code, and strictly enforcing the no-micro-text guardrail.

## Context
A Playwright-driven UI audit of the Teaching Load workspace (`/teaching-load`) identified several violations of the `GEMINI.md` guardrails:
1. **Badge Spam**: The header renders two identical `[ATLAS Teaching Load draft]` badges next to each other because `WorkspaceToolbar.tsx` renders both the passed `workspaceStateLabel` and its own internal `statusConfig.label`.
2. **Micro-text**: `TeacherIdentityStrip.tsx` and `StackedWorkloadBar.tsx` heavily abuse `text-[0.45rem]`, `text-[0.55rem]`, `text-[0.6rem]`, and `text-[0.65rem]`. The global constraint mandates a minimum of `text-xs` for secondary content.
3. **Typography**: `SubjectRow.tsx` uses a literal asterisk (`*`) to separate the subject code from the hours-per-week text, breaking the `•` (middot) convention used elsewhere.
4. **Dead Code**: `OverviewHeader.tsx` is completely unused.

## Target files
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`
- `atlas-client/src/components/faculty-assignments/StackedWorkloadBar.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx` (DELETE)

## Tasks
1. **Consolidate Header Badges**:
   - In `WorkspaceToolbar.tsx`, remove the badge that renders `{workspaceStateLabel}`.
   - Keep the badge that renders `{statusConfig.label}` (since it has the dynamic colored dot).
   - Update the tooltip for the retained badge so that it displays the rich content from the parent:
     ```tsx
     <TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
       <p className="font-semibold text-foreground">{workspaceStateDescription}</p>
       <p className="mt-1 text-muted-foreground">{workspaceStateNextAction}</p>
     </TooltipContent>
     ```
   - (You may still need to use `statusConfig.description` if `workspaceStateDescription` isn't passed, but `TeachingLoad.tsx` does pass it. Combine or conditionally render as appropriate to preserve all context without duplication).

2. **Fix Typography in SubjectRow**:
   - In `SubjectRow.tsx` (around line 351), change the literal `*` to a `&middot;` or `•` character for the visual separator. You may use `text-xs` instead of `text-[10px]` for it.

3. **Eradicate Micro-text**:
   - Scan `TeacherIdentityStrip.tsx` and `StackedWorkloadBar.tsx` for all instances of `text-[0.45rem]`, `text-[0.55rem]`, `text-[0.6rem]`, and `text-[0.65rem]`.
   - Bump these classes to `text-xs` (or `text-[10px]` if space is strictly constrained inside a tiny badge). Rely on `text-muted-foreground` and font weights for visual hierarchy instead of microscopic font sizes.

4. **Remove Dead Code**:
   - Delete `OverviewHeader.tsx`.

## UX requirements
- The Teaching Load header must only show ONE status badge (e.g., `ATLAS Teaching Load draft`).
- The remaining badge must retain its colored indicator dot.
- Text must be legible. Do not allow operator-facing copy to fall below `text-[10px]`, defaulting to `text-xs`.

## Acceptance criteria
- [ ] No double badges appear in the top-left of the Teaching Load page.
- [ ] Tooltip on the single badge shows the full description and next action.
- [ ] `OverviewHeader.tsx` is deleted.
- [ ] `SubjectRow` uses a middot instead of an asterisk.
- [ ] `text-[0.45rem]` through `text-[0.65rem]` are removed from the target files.

## Verification commands
```bash
# Verify no micro-text remains in the affected files
Get-Content atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx | Select-String "text-\[0\.[456]"
Get-Content atlas-client/src/components/faculty-assignments/StackedWorkloadBar.tsx | Select-String "text-\[0\.[456]"

# Build check
npm run build
```

## Report requirements
- Confirm which text sizes were bumped to `text-xs` vs `text-[10px]`.
- Provide a summary of the consolidated badge's Tooltip content structure.
