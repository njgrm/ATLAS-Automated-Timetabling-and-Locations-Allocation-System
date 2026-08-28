# Copilot Execution Prompt: ATLAS and EnrollPro UI/UX Design Parity

## Objective
Apply a comprehensive styling update to ATLAS to achieve full visual and brand parity with EnrollPro. This includes updating the primary typeface, elevating global font weights, adding tactile interaction feedback, and refining UI primitives (`Button`, `Card`, `Badge`) to match the EnrollPro design system.

## Required Context
- `EnrollPro/client/src/index.css` (Target Reference)
- `atlas-client/src/index.css` (Source)
- `atlas-client/src/ui/button.tsx` & `button-variants.ts`
- `atlas-client/src/ui/card.tsx`
- `atlas-client/src/ui/badge-variants.ts`

## Implementation Requirements

### 1. Typography & Global Weight
- **Switch Font**: Change the primary font family in `atlas-client/src/index.css` from `Public Sans` to `'Instrument Sans'`.
- **Elevate Base Weight**: Add a global base style in `index.css` (or update existing) so that `body` uses `font-medium` and `font-normal` classes are remapped to `medium`.
- **Title Authority**: Card titles must be upgraded to `font-black` (900 weight).

### 2. Tactile Feedback (The "EnrollPro Sinking" Button)
- **Active State**: Update `button-variants.ts` to include `active:translate-y-px`. When clicked, buttons should physically sink by 1px.
- **Thicker Focus**: Change focus rings from `ring-2` to `ring-3` with `ring-ring/50`.
- **Bold by Default**: All buttons should use `font-bold` as their base weight.

### 3. Refined UI Primitives
- **Button Radii**: Ensure small (`xs`, `sm`) buttons use specific pixel-capped radii (e.g., `rounded-[10px]` and `rounded-[12px]`) to maintain visual balance at small scales.
- **Card Padding & Header**:
    - Increase `CardTitle` weight to `font-black`.
    - Increase `CardDescription` weight to `font-bold`.
- **Badge Variants**:
    - Ensure `Badge` has first-class `success`, `warning`, and `danger` variants using the soft-background pattern (e.g., `bg-green-100 text-green-800`).

### 4. Background & Boundary Contrast
- **Main Background**: Update `:root` tokens in `index.css` to use a cleaner White background (`0 0% 100%`) for the main content area.
- **Sidebar Background**: Ensure the sidebar uses the EnrollPro light-grey token (`0 0% 94%`) to clearly distinguish navigation from content.

## Verification Gates
1. `npm --prefix atlas-client run build` passes with no CSS or JSX errors.
2. Verify font family is correctly loaded as `Instrument Sans`.
3. Verify buttons "sink" when clicked.
4. Verify card titles are significantly bolder (`black` weight).

## Required Output
1. Files changed.
2. Summary of design system shifts.
3. Verification results.
4. `GO` or `NO-GO`.

## GO Condition
Return `GO` only if ATLAS typography, weight hierarchy, and button tactility now match the EnrollPro source of truth.
