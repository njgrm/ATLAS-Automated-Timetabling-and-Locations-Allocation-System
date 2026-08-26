# Copilot Execution Prompt: Phase 3 Teaching Load Stale Ownership Reconciliation One-Shot

## Objective

Finish the backend truth repair for `Teaching Load` by reconciling stale current-year ownership rows.

The live system is no longer mainly wrong because of blank pairs or placeholder headline masking.
It is now wrong because many current-year subject-section pairs still have raw ownership rows tied to:

- stale faculty mirrors
- stale `Teacher X` placeholder mirrors

This pass must make active staffing truth, saved ownership truth, coverage truth, and staffing-report truth agree.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-live-discrepancy-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- any helper/service files used for ownership normalization or assignment truth reconciliation

## Live Facts To Treat As Settled

These are already verified against Tailnet and the live DB:

- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
  - `assignedPairs = 728`
  - `rawAssignedPairs = 962`
  - `unassignedPairs = 234`
  - `rawUnassignedPairs = 0`
- the missing `234` pairs are not blank; they are stale-owned
- `SCI_ES` current-year pairs are still owned by stale placeholder `Teacher X SCI_ES`
- `SCI_CHEM` still has `35` stale-owned pairs
- `TLE_FCS_EXP` still has `54` stale-owned pairs
- `ENG` still has `23` stale-owned pairs
- `FIL` still has `22` stale-owned pairs
- current `integrityDiagnostics` does not expose stale-ownership debt explicitly

## Scope

### In Scope

#### A. Reconcile stale current-year ownership rows

Required:

- detect current-year `SubjectSectionOwnership` rows whose `facultyId` points to a stale `FacultyMirror`
- classify stale owners separately from:
  - active real faculty
  - active placeholder faculty
  - truly blank pairs
- stop stale current-year ownership rows from masquerading as saved assignment truth

The system shall not treat stale faculty ownership as active staffing success.

#### B. Make summary, coverage, and staffing-needs use the same active-owner truth

Required:

- preserve the current active-vs-raw distinction
- ensure raw metrics remain available for diagnostics
- ensure active metrics remain the scheduler-facing truth
- ensure coverage, summary, and staffing-needs all derive from the same current-year active-owner rules

#### C. Extend integrity diagnostics

Required:

- add explicit stale-ownership diagnostics for current-year pairs
- report at minimum:
  - stale ownership row count
  - stale-owned current-year pair count
  - stale placeholder pair count
  - stale non-placeholder pair count
  - sample subject/faculty rows

This must make the current hidden debt visible instead of forcing operators to infer it.

#### D. Provide a reconciliation path

Required:

- add a preview/apply reconciliation path for stale current-year ownership repair
- this path must be scoped to current-year section ownership only
- it must not blindly delete historical cross-year data
- it must be safe for repeated execution

Minimum acceptable behavior:

- preview identifies stale-owned current-year pairs
- apply removes or detaches stale current-year ownership from live assignment truth
- live active faculty baseline rows remain intact

#### E. Preserve current correct behavior

Required:

- keep current rotation-family teacher load math
- keep current raw-vs-concurrent staffing separation
- keep specialization assignment identity for `SPA_SPEC` / `SPS_SPEC`
- keep `STE_ROBOTICS` multi-owner contract intact

### Out Of Scope

Do not:

- redesign the page UI in this pass
- change the overall scheduler-facing route or naming contract
- rewrite the full auto-fill strategy beyond what is needed for truth reconciliation
- reopen specialization-tier qualification logic

## Implementation Direction

### 1. Treat stale ownership as its own truth bucket

Current product pain exists because the system currently has:

- active real ownership
- active placeholder ownership
- stale ownership
- blank pairs

but only some of those are surfaced consistently.

This pass must make stale ownership a first-class diagnostic concept.

### 2. Reconcile current-year rows, not all history

Focus strictly on:

- active school
- active school year section universe
- current active subject contract

Do not mutate old historical rows just because they share the same subject code.

### 3. Prefer deterministic reconciliation over hidden heuristics

The repair must be auditable.

Preview/apply should clearly show:

- which pairs are stale-owned
- which faculty rows are being detached
- how many pairs become truly uncovered after stale cleanup

### 4. Do not let stale owners block real staffing recovery

After this pass, real-faculty recovery and manual placement should stop competing with dead owners.

## Required Live Tailnet Verification

You must test on:

- `https://njgrm.buru-degree.ts.net`

Do not stop at local builds.
Do not return `GO` without post-change live proof.

Required checks:

1. `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
   - verify active vs raw counts still exist
   - verify stale-ownership diagnostics now exist

2. `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
   - verify `SCI_ES`, `SCI_CHEM`, `TLE_FCS_EXP`, `ENG`, and `FIL` are still represented truthfully after reconciliation

3. the new stale-ownership preview/apply path
   - preview must show stale-owned current-year pairs
   - apply must complete safely

4. post-apply recheck
   - verify stale current-year ownership no longer remains in live truth where reconciliation was meant to clear it

5. direct live proof for the known stale-debt subjects
   - `SCI_ES`
   - `SCI_CHEM`
   - `TLE_FCS_EXP`
   - `ENG`
   - `FIL`

If any required live test is missing, return `NO-GO`.

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- any targeted test coverage you add for stale ownership reconciliation
- post-change live Tailnet probes
- verify no regression to current rotation-aware load math
- verify no regression to specialization assignment identity

## Required Output

Return:

1. files changed
2. stale-ownership truth changes
3. reconciliation endpoint or workflow changes
4. integrity-diagnostic changes
5. live Tailnet proof
6. remaining blockers
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- stale current-year ownership is explicitly diagnosable
- stale ownership no longer silently masquerades as saved live assignment truth
- summary, coverage, and staffing-needs agree on active-owner truth
- reconciliation was actually tested live on Tailnet
- no regression was introduced to rotation-aware load math or specialization assignment identity
