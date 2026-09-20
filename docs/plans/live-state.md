# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last verified: 2026-09-20 (planner reconciliation; live release restartability
repaired and independently proven)

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
- Hard dependency: the active server `node_modules` is a junction to
  `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules`.
  **That tree carries no generated Prisma client**: `node_modules\.prisma\client`
  is absent and `@prisma/client/default.js` throws `MODULE_NOT_FOUND` when it
  requires `.prisma/client/default`. The live process (PID 63688) survives only
  on modules loaded at its 09-18 start, so **the live release is not
  restartable** — a child respawn or a host reboot takes the demo down.
  Independently verified 2026-09-20 by direct path and module-resolution probe.
- Startable releases today (own, or junctioned tree carrying
  `.prisma/client/index.js`): `3d916b26`, `54dce67b`, `8eb0511b`, `20f07f59`
  (-> `78be1b76`), `405e5b18` (-> `20f07f59`), `78be1b76` (-> `8eb0511b`),
  `131baab7` (-> `405e5b18`). Non-startable: `74c1f12a` (live), `f0d65a53`,
  `4ce73d15`, `798cd783`, `3c4cc3cd` — all junctioned into `0eb3b67f`.
- The incumbent client `node_modules` is a junction to
  `E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules`; retiring that
  worktree would break the incumbent host build. Do not retire it.
- Rollback basis: **RESOLVED (2026-09-20).** `PRISMA-CLIENT-REPAIR-C01` added the
  ten missing generated-client files to `0eb3b67f` from the schema-, version- and
  engine-equivalent sibling `8eb0511baa53`, create-new-only, touching none of the
  17 pre-existing files. Independent post-action QA `ACCEPT_READY` 8/8/0/0 proved
  a fresh server process from the incumbent release starts on an alternate port
  and serves health, readiness and a DB-backed read, with the table (47/47) and
  sequence (48/48) maps unchanged. The recorded fallback `f0d65a53` remains
  non-startable and must not be relied on. Graft source `8eb0511baa53` is now a
  do-not-retire dependency.
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
  `ba9771a8` (`ACCEPT_READY` 10/10/0/0) for pin `134bcf28`, and was **repinned
  2026-09-20** to `7499916886707c35ea708a17ef7a87e791a6bade` at release
  `D:\ATLAS-runtime-supervised-74999168-20260920`. Operator approval was granted
  (delegated sentence read and accepted 2026-09-20) and stands. The repinned
  review's single blocking finding — no startable rollback basis — is resolved by
  `PRISMA-CLIENT-REPAIR-C01` above. The packet is now **r3, awaiting its bounded
  re-review** over the amendment (rollback basis plus the reviewer's non-blocking
  corrections); execute only after that clears. Every `origin/main` tip above
  `74999168` is docs-only, so the pin is functionally current. `D:` is 23.31 GiB
  free, below the 25 GiB warning threshold, so its disk projection remains a
  mandatory execution precondition.

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

Execute `CURRENT-SOURCE-LIVE-DEPLOY-C01` (r3) after its bounded re-review: the
repinned deploy now has a startable rollback basis and the operator's standing
approval, so the only open question is whether to spend the deploy now or after
the remaining unowned packets (`flag-compensation-slot-c01`,
`export-presentation-c12`). In parallel, dispatch the SMART and AIMS handoffs to
their repository owners. Generate/install directional keys only after both sides
consume the agreed names. Regeneration and publication remain separately locked.
