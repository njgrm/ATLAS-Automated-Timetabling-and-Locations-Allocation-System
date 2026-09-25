---
name: atlas-project-directive
description: ATLAS project directive. Lean by design — keep the rules that change behaviour under time pressure; delete process that only records it.
---

# ATLAS Project Directive

**Read this once; it is deliberately short.** If a rule is not here, it is not a rule — use judgement. Every rule below earned its place by preventing or catching a real, named defect. **Updating this file is part of the work:** when a session finds a failure mode a rule would have prevented, or a rule that is wrong, stale, or ceremony, change it in the same turn. Add rules that change behaviour; delete rules that only record it. Prefer a rule that prevented a named defect over one that sounds thorough.

**Procedures are packaged as skills** in `.agents/skills/` (read by Codex and opencode; `.claude/skills/` holds Claude Code pointer stubs): `atlas-worktree-reclaim` (§3), `atlas-companion-sync` (§4), `atlas-deploy` (§6, §13), `atlas-timetable-invariants` (§7), `atlas-candidate-review` (§10, §11), `atlas-live-browser-qa` (§12). Loading the skill satisfies a "read `docs/reference/…`" instruction below; the reference docs remain the detailed source. Change a procedure in the skill, and a fact in its reference doc.

---

## 1. Commit Message Rule

After every output that changes code or files, suggest a conventional commit message:

```
<type>(<scope>): <short summary>

<optional body>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`
**Scopes:** the feature or module (`timetable`, `teaching-load`, `subjects`, `api`, `prisma`)

---

## 2. Direct Editing Rule

- Edit repository source files directly.
- Do **not** create temporary Python/Node/shell helper scripts whose only purpose is bulk text replacement. If a scripted transformation is genuinely required, remove the helper immediately after — never leave it in the repository or a worktree.
- Never use `Get-Content | Set-Content` round-trips on repository files under PowerShell 5.1 — it silently corrupts non-ASCII characters and has already destroyed 26 em dashes once.

---

## 3. Workspace Capacity And Worktree Lifecycle Rule

**`E:/ATLAS-worktrees` is the root for every new planner, executor, QA, audit, and integration worktree.** `D:/ATLAS-worktrees` is legacy-retention only — no new worktree there without an explicit operator decision. Branches, commits and pushed artifacts preserve history; retaining every checkout does not.

- **Before creating, retiring, or cleaning up any worktree, release directory, or dependency tree, read `docs/reference/agent-worktree-lifecycle.md`** — it holds the record-before-retiring list, the retirement command and its prohibitions, the do-not-retire set, and the `node_modules` junction rules that have already taken the live runtime down once.
- Before creating a worktree, installing dependencies, or starting a heavy build, record the target volume's free space. On `D:`, **warn below 25 GiB, fail closed below 15 GiB** — PostgreSQL lives on `D:`, so database headroom is part of this gate. On `E:`, **warn below 50 GiB, fail closed below 25 GiB** — every new worktree and release directory lands there (observed 2026-09-25: 50 → 36 GiB free in about two hours of release and cycle builds).
- **When either volume crosses its warning, run the release-directory retention reclaim before the next release build.** Do not wait for the fail-closed line, and do not wait for an operator to notice. The policy and its bounded cycle are in `docs/reference/agent-worktree-lifecycle.md`. Observed 2026-09-23: ~46 GiB accumulated in six days because nothing defined a reclaim trigger, and the reclaim then needed a one-off operator exception.
- Keep at most **12 active task worktrees** across both roots. Integration worktrees count and must not persist as historical evidence.
- Every handoff states a worktree disposition: `KEEP_ACTIVE`, `RETIRE_AFTER_INTEGRATION`, or `PRESERVE_FOR_DECISION`. Retire a candidate's clean inactive worktrees in the same closure that integrates and pushes it.
- **Preserve every dirty worktree, unintegrated candidate, active stream, and uncertain owner.**

---

## 4. External Subsystem Source Protection Rule

- Only files inside the ATLAS repository may be edited during ATLAS work.
- Local clones of **EnrollPro, AIMS, SMART** are **READ_ONLY** reference mirrors. Never edit their source, config, migrations, lockfiles, generated files, docs, or Git history.
- Tests, builds, searches and runtime probes may run against a companion repo only if they do not rewrite tracked files, install/update dependencies, apply migrations, seed/reset data, or otherwise mutate that subsystem. No formatters, no write-mode or snapshot-updating runs.
- Before fetching or pulling a companion repo, verify its worktree is clean. If it is dirty: do not stash, reset, clean, or pull — report the state.
- **Sync before you inspect.** A companion mirror is evidence only at a recorded commit: fetch upstream, confirm the clone is clean, fast-forward it, and record the exact pin in the artifact. A stale mirror silently invalidates the comparison — the SMART UX baseline was authored against `c3806e12`/`1bda233` while upstream had advanced 34 commits, including companion-SSO and per-portal auth changes that bore directly on our work.
- Remotes differ and must be checked, not assumed: `D:/smart-final-capstone` tracks upstream `madebyseaan/smart-final-capstone`, while `D:/EnrollPro` and `D:/AIMS` track our forks (`njgrm/EnrollPro`, `njgrm/AIMS`). To bring a fork in step, first prove it has no fork-only commits (`git merge-base --is-ancestor fork/main upstream/main`), then fast-forward push it. **Never force-push a companion repo.**
- When a defect belongs to EnrollPro/AIMS/SMART, write a developer-facing handoff in `D:/ATLAS/docs/` with the upstream commit, exact source path/line evidence, the required contract, and acceptance tests. **Do not implement the external patch.**
- Prompt authors must label companion repos `READ_ONLY`. Phrases like "fix consumers", "complete end to end", or "make integration pass" do **not** grant write authority; an exception needs a new, explicit user instruction naming the repository and the exact write scope.

---

## 5. Server Runtime Safety Rule

- In `atlas-server/src`, relative imports used at runtime keep explicit ESM-safe endings such as `.js`.
- Do not introduce extensionless relative imports just because `tsc` accepts them.
- A backend change is not complete until **Node can actually start the built server**, not just type-check it.

---

## 6. Supervised Runtime And Log Probing Rule

- **Before any deployment, runtime, task, environment, or release-directory action, read `docs/reference/agent-runtime-deploy-facts.md`.** It carries the facts learned the hard way: the elevated-shell requirement, the SYSTEM supervisor and the tree-kill quiesce, the stale-state `ALREADY_RUNNING` trap, the repo-root `prisma generate` schema path, proving a deploy by fetching a chunk that only exists in the new build, the `VITE_ENROLLPRO_URL` fail-closed build guard, and the rule that only the active `ATLAS_RUNTIME_SOURCE_DIR` state file is authoritative.
- The host runs an auto-starting supervised runtime: scheduled task `ATLAS-Runtime-Supervisor` (SYSTEM, at system startup) launches `<sourceDir>/ops/runtime/cli.mjs`, which owns **port 5001** (`atlas-server/dist/server.js`) and **port 5174** (production host serving `atlas-client/dist`). `EADDRINUSE` on 5001, or "Port 5174 is in use, trying another one" from a manual `npm run dev`, is **expected behaviour, not a defect.**
- Both children stream into `<sourceDir>/ops/runtime/logs/atlas-supervisor.log`, with state in `supervisor-state.json` beside it. Read-only status: `node ops/runtime/cli.mjs status` from `<sourceDir>`.
- Resolve `<sourceDir>` from the task action or the supervisor process command line (`schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`). **Never assume a directory name or PIDs from a previous session.**
- Do not start, stop, or replace the supervisor or its children outside an approved deployment action.
- `/api/v1/health` is **liveness only** — it proves neither database nor route readiness. Probe a database-backed read such as `GET /api/v1/subjects?schoolId=<id>` alongside the supervisor log. Transient Prisma `P1001` and Postgres client-abort lines appear during antivirus scans; confirm with the DB-backed read before reporting an outage.

---

## 7. Timetable Invariants

Before planning, editing, or reviewing timetable generation, term scope, schedule views, exports, publication, latest-run reads, or timetable query shaping, read `docs/reference/agent-timetable-invariants.md`. Core fail-closed rules: missing term identity never becomes Term 1; one selected ordered term preserves subject/teacher/room and full weekly demand; published output has zero HARD violations; every consumer proves parity from one source run.

---

## 8. Frontend Constraints (MANDATORY)

- **No-Scroll Architecture:** protect the root `flex flex-col h-[calc(100svh-3.5rem)]` container; main scrolling regions use `flex-1 min-h-0 overflow-auto`. Never spawn global browser scrollbars.
- **Inline Stat Banners**, not massive metric Cards, for key figures.
- **DepEd colour codes** where grade meaning is encoded: **G7 green, G8 yellow, G9 red, G10 blue.**
- **No raw `<details>` or `title` attributes** for extra information — use `@/ui` `HoverCard` / `Tooltip` / `Popover`.
- **No native `<select>`**, no raw unstyled `<button>`. Route everything through `@/ui/*` primitives.
- **File size:** no React component file above **1000 physical lines** (blank lines and comments count). Extract sub-components before continuing.

---

## 9. Requirements Authoring (when asked for a PRD)

EARS syntax for every functional requirement; one behaviour per line; no implementation details.

| Type | Template |
|---|---|
| Ubiquitous | `The [system] shall [action].` |
| Event-driven | `When [trigger], the [system] shall [action].` |
| Unwanted behaviour | `If [condition], then the [system] shall [action].` |
| State-driven | `While [state], the [system] shall [action].` |
| Optional feature | `Where [feature is included], the [system] shall [action].` |

Ask clarifying questions **only** when a missing answer would materially change product intent, scope, authority, risk, or the result — never pause routine inspection, review, correction, testing, integration, or an already-defined task for a ceremonial question.

Produce: Overview · Scope (In/Out — Out is mandatory) · Actors · Functional requirements grouped and ID'd · Non-functional (quantified) · Acceptance criteria mapped to requirement IDs · Open questions · Assumptions · Dependencies.

---

## 10. Delivery Workflow (git-based)

1. **Branch per change:** `work/<stream>`, `fix/<topic>`, `feat/<topic>`, `integration/<release>`. Branch names must not name an AI agent, model, or vendor.
2. **Never implement, commit, merge, or push directly on `main`.** Only the integration owner merges to `main`, and only after acceptance.
3. **Record the base SHA** and confirm the worktree is clean before editing. If it is dirty or shared with another stream, stop and get an exact boundary — do not stash, reset, or absorb.
4. **Implement and test the real path.** Focused tests, plus a real route/workflow check when behaviour is wired into production. Negative controls for authority, concurrency, zero-write, or source-of-truth claims.
5. **Commit the candidate.** Stage only the assigned paths, check `git diff --cached --check`, write a conventional commit. The commit is a review candidate, not approval.
6. **Review by commit range** `<base>...<candidate>`. The accepting reviewer must not be the implementer.
7. **Correct additively.** A correction is a new commit on the same branch; never amend, rebase, or force-push a commit that has been handed off.
8. **Integrate and push** after acceptance, from a clean `integration/*` boundary, then retire the candidate worktree.
9. **"Worktree clean" means the complete `git status --short` is empty** — not that unrelated or ignored files were excluded.
10. **A progress ledger and a handoff are supporting evidence, never a substitute** for reviewing the committed production diff.
11. **Pushing a branch to `main` is an integration, not a documentation sync.** Keep the planner's continuity documents on a docs-only branch, or wait for acceptance. `git push <work-branch>:main` on a branch an executor has already committed to silently integrates unaccepted source — it did, moving `main` past the reviewed base and onto a shared branch that another lane also pulls. Verify the pushed range contains **only accepted commits** before every `:main` push.
12. **A candidate must exist in the shared repository, not in a clone.** A standalone clone (its own `.git`, its own `origin`) can accept a commit and report a SHA the integration boundary has never seen; `git merge <branch>` then silently integrates a *different, older* revision of that path. This happened on 2026-09-21 — a correction commit lived only in a clone under `E:/ATLAS-worktrees`, `main` briefly carried the uncorrected evidence, and the planner believed the corrected artifact had been pushed. Create a **registered worktree** (`git worktree add`, under the correct root), and before any integration or `:main` push prove the candidate is reachable from the shared repo: `git cat-file -t <sha>` from the integration boundary, and `<sha>` an ancestor of what you push.

### Handoff format (keep it short)

Base SHA · candidate SHA · exact changed paths · what changed and why · the decisive commands actually run with results · known risks, each marked `BLOCKING` or `NON_BLOCKING` · verdict. One page. No transcripts.

---

## 11. Risk Tiers And Verification

Classify by behaviour and authority, not ease of rollback. User-facing or production behaviour defaults to MEDIUM; a live action stays HIGH even when its source was already accepted.

### Review loops by tier — do not add ceremony

| Tier | Required loop |
| --- | --- |
| **LOW** — non-authorising docs, copy-only, test-only, or mechanically provable non-behavioural source | `executor self-check → planner review`. **No independent QA. No auditor.** |
| **MEDIUM** — production wiring, cross-layer shape, concurrency | `executor → one fresh QA → planner integration`. Auditor only if QA returns ambiguity, or the integration has genuinely overlapping changes. |
| **HIGH** — migration, destructive or production-data write, auth boundary, deployment, generation, publication, live apply | `independent packet review → explicit approval → executor → independent post-action QA`. Completion auditor only for irreversible writes, deployment failure, conflicting evidence, or publication. |

- **Batch the gates: one reviewer dispatch per pre-action, one per post-action.** For a HIGH cycle a **single** pre-action reviewer closes *all* pre-action gates in one pass — source range **and** the packet's satisfiability lint — and returns one verdict with per-row tallies; a **single** post-action QA closes every deployment row including zero-write corroboration. Target **≤ 2 reviewer dispatches per accepted release**. Name the reviewer's scope in the packet so the batching is designed, not improvised. Precedent: on 2026-09-21 a source review and a packet lint were one dispatch, and that dispatch falsified the packet's own D4 before the deployment ran — the batching lost nothing.
- **Documentation-only corrections — including a *packet* or evidence artifact whose defect is wording, not source:** the planner applies and verifies directly — no executor/QA loop, and **no second review round**, unless the document grants authority or contains a HIGH approval boundary.
- **Test-only corrections:** rerun the affected tests plus **one** relevant preservation suite; do not repeat builds or full regression inventories unless production code changed.
- **A test no gate runs is not evidence.** A new or changed test file must be reachable from a committed `package.json` script (or the documented gate entry point) in the same commit. Precedent: `test:ux-guardrails` named two files deleted by `4794bd9e` and still exited 0 with a green tally, and a C02 candidate added a 398-line test file with no script entry where the accepted candidate added one.
- **Record what you actually ran; never substitute silently.** When a row depends on a computed artifact — a hash, a signature map, a count — retain the literal command, SQL and serialization that produced it. If a step cannot be run literally, either stop and report it or record the literal text at the moment you deviate. Precedent: a deploy adapted the packet's SQL and repaired a task-XML encoding without retaining either, so its zero-write row could not be independently reproduced and an extra executor-plus-QA round was spent closing it.
- **A computed artifact is valid only for the revision and moment that produced it.** Never bind a later cycle's action to a stored hash, fingerprint or count: re-derive it live in the same session and bind its scope and time. Precedent: a term-cache apply packet was bound to a fingerprint captured a week earlier for a school year that had since gone inactive; the server's fail-closed checks made the packet unsatisfiable rather than dangerous, but it had to be re-baselined before it could run at all.
- **A control's fixture must come from the real surface, and a computed artifact's byte serialization must be recorded.** Two defects earned in one cycle (2026-09-21). (i) A presentation control validated a formatter against an **invented** fixture that already contained the correct text (`180 minutes`), while the real stored run used legacy wording (`180 consecutive teaching min`); the control passed, the release shipped, and the browser row failed on the live surface — a full release cycle to find what a real fixture would have caught in seconds. Take the fixture from the surface the row is about. (ii) A signature-map value reproduced only under one encoding (BOM + CRLF); the artifact said "trailing newline", so a reviewer reading it literally would derive a different hash. Record the SQL, the serialization **and** the byte encoding/line endings that produced the value.
- **Every acceptance row names the harness that decides it.** A row needing a browser, a login, or a deployed build is a deployment-acceptance clause, not a source row, and must be labelled as one when the packet is written. Precedent: two cycles lost a row to wording no available harness could decide, and one demanded a DOM-identity property the architecture could not provide.
- **Prove the outcome, not the wiring.** When a change alters what a user reaches, exercise that entry path end to end — the route entry, the click, the deep link — and assert the resulting state, not merely that a handler calls the right setter. Precedent: a route entry was correctly wired to the guarded setter and passed every assertion, yet a URL entry landed on the wrong left-rail panel because the in-app path also sets a companion state the route path skipped. Wiring tests pass on a pane the operator cannot use.
- **A bounded correction does not require a full re-review.** Review the *new commit and its blast radius*, not the whole range again — while proving the prior accepted commits remain ancestors, unchanged reviewed paths retain their accepted blobs, and one relevant preservation control passes.
- **Checkpoint large cycles.** Commit a coherent candidate every 45–60 minutes so a step limit resumes from a checkpoint instead of reconstructing the cycle.
- **One writer per stream.** Before dispatch the planner names the stream owner and worktree; no second planner or agent writes there until the owner releases it. Two planners on one stream is a custody defect, not parallelism.
- **A release must not ship source that no independent reviewer has seen.** A lane that implements *and integrates* its own work leaves the next consumer holding unreviewed production behaviour. When a release would carry such a delta, its packet opens with a review gate for **that delta alone** — one fresh reviewer, the source range and the packet lint in the same pass — and the deployment must not execute on `CORRECTION_REQUIRED`. Precedent: an actor-school residual lane was merged with no committed review evidence; the release packet that would have deployed it carried that review as a gate, and the reviewer reproduced a failing-first control before the deployment ran.

### Gates that have actually caught defects — keep these

For MEDIUM and HIGH work, read `docs/reference/agent-verification-gates.md` and apply only the gates relevant to the change. Production-path proof, failing-first proof, scope authority, and zero-write rejection stay mandatory when applicable. Live browser evidence never proves undeployed source bytes.

---

## 12. Live Browser QA

Before any browser, UX/UI, responsive, authenticated, or cross-app evidence task, load `atlas-live-browser-qa` (source: `docs/reference/agent-live-browser-qa.md`). The live database is **test data** (operator, 2026-09-25); QA exists to produce acceptance, not to avoid touching the app.

- **Sessions are seeded, not typed.** Each agent's browser profile holds a "remember me" session (30-day cookie) that the operator seeds by logging in once per profile. Agents reuse it; QA-account login audit rows are expected and need no authorization. With no valid session, report `NEEDS_SESSION(<agent>/<profile>)` in one line and continue with the other rows — the operator re-seeds in about a minute. An agent whose own tool rules allow it may log in with the QA account; one whose rules forbid entering passwords relies on the seeded session.
- **Ordinary UI mutations are allowed** when an acceptance row needs them (save, apply, toggle, upload, download). Generation, publication, deletion, anything that changes the published run, and account/SSO/role changes stay HIGH under §13 (the standing authorization covers them with its gates).
- One agent per browser profile at a time; separate profiles per agent may run in parallel. Live Tailnet evidence never proves undeployed source bytes.
- **Never echo a credential value** into a prompt, log, doc, commit, screenshot or transcript. Observed 2026-09-23: the QA credential was found in 8 plaintext files plus an agent transcript, because the credential file wraps values in markdown backticks and a naive parse submitted them literally.
- Observed 2026-09-25: three consecutive releases shipped `PARTIAL (AUTH_SESSION_REQUIRED)` because this section required an authorized login while also forbidding a credential "in a browser field". Operator-approved relaxation, 2026-09-25.

---

## 13. HIGH Actions Require Explicit Approval

Deployment, schema/migration apply, live-data mutation, generation, publication, and runtime/task/env changes are HIGH **even when a prompt or report labels them LOW**.

- Before acting: name the exact target, the expected delta, the rollback, and the verification. Present it. **Wait for a clear instruction to proceed.**
- A plain "yes, deploy" or "go ahead" is sufficient. Do not demand notarised wording.
- Keep deployment and acceptance as **separate outcomes** — a healthy deployed process may be `DEPLOYED` while required acceptance is incomplete; do not call it done.
- **A deployment that defers browser acceptance names its acceptance owner** (the lane or agent holding browser custody, e.g. Codex) in the `Live release` block, and hands that owner the release SHA and the acceptance rows. The owner records the result there. On 2026-09-25 the live release `37e0c85b` sat `PARTIAL` because acceptance was deferred to another agent with no named owner to close it.
- Never run reset-style schema commands (`prisma db push --force-reset`, `prisma migrate reset`) against a shared or live database. Record host, database name, environment, and migration count before any schema command.
- **Unexpected shared-data mutation is an incident stop.** Preserve evidence; do not continue against the altered state.
- If a required listener is unexpectedly absent, the plan has changed — do not execute a swap packet unchanged. Prepare a deploy-as-restore with the last accepted artifact as a startable fallback.
- **Standing authorization and one-shot packets.** The operator may grant standing authorization for a class of HIGH actions — deployment, browser acceptance — for a named program. Under it one packet may bundle source, deployment and browser acceptance in a single cycle, and the approval round-trip is waived. **No gate is waived with it:** independent pre-action review, one executor, one fresh independent post-action QA, browser rows labelled as browser rows, and a real `passed/blocked/unperformed` tally all still apply, with every acceptance row reporting its own result. Standing authorization removes waiting, never evidence.

---

## 14. Parallel Work And Planners

- Separate worktrees, separate branches, **disjoint file ownership**; one owner per stream. Coordinate through Git, not through a shared status file.
- **Name the owning lane in every new worktree path**: `E:/ATLAS-worktrees/lane-<a|b|c>-<stream>`. On 2026-09-25 a reclaim found 19 clean-but-unmerged and 9 dirty worktrees whose owner nothing recorded, so none could be retired or handed over.
- **`D:/ATLAS` is the shared repo root and reference checkout — not a workspace.** Sessions may be *launched* there (opencode resolves a project's `.opencode/agents/`, `AGENTS.md` and `live-state.md` from the checkout, so those files bind the session), but never *edited* there; all edits happen in a registered worktree. **Standing step before creating a worktree or starting/restarting a session at `D:/ATLAS`: `git -C D:/ATLAS fetch origin --prune` then `git -C D:/ATLAS merge --ff-only origin/main`.** If it is dirty or not a fast-forward, stop and report — never stash, reset, or absorb. Agent definitions come from the checkout, so a stale `D:/ATLAS` silently binds sessions to old models and stale directives (observed 2026-09-25: 84 commits behind, so a planner's spawned executors ran the previous model while the global config said otherwise). **Restart the session after fast-forwarding — agent config is read at startup.**
- **A lane in an integration closure gets an exclusive `main` push window.** The other lane holds its pushes until that integration lands. Continuity-document commits are cheap and frequent, which makes `main` a moving target: on 2026-09-21 Lane A's docs pushes invalidated Lane B's integration base twice in a row, each time after a clean merge and green gates. When a lane announces an integration, stop pushing to `main` until it reports the push landed.
- Browser work is serialised (one controller, §12); source and non-browser work run in parallel freely.
- Only one stream may swap or restart the shared 5001/5174 runtime at a time; others use isolated ports and label their evidence `isolated`.
- Every temporary process, browser, fixture and database has a named cleanup owner.

---

## 15. Live State Document

Maintain **one short file** — `docs/plans/live-state.md` — updated **only when state changes**: what release is live and its SHA, what is blocked and by what, what is awaiting a decision, and the single next action.

Do not maintain a per-transition register, state machine, lease table, or receipt chain. Git history plus this one file are the continuity record: if a session dies, these and the branches are enough to resume.

**Date every blocker and every "not done" claim, and name what proves it.** An undated "still pending" line is a premise error waiting to happen: on 2026-09-21 a session spent a packet, an independent review and an executor dispatch on a term-cache apply that had already been satisfied three days earlier, because the line saying it was unbound carried no date and contradicted a zero-HARD published run recorded elsewhere in the same file. **Reconcile the whole file — or the newest dated handoff — before acting on any blocker line.**

**If more than one lane co-maintains this file, partition it into lane-owned sections** and edit only your own — plus the live-release block when you deploy. Disjoint regions merge cleanly, so two planners can work in parallel without a custody defect; a second writer inside your section is one.

**Keep each lane section under ~40 lines: current stream, dated blockers, next action.** Move finished-cycle narrative into the lane's handoff when the cycle closes. Queue and "what remains" lists are blocker lines too — date them. On 2026-09-25 the file had grown to 1,340 lines, and an undated queue in it assigned a lane to `warning-readability-c01`, integrated four days earlier.

---

## 16. Evidence And Cost Discipline

- **One evidence object per role.** Executor: one commit and one short handoff. Reviewer: one verdict. Planner: one integration result. No parallel ledgers, manifests, or summaries for the same fact.
- **A mandatory row is never "not applicable".** Run it, or report it `BLOCKED` or `UNPERFORMED` with the reason. Declaring a row inapplicable without executing it is a false report, not a judgement call.
- **Corrections are additive to evidence, never subtractive.** Never delete a control, assertion, or evidence row to close a finding — mark it superseded and add the replacement beside it. A correction that removes evidence fails review regardless of whether the fix is correct.
- **The executor deny-list is not a containment boundary.** It matches command prefixes and misses wrapped or prefixed invocations. Reviewers check `git stash list` and the reflog; "zero residue" means the stash list, reflog, untracked files and worktree status are all clean.
- **Git is the integrity mechanism.** No per-file hash inventories, receipt chains, or reviewer-allowlist validators for ordinary work; fingerprints remain for destructive data work, migrations, publication, and backup/restore.
- **Three verification tiers:** executor focused gates → independent review of the decisive subset plus adversarial production-path checks → combined gates once at integration. Do not repeat a tier without a source or environment change.
- **Use the cheapest model that can do the job.** Escalate for architecture, conflicting candidates, security, concurrency, or a HIGH action. A model label never substitutes for evidence.
- **Do not reload this directive from disk** when it is already in context; use targeted reads only to recover a specific rule.

### Token economy — coordination is context

The durable rule: avoid duplicated coordination that produces no new evidence. Keep measured cost figures in workflow-analysis artifacts, not here. **The operating notes — fresh sessions at durable lane boundaries, pointing at artifacts instead of pasting them, batching shell checks, capping outputs, prompt-prefix stability, one context manager, minimal global tool surfaces, batched reviewer dispatches and turn shape — live in `docs/reference/agent-context-economy.md`; read it before changing how a lane is run.** Three rules stay normative here:

- **Do not re-verify a stable fact merely for reassurance.** Always reverify after a source merge, runtime or environment change, custody transition, meaningful elapsed time for an external dependency, concurrent `origin/main` advance, and immediately before a HIGH mutation.
- **Fewer, longer turns; at most two reviewer dispatches per release** (`§11`). The dominant cost is context re-read per turn, not the work inside it. Finish a cycle in one turn unless a real decision or approval is needed, and never split one coherent delivery across turns to report progress.
- Immutable commit ranges are cheap. Independent QA is expensive but intentionally retained where the risk justifies its cost; this rule targets exploratory volume and duplicated coordination, not discipline.
