# SCA-03 Advisory Review 02 — M1 changed-scope re-review (read-only)

reviewerSpawnId: NO_SPAWN_ID_EXPOSED
reviewerRole: FRESH advisory reviewer (did not implement the preview; not the review-01 author; no prior context)
date: 2026-09-07
artifactUnderReview: D:/ATLAS/docs/verification/subjects-curriculum-active-year-preview-2026-09-07.json
sidecar: D:/ATLAS/docs/verification/subjects-curriculum-active-year-preview-2026-09-07.json.sha256
ledgerSection: D:/ATLAS/docs/progress/subjects-curriculum-authority-2026-09-07-progress.md (SCA-03 section)
priorReview: D:/ATLAS/docs/reviews/subjects-curriculum-authority-2026-09-07/sca-03-advisory-review-01.md (M1)
scope: STRICTLY the M1 fix and its integration boundary. No apply authorized, no formal GO declared, SCA-04 stays locked.

## M1 background

Review 01 found `projectedCandidateDemandMinutesPerWeek` irreproducible: artifact rows summed to
48,600 (216x225), artifact claimed 59,400, ledger claimed 59,625, no derivation stated.
Executor fix claims: (1) added `projectedDemandDerivation` under
`downstreamImpact.projectedIfApproved`; (2) corrected the ledger to 59,400; (3) re-fingerprinted.

## Method (independent recomputation, zero writes)

- Parsed the artifact with stdlib probes (python3) and one TEMP node probe outside the repo
  (`C:\Users\njgro\AppData\Local\Temp\opencode\sca03-review02-probe.mjs`, Prisma
  `findMany`/`count`/`aggregate` reads only, `DATABASE_URL` loaded via `--env-file`, never printed).
- DB target school 1 / year 8. TEMP probe deleted after use (`Test-Path` False post-delete).
- No `.env`/schema/migration contact, no port-5001 contact at all, no staging/committing.
- Zero-write snapshot (counts + max `updatedAt`) taken before and after inside the same probe run.

## Check 1 — Demand recomputed BOTH ways from the live DB: PASS, both equal 59,400

- (b) Ownership-row basis: 265 ownerships for school 1 / year 8; excluding id 244
  (Silver Research, subjectId 19, sectionId 102), the remaining **264 rows sum to 59,400**
  (`B_SUM_EXCL244=59400`, `B_N=264`, zero unresolvable subjects). 264 x 225 exactly.
- (a) CREATE-pair basis: for each of the **216 CREATE rows**, catalog `minMinutesPerWeek`
  (DB `subjects`, school 1) x active-section count of the row scope (grade from
  `SectionMirror.gradeLevelName`, program from `SectionMirror.programType`; all 20 sections
  active/non-stale; REGULAR x2 per grade, STE/SPA/SPS x1). **Sum = 59,400** (`A_SUM=59400`,
  zero unmatched scopes). Section-incidences total 264 (G10 STE contributes 14 CREATE rows
  x1 because its 15th row is the NONE_EXCLUDED Research row).
- Density cross-check: all 264 non-excluded ownerships fall inside CREATE pairs
  (`INSIDE=264 OUTSIDE=0`); id 244 resolves to scope `10|STE|19`, which is NOT in the CREATE
  set (`inCreateSet=false`). The excluded pair contributes 0, as stated.
- Derivation-text fidelity: the artifact's `projectedDemandDerivation` states exactly these
  two computations ("sum over the 216 CREATE candidate rows of (catalog weeklyMinutes x
  active-section count of the row scope)" + "264 annual ownership rows ... 265 total minus
  excluded Silver Research id 244 ... identical 59400"). Every element reproduces.
- Notes: (i) all 216 CREATE rows carry 225 in both artifact and catalog
  (`CATALOG_VS_ARTIFACT_MISMATCH=0`), so review 01's naive 216x225=48,600 was the
  per-row sum without the scope-section multiplier the derivation now states; (ii) one of
  the 22 catalog subjects carries 60 min but touches neither sum (no CREATE row, no in-scope
  ownership — consistent with the ledger's HG x0); (iii) including id 244 yields 59,625
  (`B_PLUS_244=59625`), which arithmetically explains the old ledger value.

## Check 2 — Ledger agreement: PASS

- Ledger current claims are 59,400 in all three places (SCA-03 downstream-impact line,
  task-log SCA-03.5 line, fingerprint context) and fingerprint `e61405f0…`.
- The string `59,625` occurs exactly once, inside the historical fix annotation
  ("ledger 59,625→59,400 ... re-fingerprinted e61405f0"), not as a current value.
  No active 59,625 claim remains; ledger and artifact agree at 59,400.

## Check 3 — Canonical hash: PASS (MATCH)

- Recomputed SHA-256 of exact artifact bytes (PowerShell `Get-FileHash`):
  `E61405F05E7614F494D74EA6D1677A12B0BA8E0ECA2AD0A48EAD611B84BF74C4`
  == sidecar `e61405f05e7614f494d74ea6d1677a12b0ba8e0eca2ad0a48ead611b84bf74c4`
  (case-insensitive MATCH). Ledger pin `e61405f0…` agrees.

## Check 4 — Changed-scope semantic stability (spot-check): PASS

- Row count still 217 (216 CREATE + 1 NONE_EXCLUDED); rollback still 216 rows, all
  `DELETE_BY_IDENTITY` on `school_year_offerings`; zero `MUTAT` tokens in the artifact.
- `applicability`: `applicable=false`, `verdict=NO-GO`, unchanged condition.
- Demand fields: `projectedCandidateDemandMinutesPerWeek=59400`,
  `ownershipRowsIntersectingScopes=265`, `requirementRowsCreated=216`.
- G10 isolation intact: G10 STE = 15 rows; AP CREATE [ownership 206], ROBOTICS CREATE
  [ownership 250], RESEARCH NONE_EXCLUDED [ownership 244]; all three
  `EXPLICIT_OPERATOR_DECISION`/`HIGH`. DB confirms id 244 = subject 19 / section 102.

## Check 5 — Zero-write and ATLAS-only boundary: PASS

- Before/after snapshots identical (`zeroWrite=true`): subjects 22, sections 20,
  ownerships 265, facultySubjects 88; maxima `2026-09-06T15:34:50.103Z` /
  `2026-09-06T15:34:56.303Z` / `2026-09-07T00:23:47.202Z` / `2026-09-07T00:23:47.203Z`,
  matching the artifact's `baselineSignature`.
- `git status --porcelain` shows exactly one tracked modification: the SCA-03 progress
  ledger itself (the expected executor record; same informational note as review 01 I1).
  `git diff --name-only` lists only the ledger — no `.env`/schema/source changes.
- `git check-ignore` confirms the preview JSON and this review path are gitignored docs
  evidence. No port-5001 contact was made (not even a GET); TEMP probe deleted.

## Verdict

zeroFix: true — the M1 fix is exact (derivation stated, both bases independently recompute
to 59,400, ledger corrected, fingerprint matches) and no new material defect exists in the
reviewed scope. No apply authorized, no formal GO declared, SCA-04 remains locked.
