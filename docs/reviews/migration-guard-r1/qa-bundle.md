# MIG-GUARD-R1 QA Bundle

- Verdict: `ACCEPT_READY`
- Risk tier reviewed: `LOW` source correction; no schema/data/runtime mutation
- Product candidate (reviewed): `ec7d54ed3b94db51fca9a8095a4be13f592b90e6...63bf48eb1507d5bbac2b97e0c7b92d702e12bf4d`
- Review branch tip: this commit (`docs/reviews/migration-guard-r1/qa-bundle.md` only)
- Worktree: `D:/ATLAS-worktrees/migration-guard-r1`; branch `work/migration-guard-r1` verified clean before review
- Governing prompt: `docs/prompts/migration-guard-command-correction-r1-2026-09-11.md`

## Attributed changed paths (`base...candidate`)

| Path | Role |
|---|---|
| `atlas-server/src/scripts/atlas-migrate.ts` | Production guarded migration wrapper |
| `atlas-server/src/__tests__/migration-guard.test.ts` (new) | Focused test |
| `atlas-server/package.json` | `test:migration-guard` script |
| `CHANGELOG.md` | Changelog |
| `docs/progress/migration-guard-r1-progress.md` (new) | Progress ledger |
| `docs/handoffs/migration-guard-r1-executor.md` (new) | Executor handoff |

All six paths are in scope. No product file outside the declared scope appears in the range.

## Independent evidence (commands rerun by QA)

| Command (cwd `atlas-server` unless noted) | Result |
|---|---|
| `npm run test:migration-guard` | PASS — 31 passed, 0 failed |
| `npx tsc --noEmit` | PASS — exit 0 |
| `npm run build` | PASS — exit 0 |
| `git diff --check ec7d54ed..63bf48eb` | PASS — exit 0 |
| `git merge-base --is-ancestor ec7d54ed 63bf48eb` | PASS (base is ancestor) |
| `git status --porcelain` after tests | clean; temp `src/__tests__/tmp-migration-guard` removed |

## Production reachability

`runGuardedMigration()` / `buildPrismaMigrateArgs()` / `hasForwardedSchemaFlag()` have no other
in-repo consumers (grep excludes the wrapper and its test), which is correct: the module is the
standalone `npm run migrate:guarded` entry point.

The new direct-run guard (`process.argv[1]` suffix match) was exercised on the real entry path, not a
helper only, using a forwarded-schema conflict that short-circuits before any gate or database contact:

- `tsx src/scripts/atlas-migrate.ts -- --schema=../evil.prisma` → printed `SCHEMA_FLAG_CONFLICT`, exit `1`.
- `npm run migrate:guarded -- -- --schema=../evil.prisma` → printed `SCHEMA_FLAG_CONFLICT`, exit `1`.
- built `node dist/scripts/atlas-migrate.js -- --schema=../evil.prisma` → printed `SCHEMA_FLAG_CONFLICT`, exit `1`.

Importing the module (as the test does) does not spawn Prisma, and the test passes without hanging.

## Requirement-to-enforcement matrix

| Prompt requirement | Production site | Executable evidence |
|---|---|---|
| Spawn `prisma migrate deploy` with explicit `../prisma/schema.prisma` from `atlas-server/` | `buildPrismaMigrateArgs` (`atlas-migrate.ts:77`), used at `:180` | test `schema flag carries the exact root schema path`; probe output |
| Preserve forwarded non-schema args in stable order | `buildPrismaMigrateArgs` spread, `:78` | test `forwarded non-schema args keep a stable relative order` |
| Reject conflicting forwarded `--schema` before gate/spawn | `hasForwardedSchemaFlag` guard `:142` | test `conflicting schema input fails before spawn`; live probes |
| Every failed gate spawns nothing | `selectAndRevalidateBackupForMigration` at `:167`; return before `:180` | tests for checksum, missing manifest, failed revalidation |
| Gates still run before spawn | revalidator invoked in selection, `:167` | test `checksum/revalidation resolves before the spawn` |
| Windows-compatible, no shell-built strings, no secret logging | array-arg `spawn` retained, `:180` | source review; no string command construction |

## Negative control

The focused test asserts the **pre-fix** default argument vector
`['prisma','migrate','deploy']` fails the canonical-schema detector
(`!hasCanonicalSchema(...)`), so the schema assertion is falsifiable rather than structural. Corrupt
archive bytes are also proven to be rejected by checksum before `pg_restore --list`, with zero spawns.

## Findings

None blocking.

1. `NON_BLOCKING` — Entry-point heuristic relies on `process.argv[1]` ending in
   `scripts/atlas-migrate.ts|.js`. An unsupported invocation form (e.g. extensionless
   `tsx src/scripts/atlas-migrate`) would silently no-op. All supported production forms
   (`npm run migrate:guarded`, `tsx <path>.ts`, built `.js`) were proven to execute. Optional
   hardening: compare `import.meta.url` to `pathToFileURL(process.argv[1])`.
2. `NON_BLOCKING` — A pre-`--` (un-forwarded) `--schema` is ignored rather than rejected, as in
   `npm run migrate:guarded -- --schema=../evil.prisma` (npm consumes the separator). The canonical
   schema is still the only one that reaches Prisma, so precedence cannot become ambiguous and no
   fail-open occurs. The prompt's "reject a second/conflicting schema option" is satisfied for the
   supported forwarded form.

No unexplained test or assertion removal. The only behavior change versus base is the injected-schema
argument, the fail-closed `SCHEMA_FLAG_CONFLICT` path, and the testability refactor; gate ordering and
exit semantics are preserved (`reportFailure` returns `1`; `main` assigns `process.exitCode`).

Boundaries honored: no migration run, no schema/data/config mutation, no push/merge/amend/rebase of
`work/migration-guard-r1`.

### Coordination and handoff

- Immediate action: planner integration review of `ec7d54ed...63bf48eb`; ordinary `LOW` candidate, no HIGH gate.
- Still expected: none from this stream.
- Ready existing handoff: this report at `review/migration-guard-r1-63bf48eb`; product base `ec7d54ed`.
- Safe parallel work: independent of term-schema/derived-demand work; no shared files.
- Locked successors: none owned by MIG-GUARD-R1.
- Planner return: RETURN_TO_PRIMARY_PLANNER: confirm immutable range, then integrate/push `work/migration-guard-r1` per standing authorization.
