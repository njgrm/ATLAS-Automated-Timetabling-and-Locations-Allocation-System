# MIG-GUARD-R1 Executor Handoff

- Stream: `MIG-GUARD-R1` — guarded migration schema-path correction
- Status: `REVIEW_REQUIRED`
- Risk tier: `LOW` source correction; no schema, data, or runtime mutation
- Prompt: `docs/prompts/migration-guard-command-correction-r1-2026-09-11.md`
- Worktree: `D:/ATLAS-worktrees/migration-guard-r1`
- Branch: `work/migration-guard-r1`
- Base: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6` (fresh current `origin/main`)
- Implementation candidate: `d2ddf711f539a7537381a511a577faa3caca63eb`
- Executor handoff commit: docs-only commit that adds this file; final tip SHA is
  returned in the executor message and is the upper bound of
  `<base>...<tip>`.
- `EXTERNAL_QA_BUNDLE`: enabled. QA may create a neutral
  `review/migration-guard-r1-<candidate-short>` branch from the candidate and
  commit exactly one report at `docs/reviews/migration-guard-r1/qa-bundle.md`.
  All other QA restrictions in `AGENTS.md` still apply; QA is otherwise
  read-only.

## Changed paths

- `atlas-server/src/scripts/atlas-migrate.ts`
- `atlas-server/src/__tests__/migration-guard.test.ts` (new)
- `atlas-server/package.json` (`test:migration-guard` script)
- `CHANGELOG.md`
- `docs/progress/migration-guard-r1-progress.md` (new)
- `docs/handoffs/migration-guard-r1-executor.md` (new, this file)

## Required behavior delivered

- After the existing backup manifest, checksum, target, freshness, and
  `pg_restore --list` revalidation gates pass, the wrapper spawns Prisma with
  `migrate deploy` and an explicit normalized schema resolving to
  `../prisma/schema.prisma` from the `atlas-server/` invocation context.
- Supported forwarded Prisma arguments after `--` are preserved in their
  original order.
- A caller-forwarded `--schema <path>` or `--schema=<path>` is rejected with a
  typed `SCHEMA_FLAG_CONFLICT` failure before the backup gate and before any
  spawn, so schema precedence is never ambiguous.
- Every backup/target/revalidation gate failure spawns nothing.
- Windows invocation compatibility and the pre-existing `spawnSync` array-arg
  form are retained; no shell-built command string or secret logging was added.

## Argument matrix

| Forwarded args | Spawned args | Outcome |
|---|---|---|
| none | `prisma migrate deploy --schema ../prisma/schema.prisma` | gate passes → one spawn |
| `--skip-generate --tag=abc` | `prisma migrate deploy --schema ../prisma/schema.prisma --skip-generate --tag=abc` | gate passes → one spawn, order preserved |
| `--schema ../evil.prisma` | none | `SCHEMA_FLAG_CONFLICT`, exit 1, zero spawns |
| `--schema=../evil.prisma` | none | `SCHEMA_FLAG_CONFLICT`, exit 1, zero spawns |
| (any) + failed checksum/manifest/revalidation | none | gate failure, exit 1, zero spawns |

## Failing-first controls (focused test)

1. Legacy pre-fix default `['prisma','migrate','deploy']` fails the
   canonical-schema detector.
2. Corrected default carries exactly one correct schema argument.
3. Forwarded non-schema arguments keep a stable relative order.
4. Conflicting schema input fails before spawn (`SCHEMA_FLAG_CONFLICT`).
5. Every existing guard failure produces zero child processes.
6. A successful gate produces exactly one child process.

## Gate results

| Gate | Command | Result |
|---|---|---|
| Focused test | `npm run test:migration-guard` (cwd `atlas-server`) | PASS — 31 passed, 0 failed |
| Server type-check | `npx tsc --noEmit` (cwd `atlas-server`) | PASS — exit 0 |
| Server build | `npm run build` (cwd `atlas-server`) | PASS — exit 0 |
| Whitespace | `git diff --check ec7d54ed..<tip>` | PASS — exit 0 |

No built-server or live-database test was run; both are unnecessary and
forbidden by the prompt.

## Boundaries honored

- No migration applied or rolled back; no database or configuration file
  touched; no hard-coded secrets.
- No merge, push, amend, or rebase of the candidate; the branch is local.
- A stale-base, never-handed-off prior candidate (`80a27c2b`) was preserved as
  `backup/migration-guard-r1-stale-80a27c2b` and the branch reset to fresh
  `origin/main` before this candidate.

## Requested QA

Read-only verification of `<base>...<tip>`: confirm the schema argument is
supplied by default, forwarded non-schema args are preserved in order, a
forwarded schema fails closed before spawn, and every gate failure spawns
nothing. Do not apply a migration or touch the live database.
