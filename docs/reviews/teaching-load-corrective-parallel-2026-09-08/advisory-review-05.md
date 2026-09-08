# Advisory Review 05 — TL-C01R4 Department Authority Production Apply Path (workflow only, no mutation)

- Reviewer identity: FRESH advisory reviewer context, independent of implementation. Did NOT implement TL-C01R4. Prior reviews 01–04 covered SUPERSEDED scopes and were disregarded; all findings below were re-verified from source in this session.
- Reviewer spawn ID: none supplied by the execution system for this review (no verifiable orchestrator-issued reviewer identifier was relayed with the task). Independence basis: this context authored no TL-C01R4 code, edited no source files, and wrote only this artifact plus two TEMP read-only probes (both deleted after their runs; see evidence).
- Review date (UTC): 2026-09-08. Authoritative record: `D:\ATLAS\docs\progress\teaching-load-corrective-parallel-2026-09-08-progress.md` (TL-C01R4 section, cumulative inventory, boundary).
- Scope verdict: advisory only. This artifact does NOT mark formal GO. No successor is unlocked by this review.

## Reviewed file hashes (recomputed by reviewer)

| File | Expected (ledger R4) | Recomputed | Match |
|---|---|---|---|
| `atlas-server/src/services/department-authority.service.ts` (NEW) | `498728EF…` | `498728EF5E76FC65CB6D4F16F0484A447504B8A53F58DD095376F0FA318506F2` | YES |
| `atlas-server/src/routes/faculty-assignment.router.ts` | `554EE9E5…` | `554EE9E5…D6363EA0` (full hash in rerun log) | YES (first-8 match; full hash recorded at review time) |
| `atlas-server/src/__tests__/department-authority-apply.test.ts` (NEW, gitignored) | `3A0D8007…` | `3A0D8007F0A147AA77E1D098E64A4772409240F207B1C180EC655F46FFD7EB6E` | YES |
| `atlas-server/src/services/faculty-assignment.service.ts` (unchanged by R4) | `B613EBC2…` | `B613EBC25163…` | YES |
| `atlas-server/src/services/scheduling-policy.service.ts` (unchanged by R4) | `F8935A57…` | `F8935A57A242…` | YES |
| `atlas-server/src/services/teaching-load-cycle.service.ts` (unchanged by R4) | `AB0AB52D…` | `AB0AB52D7E7B…` | YES |
| `atlas-server/src/__tests__/teaching-load-effective-workload-policy.test.ts` (unchanged by R4) | `EB3056BE…` | `EB3056BE511E…` | YES |
| `atlas-server/src/__tests__/teaching-load-summary-zero-write-route.test.ts` (unchanged by R4) | `0189A318…` | `0189A31887FB…` | YES |

Note on artifact hashes: whole-file `Get-FileHash` of the two `docs/verification/*.json` files is EXPECTED to differ from the sidecar values. The sidecar (`.sha256`, format `<HASH>  <filename>`) records the canonical payload fingerprint, i.e. `canonicalHash(payload)` with `generatedAt`/`sha256` envelope fields excluded — not the whole-file digest. Verified: recomputed `canonicalHash(payload)` equals the embedded `sha256` equals the sidecar hash for BOTH artifacts (see evidence).

## Requirement-to-enforcement matrix (R4.0–R4.5)

| Req | Requirement | Enforcement (production call site) | Test / proof |
|---|---|---|---|
| R4.0 | Preflight: decision `5147D2AD…` honored, 8 labels / 0 aliases, tables empty before and after | Decision JSON `proposedAliases:[]`, 8 `proposedLabels`; reviewer read live counts `0/0` pre-run AND post-run | Reviewer probe 19/19 + adversarial probe 12/12 (counts `aliases=0 labels=0` both runs) |
| R4.1a | No alias inference; values pass through verbatim after trim | `department-authority.service.ts:82-130` — `normalizeToken` trims + validates only; `classifyChanges` (`:195-223`) uses exact-equality match; grep for infer/glossary/startsWith/keyword/prefix found only the doc comment (`:11`) and verbatim pass-through maps (`:161,:231,:356`) | Reviewer probe: padded `'  FIL  '` → `'FIL'`, no rewriting; effective-policy suite alias-set A/B retarget tests 56/56 |
| R4.1b | Preview deterministic + fingerprint bound (school + sorted rows + source revision via shared `canonicalHash`) | `buildDepartmentAuthorityFingerprint` (`:151-168`): `schemaVersion TL-C01R4.1`, `schoolId`, sorted aliases/labels, `sourceRevision`, shared `canonicalHash` from `lib/canonical-json.ts` | Suite §2 order-independence PASS; reviewer recompute of `3CFAE3A1…` via the shared service fn PASS + shuffled-input equality PASS |
| R4.1c | Apply gates: actor-school 403, confirmation 400, fingerprint 409, drift 409 | `assertSchoolScope` (`:267-271`, enforced `:302`); confirmation (`:303-305`); `assertSourceRevision` (`:273-287`, enforced `:316`); fingerprint recompute+compare (`:317-320`) | Suite §§3–6 zero-write gates PASS (400/409/403 typed, `writes().length===0` each) |
| R4.1d | Conflict whole-tx abort; Serializable; in-tx revalidation; writes confined to the two department tables for the actor school | Pre-tx conflict abort (`:322-329`, zero writes — no write precedes it); `Serializable` (`:381`); in-tx re-read + revalidate (`:349-368`); only `tx.departmentAlias.create` / `tx.departmentLabel.create` with `schoolId` (`:370-377`); replay path opens NO transaction (`:334-347`) | Suite §§7–10 PASS: abort leaves exactly seed row, zero label writes; stale preview 409 `SOURCE_DRIFT`; 8 creates `DepartmentLabel:create` only; replay `replayed:true` zero writes; rollback receipt 8 scoped rows (§11) |
| R4.2 | Routes transport-only, privileged auth, typed 4xx without writes, safe registration order | `faculty-assignment.router.ts:42-95`: `authenticateWithSystemToken` + `requirePrivilegedRole` on all 3 routes; param validation + actor-school 403 via `rejectSchoolScopeConflict` before any service call; service errors via `next(err)`; static routes registered at `:42-95`, well before `/:facultyId` at `:817` — no shadowing | Static inspection verified (no route-level business logic; no direct prisma writes in the three handlers). Live route matrix (7/7 per ledger R4.5) was implementer evidence, not rerun by this reviewer (would require a server bind; out of reviewer scope — recorded as reused evidence, not a fresh PASS) |
| R4.3 | 13 required proofs incl. fixture zero-residue, recorder negative control, no forbidden-model writes | Test file `department-authority-apply.test.ts:1-330` (disposable fixture school, `finally` cleanup with count proof) | Reran: 37/37 PASS (fixture id=12, `zero residue aliases=0 labels=0 school=0`); forbidden-model set incl. `DepartmentAlias` clean (§12); recorder negative control flags direct `create` |
| R4.4 | Apply artifact: 8 creates / 0 aliases, rollback deletes, source revision, exact approval sentence, fingerprint verifies, NOT applied | `docs/verification/department-authority-apply-3978787df101.json` (+ `.sha256` sidecar, gitignored) | Reviewer probe: `canonicalHash(payload)` = embedded = sidecar `3978787D…`; preview fingerprint recompute = `3CFAE3A1…`; approval sentence byte-exact; `authorizesMutation:false`; `decisionFingerprint` links `5147D2AD…`; live tables `0/0` (fingerprint NOT applied) |
| R4.5 | Focused verification gates | Exact commands rerun by reviewer (see results) | 37/37 + 56/56 + 12/12 + 8/8 + 69/69; server tsc clean; client tsc clean |

## Rerun results (all commands executed by this reviewer, current run)

- `cd D:\ATLAS\atlas-server; npx tsx src/__tests__/department-authority-apply.test.ts` → 37/37 PASS, exit 0 (fixture school id=12, zero-residue proof `aliases=0, labels=0, school=0`).
- `cd D:\ATLAS\atlas-server; npx tsx src/__tests__/teaching-load-effective-workload-policy.test.ts` → 56/56 PASS, exit 0.
- `cd D:\ATLAS\atlas-server; npx tsx src/__tests__/teaching-load-summary-zero-write-route.test.ts` → 12/12 PASS, exit 0 (summary GET zero writes, 10 reads; rolled-back positive control observed then unchanged).
- `cd D:\ATLAS\atlas-server; npx tsx src/__tests__/workload-policy.test.ts` → 8/8 PASS, exit 0.
- `cd D:\ATLAS\atlas-server; npx tsc --noEmit` → clean, exit 0.
- `cd D:\ATLAS\atlas-client; npx tsx --test src/lib/__tests__/teaching-load-canonical-workload.test.ts src/lib/__tests__/faculty-assignment-helpers.test.ts src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts` → 69/69 PASS, exit 0.
- `cd D:\ATLAS\atlas-client; npx tsc --noEmit` → clean, exit 0.
- Reviewer TEMP probes (read-only + disposable-fixture-free): `tmp-r4-reviewer-probe.ts` 19/19 PASS (both artifact fingerprints via shared `canonicalHash`, approval sentence, rollback scope, order-independence, live `0/0`); `tmp-r4-reviewer-adv.ts` 12/12 PASS (blank/duplicate/overlong/non-array/non-string → all `400 INVALID_DEPARTMENT_AUTHORITY`; verbatim trim; post-run live `0/0`). Both files deleted after their runs (deletion verified; `__tests__/` is gitignored so they never entered git status).

## Adversarial probes re-derived (minimum set, all PASS)

1. Forged fingerprint apply → `409 FINGERPRINT_MISMATCH`, zero writes (suite §4, rerun).
2. Cross-school apply with actor mismatch → `403 SCHOOL_MISMATCH`, zero writes (suite §5, rerun).
3. Conflicting-label apply after divergent seed (`FIL→Wikang Filipino`) → `409 DEPARTMENT_AUTHORITY_CONFLICT`, pre-state intact, zero label writes (suite §7, rerun).
4. Stale-preview apply after concurrent write → `409 SOURCE_DRIFT`, zero writes (suite §8, rerun).
5. Replay after success → `replayed:true`, zero writes, all `unchanged` (suite §10, rerun).
6. Blank/duplicate/overlong rows → all `400 INVALID_DEPARTMENT_AUTHORITY` (reviewer adversarial probe, 10/10 validation cases; suite does not cover these — the service throws during normalize BEFORE any DB read, lines 246–247, so the probe needed no fixture and wrote nothing).

## Boundary verification

- Zero SCA-03E contact: R4 diff touches only `department-authority.service.ts` (NEW), `faculty-assignment.router.ts` (3 routes), `department-authority-apply.test.ts` (NEW). Concurrent-stream files (`curriculum-requirements.router.ts`, `curriculum-decision-candidates.service.ts`, subjects-curriculum progress) appear in worktree status but are pre-existing other-stream ownership per the ledger, untouched by R4. No curriculum/generation/timetable/subject edits in the R4 scope.
- No schema/migration: `git status` shows no `atlas-server/prisma` changes; no migration files added.
- Nothing staged: `git diff --cached --stat` empty. All work unstaged (plus gitignored test/artifact paths, consistent with the `**/__tests__/` + `docs/` ignore rules).
- No deployment/restart of port 5001: no listener on local port 5001 at review time. Reviewer started no server (isolated 5099 smoke in R4.5 is implementer evidence, not rerun here).
- No live mutation beyond disclosed fixture cycles: only writes in this review were the rerun suite's own disposable fixture-school create/delete cycles (authorized pattern), which self-proved `aliases=0, labels=0, school=0` residue; reviewer probes were read-only except calling already-validated throwing paths. Live school 1 alias/label tables read `0/0` before AND after all runs.
- Stray scripts: no department-authority generator scripts remain in `atlas-server/src` (only the service + test). Other `tmp*`/`probe*` files found (`tmp-sca02r-own-probe.ts`, `probe-targeted-reads.ts`, `tmp-adv-escape`, execution-gate fixtures, `dist/` artifacts) belong to other streams/prior runs, not TL-C01R4.

## Findings

### Product/runtime defects (material): NONE

No material product or runtime defects found. All gates, fingerprints, gates' zero-write properties, transaction semantics, and artifact contents verified from source and by rerun.

### Process/documentation observations (non-blocking, no fix required)

- P-05a (process): no reviewer spawn ID was supplied with this review task, so formal independence rests on context separation (documented above) rather than a verifiable orchestrator-issued identifier. Formal acceptance should record its own pinned review receipt outside the executor boundary.
- P-05b (docs): the R4 suite does not assert blank/duplicate/overlong row validation (service `normalizeToken`/duplicate guards, `:82-130`); coverage comes from this reviewer's TEMP probe, which was deleted. If the planner wants that coverage durable, add 3–5 permanent assertions to the (gitignored) suite — suggested, not required.
- P-05c (docs): the whole-file SHA-256 of the verification JSONs differs from the sidecar values by design (sidecar = canonical payload fingerprint). Future readers recomputing `Get-FileHash` naively will see a "mismatch"; the artifact/ledger could state the verification procedure (`canonicalHash(payload)` == embedded == sidecar) explicitly. No content change needed.

## Required fixes

None. `zeroFix: true` (advisory only; formal GO is out of scope for this review and is NOT granted herein).
