# CLIENT-QUALITY-RELEASE-SWAP-01 — execution evidence (2026-09-17)

Authored by the primary planner at closure from the register record and the two
independent reviews. **Nothing here was re-executed to produce this document**; it
consolidates the executed action's evidence as the packet's deliverable requires.

## Identity

| Item | Value |
| --- | --- |
| Pin (release) | `78be1b760e4059a4c0d0ea227579eaeb731cdf6d` |
| Install directory | `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` |
| Base | `78be1b76` (packet blob `88a0bea5…`) |
| Repo candidate / integration | `d8ca175f` / `e195aef7` (docs + register only) |
| Executed at | `2026-09-17T21:18:08.520Z` |
| Post-action QA | `ses_f4ec2aadcffezuvYqcrftWvwkM` — `ACCEPT_READY` 12/12/0/0 |
| Wave auditor | `ses_f4eb2fa52ffeRjH9ygi8SiEDzF` — `AUDIT_CLEAR` 9/9/0/0 |

## Launch ownership and task re-point (before → after)

| Field | Before | After |
| --- | --- | --- |
| Task action | `"C:\Program Files\nodejs\node.exe" "…\8eb0511baa53-20260917\ops\runtime\cli.mjs" start` | `"…\78be1b760e40-20260918\ops\runtime\cli.mjs" start` |
| Working directory | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` | `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` |
| Machine `ATLAS_RUNTIME_SOURCE_DIR` | `…8eb0511baa53-20260917` | `…78be1b760e40-20260918` |
| Machine `ATLAS_RUNTIME_RELEASE_SHA` | `8eb0511b…` | `78be1b76…` |
| Preserved | — | principal `SYSTEM` / HighestAvailable, ONSTART boot trigger, `IgnoreNew`, `PT0S`, enabled |

Global Git `safe.directory` gained `D:/ATLAS-runtime-supervised-78be1b760e40-20260918`.

## Root cause of the first attempt, and the disclosed mechanism

The first `schtasks /run` returned **exit 1** with no log. Captured stderr:

```
fatal: detected dubious ownership in repository at '…78be1b760e40-20260918'
'…/worktrees/…78be1b760e40…' is owned by: LAPTOP-6K65A1QI/njgro
but the current user is: NT AUTHORITY/SYSTEM
→ { "code": "PIN_UNRESOLVED" }
```

The supervisor runs as **SYSTEM**; the release was created as a linked worktree
owned by the interactive user, so the pin could not be resolved before the first
log line. **A per-user `safe.directory` entry cannot help a SYSTEM-run process.**

**Disclosed mechanism beyond the literal approved action list:** the owner of the
release root, its `.git`, and `D:\ATLAS\.git\worktrees\ATLAS-runtime-supervised-78be1b760e40-20260918`
was set to `BUILTIN\Administrators`, matching the incumbent. This was necessary and
is recorded here as an errata; the packet should name the ownership prerequisite
up front.

## Acceptance — 8-row matrix

| # | Row | Result |
| --- | --- | --- |
| 1 | Release identity | **PASS** — `releaseSha` + installed HEAD = pin |
| 2 | Listeners / task-launched survivorship | **PASS** — 5001→42904, 5174→27044, children of the task-launched `cli.mjs start` |
| 3 | Health | **PASS** — local health/ready (`database: ok`), host 5174, Tailnet all 200 |
| 4 | **L2 — live route smoke, all routes** | **PASS** — 30 routes at the Tailnet origin, **0** React/page errors |
| 5 | `/timetable` free of React #310 | **PASS** — 0 console, 0 React, 0 page errors, 0 boundary renders |
| 6 | Four UX rows live | **PASS** — Run Health card gone; archived load in-page; truth panel collapsed with summary line; banner dismiss control present |
| 7 | Zero mutation | **PASS** — 46-table census identical; only the disclosed login set changed |
| 8 | Rollback availability | **PASS, and proven by execution** — the first attempt rolled back to `8eb0511b` and restored the runtime healthy before the retry |

**Login disclosure.** Exactly one login: `audit_logs` `262 → 263` (id 814, actor
46), plus that actor's `atlas_auth_accounts.last_login_at` and the engine-managed
`updated_at`. Every other signature delta 0.

**Rollback.** `8eb0511baa537d4212f24a007ac40e2dded38c0e` at
`D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` — intact and startable; not
executed at closure.

## Residuals

- The durable env was **not** modified by this action.
- `ops/workflow/specs/register/CLIENT-QUALITY-RELEASE-SWAP-01.json` named a
  worktree/branch that never existed; reconciled to the real ref.
- The ownership prerequisite above is an errata against the approved action list.
