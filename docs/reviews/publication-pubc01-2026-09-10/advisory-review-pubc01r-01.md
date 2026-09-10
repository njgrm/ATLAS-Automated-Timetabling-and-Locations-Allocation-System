# Advisory Review — PUB-C01R Publication Authority Correction

- **Review artifact:** `docs/reviews/publication-pubc01-2026-09-10/advisory-review-pubc01r-01.md`
- **Reviewer context ID (relayed by spawner):** `REVIEW_BLOCKED`
  - The spawner instruction relayed the literal placeholder `RELAY-THIS-ID`, which is not a verifiable execution-system identifier. Per `AGENTS.md` (Reviewer Identity, Advisory Evidence, And Session Boundaries), an advisory review without a verifiable execution-system context ID must record `REVIEW_BLOCKED` for identity and must not be counted as satisfying formal/independent review obligations. This artifact is therefore advisory evidence only; it cannot unlock, authorize, or satisfy any formal prompt/phase review.
- **Worktree:** `D:\ATLAS-worktrees\publication-pubc01` (branch `work/publication-pubc01`)
- **Base commit:** `63a7935407c6aee2c54a70c667372192a4ff63ee`
- **Reviewed diff:** uncommitted working-tree changes (10 modified files + 3 untracked) reviewed via `git diff` and full-file reads.
- **Reviewed against:** `D:\ATLAS\docs\prompts\publication-contract-readiness-one-shot-pubc01-2026-09-10.md` (authoritative PUB-C01) and the five PUB-C01R defect instructions in the review brief.
- **Reviewer independence:** The reviewer did not implement this work and inspected the diff and every changed source/test file in full before running gates.

---

## 1. Requirement-to-Enforcement Matrix

Each row maps one PUB-C01R defect to its real production call site (import chain + line) and its executable test. No control is substring-only; every control below is a live production path exercised by a real route or service entry point.

| # | Requirement | Production call site (enforcement) | Executable test / gate | Wiring status |
|---|-------------|-----------------------------------|------------------------|---------------|
| 1 | Exact published-source truth: completed source run publishes only when `summary.isPublished === true`; stale `publishedAt`/`publishedBy` alone never publish; zero writes on `isPublished:false`. | `published-revision.service.ts:76-80` `isPublishedSummary()` (strict `=== true`); consumed by `resolveAuthoritativeLatestRevision` (service:215) inside the serializable write transaction of `createPublishedScheduleRevision` (service:282-415) and by the read contract `resolveLatestPublishedSourceRevision` (service:488-503). Consistent strict-truth also in `publication-contract.service.ts:72-74` `isPublished()` and the SQL JSON filter `summary.path=['isPublished'], equals:true` in `published-schedule.service.ts`. | `publication-contract-readiness.test.ts:425-437` (negative `PUBLISHED_SOURCE_REQUIRED` with zero revision/audit; positive `isPublished:true` alone publishes). Adversarial probe A (coercible `'true'`/`1` rejected, version-stale pointer rejected, missing base rejected, all zero writes). | WIRED |
| 2 | Real revision-client source token: both real client flows read the authoritative latest revision from the read contract immediately before posting and send it as `sourceRevisionId`; stale/concurrent token returns typed `SOURCE_REVISION_STALE`, never silently retry/substitute/create. | Server read contract `resolveLatestPublishedSourceRevision` exposed via `published-revision.router.ts:68-78` (`latestRevisionId`/`baseRevisionId`); write enforcement `input.sourceRevisionId !== resolved.latestRevisionId → 409 SOURCE_REVISION_STALE` at `published-revision.service.ts:330-332`. Client `fetchLatestRevisionToken` (`published-revision-client.ts:64-69`) + `buildRevisionCreatePayload` bound into `TeacherDepartureRecoverySheet.tsx:417-434` and `TacticalSandboxDock.tsx:500-518` immediately before `atlasApi.post`. | `publication-contract-readiness.test.ts:617-655` (real route: missing token 409 `SOURCE_REVISION_STALE`, stale token 409, valid token 201, exactly one revision/audit); `published-revision-client.test.ts:18-34` (`parseLatestRevisionToken` rejects missing/zero/negative/float/string tokens as `SourceRevisionStaleError`, never substitutes); component wiring assertions at test:695-701. Adversarial probe B (omitted/base/fabricated token → `SOURCE_REVISION_STALE`, zero writes). | WIRED |
| 3 | Idempotent replay: matching idempotency key + verified matching audit detected BEFORE source-token/previous-value staleness checks; first request creates one revision/audit; identical retry returns `replayed:true` with zero new writes and no duplicate notification. | Replay lookup at `published-revision.service.ts:315-328` (before source-token check at :330-332 and previous-value check at :363-368); actor binding at :319-321; audit-integrity verification at :322-326; notification suppressed on replay at :435. Deterministic ordering guarded by `pg_advisory_xact_lock` (:283) + `isolationLevel: 'Serializable'` (:415). | `publication-contract-readiness.test.ts:365-374` (first + identical retry: `replayed:false` then `replayed:true`, single revision/audit/event, replay succeeds even though its `sourceRevisionId` 700 is no longer the latest token 901); route path at :645-651. Adversarial probe C (identical retry replays despite stale token; actor-mismatch retry → `PUBLISHED_REVISION_STATE_AMBIGUOUS` zero writes; different content = new revision, no false replay; stale non-replay after chain growth → `SOURCE_REVISION_STALE` zero writes). | WIRED |
| 4 | Causal effective-date order: a revision claiming a later source revision must take effect on/after that source revision's effective date; earlier → typed 409 zero writes; same-date/forward valid. | `published-revision.service.ts:333-338` (`sourceEffectiveDate` = latest revision's effective date else base's; `effectiveDate < sourceEffectiveDate → 409 REVISION_EFFECTIVE_DATE_BEFORE_SOURCE`). Chain monotonicity enforced because `sourceRevisionId` must equal `resolved.latestRevisionId` (max effective date by `effectiveDate asc, createdAt asc, id asc` ordering at :234-238). | `publication-contract-readiness.test.ts:439-461` (before-source rejected zero writes; same-date valid; forward valid; chain-head earlier-date rejected zero writes). Adversarial probe D (earlier-than-head rejected; same/forward valid; stale base token vs head handled as `SOURCE_REVISION_STALE`, not causality confusion). | WIRED |
| 5 | Publish outcome transparency: `publishRun` must not discard `revisionId`/`auditId`/`replayed`/`notificationDelivery`; expose through the production publish route in a stable envelope while preserving the `run` response; notification exception → `FAILED_AFTER_COMMIT` with publication/base-revision/audit still committed. | `generation.service.ts:1747-1766` `publishRun` returns the full `PublishScheduleResult` (no longer returns only `result.run`); `generation.router.ts:163-177` returns `{ run: result.run, publication: { revisionId, auditId, replayed, notificationDelivery } }`. `publication-contract.service.ts:366-393` commits revision+audit+marker in one serializable transaction, then post-commit notification with `FAILED_AFTER_COMMIT` on throw; replay returns `DELIVERED` with no notification (:374). | `publication-contract-readiness.test.ts:472-486` (`publishRun` exposes numeric `revisionId`/`auditId`, `replayed:false`, `FAILED_AFTER_COMMIT`, run preserved, committed revision/audit preserved on notification failure); `publication-contract-readiness.test.ts:657-678` (real publish route returns `run` + `publication` envelope with all four fields); envelope regex at :693. | WIRED |

**Preserved guards (defect 1 carve-out):** completed/FULL, exact school/year, source-run-version, immutable base-revision, actor-school, active-year, three-term contract, entry/previous-value validation, query-shaping (`WITH ORDINALITY` ordered extraction at service:339-347) — all still enforced and exercised in the test file.

---

## 2. Files Inspected

Changed source (full read):
- `atlas-server/src/services/published-revision.service.ts` (515 lines, full)
- `atlas-server/src/routes/published-revision.router.ts` (122 lines, full)
- `atlas-server/src/services/generation.service.ts` (publishRun hunk + context)
- `atlas-server/src/routes/generation.router.ts` (publish route hunk + context)
- `atlas-server/src/__tests__/publication-contract-readiness.test.ts` (729 lines, full)
- `atlas-client/src/lib/published-revision-client.ts` (new, full)
- `atlas-client/src/lib/__tests__/published-revision-client.test.ts` (new, full)
- `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx` (changed hunk + context)
- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx` (changed hunk + context)
- `CHANGELOG.md`, `docs/progress/publication-pubc01-2026-09-10-progress.md`, `docs/reference/atlas-runtime-source-of-truth-map.md`

Unchanged dependencies inspected for wiring confirmation:
- `atlas-server/src/services/publication-contract.service.ts` (394 lines, full)
- `atlas-server/src/lib/data-context.ts`, `atlas-server/src/lib/prisma.ts`
- `atlas-server/tsconfig.json`, `atlas-client/tsconfig.json`, both `package.json`

Untracked file discovered (not in the declared changed-files list):
- `atlas-server/src/__tests__/_advisory_pubc01r_probe.ts` — leftover scratch probe from a prior review session.

---

## 3. Gates Independently Rerun (with results)

| Gate | Command (workdir) | Result |
|------|-------------------|--------|
| Server contract test | `npx tsx src/__tests__/publication-contract-readiness.test.ts` (`atlas-server`) | **PASS** — exit 0, "publication contract readiness: all checks passed" (DATABASE_URL warning expected; hermetic fake clients used) |
| Client contract test | `npx tsx --test src/lib/__tests__/published-revision-client.test.ts` (`atlas-client`) | **PASS** — 4 pass / 0 fail |
| Server typecheck | `npx tsc --noEmit` (`atlas-server`) | **PASS** — no output, exit 0 |
| Client typecheck | `npx tsc --noEmit` (`atlas-client`) | **PASS** — no output, exit 0 |
| Whitespace gate | `git -C D:\ATLAS-worktrees\publication-pubc01 diff --check` | **PASS** — clean (LF→CRLF advisory warnings only) |
| Adversarial probe (temp dir, real service entry) | `npx tsx <temp>/pubc01r-adversarial-probe.ts` (`atlas-server` workdir) | Sections A (isPublished strict truth), B (source token), C (replay ordering/no-duplicate), D (causal effective date) **PASS**. Section E (publish envelope via dynamic import) could not execute from the temp location — the probe harness suffered module-instance duplication across the temp-drive import graph (AsyncLocalStorage context set by the probe's `withDataContext` was invisible to `getDataContext` inside the dynamically imported `generation.service.js`), so the real Prisma client was constructed and failed on missing `DATABASE_URL`. This is a **probe-harness artifact, not a production defect**: defect 5 is covered by the executor's in-worktree tests (`publication-contract-readiness.test.ts:472-486` and `:657-678`), both of which I independently reran and passed, and by my line-level inspection of `generation.router.ts`/`generation.service.ts`/`publication-contract.service.ts`. |

No live database, server, publish, generation, or companion-repo surface was touched. The worktree was not modified by this review (verified via `git status --porcelain` before and after — identical 10 modified + 3 untracked).

---

## 4. Findings

### Product / runtime defects
- **None found.** Every authority control is wired to a real production entry point and a negative fixture. In particular: (a) there is no path where stale `publishedAt`/`publishedBy` markers establish publication — `isPublishedSummary` and `isPublished` both require `=== true` and the SQL read filter is `equals:true`; (b) there is no path where a replay is skipped and a duplicate is created — the replay lookup runs inside the advisory-locked serializable transaction before any staleness check, and different content yields a different idempotency key (no false-positive replay); (c) there is no path where an earlier-than-source effective date is accepted — the causality check compares against the latest revision's effective date (max of the ordered chain), and previous-value continuity across the chain is additionally enforced (my initial probe erroneously supplied a stale `previous` and the service correctly rejected with `REVISION_PREVIOUS_VALUES_STALE`, confirming the roll-forward logic); (d) `sourceRevisionId` cannot be omitted or substituted — omission, base-when-head-exists, and fabricated tokens all fail closed with `SOURCE_REVISION_STALE`; (e) the publish envelope is stable and `FAILED_AFTER_COMMIT` preserves the committed base revision/audit.

### Safety-gate defects
- **None found.** No mutation, live-data, or authority boundary is weakened by this diff. Publication remains a separately fingerprinted `HIGH` action outside this pass.

### Process / documentation inconsistencies
- **P-1 (must fix before commit):** Untracked scratch probe `atlas-server/src/__tests__/_advisory_pubc01r_probe.ts` remains in the worktree. It is not in the declared changed-files list, sits in a globbed test directory, and would be swept into the commit by `git add -A`/`git add src/__tests__`. Per `AGENTS.md`, an unrelated or scratch file inside the commit keeps the candidate at `NO-GO`. **Required fix:** delete the file before staging and re-verify `git status` shows only the declared files.
- **P-2 (style):** Two hand-edited hunks lost indentation: `published-revision.service.ts:301` (`throw err(409, 'PUBLISHED_REVISION_TERM_CONTRACT_INVALID', ...)` at column 0) and `generation.router.ts` (`const result = await genService.publishRun(...)` at column 0). Syntactically valid (tsc passes) and functionally correct, but it deviates from the file's tab-indented style and indicates non-idiomatic editing. **Required fix:** restore tab indentation in both hunks.
- **P-3 (minor):** `atlas-client/src/lib/__tests__/published-revision-client.test.ts` is not referenced by any script in `atlas-client/package.json` (`test:auth-session`, `test:timetable-conflict`, `test:ux-guardrails` exist but none covers this file). It is directly runnable via the decisive gate, but a future aggregate client test run would not include it. **Recommended fix (non-blocking):** add a `test:published-revision` script for discoverability.
- **P-4 (observation, non-defect):** Concurrency for revision *creation* (two simultaneous identical POSTs) is not exercised by any test fixture — `makeRevisionFixture`'s `$transaction` does not serialize. Production guarantees ordering via `pg_advisory_xact_lock(schoolId, schoolYearId)` + Serializable isolation (same mechanism as the publish path, which IS concurrently tested). Deterministic sequential replay is tested. Not blocking.

---

## 5. Verdict

- **zeroFix: false** — three process-level required fixes remain (P-1 delete scratch probe, P-2 restore indentation, P-3 optional script wiring). No product/runtime or safety-gate defect remains.
- **Verdict: ACCEPT** — the production code for all five PUB-C01R defects is correctly wired and fails closed under adversarial mutation fixtures; the decisive gates pass.
- **Identity caveat:** Because no verifiable execution-system context ID was relayed (`RELAY-THIS-ID` is a placeholder), this artifact records `REVIEW_BLOCKED` for reviewer identity and is advisory evidence only. It must not be treated as a formal independent review; the formal planner/QA review still requires a SHA-256-pinned, orchestrator-issued review receipt with a verifiable reviewer ID.