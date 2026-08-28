# Prompt 05 — Coverage Drilldown Release Proof

## Role

You are the ATLAS release-proof verifier. Implement only verification fixes required to make Prompts 01-04 work as specified. Do not add new feature scope.

## Problem

The sequence is complete only if the end-to-end user journey is proven: Dashboard identifies teacher-coverage work, Teaching Load shows the exact missing subject-section rows, and Subjects audits the same truth at a glance.

## Target files

- `docs/verification/teaching-load-coverage-drilldown-release-proof-2026-08-22.md`
- Existing Playwright specs under `qa-artifacts/playwright/specs` if a focused reusable gate is added
- Source files only for concrete bug fixes found during verification
- `CHANGELOG.md` if implementation changes occurred in Prompts 01-04 and were not already logged

## Out of scope

- New feature design beyond Prompts 01-04.
- Live writes to Teaching Load unless explicitly required by an approved test fixture and safely reverted.
- Rerunning generation.
- Publish workflow changes.

## Verification commands

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

If focused tests were added in earlier prompts, run those explicitly and record exact command output.

## Tailnet journey proof

Target: `https://njgrm.buru-degree.ts.net`

Use the configured admin QA credentials.

Verify:

1. Dashboard loads with no app-critical console errors.
2. Dashboard teacher-coverage readiness uses subject-section coverage.
3. Dashboard CTA opens `/teaching-load?view=subjects&filter=missing-coverage` or the subject-specific equivalent.
4. Teaching Load opens with `Subjects` selected.
5. Missing coverage rows name the subject and uncovered sections.
6. A row action focuses the existing assignment workflow without accidental save.
7. `/subjects` shows `Full`, `Partial`, or `No coverage` based on subject-section coverage.
8. `/subjects` missing coverage filter returns only rows with uncovered sections.
9. The Subjects coverage drawer names uncovered sections and links back to Teaching Load subject mode.
10. Desktop `1366x768`, mobile portrait, and mobile landscape have no global horizontal overflow.

## Acceptance criteria

Prompt 05 is GO only if:

- the same coverage row source drives Dashboard, Teaching Load subject view, and Subjects coverage table;
- the operator can identify the missing subject and missing section from the UI;
- no feature claims coverage from weak subject-level assignment presence;
- static/build gates pass or failures are clearly identified as pre-existing and unrelated;
- Tailnet click-path proof is recorded in the verification report.

## Final report required

Write the verification report and include:

- GO/NO-GO verdict;
- files changed during release proof;
- exact command results;
- Tailnet URL paths tested;
- screenshots or text evidence summary;
- known pre-existing failures;
- remaining product risks.
