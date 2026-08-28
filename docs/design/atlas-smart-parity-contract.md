# ATLAS SMART-Parity UX/UI Contract

## Purpose

ATLAS shall feel like a SMART-family sister system through shared interaction rhythm, visual density, and plain-language guidance. ATLAS shall not copy SMART’s grading domain, hard-code SMART colors, or override EnrollPro/HNHS school identity tokens.

## Page Anatomy

Every primary page shall use this default structure:

1. Compact command bar.
2. Visible source/readiness chip when data depends on EnrollPro, saved ATLAS data, schedule generation, or publish state.
3. One obvious next-step message.
4. One primary action.
5. Help.
6. More menu for secondary, advanced, or diagnostic actions.
7. Local content scroll region.

## Visual Rules

- Use the configured school token for brand identity.
- Use emerald only for success, ready, complete, or zero-blocker states.
- Use amber for warnings and red/destructive only for blocking or destructive states.
- Use `rounded-2xl`, soft shadows, token-tinted surfaces, and consistent `4px/8px/16px` spacing rhythm.
- Keep first useful content visible early on desktop, mobile portrait, and mobile landscape.
- Do not stack multiple feature banners above the work area.
- Do not expose multiple competing primary actions in one header.

## Interaction Rules

- Default views shall optimize one task at a time.
- Advanced tools shall be behind More, Details, Advanced, or explicit task drawers.
- Buttons, menus, dialogs, popovers, and sheets shall use project `@/ui/*` primitives.
- Dialogs and popovers shall close with Escape and return focus to their trigger.
- Icon-only actions shall include readable labels or accessible names.
- Drag actions shall always have a click-only alternative.

## Copy Rules

Every guidance, error, and disabled-action message shall explain:

1. What happened.
2. Why it matters.
3. What to do next.

Primary workflow copy shall avoid internal terms such as raw run context, backend version, gate, stale selector, or source adapter unless the user is in an advanced/debug surface.

## Mobile Rules

- Mobile pages shall use card/list layouts instead of squeezed desktop tables when scanning would be impractical.
- Touch targets shall be at least practical `44px` where layout allows.
- Faculty and public routes shall show focused role-specific context first.
- Sticky or fixed actions shall not cover core content.
- Nested scroll traps are not allowed.

## State Rules

- Loading states shall use skeletons or a single page/section-level loading message.
- Empty states shall include a next action.
- Error states shall include a retry, refresh, or clear next step where available.
- Source states shall use plain labels:
  - `Verified live`
  - `Checking source`
  - `Using saved data`
  - `No saved data`
  - `Source unavailable`
- Disabled actions shall show the reason beside or immediately below the action.

## Release Gate

A page is SMART-parity ready only when:

- no global browser scrollbar is introduced;
- no horizontal page overflow is introduced;
- no visible text overlaps;
- first useful content is visible in the first viewport;
- one primary action is obvious;
- Help is discoverable;
- empty/error/disabled states are actionable;
- mobile portrait and landscape are intentionally usable;
- the page still preserves ATLAS source-of-truth and lifecycle rules.
