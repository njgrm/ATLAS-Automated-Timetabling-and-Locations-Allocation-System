# GEN-C01 — Canonical Generation Readiness One-Shot

## Objective

Make the canonical ATLAS generator ready for a later, separately approved live run using the now-persisted year-8 curriculum and reconciled Teaching Load. Prove source behavior and current-input feasibility honestly. Do not generate, save, publish, or mutate school-1 timetable data in this prompt.

## Workflow and Git boundary

- Risk tier: `MEDIUM` source implementation; any live generation remains `HIGH` and is excluded.
- Start from the current `origin/main` in a new clean worktree `D:/ATLAS-worktrees/generation-genc01` on branch `work/generation-genc01`. The executor creates the worktree. Record the full base SHA before editing.
- Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`, and `docs/reference/atlas-runtime-source-of-truth-map.md` first.
- Maintain one concise ledger at `docs/progress/generation-genc01-2026-09-10-progress.md`.
- Use the commit-based workflow. One fresh advisory review is required after implementation. Fix material findings and request one changed-scope review only if fixes were made.
- Commit the bounded candidate. Do not amend, rebase, merge, or push. Return the base SHA, candidate SHA, exact paths, decisive evidence, remaining blockers, and `REVIEW_REQUIRED`.

## Current accepted truth

- School 1 has sole active non-archived year 8 (`2029-2030`).
- Term config: 3 ordered terms. Curriculum: 216 active requirements, all 16 scopes configured.
- Teaching Load: POPULATED v5, 264 demanded/owned/valid pairs, zero unresolved reconciliation blockers.
- Timetable input preview: 552 demand lines / 2,760 weekly sessions, all individually previewable. This is not joint-feasibility proof.
- There are zero generation runs and zero published revisions. Therefore hard-constraint and generated-unassigned outcomes are currently `NOT_EVALUATED_UNTIL_CANONICAL_GENERATION`.
- HG/Homeroom Guidance consumes neither timetable demand nor teaching load. Advisory credit remains policy-based; do not create HG sessions.

## Authorized work

1. Trace the exact production generation route through input snapshot, demand expansion, constructor, constraint validation, run result, and persistence boundary. Identify any stale catalog-based, EnrollPro-offering, hardcoded school/year, or pre-reconciliation ownership path.
2. Add a read-only canonical diagnostic that assembles the same current authoritative inputs and invokes the same scheduling core without creating a `GenerationRun`, `LockedSession`, audit event, publication, or source-data write. Prefer extracting/reusing production-pure logic over a second algorithm.
3. Run the diagnostic against school 1/year 8 read-only and report:
   - total required sessions by term;
   - placed and unassigned sessions;
   - hard and soft violations by typed code;
   - runtime and termination reason;
   - source revisions for curriculum, Teaching Load, policy, faculty, sections, rooms, and term config.
4. Correct source defects that are proven by failing-first tests and fall within the allowed generation boundary. Preserve intentional policies and never invent missing staff, rooms, qualifications, curriculum, or operator decisions.
5. Prove that HG is excluded, rotating subjects occur only in their assigned term, each demanded subject-section pair uses the reconciled owner, room capacity and scope checks use persisted values, and the run is deterministic for a fixed seed/input revision.
6. If the read-only canonical diagnostic still finds hard blockers or unassigned sessions, stop with the smallest root-cause matrix and actionable next pass. Do not weaken constraints to manufacture a zero result.

## Source boundary

May edit only generation-domain server services/routes, directly shared scheduling-domain services already consumed by generation, focused server tests, the ledger, one advisory artifact, `CHANGELOG.md`, and the runtime source-of-truth map when authority actually changes. New imports in `atlas-server/src` must be ESM-safe with `.js` endings.

Do not edit Teaching Load reconciliation/department authority, curriculum requirements, Subjects CRUD, authentication, database schema/migrations, backup/recovery, dashboard, timetable client UI, published-schedule services/routes, or any companion repository. If a necessary fix crosses those boundaries, report it rather than editing it.

## Mutation boundary

- School 1/year 8 is strictly read-only.
- No production route call that creates a run. No generation, publication, locked-session, manual-edit, audit, migration, schema, seed, reset, restart, or configuration mutation.
- Hermetic in-memory fixtures are preferred. Disposable database fixtures are allowed only if the existing focused-test pattern guarantees exact cleanup in `finally`, targets a uniquely named non-school-1 scope, and proves zero residue; they may not copy credentials or personal data.
- External repositories are `READ_ONLY`.

## Decisive gates

- Failing-first tests for every functional correction.
- A production-path test proving the diagnostic and live generation share the same input assembly and scheduling core while the diagnostic never reaches persistence.
- Current-input read-only diagnostic with before/after database signature equality.
- Negative controls for stale source revision, cross-school/year scope, missing/ambiguous active year, HG leakage, wrong-term rotation, owner substitution, capacity violation, and persistence attempts.
- Focused generation/constructor/constraint suites affected by the diff; server `tsc --noEmit`; server production build; built-module/runtime smoke; `git diff --check`.
- Do not run broad historical recovery suites.

## Completion contract

Return one of:

- `GENERATION_CANDIDATE_READY`: the exact canonical read-only diagnostic placed every required session with zero hard violations, while clearly stating that a live persisted run is still unperformed and requires separate approval; or
- `GENERATION_BLOCKED`: list exact remaining hard/unassigned codes, counts, and owning source/data decision.

In both cases return `REVIEW_REQUIRED`; never claim GO, publish readiness, or authorize a live run.

Suggested commit:

```text
fix(generation): align canonical readiness with current authority
```
