# EVAL-C01 — Dashboard Lifecycle Truth and Evaluation Readiness — Progress Ledger

Plan source: user prompt EVAL-C01 (2026-09-08) + product-priority clarification + EVAL-C01R correction prompt (2026-09-08, same executor session).
Unique ledger per parallel boundary. Status: `REVIEW_REQUIRED` is the max terminal state; formal GO is out of scope.
`SOURCE_IMPLEMENTATION`: REVIEW. `LIVE_RUNTIME`: READY (read-only probes + disposable-sandbox HTTP proofs only; no shared-business mutation).
Time budget: 45 min per prompt. Final state: REVIEW_REQUIRED.

Ownership: EVAL-C01 edits ONLY
`atlas-server/src/services/dashboard-readiness.service.ts`,
`atlas-server/src/routes/dashboard.router.ts`,
`atlas-client/src/hooks/useDashboardData.ts`,
`atlas-client/src/pages/Dashboard.tsx`,
plus focused dashboard tests and this progress/review artifact.
`atlas-client/src/App.tsx` (other stream), Teaching Load, Curriculum Requirements implementation,
Timetable, scheduling policy, schema/migrations, auth, backup/recovery, companion repos: DO NOT TOUCH.
No git stage/commit/stash/reset/checkout. No port-5001 restart. No database writes. No live fixtures.
No generation or publication.

Product-priority note (2026-09-08): a genuine genetic algorithm and full offline mutation
support are NOT release blockers for this stream and are NOT implemented here. They are
recorded as documentation-alignment items only (see Decisions).

## Phase 0 — Preflight and diagnosis

- T0.1 Worktree preflight — DONE.
  - `git status --short`: dirty Teaching-Load stream files (faculty-assignments components,
    `useTeachingLoad*`, `faculty-*.ts`, `TeachingLoad.tsx`, `faculty-assignment` route/service,
    `scheduling-policy.service.ts`, `teaching-load-cycle.service.ts`, `types.ts`), dirty
    Curriculum/SCA stream files (`curriculum-requirements.router.ts`, `CurriculumRequirements.tsx`,
    decision-workspace artifacts, `App.tsx`), dirty Timetable stream files
    (`CenterWorkspace.tsx`, `ScheduleReviewWorkspace*`, `useTimetableData.ts`,
    `useTimetableMutations.ts`, `TimetableSimpleHeader.tsx`, `TimetableTaskDrawer.tsx`,
    `useScheduleReviewWorkspaceState.ts`, `buildScheduleReviewWorkspaceContexts.ts`,
    `timetableSchoolScope.ts`), untracked `decision-workspace/`, `DecisionWorkspace.tsx`,
    `curriculum-decision-candidates.service.ts`, `department-authority.service.ts`,
    `capstonePaperchapt1-424.pdf`, `letter-for-facebook-page.docx`, `tmp/`. EVAL-C01 touches none.
  - Allowed-file hashes (pre-edit, SHA-256 via Get-FileHash): recorded at probe time
    (service `836A088F…`, router `2E68F90D…`, hook `8255F363…`, page `CFAA6518…` — full values
    in tool output; re-hashed post-edit in verification).
  - Processes: `Get-Process node` output was empty in this shell; TT-C01 ledger (same live
    runtime) records ATLAS server PID 37132 on port 5001 and Vite on 5174. No restart attempted.
- T0.2 Live Tailnet read-only diagnosis — DONE (admin `1234501`, token schoolId=1, all GET).
  - `GET /api/v1/auth/me` → officer, schoolId 1.
  - `GET /api/v1/runtime/context?schoolId=1` → active year 8 / 2029-2030, `atlas-persisted`,
    stale=true, drift aligned.
  - `GET /api/v1/dashboard/readiness-summary?schoolId=1` → lifecyclePhase SETUP, generation
    NONE / isPublished false, subjects 22 (1 unassigned), faculty 42, sections 20, campus done.
    Truthful — NOT published.
  - `GET /api/v1/generation/1/8/runs/latest` → 404 NO_RUNS.
  - `GET /api/v1/schools/1/schedules/published` → 404 CURRENT_PUBLISHED_RUN_NOT_FOUND (year 8).
  - `GET /api/v1/schools/1/school-years/8/schedules/published` → 404 PUBLISHED_RUN_NOT_FOUND.
  - `GET /api/v1/curriculum-requirements/8/readiness` → ready false, termConfigPresent false,
    requirementCount 0, blocker OFFERING_TERM_CONFIG_MISSING.
  - Root-cause verdict: live backend truth is coherent (SETUP / no-run / unpublished /
    curriculum-blocked). The false "Schedule is published" risk lives in dashboard-owned
    decision code, not in live data: (a) server `readPublished()` treats ANY summary with
    `publishedAt` string or `publishedBy` number as published, even on FAILED runs with stale
    markers; (b) server publication check reads only the latest row (any status) instead of
    resolving a COMPLETED published run for the exact active year; (c) an explicit
    `schoolYearId` query override can substitute a historical year (e.g. year 7 keeps published
    run 425) for current-year truth; (d) router defaults `schoolId ?? 1` and the client
    hardcodes `DEFAULT_SCHOOL_ID = 1`, so cross-school scope is never rejected; (e) the client
    runs two competing pipelines (readiness-summary + legacy waterfall) with separate lifecycle
    derivations, and the checklist marks "Ready to publish" done for REVIEW + zero violations,
    conflating review-complete with published-visible. No stale build involved: the live
    readiness payload itself is truthful; the guards around it are loose.
  - Collision check: TL-C01 owns Teaching-Load surfaces; SCA-03E owns curriculum routes/page;
    TT-C01 owns Timetable hooks/components (incl. `useTimetableCollaboration.ts`,
    `timetableSchoolScope.ts`, `CampusReadinessCard.tsx` hardcoded school-1 paths — noted as
    residual cross-school scope outside this boundary). EVAL-C01 does not edit any of them.

## Phase 1 — Server: publication guard + actor scope + curriculum blocker

- T1.1 `dashboard-readiness.service.ts` (MEDIUM) — DONE.
  - `isStrictlyPublishedRun()`: `isPublished === true` AND COMPLETED status only.
    FAILED-row stale markers (`publishedAt`/`publishedBy`) never publish.
  - `resolvePublicationFromCandidates()`: bounded newest-first COMPLETED scan
    (`take: 10`, id/status/summary columns only — no draftEntries/violations
    payloads, never every historical run) for the exact (school, active year).
  - `resolveDashboardScope()`: actor school only, no school-1 fallback; shared
    with the route handler (real route decision path).
  - `resolveDashboardActiveYear()`: runtime context wins; explicit
    `schoolYearId` is fallback-only.
  - `resolveDashboardLifecycle()`: degraded suppresses publication; missing
    curriculum holds SETUP; else setup/run-status truth. Legacy
    `lifecyclePhase()` retained as a thin wrapper (unchanged behavior).
  - `evaluateCurriculumReadiness` consumed (existing read contract, zero
    Curriculum Requirements edits); exposed as compact `curriculum` +
    `sources.curriculum`. Any dependency failure → `partial_degraded`,
    `isPublished=false`, lifecycle never PUBLISHED.
  - Additive response fields only (`curriculum`, `sources.curriculum`,
    `generation.publishedRunId`): old readers ignore them.
- T1.2 `dashboard.router.ts` (MEDIUM) — DONE.
  - Actor school from `req.user.schoolId`; 403 SCHOOL_SCOPE_REQUIRED when
    unresolved; 403 SCHOOL_SCOPE_MISMATCH on cross-school query; `?? 1`
    default removed. Transport-only; guards shared with the service.

## Phase 2 — Client: actor scope + single coherent snapshot

- T2.1 `useDashboardData.ts` (MEDIUM) — DONE.
  - `resolveDashboardRequestScope()` (same fail-closed shape as Subjects
    SCA-01.1): unresolved actor → zero domain requests, bounded blocked state.
  - `initialDashboardDomainState()`: every school-scoped value cleared on
    actor change (`boundActorRef` rebind) — no stale run/publication/year.
  - Summary + legacy fallback both send the actor school; 403 stops all
    further requests (never falls through to another school).
  - Legacy year-context mismatch refreshes once then blocks (Curriculum
    Requirements SCA-02R pattern); coverage read re-scoped to the actor via a
    direct endpoint call (TL-owned `coverage.ts` untouched);
    `/curriculum-requirements/:year/readiness` consumed in both paths;
    degraded never published; local fallback lifecycle never PUBLISHED.
  - New return fields: `actorSchoolId`, `actorScopeResolved`,
    `actorScopeBlocked`, `curriculum`, `retryActorScope`.
- T2.2 `Dashboard.tsx` (LOW) — DONE.
  - `pickNextStep` exported (tests) + `curriculumMissing`/`degraded` branches:
    degraded → "Check the connection"; SETUP + curriculum missing → "Set up
    Curriculum Requirements" → `/subjects/requirements` (first, plain
    language, one action).
  - Checklist (one snapshot): added "Curriculum Requirements ready" repair
    row; "Ready to publish" renamed "Schedule published", done ONLY when
    PUBLISHED (REVIEW + zero violations no longer conflates).
  - Bounded actor-blocked card with recovery copy + keyboard-accessible retry;
    no new overflow vectors (standard Card/p-6, existing row patterns).

## Phase 3 — Verification (focused gates only)

- T3.1 New lifecycle/service tests — DONE: server
  `atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts` 12/12 PASS
  (`npx tsx src/__tests__/dashboard-lifecycle-truth.test.ts`); covers all 9
  required negative controls incl. a guard-bypass sensitivity detector (FAILED
  row with stale markers: loose rule WOULD publish, strict guard does not —
  reverting the guard fails the suite).
- T3.2 Existing dashboard readiness tests — N/A (none pre-exist: no dashboard
  file under `atlas-server/src/__tests__`, no `test:*dashboard*` script).
- T3.3 Client hook/decision tests — DONE:
  `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts` 7/7
  PASS (`npx tsx --test ...`); scope gating, cleared state, curriculum repair,
  degraded recheck, published/review next actions. (One executor-side fix
  during the run: duplicated `if (phase === 'SETUP')` nesting + `assert.match`
  API name; both corrected, suite green after.)
- T3.4 Static gates — DONE: server `tsc --noEmit` exit 0; client `tsc --noEmit`
  exit 0; client `vite build` exit 0 (2.25s); `git diff --check` exit 0
  (LF/CRLF notices are pre-existing worktree-wide, not errors).
- T3.5 Desktop + 390px browser check — STATIC ONLY (no Playwright in this
  environment; shared live runtime frozen by parallel uncommitted streams, and
  port-5001 restart is prohibited). New blocked card uses standard Card/p-6
  with wrapping text; checklist row reuses the existing responsive pattern
  (icons + min-w-0 + `hidden sm:block` progressive disclosure for rows ≥3);
  next-step CTA unchanged; all interactive elements are native Link/Button
  (keyboard-focusable, visible focus rings preserved). Live Tailnet browser
  matrix deferred to QA.

## Before/after lifecycle matrix (live year-8 truth: SETUP, zero runs, unpublished, curriculum blocked)

| Scenario | Before | After |
|---|---|---|
| No run + no revision (live) | SETUP, unpublished (truthful payload, but no curriculum signal) | SETUP, unpublished, curriculum blocker + `/subjects/requirements` repair |
| Historical published only (year-7 run 425) | Explicit `schoolYearId=7` could stand in for current-year truth | Never current-year PUBLISHED (runtime active year wins) |
| Other-school published run | Any `schoolId` accepted; client/server default school 1 | 403 SCHOOL_SCOPE_MISMATCH; actor school only |
| Completed but unpublished | REVIEW, but checklist marked "Ready to publish" done | REVIEW; "Schedule published" done only when PUBLISHED |
| Active-year published | PUBLISHED via loose flag (stale markers counted) | PUBLISHED only via COMPLETED + `isPublished===true` in exact school/year |
| FAILED run + stale markers | Loose rule reads PUBLISHED | Never PUBLISHED (sensitivity-tested) |
| Curriculum missing | Invisible on Dashboard | SETUP blocker, first next-action, checklist repair row |
| Dependency failure | `partial_degraded` overall, yet lifecycle could still read PUBLISHED | Degraded forces `isPublished=false`, never PUBLISHED |
| Unresolved actor school | School-1 requests fired anyway | Zero domain requests + bounded blocked card + retry |

## EVAL-C01R — Active-year and publication authority closure (2026-09-08, same session)

### Authorized source
- `atlas-server/src/services/dashboard-readiness.service.ts`
- `atlas-server/src/routes/dashboard.router.ts`
- `atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts`
- new `atlas-server/src/__tests__/dashboard-http-authority.test.ts`
- this progress + review artifacts.
No TT/TL/SCA file touched. No port restart, no generation/publication, no shared-business mutation.

### Corrections applied
- R1 (active-year authority): `resolveDashboardActiveYear` now takes runtime active year ONLY — the
  requested `schoolYearId` fallback was removed. When runtime is missing/degraded the Dashboard has
  NO current year; a requested historical/mismatched year can never become current truth. No default
  year or school is introduced.
- R1 (router): a requested `schoolYearId` is validated (typed 400 when malformed) but is deliberately
  NOT forwarded to the service. Runtime is the sole authority.
- R2 (publication authority): the arbitrary ten-run `take` window is removed. Publication resolves a
  COMPLETED run with `summary.isPublished === true` for the exact (actor school, runtime active year)
  via `buildDashboardPublicationWhere` whose predicate is pushed into the SQL WHERE. Deterministic
  newest-published selection via `orderBy createdAt desc` + `findFirst`. Select is minimal
  (id/status/summary/createdAt) — draftEntries/violations/unassignedItems are never loaded. FAILED
  stale-marker rows never match (status filter + strict predicate).

### HTTP integration (new: `dashboard-http-authority.test.ts`) — 31/31 PASS
Runs the MOUNTED `/api/v1/dashboard` route through real `authenticateWithSystemToken` +
`requirePrivilegedRole` middleware with JWT-signed officers, using disposable sandbox SCHOOL ids
(repo-sanctioned hermetic pattern) and full `finally` cleanup with zero-residue assertions.
- unresolved actor → 403 SCHOOL_SCOPE_REQUIRED (zero domain reads)
- cross-school query → 403 SCHOOL_SCOPE_MISMATCH (+ `/summary` alias)
- malformed school/year → typed 400 INVALID_PARAM
- active year from runtime = 2002; published lifecycle PUBLISHED
- published run OUTSIDE the former 10-row window is still found (oldest of 12 completed; a
  newest-10 in-memory scan would miss it) — `publishedRunId === oldest.id`
- newest run is a FAILED stale-marker row; its markers do NOT drive publication
  (`publishedRunId !== failed.id`, `latestRunStatus === 'FAILED'`)
- mismatched requested year (2001) cannot shift active year or publication scope
- zero-evidence school (runtime unavailable) + requested year 9 → activeSchoolYearId null, never
  published, lifecycle not PUBLISHED
- heavy payloads (draftEntries/violations/unassignedItems arrays on every run) present still resolve
  correctly (publication path never depends on them)
- cleanup: 0 generation-run / 0 mirror / 0 school residue.

### Hermetic server suite (`dashboard-lifecycle-truth.test.ts`) — 10/10 PASS
Strict predicate, DB-pushed WHERE builder (no take), runtime-only active-year authority, lifecycle
fail-closed, scope guards, guard-bypass detector, and source-scoped query-shape assertion that the
publication read selects no draftEntries/violations/unassignedItems and has no numeric `take`.

### Client suite — 7/7 PASS (unchanged this round; `useDashboardData`/`Dashboard.tsx` from EVAL-C01)

### Static gates
- server `tsc --noEmit` 0; client `tsc --noEmit` 0; server `npm run build` 0; client `npm run build` 0;
  `git diff --check` 0 (LF/CRLF notices pre-existing).
- Post-edit hashes: service `DF498871…`, router `5C890898…`, server-test `4E5B555A…`,
  http-test `D43FED71…` (full values in probe output).

### Decisions
- The `$on('query')` runtime capture did not emit on this Prisma client; query-shape evidence is
  instead provided by the source-scoped assertion (same class as the repo's ux-guardrails suite) plus
  the functional heavy-payload proof. Labelled as static + functional evidence, not a raw SQL log.
- The HTTP integration uses disposable high-ID sandbox schools with full cleanup + zero-residue
  assertions (repo governance: "disposable sandbox schools, never school 1"). No real business rows
  touched.
- Genetic algorithm / full offline mutation remain documentation-alignment items (product priority).

### EVAL-C01R review log
| Boundary | Reviewer context | Status |
|---|---|---|
| EVAL-C01R changed scope | fresh advisory subagent (`ses_f7ea8a05effeBPcoC7do1qGq1m`) | GO, zeroFix=true (advisory only). Artifact: `docs/reviews/eval-dashboard-lifecycle-truth-2026-09-08/advisory-review-c01r-01.md`. 0 material findings (0 product/runtime, 0 safety-gate, 0 process/docs); 4 informational, no fixes. Fresh gate reruns: server 10/10, HTTP 31/31, client 7/7, server tsc 0, client tsc 0, diff-check 0. No repeat of a zero-finding review. |
| Reviewer identity caveat (EVAL-C01R1 correction) | The advisory artifact states no verifiable orchestrator-issued reviewer ID was available. Its technical findings are preserved as advisory evidence ONLY; verified identity is NOT claimed. This is not formal review authority and does not unlock successors or authorize any HIGH-risk action. |

## EVAL-C01R1 — Narrow correction (2026-09-08, same session)

Narrow scope only; no broadening.

### Changes
- `dashboard-readiness.service.ts`: added deterministic secondary `{ id: 'desc' }` ordering to BOTH
  generation-run selections — the latest active-year generation-run `findFirst` and the newest
  active-year published-run `findFirst` (`orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`). The
  SQL-pushed exact school/year/COMPLETED/isPublished predicate and minimal publication select
  (id/status/summary/createdAt) are preserved.
- `dashboard-http-authority.test.ts`: added equal-createdAt tie coverage (new disposable sandbox
  SAND_TIE=7799003, year 3003, rows i1<i2<i3 same timestamp) proving the higher-id row wins for
  latest-run (i3, FAILED) and for publishedRunId (i2), plus that the FAILED tie row does not drive
  publication. Cleanup extended to SAND_TIE with zero-residue assertions.
- `dashboard-lifecycle-truth.test.ts`: added a deterministic failing-first source guard requiring
  the secondary id-desc ordering on BOTH generation-run selections.

### RED→GREEN evidence
- RED: reverting both `orderBy` to single `{ createdAt: 'desc' }` made the hermetic suite fail
  10/11 — the failing-first source guard failed (the engine's tie order alone is not trustworthy).
- GREEN (restored): hermetic 11/11, HTTP 38/38. The runtime tie test also passes with the fix,
  proving higher-id wins on equal createdAt for both latest-run and publishedRunId.

### Gate rerun (EVAL-C01R1, focused only)
- server hermetic 11/11; HTTP authority 38/38; client lifecycle 7/7; server tsc 0; client tsc 0;
  server build 0; `git diff --check` 0.

### File hashes (recorded 2026-09-08, Get-FileHash)
- `atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts`: `2B536CFBC789F7AB2E84F7FEBEBD35DA15596C3…`
- `atlas-server/src/__tests__/dashboard-http-authority.test.ts`: `29C9FBE36CA4AD351BF725F124FCE8B1A7B0B6B…`
- `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts`: `7FDFE87B5B6C560B6B292A65F5CF518A42881BE…`
- `docs/progress/eval-dashboard-lifecycle-truth-2026-09-08-progress.md`: `0FBED30A85806811280AD22064D6226F67BD21A…`
(Full values in probe output. Hash may change if any of these files is edited later; re-hash before staging.)

### Exact future git add -f command (stage ONLY these four; do not stage unrelated files)
```
git add -f atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts atlas-server/src/__tests__/dashboard-http-authority.test.ts atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts docs/progress/eval-dashboard-lifecycle-truth-2026-09-08-progress.md
```

### Reviewer provenance correction
Both advisory artifacts reported no verifiable orchestrator-issued reviewer ID. Their technical
findings are preserved as advisory evidence only; verified identity is NOT claimed and they confer
no formal review authority and do not unlock successors.

## Task review log (EVAL-C01)| Boundary | Reviewer context | Status | Notes |
|---|---|---|---|
| EVAL-C01 prompt batch | fresh advisory subagent (`ses_f7f0d54b2ffen02Q1ZcqoxR7v7`) | GO, zeroFix=true (advisory only) | Artifact: `docs/reviews/eval-dashboard-lifecycle-truth-2026-09-08/advisory-review-01.md` (reviewer-authored). 0 material findings (0 product/runtime, 0 safety-gate, 0 process/docs); 3 informational observations, no fixes required. 31/31 independent adversarial probes PASS (FAILED+stale markers, historical/other-school, year-override, degraded+published, scope mismatches, zero-dispatch, actor rebind, fallback-never-PUBLISHED, checklist de-conflation). Gates re-verified green; forbidden-touch audit clean. Per prompt rule, no repeat of this zero-finding review. IDENTITY CAVEAT (EVAL-C01R1): advisory evidence only; no verifiable orchestrator-issued reviewer ID was available, so verified identity is not claimed. |

## Verification evidence

- Live read-only probes: 7/7 truthful (auth/me, runtime context, readiness-summary, latest run
  404, published 404 x2, curriculum readiness blocked). Timestamps 2026-09-08T12:01–12:02Z.
- Focused gates: server test 12/12; client test 7/7; server tsc 0; client tsc 0;
  client build 0; diff-check 0. Post-edit SHA-256: service `17571351…`, router
  `B487031E…`, hook `FCA07EB8…`, page `5988E240…`, server test `431D21B6…`,
  client test `7FDFE87B…` (full values in probe output).
- Changed production files: exactly the 4 allowed (diffstat +529/−67).
  `App.tsx` and all TL/SCA/timetable files untouched by EVAL-C01; unrelated
  dirty-worktree changes preserved; nothing staged or committed; no DB writes;
  no port-5001 restart; no generation/publication.

## Decisions and risks

- Genetic algorithm + full offline mutation: documentation-alignment items only, not implemented
  (product-priority clarification). Dashboard copy keeps "algorithm run" helper wording out of
  any GA-specific claim; no offline-mutation behavior is added or implied.
- `coverage.ts` / `enrollpro-public-settings.ts` / `CampusReadinessCard.tsx` hardcoded school-1
  paths belong to TL/timetable streams; EVAL-C01 works around them inside allowed files only.
- Capstone pages 9, 11–14, 90–92 were not re-read in-session (large PDF, time-boxed stream);
  lifecycle phase order (Setup → Preference Collection → Generation → Review → Published,
  Archived terminal) is taken from AGENTS.md project knowledge and matches live API truth.
- Remaining risk: evaluator may still hold a stale client bundle; server now fails closed so a
  stale bundle cannot receive PUBLISHED for year 8, but its copy may still read optimistically.
