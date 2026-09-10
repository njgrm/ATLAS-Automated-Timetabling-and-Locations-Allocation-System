# TERM-LIVE-APPLY — Guarded Live Migration Receipt

Status: `APPLIED_VERIFIED`
Applied at: 2026-09-11 02:01 Asia/Manila

## Authority

The operator approved applying `0001_term_subject_authority` to the verified
live ATLAS database through the guarded migration workflow, bound to backup
`atlas-backup-atlas_recovery_clean_rebuild_20260905-20260910-165235.dump` with
SHA-256 `b5e5d9faa90b528079f3e1c317f34930ffebf74e50f93e6a7cca945e22b57e3c`.
The approval acknowledged that EnrollPro deployment is not required for schema
compatibility but remains required for live term authority.

## Immediate preflight

- Exact checked-out and `origin/main` commit before apply:
  `932882f8138a02b7c7fdb8a3a1a3dd0309def98d`. The migration itself was the
  already integrated immutable `0001_term_subject_authority`.
- Target resolved from protected configuration as
  `localhost:5432 / atlas_recovery_clean_rebuild_20260905`; no secret was
  logged.
- `atlas-backup.ts validate` returned `VALIDATE_OK` for the exact approved
  archive and checksum.
- The guarded selector independently chose the same archive and manifest as the
  newest fresh target-matching backup.
- Live state immediately before apply: only `0000_clean_baseline` applied;
  candidate enum absent; candidate columns `0`; subjects `22`; canonical
  `UPPER(BTRIM(code))='HG'` match count `1` (`id=7`).

## Apply command and operational correction

The first `npm run migrate:guarded` invocation passed the backup gate but Prisma
exited before migration because the wrapper did not provide this repository's
root-level schema path. This attempt made zero schema/data changes; a fresh
`prisma migrate status --schema ../prisma/schema.prisma` still reported
`0001_term_subject_authority` pending.

The supported forwarded-argument form was then used:

```text
npm run migrate:guarded -- -- --schema ../prisma/schema.prisma
```

The wrapper again returned `MIGRATE_GATE_OK` for the exact approved manifest,
then Prisma applied only `0001_term_subject_authority` and reported all
migrations successfully applied. Bare `prisma migrate deploy` was never run.

The default schema-path failure is a non-destructive operational defect in the
wrapper/package command and requires a separate normal source correction. It
does not invalidate the guarded apply because the successful invocation stayed
inside the wrapper and its documented forwarded-argument mechanism.

## Post-apply schema and data

- `prisma migrate status --schema ../prisma/schema.prisma`: database schema is
  up to date.
- Applied migrations: `0000_clean_baseline`, then
  `0001_term_subject_authority`; both finished, neither rolled back, one step
  each.
- Enum `subject_scheduling_disposition` exists with ordered labels
  `SCHEDULED_TEACHING`, `REFERENCE_ONLY`.
- `subjects.scheduling_disposition` is non-null with default
  `SCHEDULED_TEACHING`.
- `enrollpro_school_year_mirrors.term_contract_cache` is nullable JSONB.
- `enrollpro_school_year_mirrors.term_contract_cached_at` is nullable timestamp.
- Subject count stayed `22`: `21 SCHEDULED_TEACHING`, exactly one
  `REFERENCE_ONLY`.
- The only reference-only row is `id=7`, canonical code `HG`, name
  `Homeroom Guidance`.

## Protected-domain comparison

The following table counts and full-row JSON hashes were identical before and
after the migration: schools `1`, auth accounts `44`, faculty mirrors `42`,
section mirrors `40`, faculty subjects `183`, subject-section ownerships `530`,
Teaching Load cycles `2`, term configs `1`, offerings `216`, offering-term
assignments `96`, generation runs `1`, published revisions `0`, and audit logs
`142`.

The subjects table stayed at `22` rows and changed hash only because the new
column/default and the authorized HG disposition became part of each row. No
Teaching Load, curriculum requirement, generation, publication, account,
faculty, section, or audit mutation occurred.

## Runtime checks

- Existing server on port 5001 was not restarted or replaced.
- Local `/api/v1/health`: HTTP 200.
- Tailnet `/api/v1/health`: HTTP 200.
- Tailnet `/api/v1/subjects?schoolId=1`: HTTP 200 with 22 rows.
- The existing live process still returns a null/absent disposition projection,
  demonstrating that the integrated Wave-1 runtime has not yet been deployed.
  This is `PENDING_DEPLOY`, not a migration failure. No restart was authorized
  by the migration approval.

## Recovery and next action

Rollback was not executed. The accepted rollback/restore procedure remains
available, but the verified migration outcome gives no reason to invoke it.

Next: correct the guarded wrapper's default schema path as ordinary source work,
then coordinate deployment of integrated Wave-1 source. EnrollPro must still
deliver the complete ordered term contract before ATLAS can claim live term
authority or begin derived-demand integration.
