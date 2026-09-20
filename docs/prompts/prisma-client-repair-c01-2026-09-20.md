# PRISMA-CLIENT-REPAIR-C01

Status: **PREPARED — NOT APPROVED**

Risk: **HIGH** — mutation of the live runtime's shared dependency tree

Target: `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules\.prisma\client`

Consumers repaired by one graft (every release whose `atlas-server\node_modules`
junctions into that tree): live `74c1f12a`; `798cd78356ef`; `3c4cc3cd8d7d`;
`4ce73d157f9a`; and the recorded fallback `f0d65a531e34`, which reaches the tree
through `4ce73d157f9a`.

Source of the schema (the only authority): release
`D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` at commit
`74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`, file `prisma/schema.prisma`.

Worktree disposition: **no worktree.** Scratch layout lives under
`%TEMP%\opencode\prisma-repair-c01\` and is deleted by this action.

## Objective

Restore the generated Prisma client entrypoints in the shared tree so the live
release and the recorded rollback releases can start a fresh server process
again. The action **adds files only**; it never overwrites a file that already
exists, and it never touches the loaded query-engine DLL.

## Observed defect (independently verified 2026-09-20)

- `.prisma\client` exists and contains the runtime, wasm, and
  `query_engine-windows.dll.node` files, but **no `index.js`, no `default.js`,
  and no `package.json`**. Directory mtime `2026-09-19 18:12:03`; engine files
  `2026-09-18 08:39–09:02`.
- `@prisma/client` `6.19.2` and the `prisma` CLI `6.19.2` are present in the
  same tree. `node_modules\@prisma\engines\query_engine-windows.dll.node` is
  present, so generation does not require a download.
- Reflection of this: the live server PID survives only on modules loaded at its
  2026-09-18 start. A fresh start fails with `MODULE_NOT_FOUND` on
  `.prisma/client/default`. Packet `current-source-live-deploy-c01` precondition
  5 therefore cannot pass, and its rollback basis is not startable.

## Why regenerate instead of copying

Copying entrypoints from a startable sibling release is **forbidden**. The
generated `index.js`/`default.js` carry the schema's model metadata, and sibling
trees were generated at different revisions; a cross-revision copy would silently
change the data contract. The client must be regenerated from the exact committed
schema the live release was built against. Generation must also match the CLI
version already installed in the target tree (`6.19.2`); a mismatched CLI is a
STOP.

## Frozen boundary

- Never write, delete, rename, or re-permission a file that already exists under
  the target. Create-new-only semantics, no exceptions.
- Never run `npm ci`, `npm install`, `prisma db push`, `prisma migrate`,
  `prisma migrate reset`, or any schema command.
- Never stop, start, or re-point the supervisor, its children, or ports
  `5001`/`5174`; never touch port `5175`; never edit
  `D:\ATLAS-runtime-config\atlas-server.env`, any registered task, or any
  machine-scope variable.
- No login, no application write, no generation/publication/Teaching Load/rollover
  action, no companion-repository change.
- The isolated restart proof is the only action permitted to open a database
  connection, and it must be read-only. A detected write is an incident stop.

## Preconditions — fail closed

1. Elevated Administrator executor. Re-read `origin/main:AGENTS.md`.
2. Re-fetch `origin/main` and record the tip. Require
   `git -C D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918 rev-parse HEAD` to
   equal `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`, and require its
   `git status --short` to contain no tracked modification (untracked
   `ops/runtime/logs/` is expected). Extract the schema with
   `git -C <release> show 74c1f12a5c06bb025a1a7a13088c1c5da1a76d74:prisma/schema.prisma`
   — do **not** read it from a working tree.
3. Record the target pre-state: a recursive listing of
   `...\node_modules\.prisma\client` with SHA-256 and last-write time per file
   (expect the three entrypoints absent), plus a recursive listing and SHA-256
   set of the target tree's sibling entries to bound the blast radius. Save under
   `%TEMP%\opencode\prisma-repair-c01\pre\`.
4. Capture a schema-wide read-only database signature map using the method in
   `current-source-live-deploy-c01` precondition 8 (every `public` base table,
   ordered by name, `(rowCount, md5(string_agg(md5(row_to_json(t)::text), '')))`,
   `md5('')` for empty). Record host and database name. Save to file.
5. Record the live identity read-only: supervisor process tree, the single owner
   of `5001` and of `5174`, local health and readiness, Tailnet health, and one
   DB-backed subjects read. Confirm ports `5051` and `5274` have zero listeners.
6. Record `prisma` CLI and `@prisma/client` versions from the target tree; require
   both `6.19.2` and require `node_modules\prisma\build\index.js` to exist and
   `node_modules\@prisma\engines\query_engine-windows.dll.node` to exist.
7. Resolve `DATABASE_URL` from `D:\ATLAS-runtime-config\atlas-server.env` into the
   child environment only. Never print it, and never print any env value.
8. Build the scratch layout so the schema's relative generator `output`
   (`../atlas-server/node_modules/.prisma/client`) resolves **inside scratch**:
   `%TEMP%\opencode\prisma-repair-c01\gen\prisma\schema.prisma` (byte copy of the
   extracted blob, SHA-256 recorded) and `%TEMP%\opencode\prisma-repair-c01\gen\atlas-server\node_modules\`.

## Authorized mutations

1. write the scratch layout and run the target tree's own CLI:
   `node <target-tree>\node_modules\prisma\build\index.js generate --schema <scratch>\prisma\schema.prisma`
   with `CHECKPOINT_DISABLE=1` and the child-only `DATABASE_URL`;
2. load the scratch client and run exactly one read-only `SELECT 1`;
3. compute the scratch-versus-target file-set difference and **additively** copy
   only the files whose destination does not exist, using create-new-only
   semantics that must throw rather than overwrite;
4. run the isolated restart proof in "Acceptance" row 4;
5. delete the scratch directory and every temporary script this action created.

## Acceptance — 6 mandatory rows

1. **Generation.** The CLI version used equals the target tree's `@prisma/client`
   version (`6.19.2`); the scratch schema blob hash equals the extracted
   `74c1f12a` blob hash; generation exits 0; the scratch client loads and answers
   one read-only `SELECT 1` (the query result is not printed).
2. **Add-only graft.** Every copied file's destination was absent from the
   precondition-3 capture; no pre-existing file's SHA-256 or last-write time
   changed; the target now contains `index.js`, `default.js`, and
   `package.json`. The loaded `query_engine-windows.dll.node` is untouched.
3. **Live-release load.** From
   `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918\atlas-server`,
   `node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.\$queryRaw\`SELECT 1\`.then(()=>{})"` (equivalent form permitted) completes with no
   `MODULE_NOT_FOUND`, and one read-only query succeeds.
4. **Isolated restart proof.** Start release `74c1f12a`'s built server on port
   `5051` with `ROLLOVER_AUTO_SYNC_ENABLED=false` and the durable-env child
   variables, require local health and one DB-backed read to return 200, then
   stop that process. Prove the `5001` and `5174` owners and PIDs are unchanged,
   the supervisor is untouched, and no new listener exists on `5001`/`5174`/`5175`.
5. **Zero write.** The schema-wide signature map is byte-identical to precondition
   4. Any delta is a mandatory failure, an incident stop, and is reported without
   attempting to undo it.
6. **Minimal delta and cleanup.** The only repository-adjacent change is the added
   file set under the target; the recursive listing and SHA-256 set of the target
   tree's siblings is unchanged; no task, machine variable, env byte, or listener
   changed; the scratch directory and all temporary scripts are removed.

Fresh independent post-action QA must reproduce rows 1–6. `ACCEPT_READY` requires
6/6 passed, 0 blocked, 0 unperformed.

## Rollback

Remove exactly the files this action added under `.prisma\client`. The
precondition-3 capture is authoritative: a path absent from it is deleted; a path
present in it is never touched. Re-prove the target's file list and SHA-256 set
equals the capture, and that `5001`/`5174` ownership, health, and the database
signature map are unchanged. Rollback intentionally restores the previously
broken state; it does not restore startability. Do not improvise an alternate
client or a copied entrypoint.

## Exact approval sentence — not yet granted

> I approve HIGH action PRISMA-CLIENT-REPAIR-C01: from an elevated Administrator executor, regenerate the generated Prisma client using the target tree's own `prisma` CLI 6.19.2 and the committed `prisma/schema.prisma` of release `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` extracted from Git, with the output directed into an isolated `%TEMP%\opencode\prisma-repair-c01` scratch layout, prove the scratch client loads and answers one read-only query, then additively copy only the files missing from `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules\.prisma\client` using create-new-only semantics that never overwrite or delete any existing file, then prove a fresh start of release `74c1f12a` on alternate port 5051 with rollover automation disabled accompanied by a byte-identical schema-wide database signature; perform no dependency install, no schema or migration command, no login, no database write, no environment-file, task, or 5001/5174 change, and no companion-repository action; and on any mandatory failure remove exactly the files this action added and report rather than improvise an alternate client.

## Return

One concise evidence artifact: the extracted and scratch schema hashes, CLI and
client versions, the scratch-versus-target missing-file list, the generate result,
the pre/post file lists with hashes, rows 1–6, the database signature map before
and after, PIDs and listeners before and after, rollback status, and an immutable
evidence SHA. Do not paste logs, secrets, database rows, or environment contents.
