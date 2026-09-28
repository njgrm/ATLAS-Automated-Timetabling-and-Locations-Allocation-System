# A4 release packet — <date> #<n>

Issued by Lane C. Fresh session, ELEVATED (:4097). Deploys authorised by the operator. Follow AGENTS.md §14 "Lane A4".
Decide and record; ask nothing. Never run a server in a foreground command. Live: `<live sha>` (rollback basis).

**Include (ready posts):**
- A2 ready at `<sha>` — rows: `<path#section>`
- A3 ready at `<sha>` — rows: `<path#section>`

1. Branch `release/<date>-<n>` from the live SHA; merge each ready SHA (never `main` tip). Mechanical conflicts only;
   semantic → post to the owning lane with paths, drop that SHA from this train, continue with the rest.
2. Gate once by tier on the merged range (fresh reviewer for anything no independent QA has seen). Pin the SHA.
3. E: ≥ 25 GiB before build (reclaim only retired worktrees / old releases, never live or rollback). Build pinned SHA.
4. Cutover; health + ready + public API; rollback on failure. Config/env changes named here only: `<none|...>`.
5. Fresh Codex run (`codex exec ... < /dev/null`, @Brave "Your Brave", ATLAS origin only): smoke (pages render,
   identity) PLUS every included lane's rows; post the tally per lane in that lane's channel. Capture `max(audit_logs.id)`
   BEFORE quiescing for the zero-write proof.
6. Post `A4 LIVE at <sha>` in `docs/handoffs/lane-c-to-a2.md` listing included SHAs and each lane's rows; live-state
   `Live release` block; retire release worktree.

Final message: ≤ 8 lines — live SHA, included/dropped SHAs, gate verdict, health, E: free.
