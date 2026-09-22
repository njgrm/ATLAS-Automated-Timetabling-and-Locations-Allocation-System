# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last reconciled: 2026-09-21 (Lane A).

## Writing protocol — two planner lanes share this file

This file is co-maintained so two planners can work in parallel without a custody defect. The
rules are what make that safe:

1. **Each lane edits only its own section** — `Lane A — current lane` or `Lane B — current lane` —
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
   `docs/handoffs/planner-session-handoff.md`, Lane B in its own handoff file.

## Objective

Deliver a presentable live ATLAS demo for school 1 and active upstream school
year 10 (SY 2031-2032): correct Teaching Load, a dynamic term-aware timetable,
realistic official exports, zero HARD publication blockers, SMART-family visual
cohesion across the whole site, and direct two-way SSO with EnrollPro, SMART,
and AIMS.

## Live release

- Tailnet: `https://njgrm.buru-degree.ts.net`
- **Release SHA: `d4c9f39139dcb34e1653d543586d4c76420ea8a5`** (current, deployed 2026-09-22;
  supervisor 28104; `5001`->39064; `5174`->39392; `D:` 29.84 GiB; served entry `index-DgF0ZSEz.js`,
  456,064 B — the client tree is unchanged, so the deploy is proven by the **server** service
  artifacts). Carries `COMPANION-SSO-REVERSE-IDENTITY-C01`: the reverse assertion **omits** empty
  `firstName`/`lastName` instead of sending `""` (EnrollPro's schema is `min(1).optional()`), and
  fails closed typed-403 (`COMPANION_SSO_IDENTITY_EMPLOYEE_ID_UNAVAILABLE`) on a missing
  `employeeId`. Pre-action review `ACCEPT_READY` 17/17/0/0; mounted suite 21/21.
  **ATLAS -> EnrollPro (reverse) is confirmed working live.** **EnrollPro -> ATLAS (normal) is
  `BLOCKED(COMPANION_CALLBACK_MISCONFIGURED)`**: EnrollPro's `ATLAS_SSO_CALLBACK_URL` points at
  ATLAS's SPA *result* path (`/auth/sso/callback`) where the *callback* path belongs
  (`/api/v1/auth/enrollpro/callback`), so the SPA never sees a token — companion-side, see
  `docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` §4. Evidence
  `docs/reviews/companion-sso-reverse-identity-c01/evidence.md`. Rollback `d92facfa` startable at
  `D:\ATLAS-runtime-supervised-d92facfa-20260921`; **not executed**.
- (superseded) Release SHA: `d92facfa14b1d33b6da04f0c169cd73f7221e713`. Delta versus the previous release
  `a02884ff` is exactly the three `atlas-server` paths of `ACTOR-SCHOOL-MUTATIONS-C01`
  (**client delta empty**). This is the **first server-carrying release since `4c7c0bd9`**, so it
  also carries the `DUP-READ-CALLERS-C01R` client fix.
- Supervisor: PID 96476; server `5001 -> 103700`; client `5174 -> 96612`
- Active directory: `D:\ATLAS-runtime-supervised-80acdc25-20260921` (a registered detached
  worktree — the clone shape used by the two previous releases is not repeated, `AGENTS.md` §10.12)
- Served client entry chunk: `/assets/index-C6LTCXSf.js`, byte-identical to the previous release's
  (unchanged client tree rebuilds deterministically)
- Deployed 2026-09-21 by the `ACTOR-SCHOOL-MUTATIONS-C01` release cycle. The eight defaulting
  runtime mutation `POST` routes now reject a missing/malformed/foreign target school **before**
  any service, lock, upstream, database or notification dispatch; a system token may still act on
  an explicit valid target, and a JWT actor must be privileged with a matching positive actor
  school. Independent source review: **9/9**, including an independently reproduced failing-first
  control. Post-action QA: **`ACCEPT_READY` 5/5/0/0** with an independently re-derived signature
  map — `EE03F1D0…65521B`, 46 tables, pre == post, pinned in-transaction — plus a whole-database
  timestamp scan showing **zero post-cutover writes and no login**. The eight live mutation routes
  were deliberately **not** probed (a live `POST` can write); the server claim rests on artifact
  identity plus the committed harness, and that limitation is stated, not papered over.
  `D:` free 37.32 → **35.82 GiB**.
- Rollback: incumbent `a02884ff` is startable in place at
  `D:\ATLAS-runtime-supervised-a02884ff-20260921` (task XML captured pre-mutation,
  `B0EF4152…`); `4c7c0bd9` and the `5f5c6c4f` / `434b2a81` bases remain available behind it.
  Rollback was **not** executed.
- Deployed 2026-09-21 by the `UX-R03e` one-shot, which added the last two operator
  sub-pages: `/timetable/runs` (a read-only run history composed from the existing
  `GET /api/v1/generation/:schoolId/:schoolYearId/runs` endpoint, selecting through the
  workspace's existing run selection) and `/timetable/setup` (composed from the existing
  drift/sync, room-repair, refresh-names and readiness surfaces, with the readiness chip and
  refresh item extracted so header and pane share one implementation). Independent QA:
  `ACCEPT_READY` 13/13, blocked 0, unperformed 0 — source, deployment and all five browser
  rows, including the viewport check across the nine `/timetable*` routes and the in-subtree
  identity check.
- **Prior correction retained:** the `UX-R03d` outlet-keying fix means the workspace no
  longer remounts inside the `/timetable` subtree. QA confirmed the same element instances
  and zero new requests for pure route moves; entering the **advanced** policy surface via
  the More menu still switches layout and refetches its own data, which is pre-existing
  advanced-surface behaviour, not an outlet remount.
- **Evidence-hygiene defect found and fixed on 2026-09-20.** Independent QA applied the
  `AGENTS.md` §11 rule and found the route test files were reachable from **no** committed
  `package.json` script — the whole `components/__tests__` tree sat outside every gate, so
  earlier tallies came from manually-run commands. `test:timetable-route-keys` now runs them
  (57/57 at `R03e`).
- Open provenance limitation: the deployment signature map is deterministic (46 tables) but
  its serialization was not pinned tightly enough for QA to re-derive the executor's
  recorded pre hash independently. Byte-identity across each action was proven by the
  executor and, at `R03e`, recomputed by QA to the same value.
- **Open 502 lead (report-only, not fixed).** QA observed 502s on clean loads of
  `/api/v1/generation/1/10/runs/316/manual-edits` and
  `/api/v1/follow-up-flags/1/10/runs/316/flags`, and concurrent duplicate identical GETs on
  `runtime/context?schoolId=1` (×4), `rollover-status` (×2-3) and `auth/me` (×2). In this
  sample the duplicates did **not** correlate with the 502s. Coalescing duplicate reads in
  `atlasApi` would touch every call, so it stays a separate reviewed stream.
- Authorized logins: `audit_logs` rows 853 (C02 pass), 854 (R03c QA), 855 (R03d QA), 856
  (R03e QA), actor 46.
- Served client entry chunk: `assets/index-BMgoX99N.js`; served HTML and all 34 referenced
  assets byte-match the built dist manifest.
- Rollback basis: `5f5c6c4f02caf91b1ad948ebfcb6dde409073ad6` at
  `D:\ATLAS-runtime-supervised-5f5c6c4f-20260920` — startable, junction-free, with its
  task-XML capture retained. Rollback was not executed. The older `c93dd2ee`, `d50dde64`
  and `74999168` releases are still present and startable.
- Retained do-not-retire trees: `0eb3b67f` (repaired shared client),
  `8eb0511baa53` (client graft source), and `E:\ATLAS-worktrees\ux-quickfix-c01`.
- Local/Tailnet health, readiness, client and DB-backed probes are 200; public
  published-schedule reads are term-scoped with typed `400 INVALID_TERM_INDEX` on
  malformed input; unauthenticated violation-report routes return 401; SMART and
  AIMS SSO return typed `503 COMPANION_SSO_NOT_CONFIGURED` (intentionally inactive,
  no keys installed); EnrollPro is configured in the bundle.
- Rollover automation remains disabled.
- `cli.mjs status` incorrectly reports child `live:false`; listener ownership,
  supervisor state and HTTP probes are authoritative until that bug is corrected.
- Supervisor metadata still names historical `productPin=d44f29e0`; read
  `releaseSha`, not that field.
- Zero-write evidence: the schema-wide signature map (`222718C7…C3E3`, 46 tables)
  is unchanged across the deployment; its exact SQL and serialization are in
  `docs/reviews/current-source-live-deploy-c01/evidence.md` — pin `SET TIME ZONE`
  when reproducing, because `row_to_json` of `timestamptz` is session-dependent.
- Worktree hygiene 2026-09-20: retired `published-revision-authority-c12`
  (`c01b171f`), `section-route-authority-c02` (`af1ed0bb`), and
  `section-route-authority-c03` (`6f1abc2b`) after proving each clean and an
  ancestor of `origin/main`; non-forced removal, no branch deleted.
  `E:/ATLAS-worktrees/c02-muse` (`211dea0c`) is preserved as an unintegrated
  alternate candidate. `stash@{0}` (`3c014d8b`) preserved.

## Live acceptance (browser, 2026-09-20)

- One authorized admin login for this pass: audit row **852** `LOCAL_LOGIN_SUCCESS`,
  actor 46. Rows 850/851 are pre-existing and not from this pass. Read-only: no
  Save/Apply/Generate/Publish/Delete was invoked and no timetable cell was clicked.
- `/` renders, `window.location.origin` asserted, no global scrollbar. INTEGRATED
  SYSTEMS now lists **EnrollPro** with its reverse-SSO start link; AIMS and SMART
  correctly report "not configured".
- `/timetable`: the Simple workspace renders (`timetable-simple-body`), no global
  scrollbar. Selection-driven controls (primary action, visible undo, source truth)
  were deliberately not exercised, because selecting a slot on this page can place
  a session.
- `/public/schedules?termIndex=1`: resolves a single term (`TERM 1`) and shows 40
  published classes for the default section — the 3x term duplication is gone.
- `/teaching-load`: renders with no error boundary and no global scrollbar.
- Console errors are only EnrollPro-proxy 502s (see the blocker below).
- Screenshot, not committed:
  `%TEMP%\opencode\pw-mcp-output\atlas-timetable-simple-1366x768.png`.

## Live data

- Database: `atlas_recovery_clean_rebuild_20260905` on localhost:5432.
- Active upstream year: 10; mirror row: 551.
- Building `gradeScope` HIGH apply completed and independently accepted:
  building 1 `[7]`, building 2 `[8]`, building 3 `[9]`, building 4 `[10]`.
  Deployed preview is zero-write with 20/20 correct grade-wing placements and
  zero cross-grade leakage. Existing section home rooms were unchanged.
- Grade-scope rollback: restore buildings 1-4 to empty integer arrays, then
  rerun the same preview.
- Published run 315 / revision 42: zero HARD violations, 335 acknowledged SOFT
  warning rows. Latest run 316 is not published.
- Regeneration and publication have not been authorized or executed after the
  grade-scope correction.

## Current blockers and accepted source

- `DUP-READ-CALLERS-C01` / `-C01R` are **integrated, deployed and independently accepted**
  2026-09-21. `C01` closed the three named duplicate-read callers: one in-flight `/auth/me` per
  token epoch across **both** `resolveActorSchoolId` and `verifySessionToken`; the
  `runtime/context` in-flight registry keyed by the full request profile
  (`schoolId:verifyUpstream:allowEnrollProFallback:allowStaleOnError`, normalized to effective
  defaults); and `rollover-status` keyed by `(schoolId, includeCounts)`. `C01R` added the
  per-token-epoch **resolved-value memo** that closes the *serial* duplicate the in-flight map
  cannot, and is live in `a02884ff`. Both passed their source rows (5/5 each; C01R carried into
  the release on proven blob identity).
- **Lane B `ACTOR-SCHOOL-MUTATIONS-C01` is LIVE** in release `80acdc25`. Its recorded successors
  are **not** part of it and remain open: `GET /rollover-recovery/preview`
  (`runtime.router.ts:244`) still defaults to school 1 and needs the same treatment
  `ACTOR-SCOPE-C01` gave the read routes; `parseStrictTermAuthoritySchoolId` (`:424`) lacks the
  new non-string/non-number guard (`true → 1`, `[1] → 1` — not cross-tenant, those routes are
  actor-matched); and the harness does not cover body-vs-query precedence or
  hex/exponent/padded-string inputs.
- **Deploy fact earned this cycle:** an agent shell inherits a **stale process-scope**
  `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` (measured `c93dd2ee-20260920`) that
  shadows machine scope, so an unqualified `node ops/runtime/cli.mjs stop` targets the wrong
  (orphan) state file. Pass explicit env overrides; the registry values are correct. Recorded in
  `docs/reference/agent-runtime-deploy-facts.md`.
- **A parallel planner is authorized (operator, 2026-09-21).** `E:\ATLAS-worktrees\test-gate-reachability-c01`
  (branch `work/test-gate-reachability-c01`, HEAD `c6692bad`, dirty `M atlas-server/package.json`,
  no commits beyond `main`). The operator authorized that writer and told them to stay out of
  Lane A's lane, so the two run in **parallel**: preserve their worktree, and re-read
  `docs/handoffs/lane-b.md` plus their handoff before the next `:main` push (`AGENTS.md` §14).
- **Awaiting a decision — the stray clone.** `E:\ATLAS-worktrees\c01r-release-20260921` is a
  standalone clone, not a worktree (`origin` = the stale `D:\ATLAS`), created by the executor
  against the new `AGENTS.md` §10.12. It is clean, its only branch is integrated, and it holds no
  unique commits (~1 GiB). `git worktree remove` does not apply and a raw recursive delete is not
  permitted, so removal needs an operator instruction. The live release directory
  `D:\ATLAS-runtime-supervised-a02884ff-20260921` carries the same clone-not-worktree deviation;
  it is verified and live, so leave it as-is.
- **The 502 layer is now identified (observation O1, 2026-09-21).** A captured failing response
  was a host-proxy typed 502 — `{"code":"UPSTREAM_UNREACHABLE","message":"read ECONNRESET"}` on
  `GET /generation/1/10/runs/316/manual-edits` (also `follow-up-flags` once). Per the
  diagnosis's inference table that is a **host-side** connection blip to the server, not a
  server- or route-emitted 502, so the fix is **not** in the routes. No fix attempted; the
  server-side cause is uninvestigated.
- **`/auth/me` serial duplication is FIXED on the live `a02884ff`.** QA measured a clean
  `/timetable` load issuing `/auth/me` **×1** (single token epoch), `runtime/context` **×2**, and
  `rollover-status` **×1** — the B2 row that failed on `4c7c0bd9` now passes. The packet's
  "two cards asserted mounted" sub-clause remains **not exercisable**: 0 `rollover-guidance-card`
  elements mount on `/timetable`, `/` or `/teaching-load`, and no live state mounts two
  (creating drift is not authorized). The primary count assertion is unweakened.
- **`D:` capacity blocker RESOLVED 2026-09-21 by the worktree reclaim.** 56 clean, contained,
  unanchored, inactive worktrees were retired across `D:/ATLAS-worktrees` and
  `E:/ATLAS-worktrees`: `D:` free 15.81 → **40.76 GiB**, `E:` 55.7 → **66.13 GiB** (~35.4 GiB
  total); registered worktrees 112 → 57; every shared junction target verified intact; no
  branch deleted; the two named startable fallbacks preserved. Evidence
  `docs/reviews/worktree-reclaim-20260921/{manifest.md,post-action-report.md}`. Release builds
  are unblocked. `D:\ATLAS-runtime-*` release trees remain on the never-retire list.
- The deployed release `74999168` now carries the accepted source, including
  `UX-R02` Simple-workspace simplification, `SECTION-ROUTE-AUTHORITY-C01..C03`,
  `PUBLISHED-REVISION-AUTHORITY-C12`, `PUBLIC-SCHEDULE-TERM-SCOPE-C01`,
  `WARNING-READABILITY-C01`, `UX-R01-SHARED-CHROME-C01`,
  `COMPANION-DIRECT-FEDERATION-C04`, `HOME-ROOM-AUTO-ASSIGN-C01`, `UX-R06`,
  `UX-P01` and `SSO-CLIENT-CONFIG-C01`. Every `origin/main` commit above the pin is
  docs-only, so the deployed product equals current source.
- `UX-R01-SHARED-CHROME-C01` is foundational: it does not complete the page-level
  `UX-R02`-`UX-R05` work, which remains open.
- `UX-R03a` is **integrated and independently accepted** 2026-09-20 (QA `ACCEPT_READY`
  8/8/0/0): `/timetable` is now a persistent parent route with element-less
  `index`/`policies` children, so the review workspace, query cache and scope state
  stay mounted and no request is issued on a round trip; `/timetable/policies` is the
  first real sub-page; the More-menu policy item is a real link; cancelling the
  unsaved-change guard restores the shown view's URL. Not deployed. Open items: the
  empirical DOM/request-count and `1366x768` viewport clauses, plus the live guard
  dialog and anchor click, are **deployment-acceptance items** for the next release;
  QA's NON_BLOCKING finding that cancelling from `pre-generation` can raise the guard
  dialog twice is a bounded successor for `UX-R03b`.
- `UX-R03b` is **integrated and independently accepted** 2026-09-20 (QA `ACCEPT_READY`
  8/8/0/0): the four remaining existing center views are routed under the same mounted
  shell (`/timetable/pre-generation`, `/map`, `/manual-edit`, `/building`), the two
  selection-dependent panes show truthful empty states and never fabricate a selection,
  the `/map` duplication is resolved by routing without deleting the standalone campus
  editor, and the `UX-R03a` double-guard-dialog residual is closed. A QA-found blocking
  defect — a URL entry to `/timetable/pre-generation` showing the Room Requests panel
  instead of the Draft queue — was fixed additively inside the same cycle. Not deployed.
  The new routes fall back to generic shell chrome because `navigation.ts` was outside
  the packet's authorized paths.
- `UX-R03c` is the successor: new `/timetable/runs`, `/setup` and `/exports` sub-pages
  (those panes do not exist as components yet, so they are a design task, not routing),
  plus chrome overrides for the routes added in `UX-R03a`/`UX-R03b`.
- Pre-existing red test, **unrelated to today's lanes**: `uxc01-derived-setup-surface.test.ts`
  fails 1 of 4 because `navigation.ts` carries a legitimate `/subjects/requirements`
  route override while the assertion forbids the substring `/requirements/i` anywhere in
  that file. Reproduced present at `19e9481f`, i.e. before `UX-R03a` was integrated. A
  bounded LOW test-contract correction is queued.
- `COMPANION-DIRECT-FEDERATION-C04` is integrated and independently accepted.
  The deployed runtime still supports EnrollPro only. SMART/AIMS activation
  remains blocked on their companion-side implementations, directional key
  installation, deployment, and serialized live browser acceptance.
- Direct SMART and AIMS federation requires two independent secrets per peer
  pair. Companion repositories remain read-only from ATLAS work.
- The SMART and AIMS mirrors remain at the handoff baselines and do not yet
  implement their ATLAS peer routes. Generate/install no directional keys yet.
- `CURRENT-SOURCE-LIVE-DEPLOY-C01` is **EXECUTED and independently accepted**
  2026-09-20: pin `7499916886707c35ea708a17ef7a87e791a6bade` deployed at
  `D:\ATLAS-runtime-supervised-74999168-20260920`, post-action QA `ACCEPT_READY`
  8/8 (blocked 0, unperformed 0; evidence
  `docs/reviews/current-source-live-deploy-c01/evidence.md`). The review path was
  pre-action `ba9771a8` for pin `134bcf28`, repin to the tip, `CORRECTION_REQUIRED`
  on the repinned boundary for the missing rollback basis, then r3 cleared after
  `PRISMA-CLIENT-REPAIR-C01`. Residual for the next packet revision: precondition
  8's literal `row_to_json(t)` form must pin the exact quoting and serialization,
  as recorded in the evidence addendum.
- **EnrollPro proxy 502 is an upstream outage, not an ATLAS defect.** The durable
  env already declares `ENROLLPRO_PROXY_ORIGIN`, the deployed runtime already
  resolves it, and the live proxy truthfully returns
  `502 {"code":"UPSTREAM_UNREACHABLE","message":"connect ETIMEDOUT 100.120.169.123:443"}`.
  The tailnet peer `dev-jegs` (`100.120.169.123`) is **offline** (tailscale reports
  offline, last seen 10h; TCP 443 fails; direct probes fail; ATLAS's own tailnet
  origin returns 200). `ENROLLPRO-PROXY-RECOVERY-LIVE` is **SUPERSEDED — do not
  execute**: its env premise is false and its release binding would downgrade the
  runtime. Handoff:
  `docs/handoffs/enrollpro-dev-jegs-unreachable-2026-09-20.md`.
- **EnrollPro resolved 2026-09-20 without ATLAS action.** The peer came back online on its
  own (`tailscale status`: active, direct connection) and the proxy is healthy again:
  `https://njgrm.buru-degree.ts.net/enrollpro-api/settings/public` → 200 and
  `https://dev-jegs.buru-degree.ts.net/api/integration/v1/health` → 200. This confirms the
  superseded `ENROLLPRO-PROXY-RECOVERY-LIVE` packet was correctly not executed — the fault
  was always the companion's availability, never ATLAS configuration.
- Dashboard tile wording: the Scheduling Dashboard reports "335 review blockers" on
  a published run with zero HARD violations — the acknowledged SOFT warning total is
  presented as blockers. This is the operator's warning-count complaint in a second
  surface and is an open page-level follow-up.
- Pre-existing double policy fetch, surfaced by the new route: both
  `SchedulingPolicyPane.tsx:285` and `useScheduleReviewWorkspaceState.ts:541` GET
  `/policies/scheduling/{schoolId}/{schoolYearId}`, and on a clean load of
  `/timetable/policies` the second response intermittently returns 502 (the same
  endpoint unauthenticated correctly returns 401, and the pane fails closed to saved
  data). Neither file is in the C02 changed set and the deployment is client-only, so
  this is pre-existing duplication that the route made reachable — `NON_BLOCKING`,
  bounded successor: give the policy fetch one owner.

## Operator decisions

- Whole-site UX shall converge on SMART's calm task-first identity while ATLAS
  retains its complex Teaching Load and Timetable workflows.
- Direct two-way SSO is required for EnrollPro, SMART, and AIMS. No account or
  role may be auto-provisioned or elevated through SSO.
- The operator authorizes generation of the SMART/AIMS directional keys and
  ATLAS durable-env edits after reviewed source consumes the agreed names.
- Generation/publication require zero HARD violations. SOFT warnings remain
  explicit and auditable.
- Laboratory scheduling is optional for future beneficiaries and disabled for
  the current pilot.
- **Standing authorization (2026-09-20):** for this program the operator authorizes
  HIGH actions, deployment, and browser acceptance without a per-action approval
  round-trip, provided every existing gate and test is retained — independent
  pre-action review, one executor, one fresh independent post-action QA, browser rows
  labelled as such, and a real `passed/blocked/unperformed` tally. **Packets from here
  bundle source, deployment, and browser acceptance into one cycle** (see `AGENTS.md`
  §13). Standing authorization removes waiting, never evidence.
- **Two agents work this repository concurrently.** Lane A (this lane) owns the client
  timetable surface, the continuity documents, deployment and the single browser controller.
  Lane B (a second agent, ChatGPT harness) owns `atlas-server/src/**` and its own docs, on
  stream `ACTOR-SCHOOL-MUTATIONS-C01`; its charter is
  `docs/handoffs/lane-b-charter-2026-09-21.md` and its review status lives in
  `docs/handoffs/lane-a-to-lane-b.md`. Disjoint file ownership, one runtime, one browser
  controller, no deploy from Lane B. Current handoff for a fresh session:
  `docs/handoffs/planner-session-handoff.md`.

## Decisions awaited (operator-facing)

- Removal instruction for the stray clone `E:/ATLAS-worktrees/c01r-release-20260921` (~1 GiB, no
  unique commits) — a raw recursive delete is not permitted for a non-worktree.
- Confirm the two-lane naming used here (Lane A = the primary planner; Lane B = the
  operator-authorized parallel planner), and whether the earlier ChatGPT-harness agent's stream
  (`docs/handoffs/lane-b.md`) is still active.

## Lane B — current lane (written only by Planner B)

Lane B owns this section. Current stream and state: see Lane B's own handoff file. Lane A last saw
it complete `TEST-GATE-REACHABILITY-C01` (`f4462374`) and hand it over for integration.

## Lane A — current lane (written only by Lane A)

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
