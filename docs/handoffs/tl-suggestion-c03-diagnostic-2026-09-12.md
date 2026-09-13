# TL-SUGGESTION-C03 diagnostic handoff

Status: `REVIEW_REQUIRED`

Candidate base: `4e5ef1f60193a8225af7bceac13a34a4c126152d`

Branch: `work/tl-suggestion-c03`

## Finding

The active-year Teaching Load reconciliation path and the suggestion-proposal
path do not share one qualification authority.

The canonical evaluator states that it replaces the scattered automation
logic, including `teaching-load-automation.service.ts`, in
`atlas-server/src/services/qualification-evaluator.service.ts:1-14`.
The reconciliation resolver builds a persisted-only department/owner-prefix/
cross-department policy snapshot and evaluates each active, non-placeholder
faculty candidate through that policy in
`atlas-server/src/services/teaching-load-reconciliation.service.ts:633-690`.
That path explicitly retains zero-load active faculty and returns typed
qualification, adviser, and unresolved reasons.

The suggestion path still uses the legacy static resolver:

- `atlas-server/src/services/teaching-load-automation.service.ts:1050-1105`
  uses `matchesSubjectOwnershipDepartment()` plus hard-coded normalization.
- `atlas-server/src/services/teaching-load-automation.service.ts:1244-1321`
  filters coverage candidates through that resolver and does not receive the
  persisted policy or section program type.
- `atlas-server/src/services/teaching-load-automation.service.ts:2600-3010`
  repeats the same static receiver test for over-cap reallocation. Zero-load
  faculty are present in the broad active-faculty query, but a persisted alias,
  owner-prefix, cross-department permission, or program-policy difference can
  make a same-department FIL/ESP receiver ineligible to this path while another
  faculty member remains visibly overloaded.

The proposal result also loses the explanation needed to distinguish these
cases. `OverCapRebalanceResult` exposes only `overCapFaculty` and selected
`proposedMoves` (`teaching-load-automation.service.ts:2600-2660`), and the
client renders only selected move rows in
`atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx:522-577`.
There is no candidate/rejection list showing whether a zero-load faculty member
was rejected for qualification, program scope, stale/inactive status, adviser
preference, or capacity.

## Evidence

- `npx tsx atlas-server/src/__tests__/teaching-load-distribution-plan.test.ts`
  passed 13/13 with `DATABASE_URL` cleared and the repository dependency
  junction used only for local module resolution.
- `npx tsx atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`
  passed all hermetic A1-A14 assertions, including HG exclusion, zero-load
  Filipino discovery, adviser preference, typed rejection reasons, and
  canonical qualification differential checks. Its optional database fixture
  was not accepted as evidence: the test loaded a local server environment,
  created disposable school `260`, then failed in its own cleanup because the
  checked-out Prisma client has no `offeringTermAssignment` model. The exact
  school `260` residue was immediately removed and verified absent. No live
  school/year, generation, publication, or Teaching Load apply was touched.
- No live Tailnet or shared recovery database evidence is claimed for this
  source-only lane.

## Authority and safety boundary

The suggestion preview is actor/year gated by
`createTeachingLoadSuggestionProposal()` and
`assertTeachingLoadWriteAuthority()` in
`atlas-server/src/services/teaching-load-suggestion-proposal.service.ts`, and
apply freshness is bound to the reviewed distribution signature and persisted
workload-policy revision before its Serializable transaction. Those controls
remain intact. This finding concerns candidate correctness and explainability,
not authorization or apply atomicity.

## Required successor

Unify the suggestion coverage and over-cap receiver evaluation with the
persisted-only `qualification-evaluator.service.ts` policy snapshot, including
the section program type, and return bounded candidate diagnostics. The client
must show zero-load candidates and typed rejection reasons beside proposed
moves. Add disposable/hermetic regression coverage for FIL and ESP aliases,
program mismatch, cross-department permission, adviser-own-section preference,
HG neutrality, hard-cap capacity, and deterministic ordering before any live
verification or integration decision.

Decision: `REVIEW_REQUIRED`; do not integrate or claim production correction
from this source-only evidence.
