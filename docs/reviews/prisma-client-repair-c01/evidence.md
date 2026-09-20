# PRISMA-CLIENT-REPAIR-C01 — executor evidence (ABORTED FAIL-CLOSED, no mutation)

- Base: `811aff6f` (= `origin/main` tip, re-fetched). Branch: `work/prisma-repair-c01`.
- Elevated Administrator: TRUE (first check).
- Packet: `docs/prompts/prisma-client-repair-c01-2026-09-20.md` (r2), followed literally.
- Verdict: `REVIEW_REQUIRED` — precondition 5(b) is unsatisfiable as written; STOPPED
  before any graft. **Zero files added, overwritten, renamed, or deleted anywhere.**
  Defect is NOT repaired; rollback had nothing to remove.

## Preconditions

1. Elevated TRUE; `origin/main:AGENTS.md` re-read (worktree at tip `811aff6f`).
2. PASS — release `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` HEAD exact;
   `git status --short` shows only untracked `ops/runtime/logs/` (expected);
   schema blob `8af558844d5a09bd9a1c70aa81d5fb619d870fa8`;
   `status --short -- prisma/schema.prisma` empty.
3. Equivalence gate — all five PASS (byte method `[IO.File]::ReadAllBytes`,
   strip `0x09 0x0A 0x0B 0x0C 0x0D 0x20`, SHA-256):
   a. source client holds `index.js`, `default.js`, `package.json` — PASS.
   b. `prisma` + `@prisma/client` = `6.19.2` in both trees — PASS.
   c. stripped SHA-256 of source-client `schema.prisma`, target-client
      `schema.prisma`, and live-release `prisma/schema.prisma` ALL equal
      pinned `09400d5268a2f1ec4f7a2fc8c723e8a393cef285cc7708cc791e3e91c27b38b8` — PASS.
   d. `query_engine*` present in both clients byte-equal; `query_engine-windows.dll.node`
      = pinned `263946105F428384D2318DC3241B85B1C3DD98FBB1BFAC62D3E81F513AB35897` — PASS.
   e. graft list non-empty (10 files) and contains the three entrypoints — PASS.
   Graft list (source-present, target-absent): `client.d.ts`, `client.js`,
   `default.d.ts`, `default.js`, `edge.d.ts`, `edge.js`, `index-browser.js`,
   `index.d.ts`, `index.js`, `package.json`. Target pre-state: 8 top-level files,
   17 recursive (incl. subdirs); `index.js`/`default.js`/`package.json` absent — confirmed.
   Graft source identity: `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917`.
4. PASS — pre-state captures written under scratch (since deleted): per-file SHA-256 +
   mtime for all 17 target-client files; `.prisma` dir holds only `client`.
5. **FAIL (BLOCKED)** — table-signature map captured (db `atlas_recovery_clean_rebuild_20260905`,
   46 public base tables, ordered, `ORDER BY s` aggregate, `md5('')` for empties) via
   throwaway Node script resolving `@prisma/client` from the healthy tree, env vars
   into child process only, nothing printed. But 5(b) is unsatisfiable: PostgreSQL 18.1
   `information_schema.sequences` has exactly 12 columns
   (`sequence_catalog … cycle_option`) and **no `last_value`**; the packet-literal query
   fails `Raw query failed. Code: 42703. Message: column "last_value" does not exist`
   (Prisma P2010). This is a packet-spec defect, not a method error. Per the
   no-workaround rule the step was NOT re-run against any other catalog
   (`pg_sequences` holds 45 rows — observed informationally, never queried for evidence).
6. Observed read-only (no change made): supervisor PID 67028
   (`.../74c1f12a.../ops/runtime/cli.mjs start`, parent 3456); 5001→PID 63688
   (server child of 67028); 5174→PID 12992; no listener on 5175 or 5051;
   local `/api/v1/health` 200, `/api/v1/health/ready` 200; boot task
   `ATLAS-Runtime-Supervisor` Status Running, pointing at the 74c1f12a tree.
   No Tailnet probe and no live subjects HTTP read were taken after the stop decision.
7. Durable env vars resolved into child probe processes only; no value printed,
   committed, or retained (scripts deleted with scratch).
8. Absolute paths used throughout; scratch dir created and (after abort) deleted.

## Acceptance rows (6 mandatory)

1. Equivalence — PASS (3a–3e all pass, values above).
2. Add-only graft — UNPERFORMED (graft never executed; stop preceded it).
3. Live-release load — UNPERFORMED (same reason).
4. Isolated restart proof — UNPERFORMED (same reason; 5051 confirmed free pre-stop).
5. Zero write — BLOCKED (sequence map uncapturable as specified; table map captured
   pre AND re-proven byte-identical post: 47/47 lines incl. `audit_logs` 300 rows
   identical — probes were read-only, no write by construction).
6. Minimal delta and cleanup — PASS (no delta exists: target re-proven 17/17
   hash-identical to pre capture; no task/env/listener change — listeners, PIDs,
   health all re-verified; scratch directory deleted, verified absent).

Tally: 2 passed / 1 blocked / 3 unperformed / 0 failed-by-mutation.

## Rollback status

Nothing to roll back (no mutation occurred). Abort duties completed: target file list
+ SHA-256 set re-proven equal to the precondition-4 capture; 5001/5174/5175
ownership, health, and table-signature map unchanged; scratch + all temporary
scripts removed (verified). Rollback-restore of startability was not applicable
since nothing was added.

## Known risks

- BLOCKING: packet §5(b)/row 5 cites a non-existent catalog column on PG 18.1;
  action cannot proceed without an r3 correction (e.g. bind `pg_sequences.last_value`
  with its own pre-approval). Do NOT execute the graft until row 5 is satisfiable.
- NON_BLOCKING: `git stash list` shows 3 pre-existing stashes on unrelated branches
  (not created by this action; `git stash` never used); worktree `status --short`
  otherwise clean; reflog shows only this evidence commit.
- NON_BLOCKING: live defect persists — fresh server starts still fail
  `MODULE_NOT_FOUND` on `.prisma/client/default`; current PIDs survive on
  already-loaded modules only. Any supervisor/child restart before repair risks outage.

## Suggested conventional commit message

`docs(prisma-repair-c01): abort evidence for unsatisfiable sequence-map precondition`
