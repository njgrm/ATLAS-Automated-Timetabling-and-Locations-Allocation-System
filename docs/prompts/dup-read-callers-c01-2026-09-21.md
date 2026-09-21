# DUP-READ-CALLERS-C01 — the three named duplicate-read callers (source cycle; deployment deferred)

Status: **PREPARED — CORRECTED r2**. r1 corrected the first independent pre-action review
(`ses_f3de7e123ffem8meOv9yZ6kAdl`, 3 BLOCKING); r2 corrects the bounded re-review
(`ses_f3de10bf8ffeM7Ban32pvyJIhi`, 2 BLOCKING). Supersedes the r0 packet committed at
`30846e3a`; dispositions are in §7.

Risk: **MEDIUM** source (client read-path concurrency). **Deployment is deferred and is not
authorized by this packet** — §0 and §3.

Base: the `work/dup-read-callers-c01` tip at dispatch (branched from `origin/main`
`f6e5fce5`). Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 0. Why the deployment is not in this cycle (measured)

`D:` free is **15.81 GiB**. `AGENTS.md` §3 warns below 25 GiB and **fails closed below
15 GiB**; the frozen deploy boundary this packet would reuse
(`current-source-live-deploy-c02`, precondition 4) fails closed on the **post-build** figure —
free space before, the projected release footprint, and free space after. Live release trees
measure **1.43–1.86 GiB**, and **21** never-retirable `D:\ATLAS-runtime-*` directories are
present (19 supervised releases + the `d44f29e0` fallback + `ATLAS-runtime-config`). A build
from 15.81 GiB lands at **13.95–14.38 GiB — below the floor**, with PostgreSQL on `D:`.

Therefore:

- This cycle is **source-only**. Part A (§2) is the executable contract.
- Deployment and its browser rows are recorded in §3/§4 as **DEFERRED
  deployment-acceptance clauses**. They fold into the next release once the operator decides
  on `D:` headroom — release-directory retention is **operator-only**, because release dirs
  are on this lane's never-retire list.
- An executor must **not** start a release build under this packet. If one is started anyway,
  precondition 4 fails closed and the result is `BLOCKED(capacity)`.

## 1. Why this packet

`DUP-READ-DIAGNOSIS-C01` (`docs/reviews/dup-read-diagnosis-c01/findings.md`, base
`5ce47f60`) measured the concurrent identical GETs on the deployed production build and
**inverted the assumed fix**: StrictMode is ruled out (it double-invokes only in dev, and the
production host refuses a dev tree), `atlasApi` has no retry/caching interceptor, and the
causes are three named callers with three distinct mechanisms. All three were re-verified at
`origin/main`, and the five implicated files are **unchanged since `5ce47f60`** (empty diff),
so the findings' line references hold. This packet closes exactly those three callers and is
deliberately **not** a blanket coalesce.

## 2. The source change

**Authorized paths (positive list — nothing else):**

- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/components/AppShell.tsx` (required by A1)
- `atlas-client/src/hooks/useTimetableData.ts` — **no edit required**: A2 keeps the
  `:1175-1190` follow-up (see above); r1's authorized removal is withdrawn.
- new/changed test files under `atlas-client/src/lib/__tests__/` and
  `atlas-client/src/hooks/__tests__/`
- `atlas-client/package.json` — **test-script entries only**
- evidence under `docs/reviews/dup-read-callers-c01/`

Out of bounds: `atlas-server/**`, `ops/**`, `prisma/**`, the root `package.json`, every
`.env`, `D:\ATLAS-runtime-config\**`, `AGENTS.md`, `CHANGELOG.md`,
`docs/plans/live-state.md`, and every runtime release directory.

### A1 (mandatory) — one in-flight `/auth/me` per token epoch, across **both** dispatchers

`resolveActorSchoolId` (`settings.ts:463`) has no in-flight sharing (cache check `:474`,
single dispatch `:485`). **`verifySessionToken` (`settings.ts:788-849`) dispatches its own
`/auth/me`** — the local-token attempt at `:795-801` and the bridge attempt at `:826` — while
`AppShell.tsx:360` calls it on mount and `useTimetableData.ts:1151` / `useActorSchoolScope`
go through `resolveActorSchoolId`. Coalescing only the latter leaves the measured ×2. **Both
must share one in-flight promise per token epoch**, in the shape of `inflightBySchool`
(`enrollpro-public-settings.ts:179-205`): a rejected request clears the entry in `finally`,
and a token-epoch change or logout must never serve a stale actor id.

### A2 (mandatory) — `forceRefresh` cooperates **without** dropping `verifyUpstream`

`resolveActiveSchoolYearContext` bypasses `inflightBySchool` when `forceRefresh:true`
(`:231-241`). But its callers are not equivalent: `AppShell.verifyActiveSchoolYear`
(`AppShell.tsx:169-201`) sends `forceRefresh` **+ `verifyUpstream:true`**, while the
background refresh (`useTimetableData.ts:1161-1166` → `enrollpro-public-settings.ts:199-204`)
is `verifyUpstream:false`. `verifyUpstream` is load-bearing
(`atlas-server/src/services/runtime-context.service.ts:187-205`): without it the result is
`status:'aligned'` / `recommendedAction:'NONE'` instead of `'enrollpro-unreachable'` /
`'RETRY_ENROLLPRO'`, and `activeTerm` stays `{verified:false}`. Making a `forceRefresh` caller
join the weaker in-flight request would therefore be a **user-visible regression**.

**Key the in-flight registry by request profile** —
`schoolId:verifyUpstream:allowEnrollProFallback:allowStaleOnError` — so no caller joins an
in-flight request whose load-bearing options differ. A `forceRefresh`+`verifyUpstream` caller
joins only an equal-or-stronger profile (never `verifyUpstream:false`; never
`allowStaleOnError:true` when it passed `false`) and is never answered from cache.
`AppShell.tsx:174-180` and `atlas-client/src/pages/MySchedule.tsx:157` share `schoolId:true:false` today and differ
only on `allowStaleOnError`, which selects throw versus `{source:'cache',stale:true}`
(`enrollpro-public-settings.ts:280-293`, `:314-328`); a join there would let AppShell adopt
stale data instead of remaining on the last verified context. Give
`promoteActiveSchoolYearContext` (`enrollpro-public-settings.ts:331-347`), which writes the
same registry, the same key. Normalize absent options to their defaults inside the key
(`verifyUpstream` and `allowEnrollProFallback` → `!== false`, `allowStaleOnError` →
`!== false`), or two callers that differ only by an omitted default would fragment the dedup.

**Keep** the `useTimetableData.ts:1175-1190` follow-up. Under the profile key it joins the
background refresh's in-flight request (same profile) and adds no dispatch, but it is the only
path that propagates the fresh result to hook state (`setSchoolYearContext` at `:1184`).
Deleting it would change rendered `schoolYearSource`/`activeTerm`
(`useScheduleReviewWorkspaceState.ts:1651` → `TimetableWorkflowDialogs.tsx:54`) — forbidden by
§2's out-of-scope rule.

### A3 — `rollover-status`: one in-flight request per **(school, includeCounts)**

`fetchRolloverStatus` (`settings.ts:528-534`) is raw per-call axios with zero dedup, and the
Timetable route can mount two `RolloverGuidanceCard`s at once
(`ScheduleReviewWorkspaceHeader.tsx:766` + `SimpleDriftBanner:200`). Key the in-flight map by
`schoolId` **+ `includeCounts`**: the card mounts with `false` (`:190/194/246`) but re-loads
with `true` (`:366/387/410/462`), so a school-only key could serve a count-less payload to a
counts caller — a rendered-output change this packet forbids. Do not touch the six mounting
pages.

### A4 — instrumented, failing-first evidence

The new tests must **count real dispatches** through an instrumented axios adapter (or
equivalent), not assert that a function was called. Before the fix, at least one control must
**fail** (over-count) — a counter that cannot fail on the mutant is not evidence.

### A5 — checkpoint

Commit A1, then A2, then A3 as separate commits so a step limit leaves usable checkpoints.
Never amend a commit already reported.

### Out of scope — do not do these

- **Do not coalesce in `atlasApi` (`lib/api.ts`)** — it touches every API call.
- **Do not fix the host proxy or any server route.** The two 502 routes cannot emit 502
  themselves; the layer is unproven and needs a captured response body (O1), not a code change.
- **Do not add retry/caching.** TanStack `retry:1` already covers query-cache reads.
- **Do not change any rendered output, persisted value, or request parameter.** The only
  intended change is the **number** of identical dispatches; A2's profile key selects which
  promise is joined and must not change what any caller receives.

## 3. DEFERRED — deployment (deployment-acceptance clause, not runnable now)

Not executable under this packet (§0). When the operator resolves `D:` headroom: target the
release carrying the accepted client tip, build into
`D:\ATLAS-runtime-supervised-<candidate-sha>-20260921`, and reuse
`CURRENT-SOURCE-LIVE-DEPLOY-C02`'s frozen boundary, preconditions, authorized mutations and
rollback section **verbatim in structure** — including precondition 4's before/projected/after
`D:` figures with the 15 GiB fail-closed floor. Re-capture every literal at execution. No
environment byte changed, SMART/AIMS inactive, no migration or database write, ports 5001/5174
only, elevated executor, single start via the registered task. Prove the deploy with the **new
entry chunk** (it must differ from the incumbent's), and keep the schema-wide signature map
byte-identical using the C01 addendum's SQL verbatim (`SET TIME ZONE` pinned — `row_to_json`
of `timestamptz` is session-dependent). The release is client-only; the server rebuild must not
change server behaviour. A D-row must also carry the known `cli.mjs status` `live:false` bug
(live-state): listener ownership, supervisor state and HTTP probes are authoritative.

## 4. DEFERRED — browser acceptance (deployment-acceptance clause, QA custody)

When the fix is deployed: custody goes to the independent QA task; the planner releases the
shared profile and QA closes it. One authorized login expected — **disclose its `audit_logs`
row**. Read-only: no Save, Apply, Generate, Publish or Delete, and **no timetable cell click**
(a click places a session). On a clean load of `/timetable`, measure and record literally:
`/auth/me` exactly **1 per token epoch**; `runtime/context` **≤2**; `rollover-status` exactly
**1 with two cards asserted mounted in the same step**. No global scrollbar at `1366x768`; and
console errors compared against the **named incumbent build's** baseline, not an unstated
"no new error".

## 5. Acceptance — 5 mandatory rows this cycle

**Source (5) — decided by the committed client test scripts**

S1: `/auth/me` — concurrent cold-cache callers across **both** `resolveActorSchoolId` and
`verifySessionToken` dispatch exactly one request per token epoch; a token-epoch change
dispatches a new one; a rejection clears the entry. Instrumented counter plus a failing-first
control.
S2: `runtime/context` — a `forceRefresh`+`verifyUpstream` caller never joins a
`verifyUpstream:false` in-flight request; the joined dispatch's query parameters are asserted;
the resulting `drift`/`activeTerm` state is unchanged from today; **and a caller that passed
`allowStaleOnError:false` never joins an in-flight request that passed
`allowStaleOnError:true`, asserted on both the success and the failure path.** Instrumented
counter plus an assertion on the returned state.
S3: `rollover-status` — two concurrent callers for one `(schoolId, includeCounts)` pair
dispatch exactly one request; differing `includeCounts` stay independent; a rejection clears
the entry. Instrumented counter plus a failing-first control.
S4: no consumer behaviour change — every existing suite touching these modules passes
unchanged, and **no assertion is deleted or weakened** (corrections are additive to evidence).
S5: script reachability and gates — the new test file is reachable from a committed
`atlas-client/package.json` script in the same commit (`AGENTS.md` §11), and **that script
also runs the existing decisive suites that are currently in no script**:
`actor-school-session-epoch`, `actor-scope-session`, `active-school-year-scope`,
`session-scope-late-discard`, `rollover-term-repair`, `term-authority-actor-scope`,
`ux-p01-timetable-data-layer`. Client type-check passes and the committed client suites pass.

**Deferred deployment-acceptance clauses** — B1 (the `/timetable` request counts of §4) and
B2 (no user-visible regression, viewport `1366x768`, console baseline). Reported `DEFERRED`
with their reason; **not** claimed as passed, and not counted in this cycle's tally.

**Observation rows — not acceptance rows.** O1: the 502 lead's exact status/body/headers if it
reproduces. O2: the duplicate baseline outside the three callers. Neither can fail, and
neither counts toward the tally.

`ACCEPT_READY` for this cycle requires **5/5 source rows passed, blocked 0, unperformed 0**,
with B1/B2 reported `DEFERRED` and O1/O2 reported as observations in the evidence. A source
row that cannot be performed is reported `BLOCKED`/`UNPERFORMED` with its reason.

## 6. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the decisive
commands with their results, the five source rows each with its own result, the failing-first
control's output, the literal instrumented counts, the deferred-row reasons, rollback status,
and risks marked `BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.

## 7. Correction record (r1)

Independent pre-action review `ses_f3de7e123ffem8meOv9yZ6kAdl` returned
`CORRECTION_REQUIRED` (satisfiability lint 12/13; blocked 1). Disposition of each finding:

- **B1 — capacity precondition weaker than the boundary it reuses; a build would land below
  the 15 GiB floor.** Accepted. §0 now fails closed **pre-build** and the deployment is
  deferred; §3 records the deferred boundary.
- **B2 — the `/auth/me` "exactly 1 per epoch" row was unsatisfiable** without unifying
  `verifySessionToken`, which r0 left optional. Accepted. A1 now mandates it and authorizes
  `AppShell.tsx`.
- **B3 — A2's force-join would silently drop `verifyUpstream`**, a user-visible drift/term
  regression no r0 row could catch. Accepted. A2 now keys the in-flight registry by request
  profile and S2 asserts the parameters and the resulting state.
- **N1 — A3 keyed only on `schoolId`** while the request also carries `includeCounts`.
  Accepted; A3 and S3 key on both.
- **N2 — S4's harness did not run the decisive suites**, several of which are in no committed
  script. Accepted; S5 requires the new script to run them.
- **N3 — the `useTimetableData` warm-cache clause is not decidable by the client harness**
  (no renderer test files exist). Accepted; the clause moves to the deferred browser rows.
- **N4 — the two report-only rows cannot fail** and should not be counted as mandatory
  acceptance. Accepted; re-labelled Observation.
- **N5 — wording and precision:** positive authorized-path list; resolve the A1 "optional"
  item explicitly; require two mounted cards in the rollover measurement; name the console
  baseline; correct the runtime-directory count to 21; carry the `cli.mjs status` caveat.
  Accepted.

### r2 — bounded re-review of `30846e3a...da58cedc` (`ses_f3de10bf8ffeM7Ban32pvyJIhi`)

Verdict `CORRECTION_REQUIRED`, 13/15 review rows. B1 and B2 confirmed closed; B3 confirmed
**partially** closed. Two new blocking findings, both accepted and applied here:

- **F1 — the request-profile key omitted `allowStaleOnError`**, the same flag-drop class B3
  raised on a different axis. `AppShell.tsx:174-180` passes `false` while `atlas-client/src/pages/MySchedule.tsx:157`
  passes `true`; both share `schoolId:true:false` today, so a join could let AppShell adopt
  stale data instead of remaining on the last verified context. Accepted: the key now carries
  all four axes, `promoteActiveSchoolYearContext` uses the same key, and S2 asserts the
  `allowStaleOnError` axis on both the success and the failure path.
- **F2 — deleting the `useTimetableData.ts:1175-1190` follow-up would silently change rendered
  state.** That block is the only path that propagates the fresh context to hook state
  (`setSchoolYearContext` at `:1184`), and no source row could decide it — the deferred
  browser row would have been carrying a source-level correctness claim. Accepted: the
  follow-up is kept and the row text is corrected.
- Doc nit: the handoff said 22 runtime directories; the filesystem says **21**. Fixed.

### r2b — narrow closure review of `da58cedc...ff97813d` (`ses_f3ddca955ffevRNZdr3UhvUuoU`)

F1 `CLOSED`; F2 not yet closed for one residual. Two advisories folded in:

- **Residual (blocking, now closed):** the §2 authorized-path parenthetical still authorized
  `useTimetableData.ts` *for the withdrawn removal*, contradicting A2's Keep clause in the same
  section — the last fragment of the class F2 blocked. Corrected: the path is now marked
  "no edit required" and r1's removal is expressly withdrawn.
- **Advisory:** `MySchedule.tsx` citations now carry the `atlas-client/src/pages/` prefix.
- **Advisory:** the profile key must normalize absent options to their defaults, or two callers
  differing only by an omitted default would fragment the dedup. Added to A2.
