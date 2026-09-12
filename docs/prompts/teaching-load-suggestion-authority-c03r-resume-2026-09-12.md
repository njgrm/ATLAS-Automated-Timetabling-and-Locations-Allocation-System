# TL-SUGGESTION-C03R — Resume and close suggestion authority

Role: `EXECUTOR`

Status: `READY_TO_RESUME`

## Immutable starting boundary

- Worktree: `D:\ATLAS-worktrees\tl-suggestion-c03`
- Branch: `work/tl-suggestion-c03`
- Accepted base: `4e5ef1f60193a8225af7bceac13a34a4c126152d`
- Existing diagnostic commit: `2292b25dc4389389a45fc4aa17cb464e18d12598`
- Existing dirty paths, which must be preserved and reviewed before editing:
  - `atlas-server/src/routes/faculty-assignment.router.ts`
  - `atlas-server/src/services/qualification-evaluator.service.ts`
  - `atlas-server/src/services/teaching-load-automation.service.ts`
- Binary diff hash observed by the planner before handoff:
  `c52898a3f5e71c81c40e208ace4055044cbd1c7f`

Do not reset, restore, checkout, stash, clean, discard, or overwrite these
uncommitted edits. They are partial executor work from the interrupted Codex
turn. First inspect them and preserve all correct portions. If the hash differs,
stop and report the exact status/diff; do not guess ownership.

## Objective

Complete one coherent source correction so Teaching Load suggestions and
over-cap redistribution use the same persisted qualification authority as
canonical reconciliation, include active zero-load faculty such as qualified
Filipino and ESP teachers, explain every bounded rejection, and enforce exact
actor-school/current-active-year authority on direct previews and reports.

This is source/test work only. It authorizes no Teaching Load apply,
carry-forward apply, generation, publication, deployment, migration, schema
change, live login, or live/shared database mutation.

## Production defects to close

1. `autoFill()` and over-cap receiver selection still diverge from the
   persisted evaluator used by reconciliation. Finish routing both through a
   single policy snapshot that includes department aliases/labels, subject
   owner prefixes, explicit cross-department permissions, specialization
   aliases, subject program scopes, and the section's `programType`.
2. `persistedOnly: true` must reject legacy prefix, subject-name, glossary, and
   cross-language inference when no persisted authority grants eligibility.
   Prove this with a negative control that the old fallback would accept.
3. Active non-placeholder faculty with zero current teaching minutes must be
   evaluated and ranked. Zero load is not a rejection reason.
4. Preserve deterministic ordering, adviser-own-section preference, rotation
   peak accounting, actual teaching-minute caps, HG/ARAL exclusion, and
   advisory/ancillary load neutrality.
5. The direct routes for auto-fill preview, staffing-needs report, and over-cap
   preview must reject cross-school and inactive/historical/ambiguous-year
   requests before suggestion service work. A read-only preview is still
   privileged school/year data.
6. Return bounded, stable candidate diagnostics from coverage and over-cap
   previews. At minimum distinguish program-scope incompatibility, missing
   qualification authority, hard-cap exhaustion, inactive/stale/placeholder
   faculty when applicable, and current-owner/not-a-receiver cases. Do not leak
   another school's faculty through diagnostics.
7. Render concise rejection explanations in the existing suggestion summary
   UI using current shadcn/Radix patterns. Show why a visible zero-load faculty
   member was or was not eligible without turning the dialog into a raw log.
8. Preserve the reviewed suggestion-proposal fingerprint/freshness and
   Serializable apply transaction. Direct auto-fill apply remains retired.

## Required failing-first controls

- Same-school zero-load Filipino candidate accepted through a persisted alias.
- Same-school zero-load ESP candidate accepted through persisted owner
  department authority.
- Program mismatch rejected even when department/specialization otherwise
  matches.
- Explicit cross-department permission accepted; its absence rejected.
- `persistedOnly` rejects the legacy-prefix/glossary mutant.
- Adviser who lacks another real subject for the advisory section wins only
  within the accepted qualification/cap tier.
- HG and ARAL contribute no ordinary demand or teaching minutes; advisory
  credit does not consume subject capacity.
- Receiver exceeding the effective persisted hard cap is rejected.
- Equal candidates produce deterministic order and stable diagnostics.
- Cross-school, historical year, zero-active-year, and ambiguous-active-year
  route requests return the existing typed authority errors with zero service
  writes/dispatch beyond the authority read.
- Direct non-preview auto-fill remains `TEACHING_LOAD_PROPOSAL_REQUIRED` after
  authority checks.

Use hermetic/in-memory clients and zero-write instrumentation. Do not run the
known cleanup-risk database fixture against
`atlas_recovery_clean_rebuild_20260905`; the prior generated Prisma client did
not expose `offeringTermAssignment` during cleanup. A fresh disposable database
may be used only if the prompt is separately amended to authorize it.

## Verification

Run the smallest decisive affected suites, including new suggestion-path and
mounted-route tests, then server/client `tsc --noEmit`, server/client production
builds, and `git diff --check`. Tests must exercise `autoFill()`,
`previewOrApplyOverCapRebalance()`, and mounted Express routes, not only helper
functions or canonical reconciliation.

Commit additive corrections without amending or rebasing prior history. Do not
merge or push. Do not commission a duplicate advisory review: return the clean
candidate to the primary planner for fresh independent QA.

## Return contract

Return `REVIEW_REQUIRED` with:

- exact base, prior commit, and final candidate SHA;
- confirmation that the inherited dirty diff was preserved or an exact account
  of intentional changes to it;
- exact changed paths for the complete range and for the new correction;
- production call-path trace;
- mandatory tally: total/passed/blocked/unperformed;
- test/build/diff results;
- zero-mutation statement and remaining risks;
- single next action: fresh QA of the exact final range.

Suggested commit:

```text
fix(teaching-load): unify suggestion qualification authority
```
