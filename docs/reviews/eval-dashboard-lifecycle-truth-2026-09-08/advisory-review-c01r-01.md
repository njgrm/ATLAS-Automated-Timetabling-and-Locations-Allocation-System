# Advisory Review — EVAL-C01R (Active-year and publication authority closure)

- Plan/ledger: `docs/progress/eval-dashboard-lifecycle-truth-2026-09-08-progress.md` (EVAL-C01R section)
- Changed scope reviewed: `atlas-server/src/services/dashboard-readiness.service.ts`, `atlas-server/src/routes/dashboard.router.ts`, `atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts`, `atlas-server/src/__tests__/dashboard-http-authority.test.ts`, `docs/progress/eval-dashboard-lifecycle-truth-2026-09-08-progress.md`
- Reviewer context handle: `advisory-reviewer-c01r-01` (fresh context; did not implement EVAL-C01 or C01R). NOTE: this environment exposed no verifiable orchestrator/thread-issued spawn identifier to this reviewer. Per repo rules this artifact is ADVISORY evidence only; it does not constitute or substitute for formal planner/QA review authority. No file was modified during this review (read-only plus gate reruns).
- Review basis: authoritative progress ledger, full source reads of all four changed files, prisma schema (`GenerationRun`, `EnrollProSchoolYearMirror`, `GenerationRunStatus`), `runtime-context.service.ts`, `authenticate.ts`, `authorize.ts`, `app.ts` mount point, and call-site grep across the server source tree.

## Reviewed file identity (SHA-256, truncated 16)

| File | Hash prefix |
|---|---|
| `atlas-server/src/services/dashboard-readiness.service.ts` | `DF498871F6CCFE0F` |
| `atlas-server/src/routes/dashboard.router.ts` | `5C890898944941A3` |
| `atlas-server/src/__tests__/dashboard-lifecycle-truth.test.ts` | `4E5B555AD95773A6` |
| `atlas-server/src/__tests__/dashboard-http-authority.test.ts` | `D43FED7174AF6F19` |
| `docs/progress/eval-dashboard-lifecycle-truth-2026-09-08-progress.md` | `11CD503C441E9FD3` |

Hash prefixes match the ledger's recorded post-edit hashes (service `DF498871…`, router `5C890898…`, server-test `4E5B555A…`, http-test `D43FED71…`). Combined tracked diff for the two changed production files: `git diff --stat` = service `+232/−` , router `42 +++-/`; total `234 insertions, 40 deletions` (client hook/page deltas belong to the prior EVAL-C01 prompt). C01R test files and the ledger live under gitignored paths (`**/__tests__/`, `docs/`) and are correctly absent from `git status`.

## Adversarial bypass attempts exercised

### (a) Requested/historical year into active-year or publication scope — NO PATH
- `getDashboardReadinessSummary(input)` accepts only `{ schoolId, authToken }`; `DashboardSummaryInput` carries no year field. The sole caller is `dashboard.router.ts:55`, which forwards only `schoolId` + `authToken`.
- `resolveDashboardActiveYear` reads `runtimeContext?.activeSchoolYearId` only (service line 405). Runtime is the sole authority by construction; a requested year cannot be threaded in.
- Router: `schoolYearId` is validated (typed 400 when malformed) then deliberately discarded (router lines 46–52); it is never forwarded.
- `resolveRuntimeContext(schoolId, …)` is school-scoped; for a school with zero evidence it returns `null` (no fabricated year). Grep confirms no other server caller of the dashboard functions; the service is not reachable outside the mounted, scope-guarded route.
- Bypass result: BLOCKED. HTTP proofs: `schoolYearId=2001` returns active year 2002 with the same publishedRunId; zero-evidence school + `schoolYearId=9` → `activeSchoolYearId null`, never PUBLISHED.

### (b) Ten-row window removal + DB-pushed predicate + FAILED/older-run handling — NO BYPASS
- `buildDashboardPublicationWhere` (service 310–317) returns `{ schoolId, schoolYearId, status: 'COMPLETED', summary: { path: ['isPublished'], equals: true } }`. No `take`. Schema contract verified: `GenerationRun.status` is the `GenerationRunStatus` enum (QUEUED/RUNNING/COMPLETED/FAILED); real completed rows store `COMPLETED`, so the `status` limb matches real data (the service's `mapRunStatus` also maps `SUCCESS` defensively, but no such DB value exists).
- `summary` is `Json?`; the JSON-path equality filter is a real Prisma/Postgres WHERE predicate (not an in-memory scan), and `findFirst` with `orderBy createdAt desc` returns at most one newest matching row. FAILED rows (any summary) and non-`true` summaries are excluded DB-side.
- Older valid publication not hidden: HTTP seeds 12 completed runs — oldest published, 11 newer completed unpublished, plus a newer FAILED row with stale markers — and asserts `publishedRunId === oldest.id` while `latestRunId === failed.id` and `latestRunStatus === 'FAILED'`. A revert of either WHERE limb (status filter or summary path) or a reintroduced top-N scan breaks this proof (lifecycle would not resolve PUBLISHED to the oldest row).
- `isStrictlyPublishedRun` re-validates the returned row (defense in depth, consistent with the predicate).
- Hermetic sensitivity: guard-bypass detector asserts the FAILED+stale-marker fixture WOULD publish under the loose rule and does NOT under the strict guard; reverting `isStrictlyPublishedRun` or the lifecycle fail-closed rules fails the suite.
- Bypass result: BLOCKED. Determinism note (informational): `orderBy createdAt desc` has no secondary `id` tiebreak; a same-millisecond duplicate `createdAt` between two genuinely published runs would make the LIMIT-1 pick ambiguous. Improbable and non-authority-relevant; optional hardening only.

### (c) Publication select minimality / heavy JSON — CONFIRMED
- Publication `findFirst` selects only `{ id, status, summary, createdAt }` (service 548–552). It never selects `draftEntries`, `violations`, or `unassignedItems`.
- Source-scoped guard (hermetic) requires the literal `const row = await prisma.generationRun.findFirst(` block to be present and to contain none of `draftEntries`/`violations`/`unassignedItems`/numeric `take`; renaming the variable or moving the resolution out of this file fails the guard.
- Functional proof: runs seeded with 200 draft entries / 100 violations / 50 unassigned items each still resolve correctly — the publication path never depends on them.
- Informational (not a C01R defect, pre-existing outside C01R's changed scope): the separate latest-run read for `violationCount` still selects one row's `violations` JSON. It is a single-row bounded read, not a whole-table or whole-array scan, and is not part of the C01R publication-resolution change. Noted for the memory-rule reader.

### (d) Router 403/400 — CONFIRMED
- Unresolved actor (`Number(req.user?.schoolId)` non-finite) → 403 `SCHOOL_SCOPE_REQUIRED` before any domain read; service call never happens.
- Cross-school query (or `/summary` alias) → 403 `SCHOOL_SCOPE_MISMATCH`.
- Malformed `schoolId`/`schoolYearId` (non-positive, non-integer, array, non-numeric) → 400 `INVALID_PARAM`. Scope is resolved before year validation, so a cross-school + malformed-year request returns 403 first — authz-before-validation ordering, not a bypass (no information is leaked and no domain read occurs).
- `requirePrivilegedRole` admits `admin`/`officer`/`SYSTEM_ADMIN`; test JWTs with `role: 'officer'` traverse the real mounted middleware chain.
- Informational: a system-token or `SYSTEM_ADMIN` JWT without a bound `schoolId` now receives 403 `SCHOOL_SCOPE_REQUIRED` on the Dashboard. This is the intended fail-closed consequence of "no default school"; any legitimate system-token Dashboard consumer would need a school-bound token.

### (e) Guard-bypass detector sensitivity — CONFIRMED
- FAILED-row stale-marker fixtures are asserted sensitive to the loose rule AND rejected by the strict guard; dependency-degraded + published-run-present lifecycle is asserted non-PUBLISHED; runtime-missing cases assert `resolveDashboardActiveYear` → null.

### (f) HTTP proofs + finally cleanup — CONFIRMED
- Proofs: unresolved 403, cross-school 403 (both aliases), malformed school/year typed 400, runtime active year 2002 → PUBLISHED, outside-window published run found, FAILED newest row never drives publication, mismatched requested year 2001 ignored, zero-evidence school + requested year 9 → null/never-published, heavy payloads irrelevant.
- Sandbox IDs `7799001`/`7799002` (never school 1); cleanup runs in `finally` (even on mid-seed failure) deleting runs/mirrors/schools for both sandbox IDs and asserts zero residue for all three.
- Informational: for the sandbox school the runtime-context still attempts an EnrollPro upstream read for each request; because evidence is confined to the sandbox mirror year 2002 the selected active year is deterministic regardless of upstream reachability or the real tenant's year. Read-only; does not affect the verdict.

## Plan-to-evidence mapping

| Requirement (C01R) | Enforcement site | Evidence |
|---|---|---|
| R1 active-year authority (runtime sole; no default) | `resolveDashboardActiveYear` (service 294), `DashboardSummaryInput` (no year), router 46–52 drop, `resolveRuntimeContext` null-on-no-evidence | Hermetic "runtime-only" test; HTTP mismYear + zero-evidence assertions |
| R2 remove 10-run boundary | `buildDashboardPublicationWhere` (no take), publication `findFirst` (no take) | Hermetic WHERE/no-take test; HTTP oldest-of-12 proof |
| R2 DB-pushed predicate | WHERE `status` + `summary.path isPublished equals true` + exact school/year | Schema enum check; HTTP older-published-not-hidden proof; static shape |
| R2 FAILED stale-marker rows unpublished | `isStrictlyPublishedRun` COMPLETED requirement | Hermetic guard-bypass detector; HTTP `publishedRunId !== failed.id` |
| R2 minimal select / no heavy JSON | publication select `{id,status,summary,createdAt}` | Source-scoped query-shape test; HTTP heavy-payload proof |
| R3 real HTTP integration | mounted `/api/v1/dashboard` via `authenticateWithSystemToken` + `requirePrivilegedRole` | HTTP suite 31/31 |
| 403 zero-domain-read | router scope-first ordering | HTTP 403s (no service call reachable) |
| Typed 400 | router `positiveInt` | HTTP 400s |

## Commands rerun (fresh, this reviewer)

| Command | Result |
|---|---|
| `npx tsx src/__tests__/dashboard-lifecycle-truth.test.ts` (server) | 10/10 PASS, exit 0 |
| `npx tsx src/__tests__/dashboard-http-authority.test.ts` (server) | 31/31 PASS, exit 0 (zero-residue cleanup asserted) |
| `npx tsx --test src/hooks/__tests__/dashboard-lifecycle-truth.test.ts` (client) | 7/7 PASS, exit 0 |
| `npx tsc --noEmit` (server) | exit 0 |
| `npx tsc --noEmit` (client) | exit 0 |
| `git diff --check` | exit 0 (LF/CRLF notices are pre-existing worktree-wide, not errors) |
| `git status --short` + `git diff --stat` | C01R tracked edits limited to the two allowed production files; worktree dirtiness attributable to named parallel streams (TT/TL/SCA + prior EVAL-C01 hook/page), none touched by C01R |

## Findings

### Material findings
- None. 0 product/runtime defects, 0 safety-gate defects, 0 process/docs inconsistencies requiring fixes.

### Informational observations (no fixes required)
1. `orderBy createdAt desc` in the publication read has no secondary `id` tiebreak; a same-millisecond duplicate `createdAt` across two published runs would make newest-published selection ambiguous. Optional hardening: add `id: 'desc'`.
2. The pre-existing latest-run read still selects one row's `violations` JSON to compute `violationCount`; single-row bounded, outside C01R's publication-resolution change. Flagged for the timetable memory-rule reader.
3. A school-unbound `SYSTEM_ADMIN`/system-token caller now receives 403 on the Dashboard — intended fail-closed consequence of removing the school default.
4. This review environment exposed no verifiable orchestrator-issued reviewer ID, so this artifact is advisory evidence only and cannot unlock successors or substitute for formal review.

## Verdict

Advisory GO, `zeroFix: true` (advisory only). Owning prompt EVAL-C01R caps at `REVIEW_REQUIRED`; formal planner/QA acceptance is out of this reviewer's authority.
