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
- **Release SHA: `ad8f9717`** (**LIVE** since 2026-09-25 17:12, Lane C; `E:\ATLAS-runtime-supervised-ad8f9717-20260925`;
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
  `E:\ATLAS-runtime-supervised-e475c673-20260925`. **Acceptance PARTIAL — owner: Lane B (Codex)**; browser rows
  are in the Risks sections of `docs/handoffs/lane-c-post-publish-c01.md`,
  `lane-c-teaching-load-clarity-c02.md` and `lane-c-schedule-clarity-c03.md`.
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
- `E:` is under its 50 GiB warning: authorize the release-directory retention reclaim before the next build.
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

Opened 2026-09-25 (operator). Branches `work|docs/lane-c-*`, worktrees `E:/ATLAS-worktrees/lane-c-*`. Earlier
2026-09-25 work (skills, worktree reclaim C02/C03, `D:/ATLAS` reset, SERVER-TIMING-C01) is in this section's Git
history. **Planner handoff: `docs/handoffs/lane-c-planner-handoff.md`.**

**Stream: audit fixes C1–C3** (from `docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md`).
All three **ACCEPT_READY** as of 2026-09-25: C2 `d66510ea`, C3 `07a3e5f7` (QA), and C1 `50b8077c` after an
independent startup run (build, Node bound isolated 5198, unauthenticated preview POST 401, stopped, port clear).
**Integrated 2026-09-25** on `integration/lane-c-c01-c03` off `main` `1b371ba`, `--no-ff` C2, C1, C3, then
`docs/lane-c-planner-handoff`. Merged tree: `test:client-suite` 955/970 (the same 15 failure names as base
`1b371ba`, 914/929); candidate tests 8/8, 12/12, 21/21; server `tsc` exit 0, Node started `dist/server.js` on
isolated 5198 (health 200, preview 401, stopped); client `vite build` with `VITE_ENROLLPRO_URL` exit 0.

**Next action:** Lane A deploys the `main` tip carrying this line (client + server; no migration). Browser
acceptance owner: **Lane B (Codex)**, rows in the Risks sections of `docs/handoffs/lane-c-post-publish-c01.md`,
`lane-c-teaching-load-clarity-c02.md` and `lane-c-schedule-clarity-c03.md`.

**Open (2026-09-25):** read the stall lines once a release containing `a5550fa6` is live (`89295c27` is), then fix
the roughly 8 s `/timetable` stall; A3, 0 class advisers, needs a read-only EnrollPro check.

## Lane A — current lane (written only by Lane A)

**Stream: `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` (D1–D11 locked) — C1–C7 COMPLETE; release
`066da7a7` LIVE 2026-09-25.** The scheduler is the single place that accommodates teacher
preferences/availability (draft and post-publish); SMART holds a teacher-scoped opt-in draft read; the
ATLAS teacher portal is removed. Plan + cycle queue:
`docs/plans/teacher-concern-authority-plan-2026-09-24.md`. Full cycle narrative:
`docs/handoffs/planner-session-handoff.md` (2026-09-25).

**Next action — finish browser acceptance (Lane A, custody transferred):** `ff87b06b` is LIVE with the C1
active-term fix; post-action QA `ACCEPT_READY` 8/8. Lane A's seeded-session pass (2026-09-25) **cleared the
C7 blocker**: `/faculty/concerns` GET 200 and **PUT 200 with `termIndex 2` (`status: DRAFT`, v1) — no
`409 TERM_SCOPE_MISMATCH`** (UI "Draft Term 2 · v1"). D6 removal **PASS**: all three `/my/*` routes
redirect to `/`, `/my`, `/faculty/concerns`, `/faculty/preferences`, `/faculty/room-preferences` resolve,
desktop nav clean, zero console errors. The availability-domain drift is shown ("Teacher availability
changed since this run was generated"). Outstanding for a structured pass: the seven-domain map + explicit
"Regenerate to apply" on `/timetable` (the current run is published, so the affordance is not on the
surface), the published view-only state, D6 mobile bottom-nav detail, and audit findings 2/3/4/6/7
(2 likely addressed — no Generate button on the published view; 3 mostly — 20/21 warning triangles carry
an accessible name, 1 unlabelled; 4 still open — 12 px text present; 6/7 need the draft+published
structured pass). Disclosed UI mutation: one `DRAFT` availability (faculty 1 / year 10 / term 2, v1, zero
slots) created by the save — test data, no delete route, harmless.

**Dated blockers / open residuals (verify before acting):**
- C7 (`066da7a7`) **acceptance INCOMPLETE** — `0/1/3/0`; **BLOCKED (b)** on `409 TERM_SCOPE_MISMATCH`
  (S2 client live T2 vs S1 server frozen persisted T1). Root cause: the persisted active term is **frozen
  by design** (option A unsatisfiable). **Resolved in source by `ACTIVE-TERM-LIVE-RESOLUTION-C01`**
  (candidate `72de00da`, QA `ACCEPT_READY` 9/9/0/0): the availability authority now resolves the active
  term **live-first with a date-derived fallback**; the client already resolves T2, so they agree.
  **Stage-1 divergence:** generation/publication transactions still resolve the persisted T1 (a live fetch
  inside Serializable/advisory locks is unsafe) — Stage 2 must pre-resolve at those entry points. Deploy
  to make it live, then re-run the acceptance. The `201` incident is closed (no shared-data mutation).
- `resolvePublishedRunTermIndex` resolves official export terms from the base snapshot, not the
  effective identity override (F1) — close before any `orderedTermContract` override is applied live
  (2026-09-25).
- Availability drift repair href is `/faculty`, not the new `/faculty/concerns` (F2, 2026-09-25).
- `qa-artifacts/playwright/specs/client-route-smoke.spec.ts` still names the removed `/my/*` routes — D6
  cleanup follow-up (2026-09-25).
- Host-proxy 502 and offline term-cache staleness remain dated 2026-09-24 observations in the handoff;
  unowned.
- The undated 2026-09-20 "what actually remains" queue was deleted 2026-09-25 (Lane C closed every item
  with evidence).

**Worktrees (2026-09-25):** Lane A's C5/C6 worktrees and `g9g10-grid-delta-probe` were retired
non-forced after unlinking their `node_modules` junctions; branches retained (`probe/g9g10-grid-delta`
confirmed on origin). `timetable-scheduler-simplicity-c01` is **preserved** — it is dirty
(`package-lock.json`, `package.json`, its test, `roomPreferenceCollaboration.ts`, untracked
`test.out`/`test.err`).

**C7 deployment artifacts (2026-09-25):** release dir `E:\ATLAS-runtime-supervised-066da7a7-20260925`
(live); this docs worktree `E:\ATLAS-worktrees\c7-teacher-concern-deploy` (branch
`docs/c7-teacher-concern-deploy`) is `RETIRE_AFTER_INTEGRATION`; the retired S8/C5/C6 worktrees' branches
are retained. `E:` 57.9 GiB free.

- **TERM-AUTHORITY-REFRESH-C01 option A is unsatisfiable (2026-09-25):** the persisted
  `EnrollProSchoolYearMirror.termContractCache.activeTerm` is **frozen by design** — `semanticRevision`
  excludes the active term, so both `applyTermCacheSync` and `syncActiveTermContractAuthority` are
  zero-write replays when only the active term moved (live and persisted revision both `e0dba8dc…`).
  Revised options: **(C1) resolve the active term LIVE at read time** in `academic-term.service.ts`
  (correct; moves generation/availability/readiness to T2 together) — recommended; **(B)** align the
  client to the frozen server term (writes T1, a past term) — stopgap only. Packet marked BLOCKED.

**C1 integration (2026-09-25):** `ACTIVE-TERM-LIVE-RESOLUTION-C01` candidate `72de00da` (QA
`ACCEPT_READY` 9/9/0/0) merged on the integration boundary; merged-tree gates active-term 7/7,
faculty-availability 12/12, server-suite 323/319/4 (pre-existing `tt-output-c03r`), server build +
`git diff --check` clean; `atlas-server/package.json` unioned. No migration/deploy/live-data action.
Stage-2 successor: pre-resolve the active term at the generation/publication entry points and thread it
into their transactions.
**Lane A second browser acceptance pass on `ff87b06b` (2026-09-25, seeded session):** C7 rows —
**(a) D6 PASS** (three `/my/*` routes → `/`; kept surfaces resolve; desktop nav clean; at 390×844 no `/my/*` links and no retired nav entries; zero console errors). **(b) PASS** (`/faculty/concerns` GET 200; **PUT 200 `termIndex 2` DRAFT v1, no 409**; "Draft Term 2 · v1"; Submit enabled; submit/review not exercised). **(c) UNVERIFIED (data state)** — the published run shows only school-information drift ("Check school information") and the Draft is empty ("Nothing is placed in this draft yet"), so no run-input drift banner or "Regenerate to apply" affordance was on either surface; `/timetable` showed teaching load / room / section / subject, and the concern workspace showed availability — not the full seven. **(d) PARTIAL** — published status renders and the destructive Generate is replaced by "New version", but grid cells remain `button "Select …"` with a pointer cursor (no drag handles); no revision create attempted (HIGH). **(e) PASS** (availability-domain drift reported). **Audit findings:** **2 ADDRESSED** (no Generate on the published view; "New version" instead); **3 PARTIAL** (20/21 warning triangles carry an accessible name; 1 unlabelled near "Working from saved data"); **4 OPEN** (12 px text prevalent); **6 OPEN/PARTIAL** (published cells look editable via "Select …" + pointer); **7 PARTIAL** (the More menu is now grouped "Daily tasks" / "Expert tools" / "Help & display" but the everyday tasks still sit under "More"); **9 ADDRESSED** (standalone "Term: Term 2"). **Correction lane target set:** findings 3, 4, 6, 7 (and re-verify 2/9). Disclosed mutation: one DRAFT availability (faculty 1 / year 10 / term 2, v1, zero slots). Browser closed; no other mutation.