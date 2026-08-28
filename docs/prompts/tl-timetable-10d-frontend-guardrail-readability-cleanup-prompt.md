# Prompt 10D: Frontend Guardrail And Readability Cleanup

## Context

The latest commits still violate ATLAS frontend guardrails.

Missed items found by scan:

- Raw native `<button>` remains in:
  - `CampusMapOverview.tsx`
  - `CampusReadinessCard.tsx`
  - `RightPanel.tsx`
- Raw `title=` props remain in several touched React files.
- Micro-text remains widespread: `text-[9px]`, `text-[10px]`, `text-[0.5rem]`, `text-[0.5625rem]`, `text-[0.625rem]`.
- This hurts older users and violates the SMART/KISS readability direction.

## Mission

Clean primitive and typography guardrails in the changed surfaces without redesigning the app.

## Required Changes

### 1. Replace Raw Native Buttons

- Use project `Button` or icon button primitives.
- Preserve keyboard and focus behavior.

### 2. Replace Raw `title=`

- Use `Tooltip`, `HoverCard`, or accessible visible copy.
- Do not use native browser title tooltips.

### 3. Typography Cleanup

- Default operator-facing text must be `text-xs` or larger.
- Tiny badges may use compact text only if not primary decision text.
- Remove unreadable `text-[9px]`, `text-[0.5rem]`, and similar classes from touched files.

### 4. Keep Layout Constraints

- No global page scroll.
- Use `flex-1 min-h-0 overflow-auto` in scrolling regions.
- No horizontal overflow on mobile.

## Required Scans

Run and include output:

```bash
rg -n "<button\\b|<select\\b|<details\\b|\\btitle=" atlas-client/src
rg -n "text-\\[[0-9.]+(px|rem)\\]|text-\\[0\\.[0-9]+rem\\]" atlas-client/src/components/timetable atlas-client/src/components/campus-map atlas-client/src/components/dashboard atlas-client/src/pages
```

## Verification

Run:

- `npm --prefix atlas-client run build`

## Required Output

Return:

- files changed
- primitive scan result
- typography scan result
- build result
- prompt-scope `GO` or `NO-GO`

