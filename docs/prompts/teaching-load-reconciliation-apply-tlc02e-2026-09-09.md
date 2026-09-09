# TL-C02E — Apply Current-Year Teaching Load Reconciliation

## Status and risk

- Risk: `HIGH` — this prompt authorizes a bounded shared-data reconciliation.
- Final executor verdict: `REVIEW_REQUIRED`, never `GO`.
- Run in a fresh executor session.
- This prompt authorizes Teaching Load reconciliation only. It does not
  authorize department-label mutation, curriculum mutation, timetable
  generation, publication, deployment/restart, schema/migration work, or edits
  to EnrollPro, AIMS, SMART, or any other companion repository.

## Immutable operator approval

The operator supplied this exact approval:

```text
APPROVE PREVIEW F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446: apply the Teaching Load reconciliation for school 1 / year 8 (2029-2030) exactly as fingerprinted by the reconciliation preview endpoint. This authorizes NO department-label mutation.
```

The approval binds:

- school 1;
- sole active, non-archived year 8 / `2029-2030`;
- endpoint fingerprint
  `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`;
- source revision
  `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`;
- plan `RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0`;
- artifact byte SHA-256
  `0BBAC2BC532CBD884D41A015C87533036744EDFCBD6BBADA77E8ACF74FCA3BE9`.

Any mismatch invalidates this approval. Do not regenerate a different preview
and apply it under this approval.

## Worktree and Git boundary

1. Fetch `origin/main` without modifying the main checkout.
2. Create or reuse only if clean:
   - worktree: `D:\ATLAS-worktrees\teaching-load-apply`
   - branch: `work/teaching-load-apply`
   - base: current `origin/main`, which must contain commit
     `5020050b7c93be6c3c1ee55d5dc1355409b5f71f`.
3. If the named worktree/branch exists and is dirty, diverged, or lacks the
   required base, stop. Never delete, clean, reset, stash, rebase, amend, merge,
   or overwrite it.
4. Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`,
   `docs/reference/atlas-runtime-source-of-truth-map.md`, this prompt and its
   sidecar, the TL-C02 progress ledger, and
   `docs/verification/teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json`
   plus its sidecar.
5. Do not push or merge. Commit only bounded durable evidence. Never commit
   credentials, tokens, request headers, logs, dumps, screenshots, or scratch
   scripts.

## Pre-action gate — read-only and fail closed

Before any write:

1. Verify this prompt SHA-256 against its sidecar.
2. Recompute the preview artifact byte SHA-256 and require the exact value
   above. Verify `applied:false` and `authorizesNoMutation:true`.
3. Resolve the configured database target without printing credentials. Require
   `atlas_recovery_clean_rebuild_20260905`; any other database is `NO-GO`.
4. Resolve the authenticated actor through `/auth/me`; require an authorized
   officer/admin in school 1. No fallback school is allowed.
5. Resolve the full same-school active, non-archived year set. Require exactly
   one row and require year 8 / `2029-2030`.
6. Capture pre-apply signatures for:
   - all school-1/year-8 `SubjectSectionOwnership` rows, including owner,
     subject, section, version, and timestamps;
   - all affected `FacultySubject` rows, including section and grade arrays;
   - `TeachingLoadCycle` identity/state/version/timestamp;
   - audit count and maximum audit ID;
   - department aliases/labels and their revision;
   - subjects, sections, term config, curriculum requirements and term rows;
   - generation runs and published revisions.
7. Require the current department authority to remain exactly zero aliases and
   the eight approved labels. Department revision must remain unchanged by this
   prompt.
8. Call the real authenticated reconciliation readiness and preview routes for
   school 1/year 8. Require the exact approved fingerprint, source revision,
   plan totals, 264 demand pairs, zero unresolved, 20/20 adviser satisfaction,
   zero HG rows, zero unmapped faculty, 16 configured scopes, and 216 active
   requirements.
9. Require a zero-write preflight comparison. If the preview or source revision
   differs, stop with `SOURCE_DRIFT`; do not apply a regenerated fingerprint.

Use the live Tailnet route by default. If the live route does not implement the
reviewed contract, stop with `RUNTIME_STALE`; this approval does not authorize a
restart or deployment.

## Authorized apply

Perform exactly one authenticated production call:

`POST /api/v1/faculty-assignments/reconciliation/apply`

Body:

```json
{
  "schoolId": 1,
  "schoolYearId": 8,
  "expectedFingerprint": "F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446",
  "expectedSourceRevision": "90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F",
  "confirmationText": "APPLY TEACHING LOAD RECONCILIATION"
}
```

Require HTTP 200 and a receipt with:

- `fingerprint` equal to the approved fingerprint;
- `inserted: 0`;
- `moved: 30`;
- `retired: 1`;
- `retained: 234`;
- `unresolved: 0`;
- `hgRemoved: 0`;
- `replayed: false`;
- `revalidatedInTransaction: true`;
- one nonzero reconciliation audit operation ID.

On any non-200 response, drift, fingerprint mismatch, transaction conflict,
unexpected totals, or partial-state discrepancy: stop immediately, preserve
evidence, and do not retry blindly or attempt manual SQL repair.

## Post-action verification

1. Re-read the complete ownership set. Require 264 unique demanded
   subject-section ownerships and no stale outside-curriculum row.
2. Verify every ownership owner against the approved plan. Require all 30 moves
   and the single retirement to match exactly; no insert is permitted.
3. Recompute every affected `FacultySubject.sectionIds` and `gradeLevels` from
   the resulting ownerships. Require exact sorted-unique parity and no dangling
   or cross-school references.
4. Verify the cycle remains `POPULATED` and changed only through the authorized
   reconciliation refresh. Record its new version/timestamp rather than
   assuming a hardcoded value.
5. Verify exactly one `TEACHING_LOAD_RECONCILIATION` audit belongs to the apply
   receipt. Authentication audit effects, if any, must be disclosed separately.
6. Require department labels/aliases, curriculum rows, term configuration,
   subjects, sections, generation runs, and published revisions to remain
   byte/semantic-equivalent to the pre-apply signature.
7. Call readiness again. Require `ready:true`, demand 264, owned 264,
   unresolved 0, valid ownership 264, accepted exceptions 0, and no blockers.
8. Call preview again. Require all 264 demanded pairs to be `RETAIN`, zero
   INSERT/MOVE/RETIRE/UNRESOLVED actions, zero HG rows, zero unmapped faculty,
   20/20 adviser satisfaction, and the workload distribution expected by the
   approved plan: zero-load 0, adviser-only 0, below-standard 38, at-standard
   4, excess 0, over-cap 0.
9. Use the fresh post-apply fingerprint and source revision to perform one
   idempotent reconciliation replay. Require HTTP 200, `replayed:true`, all 264
   retained, every write-ID array empty, operation ID 0, and byte-identical
   ownership/FacultySubject/cycle/audit signatures before versus after replay.
10. Record an exact rollback package derived from the pre-apply snapshot, but do
    not execute rollback after a successful verified apply. Any rollback needs
    a new explicit operator instruction.

Unexpected shared-data mutation is an incident stop.

## Generation-readiness baseline — read-only only

After reconciliation and replay verification:

1. Query the real generation gate route, current-year run list, timetable
   unassigned-workflow summary, dashboard lifecycle/readiness, effective
   Teaching Load, curriculum readiness, subjects, sections, and room/building
   inventory.
2. Produce one concise read-only readiness artifact at
   `docs/verification/generation-readiness-post-tlc02e-2026-09-09.json` with a
   byte SHA-256 sidecar.
3. Record exact current blockers and counts. Do not repeat historical blocker
   numbers as current truth.
4. Explicitly separate:
   - process/gate blockers;
   - hard scheduling constraints;
   - unassigned demand;
   - data/source-authority gaps;
   - UX-only gaps.
5. The readiness artifact authorizes no generation or publication and must say
   `authorizesNoMutation:true`.

## Focused verification and review

- Run the two Teaching Load reconciliation suites, department-authority gate
  regression, server `tsc --noEmit`, server production build, and committed
  range `git diff --check`.
- Do not run historical recovery, unrelated client, or broad timetable suites.
- Obtain one fresh reviewer that did not perform the apply. It must independently
  verify the receipt, complete post-state, derived-table parity, replay zero-write
  proof, protected invariants, readiness baseline, and Git boundary.
- If the reviewer finds a documentation/test-only defect, correct it and obtain
  one changed-scope review. Do not perform a second non-idempotent live apply.
- A source/product defect discovered after approval is `NO-GO`; do not mix a
  source fix into this data-apply pass.

## Durable handoff

Update only the relevant TL progress ledger, `CHANGELOG.md`, the post-apply
receipt/evidence, the generation-readiness artifact plus sidecar, and the
reviewer-authored artifact. If no dedicated receipt file exists, create
`docs/verification/teaching-load-reconciliation-apply-tlc02e-2026-09-09.json`
with a byte SHA-256 sidecar.

Stage the exact allowed durable paths, verify `git diff --cached --check`, and
create one conventional commit. Return:

1. `REVIEW_REQUIRED` or `NO-GO`;
2. base and candidate SHAs;
3. exact changed paths;
4. sanitized target and actor/year authority;
5. apply receipt and exact mutation totals;
6. ownership/FacultySubject/cycle/audit before-after proof;
7. protected-domain invariants;
8. post-apply readiness and replay proof;
9. the current generation-readiness blocker matrix;
10. focused test counts and reviewer verdict;
11. confirmation that no generation, publication, department, curriculum,
    schema/migration, deployment/restart, or external-repository mutation
    occurred.

Suggested commit:

```text
docs(teaching-load): apply current-year reconciliation and record readiness
```
