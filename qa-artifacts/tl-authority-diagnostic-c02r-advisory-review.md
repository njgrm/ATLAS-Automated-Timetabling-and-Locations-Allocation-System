# TL-AUTHORITY-DIAGNOSTIC-C02R changed-scope advisory review

Date: 2026-09-12
Base candidate: `5f1525d2cff4441ba9692aff54659f29eccc6f33`
Correction scope: read-only system-token access for the mounted Teaching Load authority diagnostics route.

## Findings

- `GET /api/v1/faculty-assignments/authority-diagnostics` still requires an explicit positive `schoolId` query value and an explicit positive `schoolYearId` when supplied; no school fallback was added.
- The route permits an unscoped read only when `authenticateWithSystemToken` set `req.user.authSource` to `system`. JWT callers remain actor-school scoped: a JWT without `schoolId` returns `ACTOR_SCHOOL_REQUIRED`, and a cross-school JWT returns `SCHOOL_MISMATCH`.
- The service option is read-only and is not passed by the operator preview or apply routes. `zeroWriteProof` remains `{ preview: true, writes: 0 }` for the system-token diagnostics request.
- HG exclusion and zero-load faculty diagnostics remain unchanged.

## Verification

- Hermetic reconciliation suite: 83 passed / 0 failed (database-backed section skipped because the direct command did not inject `DATABASE_URL`).
- Mounted disposable route test: the new system-token success, unscoped-JWT rejection, cross-school-JWT rejection, and zero-write assertions all passed. The suite then reproduced the existing R5 fixture failure on the first apply (`replayed=true`, `inserted=0`, no `FacultySubject` row, followed by the fixture's null-row read).
- The same R5 failure was reproduced on base `8f48a2fe6ea883189221e196c7a3d28ddcb629b8` in a disposable base worktree after adding the candidate's term-contract fixture normalization; the unnormalized base fixture fails earlier with `DERIVED_DEMAND_BLOCKED`.
- Server `npx tsc --noEmit`: passed.
- Server production build: passed.
- Built server startup on isolated port `5599`: passed DB connection, schema check, and listener startup; stopped after the read-only smoke.
- Client production build: passed.
- `git diff --check`: passed.

## Decision

`REVIEW_REQUIRED` — the system-token authority-diagnostic correction is bounded and verified, but the candidate remains blocked from integration by the pre-existing reconciliation-route fixture/apply failure. Do not run Teaching Load apply, carry-forward apply, generation, publication, migration, deployment, or restart from this candidate.

