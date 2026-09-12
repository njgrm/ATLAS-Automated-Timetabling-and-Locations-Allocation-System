# TT-OUTPUT-C03R planner result capsule

Status: `ACCEPT_READY` (reviewed source candidate; not integrated by the bounded
planner)

Cycle: `tl-tt-c03r-parallel-source-cycle-2026-09-12` (Lane B, bounded planner)
Governing packet: `docs/prompts/timetable-beneficiary-output-c03r-2026-09-12.md`

## Immutable identity

- Worktree: `D:\ATLAS-worktrees\tt-output-c03`; branch `work/tt-output-c03`
- Base: `4e5ef1f60193a8225af7bceac13a34a4c126152d`
- Prior candidate: `378a1f710e913837cc79f0e2424939fa145ac8aa`
- Intermediate correction candidate: `bab7c8fe4c99a02158a5e3cd86c955da76aecb3a`
- Reviewed source candidate: `4f596af0ce47935ceb9f04ddfbc5223da323df9f`
- Correction commits (`378a1f71..4f596af0`, all additive): `280a3a8a`,
  `49732f06`, `ad6829d2`, `bab7c8fe`, `4f596af0`
- Capsule commit: the single docs-only commit directly above the reviewed
  candidate on this branch. Exact SHA is recorded in the bounded planner
  terminal report; the capsule commit is not the reviewed candidate and must
  not be reviewed as product.

## Task identities

- Executor task (both rounds): `ses_f6a0db4bdffeD7P73XuU3PhN8n`
- QA round 1: `ses_f69e7606fffel1B68l7nRUhIT5` — `CORRECTION_REQUIRED`,
  tally 24 / 23 / 0 / 0; failed row D1: `summary-teacher-schedule.xlsx` was
  cross-school fail-open.
- QA round 2 (fresh): `ses_f69d7bda1ffeaHjNVOffKHo48U` — `ACCEPT_READY`,
  tally 14 / 14 / 0 / 0.

## Reviewed source changed paths (complete range `4e5ef1f6..4f596af0`, 23)

- `atlas-server/src/routes/generation.router.ts`
- `atlas-server/src/services/workbook-export.service.ts`
- `atlas-server/src/services/class-program-matrix.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/teacher-program-export.service.ts`
- `atlas-server/src/services/room-schedule.service.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/docx-export.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/__tests__/tt-output-c03r.test.ts` (A)
- `atlas-server/src/__tests__/tt-output-c03r-route.test.ts` (A)
- `atlas-server/src/__tests__/timetable-output-export-c03.test.ts` (A)
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/room-schedules/OccupancyTemplatePreview.tsx`
- `atlas-client/src/components/room-schedules/ScheduleTimetableGrid.tsx`
- `atlas-client/src/lib/schedule-pivot.ts`
- `atlas-client/src/lib/timetable-live-conflict.ts`
- `atlas-client/src/lib/timetable-utils.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/types.d.ts`
- `atlas-client/src/lib/__tests__/timetable-day-scope-c03r.test.ts` (A)
- `atlas-client/src/lib/__tests__/timetable-output-c03.test.ts` (A)

## QA verification

Independently rerun by final QA on the frozen candidate: mounted route suite
5/5 with 0 skipped (cross-school summary 403 `CROSS_SCHOOL_DENIED` with zero
downstream dispatch; same-school summary 200 `spreadsheetml` with zero writes);
`tt-output-c03r` 11/11 with real exceljs XLSX cell reads; output-export suite
7/7; server `tsc --noEmit` exit 0; server production build exit 0;
`git diff --check` clean. The final QA also produced a scratch mutant with the
new summary-route guard line removed: the cross-school summary request then
returned 200 instead of 403, proving the guard is load-bearing.

Environment note: this worktree's `atlas-server/node_modules` junction was
repointed during the lane from the broken partial install
`D:\ATLAS\atlas-server\node_modules` to the complete tree
`D:\ATLAS-runtime-supervised-20260912\atlas-server\node_modules` (untracked
link; target read-only; no installs or `prisma generate` were run).

## Findings and remaining risks

- No BLOCKING findings; D1 is closed on the reviewed candidate.
- NON_BLOCKING and explicitly accepted for this source lane: no in-repo client
  caller passes `termIndex` to the export routes yet, so default downloads are
  all-term while explicit term selection is fully implemented and tested
  server-side. The head planner may schedule a bounded client term-parameter
  wiring follow-up; it is not a defect of this candidate.
- NON_BLOCKING: matrix JSON cells gained `day`/per-weekday shape (additive; no
  in-repo consumer found).
- NON_BLOCKING: the teacher-program DOCX guard has no mounted cross-school test
  (the packet required mounted tests for class-program.xlsx and
  class-program-matrix only; the same guard pattern is proven on those and on
  the summary route).
- NON_BLOCKING: `PolicySpecialEvent` has no persisted `dayOfWeek` column
  (verified at `prisma/schema.prisma`), so the corrected services derive day
  scope from the canonical Flag/HGP identity; behavior-preserving.

## Confirmation

- This capsule is docs-only and was committed after the `ACCEPT_READY` verdict
  on the frozen reviewed source candidate; no product or test bytes changed
  after that verdict.
- No live/shared database access, no library installs, no generation,
  publication, deployment, restart, Teaching Load mutation, migration/schema
  change, companion-repository edit, or shared-document edit occurred in this
  lane. No push was performed.

## Next action for the head planner

Review `4e5ef1f6...4f596af0` and integrate the reviewed source candidate
`4f596af0` from a clean current-main boundary. Do not treat this capsule commit
as the reviewed candidate. No HIGH action is authorized by this capsule.
