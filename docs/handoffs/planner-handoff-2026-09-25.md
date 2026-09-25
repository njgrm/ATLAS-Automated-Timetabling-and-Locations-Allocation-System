# Planner handoff — fresh session (2026-09-25)

**Purpose:** hand primary-planner custody to a new session/model. This file is self-contained and
supersedes the stale top of `docs/handoffs/planner-session-handoff.md` (that living doc is kept for
history; its top "verdict" predates 2026-09-25).

**FINALIZED 2026-09-25 by the outgoing Lane A planner for the incoming Lane A planner.** No runtime,
task, env, migration, deploy, or live-data action was taken while finalizing: the deployment below is
the incoming planner's to run, under its own §13 approval. Read the two **verify-on-takeover** items
first — the model transition and the deploy delta both carry premise corrections.

## Read first (from `origin/main`)

`AGENTS.md` (already injected — do not reread from disk) · `docs/plans/live-state.md` (Lane A section) ·
`docs/plans/teacher-concern-authority-plan-2026-09-24.md` (objective, D1–D11, **Cycle queue** = continuity
index) · `docs/reference/agent-verification-gates.md` · `docs/reference/agent-live-browser-qa.md` ·
`docs/reference/agent-runtime-deploy-facts.md` (before any deploy) · the other lanes' handoffs under
`docs/handoffs/`.

## Current state (verified 2026-09-25 by the outgoing planner)

- `origin/main` = `main` tip — docs-only above product tip **`c5e167d7`** (workflow rule `255fc306`, agent
  re-binding after it). Live release = **`ad8f9717`** at
  `E:\ATLAS-runtime-supervised-ad8f9717-20260925` (Lane C cutover 17:12; 5001→15884 / 5174→86660;
  `/api/v1/health` 200; machine env = target).
- Applied migrations on `atlas_recovery_clean_rebuild_20260905` (localhost:5432): **11**.
- Capacity: `E:` 61.6 GiB, `D:` 60.7 GiB (both above warning).
- Other lanes are active: **Lane B** (scheduler warning clarity / published read-only + disclosure) and
  **Lane C** (schedule clarity, stall investigation, retention). Their worktrees under
  `E:/ATLAS-worktrees/lane-b-*`, `lane-c-*` are theirs — do not write there.

## Program `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` — DONE

Objective: the scheduler is the single place that accommodates teacher preferences/availability (draft and
post-publish); SMART holds a view-only teacher-scoped draft read; the ATLAS teacher portal is removed.

- **C1–C7 complete and deployed at some point**: S0 plan/D1–D11, S3 SMART draft read, S5+S6 break-window +
  teacher-lunch, S7 grade preference, S8 shift coherence, S1 availability authority, S4-server identity
  deltas, S2 concern workspace + D6 portal removal, S4-client drift/revision + D4 read-back, C7 deployment
  (`066da7a7`, migration `20260925000002_faculty_availability`).
- **C7's blocker is fixed**: the availability authority resolved the frozen persisted term T1 while the
  client used T2 → `409 TERM_SCOPE_MISMATCH`. `ACTIVE-TERM-LIVE-RESOLUTION-C01` (`72de00da`, QA 9/9) makes
  it resolve **live-first with a date-derived fallback**; deployed as `ff87b06b`; Lane A's seeded browser
  pass then got **PUT 200 `termIndex 2`, no 409**.
- **Class-schedule UX audit findings**: F2/F3/F9 addressed on main; F6 addressed via Lane B's contract
  (container-owned published read-only **with disclosure preserved**); **F7 deliberately rejected on main**
  (daily tools stay in More — "so the header stays compact"); **F4/R1** (absolute ≥14 px grid sizes) landed
  via `UX-AUDIT-SIZE-C01` `fb245772` (QA 6/6), integrated at `c5e167d7`.

## Open work / decisions (dated)

1. **Deploy the R1 tip** (product tip `c5e167d7`). **Premise correction — the delta is not client-only.**
   `ad8f9717..c5e167d7` is **16 product files: 14 client + 2 server** (`atlas-server/src/lib/request-timing.ts`
   and its test — Lane C's `SERVER-STALL-C01`), plus docs. **No migration.** The cutover therefore also takes
   Lane C's stall diagnostics live, which is what lets Lane C run its acceptance afterwards. Rollback basis =
   live `ad8f9717` at cutover. Then the **live pixel rows** (rendered ≥14 px at 1366×768 and 390×844; no global
   scrollbar) — browser custody is **Lane A**. Sequence: record the target SHA in the `## Live release` block on
   `origin/main` first (runner fails closed), state target/delta/rollback/verification, take §13 approval, build
   the release tree, dry-run then `-Execute`, then post-cutover QA.
2. **`ad8f9717` browser acceptance is UNPERFORMED** (operator generated draft run 318 before the demo, so
   `/timetable` opens an unpublished draft; see `docs/handoffs/lane-c-handoff-2026-09-25-stall.md`). Owner:
   whoever the operator names; acceptance is separate from deployment.
3. **F7 product decision** — main rejects surfacing the daily tasks; reverse only on an explicit operator
   instruction.
4. **Stage-2 successor** (unowned): pre-resolve the active term at the generation/publication entry points
   and thread it into their transactions so generation/readiness also move to T2. A live fetch inside
   Serializable/advisory-locked transactions is unsafe — that is why Stage 1 is availability-only.
5. Residuals: `resolvePublishedRunTermIndex` base-snapshot export terms (F1); drift repair href `/faculty`
   vs `/faculty/concerns` (F2); host-proxy 502; offline term-cache staleness; `shiftCoherenceNotices` /
   `preferenceNotices` server-only; **4 pre-existing `tt-output-c03r` server-suite failures** and **15–17
   pre-existing client-suite failures** plus the **client `gate-reachability` trio**
   (`timetable-lifecycle-controls-c03`, `scheduler-print-requests`, `timetable-scrollbar-wiring-c01`) —
   pre-existing, do not "fix" them without a lane.

## Browser custody (Lane A) — how it works here

- **Browser tooling:** the `playwright_browser_*` MCP tools **are available in this session** (the outgoing
  session had them) — prefer them; the earlier "`@playwright/mcp` was never fetched" note is stale. Fallback
  if the MCP is not loaded: drive the CLI directly —
  `require('D:/ATLAS/node_modules/playwright')` (v1.59.1; chromium binaries present) and
  `chromium.launchPersistentContext('C:/Users/njgro/.config/opencode/playwright-profile', {headless,ignoreHTTPSErrors})`.
- The seeded "remember me" session lives in that profile (cookie `atlasAuthToken`, ~30 days). One agent per
  profile at a time. Credentials at `%USERPROFILE%\.config\opencode\atlas-qa-credentials.local.md` — read
  in-process, **never print**, never recreate faculty `2000056`.
- Observed gotchas: wait **≥15 s** after `goto` (the app re-verifies the session and shows "Checking your
  sign-in" until then); avoid double quotes inside inline `node -e` on Windows (write the script to
  `~/.config/opencode/atlas-browser/` instead); close the context when done.

## Environment gotchas (learned this program)

- **Never edit `D:\ATLAS`** (stale/dirty reference checkout) — use a registered worktree under
  `E:/ATLAS-worktrees/`.
- The agent harness **denies `npm ci`**; stage dependencies by copying the lockfile-verified incumbent's
  `node_modules` into the release tree (own tree, never a junction across releases).
- Stop an isolated test server by the **PID actually listening on the port** (`Get-NetTCPConnection`), not a
  wrapper shell — `kill $!` leaves the `node` child running (a stray `node dist/server.js` on 5198/5199 has
  blocked worktree deletion twice).
- Deploy-runner fails closed unless the target SHA is named in the `## Live release` block **on
  `origin/main`** before cutover (record leads the cutover). Use full 40-hex SHAs.
- `E:` warn <50 GiB / fail <25 GiB; `D:` warn <25 / fail <15 (Postgres lives on `D:`).
- Migrations: apply only via `npm run migrate:guarded` (never bare Prisma, never reset) after a fresh
  revalidated backup.

## Model transition to `space-bunny-free` — DONE (2026-09-25)

Operator goal: move the paid planning pipeline to the free **`opencode-go/space-bunny-free`**.

**Mechanism (measured; corrects an earlier claim in this file):** opencode loads markdown agents from both
`~/.config/opencode/agents/` (global) and the project's `.opencode/agents/`. Measured 2026-09-25: the Lane A
session started 20:13 local loaded `space-bunny-free` for `atlas-planner` **from the global file**, even though
that checkout still had `deepseek-v4.1-flash` in the project file — so the **global definition is what takes
effect**; a project file is the fallback used when no global twin exists. (An earlier note here said the
repo-level files override the global config — that was wrong; the repo-level re-binding is harmless parity, not
the fix.) A subagent with **no** resolved model inherits the invoking primary's model.

**The one real gap, now fixed:** `atlas-wave-auditor` was the only ATLAS agent with **no global twin**, so it
fell through to the project file — which in the launch checkout (`D:\ATLAS`, stale `af3bb594`) still bound
`deepseek-v4.1-flash`. Fixed by creating `~/.config/opencode/agents/atlas-wave-auditor.md` (full role body,
`model: opencode-go/space-bunny-free`). **Restart the session to load it and confirm the auditor's model id.**

**Complete:** global `atlas-planner`, `atlas-qa`, `atlas-executor`, `atlas-wave-auditor` and both `*-delegate`
gates read `opencode-go/space-bunny-free`, as do `opencode.jsonc` line 127 (`agent.plan`) and the repo-level
`.opencode/agents/*.md` on `origin/main` (parity, commit `a368f47c`).

**Still on DeepSeek deliberately:** `compaction` (`opencode.jsonc` 130–133; `deepseek-v4.1-flash` /
`variant: low` — a free model summarising long sessions risks quality), and the model-specific agents
`atlas-bench-ds`, `atlas-bench-dsflash`, and `atlas-qa-dsflashv4` (their names encode their model; the
bench/AB set exists to compare models, so do not silently rebind them).

**Model availability confirmed:** `space-bunny-free` is advertised by the gateway
(`https://opencode.ai/zen/go/v1/models`) and present in the local model cache, so the id resolves. Routing
rule unchanged: default `high`; `max` only for architecture / conflicting candidates / HIGH actions.

**Permission note:** the repo-level `.opencode/agents/atlas-planner.md` on `origin/main` has `edit: "*": deny`
with no allow for `C:/Users/njgro/.config/opencode/**`, so a planner running from a main-based worktree cannot
edit the global config; `D:/ATLAS/**` and `E:/ATLAS-worktrees/**` remain writable. `D:\ATLAS` is **dirty** with
an uncommitted `.opencode/agents/atlas-planner.md` edit (that copy adds the config-dir allow) — do not build on
that checkout (AGENTS §14).

## Reconcile these stale `live-state.md` lines on takeover (as of 2026-09-25)

- **Lane A section** still says `066da7a7` is LIVE — the live release is **`ad8f9717`**; the shared
  `## Live release` block is authoritative.
- **Lane A section** lists audit finding **4 as OPEN ("12 px text prevalent")** — fixed by R1
  (`fb245772`, QA 6/6/0/0, integrated `c5e167d7`); only the live pixel row is outstanding.
- Finding 3 (one unlabelled warning triangle) and 6 (published cells look editable) are addressed on main;
  **finding 7 was deliberately rejected** and stays in More unless the operator reverses it.

## Next action

Deploy the tip carrying R1 (product tip `c5e167d7`; `origin/main` is docs-only above it) at the next
free runtime window. Delta vs live `ad8f9717` = 14 client + 2 server files, **no migration**; rollback basis =
live at cutover. Order: (1) record the target SHA in the `## Live release` block on `origin/main`; (2) state
target/delta/rollback/verification and take §13 approval; (3) build the release tree and run `deploy-runner.ps1`
dry-run then `-Execute`; (4) post-cutover verification + independent post-action QA; (5) Lane A live
pixel/browser rows. Then decide F7 and the Stage-2 successor. **Separately, restart and confirm the model
binding (transition committed above) before relying on it.**
