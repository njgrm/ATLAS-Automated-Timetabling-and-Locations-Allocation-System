# DUP-READ-CALLERS-C01 — one-shot: the three named duplicate-read callers, deployed and browser-accepted

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization (`AGENTS.md`
§13). One cycle: a bounded client read-path change, deployment, browser acceptance with QA
custody.

Risk: **MEDIUM** source (client read-path concurrency; dispatch-count change only) with
**HIGH** deployment.

Base: the `work/dup-read-callers-c01` tip in the dispatch prompt (branched from
`origin/main` `f6e5fce5`). Incumbent and rollback basis: the release live when the executor
starts (expected `434b2a81`; rollback basis `5f5c6c4f` retained and startable).

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 0. Preconditions (record the literal value, never copy from this packet)

- **Capacity, fail-closed.** Record `D:` free space before the release build. The rule
  (`AGENTS.md` §3): warn below 25 GiB, **fail closed below 15 GiB**. The planner measured
  `D:` at **15.81 GiB** at packet time (warn band) and a live release at **1.86 GiB** with
  real, non-junction `node_modules`; 22 never-retirable `D:\ATLAS-runtime-*` trees are
  present. If free space is below 15 GiB at execution, **stop before the build** and report
  `BLOCKED(capacity)` with the measured figure — do not proceed on a near-miss.
- **Listener identity is captured at execution.** Resolve `<sourceDir>` from the task action
  or the supervisor process command line; never assume the PIDs or directory name above.
  Only the `supervisor-state.json` inside the active `ATLAS_RUNTIME_SOURCE_DIR` is
  authoritative, and read `releaseSha` — never `productPin`.
- Read `docs/reference/agent-runtime-deploy-facts.md` before Part B.

## 1. Why this packet

`DUP-READ-DIAGNOSIS-C01` (`docs/reviews/dup-read-diagnosis-c01/findings.md`, base
`5ce47f60`) measured the concurrent identical GETs on the deployed production build and
**inverted the assumed fix**. StrictMode is ruled out (it double-invokes only in dev, and the
production host refuses a dev tree). `atlasApi` has no retry/caching interceptor. The causes
are three named callers, each with a distinct mechanism. **The planner re-verified all three
at `origin/main` and confirmed none of the implicated files changed between `5ce47f60` and
`origin/main`** (empty diff), so the findings' line numbers hold.

This packet closes exactly those three callers. It is deliberately **not** a blanket
coalesce.

## 2. The source change

### A1. `atlas-client/src/lib/settings.ts` — in-flight-share `resolveActorSchoolId`

`resolveActorSchoolId` (`:463`) caches a resolved value but has **no in-flight sharing**, so
concurrent callers while the cache is cold each dispatch `/auth/me`. Share one in-flight
promise **per token epoch** using the same shape as `inflightBySchool`
(`enrollpro-public-settings.ts:179-205`): a retry after a rejected request must start a fresh
dispatch (the entry is cleared in `finally`), and a token-epoch change or logout must not
serve a stale actor id.

Optional, only if it does not widen scope: unify `verifySessionToken` (`:788-849`) onto the
same epoch cache — it is up to two dispatches on its own (`:797` local-token attempt, `:826`
bridge attempt).

### A2. `atlas-client/src/lib/enrollpro-public-settings.ts` — make `forceRefresh` cooperative

`resolveActiveSchoolYearContext` dedups concurrent calls via `inflightBySchool` **except**
when `forceRefresh:true`, which bypasses it (`:231-241`). Bypass callers are
`AppShell.verifyActiveSchoolYear` (`AppShell.tsx:169-201`) and the `useTimetableData`
stale follow-up (`useTimetableData.ts:1175-1190`). A **force means "bypass the cache", not
"bypass in-flight work"**: an in-flight request is already a fresh upstream call, so a
`forceRefresh` caller must **join** it rather than launch a parallel duplicate, and must
never be answered from cache.

Then remove the redundancy in `useTimetableData.ts`: the hook fires
`preferCache`+`backgroundRefresh` (`:1161-1169`) and then a `forceRefresh` follow-up when
`source==='cache'||stale` (`:1175-1190`), which is a second HTTP from this hook alone on a
warm-cache load. Drop the follow-up when the background refresh already covers the same
epoch, or make it join the in-flight work.

### A3. `rollover-status` — one in-flight request per school

`fetchRolloverStatus` (`settings.ts:528-534`) is raw axios per call with **zero dedup**, and
the Timetable route can mount two `RolloverGuidanceCard`s at once (review header
`ScheduleReviewWorkspaceHeader.tsx:766` + `SimpleDriftBanner:200`, the latter rendered by
`TimetableSetupPane.tsx:167` and `TimetableSimpleHeader.tsx:521`). Add module-level in-flight
sharing per `schoolId` (rejected requests clear the entry). **Do not touch the six mounting
pages** and do not change what either card renders.

### A4. Evidence that the counters are instrumented, not asserted

The new test file must **count real dispatches** through an instrumented axios adapter (or
equivalent), not assert that a function was called. A counter that cannot fail on the mutant
is not evidence: the executor must show at least one **failing-first** control — the
pre-change behaviour reproduced as a failing/over-counting test — before the fix.

### A5. Checkpoint

Commit A1, then A2, then A3 as separate commits so a step limit leaves usable checkpoints.
Never amend a commit already reported.

### Out of scope — do not do these

- **Do not coalesce in `atlasApi` (`lib/api.ts`).** It touches every API call in the client
  and is not supported by the evidence.
- **Do not fix the host proxy or any server route.** Source reading shows the two 502 routes
  cannot emit 502 themselves; the 502 layer is unproven and needs a captured response body
  (row B3), not a code change.
- **Do not add retry/caching.** TanStack `retry:1` already covers query-cache reads.
- **Do not change any rendered output, any persisted value, or any request's parameters.**
  The only observable change is the **number** of identical dispatches.
- Do not touch `atlas-server/**`, `ops/**`, `prisma/**`, the root `package.json`, any `.env`,
  `D:\ATLAS-runtime-config\**`, `AGENTS.md`, `CHANGELOG.md`, or `docs/plans/live-state.md`.

## 3. Part B — deployment

**Target pin: the accepted candidate commit of this cycle**, built into
`D:\ATLAS-runtime-supervised-<candidate-sha>-20260921`. Re-capture every literal at
execution. Otherwise reuse `CURRENT-SOURCE-LIVE-DEPLOY-C02`'s frozen boundary, preconditions,
authorized mutations and rollback section unchanged in structure: isolated release with its
own dependency trees, no environment byte changed, SMART/AIMS inactive, no migration or
database write, ports 5001/5174 only, elevated executor, single start via the registered
task, and the schema-wide signature map byte-identical using the C01 addendum's SQL
**verbatim** — pin `SET TIME ZONE`, because `row_to_json` of `timestamptz` is
session-dependent. Prove the deploy with the **new entry chunk** (it must differ from the
incumbent's recorded chunk), not with a health check.

The release is client-only; the server build is rebuilt for release integrity but its
behaviour must not change.

## 4. Part C — browser acceptance (custody with QA)

**Custody goes to the independent QA task.** The planner releases the shared profile; the QA
session is the single controller and closes it. One authorized login expected; **disclose its
`audit_logs` row**. Read-only: no Save, Apply, Generate, Publish or Delete, and **no
timetable cell click** (a click places a session).

1. **Clean load of `/timetable`** on the deployed release, with request logging: `auth/me`
   exactly **1 per token epoch**, `runtime/context` **≤2**, `rollover-status` exactly **1**
   even with two cards mounted. Record the literal counts.
2. **No user-visible regression:** `/timetable` renders the Simple workspace and there is no
   global scrollbar at `1366x768`; no new console error introduced by this change.
3. **Report-only 502 lead:** if any 502 occurs during the pass, capture that response's exact
   **status, body and headers** — that single field settles the layer. Fix nothing.
4. **Report-only baseline:** record the duplicate counts observed on endpoints **outside**
   the three named callers. No fix, no instrumentation; a clean negative is a valid result.

## 5. Acceptance — 13 mandatory rows

**Source (5) — decided by the committed client test scripts**

S1: `resolveActorSchoolId` shares one in-flight promise per token epoch — concurrent
cold-cache callers dispatch exactly one `/auth/me`; a token-epoch change dispatches a new
one; a rejection clears the entry so the next call retries. Instrumented dispatch counter.
S2: `forceRefresh` is cooperative — it joins in-flight work instead of issuing a second
dispatch, is never answered from cache, and the `useTimetableData` warm-cache load issues no
redundant follow-up. Instrumented counter.
S3: `rollover-status` — two concurrent callers for one school dispatch exactly one request;
different school ids stay independent; a rejection clears the entry. Instrumented counter.
S4: no consumer behaviour change — every existing suite touching these modules passes
unchanged; **no assertion is deleted or weakened** (corrections are additive to evidence).
S5: the new test file is reachable from a committed `atlas-client/package.json` script in the
same commit (`AGENTS.md` §11); client type-check passes; the committed client suites pass,
including `test:auth-session`, `test:client-quality` and `test:timetable-route-keys`.

**Deployment (4) — decided by the deployed runtime; reproduced by post-action QA**

D1: release identity — installed HEAD and clean status, both machine-scope values, task
action/arguments/working directory, and supervisor-state `releaseSha` (never `productPin`).
D2: ownership — one listener per port, both descending from the task-launched supervisor,
task properties intact.
D3: health, public term truth and warning protection — local/host/Tailnet health and a
DB-backed read; valid `termIndex` non-5xx and term-scoped with typed `400` on malformed
input; unauthenticated violation routes 401.
D4: served-artifact identity, configuration and zero write — served HTML and every referenced
asset matching the built manifest with the **new entry chunk differing from the incumbent's**;
env bytes and key set unchanged; SMART/AIMS inactive with typed 503s; schema-wide signature
map byte-identical.

**Browser (4) — decided by the QA browser pass on the deployed release**

B1: the clean-load request counts of §4.1, recorded literally.
B2: no user-visible regression (§4.2), with the viewport asserted at `1366x768`.
B3: report-only 502 lead — exact status/body/headers of any failing response, or a clean
negative (§4.3).
B4: report-only duplicate baseline outside the three callers (§4.4).

`ACCEPT_READY` requires **13/13 passed, 0 blocked, 0 unperformed**. A row that cannot be
performed is reported `BLOCKED`/`UNPERFORMED` with its reason. The deployment must not be
called accepted on rows QA did not reproduce.

## 6. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the decisive
commands with results, the 13 rows each with its own result, the literal request counts, the
failing-first control output, the login disclosure, the recorded `D:` figures before and
after the release build, rollback status, and risks marked `BLOCKING`/`NON_BLOCKING`. No
transcripts, secrets or database rows.
