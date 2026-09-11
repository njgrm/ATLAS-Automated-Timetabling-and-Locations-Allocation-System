# MIG-GUARD-R1 Progress

- Prompt: `docs/prompts/migration-guard-command-correction-r1-2026-09-11.md`
- Risk: `LOW` source correction; no schema or data mutation authorized
- Worktree: `D:/ATLAS-worktrees/migration-guard-r1`
- Branch: `work/migration-guard-r1`
- Base: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6` (current `origin/main`)
- Implementation candidate: `d2ddf711f539a7537381a511a577faa3caca63eb`
- Handoff commit: docs-only, recorded in the executor return
- Current phase: candidate committed for planner/QA review (`REVIEW_REQUIRED`)

## Execution status

| Task | Status | Evidence |
|---|---|---|
| Worktree from fresh `origin/main` | DONE | reset to `ec7d54ed`; worktree clean before edits |
| Schema flag owned by wrapper | DONE | `buildPrismaMigrateArgs()` always emits `--schema ../prisma/schema.prisma` |
| Conflicting schema rejected before spawn | DONE | `hasForwardedSchemaFlag()` + `SCHEMA_FLAG_CONFLICT` early return in `runGuardedMigration` |
| Forwarded non-schema args preserved in order | DONE | stable-order assertions in focused test |
| Gate ordering unchanged, gate failure spawns nothing | DONE | event ordering + zero-spawn assertions |
| Failing-first focused test | DONE | `npm run test:migration-guard` — 31 passed, 0 failed |
| Server type-check | DONE | `npx tsc --noEmit` exit 0 |
| Server build | DONE | `npm run build` exit 0 |
| Committed-range whitespace check | DONE | `git diff --check` on the candidate range exit 0 |
| Candidate commit | DONE | `d2ddf711`; no merge, push, amend, rebase, migration, or restart |
| Executor handoff + `EXTERNAL_QA_BUNDLE` | DONE | `docs/handoffs/migration-guard-r1-executor.md` |

## Argument matrix

| Invocation (from `atlas-server/`) | Forwarded args | Spawned `npx` args | Result |
|---|---|---|---|
| `npm run migrate:guarded` | none | `prisma migrate deploy --schema ../prisma/schema.prisma` | gate → one spawn |
| `... -- --skip-generate --tag=abc` | `--skip-generate --tag=abc` | `prisma migrate deploy --schema ../prisma/schema.prisma --skip-generate --tag=abc` | gate → one spawn; order preserved |
| `... -- --schema ../evil.prisma` | `--schema ../evil.prisma` | none | `SCHEMA_FLAG_CONFLICT`, exit 1, zero spawns |
| `... -- --schema=../evil.prisma` | `--schema=../evil.prisma` | none | `SCHEMA_FLAG_CONFLICT`, exit 1, zero spawns |
| backup/checksum/target/freshness/`pg_restore --list` gate failure | any | none | gate failure code, exit 1, zero spawns |

## Failing-first control coverage

1. Legacy pre-fix default `['prisma','migrate','deploy']` fails the
   canonical-schema detector.
2. Corrected default carries exactly one correct schema argument.
3. Forwarded non-schema arguments keep a stable relative order.
4. A forwarded `--schema` (`--schema <path>` and `--schema=<path>`) fails before
   spawn with `SCHEMA_FLAG_CONFLICT`.
5. Every existing guard failure (corrupt checksum, missing manifest, failed
   `pg_restore --list`) produces zero child processes.
6. A successful gate produces exactly one child process (`revalidate,spawn`).

## Decisions and boundaries

- The pre-existing `work/migration-guard-r1` worktree carried a stale-base
  candidate (`80a27c2b`, based on `aab8fb00`) that had never been handed off or
  reviewed. It is preserved as `backup/migration-guard-r1-stale-80a27c2b`; the
  branch was reset to fresh `origin/main` before this candidate to satisfy the
  prompt's base requirement.
- A forwarded `--schema` is rejected (fail closed) rather than silently
  stripped, matching the prompt's "reject ... rather than creating ambiguous
  precedence" requirement.
- No live migration, database mutation, service restart, merge, push, amend, or
  rebase occurred. `atlas-server/dist` build output is gitignored.
- Only `atlas-server/src/scripts/atlas-migrate.ts`,
  `atlas-server/src/__tests__/migration-guard.test.ts`,
  `atlas-server/package.json`, `CHANGELOG.md`, this ledger, and the executor
  handoff changed.
