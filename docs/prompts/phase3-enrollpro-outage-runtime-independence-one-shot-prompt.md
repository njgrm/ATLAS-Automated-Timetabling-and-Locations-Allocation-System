# Copilot Execution Prompt: Phase 3 EnrollPro Outage Runtime Independence One-Shot

## Objective

Make ATLAS function in degraded read mode even when EnrollPro is down, as long as ATLAS has successfully synced the needed data at least once.

This is not a generic PWA prompt.
It is a runtime-independence pass focused on current outage behavior.

The system already has persisted mirrors and snapshots for faculty and sections.
The problem is that too many pages still ask EnrollPro first for runtime context before using data ATLAS already owns.

Your job is to remove that dependency for scheduler-critical reads.

## Out of Scope

Do not:

- redesign page UI beyond necessary degraded-state copy and status clarity
- implement full offline write-back for all pages
- reopen Teaching Load staffing math or subject-distribution logic
- introduce stub-only fake fallback in production-like paths

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-enrollpro-outage-runtime-independence-audit-2026-05-24.md`
- `docs/analysis/phase3-faculty-teaching-load-performance-and-offline-audit-2026-05-22.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/lib/faculty-teaching-load-cache.ts`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/Audit.tsx`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- any current runtime-context or bootstrap helpers you find

## Verified Current Problem

Treat these as real:

- EnrollPro outage currently breaks scheduler-critical reads more than it should
- active school year is still resolved too often from EnrollPro public settings instead of ATLAS-owned runtime context
- `Sections` still directly depends on `fetchPublicSettings()` and has no real last-good cache bootstrap
- `Teachers` and `Teaching Load` do have cache logic, but cached data can still appear too late because active-year bootstrap is still network-gated
- ATLAS already has:
  - faculty snapshots for `schoolYearId=55`
  - section snapshots for `schoolYearId=55`
  - section mirrors for `schoolYearId=55`
  - persisted policy rows and generation runs for `schoolYearId=55`

So this is not a "no data exists" problem.
It is a runtime-dependency problem.

## Required Product Outcome

If ATLAS has already synced once for the relevant school year, then during EnrollPro outage the scheduler should still be able to:

- open the shell
- resolve a last-known active school year
- open `Sections`
- open `Teachers`
- open `Teaching Load`
- open `Subjects`
- open `Dashboard`
- open `Audit`

with honest degraded-state messaging and without pretending live sync is available.

Unsafe mutating actions may remain blocked while degraded if necessary.
Read-only inspection must not collapse if ATLAS already has the needed local data.

## Implementation Requirements

### A. Add an ATLAS-owned runtime context contract

Implement a backend read model that returns the last known usable runtime context for the current school.

This must not depend first on EnrollPro.

The contract must be able to resolve, at minimum:

- school id
- last known active school year id
- last known active school year label if available
- source of the context
- whether the context is stale
- timestamps or freshness information

Use ATLAS-owned persisted evidence to derive this context, such as:

- latest valid section snapshot
- latest valid faculty snapshot
- persisted scheduling policy year
- latest generation run year
- any existing persisted school-year context already available in ATLAS

If EnrollPro is reachable, the system may refresh/validate the context.
If EnrollPro is unreachable, the system must still return the last-good ATLAS context if it exists.

### B. Stop scheduler-critical pages from directly depending on `fetchPublicSettings()` for active-year bootstrap

Migrate the scheduler-critical client pages to the new ATLAS-owned runtime context resolver.

Priority pages:

- `AppShell`
- `Sections`
- `Teachers`
- `Teaching Load`
- `Subjects`
- `Dashboard`
- `Audit`

Acceptable:

- EnrollPro public settings may still be used for branding or refresh verification
- but active-year readiness must no longer hard-fail just because `settings/public` is unavailable

### C. Add real cached bootstrap to `Sections`

`Sections` must gain the same class of degraded reopen path that `Teachers` and `Teaching Load` already attempt.

Required:

- cache last-good section summary
- cache last-good home-room options if needed for read-only display
- render from cache immediately when available
- show explicit `live`, `cached`, or `no cache` state
- block unsafe write actions while degraded if necessary

### D. Make existing cached pages show usable cached state immediately

For `Teachers` and `Teaching Load`:

- do not make the user wait on a failing/stale active-year network refresh before a usable cached view appears
- if a valid local active-year context and last-good page cache exist, render that first
- refresh in background when possible

### E. Prefer mirror/snapshot-backed server reads where sufficient

For read-only outage continuity:

- prefer local mirrors and persisted snapshots if they already satisfy the request
- only call upstream when refresh is required
- do not let plain read routes fail just because refresh failed, if a valid ATLAS-owned fallback exists

Specifically inspect `Teaching Load` and section-based read paths for unnecessary adapter-first behavior.

### F. Report degraded source truth honestly

Do not label a mirror-only or snapshot-only response as `enrollpro`.

Response/source labels and UI copy must distinguish:

- live upstream-backed
- cached snapshot / mirror-backed
- no local data available

### G. Preserve sync recovery

When EnrollPro becomes reachable again:

- explicit sync/update actions must still work
- mirrors/snapshots must refresh correctly
- live/cached state must recover cleanly

## Verification Requirements

You must not stop at build success.

Required:

1. `npm --prefix atlas-client run build`
2. `npm --prefix atlas-server run build`
3. verify the new runtime-context contract locally
4. verify cached/mirror-backed degraded reads for:
   - `Sections`
   - `Teachers`
   - `Teaching Load`
5. verify at least one no-cache degraded case still reports failure honestly
6. verify that live refresh recovers once upstream is reachable again, if available

## Mandatory Tailnet / Outage Proof

Do not return `GO` without live or simulated outage verification.

At minimum, prove the behavior under one of these:

- real EnrollPro outage
- simulated failure of `/enrollpro-api/settings/public`
- simulated failure of the relevant upstream bridge calls while ATLAS mirror/snapshot data already exists

You must show evidence that:

- active school year still resolves from ATLAS-owned context
- `Sections` can open from ATLAS data
- `Teachers` can open from ATLAS data
- `Teaching Load` can open from ATLAS data

If any of those still fail, return `NO-GO`.

## Required Output

Return:

1. files changed
2. the new ATLAS-owned runtime context contract
3. pages migrated off direct EnrollPro active-year dependence
4. `Sections` degraded bootstrap changes
5. `Teachers` / `Teaching Load` degraded bootstrap improvements
6. response-source / degraded-copy corrections
7. build results
8. outage verification results
9. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- ATLAS can resolve last-known active school year without EnrollPro when local data exists
- `Sections`, `Teachers`, and `Teaching Load` can all open in degraded read mode from ATLAS-owned data
- no page falsely claims live data when it is actually cached/mirror-backed
- unsafe mutations are blocked or clearly guarded while degraded
- the final evidence proves the system no longer depends on EnrollPro just to read data that ATLAS already mirrored
