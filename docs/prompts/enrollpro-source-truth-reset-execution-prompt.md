# Copilot Execution Prompt: EnrollPro Source-of-Truth Reset + Stale Data Wipe (Faculty/Sections/Loads)

## Goal
Enforce EnrollPro as the single source of truth for faculty and sections by adding deterministic reset/wipe logic that removes stale ATLAS records on sync.

Target outcome:
- No duplicate carry-over from prior imports/seeds.
- Current ATLAS mirror counts match current EnrollPro source snapshot (for current test case: faculty should align to expected 142, not 288).
- Teaching-load and related mappings for removed teachers/sections are automatically cleaned.

---

## Required Files to Read First
- `docs/contracts/enrollpro-atlas.md`
- `phasePlan.md`
- `docs/phases/README.md`
- `docs/verification/phase-gates.md`
- `docs/verification/evidence-log.md`
- `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md` (for output consistency context)
- `atlas-server/src/scripts/seed-realistic.ts`
- `atlas-server/src/services/*faculty*` (all matching sync/services)
- `atlas-server/src/services/*section*` (all matching sync/services)
- `atlas-server/src/services/*assignment*` (for teaching-load cleanup)
- `atlas-server/src/routes/faculty.router.ts`
- `atlas-server/src/routes/sections*.ts` (or equivalent section route files)
- `prisma/schema.prisma`

---

## Non-Negotiable Rules
- EnrollPro data is authoritative; ATLAS mirrors are cache/projection only.
- Sync must support **upsert + delete** semantics (not append-only).
- Removed upstream teachers/sections must cascade cleanup in dependent draft/load mappings.
- No hardcoded school data; always school/schoolYear scoped.

---

## Implementation Requirements

1. **Deterministic Wipe/Prune Strategy**
   - Add targeted wipe mode for:
     - faculty mirror records missing in latest EnrollPro payload
     - section mirror records missing in latest payload
     - dependent teaching-load/assignment rows linked to removed mirrors
   - Keep operation idempotent and safe to rerun.

2. **Sync Contract Hardening**
   - Current sync behavior must produce exact mirror parity for active scope.
   - Add summary output:
     - inserted
     - updated
     - removed
     - skipped
   - Persist diagnostics in logs/audit-friendly format.

3. **Scheduler-Side Reset Entry Points**
   - Provide explicit command/API path for controlled “refresh from EnrollPro” on scheduler workflows.
   - Must include confirmation/protection semantics for destructive prune actions.

4. **Teaching Load Auto-Cleanup**
   - If faculty is removed upstream, linked load rows in ATLAS are removed or invalidated deterministically.
   - If section removed upstream, linked assignment mappings are pruned safely.

5. **Count Validation Gate**
   - Add verification command/test asserting mirror count equals current source count (for fixture: 142).
   - Fail fast on mismatch.

---

## Required Tests

### Unit/Integration
- Sync upsert/remove parity tests for faculty.
- Sync upsert/remove parity tests for sections.
- Dependent load cleanup tests.
- Idempotency test (same upstream payload twice yields zero net delta second run).
- Scope isolation test (school/schoolYear boundaries).

### Command Validation
- Run full sync twice and verify:
  - no duplicate growth
  - expected count parity
  - stale rows removed

---

## Evidence Required
- Update `docs/verification/evidence-log.md` with:
  - exact commands run
  - before/after counts
  - removed row counts by domain
  - pass/fail outcome

---

## GO/NO-GO
- NO-GO if faculty/section counts still drift upward after repeated sync.
- NO-GO if stale teaching-load rows survive removed upstream identities.
- GO only if parity is deterministic and repeatable.

