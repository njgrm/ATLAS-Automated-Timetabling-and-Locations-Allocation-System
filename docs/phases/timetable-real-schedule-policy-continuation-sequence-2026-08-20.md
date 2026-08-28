# Timetable Real Schedule Policy Continuation Sequence — 2026-08-20

## Purpose

This sequence continues the real 2026-2027 schedule-shape work after Prompt 01, Prompt 02, and Prompt 02C.

The current objective is to make ATLAS recreate the real school schedule family as closely as possible through configurable in-system policy, not hard-coded workbook or DOCX constants.

## Current verified baseline

As of the latest verification:

- Grade shift windows support the real baseline:
  - GR7 and GR8: `06:00-15:30`
  - GR9 and GR10: `09:45-18:30`
- Policy bounds support the real school day:
  - earliest start: `06:00`
  - latest end: `18:30`
- Special events are policy-owned:
  - GR7/GR8 health break: `09:00-09:15`
  - GR7/GR8 lunch: `12:15-13:00`
  - GR9/GR10 lunch: `12:15-13:00`
  - GR9/GR10 health break: `15:15-15:30`
- Prompt 02 Fix verified that `buildTimetableShapeContract()` applies special events per grade/program.
- Prompt 02C verified that special-event resolution returns one highest-priority row per event type and that PostgreSQL-safe partial unique indexes replace nullable uniqueness.

## Reference files

Use these as output and policy-pattern references only:

- `D:\ATLAS\stakeholderFiles\root-reference\SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx`
- `D:\ATLAS\stakeholderFiles\root-reference\aral-prog_G7_Class-Program_SY2026-2027docx.docx`
- `D:\ATLAS\stakeholderFiles\root-reference\40-minutes.xlsx`
- `docs/analysis/timetable-reference-schedule-files-audit-2026-08-15.md`
- `docs/reference/timetable-workbook-output-contract-2026-08-15.md`

Do not treat any of these files as hard-coded scheduling truth.

## Sequence

Execute in order:

1. `docs/prompts/timetable-real-schedule-policy-03-program-normalization-and-policy-ui-2026-08-20.md`
2. `docs/prompts/timetable-real-schedule-policy-04-generation-and-publish-proof-2026-08-20.md`
3. `docs/prompts/timetable-real-schedule-policy-05-workbook-export-parity-proof-2026-08-20.md`
4. `docs/prompts/timetable-real-schedule-policy-06-release-proof-2026-08-20.md`

## Gates between prompts

Do not proceed to the next prompt until the current prompt returns:

- GO / NO-GO;
- exact files changed;
- exact commands run;
- proof that no schedule time, grade shift, break, lunch, or workbook cell shape was hard-coded from the reference files;
- API/browser evidence where requested;
- remaining caveats with owner and next action.

## Non-negotiable constraints

- Simple timetable remains the default scheduler experience.
- Advanced view remains available but secondary.
- Schedulers must be able to change school policy later without code changes.
- Grade labels use `GR7`, `GR8`, `GR9`, and `GR10`, not `G7`.
- No global browser scrollbar.
- No horizontal overflow.
- No visible text overlap.
- No raw native `<select>` or raw styled `<button>` in new/changed UI.
- No hard-coded 2026-2027 workbook times in generation, timetable display, or export.
- No change to EnrollPro ownership, Teaching Load ownership, publish gates, or AIMS published endpoint contracts unless explicitly scoped.

## Required recurring commands

Run after each implementation prompt that changes source:

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

Run relevant targeted tests added by each prompt.

## Release target

This continuation is complete when:

- policy/program scope normalization is stable;
- real shift and special-event policy is visible and editable without technical confusion;
- generation uses the real schedule baseline without hard-coded times;
- publish blockers remain understandable in Simple mode;
- workbook export reflects policy-derived shift rows, breaks, lunch, section/adviser/room bands, teacher rows, subject rows, and empty cells;
- all proof commands pass.
