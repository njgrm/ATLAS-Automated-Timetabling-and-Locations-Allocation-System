# Wave 4.6 Implementation Plan — Smart Load Seeding & Adviser-HG Mapping
**Date:** May 12, 2026  
**User Clarifications Incorporated**

---

## Implementation Overview

Based on user clarifications:

1. **Teaching load calculation:** Derive from toggled session × subject.minMinutesPerWeek
2. **Adviser role:** Can teach other subjects; MUST be auto-mapped to HG for their advisory section
3. **Smart subject suggestion UI:** Remove (not needed, already explicit in specialization mapping)
4. **Building seed:** Already exists in `seed-realistic.ts` with grade-level buildings (20-24 rooms)
5. **Unassigned target:** 0 unassigned sections; log all struggles and lessons learned

---

## Tasks & Execution Sequence

### Phase A: Foundation & Validation (Week 1)

#### **Task 4.6.A1: Run Existing Building Seed**
**Purpose:** Ensure campus map has all necessary buildings and rooms

**Command:**
```bash
cd d:\ATLAS
npx tsx atlas-server/src/scripts/seed-realistic.ts \
  --schoolId=1 \
  --schoolYearId=1 \
  --seedMap=true \
  --resetMap=false
```

**Expected Output:**
- Grade 7 Academic Wing: 20 rooms (5 × 4 floors)
- Grade 8 Academic Wing: 24 rooms (6 × 4 floors)
- Grade 9 Academic Wing: 20 rooms (5 × 4 floors)
- Grade 10 Academic Wing: 20 rooms (5 × 4 floors)
- Science, MAPEH, TLE, Admin buildings with specialized rooms

**Verification:**
```bash
cd atlas-server
node src/scripts/diagnose-faculty-gap.cjs  # Should show room info
```

---

#### **Task 4.6.A2: Verify Specialization Aliases**
**Purpose:** Ensure all 34 subjects have at least one alias mapped

**Command:**
```bash
cd atlas-server
# Create audit script to verify mapping completeness
npm run test:specialization-coverage 2>/dev/null || echo "No test yet"
```

**Expected:** All 34 subjects have ≥1 specialization alias

**If missing:** Create helper script to add missing aliases programmatically

---

### Phase B: Core Seeding Fixes (Week 2)

#### **Task 4.6.B1: Smart Load-Based Seeding Service**
**Location:** `atlas-server/src/services/smart-load-seeding.service.ts` (NEW)

**Purpose:** Replace `extend-electives.cjs` + `minimum-cover.cjs` with intelligent allocation

**Logic:**
```typescript
For each active non-stale faculty:
1. Get specialization → map to subject via SpecializationAlias
2. For each mapped subject:
   a. Fetch section ids where subject is taught
   b. For each section: Calculate session duration from schedule
   c. Calculate total minutes: subject.minMinutesPerWeek × section count
   d. Track cumulative load per faculty
3. Assign subjects until reaching 1800-2100 min/week (30-35 hours)
   - Hard cap at 2400 min/week (40 hours)
4. Auto-assign HG if faculty.isClassAdviser=true for their section
5. Validate: no overlapping same-subject-same-grade assignments
```

**Implementation Steps:**
1. Create the service file with functions:
   - `calculateSubjectLoadMinutes(section, subject)` — mins per week × section
   - `getAllAssignmentsForFaculty(facultyId)` — fetch current assignments
   - `getOptimalSubjectSet(faculty, specializations)` — greedy load balancer
   - `seedSmartLoadAllFaculty()` — main pipeline

2. Create the CLI script: `seed-smart-load-based.mjs`

3. Call from main seeding pipeline

---

#### **Task 4.6.B2: Adviser-HG Mapping Service**
**Location:** `atlas-server/src/services/adviser-hg-mapping.service.ts` (NEW)

**Purpose:** Link class advisers to HG assignments based on section adviser field

**Logic:**
```typescript
For each Section with adviserId:
1. Find FacultyMirror where id = section.adviserId
2. Create FacultySubject:
   - facultyId: adviser.id
   - subjectId: HG subject id
   - gradeLevels: [section's grade level]
   - sectionIds: [section.id]
   - isAdviserMandatory: true (flag for guards)
3. Check for duplicate: if (facultyId, subjectId, section.id) exists, skip
4. Validate section adviser is active and not stale
```

**Implementation Steps:**
1. Create the service file with functions:
   - `mapAdviserToHG(section)` — single adviser→HG mapping
   - `mapAllAdvisersToHG()` — batch process all sections

2. Create the CLI script: `seed-adviser-hg-mapping.mjs`

3. Call from main seeding pipeline after smart load seeding

---

#### **Task 4.6.B3: Clean-Up Before Reseeding**
**Purpose:** Clear existing assignments to start fresh

**Command in scripts:**
```javascript
// Before running smart seed:
await prisma.facultySubject.deleteMany({
  where: { schoolId: 1 }
});
console.log("Cleared all FacultySubject assignments");
```

---

### Phase C: Validation & Guards (Week 3)

#### **Task 4.6.C1: Backend Teaching Load Validation Service**
**Location:** `atlas-server/src/services/teaching-load-validation.service.ts` (NEW)

**Purpose:** Add hard guards to prevent invalid assignments during generation & manual edits

**Functions:**
```typescript
validateTeachingLoad(facultyId, proposedAddition):
- Calculate daily minutes for each day
- Hard block: > 480 min (8 hours)
- Soft warning: > 360 min (6 hours)

validateNoOverlapForSubject(facultyId, subjectId):
- Check same faculty × same subject × overlapping sections
- Hard block if found

validateMaxWeeklyLoad(facultyId):
- Sum all weekly minutes
- Hard block: > 2400 min (40 hours)
- Soft warning: > 2100 min (35 hours)

validateAdviserCanTeach(facultyId, subjectId):
- If adviserId exists, ensure HG assignments are fixed
- Can teach other subjects freely
```

**Integration Points:**
- `generation.service.ts` → validate before assigning sessions
- `pre-generation-draft.service.ts` → block commits if limits exceeded
- `faculty-assignment.router.ts` → validate on manual edits

---

### Phase D: Testing & Verification (Week 4)

#### **Task 4.6.D1: Run Full Seeding Pipeline**
**Sequence:**
```bash
# 1. Build seed (if needed)
npx tsx atlas-server/src/scripts/seed-realistic.ts \
  --schoolId=1 --schoolYearId=1 --seedMap=true --resetMap=false

# 2. Clear old assignments
cd atlas-server && node src/scripts/cleanup-bloated.cjs

# 3. Auto-assign from specialization (base BEC)
node src/scripts/auto-assign-subjects.mjs

# 4. Smart load-based seeding (NEW)
npx tsx src/scripts/seed-smart-load-based.mjs

# 5. Adviser-HG mapping (NEW)
node src/scripts/seed-adviser-hg-mapping.mjs

# 6. Analyze result
node src/scripts/analyze-teaching-loads.cjs
node src/scripts/diagnose-faculty-gap.cjs
```

**Expected Output After Task 4.6.D1:**
- 140-180 total assignments (realistic range)
- <10% faculty with 1 subject
- <20% faculty with 4+ subjects
- 0 overlapping assignments
- 66 HG assignments (one per adviser)
- All 34 subjects have ≥1 faculty

---

#### **Task 4.6.D2: Trigger Generation Test**
**Purpose:** Verify new seeding produces acceptable violations

**Command:**
```bash
# Via API or manual UI:
POST /api/v1/generation/1/1/runs
```

**Target Metrics:**
- Hard violations: ≤ 10 (vs. current 0)
- Soft violations: < 100 (vs. current 114)
- Unassigned sections: < 300 (vs. current 1752, target 0)

**If regression detected:**
- Log findings to `docs/progress/wave4-6-struggles.md`
- Adjust teaching load thresholds or validation logic
- Re-run generation

---

#### **Task 4.6.D3: Document Struggles & Lessons Learned**
**Output File:** `docs/progress/wave4-6-struggles-and-lessons.md`

**Document:**
- What worked well
- What didn't work / why
- Root causes of unassigned sections (if any)
- Adjustments made mid-implementation
- Performance impact on generation time
- Recommended next steps

---

## Implementation Checklist

### Before Starting
- [ ] User clarifications incorporated (all 5 questions answered)
- [ ] Building seed script located and tested
- [ ] Specialization aliases complete (34/34 subjects mapped)
- [ ] Database backed up

### Core Implementation
- [ ] Task 4.6.B1: Smart load-based seeding service created
- [ ] Task 4.6.B2: Adviser-HG mapping service created
- [ ] Task 4.6.C1: Teaching load validation service created
- [ ] All scripts compile and run without errors
- [ ] All scripts have logging for troubleshooting

### Testing & Verification
- [ ] Task 4.6.A1: Building seed verified (5 buildings + 84 rooms)
- [ ] Task 4.6.D1: Full pipeline runs end-to-end
- [ ] Task 4.6.D2: Generation test produces acceptable results
- [ ] Task 4.6.D3: Struggles and lessons documented
- [ ] Metrics meet targets (see Phase D)

### Exit Criteria Met?
- [ ] Teaching load distribution realistic (2-4 subjects per faculty)
- [ ] Adviser-HG link 100% (66/66 advisers mapped)
- [ ] Unassigned sections < 300 (target 0)
- [ ] No regressions on hard violations
- [ ] All integration points (generation, pre-gen, manual edits) validated

---

## Risk Mitigation

### Risk 1: Unassigned Sections Remain High
**Mitigation:**
- Check section-grade mapping validity
- Verify room availability per grade level
- Check policy constraints aren't too strict
- Log to struggles document

### Risk 2: Teaching Load Exceeds Limits
**Mitigation:**
- Verify subject.minMinutesPerWeek is accurate
- Double-check session count calculation
- Lower optimal load from 35h to 32h if needed
- Add faculty "exemption" flag for overload allowance

### Risk 3: Adviser Assignments Conflict with Subject Assignments
**Mitigation:**
- Run adviser mapping AFTER smart load seeding
- Check for duplicate assignments before creating
- Document any conflicts in struggles file

### Risk 4: Specialization Mapping Incomplete
**Mitigation:**
- Pre-audit before starting (Task 4.6.A2)
- Create helper script to batch-add missing aliases
- Fall back to "minimum cover" for truly unmapped subjects

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Hard violations | 0-5 | 0 (Run 14) | ✅ Maintain |
| Total assignments | 140-180 | 472 | 🔄 Reduce |
| Faculty with 1 subject | <10% | 40% | 🔄 Fix |
| Faculty with 4+ subjects | <20% | 44% | 🔄 Fix |
| Adviser-HG link | 100% | <50% | 🔄 Fix |
| Unassigned sections | <300 | 1752 | 🔄 Critical |
| Generation time | <60s | ~100ms | ✅ Maintain |

---

## Next Steps

1. **User reviews this plan** ✅
2. **Agent implements Task 4.6.B1 (Smart Load Service)** 
3. **Agent implements Task 4.6.B2 (Adviser-HG Service)**
4. **Agent implements Task 4.6.C1 (Validation Guards)**
5. **Execute Phase D testing & logging**
6. **Review results and document findings**
