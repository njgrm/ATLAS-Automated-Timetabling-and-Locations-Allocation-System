# TT-TL-AUTHORITY-GUARD-C04 — Immediate server-only correction

Role: `PLANNER` orchestrating one bounded executor and fresh independent QA.
Status: `READY_TO_DISPATCH`.
Risk: MEDIUM source with HIGH write-authority implications; no live write.

## Boundary

- Create `D:\ATLAS-worktrees\tt-tl-authority-guard-c04` on branch
  `work/tt-tl-authority-guard-c04` from refreshed `origin/main`.
- Read canonical `D:/ATLAS/AGENTS.md`; LF-normalized SHA-256 at authoring is
  `84047C3FCB54D78ED9DC71B8B009DE1209B15EE2D6BA317D73D2B3F2DD193149`.
- Read `docs/reference/timetable-dynamic-workspace-and-warning-contract.md`
  §5 and audit findings B-01, B-02, B-04, B-07, B-08, B-11, and CP-8.
- This is the server-only split explicitly permitted by
  `timetable-teaching-load-modules-one-shot-c04-2026-09-13.md` §0.

Owned production paths:

- `atlas-server/src/routes/timetable-teaching-load-repair.router.ts`
- `atlas-server/src/services/timetable-teaching-load-repair.service.ts`
- `atlas-server/src/services/reconciliation.service.ts`
- `atlas-server/src/services/reconciliation-classifier.ts`
- new focused server tests and one executor handoff artifact

Do not edit client files, warning-authority files, Teaching Load suggestion
automation/proposal files, the living register, runtime map, or companion
repositories. Preserve history; no amend/rebase/reset/merge/push.

## Required outcomes

1. Every timetable Teaching Load repair, annual change, and reconciliation
   route shall require a privileged authenticated actor with a positive school
   identity equal to the requested school and the sole active non-archived year
   equal to the requested year before service dispatch.
2. Repair preview/apply shall resolve receiver qualification and
   department/program authority through the canonical persisted evaluators
   before creating `FacultySubject` or ownership rows.
3. Repair output shall bind to the complete source snapshot and run version
   used to compute it. Any covered-input interleave shall fail with the typed
   stale result before ownership, run, audit, or notification writes.
4. Retire the phantom `applyRunReconciliation` public mutation path. It has no
   production client caller and must not return `APPLIED` or a fabricated
   version when only an audit row was written. Preserve a read-only preview
   only when it reports truthful non-authorizing output.
5. The annual Teaching Load change apply shall either be retired when no
   production caller exists or enforce actor-school/active-year authority,
   preview fingerprint, run-version CAS, and timetable-impact revalidation.
   Prove the chosen path from mounted production routes; do not retain an
   ignored version/fingerprint parameter.
6. All publication-state decisions shall use strict `isPublished === true`.
   `publishedAt` or `publishedBy` alone shall not redirect an unpublished or
   superseded run into revision behavior.
7. Keep this correction compatible with the later client-focused
   `TT-TL-MODULES-C04` packet; that successor shall consume these guarded APIs
   rather than reimplementing their authority.

## Mandatory failing-first controls

- Mounted missing-token, invalid-token, non-privileged, missing-school,
  cross-school, historical-year, archived-year, zero-active, ambiguous-active,
  malformed-scope, and same-school/current-year controls. Every rejection must
  prove zero service dispatch and zero writes.
- An unqualified or program-incompatible receiver is rejected before
  `FacultySubject`/ownership creation; an old-behavior mutant must accept it.
- Deterministic room, qualification, ownership, and run-version interleaves
  between preview and apply return the typed stale result with byte-identical
  protected tables and zero notification dispatch.
- The reconciliation mutation route is absent or returns a typed retired error
  and cannot create an audit-only false success.
- A stale annual preview cannot apply; replay is idempotent if that path remains.
- `isPublished:false` with stale publication markers follows unpublished-run
  rules; `isPublished:true` follows revision rules.

Use hermetic controls and a pre-provisioned disposable PostgreSQL fixture. Run
the focused repair/reconciliation suites, Teaching Load authority regressions,
sync/quick-place regressions where shared behavior is consumed, server
`tsc --noEmit`, production build, built-server route-mount smoke with rollover
automation disabled, and `git diff --check`.

Freeze one additive candidate and return `REVIEW_REQUIRED` with exact SHAs,
changed paths, mounted matrix, write tallies, remaining risks, and no-mutation
statement. Fresh QA shall inspect the exact immutable range and rerun the
decisive mounted/disposable controls. Integration remains head-planner-owned.

## Forbidden

No login, live/shared-database write, Teaching Load apply, generation,
publication, deployment, restart, migration, schema change, companion edit,
merge, or push.

Suggested commit:

```text
fix(timetable): close teaching-load repair authority gaps
```
