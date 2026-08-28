# Copilot Execution Prompt: Phase 3 Timetable Day-Shape Live Closure And Qualification Authority One-Shot

## Mission

Execute the corrective follow-up to the partially completed day-shape pass.

The previous pass added the policy fields and some local code-path alignment, but it did **not** prove live closure. This pass is only successful if the active Tailnet runtime, the generator, and the timetable review surface all reflect the intended contract end to end.

Your objectives:

1. make the live Tailnet scheduling-policy contract expose the persisted day-shape fields and actually drive generation truth
2. prove the active stakeholder baseline is a `45`-minute timetable shape in live generation behavior, not just local code or UI controls
3. fully reconcile `FACULTY_SUBJECT_NOT_QUALIFIED` with Teaching Load authority for approved active-school-year pairings
4. ensure `/timetable` no longer depends on manual-unassigned drag/assign as the implied normal completion path
5. do not declare success if any of the above remains local-only, stale-shell-only, or documentation-only

---

## Scope

### In Scope

- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/faculty-assignment.service.ts` only if needed for authoritative saved-truth lookup
- `atlas-server/src/server.ts` only if needed for runtime/bootstrap/schema alignment
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/timetable/`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/types.ts`
- targeted tests for policy payload, 45-minute normalization, and qualification-authority reconciliation
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- Grade 9 placement baseline repair
- room-type mismatch suppression outside qualification/day-shape scope
- final term-aware master-schedule output
- broad room-topology reseed
- facility booking workflows

---

## Why This Follow-Up Exists

Treat these as already verified:

- the previous pass only delivered **partial** closure
- evidence explicitly recorded `NO-GO` because live Tailnet policy payload still did not expose the new day-shape fields
- runtime map still shows generator readiness `NO-GO`
- latest run still carries `FACULTY_SUBJECT_NOT_QUALIFIED=3`
- the prior pass title narrowed itself to `Policy Control And Bootstrap Schema Alignment`, which means it did not actually close the original qualification-authority follow-up intent

This pass must close those gaps instead of re-describing them.

---

## Required Product Decisions

Follow these decisions exactly:

### 1. No local-only closure

Do not declare `GO` because:

- local build passes
- local policy code has the fields
- local UI renders the controls
- docs were updated

Closure requires live Tailnet proof.

### 2. `45` minutes is the stakeholder baseline for the active school/year

For the active replication stream, the effective generated day shape must align to `45`-minute periods unless direct repo evidence disproves that baseline.

### 3. Scheduling policy is the active day-shape authority

The generator must use the persisted scheduling-policy day-shape contract as the primary source of block math for the active school/year.

Class-template defaults may remain as fallback/reference, but they must not silently override the active policy truth.

### 4. Teaching Load is authoritative for approved pairings

If Teaching Load saved truth already approves a faculty-subject-section pairing for the active school/year, timetable validation must not continue surfacing it as a normal unresolved qualification blocker.

### 5. Partial passes are failure for this prompt

If live policy payload, live generation behavior, and live qualification behavior do not all line up by the end of the pass, the verdict must remain `NO-GO`.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase3-timetable-day-shape-and-qualification-authority-followup-one-shot-prompt.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`

Inspect directly before editing:

- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/timetable/`

---

## Required Outcomes

### 1. Live policy payload closure

Required result:

- live Tailnet `GET /api/v1/policies/scheduling/1/55` exposes the effective persisted day-shape fields
- those fields include the active block contract needed by the generator
- runtime/source docs no longer have to caveat that the live endpoint is stale or awaiting restart

### 2. Live `45`-minute generation proof

Required result:

- after rerun, active timetable generation reflects the intended `45`-minute shape
- evidence must prove this from live generation output, not only UI labels
- representative `225`-minute subjects must resolve consistently under the active shape

### 3. Qualification-authority closure

Required result:

- `FACULTY_SUBJECT_NOT_QUALIFIED` no longer appears for active-school-year pairings already approved in Teaching Load
- if the count is non-zero at the end, every remaining case must be documented as a true unresolved contradiction with specific identifiers

### 4. Timetable workflow truthfulness

Required result:

- unassigned/manual placement language remains clearly secondary
- `/timetable` no longer teaches operators that the normal expected finish is to drag unresolved sessions into place manually

### 5. No stale-runtime ambiguity

Required result:

- if a redeploy, restart, migration, or cache reset is needed to make the live pass real, do it inside this pass and prove it
- do not stop at “the code is correct but Tailnet is stale”

---

## Execution Requirements

1. Verify whether the live Tailnet server is still serving stale scheduling-policy payloads because of:
   - missing migration
   - stale generated Prisma client
   - stale server process
   - stale frontend bundle
   - cached service-worker/browser shell
2. Repair the actual cause instead of only updating docs.
3. Rerun generation for the active school/year after the live policy contract is confirmed.
4. Inspect live draft output and violation output.
5. Reconcile qualification-authority logic using Teaching Load saved truth, not softened wording only.

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. `npx prisma generate --no-engine` if Prisma/schema/client contract is touched
4. run targeted timetable tests for day-shape and qualification authority
5. add/update tests if the previous pass lacked hard proof for these behaviors

### Live checks

1. Tailnet login with documented scheduler credentials
2. Tailnet `GET /api/v1/policies/scheduling/1/55`
3. Tailnet rerun generation for school `1`, year `55`
4. Tailnet `GET /api/v1/generation/1/55/runs/latest/draft`
5. Tailnet `GET /api/v1/generation/1/55/runs/latest/violations`
6. verify representative `225`-minute subject behavior from the live run
7. verify whether `FACULTY_SUBJECT_NOT_QUALIFIED` persists and why
8. verify `/timetable` wording/state for manual-unassigned expectations

### Evidence requirements

Document all of the following in `docs/verification/evidence-log.md`:

- exact live policy payload before and after
- whether restart/redeploy/migration was required
- exact live day-shape values after closure
- proof that live generation uses the intended `45`-minute shape
- sample subject/session-count proof for `225`-minute rows
- exact before/after `FACULTY_SUBJECT_NOT_QUALIFIED` state
- whether any residual qualification rows are true contradictions
- exact final latest-run metrics
- final verdict: `GO` or `NO-GO`

Do not write a broad “partial success” closeout for this pass. If any required live proof is missing, the verdict must remain `NO-GO`.

---

## Documentation Updates

Update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Append only for `evidence-log.md`.

---

## GO / NO-GO Rule

Declare `GO` only if all of the following are true:

1. live Tailnet scheduling-policy payload exposes the new day-shape fields
2. live generation behavior is proven to follow the intended `45`-minute baseline
3. `225`-minute subjects now resolve consistently under that shape
4. Teaching Load authority and timetable qualification checks no longer contradict each other for approved pairings
5. timetable review no longer frames manual-unassigned placement as the normal completion workflow
6. no remaining blocker is explained away as “local code done, live runtime stale”

Otherwise declare `NO-GO` and enumerate the exact remaining blocker set.
