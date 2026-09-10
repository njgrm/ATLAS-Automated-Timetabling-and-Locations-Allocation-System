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

## Reviewer role note

This ledger is executor-authored. Advisory review evidence is recorded above with execution-system task ids; it is evidence, not formal GO authority. The executor returns `REVIEW_REQUIRED`.
