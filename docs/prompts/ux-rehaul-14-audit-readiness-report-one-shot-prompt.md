# UX Rehaul Prompt 14: Audit Readiness Report One-Shot

## Mission

Rebuild `/audit` as an operator readiness report.

The page must clearly explain what was checked, what blocks readiness, where to fix each issue, and whether the evidence is live or saved.

Do not touch `/timetable`.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect:

- `atlas-client/src/pages/Audit.tsx`
- any shared readiness/audit components if present

## Current UX Findings

- Live sampling showed `/audit` can appear nearly blank, with only shell labels and `Audit Audit` in the accessible snapshot before data appears.
- Browser console logged duplicate-key warnings for `Audit` children.
- Current labels like `Mismatches`, `Clashes`, `Sync Health`, and `Average Roster Load` need clearer operator framing.
- The page has a `Proceed to Generator` link to `/timetable/generate`; remove or replace this unless that route exists and is intentionally supported.
- The page should be a proof/report surface after setup pages are repaired, not another dense console.

## Scope

Allowed source files:

- `atlas-client/src/pages/Audit.tsx`
- new extracted audit components if needed to keep file size under 1000 lines
- docs/evidence files

Do not change backend audit APIs unless a tiny client-contract bug is impossible to solve otherwise.

Do not route users into `/timetable` generation work in this pass.

## Mandatory Outcomes

### 1. Robust Loading And No-Data States

The page must never look blank.

Show:

- `Checking readiness...` loading state
- what domains are being checked
- degraded/saved-data state when some endpoints fail
- no-data state with recovery actions

### 2. Clear Readiness Verdict

Show one primary verdict:

- `Ready for scheduling review`
- `Needs fixes before scheduling`
- `Cannot check readiness yet`

Use red/amber/emerald only for semantic status, not brand identity.

### 3. Action-Oriented Finding Groups

Rename/group findings around operator actions:

- `Fix teacher assignments`
- `Resolve section gaps`
- `Check rooms and facilities`
- `Review constraints`
- `Check saved/live data`

Each item must show:

- what is wrong
- why it matters
- where to fix it

### 4. Duplicate-Key Warning Fix

Fix duplicate React keys reported on `/audit`.

Validate by checking the browser console during QA.

### 5. Route Safety

Remove or replace links to nonexistent `/timetable/generate`.

If a readiness action should lead elsewhere, use existing routes only:

- `/sections`
- `/subjects`
- `/teachers`
- `/teaching-load`
- `/map`
- `/schedules`

Do not include `/timetable` links in this prompt unless absolutely necessary for context, because Timetable is out of scope.

### 6. Layout And Maintainability

Extract components if `Audit.tsx` approaches 1000 lines after changes.

Preserve no-scroll architecture and local scroll regions.

Avoid nested-card clutter.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/audit` desktop
- `/audit` mobile portrait
- degraded mode if reproducible
- console check for duplicate-key warnings

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-audit-loading-or-ready-after.png`
- `qa-artifacts/playwright/20260530-admin-audit-findings-after.png`
- `qa-artifacts/playwright/20260530-admin-audit-mobile-after.png`

## Required Output

Return files changed, readiness-verdict behavior, duplicate-key fix evidence, screenshots, build result, and `GO`/`NO-GO`.
