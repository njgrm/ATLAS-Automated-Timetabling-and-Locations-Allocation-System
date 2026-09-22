# Elevated release runner C01

This source-only lane adds a least-privilege boundary for the operator's one-time
elevated Windows action. It does not register a task, deploy a release, restart the
supervisor, access a database, or use a browser.

## Operator workflow

1. Review the exact SHA and release root in the HIGH release packet.
2. Open **Windows PowerShell as Administrator**.
3. Run `Register-AtlasElevatedReleaseTask.ps1` with `-ApprovedSha`, `-ReleaseRoot`,
   and explicit `-Register`. The task is created disabled and on-demand; registration
   never starts it.
4. Run the Node runner in `--mode preflight` and retain its JSON output. It captures
   incumbent and rollback metadata without secrets or writes.
5. A separate HIGH packet may later authorize a cutover. The runner refuses cutover
   unless `--approve-cutover` is present; this commit does not perform that action.

The runner accepts only a 40-hex SHA and an absolute SHA-prefixed supervised release
directory. It rejects traversal, arbitrary arguments, migration/schema/db push/reset/
seed commands, and unsupported task names. Credentials are never accepted or stored.

## UI quality policy

For user-facing timetable work, Playwright real-route lifecycle coverage is the first
acceptance gate: verified active-term default, missing-authority zero-dispatch, mouse
placement/swap preview, no-write controls, all-term visibility, desktop/mobile layout,
and console/network error checks. Luna's handoff includes the exact script and matrix;
Terra reviews the matrix and runs it against the immutable candidate before planner
integration. Static markup assertions are supplementary only.

## Disposition

`KEEP_ACTIVE` until the operator reviews and accepts the registration boundary. No
runtime or live release state is changed by this commit.
