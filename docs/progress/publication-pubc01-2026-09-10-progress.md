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
