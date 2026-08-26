# Prompt 03 — Program Normalization and Policy UI Hardening

## Role

You are the ATLAS policy UX and backend-contract executor. Implement only this prompt after Prompt 02C is GO.

## Context

Prompt 02C hardened special-event precedence and uniqueness. One minor non-blocking caveat remains:

`programType` matching is case-insensitive during resolution, but write paths do not clearly canonicalize casing or trim whitespace. This can produce confusing duplicates or inconsistent labels if schedulers configure program-specific events manually.

This prompt closes that caveat and makes the policy UI understandable to scheduler officers.

## Objective

Normalize program-specific policy scope on write and make shift/special-event policy controls clear, compact, and safe for non-technical schedulers.

## Scope

### In scope

- Canonicalize `programType` for policy special events.
- Preserve `REGULAR`, empty, and null as the default/non-special program scope.
- Ensure special program scopes such as `STE`, `SPA`, and `SPS` are stored consistently.
- Make Scheduling Policy UI explain grade shifts and special events in plain language.
- Make disabled policy actions show visible reasons.
- Add tests proving normalization does not break Prompt 02C precedence.

### Out of scope

- Redesigning the full policy pane.
- Adding new special-event types.
- Changing generation algorithm truth.
- Changing Teaching Load, EnrollPro, AIMS, or publish contracts.
- Hard-coding workbook/DOCX times.

## Required behavior

- When a special event is saved with `programType=" ste "`, the system shall store and return `STE`.
- When a special event is saved with `programType=""`, `programType="REGULAR"`, or no program type, the system shall store `null`.
- When a special event is saved with mixed-case program text, the system shall resolve it the same way in `getEffectiveEvents()`.
- If a duplicate effective scope is attempted with different casing or whitespace, then the system shall update the existing row or reject the duplicate cleanly instead of creating a second effective row.
- The policy UI shall label the default scope as `Regular / all standard sections`.
- The policy UI shall label special scopes in plain text, for example `STE sections only`.
- The policy UI shall explain that GR7/GR8 and GR9/GR10 can have different break/lunch rows.
- The policy UI shall avoid a large persistent warning banner for normal hidden-row behavior.

## UX constraints

- Use existing `@/ui/*` primitives.
- Do not use native `<select>`.
- Do not use raw styled buttons.
- Keep the policy section compact; use popovers, tooltips, or sheets for explanatory text.
- Keep long explanations out of the default header.
- Use `GR7`, `GR8`, `GR9`, and `GR10` labels.

## Required tests

Add or update backend tests proving:

- `programType=" ste "` stores/resolves as `STE`.
- `programType="regular"`, empty string, and missing value store/resolve as default scope.
- Duplicate effective scope with case/whitespace differences does not create duplicate rows.
- `getEffectiveEvents()` still chooses shift+program over shift default.
- `getEffectiveEvents()` still falls back to shift default when no program override exists.
- Baseline GR7/GR8 and GR9/GR10 events remain unchanged.

Add or update frontend/guardrail tests proving:

- Policy UI does not show raw program-scope jargon without explanation.
- Policy UI uses `GR` labels, not `G` labels.
- No native select or raw button is introduced in changed policy UI.

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
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Program normalization behavior before/after
4. Proof that duplicate effective scopes are prevented
5. Policy UI screenshots or browser evidence if UI changed
6. Exact commands and results
7. Remaining caveats

## Acceptance criteria

Prompt 03 is GO only if:

- program-type casing/whitespace cannot create duplicate effective policy rows;
- regular/default scope is consistently represented as `null`;
- policy UI remains compact and non-technical;
- Prompt 02C special-event precedence still passes;
- no generation or timetable regression appears.

