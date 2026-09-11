# GEN-C02 — Canonical Generation Readiness and Zero-Blocker One-Shot

## Objective

Make every pre-generation and generation-readiness path consume the accepted
derived-demand authority, eliminate the remaining split legacy demand paths,
and produce a reproducible read-only readiness/dry-run contract that leads to a
future zero-hard-blocker generation. Do not perform a live generation.

## Git and safety boundary

- Create/reuse a clean isolated worktree and neutral branch from current
  `origin/main`; record the base SHA.
- Commit an immutable candidate; do not amend, rebase, merge, or push.
- Own generation assembly/readiness/diagnostic, pre-generation draft and
  quick-place/sync demand consumers, grade-window/class-program-slot resolution,
  focused generation tests/docs, and `CHANGELOG.md`.
- Do not edit Teaching Load suggestion/carry-forward writes, Dashboard,
  Curriculum Requirements UI, migration/schema, publication writes, auth, or
  companion repositories.
- No live generation, publication, reconciliation/apply, deployment, restart,
  or live-data mutation.

## Required closure

1. Remove current-year production calls to legacy catalog `computeDemand()` or
   annual offering demand from `pre-generation-draft.service.ts`, quick-place,
   timetable sync/setup, and every reachable generation preparation path.
2. All consumers must receive the same derived timetable lines/revision and
   exact ordered EnrollPro terms. Projection loss, extra lines, revision drift,
   missing term authority, or Teaching Load mismatch must fail typed before any
   write or scheduler invocation.
3. Preserve pre-generation locked/manual placements only when their complete
   demand identity still exists and their source revision is current. Stale,
   reference-only, wrong-term, or removed demand must be reported, never
   silently carried into generation.
4. Build one read-only canonical readiness/diagnostic service and mounted
   privileged endpoint returning: authority revisions, pair/line/session totals
   by exact term, Teaching Load coverage, rooms/capacity/features, grade windows,
   class-program slots, policy, retained locks, scheduler assigned/unassigned,
   hard/soft violations, deterministic blocker ownership, and database
   signature/zero-write proof.
5. Resolve grade-window and class-program-slot gaps only from persisted policy,
   verified section/program data, or an already approved deterministic rule.
   Do not invent school-specific times, shifts, specialization counts, rooms,
   faculty, or exceptions. Missing authority remains one actionable blocker.
6. Use the same generation input assembly, scheduler, validator context, and
   snapshot-v2 domain as the real trigger. A helper-only simulator is invalid.
7. The dry run must be deterministic for identical inputs, bounded for the
   school dataset, and must not create runs, drafts, locks, audits, cycles,
   assignments, revisions, or notifications.
8. Classify every unassigned/hard result with an exact entity identity, term,
   reason, owning repair surface, and one next action. Distinguish data gaps,
   policy blockers, genuine resource infeasibility, and algorithm/search limits.
9. Provide a compact operator-facing readiness result usable by the Simple
   Timetable workflow: summary first, visual blocker groups, details on demand,
   and no Generate control until the server declares zero hard blockers and all
   required demand covered.
10. Generation itself remains HIGH. The production trigger must continue to
    require its existing authority and must not be called by tests against live
    school data.

## Required controls and QA

- Failing-first source and production-entry tests proving each named legacy
  consumer previously invoked `computeDemand()` and now consumes derived demand.
- Exact parity across derived demand, Teaching Load coverage, pre-generation
  draft, quick-place, sync/setup, scheduler input, validator input, and snapshot.
- Trimester and quarterly fixtures; rotation/reference-only/HG behavior;
  stale-lock/source-revision rejection; room capacity/type/features; faculty,
  section, and interval conflicts.
- Disposable PostgreSQL zero-write instrumentation around the mounted
  diagnostic, plus rolled-back positive controls and exact cleanup.
- Reuse the real scheduler in dry-run mode and assert before/after signatures,
  deterministic repeated output, no run/audit/lock writes, and bounded runtime.
- Generation passive-Teaching-Load, derived C01/R/R2, candidate-domain,
  pre-generation draft/quick-place/sync, snapshot/publication-freshness
  regressions, server/client TypeScript, builds, and diff-check.
- Isolated browser QA if an operator readiness surface changes; Tailnet evidence
  only after deployment, otherwise label it pending.
- One fresh independent changed-scope review; corrections are additive and get
  fresh QA.

Return `REVIEW_REQUIRED`, immutable SHAs, exact paths, legacy-consumer closure
matrix, authority/parity totals, zero-write dry-run evidence, complete blocker
matrix, measured runtime, remaining decisions, and zero-live-generation/
publication/mutation statement. If the dry run still has hard blockers, return
`GENERATION_BLOCKED` with the smallest evidence-backed successor decision list;
never claim readiness from a reduced or synthetic demand set.
