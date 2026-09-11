# W1-RUNTIME-DEPLOY — reviewed runtime cutover and Tailnet acceptance

## Role and verdict contract

`ROLE: PRIMARY_PLANNER`

Execute this single approved HIGH action through the normal Planner → Executor
→ fresh QA cycle. The executor returns `REVIEW_REQUIRED`; QA returns exactly
`ACCEPT_READY`, `CORRECTION_REQUIRED`, or `PLANNER_DECISION_REQUIRED`; the
planner validates the result and returns to `MANUAL` when this named cycle
ends.

This packet authorizes a shared-runtime deployment only. It does not authorize
rollover sync, term-cache mutation, Teaching Load writes, generation, or
publication.

## Exact operator approval

> I approve W1-RUNTIME-DEPLOY from current `origin/main` commit `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22`: build and deploy the reviewed ATLAS server and client to the shared Tailnet runtime, including stopping and replacing only the ATLAS processes on ports 5001 and 5174. Keep rollover automation disabled during deployment. This approval authorizes runtime deployment, rollback if health or login fails, and read-only Tailnet acceptance only. It authorizes no migration, schema change, rollover term-cache sync, Teaching Load apply, generation, publication, or other live-data mutation.

## Approved identity and current observation

- Approved Git tree: `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22`.
- Create a fresh clean worktree and neutral branch from that exact commit. Never
  use the dirty `D:/ATLAS` checkout as source or as a Git integration boundary.
- At planning time, Tailnet routed
  `https://njgrm.buru-degree.ts.net/` to `127.0.0.1:5174`.
- At planning time, port 5001 was owned by an ATLAS `tsx src/server.ts` process
  from `D:/ATLAS`, and port 5174 by an ATLAS Vite process from `D:/ATLAS`.
  These PIDs are observations only; re-resolve and verify exact process command
  lines immediately before stopping anything.
- If the approved commit cannot be resolved or its server/client source differs
  from the intended reviewed tree, stop at `PLANNER_DECISION_REQUIRED`.
- If `origin/main` has advanced, do not silently deploy the newer tree. Verify
  whether the advance is documentation-only and keep the deployed product tree
  pinned to `fdd0c8c7`; otherwise stop for renewed approval.

## Mandatory trace table before action

Before stopping a process, write a compact trace table:

`requirement -> production/runtime path -> observable pass -> negative control -> rollback`

It must cover server startup, client origin, rollover-disabled state, Tailnet
routing, actor/year truth, derived demand, Teaching Load history/carry-forward
preview visibility, canonical generation readiness, and zero unauthorized
writes.

## Stage A — read-only preflight and rollback capture

1. Refresh Git and verify the exact approved commit, clean deployment worktree,
   expected server/client source, and no concurrent browser-QA owner of the
   shared runtime.
2. Resolve listeners on 5001 and 5174. For each, record PID, executable,
   command line, working/source directory where determinable, creation time,
   and confirm it belongs to ATLAS. Do not stop any unidentified process.
3. Capture `tailscale serve status`, localhost health, Tailnet health, and the
   previous commands needed to restore both old ATLAS processes.
4. Confirm the current live database target without printing credentials.
   Capture SELECT-only before signatures for:
   - school-year mirrors and term-contract cache fields;
   - Subject scheduling metadata;
   - sections/faculty mirrors;
   - Teaching Load ownership, cycle, and carry-forward audit rows;
   - generation runs and published revisions;
   - migration table.
5. Confirm migration `0001_term_subject_authority` is already applied. Do not
   run Prisma migration, schema push, seed, repair, or synchronization commands.
6. Reuse local dependency installations only after package/lockfile compatibility
   is mechanically confirmed. Any `.env` copy or dependency junction is
   untracked, secret-safe, limited to the deployment worktree, and removed at
   completion. Never print `.env` contents.

If preflight cannot establish exact targets or rollback commands, stop without
changing the runtime.

## Stage B — approved shared-runtime deployment

1. From the clean approved worktree, run server/client TypeScript checks and
   production builds. A failed gate means no process stop.
2. Stop only the revalidated ATLAS owners of ports 5001 and 5174.
3. Start the built server from the approved worktree on port 5001 with the
   process environment forcing `ROLLOVER_AUTO_SYNC_ENABLED=false`. Use a hidden
   background process and external temporary logs.
4. Start the candidate client from the approved worktree on port 5174 with the
   existing Tailnet-compatible Vite host/proxy configuration. Its production
   build must already have passed.
5. Verify exactly one intended listener per port, both command lines point to
   the approved deployment worktree, localhost and Tailnet health return 200,
   the server log contains the rollover-disabled message, and no rollover-start
   message appears.
6. Do not change `tailscale serve` unless its existing route is incorrect. Any
   route change is outside this approval and requires a stop.

### Runtime rollback trigger

If the new server/client cannot start, health fails, Tailnet login shell cannot
load, the wrong source directory owns a port, or a severe shell/runtime error
prevents normal navigation: stop only the new ATLAS processes, restore the two
captured prior ATLAS commands, reverify health, and return
`PLANNER_DECISION_REQUIRED` with the failure. Do not mutate data to repair a
deployment failure.

## Stage C — live Tailnet acceptance (read-only)

All browser evidence must use
`https://njgrm.buru-degree.ts.net`; assert
`window.location.origin === "https://njgrm.buru-degree.ts.net"`.

1. Reuse an existing authenticated officer session. Because this approval is
   read-only, do not perform a fresh login if it would create login/audit writes.
   If the saved session is invalid, report
   `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` for authenticated surfaces while
   completing safe unauthenticated checks.
2. Test desktop `1366x768` and mobile `390x844`:
   - Dashboard;
   - Year Setup;
   - Subjects;
   - Teaching Load and archived Teaching Load history;
   - Simple Timetable.
3. Verify the active school/year is truthful, stale data is labeled, rollover
   state is visible, retired Curriculum Requirements is absent from the routine
   workflow, Teaching Load history is read-only, and no UI claims generation or
   publication readiness without the canonical diagnostic.
4. Verify no horizontal overflow, mojibake, uncaught page error, duplicate
   primary action, or misleading zero/ready state. Capture accessibility
   snapshots, console errors, and relevant network statuses.
5. Capture network traffic and prove no mutation request was issued by browser
   acceptance. Do not click Save, Apply, Generate, Publish, Delete, or any
   rollover-sync action.

## Stage D — read-only rollover and generation diagnostics

1. Call the production rollover **preview** endpoint only, with the existing
   integration credential obtained from the environment without printing it.
   `POST /api/v1/runtime/rollover-sync/preview` is allowed only as a proven
   zero-write preview. Never call `/rollover-sync/apply`.
2. Compare EnrollPro active year/ordered terms with the ATLAS mirror and
   `termContractCache`. Recompute the SELECT-only signatures from Stage A and
   fail the acceptance if the preview changed any row.
3. Call
   `GET /api/v1/generation/1/9/readiness/diagnostic?enforceShiftWindows=true`
   with authenticated actor-school scope if the existing session permits it.
   Record every typed blocker, exact term identities, derived-demand revision,
   Teaching Load coverage, scheduler assigned/unassigned totals, hard/soft
   violations, database-signature zero-write proof, and repair owner.
4. Do not describe this as a zero-hard-blocker preview unless the live response
   itself proves zero hard blockers, zero unresolved sessions, source freshness,
   scheduler execution, and `zeroWrite=true`.
5. If rollover or term-cache synchronization is required, produce a separate
   HIGH approval preview binding the exact production preview response,
   before-state, predicted changed domains/rows, source revision, rollback,
   and semantic fingerprint. Do not apply it in this cycle.
6. Prepare a generation approval package only if the live diagnostic is already
   clean after this deployment. Otherwise return the smallest corrective or
   data-decision handoff named by its blockers.

## Fresh QA

After the executor returns its deployment/evidence commit, dispatch one fresh
`atlas-qa-delegate`. QA must independently verify:

- deployed process command lines and exact approved source tree;
- rollover-disabled logs and route mount/health;
- before/after database signatures and absence of unauthorized writes;
- exact Tailnet browser origin and both viewports;
- truthful operator states and captured network methods;
- rollover-preview zero-write behavior;
- canonical generation diagnostic without claiming readiness beyond its result;
- cleanup of temporary files/junctions/logs and clean worktree state.

QA does not deploy, rollback, synchronize, generate, publish, or edit evidence.
Any material runtime defect returns `CORRECTION_REQUIRED` or
`PLANNER_DECISION_REQUIRED`; it never repairs the shared runtime itself.

## Evidence and cleanup

- Commit only one concise deployment progress record and one verification
  artifact needed for durable continuity; do not commit logs, screenshots,
  browser profiles, credentials, raw transcripts, or duplicate manifests.
- Record the approved commit, old/new PIDs and commands (sanitized), exact
  Tailnet origin, build/test results, database signature comparison, runtime
  outcome, preview result, diagnostic result, and rollback status.
- Remove all temporary junctions, copied `.env` files, temp logs, and browser
  artifacts from the worktree. Leave the deployed runtime healthy and the
  evidence worktree clean.

## Forbidden actions

- No migration or schema change.
- No `/runtime/rollover-sync/apply`.
- No rollover term-cache, faculty, section, policy, or mirror mutation.
- No Teaching Load carry-forward or suggestion apply.
- No generation run, manual timetable save, or publication.
- No companion-repository edit.
- No edit, reset, clean, stash, or integration use of dirty `D:/ATLAS`.

## Required terminal handoff

Return:

1. `REVIEW_REQUIRED`, `ROLLED_BACK`, or `PLANNER_DECISION_REQUIRED`.
2. Approved/deployed Git SHA and evidence commit SHA.
3. Previous and new process owners plus rollback status.
4. Server/client gates and health/Tailnet results.
5. Exact browser origin, viewports, page findings, console/network evidence.
6. Before/after database signature result and explicit zero-unauthorized-write
   statement.
7. Rollover preview result and whether a separate sync approval is required.
8. Canonical generation diagnostic and typed blockers; never overclaim zero.
9. Exact remaining approval/correction handoff.
10. What is running or awaited, safe parallel work, and locked successors.

Suggested evidence commit:

```text
docs(runtime): record Wave 1 deployment and Tailnet acceptance
```
