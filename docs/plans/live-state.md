# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last reconciled: 2026-09-25 (Lane A).

## Writing protocol — three planner lanes share this file

This file is co-maintained so three planners can work in parallel without a custody defect. The
rules are what make that safe:

1. **Each lane edits only its own section** — `Lane A`, `Lane B` or `Lane C — current lane` —
   plus the `Live release` block **when it deployed**. Never rewrite another lane's section. If a
   merge conflicts inside another lane's section, **take theirs** and move on.
2. **Every blocker or "not done" line carries `as of <date>` and what proves it.** An undated
   pending line is a premise error waiting to happen (`AGENTS.md` §15): on 2026-09-21 a session
   spent a packet, an independent review and a dispatch on a term-cache apply that had already been
   satisfied three days earlier. **Before acting on any blocker line, verify it against the runtime
   or the database** — or delete it.
3. **Keep it short.** No narrative, no history, no per-transition register. Packets, evidence,
   handoffs and Git hold the detail.
4. Per-lane detail lives in each lane's own handoff: Lane A in
   `docs/handoffs/planner-session-handoff.md`, Lane B in its own handoff file, Lane C in its
   section below until a stream needs a handoff.

## Objective

Deliver a presentable live ATLAS demo for school 1 and active upstream school
year 10 (SY 2031-2032): correct Teaching Load, a dynamic term-aware timetable,
realistic official exports, zero HARD publication blockers, SMART-family visual
cohesion across the whole site, and direct two-way SSO with EnrollPro, SMART,
and AIMS.

Shared sections trimmed by Lane C on 2026-09-25 (operator instruction). Superseded release blocks,
resolved blockers and older acceptance notes are in Git: `git show 0b70ea0a:docs/plans/live-state.md`.

## Live release

- Tailnet: `https://njgrm.buru-degree.ts.net`
- **Release SHA: `861d89a2bc2682c5f875dde0b4b1d8ffc079b1fe`** (**LIVE** since 2026-09-26 01:27, Lane A;
  `E:\ATLAS-runtime-supervised-861d89a2-20260925`; execute audit
  `C:\ProgramData\ATLAS\release-audit\861d89a2-20260926-012633`; dry-run audit
  `C:\ProgramData\ATLAS\release-audit\861d89a2-20260926-012619`; active state `running`/`861d89a2`; machine env =
  target; health 200, ready 200 `database:"ok"`, DB-backed subjects read 200, Tailnet 200; startup log clean;
  served `assets/index-BW9wl1o-.js` byte-identical to the target build. Independent post-action QA
  `ACCEPT_READY` **8/8/0/0**; six-table zero-write digest unchanged; focused C02 13/13, PostgreSQL 6/6, C01 8/8,
  client term-gate 8/8, preservation failure set base-reproduced with zero candidate-only failures. **No migration.
  Rollback basis: `eb0e3038`.**
- **Release SHA: `eb0e30386336673a4a31ecfe39a9bef93549e0ed`** (rollback basis; previously LIVE 2026-09-25 22:19;
  `E:\ATLAS-runtime-supervised-eb0e3038-20260925`; prior Q4/A1 evidence preserved; **no migration.**)
- **Release SHA: `c5e167d7c5939ff586880149c566ce29506430e8`** (rollback basis; previously LIVE 2026-09-25 20:40,
  `E:\ATLAS-runtime-supervised-c5e167d7-20260925`; R1 browser rows accepted at 1366×768 and 390×844; prior
  collaboration-ticket incident preserved; two EnrollPro proxy 502s remain non-blocking. **No migration.**)
- **Release SHA: `ad8f9717`** (rollback basis; previously LIVE 2026-09-25 17:12, Lane C; `E:\ATLAS-runtime-supervised-ad8f9717-20260925`;
  operator cutover, audit `C:\ProgramData\ATLAS\release-audit\ad8f9717-20260925-171136`; active state
  `running`/`ad8f9717`; machine env = target; health 200, `/health/ready` `database:"ok"`, subjects read 200, Tailnet
  200; served `assets/index-DEoaxzaH.js` byte-identical to the build). **Browser acceptance: UNPERFORMED as of
  2026-09-25** — the operator generated draft run 318 before the demo, so `/timetable` opens an unpublished draft
  and the published teacher-leaving rows (B1 commit, B2 refusal) no longer apply to the screen; see the Lane C
  handoff `docs/handoffs/lane-c-handoff-2026-09-25-stall.md`.
  `DEPARTURE-LOAD-C05`: a privileged teacher change on the published timetable moves the class's subject+section
  Teaching Load ownership to the new teacher in the same transaction as the revision (receiver department/program +
  active checks; audit carries `teachingLoadTransfers`); already-authorized receivers transfer nothing; the
  teacher-leaving check shows teacher-caused refusals; server error codes are read from real axios errors (also
  fixes the stale-source message in four consumers). Commits `463cd9fa` + corrections `e6aeff4f`, `ad8f9717`;
  integrated as merge `6e992878`. Independent review `ACCEPT_READY` (2026-09-25, after two bounded corrections).
  **No migration.** **Rollback basis: `82871619`.** Operator decisions (2026-09-25): ownership moves at scheduling
  time, not on the effective date, and withdrawing the revision does not revert Teaching Load — **accepted**; one
  live teacher-leaving commit on test data (Tolentino → Villanueva, Jose Gabriel) is **approved** for acceptance.
  Browser acceptance owner: Lane C.
- **Release SHA: `82871619`** (**LIVE** since 2026-09-25 14:41, Lane C; `E:\ATLAS-runtime-supervised-82871619-20260925`;
  cut over by the operator via `deploy-runner.ps1 -Execute` (audit
  `C:\ProgramData\ATLAS\release-audit\82871619-20260925-144036`); active state file `running`/`82871619`; machine
  `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = target; health 200, `/health/ready` `database:"ok"`,
  `GET /api/v1/subjects?schoolId=1` 200, Tailnet 200; served `assets/index-DnEOPehP.js` and `index-BBttqTpl.css`
  SHA-256 byte-identical to the build). **Browser acceptance (Lane C, 2026-09-25): 3 passed / 1 blocked /
  1 unperformed** — Step 4 with 20 clashes scrolls by mouse wheel, footer visible; Tue MATH ↔ Thu ENG (GR7 Luna,
  T2) now shows only the real Aquino clash (no self-section/room clash), Tue ↔ Thu MATH clean; preview zero-write
  (revisions/runs/manual-edits hashes identical). **Blocked:** Step 5 unreachable — every replacement for
  Tolentino fails HARD `FACULTY_SUBJECT_NOT_QUALIFIED` because no other teacher holds her subject+section
  Teaching Load assignments (authority by design; the published teacher-leaving flow needs Teaching Load
  reassigned first). **Unperformed:** room-name clash in browser (no room clash arose; unit-proven).
  `DEPARTURE-SWAP-C04`: teacher-leaving Step 4/5 scroll; a published swap only pairs classes in the same term
  (client) and the server refuses cross-term swaps (422 `SWAP_TERM_MISMATCH`); clash text names rooms. Integrated
  on `main` as merge `bc2608d6` (code tree identical to `82871619`). Independent QA `ACCEPT_READY` 7/0/1
  (2026-09-25). **No migration** (no `prisma/**` change). **Rollback basis: `ff87b06b`**. Deviation (2026-09-25, operator-directed
  pre-demo release): `E:` at 47–49 GiB (< 50 GiB warning) and the release-directory reclaim was **not** run
  before this build; it is Lane C's first action after the demo.
- **Release SHA: `ff87b06b`** (rollback basis; previously LIVE 2026-09-25; `E:\ATLAS-runtime-supervised-ff87b06b-20260925`;
  supervisor-owned 5001→51652 / 5174→36128; health/ready (`database:"ok"`) + `GET /api/v1/subjects?schoolId=1`
  + Tailnet 200; served entry `assets/index-CqO3DnVa.js` (SHA-256 `7ADDAACA…81171A`, byte-identical to the
  build); machine `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = the target). `ACTIVE-TERM-LIVE-RESOLUTION-C01`:
  the availability authority resolves the active term live-first with a date-derived fallback (deployed read
  `resolveActiveAvailabilityTermIndex(1, 10)` → `termIndex 2` while the persisted snapshot still names `T1`).
  Cut over by the SHA-pinned `ops/runtime/deploy-runner.ps1` (audit
  `C:\ProgramData\ATLAS\release-audit\ff87b06b-20260925-141126`). **No migration** — no `prisma/**` change in
  `e8553752..ff87b06b`, applied count stays 11. **Rollback basis: `e8553752`** at
  `E:\ATLAS-runtime-supervised-e8553752-20260925` (start-in-place; compatible). **Deployment verified;
  acceptance pending — browser acceptance owner: Lane A** (custody transferred; seeded profile). Packet:
  `docs/prompts/active-term-deploy-2026-09-25.md`.
- **Rollback basis: `e8553752`** (previously LIVE 2026-09-25; `E:\ATLAS-runtime-supervised-e8553752-20260925`;
  supervisor-owned 5001→60756 / 5174→86968; health/ready (`database:"ok"`) + DB-backed read + Tailnet 200;
  served entry `assets/index-CqO3DnVa.js` (SHA-256 `7ADDAACA…81171A`, byte-identical to the build) and CSS
  `index-BBttqTpl.css` byte-identical; machine `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = the target). Lane C
  C1–C3: C1 post-publish clash check (read-only `…/published-revisions/preview` and `/swap/preview` — the
  preview returns before the first write and the caller throws if the outcome is not a preview), C2 Teaching
  Load clarity, C3 schedule clarity (published-entry change panel, swap arming/highlight, draft-view hygiene,
  `searchable-select` a11y). **No Prisma, migration, generation, publication, or timetable-data change.**
  Client-only regression baseline verified independently: full client suite 970 / **955 pass / 15 fail**, the
  same 15 failures (identical assertion set, same 10 files) reproducing on base `e475c673` — no candidate-only
  failure. Cut over by the SHA-pinned `ops/runtime/deploy-runner.ps1` (audit
  `C:\ProgramData\ATLAS\release-audit\e8553752-20260925-130313`). **Deployment verified:** fresh independent QA
  `PLANNER_DECISION_REQUIRED` 6/7 — row 5d (authenticated live zero-write) is
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`; the planner accepted the structural zero-write proof (preview
  returns before any create/update/delete; caller asserts the preview outcome) plus the 401 gate control; no
  BLOCKING finding. **Rollback basis: `e475c673e85fc8ca5a1bb055a7ff1819094b7d41`** at
  `E:\ATLAS-runtime-supervised-e475c673-20260925`. **Browser acceptance run 2026-09-25 by Lane C (reassigned
  by the operator): passed 10 / blocked 1 / unperformed 0 / NEEDS_SESSION 0**, including row 5d (authenticated
  zero-write, API level). Blocked: C3-1 (no free slot exists in the live data). Four NON_BLOCKING findings
  (F1 suspect swap-preview clash, F2 Draft prompt leak, F3 swap panel stays open, F4 EnrollPro 4 s timeout). Evidence:
  `docs/handoffs/lane-c-browser-acceptance-e8553752-2026-09-25.md`.
- **Release SHA: `e475c673`** (rollback basis; previously LIVE 2026-09-25; `E:\ATLAS-runtime-supervised-e475c673-20260925`;
  supervisor-owned 5001→81040 / 5174→82788; health/ready (`database:"ok"`) + DB-backed read + Tailnet 200;
  served entry `assets/index-B6GQrEV1.js` (SHA-256 `A90EA8DB…`, byte-identical to the build) and CSS
  `index-DHL7imL_.css` byte-identical; machine `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = the target). C08
  scheduler clarity (client only): a plain-language stale-information notice with one **Check school
  information** action promising the schedule is unchanged, and descriptive collapsed grade/program shift
  schedules replacing anonymous `Override #n` blocks. **No server, Prisma, migration, generation, publication,
  or timetable-data change.** Cut over by the SHA-pinned `ops/runtime/deploy-runner.ps1` (audit
  `C:\ProgramData\ATLAS\release-audit\e475c673-20260925-123726`). **Deployment verified:** fresh independent QA
  `ACCEPT_READY` 6/6/0/0 (blocked 0, unperformed 0). **Rollback basis:
  `89295c2785153787f5f50c93b17d97f881012169`** at `E:\ATLAS-runtime-supervised-89295c27-20260925` (no
  migration; compatible). **Acceptance PARTIAL:** the authenticated read-only browser QA at 1366×768 and
  390×844 (stale-notice copy + single CTA, collapsed descriptive shift schedules, no console/network
  regressions) is `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` — **acceptance owner: Lane B (Codex)**.
- **Release SHA: `89295c27`** (rollback basis; previously LIVE 2026-09-25; `E:\ATLAS-runtime-supervised-89295c27-20260925`;
  supervisor-owned 5001→76676 / 5174→53516; health/ready + DB-backed read + Tailnet 200; rollback basis
  `b6687fee`; **no migration**). `SERVER-TIMING-C01` request timing / event-loop-stall diagnostics + the S6 E1
  test-only copy fix; client bytes unchanged from `b6687fee`. **Stall-diagnostics owner: Lane C** (reads the
  `[slow-request]`/`[event-loop-stall]` lines left in the supervisor log); **browser-copy acceptance owner:
  Lane B (Codex)** — scheduler copy/term/control contrast rows, separate and not yet run. Detail + cutover
  audits: `docs/handoffs/deploy-b6687fee-2026-09-25.md`.
- **Rollback basis: `b6687fee`** at `E:\ATLAS-runtime-supervised-b6687fee-20260925` (previous LIVE 2026-09-25;
  supervisor-owned ports reclaimed on restart; scheduler-clarity client release; **no migration**). Its Lane B
  browser rows (scheduler copy/term/control contrast at 1366×768 and 390×844) were separate and not yet run.
  Detail: `docs/handoffs/deploy-b6687fee-2026-09-25.md`.
- **Rollback depth: `066da7a7`** at `E:\ATLAS-runtime-supervised-066da7a7-20260925` (startable in place;
  carries the C5+C6 teacher-concern product and the applied migration `20260925000002_faculty_availability`;
  compatible). **Acceptance INCOMPLETE** — `passed 0 / blocked 1 / unperformed 3 / NEEDS_SESSION 0`; blocked
  on `409 TERM_SCOPE_MISMATCH` (client `resolveActiveSchoolYearContext` vs the server's persisted active
  term) — corrective lane `AVAILABILITY-TERM-ALIGNMENT-C01`. The collaboration-ticket `201` incident is
  closed (no shared-data mutation). Detail: `docs/handoffs/deploy-b6687fee-2026-09-25.md`.
- **Rollback depth: `37e0c85b`** at `E:\ATLAS-runtime-supervised-37e0c85b-20260925` (startable in place;
  supervisor-owned ports reclaimed on restart; carries the global native-scrollbar token policy and the S8
  shift-coherence guard (D11); applied `20260925000001_shift_coherence`; compatible with the additive
  `20260925000002_faculty_availability`). Detail: `docs/handoffs/deploy-b6687fee-2026-09-25.md`.
- **Rollback depth** (retention policy: live + two most recent accepted):
  1. `a5f7384e61a24059cdeaadbfa279969877838e0f` at `E:\ATLAS-runtime-supervised-a5f7384e-20260925` —
     compatible with the additive migrations.
  2. `002c88793212709468843c10fc69aa09eef0eb46` at `E:\ATLAS-runtime-supervised-002c8879-20260924` —
     retained beyond immediate depth; compatible.
  Every other `*/ATLAS-runtime-*` directory is beyond rollback depth: a retention-reclaim candidate, except
  the named last-resort artifacts (`docs/reference/agent-worktree-lifecycle.md`).
- **Acceptance debt (as of 2026-09-25):** `066da7a7`, `37e0c85b`, `a5f7384e` and `002c8879` each shipped
  with authenticated browser acceptance `PARTIAL (AUTH_SESSION_REQUIRED)`.

## Live data

- Database: `atlas_recovery_clean_rebuild_20260905` on localhost:5432. Active upstream year: 10; mirror row 551.
- Published run **317 / revision 43** (as of 2026-09-24): zero HARD, 289 acknowledged SOFT warnings;
  public surface `source.runId=317`, `activeRevisionId=43`, `snapshotState=FROZEN`, 920 entries.
- Building `gradeScope`: buildings 1–4 = `[7]`, `[8]`, `[9]`, `[10]` (HIGH apply accepted). Rollback: restore
  buildings 1–4 to empty integer arrays, then rerun the same preview.
- Regeneration and publication have not been authorized or executed since the grade-scope correction.

## Open items carried forward (unverified since the date shown — verify or delete before acting)

- SMART/AIMS direct federation (as of 2026-09-20): the runtime supports EnrollPro only; SMART/AIMS activation
  waits on companion-side routes, directional keys, deployment and live browser acceptance. Companion repos
  stay read-only; generate/install no directional keys until both sides consume the agreed names.
- Page-level UX (as of 2026-09-20): `UX-R02`–`UX-R05` open; `UX-R03c` (`/timetable/runs`, `/setup`,
  `/exports` sub-pages and chrome overrides) is the named successor.
- Double policy fetch (as of 2026-09-20, NON_BLOCKING): `SchedulingPolicyPane.tsx` and
  `useScheduleReviewWorkspaceState.ts` both GET `/policies/scheduling/{schoolId}/{schoolYearId}`; give it one owner.
- Host-proxy 502 `UPSTREAM_UNREACHABLE` / `read ECONNRESET` (observation O1, 2026-09-21): host-side, server-side
  cause uninvestigated. Findings: `docs/reviews/dup-read-diagnosis-c01/findings.md`.
- `uxc01-derived-setup-surface.test.ts` 1-of-4 red on a `navigation.ts` substring assertion (as of 2026-09-20);
  a LOW test-contract correction was queued.

## Operator decisions

- Whole-site UX converges on SMART's calm task-first identity while ATLAS keeps its complex Teaching Load and
  Timetable workflows.
- Direct two-way SSO is required for EnrollPro, SMART and AIMS. No account or role may be auto-provisioned or
  elevated through SSO. The operator authorizes generating the SMART/AIMS directional keys and ATLAS
  durable-env edits after reviewed source consumes the agreed names.
- Generation/publication require zero HARD violations; SOFT warnings stay explicit and auditable.
- Laboratory scheduling is optional for future beneficiaries and disabled for the current pilot.
- **Standing authorization (2026-09-20):** for this program the operator authorizes HIGH actions, deployment
  and browser acceptance without a per-action approval round-trip, provided every gate and test is retained
  (pre-action review, one executor, one fresh post-action QA, browser rows labelled, a real
  `passed/blocked/unperformed` tally). Standing authorization removes waiting, never evidence (`AGENTS.md` §13).
- **Three planner lanes (operator, 2026-09-25):** Lane A = opencode (primary; client timetable surface,
  deployment); Lane B = Codex (server lane; the browser agent acceptance is usually deferred to); Lane C =
  Claude Code. Disjoint file ownership, one runtime swapper at a time, one browser controller at a time.

## Decisions awaited (operator-facing, as of 2026-09-25)

- Give `37e0c85b` (acceptance owner: Lane B / Codex) and the C7 target an authenticated session (see `AGENTS.md` §12).
- `E:` reclaim C is **complete (2026-09-25)**: audited removal of `82871619` and `ff87b06b` freed 3.07 GiB; post-action E: was 47.80 GiB free and the current recheck is 49.55 GiB, still below the 50 GiB warning but above the 25 GiB fail-closed line. The §3 reclaim obligation is discharged for the `861d89a2` build; do not loop another reclaim for the same trigger.
- Keep or delete two unlanded code branches (both pushed): `work/public-published-view-term-merge-c01`,
  `work/timetable-live-term-authority-c01`.

## Lane B — current lane (written only by Planner B)

**e475c673 browser acceptance (2026-09-25): PARTIAL — passed 4 / blocked 0 / unperformed 1.**
Authenticated read-only browser QA at 1366×768 and 390×844 confirmed the current-schedule-unchanged
notice, exactly one **Check school information** action to `/timetable/setup`, descriptive collapsed
grade morning/afternoon schedules without `Override #n`, no document overflow, and no console errors.
The browser network-event stream produced no observable events after a fresh reload, so the network
regression row is **UNPERFORMED**, not passed. Non-blocking accessibility residual: visually collapsed
shared-accordion child inputs remain exposed to keyboard/AX. No scheduling data changed; the session
tab remains open. Evidence owner: Lane B (Codex).
Closure worktree: `E:\ATLAS-worktrees\lane-b-e475-browser-acceptance` is clean, merged, has no reparse
or process borrower, and is `RETIRE_AFTER_INTEGRATION` (E: 47.55 GiB before retirement).

## Lane C — current lane (written only by Lane C)

Opened 2026-09-25 (operator). Branches `work|fix|docs/lane-c-*`, worktrees `E:/ATLAS-worktrees/lane-c-*`. Finished
cycles are in Git history and their handoffs. Claude Code lanes follow `CLAUDE.md` (cost rules).

**Current stream: draft scheduler UX** (as of 2026-09-26). Server-stall stream closed (A1, 2026-09-25 15:11Z; see
the Live release block and `docs/handoffs/lane-c-handoff-2026-09-25-stall.md`).

**DRAFT-UX-C01 integrated on `main` as `9f42190e`** (2026-09-26, fast-forward of
`integration/lane-c-draft-ux-c01-20260926`; `origin/main..` held only the three accepted candidate commits and two
merges). Candidate `1670a611`, QA (Opus) `ACCEPT_READY` S1-S6 6/6, client-suite base 978/17 fail vs candidate 988/17
fail with the same names. Packet `docs/prompts/lane-c-draft-ux-c01-2026-09-25.md`; handoff
`docs/handoffs/lane-c-draft-ux-2026-09-26.md`. Client-only; no migration.

**Wait (as of 2026-09-26): release.** Operator chose **sequential** releases: the `861d89a2` cutover (other lane's
packet) first, then `docs/prompts/deploy-9f42190e-draft-ux-c01-2026-09-26.md` (HIGH, explicit operator approval;
rollback basis `861d89a2`). E: 50 GiB free after retiring worktrees `lane-c-draft-ux-c01`, `-int`, `-docs` (clean,
merged, no reparse/borrower; health + subjects 200) — still at the warning line; reclaim first. After the
release: D1 rows + QA NON_BLOCKING 1-2 via `atlas-browser-qa` on Claude in Chrome at 1366x768 and 390x844.

**Open (2026-09-25):** EnrollPro unreachable from the host — Tailscale `dev-jegs` offline since ~19:40 local;
`runtime/context`/`sections/summary` wait the 4 s timeout (not a loop block). F1–F3
(`docs/handoffs/lane-c-browser-acceptance-e8553752-2026-09-25.md`); A3 (0 class advisers); delete remote
`work/wonderful-sagan-nhz302`, `work/epic-galileo-cw0swp`; remote `docs/lane-c-*` branches cannot be deleted (repo rule).

## Lane A — current lane (written only by Lane A)

**Current stream (2026-09-26):** `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` C1–C7 is complete. The scheduler is
the single teacher-concern accommodation surface, SMART's draft access is teacher-scoped/read-only, and the ATLAS
teacher portal is removed. `ACTIVE-TERM-LIVE-RESOLUTION-C02` is source-accepted at `07804498`, integrated as
`861d89a2`, and now verified live; the previous `eb0e3038` release is the rollback basis.

**Completed acceptance (2026-09-25):** `ACTIVE-TERM-LIVE-RESOLUTION-C01` fixed the former C7
`409 TERM_SCOPE_MISMATCH`: Lane A's seeded browser pass returned `/faculty/concerns` GET 200 and PUT 200 at
`termIndex 2`, with D6 redirects and removed navigation verified. One disclosed test-data mutation remains: a
DRAFT availability for faculty 1 / year 10 / term 2 / v1 with zero slots.

**Deployment outcome (2026-09-26):** operator-authorized `861d89a2` cutover is **DEPLOYED**. Independent
post-action QA is `ACCEPT_READY` **8/8/0/0**: Q4's authenticated cold/warm readiness pair passed from the Tailnet
origin (first `cached=false`, second `cached=true`, `ran=true`, `zeroWrite=true`); Q1/Q2/Q3/Q5/Q6 passed; Q7 passed
C02 13/13, PostgreSQL 6/6, C01 8/8, client term-gate 8/8, with the preservation failure set base-reproduced and no
candidate-only failures. The executor handoff and QA addendum are recorded in
`docs/handoffs/deploy-861d89a2-2026-09-26.md`; the first eb/A1 incident and R1 browser evidence remain preserved
in their separate handoffs. No migration, generation, publication, availability/Teaching Load write, term-cache
apply, or rollover sync occurred. Reclaim C is `ACCEPT_READY` 25/25 pre-action and 17/17 post-action; the current
capacity recheck is 49.55 GiB on E: and 60.67 GiB on D:.

**Stage-2 source cycle (2026-09-26):** `ACTIVE-TERM-LIVE-RESOLUTION-C02` candidate `07804498` passed fresh QA
**8/8/0/0**, integrated as `861d89a2`, and is now the verified live release. It pre-resolves the active term before
generation/readiness/publication transactions, threads one term through preflight and snapshots, preserves
fail-closed codes, and keeps the network out of Serializable/advisory locks. No migration or live-data action
occurred.

**Next action (2026-09-26):** no required Q4/A1 work remains. Keep `861d89a2` live and `eb0e3038`/donor preserved;
any F1/F2 follow-up is a separate bounded cycle. The provider-memo and singleton-instrumentation QA evidence
residuals are non-blocking accuracy follow-ups.

**Dated decisions / residuals (verify before acting):**
- **F7 remains deliberately rejected (2026-09-25):** daily tools stay under More so the header remains compact;
  reverse only on explicit operator instruction.
- **Stage-2 source is integrated (2026-09-25):** `ACTIVE-TERM-LIVE-RESOLUTION-C02` `07804498` / `861d89a2`;
  deployment is a separate HIGH action. QA evidence residuals: the 30-second provider memo can make the production
  revalidation comment/cache-busting seam non-observable within one TTL window, and the publication no-fetch test
  instrumented the singleton rather than the injected client. Both are accuracy follow-ups, not blocking defects.
- `ad8f9717` browser acceptance is **UNPERFORMED (2026-09-25)** because the operator generated draft run 318; its
  published-teacher-leaving rows no longer describe the current screen. Acceptance remains separate from deployment.
- `UX-AUDIT-SIZE-C01` R1 fixed audit finding 4 in source (`fb245772`, QA 6/6/0/0, integrated `c5e167d7`); only
  the live pixel rows remain. Findings 3 and 6 are addressed on main; finding 9 was already addressed.
- **F1 published-export term derivation remains a separate cycle (2026-09-25):** it is a frozen C08 immutability
  surface, not part of C02. **F2 availability drift repair href** (`/faculty` → `/faculty/concerns`) is also a
  separate client-only cycle; neither is a blocker for `861d89a2`.
- Host-proxy 502/offline term-cache staleness remain unowned observations from 2026-09-24. The removed `/my/*`
  route smoke fixture remains a D6 cleanup follow-up as of 2026-09-25.

**Custody / workspace (2026-09-26):** Lane A owns the seeded browser profile and this docs worktree
`E:\ATLAS-worktrees\lane-a-r1-deploy-target` (`docs/lane-a-r1-deploy-target`, `KEEP_ACTIVE` as the current lane
record). The C02 executor and integration worktrees were clean, integrated, and retired. Live release
`E:\ATLAS-runtime-supervised-861d89a2-20260925` is `KEEP_ACTIVE`; rollback `eb0e3038` and donor `5c100ea6` are
`PRESERVE_FOR_DECISION`. Do not write in Lane B/C worktrees.
