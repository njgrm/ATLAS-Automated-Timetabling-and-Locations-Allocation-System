# Prompt 5b: Sandbox Draft Commit Closure

## Mission

Close the remaining Prompt 5 gaps for `/timetable` sandbox draft commit persistence.

Prompt 5 landed source and route wiring, but it is not fully closed yet. This pass must repair the remaining contract issues and capture the missing live proof so the sandbox commit path can be promoted from conditional implementation to real `GO`.

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
- `docs/prompts/tl-timetable-05-sandbox-draft-commit-path-prompt.md`
- latest Prompt 5 evidence entry in `docs/verification/evidence-log.md`

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-server/src/services/manual-edit.service.ts`
- `atlas-server/src/routes/manual-edit.router.ts`
- any touched schedule review context files from Prompt 5

## Verified Defects To Treat As Real

### 1. Soft-warning saves are auto-approved

Current implemented state:

- backend correctly blocks soft-warning commits unless `allowSoftOverride=true`
- dock commit path automatically sends soft override after preview detects soft warnings

Result:

- the operator never performs a distinct acknowledgement step
- the save contract is too permissive

### 2. Published-run copy points to the wrong next action

Current implemented state:

- published-run guard blocks in-place sandbox edits
- but current copy says to create a new review run

Result:

- this conflicts with the intended Prompt 6 revision model
- the user is pointed at the wrong mental model

### 3. Full live valid/invalid commit proof is still missing

Current implemented state:

- builds passed
- route mount smoke passed
- but authenticated valid commit proof, invalid hard-conflict proof, latest-draft-after-commit proof, and real Tailnet browser persistence smoke are still missing

Result:

- Prompt 5 is still only conditional

## Scope

In scope:

- explicit soft-warning acknowledgement step for sandbox batch saves
- published-run blocked copy/path correction
- authenticated Tailnet valid/invalid commit proof
- route/latest-draft proof after commit
- evidence-log update

Out of scope:

- published revision workflow implementation
- new sandbox architecture
- broad timetable redesign
- generation algorithm changes
- full Prompt 6 work

## Product Decisions

- Soft warnings may still be overridable, but only after an explicit operator acknowledgement step.
- Hard conflicts remain non-overridable.
- Published runs must remain read-only in Prompt 5/5b.
- Published-run blocked copy must point forward to revision workflow, not imply normal draft editing.
- Prompt 5 is not `GO` until both source behavior and live authenticated proof are captured.

## Mandatory Outcomes

### 1. Require explicit soft-warning acknowledgement

Required outcome:

- if review finds soft warnings and no hard conflicts, the user must complete a clear acknowledgement step before save is allowed

Acceptable directions:

- a confirmation dialog
- a required checkbox gate
- a named explicit secondary confirmation action

The acknowledgement must:

- state that soft warnings remain
- explain that the save will proceed anyway
- require a deliberate user action

Do not auto-submit `allowSoftOverride=true` merely because preview returned soft warnings.

### 2. Preserve hard-block behavior

Required outcome:

- if hard conflicts remain, the sandbox stays visible
- save remains blocked
- recovery copy stays plain-language

Do not weaken the hard-block rule while fixing soft-warning acknowledgement.

### 3. Correct published-run blocked copy

Required outcome:

- when a run is already published, the dock and error handling must say that published repairs require the revision workflow from Prompt 6

Do not tell the user to create a generic new review run if the intended model is revision-based published repair.

### 4. Capture authenticated live commit proof

Required outcome:

- prove one valid sandbox batch save on Tailnet or equivalent live authenticated runtime
- prove one invalid hard-conflict save attempt is blocked
- prove the latest draft reflects the saved valid change afterward
- prove no generation/regenerate endpoint was called during the commit flow

At minimum, capture:

- authenticated route call or browser-network evidence for valid batch preview + commit
- authenticated route call or browser-network evidence for invalid blocked batch commit
- latest draft read after valid commit
- browser/Tailnet smoke showing the dock reflects success and conflict blocking honestly

### 5. Promote Prompt 5 only if the missing proof is actually closed

Required outcome:

- update the evidence log so Prompt 5 no longer remains conditional if and only if the new live proof exists
- if live proof still cannot be captured, return `NO-GO` with the exact blocker instead of overclaiming closure

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build` if backend touched
- `npm --prefix atlas-client run build`
- authenticated valid batch preview + commit check
- authenticated invalid hard-conflict batch commit check
- latest-draft-after-commit check
- no-regeneration proof for the valid commit path
- line-count and primitive scans for touched React files

Browser/Tailnet smoke:

- open `/timetable`
- stage a local sandbox change
- review a soft-warning path and confirm explicit acknowledgement is required before save
- commit a valid change
- confirm latest draft reflects the change
- attempt an invalid hard-conflict path and confirm save stays blocked with recovery copy
- confirm published-run copy is revision-oriented if that state is reachable

Self-correction requirement:

- if build, acknowledgement flow, hard-block behavior, live commit proof, or latest-draft proof fails, fix in the same session and rerun the failed check once

## Required Output

Return:

- files changed
- how soft-warning acknowledgement now works
- how published-run blocked copy now points to revision workflow
- valid and invalid authenticated commit evidence
- latest-draft-after-commit proof
- no-regeneration proof
- whether Prompt 5 is now upgraded to real `GO` or remains `NO-GO`
