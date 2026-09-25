# Lane C planner handoff: 2026-09-25 (second)

**Read this, then `git show origin/main:AGENTS.md` (sections 10, 11, 14) and the Lane C section of
`docs/plans/live-state.md`.** You are Lane C (Claude Code); Lane A is opencode (primary, deploys) and Lane B is
Codex (server work and browser acceptance). You do not deploy. Work in `E:/ATLAS-worktrees/lane-c-*`, never in
`D:/ATLAS`. The previous handoff (C1–C3 QA) is this file's Git history; every action in it is done.

## State, 2026-09-25

- **C1–C3 integrated and on `main`**: `fc643bb..e8553752` (fast-forward, `--no-ff` merges of C2, C1, C3 and the
  planner docs branch). Merged-tree gates are in the Lane C section of `live-state.md`.
- **Deploy requested from Lane A**, release SHA `e8553752df97952652108027ace80c077c543e94`: client + server, no
  migration; C2 Teaching Load clarity, C1 post-publish clash check (new route
  `POST /api/v1/generation/:schoolId/:yearId/runs/:runId/published-revisions/preview`), C3 schedule clarity.
  Rollback basis `e475c673`. As of `main` `1903bc3d` it is **built, NOT LIVE** (Lane A's `Live release` block).
  Browser acceptance owner: **Lane B (Codex)**, rows in the Risks sections of `docs/handoffs/lane-c-post-publish-c01.md`,
  `lane-c-teaching-load-clarity-c02.md` and `lane-c-schedule-clarity-c03.md`. Lane C does not run those rows.
- `main` has moved on with Lane A's own active-term work (`72de00da`, `975b3175`); it is not Lane C's.

## Next actions, in order

> **Update 2026-09-25 (cloud session):** `e8553752` is LIVE (Live release block). Action 1 evidence is read and
> candidate `c198cd9` is out for QA (`docs/handoffs/lane-c-server-stall-c01.md`). Actions 2 and 3 remain host-only:
> a cloud session has no `E:` and its branch delete was refused. `work/wonderful-sagan-nhz302` is not fully
> merged (it carries this file's commit `9f04d4f`); it rides `work/epic-galileo-cw0swp`.

1. **Server stall (the current stream).** Waiting on evidence. Get the supervisor log lines, read-only, from
   whoever holds the host (you, if you run there; else paste to Lane A):
   > Resolve `<sourceDir>` from `schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`. Load `/timetable` once
   > in your seeded session and note the clock time. Then run
   > `Select-String -Path <sourceDir>\ops\runtime\logs\atlas-supervisor.log -Pattern '\[event-loop-stall\]|\[slow-request\]|P1001|P2024|pool' | Select-Object -Last 60`
   > and paste the lines verbatim with the load time. Start and stop nothing.

   Read them against the table below, then open `work/lane-c-server-stall-c01` off current `origin/main`:
   failing-first test, fix, `npm run build`, and Node starting `dist/server.js` on an isolated port (§5). MEDIUM
   tier: one fresh QA (`atlas-candidate-review`), then integrate. The fix ships in the release after `e8553752`.
2. **Worktree retirement** (host only). Load `atlas-worktree-reclaim`. Retire clean, merged, unlinked worktrees
   on these branches, all ancestors of `main` `e8553752` as of 2026-09-25:
   `work/lane-c-post-publish-c01`, `work/lane-c-teaching-load-clarity-c02`, `work/lane-c-schedule-clarity-c03`,
   `work/lane-c-server-timing`, `docs/lane-c-planner-handoff`, `docs/lane-c-audit-tl-controls`,
   `docs/lane-c-e-retention`, `docs/lane-c-live-state`, `docs/lane-c-live-state-trim`, `docs/lane-c-root-preserve`,
   `docs/lane-c-root-reset`, `docs/lane-c-skills`. **Preserve** `docs/lane-c-browser-qa` (`1faebbcf`) and
   `docs/lane-c-ux-audit-class-schedule` (`b287932d`), both unmerged, and the three unregistered leftovers
   (`flag-window-per-scope-c01`, `rollover-year-identity-c01`, `warning-readability-c01`). Record free space
   before/after and the retired list in the Lane C section of `live-state.md`.
3. **Delete the stray remote branches** `claude/wonderful-sagan-nhz302` and `work/wonderful-sagan-nhz302` (cloud
   session staging; both fully merged). The cloud session's proxy refused branch deletes (403).

## Server stall: what is already known (2026-09-25)

Audit finding 5 (`docs/reviews/ux-audit-class-schedule-2026-09-25.md`): on `/timetable`, 6–7 unrelated requests
started 0.8–1.6 s apart and finished within ~10 ms of each other at ~8 s. A shared cause, not slow handlers.
SERVER-TIMING-C01 (live since `89295c27`) logs `[slow-request]` (≥ 1 s) and `[event-loop-stall]` (≥ 200 ms, with
the requests active in the window).

| Hypothesis | Log signature | Source status |
|---|---|---|
| Event loop blocked by synchronous CPU work | `[event-loop-stall] blocked ~Nms; active: <route>`, or `none (background work)` | Plausible. No `*Sync` call on a request path; would be parsing or loops. Background timers: `rollover-automation.service.ts:429`, `room-preference-collaboration.service.ts:264`. |
| Prisma pool exhausted | many `[slow-request] … inFlight=6+`, no stall line, maybe `P2024` | Plausible. One default-pool `PrismaClient` (`atlas-server/src/lib/prisma.ts:14`); `resolveRuntimeContext` runs 6 parallel queries per call; `sections/summary` can trigger `syncSectionsFromExternal`. |
| Shared lock/await in middleware | `slow-request` lines, no stall line | Ruled out: `authenticate` is sync JWT only; `resolveRuntimeContext` is DB-only with no shared await. |

## Open, dated 2026-09-25

- A3: Teaching Load shows 0 class advisers. Check whether EnrollPro sends adviser assignments for SY 2031-2032
  (read-only, `atlas-companion-sync` first).
- NON_BLOCKING follow-ups from the C3 handoff: the Draft view's duplicate Generate buttons; the Expert right-panel
  Move on a published run; Schedule history not listing dated changes.
- NON_BLOCKING: client `typecheck` reports 4 errors in three browser-test files that import `playwright`
  (root-level dependency); no production source affected.

## Operator rules carried over

- G7AW (a building) and SPA/SPS (programs) are familiar names; keep them.
- opencode runs QA on DeepSeek on purpose; do not change opencode's config.
- Never read or print `~/.config/opencode/atlas-qa-credentials.local.md`; Lane C never types passwords.
- Companion repos are read-only.
