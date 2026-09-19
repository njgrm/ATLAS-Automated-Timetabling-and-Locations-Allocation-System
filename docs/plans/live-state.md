# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last verified: 2026-09-20 (planner reconciliation against `origin/main` `74999168`)

## Objective

Deliver a presentable live ATLAS demo for school 1 and active upstream school
year 10 (SY 2031-2032): correct Teaching Load, a dynamic term-aware timetable,
realistic official exports, zero HARD publication blockers, SMART-family visual
cohesion across the whole site, and direct two-way SSO with EnrollPro, SMART,
and AIMS.

## Live release

- Tailnet: `https://njgrm.buru-degree.ts.net`
- Release SHA: `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`
- Supervisor: PID 67028; server `5001 -> 63688`; client `5174 -> 12992`
- Active directory: `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918`
- Supervisor metadata still names historical `productPin=d44f29e0`; do not
  conflate that field with the installed release SHA.
- Local/Tailnet health, readiness, client, and DB-backed subject probes are 200.
- Client chunk: `assets/index-CtOKnF1z.js`
- Rollover automation remains disabled.
- `cli.mjs status` incorrectly reports child `live:false`; listener ownership,
  supervisor state, and HTTP probes are authoritative until that reporting bug
  is corrected.
- Hard dependency: the active server `node_modules` resolves in one hop to
  `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918`. Do not retire or mutate it.
- Rollback release: `f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a`.
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

- Current source is ahead of the deployed release. Undeployed accepted source
  additionally includes `UX-R02` Simple-workspace simplification,
  `SECTION-ROUTE-AUTHORITY-C01..C03`, `PUBLISHED-REVISION-AUTHORITY-C12`,
  `HOME-ROOM-AUTO-ASSIGN-C01`, `UX-R06`, `UX-P01`, and
  `SSO-CLIENT-CONFIG-C01`. Deployment remains a separate HIGH action.
- `PUBLIC-SCHEDULE-TERM-SCOPE-C01` is integrated and independently accepted.
  Public reads now require or resolve one verified term, isolate cache identity
  by requested and resolved term, reject malformed term selection before
  dispatch, and preserve all public route families. It is not deployed.
- `WARNING-READABILITY-C01` is integrated and independently accepted. Warning
  projection now counts unique issues within each term, preserves term
  identity, suppresses only the false unspecified-zone signal, explains floor
  transitions truthfully, and actor-scopes both violation-report routes. It is
  not deployed.
- `UX-R01-SHARED-CHROME-C01` is integrated and independently accepted: shared
  SMART-style breadcrumbs, PageHeader, semantic Card/state primitives, and a
  mechanically enforced 12px application-chrome floor. It is not deployed, is
  foundational, and does not complete page-level UX-R02-R05.
- `COMPANION-DIRECT-FEDERATION-C04` is integrated and independently accepted.
  The deployed runtime still supports EnrollPro only. SMART/AIMS activation
  remains blocked on their companion-side implementations, directional key
  installation, deployment, and serialized live browser acceptance.
- Direct SMART and AIMS federation requires two independent secrets per peer
  pair. Companion repositories remain read-only from ATLAS work.
- The SMART and AIMS mirrors remain at the handoff baselines and do not yet
  implement their ATLAS peer routes. Generate/install no directional keys yet.
- `CURRENT-SOURCE-LIVE-DEPLOY-C01` passed independent pre-action review at
  `ba9771a8` (`ACCEPT_READY` 10/10/0/0) for pin `134bcf28`. **Repinned
  2026-09-20** to `7499916886707c35ea708a17ef7a87e791a6bade`, release
  `D:\ATLAS-runtime-supervised-74999168-20260920`; the 32-commit / 20-product-file
  pin delta is recorded in the packet and still needs its independent
  pre-action re-review before execution. It deploys the accepted source without
  activating SMART/AIMS SSO and without a login or database write. `D:` is
  23.31 GiB free, below the 25 GiB warning threshold, so its disk projection
  remains a mandatory execution precondition.

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

Obtain the operator's exact HIGH approval for the **repinned** packet
`docs/prompts/current-source-live-deploy-c01-2026-09-19.md`
(pin `7499916886707c35ea708a17ef7a87e791a6bade`); on approval, run its independent
pre-action review over the pin delta first, then execute the bounded supervised
deployment. Dispatch the SMART and AIMS handoffs to their repository owners in
parallel. Generate/install directional keys only after both sides consume the
agreed names. Regeneration and publication remain separately locked.
