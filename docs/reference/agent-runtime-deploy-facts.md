# Runtime And Deploy Facts

Referenced by `AGENTS.md` §6. **Read this before any deployment, runtime, task,
environment, or release-directory action.** `AGENTS.md` remains the authority; this file
holds the detail so the directive stays short.

## Topology

- Scheduled task `ATLAS-Runtime-Supervisor` (SYSTEM, at system startup) launches
  `<sourceDir>/ops/runtime/cli.mjs`, which owns **port 5001**
  (`atlas-server/dist/server.js`) and **port 5174** (production host serving
  `atlas-client/dist`).
- `EADDRINUSE` on 5001, or "Port 5174 is in use, trying another one" from a manual
  `npm run dev`, is **expected behaviour, not a defect.**
- Both children stream into `<sourceDir>/ops/runtime/logs/atlas-supervisor.log`, with state
  in `supervisor-state.json` beside it. Read-only status: `node ops/runtime/cli.mjs status`
  from `<sourceDir>`.
- Resolve `<sourceDir>` from the task action or the supervisor process command line
  (`schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`). **Never assume a directory
  name or PIDs from a previous session.**
- `/api/v1/health` is **liveness only** — it proves neither database nor route readiness.
  Probe a database-backed read such as `GET /api/v1/subjects?schoolId=<id>` alongside the
  supervisor log. Transient Prisma `P1001` and Postgres client-abort lines appear during
  antivirus scans; confirm with the DB-backed read before reporting an outage.

## Facts learned the hard way

- A machine-scope env change needs an **elevated** shell — verify with
  `IsInRole(Administrator)` before assuming a write succeeded.
- The supervisor runs as **SYSTEM**; a non-elevated shell cannot kill it. Use the scheduled
  task as the durable launch owner, never a detached child of an agent shell.
- An out-of-process `cli.mjs stop` reports `stopped` but does **not** quiesce the resident
  supervisor — it respawns its children. Kill the supervisor **tree**.
- A stale `supervisor-state.json` saying `running` makes `start` fail with
  `ALREADY_RUNNING`; clear it before starting.
- The Prisma client is generated into `node_modules/.prisma/client`, and the schema's
  `output` resolves **relative to the schema file**: run `prisma generate` from
  `atlas-server` with `--schema` pointing at the **repo-root** schema, or the client lands
  in the wrong tree.
- **Prove a deploy by fetching a chunk that only exists in the new build** — a healthy
  `/api/v1/health` on the old release looks identical to a successful deploy.
- **Every production client build must set `VITE_ENROLLPRO_URL`.** A fail-closed guard in
  `atlas-client/vite.config.ts` exits 1 and emits **no bundle** without it; the release
  pipeline exports the EnrollPro origin (`https://dev-jegs.buru-degree.ts.net`).
  Development builds and the Node test runner are unaffected.
- **Only the `supervisor-state.json` inside the active `ATLAS_RUNTIME_SOURCE_DIR` is
  authoritative.** There is one per release directory; the others are stale artifacts that
  report a different release, or `stopped`, while the runtime is healthy. Reading the wrong
  one produces a false "identity drift" alarm.
- **`schtasks` XML registration: measure the encoding, do not assume the repair.**
  `schtasks /query /xml` returns ASCII bytes (`3C 3F 78 6D 6C` = `<?xml`) whose declaration
  says `encoding="UTF-16"`. Measured on this host 2026-09-21: that file **registers cleanly
  unmodified** (exit 0), and rewriting the declaration to `UTF-8` fails with
  `unable to switch the encoding` — the **opposite** of what `C01` recorded. If registration
  fails, fix it and record the literal repair — never substitute silently.
- A companion mirror is evidence only at a recorded commit — see `AGENTS.md` §4.

## Release hygiene

- Each release owns its dependency tree or junctions to one that will not be retired; never
  chain `node_modules` junctions across releases and never install through a shared
  junction. See `docs/reference/agent-worktree-lifecycle.md`.
- Build dependencies are isolated inside the release directory. A dependency junction into
  a shared tree makes one retired release break every consumer at once.
