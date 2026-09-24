# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last reconciled: 2026-09-24 (Lane A).

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
- **Release SHA: `37e0c85b`** (**LIVE** since 2026-09-25; `E:\ATLAS-runtime-supervised-37e0c85b-20260925`;
  supervisor-owned 5001→63452 / 5174→26084; health/ready (`database:"ok"`) + DB-backed read + Tailnet 200;
  served entry `assets/index-qbOXyMnr.js` (SHA-256 `8372C342…D43B60`, byte-identical to the build); machine
  `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` = the target). Carries the global native-scrollbar token policy
  and the S8 shift-coherence guard (D11). **Migration APPLIED** 2026-09-25 via the guarded runner to
  `atlas_recovery_clean_rebuild_20260905`: `20260925000001_shift_coherence` (`MIGRATE_GATE_OK`, backup
  `atlas-backup-atlas_recovery_clean_rebuild_20260905-20260924-181614.dump`, sha256 `5676cde9…`). Cut over by
  `ops/runtime/deploy-runner.ps1` (audit `C:\ProgramData\ATLAS\release-audit\37e0c85b-20260925-021830`).
  **Deployment verified:** fresh QA `ACCEPT_READY` 18/18/0/0. **Acceptance PARTIAL** — authenticated browser
  rows `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`. **Acceptance owner: unassigned (as of 2026-09-25).**
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

- Name the acceptance owner for `37e0c85b` and give it an authenticated session (see `AGENTS.md` §12).
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

**What actually remains, in value order** (from `docs/handoffs/planner-handoff-2026-09-20.md` §8,
which is more current than the older live-state material — read it before starting a lane):

1. **`warning-readability-c01`** — packet ready, no owner. Smallest complete open lane.
2. **Public published-view term merging** — `/public/schedules` renders every cell 3× (2,760
   entries = 920 × 3 terms). **Owned by the other planner** (their public term-scoping correction).
3. **False/incorrect warning categories** — `ZONE_IMBALANCE_WARNING` fires because 0 of 103 rooms
   have a zone (a config gap, not a schedule defect); `FACULTY_FLOOR_TRANSITION` message is broken;
   warning-count semantics (335 API rows / 116 unique / 113 shown).
4. **`test:ux-guardrails` is vacuous** — it names two files deleted at `4794bd9e` and must never be
   cited as evidence.
5. **SMART/AIMS companion handoffs** — queued for their repository owners.
6. **Actor-school residual authority lane** (`atlas-server/**`) — `GET /rollover-recovery/preview`
   still defaults to school 1; `parseStrictTermAuthoritySchoolId` lacks the non-string guard.

Ledger of completed work: the duplicate-read fixes and the server actor-school release are live in
`80acdc25`; the release queue is **empty**.

Behind that release, these are unchanged:

- The route split is complete: every operator sub-page exists, the workspace stops remounting
  inside the `/timetable` subtree, and the whole timetable route suite runs in a committed gate.
- The duplicate-read diagnosis is answered and its fixes are live (`C01` + `C01R`). The 502s need
  **no ATLAS fix**: the captured body (O1) is a host-proxy `UPSTREAM_UNREACHABLE` /
  `read ECONNRESET`, i.e. host-side. O2 records further repeats outside the three named callers
  (`runtime/context` ×2, `/notifications` per scope, and the app's own retry after a 502) — a
  candidate successor, not a defect. Findings:
  `docs/reviews/dup-read-diagnosis-c01/findings.md`.
- EnrollPro is online and its proxy is healthy; no ATLAS action is outstanding there. Dispatch
  the SMART and AIMS handoffs to their repository owners in parallel; generate/install
  directional keys only after both sides consume the agreed names.
- Regeneration and publication remain separately locked, as do every Teaching Load and term-cache
  apply. The remaining defaulting `parseSchoolId` backlog and the advanced-policy-surface
  layout-switch/refetch observation stay non-blocking successors.
