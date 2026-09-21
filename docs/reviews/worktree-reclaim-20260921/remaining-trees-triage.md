# Remaining worktree trees — read-only triage (2026-09-21)

The 16 clean worktrees that carry commits not contained in `origin/main`, classified by
`git cherry -v origin/main` inside each tree (`+` = patch not upstream, `-` = upstream
equivalent). **Nothing was removed.** Lane B's active `actor-school-mutations-c01` (7 commits)
is excluded as `KEEP_ACTIVE`.

Purpose: separate *lost work* from *already-integrated duplicates* before anyone sweeps these.

| Tree | Branch | Unmerged | Content | Classification |
|---|---|---|---|---|
| `D:/…/teaching-load-ux-c01r2` | `work/teaching-load-ux-c01r2` | 0 | — | **DUPLICATE** — fix is already in `origin/main` by patch; retire-ready |
| `D:/…/timetable-ttc03` | `work/timetable-ttc03` | 0 | — | **DUPLICATE** — both commits already in `origin/main`; retire-ready |
| `D:/…/migration-guard-r1` | `review/migration-guard-r1-63bf48eb` | 2 | docs | **DOCS-SUPERSEDED** — the code fix (`d2ddf711`) is already equivalent in `main`; only the handoff + QA bundle are unmerged |
| `D:/…/runtime-supervisor-live-install-20260912` | `work/runtime-supervisor-live-install-20260912` | 1 | docs | **DOCS-SUPERSEDED** — records the rejected install attempt; the packet is `SUPERSEDED` |
| `D:/…/tl-suggestion-c03` | `work/tl-suggestion-c03` | 1 | docs | **DOCS-SUPERSEDED** — the C03R planner result is carried by the register |
| `D:/…/smart-ux-audit-c01` | `work/smart-ux-audit-c01` | 1 | docs | **DOCS** — SMART convergence audit; check it was consumed before retiring |
| `D:/…/generation-genc01` | `work/generation-genc01` | 1 | code | **SUPERSEDED-BY-DESIGN** — register: do not rebase or integrate blindly; GEN-C02 supersedes |
| `D:/…/publication-pubc01` | `work/publication-pubc01` | 2 | code | **VERIFY-THEN-RETIRE** — its base fix is equivalent in `main` and PUB-C01R3 (`63a15a37`) is the integrated successor; confirm the two later commits add nothing |
| `D:/…/dashboard-resilience-c01` | `work/dashboard-resilience-c01` | 1 | code | **INTEGRATED-BY-MERGE** — register records it integrated at `47a4405d`; the commit is not an ancestor, so one diff check confirms the content is present before retiring |
| `E:/…/c02-muse` | `work/c02-muse` | 1 | code | **UNIQUE-CONTENT — the only real decision.** "gate overlay, summary, and assigned-classes on actor school"; preserved alternate candidate. Check whether ACTOR-SCOPE-C01 / RR-TERM-CACHE-C01R already cover it |
| `E:/…/g9g10-grid-delta-probe` | `probe/g9g10-grid-delta` | 1 | docs | **DOCS/ANALYSIS** |
| `E:/…/sync-section-enrolment-c01` | `chore/sync-section-enrolment-c01` | 2 | docs | **DOCS** — packet corrections R2/R3 |
| `E:/…/unassigned-feasibility-recon-c01` | `work/unassigned-feasibility-recon-c01` | 1 | docs | **DOCS/ANALYSIS** (F1–F7 recon) |
| `E:/…/workflow-next-prep-20260915` | `codex/workflow-next-prep-20260915` | 4 | docs | **DOCS** — planning/registration |
| `E:/…/workload-blocker-diagnostic` | `probe/workload-blocker-diagnostic` | 1 | docs | **DOCS/ANALYSIS** |

## Conclusion

- **2 trees are exact duplicates** and retire with no content risk.
- **9 are docs-only or deliberately superseded** — the register already carries their
  conclusions, so they are retire-ready once someone confirms that.
- **3 need one diff check each** (`migration-guard-r1`, `publication-pubc01`,
  `dashboard-resilience-c01`) to confirm the integrated content matches.
- **1 is a genuine unintegrated candidate** (`c02-muse`) and needs a product decision, not a
  cleanup decision.

**No work was lost, and none of this is urgent** — the trees are preserved, and there is no
capacity pressure (`D:` 40.76 GiB, `E:` 66.13 GiB free). Treat this as a maintenance backlog
item, not a blocker. The only path that could destroy something real is a blanket sweep before
`c02-muse` is resolved.
