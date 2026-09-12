# TL-AUTHORITY-DIAGNOSTIC-C02 advisory review

Date: 2026-09-12
Base: `8f48a2fe6ea883189221e196c7a3d28ddcb629b8`
Review scope: changed Teaching Load authority/read-only diagnostics only.

## Findings

- The shared Teaching Load minute computation now ignores `HG` by subject code,
  so legacy persisted HG ownership cannot affect workload totals, overload, or
  candidate-capacity calculations.
- The reconciliation preview remains the production read-model authority. It
  exposes demanded pairs, persisted non-HG owned pairs, zero-load active
  faculty, valid adviser mappings, legacy HG rows, policy-gated advisory credit
  eligibility, policy-based overload totals, department candidate counts, and
  typed unresolved reasons.
- `GET /api/v1/faculty-assignments/authority-diagnostics` is read-only and
  delegates to the same preview path; the mounted route control observed
  `zeroWriteProof.preview=true` and `writes=0`.
- Qualification and program/department scope remain delegated to the existing
  persisted-policy evaluator; no subject-name or prefix fallback was added.

## Verification

- Hermetic reconciliation controls: 83 passed, 0 failed.
- Server TypeScript/production build: passed.
- Client production build: passed.
- `git diff --check`: passed.
- Mounted route diagnostics assertions: passed against a disposable fixture.
- The pre-existing mounted reconciliation route test still fails after its
  diagnostics assertions at the old apply/replay fixture expectation
  (`replayed=true`, `inserted=0`, then a null FacultySubject read). This is
  outside the read-only diagnostics change and keeps the candidate at
  `REVIEW_REQUIRED`.

## Decision

`REVIEW_REQUIRED` — do not integrate or perform Teaching Load suggestion/apply,
carry-forward apply, generation, publication, migration, deployment, or restart
from this candidate.
