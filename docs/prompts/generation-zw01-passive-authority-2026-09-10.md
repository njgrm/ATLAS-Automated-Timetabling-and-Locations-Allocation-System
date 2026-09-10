# GEN-ZW01 — Passive Generation and Teaching Load Audit Closure

Status: `READY_FOR_EXECUTION`  
Risk: `MEDIUM` source; live generation and data apply remain `HIGH`

## Objective

Generation may read Teaching Load but must never create, move, repair, delete,
or refresh it. Close unaudited Teaching Load mutation paths before prior-year
carry-forward or live generation.

## Git boundary

Create `D:\ATLAS-worktrees\generation-zw01` on `work/generation-zw01`
from freshly fetched `origin/main`. Record the clean base SHA. Supersede rather
than rebase the stale `work/generation-genc01` candidate; preserve only useful
read-only diagnostic concepts that remain applicable. Commit one candidate;
do not merge, rebase, amend, or push.

## Required implementation

1. Remove `repairActiveSubjectCoverageWithPlaceholders({apply:true})` and every
   other Teaching Load mutation from the real generation path.
2. Missing ownership/coverage remains an actionable typed blocker or unassigned
   explanation. Generation must not create placeholder faculty or assignments.
3. Retire the direct mutating `/faculty-assignments/auto-fill` behavior. Keep a
   zero-write preview/suggestion path; mutation requires the reviewed proposal
   workflow.
4. Bind affected Teaching Load saves to the authenticated actor. Remove
   `assignedBy: 0` from operator-triggered paths.
5. Make proposal application, assignment/ownership updates, cycle refresh,
   proposal status, and one durable audit atomic in a Serializable transaction.
6. Make manual assignment save and the other touched mutation paths write one
   durable actor-attributed audit in the same transaction. Audit failure must
   roll back all domain changes.
7. Preserve read-only summary and preview behavior and existing year/school
   authority. Do not redesign allocation or derived demand in this cycle.

## Source boundary

Allowed likely paths:

- `generation.service.ts`;
- `teaching-load-automation.service.ts`;
- `teaching-load-suggestion-proposal.service.ts`;
- `faculty-assignment.service.ts` and router;
- optionally one new Teaching Load audit service;
- focused server tests, one progress document, runtime map, changelog.

Do not edit Subject schema/form, EnrollPro term adapters, AppShell, Year Setup,
Teaching Load history UI, Timetable client/server, publication, migrations, or
companion repositories.

## Acceptance gates

- Real generation entry-point fixtures prove zero writes to FacultyMirror,
  FacultySubject, SubjectSectionOwnership, TeachingLoadCycle, and AuditLog on
  success and failure paths.
- A source/import guard proves generation imports no Teaching Load mutator.
- Mounted-route tests prove direct auto-fill apply is rejected and preview is
  zero-write.
- Proposal apply proves actor attribution, one audit, atomic status/domain
  writes, idempotent replay where supported, and rollback on injected failure.
- Manual save proves one audit in the same transaction and zero partial writes.
- Archived/inactive/cross-school authority stays fail closed.
- Existing generation zero-subject-write, reconciliation, and focused assignment
  regressions remain green.
- Server TypeScript, build, built-server startup with rollover disabled, and
  `git diff --check` pass.

## Return

Return `REVIEW_REQUIRED` with base/candidate SHAs, exact paths, removed mutators,
transaction/audit behavior, decisive tests, remaining risks, and collision
proof. Do not access the live database for writes, generate, publish, migrate,
merge, or push.

