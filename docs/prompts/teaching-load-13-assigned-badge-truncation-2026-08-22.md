# Prompt 13 — Assigned Section Badge Truncation

## Goal
Fix the harsh truncation of the "Assigned to X" badge inside section containers when expanding a grade level in the Teaching Load view.

## Context
When a user expands a grade level (e.g. GR7) to view the individual section containers, sections assigned to another teacher display a yellow badge indicating the owner. However, this badge is styled with a strict `max-w-28` (112px) limit. For most teacher names, this causes the badge to awkwardly truncate to just `Assig...` despite there being plenty of available whitespace in the section card layout.

The previous fix attempted to solve this by using `flex-shrink`, but because the parent flex container had a `truncate` class, it aggressively shrunk the badge down to a single letter (e.g., `C...`) while letting the section name text node expand infinitely.

We need to properly configure the flex container: the section name should be allowed to shrink and truncate, while the badge should be allowed to use available space up to a reasonable maximum (e.g. `140px`).

## Target files
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`

## Tasks

1. **Fix Flex Container Truncation**:
   - Locate the flex container rendering the section name and the badge (around line 560):
     ```tsx
     <span className={`... truncate ... flex items-center gap-1.5 flex-1 min-w-0`}>
     ```
   - Remove the `truncate` class from this parent `<span>`. 

2. **Wrap and Truncate the Section Name**:
   - Wrap `{section.name}` inside a new `<span>` that explicitly handles its own truncation:
     ```tsx
     <span className="truncate shrink">{section.name}</span>
     ```

3. **Update the Badge Styling**:
   - Ensure the assigned owner badge uses `shrink-0 max-w-[140px] truncate` instead of `flex-shrink truncate`.
   - The final structure should look like this:
     ```tsx
     <span className={`text-[0.75rem] font-semibold leading-tight ${isSelected ? 'text-primary' : 'text-foreground'} flex items-center gap-1.5 flex-1 min-w-0`}>
       <span className={cn("size-2 rounded-full shrink-0", ...)} />
       <span className="truncate shrink">{section.name}</span>
       {isOwnedByOther && (
         <Tooltip>
           <TooltipTrigger asChild>
             <span className="text-[10px] font-bold tracking-tight text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded shrink-0 max-w-[140px] truncate ml-1 cursor-help">
               {owner.facultyName}
             </span>
           </TooltipTrigger>
           <TooltipContent side="top" className="text-xs font-bold">
             Assigned to {owner.facultyName}
           </TooltipContent>
         </Tooltip>
       )}
     </span>
     ```

## UX requirements
- The badge must display a meaningful portion of the teacher's name (up to 140px), not just `C...`.
- If the card is extremely narrow, the section name should shrink/truncate before the badge shrinks down to nothing.
- Full context must be available on hover via progressive disclosure.

## Acceptance criteria
- [ ] `truncate` is removed from the parent flex container.
- [ ] `{section.name}` is wrapped in a `truncate shrink` span.
- [ ] The assigned owner badge uses `shrink-0 max-w-[140px]`.

## Verification commands
```bash
# Build check
npm run build
```

## Report requirements
- Confirm the new DOM structure for the section name flex container.
