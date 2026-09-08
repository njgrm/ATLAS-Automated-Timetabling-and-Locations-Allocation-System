# EVAL-C01 Advisory Review 01 — Dashboard Lifecycle Truth (fresh, adversarial)

- Reviewer context handle: fresh advisory reviewer, independent session spawned for
  EVAL-C01 prompt review. This reviewer did NOT implement the work; all checks below
  were derived from the requirements and executed independently against the real code
  paths. Executor test suites were rerun, but the verdict rests on independent
  adversarial probes, full-file reads, and code-path traces — not on reruns alone.
- Review date (UTC): 2026-09-08.
- Verdict (advisory only): **GO, zeroFix=true.** The owning prompt caps the terminal
  state at REVIEW_REQUIRED; this verdict is advisory and does not constitute formal GO.
- Material findings: **0** (0 product/runtime defects, 0 safety-gate defects,
  0 process/docs inconsistencies requiring fixes). 3 informational observations, no
  required fixes.

## Reviewed scope and diff identity

Changed scope claimed by the ledger (all six files read fully, not just the diff):

| File | SHA-256 (post-edit, reviewer-hashed) |
|---|---|
| `atlas-server/src/services/dashboard-readiness.service.ts` | `17571351CEECCA8F005F2490438DB19AA95430A4F46EBBDA655C44439CB89C44` |
| `atlas-server/src/routes/dashboard.router.ts` | `B487031EDE355FA71C4641BBF439983B4DE2F4FA98B43FB02B943B65C1A7994C` |
| `atlas-client/src/hooks/useDashboardData.ts` | `FCA07EB896D6A0AF858339218BC3C953EBB0A74B3B803110B0A1B27BF0F3A45E` |
| `atlas-client/src/pages/Dashboard.tsx` | `5988E2407A7BD4BC13D0F14C8B23D21DA36AD5F7F64BBD1910248128385085CE` |
| `atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts` (git-ignored, local-only) | `431D21B61AB9FB452CBA443AE77E89134F8785FBEF05C15F2302E40FE9F9AC4E` |
| `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts` (git-ignored, local-only) | `7FDFE87B5B6C560B6B292A65F5CF518A42881BEECF707F650B91D9D739C583F4` |

Hash prefixes match the ledger's recorded post-edit values. EVAL-C01 production
diffstat (from `git diff`): 4 files, +529/−67 equivalent scope per ledger (service,
router, hook, page). The two test files are git-ignored (`**/__tests__/`,
`*.test.*` in `.gitignore`) so they do not appear in `git status`; they were
verified present on disk and hashed above.

Forbidden-touch verification (`git status --short`, `git diff --stat`, `git diff --name-only`):
- `atlas-client/src/App.tsx` IS dirty, but its diff is exclusively the
  `DecisionWorkspace` lazy route (`subjects/decision-workspace`) — another stream's
  work, correctly attributed, not EVAL-C01.
- `atlas-server/src/routes/curriculum-requirements.router.ts` IS dirty, but its
  diff is exclusively the SCA-03E `decision-candidates` read-only route — another
  stream, not EVAL-C01. The Curriculum Requirements **implementation** is consumed,
  never modified, by EVAL-C01 (one-way `evaluateCurriculumReadiness` import +
  `/curriculum-requirements/:year/readiness` reads).
- Teaching-Load files (`faculty-assignment.*`, `useTeachingLoad*`, `TeachingLoad.tsx`,
  `scheduling-policy.service.ts`, `teaching-load-cycle.service.ts`, `types.ts`) and
  Timetable files (`CenterWorkspace.tsx`, `ScheduleReviewWorkspace*`,
  `useTimetableData/Mutations.ts`, `useTimetableCollaboration.ts`,
  `timetableSchoolScope.ts`, etc.) are dirty from parallel streams; EVAL-C01 touches
  none of them (confirmed: no EVAL-C01 symbol or import crosses into them, and the
  EVAL-C01 diff hunks contain no edits to those paths).
- No `*prisma*`, `*migration*`, `*schema*` paths dirty. No auth, companion-repo, or
  backup/recovery paths dirty. Nothing staged, committed, stashed, or reset by this
  review (read-only git commands only).

## Plan-to-evidence mapping (requirements 1–10)

1. **School always from authenticated actor, no school-1 fallback** — PASS.
   Router (`dashboard.router.ts:23-39`) derives `actorSchoolId = Number(req.user?.schoolId)`,
   resolves scope via the shared `resolveDashboardScope`, and the `?? 1` default is
   gone. Client `DEFAULT_SCHOOL_ID = 1` is gone; every request URL interpolates the
   bound actor `schoolId` (`useDashboardData.ts:297-299,311,352,361,371,414,418,438,466`).
2. **Unresolved/cross-school scope rejected before domain reads** — PASS.
   `resolveDashboardScope` (`service:274-285`) rejects non-integer/non-positive actors
   with `SCHOOL_SCOPE_REQUIRED` and mismatched queries with `SCHOOL_SCOPE_MISMATCH`.
   Router returns 403 before `getDashboardReadinessSummary` is called. Client returns
   early with zero `atlasApi` domain dispatches (hook lines 260-281; trace verified —
   only `resolveActorSchoolId` settings read precedes the gate). A 403 from the summary
   call resets domain state and never falls through to legacy requests (lines 503-516).
3. **Active year resolved dynamically from runtime context** — PASS.
   `resolveDashboardActiveYear` (`service:293-304`) prefers runtime; the explicit
   `schoolYearId` is fallback-only. Wiring in `getDashboardReadinessSummary` lines
   420-423 uses it (previously `input.schoolYearId ?? runtime…`, now inverted).
4. **PUBLISHED only for COMPLETED strictly-published run in exact school+active year** —
   PASS. `isStrictlyPublishedRun` (`service:258-262`) requires mapped-COMPLETED status
   AND `summary.isPublished === true`; the old `readPublished` loose rule
   (`publishedAt`/`publishedBy` markers) is deleted. Publication scan (lines 557-572)
   is bounded (`take: 10`, `status: 'COMPLETED'`, `id/status/summary` columns only —
   no `draftEntries`/`violations` payloads) for the exact `(schoolId, activeSchoolYearId)`.
   `generation.isPublished`/`publishedRunId` derive from the guarded lifecycle
   (lines 605-628), and the trace `publication scan → resolvePublicationFromCandidates
   → resolveDashboardLifecycle → response` uses the guard at every step (no bypass path).
5. **Historical/other-school runs never satisfy** — PASS. `resolvePublicationFromCandidates`
   (`service:320-332`) skips candidates whose `schoolId`/`schoolYearId` disagree; the
   SQL scan itself is already scoped to the exact pair. Probes b1/b2/a7 confirm.
6. **No current-year run ⇒ never published/visible** — PASS. No active year ⇒ scan
   returns `[]` (line 558), `publishedRunPresent=false` via the `-1` sentinel
   (lines 605-608), lifecycle cannot be PUBLISHED (probe b3). Latest-run `NONE` paths
   return nulls (lines 515-523, 536-544).
7. **Checklist/lifecycle/next-action/run summary/publication from one coherent snapshot** —
   PASS. Server assembles one `DashboardReadinessSummary`; client prefers
   `summaryLifecyclePhase` and only falls back to a local derivation that can never
   claim PUBLISHED (hook lines 557-584). `Dashboard.tsx` derives `curriculumMissing`,
   `degraded`, `next`, stats, checklist, and lifecycle rail from that single snapshot
   (lines 262-270).
8. **Missing term config / Curriculum Requirements ⇒ setup blocker linking
   `/subjects/requirements`** — PASS. Server `curriculum` compact object + blocker
   passthrough (lines 576-587, 603); lifecycle holds SETUP when `!curriculumReady`
   (line 358, before setup/run evaluation). Client `pickNextStep` returns the
   `/subjects/requirements` repair first under SETUP (page lines 201-206); checklist
   repair row added (lines 284-286).
9. **Dependency failure ⇒ degraded, never published** — PASS. `hasDomainError` now
   includes publication and curriculum results (line 604); `resolveDashboardLifecycle`
   forces `isPublished=false` on any domain error (line 355). Client degraded branch
   guides to recheck, never publish (page lines 197-199; hook 448-454, 503-516).
10. **Consume (never modify) the Curriculum Requirements implementation** — PASS.
    Only `evaluateCurriculumReadiness` is imported (service line 3) and its existing
    read contract is mapped, not altered; no Curriculum Requirements source, schema,
    or migration file is in the EVAL-C01 diff.

## Adversarial bypass attempts (all defeated; 31/31 probes PASS)

Executed against the REAL modules (server guards via `tsx` from `atlas-server`;
client decisions via `tsx` from `atlas-client`; throwaway probe files in the
pre-approved temp dir, deleted afterwards; zero DB writes, zero network, zero server
restarts):

- (a) FAILED run with stale markers through `isStrictlyPublishedRun` AND the
  assembled wiring: worst-case `FAILED + isPublished:true` → false; `COMPLETED +
  publishedAt-only` → false; `COMPLETED + publishedBy-only` → false;
  `CANCELLED + isPublished:true` → false (maps to NONE); lowercase `completed` +
  published → true (case-insensitive COMPLETED, intended); single FAILED-stale
  candidate through `resolvePublicationFromCandidates` → not published; mixed
  newest-FAILED-stale + older-COMPLETED-published → resolves to the older id 76.
  The wiring trace confirms the guard is actually used end-to-end (no loose path
  remains; `readPublished` is deleted).
- (b) Historical-year (year-7 run 425) and other-school (school-2 run 901)
  COMPLETED+published candidates → both rejected; `-1` no-year sentinel → rejected.
- (c) Explicit `schoolYearId=7` disagreeing with runtime year 8 → runtime wins;
  runtime-null fallback → request honored; both-null → null; invalid runtime (0) →
  valid request fallback.
- (d) `hasDomainError=true` with a published candidate → `isPublished=false`,
  phase ≠ PUBLISHED.
- (e) Router trace: missing `req.user.schoolId` → `Number(undefined)=NaN` → not
  integer → null → 403 `SCHOOL_SCOPE_REQUIRED`; mismatched `?schoolId=2` for actor 1
  → 403 `SCHOOL_SCOPE_MISMATCH`; malformed query (`""`, `"1abc"`) → 400
  `INVALID_PARAM` via `positiveInt`. All rejections precede any domain read.
- (f) Client hook with unresolved actor (`undefined`, `NaN`, `0`, negatives, floats):
  `resolveDashboardRequestScope` not-ready; effect returns before the first
  `atlasApi` call (code trace, hook lines 260-281). Zero domain dispatches proven by
  trace (the suites assert the gate; the trace confirms no call precedes it).
- (g) Actor change without reset: `boundActorRef` rebind + `resetDomainState()`
  (lines 285-288); effect deps include `actorSchoolId`, so in-flight chains from the
  old school are cancelled via the per-effect `cancelled` flag checked in every
  nested `.then`. Cleared state carries no run/publication/year identity (probe g1).
- (h) Local fallback lifecycle: returns only SETUP/PREFERENCES/GENERATION/REVIEW
  across the full status matrix without publication (hook lines 557-584; probes h1);
  degraded snapshot forces the recheck action even in PUBLISHED phase (probe h2).
- (i) Checklist conflation: "Schedule published" `done` ⟺ `lifecyclePhase ===
  'PUBLISHED'` (page line 291); old `REVIEW + zero violations ⇒ done` disjunct
  removed (diff-verified). REVIEW zero-violation next action routes to `/schedules`
  review without claiming published (probe i2).
- ESM import check: `school-year-offering.service.js` import is one-way (no file
  under `atlas-server/src/services` imports `dashboard-readiness`; grep-verified, no
  cycle); its imports are stdlib/lib/Prisma/term-config/class-program-slot/
  school-year-authority only, with no import-time writes. `evaluateCurriculumReadiness`
  export exists (line 929) with the consumed `(schoolId, schoolYearId)` signature
  (server `tsc --noEmit` exit 0 confirms the call typechecks). Module import executed
  cleanly in the probe (only the expected `DATABASE_URL is not set` stderr warning;
  no queries issued).

## Commands rerun with results (reviewer-executed)

| Command | Result |
|---|---|
| Server suite `npx tsx src/__tests__/dashboard-lifecycle-truth.test.ts` (atlas-server) | 12/12 PASS |
| Client suite `npx tsx --test src/hooks/__tests__/dashboard-lifecycle-truth.test.ts` (atlas-client) | 7/7 PASS |
| Server `npx tsc --noEmit` | exit 0, no output |
| Client `npx tsc --noEmit` (run 1) | 1 error in `src/hooks/__tests__/useTimetableCollaboration.test.ts:52` (`scopeGuard` excess prop) — a TT-stream file outside EVAL-C01 scope |
| Client `npx tsc --noEmit` (runs 2–3) | exit 0, zero errors; zero errors mentioning Dashboard/useDashboardData/lifecycle-truth in any run |
| `git diff --check` | exit 0 (only pre-existing LF/CRLF notices worktree-wide, no whitespace errors) |
| Independent server adversarial probe (24 checks, real guards) | 24/24 PASS |
| Independent client decision probe (7 checks, real functions) | 7/7 PASS |
| `git status --short` / `git diff --stat` / `git diff --name-only` forbidden-touch audit | EVAL-C01 touched only its 4 production files + 2 git-ignored test files; all other dirty files attributed to parallel streams (see above) |

Note on the transient client-tsc error: a single first-run error in another stream's
test file did not reproduce on two immediate reruns with identical invocation. Most
likely a stale incremental artifact, not a source defect; it is outside EVAL-C01 scope
either way and is recorded here as an observation, not a finding. No build, server
restart, database access, or live-Tailnet write was performed by this review.

## Findings

No material findings. Required fixes: none.

Informational observations (no action required, recorded for planner awareness):

1. [info] SQL publication scan filters `status: 'COMPLETED'` exactly, while the pure
   guard also accepts mapped-`SUCCESS`. A hypothetical `SUCCESS`-status published row
   would be under-reported (never over-reported — fail-closed direction). Consistent
   with the observed status vocabulary; not a bypass.
2. [info] Client legacy path only blocks on a *definite* year-context school mismatch
   (after one forced refresh); a `null`/`undefined` context school proceeds. All
   year-scoped legacy requests still carry the actor `schoolId`, and the server
   snapshot is authoritative for lifecycle/publication, so no cross-school leak —
   worst case is a wrong-year fallback display.
3. [info] Router coerces `req.user.schoolId` via `Number(...)`; a non-numeric truthy
   value outside the auth contract could coerce unexpectedly. The auth middleware
   types it numeric and every non-integer still fails closed to 403. Not a bypass.

## Final verdict

**Advisory GO, zeroFix=true.** All 10 requirements hold under adversarial probing;
decisive gates rerun green by this reviewer; changed scope is contained and
forbidden paths are untouched. Capped at REVIEW_REQUIRED per the owning prompt —
formal acceptance remains with planner/QA.
