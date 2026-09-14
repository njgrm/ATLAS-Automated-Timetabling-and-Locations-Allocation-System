# TL-SUGGESTION-C03R2 post-integration Wave Completion Audit

## Verdict

`CORRECTION_REQUIRED` — terminal closure is unsafe.

## Immutable identity

- Remote tip reviewed: `c46cb06f798729e2368e7102ed8789e4e99df6a7`
- Integration merge: `020fbe85569136186cfebf536f6833d5ddc29df5`
- Candidate: `bcb5382266073ab72424d68a2d65fbd9382a5e69`
- Candidate base: `e0a10ebcd8efa0d4fa248b2c5948ed53a6c33c54`
- Auditor: `/root/tl_c03r2_wave_audit`

## Mandatory tally

- Total: 17
- Passed: 12
- Blocked: 3
- Environment-unperformed: 2

## Blocking product finding

`previewOrApplyOverCapRebalance` invokes
`previewOrApplyStaleOwnershipReconcile` with `previewOnly: !apply` before the
later Serializable transaction. In apply mode, the preliminary reconciliation
may delete ownership rows, update or delete `FacultySubject`, and refresh the
Teaching Load cycle. Canonical derived-demand revision is revalidated only
afterward inside the separate Serializable transaction. A revision change can
therefore return `TEACHING_LOAD_REBALANCE_STALE` after preliminary writes.

Required correction: make preliminary stale-ownership handling zero-write and
fail closed, or move the complete reconciliation into the same Serializable
transaction after canonical revision revalidation. Add a committed control
combining stale ownership with a canonical revision change and assert
byte-identical ownership, `FacultySubject`, Teaching Load cycle, audit, and
notification state after rejection.

## Documentation finding

The candidate handoff inventory omitted
`atlas-server/src/__tests__/teaching-load-suggestion-authority.test.ts`, though
Git confirms an eight-path candidate range. The 100/100 test count itself is
coherent.

## Process disclosure

The exact integration worktree lacked installed dependencies. The auditor then
ran the identical candidate tree's focused suite; it passed 100/100 but also
activated its disposable PostgreSQL fixture despite the audit's read-only DB
boundary. The fixture reported zero residue and did not target the shared/live
database. This run is disclosed as a process-boundary breach and is not used to
waive the product correction.

No browser login, live/shared data mutation, deployment, generation,
publication, migration, or runtime action occurred.
