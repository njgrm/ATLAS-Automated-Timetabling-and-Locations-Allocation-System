# Planner handoff — fresh session (2026-09-25)

**Purpose:** hand primary-planner custody to a new session/model. This file is self-contained and
supersedes the stale top of `docs/handoffs/planner-session-handoff.md` (that living doc is kept for
history; its top "verdict" predates 2026-09-25).

## Read first (from `origin/main`)

`AGENTS.md` (already injected — do not reread from disk) · `docs/plans/live-state.md` (Lane A section) ·
`docs/plans/teacher-concern-authority-plan-2026-09-24.md` (objective, D1–D11, **Cycle queue** = continuity
index) · `docs/reference/agent-verification-gates.md` · `docs/reference/agent-live-browser-qa.md` ·
`docs/reference/agent-runtime-deploy-facts.md` (before any deploy) · the other lanes' handoffs under
`docs/handoffs/`.

## Current state (verified 2026-09-25)

- `origin/main` = **`c5e167d7`**. Live release = **`ad8f9717`** at
  `E:\ATLAS-runtime-supervised-ad8f9717-20260925` (Lane C cutover 17:12; 5001→15884 / 5174→86660).
- Applied migrations on `atlas_recovery_clean_rebuild_20260905` (localhost:5432): **11**.
- Capacity: `E:` 61.6 GiB, `D:` 60.8 GiB (both above warning; Lane C ran a release-dir reclaim).
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

1. **Deploy the R1 tip** (`origin/main` `c5e167d7`): client-only, **no migration**; rollback basis = live at
   cutover. Then the **live pixel rows** (rendered ≥14 px at 1366×768 and 390×844; no global scrollbar) —
   browser custody is **Lane A**.
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

- The `playwright` MCP is configured in `~/.config/opencode/opencode.jsonc` but is **not loaded** in agent
  sessions; `@playwright/mcp` was never fetched. **Drive Playwright via the CLI instead**:
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

## Model binding (planner)

`atlas-planner` is bound to **`opencode-go/deepseek-v4.1-flash`** in
`~/.config/opencode/agents/atlas-planner.md` (and mirrored in `opencode.jsonc`'s `"agent"` block). To hand
planning to another model, change that `model:` value (e.g. `opencode-go/deepseek-v4-pro`,
`agentrouter/glm-5.3`, `opencode-go/kimi-k2.7-code`, `opencode-go/qwen3.8-flash`) and restart the session.
Keep the routing rule in the same file: default `high`; `max` only for architecture / conflicting
candidates / HIGH actions.

## Next action

Deploy `origin/main` `c5e167d7` at the next free runtime window (client-only, no migration; rollback basis =
live at cutover), run the post-cutover QA, then Lane A's live pixel/browser acceptance. Then decide F7 and
the Stage-2 successor.
