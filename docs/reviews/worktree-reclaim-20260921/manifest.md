# Worktree reclaim 2026-09-21 — pre-action manifest

Objective: reclaim disk from `D:\ATLAS-worktrees` and `E:\ATLAS-worktrees` (registered
worktrees only) without touching any live, dirty, unintegrated, anchored, or
uncertain-owner tree. Operator instruction: *"Reclaim trees from D and E, they're both
filling up."*

Risk: **MEDIUM repository hygiene.** No live mutation. Branch deletion is **not**
authorised and will not occur; commits and branches preserve all history.

Measured at 2026-09-21: `D:\ATLAS-worktrees` **46.71 GiB** / `E:\ATLAS-worktrees`
**22.72 GiB**. `D:` free 15.81 GiB, `E:` free 55.7 GiB.

## Method

A worktree is in the reclaim set **only if all** of these hold, each verified at this
commit:

1. under `D:/ATLAS-worktrees` or `E:/ATLAS-worktrees` (no other root is touched);
2. `git status --porcelain` **empty** (clean);
3. `git rev-list --count origin/main..HEAD` **== 0** (every commit already in `origin/main`
   — contained, not merely "accepted elsewhere");
4. **not a junction target** (no other worktree's `node_modules` points into it);
5. not on the policy-preserve list below;
6. no active process holding it.

Result after the independent pre-action audit: **56 worktrees, ≈35.25 GiB reclaimable** —
`D:` ≈ 24.45 GiB, `E:` ≈ 10.80 GiB. `D:` free should go 15.81 → ~40 GiB; that removes the
release-build capacity blocker. Two trees initially listed were struck after the audit —
see the exclusions table.

### Exclusions — never touched

| Set | Paths | Reason |
|---|---|---|
| Stale root | `D:/ATLAS` | Historical; never an integration boundary |
| Codex-managed | `C:/Users/njgro/.codex/worktrees/{7dcd,992e,f515}/ATLAS` | Codex owns them |
| Runtime releases | `D:/ATLAS-runtime-*` (20) | `AGENTS.md` §3: never retire or modify |
| Junction anchors | `E:/…/ux-quickfix-c01`, `E:/…/export-presentation-s15-rebaseline`, `E:/…/g9g10-grid-delta-probe`, `E:/…/tl-operator-workspace-c05`, `D:/…/actor-scope-c01`, `D:/…/companion-sso-c01`, `D:/…/integration-rrtc01r-20260912`, `D:/…/integration-tt-tl-c03-cycle-20260913`, `D:/…/teaching-load-dept-apply`, `D:/…/teaching-load-tlc02`, `D:/…/timetable-ttc04`, `D:/…/tt-shape-diagnostic-c02` | Other worktrees' `node_modules` point into them |
| Uncertain owner | `D:/…/planner-tt-tl-modules-c04r1`, `E:/…/planner-c06b-closure` | Named in the session handoff as earlier sessions' |
| Unintegrated candidate | `E:/…/c02-muse` | Preserved alternate candidate |
| Startable fallbacks | `D:/…/w1-runtime-deploy`, `D:/…/integration-tlrr01r-20260911` | Retained `PRESERVE_FOR_DECISION` by `ROOT-WORKTREE-RETIRE-C01` and **still cited as startable fallback locations** in `docs/plans/atlas-active-delivery-streams.md`. Both are real fallback images (`dist/` and installed `node_modules` present), which a re-`worktree add` would **not** restore |
| Active stream | `E:/…/actor-school-mutations-c01` | **Two live `tsx` processes observed (Lane B mid-run)**; also 7 commits ahead |
| Dirty (8 under the roots) | `E:/…/release-client-quality-01`, `D:/…/companion-sso-c01`, `D:/…/integration-companion-sso-20260913`, `D:/…/integration-tt-sync-term-c03r4-20260913`, `D:/…/teaching-load-tlc02`, `D:/…/tl-authority-diagnostic-c02`, `D:/…/tt-sync-term-c03r4`, `E:/…/tl-operator-workspace-c05` — plus the out-of-root `…/opencode/sca03d-rollback-src`, which is not under either reclaim root | `AGENTS.md` §3: preserve every dirty worktree |
| Ahead of `origin/main` (16) | includes `dashboard-resilience-c01`, `migration-guard-r1`, `publication-pubc01`, `generation-genc01`, `teaching-load-ux-c01r2`, `timetable-ttc03`, `tl-suggestion-c03`, `sync-section-enrolment-c01`, `workflow-next-prep-20260915`, `unassigned-feasibility-recon-c01`, `workload-blocker-diagnostic`, `g9g10-grid-delta-probe`, `smart-ux-audit-c01`, `runtime-supervisor-live-install-20260912` | Unmerged commits — preserve |

## Reclaim set — 56 (evidence: clean, contained, unanchored, inactive)

`D:` — 39 trees, ≈24.45 GiB:

| Path | MB |
|---|---|
| D:/ATLAS-worktrees/tt-tl-modules-c04 | 1471 |
| D:/ATLAS-worktrees/actor-scope-deploy-restore-20260912 | 1467 |
| D:/ATLAS-worktrees/tt-tl-authority-guard-c04 | 981 |
| D:/ATLAS-worktrees/tl-suggestion-c03r2 | 967 |
| D:/ATLAS-worktrees/integration-tl-tt-c02-20260912 | 892 |
| D:/ATLAS-worktrees/integration-tt-tl-modules-c04r1-20260914 | 592 |
| D:/ATLAS-worktrees/enrollpro-proxy-recovery-c01 | 591 |
| D:/ATLAS-worktrees/integration-enrollpro-proxy-recovery-c01 | 591 |
| D:/ATLAS-worktrees/integration-tl-suggestion-c03r2-20260913 | 591 |
| D:/ATLAS-worktrees/integration-tt-output-c03r3-20260913 | 590 |
| D:/ATLAS-worktrees/runtime-supervision-c01 | 589 |
| D:/ATLAS-worktrees/tt-output-c03 | 589 |
| D:/ATLAS-worktrees/integration-actor-scope-c01 | 588 |
| D:/ATLAS-worktrees/tl-rr01r | 587 |
| D:/ATLAS-worktrees/tl-rr01 | 587 |
| D:/ATLAS-worktrees/teaching-load-ux-c01 | 587 |
| D:/ATLAS-worktrees/integration-term-consume-c02 | 587 |
| D:/ATLAS-worktrees/readiness-term-c03r3 | 586 |
| D:/ATLAS-worktrees/integration-pubc01r3 | 585 |
| D:/ATLAS-worktrees/integration-ttc02 | 585 |
| D:/ATLAS-worktrees/timetable-ttc02 | 583 |
| D:/ATLAS-worktrees/term-consume-c02 | 582 |
| D:/ATLAS-worktrees/teaching-load-apply | 581 |
| D:/ATLAS-worktrees/timetable-ux-01 | 580 |
| D:/ATLAS-worktrees/integration-timetable-ttc04 | 579 |
| D:/ATLAS-worktrees/workflow-directive-closure-20260914 | 579 |
| D:/ATLAS-worktrees/workflow-closure-recovery-20260914 | 579 |
| D:/ATLAS-worktrees/integration-tl-suggestion-c03r3-20260914 | 578 |
| D:/ATLAS-worktrees/tl-suggestion-c03r3-atomicity | 578 |
| D:/ATLAS-worktrees/work-runtime-supervisor-live-install-restore-20260912 | 577 |
| D:/ATLAS-worktrees/work-tt-tl-runtime-acceptance-20260912 | 577 |
| D:/ATLAS-worktrees/runtime-stability-wave-20260912 | 577 |
| D:/ATLAS-worktrees/integration-runtime-supervisor-restore-20260912 | 577 |
| D:/ATLAS-worktrees/runtime-r2-final-audit | 577 |
| D:/ATLAS-worktrees/integration-w1-deploy | 577 |
| D:/ATLAS-worktrees/runtime-supervisor-live-install-correction-20260912 | 577 |
| D:/ATLAS-worktrees/integration-tt-tl-runtime-acceptance-20260912 | 577 |
| D:/ATLAS-worktrees/curriculum-sca04a | 573 |
| D:/ATLAS-worktrees/integration-term-cache-preview-20260914 | 27 |

`E:` — 17 trees, ≈10.80 GiB:

| Path | MB |
|---|---|
| E:/ATLAS-worktrees/section-route-authority-c01 | 1257 |
| E:/ATLAS-worktrees/mig-apply-0002-0003 | 891 |
| E:/ATLAS-worktrees/integration-wf-seed-term-cache-tl-c06-20260916 | 634 |
| E:/ATLAS-worktrees/workflow-hardening-c02 | 632 |
| E:/ATLAS-worktrees/client-quality-c01 | 626 |
| E:/ATLAS-worktrees/integration-rollover-graded-autonomy-c01 | 594 |
| E:/ATLAS-worktrees/rollover-graded-autonomy-c01 | 594 |
| E:/ATLAS-worktrees/timetable-grid-fix | 587 |
| E:/ATLAS-worktrees/export-filename-fix | 587 |
| E:/ATLAS-worktrees/timetable-cell-info | 587 |
| E:/ATLAS-worktrees/scheduler-search-c01 | 584 |
| E:/ATLAS-worktrees/flag-overlay-slot | 583 |
| E:/ATLAS-worktrees/rollover-graded-planner | 583 |
| E:/ATLAS-worktrees/g9-g10-config-correction-c01 | 583 |
| E:/ATLAS-worktrees/year10-gen-readiness-c01 | 583 |
| E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 | 579 |
| E:/ATLAS-worktrees/integration-workflow-c02-c03-20260914 | 579 |

## The junction hazard and the removal procedure

100 `node_modules` junction links exist across the registered worktrees; the majority point
at `D:\ATLAS\{,atlas-client\,atlas-server\}node_modules`, and several point at other
worktrees. **`git worktree remove` on a tree containing a junction can traverse the link and
delete the shared target** — the failure mode that has already taken the live runtime down.
Therefore, per worktree, in order:

0. **Re-scan for anchors immediately before the batch.** Rebuild the junction-target set from
   every registered worktree and abort if any reclaim-set path has become a target since this
   manifest. A new anchor appearing after manifest time is the one way this batch could
   traverse a link.
1. Re-verify the row live: `git status --porcelain` empty; `git rev-list --count
   origin/main..HEAD` == 0; HEAD unchanged from this manifest.
2. Enumerate reparse points inside the worktree (`node_modules`, `atlas-client\node_modules`,
   `atlas-server\node_modules`, and any others found).
3. Remove **each link** with `cmd /c rmdir "<link>"` — link only, never recursive, never `/s`,
   never `--force`. Where a link targets a **runtime release** directory
   (`D:\ATLAS-runtime-supervised-20260912`, `…-0eb3b67fe94c-20260918`), de-junction from the
   **source side only**: the link is removed, the target is never touched or "cleaned". Verify
   the target path still exists immediately afterwards.
4. Confirm no reparse point remains inside the worktree.
5. `git worktree remove "<exact path>"` (never `--force`), then `git worktree prune`.
6. Re-verify the concrete anchor target paths still exist:
   `D:\ATLAS\{,atlas-client\,atlas-server\}node_modules`,
   `D:\ATLAS-worktrees\actor-scope-c01\{,atlas-client\,atlas-server\}node_modules`,
   `D:\ATLAS-worktrees\companion-sso-c01\atlas-server\node_modules`,
   `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\node_modules`,
   `D:\ATLAS-worktrees\integration-tt-tl-c03-cycle-20260913\atlas-client\node_modules`,
   `D:\ATLAS-worktrees\teaching-load-dept-apply\atlas-server\node_modules`,
   `D:\ATLAS-worktrees\timetable-ttc04\atlas-client\node_modules`,
   `D:\ATLAS-worktrees\tt-shape-diagnostic-c02\{atlas-client,atlas-server}\node_modules`,
   `E:\ATLAS-worktrees\export-presentation-s15-rebaseline\atlas-server\node_modules`,
   `E:\ATLAS-worktrees\g9g10-grid-delta-probe\node_modules`,
   `E:\ATLAS-worktrees\tl-operator-workspace-c05\atlas-client\node_modules`,
   `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules`.

**No branch is deleted.** Removal is per-worktree and exact-path; no globs, no computed paths.

## Verification and rollback

- Before/after: `Get-PSDrive` free space on `D:` and `E:`; `git worktree list` count.
- Partial failure stops the batch; the remaining rows are untouched and re-listed.
- Rollback: a removed tree is **not** fully restorable. Every commit and branch is preserved,
  so `git worktree add <path> <SHA>` recreates the **tracked** content — but it does **not**
  restore `dist/`, `node_modules/`, or any `.env`. That is why the two named
  startable-fallback trees are excluded, and why only clean, contained, re-creatable trees are
  in the batch. **No branch is deleted.**
- If any shared target disappears, stop immediately and treat it as an incident.

## Disposition

The 58 rows are `RETIRE_AFTER_INTEGRATION`-equivalent: clean, contained in `origin/main`,
unanchored, inactive. Every exclusion above is `PRESERVE_FOR_DECISION` or `KEEP_ACTIVE`.
