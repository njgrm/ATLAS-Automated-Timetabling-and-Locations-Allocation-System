# TEACHING-LOAD-CLARITY-C02 handoff (Lane C)

- **Base:** `e475c673` · **Candidate:** `d66510ea` on `work/lane-c-teaching-load-clarity-c02` · **Tier:** MEDIUM
  (client-only production copy and one count; no API, schema or limit-semantics change)
- **Source findings:** A1, A2, A4–A9 in `docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md`.
  A3 (0 class advisers) is **not** addressed: it needs a live data check (see Risks).

## What and why

- **A1 (wrong number):** `TeacherGridMode` summed `sectionIds.length` per subject assignment, so a section taking two
  rotating subjects counted twice. New `lib/teaching-load-counts.ts#countDistinctSections` counts distinct sections.
- **A2 (two limits, one name):** the policy hard cap (40h; decides the summary's "above hard cap") is now "School hard
  cap"; the teacher's own `maxHoursPerWeek` (30h; drives the teacher's "Over maximum" status, as before) is "max for
  this teacher". Deliberately no semantic change — the server also uses both (`teaching-load-reconciliation` uses the
  policy cap; `faculty-assignment.service` uses per-teacher maximums).
- **A4–A9 (wording):** `TeachingLoadTruthPanel`, `WorkloadInspector`, `StackedWorkloadBar`, `SectionInspector`,
  `SubjectRow`, `WorkspaceToolbar`, `TeachingLoad.tsx`, `useTeachingLoadData`, `useTeachingLoadRepairQueue` — plain
  labels, subject names instead of codes, term labels on rotating subjects, busiest-term wording, state-matched
  guidance, 10px captions raised to 12px. All `data-testid`s unchanged.

## Commands run

- `npm run test:teaching-load-clarity` 8/8; failing-first on base (module absent).
- `test:client-suite`: base 914/929 pass, candidate 922/937 pass; the 15 failures are identical by name; no
  candidate-only failure. The six Teaching Load suites: all pass except the two updated ones before update; after
  update `tl-authority-diagnostics-cold-load` 18/18, `tl-operator-workspace-c05-r3-truth` 16/16 (old assertions kept
  as SUPERSEDED comments; the cached-never-claims-verified and temporary-count contracts still asserted).
- Production build with `VITE_ENROLLPRO_URL` exit 0. `tsc --noEmit` reports only three pre-existing errors in
  `timetable-post-deploy-c04/c05` and `timetable-scheduling-quality-c03` tests (missing `playwright`), present on base.

## Risks

- NON_BLOCKING: `TeachingLoadTruthPanel.tsx` labels were replaced with one `sed` pass (24 lines, UTF-8 verified, diff
  limited to those lines).
- NON_BLOCKING / needs data: **A3** — the summary reports 0 class advisers and 0h adviser credit. Check whether
  EnrollPro sends adviser assignments for SY 2031-2032; if it does, advisory credit is missing from every load.
- NON_BLOCKING: whether each teacher's own 30h maximum or the 40h school cap should decide "Over maximum" is a
  product decision, now visible instead of hidden.

## For the reviewer

Review `e475c673...d66510ea`. Decisive checks: `countDistinctSections` replaces the sum; no limit/status logic
changed (only labels); test ids unchanged. Live check after deploy: Tolentino shows 3 sections.

**Worktree disposition:** `KEEP_ACTIVE` until integrated, then `RETIRE_AFTER_INTEGRATION`.
