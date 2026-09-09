# Advisory Review 01 — TT-C02 One-Shot Candidate

- **Reviewer:** independent advisory reviewer (read-only; did not implement)
- **Reviewed base:** `330fb91b7daa28299520272b1e258cc49395af04`
- **Reviewed candidate:** uncommitted worktree diff on `work/timetable-ttc02` (`HEAD` == base; all TT-C02 files are working-tree/untracked changes — no commit boundary exists yet, see Process finding R-01)
- **Date:** 2026-09-09
- **Review scope:** complete TT-C02 owned file set (server services, router, app.ts mount, hermetic + fixture tests, client component/lib/tests, readiness evidence JSON + `.sha256`)
- **Verdict:** `REVIEW_REQUIRED` — **no blocking safety/correctness defect found for the current preview-only release (apply disabled on the live year)**, but material product/fixture findings below require an implementer/owner decision and follow-up before the apply/save boundary is ever enabled.

## Files Inspected

- `atlas-server/src/services/timetable-demand.service.ts`
- `atlas-server/src/services/timetable-insertion.service.ts`
- `atlas-server/src/routes/timetable-unassigned.router.ts`
- `atlas-server/src/app.ts`
- `atlas-server/src/__tests__/timetable-ttc02-insertion.test.ts`
- `atlas-server/src/__tests__/timetable-ttc02-apply-fixture.test.ts`
- `atlas-client/src/components/timetable/UnassignedInsertionWorkflow.tsx`
- `atlas-client/src/lib/timetable-ttc02-insertion.ts`
- `atlas-client/src/lib/__tests__/timetable-ttc02-insertion.test.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx` (diff)
- `docs/verification/timetable-ttc02-readiness-preview-2026-09-09.json` + `.sha256`
- Reference (read-only): `atlas-server/src/middleware/{authenticate,authorize,errorHandler}.ts`, `prisma/schema.prisma` (LockedSession/AuditLog/FacultySubject/SubjectSectionOwnership/TeachingLoadCycle), `atlas-server/src/lib/canonical-json.ts`, `locked-session.service.ts`, `pre-generation-draft.service.ts`

## Commands Independently Rerun

| Command | Result |
|---|---|
| `npx tsx --test atlas-server/src/__tests__/timetable-ttc02-insertion.test.ts` | 15/15 pass (no DB required) |
| `npx tsx --test atlas-client/src/lib/__tests__/timetable-ttc02-insertion.test.ts` | 2/2 pass |
| SHA-256 of `docs/verification/timetable-ttc02-readiness-preview-2026-09-09.json` | matches pinned `.sha256` (`01D3DC2A…`) |
| `git diff --cached`, `git status`, base/HEAD identity | confirmed all candidate files are uncommitted (see R-01) |

I did **not** rerun `timetable-ttc02-apply-fixture.test.ts`: it performs live create/delete on the shared database. I reviewed it statically (see S-01/S-02).

## Requirement-by-Requirement Assessment

### 1. HG exclusion — PASS (defense-in-depth), one robustness note
HG is excluded at every stage I could derive: demand build drops HG ownership rows from the ownership index and HG offerings from `activeOfferings` (and records them in `hgExcluded`), the demand loop re-guards, `searchCandidateSlots` returns `HG_FORBIDDEN`, `classifyInsertionLine` returns `HG_FORBIDDEN`, and apply throws typed `409 HG_FORBIDDEN`. I attempted an alternate leak path (legacy unscoped HG ownership row, subject id referencing a missing subject, an EMPTY-marker offering with `subjectId=null`, and a non-HG subject whose offering row was pinned directly to a section via `sectionMirrorId` bypassing the grade filter): none reaches a candidate or a LockedSession row for an HG subject. Note: HG matching is exact `code === 'HG'` (no `trim().toUpperCase()`), consistent with the seeded canonical catalog and most other consumers; a non-canonical `'hg'`/`' HG '` subject code would evade the guard, but the subject catalog stores uppercase canonical codes and `@@unique([schoolId, code])`. Observation only, no fix required.

### 2. Ownership immutability — PASS
Grep of every write in the two new server services shows only `lockedSession.create`, `lockedSessionAction.create`, and `auditLog.create`, all inside the fingerprint-bound apply transaction. No write to `SubjectSectionOwnership`, `FacultySubject`, `TeachingLoadCycle`, `SchoolYearOffering`/`OfferingTermAssignment`/`SchoolYearTermConfig`, `Subject`, `SectionMirror`, `GenerationRun`, or `PublishedScheduleRevision`. Demand service is zero-write. Fixture asserts ownership/faculty-version/offering-version immutability. No path found that writes Teaching Load or curriculum authority.

### 3. Bounded, deterministic, truthful search — PASS with edge notes
- Deterministic: pure DB-free search; stable sort of candidate rooms and day/time grid; byte-identical output test passes.
- Bounded: `maxEvaluatedSlots` hard-capped at 240 and the day shape itself is bounded (5 weekdays, ≤24 periods/day → ≤120 slots), so the cap is not even reachable. No unbounded loop.
- Term/day shape bounded: weekday list is fixed, periods-per-day is `Math.min(periodsPerDay, 24)`, and slots stop at `latestEndTime`.
- Reason separation: `MISSING_TEACHING_LOAD_OWNER` (owner null), `OWNER_INACTIVE_OR_STALE`, `OWNER_OUTSIDE_SCOPE`, `NO_QUALIFIED_OWNER`, `NO_COMPATIBLE_ROOM` (zero compatible rooms), `NO_AVAILABLE_SLOT` (teacher dominates busy counts), otherwise `HARD_CONFLICT`. The no-slot/no-room/hard-conflict trichotomy is honestly derived from busy-slot counters; edge of edges (teacher free everywhere, section free everywhere, every candidate room occupied) classifies as `HARD_CONFLICT`, whose guidance (“resolve the existing overlap”) is still truthful for a room-overlap.
- Truthfulness caveat: `SOURCE_STALE` and `HG_FORBIDDEN` cannot occur in any live summary/preview response (`SOURCE_STALE` is never emitted because `classifyInsertionLine` is invoked with only `currentSourceSha256`; a drifted apply throws `INSERTION_STALE_AUTHORITY`, a different code). They are defensive invariants and documented vocabulary, not live states. Not a defect.

### 4. Fingerprint/stale/idempotency ordering — PASS with two residuals
- Ordering verified in code: (1) idempotency pre-check on `auditLog(action=TIMETABLE_INSERTION_APPLIED, metadata.previewFingerprint)` **before** any recompute — correct because the apply’s own draft insert legitimately changes the occupancy the fingerprint covers; (2) recompute of the canonical fingerprint from committed authority only (fresh `buildCanonicalTimetableDemand` + `summarizeUnassignedInsertionReadiness`); (3) typed `409 INSERTION_STALE_AUTHORITY` with recomputed candidates/source-revision details on any drift; (4) in-transaction re-check of section/teacher/room occupancy for the exact candidate before insert; (5) `uq_locked_session` unique constraint backstop.
- Residual R-A: the in-transaction re-check (`findFirst` on section/teacher/room at day+startTime) has **no `status: 'DRAFT'` filter**, while the occupancy used to build the preview/recompute is read with `status: 'DRAFT'` only. A non-DRAFT row (e.g., `LOCKED_FOR_RUN` from a run that already bound the workspace) is invisible to the summary/preview but visible to the apply re-check → apply throws `409 HARD_CONFLICT` for a slot the preview presented as free. Fail-safe direction (no double-book), but the summary and the apply gate disagree on what “occupied” means. Recommendation: make the re-check use the same `status` semantics as the summary, or exclude the workspace once runs exist (the workflow is pre-generation by contract).
- Residual R-B: under true concurrent applies (both pass pre-audit, both recompute equal fingerprints, both enter Serializable tx), the loser may surface as Prisma `P2034` (serialization failure), which the error handler renders as a generic 500 rather than a typed idempotent/409 response. Convergence to a single row is still guaranteed (unique constraint for same slot; prior-audit short-circuit after the winner commits), but the transient response shape is not client-friendly. Map `P2034` alongside `P2002`.

### 5. Concurrency — PASS for the stated goal, with the same-fingerprint/different-index nuance
Two concurrent applies of the same preview fingerprint that choose the **same `candidateIndex`** produce exactly one row (in-tx audit re-check + `uq_locked_session` backstop). Assessment done by code trace; I did not run a live concurrent fixture (shared DB). Nuance: idempotency is keyed on the fingerprint only, not on `(fingerprint, candidateIndex)`. Two concurrent applies of the same fingerprint choosing **different** candidate indexes of the same N-slot candidate list can each insert a distinct row (different day/startTime → no unique clash) before either recompute observes the other. See product finding P-01; this only matters once apply is enabled.

### 6. Query shape / memory — PASS
Set-based reads only in both services (one `findMany`/`findUnique` per domain, filters pushed into SQL: `schoolId`, `schoolYearId`, `isActiveForScheduling`, `isStale`, `status: 'DRAFT'`); occupancy is one filtered `lockedSession.findMany`; candidate search is in-memory over bounded data. No per-line DB loop. No `GenerationRun` JSON payload loading anywhere on the TT-C02 read paths (only a lightweight `generationRun.count` for `liveGenerationRunCount`). Large-response note: the summary returns up to `demand.totalLines` line states plus guidance per line (~552 lines live); acceptable for an operator dialog but worth a paging/search pass (see P-02).

### 7. Real route wiring and authz — PASS
- `app.ts` mounts `timetable-unassigned.router` under `/api/v1/generation`.
- GET summary, POST preview, POST apply are all behind `authenticate` + an in-router privilege/school guard. Apply additionally requires a JWT `userId`, a non-null `actorSchoolId`, and `actorSchoolId === schoolId` (router 401/403 + service `403 CROSS_SCHOOL_DENIED`). Cross-school apply cannot be reached with a school-scoped privileged JWT.
- Errors are thrown with `statusCode`+`code` and rendered by the shared `errorHandler` (`403/404/409` map correctly).
- Observation: for a privileged role whose JWT carries no `schoolId` claim, `actorSchoolId` is null → summary/preview pass the school check vacuously (any school readable) while apply is correctly denied (`401 NO_USER`). Local auth JWTs carry `schoolId`; the unscoped `SYSTEM_ADMIN` system-token path uses `authenticateWithSystemToken`, which this router does not use. Residual exposure is therefore limited; consider failing closed on a null actor school for read endpoints too, for parity.

### 8. UX clarity (read-only review of the component) — PASS with a reachability gap
- Dialog shows the real blocking reason (`reason` badge), a plain-language `prerequisite` and exactly one `primaryAction` per group, plus a per-line message.
- Preview candidates show teacher (`ownerFacultyName`), subject, section, term, day, time, and room name.
- Save boundary: disabled button with an explicit label “Save placement (preview only)” and a plain-language note that apply is fixture-exercised only and not enabled on the live year. `allowApply:false` is hard-coded; apply is unreachable from the UI.
- Loading/empty/error/degraded states all present; refresh affordance present.
- Touch targets: `h-11` (44px) on all actionable buttons incl. the refresh and preview buttons.
- No page-level overflow: content scrolls inside a fixed-height `DialogContent` with `overflow-auto`; no global scrollbar introduced.
- No raw `<select>`/native buttons; only `@/ui/*` primitives (`Badge`, `Button`, `Dialog*`, `ScrollArea`).
- **P-02 (reachability gap):** each reason group only lists `samples.slice(0, 5)` PLACEABLE lines. Live year-8 state is 552 PLACEABLE lines / 0 unresolved, so an operator can preview at most 5 of 552 lines from this dialog — there is no search, filter, or pagination. Either the group is meant as a sample for a different flow, or the dialog needs a searchable/scrollable line picker. As built, the workflow’s primary affordance is effectively inert for the dominant real dataset.

### 9. Collision boundary with TL-C02 / curriculum streams — PASS
Working-tree diff touches only the TT-C02 owned set (`app.ts` 2 lines, `TimetableSimpleHeader.tsx` small mount, and the new files). No edits to `faculty-assignment.service.ts`, teaching-load-* services/routes, `allocation.service.ts`, `qualification-evaluator.service.ts`, `workload-policy.service.ts`, the TeachingLoad UI, curriculum requirement services/routes/data, or any Prisma schema/migration. Confirmed via `git status` + `git diff`.

### 10. Fixture safety — PASS on happy path; residue risk on failure paths (see S-01/S-02)
The fixture builds a fully disposable school + year (`schoolYearId` in the 900000+ band), never touches school 1 / year 8 beyond reading one actor id, exercises summary/preview/apply/idempotency/tamper-rejection only on the disposable school, and deletes everything in `finally`, asserting zero subject/school residue. Apply-under-test runs only on the disposable school (`actorSchoolId` = disposable `schoolId`).

## Findings

### Product findings (require implementer/owner action before the apply boundary is enabled)

- **P-01 (material, product-semantics): a single apply places only one weekly session, but a demand line requires `sessionsPerWeek` sessions and the fingerprint/idempotency is bound to the whole candidate list.** The preview returns up to `sessionsPerWeek` candidate slots; the fingerprint covers that entire list; yet apply inserts exactly one `LockedSession` row for `candidateIndex`. Consequences: (a) an operator who applies a 2-session/week meeting (e.g., the fixture’s own 90-minute subject, `sessionsPerWeek=2`) places only 1 of the 2 required sessions; (b) a retry or second apply under the *same* fingerprint short-circuits as `alreadyApplied` (audit stores the fingerprint, not the candidate index), so the second session cannot be placed from that preview — the operator must silently re-preview to obtain a new fingerprint and apply again, leaving the meeting partially placed in the draft workspace without a truthful signal; (c) two concurrent applies of one fingerprint choosing different candidate indexes both insert distinct rows. The fixture asserts this single-row behavior as success, so the ambiguity is enshrined rather than tested. Either (i) make an apply insert the whole meeting (all `needed` sessions atomically) and bind the audit/fingerprint per apply, or (ii) explicitly scope the preview/fingerprint/audit to a single session and state that partial weekly placement is intentional and how the remainder is completed. Do not enable the save boundary until this is resolved.
- **P-02 (minor UX): PLACEABLE group shows only 5 sample lines with no search/paging; the remaining ~547 placeable lines are unreachable from the workflow.** Add a searchable/scrollable line picker (or a link into the draft-board flow) before this dialog is expected to drive placement.

### Safety findings

- **S-01 (fixture residue on failure/crash paths):** cleanup tracks created IDs incrementally and the final residue assertions only check disposable subjects/schools. If an assertion fails or the process dies between row creation and the corresponding `created*Ids.push` (e.g., the `actionRows.length===1` assertion at line 240 before `createdLockActionIds.push`), orphan `locked_session_actions` (their `lock_id` is `SetNull` on lock delete) and/or `audit_logs` rows for the disposable school remain in the shared DB. Recommend a deterministic catch-all in `finally` keyed on the disposable `schoolId`/`schoolYearId` (delete `auditLog`, `lockedSessionAction`, `lockedSession`, then the scoped authority rows, then the school) plus residue assertions over those tables, so a mid-test failure cannot leave residue.
- **S-02 (summary vs apply re-check disagreement on non-DRAFT rows):** apply’s in-transaction occupancy re-check is status-agnostic while summary occupancy reads `status: 'DRAFT'` only. A `LOCKED_FOR_RUN` row can therefore be invisible to the preview yet trip apply with `409 HARD_CONFLICT`. Fail-safe, but reconcile the two definitions or forbid apply once the workspace is run-bound.

### Process finding

- **R-01: the candidate is not committed.** `HEAD` still equals the review base `330fb91b`; every TT-C02 file is untracked or unstaged. Per the default commit-based executor workflow, no immutable review boundary (`<base>...<candidate>`) exists yet. Hand the candidate off as a conventional commit on `work/timetable-ttc02` and re-record the candidate SHA before formal review. Also, one new-client file contains a formatting regression in the header mount: `const [insertionOpen, setInsertionOpen] = useState(false);` is indented at column 0 (should match sibling indentation).

## Zero-Write / Safety Confirmation
Preview and summary make no write calls. Apply writes only `LockedSession` (DRAFT), `LockedSessionAction`, and `AuditLog` in one Serializable transaction. No Teaching Load/curriculum/subjects/sections/publication write exists. Confirmed by grep over both new services.

## Verdict
- Safety-critical or authority defect: **none found** for the current preview-only (apply-disabled) release.
- Material findings requiring action before apply enablement: **P-01** (apply/idempotency semantics vs multi-session meetings), **P-02** (line reachability), **S-01** (fixture catch-all cleanup), **S-02** (status-filter parity).
- Independent command evidence: hermetic 15/15 and client 2/2 rerun by this reviewer; evidence JSON SHA verified. Live fixture test not rerun (shared-DB mutation); assessed statically.

**zeroFix: false** (P-01/P-02/S-01/S-02 remain open; none blocks the current preview-only release, but each must be resolved or explicitly accepted by the owner before the apply/save boundary is enabled).
