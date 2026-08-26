# Prompt 6c: Timetable Revision UI Workflow

## Mission

Connect the Tactical Bottom Dock to the published revision workflow.

When a schedule is already published, committing sandbox changes must create a revision flow with an effective date instead of editing the published schedule in place.

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
- `docs/prompts/tl-timetable-06a-published-revision-data-model-audit-contract-prompt.md`
- `docs/prompts/tl-timetable-06b-effective-date-read-resolution-prompt.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`
- `atlas-express-api` if commit endpoint wiring is touched

Inspect before editing:

- Tactical Bottom Dock implementation
- timetable publish/review state detection
- revision services/endpoints from 6a/6b
- manual edit commit UI
- timetable dialogs/drawers

## Product Decisions

- In post-publish state, `Commit Changes` opens revision workflow.
- Effective date is required.
- Old published schedule remains historically readable.
- Above-standard load copy says `Above standard - approval needed`; do not add approval state.

## Scope

In scope:

- Revision Drawer/Dialog launched from Tactical Dock commit.
- Effective-date input and validation.
- Revision reason field.
- Summary of changed entries and before/after teacher/room/slot where applicable.
- API call to revision creation contract.
- Success and error states.

Out of scope:

- New digital approval workflow.
- Date-aware read resolver changes. Those belong to Prompt 6b.
- Notifications unless an existing publish/revision hook requires a minimal event.

## Mandatory Outcomes

### 1. Published-state branch

If the selected schedule/run is published:

- sandbox commit must not call draft manual-edit commit
- it must open the revision workflow
- primary copy must explain that published history will be preserved

### 2. Revision review flow

The flow must show:

- changed class/session summary
- previous teacher/room/slot
- new teacher/room/slot
- effective date input
- reason input
- any above-standard load warning using Prompt 1 wording

Use a named overlay with accessible title and description.

### 3. Commit revision

On valid submit:

- call the revision creation contract
- show success state with effective date
- refresh timetable/revision state
- do not mutate historical display in place unless viewing current/effective date requires it

### 4. Validation and recovery

Block submit when:

- effective date is missing
- effective date is invalid per backend contract
- revision creation fails

Show what happened, why it matters, and what to do next.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run build` if backend wiring touched
- line-count and primitive scans for touched React files
- browser/Tailnet smoke for post-publish sandbox commit path
- route/API check confirming revision record is created

Self-correction requirement:

- If build, validation, revision creation, or UI smoke fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- revision UI flow summary
- effective-date validation evidence
- revision creation evidence
- historical truth note referencing Prompt 6b behavior
- build/browser results
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`