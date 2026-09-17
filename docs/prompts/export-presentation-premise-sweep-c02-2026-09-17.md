# EXPORT-PRESENTATION-PREMISE-SWEEP-C02 — bounded documentation correction

ROLE: EXECUTOR. Recommended reasoning variant: `high` (the sweep edits the
precondition text of a live HIGH packet). Risk tier: **LOW–MEDIUM (docs only)**.

This packet exists because the second Wave Completion Auditor of the
`MIG-APPLY-0002-0003` wave (`ses_f50c94a98ffe1S7YZL1jyubbB6`, `CORRECTION_REQUIRED`)
found that authoritative documents still assert the pre-apply registry state.
The blocking one is `docs/prompts/term-cache-catchup-apply-2026-09-14.md`, a live
`HIGH_APPROVAL_REQUIRED` packet whose own divergence rule and acceptance row make
it **unexecutable as written** now that the registry holds 4 applied migrations.

No product source, test, migration, `prisma/**`, `ops/workflow/**`, machine
register, runtime, task, env, database, login, browser, or companion action is in
scope. This is a document-truth correction only.

## 0. Immutable identity

| Item | Value |
| --- | --- |
| Stream | `EXPORT-PRESENTATION-PREMISE-SWEEP-C02` |
| Accepted base | `git rev-parse HEAD` at dispatch (it is `origin/main` at dispatch; `43341ac7cb908f9ca692dbc93f8da8ef26ec52b0` was observed at packet authoring) |
| Worktree | `E:/ATLAS-worktrees/export-presentation-premise-sweep-c02` |
| Branch | `fix/export-presentation-premise-sweep-c02` |
| Directive | read `origin/main:AGENTS.md` directly; blob `09ede31cbb133ed424039049cbaf44382dd3e4bf`, LF-normalized SHA-256 `3ef09bb64eb623a6c7412fb98549c9143e16589739628656036b19c144a70d79` |
| Budget | 30 minutes; freeze scope at 23 minutes |
| Worktree disposition | `RETIRE_AFTER_INTEGRATION` |

## 1. Ground truth to record (do not re-derive it as a claim)

On 2026-09-17 the operator-approved HIGH action `MIG-APPLY-0002-0003` applied
`0002_companion_sso_code` and `0003_teacher_program_presentation` to
`atlas_recovery_clean_rebuild_20260905` at `localhost:5432` through
`npm run migrate:guarded`. The registry now holds **4** applied migrations
(`0000_clean_baseline`, `0001_term_subject_authority`, `0002_companion_sso_code`,
`0003_teacher_program_presentation`), all finished, none rolled back.
`public.companion_sso_codes` and
`public.teacher_program_presentation_revisions` both exist and are empty.

## 2. Owned and forbidden paths

Owned — the only paths this executor may modify (annotate; do **not** rewrite
bodies):

1. `docs/prompts/term-cache-catchup-apply-2026-09-14.md`
2. `docs/prompts/export-presentation-schema-guard-c06b-2026-09-16.md`
3. `docs/reference/atlas-teacher-program-output-contract-2026-09-15.md`
4. `docs/handoffs/companion-sso-live-prep-c02-executor.md`
5. `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`
6. `docs/handoffs/enrollpro-companion-sso-configuration-2026-09-17.md`
7. `docs/prompts/mig-apply-0002-0003-2026-09-17.md`
8. *(optional)* `docs/handoffs/export-presentation-schema-guard-c06b-executor.md`

Forbidden:

- Every `atlas-server/**` and `atlas-client/**` path — in particular the
  corrected test `atlas-server/src/__tests__/export-presentation-schema-guard-c06b.test.ts`
  must **not** be touched again (its blob must remain
  `90a957c931a0b0b23726f1e96a713752b3d71a93`).
- `prisma/**` and every migration file, `ops/workflow/**`, `docs/plans/**` (the
  machine register and its generated projection are written only by planner-run
  transitions), `CHANGELOG.md`, the runtime source-of-truth map, every companion
  clone.
- Do not run any `ops/workflow/transition.mjs` transition.
- No login, browser session, deployment, runtime restart, scheduled-task or env
  change, generation, publication, companion action, `migrate deploy`/`status`,
  `db push`, `reset`, or any write to the configured database or
  `_prisma_migrations`.

Raw command output and scratch files stay outside the repository.
`git status --short` must be empty at handoff after the single candidate commit.

## 3. Required changes

1. **`docs/prompts/term-cache-catchup-apply-2026-09-14.md` (the blocking one).**
   - §2 signature table, line 78: re-base the `_prisma_migrations` applied value
     from `2` to `4`, and append a dated note that `0002_companion_sso_code` and
     `0003_teacher_program_presentation` were applied on 2026-09-17 by
     `MIG-APPLY-0002-0003`, that this value remains a capture-time observation, and
     that §4.0's fresh capture and its divergence STOP are unchanged.
   - §8 row 3, line 330: the same `2` → `4` re-base.
   - §11a(b), lines 532–535: replace "the pending `0002_companion_sso_code`" with
     the true statement that both migrations are already applied, the pending set
     is now empty, and any future migration approval must **re-measure** rather
     than assume.
   - §11a(a), lines 529–531: mark that gate satisfied on 2026-09-17 without
     deleting it.
   - **Do not alter** the §3 binding capture values, the `SAVE_TERM_AUTHORITY_1_9`
     / fingerprint `d4cd7cc4…` confirmation text, §9, §12, or any other
     precondition. The §4.0 divergence rule must remain intact and load-bearing.
2. **`docs/prompts/export-presentation-schema-guard-c06b-2026-09-16.md`** — annotate
   the §4 S15 row (line 160) with the same dated supersession note already used in
   the executor handoff, pointing at
   `docs/prompts/export-presentation-s15-rebaseline-2026-09-17.md`. Body otherwise
   unamended.
3. **`docs/reference/atlas-teacher-program-output-contract-2026-09-15.md`** — line
   112 status → `CURRENT_STATE — source added and APPLIED to
   atlas_recovery_clean_rebuild_20260905 on 2026-09-17 under MIG-APPLY-0002-0003
   (applying it was a separate HIGH action)`.
4. **`docs/handoffs/companion-sso-live-prep-c02-executor.md`** — dated annotation on
   the line 138 row and the §6 zero-mutation bullet (lines 152–153):
   `0002_companion_sso_code` was applied 2026-09-17 under `MIG-APPLY-0002-0003`;
   the recorded values remain that turn's dated record. Body otherwise unamended.
5. **`docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`** — §5.1
   precondition 1 (lines 213–216) and the header `Dependency:` sentence: replace
   `COMPANION-SSO-MIGRATION-LIVE-C02` with `MIG-APPLY-0002-0003` and note that the
   former packet is `RETIRED`. Its own gate state is unchanged and now satisfied.
6. **`docs/handoffs/enrollpro-companion-sso-configuration-2026-09-17.md`** — §7 row
   1, line 97: delete the falsified parenthetical ("the `companion_sso_codes`
   table does not exist yet") and mark the prerequisite satisfied 2026-09-17 under
   `MIG-APPLY-0002-0003`.
7. **`docs/prompts/mig-apply-0002-0003-2026-09-17.md`** — add a dated
   executed-banner directly under the title: `EXECUTED 2026-09-17 — evidence
   docs/reviews/mig-apply-0002-0003/apply-evidence-2026-09-17.md; §9's "NOT
   GRANTED at packet authoring" and the §11 registration steps are historical.`
8. *(optional, nit)* `docs/handoffs/export-presentation-schema-guard-c06b-executor.md`
   — amend the S15 evidence cell "configured DB name resolved, never printed" to
   "configured DB name logged (non-secret)".

## 4. Decisive gates

| Gate | Requirement | Negative control |
| --- | --- | --- |
| G1 | Exactly the owned paths changed, `git diff --check` clean, no source/test/prisma/migration/ops/register path, worktree clean at handoff | any extra path or any product/test byte fails |
| G2 | The corrected C06B test is untouched: `git rev-parse <tip>:atlas-server/src/__tests__/export-presentation-schema-guard-c06b.test.ts` == `90a957c931a0b0b23726f1e96a713752b3d71a93` | any change to that blob re-opens the test's own QA |
| G3 | Mechanical sweep clean: grep the repository for surviving pre-apply premises (for example `_prisma_migrations` near `applied 2`, `` ` 2 ``, `pending 0002_companion`, `remains **unapplied**`, `stays unapplied`, `NOT applied`, `migrations=2`, `table does not exist yet`); print the literal result set and show every surviving hit is a dated pre-2026-09-17 record, a disposable-database statement, or carries an explicit supersession note | any un-annotated surviving claim fails |
| G4 | Zero mutation: no database, migration, login, browser, runtime, task, env, or companion action; `git status --short` empty; no register file edited; no receipt minted | any audit-row or registry delta fails |
| G5 | **Failing-first control.** Show that the pre-correction term-cache §2 signature value (`2`) differs from the measured registry (`4`) from the same read-only query §4.0 item 4 mandates, and that this would trigger the §4.0 divergence STOP; show the corrected text re-bases the value **without** weakening the STOP rule | a corrected packet that relaxes §4.0, or that leaves the `2` value in place, fails |

## 5. Database boundary

Read-only `SELECT` probes only. `D:\PostgreSQL\18\bin\psql.exe` with `PG*` values
derived inside the process from `DATABASE_URL`; **never print the credential or
the full `DATABASE_URL`** (printing host, port and database name is fine). No
write of any kind.

## 6. Evidence and return contract

1. Before editing, record `git rev-parse HEAD` (the accepted base) and confirm
   `git status --porcelain=v2` is empty.
2. Run the §4 gates and capture only decisive output lines; keep raw logs outside
   the repository.
3. Stage only the owned paths; verify the staged list; run
   `git diff --cached --check`; commit once, for example
   `docs(workflow): sweep the surviving pre-apply 0002/0003 premises (one blocking)`.
4. Return `REVIEW_REQUIRED` with: base SHA; candidate SHA; exact changed paths; the
   filled §4 gate table with observed values; the exact commands run and their
   decisive output; the G3 literal sweep result set; the G5 failing-first proof;
   known risks classified `BLOCKING`/`NON_BLOCKING`; worktree disposition
   `RETIRE_AFTER_INTEGRATION`; and the statements that no register file was edited
   by you and no receipt was minted.
5. Do not self-approve, merge, or push. The planner validates the immutable range,
   commissions one fresh independent QA, integrates, and then runs one fresh Wave
   Completion Auditor over the changed final tree.

## 7. Session routing

- `EXECUTOR_SESSION_ROUTE: FRESH_REQUIRED`
- `QA_SESSION_ROUTE: FRESH_REQUIRED` — one fresh independent QA over the frozen range
- `PLANNER_SESSION_ROUTE: EXISTING` — the planner that owns the
  `MIG-APPLY-0002-0003` closure owns this sweep end to end
- `AUDITOR_SESSION_ROUTE: FRESH_REQUIRED` — the changed documentation scope
  re-opens the wave-completion loop
