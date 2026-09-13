# TT-SYNC-TERM-C03R4 — Canonical per-term “Sync timetable setup” correction

Status: `INTEGRATED` (wave audit pending) · Base `def0dcc9` · Candidate
`09027671` · Merge `5328c9f6` · Cycle `tt-sync-term-c03r4-20260913`

This file records the durable governing packet for the correction executed on
2026-09-13. The executor and QA received the same acceptance contract through
the planner task; this document preserves it for recovery.

## Objective

Correct the mounted “Sync timetable setup” workflow so it cannot destroy,
suppress, or falsely satisfy the explicit ordered-term schedule truth
integrated by `TT-OUTPUT-C03R3`. After correction, setup synchronization
preserves the same canonical
`(subject, section, termIndex, weekday, interval, faculty, room)` authority
used by generation, readiness, repair, selected-term views, and official
outputs.

## Confirmed root causes

1. `timetable-sync-setup.service.ts` matched demand using subject and section
   only.
2. It compared total matching entries across all terms with one term-agnostic
   `sessionsPerWeek` count.
3. A complete T1 schedule could falsely satisfy missing T2/T3 demand.
4. Wrong-term retained entries could suppress the correct term’s unassigned
   item.
5. Rebuilt unassigned items omitted `termIndex`.
6. `classesProcessed` and diagnostics were computed from collapsed per-pair
   demand.
7. The route is mounted and invoked by the visible Sync setup action.
8. The mutation route never required actor school == requested school.
9. The service computed its update from a run read outside the transaction and
   updated by `runId` without a version CAS.

## Required correction (implemented)

- Exact canonical per-term demand via `buildDerivedDemand` →
  `toPerPairDemandItems` (subject + section/cohort + `termIndex` + weekly
  session ordinal).
- Retained compact entries expand only through
  `resolvePerTermScheduleEntries`; a present-but-invalid/out-of-contract term
  fails closed (never coerced to Term 1).
- Persisted entries are canonical resolved per-term entries (explicit positive
  `termIndex`, unique `entryId`, `sourceEntryId` retained), matching the
  publication contract’s `validateScheduleEntries`.
- Every rebuilt unassigned item carries an explicit positive `termIndex`.
- Per-term conservation asserted before any write: assigned + unassigned ==
  canonical derived-demand per-term sessions.
- Summary counters, violations, and resource diagnostics recomputed from the
  same resolved per-term truth.
- Route authority: privileged role, positive integer actor id, positive
  integer actor school, requested school == actor school, valid year/run,
  positive integer `expectedRunVersion`; typed 403s with zero dispatch.
- Serializable transaction with in-transaction re-read/revalidation (school,
  year, publication state, version, derived-demand revision, ownership
  signature) and version-aware CAS (`RUN_VERSION_STALE` on mismatch); exactly
  one run update + one audit row per committed change.
- Identical retry returns `{ replayed: true, noChange: true }` with zero
  writes; completion notification only after a committed non-replayed update.
- Visible client sends `draft.version` as `expectedRunVersion`, classifies
  typed errors, single-flight-guards duplicate clicks, and refreshes only after
  a committed or replayed result.

## Failing-first controls (all reproduced by fresh QA)

A. T1-only MATH (5/week) → 5 T2 + 5 T3 unassigned, never “complete”.
B. BIO T1 / CHEM T2 / ES T3 rotation members never satisfy one another.
C. Correctly resolved three-term run → zero new unassigned, exact totals.
D. Missing term expands via canonical resolver; invalid term fails typed.
E. Per-term/per-overall conservation; old matcher/term-less mutants fail.
F. Mounted matrix (missing/invalid JWT, non-privileged, missing actor school,
   cross-school, malformed ids/version, valid same-school) with zero dispatch
   on every rejection and exact permitted write count on success.
G. Stale expected version → `409 RUN_VERSION_STALE`, byte-identical run,
   zero audit.
H. Two concurrent identical requests → exactly one commit, one typed stale
   rejection, never two updates/audits.
I. Replay of synchronized state → `replayed/noChange`, zero writes.
J. Client contract (body, typed errors, duplicate-click guard, refresh rule).
K. Regression re-runs (TT-OUTPUT-C03R/C03R3, readiness, candidate-domain,
   publication-readiness, exports).

## Boundaries

No live/shared database write, deployment, process restart, term-cache action,
Teaching Load apply, generation, publication, migration, schema change, or
companion-repository edit. Disposable `atlas_restore_drill_*` PostgreSQL
fixtures only, with zero-residue cleanup.

## Evidence trail

- Executor task `ses_f679c8bcfffejOJM5wsSLnzvs7`; commits `2c0f3378`,
  `52cb9e35`, `09027671`; worktree `D:\ATLAS-worktrees\tt-sync-term-c03r4`.
- Fresh QA task `ses_f67812ec1ffeuHBDkIaaZE7Dlg`: `ACCEPT_READY` 19/19/0/0.
- Integration merge `5328c9f6`; combined gates: server `tsc`/build + 11/11
  sync suite; client `tsc`/build + 6/6 contract suite; `git diff --check`;
  integrated product tree byte-identical to the reviewed candidate.
- Wave audit capsule committed at
  `docs/reviews/tt-sync-term-c03r4-20260913/wave-completion-audit.md`
  (when the audit closes).

## Non-blocking residuals

- `SOURCE_AUTHORITY_STALE` interleave has no deterministic failing-first
  control (fail-closed by inspection; bounded test hook recommended).
- Legacy HG/HOMEROOM advisory entries are displaced rather than preserved
  (unreachable from the current canonical generator; product intent for
  historical rows remains open).
- Deployment of the corrected source remains a separate HIGH action.
