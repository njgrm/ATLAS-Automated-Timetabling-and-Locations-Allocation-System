# FACULTY-SYNC-PUBLICATION-CAS-C01 — CAS-guard the routine-sync published-run transition

ROLE: EXECUTOR (single lane of the operator-activated cycle
`FACULTY-SYNC-PUBLICATION-CAS-C01`).

## 0. Immutable boundary

- Base SHA (frozen): `544bbf81d087098f9b5f28b9f598311f19c5288d` — the accepted
  `origin/main` tip at dispatch. `origin/main` moved once during planner startup
  (from `61efa8a1b4ba4598e25f7d37909f88a5b94a66b2` to `544bbf81`, the
  `WF-TRANSITION-TERMINAL-RECONCILE-C09` registration). That delta is
  docs/register-only — `git diff --stat 61efa8a1 544bbf81 -- atlas-server
  atlas-client prisma` is empty — so the product tree is byte-identical and the
  defect analysis below is unchanged. This worktree was fast-forwarded to
  `544bbf81`. Before editing, re-run `git fetch origin` and confirm `origin/main`
  still contains this base. If it moved again, stop and report; do not
  self-advance the base.
- Worktree: `E:/ATLAS-worktrees/faculty-sync-cas-c01` (created clean at the base;
  `git status --porcelain=v2` was empty at authoring).
- Branch: `fix/faculty-sync-publication-cas`.
- **Additive commits only.** Never amend, rebase, or force-push.
- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608A330AF5440A6E0EA1FFADE20987B49A7BB0D939F3B50F1AA2DF0A3`
  (reproduced twice on 2026-09-17 over raw and LF-normalized bytes, which are
  byte-identical for this blob). Read `AGENTS.md` from this worktree or from
  `origin/main`.
  **Do not trust `D:/ATLAS/AGENTS.md`** — it is an older copy missing at least
  two mandatory rules ("prove producer-to-consumer parity and unknown-value
  conservation" and the sibling-feed scope-epoch extension).
  Planner observation for the register: the predecessor packets
  `docs/prompts/published-immutability-c08r1-2026-09-16.md` and
  `docs/prompts/tt-warning-surface-c07b-2026-09-16.md` cite directive pin
  `ffd14520…`, which does **not** reproduce at `c950e694` or `61efa8a1` even
  though `AGENTS.md` is byte-identical across those bases. That is a
  packet-authoring defect in those prompts, not a directive change; the value
  above is the reproducible one.
- Risk tier: `MEDIUM` (server source + tests only). Publication and generation
  remain `HIGH`-gated. Nothing in this packet is a live action.
- Recommended reasoning: `high` (not `max`).
- Dependency tree: this worktree has no `node_modules`. Isolated install only:
  `npm ci` in `atlas-server` and `atlas-client` (root only if a required tool is
  genuinely missing). No verified `.deps-<sha>` shared install exists at this
  base and no junction reuse is authorized — do **not** point a junction at
  another worktree's or `D:/ATLAS`'s dependency tree, and never run an install
  through a junction. Capacity recorded by the planner at authoring: `E:` free
  74.30 GiB (warn 25 GiB, fail 15 GiB). Cleanup owner: primary planner; the tree
  retires with the worktree after integration.

## 1. Origin of this correction (HISTORICAL)

The fresh Wave Completion Auditor over the integrated C08 wave returned
`AUDIT_CLEAR` (8/8/0/0) but recorded two non-blocking residuals in
`docs/reviews/published-immutability-c08r1/wave-completion-audit.md`:

- **F1** — `invalidateStaleCompletedRuns` writes after an out-of-transaction
  `findMany` (`generation.service.ts:1593-1601`) with an unguarded
  `update where { id }` in the drift branch (`:1647-1650`) and the destructive
  branch (`:1678-1681`). A concurrent `publishSchedule` can be clobbered by a
  stale copy. Registered successor: `FACULTY-SYNC-PUBLICATION-CAS-C01`.
- **F2** — `timeToMinutes` coerces non-finite components to `0`
  (`published-identity-snapshot.service.ts:196-199`) while the producer
  (`schedule-constructor.ts:1360-1363`) yields `NaN`. Folded into F1 as a
  hardening row.

The operator activated exactly this successor under `CYCLE ON`. F3 (live
listener/PID drift) and F4 (`faculty.router.ts` body-derived school scope) are
owned by other streams and are **out of scope** here.

## 2. Current-state defect (CURRENT_STATE)

`invalidateStaleCompletedRuns(schoolId, schoolYearId)` (`atlas-server/src/services/generation.service.ts:1649-1742`):

1. Reads candidates **outside** any transaction with
   `select: { id, schoolYearId, status, draftEntries, summary }` — `version` is
   **not** selected, so no write can be bound to the read snapshot.
2. Inside `db().$transaction(async (tx) => { ... })` (default isolation, no
   advisory lock) writes per run with `tx.generationRun.update({ where: { id: run.id }, ... })`:
   - published-marker branch: replaces `summary` with a copy-through snapshot
     taken before the transaction;
   - destructive branch: `{ status: 'FAILED', error: 'INVALIDATED_BY_MIRROR_RESET' }`.
3. Returns `invalidatedCount: staleRunIds.length`, which counts *classified*
   runs, not *invalidated* runs.

Two concrete harms a concurrent `publishSchedule` (`publication-contract.service.ts`)
can cause. `publishSchedule` is the only writer that advances `GenerationRun.version`
**as part of the publication transition** (`:342-354` prior-run retire CAS,
`:415-419` run CAS, both `version: { increment: 1 }`). Two other services advance
the same field, each already behind its own CAS predicate and therefore outside
this defect: `timetable-sync-setup.service.ts:849-856` (`where { id, version:
expectedRunVersion }`, explicit `version: nextVersion`) and
`timetable-teaching-load-repair.service.ts:1204-1211` (`where { id, version:
expectedVersion }`, explicit `version: newVersion`). Routine sync is therefore
the only writer that both advances nothing and asserts nothing, which is exactly
why it can clobber a publication:

- **Un-publish / resurrection:** sync classifies a currently published run `R`
  (version `N`) as stale; `publishSchedule` retires `R` (version `N` → `N+1`,
  `isPublished: false` + `publicationSuperseded*`) while publishing another run;
  the sync then overwrites `summary` with its stale copy-through and restores
  `isPublished: true`. Two `isPublished: true` runs in one school/year make
  published reads/exports fail with `409 PUBLISHED_RUN_AMBIGUOUS` — the exact
  regression the C08 wave audit B2 closed.
- **Orphan:** sync classifies an unpublished `COMPLETED` run `R` (version `N`)
  as stale; `publishSchedule` publishes `R` (`N` → `N+1`, `isPublished: true`,
  a `PublishedScheduleRevision` row bound to `R`); the sync then sets
  `status: 'FAILED'`, orphaning the revision and its published read path.

`GenerationRun.version Int @default(1)` already exists (`prisma/schema.prisma:792`).
No migration is needed or permitted.

## 3. Required corrections

### R1 — version CAS on every write in the routine-sync path

In `invalidateStaleCompletedRuns`:

1. Add `version: true` to the classification `select`.
2. Replace both branch writes with compare-and-swap `updateMany` calls whose
   predicate includes the classified `version` (and the pinned status where a
   status is asserted), e.g.
   `where: { id: run.id, schoolId, schoolYearId, version: run.version }`.
3. Require `count === 1`. A `count !== 1` result is a **concurrent change**: the
   run must not be written. It must produce a typed outcome and exactly one audit
   row (see R2). Never retry blindly inside the same call.
4. Drift branch (published markers): CAS **without** incrementing `version`, so
   the committed C08 assertion "published run version is preserved through drift"
   (`published-immutability-c08.test.ts:692`) stays true.
5. Destructive branch: CAS **with** `version: { increment: 1 }` and the predicate
   pinned to `status: 'COMPLETED'`, so the `COMPLETED → FAILED` transition is
   version-visible and cannot be applied to a run that already changed status.
6. Keep the write inside the existing `db().$transaction`. The CAS predicate is
   re-evaluated under the row lock, which is the transaction-bound re-validation;
   do not add a separate advisory lock (out of scope) unless you can show a
   concrete gap the CAS does not close — if so, justify it in the handoff.

### R2 — typed, audited successor condition instead of an erased record

1. Add a typed outcome list to the returned object (naming is yours; suggested
   `concurrentChangedRunIds`) containing exactly the runs whose CAS missed.
2. Create **exactly one** audit row per CAS miss, with a new distinct action
   (suggested `GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED`) carrying
   `runId`, the classification's `observedVersion`, the reason, and the detected
   timestamp. Do not reuse `GENERATION_RUN_PUBLICATION_DRIFT_DETECTED` for this
   outcome, so per-run drift audit counts stay exactly one as the C08 suite
   asserts.
3. Make the counters truthful: `invalidatedCount` must equal the number of runs
   actually set `FAILED`, not `staleRunIds.length`. Keep `staleRunIds` as the
   classified set (existing callers depend on its meaning) and document the
   distinction in the return type and the progress ledger.
4. Keep `faculty.service.ts`'s declared result shape type-safe: if you widen the
   `invalidatedRuns` field, widen its declared type — no `any`/`as never` casts.
   Server-only is the expected blast radius; a client change is authorized only
   if you first prove a client consumer of `invalidatedRuns` renders a false
   statement, in which case add a bounded control for it.
5. Replay idempotency: running the sync twice with no input change must produce
   no second destructive write and no duplicate skip/drift audit for the same
   run.

### R3 — F2 interval hardening on the same source boundary

In `published-identity-snapshot.service.ts`, make the frozen-snapshot interval
gate fail closed instead of coercing: `timeToMinutes` must return
`Number.NaN` for any non-finite component (mirroring
`schedule-constructor.ts:1360-1363`) so that containment is false for a
malformed window and the existing typed contradiction
(`EVENT_INTERVAL_MISSING` / `SPECIAL_EVENT_SLOT_UNBACKED`) is what surfaces.
A partial/non-numeric interval such as `"07:xx"` must never be silently read as
`420`. Keep `assertSnapshotConsistency`'s public behaviour, the 422 code, and
zero-write-on-rejection unchanged.

### Preserved behaviour (assert, do not regress)

Run-wide zero-hard-blocker gate; actor-school authorization; the
`Serializable` transaction + advisory lock + prior-run retire CAS + run CAS +
single publication audit + post-commit-only notification in
`publication-contract.service.ts`; replay idempotency; draft/published
separation; `PublishedScheduleRevision` effective-date and supersession
behaviour. `publication-contract.service.ts` must not be modified: prove that by
including it in the unchanged-path evidence and by asserting, through the real
`publishSchedule`, exactly one `GENERATION_RUN_PUBLISHED` audit row and exactly
one revision row per publication in the interleave controls.

### Writer inventory (mandatory, AGENTS.md production-shape rule 9)

Produce a reachability-classified inventory of every writer of
`generation_runs.status` / `summary.isPublished` / published markers, at minimum:
`invalidateStaleCompletedRuns` (routine sync; callers `faculty.service.ts:768`
and `scripts/seed-realistic.ts:628`), `publication-contract.service.ts:342,415`
(already CAS), `timetable-sync-setup.service.ts:849`,
`timetable-teaching-load-repair.service.ts:1204`, and
`reconcileInvalidPublishedRunStates` (`generation.service.ts:125-190`, which has
**no caller** in the repository — prove that by search and record it as a
reachable=false observation, not a fix). A reachable routine-sync writer without
a guard must be included in R1; an unreachable one is recorded with its search
evidence.

Planner-verified pre-facts for that inventory (re-checked at `544bbf81`; the
product tree is byte-identical back to `61efa8a1`):

- `reconcileInvalidPublishedRunStates` (`generation.service.ts:125`) has **zero
  callers**. The only repository hits for its name are the definition itself and
  a narrative mention in
  `docs/reviews/tt-source-freshness-c04-20260914/wave-completion-audit.md`. It is
  an **inventory row only** and is **NOT part of this fix**. Its inner write at
  `generation.service.ts:161` (`update where { id: run.id }`, no version
  predicate) is reachable=false and must not be guarded here.
- The repair in this packet is exactly **(a)** the two unguarded writes in
  `invalidateStaleCompletedRuns` at `generation.service.ts:1703-1706` (drift
  branch, no version predicate) and `:1734-1737` (destructive branch, no version
  predicate and no pinned `status`), plus **(b)** the `invalidatedCount`
  over-report at `:1741` (`staleRunIds.length` counts classified runs, not
  invalidated runs). Nothing else in this packet is the defect.
- Writers that advance `GenerationRun.version`: `publication-contract.service.ts`
  (`:343`/`:351` retire CAS, `:416`/`:417` run CAS, both `{ increment: 1 }`),
  `timetable-sync-setup.service.ts:849-856`, and
  `timetable-teaching-load-repair.service.ts:1204-1211`; the latter two are
  already CAS-guarded. `invalidateStaleCompletedRuns` advances nothing, so it
  must gain the CAS.
- The routine-sync caller is `faculty.service.ts:768`, whose declared result
  shape is `invalidatedRuns: { invalidatedCount: number; staleRunIds: number[] }`
  (`faculty.service.ts:58`, with the empty fast-path at `:533`).
- The CAS field already exists: `prisma/schema.prisma:792` `version Int
  @default(1)` on `model GenerationRun` (model opens at `:777`). **No migration is
  needed or permitted.**


## 4. Mandatory failing-first controls

- **C-A (un-publish/resurrection interleave).** Real fixture: run `R` is
  `COMPLETED` + published via the **real** `publishSchedule` (real revision row,
  real audit). Make `R` stale (deactivate a faculty member it references).
  Interleave the **real** `publishSchedule` of a second `COMPLETED` run `R2`
  between the sync's classification read and its write phase, using the
  deterministic injection seam below. Assert: `R` stays `isPublished: false`
  with its `publicationSuperseded*` pointers intact; exactly one run is
  `isPublished === true`; no `PUBLISHED_RUN_AMBIGUOUS` on the published read;
  zero non-CAS writes for `R`; typed outcome contains `R`; audit delta for the
  new skip action is exactly 1 for `R`.
- **C-B (orphan interleave).** Real fixture: run `R` is `COMPLETED` +
  unpublished and stale. Interleave the **real** `publishSchedule(R)` between
  classification and write. Assert: `R.status` is never `FAILED`; its revision
  still resolves through the real published read; `isPublished === true`
  survives; zero destructive writes for `R`; typed outcome contains `R`; skip
  audit delta exactly 1.
- **C-C (genuine invalidation preserved — over-blocking control).** An
  unpublished stale `COMPLETED` run with no interleave must still become
  `FAILED` with `error: 'INVALIDATED_BY_MIRROR_RESET'`, and `invalidatedCount`
  must equal the number of runs actually set `FAILED`.
- **C-D (R3 hardening).** A frozen snapshot carrying a non-numeric/partial
  interval is rejected with the typed contradiction rather than silently
  coerced; assert directly against the producer's `NaN` semantics.
- **Deterministic interleave seam.** Add one optional injected dependency to
  `invalidateStaleCompletedRuns`, defaulting to production behaviour, invoked
  after the classification read and before the write transaction — mirroring the
  established `PublicationDependencies` pattern in
  `publication-contract.service.ts`. Default `undefined` must be byte-equivalent
  to today's behaviour; only the committed test supplies the hook.

## 5. Gates — exactly 14 `MANDATORY_SOURCE` rows, 0 `MANDATORY_LIVE`, 0 `DEFERRED_EXTERNAL`

| # | Gate |
|---|---|
| 1 | New suite `atlas-server/src/__tests__/faculty-sync-publication-cas-c01.test.ts` green on a provisioned disposable PostgreSQL database, exercising the **real** `publishSchedule`, the **real** `invalidateStaleCompletedRuns`, and the real faculty-sync service path |
| 2 | Control C-A green (un-publish/resurrection interleave; typed outcome + audit delta) |
| 3 | Control C-B green (orphan interleave; typed outcome + audit delta) |
| 4 | Control C-C green (genuine invalidation preserved; truthful `invalidatedCount`) |
| 5 | R1 mutant: the CAS predicate removed → controls C-A **and** C-B FAIL; source restored byte-exactly with blob-hash proof |
| 6 | R2 replay/idempotency control: second sync no-ops, no duplicate audit, no destructive write |
| 7 | Control C-D green (R3 fail-closed interval parity with the producer) |
| 8 | R3 mutant: the `: 0` coercion restored → C-D FAILS; source restored byte-exactly with blob-hash proof |
| 9 | Existing `published-immutability-c08.test.ts` green with **no assertion removed** (report `check(`/`checkEqual(` call-site counts at base and tip) |
| 10 | `faculty-sync-reconciliation.test.ts` green (routine sync regression) |
| 11 | `run-resolver-contract.test.ts`, `publication-contract-readiness.test.ts`, `publication-contract-postgres-concurrency.test.ts` green on disposable PostgreSQL with zero residue |
| 12 | `npm --prefix atlas-server run build` (tsc) exit 0 |
| 13 | Built-server startup: `node atlas-server/dist/server.js` boots on an isolated port, serves `/api/v1/health` 200, then terminates cleanly; include explicit `.js` runtime-import proof on the emitted `dist` for every changed server module |
| 14 | `git diff --check` clean; `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json` exit 0; disposable-DB zero-residue proof; honest worktree status |

## 6. Boundaries

No live login, deployment, restart, runtime/port/task/env change, shared or live
database write, generation, publication, migration, schema change, or companion
edit. Companion repositories are READ_ONLY. Disposable databases only, dropped
with zero residue. Do not edit the living register,
`docs/plans/atlas-delivery-cycles.json`, `phasePlan.md`, or `CHANGELOG.md`. **In
particular, do not write to `docs/plans/atlas-delivery-cycles.json` or
`docs/plans/atlas-active-delivery-streams.generated.md` for any reason:** the
`WF-TRANSITION-TERMINAL-RECONCILE-C09` cycle executed a revision-exact nine-step
register repair on the same document authority (base revision 218, declared
revision window 218–227, planner lifecycle through 233) and has closed its window
by reaching `INTEGRATED`. Every register write for this cycle is owned by the
primary planner and is CAS-serialized. Do not
modify `publication-contract.service.ts`. Do not add validators, frameworks, or
documentation beyond the one progress ledger.

## 7. Return contract

Commit additively on `fix/faculty-sync-publication-cas`. Write
`docs/handoffs/faculty-sync-publication-cas-c01-executor.md` (progress ledger +
handoff) as part of the candidate, then return `REVIEW_REQUIRED` with:

1. base SHA, candidate SHA, exact changed-path list;
2. the 14-row trace table `requirement -> production path -> negative control -> verification command`, every row marked PASS / BLOCKED / DEFERRED;
3. both mutant results with the byte-exact restore proof (before/after blob hashes and an empty `git diff` for the mutated path);
4. the audit-count deltas per control and the typed outcome field names;
5. the writer inventory with per-row reachability evidence;
6. one compact `production-shape parity` row naming the real producer, real consumer, conservation totals, negative control, and result;
7. the disposable-DB cleanup proof and an honest `git status --short` statement (state plainly if the worktree is not clean);
8. a claim-discipline table classifying each material claim as REQUIREMENT / CURRENT_STATE / SUCCESSOR / HISTORICAL.

Do not self-accept, merge, or push. Return `REVIEW_REQUIRED` only.

## 8. PLANNER AMENDMENT A1 (2026-09-17, primary planner)

This section is part of the packet. Read it before §0. Where A1 and §0-§7
disagree, **A1 controls**. Everything in §0-§7 not amended below still stands.

### A1.1 Base re-pin: `16e70be2a01bf815447ee323f13e775bb825ad4f` (supersedes §0)

`origin/main` moved again after this packet landed (`544bbf81` ->
`16e70be2`, the `WF-TRANSITION-TERMINAL-RECONCILE-C09` closure). Per §0's own
instruction the base is not self-advanced by the executor; the **planner** has
re-pinned it. Evidence, independently reproduced by the planner at `16e70be2`:

- `544bbf81` is an ancestor of `16e70be2`.
- `git diff --name-only 544bbf81 16e70be2 -- atlas-server/src atlas-client/src
  prisma` is **empty**: every product source path is byte-identical, so §2's
  defect analysis and every §2/§3 line anchor hold unchanged.
- The only `atlas-server` path that differs is `atlas-server/.env.example`
  (2 lines removed: the stale `ATLAS_DEFAULT_SCHOOL_ID=1` example). It is
  outside this packet's boundary and irrelevant to it.
- Anchor blob identity at **both** bases: `generation.service.ts`
  `e5d4f2c24653fd3b673cb089ef7165391411c84f`,
  `published-identity-snapshot.service.ts`
  `bacb74fb582557dc37fe346945ce890777db2678`, `publication-contract.service.ts`
  `76603edab27c08eead86f2ad4c9ca6986b84689f`,
  `published-immutability-c08.test.ts`
  `7714aed0b919c1ce12778f8e19f680d63def09c1`, `prisma/schema.prisma`
  `8af558844d5a09bd9a1c70aa81d5fb619d870fa8`.
- The cycle worktree `E:/ATLAS-worktrees/faculty-sync-cas-c01` was
  fast-forwarded by the planner from `544bbf81` to `16e70be2` and is clean
  (`git status --porcelain=v2` empty; branch `fix/faculty-sync-publication-cas`).

**Base for this candidate is `16e70be2`.** Re-verify before editing:
`git merge-base --is-ancestor 16e70be2 HEAD` must succeed. If `origin/main` has
moved again, stop and report — do not self-advance.

The §0 directive pin is re-confirmed and unchanged: `origin/main:AGENTS.md`
blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`, raw and LF-normalized SHA-256
`7663164608A330AF5440A6E0EA1FFADE20987B49A7BB0D939F3B50F1AA2DF0A3`
(planner re-derived from Git bytes: 171055 bytes, 0 CR). Read `AGENTS.md` from
this worktree or from `origin/main`; never trust `D:/ATLAS/AGENTS.md`.

### A1.2 Inventory row confirmed: the repair set is bounded

`reconcileInvalidPublishedRunStates` (`generation.service.ts:125-190`) has
**zero callers** — planner-verified by
`git grep -n reconcileInvalidPublishedRunStates` (only its own definition plus
prose mentions in two documents). It is an **inventory row with
`reachable=false`, NOT part of this fix**. Its inner write at `:161` must be
left exactly as it is.

The repair is exactly:

1. the unguarded drift-branch write at `generation.service.ts:1703-1706`;
2. the unguarded destructive-branch write at `generation.service.ts:1734-1737`
   (no version predicate and no pinned `status`);
3. the `invalidatedCount` over-report at `:1741`;
4. **planner-added R2.3b** (A1.6 below): `unpublishedRunIds` truthfulness.

### A1.3 Corrected writer inventory (replaces §3's prose enumeration)

- `publishSchedule` (`publication-contract.service.ts:342-354` retire CAS and
  `:415-419` run CAS) is the **sole version-advancer inside the publication
  transition**; both use `version: { increment: 1 }`.
- `timetable-sync-setup.service.ts:849-856` and
  `timetable-teaching-load-repair.service.ts:1204-1211` also advance
  `GenerationRun.version` and are **already CAS-guarded**.
- Routine sync (`invalidateStaleCompletedRuns`) is the **only** writer that
  advances nothing and asserts nothing — which is why it can clobber a
  publication. That is the whole defect.

Record this corrected inventory in the handoff; it is the authoritative form.

### A1.4 Lease registration: the separate `lease-update` step is DROPPED

`create-stream` accepts `--lease-id/--lease-role/--lease-session/--lease-worktree`
and appends exactly one `ACTIVE` lease in the **same atomic transition**.
Registering the stream and then also running `lease-update` would double-create
a lease, so the planner runs `create-stream` with the lease flags and performs
**no** separate lease transition. Nothing is required from the executor here;
this is recorded so the register lineage is not misread later.

### A1.5 Gate-10 / gate-11 satisfiability correction (planner-verified)

Two mandatory rows named suites that **do not exist** at `16e70be2`:

- `atlas-server/src/__tests__/faculty-sync-reconciliation.test.ts` — absent;
- `atlas-server/src/__tests__/run-resolver-contract.test.ts` — absent.

`atlas-server/package.json` still declares `test:faculty-sync-reconciliation`
and `test:run-resolver-contract` pointing at those non-existent files; 34 of the
legacy `src/__tests__/*.test.ts` script targets are dangling in total. Those
rows were unsatisfiable as written. They are **re-pointed, not reduced** — the
gate plan stays exactly **14 `MANDATORY_SOURCE` / 0 `MANDATORY_LIVE` /
0 `DEFERRED_EXTERNAL`**:

- **Gate 10** becomes **control C-E**: drive the **real routine-sync caller
  path** `syncFacultyFromExternal` (`faculty.service.ts:494`, which reaches the
  guarded write at `:768`) hermetically. Set `FACULTY_ADAPTER=stub` and
  `SECTION_SOURCE_MODE=stub` **before** the module import (both factories have
  committed stub implementations and are read at import time). Assert:
  (i) the returned `invalidatedRuns` counters are truthful against the database
  (`invalidatedCount` == runs actually set `FAILED`);
  (ii) no published run is un-published or set `FAILED`;
  (iii) the real published read still resolves exactly one candidate (no
  `409 PUBLISHED_RUN_AMBIGUOUS`);
  (iv) `unpublishedRunIds` / `driftedPublishedRunIds` match the database.
  No network and no live database. Seed the disposable fixture so the stub
  reconciliation genuinely reaches the invalidation gate (a fixture faculty
  absent from `STUB_FACULTY` yields `deactivatedCount > 0`, which is what makes
  `shouldInvalidateRuns` true).
- **Gate 11** becomes `publication-contract-readiness.test.ts` **plus**
  `publication-contract-postgres-concurrency.test.ts` on a real disposable
  PostgreSQL database. Coverage does not drop: `resolvePublishedRun` and the
  published-revision effective-date/CAS/chain behaviour are asserted by the
  readiness suite. Binding facts for the concurrency suite:
  it hard-requires `process.env.DATABASE_URL`'s database name to equal
  `process.env.PUBC01R_DISPOSABLE_DATABASE`, with both matching
  `/^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/`. `provisionDisposableDatabase`
  satisfies that pattern **only when the suffix is alphanumeric** (hyphens fail
  the guard). Set both variables from the harness's `name`/`targetUrl` for that
  suite only, and drop the database in `finally` with zero-residue proof.

**`atlas-server/package.json` must NOT be edited.** The dangling legacy scripts
are pre-existing residue, they are not this packet's repair, and repairing them
is out of scope.

### A1.6 Planner-added requirement R2.3b — `unpublishedRunIds` truthfulness

In the destructive branch, push `run.id` to `unpublishedRunIds` **only when the
CAS `count === 1`**. Justification, so this is auditable rather than assumed:

- It is the **same return statement** §3 R2.3 already requires the executor to
  rewrite for `invalidatedCount`, in the same function and the same write loop.
- §3 R2.3's headline requirement is "make the counters truthful". Today
  `unpublishedRunIds` is initialised at `:1672` and **never pushed to**, so it
  always returns `[]` even when the destructive path does write. That is the
  same defect class the row names.
- It is **provably non-breaking**: `git grep -n unpublishedRunIds` finds only
  the two C08 assertions at `published-immutability-c08.test.ts:696` and `:720`,
  and both assert only `!unpublishedRunIds.includes(<published|superseded run>)`
  — assertions that stay true because those runs take the drift branch, never
  the destructive one.
- It is one line inside a statement the executor must change anyway, so the
  marginal cost is ~zero and it forecloses a future correction round.

Assert the truthful value inside control C-C. Do not retitle or re-scope any
other §3 requirement.

### A1.7 Boundary clarifications (the operator's boundary is controlling)

Owned and permitted paths — **nothing else**:

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/published-identity-snapshot.service.ts`
- **one new** test file `atlas-server/src/__tests__/faculty-sync-publication-cas-c01.test.ts`
- the mandated ledger/handoff
  `docs/handoffs/faculty-sync-publication-cas-c01-executor.md`

- **Do not edit `atlas-server/src/services/faculty.service.ts`.** §3 R2.4's
  "if you widen the `invalidatedRuns` field, widen its declared type" is
  satisfied **without** an edit: `faculty.service.ts:58` declares the structural
  subset `{ invalidatedCount: number; staleRunIds: number[] }`, and a wider
  return object is assignable to it because the value is a variable, not an
  object literal — TypeScript applies no excess-property check. If `tsc`
  nonetheless fails for that reason, mark the row **BLOCKED** with the exact
  compiler error and return; do **not** edit outside the owned set and never
  use `any` / `as never`.
- Do **not** modify `publication-contract.service.ts`; prove its unchanged-ness
  in the handoff as §3 requires.
- **Mutually exclusive C11 lane (forbidden here):**
  `warning-window-authority.service.ts`, `constraint-validator.ts`,
  `manual-edit.service.ts`, `generation-preflight.service.ts`,
  `pre-generation-draft.service.ts`, `generation-input-snapshot.service.ts`.
  The `SLOT-BREAK-AUTHORITY-C11` packet forbids `generation.service.ts` and
  `published-identity-snapshot.service.ts`, so the two lanes share no file.
- **Forbidden:** `docs/plans/**`, `ops/workflow/**`, `atlas-server/package.json`.
  No runtime, port, task, or env change; no database apply; no generation; no
  publication; no login; no companion repository edit.

### A1.8 Environment facts (planner-verified — do not re-derive)

- The cycle worktree has **no `node_modules`** and **no `.env`**. Install is
  isolated: `npm ci` in `atlas-server` **only**. **No client install is needed**
  — no gate row builds, type-checks, or tests the client, and no client file is
  in scope. Never run an install through a junction; no junction reuse is
  authorized.
- `DATABASE_URL` resolution order in
  `atlas-server/src/__tests__/helpers/tt-source-freshness-db.ts`:
  `process.env.DATABASE_URL` -> `<worktree>/atlas-server/.env` ->
  `D:/ATLAS-runtime-config/atlas-server.env` (read-only). Do **not** create a
  `.env`, do **not** print the URL, and never target the configured database.
  The helper probes the configured database read-only and never writes it.
- `PSQL` must resolve to `D:/PostgreSQL/18/bin/psql.exe`. If the harness returns
  `null`, the suite must **SKIP** — a skip is not a PASS, and gate rows 1-11
  require real execution.
- Disposable databases live on the D: PostgreSQL instance and each must be
  dropped with `assertDropped()` plus a zero-residue proof. A first drop can
  race; a bounded retry is acceptable.
- Disk recorded by the planner at dispatch: **E: 72.83 GiB free** (warn 25,
  fail 15), **D: 31.27 GiB free**. Do not create worktrees, junctions, or large
  fixtures.
- `D:/ATLAS/.git/index.lock` (0 bytes, 2026-09-16) is stale residue that blocks
  index write-refresh **only** in the `D:/ATLAS` main worktree. It does not
  affect linked worktrees. **Do not delete it**; it is outside this packet.

### A1.9 Corrected control/gate map (the 14 rows)

| # | Amended gate |
|---|---|
| 1 | New suite green on disposable PostgreSQL through the **real** `publishSchedule`, the **real** `invalidateStaleCompletedRuns`, and the real routine-sync caller path |
| 2 | C-A un-publish/resurrection interleave: `R` stays `isPublished:false` with `publicationSuperseded*` intact; exactly one `isPublished===true`; no `409 PUBLISHED_RUN_AMBIGUOUS`; zero non-CAS writes for `R`; typed outcome contains `R`; exactly one new skip-audit row for `R` |
| 3 | C-B orphan interleave: `publishSchedule(R)` between classification and write; `R` never `FAILED`; its revision still resolves through the real published read; zero destructive writes for `R`; typed outcome contains `R`; skip-audit delta exactly 1 |
| 4 | C-C genuine invalidation preserved: unpublished stale `COMPLETED` no-interleave run becomes `FAILED` with `error: 'INVALIDATED_BY_MIRROR_RESET'`; `invalidatedCount` == runs actually set `FAILED`; **`unpublishedRunIds` truthful (R2.3b)** |
| 5 | R1 mutant: CAS predicate removed -> C-A **and** C-B FAIL; source restored byte-exactly with blob-hash proof and empty `git diff` |
| 6 | R2 replay/idempotency: second sync no-ops, no duplicate audit row, no second destructive write |
| 7 | C-D: frozen snapshot with a non-numeric/partial interval is rejected via the typed contradiction, asserted against the producer's `NaN` semantics (`schedule-constructor.ts:1360-1363`) — never silently read as `420` |
| 8 | R3 mutant: the `: 0` coercion at `published-identity-snapshot.service.ts:197` restored -> C-D FAILS; restored byte-exactly with blob-hash proof |
| 9 | `published-immutability-c08.test.ts` green with **no assertion removed**; report `check(`/`checkEqual(` call-site counts at base and tip |
| 10 | **C-E** real `syncFacultyFromExternal` routine-sync caller control (A1.5) |
| 11 | `publication-contract-readiness.test.ts` + `publication-contract-postgres-concurrency.test.ts` on disposable PostgreSQL with the `PUBC01R_DISPOSABLE_DATABASE` binding (A1.5), zero residue |
| 12 | `npm --prefix atlas-server run build` (tsc) exit 0 |
| 13 | Built-server startup on an isolated port: `/api/v1/health` 200, clean termination, explicit `.js` runtime-import proof on the emitted `dist` for every changed server module |
| 14 | `git diff --check` clean; `node ops/workflow/verify-cycle.mjs --state docs/plans/atlas-delivery-cycles.json` exit 0; disposable-DB zero-residue proof; honest `git status --short` |

`prisma/schema.prisma:792` already has `version Int @default(1)`; all CAS
predicate fields (`id`, `schoolId`, `schoolYearId`, `status`, `version`) exist
at `:777-803`. **No migration is needed or permitted.**

### A1.10 Unchanged

§4's deterministic interleave seam stands: one optional injected dependency on
`invalidateStaleCompletedRuns`, defaulting to production behaviour, invoked
after the classification read and before the write transaction, mirroring the
`PublicationDependencies` pattern at `publication-contract.service.ts`. Default
`undefined` must be behaviourally identical to today; only the committed test
supplies the hook. §5's risk tier, §6's boundaries, and §7's return contract
(with the A1 additions folded in) stand unchanged.
