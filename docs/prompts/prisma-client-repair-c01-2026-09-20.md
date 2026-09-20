# PRISMA-CLIENT-REPAIR-C01

Status: **PREPARED (r2) — NOT APPROVED**

Risk: **HIGH** — mutation of the live runtime's shared dependency tree

Target: `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules\.prisma\client`

Consumers repaired by one graft (every release whose `atlas-server\node_modules`
reaches that tree): live `74c1f12a`; `798cd78356ef`; `3c4cc3cd8d7d`;
`4ce73d157f9a`; and the recorded fallback `f0d65a531e34`, which reaches it through
`4ce73d157f9a`.

Graft source (preferred): `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\atlas-server\node_modules\.prisma\client`.
Any release may be substituted only if it passes the equivalence gate in
precondition 3.

Schema authority for the equivalence gate: release
`D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` at commit
`74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`, file `prisma/schema.prisma`.

Worktree disposition: **no worktree.** Scratch/evidence files live under
`%TEMP%\opencode\prisma-repair-c01\` and are removed by this action.

## Objective

Restore the generated Prisma client in the shared tree so the live release and
the recorded rollback releases can start a fresh server process again. The action
**adds files only**: it never overwrites, renames, or deletes a file that already
exists, and it never writes the loaded query-engine binary.

## Observed defect (independently verified 2026-09-20)

- `.prisma\client` exists and holds the runtime, wasm, and
  `query_engine-windows.dll.node` files, but **no `index.js`, `default.js`, or
  `package.json`** (also absent: `client.js`, `edge.js`, `index.d.ts`,
  `index-browser.js`). Directory mtime `2026-09-19 18:12:03`; surviving files
  `2026-09-18`.
- `@prisma/client` `6.19.2`, `prisma` CLI `6.19.2`, and
  `@prisma/engines\query_engine-windows.dll.node` are present in the target tree.
- The live server PID survives only on modules loaded at its 2026-09-18 start; a
  fresh start fails `MODULE_NOT_FOUND` on `.prisma/client/default`. Packet
  `current-source-live-deploy-c01` precondition 5 therefore cannot pass and its
  rollback basis is not startable.

## Why an additive copy, and why not regenerate

A `prisma generate` into the live tree is rejected: it rewrites the whole output
directory, and the query-engine binary is held open by the running server, so a
partial or failed write can only worsen the tree.

Copying the missing files from a sibling release is safe **because equivalence has
been proven, not assumed**:

- `prisma` and `@prisma/client` are `6.19.2` in every candidate tree;
- the surviving `schema.prisma` in the target and in siblings `8eb0511baa53` and
  `405e5b18` is **token-identical** to the live release's committed schema at
  `74c1f12a` once whitespace is stripped. The raw file differs only by
  `prisma generate` formatting and LF/CRLF, so a raw-hash comparison would fail
  spuriously and must not be used;
- the `query_engine-windows.dll.node` binary is SHA-256 identical across the
  target and both siblings (`263946105F428384D2318DC3241B85B1C3DD98FBB1BFAC62D3E81F513AB35897`).

The copied `index.js` embeds the generating tree's absolute paths, but
`prisma`-generated clients set `config.dirname = __dirname` when `schema.prisma`
sits beside them, so the client resolves against the target directory. The graft
source release is therefore recorded as a **do-not-retire** dependency until a
future release rebuilds the tree.

## Frozen boundary

- Never write, delete, rename, or re-permission a file that already exists under
  the target. Create-new-only, no exceptions.
- Never run `npm ci`, `npm install`, `prisma generate`, `prisma db push`,
  `prisma migrate`, or any schema command.
- Never stop, start, or re-point the supervisor, its children, or ports
  `5001`/`5174`; never touch port `5175`; never edit
  `D:\ATLAS-runtime-config\atlas-server.env`, any registered task, or any
  machine-scope variable.
- No login, no application write, no generation/publication/Teaching Load/rollover
  action, no companion-repository change.
- The isolated restart proof is the only step permitted to open a database
  connection, and it must stay read-only. A detected write is an incident stop.

## Preconditions — fail closed

1. Elevated Administrator executor. Re-read `origin/main:AGENTS.md`.
2. Re-fetch `origin/main` and record the tip. Require
   `git -C D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918 rev-parse HEAD` to
   equal `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`, and require its
   `git status --short` to show no tracked modification (untracked
   `ops/runtime/logs/` is expected). Extract the schema with
   `git -C <release> rev-parse 74c1f12a:prisma/schema.prisma` and
   `git -C <release> cat-file blob <blob>` — never from a working tree.
3. **Equivalence gate — all five must pass, else STOP.** Between the graft source
   and the target:
   a. source client contains `index.js`, `default.js`, `package.json`;
   b. `prisma` and `@prisma/client` versions are equal in both trees;
   c. the whitespace-stripped content of the source client's `schema.prisma`, the
      target client's surviving `schema.prisma`, and the blob from precondition 2
      are all equal (strip all whitespace before comparing; formatting and CRLF
      differences are expected and are not content differences);
   d. SHA-256 of every `query_engine*` and `schema-engine*` file present in both
      clients is equal;
   e. the graft list — files in the source client absent from the target client —
      is non-empty and contains the three entrypoints of (a).
4. Capture the target pre-state: recursive listing of `.prisma\client` with
   SHA-256 and last-write time per file, plus a recursive listing and SHA-256 set
   of the target tree's sibling entries. Save under
   `%TEMP%\opencode\prisma-repair-c01\pre\`.
5. Capture the zero-write evidence, saved to file: (a) the schema-wide signature
   map — every `public` base table from `information_schema.tables`, ordered by
   table name, each safely quoted, computing
   `(rowCount, md5(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text))))`
   with `md5('')` for an empty table (the `ORDER BY` is mandatory; without it the
   aggregate order is unspecified and the comparison is not reproducible), and
   (b) every sequence's `last_value` from `information_schema.sequences`. Record
   host and database name. Known blind spots to disclose in the evidence: a
   sequence advanced through `nextval`, a table created and dropped between
   captures, and writes outside the `public` schema are not covered by (a).
6. Record live identity read-only: supervisor process tree, the single owner of
   `5001` and of `5174`, any listener on `5175`, local health and readiness,
   Tailnet health, one DB-backed subjects read. Confirm port `5051` has no
   listener.
7. Resolve the durable environment file's variables into the child environment
   only, for the row-4 smoke (including `DATABASE_URL`). Never print any value,
   and never write the file.
8. Create `%TEMP%\opencode\prisma-repair-c01\` and, inside it, the graft list and
   hash captures as files. All commands name absolute paths; no command may rely
   on an inherited working directory.

## Authorized mutations

1. additively copy every file on the graft list from the source client into the
   target, with create-new-only semantics that must throw rather than overwrite;
2. run the load proof (row 3) and the isolated restart proof (row 4);
3. on success or on abort, delete `%TEMP%\opencode\prisma-repair-c01\` and every
   temporary script or file this action created anywhere.

## Acceptance — 6 mandatory rows

1. **Equivalence.** All five gates of precondition 3 pass, with the compared
   values and the source release identity recorded.
2. **Add-only graft.** Every copied path was absent from the precondition-4
   capture; no pre-existing file's SHA-256 or last-write time changed; the target
   now contains `index.js`, `default.js`, `package.json`; the surviving
   `query_engine-windows.dll.node` is untouched.
3. **Live-release load.** From
   `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918\atlas-server`,
   `node -e "require.resolve('@prisma/client'); require.resolve('.prisma/client/index.js'); const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.$disconnect().then(()=>{})"`
   completes with no `MODULE_NOT_FOUND` and no unhandled rejection. This step must
   not open a database connection.
4. **Isolated restart proof.** Start release `74c1f12a`'s built server on port
   `5051` with `ROLLOVER_AUTO_SYNC_ENABLED=false` and the child environment from
   precondition 7, require local health and one DB-backed read to return 200, then
   stop that process. Prove the `5001` and `5174` owners and PIDs are unchanged,
   the `5175` listener state is unchanged, the supervisor is untouched, and no new
   listener exists on `5001`/`5174`/`5175`.
5. **Zero write.** The precondition-5 signature map and sequence map are
   byte-identical after. Any delta is a mandatory failure, an incident stop, and is
   reported without attempting to undo it. The precondition-5 blind spots are
   restated in the evidence.
6. **Minimal delta and cleanup.** The only change is the added file set under the
   target; the recursive listing and SHA-256 set of the target tree's siblings is
   unchanged; no task, machine variable, env byte, or listener changed; the scratch
   directory and every temporary artifact are removed.

Fresh independent post-action QA must reproduce rows 1–6. `ACCEPT_READY` requires
6/6 passed, 0 blocked, 0 unperformed.

## Rollback

Delete exactly the files this action added under `.prisma\client`. The
precondition-4 capture is authoritative: a path absent from it is deleted, a path
present in it is never touched. Then re-prove the target's file list and SHA-256
set equals that capture, and that `5001`/`5174`/`5175` ownership, health, and the
database signature and sequence maps are unchanged. Also remove the scratch
directory and every temporary artifact the action created, on abort as well as on
success. Rollback intentionally restores the previously broken state; it does not
restore startability. Do not improvise an alternate client or a regenerated one.

## Exact approval sentence — not yet granted

> I approve HIGH action PRISMA-CLIENT-REPAIR-C01: from an elevated Administrator executor, restore the missing generated Prisma client files in `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules\.prisma\client` by additively copying only those files absent from that directory from release `8eb0511baa53-20260917`, after proving the equivalence gate — equal `prisma` and `@prisma/client` versions, token-identical schema content against the committed schema of release `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` with whitespace stripped, byte-equal engine binaries, and a non-empty graft list containing `index.js`, `default.js` and `package.json` — using create-new-only semantics that never overwrite, rename or delete any existing file and never write the loaded query-engine binary; and after proving with the isolated alternate-port 5051 server start, rollover automation disabled, and byte-identical schema-wide table-signature and sequence maps that no database write occurred; performing no dependency install, no `prisma generate`, no schema or migration command, no login, no environment-file, task, or 5001/5174/5175 change, and no companion-repository action; and on any mandatory failure deleting exactly the files this action added and removing the scratch directory, and reporting rather than improvising an alternate client.

## Return

One concise evidence artifact: the equivalence-gate values and source release
identity, the graft list, pre/post file lists with hashes, rows 1–6, the table
signature and sequence maps before and after with the disclosed blind spots, PIDs
and listeners before and after, rollback status, and an immutable evidence SHA. Do
not paste logs, secrets, database rows, or environment contents.
