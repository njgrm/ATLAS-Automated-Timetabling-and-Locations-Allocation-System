# Prompt 5: Sandbox Draft Commit Path

## Mission

Persist valid Tactical Bottom Dock sandbox changes to the post-generation draft without regenerating the timetable.

Prompt 4 made the sandbox visual and local. This prompt turns valid sandbox experiments into safe draft manual repairs.

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
- `docs/prompts/tl-timetable-04-tactical-bottom-dock-live-sandbox-prompt.md`

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- Tactical Dock files from Prompt 4
- manual edit service/controller paths
- manual edit audit/history behavior
- timetable mutation hooks
- generation run latest draft endpoints

## Product Decisions

- In post-generation review state, `Commit Changes` saves the sandbox as draft manual repair.
- Commit must not regenerate the whole draft.
- Commit must preserve existing manual edits.
- Conflict blockers must stop commit with plain-language recovery copy.

## Scope

In scope:

- Commit action wiring from Tactical Dock.
- Draft manual repair persistence.
- Conflict validation and recovery messages.
- Timetable reload/update after commit.
- Audit/evidence record for the manual repair.

Out of scope:

- Published revision effective-date flow.
- Auto-regeneration.
- Full Teaching Load page changes.

## Mandatory Outcomes

### 1. Commit only in post-generation draft/review state

If the run is unpublished and editable:

- `Commit Changes` sends the sandboxed reassignment to the existing or new manual edit commit path
- update the displayed timetable after success
- clear sandbox dirty state after success

If the run is published:

- do not edit in place
- show that published repair requires revision workflow from Prompt 6

### 2. Preserve draft and manual edit history

The commit must:

- not call regenerate
- not discard existing manual edits
- record actor, changed entry, previous teacher, new teacher, and reason/context where available

### 3. Block invalid commits clearly

If commit would violate a hard constraint:

- stop the commit
- keep sandbox state visible
- show what failed, why it matters, and what the scheduler can do next

Do not use unexplained `hard conflict` as the only message.

### 4. Support same-subject bulk sandbox commit

If Prompt 4's subject-scoped bulk section selection is active:

- commit the selected same-subject changes as one reviewed batch when valid
- surface per-row failure information if part of the batch is blocked
- do not partially commit silently

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build` if backend touched
- `npm --prefix atlas-client run build`
- targeted service/API check for valid draft commit
- targeted service/API check for invalid conflict commit
- route probe for latest draft after commit
- line-count and primitive scans for touched React files

Browser/Tailnet smoke:

- select generated cell
- sandbox reassignment
- commit valid change
- reload latest draft and confirm persistence
- attempt invalid conflict and confirm blocked recovery copy
- confirm no full regeneration occurred

Self-correction requirement:

- If commit persistence, conflict blocking, build, or UI smoke fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- commit contract summary
- valid/invalid commit evidence
- no-regeneration proof
- build/route results
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`