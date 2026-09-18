---
name: atlas-project-directive
description: ATLAS project directive. Lean by design — keep the rules that change behaviour under time pressure; delete process that only records it.
---

# ATLAS Project Directive

**Read this once. It is deliberately short.** Everything here has either caused a
real defect when ignored or prevented one when followed. If a rule is not here, it
is not a rule — use judgement.

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

---

## 7. Timetable Invariants

These encode real school contracts. Breaking one produces a schedule that looks
plausible and is wrong.

- **Term authority is separate from cell rendering.** An academic term is the
  authoritative scope of a schedule, not an extra visual cell. A term switcher
  selects **one** verified ordered term; it must never merge terms into one weekly
  cell, encode rotation as a badge, or let an all-term export masquerade as a
  beneficiary-facing program.
- **Ordered terms:** the current beneficiary contract is **three ordered terms**.
  Missing term identity is unresolved authority — it must never silently become
  Term 1. A rotating family resolves its subject/teacher/room and its **full weekly
  session count per selected term**; rotation picks the term's member, it does not
  split one term's sessions across the year.
- **Breaks and ceremonies:** a `LUNCH_BREAK`/`HEALTH_BREAK` is a real non-teaching
  period and blocks placement. A Flag/HGP ceremony occupies its period per the
  school's class program — **read the stakeholder files**; do not assume it is an
  overlay or a displacement without checking the actual program.
- **Beneficiary output:** every export, room view, teacher view, section view,
  public read, and published revision must preserve
  `(termIndex, day, interval, section, subject, faculty, room)` and prove parity from
  one source run.
- **Publication gate:** zero HARD violations. Soft warnings require an explicit
  acknowledgement, not silence.
- **Timetable latest-run reads are memory-sensitive.** For
  `/generation/.../runs/latest`, `/latest/timetable`, `/latest/violations`: prefer
  lightweight candidate selection, minimal heavy-row reads, and in-place
  normalisation. Do not load every completed run with full JSON payloads, and do not
  clone or remap `draftEntries`/`violations` on read paths without justification.
- **Query-shaping changes** must prove both behaviour (targeted output equals the
  full source-of-truth output for matching *and* missing cases) and shape (the
  optimised path avoids the specific large field or broad query). For JSON-array
  extraction from persisted payloads, preserve response order explicitly (e.g.
  `WITH ORDINALITY`). A probe that picks a different run than the service resolver,
  compares against unrevised base entries when the runtime contract is
  revision-effective, only prints samples without failing on mismatch, or still
  loads the whole heavy payload on the production path is **not** proof.

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

- **LOW** — reversible source, test, UI, or docs with no authority or data boundary.
  Executor diff review plus focused tests. No independent reviewer required.
- **MEDIUM** — production wiring, behaviour replacement, cross-layer shape changes,
  concurrency logic. One independent review of the commit range, plus negative
  controls.
- **HIGH** — schema/migration apply, destructive or production-data mutation,
  auth/authorization boundaries, deployment/cutover, generation, publication,
  live-data apply. Independent review **before** the action, exact target, explicit
  approval, rollback, and post-action verification.

### Gates that have actually caught defects — keep these

1. **Production-path proof.** Exercise the real route or service. A helper-only test
   or a grep count is not evidence.
2. **Failing-first.** Prove the test fails without the fix. A test written after the
   fix that never failed proves nothing.
3. **Production-shape equivalence.** When a change translates, filters, groups,
   defaults, persists, or renders data from another layer, trace
   `authoritative input → producer → persisted form → API projection → consumer` and
   record the conservation invariant (identities, counts, ordering, scope, totals).
   A synthetic fixture is admissible only if a test proves it is field-for-field
   equivalent to real producer output. Treat `missing`, `unknown`, `all`, and a
   concrete value as **separate states** — never coerce one into another.
4. **Authority and tenant scope.** Any actor- or tenant-scoped client path with a
   fallback like `schoolId = 1`, `?? 1`, or `|| 1` is fail-open and blocks acceptance
   unless the route is explicitly public. Scope changes must invalidate stale
   previews, confirmations, caches, and pending mutations before the new scope can
   act.
5. **Set-valued invariants.** When correctness depends on "exactly one active year /
   current revision / authoritative owner", the write transaction must re-read and
   validate the **complete qualifying set**, not just the previously selected row,
   and a negative control must prove the write aborts with zero residue.
6. **Zero-write on rejection.** Prove no downstream dispatch and no writes when
   authority, freshness, or concurrency checks reject.
7. **Live browser QA on the Tailnet** is the default acceptance for user-facing work.
   See §12.

---

## 12. Live Browser QA

- Test against **`https://njgrm.buru-degree.ts.net`** — the real environment.
  `localhost` reflects only the local process and hides deployment, proxy, routing,
  and cross-service behaviour. Use it only for an explicitly-labelled isolated check.
- Every browser claim must assert
  `window.location.origin === "https://njgrm.buru-degree.ts.net"` and cite the exact
  route, an accessibility snapshot (preferred over screenshots), console errors, and
  relevant network statuses. State the viewport(s) tested — desktop `1366x768` and
  mobile `390x844` for responsive work.
- For EnrollPro-owned or cross-app work, start at
  `https://dev-jegs.buru-degree.ts.net/personnel/login` and assert the EnrollPro
  origin. Evidence from one origin never proves the other's behaviour.
- **Credentials** live at `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`.
  Read the minimum needed, never print, screenshot, persist, or commit them, and
  never recreate the retired faculty identifier `2000056`. If the file is absent,
  report `EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE)`.
- **Login is an authorised mutation boundary.** A reusable session may be consumed
  read-only. A fresh login creates a `LOCAL_LOGIN_SUCCESS` audit row — disclose it
  and the account's `last_login_at` delta. Do not silently log in.
- **One controller per browser profile.** Exactly one agent may drive the shared
  profile at a time. Serialise browser work through a named custody handoff; never
  launch competing browser roles.
- **Read-only by default.** Do not submit forms that persist data or click
  Save/Apply/Generate/Publish/Delete unless the active task explicitly authorises
  that exact write.
- **Rendered truth beats status codes.** A page returning 200 that shows stale,
  empty, or contradictory state is a finding — verify against the snapshot.
- Known-benign noise: a `404` on `/generation/:schoolId/:year/runs/latest` or
  `.../room-preferences/.../summary` means "no current run/preferences yet".

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
