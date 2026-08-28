# Gemini Execution Prompt: Phase 3 Offline Source-State And Layman Copy One-Shot

## Objective

Normalize outage-mode communication across ATLAS so pages that depend on EnrollPro explain their current state honestly and in plain language.

This is not a visual redesign pass.
It is a shared UX/copy pass for outage behavior, source-state clarity, and confidence during degraded operation.

The current UI still uses labels that make sense to developers more than schedulers or faculty.

## Out of Scope

Do not:

- redesign page layouts from scratch
- add large new dashboard cards
- change backend runtime contracts
- reopen Teaching Load load-math design
- introduce new branding systems

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-offline-capability-and-outage-ui-audit-2026-05-25.md`
- `docs/analysis/phase3-enrollpro-outage-runtime-independence-audit-2026-05-24.md`

Inspect directly:

- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Audit.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- any shared status/banner/badge components those pages use

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Badge`
- `Tooltip`
- `Alert`
- `Popover`
- `motion`

## Facts To Treat As Settled

- the system now has real degraded behavior on several scheduler pages
- the remaining problem is not only transport; it is communication
- current labels like these are too technical:
  - `Live data`
  - `Cached snapshot`
  - `ATLAS Mirror`
  - `Live upstream-backed`
  - `Connected: Live Data`
  - `Review Only: Backup`
  - `No Active Year`
- users need simple answers to:
  - are we connected to EnrollPro right now?
  - am I looking at saved ATLAS data?
  - can I keep working?
  - will my changes sync later?
  - what still needs EnrollPro to come back?

## Product Outcome

On every affected page, a non-technical scheduler or faculty user should understand:

- what data they are seeing
- whether it was verified live or loaded from saved ATLAS state
- what actions are still safe
- what actions are temporarily unavailable
- what will happen when EnrollPro comes back

The page should not feel like an internal incident console.

## Pages In Scope

- shell / sidebar / shared page framing
- `Sections`
- `Teachers`
- `Teaching Load`
- `Audit`
- `Dashboard`

If shared copy or badge primitives can improve more than one page at once, prefer that.

## Main Problems To Solve

### 1. Source-state labels are too technical

Replace or clarify developer-ish labels with plain operator language.

Examples of the kind of meaning to communicate:

- `Verified with EnrollPro`
- `Working from saved ATLAS data`
- `Saved data only`
- `You can keep working`
- `This action needs EnrollPro to come back`
- `Changes will sync after connection returns`

### 2. The shell does not explain degraded context well enough

If branding or active-year verification is missing or stale, the shell should say so in a calm and understandable way.

Do not leave the user with only:

- `No Active Year`

when the real state is closer to:

- last known school year is being used
- live verification is temporarily unavailable

### 3. Current degraded banners are inconsistent

Some pages are honest but too technical.
Some are calm but vague.
Some use different terms for the same situation.

Unify the language family across the in-scope pages.

### 4. Users need action-oriented outage guidance

Pages should explain what the user can do next:

- keep reviewing
- keep editing safe local data
- wait to sync
- retry once EnrollPro returns

The copy should explain outcome, not implementation.

## Implementation Direction

### A. Normalize a shared source-state language system

Create a consistent wording pattern for:

- live verified
- saved ATLAS data
- saved data only / read-only
- no saved data
- sync unavailable

You may keep compact badges, but the meaning must be obvious through nearby text or tooltip support.

### B. Use layman language first

Prefer:

- `saved data`
- `verified live`
- `connection returned`
- `keep working`

Avoid making the primary surface depend on internal terms like:

- `mirror`
- `snapshot`
- `upstream-backed`
- `runtime context`

Those ideas can remain in tooltips only if needed.

### C. Keep layouts compact

Do not turn the pages into large alert-heavy surfaces.
Prefer:

- compact status chips
- one calm banner where needed
- short guidance text
- lightweight tooltips for extra detail

### D. Continue from the current page designs

Do not undo the existing calmer `Teaching Load` workspace.
Do not rework `Sections`, `Teachers`, or `Audit` structurally unless necessary for message clarity.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML controls were introduced
- verify no new global scrollbars were introduced
- verify the source-state language is internally consistent across the in-scope pages
- verify a non-technical user can tell:
  - whether data is live or saved
  - whether they can keep working
  - whether sync must wait for EnrollPro

## Required Output

Return:

1. files changed
2. shared source-state language decisions
3. shell outage-copy changes
4. page-specific wording/status changes for:
   - `Sections`
   - `Teachers`
   - `Teaching Load`
   - `Audit`
   - `Dashboard`
5. confirmation that compact layouts were preserved
6. build results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the in-scope pages no longer speak in mostly technical/internal terms during outage mode
- a scheduler can quickly tell whether they are viewing verified live data or saved ATLAS data
- the shell explains degraded state more clearly than the current `No Active Year` fallback
- the copy tells users what they can still do and what will happen when EnrollPro returns
