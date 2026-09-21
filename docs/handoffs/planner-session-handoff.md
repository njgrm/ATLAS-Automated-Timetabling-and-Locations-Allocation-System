# ATLAS planner session handoff (living document)

**Updated at the end of every turn** so a fresh session resumes from this one file. Keep it
**short**: narrative belongs in packets, evidence and Git, which are indexed under Pointers below.
A fresh session pays for every line of this file before it does any work.

**To resume in a fresh session, paste this one line:**
> Read `docs/handoffs/planner-session-handoff.md` on `origin/main` and resume as the ATLAS
> primary planner (Lane A). It is self-contained; then follow its read order.

Last updated: 2026-09-21 (Lane A).

## Verdict

Two cycles closed back-to-back and **both are live**: `DUP-READ-CALLERS-C01R` (client, accepted
**7/7** on `a02884ff`) and `ACTOR-SCHOOL-MUTATIONS-C01` Part B (server, accepted **5/5** on
`80acdc25` after an independent source review at **9/9**). **The release queue is empty** — nothing
accepted is undeployed.

**Premise correction, 2026-09-21 — read this before planning anything.** The session that wrote the
earlier version of this file spent a packet, an independent review and an executor dispatch on a
**term-cache apply that had already been satisfied on 2026-09-18**. The DB shows mirror **551**
(year 10) cached, `TERM_CACHE_SYNC_APPLIED` = 2, `GenerationRun` = 4, and **published run 315 /
revision 42 with zero HARD violations**. **The generation/publication core is already met.** The
cause was an undated "still pending" line that contradicted facts recorded elsewhere in the same
file — hence `AGENTS.md` §15's dated-blocker rule. **Read the newest dated handoff
(`docs/handoffs/planner-handoff-2026-09-20.md`) and reconcile before acting on any blocker line.**

## Live identity

- Pin `80acdc257cee613418eaa24db4607114b68c2d25` at
  `D:\ATLAS-runtime-supervised-80acdc25-20260921` (registered detached worktree, not a clone).
- Supervisor **96476**; server `5001`→**103700**; client `5174`→**96612**; entry
  `/assets/index-C6LTCXSf.js`; Tailnet healthy; `D:` **35.82 GiB**.
- Rollback: `a02884ff` **startable in place** at `D:\ATLAS-runtime-supervised-a02884ff-20260921`
  (pre-mutation task XML `B0EF4152…`); behind it `4c7c0bd9`, `5f5c6c4f`, `434b2a81`. Never
  executed.
- The release carries the server actor-school enforcement on the eight runtime mutation `POST`
  routes **and** everything accepted before it.

## Custody

- **Lane A (this lane) owns:** `docs/plans/live-state.md`, the delivery register, `AGENTS.md`,
  `CHANGELOG.md`, `atlas-client/**`, `ops/**`, `prisma/**`, `.opencode/**`, the root
  `package.json`, every `.env`, `D:\ATLAS-runtime-config\**`, deployment, and the **single browser
  controller**.
- **Lane B owns `atlas-server/src/**`** and its own docs (`docs/handoffs/lane-b.md`,
  `lane-a-to-lane-b.md`, charter `lane-b-charter-2026-09-21.md`).
- **A parallel planner is authorized (operator, 2026-09-21)** and stays out of Lane A's lanes:
  `E:/ATLAS-worktrees/test-gate-reachability-c01` (`work/test-gate-reachability-c01`, HEAD
  `c6692bad`, dirty `M atlas-server/package.json`). Preserve it; expect `main` to move when they
  land; re-read their handoff before any `:main` push (`AGENTS.md` §14 exclusive-window rule).
- **Worktrees.** `E:/ATLAS-worktrees/planner-worktree-reclaim-20260921` is this lane's docs
  worktree (`KEEP_ACTIVE`) and pushes go from it. Retired 2026-09-21 (non-forced, branches kept):
  `dashboard-truth-c01`, `dup-read-callers-c01r`, `release-actor-school-mutations-c01-20260921`.
  **`PRESERVE_FOR_DECISION`:** `E:/ATLAS-worktrees/c01r-release-20260921` — a stray *clone*
  (`origin` = stale `D:\ATLAS`), clean, no unique commits, ~1 GiB; removal needs an operator
  instruction because a raw recursive delete is not permitted for a non-worktree.
  **Do not touch:** Lane B's `actor-school-mutations-c01`, the two uncertain-owner planner
  worktrees, `ux-quickfix-c01` (junction anchor), any `D:\ATLAS-runtime-*` tree.

## Read order for a fresh session

1. **`AGENTS.md` from `origin/main`** — the authority; read the current one, not the injected copy.
2. **This file**, then `docs/plans/live-state.md` (live release, blockers, single next action).
3. As the work requires: `docs/reference/agent-runtime-deploy-facts.md` (before any
   deployment/runtime/task/env action), `agent-worktree-lifecycle.md` (before any worktree or
   release-directory action), `agent-verification-gates.md`, `agent-context-economy.md`,
   `agent-live-browser-qa.md`.

**Traps that waste a fresh session's first turn:**

1. **`D:\ATLAS` is a stale, dirty checkout** and the `AGENTS.md` the harness auto-injects comes
   from it. It is **never** an integration boundary. Work in `E:/ATLAS-worktrees/`.
2. **An agent shell inherits a stale process-scope `ATLAS_RUNTIME_SOURCE_DIR`/`…_RELEASE_SHA`**
   that shadows machine scope; an unqualified `cli.mjs stop`/`status` reads the wrong state file.
   Pass explicit env overrides.
3. **Two planner worktrees in the registry are not yours** (`D:/ATLAS-worktrees/planner-tt-tl-modules-c04r1`,
   `E:/ATLAS-worktrees/planner-c06b-closure`) — leave them alone.

## Model routing and burn

- **Dispatch `atlas-executor-muse`** (Muse Spark 1.3 Contributor), not `atlas-executor`
  (operator instruction, 2026-09-21). Executors are ~2% of spend; they are not the cost lever.
- **QA/reviewer agent is `atlas-qa-dsflashv4` — already set, do not change**
  (`docs/handoffs/planner-handoff-2026-09-20.md` §3). Three review/QA dispatches on 2026-09-21 went
  to the generic `atlas-qa` (the 97%-of-spend model) instead — a routing miss worth ~3x per
  dispatch. Use `atlas-qa-dsflashv4`.
- **Executors cannot create worktrees.** The muse harness denies `git worktree add`/`remove`
  (measured 2026-09-21, which cost a dispatch). **The planner provisions the executor's registered
  worktree before dispatch**, then hands over the exact path.
- **Two recorded muse failure modes — both wording, not code:** (i) it **overstated its own
  evidence** (reported a failing-first tally of 8/2/6 where independent QA measured 8/3/5, naming a
  control that was not discriminating); (ii) it **claimed a method that had not executed** (a
  `SET LOCAL TIME ZONE 'UTC'` "pin" issued outside a transaction is a no-op, and it published the
  unpinned hash as pinned). Adversarially check its counts and its method claims. It has also
  stopped correctly and cheaply when a packet's premise had moved — twice — which is worth as much
  as a completed run.
- **Burn:** `opencode stats --days N --project ""` isolates this repo. The provider-console
  allowance percentage is **not** machine-readable from this lane and this lane must never log into
  the operator's provider account. Figures, the model split and per-turn readings live in
  `docs/reviews/workflow-cost-tracking.md`.
- **Efficiency here means finishing faster**, not spending less: the levers are fewer planner
  turns, **≤ 2 reviewer dispatches per release** (`AGENTS.md` §11, §16), and acting only on
  **dated** blocker lines (`AGENTS.md` §15).

## Authorization

- **Standing authorization (operator, 2026-09-20):** HIGH actions, deployment and browser
  acceptance proceed **without a per-action approval round-trip**, provided every existing gate is
  retained — independent pre-action review, one executor, one fresh independent post-action QA,
  labelled browser rows, and a real `passed/blocked/unperformed` tally. It removes waiting, never
  evidence.
- **`AGENTS.md` §14:** a lane in an integration closure holds an **exclusive `main` push window**.
- Live-data applies, generation and publication have been held **separately locked** by the
  planner's own state, not by an operator instruction — treat unlocking one as a planner decision
  that must be stated plainly *before* it runs.

## Decisions awaited

- Removal instruction for the stray clone `E:/ATLAS-worktrees/c01r-release-20260921` (~1 GiB).
- Nothing else is blocked on the operator: the release queue is empty and the next action is ours.

## Next action

**Pick up a real open lane — the generation/publication core is already met.** Ranked, from
`docs/handoffs/planner-handoff-2026-09-20.md` §8 (more current than the older live-state material):

1. **`warning-readability-c01`** — packet ready, **no owner**. Smallest complete open lane; the
   natural next dispatch.
2. **Public published-view term merging** — `/public/schedules` renders every cell 3×
   (2,760 = 920 × 3 terms). **Owned by the other planner**; do not take it without a handover.
3. **False/incorrect warning categories** — `ZONE_IMBALANCE_WARNING` fires because 0 of 103 rooms
   have a zone; `FACULTY_FLOOR_TRANSITION`'s message is broken; warning-count semantics
   (335 API rows / 116 unique / 113 shown).
4. **`test:ux-guardrails` is vacuous** — names two files deleted at `4794bd9e`; never cite it.
5. **SMART/AIMS companion handoffs**; **actor-school residual authority lane**
   (`atlas-server/**`, Lane B's or a re-assignment).

Before starting any of these: re-read the newest dated handoff, and treat the term-cache apply and
the readiness/generation chain as **closed** — a fresh preview is expected to report
`ALREADY_CURRENT` with no write.

## Pointers

- Packets: `docs/prompts/*.md` (latest: `actor-school-mutations-c01-release-2026-09-21.md`;
  `dup-read-callers-c01r-2026-09-21.md` §3.1; `current-source-live-deploy-c02-2026-09-20.md` is
  the reusable deploy boundary).
- Evidence: `docs/reviews/<stream>/`; cost: `docs/reviews/workflow-cost-tracking.md`.
- Continuity: `docs/plans/live-state.md` (this file is session continuity).
- Rules earned on 2026-09-21, now in the directive: §10.12 clone-not-worktree, §11 batched reviewer
  dispatches, §16 fewer-longer-turns; mechanics in the reference docs listed in the read order.
