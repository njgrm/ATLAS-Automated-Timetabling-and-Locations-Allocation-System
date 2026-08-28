# Prompt 06 — Real Schedule Policy Release Proof

## Role

You are the ATLAS release-proof executor. Implement only this prompt after Prompt 05 is GO.

## Objective

Prove the full real schedule policy sequence is stable enough to proceed: policy configuration, generation, Simple timetable UX, publish readiness, and workbook export.

## Scope

### In scope

- Full local/static gates.
- Targeted backend tests for grade windows and special events.
- Timetable browser smoke and feedback tests.
- Workbook export tests.
- Documentation/evidence log updates.
- Final GO / NO-GO report.

### Out of scope

- New feature development.
- Broad UX redesign.
- Teaching Load redesign.
- EnrollPro or AIMS contract changes.
- Official DOCX generation.

## Required proof matrix

Verify:

1. Policy baseline:
   - earliest start `06:00`;
   - latest end `18:30`;
   - GR7/GR8 `06:00-15:30`;
   - GR9/GR10 `09:45-18:30`.

2. Special events:
   - GR7/GR8 receive only day-shift events;
   - GR9/GR10 receive only afternoon-shift events;
   - program-specific overrides do not duplicate default events;
   - duplicate effective scopes are blocked.

3. Timetable Simple mode:
   - scheduler can see current publish status;
   - blockers are understandable;
   - schedule switching still works;
   - hidden-row chip and Show full day behavior remain correct;
   - no large policy warning banner returns.

4. Generation/publish:
   - generation uses policy windows;
   - publish remains blocked when hard blockers exist;
   - publish is visible and usable when hard blockers are zero;
   - warning acknowledgment behavior remains unchanged.

5. Export:
   - workbook export uses policy/run display slots;
   - special-event labels appear;
   - section/adviser/room bands appear;
   - no raw unknown IDs appear on normal export surfaces.

## Required commands

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
node scripts/verify-grade-windows.mjs
npx tsx src/__tests__/policy-special-event.test.ts
npx tsx src/__tests__/schedule-constructor-shift-events.test.ts
npm run test:workbook-export

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-hidden-row-chip-regression.spec.ts --workers=1
```

If any listed script does not exist, report it as a verification gap and add the smallest targeted equivalent test instead.

## Evidence updates

Append results to:

```text
docs/verification/evidence-log.md
```

Update `CHANGELOG.md` with:

- policy baseline verification;
- special-event scope hardening;
- workbook export proof;
- remaining caveats.

## Report format

Return:

1. GO / NO-GO
2. Full command table
3. Browser test table
4. Policy/grade-window endpoint proof
5. Special-event proof
6. Export proof
7. Evidence-log entry path
8. Remaining blockers or non-blocking backlog

## Acceptance criteria

Prompt 06 is GO only if:

- all required gates pass or have explicitly justified replacements;
- evidence log is updated;
- no hard-coded workbook/DOCX schedule constants are introduced;
- no timetable Simple-mode regression appears;
- the final report clearly states whether Prompt 03 onward can be considered release-ready.

