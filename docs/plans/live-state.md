# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last verified: 2026-09-20 (planner reconciliation; live release `74999168`
deployed and independently accepted 8/8)

## Objective

Deliver a presentable live ATLAS demo for school 1 and active upstream school
year 10 (SY 2031-2032): correct Teaching Load, a dynamic term-aware timetable,
realistic official exports, zero HARD publication blockers, SMART-family visual
cohesion across the whole site, and direct two-way SSO with EnrollPro, SMART,
and AIMS.

## Live release

- Tailnet: `https://njgrm.buru-degree.ts.net`
- Release SHA: `7499916886707c35ea708a17ef7a87e791a6bade`
- Supervisor: PID 83856; server `5001 -> 40332`; client `5174 -> 86720`
- Active directory: `D:\ATLAS-runtime-supervised-74999168-20260920`
- Deployed 2026-09-20 by `CURRENT-SOURCE-LIVE-DEPLOY-C01`, independently accepted
  `ACCEPT_READY` 8/8 (blocked 0, unperformed 0). The release carries its own
  isolated dependency trees and generated Prisma client — no junctions.
- Served client entry chunk: `assets/index-Bk7FKtfs.js`; the served HTML and all 36
  referenced assets byte-match the built dist manifest.
- Previous release `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74` at
  `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` is the **rollback basis**:
  startable, with the pre-action task XML capture retained. Rollback was not
  executed. Its server tree reaches the shared Prisma client in `0eb3b67f`, which
  `PRISMA-CLIENT-REPAIR-C01` repaired on 2026-09-20.
- Retained do-not-retire trees: `0eb3b67f` (repaired shared client),
  `8eb0511baa53` (client graft source), and `E:\ATLAS-worktrees\ux-quickfix-c01`
  (the incumbent's client junction).
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

## Single next action

The demo now runs the accepted source; the next bounded step is a live browser
acceptance pass on the deployed release (authenticated rows were deliberately
outside the deploy's mandate), covering the Simple timetable workspace, the
term-scoped public schedule, exports, and the Teaching Load pages. Dispatch the
SMART and AIMS handoffs to their repository owners in parallel; generate/install
directional keys only after both sides consume the agreed names. Regeneration and
publication remain separately locked, as do all Teaching Load and term-cache
applies.
