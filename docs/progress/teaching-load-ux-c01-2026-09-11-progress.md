# TL-UX-C01 Teaching Load Workspace — Progress Ledger

- Plan: `docs/prompts/teaching-load-ux-one-shot-tluxc01-2026-09-11.md`
- Worktree: `D:/ATLAS-worktrees/teaching-load-ux-c01`
- Branch: `work/teaching-load-ux-c01`
- Base SHA: `36c5d3d1735728c1870f5e0ccfe36ca54a8a6b5d` (refreshed `origin/main`)
- Risk: MEDIUM source/UI with HIGH interaction guardrails; no live mutation authorized.

## Status

| Task | Status | Evidence |
|---|---|---|
| Pass A preflight + inventory | DONE | base clean; client tsc green at base |
| Pass B remove split authority + scope binding | DONE | split-brain POST/state removed; reconnect/global-reset/staffing-audit/jump-list removed; `scopeKey` + `resetForScope` added |
| Pass C rebuild operator workspace | DONE | master-detail kept; compact single next-step queue; Subjects mode collapsed into Sections; over-cap chip filters teachers |
| Pass D mutation integrity | DONE (bounded) | exact-pair transfer helper; per-faculty atomic serializable PUT + exact partial-commit receipt |
| Pass E Homeroom/adviser | DONE (client) | canonical `code === 'HG'` only in touched hooks; server adviser-suggestion priority NOT changed (deferred risk) |
| Pass F browser QA | DONE | live Tailnet baseline + isolated candidate matrix (Tailnet IP) |
| Pass G independent review | REVIEW_REQUIRED | advisory reviewer on committed range; see role note below |

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
- faculty-assignment components (SubjectRow, SectionGridMode, WorkloadInspector, WorkspaceToolbar, TeachingLoadModals, TeachingLoadRepairQueue, AutoFillSummaryModal)
- deleted: `AssignmentWorkspace.tsx`, `RosterSidebar.tsx`, `TeacherIdentityStrip.tsx`, `SubjectCoverageMode.tsx`, `StaffingAuditSheet.tsx`
- `qa-artifacts/playwright/specs/teaching-load-post-qa-remediation.spec.ts`, `playwright.config.ts`

## Decisive checks

- `atlas-client`: `npx tsc --noEmit` → exit 0; `npm run build` → exit 0.
- `npx tsx --test src/lib/__tests__/teaching-load-ownership-integrity.test.ts` → 11/11 pass.
- `npx tsx --test src/lib/__tests__/teaching-load-canonical-workload.test.ts` → 33/33 pass.
- `npx tsx --test src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts` → 21/21 pass.
- `npm run test:ux-guardrails` → exit 0 (note: base package.json references test files not in the committed base; the referenced route-intent suite ran).
- Live Tailnet baseline: workspace testid absent on the deployed client; shell heights `586/406/454/537/493/0`; the deployed client dispatched the known `POST /faculty-assignments/integrity/reconcile-split-brain` preview (recorded as the pre-fix defect; the submission is blocked/removed in the candidate).
- Candidate (Tailnet IP `http://100.88.55.125:5200`): workspace height `565/385/433/514/470/140`; share `0.89/0.85/0.86/0.88/0.87` desktop→mobile; zero non-login writes; Subjects tab / Reconcile / staffing audit / Details absent.

## Live read-only signature (2026-09-11)

- Active school 1, year 9 (`2030-2031`), drift `aligned`.
- Coverage `265/265`, faculty `42`, generation runs `0`, effective contract `v2` with `265` assignments.
- No Save/Apply/Reset/Reconcile/Suggest/generation/publication was dispatched by the executor.

## Remaining risks

- Pass E server-side advised-section suggestion priority was not implemented in this stream; the client HG heuristic was corrected to canonical `code === 'HG'`.
- Multi-teacher save remains per-faculty atomic (serializable PUT) with an exact partial-commit receipt rather than a single server transaction across teachers.
- At `640x360` the content shell is only ~32px tall; the workspace holds a 140px local scroll region (acceptance is met by local scroll height, not by shell height).

## Reviewer role note

This ledger is executor-authored. The independent advisory review is recorded separately under `docs/reviews/teaching-load-ux-c01-2026-09-11/`.
