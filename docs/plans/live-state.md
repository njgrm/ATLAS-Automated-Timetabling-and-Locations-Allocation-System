# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last verified: 2026-09-20 (planner reconciliation; live release `74999168`
deployed, independently accepted 8/8, and browser-accepted read-only)

## Objective

Deliver a presentable live ATLAS demo for school 1 and active upstream school
year 10 (SY 2031-2032): correct Teaching Load, a dynamic term-aware timetable,
realistic official exports, zero HARD publication blockers, SMART-family visual
cohesion across the whole site, and direct two-way SSO with EnrollPro, SMART,
and AIMS.

## Live release

- Tailnet: `https://njgrm.buru-degree.ts.net`
- Release SHA: `d50dde642c10b1ea6fdc9097266ace53cdba2063`
- Supervisor: PID 90968; server `5001 -> 91512`; client `5174 -> 90172`
- Active directory: `D:\ATLAS-runtime-supervised-d50dde64-20260920`
- Deployed 2026-09-20 by `CURRENT-SOURCE-LIVE-DEPLOY-C02`, the first **one-shot**
  packet (source + deployment + browser acceptance in one cycle). Status:
  **DEPLOYED, acceptance incomplete.** Rows 1-8 were independently reproduced by
  post-action QA (including the zero-write proof: reverting the authorized login
  reproduces the recorded pre hash exactly). Rows 9/10/12 — route round-trip element
  and request identity on all six `/timetable*` routes, the `1366x768` viewport check,
  and the policy anchor — were executed by the planner as the single browser
  controller and are **not independently reproduced**, because browser custody is
  serial. Row 11 (live guard dialog) is **blocked by condition**, which the packet
  pre-authorized: no pending pre-generation draft exists (`locked_sessions`: 4 rows,
  all `LOCKED_FOR_RUN`), and creating one would persist a write and break row 8.
- Authorized login for that pass: `audit_logs` row 853 `LOCAL_LOGIN_SUCCESS`, actor 46.
- Served client entry chunk: `assets/index-BZ9J8198.js`; served HTML and all 35
  referenced assets byte-match the built dist manifest, and the bundle carries
  `/timetable/policies`.
- Rollback basis: `7499916886707c35ea708a17ef7a87e791a6bade` at
  `D:\ATLAS-runtime-supervised-74999168-20260920` — startable, junction-free, with its
  task-XML capture retained. Rollback was not executed.
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

## Single next action

`CURRENT-SOURCE-LIVE-DEPLOY-C02` is **deployed** and its evidence integrated; the live
demo now runs `UX-R03a` + `UX-R03b`. Two residuals remain from its acceptance, both
recorded above: rows 9/10/12 are planner-executed browser rows that no independent
reviewer has reproduced (serial browser custody), and row 11 is blocked by condition.
The next one-shot is `UX-R03c` — new `/timetable/runs`, `/setup` and `/exports` panes,
chrome overrides for the routes added in `UX-R03a`/`UX-R03b`, and the one-owner fix for
the double policy fetch — bundled with its own deployment and browser acceptance; give
its QA the browser controller so the route round-trip and viewport rows are reproduced
independently rather than by the planner. EnrollPro needs no ATLAS action — wait for the
peer `dev-jegs` to come back online and do not execute the superseded live packet.
Dispatch the SMART and AIMS handoffs to their repository owners in parallel;
generate/install directional keys only after both sides consume the agreed names.
Regeneration and publication remain separately locked, as do all Teaching Load and
term-cache applies.
