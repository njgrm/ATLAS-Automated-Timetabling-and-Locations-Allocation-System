# Releases without an elevated agent

No AI session holds admin. Agents build and ask; one fixed task does the cutover.

| Step | Script | Runs as | Does |
|---|---|---|---|
| 1 | `release-prepare.ps1 [-Sha <sha>]` | the agent (not elevated) | worktree at a main SHA, own `npm ci`, prisma generate, server + client build, asserts both dists (rule 19). Reuses a built tree. |
| 2 | commit + push `docs/plans/live-state.md` | the agent | `## Live release` names the target prefix AND the rollback prefix (the deploy gate reads origin/main). |
| 3 | `release-request.ps1 -Dir <tree> [-Mode dry-run] [-OperatorSaidShip]` | the agent | checks the tree, the live-state record and that live is quiet (`live-use-check.ps1`, skipped only when the operator wrote "ship"), writes `C:\ProgramData\ATLAS\release\inbox\request.json`, waits for the result. |
| 4 | `release-task.ps1` (task **ATLAS Release**, every minute) | SYSTEM, pinned copy in `C:\ProgramData\ATLAS\release\bin` | validates the request, `deploy-runner.ps1` dry run then execute, proves the new tree serves (`/health/ready` 200, client 200, the 5001 listener runs from the new tree) within 180 s, else rolls back automatically. |

Results: `C:\ProgramData\ATLAS\release\results\<id>.json` with `status` =
`LIVE | DRY_RUN_OK | REFUSED | FAILED_BEFORE_CUTOVER | FAILED_RESTORED | ROLLED_BACK | FAILED_DOWN`.
Only `FAILED_DOWN` needs the operator at once. Logs: `...\release\logs\<id>.log`.

Install once (operator, elevated): `powershell -ExecutionPolicy Bypass -File D:\ATLAS\ops\runtime\release\install-release-task.ps1`.
The task runs its own copies of `release-task.ps1` and `deploy-runner.ps1`, so a commit to main cannot change what
runs as SYSTEM; re-run the installer after a reviewed change to either. Staging is reserved for T3 changes.
First use: a `-Mode dry-run` request.
