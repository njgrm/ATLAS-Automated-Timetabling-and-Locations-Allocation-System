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
- **QA/reviewer agent — operator instruction, 2026-09-21: `atlas-qa` (DeepSeek **v4.1** flash)**
  while the v4.1 promo holds, because v4.1 is currently cheaper than v4. Revert to
  `atlas-qa-dsflashv4` when the promo ends. This supersedes the 2026-09-20 routing table, which
  named `atlas-qa-dsflashv4` — **check current pricing before concluding a routing error**: an
  earlier note in this session wrongly recorded `atlas-qa` dispatches as a "3x miss", and that
  conclusion was itself the error.
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

## Companion SSO — live click-through result (2026-09-21, operator-authorized, one login)

**ATLAS → EnrollPro is fully wired and executes end-to-end, but ATLAS itself denies the identity
assertion.** Browser evidence, all four hops: `dev-jegs /api/auth/companion-sso/atlas/reverse/start`
→ **303**; `njgrm /auth/enrollpro/authorize?…&state=<signed>` → **200** (ATLAS minted a code);
`dev-jegs …/atlas/reverse/callback?code=…&state=…` → **303**;
`dev-jegs /personnel/login?ssoError=COMPANION_REVERSE_SSO_ACCESS_DENIED&source=ATLAS`.

**The 403 is ATLAS's, not EnrollPro's.** EnrollPro throws `COMPANION_REVERSE_SSO_ACCESS_DENIED` only
when its server-to-server exchange call receives **HTTP 403**
(`companion-sso-reverse.service.ts:383`). ATLAS's `/sso/exchange` deliberately maps producer-side
conformance failures to 403 — `COMPANION_SSO_ROLE_DENIED`, `COMPANION_SSO_ROLE_UNMAPPABLE`,
`COMPANION_SSO_IDENTITY_NAME_UNAVAILABLE`, `COMPANION_SSO_COMPLETER_BLOCKED`
(`companion-sso.service.ts:123-126`).

**Narrowed to the name assertion.** The authenticated actor is `userId 46, role "officer"` — and
`mapLocalRoleToEnrollProRoles('officer')` returns `['SYSTEM_ADMIN']`, so the role branch passes.
`resolveReverseSsoNameParts` (`companion-sso-identity.ts:73`) requires **either** a faculty mirror
with non-empty first+last, **or** an `accountName` of **at least two whitespace-separated tokens**;
otherwise it returns null and the exchange 403s. The QA/officer account has no such name.
**This is fail-closed by design ("never fabricate a name") — it is an account-data gap, not a code
defect.** Fix: give the demo account a persisted first+last name, or use a named staff account.
EnrollPro collapses ATLAS's four distinct 403 reasons into one opaque code, so the cause is only
findable from the ATLAS source — worth a line in the companion handoff.

**EnrollPro → ATLAS remains UNTESTED**: it needs an EnrollPro session and the credentials file
(`%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`) has **no EnrollPro section** —
`EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE)`. Operator authorization does not supply values.

**Disclosure:** one authorized ATLAS login (officer, `userId 46`, identifier `1234501`); the session
was cleared and `GET /api/v1/auth/me` → `401 NO_TOKEN` with empty `sessionStorage`; the browser
context was closed. The exact `audit_logs` row id was **not** read (no DB path in this session).

**EnrollPro entry point:** use `https://dev-jegs.buru-degree.ts.net/personnel/login` (already the
recorded browser entry in `companion-sso-live-prep-c02-evidence.md`). **Do not** change
`VITE_ENROLLPRO_URL` to that path — it must stay the bare origin, because the client appends
`/api/auth/companion-sso/atlas/reverse/start`, `/dashboard` and `/personnel/login` to it
(`companion-config.ts`). The bare root 404s on the companion side; that is EnrollPro's to fix.

## Owned program I had lost track of — `UX-REHAUL-C01` (read this before planning UI work)

**The Timetable relaxed-view rehaul is a real, planned, unstarted program.** Its spec is
`docs/handoffs/ux-rehaul-handoff.md` (2026-09-18, 241 lines) plus the audit
`docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md`. It was **not** linked from this
handoff, so a session resumed from here would not know it exists — that is why it stalled. Fix the
link, not just the stream.

**Status:** `UX-P01` (the data-layer prerequisite: TanStack Query, parallel fetches, prefetch,
`keepPreviousData`) and `UX-R06` (micro-copy) are **integrated**. The rehaul proper — `UX-R00`
(register + SMART baseline), `UX-R01` (PageHeader + breadcrumbs + tokens), `UX-R01a` (shared visual
language), `UX-R02` (Simple strip-down), `UX-R03` (nested layout route), `UX-R04` (move
admin/diagnostics off the operator surface), `UX-R05` (Advanced demotion to "Expert") — is
**unstarted**.

**Operator directives already recorded in that handoff (authoritative):** desktop-first; mobile
de-prioritised; **Advanced view is not rehauled — demote it, don't fix it**; build on **Simple**;
**navigation must not get slower**; ATLAS must read as one system with SMART/EnrollPro. Boundaries:
client source only, no-scroll architecture, shadcn/Radix only, the 1000-line cap (three hooks
already exceed it and need extraction as they are touched), companion repos READ_ONLY.

**Still-open decisions from that handoff, re-checked 2026-09-21:** D-1 (adopt/refresh
`SMART-UX-AUDIT-C01` as the UX authority) — **still open**; D-3 (authorise `UX-P01`) — **resolved,
it is integrated**; D-4 (deploy `74c1f12a`) — **superseded**, many releases since; D-6 (is run #316
showing warnings) — **answered: 94 warnings, TERM-2 scoped, zero HARD**; D-2 (cycle activation) and
D-5 (second login for the remaining inventory rows) — **still open**.

## Next action

**The release queue is empty and `ecff1d7e` is accepted 6/6 — pick the next real lane.** Ranked,
from `docs/handoffs/planner-handoff-2026-09-20.md` §8 (reconcile it first — `AGENTS.md` §15):

0. **`UX-REHAUL-C01` — start it.** The operator asked for it directly on 2026-09-21 and it is the
   largest visible gap in the demo objective. Prerequisites are done; see the dedicated section
   above. Author the next stream's packet from `docs/handoffs/ux-rehaul-handoff.md` + the audit,
   then dispatch. `UX-R01` (PageHeader + breadcrumbs + tokens) is the visible foundation, `UX-R02`
   (Simple strip-down) and `UX-R03` (nested layout route, unblocked because `UX-P01` landed) are
   the visible wins; only `UX-R01a`/`UX-R00` genuinely need D-1.

**Verified fixed — do not spend a lane on it:** the public published-view ×3 term duplication. A
live read-only probe on 2026-09-21 returns **920 entries for exactly one term** (never 2,760), and
the route rejects an ambiguous active year with `409 ACTIVE_SCHOOL_YEAR_AMBIGUOUS`
(`docs/handoffs/lane-a-to-planner-b-rollover-2026-09-21.md` §4). Minor successor: an *absent* term
selector defaults to term 1 while a *malformed* one is a typed 400.

1. **False/incorrect warning categories** — `ZONE_IMBALANCE_WARNING` still fires in stored runs
   (the *surface* now suppresses it, so this is the producer/data side); warning-count semantics.
2. **`test:ux-guardrails` is vacuous** — names two files deleted at `4794bd9e`; never cite it.
3. **SMART/AIMS companion handoffs.**
4. **Small recorded successors:** the `FACULTY_FLOOR_TRANSITION` stored-message phrasing (a
   regeneration/data concern, not a formatter job) and the dead `parseSchoolId` in
   `runtime.router.ts`.
5. **In flight, not mine:** Planner B's `ROLLOVER-YEAR-IDENTITY-C01` — its crux decision is answered
   in `docs/handoffs/lane-a-to-planner-b-rollover-2026-09-21.md`; it is server-only and will need a
   release (Lane A's boundary) once accepted.

Do **not** re-open the term-cache apply or the readiness/generation chain — both are closed, with
dated proof in the live-state Lane A section. And re-read the newest dated handoff before acting on
any blocker line: that mistake has already cost this session one full cycle.

## Pointers

- Packets: `docs/prompts/*.md` (latest: `actor-school-mutations-c01-release-2026-09-21.md`;
  `dup-read-callers-c01r-2026-09-21.md` §3.1; `current-source-live-deploy-c02-2026-09-20.md` is
  the reusable deploy boundary).
- Evidence: `docs/reviews/<stream>/`; cost: `docs/reviews/workflow-cost-tracking.md`.
- Continuity: `docs/plans/live-state.md` (this file is session continuity).
- Rules earned on 2026-09-21, now in the directive: §10.12 clone-not-worktree, §11 batched reviewer
  dispatches, §16 fewer-longer-turns; mechanics in the reference docs listed in the read order.
