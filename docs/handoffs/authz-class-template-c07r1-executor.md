# AUTHZ-CLASS-TEMPLATE-C07R1 — executor correction handoff

Status: `REVIEW_REQUIRED`
Role: `EXECUTOR` (reasoning variant `high`)
Cycle: `AUTHZ-CLASS-TEMPLATE-C07` (correction round R1)
Base SHA: `917da8be1c0dea13e2a5062f3883cce82c829384`
Prior candidate: `19f217294c5224d62e33c4d29e7d7cde26ca9a1e` (integrated at merge `f5731fc79c71140a34609eea4221022f9ccfd416`; not amended)
Worktree: `E:/ATLAS-worktrees/authz-class-template-c07`
Branch: `work/authz-class-template-c07`
New tip SHA: recorded on `work/authz-class-template-c07` (three additive commits on top of `19f21729`)
Worktree disposition: `RETIRE_AFTER_INTEGRATION`
`PLANNER_SESSION_ROUTE: EXISTING`

## Changed paths for the full `917da8be...<new tip>` range

Carried from R1 (unchanged content, unchanged commit `19f21729`):

- `atlas-server/src/routes/class-template.router.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/__tests__/class-template-authority-c07-guard.test.ts`
- `atlas-server/src/__tests__/class-template-authority-c07.test.ts`
- `docs/handoffs/authz-class-template-c07-executor.md`

Added by this correction round:

- `atlas-server/src/services/class-template.service.ts` (R2 subject tenant binding)
- `atlas-server/src/__tests__/class-template-authority-c07.test.ts` (R2 mounted rows)
- `atlas-client/src/pages/Audit.tsx` (R3 consumer truthfulness)
- `atlas-client/src/lib/audit-section-coverage.ts` (new pure decision helper)
- `atlas-client/src/lib/__tests__/audit-section-coverage.test.ts` (new node:test suite)
- `docs/handoffs/authz-class-template-c07r1-executor.md` (this file)

`atlas-server/src/routes/class-template.router.ts` was **not** changed in this round: the new subject
rejections are typed errors thrown by the service and mapped by the existing error handler, so no
route mapping was needed.

## R2 — subject bundle tenant binding

`assertSubjectsBelongToSchool(tx, schoolId, subjectIds)` is called **inside** the same interactive
transaction as the write, before any `classTemplate` / `classTemplateSubject` mutation:

- scoped resolution `tx.subject.findMany({ where: { id: { in: requested }, schoolId }, select: { id: true } })`;
- any unresolved id that resolves to a subject owned by another school → typed `403 CROSS_SCHOOL_DENIED`
  (`Cannot bind another school’s subjects to this class template.`);
- any unresolved id that does not exist at all → typed `400 INVALID_PARAM`
  (`subjectIds contains one or more subjects that do not exist.`);
- any non-positive-integer id → typed `400 INVALID_PARAM`;
- `createTemplate` was restructured into one interactive transaction (period-structure validation,
  subject-scope validation, then the create with nested bindings);
- `setTemplateSubjectsForSchool` keeps its owner check and adds the subject-scope check before
  `deleteMany` + `createMany`.

Exact commands and observed results:

| Row | Command | Observed |
|---|---|---|
| R2-a | `npx tsx src/__tests__/class-template-authority-c07.test.ts` (from `atlas-server`) | `R2` section all PASS; `RESULT: 111 passed, 0 failed` — foreign `subjectId` on `PUT /:id/subjects` and on `POST /` → `403 CROSS_SCHOOL_DENIED`, zero `classTemplateSubject` deltas, `classTemplateSubject.count({ subjectId: <foreign> }) === 0`; unknown id → `400 INVALID_PARAM` with zero writes; mixed foreign+unknown → `403`; actor's own `GET /class-templates?schoolId=<C>` never contains `A_FOREIGN_MATH` / `A Foreign Mathematics`; positive same-school `PUT` → `200` (1 binding) and `POST` with `subjectIds` → `201` (1 binding) |
| R2-b | `npx tsc --noEmit` / `npm run build` (from `atlas-server`) | exit `0` / exit `0` |
| R2-c | R2 mutant (remove the subject-school validation) | post-commit run; exact observed output in the executor return |

## R3 — Audit consumer truthfulness

New pure helper `atlas-client/src/lib/audit-section-coverage.ts` owns the decision:

- `assessSectionCoverage({ templates, available, sections })` → `{ state, coverageUnverified, degradedReason, sectionsWithoutTemplate, unresolvedFinding }`;
- `NOT_INITIALIZED` (fulfilled but empty) → `coverageUnverified: true`,
  `degradedReason: 'Class templates are not initialized for this school.'`, and a
  `severity: 'blocker'` finding titled `Section coverage is UNRESOLVED: no class templates are initialized`;
- `UNAVAILABLE` (rejected promise) → the existing reason `'Class templates are unavailable.'` is kept,
  plus a `blocker` UNRESOLVED finding (same defect class: a rejected read must not leave a green
  section-coverage claim either);
- `INITIALIZED` with an unmatched section `programCode` → `blocker` UNRESOLVED finding naming the
  program types that were previously skipped silently by `rosterGaps`;
- fully matched template set → `coverageUnverified: false`, no reason, no finding.

Exact `Audit.tsx` wiring:

- import line:
  `import { assessSectionCoverage, type SectionCoverageAssessment } from '@/lib/audit-section-coverage';`
- call site (inside `loadData`, replacing the old inline fulfilled/rejected branch):
  `const coverage = assessSectionCoverage({ templates: loadedTemplates, available: templateRes.status === 'fulfilled', sections: ... });`
  followed by `setTemplates(loadedTemplates); setSectionCoverage(coverage); if (coverage.degradedReason) { reasons.push(coverage.degradedReason); }`
- render call site:
  `const unresolvedCoverageFinding: Finding | null = sectionCoverage?.unresolvedFinding ?? null;`
  then `...(unresolvedCoverageFinding ? [unresolvedCoverageFinding] : []),` as the first entry of
  `sectionFindings`, which the `section-gaps` group renders. No initialize affordance or write action
  was added to the client.

| Row | Command | Observed |
|---|---|---|
| R3-a | `npx tsx --test src/lib/__tests__/audit-section-coverage.test.ts` (from `atlas-client`) | `tests 7 / pass 7 / fail 0`, exit `0` |
| R3-b | `npx tsc --noEmit` / `npm run build` (from `atlas-client`) | exit `0` / exit `0` |
| R3-c | R3 failing-first mutant (restore the pre-fix empty-list decision) | post-commit run; exact observed output in the executor return |

Failing-first design: the suite rejects the pre-fix decision directly. `greenSectionStateReachable([],
'live') === true` is asserted as the control, and the same helper is asserted to make the state
unreachable once an empty class-template list is supplied. Reverting the `NOT_INITIALIZED` branch to
the pre-fix outcome (no reason, no finding) makes the suite fail.

## Preserved gates — re-run, not asserted

| Gate | Command | Observed on the corrected tree |
|---|---|---|
| G01–G06, G11, G13 | `npx tsx src/__tests__/class-template-authority-c07-guard.test.ts` | `RESULT: 136 passed, 0 failed` (absent-database zero-dispatch control still load-bearing) |
| G06–G12 (+ new R2 rows), G18 | `npx tsx src/__tests__/class-template-authority-c07.test.ts` | `RESULT: 111 passed, 0 failed`; disposable DB dropped + `assertDropped()`; configured source DB read-only probe reports `0` fixture schools |
| G14/G15/G16/NC4 (R1 mutants) | not re-run this round | unchanged tree for the router and for the R1 code paths; the R1 mutant evidence remains valid for `19f21729` |

## Production-shape parity — subject-scope boundary

| Row | Value |
|---|---|
| Real producer | `Subject(schoolId)` rows → `assertSubjectsBelongToSchool` (scoped `subject.findMany` inside the write transaction) → `classTemplateSubject` create → `TEMPLATE_INCLUDE` projection → `GET /class-templates?schoolId=<actor school>` |
| Real consumers | `atlas-client/src/pages/Audit.tsx:144` (`GET /class-templates?schoolId=<actorSchoolId>`), and `Audit.tsx`'s section-coverage decision via `audit-section-coverage.ts` |
| Conservation | every bound `subjectId` belongs to the template's school; zero foreign subject ids are bindable through either write path; the actor's own read never projects a foreign subject `code`/`name`; rejected requests leave `classTemplate`, `classTemplateSubject`, and `auditLog` counts unchanged |
| Negative control | R2 mutant (subject-school validation removed) → the foreign subject is bound and projected, and the new R2 rows fail |
| Result | PASS |

## Mutants (run after the commits)

Protocol: copy the pristine committed bytes to
`C:\Users\njgro\AppData\Local\Temp\opencode\`, mutate, run the named control, copy the pristine bytes
back, then prove `git status --porcelain=v2` empty and `git diff --quiet` clean with the tip SHA
unchanged.

- `R2-MUTANT` — remove the `assertSubjectsBelongToSchool` calls from both write paths
  (disposable suite; expect the new R2 foreign-subject rows to fail).
- `R3-MUTANT` — restore the pre-fix empty-list decision in `audit-section-coverage.ts`
  (client helper suite; expect the empty-list test to fail).

Exact observed output for each mutant is recorded in the executor's returned report; the mutants run
after this commit so their byte-restoration proof is necessarily post-commit evidence.

## Known risks

- `NON_BLOCKING` — the R3 helper additionally reports an UNRESOLVED coverage finding when the read
  rejected and when a loaded section's `programCode` has no matching template. Both are the same
  truthfulness defect the auditor cited (`rosterGaps` silently skipping unverifiable sections); the
  packet's mandatory empty-list behavior is a strict subset and its reason strings are unchanged.
- `NON_BLOCKING` — the R3 finding routes to `/sections` because no client surface manages class
  templates and the packet forbids adding an initialize affordance; the action label is
  `Review sections`.
- `NON_BLOCKING` — `createTemplate` now opens an interactive transaction for every create; the
  duplicate-program-type path still surfaces `P2002` → `409 DUPLICATE` (covered by G12).
- `NON_BLOCKING` — the `subjectIds` write path still does not de-duplicate ids (unchanged from R1);
  a repeated id would surface the composite-unique violation as before.
- `NON_BLOCKING` — this worktree has no committed dependency tree. `atlas-server/node_modules` and
  `atlas-client/node_modules` are read-only junctions to
  `E:/ATLAS-worktrees/generation-authority-realism-c07/{atlas-server,atlas-client}/node_modules`
  (server lock `ECF06AEF…B6E5`, client lock `CE1AE84E…B9F1`, `prisma/schema.prisma` `C5356296…487E`
  — all identical to this worktree). The previous server junction target
  (`published-immutability-archive-audit-c07`) was retired between rounds, so the junction was
  re-pointed to the verified surviving tree. No install was performed; `node_modules` is gitignored
  and is not part of the candidate.

No `BLOCKING` risk remains.

## Zero-mutation statement

No deployment, service restart, supervisor/task/env change, browser session, login, push, merge,
rebase, reset, or stash. `19f21729` was not amended. Nothing outside the owned paths was edited; the
existing client page/lib files, `prisma/**`, `ops/workflow/**`, `docs/plans/**`, and `docs/prompts/**`
are untouched. The only database touched was the guarded disposable database created by
`provisionDisposableDatabase('c07')` and dropped with `assertDropped()`; the configured source
database was read-only probed. No HTTP left `127.0.0.1`.
