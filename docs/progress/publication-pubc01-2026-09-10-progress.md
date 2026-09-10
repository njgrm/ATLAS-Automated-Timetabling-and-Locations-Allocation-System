# PUB-C01 Publication Contract Readiness Progress

- Prompt: `docs/prompts/publication-contract-readiness-one-shot-pubc01-2026-09-10.md`
- Risk: `MEDIUM` source implementation; live publication remains excluded `HIGH`
- Worktree: `D:/ATLAS-worktrees/publication-pubc01`
- Branch: `work/publication-pubc01`
- Base: `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187`
- Current phase: candidate committed for planner/QA review

## Execution status

| Task | Status | Evidence |
|---|---|---|
| Read project/prompt/runtime/consumer context | DONE | `ATLAS_AGENT_KI.md`, supplied `AGENTS.md`, `phasePlan.md`, runtime map, AIMS/SMART annual handoffs, PUB-C01 |
| Trace publish/revision/read/event production paths | DONE | generation publish route/service, published revision route/service, published schedule resolver, SSE bridge |
| Consolidate publication authority | DONE | `publication-contract.service.ts` is the sole initial-publish decision/write contract used by `generation.service.ts` and the real route |
| Enforce scope/current-input/completeness gates | DONE | exact actor school, single runtime-active year, ordered three-term config, run scope/status/version, expanded input snapshot, zero hard violations, zero required unassigned sessions |
| Enforce atomicity/idempotency | DONE | serializable transaction, scoped PostgreSQL advisory transaction lock, optimistic run-version update, one base revision, one audit, replay returns original record |
| Preserve public read/query shape | DONE | SQL-filtered published candidate metadata, deterministic `createdAt/id` selection, exact base revision/version binding, heavy payload loaded only after resolution, `WITH ORDINALITY` retained |
| Focused hermetic verification | DONE | `npx tsx src/__tests__/publication-contract-readiness.test.ts` PASS |
| Server TypeScript/build | DONE | `npm run build` PASS |
| Built runtime smoke | DONE | isolated port 5099, `/api/v1/health` HTTP 200; process stopped; no database URL and no DB access succeeded |
| Read-only Tailnet matrix | DONE | health 200; current school 1/year 8 full, term 1, section, and room reads returned `CURRENT_PUBLISHED_RUN_NOT_FOUND`; unknown external faculty returned `FACULTY_NOT_FOUND`; no mutation request issued |
| Fresh advisory review | DONE_WITH_FIXES | reviewer found fixture-run, effective-filter, revision replay/atomicity, current-publication, replay-pointer, and test-depth gaps; all were corrected before commit |
| Changed-scope review | DONE | successive fresh reviews drove exact-digest, ambiguity, revision-chain, and typed previous-value corrections; final fresh review returned ZERO-FIX |
| Candidate commit | DONE | exact authorized paths staged, `git diff --cached --check` passed, conventional candidate commit created; no merge/push |

## Decisions and boundaries

- Existing `PublishedScheduleRevision` stores the immutable base-publication identity without a schema change. The generation run summary binds its revision ID, audit ID, input fingerprint, and post-publication run version.
- Current authoritative input fingerprints now include the Teaching Load cycle plus school-year term configuration, active offerings, and offering-term assignments. Runs created before this expanded snapshot fail closed at publication as stale/unknown.
- Database publication state is atomic. The in-memory SSE/notification event is emitted only after commit and cannot be transactionally guaranteed; a subscriber failure is reported as `FAILED_AFTER_COMMIT` and does not duplicate or roll back persisted truth.
- Public response serialization remains additive-compatible: no AIMS/SMART payload field was removed or renamed, so no companion-source handoff change is required.
- No client, schema/migration, Teaching Load workflow, curriculum workflow, Subjects, dashboard, auth implementation, recovery, or companion source was edited.
- No live schedule was generated, published, revised, or mutated. Port 5001 was not restarted.

## Advisory review

The fresh reviewer returned `PUBLICATION_BLOCKED` before commit with material findings:

1. `PERFORMANCE_FIXTURE` runs could satisfy `COMPLETED` checks.
2. Targeted base-entry filtering occurred before effective revisions, omitting moved-in entries.
3. Later published-revision creation validated outside its transaction, duplicated on replay, and let post-commit notification failure escape.
4. Publishing another run did not retire the prior current publication.
5. Public route/query tests relied too heavily on source regex checks.
6. Initial publish replay trusted unvalidated summary pointers.

Corrections made:

- Require `runType=FULL` and test rejection of performance fixtures.
- Include every revision-touched entry in targeted `WITH ORDINALITY` extraction, apply revisions, then evaluate effective membership; added moved-in/moved-out behavioral proof.
- Move revision source/active-year checks inside a serializable advisory-locked transaction; add deterministic replay identity; isolate post-commit event failure; test one revision/audit/event across replay and committed truth after event failure.
- Atomically retire any prior current published run before marking the selected run current.
- Execute the real unauthenticated public school, term, section, external-faculty, and room routes in the hermetic server test.
- Validate replay revision/audit IDs, scope, existence, and run-version binding before returning replay success.
- Reject archived/ambiguous active-year mirrors and multiple current published markers.
- Replace aggregate-only freshness with exact database-computed row-content digests for every authoritative input domain; the live read-only school 1/year 8 digest probe returned five 32-character domain digests and one 64-character composite fingerprint.
- Require revisions to chain from the latest revision, target real entries, preserve typed three-term values, and match current effective previous values.

Final changed-scope review: `ZERO-FIX`; focused test, `tsc --noEmit`, and `git diff --check` passed independently.

## Remaining risks

- Notification delivery remains best-effort and process-local after the database commit; a durable outbox would require a later schema-backed design and is not claimed here.
- This candidate authorizes source readiness only. Actual publication remains a separately fingerprinted `HIGH` action requiring independent pre-action review and explicit operator approval.
- Existing timetable revision callers must send the latest `sourceRevisionId`; requests without that concurrency token now fail closed with `SOURCE_REVISION_STALE` rather than branching published truth.

## PUB-C01R correction pass (fresh executor, `REVIEW_REQUIRED`)

- Base: `63a7935407c6aee2c54a70c667372192a4ff63ee` (the PUB-C01 candidate under review).
- Verdict contract: source/tests/docs only; no live publication, generation, revision creation, runtime restart, migration, merge, or push.
- Five defects corrected:

1. **Exact published-source truth**: `published-revision.service.ts` now publishes only when `summary.isPublished === true`. Stale `publishedAt`/`publishedBy` markers alone are rejected (`PUBLISHED_SOURCE_REQUIRED`) with zero revision/audit writes. Completed/FULL, exact school/year, source-run-version, immutable base-revision, actor-school, and active-year checks preserved.
2. **Real revision-client source token**: the revision read contract (`GET .../published-revisions`) now exposes `latestRevisionId`/`baseRevisionId`; `TeacherDepartureRecoverySheet.tsx` and `TacticalSandboxDock.tsx` fetch the token immediately before posting and bind it as `sourceRevisionId`. A stale/concurrent token returns typed `SOURCE_REVISION_STALE`; no silent retry or substitution.
3. **Idempotent replay**: matching idempotency key + verified audit are detected before source-token/previous-value staleness checks; first request creates one revision/audit, an identical retry returns `replayed:true` with zero new writes and no duplicate notification.
4. **Causal effective-date order**: a revision claiming a later source revision must take effect on or after that source revision's effective date; earlier dates return `409 REVISION_EFFECTIVE_DATE_BEFORE_SOURCE` with zero writes; same-date and forward-date remain valid.
5. **Publish outcome transparency**: `publishRun` returns the full `PublishScheduleResult`; the production publish route returns a stable `{ run, publication: { revisionId, auditId, replayed, notificationDelivery } }` envelope. A notification exception returns `FAILED_AFTER_COMMIT` while the publication, base revision, and audit remain committed.

- Decisive gates: `publication-contract-readiness.test.ts` PASS (failing-first regressions for all five defects, mounted publish + revision-creation route coverage, client call-site source contract); focused client test `published-revision-client.test.ts` PASS (4/4); server `tsc --noEmit` PASS; client `tsc --noEmit` PASS; server production build PASS; client production build PASS; `git diff --check` clean.
- Built-runtime server start was NOT performed: the prompt explicitly excludes runtime restart. Startup/route-loading surface is unchanged; the prior PUB-C01 candidate's isolated built-runtime smoke (`/api/v1/health` 200) remains the last runtime evidence.
- Client dependencies were installed in the worktree (`npm ci`, gitignored `node_modules/`) to run client tests/builds; no tracked file changed as a result.
- No live schedule was generated, published, revised, or mutated. Port 5001 was not restarted. Companion repositories untouched.

### Advisory reviews (PUB-C01R)

- `docs/reviews/publication-pubc01-2026-09-10/advisory-review-pubc01r-01.md` (fresh full-diff advisory review): zero product/runtime defects, zero safety-gate defects; three process findings — P-1 leftover scratch probe, P-2 lost tab indentation (two lines), P-3 optional npm-script wiring. All fixed.
- `docs/reviews/publication-pubc01-2026-09-10/advisory-review-pubc01r-02-changed-scope.md` (fresh changed-scope review after fixes): `zeroFix: true`, `ACCEPT`; no product/runtime, safety-gate, or remaining process findings.
- Identity caveat (both artifacts): the Task-tool spawn exposes the execution-system handle only on completion, so the reviewer artifacts record `REVIEW_BLOCKED` for reviewer identity. Per `AGENTS.md`, these are advisory evidence only and do not satisfy the formal planner/QA review, which remains external and must bind a verifiable reviewer ID to the commit range.
- Applied fixes: deleted `atlas-server/src/__tests__/_advisory_pubc01r_probe.ts`; restored tab indentation in `published-revision.service.ts` and `generation.router.ts`; added client `test:published-revision` script.
- Re-run gates after fixes: server contract test PASS; client `test:published-revision` 4/4 PASS; server/client `tsc --noEmit` PASS; server/client production build PASS; `git diff --check` clean.
