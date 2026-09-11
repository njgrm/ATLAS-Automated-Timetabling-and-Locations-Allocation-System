# MIG-GUARD-R1 — Guarded Migration Schema-Path Correction

## Objective

Make the canonical `npm run migrate:guarded` command locate the repository-root
Prisma schema when invoked from `atlas-server`, without requiring the operator
to append manual Prisma arguments. Preserve every existing backup and target
gate. Do not apply or roll back a migration.

## Git boundary

- Create `work/migration-guard-r1` from fresh current `origin/main` and record
  the base SHA.
- Expected edits: `atlas-server/src/scripts/atlas-migrate.ts`, one focused test,
  its concise progress ledger, and `CHANGELOG.md` only.
- Commit an immutable candidate; do not merge, push, amend, rebase, migrate,
  restart services, or modify database/configuration files.

## Required behavior

- After the existing backup manifest, checksum, target, freshness, and
  `pg_restore --list` gates pass, spawn Prisma with `migrate deploy` and an
  explicit normalized schema path resolving to `../prisma/schema.prisma` from
  the `atlas-server` invocation context.
- Preserve supported arguments supplied after `--`; reject a caller attempt to
  supply a second/conflicting schema option rather than creating ambiguous
  precedence.
- A failed backup/target/revalidation gate must spawn nothing.
- Keep Windows invocation compatible and do not introduce shell-built command
  strings or log secrets.

## Failing-first controls

Use injected/spied spawn dependencies or a focused child-process harness—never
the live migration—to prove:

1. the old default argument list lacks the schema and fails the detector;
2. the corrected default spawn receives exactly one correct schema argument;
3. forwarded non-schema arguments remain in stable order;
4. conflicting schema input fails before spawn;
5. every existing guard failure produces zero child processes;
6. a successful gate produces exactly one child process.

Run the focused test, server `tsc --noEmit`, server build, and committed-range
`git diff --check`. A built-server or live-DB test is unnecessary and forbidden.

## Completion contract

Return `REVIEW_REQUIRED` with base/candidate SHAs, exact paths, argument matrix,
and gate results. QA is read-only. This correction authorizes no schema or data
mutation.
