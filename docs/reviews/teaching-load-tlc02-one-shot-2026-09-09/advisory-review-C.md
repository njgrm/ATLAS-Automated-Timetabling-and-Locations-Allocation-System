# Advisory Review C — TL-C02 Teaching Load Reconciliation (changed-scope pass)

- **Reviewer identity:** `REVIEWER_C_ADVISORY` (the execution system exposed no distinct agent/thread identifier for this reviewer lane; model context `opencode-go/deepseek-v4-flash`). Per the review instructions this is the recorded fallback handle. Advisory evidence only — no approval, mutation, or unlock authority.
- **Role:** Fresh changed-scope advisory reviewer (Reviewer C lane) over the fixes produced after Advisory Reviews A and B. Reviews ONLY the changed scope; prior artifacts (`advisory-review-A.md`, `advisory-review-B.md`) are the established baseline.
- **Reviewed worktree:** `D:\ATLAS-worktrees\teaching-load-tlc02`, branch `work/teaching-load-tlc02`, base `origin/main` `330fb91b7daa28299520272b1e258cc49395af04`. Changes remain uncommitted (same pre-candidate state as reviews A/B). No source file was modified during this review; all probes ran read-only except disposable fixture schools created and fully removed within the probe.
- **Review date:** 2026-09-09

## Changed-scope inventory (the fixes under review)

| # | Fix | File / lines | Prior finding it closes |
|---|-----|--------------|--------------------------|
| F1 | `pickCandidate` hard-cap gate now uses `subject.minMinutesPerWeek` (the minutes the simulated load actually credits) instead of `pair.weeklyMinutes` | `atlas-server/src/services/teaching-load-reconciliation.service.ts:671-676` | A1 (Reviewer A BYPASS-1, product/runtime, MEDIUM) |
| F2 | `specializationAliases` added to `buildReconciliationSourceRevision` hash | `teaching-load-reconciliation.service.ts:1176-1178` | A3 (Reviewer A BYPASS-3, safety-gate, LOW) |
| F3 | Adviser-preference unsatisfied reasons refined into typed reasons | `teaching-load-reconciliation.service.ts:1003-1033` | A5/B refinement (informational) |
| F4 | `loadHgSubjectIds` made case-insensitive (`mode: 'insensitive'`) | `atlas-server/src/services/faculty-assignment.service.ts:1295-1301` | A2 (Reviewer A BYPASS-2, safety-gate, LOW) |
| F5 | Preview/Apply/Reconcile controls raised to `h-11` (44px) touch height | `atlas-client/src/components/faculty-assignments/TeachingLoadReconciliationPanel.tsx:178,368`; `atlas-client/src/pages/TeachingLoad.tsx` (Reconcile button) | B-1 (Reviewer B, REQUIRED MINOR, 44px touch targets) |
| F6 | New regression test A10 (hard-cap gate consistency) | `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts:344-362` | locks F1 |

Supporting changed files read for context: `atlas-server/src/routes/faculty-assignment.router.ts`, `atlas-server/src/services/teaching-load-reconciliation.service.ts` (full), `atlas-client/src/lib/teaching-load-reconciliation-helpers.ts`, `atlas-client/src/lib/__tests__/teaching-load-reconciliation-ui.test.ts`, `atlas-client/src/types.ts`.

## Commands independently run (reviewer, current session)

| Command | CWD | Exit | Result |
|---------|-----|------|--------|
| `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` | `atlas-server` | 0 | `RESULT: 86 passed, 0 failed` (incl. new A10); Part B disposable fixture created + removed with zero-residue assertion passing |
| `npx tsc --noEmit` | `atlas-server` | 0 | no diagnostics |
| `npx tsc --noEmit` | `atlas-client` | 0 | no diagnostics |
| `npx tsx --test src/lib/__tests__/teaching-load-reconciliation-ui.test.ts` | `atlas-client` | 0 | 5/5 pass, 0 fail, 0 skip |
| `npx tsx C:\Users\njgro\AppData\Local\Temp\opencode\tlc02-advisory-c-probe.ts` | `atlas-server` | 0 | 22/22 probe assertions pass; disposable fixture school created + removed, zero residue |

The probe script lives outside the repository (`C:\Users\njgro\AppData\Local\Temp\opencode\tlc02-advisory-c-probe.ts`) and is not part of the repo diff.

## Adversarial probes designed by this reviewer (≥2 required; 5 delivered)

### Probe C1 — hard-cap gate with `offering.weeklyMinutes << subject.minMinutesPerWeek` and a cap between them, at NONZERO current load (extends A10)
Hermetic `buildReconciliationPlan` snapshot:
- Faculty 1 owns SUB_A:101 (credited 180 min) → RETAIN (current load 180, nonzero).
- Demanded pair MATH:102 with offering `weeklyMinutes = 10` but subject `minMinutesPerWeek = 240`; `hardCapMinutes = 200`, `teachingStandardMinutes = 180`; faculty 1 (180) and zero-load faculty 2 both qualified.
- Pre-fix behavior (Reviewer A BYPASS-1): gate `180 + 10 ≤ 200` and `0 + 10 ≤ 200` → both would be proposed → simulated load jumps to 420/240 (over cap).
- Observed: MATH:102 → `UNRESOLVED` (`NO_QUALIFIED_CANDIDATE`), no `proposedFacultyId`, zero INSERT/MOVE with a proposed faculty, faculty 1 stays 180, faculty 2 stays 0, `max(afterMinutes) ≤ 200`. **The plan cannot assign over the cap. BLOCKED (fix holds).**
- Confirmed in code: `gateMinutes = gateSubject ? max(0, minMinutesPerWeek) : weeklyMinutes` (`:675-676`); the credited basis is `computeTeachingLoadMinutes` (`:462-513`), which uses `minMinutesPerWeek` — same basis. Rotation-peak semantics make the gate conservative (never underestimates the credited increment), so the gate cannot slip a faculty over the cap through a rotating member either. The rebalance path (`:939-951`) uses the same basis on both its own `pickCandidate` gate and the explicit cap/standard re-checks.

### Probe C1b — gate boundary correctness (guards against over-blocking)
Faculty 1 at 180 (SUB_A retained, offering present), subject SUB_B `minMinutesPerWeek = 20` (offering `weeklyMinutes = 5`), cap 200. Gate `180 + 20 = 200 ≤ 200` → SUB_B is INSERTed and faculty 1 lands at exactly 200 with status `excess` (not `over-cap`). The fix rejects only true over-cap candidates, not the boundary. **PASS.**

### Probe C2a — `specializationAliases` bound into the source revision (pure hash)
Hermetic `buildReconciliationSourceRevision`: snapshots differing only in `specializationAliases` (added; and separately an alias used by no faculty/subject) both flip the revision hash. Deterministic for identical input. Consequence: an alias-only change now surfaces as `SOURCE_DRIFT` (apply rejects), closing Reviewer A's "alias change silently accepted" gap; a plan-affecting alias change was already caught by the fingerprint, and is now caught at the revision layer too. **PASS.**

### Probe C2b — alias toggle at the real service boundary (disposable fixture school)
Disposable fixture: subject with `allowedSpecializations: ['MATH-SPEC']`, ownerDepartment `X`; faculty with `specialization: 'SPE'`, department `Y`; `specializationAlias('SPE' → 'MATH-SPEC')`. Only the alias grants qualification (department/cross-permission match deliberately false).
1. Preview 1 → `INSERT=1`, `UNRESOLVED=0`; record `sourceRevision1`, `fingerprint1`.
2. Toggle alias canonical to `NOMATCH`.
3. Preview 2 → `sourceRevision2 ≠ sourceRevision1`, `fingerprint2 ≠ fingerprint1`, and the pair flips to `UNRESOLVED` (`INSERT=0`).
4. Apply with stale `expectedSourceRevision=rev1`, `expectedFingerprint=fp1` → typed `409 SOURCE_DRIFT`, **zero writes**.
5. Fixture removed with zero residue.
**PASS — fix F2 verified end-to-end (hash sensitivity + drift rejection + zero partial writes).**

### Probe C3a — lowercase `hg` excluded from reconciliation demand (hermetic)
Snapshot with subject code `hg` (lowercase) and an active offering → `expandCurriculumDemand` returns zero pairs and no `hg` pair. The reconciliation path's `subject.code.toUpperCase() === HG_SUBJECT_CODE` guards (`:347, :415, :607`) are already case-insensitive; this probe confirms lowercase is handled. **PASS.**

### Probe C3b — lowercase `hg` excluded by the effective-contract filter (disposable fixture school)
Disposable fixture: subject code `hg` (lowercase), an ownership row + FacultySubject for it. `loadHgSubjectIds(schoolId)` returns the lowercase `hg` subject id (`mode: 'insensitive'`), and the ownership row exists (pre-condition proving the filter has something to exclude). The `getAssignmentSummary` filter (`faculty-assignment.service.ts:5153-5159`) then drops that row from `activeOwnershipRows` → the `ownershipIndex` consumed by `getEffectiveTeachingLoad` (`:5626-5642` → `enrichEffectiveAssignments` on `summary.ownershipIndex`) carries no HG assignment. Fixture removed with zero residue. **PASS — fix F4 verified at the real query boundary.**

## Findings (changed scope)

### Product / runtime
- **None material.** C1 confirms the hard-cap gate can no longer propose an over-cap assignment even when `offering.weeklyMinutes << minMinutesPerWeek` with a cap between them, at nonzero current load, and C1b confirms the boundary is not over-blocked. A10 regression locks the shape. F5 (44px touch targets) is met on all three primary controls (`h-11` = 44px).

### Safety-gate
- **None material.** C2a/C2b confirm `specializationAliases` is now bound into the source revision, a stale apply after an alias toggle is rejected with a typed 409 and zero partial writes, and C3a/C3b confirm lowercase-`hg` is excluded both in reconciliation demand and in the effective-contract ownership index. The case-insensitive `loadHgSubjectIds` closes the exact consumer leak Reviewer A identified.

### Process / documentation
1. **[INFORMATIONAL — C-1] Residual exact-match `code: { not: HG_SUBJECT_CODE }` subject-scoping filters remain in `getAssignmentSummary` (`faculty-assignment.service.ts:5078-5082`) and in sibling HG queries (`:1635, :1792`).** For a school storing HG as lowercase `hg`, the new case-insensitive ownership filter removes HG rows from `ownershipIndex`, so the consumer contract is clean; however the exact-match `not: HG` subject query still admits `hg` into `activeSubjects`/`teachablePairSet`, so summary *diagnostics* (`coverageTotals.rawAssignedPairs`/`rawUnassignedPairs`, `:5582-5585`) and `subjectCodeById` can still count a lowercase-`hg` pair. This does not re-leak an HG assignment to AIMS/SMART (the contract consumes `ownershipIndex` only) and it is a pre-existing filter style on lines outside the changed diff. Recommend aligning those filters to the same case-insensitive exclusion in a later pass for full consistency. Not blocking.
2. **[INFORMATIONAL — C-2] Changed scope remains uncommitted.** All five fixes plus A10 are unstaged/untracked at base `330fb91b`; the review range is the worktree diff. Consistent with the expected pre-commit state and matching the standing note from reviews A/B (ledger statuses still need reconciliation before the final commit).

## Verification of the required gates
- `86 passed / 0 failed` on `teaching-load-reconciliation.test.ts` (A10 included).
- Server and client `tsc --noEmit` clean.
- Client UI suite `5/5`.
- Review probes `22/22`, all disposable fixture residue `0`.

## Verdict

**`zeroFix: true`**

No new material product, safety-gate, or process defect was found in the changed scope. Every fix under review — hard-cap gate basis (F1/A10), alias-bound source revision (F2), typed adviser-preference reasons (F3), case-insensitive HG exclusion (F4), and 44px touch targets (F5) — holds against independent adversarial probes (C1, C1b, C2a, C2b, C3a, C3b). Findings C-1/C-2 are informational only and do not block. Advisory evidence only; does not authorize GO, apply, merge, or successor unlock.

### Suggested commit (for the implementing stream, when authorized)
```
fix(faculty): align reconciliation hard-cap gate to credited minutes, bind alias source revision, case-insensitive HG exclusion, 44px controls
```