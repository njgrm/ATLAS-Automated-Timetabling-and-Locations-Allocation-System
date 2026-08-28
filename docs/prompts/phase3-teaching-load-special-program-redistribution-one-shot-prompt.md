# Copilot Execution Prompt: Phase 3 Teaching Load Special-Program Redistribution One-Shot

## Objective

Redistribute `SPA_SPEC` and `SPS_SPEC` ownership more intelligently across real `MAPEH` teachers using assignment-level specialization identity, without reintroducing specialization-based scheduler qualification gating.

This is not a subject-catalog rewrite.
This is not a return to specialization-mapping-driven baseline qualification.

The current problem is distribution:

- stale ownership debt is already fixed
- `SPA_SPEC` and `SPS_SPEC` are already covered
- several real `MAPEH` teachers remain underutilized or zero-load
- assignment-level specialization identity now exists and should help distribution where it reflects real capability
- degraded runtime surfaces are still overstating freshness and some staffing reporting fails or misleads when EnrollPro is down

Your job is to use that identity as a redistribution preference and operator aid, not as the normal qualification baseline for all subjects.

## Out of Scope

Do not:

- explode `SPA_SPEC` or `SPS_SPEC` into separate top-level subject rows
- bring back the old specialization-mapping page or specialization-first scheduler qualification
- redesign the current `Teaching Load` UI from scratch
- reopen stale-ownership reconciliation
- change non-special-program subjects to specialization-gated qualification

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-post-outage-discrepancy-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-staffing-blocker-audit-2026-05-23.md`
- `docs/analysis/phase3-subject-contract-and-teaching-load-term-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/services/qualification.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- any current special-program or specialization helpers you find

## Facts To Treat As Settled

- stale ownership is already fixed and must stay fixed
- `SPA_SPEC` and `SPS_SPEC` remain umbrella schedulable subjects
- assignment-level specialization identity already exists on ownership rows
- scheduler baseline qualification remains department-first for normal subjects
- specialization identity for `SPA_SPEC` and `SPS_SPEC` should inform redistribution and visibility, not replace the broader department baseline
- multiple active `MAPEH` teachers remain low-load or zero-load
- current degraded runtime state still has honesty gaps:
  - `Teachers` can show `Live data` even when truth is coming from ATLAS-cached or degraded runtime state
  - `Sections` can do the same
  - staffing-needs / staffing audit behavior still needs to remain usable and honest during EnrollPro outage
- current redistribution diagnostics are still too strict:
  - `SPA_SPEC` and `SPS_SPEC` preview can return empty `candidateSignals`
  - underutilized `MAPEH` teachers can be excluded too early because the subject owner code is treated too literally as `SPA` / `SPS`
- section-level specialization identity already exists in live ownership payloads, but is not yet a first-class assignment semantic in the workflow
- current live `Teaching Load` closure blockers are now mainly:
  - real `SCIENCE` coverage
  - real `TLE` coverage
  - weak special-program distribution clarity

## Product Outcome

After this pass:

- `SPA_SPEC` and `SPS_SPEC` ownership should make better use of available real `MAPEH` teachers where specialization identity supports it
- the system should be able to identify underutilized `MAPEH` teachers who are realistic redistribution candidates
- the operator should be able to tell which special-program ownership is:
  - stable
  - redistributable
  - specialization-constrained
- no current full-coverage special-program subject should regress into uncovered status just because redistribution logic changed
- `Sections`, `Teachers`, and `Teaching Load` staffing surfaces should communicate degraded/cached truth honestly when EnrollPro is unavailable
- schedulers should be able to use `Teaching Load` in degraded writable mode where ATLAS has enough local evidence

## Implementation Requirements

### A. Formalize assignment-level specialization identity as a redistribution signal

For `SPA_SPEC` and `SPS_SPEC` only:

- preserve current assignment-level specialization identity on ownership rows
- use it as a preference signal for redistribution and autofill suggestions
- where a teacher has matching or compatible specialization identity, prefer them over generic same-department reassignment
- where no matching specialization identity exists, the system may still keep current ownership or recommend manual review instead of making false confident reassignment

Do not turn this into a universal hard gate for all ownership.

### B. Add special-program redistribution analysis

Implement a backend read model or extend the current `Teaching Load` diagnostics so ATLAS can identify:

- underutilized `MAPEH` teachers
- current `SPA_SPEC` and `SPS_SPEC` owners by specialization identity
- sections whose current ownership could be redistributed within real active `MAPEH` staffing
- sections whose specialization identity appears unsupported by currently available active teachers

This analysis must be current-school-year only.

It must not exclude realistic `MAPEH` candidates simply because the umbrella subject owner code is `SPA` or `SPS`.

For special-program redistribution analysis:

- allow department-baseline candidate discovery to include realistic `MAPEH` teachers
- then refine candidate quality using assignment-level specialization identity
- then further refine with local approved capability overrides where available

### C. Keep full coverage intact while redistributing

If live `SPA_SPEC` or `SPS_SPEC` is already fully covered, then the system shall not reduce that coverage just to chase evenness.

Redistribution should:

- improve utilization where safe
- preserve coverage truth
- prefer lower-load valid candidates
- avoid bouncing ownership unnecessarily

### D. Keep scheduler qualification model clean

Do not reintroduce specialization-based normal qualification language for the whole page.

The page may explain special-program redistribution using language like:

- `Special-program match`
- `Current specialization owner`
- `Redistribution candidate`

It must not imply that ordinary scheduler qualification has gone back to specialization mapping.

### E. Surface operator-friendly redistribution data

Expose enough data for the frontend to show:

- underutilized teachers by department
- special-program sections that are currently concentrated under a small number of owners
- redistribution candidates with specialization identity context

This must support a later or parallel UI pass without needing another backend contract reset.

### F. Make section-level specialization assignment semantics first-class for `SPA_SPEC` / `SPS_SPEC`

Required:

- treat each special-program section assignment as a specialization-aware slot, not just a generic umbrella subject row
- preserve the current umbrella subject contract in the subject catalog
- make the assignment workflow able to distinguish:
  - the umbrella subject row
  - the section’s required specialization identity
  - the assigned teacher’s current specialization identity or approved compatibility override

This does not require exploding the subject catalog into separate top-level specialization subjects.

### G. Add a local approved capability / compatibility override

If EnrollPro specialization data is too weak, generic, or incomplete, ATLAS must support a local capability / compatibility override for special-program assignment decisions.

Required:

- persist a scheduler-usable approved capability signal at the ATLAS layer
- scope it at least to:
  - faculty
  - special-program subject family or specialization code
  - school
- use it only as an ATLAS-owned assignment aid, not as a global replacement for upstream source truth

This is the mechanism that should let real `MAPEH` teachers be used honestly even when upstream specialization strings are not granular enough.

### H. Preserve current Teaching Load truth

Do not regress:

- section-first assigned-class endpoints
- summary / coverage / staffing parity
- term-aware shortage reporting
- stale-ownership cleanup

### I. Enable degraded writable mode where ATLAS has enough evidence

Treat this as part of the same pass.

Required:

- `Teaching Load` must not remain globally read-only just because EnrollPro is down if ATLAS already has:
  - runtime context
  - current-year sections
  - current teacher/ownership summary
  - current subject contract
- allow safe scheduler operations that only mutate ATLAS-owned teaching-load state in that degraded mode
- keep truly unsafe upstream-dependent operations blocked if needed

At minimum, re-evaluate the current client rule that makes the page read-only whenever `dataSource !== 'live'`.

### J. Make degraded source-state communication honest on EnrollPro-dependent pages

Treat this as a narrow follow-up within the same pass.

Required:

- `Sections` must not claim `Live data` if the page is being served from cached or degraded ATLAS-owned runtime state while EnrollPro is down
- `Teachers` must not claim `Live data` if roster truth is being served from cached or degraded ATLAS-owned runtime state while upstream is unavailable
- `Teaching Load` must continue the same honesty standard for staffing-related surfaces

Acceptable outcome:

- distinguish at least:
  - `Live upstream-backed`
  - `ATLAS cached / degraded`
  - `No cache`

The operator should be able to tell whether the page is:

- using current upstream-backed truth
- using last-good ATLAS snapshot
- blocked because no prior data exists

Do not use a misleading `live` label simply because an ATLAS endpoint responded.

### K. Keep staffing-needs / staffing audit usable during EnrollPro outage

Investigate and fix the current outage failure mode where staffing audit cannot reliably load in this environment without EnrollPro.

Required:

- if ATLAS already has the required local teaching-load, section, and subject data, staffing-needs / staffing audit reads must still load in degraded mode
- if a report is served from degraded or cached runtime inputs, the response and UI must communicate that honestly
- if a report truly cannot be produced because required local evidence is missing, fail with explicit operator-facing cause instead of a vague runtime failure

Do not reopen the staffing math itself here unless a small bug fix is strictly necessary for degraded read continuity.

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- verify live Tailnet `Teaching Load` still opens
- verify `Sections` and `Teachers` no longer overstate degraded data as `Live data`
- verify `SPA_SPEC` and `SPS_SPEC` remain covered after the pass
- verify current-school-year redistribution analysis can identify at least:
  - underutilized `MAPEH` teachers
  - current `SPA_SPEC` / `SPS_SPEC` ownership concentration
  - specialization-supported redistribution candidates where applicable
- verify special-program preview no longer returns empty `candidateSignals` solely because owner code filtering excluded realistic `MAPEH` teachers
- verify `Teaching Load` can perform ATLAS-owned writable actions in degraded mode when local evidence is sufficient
- verify staffing-needs / staffing audit still opens or returns an honest degraded response while EnrollPro is unavailable
- verify no stale-ownership metrics regress

## Required Output

Return:

1. files changed
2. redistribution model changes
3. special-program identity and candidate logic
4. degraded writable-mode changes
5. degraded-source honesty changes for `Sections`, `Teachers`, and staffing surfaces
6. operator-facing data contract additions
7. live verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `SPA_SPEC` and `SPS_SPEC` remain fully covered
- redistribution logic uses assignment-level specialization identity appropriately
- underutilized `MAPEH` teachers can be surfaced as realistic redistribution candidates
- special-program preview does not incorrectly collapse to zero candidate signals because of umbrella owner-code filtering
- `Teaching Load` is usable in degraded writable mode where ATLAS has enough local evidence
- EnrollPro-dependent pages no longer overstate degraded data as live
- staffing-needs / staffing audit remains usable or fails honestly in degraded mode
- no stale-ownership or coverage-truth regression is introduced
