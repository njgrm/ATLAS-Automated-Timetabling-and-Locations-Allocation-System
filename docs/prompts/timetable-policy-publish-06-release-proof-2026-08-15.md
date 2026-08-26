# Prompt 06 — Timetable Publish and Workbook Release Proof

## Role

You are the ATLAS release verification agent. Implement no product changes unless a concrete failure must be fixed to complete this prompt.

## Objective

Prove the timetable publish/readiness/export path works end to end and remains policy-driven.

## Scope

### In scope

- Full live Tailnet browser/API verification.
- Policy-driven 6:00 schedulability proof.
- Publish blocker proof.
- Export workbook/report-family proof.
- Regression gates.

### Out of scope

- New feature design.
- Large visual redesign.
- Production data migration.

## Required live verification

Against:

```text
https://njgrm.buru-degree.ts.net
```

Login:

```text
1000001 / AdminSY2026!
```

Verify:

1. Runtime context is aligned with EnrollPro active year.
2. Simple timetable shows Generate.
3. Simple timetable shows Publish when a generated run exists.
4. Blocked Publish explains exact hard blocker count.
5. Publish API rejects hard-violation runs with `PUBLISH_BLOCKED_HARD_VIOLATIONS`.
6. The timetable explains why `06:00` is not schedulable if grade windows block it.
7. A policy/grade-window fixture can make `06:00` schedulable without hard-coding.
8. Current run entries use display slots from policy/run summary.
9. Export workbook action is discoverable.
10. Exported workbook opens and contains:
    - school year label;
    - summary/class-monitoring sheet;
    - per-subject teacher sheets;
    - time rows from policy/run metadata;
    - no visible raw unknown IDs.
11. If class-program export is included, exported class-program output opens and contains:
    - `SECTION`, `ADVISER`, and `BLDG./RM.` bands;
    - paired teacher/subject rows;
    - configurable break labels such as `HEALTH BREAK`, `RECESS`, or `LUNCH BREAK`;
    - horizontal section grouping when needed;
    - no hard-coded reference-file times.

## Required commands

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Required final report

Return:

1. GO / NO-GO
2. Exact command results
3. Tailnet endpoint outputs:
   - runtime context;
   - latest run summary;
   - publish attempt;
   - policy;
   - grade windows;
   - export endpoint.
4. Browser screenshots/artifact paths
5. Workbook export proof
6. Remaining blockers
7. Explicit answer:
   - Can ATLAS recreate the reference workbook/report-family shape now?
   - Can ATLAS recreate the class-program reference shape now, or is it explicitly deferred?
   - Can ATLAS publish the current live timetable now?
   - If not, what exact setup/generation blockers remain?
