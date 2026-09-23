# RUNTIME-DIR-RETENTION-C01 — frozen pre-action manifest

**Cycle:** runtime release-directory **retention policy** reclaim (demo-safe depth). **Author:** Lane A.
**Date:** 2026-09-23. **Base:** `origin/main` = `0232bf9cd1524038e2853bf2be468d2d90466854`.
**Risk:** destructive filesystem action over release/rollback artifacts. Not a live-data, schema,
generation, publication or runtime-process mutation.

## 0. Authority and the policy this implements

The operator authorised a **retention policy** on 2026-09-23 (chosen option: **demo-safe**) after
`RUNTIME-DIR-RECLAIM-C01` showed that 45.99 GiB of release directories had accumulated because no rule
defined how deep the rollback chain must be. The policy:

- **Keep** the live release, the **two most recent accepted releases**, the **two named last-resort
  artifacts** (the supervisor's reset baseline and the manual fallback), and one real dependency source.
- **Retire** rollback depth beyond that, plus the junction pass-through directories whose dependents no
  longer exist.
- **Keep the historical live releases until after the demo** (operator's explicit choice).
- A deep rollback becomes a rebuild (`git worktree add --detach <sha>` → install → `prisma generate` →
  both builds), not an instant re-point. That is the only capability traded.

This manifest is the frozen artifact for stage 1 of the bounded cycle. **No mutation may begin until the
independent pre-action audit clears it** (stage 2), then guarded removal (stage 3), then post-action audit
(stage 4) — the same discipline as `RUNTIME-DIR-RECLAIM-C01`.

## 1. Carried-forward safety facts (already established and audited today)

From `RUNTIME-DIR-RECLAIM-C01` (manifest `4f911381`, post-action audit 8/8, zero blocking):
- **Every** `D:\ATLAS-runtime-*` release directory is built from a commit that is an **ancestor of
  `origin/main`**, and every commit object exists in the shared repo `D:\ATLAS`. Nothing holds unique
  source; only rebuildable `dist` is lost.
- The **3 stashes belong to `D:\ATLAS`**, not to any release directory (`refs/stash` is shared across
  linked worktrees).
- The junction graph is fully mapped. Re-measured for this cycle (§3) — it is **closed**.
- All 7 pre-existing junction targets survived the previous cycle with their dependency trees intact.

## 2. Reclaim set — 15 rows, ~18.85 GiB (target; treat as a target, not a fact)

### 2a. Rollback depth beyond the policy — 9 rows, ~14.05 GiB

| # | Exact path | HEAD | GiB |
|---|---|---|---|
| 1 | `D:\ATLAS-runtime-supervised-1fdab989-20260923` | `1fdab989` | 1.43 |
| 2 | `D:\ATLAS-runtime-supervised-e78d4473-20260923` | `e78d4473` | 1.43 |
| 3 | `D:\ATLAS-runtime-supervised-11e8778f-20260923` | `11e8778f` | 1.43 |
| 4 | `D:\ATLAS-runtime-supervised-7dbb3b90-20260922` | `7dbb3b90` | 1.75 |
| 5 | `D:\ATLAS-runtime-supervised-d4c9f391-20260921` | `d4c9f391` | 1.43 |
| 6 | `D:\ATLAS-runtime-supervised-d92facfa-20260921` | `d92facfa` | 1.43 |
| 7 | `D:\ATLAS-runtime-supervised-ecff1d7e-20260921` | `ecff1d7e` | 1.43 |
| 8 | `D:\ATLAS-runtime-supervised-a02884ff-20260921` | `a02884ff` | 1.86 |
| 9 | `D:\ATLAS-runtime-supervised-5f5c6c4f-20260920` | `5f5c6c4f` | 1.86 |

All nine are registered detached worktrees, integrated, inactive, and `LOGS-ONLY`. They are named in
`live-state` **as the rollback depth this policy deliberately reduces** — so the retention decision, not a
classification error, is what moves them. **This cycle must therefore also rewrite the rollback list in
`live-state` to the new depth** (§5), or the register will document rollback bases that no longer exist.

### 2b. Junction pass-through cluster — 6 rows, ~4.80 GiB

| # | Exact path | HEAD | GiB | Junction role |
|---|---|---|---|---|
| 10 | `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918` | `0eb3b67f` | 1.23 | bearer → `E:…ux-quickfix-c01` (client); target of `4ce73d157f9a` (server) |
| 11 | `D:\ATLAS-runtime-supervised-20f07f59-20260918` | `20f07f59` | 0.58 | bearer → `78be1b760e40`; target of `405e5b18` |
| 12 | `D:\ATLAS-runtime-supervised-405e5b18-20260918` | `405e5b18` | 0.58 | bearer → `20f07f59` |
| 13 | `D:\ATLAS-runtime-supervised-4ce73d157f9a-20260918` | `4ce73d15` | 0.58 | bearer → `E:…ux-quickfix-c01` (client), `0eb3b67fe94c` (server) |
| 14 | `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` | `78be1b76` | 0.58 | bearer → `8eb0511baa53` |
| 15 | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` | `8eb0511b` | 1.25 | chain base (target of `78be1b760e40`) |

## 3. Junction analysis — the cluster is closed

Re-measured 2026-09-23 across all remaining `D:` release directories. Every remaining link points either
**into another row of §2b** or **into the real dependency source** `E:\ATLAS-worktrees\ux-quickfix-c01`
(client `node_modules`, **124 entries — a real tree, untouched by this cycle**).

```
20f07f59 ──▶ 78be1b760e40 ──▶ 8eb0511baa53
405e5b18 ──▶ 20f07f59
4ce73d157f9a ──▶ { E:…ux-quickfix-c01 , 0eb3b67fe94c }
0eb3b67fe94c ──▶ E:…ux-quickfix-c01
```

**No directory outside §2b borrows from §2b.** The five dependents that previously borrowed from this
cluster (`131baab7`, `3c4cc3cd8d7d`, `74c1f12a5c06`, `798cd78356ef`, `f0d65a531e34`) were removed by
`RUNTIME-DIR-RECLAIM-C01` earlier today. Therefore the whole cluster can be unlinked and retired **as a
unit**, bottom-up, with the E: worktree left intact.

## 4. Preserve set

| Group | Directories | Reason |
|---|---|---|
| Live + prior release (`E:`) | `89012430` (live serving release), `7ac28124` | Live; `E:` has headroom |
| Two most recent accepted (`D:`) | `d9a6aa53` (recorded rollback basis), `28f6f03f` | The policy's fast-rollback depth |
| Last-resort artifacts | `20260912` (`9d293879`, supervisor reset baseline), `fallback-d44-20260912` (`d44f29e0`, manual fallback) | Named rollback targets in the register; removing the last resort is not demo-safe |
| `54dce67b` | `D:\ATLAS-runtime-supervised-54dce67b-20260914` | Named as a rollback target in the register |
| Historical live releases | `3d916b26`, `80acdc25`, `714fadf7`, `d3e9dfef` | Operator chose to keep these until after the demo |
| Audit-recovered anchors (next tranche) | `434b2a81`, `4c7c0bd9`, `74999168`, `d50dde64`, `c93dd2ee`, `5a333c74` | `PRESERVE_FOR_DECISION` — ~11.2 GiB available after the demo; **not in this cycle** |
| Real dependency source | `E:\ATLAS-worktrees\ux-quickfix-c01` | Active worktree; the cluster's only real tree |
| Never touch | `ATLAS-runtime-config` | `AGENTS.md` §3 |

Also untouched: `D:\ATLAS`, PostgreSQL storage, companion repositories, `stakeholderFiles`, backups.

## 5. Required documentation changes in this cycle

1. **`live-state`:** replace the rollback list (`d9a6aa53` + the 12-deep fallback list) with the new policy
   — the live release, the two most recent accepted, and the two last-resort artifacts — and record that
   deeper rollback is a **rebuild**, not a re-point.
2. **`AGENTS.md` §3:** replace the absolute *"Never retire or modify … `D:/ATLAS-runtime-*`"* line with the
   retention policy, so this accumulation cannot recur and no future cycle needs a one-off exception.
3. **Register note:** `8eb0511baa53` and `78be1b760e40` appear in
   `docs/plans/atlas-delivery-cycles.json` as **historical cycle records** (PIN40, past live releases).
   History is not invalidated by removing the directory, but the register carries a **ratified global Git
   `safe.directory` entry for `D:/ATLAS-runtime-supervised-8eb0511baa53-20260917`**, which becomes stale.
   Record it; do not silently drop it.

## 6. Removal procedure (guarded)

For each worktree row: `Remove-Item -LiteralPath "<path>\ops\runtime\logs" -Recurse -Force`; require
`git status --short` empty; `cmd /c rmdir` each junction (**link only — never `Remove-Item -Recurse` on a
reparse point**); re-verify `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules` still has its
**124** entries; then non-forced `git worktree remove`. §2b is removed **bottom-up** (`8eb0511baa53` first
would strand `78be1b760e40` — unlink all links first, then remove all six). One `git worktree prune` at the
end. **No `--force`, no globs, no computed paths. No branch is deleted.**

## 7. Verification plan (post-action)

1. `git worktree list` drops by 15; `git worktree prune` leaves no dangling entry; no
   `.git/worktrees/<name>` remains for a removed row.
2. `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules` still has 124 entries; no remaining
   reparse point points at a removed row.
3. `D:` free rises by ≈ 18.85 GiB (20.37 → ≈ 39.2 GiB).
4. Live runtime untouched: release `89012430`, listeners, machine env, task action/workdir unchanged;
   `/api/v1/health` + `/api/v1/health/ready` (`database:"ok"`) + DB-backed
   `GET /api/v1/subjects?schoolId=1` + Tailnet 200; served entry chunk byte-identical to that release's own
   `dist`.
5. Branch count unchanged at 347; every preserved dir still startable in place.
6. No **live** reference to a removed path anywhere under `docs/`; the register, `live-state` and
   `AGENTS.md` updated per §5.

## 8. Out of scope

The 6 audit-recovered anchors (~11.2 GiB, next tranche, §4); the historical live releases (kept by
operator choice); the `E:` release dirs; the 77 registered worktrees and the wider
`E:\ATLAS-worktrees` population.
