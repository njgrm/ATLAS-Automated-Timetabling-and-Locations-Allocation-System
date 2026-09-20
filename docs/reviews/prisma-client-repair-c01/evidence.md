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

## Suggested conventional commit message (abort record, preserved unamended)

`docs(prisma-repair-c01): abort evidence for unsatisfiable sequence-map precondition`

---

# R3 EXECUTION RECORD (corrected packet at `origin/main` `584f0699`, read via `git show`, never checked out)

- Branch `work/prisma-repair-c01` continued; abort commit `95dd87c9` preserved unamended.
- Only packet delta since base `811aff6f` is the packet file itself (18+/8-); `AGENTS.md`
  unchanged, held directive current. Elevated Administrator re-verified TRUE.
- Precondition-2 re-verified: release HEAD `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`
  exact; status only untracked `ops/runtime/logs/`; schema blob `8af55884…`; schema path clean.
- Pre-state note: the abort-time scratch capture was deleted per abort cleanup duties, so a
  FRESH pre-state capture was taken and verified against every recorded abort-time invariant
  (17 files, same names, QE DLL pinned hash, stripped-schema pinned hash, 10 graft files
  absent). It matched on all points; this fresh capture is the authoritative pre-state below.
- Precondition-5 table map likewise re-captured fresh (46 tables); sequence map captured with
  the corrected probe-first method BEFORE any graft.

## Row 1 — Equivalence (fresh proof, values restated)

- 3a PASS: source holds `index.js`, `default.js`, `package.json`.
- 3b PASS: `prisma` + `@prisma/client` = `6.19.2` in both trees.
- 3c PASS: byte-stripped SHA-256 of source-client `schema.prisma`, target-client
  `schema.prisma`, live-release `prisma/schema.prisma` ALL =
  `09400d5268a2f1ec4f7a2fc8c723e8a393cef285cc7708cc791e3e91c27b38b8`.
- 3d PASS: all `query_engine*` byte-equal; DLL =
  `263946105F428384D2318DC3241B85B1C3DD98FBB1BFAC62D3E81F513AB35897`.
- 3e PASS: graft list 10 files, contains the three entrypoints.
- Source identity: `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` (do-not-retire
  dependency until a future release rebuilds the tree).

## Row 2 — Add-only graft (PASS)

- 10/10 files copied with `FileMode.CreateNew` (throws on exist); zero overwrites.
- Target now 27 files; all 10 new files SHA-256-equal to source (0 mismatches).
- All 17 pre-existing files present with UNCHANGED hash AND mtime vs pre capture.
- `index.js`, `default.js`, `package.json` present; QE DLL untouched (pinned hash).
- Graft list: `client.d.ts`, `client.js`, `default.d.ts`, `default.js`, `edge.d.ts`,
  `edge.js`, `index-browser.js`, `index.d.ts`, `index.js`, `package.json`.

## Row 3 — Live-release load (PASS)

- Exact packet `node -e` from the live release `atlas-server` dir: exit clean, no
  `MODULE_NOT_FOUND`, no unhandled rejection. No `$connect` issued (only `$disconnect`);
  no listener opened (5051 absent after).

## Row 4 — Isolated restart proof (PASS)

- Child env from durable file into the launcher process only (never printed); `PORT=5051`,
  `ROLLOVER_AUTO_SYNC_ENABLED=false`; spawned `node dist/server.js` (child PID 75092).
- Health 200, DB-backed `GET /api/v1/subjects?schoolId=1` 200 (19440 bytes, same size as
  the live-5001 read); child killed (SIGTERM), confirmed gone, 5051 listener gone.
- 5001→PID 63688 and 5174→PID 12992 UNCHANGED; supervisor PID 67028 + server 63688
  unchanged; boot task Running on the same target; no 5175 listener at any point.

## Row 5 — Zero write (PASS)

- Table map 47/47 lines byte-identical pre/post (db + 46 tables, incl. `audit_logs` 300).
- Sequence map 48/48 lines byte-identical pre/post (db + `PROBE_FORM=pg_sequences` +
  45 seqs + OK). Probe form (i) succeeded first try; form (ii) not needed.
  Zero uncovered sequences; no error codes to list.
- Blind spots restated: `nextval`-advanced sequences, tables created/dropped between
  captures, writes outside `public` are not covered. DB name `atlas_recovery_clean_rebuild_20260905`.

## Row 6 — Minimal delta and cleanup (PASS)

- Only delta: the 10 added files. `.prisma` holds only `client`; node_modules top-level
  entries 206 before and after. No task, machine variable, env-file, or listener change.
- Scratch `%TEMP%\opencode\prisma-repair-c01\` deleted, verified absent.

## Post-state file list (SHA-256, UTC mtime, name) — pre-state = these rows minus the 10 graft rows (proven by comparison)

```text
D5EB5865D4CBAA9985CC3CFB920B230CDCF3363F1E70903A08DC4BAAB80B0CE1  2026-09-20T01:36:35  client.d.ts        (GRAFT)
7FB2958626FF9BD585EC82AF0935A4F71E852A183A0345145B828E2A9C1FD44A  2026-09-20T01:36:35  client.js          (GRAFT)
D5EB5865D4CBAA9985CC3CFB920B230CDCF3363F1E70903A08DC4BAAB80B0CE1  2026-09-20T01:36:35  default.d.ts       (GRAFT)
773F2836A698A5FE850CF320D1F849CA04E620E9B47F05816683260CBA2B8B1C  2026-09-20T01:36:35  default.js         (GRAFT)
7378DD41401BA1ACFF435B9C317A5B919A3D38479ED3DBD4A25C8B4FD623A224  2026-09-20T01:36:35  edge.d.ts          (GRAFT)
88C660628F3808541C5BC019ABA47B07F19562205077EF98F29E2B5203AEAFA6  2026-09-20T01:36:35  edge.js            (GRAFT)
8D832699D555582EA94EAB58D982357075A3EC5BCD06884343B75B5E613DEFF8  2026-09-20T01:36:35  index.d.ts         (GRAFT)
BB168C5D8DA9D47B8D2B7EE3501FAA655A59FC458E627EE4E60A4AD4167B5C78  2026-09-20T01:36:35  index.js           (GRAFT)
04EA9EEE5735688347F9FEE3E6EC21031B479EE50A1A6F0F2101CC704529108C  2026-09-20T01:36:35  index-browser.js   (GRAFT)
3A253C184E08ECFC2E8790BC157B37A4150DEC535452877923D1E50A35D3436E  2026-09-20T01:36:35  package.json       (GRAFT)
2B50B4328595B0FB99A73CFED34CF11FA8E56511DCC4FB808AF4516952448514  2026-09-18T00:38:20  query_engine_bg.js
B199ED8BF8F3610C20A3F7398B3CBB875F99B7D6565F4887FC0AF2B47DCEB30F  2026-09-18T01:02:51  query_engine_bg.wasm
263946105F428384D2318DC3241B85B1C3DD98FBB1BFAC62D3E81F513AB35897  2026-09-18T00:39:10  query_engine-windows.dll.node
6A3DF5CDC1BE487F9F7F2D6A6BDBDE8A08177826A1350FD2C9E785AC31228F17  2026-09-18T01:02:51  runtime\edge.js
E49F229D492C533E59C1CA50F609A53E5DB7690DE26AB725F28923E7B4D90371  2026-09-18T01:02:51  runtime\edge-esm.js
556CA4C51DF0DD6BDC52F3423A65108B044841195FED9B36BC4384849291E850  2026-09-18T00:38:20  runtime\index-browser.d.ts
1EBB5EFFBF49AE68F1CE58A13D6263212AB3F8F2F262A4D8A1D4322CA5C56A0A  2026-09-18T01:02:51  runtime\index-browser.js
B845876DE475C230A1E012150DB8D2C2A62BD6835A93E8CD23EBB10F7DE16266  2026-09-18T00:38:20  runtime\library.d.ts
AC8CA4757191B0423D3601F5935A58A234BD6D6A6FEC7C7F43CD58EEF0C6EBF0  2026-09-18T01:02:51  runtime\library.js
15410EBEDA938020ADC5B185D3B011E913EBDF10349C7628249BA0829A7B95A1  2026-09-18T01:02:51  runtime\react-native.js
F70EB51FD7F6B82E6421EB699F80959BDD5F8749DD995E3BD7D0C5BB648C097E  2026-09-18T01:02:51  runtime\wasm-compiler-edge.js
BAC8F1F027348255202BFC74D70F25D186FEE9E8A38B59D22821DA883A4ED9F0  2026-09-18T01:02:51  runtime\wasm-engine-edge.js
9491F9076B77D552034189CDE1955EB0E0899078CD5FAEA0AC60E7A1845DF49A  2026-09-18T01:02:51  schema.prisma
7378DD41401BA1ACFF435B9C317A5B919A3D38479ED3DBD4A25C8B4FD623A224  2026-09-18T01:02:51  wasm.d.ts
86588E248B9270B63F26129F1FD52272B4D83F011B8554C8BDFAE23E4A706282  2026-09-18T01:02:51  wasm.js
48311A316DAAB3B1C21DD227B7277D03436A7D10D78B19B3B625CD25FFA1674B  2026-09-18T01:02:51  wasm-edge-light-loader.mjs
48B4F73D61FE341EA5B59F09059F730DFB600249985A64F0456508DD4C81B01B  2026-09-18T01:02:51  wasm-worker-loader.mjs
```

## R3 risks

- NON_BLOCKING: graft source release `8eb0511baa53-20260917` is now a do-not-retire
  dependency (copied `index.js` embeds its paths; resolves via `__dirname` since
  `schema.prisma` sits beside the client).
- NON_BLOCKING: `git stash list` still shows the same 3 pre-existing unrelated stashes
  (`git stash` never used); worktree `status --short` clean apart from this file.
- NON_BLOCKING: sequence `last_value` values are point-in-time; the disclosed blind
  spots apply to post-action QA reproduction.

## Rollback status (R3)

No rollback triggered — all rows passed. Rollback basis if ever required: delete exactly
the 10 `(GRAFT)` rows above; the 17 others are never touched. Scratch removed on success.

## R3 tally and verdict

Rows: 6 passed / 0 blocked / 0 unperformed. Verdict: graft complete, ready for
independent post-action QA (`ACCEPT_READY` requires 6/6 reproduced).

## Suggested conventional commit message (R3)

`docs(prisma-repair-c01): execution evidence for add-only client graft (6/6 rows)`
