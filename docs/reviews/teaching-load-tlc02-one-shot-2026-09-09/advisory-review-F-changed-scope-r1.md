# Changed-Scope Advisory Review — F (TL-C02R1: active-year authority, FacultySubject gradeLevels, mounted-route integration)

- **Reviewer identity:** `REVIEWER_F_CHANGED_SCOPE_R1_ADVISORY` (no execution-system context handle exposed by the harness to this reviewer; independent of the implementation executor and of advisory reviewers A/B/C/D/E).
- **Artifact role:** Fresh changed-scope advisory review of the TL-C02R1 narrow correction only. Advisory evidence only; not formal planner/QA acceptance, no `GO`, no unlock authority.
- **Reviewed diff identity:** Base candidate `e67b684fb72decb9ef2834b5566e66f5cf56f08f` + uncommitted working-tree changes on branch `work/teaching-load-tlc02`, worktree `D:\ATLAS-worktrees\teaching-load-tlc02`.
- **Review boundary:** ONLY the changed scope enumerated in the review prompt. Pre-existing candidate behavior outside this scope is not re-adjudicated. Only NEW material findings in the changed scope count.

## Changed-Scope Inventory

1. `atlas-server/src/services/teaching-load-reconciliation.service.ts`
   - `SchoolYearAuthoritySnapshot` type + `readSchoolYearAuthoritySnapshot(client, schoolId, schoolYearId)` (`:1357–1393`): client-injected `EnrollProSchoolYearMirror.findFirst` scoped by `{schoolId, enrollProSchoolYearId}`; missing/cross-school → 404 `YEAR_MIRROR_NOT_FOUND`; archived → 409 `ARCHIVED_YEAR`; known-but-inactive → 409 `INACTIVE_HISTORICAL_YEAR`. Called from `readReconciliationSourceSnapshot` on the caller-supplied client (`:1401`).
   - `schoolYearAuthority` carried in `ReconciliationSourceSnapshot` (`:1443`) and bound into `buildReconciliationSourceRevision` (`:1224–1232`: mirrorId, enrollProSchoolYearId, yearLabel, isActive, isArchived, syncStatus, updatedAt).
   - `FacultySubjectSnapshot.gradeLevels` (`:124`) read through the snapshot (`:1510–1517`) and canonicalized in the revision (`:1304`).
   - `canonicalIntSet` / `canonicalStringSet` (`:1209–1217`); set-valued arrays canonicalized in the revision: `subject.programScopes/gradeLevels/allowedSpecializations` (`:1278–1280`), `facultySubject.sectionIds/gradeLevels` (`:1303–1304`). Ordered `termIdentities` kept ordered (`:1237`).
   - Apply-side derivation: `sectionGradeByExternal` map from snapshot sections (`:1750–1758`) and `deriveGradeLevels(sectionIds)` over the **resulting** sectionIds; `ensureFacultySubject` insert/update (`:1760–1803`) and `releaseFacultySubjectSection` (`:1805–1828`) update `sectionIds` + `gradeLevels` atomically with `version` increment.
2. `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts` — B11 (active-year authority: missing 404/zero-write, cross-school 404, inactive 409, archived 409, apply revalidates through the Serializable tx client, restore), B12 (cross-grade insert `[7,8]`, replay zero-write with arrays unchanged, move donor `[7]`/recipient `[8]`, retire drops grade 8 + ownership removed), fixture mirror setup/cleanup.
3. `atlas-server/src/__tests__/teaching-load-reconciliation-route.test.ts` (untracked, new) — mounted real app + real `authenticate` middleware + hand-signed JWTs; 47 assertions.
4. `docs/progress/teaching-load-tlc02-one-shot-2026-09-09-progress.md` — TL-C02R1 section; `docs/verification/teaching-load-current-year-reconciliation-preview-tlc02r1-2026-09-09.json` + `.sha256` sidecar.

## Commands Independently Rerun (read-only)

| Command | Result |
|---|---|
| `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` (server) | **158 passed, 0 failed** (includes B11/B12) |
| `npx tsx src/__tests__/teaching-load-reconciliation-route.test.ts` (server) | **47 passed, 0 failed** |
| `npx tsc --noEmit` (server) | exit 0 |

Artifact integrity: byte SHA-256 of the tlc02r1 JSON (`341D8A2B…A00520BB`) recomputed and matches the sidecar; embedded `source.fingerprint = F0F29E21…23BC0`, `sourceRevision = 247B8494…C6490`, school 1 / year 8, `applied: false` — consistent with the progress doc and the live preview re-run.

## Adversarial Probes (designed for this review, run outside the repo)

Scratch probes created OUTSIDE the repository (`C:\Users\njgro\AppData\Local\Temp\opencode\`), importing the service/prisma via `pathToFileURL`, run with `npx tsx` from the worktree server dir. **All probes passed (exit 0), zero DB residue asserted after cleanup.** No repository source file was created/edited/deleted; the two unrelated untracked tests observed below pre-existed and were not touched.

- **P1 — canonicalization / set-order invariance.** Two snapshots differing only in the ORDER and duplication of `programScopes` (`['STE','REGULAR']` vs `['REGULAR','STE']`), `subject.gradeLevels` (`[8,7]` vs `[7,7,8]`), `allowedSpecializations`, `facultySubject.sectionIds` (`[201,101,102,201]` vs `[102,101,201]`) and `facultySubject.gradeLevels` (`[8,7,8]` vs `[7,8]`) produce **identical** revisions. Confirms reordering an input array does NOT change the fingerprint.
- **P2 — ordered term identities.** Reordering `termConfig.termIdentities` (`['Term 1','Term 2','Term 3']` vs `['Term 3','Term 1','Term 2']`) produces **different** revisions — ordered identities stay order-sensitive.
- **P3 — schoolYearAuthority in revision.** Archived flip, inactive flip, and a non-authority `syncStatus`/`updatedAt` change each change the revision, so the mirror is genuinely bound into the revision and not only behind the authority gate.
- **P4 — canonicalIntSet/canonicalStringSet edges.** Dedup+sort, non-integer filtering (`[1.5, NaN, 2, 3] → [2,3]`), trim+empty-drop+locale sort. Pass.
- **P5 — DB-backed active-year authority + SOURCE_DRIFT (live Tailnet DB, disposable school/year 9090, zero residue):**
  - P5a active-year preview succeeds (64-hex fingerprint).
  - P5b **syncStatus-only flip** (no authority flip) then apply with the OLD fingerprint → **`409:SOURCE_DRIFT`** — proves the mirror is inside the revision via the production apply path, not merely gated.
  - P5c re-preview after the resync succeeds and yields a different fingerprint.
  - P5d archive flip then apply with the pre-archive fingerprint → 409 with **zero ownership writes**.
  - P5e **cross-school isolation**: a second school holds an active mirror for the same year id; the fixture school (no mirror) still gets `404:YEAR_MIRROR_NOT_FOUND` — the lookup is school-scoped.
- **P5d-exact-code (focused re-run)** — archive flip with a stale fingerprint returns exactly **`409:ARCHIVED_YEAR`** (authority gate fires before revision comparison), not `SOURCE_DRIFT`. See I-1.
- **Live-data probe (read-only)** — for school 1 / year 8 active sections: `displayOrder` distribution is exactly `{7,8,9,10}` (5 sections each) while `gradeLevelId` is the grade-entity id `{17,18,19,20}`. The snapshot convention `gradeLevel: section.displayOrder` (`:1471–1472`) therefore equals the grade NUMBER in production, so the newly persisted derived `gradeLevels` are correct. See I-3.

## Findings

### Product / runtime defects (new, material)
**None.** Active-year authority is validated through the tx client in apply (trace: `applyTeachingLoadReconciliation` → `readReconciliationSourceSnapshot(schoolId, schoolYearId, tx as any)` `:1963` → `readSchoolYearAuthoritySnapshot(tx, …)` `:1401` → `tx.enrollProSchoolYearMirror.findFirst` `:1363`; `readTeachingLoadCycleSource`/`refreshTeachingLoadCycle` also take the tx client; no global `db()` read exists inside the apply transaction — only `db().$transaction(...)` to open it). gradeLevels are recomputed over ALL resulting sectionIds on insert (`:1765–1776`), create (`:1787–1798`), and move/retire (`:1815–1825`), and B12 proves the move drops the last grade-8 section from the donor (`[7]`) while the recipient gets `[8]`. Set arrays are canonicalized in the revision (P1) and reordering cannot change the fingerprint (P1/P2). Route-level numeric-string normalization to one fingerprint (R4), system-token 401 on preview/apply vs 200 on readiness (R3), and missing-year writes-nothing (R6) all hold.

### Safety-gate defects
None. Apply re-validates the mirror inside the Serializable transaction (B11 + P5d), so an archive/inactive flip between preview and apply cannot be applied (zero writes proven).

### Process / documentation observations
- **O-1 (informational):** Two unrelated untracked test files exist in the working tree (`atlas-server/src/__tests__/faculty-assignment-pass5-regression.test.ts`, `atlas-server/src/__tests__/workload-policy.test.ts`) that are outside the TL-C02R1 changed scope. The correction commit must stage ONLY the changed-scope paths (service, the two reconciliation test files, progress doc, verification artifact) and must not sweep these in.
- The progress doc's TL-C02R1 section accurately describes the implemented behavior and gate results; the tlc02r1 artifact is internally consistent and byte-verified.

## Informational Findings (no required fix; documented for precision)

- **I-1 — Archive/inactive flip returns the authority 409, not `SOURCE_DRIFT`.** Because `readSchoolYearAuthoritySnapshot` runs before revision comparison inside the apply transaction, applying a stale preview after the mirror is archived/inactivated returns `409:ARCHIVED_YEAR` / `409:INACTIVE_HISTORICAL_YEAR`, not `409:SOURCE_DRIFT`. The invalidation requirement is still fully satisfied (409 + zero writes, B11/P5d), and the mirror's presence in the revision is proven independently by the syncStatus-only flip → `SOURCE_DRIFT` (P5b). This is a code-path ordering choice, not a defect.
- **I-2 — `deriveGradeLevels` map is built from `snapshot.sections` (filtered to `isActiveForScheduling: true, isStale: false`, `:1408`).** A `FacultySubject.sectionIds` entry referencing a section absent from the snapshot (e.g., an orphaned stale section id with no ownership row, which the plan cannot RETIRE) would silently drop that grade from the derived array while the id stays in `sectionIds`. In the normal ownership-driven path this is self-correcting (RETIRE removes the section and recomputes in the same transaction). Not exercised by B12 (all fixture sections active/non-stale); edge only, no required fix in this scope.
- **I-3 — Fixture sections set `gradeLevelId` equal to the grade number** (e.g., `gradeLevelId: 8, displayOrder: 8`), which does not mirror production semantics where `gradeLevelId` is a grade-entity id (17–20) and `displayOrder` is the grade number (7–10). The derivation correctly uses `displayOrder`, so live output is correct (verified read-only on school 1 / year 8); the fixtures just do not model the entity-id distinction, which is harmless for these tests.

## Verdict

**`zeroFix: true`**

The changed scope satisfies the TL-C02R1 requirements: (1) active-year authority is enforced in readiness, preview, and apply, with apply re-validating through the same tx client inside the Serializable transaction and no global-client reads in the apply path; (2) the source revision binds the mirror identity/authority state so an outstanding preview is invalidated (authority 409 on archive/inactive flips, `SOURCE_DRIFT` on non-authority mirror changes — both zero-write); (3) `gradeLevels` are derived from the resulting sectionIds via the SectionMirror mapping for insert/move/retire/create, confirmed consistent with live data; (4) set arrays are canonicalized while ordered term identities stay ordered; (5) the mounted-route integration proves numeric-string normalization, system-token 401s, missing-year zero-write, exact-fingerprint apply, and replay zero-write. Required commands pass (158/0, 47/0, `tsc` exit 0). No repository source files were modified by this review; all scratch probes lived in `TEMP` and the DB fixtures were fully removed with zero residue.