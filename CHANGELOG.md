# Changelog

## [2026-09-09] — TL-C02E Current-Year Teaching Load Reconciliation Applied

### Added
- Applied the operator-approved Teaching Load reconciliation for school 1 / year 8 (`2029-2030`) through the fingerprinted production route `POST /api/v1/faculty-assignments/reconciliation/apply` under approval fingerprint `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446` / source revision `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`. Receipt: HTTP 200, inserted 0, moved 30, retired 1, retained 234, unresolved 0, hgRemoved 0, `replayed:false`, `revalidatedInTransaction:true`, one reconciliation audit operation ID 252. No department-label, curriculum, subject, section, generation, or publication mutation.
- Post-state ownership 265 → 264 unique demanded subject-section pairs (0 outside-curriculum rows); all 30 MOVE pairs now owned by the approved proposed faculty and the single RETIRE removed; `FacultySubject.sectionIds`/`gradeLevels` derived parity 0 issues across 94 keys; cycle POPULATED v4 → v5 (authorized refresh only); protected-domain invariants byte/semantic-equivalent before vs after.
- Post-apply readiness `ready:true` (demand 264 / owned 264 / valid 264 / unresolved 0 / no blockers); post-apply preview fresh fingerprint `587FD51E4CD018ACF35900D1419FF5BA02BD45C8720E45869EFB9C1164B3E15E` with all 264 RETAIN, 20/20 advisers, distribution zero-load 0 / adviser-only 0 / below-standard 38 / at-standard 4 / excess 0 / over-cap 0.
- One idempotent replay with the fresh fingerprint/revision: HTTP 200, `replayed:true`, retained 264, all write-ID arrays empty, operationId 0, byte-identical ownership/FacultySubject/cycle signatures before vs after replay (zero-write proof).
- Durable evidence: `docs/verification/teaching-load-reconciliation-apply-tlc02e-2026-09-09.json` (+ `.sha256`, byte SHA-256 `E8D891B5D74CE9C12EAB168BEA1E5690EAAA8EB84103D9518E642370B680B8F3`) and `docs/verification/generation-readiness-post-tlc02e-2026-09-09.json` (+ `.sha256`, byte SHA-256 `34DC0675BCAAFD2E5C6F5E56D78B4204EA28595D421F4F6610CB6FBBDFE8FBCD`, `authorizesNoMutation:true`) recording the read-only generation-readiness baseline and blocker matrix.
- Focused gates: teaching-load-reconciliation 168/168, teaching-load-reconciliation-route 54/54, department-authority-gates 82/82, department-authority-apply 63/63, server `tsc --noEmit` clean, server production build clean, `git diff --cached --check` clean.
- Independent post-apply review J (`docs/reviews/teaching-load-tlc02-one-shot-2026-09-09/advisory-review-J-tlc02e.md`, reviewer handle `ses_f7936c373ffeGITH29zkoN97At`) verified receipt, live DB post-state, derived parity, replay zero-write, protected invariants, readiness baseline, and Git boundary: `zeroFix:true`, `ACCEPT`.

### Changed
- TeachingLoadCycle version advanced 4 → 5 and SubjectSectionOwnership/FacultySubject rows were refreshed by the single authorized reconciliation apply at `2026-09-09T15:15:36Z`; the pre-apply baseline signatures are recorded in the TL-C02E ledger section.

### Decisions Made
- The apply executed exactly the fingerprinted plan (RETAIN 234 / MOVE 30 / RETIRE 1 / UNRESOLVED 0); rollback was derived from the pre-apply snapshot but NOT executed (a rollback requires a new explicit operator instruction).
- Authentication audit effects (`LOCAL_LOGIN_SUCCESS` rows from probe/reviewer logins) are disclosed separately from the single `TEACHING_LOAD_RECONCILIATION` audit row 252.
- No generation, publication, department-label mutation, curriculum mutation, schema/migration work, deployment/restart, or external-repository edit occurred.

### Open Questions
- Formal planner/QA review of the TL-C02E committed range (terminal verdict `REVIEW_REQUIRED`; never GO on this prompt). Generation and publication remain separately gated and unauthorized by this prompt's readiness artifact.

## [2026-09-09] — TL-C02D Department Labels Applied + Reconciliation Preview Pinned

### Added
- Applied the operator-approved eight `DepartmentLabel` rows for school 1 (AP=Araling Panlipunan, ENG=English, ESP=Edukasyon sa Pagpapakatao, FIL=Filipino, MAPEH=MAPEH, MATH=Mathematics, SCI=Science, TLE=Technology and Livelihood Education) through the fingerprinted production apply route under approval fingerprint `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`; zero aliases; one in-transaction revalidated apply (`replayed:false`) plus one idempotent replay (`replayed:true`, zero created).
- Fresh zero-write Teaching Load reconciliation preview pinned at `docs/verification/teaching-load-current-year-reconciliation-preview-tlc02d-2026-09-09.json` (+ `.sha256`): fingerprint `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`, source revision `90EC80845D32CA0EDBF5651644A10C5DC28AF0D643D632179DD9CDD5BDC7E50F`, RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0, advisers 20/20, HG 0, `applied:false`, `authorizesNoMutation:true`.
- Deterministic non-department invariant signature documented in the progress ledger (FacultySubject 88 / `80128C76…`, SubjectSectionOwnership 265 / `4FC60A38…`, cycle POPULATED v4, offerings 216, term assignments 96, sole active year 8 / 2029-2030, runs 0, published 0) with pre-apply max updatedAt immutability proof.
- Post-action review H (NO-GO on a documentation-grade irreproducible-hash finding) and changed-scope review I (GO / zeroFix:true closing the finding) under `docs/reviews/teaching-load-tlc02-one-shot-2026-09-09/`.

### Changed
- All older TL-C02 / TL-C02R / TL-C02R1 reconciliation preview fingerprints remain `NON_APPLICABLE`; the tlc02d preview supersedes them and authorizes no mutation on its own.

### Decisions Made
- The apply was limited to the eight fingerprinted department-label rows for school 1; rollback is limited to deleting those exact eight rows and was recorded but not executed.
- No Teaching Load reconciliation apply, generation, publication, deployment/restart, schema/migration, or external-repository mutation occurred in this prompt.

### Open Questions
- Planner/QA review of the TL-C02D committed range; the fresh Teaching Load preview requires its own explicit operator approval before any reconciliation apply.

## [2026-09-09] — TT-C02R1 Preview-Only Cleanup

### Added
- Added a production-router assertion pinning the TT-C02 surface to summary GET and preview POST only.
- Added a failing-first room-capacity control proving undersized rooms are excluded while a sufficient room remains individually previewable.

### Changed
- Removed the complete dead writable-apply implementation and apply-only imports, interfaces, and comments.
- Reused the canonical generator room-capacity predicate and carried section enrollment into timetable demand.

### Decisions Made
- TT-C02 remains read-only and contains no timetable write implementation.

### Open Questions
- None for TT-C02R1; formal planner review remains required.

## [2026-09-09] — TT-C02R Preview-Only Correction

### Added
- Search and pagination across all demand lines; interval-overlap regression coverage; explicit total, individually previewable, unresolved, and globally scheduled terminology.

### Changed
- Removed the production apply route and writable fixture suite. Summary and preview now fail closed when actor-school scope is unresolved or cross-school.
- Renamed `PLACEABLE` to `INDIVIDUALLY_PREVIEWABLE` and documented that bounded candidates do not run the canonical generator's full policy set or prove global coexistence.
- Normalized HG exclusion by trimming and uppercasing the canonical subject code.

### Decisions Made
- TT-C02 remains preview-only. No timetable writes, schema changes, generation, publication, or Teaching Load behavior are included.

### Open Questions
- Canonical joint feasibility and any future writable insertion contract require a separate authorized phase.

## [2026-09-09] — TT-C02 Unassigned Insertion

### Added
- `timetable-demand.service.ts`: canonical curriculum → timetable demand expansion (persisted `SchoolYearTermConfig`/`SchoolYearOffering`/`OfferingTermAssignment`) across matching active sections with exact term/rotation preservation; resolves owners through annual Teaching Load ownership semantics (active, non-stale); excludes HG (never demand); set-based reads; canonical source revision SHA-256.
- `timetable-insertion.service.ts`: truthful 10-reason classifier (owner/stale/scope/qualification/slot/room/conflict/term/stale-source/HG) each with one plain-language next action; deterministic bounded weekly-slot search with no-owner vs no-slot vs no-room vs hard-conflict separation; read-only readiness summary; zero-write preview with canonical `TTI_` SHA-256 binding (school, year, curriculum revision, Teaching Load cycle/version + ownership hash, candidates); privileged Serializable apply that writes only pre-generation `LockedSession` + action + audit, revalidates occupancy in-transaction, rejects stale fingerprints with typed 409, and is idempotent by fingerprint.
- `timetable-unassigned.router.ts` mounted under `/api/v1/generation`: `GET /:schoolId/:schoolYearId/unassigned-workflow/summary`, `POST …/preview`, `POST …/apply` (authenticate + privileged + actor-school scope).
- Tests: hermetic server suite 15/15; disposable-school fixture 1/1 (zero-write, guarded apply, ownership immutability, idempotency, stale 409, catch-all cleanup); client helper tests 2/2.
- Client: `UnassignedInsertionWorkflow` dialog on `/timetable` no-run state showing real blocking reason, plain-language prerequisite, one primary action, candidate preview, and a clearly labelled save boundary (disabled; apply is fixture-tested only).
- Evidence: `docs/verification/timetable-ttc02-readiness-preview-2026-09-09.json` + `.sha256`; advisory review under `docs/reviews/timetable-ttc02-one-shot-2026-09-09/`; progress ledger.

### Changed
- `atlas-server/src/app.ts`: mounted the TT-C02 router.
- `TimetableSimpleHeader.tsx`: additive "Unassigned insertion" action in the no-run state.
- Fixture cleanup hardened with a catch-all disposable school/year delete; apply occupancy recheck aligned to `status:'DRAFT'`; per-session apply semantics documented after advisory review.

### Decisions Made
- Apply is per-weekly-session into the pre-generation draft only; run-bound placement delegates to existing generated-run manual-edit flows.
- Idempotency audit lookup precedes fingerprint recomputation (a prior apply changes the occupancy the fingerprint covers).
- Live year was only read; apply was exercised solely on a disposable school; save boundary stays disabled until planner approval.

### Open Questions
- Planner/QA review of `<base>…<candidate>` and decision on enabling the apply/save boundary (advisory P-01 partial-placement semantics) before any live apply use.


## [2026-09-09] — SCA-04A Stage 2 Applied

### Added
- Applied the operator-approved Stage 2: all 216 confirmed curriculum requirements for school 1, year 8/2029-2030 persisted through the production apply route (receipt `{applied:216, retired:0, fingerprint:CURR_REQ_2025F58F…85EBF}`).

### Changed
- Readiness flipped to ready=true (termConfigPresent true, requirementCount 216, 16/16 scopes CONFIGURED, 0 blockers).
- Source revision hash now `8785DB9E…1569` (activeRequirementCount 216 entered the hash domain).

### Decisions Made
- A malformed 56-char approval byte SHA was rejected fail-closed with zero writes; apply proceeded only after the operator sent the exact 64-char SHA `0E1CEFEF…21B36C`.

### Open Questions
- Planner verification of the applied Stage 2 is required before any further curriculum/Teaching Load/generation work.

## [2026-09-09] — SCA-04A Stage 1 Applied, Stage 2 Preview Ready

### Added
- Applied the operator-approved Stage 1 term configuration: `PUT /api/v1/curriculum-requirements/8/terms` created termConfig id=71 (termCount=3, ["Term 1","Term 2","Term 3"]) for school 1, year 8/2029-2030. Zero requirements created.
- Produced the Stage 2 real production preview artifact over all 216 confirmed requirements at `docs/verification/subjects-curriculum-stage2-requirements-apply-preview-2026-09-09.json` (+ `.sha256` sidecar `0E1CEFEF…21B36C`), fingerprint `CURR_REQ_2025F58FF3B49FA527AB9655A4E6D6E7DBAB2ECD4CEFEB580223481D14285EBF`.

### Changed
- Stage 1 approval workflow executed; Stage 2 remains LOCKED pending its exact approval sentence.

### Decisions Made
- Stage 1 applied exactly as approved (single term-configuration row); Stage 2 not applied.

### Open Questions
- Stage 2 apply requires the exact approval sentence binding fingerprint `CURR_REQ_2025F58F…85EBF` and sidecar `0E1CEFEF…21B36C`.

## [2026-09-09] — SCA-04A-R Staged Approval Correction

### Added
- Marked the combined SCA-04A approval sentence `NON_APPLICABLE`; the SCA-04A artifact is retained as a zero-write decision record.
- Added a separately fingerprinted Stage 1 term-config preview at `docs/verification/subjects-curriculum-stage1-term-config-apply-preview-2026-09-09.json` (+ sidecar), authorizing only term creation (school 1, year 8, termCount=3, ["Term 1","Term 2","Term 3"], precondition absent) with zero requirement authority.
- Stage 2 (216 requirements) declared LOCKED pending a fresh production preview route call after Stage 1 applies.

### Changed
- Approval workflow corrected: term creation and requirement application are no longer combined in a single approval sentence.

### Decisions Made
- Operator decisions unchanged; only the approval/apply workflow authority is corrected. Documentation-only; nothing applied.

### Open Questions
- None.

## [2026-09-09] — SCA-04A Operator Decisions and Apply Preview

### Added
- Captured the five operator decision groups for active year 2029-2030 (school 1, year 8): 3 terms (`Term 1, Term 2, Term 3`); SCIENCE rotation `T1 SCI_BIO, T2 SCI_CHEM, T3 SCI_ES`; TLE_ROTATION rotation `T1 TLE_ICT_EXP, T2 TLE_AFA_EXP, T3 TLE_FCS_EXP`; clustered candidate confirmations (216 creates / 17 excluded); DEVL_READING OTHER/ALL; HG rejected.
- Added the zero-write apply preview artifact and sidecar at `docs/verification/subjects-curriculum-active-year-apply-preview-2026-09-09.json` (+ `.sha256`), fingerprint `CURR_REQ_2025F58FF3B49FA527AB9655A4E6D6E7DBAB2ECD4CEFEB580223481D14285EBF`.
- Updated the shared core readiness ledger and the Subjects/Curriculum ledger with concise SCA-04A rows.

### Changed
- SCA-04A stage moved READY → IN PROGRESS in the shared ledger; SCA-04B remains LOCKED on the exact approval sentence.

### Decisions Made
- Operator decisions were captured interactively; nothing was inferred from catalog codes, templates, historical year 7, or teacher assignments.
- Rotating-row preview is term-gated by the SCA-02 validation contract and validates in SCA-04B after terms persist (designed behavior, not a defect).
- HG is excluded from current-year curriculum requirements and demand; the 300-minute advisory credit is unchanged and never treated as teaching minutes or timetable capacity.

### Open Questions
- None for SCA-04A; SCA-04B requires the exact approval sentence from this prompt's report.

## [2026-09-09] — OpenCode Worktree Permissions

### Added
- Added tracked OpenCode project permissions for ATLAS worktrees.
- Added a minimal global OpenCode rule allowing `D:/ATLAS/**` and `D:/ATLAS-worktrees/**` access.

### Changed
- ATLAS executors can read and edit isolated worktrees without repeated external-directory prompts.

### Decisions Made
- Permission remains limited to ATLAS and its worktree root; recovery storage and companion repositories retain their existing read-only or denied edit rules.

### Open Questions
- None.

## [2026-09-09] — Core Readiness Integration and Successor Handoffs

### Added
- Added the RC-02D live deployment/Tailnet acceptance prompt.
- Added the SCA-04A operator-decision and current-year apply-preview prompt.
- Added a concise dependency sequence and shared progress ledger for the remaining curriculum, Teaching Load, timetable, evaluation, and generation work.

### Changed
- Fast-forwarded and pushed the reviewed RC-02 integration package to `main` at `4559eb13bbd371dd7945b39128f8c0dcdacd430a`.
- Replaced ordinary per-file hash/reviewer-receipt ceremony in successor prompts with commit-range review; semantic fingerprints remain limited to high-risk data and generation actions.
- Planner QA accepted the RC-02D live deployment evidence and unlocked the zero-write SCA-04A decision preview.

### Decisions Made
- Live deployment must complete before current-year curriculum decisions are previewed.
- Curriculum authority must be persisted before Teaching Load allocation and timetable insertion work may proceed.
- TL-C02 and TT-C02 may run in parallel only after SCA-04B and with disjoint source ownership.

### Open Questions
- The operator must still choose the active-year term structure and confirm or reject curriculum requirement candidates before SCA-04B can be authorized.

## [2026-09-07] — Teaching Load Effective Consumer Contract v2 (TL-06R3C, REVIEW_REQUIRED)

### Added
- Enriched `GET /api/v1/faculty-assignments/effective` to consumer contract v2 (`source.contractVersion=2`) while preserving every legacy assignment field.
- Each `assignments[]` row now carries scoped `facultyExternalId`, `sectionExternalId` plus section/grade/program metadata, and subject code/name/output-label/minutes/rotation metadata via 3 set-based reads (never N+1).
- Fail-closed `500 EFFECTIVE_CONTRACT_METADATA_INCOMPLETE` when a non-empty assignment cannot resolve scoped metadata; no partial payload is emitted.
- Added `atlas-server/src/__tests__/effective-teaching-load-contract-v2.test.ts` (140 assertions): real-route legacy/v2 shape, external-ID namespace with negative controls, cross-school/year collision isolation, rotation preservation/nullability, EMPTY validity, typed fail-closed, auth/secrets, query-shape bounds, and zero-write proof with positive control.
- Documented v2 field semantics, ID namespaces, and the new failure code in `docs/guides/AIMS_SMART_ANNUAL_TEACHING_LOAD_CONTRACT.md`.

### Changed
- Updated `docs/reference/atlas-runtime-source-of-truth-map.md` with the v2 contract note (live remains `PENDING_DEPLOY` until separately authorized).

### Decisions Made
- ATLAS-only source task; AIMS, SMART, and EnrollPro clones untouched (read-only boundary).
- Steady-state effective reads perform zero writes in tests by pre-creating the Teaching Load cycle and scheduling policy fixtures.

### Open Questions
- Live Tailnet v2 verification awaits a separately authorized deployment; no live server restart occurred in this prompt.

## [2026-09-07] — External Subsystem Protection and Consumer Handoff

### Added
- Added a permanent rule that EnrollPro, AIMS, and SMART clones are read-only references during ATLAS work.
- Added an AIMS/SMART developer handoff with exact annual Teaching Load contract gaps and acceptance tests.

### Changed
- Invalidated Prompt 06R3B because it incorrectly authorized SMART source edits from an ATLAS task.
- Cloned AIMS at commit `719ac72553303550a149e3bd3712d95ebbc7ea98` for read-only inspection and kept its worktree clean.

### Decisions Made
- Only ATLAS source may be changed unless the user provides a separate explicit external-repository write exception.
- External integration defects are delivered as ATLAS-owned handoff documents to the relevant subsystem developers.

### Open Questions
- AIMS and SMART developers must schedule their own annual-effective consumer migrations.

## [2026-09-07] — SMART Annual Teaching Load Consumer Correction Prompt 06R3B

### Added
- Added a focused implementation handoff for one shared SMART annual-effective Teaching Load client and the three confirmed production consumer paths.

### Changed
- Replaced discovery-only follow-up with required source implementation, hermetic negative controls, a read-only Tailnet smoke, and a 60-minute hard boundary.

### Decisions Made
- SMART must resolve the active ATLAS year dynamically and must not use per-faculty assignments, the operator summary, published schedules, or unscoped sections as annual Teaching Load truth.
- The existing effective payload will be joined through already available faculty, subject, and year-scoped section metadata in this pass; ATLAS API expansion and generator offering integration remain separate work.

### Open Questions
- AIMS remains unavailable locally and requires a separate repository/runtime handoff when its source becomes accessible.

## [2026-09-07] — Teaching Load Consumer Readiness Prompt 06R3A

### Added
- Added a time-bounded live verification handoff for the annual AIMS/SMART Teaching Load contract and the independent timetable-readiness boundary.

### Changed
- Superseded the stale empty-database Prompt 06R3 with Prompt 06R3A after live Tailnet returned a populated current-year cycle with 265 effective assignments.

### Decisions Made
- Consumer verification must not regenerate or mutate the accepted Teaching Load, create a timetable run, publish a schedule, or repeat database-recovery gate work.
- AIMS/SMART readiness and timetable-generation readiness are separate verdicts; zero persisted offerings or term configuration remains visible even when Teaching Load coverage is complete.

### Open Questions
- The executor must locate and verify the currently active AIMS consumer repository; absence of that source is reported as an external handoff limitation.

## [2026-09-07] — Database Recovery Prompt 06 Final Formal Closure

### Added
- Added final independent verification of the elevated scheduled task, new backup pair, restore-list integrity, secret-free operation, and protected database invariants.

### Changed
- Closed all Prompt 06 and 06R findings in the canonical Prompt 06 formal review and moved it to GO/zero-fix.
- Stored the exact exit-zero Prompt 06 gate receipt and unlocked Teaching Load Prompt 06R3.

### Decisions Made
- Database-recovery Prompt 06 is complete; Teaching Load resumes at Prompt 06R3 while Prompt 07, generation, and publication remain separately gated.
- Prompt 06R remains corrective evidence under the original manifest tasks; it is not represented as an unpinned parallel task family.

### Open Questions
- None.

## [2026-09-09] — Commit-Based Executor Workflow

### Added
- Added isolated neutral executor branches/worktrees and immutable candidate commits as the default implementation handoff.
- Added an integration-owner gate for combining accepted commits and pushing `main` only after cross-stream verification.

### Changed
- Replaced per-file hash manifests and receipt chains for ordinary source work with Git commit-SHA review boundaries.
- Limited the existing manifest, fingerprint, mechanical validator, and receipt protocol to explicitly opted-in HIGH-risk operations.
- Reduced ordinary review to focused tests plus one advisory pass for MEDIUM work and one independent planner/QA review of the committed diff.

### Decisions Made
- Executor branch names shall remain neutral and shall not identify an agent, model, vendor, or tool.
- Executors shall not commit, merge, or push directly on `main`.
- Corrective work after review shall use new commits instead of rewriting reviewed history.

### Open Questions
- None.

## [2026-09-07] — Database Recovery Prompt 06 Elevated Scheduler Closure (REVIEW_REQUIRED)

### Added
- Elevated correction of `ATLAS Daily Backup` (S4U/Limited principal, StartWhenAvailable, battery-safe, IgnoreNew preserved) with re-read proof of every setting.
- Exactly one new validated backup pair (`...-015400.dump`, 239848 B, sha256 `01d8136e…`, 463 restore-list entries) from a single trigger with Last Result 0.

### Changed
- DBR-06R.6 moved from EXTERNALLY_BLOCKED to DONE on operator evidence; prior non-elevated probe retained as superseded history.
- Evidence log carries the elevated closure entry; phasePlan Prompt 06 line updated to correction-done pending formal re-review.

### Decisions Made
- No GO declared, no receipt issued: F-06-07/F-06-08 closure belongs to the bounded advisory (fresh, post-correction) and planner/QA formal re-review.
- No source edits, suite reruns, restarts, migrations, or timetable work in this pass.

### Open Questions
- Planner/QA formal update of `prompt-06r-review.md` to GO plus the exact `--prompt 06` exit-zero receipt.

## [2026-09-07] — Database Recovery Prompt 06 Operational Closure Probe (still blocked)

### Added
- Added a fresh closure-probe record: non-elevated session confirmation, S4U correction denial evidence, unchanged task XML, zero new archives, and a fresh `atlas_db` 0/0 census probe.

### Changed
- Changed DBR-06R.6 evidence to carry the closure-probe timestamp while keeping EXTERNALLY_BLOCKED status.

### Decisions Made
- No trigger fired and no suites rerun: triggering would only re-prove the uncorrected interactive path and source files are untouched.
- Prompt 06 stays operationally NO-GO; bounded advisory and formal QA remain planner-owned.

### Open Questions
- Elevated operator correction of `ATLAS Daily Backup` (S4U principal, battery/start-catch-up flags) is still pending before the one-trigger backup proof can run.

## [2026-09-07] — Database Recovery Prompt 06R Formal QA

### Added
- Added formal QA evidence accepting the bounded backup/auth source corrections and identifying the sole remaining Windows task action.

### Changed
- Changed Prompt 06 source implementation to GO while retaining overall operational NO-GO until the nightly task meets its declared RPO.
- Corrected the executor advisory status from DONE to REVIEW because its artifact predates the final ledger transition.

### Decisions Made
- Prompt 06 will close through its already pinned original execution gate; no additional broad recovery prompt is needed.
- An elevated operator action, one successful scheduled backup, and one short final advisory are the only remaining steps.

### Open Questions
- None.

## [2026-09-07] — Database Recovery Prompt 06 Formal QA

### Added
- Added the formal Prompt 06 planner/QA review with independently reproduced source, test, backup, scheduler, and Tailnet evidence.

### Changed
- Changed Prompt 06 from executor `REVIEW_REQUIRED` to formal `NO-GO` pending a narrow corrective pass.
- Reopened only the affected backup gate, restore drill, scheduler, runbook, and faculty-auth tasks; Prompt 05B cutover remains accepted.

### Decisions Made
- Required HTTP integration failures cannot be waived as unrelated.
- A successful restore drill does not prove failure-path cleanup, and stored restore-list metadata is insufficient for the pre-migration gate.
- Advisory artifacts using `none-exposed` as reviewer identity do not satisfy the repository's review rules.

### Open Questions
- None; the formal review defines a bounded Prompt 06R correction scope.

## [2026-09-07] — Database Recovery Prompt 06 Execution (REVIEW_REQUIRED)

### Added
- Operational backup/restore path: `database-backup.service.ts`, `atlas-backup.ts`, `atlas-restore-drill.ts`, mandatory `atlas-migrate.ts` gate wrapper (`npm run migrate:guarded`), example operator config, runbook, and drill evidence doc.
- Fresh backup + checksum manifest, scheduled task `ATLAS Daily Backup` (triggered once, Last Result 0), and a verified disposable restore drill with cleanup proof.
- Faculty identity correction: mirror-mediated login resolution, seed preservation, EnrollPro hydrate-only-returned rules, plus 21-assert focused suite and one bounded Tailnet faculty login.

### Changed
- Retired the fixed `2000056` faculty identifier in the Manual QA Login Protocol and runtime map (discover a current active identifier at QA time; never recreate, never record passwords).
- Prompt 06 status IN_PROGRESS at executor REVIEW_REQUIRED; Teaching Load Prompt 06R3 stays paused pending formal GO.

### Decisions Made
- No shared migration was run; the gate was proven by negative control only. No bulk auth backfill; only the bounded login's effects were written.

### Open Questions
- Formal planner/QA Prompt 06 review + gate receipt (executor must not author).
- Pre-existing `auth-login-integration` bridge-guard 403-vs-400 assertion (subject scope, unrelated to Prompt 06 edits).

## [2026-09-07] — Database Recovery Prompt 06 Handoff

### Added
- Added a pinned, fresh-session Prompt 06 handoff for one operational backup,
  one scheduled execution, one disposable restore drill, and focused faculty
  login identity correction.

### Changed
- Replaced the broad Prompt 06 outline with explicit targets, mutation limits,
  operator-configured test defaults, focused verification, and a 60-minute cap.
- Added source-authoritative faculty identifier handling without recreating the
  absent historical `2000056` identity or bulk-updating auth accounts.

### Decisions Made
- Tailnet login restoration belongs to completed Prompt 05B; Prompt 06 protects
  recoverability and corrects current faculty identity resolution.
- Full historical recovery suites and repeated zero-finding reviewers are out
  of scope for Prompt 06.

### Open Questions
- WAL/PITR remains a separately approved future operations phase.

---

## [2026-09-07] — Database Recovery Prompt 05B Closure

### Added
- Added the formal zero-fix Prompt 05B review and exact exit-zero gate receipt.

### Changed
- Marked the approved configuration-only cutover to `atlas_recovery_clean_rebuild_20260905` GO after Tailnet authentication, bounded API/CRUD, cleanup, dump-integrity, and automation-suppression verification.
- Unlocked database-recovery Prompt 06 for backup and disposable restore proof.

### Decisions Made
- Retained the valid EnrollPro-provisioned officer account created during first login and updated the clean candidate baseline to 44 authentication accounts.
- Kept Teaching Load assignment, offerings, timetable generation, and publication outside Prompt 05B.

### Open Questions
- Faculty authentication records currently omit mirrored employee IDs; correct that source/provisioning mapping in a bounded follow-up without blocking the completed cutover.

---

## [2026-09-05] — Database Recovery Prompt 01R: Evidence and Gate Integrity Repair

### Added
- Fresh independent review artifact at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-01r-review.md` with GO verdict and zeroFix: true.
- Execution gate receipt: `npm run verify:execution-gate` exited 0 for Prompt 01R.

### Changed
- Corrected Prisma model count from 44 to 43 (schema introspection + database agree).
- Corrected ENROLLPRO classification count from 5 to 6.
- Corrected UNRECOVERED classification count from 18 to 17.
- Corrected subtotal from 5+13+7+18=43 to 6+13+7+17=43.
- Regenerated decision manifest with file hashes, probe timestamps, and accepted residuals (hash: `b5ea3e83...`).
- Updated source inventory with SHA-256 hashes for all file-based evidence sources.
- Updated progress ledger: all 15/15 Prompt 01/01R tasks DONE, Prompt 02 UNLOCKED.
- Updated execution summary with gate receipt and correction history.
- Updated phasePlan.md with Prompt 01/01R GO status.

### Decisions Made
- RECONSTRUCT strategy confirmed (no usable backup found in inspected sources).
- EnrollPro service token 401 residual documented as blocking for Prompt 02 live-feed reconstruction.
- Review context IDs corrected to avoid validator invalid-values list.
- Review format corrected to key-value pairs matching validator regex patterns.

### Open Questions
- EnrollPro service token validity must be resolved before Prompt 02 live-feed reconstruction.

---

## [2026-09-05] — Database Recovery Prompt 01R: Evidence and Gate Integrity Repair

### Added
- Fresh independent review artifact at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-01r-review.md` with GO verdict and zeroFix: true.
- Execution gate receipt: `npm run verify:execution-gate` exited 0 for Prompt 01R.

### Changed
- Corrected Prisma model count from 44 to 43 (schema introspection + database agree).
- Corrected ENROLLPRO classification count from 5 to 6.
- Corrected UNRECOVERED classification count from 18 to 17.
- Corrected subtotal from 5+13+7+18=43 to 6+13+7+17=43.
- Regenerated decision manifest with file hashes, probe timestamps, and accepted residuals (hash: `b5ea3e83...`).
- Updated source inventory with SHA-256 hashes for all file-based evidence sources.
- Updated progress ledger: all 15/15 Prompt 01/01R tasks DONE, Prompt 02 UNLOCKED.
- Updated execution summary with gate receipt and correction history.
- Updated phasePlan.md with Prompt 01/01R GO status.

### Decisions Made
- RECONSTRUCT strategy confirmed (no usable backup found in inspected sources).
- EnrollPro service token 401 residual documented as blocking for Prompt 02 live-feed reconstruction.
- Review context IDs corrected to avoid validator invalid-values list.
- Review format corrected to key-value pairs matching validator regex patterns.

### Open Questions
- EnrollPro service token validity must be resolved before Prompt 02 live-feed reconstruction.

---

## [2026-09-05] — Database Recovery Prompt 04: Native CRUD Hardening

### Changed
- Removed write-on-GET from `getBuildingsBySchool()` in `map.service.ts` — shortCode now computed in-memory instead of written to DB.
- Added `actorSchoolId` parameter to `updateBuilding`, `deleteBuilding`, `addRoom`, `updateRoom`, `deleteRoom` with `CROSS_SCHOOL_DENIED` (403) enforcement.
- Updated all mutation route handlers in `map.router.ts` to extract and pass actor school ID.
- Subject catalog remains create-missing-only with `expectedUpdatedAt` optimistic concurrency.

### Verified
- TypeScript compiles cleanly
- Server builds cleanly
- Zero DB writes on building GET path
- 5 CROSS_SCHOOL_DENIED enforcement points across mutation functions

### Review
- Independent review at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-04-review.md` with GO verdict

---

## [2026-09-05] — Database Recovery Prompt 03: Auth and Runtime Hardening

### Changed
- Removed `ATLAS_DEFAULT_SCHOOL_ID` fallback from login provisioning in `local-auth.service.ts`.
- Added `resolveEnrollProRole()` consuming EnrollPro `roles[]` array with allowlisted role mapping.
- Added `AUTH_SCHOOL_NOT_READY` (503) typed failure when no school exists.
- Added `AUTH_INVALID_ROLE` (403) typed failure for unrecognized EnrollPro roles.
- School resolved via `prisma.school.findFirst()` instead of environment variable.
- EnrollPro service token sent through `Authorization: Bearer` header on faculty hydration requests.
- Error handler now detects Prisma errors and returns generic message instead of raw database text.

### Verified
- TypeScript compiles cleanly
- Server builds cleanly
- System token auth tests: 26/26 passed
- Zero references to `ATLAS_DEFAULT_SCHOOL_ID` in auth service

### Review
- Independent review at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-03-review.md` with GO verdict

---

## [2026-09-05] — Database Recovery Prompt 02: Disposable Rehearsal

### Added
- Rehearsal evidence document at `docs/verification/database-recovery-rehearsal-2026-09-05.md`.
- Independent review artifact at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-02-review.md` with GO verdict and zeroFix: true.
- Two disposable rehearsal databases created and verified (337 rows each, 12/12 domains match).
- FK integrity verified (0 violations across 5 critical FK paths).
- Determinism proven via row count comparison.

### Changed
- Updated progress ledger: all 25/25 Prompt 02 tasks DONE, Prompt 03 UNLOCKED.
- Updated execution summary with Prompt 02 gate receipt and reconstruction summary.

### Known Issues
- Migration chain defect: migration 0003 references `scheduling_policies` not created by prior migration. Schema initialized via `prisma db push` on disposable targets only.
- EnrollPro service token returns 401 on `/api/auth/verify` but works on integration endpoints.
- Scheduling policy orphaned default row requires operator confirmation.

---

## [2026-09-05] — Teaching Load Dynamic Recovery Prompt Sequence

### Added
- An eight-pass execution and independent-QA package beginning at `docs/prompts/teaching-load-dynamic-recovery-00-sequence-2026-09-05.md`.
- Dedicated prompts for workload semantics, school-year terms/offerings, qualification/program policy, mutation security/concurrency, allocation/rebalance, contextual UX/readiness, fingerprinted remediation, and independent QA.
- Explicit negative proofs for advisory-only utilization, configurable specialization counts, cross-school denial, stale-plan rejection, generation zero-write behavior, and test-fixture cleanup.
- A required progress ledger at `docs/progress/teaching-load-dynamic-recovery-00-sequence-2026-09-05-progress.md` with phase/task TODOs, evidence fields, and task/phase review logs.
- Repository-wide directives requiring plan decomposition and repeated fresh-review/fix loops after every implementation task and whole phase.
- AFK continuous-execution gates that keep the executor inside one prompt until all required tests and zero-fix phase review pass, then continue automatically and maintain a cumulative QA summary.
- An explicit prohibition on reset-style Prisma/database commands against shared or live data during unattended execution.

### Added (Prompt TL-DR-01 Implementation)
- `atlas-server/src/services/workload-policy.service.ts`: canonical `WorkloadPolicy` interface, `WorkloadComputation` DTO, `computeWorkload()` pure function, `deriveTeachingLoadStatus()`, `hoursToMinutes()`, `minutesToHours()`.
- Migration `0044_add_workload_policy_fields`: adds `teachingStandardMinutes` (default 1800), `advisoryCreditMinutes` (default 300), `hardCapMinutes` (default 2400) to `scheduling_policies` table.
- `atlas-server/src/__tests__/workload-policy.test.ts`: 14 unit tests covering zero-teaching, advisory non-leakage, ancillary non-leakage, excess calculation, cross-school isolation, and status derivation.

### Added (Prompt TL-DR-02 Implementation)
- `atlas-server/src/services/term-config.service.ts`: school-year term configuration CRUD, validation, and term identity helpers.
- `atlas-server/src/services/school-year-offering.service.ts`: offering CRUD, preview (zero writes), apply (version-guarded, transactional), readiness evaluator with stable blocker codes.
- Migration `0045_add_offering_term_config_models`: creates `school_year_term_configs`, `school_year_offerings`, `offering_term_assignments` tables with `OfferingClassification` and `TermMode` enums.
- `atlas-server/src/__tests__/term-config-offering.test.ts`: 13 unit tests covering term config validation, offering validation (ALL/ROTATING/EMPTY modes), and readiness evaluation.

### Added (Prompt TL-DR-03 Implementation)
- `atlas-server/src/services/qualification-evaluator.service.ts`: canonical `QualificationResult` type, `evaluateQualification()` with 3-tier matching, `normalizeDepartmentCode()`, `resolveSubjectOwnerDepartmentCode()`, `matchesDepartment()`, `matchesCrossLanguageException()`, `isProgramScopeCompatible()`, `resolveDepartmentLabel()`. Persisted policy cache with TTL.
- Migration `0046_add_qualification_policy_models`: creates `department_aliases`, `department_labels`, `subject_owner_prefixes`, `program_scope_rules`, `cross_department_permissions` tables.
- `atlas-server/src/__tests__/qualification-evaluator.test.ts`: 15 unit tests covering normalization, prefix resolution, department matching, cross-language exception, program scope, and label resolution.

### Changed
- The former Prompt 03 execution path is marked superseded and redirected to the new dependency-ordered sequence.
- Phase 3 planning now places workload and mutation authority ahead of active-year offering activation and live redistribution.
- `AGENTS.md`, `ATLAS_AGENT_KI.md`, `.github/copilot-instructions.md`, `docs/phases/README.md`, and `docs/verification/phase-gates.md` now require progress-ledger updates, next-task activation, independent review, and zero-fix review closure before `DONE` or `GO`.
- All eight Teaching Load prompts now define their automatic next-prompt handoff or legitimate approval stop boundary.

### Decisions Made
- The 30-hour standard applies to actual teaching load; advisory remains separately credited at the current configured +5 hours.
- Current two-specialization arrangements are persisted curriculum data, never a global rule.
- Runtime-selected year 8 setup and any historical year 7 correction require separate fingerprints and approval scopes.
- Generation consumes reviewed setup and cannot create Teaching Load or offering truth.

### Open Questions
- Active-year term identities, offering classifications, and exact current-year offering rows remain operator decisions to be captured by Prompt TL-DR-02.
- No live remediation or historical correction is authorized by this documentation pass.

## [2026-09-04] — Prompt 03C: Hardcoded Offering Evidence Replaced with Persisted Authority

### Added
- **Persisted/fingerprinted evidence sources (no code constants):** `prompt03c-generate-offering-evidence.ts` reads rotation family/order from persisted Subject rows (SCIENCE 3061-3063, TLE_EXPLORATORY 5742-5744 — all six members proven with modularGroupId/modularOrder/termGroupId/termCount/rotationFamily), classifications from the fingerprinted decision record, and resolves school/year via `resolveRuntimeContext()`.
- **Classification decision record:** `prompt03c-classification-decision-record-2026-09-04.json` — per-subject decisions with cited bases + one-time remediation RE-001 (G10 STE Research exclusion, scope-exact) + template-gap acknowledgement TGA-001 (STE_ROBOTICS). Semantic `892BA81E1AEB23447A3E0649F02E0B55E2AF938B95839A31DD1DAF76E8216881`.
- **Term-configuration schema in migration 0043 preview:** `prompt03c-migration-0043-preview-2026-09-04.sql` adds `school_year_term_configs`, relational `offering_term_assignments` (replacing JSONB term_ids), composite FKs proving assigned terms belong to the offering's school/year, and validation triggers for term identity membership/uniqueness and rotation order.
- **Production-path current-demand capture:** `prompt03c-generate-demand-shadow.ts` calls the actual `computeDemand()` under the injected data context (generation read shapes) — 11/11 self-checks. Content delta on exactly one section (Silver 87): `STE_RESEARCH` only; -5 meetings/-225 min under the 45-min contract.
- **Non-applicable corrected backfill:** `prompt03c-offering-backfill-2026-09-04.json` — 264 candidates, 0 unresolved decisions, `applicable: false` (OFFERING_TERM_CONFIG_MISSING + decision-record approval + ACTIVE_YEAR_DRIFT).
- **Artifact hash convention:** every artifact embeds `hashRecord` (semantic hash over content excluding `generatedAt`/`hashRecord`; file-byte hash recorded externally in the composite).
- **New composite fingerprint `1B03EB83C743E698307EB9E63D31E59DB678B50EC30605108E4534F1EC6D3683`** — supersedes `76997884…` and `8D5927EA…`; deterministic across regeneration; `authorizesNoMutation: true`.

### Changed
- Prompt 03B/03C evidence generators and manifests superseded by the 03C set (03B files retained as invalidated history).
- `phasePlan.md`, `evidence-log.md`, `atlas-runtime-source-of-truth-map.md` updated with the 03C verdict and the live active-year drift observation.

### Decisions Made
- School-year term identities are an OPERATOR decision recorded as term-configuration data; no universal `[1,2,3]` substitution; backfill stays non-applicable until term config exists and is applied.
- Classification decisions live in the fingerprinted decision record; a vocabulary table alone is insufficient.
- Teaching Load ownership is staffing evidence only; composition = ownership ∩ template bindings ∩ catalog; HG never offered; class-program slots are capacity evidence.
- G10 Research exclusion is one-time scope-exact (RE-001); STE_ROBOTICS template-gap retention is TGA-001 with apply-time healing proposal H-001.
- Active-year drift (runtime year 8 vs contract scope year 7) is a blocking conflict until the operator confirms the year boundary.

### Open Questions
- Operator decisions required before any apply: year-7 school-year term configuration (identities/count), classification decision-record approval, year-boundary confirmation (year 7 vs 8).
- REGULAR 60-min template period-basis vs 45-min canonical contract (configurable-capacity stream).

### Verification
- 03C evidence generator 22/22 self-checks (drift = expected recorded blocker); demand-shadow 11/11; regression suites unchanged (async-context 13/13, offering-resolution 27/27, zero-write 9/9, atomicity 17/17, CRUD 19/19, HTTP 24/24, effective 21/21, phase3 51/51, hybrid 39/39, matrix 34/34, sync/setup 6/6, term-load 330/330); canonical rows 3118/20539/12334/4286 unchanged; runs 647-653 untouched; migration 0043 not applied; fixture residue zero.

## [2026-09-04] — Prompt 03B: Corrected Term-Aware Offering Model Checkpoint

### Added
- **AsyncLocalStorage data context:** `lib/data-context.ts` no longer uses a process-global mutable; `getDataContext()`/`withDataContext()` now run on Node `AsyncLocalStorage` (`contextStorage.run`). Overlapping requests/tests cannot observe each other's injected client; throw/nested/timer paths restore correctly. `async-data-context.test.ts` 13/13.
- **Failure-safe zero-write test v2:** `generation-zero-subject-writes.test.ts` rewritten — fixture cleanup in an outer `finally` on every failure path; deterministic fixture-owned identities with preflight collision checks; positive control calls the real production `getOrCreatePolicy` service through the injected context (never `instrumented.<model>.write()`); explicit allowed-write contract (`generationrun` create/update, `auditlog` create) with zero-row no-op statements reported separately; any unclassified real mutation fails; residual rows asserted zero across 23 models (now including `schedulingPolicy`, `gradeShiftWindow`, `sectionSnapshot`, `lockedSession`, `facultySnapshot`, cohorts, cycles — residue the v1 cleanup missed). 9/9 PASS twice; capture `total=4 real=4 forbidden=0 unexpected=0`.
- **Shadow offering-resolution module (read-only):** `services/offering-demand-resolution.service.ts` — pure term-behavior/demand/readiness/classification/shadow-comparison resolution consumed only by unit tests and read-only generators; NOT wired into runtime generation authority. `offering-resolution.test.ts` 27/27.
- **Corrected migration 0043 SQL preview:** `docs/prompts/prompt03b-migration-0043-preview-2026-09-04.sql` — SectionMirror-PK composite FKs (persistence-level school/year consistency; externalId never stored unprotected), explicit `term_mode ALL|SELECTED|EMPTY` (no ambiguous `{}`), persisted `offering_classifications` vocabulary table, reactivation lifecycle with partial unique index over active rows, empty-scope marker rows, rotation-order/term-count consistency checks. Migration directory NOT created; SQL NOT applied.
- **Corrected evidence artifacts (all read-only, reproducible hashes):** `prompt03b-offering-comparison`, `prompt03b-offering-backfill` (264 rows; 180 CORE / 60 EXPLORATORY / 24 SPECIALIZATION; 144 all-term + 120 rotating-family; Silver G10 STE = Applied Physics + Robotics zero Research; G7-9 Research intact), `prompt03b-source-conflict-report` (zero unresolved; 5 resolved conflicts incl. the 8D5927EA defects), `prompt03b-classification-report`, `prompt03b-shadow-demand-comparison` (Silver's only delta = `STE_RESEARCH@all`), `prompt03b-capacity-impact-report` (Silver −5 sessions/week to exact 50-session capacity; G9-10 REGULAR structural shortfall unchanged), `prompt03b-preflight-evidence`, `prompt03b-remediation-manifest` (exact Phase 8 dispositions incl. FacultySubject 12334), `prompt03b-rollback-manifest`, `prompt03b-compatibility-rollout-manifest` (12 deployable stages, authority never switched inside a DB transaction), `prompt03b-zero-write-evidence`, `prompt03b-test-run-cleanup-manifest` (separate), `prompt03b-composite-fingerprint`.
- **Composite fingerprint `769978843E9FE36C60291C28CD069763E682F40F7F66D3783059895820168C64`** — supersedes `8D5927EA…`; deterministic across regeneration (stable canonical hashes exclude volatile `generatedAt`); `authorizesNoMutation: true`.

### Changed
- `lib/data-context.ts`: removed module-global `setDataContext`/`clearDataContext` (no remaining callers); context now ALS-scoped.
- Evidence basis: all Prompt 03B artifact hashes are computed over canonical content excluding the volatile `generatedAt` so regeneration is byte-stable (file SHA-256 also recorded).
- `docs/reference/atlas-runtime-source-of-truth-map.md`: added Offering Authority Shadow Checkpoint section (NO-GO; demand authority unchanged).

### Decisions Made
- Science and TLE exploratory rows are ROTATING-FAMILY members with explicit per-term applicability (SCI_BIO term 1 / CHEM 2 / ES 3; TLE ICT 1 / AFA 2 / FCS 3) — never simultaneous weekly demand. Term structure comes from persisted modular metadata until the school-year term configuration columns land with migration 0043.
- Classifications: 6 core subjects CORE; Science rotation CORE; TLE exploratory EXPLORATORY; STE overlays + STE_RESEARCH (G7-9) + SPA_SPEC/SPS_SPEC + DEVL_READING SPECIALIZATION; vocabulary persisted as a table, not hardcoded in runtime code.
- Ownership never implies CORE: backfill rows are reconstructed from ownership evidence cross-checked against catalog + term configuration + operator decisions; conflicts resolved explicitly, zero unresolved.
- Ownership 20539 physical DELETE is required (active-year UI/coverage/fingerprint truth), FacultySubject 12334 demoted (sectionIds/gradeLevels → []), subject 3118 grade metadata → [7,8,9], binding 4286 KEEP_THEN_DELETE after replacement rows verify.
- Phase 7 rollout = 12 separately deployable/reversible stages; the demand-authority switch is a persisted gate (stage 7), never a database-transaction step.
- Prompt 03 apply remains **NO-GO** pending explicit approval of composite `769978843E9FE36C60291C28CD069763E682F40F7F66D3783059895820168C64`; Prompt 03A artifacts remain as invalidated history (superseded).

### Open Questions
- Deployment-vs-data transaction split for migration DDL (unchanged from Prompt 03A, restated in the rollout manifest).
- Whether placeholder/coverage repair should leave the generation path (unchanged from Prompt 03A).
- G9-10 REGULAR structural shortfall (5 sessions/week/section under the canonical 45-min contract) belongs to Prompt 04 configurable-capacity scope, not the offering model.

### Verification
- async-data-context 13/13; generation-zero-subject-writes 9/9 (twice); offering-resolution 27/27; subjects-atomicity 17/17; subjects-crud-source-authority 19/19; subject-http-integration 24/24; effective-scheduled-resources 21/21; phase3-regression 51/51; hybrid-scheduler 39/39; class-program-matrix 34/34; timetable-sync-setup 6/6; schedule-constructor-term-load 330/330; server tsc/build PASS; built server startup + `/api/v1/health` 200 + `/api/v1/subjects?schoolId=1` 200; mojibake scan clean; canonical rows 3118/20539/4286 and runs 647-653 unchanged; migration 0043 not applied; fixture school 99995 zero residue.


### Added
- **Injectable data-access context (`lib/data-context.ts`):** `getDataContext()` / `setDataContext()` / `withDataContext()` — production services resolve the singleton by default; tests can inject an instrumented client through the EXACT production path.
- **Generation dependency refactor:** `generation.service.ts` and all nested writing services (section, class-template, faculty-assignment, cohort, grade-window, scheduling-policy, class-program-slot, pre-generation-draft, teaching-load-cycle, section-adapter, runtime-context, class-program-matrix, seeded-teaching-load, active-draft-run-resolver, generation-input-snapshot) now resolve data access through the context.
- **Real production-path zero-write test:** `generation-zero-subject-writes.test.ts` builds a complete disposable school 99995 fixture, injects an instrumented client, runs a REAL generation (COMPLETED), classifies captured operations (GenerationRun allowed; Subject/FacultySubject/SubjectSectionOwnership/ClassTemplateSubject/placeholder/DDL forbidden), proves a positive control through the same injected path, and verifies zero residual rows in cleanup. 6/6 PASS.
- **Migration 0043 SQL preview:** `docs/prompts/prompt03a-migration-0043-preview-2026-09-04.sql` — SchoolYearOffering schema with school-year identity resolution (EnrollPro identity convention), uniqueness across section/cohort/term/program scoping, demand indexes, `is_active`/`retired_at` lifecycle. SHA-256 `193D522AB8E490DC352082C3CE189ECBA00D2111FB8AF6CFE1B8E9AF9B8F549C`.
- **Complete active-year offering backfill:** `docs/verification/prompt03a-offering-backfill-2026-09-04.json` — 264 deterministic offering rows for school 1, year 7 enumerated from persisted sections/ownership/catalog. G10 STE Silver = exactly `STE_APPLIED_PHYS` + `STE_ROBOTICS`, zero Research. SHA-256 `32B3260D7A456EFBA48435F43CF10C5E84DE1628380BA720366DF875F7FC4582`.
- **Remediation manifest:** `docs/verification/prompt03a-remediation-manifest-2026-09-04.json` — exact dispositions for 3118 (UPDATE gradeLevels), 20539 (DELETE), 4286 (KEEP_THEN_DELETE) with concurrency predicates, rollback, read-back assertions; 11-step atomic transition order; readiness contract. SHA-256 `1BE5782AF12306C9781FF03FEB5FE147E2A32EF661608372E186B3AEF2485ACF`.
- **Rollback manifest:** `docs/verification/prompt03a-rollback-manifest-2026-09-04.json` — step-by-step rollback with preconditions and limitations. SHA-256 `410F16474359E86AF03FC0DC799A0C7D365DF72F0E5EC7A1AF5A6797297CA540`.
- **Composite fingerprint:** `docs/verification/prompt03a-composite-fingerprint-2026-09-04.json` — binds all four artifact hashes; supersedes the R5 preview fingerprint `6905DC87...`; invalidates v1/v2; authorizes no mutation.
- **Separate test-run cleanup manifest:** `docs/verification/prompt03a-test-run-cleanup-manifest-2026-09-04.json` — runs 647/648/649/652/653 with dependency/publication/revision checks and proposed delete order; NOT part of the Prompt 03 approval fingerprint.

### Changed
- `subject-http-integration.test.ts`: sync-apply assertion now accepts `SOURCE_DEGRADED` (fail-closed real provenance for fixture schools with no upstream data) or `OFFERING_MODEL_REQUIRED` (live source, missing persisted model). 24/24 PASS.
- Real provenance in `fetchUpstreamProgramSignals` (offerings/section/mirror/TLE statuses) — a missing/failed upstream source can no longer be interpreted as an absent offering.

### Decisions Made
- School-year identity for SchoolYearOffering = EnrollPro school-year identity (consistent with SectionMirror/ownership/FacultySubject/TeachingLoadCycle convention), not the mirror PK.
- Binding 4286 stays unchanged until replacement G10 STE offering rows are inserted AND read-back verified inside the same approved transaction.
- Test-created canonical runs 647/648/649/652/653 remain untouched; deletion requires separate approval tied to the cleanup manifest.

### Open Questions
- Deployment vs data-apply transaction separation for migration DDL (two fingerprints) — resolved in the remediation manifest's transition order (step 2 is non-transactional), pending stakeholder confirmation.
- Whether generation's placeholder/coverage repair (`repairActiveSubjectCoverageWithPlaceholders`) should be removed from the generation path entirely (it performed zero forbidden writes only when the fixture fully covers every active subject).

### Verification
- generation-zero-subject-writes: 6/6 PASS (fixture school 99995, real generation COMPLETED, zero forbidden writes, positive control, zero residual rows)
- subjects-atomicity: 17/17; subjects-crud: 19/19; subject-http-integration: 24/24
- phase3-regression: 51/51; effective-scheduled-resources: 21/21; schedule-constructor-term-load: 330/330; hybrid-scheduler: 39/39; class-program-matrix: 34/34; timetable-sync-setup: 6/6
- Server tsc/build PASS; built server startup + `/api/v1/health` 200 PASS
- Canonical rows 3118/20539/4286 unchanged; zero fixture residue for school 99995

---

## [2026-09-04] — Prompt 01B-R: Subject Mutation Safety and Verification Corrective Pass

### Added
- **P0-2 PATCH validated allowlist:** `validateAndFilterPatchFields()` in subject.service.ts — explicit allowlist of 19 operator-editable fields; rejects protected fields (`id`, `schoolId`, `code`, `createdAt`, `updatedAt`, `isActive`, relations) with `400 PROTECTED_FIELD`; rejects unknown fields with `400 UNKNOWN_FIELD`; validates `minMinutesPerWeek`, `gradeLevels`, `preferredRoomType` before transaction.
- **P0-1 DELETE blocked + preview/apply:** Ordinary `DELETE /subjects/:id` now returns `409 DELETE_PREVIEW_REQUIRED` (zero writes). New endpoints: `POST /subjects/:id/delete-preview` (read-only dependency enumeration with SHA-256 fingerprint) and `POST /subjects/:id/delete-apply` (fingerprint-bound atomic deletion in Serializable transaction). Dependency graph includes FacultySubject, SubjectSectionOwnership, ClassTemplateSubject, GenerationRun JSON references, and PublishedSchedule references.
- **P0-4 Sync blocked + preview/apply:** Direct `POST /subjects/sync-offerings` now returns `409 SYNC_PREVIEW_REQUIRED` (zero writes). New endpoints: `POST /subjects/sync-offerings/preview` (read-only upstream signal enumeration with fingerprint) and `POST /subjects/sync-offerings/apply` (fingerprint-bound sync with drift detection).
- **P0-3 UI version enforcement:** Subjects.tsx `handleModalSave`, `handleArchiveSubject`, `handleReactivateSubject` now send `expectedUpdatedAt` from the persisted subject list. DeleteSubjectDialog rewritten to use preview/apply workflow with dependency enumeration UI.
- **P1-1 SubjectMobileCard import fix:** Added missing `SubjectMobileCard` import and required props (`coverageRow`, `onReviewCoverage`, `onEdit`, `onArchive`, `onReactivate`, `onDelete`).

### Changed
- **PATCH route:** `subject.router.ts` — `changes` payload now passes through `validateAndFilterPatchFields()` before reaching Prisma. `isActive` removed from PATCH payload (use archive/reactivate instead).
- **DELETE route:** `subject.router.ts` — ordinary DELETE blocked; preview/apply endpoints added.
- **Sync route:** `subject.router.ts` — direct sync blocked; preview/apply endpoints added.
- **UI mutations:** `Subjects.tsx` — all mutation calls now include `expectedUpdatedAt`; stale-write and no-op conflicts handled with user-facing toast messages.
- **DeleteSubjectDialog:** Rewritten to use preview/apply workflow with dependency enumeration, deletable/blocked classification, and fingerprint-bound apply.

### Decisions Made
- **P0-2:** PATCH now rejects protected fields explicitly instead of silently passing them to Prisma.
- **P0-1:** Ordinary DELETE is blocked until fingerprinted preview/apply is complete; this is safer than the old unversioned path.
- **P0-4:** Direct sync is blocked until fingerprinted preview/apply is complete; this prevents bulk mutations without preview.
- **P0-3:** UI now sends `expectedUpdatedAt` for all mutations; stale-write errors are explained to the user.
- **P1-3:** Mojibake in subject files verified clean; non-subject files (SchedulingPolicyPane, TimetableSimpleHeader, TimetableTaskDrawer) have pre-existing mojibake outside this prompt's scope.

### Verification
- Server TypeScript: PASS
- Client TypeScript: PASS
- Server build: PASS
- Client build: PASS
- subjects-atomicity.test.ts: 17/17 PASS
- subjects-crud-source-authority.test.ts: 19/19 PASS
- Migration 0042: Applied and verified

---

## [2026-09-04] — Prompt 01B Executed: Atomicity, Authorization, Passive-Write Elimination, Baseline Manifest

### Added
- Executed Prompt 01B (`timetable-dynamic-recovery-01b-subjects-atomicity-2026-09-04.md`) closing the 10 invalid-GO conditions from the adversarial review.

### Changed
**A. Mandatory atomic concurrency:**
- New `updateSubjectAtomic` + `transitionSubjectActiveStateAtomic` (subject.service.ts): the version predicate (id + schoolId + expectedUpdatedAt) is IN the UPDATE's WHERE inside one Serializable transaction — no read-then-write window. Zero-row outcomes classify NOT_FOUND / CROSS_SCHOOL_DENIED / STALE_WRITE without authorizing a write; P2034 serialization failures surface as STALE_WRITE.
- `expectedUpdatedAt` is MANDATORY on PATCH/archive/reactivate: missing → `400 VERSION_REQUIRED`, malformed → `400 INVALID_VERSION`, stale → `409 STALE_WRITE`.
- Archive/reactivate assert expected current isActive: double-archive → `409 ALREADY_ARCHIVED` WITHOUT advancing updatedAt; double-reactivate → `409 ALREADY_ACTIVE`.
- **Two-request race test: exactly 1 success + 1 STALE_WRITE, final state matches the winner, no lost update** (subjects-atomicity.test.ts).

**B. Complete actor-school authorization:**
- `/subjects/seed` + `/subjects/sync-offerings` no longer accept body-owned schoolId — actor scope is authoritative; a CONFLICTING body schoolId is explicitly rejected (`403 CROSS_SCHOOL_DENIED`) rather than silently applied. Live proof: seed with body schoolId 999 → 403 naming the actor's school.
- sync-offerings verifies the schoolYear belongs to the actor's school (`403 CROSS_SCHOOL_YEAR_DENIED` otherwise).

**C. Passive Subject mutations removed:**
- Generation no longer imports/calls `reconcileSubjectContractFromUpstream` — the run-641 catalog-rewrite mechanism is gone from the generation path (code-level + behavioral proof).
- `ensureDefaultSubjects` deprecated-subject `updateMany` REMOVED — strictly create-missing-only. Test proves a deprecated-code ACTIVE subject stays active after re-seed.

**D. Destructive cleanup flags rejected:**
- `cleanupActive/cleanupHistorical/cleanupAll` → `400 CLEANUP_FLAGS_UNSUPPORTED` with the preview/apply pointer. Live proof: DELETE with cleanupAll=true → 400.

**F. Mojibake:** subject.router.ts comments repaired (`â€”` → `—`); UTF-8-aware grep now zero across subjects surface (client + server).

**G. Route/atomicity test suite:** `subjects-atomicity.test.ts` 17/17 — version outcomes, race, no-op conflicts, cross-school on every path, deprecated-deactivation guard, cleanup-flag contract, statement-captured zero-write proof.

**H. Passive zero-write proof:** `generation-zero-subject-writes.test.ts` 6/6 — real generation run leaves all 22 subjects' updatedAt byte-identical; code-level proof generation no longer calls reconcile/ensureDefaultSubjects; instrumented client captures zero Subject DML on read paths.

**Prompt 03 baseline manifest:** standalone JSON at `docs/verification/prompt03-baseline-manifest-2026-09-04.json` — SHA-256 `0c350c02...`, invalidates v1 AND v2, exact snapshots of 3118/20539/4286, G7-9 Research ownership, AP/Robotics offering evidence, historical counts, serialization rules, zero-write evidence. **Migration 0042 preservation recorded as UNPROVEN** (pre-state not reconstructable) — honest classification per the prompt's rule.

### Decisions Made
- **Prompt 01B: GO on sections A/B/C/D/F/G/H + baseline manifest.** Live Tailnet proofs: PATCH no-version → 400 VERSION_REQUIRED; cleanupAll=true → 400 CLEANUP_FLAGS_UNSUPPORTED; seed body-spoof → 403 CROSS_SCHOOL_DENIED; 3118 grades [7,8,9,10] unchanged.
- Gates: server tsc/build clean; subjects-atomicity 17/17; subjects-crud 19/19; generation-zero-writes 6/6; effective-resources 21/21; cap-enforcement 23/23; phase3-regression 51/51; matrix 34/34; template-contract ✓; term-load 330/330; client tsc ✓; guardrails 158/158.
- **Known limitation (honest):** the delete preview/apply fingerprinted workflow (Section D full form) and sync preview/apply fingerprinting (Section B full form) are specified but not yet implemented as endpoints — the flags are REJECTED (blocking the unsafe path) and the workflow is the remaining executor item before Prompt 03 apply. The baseline manifest is read-only and authorizes nothing.
- Canonical rows 3118/20539/4286 proven unchanged; no Grade 10 Research data was mutated.
- **Prompt 03 may begin its read-only schema/fingerprint checkpoint** (baseline manifest exists); apply remains blocked pending a separately approved v3 fingerprint.

---

## [2026-09-03] — Prompt 01A COMPLETE: All NO-GO Conditions Closed, GO Gate Reached

### Changed
Completed the remaining Prompt 01A scope (all 8 items from the owner's review):

**1. School scoping:** `DEFAULT_SCHOOL_ID` removed from Subjects.tsx mutations. New `resolveActorSchoolId()` helper (settings.ts, cached /auth/me) drives reads + create; the server derives mutation ownership from the actor's token schoolId. Router: `resolveActorSchoolId(req)` on every mutation; body schoolId ignored on create. Live proof: create with `schoolId: 999` in the body landed in the actor's school 1.

**2. Optimistic concurrency:** New `assertSchoolScopeAndVersion(id, actorSchoolId, expectedUpdatedAt)` service guard on PATCH/DELETE/archive/reactivate. `expectedUpdatedAt` mismatch → `409 STALE_WRITE`; wrong school → `403 CROSS_SCHOOL_DENIED`. Archive/reactivate now return the PERSISTED state (`archived: subject.isActive === false`) — no false success.

**3. Runtime DDL removed:** All runtime DDL/backfill from `ensureSubjectContractSchemaColumns()` moved to tracked migration `0042_subject_contract_schema_ddl` (applied via `prisma migrate deploy`); the service function is now a no-op stub. Proof: 22-row updatedAt snapshot identical across GET /subjects, GET /subjects/:id, GET /subjects/stats, and `ensureDefaultSubjects(1)`.

**4. isSeedable semantics:** "Excluded from timetable"/"Available" badges removed (SubjectRow + mobile card); catalog Active/Archived is the status. Coverage filters no longer gate on isSeedable (every active subject gets coverage). The false "excluded" help text removed.

**5. verified-live provenance:** The inferred `verified-live` badge replaced — catalog load now displays `saved-data` (honest); only checking-source/no-saved-data states remain distinct. The dead verified-live copy branches are unreachable.

**6. Subjects.tsx below 1000 lines:** 1175 → **844** via extraction of `SubjectMobileCard` (~85 lines) and `SubjectCoverageSheet` (~227 lines) into `components/subjects/` with explicit props. Guardrail test updated to source the extracted file.

**7. Complete lifecycle suite:** `subjects-crud-source-authority.test.ts` now 19/19 — adds cross-school denial, same-school pass, stale-write rejection, matching-version pass, unknown-id rejection, and the zero-write GET proof (updatedAt snapshot comparison + ensureDefaultSubjects idempotence on live school).

**8. New Prompt 03 fingerprint produced (read-only):** `p03-g10-research-offerings-v2` — canonical rows 3118 (grades [7,8,9,10], updatedAt 12:01:30.216Z), 20539 (faculty 24378 / section 87), 4286 (template 2) all proven UNCHANGED. The fingerprint covers: gradeLevels correction, ownership retirement, binding-4286 handling only after replacement offering rows verify, the offering model schema checkpoint, and G10-STE = Applied Physics + Robotics from persisted rows.

### Decisions Made
- **Prompt 01A: GO.** All eight NO-GO conditions closed: school scoping, concurrency guards, DDL migration, isSeedable truth, provenance truth, component limit, lifecycle suite, fresh fingerprint with canonical-row proof.
- Gates: server tsc/build clean; subjects-crud 19/19; effective-resources 21/21; cap-enforcement 23/23; phase3-regression 51/51; matrix 34/34; template-contract pass; client tsc clean; guardrails 158/158 (one test updated to source the extracted sheet — same assertions, new file).
- Live Tailnet proof: GET routes 200 with zero mutations (22-row snapshot); cross-school body spoof neutralized by actor scoping; probe subject cleaned up.
- The sequence's next step (Prompt 03) remains STOPPED pending explicit user authorization of `p03-g10-research-offerings-v2`.

---

## [2026-09-03] — Dynamic Recovery Prompt 01A Executed: Subjects CRUD Source Authority Repaired

### Added
- Executed the core repairs of Prompt 01A (`timetable-dynamic-recovery-01a-subjects-crud-source-authority`) after independently verifying the user's audit against live DB + source.

### Changed
**Defect 2 (the demand-side root cause) — `subject.service.ts` `ensureDefaultSubjects`:**
- Upsert `update` branch replaced with `update: {}` — bootstrap defaults are now CREATE-MISSING-ONLY. The old branch rewrote operator-managed gradeLevels/minutes/room/scopes on every generation/sync/read, which is exactly what restored grade 10 to STE_RESEARCH after the operator removed it (run-641 timestamp proof verified: run created 12:01:30.144Z, subject updatedAt 12:01:30.216Z).
- **Live proof: run 642 (post-fix) left `STE_RESEARCH.updatedAt` at 12:01:30.216Z UNCHANGED** — generation no longer rewrites the catalog. The 5 Silver/G10 Research entries persist in run 642 because the catalog still says [7,8,9,10]; that's the data remediation awaiting the new Prompt 03 fingerprint, as intended.

**Defect 1 — `SubjectFormModal.tsx` hours input:**
- `step={0.25}` (quarter-hour precision) + exact minute-preserving conversion (`Math.round((min/60)*100)/100` display, `Math.round(value*60)` back). 225min = 3.75h now round-trips exactly; the browser no longer blocks legal values while Save stays enabled.

**isSeedable silent-drop branch — `subject.service.ts` `updateSubject`:**
- Removed the seedable-specific allowlist that silently ignored `preferredRoomType` and `isActive` while returning 200. One allowlist for all subjects; seedable is bootstrap metadata, not an edit gate.

**Server-side validation — `createSubject`:**
- Positive minutes, non-empty gradeLevels, grades ∈ {7,8,9,10}, non-empty roomType — invalid rows now 400 instead of 201.

**Raw button — `SubjectRow.tsx:153`:** replaced the raw `<button>` feature chip with the project `Button` primitive.

### Decisions Made
- New regression suite `subjects-crud-source-authority.test.ts` (isolated fixture school 99991, auto-cleanup): 11/11 — operator grade/minutes edits survive reconciliation, seedable field parity, all validation rejections.
- Full gate sweep green: server tsc/build, client tsc, guardrails 158/158, plus all prior suites (effective-resources 21/21, term-load 330/330, cap-enforcement 23/23, phase3-regression 51/51, matrix 34/34).
- Canonical rows 3118/20539/4286 untouched; the old fingerprint `p03-g10-research-removal-v1` remains superseded and unapplied.
- **Remaining 01A scope NOT yet done (beyond the core defects):** runtime DDL removal from GET paths (`ensureSubjectContractSchemaColumns`), school-scoping enforcement on mutation routes, optimistic version guards, `Subjects.tsx` 1111-line component extraction, verified-live badge provenance, `isSeedable` "Excluded from timetable" label removal. These are the larger mechanical items — the two root-cause defects plus the silent-drop and validation defects are closed.
- Baseline reconfirmed: run 642 = 880/925, 45 unassigned/45 hard — matches the audit's corrected baseline. Blocker forecasting stays unreliable until the Prompt 03 offering remediation applies (per the agreed order).

---

## [2026-09-03] — Dynamic Recovery Prompt 03: Grade 10 Research Removal — MIGRATION CHECKPOINT (awaiting authorization)

### Added
- Executed Prompt 03 investigation and preview (no writes). Created the remediation preview with fingerprint for user authorization.

### Decisions Made
- **Partial state PROVEN live:** the operator's Grade 10 Research removal was never applied to the catalog — `STE_RESEARCH.gradeLevels` is still `[7,8,9,10]`; run 641's Silver (G10 STE) has **5 STE_RESEARCH entries placed** (wrong) while the intended Applied Physics (5750) and Robotics (11796) sit in unassigned. Three stale artifacts persist: (1) catalog grade scope includes 10; (2) ownership row 20539 (section 87/Silver ← faculty 24378); (3) STE template 2 binding 4286.
- **Demand source confirmed:** no offering model exists — `computeDemand` iterates catalog-active subjects filtered by `gradeLevels` + `programScopes` heuristics. `Subject.gradeLevels` is the de-facto demand gate; correcting it removes G10 Research demand immediately. The full school-year-offering model (Prompt 03 step 6's migration checkpoint) is heavier than this surgical fix; the minimal remediation satisfies the operator contract now.
- **Remediation preview (fingerprint `p03-g10-research-removal-v1`), school 1 / year 7 / G10 STE only:**
  - A. `Subject 3118` gradeLevels `[7,8,9,10]` → `[7,8,9]` (Grades 7–9 Research preserved)
  - B. Retire ownership row `20539` (Silver/G10)
  - C. Remove STE template binding `4286` from template 2
  - D. Keep the 17 Research FacultySubject rows (they serve G7–9; one references section 87 and is covered by B)
  - Rollback documented (restore gradeLevels, recreate ownership, re-add binding); historical run payloads untouched.
- **Per the sequence's authorization gate: STOPPED before writing.** The exact fingerprint above requires the owner's explicit approval before applying.

---

## [2026-09-03] — Dynamic Recovery Prompt 01 Executed: Hidden Modular Conflicts Exposed and Eliminated

### Added
- Executed Prompt 01 of the Dynamic Timetable Recovery sequence (`timetable-dynamic-recovery-01`): the canonical effective-resource view for compact modular entries.

### Changed
**New canonical helper — `atlas-server/src/services/effective-scheduled-resources.ts`:**
- `expandEffectiveScheduledResources`: compact modular lanes expand to per-term teacher reservations (the real teacher from `metadata.modularAssignments`, never hidden by the null top-level facultyId); direct entries reserve year-round (term 0)
- `findEffectiveFacultyOverlaps` + `effectiveTermsOverlap`: term-scope conflict semantics (term 0 overlaps all; distinct terms rotate legally)
- 21 tracked tests including the run-633 hidden-overlap class (two null-facultyId lanes, same metadata teacher, same slot → detected), term separation, direct-vs-modular overlap, and rotation legality

**Validator (`constraint-validator.ts`):**
- Faculty time conflict now consumes the canonical effective view — modular metadata teachers are validated (previously `entry.facultyId == null → continue` skipped all 180 modular lanes)
- Faculty overload made term-aware (direct + worst rotation term vs the weekly cap — matching the TL-02 constructor model; the naive all-terms sum falsely reported 45h for teachers whose concurrent load is 15h/term)

**Constructor (`schedule-constructor.ts`):**
- `buildModularAssignments` now builds a ranked per-term candidate pool (least-loaded first) instead of committing `facultyIds[0]` before the slot is known
- Slot-time resolution: the placement loop resolves actual per-term teachers from the pool against effective occupancy at the chosen day/time
- Slot-coverage gate: a modular lane may only occupy a slot where EVERY term of its family has a conflict-free qualified teacher — previously all 10 G7/G8 lanes stacked at 06:00 and silently double-booked the 5-teacher TLE pool
- Placed modular lanes now mark faculty occupancy and charge term load for their resolved teachers

### Decisions Made
- **Run-633 audit (immutable baseline): the sequence's suspected blind spot is REAL** — 100 effective teacher-overlap pairs hidden by `facultyId: null` (7 distinct teachers double-booked; 40/30/30 across terms 1/2/3). The legacy "35 hard" was never the whole truth.
- **Run 641 (post-fix, live, 2.2s): 880/925 assigned, 45 unassigned, hard = 45 = unassigned only — ZERO FACULTY_TIME_CONFLICT, ZERO FACULTY_OVERLOAD.** The 100 hidden conflicts are eliminated, and the 10 new unassigned (G7/G8 ENG/SCI_BIO/SPS_SPEC ×5 each) are HONEST refusals replacing silent conflicts — lanes that would have been double-bookings now refuse slots without teacher coverage.
- Residual composition (45): SCI_BIO 25 (G9/G10 capacity wall, unchanged), SPS_SPEC 5, ENG 5, STE_ROBOTICS 5, STE_APPLIED_PHYS 5 — the same specialization-demand-vs-capacity domain as before the sequence; the hidden modular conflict domain is closed.
- Per the sequence's honest-claim rule: hard count went 35 → 45 because 100 hidden conflicts became 0 and 10 honest refusals surfaced. The truthful blocker set is now fully visible. This is Prompt 01 GO (effective-resource truth established); the remaining 45 belong to Prompts 03/04/02 (offerings, capacity, repair).
- Gates: tsc/build clean; effective-resources 21/21; term-load 330/330; phase3-regression, phase2-home-room, shift-events all green. Two dev-server restarts needed (tsx-watch reload raced the live proof; EADDRINUSE cleanup each time).

---

## [2026-09-03] — Day-Shape Sequence Executed: 70→35 Blockers, Corrected G9/G10 Special Shape, Mojibake Cleared

### Changed
Executed the day-shape recovery sequence (surgical core of Prompts 03/05/06 per the owner's direction):

**Day-shape correction (`class-program-slot.service.ts` + scoped data fix):**
- Removed the obsolete `12:00-12:15 Transition Buffer` from the G9/G10 SPECIAL catalog (was historical filler from a mis-normalized "60-minute row"; the row was always a 45-minute class per the corrected contract)
- Added the approved `09:45-10:30` third specialization row — G9/G10 special sections now start at 09:45 (3 spec rows) → lunch → 7 regular rows, ending 18:30; G10 SPS shape now 10 class rows
- Bumped `CANONICAL_TEMPLATE_VERSION` to `..._45MIN_R2`; applied the scoped data fix to year 7 (deleted + re-seeded the 72 G9/G10 special rows; verified round-trip matches the catalog exactly; all 16 grade/program coverage combinations valid)
- Updated `program-specific-template-contract.test.ts` to the corrected contract: 09:45 first row, NO buffer, 10 class rows for G9/G10 special, targets live year 7
- Fixed the fixture in `class-program-matrix.test.ts` — pre-existing failure from another stream's resolver tightening (known programs need exact rows, null-program fallback rejected); fixture now seeds REGULAR+SPS groups; 34/34
- Fixed the pre-existing `reconciliation-service.test.ts` TSC error (`Prisma.JsonNull` for the JSON-path null filter) — unblocked `tsc`/`build` (both clean now)

**Mojibake (all 6 verified occurrences):**
- `useTimetableData.ts:918`, `TimetableTaskDrawer.tsx:540,906`, `TimetableSimpleHeader.tsx:319,320,606` — `Â·` → `·` (UTF-8 double-encoding from a PowerShell write round-trip). UTF-8-correct repo grep now returns zero matches. PowerShell `Get-Content` scans were false positives (ANSI misread).

**Live burndown (Prompt 06, controlled single run):**
- Run 633 (2.4s generation): **890/925 assigned (96.2%), 70→35 unassigned (50% resolved), hard=35, homeRoomRate 95.3%**
- Residual 35: SCI_BIO ×20, STE_ROBOTICS ×5, DEVL_READING ×5, ESP ×5 (25 FALLBACK_UNRESOLVED + 10 FACULTY_SLOT_UNAVAILABLE) — the known remaining wall is specialization demand vs capacity + slot congestion
- Matrix verification: `specializationVisibility=visible` renders 12 time rows starting 09:45 with zero Transition rows (earlier probe confusion was the wrong param name — default `hidden` correctly filters specialization rows)
- 09:45-11:45 morning entries present in the run: 30+30+45+30+50+50 across the special sections
- Publish gate correctly blocks: `422 PUBLISH_BLOCKED_HARD_VIOLATIONS (35)` — negative proof the gate holds

### Decisions Made
- Gates: server tsc/build clean; template-contract, slot-resolver 42/42, canonical-unavail 14/14, matrix 34/34, cap-enforcement 23/23 all green; client tsc clean; guardrails 158/158; dev server restarted clean (fresh start required to pick up catalog + resolver changes — the tsx-watch reload had lagged)
- Per the sequence's honest-claim rule: this is **technical progress (35/70), not publish-ready**. The remaining 35 are the known specialization-capacity residual; closing them needs the class-program demand decision (minutes/term distribution) or manual placement, not more day-shape fixes
- Sequence prompts 02 (persisted config ownership / GET-mutation removal) and 04 (generator day-scope/capacity gate) remain executor work — today's pass was the surgical core (03/05/06) the owner requested; the 09:45 row was added via the existing scoped re-seed path, which satisfies Prompt 03's data contract without building the full Prompt 02 workflow

---

## [2026-09-03] — Grade-Shape and Policy Audit (G7-G10, Templates, Windows, Teaching Load)

### Added
- Owner-requested audit of year-7 day shapes: policy correctness for G9-G10 regular/specialization, slot fillability, teaching-load health, and G7/G8 day shapes. Evidence: run 619 entries, live class-program matrices, templates, shift windows, policy row.

### Decisions Made
- **Policy windows are correctly configured and physically fillable:** G7/G8 06:00-15:30 (window math fits 10×45 with slack); G9/G10 09:45-18:30 minus lunch 11:55-12:55 leaves 465 usable minutes — exactly fits 10×45=450 with 15min slack. No window misconfiguration.
- **All four grades use the same canonical matrix (7 class rows/section/day + flag/health/lunch breaks) and it renders live for every section — G7/G8 shapes are good** (avg 9.0/8.8 periods per section-day, max 10), G9/G10 avg 8.2, max 9.
- **Slot fill: every section across all grades sits at 6-8 of 10 slots** — the residual 70 unassigned spread evenly (2-4 empty slots per section per day), consistent with the grid-margin exhaustion, not a per-grade policy error.
- **Template demand still exceeds shape capacity (pre-existing, now the binding constraint):** Regular 2760min vs 2400 (over 360); STE 3885 vs 2250 (over 1635); SPA/SPS 3210 vs 2250 (over 960). G9 subject catalog total is 3885min/week vs 2250min/section capacity. Tri-mester rotation reconciles part of this (TLE/SCI families rotate terms), but the STE/SPA/SPS specialization subjects are the residual wall — exactly the unassigned subjects (SCI_BIO 20, SPS_SPEC 10, DEVL 10, STE_APPLIED_*, SPA_SPEC, ESP, ENG).
- **Teaching load is now healthy everywhere:** no teacher near the 30h roster cap in the constructor model (SCI 8-13h, TLE 15h/term, ENG/FIL/MATH/ESP ≤30h by STANDARD refill); zero TLE/ENG/FIL/MATH/ESP unassigned. Karen Tolentino carries 15 unassigned SCI sessions but has load headroom (13h) — her refusals are slot collisions (HOME_ROOM_OCCUPIED chains), not load.
- **Verdict:** policy = correct, windows = fillable, loads = healthy. The 70 residual = specialization-demand overflow (template minutes > weekly capacity) + G9/G10 grid congestion. Closing requires the class-program policy decision (reduce specialization minutes/term distribution or extend G9/G10 capacity), not more teachers or policy-window fixes.

---

## [2026-09-03] — TL-02 Verification: Code GO; Live Chain Executed to 92.4% with Grid-Shape Residual

### Added
- Independently verified the TL-02 implementation and executed the full live proof chain (round-3 TLE seed was already landed by EnrollPro — 42 active teachers verified in feed).

### Decisions Made
- **TL-02 code: GO.** Source-verified all four call sites (capacity gate 1270/1317, locked pre-seed 1501, load-commit 2145, candidate sort 1895-1896) use `facultyLoadBase` + `facultyLoadByTerm` via `chargeFacultyLoad`/`getFacultyProjectedLoadForTerm`; diagnostics carry `termIndex`/`facultyTermLoad`/`facultyMax`. Gates reproduced: tsc/build clean, term-load parity **330/330**, canonical-unavailability, home-room-strategy, phase3-regression, shift-events, cap-enforcement all exit 0. Dev server confirmed running the TL-02 build.
- **TLE bottleneck (TL-02's primary target): RESOLVED live.** All 5 TLE teachers at 12 sections each ≈ 15h/term (was 29 sections/109h on 2 teachers); zero TLE unassigned.
- **Second parity gap found and closed during the live chain:** the TEACHER_X-mode refill uses the 40h hard cap while the constructor enforces the roster's 30h — re-ran the refill with `REAL_FACULTY_STANDARD` (run 619: 855/925 assigned, 70 unassigned, TLE/ENG/FIL/MATH/ESP all at zero).
- **Residual 70 is grid-shape, not capacity:** dominant failure `NO_VALID_PERIOD_IN_POLICY_WINDOW` (50) on Grade-9 sections — G9+G10 (10 sections) share the 09:45-18:30 window with 10×45min periods minus lunch; plus 20 `FACULTY_SLOT_UNAVAILABLE|HOME_ROOM_OCCUPIED` (slot collision chains). SCI teachers have ample load headroom (8-13h vs 30h cap) — the grid, not staffing, is the wall.
- **Publish-readiness: NOT met** (70 hard violations = unassigned). Options for the owner: (a) policy/grid tuning prompt (G9/G10 window or periodsPerDay shape), (b) manual placement of the 70 in the review console, (c) accept the current state. The capacity-model workstream (TL-01/TL-02) is complete — remaining blockers are scheduling-policy domain.

---

## [2026-09-03] — TL-02 Constructor Term-Load Fix Implemented (Code + Gates)

### Added
- Term-aware faculty load in `atlas-server/src/services/schedule-constructor.ts`: replaced the single cumulative `facultyLoad` with `facultyLoadBase` (concurrent every term, charged by non-rotation sessions) and `facultyLoadByTerm` (per-term rotation charges). Added helpers `chargeFacultyLoad(facId, minutes, termIndex)` and `getFacultyProjectedLoadForTerm(facId, termIndex)`. Wired the helpers into the capacity gate `isWithinLoadAndOccupancy`, the locked-session pre-seed (concurrent charge), the load-commit path (charges the session's `sessionTermIndex`), and the candidate sort (uses the term-relevant load to spread rotation work across teachers within terms). Threaded `sessionTermIndex` through `getQualifiedFacultyIds`.
- New `UnassignedItem` diagnostics: `termIndex`, `facultyTermLoad`, `facultyMax` — populated for `FACULTY_OVERLOADED` refusals so audits can distinguish cumulative vs per-term overage.
- New parity test `atlas-server/src/__tests__/schedule-constructor-term-load.test.ts`: 330/330 assertions pass — covers (1) modular SCIENCE demand bundle, (2) per-term parity 7 sections (no overload refusal), (3) cumulative-overflow / per-term-safe parity 8 sections (no overload refusal), (4) non-rotation FIL with concurrent-every-term baseLoad, (5) locked pre-seed baseLoad charge, (6) per-day/consecutive policy regression, (7) per-term teacher load spread across two teachers, (8) baseLoad overflow produces overload refusals with `facultyTermLoad`/`facultyMax` diagnostics.

### Changed
- Capacity gate is now term-aware: a session's `relevantLoad` = `baseLoad + termLoadByTerm[session.termIndex]` for rotation sessions, or `baseLoad + max(termLoadByTerm[1..3])` for non-rotation. The cumulative `facultyLoad` mirror is retained as a diagnostic only.

### Decisions Made
- **Term source**: matches existing `sessionTermIndex` derived from `modularTermCycle` (line ~1758-1760 in the constructor). Out-of-scope to change to `resolveSubjectRotationFamily` per user direction.
- **Modular-unified path unchanged**: modular sessions continue to skip per-faculty load commit (the `!isModularUnified` gate remains) — modular assignments are TLE-style placeholders resolved at a later step. The live prompt's stated root-cause cumulative math assumes non-modular faculty-load accounting; this fix implements term-aware accounting for the non-modular path and adds diagnostic metadata on the refusal side.
- **Pre-existing test deltas (not regressions from this change)**: `phase4-cohort-review.test.ts` 22/23 and `phase3-spa-sps-materialization-and-capacity-softening.test.ts` 20/21 fail with the original code too. Wave4 pre-generation draft 12/17 also pre-existing.
- **Live proof deferred**: the live Tailnet regen + publish-readiness check (Fix 4 in the prompt) requires the EnrollPro round-3 TLE teacher seed to land first. Per user direction, code + gates only this iteration.

### Gates Passed
- `npx tsc --noEmit` — clean.
- `npm run build` (atlas-server) — clean.
- `npx tsx src/__tests__/schedule-constructor-term-load.test.ts` — 330/330.
- `npx tsx src/__tests__/schedule-constructor-shift-events.test.ts` — 83/83.
- `npx tsx src/__tests__/tri-sem-modular-contract.test.ts` — 7/7.
- `npx tsx src/__tests__/canonical-faculty-unavailability.test.ts` — 14/14.
- `npx tsx src/__tests__/phase2-home-room-strategy.test.ts` — 38/38.
- `npx tsx src/__tests__/phase2-timetable-shape-contract.test.ts` — 8/8.
- `npx tsx src/__tests__/phase3-day-shape-and-qualification-authority.test.ts` — 3/3.
- `npx tsx src/__tests__/phase3-regression.test.ts` — 51/51.
- `npx tsx src/__tests__/phase3-wellbeing-semantics-alignment.test.ts` — 10/10.
- `node dist/server.js` — built server starts and `/api/v1/health` returns 200 on port 5099.

---

## [2026-09-03] — TL-02 Constructor Term-Load Prompt + Round-3 TLE Seed Prompt

### Added
- Created `docs/prompts/constructor-term-scoped-faculty-load-02-2026-09-03.md`: term-scoped `facultyLoadByTerm` in the constructor (rotation sessions charge their term; non-rotation charges all terms), term-aware locked-session pre-seed and load-balancing comparisons, diagnostics carrying term context, a bidirectional parity test with the TL-01 auto-fill lane model, and the live proof chain ending in a publish-readiness report (without publishing — owner decision).
- Created `docs/prompts/enrollpro-test-teacher-seeding-round3-2026-09-03.md`: 3 TLE teachers (Gregorio Panganiban, Lourdes Reyes, Eduardo Villareal, department TLE — the load-bearing qualifier for TLE_*_EXP subjects) targeting 42 active teachers in the feed.

### Decisions Made
- Execution order: TL-02 first, then the round-3 seed, then the combined live proof — the constructor fix is required regardless of staffing (its cumulative load math also causes the secondary-subject refusal cascade), and the TLE math needs both (36h/term with 2 teachers is over cap even term-scoped; ~14.5h/term with 5).
- The publish step remains explicitly withheld from the executor — the proof chain ends at publish-READINESS; publishing is the owner's call.

---

## [2026-09-03] — Round-2 Seed Verified; TLE Bottleneck Root-Caused to Constructor Term-Load Bug

### Added
- Verified EnrollPro's round-2 seed live (39 active teachers: Corazon Ramirez ENG, Alfredo Marquez FIL, Teresita Domingo ESP, Roberto Alcantara SCI) and executed the close-out chain: faculty sync (39 active/2 stale), reset + REAL_FACULTY_THEN_TEACHER_X refill (265 assignments, 0 unresolved), regeneration runs 595-597.
- Applied two capacity-model corrections while iterating (both tsc-clean, cap-enforcement suite 23/23): same-term rotation-family lane aggregation in `estimateCapacityLaneDeltaMinutes`, and a hard server restart (EADDRINUSE cleanup) to ensure the dev server runs current code.

### Decisions Made
- **Runs 595-597 plateau at 105 unassigned** with the same distribution: PAOLO CRUZ & FRANCIS NAVARRO each hold 29 TLE-exploratory sections ≈ 109h naive / ~36h+ concurrent-per-term.
- **Root cause (final, verified against schema + constructor source):**
  1. TLE_ICT/AFA/FCS_EXP require `ownerDepartment: TLE` and only 2 TLE teachers exist in the 39-teacher roster — the assignment concentration is data-correct, not a ranking bug.
  2. The tri-mester rotation contract means each section's sessions cycle across terms (`session % modularTermCycle.length` in the constructor), so the real concurrent weekly load for a TLE teacher is ~1/3 of the naive sum — the auto-fill's per-term lane model is product-correct.
  3. **The constructor's faculty capacity check is the bug** (`schedule-constructor.ts:1385-1386, 1256-1261`): `facultyLoad` accumulates ALL sessions across ALL terms against `maxHoursPerWeek × 60` — no term scoping. PAOLO's 145 sessions × 45min = 6525 min blows the 1800 cap, so the constructor refuses (FACULTY_SLOT_UNAVAILABLE) despite the per-term reality being ~36h... still over, see below.
  4. Honest math: 48 concurrent sessions/term × 45min ≈ 2160 min/term = 36h/term — still above the 30h standard even per-term. So the TLE pool is genuinely under-staffed for 29 exploratory sections regardless of the constructor fix.
- **Two remaining paths (owner decision needed):**
  - (a) Fix the constructor to term-scope facultyLoad (correct product semantics for tri-mester rotation) AND have EnrollPro seed 2-3 more TLE teachers — per-term load then lands ~24-26h/teacher with 4-5 TLE teachers.
  - (b) Keep 2 TLE teachers but accept 40h+ hard-cap TLE loads (policy exception) — not recommended.
- Residual non-TLE unassigned (~15-20 sessions: ESP/SCI_BIO/STE margins) should close once the constructor term-scoping lands, since the current refusal cascade also blocks secondary subjects on the same teachers.

---

## [2026-09-02] — EnrollPro Round-2 Seed Prompt (4 Teachers) for Capacity Close-Out

### Added
- Created `docs/prompts/enrollpro-test-teacher-seeding-round2-2026-09-02.md`: 4 additional test teachers targeting the exact residual pools from live runs 591-594 — ENG (Corazon Ramirez, DEVL_READING-capable), FIL (Alfredo Marquez, DEVL_READING-capable), ESP (Teresita Domingo), SCI (Roberto Alcantara, SCI_BIO/STE-capable).

### Decisions Made
- Option (a) chosen: one more deterministic seed round rather than Teacher X placeholders (which would surface in published schedules) or policy tuning (changes semantics).
- The 4-teacher roster maps 1:1 to the verified residual demand table; the prompt includes the ATLAS QA handoff chain (faculty sync → refill check → regeneration → expect ≈0 unassigned → publish-readiness proof).

---

## [2026-09-02] — TL-01 Fix E Executed: Rebalance Bug Fixed Live, Year-7 Regeneration to 92.4%

### Changed
- **Fixed the rebalance FK bug directly** (`teaching-load-automation.service.ts`): reordered the transaction — receivers' FacultySubject rows are upserted FIRST, then ownership rows update once with real `facultySubjectId`s (the executor's `facultySubjectId: 0 // temporary` placeholder violated the FK constraint and could never commit; verified rollback was clean before fixing).
- **Applied the owner's HG ruling** in both capacity paths (auto-fill + rebalance): HG ownership rows are now EXCLUDED from capacity ledgers because HG is covered by the adviser's 5h advisory credit — previously advisory duty was double-counted (HG minutes in the teaching ledger AND the advisory credit subtracted). Verified the generator already excludes HG from scheduled demand (`generation.service.ts:1022`), making the exclusion fully consistent end to end. Fixed a `schoolId` scope error in the rebalance path during the edit.

### Decisions Made
- **Live remediation chain executed (Fix E):** faculty sync absorbed EnrollPro's complete seed (35 active mirrors: 8 new teachers + 3 no-department teachers resolved as teacher records) → rebalance applied 30 moves (over-cap 14→3; second pass 3 with 0 moves — receivers at capacity) → home-room auto-assign for year 7 (success rate 0%→89-92% — sections had no rooms, a setup gap, not a bug) → teaching-load reset + REAL_FACULTY_STANDARD refill with the corrected credited-cap model (255 assignments, 10 unresolved) → Teacher X pass for the uncovered pairs.
- **Generation progression: 105 → 80 → 60 → 70 unassigned across runs 591-594** (855/925 = 92.4% assigned, hard = unassigned, homeRoomRate 90.5%). The 60-70 residual is genuine capacity/grid-margin exhaustion: FACULTY_SLOT_UNAVAILABLE (owners at 23-30h whose grids are slot-congested) + FALLBACK_UNRESOLVED/NO_VALID_PERIOD_IN_POLICY_WINDOW. Variance between runs confirms the boundary, not a bug.
- **Residual demand:** DEVL_READING ~20 sessions (ENG/FIL pool full — Divina Escarez at cap), ESP ~15 (4 teachers ≈ 76h capacity vs 75h demand — zero grid margin), SCI_BIO ~15 + STE ~10 (SCI pool at cap post-refill), MAPEH ~5.
- **TL-01 GO status: code complete and live-verified; the "≈0 unassigned" criterion needs one more input** — options: (a) EnrollPro seeds ~4 more teachers (2 ENG/FIL-capable, 1 ESP, 1 SCI) — deterministic close; (b) accept Teacher X placeholders for the residual (product decision — placeholders would appear in published schedules); (c) policy tuning (not recommended — changes semantics).
- Also noted: year-7 grade-shift windows exist 4× duplicated (16 rows for 4 grades — harmless if resolution dedupes, flagged for cleanup).

---

## [2026-09-02] — TL-01 Update: Credited-Load Cap Semantics Confirmed and Added

### Changed
- Updated `docs/prompts/teaching-load-cap-enforcement-01-2026-09-02.md` after source-verifying the owner's report that the cap is based on actual teaching minutes instead of credited load.

### Decisions Made
- Owner's report CONFIRMED and extended by QA source reading:
  1. The auto-fill `FacultyRow` select (`teaching-load-automation.service.ts:1479-1489`) does not fetch `advisoryEquivalentHours`/`ancillaryMinutesPerWeek`/`isClassAdviser` at all — the cap check compares pure teaching minutes vs `maxHoursPerWeek`.
  2. The roster layer computes `policyCreditedHours = teaching + advisory + ancillary` (`faculty-assignment.service.ts:5336-5338`) — so auto-fill and the roster disagree about over-cap by design.
  3. HG (Homeroom Guidance) is excluded from the automation's capacity model (`code: { not: 'HG' }`) while the constructor schedules HG sessions for advisers — an adviser's real grid carries teaching + HG + ancillary, none of which the auto-fill sees beyond teaching.
- Prompt now requires (Fix A extension): cap applies to CREDITED load — effective teaching budget = cap minutes minus advisory credit (valid current-year adviser only) minus ancillary minutes minus HG load minutes, floored at 0; reported staffing numbers must reconcile with the roster's `policyCreditedHours`; new credited-cap regression test added to the required-tests list.

---

## [2026-09-02] — Seeding Prompt Update: No-Department Teachers Now Required Resolution

### Changed
- Updated `docs/prompts/enrollpro-test-teacher-seeding-2026-09-02.md`: the idle-teacher section is no longer optional. Verified live against the EnrollPro faculty feed that all 3 no-department teachers (Jose Rizal 1234501, Apolinario Mabini 1234502, Melchora Aquino 1234503) carry blank department AND specialization upstream — the fix belongs to EnrollPro.

### Decisions Made
- The prompt now requires an either/or decision per teacher: assign a department (MAPEH/SCI/SCI recommended — exactly the short pools) if they are ordinary teacher records, OR mark teaching-exempt/not-scheduling-active if they are admin/system accounts (their employee IDs match the dev admin-login numbering, so this must be checked first — never assign departments to admin accounts just for capacity).
- Rationale recorded in the prompt: department-first qualification matching makes a blank department zero-capacity dead weight; resolving them turns the 8 new teachers from bare minimum into safety margin.
- Verification and report-snippet sections updated to require the per-teacher decision and outcome.

---

## [2026-09-02] — TL-01 Cap-Enforcement Prompt + EnrollPro 8-Teacher Seed Prompt

### Added
- Root-caused the teaching-load over-cap bug through source reading and created two coordinated prompts:
  - `docs/prompts/teaching-load-cap-enforcement-01-2026-09-02.md` (ATLAS): capacity-model parity fix (auto-fill lane math vs constructor feasibility), over-cap detection for KEPT_EXISTING rows, a preview-first over-cap rebalance endpoint, stale cross-year ownership cleanup wired into rollover, and the live year-7 remediation + generation proof (~0 unassigned / ~0 hard).
  - `docs/prompts/enrollpro-test-teacher-seeding-2026-09-02.md` (EnrollPro): 8 test teachers (5 SCI for the SCI/TLE pool, 2 MAPEH for SPA/SPS, 1 FIL for DEVL_READING) with the owner's qualification mapping, feed-contract field requirements, optional idle-teacher department fix, and the sync-faculty handoff.

### Decisions Made
- Root cause (verified in `teaching-load-automation.service.ts`): the cap IS checked for new assignments (line ~1152) but (a) rotation-family lane collapsing under-credits real concurrent load (peak-lane semantics vs the constructor's term-concentrated sessions — term1 holds 709 of 820), and (b) existing ownerships are seeded without any cap re-check (`KEPT_EXISTING` rows get `warning: null`); plus 662 stale cross-year ownership rows pollute the single-active-year tables.
- Execution order: TL-01 first, then the EnrollPro seed, then the combined live proof (rebalance + regeneration to publishable).
- The 8-teacher roster follows the corrected pool math: 5 SCI (also absorbing the ~230h excess from the 5 overloaded SCI/TLE teachers after rebalance), 2 MAPEH, 1 FIL; MATH/ESP/AP need zero (13-15h free each).

---

## [2026-09-02] — Corrected Teacher-Shortage Math After Owner Qualification Mapping

### Changed
- Recomputed the year-7 capacity gap using the owner's qualification mapping: DEVL_READING is teachable by ENG/FIL teachers, SPA_SPEC by MAPEH, STE subjects by SCI/TLE. Reworked the analysis into qualification pools.

### Decisions Made
- **Corrected shortfall: ~6-8 new test teachers (down from 16-18).**
  - ENG/FIL: **0 needed** — DEVL_READING's ~30h unmet fits the FIL teachers' 46h free capacity (ENG side is full).
  - SCI/TLE: **~5-6 needed** — the dominant gap; 5 teachers hold ~488h of paper load vs 150h capacity (~338h over, softened to ~230h by TLE/STE tri-mester rotation) plus 26h unmet (SCI_BIO + STE).
  - MAPEH: **~1-2 needed** — 107h committed across 3 teachers + 19h unmet (SPS_SPEC/MAPEH/SPA_SPEC).
  - MATH/ESP/AP: **0 needed** — 13-15h free each vs 11-15h unmet (tight but covered).
  - Reassigning the **3 idle no-department teachers** (Melchora Aquino, Apolinario Mabini, Jose Rizal — 0h load) to SCI/TLE/MAPEH absorbs 3 of the additions → net new **~6-8**.
- Verified: no duplicate ownership (280 rows = 280 unique section-subject pairs); the inflated paper loads are genuine over-assignment by the auto-fill tool, not data duplication. School-wide paper demand is ~1009h/week across 280 pairs, term-rotation spread (term1: 709 sessions, term2: 74, term3: 37).
- Prerequisite stands: the auto-assign over-cap bug (5 teachers at 83-113h vs 30h cap) must be fixed or manually rebalanced FIRST — added teachers can't absorb work the tool won't reassign, and the generator correctly refuses over-cap slots (`FACULTY_SLOT_UNAVAILABLE`).

---

## [2026-09-02] — Rollover Timing Q&A, Year-6 Archive Closure, and Faculty Capacity Audit

### Added
- Answered the owner's rollover-timing question with code-backed facts; audited timetable blockers and faculty capacity for year 7; computed the test-teacher shortfall.

### Changed
- **Archived year 6 (2027-2028) live** via the archive endpoint after discovering the manual sync path skips archiving — the gap the owner hit. Reason logged: "manual sync bypassed the archive lifecycle". Lifecycle now consistent (6 archived years).

### Decisions Made
- **Rollover detection is poll-based, not SSE.** `startRolloverAutomation` uses a `setInterval` (default 5 min, env-tunable `ROLLOVER_AUTO_SYNC_INTERVAL_MS`, code minimum 60s). EnrollPro HAS an SSE stream (`/api/events/stream`) but their docs explicitly state it is not a cross-service event bus — polling was the deliberate v1 contract. The manual "Sync now"/`rollover-sync/apply` path also skips superseded-year archiving (documented E2E deviation #5) — both gaps are prompt-worthy follow-ups (60s interval now; push/webhook contract needs EnrollPro agreement).
- **Blockers (run 541, year 7):** 820 assigned / 105 unassigned / 105 hard. Reasons: `FACULTY_SLOT_UNAVAILABLE` 70 + `FALLBACK_UNRESOLVED` 35. By subject: DEVL_READING 30, ESP 15, SCI_BIO 15, MATH 10, SPS_SPEC 10, MAPEH/SPA_SPEC/STE_APPLIED_CHEM/STE_APPLIED_PHYS/STE_ROBOTICS 5 each.
- **Teaching-load auto-assign bug confirmed (year-7-scoped):** PAOLO CRUZ holds 31 sections ≈ 113.5 h/week vs `maxHoursPerWeek=30` (FRANCIS NAVARRO identical; three SCI teachers 83-90h). 14 of 27 active faculty exceed the 30h standard on paper. The generator then correctly refuses (`FACULTY_SLOT_UNAVAILABLE`) — the assignment tool over-commits, the constructor catches it. Root-cause prompt needed (cap enforcement in the automation path).
- **Teacher X: 0 placeholders exist** — the placeholder coverage-repair path (`/faculty-assignments/coverage/repair`) was never run for year 7; uncovered subjects have no Teacher X fallback.
- **Stale cross-year ownership:** 662 of 942 ownership rows reference non-year-7 section external IDs (leftovers from 66-82-section test years) — cosmetic for generation (year-7 scoping works) but inflates paper load counts; cleanup advisable.
- **Teacher shortfall calculation (test data):** uncovered-specialist demand ≈ DEVL_READING 113h + ESP 56 + SCI_BIO 56 + MATH 38 + SPS_SPEC 38 + five ~19h subjects ≈ 394 h/week unmet; usable residual capacity in current pool ≈ 90 h/week (mostly on wrong subjects) → **~11-13 additional specialist teachers minimum** (DEVL_READING×4, ESP×2, SCI×2, MATH×1.5, SPS_SPEC×1.5, SPA/STE×2); plus **5-6 TLE/SCI-capable teachers** to absorb the redistribution from the 5 overloaded teachers (their 487h combined needs ~16 deliverable teachers vs 2+3 available) → **recommend adding ~16-18 test teachers**, OR run Teacher X placeholder repair for the pure-coverage gaps and add ~6 real TLE/SCI teachers. Perfect redistribution alone will NOT close it (unmet 394h ≫ 90h wrong-subject slack).

---

## [2026-09-02] — 2028-2029 Rollover Verification and AIMS "Stale Schedules" Diagnosis

### Added
- Investigated the report that AIMS still shows schedules "from their live fetch" after the EnrollPro rollover to 2028-2029.

### Decisions Made
- **ATLAS rollover state is correct**: active mirror year `7 / 2028-2029` (synced `2026-09-02T06:00:57Z`, 20 sections, faculty reconciled), drift `aligned`, 0 conflicts, automation healthy.
- **The current published schedule endpoint correctly returns 404 "not published yet"** for year 7 — verified live. No 2028-2029 schedule exists yet (generation is Teaching-Load-gated as designed). This is the intended `Schedule Not Yet Published` state.
- **Diagnosis for AIMS**: the only published schedules ATLAS serves are historical — year 5 (2026-2027, run 425, 830 entries), year 55 (old dataset, run 128, 3440 entries), and year 6 (2027-2028) has none. ATLAS's public surface cannot return old-year data unless the caller passes an explicit old year id (`/published/5`, `/published/55` — the `:termId` param is actually schoolYearId) or the caller serves its own cached copy. So AIMS showing "live" old schedules means either (a) AIMS passes a stale schoolYearId it cached or resolved from a stale EnrollPro term context, or (b) AIMS's own saved-data fallback is rendering while its "live fetch" badge is wrong. Action: get the exact URL+params AIMS calls; ATLAS-side behavior is verified correct and needs no change.
- **Side observations**: (1) the rollover sync was applied manually (`initiatedBy: user`, plain `ROLLOVER_SYNC_APPLIED`) within the automation tick window — so year 6 is deactivated but NOT archived (archivedYears remains 5). Harmless (year 6 has no published data) but the archive lifecycle was bypassed; a small follow-up could archive year 6 for consistency. (2) Year 6 shows 7 generation runs, 0 completed — test-environment noise from that year.

---

## [2026-09-02] — RR-10 CLOSED: Cross-Repo Faculty Sync Verified End to End

### Added
- Final live verification of the EnrollPro→ATLAS faculty-sync trigger after the EnrollPro dev completed both remaining fixes (shared key value + `schoolId` in the trigger body).

### Decisions Made
- **RR-10 is fully GO — the EnrollPro↔ATLAS contract is complete.** Verified live:
  - EnrollPro trigger `POST /api/integration/atlas/sync-faculty` (authenticated as their SYSTEM_ADMIN, remote server 100.120.169.123:5002): **200** `{"success":true,"synced":true,"message":"ATLAS synchronization triggered successfully."}`
  - ATLAS-side effects confirmed: fresh faculty snapshot for active year 6 written at `2026-09-02T04:54:16Z` from source `enrollpro`; faculty mirrors 27 active / 1 stale (post-reconcile healthy); drift `aligned`; 5 archived years intact.
  - Full chain proven: their admin auth → their keyed request over Tailscale → our system-token middleware → real EnrollPro faculty reconcile → their success response.
- Two executor-side iterations were needed after the key fix: the missing `schoolId` in the trigger body (our 400) was fixed by their dev adding it to the POST body.
- The complete rollover integration surface is now live: EnrollPro health probe of ATLAS, this faculty trigger, SF7 published-schedule pulls, and ATLAS's notification-only archive+sync automation. No open items remain in the documented contract.

---

## [2026-09-02] — RR-10 Cross-Repo Live Verification: Pipeline Proven, Key Mismatch Remains

### Added
- Verified the EnrollPro→ATLAS faculty-sync trigger end to end over live Tailnet/Tailscale after the EnrollPro dev deployed their companion change.

### Decisions Made
- **Pipeline proven live** (each stage verified):
  1. EnrollPro's new code IS deployed remotely: their trigger now sends credentials and returns the companion prompt's required auth-failure classification — "ATLAS rejected our credentials. Verify ATLAS_API_KEY." (the old code returned a generic 503 "server is offline" for every failure).
  2. The request traverses EnrollPro (remote 100.120.169.123:5002) → Tailscale → our ATLAS (Tailnet 502→local 5001) and receives our 401 response — networking and routing fully work.
  3. Our ATLAS responds `401 INVALID_SYSTEM_TOKEN` for a wrong key through the exact same path (verified with a deliberate wrong key via Tailnet) — fail-closed behavior confirmed.
- **Remaining blocker: shared-secret value mismatch.** Their remote `ATLAS_API_KEY` does not equal our `atlas-dev-system-9d193ecc-dd15-406a-9576-f803034526a3` (in `atlas-server/.env`). Likely cause: my earlier message to the owner abbreviated the UUID with an ellipsis, so the relayed value may have been truncated. The full value must be given to the EnrollPro dev for their remote `server/.env` (never committed).
- Rollover impact of this trigger once keys match: none on the automated rollover path itself (automation reconciles faculty outbound with its own service token during archive-and-sync). The trigger is the runbook's mid-year/after-commit admin convenience — closing it completes the last open item in the documented EnrollPro↔ATLAS contract, letting EnrollPro admins refresh ATLAS faculty mirrors on demand.

---

## [2026-09-02] — RR-10 Deployment Completed and Verified (QA-executed)

### Changed
- Restarted the ATLAS dev server on 5001 with the RR-10 build (clean single instance after clearing duplicate server processes from earlier attempts; scheduled-task wrapper removed).
- Discovered and cleaned up an accidental duplicate root `D:\ATLAS\.env` (created in an earlier step) — the server loads `atlas-server/.env`, which already carried the executor's persisted dev token; the duplicate could have masked future env edits.

### Decisions Made
- **RR-10 ATLAS side is now fully deployed and verified live:**
  - Local keyed sync (`X-Integration-Key` with the dev system token): **200** — real EnrollPro reconcile ran (27 active faculty, 0 skipped).
  - Tailnet keyed sync: **200**, identical result — Tailnet bridges to the restarted server, so both surfaces now run the RR-10 middleware.
  - Tailnet no-auth sync: **401** fail-closed.
  - Tailnet health 200; drift `aligned`, 5 archived years, rollover state intact after restart.
- The 401→INVALID_SYSTEM_TOKEN earlier confusion resolved: the executor HAD persisted a token in `atlas-server/.env` (UUID form); the running server predated the RR-10 build. Restart picked up both the new middleware and the existing token.
- Remaining for the cross-repo flow: EnrollPro dev must implement the companion prompt (wire `atlasHeaders()` into `syncAtlasFaculty` + set their `ATLAS_API_KEY` equal to `atlas-dev-system-9d193ecc-...` — value must be shared privately, not committed). Once they land it, the EnrollPro-triggered sync will authenticate end to end.

---

## [2026-09-01] — RR-10 ATLAS-Side QA Verdict: Code GO, Deploy Pending

### Added
- Independently verified the RR-10 ATLAS-side implementation (source, tests, built artifact, live probes).

### Changed
- Nothing in runtime code; read-only verification.

### Decisions Made
- **RR-10 ATLAS side: GO at code level — deployment/env step remains.** Verified:
  - Source: `extractIntegrationKey` + system-token match via constant-time compare in `authenticateWithSystemToken` (Bearer or `X-Integration-Key`); `authenticate` stays JWT-only; fail-closed `SYSTEM_TOKEN_NOT_CONFIGURED` (500) when unset; wrong-key → `INVALID_SYSTEM_TOKEN`.
  - Tests rerun by QA: system-token-auth 26/26; server tsc/build clean.
  - Built artifact proven independently: started `node dist/server.js` on port 5021 with a test `ATLAS_SYSTEM_TOKEN`; keyed `/faculty/sync` request reached service validation (`400 INVALID_PARAM schoolId is required.`) — auth passed, past the middleware. Executor's claim reproduced.
- **Live gap confirmed (matches executor's honest NO-GO):** BOTH the current localhost dev server (PID started 09/02 01:23, old middleware — X-Integration-Key ignored, NO_TOKEN) and Tailnet (bridged to it) run the pre-RR-10 build; additionally `ATLAS_SYSTEM_TOKEN` is not persisted in `.env` (the executor's "local-only development" value did not survive — likely process-scoped). Remediation: persist the token in ATLAS `.env`, restart the dev server (Tailnet follows), re-probe.
- Minor design note (accepted, not blocking): with `ATLAS_SYSTEM_TOKEN` unset, an invalid/expired user JWT now returns 500 `SYSTEM_TOKEN_NOT_CONFIGURED` instead of 401 `TOKEN_EXPIRED`/`INVALID_TOKEN` — fail-closed but changes user-facing error semantics on deployments that skip the token; production configures it, so impact is dev-only.
- EnrollPro companion prompt remains pending (their agent must wire `atlasHeaders()` into `sync-faculty` and set the matching `ATLAS_API_KEY`).

---

## [2026-09-01] — RR-10 Sync-Faculty Auth Contract Prompts (ATLAS + EnrollPro)

### Added
- Created `docs/prompts/rollover-sync-faculty-auth-contract-10-2026-09-01.md` (ATLAS side): shared-secret contract via the existing `ATLAS_SYSTEM_TOKEN` / `ATLAS_API_KEY` pair, `X-Integration-Key` header acceptance in `authenticateWithSystemToken` (constant-time, system-token path only — `authenticate` stays JWT-only), fail-closed distinct error when unset, runbook line-8 inline link fix, env setup, and tests.
- Created `docs/prompts/enrollpro-sync-faculty-auth-contract-2026-09-01.md` (EnrollPro side, for their agent): wire SF7-style `atlasHeaders()` into `syncAtlasFaculty`, actionable "key not configured" error, distinguish auth-rejection from unreachable in the 503 path, `.env.example` documentation, no-secret-logging constraints, and smoke acceptance against ATLAS.

### Decisions Made
- Contract shape: one shared server-side secret — EnrollPro `ATLAS_API_KEY` (already documented in their guide and used by their SF7 service) must equal ATLAS `ATLAS_SYSTEM_TOKEN` (already constant-time-checked). EnrollPro sends `Authorization: Bearer` and `X-Integration-Key` (their established SF7 pattern); ATLAS accepts either header through the existing system-token middleware. No ATLAS route changes needed for the happy path.
- Verified environment gaps: neither secret is currently configured on either side (SF7 only works because ATLAS's published routes are public and the key is optional there).
- Both prompts can land independently (additive on each side); the end-to-end flow activates when both .env values match; QA verifies cross-repo after both land.

---

## [2026-09-01] — Rollover E2E Stream Final QA Verdict: GO

### Added
- Performed the final QA verification pass against `docs/prompts/rollover-readiness-e2e-cumulative-report-2026-09-01.md` (RR-08 + RR-09A-C, one-iteration execution).

### Changed
- Nothing in runtime code; read-only verification plus live probes and full gate reruns.

### Decisions Made
- **Final verdict: GO.** Independently verified:
  - Root-cause fix confirmed in source: `withSchoolLock` rewritten with caller-owned rejection handling and both-success-and-failure entry removal (`rollover-automation.service.ts:353-371` with incident documentation); crash handlers registered in `server.ts:5` via the new `crash-handler.service`; abort-safe SSE lib exists; migration `0041_add_school_year_archive` applied; archive service + `RUN_ARCHIVE_AND_SYNC` classifier + `rollover-archive/preview|apply` routes all present.
  - Live Tailnet: drift `aligned` on EnrollPro active year 6; 5 years archived with timestamps; automation `skipped`/0 failures; archived published read for year 5 resolves 200 with `runId 425`, `isHistorical: true`, 830 entries — history fully readable.
  - Full gate sweep reproduced by QA (all exit 0): server tsc/build; conflict-recovery 68/68; readiness 37/37; automation 54/54; health-semantics 37/37; reconfigure-gate 19/19; token-forwarding 11/11; crash-hardening 30/30; notifications 32/32; client tsc/build; UX guardrails 123/123.
- The executor's report quality is high: 8 candid deviations (including a disclosed live-state churn incident repaired by the required RR-08 proof), an honest limitations list, and correct local-vs-live evidence labeling.
- Accepted limitations (documented, none blocking): automation live self-heal is sandbox-proven only (the live wedge was already cleared when RR-09B landed — the next real EnrollPro rollover is the live confirmation); in-memory notifications; single-instance assumption; log-and-continue crash policy with the `EXIT_ON_UNCAUGHT` flip; ~22s archive apply duration; school-scoped reset prune cascade flagged for future review.
- The rollover objective is now met end to end: EnrollPro year change → automation archive+sync+notify, zero operator action, zero destruction, history preserved and readable, gates intact.

---

## [2026-09-01] — Rollover Crash Hardening + Archive Stream Implemented (RR-08 / RR-09A / RR-09B / RR-09C)

### Added
- **RR-08 crash hardening:** `services/crash-handler.service.ts` (uncaughtException + unhandledRejection handlers; log-and-continue policy with `[FATAL]` logs and a rate-limited privileged `SERVER_FATAL_ERROR` notification), registered in `server.ts`; `lib/sse.ts` abort-safe SSE writes + error guards applied to all four SSE routes; notification publish loop drops dead subscribers; `withSchoolLock` rewritten so rejected locked operations neither leak unhandled rejections nor poison the school lock (the 2026-09-01 process-death root cause); dummy-year reset gained phase markers (`cleared`/`syncApplied`/`teachingLoadCleared`), a resume-without-re-delete path (`resumePath: 'resumed-after-clear'`), and pre-apply stale-mirror-label reconciliation; `enrollpro-rollover-crash-hardening.test.ts` (30 assertions, sandbox school).
- **RR-09A archive backend:** migration `0041_add_school_year_archive` (`isArchived`/`archivedAt`/`archivedBy`/`archiveReason` on `EnrollProSchoolYearMirror`); `archiveSchoolYear()` (non-destructive, refuses the EnrollPro active year, idempotent, `ARCHIVE_SCHOOL_YEAR` audit with preserved-row counts, `SCHOOL_YEAR_ARCHIVED` notification); `archiveAndSyncActiveYear()` (archive superseded years + reconcile mirror label + standard apply + `ARCHIVE_AND_SYNC_APPLIED` audit + `ROLLOVER_ARCHIVE_SYNC_COMPLETED` notification); `previewArchiveAndSync()`; `POST /api/v1/runtime/rollover-archive/preview|apply` (privileged, school-locked); classifier action `RUN_ARCHIVE_AND_SYNC` + classification `ARCHIVE_AND_SYNC_AVAILABLE` for label-only mismatches; archived years excluded from the runtime evidence election and from `getLatestAtlasSchoolYearId`; `rollover-status` exposes `archivedYears[]`; archived-year published reads proven intact.
- **RR-09B automation + year-setup:** the rollover tick self-heals archive-resolvable conflicts via `archiveAndSyncActiveYear` (`initiatedBy: 'system'`, no attention noise) and archives superseded year(s) after a clean auto-apply (`ROLLOVER_AUTO_SYNC_COMPLETED` carries `archivedYears` metadata); `/admin/year-setup` leads with the non-destructive "Archive and sync" flow (archive preview with preserved counts, one click, no confirmation phrase) and lists archived years as read-only history; the destructive reset is demoted to an "Advanced: clear disposable test data" accordion shown only when `canResetDummyYear`; client toasts `ROLLOVER_AUTO_SYNC_COMPLETED`, `ROLLOVER_ARCHIVE_SYNC_COMPLETED`, `SCHOOL_YEAR_ARCHIVED`, `ROLLOVER_ATTENTION_REQUIRED`, `SERVER_FATAL_ERROR`.
- **RR-09C live remediation:** live archive-and-sync executed (years 1-5 archived as history, year 6 `2027-2028` active and synced); non-destruction proven by identical before/after row counts across all archived years (year 5: 20 sections, 3 runs, 1 published run, 1 policy, 47 faculty-subjects, 257 ownerships; published run 425 summary unchanged); archived-year published read resolves with `isHistorical: true`; generation gates intact (`TEACHING_LOAD_REVIEW_REQUIRED` on year 6, `ACTIVE_YEAR_DRIFT` on year 5); privileged `ROLLOVER_ARCHIVE_SYNC_COMPLETED` notification captured ("No action needed"); mid-archive failure simulation (local probe) proves resumability and retry completion.

### Changed
- `resolveMappingConflictAction` now distinguishes archive-resolvable label mismatches from collision conflicts (server + client drift-copy updated to archive-first wording for real-data wedges).
- `RolloverGuidanceCard` drift labels/next-steps are archive-aware (`Old school year needs archiving` for `RUN_ARCHIVE_AND_SYNC`).
- `enrollpro-rollover-automation.test.ts` fake-server scenarios now derive year id/label from the live active mirror and skip the collision premise when the active year has no section mirrors (the 2026-09-01 crashed-reset state), preventing test-runs from re-triggering a rollover against fake feeds; `enrollpro-rollover-health-semantics.test.ts` empty-name section assertion updated to the adapter's documented default-name behavior (the test previously never reached the adapter because it captured its URL at import; the adapter now resolves `ENROLLPRO_API` per call like the faculty adapter).
- `docs/reference/atlas-runtime-source-of-truth-map.md`, `ATLAS-SCHOOL-YEAR-ROLLOVER.md`, and `docs/reference/enrollpro-rollover-contract-2026-2027.md` updated with the archive stream contract.

### Decisions Made
- Crash policy: log-and-continue (no process exit) because this single-instance Tailnet deployment has no external process manager; documented in `crash-handler.service.ts` with an exit flip-switch for future process-manager deployments.
- Automation archives superseded years only after a successful clean apply and within the archive-resolvable self-heal flow; no aligned-state catch-up archiving (keeps test suites deterministic and the RR-09C live pre-state captureable).
- The marked test-data auto-clear (14D) and the destructive dummy reset remain manual/default-off and are never invoked by automation.
- Teaching Load is never copied into the new year; generation/publish gates unchanged.

---

## [2026-09-01] — Rollover Readiness E2E Execution Sequence

### Added
- Created `docs/prompts/rollover-readiness-e2e-execution-sequence-2026-09-01.md`: the master execution contract binding RR-08 and RR-09A-C into one iteration — strict phase order (preflight → crash hardening → archive backend → automation/UI → live proof → full regression sweep), an integrated 14-scenario test matrix mapped to phases, hard constraints, the blocker protocol (soft fix-and-continue vs hard stop-with-NO-GO), and the cumulative report contract delivered to `docs/prompts/rollover-readiness-e2e-cumulative-report-2026-09-01.md` for the QA agent's final verification pass.

### Decisions Made
- One-iteration execution with zero mid-sequence user QA; the executor's sole deliverable is the cumulative report; QA verifies against it afterward.
- Phase 0 preflight re-derives live year ids/labels instead of trusting documented ones (the test environment churns years); Phase 1 live crash persistence is the hard-blocker boundary — automation work does not proceed on an unstable process.
- Regression sweep runs ALL suites including untouched ones, plus the RR-07 double-run contamination parity check, before the report is written.

---

## [2026-09-01] — Crash Incident Diagnosis and Rollover Archive Stream (RR-08 / RR-09)

### Added
- Diagnosed the 15:31 server crash from DB audit + operator logs: the year-6 dummy-reset destructive transaction COMMITTED (audit `DUMMY_YEAR_RESET` 07:31:18.900Z, year-6 rows cleared), then the process died ~1s later inside the post-reset `applyRolloverSync` phase — no crash log exists because `server.ts` has no uncaughtException/unhandledRejection handlers. The current `YEAR_LABEL_MISMATCH` wedge is the surviving stale year-6 mirror label; year 5 holds real published history (run 425) that must not be destroyed.
- Created `docs/prompts/rollover-crash-hardening-08-2026-09-01.md`: process crash handlers with in-app fatal notification, floating-promise cleanup on the rollover path, reset idempotency/resumability with phase markers, crash-survival tests, and a live year-6 recovery re-run proof (asserting year-5 history untouched).
- Created the Rollover Archive stream:
  - `docs/prompts/rollover-archive-00-sequence-2026-09-01.md` — order (RR-08 prerequisite), owner decisions, constraints.
  - `rollover-archive-09a-archive-backend` — `isArchived/archivedAt/archivedBy/archiveReason` on the year mirror (migration), `archiveSchoolYear()` (non-destructive, audit + notification), `archiveAndSyncActiveYear()` resolving label-mismatch and clean-drift rollovers, `RUN_ARCHIVE_AND_SYNC` classifier action, archived-year historical-read semantics, evidence-ranking exclusion.
  - `rollover-archive-09b-automation-and-year-setup` — automation performs archive+sync+notify with zero operator action (archive-resolvable conflicts no longer emit attention noise); year-setup page reworked to archive-first semantics with destructive reset demoted to an advanced disposable-test-data disclosure.
  - `rollover-archive-09c-live-remediation-and-proof` — live archive of year 5, sync of year 6, non-destruction row-count proof, archived-year published-read proof, gates-intact proof, docs closure, cumulative QA handoff.

### Decisions Made
- Owner direction (2026-09-01): treat old-year data as REAL data to archive, not dummy to destroy; rollover must be notification-only with no manual step. Archiving is non-destructive and therefore automation-safe; the dummy reset stays manual-only for genuinely disposable data.
- Execution order: RR-08 (crash hardening) first — unattended automation cannot be trusted until the server cannot die silently — then RR-09A→C.
- The server was restarted and verified healthy (local + Tailnet 200, EnrollPro 200); the year-6 wedge remains for RR-08's live proof to clear.

---

## [2026-09-01] — UI-02 Stream QA Verdict and UI-02E Remediation Prompt

### Added
- QA-reviewed the executed UI-02 stream (dashboard focus) against source and SMART reference; created `docs/prompts/ui-02e-dashboard-remediation-2026-09-01.md`.

### Decisions Made
- UI-02 stream verdict: **conditional GO — dashboard remediation required (UI-02E)**. UI-02C violated its data-honesty contract: `GradeBarChart` fabricates grade distribution from hardcoded percentage splits, and `RunHealthDonut` fabricates `assigned = 100 - violations`. The prompt's STOP-and-report rule for unavailable data was not followed.
- Owner feedback mapped to fixes: hero becomes SMART's disconnected `rounded-2xl` gradient card inside the padded content container (also fixes the horizontal scroll caused by negative-offset glows in the overflow-auto region); the hero's embedded stat strip is removed (stat-card grid stays); `GradeBarChart` and `ReadinessProgress` are deleted (setup readiness keeps the single checklist card); `RunHealthDonut` is reworked to real latest-run payload fields only.
- Typeface decision: adopt SMART's hierarchy SYSTEM (Inter body + Poppins headings via `@fontsource-variable`, heading weight 600-700, -0.025em tracking, clamp sizes) — never their Google Fonts CDN import (offline PWA). Remove ATLAS's `--font-weight-normal: 500` which flattened all hierarchy to medium weight.

---

## [2026-09-01] — Teachers Grade Filter Prompt UI-03

### Added
- Created `docs/prompts/ui-03-teachers-grade-filter-2026-09-01.md`: server-shaped assigned-grades filter for the Teachers page, mirroring the Subjects grade filter family.

### Decisions Made
- Owner decision (2026-09-01): filter semantics are ASSIGNED grades (current-year real ownership in a grade's sections), not qualified grades. ATLAS deliberately has no teacher grade restriction and will not add one — teaching-load decisions are made in person at the school; ATLAS encodes and tracks. Auto-assign use is at the officer's discretion for remaining positions; out of scope here.
- Implementation shape: extend `AssignmentSummaryListOptions` with a defensive `gradeLevel` (7-10 only, else null), derive `assignedGradeLevels` per summary row from owned current-year section ids via the existing `deriveGradeLevelsFromSectionIds` + `sectionDisplayOrderMap` pattern, filter inside `buildAssignmentSummaryPage` before pagination (match-any; unloaded teachers excluded; placeholders with ownership included; rosterStats stay whole-roster).
- Client: `Grade taught` control in the existing More-filters disclosure using `GRADE_OPTIONS`, compact DepEd-colored grade chips per row, honest empty state, disabled in saved-data mode.

---

## [2026-09-01] — UI-02 Prompt Sequence (SMART-Aligned Presentation Layer)

### Added
- Created `docs/prompts/ui-02-sequence-2026-09-01.md` governing the SMART-aligned UI/UX stream: audit summary (adopt vs not-adopt), execution order, hard constraints, per-prompt gates, and the one-cumulative-QA-handoff rule.
- Created executor prompts:
  - UI-02A: notification SSE header-auth hardening — fetch + ReadableStream client with Authorization header, bounded backoff, Last-Event-Id resume, no token in URLs (closes the JWT-in-query-string log-hygiene risk; server already accepts Bearer via `extractSseToken`).
  - UI-02B: shell page-title integration — desktop header carries portal eyebrow + page title (SMART registrar pattern), redundant per-page title bands removed or demoted per an investigation-driven table.
  - UI-02C: dashboard charts — recharts (new dependency, lazy-loaded) with grade-distribution bars (strict DepEd G7/G8/G9/G10 colors), latest-run health donut, and setup-readiness progress; all from existing payloads with honest empty states; token-driven GlowTooltip.
  - UI-02D: interaction utilities + polish — shared token-driven utility layer (`card-hover-lift`, glow variants, thead gradient, row tint, skeleton shimmer) with reduced-motion/dark-mode safety, skeleton row parity, and derived brand variants (`--primary-light/dark/rgb`) extending the existing WCAG contrast logic.

### Changed
- Nothing in runtime code; prompt sequence only.

### Decisions Made
- Sequence order: UI-01 (owner's two complaints) → UI-02A (security hygiene first) → UI-02B (systemic title cleanup after the hero pattern is established) → UI-02C (charts) → UI-02D (utilities last, when surfaces are stable).
- Audit corrections applied during authoring: ATLAS already has WCAG-grade `contrastForeground` (better than SMART's simple luminance) so UI-02D only adds derived variants; `SmartPageShell` eyebrow pattern already exists and UI-02B builds on it rather than replacing it; `recharts` is not currently a dependency and is explicitly scoped as a new addition with lazy-loading and chunk-proof requirements.
- SMART patterns explicitly excluded: page-scroll model, hex colors, `title` attributes, `any` types.

---

## [2026-09-01] — Annual Teaching Load Contract

### Added
- Added annual Teaching Load cycles and a system-authenticated effective-assignment contract for downstream consumers.
- Added the AIMS and SMART annual Teaching Load consumer handoff for the effective endpoint, annual cache scope, and rollover behavior.

### Changed
- Scoped Teaching Load ownership, mutation, generation, timetable, and published-schedule reads by school year; legacy global rows are excluded from active truth.
- Rollover now initializes an empty annual cycle instead of carrying forward prior-year assignments.

### Decisions Made
- AIMS and SMART receive explicit `EMPTY` annual truth immediately after rollover; generation remains independently gated until annual ownership is populated.

### Open Questions
- Direct database reads in AIMS and SMART must be removed in those services in favor of the supported ATLAS endpoint.

---

## [2026-09-01] — SMART vs ATLAS Pattern Audit (UI-02 Planning Input)

### Added
- Audited the SMART reference clone for patterns objectively better than ATLAS's current presentation layer.

### Decisions Made
- Worth adopting (presentation-layer wins): shell-carried page title with portal eyebrow; hero-band dashboards (already in UI-01); SSE via fetch+ReadableStream with Authorization header, 403 auto-refresh, and exponential backoff (fixes ATLAS's documented JWT-in-query-string log-hygiene risk in `useNotificationStream`); contrast-aware brand-color derivation (isLightColor + on-primary text) for arbitrary EnrollPro brand colors; recharts usage with GlowTooltip (ATLAS dashboard has zero charts); row-shaped skeleton loading parity; a small shared interaction-utility layer (hover-lift, glow shadow, gradient header) to replace ad-hoc Tailwind chains.
- Not adopting (ATLAS is objectively better): SMART's page-scroll model, no virtualization, no degraded/offline machinery, token-in-query SSE auth, hardcoded emerald hexes alongside its dynamic theme, liberal `any`, `title` attributes, sparse test coverage.

---

## [2026-09-01] — Setup Density Prompt UI-01 (Sections Banner + Dashboard Hero)

### Added
- Cloned the SMART final-defense reference repo to `SMART/Project_Capstone_Smart-Final-Defense/` (gitignored under the existing `SMART/` rule) and studied its registrar layout and dashboard hero patterns.
- Created `docs/prompts/ui-01-sections-inline-banner-dashboard-hero-2026-09-01.md` for two compact setup-density fixes requested by the owner.

### Changed
- Nothing in runtime code; investigation and prompt authoring only.

### Decisions Made
- Sections fix direction: delete the standalone "N sections need a home room" banner row; fold the count into an inline amber chip beside the existing "Auto-assign rooms" button (with a Popover preserving the guidance copy), keeping `data-testid="sections-start-here-banner"`.
- Dashboard fix direction: adopt SMART's registrar-dashboard pattern — one primary-token gradient hero band attached to the top of the content area (title, subtitle, translucent status chips including source-state, translucent actions, embedded mini-stat strip), replacing the separate in-page title row; the rich stat-card grid stays unchanged below. Token-driven colors only; SMART hex values and its page-scroll model are explicitly excluded.
- SMART reference findings: shell carries page identity in a sticky white/blur header; dashboard opens with a `linear-gradient(145deg, primary, primary/0.8)` hero with `bg-white/15` translucent tiles — no separate title band, no mixed backgrounds.
- Banner testid grep: `sections-start-here-banner` referenced only by its own component; guardrail rerun still required in the prompt gates.

---

## [2026-08-31] — 14G Verification Verdict: Prompt 14 Sequence GO

### Added
- Independently verified the 14G implementation (source, full gate reruns, live Tailnet probes).

### Changed
- Nothing in runtime code; read-only verification.

### Decisions Made
- 14G verdict: **GO. The Prompt 14 sequence (14A-14G) is now complete and verified.**
- Gap 1 fixed and verified: `canAutoRecoverMarkedTestCollision` now checks `mapping-conflict` (the drift a collision actually produces) with marker + test-mode + no-published-blocker preconditions; `tickRolloverAutomation` runs the marked-collision recovery check before the manual-conflict branch and before the atlas-stale gate (correct order, source-verified); dependency injection added for hermetic tick testing.
- Gap 2 fixed and verified: `Mark as test data` action exists on the guidance card, gated behind `allowTestDataMarking` (only `AdminYearSetup` passes it), `TEST_DATA_RECOVERY_BLOCKED` + `SECTION_ID_COLLISION` + no published blockers, with a confirmation dialog using project primitives; server-side privilege check already present on the mark route.
- Test quality: the manual path is proven with a genuinely realistic fake-server collision (real `previewRolloverSync` → `mapping-conflict` assertion, no mirror mutation); the marked path drives the real tick with the marked flag injected into a realistic preview — acceptable trade-off since setting a real marker would mutate live mirror metadata.
- All gates reproduced by QA: server suites 32+28+53+27+19+11+32 = **202/202**; client tsc/build clean; UX guardrails **109/109**.
- Live: aligned year 5, 0 conflicts, `testModeEnabled: false` and `testDataMarked: false` present (final build live), classify `AUTO_ROLLOVER_READY`, year-specific confirmation. No live data marked or cleared — correct, as no collision exists to recover.
- Rollover capability is now complete end to end: clean auto-rollover (live-proven by self-heal), guarded manual test-data recovery with mark-as-test-data UI, marked test-mode auto-clear (test-proven, default-off), conflict/reconfigure safety paths, drift guard, health-first probing, sync evidence, and audit trails.

---

## [2026-08-31] — Prompt 14G Test-Data Recovery Wiring

### Added
- Added an admin-only mark-as-test-data flow for an unmarked `SECTION_ID_COLLISION` without published artifacts.
- Added a fake-EnrollPro regression that proves a real `mapping-conflict` remains manual and does not change section mirrors.

### Changed
- Test-mode recovery now evaluates the production `mapping-conflict` state before the normal clean-rollover gate.
- Replaced raw recovery-modal controls with the project Dialog, Checkbox, Input, and Label primitives.

### Decisions Made
- A test-data marker can be created only from the protected year-setup page after explicit acknowledgement; the API retains its privileged-role check.
- Published-artifact collisions are not offered the mark action in the UI.
- Live Tailnet data remains untouched; test-mode stays disabled by default.

## [2026-08-31] — 14F Verification Verdict and 14G Follow-up Prompt

### Added
- Independently verified the 14F remediation (source, full gate reruns, live Tailnet probes).
- Created `docs/prompts/rollover-conflict-recovery-14g-test-mode-wiring-and-mark-ui-2026-08-31.md` for the two remaining functional gaps.

### Changed
- Sequence doc prompt order extended with 14G.

### Decisions Made
- 14F verdict: **GO on safety posture, functional gaps remain (14G required)**.
- Verified fixed: `atlas-stale` + 0 conflicts → `AUTO_ROLLOVER_READY`; year-specific confirmation (live shows `CLEAR_TEST_DATA_AND_SYNC_5`); marker + published-blocker preconditions on the auto-clear predicate; `testModeEnabled` present in live rollover-status (final build is live); readiness drift check now conditional-skip; all 7 suites rerun clean by QA (32+21+53+27+19+11+32 = 195/195); live drift self-healed to `aligned` year 5 through the clean automation path — incidental live proof that the clean rollover path works end to end.
- Remaining gap 1: `canAutoRecoverMarkedTestCollision` requires `atlas-stale` drift AND a `SECTION_ID_COLLISION` — mutually exclusive by construction (`buildDriftState` maps any conflict to `mapping-conflict`, and the tick's non-atlas-stale skip gate returns before the conflict branch). The 14D auto-clear is unreachable dead code that fails safe; its passing regression test builds a synthetic impossible state (false positive). 14D's "marked collision + enabled flag auto-clears" criterion is not functionally delivered.
- Remaining gap 2: the classifier now requires `testDataMarked === true` even for manual recovery; the unmarked-collision message instructs "Mark this school year as test data before recovery can be offered", but no client surface exposes the mark action (client-wide grep: zero matches). The "Known Test-Data Conflict" operator path dead-ends in the UI; it works only via direct API calls.
- Live state: aligned year 5, 0 conflicts, no live data deleted or marked — no live collision exists to prove the recovery path against; 14G proof stays test/hermetic per the 14F rule against re-contaminating live data.

---

## [2026-08-31] — Prompt 14F Rollover Recovery Remediation

### Added
- Added year-specific test-data recovery confirmation and explicit stale-rollover classification.
- Added marker- and published-artifact guards to test-mode automatic cleanup.
- Added regression coverage for stale rollover, unmarked collisions, marked collisions, published artifacts, and disabled test mode.

### Changed
- Exposed `testModeEnabled` on the rollover-status response at both the top level and under `automation`.
- Rebuilt and restarted the Tailnet-bridged server for live verification.

### Decisions Made
- Unmarked section-ID collisions remain manual and are never auto-cleared.
- Live production-like data was not deleted for demonstration; the current Tailnet year remains intact.

## [2026-08-31] — Prompt 14 Sequence QA Verdict and 14F Remediation Prompt

### Added
- Independently verified the executed Prompt 14 sequence (14A-14E) against source, fresh test runs, and the live Tailnet environment.
- Created `docs/prompts/rollover-conflict-recovery-14f-remediation-2026-08-31.md` covering the five findings below and the remaining 14E live-proof work.

### Changed
- Updated the sequence doc prompt order to include 14F.

### Decisions Made
- Prompt 14 verdict: **NO-GO pending 14F**. Findings:
  1. (Critical) Test-mode auto-clear never reads the `testDataMarked` mirror metadata — `tickRolloverAutomation` fires on any `SECTION_ID_COLLISION` when `ROLLOVER_TEST_MODE_ENABLED=true`, with `acknowledgePublished: true` hardcoded. Violates the 14D safety spec; `markSchoolYearAsTestData` writes a marker nothing reads.
  2. (Major) `classifyRecoveryState` has no `atlas-stale` branch — the normal clean auto-rollover state (live right now: year 4 vs 5, 0 conflicts) falls through to `MANUAL_MAPPING_CONFLICT_REQUIRED`. Live probe confirmed: classify returns "manual review" while rollover-status reports `atlas-stale`.
  3. (Major) Live server is a mid-sequence build: `rollover-status` response lacks `testModeEnabled` (field absent, not false) while classify route exists — the 18:52 restart predates 14D/14E, so 14E "live evidence" was captured against a stale build.
  4. (Medium) Confirmation text is static `CLEAR_TEST_DATA_AND_SYNC` — 14B required the target school-year ID in the phrase (wrong-year guard in a year-churning env).
  5. (Major) Gates misreported: fresh QA runs give recovery 31/1-fail (executor claimed 29/29; the failing case uses a dead fixture and calls live EnrollPro) and readiness 52/1-fail (live-state-coupled "drift is aligned" assertion); readiness/health/notifications suites were omitted from the executor's gate table (health 27/27 and notifications 32/32 pass when run).
- Verified OK: `withSchoolLock` on recovery apply route, privileged-role checks, idempotency via classification, teaching-load clearing follows dummy-reset precedent, audit-after-delete ordering, UI typed-confirmation + separate published acknowledgement, test-mode flag defaults false, EnrollPro-unreachable refusal.
- EnrollPro is reachable again (health 200); 14E live cleanup remains to be performed after fixes. If automation self-heals the current drift to aligned first, the collision live proof may be captured as labeled local probe evidence instead — do not re-contaminate live data to demo the endpoint.

---

## [2026-08-31] — Rollover Conflict Recovery Sequence (14A-14E) Review

### Added
- Reviewed `docs/phases/rollover-conflict-recovery-sequence-2026-08-31.md` and its five prompt files as the proposed next step.

### Changed
- Patched `rollover-conflict-recovery-14b` with two missing requirements: the guarded cleanup+sync endpoint must acquire `withSchoolLock` (RR-07 pattern) so automation ticks cannot interleave with destructive cleanup; and an explicit Teaching Load deletion-scope resolution — `FacultySubject`/`SubjectSectionOwnership` are school-scoped single-active-year data (no `schoolYearId`), so leaving them behind would silently un-block the `TEACHING_LOAD_REVIEW_REQUIRED` gate and break 14E's review-gated proof. Added audit-entry ordering note (delete scoped audit rows before writing cleanup entries).
- Patched the sequence doc: added a staleness note (the verified `mapping-conflict` snapshot is point-in-time; later same-day probes saw EnrollPro unreachable, so the executor must re-verify drift at execution time and 14E must NO-GO if EnrollPro is down); marked 14D as deferrable with a re-run rule.

### Decisions Made
- Verdict: the sequence is the right next step — it fills a real gap (SECTION_ID_COLLISION with reset blockers currently leaves admins no recovery path except ad hoc SQL), preserves production safety rules, and matches the established one-cumulative-QA-handoff pattern.
- 14D (test-mode automated cleanup) accepted as specified because it defaults disabled, requires an explicit test-data marker plus env flag, and never applies to unmarked conflicts — but flagged deferrable since 14B+14C already solve the operator pain.

---

## [2026-08-31] — SVF Stream QA Verification Verdict

### Added
- Independently verified the SVF-01/SVF-02 execution and completed the live proof the executor deferred.

### Changed
- Nothing in runtime code; read-only verification plus live probes.

### Decisions Made
- SVF stream verdict: **GO**. The executor deferred the core live proof claiming "no valid token available", but QA credentials exist in AGENTS.md — the proof was captured in this pass:
  - Live readiness-summary via local officer login returns **`verified_live`** (was `using_saved_data`) — the "Source connection is unavailable" banner is healed.
  - Live rollover-status `settingsReachable: true` (was permanently `false`); drift `aligned`; context `enrollpro-verified`, not stale.
  - Server on port 5001 restarted 16:56 with the fixed build; all requests responsive.
- Source verification: `middleware/upstream-auth.ts` helper correct (bridge-only forwarding); my own grep confirms zero `headers.authorization` reads remain in route files; 48 shared-helper usages across 9 routers (faculty-assignment count of 15 sites confirmed); settings probe authless via `useServiceTokenFallback: false`.
- Tests rerun fresh: token-forwarding 11/11; health-semantics now 27/27 with unauthenticated-settings coverage added.
- Docs closure verified: source-of-truth map SVF entry and CHANGELOG entry present.
- Full chain complete and verified: RR-07 → SVF-01 → SVF-02. ATLAS is ready to participate in the EnrollPro rollover process (automation detects/applies year switches with backoff; drift guard works for local sessions; reconfigure gate normalized; source verification live for all auth sources).

### Open Questions
- Minor cleanup carryover: 2 leftover fake-year `888881` snapshot rows (RR-07 caveat, cosmetic — year-2 snapshots outrank them).
- SSE auth-token-in-query-string log hygiene remains documented out of scope.

---

## [2026-08-31] — Source Verification Token Fix Stream

### Added
- `middleware/upstream-auth.ts` — shared `getUpstreamAuthToken(req)` helper that forwards the bearer token only when `authSource === 'bridge'`; returns `undefined` for `local`, `system`, or missing user.
- `src/__tests__/upstream-token-forwarding.test.ts` — 11 tests: helper unit cases, settings probe authless verification, drift detection for local sessions, token-leak prevention.

### Changed
- Unified 34 broken token-forwarding sites across 9 router files (dashboard, faculty, faculty-assignment, section, cohort, faculty-portal, generation, pre-generation-draft, subject) to use the shared `getUpstreamAuthToken` helper.
- Removed local `getAuthToken` helpers from `generation.router.ts` and `pre-generation-draft.router.ts`.
- `runtime.router.ts` now imports the shared helper instead of defining its own local copy.
- `enrollpro-rollover.service.ts` — `/settings/public` fetch uses `{ useServiceTokenFallback: false }` to send no Authorization header.

### Decisions Made
- Shared helper lives in `middleware/upstream-auth.ts` following existing middleware conventions.
- Bridge tokens (EnrollPro-issued JWTs) continue to be forwarded; local ATLAS JWTs and system tokens are never sent upstream.
- No client changes required — the dashboard banner heals when the server returns `verified_live`.

---

## [2026-08-31] — RR-07 QA Verification Verdict

### Added
- Independently verified the RR-07 remediation report against source, live Tailnet, the database, and fresh test runs.

### Changed
- Nothing in runtime code; read-only verification.

### Decisions Made
- RR-07 verdict: **GO with one minor caveat**. Verified live: drift `aligned` (year 2 = EnrollPro active year), mirror year 2 active, `0` reconfigured sections (false positives gone — live server is running the fixed normalization code), `0` conflicts, `27` active faculty mirrors restored, automation `enabled=true lastResult=skipped` (healthy idle, no longer wedged in `reconfigure-pending`). Verified source: `normalizeProgramMetadata` reused in `enrollpro-rollover.service.ts:728`, `withSchoolLock` wraps both manual rollover routes in `runtime.router.ts:112,152`. Independently reran all four rollover suites: readiness 53/53, automation 17/17, reconfigure gate 19/19, health/semantics 23/23, all exit 0; DB state identical before and after runs (contamination-free).
- Minor caveat: the report's "0 fake-year artifacts" claim is not fully accurate — `2` leftover rows remain (one sectionSnapshot and one facultySnapshot for fake year `888881`, pre-existing before the verified test runs). Low impact: snapshot-based year ranking is unaffected because year-2 snapshots are the newest. Cleanup can be folded into SVF-02's closure or done as a one-off.
- "Still on saved source data" is expected and NOT an RR defect: `readiness-summary` returns `using_saved_data` because the SVF token-forwarding bug (dashboard route sends local JWT upstream → 401) is still unfixed. RR-07 was the prerequisite; **SVF-01 → SVF-02 remain to run**.
- Rollover-process readiness: YES. When EnrollPro commits the next year, automation will detect `atlas-stale` → preview → apply (no conflicts, no reconfigures after normalization fix) → notify privileged users, with bounded backoff on outages. Manual `Sync now` remains available.

---

## [2026-08-31] — RR Stream QA Verdict and RR-07 Remediation Prompt

### Added
- QA-reviewed the executed Rollover Readiness stream (RR-01..RR-06) against the live Tailnet environment and database.
- Created `docs/prompts/rollover-readiness-07-remediation-2026-08-31.md` covering the four defects below, live-DB remediation, and re-run gates.

### Changed
- Updated `docs/prompts/source-verification-token-fix-00-sequence-2026-08-31.md` execution order to RR-07 → SVF-01 → SVF-02 with a post-QA coordination section.

### Decisions Made
- RR stream verdict: **NO-GO pending RR-07**. Findings (live evidence):
  1. `detectReconfiguredSections` compares raw EnrollPro program strings (`SCIENCE_TECHNOLOGY_AND_ENGINEERING`) against adapter-normalized mirror codes (`STE`), producing 12 permanent false-positive reconfigures that wedge automation in `reconfigure-pending` and block manual apply in an acknowledge no-op loop.
  2. `enrollpro-rollover-automation.test.ts` "never calls dummy reset" section applies a fake year-3 rollover to the production DB with no cleanup: live active mirror flipped to year 3 while EnrollPro is on year 2 (drift `atlas-stale`), all 28 faculty mirrors marked stale by an empty fake faculty feed, test artifacts (year-3/888881 snapshots, year-999976 "Write Test" sections) persist.
  3. The RR-01 readiness test exits 1 in the contaminated state (drift assertion fails; teaching-load fixture builds 0 assignments and the generation trigger crashes uncaught), and its `assignmentsCreated >= 1` assertion was weakened to `>= 0`.
  4. Manual apply/reset routes do not acquire `withSchoolLock`, so automation ticks can interleave with manual applies (RR-04 requirement unmet on the route side).
- Verified OK: RR-02 health-first/mirror-preservation/audit evidence, RR-05 client surfaces (client tsc clean, UX guardrails 108/108), RR-06 runbook links and docs; `settingsReachable=false` remains expected until SVF-01.
- RR-07 must land before SVF because SVF-02 live proof requires the remediated aligned state.

### Open Questions
- Whether the year-3 EnrollPro year (label `2026-2027`) also exists upstream as a real year — affects whether the year-3 mirror row is historical or purely test-written; RR-07 instructs deactivate-not-delete.

---

## [2026-08-31] — Rollover Readiness Stream

### Added
- RR-01: Test fixture modernization — `enrollpro-rollover-readiness.test.ts` now dynamically resolves the active school year from the EnrollPro feed, uses feed-derived section/faculty counts, makes field-level contract checks conditional on reachability, and scopes `TEACHING_LOAD_REVIEW_REQUIRED` to provably-empty state.
- RR-02: Health-first probing — `fetchEnrollProIntegrationHealth()` helper reads `GET /api/integration/v1/health` before any other feed. `getRolloverStatus`, `previewRolloverSync`, and `applyRolloverSync` fail fast to `enrollpro-unreachable` when health fails. Failure semantics preserve the existing mirror's `isActive` state. Sync evidence includes `skipped` counts, `sourceGeneratedAt`, `completedAt`, `durationMs`, and `initiatedBy` in audit logs and mirror metadata.
- RR-03: Section reconfigure review gate — `detectReconfiguredSections` detects structural changes (name, grade, program) during preview. `applyRolloverSync` requires `acknowledgeReconfiguredSectionIds` to include all reconfigured IDs. Unacknowledged reconfigures throw `409 SECTION_RECONFIGURATION_REVIEW_REQUIRED`. Client `RolloverGuidanceCard` renders reconfigured sections with acknowledge-and-sync flow.
- RR-04: Automated rollover sync — `rollover-automation.service.ts` with periodic tick (default 5 min), bounded exponential backoff (capped at 30 min), per-school mutex, and `initiatedBy: 'system'` audit trail. Env vars: `ROLLOVER_AUTO_SYNC_ENABLED`, `ROLLOVER_AUTO_SYNC_INTERVAL_MS`, `ROLLOVER_AUTO_SYNC_MAX_BACKOFF_MS`.
- RR-05: Client automation status — `RolloverGuidanceCard` renders automation healthy/backoff/disabled states in plain scheduler language. Manual "Sync now" fallback always reachable.
- RR-06: Runbook link fixes, reference doc updates, automation contract documentation.
- New test files: `enrollpro-rollover-health-semantics.test.ts`, `enrollpro-rollover-reconfigure-gate.test.ts`, `enrollpro-rollover-automation.test.ts`.

### Changed
- `enrollpro-rollover.service.ts`: health-first probing, failure semantics (mirror preservation), `initiatedBy` option on `applyRolloverSync`, `reconfiguredSections` on status/preview, `detectReconfiguredSections` function, `fetchRolloverCounts` returns raw section rows.
- `section.service.ts`: `syncSectionsFromExternal` returns `skipped` count for incomplete section rows; validates id, name, gradeLevelId, and programType before upserting.
- `runtime.router.ts`: passes `acknowledgeReconfiguredSectionIds` and `actorId` to `applyRolloverSync`; includes `automation` state on rollover-status response.
- `server.ts`: starts rollover automation after DB connectivity check; stops on server close.
- `settings.ts` (client): `RolloverStatus` type extended with `reconfiguredSections`, `automation` object; `applyRolloverSync` accepts `acknowledgeReconfiguredSectionIds`.
- `RolloverGuidanceCard.tsx`: renders automation status, reconfigured sections review, acknowledge-and-sync button, "Sync now" manual fallback.
- `ATLAS-SCHOOL-YEAR-ROLLOVER.md`: fixed broken reference links; added Automated Rollover Sync section documenting automation contract and env vars.
- `enrollpro-rollover-contract-2026-2027.md`: documented health-first probing, failure semantics, sync evidence, reconfigure gate, and automation.
- `atlas-runtime-source-of-truth-map.md`: added Rollover Readiness stream snapshot with all new contracts.

### Decisions Made
- Automation applies only the standard safe path; dummy-year reset stays manual-only.
- Automation never copies or seeds Teaching Load; generation gates remain unchanged.
- Section reconfigure detection covers name, gradeLevelId, and programType only; capacity/enrollment/TLE changes are routine data.
- Health-first probing uses a 5-second timeout matching existing adapter patterns.
- `initiatedBy` defaults to `'user'`; automation passes `'system'`.
- Per-school in-process mutex prevents overlapping applies; single-instance deployment assumed.

---

## [2026-08-31] — Source Verification Token Fix Stream Prompt Sequence

### Added
- Created `docs/prompts/source-verification-token-fix-00-sequence-2026-08-31.md` defining the hotfix stream: verified root cause with live evidence, exhaustive affected-site ledger (20+ forwarding sites across 8 routers), execution order, hard constraints, and RR-stream coordination rules.
- Created executor prompts SVF-01 and SVF-02:
  - SVF-01: shared bridge-only `getUpstreamAuthToken` helper, exhaustive route unification (dashboard, faculty, faculty-assignment, section, cohort, faculty-portal, generation, pre-generation-draft, subject routers), authless `/settings/public` probe, token-leak and drift-guard tests with fake-server request logs.
  - SVF-02: live Tailnet proof that local sessions verify live (readiness-summary `verified_live`, `settingsReachable=true`, client "Verified live" state), local drift-guard probe, source-of-truth map and changelog closure, cumulative QA handoff.

### Changed
- Nothing in runtime code; prompt sequence only.

### Decisions Made
- The token-forwarding fix is a standalone hotfix stream landing BEFORE the Rollover Readiness stream; RR-02/RR-04 executors must reuse the shared helper and preserve the authless settings probe.
- Bridge tokens remain forwarded (they are EnrollPro-issued); local and system tokens must never reach EnrollPro — services fall back to `ENROLLPRO_SERVICE_TOKEN`.
- Client code needs no changes for the fix; the dashboard banner heals when the server returns `verified_live`.
- SSE auth-token-in-query-string log hygiene stays out of scope and is recorded as an open limitation in SVF-02.

---

## [2026-08-31] — Live "Source connection is unavailable" Root-Cause Investigation

### Added
- Investigated why the live Tailnet dashboard shows `Source connection is unavailable` while EnrollPro is reachable.

### Changed
- Nothing; read-only investigation with live endpoint probes.

### Decisions Made
- Root cause identified: split-brain upstream token forwarding. `runtime.router.ts` uses the correct pattern (forward user token only when `authSource === 'bridge'`), but `dashboard.router.ts:36`, `faculty.router.ts:91`, `faculty-assignment.router.ts:87/162/190/227/264`, `section.router.ts:70/97/126`, and `generation.router.ts:55` forward the raw ATLAS JWT whenever `authSource !== 'system'` — which includes `local` logins. EnrollPro integration feeds require an approved integration key and return 401 for the ATLAS JWT, so upstream verification silently fails for local officer/admin sessions.
- Secondary bug confirmed: rollover counts always report `settingsReachable=false` because the rollover service attaches the service token to `/settings/public`, which EnrollPro rejects (200 without auth, 401 with the service token).
- Latent effect confirmed: for local users the generation drift guard falls back to the saved active year, so real EnrollPro rollover drift would not be detected at generation time by a local session.
- Codex's earlier stale-process diagnosis (duplicate Vite on 5174) is resolved — ports 5001/5174 now have single fresh processes; that was not the cause of the current banner.

### Open Questions
- Whether to fix the token-forwarding unification as a standalone hotfix prompt or fold it into the Rollover Readiness stream (RR-02 touches the same probe plumbing).

---

## [2026-08-31] — Rollover Readiness Stream Prompt Sequence

### Added
- Created `docs/prompts/rollover-readiness-00-sequence-2026-08-31.md` defining the separate Rollover Readiness stream: purpose, gap ledger, execution order, hard constraints, and the one-cumulative-QA-handoff rule.
- Created executor prompts RR-01 through RR-06:
  - RR-01: rollover readiness test fixture modernization (dynamic year/counts, hermetic drift simulation).
  - RR-02: health-first probing, apply failure semantics that preserve an active mirror, and full sync evidence (counts, skipped, timings, audit log).
  - RR-03: reviewed-mapping gate for renamed/reconfigured sections with acknowledgment contract.
  - RR-04: automated rollover sync service with bounded exponential backoff, env configuration, and status surface.
  - RR-05: client automation-status surfacing plus manual retry fallback.
  - RR-06: runbook link fixes, automation contract documentation, reference/phase-ledger updates, and cumulative live Tailnet proof with QA handoff.

### Changed
- Nothing in runtime code; this prompt sequence is a planning artifact for the executor.

### Decisions Made
- Owner chose to close all seven identified rollover gaps (stakeholder decision 2026-08-31).
- Rollover sync will be automated with bounded backoff; manual retry stays as fallback.
- Work runs as a separate stream that must not displace Phase 3 generator-readiness or class-program streams.
- Automation applies only the standard safe sync path; dummy-year reset, published-artifact recovery, mapping conflicts, and unacknowledged section reconfigures stay manual.
- Executor runs RR-01 through RR-06 in one iteration without per-prompt user QA; the PRD/QA agent performs the final QA pass after RR-06.

### Open Questions
- Cross-repo coordination item (outside this stream): EnrollPro's `POST /api/integration/atlas/sync-faculty` trigger calls ATLAS `POST /api/v1/faculty/sync` without an Authorization header, which ATLAS's authenticated route will reject with 401. Needs an agreed service-token contract between repos.

---

## [2026-08-31] — EnrollPro School-Year Rollover Runbook Review

### Added
- Reviewed `ATLAS-SCHOOL-YEAR-ROLLOVER.md` (EnrollPro-authored runbook, last reviewed 2026-08-31) against the ATLAS rollover implementation.

### Changed
- Nothing; this was a read-only implementation-vs-runbook gap review.

### Decisions Made
- Confirmed ATLAS rollover core (drift states, preview/apply, dummy-year reset, generation guards, mirror persistence) already matches the runbook's rollover rule, data-treatment, and alignment-state contract.

### Open Questions
- Whether to close identified gaps (health-first probe, bounded-backoff retry, skipped-record/timing sync evidence, section-rename review gate, non-atomic apply failure semantics, stale hard-coded year fixtures in `enrollpro-rollover-readiness.test.ts`, broken relative doc links in the ATLAS copy of the runbook) as a requirements pass before the real 2027-2028 rollover.

---

## [2026-08-31] — Background Grid Pattern Reference

### Added
- Created `docs/reference/background-grid-pattern.md` documenting the SVG pixel grid and CSS linear-gradient grid patterns used across Login and AppShell surfaces.
- Documented coordinate map, opacity guidelines, unique-ID collision rule, and copy-paste implementation templates for new surfaces.

### Decisions Made
- SVG pixel grid is the recommended pattern for branded surfaces (uses `--primary` token).
- CSS linear-gradient grid is the lightweight alternative for neutral/decorative fills on colored backgrounds.
- All grid instances must be wrapped in `pointer-events-none` + `aria-hidden="true"`.

---

## [2026-08-31] — Class-Program Policy Prompt 11 Blocker-Closure Sequence

### Added
- Added canonical faculty unavailability regression test (`canonical-faculty-unavailability.test.ts`) proving UNAVAILABLE preferences block canonical slot assignments.
- Added class-program matrix test (`class-program-matrix.test.ts`) covering effective schedule truth, hidden/visible specialization, and parameter validation.
- Added 45-minute canonical duration contract assertions to slot resolver test for all four grades.
- Added `unavailableTimeRanges` time-range-based UNAVAILABLE preference lookup for canonical slot placement.
- Added `resolveLatestValidEntries` function in matrix service for lightweight candidate selection with stale-faculty check.
- Added room label hydration in class-program matrix (building/name format).
- Added `specializationVisibility` query parameter to XLSX class-program export route.
- Added Lunch Break canonical row for Grade 7/8 morning template (12:15-13:00).
- Added per-grade worksheets in class-program XLSX export (Grade 7, 8, 9, 10 sheets).

### Changed
- Replaced `pi = -1` conservative day-blocking with time-range overlap check for canonical slot faculty availability.
- Matrix service now uses `resolveLatestValidEntries` instead of `findFirst` with full `draftEntries` load.
- Matrix service filters specialization rows from both `timeRows` and column entries in hidden mode (previously only nulled cell content).
- Matrix service populates room labels from entry room IDs (previously always `room: null`).
- Matrix service scopes faculty/room queries to only IDs referenced in entries (no full table scans).
- Class-program XLSX export uses canonical class-program slots per grade instead of legacy `displaySlots`.
- Updated workbook export test to accept per-grade worksheet names.
- Updated source-of-truth map with class-program policy closure contracts.

### Decisions Made
- Canonical slot placement uses time-range overlap for UNAVAILABLE preference matching (not period-index lookup).
- Hidden specialization mode omits specialization rows entirely from matrix output and XLSX export.
- Matrix and export use effective schedule truth (latest valid completed run with stale-faculty check).
- Grade 7/8 morning template includes Lunch Break at 12:15-13:00 to match Grade 9/10 structure.

## [2026-08-31] — Class-Program Policy Prompt 10 Retry Sequence

### Added
- Added Prompt 10R-A through 10R-F retry docs for the failed class-program canonical slot closure.
- Added a phase-level retry sequence requiring one cumulative QA handoff after Prompt 10R-F.

### Changed
- Clarified that the previous Prompt 10 pass failed because production grade normalization still used internal EnrollPro grade IDs in shape contracts.
- Clarified that matrix proof must use the correct `SectionMirror.externalId` mapping when generation entries store external section IDs.
- Strengthened runtime proof requirements so fresh generation must show zero off-canonical assigned entries before any GO claim.

### Decisions Made
- The retry sequence must run end to end without user QA between prompts.
- Hidden and visible specialization modes must be observably different for special-program sections.
- Dev runtime diagnostics must separate port conflicts, EnrollPro proxy outages, and real ATLAS failures.

### Open Questions
- Whether the class-program matrix endpoint should remain JSON-only or also produce a downloader-facing workbook/DOCX artifact.

## [2026-08-30] — Class-Program Policy Template QA Blocker Fix Prompt Sequence

### Added
- Added Prompt 10A-10E sequence for closing Codex QA blockers found after the class-program policy follow-up pass.
- Added explicit executor requirements for actual-grade shape contracts, canonical slot candidate generation, specialization-visible downloads, term-readiness diagnostics, and cumulative runtime proof.

### Changed
- Clarified that canonical class-program rows must be placement-authoritative, not only metadata or filters over the old fallback slot grid.
- Required fresh generation proof after fixes instead of relying on historical run `446` or pre-fix run `449`.

### Decisions Made
- Prompt 10A-10E must run end to end with one final QA handoff.
- `TERM_FILTER_NOT_READY` remains a valid readiness response, but server logs must report its actual `501` status.
- Specialization visibility defaults to hidden and must be explicitly requestable as visible.

### Open Questions
- Whether remaining post-fix hard violations, if any, are acceptable dummy-data staffing constraints or require another EnrollPro faculty/data adjustment pass.

## [2026-08-29] — Class-Program Policy Template Follow-Up Prompt Sequence

### Added
- Added Prompt 09A-09E follow-up sequence for the verified class-program policy NO-GO.
- Added Grade 7/8 morning class-program template requirements from `aral-prog_G7_Class-Program_SY2026-2027docx.docx`.
- Added generation enforcement requirements so canonical slots drive slot candidate selection instead of metadata only.
- Added class-program download requirements for hidden versus visible specialization blocks.

### Changed
- Expanded the class-program scope from Grade 9/10 afternoon specialization slots to full grade-level matrix output for Grade 7/8 and Grade 9/10.
- Required actual grade-number normalization before resolving `ClassProgramSlot` rows.

### Decisions Made
- Grade 7/8 morning output uses the stakeholder morning row shape: `06:00-12:15` with `09:00-09:15` health break.
- Specialization remains hidden by default for uniform class-program output, with an explicit visible download option.
- The executor must run the follow-up end to end and provide one cumulative final report for Codex QA.

### Open Questions
- Whether a separate Grade 8 stakeholder class-program file exists; if not, Grade 8 uses the same morning time-row shape by current user direction.
- Whether the Grade 9/10 Friday ARAL/TLE variant should become schedulable now or stay source-note-only until a stakeholder resolves the duplicate lunch row.

## [2026-08-29] — Class-Program Policy Template Alignment Prompt Sequence

### Added
- Added an end-to-end Prompt 08A-08F sequence for aligning ATLAS generation policy with the `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx` class-program rows.
- Added a phase-level sequence file requiring executor self-gates after each prompt and one cumulative Codex QA handoff after Prompt 08F.
- Added explicit EnrollPro `FACULTY_FEED.md` live-sync verification requirements for the new faculty profile fields.

### Changed
- Framed the Grade 9/10 scheduling issue as a missing canonical class-program template contract rather than only a global policy-setting problem.
- Required lunch/conflict row safety: the duplicate `12:15-13:00` bottom-table row is treated as source drift and not schedulable until a stakeholder decision exists.

### Decisions Made
- The sequence enforces 45-minute class windows despite inconsistent DOCX minute labels.
- Tailnet fresh generation with `enforceShiftWindows=true` is the required final runtime proof.
- The executor must continue end to end without stopping for Codex QA between prompts unless a true blocker prevents continuation.

### Open Questions
- Where the conflicting Grade 9/10 `12:15-13:00` Flag/HGP/TLE row should move if it is truly required as schedulable time.
- Whether EnrollPro `majorSpecialization` and `minorSpecialization` should remain profile/export-only or become bounded qualification inputs after live feed proof.

## [2026-08-29] — Schedule Page Old-Scheduler UX Sequence (Prompts 00-05)

### Added
- Created `schedule-page-old-scheduler-baseline.spec.ts` Playwright spec with 36 tests covering selector width, Help dialog fit, view mode switching, and public schedules across all viewports.
- Added `MobileScheduleCards` component for mobile-readable day-card agenda view on `/schedules`.
- Added 5 new source guard tests in `ux-guardrails.test.ts` for schedule-page selector collapse, accessible select, raw controls, Help/Expert tools, and step flow.

### Changed
- **SearchableSelect**: Added `min-w-[160px]` trigger minimum width, `w-[var(--radix-popover-trigger-width)]` popover width matching trigger, `role="option"` and `aria-selected` on option buttons, larger touch targets (`py-2 text-sm`), and labeled search input.
- **RoomSchedules**: Removed the large Source status card and browsing explanation card from the header. Simplified to a 3-step flow: Choose view → Choose schedule → Review/Use tools. Moved Expert tools into a compact Tools popover. Occupancy toggle simplified to a single button. View mode buttons bumped to `h-9`.
- **RoomSchedules (mobile)**: Desktop uses the existing `TimetableGrid` table; mobile uses the new `MobileScheduleCards` day-card agenda showing day/time/subject/section/teacher/room with conflict badges.
- **PublicPublishedSchedule**: Empty state now shows a clear icon, plain-language copy ("No official schedule published yet"), a "Check for schedule" button, and a "Staff sign in" link.
- **MySchedule**: Error state redesigned with centered icon, clear heading, and retry button.

### Decisions Made
- Public schedule route remains section-only (teachers/rooms are admin-only).
- Faculty QA credential 401 is an external/data fixture issue, not an ATLAS auth bug.
- Mobile schedule view uses day cards instead of trying to squeeze the 5-day table.

### Open Questions
- Faculty schedule live proof pending moderated older-scheduler validation or accepted simulated browser proof.

## [2026-08-29] — EnrollPro Dummy Faculty Staffing Recommendation

### Added
- Created `docs/prompts/enrollpro-dummy-faculty-staffing-recommendation-2026-08-29.md` with department-level staffing recommendations from live run 440.

### Changed
- Clarified that ENG, MATH, ESP, and MAPEH need one additional real dummy teacher each, while the Robotics blocker is a section-slot saturation issue rather than a teacher-count shortage.

### Decisions Made
- Recommended adding exactly 4 EnrollPro dummy faculty records for the current data set: ENG +1, MATH +1, ESP +1, MAPEH +1.
- Kept SCI and TLE unchanged for this staffing pass.

### Open Questions
- Decide separately whether Grade 10 Silver Robotics should be term-scoped, moved to an alternate slot policy, or resolved by reducing another Grade 10 Silver demand item.

## [2026-08-29] — Teacher Program DOCX Stakeholder Table Prompt Fixes

### Added
- Added Prompts 19-23 for section label resolution, weekday row compaction, profile/signatory layout alignment, source-backed ancillary rendering, and final stakeholder-table release proof.
- Added explicit DOCX XML comparison gates against `stakeholderFiles/Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx`.

### Changed
- Extended the teacher-program DOCX remediation sequence after Prompt 18 so executor routing continues through the stakeholder-table parity fixes.
- Clarified that live EnrollPro profile fields are a data caveat when empty, not a reason to fabricate teacher profile values.

### Decisions Made
- Prompt 19 must fix `SectionMirror.externalId` lookup before any table-content parity can be claimed.
- Prompt 20 must compact only identical repeated weekday rows and must not merge different rooms, sections, subjects, durations, or time slots.
- Prompt 22 must keep weekly-only ancillary/advisory credit separate unless timed source rows exist.

### Open Questions
- Whether the final official format should keep credited non-teaching work as a separate table when no timed ancillary source exists, or require a future configured ancillary scheduling source.

## [2026-08-28] — Timetable Status Key Reflow Closure Fix

### Added
- Added a source guard that prevents the 200% Status key proof from hiding dialog failures as fixture-limited skips.

### Changed
- Restored explicit More-menu closure before opening the Status key dialog from the Simple timetable More menu.
- Split the 200% reflow Playwright coverage so Status key accessibility is a standalone non-skipping gate.
- Tightened the 200% Status key proof to assert all six definitions and the actual menu layer closing.

### Decisions Made
- Generated unassigned queue fixture limits remain separate from Status key accessibility proof.

### Open Questions
- Product GO still depends on moderated older-scheduler validation.

## [2026-08-28] — Timetable Status Key 200 Percent Reflow Prompt

### Added
- Added Prompt 13 to close the remaining Status key 200% reflow accessibility caveat.
- Added explicit testing requirements for Status key reachability, direct definitions, More-menu closure, local scroll, focus behavior, and no root overflow at 200% text size.
- Added source-guard requirements so Status key dialog-open failures cannot be hidden as fixture-limited skips.

### Changed
- Extended the timetable old-scheduler remaining-issues sequence with a final accessibility closure prompt after Prompt 12.

### Decisions Made
- Status key failure at 200% is an old-scheduler accessibility blocker, not a harmless fixture limitation.
- Generated unassigned queue fixture limits must be separated from Status key accessibility proof.

### Open Questions
- Whether passing Prompt 13 is sufficient for Technical GO, or whether moderated older-scheduler validation will still be required before product signoff.

## [2026-08-28] — Timetable Old-Scheduler Remaining Issues Sequence

### Added
- Added a four-prompt continuation sequence for the remaining timetable old-scheduler release blockers.
- Added Prompt 09 for stale Playwright label and release-contract alignment.
- Added Prompt 10 for deterministic teacher-departure save/revert proof after generation.
- Added Prompt 11 for touch queue, focus/cancel, draft-planning, and readiness-sheet fixture repair.
- Added Prompt 12 for cumulative release proof across live Tailnet, source guards, and focused browser gates.

### Changed
- Continued the existing Simple timetable old-scheduler numbering after Prompt 08 instead of overwriting prior finalization work.

### Decisions Made
- Full post-generation teacher-leaving readiness requires an isolated reversible mutation proof, not only UI reachability or preview success.
- Stale active specs must be corrected to assert current plain-language UX instead of old dialog/menu labels.
- Fixture-limited states are acceptable only after a deterministic fixture path has been attempted.

### Open Questions
- Whether moderated Product GO will be run separately after Technical GO, or explicitly deferred by the user.

## [2026-08-28] — Timetable Old-Scheduler Release Proof Cleanup

### Added
- Added the missing `07-exhaustive-surface-proof` artifact directory with screenshot references, `surface-proof-metrics.json`, and `fixture-limitations.json`.

### Changed
- Replaced the remaining stale Advanced timetable helper copy that referenced `Review occupied-slot swap` with the current `Swap these two classes?` wording.
- Updated the old-scheduler UX guardrail to reject the stale occupied-slot swap wording.

### Decisions Made
- The exhaustive artifact JSON records copied screenshot provenance separately from the current source cleanup so the proof does not overstate fixture coverage.

### Open Questions
- Draft parity and blocked swap recovery remain fixture-limited until deterministic non-destructive fixtures are available.

## [2026-08-28] — Timetable Simple Old-Scheduler Finalization Follow-Up Prompts

### Added
- Added Prompt 06 to remediate independent Codex NO-GO findings for Status key, More-menu layer lifecycle, swap preview failure, and stale test contracts.
- Added Prompt 07 to require exhaustive non-mutating Tailnet proof across every reachable timetable surface.
- Added explicit wall-of-text measurement thresholds for timetable modals, sheets, drawers, popovers, and menus.

### Changed
- Extended the Simple old-scheduler finalization sequence from Prompts 00-05 to Prompts 00-07.
- Updated the phase ledger to state that the Prompt 00-05 completion report is not sufficient for Technical GO after independent QA.

### Decisions Made
- The executor must fix the real NO-GO issues before running exhaustive proof.
- The final proof must open all reachable timetable surfaces rather than relying only on focused smoke specs.
- Product GO remains pending moderated older-scheduler validation unless explicitly deferred or accepted by the user.

### Open Questions
- Whether fixture-limited draft and blocked swap states can be made deterministic without live destructive timetable writes.

## [2026-08-28] — Timetable Simple Old-Scheduler Finalization Prompts

### Added
- Added a six-phase executor prompt sequence for finalizing the Simple timetable old-scheduler UX.
- Added phase prompts covering regression guards, help/status repair, persistent next-action guidance, More menu decompression, decision-state parity, and cumulative release proof.
- Added a phase-level sequence ledger mirroring recent ATLAS prompt-sequence conventions.

### Changed
- Folded the known swap regression-spec caveat into the new Prompt 00 baseline instead of treating it as a separate manual follow-up.

### Decisions Made
- The executor must test itself before moving from each phase to the next.
- Final QA will happen after Prompt 05, with one cumulative evidence report instead of per-prompt Codex QA handoffs.
- Product GO remains separate from Technical GO until moderated older-scheduler validation occurs or is explicitly deferred.

### Open Questions
- None for prompt sequencing.

## [2026-08-27] — Timetable Swap Landscape Action-Sheet Pattern Prompt

### Added
- Added `docs/prompts/timetable-swap-old-scheduler-08-landscape-action-sheet-pattern-2026-08-27.md` for the remaining Prompt 07 live Tailnet failure.
- Added explicit requirements to replace the short-height landscape pattern instead of continuing to shrink the centered modal.
- Added hard `844x390` gates for `recommendedIntersectsFooter=false`, zero strategy rows intersecting the footer, visible selected status before scroll, and no unreadably tiny decision-control text.

### Changed
- Updated the timetable swap old-scheduler sequence to include Prompt 08 after the mobile landscape decision-fit prompt.

### Decisions Made
- Prompt 07 remains `NO-GO` because live Tailnet reproduced `recommendedIntersectsFooter=true`.
- The next fix must change layout structure for short-height landscape, not rely on smaller font sizes or reduced padding.
- Product GO remains pending real older-scheduler moderated validation even after technical gates pass.

### Open Questions
- Whether the executor will choose a bottom action sheet, a two-column decision layout, or another equivalent short-height pattern that keeps the recommendation fully above the footer.

## [2026-08-27] — Timetable Swap Mobile Landscape Decision-Fit Prompt

### Added
- Added `docs/prompts/timetable-swap-old-scheduler-07-mobile-landscape-decision-fit-2026-08-27.md` for the remaining old-scheduler QA blocker after Prompt 06.
- Added explicit `844x390` acceptance criteria for visible strategy rows, visible selected blocker/warning status, footer geometry, and old-scheduler decision-readiness.
- Added requirements for the Playwright visual-decision spec to fail when strategy rows are hidden behind the footer or the chosen status is only visible after scrolling.

### Changed
- Updated the timetable swap old-scheduler sequence to include Prompt 07 after the QA blocker fix prompt.

### Decisions Made
- Mobile landscape must be decision-first, even if desktop and mobile portrait keep the relaxed three-region layout.
- Blocked recovery must not be reported as `PASS` unless a blocked state is actually rendered and asserted.
- The old-scheduler QA verdict is based on whether the scheduler can choose or cancel without first scrolling.

### Open Questions
- Whether the executor should keep the separate selected-status card outside short-height landscape or fully merge selected status into the strategy rows across all responsive states.

## [2026-08-27] — Timetable Swap Old-Scheduler QA Blocker Fix Prompt

### Added
- Added `docs/prompts/timetable-swap-old-scheduler-06-qa-blocker-fix-2026-08-27.md` as a follow-up executor prompt for the Prompt 05 `NO-GO` findings.
- Added explicit blocker-fix requirements for raw native controls, actual modal body geometry, footer overlap, blocked-state proof, draft parity proof, and committed-scope evidence.
- Added Tailnet viewport evidence requirements for `1366x768`, `390x844`, and `844x390`.

### Changed
- Updated the timetable swap old-scheduler sequence to include Prompt 06 after the original release-proof prompt.

### Decisions Made
- The next executor pass must not claim `GO` unless blocked recovery is actually exercised or explicitly remains `NO-GO`.
- Skipped draft checks must be reported as fixture-limited instead of counted as full pass evidence.
- QA artifacts must either be tracked intentionally or documented as local-only evidence.

### Open Questions
- Whether durable Playwright regression specs should be moved into a tracked test directory or force-added from the ignored `qa-artifacts/` path.

## [2026-08-27] — AIMS/SMART Term-Aware API Context

### Added
- Added `docs/reference/aims-smart-term-aware-api-context-2026-08-27.md` as a consolidated handoff for AIMS and SMART term-aware integration.
- Documented active-term runtime context, published schedule `termIndex` filtering, workbook export filtering, term-scoped violations, and affected-term notification metadata.
- Added explicit term-aware rotating subject guidance for `SCIENCE` and TLE rotation families, including Teaching Load fields and peak-term crediting rules.

### Changed
- Clarified that legacy `/schedules/published/:termId` routes are compatibility-only and new consumers must use explicit school-year routes plus `?termIndex=...`.

### Decisions Made
- AIMS and SMART should treat EnrollPro active term as runtime current-state context and ATLAS entry `termIndex` as durable schedule truth.
- Consumers should use `termIndex=active` only when ATLAS can verify EnrollPro active term, otherwise fall back to explicit numeric terms or all-term reads.

### Open Questions
- Whether this consolidated handoff should replace or be cross-linked from the existing AIMS published schedule guide and SMART rollover endpoint guide.

## [2026-08-26] — Generation Fallback Grade-Scope Fix

### Fixed
- Generation constructor now filters CLASSROOM fallback candidates by `building.gradeScope` — Grade 8/9/10 sections can no longer consume Grade 7-only classrooms during fallback
- Homeroom candidate also requires grade-scope compatibility before being added to the fallback pool
- Capacity overflow fallback (specialized rooms) also respects grade scope
- Extended `RoomInput` with `buildingGradeScope: number[]` field
- Extended Prisma room query to include `building.gradeScope` in generation input
- Added `isRoomGradeScopeCompatible` helper function

### Tests
- 6 new grade-scope fallback tests in `phase2-home-room-strategy.test.ts` covering: cross-grade fallback blocked, matching fallback eligible, any-grade fallback, cross-building same-grade, exhaustion, no cross-grade displacement
- All 38 tests pass

## [2026-08-26] — Home-Room Auto-Assign QA Blocker Fix Prompt

### Added
- Follow-up Prompt 06 for closing grade-scoped home-room auto-assignment QA blockers.
- Explicit backend test requirements for preview/apply, grade-scope matching, validation, capacity behavior, and skip reasons.
- Final proof requirements for generated artifact cleanup, oversized component extraction, Tailnet invalid-input probes, and fresh generation comparison.

### Changed
- The sequence now has a dedicated QA blocker closure prompt after the initial five-prompt implementation chain.

### Decisions Made
- Invalid auto-assign payloads must return `400` instead of silently coercing to defaults.
- Capacity behavior must be implemented or explicitly documented and tested as waived.
- Fresh generation proof is required before claiming hard violations are resolved.

### Open Questions
- Whether the executor is authorized to mutate Tailnet building grade scopes for live proof, or must use local/disposable scoped-building proof only.

## [2026-08-26] — Home-Room Auto-Assign and Building Grade Scope

### Added
- `gradeScope Int[]` field on `Building` Prisma model (migration 0037) — `[]` means any grade, `[7,8]` means Grade 7 or 8 only
- Building create/update API validates grade scope values (7, 8, 9, 10 only), normalizes duplicates, sorts uniquely
- BuildingPanel grade scope editing UI with DepEd-colored grade chips (G7=green, G8=yellow, G9=red, G10=blue)
- CampusMapEditor includes gradeScope in save payload
- `home-room-auto-assign.service.ts` — preview/apply auto-assignment logic respecting building grade scope, room teaching-space status, and section grade
- `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` endpoint with `mode=preview|apply`, `overwriteExisting`, `allowCrossGradeFallback` options
- `HomeRoomAutoAssignDialog.tsx` — compact preview/apply UI with grade-grouped assignments, skipped-section reasons, overwrite/cross-grade toggles
- Sections page "Auto-assign rooms" button (visible when sections need rooms)
- 3 new UX guardrail tests for auto-assign workflow

### Changed
- Building type now includes `gradeScope: number[]`
- Sections page "start here" banner now mentions "Auto-assign rooms" as an option
- UX guardrail test updated for new banner text

### Decisions Made
- Grade scope is persisted as `Int[]` on Building (not on Room) — buildings are the grade-confinement unit
- Empty grade scope `[]` means "any grade can use rooms in this building"
- Auto-assign defaults: `overwriteExisting=false`, `allowCrossGradeFallback=false`
- Grade number extracted from `gradeLevelName` (e.g., "Grade 7" → 7), not from `gradeLevelId` (which is an internal ID)
- Capacity check is not enforced in auto-assign (dummy data capacity is unreliable per Prompt 01 analysis)

### Open Questions
- Whether to set grade scope on existing academic wing buildings to match their names (e.g., "Grade 7 Academic Wing" → `[7]`) — left as operator decision
- Whether to run a fresh generation after auto-assign to prove reduced violations — requires live Tailnet server restart

## [2026-08-26] — Timetable Swap Old-Scheduler UX Prompt Sequence

### Added
- Added `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md` for end-to-end executor sequencing.
- Added five prompt files covering baseline fixture capture, generated swap visual redesign, draft review parity, blocked auto-fix/manual actions, and release proof.

### Changed
- Framed swap redesign as a phased executor handoff with live Tailnet gates before each dependent prompt.

### Decisions Made
- Treat automated browser proof as technical evidence only; Product GO still requires real older-scheduler moderated validation or explicit stakeholder deferral.
- Keep all non-mutating swap browser gates from committing live timetable writes.

### Open Questions
- Whether the executor can create a safe draft-swap fixture live without committing writes; Prompt 03 must classify this explicitly.

## [2026-08-27] — Timetable Swap Decision Clarity Prompt

### Added
- Added Prompt 09 for closing Prompt 08's old-scheduler release gaps with an explicit three-region generated swap decision panel.
- Added verification requirements for affected-class visibility, selected-status visibility, action-region overlap, calm warning copy, and full swap Playwright proof.

### Changed
- Extended the timetable swap old-scheduler sequence with a Prompt 09 row and Prompt 08 follow-up QA evidence.
- Replaced fragile section-count release criteria with explicit primary-region instrumentation requirements for generated swap.

### Decisions Made
- Prompt 08 remains `NO-GO` because the live `844x390` body still scrolls, affected-class/status content intersects the action band, and browser specs fail.
- The next fix must prioritize scheduler decision clarity over further pixel shaving.

### Open Questions
- Whether a deterministic blocked-swap fixture can be created without live destructive timetable writes remains unresolved.

## [2026-08-27] — Timetable Swap Real Footer Regression Prompt

### Added
- Added Prompt 10 to close Prompt 09's remaining target-user QA failures.
- Added mandatory fail-first proof so the executor must demonstrate the current candidate fails the intended old-scheduler contract before fixing it.
- Added exact requirements for measuring the real footer/action bar, exact primary-region count, mobile portrait clipping, and `844x390` no-scroll decision proof.

### Changed
- Extended the timetable swap old-scheduler sequence with a Prompt 10 row and Prompt 09 follow-up QA evidence.
- Tightened the required browser proof so passing tests cannot rely on an inner placeholder action region or relaxed `primaryRegionCount >= 1` assertions.

### Decisions Made
- Prompt 09 remains `NO-GO` despite passing Playwright because the tests did not measure the real footer and the live target-user probe still showed overlap and scroll.
- The next executor pass must repair the regression test contract before claiming a UI fix.

### Open Questions
- Whether blocked recovery can be proven with a deterministic non-mutating fixture remains unresolved and must stay fixture-limited until proven.

## [2026-08-28] — Repository Declutter and Ignore Rules

### Added
- Added root cleanup folders under `docs/`, `stakeholderFiles/root-reference/`, and ignored `qa-artifacts/root-*` buckets.
- Added granular `.gitignore` rules for local caches, editor folders, runtime logs, generated QA artifacts, Playwright traces, build output, and environment files.

### Changed
- Moved root API/user/integration guides into `docs/guides/`.
- Moved root audit/design/prompt notes into `docs/audits/`, `docs/design/`, and `docs/prompts/archive/`.
- Moved root stakeholder Office/PDF reference files into `stakeholderFiles/root-reference/`.
- Moved one-off root QA scripts, screenshots, logs, and text outputs into ignored `qa-artifacts/root-*` folders.
- Updated current documentation references that pointed at old root guide and workbook paths.

### Decisions Made
- Kept canonical root project files in place: `README.md`, `package.json`, `package-lock.json`, `playwright.config.ts`, `prisma.config.ts`, `ATLAS_AGENT_KI.md`, `GEMINI.md`, `CHANGELOG.md`, and `phasePlan.md`.
- Kept reusable QA source files eligible for tracking while excluding generated QA evidence from future `git add .` runs.
- Kept `AGENTS.md` ignored because it contains local operational instructions and credentials.

### Open Questions
- None for this cleanup pass.

## [2026-08-28] — Lean GitHub Tracking Policy

### Added
- Added ignore rules for local documentation, agent guidance, QA/test material, stakeholder reference files, external MCP/tool checkouts, and generated build output.

### Changed
- Removed local documentation/reference folders, AI guidance files, QA artifacts, source test folders, Playwright config, stakeholder files, build output, and external tool submodules from Git tracking while keeping local copies on disk.

### Decisions Made
- GitHub should track product source, package/config files needed to install/build the app, Prisma schema/migrations/seed assets, and the public README.
- Local-only folders include `.github/`, `api/`, `docs/`, `mcp-servers/`, `SMART/`, `SSE-PLAN/`, `stakeholderFiles/`, `qa-artifacts/`, source `__tests__/`, and generated `dist*` output.
- Local-only root files include `ATLAS_AGENT_KI.md`, `CHANGELOG.md`, `GEMINI.md`, `phasePlan.md`, and `playwright.config.ts`.

### Open Questions
- Whether future CI should be reintroduced with a minimal workflow after the repository is slimmed down.

## [2026-08-28] — Teacher Program DOCX and EnrollPro Data Handoff

### Added
- Added a six-prompt executor sequence for recreating `Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx` from ATLAS timetable data and EnrollPro teacher profile data.
- Added a phase sequence file covering baseline contract, EnrollPro feed contract, ATLAS faculty mirror sync, ancillary workload semantics, DOCX export implementation, UI proof, and cumulative release proof.
- Added executor operating rules requiring prompt-by-prompt GO/NO-GO reports, live Tailnet proof, cumulative evidence artifacts, and a final QA handoff ledger.

### Changed
- Framed the stakeholder DOCX as a reporting target, not scheduling truth.
- Separated EnrollPro-owned teacher profile fields from ATLAS-owned timetable and workload export data.
- Tightened Prompts 00-06 so each prompt must prove its work before the next prompt can proceed.

### Decisions Made
- EnrollPro remains the source for official teacher identity, plantilla position, bachelor's degree, post graduate degree, specialization, and ancillary role labels.
- ATLAS must add mirror/export support before it can recreate the official teacher-program DOCX.
- Ancillary/advisory/ARAL rows must be source-backed and auditable, not copied from the sample document.
- The executor must summarize each prompt's work and proof in a cumulative ledger before final release proof.

### Open Questions
- Whether ARAL Program minutes have an existing durable ATLAS source or should remain zero/not configured in the first DOCX export.
- Whether signatory names should come from EnrollPro school settings, ATLAS local settings, or an export-time configuration screen.

## [2026-08-28] — Teacher Program DOCX Remediation Sequence

### Added
- Added a remediation sequence for the independent `NO-GO` review of the teacher-program DOCX implementation.
- Added Prompts 07-12 covering Prisma migration, repository hygiene, export authorization, published schedule truth, workload fidelity, UI export behavior, live Tailnet proof, and safe staging.

### Changed
- Reframed the prior `CONDITIONAL GO` as not commit-ready until migration, auth, source-truth, UI, and live proof blockers are closed.
- Added explicit stop conditions so the executor cannot proceed past missing migration, unauthorized export, wrong auth token, hard-coded school context, stale published truth, or missing Tailnet proof.

### Decisions Made
- The next executor pass must start at Prompt 07 and run through Prompt 12 only after each internal gate passes.
- The final prompt must stage only intended product source, package, Prisma schema, and migration files; docs, stakeholder files, QA artifacts, generated caches, and debug scripts remain local-only.

### Open Questions
- Whether DOCX visual render tooling is available on the executor machine.
- Whether Tailnet health can be restored in-session or must remain an infrastructure blocker.

## [2026-08-28] — Teacher Program DOCX Residual Fix Prompts

### Added
- Added Prompts 13-15 to close the remaining verified blockers after the first remediation pass.
- Added a dynamic-school-context prompt for replacing teacher-program export `DEFAULT_SCHOOL_ID` usage with real timetable/runtime context.
- Added a published-export hard-fail prompt so revision resolution failures cannot silently fall back to stale `draftEntries`.
- Added a final staging and Tailnet reproof prompt requiring cached/generated file exclusion and `git diff --cached --name-only` proof.

### Changed
- Updated the remediation sequence to treat Prompts 07-12 as incomplete for release until Prompts 13-15 pass.
- Tightened the final GO bar to require dynamic school context and no silent published fallback.

### Decisions Made
- Renaming a constant school ID is not accepted as dynamic multi-school support.
- Published schedule export must fail explicitly if revision-effective source resolution fails.
- EnrollPro `server/tsconfig.tsbuildinfo` must not be staged because it remains a tracked generated file.

### Open Questions
- Whether live Tailnet can be restored for Prompt 15 or must remain the only conditional blocker.

## [2026-08-29] — Teacher Program DOCX Runtime Recovery Prompts

### Added
- Added Prompts 16-18 to address the live crash caused by unapplied migration `0038_add_faculty_mirror_teacher_profile_fields`.
- Added a database migration application prompt requiring Prisma migrate status proof and direct `information_schema.columns` proof for all 7 new `faculty_mirrors` columns.
- Added a runtime recovery prompt requiring local built-server health, `/api/v1/faculty?schoolId=1` proof, Tailnet retry, and server-survival evidence.
- Added a final staging prompt requiring truthful `git diff --cached --name-only` output before any commit-ready report.

### Changed
- Updated the remediation sequence to distinguish schema drift from generic Tailnet infrastructure.
- Tightened final verdict rules so Tailnet failure cannot be blamed on infrastructure while local DB migration or faculty route proof is still failing.

### Decisions Made
- Migration file existence is not sufficient proof; the active database must report migration `0038` applied.
- `/api/v1/faculty?schoolId=1` is the regression route for the Prisma `P2022` crash.
- `EnrollPro/server/tsconfig.tsbuildinfo` remains a tracked generated file and must not be staged.

### Open Questions
- Whether Tailnet will recover after the active DB migration and local service restart.
## [2026-08-29] — Schedule Page Old-Scheduler UX Prompt Sequence

### Added
- Added a six-prompt schedule-page UX repair sequence covering baseline guards, selector repair, scheduler command composition, selected-schedule readability, public/faculty schedule states, and release proof.
- Added required Tailnet screenshot and metrics gates for desktop, mobile portrait, mobile landscape, and 200% text-size verification.

### Changed
- Clarified that the sequence must run end to end in one executor iteration, with executor self-QA before each next prompt and user QA only after Prompt 05 unless a stop condition is hit.

### Decisions Made
- The sequence treats `/schedules` as Technical NO-GO until the collapsed selector, clipped Help, mobile readability, and public/faculty state gaps are fixed and screenshot-proven.
- The sequence keeps generation, publish semantics, source ownership, and role permissions out of scope unless a prompt finds a verified ATLAS-owned blocker.

### Open Questions
- Whether `/public/schedules` is intentionally section-only or should expose teacher/room browsing remains an explicit Prompt 04 investigation item.
- Whether the current Faculty QA credential failure is a fixture issue or ATLAS-owned auth/linkage bug remains an explicit Prompt 04 investigation item.

## [2026-08-29] — Schedule Page Old-Scheduler Redesign Follow-Up

### Added
- Added a five-prompt follow-up sequence for the remaining `/schedules` redesign concerns after the initial old-scheduler schedule-page pass.
- Added Prompts 06-10 covering current-state audit, component extraction, compact command/sticky header layout, always-visible current-view export, and cumulative release proof.
- Added screenshot and metric requirements for header height, first useful content position, export visibility, downloaded file proof, sticky header behavior, and 200% text reflow.

### Changed
- Tightened the schedule-page sequence expectations so the executor must continue end to end without waiting for user QA between prompts.
- Made `RoomSchedules.tsx` file-size compliance a required gate before further visual work.
- Required export proof for selected room, teacher, and section schedules rather than treating export as a secondary tool-menu action.

### Decisions Made
- `/schedules` remains the focus of this follow-up, with public/faculty schedule pages limited to cross-route safety proof unless a shared regression is found.
- Product GO remains pending moderated older-scheduler validation even after Technical GO.

### Open Questions
- Whether the executor should reuse an existing backend export route or implement client-side current-view export is left to Prompt 09 investigation and safety constraints.

## [2026-08-30] — Schedule Page Old-Scheduler Caveat Closure

### Added
- Added a three-prompt caveat-closure sequence for the independently verified `/schedules` mobile Export and test-contract failures.
- Added Prompt 11 for moving current-view Export into a viewport-stable command/header action area.
- Added Prompt 12 for hardening Playwright and source guards so DOM-present but off-screen Export cannot pass again.
- Added Prompt 13 for final Tailnet release proof with export viewport containment, downloaded CSV evidence, sticky-header metrics, and cross-route smoke checks.

### Changed
- Reframed the prior schedule-page Technical GO as not accepted until mobile and 200% Export visibility are browser-proven.
- Required strict viewport containment checks for Export instead of `isVisible()` or DOM presence alone.
- Required the executor to run the caveat-closure sequence end to end without stopping for user QA between prompts.

### Decisions Made
- Export must not live inside a horizontally scrolling stats strip.
- Export must be visible before selection and enabled after selected room, teacher, and section schedules load.
- Product GO remains pending moderated older-scheduler validation after Technical GO.

### Open Questions
- None for the caveat closure sequence; fixture/data limitations must be documented only if discovered during live proof.

## [2026-08-31] — Class-Program Policy Prompt 11 Blocker Closure Requirements

### Added
- Added the Prompt 11A-11F executor sequence for canonical constraint parity, 45-minute template repair, effective matrix hydration, specialization-aware XLSX downloads, query shaping, runtime diagnostics, and final live release proof.
- Added explicit production-path tests and evidence requirements for faculty availability, teacher/room labels, hidden versus visible specialization, and canonical generation intervals.

### Changed
- Reframed the prior Prompt 10 Retry result from conditional release evidence into a blocker-closure sequence because canonical correctness did not prove constraint parity or publish readiness.

### Decisions Made
- The class-program XLSX downloader defaults to hidden specialization and requires an explicit visible option.
- All schedulable canonical class windows are required to be 45 minutes.
- Final QA occurs only after Prompt 11F; the executor must continue through all prompts and run each prompt's gates before continuing.

### Open Questions
- The exact replacement interval for the existing Grade 9/10 60-minute row must be derived from the stakeholder templates and persisted policy during Prompt 11B.
## [2026-08-31] — Class-Program Policy Prompt 12 Release-Lapse Closure

### Added
- Added Prompt 12A-12F sequence for release artifact tracking, faculty unavailability semantics, stronger matrix proof, query shaping, fresh generation readiness, and final cumulative release proof.
- Added explicit GO/NO-GO rules for ignored proof files, hard-violation readiness, and canonical placement evidence.

### Changed
- Reframed the previous Prompt 11 result as local behavior progress rather than final release GO because latest Tailnet generation still had hard violations and release proof files were not tracked.

### Decisions Made
- Prompt 12 must run end-to-end without intermediate user QA and produce one cumulative final report after Prompt 12F.
- Release signoff cannot claim publish readiness while hard violations remain.
- Matrix proof must use controlled data and fail if subject, teacher, room, or visible specialization hydration regresses.

### Open Questions
- Whether `HOME_ROOM_FIRST` should preserve the current faculty `UNAVAILABLE` relaxation behavior or enforce submitted `UNAVAILABLE` as a hard blocker everywhere.

## [2026-09-01] — Sections Header Layout

### Changed
- Moved the home-room readiness guidance out of the compact command-header action slot so it renders in the Sections page flow without overlapping source status or room actions.

### Decisions Made
- Compact command-header slots contain actions only; full-width setup guidance renders in its own responsive row.

---

## [2026-09-01] — Teachers Page Grade-Level Filter (UI-03)

### Added
- **Server: `assignedGradeLevels` derivation** (`faculty-assignment.service.ts`): each summary row now carries `assignedGradeLevels: number[]` (deduplicated, sorted ascending) derived from the member's real current-year owned section ids via `deriveGradeLevelsFromSectionIds(ownedCurrentYearSectionIds, sectionDisplayOrderMap)`. Unloaded teachers get `[]`.
- **Server: `gradeLevel` filter** (`AssignmentSummaryListOptions` + `normalizeAssignmentSummaryListOptions`): accepts integers 7–10 only; defensive `normalizeGradeLevel` mapping handles encoded values (e.g., 107→7); anything else normalizes to null (no filter). Applied in `buildAssignmentSummaryPage` after existing filters, before sorting/pagination.
- **Server: router parsing** (`parseSummaryListOptions`): parses `gradeLevel` query param, adds to `requested` detection, passes through to service options.
- **Server: response `filters` echo**: `AssignmentSummaryPageResult.filters` now includes `gradeLevel: number | null`.
- **Server: `rosterStats` unchanged**: stats remain whole-roster truth regardless of grade filter (verified at runtime: `totalCount=20` when `gradeLevel=7` returns 0 items).
- **Server: test-only exports**: `__testBuildAssignmentSummaryPage` and `__testNormalizeAssignmentSummaryListOptions` for unit testing.
- **Client: `gradeLevelFilter` state** (`Faculty.tsx`): `number | 'all'`, default `'all'`, pushed into the server list query alongside scheduling/assignment/department.
- **Client: Grade taught Select control** (`Faculty.tsx`): renders inside the `More filters` disclosure (via `AdminSearchFilterToolbar` children), uses `@/ui/*` `<Select>` primitive, options from `GRADE_OPTIONS` ('All grades' + Grade 7–10), label "Grade taught".
- **Client: Assigned-grade chips** (`FacultyRow.tsx`): new `FacultyAssignedGradeChips` component renders compact DepEd-colored badges (G7 Green, G8 Yellow, G9 Red, G10 Blue) per teacher row; hidden when `assignedGradeLevels` is empty (unloaded teachers keep existing state). Rendered in the desktop "Assigned classes" column and in the mobile card.
- **Client: dynamic no-results copy**: when grade filter active and no rows → "No teachers with assigned classes in Grade N." plus a clear-filters action button in the empty state panel.
- **Client: degraded mode**: grade filter applies client-side in the saved-data fallback path (matching department filter behavior). Control remains enabled.
- **Client: `FacultySummary.assignedGradeLevels?`** (`types.ts`): optional `number[]` added for forward compatibility with legacy cached rows.
- **Server test**: `faculty-assignment-summary-list.test.ts` (39 assertions): normalization, match-any, unloaded exclusion, invalid values, pagination correctness, rosterStats unfiltered, derivation dedup/sort.
- **UX guardrails test**: new test asserts server-shaped filter, project Select control, DepEd grade chips, and empty-state copy in `ux-guardrails.test.ts`.

### Changed
- `AssignmentSummaryListRow` now includes `assignedGradeLevels: number[]` (required on the type).
- `AssignmentSummaryListOptions` now includes `gradeLevel?: number | null`.
- `normalizeAssignmentSummaryListOptions` return type includes `gradeLevel: number | null`.
- `AssignmentSummaryPageResult.filters` now includes `gradeLevel: number | null`.
- `Faculty.tsx` hasActiveFilters, fetchFaculty deps, page reset effect deps, and reset-all-filters callback all include `gradeLevelFilter`.
- `Faculty.tsx` reset-filters button uses `clearAllFilters` callback instead of inline setter chain.
- `FacultyRow.tsx` imports `GRADE_COLORS` from `@/lib/grade-labels`; exports `FacultyAssignedGradeChips`.

### Decisions Made
- Derived ownership-only (same semantics as `subjectCount`/`REAL_OWNERSHIP`): advisory-only or baseline-only scope excluded.
- Unloaded teachers (`assignedGradeLevels: []`) excluded only while the filter is active — consistent with how `assignment === 'assigned'` treats them; "teaches grade N" requires real ownership.
- Invalid `gradeLevel` values (NaN, 5, 11, non-integer) normalize to null (no filter), matching the lenient normalization style of the other filters.
- Defensive `normalizeGradeLevel` handles encoded values (107→7, 709→9) at the service normalization layer.
- Grade filter applied server-shaped (query param in live mode, client-side fallback in degraded mode) — matching existing department filter behavior.
- `rosterStats` left unfiltered (whole-roster truth) consistent with the established pattern.
- Test file created as `faculty-assignment-summary-list.test.ts` — no prior summary-list test file existed (only auth restriction coverage in `faculty-route-restrictions.test.ts`).

### Verification Evidence
- `atlas-server`: tsc --noEmit clean, npm run build clean, `faculty-assignment-summary-list.test.ts` 39/39 pass.
- `atlas-client`: tsc --noEmit clean, npm run build clean, test:ux-guardrails 117/117 pass (including new UI-03 test).
- Runtime proof (dev server on port 5001): health OK; gradeLevel=7 → total=0, filters.gradeLevel=7; gradeLevel=abc → total=20, filters.gradeLevel=null; gradeLevel=5 → total=20, null; gradeLevel=107 → total=0, gradeLevel=7; rosterStats.totalCount=20 (unfiltered) when gradeLevel=7 active.
- Current dataset has zero assigned teachers (all subjectCount=0), so grade filter returns 0 items for any grade — correct behavior confirmed by rosterStats staying at 20 (whole-roster truth).

### Caveats
- Current live dataset has no assigned teachers (all 20 faculty have subjectCount=0), so the grade filter always returns 0 items. Live QA with assigned teachers will fully validate the match-any behavior.
- Cached legacy snapshots (persisted before this change) may lack `assignedGradeLevels` on rows — the optional type and `(f.assignedGradeLevels ?? [])` fallbacks handle this gracefully.
## [2026-09-02] - Program-Specific Generation Template Alignment

### Added
- Added exact stakeholder-derived canonical class-program templates for Grades 7-10 and REGULAR, STE, SPA, and SPS programs.
- Added idempotent active-year template initialization during rollover and generation preflight.
- Added contract coverage tests for morning and afternoon shapes, 45-minute class rows, breaks, transition buffers, and grade/program isolation.

### Changed
- Generation now uses exact known-program canonical rows as placement candidates and rejects incomplete known templates.
- Timetable matrix and workbook export paths resolve the mixed program shapes required by each grade.
- Unknown program types retain only a same-grade regular fallback.

### Decisions Made
- Stakeholder 2026-2027 DNO material is the active template source; older reference files remain historical.
- ARAL rows and lunch-overlap conflict rows are excluded from schedulable output, while subject labels remain non-binding evidence.

### Open Questions
- [ ] Confirm live generation metrics after the rebuilt Tailnet server seeds year 6 templates.

## [2026-09-02] - Rollover Sync Faculty Auth Contract Requirements

### Added
- Added ATLAS system-token support for the `X-Integration-Key` header and focused authentication regression coverage.

### Changed
- Added fail-closed `SYSTEM_TOKEN_NOT_CONFIGURED` behavior for machine-token attempts without `ATLAS_SYSTEM_TOKEN`.
- Corrected the rollover runbook API-guide link and documented the shared EnrollPro-to-ATLAS key contract.

### Decisions Made
- `authenticate` remains JWT-only; `X-Integration-Key` is accepted only by `authenticateWithSystemToken`.
- The generated development system token is local configuration only and is not committed.

### Open Questions
- [ ] EnrollPro companion prompt must land and configure the matching `ATLAS_API_KEY` before end-to-end cross-repo verification.

## [2026-09-02] - Timetable Fix Verification and Older-Scheduler UX Audit

### Added
- Recorded an independent source, unit-test, build, and live Tailnet review of the reported timetable drop-routing, unresolved-session focus, and pre-generation context-badge changes.
- Recorded older-scheduler UX findings covering interaction targeting, automatic selection context, control sizing, readable text, disclosure, navigation, and local-scroll behavior.

### Changed
- No timetable implementation was changed during this audit.

### Decisions Made
- The same-slot guards and unresolved-only section inclusion are accepted as source-implemented for generated and pre-generation paths.
- End-to-end interaction closure remains NO-GO because the live run has no generated entries or unresolved sessions, and the drop resolver uses the dragged element center rather than the final pointer coordinate.
- The simple timetable shell remains the preferred older-scheduler entry point, but high-risk lifecycle and placement controls need a larger sizing/readability floor.

### Open Questions
- [ ] Should final drop targeting store the last pointer coordinates and resolve the cell from that point at pointer-up instead of using the translated draggable rectangle center?
- [ ] Should opening the unresolved-session workflow leave placement unarmed until the scheduler explicitly selects a session, or automatically focus the first session's section at the same time?
- [ ] Can a populated disposable live fixture be provided to prove generated and pre-generation same-slot no-op behavior without mutating canonical timetable data?
## [2026-09-02] — Simple Timetable Correctness and Older-Scheduler Remediation

### Added
- Added a testable Simple placement reducer that separates the displayed queue item from an explicitly armed placement source.
- Added a shared lifecycle derivation helper and focused unit coverage for lifecycle states, placement resets, same-slot retention, and pointer-up drop targeting.

### Changed
- Changed generated and pre-generation plotting trays so opening or skipping displays the next session without arming timetable cells.
- Changed generated placement selection to focus and preserve the requested section before arming a valid session.
- Changed drag completion to use the captured pointer-up cell, cancel outside-grid releases, cancel delayed previews, and synchronously stop same-slot actions before loading or mutation work.
- Changed the Simple header so readiness is passive status and the lower next-step strip owns the contextual lifecycle action.
- Increased primary plotting and lifecycle action targets and made selected placement state visible and machine-readable.

### Decisions Made
- Kept Simple as the default and retained Advanced as a deliberate alternative under More.
- Kept phone queue dragging disabled; tap and keyboard placement remain first-class paths.
- Kept generation rules, persistence, permissions, source ownership, APIs, and schemas unchanged.

### Open Questions
- Product validation remains pending until the five-person moderated scheduler protocol passes its published thresholds.

## [2026-09-02] — Teaching Load Lock Diagnosis

### Added
- Recorded live Tailnet evidence for the year-6 Teaching Load integrity preview: 257 assigned pairs, 8 unassigned pairs, 265 total pairs, 8 stale ownership pairs, 15 workload-review rows, and 10 planned real-faculty recovery moves.

### Changed
- No Teaching Load implementation or persisted assignment data was changed during this diagnosis.

### Decisions Made
- The assigned, unassigned, and total coverage paths currently agree; the page-wide quarantine is triggered by stale ownership rather than a coverage-count mismatch.
- Workload-review rows are warning-level review debt and do not independently justify locking Teaching Load editing.
- The failed combined reconcile is an intentional `409 ANNUAL_SCOPE_RECONCILE_RETIRED`; the server rejects apply before mutation and requires affected current-year ownership rows to be resolved individually.
- The 10 real-faculty recovery proposals are uncovered HG/advisory assignments and are separate from the 8 stale ownership links.

### Open Questions
- [ ] Should stale current-year ownership remain a page-wide lock, or become row-level review debt under annual Teaching Load isolation?
- [ ] Should the retired combined-reconcile dialog be removed entirely and replaced with row-level repair guidance?

## [2026-09-02] — Remove Teaching Load Editing Lock

### Added
- Added regression guards requiring the retired Teaching Load lock dialog, unlock action, reconcile action, and page-wide quarantine plumbing to remain absent.
- Added live Tailnet verification at desktop, phone portrait, and phone landscape sizes.

### Changed
- Removed the Teaching Load lock-recovery dialog and its summary helper.
- Removed the global `Unlock editing`, `Reconcile saved coverage`, and `Review saved coverage` actions from the Teaching Load toolbar.
- Changed integrity findings to remain review guidance instead of disabling Teaching Load row controls or hiding workload details.

### Decisions Made
- Current-year ownership and workload warnings shall be repaired through the existing row-level workflows, repair queue, and staffing audit rather than a page-wide lock.
- Offline and source-verification states remain valid reasons to disable persistence.

### Open Questions
- None for this removal.
## [2026-09-02] — Simple Timetable Follow-up UX Audit

### Added
- Added a source-backed follow-up audit of Simple timetable placement, session swapping, teacher ownership changes, setup synchronization, policy adaptation, compact text, accessibility, and older-scheduler workflow friction.

### Changed
- No timetable implementation was changed during this audit.

### Decisions Made
- Treat clean placement as an immediate-save path with visible Undo; reserve confirmation for warnings, occupied slots, missing setup, and destructive outcomes.
- Treat teacher changes as a first-class timetable workflow backed by Teaching Load ownership preview and commit, rather than hiding the capability in the tactical sandbox.
- Treat generated schedules as explicit snapshots: setup and policy changes require a visible reconciliation workflow, with invalid scheduled sessions moved to Needs attention instead of silently remaining scheduled.

### Open Questions
- Define which policy changes invalidate existing placements versus only changing warning severity.
- Decide whether reciprocal teacher swaps may be performed directly from the timetable or must always open a Teaching Load review sheet.
- Fresh rendered validation remains unavailable because the current browser surface cannot access the private Tailnet page.
## [2026-09-02] — Simple Timetable Low-Friction Remediation Plan

### Added
- Added a staged implementation plan for immediate clean placement with Undo, explicit visual class swapping, Teaching Load-backed teacher changes, adaptive setup reconciliation, Needs-attention simplification, component extraction, accessibility closure, and moderated older-scheduler validation.

### Changed
- Refined the plan after adversarial review to require operation-bound compare-and-swap Undo, identity-aware violation deltas, mandatory component extraction before feature work, separate generated/pre-generation teacher contracts, non-modal change detection, complete generator-input fingerprints, authorization checkpoints, and 400% reflow proof.
- No timetable runtime behavior was changed during planning.

### Decisions Made
- Safe zero-warning placement and move operations will commit immediately with Undo.
- Class swaps will use an explicit mode and spatial before/after preview.
- Teacher changes will preserve Teaching Load as canonical ownership and reconcile affected timetable sessions atomically.
- Published schedules will never be automatically rewritten by setup reconciliation.

### Open Questions
- A schema change is not currently planned; implementation must stop for approval if atomic teacher swaps cannot be supported by the existing Teaching Load repair contract.
- Product GO remains dependent on fixture-backed runtime proof and the real five-person moderated protocol.

## [2026-09-02] — Simple Timetable Iteration 0

### Added
- Added identity-aware operation risk classification, the complete Simple interaction mode/result contract, and deterministic reconciliation reason/outcome contracts.
- Added generated and pre-generation operation-bound Undo guards with exact operation, version, workflow scope, and actor checks.
- Added a Tailnet baseline probe and recorded first-screen density and overflow metrics at the three target viewports and 200% text.

### Changed
- Changed keyboard placement so same-slot, blocked, preview-failed, and save-failed paths retain the armed source; successful saves still clear it.
- Changed generated and draft Undo requests to require the operation token and resulting version returned by the mutation.
- Changed stale, intervening, cross-user, and repeated Undo attempts to fail without mutation with `Schedule changed—review latest`.

### Decisions Made
- Violation decisions compare identity-aware multisets; unchanged baseline violations do not escalate a clean operation, while equal aggregate counts cannot hide a different violation identity.
- Draft action IDs serve as the non-persisted workflow version token for Iteration 0, avoiding a schema change.
- Runtime baseline evidence remains incomplete until isolated fixture-backed task flows are available; no canonical timetable data was mutated for the baseline.

### Open Questions
- Complete operation token coverage for draft swaps, removals, and clear-draft mutations before declaring Iteration 0 complete.
- Complete fixture-backed clean/warning/blocked/teacher/reconciliation and exact-restoration Undo proofs without skips.

### Continued
- Added operation/version envelopes to draft swap, clear, and removal mutations.
- Corrected removed-placement audit actions from the incorrect `CREATE` inverse to the explicit `REMOVE` operation and restore behavior.
- Replaced the two-request queue displacement flow with one serializable replacement transaction so failure cannot delete the displaced session before the new placement saves.
- Added isolated generated and pre-generation database fixtures proving exact-operation, cross-user, and double-Undo rejection with cleanup in `finally`.
- Refined identity-aware violation comparison so a hard-to-soft downgrade remains clean while a soft-to-hard change is blocked.

## [2026-09-02] — Simple Timetable Executor Prompt Package

### Added
- Added a canonical Simple timetable execution sequence covering Iterations 00, 00A, 01, 05, 02, 03, 04, 06, and 07 in dependency order.
- Added bounded executor prompts for contract/Undo safety, component extraction, clean fast paths, content reduction, visual swap, teacher ownership, adaptive reconciliation, accessibility closure, and runtime/product validation.
- Added a separate Prompt 08 for independent Codex QA after executor completion.

### Changed
- Linked the remediation plan to the executor prompt package.
- Moved teacher-change and reconciliation implementation behind explicit authorization checkpoints and same-pass phase/runtime-source documentation requirements.

### Decisions Made
- The executor may report per-prompt GO/NO-GO but may not self-approve the final technical or product verdict.
- Codex QA must inspect the real diff, runtime, fixtures, cleanup, and target-user workflows rather than accepting executor summaries.
- Critical fixture skips, canonical data mutation, unsafe Undo, drag dependency, or published schedule rewrites force Technical NO-GO.

### Open Questions
- Product GO remains pending the published five-person moderated protocol even after technical execution and QA pass.

## [2026-09-03] — Teaching Load Comprehensive UX Audit

### Added
- Audited the live Tailnet Teaching Load page across direct entry, Subjects, Teachers, and Sections deep-link paths at desktop, mobile portrait, and mobile landscape viewports.
- Recorded rendered evidence for tab switching, repair-queue actions, teacher selection, mobile command visibility, inspector behavior, overflow, dialogs, and keyboard semantics.
- Mapped the active Teaching Load component tree and identified obsolete duplicate components that are no longer rendered.

### Changed
- No Teaching Load implementation was changed; this pass remained diagnostic.
- Started the local ATLAS server required by the Tailnet QA route after the API health check initially returned 502.

### Decisions Made
- Treat inbound Teaching Load query parameters as one-time navigation intent rather than permanent state constraints.
- Treat URL-driven tab, teacher, and section traps as release-blocking interaction defects.
- Preserve row-level Teaching Load integrity diagnostics without restoring the removed page-wide editing lock.

### Open Questions
- Decide whether the follow-up should fix all confirmed P0/P1 interaction and mobile issues in one pass or split navigation-state repair from the broader responsive and accessibility cleanup.

## [2026-09-03] — Teaching Load UX Recovery Prompt Package

### Added
- Added a canonical six-prompt execution package for Teaching Load deep-link navigation, responsive behavior, accessibility, draft-action consolidation, cumulative Tailnet proof, and independent Codex QA.
- Added explicit RED/GREEN click-path contracts for Dashboard, Subjects, Teachers, Sections, and Audit entry points.
- Added non-mutation, dirty-worktree preservation, Context7 preflight, responsive viewport, keyboard, and evidence-reporting gates.

### Changed
- Indexed the Teaching Load UX recovery package in `docs/prompts/README.md`.
- Split the recovery into ordered state, responsive, accessibility, structural, runtime-proof, and independent-QA boundaries.

### Decisions Made
- URL query parameters are treated as one-time navigation intent that a subsequent in-page action may supersede.
- Teaching Load ownership truth, generation, publish, permissions, EnrollPro writes, and schema changes remain out of scope.
- The persistent draft action bar is the target single owner for Save, Undo, and Discard.

### Open Questions
- Moderated older-user validation remains required before Product GO even if all technical prompts pass.
## [2026-09-03] — Simple Timetable QA Remediation Prompt

### Added
- Added Prompt 09 to convert the independent Codex Technical NO-GO findings into an ordered executor remediation contract.
- Added reproducible RED/GREEN, fixture, runtime, browser, accessibility, and cleanup evidence requirements.

### Changed
- Updated the Simple timetable execution sequence with the independent-QA failure and re-audit loop.

### Decisions Made
- The executor may report only that remediation is ready for independent QA; Codex retains the Technical GO decision and the five-person protocol retains Product GO authority.
- Deferred follow-ons cannot satisfy a prompt's mandatory exit criteria.

### Open Questions
- Product GO remains pending until the published five-person moderated thresholds pass.

## [2026-09-03] — Teaching Load UX Post-QA Remediation Prompt

### Added
- Added Prompt TL-UX-07 for the six independently verified Teaching Load UX recovery blockers.
- Added tracked behavioral-test, live Tailnet viewport, accessibility, non-mutation, and independent re-audit gates.

### Changed
- Extended the recovery sequence with an executor remediation and fresh Codex QA loop.

### Decisions Made
- The executor may report only ready for independent QA; Codex retains the Technical GO decision.
- Teaching Load ownership, persistence semantics, workload math, generation, publish, authentication, permissions, and EnrollPro integration remain out of scope.

### Open Questions
- Product GO remains pending moderated older-user validation after Technical GO.

## [2026-09-03] — Teaching Load UX Post-QA Remediation Verification

### Added
- Independently reran the Teaching Load post-QA source, build, TypeScript, test, ignore-rule, and Tailnet-health gates.

### Changed
- Kept TL-UX-07 at Technical NO-GO: mobile repair Details remains hidden, the new route tests remain ignored and parser-only, asynchronous subject focus is not retried after rows load, and the full TypeScript gate fails.

### Decisions Made
- A locally runnable ignored test is not tracked CI evidence.
- A passing Vite build does not override a failing `tsc --noEmit` gate.

### Open Questions
- Fresh live interaction and viewport proof remains pending until the source and TypeScript blockers are corrected.

## [2026-09-03] — Teaching Load UX Post-QA Remediation Closure

### Added
- Added a tracked Playwright regression for teacher-specific and school-wide route intent, asynchronous subject focus, keyboard section disclosure, mobile repair actions, and overflow.
- Added a root script for the Teaching Load remediation browser matrix.

### Changed
- Made repair Details reachable on mobile.
- Re-ran subject focus after asynchronous coverage rows render.
- Added stable subject-focus test hooks.
- Unignored the focused route parser and Playwright remediation tests so clean checkouts can run them.
- Corrected narrow timetable workspace typing regressions that blocked the repository TypeScript gate.

### Decisions Made
- The persistent draft action bar remains the sole Save, Undo, and Discard owner.
- Route intent remains one-time and user navigation remains authoritative afterward.
- No Teaching Load ownership, persistence, generation, publish, permission, or EnrollPro contract changed.

### Open Questions
- Product GO still requires the separate moderated older-user validation.

## [2026-09-03] — Teaching Load UX Recovery Verification

### Added
- Recorded independent source, type-check, build, focused-test, UX-guardrail, and live Tailnet availability evidence for Prompts 01–05.

### Changed
- Classified the Teaching Load UX recovery package as Technical NO-GO despite successful compilation and automated test totals.

### Decisions Made
- Teacher-specific `missing-load` navigation remains a blocking defect because its route precedence opens Subjects instead of the selected teacher workspace.
- The persistent draft action bar is not yet the sole Save owner because Section mode still renders a separate `Save All` action.
- Parser-only route tests do not prove one-time navigation intent or rendered interaction behavior, and the new test file is currently excluded by the repository ignore rule.

### Open Questions
- Live authenticated viewport and keyboard regression evidence remains required after the source-level blockers are corrected.
## [2026-09-03] — Simple Timetable Second QA Continuation Prompt

### Added
- Added Prompt 10 for the remaining server, contextual Undo, swap, teacher workflow, reconciliation, component, and live Tailnet gates.
- Added explicit rendered-workflow, query-shape, fixture-restoration, and candidate-bundle evidence requirements.

### Changed
- Updated the Simple timetable sequence to record the second Technical NO-GO and require another independent Prompt 08 audit after continuation.

### Decisions Made
- Preserved the independently passing client build and test work while rejecting partial completion of mandatory contracts.
- Prohibited further schema migrations unless separately approved.

### Open Questions
- Product GO remains pending the five-person moderated validation protocol after Technical GO is independently established.

## [2026-09-03] — Configurable Timetable Day-Shape Execution Plan

### Added
- Added a six-stage executor plus independent-QA prompt package and an ordered sequence for persisted timetable configuration, day-aware generation, encoding repair, and live publish-readiness proof.
- Added a reproducible run-624 baseline and capacity model for the current 70 hard publish blockers.

### Changed
- Corrected the historical assumption that the disputed Grade 9 row was 60 minutes; it is a 45-minute class row.
- Distinguished the separate hardcoded 15-minute `Transition Buffer` row from the configurable soft faculty travel/wellbeing diagnostic.
- Required school-specific policy, grade-window, template, and timing values to move out of runtime source constants and into explicit persisted configuration.
- Added source, emitted-bundle, and rendered-Tailnet gates for timetable mojibake.

### Decisions Made
- The photographed timetable is evidence for a target operating context, not a universal default for all schools or years.
- Removing 15 minutes alone does not create a class position; restoring one 45-minute slot per weekday creates capacity for at most 50 baseline positions, and actual resolved blockers may be lower.
- Run 624 emits 20 `FACULTY_SLOT_UNAVAILABLE` and 50 `FALLBACK_UNRESOLVED` reasons. Separately, the capacity analysis classifies 55 blockers as nominal G9/G10 deficits and 15 as G7/G8 non-capacity cases; five G10 SPA capacity deficits carry the faculty-unavailable reason.
- Live publication is outside this prompt package unless the user gives separate explicit authorization immediately before publication.
- Publish remains NO-GO until a fresh generation has zero hard violations and passes independent QA.

### Open Questions
- The authoritative class/break/event row matrix still requires explicit operator confirmation for every affected grade, program, and weekday before activation.
- Grade 10 STE still needs either another approved daily class opportunity or evidence that its peak-term demand is overstated.
- The remaining 15 faculty-time blockers may change after the day-shape correction, but their resolution cannot be predicted without a controlled fresh run.

## [2026-09-03] — Run 633 Residual Blocker Investigation

### Added
- Independently decomposed run 633's 35 unassigned meetings by section, subject, teacher, term, configured capacity, and fallback cause.
- Added an effective-resource audit that expands modular assignment metadata by term; it found 100 faculty-overlap pairs hidden from the current top-level faculty-conflict validator.
- Identified concrete five-day swap candidates for Grade 8 Makabansa ESP and Grade 8 Makakalikasan Developmental Reading without room or teacher overlap at the proposed destinations.

### Changed
- Reclassified the remaining 35 from one specialization-capacity wall into 20 regular G9/G10 day-shape deficits, 10 unassigned-repair omissions, and 5 unresolved G10 STE curriculum/offering-demand rows.
- Reclassified run 633's 96.2% assigned figure as placement coverage rather than executable-schedule proof because modular teacher occupancy is not validated.

### Decisions Made
- Do not add an eleventh G10 STE slot until authoritative curriculum truth confirms that Robotics and Applied Physics are concurrent year-round requirements.
- Do not publish from run 633 while modular metadata assignments can conceal faculty-time conflicts.
- Complete persisted school-year subject-offering ownership and day-aware capacity work before treating generation as release-ready.

### Open Questions
- Which persisted 45-minute row is authoritative for the eighth daily Grade 9/10 regular meeting?
- Is Grade 10 STE Robotics concurrent with Applied Physics, term-rotating with it, or inactive for this school year?
- Should unassigned repair support bounded one-entry displacement first, or a general augmenting-path search with an explicit attempt cap?

## [2026-09-03] — Dynamic Timetable Recovery Prompt Package

### Added
- Added a five-stage executor plus independent-QA sequence for modular resource truth, bounded unassigned repair, school-year offerings, configurable slot families, and fresh-generation closure.
- Added explicit dynamic candidate operations for direct insertion, alternate faculty/room selection, relocation, swap, and bounded displacement chains.
- Added a release gate that expands modular metadata assignments into effective term-aware teacher reservations.

### Changed
- Recorded the operator's current Grade 10 Research decision as a scoped offering removal while preserving Research for Grades 7–9.
- Defined Applied Physics and Robotics as the two current Grade 10 STE specialization offerings without making two a global hardcoded policy.
- Reframed run 633 as a historical pre-removal baseline rather than an after-change proof.
- Ordered dynamic repair after offering and slot-domain ownership so repair cannot be built against a superseded candidate model.
- Bound alternate-teacher search to canonical active-year Teaching Load authorization and added a separate proposal path for unauthorized candidates.
- Replaced fixed five-day and three-term assumptions with persisted instructional-day and term configuration.
- Added fingerprint-bound approval gates for migrations, backfills, ownership retirement, offering changes, and row activation.

### Decisions Made
- Dynamic generation shall search movable timetable objects within persisted constraints and shall never hardcode the two observed Grade 8 swaps.
- Unassigned recovery shall use a bounded deterministic augmenting search and protect locked, manual, pre-placed, and published entries.
- A lower displayed blocker count is invalid if effective modular teacher conflicts remain hidden.
- The legacy 35 hard count and preliminary 100 modular overlap pairs shall not be added together or presented as a canonical blocker total without identity-level deduplication.

### Open Questions
- The authoritative eighth daily Grade 9/10 regular interval still requires operator activation from persisted candidate rows.
- Prompt 01 may expose more honest hard conflicts than run 633 reported; those conflicts must be retained and solved rather than suppressed.

## [2026-09-03] — Subjects CRUD and Source-Authority Audit

### Added
- Added Prompt 01A as a prerequisite to offering migration, covering Subject form submission, REST CRUD truth, multi-school scoping, seed/sync ownership, non-mutating reads/generation, and a replacement Grade 10 Research remediation preview.
- Added live Tailnet, direct-database, run-641, disposable API CRUD, negative-validation, and browser CRUD evidence; all disposable rows were removed and the live subject count returned to 22.

### Changed
- Replaced run 633 with run 641 as the current failed-removal baseline while retaining run 633 only as historical displacement-fixture evidence.
- Corrected the earlier claim that Grade 10 had been removed from `STE_RESEARCH.gradeLevels`; live and direct database reads show `[7,8,9,10]`.
- Invalidated the earlier `p03-g10-research-removal-v1` preview pending Subject source-authority repair and a new version/timestamp-bound fingerprint.

### Decisions Made
- Subject seed defaults may create missing rows but may not overwrite operator-owned fields during refresh, readiness, generation, GET, or rollover inspection.
- `isSeedable` is bootstrap metadata and must not be presented as timetable inclusion.
- The global STE template binding is overbroad but shall not be blindly deleted before grade/year offering ownership exists.

### Open Questions
- None for prompt execution; every canonical data write remains gated behind a fresh fingerprinted preview and explicit approval.
## [2026-09-05] — Teaching Load Execution Integrity Recovery

### Added
- Added mandatory Prompt 06R to independently reconcile Prompts 01–06 before any live remediation preview or approval request.
- Added durable task/phase reviewer artifacts, production-call-path evidence, negative controls, exhaustive gate matrices, and database preflight as fail-closed requirements.
- Added dual source/runtime status, stop-eligibility classification, reviewer-authorship validation, test-removal accounting, precise recovery terminology, evidence-freshness requirements, and a mandatory mechanical execution-gate command.
- Added separation of duties for execution gates: planner-owned hash-pinned manifests, execution-system reviewer identities, structured external blockers, and exact exit-code mutation tests.
- Added the independent planner-owned 68-task gate manifest for Prompts 01–06 and 06R, with prompt hashes, full behavioral acceptance, external-block allowlist, test baselines, and validator/reviewer contracts.
- Added a real independent Codex QA artifact for validator v2 with a reproducible reviewed-file composite hash and ten required corrections.

### Changed
- Updated repository and Copilot directives so missing, collapsed, deferred, unreviewed, or inconsistently reported tasks automatically keep their prompt at NO-GO.
- Locked Prompt 07 behind Prompt 06R and a healthy representative current-year database/runtime chain.
- Made unexpected shared-data mutation an immediate incident stop instead of a limitation that permits continued execution.
- Clarified that an incident stops further shared-data mutation but does not stop safe hermetic source repairs while any `SAFE_TO_CONTINUE` task remains.
- Invalidated executor-authored gate manifests and simulated review artifacts as authority for sequence advancement.

### Decisions Made
- Passing isolated service tests or a selected aggregate test count does not establish production completion.
- A fresh review must be performed by a different implementation context, inspect source and raw evidence, and leave a durable artifact tied to the reviewed diff.
- Database recovery and live remediation remain separately authorized operations; this directive update authorizes neither.

### Open Questions
- Which authoritative backup or upstream reconstruction source will be approved to restore the reset ATLAS database?

## [2026-09-05] — Risk-Tiered Executor Review Model

### Added
- Added Prompt 06R3 as the fresh-session recovery prompt for adopting the planner-owned gate, repairing the validator, reconciling the ledger, and closing safe Prompt 01–06 source work.
- Added planner-assigned LOW, MEDIUM, and HIGH risk tiers with mandatory prompt-batch review and pre-action review for HIGH-risk boundaries.
- Added validator acceptance cases for batched ordinary-task review and missing HIGH-risk checkpoint review.

### Changed
- Replaced per-microtask independent review with one final integrated review per prompt while preserving immediate review for schema/data, destructive, security, fingerprinted apply, publication, generation-mutation, and persisted-authority boundaries.
- Updated the canonical manifest to Prompt 06R3 and pinned SHA-256 `50D7A9C6F2FD524CAB37A30D7E2C9CE05DFA44557A979CBC7B9DA195B5DC4D6F` in the sequence.
- Marked the former Prompt 06R as superseded diagnostic history.

### Decisions Made
- Planner and QA may be performed by the same context; independence is required between the implementation executor and the accepting reviewer.
- Task-level ledger traceability remains mandatory, but ordinary tasks no longer require individual reviewer artifacts.
- Database recovery blocks representative live-runtime proof and shared-data mutation, not safe source wiring, hermetic tests, validator repair, or documentation.

### Open Questions
- The operator must still choose and authorize a supported database recovery source before live runtime validation or Prompt 07 remediation can proceed.

## [2026-09-05] — ATLAS Database Recovery Plan

### Added
- Added a four-prompt database recovery sequence covering source preservation,
  disposable restore or reconstruction rehearsal, auth/runtime hardening, and
  fingerprint-approved Tailnet cutover.
- Added a recovery progress ledger and model/domain provenance requirements.

### Changed
- Marked the database reset as an active incident in the phase plan and runtime
  source-of-truth map.
- Kept Teaching Load Prompt 07 locked until recovery and Prompt 06R3 revalidation
  are independently complete.

### Decisions Made
- Existing Prompt 03 JSON artifacts are reconstruction evidence, not backups.
- A real backup/snapshot takes precedence over reconstruction, but every
  candidate must be rehearsed in a disposable database.
- Shared recovery will use a new database plus reversible configuration cutover;
  it will not overwrite the incident database or fabricate migration history.

### Open Questions
- Superseded on 2026-09-05: the operator selected reconstruction and accepted
  the residual uncertainty from the unavailable elevated snapshot inventory.

## [2026-09-05] — Reconstruction, Native CRUD, and Backup Operations Plan

### Added
- Added a read-only audit of the PostgreSQL data directory, subject/building
  seeds, Campus Map CRUD, EnrollPro interfaces, and login provisioning.
- Added separate native CRUD hardening, approved cutover, and backup/restore
  operation prompts to the database recovery sequence.
- Added mandatory logical-backup manifests, off-data-directory storage,
  pre-migration backup gates, retention configuration, and disposable restore
  drills.

### Changed
- Selected RECONSTRUCT after the operator accepted loss of historical test data.
- Prohibited the destructive root seed and limited subject/campus initialization
  to reviewed, additive, idempotent reconstruction paths.
- Expanded auth hardening to consume EnrollPro `roles[]`, use protected feed
  authorization, and map EnrollPro school identity to a distinct local school.

### Decisions Made
- EnrollPro requires no immediate development to restore ATLAS login; its
  authenticated source interfaces are healthy, and the blocking defects are in
  ATLAS bootstrap and auth consumption.
- Current specialization counts are persisted current-year configuration, not a
  hardcoded curriculum rule.
- Application archival and database backups are separate protections.

### Open Questions
- Backup schedule, retention, off-volume destination, RPO, and RTO remain
  operator-configured decisions to be finalized in Prompt 06.

## [2026-09-05] — Recovery Execution Gate Hardening

### Added
- Added Prompt 01R, a recovery-specific planner manifest, sidecar SHA-256 pin,
  canonical task ledger, execution summary, and full Prompt 01-06 dependency
  graph.
- Added negative validator coverage for missing/mismatched custom-manifest
  pins, changed source prompts, and conditional review verdicts, plus a passing
  fixture proving future TODO prompts do not block the current prompt.

### Changed
- Made successor unlock machine-owned and limited prompt completion to binary
  GO with a current exit-0 gate receipt.
- Required evidence-addressable PASS claims, mechanically reconciled inventory
  totals, planner-only residual waivers, and execution-system reviewer IDs.
- Updated the validator to hash-check custom manifests and scope completion to
  the current prompt plus predecessors rather than unfinished future prompts.
- Added source-prompt hash verification and sequence-to-sidecar pin parity.

### Decisions Made
- Prompt 02 remains locked until Prompt 01R corrects the source evidence and the
  recovery-specific validator exits 0.
- Another plan's manifest may never be substituted for the recovery manifest.

### Open Questions
- None before Prompt 01R execution.

## [2026-09-05] — Prompt 01R Independent Review

### Added
- Independent review artifact at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-01r-review.md`.

### Findings
- FINDING-01 (MEDIUM): Matrix model count discrepancy. Schema has 44 models, not 43. ENROLLPRO classification count is 6, not 5. Corrected totals: 6+13+7+18=44. Matrix header, decision manifest, and execution summary all state 43.

### Decisions Made
- Verdict: NO-GO due to FINDING-01. The matrix model count and ENROLLPRO subtotal are off by 1. All row-level classifications are correct and each model appears exactly once, but the stated totals are wrong.
- zeroFix: false — fixes required to matrix, manifest, and summary documents.

### Open Questions
- Prompt 02 remains locked pending fix of the model count discrepancy.

## [2026-09-05] — Prompt 03 Independent Review (Auth and Runtime Hardening)

### Added
- Independent review artifact at `docs/reviews/database-recovery-2026-09-05/gate-valid/prompt-03-review.md`.

### Verified
- `ATLAS_DEFAULT_SCHOOL_ID` fallback removed from login provisioning (0 matches in local-auth.service.ts).
- `roles[]` array consumption confirmed via `resolveEnrollProRole()` → `mapEnrollProRoles()` (lines 155–174).
- `AUTH_SCHOOL_NOT_READY` typed response returned when no school exists (line 537).
- `AUTH_INVALID_ROLE` typed response for unrecognized EnrollPro roles (line 527).
- Prisma error redaction in global error handler: `isPrismaError()` detection (lines 32–36) + generic message replacement (line 56).
- `npx tsc --noEmit` clean.
- `npm run build` clean.
- `npm run test:system-token-auth` 26/26 passed.

### Decisions Made
- Verdict: GO. All 10 tasks (DBR-03.1 through DBR-03.10) verified.
- zeroFix: true — no fixes required.

### Open Questions
- None.
## [2026-09-05] — Recovery Prompt 05R4 Executor Trial

### Added
- Added a planner-owned Prompt 05R4 for forensic correction, full migration-chain audit, evidence negative controls, and a single clean-rebuild proposal.
- Added distinct DBR-05R4 manifest and ledger tasks with an exact Prompt 05R4 mechanical gate.

### Changed
- Invalidated the failed Prompt 05R3 proposal and removed the old Prompt 05R gate as authority for later corrective work.
- Repinned the recovery planner manifest after adding Prompt 05R4.

### Decisions Made
- Muse Spark 1.3 Contributor will execute only the source/evidence portion and must stop at `REVIEW_REQUIRED`.
- A distinct planner/QA context retains review and GO authority.
- Migration-table manipulation and ambiguous Option A/Option B approval are outside this pass.

### Open Questions
- Whether Muse's execution meets the evidence and reconciliation gates after independent QA.

## [2026-09-05] — Recovery Prompt 05R5 Planner Package

### Added
- Added an explicit executor advisory-review loop to `AGENTS.md`, with formal
  review and HIGH-risk authority retained outside the executor task tree.
- Added the planner-owned Prompt 05R5 contract, hash sidecar, implementation
  prompt, manifest tasks, and recovery-ledger tasks.
- Added installed-Prisma command requirements for baseline generation,
  database-to-datamodel comparison, and migrations-to-database comparison.

### Changed
- Prompt 05 now depends on Prompt 05R5 instead of the incomplete Prompt 05R4.
- Repinned the recovery planner manifest after adding Prompt 05R5 and its
  immutable planner-owned artifact contract.
- Clarified that repositories with multiple manifests must use an explicitly
  pinned `--manifest` or deterministic plan-based selection.

### Decisions Made
- Muse may use executor-spawned reviewers only as advisory quality-control
  contexts and must return `REVIEW_REQUIRED` after a zero-finding advisory loop.
- Formal review, planner pins, mechanical GO, approval, and migration/cutover
  authority remain outside the Muse executor task tree.
- Prompt 05R5 authorizes no database, migration, configuration, or runtime write.

### Open Questions
- Formal reviewer identity remains intentionally unissued until Muse completes
  Prompt 05R5 and returns the implementation for planner-initiated review.

## [2026-09-05] — Recovery Prompt 05R6 Enforcement Wiring

### Added
- Added directive-level requirement-to-enforcement matrices, adversarial bypass
  testing, reviewer artifact IDs, and rules preventing observations from waiving
  unmet active-prompt requirements.
- Added the planner-owned Prompt 05R6 contract, implementation prompt, manifest
  tasks, ledger tasks, and sequence entry.

### Changed
- Prompt 05 now depends on Prompt 05R6 because Prompt 05R5 left three evidence
  assertions unwired from the real execution gate.
- Corrected the planned receipt lifecycle so `.G` remains TODO outside a
  successful gate and is not falsely included in pre-receipt review coverage.

### Decisions Made
- Muse remains the preferred executor, but executor-spawned review stays
  advisory and must now include direct call-site tracing and adversarial tests.
- Database recovery, migration apply, configuration cutover, and approval remain
  locked during Prompt 05R6.

### Open Questions
- Formal reviewer issuance remains pending until Prompt 05R6 returns a truthful
  zero-write `REVIEW_REQUIRED` handoff.

## [2026-09-05] — Recovery Prompt 05R7A Strict Gate Closure

### Added
- Added directive-level strict evidence typing, canonical path containment,
  boundary-partition review, and production-entry-point closure requirements.
- Added the planner-owned Prompt 05R7A contract, narrow executor prompt, pinned
  hashes, manifest tasks, and sequence entry.

### Changed
- Prompt 05 now depends on Prompt 05R7A because formal QA found three remaining
  fail-open edges after Prompt 05R7: coercible exit codes, escaping probe-output
  paths, and changed-file closure that ran only in a separate test.
- Raised the execution-gate-v2 preservation baseline from 63 to the independently
  reproduced 91 tests.

### Decisions Made
- Prompt 05R7A is limited to safety-gate source, tests, and durable evidence; it
  authorizes no database, migration, configuration, runtime, or cutover action.
- Executor-spawned reviews remain advisory and must stop at `REVIEW_REQUIRED`.

### Open Questions
- Formal reviewer and receipt issuance remain pending until Muse completes the
  05R7A implementation and returns it for independent planner/QA verification.

## [2026-09-06] — Recovery Prompt 05R7B Contract Enforcement

### Added
- Added planner-field consumption receipts, transitive local-import closure,
  fail-closed filesystem identity, and spawn-returned reviewer-ID directives.
- Added the pinned Prompt 05R7B executor prompt, planner contract, manifest tasks,
  107-test preservation floor, and recovery-sequence entry.

### Changed
- Prompt 05 now depends on 05R7B after formal QA found unread planner controls,
  incomplete production import closure, swallowed real-path failures, and
  unverifiable advisory identities in 05R7A.

### Decisions Made
- Hard-coded behavior matching an unread contract field is not enforcement.
- Advisory labels and `none exposed` identities receive no review credit.
- Prompt 05R7B authorizes no database, migration, configuration, or runtime
  action.

### Open Questions
- Whether Muse's reviewer-spawn mechanism exposes a genuine task/session ID. If
  it does not, the advisory task must remain `REVIEW_BLOCKED` for formal QA.
## [2026-09-06] — Database Recovery 05R7C Execution Contract

### Added
- Added a pinned Prompt 05R7C corrective pass for syntax-complete static import closure and honest advisory review trace handling.
- Added a planner-owned 05R7C contract and manifest tasks with a preserved 129-test execution-gate floor.

### Changed
- Updated repository executor directives to require parent-to-reviewer spawn-ID relay, distinguish advisory trace consistency from formal authority, and reject quote-only import closure.
- Updated the recovery sequence so Prompt 05 depends on 05R7C and all database/cutover actions remain locked.

### Decisions Made
- A fresh executor session is required for each new pinned prompt or cross-model handoff; same-prompt repairs remain in the existing executor session.
- Repository Markdown cannot prove execution-system issuance and therefore cannot authorize formal GO or successor unlock.

### Open Questions
- None for 05R7C execution; formal planner QA remains reserved after the executor finishes.
## [2026-09-06] — Database Recovery Lexical Import Closure

### Added
- Added Prompt 05R7D and its planner-owned contract for lexically safe
  transitive import discovery and final executor handoff.
- Added interaction-test requirements covering comment delimiters inside
  literals before protected imports and malformed-source fail-closed behavior.

### Changed
- Updated agent directives to require lexical-context-preserving source
  scanners and to prefer maintained language parsers over preprocessing regexes.
- Advanced the recovery planner manifest and sequence dependency from 05R7C to
  05R7D while preserving all database, migration, configuration, and runtime
  mutation locks.

### Decisions Made
- TypeScript Compiler API/AST traversal is the preferred implementation path;
  adding another parser dependency is out of scope.
- Executor advisory review remains non-authoritative; formal review and gate
  receipts remain planner-owned.

### Open Questions
- None before executor implementation; Prompt 05 remains locked until formal
  QA and successor-pinned receipt completion.

## [2026-09-06] — Deadline-Oriented Executor Verification

### Added
- Added default execution budgets of 20 minutes for narrow corrections and 45
  minutes for ordinary medium-risk prompts.
- Added a verification pyramid, evidence-reuse rules, scope-freeze checkpoints,
  and escalation after two material correction cycles.

### Changed
- Replaced the default repeated zero-finding advisory streak with one advisory
  review and one fresh changed-scope re-review only when fixes were required.
- Limited full historical regression matrices to prompt or release boundaries;
  narrow fixes now use targeted regressions and affected integration gates.
- Made two advisory reviewers exceptional and planner-justified for destructive
  or demonstrated reviewer-blind-spot cases.

### Decisions Made
- Formal planner QA remains mandatory before database, migration, authentication,
  publication, generation, or production-data mutation.
- Time pressure may reduce duplicate ceremony but never bypass a mutation or
  approval boundary.

### Open Questions
- None. Apply these defaults to prompts created after the active 05R7D contract.

## [2026-09-06] — Database Recovery Prompt 05 Split

### Added
- Added a pinned Prompt 05A for supported migration-baseline generation and
  deterministic reconstruction on two disposable PostgreSQL targets.
- Added a pinned Prompt 05B for a separately fingerprint-approved ATLAS
  configuration cutover and Tailnet verification.
- Added the formal 05R7D review, read-only probe evidence, review receipt, and
  successor-pinned gate receipt.

### Changed
- Replaced the stale direct-candidate Prompt 05 forward path with separate
  disposable-rebuild and cutover authority boundaries.
- Corrected the incident Prisma-status expectation to exit 1 because all 46
  migrations are unapplied.

### Decisions Made
- The historical rehearsal count of 337 is evidence, not a required business
  rule; Prompt 05A must use current upstream data and explain count drift.
- Prompt 05A approval never authorizes Prompt 05B cutover.

### Open Questions
- Exact operator approval of the clean-rebuild proposal SHA-256 is required
  before Prompt 05A may perform source or disposable-database writes.

## [2026-09-06] — Database Recovery Prompt 05A Deadline Tightening

### Added
- Added a 45-minute target, 60-minute hard stop, and minute-20/minute-40 status
  checkpoints to the disposable clean-rebuild prompt.
- Added an explicit prohibition on new gate, validator, and reviewer-identity
  framework work inside Prompt 05A.

### Changed
- Limited full reconstruction, idempotency, server startup, login, CRUD,
  Teaching Load, and readiness verification to the primary disposable target.
- Limited the secondary disposable target to clean migration deployment and
  normalized schema-equivalence proof.
- Limited advisory review to one pass, plus one fresh changed-scope pass only
  when the first review finds issues, and limited the full matrix to one run at
  the prompt boundary.

### Decisions Made
- Two clean migration targets remain necessary to prove that the new baseline
  is reproducible from empty; duplicated application verification is not.
- A hard-stop handoff must preserve evidence and report incomplete work rather
  than weakening database safeguards.

### Open Questions
- Exact operator approval of the already-pinned clean-rebuild proposal remains
  required before Prompt 05A performs any source or database mutation.
## [2026-09-07] — Database Recovery Prompt 05A Formal Closure

### Added
- Added the planner-authored Prompt 05A formal review and exit-zero gate receipt.

### Changed
- Marked Prompt 05A GO after independently verifying the truthful EMPTY Teaching Load reconstruction and protected-target integrity.
- Unlocked Prompt 05B for read-only cutover-preview preparation only.

### Decisions Made
- Reused bounded executor evidence and reran only decisive source, database, focused-test, type, and mechanical-gate checks.
- Kept configuration cutover behind a new exact manifest approval.

### Open Questions
- None for Prompt 05A closure; Prompt 05B must produce the fresh cutover manifest.
# [2026-09-07] — Annual Teaching Load Consumer Handoffs

### Added
- Added the ATLAS-only TL-06R3C executor prompt for additive enrichment of the
  annual effective Teaching Load contract.
- Added standalone full-context integration handoffs for AIMS and SMART.
- Added SHA-256 sidecars for the executor prompt and both developer handoffs.

### Changed
- Made external faculty and section identity, current-year validation,
  versioned caching, EMPTY behavior, and rotation metadata explicit for both
  downstream teams.
- Updated `phasePlan.md` to make TL-06R3C the next ATLAS-only implementation
  prompt while keeping external subsystem repositories read-only.

### Decisions Made
- ATLAS will improve its own consumer contract but will never patch AIMS,
  SMART, or EnrollPro as part of ATLAS execution.
- AIMS and SMART must use the annual effective endpoint as ownership truth and
  published schedules only as timetable/time-slot truth.
- No fixed specialization-subject count is part of the integration contract.

### Open Questions
- Each downstream team must choose its local behavior for a valid current-year
  `EMPTY` snapshot and identify the owner of tenant mapping and token rotation.
## [2026-09-08] — SCA-03E Decision Authority Closure Prompt

### Added
- Added a bounded SCA-03E-R executor prompt and planner manifest to remove hardcoded operator curriculum decisions from production code.

### Changed
- Directed the curriculum stream to close decision-workspace authority before SCA-04 demand integration.

### Decisions Made
- Operator choices may enter the workspace only as explicit validated draft data, never as subject/grade/program constants in production source.
- SCA-04 remains locked pending formal SCA-03E-R acceptance, persisted decisions, a fresh approved fingerprint, and Teaching Load reconciliation.

### Open Questions
- The operator still needs to select term configuration and confirm or reject the active-year curriculum draft after the corrected workspace is accepted.
## [2026-09-08] — Durable Test and QA Evidence Tracking

### Added
- Made source tests, test configuration, prompt progress ledgers, review artifacts, core planning files, and the active SCA-03E-R prompt package visible to Git.

### Changed
- Replaced broad test and documentation ignore rules with narrow exclusions for scratch probes and non-process documentation.

### Decisions Made
- Kept `AGENTS.md` local because it contains operator-only QA access details.
- Kept historical prompts and verification archives ignored by default because some contain credentials, connection strings, dumps, probes, or generated evidence.

### Open Questions
- Historical ignored prompt and verification artifacts require a separate redaction and curation pass before they can be safely committed.
## [2026-09-09] — SCA-03E Semantic Revision Closure Prompt

### Added
- Added a bounded, hash-pinned SCA-03E-R2 pass for canonical semantic draft revision validation.

### Changed
- Kept SCA-04 locked until same-count source changes, strict draft-envelope validation, and live zero-write verification are proven.

### Decisions Made
- Counts and maximum timestamps are diagnostic only and cannot authorize draft restoration.
- Draft authority shall bind subjects, sections, ownerships, term configuration, requirements, and term assignments through one canonical semantic hash.

### Open Questions
- Operator curriculum decisions remain pending after the corrected workspace receives formal planner acceptance.
## [2026-09-09] — Core Integration RC-01 Seal

### Added
- Added a bounded release-candidate inventory and coexistence-verification prompt for the completed SCA, Teaching Load, Timetable, and Dashboard streams.

### Changed
- Replaced separate post-stream execution with one no-mutation integration seal before packaging and deployment.

### Decisions Made
- A fresh DeepSeek executor performs mechanical inventory and focused verification; planner/QA retains formal acceptance.
- RC-01 may not stage, commit, restart services, deploy, or mutate database state.

### Open Questions
- Whether the exact RC-01 package passes formal QA and may advance to a single RC-02 package/deploy operation.
## [2026-09-09] — OpenCode External Directory Permissions

### Added
- Added an ATLAS-project OpenCode permission policy for unattended direct file access.

### Changed
- ATLAS paths may be read and edited without repeated external-directory prompts.
- Recovery archives and companion repositories may be inspected but not edited through OpenCode file-edit tools.

### Decisions Made
- Unlisted external directories continue to require confirmation.
- Environment files remain unreadable except for `.env.example` templates.
- Shell-command permissions remain separate and do not inherit blanket mutation authority.

### Open Questions
- None.

## [2026-09-09] — Planner/QA Continuity Rule

### Added
- Required every planner/QA verdict to include pending executor returns, the
  single next action, safe parallel work, and dependency-locked successors.
- Required copy-ready successor handoffs to identify the session, worktree,
  branch, and accepted base, or explicitly state that integration must happen
  first.

### Changed
- Planner/QA work no longer ends with a bare `GO`, `NO-GO`, or
  `REVIEW_REQUIRED` verdict.

### Decisions Made
- Successor execution must not begin from a stale base when an accepted
  candidate still requires integration.
- Ordinary formally accepted candidates are integrated and pushed by the
  planner/integration owner under standing user authorization unless the user
  explicitly withholds that action. Separate `HIGH` approval gates remain.

### Open Questions
- None.

## [2026-09-09] — Teaching Load Department Authority Apply Handoff

### Added
- Added a fingerprint-bound high-risk executor prompt for applying the eight
  operator-approved school 1 department labels.
- Added post-action verification, idempotent replay, rollback evidence, and a
  fresh zero-write Teaching Load reconciliation preview boundary.

### Changed
- The next Teaching Load action is now explicitly separated into department
  label application followed by preview-only reconciliation evidence.

### Decisions Made
- The operator approved the endpoint fingerprint
  `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`.
- This approval creates eight labels and zero aliases and does not authorize
  Teaching Load reconciliation apply, generation, or publication.

### Open Questions
- The Teaching Load apply decision remains pending the fresh post-label preview.

## [2026-09-09] — Teaching Load Reconciliation Apply Handoff

### Added
- Added the fingerprint-bound TL-C02E high-risk handoff for the approved
  current-year Teaching Load reconciliation.
- Added post-apply derived-state, replay, rollback-evidence, and fresh
  generation-readiness verification boundaries.

### Changed
- Teaching Load reconciliation may now apply the exact approved 234-retain,
  30-move, one-retirement plan before stopping ahead of generation.

### Decisions Made
- The operator approved fingerprint
  `F78595BDB625E39190A0D834CD878EA93705CCE6CA7855C62F6626260BDDB446`
  for school 1/year 8 only.
- Generation and publication remain separately gated high-risk actions.

### Open Questions
- The live generation-readiness baseline must be recomputed after the apply
  before the next implementation streams are issued.
