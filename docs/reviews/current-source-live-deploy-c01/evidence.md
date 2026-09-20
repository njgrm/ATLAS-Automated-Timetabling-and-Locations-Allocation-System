# CURRENT-SOURCE-LIVE-DEPLOY-C01 — executor evidence

Base `2d53b2a10ddd7b09ef8c0fd7ebc25c0fa186a9ad` (`origin/main`, re-fetched; target pin exists; worktree clean).
Target pin `7499916886707c35ea708a17ef7a87e791a6bade` at `D:\ATLAS-runtime-supervised-74999168-20260920`.
Elevated executor: true. No secret, env value, DB row, or log pasted here.

## Preconditions (all PASS, fail-closed)

1. Elevated Administrator: true.
2. `origin/main` = `2d53b2a1`; pin `74999168` verified (`git cat-file -t commit`); later tip did not replace pin.
3. Incumbent reproduced, matched `docs/plans/live-state.md`: task SYSTEM (`S-1-5-18`) / At-system-startup /
   `PT0S` / `IgnoreNew`; machine `ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918`,
   `ATLAS_RUNTIME_RELEASE_SHA=74c1f12a…`; supervisor PID 67028 with children 5001→63688 / 5174→12992
   (command lines verified); listeners owned by those PIDs; local health/ready, host `/`, Tailnet health 200;
   DB-backed subjects read 200; durable-env hash `BC7921A7…AED565C` with 17-key set; served chunk
   `assets/index-CtOKnF1z.js` (matches live-state). No divergence.
4. Disk: D: free 23.31 GiB pre-build; incumbent footprint ~0.58 GiB; post-install free 21.8 GiB (> 15 GiB). Proven.
5. Rollback basis: incumbent `dist/server.js` + `dist/index.html` present; server `node_modules` junction →
   do-not-retire `0eb3b67f` tree holding generated `index.js`; client `node_modules` junction →
   `E:\ATLAS-worktrees\ux-quickfix-c01\…`; Git identity `74c1f12a`; `ops/runtime/cli.mjs` present. Untouched after.
6. Original task XML exported to operator-only `%TEMP%`, SHA-256 `72FB5C1C…273CA8C`. Fields captured:
   SYSTEM / BootTrigger(ONSTART) / PT0S / IgnoreNew / incumbent action+workdir. Retained until QA terminal.
7. System `safe.directory` = wildcard `*` → gate satisfied by wildcard; nothing added.
8. Pre schema-wide signature map: 46 tables, file SHA-256 `222718C7…E7C3E3` (names+counts+hashes only).
9. Release built before touching 5001/5174: clean clone, checkout at exact pin (HEAD verified, status clean);
   locked `npm ci` in root (270 pkgs), server (252), client (237) — own trees, no junctions; `prisma generate`
   from `atlas-server` vs repo-root schema → client v6.19.2 + `PRISMA-IMPORT-SMOKE-OK`; server `tsc` build +
   `dist/server.js`; client build with exactly `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
   (SMART/AIMS start URLs unset in env); `companion-config.test.ts` 11/11 (SMART+AIMS disabled plain text,
   no `href`); alternate-port smokes: server `:5052` health/ready/subjects 200, host `:5199` 200; jobs stopped,
   ports clear, zero background jobs.
10. Built manifest from `dist/index.html`: single JS asset `index-Bk7FKtfs.js`,
    SHA-256 `4F55D9452418D534116F035703498FBA8A3FD5A1705C6128057074CC04DA8F98` (differs from incumbent chunk).

## Cutover (single short step, after all above passed)

- `taskkill /PID 67028 /T /F` (incumbent tree) + incumbent `cli.mjs stop` with incumbent machine values in
  child env → state `stopped`; settled 12 s; 5001/5174 free; task `Ready` (not Running).
- Machine vars re-pointed to target dir + pin (verified by re-read).
- Replacement XML: exactly 2 string swaps (action args + workdir) → UTF-16 encoding repair (schtasks rejects
  the UTF-8-with-UTF-16-declaration bytes its own `/query /xml` emits; original capture untouched,
  re-declaration matches bytes, no property changed) → registered OK, hash `B6D36B02…AB32`; re-export
  field-compared: SYSTEM/ONSTART/PT0S/IgnoreNew/command preserved, action+workdir = target.
- Required `Ready`, then single `schtasks /run` → task `Running`. Temp new/re-export XMLs removed (hashes kept).

## Acceptance 8/8 PASS (0 blocked, 0 unperformed)

1. Release: installed HEAD `74999168`; machine SHA prefix `74999168`; task action/workdir = target;
   supervisor-state `releaseSha=74999168…`, `sourceDir`=target, `state=running`, ownedPids 40332/86720.
   (`productPin=d44f29e0` ignored as historical per packet.)
2. Ownership: single listeners 5001→40332, 5174→86720; both `ParentProcessId=83856`
   (`…\74999168-20260920\ops\runtime\cli.mjs start`, task-launched, not executor shell).
3. Health: local health/ready 200, host live/ready 200, Tailnet health 200, subjects read 200.
4. Term truth: `…/schools/1/schedules/published?termIndex=1` → 200, 920 entries, distinct termIndex = {1};
   `termIndex=bogus` → typed 400 `INVALID_TERM_INDEX`.
5. Warnings: latest + run-specific violation reports → 401 `NO_TOKEN` pre-dispatch. No login performed.
6. Client identity: Tailnet `/` 200, no React-crash markers, serves `/assets/index-Bk7FKtfs.js` whose fetched
   bytes SHA-256 = `4F55D945…98` (manifest-equal); contains EnrollPro origin; no SMART/AIMS start-URL values
   (only inert env-key references; 11/11 component control proves disabled plain text, no `href`).
7. Config: env hash unchanged `BC7921A7…`, 17-key set unchanged, supervisor log
   `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`, no SMART/AIMS secret/URL invented.
8. Peers + zero mutation: SMART/AIMS starts → typed 503 `COMPANION_SSO_NOT_CONFIGURED`, no Location,
   no Set-Cookie; post schema-wide map (46 tables) SHA-256 = pre `222718C7…` byte-identical.

## Risks

- NON_BLOCKING: D: remains below the 25 GiB warning (21.8 GiB free; 15 GiB floor holds with margin).
- NON_BLOCKING: new supervisor-state omits the old `invariants` block; rollover-disabled proven via log line.
- NON_BLOCKING: task-XML encoding repair (above); original capture byte-preserved for symmetric rollback.
- BLOCKING: none open. Rollback NOT executed (no mandatory failure); incumbent + fallbacks preserved untouched.

## Rollback status

Not required, not executed. Symmetric path staged: original XML (`72FB5C1C…`) retained operator-only until
post-action QA terminal; incumbent release, `0eb3b67f` client graft, and `ux-quickfix-c01` host deps untouched.

Verdict: `REVIEW_REQUIRED` — deployed and 8/8 on the real path; awaiting fresh independent post-action QA.

## Addendum (2026-09-20): retained schema-wide signature method + reproduction

Post-action QA (7/8, row 8 partially blocked) found the signature method under-retained: the recorded file
hash `222718C7…E7C3E3` could not be reproduced from the packet's literal single-quoted text, which fails on
this database with `42883`/`42846`. This addendum retains the exact method and its reproduction. No runtime,
task, port, machine-variable, env-file, migration, login, or write action was taken for it.

Literal SQL issued (via `$queryRawUnsafe` on a throwaway Node script resolving `@prisma/client` from the
do-not-retire graft tree `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\atlas-server`; `DATABASE_URL`
read from the durable env file into that child process only; script deleted after each run):

- Table enumeration: `SELECT tablename FROM pg_tables WHERE schemaname=$$public$$ ORDER BY tablename`
- Per table `T` (name safely quoted as `"T"` with `"` doubled): `SELECT COUNT(*)::int AS c,
  COALESCE(md5(string_agg(md5(row_to_json(t)::text), $$$$ ORDER BY md5(row_to_json(t)::text))),
  md5($$$$)) AS s FROM public."T" t`

`$$public$$` ≡ `'public'` and `$$$$` ≡ `''` (dollar-quoting is semantically identical to the packet's
single quotes; it only avoids shell/round-trip mangling). The row expression is the packet's literal
`row_to_json(t)` — unchanged.

Serialization/ordering rule: for each table, per-row key `md5(row_to_json(t)::text)`, rows ordered by that
key, concatenated with the empty-string separator, outer `md5` over the concatenation; an empty table maps
to `md5('')`. Output text is one line per table, tables in name order, `"<name> count=<n> sig=<md5>"`, plus a
trailing newline. The recorded value is the SHA-256 of that whole file.

Reproduction (read-only, exact reconstructed script, run after QA's finding): 46 tables, file SHA-256
`222718C713FEA9370C8BC903D067C2B002D8373F28416C313331CCA030E7C3E3` — EQUAL to the recorded pre and post
values. No `42883`/`42846` occurred under this exact method.

Timing/identity implication: the pre map was captured before the release build finished and before any
quiescence of 5001/5174 — a true pre-mutation baseline. Pre = post (recorded in-session) = independent
reproduction now, all three under the identical method, so the zero-database-write identity claim stands;
the gap was retention, not runtime behaviour.

Packet-correction observation: the literal single-quoted `row_to_json(t)` form from precondition 8 is
unusable as written on this database (`42883`/`42846` per QA's 25+ variants), while the semantically
identical dollar-quoted text above succeeds. The next packet revision must pin the exact SQL text and the
serialization/ordering rule verbatim (as retained here) instead of the bare expression — the same class of
correction the repair packet's sequence clause required. Residual risk: NON_BLOCKING (evidence gap closed;
no runtime defect; rollback still executable and untouched).
