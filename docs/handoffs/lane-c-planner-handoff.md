# Lane C planner handoff: 2026-09-25 (third — cloud session → local Lane C)

**Read this, then `git show origin/main:AGENTS.md` (sections 10–14) and the Lane C section of
`docs/plans/live-state.md` on this branch.** You are Lane C (Claude Code), running **on the host**. Lane A is
opencode (primary, deploys); Lane B is Codex (server work). Work in `E:/ATLAS-worktrees/lane-c-*`, never in
`D:/ATLAS`. The previous handoff is this file's Git history.

**Why this exists:** the previous Lane C turn ran by accident in a cloud container. It had no `E:`, no seeded
browser profile and no Tailnet access (the proxy returned 403), and it could only push `work/epic-galileo-cw0swp`.
Everything it produced is on that branch.

## Pick up the cloud work

```
git fetch origin work/epic-galileo-cw0swp main
git worktree add E:/ATLAS-worktrees/lane-c-server-stall-c01 -b work/lane-c-server-stall-c01 origin/work/epic-galileo-cw0swp
```

The range `ff87b06b..origin/work/epic-galileo-cw0swp` holds:
- `9f04d4f`: the previous planner handoff, merged in from `work/wonderful-sagan-nhz302`.
- `c198cd9` **SERVER-STALL-C01** (source): open `text/event-stream` responses are counted as `streams=N`. They
  are never listed as active work, never counted in `inFlight` and never logged as slow requests. Stall lines
  also carry `heap=<used>/<limit>MB`. It changes logging only. Independent QA gave **`ACCEPT_READY` 5/0/0**.
  Details are in `docs/handoffs/lane-c-server-stall-c01.md`.
- Docs commits: that handoff, this file and the Lane C section of `live-state.md`.

**Not integrated.** `main` does not carry any of it, and it is not live. Live is still `e8553752`.

## Priority 0 — a demo is imminent (operator, 2026-09-25)

Do not deploy or touch the runtime before the demo. Nothing above blocks it.

**Browser acceptance for C1–C3 has not been run by anyone** as of 2026-09-25 (acceptance is `PARTIAL`). The
operator gave Lane C the browser lane. Load `atlas-live-browser-qa` and use your seeded profile; if it has no
session, report `NEEDS_SESSION` and continue. Run the rows in the Risks sections of these handoffs against
`https://njgrm.buru-degree.ts.net`, in this order:
1. `docs/handoffs/lane-c-post-publish-c01.md`: the published-entry change and swap clash check. It also carries
   the **authenticated zero-write probe** that the deployment QA left as row 5d
   `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`: preview a change, then prove no revision, audit or run write.
2. `docs/handoffs/lane-c-teaching-load-clarity-c02.md`.
3. `docs/handoffs/lane-c-schedule-clarity-c03.md`.

Report a real passed/blocked/unperformed tally. Record the result in the `Live release` block against
`e8553752`, and tell the operator which flows are safe to show. Generation, publication and anything that changes
the published run stay HIGH under §13. Do not do them for QA.

**Demo note:** the ~8 s `/timetable` stall grew over hours of uptime (multi-second on the 6.7 h-old `89295c27`,
~384 ms on the fresh `e8553752`). `runtime/context` takes about 4 s when it verifies against EnrollPro.

## After the demo, in order

1. **Integrate SERVER-STALL-C01.** Its QA is already done. Merge `work/lane-c-server-stall-c01` `--no-ff` from a
   clean `integration/*` boundary. Before pushing to `main`, prove `c198cd9` is reachable
   (`git cat-file -t c198cd9`). Run `npm run test:request-timing` and the server build once on the merged tree,
   then push. Hand Lane A the SHA for the next release. That release needs the **`E:` release-directory
   reclaim first**: `E:` was at 49.91 GiB on 2026-09-25, below the 50 GiB warning line (§3).
2. **Read the stall lines (after the release has run ≥ 2 h with `/timetable` in use)** with
   `Select-String -Path <sourceDir>\ops\runtime\logs\atlas-supervisor.log -Pattern '\[event-loop-stall\]|\[slow-request\]|P1001|P2024|pool' | Select-Object -Last 60`.
   The `active:` list now names the blocker and `heap=` shows whether it is a GC pause. Then open the root-cause
   fix with a failing-first test and one fresh QA.
3. **`runtime/context` ≈ 4.1 s**: this matches the 4000 ms `AbortSignal.timeout` on the EnrollPro
   `integration/v1/school-year` and `integration/v1/active-term` fetches. Time one read-only call to each on the
   host to decide it.
4. **Worktree retirement** (load `atlas-worktree-reclaim`). Retire the clean, merged, unlinked worktrees on:
   `work/lane-c-post-publish-c01`, `work/lane-c-teaching-load-clarity-c02`, `work/lane-c-schedule-clarity-c03`,
   `work/lane-c-server-timing`, `docs/lane-c-planner-handoff`, `docs/lane-c-audit-tl-controls`,
   `docs/lane-c-e-retention`, `docs/lane-c-live-state`, `docs/lane-c-live-state-trim`, `docs/lane-c-root-preserve`,
   `docs/lane-c-root-reset`, `docs/lane-c-skills`. **Preserve** `docs/lane-c-browser-qa` (`1faebbcf`),
   `docs/lane-c-ux-audit-class-schedule` (`b287932d`) and the three unregistered leftovers
   (`flag-window-per-scope-c01`, `rollover-year-identity-c01`, `warning-readability-c01`). Record free space
   before and after in the Lane C section of `live-state.md`.
5. **Remote branches.** Delete `claude/wonderful-sagan-nhz302`, which is fully merged. The cloud session was
   refused. Delete `work/wonderful-sagan-nhz302` and `work/epic-galileo-cw0swp` only **after** step 1 lands, since
   both are ancestors of the integrated branch.

## Open, dated 2026-09-25

- A3: Teaching Load shows 0 class advisers. Check read-only whether EnrollPro sends adviser assignments for
  SY 2031-2032. Run `atlas-companion-sync` first.
- NON_BLOCKING (C3 follow-ups): the Draft view has duplicate Generate buttons; the Expert right-panel Move is
  offered on a published run; Schedule history does not list dated changes.
- NON_BLOCKING: client `typecheck` reports 4 errors in browser-test files that import `playwright`.

## Operator rules carried over

- G7AW (a building) and SPA/SPS (programs) are familiar names; keep them.
- opencode runs QA on DeepSeek on purpose; do not change opencode's config.
- Never read or print `~/.config/opencode/atlas-qa-credentials.local.md`. Lane C relies on the seeded session.
- Companion repos are read-only.
