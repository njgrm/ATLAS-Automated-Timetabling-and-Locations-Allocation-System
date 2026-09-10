# TL-C02 One-Shot — Complete Active-Year Teaching Load Reconciliation — Progress Ledger

Plan source: user prompt TL-C02 (2026-09-09). One-shot execution, 180-minute budget.
Status: `REVIEW_REQUIRED` is the max terminal state; formal GO is out of scope.
Base SHA: `330fb91b7daa28299520272b1e258cc49395af04` (origin/main). Worktree: `D:\ATLAS-worktrees\teaching-load-tlc02` on `work/teaching-load-tlc02`.

Authority rules: Curriculum demand comes ONLY from persisted SchoolYearOffering + term config + SectionMirror + Subject catalog. HG never becomes demand/ownership/minutes/slots. Advisory credit only from effective policy. Departments from persisted authority only. No live apply.

## Phase 0 — Preflight and live baseline

- T0.1 Read mandatory docs (AGENTS.md, KI, phasePlan.md, runtime map, TL-C01 and core-readiness progress ledgers). DONE.
- T0.2 Worktree `D:\ATLAS-worktrees\teaching-load-tlc02` created clean at base `330fb91b...`. DONE.
- T0.3 Dependency install (npm ci server + client) — DONE (background).
- T0.4 Production-path mapping via two explore agents. Canonical decision:
  - Curriculum Requirements = persisted `SchoolYearOffering` + `SchoolYearTermConfig` + `OfferingTermAssignment` (216 rows, term config id 71 live).
  - `offering-demand-resolution.service.ts` is the documented SHADOW demand module with zero production importers — candidate to be wired as the canonical demand projector (production consumer added by this prompt).
  - `teaching-load-automation.service.ts autoFill` is the current suggestion path but does NOT consult curriculum requirements.
  - `allocation.service.ts`, `qualification-evaluator.service.ts`, `teaching-load-readiness.service.ts` are orphaned.
  - Fingerprint/apply pattern to follow: `department-authority.service.ts` (canonicalHash, source revision, Serializable, confirmation, idempotent replay).
- T0.5 Live read-only census — BLOCKED until Phase 1 snapshot reads implemented; will be captured via the preview artifact and a read-only probe. Census facts per prompt: school 1, year 8 (2029-2030), 20 sections, 22 active subjects, 216 requirements, term config 71, 265 ownerships, 42 active faculty, readiness 16/16, runs 0, published 0.

## Phase 1 — Canonical demand graph

- T1.1 Design demand expansion from offerings × sections (base grade+program scope, section override, cohort override), term applicability (ALL / ROTATING via term assignments), rotation family, persisted minutes. DONE (design in service).
- T1.2 Implement in `teaching-load-reconciliation.service.ts` (`expandCurriculumDemand`). IN PROGRESS.

## Phase 2 — Consolidated production reconciliation path

- T2.1 New canonical service implements classify → plan (retain/insert/move/retire/unresolved) → sequential simulated load → adviser preference → rebalance → fingerprint. Wired to new routes `POST /faculty-assignments/reconciliation/{preview|apply}` + `GET /faculty-assignments/reconciliation/readiness`. IN PROGRESS.

## Phase 3 — Secure preview/apply contract

- T3.1 Preview zero-write; fingerprint binds source revisions + full plan; apply in one Serializable transaction with in-tx revalidation, typed 409 on drift, idempotent, audit, cycle refresh, never touches curriculum/subjects/sections/generation/publication. Disposable-fixture tests only. IN PROGRESS.

## Phase 4 — Teaching Load UX completion

- T4.1 Reconciliation panel in Teaching Load page consuming preview/readiness; one primary action; approval boundary; adviser-preference indicator; UNMAPPED filter; no negative remaining; excess teaching; mobile/keyboard. IN PROGRESS.

## Phase 5 — Consumer and readiness closure

- T5.1 Effective contract excludes HG rows (ownershipIndex HG filter); effective contract preserves external ids + term/rotation metadata. Readiness reports ready only when demand coverage complete or typed exception. IN PROGRESS.

## Phase 6 — Focused verification

- T6.1 Focused gates (16 listed in prompt) as failing-first tests. PENDING.

## Phase 7 — Live read-only reconciliation preview

- T7.1 Produce `docs/verification/teaching-load-current-year-reconciliation-preview-2026-09-09.json` + `.sha256`. PENDING.

## Phase 8 — Internal adversarial reviews

- T8.1 Reviewer A (authority/data-integrity) — artifact `advisory-review-A.md`, `zeroFix:false`:
  material A1: hard-cap gate in `pickCandidate` used offering `weeklyMinutes` while simulated load credits `subject.minMinutesPerWeek`; a smaller offering value could slip a faculty over the cap. FIXED: gate now uses the credited minutes; regression test A10 added (86/86). Also added `specializationAliases` to the source revision hash and made `loadHgSubjectIds` case-insensitive.
- T8.2 Reviewer B (UX/integration) — artifact `advisory-review-B.md`, `zeroFix:false`: required minor B-1 (Apply/Preview/Reconcile controls below 44px). FIXED: h-11 controls.
- T8.3 Fresh changed-scope reviewer C — artifact `advisory-review-C.md`, `zeroFix:true`. Five adversarial probes pass; no material findings in the changed scope.
- Live preview regenerated after fixes (source revision now binds specializationAliases):
  - fingerprint `D5A200C220297A8FAD053823CF7062091FE8CB0435A4868A54260ADE030B7959`
  - sourceRevision `1DBA0148891599B5A6C03DA3DAAEE576B4216B09D65A22500A8BB9DA6A29D537`
  - byte SHA-256 `8D45CCECA792F70BF0D2448B34AB2AC2DF7D32B5E5BCA311978CEDC0CA5345FC` (sidecar verified by independent recompute)
  - plan: RETAIN 264 / INSERT 0 / MOVE 14 / RETIRE 1 / UNRESOLVED 0
- Advisory reviewers are advisory only; no GO, no merge, no push, no live apply.

## Final commit

- Owned paths staged exactly, `git diff --cached --check` verified, single commit on `work/teaching-load-tlc02`.
- Verdict `REVIEW_REQUIRED` + `APPROVAL_REQUIRED` (unapplied live fingerprint recorded, not granted).

## Residual risks

- Live DB version bumps (background faculty/section sync on the Tailnet server) can shift the source revision between preview and apply; the apply contract rejects any drift with 409 and zero writes, so a fresh preview immediately before apply is mandatory.
- Department labels (8) remain UNAPPLIED (separate operator approval). Qualification matching uses persisted department values, so reconciliation resolves today; display stays UNMAPPED until labels are approved.
- The preview `cycleImpact.stateBefore` is reported from the census, not a live cycle read (informational).
- Browser QA of the panel was static/typed only (no Playwright run in this execution); runtime browser proof remains for formal QA.

## Standing boundaries

- No live Teaching Load apply, no department-label apply, no generation, no publication, no prisma reset, no main work, no external repo edits.
- Fingerprint not applied; approval sentences recorded but never treated as granted.

## TL-C02R — Formal-QA correction commit

Base reviewed candidate: `3d210335c8eee7f39efbfbf21d326649289bee34`. Same branch `work/teaching-load-tlc02`. No amend/rebase/merge/push/live apply.

### R1 — Final-action model
- `buildReconciliationPlan` now keeps `actionsByPair` (one action per demanded pair). A retained pair that becomes a rebalance or adviser-transfer MOVE REPLACES its RETAIN action. Invariant RETAIN+INSERT+MOVE+UNRESOLVED === demandCount; owned (RETAIN+MOVE+INSERT) <= demandCount.
- Readiness uses unique final actions; regression A11 proves 264 demand can never report 278 owned (the pre-fix live readiness reported ownedDemandCount 278 for demandCount 264).

### R2 — Transaction closure
- `readReconciliationSourceSnapshot` now reads every source through the supplied client (offerings, sections, subjects, faculty, ownership, department rows, subjectOwnerPrefixes, schedulingPolicy, cycle) — no global-db workload/department/cached-policy readers inside apply.
- `buildQualificationResolver` builds a persisted-only policy snapshot from snapshot rows and evaluates through the canonical evaluator — zero DB access.
- B9 negative controls: concurrent schedulingPolicy mutation and departmentLabel mutation between preview and apply each yield 409 SOURCE_DRIFT with zero writes and unchanged ownership.

### R3 — Atomic derived state
- `refreshTeachingLoadCycle` runs INSIDE the Serializable transaction (client-injected). Injected failure rolls back every write (B10: ownership count unchanged, cycle version unchanged, no audit row). Replay remains genuinely zero-write (B6).

### R4 — Canonical qualification
- Reconciliation routes through `qualification-evaluator.service.ts` (`buildQualificationPolicySnapshot` + `evaluateQualificationWithPolicy`), persisted-only (no name/prefix/glossary/legacy inference). Added additive persisted-only DEPARTMENT_MATCH tier mirroring the production `matchesSubjectOwnershipDepartment` path. Differential A13 proves resolver eligibility+tier equal the canonical evaluator for department, specialization alias, cross-department permission, program mismatch, inactive/stale faculty, and canTeachOutsideDepartment.

### R5 — Adviser-own-section priority
- New adviser-transfer pass: a qualified active adviser with no demanded subject in their advisory section receives ONE safely-transferable valid pair (hard-cap safe, one grant per section, no duplicate action, persistent grant map through fill/rebalance/transfer). Truthful typed unsatisfied reasons (ADVISER_NOT_QUALIFIED / HARD_CAP_CONFLICT_OR_NO_SAFE_TRANSFER). A12 fixture proves a validly-owned pair transfers to the adviser. Live outcome improved 4/20 ? 20/20 satisfied.

### R6 — Cycle truth
- Preview `cycleImpact.stateBefore` reads the real TeachingLoadCycle via the client (MISSING / EMPTY / POPULATED / MISMATCH) plus version. B2b proves MISSING/MISMATCH/POPULATED.

### R7 — Preview/UI truth + regeneration
- Final actions are unique per pair (UI shows one final action per pair).
- Old artifact `...preview-2026-09-09.json` (fingerprint D5A200C2…) marked NON_APPLICABLE.
- New live preview: `docs/verification/teaching-load-current-year-reconciliation-preview-tlc02r-2026-09-09.json` (+ sidecar).
  - fingerprint `0563926BCF59E3CFF04AF51F8887FD2B99BBCD8C448D9F97D7419D5263FCCFDB`
  - sourceRevision `0DC5BE9C93033414F8D39C45BF15EC2AC903F8B16694E1FE2140F0895314E039`
  - byte SHA-256 (sidecar) `70FEC771D162181E28358967454AA6C483E51BAC21D3185DF918D154E21315FC`
  - plan RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0; final-action invariant RETAIN+INSERT+MOVE+UNRESOLVED = 234+0+30+0 = 264 = demandCount; owned (R+I+M) 264 <= 264; RETIRE 1 is a non-demand row
  - cycle POPULATED v4; before {5,5,27,3,7,0} after {0,0,38,4,0,0}; advisers 20/20; hg 0
  - `applied:false`; approval sentence records the exact fingerprint; NOT granted.

### R-gates
- Server reconciliation 129/129 (was 86; +43 new failing-first assertions), effective-policy 56/56, summary-zero-write 12/12, department gates 82/82, department apply 63/63, workload-policy 8/8, pass5 54/54. Client UI 5/5. Server + client tsc clean. Server + client production builds pass. `git diff --cached --check` clean.
- Fresh whole-candidate advisory review + changed-scope zero-fix review recorded under `docs/reviews/teaching-load-tlc02-one-shot-2026-09-09/`.

### TL-C02R advisory reviews + browser QA
- Whole-candidate review D (`advisory-review-D-whole.md`, `REVIEWER_D_WHOLE_ADVISORY`): zeroFix:false — material D-1: the adviser-transfer hard-cap gate used `pair.weeklyMinutes` (offering minutes) instead of the credited `subject.minMinutesPerWeek` (sibling gates at pickCandidate and rebalance already used credited minutes). FIXED; regression A14 added (offering 120 < credited 240, adviser at 60, cap 240 ? transfer refused, adviser stays <= cap).
- Changed-scope review E (`advisory-review-E-changed-scope.md`, `REVIEWER_E_CHANGED_SCOPE_ADVISORY`): zeroFix:true — all three hard-cap gates now use credited minutes; adversarial probes (boundary inclusivity, multiple qualified pairs, A14 discriminator) pass 21/21; server 134/0 + tsc clean.
- Authenticated browser QA (built client via Vite proxy -> corrected built server on isolated port 5098, live Tailnet DB; Tailnet-identical login) at desktop 1280x720 and mobile 390x844: 20/20 PASS — panel opens, preview renders the live plan (Stays 234 / Added 0 / Moved 30 / Removed 1 / Needs review 0), no horizontal overflow at both widths, 44px targets, keyboard reaches the confirmation input and enables Apply (approval boundary reached, Apply NOT pressed), no mojibake, no app errors. Screenshots in TEMP (uncommitted).
- Final live preview (regenerated after all corrections): fingerprint `0563926BCF59E3CFF04AF51F8887FD2B99BBCD8C448D9F97D7419D5263FCCFDB`, sourceRevision `0DC5BE9C93033414F8D39C45BF15EC2AC903F8B16694E1FE2140F0895314E039`, byte SHA-256 (sidecar verified) `53FC5D0BE29FC4CAB9AD12B230F187EBF7551975D5C0E3EE13703552CAB57CAC`, plan RETAIN 234 / MOVE 30 / RETIRE 1 / UNRESOLVED 0, invariant 264=264, owned 264, cycle POPULATED v4, advisers 20/20, hg 0, applied:false.
- Old artifact `...preview-2026-09-09.json` marked NON_APPLICABLE (marker file) with the superseded fingerprint.


## TL-C02R1 — Narrow correction (active-year authority, FacultySubject gradeLevels, mounted-route integration)

Base candidate: `e67b684fb72decb9ef2834b5566e66f5cf56f08f`. Same branch. No amend/merge/push/live apply.

### F1 — Active-year authority
- `readSchoolYearAuthoritySnapshot` (client-injected) requires a known, same-school, non-archived, currently active `EnrollProSchoolYearMirror`: missing/cross-school ? 404 `YEAR_MIRROR_NOT_FOUND`; archived ? 409 `ARCHIVED_YEAR`; known-but-inactive ? 409 `INACTIVE_HISTORICAL_YEAR`. Enforced in readiness, preview, and apply (apply revalidates inside the Serializable tx via the same tx client).
- Mirror identity + authority state bound into the canonical source revision (rollover/archival invalidates an outstanding preview).
- B11 fixtures + route R6 prove all year states fail before writes; sensitivity control (deactivate ? 409, reactivate ? 200) proves the gate is load-bearing.

### F2 — FacultySubject derived consistency
- `FacultySubjectSnapshot` + source revision now carry `gradeLevels`; set-valued arrays (gradeLevels, programScopes, allowedSpecializations, sectionIds) are canonicalized (sorted unique) in the revision while ordered term identities keep order.
- Apply derives exact sorted-unique gradeLevels from the resulting sectionIds via the SectionMirror mapping, updating sectionIds + gradeLevels atomically on insert/move/retire.
- B12 proves cross-grade insert ([7,8]), move (donor drops grade 8, recipient [8]), and retire (drops grade 8) plus replay leaves both arrays unchanged with zero writes.

### F3 — Mounted-route integration
- New `teaching-load-reconciliation-route.test.ts` (47 assertions): real app boot + real `authenticate` middleware + hand-signed JWTs. Own-school preview/apply succeed; numeric-string ids normalize to one fingerprint; missing/cross-school JWT ? 403; system token cannot preview/apply (401) but reads readiness; malformed ids ? 400; missing/archived/inactive years fail before writes; exact-fingerprint apply once + replay zero-write; zero-residue cleanup.

### Gates
- Server reconciliation 158/0 (was 134), route suite 47/0, client UI 5/5, server+client tsc clean, server+client production builds pass.
- Fresh live preview regenerated (contract changed): fingerprint `F0F29E217DF14EA8E87C0F38CD640D9943E5AE3DEC2A907765198A9216023BC0`, sourceRevision `247B8494D6049536BC606A147A1C37B4564B321E90CC59C30ECECE06298C6490`, byte SHA-256 (sidecar verified) `341D8A2B898C2B5F5277F6CCF076D87117789CAEBEDFA65B4A177729A00520BB`. Plan RETAIN 234 / MOVE 30 / RETIRE 1 / UNRESOLVED 0 (invariant 264=264, owned 264), cycle POPULATED v4, advisers 20/20, hg 0, applied:false. Prior fingerprint `0563926B…` marked NON_APPLICABLE.
- Changed-scope advisory review recorded under `docs/reviews/teaching-load-tlc02-one-shot-2026-09-09/`.

## TL-C02R2 — Complete active-year-set authority

Base candidate: `e9329d0efb659e3d8cd150c4286e04f257944959`. Same branch/worktree. No amend/rebase/merge/push or live apply.

### Authority correction
- `readSchoolYearAuthoritySnapshot` now uses only its supplied client to read both the requested same-school mirror and the complete same-school active, non-archived mirror set.
- Typed precedence: missing requested mirror → 404 `YEAR_MIRROR_NOT_FOUND`; requested archived → 409 `ARCHIVED_YEAR`; zero active mirrors → 409 `ACTIVE_YEAR_UNAVAILABLE`; multiple active mirrors → 409 `ACTIVE_YEAR_AMBIGUOUS`; one active mirror for a different requested year → 409 `INACTIVE_HISTORICAL_YEAR`.
- The returned snapshot is the resolved sole-active mirror, carries `authorityMode: SOLE_ACTIVE_NON_ARCHIVED`, and binds that authority plus mirror identity/state/version to the source revision and apply fingerprint.
- Apply repeats the same complete-set read through the supplied Serializable transaction client before comparing source revision or writing.

### Failing-first and negative controls
- RED against TL-C02R1 production code: reconciliation suite 162 passed / 4 failed, exactly `ACTIVE_YEAR_UNAVAILABLE` plus readiness/preview/apply `ACTIVE_YEAR_AMBIGUOUS`.
- Disposable fixtures prove a requested-row-only mutant would accept the two-active-mirror state, while the corrected service and mounted routes reject it.
- Ambiguous readiness, preview, and apply preserve exact ownership, `FacultySubject`, cycle, and audit counts and issue zero recorded writes. Deactivating/archiving the competing mirror restores the intended year.
- Source-revision controls prove changing the resolved sole-active mirror identity changes both source revision and fingerprint.

### Focused gates
- Server reconciliation: 168/168 (all prior 158 preserved; 10 authority assertions added), exit 0.
- Mounted reconciliation route: 54/54 (all prior 47 preserved; 7 authority assertions added), exit 0.
- Server `tsc --noEmit`, production build, and `git diff --check`: exit 0.
- No client gate run because the client contract did not change.

### Preview lifecycle and boundaries
- `teaching-load-current-year-reconciliation-preview-tlc02r1-2026-09-09.json` is preserved but has a `NON_APPLICABLE` marker. Its fingerprint and source revision authorize no mutation.
- No replacement live preview was generated. Final preview remains deferred until the separate department-label decision is settled because that apply changes reconciliation source revision.
- No live Teaching Load or department-authority data changed; no generation, publication, migration, restart, external-repository edit, or other-stream contact occurred.
- Fresh changed-scope advisory review G (`advisory-review-G-tlc02r2.md`): `zeroFix:true`, no material findings. Reviewer independently reproduced reconciliation 168/168, mounted route 54/54, server type-check/build, diff-check, error precedence, transaction-client closure, source-revision binding, mutant sensitivity, zero-write ambiguity handling, and the preview lifecycle boundary.

## TL-C02D — Apply Department Labels and Pin Fresh Reconciliation Preview

Prompt: `docs/prompts/teaching-load-department-authority-apply-tlc02d-2026-09-09.md` (+ `.sha256`, verified). Base: `b96b8ccd` (origin/main, contains `e62f784e`). Worktree: `D:\ATLAS-worktrees\teaching-load-dept-apply` on `work/teaching-load-dept-apply`. HIGH-risk bounded shared-data mutation authorized by the embedded operator approval of fingerprint `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`. Terminal verdict: `REVIEW_REQUIRED` (never GO). No push, no merge, no Teaching Load apply.

### Pre-action gate (all read-only, all passed)
- Prompt SHA-256 `F64800FDE33B37D37D99EE6DD69CDAD6448D7B84EE182014AFA1047374955BA6` matches its sidecar.
- Artifact `department-authority-apply-r4a.json` byte SHA-256 `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF` matches its sidecar; semantic hash of `.semanticPayload` recomputed via server `canonicalHash` = `EAF49D08141E9B2F37E685D1B94A93BEA1B66E7D620755C37CFAAC6E352950BE`; decision fingerprint `5147D2AD…`; approved preview fingerprint `D99894F1…`.
- DB target resolved from `atlas-server/.env`: host `localhost` (Postgres on Tailnet node `njgrm` / `100.88.55.125`), database `atlas_recovery_clean_rebuild_20260905` (required target). No credentials captured in artifacts.
- Actor: live `/auth/login` (identifier `1234501`, officer) then `/auth/me` → school 1, userId 46, role officer, authSource local.
- Active-year authority: exactly one active, non-archived `EnrollProSchoolYearMirror` for school 1 = year 8 / `2029-2030`.
- Current department authority: zero aliases + zero labels for school 1.
- Live preview `POST /faculty-assignments/department-authority/preview` (school 1, eight labels, `aliases: []`): HTTP 200, eight `create` / zero `conflict`, fingerprint `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`, sourceRevision `003539328945376ABB850D60D21AD8354DDB65312E252EF80FF316F9425B2C71` (0/0 rows) — exactly the artifact's expected revision.

### Focused suites run pre-apply (live school 1 still 0/0)
- department-authority-apply: 63/63 exit 0.
- department-authority-gates: 82/82 exit 0 (includes E9/E10 artifact binding and the live-school-1-untouched assertion).
- teaching-load-reconciliation: 168/168 exit 0.
- teaching-load-reconciliation-route: 54/54 exit 0.
- Server `tsc --noEmit` exit 0, production build exit 0 (clean worktree; the main checkout's `tsc` noise comes from untracked scratch files not in the committed tree).

### Authorized apply (exactly one production mutation)
`POST /faculty-assignments/department-authority/apply` with schoolId 1, eight approved labels, `aliases: []`, `expectedFingerprint` = approved `D99894F1…`, `expectedSourceRevision` = `00353932…` (fresh preview), `confirmationText: "APPLY DEPARTMENT AUTHORITY"`. HTTP 200. Receipt: created 8 labels / unchanged 0 / conflicting 0; before {0,0} → after {0,8}; `replayed:false`; `revalidatedInTransaction:true`; rollback limited to deletion of the exact eight `department_labels` rows (school 1, codes AP/ENG/ESP/FIL/MAPEH/MATH/SCI/TLE). Rollback recipe recorded, NOT executed.

### Post-action verification
- Persisted (read-only): DepartmentAlias count 0; DepartmentLabel count 8 with exact pairs AP=Araling Panlipunan, ENG=English, ESP=Edukasyon sa Pagpapakatao, FIL=Filipino, MAPEH=MAPEH, MATH=Mathematics, SCI=Science, TLE=Technology and Livelihood Education.
- Fresh preview re-run: eight `unchanged`, zero `create`, zero conflicts; new sourceRevision `0B021EB20CC48144431B55E6AAAE4448CC89E48CDB02A7B69721073287939C39`; new fingerprint `E0F98B90934EBF599ED0AFD0780E6487D85C2E1377339E33E24A833811D48C4D`.
- Idempotent replay via the same production apply route with the FRESH fingerprint/revision: HTTP 200, `replayed:true`, created 0 / unchanged 8, before {0,8} after {0,8}, `revalidatedInTransaction:true`.
- Non-department invariants unchanged (see deterministic signature method below). No Teaching Load ownership, FacultySubject, cycle, curriculum, run, or publication mutation.

### Deterministic non-department invariant signature (TL-C02D evidence basis)
Method (reproducible): Prisma read-only on school 1 / year 8; `FacultySubject` rows normalized to `{facultyId, subjectId, version, gradeLevels[], sectionIds[]}` with arrays sorted ascending numerically and rows sorted by (facultyId, subjectId, version); `SubjectSectionOwnership` rows normalized to `{facultySubjectId, facultyId, subjectId, sectionId, specializationCode}` sorted by (facultySubjectId, subjectId, sectionId, facultyId); each set hashed with the server's `canonicalHash` (SHA-256 over recursively key-sorted canonical JSON).
- FacultySubject: count 88, hash `80128C7620DB34ACFC212384B08752D0CF6CA5E72DC342290132E73BE9A4834A`; max createdAt/updatedAt `2026-09-07T00:23:47.201Z/.203Z` (pre-apply, proving zero post-apply touch).
- SubjectSectionOwnership: count 265, hash `4FC60A3871DEE833CD8AE4FE3C2CAAA46F4A1BF6F4E67A1AF0AAC878C7BB3927`; max createdAt/updatedAt `2026-09-07T00:23:47.202Z` (pre-apply).
- TeachingLoadCycle: id 1, state POPULATED, version 4, updatedAt `2026-09-07T00:23:47.205Z`.
- SchoolYearTermConfig id 71 (termCount 3, active); SchoolYearOffering 216 (all active); OfferingTermAssignment 96.
- EnrollProSchoolYearMirror: sole active non-archived = year 8 / 2029-2030.
- GenerationRun 0 (school total and year 8); PublishedScheduleRevision 0 (school total and year 8).

### Fresh Teaching Load reconciliation preview (zero write)
- Readiness `GET /faculty-assignments/reconciliation/readiness?schoolId=1&schoolYearId=8`: HTTP 200, ready false with sole blocker `TL_RECONCILIATION_PENDING` (30 proposed moves not yet applied), demandCount 264, ownedDemandCount 264, unresolvedDemand 0, validOwnership 234.
- Preview `POST /faculty-assignments/reconciliation/preview` `{schoolId:1, schoolYearId:8}`: HTTP 200. Endpoint fingerprint `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`; sourceRevision `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`; generatedAt `2026-09-09T14:10:50.736Z`; plan RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0 (invariant 264 = 264 demand; owned 264 ≤ 264); classification VALID_RETAIN 264 / OUTSIDE_CURRICULUM 1; cycle POPULATED → POPULATED v4; advisers 20/20 satisfied; HG found 0; departmentAuthority CONFIGURED (0 aliases / 8 labels, revision `0B021EB2…`); zeroWriteProof {preview true, writes 0}; `authorizesMutation` false.
- Post-preview read-only signature recapture identical to the pre-apply baseline for every non-department model (labels are the only added rows) → preview executed zero writes.
- All older TL-C02 / TL-C02R / TL-C02R1 preview fingerprints remain `NON_APPLICABLE` (markers preserved); never reused.
- Durable artifact `docs/verification/teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json` (+ `.sha256`): byte SHA-256 `0BBAC2BC532CBD884D41A015C87533036744EDFCBD6BBADA77E8ACF74FCA3BE9`; `applied:false`; `authorizesNoMutation:true`; embeds endpoint fingerprint, source revision, full preview payload, and the future approval sentence.

### TL-C02D advisory review H (post-action)
`docs/reviews/teaching-load-tlc02-one-shot-2026-09-09/advisory-review-H-tlc02d-post-action.md` — fresh reviewer did not perform the apply. Verdict: `zeroFix:false` (NO-GO) on ONE documentation-grade finding: the first-pass invariant hash literals (`CD8BA55B…`, `9132BC87…`) used an under-specified row ordering and were not reproducible by an independent method. Data-level checks all PASSED (counts, cycle, offerings, term config, mirrors, runs, published, persisted label inventory, readiness, preview artifact binding, Git boundary). Fix (documentation only): replaced the under-specified literals with the fully deterministic method and recomputed hashes recorded in this ledger (FS `80128C76…`, SSO `4FC60A38…`) plus max-updatedAt immutability proof; reviewer H independently recomputed exactly those same literals from persisted data, and changed-scope reviewer I then verified the documented deterministic method reproduces them. No source change; no second live mutation.

## TL-C02E — Apply Current-Year Teaching Load Reconciliation (authorized bounded apply)

Prompt: `docs/prompts/teaching-load-reconciliation-apply-tlc02e-2026-09-09.md` (+ `.sha256`, verified: prompt blob SHA-256 `29E73193C93ED37267341557A2FEFB902DF307D9874AB340117681158AA75E35`). Base: `0522c816` (origin/main; contains `5020050b`). Worktree: `D:\ATLAS-worktrees\teaching-load-apply` on `work/teaching-load-apply`. HIGH-risk bounded shared-data mutation authorized by the embedded operator approval binding fingerprint `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`, source revision `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`, plan RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0, and artifact byte SHA-256 `0BBAC2BC…`. Terminal verdict: `REVIEW_REQUIRED` (never GO). No merge, no push.

### Pre-action gate (all read-only, all passed)
- Prompt SHA-256 verified against sidecar (blob `29E73193…`).
- Approved preview artifact git blob byte SHA-256 `0BBAC2BC532CBD884D41A015C87533036744EDFCBD6BBADA77E8ACF74FCA3BE9` verified; `applied:false`; `authorizesNoMutation:true`. (Working-tree byte hash differs only from CRLF checkout; committed LF blob is the bound byte identity.)
- DB target resolved from `atlas-server/.env`: host `localhost` (Tailnet node), database `atlas_recovery_clean_rebuild_20260905` (required). No credentials captured.
- Actor: live `/auth/login` (identifier `1234501`, officer) → `/auth/me` → school 1, userId 46, role officer, authSource local.
- Active-year authority: exactly one active, non-archived `EnrollProSchoolYearMirror` for school 1 = year 8 / `2029-2030` (id 1, mirror enrollProSchoolYearId 8).
- Department authority pre-apply: 0 aliases / 8 labels; canonical revision hash `0B021EB20CC48144431B55E6AAAE4448CC89E48CDB02A7B69721073287939C39`.
- Pre-apply deterministic signature baseline (read-only): `SubjectSectionOwnership` count 265 hash `4FC60A3871DEE833CD8AE4FE3C2CAAA46F4A1BF6F4E67A1AF0AAC878C7BB3927` maxUpdatedAt `2026-09-07T00:23:47.202Z`; `FacultySubject` count 88 hash `80128C7620DB34ACFC212384B08752D0CF6CA5E72DC342290132E73BE9A4834A`; TeachingLoadCycle id 1 POPULATED v4 updatedAt `2026-09-07T00:23:47.205Z`; audit max id 250 (includes probe `LOCAL_LOGIN_SUCCESS` rows); offerings active 216; OfferingTermAssignment 96; sections 20; active subjects 22; active faculty 42; GenerationRun 0; PublishedScheduleRevision 0. Matches the TL-C02D deterministic method exactly.
- Live readiness pre-apply: HTTP 200, ready false, sole blocker `TL_RECONCILIATION_PENDING`, demand 264, owned 264, unresolved 0, validOwnership 234.
- Live preview pre-apply: HTTP 200; fingerprint `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`; sourceRevision `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`; plan RETAIN 234 / MOVE 30 / RETIRE 1 / UNRESOLVED 0; demand 264; advisers 20/20; HG 0; unmapped 0; 16 configured section grade/program scopes; cycle POPULATED → POPULATED v4; departmentAuthority CONFIGURED `0B021EB2…`; `zeroWriteProof {preview:true, writes:0}`; `authorizesMutation:false`. Preview POST was proven zero-write by byte-identical pre/post-preview signature capture (the only new audit rows were `LOCAL_LOGIN_SUCCESS` 248/249 from the probe's own logins).

### Authorized apply (exactly one production mutation)
`POST /faculty-assignments/reconciliation/apply` `{schoolId:1, schoolYearId:8, expectedFingerprint: F78595BD…, expectedSourceRevision: 90EC8084…, confirmationText: "APPLY TEACHING LOAD RECONCILIATION"}`. HTTP 200. Receipt: fingerprint `F78595BD…`; inserted 0; moved 30; retired 1; retained 234; unresolved 0; hgRemoved 0; affectedFacultyIds 42; ownershipIdsWritten 31; facultySubjectIdsWritten 61; operationId 252; `replayed:false`; `revalidatedInTransaction:true`. One nonzero reconciliation audit operation ID (252).

### Post-action verification (read-only)
- Ownership count 265 → 264; 264 unique demanded subject-section pairs; 0 outside-curriculum rows remaining; retired pair `19:102` (STE_RESEARCH, faculty 36) removed.
- Plan conformance: all 30 MOVE pairs now owned by the preview `proposedFacultyId`; all 234 RETAIN pairs unchanged; 0 mismatches; 0 inserts.
- FacultySubject derived parity: recomputed `sectionIds`/`gradeLevels` from resulting ownership via SectionMirror externalId→displayOrder for all 94 active keys → 0 issues; 0 dangling/cross-school references.
- Cycle POPULATED, id 1, version 4 → 5 (authorized refresh only); updatedAt `2026-09-09T15:15:36.746Z`.
- Audit: exactly one `TEACHING_LOAD_RECONCILIATION` row (id 252, actor 46) = the apply receipt operationId. `LOCAL_LOGIN_SUCCESS` auth rows (250/251 = probe logins at apply time; 248/249 = earlier probe logins; 253-257 = post-apply preview/replay logins) disclosed separately as authentication audit effects.
- Protected-domain invariants byte/semantic-equivalent pre vs post: department 0 aliases / 8 labels / revision `0B021EB2…`; active subjects 22; sections 20; term config id 71 (3 terms); active offerings 216; OfferingTermAssignment 96; GenerationRun 0; PublishedScheduleRevision 0; year mirror sole-active year 8 unchanged; active faculty 42. Touch-time probe: only ownership/FacultySubject/cycle updatedAt moved to `2026-09-09T15:15:36Z`; every protected model max timestamp unchanged from its pre-apply value.
- Post-apply readiness: HTTP 200, `ready:true`, demand 264, owned 264, unresolved 0, validOwnership 264, blockers [], acceptedExceptions 0.
- Post-apply preview: HTTP 200; fresh fingerprint `587FD51E4CD018ACF35900D1419FF5BA02BD45C8720E45869EFB9C1164B3E15E`; sourceRevision `BAA0044EAAE2295C21F5A07CF31AAA14A08952752736ADC979512810E8496A4A`; all 264 RETAIN, 0 INSERT/MOVE/RETIRE/UNRESOLVED; HG 0; unmapped 0; advisers 20/20; distribution zeroLoad 0 / adviserOnly 0 / belowStandard 38 / atStandard 4 / excess 0 / overCap 0.

### Idempotent replay (zero-write proof)
`POST /faculty-assignments/reconciliation/apply` with the FRESH post-apply fingerprint `587FD51E…` / revision `BAA0044E…`. HTTP 200; `replayed:true`; retained 264; inserted/moved/retired/unresolved 0; `affectedFacultyIds`/`ownershipIdsWritten`/`facultySubjectIdsWritten` all empty; operationId 0; `revalidatedInTransaction:true`. Ownership, FacultySubject, cycle, department, curriculum, subject, section, run, and published-revision signatures byte-identical pre vs post replay (only disclosed `LOCAL_LOGIN_SUCCESS` rows from the replay probe's login). Rollback package derived from the pre-apply snapshot was recorded but NOT executed (any rollback needs a new explicit operator instruction).

### Focused suites
- teaching-load-reconciliation: 168/168 exit 0.
- teaching-load-reconciliation-route: 54/54 exit 0.
- department-authority-gates: 82/82 exit 0 (E9 artifact byte-hash passes against the committed LF blob; fresh-worktree CRLF checkout normalized to the repository byte identity before the run).
- department-authority-apply: 63/63 exit 0.
- Server `tsc --noEmit` exit 0; server production build exit 0; `git diff --cached --check` clean.
- No historical recovery, unrelated client, or broad timetable suites run (per prompt).

### Generation-readiness baseline (read-only)
Durable artifact `docs/verification/generation-readiness-post-tlc02e-2026-09-09.json` (+ `.sha256`); `authorizesNoMutation:true`. Records: reconciliation readiness ready true / demand 264 / owned 264 / valid 264; generation run count 0; timetable unassigned-workflow summary (552 lines / 2760 sessions, insertionReady 552, unresolved 0, cycle v5, curriculum 216, sections 20, HG excluded 0); curriculum readiness ready true (216, 16 scopes CONFIGURED); effective Teaching Load POPULATED v5 (264 assignments, 0 synthetic placeholders); subjects 22 active; sections 20; buildings 8 / rooms 103 / teaching rooms 98; runtime context aligned drift with `upstream.reachable:false` (EnrollPro timeout → dashboard `using_saved_data`), recorded as a data/source-authority gap (NOT caused by this apply). Planner QA corrected the blocker matrix after review: because 0 generation runs exist, hard-constraint outcomes and generated assigned/unassigned session totals are `NOT_EVALUATED_UNTIL_CANONICAL_GENERATION`, not proven empty. The 552 individually previewable demand lines are input-readiness evidence only and do not prove joint feasibility. The artifact authorizes no generation or publication.

### Planner QA correction
Formal QA independently reproduced the live Teaching Load post-state and reran the three decisive reconciliation/route/department-gate suites (168/168, 54/54, and 82/82), accepted the reconciliation apply, and corrected the readiness artifact's overstatement that zero hard constraints and zero unassigned demand had already been proven. The executor's separate 63/63 department-authority apply result remains recorded above but was not rerun in this planner pass. No source, runtime, or database state changed. The corrected artifact byte SHA-256 is recorded by its updated sidecar.

### Independent review J (formal, post-apply)
`docs/reviews/teaching-load-tlc02-one-shot-2026-09-09/advisory-review-J-tlc02e.md` — fresh independent reviewer did not perform the apply. Execution-system reviewer handle `ses_f7936c373ffeGITH29zkoN97At` (parent-relayed, verbatim). Independently verified: durable artifact byte hashes vs sidecars (apply artifact `E8D891B5…`, pre-correction readiness artifact `34DC0675…`, prompt blob `29E73193…`); live DB post-state (ownership 264/unique 264/FS 94/faculty 42; independent demand expansion 216 offerings × 20 sections = 264; symmetric diff vs ownership 0; derived FacultySubject parity 0 issues; cycle POPULATED v5; exactly 1 `TEACHING_LOAD_RECONCILIATION` audit id 252; protected invariants all match); live readiness (ready true / 264 / valid 264 / no blockers); live post-apply preview (fingerprint `587FD51E…`, RETAIN 264, distribution 0/0/38/4/0/0, advisers 20/20); replay receipt (replayed true, retained 264, empty write arrays, operationId 0) and replay zero-write signature identity; Git boundary (clean tree, HEAD == base `0522c816`, base contains `5020050b`, no merge/push). Verdict: `zeroFix:true`, `ACCEPT`. Reviewer logins wrote only `LOCAL_LOGIN_SUCCESS` auth rows (disclosed). Planner QA retained the review's data/apply evidence but superseded its interpretation of unrun generator outcomes in the correction above.

### TL-C02E evidence files (committed)
- `docs/verification/teaching-load-reconciliation-apply-tlc02e-2026-09-09.json` + `.sha256` (byte SHA-256 `E8D891B5D74CE9C12EAB168BEA1E5690EAAA8EB84103D9518E642370B680B8F3`)
- `docs/verification/generation-readiness-post-tlc02e-2026-09-09.json` + `.sha256` (planner-corrected byte SHA-256 `C2BE51AAD1F200ABBE783F427CF6CDD0CC06611974DD601388BBBD1D146228A4`)
- Ledger TL-C02E section (this file) + `CHANGELOG.md` entry.
- Reviewer artifact `advisory-review-J-tlc02e.md` (reviewer-authored).
