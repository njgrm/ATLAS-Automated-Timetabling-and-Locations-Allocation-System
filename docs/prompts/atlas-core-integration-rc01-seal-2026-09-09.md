# Prompt RC-01 — Core Stream Integration Seal

Date: 2026-09-09  
Risk: MEDIUM, read-only/package-preview only  
Executor: fresh DeepSeek session recommended  
Time budget: 25 minutes, hard stop  
Verdict boundary: `REVIEW_REQUIRED`; never formal `GO`

## Objective

Turn the completed SCA, Teaching Load, Timetable, and Dashboard/EVAL working-tree
changes into one exact, reviewable release-candidate inventory. Verify that the
four streams compile and coexist without crossing authority boundaries.

This prompt does **not** authorize source fixes, staging, committing, deployment,
service restart, database writes, curriculum decisions, department-label apply,
generation, publication, schema changes, migrations, or external-repository
edits. If integration is not clean, report the smallest concrete finding and
stop. Do not repair it in this pass.

## Mandatory reads

Read, in order:

1. `AGENTS.md`
2. `ATLAS_AGENT_KI.md`
3. `phasePlan.md`
4. `docs/reference/atlas-runtime-source-of-truth-map.md`
5. These ledgers:
   - `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`
   - `docs/progress/teaching-load-corrective-parallel-2026-09-08-progress.md`
   - `docs/progress/timetable-corrective-parallel-2026-09-08-progress.md`
   - `docs/progress/eval-dashboard-lifecycle-truth-2026-09-08-progress.md`
6. Latest review artifacts for SCA-03E-R3, TL-C01R4B, TT-C01B-R, and
   EVAL-C01R1.
7. `git status --short`, `.gitignore`, and the complete diffs of every candidate
   production path.

## Planner status entering this pass

- SCA-03E-R3 source implementation: planner QA `GO`.
- SCA-04: `LOCKED`; operator decisions and fresh approved fingerprint absent.
- TL-C01R4B: implementation complete, formal integration acceptance pending;
  department-label rows remain unapplied; TL-C02 locked.
- TT-C01B-R: implementation sealed, formal integration acceptance pending;
  TT-C02 depends on SCA-04 and TL-C02.
- EVAL-C01R1: implementation complete, formal integration acceptance pending.
- Database-recovery Prompt 06: already formally `GO`; do not rerun recovery.

## Tasks

### RC-01.0 — Preflight and collision inventory

- Record HEAD, current branch, dirty paths, listener ownership for ports 5001
  and 5174, sanitized configured database name, active school/year, and a
  read-only census of curriculum requirements, term configuration, Teaching
  Load ownerships/cycle, department labels/aliases, generation runs, and
  published revisions.
- Attribute every candidate production/test/document path to exactly one of
  SCA, TL, TT, EVAL, shared-integration, or unrelated-existing.
- Identify overlapping files and line hunks. Do not silently assign the same
  hunk to two streams.
- Treat companion repositories as `READ_ONLY`; do not contact them unless a
  cited ATLAS contract requires a read-only source check.

### RC-01.1 — Exact release-candidate inventory

- Produce an exact allowlist of files proposed for the combined commit.
- Include only current four-stream production code, their directly relevant
  executable tests, current ledgers/reviews, and necessary directive/runtime-map
  updates.
- Exclude historical recovery tests, artifact generators, dumps, screenshots,
  temporary files, unrelated documents, `tmp/`, external repositories, and
  unrelated dirty work.
- For every proposed path record: stream owner, tracked/untracked state, byte
  SHA-256, reason required, and whether it is production, test, or evidence.
- Separately list excluded dirty/untracked paths. Never use `git add .`, `git add
  -A`, wildcard staging, stash, reset, clean, checkout-discard, or broad commit.

### RC-01.2 — Focused coexistence gates

Run only these gates, using existing commands from the ledgers:

- SCA: curriculum-decision-candidates and decision-draft suites.
- TL: department-authority-gates, department-authority-apply,
  teaching-load-effective-workload-policy, and client canonical-workload suite.
- TT: collaboration lifecycle, timetable-runtime-truth, and the affected
  timetable state/decision suite named in the TT ledger.
- EVAL: dashboard lifecycle hermetic, dashboard HTTP authority, and client
  dashboard lifecycle suites.
- Server and client `tsc --noEmit`.
- Server and client production builds once each.
- `git diff --check` and scoped secret/debug-output scan over candidate
  production paths.

Do not run database-recovery, broad historical, full Playwright, full repository,
generation, publication, or external-subsystem suites. Do not install/update
dependencies. A missing command must be reported, not substituted silently.

### RC-01.3 — Production reachability and authority audit

Without restarting the shared runtime:

- Trace each new service/helper to its real route/page consumer.
- Confirm the combined build contains the SCA decision workspace, department
  authority routes, actor-scoped timetable collaboration, and dashboard
  lifecycle authority.
- Confirm no stream reintroduces `DEFAULT_SCHOOL_ID`, code-owned curriculum
  decisions, EnrollPro offering authority, advisory-inclusive utilization,
  catalog mutation during generation, or unassigned repair that invents demand.
- Confirm SCA-04, TL-C02, TT-C02, generation, and publication remain unreachable
  from this preview.

### RC-01.4 — Release preview artifact

Write:

- `docs/verification/atlas-core-integration-rc01-preview-2026-09-09.json`
- matching `.sha256` sidecar
- `docs/progress/atlas-core-integration-rc01-progress.md`

The preview must include the exact inventory, hashes, exclusions, test commands
and exit codes, current runtime/database signature, collision audit, expected
single-commit message, rollback basis, and a proposed RC-02 procedure. It must
state `authorizesNoMutation: true` and offer no approval sentence.

Do not update the four source-stream ledgers merely to claim formal acceptance.
This RC ledger owns the integration evidence.

## Review and time discipline

- No executor-spawned advisory review is required for this packaging preview;
  planner/QA will review the artifact directly. This is intentional to avoid
  another long ceremonial loop.
- At 25 minutes, finish the current command, write truthful partial evidence,
  and stop. Do not exceed the budget to add another suite or review.
- Return `REVIEW_REQUIRED`, exact elapsed time, and one concise finding list.

## Exit criteria

`REVIEW_REQUIRED` is valid only when:

- all candidate paths have exactly one owner and hash;
- unrelated dirty paths are excluded explicitly;
- every listed focused gate ran and passed, or the report is `NO-GO` with the
  exact failure;
- no production service/helper is orphaned;
- no data/config/runtime/process/Git-index mutation occurred;
- the preview and sidecar match; and
- SCA-04, TL-C02, TT-C02, generation, publication, and RC-02 remain locked.

Suggested future commit after planner acceptance:

```text
feat(core): integrate curriculum, teaching-load, timetable, and dashboard authority fixes
```
