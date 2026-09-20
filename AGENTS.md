---
name: atlas-project-directive
description: ATLAS project directive. Lean by design — keep the rules that change behaviour under time pressure; delete process that only records it.
---

# ATLAS Project Directive

**Read this once. It is deliberately short.** Everything here has either caused a
real defect when ignored or prevented one when followed. If a rule is not here, it
is not a rule — use judgement.

**This directive is a living document, and updating it is part of the work.** When a
session discovers a failure mode that a rule would have prevented — or finds a rule
that is wrong, stale, or mere ceremony — update this file in the same turn. Every rule
below earned its place that way. Add rules that change behaviour; delete rules that
only record it. Prefer a rule that prevented a real, named defect over a rule that
sounds thorough.

---

## 1. Commit Message Rule

After every output that changes code or files, suggest a conventional commit
message:

```
<type>(<scope>): <short summary>

<optional body>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`
**Scopes:** the feature or module name (`timetable`, `teaching-load`, `subjects`, `api`, `prisma`)

---

## 2. Direct Editing Rule

- Edit repository source files directly.
- Do **not** create temporary Python/Node/shell helper scripts whose only purpose is
  bulk text replacement. If a scripted transformation is genuinely required, ask
  first and remove the helper immediately after.
- Never use `Get-Content | Set-Content` round-trips on repository files under
  PowerShell 5.1 — it silently corrupts non-ASCII characters. This has already
  destroyed 26 em dashes once.

---

## 3. Workspace Capacity And Worktree Lifecycle Rule

**`E:/ATLAS-worktrees` is the root for every new planner, executor, QA, audit, and
integration worktree.** `D:/ATLAS-worktrees` is legacy-retention only — do not
create another worktree there without an explicit operator decision. Git branches,
commits, and pushed artifacts preserve history; retaining every checkout does not.

- Before creating a worktree, installing dependencies, or starting a heavy build,
  record the target volume's free space. On `D:`, **warn below 25 GiB and fail
  closed below 15 GiB**. PostgreSQL lives on `D:` — database headroom is part of
  this gate.
- Keep at most **12 active task worktrees** across both roots. Integration
  worktrees count and must not persist as historical evidence.
- Every handoff must state a worktree disposition: `KEEP_ACTIVE`,
  `RETIRE_AFTER_INTEGRATION`, or `PRESERVE_FOR_DECISION`. After a candidate is
  integrated and pushed, retire its clean inactive worktrees in the same closure.
- Before retiring anything, record: exact path, branch or detached state, HEAD,
  complete `git status --short`, ancestry or tree-equivalence evidence, and any
  active process using it. **Preserve every dirty worktree, unintegrated candidate,
  active stream, and uncertain owner.**
- Retire with `git worktree remove <exact-validated-path>` then `git worktree prune`.
  Never `--force`, never raw recursive deletion, never a glob or computed path.
  Worktree retirement never authorises branch deletion.
- Never retire or modify `D:/ATLAS`, Codex-managed worktrees, `D:/ATLAS-runtime-*`,
  `D:/ATLAS-runtime-config`, PostgreSQL storage, companion repositories,
  `stakeholderFiles`, or preservation/backup directories.
- **Do not chain `node_modules` junctions across releases.** Junction to a *stable*
  target only. A chain rooted at a retired release breaks `@prisma/client` for
  every release at once — this has already taken the live runtime down. Each release
  either owns its dependency tree or junctions to one that will not be retired.
- Never run an install through a shared junction, and never count or delete its
  target during cleanup.

---

## 4. External Subsystem Source Protection Rule

- Only files inside the ATLAS repository may be edited during ATLAS work.
- Local clones of **EnrollPro, AIMS, SMART** are **READ_ONLY** reference mirrors.
  Never edit their source, config, migrations, lockfiles, generated files, docs, or
  Git history.
- Tests, builds, searches, and runtime probes may run against a companion repo only
  when they do not rewrite tracked files, install/update dependencies, apply
  migrations, seed/reset data, or mutate that subsystem. No formatters, no
  write-mode or snapshot-updating test runs.
- Before fetching or pulling a companion repo, verify its worktree is clean. If it
  is dirty: do not stash, reset, clean, or pull — report the state.
- **Sync before you inspect.** A companion mirror is evidence only at a recorded
  commit. Before reading its source, benchmarking its UX/UI, or citing its
  behaviour, fetch upstream, confirm the clone is clean, fast-forward it, and
  record the exact pin in the artifact. A stale mirror silently invalidates the
  comparison: the SMART UX baseline was authored against `c3806e12`/`1bda233`
  while upstream had advanced 34 commits, including companion-SSO and per-portal
  auth changes that bore directly on our own work.
- Remotes differ and must be checked, not assumed: `D:/smart-final-capstone`
  tracks upstream `madebyseaan/smart-final-capstone`, while `D:/EnrollPro` and
  `D:/AIMS` track our forks (`njgrm/EnrollPro`, `njgrm/AIMS`). To bring a fork in
  step, first prove it has no fork-only commits
  (`git merge-base --is-ancestor fork/main upstream/main`), then fast-forward push
  it. **Never force-push a companion repo.**
- When a defect belongs to EnrollPro/AIMS/SMART, write a developer-facing handoff in
  `D:/ATLAS/docs/` with the upstream commit, exact source path/line evidence, the
  required contract, and acceptance tests. **Do not implement the external patch.**
- Prompt authors must label companion repos `READ_ONLY`. Phrases like "fix
  consumers", "complete end to end", or "make integration pass" do **not** grant
  write authority. An exception needs a new, explicit user instruction naming the
  repository and the exact write scope.

---

## 5. Server Runtime Safety Rule

- In `atlas-server/src`, relative imports used at runtime must keep explicit
  ESM-safe endings such as `.js`.
- Do not introduce extensionless relative imports just because `tsc` accepts them.
- A backend change is not complete until **Node can actually start the built
  server**, not just type-check it.

---

## 6. Supervised Runtime And Log Probing Rule

- The host runs an auto-starting supervised runtime: scheduled task
  `ATLAS-Runtime-Supervisor` (SYSTEM, at system startup) launches
  `<sourceDir>/ops/runtime/cli.mjs`, which owns **port 5001** (`atlas-server/dist/server.js`)
  and **port 5174** (production host serving `atlas-client/dist`). `EADDRINUSE` on
  5001, or "Port 5174 is in use, trying another one" from a manual `npm run dev`, is
  **expected behaviour, not a defect.**
- Both children stream into one log: `<sourceDir>/ops/runtime/logs/atlas-supervisor.log`,
  with state in `supervisor-state.json` beside it. Read-only status:
  `node ops/runtime/cli.mjs status` from `<sourceDir>`.
- Resolve `<sourceDir>` from the task action or the supervisor process command line
  (`schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`). **Never assume a
  directory name or PIDs from a previous session.**
- Do not start, stop, or replace the supervisor or its children outside an approved
  deployment action.
- `/api/v1/health` is **liveness only** — it does not prove database or route
  readiness. Probe a database-backed read such as `GET /api/v1/subjects?schoolId=<id>`
  together with the supervisor log. Transient Prisma `P1001` and Postgres client-abort
  lines can appear during antivirus scans; confirm with the DB-backed read before
  reporting an outage.
- **Deploy facts learned the hard way:**
  - A machine-scope env change requires an **elevated** shell. Verify with
    `IsInRole(Administrator)` before assuming a write succeeded.
  - The supervisor runs as **SYSTEM**; a non-elevated shell cannot kill it. Use the
    scheduled task as the durable launch owner, never a detached child of an agent
    shell.
  - An out-of-process `cli.mjs stop` reports `stopped` but does **not** quiesce the
    resident supervisor — it respawns its children. Kill the supervisor **tree**.
  - A stale `supervisor-state.json` saying `running` makes `start` fail with
    `ALREADY_RUNNING`; clear it before starting.
  - The Prisma client is generated into `node_modules/.prisma/client`, and the
    schema's `output` is resolved **relative to the schema file**. Run
    `prisma generate` from `atlas-server` with `--schema` pointing at the **repo-root**
    schema, or the client lands in the wrong tree.
  - **Prove a deploy by fetching a chunk that only exists in the new build.** A
    healthy `/api/v1/health` on the old release looks identical to a successful deploy.
  - **Every production client build must set `VITE_ENROLLPRO_URL`.** A fail-closed
    guard in `atlas-client/vite.config.ts` exits 1 and emits **no bundle** without it.
    The release build pipeline must export the EnrollPro origin
    (`https://dev-jegs.buru-degree.ts.net`), or the build fails by design. A
    development build and the Node test runner are unaffected.
  - **Only the `supervisor-state.json` inside the active `ATLAS_RUNTIME_SOURCE_DIR` is
    authoritative.** There is one per release directory; the others are stale artifacts
    from earlier releases and will report a different release, or `stopped`, while the
    runtime is healthy. Reading the wrong one produces a false "identity drift" alarm.
  - A companion mirror is **evidence only at a recorded commit** — see §4.

---

## 7. Timetable Invariants

Before planning, editing, or reviewing timetable generation, term scope, schedule
views, exports, publication, latest-run reads, or timetable query shaping, read
`docs/reference/agent-timetable-invariants.md`. The core fail-closed rules are:
missing term identity never becomes Term 1; one selected ordered term preserves
subject/teacher/room and full weekly demand; published output has zero HARD
violations; and every consumer proves parity from one source run.

---

## 8. Frontend Constraints (MANDATORY)

- **No-Scroll Architecture:** protect the root `flex flex-col h-[calc(100svh-3.5rem)]`
  container. Main scrolling regions use `flex-1 min-h-0 overflow-auto`. Never spawn
  global browser scrollbars.
- **Inline Stat Banners**, not massive metric Cards, for key figures.
- **DepEd colour codes** where grade meaning is encoded: **G7 green, G8 yellow,
  G9 red, G10 blue.**
- **No raw `<details>` or `title` attributes** for extra information. Use
  `@/ui` `HoverCard` / `Tooltip` / `Popover`.
- **No native `<select>`**, no raw unstyled `<button>`. Route everything through
  `@/ui/*` primitives.
- **File size:** no React component file above **1000 physical lines** (blank lines
  and comments count). Extract sub-components before continuing.

---

## 9. Requirements Authoring (when asked for a PRD)

Use EARS syntax for every functional requirement. One behaviour per line. No
implementation details.

| Type | Template |
|---|---|
| Ubiquitous | `The [system] shall [action].` |
| Event-driven | `When [trigger], the [system] shall [action].` |
| Unwanted behaviour | `If [condition], then the [system] shall [action].` |
| State-driven | `While [state], the [system] shall [action].` |
| Optional feature | `Where [feature is included], the [system] shall [action].` |

Ask clarifying questions **only** when a missing answer would materially change
product intent, scope, authority, risk, or the result. Do not pause routine
inspection, review, correction, testing, integration, or an already-defined task for
ceremonial questions.

Produce: Overview · Scope (In/Out — Out is mandatory) · Actors · Functional
requirements grouped and ID'd · Non-functional (quantified) · Acceptance criteria
mapped to requirement IDs · Open questions · Assumptions · Dependencies.

---

## 10. Delivery Workflow (git-based)

1. **Branch per change.** `work/<stream>`, `fix/<topic>`, `feat/<topic>`,
   `integration/<release>`. Branch names must not name an AI agent, model, or vendor.
2. **Never implement, commit, merge, or push directly on `main`.** Only the
   integration owner merges to `main`, and only after acceptance.
3. **Record the base SHA** and confirm the worktree is clean before editing. If it is
   dirty or shared with another stream, stop and get an exact boundary — do not
   stash, reset, or absorb.
4. **Implement and test the real path.** Focused tests, plus a real route/workflow
   check when behaviour is wired into production. Negative controls for authority,
   concurrency, zero-write, or source-of-truth claims.
5. **Commit the candidate.** Stage only the assigned paths, check
   `git diff --cached --check`, write a conventional commit. The commit is a review
   candidate, not approval.
6. **Review by commit range** — `<base>...<candidate>`. The accepting reviewer must
   not be the implementer.
7. **Correct additively.** A correction is a new commit on the same branch. Do not
   amend, rebase, or force-push a commit that has been handed off.
8. **Integrate and push** after acceptance, from a clean `integration/*` boundary,
   then retire the candidate worktree.
9. **"Worktree clean" means the complete `git status --short` is empty.** Do not
   call it clean because unrelated or ignored files were excluded.
10. **A progress ledger and a handoff are supporting evidence, never a substitute**
    for reviewing the committed production diff.

### Handoff format (keep it short)

Base SHA · candidate SHA · exact changed paths · what changed and why · the decisive
commands actually run with results · known risks, each marked `BLOCKING` or
`NON_BLOCKING` · verdict. One page. No transcripts.

---

## 11. Risk Tiers And Verification

Classify by behaviour and authority, not ease of rollback. User-facing or production
behaviour defaults to MEDIUM; a live action remains HIGH even when its source was
already accepted.

### Review loops by tier — do not add ceremony

| Tier | Required loop |
| --- | --- |
| **LOW** — non-authorising docs, copy-only, test-only, or mechanically provable non-behavioural source | `executor self-check → planner review`. **No independent QA. No auditor.** |
| **MEDIUM** — production wiring, cross-layer shape, concurrency | `executor → one fresh QA → planner integration`. Auditor only if QA returns ambiguity, or the integration has genuinely overlapping changes. |
| **HIGH** — migration, destructive or production-data write, auth boundary, deployment, generation, publication, live apply | `independent packet review → explicit approval → executor → independent post-action QA`. Completion auditor only for irreversible writes, deployment failure, conflicting evidence, or publication. |

- **Documentation-only corrections:** the planner applies and verifies them directly.
  No executor/QA loop, unless the document grants authority or contains a HIGH
  approval boundary.
- **Test-only corrections:** rerun the affected tests plus **one** relevant
  preservation suite. Do not repeat builds or full regression inventories unless
  production code changed.
- **A test no gate runs is not evidence.** A new or changed test file must be
  reachable from a committed `package.json` script (or the documented gate entry
  point) in the same commit. Precedent: `test:ux-guardrails` named two files deleted
  by `4794bd9e` and still exited 0 with a green tally, and a Muse Spark C02 candidate
  added a 398-line test file with no script entry where the accepted DeepSeek
  candidate added one.
- **Record what you actually ran, and never substitute silently.** When an acceptance
  row depends on a computed artifact — a hash, a signature map, a count — the evidence
  must retain the literal command, SQL and serialization that produced it. If a packet
  step cannot be run literally, either stop and report it or record the literal text you
  ran at the moment you deviate. Precedent: a deploy adapted the packet's SQL and
  repaired a task-XML encoding without retaining either, so its zero-write row could not
  be independently reproduced and an extra executor-plus-QA round was spent closing it.
- **Every acceptance row names the harness that decides it.** A row that needs a
  browser, a login, or a deployed build is a deployment-acceptance clause, not a source
  row, and must be labelled as one when the packet is written. Precedent: two cycles lost
  a row to wording no available harness could decide, and one demanded a DOM-identity
  property the architecture could not provide.
- **A bounded correction does not require a full re-review.** After a correction
  commit, review the *new commit and its blast radius*, not the whole range again.
  Still prove that the prior accepted commits remain ancestors, unchanged reviewed
  paths retain their accepted blobs, and one relevant preservation control passes.
- **Checkpoint large cycles.** Commit a coherent candidate every 45–60 minutes so a
  step limit resumes from a checkpoint instead of reconstructing the cycle.
- **One writer per stream.** Before dispatch the planner names the stream owner and
  worktree. No second planner or agent writes to that branch or worktree until the
  owner releases it. Two planners on one stream is a custody defect, not parallelism.

### Gates that have actually caught defects — keep these

For MEDIUM and HIGH work, read `docs/reference/agent-verification-gates.md` and
apply only the gates relevant to the change. Production-path proof, failing-first
proof, scope authority, and zero-write rejection remain mandatory when applicable.
Live browser evidence never proves undeployed source bytes.

---

## 12. Live Browser QA

Before any browser, UX/UI, responsive, authenticated, or cross-app evidence task,
read `docs/reference/agent-live-browser-qa.md`. Browser work is serialized through
one profile controller, read-only by default, and uses the named Tailnet origin.
A fresh login is a mutation and requires explicit authorization for its audit
delta. Never persist credentials or use live Tailnet evidence to prove undeployed
source bytes.

---

## 13. HIGH Actions Require Explicit Approval

Deployment, schema/migration apply, live-data mutation, generation, publication, and
runtime/task/env changes are HIGH **even when a prompt or report labels them LOW**.

- Before acting: name the exact target, the expected delta, the rollback, and the
  verification. Present it. **Wait for a clear instruction to proceed.**
- A plain "yes, deploy" or "go ahead" is sufficient. Do not demand notarised wording.
- Keep deployment and acceptance as **separate outcomes**. A healthy deployed process
  may be `DEPLOYED` while required acceptance is incomplete — do not call it done.
- Never run reset-style schema commands (`prisma db push --force-reset`,
  `prisma migrate reset`) against a shared or live database. Record host, database
  name, environment, and migration count before any schema command.
- **Unexpected shared-data mutation is an incident stop.** Preserve evidence, do not
  continue against the altered state.
- If a required listener is unexpectedly absent, the plan has changed — do not
  execute a swap packet unchanged. Prepare a deploy-as-restore with the last
  accepted artifact as a startable fallback.

---

## 14. Parallel Work And Planners

- Separate worktrees, separate branches, **disjoint file ownership**. One owner per
  stream. Coordinate through Git, not through a shared status file.
- Browser work is serialised (one controller, §12). Source and non-browser work run
  in parallel freely.
- Only one stream may swap or restart the shared 5001/5174 runtime at a time. Others
  use isolated ports and label their evidence as isolated.
- Every temporary process, browser, fixture, and database has a named cleanup owner.

---

## 15. Live State Document

Maintain **one short file** — `docs/plans/live-state.md` — updated **only when state
changes**:

- what release is live and its SHA,
- what is blocked and by what,
- what is awaiting a decision,
- the single next action.

Do not maintain a per-transition register, state machine, lease table, or receipt
chain. Git history and this one file are the continuity record. If a session dies,
these plus the branches are enough to resume.

---

## 16. Evidence And Cost Discipline

- **One evidence object per role.** Executor: one commit and one short handoff.
  Reviewer: one verdict. Planner: one integration result. Do not create parallel
  ledgers, manifests, or summaries for the same fact.
- **A mandatory row is never "not applicable".** Run it, or report it `BLOCKED` or
  `UNPERFORMED` with the reason. Declaring a row inapplicable without executing it is
  a false report, not a judgment call.
- **Corrections are additive to evidence, never subtractive.** Never delete a control,
  assertion, or evidence row to close a finding — mark it superseded and add the
  replacement beside it. A correction that removes evidence fails review regardless of
  whether the fix is correct.
- **The executor deny-list is not a containment boundary.** It matches command prefixes
  and misses wrapped or prefixed invocations. Reviewers check `git stash list` and the
  reflog; "zero residue" means the stash list, reflog, untracked files, and worktree
  status are all clean.
- **Git is the integrity mechanism.** No per-file hash inventories, receipt chains,
  or reviewer-allowlist validators for ordinary work. Fingerprints remain for
  destructive data work, migrations, publication, and backup/restore.
- **Three verification tiers:** executor focused gates → independent review of the
  decisive subset plus adversarial production-path checks → combined gates once at
  integration. Do not repeat a tier without a source or environment change.
- **Use the cheapest model that can do the job.** Escalate for architecture,
  conflicting candidates, security, concurrency, or a HIGH action. A model label
  never substitutes for evidence.
- **Do not reload this directive from disk** when it is already in context. Use
  targeted reads only to recover a specific rule.

### Token economy — coordination is context

Provider billing and cache ratios vary by model, harness, and session. Keep measured
cost figures in workflow-analysis artifacts, not in this normative directive. The
durable rule is to avoid duplicated coordination that produces no new evidence.

- **Use a fresh session for a new independent lane only after durable checkpointing.**
  The prior lane must have a committed handoff and must release browser, worktree,
  runtime, and register custody. Never reset through an uncommitted correction, an
  active HIGH action, or a live browser handoff. A fresh session can also lose prompt-
  cache benefits, so use it at real lane boundaries rather than after every turn.
- **Point at artifacts, do not paste them.** A subagent prompt names a committed
  packet path; it does not contain the packet.
- **Batch independent shell checks into one call.** Each extra call is a full
  round-trip through the context.
- **Cap every output** — `-First`, `--oneline`, `--stat`, `-Tail`. Never dump a whole
  file, a directory listing, or a JSON payload into context.
- **Do not re-verify a stable fact merely for reassurance.** Always reverify after a
  source merge, runtime or environment change, custody transition, meaningful elapsed
  time for an external dependency, concurrent `origin/main` advance, and immediately
  before a HIGH mutation.
- **Use Context7 or targeted official-documentation queries.** Do not ingest an entire
  documentation page when a scoped query or section is sufficient; record when an
  answer is only a current snapshot.
- **Keep the prompt prefix stable within a lane.** Choose the model, reasoning effort,
  enabled tools, and stable instructions before dispatch. Changing them mid-session can
  invalidate provider prompt caches; put volatile task facts and current SHAs at the end.
- **Use one context manager.** Do not stack native compaction/pruning with a plugin that
  replaces compaction. Prefer the harness-native mechanism unless a replacement is
  intentionally configured, verified, and cheaper for the measured workload.
- **Keep global tool surfaces minimal.** Enable only tools required by the lane, but do
  not disable Context7 for current library documentation or Playwright for authorized
  browser QA. Task-specific role files should reference this directive instead of
  duplicating its rules.
- **Keep this directive short.** Detailed test matrices and domain contracts belong in
  referenced files under `docs/`, not here. Every agent pays for every line of this
  file on every request.
- Immutable commit ranges are cheap. Independent QA is expensive but intentionally
  retained where the risk justifies its cost. This rule targets exploratory volume
  and duplicated coordination, not discipline.
