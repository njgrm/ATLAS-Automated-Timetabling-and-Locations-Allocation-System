# SCA-03 Advisory Review 01 — Active-Year Curriculum Audit Preview (read-only)

reviewerSpawnId: NO_SPAWN_ID_EXPOSED
reviewerRole: FRESH advisory reviewer (did not implement the preview; no prior context)
date: 2026-09-07
artifactUnderReview: D:/ATLAS/docs/verification/subjects-curriculum-active-year-preview-2026-09-07.json
sidecar: D:/ATLAS/docs/verification/subjects-curriculum-active-year-preview-2026-09-07.json.sha256
ledgerSection: D:/ATLAS/docs/progress/subjects-curriculum-authority-2026-09-07-progress.md (SCA-03 section)
scope: read-only verification only. No apply authorized, no GO declared, SCA-04 stays locked.

## Method (independent recomputation, zero writes)

- Parsed the preview JSON with independent probes (python3 stdlib + node Prisma `findMany`/`count`/`aggregate`/`groupBy` only).
- DB probes ran against `localhost:5432 / atlas_recovery_clean_rebuild_20260905` (name/host confirmed from `atlas-server/.env`, read-only; secret never printed or stored).
- Read-only service fns inspected: `evaluateCurriculumReadiness`, `getCurriculumRequirements`, `suggestRequirementsFromCatalog` (`atlas-server/src/services/school-year-offering.service.ts:929,1075,1566`); router `atlas-server/src/routes/curriculum-requirements.router.ts` (full read).
- TEMP probe files lived outside the repo (`C:\Users\njgro\AppData\Local\Temp\opencode\`) and were deleted after use (both `Test-Path` False post-delete).
- No `.env` modification, no port-5001 contact, no schema/migration contact, no staging/committing.

## Item-by-item verdicts

1. Row identities — PASS. `proposedRows` = 217; `CREATE` = 216, `NONE_EXCLUDED` = 1. G10 STE = 15 rows: `STE_APPLIED_PHYS` CREATE, `STE_ROBOTICS` CREATE, `STE_RESEARCH` NONE_EXCLUDED, all three `EXPLICIT_OPERATOR_DECISION`/`HIGH`. G7/G8/G9 STE `STE_RESEARCH` rows are CREATE with `EXPLICIT_OPERATOR_DECISION` (ownerships 227/234/239).
2. Arithmetic — PARTIAL (see M1). Verified: 217 distinct `(gradeLevel, programType, subjectId)` pairs (uniqueness holds over all 217 rows); ownership-id union = 265 distinct ids (min 3, max 267, zero ids referenced twice — i.e. 217 candidate pairs derived from 265 ownership rows); per-scope counts REGULAR 12 / SPA 14 / SPS 14 / STE 14 for every grade, G10 STE 15 (sums: 54+54+54+55 = 217); 37 distinct teachers, and the row-cited faculty set is exactly equal (set-equality, not just count) to the 37 distinct `facultyId` values in `subject_section_ownerships` for school 1. Demand figure FAILED — see M1.
3. Provenance — PASS. `LEGACY_OWNERSHIP_SUGGESTION` = 211, `EXPLICIT_OPERATOR_DECISION` = 6 (G10 AP create + ROB create + Research exclude + G7/G8/G9 Research preserve). `operatorConfirmationRequired=true` on 217/217 rows. `classification=UNRESOLVED` on 217/217 rows (no invented authority).
4. Source-version binding — PASS (row-level, 217/217, zero mismatches). Every row: `subjectId` exists with matching `code` and `subjectUpdatedAt` equal to DB `subjects.updatedAt`; every cited `ownershipId` exists with matching `subjectId`; per-row `ownershipUpdatedAtMax` equals the recomputed max over its cited ownerships; every cited `facultyId` owns at least one cited ownership. Census matches `baselineSignature`/`sourceRevisions` exactly: subjects 22/22 active max `2026-09-06T15:34:50.103Z`; sections (1,8) 20 max `2026-09-06T15:34:56.303Z`; offerings 0; termConfigs 0; termAssignments 0; ownerships 265 (all `schoolYearId=8`) max `2026-09-07T00:23:47.202Z`; facultySubjects 88 max `2026-09-07T00:23:47.203Z`; runs 0; revisions 0; cohorts 0; templates 0; bindings 0; cycle id 1 state POPULATED version 4 updatedAt `2026-09-07T00:23:47.205Z`.
5. Grade 10 isolation + G7–9 preservation — PASS. Silver = mirror id 20 / externalId 102 / program STE (DB-verified, 15 ownerships incl. 244/Research, 206/Applied Physics, 250/Robotics). Research ownerships: 227→section 107, 234→113, 239→116, 244→102; sections 107=Bonifacio, 113=Makatao, 116=Rose (DB-verified). Scope inventory G10 STE legacy subjects = [1..13,17,18,19] (15, consistent).
6. No two-specialization rule — PASS. Only two case-insensitive hits for `global rule` / `specialization-count`, both explicit denials (`operatorConfigurationNote`: "never a global rule, validation limit, default policy, or generator assumption"; correction note: "no specialization-count rule encoded"). Zero hits for `exactly two` / `two special` / `at most` / `no more than` / `max_special`.
7. Rollback — PASS. `rollbackManifest` = 216 rows, all `inverseOperation=DELETE_BY_IDENTITY`, all `table=school_year_offerings`, identity-key cover exactly equals the 216 CREATE identity keys (0 missing, 0 extra). `publishedOrArchivedReferences=[]`; zero `MUTAT` tokens in the artifact; all 215 `publish/archiv` hits are the repeated `historyPreservation` note "No published/archived payload is ever mutated." No published/archived mutation proposed.
8. Canonical hash — PASS (MATCH). Recomputed SHA-256 of exact artifact bytes (PowerShell `Get-FileHash`): `6E01D1302ED5441477D68C6FD076D336A6263B28967632AC7E9B1EAD39995179` == sidecar `6e01d1302ed5441477d68c6fd076d336a6263b28967632ac7e9b1ead39995179` (case-insensitive match).
9. Zero-write evidence — PASS. Census above used SELECT/COUNT/AGGREGATE only (node Prisma reads; no create/update/delete/upsert in any probe). Counts `22/20/0/0/265/88/0/0/POPULATED-v4` and all maxima match `baselineSignature`.
10. ATLAS-only boundary — PASS with one informational note (I1). `git status --porcelain` shows exactly one tracked modification: the SCA-03 progress ledger itself (+114/−5, the expected executor record — no source/schema/env changes). `git diff --name-only` for `.env`/`atlas-server/.env`/`prisma/schema.prisma` is empty. `git check-ignore` confirms the preview JSON and this review path are gitignored docs evidence. `Select-String` for `fetch\(|axios|EnrollPro|integration/v1` in the two files under review finds only comments/notes ("never calls EnrollPro", "Section identity is EnrollPro-mirrored; ATLAS only checks membership") — no EnrollPro offering endpoint is referenced or called.

## Material defects (must-fix)

### M1 — Projected demand figure is irreproducible and ledger/artifact disagree

- Recomputed from the artifact's own rows: every one of the 217 rows carries `weeklyMinutes=225`, so 216 CREATE rows sum to **48,600** min/week.
- The artifact's `downstreamImpact.projectedIfApproved.projectedCandidateDemandMinutesPerWeek` = **59,400**.
- The ledger's SCA-03 section claims **59,625** min/week.
- Three values, no derivation formula stated anywhere in the artifact (full-text search for `demand` shows no definition; `59,400` appears exactly once with no formula).
- Observed arithmetic coincidences for the executor to confirm or refute: 265 ownerships × 225 = 59,625 (ledger value — counts the operator-excluded Silver Research ownership 244 as demand); (265−1) × 225 = 59,400 (artifact value — consistent with excluding ownership 244, but this rule is unstated and still conflates ownership-row demand with candidate-row demand, 216 × 225 = 48,600).
- Required fix: state the exact derivation set and formula for `projectedCandidateDemandMinutesPerWeek` (ownership-row basis vs candidate-row basis, treatment of the excluded row), correct the value and/or the ledger so the two agree, re-fingerprint the artifact, and recompute the `.sha256` sidecar from final bytes. Then request a changed-scope re-review of the corrected fields.

## Informational (not defects)

- I1: The single tracked-file modification (`docs/progress/...-progress.md`) is the executor's own SCA-03 ledger record — expected and authorized; it is not a source mutation. Literal "zero tracked changes" therefore does not hold, but the boundary intent holds.
- I2: `LIVE_RUNTIME_STALE` (port-5001 404 claim, 2 textual refs) was not independently re-probed; it is orthogonal to preview integrity and the NO-GO verdict stands regardless.
- I3: Uniform `subjectUpdatedAt` (`2026-09-06T15:34:50.103Z`) across all rows is explained by batch seeding and verified against the DB maximum — not a defect.
- I4: `applicability.verdict=NO-GO` with `authorizesNoMutation=true` is correctly bound; nothing in the preview authorizes a write.

## Verdict

zeroFix: false — one material defect (M1) requires executor correction and a changed-scope re-review. No apply authorized, no formal GO declared, SCA-04 remains locked.
