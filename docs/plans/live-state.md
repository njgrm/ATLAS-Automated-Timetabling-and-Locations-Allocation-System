# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last verified: 2026-09-21 (planner, closing `ACTOR-SCHOOL-MUTATIONS-C01` Part B; release `80acdc25`
**deployed** and independently accepted **5/5**, 0 blocked, 0 unperformed, with an independently
re-derived in-transaction-pinned zero-write proof)

## Objective

Deliver a presentable live ATLAS demo for school 1 and active upstream school
year 10 (SY 2031-2032): correct Teaching Load, a dynamic term-aware timetable,
realistic official exports, zero HARD publication blockers, SMART-family visual
cohesion across the whole site, and direct two-way SSO with EnrollPro, SMART,
and AIMS.

## Live release

- Tailnet: `https://njgrm.buru-degree.ts.net`
- Release SHA: `80acdc257cee613418eaa24db4607114b68c2d25`. Delta versus the previous release
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

## Single next action

**Close the actor-school residual authority lane.** The release queue is **empty** — every
accepted source change is live in `80acdc25`, and nothing is awaiting deployment. The highest-value
item that is not operator-gated is the bounded, source-only successor to the work just shipped:
1. `GET /rollover-recovery/preview` (`atlas-server/src/routes/runtime.router.ts:244`) still uses
   the defaulting `parseSchoolId`, so an authenticated JWT can read with a school-1 fallback — the
   same defect class `ACTOR-SCOPE-C01` closed on the other read routes.
2. `parseStrictTermAuthoritySchoolId` (`:424`) should carry the same non-string/non-number guard
   for consistency (not a cross-tenant path today).
3. Harness hardening: body-vs-query precedence, hex/exponent/padded-string inputs, and an
   aggregate script entry.
That lane is `atlas-server/**`, i.e. **Lane B's file ownership** — so it is either handed to Lane
B or explicitly re-assigned before any Lane A writer touches it.

Operator-gated items, in value order, each needing its own reviewed packet: the term-cache
catch-up **apply** (capture complete at `9c19b772`; still unbound), the canonical readiness
diagnostic → fingerprinted generation preview → **generation**, then **publication**; and the
SMART/AIMS companion handoffs to their repository owners. Regeneration, publication, Teaching Load
applies and every migration remain separately locked.

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
