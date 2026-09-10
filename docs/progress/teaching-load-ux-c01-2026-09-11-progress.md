# TL-UX-C01 Teaching Load Workspace -- Progress Ledger

- Plan: `docs/prompts/teaching-load-ux-one-shot-tluxc01-2026-09-11.md`
- Worktree: `D:/ATLAS-worktrees/teaching-load-ux-c01`
- Branch: `work/teaching-load-ux-c01`
- Base SHA: `36c5d3d1735728c1870f5e0ccfe36ca54a8a6b5d` (refreshed `origin/main`)
- First candidate SHA: `dcd8ffe5a3b4b90cdecc83bc370c743d01387bd7`
- Correction candidate SHA: `9982ae173eabf6395acc020029665e22b2da398f`
- Risk: MEDIUM source/UI with HIGH interaction guardrails; no live mutation authorized.

## Status

| Task | Status | Evidence |
|---|---|---|
| Pass A preflight + inventory | DONE | base clean; client tsc green at base |
| Pass B remove split authority + scope binding | DONE | split-brain POST/state removed; reconnect/global-reset/staffing-audit/jump-list removed; `scopeKey` + `resetForScope` added |
| Pass C rebuild operator workspace | DONE | master-detail kept; compact single next-step queue; Subjects mode collapsed into Sections; over-cap chip filters teachers |
| Pass D mutation integrity | DONE (bounded) | exact-pair transfer helper; per-faculty atomic serializable PUT + exact partial-commit receipt |
| Pass E Homeroom/adviser | DONE (client) | canonical `code === 'HG'` only in touched client paths (including `SubjectRow` after correction); server adviser-suggestion priority NOT changed (deferred risk) |
| Pass F browser QA | DONE | live Tailnet baseline + isolated candidate matrix (Tailnet IP) |
| Pass G independent review | REVIEW_REQUIRED | advisory review 1 (task `ses_f736e4e91ffeRHsyWphu2hBL3F`) found 1 BLOCKING (`SubjectRow` name-based HG) + 4 non-blocking; correction `9982ae17`; fresh changed-scope review (task `ses_f736616c5ffeHA3w2PKK7syKyG`) returned `ACCEPT_READY`. Executor still returns `REVIEW_REQUIRED`. |

## Advisory review outcome

- Review 1 verdict: `CORRECTION_REQUIRED`.
  - BLOCKING: `SubjectRow.tsx` still used display-name HG matching.
  - Non-blocking: partial scope-reset surface, orphan imports/dead state, forced 640x360 min-height, Playwright floors weaker than the audit.
- Correction `9982ae17`: canonical `subject.code === 'HG'` in `SubjectRow`; guard test extended to scan it; orphan imports/dead state (`departmentStats`, `reviewDismissed`, unused `useTeachingLoadUI` params) removed.
- Review 2 (fresh changed-scope): `ACCEPT_READY`; all rerun gates green; no new material defects.

## Changed paths

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/hooks/useTeachingLoadRepairQueue.ts`
- `atlas-client/src/hooks/useTeachingLoadRouteIntent.ts`
- `atlas-client/src/hooks/useAssignmentHistory.ts`
- `atlas-client/src/lib/teaching-load-helpers.ts`
- `atlas-client/src/lib/__tests__/teaching-load-ownership-integrity.test.ts` (new)
- `atlas-client/src/lib/__tests__/teaching-load-canonical-workload.test.ts`
- `atlas-client/src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts`
- faculty-assignment components: `SubjectRow`, `SectionGridMode`, `WorkloadInspector`, `WorkspaceToolbar`, `TeachingLoadModals`, `TeachingLoadRepairQueue`, `AutoFillSummaryModal`
- deleted: `AssignmentWorkspace.tsx`, `RosterSidebar.tsx`, `TeacherIdentityStrip.tsx`, `SubjectCoverageMode.tsx`, `StaffingAuditSheet.tsx`
- `qa-artifacts/playwright/specs/teaching-load-post-qa-remediation.spec.ts`, `playwright.config.ts`
- `CHANGELOG.md`, this ledger

## Decisive checks

- `atlas-client`: `npx tsc --noEmit` -> exit 0; `npm run build` -> exit 0.
- `npx tsx --test src/lib/__tests__/teaching-load-ownership-integrity.test.ts` -> 11/11 pass.
- `npx tsx --test src/lib/__tests__/teaching-load-canonical-workload.test.ts` -> 33/33 pass.
- `npx tsx --test src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts` -> 21/21 pass.
- `npm run test:ux-guardrails` -> exit 0. NOTE: the committed base `package.json` references test files that are not in the committed base; the referenced route-intent suite executed.
- Live Tailnet baseline: the deployed client has no `teaching-load-workspace` testid; shell heights `586/406/454/537/493/0`; the deployed client dispatched the known `POST /faculty-assignments/integrity/reconcile-split-brain` preview (recorded as the pre-fix defect; absent in the candidate).
- Candidate (Tailnet IP `http://100.88.55.125:5200`): workspace height `565/385/433/514/470/140`; share `0.89/0.85/0.86/0.88/0.87`; zero non-login writes; Subjects tab / Reconcile / staffing audit / Details absent.
- RED to GREEN: the new `transferExactSectionPair` no-exchange test fails against the old implicit `sectionIds[0]` give-back and passes against the helper; the HG guard fails against the old `SubjectRow` display-name match and passes after `9982ae17`.

## Live read-only signature (2026-09-11)

- BEFORE and AFTER identical: active school 1, year 9 (`2030-2031`), drift `aligned`, coverage `265/265`, faculty `42`, generation runs `0`, effective contract `v2` with `265` assignments.
- Disclosed permitted effects: admin login audit/`lastLoginAt` only. The deployed (pre-fix) page auto-dispatched the `previewOnly:true` split-brain preview; the candidate dispatches zero non-login writes.
- No Save/Apply/Reset/Reconcile/Suggest/generation/publication was dispatched by the executor.

## Remaining risks

- Pass E server-side advised-section suggestion priority was not implemented; only the client HG authority was corrected to canonical `code === 'HG'`.
- Multi-teacher save remains per-faculty atomic (serializable PUT) with an exact partial-commit receipt rather than a single server transaction across teachers.
- At `640x360` the content shell is only tens of pixels tall; the workspace holds a 140px local scroll region, so the acceptance is met by local scroll height rather than shell height.
- Playwright candidate floors (`minShare 0.45`, desktop `minHeight 240-260`) are weaker than the audit's 55% / 320px phrasing even though measured values exceed them.
- `atlas-client/src/lib/grade-labels.ts` still has a display-name homeroom match for department qualification (out of the changed range and outside the HG exemption authority).

## TL-UX-C01R correction (2026-09-11)

- Prompt: `docs/prompts/teaching-load-ux-allocation-correction-tluxc01r-2026-09-11.md` (authored in the term-live-migration-preview worktree).
- Entry candidate: `1f867eb82124c181c79cfcb9cf5227c4577efad3`.
- Correction outcome: one truthful suggestion preview that evaluates coverage AND distribution, returning structured `RETAIN`/`INSERT`/`MOVE` with separate counts; atomic all-or-nothing apply of the combined plan in one `Serializable` transaction with in-transaction ownership/capacity re-validation and typed `TEACHING_LOAD_PROPOSAL_STALE`; bounded adviser tie-break in the canonical over-cap plan builder; `AutoFillSummaryModal` no longer claims full capacity success from coverage alone.

### TL-UX-C01R changed paths
- `atlas-server/src/services/teaching-load-automation.service.ts` (distribution types + `summarizeDistributionPlan`, `buildTeachingLoadDistributionPlan`, `autoFill` wiring, adviser tie-break, warnings)
- `atlas-server/src/services/teaching-load-suggestion-proposal.service.ts` (atomic move apply in the reviewed proposal transaction)
- `atlas-server/src/__tests__/teaching-load-distribution-plan.test.ts` (new, 9 tests)
- `atlas-client/src/types.ts` (distribution types)
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx` (imbalance state, truthful balanced copy)
- `atlas-client/src/lib/__tests__/teaching-load-distribution-ui.test.ts` (new, 2 tests)
- `qa-artifacts/playwright/specs/teaching-load-post-qa-remediation.spec.ts` (intercepted-write distribution preview test)
- `CHANGELOG.md`, this ledger

### TL-UX-C01R evidence
- Server `tsc`/build exit 0; `teaching-load-distribution-plan.test.ts` 9/9. Client `tsc`/build exit 0; ownership-integrity 11/11, canonical-workload 33/33, route-intent 21/21, reconciliation-ui 5/5, distribution-ui 2/2, ux-guardrails 21/21. `teaching-load-write-authority.test.ts` exit 0.
- DB-backed route suites (`teaching-load-summary-zero-write-route`, `teaching-load-reconciliation-route`) fail closed with `DATABASE_URL is unavailable` in the isolated worktree; not run against live (no-mutation boundary).
- Isolated candidate `http://100.88.55.125:5211`: 3/3 Playwright tests pass; the intercepted-write distribution test asserts the imbalance surface, separate counts, one apply action, keyboard focus, and no global horizontal overflow at 1440x900, 390x844, and 320px reflow.
- Live read-only proof (`previewOnly=true`, `applied=false`): 7 above-standard donors at 37.5h, 14 exact moves, idle ESP/FIL receivers SALAZAR, SANTOS (Vincent), CASTILLO, DE LEON, AGUILAR. Post-proof signature identical: 265/265, 42 faculty, 0 runs, effective v2 with 265 assignments.

### Corrected C01 omissions
- `AutoFillSummaryModal` false capacity-success copy removed.
- Adviser-section preference implemented as a bounded tie-break (server canonical plan).
- Prior handoff changed-path count corrected to 26 (this correction adds paths on top).

### TL-UX-C01R review round 1 and correction
- Reviewer (task `ses_f72564205ffefM1UuuSO5I9hwp`) verdict: `CORRECTION_REQUIRED`.
  - BLOCKING F1: a bare catch (and a zero-sections evaluator race) defaulted to `balanced: true` with empty over-cap data.
  - BLOCKING F2: the move apply did not recompute `FacultySubject.gradeLevels` parity.
  - Non-blocking: receiver cap used the looser absolute cap; hard-cap count used teaching-only minutes; partial relief counted as resolved; applied plan was not compared against the reviewed plan; imbalance counts hidden during shortages; a missing distribution rendered the balanced copy.
- Correction commit: the additive commit immediately following `7bcaaae4` on this branch.
  - F1: added `distributionEvaluated`; `balanced` forced false when evaluation did not run; `sectionsResolved` distinguishes a genuine empty over-cap set.
  - F2: receiver/donor `gradeLevels` recomputed from resulting `sectionIds`.
  - F3/F4/F5/F6/F7/F8 addressed: standard-mode receiver cap, credited-minutes hard-cap count, full-relief donor accounting, reviewed-vs-refreshed plan comparison, shortage-branch distribution counts, and a neutral "balance not evaluated" state.
- Evidence: server distribution tests 12/12; client distribution-ui 2/2; both tsc/build green; full candidate Playwright 3/3 (read-only walk, design/height, intercepted-write distribution preview) at 1440x900, 390x844, 320px reflow.

### TL-UX-C01R remaining risks
- Move application re-validates donor ownership, receiver standard capacity, and grade parity inside the transaction; it does not independently recompute the full rotation-family capacity ledger for a receiver with many rotating subjects beyond the standard cap check.
- The distribution plan's counts are unit-verified; a DB-backed end-to-end apply test was not run because the isolated worktree has no test database.

## Reviewer role note

This ledger is executor-authored. Advisory review evidence is recorded above with execution-system task ids; it is evidence, not formal GO authority. The executor returns `REVIEW_REQUIRED`.
