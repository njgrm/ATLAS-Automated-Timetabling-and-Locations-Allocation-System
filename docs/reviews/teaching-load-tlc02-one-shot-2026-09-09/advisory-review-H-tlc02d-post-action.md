# Post-Action Advisory Review - TL-C02D Department Label Apply and Fresh Teaching Load Preview

- Reviewer identity: `REVIEWER_H_TLC02D_POST_ACTION`
- Review date: 2026-09-09
- Role: Fresh independent post-action reviewer. The reviewer did not perform the apply, the replay, or the preview. All probes were read-only (no endpoint path containing `/apply` was called, no mutation was performed). The only filesystem writes were this review artifact and scratch probes created outside the repository in `C:\Users\njgro\AppData\Local\Temp\opencode` (and one temporary probe inside the worktree's `atlas-server` directory that was deleted immediately after each run; the worktree's `git status` is clean and identical to the pre-review state).
- Advisory evidence only. This review does not authorize any apply, merge, push, or successor unlock.

## Review scope and environment

- Worktree: `D:\ATLAS-worktrees\teaching-load-dept-apply`, branch `work/teaching-load-dept-apply`.
- Base/HEAD reviewed: `b96b8ccddab04692b15e6770b9e462f80b3c74be`.
- Database target (read-only probes): `atlas_recovery_clean_rebuild_20260905` (resolved from `D:/ATLAS/atlas-server/.env` DATABASE_URL; no credentials printed).
- Live HTTP target for the readiness/authority GETs: `http://localhost:5001` (the ATLAS dev server, PID 33700, started 2026-09-09 21:40, connected to the same recovery database).
- None of the following were called: `POST /faculty-assignments/department-authority/apply`, `POST /faculty-assignments/reconciliation/apply`, or any other `/apply` path.

## Check 1 - Hash recompute

### 1a. Department authority artifact (byte SHA-256)
- File: `D:\ATLAS\docs\verification\department-authority-apply-r4a.json`
- Recomputed SHA-256: `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF`
- Required: `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF`
- Result: PASS (exact byte match). Semantic hash `EAF49D08141E9B2F37E685D1B94A93BEA1B66E7D620755C37CFAAC6E352950BE`, decision fingerprint `5147D2ADEF09822134F420179E074584245CDCE0644236F78FF4D66B3A85EFE3`, and preview fingerprint `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A` also match the operator-approved values recorded in the authority prompt.

### 1b. TL-C02D prompt document
- Canonical authority copy: `D:\ATLAS\docs\prompts\teaching-load-department-authority-apply-tlc02d-2026-09-09.md`
  - Recomputed SHA-256: `F64800FDE33B37D37D99EE6DD69CDAD6448D7B84EE182014AFA1047374955BA6` (required value). Its sidecar at `D:\ATLAS\docs\prompts\teaching-load-department-authority-apply-tlc02d-2026-09-09.md.sha256` records the same hash. The main-repo copy is byte-identical to the pinned authority.
- Worktree copy committed by `b96b8ccd`: `D:\ATLAS-worktrees\teaching-load-dept-apply\docs\prompts\teaching-load-department-authority-apply-tlc02d-2026-09-09.md`
  - Recomputed SHA-256: `96BABA575A76C3038B04323FA47F05CDFBD22818B62E9121B423F3DB8E4E60D1` (does NOT equal the required value).
  - Root cause verified: the two files are textually identical (206/206 lines, zero line-level diff). The worktree copy was checked out with CRLF line endings (205 CRLF pairs, 0 bare LF) while the main-repo copy uses LF (205 bare LF, 0 CRLF), because `core.autocrlf=true` and no `.gitattributes`/`eol` rule applies. Byte hashes therefore differ.
  - The committed `.sha256` sidecar inside `b96b8ccd` records `F64800FD...`, which matches the LF main-repo copy but NOT the CRLF worktree file it accompanies. This is a sidecar/path-reference inconsistency in the committed handoff (process/documentation), not a content alteration. The authoritative prompt bytes (main repo) verify against the required hash.
- Result: PASS (authoritative copy) with a documented sidecar/path discrepancy on the committed worktree copy.

## Check 2 - Persisted department state (read-only Prisma, `atlas_recovery_clean_rebuild_20260905`)

- `DepartmentAlias` where schoolId=1: count = 0 (required 0). PASS.
- `DepartmentLabel` where schoolId=1: count = 8 (required 8). PASS.
- Persisted label inventory (id / code / label), exactly the eight authorized pairs:

| id | code | label |
|----|------|-------|
| 571 | AP | Araling Panlipunan |
| 572 | ENG | English |
| 573 | ESP | Edukasyon sa Pagpapakatao |
| 574 | FIL | Filipino |
| 575 | MAPEH | MAPEH |
| 576 | MATH | Mathematics |
| 577 | SCI | Science |
| 578 | TLE | Technology and Livelihood Education |

- Label `createdAt` timestamps span `2026-09-09T14:10:00.649Z` to `2026-09-09T14:10:00.657Z` (one apply transaction). PASS.
- Independent live confirmation via `GET /api/v1/faculty-assignments/department-authority?schoolId=1` (system token, HTTP 200): `aliases: []`, the same 8 labels, `labelRows: 8`, `revisionHash: 0B021EB20CC48144431B55E6AAAE4448CC89E48CDB02A7B69721073287939C39` - identical to the tlc02d preview artifact's `departmentAuthority.revisionHash`. PASS.
- The department authority revision hash equals the one bound in the saved reconciliation preview (see Check 5), confirming the preview was generated against the exact persisted post-apply state.

## Check 3 - Non-department invariants (school 1 / year 8) vs pre-apply values

Recomputed via Prisma over `atlas_recovery_clean_rebuild_20260905` and the production `canonicalHash` from `file:///D:/ATLAS/atlas-server/dist/lib/canonical-json.js`.

| Invariant | Required | Recomputed | Result |
|---|---|---|---|
| FacultySubject count (school 1 / year 8) | 88 | 88 | PASS |
| SubjectSectionOwnership count | 265 | 265 | PASS |
| FacultySubject canonical hash | `CD8BA55BD5DF9130F8C75F92152092F3F035350FFD8D87ABE468917CEF6AB797` | `80128C7620DB34ACFC212384B08752D0CF6CA5E72DC342290132E73BE9A4834A` (see finding H-1) | FAIL (see H-1) |
| SubjectSectionOwnership canonical hash | `9132BC87E68861BA18389248E18633A465007D3155ABEDF5A293FC45CE30DEE3` | `4FC60A3871DEE833CD8AE4FE3C2CAAA46F4A1BF6F4E67A1AF0AAC878C7BB3927` (see finding H-1) | FAIL (see H-1) |
| TeachingLoadCycle id 1 | POPULATED, version 4, updatedAt `2026-09-07T00:23:47.205Z` | POPULATED, version 4, updatedAt `2026-09-07T00:23:47.205Z` | PASS |
| Offerings (school 1 / year 8) | 216, all active | 216 total, 216 active | PASS |
| OfferingTermAssignment | 96 | 96 | PASS |
| SchoolYearTermConfig | id 71 | id 71, termCount 3, isActive true | PASS |
| Active non-archived EnrollProSchoolYearMirror (year 8 / 2029-2030) | exactly 1 | exactly 1 (id 1, enrollProSchoolYearId 8, yearLabel 2029-2030, isActive true, isArchived false, syncStatus synced) | PASS |
| GenerationRun (school 1) | 0 | 0 | PASS |
| PublishedScheduleRevision (school 1) | 0 | 0 | PASS |

### H-1 (material, evidence-level) - The stated reference hashes are not reproducible from the persisted data by any canonical method

The literal recomputation required by this review ("sorted {facultyId,subjectId,gradeLevels,sectionIds,version}" and "{facultySubjectId,facultyId,subjectId,sectionId,specializationCode}" via production `canonicalHash`) yields `80128C76...` and `4FC60A38...`, not the stated pre-apply reference hashes. Because the requirement is to recompute and compare exactly, this check does not match.

The reviewer ran an exhaustive variant matrix (30+ distinct canonical forms) to determine whether this is a data-drift signal or a method/reference discrepancy:

- content modes: with/without row `id`; `gradeLevels`/`sectionIds` raw (DB order) vs sorted-unique integer sets (production `canonicalIntSet` semantics);
- order modes: DB id order, `(facultyId, subjectId)` sort, full canonical-string sort, tuple-field sort, flat-tuple arrays;
- scopes: school 1 / year 8 filter and school 1 unfiltered (all rows are in year 8: 88/88 and 265/265);
- `canonicalHash`, `canonicalStringify`+sha256, and JSON-lines sha256.

None of the 30+ combinations reproduces either reference hash. Independent evidence in the same probe run shows the non-department data is provably unchanged since before the apply:

- `FacultySubject` min/max `createdAt` and max `updatedAt` = `2026-09-07T00:23:46.844Z` / `2026-09-07T00:23:47.203Z`; zero rows with `updatedAt >= 2026-09-08T16:00:00Z`.
- `SubjectSectionOwnership` max `updatedAt` = `2026-09-07T00:23:47.202Z`; zero rows touched since 2026-09-08.
- TeachingLoadCycle id 1 `updatedAt` = `2026-09-07T00:23:47.205Z` (untouched by the 2026-09-09 apply).
- Offerings and term assignments were created `2026-09-08T20:52:06` (before the apply); department labels `2026-09-09T14:10:00`.
- Audit log since 2026-09-08 contains only `LOCAL_LOGIN_SUCCESS` entries - no mutation events other than the label transaction's own rows.
- The authorized apply is restricted to `department_labels` creation; the reconciliation apply, teaching-load mutation, generation, and publication are all explicitly out of scope for TL-C02D and the readiness blocker confirms no reconciliation apply occurred.

The reviewer therefore classifies H-1 as follows: the current data provably equals the pre-apply data (all counts, cycle identity, timestamps, and the reconciliation plan totals in the saved preview all agree), so this is not evidence of post-apply drift. It is instead a failure to reproduce the specific reference hashes provided in the review brief by any canonical method; the reference values appear to have been produced by an unreferenced/undocumented computation and must be reconciled (or the exact pre-apply method re-supplied) before the hash leg of this invariant can be confirmed. The data-level invariants (counts, cycle, offerings, assignments, term config, mirror, generation, publication) all verify.

## Check 4 - Readiness GET (read-only)

`GET /api/v1/faculty-assignments/reconciliation/readiness?schoolId=1&schoolYearId=8` (system token) returns HTTP 200:

```json
{"schoolId":1,"schoolYearId":8,"ready":false,"demandCount":264,"ownedDemandCount":264,"unresolvedDemandCount":0,"validOwnershipCount":234,"blockers":[{"code":"TL_RECONCILIATION_PENDING","message":"30 demanded pairs are proposed for change and are not yet applied."}],"acceptedExceptions":0}
```

- demandCount 264, ownedDemandCount 264, ready false, blocker `TL_RECONCILIATION_PENDING` all match. PASS.
- Cross-check with the saved tlc02d preview: `actionTotals {RETAIN 234, INSERT 0, MOVE 30, RETIRE 1, UNRESOLVED 0}`; `validOwnershipCount 234`, 30 proposed changes, cycleImpact POPULATED/POPULATED v4. Consistent.

## Check 5 - Saved reconciliation preview artifact

- File: `D:\ATLAS-worktrees\teaching-load-dept-apply\docs\verification\teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json`
- Byte SHA-256 (recomputed): `0BBAC2BC532CBD884D41A015C87533036744EDFCBD6BBADA77E8ACF74FCA3BE9`
- Sidecar (`...json.sha256`): `0BBAC2BC532CBD884D41A015C87533036744EDFCBD6BBADA77E8ACF74FCA3BE9  teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json`
- Artifact equals its sidecar: PASS.
- `applied`: false (PASS); `authorizesNoMutation`: true (PASS); `preview.schoolId`: 1 (PASS); `preview.schoolYearId`: 8 (PASS).
- `source.termConfig.id` = 71, termCount 3, termIdentities ["Term 1","Term 2","Term 3"]; `source.sourceRevision` = `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`; `source.fingerprint` = `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`.
- `preview.departmentAuthority.labelRows` = 8, `revisionHash` = `0B021EB20CC48144431B55E6AAAE4448CC89E48CDB02A7B69721073287939C39`, which matches the live department-authority GET (Check 2). The preview is bound to the actual persisted post-apply state.
- `approvalSentence` and `departmentLabelApprovalSentence` are present and correctly separate Teaching Load approval (future) from the already-applied department labels.

## Check 6 - Git boundary

- Branch: `work/teaching-load-dept-apply`; HEAD = `b96b8ccddab04692b15e6770b9e462f80b3c74be` (exactly the stated base). PASS.
- `git status --porcelain` = empty (no pending tracked/untracked changes). PASS.
- `git rev-list --left-right --count origin/main...HEAD` = `0 0` (HEAD is not ahead of origin/main; no merge). `git branch -r --contains HEAD` lists only `origin/main`. No push detected. PASS.
- `git diff --check` exit 0.
- The verification JSON + `.sha256` sidecar exist on disk in `docs/verification/` but are NOT in commit `b96b8ccd`; they are covered by `.gitignore:38 docs/verification/*` and therefore appear as neither tracked nor pending. The commit `b96b8ccd` contains only `CHANGELOG.md`, the prompt handoff, and its `.sha256` sidecar. The preview JSON and this review artifact are durable but uncommitted/ignored, which is consistent with the repository's docs evidence policy but means the apply evidence itself is not bound in the commit. Process note only (the apply prompt explicitly excludes commit credentials/tokens/dumps and this review is written after the handoff commit).

## Findings summary

- F-1 (material, evidence-level): Check 3 hash leg FAIL - the two stated pre-apply canonical hashes are not reproducible by any of 30+ canonical methods over the persisted data (see H-1). All data-level invariants in the same check PASS and the non-department tables are provably unchanged since 2026-09-07 (cycle v4, timestamps, zero post-apply row touches, readiness/preview plan agreement). Classified as an unverifiable reference hash / method gap rather than evidence of mutation, but the literal "recompute and compare exactly" gate is not met.
- F-2 (process/documentation, low): the `.sha256` sidecar committed beside the worktree prompt copy records the LF-main-copy hash `F64800FD`, while the committed CRLF worktree copy bytes hash to `96BABA57`. The authoritative main-repo copy does verify to `F64800FD`. Sidecar/path reference should be aligned or the line-ending normalization made deterministic (e.g., `.gitattributes`).
- F-3 (process, informational): the fresh preview JSON and its sidecar are git-ignored and not bound in any commit; they are verifiable on disk only. No credential/token was committed.

## Checks and results

| # | Check | Result |
|---|-------|--------|
| 1a | r4a.json byte SHA-256 == D1D8E74E...FFBBCF | PASS |
| 1b | Authority prompt SHA-256 == F64800FD (main-repo copy + sidecar) | PASS (worktree CRLF copy differs: F-2) |
| 2 | DepartmentAlias 0 / DepartmentLabel 8 exact pairs | PASS |
| 3 | Non-department invariants: counts, cycle, offerings, terms, config, mirror, runs, published | PASS |
| 3 | FacultySubject / SSO canonical hashes == reference values | FAIL (F-1 / H-1) |
| 4 | Readiness 200, 264/264, ready false, TL_RECONCILIATION_PENDING | PASS |
| 5 | Preview artifact byte hash == sidecar; applied false; authorizesNoMutation true; schoolId 1; schoolYearId 8 | PASS |
| 6 | Git boundary: HEAD == b96b8ccd, no push/merge, clean status | PASS |

## Verdict

**`zeroFix: false` (NO-GO)**

The department-label apply itself is verified correct: exactly the eight operator-approved `DepartmentLabel` rows for school 1 exist with zero aliases, the apply is provably isolated to `department_labels` (all non-department tables untouched since 2026-09-07), the readiness surface is intact with `TL_RECONCILIATION_PENDING`, the saved preview artifact is byte-verified and bound to the real persisted state, and the Git boundary is clean at `b96b8ccd`. The single material blocker to a `GO`/`zeroFix:true` verdict is the Check 3 hash leg: the stated pre-apply FacultySubject/SSO canonical hashes cannot be reproduced from the persisted data by the production `canonicalHash` under any canonical ordering/mode tested (30+ variants), so the literal "recompute and compare exactly" requirement is not satisfied. Because the underlying data is independently proven unchanged, the likely cause is a mismatched reference hash or an undocumented pre-apply computation method, which must be reconciled (exact pre-apply probe method/field-set/ordering re-supplied, or corrected reference hashes) before formal acceptance. This review is advisory evidence only and does not authorize any apply, merge, push, or successor unlock.