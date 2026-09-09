# Whole-Candidate Advisory Review — TL-C02R (Teaching Load Reconciliation correction)

- **Reviewer identity:** `REVIEWER_D_WHOLE_ADVISORY` (no execution-system context handle exposed by the harness to this reviewer; independent of the implementation executor and of advisory reviewers A/B/C).
- **Artifact role:** Fresh whole-candidate advisory review of the committed candidate **plus** the uncommitted TL-C02R corrections. Advisory evidence only; not formal planner/QA acceptance, no GO, no unlock authority.
- **Reviewed diff identity:**
  - Committed candidate: `3d210335c8eee7f39efbfbf21d326649289bee34` (`feat(teaching-load): reconcile active-year load against curriculum demand`), parent/base `330fb91b7daa28299520272b1e258cc49395af04`.
  - Uncommitted TL-C02R corrections (working tree vs `3d210335`): 5 modified files — `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`, `atlas-server/src/services/qualification-evaluator.service.ts`, `atlas-server/src/services/teaching-load-cycle.service.ts`, `atlas-server/src/services/teaching-load-reconciliation.service.ts`, `docs/progress/teaching-load-tlc02-one-shot-2026-09-09-progress.md`.
  - Worktree: `D:\ATLAS-worktrees\teaching-load-tlc02`, branch `work/teaching-load-tlc02`. Two untracked files present (`faculty-assignment-pass5-regression.test.ts`, `workload-policy.test.ts`) — verified they are pre-existing shared suites that also exist in `D:\ATLAS` main and are not part of this candidate's diff; both pass (54/54, 8/8).
- **Files inspected (production path):** `teaching-load-reconciliation.service.ts` (full, 1967 lines), `qualification-evaluator.service.ts` (full), `teaching-load-cycle.service.ts` (full), `faculty-assignment.service.ts` (changed hunks + `computeTeachingLoadMinutes`/`resolveQualificationTierForManual`), `faculty-assignment.router.ts` (reconciliation routes + auth), `subject-ownership.service.ts` (`matchesSubjectOwnershipDepartment`), `department-authority.service.ts` (`buildDepartmentAuthoritySourceRevision`), `scheduling-policy.service.ts` (`resolveEffectiveWorkloadPolicy`); client: `TeachingLoadReconciliationPanel.tsx`, `TeachingLoad.tsx` diff, `teaching-load-reconciliation-helpers.ts`, `types.ts` diff, `__tests__/teaching-load-reconciliation-ui.test.ts`; evidence: tlc02r JSON + `.sha256`, old artifact `.NON_APPLICABLE`, progress ledger.

## Commands independently rerun (read-only)

| Command | Result |
|---|---|
| `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` (server) | **129 passed, 0 failed** |
| `npx tsc --noEmit` (atlas-server) | exit 0 |
| `npx tsc --noEmit` (atlas-client) | exit 0 |
| `npx tsx --test src/lib/__tests__/teaching-load-reconciliation-ui.test.ts` (client) | **5 pass, 0 fail** |
| `npx tsx src/__tests__/workload-policy.test.ts` (untracked, context) | 8 passed |
| `npx tsx src/__tests__/faculty-assignment-pass5-regression.test.ts` (untracked, context) | 54 passed |
| `Get-FileHash -Algorithm SHA256` tlc02r JSON | `70FEC771D162181E28358967454AA6C483E51BAC21D3185DF918D154E21315FC` — byte-identical to sidecar |
| JSON parse of tlc02r artifact | `applied=false`; `zeroWriteProof {preview=true, writes=0}`; fingerprint `0563926BCF59E3CFF04AF51F8887FD2B99BBCD8C448D9F97D7419D5263FCCFDB`; plan RETAIN 234 / INSERT 0 / MOVE 30 / RETIRE 1 / UNRESOLVED 0; `234+0+30+0=264=demandCount`; 265 actions with 265 unique pair keys; cycle POPULATED v4; advisers 20/20; hg 0 |
| Old artifact `.NON_APPLICABLE` marker | Present; names fingerprint `D5A200C220297A8FAD053823CF7062091FE8CB0435A4868A54260ADE030B7959`, which byte-matches the old artifact's `source.fingerprint` |

## Verification matrix (prompt items 1–9)

1. **Final-action model — PASS.** `buildReconciliationPlan` keeps `actionsByPair` and `putAction` REPLACES a pair's action (`teaching-load-reconciliation.service.ts:747-749`); step-2 fill skips pairs already assigned (`:872`); rebalance (`:986-1011`) and adviser-transfer (`:1052-1075`) `unassign` + re-register + `putAction`, so RETAIN→MOVE replacement, never append. Invariant `RETAIN+INSERT+MOVE+UNRESOLVED === demandCount` holds in code, A11 (unique final actions + invariant + `owned<=demand`), B7 readiness, and on the live artifact (234+0+30+0=264; owned 264<=264; the single RETIRE is a non-demand row).
2. **Transaction closure — PASS.** Apply path: the only global-db call is the `db().$transaction(...)` entry (`:1849`); inside, `readReconciliationSourceSnapshot(schoolId, schoolYearId, tx)` (`:1850`) routes every read (offerings, sections, cohorts, subjects, faculty, facultySubjects, ownership, specializationAliases, crossDepartmentPermissions, departmentAlias/Label, subjectOwnerPrefix, schedulingPolicy, cycle) through `tx` (`:1319-1341`); `buildDepartmentAuthoritySourceRevision` is pure (hashes caller-supplied rows, `department-authority.service.ts:175-199`); `buildQualificationResolver` builds a persisted-only policy snapshot and calls the pure `evaluateQualificationWithPolicy` (no DB, `:596-653`); `executePlanInTransaction` uses only `tx.*` including `refreshTeachingLoadCycle(..., tx)` (`:1809`). `computeTeachingLoadMinutes`/`computeTeachingLoadMinuteComputation` (`faculty-assignment.service.ts:642-795`) and `resolveEffectiveWorkloadPolicy` (`scheduling-policy.service.ts:904-920`) are pure. B9 negative controls prove policy and department-label mutation after preview → 409 SOURCE_DRIFT with zero writes.
3. **Atomic derived state — PASS.** Cycle refresh inside the Serializable tx (`:1806-1810`); B10 injected failure leaves ownership count unchanged, cycle version unchanged, and adds no audit row (test output confirmed). Replay zero-write (B6).
4. **Canonical qualification — PASS.** Resolver routes through `evaluateQualificationWithPolicy` with a persisted-only snapshot (`persistedOnly: true`, `legacyCrossLanguageException: false`); `normalizeDepartmentCode` short-circuits before legacy tables in persisted-only mode (`qualification-evaluator.service.ts:184-187`); no name/prefix/glossary inference. Additive `DEPARTMENT_MATCH` tier (`:400-405`) sets `tier=2` on dept equality and mirrors production `matchesSubjectOwnershipDepartment` for the persisted-`ownerDepartment` primary gate (the resolver supplies `subjectAllowedDepartments = [ownerDepartment]`). Differential A13 asserts resolver eligibility+tier equal the canonical evaluator for department, specialization alias, cross-dept permission, program mismatch, inactive/stale faculty, canTeachOutsideDepartment.
5. **Adviser-own-section — FAIL (material defect, see D-1).** One grant per section (persistent `adviserPreferenceGrantedBySection` map through fill/rebalance/transfer), no duplicate action (REPLACE), truthful typed unsatisfied reasons (`ADVISER_NOT_QUALIFIED_FOR_DEMANDED_SUBJECTS` / `HARD_CAP_CONFLICT_OR_NO_SAFE_TRANSFER`) all hold. But the hard-cap gate for the transfer uses offering minutes, not the credited minutes, and a real probe produced an over-cap adviser.
6. **Cycle truth — PASS.** `cycleImpact.stateBefore` derives from `readTeachingLoadCycleSource` through the caller's client (`:1340`, `teaching-load-cycle.service.ts:71-116`) mapping UNCONFIGURED→MISSING, mismatch diagnostic→MISMATCH, else persisted state; B2b proves MISSING/MISMATCH/POPULATED; live artifact shows real POPULATED v4.
7. **Fingerprint/source revision + drift — PASS.** Source revision binds termConfig, offerings (incl. per-offering term assignments), sections, cohorts, subjects, faculty, facultySubjects, ownership, crossDepartmentPermissions, specializationAliases, subjectOwnerPrefixes, departmentRevision, workloadPolicy (`:1191-1285`). In-tx recompute + 409 SOURCE_DRIFT / FINGERPRINT_MISMATCH with zero writes (B4 forged fingerprint, offering drift; B9 policy and department-label drift). Recompute uses the tx-read snapshot.
8. **HG exclusion — PASS (reconciliation path), coverage note (consumer path).** HG never enters demand (`:376`), HG ownership → RETIRE + `HG_FORBIDDEN` + `hgRowsFound` (`:449-451, 817-819`); A3 asserts. Consumer contract filter `loadHgSubjectIds` + `getAssignmentSummary` HG filter implemented (`faculty-assignment.service.ts:1291-1303, 5153-5159`). No dedicated negative test asserts HG absence from the summary/effective output (informational I-4).
9. **Live preview artifact — PASS.** Byte SHA-256 recompute matches sidecar; `applied:false`; old artifact NON_APPLICABLE marker matches old fingerprint; new fingerprint recorded unapplied in ledger + approval sentence.

## Findings

### Product / runtime defects (required fixes)

- **D-1 (HIGH, required):** Adviser-own-section transfer hard-cap gate uses the wrong minutes.
  - Evidence: `atlas-server/src/services/teaching-load-reconciliation.service.ts:1045` —
    `if (adviserMinutes + pair.weeklyMinutes > hardCap) continue;`
    whereas the load simulation (`computeTeachingLoadMinutes`) credits `subject.minMinutesPerWeek`, and the pass's own comment (`:1017-1019`) claims "hard-cap safe; never over the cap".
  - Inconsistent with the two sibling gates that were already fixed to use the credited minutes: fill `pickCandidate` `:694` (`gateMinutes = subject.minMinutesPerWeek`, per A1/A10) and rebalance `:979` (`pair.subject.minMinutesPerWeek`).
  - Adversarial probe (hermetic `buildReconciliationPlan`, section-scoped offerings): subject B `minMinutesPerWeek=240` with offering `weeklyMinutes=120`; adviser already at 60 credited minutes; hardCap 240. Transfer gate passes (60+120=180 ≤ 240), transfer granted, plan reports adviser `afterMinutes=300`, `afterStatus=over-cap` (hard cap 240). The MOVE action is exactly what `executePlanInTransaction` writes without any runtime cap re-check (`:1761-1778`), so the applied state would persist an over-cap faculty — violating the "zero hard-constraint violation" contract and the "hard-cap safe" guarantee.
  - Required fix: gate on the credited minutes (`subject.minMinutesPerWeek`, mirroring `pickCandidate`'s `gateMinutes`), and add a negative fixture (offering minutes < credited minutes) asserting the transfer is refused and the adviser never exceeds the hard cap.
  - Existing tests do not cover this: A12 uses offering minutes == subject minutes (240); A10 covers only `pickCandidate`.

### Process / documentation (informational)

- **I-1:** `docs/progress/teaching-load-tlc02-one-shot-2026-09-09-progress.md:73` residual-risk bullet still claims "cycleImpact.stateBefore is reported from the census, not a live cycle read", which is stale after R6 (now a real cycle read; B2b).
- **I-2:** Progress ledger contains corrupted characters (`�`, and `?` where an arrow was intended) at `:81, :85, :101, :103, :108` — encoding mangling; cosmetic.
- **I-3:** `atlas-client/src/types.ts` `cycleImpact` type omits the server's `cycleVersion` field (subset typing; benign at runtime, excess property is ignored). Consider aligning the type.
- **I-4:** No dedicated negative test asserts HG rows are excluded from `getAssignmentSummary`/effective contract output (the reconciliation-path HG tests are strong; the consumer-path filter added in `faculty-assignment.service.ts:5153-5159` is implemented but untested directly).

## Verdict

**`zeroFix: false`**

Required fix **D-1** (hard-cap safety in the adviser-own-section transfer gate, `teaching-load-reconciliation.service.ts:1045`) must be corrected and covered by a negative fixture before this candidate is acceptable. All other verification items pass with the evidence recorded above. No source files were modified by this review; the scratch adversarial probe used to confirm D-1 was created in `atlas-server/scratch-adversarial-probe.ts`, run, and deleted — `git status --short` after cleanup matches the pre-review state exactly.