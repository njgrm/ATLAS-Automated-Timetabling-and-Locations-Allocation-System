# Copilot Execution Prompt: Phase 3 EnrollPro Recovery Source Honesty Multi-Page One-Shot

## Objective

Fix the source-state contract now that EnrollPro is back online so ATLAS pages stop behaving like upstream is still down when live verification has actually recovered.

This is a runtime/source-truth repair pass, not a redesign pass.

The main goal is:

- if EnrollPro is truly back and ATLAS runtime can verify it, the UI must recover to honest live state
- if a page is still mirror-backed or saved-data-backed, the UI must explain that precisely

## Out of Scope

Do not:

- redesign `Teachers`, `Sections`, or `Teaching Load`
- rewrite the public/offline strategy from scratch
- reopen teaching-load math
- change schedule publish behavior
- hide degraded state just to make the UI look cleaner

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-offline-capability-and-outage-ui-audit-2026-05-25.md`
- `docs/analysis/phase3-teachers-sections-enrollpro-recovery-and-home-room-control-audit-2026-05-26.md`

Inspect directly:

- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Audit.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/section.service.ts`
- any shared status helpers or source-state badge helpers in those surfaces

## Verified Current Problem

Treat these as real:

- Tailnet runtime context currently returns:
  - `source = enrollpro-verified`
  - `upstream.reachable = true`
  - `upstream.verified = true`
  - `activeSchoolYearLabel = 2026-2027`
- but `resolveActiveSchoolYearContext()` currently collapses runtime context into:
  - `source = atlas`
- that makes many pages unable to recover to honest live-state wording even when EnrollPro is back
- `Sections` has an additional issue:
  - `getSectionSummary()` returns `source = atlas-mirror` whenever mirror data exists
  - so the page remains in degraded presentation even with healthy upstream runtime verification

As a result, multiple pages can keep acting like EnrollPro is down even when it is not.

## Required Product Outcome

When EnrollPro is back and ATLAS has verified that fact:

- pages must recover from degraded wording to honest live wording
- saved-data badges must not remain stuck
- active school-year label must remain readable and current

When a page is still using ATLAS mirror or saved data for the actual payload:

- it must say so clearly
- but it must not claim EnrollPro is unreachable if runtime verification says it is back

The user must be able to understand the difference between:

- `EnrollPro is back`
- `this page is still showing saved data until refreshed or resynced`

## Implementation Requirements

### A. Preserve runtime verification truth in the client helper

Update `resolveActiveSchoolYearContext()` so it does not flatten:

- `enrollpro-verified`

into:

- `atlas`

The helper must preserve enough meaning for UI pages to distinguish:

- verified live runtime
- ATLAS-persisted fallback
- cache fallback

### B. Normalize page source decisions around truthful states

Review and repair source-state decisions on at least:

- `Teachers`
- `Sections`
- `Teaching Load`
- `Audit`
- `Dashboard`
- shell framing if applicable

Do not let a page say:

- `Working from saved data`

only because the helper returned an oversimplified source flag.

### C. Fix `Sections` summary source honesty

Repair the `Sections` summary/source contract so it can distinguish:

- live upstream-verified / freshly synchronized mirror truth
- mirror-backed saved truth
- cached fallback truth

Do not keep returning the same pessimistic source label for all mirror-backed successful states if that prevents the UI from recovering honestly.

### D. Keep degraded honesty when a page is still not fully live

Do not swing too far in the other direction.

If runtime says EnrollPro is back, but a page payload is still stale or mirror-only, the UI should communicate:

- EnrollPro connection is available again
- this page is still showing saved data until refresh/sync completes

Do not claim a page is fully live unless the underlying page data really supports that claim.

### E. Unify the state model across pages

The same source-state meanings should apply across the in-scope pages.

At minimum, the implementation must support a stable distinction between:

- verified live
- saved ATLAS data but upstream reachable
- saved ATLAS data while upstream unreachable
- no saved data

## Verification Requirements

You must not stop at build success.

Required:

1. `npm --prefix atlas-client run build`
2. `npm --prefix atlas-server run build`
3. Tailnet verification that runtime context is live again
4. verify `Teachers` no longer stays stuck in degraded wording when runtime is truly verified live
5. verify `Sections` no longer says EnrollPro is down when runtime is healthy
6. verify pages still present honest saved-data states when their payloads are not actually fresh/live
7. verify no false `Verified Live` labels appear where only cache is available

## Mandatory Tailnet Proof

Do not return `GO` without live verification.

At minimum, prove:

1. `GET /api/v1/runtime/context?schoolId=1` reflects healthy upstream verification
2. at least `Teachers` and `Sections` recover to correct user-facing state logic
3. one page that is still payload-backed by saved or mirror data remains honest about that fact

If pages still talk like EnrollPro is down after live recovery, return `NO-GO`.

## Required Output

Return:

1. files changed
2. runtime/source-state contract changes
3. page-by-page source-state recovery behavior for:
   - `Teachers`
   - `Sections`
   - `Teaching Load`
   - `Audit`
   - `Dashboard`
4. build results
5. Tailnet verification results
6. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the client/runtime helper preserves enough truth to distinguish verified live from ATLAS fallback
- `Teachers` and `Sections` no longer act like EnrollPro is down when it is back
- saved-data states remain honest where payload freshness still differs from runtime verification
- source-state behavior is materially more consistent across the in-scope pages
