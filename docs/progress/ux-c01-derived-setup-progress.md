# UX-C01 — Derived Setup Operator UX Progress Ledger

- Authoritative prompt: `docs/prompts/derived-setup-ux-one-shot-uxc01-2026-09-11.md`
- Worktree: `D:/ATLAS-worktrees/ux-c01-derived-setup`
- Branch: `work/ux-c01-derived-setup`
- Base SHA: `89440321260a9c4902cc20b7c5a642f47a74e35f` (`origin/main`, includes DEMAND-C01)
- Risk tier: MEDIUM UI/source with HIGH-risk interaction guardrails (no HIGH mutation performed)

## Objective

Remove the superseded annual Curriculum Requirements / Decision Workspace
surfaces from the routine operator journey and make Dashboard and Timetable
readiness consume the canonical derived-demand authority with the smallest true
repair per blocked state.

## Task status

| Task | Status | Evidence |
|---|---|---|
| Server: dashboard readiness consumes `buildDerivedDemand`; typed `derivedDemand` domain | DONE | `dashboard-readiness.service.ts`; `uxc01-derived-setup-readiness.test.ts` 6/6 |
| Server: read-only `derived-demand` readiness route | DONE | `derived-demand.router.ts`, mounted in `app.ts`; `tsc` + built-server health probe 200 |
| Server: `evaluateCurriculumReadiness` removed from dashboard path | DONE | source-scan assertion in `uxc01-derived-setup-readiness.test.ts` |
| Client: Dashboard derived-demand checklist/next-step repairs | DONE | `Dashboard.tsx`, `useDashboardData.ts`; `dashboard-lifecycle-truth.test.ts` 13/13 |
| Client: Timetable readiness consumes derived-demand endpoint | DONE | `useTimetableData.ts` `fetchCurriculumReadiness` |
| Client: Subjects setup surface + read-only EnrollPro year/terms + context notice | DONE | `Subjects.tsx` |
| Client: legacy redirects + retired page/component deletion | DONE | `App.tsx`; `uxc01-derived-setup-surface.test.ts` 4/4 |
| Client: operator copy de-legacied in insertion workflow/tutorial/helpers | DONE | `UnassignedInsertionWorkflow.tsx`, `SimpleHeaderHelpers.tsx`, `timetable-ttc02-insertion.ts` |
| Docs: runtime source map, CHANGELOG, handoff | DONE | this ledger, CHANGELOG entry, `docs/handoffs/ux-c01-derived-setup-executor.md` |
| Live Tailnet browser QA | NOT RUN (isolated) | No deploy of accepted source; isolated client build used instead |
| DB-backed dashboard integration suites | NOT RUN | No `DATABASE_URL` in the isolated worktree and no-live-writes constraint |

## Decisive checks run

- `atlas-server`: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- `atlas-server`: `npm run build` → exit 0.
- `atlas-server`: built server started on an isolated port with a dummy DSN →
  `GET /api/v1/health` `200 {"status":"ok","service":"atlas"}`, process stayed alive.
- `atlas-server`: `uxc01-derived-setup-readiness.test.ts` 6/6;
  `dashboard-lifecycle-truth.test.ts` 11/11.
- `atlas-client`: `npx tsc --noEmit` → 0 errors.
- `atlas-client`: `npm run build` → built in ~4s.
- `atlas-client`: `test:derived-setup-ux` 17/17; `test:timetable-operator-ux` 58/58;
  `test:ux-guardrails` 21/21; `curriculum-scope-states` + `decision-draft` 2/2.

## Remaining risks

- Live Tailnet browser QA (1280x720 and 390x844) is pending because accepted
  source is not deployed; client proof is isolated-build only.
- The DB-backed `dashboard-http-authority` / `dashboard-stale-readiness`
  integration suites were not executed here; their hermetic aggregates were not
  affected by the field rename (no `curriculum` assertions remain).
- Internal timetable client identifiers still read `curriculumReadiness`; this is
  non-operator-facing and left for a later cosmetic rename.

## Zero-live-mutation statement

No live writes, generation, publication, migration, deploy, or port-5001 restart
was performed. The built server probe used an isolated port and a non-routable
dummy `DATABASE_URL`.
