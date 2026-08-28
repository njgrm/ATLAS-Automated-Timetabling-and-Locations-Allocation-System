# Phase Verification Gates

Use this checklist for every implementation batch before marking it accepted.

## 1) Scope Gate
- [ ] Work is within active phase scope in `phasePlan.md`
- [ ] Any cross-phase item has explicit user approval

## 2) Architecture Gate
- [ ] Controllers/routes are transport-only
- [ ] Business logic resides in `/services`
- [ ] Data access and schema changes respect Prisma conventions
- [ ] Endpoints remain versioned under `/api/v1/...`
- [ ] School/year scoping is explicit and validated

## 3) Behavior Gate
- [ ] Acceptance criteria for current feature are testable
- [ ] Error shapes are deterministic and actionable
- [ ] Role and auth constraints are enforced

## 4) Regression Gate
- [ ] Existing high-impact flows still function
- [ ] Route/nav and UX states (idle/loading/empty/error) remain correct
- [ ] Typecheck/build pass for touched app(s)

## 5) Evidence Gate
- [ ] Verification results logged in `docs/verification/evidence-log.md`
- [ ] Blocking issues either fixed or explicitly waived by user

---

## Phase 4 Closure Gates

**Gate 4-Final:** Phase 4 acceptance complete when:
- [ ] All Wave 4.0–4.10 deliverables implemented
- [ ] Manual QA evidence captured (bridge-auth, live Tailnet, timetable, room-request)
- [ ] Refactor roadmap approved and documented
- [ ] Evidence logged in `evidence-log.md` Phase 4 section
- [ ] Phase 5 design can proceed in parallel

---

## Refactor Phase 1a: Database Schema

**Gate 1a-Schema:** All 5 migration tasks complete when:
- [ ] Migration `0024_add_tri_sem_fields.sql` successfully applies on test + staging
- [ ] `Subject.termGroupId` field populated for all existing subjects
- [ ] `Room.buildingZoneId` and `Room.floorNumber` fields exist with data
- [ ] `Faculty.isPlaceholder` boolean flag exists with default false
- [ ] `GeneratedEntry.termIndex` field exists with valid values (1, 2, 3)
- [ ] Typecheck pass in atlas-server: `npx tsc --noEmit`
- [ ] Build pass: `npm run build`

**Acceptance Criteria:**
- ✅ No data loss on existing records
- ✅ New fields properly indexed
- ✅ Foreign key constraints enforced
- ✅ Rollback procedure documented and tested
- ✅ Test data backfill verified

**Evidence Placeholder:** `evidence-log.md` → "Phase 1a: Database Schema"

---

## Refactor Phase 1b: Sync Service Hardening

**Gate 1b-Sync:** Ancillary load enforcement complete when:
- [ ] `AncillaryLoad` table populated on every `POST /sync`
- [ ] `validateAncillaryLoadImmutable()` service blocks mutations on assigned loads
- [ ] Test `blocksAncillaryLoadMutation.test.ts` passes with 100% coverage
- [ ] Integration test with EnrollPro live sync (or mock) passes
- [ ] Faculty sync endpoint `GET /faculty-sync/:schoolYearId` includes ancillary data
- [ ] Documentation updated in `ENROLL_PRO_ATLAS.md` with ancillary contract

**Acceptance Criteria:**
- ✅ No ancillary load override after sync
- ✅ 409 Conflict returned on mutation attempts
- ✅ Sync idempotency maintained
- ✅ HR source data respected without local drift

**Evidence Placeholder:** `evidence-log.md` → "Phase 1b: Sync Service Hardening"

---

## Refactor Phase 1c: API Contract Updates

**Gate 1c-API:** Generation and violation endpoints updated when:
- [ ] `POST /generation/:schoolId/:schoolYearId/runs` response includes termIndex
- [ ] `GET /generation/:schoolId/:schoolYearId/runs/:runId/summary` includes term counts
- [ ] `GET /generation/:schoolId/:schoolYearId/runs/:runId/violations` scoped by termIndex
- [ ] `GET /room-schedules/:schoolId/:schoolYearId/rooms/:roomId` includes termIndex
- [ ] All responses backward-compatible (termIndex optional/nullable for now)
- [ ] API documentation updated: `docs/guides/ATLAS-PUBLIC-API.md`
- [ ] TypeScript types updated in `atlas-client/src/types.ts`

**Acceptance Criteria:**
- ✅ Generation output includes term metadata
- ✅ Violations properly scoped to term context
- ✅ Existing clients unaffected by new fields
- ✅ New clients can safely use termIndex

**Evidence Placeholder:** `evidence-log.md` → "Phase 1c: API Contract Updates"

---

## Refactor Phase 1d: Regression Testing & Acceptance

**Gate 1d-Testing:** All regression and acceptance tests pass when:
- [ ] Unit tests for tri-sem logic: `tri-sem.service.test.ts` (>90% coverage)
- [ ] Unit tests for ancillary validation: `ancillary-load.service.test.ts` (>85% coverage)
- [ ] Integration tests for sync + generation: `wave4-refactor-integration.test.ts` (>80% coverage)
- [ ] Build pass: `npm run build` (atlas-server + atlas-client)
- [ ] Typecheck pass: `npx tsc --noEmit` in both directories
- [ ] No regressions in existing wave 4.0–4.10 test suites
- [ ] Manual QA on generation workflow (generation → publish → published view) with tri-sem data

**Acceptance Criteria:**
- ✅ All hard violations caught
- ✅ Generation respects ancillary deductions
- ✅ termIndex correctly propagated through schedule
- ✅ No data loss or corruption
- ✅ Phase 2 & 3 can proceed safely

**Evidence Placeholder:** `evidence-log.md` → "Phase 1d: Regression Testing & Acceptance"

**Sign-Off:** Phase 1d gates close when all above items have ✅  
**Unblocks:** Phase 5 design finalization, Phase 2 & 3 kickoff

### 2026-05-16 Closure Determination (Refactor Option 1)

- Status: CLOSED (local execution scope)
- Evidence:
	- `docs/verification/evidence-log.md` entry: "Refactor Option 1 Verification Pass (Migration Apply + Regression Re-run)"
	- `docs/verification/evidence-log.md` entry: "Refactor Option 1 Closure Pass (Gate 1d Test Additions + Evidence Finalization)"
- Additional gate tests completed:
	- `atlas-server/src/__tests__/blocksAncillaryLoadMutation.test.ts` (PASS)
	- `atlas-server/src/__tests__/term-scoped-violations.test.ts` (PASS)
- Documented waiver for this closure pass:
	- atlas-client full `tsc --noEmit` has existing unrelated type debt outside Option 1 touched files; treated as non-blocking for Refactor Option 1 closure.

---

## Phase 5: Publish & Dissemination Gates

**Gate 5-Publish (Blocked until Phase 1d):** Ready when:
- [ ] Refactor Phase 1d gates all closed
- [ ] Published schedule APIs return termIndex metadata
- [ ] Faculty and student read-only views updated for tri-sem
- [ ] Evidence logged: `evidence-log.md` → "Phase 5: Publish & Dissemination"

---

**Document Version:** 2.0  
**Last Updated:** 2026-05-15  
**Maintained By:** QA Lead
