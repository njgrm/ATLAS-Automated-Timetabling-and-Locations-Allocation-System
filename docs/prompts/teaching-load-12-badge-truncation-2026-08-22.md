# Prompt 12 — Workload Status Badge Truncation & Progressive Disclosure

## Goal
Fix the truncation of the Teacher Workload status badge by separating its short state label from its long instructional text, adhering to the "progressive disclosure" UX guardrail.

## Context
During the UX audit of the Teaching Load right-hand inspector panel, we observed that the workload status badge for overloaded teachers reads: `ABOVE STANDARD - REVIEW BEFORE G...`. 

This occurs because `deriveLoadStatus` in `faculty-assignment-helpers.ts` returns extremely long strings (e.g., `'Over maximum - move classes before generating'`) that overflow the tiny badge containers. `GEMINI.md` mandates that important operational information must not live only in a truncated view. We need to split the short state label from the instructional text, displaying the label in the badge and the instruction in a tooltip.

## Target files
- `atlas-client/src/types.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
- `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`

## Tasks

1. **Update Types**:
   - In `types.ts`, add `statusInstruction?: string;` to the `LoadProfile` type.
   - In `faculty-assignment-helpers.ts`, add `statusInstruction?: string;` to the `WorkloadCapacitySummary` type.

2. **Split the Labels**:
   - In `faculty-assignment-helpers.ts`, modify `deriveLoadStatus` to return short labels and optional instructions:
     - For `over-cap`: `label: 'Over maximum'`, `instruction: 'Move classes before generating.'`
     - For `overload-allowed`: `label: 'Above standard'`, `instruction: 'Review before generating.'`
     - For `compliant`: `label: 'At standard'`
     - For `below-standard`: `label: 'Below standard'`
   - Update `deriveWorkloadCapacity` and `buildTeachingLoadProfile` to explicitly pass `statusInstruction` along with `statusLabel`.

3. **Implement Tooltips in UI Components**:
   - In `WorkloadInspector.tsx` and `TeacherIdentityStrip.tsx`, locate where `{loadProfile.statusLabel}` is rendered inside a `<Badge>`.
   - Wrap the `<Badge>` in a `<Tooltip>` ONLY IF `loadProfile.statusInstruction` exists.
   - Example implementation for both files:
     ```tsx
     {loadProfile.statusInstruction ? (
       <Tooltip>
         <TooltipTrigger asChild>
           {/* Add cursor-help to the Badge className here */}
           <Badge className="...">
             {loadProfile.statusLabel}
           </Badge>
         </TooltipTrigger>
         <TooltipContent side="bottom" className="max-w-xs p-3">
           <p className="text-xs font-medium">{loadProfile.statusInstruction}</p>
         </TooltipContent>
       </Tooltip>
     ) : (
       <Badge className="...">
         {loadProfile.statusLabel}
       </Badge>
     )}
     ```
   - Make sure to add `cursor-help` to the badge's className when it has a tooltip to indicate interactivity.

## UX requirements
- The workload badges must no longer truncate text (e.g., they should just neatly say "OVER MAXIMUM").
- The instructional warnings must be fully readable via hover.

## Acceptance criteria
- [ ] `deriveLoadStatus` returns short labels and separate `instruction` strings.
- [ ] Truncated text (e.g. `REVIEW BEFORE G...`) no longer appears inside the workload badges.
- [ ] Tooltips reveal the instructional text when hovered.

## Verification commands
```bash
# Typecheck
npx tsc --noEmit

# Build check
npm run build
```

## Report requirements
- Confirm that the long strings in `deriveLoadStatus` were successfully split.
