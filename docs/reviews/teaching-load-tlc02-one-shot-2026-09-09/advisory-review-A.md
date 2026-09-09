# Advisory Review A — TL-C02 Teaching Load Reconciliation

- **Reviewer identity:** `REVIEWER_A_ADVISORY` (no execution-system context identifier was relayed to this reviewer lane; per AGENTS.md reviewer-identity rules this artifact is ADVISORY evidence only and cannot satisfy a formal prompt/phase review task).
- **Review type:** ADVISORY (independent reviewer lane; no approval or mutation authority).
- **Reviewed base SHA:** `330fb91b7daa28299520272b1e258cc49395af04` (`origin/main`).
- **Candidate state:** branch `work/teaching-load-tlc02`; production diff is **uncommitted** — 2 modified tracked files + new untracked files in the worktree. There is no candidate commit to review by range; the review inspects the worktree diff against the base.
- **Reviewed files (production scope):**
  - `atlas-server/src/services/teaching-load-reconciliation.service.ts` (new, 1820 lines)
  - `atlas-server/src/services/faculty-assignment.service.ts` (HG exclusion in `getAssignmentSummary` ownershipIndex + `loadHgSubjectIds`)
  - `atlas-server/src/routes/faculty-assignment.router.ts` (readiness/preview/apply routes)
  - `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`
  - `docs/verification/teaching-load-current-year-reconciliation-preview-2026-09-09.json` (+ `.sha256`)
  - `docs/progress/teaching-load-tlc02-one-shot-2026-09-09-progress.md`

## Commands independently run (reviewer, read-only except disposable fixtures)

| Command | Result |
|---|---|
| `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` (from `atlas-server`) | `RESULT: 84 passed, 0 failed`; exit 0. Part B fixture created and removed with zero-residue assertion passing. |
| `npx tsc --noEmit` (from `atlas-server`) | Exit 0, no diagnostics. |
| Live read-only preview probe (`npx tsx` → `previewTeachingLoadReconciliation(1, 8, 1)`) | fingerprint `F50D982B58F32A461594F3927ABBC6F321FEB105615681F69D6BE0299AD8FBB5` (`FP_MATCH: true`), sourceRevision `EAAF6E16E9375B21A637DADE41E3DFD99790D26F9D5660863DD77F1CB5534B04` (`REV_MATCH: true`), `authorizesMutation: false`, actionTotals `{"RETAIN":264,"INSERT":0,"MOVE":14,"RETIRE":1,"UNRESOLVED":0}`, hgRows `{found:0, removed:0}`. |
| SHA-256 recomputed from artifact bytes | `708392359B2B64296D2BFC602C0552E2FB05835CBB696D12DAEF1667CDDC43A5` — **matches the `.sha256` sidecar**. |
| Artifact `applied` flag | `false` (confirmed from JSON). |
| Live data probes (read-only) | 0/216 active school-1/year-8 offerings have `weeklyMinutes != subject.minMinutesPerWeek`; exactly 1 HG-like subject (`id=7`, code `"HG"`, exact). |

## Adversarial bypass attempts (designed by this reviewer)

### BYPASS-1 — Hard-cap capacity gate vs. actual simulated load basis → **SUCCEEDS (latent, material)**
`pickCandidate` gates on `currentMinutes + pair.weeklyMinutes > hardCap` (`teaching-load-reconciliation.service.ts:677-678`), where `pair.weeklyMinutes` is `offering.weeklyMinutes > 0 ? offering.weeklyMinutes : subject.minMinutesPerWeek` (`:349`). The simulated load used for the plan and the `after` distribution is computed by `computeFacultyTeachingMinutes` → `minutesForAssignedPairs` → `computeTeachingLoadMinutes(assignments, 'section')` (`:462-513`), which uses **only** `subject.minMinutesPerWeek` (`faculty-assignment.service.ts:654`).

Hermetic probe: offering `weeklyMinutes=100`, subject `minMinutesPerWeek=240`, `hardCapMinutes=200`, two qualified MATH faculties at 0 load. The plan proposed **2 INSERTs** and finished both faculties at **240 minutes (over-cap)** — the gate accepted 0+100 ≤ 200, but the load math yields 240 > 200. The plan's own `afterStatus` reports `over-cap` for the assignments its gate should have blocked. Phase-3 rebalance uses `minMinutesPerWeek` consistently (`:934, :943, :945`), so only phase-2 diverges.

- **Live impact today:** none — 0/216 live offering rows differ.
- **Classification:** product/runtime defect. **Required fix:** evaluate capacity on the same basis the load formula uses (e.g., prospective `computeFacultyTeachingMinutes` after hypothetical assignment, or use `subject.minMinutesPerWeek` in the gate).

### BYPASS-2 — HG leak into the effective contract via case-sensitivity → **does not succeed on live data; latent divergence**
Demand/plan/ownership HG exclusion is case-insensitive (`subject.code.toUpperCase() === HG_SUBJECT_CODE`, `:347, :415, :607`). The effective-contract exclusion `loadHgSubjectIds` (`faculty-assignment.service.ts:1295-1301`) queries `where: { schoolId, code: HG_SUBJECT_CODE }` — an exact, case-sensitive predicate under default PostgreSQL collation. A lowercase `hg` subject would be excluded from demand (reconciliation) but **not** excluded from the ownership index consumed by `/effective` and AIMS/SMART (`getAssignmentSummary` `:5161`). Live scan: only `id=7` code `"HG"` exists, so no live leak.

- **Classification:** safety-gate (latent). **Required/strongly recommended fix:** case-insensitive match in `loadHgSubjectIds` (e.g., `code: { equals: 'HG', mode: 'insensitive' }`) to match the reconciliation-side exclusion.

### BYPASS-3 — Missing source dimension in the revision hash → **SUCCEEDS as omission; integrity stays safe**
`buildReconciliationSourceRevision` (`:1091-1179`) omits `snapshot.specializationAliases`, which `buildQualificationResolver` uses for specialization matching (`:578-581`). Hermetic probe: two snapshots differing **only** in `specializationAliases` → sourceRevision **identical**; fingerprint differed only because the plan changed (INSERT appeared). Consequences: a plan-affecting alias change is caught as `409 FINGERPRINT_MISMATCH` (safe) rather than `SOURCE_DRIFT`; a non-plan-affecting alias change is silently accepted (harmless). Additionally, three reads escape the Serializable snapshot inside the apply: `getEffectiveWorkloadPolicy` (`scheduling-policy.service.ts:929-951`), `readDepartmentAuthoritySourceRevision` (`department-authority.service.ts:201-217`), and `loadCanonicalDepartmentMap` (`faculty-assignment.service.ts:1252-1267`) all use the global `db()` client rather than the transaction client (`teaching-load-reconciliation.service.ts:1227-1228, :568-569`). The recomputed sourceRevision still binds department/policy values so drift is detected with high probability, but isolation is impure (mixed-snapshot window).

- **Classification:** safety-gate (latent). **Recommended fix:** include `specializationAliases` in the revision hash and thread the tx client into the three escaping reads.

### BYPASS-4 — Unqualified-owner retain / name-prefix inference → **BLOCKED**
Hermetic probe: active owner with wrong department on a demanded pair → plan emits `MOVE` with `UNQUALIFIED_OWNER` (owner released to qualified candidate), not RETAIN. Faculty department `"MATH TEACHERS"` vs subject `ownerDepartment "MATH"` → no match (`UNRESOLVED`, `NO_QUALIFIED_CANDIDATE`) — no prefix/name inference. `canTeachOutsideDepartment` override correctly qualifies (tier 3). Department identity resolution uses only persisted aliases + exact trimmed uppercase equality (`:588-592, :621-625`).

### BYPASS-5 — Partial write on conflict → **BLOCKED**
Fixture tests B4 prove zero writes on forged fingerprint and on source drift (`teaching-load-reconciliation.test.ts:581-617`); the apply wraps validation + all writes in one Serializable transaction with a single audit create (`:1703-1746`), and PostgreSQL rolls back the whole transaction on any mid-transaction error (including FK). Note: my own FK-sabotage probe could not execute because the `$extends` client + `$transaction` combination threw inside Prisma before the apply ran; I relied on the B4 evidence and transaction-atomicity reasoning instead. Non-P2034 errors (e.g., P2003 from legacy out-of-sync `FacultySubject.sectionIds`) surface as a 500 rather than the typed 409 — recoverable, but worth a defensive mapping.

## Findings

### Product / runtime
1. **[REQUIRED, MEDIUM] Hard-cap gate basis mismatch in `pickCandidate`** (`teaching-load-reconciliation.service.ts:677-678` vs `:462-513`). Confirmed by BYPASS-1 probe. The plan can propose over-cap assignments while the `after` distribution reports `overCap: 0`. Not live today (0/216 rows differ) but the control is unsound for the supported data shape and contradicts the plan's own reported workload.
2. **[INFORMATIONAL] `releasedPairs` keyed-map collapse** (`:726, :806-808`). Multiple released ownership rows for one pair would collapse to the last row, silently dropping earlier released rows from the plan. Unreachable in a consistent DB because `@@unique([schoolId, schoolYearId, subjectId, sectionId])` (`prisma/schema.prisma:373`) forbids duplicate ownership. Defensive diagnostic only.
3. **[INFORMATIONAL] Preview `cycleImpact.stateBefore/stateAfter` hardcoded `POPULATED`** (`:1404, :1442`). The actual `TeachingLoadCycle` row is never read, so an EMPTY/absent cycle is reported as POPULATED→POPULATED.
4. **[INFORMATIONAL] `refreshTeachingLoadCycle` runs after commit** (`:1749-1751`). If it throws, the mutation is committed but the API returns a 500; recoverable by replay (re-computed plan has no mutations → `replayed: true`), but error semantics are misleading.
5. **[INFORMATIONAL] Adviser-preference reason mislabeling under rebalance** (`:982-984, :1018-1027`). A pair inserted to another faculty then rebalanced away can surface as `ALL_SECTION_PAIRS_ALREADY_OWNED` instead of `CAPACITY_OR_RANKING`; `unsatisfied:false` is still surfaced, so the preference is never silently ignored — the reason label can be imprecise.
6. **[INFORMATIONAL] MOVE/RETIRE FK ordering is correct; legacy mis-sync error typing.** Recipient-first MOVE ordering (`:1631-1640`) and delete-ownership-before-release (`:1611-1617`) are FK-safe. `ensureFacultySubject` keys by `facultyId:subjectId` ignoring `schoolYearId` (`:1523-1527`); legacy NULL-year `FacultySubject` rows (schema allows, `schema.prisma:328,341`) could coexist and the map would pick arbitrarily — edge/legacy.

### Safety-gate
7. **[REQUIRED/strongly recommended, LOW] Case-sensitivity divergence between reconciliation HG exclusion and `loadHgSubjectIds`** — see BYPASS-2. Latent HG-leak-to-consumers path; not live today.
8. **[RECOMMENDED, LOW] `specializationAliases` omitted from `buildReconciliationSourceRevision`; three reads escape the Serializable snapshot** — see BYPASS-3. Integrity remains safe (fingerprint catches plan-affecting drift) but the revision-hash claim and isolation purity are incomplete.

### Process / docs
9. **[INFORMATIONAL] Progress ledger statuses are stale.** `teaching-load-tlc02-one-shot-2026-09-09-progress.md` still marks T1.2, T2.1, T3.1, T4.1, T5.1, T6.1, T7.1 as `IN PROGRESS`/`PENDING` although the service, routes, tests (84 passing), artifact + `.sha256`, and reconciliation panel exist and are verified. Ledger/summary agreement (fail-closed) requires the executor to reconcile statuses before the final commit.
10. **[INFORMATIONAL] No candidate commit yet.** All production changes are unstaged/untracked at base `330fb91b`; the review range is the worktree diff, not a commit range. Expected pre-final-commit state, but the immutable handoff (base/candidate SHAs, staged path list, `git diff --cached --check`) is not yet produced.

## Verification of the live preview artifact

- SHA-256 recomputed from file bytes matches the sidecar: `708392359B2B64296D2BFC602C0552E2FB05835CBB696D12DAEF1667CDDC43A5`.
- Running the real service read-only for school 1 / year 8 returns exactly the artifact's fingerprint `F50D982B58F32A461594F3927ABBC6F321FEB105615681F69D6BE0299AD8FBB5` and sourceRevision `EAAF6E16E9375B21A637DADE41E3DFD99790D26F9D5660863DD77F1CB5534B04`; action totals and `hgRows.found=0` match; `authorizesMutation: false`.
- Artifact `applied: false` — confirmed.
- Preview read path is zero-write (fixture B2 asserts zero write operations; live probe performed reads only).

## Verdict

**`zeroFix: false`**

Finding 1 (hard-cap gate basis mismatch) is a material product-control defect in the reconciliation path: it is reproducible with a plausible persisted-data shape and contradicts the plan's own reported `after` workload distribution. Even though the live dataset does not currently trigger it, an advisory reviewer must keep the owning task open until the executor aligns the capacity-evaluation basis with the load-formula basis. Findings 7 and 8 (latent HG case divergence; revision-hash/isolation gaps) are recommended hardening and should be addressed in the same pass; findings 2–6, 9–10 are informational.

This review is advisory only. It does not authorize any apply, approval, commit, or mutation, and cannot satisfy a formal prompt/phase review gate (no verifiable reviewer identity was relayed to this lane).