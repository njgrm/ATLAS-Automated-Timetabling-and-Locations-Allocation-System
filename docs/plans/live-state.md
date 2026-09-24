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
- **Target release SHA: `066da7a7`** (**deployment-pending** 2026-09-25; release dir
  `E:\ATLAS-runtime-supervised-066da7a7-20260925`; program `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924`
  C5+C6 product; rollback basis `37e0c85b`; adds `20260925000002_faculty_availability`). Recorded before
  cutover per the `deploy-runner.ps1` gate; the incumbent bullet below remains the LIVE release until the
  cutover completes. Browser acceptance deferred to **Lane B (Codex)**. Packet:
  `docs/prompts/c7-teacher-concern-deploy-2026-09-25.md`.
- **Release SHA: `37e0c85b`** (**LIVE** since 2026-09-25; `E:\ATLAS-runtime-supervised-37e0c85b-20260925`;
  supervisor-owned 5001→63452 / 5174→26084; health/ready (`database:"ok"`) + DB-backed read + Tailnet 200;
  served entry `assets/index-qbOXyMnr.js` (SHA-256 `8372C342…D43B60`, byte-identical to the build); machine
  `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = the target). Carries the global native-scrollbar token policy
  and the S8 shift-coherence guard (D11). **Migration APPLIED** 2026-09-25 via the guarded runner to
  `atlas_recovery_clean_rebuild_20260905`: `20260925000001_shift_coherence` (`MIGRATE_GATE_OK`, backup
  `atlas-backup-atlas_recovery_clean_rebuild_20260905-20260924-181614.dump`, sha256 `5676cde9…`). Cut over by
  `ops/runtime/deploy-runner.ps1` (audit `C:\ProgramData\ATLAS\release-audit\37e0c85b-20260925-021830`).
  **Deployment verified:** fresh QA `ACCEPT_READY` 18/18/0/0. **Acceptance PARTIAL** — authenticated browser
  rows `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`. **Acceptance owner: Lane B (Codex)** — assigned by
  Lane A 2026-09-25; needs an operator-provided session (one `LOCAL_LOGIN_SUCCESS` + `last_login_at`).
- **Rollback depth** (retention policy: live + two most recent accepted):
  1. `a5f7384e61a24059cdeaadbfa279969877838e0f` at `E:\ATLAS-runtime-supervised-a5f7384e-20260925` — the
     rollback basis; compatible with the additive `37e0c85b` migration.
  2. `002c88793212709468843c10fc69aa09eef0eb46` at `E:\ATLAS-runtime-supervised-002c8879-20260924` —
     compatible (the `a5f7384e` migrations are additive with safe defaults).
  Every other `*/ATLAS-runtime-*` directory is beyond rollback depth: a retention-reclaim candidate, except
  the named last-resort artifacts (`docs/reference/agent-worktree-lifecycle.md`).
- **Acceptance debt (as of 2026-09-25):** `37e0c85b`, `a5f7384e` and `002c8879` each shipped with
  authenticated browser acceptance `PARTIAL (AUTH_SESSION_REQUIRED)`.

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

Lane B owns this section. Current stream and state: see Lane B's own handoff file. Lane A last saw
it complete `TEST-GATE-REACHABILITY-C01` (`f4462374`) and hand it over for integration.

## Lane C — current lane (written only by Lane C)

Opened 2026-09-25 (operator). Branches `docs/lane-c-*`, worktrees `E:/ATLAS-worktrees/lane-c-*`. Does not
write to Lane A's C5/C6 streams or any Lane B stream. Detail lives in Git history of this section.

**Done (2026-09-25):**
- Closed the undated 2026-09-20 "what remains" queue: every item is integrated or superseded on `main`
  except `work/public-published-view-term-merge-c01` (see Decisions awaited).
- Six cross-agent skills in `.agents/skills/` (+ `.claude/skills/` stubs); user-level `~/.agents/skills`
  cut from 188 to 5 (archive `~/.agents/skills-archive-20260925`).
- `D:/ATLAS` reset to `origin/main` after committing its only unique content (`72042911`); operator
  reference files moved to `stakeholderFiles/root-reference/`.
- Worktree reclaim C02 + C03: 37 task worktrees retired non-forced after per-tree evidence; dirty state
  saved on `preserve/<name>-20260925` branches; 26 unlanded/preserve refs pushed to origin; no branch
  deleted. `D:` 37.8 → 61 GiB, `E:` 36 → 48 GiB free.
- Shared sections of this file trimmed (1,414 → about 400 lines).

**Remaining worktrees (as of 2026-09-25):** Lane A's C5 set and C6 pair, plus two junction anchors they
depend on — `timetable-scheduler-simplicity-c01` (← `publish-drift-s4-client`) and
`g9g10-grid-delta-probe` (← `teacher-availability-s1`). Lane A retires all of them at its closure.
Three unregistered directories in `E:/ATLAS-worktrees` (`flag-window-per-scope-c01`,
`rollover-year-identity-c01`, `warning-readability-c01`) are clones or leftovers — the clone-removal
exception applies; untouched.

**Next action:** none dispatched; awaiting the operator.

## Lane A — current lane (written only by Lane A)

**Stream: `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` (D1–D11 locked).** The scheduler is the single
place that accommodates teacher preferences/availability (draft and post-publish); SMART holds a
teacher-scoped opt-in draft read; the ATLAS teacher portal is removed. Plan + cycle queue:
`docs/plans/teacher-concern-authority-plan-2026-09-24.md`. **Source C1–C6 is DONE on `main`;**
`origin/main` = `178c2929`. Full cycle narrative moved to `docs/handoffs/planner-session-handoff.md`
(2026-09-25).

**Next action — C7 (HIGH, not started):** deploy `178c2929` (or its successor) and run the two-viewport
browser acceptance. Preconditions: apply `20260925000001_shift_coherence` and
`20260925000002_faculty_availability` with the guarded runner (`npx tsx src/scripts/atlas-migrate.ts`
from `atlas-server`, runtime env loaded — never bare Prisma) after a fresh revalidated backup, then
`ops/runtime/deploy-runner.ps1`. **Acceptance owner for the deferred browser rows: Lane B (Codex)**,
which holds browser custody — hand it the release SHA and the acceptance rows; it records the result in
the Live release block. Rollback: the incumbent live release, startable in place (both migrations are
additive with safe defaults). The acceptance needs one scheduler login (`LOCAL_LOGIN_SUCCESS` +
`last_login_at` audit delta) — disclose it, never print credentials.

**Dated blockers / open residuals (verify before acting):**
- C7 migration + deploy HIGH gate not yet executed (2026-09-25); nothing above the concurrent lane's
  live release is deployed.
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
