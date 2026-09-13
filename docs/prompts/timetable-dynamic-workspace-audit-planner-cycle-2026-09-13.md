# CYCLE ON: TT-DYNAMIC-AUDIT-C04

Run one end-to-end **planner-led, read-only audit cycle** that determines the
target architecture and next implementation waves for a dynamic Timetable
workspace. Use bounded parallel auditors to reduce elapsed time. This cycle
must finish with durable findings and executable one-shot prompt packets; it
must not implement product changes.

## Identity and authority

- Role: **HEAD PLANNER / AUDIT ORCHESTRATOR**.
- Product source baseline: `f3ac4809002dfc0a78eb4834e86400e702a10421`.
- Required ancestor content: TT-OUTPUT-C03R3, TT-SYNC-TERM-C03R5, and
  TL-SUGGESTION-C03R are integrated in that baseline.
- Create a clean worktree from refreshed `origin/main`; do not use the dirty
  `D:/ATLAS` checkout as a write or integration boundary.
- Canonical directive: `D:/ATLAS/AGENTS.md`, normalized SHA-256
  `77BAB63DD998930551CF21456ABA16035F3AB5B2B2C9AA8A745C3C0C66A20C95` at
  packet authoring time. Recompute and obey the current canonical file if it
  has legitimately advanced.
- Read `docs/reference/atlas-runtime-source-of-truth-map.md`,
  `docs/plans/atlas-active-delivery-streams.md`,
  `docs/analysis/timetable-operator-readiness-audit-2026-09-11.md`, and
  `docs/verification/timetable-simple-operator-audit-2026-09-11.md` before
  delegating.

## Terminal objective

Produce a source-evidenced answer to all of these questions:

1. Should pre-generation and post-generation remain separate operator
   products, or become modes of one Timetable workspace?
2. Which material Advanced-view capabilities are absent, hidden, duplicated,
   or misleading in Simple view?
3. What persistent Save/Saved, Undo, Redo, history, stale-source, repair, and
   regenerate contracts are required before Simple can replace Advanced?
4. Which Teaching Load repairs belong as focused Timetable modules, without
   duplicating the full Teaching Load page?
5. Which hard and soft warnings are actually correct on the real production
   paths, which use weak or invented authority, and which are shown
   inconsistently between generation, manual edits, pre-generation previews,
   Simple, Advanced, and publication readiness?
6. What is the largest safe set of parallel one-shot implementation streams,
   with exclusive file ownership and explicit dependencies?

## Product decisions already made

Treat these as governing direction, not questions to re-open:

- **One Timetable workspace** is the target. It has lifecycle modes such as
  Plan, Review, and Published; it is not two disconnected products called
  pre-generation and post-generation.
- The underlying mutation authorities remain distinct: pre-generation draft
  placement and generated-run revision/edit contracts must not be collapsed
  into a client-only shared state model.
- **Simple is the primary operator experience.** Advanced may remain as
  temporary expert diagnostics/panels, but it must not own a material workflow
  that Simple cannot reach.
- Do not add an ambiguous global Save button merely because the current UI
  lacks one. Determine and specify truthful `Saving`, `Saved`, `Save failed`,
  preview-pending, version-stale, Undo, Redo, and history behavior for each
  lifecycle mode.
- Retire the active **Euclidean building-coordinate-as-meters** warning and its
  operator-facing policy control. Canvas `Building.x/y` values have no verified
  physical scale and must not be described as meters. Preserve old database
  fields only as deprecated compatibility data unless a later migration is
  separately authorized.
- Replace that false precision with auditable cross-building and cross-floor
  transition checks derived from building identity and room floor authority.
  The audit must recommend exact thresholds/buffer semantics and avoid warning
  on every harmless move.
- Soft warnings remain non-blocking unless an explicitly supported and
  trustworthy policy promotes them. No unreliable warning may be promotable to
  a hard publication blocker.
- ARAL Program creates no timetable demand, workload credit, or official
  export. Araling Panlipunan/AP remains an ordinary scheduled subject. HG is
  not a standalone load/demand row. Flag Ceremony/HGP is a Monday-only overlay
  on the underlying advisory period.

## Parallel audit wave

Spawn exactly three fresh auditors in parallel. They are **read-only auditors**,
not planners, executors, integrators, or prompt authors. They may not edit,
commit, merge, push, deploy, log in, generate, publish, or mutate any data.
Each must return concrete `path:line` evidence and a passed/blocked/unperformed
tally. A report without production-path tracing is incomplete.

### Auditor A — Simple/Advanced click-path and state audit

Before testing, write an internal state map for: no active year, setup blocked,
no run, generation running/failed/completed, generated review, stale inputs,
unassigned sessions, hard violations, soft-only warnings, published, and
archived/read-only.

Then inventory every visible or menu-based action in both
`TimetableSimpleHeader` and `ScheduleReviewWorkspaceHeader`, plus selected-cell
actions, task drawers, rails, dialogs, sheets, export controls, term switcher,
map/policy entry points, room requests, sync, generation, publication, and edit
history. Trace each control to its real handler, API route, service, and state
transition. Identify dead controls, duplicate controls, inconsistent guards,
hidden Advanced-only production capabilities, controls that merely deep-link
without preserving context, and state that can survive a school/year/run/term
change incorrectly.

Explicitly verify:

- component-local `activeSimpleTask`, readiness, teacher-departure, details,
  and repair state across school/year/run/term changes;
- exact publication truth versus stale `publishedAt`/`publishedBy` metadata;
- client privilege decisions sourced from authenticated actor authority rather
  than mutable local-storage role strings;
- policy-read failure behavior, including permissive defaults;
- visibility and durability of Undo/history, absence or presence of Redo, and
  whether automatic commits are truthfully explained;
- whether Simple can reach Policy, setup-sync impact, room/map work, requests,
  selected-class teacher/room/time repair, generation impact, and official
  exports without switching to Advanced.

### Auditor B — dynamic lifecycle and Teaching Load authority audit

Trace how changes to policy, ordered terms, subjects, sections, rooms,
enrollment, faculty availability, Teaching Load ownership, and qualification
authority affect an existing generated run. Inspect generation input snapshots,
freshness checks, sync/setup correction, manual-edit CAS, edit history/revert,
regeneration, publication freshness, and compatibility with retained manual
anchors.

Define the target mode contract for Plan, Review, Published, and Archived. For
each source change, state whether the operator should see: no impact, an impact
preview, targeted repair, sync, regeneration, publication invalidation, or a
hard stop. Never allow silent refresh to make stale data appear current.

Audit the existing Timetable Teaching Load controls and decide the minimum
focused modules required. At least distinguish:

- change the owner of one subject-section pair;
- teacher departure/long-term absence affecting all owned classes;
- overload/underload redistribution using the canonical Teaching Load
  suggestion authority;
- qualification/department/program authority repair;
- availability change that moves sessions without changing ownership;
- added/retired demand or setup drift requiring setup sync.

Do not call a time-slot swap a teacher swap. Do not duplicate the full Teaching
Load editor in Timetable. Every focused module must reuse the canonical
Teaching Load preview/apply authority, show timetable impact before commit, and
preserve actor-school/year/run/revision/fingerprint/CAS safeguards.

### Auditor C — warning provenance and accuracy audit

Build a matrix for every current hard/soft violation and policy override that
can appear in Timetable. For each code, record:

- authoritative input fields and their provenance;
- generator scoring consumer;
- canonical validation consumer;
- pre-generation preview consumer;
- generated manual-edit/swap consumer;
- persisted violation/read-model behavior;
- Simple and Advanced label/explanation/repair action;
- publication effect and whether `treatAsHard` is allowed;
- deterministic production-path test coverage and a negative/mutant control.

Pay special attention to travel/well-being, room capacity/type, consecutive
load/break, daily maximum/standard, idle gap, vacant time, early/late
preferences, section compression, qualification, shift windows, term scope,
special events, room/building/grade scope, and unresolved demand.

The auditor must prove or reject these suspected defects:

1. `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` computes Euclidean distance from map
   canvas coordinates but labels it in meters.
2. There is no equivalent production `cross-floor` warning despite persisted
   room floor data.
3. One master `enableTravelWellbeingChecks` switch incorrectly couples travel,
   idle-gap, and early/late preference families.
4. Default `constraintConfig` allows unreliable warnings to be enabled or
   promoted inconsistently.
5. Cross-term sessions are or are not grouped correctly in every faculty/day
   warning calculation.
6. Warnings displayed after manual edits are or are not recomputed from the
   same effective selected-term schedule truth used by generation/readiness.

## Planner consolidation and independent verification

After all three auditors return:

1. Verify every P0/P1/P2 claim independently against the frozen source. Reject
   conclusions based only on helper functions, grep counts, screenshots, or
   tests that do not invoke the real production entry point.
2. Deduplicate findings by root cause. Distinguish product defects, UX defects,
   correctness defects, technical debt, and externally blocked live evidence.
3. Rank fixes by operator harm and dependency, not by file convenience.
4. Forecast merge conflicts against all worktrees and current `origin/main`.
   Never infer active execution from worktree presence alone; use commit and
   register evidence.
5. If the live Tailnet has a reusable authenticated session, browser checks may
   be read-only at `https://njgrm.buru-degree.ts.net` with an exact origin
   assertion. If no session exists, record
   `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` for browser-only rows and
   continue the full source audit. **Do not request or perform a login and do
   not stop the cycle.**

## Required durable outputs

The head planner alone writes these files:

1. `docs/reference/timetable-dynamic-workspace-and-warning-contract.md`
   - durable product memory and target operating model;
   - complete Simple/Advanced capability matrix;
   - lifecycle-mode/state-transition contract;
   - Save/Saved/Undo/Redo/history semantics;
   - Teaching Load mini-module boundary;
   - warning provenance and retirement/replacement decisions;
   - stakeholder schedule semantics already accepted;
   - unresolved decisions and dependency graph.
2. `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md`
   - current evidence, severity-ranked findings, exact source locations,
     browser evidence or honest blocked labels, and test gaps.
3. `docs/prompts/timetable-dynamic-workspace-one-shot-c04-2026-09-13.md`
   - one large full-stack implementation cycle for the unified Simple-first
     workspace, source-drift response, truthful persistence status, durable
     Undo/Redo/history, and Advanced capability migration.
4. `docs/prompts/timetable-warning-authority-one-shot-c04-2026-09-13.md`
   - one parallel full-stack warning-authority cycle that retires false metric
     distance, adds exact cross-building/cross-floor semantics, separates
     policy families, and proves warnings across all production consumers.
5. `docs/prompts/timetable-teaching-load-modules-one-shot-c04-2026-09-13.md`
   - a dependency-aware successor packet for focused owner/departure/
     redistribution/qualification/availability/setup-drift repairs. Mark it
     locked if the canonical suggestion/apply or dynamic shell dependency is
     not integrated.
6. Update `docs/plans/atlas-active-delivery-streams.md` with compact rows for
   this audit and the resulting implementation waves. Update `CHANGELOG.md`.

Each implementation packet must include exclusive file ownership, prohibited
overlaps, failing-first production-path controls, exact test/build gates,
browser QA requirements, fresh independent QA, maximum two correction rounds,
and `REVIEW_REQUIRED` executor status. It must explicitly forbid live mutation,
generation, publication, deployment, migration, and companion-repository
edits.

## Completion auditor

Freeze the docs candidate and commission one fresh **Wave Completion Auditor**
that did not participate in the three audits. It is read-only and must verify:

- all three auditor reports were consumed and material disagreements resolved;
- every material finding has source evidence and an owning stream;
- the two parallel implementation packets have genuinely disjoint file
  boundaries or an explicit integration-owner file list;
- no Advanced-only material workflow is silently abandoned;
- no client-only Undo/Redo or source-drift illusion is specified;
- false metric distance is actually retired from active behavior rather than
  merely relabeled;
- cross-building/floor semantics are term-aware and use authoritative fields;
- Teaching Load mini modules reuse canonical authority rather than create a
  parallel model;
- the living register has one consistent state in every section;
- no product/runtime/data mutation occurred.

If the auditor returns `CORRECTION_REQUIRED`, the head planner may perform at
most two bounded docs-only correction rounds and re-audit. Escalate only a real
product decision that is not already resolved above. Authentication absence,
browser unavailability, or missing live data must not halt this source/docs
cycle.

## Finalization

After `AUDIT_CLEAR`:

- commit the docs-only package with conventional commits;
- integrate and push it to `origin/main` from a clean current-main boundary if
  the remote has not acquired conflicting product work;
- perform no product-code merge;
- return the final SHA, exact paths, audit tallies, confirmed defects,
  resulting parallel stream order, exclusive path boundaries, outstanding
  dependencies, and the single next copy-ready planner-cycle instruction.

Terminal status is `COMPLETE` only when the durable contract, audit, all three
prompt packets, register update, completion audit, and push are present.
Otherwise return `PLANNER_DECISION_REQUIRED` with one exact missing decision.
