# ACTIVE-TERM-LIVE-RESOLUTION deployment packet (2026-09-25)

Program: `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924`, follow-up option C1. HIGH supervised-runtime
cutover. Procedure: `.agents/skills/atlas-deploy/SKILL.md`; facts
`docs/reference/agent-runtime-deploy-facts.md`. Standing authorization covers it with all gates (one
independent pre-action review, one executor, one fresh post-action QA, real tally).

## Target

- **Target SHA: `ff87b06bfb33dee5817a357ad0080d9338c5106e`** (`origin/main`; contains
  `ACTIVE-TERM-LIVE-RESOLUTION-C01` candidate `72de00da`, QA `ACCEPT_READY` 9/9/0/0).
- **Release dir to create:** `E:\ATLAS-runtime-supervised-ff87b06b-20260925`.
- **Incumbent / rollback basis:** `e8553752` at `E:\ATLAS-runtime-supervised-e8553752-20260925`
  (supervisor-owned 5001→60756 / 5174→86968).
- Env file `D:\ATLAS-runtime-config\atlas-server.env`.
- **No migration**: the delta `e8553752..ff87b06b` changes only server source
  (`academic-term.service.ts`, `faculty-availability.service.ts`, `runtime-context.service.ts`, a test,
  `package.json`) + docs — **no `prisma/**` change**. Applied count stays 11.

## What ships

The availability authority now resolves the active term **live-first with a date-derived fallback**,
so the concern-workspace client (already live T2) and the server agree and the
`409 TERM_SCOPE_MISMATCH` is gone. `loadVerifiedOrderedTermContract` remains network-free; generation and
publication transactions keep the persisted term (Stage-1 divergence, disclosed — Stage-2 successor).

## Steps (elevated shell)

1. Revalidate incumbent = `e8553752` (task action, machine `ATLAS_RUNTIME_SOURCE_DIR`/`RELEASE_SHA`, the
   ACTIVE supervisor state file, listeners). If not, STOP and report `PACKET_STALE`.
2. `git -C D:\ATLAS worktree add --detach E:/ATLAS-runtime-supervised-ff87b06b-20260925 ff87b06b`;
   stage dependencies from the lockfile-verified incumbent (`npm ci` is harness-denied — copy
   `root`/`atlas-server`/`atlas-client` `node_modules`, own tree, no junction); `prisma generate` from
   `atlas-server` with the repo-root schema; server build; client build with
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`. Confirm Node starts the built server on an
   isolated port, then **stop the PID actually listening on that port** (not a wrapper).
3. `ops/runtime/deploy-runner.ps1 -TargetSha ff87b06b… -TargetSourceDir E:\ATLAS-runtime-supervised-ff87b06b-20260925 -IncumbentSha e8553752… -IncumbentSourceDir E:\ATLAS-runtime-supervised-e8553752-20260925 -EnvFile D:\ATLAS-runtime-config\atlas-server.env` — dry-run first, review the audit, then identical args `-Execute`.
4. Verify: `/api/v1/health` + `/api/v1/health/ready` + `GET /api/v1/subjects?schoolId=1` local & Tailnet;
   machine env + task + active state = target; served entry byte-identical to the build; and the
   availability route no longer fails `TERM_AUTHORITY_*` (a read that resolves the active term).
5. Update the `## Live release` block in `E:\ATLAS-worktrees\c1-deploy` (branch `docs/c1-deploy`) to mark
   `ff87b06b` LIVE (dir, listeners, rollback basis `e8553752`) and demote `e8553752`; keep it SHORT.
   Commit; do not push.

## Acceptance

**Browser acceptance owner: Lane A** (browser custody; seeded profile verified). Post-cutover QA is the
mandatory independent gate. Then browser rows: the deferred C7 rows (a)–(e) — critically (b)
`/faculty/concerns` save/submit/review now agreeing on T2 — plus audit findings 2, 3, 4, 6, 7 and the
scheduler-clarity copy. Generation, publication, deletion, and account/role/SSO stay HIGH.

## Rollback

Start `e8553752` in place; no migration, so it is trivially compatible.

## Out of scope

Generation, publication, Teaching Load apply, term-cache apply, companion repos, and the Stage-2
generation/publication term-pre-resolution successor.
