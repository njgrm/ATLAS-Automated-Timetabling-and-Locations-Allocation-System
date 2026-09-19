# ATLAS Live State

Current operational truth only. Git history and handoff documents retain older
evidence. Update this file when a live fact, blocking decision, or next action
changes.

Last verified: 2026-09-19 17:20 +08

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

- Current source is ahead of the deployed release. Deployment remains a
  separate HIGH action.
- Public schedule cells still merge entries from three ordered terms; a source
  correction packet is required before presentation.
- Warning totals must represent unique issues within each term, preserve term
  identity, remove false zone warnings, and correct floor-transition wording.
- `UX-R01-SHARED-CHROME-C01` is independently accepted for integration: shared
  SMART-style breadcrumbs, PageHeader, semantic Card/state primitives, and a
  mechanically enforced 12px application-chrome floor. It is foundational and
  does not complete page-level UX-R02-R05.
- `COMPANION-DIRECT-FEDERATION-C04` is in source correction. Existing runtime
  SSO supports EnrollPro only; SMART/AIMS keys must not be installed until the
  reviewed peer registry exists and both companion implementations agree on
  directional key names.
- Direct SMART and AIMS federation requires two independent secrets per peer
  pair. Companion repositories remain read-only from ATLAS work.

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

Finish and independently review `COMPANION-DIRECT-FEDERATION-C04`, integrate it
with the accepted shared-chrome source, then prepare one deployment/env packet.
In parallel, author the public term-scoping correction. Regeneration and
publication remain locked behind a separate explicit HIGH approval.
