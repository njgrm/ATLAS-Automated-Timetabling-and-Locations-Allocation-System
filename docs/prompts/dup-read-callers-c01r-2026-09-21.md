# DUP-READ-CALLERS-C01R — bounded correction: one `/auth/me` per token epoch, re-released

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization (`AGENTS.md`
§13). Bounded correction to an accepted-and-deployed cycle that failed one acceptance row.

Risk: **MEDIUM** source (client auth read path) with **HIGH** re-release.

Base: the `origin/main` tip in the dispatch prompt. Incumbent release at execution:
`4c7c0bd9` (`D:\ATLAS-runtime-supervised-4c7c0bd9-20260921`); the superseded
`434b2a81` remains startable for rollback. Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 0. Preconditions

- Capacity: `D:` held **38.82 GiB** at packet time; the deploy boundary's precondition 4 (free
  before / projected footprint / free after, **fail closed below 15 GiB**) applies verbatim at
  execution. Re-measure; never copy.
- Elevated executor for Part B. Read `docs/reference/agent-runtime-deploy-facts.md` first.
- **Custody:** client-only. `atlas-server/**` is Lane B's — if the fix appears to need a server
  change, **stop and report**.

## 1. Why — the measured failure (B2 on the deployed `4c7c0bd9`)

Post-action QA on the live release measured a clean load of `/timetable` (and `/`) issuing
**2 `/auth/me` requests**, **147 ms apart**, with an **identical bearer** (length 414), both
`schoolId:1, authSource:"local"`, both `200`.

They are **sequential**, not concurrent. The `DUP-READ-CALLERS-C01` fix shares an *in-flight
promise* per token epoch, so the second caller — which starts after the first has resolved and
cleared the entry — finds nothing to join and dispatches again. **In-flight sharing cannot
coalesce a serial duplicate**, so the acceptance row "exactly 1 per token epoch" is not met on
the real path even though the deployed bundle contains the fix.

The other browser rows passed: B1 (the dashboard now reads
`"No hard violations · 284 warnings acknowledged"`, no "blocker" anywhere) and B3.

## 2. Part A — the source change

**A short-lived, per-token-epoch resolved-value memo**, shared by `resolveActorSchoolId` and
`verifySessionToken` (`atlas-client/src/lib/settings.ts`). Contract:

1. Within one token epoch, the **first successful resolution** memoizes the resolved result;
   every later caller in the same epoch — serial **or** concurrent — is served it with **no
   dispatch**. This is the property in-flight sharing cannot provide.
2. **Fail closed on invalidation — never serve a stale actor identity:**
   - a **token-epoch change** (different/ refreshed token identity) must never be served the
     previous epoch's value;
   - explicit logout / session clear drops the memo;
   - an **authoritative `401`/`403`** drops the memo and is **never** memoized;
   - a rejected request is never memoized (only successes are).
3. **Bounded:** single-entry per epoch is sufficient; the memo must not grow unboundedly.
4. **No behaviour drift:** no rendered-output change, no request-parameter change, no change to
   any non-`/auth/me` path, and no new request introduced. The only observable change is the
   **number** of identical dispatches.

**Authorized paths (positive list — nothing else):**

- `atlas-client/src/lib/settings.ts`
- new/changed tests under `atlas-client/src/lib/__tests__/` and `atlas-client/src/hooks/__tests__/`
- `atlas-client/package.json` — **test-script entries only**
- evidence under `docs/reviews/dup-read-callers-c01r/`

Out of bounds: `atlas-server/**`, `ops/**`, `prisma/**`, the root `package.json`, every `.env`,
`D:\ATLAS-runtime-config\**`, `AGENTS.md`, `CHANGELOG.md`, `docs/plans/live-state.md`, every
runtime release directory.

**A5 — proof shape.** Instrumented dispatch counters exercising the **real** modules with a
stub transport, asserting **counts**, plus a **failing-first** control captured before the fix.
Corrections are additive: never delete or weaken an existing assertion. Commit source and
evidence separately; never amend a reported commit.

## 3. Part B — re-release

Build the accepted candidate of **this** correction into
`D:\ATLAS-runtime-supervised-<candidate-sha>-20260921`, reusing
`CURRENT-SOURCE-LIVE-DEPLOY-C02` §4–§8 unchanged in structure (frozen boundary, preconditions,
authorized mutations, rollback). Prove the deploy with the **new entry chunk** differing from
the incumbent's; schema-wide signature map byte-identical using the C01 addendum SQL verbatim;
env bytes and key set unchanged; SMART/AIMS inactive; no migration or database write. The
release carries this correction **plus** everything already in `4c7c0bd9`.

### 3.1 Planner pre-action review (2026-09-21, Lane A) — execution notes

Verdict: `ACCEPT_READY_FOR_EXECUTION` with the four corrections below. `CURRENT-SOURCE-LIVE-DEPLOY-C02`
§4–§8 (2026-09-20) remains the reusable boundary; these notes override it where a literal has
moved. Re-measure every figure at execution — never copy one.

1. **Pin (immutable).** Pin = `a02884ff75d46c336b17d7eaa52d8cfa773bd6af`. Its product tree is
   byte-identical to the accepted Part A candidate (`360c026b` / `2f1a8f33`):
   `git diff --name-only a02884ff 2f1a8f33 -- atlas-client atlas-server ops prisma` is empty.
   Delta versus the incumbent `4c7c0bd9` is exactly three client paths
   (`atlas-client/src/lib/settings.ts`,
   `atlas-client/src/lib/__tests__/dup-read-auth-me-epoch-memo.test.ts`,
   `atlas-client/package.json`) — the release is **client-only**. Release directory:
   `D:\ATLAS-runtime-supervised-a02884ff-20260921`. No Lane B server change is in this pin; do
   not add one.
2. **`schtasks` encoding — measure, do not assume.** C02 §6.3 records that `schtasks` rejected
   the bytes its own `/query /xml` returned and the encoding had to be re-declared.
   `docs/reference/agent-runtime-deploy-facts.md` (corrected 2026-09-21) measures the
   **opposite** on this host: the file registers cleanly unmodified, and rewriting the
   declaration to UTF-8 fails with `unable to switch the encoding`. Try the bytes as returned
   first; if registration fails, fix it and record the literal repair. Never substitute.
3. **Tally scope — 7 rows, not 12.** S1–S5 were decided on the accepted Part A candidate, and
   the pin's blobs are identical, so re-running them adds no evidence (`AGENTS.md` §16). This
   cycle runs **D1–D4 + B1–B3 = 7 rows**, requiring `passed == total`, `blocked: 0`,
   `unperformed: 0`. S1–S5 are reported as carried-over prior acceptance **with the blob
   identity above proven** — never silently dropped.
4. **Dependency trees — record the deviation literally.** The harness deny-list blocks `npm ci`
   (measured on the `4c7c0bd9` build). Copying a junction-free dependency tree from the
   incumbent keeps the release isolated and junction-free (C02 §4) and is what the incumbent
   build did; record the literal commands and the copied tree's provenance.

Measured at review time: `D:` free **38.82 GiB** (warn below 25, fail closed below 15);
projected release footprint 1.43–1.86 GiB ⇒ ≈ 36.9 GiB after. The incumbent `4c7c0bd9` release
is startable in place — `atlas-server/dist/server.js`, `atlas-client/dist/index.html`,
`ops/runtime/cli.mjs`, `atlas-server/node_modules/.prisma/client/index.js` and the Windows
query engine are all present. Capture the incumbent's task XML **before** any mutation (C02
§5.2); rollback restores those bytes plus both machine-scope values and starts once via the
registered task. The executor shell is elevated (Administrator) at review time.

## 4. Part C — browser re-acceptance (QA custody)

Custody goes to the independent QA task; the planner releases the profile and QA closes it.
**Logins are authorized as needed** for this pass (operator, 2026-09-21) — **disclose every
login's `audit_logs` row**. Read-only: no Save, Apply, Generate, Publish or Delete, and **no
timetable cell click**.

1. **B1 (re-run)** — `/` on the new release still shows no "blocker" claim and a truthful SOFT
   warning count.
2. **B2 (the failing row, re-run)** — on a clean `/timetable` load: `/auth/me` exactly **1 per
   token epoch**, `runtime/context` **≤2**, `rollover-status` exactly **1 per
   `(schoolId, includeCounts)` key**. Record literal counts and how they were observed.
   **Amended sub-clause:** the original required "two cards asserted mounted", which is
   **unperformable on the live simple view — QA measured 0 `rollover-guidance-card` elements
   there**. Instead: locate a live state where two cards mount and assert it; if none exists,
   record the observed mount count and mark that sub-clause **not exercisable** with the reason.
   Do **not** weaken the primary assertion — it is decided by the observed counts plus the
   source-level control.
3. **B3 (re-run)** — no global scrollbar at `1366x768` on `/` and `/timetable`; console output
   recorded literally (the incumbent console baseline is not reproducible without disturbing
   5001/5174 — say so rather than inventing a comparison).

**Observations (not acceptance rows, cannot fail):** O1 — any 502's exact status/body/headers
(the layer is known to be host-side `UPSTREAM_UNREACHABLE`/`ECONNRESET`; no fix). O2 — duplicate
baseline outside the three named callers.

## 5. Acceptance — 12 mandatory rows

**Source (5) — committed client test scripts**
S1: two **sequential** same-epoch callers across `resolveActorSchoolId` **and**
`verifySessionToken` dispatch exactly **one** `/auth/me`; asserted on an instrumented counter,
with a failing-first control.
S2: a **token-epoch change** dispatches a new request and never serves the previous epoch's
value; logout/clear drops the memo.
S3: an authoritative **`401`/`403`** drops the memo and is not memoized; a rejected request is
not memoized.
S4: no behaviour drift — no new request, no rendered-output change, no request-parameter
change, no server change; no assertion deleted or weakened.
S5: the new/changed test file is reachable from a committed `atlas-client/package.json` script
in the same commit (`AGENTS.md` §11); client type-check passes; the committed client suites pass.

**Deployment (4) — decided by the deployed runtime, reproduced by post-action QA**
D1: release identity — installed HEAD and clean status, both machine-scope values, task
action/arguments/working directory, supervisor-state `releaseSha` (never `productPin`).
D2: ownership — one listener per port, both descending from the task-launched supervisor, task
properties intact.
D3: health, public term truth, warning protection — local/host/Tailnet health and a DB-backed
read; valid `termIndex` non-5xx term-scoped with typed `400` on malformed; unauthenticated
violation routes 401.
D4: served-artifact identity, configuration, zero write — served HTML and every referenced asset
matching the built manifest with the **new entry chunk differing from the incumbent's**; env
bytes and key set unchanged; SMART/AIMS inactive with typed 503s; signature map byte-identical;
`D:` recorded before and after the build.

**Browser (3 mandatory) — QA pass on the new release**
B1: dashboard truth as §4.1, literal strings recorded.
B2: the corrected request counts as §4.2, recorded literally, with the amended sub-clause
resolved honestly.
B3: no regression as §4.3.

`ACCEPT_READY` requires **12/12 passed, blocked 0, unperformed 0**, with O1/O2 reported. A row
that cannot be performed is reported `BLOCKED`/`UNPERFORMED` with its reason.

## 6. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the decisive
commands with results, the 12 rows each with its own result, the literal request counts, the
failing-first output, every login's audit row, the recorded `D:` figures, rollback status, and
risks marked `BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.
