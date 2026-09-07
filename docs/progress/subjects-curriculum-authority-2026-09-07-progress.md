# Subjects/Curriculum Authority — Progress Ledger (2026-09-07)

Plan: `docs/prompts/subjects-curriculum-authority-00-sequence-2026-09-07.md`
Planner manifest: `docs/verification/subjects-curriculum-authority-planner-manifest-2026-09-07.json`
Manifest SHA-256 (pinned): `70FEEBDA93C5BCEBCD3C28347CF1B798FC781C583681423160E478A091574B5C`
Active prompt: SCA-02 (`docs/prompts/subjects-curriculum-authority-02-atlas-requirements-2026-09-07.md`)
SCA-02 SHA-256 (pinned): `CD3246915B3181D8BAEE77414857BDD6D746472580D82364FD5E45C05D2EE056`
Sequence SHA-256 (observed, matches manifest SCA-00 pin): `1C0D33E938DCDF70F043E9CB9741B7443924C7FC297B67E981B8277A8987871A`

Current phase: SCA-03 IN_PROGRESS (executor preview complete, advisory review pending).
SCA-01R4 state: planner/QA GO (formal acceptance recorded 2026-09-07):
ordinary creates persist isSeedable=false and isSystemManaged=false;
explicit protected metadata is rejected on POST/PATCH;
controlled bootstrap/materialization retains its authority;
catalog-truth 106/106 and payload 7/7 independently reproduced;
reviewer provenance ses_f84d6aaf3ffeEqdF1KNN8ZoyPI validated.
SCA-02R2 state: focused commit a942f85f contains all six authorized files
(service fix + 3 tests + ledger + advisory review); preflight GO per handoff gate.
SCA-03 preview: NO-GO audit snapshot (SUPERSEDED_NON_APPLICABLE_AUDIT);
fingerprint 8865a3c4…59496 (see SCA-03/SCA-03R sections; supersedes
665994e4…/e61405f0… after SCA-03R authority correction + 6 classifications).

## Preflight (SCA-01.0)

- Hash verification (2026-09-07, executor): manifest recomputed `70FEEBDA…5C` == pinned GO;
  SCA-01 recomputed `20AF13B9…5CB` == pinned GO; sequence recomputed `1C0D33E9…71A` ==
  manifest SCA-00 pin GO.
- Startup reads: AGENTS.md (system prompt), ATLAS_AGENT_KI.md, phasePlan.md,
  `docs/reference/atlas-runtime-source-of-truth-map.md`, sequence file, SCA-01 prompt file. DONE.
- Git state before edits (must preserve; executor makes no stash/commit/reset):
  - Modified (other streams): `atlas-server/package.json`, `atlas-server/src/middleware/errorHandler.ts`,
    `atlas-server/src/routes/map.router.ts`, `atlas-server/src/scripts/seed-realistic.ts`,
    `atlas-server/src/scripts/verify-execution-gate.ts`,
    `atlas-server/src/services/faculty-assignment.service.ts` (TL-06R3C — DO NOT TOUCH),
    `atlas-server/src/services/local-auth.service.ts`, `atlas-server/src/services/map.service.ts`,
    `docs/reference/atlas-runtime-source-of-truth-map.md`.
  - Renamed (staged, recovery stream): `prisma/migrations/*` ->
    `prisma/migrations.superseded-2026-09-05/*`; new `prisma/migrations/` dir.
  - Untracked: `atlas-server/backup-operations.example.json`, `atlas-server/src/scripts/atlas-backup.ts`,
    `atlas-backup.ts`, `atlas-migrate.ts`, `atlas-restore-drill.ts`, `reconstruct-disposable-baseline.ts`,
    `atlas-server/src/services/database-backup.service.ts`, `database-recovery-evidence-gate.ts`,
    `disposable-campus-fixture.service.ts`, `disposable-reconstruction-guard.service.ts`.
- DB preflight (read-only, no secrets): tests resolve `DATABASE_URL` host `localhost:5432`,
  database `atlas_recovery_clean_rebuild_20260905` (active candidate DB). No schema commands
  in this prompt. Focused tests use disposable schools 99991–99994 with exact cleanup; school 1,
  runs, ownerships, publication state are never touched.
- External repos `D:/EnrollPro`, `D:/AIMS`, `D:/smart-final-capstone`: READ_ONLY, untouched.

## TODO

- [x] SCA-01.0 preflight + ownership map
- [x] SCA-01.1 multi-school read correctness + negative test
- [x] SCA-01.2 honest catalog semantics
- [x] SCA-01.3 typed validation + scope truth
- [x] SCA-01.4 retire upstream-offering sync UI
- [x] SCA-01.5 focused verification (final: catalog-truth 59/59 post-O4)
- [x] Advisory review (fresh context) — DONE (review 01 zeroFix:false → F1 fixed → review 02 zeroFix:true)
- [x] SCA-01R2 operator seed classification + fresh advisory review (zeroFix:true) — DONE, REVIEW_REQUIRED
- [x] SCA-01R3 bootstrap-metadata authority + fresh advisory review (zeroFix:true) — DONE, REVIEW_REQUIRED
- [x] SCA-01R4 no-implicit-managed-classification + fresh advisory review (zeroFix:true) — DONE, planner/QA GO 2026-09-07
- [x] SCA-02.0 schema adequacy checkpoint — DONE (adequate, no migration)
- [x] SCA-02.1 production service and routes — DONE
- [x] SCA-02.2 operator workflow (Curriculum Requirements surface) — DONE
- [x] SCA-02.3 readiness and preview semantics — DONE
- [x] SCA-02.4 focused tests — DONE (executor gates green)
- [x] M1 fix (reviewer finding) + changed-scope re-review — DONE, zeroFix:true
- [x] SCA-02R integrity correction (7 fixes + 13 controls) + fresh advisory review — DONE, zeroFix:true
- [x] SCA-02R2 atomic requirement creation + durable evidence packaging — DONE (executor), REVIEW_REQUIRED
  - [x] deterministic $transaction-entry-barrier concurrency test (C1–C7)
  - [x] pre-fix failing-first proof recorded (both succeed + 2 active rows)
  - [x] createRequirement Serializable in-tx discovery + typed 409 mapping
  - [x] focused matrix green (truth 68/68, concurrency 27/27, scope-states 25/25, http 24/24, catalog 106/106, tsc/builds, diff-check, built-server health+route)
  - [x] authoritative tests + evidence force-added (tracked) with ls-files/show proof
 - [ ] Advisory review (fresh context) — PENDING; SCA-02 stays REVIEW_REQUIRED, SCA-03 locked
 - [ ] Planner QA — PENDING; SCA-02 stays REVIEW_REQUIRED until planner QA
   (SCA-03 locked regardless)

## SCA-03 active-year audit and fingerprinted preview (2026-09-07, executor)

Predecessor gate: `git show --name-only a942f85f` lists exactly the six
authorized files (service fix, concurrency/truth/scope-states tests, this
ledger, sca-02r2 advisory review); `git show --check` clean; worktree clean
before and after. No SCA-02 matrix rerun per handoff.

Resolved authority (dynamic, nothing hardcoded): actor school 1 (officer
login); active year 8 / 2029-2030 (runtime context, drift `aligned`,
atlas-persisted, upstream unreachable at probe time); database target
`atlas_recovery_clean_rebuild_20260905` (name only, no credentials).
Fresh-state drift vs history: sections 20 (not 82 — year 8 is the active
year, not the historical year-55 surface); offerings 0; term configs 0;
templates/bindings 0; cohorts 0; runs 0; revisions 0; ownerships 265 annual
rows and POPULATED cycle v4 (unchanged truth).

Baseline (read-only census, SELECT/COUNT only): subjects 22/22 active;
sections 20 (all scheduling-active, non-stale: G7/G8/G9/G10 x
REGULAR+STE+SPA+SPS, G10 REGULAR x2); cohorts 0; termConfigs 0; offerings
0/0; termAssignments 0; FacultySubject 88 annual; ownerships 265 annual;
templates 0; bindings 0; runs 0; revisions 0; cycle POPULATED v4.
Silver = mirror id 20 / externalId 102; Research id 19 (`STE_RESEARCH`);
Applied Physics id 17; Robotics id 18. Silver ownerships (15): includes
244/Research (faculty 36), 206/Applied Physics (faculty 3), 250/Robotics
(faculty 38). Research also owned in Bonifacio-107 (G7 STE), Makatao-113
(G8 STE), Rose-116 (G9 STE). Grade-specific STE sciences owned exactly in
their grade's STE section (14->107, 15->113, 116->Applied Chem 16).
SPA_SPEC x4, SPS_SPEC x4, DEVL_READING x8, HG x0.

Readiness (production service, read-only): `evaluateCurriculumReadiness`
-> ready false, termConfigPresent false, 0 requirements, 16 MISSING scopes
(G7-G10 x REGULAR/STE/SPA/SPS), single blocker OFFERING_TERM_CONFIG_MISSING.
Snapshot: termConfig null, 0 requirements. Suggestions: 233
catalog-compatibility-unapproved rows, approved false (never authoritative).

Scope inventory: 16 base scopes, all MISSING; overrides none (no cohorts,
no section-scoped rows). Legacy ownership per scope recorded (12-15
subjects/scope); template evidence NONE everywhere.

Proposed manifest: 217 candidate entries (216 CREATE + 1 NONE_EXCLUDED).
Provenance: 6 EXPLICIT_OPERATOR_DECISION (G10 Silver AP+ROB create,
Silver Research exclude, G7/G8/G9 STE Research preserve),
211 LEGACY_OWNERSHIP_SUGGESTION. All rows termMode ALL (only
config-independent mode), weeklyMinutes from catalog suggestion,
classification UNRESOLVED, operatorConfirmationRequired true on every row.
No fixed specialization-count policy anywhere (verified by scan).

G10 correction preview: CREATE AP + CREATE ROB for Silver; Research
excluded from Silver (no persisted row exists, so no retirement proposed);
G7-9 Research preserved; no grade-applicability edits; ownership ids
244/206/250 recorded as later-Teaching-Load-repair material only.

Downstream impact: pinned apply 0/0/0/0 (nothing applicable now);
projected-if-approved creates 216, retires 0, term rows 0/0,
FacultySubject created by apply 0, 265 ownership rows intersecting, Silver
Research ownership 244 flagged for later repair, teacher assignment/minute
changes 0, projected demand 59,400 min/week across 37 teachers (derivation:
sum over 216 CREATE rows of catalog weeklyMinutes x scope section count;
cross-checked against 264 in-scope ownership rows = identical 59,400), templates
0, unpublished runs 0, published/archived impact NONE (no proposed
mutation). Teaching Load/generation readiness stay SCA-04-gated.

Rollback: 216 DELETE_BY_IDENTITY rows (one per CREATE); term assignments
none; published/archived never mutated.

Fingerprint: `docs/verification/subjects-curriculum-active-year-preview-2026-09-07.json`
+ `.sha256` sidecar. SHA-256
`e61405f05e7614f494d74ea6d1677a12b0ba8e0eca2ad0a48ead611b84bf74c4`
(recomputed from exact artifact bytes + certutil cross-check; one
environment format-on-write pass expanded layout after the first hash, so
the sidecar was recomputed from final bytes and matches).
SUPERSEDED by SCA-03R: e61405f0… is now marked
SUPERSEDED_NON_APPLICABLE_AUDIT inside the artifact; the current audit hash
is 665994e4… (SCA-03R section). Neither hash authorizes any apply.
`authorizesNoMutation: true`. Supersedes 1B03EB83…/76997884…/8D5927EA…
(historical). Single future apply scope pinned (active-year remediation
only, after term config + approval + redeploy).
Blockers: TERM_CONFIG_MISSING (HARD), OPERATOR_CONFIRMATION_PENDING
(HARD), CLASSIFICATION_UNDECIDED (HARD), LIVE_RUNTIME_STALE (HARD:
port-5001 returns 404 for curriculum endpoints — SCA-02 routes not yet
deployed; no restart performed). Applicability false, verdict NO-GO.

### TODO (SCA-03 — separate entries, not collapsed)

- [x] SCA-03.0 preflight (commit inventory 6/6 + check clean) — DONE
- [x] SCA-03.1 baseline census (13 tables + focus identities) — DONE
- [x] SCA-03.2 scope inventory (16 MISSING scopes) — DONE
- [x] SCA-03.3 proposed manifest (217 rows, provenance-bound) — DONE
- [x] SCA-03.4 G10 Silver correction preview — DONE
- [x] SCA-03.5 downstream impact (pinned 0s + projections) — DONE
- [x] SCA-03.6 rollback manifest (216 rows) — DONE
- [x] SCA-03.7 fingerprint package + sidecar — DONE
- [x] SCA-03.8 focused verification (13 checks; zero-write proven) — DONE
- [x] SCA-03.9 advisory review (fresh contexts; identity reconciled per SCA-03R) — DONE
  - Review 01 (reviewerSpawnId: NO_SPAWN_ID_EXPOSED in artifact;
    reviewer identity status: REVIEW_IDENTITY_UNAVAILABLE — the
    executor-recorded task labels previously cited here are RETRACTED as
    identity evidence; no spawn ID was captured from a spawn envelope or
    repeated verbatim in the artifact, so the review does NOT satisfy
    authenticated independent-review identity; its technical findings are
    retained as advisory evidence only):
    verdict zeroFix:false, one material M1 (demand-derivation
    irreproducible: rows sum 48,600 vs artifact 59,400 vs ledger 59,625,
    no formula stated). All other areas PASS (identities, provenance,
    binding, isolation, no two-rule, rollback 216/216, hash match,
    zero-write, boundary).
  - M1 fix (executor, same session): added `projectedDemandDerivation`
    to the artifact (CREATE-row minutes x scope-section-count = 59,400;
    cross-check 264 in-scope ownership rows = identical 59,400; old
    59,625 explained as inclusion of excluded Silver Research);
    ledger corrected to 59,400; sidecar recomputed from final bytes:
    e61405f0…f74c4.
  - Changed-scope re-review 02 (reviewerSpawnId: NO_SPAWN_ID_EXPOSED in
    artifact; identity status likewise REVIEW_IDENTITY_UNAVAILABLE,
    findings advisory-only):
    verdict zeroFix:true — demand recomputed both ways = 59,400,
    ledger/artifact agree, hash MATCH, stability + zero-write + boundary
    confirmed. Advisory loop closed; no further passes.
  - SCA-03 stays NO-GO (non-applicable) until term config + operator
    approval + redeploy; SCA-04 locked.
- [ ] Planner/operator decision (term config + approval) — PENDING; SCA-04 locked

### Task log (SCA-03)

| Task | Risk | Status | Files | Evidence | Review |
|---|---|---|---|---|---|
| SCA-03.0 preflight | LOW | DONE | this ledger | a942f85f 6/6 files; check clean | prompt-boundary batch |
| SCA-03.1 baseline | MEDIUM | DONE | census (TEMP, deleted) | 22/20/0/0/0/88/265/0/0/POPULATED-v4 | prompt-boundary batch |
| SCA-03.2 scopes | MEDIUM | DONE | preview artifact | 16 MISSING scopes | prompt-boundary batch |
| SCA-03.3 manifest | MEDIUM | DONE | preview artifact | 217 rows, 6 operator + 211 suggestion | prompt-boundary batch |
| SCA-03.4 G10 fix | MEDIUM | DONE | preview artifact | AP+ROB create, Research excluded, G7-9 kept | prompt-boundary batch |
| SCA-03.5 impact | MEDIUM | DONE | preview artifact | pinned 0s; projected 216 creates, 59,400 min | prompt-boundary batch |
| SCA-03.6 rollback | MEDIUM | DONE | preview artifact | 216 DELETE_BY_IDENTITY rows | prompt-boundary batch |
| SCA-03.7 fingerprint | MEDIUM | DONE | preview JSON + .sha256 | 8865a3c4…59496 (audit-snapshot, non-applicable), match proven | prompt-boundary batch |
| SCA-03.8 verification | MEDIUM | DONE | TEMP scripts (deleted) | 13/13 checks incl. zero-write + hash match | prompt-boundary batch |
| SCA-03.9 advisory | MEDIUM | DONE | 2 review artifacts | R01 zeroFix:false (M1) → fixed → R02 zeroFix:true | advisory-only (identity REVIEW_BLOCKED) |

## SCA-03R authority correction + operator decision package (2026-09-08, executor)

Authority model (Task 1): the SCA-03 preview artifact now states
`snapshotKind: AUDIT_SNAPSHOT_ONLY` and
`auditFingerprintStatus: SUPERSEDED_NON_APPLICABLE_AUDIT`. It authorizes no
mutation now or later; any source revision (terms, confirmations,
classifications, redeploy) invalidates it for apply. `futureApplyScope`
removed; replaced by `applyScopeNote` (explicitly non-authorizing). No
approval sentence exists for any hash in the artifact, ledger, or report.

Classifications (Task 2, operator-decided only): G10 Silver Applied Physics
+ Robotics = SPECIALIZATION; Silver Research exclusion = SPECIALIZATION
context (row stays NONE_EXCLUDED); G7/G8/G9 STE Research preserves =
SPECIALIZATION. Before: resolved 0 / unresolved 217. After: resolved 6 /
unresolved 211; explicitly decided rows 6; suggestion-only rows 211. No
inference for remaining suggestions.

Decision worksheet (Task 3):
`docs/verification/subjects-curriculum-operator-decisions-2026-09-08.json`
(+ `.sha256`): 211 single-row groups keyed by subject/grade/program (names
resolved read-only from catalog), each with sections, row identity,
ownership evidence (SUGGESTION_ONLY), null unapproved classification,
confirm-or-reject proposal (UNAPPROVED), termMode ALL (UNAPPROVED),
unresolved fields, accept/reject impacts; plus one UNDECIDED term-config
decision (no assumed count; SCIENCE/TLE_ROTATION recorded as catalog
observations only).

Next-action sequence (Task 4): recorded verbatim in the artifact
(`nextActionSequence` steps 1–7: authorized deploy → term selection →
candidate confirmation → fresh post-decision preview → new fingerprint →
approval request → SCA-04 only after approval). Prior hash e61405f0…
marked SUPERSEDED_NON_APPLICABLE_AUDIT; new audit hash below.

Identity reconciliation (Task 5): executor-recorded `ses_…` task labels for
SCA-03 reviews are RETRACTED as identity evidence (no spawn-envelope
capture, no verbatim repeat in artifacts). Status:
REVIEW_IDENTITY_UNAVAILABLE. No authenticated independent-review identity
is claimed; R01/R02 technical findings retained as advisory evidence only.
No new review spawned (a new review counts only with valid captured
identity) → the review-identity process item is REVIEW_BLOCKED.

Packaging (Task 6): force-added exactly the 7 authorized evidence paths
(preview JSON + sidecar, worksheet + sidecar, 2 review artifacts, this
ledger); `.gitignore` untouched; staged inventory contains no product
source. Current audit hash 8865a3c4…59496; worksheet hash
e4b638d7…8278 (both sidecar-matched, certutil cross-checked).
Proofs: all 7 paths in `git ls-files`; staged blobs byte-identical to
reviewed disk bytes (7/7 SAME); `git diff --cached --name-only` lists only
the 7 paths; `git diff --check` and `git diff --cached --check` pass.

### TODO (SCA-03R)

- [x] SCA-03R.1 authority correction (snapshot-only, scope renamed, no approval sentence) — DONE
- [x] SCA-03R.2 classifications (6 resolved / 211 unresolved, recount proven) — DONE
- [x] SCA-03R.3 worksheet (211 groups + term decision, unapproved) — DONE
- [x] SCA-03R.4 next-action sequence (steps 1–7 in artifact + report) — DONE
- [x] SCA-03R.5 identity reconciliation (retraction recorded) — DONE
- [x] SCA-03R.6 durable packaging (7 paths force-added, proofs below) — DONE
- [x] SCA-03R.7 verification (parse, hash, arithmetic, census, git checks) — DONE

## SCA-01.0 — Ownership map (Subjects page reads/mutations → production route/service)

| Page operation | Production path | School scope |
|---|---|---|
| Catalog list read | `GET /api/v1/subjects?schoolId=` → `subject.service.getSubjectsBySchool` | Query param; page currently falls back to school 1 (DEFECT → SCA-01.1) |
| Coverage summary | `fetchSubjectCoverageSummary(schoolYearId)` | Year-scoped (unchanged) |
| Teacher coverage drawer | `GET /api/v1/faculty-assignments/summary?schoolId=&schoolYearId=` | Same fallback defect (same fix) |
| Create | `POST /api/v1/subjects` → `createSubject(actorSchoolId, …)` | Actor-derived; body schoolId silently ignored (DEFECT → SCA-01.3 rejects conflict) |
| Edit | `PATCH /api/v1/subjects/:id` → `updateSubjectAtomic` (allowlist + version in WHERE) | Actor-scoped, version-guarded (preserve) |
| Archive/reactivate | `POST /api/v1/subjects/:id/archive\|reactivate` → `transitionSubjectActiveStateAtomic` | Actor-scoped, version-guarded, no-op conflict (preserve) |
| Delete | `POST …/delete-preview` → `…/delete-apply` (fingerprint, Serializable) | Actor-scoped (preserve); ordinary DELETE blocked (preserve) |
| Seed bootstrap | `POST /api/v1/subjects/seed` → `ensureDefaultSubjects` (create-missing-only) | Actor-scoped, cross-school body rejected (preserve) |
| Sync preview/apply | `POST /api/v1/subjects/sync-offerings/{preview,apply}` | Apply permanently blocked (`offeringModelAvailable=false` → 409) or degraded-source 409 (RETIRE UI → SCA-01.4) |

Field classification:
- Catalog metadata (ATLAS-owned, operator-editable): code, name, outputLabel, minMinutesPerWeek,
  preferredRoomType, gradeLevels, programScopes, ownerDepartment, allowedOwnerDepartments,
  qualificationPriority, requiredFeatures, interSectionEnabled/GradeLevels, isActive (lifecycle).
- Bootstrap metadata (create-only seed hints; NOT demand, NOT timetable inclusion): isSeedable,
  isSystemManaged, MATATAG_DEFAULTS rows, modular/term contract defaults.
- Future current-year curriculum data (SCA-02, NOT this prompt): required-subjects-per-year,
  term/rotation applicability, Curriculum Requirements workflow.

## Task log

| Task | Risk | Status | Files | Evidence | Review |
|---|---|---|---|---|---|
| Preflight + map | LOW | DONE | this ledger | hashes match pins; git state recorded | prompt-boundary batch |
| SCA-01.1 | MEDIUM | DONE | `atlas-client/src/lib/subject-school-scope.ts` (new), `atlas-client/src/lib/__tests__/subject-school-scope.test.ts` (new), `atlas-client/src/pages/Subjects.tsx` | scope test 3/3; no school-1 request while unresolved; effect deps on actor school | prompt-boundary batch |
| SCA-01.2 | MEDIUM | DONE | `SubjectFormModal.tsx`, `subject-constants.ts`, `SortableHeader.tsx`, `Subjects.tsx`, `SubjectMobileList.tsx`, `subject-source-utils.ts`, `subject.service.ts` (ordering) | client tsc clean; build pass; grep shows no page-level timetable/offering claims | prompt-boundary batch |
| SCA-01.3 | MEDIUM | DONE | `subject.service.ts`, `subject.router.ts`, `subject-catalog-truth.test.ts` (new) | catalog-truth 51/51 incl. negative controls | prompt-boundary batch |
| SCA-01.4 | MEDIUM | DONE | `Subjects.tsx`, `SubjectStatusBanners.tsx`, `SyncPreviewSheet.tsx` (retired notice) | refresh action uninvokable; routes stay fail-closed (http test 24/24) | prompt-boundary batch |
| SCA-01.5 | MEDIUM | DONE | — | catalog-truth 51/51, http-integration 24/24, atomicity 17/17, crud-authority 19/19, client scope 3/3, server+client builds pass, `git diff --check` pass | prompt-boundary batch |

## SCA-01.5 evidence (2026-09-07, executor)

- `npx tsx --test src/lib/__tests__/subject-school-scope.test.ts` (atlas-client): 3 pass / 0 fail, exit 0.
- `npx tsx src/__tests__/subject-catalog-truth.test.ts` (atlas-server, disposable school 99994,
  exact cleanup, zero residue proven): 51 pass / 0 fail, exit 0.
- `npx tsx --env-file=.env src/__tests__/subject-http-integration.test.ts`: 24/24, exit 0.
- `npx tsx --env-file=.env src/__tests__/subjects-atomicity.test.ts`: 17/17, exit 0.
- `npx tsx --env-file=.env src/__tests__/subjects-crud-source-authority.test.ts`: 19/19, exit 0.
- `npx tsc --noEmit` (atlas-client): clean. `npm run build` (atlas-client): pass (23.8s).
  `npm run build` (atlas-server, tsc): pass after two executor self-found fixes
  (name-collision `invalid` const; `preview.preview.summary.deletable` path).
- `git diff --check`: clean (no whitespace errors).
- Negative controls: stale version → STALE_WRITE; cross-school actor → CROSS_SCHOOL_DENIED;
  conflicting body schoolId → 403 CROSS_SCHOOL_DENIED with zero writes; forged delete
  fingerprint rejected; passive GET + double bootstrap updated zero of 24 rows; operator
  grade edit survives bootstrap; non-seedable AAA row sorts before seedable rows.
- Untouched proof: executor changed-file set contains no TL-06R3C file
  (`faculty-assignment.service.ts` diff is pre-existing other-stream work, 183+/2-, never opened
  by this executor), no generation/Teaching Load/policy services, no Prisma schema/migrations,
  no recovery/backup/auth/campus/`.env` files, no external-repo writes, no port-5001 restart
  (ephemeral test ports 5996/5999 only, closed after run), no stage/commit/stash/reset.
- Note: `**/__tests__/` and `docs/` are repo-gitignored (`.gitignore:65`, `.gitignore:25`), so the
  two new test files and this ledger exist on disk and run but do not appear in `git status`;
  this matches existing convention (all `__tests__` files are gitignored paths).

## Exact changed files (executor, SCA-01 only)

Modified:
- `atlas-server/src/services/subject.service.ts` (+validation parity, name ordering)
- `atlas-server/src/routes/subject.router.ts` (+body schoolId conflict rejection on create)
- `atlas-client/src/pages/Subjects.tsx` (actor-scope gate, honest copy, retired sync UI)
- `atlas-client/src/components/subjects/SubjectFormModal.tsx` (isSeedable switch removed)
- `atlas-client/src/lib/subject-constants.ts` (bootstrap-only comment)
- `atlas-client/src/components/subjects/SortableHeader.tsx` (isSeedable sort removed)
- `atlas-client/src/components/subjects/SubjectMobileList.tsx` (empty-state copy)
- `atlas-client/src/components/subjects/SubjectStatusBanners.tsx` (sync props removed)
- `atlas-client/src/components/subjects/SyncPreviewSheet.tsx` (retired notice only)
- `atlas-client/src/components/subjects/subject-source-utils.ts` (catalog copy)
- `docs/reference/atlas-runtime-source-of-truth-map.md` (Subjects row + catalog ownership row)
Created:
- `atlas-client/src/lib/subject-school-scope.ts`
- `atlas-client/src/lib/__tests__/subject-school-scope.test.ts` (gitignored path)
- `atlas-server/src/__tests__/subject-catalog-truth.test.ts` (gitignored path)
- this ledger (gitignored path)

## Decisions

- Disposable-school focused tests (99991–99994, exact cleanup) are the SCA-01.5 evidence path;
  school 1 / live curriculum / runs / publication are never written.
- `faculty-assignment.service.ts` and all other TL-06R3C files are out of bounds even though the
  coverage drawer reads `/faculty-assignments/summary` (read-only consumer, unchanged).
- No schema/migration, recovery, auth, campus, `.env`, or port-5001 changes in this prompt.

## Risks

- `resolveActorSchoolId()` caches once per session; a mid-session school change does not re-resolve.
  SCA-01.1 makes page fetch respond to `actorSchoolId` state changes; cache-busting is residual.
- `getSubjectsBySchool` ordering change (drop `isSeedable` priority) could surprise operators used to
  seed-first lists; mitigated by honest name ordering + coverage column.
- Sync-preview/apply routes stay (blocked, fail-closed) while only the operator UI action is retired;
  SCA-02 owns the Curriculum Requirements replacement.

## SCA-01R correction (2026-09-07, executor — narrow, SCA-02 still locked)

Findings corrected (no other behavior touched):
1. PATCH `termCount:null` → 400 INVALID_TERM_METADATA (`validateAndFilterPatchFields`;
   `Subject.termCount` is `Int` non-null per `prisma/schema.prisma:212`, so null must
   never reach Prisma). Create-side `null → default 3` is unchanged and safe.
2. PATCH `programScopes:[]` → 400 INVALID_PROGRAM_SCOPES, matching create — the legacy
   empty-passthrough (which would activate inference fallback) is removed from the
   patch path. Legacy `updateSubject` (unused by the router) is untouched.
3. Subjects-page copy: `subject-source-utils.ts` verified-live branch no longer says
   "curriculum subject list … active school year" — all states now describe the saved
   ATLAS subject catalog; `DeleteSubjectDialog` "curriculum list" → "saved subject catalog".
4. Route regressions in `subject-catalog-truth.test.ts` §6: R-probe create (201) →
   PATCH `termCount:null` (400 INVALID_TERM_METADATA) → PATCH `programScopes:[]`
   (400 INVALID_PROGRAM_SCOPES) → updatedAt-unchanged + scopes-`['REGULAR']` zero-write
   proof. Suite now 66/66 (was 59/59).
5. Change-package preservation (no `.gitignore` edit, nothing staged/committed):
   - `atlas-server/src/__tests__/subject-catalog-truth.test.ts` SHA-256 `5C77AA58…19AAF19`
   - `atlas-client/src/lib/__tests__/subject-school-scope.test.ts` SHA-256 `66ECCB57…7D28E2`
   - `atlas-client/src/lib/subject-school-scope.ts` SHA-256 `C5C70A12…74C7C`
   Both test files sit under the pre-existing `.gitignore:65` `**/__tests__/` rule, so a
   future authorized packaging step must force-add exactly these two paths, e.g.
   `git add -f atlas-server/src/__tests__/subject-catalog-truth.test.ts atlas-client/src/lib/__tests__/subject-school-scope.test.ts`
   (NOT run by this executor — staging/committing requires separate authorization).

SCA-01R gates (executor): catalog-truth 66/66 · http-integration 24/24 · atomicity 17/17 ·
client scope 3/3 · server `tsc` build pass · client `tsc --noEmit` clean · client build pass
(14.51s) · `git diff --check` clean. Disposable schools only (99994 executor, reviewer-owned
IDs for probes); school 1 / runs / ownerships / publication untouched; no port-5001 restart;
no TL-06R3C / Teaching Load / generation / schema / recovery / `.env` / external-repo contact.

## SCA-01R2 correction (2026-09-07, executor — narrow, SCA-02 still locked)

Defect: the Subjects page create branch posted `{ ...values, ... }`, so the
hidden `emptyForm.isSeedable: true` leaked into operator-create requests and
operator-created subjects were stored as seedable. The server default
(`isSeedable: data.isSeedable ?? false`) was correct but never reached.

Corrections (no other behavior touched; NO server logic change):
1. New production builder `atlas-client/src/lib/subject-create-payload.ts` —
   `buildOperatorSubjectCreatePayload(values)` omits `id` and the internal
   `isSeedable` classification, keeps all operator fields plus the page's
   existing trim/null normalization. The create branch in `Subjects.tsx`
   (`handleModalSave`) now posts ONLY through this builder; the raw
   `...values` spread is gone. The edit PATCH path is unchanged (still
   preserves the stored `isSeedable`, never sends it).
2. `emptyForm.isSeedable` flipped `true → false` (`subject-constants.ts`)
   so no caller can inherit `true` merely from the default form.
3. Controlled bootstrap (`ensureDefaultSubjects` / MATATAG_DEFAULTS)
   untouched — seed rows keep intended values; existing records never rewritten.
4. Regression coverage through real paths (no grep-only assertions):
   - client `subject-create-payload.test.ts` (new, 6/6): exercises the
     production builder — hostile `isSeedable:true` input yields NO key,
     clean form yields NO key, `emptyForm.isSeedable === false`, `id` never
     forwarded, operator fields + trimming preserved, modularOrder nulling.
   - server `subject-catalog-truth.test.ts` §7 (new, 9 probes, suite 66→75):
     key-omitted POST via production route → 201 + response/stored
     `isSeedable=false`; bootstrap FIL=true / HG=false retained; operator
     row NOT rewritten by re-bootstrap; probe row removed via fingerprinted
     route delete (404, zero residue).
5. Change-package preservation (no `.gitignore` edit, nothing staged/committed):
   - `atlas-client/src/lib/subject-create-payload.ts` SHA-256 `B54D7FCA…81B6EF`
   - `atlas-client/src/lib/__tests__/subject-create-payload.test.ts` SHA-256 `AB38B141…1F20BA3D`
   - `atlas-server/src/__tests__/subject-catalog-truth.test.ts` SHA-256 `3412CB1B…900B6C2E0`
   - `atlas-client/src/lib/__tests__/subject-school-scope.test.ts` SHA-256 `66ECCB57…7D28E2` (unchanged, rerun 3/3)
   Both test files sit under the pre-existing `.gitignore:65`
   `**/__tests__/` rule, so a future authorized packaging step must
   force-add exactly these three paths (NOT run by this executor):
   `git add -f atlas-client/src/lib/subject-create-payload.ts atlas-client/src/lib/__tests__/subject-create-payload.test.ts atlas-server/src/__tests__/subject-catalog-truth.test.ts`
   (the builder is a tracked-path source file; the two tests are gitignored).

SCA-01R2 gates (executor): catalog-truth 75/75 · client payload 6/6 ·
client scope 3/3 · http-integration 24/24 · client `tsc --noEmit` clean ·
server `tsc` build pass · client build pass (16.64s) · `git diff --check`
clean. Disposable schools only (99994 executor, 99989 reviewer-owned);
school 1 / runs / ownerships / publication untouched; no port-5001 restart;
no TL-06R3C / Teaching Load / generation / schema / recovery / `.env` /
external-repo contact. Tracked diff is exactly 3 client files
(`subject-create-payload.ts` new + `subject-constants.ts` +
`Subjects.tsx` modified).

## SCA-01R3 correction (2026-09-07, executor — narrow, SCA-02 still locked)

Closes the remaining authority gap: `isSeedable`/`isSystemManaged` are now
protected bootstrap metadata on every ordinary path. Only
`ensureDefaultSubjects` (direct Prisma) writes them.

Corrections:
1. `subject.service.ts`: both flags moved VALID_PATCH_FIELDS →
   PROTECTED_PATCH_FIELDS (PATCH rejects with 400 before any read/write, so
   `updatedAt` is untouched); `createSubject` rejects either key (when not
   `undefined`) with 400 PROTECTED_FIELD before any write, its data type no
   longer accepts them, the write hardcodes `isSeedable: false` ([CORRECTED
   by SCA-01R4: the write ALSO hardcodes `isSystemManaged: false` — the
   R3-era "contract-default `isSystemManaged`" claim below is withdrawn;
   deriving managed state from operator code/name was the R4 bypass];
   VALID_BOOLEAN_FIELDS narrowed.
   Legacy `updateSubject` (not router-reachable) untouched.
2. `subject.router.ts` POST: no longer forwards either flag; an explicit
   presence guard returns 400 PROTECTED_FIELD before any write (never
   silently stripped). Note precedence: `MISSING_FIELDS` fires before the
   protected guard for an empty hostile body — documented, not a defect.
3. `subject-create-payload.ts`: builder now omits `id`, `isSeedable`, AND
   `isSystemManaged`.
4. `Subjects.tsx` edit payload: `isSystemManaged` removed (both flags
   preserved by omission; server rejects either key).
5. Ordinary catalog edits on seed/system-managed rows still succeed —
   protection covers the metadata fields, not the row (old silent-drop
   behavior NOT restored).
6. Regression coverage (no grep-only assertions):
   - catalog-truth §1 +2 service-level PROTECTED_FIELD probes (explicit true
     on create); §2 protected expectations incl. `isSeedable:false`-valued
     input (presence-based, not value-based); §4 AAA proves default false
     with no key sent; §7 payload updated (no `isSystemManaged:false` key);
     new §8 (10 route probes): POST either flag → 400 + zero rows; PATCH
     either flag → 400 + `updatedAt` unchanged + flags intact; valid rename
     on seed FIL → 200 with flags untouched, then reverted. Suite 75→90.
   - client payload suite +1 hostile-both probe (neither key in output).
7. Change-package preservation (no `.gitignore` edit, nothing staged/committed):
   - `atlas-client/src/lib/subject-create-payload.ts` SHA-256 `9B3709A1…E06CB7E0`
   - `atlas-client/src/lib/__tests__/subject-create-payload.test.ts` SHA-256 `53362706…C20C8642AC`
   - `atlas-server/src/__tests__/subject-catalog-truth.test.ts` SHA-256 `3B798B68…841A0D965`
   Future authorized packaging (NOT run by this executor):
   `git add -f atlas-client/src/lib/subject-create-payload.ts atlas-client/src/lib/__tests__/subject-create-payload.test.ts atlas-server/src/__tests__/subject-catalog-truth.test.ts`

SCA-01R3 gates (executor): payload+scope 10/10 · catalog-truth 90/90 ·
http-integration 24/24 · crud-source-authority 19/19 · client `tsc --noEmit`
clean · server `tsc` build pass · client build pass (14.03s) ·
`git diff --check` clean. Disposable schools only (99994 executor);
school 1 / runs / ownerships / publication untouched; no port-5001 restart;
no TL-06R3C / Teaching Load / generation / schema / recovery / `.env` /
external-repo contact. Tracked diff exactly 4 files (service, router,
Subjects.tsx, subject-constants.ts carried-forward R2) + untracked builder.

RETRACTION (required by prompt): the SCA-01R2 classification of a direct-API
explicit-`true` create persisting `true` as acceptable "no over-correction"
is WITHDRAWN. That behavior is now 400 PROTECTED_FIELD with zero writes at
both router and service layers (executor §1/§8 probes + reviewer adversarial
probes incl. explicit-`false` presence and mixed-field PATCH). The R2
"accepted residual" no longer exists and must not be cited.

## SCA-01R4 correction (2026-09-07, executor — narrow, SCA-02 still locked)

Bypass: `createSubject` wrote `isSystemManaged: contract.isSystemManaged`,
and the contract default derives `true` from `_EXP` / `TLE_SPEC_` codes — so
an ordinary key-omitted create with such a code implicitly self-classified
as system-managed, defeating R3 protection without sending any flag.

Correction (single functional hunk, `subject.service.ts` write path):
ordinary `createSubject()` now hardcodes BOTH `isSeedable: false` AND
`isSystemManaged: false`. The code-derived default still serves controlled
bootstrap/materialization (`ensureDefaultSubjects`, dynamic TLE) only.
Owner-department / rotation / outputLabel derivation is deliberately
UNCHANGED, as are offering, Teaching Load, and generator policy.

Failing-first proof (required): new §9 (16 route probes — key-omitted POSTs
for `SCA01R4_CTL` / `SCA01R4_EXP` / `TLE_SPEC_R4X`; explicit-flag 400;
bootstrap `TLE_ICT_EXP=true` retained; managed-row edit applies + reverts;
probe rows deleted) was run BEFORE the fix: 104 passed / 2 failed, with
exactly the two `isSystemManaged=false` assertions for the `_EXP` /
`TLE_SPEC_` codes failing. After the one-line fix: 106/106. The test fails
against `contract.isSystemManaged` by construction.

Documentation/ledger correction (required): system-managed metadata may be
written ONLY by controlled internal bootstrap/materialization paths, never
ordinary subject CRUD — the R3-era "contract-default on create" claim is
withdrawn above; runtime-source-of-truth-map ownership wording (ATLAS owns
the fields) needed no change.

Change-package preservation (no `.gitignore` edit, nothing staged/committed):
- `atlas-server/src/__tests__/subject-catalog-truth.test.ts` SHA-256 `DDEDF405…B7BD9D6`
- `atlas-client/src/lib/__tests__/subject-create-payload.test.ts` SHA-256 `53362706…C20C8642AC` (unchanged, rerun 7/7)
Future authorized packaging (NOT run by this executor):
`git add -f atlas-server/src/__tests__/subject-catalog-truth.test.ts`
(client builder + payload test force-add command already recorded under R3).

SCA-01R4 gates (executor): catalog-truth 106/106 (104/2 pre-fix) ·
payload 7/7 · http-integration 24/24 · crud-source-authority 19/19 ·
client `tsc --noEmit` clean · server `tsc` build pass · client build pass ·
`git diff --check` clean. Disposable schools only (99994 executor);
school 1 untouched; no port-5001 restart; no schema / TL-06R3C /
Teaching Load / generation / recovery / `.env` / external-repo contact.
Tracked diff: same 4 R3 files, single new functional hunk.

Environmental note (NOT an R4 finding): http-integration §10 failed twice
(500 P2028) while Tailnet upstream 100.120.169.123 was unreachable from this
environment (bounded probe: 12.1s hang to timeout) — the three sequential
10s upstream abort timeouts inside `applySubjectSync`'s 5s transaction
expire it. Sync files are untouched by this diff (proven via
`git diff --name-only`). Upstream recovered before review close: executor
rerun 24/24 green, reviewer independently 24/24. Pre-existing
fetch-inside-transaction shape belongs to a future sync-hardening prompt,
not this one.

## SCA-02 execution (2026-09-07, executor)

Preflight: SCA-02 recomputed `CD324691…2EE056` == pinned GO; sequence
`1C0D33E9…71A` == manifest SCA-00 pin GO. Startup reads: AGENTS.md (system
prompt), ATLAS_AGENT_KI.md, runtime-source-of-truth-map, sequence, SCA-02
prompt, SCA-01 ledger. Git state before edits: only SCA-01 carryover
(subject.service/router, Subjects.tsx, subject-constants.ts) + untracked
subject-create-payload builder — all preserved, none touched except
Subjects.tsx toolbar (link added) and App.tsx (route added).

### SCA-02.0 — Schema adequacy checkpoint: ADEQUATE, no migration

`SchoolYearTermConfig` / `SchoolYearOffering` / `OfferingTermAssignment`
(`prisma/schema.prisma:1122-1191`) represent every contract element
structurally: explicit-empty scope (`subjectId NULL + termMode EMPTY`),
section/cohort override (`sectionMirrorId XOR cohortId`), versioning
(`version`), operator provenance (`createdBy/updatedBy/retiredBy`), term
applicability (`OfferingTermAssignment`). Missing pieces are service-level
(fingerprint-bound apply, single-row version guards, ALL-without-assignments
semantics) — fixed in code, not schema. No migration created or applied.
schoolYearId values are plain Ints (EnrollPro year identity, no FK).

### Task log (SCA-02)

| Task | Risk | Status | Files | Evidence | Review |
|---|---|---|---|---|---|
| SCA-02.0 adequacy | LOW | DONE | this ledger | verdict ADEQUATE above | prompt-boundary batch |
| SCA-02.1 service+routes | MEDIUM | DONE | `school-year-offering.service.ts` (+~750), `curriculum-requirements.router.ts` (new), `app.ts` (mount) | curriculum-truth 56/56; server tsc clean + build pass | prompt-boundary batch |
| SCA-02.2 UI | MEDIUM | DONE | `CurriculumRequirements.tsx` (new), `curriculum-scope-states.ts` (new), `App.tsx` (route), `Subjects.tsx` (toolbar link) | scope-states 18/18; client tsc clean + build pass | prompt-boundary batch |
| SCA-02.3 readiness | MEDIUM | DONE | same service block (`evaluateCurriculumReadiness`, `suggestRequirementsFromCatalog`) + `GET readiness`/`requirement-suggestions` routes | S4/S7/S10 probes in 56/56 | prompt-boundary batch |
| SCA-02.4 tests | MEDIUM | DONE | `curriculum-requirements-truth.test.ts` (new), `curriculum-scope-states.test.ts` (new) | 56/56 + 18/18; regressions catalog-truth 106/106, http 24/24, offering-resolution 27/27 | prompt-boundary batch |

### SCA-02 design decisions

- ALL mode accepts zero term assignments (all-year, config-independent
  assignments) or exactly termCount assignments when a config exists.
  All-year rows persist zero `OfferingTermAssignment` rows — no fake terms.
- Term config remains FK-required for writes (schema); readiness blocks
  missing term truth only where term-aware rows exist. Term count/identities
  are operator-entered, never defaulted (no `[1,2,3]`, no `termCount=3`).
- Batch apply: content fingerprint + full source-version map, Serializable
  tx, zero partial writes on FINGERPRINT_MISMATCH / STALE_WRITE; idempotent
  re-apply. Single-row create/update/retire are version-guarded; scope
  identity (subject/grade/program/section/cohort) is immutable via PATCH.
- Subjects must be same-school and catalog-active to become requirements
  (CROSS_SCHOOL_DENIED / SUBJECT_INACTIVE). Section/cohort overrides are
  membership-checked against same-school/year mirrors; EnrollPro is never
  called (no upstream import in service or router).
- Suggestions carry `provenance: catalog-compatibility-unapproved`,
  `approved: false`, and never write. Teaching Load / generation consumers
  untouched (switch reserved for SCA-04). No "exactly two specializations"
  anywhere (1 and 3 proven valid).
- `computeFingerprint` canonical form now includes section/cohort scope so
  override-only differences never collide. No production caller depended on
  old fingerprints (routes are new in this prompt).

### SCA-02.4 evidence (2026-09-07, executor)

- `npx tsx src/__tests__/curriculum-requirements-truth.test.ts`
  (disposable schools 99983/99982, years 77901/77902, exact cleanup, zero
  residue proven): 56 pass / 0 fail, exit 0. Includes failing-first-class
  guards: stale single version, tampered fingerprint, empty source versions,
  drifted route re-apply — each with zero-write signature proof; positive
  write-detector control included.
- `npx tsx src/lib/__tests__/curriculum-scope-states.test.ts`: 18/18.
- Regressions: catalog-truth 106/106 (SCA-01R4 holds) · http-integration
  24/24 · offering-resolution (shadow) 27/27 · server `tsc` build pass ·
  client `tsc --noEmit` clean · client build pass · `git diff --check` clean.
- Boundaries: no TL-06R3C files, no Teaching Load/generation edits, no
  schema/migration, no live data (schools 1/years untouched), no port-5001
  restart (ephemeral 5997 only), no `.env`/recovery/external-repo contact.
- New test files sit under pre-existing `.gitignore:65` (`**/__tests__/`);
  future authorized packaging must force-add
  `atlas-server/src/__tests__/curriculum-requirements-truth.test.ts` and
  `atlas-client/src/lib/__tests__/curriculum-scope-states.test.ts`
  (NOT run by this executor).

## SCA-02R integrity correction (2026-09-07, executor)

Prompt SCA-02R declared SCA-02 NO-GO with 7 verified product/authority
defects. All fixed in this pass, preserving SCA-02 scaffolding and without
redesigning unrelated Subjects work (subject.service/router diffs remain
byte-identical SCA-01 carryover).

1. Canonical identity: `requirementIdentityOf/Key` (subject, grade,
   program, section, cohort, rotationFamily) now drives duplicate
   detection, preview new/unchanged/retired counts, batch
   retirement/upsert matching, and conflict detection
   (`assertNoProposedConflicts` → REQUIREMENT_DUPLICATE /
   CURRICULUM_SCOPE_CONFLICT). Base/section/cohort rows proven distinct.
2. Fingerprint: `computeRequirementFingerprint` = canonical JSON
   (`lib/canonical-json.ts`) + SHA-256 (`CURR_REQ_<64HEX>`), sorted by
   identity key. Binds section/cohort, classification, minutes,
   family/order, mode, normalized terms. Order-free; any semantic mutation
   invalidates.
3. Term concurrency: `upsertTermConfig` requires `expectedUpdatedAt` when a
   config exists (+ updateMany predicate); preview binds
   `termConfigRevision`; apply requires `expectedTermConfigUpdatedAt` and
   rereads it inside the Serializable tx. Concurrent edits → STALE_WRITE,
   zero writes.
4. Year authority: new `school-year-authority.service.ts` verifies every
   read/mutation against `EnrollProSchoolYearMirror` (404 YEAR_NOT_FOUND
   incl. cross-school/missing, 409 YEAR_ARCHIVED). Client
   `resolveCurriculumYearScope` refuses school-mismatched context (incl.
   the school-1 cache default) with one force-refresh then an explicit
   blocked state issuing no year-scoped requests.
5. Operator workflow: Add dialog exposes section/cohort override pickers
   (mutually exclusive, gracefully degrading) and full rotation controls
   (family/order/single configured term; ROTATING disabled without terms);
   deferral copy removed; list shows override + rotation detail.
6. Readiness: `buildExpectedScopes` from same-school/year active non-stale
   section mirrors (grade via `normalizeGradeLevelSync`, exotic programs →
   OTHER). Expected base scopes with no base rows (overrides don't count)
   → MISSING + OFFERING_TRUTH_MISSING. EMPTY clears only its exact scope.
7. Strict validation: no `String()` coercion anywhere; non-string terms,
   malformed ids/rotation, unknown fields (route + service,
   UNKNOWN_FIELD), malformed/mismatched body schoolId (400/403) all typed.

Evidence: curriculum-truth 68/68 (13 controls incl. failing-shape guards) ·
scope-states 25/25 · catalog-truth 106/106 · http 24/24 ·
offering-resolution 27/27 · server+client tsc clean + builds pass ·
`git diff --check` clean. Disposable schools 99981/99980 + year mirrors,
zero residue. No TL-06R3C/generation/schema/live-data contact.
Packaged by operator as commit `677993da` (tracked set; reviewer verified
post-commit parity).

## SCA-02R2 atomic creation + durable evidence (2026-09-07, executor)

Closes the two remaining SCA-02R acceptance blockers. No schema migration:
`uq_offering_scope` (`prisma/schema.prisma:1172`) cannot block ordinary
creates because Postgres treats each NULL (sectionMirrorId/cohortId/
rotationFamily, and subjectId for EMPTY rows) as distinct, so the existing
Serializable transaction mechanism is the correct boundary. ATLAS only; no
EnrollPro/AIMS/SMART/Teaching Load/generation/publication/auth/recovery/
backup/`.env`/live-data contact.

1. Failing-first proof (deterministic, never probabilistic Promise.all):
   new `atlas-server/src/__tests__/curriculum-requirements-concurrency.test.ts`
   installs a `$transaction`-entry barrier on the production Prisma
   singleton around each concurrent pair — the first entrant waits for the
   second, so both requests are simultaneously in flight through the
   production path before either transaction body executes (fail-open
   timeout marks the attack un-engaged; a loud failure, never a silent
   pass). Pre-fix run: C1/C2/C3/C6 `engaged=true`, both requests succeed,
   two active rows with the same canonical identity persisted
   (14 passed / 13 failed with exactly the duplicate-row assertions
   failing; C4/C5/C7 already green). Zero residue proven in the same run.
2. Correction (`school-year-offering.service.ts:createRequirement` only):
   canonical duplicate discovery moved INSIDE the same Serializable
   transaction as the offering insert; term assignments remain in that
   transaction (atomic). The loser either observes the winner's row in-tx
   or loses the serialization race — Prisma P2034 / SQLSTATE 40001 is
   mapped to typed 409 REQUIREMENT_EXISTS after a bounded existence
   re-read (no write). Spurious aborts with no persisted duplicate retry
   at most 3 attempts, each re-running discovery in a fresh transaction,
   so no retry can create duplicate offerings or term assignments. Typed
   API errors never enter the retry path (`isSerializationConflict`
   excludes statusCode carriers). Section/cohort/base/EMPTY/rotation-family
   identity distinctions unchanged (same `requirementIdentityKey`;
   discovery still filters `isActive: true`, so retired rows never block).
   No school/curriculum-count hardcoding.
3. Regression (same file, C1–C7): base / section-override /
   cohort-override identical pairs (one success + REQUIREMENT_EXISTS +
   exactly one active row); distinct identities under forced overlap (both
   succeed — no false SSI conflict); retire → recreate succeeds with the
   new row active + re-duplicate → 409; route-level pair → HTTP 201 + 409
   with code REQUIREMENT_EXISTS + one row + 7 total actives; zero residue.
   Post-fix: 27/27, exit 0, stable across 3 runs (winners vary run to
   run, proving a genuine race, not ordering).
4. Durable packaging: force-added ONLY the named test/evidence paths
   (repository-wide `**/__tests__/` + `docs/` ignore policy untouched):
   `atlas-server/src/__tests__/curriculum-requirements-truth.test.ts`,
   `atlas-client/src/lib/__tests__/curriculum-scope-states.test.ts`,
   `atlas-server/src/__tests__/curriculum-requirements-concurrency.test.ts`,
   this ledger, and the SCA-02R2 advisory review artifact. Proven with
   `git ls-files` (all five listed), `git show --name-only` (only these
   paths staged), and staged-blob hash equality with the executed files.

Evidence (executor, disposable schools/years only — 99971/77871 for the
new suite; 99981/99980 truth rerun; school 1 / runs / ownerships /
publication untouched; ephemeral ports 5997/5998 only; no port-5001
restart; no TL-06R3C / generation / Teaching Load / schema / recovery /
`.env` / external-repo contact):
concurrency 27/27 (×3) · truth 68/68 · scope-states 25/25 ·
http-integration 24/24 · catalog-truth 106/106 · server `tsc --noEmit`
clean · server `npm run build` pass · built-server startup + health 200
(port 5020) + touched route mounted (401, not 404, port 5021) · client
`tsc --noEmit` clean · client build pass · `git diff --check` clean.
Tracked source diff is exactly one file
(`school-year-offering.service.ts`, createRequirement + helper); the
service change stays unstaged — only test/evidence paths were force-added.

## Advisory review SCA-02R2 (fresh context, verified spawn ID
`ses_f83b16986ffeREi5mlo5lC5uPK` — captured from the spawn return envelope,
relayed pre-artifact, repeated verbatim in artifact lines 3/5)

Verdict `zeroFix: true` — reviewer-designed INSERT-gate attack (a different
deterministic mechanism from the executor's barrier: B held at the
`$transaction` boundary until A issued its in-tx create, so the pair can
never run as disjoint sequential transactions), all defeated: gated base /
section pairs through the service (1 win + REQUIREMENT_EXISTS + 1 row, no
`THROW:`/`P` leakage), gated cohort pair through the real route (HTTP
201+409, loser code REQUIREMENT_EXISTS), gated different-identity pair
under forced overlap (both succeed — no false 409), rotation-family
distinction (both succeed + 2 term rows), EMPTY duplicate → 409,
retire → recreate ok → re-duplicate → 409, sequential duplicate → 409,
4 garbage-id probes → typed 4xx (never 500). Reruns: concurrency 27/27 +
truth 68/68 by the reviewer; own probe 35/35 on disposable school
99972/year 77872 (port 5995), residue 0, probe file deleted. Tracking
verified (`git ls-files` lists all three tests; staged set is exactly the
three tests + this ledger; service fix modified-but-unstaged as expected).
Boundary clean (no TL-06R3C / Teaching Load / generation / schema /
migration / `.env` / external-repo contact). No material findings, so no
second review iteration was required. Artifact:
`docs/reviews/subjects-curriculum-authority-2026-09-07/sca-02r2-advisory-review-01.md`
(force-added with this ledger). SCA-02 stays REVIEW_REQUIRED until
planner QA; SCA-03 locked.

## Advisory review SCA-02R (fresh context, verified spawn ID
`ses_f84089beaffetV8qS8DDi4wOOK` — captured from the spawn return envelope,
relayed pre-artifact, repeated verbatim in artifact lines 3/10)

Verdict `zeroFix: true` — reviewer-designed attacks, all defeated:
scope-swap (base/section/cohort distinct through preview+apply; directional
retire isolation), term-race (concurrent reorder → 409 STALE_WRITE,
byte-identical signatures), multi-school (2nd actor, numeric-string
cross-school subject → 403, victim unchanged), missing-scope (G7 + exotic
program MISSING with exactly 2 blockers; EMPTY exact-scope only),
fingerprint (3-row reorder stable; rotationOrder tamper →
FINGERPRINT_MISMATCH), strict shaping (hostile terms/unknown fields typed
at both boundaries; archived 409 / missing 404). Reruns: 68/68 + 25/25 +
106/106 + own 64/64. One reviewer over-expectation adjudicated (benign
`String(row.id)` keys, same class as SCA-01R4 precedent). Artifact:
`docs/reviews/subjects-curriculum-authority-2026-09-07/sca-02r-advisory-review-01.md`.
SCA-02 stays REVIEW_REQUIRED until planner QA; SCA-03 locked.

## Advisory review SCA-02 (fresh context, verified spawn ID
`ses_f84722beeffe3lTwUYI6CMgkrR` — captured from the spawn return envelope,
relayed pre-artifact, repeated verbatim in artifact)

- Review 01 verdict `zeroFix: false` — one material defect M1 (same class as
  SCA-01 F1): router `toOfferingInput` coerced ids with bare `Number()`,
  so `subjectId:'abc'` / `sectionMirrorId:'xyz'` reached Prisma as NaN and
  returned 500 with Prisma internals leaked (proven by the reviewer through
  the production route on disposable school 99969, residue 0). All other
  areas passed (9/9 endpoint wiring, authority, 3 own-design adversarial
  probes 7/7, empty-vs-missing, 1-and-3 specializations, Q1/Q2 terms,
  UI states, boundaries). Reviewer reruns: 56/56 + 18/18 + 106/106.
- M1 fix (executor, same session — no new prompt): strict `parseOptionalId`
  in `toOfferingInput` (present-but-non-integer → whole input 400 before any
  Prisma call); integer guards in `assertRequirementSubject` /
  `assertRequirementScope` (INVALID_SUBJECT / INVALID_SECTION_SCOPE /
  INVALID_COHORT_SCOPE) and in single-row update/retire entry
  (INVALID_PARAM); `previewOfferings` now fail-closed validates proposals
  (previously blessed anything). Failing-first: new §S11 (6 probes) run
  pre-fix — 57 passed / 5 failed with exactly the malformed-id probes
  failing (500s + preview-200 + untyped service throw); post-fix 62/62.
- Informational O1 (raw scope-chip `<button>`) fixed with shadcn `Button`;
  O2 (term-editor `'3'`/`'T1, T2, T3'` initial state) fixed to empty-until-loaded.
- Changed-scope re-review (same reviewer context, spawn ID
  `ses_f84722beeffe3lTwUYI6CMgkrR` relayed pre-artifact and repeated
  verbatim in artifact lines 3/6): verdict `zeroFix: true` — M1 reproved
  fixed through the route (11/11 hostiles → typed 400, zero Prisma
  internals, zero writes; preview hostile now 400; valid controls intact);
  reviewer reruns 62/62 + catalog-truth 106/106 + own probe 24/25 (sole
  miss is informational O4: direct-service preview with garbage id returns
  advisory 200 — zero-write, un-launderable since route preview and service
  apply both 400); new adversarial (numeric-string cross-school subject)
  → 403 CROSS_SCHOOL_DENIED, zero victim writes. Artifact:
  `docs/reviews/subjects-curriculum-authority-2026-09-07/sca-02-advisory-review-01.md`.
  SCA-02 stays REVIEW_REQUIRED until planner QA; SCA-03 locked.

## Review log — reviewer-identity retraction (SCA-01R2, 2026-09-07)

RETRACTED: the `ses_…` task strings recorded in this ledger's SCA-01 /
SCA-01R review-log rows (`ses_f85cbf0ddffeuVcMqsRLuhXLSF`,
`ses_f85beaf40ffe49STlNzkarGFhm`, `ses_f85960c87ffeMWDDnysj1nTF4d`) are
withdrawn as reviewer-identity evidence. They were executor-recorded labels
with no capture-relay-repeat chain, and they directly contradict the
SCA-01R artifact's own statement that no spawn ID could be cited or
repeated. Those verdicts' product evidence stands on its own test reruns;
their reviewer-independence claims do NOT meet the SCA-01R2 identity bar
and must not be cited as verified independent reviews.

VERIFIED (SCA-01R2 only): spawn-returned execution-system ID
`ses_f857f3d73ffefNfwIUqXplWkbo` was captured from the spawn return
envelope BEFORE review, relayed to the reviewer in the resumed session,
and repeated verbatim by the reviewer in
`docs/reviews/subjects-curriculum-authority-2026-09-07/sca-01r2-advisory-review-01.md:20`.
Ledger, report, and artifact agree on this ID; no other review in this
stream meets this bar.

## Prior review log (SCA-01 / SCA-01R — identity claims retracted above)

- Advisory review 01 (fresh context, task `ses_f85cbf0ddffeuVcMqsRLuhXLSF`):
  artifact `docs/reviews/subjects-curriculum-authority-2026-09-07/sca-01-advisory-review-01.md`.
  Verdict `zeroFix: false` — one material defect F1: six malformed inputs (numeric
  ownerDepartment/outputLabel, string isActive, Int32-overflow minutes, string/boolean
  patch minutes) reached Prisma/internal code as untyped 500s (proven on disposable
  school 99993, residue 0). All other areas passed (scope gating, UI honesty,
  version/fingerprint preservation, reachability, boundaries).
- F1 fix (executor): strict `checkMinutesPerWeek` (typeof number, integer, Int32 range)
  shared by create + patch; string-or-null enforcement for ownerDepartment/rotationFamily/
  outputLabel on create; isActive boolean enforcement on create; 8 new regression cases
  (7 service-level + 1 HTTP-level) in `subject-catalog-truth.test.ts` (now 59/59).
- Advisory review 02, changed scope (fresh context, task `ses_f85beaf40ffe49STlNzkarGFhm`):
  artifact `.../sca-01-advisory-review-02.md`. Verdict `zeroFix: true` — all 6 bypasses
  re-proved as typed 4xx through the production route (disposable school 99997, residue 0);
  catalog-truth 59/59 and atomicity 17/17 rerun by the reviewer; boundary clean.
  One informational observation O4 (router Number() coercion on create minutes).
- O4 hardening (executor, post-review, non-material): router POST passes minutes through
  uncoerced; service owns strict validation. Server build + catalog-truth 59/59 +
  `git diff --check` rerun green after the one-line change. No third review spawned:
  O4 was informational (no material defect trigger per the advisory-loop rule); the
  planner may request one.
- Advisory review SCA-01R (fresh context, task `ses_f85960c87ffeMWDDnysj1nTF4d`):
  artifact `docs/reviews/subjects-curriculum-authority-2026-09-07/sca-01r-advisory-review-01.md`.
  Verdict `zeroFix: true` — R1 (null termCount → 400) and R2 (empty scopes → 400) proved
  through the production PATCH route with zero-write evidence; valid controls apply;
  no over-correction (create-null defaults to 3, modularOrder:null accepted, legacy
   inference reads intact); zero remaining active-year claims on Subjects surfaces;
   reviewer reruns catalog-truth 66/66 + atomicity 17/17; boundary clean.
- Advisory review SCA-01R2 (fresh context, verified spawn ID
  `ses_f857f3d73ffefNfwIUqXplWkbo` — captured from the spawn return envelope,
  relayed pre-review, repeated verbatim in artifact line 20):
  artifact `docs/reviews/subjects-curriculum-authority-2026-09-07/sca-01r2-advisory-review-01.md`.
  Verdict `zeroFix: true` — builder is the sole create-body constructor (no
  `...values` spread remains); hostile-`true` builder input yields no key;
  catalog-truth 75/75 and payload 6/6 rerun by the reviewer; adversarial
  route probe (explicit-`true` bypass notes server accepts it — accepted
  residual, operator path omits by contract; PATCH flip applies; malformed
  PATCH typed 400 with zero-write) 14/14 on disposable school 99989,
  residue 0; tracked diff exactly the 3 claimed client files; probe scripts
  deleted. No required fixes. SCA-02 remains locked for planner QA.
  [SUPERSEDED in part by SCA-01R3: the "accepted residual" above is
  retracted — direct flag mutation is now 400 with zero writes. The R2
  verdict and all other R2 evidence stand.]
- Advisory review SCA-01R3 (fresh context, verified spawn ID
  `ses_f8566539bffe3v9lQhBb3FeTic` — captured from the spawn return envelope,
  relayed pre-review, repeated verbatim in artifact line 22):
  artifact `docs/reviews/subjects-curriculum-authority-2026-09-07/sca-01r3-advisory-review-01.md`.
  Verdict `zeroFix: true` — presence-based protection proved (explicit
  `isSeedable:false` also 400); mixed `{name,isSeedable}` PATCH → 400 with
  name AND updatedAt unchanged (all-or-nothing); bootstrap FIL=true /
  TLE_ICT_EXP isSystemManaged=true with operator grade surviving
  re-bootstrap; valid FIL/TLE_EXP edits apply without touching flags;
  reviewer reruns 90/90 + 10/10; adversarial 20/20 on school 99988,
  residue 0, school 1 read-only (22 rows); guard ordering documented
  (MISSING_FIELDS precedes PROTECTED_FIELD on empty hostile body);
  boundary clean. No required fixes. SCA-02 remains locked for planner QA.
- Advisory review SCA-01R4 (fresh context, verified spawn ID
  `ses_f84d6aaf3ffeEqdF1KNN8ZoyPI` — captured from the spawn return envelope,
  relayed pre-review, repeated verbatim in artifact line 24):
  artifact `docs/reviews/subjects-curriculum-authority-2026-09-07/sca-01r4-advisory-review-01.md`.
  Verdict `zeroFix: true` — reruns 106/106 + 7/7 + 24/24 by the reviewer;
  own implicit-classification probe (fresh codes `R4REV_CTL`/`R4REV_EXP`/
  `TLE_SPEC_R4REV`, school 99987) all false/false with derivation intact
  (owner/label/rotation flow); bootstrap managed row survives re-bootstrap
  with operator grade intact; managed-row PATCH applies; 24/24 probe checks,
  residue 0, school 1 read-only; one reviewer-side over-expectation
  adjudicated in source (unknown-prefix null department is pre-existing
  contract behavior); single-hunk boundary confirmed; §10 environmental
  note verified (409 here, not a finding). No required fixes. SCA-02
  remains locked for planner QA.
