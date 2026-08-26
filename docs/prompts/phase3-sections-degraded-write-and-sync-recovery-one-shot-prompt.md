# Copilot Execution Prompt: Phase 3 Sections Degraded Write and Sync Recovery One-Shot

## Objective

Make the `Sections` page usable during EnrollPro outage when ATLAS already has local section evidence, and restore clean sync recovery once EnrollPro is back.

This is the `Sections` counterpart to the degraded-read and degraded-write work already done for `Teachers` and `Teaching Load`.

The page must stop behaving like an upstream-only surface when ATLAS already owns enough local data to keep schedulers working.

## Out of Scope

Do not:

- redesign the `Sections` UI beyond state wording and minimal interaction changes required by degraded usability
- change the new section-first assigned-classes contract
- reopen `Teaching Load` math, staffing, or faculty-summary logic
- build a generic offline queue system for unrelated pages
- introduce fake demo data

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-enrollpro-outage-runtime-independence-audit-2026-05-24.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/lib/faculty-teaching-load-cache.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- any runtime-context helpers or routes currently used by `Teachers` / `Teaching Load`

## Verified Current Problem

Treat these as real:

- `Sections` still becomes functionally unusable in EnrollPro-down conditions more often than it should
- the page now has cache bootstrap, but it still forces:
  - `isReadOnlyMode = !isOnline || dataSource !== 'live'`
- that means cached mirrored section data can render, but ATLAS-owned home-room work is still blocked
- this is too conservative because home-room assignment is ATLAS-owned, not EnrollPro-owned
- sync behavior also needs a clean recovery path once EnrollPro comes back

ATLAS already has the necessary local evidence for current-year section work:

- `SectionMirror`
- cached section summary
- cached home-room options
- runtime context / active school-year resolution

So the remaining issue is runtime policy, not absence of data.

## Required Product Outcome

If ATLAS already has usable section context for the current school year, then during EnrollPro outage the scheduler should still be able to:

- open `Sections`
- inspect the current roster
- inspect filters and section stats
- continue ATLAS-owned home-room assignment work where the local runtime evidence is sufficient

When EnrollPro becomes reachable again, the scheduler should be able to:

- run `Sections` sync successfully
- refresh mirrored data
- return the page to honest live/upstream-backed status

The page must communicate clearly which actions are:

- locally writable in ATLAS
- blocked until upstream is back
- refreshable once sync succeeds

## Implementation Requirements

### A. Add degraded writable-mode logic for ATLAS-owned section operations

Do not keep `Sections` in blanket read-only mode just because `dataSource !== 'live'`.

Implement an evidence-gated degraded writable rule similar in spirit to `Teaching Load`.

At minimum, if all of the following are true:

- current active school-year context is resolved
- section summary is available from cache or mirror-backed route
- home-room options are available from cache or mirror-backed route
- user is online to ATLAS

then allow ATLAS-owned home-room assignment actions even when EnrollPro upstream is unavailable.

### B. Keep unsafe upstream-dependent actions guarded separately

Do not allow upstream sync actions to pretend they will work while fully offline.

Distinguish:

- ATLAS-local writable actions
- upstream-dependent sync / refresh actions

If the user is offline or upstream is unreachable:

- local ATLAS-owned writes may continue if safe
- explicit EnrollPro sync must remain blocked or honestly fail

### C. Persist degraded-mode section edits truthfully

When a home-room change is made in degraded writable mode:

- it must persist through the normal ATLAS-owned path
- the page must continue to reflect the saved change
- cached bootstrap should not erase or hide the locally saved result on reload

### D. Tighten source-state honesty

The page must clearly distinguish:

- live upstream-backed
- ATLAS cached / mirror-backed writable
- cached read-only
- no cache

Do not show `Live data` just because an ATLAS route answered.

### E. Preserve clean sync recovery

When EnrollPro returns:

- explicit sync must still work
- summary and home-room state must refresh correctly
- source state must return to live when truly upstream-backed

### F. Verify no contradiction with section-first APIs

Do not break:

- `/sections/:sectionId/assigned-classes`
- `/sections/assigned-classes`

This pass is about page runtime usability, not removing the newer section-first model.

## Implementation Direction

- prefer reusing the degraded-write gating pattern already established in `Teaching Load`
- keep the `Sections` page compact and mostly structurally unchanged
- fix runtime gating and state messaging first
- keep sync as an explicit action with honest recovery messaging

## Verification Requirements

You must not stop at build success.

Required:

1. `npm --prefix atlas-client run build`
2. `npm --prefix atlas-server run build`
3. verify `Sections` can open from cached/mirror-backed state during EnrollPro outage
4. verify ATLAS-owned home-room updates remain usable when degraded-write evidence is sufficient
5. verify sync button behavior is honest while upstream is unavailable
6. verify sync recovery works once upstream is back, if reachable
7. verify no false `Live data` label remains in degraded state

## Mandatory Tailnet Proof

Do not return `GO` without Tailnet/runtime proof.

At minimum, prove:

- `Sections` opens in degraded mode from ATLAS-owned data
- a safe ATLAS-owned home-room update path remains usable when the page is degraded but sufficiently bootstrapped
- sync remains blocked or fails honestly while EnrollPro is unavailable
- sync recovers once upstream becomes reachable again, if that state can be tested

If degraded `Sections` still renders but remains practically unusable for ATLAS-owned work, return `NO-GO`.

## Required Output

Return:

1. files changed
2. degraded writable-mode rule used for `Sections`
3. source-state and messaging changes
4. home-room persistence behavior in degraded mode
5. sync recovery behavior
6. build results
7. Tailnet verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `Sections` can open from ATLAS-owned data during EnrollPro outage
- the page is no longer blanket read-only when safe ATLAS-owned section work is possible
- home-room edits persist safely in degraded mode
- sync remains honest and recoverable once EnrollPro returns
- degraded/live state labeling is truthful
