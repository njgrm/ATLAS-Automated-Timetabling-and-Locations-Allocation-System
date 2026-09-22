# Elevated release runner C01

This source-only lane provides a manually launched, read-only elevated preflight.
It does not register a scheduled task, install a persistent privileged artifact,
deploy a release, restart the supervisor, access a database, or use a browser.

## Operator action

Open **Windows PowerShell as Administrator**, then paste the following command
with the accepted release SHA and matching release directory:

```powershell
& 'E:\ATLAS-worktrees\elevated-release-runner-c01\ops\release\Invoke-AtlasElevatedReleasePreflight.ps1' `
  -ApprovedSha '<40-hex-approved-sha>' `
  -ReleaseRoot 'D:\ATLAS-runtime-supervised-<sha-prefix>-<yyyymmdd>'
```

The command must be run by the operator. Codex cannot invoke it or approve the
UAC boundary. It verifies administrator context, exact Git HEAD, the committed
runner hash against its manifest, and fixed Node identity, then invokes only the
read-only preflight. Capture its JSON output for the separate HIGH release packet.

The previous task-registration script was intentionally removed. There is no
SYSTEM task, service, startup trigger, task overwrite, or persistent privileged
runner to install. Cutover remains a separate explicitly packeted HIGH action.

The runner rejects traversal, arbitrary arguments, migration/schema/db push/reset/
seed commands, and any mode other than preflight. It never accepts or stores
credentials. Its evidence includes the supervisor task XML hash, environment key
names/approved identity, and listener PID lineage without logging secrets.

## UI quality policy

For user-facing timetable work, Playwright real-route lifecycle coverage is the
first acceptance gate: verified active-term default, missing-authority
zero-dispatch, mouse placement/swap preview, no-write controls, all-term
visibility, desktop/mobile layout, and console/network error checks. Static
markup assertions are supplementary only.

## Disposition

`KEEP_ACTIVE` until the operator reviews the command and the next independent
review accepts the additive correction. No runtime or live release state is
changed by this commit.
