# One-shot C04-C: Focused Teaching Load repair modules (LOCKED successor)

Packet ID: `TT-TL-MODULES-C04`
Role: EXECUTOR (fresh session, only after unlock). Returns `REVIEW_REQUIRED`.
Risk tier: MEDIUM source with HIGH write/concurrency guards; no live apply,
deployment, generation, or publication.
Date authored: 2026-09-13 (Asia/Manila), from cycle TT-DYNAMIC-AUDIT-C04.

## 0. Status and unlock conditions

**LOCKED.** Do not dispatch this packet until both conditions hold:

1. `TT-DYNAMIC-WORKSPACE-C04` (packet C04-A) is integrated, because this
   packet edits client files that C04-A owns in parallel (rebases onto its
   integrated tree; ownership transfers after that integration).
2. Decision **D1** (faculty availability authority) is resolved before the
   class-5 availability module is implemented; the remaining modules may
   proceed without D1 once condition 1 holds.

The planner may split a server-only guard sub-packet (R1/R2/R4/R5 below) ahead
of unlock if the actor-school and phantom-endpoint risks are prioritized; that
split must be a separate planner decision, not an executor improvisation.

## 1. Governing references

- `D:/ATLAS/AGENTS.md` (canonical directive; normalized SHA-256 at authoring
  `29C1BD0600937B18C9B387B7F0A71A464E7EE8F7BC15D8A12B14AEE9CB41F81E`).
- `docs/reference/timetable-dynamic-workspace-and-warning-contract.md` §5.
- `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md` findings
  B-01…B-08, B-15, C-10 (TL surfaces), CP-8, and the server half of CP-2
  (B-11 publication predicate).

## 2. Objective

Provide the minimum focused Teaching Load repair modules reachable from the
Simple-first Timetable workspace, every one reusing the canonical Teaching Load
preview/apply authority with actor-school/year/run/revision/fingerprint/CAS
safeguards, and close the Timetable TL write-authority gaps. Do not duplicate
the full Teaching Load editor inside Timetable.

## 3. Worktree, base, and boundaries

- Worktree from refreshed `origin/main` at the planner-pinned base (must include
  integrated C04-A). Branch: `work/tt-tl-modules-c04`.
- **Owned paths (exclusive after unlock):**
  - `atlas-server/src/services/timetable-teaching-load-repair.service.ts`
  - `atlas-server/src/routes/timetable-teaching-load-repair.router.ts`
  - `atlas-server/src/services/reconciliation.service.ts`,
    `atlas-server/src/services/reconciliation-classifier.ts`
  - `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx`,
    `atlas-client/src/components/timetable/TacticalSandboxDock.tsx` (+ its
    helpers), `atlas-client/src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx`
  - Repair-entry regions of `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
    and `TimetableSimpleHeader.tsx` after rebasing on C04-A (serialized
    ownership: rebase, then edit only the repair entry points).
  - New tests: `atlas-server/src/__tests__/tt-tl-modules-*.test.ts`,
    `atlas-client/src/lib/__tests__/tt-tl-modules-*.test.ts`.
  - Handoff: `docs/handoffs/tt-tl-modules-c04-executor.md`.
- **Forbidden:** warning-authority files (`constraint-validator.ts`,
  `scheduling-policy.service.ts`, `manual-edit.service.ts`,
  `pre-generation-draft.service.ts`, `generation*.ts`,
  `publication-contract.service.ts`, `useTimetableData.ts`, `types.ts`, warning
  label maps), `timetable-sync-setup.service.ts`/`timetable-quick-place.service.ts`
  (S4), living register, `CHANGELOG.md`, runtime map.
- **Forbidden actions:** live data writes/apply, deployment, generation,
  publication, migration, term-cache/TL apply, login, companion-repo edits,
  pushing branches.

## 4. Required outcomes and failing-first controls

### R1 — Actor-school/active-year authority on every TL repair route (B-01)

- Every route in `timetable-teaching-load-repair.router.ts` (repair
  preview/apply, annual preview/apply, reconciliation preview/apply) must
  compare the requested `schoolId`/`schoolYearId` with the authenticated actor
  school and the elected active year before any service call and before any
  write, exactly like `faculty-assignment.router.ts:33-45`.
- Mandatory mounted route matrix with disposable PostgreSQL: missing/invalid
  JWT, system-token behavior, non-privileged role, missing actor school,
  cross-school actor, malformed scope, valid same-school actor; prove zero
  downstream dispatch on every rejection and the exact permitted write count.

### R2 — Qualification/authority before ownership creation (B-07)

- `applyTeachingLoadRepair` must evaluate the receiving teacher's qualification
  and department/program authority through the canonical evaluators
  (`teaching-load-automation.service.ts:1248`,
  `teaching-load-suggestion-proposal.service.ts:617-625`, department-authority
  preview) before creating `FacultySubject` rows or ownership; an unqualified
  target fails preview with a typed reason.
- Control: unqualified-target fixture — preview refuses with zero writes; old
  behavior creates `FacultySubject` (`timetable-teaching-load-repair.service.ts:905-923`).

### R3 — Bind TL repair output to its source snapshot (B-04)

- TL repair preview/apply must bind computed output to the same preflight
  fingerprint that produced it (pattern: `timetable-sync-setup.service.ts:128-133,716-731`);
  a covered-input change between preview and apply fails closed with zero
  ownership/run/audit writes. Do not clear unrelated stale domains on write.
- Control: deterministic interleave — change one non-demand input (e.g., a room
  or qualification) between preview and apply → typed failure, zero writes.

### R4 — Phantom reconciliation endpoint (B-02; decision D3)

- If D3 = retire: remove `applyRunReconciliation` (or replace with a typed 501/
  typed rejection), remove the route from the public surface, and keep preview
  intact; if D3 = implement: the apply must actually persist the reconciled
  schedule with CAS + snapshot binding and tests. Do not leave an `APPLIED`
  response that only writes an audit row (`reconciliation.service.ts:77-138`).

### R5 — Annual apply CAS (B-08)

- Either retire `applyAnnualTeachingLoadChange` or give it version/fingerprint
  CAS, actor-school/active-year guards, and a timetable-impact preview. No
  ignored CAS parameters.

### R6 — Focused modules (contract §5)

Implement, as Timetable entry points that reuse canonical preview/apply and
show timetable impact before commit:

1. **Owner change** for one subject-section pair (guarded per R1/R2/R3).
2. **Teacher departure / long-term absence** with an explicit absence window;
   Published mode routes to effective-dated revisions.
3. **Overload/underload redistribution**: keep the Teaching Load page as home;
   Timetable shows a summary card that reuses the canonical suggestion proposal
   + reconciliation authority; never duplicate the editor.
4. **Qualification/department/program repair module** (B-15): client entry
   points for capability overrides / department authority preview+apply.
5. **Availability change** (class 5): blocked on D1; if D1 resolves to adopt
   availability as an input, this module must reuse the canonical
   placement/repair authority and the persisted availability source.
6. **Setup-drift** routing/copy: route the operator to the canonical sync with
   per-domain messaging; do not implement a parallel sync.

### R7 — Strict publication predicate on the TL repair authority (B-11 server half)

- `timetable-teaching-load-repair.service.ts:1024,1042` must use the canonical
  strict predicate `summary.isPublished === true` instead of loose
  `publishedAt`/`publishedBy` markers. Superseded runs are not published: the
  repair path must follow the normal repair rules for their actual state, while
  a genuine published run still routes to effective-dated revisions.
- Control: superseded-run fixture — the apply/edit path does not refuse a
  genuinely unpublished run with `RUN_ALREADY_PUBLISHED`, and any
  operator-facing publication indicator it renders is truthful; a genuine
  published run still refuses with zero writes.

A time-slot swap must never be labeled a teacher swap.

## 5. Mandatory gates

- `atlas-server`: `npm run build`; focused suites incl. the TL repair and
  reconciliation suites, `npm run test:faculty-assignment-pass5`, sync/quick
  place suites where shared helpers are touched, plus new `tt-tl-modules-*`
  tests; disposable-PostgreSQL route matrix for R1 (zero-write rejections);
  no-residue proof for the R2/R3 mutants.
- `atlas-client`: `npx tsc --noEmit` (or repo-exact), `npm run build`,
  `npm run test:timetable-operator-ux`, plus new module tests.
- `git diff --check`; clean staged-path audit; no test removals without mapped
  replacement coverage.

## 6. Browser QA requirements (no login authorized)

- Module interaction rows: component tests by default; `ISOLATED_LOCAL_BROWSER`
  matched-candidate runs only if a disposable local database exists (never the
  shared `.env` DB).
- Tailnet authenticated rows require an existing reusable session with origin
  assertion; otherwise `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`. No login, no
  credential requests, no live writes.

## 7. Review, correction budget, and return contract

- Fresh independent QA on the immutable range; maximum two correction rounds;
  additive commits only.
- Return one handoff with base/candidate SHAs, changed paths, trace table,
  decisive evidence, browser labels, known risks, and `REVIEW_REQUIRED`.
