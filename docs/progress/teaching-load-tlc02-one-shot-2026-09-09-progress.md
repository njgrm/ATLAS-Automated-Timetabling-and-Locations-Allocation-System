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