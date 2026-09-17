# EXPORT-PRESENTATION-S15-REBASELINE — bounded correction packet

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **MEDIUM**
(test-and-documentation only; no live mutation).

This packet exists because the authorized HIGH apply `MIG-APPLY-0002-0003`
applied `0003_teacher_program_presentation` to the live database on 2026-09-17,
which **falsified a committed mandatory acceptance assertion** in the already
closed, receipt-pinned stream `EXPORT-PRESENTATION-SCHEMA-GUARD-C06B`. A fresh
Wave Completion Auditor (`ses_f50eec155ffeIoARuYvLaK2lgr`) returned
`CORRECTION_REQUIRED` 7/6/1/0/0 with that as its single blocking finding (B1),
and the planner independently confirmed the test source and the live table.
`MIG-APPLY-0002-0003` may not close `COMPLETE` until this correction is
integrated and re-audited.

## 0. Immutable identity

| Item | Value |
| --- | --- |
| Stream | `EXPORT-PRESENTATION-S15-REBASELINE` |
| Accepted base | `git rev-parse HEAD` at dispatch (it is `origin/main` at dispatch; `10769108392b7ed5b5dbe0cb930ac5226de66f32` was observed at packet authoring) |
| Worktree | `E:/ATLAS-worktrees/export-presentation-s15-rebaseline` |
| Branch | `fix/export-presentation-s15-rebaseline` |
| Directive | read `origin/main:AGENTS.md` directly; blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`, LF-normalized SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3` |
| Register dependency | `requires` `MIG-APPLY-0002-0003` (already `INTEGRATED`) |
| Budget | 45 minutes; at 34 minutes report the active command, completed evidence, and remaining critical path and freeze scope |
| Worktree disposition | `RETIRE_AFTER_INTEGRATION` |

## 1. Objective

Move the C06B acceptance row **S15** from a premise that is now false to the
premise that was always the real invariant, **without losing any coverage**:

- **Before:** "`public.teacher_program_presentation_revisions` must not exist on
  the configured (live) database."
- **After:** "this suite must never mutate the configured database's
  presentation-table state."

The runtime behaviour is unaffected: with the table present, the P2021 → typed
503 translation inside the service is simply untriggered, and export works
normally. The negative controls (P2021/P2022 translation, no-leak assertions)
keep running on the **disposable** database where `0003` is deliberately
unapplied, so no coverage is lost.

Also in scope: retire the stale, unapproved packet
`docs/prompts/companion-sso-migration-live-c02-2026-09-15.md` whose §3/§5
preconditions (both target objects ABSENT, 2-row registry rollback target) are
now falsified; annotate the C06B executor handoff S15 row; and record the O1
preflight as a precondition row in the C10 packet.

## 2. Owned and forbidden paths

Owned — the only paths this executor may create or modify:

1. `atlas-server/src/__tests__/export-presentation-schema-guard-c06b.test.ts`
2. `docs/prompts/companion-sso-migration-live-c02-2026-09-15.md` — **retirement banner only** at the top; do not rewrite its body
3. `docs/handoffs/export-presentation-schema-guard-c06b-executor.md` — the S15 row annotation only
4. `docs/prompts/consolidated-deployment-c10-2026-09-17.md` — **one precondition row only** (the O1 preflight, item 5 in §3)

Forbidden:

- Every migration file, `prisma/**`, all other `atlas-server/**` and
  `atlas-client/**` source, `ops/workflow/**`, `docs/plans/**` (the machine
  register and its generated projection are written only by planner-run
  transitions), all other `docs/prompts/**` and `docs/handoffs/**`,
  `CHANGELOG.md`, the runtime source-of-truth map, and every companion clone.
- Do not run any `ops/workflow/transition.mjs` transition. The executor never
  edits machine register state.
- No login, no browser session, no deployment, no runtime restart, no
  scheduled-task or env change, no generation, no publication, no companion
  action, no `migrate deploy`/`migrate status`/`db push`/`reset`, and no write of
  any kind to the configured database or `_prisma_migrations`.

Raw command output and scratch files stay outside the repository. `git status
--short` must be empty at handoff after the single candidate commit.

## 3. Required changes

1. **S15 before** (currently the test at lines 92–99, which has **no `skip`** and
   must keep that): keep the fatal `RUNNABLE` assertion and the
   `readSourceDatabaseUrl()` resolution, keep the configured-database
   `psqlValue(sourceUrl, configured, PROBE_SQL)` probe, but **remove the hard
   absence assertion**
   `assert.equal(before, '', 'S15(before): … must not exist on the configured database')`.
   Instead **capture the observed value into a module-scope variable** (for
   example `let configuredBefore: string | null = null;`) and log it. Rename the
   test to describe the real invariant ("this suite never mutates the configured
   database").
2. **S15 after** (currently `assert.equal(configuredAfter, '', …)` at line 385):
   assert **non-mutation**, not absence —
   `assert.equal(configuredAfter, configuredBefore, …)` with a message that
   prints both values — and additionally assert that the before-probe actually
   ran (for example `assert.notEqual(configuredBefore, null, …)`) so the
   non-mutation control can never be vacuous.
3. **Everything else stays byte-unchanged.** In particular S1–S14, S16 and S17,
   the `PRESENTATION_TABLE`/`PROBE_SQL` constants, the no-leak token list, the
   disposable `atlas_restore_drill_*` provisioning/teardown, and the P2021/P2022
   translation controls must not be weakened, renamed, skipped, or removed.
4. **Dated supersession comment** in the test file recording that
   `0003_teacher_program_presentation` is APPLIED to
   `atlas_recovery_clean_rebuild_20260905` as of 2026-09-17 under
   `MIG-APPLY-0002-0003`, and that S15 now asserts non-mutation rather than
   absence.
5. **O1 precondition row** in
   `docs/prompts/consolidated-deployment-c10-2026-09-17.md`: before any Prisma
   migration command, require `git ls-files --eol prisma/migrations` to show
   `w/crlf` (or recompute each `migration.sql` digest and require equality with
   the persisted `_prisma_migrations.checksum` values), because
   `.gitattributes` LF coverage omits `prisma/migrations/**`. Do **not** propose
   adding an LF rule while the persisted checksums are CRLF-form — that would
   itself create drift.
6. **Retirement banner** on
   `docs/prompts/companion-sso-migration-live-c02-2026-09-15.md`, stating that it
   is `SUPERSEDED by MIG-APPLY-0002-0003 (2026-09-17)` and must never be presented
   as executable.
7. **S15 row annotation** in the C06B executor handoff noting the premise
   supersession.

## 4. Decisive gates and negative controls

| Gate | Requirement | Failing-first control |
| --- | --- | --- |
| S1 | The corrected test file rebaselines S15 to non-mutation and keeps every other row byte-unchanged — verified by an explicit diff review of the other rows/assertions | a diff that weakens or removes any other row fails the gate |
| S2 | **Reproduce the defect on the base, prove the fix on the candidate.** The pre-correction S15 assertion must fail against the configured database (it expects `''` but the probe returns `teacher_program_presentation_revisions`), and the corrected assertion must pass | run the pre-correction S15 probe read-only and show the mismatch; show the corrected test passing |
| S3 | **Load-bearing mutant.** Introduce a mutant that makes the post-probe return a value different from the before-probe and prove the new non-mutation assertion fails; revert the mutant byte-exactly and prove it passes again | the mutant must fail the exact new assertion; a reverted tree must be byte-identical to the candidate |
| S4 | Candidate range is attributable (exactly the four owned paths, or fewer), `git diff --check` clean, no forbidden path, no assertion removal beyond the single superseded absence assertion, and the four retirement/annotation edits present | any extra path or a silently dropped assertion fails the gate |
| L1 | The corrected suite runs green end to end, and the **configured database is provably unchanged**: the presentation table still exists and `_prisma_migrations` still shows exactly 4 applied rows (`0000`, `0001`, `0002`, `0003`), all finished and none rolled back, before and after the run | the only permitted database side effect is the suite's own disposable `atlas_restore_drill_*` database lifecycle; any write to the configured database, or any change to its registry/table state, fails the gate |

The live row matters because the whole finding is that a live premise changed.
Run the suite with `DATABASE_URL` resolved as the suite already does (environment,
`atlas-server/.env`, or the durable runtime env). Never print credentials.

## 5. Database boundary

- The suite provisions and drops its own disposable `atlas_restore_drill_*`
  database through its existing guarded helper; that is the **only** permitted
  database side effect.
- The configured database `atlas_recovery_clean_rebuild_20260905` may only be
  read (`SELECT`/`to_regclass` probes). Never write, never migrate, never seed,
  never reset.
- Read-only probes may use `D:\PostgreSQL\18\bin\psql.exe` with `PG*` values
  derived inside the process; never print the credential or the full
  `DATABASE_URL`.

## 6. Evidence and return contract

1. Before editing, record `git rev-parse HEAD` (the accepted base) and confirm
   `git status --porcelain=v2` is empty.
2. Run the decisive gates in §4. Capture only decisive output lines; keep raw
   logs outside the repository.
3. Commit the change as one candidate commit on the branch (for example
   `test(export-presentation): rebaseline the C06B S15 live-database assertion to non-mutation`),
   staging only the owned paths; verify the staged list and `git diff --cached --check`.
4. Return `REVIEW_REQUIRED` with: base SHA; candidate SHA; exact changed paths;
   the filled §4 gate table with observed values; the exact commands run and
   their decisive output; the S2 before/after proof and the S3 mutant result;
   the L1 before/after configured-database state; known risks classified
   `BLOCKING`/`NON_BLOCKING`; worktree disposition `RETIRE_AFTER_INTEGRATION`;
   and the statement that no register file was edited by you and no receipt was
   minted.
5. Do not self-approve, merge, or push. The planner validates the immutable
   range, commissions fresh independent QA, integrates, and then runs one fresh
   Wave Completion Auditor over the changed final tree.

## 7. Session routing

- `EXECUTOR_SESSION_ROUTE: FRESH_REQUIRED` — the bounded rebaseline runs in a
  fresh executor context in the named worktree.
- `QA_SESSION_ROUTE: FRESH_REQUIRED` — one fresh independent QA over the
  corrected frozen range.
- `PLANNER_SESSION_ROUTE: EXISTING` — the planner that closed the
  `MIG-APPLY-0002-0003` wave audit owns this correction end to end.
- `AUDITOR_SESSION_ROUTE: FRESH_REQUIRED` — changing a committed mandatory
  acceptance test reopens the wave-completion loop.
