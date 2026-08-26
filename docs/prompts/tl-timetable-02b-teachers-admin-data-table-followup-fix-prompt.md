# Prompt 2b: Teachers AdminDataTable Follow-Up Fix

## Mission

Repair the concrete regressions found in the implemented Prompt 1 and Prompt 2 work on `/teachers` and its handoff into `/teaching-load`.

This is a narrow correction pass. Do not redesign the Teachers page again. Do not reopen broader Teaching Load or admin-table architecture unless required to fix the verified defects below.

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
- `docs/prompts/tl-timetable-01-teaching-load-semantics-foundation-prompt.md`
- `docs/prompts/tl-timetable-02-teachers-admin-data-table-pilot-prompt.md`

Inspect before editing:

- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`
- `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`
- any shared helper already used for faculty load semantics

## Verified Defects To Treat As Real

### 1. Teachers -> Teaching Load handoff is broken

Current implemented state:

- `/teachers` primary action links to `/teaching-load?teacherId=...`
- `Teaching Load` still reads `facultyId`

Result:

- `Review teaching load` does not open the selected teacher context correctly

### 2. Load-state sorting is semantically wrong

Current implemented state:

- the `Load State` column exists
- but sorting still uses only `isActiveForScheduling`

Result:

- clicking the load-state header does not sort by the Prompt 1 readiness semantics
- schedulers do not get meaningful ordering such as:
  - `Over cap - must fix`
  - `Above standard - approval needed`
  - `At standard`
  - `Below standard`
  - `No teaching load`
  - `Excluded`

### 3. Approval-review stats collapse two different states

Current implemented state:

- the visible stat counts all active teachers with `policyCreditedHours > 30`
- help text says this includes both above-standard and over-cap teachers

Result:

- Prompt 1's distinction between:
  - `Above standard - approval needed`
  - `Over cap - must fix`

is weakened in the highest-level Teachers summary

## Scope

In scope:

- `/teachers` handoff correctness
- `/teachers` load-state sorting correctness
- `/teachers` summary-stat semantics for approval-needed vs over-cap
- any tiny compatibility adjustment in `Teaching Load` query-param handling if required
- evidence-log update

Out of scope:

- broader Teachers redesign
- backend API changes
- general Teaching Load workflow redesign
- broader AdminDataTable changes beyond what is needed for this repair
- new dashboard or audit work

## Product Decisions

- Existing `facultyId` query-param behavior in `Teaching Load` is the authoritative contract unless you deliberately add backward-compatible support for both keys.
- Load-state sorting must reflect actual scheduler meaning, not merely active/excluded membership.
- `Above standard - approval needed` and `Over cap - must fix` must not be visually or numerically conflated in the summary layer.
- Keep the Prompt 1 wording:
  - `At standard`
  - `Above standard - approval needed`
  - `Over cap - must fix`

## Mandatory Outcomes

### 1. Repair the primary Teachers -> Teaching Load action

Required outcome:

- `Review teaching load` must open the selected faculty row correctly in `/teaching-load`

Acceptable implementations:

- restore the `facultyId` query param from `/teachers`
- or make `Teaching Load` accept both `facultyId` and `teacherId` in a backward-compatible way

Do not leave the pilot with a broken primary row action.

### 2. Make Load State sorting actually reflect load state

Required outcome:

- clicking the `Load State` column must sort by meaningful workload readiness state rather than only `isActiveForScheduling`

The sort contract must distinguish at least:

- `Over cap - must fix`
- `Above standard - approval needed`
- `At standard`
- `Below standard`
- `No teaching load`
- `Excluded`

You may choose the exact ascending/descending order, but it must be intentional, stable, and explained in code clearly enough to maintain later.

### 3. Repair the top-level Teachers summary semantics

Required outcome:

- the high-level stats must stop collapsing approval-needed and over-cap into one misleading bucket

Acceptable directions:

- separate them into distinct visible stats
- or keep one stat only if the label and help text truthfully describe the mixed population

Preferred direction:

- keep `Approval review` for `>30h` and `<=40h`
- add a distinct urgent stat for `Over cap` / `Must fix`

Do not keep a stat that makes a cap breach read like routine approval review.

### 4. Preserve the valid Prompt 1 and Prompt 2 work

Required outcome:

- do not regress:
  - the new load wording
  - the `AdminDataTable` pattern
  - Teacher X visibility
  - search/filter behavior
  - mobile card fallback
  - existing profile sheet behavior unless needed for consistency with the repaired states

## Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- targeted route/query check for the `Review teaching load` handoff
- sort check for `Load State`
- summary-stat semantics smoke

Browser/Tailnet smoke:

- `/teachers`
- click `Review teaching load` from at least one row and confirm the selected teacher opens in `/teaching-load`
- click the `Load State` sort header and confirm the ordering changes according to real workload state
- confirm the top stat/banner no longer conflates approval-needed and over-cap

Self-correction requirement:

- If build or smoke fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- what was fixed for the handoff regression
- how load-state sort now works
- how approval-needed vs over-cap summary semantics now work
- build result
- Tailnet/browser smoke evidence
- prompt-scope `GO` or `NO-GO`
