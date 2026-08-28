# Prompt 11 — Teaching Load View Mode Discoverability

## Goal
Improve the discoverability of the "Section View" by extracting the View Mode toggle out of the "More tools" dropdown and placing it directly on the `WorkspaceToolbar` as a visible, segmented control.

## Context
A user reported that they couldn't figure out how to normally navigate to the Section view:
*"I was able to access a section view, and I can't seem to normally navigate to that view aside from the default teacher list?"*

This is because the View Mode toggle (Teacher view vs Section view) is buried inside the `<Settings2>` dropdown menu in the top right corner of the `WorkspaceToolbar`. Hiding a primary navigation/view switch inside a generic settings dropdown is an anti-pattern. We need to expose this toggle directly on the toolbar surface so schedulers can instantly switch between viewing the roster and viewing sections.

## Target files
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`

## Tasks
1. **Import Tabs Primitives**:
   - Import `Tabs`, `TabsList`, and `TabsTrigger` from `@/ui/tabs`.

2. **Extract the View Mode Toggle**:
   - Locate the `<DropdownMenuRadioGroup value={viewMode}>` block inside the `<DropdownMenuContent>` that controls the 'teacher' vs 'allocation' view mode.
   - Remove this entire block (including its `<DropdownMenuLabel>` and `<DropdownMenuSeparator>`) from the dropdown.

3. **Implement Segmented Control**:
   - Create a segmented control using the Tabs components.
   - Place this control in the right-side action group, just before the `SmartHelpTrigger` and "Suggest Teaching Load Draft" buttons.
   - Example structure:
     ```tsx
     <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'teacher' | 'allocation')} className="h-8">
       <TabsList className="h-8 p-0.5 border border-border/40 bg-muted/50">
         <TabsTrigger value="teacher" className="h-7 px-3 text-xs font-bold uppercase tracking-tight">Teachers</TabsTrigger>
         <TabsTrigger value="allocation" className="h-7 px-3 text-xs font-bold uppercase tracking-tight">Sections</TabsTrigger>
       </TabsList>
     </Tabs>
     ```

## UX requirements
- The View Mode toggle must be immediately visible without clicking any dropdowns.
- The styling should match ATLAS's compact, bold, uppercase `text-xs` typography for controls.
- The `<Settings2>` dropdown should still contain the "Staffing mode" configuration and other advanced tools.

## Acceptance criteria
- [ ] View Mode toggle is no longer inside the dropdown menu.
- [ ] A Tabs-based segmented control for "Teachers" and "Sections" is visible on the main toolbar.
- [ ] Clicking the segmented control successfully switches the view mode.

## Verification commands
```bash
# Build check
npm run build
```

## Report requirements
- Confirm the location where the new Tabs control was inserted in the flex layout.
