# TL-C02 One-Shot â€” Complete Active-Year Teaching Load Reconciliation â€” Progress Ledger

Plan source: user prompt TL-C02 (2026-09-09). One-shot execution, 180-minute budget.
Status: `REVIEW_REQUIRED` is the max terminal state; formal GO is out of scope.
Base SHA: `330fb91b7daa28299520272b1e258cc49395af04` (origin/main). Worktree: `D:\ATLAS-worktrees\teaching-load-tlc02` on `work/teaching-load-tlc02`.

Authority rules: Curriculum demand comes ONLY from persisted SchoolYearOffering + term config + SectionMirror + Subject catalog. HG never becomes demand/ownership/minutes/slots. Advisory credit only from effective policy. Departments from persisted authority only. No live apply.

## Phase 0 â€” Preflight and live baseline

- T0.1 Read mandatory docs (AGENTS.md, KI, phasePlan.md, runtime map, TL-C01 and core-readiness progress ledgers). DONE.
- T0.2 Worktree `D:\ATLAS-worktrees\teaching-load-tlc02` created clean at base `330fb91b...`. DONE.
- T0.3 Dependency install (npm ci server + client) â€” DONE (background).
- T0.4 Production-path mapping via two explore agents. Canonical decision:
  - Curriculum Requirements = persisted `SchoolYearOffering` + `SchoolYearTermConfig` + `OfferingTermAssignment` (216 rows, term config id 71 live).
  - `offering-demand-resolution.service.ts` is the documented SHADOW demand module with zero production importers â€” candidate to be wired as the canonical demand projector (production consumer added by this prompt).
  - `teaching-load-automation.service.ts autoFill` is the current suggestion path but does NOT consult curriculum requirements.
  - `allocation.service.ts`, `qualification-evaluator.service.ts`, `teaching-load-readiness.service.ts` are orphaned.
  - Fingerprint/apply pattern to follow: `department-authority.service.ts` (canonicalHash, source revision, Serializable, confirmation, idempotent replay).
- T0.5 Live read-only census â€” BLOCKED until Phase 1 snapshot reads implemented; will be captured via the preview artifact and a read-only probe. Census facts per prompt: school 1, year 8 (2029-2030), 20 sections, 22 active subjects, 216 requirements, term config 71, 265 ownerships, 42 active faculty, readiness 16/16, runs 0, published 0.

## Phase 1 â€” Canonical demand graph

- T1.1 Design demand expansion from offerings Ã— sections (base grade+program scope, section override, cohort override), term applicability (ALL / ROTATING via term assignments), rotation family, persisted minutes. DONE (design in service).
- T1.2 Implement in `teaching-load-reconciliation.service.ts` (`expandCurriculumDemand`). IN PROGRESS.

## Phase 2 â€” Consolidated production reconciliation path

- T2.1 New canonical service implements classify â†’ plan (retain/insert/move/retire/unresolved) â†’ sequential simulated load â†’ adviser preference â†’ rebalance â†’ fingerprint. Wired to new routes `POST /faculty-assignments/reconciliation/{preview|apply}` + `GET /faculty-assignments/reconciliation/readiness`. IN PROGRESS.

## Phase 3 â€” Secure preview/apply contract

- T3.1 Preview zero-write; fingerprint binds source revisions + full plan; apply in one Serializable transaction with in-tx revalidation, typed 409 on drift, idempotent, audit, cycle refresh, never touches curriculum/subjects/sections/generation/publication. Disposable-fixture tests only. IN PROGRESS.

## Phase 4 â€” Teaching Load UX completion

- T4.1 Reconciliation panel in Teaching Load page consuming preview/readiness; one primary action; approval boundary; adviser-preference indicator; UNMAPPED filter; no negative remaining; excess teaching; mobile/keyboard. IN PROGRESS.

## Phase 5 â€” Consumer and readiness closure

- T5.1 Effective contract excludes HG rows (ownershipIndex HG filter); effective contract preserves external ids + term/rotation metadata. Readiness reports ready only when demand coverage complete or typed exception. IN PROGRESS.

## Phase 6 â€” Focused verification

- T6.1 Focused gates (16 listed in prompt) as failing-first tests. PENDING.

## Phase 7 â€” Live read-only reconciliation preview

- T7.1 Produce `docs/verification/teaching-load-current-year-reconciliation-preview-2026-09-09.json` + `.sha256`. PENDING.

## Phase 8 â€” Internal adversarial reviews

- T8.1 Reviewer A (authority/data-integrity) â€” artifact `advisory-review-A.md`, `zeroFix:false`:
  material A1: hard-cap gate in `pickCandidate` used offering `weeklyMinutes` while simulated load credits `subject.minMinutesPerWeek`; a smaller offering value could slip a faculty over the cap. FIXED: gate now uses the credited minutes; regression test A10 added (86/86). Also added `specializationAliases` to the source revision hash and made `loadHgSubjectIds` case-insensitive.
- T8.2 Reviewer B (UX/integration) â€” artifact `advisory-review-B.md`, `zeroFix:false`: required minor B-1 (Apply/Preview/Reconcile controls below 44px). FIXED: h-11 controls.
- T8.3 Fresh changed-scope reviewer C â€” artifact `advisory-review-C.md`, `zeroFix:true`. Five adversarial probes pass; no material findings in the changed scope.
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
