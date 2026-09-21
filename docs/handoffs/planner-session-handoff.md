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
accepted is undeployed. The program objective is unfinished: a generated, published, zero-HARD
timetable and companion SSO still lie ahead (see Next action).

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
- **Two recorded muse failure modes — both wording, not code:** (i) it **overstated its own
  evidence** (reported a failing-first tally of 8/2/6 where independent QA measured 8/3/5, naming a
  control that was not discriminating); (ii) it **claimed a method that had not executed** (a
  `SET LOCAL TIME ZONE 'UTC'` "pin" issued outside a transaction is a no-op, and it published the
  unpinned hash as pinned). Adversarially check its counts and its method claims.
- **Burn:** `opencode stats --days N --project ""` isolates this repo. The provider-console
  allowance percentage is **not** machine-readable from this lane and this lane must never log
  into the operator's provider account. Figures, the model split and per-turn readings live in
  `docs/reviews/workflow-cost-tracking.md`.
- **Efficiency here means finishing faster**, not spending less: the levers are fewer planner
  turns and **≤ 2 reviewer dispatches per release** (`AGENTS.md` §11, §16).

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

**Drive to the core deliverable: a generated, published, zero-HARD timetable for the demo year.**
The chain is `term-cache catch-up apply → canonical readiness diagnostic → fingerprinted
generation preview → generate → publication preview → publish`. Begin by authoring the
fingerprinted term-cache apply packet (capture complete at `9c19b772`; bind its fingerprint
`d4cd7cc4…` and `confirmationText SAVE_TERM_AUTHORITY_1_9`), then one batched independent
pre-action review, then execute — all under the standing authorization, with the live-data write
stated plainly as it runs.

In parallel, the **actor-school residual authority lane** is the only other open source gap:
`GET /rollover-recovery/preview` (`atlas-server/src/routes/runtime.router.ts:244`) still defaults
to school 1; `parseStrictTermAuthoritySchoolId` (`:424`) lacks the non-string guard; and the
harness does not cover body-vs-query precedence or hex/exponent/padded strings. It is
`atlas-server/**` → Lane B's ownership, or an explicit re-assignment.

## Pointers

- Packets: `docs/prompts/*.md` (latest: `actor-school-mutations-c01-release-2026-09-21.md`;
  `dup-read-callers-c01r-2026-09-21.md` §3.1; `current-source-live-deploy-c02-2026-09-20.md` is
  the reusable deploy boundary).
- Evidence: `docs/reviews/<stream>/`; cost: `docs/reviews/workflow-cost-tracking.md`.
- Continuity: `docs/plans/live-state.md` (this file is session continuity).
- Rules earned on 2026-09-21, now in the directive: §10.12 clone-not-worktree, §11 batched reviewer
  dispatches, §16 fewer-longer-turns; mechanics in the reference docs listed in the read order.
