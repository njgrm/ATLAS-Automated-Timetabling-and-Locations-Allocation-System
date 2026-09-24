# ATLAS planner session handoff (living document)

**Updated at the end of every turn** so a fresh session resumes from this one file. Keep it
**short**: narrative belongs in packets, evidence and Git, which are indexed under Pointers below.
A fresh session pays for every line of this file before it does any work.

**To resume in a fresh session, paste this one line:**
> Read `docs/handoffs/planner-session-handoff.md` on `origin/main` and resume as the ATLAS
> primary planner (Lane A). It is self-contained; then follow its read order.

Last updated: 2026-09-25 (Lane A).

**Current (2026-09-25):** `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` C1–C6 source is on `main`
(`origin/main` = `178c2929`); **C7** (guarded migration apply + deployment + two-viewport browser
acceptance; deferred-browser-row acceptance owner **Lane B / Codex**) is the next action. See
"Lane A — TEACHER-CONCERN-AUTHORITY-PROGRAM cycles C1–C6 (closed 2026-09-25)" near the end of this file.
Everything below that is dated 2026-09-23 or earlier is historical; where it names an older live release
or an open queue, it is superseded by the dated sections.

## Verdict

**2026-09-23 — live release `0232bf9c`; truthfulness release `7ac28124` accepted 11/11; the relaxed timetable is shipped; the release-directory retention policy is landed; one operator decision is open.**

- **Custody: the simplified-timetable stream is handed to Planner B** —
  `docs/handoffs/simplified-timetable-handoff-to-lane-b-2026-09-23.md`. It lists the residuals that are
  already **closed** (over-cap components, `test:ux-guardrails`, the two previously-untested sources) and
  what is actually still open (`UX-R04`, `UX-R05`, the draft-tray swap decision, disposal of the stale
  `work/timetable-live-term-authority-c01` candidate). Lane A keeps deployment, the browser controller,
  and the continuity docs.

- **Superseded (2026-09-23):** `RUNTIME-DIR-RETENTION-C01` retired 14 release directories
  (`1fdab989`, `e78d4473`, `11e8778f`, `7dbb3b90`, `d4c9f391`, `d92facfa`, `ecff1d7e`, `a02884ff`,
  `5f5c6c4f`, `20f07f59`, `405e5b18`, `4ce73d157f9a`, `78be1b760e40`, `8eb0511baa53`). **Any earlier
  block below that calls one of them live, startable, available or retained is superseded.** The live
  release is `0232bf9c`; deeper rollback is a rebuild.
- **Live release `0232bf9c`** (`E:\ATLAS-runtime-supervised-0232bf9c-20260923`; listeners `5001`->56812 /
  `5174`->59604; health/ready + DB-backed read + Tailnet 200). `D:` free is now **37.83 GiB** (above the
  25 GiB warning line).
- (superseded) **Release SHA: `7ac28124`** (`E:\ATLAS-runtime-supervised-7ac28124-20260923`; supervisor-owned
  5001→37608 / 5174→9948; served entry `assets/index-BbufnI_M.js`, SHA-256 `49838BFE…5CB6` byte-identical
  to the build; health/ready + DB-backed read + Tailnet 200; supervisor `state=running`). Carries, in order:
  `TIMETABLE-RELAXED-SUBPAGES-C01` → `TIMETABLE-RELAXED-MAIN-C01` (grid top 332→180 px, status surfaces
  8→1, router warnings 49→0, mobile paint 8 s→91 ms, SPA refetch 17→1, scroll preserved, inline placement
  with working Undo) → `TIMETABLE-HEADER-COLLAPSE-C01` (header 2 bands→**1 row**, grid top **139.6 px**,
  published surface out-ranks `Generate`) → `TIMETABLE-TRUTHFULNESS-C01` (D1–D4). **Release root is `E:`**
  (deliberate — `D:` was 16.83 GiB, 1.83 GiB above the §3 fail-closed line; `D:` finished unchanged at
  16.82 GiB). **Rollback (retention policy, 2026-09-23): `d9a6aa53` + `28f6f03f` startable in place, plus
  the two last-resort artifacts (`20260912` = `9d293879`, `fallback-d44-20260912` = `d44f29e0`). Deeper
  rollback is now a REBUILD.** `RUNTIME-DIR-RETENTION-C01` retired the deeper depth and the junction
  pass-through cluster; `D:` 20.37 → **37.83 GiB**. Live has moved twice today
  (`7ac28124` → `89012430` → **`0232bf9c`**), deployed by another lane without a register update.
- **`origin/main` = `1656da6d`** (docs-only above the deployed `7ac28124`).
- **`TIMETABLE-TRUTHFULNESS-C01` COMPLETE — deployed at `7ac28124`, accepted `ACCEPT_READY` 11/11/0/0.** The
  candidate `fb58a0d5` (+ bounded correction `adfbf9f9`) passed a single batched pre-action review that
  closed the source range **and** the packet lint in one dispatch (`PLANNER_DECISION_REQUIRED` 7/9 — **no
  product defect in D1/D2/D3**, independently reproduced failing-first 0/4→4/4 on real base bytes; both
  blockers were planner-owned and are now resolved: D4 states **when** the value was verified from the
  real `cachedAt`, and D2/D4 are re-targeted as labelled deployment rows in packet §7). Integrated at merge
  `7ac28124` and deployed via the reviewed `ops/runtime/deploy-runner.ps1` to
  `E:\ATLAS-runtime-supervised-7ac28124-20260923` — served entry `/assets/index-BbufnI_M.js`, SHA-256
  `49838BFE…5CB6`, byte-identical to the build; the incumbent chunk is now 404; Tailnet 200; supervisor
  `state=running`. **Rollback basis: `d9a6aa53` at `D:\ATLAS-runtime-supervised-d9a6aa53-20260923`,
  startable in place.** Deployment and acceptance stay separate outcomes — the cycle closes only when the
  fresh post-deployment QA returns `passed == total`, `blocked: 0`, `unperformed: 0`.
- **Correction to the previous executor tally (reviewer-verified):** `test:server-db` is **54/55 with one
  base-identical pre-existing red** (`enrollpro-rollover-automation.test.ts`, `expected 10, got 910101`,
  reproduced identically at base `5ff8d80f`), not the handoff's "55 files/0 fail". Not candidate-attributable.
- **DEPENDENCY HAZARD — CONFIRMED TAINT-FREE; cleanup still owed.** The candidate's
  `atlas-client/node_modules` and `atlas-server/node_modules` were junctions to
  `D:\ATLAS-runtime-supervised-e78d4473-20260923` (the planner failed to pre-provision; the executor's
  policy denies `npm ci`). The reviewer independently re-derived the lockfile + Prisma-schema SHA-256 as
  byte-identical, confirmed the junction is a **single hop**, and confirmed **no source byte resolves
  through it**, so no gate evidence is tainted. The release was built with its **own** dependency tree.
  Still owed: **remove both junctions before retiring the candidate worktree**, and **do not reclaim
  `e78d4473`** while they exist.
- **OPEN OPERATOR DECISION — the runtime-dir reclaim.** 35 `D:\ATLAS-runtime-supervised-*` dirs total
  **44.51 GiB**. Not reclaimable under current rules: **every** dir carries the runtime's untracked
  `ops/runtime/logs/` (so non-forced `git worktree remove` refuses and `--force`/raw recursive deletion
  is forbidden), **10 are junction-bearing**, **9 are named fallbacks** in live-state. Strict criteria
  yield exactly **one** dir: `6cc202b7-20260922` (**0.97 GiB**) — which also has **identity drift**
  (name says `6cc202b7`, HEAD is `7dbb3b90`). Needs an explicit operator exception (no-`--force` and/or
  a sanctioned logs-clearing step) plus a junction target-vs-contained analysis, run as a bounded
  reclaim cycle (frozen manifest → pre-action audit → guarded removal → post-action audit).
  **2026-09-23: still 35 dirs on `D:` and `D:` is unchanged at 16.82 GiB, because this cycle built its
  release on `E:` for exactly this reason (see the Live release block). No dir was reclaimed.**
- **Closed this cycle:** `NOTIFICATION-INBOX-LIVE` (migration `0004` applied via the guarded wrapper
  after a fresh verified backup; live inbox routes now 200, were 500 on every page load);
  `TIMETABLE-PUBLICATION-C01` (run #317 / revision 43 / audit 918 published; completion audit
  `CORRECTION_REQUIRED` 7/6/0/0 with the publication action clearing areas 1–6 and only the continuity
  record failing — **now corrected**: year 10 already had revisions 41 (run 314) and 42 (run 315), and
  run 317 **superseded the live run 315**; `INITIAL_PUBLICATION` is run 317's base-revision label, not a
  year-level first).
- **Residual list (recorded, non-blocking):** `TacticalSandboxDock` jargon (Advanced-only, audit-deferred
  UX-R04); the draft-tray swap is a modal by design (Simple swap is inline); the dashboard raw-soft
  wording (being closed by `fb58a0d5`); `publishedSoftViolationCount` disagreement (closed by D3);
  two over-cap components (`ManualEditPanel.tsx` 1012, `FacultyRoomPreferences.tsx` 1007); the 289 soft
  advisory violations themselves are **scheduling quality, not UI**, and need their own cycle.
- **Disk:** `D:` **16.83 GiB** (above the 15 GiB fail-closed, below the 25 GiB warning). Six
  `D:\ATLAS-runtime-supervised-*` release trees plus `e78d4473` junction dependency.
- **Custody:** Lane A owns `atlas-client/**`, `docs/plans/live-state.md`, `AGENTS.md`, the register,
  `CHANGELOG.md`, deployment, and the single browser controller. GPT's timetable streams are integrated;
  `work/timetable-live-term-authority-c01` (`b8e2e48e`) remains an **unreviewed, undeployed** candidate
  (preserved, not folded in). SMART teacher-side retirement is adviser-blocked — do not start it.
- **Credential hygiene:** the QA/admin credential has been leaking into plaintext temp files across
  sessions (8 found, all deleted, scan now 0). **Rotate it and strip the backtick wrapping from
  `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`.** Browser logins must read the file
  inside a process and never type the password into a prompt or browser field.

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
*Historical block — **superseded**: the live release is `0232bf9c`, and `7dbb3b90`'s directory was retired
under `RUNTIME-DIR-RETENTION-C01`. Any earlier block below that calls a retired release live, startable or
retained is superseded by the same cycle.*
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
  **EXECUTED 2026-09-23:** `E:/ATLAS-worktrees/c01r-release-20260921` — a stray *clone*
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

- **Resolved 2026-09-23:** the stray clone `E:/ATLAS-worktrees/c01r-release-20260921` was removed by
  `RUNTIME-DIR-RECLAIM-C01` under the operator exception.
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

---

## Lane A — TEACHER-CONCERN-AUTHORITY-PROGRAM cycles C1–C6 (closed 2026-09-25)

Moved here from `docs/plans/live-state.md` Lane A when that section was cut to ≤40 lines (AGENTS §15).
`origin/main` at closure: `178c2929`. Retired non-forced at closure (junctions unlinked first, branches
retained): `integration-c5-teacher-concern`, `teacher-availability-s1`, `publish-identity-s4-server`,
`integration-c6-teacher-concern`, `scheduler-concern-s2`, `publish-drift-s4-client`,
`g9g10-grid-delta-probe`. Preserved: `timetable-scheduler-simplicity-c01` (dirty). The undated
2026-09-20 "what actually remains" queue was deleted (Lane C closed every item with evidence) and is not
reproduced below.

**`TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` — C6 (S2/S4-client) integrated; D1–D11 locked; cycle queue current (2026-09-25).**
Plan `docs/plans/teacher-concern-authority-plan-2026-09-24.md` is the continuity index (its **Cycle queue**
table + streams S0–S8). Objective: the **scheduler** becomes the single place that accommodates a teacher's
preferences/availability **in draft and post-publish**; those inputs must genuinely affect generation rows;
**SMART** gains a teacher-scoped **draft**-schedule read; the ATLAS teacher portal is removed. Locked:
D1 both (UNAVAILABLE hard + PREFERRED soft), D2 new term-scoped/reviewed/versioned availability authority
(do **not** flip `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES`), D3 teacher-scoped authenticated **opt-in** draft
exposure, D4 effective-dated **identity deltas** on revisions + bounded audited withdraw, D5 freshness-only +
explicit regenerate, D6 portal removal (S3 is its prerequisite), **D7 SMART draft auth = the companion
integration key** (faculty parameter + per-run share toggle; no scoped token minted), **D8 break-window
`scope` set + `source.shiftWindows[]`** (additive; row count unchanged), **D9 teacher-lunch policy** (SOFT
default, HARD switchable; renders in the Teacher Program), **D10 persistent per-teacher preferred grade
levels** (ATLAS-owned `(schoolId, facultyId)`; **no rollover reset**; advisory always overrides),
**D11 shift-coherence guard** (SOFT default, HARD switchable, overridable).
**Done:** C1 S0 freeze (`530e3b19`); **C2 `S3` SMART draft read integrated at `e7ecd886`** — fresh QA
`ACCEPT_READY` 8/8/0/0, whole-run route removed for D3, contract re-pinned off `5a333c74`, rooms + breaks
corrections, successors `SPECIAL-EVENT-SCOPE-C01` / `TEACHER-PROGRAM-LUNCH-BREAK-C01` recorded.
**Next action:** **C7 — integration → deployment → two-viewport browser acceptance.** The deployment must
first apply the unapplied migrations `20260925000001_shift_coherence` and
`20260925000002_faculty_availability` via the guarded runner (`atlas-migrate.ts`) after a fresh
revalidated backup, then deploy and run the two-viewport acceptance (D6 portal removal, the concern
workspace, the seven-domain drift/regenerate affordance, and the identity-delta read-back). **C6 `DONE`
(2026-09-25)** — `S2 SCHEDULER CONCERN WORKSPACE` (candidate `c403e743`, QA `ACCEPT_READY` **12/12/0/0**:
`/faculty/concerns` records/reviews through the S1 authority fail-closed with no `?? 1`; D6 removed the
three `/my/*` portal routes, their nav/footer entries, every in-app link and the `/preferences`/`/rooms`
deep links — mechanical grep = 0 matches in `atlas-client/src`; `/my`, `/faculty/preferences`,
`/faculty/room-preferences` kept) and `S4-client DRIFT/REVISION UX + D4 read-back` (candidate `ffbda016`,
QA `ACCEPT_READY` **9/9/0/0**: all seven `GenerationInputDomain`s mapped, explicit operator-triggered
"Regenerate to apply" that never auto-regenerates a published run, revision UX with optional
`identityOverrides` + reason-required withdraw, and `published-schedule.service.ts` now applies the
effective identity snapshot in effective-date order) are merged together. Combined gates:
scheduler-concern 26/26, publish-drift-revision 26/26, published-identity-readback 1/1, server-suite 318
tests / 314 pass / 4 pre-existing `tt-output-c03r`, client + server builds and `git diff --check` clean;
the client-suite red (10–11 failures) is pre-existing and independently reproduced on base. Residuals
(NON_BLOCKING): `resolvePublishedRunTermIndex` still resolves official export terms from the base
snapshot — close before any `orderedTermContract` override is applied live (F1); the availability drift
repair href is `/faculty`, not the new `/faculty/concerns` (F2); the tracked
`qa-artifacts/playwright/specs/client-route-smoke.spec.ts` still names the removed `/my/*` routes and
needs a follow-up cleanup; the "valid draft placements preserved" regenerate claim is impact-dialog copy
plus delegation to the unchanged shared generate handler (F4, unproven without a HIGH generation run).
**C5 `DONE` (2026-09-25)** — `S1 TEACHER-AVAILABILITY-AUTHORITY`
(candidate `af3a24c5`, QA `ACCEPT_READY` **16/16/0/0** after one bounded correction for the blocking
fail-open: the preflight consumed `availabilityRead.preferences` without checking `ok`, so a valid
ordered structure with an unresolved `activeTerm` could run with zero `UNAVAILABLE` exclusions — now a
typed `TERM_AUTHORITY_UNRESOLVED` blocker; also active-term-scoped the `availability` digest and made
the version CAS transactional) and `S4-server POST-PUBLISH MID-YEAR IDENTITY DELTAS` (candidate
`d51a8f16`, QA `ACCEPT_READY` **9/9/0/0**: `identityOverrides` validated by `assertSnapshotConsistency`
and applied in effective-date order, base immutable, reason-required audited idempotent withdraw) are
merged together at `4e9acbf5` over `origin/main` `5b3f2643`; combined gates faculty-availability 12/12,
published-revision-identity pass / 0 fail, server-suite 318 tests / 314 pass / 4 pre-existing
`tt-output-c03r`, server build + `prisma validate` + `git diff --check` clean. Migrations
`20260925000002_faculty_availability` and `20260925000001_shift_coherence` remain **UNAPPLIED**.
Residuals (NON_BLOCKING): D4 identity deltas are not yet visible in the canonical published projection
(`published-schedule.service.ts` still reads only the base identity snapshot) — successor wiring is
needed before D4 is user-visible; the availability feasibility proxy can over-reject (R4); default
transaction isolation on existing-row availability writes (F1); `shiftCoherenceNotices`/`preferenceNotices`
stay server-only. **C4b `DONE` (2026-09-25)** — `SHIFT-COHERENCE-C01` (D11) candidate
`ae79b45f` (base `63efb62e`, packet `fe0442b7`) integrated at merge `f37b8ea4` over `origin/main`
`16551c92`; fresh QA `ACCEPT_READY` **19/19/0/0** after one bounded correction (the first candidate
`5a47d114` broke the §8 1000-line cap in `SchedulingPolicyPane.tsx`; corrected to 893 plus client
reason parity and a real mounted-route disposable-PostgreSQL row). Adds `enableShiftCoherenceGuard`
(default true, SOFT) / `enforceShiftCoherenceGuard` (default false) and the additive migration
`20260925000001_shift_coherence` (**UNAPPLIED**; `prisma validate` only). Merged-tree gates:
shift-coherence 19/19, faculty-grade-preference 12/12, server-suite 313/317 (the 4 pre-existing
`tt-output-c03r` failures, independently reproduced at `885c9792`), disposable-PG c03 row pass / 0 fail
/ 0 residue, server build + client typecheck/build + `git diff --check` clean; every S8 path is
byte-identical to the reviewed candidate (`package.json` unioned: `test:shift-coherence` + the
concurrent lane's `archiver`). Residuals (NON_BLOCKING): `shiftCoherenceNotices` stays server-only
(mirrors the S7 `preferenceNotices` residual); the guard is autoFill-only and inert until its migration
is applied (a deployment prerequisite). **C4a `DONE`** — `FACULTY-GRADE-PREFERENCE-C01` integrated at
`885c9792`, QA `ACCEPT_READY` 8/8/0/0: year-independent `(schoolId, facultyId)` preference off the
EnrollPro-synced `FacultyMirror`, soft-only ranking tier, advisory override, narrow scheduler edit
surface. Residuals (NON_BLOCKING): the advisory tier is unconditional (intended per D10 but the "empty
preference reproduces base" wording holds only without an adviser candidate), `preferenceNotices` is not
yet surfaced in the client, and the **client** `gate-reachability` has two pre-existing orphan suites
(`timetable-lifecycle-controls-c03`, `scheduler-print-requests`) not caused by this range. No
deployment, login, migration apply, or live-data action was taken.

**`MYSCHEDULE-TERM-SELECTION-20260924` — faculty `/my/schedule` fails closed with `TERM_SELECTION_REQUIRED` (finding, not fixed) (2026-09-24).**
Read-only; no source/deploy/login/live-data action; live `514be157` unchanged. **Finding:** `GET /api/v1/schools/1/school-years/10/schedules/published/faculty/<id>?date=2026-09-24` returns **400 `TERM_SELECTION_REQUIRED`** ("Choose one ordered term before reading a published schedule") because `loadMyScheduleScoped` (`atlas-client/src/pages/MySchedule.tsx` ~L118) passes only `{ date }` — no `termIndex`. Adding `termIndex=2` returns **200** with the `{ source, timeSlots, specialEvents, entries }` payload, so the faculty "My Schedule" page (`/my/schedule`) renders no schedule. **Scope:** a full two-viewport route sweep found every other route clean (0 errors); this is the only failing surface. **Not demo-affecting for the officer session** (the presenter is an officer; `/my/schedule` is the faculty view), but it is a real user-facing defect and likely a **regression** from the fail-closed term-selection work that hardened the published-schedule endpoint. **Recommended fix:** pass the resolved ordered term (the active `termIndex`) in `loadMyScheduleScoped`, with the same ordered-term discipline the other published-schedule consumers use; unit-test the 400→200 path. Not applied this pass (a client build + deploy is out of budget). **RESOLVED 2026-09-24** by the `c7fc0c95` client fix (the page now sends the resolved ordered term), now live in `70a51608`; the page itself is slated for removal under D6.

**`HOST-PROXY-502-REPRO-20260924` — the intermittent host/proxy 502s reproduce on `/timetable` load (2026-09-24).**
Read-only; no source/deploy/login/live-data action; live `22d1f5a8` unchanged. **Correction of the earlier
"not reproduced" claim:** a fresh authenticated `/timetable` load reproduces **2–4 transient 502s** on a
consistent first-burst endpoint set — `runtime/rollover-status?schoolId=1&includeCounts=false`,
`generation/1/10/runs/317/manual-edits`, `follow-up-flags/1/10/runs/317/flags`,
`room-preferences/collaboration/ticket` — on roughly half of loads (others show 0), plus occasional
`net::ERR_HTTP2_PROTOCOL_ERROR` on the notification SSE. **Two failure modes:** host.mjs's typed
`502 {"code":"UPSTREAM_UNREACHABLE","message":"read ECONNRESET"}` (host.mjs → `localhost:5001`) and the
browser-side HTTP/2 error (browser → Tailscale front). **Not reproduced** by direct bursts (48 requests all
200/201) or by a readiness-diagnostic block with the same four endpoints (4 rounds all 200/201) — so the
trigger is specific to the page-load connection pattern, not raw concurrency. **Impact:** transient; the SPA
recovers (retries/degrades) and no route fails to render. **Most likely mechanism:** the host proxy's upstream
`http.request` uses Node's default global agent (`keepAlive: true` on Node ≥19), so a first request after an
idle period can reuse a socket the server closed at its 5 s `keepAliveTimeout` → upstream ECONNRESET → 502.
**Candidate hardening (NOT applied):** pass `agent: false` (or a dedicated non-keep-alive agent) to the
upstream request in `ops/runtime/lib/production-host.mjs` `proxyHttpRequest` — provably safe, but unproven
(no reliable failing-first control) and the HTTP/2 half may be Tailscale-layer, so it is not shipped the night
before a demo. The 502 layer remains unowned.

**`OFFLINE-FALLBACK-STALENESS-20260924` — the offline term fallback would resolve a STALE term (finding, not fixed) (2026-09-24).**
Read-only; no source/deploy/login/live-data action; live `22d1f5a8` unchanged. **Finding:** the
RR-TERM-CACHE offline fallback (`atlas-server/src/services/runtime-context.service.ts` ~L418) surfaces the
**persisted** `term_contract_cache.activeTerm` as `verified: true` when the EnrollPro active-term endpoint is
unreachable. For school 1 / year 10 the persisted contract (`enrollpro_school_year_mirrors` id 551, active,
cached 2026-09-18) carries `activeTerm = T1`, but the **live** EnrollPro active term is **T2** — so during an
EnrollPro outage the timetable would resolve **T1 (stale)** instead of the current T2. **Root cause:** the
writer (`enrollpro-term-contract.service.ts:584`) only rewrites the cache when `semanticRevision` changes, and
the active term is not part of that revision — so the snapshot never refreshes while the ordered terms are
unchanged; even a term-cache sync reports `ALREADY_CURRENT` and would not fix it. **Impact:** outage-only; a
wrong default term (the user can still switch terms). **Not demo-affecting** — EnrollPro is reachable, so the
live path resolves T2 (`dashboard/readiness-summary` → `source:"enrollpro-verified"`, `activeTerm:"T2"`).
**Recommended fix (NOT applied — semantics change on an unverifiable outage path, the night before a demo):**
derive the fallback active term from the persisted contract's term dates (needs a defined policy for the
2026-10-23…2026-10-29 gap between T2 and T3), or include the active term in the `semanticRevision` so a sync
refreshes it. The RR-TERM-CACHE offline fallback therefore remains **verified by the QA harness only, not
live**.

**`DEMO-READINESS-ACCEPTANCE-20260924` — live `22d1f5a8` fully verified demo-ready; nothing to deploy (2026-09-24).**
Read-only; no source/deploy/login/live-data action. `origin/main` `030861d6` has **no undeployed product
delta** (its product tree == live `22d1f5a8`; all other branches merged). **Comprehensive route acceptance at
1366×768 and 390×844** (15 routes: `/`, `/subjects`, `/teachers`, `/teaching-load`, `/timetable`,
`/timetable/{pre-generation,setup,policies,runs,exports}`, `/sections`, `/schedules`, `/audit`, `/map`,
`/public/schedules`) — every route renders with **0 console errors, no error boundary, no global document
scrollbar**. Export matrix 200 (`class-program.xlsx` 20,389 B + section-program.docx + summary-teacher-schedule
+ room-program). Public surface run 317 / revision 43 / FROZEN / 920 entries. **Authority check:** the officer
session holds the backend `timetable:approve-publication` capability (`GET /publication-approvals/1/10/requests`
→ 200) while the client gates the inbox to `role === 'scheduler'` — a conservative UI gate, not a security gap;
the service enforces separation of duties (`requesterId: { not: actorId }`). The scheduler-role UI row stays
unexercised (no scheduler credential; no browser login). **Residuals (no action):** the intermittent host/proxy
502 layer was **not reproduced** (4 fresh `/timetable` loads + a 48-request burst all 200/201); the readiness
diagnostic runs the full scheduler (~7.4 s) on every timetable mount (`force: true`, by design; 14 invocations
since boot) — a latency observation, not a defect; school-1 QA/admin credential rotation outstanding.
**No deployment** — there is nothing new to ship. *(Superseded re 502: it DOES reproduce on `/timetable`
loads — see the entry above.)*

**`DEMO-READINESS-20260924` — live `014b4b4c` verified demo-ready; lifecycle polish merged but undeployed (2026-09-24).**
*(Superseded: the lifecycle polish was subsequently deployed as `22d1f5a8` — see the entry above.)*
Read-only; no source/deploy/login/live-data action. Live `014b4b4c` healthy and unchanged (machine
`ATLAS_RUNTIME_RELEASE_SHA`/`SOURCE_DIR` = target; health/ready `database:"ok"` 200). Demo-readiness
re-verified: 13 routes render (no error boundary / no global scrollbar), `Teaching Load` renders (37 rows),
export matrix 200 (`class-program.xlsx` + 3), public surface run 317 / revision 43 / FROZEN / 920 entries,
0 HARD violations. **Undeployed product delta on `origin/main` `d22b50a5`:** `TIMETABLE-LIFECYCLE-CONTROLS-C03`
— client-only (session-verify truthfulness, per-route loading copy, header grid-control refinement
Dialog→Popover/Sheet, `jsdom` devDep + tests); complete (integration tip == main) and accepted per the
operator handoff (Terra `ACCEPT_READY`; integrated checks lifecycle mount 1/1, route preservation 57/57,
controls/session 3/3, production client build passed; non-blocking gap: 3 unchanged tests missing Playwright
declarations). An operator elevated-deployment handoff exists (target `22d1f5a8`, rollback `014b4b4c`); it was
**not executed** this session. No blocker for the demo.

**`POSTDEPLOY-CLOSURE-20260924` COMPLETE — 014b4b4c accepted read-only; three stale blocker lines corrected (2026-09-24).**
Artifact `docs/handoffs/post-deploy-acceptance-014b4b4c-20260924.md`; base/end `origin/main` `48356ee2`; no
source/deploy/login/live-data action. **Acceptance:** 13 demo routes render with no error boundary and no
global scrollbar; key APIs 200; `class-program.xlsx` deep-verified (4 grade worksheets G7–G10, 20/20 section
names, M/F/Total columns); public surface run **317 / revision 43** / FROZEN / 920 entries; the 502
host/proxy layer is **not reproducible** (100/100 burst requests 200) so no speculative fix. **Corrected
stale lines (each re-verified live, marked RESOLVED in place):** runs-list `summary.isPublished` (fixed by
`TIMETABLE-TRUTHFULNESS-C01` D1); Dashboard "335 review blockers" (now `289 warnings acknowledged`);
`runtime.router.ts` `rollover-recovery/preview` school-1 default + strict school-id parser (now
`authorizeRuntimeRead/Mutation`); the `Live data` published-run fact (315/42 → 317/43). **Long-standing
"unattributed `hybrid-scheduler` runs" debt RESOLVED:** they are the app's own canonical readiness
diagnostic (`GET /generation/:s/:y/readiness/diagnostic` → full `runHybridScheduler`, ≈7.4 s per call),
triggered by client page mounts — bursts observed `19:02:04–19:02:11`, `19:15:02–19:17:25`,
`19:35:03–19:36:11`, `19:44:51–19:45:05`, `19:52:56–19:53:02Z`, no persisted run; a reproduced call blocked
concurrent requests (12/12 200 but delayed to ≈7.6 s) — a latency observation, not a defect. **Anomaly still
open:** two `LOCAL_LOGIN_SUCCESS` rows **933** (`19:10:51Z`) / **934** (`19:14:04Z`, actor 46, school 1,
127.0.0.1, Chrome) were not performed by any planner cycle — the operator should attribute them. The
`014b4b4c` supervisor start at `19:01:28Z` is the deployment itself (audit `014b4b4c-20260924-030100`).
Scheduler-surface acceptance remains `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`.

**`EXPORT-CENTER-ACCEPTANCE-20260924` COMPLETE — all-sections class-program export unblocked by a section re-sync (2026-09-24).**
Cycle artifact `docs/handoffs/export-center-acceptance-20260924.md`; base/end `origin/main` `be0bd0df`; live
`014b4b4c` untouched. **Objective 1 (BLOCKING) RESOLVED:** the all-sections
`class-program.xlsx?termIndex=2` was `503 LEARNER_RECONCILIATION_FAILED` because 2 of 20 `section_mirrors`
for school 1 / year 10 were stale — section **143** (mirror 4 vs live feed 5) and **146** (1 vs 2). Under the
operator's explicit go, the narrow `POST /api/v1/sections/sync {schoolId:1, schoolYearId:10}` ran on the live
runtime (200: 20 synced, 0 removed, 0 skipped; `fetchedAt 2026-09-23T19:17:40.410Z`); the reconciliation
guard was **not** weakened. Post-action DB: 143=5, 146=2, 20 rows, sum 92. **Re-verified export matrix**
(run #317, termIndex=2): `class-program.xlsx` **200** (20,389 B), `section-program.docx?sectionId=141` 200
(9,873 B), `summary-teacher-schedule.xlsx` 200 (54,082 B), `room-program.xlsx` 200 (34,951 B). Rollback
basis = pre-action mirror snapshot (143=4, 146=1) in `%TEMP%`. **Objective 2:** the scheduler-only
publication-approval surface is correctly hidden for the persistent **officer** session
(`canApprovePublication = userRole === 'scheduler'`, `useScheduleReviewWorkspaceState.ts:1923`;
live `/timetable` shows no "Review publication requests"); exercising it needs a scheduler-role login —
reported `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` (not pre-authorized; no login performed). The
collaboration WebSocket is independently re-verified **open** (authenticated ticket 201 + `ws…/collaboration/ws`
`open`). **Objective 3:** `35518455` is an ancestor of the live `014b4b4c` and
`scheduler-ancillary-authority.service.js` is in the release — **no re-deploy** (it would downgrade).
No source change, deployment, generation, publication, migration, or login.

**`RUNTIME-DIR-RETENTION-C01` COMPLETE — retention policy landed, 14 rows / 17.46 GiB reclaimed (2026-09-23).**
The operator chose the **demo-safe** depth after `RUNTIME-DIR-RECLAIM-C01` proved that ~46 GiB had
accumulated because **no rule defined the required rollback depth**. Policy (now in
`docs/reference/agent-worktree-lifecycle.md`): keep the live release + the two most recent accepted + the
two last-resort artifacts; deeper rollback is a **rebuild**. Manifest
`docs/reviews/runtime-dir-retention-c01/manifest.md` (rev 1 `d38fe0d5` → rev 3 `ae33d03a`); **two
pre-action audits each returned `CORRECTION_REQUIRED`** and both were right — they caught that 3 rows were
standalone clones (not worktrees), that `E:\ATLAS-worktrees\warning-readability-c01` borrows from
`0eb3b67fe94c` (row dropped, lane preserved), and that the live release had moved to `0232bf9c`. Removed:
9 rollback-depth rows + 5 junction pass-through rows (11 worktrees removed non-forced after logs-clearing
and full link-unlinking; 3 clones removed by literal path after a reparse-free gate). **`D:` 20.37 →
37.83 GiB; worktrees 79 → 68; no branch deleted.** All preserved dependency trees verified intact
(`warning-readability-c01` server tree 206 entries; `ux-quickfix-c01` client tree 124). Live release
`0232bf9c` untouched. **Not reclaimed:** the 6 next-tranche anchors (~11.2 GiB) and the four historical
live releases, both kept by operator choice until after the demo. **Remaining reconciliation:** the
register's current-state pointers (`globalNextAction` + 3 cycle `nextAction` strings) still name superseded
releases as live — a pre-existing drift, flagged for the next docs pass.

**`RUNTIME-DIR-RECLAIM-C01` COMPLETE — 7 rows / ~4.9 GiB reclaimed under the operator exception (2026-09-23).**
Frozen manifest `docs/reviews/runtime-reclaim-20260923/manifest.md` (`d5c73fc0`, corrected `4f911381`);
post-action report beside it. Pre-action audit `CORRECTION_REQUIRED` 5/9 — it falsified the "not an anchor"
gate for six rows, which were moved to the preserve set, and it corrected the live-release identity
(`89012430`, not `7ac28124`). The correction was strictly subtractive. Removed: five 2026-09-18 worktrees
(`131baab7`, `3c4cc3cd8d7d`, `74c1f12a5c06`, `798cd78356ef`, `f0d65a531e34`) after logs-clearing and
junction unlinking, plus two clones (`6cc202b7`, and the stray `E:\ATLAS-worktrees\c01r-release-20260921`)
gated on an empty reparse scan. **Post-action audit: zero blocking findings, 8/8.** Worktrees 83 → 78;
**branches unchanged at 347**; `D:` 16.82 → **20.37 GiB**; `E:` +1.02 GiB; all 7 junction targets and their
dependency trees intact; live release `89012430` untouched and serving. **Disclosed (audit C3):** three of
the removed worktrees were formerly deployed releases cited in historical handoffs — `NON_BLOCKING`, since
none is a current anchor, no pending packet depends on them, and every HEAD is an ancestor of `origin/main`
(rebuild path recorded). **Successors:** the five-deep junction chain rooted at `8eb0511baa53` (whose
client-side target is an **empty** directory — pre-existing, flagged), and the remaining ~26 GiB, which
would cost rollback capability and needs its own operator decision.

**Custody transfer (2026-09-23):** the simplified-timetable source stream is handed to Planner B — see
`docs/handoffs/simplified-timetable-handoff-to-lane-b-2026-09-23.md`. Lane A keeps deployment, the single
browser controller, and this continuity file. That handoff records which recorded residuals are **already
closed** (over-cap components, `test:ux-guardrails`, the two previously-untested sources) and what is
actually still open (`UX-R04`, `UX-R05`, the draft-tray swap decision, disposal of the stale
`work/timetable-live-term-authority-c01` candidate).

**SMART teacher-side boundary — RESOLVED (2026-09-23):** SMART owns the teacher-facing submission side and
holds the **teacher login**; ATLAS holds the **scheduler login** and owns review, appeal and every
scheduling consequence (SMART handoff §5, **option (a)**). Consequences recorded so they are not reopened:
ATLAS's `/my/preferences` and `/my/room-preferences` submission pages are **unreachable by design** and
retire — **adviser-gated**, so frozen rather than deleted, and they are the cheapest fallback if SMART
slips before a demo; the `/faculty/*` review surface **stays** and its audience is now the scheduler, so it
belongs in the scheduler's navigation rather than a faculty-named path; the submission channel must be an
**authenticated machine-to-machine call**, never an open write endpoint, matching the teacher on a stable
external id and **failing closed** when it cannot. `/public/schedules` is unaffected (public by contract).
**Main is ahead of live:** `TIMETABLE-SIMPLICITY-C02` is integrated at `8e9acf28` but **undeployed** (live
`7ac28124`); its `SimpleHeaderHelpers.tsx` edits rename "Advanced view" → "Expert view" and leave the
accepted D4 `checked <age>` wording intact.

**`TIMETABLE-TRUTHFULNESS-C01` COMPLETE — deployed at `7ac28124`, post-deployment QA `ACCEPT_READY` 11/11/0/0 (2026-09-23).**
Candidate `fb58a0d5` + one bounded correction `adfbf9f9` on `work/timetable-truthfulness-c01` (base
`5ff8d80f`, 3 commits, clean). One batched pre-action reviewer closed the source range **and** the packet
lint in one dispatch and returned `PLANNER_DECISION_REQUIRED` 7/9: **no product defect in D1/D2/D3**
(independent failing-first reproduced 0/4→4/4 against real base bytes; real-route controls; consumer parity
for the removed `generation.violationCount`; the accepted UX-R03e lean-selection guard reproduced failing
on the pre-correction shape), with two **planner-owned** blockers — D4 under-delivered the packet's "when
it was verified" clause, and the D2 live row would have been decided by the wrong artifact. Both resolved:
D4 now renders `School year from ATLAS, checked <age>` from the real `cachedAt` via `formatCheckedAtAge`
(correction `adfbf9f9`; blast radius exactly 2 paths, all other 12 reviewed paths byte-identical, additive
assertions), and D2/D4 are re-targeted as labelled deployment-acceptance rows (packet §7). Integrated at
merge **`7ac28124`** (product tree byte-identical to the reviewed candidate) and deployed via the reviewed
`ops/runtime/deploy-runner.ps1` to `E:\ATLAS-runtime-supervised-7ac28124-20260923` (audit
`C:\ProgramData\ATLAS\release-audit\7ac28124-20260923-132431`); served chunk byte-identical to the build;
incumbent chunk 404; Tailnet 200. **Rollback basis `d9a6aa53` startable in place.** No schema, migration,
generation, publication or live-data action. **Junction hazard closed:** the candidate worktree's
`atlas-client/node_modules` and `atlas-server/node_modules` junctions into `e78d4473` were confirmed
taint-free (single hop, no source byte resolved through them, lockfiles + schema byte-identical, values
independently re-derived by the reviewer) and the release was built with its **own** dependency tree; the
junctions must be removed before that worktree is retired and `e78d4473` must not be reclaimed.

**Post-deployment acceptance (fresh independent QA, 2026-09-23) — `ACCEPT_READY` 11/11/0/0**, blocked 0,
unperformed 0. Deployment identity independently re-derived (release HEAD, machine scope, task action,
single listener lineage under supervisor 26208, authoritative `supervisor-state.json` `state=running`).
**D2:** authenticated `GET /api/v1/dashboard/readiness-summary` → `generation.blockingHardCount 0`,
`softViolationCount 289` (soft-labelled), `violationCount` **absent**. **D4:** the live Simple header renders
`School year from ATLAS, checked 9s ago · 2031-2032 · Run #317`; the deployed bundle contains **zero**
occurrences of `Using cached school year`, so the stale-reading state is unreachable. **D1:** runs list
returns `activePublishedRunId 317` with per-run `summary.isPublished` (317 true; 316/315 false).
**Preservation:** one header row; grid top **140 px** at 1366×768; one status region; published surface
ahead of `Generate`; no document scrollbar at 1366×768 or 390×844; all nine `/timetable*` routes keep the
6-link sub-nav; 0 console errors on clean loads. **Login delta:** audit 928 `LOCAL_LOGIN_SUCCESS` (actor 46,
school 1) plus a disclosed probe artifact 927 `LOCAL_LOGIN_FAILED`; token drop proven (`/auth/me` 401).
Non-blocking: N1 the release worktree shows the supervisor's untracked `ops/runtime/logs/` (same as the
incumbent — runtime state, tracked tree clean); N2 transient first-load 502s on three unrelated endpoints
(all 200 on re-issue; pre-existing); N4 the 390 px source line truncates rather than wraps; N5 an
unattributed `hybrid-scheduler` benchmark profile ran at 05:28–05:30Z with **no** new persisted run.
**Closure:** candidate worktree junctions removed with `rmdir` (link only — `e78d4473` verified intact,
125 entries + generated client), then both cycle worktrees retired non-forced (`work/` and `integration/`
branches preserved); `D:` unchanged at 16.82 GiB. No schema, migration, generation, publication or
live-data mutation occurred.

**`TIMETABLE-HEADER-COLLAPSE-C01` COMPLETE — the three declutter gaps are closed (2026-09-23).**
Live release **`d9a6aa53`** at `D:\ATLAS-runtime-supervised-d9a6aa53-20260923` (5001→19296 /
5174→41948; machine `ATLAS_RUNTIME_RELEASE_SHA` = `d9a6aa53`; health/ready + DB-backed read + Tailnet
200; served entry `assets/index-BKcGq9ln.js`, byte-identical to the build). Cycle: candidate
`daca0fb9` → one batched pre-action reviewer (**`CORRECTION_REQUIRED` 11/10/1/0**) → bounded correction
`dd601d17` → planner-verified mechanically → integrated `d9a6aa53` → post-deployment QA
**`ACCEPT_READY` 6/6/0/0`**. **Measured live at 1366×768:** grid top **180 → 139.6 px** (target ≤ ~140);
header bands **2 → 1** (single `timetable-simple-header-row`, no wrap, `flex-nowrap`); exactly **1**
status region; the published surface (**195.41×44**) now out-ranks `Generate` (**94.31×32**) with **zero**
brand-filled action buttons; no document scrollbar at **1366×768 or 390×844**; band does not scroll
horizontally (`scrollWidth == clientWidth`); all nine `/timetable*` routes keep the 6-link sub-nav at a
12 px floor with **0** router element-less warnings; run #317 / revision 43 intact with no stale banner.
**The defect the review caught, and why it mattered:** the candidate used arbitrary `min-[1366px]:*`
variants, which Tailwind emits **before** the `lg:` block — equal specificity, so source order decided
and `lg:` won, making the ≥1366 behaviour the **exact inverse** of the design (the inline switcher never
yielded, the compact trigger never returned). The candidate's own test certified the opposite because it
**regex-matched source strings only** — "wiring, not outcome". The correction replaced the variants with
a **named `--breakpoint-wide: 85.375rem`** breakpoint (it must be `rem`, not `px`: Tailwind orders
breakpoints by **unit string before magnitude**, so `1366px` sorts before `sm` — the same defect), and
replaced the proof with one that runs the **real Tailwind pipeline over the real `src/index.css`** and
asserts the emitted order plus the effective display at 1366/1280, with a negative control that fails on
the old defect. Verified live: at 1366 the switcher yields and the sheet trigger returns; at 1280 the
inverse. **Residual (NON_BLOCKING):** the 139.6 px margin is 0.4 px — read it with its definition
(header bottom), not the padded grid-container top (155.6 px); a transient, self-recovering 502 pair on
first paint (`runtime/rollover-status`, `runs/317/manual-edits`) both returned 200 on immediate re-probe
and is not attributable to this client-only delta. **Disk: `D:` 16.83 GiB** — close to the §3 15 GiB
fail-closed line; six `D:\ATLAS-runtime-supervised-*` release trees now exist and the lifecycle rule
forbids retiring them, so the next release or any further heavy build needs a capacity decision.

**`TIMETABLE-PUBLICATION-C01` COMPLETE — school 1 / year 10 now serves a newly published schedule (revision 43, run #317, 2026-09-23).**
This is the **third** publication for year 10, **not the first**: revision 41 (run 314, effective
`2026-09-18T02:28:07.874Z`, audit 823) and revision 42 (run 315, effective `2026-09-18T05:38:27.923Z`,
audit 831) were already published. Publishing run 317 **superseded the live run 315** — run 315 now
carries `isPublished:false`, `publicationSupersededAt:2026-09-22T23:22:04.198Z`,
`publicationSupersededByRunId:317` — and the public surface now serves run 317 / revision 43.
`INITIAL_PUBLICATION` is run 317's **base-revision label** (`sourceRevisionId null`,
`publicationBase true`), **not** a claim about the school year. **Root cause of the earlier false
claim:** the `GET …/runs` list projection omits `summary.isPublished`, so `#317/#316/#315/#314` all
render without a published marker and "all COMPLETED" was mis-read as "none published"; the 422
`PUBLISHED_SOURCE_REQUIRED` on run 316 only means run 316 is not itself a published source. **Backlog:
the runs-list projection should expose `isPublished` — this omission produced a false continuity claim
and a mis-stated live-state change.**
Under the operator's explicit authorization and with every gate retained: the read-only readiness
diagnostic returned `status READY`, `generateAllowed true`,
`derivedDemandBlockers []`, teaching-load coverage **264/264 owned, 0 missing**, grade windows 20/0,
term structure `TRIMESTER T1/T2/T3`, `derivedDemandRevision 096CA3E7…`, and
`runs/gate {blocked:false, openCount:0}`. Run **#317** was generated (`POST …/generation/1/10/runs`,
COMPLETED in 9.9 s, T1/T2/T3 = 920/920/920) and **published**
(`POST …/runs/317/publish`, `acknowledgeSoftViolations:true`) → `isPublished:true`,
**revision 43**, **audit 918**, `inputFingerprint cd220cdf…`, `publishedBy 46`. Fresh independent QA of
the published leg returned **`ACCEPT_READY` 5/5/0/0**; a fresh Wave Completion Auditor returned
**`CORRECTION_REQUIRED` 7/6/0/0** — the publication action cleared areas 1–6 (integrity, HARD gate,
readiness, authority, **zero-other-write now DECIDED**, consumer blast radius) and failed only this
record's accuracy, which is corrected above. **The publish write set is wider than first stated:**
1 revision + 1 publication audit row + **2 `generation_runs` updates** (publish + supersede) +
**45 `notifications` rows** (`SCHEDULE_PUBLISHED`, resource 317 — the `notificationDelivery` fan-out);
a timestamped-table scan over the publication instant found no other write.
`/timetable` shows the plain-language **"Published — read only"** state for run #317 with zero
"Run inputs are stale" matches; the **public** surface renders real content
(`/api/v1/schools/1/schedules/published` → runId 317, `activeRevisionId 43`, `snapshotState FROZEN`,
920 entries / 20 sections / 42 faculty / 20 rooms); HARD **0**; workspace density holds (grid top
180 px). `as of 2026-09-23` the 289 soft violations are **not** a regression: run #316's **canonical**
soft count is 284 (its **raw stored** count is 335; run 317 raw 334 → canonical 289). Non-blocking:
`summary.publishedSoftViolationCount` (334/335) disagrees with the canonical list (289/284) in both runs
(pre-existing, HARD unaffected); the dashboard readiness summary presents the raw 334 soft count as
blockers; the header's "Using cached school year" wording can read as staleness; the public route needs
`termIndex` (400 `TERM_SELECTION_REQUIRED`, fail-closed by design).

**`NOTIFICATION-INBOX-LIVE` COMPLETE — migration applied, live 500s cleared (2026-09-23).**
Recorded before the schema command: host `localhost:5432`, database
`atlas_recovery_clean_rebuild_20260905`, release `28f6f03f`, **4 applied / `0004_notification_inbox`
pending**. A fresh verified backup was taken (`atlas-backup-…-20260922-231922.dump`, 539,163 B, sha256
`15018a8e…`, 485 restore-list entries), then the **guarded** wrapper ran (`MIGRATE_GATE_OK` →
`0004_notification_inbox` applied; `migrate status` → "Database schema is up to date"). **No restart
needed** (the running Prisma client already carried the model). Verified end to end:
`GET /api/v1/notification-inbox/?limit=20` → **200 `{"items":[],"nextCursor":null}`** and
`/unread-count` → **200 `{"count":0}`** (previously 500 on every page load). Empty is correct — only
new events persist. Rollback for the schema step: `DROP TABLE notifications` (additive table, no
existing data touched).

**SECURITY — QA credential exposure, cleaned and rotation recommended (2026-09-23).**
A QA agent's naive parse submitted the backtick-wrapped values from
`%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md` literally, rendering the credential into
that agent's transcript. A follow-up scan of the opencode temp/output roots found the **live** credential
value in **8 pre-existing files from earlier sessions** (`atlas-rc02d-*`, `tlc02r-*`, `login-body.json`,
two 2026-09-11 `pw-mcp-output` snapshots) — i.e. this has been leaking across sessions, not just today.
All 8 were deleted and the scan now returns **0**. **Recommendation: rotate the school-1 QA/admin
credential and strip the backtick wrapping from that file** — the values have been on disk in plaintext
repeatedly, and the file's markdown-backtick format invites the naive parse that caused this.

**`TIMETABLE-RELAXED-MAIN-C01` COMPLETE — the relaxed main Class Schedule workspace is live (2026-09-23).**
Live release **`28f6f03f`** at `D:\ATLAS-runtime-supervised-28f6f03f-20260923` (supervisor-owned
5001→17548 / 5174→39100; machine `ATLAS_RUNTIME_RELEASE_SHA` = `28f6f03f`; health/ready/DB-backed read
+ Tailnet 200; served entry `assets/index-Dy2kdrZW.js`, SHA-256 `612F7F5F…3454`, byte-identical to the
release build). It carries 4 additive corrections over the candidate. Cycle shape: baseline read-only
QA of the deployed `7dbb3b90` → Candidate A (density/term authority/labels/hygiene/scroll) → Candidate B
(preview-before-save/guidance/first paint) → one batched pre-action reviewer (source range + packet
lint) → 3 bounded corrections → re-deploy → post-deployment browser QA in 3 passes → `ACCEPT_READY`.
**Measured wins at 1366×768 on `/timetable`:** grid top **332 → 180 px** (chrome 35 % → 23 %); status
surfaces **8 → 1**; header bands **5 → 2**; controls 74 → 70; router element-less warnings **49 → 0**;
mobile 390×844 first paint **0 controls at 8 s → 8 controls at 91 ms, grid at ~1.1 s**; SPA navigation
refetch **17 → 1 call**; scroll position **now preserved**; `All terms` entries **now term-labelled**;
`TERM TERM N` duplication removed; the contradictory `Run inputs are stale` + `Verified with EnrollPro`
co-announcement is now structurally impossible; the **pre-generation draft surface renders** (baseline:
never) and is reachable from the sub-nav; placement is **inline preview → exactly one Confirm → zero
modals** with a **working Undo** (draft Undo now routes to `/pre-generation-drafts/undo`; the earlier
release 409'd it against the run manual-edits revert). Term authority defaults to the **EnrollPro
verified active term T2** (`source: enrollpro-verified`) and fails closed on unknown identity.
**Two live defects were caught by review, not by tests:** (1) a clean draft slot opened a review modal
with two Save buttons and registered no Undo; (2) the Undo it did register dispatched a draft-ledger id
to the run manual-edits CAS endpoint (409 `UNDO_CONFLICT`). Both are fixed and re-verified live.
**Open residue — CLEARED 2026-09-23.** The two extra pinned draft placements (ids 24, 25) left by QA
passes while the Undo defect made them un-undoable were removed surgically with
`DELETE /api/v1/generation/1/10/pre-generation-drafts/:placementId` (privileged, `removeSinglePlacement`),
one authenticated pass, credentials read inside the process and never printed. Board
`counts {draft:2, lockedForRun:4, archived:1, unscheduled:1318}` → **`{draft:0, lockedForRun:4,
archived:3, unscheduled:1320}`** — exactly the pre-cycle state; the removals are archived, not
destroyed, and the four legitimate `lockedForRun` placements (ids 20–23) were not touched. One login
consumed (token dropped with the process; ATLAS has no server-side logout route).
**Corrected 2026-09-23 — the "published" leg was NOT unreachable, and no publication was missing.**
The earlier claim here ("no published run exists") was **false**: year 10 already had revisions 41
(run 314) and 42 (run 315) published since 2026-09-18, and the public surface was serving run 315 until
run 317 superseded it. `GET …/runs/316/published-revisions` → **422 `PUBLISHED_SOURCE_REQUIRED`** only
means run 316 is not itself a published source. The root cause was the `GET …/runs` list projection
omitting `summary.isPublished` (see the publication entry above). The draft-tray **swap** is a modal by
design (`draft-swap-review-dialog`) while the Simple swap path is inline — the packet's "swap keeps its
inline preview" is satisfied only for the Simple path. A one-off observation that the grid label read
`Showing Section schedule: Luna` while armed with a §143 session was not adjudicated.
**Disk:** `D:` 18.37 GiB free (below the §3 25 GiB warning, above the 15 GiB fail-closed) — four
release trees now exist (`7dbb3b90`, `11e8778f`, `e78d4473`, `1fdab989`, `28f6f03f`); superseded
intermediates were **not** retired (preservation class).

**`NOTIFICATION-INBOX-C01` — deployed, migration NOT applied, live 500s.** The inbox source reached
live with `28f6f03f` (it was integrated at `7df2ddcf`), but `prisma/migrations/0004_notification_inbox`
is still **not applied**, so `GET /api/v1/notification-inbox/` and `/unread-count` return **500** on
every page load. `as of 2026-09-23` the fix is the separate HIGH `NOTIFICATION-INBOX-LIVE` action
(apply `0004` + restart), which is **not authorised** by the timetable cycle.

**`NOTIFICATION-INBOX-C01` integrated — `ACCEPT_READY` 5/5/0/0 on the correction (2026-09-23).**
The persisted, actor-scoped inbox is on `origin/main` at merge `7df2ddcf` (candidate
`fb27d48e` + correction `47d0a80b`; base `72348902`). It adds the `Notification` model and the
**authored-but-not-applied** `prisma/migrations/0004_notification_inbox/migration.sql`, the
actor-scoped fail-closed API at `/api/v1/notification-inbox` (list / unread-count / mark-read /
mark-all-read), a content-stable dedupe key, recipient resolution with a 200-recipient cap, a durable
listener that persists the events the SSE stream already carries (errors swallowed, publish signature
unchanged), and the `AppShell` bell on `@/ui` `Popover`. **The first review returned
`CORRECTION_REQUIRED` 11/9/0/0 with one `BLOCKING` defect:** the route resolved the actor as
`req.user.userId`, which for a faculty-shaped session is the `FacultyMirror.externalId` while rows are
keyed on `AtlasAuthAccount.id` — so a teacher could not read or acknowledge their own notifications
and a numeric collision could read/mutate another actor's rows; the committed DB test masked it by
minting `userId === accountId`. The bounded additive correction (`47d0a80b`, 2 paths) resolves
`req.user.accountId` only, never falls back to `userId`, and adds a faculty-shaped failing-first
control (pre-correction **46 pass / 10 fail** → corrected **56 pass / 0 fail**). The bounded re-review
of the correction's blast radius returned `ACCEPT_READY` **5/5/0/0**; the prior accepted commit is the
direct parent and all other reviewed paths retain their accepted blobs. Merged-tree gates: server
suite **289/289**, `test:server-db` **54 files pass / 0 fail / 0 skipped-known-red, residue 0**,
client suite **859/859**, server build + built-app load, client build with `VITE_ENROLLPRO_URL`,
`git diff --check` clean; product tree byte-identical to the reviewed candidate. **Source only — the
migration is NOT applied and nothing is deployed.** `as of 2026-09-23` the live release was `7dbb3b90`
and does not carry this work (**superseded: the live release is `0232bf9c`, and `7dbb3b90`'s directory was
retired under `RUNTIME-DIR-RETENTION-C01`**). Next: the separate HIGH `NOTIFICATION-INBOX-LIVE` action
(apply `0004` + deploy), which is **not** authorized by this integration.

**`TIMETABLE-RELAXED-SUBPAGES-C01` independently reviewed post-hoc — `ACCEPT_READY` 20/20/0/0 (2026-09-23).**
`57592dd7` (relax scheduler chrome on subpages) + `e794dee2` (fixture-path correction), merged
`6cc202b7`, reached the live release `7dbb3b90` under the `AGENTS.md` §11 unreviewed-delta condition.
One fresh independent reviewer (task `ses_f35fd1dfaffeh6KPQu8Od2twsa`) over the frozen range
`714fadf7..7dbb3b90` returned `ACCEPT_READY` **20/20/0/0**, blocked 0, unperformed 0. Product delta is
exactly four `atlas-client` paths; the gate is confined to `ScheduleReviewWorkspace.tsx:382/:463`;
`TimetableRouteViewSync.tsx` is additive (+10 lines, pre-existing exports byte-unchanged) and
behaviourally unchanged. The rehaul bar holds **live** at 1366×768 on
`https://njgrm.buru-degree.ts.net`: **U3** sub-nav present on all nine `/timetable*` routes checked and
a DOM marker survived four sub-pages and back with **no grid refetch and no remount**; **U2** exactly
one solid primary (`Review warnings`) + one status region; **U6**
`scrollHeight == clientHeight == 768`; **U1/U5** no raw code tokens and the
`…180 consecutive teaching minutes…` warning copy intact. `test:client-suite` **854/854** exit 0; the
built entry chunk SHA-256 `43BA4754…DD72` (455,186 B) is byte-identical to the live served
`/assets/index-CnDObevR.js`, so the reviewed source bytes are the deployed bytes. The test change is
additive (one-line fixture path, no assertion removed) and the fixture now resolves to the real
tracked `ScheduleReviewWorkspace.tsx` (the pre-fix `../..` path was nonexistent). **No correction
required and no new release** — the live delta is accepted. One authorized login this pass
(~2026-09-22T16:50Z), logout proven (`GET /api/v1/auth/me` -> 401 `NO_TOKEN`); the exact
`audit_logs` row id was **not** read (no safe read-only DB path surfaced) — recorded limitation.
Non-blocking successors: (a) `test:client-suite` does **not** enumerate the new file (93 files), so
the new regression runs only via `test:timetable-relaxed-subpages` (reachability is still enforced by
`gate-reachability.test.ts` inside the suite); (b) the second test case is a source-text regex, not a
rendered assertion, so a semantics-preserving refactor can false-fail and a regression that keeps the
matched substrings can false-pass; (c) in advanced layout the sub-pages also lose the Simple-view
toggle and Undo/Redo, both reachable by returning to `/timetable` via the persistent sub-nav;
(d) pre-existing and outside the range: 502s on `runs/316/manual-edits` + `rollover-status`,
element-less-leaf-route console warnings, and a stale `atlas:session-user:v1` localStorage shell
rendering after logout while `/auth/me` is 401.

**Reconciliation finding 2026-09-23 — an unreviewed, undeployed timetable candidate exists.**
`work/timetable-live-term-authority-c01` (HEAD `b8e2e48e`, worktree clean) and its integration branch
`integration/timetable-live-term-authority-c01` (HEAD `38a94bb0`) hold **5 unreviewed, unintegrated,
undeployed** commits dated 2026-09-22, touching `atlas-client/package.json`,
`src/hooks/useTimetableData.ts`, `src/lib/academic-term.ts`,
`src/lib/timetable-data/timetablePrefetch.ts`, `src/hooks/useScheduleReviewWorkspaceState.ts`,
`src/components/AppShell.tsx` and `src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`, plus a
`qa-artifacts/` spec. There is **no packet and no committed review verdict**. `as of 2026-09-23` it is
not in `origin/main` and not deployed. It was deliberately **not** folded into the QA above; it needs
its own cycle, and it overlaps `atlas-client/package.json` with the accepted delta. Branch and
worktree preserved (`PRESERVE_FOR_DECISION`) — not retired, not rewritten, not reviewed here.

**Lane B state, observed by Lane A 2026-09-22** (their own section is theirs to write; this is a
dated observation only). `docs/handoffs/lane-b.md` was last touched 2026-09-21 (`2f1ee14b`,
ACTOR-SCHOOL-MUTATIONS-C01) and does **not** describe their recent work. Their actual recent streams —
`ROLLOVER-YEAR-IDENTITY-C01` and `TIMETABLE-SCHEDULER-SIMPLICITY-C01` (+ lifecycle proof) — are all
**merged into `main`**. Every Lane B worktree is merged; one dirty residual
(`E:/ATLAS-worktrees/timetable-scheduler-simplicity-c01`, HEAD `5dfe7d59`) is left untouched. No
in-flight Lane B stream is discoverable, so their server file boundary (`atlas-server/src/**`) is
currently unowned; Lane A took it for `ZONE-IMBALANCE-PRECONDITION-C01` on the operator's direction
and recorded the transfer.

**FIXED 2026-09-22 (EnrollPro → ATLAS SSO now works): the outbound exchange URL was missing `/api`.**
EnrollPro corrected their callback config and reported the remaining failure as ATLAS-side: codes 165/166
were created but **never consumed**, with no exchange attempt recorded. Root cause proved: ATLAS builds
its exchange URL from `ENROLLPRO_BASE_URL` (`https://dev-jegs.buru-degree.ts.net/`, no `/api`) plus
`/auth/companion-sso/<companion>/exchange`, and `ENROLLPRO_SSO_EXCHANGE_URL` was unset — so the callback
POSTed to `…/auth/companion-sso/atlas/exchange` (**404**) instead of the canonical
`…/api/auth/companion-sso/atlas/exchange` (**400** for a bad code — route exists). The code was therefore
never exchanged, and the callback redirected to the SPA with a typed error. **Fix:** set the machine-scope
override `ENROLLPRO_SSO_EXCHANGE_URL=https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/exchange`
and restart the supervisor. The runtime env file `D:\ATLAS-runtime-config\atlas-server.env` is **ACL
read-only for everyone including Administrators**, so the key was set at machine scope instead of editing
the locked file — and because the key is absent from that file, nothing overrides it. **Verified end to
end** (authenticated, via the SSO): clicking ATLAS in EnrollPro's Integrated Systems now lands on an
authenticated ATLAS session with **no** "expired or already used" error and no second login form; ATLAS
`audit_logs` records `886` login, `887` reverse-SSO code consumed, **`888 COMPANION_SSO_SESSION_CREATED`**
(the previously-broken direction). **Reversible:** remove the machine-scope variable and restart.

**FINDING 2026-09-22 (EnrollPro-side, not ATLAS): the active term ATLAS shows is what EnrollPro's own
integration endpoint publishes.** The operator reported ATLAS stuck on Term 2 while EnrollPro shows
Term 1. Verified: `GET {ENROLLPRO_API}/integration/v1/active-term` returns
`{"activeTerm":"T2","activeTermLabel":"TERM 2","termFormat":"TRIMESTER","schoolYearId":10}`, while
EnrollPro's **dashboard** (reached through the ATLAS↔EnrollPro SSO) renders **`TERM 1`**. ATLAS is
mirroring the endpoint faithfully — this is **not** an ATLAS cache or resolution bug. The published term
dates make T2 date-correct for today: T1 ends **2026-09-19**, T2 starts **2026-09-20**, so the term
rolled over on 2026-09-20 (ATLAS's snapshot cached on 2026-09-18 recorded `activeTerm: T1`, consistent
then). EnrollPro therefore has two disagreeing notions of "active term" (UI selection vs date-derived
endpoint), and the same data labels the year `2031-2032` while its term dates are all 2026. Written up
for the EnrollPro owner in
`docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` **§5** with the evidence, the required
contract and four acceptance tests. **No ATLAS change is warranted** until they say which notion is
authoritative.

**Integrated: `ZONING-CLARITY-C01`** (`10716aa1`, 2026-09-22) — LOW, copy-only. The same concept was
called **"Zone / Annex"** where a scheduler configures it and **"Campus zone concentration"** in the
warning, and nothing anywhere said what a campus zone is *for*. Now **one vocabulary ("Campus zone")**
across the room config label, the room-list badge tooltip, the section details sheet, the diagnostics
heading, the warning title, the rail label and the publish-readiness label; the config input gained one
plain-language help line; and the warning's title/meaning/action are decidable **without** reading the
server message ("Most classes are in one campus zone" / "More than half of this term's zoned classes
sit in the same campus zone." / a concrete move-or-accept step). No behaviour change, no server file.
client-suite **846/846**, build exit 0. **Not deployed** — it rides the next release that carries it.

**Integrated: `ZONE-IMBALANCE-PRECONDITION-C01`** (`47081de3`, 2026-09-22) — MEDIUM, one fresh QA
`ACCEPT_READY` **7/7/0/0**. The operator asked whether `ZONE_IMBALANCE_WARNING` should simply be
deleted; the measurements said the **warning as written was a false positive, but the feature is
real**. Live run 315 carried **3** rows, all `zone: UNSPECIFIED`, `percent 100`, `920 of 920` — and
**0 of 103 rooms have a `building_zone_id`**, so every entry fell into one bucket and the warning
merely restated an unset configuration field (its own action text, "rebalance rooms across configured
zones", was impossible to follow). It is **not** dead code: `BuildingPanel.tsx` edits
`buildingZoneId`. So the fix is a **precondition, not a deletion**: unzoned entries are excluded,
**≥2 distinct configured zones** are required, the >50% threshold is computed over the **zoned**
denominator, and the message states that denominator. QA proved it on the **real** run-315 data — old
logic **3** warnings (matching the stored rows field-for-field), new builder **0** — and a ≥2-zone
case built from the same real shapes fires exactly one warning at **66.67% (100 of 150 zoned)** with
100 resolvable `entryIds`. The `UNSPECIFIED` suppression is **kept** so stored rows stay suppressed,
and **no warning code was deleted** from any list. Gates: server-suite **283/283**, server-db
**53/53**, client-suite **845/845**, both builds, `git diff --check`. No live/runtime/data action.

**Integrated: `TEST-GATE-COVERAGE-C01R2`** (`95895430`, 2026-09-22) — LOW, test-only. The
`test:server-db` flake is **root-caused and fixed**. It was never flaky assertions: each affected
suite dropped its disposable database **once**, swallowed the refusal, and then failed its own
**zero-residue assertion** (`AssertionError … the disposable database must be dropped (zero
residue)`), so a file whose real assertions all passed was reported red. Fixed with one shared helper
(`src/__tests__/helpers/drop-disposable-database.ts` — bounded retry with backoff, fail-closed name
guards) used by **all seven** affected suites, plus the same retry in the second harness
(`helpers/tt-source-freshness-db.ts`) that the executor surfaced as an out-of-scope twin. The
zero-residue assertions are **intact** — genuine residue still fails loudly; only the race is removed.
Verified: `test:server-db` **7 consecutive green runs** (53 pass / 0 fail / 0 skipped, exit 0, residue
of own 0); `test:server-suite` **275/275**; guard 1/1; build exit 0. No product source changed.

**Integrated: `TEST-GATE-COVERAGE-C01R`** (`1e3190cf`, 2026-09-22) — LOW. `test:server-db` now runs a
committed **per-file isolation runner** (`atlas-server/scripts/run-db-suite.mjs`): one fresh
`atlas_restore_drill_<yyyymmdd>_<suffix>` database per file (the repo convention several suites
assert), built from a `migrate deploy` template, dropped in `finally` with a bounded retry, with
zero-residue proof and a dated `KNOWN_RED` rule (currently empty). Root causes fixed: cross-suite
interference (the suites were written for their own database), the database-name guard, missing seed
rows, and one **docs-side** defect — `docs/verification/**` was outside the `.gitattributes` LF
policy, so a Windows checkout materialised CRLF bytes (4811) while the sidecar pinned the LF bytes
(4621, SHA `d1d8e74e…`); the artifact now materialises at its pinned bytes and E9 passes **82/82**.
Verified at review: `test:server-db` **53 pass / 0 fail / 0 skipped, exit 0**; `test:server-suite`
**275/275**; guard 1/1; no product source changed. **Caveat — the full DB run is intermittently
flaky:** three earlier full runs showed 1–2 failures in a *varying* small set
(`term-cache-catchup-rrtc01`, `tt-source-freshness-generation-c04`, `curriculum-decision-candidates`),
each of which passes alone through the same runner. Follow-up `TEST-GATE-COVERAGE-C01R2` must
root-cause that intermittency — **do not mask it with retries**.

**Integrated: `TEST-GATE-COVERAGE-C01` (server half)** (`f9c0f3cb`, 2026-09-22) — LOW, planner-reviewed;
**custody transfer recorded** (Lane A took `atlas-server/package.json` for this stream while Planner B
was on QA; Planner B remains its owner afterwards). Server orphans **80 → 0**: `test:server-suite`
(28 files — the 27 hermetic plus the new guard) and `test:server-db` (53 DB-backed). An **inverse**
reachability guard now covers `atlas-server`, mirroring the client one, so a new server test file no
script runs fails. The one rotten suite (`derived-demand-correction-c01r.test.ts`, controls 5/7/10 —
stale hand-built prisma mock) was fixed **test-only** (3 mock lines, zero assertion changes, no product
bytes) and `test:server-suite` is **275/275**. **`test:server-db` is gated but RED — never treat it as
green.** Measured at review with the full runtime env against a fresh disposable database: 250 tests,
239 pass, **10 fail**; the failures are real rot, not cross-suite interference
(`teaching-load-reconciliation.test.ts` fails **alone** against a fresh DB:
`TypeError: Cannot read properties of undefined (reading 'facultyId')` at `:1032`). Follow-up
`TEST-GATE-COVERAGE-C01R`: characterise the prerequisites and/or run each file against its **own**
fresh database, then fix or retire the failures. No product source changed.

**Integrated: `TEST-GATE-COVERAGE-C01` (client half)** (`1ce9f4ad`, 2026-09-22) — LOW, planner-reviewed,
**no release needed** (test-only + a `package.json` script entry; the live release stays `d4c9f391`).
Adds `test:client-suite` naming all **92** client test files (was 37) and an **inverse** reachability
assertion in `gate-reachability.test.ts`, so a new client test file that no script runs now fails the
guard. Measured: client orphans **55 → 0**; `test:client-suite` **846/846**, ~12 s; the guard was
verified by an independent negative control (probe file → guard fails naming it → probe removed →
passes). The **server half is open and larger** — 94 test files, only 14 gated, **80 unreachable** —
and is handed to Planner B because `atlas-server/package.json` is their file:
`docs/handoffs/test-gate-coverage-c01-server-half.md` (full list + suggested approach). The gap is
**ongoing**, not historical: Planner B's `timetable-scheduler-simplicity-c01.test.ts` (added
2026-09-22) was already an orphan and is now covered by the client suite. This is the **inverse** of
their integrated `TEST-GATE-REACHABILITY-C01` (`f4462374`, scripts → absent files); nothing previously
checked files → scripts.

**Integrated and live: `COMPANION-SSO-REVERSE-IDENTITY-C01`** (release `d4c9f391`, 2026-09-22).
ATLAS → EnrollPro (reverse) SSO now works end to end: the assertion sends `subject` + `employeeId`
(never a local numeric `userId`) and **omits** empty names, which is what EnrollPro's schema
requires; it fails closed typed-403 (`COMPANION_SSO_IDENTITY_EMPLOYEE_ID_UNAVAILABLE`) when
`employeeId` is missing. Pre-action review `ACCEPT_READY` 17/17/0/0; mounted suite 21/21 on a
disposable DB; zero-write proven by a whole-database post-cutover timestamp scan (only the disclosed
auth rows). **EnrollPro → ATLAS (normal) is `BLOCKED(COMPANION_CALLBACK_MISCONFIGURED)`** —
EnrollPro's `ATLAS_SSO_CALLBACK_URL` points at ATLAS's SPA *result* path instead of
`/api/v1/auth/enrollpro/callback`; **send-ready** handoff
`docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` (self-contained — the EnrollPro
developer needs nothing from this repo; the fix is one env value plus a restart, no PR), evidence
`docs/reviews/companion-sso-reverse-identity-c01/evidence.md`. The stream packet's "Defect B" was a
**misattribution** — the reverse assertion has never sent a numeric `userId`.

**(superseded) Live release was `d92facfa`** (deployed 2026-09-21/22; supervisor 17828; `5001`->34964; `5174`->344;
entry `index-DgF0ZSEz.js`, 456,064 B; `D:` 31.33 GiB) and it is **ACCEPTED 7/7, U1–U6 6/6/0/0** by
independent post-action QA. It carries **`TIMETABLE-UX-REHAUL-C01R`** — the relaxed Simple shell: a
persistent sub-nav (so `/timetable/{setup,policies,runs,exports}` are reachable; they were URL-only),
one status surface, exactly one solid primary per state, the F-07 repeated-grade removed from the
grid cell, and one `h1` per surface. Client review `ACCEPT_READY` 18/18 (`f2ea0d4a...6d0aab46`). It
also carries Planner B's **`ROLLOVER-YEAR-IDENTITY-C01`**, which had **no committed review verdict**;
the release's opening gate reviewed that delta alone before any runtime action and returned
`ACCEPT_READY` 22/22/0/0. Evidence
`docs/reviews/release-timetable-ux-rehaul-c01r-20260921/deployment-evidence.md`. Rollback: incumbent
`ecff1d7e` startable at `D:\ATLAS-runtime-supervised-ecff1d7e-20260921`; **not executed**. One
authorized login for the program (`audit_logs` **862**, actor 46); the QA session logged in zero
times. **The release queue is empty.**
Successors recorded, not fixed: clean-load API GETs 20 vs 19 baseline; the Review-issues panel's
uppercase `SOFT`/`HARD` badges (pre-existing); the status region still draws three visual lines
(F-03 reduced, not a single row); sub-nav links 24 px (WCAG minimum, below the 44 px ideal); React
Router element-less-children console warnings on `/timetable*` (pre-existing). The previously
orphaned suites `ux-r02-simple-stripdown`, `ux-quickfix-c01-header-actions` and
`ux-r01-shared-chrome` are now gated by the new `test:timetable-ux-rehaul` script.

**Integrated:** `TEST-GATE-REACHABILITY-C01` (`f4462374`) — reviewed LOW and merged 2026-09-21
(`atlas-server/package.json` only, 32 orphaned scripts removed). Proof of no gate loss: all 29
referenced test files are absent, **no surviving script references a removed script name**, and
`git diff --check` is clean.

**(superseded) Live release was `ecff1d7e`** (deployed 2026-09-21; supervisor 26972; `5001`->26724;
`5174`->31148; entry `index-CbCvgFxw.js`, 456,046 B; `D:` 32.83 GiB) and it is **ACCEPTED 6/6/0/0**
by independent post-action QA. It carries the units fix plus Planner B's
`ACTOR-SCHOOL-MUTATIONS-C02` — whose missing independent review was closed by the pre-action gate
(`ACCEPT_READY` 15/15, with a failing-first control proving the DELETE route previously had **no**
actor-school check and defaulted to `?? 1`). The previously failing D6 assertion now renders
`...180 consecutive teaching minutes...` at both viewports; zero unexplained writes; one login
(`audit_logs` **860**) disclosed with a proven logout. **The release queue is empty again.**
The superseded `d3e9dfef` release is history: D1-D5 passed, D6 failed on a bare unit, and the root
cause was a test fixture **invented with the correct text already in it** — the rules that came out
of it are in `AGENTS.md` §11 (fixtures come from the real surface; record an artifact's byte
encoding).
**Verified fixed — do not spend a lane on it:** the public published-view ×3 term duplication
(a live probe returns 920 entries for exactly one term, never 2,760).

**Integrated: the false-gate cluster** (`0758075e`). Three client `test:*` scripts were **false
greens** — `tsx --test` silently ignores a path that does not exist, so a gate naming deleted files
still exits 0:
- `test:ux-guardrails` named two files removed by `4794bd9e` and reported **21/21 green from one
  third of its intended coverage** (measured);
- `test:auth-session` and `test:timetable-conflict` named **only** missing files and ran **nothing
  at all** while exiting 0.
Fixed by repointing the guardrails gate at the live files covering the same areas, removing the two
dead entries, and adding `atlas-client/src/lib/__tests__/gate-reachability.test.ts`, which fails if
any `test:*` script names a file that does not exist. Failing-first: the guard listed all three dead
paths before the fix; fixed gate **30/30**, preservation `test:timetable-operator-ux` **58/58**,
typecheck clean.
**Coverage gap this exposed (successor, not fixed):** the two sources
`atlas-client/src/lib/timetable-live-conflict.ts` and
`atlas-client/src/components/timetable/TacticalSandboxDock.helpers.ts` **exist but have no test** —
their test files were among those removed. The `auth-session` subject is unclear; candidates that do
exist are `actor-school-session-epoch.test.ts` and `session-scope-late-discard.test.ts`.

**Repo-wide sweep for the same class (read-only, 2026-09-21).** Checked every `test:*` script in
the root, `atlas-server`, `atlas-client` and `ops` manifests for a named path that does not exist.
Two more, both in the **root** manifest and **both a different, benign class**:
`test:login-ui-parity -> qa-artifacts/login-ui-parity-check.mjs` and
`test:visual:faculty -> qa-artifacts/playwright/specs/faculty-full-matrix.spec.ts`. `qa-artifacts/`
is deliberately `.gitignore`d (with a `!qa-artifacts/` re-include, and a few files tracked), so
these name **local-only** artifacts: they cannot run from a fresh clone and **must never be cited as
repo evidence**, but they are not false greens in the client sense (those named *tracked* test files
that had been removed). Recorded, not fixed — fixing them needs a decision (track the artifacts, or
mark the scripts local-only).

Recorded successors: the `FACULTY_FLOOR_TRANSITION` legacy stored-message phrasing
(`(14:30->14:30) with only 0 minutes gap`) is a stored-data artifact, not a formatter job;
`parseSchoolId` is now dead code in `runtime.router.ts`.

**Integrated: `WARNING-READABILITY-C01`** (`b6b4033f` + correction `f13d4cb9`) — merged 2026-09-21.
Source only: every one of the **25** live `VIOLATION_CODES` (the packet's `~46` was stale) now has
operator-facing copy, and the raw-code/bare-number leaks are closed on the real surfaces — the
review found `ExplainabilityDrawer` rendering `{violation.message}` verbatim, and the correction
also caught `ManualEditPanel` doing the same. Two client/server test files are now gated by
committed `package.json` scripts. **This change is NOT deployed**, so the packet's §5 browser row
is carried as **`DEFERRED(DEPLOYMENT_ACCEPTANCE)`** and must be run at `1366x768` and `390x844`
with the `window.location.origin` assertion by the next release that carries it. Note the packet's
premise was partly stale: R3/R4/R5 and R6's floor fix were already satisfied by earlier cycles and
were verified, not redone.

**The generation/publication core is already met — do not chase the term-cache apply.** Corrected
2026-09-21 after a wasted cycle: the active year's ordered-term cache was **applied on
2026-09-18** (mirror **551**, `termContractCachedAt 2026-09-18T04:51:01.797Z`,
`TERM_CACHE_SYNC_APPLIED` = **2**), `GenerationRun` = 4, and **published run 315 / revision 42
already carries zero HARD violations** with 335 acknowledged SOFT rows. The "term-cache apply
remains locked and unbound" line elsewhere in the older material is **stale**; a fresh preview on
the live runtime is expected to return `ALREADY_CURRENT` → no write. A packet
(`docs/prompts/term-cache-catchup-apply-2026-09-21.md`, r1) and a pre-action review were spent on
that stale premise — that is the cost of trusting an undated blocker line, and the reason for the
"verified at" marker rule.
