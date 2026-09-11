# UX-C01R — Generation Readiness Closure (Executor Handoff)

- Stream: UX-C01R
- Objective: gate Timetable generation on the canonical generation diagnostic,
  stop the Dashboard from overclaiming final readiness, and complete the mounted
  production-path proof.
- Worktree: `D:/ATLAS-worktrees/ux-c01-derived-setup`
- Branch: `work/ux-c01-derived-setup`
- Original base: `89440321260a9c4902cc20b7c5a642f47a74e35f`
- Prior candidate: `91d327e34d28f8a1c02ee41391b9323c89ed4362` (clean)
- Correction base: `91d327e34d28f8a1c02ee41391b9323c89ed4362`
- Correction tip: _(see the commit this file is added in)_
- Risk tier: MEDIUM source/UI with HIGH-risk interaction guardrails
- Verdict: `REVIEW_REQUIRED`

## Dependency (explicit)

This candidate is DEPENDENT on the GEN-C02R1 generation-readiness contract:

`GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic` →
`{ readiness: GenerationReadinessResult }`

owned by the GEN-C02R1 stream (`work/generation-genc02r1`). The endpoint is not
present in this candidate's base, so the client adapter is written and tested
against the pinned contract, and combined acceptance waits for both candidates.
No live generation, publication, Teaching Load apply, migration, deployment,
shared-runtime restart, or live-data mutation was performed.

## Before / after generation-readiness flow

- Before: `useTimetableData.fetchCurriculumReadiness` called
  `GET /api/v1/derived-demand/:schoolId/:schoolYearId/readiness` and mapped
  `data.ready` directly to a `ready` capability state → derived demand alone
  enabled generation.
- After: the same fetch calls
  `GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic`, parses
  the full diagnostic, and only reports `ready` when the diagnostic belongs to
  the exact actor school/year, `generateAllowed === true`, zero-write is true,
  the scheduler dry run executed, and there are zero blockers. Every blocked
  state carries the complete diagnostic and exactly one smallest repair.

Every visible generation trigger consumes the shared capability model
(`deriveTimetableCapabilities`): the Simple header lifecycle/`Preview demand`
action and the Advanced header `handleGenerationTrigger` both read
`generationGate.enabled`.

## Changed paths (correction)

- `atlas-client/src/lib/timetable-generation-readiness.ts` (new adapter)
- `atlas-client/src/lib/timetable-capabilities.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts`
- `atlas-client/src/lib/__tests__/uxc01r-generation-readiness.test.ts` (new)
- `atlas-client/package.json`
- `atlas-server/src/routes/derived-demand.router.ts`
- `atlas-server/src/__tests__/uxc01r-derived-demand-route.test.ts` (new)
- `atlas-server/package.json`
- `docs/progress/ux-c01-derived-setup-progress.md`
- `docs/handoffs/ux-c01r-generation-readiness-closure-executor.md`
- `CHANGELOG.md`

No GEN-C02R1-owned generation/preflight service, Teaching Load write/carry-forward
path, migration/schema, publication, or auth-middleware file was edited.

## Decisive evidence

- Client: `tsc --noEmit` clean; `npm run build` OK; `test:uxc01r` 36/36;
  `test:timetable-operator-ux` 58/58; `test:ux-guardrails` 21/21.
- Server: `tsc --noEmit` clean; `npm run build` OK; built-server health `200`
  and mounted derived-demand route `401` without a token; `test:derived-setup-readiness`
  6/6; `dashboard-lifecycle-truth` 11/11; `uxc01r-derived-demand-route` 5/5.
- Disposable PostgreSQL: mounted route zero-write with unchanged census, plus a
  rolled-back positive control proving the census is sensitive; disposable DB
  dropped with zero residue.

## Derived-ready-but-generation-blocked negative controls

Proven in `uxc01r-generation-readiness.test.ts`: a fully derived-ready year with
a missing exact Teaching Load owner, an out-of-shape entry, a stale source
revision, a policy/template/window gap, or a hard-validator blocker remains
generation-blocked where the retired raw `data.ready` boolean would have enabled
generation; the blocked state keeps every blocker and exposes one repair.

## Dashboard decision evidence

`pickNextStep` for `PREFERENCES` returns `Check generation readiness` →
`/timetable`; the copy no longer claims "Setup is complete" or zero blockers; the
Teaching Load checklist item distinguishes subject-level coverage from exact
subject-section ownership; derived demand is labelled an input milestone.

## Browser verification

- Preserved: the previously completed Tailnet redirect/navigation/mobile
  evidence remains valid.
- Ready-diagnostic matrix: `BLOCKED_EXTERNAL`. It requires a matched isolated
  candidate server exposing the GEN-C02R1 diagnostic; the shared local server
  serves pre-Wave-1 source without the diagnostic and could not authenticate the
  isolated preview client. This is fail-closed compatibility evidence only and
  is deferred to combined integration.

## Return

`REVIEW_REQUIRED`. Fresh independent QA must review the complete immutable range
and classify this candidate as dependent on the GEN-C02R1 contract until combined
integration gates pass.
