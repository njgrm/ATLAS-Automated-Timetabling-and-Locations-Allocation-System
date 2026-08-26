# Gemini Execution Prompt: Phase 3 Teaching Load Degraded Write and Specialization Slots UX One-Shot

## Objective

Expose the new degraded writable-mode and special-program specialization-slot behavior in `Teaching Load` without undoing the current calmer workspace.

This pass assumes the backend/runtime contract for degraded writable mode and special-program specialization slots already exists.

Your job is to make those capabilities understandable and usable for schedulers.

## Out of Scope

Do not:

- redesign the page from scratch
- rewrite staffing math
- change backend business rules yourself
- re-expand the page into tall dashboard panels
- reduce the current assignment workspace density

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-post-outage-discrepancy-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-ux-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- any new `Teaching Load` components introduced by the backend follow-up pass

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Tabs`
- `Popover`
- `Sheet`
- `Tooltip`
- `HoverCard`
- `motion`

## Facts To Treat As Settled

- current calmer `Teaching Load` UI is the baseline
- assignment workspace density must be preserved
- degraded source honesty is required
- `Teaching Load` should now support safe degraded writable mode where local evidence exists
- `SPA_SPEC` / `SPS_SPEC` should now behave as specialization-aware section slots
- ATLAS may now expose approved capability / compatibility overrides for weak upstream specialization data

## UX Problems To Solve

### 1. Degraded writable mode needs clear operator language

Schedulers need to tell:

- what is cached but still editable
- what is cached and read-only
- what is blocked because upstream is unavailable

### 2. Special-program slots need to feel like assignable workflow units

Schedulers need to see:

- the umbrella subject
- the section’s required specialization
- the teacher’s current specialization or approved compatibility
- whether the match is direct, approved, or constrained

### 3. Capability overrides must feel honest, not magical

If ATLAS allows an approved compatibility override, the UI must make it obvious that:

- the teacher is being allowed by local ATLAS approval
- this is not the same as upstream specialization truth

## Scope

### In Scope

#### A. Surface degraded writable mode clearly

Required:

- make writable degraded mode obvious and trustworthy
- distinguish at least:
  - live upstream-backed
  - cached but writable
  - cached read-only
  - blocked / no cache

#### B. Make `SPA_SPEC` / `SPS_SPEC` section slots visually first-class

Required:

- show section-level specialization requirement clearly in the assignment workflow
- show teacher-side specialization or approved compatibility clearly
- make match quality easy to scan without turning the page into a diagnostic console

#### C. Expose approved compatibility honestly

Required:

- if a teacher is assignable through ATLAS-approved compatibility, label that explicitly
- make it distinct from a direct specialization match
- keep the treatment compact and scheduler-friendly

#### D. Preserve current workspace direction

Required:

- keep the current compact workspace
- avoid tall new panels
- avoid card-heavy regression
- keep subject-assignment throughput high

### Out Of Scope

Do not:

- redo the whole page again
- invent new backend semantics not delivered by the backend pass
- collapse shortage and redistribution views back into one ambiguous surface

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify degraded writable mode is understandable at a glance
- verify `SPA_SPEC` / `SPS_SPEC` slots are easier to assign correctly than before
- verify current workspace density remains materially usable on a normal laptop viewport

## Required Output

Return:

1. files changed
2. degraded writable-mode UX changes
3. specialization-slot UX changes
4. capability-override UX treatment
5. confirmation that workspace density was preserved
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- schedulers can tell what is writable during outage and why
- `SPA_SPEC` / `SPS_SPEC` section-level specialization slots are clearer and more actionable
- approved capability overrides are explicit and honest
- the current calmer `Teaching Load` workspace remains intact
