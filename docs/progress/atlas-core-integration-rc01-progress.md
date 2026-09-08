# RC-01 — Core Stream Integration Seal — Progress Ledger (2026-09-09)

Executor: fresh DeepSeek executor session (RC-01).
Planner/QA: independent (user). Verdict boundary: `REVIEW_REQUIRED`; no formal `GO`.

Prompt: `docs/prompts/atlas-core-integration-rc01-seal-2026-09-09.md`
  SHA-256 `3D2313779086290D24BFA7DBFEDBA4858AFFBDDA80F482CCE5923329B28C8D61` (verified).
Manifest: `docs/verification/atlas-core-integration-rc01-planner-manifest-2026-09-09.json`
  SHA-256 `F0851FEE3E056B6D1D06CA860BC194325CD967B78A9A5AED89663EF6E49B9762` (verified).

Time budget: 25 minutes (started 2026-09-09 01:13 local). Hard stop enforced.

## Deliverables written

- `docs/verification/atlas-core-integration-rc01-preview-2026-09-09.json`
- `docs/verification/atlas-core-integration-rc01-preview-2026-09-09.json.sha256`
  (sidecar matches recomputed file bytes: `5F6F408C…16E40`)
- this progress ledger

No source file was modified. No staging/commit/stash/reset. No service restart.
No database/config write. No curriculum/department apply. No generation/publication.
No schema/migration. No external-repo contact. The only writes are the three outputs above.

## Preflight (RC-01.0)

- HEAD `f4ec1e766b4805d9333ce0827692fa1e6086ea77`, branch `main`.
- Dirty paths: 37 tracked-modified files + 414 untracked files (git ls-files --others count).
  All 37 modified paths are attributable to SCA / TL / TT / EVAL / shared-integration (`.gitignore`).
- Listeners at probe time: port 5001 PID 31648 (ATLAS server; PID differs from the TT-C01
  ledger's 37132 — recorded as observed, no restart performed); port 5174 PID 24884 (Vite).
- Database (sanitized): `atlas_recovery_clean_rebuild_20260905` @ localhost:5432.
- Active school 1 / year 8 (2029-2030), runtime source `atlas-persisted`.
- Census (from SCA-03E / TL-C01R4B / TT-C01B-R / EVAL-C01R1 ledgers, same live runtime):
  curriculum requirements 0, term configs 0, annual ownerships 265 (cycle POPULATED v4),
  department aliases 0, department labels 0, generation runs 0, published revisions 0,
  blocker OFFERING_TERM_CONFIG_MISSING.
- Companion repositories: not contacted (READ_ONLY maintained).

## Release-candidate inventory (RC-01.1)

- 95 candidate files: SCA 27, TL 31, TT 22, EVAL 10, SHARED 5.
- 37 tracked-modified (byte hashes recorded in preview); 58 untracked/new.
- Composition: production + test + evidence + `.gitignore` (config).
- Every candidate path has exactly one owner; no hunk is assigned to two streams.
- Untracked exclusions: 356 paths (of 414) explicitly excluded by category in the preview
  (historical recovery tests, execution-gate fixtures, artifact generators, earlier-stream
  local-only tests, other-stream docs/reviews, unrelated user files, `tmp/`, `.github/`,
  `phasePlan.md`, `ATLAS_AGENT_KI.md`, `CHANGELOG.md`, `playwright.config.ts`, PDF/DOCX).
- No `git add -A` / wildcard / stash / reset / clean / discard used.

## Focused coexistence gates (RC-01.2) — ALL PASS

| Stream | Gate | Result |
|---|---|---|
| SCA | curriculum-decision-candidates (server) | 61/61, exit 0 |
| SCA | decision-draft (client) | 38/38, exit 0 |
| TL | department-authority-gates (server) | 82/82, exit 0 |
| TL | department-authority-apply (server) | 63/63, exit 0 |
| TL | teaching-load-effective-workload-policy (server) | 56/56, exit 0 |
| TL | teaching-load-summary-zero-write-route (server) | 12/12, exit 0 |
| TL | client canonical-workload + helpers | 48/48, exit 0 |
| TT | collaboration lifecycle (client) | 5/5, exit 0 |
| TT | runtime-truth + affected state/decision/undo/swap/term/display + live-conflict | 78/78, exit 0 |
| EVAL | dashboard lifecycle hermetic (server) | 11/11, exit 0 |
| EVAL | dashboard HTTP authority (server) | 38/38, exit 0 |
| EVAL | client dashboard lifecycle | 7/7, exit 0 |
| both | server + client `tsc --noEmit` | clean, exit 0 |
| both | server + client production builds | pass, exit 0 |
| repo | `git diff --check` | clean (CRLF notices only) |
| repo | scoped secret/debug scan over candidate production paths | 0 hits |

Not run (explicitly out of RC-01.2 scope): database-recovery suites, broad historical
suites, full Playwright, generation, publication, external-subsystem suites. No
dependency install/update was performed.

## Production reachability and authority audit (RC-01.3)

- DecisionWorkspace route wired (`App.tsx:12/:74`); decision-candidates GET mounted
  (`curriculum-requirements.router.ts:204`); department-authority GET/preview/apply mounted
  (`faculty-assignment.router.ts:46/63/85`); actor-scoped collaboration sealed
  (`useTimetableCollaboration.ts`); dashboard lifecycle/publication authority in place
  (`dashboard-readiness.service.ts` minimal publication select + strict guard).
- No `DEFAULT_SCHOOL_ID` reintroduced in any candidate path (remaining hits are unrelated
  legacy pages). No code-owned curriculum decisions, no EnrollPro offering authority in
  candidates, no advisory-inclusive utilization, no catalog mutation during generation,
  no unassigned repair that invents demand.
- SCA-04, TL-C02, TT-C02, RC-02, generation, and publication remain locked.

## Mutation proof

All read-only + hermetic-disposable-fixture tests. Zero source edits, zero staged/committed
paths, zero service restarts, zero data/config/schema writes.

## Stop-eligibility / exit-criteria status

- Every candidate path has exactly one owner and a recorded SHA-256: YES.
- Unrelated dirty/untracked paths excluded explicitly: YES (356 excluded by category).
- Every listed focused gate ran and passed: YES (see table).
- No production service/helper orphaned: YES (reachability audit).
- No data/config/runtime/process/Git-index mutation: YES.
- Preview and sidecar match: YES (`5F6F408C…16E40`).
- Successors locked: YES.

## Finding list (returned to planner)

None material. One process note: the RC-01 prompt + manifest were already exposed by the
working-tree `.gitignore` change (shared-integration candidate); the RC-01 CHANGELOG entry
exists in `CHANGELOG.md` at line 3040 ("Core Integration RC-01 Seal", 2026-09-09) and
CHANGELOG.md is excluded from the 98-path package pending a separate planner packaging
decision. Also note the TT-C01 ledger PID (37132) for port 5001 differs from the
observed PID (31648) at probe time; no restart was performed and this is recorded for QA.

Status: `REVIEW_REQUIRED`. Awaiting independent planner/QA review of the preview artifact.

---

## RC-01R — Exact Packaging-Evidence Correction (2026-09-09, same executor session)

Risk: LOW. Time budget: 15 min (started 2026-09-09 01:36 local). Verdict boundary:
`REVIEW_REQUIRED`. RC-02 remains locked.

Prompt: `docs/prompts/atlas-core-integration-rc01-seal-2026-09-09.md` (RC-01R is an inline
correction instruction; no separate prompt file). Manifest pin unchanged
`F0851FEE…B762`; prompt pin unchanged `3D231377…8C61`.

### RC-01R.0 — Payload freeze and validation (PASS)

- Pre-write snapshot captured: `git diff --name-only` = 37 paths; `git ls-files --others
  --exclude-standard` = 416 paths; unique universe = 453.
- All 95 payload paths exist; 0 missing; 0 hash mismatch; 0 duplicates. Owner assignments,
  kinds, and tracked flags unchanged. **No payload byte changed — hashes were NOT
  regenerated; they match the RC-01 recorded values.**

### RC-01R.1 — Fresh read-only runtime census (DONE)

Command: `npx tsx --env-file=.env <temp census probe>` (read-only Prisma SELECT/COUNT
against the configured `DATABASE_URL`; probe in `%TEMP%`, no repo file created).
UTC: `2026-09-08T17:39:19.573Z`. DB: `atlas_recovery_clean_rebuild_20260905` @
localhost:5432. Actor school 1; active year 8 (2029-2030); active mirror id 1, not
archived.

| Measure | Result |
|---|---|
| curriculum requirements | 0 |
| active term configs | 0 |
| annual Teaching Load ownerships | 265 |
| Teaching Load cycle | POPULATED, version 4, updated 2026-09-07T00:23:47Z |
| department aliases | 0 |
| department labels | 0 |
| generation runs | 0 |
| published revisions | 0 |

Zero writes/login/restart/migration/generation/publication.

### RC-01R.2 — Exact exclusions (DONE)

- Excluded = universe (453) − payload (95) = **358 unique paths**, stored explicitly in the
  preview sorted lexicographically, each with exactly one non-overlapping category and a
  concise reason. No approximate counts/ranges/globs/`~N`/examples.
- Category counts: unrelated-github 25, coordination-docs 2, coordination-changelog 1,
  unrelated-earlier-stream-tests 114, other-stream-server-docs 1, historical-recovery-tests 9,
  artifact-generators 14, execution-gate-fixtures 100, unrelated-user-files 2,
  control-artifact-rc01-progress-ledger 1, other-stream-progress-ledger 5,
  other-stream-reviews 49, other (older superseded SCA/TL reviews) 13, tooling-config 1,
  unrelated-playwright-config 1, temporary-work 20.
- RC-01R output files created after the pre-write snapshot are control-plane artifacts and
  were not members of the 453-path pre-write universe.

### RC-01R.3 — Control-artifact lifecycle (DONE)

Future RC-02 staging set = exactly **98 paths**: 95 payload + the preview JSON + its
`.sha256` sidecar + this progress ledger. Because the preview and sidecar are gitignored,
RC-02 must use narrowly scoped `git add -f -- <preview> <sidecar>` (never `git add .`,
`git add -A`, directory staging, or wildcards). Two-tier integrity model documented in the
preview: payload integrity = per-file SHA-256 inside the preview; preview integrity = exact
preview-byte SHA-256 in the sidecar.

### RC-01R.4 — CHANGELOG statement corrected (DONE)

`CHANGELOG.md` contains an RC-01 entry beginning at line 3040 ("Core Integration RC-01
Seal"). It is excluded from the 98-path package pending a separate planner packaging
decision. The prior RC-01 claim that no entry exists is RETRACTED. `CHANGELOG.md` was not
edited.

### RC-01R.5 — Evidence regenerated (DONE, checks PASS)

- JSON parses: YES. Sidecar equals exact preview-byte SHA-256: YES
  (`96149D8952A9F570B30191E74D956BEF9596D5267020A73F977F950868FD2F7F`).
- Payload remains exactly 95 files; future staging set exactly 98; excluded-path count (358)
  equals the stored exclusion array length (358).
- All 95 payload hashes still match the recorded values (0 mismatch re-verified).
- `git diff --check` passes (CRLF notices only).
- No product suites or builds rerun (no product/test byte changed).

### RC-01R mutation proof

Only the three RC-01R outputs were rewritten (preview JSON + sidecar + this ledger). No
product source, test, schema, database, process, runtime, or configuration was changed.

Status: `REVIEW_REQUIRED`. RC-02 remains LOCKED.

---

## RC-01N — Preview Normalization (2026-09-09, same executor session)

Risk: LOW. Time budget: 15 min (started 2026-09-09 01:51 local). Verdict boundary:
`REVIEW_REQUIRED`. RC-02 remains locked.

Instruction: normalize the RC-01 preview; do not append another correction object.

### Changes applied to the preview

1. `rcorrection.freshCensus` promoted into the canonical top-level `runtimeSignature`
   (probe command, UTC, DB name/host, actor school, active year/label/mirror, results,
   mutation). The old ledger-derived `censusBasis` was removed.
2. Obsolete top-level `excludedUntracked` replaced by `exactExclusions` (promoted from
   `rcorrection.exactExclusions`).
3. `rcorrection.controlArtifacts` promoted to top-level `controlArtifacts`.
4. Top-level `proposedRC02Procedure` replaced with the corrected 98-path staging
   procedure (95 payload + 3 control-plane artifacts; narrow `git add -f` for the
   ignored preview/sidecar; no `git add .`/`-A`/directory/wildcard).
5. The entire `rcorrection` wrapper removed after its content was promoted.
   `payloadFrozen`, `changelog`, and `rc01rStartedUtc` were likewise promoted to
   top-level.
6. The 95-file payload and every payload hash preserved unchanged.
7. Progress ledger updated; preview sidecar regenerated.

### Mechanical proof (all PASS, exit 0)

| Check | Result |
|---|---|
| preview parses | PASS |
| sidecar matches exact preview bytes | PASS (`EF8176CA…8827`) |
| payload = 95 | PASS |
| exclusions = 358 unique byte-order-sorted paths | PASS |
| staging set = 98 (95 + 1 + 1 + 1) | PASS |
| payload hash mismatches = 0 | PASS |
| no stale `"356"` count | PASS |
| no approximate exclusion categories in category/reason fields | PASS |
| no ledger-derived census (`censusBasis` / old `census`) | PASS |
| no 95-only staging instruction remains | PASS |
| no `rcorrection` wrapper / obsolete `excludedUntracked` | PASS |
| `git diff --check` | PASS (CRLF notices only) |

No tests or builds were run. No product source, test, configuration, runtime, or
database state was changed. Only the preview JSON, its sidecar, and this ledger were
written.

Status: `REVIEW_REQUIRED`. RC-02 remains LOCKED.
