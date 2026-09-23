# RUNTIME-DIR-RETENTION-C01 — frozen pre-action manifest (revision 2, post-audit)

**Cycle:** runtime release-directory **retention policy** reclaim (demo-safe depth). **Author:** Lane A.
**Date:** 2026-09-23. **Base:** `origin/main` = `d38fe0d5d81c9a08d67dc5c58a4d60e66f8d605e`.
**Revision 1** (`d38fe0d5`) was audited and returned `CORRECTION_REQUIRED` **3/9**. This revision applies
the prescribed corrections. **No mutation may begin until the re-audit clears this revision.**

## 0. Authority and policy

Operator authorised a **retention policy** on 2026-09-23 (option: **demo-safe**): keep the live release, the
two most recent accepted releases, the two last-resort artifacts and one real dependency source; retire
rollback depth beyond that plus junction pass-through directories whose dependents are gone; keep the
historical live releases until after the demo. A deep rollback becomes a **rebuild**, not a re-point.

## 1. Corrections applied from the revision-1 audit

| Finding | Correction |
|---|---|
| **F1** 3 rows are standalone clones, not worktrees | Reclassified: **12 registered detached worktrees + 3 standalone clones** (`7dbb3b90` — on branch `main`, not detached; `a02884ff`; `5f5c6c4f`). `git worktree remove` applies only to the 12. |
| **F2** an external borrower was missed | **Row 10 `0eb3b67fe94c` is DROPPED from the set.** `E:\ATLAS-worktrees\warning-readability-c01\atlas-server\node_modules` → `0eb3b67fe94c\atlas-server\node_modules`, and `warning-readability-c01` is an **open lane ("packet ready, no owner")**. Re-scan across **all** worktree roots (`E:\ATLAS-worktrees`, `D:\ATLAS-worktrees`, `C:\Users\njgro\.codex\worktrees`, `D:\ATLAS`) found **exactly one** external borrower — this one. |
| **F3/F5** live references not cleared | §5 expanded: the living handoff, `live-state` lines 150–151 / 239–240 / 259 / 442, and the register's **current-state pointers** all name rows or claims this cycle changes. |
| **F4** §5.2 targeted a non-existent line | Retargeted: the absolute never-retire text now lives in `docs/reference/agent-worktree-lifecycle.md`; `AGENTS.md` §3 only delegates to it. |
| **F6** stale baselines | Branches **349**, worktrees **79** (measured at revision-2 authoring). §7 compares against a count captured at execution, not a hard-coded number. |
| **N1** | **Two** stale `safe.directory` entries (`8eb0511baa53`, `78be1b760e40`), not one. |
| **N2** | `E:\ATLAS-runtime-supervised-0232bf9c-20260923` added to §4. |
| **N5** | §6 now records the lifecycle "before retiring, record" fields per row and names the execution owner. |

## 2. Reclaim set — **14 rows, ~17.62 GiB** (target, not a fact)

### 2a. Rollback depth beyond the policy — 9 rows, ~14.05 GiB

| # | Exact path | Class | HEAD | GiB |
|---|---|---|---|---|
| 1 | `D:\ATLAS-runtime-supervised-1fdab989-20260923` | worktree (detached) | `1fdab989` | 1.43 |
| 2 | `D:\ATLAS-runtime-supervised-e78d4473-20260923` | worktree | `e78d4473` | 1.43 |
| 3 | `D:\ATLAS-runtime-supervised-11e8778f-20260923` | worktree | `11e8778f` | 1.43 |
| 4 | `D:\ATLAS-runtime-supervised-7dbb3b90-20260922` | **clone** (branch `main`) | `7dbb3b90` | 1.75 |
| 5 | `D:\ATLAS-runtime-supervised-d4c9f391-20260921` | worktree | `d4c9f391` | 1.43 |
| 6 | `D:\ATLAS-runtime-supervised-d92facfa-20260921` | worktree | `d92facfa` | 1.43 |
| 7 | `D:\ATLAS-runtime-supervised-ecff1d7e-20260921` | worktree | `ecff1d7e` | 1.43 |
| 8 | `D:\ATLAS-runtime-supervised-a02884ff-20260921` | **clone** | `a02884ff` | 1.86 |
| 9 | `D:\ATLAS-runtime-supervised-5f5c6c4f-20260920` | **clone** | `5f5c6c4f` | 1.86 |

These are named in `live-state` **as the rollback depth this policy deliberately reduces** — the retention
decision, not a classification error, is what moves them. §5 must therefore rewrite the rollback
documentation in the same cycle.

### 2b. Junction pass-through cluster — 5 rows, ~3.57 GiB

| # | Exact path | Class | HEAD | GiB | Junction role |
|---|---|---|---|---|---|
| 10 | `D:\ATLAS-runtime-supervised-20f07f59-20260918` | worktree | `20f07f59` | 0.58 | bearer → `78be1b760e40`; target of `405e5b18` |
| 11 | `D:\ATLAS-runtime-supervised-405e5b18-20260918` | worktree | `405e5b18` | 0.58 | bearer → `20f07f59` |
| 12 | `D:\ATLAS-runtime-supervised-4ce73d157f9a-20260918` | worktree | `4ce73d15` | 0.58 | bearer → `E:…ux-quickfix-c01` (client), `0eb3b67fe94c` (server) |
| 13 | `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` | worktree | `78be1b76` | 0.58 | bearer → `8eb0511baa53` (root + client + server) |
| 14 | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` | worktree | `8eb0511b` | 1.25 | chain base (target of `78be1b760e40`) |

## 3. Junction graph (re-measured across all roots)

```
20f07f59 ──▶ 78be1b760e40 ──▶ 8eb0511baa53
405e5b18 ──▶ 20f07f59
4ce73d157f9a ──▶ { E:…ux-quickfix-c01 , 0eb3b67fe94c }
```

- **One external borrower exists and is preserved:** `E:\ATLAS-worktrees\warning-readability-c01\atlas-server\node_modules`
  → `0eb3b67fe94c` (row dropped, §1 F2). **This is an open, unowned lane — flagged to the operator.**
- `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules` is a **real tree, 124 entries**, not a
  reparse point — the cluster's only real graft source; untouched.
- `8eb0511baa53\atlas-client\node_modules` has **0 entries** (already hollow; recorded at `live-state:400`).
- **Removal order:** unlink every link in §2b first, then remove the five rows. Removing `8eb0511baa53`
  before unlinking `78be1b760e40`'s three links would strand them.

## 4. Preserve set

| Group | Directories |
|---|---|
| Live + prior (`E:`) | `89012430` (live), `7ac28124`, `0232bf9c` (new; added per N2) |
| Two most recent accepted (`D:`) | `d9a6aa53`, `28f6f03f` |
| Last-resort artifacts | `20260912` (`9d293879`), `fallback-d44-20260912` (`d44f29e0`) |
| Register rollback target | `54dce67b` |
| Historical live releases (until after the demo) | `3d916b26`, `80acdc25`, `714fadf7`, `d3e9dfef` |
| **Dropped from the set (external borrower)** | `0eb3b67fe94c` |
| Next tranche (`PRESERVE_FOR_DECISION`) | `434b2a81`, `4c7c0bd9`, `74999168`, `d50dde64`, `c93dd2ee`, `5a333c74` (~11.2 GiB) |
| Real dependency source | `E:\ATLAS-worktrees\ux-quickfix-c01` |
| Never touch | `ATLAS-runtime-config`, `D:\ATLAS`, PostgreSQL storage, companions, `stakeholderFiles`, backups |

## 5. Required documentation changes in this cycle

1. **`live-state`:** rewrite the rollback list to the new depth and record that deeper rollback is a
   **rebuild**. Also correct lines **150–151** ("retained do-not-retire trees": `0eb3b67f`, `8eb0511baa53`),
   **239–240** ("`a02884ff` … verified and live, leave it as-is"), **259** ("`D:\ATLAS-runtime-*` release
   trees remain on the never-retire list") and **442** ("`e78d4473` must not be reclaimed").
2. **`docs/handoffs/planner-session-handoff.md`** — a **living** resume document; lines **33**, **94–95**
   and **254–256** name removed rows as current rollback bases.
3. **`docs/reference/agent-worktree-lifecycle.md`** — replace the absolute *"## Never retire or modify …
   `D:/ATLAS-runtime-*`"* block, the do-not-retire set in the capacity bullet, and *"A release that is a
   rollback basis is a do-not-retire dependency"* with the retention policy. (`AGENTS.md` §3 needs no edit —
   it delegates to this file.)
4. **Register (`docs/plans/atlas-delivery-cycles.json` + its generated mirror):** correct the **current-state
   pointers** that name superseded releases as live — `globalNextAction` (line 11) and the
   `CONSOLIDATED-DEPLOYMENT-C10` (:6780), `CLIENT-QUALITY-RELEASE-SWAP-01` (:7306) and
   `DATA-CORRECTION-C01` (:7474) `nextAction` strings, plus generated lines 21/32/35/36. The machine
   verifier and the renderer must both pass afterwards.
5. **`safe.directory`:** record **both** stale entries (`8eb0511baa53`, `78be1b760e40`) as inert. Do not
   remove them silently.

## 6. Removal procedure (guarded)

**Per row, before retiring, record** (lifecycle requirement): exact path · worktree-or-clone · branch or
detached · HEAD · complete `git status --short` · ancestry evidence · any active process.

**Worktrees (rows 1–3, 5–7, 10–14):** `Remove-Item -LiteralPath "<path>\ops\runtime\logs" -Recurse -Force`;
require `git status --short` empty; `cmd /c rmdir` each junction (**link only**); re-verify
`E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules` still has **124** entries; then non-forced
`git worktree remove`. §2b is unlinked in full **before** any of its rows is removed.

**Clones (rows 4, 8, 9):** `git worktree remove` does not apply. Removal is
`Remove-Item -LiteralPath "<exact validated path>" -Recurse -Force`, one row at a time, gated on an empty
per-row reparse scan and the recorded §6 fields. **The retention-policy amendment in §5.3 is what
authorises this path** (the lifecycle reference currently forbids raw recursive deletion); if §5.3 is not
landed first, these three rows are excluded.

One `git worktree prune` at the end. **No `--force`, no globs, no computed paths. No branch is deleted.**
Execution owner: Lane A (the planner), which holds an elevated shell and has already executed
`git worktree remove` successfully in this session.

## 7. Verification plan (post-action)

1. `git worktree list` drops by **12**; **3** clone directories are gone by literal path; `git worktree
   prune` leaves no dangling entry; no `.git/worktrees/<name>` remains for a removed row.
2. `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules` still has 124 entries; **and**
   `E:\ATLAS-worktrees\warning-readability-c01\atlas-server\node_modules` still resolves into the preserved
   `0eb3b67fe94c` with a non-empty tree and its generated Prisma client.
3. `D:` free rises by ≈ 17.62 GiB (20.37 → ≈ 38.0 GiB).
4. Live runtime untouched: release `89012430`, listeners, machine env, task action/workdir unchanged; health,
   health/ready (`database:"ok"`), DB-backed `GET /api/v1/subjects?schoolId=1`, Tailnet 200; served entry
   chunk byte-identical to that release's own `dist`.
5. Branch count compared against the count **captured at execution** (349 at authoring), not a hard-coded
   number; every preserved dir still startable in place.
6. No **live** reference to a removed path anywhere under `docs/`; §5's changes landed; the register's
   machine verifier and renderer both pass.

## 8. Out of scope

The 6 next-tranche anchors (~11.2 GiB); the historical live releases (kept by operator choice); the `E:`
release dirs; the 79 registered worktrees and the wider `E:\ATLAS-worktrees` population.
