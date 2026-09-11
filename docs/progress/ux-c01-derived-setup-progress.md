# UX-C01 â€” Derived Setup Operator UX Progress Ledger

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

- `atlas-server`: `npx tsc --noEmit -p tsconfig.json` â†’ 0 errors.
- `atlas-server`: `npm run build` â†’ exit 0.
- `atlas-server`: built server started on an isolated port with a dummy DSN â†’
  `GET /api/v1/health` `200 {"status":"ok","service":"atlas"}`, process stayed alive.
- `atlas-server`: `uxc01-derived-setup-readiness.test.ts` 6/6;
  `dashboard-lifecycle-truth.test.ts` 11/11.
- `atlas-client`: `npx tsc --noEmit` â†’ 0 errors.
- `atlas-client`: `npm run build` â†’ built in ~4s.
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

---

# UX-C01R â€” Generation Readiness and Formal QA Closure

- Authoritative correction packet:
  `docs/prompts/derived-setup-ux-uxc01r-generation-readiness-closure-2026-09-11.md`
  (committed at `0215b24a`, `docs/ux-c01r`).
- Worktree/branch: `D:/ATLAS-worktrees/ux-c01-derived-setup` on
  `work/ux-c01-derived-setup`.
- Prior candidate: `91d327e34d28f8a1c02ee41391b9323c89ed4362` (clean).
- Original base: `89440321260a9c4902cc20b7c5a642f47a74e35f`.
- Risk tier: MEDIUM source/UI with HIGH-risk interaction guardrails (no HIGH
  mutation performed).
- Dependency: this candidate is DEPENDENT on the GEN-C02R1 generation-readiness
  contract (`GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic`,
  owned by `work/generation-genc02r1`); combined acceptance waits for both.

## Objective

Make the operator see one honest final readiness decision that includes Teaching
Load ownership, canonical shape, policy, and validator blockers before any
generation action appears; stop the Dashboard from overclaiming final readiness;
and complete the missing formal production-path proof.

## Task status

| Task | Status | Evidence |
|---|---|---|
| Finding 1: Timetable gate consumes the generation diagnostic, not raw derived-ready | DONE | `timetable-generation-readiness.ts`; `useTimetableData.ts` `fetchCurriculumReadiness`; `uxc01r-generation-readiness.test.ts` |
| Finding 1: full diagnostic retained; scope-change invalidation; request-seq guard | DONE | adapter keeps revisions/blockers/totals/TL coverage/zero-write; hook resets on school/year change |
| Finding 1: generation enabled only on allow+zero-write+scheduler+zero block | DONE | `timetable-capabilities.ts` `generationDiagnostic` gate; adapter `ready` contract |
| Finding 2: Dashboard input-milestone copy + `Check generation readiness` | DONE | `Dashboard.tsx` `pickNextStep` PREFERENCES; checklist relabel; `dashboard-lifecycle-truth.test.ts` |
| Finding 2: TL language distinguishes coverage from exact ownership | DONE | checklist hints reference exact ownership being confirmed on the Timetable |
| Finding 3: mounted read-only route test (auth/scope/param/zero-write) | DONE | `uxc01r-derived-demand-route.test.ts` (4 hermetic + 1 disposable PostgreSQL) |
| Finding 3: diagnostic controls every visible generation trigger | DONE | capability behavior tests + header wiring source guards |
| Browser verification (ready diagnostic) | BLOCKED_EXTERNAL | Requires the GEN-C02R1-mounted diagnostic on a matched isolated candidate server; deferred to combined integration. Isolated preview could not authenticate against the shared undeployed server (fail-closed compatibility only). |
| DB-backed dashboard resilience suites | NOT RUN | They seed/clean the live development DB directly; the no-live-write constraint forbids running them here (unset `DATABASE_URL`) |

## Decisive checks run

- `atlas-client`: `npx tsc --noEmit` â†’ 0 errors.
- `atlas-client`: `npm run build` â†’ built OK (~16s).
- `atlas-client`: `test:uxc01r` 36/36; `test:timetable-operator-ux` 58/58;
  `test:ux-guardrails` 21/21.
- `atlas-server`: `npx tsc --noEmit` â†’ 0 errors.
- `atlas-server`: `npm run build` â†’ exit 0.
- `atlas-server`: built server started on isolated port 5099 with a non-routable
  dummy DSN â†’ `/api/v1/health` `200 {"status":"ok","service":"atlas"}`;
  `/api/v1/derived-demand/1/8/readiness` â†’ `401` (route mounted, auth enforced).
- `atlas-server`: `test:derived-setup-readiness` 6/6;
  `dashboard-lifecycle-truth` 11/11.
- `atlas-server`: `uxc01r-derived-demand-route` 5/5 including the disposable
  PostgreSQL zero-write proof with rolled-back positive control and zero residue.

## Remaining risks

- The positive ready-diagnostic browser matrix is not captured in this candidate;
  it depends on the GEN-C02R1 server contract. Negative/fail-closed behavior is
  proven hermetically and by the disposable-DB route proof.
- The DB-backed dashboard resilience/authority suites were not executed here.

## Zero-live-mutation statement

No live writes, generation, publication, Teaching Load apply, deploy, shared-
runtime restart, or port-5001 swap was performed. The disposable PostgreSQL test
created and dropped only a guarded `atlas_restore_drill_*` database. Temporary
`node_modules` junctions and the isolated Vite preview (port 5299) were removed.
