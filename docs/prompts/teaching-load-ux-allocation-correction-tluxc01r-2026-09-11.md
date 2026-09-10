# TL-UX-C01R — Teaching Load Suggestion and Balance Authority Correction

## Execution boundary

Continue in the existing clean worktree and branch:

- Worktree: `D:/ATLAS-worktrees/teaching-load-ux-c01`
- Branch: `work/teaching-load-ux-c01`
- Current candidate: `1f867eb82124c181c79cfcb9cf5227c4577efad3`

Create additive correction commits. Do not amend, rebase, merge, push, generate,
publish, apply live Teaching Load changes, restart port 5001, alter migrations,
or edit EnrollPro/AIMS/SMART. External repositories are read-only.

Read first:

- `docs/analysis/teaching-load-year9-allocation-diagnostic-2026-09-11.md`
- `docs/progress/teaching-load-ux-c01-2026-09-11-progress.md`
- the original TL-UX-C01 prompt

## Confirmed production defect

School 1/year 9 has 265/265 owned pairs, seven faculty at 37.5 teaching hours,
and qualified zero-load receivers in ESP, FIL, ENG, and MATH. `autoFill()` keeps
all existing rows and produces no suggestions because it only fills uncovered
pairs. The separate over-cap preview finds 14 valid moves. The candidate UI can
nevertheless claim everyone is within capacity. The original prompt's bounded
adviser-section preference was also skipped.

## Required outcome

### 1. One truthful suggestion preview

- Make the daily `Suggest Teaching Load draft` workflow evaluate both coverage
  and distribution.
- Keep existing valid rows only when doing so does not leave avoidable
  individual-standard excess while a qualified receiver has capacity.
- Return structured exact actions: `RETAIN`, `INSERT`, and `MOVE`; do not encode
  moves only as warning strings.
- Show separate counts for covered rows, uncovered rows, proposed moves,
  unresolved imbalance, above-standard faculty, and absolute-hard-cap breaches.
- Never say “everyone is within capacity” merely because all pairs have owners.
- Use consistent terms: 30 hours is the teaching standard/individual maximum in
  the current data; 40 hours is the policy absolute hard cap.

### 2. Correct deterministic allocation

- Reuse the canonical qualification evaluator and rotation-aware capacity
  ledger. Do not introduce client-owned department or specialization rules.
- Prefer qualified lower-loaded receivers in the same canonical department.
- A move must reduce the donor's excess and must not cause the receiver to
  exceed the selected preview mode's limit.
- Do not move HG or any authoritative `REFERENCE_ONLY` subject.
- Preserve subject/program/section scope, term/rotation semantics, unique
  ownership, and deterministic ordering.
- When an adviser has no real teaching pair for their advised section, prefer
  one otherwise equally eligible demanded pair for that exact section. This is
  a tie-break only and must never bypass qualification, scope, uniqueness,
  capacity, or rotation rules.

### 3. One atomic reviewed apply

- Bind the persisted proposal to actor school, sole active non-archived year,
  policy revision, faculty revisions, current ownership revision, curriculum
  demand revision, and the exact preview plan.
- Recompute and compare the complete plan inside one Serializable transaction.
- Apply all approved inserts/moves or none. On stale source, conflict, or
  validation failure, return a typed error with zero writes.
- Idempotent replay returns the same receipt with no extra ownership, cycle, or
  audit writes.
- Preserve `FacultySubject.sectionIds`/grade-level parity and
  `SubjectSectionOwnership` uniqueness.
- The ordinary UI must expose only this reviewed proposal/apply boundary. Do not
  add the legacy rebalance route as a second primary control.

### 4. Correct TL-UX-C01 omissions

- Replace the false complete-coverage/capacity state in
  `AutoFillSummaryModal`.
- Finish the original prompt's adviser-section priority and its six stated
  negative controls.
- Reconcile the handoff's changed-path count with the actual Git range (26 paths
  before this correction, not 25).

## Required failing-first controls

Use disposable schools/years and production service/route entry points:

1. Fully owned demand with two ESP and two FIL donors at 37.5h plus mapped
   zero-load same-department receivers: old auto-fill returns zero suggestions;
   corrected preview returns exact moves.
2. Remove/deactivate the receivers: imbalance remains explicit and unresolved;
   no ineligible cross-department move appears.
3. Receiver near the selected limit: a proposed move cannot exceed it.
4. Same subject/section already owned by receiver, stale ownership, stale
   faculty revision, stale policy, and concurrent owner change all fail closed.
5. Mixed valid and invalid actions prove all-or-nothing apply and one audit.
6. Replay proves zero additional writes.
7. HG/reference-only rows never enter insert/move plans.
8. Adviser tie-break positive case plus all six negative cases from the original
   prompt.
9. Mounted-route actor-school mismatch, historical year, zero/multiple active
   mirrors, malformed IDs, and missing confirmation return typed 4xx with zero
   writes.
10. UI regression feeds the live-shaped `265 retained + seven excess warnings`
    result and proves no capacity-success copy is rendered.

## Verification

- Run the new service and mounted-route suites.
- Rerun Teaching Load suggestion proposal, automation/capacity, reconciliation
  authority, assignment security, TL-UX ownership, canonical workload, route
  intent, and UX guardrails suites affected by the correction.
- Run server/client `tsc --noEmit`, production builds, and complete-range
  `git diff --check`.
- Run isolated-candidate Playwright at desktop, mobile, and 320px reflow using
  intercepted write APIs. Verify the move preview is understandable, keyboard
  reachable, and has one apply action.
- Run a live Tailnet read-only proof only: reproduce the year-9 counts and prove
  the corrected candidate identifies the idle ESP/FIL receivers. Block every
  non-login write request.

## Review and handoff

Commission one fresh independent changed-scope reviewer after all corrections.
Return `REVIEW_REQUIRED` with original base SHA, new candidate SHA, additive
commits, exact changed paths, RED/GREEN evidence, live read-only before/after
signature, proposed year-9 move totals, remaining unresolved rows, and review
verdict. Do not merge or push.
