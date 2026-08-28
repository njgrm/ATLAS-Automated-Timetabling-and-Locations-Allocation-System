# Prompt 07 — Workbook Export and Publish-State Correction

## Context

Prompts 01–06 were reported as complete, but QA found a concrete release blocker in the workbook export implementation.

The export endpoints return `.xlsx` files, and the regular UI/function tests pass, but the downloaded workbooks do not contain real timetable class data. This means Prompt 05 and Prompt 06 are not actually complete.

Live Tailnet target:

```text
https://njgrm.buru-degree.ts.net
```

Current published test run observed during QA:

- School year: `5` / `2026-2027`
- Run: `425`
- Run status: `COMPLETED`
- Published summary flag: `summary.isPublished=true`
- Assigned entries: `830`
- Draft unassigned items still present: `95`
- Public published entries: `830`
- Public entries with no faculty ID: `200`

This is acceptable only as dummy AIMS connectivity data. It must not be described as a fully assigned production-quality schedule.

## QA Evidence

Downloaded files:

```text
D:\ATLAS\qa-artifacts\export-review-2026-08-16\summary-teacher-schedule-run-425.xlsx
D:\ATLAS\qa-artifacts\export-review-2026-08-16\class-program-run-425.xlsx
```

Workbook inspection found:

- `summary-teacher-schedule-run-425.xlsx`
  - Sheets: `SUMMARY`
  - No teacher-name hits
  - No subject-name hits
  - No `BLDG./RM.` row
  - No `RECESS`, `LUNCH BREAK`, or `FLAG CEREMONY`
  - Only section headers and time labels are meaningfully populated
- `class-program-run-425.xlsx`
  - Sheets: `CLASS PROGRAM`
  - No teacher-name hits
  - No subject-name hits
  - No `BLDG./RM.` row
  - No `RECESS`, `LUNCH BREAK`, or `FLAG CEREMONY`
  - Only section headers and time labels are meaningfully populated

Root cause confirmed from source:

- `ScheduledEntry.sectionId` uses the EnrollPro/external section ID.
- `SectionMirror.id` is the ATLAS mirror row primary key.
- `workbook-export.service.ts` selects `SectionMirror.id` and then looks up entries by `sec.id`, so no entry cells match.
- `SectionMirror.externalId` is the correct key for timetable entry matching.
- The export service filters special-event slots out of the row loop, so break/lunch/flag ceremony rows are not emitted.

## Required Fixes

### 1. Fix section identity resolution

- Use `SectionMirror.externalId` as the timetable-facing section key.
- Keep `SectionMirror.id` only for internal mirror-row operations where needed.
- Update adviser resolution so `FacultyMirror.advisedSectionId` is compared against the same external section ID space.
- Add a regression test that fails if a workbook has section headers but zero populated class cells.

### 2. Fix workbook content completeness

The export must populate visible schedule cells from generated run entries:

- subject/activity label;
- teacher label, including a clear placeholder label where the generated entry has no real teacher;
- section label;
- room/building label where available;
- time/day labels;
- special event rows from `summary.timetableDisplaySlots`.

Special events must be included as rows:

- `FLAG CEREMONY`;
- `RECESS` or `HEALTH BREAK`;
- `LUNCH BREAK`;
- any other policy-defined special event label.

Do not hard-code school-specific times. Use in-system Scheduling Policy, Grade Shift Windows, and the run summary display slots.

### 3. Complete the workbook output contract

Re-check `docs/reference/timetable-workbook-output-contract-2026-08-15.md` and the reference workbook:

```text
D:\ATLAS\SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx
```

The export must support the intended output family:

- summary / section matrix workbook;
- class-program workbook;
- per-subject teacher schedule sheets if required by the contract.

If any part is intentionally deferred, explicitly update the contract and release proof with `NO-GO for full workbook parity` instead of silently claiming completion.

### 4. Add workbook-content tests, not only endpoint tests

Add automated coverage that downloads or generates the workbook and inspects the workbook contents.

Minimum assertions:

- workbook opens as valid `.xlsx`;
- expected worksheet names exist;
- at least one known subject code/name from run `425` appears;
- at least one known teacher name from run `425` appears when the run has assigned faculty;
- at least one visible room/building label appears if rooms are present in entries;
- `RECESS`/`HEALTH BREAK`, `LUNCH BREAK`, and `FLAG CEREMONY` appear when present in `timetableDisplaySlots`;
- class cells are not blank when the public published schedule has entries;
- raw `Unknown Subject (#id)`, `Unknown Section (#id)`, `Unknown Faculty (#id)` labels do not appear on the main export surface;
- downloaded workbook data matches a representative sample from `/api/v1/schools/1/schedules/published`.

### 5. Align Simple publish state with backend truth

Review the Simple header publish logic.

Current concern:

- `TimetableSimpleHeader.tsx` computes publish blocking from `hardCount > 0 || summary.unassignedCount > 0`.
- Backend/public state has run `425` published with `hardViolationCount=0` but `summary.unassignedCount=95`.
- This creates a likely UI/backend mismatch: the UI can imply publish is blocked even when the backend considers the run published.

Choose one rule and enforce it consistently:

#### Preferred for current dummy AIMS testing

- If `summary.isPublished=true`, Simple mode shall show `Published` / `Published with follow-up items`, not a blocked `Publish` path.
- If a run has zero hard violations but unresolved follow-up items, the UI shall explain: `This test schedule is published, but 95 follow-up items still need review.`
- Export and public endpoint copy shall clearly label placeholder/unassigned faculty rather than hiding them.

#### If product decides unassigned items must block publish

- Backend publish must reject such runs.
- Run `425` should not be considered publish-ready.
- The release proof must be corrected to `NO-GO`.

Do not leave UI and backend semantics divergent.

### 6. Correct release evidence wording

Update release proof/evidence logs so they do not claim:

- `0 unassigned` when `summary.unassignedCount` or draft unassigned items remain;
- full workbook parity when workbook cells are blank;
- production schedule quality when dummy placeholder/unassigned faculty rows remain.

For AIMS dummy validation, acceptable wording is:

```text
Run 425 is published for connectivity testing with 830 public entries and zero hard violations. It still contains dummy/follow-up scheduling data, including placeholder or unassigned faculty entries, and is not production-quality scheduling evidence.
```

## Required Verification

Run these local gates:

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

Run the current timetable browser gates:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-current-full-function-matrix.spec.ts timetable-feedback-readiness.spec.ts --workers=1
```

Add and run a workbook export proof, for example:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-workbook-export-content.spec.ts --workers=1 --project=desktop
```

Also run direct Tailnet probes:

- `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`
- `GET /api/v1/generation/1/5/runs/425`
- `GET /api/v1/generation/1/5/runs/425/draft`
- `GET /api/v1/generation/1/5/runs/425/violations`
- `GET /api/v1/schools/1/schedules/published`
- both export endpoints for run `425`

## Acceptance Criteria

- Exported workbook cells contain actual subjects and teachers from run entries.
- Exported workbooks include policy-defined break/lunch/flag rows.
- Section matching uses `SectionMirror.externalId`, not `SectionMirror.id`.
- Export verification fails on blank workbook cells.
- Simple publish UI matches backend publish semantics.
- Evidence logs describe run `425` accurately as dummy connectivity data with remaining follow-up/unassigned items.
- No timetable placement/swap/publish browser regression appears.

## Suggested Commit Message

```text
fix(timetable): correct workbook export data binding and publish state

Populate workbook exports from timetable entry external section IDs, include policy-defined special-event rows, and align Simple publish messaging with backend published-run truth.
```
