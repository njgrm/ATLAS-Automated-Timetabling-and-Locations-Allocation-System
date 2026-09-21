# Worktree reclaim 2026-09-21 — post-action report

Executed 2026-09-21 by the primary planner from `D:\ATLAS`, against the audited manifest
(`docs/reviews/worktree-reclaim-20260921/manifest.md`, corrected at `72b49739`; pre-action
audit `CORRECTION_REQUIRED` → corrections applied → re-verified clear).

## Result

| Metric | Before | After |
|---|---|---|
| Registered worktrees | 112 | **57** |
| `D:` free | 15.81 GiB | **40.76 GiB** |
| `E:` free | 55.7 GiB | **66.13 GiB** |
| Reclaimed | — | **≈35.4 GiB** |

**56 / 56 worktrees removed.** `git worktree remove <exact path>`, never `--force`, exact
paths only, no globs or computed paths. `git worktree prune` run once at the end. The count
reconciles exactly: 112 registered − 56 removed + 1 planner worktree created for this stream
= 57.

## Safety assertions

- **Junctions de-linked from the source side only.** Every `node_modules` junction inside a
  retiring tree was removed with `cmd /c rmdir` (link only, never recursive, never `/s`),
  then its target re-checked to exist. Before execution a live anchor re-scan rebuilt the
  junction-target set from all registered worktrees and aborted if any batch path had become
  a target — it was clear.
- **Shared targets intact.** All 17 anchor target paths verified present after removal;
  `missing anchors = 0`.
- **Runtime releases untouched.** Two batch links pointed into `D:\ATLAS-runtime-supervised-*`;
  those were de-linked from the source side only and no runtime directory was touched.
- **No branch deleted.** 292 local branch refs are intact. Sampled retired branches resolve
  to their recorded HEADs, e.g. `work/tt-tl-modules-c04 → b7c4d386`,
  `chore/mig-apply-0002-0003 → 10769108`,
  `integration/tl-suggestion-c03r2-20260913 → d4e9dc8e`,
  `work/workflow-hardening-c02 → cf1d360c`, `fix/flag-overlay-slot → ec2430ab`.
- **Every exclusion held.** Still registered and untouched: `w1-runtime-deploy` (`1ead5622`),
  `integration-tlrr01r-20260911` (`fdd0c8c7`) — the two named startable fallbacks the
  pre-action audit recovered — `ux-quickfix-c01` (`74c1f12a`), Lane B's active
  `actor-school-mutations-c01` (`2f1ee14b`), both uncertain-owner planner worktrees,
  `c02-muse`, all `D:\ATLAS-runtime-*` trees, the three Codex worktrees, and `D:/ATLAS`.
- No file inside any preserved worktree was modified by this operation.

## Carried forward

- The 56 branch refs remain available; a retired tree can be recreated in **tracked** content
  only via `git worktree add <path> <SHA>` — `dist/`, `node_modules/` and `.env` are not
  restored. This is why the two startable fallbacks were excluded.
- Backlog, unchanged and not authorised here: the **16 clean worktrees carrying commits not
  contained in `origin/main`** and the **8 dirty worktrees** remain classified
  `PRESERVE_FOR_DECISION`; three were double-flagged. They need an operator decision or
  per-tree integration review before any further reclamation.
- The helper script used for execution was deleted from the planner worktree immediately
  after the run; it left no tracked artifact.

## Effect on the program

`D:` moving to 40.76 GiB clears the **release-build capacity blocker** recorded earlier the
same day (15.81 GiB could not absorb a 1.43–1.86 GiB release build without crossing the
15 GiB fail-closed floor). Release builds are unblocked; deployment itself remains a separate
HIGH action requiring its own approval.
