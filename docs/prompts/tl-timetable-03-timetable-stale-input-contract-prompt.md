# Prompt 3: Timetable Stale Input Contract

## Mission

Make post-run input drift visible and safe on `/timetable`.

ATLAS must mark generated runs stale when Teaching Load, policy, rooms, sections, or subject setup changes after generation. It must never auto-regenerate.

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

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-prisma-database` if persistence changes are needed
- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- timetable data hooks and workspace components
- generation run service/controller code
- scheduling policy save/update code
- faculty assignment save/update code
- room/section/subject mutation paths if they affect generation input truth
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Product Decisions

- Post-run input changes mark the run stale only.
- Never auto-regenerate.
- Show `Input changes detected` with `Preview Impact`, `Manually Repair`, and `Regenerate Draft`.
- Generated and published schedules remain immutable unless the user explicitly chooses a controlled repair/revision action.

## Scope

In scope:

- Input fingerprint/version derivation or persisted metadata for generated runs.
- Stale-state comparison for `/timetable`.
- Stale banner UI and actions.
- Documentation/evidence updates.

Out of scope:

- Tactical Bottom Dock implementation.
- Draft commit logic.
- Published revision workflow.
- Full generator rewrite.

## Mandatory Outcomes

### 1. Define generation input snapshot contract

Track or derive enough metadata to compare a run against current inputs:

- Teaching Load/assignment state
- scheduling policy state
- room inventory relevant to generation
- section setup/home-room state
- subject setup/active catalog state

Prefer a lightweight version/fingerprint over reading or cloning large JSON payloads.

### 2. Compare current inputs with active run

Expose a clear stale state to `/timetable`:

- current run is fresh
- current run has changed inputs
- current run cannot be compared because required metadata is missing

Do not block page load if comparison fails; show an honest source-state message.

### 3. Add stale banner and actions

When stale:

- show `Input changes detected`
- explain: `Teaching load, policy, rooms, sections, or subjects changed after this draft was generated.`
- show actions: `Preview Impact`, `Manually Repair`, `Regenerate Draft`
- make `Regenerate Draft` explicit and destructive

Use plain language. Avoid leading with `fingerprint`, `hash`, or internal IDs in primary copy.

### 4. Preserve manual edits

Do not regenerate or discard manual edits automatically.

The only acceptable automatic behavior is marking the current run out-of-sync.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build` if backend touched
- `npm --prefix atlas-client run build`
- targeted API/service checks showing unchanged inputs are fresh and changed inputs are stale
- exact touched route probes where feasible
- line-count and primitive scans for touched React files

Browser/Tailnet smoke:

- `/timetable` with fresh run state
- `/timetable` after a safe input change that should mark stale
- confirm no auto-regeneration occurs

Self-correction requirement:

- If stale comparison, build, route probe, or UI smoke fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- input snapshot contract summary
- stale/fresh verification evidence
- UI copy/actions added
- build and route results
- source-map/evidence-log updates
- prompt-scope `GO` or `NO-GO`