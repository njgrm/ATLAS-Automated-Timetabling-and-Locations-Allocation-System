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
- Before creating a worktree, installing dependencies, or starting a heavy build, record the target volume's free space. On `D:`, **warn below 25 GiB, fail closed below 15 GiB** — PostgreSQL lives on `D:`, so database headroom is part of this gate. On `E:`, **warn below 25 GiB, fail closed below 15 GiB**, the same as `D:` (operator, 2026-09-26: the 50 GiB warning kept holding releases back). Every new worktree and release directory lands there, and a release build plus cycle work can use ~14 GiB in two hours (observed 2026-09-25: 50 → 36 GiB), so measure before every build.
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

- **Bare test runs never touch live (2026-09-29).** `D:/ATLAS/atlas-server/.env` now points at `atlas_staging`; never
  point it at the live database. DB-writing suites run only through `npm run test:server-db` (disposable
  `atlas_restore_drill_*`), and must fail closed when the connected database name is not disposable. Incident: a bare
  `enrollpro-rollover-automation.test.ts` run wrote 5 `schools` rows into LIVE (live-state.md 02:25).
- **Loopback previews never talk to live (2026-09-29).** A candidate `vite preview`/`dev` for rendered proof must proxy
  to the STAGING API: start it with `VITE_ATLAS_API=http://127.0.0.1:5101`. The default target `127.0.0.1:5001` is the
  LIVE server: the candidate UI then reads and could write production data, and login fails on `http://127.0.0.1`
  because live issues Secure cookies (operator saw "Failed to load subjects" / "No saved data" after logging in on :5292).

## 6. Supervised Runtime And Log Probing Rule

- **Before any deployment, runtime, task, environment, or release-directory action, read `docs/reference/agent-runtime-deploy-facts.md`.** It carries the facts learned the hard way: the elevated-shell requirement, the SYSTEM supervisor and the tree-kill quiesce, the stale-state `ALREADY_RUNNING` trap, the repo-root `prisma generate` schema path, proving a deploy by fetching a chunk that only exists in the new build, the `VITE_ENROLLPRO_URL` fail-closed build guard, and the rule that only the active `ATLAS_RUNTIME_SOURCE_DIR` state file is authoritative.
- The host runs an auto-starting supervised runtime: scheduled task `ATLAS-Runtime-Supervisor` (SYSTEM, at system startup) launches `<sourceDir>/ops/runtime/cli.mjs`, which owns **port 5001** (`atlas-server/dist/server.js`) and **port 5174** (production host serving `atlas-client/dist`). `EADDRINUSE` on 5001, or "Port 5174 is in use, trying another one" from a manual `npm run dev`, is **expected behaviour, not a defect.**
- Both children stream into `<sourceDir>/ops/runtime/logs/atlas-supervisor.log`, with state in `supervisor-state.json` beside it. Read-only status: `node ops/runtime/cli.mjs status` from `<sourceDir>`.
- Resolve `<sourceDir>` from the task action or the supervisor process command line (`schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`). **Never assume a directory name or PIDs from a previous session.**
- Do not start, stop, or replace the supervisor or its children outside an approved deployment action.
- `/api/v1/health` is **liveness only** — it proves neither database nor route readiness. Probe a database-backed read such as `GET /api/v1/subjects?schoolId=<id>` alongside the supervisor log. Transient Prisma `P1001` and Postgres client-abort lines appear during antivirus scans; confirm with the DB-backed read before reporting an outage.
- **Never read runtime identity from your own environment.** A long-lived shell's *inherited* `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` can be several releases stale and **override machine scope**, so `cli.mjs status` and the deploy runner resolve the wrong release and report dead child PIDs — which reads exactly like a downed or misconfigured runtime. Observed 2026-09-26: a shell inheriting `26f7c907` reported a displaced release while machine scope, the task action and the live listeners all correctly served `e4989b72`, and it briefly became a false "deploy incomplete" report. **Decide identity from `[Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_SOURCE_DIR','Machine')`, the scheduled-task action, and the listener command lines — never from `Env:`.** Inject those values explicitly into any executing shell.
- **`productPin` is not the live release.** `supervisor-state.json` carries a reviewed *ancestor milestone* in `productPin`, and `verifyProductPin` only enforces `isAncestor(productPin, head)`. It is a designed floor. Live identity is `releaseSha` + `sourceDir`.

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
- **One look per control (operator, 2026-09-29):** controls that do the same job look and behave the same on every page. Every picker (Section, Teacher, Subject, Room, Term, Year) is the same `@/ui` primitive with the same trigger size, border, placeholder style and search behaviour; buttons of the same role share one variant. No page-local `className` overrides that change a primitive's look. Before adding a control, find the existing one and reuse it; if it truly needs a new variant, add the variant to `@/ui` so every page gets it. QA of any header or form compares its controls side by side with another page's and fails a mismatch.
- **Header budget, less is more (operator, 2026-09-29):** a page header is at most two calm rows at 1366x768: row 1 = title, tabs, ONE status chip, the primary action and `More`; row 2 = the pickers. No sentence is cut off with an ellipsis; no helper sentence under a button (put it in a `Tooltip`); disabled actions with nothing to do (Undo/Redo/History/Discard with no draft) are hidden or live under `More`; never two chips that say the same thing. Long explanations become one short link (e.g. `468 setup items to fix`) that opens the detail. Squeezing more into fewer rows is not the goal; less on screen is.
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
| **VISUAL** — user-facing wording, layout, styling, tooltips, empty/loading states, with **no** data, state, auth, route-target or API change (operator, 2026-09-28) | `executor → rendered evidence (loopback screenshot or live row) → planner integration`. **No separate review round; no failing-first unit test required.** A copy change that alters what a number or status *claims* is MEDIUM. |
| **MEDIUM** — production wiring, cross-layer shape, concurrency | `executor → one fresh QA → planner integration`. Auditor only if QA returns ambiguity, or the integration has genuinely overlapping changes. |
| **HIGH** — migration, destructive or production-data write, auth boundary, deployment, generation, publication, live apply | `independent packet review → explicit approval → executor → independent post-action QA`. Completion auditor only for irreversible writes, deployment failure, conflicting evidence, or publication. |

- **Batch the gates: one reviewer dispatch per pre-action, one per post-action.** For a HIGH cycle a **single** pre-action reviewer closes *all* pre-action gates in one pass — source range **and** the packet's satisfiability lint — and returns one verdict with per-row tallies; a **single** post-action QA closes every deployment row including zero-write corroboration. Target **≤ 2 reviewer dispatches per accepted release**. Name the reviewer's scope in the packet so the batching is designed, not improvised. Precedent: on 2026-09-21 a source review and a packet lint were one dispatch, and that dispatch falsified the packet's own D4 before the deployment ran — the batching lost nothing.
- **Documentation-only corrections — including a *packet* or evidence artifact whose defect is wording, not source:** the planner applies and verifies directly — no executor/QA loop, and **no second review round**, unless the document grants authority or contains a HIGH approval boundary.
- **Test-only corrections:** rerun the affected tests plus **one** relevant preservation suite; do not repeat builds or full regression inventories unless production code changed.
- **A test no gate runs is not evidence.** A new or changed test file must be reachable from a committed `package.json` script (or the documented gate entry point) in the same commit. Precedent: `test:ux-guardrails` named two files deleted by `4794bd9e` and still exited 0 with a green tally, and a C02 candidate added a 398-line test file with no script entry where the accepted candidate added one.
- **Record what you actually ran; never substitute silently.** When a row depends on a computed artifact — a hash, a signature map, a count — retain the literal command, SQL and serialization that produced it. If a step cannot be run literally, either stop and report it or record the literal text at the moment you deviate. Precedent: a deploy adapted the packet's SQL and repaired a task-XML encoding without retaining either, so its zero-write row could not be independently reproduced and an extra executor-plus-QA round was spent closing it.
- **Count the rows of a baseline against the list it protects, and pin the counting method.** A tripwire whose baseline is short by one row cannot detect the damage it exists to detect, and the row most likely to be dropped is the load-bearing one. Observed 2026-09-26: a reclaim tripwire listed four `node_modules` counts for **five** protected directories, omitting the dependency donor's `156` — the only value three live lanes depend on. An independent reviewer caught it before the removal. Also record *how* a count was taken: `-Directory` and all-children differ by the files present, and a later auditor using the other reading reports a spurious mismatch. Two further readings that read as line counts but are not: `git worktree list` prints linked registrations **plus the main worktree**, and `git worktree list --porcelain` counts `worktree` records, not lines.
- **A computed artifact is valid only for the revision and moment that produced it.** Never bind a later cycle's action to a stored hash, fingerprint or count: re-derive it live in the same session and bind its scope and time. Precedent: a term-cache apply packet was bound to a fingerprint captured a week earlier for a school year that had since gone inactive; the server's fail-closed checks made the packet unsatisfiable rather than dangerous, but it had to be re-baselined before it could run at all.
- **A control's fixture must come from the real surface, and a computed artifact's byte serialization must be recorded.** Two defects earned in one cycle (2026-09-21). (i) A presentation control validated a formatter against an **invented** fixture that already contained the correct text (`180 minutes`), while the real stored run used legacy wording (`180 consecutive teaching min`); the control passed, the release shipped, and the browser row failed on the live surface — a full release cycle to find what a real fixture would have caught in seconds. Take the fixture from the surface the row is about. (ii) A signature-map value reproduced only under one encoding (BOM + CRLF); the artifact said "trailing newline", so a reviewer reading it literally would derive a different hash. Record the SQL, the serialization **and** the byte encoding/line endings that produced the value.
- **Every acceptance row names the harness that decides it.** A row needing a browser, a login, or a deployed build is a deployment-acceptance clause, not a source row, and must be labelled as one when the packet is written. Precedent: two cycles lost a row to wording no available harness could decide, and one demanded a DOM-identity property the architecture could not provide.
- **A proof artefact must actually discriminate — check that it differs before relying on it.** "Byte-compare a chunk that exists only in the new build" fails when the file you picked is a thin entry stub, a shared chunk, or an unchanged path, and then the proof is vacuously true. Observed 2026-09-26: the planned deploy discriminator was the removed credential literal in `atlas-server/dist/server.js` — a **3 KB stub that was byte-identical across both builds**, so it would have reported "no difference" on a deploy that genuinely changed the auth chunk. Run the comparison **before** the cutover: if new and old are identical, that is not a passing proof, it is the wrong artefact. Locate the marker in the real chunk (`atlas-server/dist/services/local-auth.service.js`, not `dist/server.js`) and confirm new ≠ old plus the specific expected presence/absence on each side.
- **Prove the outcome, not the wiring.** When a change alters what a user reaches, exercise that entry path end to end — the route entry, the click, the deep link — and assert the resulting state, not merely that a handler calls the right setter. Precedent: a route entry was correctly wired to the guarded setter and passed every assertion, yet a URL entry landed on the wrong left-rail panel because the in-app path also sets a companion state the route path skipped. Wiring tests pass on a pane the operator cannot use.
- **A bounded correction does not require a full re-review.** Review the *new commit and its blast radius*, not the whole range again — while proving the prior accepted commits remain ancestors, unchanged reviewed paths retain their accepted blobs, and one relevant preservation control passes.
- **Checkpoint large cycles.** Commit a coherent candidate every 45–60 minutes so a step limit resumes from a checkpoint instead of reconstructing the cycle.
- **One writer per stream.** Before dispatch the planner names the stream owner and worktree; no second planner or agent writes there until the owner releases it. Two planners on one stream is a custody defect, not parallelism.
- **A release must not ship source that no independent reviewer has seen.** A lane that implements *and integrates* its own work leaves the next consumer holding unreviewed production behaviour. When a release would carry such a delta, its packet opens with a review gate for **that delta alone** — one fresh reviewer, the source range and the packet lint in the same pass — and the deployment must not execute on `CORRECTION_REQUIRED`. Precedent: an actor-school residual lane was merged with no committed review evidence; the release packet that would have deployed it carried that review as a gate, and the reviewer reproduced a failing-first control before the deployment ran.

### Done means seen (operator, 2026-09-28)

- **A user-facing fix is done when it is seen rendered** — on the live Tailnet after release, or on a loopback build of
  the candidate before it — with the before and after quoted or screenshotted. Unit and source tests support that
  proof; they never replace it. **A test that only asserts source text (a string, an import, a prop name in a file) is
  not acceptance evidence for a user-facing change.** Evidence from the 2026-09-27/28 night: #62 passed 7/7 tests while
  the live warnings chip still changed with the term (B9); "Build a new draft" passed QA while the menu still said
  "Generate" (B18); about 13,400 test lines and 6,200 doc lines shipped against about 4,400 product lines, and the
  worst live defect (Term 2 Monday rearranged with an empty history) passed every gate.
- **Scope packets by screen, demo path first:** each item names the route, what the user sees now (quoted) and what
  they must see after. Grade user-facing work for older, mouse-first schedulers: fewer words, one verb per action, a
  visual cue beside every status, less is more.
- **Release small and often.** Once candidates are integrated, ship them within hours, not at the end of a night. A
  VISUAL-only release keeps the D-rows (health, discriminators, zero-write, public matrix) plus **one browser smoke
  row per changed screen**; the full browser row set is for releases that carry MEDIUM/HIGH work.

### Design judgement gate (operator, 2026-09-29)

Operator and members, 2026-09-29: changes "have not been graceful, they've been too literal, like no thought was put
into the changes and they just passed QA like UX/UI was never considered." Evidence on live Tailnet: the `/timetable`
header squeezed to 2 rows by cramming (truncated sentences, helper text under buttons, two chips saying "no schedule");
the Teaching Load header "compaction … not graceful"; Subjects filters as pills beside rectangular pickers, two reading
`All...`, spelled-out program names, raw `OWNER_DEPT:` strings. Each passed its tests, its QA and a screenshot. Causes:
packets said *what to change*, not *what the user should feel*; executors met the letter; "seen" meant a screenshot
existed, not that anyone judged it; every fix **added** a line, chip or sentence and nothing was taken away.

Rules for every user-facing change:
1. **Packets state intent, not just instructions.** Name the user (older, mouse-first scheduler), the task on that
   screen, and what should feel different (calmer, one obvious next step). A literal rule such as "2 rows" is a limit,
   never the goal: meeting it by cramming fails.
2. **Design before code.** The executor writes a short layout note (what stays, what goes, what moves behind a Tooltip,
   `More` or a detail) and checks it against §8 and the page patterns before writing JSX.
3. **Subtract first.** A change may not add visible words, chips, lines or controls to a region without removing at
   least as much, unless the packet says why. Prefer deleting, merging and hiding idle things over rewording.
4. **Judged, not just seen.** Before merge, a reviewer who did not build it compares before/after screenshots at
   1366x768 and scores them against `ux-communication-rubric`: one primary action, no truncation, no jargon or raw codes,
   one status per fact, controls matching other pages (§8 One look per control), nothing cramped. Any miss =
   `REJECT_UX`, even when every test passes. Lane C's staging Codex walk (older-user view) is the second judge and
   **blocks** the release of that screen; its findings do not just get routed.
5. **Copy what works.** Headers, filter bars, table rows, status chips and empty states follow the one page that does it
   best (named in the packet); no lane invents a local variant.

### Throughput rules (operator, 2026-09-28 afternoon)

Evidence: ~10 planner cycles from 2026-09-27 night to 2026-09-28 14:00 put 6 fixes live; three releases stalled on
non-risks; A3 marked 4 items QA_PASSED against its own narrowed rewrites.

- **Two review rounds, then decide.** After a second `CORRECTION_REQUIRED` on the same candidate, the planner either
  ships the corrected candidate with the open finding recorded as a follow-up row, or drops it from the cycle. No
  third round. BLOCKING safety findings (data loss, auth, live writes) are the only exception.
- **Grade against the requester's own words.** A ledger row quotes the original requirement; a narrower rewrite
  cannot be marked met. Lane C's live walk against the original text is the verdict.
- **The cycle metric is fixes seen live.** A handoff opens with "N fixes live and seen / M integrated / K dropped".
  Self-corrections of the planner's own records go in one line, not a section.
- **Real-route smoke before "ready".** A lane's ready post must include a loopback Playwright run (built client, mocked
  `/api/v1`, `ISOLATED_LOCAL_BROWSER`) that loads every route the slice touched from loading to resolved data and fails
  on any error boundary or console error. Evidence 2026-09-28: `e59b8ba1` passed 41/41 jsdom QA and crashed `/timetable`
  on staging with React #310 on every load.
  **Server lifecycle for that run:** start the preview with `Start-Process -WindowStyle Hidden -PassThru`, poll the
  port with a 60 s cap, run the smoke, then `Stop-Process` that PID in the SAME command (try/finally). Never run
  `vite preview`, `npm run dev` or `node dist/server.js` as a foreground command: a tool call that waits on a server
  never returns (A6 hung 60 min and A5/A3 stalled on 2026-09-28 until Lane C killed their previews).
- **Staging first.** Once staging exists (§14 A4), a candidate counts as ready only after it renders on staging and
  the lane's rows pass there; production then needs only the A4 smoke.

### Gates that have actually caught defects — keep these

For MEDIUM and HIGH work, read `docs/reference/agent-verification-gates.md` and apply only the gates relevant to the change. Production-path proof, failing-first proof, scope authority, and zero-write rejection stay mandatory when applicable. Live browser evidence never proves undeployed source bytes.

---

## 12. Live Browser QA

**The live ATLAS origin is `https://njgrm.buru-degree.ts.net`.** Use it for all ATLAS browser evidence and **assert `window.location.origin`** on every evidence row. `http://127.0.0.1:5174` reaches the same supervisor-served release, but it is a **different origin**: an ATLAS login cookie is not sent to it, so a session seeded on the Tailnet host is invisible there, and evidence gathered on loopback is an explicitly labeled *isolated* check, never ATLAS acceptance. EnrollPro-owned or cross-app work starts at `https://dev-jegs.buru-degree.ts.net` and asserts its own origin; evidence from one origin never proves the other. **Observed 2026-09-27: a planner opened `127.0.0.1:5174` for a Tailnet acceptance row because this section named no origin at all** - the URL existed only in two reference docs, one behind a skill that the active harness denied, so the environment had to be guessed. The named origin is the fix.

Before any browser, UX/UI, responsive, authenticated, or cross-app evidence task, **read `docs/reference/agent-live-browser-qa.md`**. Load the `atlas-live-browser-qa` skill as well **if the harness permits it** - the skill is an accelerator, never the primary route. **Observed 2026-09-27: that skill was unloadable in an active opencode harness - no config file on disk carried any `skill` permission block, yet all seven ATLAS skills were denied and an unrelated allowlist was honoured.** A directive whose mandatory step cannot be executed is a trap, so the doc read is the instruction and the skill is optional. The live database is **test data** (operator, 2026-09-25); QA exists to produce acceptance, not to avoid touching the app.

- **Sessions are seeded, not typed.** Each agent's browser profile holds a "remember me" session (30-day cookie) that the operator seeds by logging in once per profile. Agents reuse it; QA-account login audit rows are expected and need no authorization. With no valid session, report `NEEDS_SESSION(<agent>/<profile>)` in one line and continue with the other rows — the operator re-seeds in about a minute. An agent whose own tool rules allow it may log in with the QA account; one whose rules forbid entering passwords relies on the seeded session.
- **Ordinary UI mutations are allowed** when an acceptance row needs them (save, apply, toggle, upload, download). Generation, publication, deletion, anything that changes the published run, and account/SSO/role changes stay HIGH under §13 (the standing authorization covers them with its gates).
- **Sessions last 8 hours** (2026-09-28): "Remember me" is not implemented (the login never sends it; the token has no refresh), so re-seed each profile at the start of a working day and within 8 hours of a demo. A deploy does **not** sign users out.
- **One signed-in profile per lane** (A2, A3, Lane C Chrome, Codex). An **elevated** browser locks its profile against a non-elevated agent; never share one profile across an elevated and a non-elevated lane.
- One agent per browser profile at a time; separate profiles per agent may run in parallel. Live Tailnet evidence never proves undeployed source bytes.
- **Never echo a credential value** into a prompt, log, doc, commit, screenshot or transcript. Observed 2026-09-23: the QA credential was found in 8 plaintext files plus an agent transcript, because the credential file wraps values in markdown backticks and a naive parse submitted them literally.
- Observed 2026-09-25: three consecutive releases shipped `PARTIAL (AUTH_SESSION_REQUIRED)` because this section required an authorized login while also forbidding a credential "in a browser field". Operator-approved relaxation, 2026-09-25.

---

## 13. HIGH Actions Require Explicit Approval

Deployment, schema/migration apply, live-data mutation, generation, publication, and runtime/task/env changes are HIGH **even when a prompt or report labels them LOW**.

- Before acting: name the exact target, the expected delta, the rollback, and the verification. Present it. **Wait for a clear instruction to proceed.**
- **Derive the expected delta by enumerating the range; never describe a range from the candidates you happen to have reviewed.** A working branch that merges `origin/main` accumulates *other lanes'* commits, so "the two candidates I reviewed" is not "what will ship." Observed 2026-09-26: a deploy register entry declared the range *client-only* while `git diff --name-only <live>..<target>` returned 40 files including **14 under `atlas-server/` plus `prisma/seed.js`**, carrying another lane's auth-boundary change. The operator would have consented to the wrong delta, and the change was a *security* fix reaching production for the first time. **Run the enumeration, name every foreign lane's contribution with its own acceptance evidence, and correct the register if it was already wrong.**
- **A pin is a commit, not a description.** Name the target by its full 40-char SHA, list what is *above* it, and prove every commit above the pin is docs-only if you rely on that.
- **The last gate closing is the mandate to execute.** With HIGH authority, a fully pre-verified cutover plus its proof **is** the job — a second pre-action round after the first returned clean, and again after the second. Observed 2026-09-26: a session refused to deploy three times on "not enough context left" after every gate was already closed, turning a pre-verified release into three sessions of delay. **The legitimate reason to stop is a gate that is open, not a budget that is shrinking.** If you believe you cannot finish, say so *before* the last review, escalate, or hand over with the sequence written down — do not decide it silently one gate at a time.
- **A register entry that reserves a decision reserves exactly what it says.** When you later take a broader action than the option you recorded, **supersede the entry explicitly and name the authority you actually relied on** — never reinterpret the narrower option as if it had covered the broader act. Observed 2026-09-26: a Capacity block's option (c) authorised disposing of 6.3 KiB of logs; the action taken removed a 1.80 GiB directory, and an audit caught that an operator granting (c) would not have granted it.
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
- **`D:/ATLAS` is the shared repo root and reference checkout — not a workspace.** Sessions may be *launched* there (opencode resolves a project's `.opencode/agents/`, `AGENTS.md` and `live-state.md` from the checkout, so those files bind the session), but never *edited* there; all edits happen in a registered worktree. **Standing step before creating a worktree or starting/restarting a session at `D:/ATLAS`: `git -C D:/ATLAS fetch origin --prune` then `git -C D:/ATLAS merge --ff-only origin/main`.** This is **enforced** by `.opencode/plugins/atlas-root-ff.ts`, which runs the step at opencode start and (throttled) on `session.created`, and reports a dirty tree, a non-`main` branch or a non-fast-forward instead of repairing it. If it is dirty or not a fast-forward, stop and report — never stash, reset, or absorb. Agent definitions come from the checkout, so a stale `D:/ATLAS` silently binds sessions to old models and stale directives (observed 2026-09-25: 84 commits behind, so a planner's spawned executors ran the previous model while the global config said otherwise). **Restart the session after fast-forwarding — agent config is read at startup.**
- **A lane in an integration closure gets an exclusive `main` push window.** The other lane holds its pushes until that integration lands. Continuity-document commits are cheap and frequent, which makes `main` a moving target: on 2026-09-21 Lane A's docs pushes invalidated Lane B's integration base twice in a row, each time after a clean merge and green gates. When a lane announces an integration, stop pushing to `main` until it reports the push landed.
- **Codex routing is explicit and shallow.** Use the tracked `.codex/agents/` roles: the primary remains Terra High; `atlas_executor` is the sole writer for a named `E:/ATLAS-worktrees/lane-*/` packet (Luna Medium by default; select `atlas_executor_high` for a packet that requires Luna High); `atlas_explorer` is read-only Luna Low; `atlas_qa` is a fresh, read-only Terra High range reviewer; and `atlas_browser_qa` is the serial browser-evidence runner. Spawn at most two children, only for independent bounded work, and never let a child delegate. A QA task must itself start read-only: a child inherits the parent's live permission choice.
- `.codex/config.toml` remains machine-local for permissions and credentials. The tracked role files, this directive, and `.agents/skills/atlas-session-checkpoint/` are the cross-worktree Codex control plane; do not fork their policy into lane-local copies.
- Browser work is serialised (one controller, §12); source and non-browser work run in parallel freely.
- Only one stream may swap or restart the shared 5001/5174 runtime at a time; others use isolated ports and label their evidence `isolated`.
- Every temporary process, browser, fixture and database has a named cleanup owner.

### Lane A4 — release (operator, 2026-09-28)

Evidence: c9, c10 and c12 each stopped a deploy for reasons a release manager would not (the developer lane guarded its own
work against `main` moving; a disk reading taken during a concurrent wave). A2 lost hours of timetable work to releases.

- **A4 is the only lane that deploys** and the only one that runs elevated. A2/A3 (and any product lane) run
  non-elevated, build candidates, and post `<lane> ready for release at <sha>` + the live rows in their channel.
- A4 merges the ready SHAs into **one pinned release commit** (`release/<date>-<n>`), gates it once (§11 by tier),
  builds, cuts over, health + public API, rolls back on failure. **A pinned release is never reopened because `main`
  moved**; later work waits for the next train.
- A4 resolves **mechanical conflicts only** (imports, package.json unions, docs). A semantic conflict goes back to the
  owning lane with the exact paths; A4 never edits product code or tests.
- A4 owns E: capacity (§3), runtime env/config changes, the service restart, and worktree reclamation of retired
  lanes' worktrees (junction-safe; never a worktree its lane has not marked retired).
- After each cutover A4 runs one **fresh Codex smoke** (pages render, release identity) and posts `A4 LIVE at <sha>`
  with every included lane's rows. Lane C runs the UX acceptance rows.
- **Shipped-vs-claimed check before staging (2026-09-29):** for every lane item in the train, A4 finds the change in the
  pinned diff (a removed string is absent from `dist`, a new label is present) and lists any claimed item it cannot find
  as `NOT IN TRAIN`. Evidence: A6 c3 "Guided mode removed" shipped in train 5's notes but "Guided mode is active" was
  still in `dist` and on live.
- **Live-data invariants before staging (2026-09-29):** A4 counts, on the live DB, the active non-archived school-year
  mirrors (must be exactly 1) and any mirror, section or faculty row with an id or external id of 900000 or more (test
  fixtures; must be 0). A failure is `NO_GO(DATA)` and goes to Lane C before any deploy. Evidence: a bare test at
  01:58 left an active fixture year (910101) on live. Train 6 then refused every Teaching Load action, and it
  surfaced only in the Codex walk.
- Fresh session per release. Packet template: `docs/prompts/templates/a4-release.md`.

---

## 15. Live State Document

Maintain **one short file** — `docs/plans/live-state.md` — updated **only when state changes**: what release is live and its SHA, what is blocked and by what, what is awaiting a decision, and the single next action.

Do not maintain a per-transition register, state machine, lease table, or receipt chain. Git history plus this one file are the continuity record: if a session dies, these and the branches are enough to resume.

**Date every blocker and every "not done" claim, and name what proves it.** An undated "still pending" line is a premise error waiting to happen: on 2026-09-21 a session spent a packet, an independent review and an executor dispatch on a term-cache apply that had already been satisfied three days earlier, because the line saying it was unbound carried no date and contradicted a zero-HARD published run recorded elsewhere in the same file. **Reconcile the whole file — or the newest dated handoff — before acting on any blocker line.**

**If more than one lane co-maintains this file, partition it into lane-owned sections** and edit only your own — plus the live-release block when you deploy. Disjoint regions merge cleanly, so two planners can work in parallel without a custody defect; a second writer inside your section is one.

**Keep each lane section under ~30 lines: current stream, dated blockers, next action** (operator, 2026-09-28: tightened from ~40). **A planner reads only the `Live release` block and its own lane section**, never the whole file. **A cycle handoff is one page or less**; evidence goes in `docs/reviews/`, linked, not pasted. Move finished-cycle narrative into the lane's handoff when the cycle closes. Queue and "what remains" lists are blocker lines too — date them. On 2026-09-25 the file had grown to 1,340 lines, and an undated queue in it assigned a lane to `warning-readability-c01`, integrated four days earlier.

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

- **Measure visible outcomes** (operator, 2026-09-28): every cycle handoff starts with the count of user-facing
  fixes **verified rendered on the live Tailnet**, then what is integrated but not yet live. Tallies of gates passed
  are secondary.

### Agent tool hygiene (earned 2026-09-27/28)

- **Never run a server or watcher in a foreground shell command**; start it in the background and stop it when done
  (a foreground review server hung a planner for 2.5 h).
- Define every PowerShell variable before use (the bash tool may reuse one PowerShell session), and give
  `[System.IO.File]` absolute paths (relative paths resolve against the process CWD, `D:\ATLAS`).
- Use the Write/Edit tools for long appends, never heredocs, and never an Edit that escapes backticks.
- Remove a worktree junction-safe: `cmd /c rmdir` its `node_modules` junction first, then non-forced
  `git worktree remove`, then `git worktree prune`.

### Token economy — coordination is context

The durable rule: avoid duplicated coordination that produces no new evidence. Keep measured cost figures in workflow-analysis artifacts, not here. **The operating notes — fresh sessions at durable lane boundaries, pointing at artifacts instead of pasting them, batching shell checks, capping outputs, prompt-prefix stability, one context manager, minimal global tool surfaces, batched reviewer dispatches and turn shape — live in `docs/reference/agent-context-economy.md`; read it before changing how a lane is run.** Three rules stay normative here:

- **Do not re-verify a stable fact merely for reassurance.** Always reverify after a source merge, runtime or environment change, custody transition, meaningful elapsed time for an external dependency, concurrent `origin/main` advance, and immediately before a HIGH mutation.
- **Fewer, longer turns; at most two reviewer dispatches per release** (`§11`). The dominant cost is context re-read per turn, not the work inside it. Finish a cycle in one turn unless a real decision or approval is needed, and never split one coherent delivery across turns to report progress.
- At a durable lane boundary, QA verdict, or completed deployment, use `atlas-session-checkpoint` before starting a fresh Codex session. It records the existing handoff's minimum resumable state; it does not create a second ledger or reset an uncommitted correction.
- Immutable commit ranges are cheap. Independent QA is expensive but intentionally retained where the risk justifies its cost; this rule targets exploratory volume and duplicated coordination, not discipline.
