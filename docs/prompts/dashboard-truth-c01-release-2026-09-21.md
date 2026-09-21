# DASHBOARD-TRUTH-C01 — one-shot: truthful dashboard blocker counts, deployed (the C03 deploy cycle)

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization (`AGENTS.md`
§13). One cycle: a bounded client truthfulness correction, the release build that also carries
the already-integrated `DUP-READ-CALLERS-C01` fix, and browser acceptance with QA custody.

Risk: **MEDIUM** source (displayed truth only) with **HIGH** deployment.

Base: the `origin/main` tip in the dispatch prompt (expected `cf0f4b3e` or later). Incumbent
and rollback basis: the release live when the executor starts (expected `434b2a81`; rollback
basis `5f5c6c4f` retained and startable).

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 0. Preconditions

- **Capacity.** `D:` now holds **40.76 GiB** after the 2026-09-21 worktree reclaim. The deploy
  boundary's precondition 4 still applies verbatim: record `D:` free **before**, the projected
  release footprint, and free **after** — fail closed below **15 GiB**. At the measured figure
  this is satisfiable; do not copy the number, re-measure.
- **Custody.** `atlas-server/**` belongs to Lane B and Lane B is active. **This packet is
  client-only.** If the truthful fix turns out to require a server change, **stop and report**
  — do not edit `atlas-server/**`.
- Resolve `<sourceDir>` from the task action at execution; never assume PIDs or directory name.
  Only the active `ATLAS_RUNTIME_SOURCE_DIR` `supervisor-state.json` is authoritative; read
  `releaseSha`, never `productPin`. Read `docs/reference/agent-runtime-deploy-facts.md` before
  Part B.

## 1. Why — the measured defect

The Scheduling Dashboard tells the operator that a clean published run has **"335 review
blockers"**. The run has **zero HARD violations**; the 335 is the acknowledged SOFT warning
total. The number is not wrong — its label is.

- `atlas-server/src/services/dashboard-readiness.service.ts:415-436` — `countViolations`
  returns `summary.violationCount ?? summary.totalViolationCount`, else
  `hardViolationCount + softViolationCount`, else the **sum of every `violationCounts`
  bucket**. The dashboard payload's `violationCount`
  (`:869-878`, `generation.violationCount`) is therefore the **combined HARD + SOFT** total.
  This is the server's intended total metric; **it is not the defect and must not be changed.**
- `atlas-client/src/hooks/useDashboardData.ts:504` — `setViolationCount(summary.generation.violationCount)`.
- The client then presents that combined total as *blockers* in three places:
  - `atlas-client/src/pages/Dashboard.tsx:378` — readiness item hint
    `${violationCount} review blocker(s)`, and the same expression drives the item's
    `done` flag via `(violationCount ?? 0) === 0`;
  - `atlas-client/src/pages/Dashboard.tsx:318-319` — the lifecycle callout, `warn` and body
    both say "blocker(s)";
  - `atlas-client/src/pages/Dashboard.tsx:731` — the header tile, `${violationCount} review blocker(s)`.
- A truthful hard count **already exists client-side**:
  `useDashboardData.ts:535-549` populates `activeTermHardViolationCount` from
  `GET /generation/{schoolId}/{schoolYearId}/runs/latest/violations?termIndex=…`
  (`totalCount`, else `violations.length`), and `Dashboard.tsx:451-454` already renders it
  under the correct label **"Hard violations"**.

**Therefore the fix is client-only: stop labelling a combined total as blockers.**

The executor must first **verify** (read-only) that `runs/latest/violations` is genuinely
HARD-only — read its route and service and cite the line. If it is not hard-only, or if no
truthful hard-only count is reachable without a server change, **report `BLOCKED`** with the
observed shape rather than inventing a number.

## 2. Part A — the source change

**Authorized paths (positive list — nothing else):**

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/hooks/useDashboardData.ts` (only if the count must be sourced differently)
- new/changed tests under `atlas-client/src/lib/__tests__/` and `atlas-client/src/hooks/__tests__/`
- `atlas-client/package.json` — **test-script entries only**
- evidence under `docs/reviews/dashboard-truth-c01/`

Out of bounds: `atlas-server/**`, `ops/**`, `prisma/**`, the root `package.json`, every `.env`,
`D:\ATLAS-runtime-config\**`, `AGENTS.md`, `CHANGELOG.md`, `docs/plans/live-state.md`, and
every runtime release directory.

### A1 — blocker language must mean HARD only

Replace the combined `violationCount` at the three sites above with a HARD-only count (prefer
the existing `activeTermHardViolationCount`). Where a truthful hard count is **unavailable**,
the surface must say so — `null` must never be rendered as `0` blockers and must never read as
"clean".

### A2 — the SOFT total is stated truthfully or not at all

The acknowledged SOFT warnings may be shown, but **only** as warnings (for example
"335 warnings acknowledged"), never as blockers. Do not silently drop the operator's warning
information.

### A3 — the readiness step's `done` flag

`Dashboard.tsx:378` currently marks "Timetable generated and reviewed" incomplete whenever the
combined total is non-zero, so acknowledged SOFT warnings alone leave a step unfinished.
Decide the intent from the surrounding semantics and **state the decision in the evidence**;
whichever way it goes, a run with zero HARD must not be described as blocked.

### A4 — additive evidence, no behaviour drift

No new network request, no change to what any count means server-side, no change to
generation/publication behaviour. Corrections are additive: never delete or weaken an existing
assertion.

### A5 — proof shape

The tests must render/exercise the real surfaces with a fixture of **0 HARD / 335 SOFT** and
assert the **resulting strings** — not that a handler was called. A control that fails on the
pre-fix code is required (failing-first).

### A6 — checkpoint

Commit the source change and the evidence separately; never amend a reported commit.

## 3. Part B — deployment

**Target pin: the accepted candidate commit of this cycle**, built into
`D:\ATLAS-runtime-supervised-<candidate-sha>-20260921`. The release carries **both** this
cycle's dashboard fix **and** the already-integrated `DUP-READ-CALLERS-C01` client fix, so both
sets of browser rows become performable.

Reuse `CURRENT-SOURCE-LIVE-DEPLOY-C02`'s frozen boundary, preconditions, authorized mutations
and rollback section unchanged in structure, including precondition 4's before/projected/after
`D:` figures and the 15 GiB floor. No environment byte changed, SMART/AIMS inactive, no
migration or database write, ports 5001/5174 only, elevated executor, single start via the
registered task. Prove the deploy with the **new entry chunk** differing from the incumbent's.
Schema-wide signature map byte-identical using the C01 addendum's SQL verbatim (`SET TIME ZONE`
pinned). The release is client-only; the server rebuild must not change server behaviour. Carry
the known `cli.mjs status` `live:false` bug: listener ownership, supervisor state and HTTP
probes are authoritative.

## 4. Part C — browser acceptance (custody with QA)

**Custody goes to the independent QA task**; the planner releases the shared profile and QA
closes it. One authorized login expected — **disclose its `audit_logs` row**. Read-only: no
Save, Apply, Generate, Publish or Delete, and **no timetable cell click**.

1. **Dashboard truth (this cycle).** On `/`, with the published run that has zero HARD
   violations: no surface claims "review blockers"; any SOFT figure is labelled as warnings.
   Record the literal strings rendered.
2. **Deferred `DUP-READ-CALLERS-C01` rows — now performable.** On a clean load of
   `/timetable`: `/auth/me` exactly **1 per token epoch**, `runtime/context` **≤2**, and
   `rollover-status` exactly **1 with two cards asserted mounted in the same step**. Record the
   literal counts.
3. **No regression.** `/` and `/timetable` render with no global scrollbar at `1366x768`, and
   console errors are compared against the **named incumbent build's** baseline.
4. **Observation — the 502 lead.** If a 502 occurs, capture that response's exact status, body
   and headers. Fix nothing.
5. **Observation — dedup baseline** outside the three named callers. Fix nothing.

## 5. Acceptance — 12 mandatory rows

**Source (5) — decided by the committed client test scripts**
S1: the three dashboard surfaces use a HARD-only count for blocker language; with a
0 HARD / 335 SOFT fixture **no surface renders a "blocker" claim** — asserted on the rendered
strings, with a failing-first control.
S2: the SOFT total is shown truthfully as warnings or omitted; the combined total is never
labelled as blockers.
S3: the "Timetable generated and reviewed" step is not described as blocked on zero HARD; the
intent decision is recorded in the evidence.
S4: no behaviour drift — no new request, no change to counts' meaning, no server change; no
assertion deleted or weakened.
S5: the new/changed test file is reachable from a committed `atlas-client/package.json` script
in the same commit (`AGENTS.md` §11); client type-check passes; the committed client suites
pass.

**Deployment (4) — decided by the deployed runtime; reproduced by post-action QA**
D1: release identity — installed HEAD and clean status, both machine-scope values, task
action/arguments/working directory, supervisor-state `releaseSha` (never `productPin`).
D2: ownership — one listener per port (5001/5174), both descending from the task-launched
supervisor, task properties intact.
D3: health, public term truth and warning protection — local/host/Tailnet health and a
DB-backed read; valid `termIndex` non-5xx and term-scoped with typed `400` on malformed input;
unauthenticated violation routes 401.
D4: served-artifact identity, configuration and zero write — served HTML and every referenced
asset matching the built manifest, with the **new entry chunk differing from the incumbent's**;
env bytes and key set unchanged; SMART/AIMS inactive with typed 503s; schema-wide signature map
byte-identical; `D:` free recorded before and after the build.

**Browser (3 mandatory) — decided by the QA browser pass on the deployed release**
B1: dashboard truth, §4.1, with the literal strings recorded.
B2: the deferred `DUP-READ-CALLERS-C01` request counts, §4.2, recorded literally with two cards
asserted mounted.
B3: no regression, §4.3, with the viewport and the named console baseline.

**Observations (not acceptance rows, cannot fail):** O1 the 502 lead's exact
status/body/headers; O2 the dedup baseline outside the three callers.

`ACCEPT_READY` requires **12/12 passed, blocked 0, unperformed 0**, with O1/O2 reported.
A row that cannot be performed is reported `BLOCKED`/`UNPERFORMED` with its reason. The
deployment must not be called accepted on rows QA did not reproduce.

## 6. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the decisive
commands with results, the 12 rows each with its own result, the literal rendered strings and
request counts, the hard-count provenance line (route + service), the login disclosure, the
recorded `D:` figures, rollback status, and risks marked `BLOCKING`/`NON_BLOCKING`. No
transcripts, secrets or database rows.
