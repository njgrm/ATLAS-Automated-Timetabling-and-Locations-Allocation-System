# TL-C02D — Apply Department Labels and Produce Fresh Teaching Load Preview

## Status and risk

- Risk: `HIGH` because this prompt authorizes a bounded shared-data mutation.
- Execution model: commit-based source/evidence handoff plus a fingerprint-bound
  data apply. This prompt does not opt into the historical recovery
  manifest/receipt chain.
- Final executor verdict: `REVIEW_REQUIRED`, never `GO`.
- Run this in a fresh executor session.

## Immutable authority

The operator supplied this exact approval:

```text
APPROVE PREVIEW D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A: create the 8 DepartmentLabel rows for school 1 exactly as fingerprinted by the department-authority preview endpoint.
```

This approval authorizes only creation of these eight `DepartmentLabel` rows
for school 1:

| Code | Label |
|---|---|
| AP | Araling Panlipunan |
| ENG | English |
| ESP | Edukasyon sa Pagpapakatao |
| FIL | Filipino |
| MAPEH | MAPEH |
| MATH | Mathematics |
| SCI | Science |
| TLE | Technology and Livelihood Education |

It authorizes zero aliases and no update, replacement, or deletion of an
existing value. It does not authorize Teaching Load reconciliation apply,
curriculum mutation, timetable generation, publication, schema/migration work,
service deployment/restart, or companion-system edits.

## Worktree and Git boundary

1. Fetch `origin/main` without modifying the main checkout.
2. Create or reuse only if clean:
   - worktree: `D:\ATLAS-worktrees\teaching-load-dept-apply`
   - branch: `work/teaching-load-dept-apply`
   - base: current `origin/main`, which must contain commit
     `e62f784ec7f737528e6b3bea8dd070c8fdbfc24b`.
3. If the named worktree or branch exists and is dirty, diverged, or based on a
   commit that does not contain the required base, stop. Do not delete, clean,
   reset, stash, rebase, amend, merge, or overwrite it.
4. Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`,
   `docs/reference/atlas-runtime-source-of-truth-map.md`,
   `docs/verification/department-authority-apply-r4a.json`, its `.sha256`
   sidecar, and the TL-C02 progress ledger before acting.
5. Do not push or merge. Commit only durable evidence/documentation created by
   this pass. Do not commit credentials, request headers, tokens, dumps,
   screenshots, logs, scratch scripts, or runtime artifacts.

## Pre-action gate — read-only and fail closed

Before the first write:

1. Verify this prompt's SHA-256 against its sidecar.
2. Recompute the department artifact byte SHA-256 and require exactly
   `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF`.
3. Recompute the artifact semantic hash and require
   `EAF49D08141E9B2F37E685D1B94A93BEA1B66E7D620755C37CFAAC6E352950BE`.
4. Verify the artifact decision fingerprint is
   `5147D2ADEF09822134F420179E074584245CDCE0644236F78FF4D66B3A85EFE3`
   and its endpoint preview fingerprint is the operator-approved
   `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`.
5. Resolve and report the database host classification and database name only;
   redact credentials. Require the configured target
   `atlas_recovery_clean_rebuild_20260905`. Any other target is `NO-GO`.
6. Resolve the authenticated operator school dynamically through `/auth/me`.
   Require school 1. Do not use a fallback school.
7. Read the active-year context and require the sole active, non-archived year
   to be year 8 / `2029-2030`. This is context evidence only; labels remain
   school-scoped.
8. Read the current department authority. Require exactly zero aliases and zero
   labels for school 1. If any row exists, do not overwrite or delete it; stop
   with `SOURCE_DRIFT` and return the conflicting rows without sensitive data.
9. Call the real authenticated production preview endpoint with exactly the
   eight approved labels and zero aliases. Require:
   - HTTP 200;
   - eight `create` changes and zero conflicts;
   - the exact approved fingerprint;
   - the exact current source revision expected by the artifact.
10. Capture before signatures for DepartmentAlias, DepartmentLabel,
    `FacultySubject`, `SubjectSectionOwnership`, `TeachingLoadCycle`, curriculum
    requirements, generation runs, and published revisions.

Use the live Tailnet route by default. If its route/build does not implement the
reviewed contract, stop with `RUNTIME_STALE`; this approval does not authorize a
restart or deployment.

## Authorized apply

Perform exactly one call to the real authenticated production endpoint:

`POST /api/v1/faculty-assignments/department-authority/apply`

The body must contain only:

- `schoolId: 1`;
- the eight approved labels in the exact code/label pairs above;
- `aliases: []`;
- `expectedFingerprint` from the just-completed live preview, which must equal
  the approved fingerprint;
- `expectedSourceRevision` from that same live preview;
- `confirmationText: "APPLY DEPARTMENT AUTHORITY"`.

If the response is not HTTP 200, if the transaction reports a conflict/drift,
or if the receipt differs from eight label creates and zero alias creates,
stop immediately. Preserve evidence and do not retry a failed mutation blindly.

## Post-action verification

1. Require DepartmentAlias count `0` and DepartmentLabel count `8` for school
   1. Verify every persisted code/label pair exactly.
2. Require the apply receipt to report `revalidatedInTransaction: true`,
   `replayed: false`, before `0/0`, after `0/8`, zero conflicts, and rollback
   rows limited to deletion of those exact eight labels.
3. Re-run the department preview against the now-persisted rows. It must report
   eight `unchanged`, zero `create`, and zero conflicts with a newly computed
   source revision/fingerprint.
4. Using that fresh post-apply preview, perform one idempotent replay through
   the production apply route. Require `replayed: true`, zero created rows,
   eight unchanged rows, and no timestamp/count change. This replay must use
   the fresh post-apply fingerprint and revision, not the obsolete pre-apply
   values.
5. Compare all non-department before/after signatures. Teaching Load ownership,
   FacultySubject, cycle, curriculum, runs, and publication must be unchanged.
   Unexpected mutation is an incident stop; do not continue.
6. Record the exact rollback recipe but do not execute it after a successful
   apply. Rollback is limited to deleting the eight rows created by this prompt
   after verifying their exact school/code/label identity.

## Fresh Teaching Load preview — zero write

After the label apply and replay verification succeed:

1. Call `GET /api/v1/faculty-assignments/reconciliation/readiness` for school 1,
   year 8.
2. Call `POST /api/v1/faculty-assignments/reconciliation/preview` with
   `{schoolId: 1, schoolYearId: 8}` through the real authenticated route.
3. Verify the sole-active-year authority, all 16 configured curriculum scopes,
   216 persisted requirements, department mapping with zero `UNMAPPED` faculty,
   `HG=0`, 20/20 adviser preservation, reconciliation accounting, and a
   zero-write before/after signature.
4. Treat all older TL-C02/TL-C02R1 preview fingerprints as
   `NON_APPLICABLE`. Never reuse them.
5. Save the fresh complete preview under
   `docs/verification/teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json`
   with a SHA-256 sidecar. Clearly distinguish:
   - endpoint semantic fingerprint accepted by the apply route;
   - source revision;
   - exact artifact byte SHA-256;
   - `applied: false` and `authorizesNoMutation: true`.
6. Include one exact operator approval sentence for the future Teaching Load
   reconciliation apply. Do not execute that apply in this prompt.

## Focused verification and independent review

- Run only the department-authority apply/gate suites and the two Teaching Load
  reconciliation suites affected by this workflow.
- Run server `tsc --noEmit`, server production build, and committed-range
  `git diff --check`.
- Do not run historical recovery or unrelated client/timetable suites.
- Obtain one fresh post-action reviewer that did not perform the apply. It must
  independently verify the live receipt, exact persisted labels, idempotent
  replay, non-department invariants, fresh TL preview binding, and Git boundary.
  If it finds a material evidence or source defect, correct only safe in-scope
  documentation/test issues and obtain one changed-scope review. Do not perform
  a second live label mutation.

## Durable outputs and handoff

Update only the relevant Teaching Load progress ledger, `CHANGELOG.md`, the new
TL preview plus sidecar, and one reviewer-authored post-action review artifact.
Do not edit production source unless the pre-action gate discovers a source
defect; if it does, stop and return `NO-GO` rather than mixing a source fix with
the approved data apply.

Stage the exact allowed durable paths, verify `git diff --cached --check`, and
create one conventional commit. Return:

1. `REVIEW_REQUIRED` or `NO-GO`;
2. base and candidate commit SHAs;
3. exact changed paths;
4. sanitized target and actor/year authority;
5. pre/post department counts and exact labels;
6. apply and idempotent-replay receipts;
7. non-department invariant comparison;
8. fresh TL readiness, plan totals, endpoint fingerprint, source revision,
   artifact byte SHA-256, and exact future approval sentence;
9. focused test counts and reviewer verdict;
10. confirmation that no Teaching Load apply, generation, publication,
    deployment/restart, schema/migration, or external-repository mutation
    occurred.

Suggested commit:

```text
docs(teaching-load): apply department labels and pin reconciliation preview
```
