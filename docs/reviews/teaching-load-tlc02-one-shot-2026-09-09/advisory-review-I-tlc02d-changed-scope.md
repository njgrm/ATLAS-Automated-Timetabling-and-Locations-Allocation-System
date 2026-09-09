# Changed-Scope Review - TL-C02D Corrected Non-Department Invariant Hash Evidence

- Reviewer identity: `REVIEWER_I_TLC02D_CHANGED_SCOPE`
- Review date: 2026-09-09
- Role: Fresh changed-scope reviewer, independent from the implementer and from reviewer H. Scope limited to the corrected evidence for prompt TL-C02D. All probes were read-only. No endpoint path containing `/apply` was called; no mutation was performed. The only repository write is this artifact. A read-only Node probe was created and run from `C:\Users\njgro\AppData\Local\Temp\opencode` (outside the repository) and deleted after use.
- Advisory evidence only. This review does not authorize any apply, merge, push, or successor unlock.

## Changed scope reviewed

1. `D:\ATLAS-worktrees\teaching-load-dept-apply\docs\progress\teaching-load-tlc02-one-shot-2026-09-09-progress.md` - the `## TL-C02D` section, specifically the "Deterministic non-department invariant signature (TL-C02D evidence basis)" block (ledger lines 208-211).
2. `D:\ATLAS-worktrees\teaching-load-dept-apply\docs\verification\teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json` and its `.sha256` sidecar.
3. `D:\ATLAS-worktrees\teaching-load-dept-apply\docs\reviews\teaching-load-tlc02-one-shot-2026-09-09\advisory-review-H-tlc02d-post-action.md` (context for the finding under closure).
No unrelated source was reviewed.

## Environment

- Worktree: `D:\ATLAS-worktrees\teaching-load-dept-apply`, branch `work/teaching-load-dept-apply`, HEAD `b96b8ccddab04692b15e6770b9e462f80b3c74be`.
- Database target (read-only): `atlas_recovery_clean_rebuild_20260905` on localhost:5432, resolved from `D:/ATLAS/atlas-server/.env`. No credentials printed.
- Runtime: Node v24.14.1 (global `crypto.subtle` available). PrismaClient loaded from `D:/ATLAS/atlas-server/node_modules`; `canonicalHash` imported from `file:///D:/ATLAS/atlas-server/dist/lib/canonical-json.js`.

## Checks and independent reproduction

### A. FacultySubject deterministic hash (ledger method followed verbatim)

Probe: Prisma `findMany` on `facultySubject` where `schoolId=1, schoolYearId=8`, selecting `facultyId, subjectId, version, gradeLevels, sectionIds`. Each row normalized to `{facultyId, subjectId, version, gradeLevels[], sectionIds[]}` with `gradeLevels` and `sectionIds` each sorted ascending numerically. Rows sorted by `(facultyId, subjectId, version)`. Set hashed with server `canonicalHash`.

- Recomputed count: 88 (required 88). PASS.
- Recomputed hash: `80128C7620DB34ACFC212384B08752D0CF6CA5E72DC342290132E73BE9A4834A` (required `80128C76...4834A`). PASS.

### B. SubjectSectionOwnership deterministic hash

Probe: Prisma `findMany` on `subjectSectionOwnership` where `schoolId=1, schoolYearId=8`, selecting `facultySubjectId, facultyId, subjectId, sectionId, specializationCode`. Each row normalized to `{facultySubjectId, facultyId, subjectId, sectionId, specializationCode}` (null preserved as null; no coercion applied). Rows sorted by `(facultySubjectId, subjectId, sectionId, facultyId)`. Set hashed with server `canonicalHash`.

- Recomputed count: 265 (required 265). PASS.
- Recomputed hash: `4FC60A3871DEE833CD8AE4FE3C2CAAA46F4A1BF6F4E67A1AF0AAC878C7BB3927` (required `4FC60A38...3927`). PASS.

The ledger method text is precise and unambiguous: field set, array sort rule (ascending numerical), row sort tuple, hash primitive (`canonicalHash`, SHA-256 over recursively key-sorted canonical JSON). An independent engineer following the ledger text reaches exactly the recorded literals, which is confirmed by my reproduction from persisted data. The finding's requirement is satisfied.

### C. Immutability and persisted department authority (read-only)

Probe: `aggregate` max `createdAt`/`updatedAt` plus counts of rows with `updatedAt >= 2026-09-08T00:00:00Z` on both tables for school 1 / year 8; `count` on `departmentLabel`/`departmentAlias` for school 1; read of the teaching load cycle.

- FacultySubject: max `createdAt` `2026-09-07T00:23:47.201Z`, max `updatedAt` `2026-09-07T00:23:47.203Z`, rows touched since 2026-09-08: 0. Matches ledger literal `.201Z/.203Z`. PASS.
- SubjectSectionOwnership: max `createdAt` and `updatedAt` `2026-09-07T00:23:47.202Z`, rows touched since 2026-09-08: 0. Matches ledger literal `.202Z`. PASS.
- Both maxima predate the 2026-09-09 label apply, proving zero post-apply touch on the two non-department tables.
- DepartmentLabel school 1: 8 rows with exactly AP=Araling Panlipunan, ENG=English, ESP=Edukasyon sa Pagpapakatao, FIL=Filipino, MAPEH=MAPEH, MATH=Mathematics, SCI=Science, TLE=Technology and Livelihood Education. PASS.
- DepartmentAlias school 1: 0. PASS.
- TeachingLoadCycle id 1: state POPULATED, version 4, updatedAt `2026-09-07T00:23:47.205Z`. Matches ledger. PASS.

### D. Preview artifact binding and internal consistency (read-only)

- Byte SHA-256 of `teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json`: `0BBAC2BC532CBD884D41A015C87533036744EDFCBD6BBADA77E8ACF74FCA3BE9`. Sidecar content token: same value. PASS.
- `applied` = false; `authorizesNoMutation` = true. PASS.
- `source.schoolId` = 1, `source.schoolYearId` = 8; `preview.schoolId` = 1, `preview.schoolYearId` = 8. PASS.
- `preview.fingerprint` (`F78595BD...B446`) equals `source.fingerprint`; `preview.sourceRevision` (`90EC80...7E50F`) equals `source.sourceRevision`. Internally consistent. PASS.
- Plan totals `actionTotals`: RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0. Invariant RETAIN+INSERT+MOVE+UNRESOLVED = 264 = `preview.demand.length` (264) = `before.demandCount` (264); owned (R+I+M) = 264 <= 264. PASS.
- `classificationTotals`: VALID_RETAIN 264 / OUTSIDE_CURRICULUM 1. `departmentAuthority`: status CONFIGURED, `aliasRows` 0, `labelRows` 8, `revisionHash` `0B021EB2...39C39`. PASS.
- `zeroWriteProof` {preview true, writes 0}; `authorizesMutation` false; `cycleImpact` POPULATED -> POPULATED version 4. PASS.

### E. Git boundary

- `git rev-parse HEAD` = `b96b8ccddab04692b15e6770b9e462f80b3c74be` (matches required `b96b8ccd`). PASS.
- `git rev-list --left-right --count origin/main...HEAD` = `0 0` (HEAD not ahead; no merge). `git branch -r --contains HEAD` lists only `origin/main` (no push). PASS.
- Changed-scope deltas: the only tracked modification vs HEAD is a documentation-only +48-line addition to the progress ledger (the TL-C02D section, containing the deterministic method and recomputed hashes); the H advisory artifact is untracked. The verification JSON and `.sha256` sidecar are git-ignored (`docs/verification/*`) and present on disk; they were read only. No source file is modified in this corrected scope. PASS.

## Finding closure

- H-1 (material, evidence-level): CLOSED. The previously under-specified reference hashes (`CD8BA55B...`, `9132BC87...`) were replaced in the ledger by a fully deterministic canonical method plus recomputed literals. My independent reproduction from persisted data using exactly the documented method yields `80128C7620DB34ACFC212384B08752D0CF6CA5E72DC342290132E73BE9A4834A` (count 88) and `4FC60A3871DEE833CD8AE4FE3C2CAAA46F4A1BF6F4E67A1AF0AAC878C7BB3927` (count 265), matching the corrected literals exactly. The max-updatedAt immutability proof reproduced to the ledger's timestamps. The ledger method text is precise enough that an independent engineer can reproduce the exact hashes; no residual documentation ambiguity remains.
- No residual findings in the changed scope.

## Verdict

**`zeroFix: true` (GO)**

All of A-E pass. The documentation-grade finding H-1 raised by reviewer H is closed: the corrected deterministic method is reproducible and the recomputed FacultySubject and SubjectSectionOwnership invariant hashes match persisted data exactly. Advisory evidence only; authorizes no apply, merge, push, or successor unlock.
