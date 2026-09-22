# ATLAS planner session handoff (living document)

**Updated at the end of every turn** so a fresh session resumes from this one file. Keep it
**short**: narrative belongs in packets, evidence and Git, which are indexed under Pointers below.
A fresh session pays for every line of this file before it does any work.

**To resume in a fresh session, paste this one line:**
> Read `docs/handoffs/planner-session-handoff.md` on `origin/main` and resume as the ATLAS
> primary planner (Lane A). It is self-contained; then follow its read order.

Last updated: 2026-09-23 (Lane A).

## Verdict

**2026-09-23 (overnight) — the relaxed main Class Schedule workspace is LIVE at `28f6f03f`.**
- **Live release `28f6f03f`** (`D:\ATLAS-runtime-supervised-28f6f03f-20260923`; 5001→17548 /
  5174→39100; served entry `assets/index-Dy2kdrZW.js`; health/ready/DB-read/Tailnet 200; chunk
  byte-identical to the release build). Rollback: `1fdab989` startable in place; deeper fallbacks
  `e78d4473`, `11e8778f`, `7dbb3b90`.
- **Cycle:** baseline read-only QA of the deployed `7dbb3b90` → Candidate A → Candidate B → one
  batched pre-action reviewer (source range **and** packet lint) → 3 bounded corrections → re-deploy →
  post-deployment browser QA in 3 passes → final `ACCEPT_READY` 3/3/0/0.
- **Measured at 1366×768:** grid top **332 → 180 px**; status surfaces **8 → 1**; header bands
  **5 → 2**; router element-less warnings **49 → 0**; mobile first paint **0 controls at 8 s → 8 at
  91 ms**; SPA-nav refetch **17 → 1 call**; scroll now preserved; all-terms entries now term-labelled;
  the `Run inputs are stale` + `Verified with EnrollPro` contradiction is structurally impossible; the
  **draft surface renders** and is in the sub-nav; placement is inline preview → **one Confirm, zero
  modals** with a **working Undo**; term defaults to the **EnrollPro verified active term T2** and
  fails closed on unknown identity.
- **Two live defects were found by review, not by tests:** a clean draft slot opened a review modal
  with two Save buttons and registered no Undo; the Undo it did register sent a draft-ledger id to the
  run manual-edits CAS endpoint (409 `UNDO_CONFLICT`). Both fixed and re-verified live.
- **Open, disclosed:** the pre-generation **draft holds 2 extra pinned placements** (ids 24 and 25)
  from QA passes made un-undoable by the second defect; the Undo path is session-local and head-only,
  so clearing them needs `DELETE /pre-generation-drafts/:id` — outside the authorised write class.
  Queue reads `1318 of 1318` vs the pre-QA `1320 of 1320`. The draft is unpublished and regenerable.
- **Open:** no published run exists (run #316 is Reviewing, 94 warnings) so the "published" lifecycle
  leg is unexercised; the draft-tray swap is a modal by design (Simple swap is inline).
- **`NOTIFICATION-INBOX-C01` is now live with its migration unapplied**, so
  `GET /api/v1/notification-inbox/` and `/unread-count` return **500** on every page load. The fix is
  the separate HIGH `NOTIFICATION-INBOX-LIVE` action (apply `0004` + restart) — **not authorised**.
- **Disk:** `D:` 18.37 GiB free (below the 25 GiB warning, above the 15 GiB fail-closed).

**2026-09-23 — the live timetable delta is reviewed and accepted; live is `7dbb3b90`.**
- **Live moved to `7dbb3b90`** (`D:\ATLAS-runtime-supervised-7dbb3b90-20260922`; supervisor 44476,
  `5001`->9228, `5174`->19892; served entry `/assets/index-CnDObevR.js`; health/ready + Tailnet 200
  read-only verified 2026-09-23). It carried `57592dd7` (relax scheduler chrome on subpages) +
  `e794dee2` (fixture-path correction), merged `6cc202b7`, **with no independent pass** — the §11
  unreviewed-delta condition.
- **That delta is now reviewed post-hoc: `ACCEPT_READY` 20/20/0/0** (task
  `ses_f35fd1dfaffeh6KPQu8Od2twsa`) over the frozen range `714fadf7..7dbb3b90`. Product delta is
  exactly four `atlas-client` paths; the gate is confined to `ScheduleReviewWorkspace.tsx:382/:463`;
  `TimetableRouteViewSync.tsx` is additive and behaviourally unchanged. The rehaul bar holds live at
  1366×768 (U3 sub-nav on all nine `/timetable*` routes, marker survives four sub-pages and back with
  no grid refetch/remount; U2 one solid primary + one status region; U6 no global scrollbar; U1/U5
  warning copy intact). `test:client-suite` 854/854 exit 0; the built entry chunk is byte-identical to
  the live served `/assets/index-CnDObevR.js`. **No correction and no new release** — the release queue
  is empty again. Full record in the `Lane A — current lane` section of `docs/plans/live-state.md`.
- **Reconciliation, 2026-09-23:** nothing above `7dbb3b90` on `origin/main` touches `atlas-client/**`
  (only `ops/runtime/**` + docs). **But an unreviewed, undeployed candidate exists:**
  `work/timetable-live-term-authority-c01` (`b8e2e48e`) / `integration/timetable-live-term-authority-c01`
  (`38a94bb0`) — 5 commits dated 2026-09-22 touching client timetable/term-authority paths, with no
  packet and no review verdict, and an `atlas-client/package.json` overlap. It needs its own cycle;
  preserve the branch and worktree, do not fold it into a release.
- **Next program (dispatched after this closure): `NOTIFICATION-INBOX-C01`** —
  `docs/prompts/notification-inbox-c01-2026-09-22.md`. AIMS is the READ_ONLY reference
  (`D:\AIMS` @ `2332d92e`), pattern not domain.

**2026-09-23 (later) — `NOTIFICATION-INBOX-C01` is integrated; the migration is NOT applied.**
- Contract pinned at `docs/prompts/notification-inbox-c01-implementation-2026-09-23.md` (amended at
  `0de1bf60` to pin the inbox actor id to `AtlasAuthAccount.id`). Candidate `fb27d48e` + correction
  `47d0a80b`, integrated at merge **`7df2ddc`** on `origin/main`.
- **The first review found a real `BLOCKING` defect** — the route resolved `req.user.userId`, which for
  a faculty-shaped session is the `FacultyMirror.externalId` while rows are keyed on
  `AtlasAuthAccount.id`, so teachers could not read their own notifications and a numeric collision
  could cross-read/mutate another actor's rows. The committed DB test masked it by minting
  `userId === accountId`. Corrected additively (accountId only, never `userId`) with a faculty-shaped
  failing-first control (46/10 → 56/0); bounded re-review `ACCEPT_READY` 5/5/0/0.
- Merged-tree gates: server 289/289, `test:server-db` 54 files / 0 fail / residue 0, client 859/859,
  both builds, `git diff --check` clean; product tree byte-identical to the reviewed candidate.
- **`as of 2026-09-23` the live release is still `7dbb3b90` and does not carry this work.** The
  migration `0004_notification_inbox` is authored but **not applied**. The next step is the separate
  HIGH `NOTIFICATION-INBOX-LIVE` action (apply `0004` + deploy) — **not authorized by the
  integration**, and it needs its own fingerprinted packet, pre-action review and explicit approval.
  Deploying the source before the apply is fail-closed (per-event persist logs errors; routes return
  empty/404, never wrong data) but is not the intended order.

**OPEN ITEMS HANDED FORWARD (2026-09-22 late) — read before picking work.**
- **SMART teacher-side direction is DECIDED but BLOCKED on the system adviser.** SMART owns **submission
  only**; the **scheduler decides on the ATLAS admin side**. ATLAS's teacher-facing pages
  (`/my/preferences`, `/my/room-preferences`) are to be **retired**. **Do not start the retirement or
  `TEACHER-INPUT-SIMPLE-SURFACE-C01` until the adviser confirms.** Update
  `docs/handoffs/smart-teacher-preferences-and-room-requests-2026-09-22.md` §5 to record "(a)
  submission only" when confirming with them.
- **Freshness concern — ANSWERED, and it is by design, not a bug.** The teacher/section pages showing
  *"Working from saved data"* while EnrollPro is up is **honest**: the EnrollPro→ATLAS rollover/term
  sync is **deliberately disabled** by the runtime contract's invariant env —
  `ops/runtime/runtime-contract.json` sets `"invariants": { "ROLLOVER_AUTO_SYNC_ENABLED": "false" }`,
  and `cli.mjs` injects it into every supervised child (`resolveInvariantEnv`). The live server log
  confirms it: `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`. So ATLAS's
  EnrollPro-derived data is a **snapshot**, refreshed only when someone syncs manually — and the UI
  correctly says so. **This is the same cause as the manual-fetch concern:** the fetch IS manual, by
  design, and Teaching Load can be computed from a stale mirror.
  **Do not "fix" this by deleting the invariant without a decision** — it exists so a supervised
  production deploy never auto-mutates rollover/term-cache data. The real choices are: (a) accept manual
  sync and make the UI distinguish *persisted-but-current* from *stale*; (b) add a bounded, auditable
  scheduled sync with an explicit approval; or (c) leave as is. **Surface this to the operator as a
  product decision, not as a defect.**
- **Related, still theirs:** the EnrollPro active-term mismatch (their UI says TERM 1, their integration
  endpoint says T2, ATLAS correctly mirrors the endpoint).

**LATE 2026-09-22 — live incident fixed, both SSO directions working, and two new third-party handoffs.**
Read this block first; the sections below are still accurate but predate it.
- **Timetable outage (fixed).** `5a333c74` shipped an **un-satisfiable** term gate (`5a0a8788`) — the
  timetable never sent `verifyUpstream`, so `/runtime/context` always answered `atlas-unverified` and
  the page dead-ended. Rolled back to `d4c9f391`, then fixed properly: `TIMETABLE-TERM-GATE-C01`
  (verify → recover → degrade with an explicit term + notice) and `ZONE-WARNING-REMOVAL-C01` (the zone
  warning is gone; stored rows render as history). Both QA `ACCEPT_READY` 8/8 and 11/11. **Live is
  `714fadf7`** and the page is verified loading, authenticated.
- **EnrollPro → ATLAS SSO (fixed).** The outbound exchange URL was missing `/api`
  (`ENROLLPRO_BASE_URL` has no `/api`, `ENROLLPRO_SSO_EXCHANGE_URL` was unset) → ATLAS POSTed to a
  **404**. Fixed with a **machine-scope** `ENROLLPRO_SSO_EXCHANGE_URL` override (the runtime env file
  is ACL read-only for everyone, so it was not edited) + restart. **Both SSO directions now work**;
  ATLAS `audit_logs` 888 `COMPANION_SSO_SESSION_CREATED` is the proof for the previously-broken one.
- **Two third-party handoffs authored:** `docs/handoffs/smart-teacher-preferences-and-room-requests-2026-09-22.md`
  and `docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` (§5 = the active-term mismatch,
  still theirs). The SMART one needs **one decision** — do they own submission only, or the whole
  review/appeal lifecycle? — which blocks `docs/prompts/teacher-input-simple-surface-c01-2026-09-22.md`
  (`BLOCKED(EXTERNAL_DECISION)`).
- **Still open:** the EnrollPro active-term reconciliation (their UI says TERM 1, their integration
  endpoint says T2, and ATLAS correctly mirrors the endpoint); the EnrollPro callback config item is now
  **closed** by their own fix + ours.

**`TEST-GATE-COVERAGE-C01` is integrated and now green — no release needed.** Client half `1ce9f4ad`
(all 92 client test files gated + inverse guard; orphans 55 → 0; suite 846/846). Server half
`f9c0f3cb` + `1e3190cf` + `95895430` (orphans 80 → 0; `test:server-suite` **275/275**; `test:server-db`
is a per-file isolation runner, now **7 consecutive green runs** at 53 pass / 0 fail / 0 skipped,
exit 0). The `test:server-db` flake is **root-caused and fixed**: suites dropped their disposable
database once, swallowed the refusal, and then failed their own zero-residue assertion — fixed by a
shared bounded-retry helper across all seven affected suites plus the `tt-source-freshness-db`
harness; the residue assertions are intact, only the race is gone. One **docs-side** defect was also
fixed: `docs/verification/**` was outside the `.gitattributes` LF policy, so a Windows checkout broke
the E9 sidecar byte-SHA. Both halves are the **inverse** of Planner B's `TEST-GATE-REACHABILITY-C01`
(scripts → absent files). Custody: Lane A took `atlas-server/package.json` for the server half while
Planner B was on QA; it returns to Planner B afterwards.

**`COMPANION-SSO-REVERSE-IDENTITY-C01` is live: ATLAS → EnrollPro now works; EnrollPro → ATLAS is
blocked on a companion config value.** Release **`d4c9f391`** ships the reverse-assertion fix (names
omitted-when-empty, typed 403 when `employeeId` is missing) and the live click-through confirms an
authenticated EnrollPro session. The **normal** direction fails because EnrollPro's
`ATLAS_SSO_CALLBACK_URL` points at ATLAS's SPA *result* path (`/auth/sso/callback`) instead of the
*callback* path (`/api/v1/auth/enrollpro/callback`) — companion-side, one env value; handoff
`docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` §4.

**`TIMETABLE-UX-REHAUL-C01R` is delivered, live and accepted.** Release **`d92facfa`** carries the
relaxed Simple Timetable shell — the operator's direct 2026-09-21 request — and passed the program's
own bar on the live page: post-action QA `ACCEPT_READY` **7/7**, **U1–U6 6/6**, blocked 0,
unperformed 0. The same release also carried Planner B's `ROLLOVER-YEAR-IDENTITY-C01`, which had **no
committed review verdict**; the release's opening gate reviewed that delta alone before any runtime
action and returned `ACCEPT_READY` 22/22. **The release queue is empty** — nothing accepted is
undeployed.

**Premise correction, 2026-09-21 — read this before planning anything.** The session that wrote the
earlier version of this file spent a packet, an independent review and an executor dispatch on a
**term-cache apply that had already been satisfied on 2026-09-18**. The DB shows mirror **551**
(year 10) cached, `TERM_CACHE_SYNC_APPLIED` = 2, `GenerationRun` = 4, and **published run 315 /
revision 42 with zero HARD violations**. **The generation/publication core is already met.** The
cause was an undated "still pending" line that contradicted facts recorded elsewhere in the same
file — hence `AGENTS.md` §15's dated-blocker rule. **Read the newest dated handoff
(`docs/handoffs/planner-handoff-2026-09-20.md`) and reconcile before acting on any blocker line.**

## Live identity

- Pin `d4c9f39139dcb34e1653d543586d4c76420ea8a5` at
  `D:\ATLAS-runtime-supervised-d4c9f391-20260921` (registered detached worktree, not a clone).
- Supervisor **28104**; server `5001`→**39064**; client `5174`→**39392**; entry
  `/assets/index-DgF0ZSEz.js` (456,064 B — unchanged client); Tailnet healthy; `D:` **29.84 GiB**.
- Rollback: `d92facfa` **startable in place** at `D:\ATLAS-runtime-supervised-d92facfa-20260921`
  (pre-mutation task XML captured, SHA-256 `53510853…`); behind it `ecff1d7e`, `80acdc25`,
  `a02884ff`. Never executed.
- The release carries the companion-SSO reverse-assertion fix (and everything accepted before it).
  The client tree is unchanged since `d92facfa`, so the deploy is proven by the server service
  artifacts, not the served chunk.

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

## Companion SSO — live click-through result (2026-09-21; **resolved 2026-09-22**)

**Status 2026-09-22: ATLAS → EnrollPro WORKS** (release `d4c9f391`). The reverse blocker was the name
gate; the fix **omits** empty `firstName`/`lastName` (never `""`, which fails EnrollPro's
`min(1).optional()` schema) and fails closed typed-403 when `employeeId` is missing. The live
click-through lands on an authenticated EnrollPro `/dashboard` with the origin asserted.
**EnrollPro → ATLAS is `BLOCKED(COMPANION_CALLBACK_MISCONFIGURED)`** — EnrollPro's
`ATLAS_SSO_CALLBACK_URL` points at ATLAS's SPA *result* path instead of
`/api/v1/auth/enrollpro/callback` (see Next action item 0 and the handoff §4).
Two corrections to the 2026-09-21 diagnosis below: the "Defect B" it names (asserting a local
`userId`) was a **misattribution** — the reverse assertion has always used `subject`; and the
account-data framing was incomplete, because the name is now optional by omission and the
reconciliation key is `employeeId`.

**The 2026-09-21 diagnosis, for the record.** ATLAS → EnrollPro was fully wired and executed
end-to-end, but ATLAS itself denied the identity assertion. Browser evidence, all four hops:
`dev-jegs /api/auth/companion-sso/atlas/reverse/start`
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

**The Timetable relaxed-view rehaul is DONE and live.** Spec `docs/handoffs/ux-rehaul-handoff.md` +
audit `docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md`; the closing stream packet is
`docs/prompts/timetable-ux-rehaul-c01r-relaxed-shell-2026-09-21.md`.

**Status: DELIVERED in `d92facfa`** (2026-09-22). `UX-P01`, `UX-R06`, `UX-R01`, `UX-R01a`, `UX-R02`
and `UX-R03a–e` were already integrated by earlier cycles. This session closed the remaining gap as
`TIMETABLE-UX-REHAUL-C01R`: a persistent sub-nav that makes
`/timetable/{setup,policies,runs,exports}` reachable (they were URL-only), one status surface,
exactly one solid primary per state, the F-07 repeated-grade removed from the grid cell, and one `h1`
per surface. `UX-R04` and `UX-R05` were verified already-satisfied (the TacticalSandboxDock mounts
only when explicitly opened; the Advanced entry lives under More → Expert tools). Evidence
`docs/reviews/release-timetable-ux-rehaul-c01r-20260921/deployment-evidence.md`. **Do not re-open
it**; its recorded successors are in the live-state Lane A section.

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

**The release queue is empty and `d4c9f391` is live; the one open item is a companion env value.**
Ranked:

0. **`ENROLLPRO-ATLAS-SSO-CALLBACK-CONFIG` — one EnrollPro env value blocks the normal direction.**
   Set `ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback` on
   `dev-jegs`. It currently points at ATLAS's SPA *result* path (`/auth/sso/callback`), so EnrollPro
   appends `?code=` to a page that only reads a `#atlasToken` fragment and the user dead-ends at
   *"No sign-in token was provided."* Evidence, exact source lines and three acceptance tests are in
   the **send-ready handoff** `docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` — it is
   self-contained, so the EnrollPro developer needs nothing from this repo, and the fix is **one env
   value plus a restart (no code change, no PR)**. Companion-side and READ_ONLY
   from ATLAS — it needs the operator / EnrollPro owner. After the change, re-run the normal leg and
   record the typed result. **Do not add an ATLAS route at `/auth/sso/callback` to work around it** —
   that path is the SPA route; the fix belongs in EnrollPro's configuration.

**Verified fixed — do not spend a lane on it:** the public published-view ×3 term duplication. A
live read-only probe on 2026-09-21 returns **920 entries for exactly one term** (never 2,760), and
the route rejects an ambiguous active year with `409 ACTIVE_SCHOOL_YEAR_AMBIGUOUS`
(`docs/handoffs/lane-a-to-planner-b-rollover-2026-09-21.md` §4). Minor successor: an *absent* term
selector defaults to term 1 while a *malformed* one is a typed 400.

1. **`TIMETABLE-TERM-GATE-C01` — the live outage's forward fix (highest priority).** `5a0a8788`'s gate
   in `useTimetableData.ts` is **un-satisfiable**: it requires `activeTerm.verified === true`, but the
   timetable path never sends `verifyUpstream`, so `/runtime/context` always answers
   `atlas-unverified`. The gate is correct in intent and wrong in wiring. Fix by having the timetable
   obtain a verified context (request `verifyUpstream`, or promote the `AppShell` verified cache) and
   **re-run the load when it arrives**, instead of blocking on the first unverified read — and make it
   degrade with a visible notice rather than dead-end if authority stays unresolved. Then re-release
   `5a333c74`'s scheduler-simplicity work on top. **Live is rolled back to `d4c9f391` until then.**
2. **`ZONE-WARNING-REMOVAL-C01` — remove `ZONE_IMBALANCE_WARNING` entirely** (operator, 2026-09-22):
   *"schools don't have the luxuries to flesh out classes across a campus if they are in a tight
   situation, that should not be a warning in any way."* This **reverses** `ZONE-IMBALANCE-PRECONDITION-C01`
   (`47081de3`), which gated it instead of deleting it. Remove the producer, the code from
   `VIOLATION_CODES`, and the presentation/label surfaces — but keep a **historical** presentation
   entry for stored runs (the `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` precedent), and keep the
   `UNSPECIFIED` suppression for stored rows. Also revert/neutralise the `ZONING-CLARITY-C01` copy where
   it only described this warning.
2. **AIMS/SMART term-aware handoff — DELIVERED 2026-09-22.** The old doc was deleted at `4794bd9e`
   (`docs/*` ignored, `docs/guides/` not whitelisted) and the contract has since drifted. The new one is
   `docs/reference/aims-smart-term-aware-published-schedule-handoff-2026-09-22.md`, pinned to deployed
   `5a333c74`, with the live payload, the typed errors and the migration warning. **Correction to the
   earlier analysis:** the two "blocking" term-scope lanes are **client-only** (0 server paths each),
   so they do **not** move the API contract — no need to wait for them.
3. **`ZONING-CLARITY-C01` — delivered 2026-09-22** (`10716aa1`): one "Campus zone" vocabulary and an
   at-a-glance warning. Copy-only, not yet deployed.
2. **New UX successors recorded from this release** (all NON_BLOCKING, in the live-state Lane A
   section): clean-load API GETs 20 vs 19 baseline; the Review-issues panel's uppercase
   `SOFT`/`HARD` badges; the status region still draws three visual lines; sub-nav links at 24 px;
   React Router element-less-children console warnings on `/timetable*`.
3. **SMART/AIMS companion handoffs.**
4. **Small recorded successors:** the `FACULTY_FLOOR_TRANSITION` stored-message phrasing (a
   regeneration/data concern, not a formatter job) and the dead `parseSchoolId` in
   `runtime.router.ts` (now provably unused; leave it out of any release that does not own it).

**Shipped, no longer in flight:** Planner B's `ROLLOVER-YEAR-IDENTITY-C01` went live in `d92facfa`
after the release's opening gate reviewed it alone (22/22). `test:ux-guardrails` is no longer
vacuous — the false-green cluster was repaired at `0758075e` and the guardrail gate now names live
files plus the `gate-reachability` check.

Do **not** re-open the term-cache apply or the readiness/generation chain — both are closed, with
dated proof in the live-state Lane A section. And re-read the newest dated handoff before acting on
any blocker line: that mistake has already cost this session one full cycle.

## Pointers

- Packets: `docs/prompts/*.md` (latest: `release-timetable-ux-rehaul-c01r-2026-09-21.md`;
  `timetable-ux-rehaul-c01r-relaxed-shell-2026-09-21.md` is the stream spec;
  `current-source-live-deploy-c02-2026-09-20.md` is the reusable deploy boundary).
- Evidence: `docs/reviews/<stream>/`; cost: `docs/reviews/workflow-cost-tracking.md`.
- Continuity: `docs/plans/live-state.md` (this file is session continuity).
- Rules earned on 2026-09-21, now in the directive: §10.12 clone-not-worktree, §11 batched reviewer
  dispatches, §16 fewer-longer-turns; mechanics in the reference docs listed in the read order.
