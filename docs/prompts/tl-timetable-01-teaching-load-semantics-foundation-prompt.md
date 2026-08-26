# Prompt 1: Teaching Load Semantics Foundation

## Mission

Fix Teaching Load semantics so `/teaching-load`, `/teachers`, and future timetable repair tools all speak the same workload language.

This prompt must clarify actual teaching hours, advisory/ancillary credit, credited workload, standard load, and cap state without adding a digital overload approval workflow.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/*`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/*`

## Product Decisions

- Advisory and ancillary credits count toward both the 30-hour standard and the 40-hour cap.
- They must be visually distinct from actual teaching time.
- The UI must say `Above standard - approval needed` for loads above 30h and at or below 40h.
- Do not store or model digital approval state.
- Exactly 30 credited hours is `At standard`, not an overload warning.

## Scope

In scope:

- Teaching Load workload helper logic.
- Teaching Load status labels and stacked load visual.
- Teachers page load/readiness labels that mirror Teaching Load semantics.
- Focused tests for workload interpretation.
- Evidence-log and source-map updates if visible behavior changes.

Out of scope:

- Timetable Tactical Dock.
- Backend assignment algorithms.
- Digital approval workflow.
- Server pagination.
- Full Teaching Load layout redesign.

## Mandatory Outcomes

### 1. Normalize workload status logic

Implement or correct a shared interpretation so these cases are unambiguous:

- `25 teaching + 5 credit = 30 credited`: `At standard`.
- `30 teaching + 0 credit = 30 credited`: `At standard`.
- `35 teaching + 5 credit = 40 credited`: `Above standard - approval needed`, but still at cap.
- `36 teaching + 5 credit = 41 credited`: `Over cap - must fix`.

Use labels:

- `Teaching hours`
- `Advisory/ancillary credit`
- `Credited workload`
- `To standard`
- `To cap`
- `At standard`
- `Above standard - approval needed`
- `Over cap - must fix`

### 2. Add stacked credited-workload presentation

Add a compact stacked load bar where workload is displayed:

- teaching time segment: primary/blue or token-appropriate operational color
- advisory/ancillary credit segment: neutral gray/slate segment
- markers or labels for 30h standard and 40h cap
- accessible text equivalent describing the same values

Avoid one-color overload bars that hide how much is actual teaching versus credit.

### 3. Align `/teachers` with Teaching Load wording

Teachers rows and profile/detail surfaces should use the same terms as Teaching Load.

Keep the `Review teaching load` action.

Do not make `/teachers` the full load editor.

### 4. Preserve no-scroll and file-size guardrails

Do not expand the Teaching Load page vertically with a new always-open explanation block. Put detailed arithmetic in `Popover`, `HoverCard`, or a compact disclosure using project primitives.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- targeted helper/unit checks where an existing test framework supports it, or add focused tests for the helper logic if tests already exist nearby
- line-count check for touched React files
- literal scan of touched files for lowercase native `<button`, lowercase native `<select`, `<details`, and `title=`

Browser/Tailnet smoke if the dev surface is available:

- `/teaching-load`: verify stacked load bar, exact-30 state, above-standard state, and over-cap state if fixture data exists
- `/teachers`: verify row/profile wording aligns with Teaching Load

Self-correction requirement:

- If build, helper checks, primitive scan, or smoke checks fail, fix the issue in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- workload cases verified
- copy changes made
- screenshots or browser-smoke notes
- build/test results
- evidence-log update summary
- prompt-scope `GO` or `NO-GO`