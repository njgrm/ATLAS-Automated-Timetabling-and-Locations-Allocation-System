# Prompt 04 — Real Shift Generation and Publish Proof

## Role

You are the ATLAS generation and publish-readiness verifier. Implement only this prompt after Prompt 03 is GO.

## Context

ATLAS now has configurable grade shift windows and special events matching the observed 2026-2027 schedule pattern:

- GR7/GR8 day shift: `06:00-15:30`
- GR9/GR10 afternoon shift: `09:45-18:30`
- GR7/GR8 health break: `09:00-09:15`
- GR7/GR8 lunch: `12:15-13:00`
- GR9/GR10 lunch: `12:15-13:00`
- GR9/GR10 health break: `15:15-15:30`

The system must prove that generation and publish-readiness use these policy settings and do not rely on hard-coded workbook values.

## Objective

Generate or validate a timetable using the real shift baseline, prove classes can be scheduled into early/late policy windows where allowed, and keep Simple-mode publish blocker guidance understandable.

## Scope

### In scope

- Backend generation proof for the active school year.
- Candidate-slot proof for `06:00` GR7/GR8 slots.
- Candidate-slot proof for late GR9/GR10 afternoon slots through `18:30`.
- Special-event block proof.
- Simple-mode publish readiness proof.
- Publish attempt proof when hard blockers exist or publish proof when zero hard blockers exist.

### Out of scope

- Manual destructive policy changes without cleanup.
- Changing Teaching Load ownership.
- Changing AIMS endpoint contracts.
- Changing published schedule revision logic.
- Hard-coding real school times outside policy/shift/special-event configuration.

## Required behavior

- The generator shall allow GR7/GR8 candidate slots at `06:00` when policy and grade windows allow them.
- The generator shall allow GR9/GR10 candidate slots after `17:00` when policy and grade windows allow them.
- The generator shall block candidate slots that overlap configured special events.
- The timetable grid shall display shift-specific special events only for the selected grade/program context.
- If publish is blocked, Simple mode shall explain the blocker groups in plain language within one interaction.
- If publish is allowed, Simple mode shall expose a visible publish action.
- Every disabled publish action shall show why it is disabled and what to do next.

## Required tests

Add or update backend tests proving:

- GR7/GR8 can produce schedulable candidates at `06:00`.
- GR9/GR10 can produce schedulable candidates after `17:00` up to the configured policy end.
- Special events block only the grade/program they apply to.
- Display slots and schedulable slots remain distinct.

Add or update Playwright tests proving:

- Simple timetable shows shift-specific events correctly in Section view.
- Switching Section/Teacher/Room does not show wrong-shift events.
- Publish blocker sheet explains unresolved/blocker/warning counts in plain language.
- No old large policy warning banner returns.
- No hidden-row chip click regression returns.

## Tailnet/browser target

Use:

```text
https://njgrm.buru-degree.ts.net
```

Use current QA login rules from `ATLAS_AGENT_KI.md`.

## Verification commands

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/policy-special-event.test.ts
npx tsx src/__tests__/schedule-constructor-shift-events.test.ts

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Active policy and grade-window values used
4. Generated run or candidate-slot proof
5. Publish-readiness proof
6. Browser evidence
7. Exact commands and results
8. Remaining caveats

## Acceptance criteria

Prompt 04 is GO only if:

- real shift baseline affects generation/candidates;
- wrong-shift events do not appear in selected section context;
- Simple mode clearly explains publish status;
- no large warning/banner regression appears;
- all tests pass.

