# C7 — TEACHER-CONCERN-AUTHORITY deployment packet (2026-09-25)

Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` (cycle **C7**). HIGH action.
Procedure: `.agents/skills/atlas-deploy/SKILL.md`; facts `docs/reference/agent-runtime-deploy-facts.md`.
Standing authorization (2026-09-20) covers this program's deployment; **no gate is waived** (one
independent pre-action review, one executor, one fresh post-action QA, labelled browser rows, real tally).

## Target

- **Target SHA: `066da7a77b7ec63f5cacc27212788e1fbed88165`** (`origin/main`; product tip `178c2929`).
- **Release directory to create:** `E:/ATLAS-runtime-supervised-066da7a7-20260925` (owns its dependency tree).
- **Incumbent / rollback basis:** `37e0c85b` at `E:\ATLAS-runtime-supervised-37e0c85b-20260925`
  (supervisor-owned 5001→63452 / 5174→26084). Deeper rollback: `a5f7384e`.
- **Env file:** `D:\ATLAS-runtime-config\atlas-server.env`.
- Space before start: `E:` 59.6 GiB, `D:` 60.9 GiB (both above warning).

## Migration

One migration applies — **`20260925000002_faculty_availability`** (S1). `20260925000001_shift_coherence`
(S8) was already applied 2026-09-25. Host `localhost:5432`, database
`atlas_recovery_clean_rebuild_20260905`, environment local/pilot. **Applied count before: 10; expected
after: 11.** Apply only via `npm run migrate:guarded` (never bare Prisma) after a fresh
checksum-valid backup (`npm run backup`; the guard revalidates `pg_restore --list` immediately before
Prisma and prints `MIGRATE_GATE_OK`). Post-apply: migrate status up to date + existence probe for the
`faculty_availability` / `faculty_availability_slots` tables and FKs.
- **Env/backup (specified):** the release worktree has no `atlas-server/.env`; load `DATABASE_URL` into
  the process from `D:\ATLAS-runtime-config\atlas-server.env` (read it inside the process — never print
  it). No `ATLAS_BACKUP_CONFIG` is set, so the default backup root `D:\ATLAS-database-recovery\backups`
  and the 24 h freshness window apply; run `npm run backup` first and confirm the guard revalidates a
  fresh manifest (`pg_restore --list`). A bare `migrate:guarded` without the env fails closed
  `CONFIG_MISSING` (no mutation).

## Expected product delta (`37e0c85b..066da7a7`)

C5 + C6, each independently QA-accepted: S1 availability authority (`af3a24c5`, QA 16/16/0/0);
S4-server identity deltas (`d51a8f16`, 9/9/0/0); S2 concern workspace + D6 portal removal (`c403e743`,
12/12/0/0); S4-client seven-domain drift + regenerate + revision UX + D4 published read-back (`ffbda016`,
9/9/0/0). Docs/packet commits above are inert. No unreviewed product delta.

## Steps

1. `git worktree add --detach E:/ATLAS-runtime-supervised-066da7a7-20260925 066da7a7`; `npm ci` in
   `atlas-server` and `atlas-client`; `prisma generate` from `atlas-server` with the repo-root schema.
2. Server build; client build with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` (fail-closed
   without it). Confirm Node starts the built server (§5).
3. Fresh backup, then `npm run migrate:guarded` → `MIGRATE_GATE_OK`; status + existence probe.
4. `ops/runtime/deploy-runner.ps1 -TargetSha 066da7a7... -TargetSourceDir E:\ATLAS-runtime-supervised-066da7a7-20260925 -IncumbentSha 37e0c85b... -IncumbentSourceDir E:\ATLAS-runtime-supervised-37e0c85b-20260925 -EnvFile D:\ATLAS-runtime-config\atlas-server.env` (dry-run), review the audit plan, then `-Execute` in the elevated shell.
5. Prove: `/api/v1/health` + a DB-backed read (`GET /api/v1/subjects?schoolId=1`) + supervisor log;
   fetch a chunk that exists only in the new build from the Tailnet origin and compare byte-for-byte;
   machine `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = target. Update the `Live release` block to
   `LIVE` in the same action.

## Acceptance (browser rows deferred)

**Acceptance owner: Lane B (Codex)** — browser custody. Hand it the release SHA and the rows below;
it records the result in the `Live release` block. Needs one operator-provided authenticated session
(a `LOCAL_LOGIN_SUCCESS` + `last_login_at` audit delta) — never print credentials.

Two-viewport matrix (1366×768 and 390×844): (a) the teacher portal routes `/my/schedule`,
`/my/preferences`, `/my/room-preferences` are gone and no nav/link reaches them; (b) the scheduler
concern workspace `/faculty/concerns` loads/saves/reviews a teacher's availability; (c) the run drift
shows all seven domains and the explicit "Regenerate to apply" affordance never auto-regenerates a
published run; (d) an effective-dated identity revision reads back the override post-effective-date.

**Post-action QA (mandatory, one fresh independent `atlas-qa`):** health + DB-backed read + a chunk that
exists only in the new build byte-compared against the built asset + machine `ATLAS_RUNTIME_SOURCE_DIR`/
`RELEASE_SHA` = target; the migration present and the existence probe passed; zero unauthorized writes;
a real `passed/blocked/unperformed` tally. `ACCEPT_READY` only if `passed == total`, `blocked 0`,
`unperformed 0`.

## Rollback

Start the incumbent `37e0c85b` release in place (retention keeps it); the `faculty_availability`
migration is additive with safe defaults, so `37e0c85b` stays compatible with the migrated schema.
Deeper: `a5f7384e`.

## Out of scope

Generation, publication, Teaching Load apply, term-cache apply, and companion repos. No lane may
change the shared runtime outside this packet.
