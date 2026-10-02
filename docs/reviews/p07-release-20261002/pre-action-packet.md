# P07 Flag/HGP timetable-controls release — pre-action packet

Date: 2026-10-02 (Asia/Manila)  
Risk: HIGH — supervised live runtime cutover; no migration and no intended data write.

## Identity and authority

- Target: `5b084c7591d45a85e609aa05aec7ef76c68e4d98` in
  `E:\ATLAS-runtime-supervised-5b084c75-20261002` (detached release tree).
- Incumbent: `fdae67ec64a4713d7c5c2446e03c25c29ddf704f` in
  `E:\ATLAS-worktrees\lane-a4-release-20260930-21prod`.
- Rollback basis: `c82b8636`; the runner also captures the incumbent task XML
  and the two machine runtime variables before cutover.
- The target is exactly the four accepted p07 commits (`07c2601b2`,
  `6366371fb`, `6e1feb1b3`, `5b084c759`), changing 21 client/server paths.
  It contains no Prisma schema or migration change.
- `origin/main` records this exact target/rollback relationship in
  `docs/plans/live-state.md` (commit `658da999`).
- The operator authorized continued p07 release work through browser acceptance.

## Recorded build and isolated runtime proof

| Row | Harness and literal command | Result |
| --- | --- | --- |
| Prisma client | From `atlas-server`, load staging-only `DATABASE_URL` from `D:\ATLAS\atlas-server\.env`, then `node_modules\.bin\prisma.cmd generate --schema ..\prisma\schema.prisma` | PASS — repository-root schema generated. |
| Server build | `npm run build` in `...\atlas-server` | PASS — `dist/server.js` emitted. |
| Client build | `$env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'; npm run build` in `...\atlas-client` | PASS — production `dist` emitted. |
| Built server | Start `node dist/server.js` hidden with staging `DATABASE_URL` and `PORT=5198`; poll `GET http://127.0.0.1:5198/api/v1/health`, then `GET http://127.0.0.1:5198/api/v1/subjects?schoolId=1`; stop the PID in the same bounded smoke | PASS — health 200; database-backed subjects 200 (20,336 bytes); process and port 5198 confirmed stopped. |

## Preselected live-byte discriminator

The browser/public-origin row must fetch the target chunk after cutover and
compare its bytes, rather than treating a restart as proof.

| Side | Asset | SHA-256 | Marker |
| --- | --- | --- | --- |
| Target | `assets/SchedulingPolicyPane-C01uMS9A.js` (58,440 bytes) | `0835B447102577BE77A18EAD0429FAD49215D48599094859D2E17C006341F55B` | Contains `HGP`. |
| Incumbent | `assets/SchedulingPolicyPane-5Fhwk1oo.js` (56,974 bytes) | `E1CC645A4E8FA318EFFD27D42684A56491E2A0D469AF975A527A888995E709A9` | Does not contain `HGP`. |

The filenames, hashes, sizes, and marker were derived from the two actual
production builds on 2026-10-02. The hash inequality was checked before this
packet was written.

## Supervised cutover commands

The deploy runner requires an elevated Administrator PowerShell even for its
dry-run because it captures the scheduled-task XML. The current planner shell
is not elevated; do not substitute a manual supervisor restart.

Dry-run (Administrator PowerShell):

```powershell
& 'D:\ATLAS\ops\runtime\deploy-runner.ps1' -TargetSha '5b084c7591d45a85e609aa05aec7ef76c68e4d98' -TargetSourceDir 'E:\ATLAS-runtime-supervised-5b084c75-20261002' -IncumbentSha 'fdae67ec64a4713d7c5c2446e03c25c29ddf704f' -IncumbentSourceDir 'E:\ATLAS-worktrees\lane-a4-release-20260930-21prod' -EnvFile 'D:\ATLAS-runtime-config\atlas-server.env' -LiveStateRef 'origin/main'
```

Execute (same command, only after dry-run plan and independent pre-action
review accept):

```powershell
& 'D:\ATLAS\ops\runtime\deploy-runner.ps1' -TargetSha '5b084c7591d45a85e609aa05aec7ef76c68e4d98' -TargetSourceDir 'E:\ATLAS-runtime-supervised-5b084c75-20261002' -IncumbentSha 'fdae67ec64a4713d7c5c2446e03c25c29ddf704f' -IncumbentSourceDir 'E:\ATLAS-worktrees\lane-a4-release-20260930-21prod' -EnvFile 'D:\ATLAS-runtime-config\atlas-server.env' -LiveStateRef 'origin/main' -Execute
```

## Mandatory post-action acceptance rows

1. Machine-scope `ATLAS_RUNTIME_SOURCE_DIR` equals the target release tree and
   `ATLAS_RUNTIME_RELEASE_SHA` equals the full target SHA.
2. Listener command lines show the target runtime on 5001 and 5174; the active
   target `supervisor-state.json` corroborates the same `sourceDir` and
   `releaseSha`.
3. `GET http://127.0.0.1:5001/api/v1/health` and
   `GET http://127.0.0.1:5001/api/v1/subjects?schoolId=1` both return 200.
4. The Tailnet origin serves the target SchedulingPolicyPane asset with the
   recorded target SHA-256 and `HGP` marker, not the incumbent asset/hash.
5. A fresh independent authenticated browser QA visits `/timetable` and the
   scheduling-policy controls at 1366x768 and 390x844. It must record console
   and network evidence, preserve zero-write custody, and judge Flag/HGP
   controls enabled and disabled before `ACCEPT_READY`.

If any row fails, restore the captured task XML and machine variables using
the runner audit directory and restart the restored scheduled task only after
the runner's recorded quiescence condition.

## Review scope

One fresh independent pre-action reviewer must assess the four-commit target
range and this packet together. An `ACCEPT_READY` verdict is required before
the elevated dry-run/execute sequence. A distinct post-action reviewer owns
all five rows above, including live browser acceptance.
