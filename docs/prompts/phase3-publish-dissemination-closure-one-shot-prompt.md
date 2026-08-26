# Copilot Execution Prompt: Phase 3 Publish Dissemination Closure One-Shot

## Objective

Close the publish/dissemination stream so the product is not merely API-ready, but genuinely publish-ready and user-facing.

This pass must verify and complete the publish lifecycle across:

- publish action and hard/soft guard behavior
- user-facing publish confirmation and failure states
- consistency between scheduler review, faculty published view, and public published view

## Out of Scope

Do not:

- reopen unrelated Teaching Load work
- redesign the whole review console
- claim generator closure in this pass
- implement student/public UX polish that belongs in the Gemini public-schedule pass

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/phases/phase-5-publish.md`
- `docs/phases/publish-readiness-implementation-plan.md`
- `docs/phases/requirements-phase4-review.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- latest faculty and public published-schedule evidence after those passes land

Inspect directly:

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/routes/generation.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- review/publish client surfaces:
  - `atlas-client/src/components/timetable/*`
  - `atlas-client/src/hooks/useTimetableMutations.ts`

## Facts To Treat As Settled

- published schedule APIs exist
- faculty published schedule view exists
- public published schedule route/page should exist by the time this pass runs
- hard violations must block publish
- soft violations may require explicit acknowledgment before publish
- published-run integrity reconciliation has already completed
- the current truthful live state is:
  - there is **no valid published run** for school `1` right now
  - public/faculty published endpoints currently return `PUBLISHED_RUN_NOT_FOUND`
  - invalid legacy `FAILED + published` rows were already reconciled out of the DB

## Required Product Outcomes

By the end of this pass:

1. publish behavior is user-facing and strict, not just API-capable
2. publish blockers are clearly surfaced in the review workflow
3. if a publishable run exists, a fresh successful publish visibly becomes the source of truth for faculty and public views
4. faculty and public views reflect the same published run truth cleanly
5. if no publishable run exists, the system reports that state honestly and does not fake dissemination success

## Required Implementation Scope

### A. Strict publish guards

Required:

- verify hard-violation publish blocking is enforced end-to-end
- verify soft-violation acknowledgment behavior is enforced end-to-end where intended
- surface publish failures in clear user-facing terms

### B. Publish success truth propagation

Required:

- after successful publish, the latest published truth must be the same truth used by:
  - faculty `/my/schedule`
  - public student schedule page
  - public published schedule APIs

If no valid publish can be produced in the current live state:

- do not force a synthetic success state
- return a truthful blocker summary explaining why dissemination closure cannot yet be completed

### C. Review-to-publish product readiness

Required:

- verify the review workspace makes publish status and blockers understandable
- verify the publish path does not still feel placeholder-grade
- verify user-facing post-publish confirmation is credible and tied to actual published read models
- explicitly test from the current truthful no-published baseline, not from a historical published assumption

### D. Runtime/docs parity

Required:

- if behavior or source-of-truth assumptions changed, update:
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `ATLAS-PUBLIC-API.md` if needed

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- Tailnet verification required

### Required Tailnet proofs

1. Publish attempt with hard violations is blocked and user-facing.
2. Publish attempt with allowable soft-warning path behaves correctly.
3. If a valid publish succeeds, it produces a latest published run visible in:
   - review/publish confirmation path
   - faculty published view
   - public published view
   - public published APIs
4. If no valid publish succeeds, return a truthful blocker verdict instead of claiming closure.
5. The published run truth is consistent across all dissemination surfaces after the pass.

## Required Output

Return:

1. files changed
2. publish guard verification summary
3. user-facing publish lifecycle changes
4. faculty/public truth consistency summary
5. verification results
6. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- publish guardrails are strict and user-facing
- published truth is consistent across scheduler, faculty, and public dissemination surfaces
- the publish flow no longer feels placeholder-grade
- and a real valid published run is either:
  - successfully produced and visible end-to-end
  - or, if not possible, the pass returns `NO-GO` with a truthful blocker diagnosis instead of a false closure
