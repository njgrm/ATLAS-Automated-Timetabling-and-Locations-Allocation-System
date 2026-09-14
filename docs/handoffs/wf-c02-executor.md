# WF-C02 Lane A executor handoff (workflow state, roles, compaction, closure)

## Identity

- Worktree: `E:\ATLAS-worktrees\workflow-hardening-c02`
- Branch: `work/workflow-hardening-c02`
- Base SHA: `84dd537bb2a2c045b8518c35b3a5372142e0080c` (= refreshed `origin/main` at dispatch)
- Candidate: bounded additive commits on the branch (the product/test candidate,
  a test-value hygiene commit, the R1 lock correction, and the R2
  coordination-deadlock correction with their tests). A file cannot contain its
  own commit SHA; the planner/QA resolve the tip with
  `git -C E:\ATLAS-worktrees\workflow-hardening-c02 rev-parse HEAD`.
- Directive: worktree `AGENTS.md`, LF-normalized SHA-256 `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5` (unchanged).
- Risk tier: MEDIUM (source + tests + docs; no live runtime, database, network, browser, credential, or HIGH action).
- Verdict: `REVIEW_REQUIRED`

## Changed paths (base...candidate)

```
.gitattributes
.opencode/agents/atlas-executor.md
.opencode/agents/atlas-planner.md
.opencode/agents/atlas-qa.md
.opencode/agents/atlas-wave-auditor.md
docs/handoffs/wf-c02-executor.md
docs/plans/atlas-active-delivery-streams.generated.md
docs/plans/atlas-delivery-cycles.json
opencode.json
ops/workflow/README.md
ops/workflow/__fixtures__/fail-accept-ready-blocked.json
ops/workflow/__fixtures__/fail-candidate-unknown.json
ops/workflow/__fixtures__/fail-changed-paths.json
ops/workflow/__fixtures__/fail-changed-paths-extra.json
ops/workflow/__fixtures__/fail-complete-stale-corrections.json
ops/workflow/__fixtures__/fail-custody-overlap.json
ops/workflow/__fixtures__/fail-dependency-not-satisfied.json
ops/workflow/__fixtures__/fail-duplicate-writable.json
ops/workflow/__fixtures__/fail-external-with-safe-work.json
ops/workflow/__fixtures__/fail-gates-arithmetic.json
ops/workflow/__fixtures__/fail-high-boundary-exceeded.json
ops/workflow/__fixtures__/fail-high-expired-dependency.json
ops/workflow/__fixtures__/fail-high-unreachable-dependency.json
ops/workflow/__fixtures__/fail-high-without-approval.json
ops/workflow/__fixtures__/fail-missing-next-action.json
ops/workflow/__fixtures__/fail-receipt-missing.json
ops/workflow/__fixtures__/fail-receipt-stale.json
ops/workflow/__fixtures__/fail-stale-candidate.json
ops/workflow/__fixtures__/fail-successor-unlocked.json
ops/workflow/__fixtures__/fail-unauthorized-login.json
ops/workflow/__fixtures__/fail-unknown-requires.json
ops/workflow/__fixtures__/pass-audited-wave.json
ops/workflow/__fixtures__/pass-high-prepared.json
ops/workflow/__fixtures__/pass-ordinary.json
ops/workflow/__tests__/artifact-portability.test.mjs
ops/workflow/__tests__/checkpoint.test.mjs
ops/workflow/__tests__/cli.test.mjs
ops/workflow/__tests__/coverage.test.mjs
ops/workflow/__tests__/determinism.test.mjs
ops/workflow/__tests__/fixtures.test.mjs
ops/workflow/__tests__/harness.mjs
ops/workflow/__tests__/identity.test.mjs
ops/workflow/__tests__/leases.test.mjs
ops/workflow/__tests__/lock.test.mjs
ops/workflow/__tests__/roles.test.mjs
ops/workflow/__tests__/schema.test.mjs
ops/workflow/__tests__/seed.test.mjs
ops/workflow/__tests__/transition.test.mjs
ops/workflow/checkpoint.mjs
ops/workflow/lib/checkpoint.mjs
ops/workflow/lib/git.mjs
ops/workflow/lib/lock.mjs
ops/workflow/lib/migrate.mjs
ops/workflow/lib/receipt.mjs
ops/workflow/lib/render.mjs
ops/workflow/lib/transition.mjs
ops/workflow/lib/util.mjs
ops/workflow/lib/verify.mjs
ops/workflow/render-register.mjs
ops/workflow/schema/cycle-state.schema.json
ops/workflow/transition.mjs
ops/workflow/verify-cycle.mjs
package.json
```

`package.json` (repository root) adds the `workflow:transition`,
`workflow:checkpoint`, and `workflow:render:check` scripts and does not change
any other script.

## Trace matrix (requirement -> production path -> negative control -> verification)

| ID | Requirement | Production path | Negative control | Verification command | Result |
| --- | --- | --- | --- | --- | --- |
| A1-1 | No committed field must equal the containing commit | `schema.$defs.git.remoteObservation`; `lib/verify.mjs` observation rule; `lib/migrate.mjs` | schema has no `remoteSha`; verifier source has no `rev-parse HEAD` | `node --test ops/workflow/__tests__/identity.test.mjs` | PASS |
| A1-2 | Stale candidate/integration ancestry still fails closed | `lib/verify.mjs` `GIT_ANCESTRY` | base = orphan root | `identity.test.mjs` "stale … ancestry still fails closed" | PASS |
| A1-3 | A forged remote observation fails | `lib/verify.mjs` `REMOTE_OBSERVATION_INVALID` | orphan SHA; non-existent SHA | `identity.test.mjs` "a forged remote observation fails closed" | PASS |
| A1-4 | One closure reaches a stable state with no follow-up SHA-fix commit | `lib/transition.mjs` lifecycle end-to-end | advance the branch tip after recording the observation | `transition.test.mjs` "a full closure lifecycle …" + `identity.test.mjs` first case | PASS |
| A1-5 | WF-C01 identity migrates without loss | `lib/migrate.mjs`; `docs/plans/atlas-delivery-cycles.json` | legacy `remoteSha` doc | `identity.test.mjs` migration case; `npm run workflow:verify` | PASS |
| A2-1 | One atomic named-transition CLI | `ops/workflow/transition.mjs` + `lib/transition.mjs` + `lib/lock.mjs` | stale CAS, invalid transition, ambiguous stream, lock contention, mid-write faults | `transition.test.mjs` (9 cases) | PASS |
| A2-2 | One committed writer + one typed loser, zero partial files | `lib/lock.mjs` + `lib/transition.mjs` | two concurrent processes | `transition.test.mjs` "two concurrent writers …" | PASS |
| A2-3 | Byte-identical before/after on every failure | staging + rename in `lib/transition.mjs` | `STAGE_STATE`, `STAGE_RENDER`, `VERIFY_RENDERED` faults | `transition.test.mjs` "a mid-write failure …" | PASS |
| A2-4 | Crash recovery reclaims a provably-absent owner and never deletes a live lock | `lib/lock.mjs` `processAlive` | dead pid vs live pid | `transition.test.mjs` live/absent lock cases; `lock.test.mjs` | PASS |
| A2-5 | Lock publication is atomic; unreadable/ownerless locks are never reclaimed | `lib/lock.mjs` (temp + `linkSync`, `classifyLock`) | empty, malformed, ownerless, and stray-temp lock files | `lock.test.mjs` (9); `transition.test.mjs` empty-lock case | PASS |
| COV-1 | Committed candidateSha→integrationSha ancestry negative control | `lib/verify.mjs` `GIT_ANCESTRY` | candidate not an ancestor of the declared integration commit | `coverage.test.mjs` GIT_ANCESTRY case | PASS |
| COV-2 | Committed `lease-update` red/green control | `lib/transition.mjs` `lease-update` | bogus state, bogus role, cross-stream lease | `transition.test.mjs` lease-update case | PASS |
| COORD-1 | Document-scoped `coordination-update`; the active cycle can move off a closing stream so the closure sequence is executable | `lib/transition.mjs` `coordination-update` + `scope: "document"`; `lib/verify.mjs` `TERMINAL_STATES` | MANUAL+non-null id, CYCLE_ACTIVE unknown/terminal id, cleared next action, stale revision | `transition.test.mjs` R2-T1…T4 | PASS |
| A3-1 | Dirty worktree + live lease + PLANNED/running[] fails | `lib/verify.mjs` lease rules; `lib/git.mjs` `worktreeStatusPorcelain` | TT-SOURCE-FRESHNESS-C04 shape | `leases.test.mjs` first case | PASS |
| A3-2 | Directory existence alone is not activity | `lib/verify.mjs` | clean worktree, no lease | `leases.test.mjs` "a clean worktree with no lease …" | PASS |
| A3-3 | Expiry never grants cleanup/replacement authority | lease rule + `lease-update` transition | expired `ACTIVE` lease | `leases.test.mjs` "an expired-but-unconfirmed ACTIVE lease …" | PASS |
| A4-1 | Four roles resolve from the installed harness | `.opencode/agents/*.md` | — | `node --test ops/workflow/__tests__/roles.test.mjs` | PASS |
| A4-2 | Least-privilege, fail-closed permission matrix; no self-promotion | agent frontmatter `permission` | wrong path, wrong task target, push/merge | `roles.test.mjs` matrix cases | PASS |
| A4-3 | Existing delegate faces preserved | global `atlas-executor-delegate` / `atlas-qa-delegate` | — | `roles.test.mjs` "existing delegate faces are preserved" | PASS |
| A5-1 | Automatic compaction + pruning configured and resolvable | project `opencode.json` | — | `roles.test.mjs` compaction case; `opencode debug config --pure` | PASS |
| A5-2 | Minimal, redacted, size-bounded checkpoint | `lib/checkpoint.mjs` + `ops/workflow/checkpoint.mjs` | secret-shaped values, oversize, unknown keys | `checkpoint.test.mjs` (9 cases) | PASS |
| A6-1 | Fixture harness no longer spawns a Node/Git repo per assertion | `__tests__/harness.mjs`, `fixtures.test.mjs` | one true CLI process test and the real Git checkout controls preserved | `npm run workflow:test`; `cli.test.mjs`; `artifact-portability.test.mjs` | PASS |
| A6-2 | Suite meets the time budget | harness + `lib/git.mjs` memo | — | before/after wall times below | PASS |
| R2 | Every deterministic verifier code is reachable | `lib/verify.mjs`, `lib/schema.mjs` | table-driven mutations | `coverage.test.mjs` (27 cases) | PASS |

## Decisive gate outputs

- `npm run workflow:test` (after R2): `tests 143 / pass 143 / fail 0 / cancelled 0 / skipped 0 / todo 0`; full-suite `duration_ms` 28.1–38.2 s and wall 28.8–39.7 s across repeated runs of the same tree bytes (typical committed-tree runs measured 30.6–30.9 s duration / 31.3–31.8 s wall). Still inside the 45 s budget.
- Before (WF-C01 tip, same host): `npm run workflow:test` wall `82562 ms` (60 tests).
- Fixture/semantic suite (`fixtures.test.mjs`): `duration_ms 2008 ms` (target < 20000 ms).
- `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json`: exit 0, `status ok`, `errors []`, 6 streams.
- `npm run workflow:render:check`: exit 0 (committed generated register is byte-identical to the deterministic render).
- `git diff --check`: clean. `git status --porcelain`: clean after the final commit.

## Resolved OpenCode surface

- Installed harness: OpenCode 1.18.21, Node v24.14.1, npm 11.11.0.
- Detection surface: `opencode debug config --pure` (local-only mode; `--pure`
  disables external plugins, so no `@latest` fetch was required). Raw output
  contains provider credentials and was never committed, echoed into evidence,
  or pasted; only the `agent`, `compaction`, `subagent_depth` fields were
  extracted.
- Roles: `atlas-planner` (`mode: primary`, `opencode-go/deepseek-v4.1-flash`,
  `variant: max`); `atlas-executor`, `atlas-qa`, `atlas-wave-auditor`
  (`mode: subagent`, same model, `variant: high`).
- Max-variant subagent spawnability: a subagent declaring `variant: max`
  resolves successfully through `opencode debug agent` (config-resolution
  evidence). Runtime spawning of a max subagent was not exercised, so the proven
  `high` reviewer tier is used for subagents and the fallback is disclosed here.
- Permission matrix (resolved): planner may invoke only `atlas-executor`,
  `atlas-qa`, `atlas-wave-auditor`, `atlas-executor-delegate`, `atlas-qa-delegate`
  (plus the read-only built-in `explore`/`scout` inherited from global config);
  executor edits only ATLAS repo/worktree paths, denies runtime-config, database
  recovery, and companion paths, and denies push/merge/rebase/reset/stash/worktree
  mutations and `npm install`; QA and the auditor have `edit: deny` and
  `task: deny`. `read` was not overridden, so the global `.env` read denies remain
  intact.
- Compaction keys accepted by 1.18.21: `compaction { auto: true, prune: true,
  reserved: 12000 }`, `agent.compaction { model: "opencode-go/deepseek-v4.1-flash",
  variant: "low" }`, `subagent_depth: 1`.

## CLI named transitions and concurrency proof

- `record-executor-return`, `record-correction`, `record-qa-result`,
  `record-integration`, `record-audit`, `close-cycle`,
  `record-remote-observation`, `lease-update`.
- Lock: `<git-common-dir>/atlas-workflow.lock`, `O_EXCL`, owner metadata
  (pid/host/transition/stream/state/acquiredAt), bounded stale inspection
  (6 attempts, 40 ms backoff), reclaim only on proof of owner absence.
- Two concurrent CLI writers on one document: exactly one `status: ok` and one
  typed loser (`LOCK_CONTENTION` or `TRANSITION_STALE_REVISION`), revision
  advanced by exactly one, and no `.tmp`/`.stage` residue.

## Residual disposition

Closed: R4 (base-path fallback documented), R2 (rule-code coverage added), R1
(portability now asserts Git `check-attr eol`), O1 (closure receipt pin rendered),
O2 (authority wording), R6 (`--stream` without `--receipt` is now exit 2).
Retained with reason: R3 (`verified.artifacts` not in the staleness compare;
artifact bytes are enforced by `ARTIFACT_HASH_MISMATCH`), R5 (`.gitattributes`
covers future checkouts), R7 (`receipt.stateSha256` is informational), R8 (seed
predicate is a shape check). `GIT_DIFF_FAILED` and unused schema keywords
(`SCHEMA_MAXIMUM`, `SCHEMA_MIN_ITEMS`, `SCHEMA_MAX_LENGTH`) remain defensive and
unreachable with the shipped contract.

## R1 correction (F1 — lock publication and reclaim; QA `CORRECTION_REQUIRED` 10/9/0/0)

**Defect (blocking).** `lib/lock.mjs` reclaimed (deleted) a lock whenever its
record was unreadable, ownerless, or named a non-live pid. Because publication was
non-atomic (`openSync(path,"wx")` created a visible empty lock before the record
was written), a live holder in that creation gap presented an unreadable record
and was treated as absent; the sibling `releaseLock` also unlinked when the record
was unreadable. QA reproduced a transition succeeding while deleting a live
holder's lock and a concurrent race yielding two `ok` results.

**Fix (bounded; lock API unchanged).**

- Publication is atomic: the complete owner record is staged in a unique sibling
  temp and published with `fs.linkSync(temp, lockPath)` (throws `EEXIST` while
  held; same directory, so no cross-device issue), then the temp is unlinked on
  every path. A visible lock always carries a complete record; this tool can no
  longer create an empty or partial lock. A crashed publisher may leave a stray
  `*.tmp` that is never treated as a lock (`ops/workflow/lib/lock.mjs` `writeTempRecord:91`, `acquireLock:105`).
- Fail-closed reclaim: `classifyLock` (`ops/workflow/lib/lock.mjs:69`) replaces
  the fail-open test. Reclaim happens only when a readable record carries an
  integer `ownerPid > 0` that is provably absent. Unreadable, empty, malformed, or
  ownerless locks are retried within the bounded window and then returned as the
  new typed `LOCK_UNREADABLE` error with zero mutation.
- `releaseLock` (`ops/workflow/lib/lock.mjs:190`) unlinks only when a readable
  record's `ownerPid` is this process; unreadable and foreign records are never
  deleted. `inspectLock` reports `unreadable` consistently.
- `lib/transition.mjs` `lease-update` now honors `--lease-session` on lease
  creation (found while writing the required lease control).

**New/updated controls.**

| Control | Where | Result |
| --- | --- | --- |
| T1 empty live lock is never reclaimed: typed rejection, byte-identical state/render, lock preserved with its exact bytes | `transition.test.mjs` "a live external process holding an EMPTY lock …" | PASS |
| T2 three concurrent writers → exactly one commit, typed losers only (`LOCK_CONTENTION`/`TRANSITION_STALE_REVISION`), revision +1, no partial files | `transition.test.mjs` "three concurrent writers …" | PASS |
| T3 provably-absent owner is reclaimed with `reclaimed: true` | `lock.test.mjs`; `transition.test.mjs` absent-lock case | PASS |
| T4 `releaseLock` never deletes an unreadable or foreign lock | `lock.test.mjs` "releaseLock deletes only this process's own readable record" | PASS |
| Atomic publication, stray temp, `classifyLock`, `inspectLock` semantics | `lock.test.mjs` (9 tests) | PASS |
| `candidateSha → integrationSha` ancestry negative control | `coverage.test.mjs` GIT_ANCESTRY | PASS |
| `lease-update` valid change + typed invalid rejections (state, role, cross-stream) | `transition.test.mjs` lease-update case | PASS |

**Failing-first proof** (disposable copy of `ops/workflow` with only
`lib/lock.mjs` reverted to `HEAD`; the worktree was never reverted).

| Lock under test | status | error code | empty lock after | revision after |
| --- | --- | --- | --- | --- |
| pre-correction (`HEAD`) | `ok` | — | deleted | 2 |
| corrected | `fail` | `LOCK_UNREADABLE` | preserved | 1 |

The first row proves T1 fails against the pre-correction behavior. A 6×6
concurrent-writer probe against the pre-correction lock did not reproduce the
two-`ok` race on this host (the non-atomic window is sub-millisecond); T2 is the
strict regression control that rejects the `LOCK_UNREADABLE` loser outcome the old
publication could create, and QA already reproduced the two-`ok` race.

README documents the atomic publication, the stray-temp disposition, the
fail-closed `LOCK_UNREADABLE` behavior, and the manual recovery instruction for a
proven-crashed unreadable lock.

## R2 correction (F2 — active-cycle closure deadlock; planner-reproduced)

**Defect (blocking).** The documented closure sequence could not execute for the
active cycle. `lib/transition.mjs` re-runs the full verifier on the candidate
document before publishing; when `coordination.activeCycleId` named the closing
stream, that stream's move to `INTEGRATED`/`COMPLETE` made the active cycle
terminal and the candidate was rejected with `ACTIVE_CYCLE_TERMINAL`
(`lib/verify.mjs`, `TERMINAL_STATES`). No transition could change
`coordination`, so the sequence deadlocked. Reproduction: `record-executor-return`
→ ok, `record-qa-result` → ok, `record-integration` → `fail
TRANSITION_RESULT_INVALID: ACTIVE_CYCLE_TERMINAL: active cycle ORD-1 is terminal
(INTEGRATED)`, `coordination-update` → `TRANSITION_UNKNOWN`.

**Fix (bounded; existing pipeline/lock/CAS unchanged).**

- New document-scoped transition `coordination-update`
  (`ops/workflow/lib/transition.mjs:271`) with `--mode MANUAL|CYCLE_ACTIVE`,
  `--active-cycle-id <stream-id|null>`, `--global-next-action <text|null>`.
  `MANUAL` forces a null active cycle and rejects an explicitly non-null id;
  `CYCLE_ACTIVE` requires a defined, non-terminal target stream and a non-empty
  global next action (typed `TRANSITION_COORDINATION_*` rejections).
- `runTransition` now supports `spec.scope === "document"`
  (`ops/workflow/lib/transition.mjs:469`, `:488`): no stream target and no
  stream-bound state/awaited/running/nextAction post-processing, while the lock,
  CAS, staging, render, verification, and atomic-replace path is unchanged.
- `lib/verify.mjs` exports `TERMINAL_STATES` (`ops/workflow/lib/verify.mjs:36`)
  for the transition's explicit fail-closed check (the verifier still owns
  unknown/terminal/empty-awaited detection and surfaces the first error).
- README lists `coordination-update` and corrects the closure sequence: the
  coordination step belongs immediately before `record-integration`.

**New controls (failing-first).**

| Control | Where | Result |
| --- | --- | --- |
| R2-T1 a CYCLE_ACTIVE stream cannot `record-integration` until coordination moves; the blocked transition is typed and byte-identical; the move unblocks it | `transition.test.mjs` | PASS |
| R2-T2 full closure on a CYCLE_ACTIVE stream: return → qa → `coordination-update --mode MANUAL` → integration → audit → `close-cycle` (receipt minted + pinned) → observation, with `verify-cycle` exit 0 at every published revision and the pinned receipt validating at the final state | `transition.test.mjs` | PASS |
| R2-T3 negatives: MANUAL+non-null id, CYCLE_ACTIVE+unknown id, CYCLE_ACTIVE+terminal id, CYCLE_ACTIVE with a cleared global next action, stale revision — each typed with byte-identical state/render and zero lock residue | `transition.test.mjs` | PASS |
| R2-T4 `MANUAL → CYCLE_ACTIVE → MANUAL` round-trip, revision +1 each, verifier-clean | `transition.test.mjs` | PASS |

**Failing-first proof** (disposable copy of `ops/workflow` with only
`lib/transition.mjs` reverted to the pre-R2 tip `52411970`; the worktree was never
reverted). The committed R2 controls were run against it:

| Tree | R2-T1 | R2-T2 |
| --- | --- | --- |
| pre-R2 `lib/transition.mjs` | ✖ fail | ✖ fail (`0/2` pass) |
| corrected | ✔ pass | ✔ pass (`2/2` pass) |

## Known risks (all NON_BLOCKING for this packet)

1. The candidate cannot embed its own commit SHA; the planner/QA resolve the tip
   with `git rev-parse HEAD`.
2. `WF-C02` was registered with `state: RUNNING`, `candidateSha: null`, and no
   session id, because no candidate or session existed at authoring time. The
   planner records the candidate/QA/integration/audit/receipt/observation facts
   through the transition CLI.
3. The candidate time state document was verified at the authoring revision
   (`registry.revision: 1`); it becomes `REVIEW_REQUIRED` only through the CLI.
4. Concurrent CLI runs hold the lock; the bounded window (6 × 40 ms) is shorter
   than a long verify, so a very slow writer yields `LOCK_CONTENTION` rather than
   waiting indefinitely — typed and safe, but a caller must retry.
5. `--pure` was used for the config-resolution proof; plugin-backed behavior
   (`@cortexkit/opencode-magic-context`) is not exercised by these tests.
6. The fixture migration was applied as one deterministic, formatting-preserving
   projection (`contractVersion`, `remoteSha` -> `remoteObservation`,
   `registry.revision`, `leases`) across 24 data fixtures; the full suite proves
   the result.
7. OpenCode created a project-local `.opencode/node_modules`, `.opencode/package.json`,
   `.opencode/package-lock.json`, and `.opencode/.gitignore` when its debug
   commands resolved the plugin; that `.gitignore` self-ignores those artifacts,
   and only `.opencode/agents/*.md` are committed.
8. An unreadable/ownerless lock now fails closed as `LOCK_UNREADABLE` and needs a
   human to prove no owner exists before removal; the README gives the exact
   recovery step. This is intentional (never delete a lock without proof) but it
   means an externally corrupted lock blocks transitions until cleared.

## Zero-mutation statement

No live, HIGH, database, migration, runtime, task, port, Tailnet, browser, login,
credential, or companion action was performed. `atlas-server/**`,
`atlas-client/**`, `prisma/**`, `ops/runtime/**`, runtime releases/config, the
shared Playwright profile, and all companion repositories were never touched.
`CHANGELOG.md`, `docs/plans/atlas-active-delivery-streams.md`, and the living
register were not edited. No `git worktree`, push, merge, rebase, reset, stash,
or branch-deletion command was run. No dependency installation was performed.

## Return

`REVIEW_REQUIRED` — no merge, rebase, amend, push, or self-acceptance performed.
