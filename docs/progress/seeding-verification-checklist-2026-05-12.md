# Seeding Quality Analysis — Verification Checklist & Scripts

**Date:** May 12, 2026  
**Purpose:** Document analysis performed and scripts available for verification

---

## Scripts Created & Run

### 1. **analyze-teaching-loads.cjs**
**Location:** `atlas-server/src/scripts/analyze-teaching-loads.cjs`  
**Purpose:** Show current teaching load distribution and overlaps

**Output (May 12, 2026):**
```
Total FacultySubject assignments: 472

Faculty with overlapping assignments: 0 ✅ (Good)

Teaching load distribution:
- Average subjects per faculty: 3.3
- Min: 1 subject | Max: 10 subjects
- Faculty teaching 0-1 subjects: 58 (40%)
- Faculty teaching 2-3 subjects: 22 (15%)
- Faculty teaching 4+ subjects: 62 (44%)

Class advisers (from EnrollPro): 66 / 145 faculty
```

**Run:** `cd atlas-server && node src/scripts/analyze-teaching-loads.cjs`

---

### 2. **diagnose-faculty-gap.cjs**
**Location:** `atlas-server/src/scripts/diagnose-faculty-gap.cjs` (pre-existing, reused)  
**Purpose:** Identify subjects with low faculty coverage

**Output (May 12, 2026):**
```
Subjects with 1 faculty (minimum cover only):
- ICT, ENVIRONMENTAL_SCIENCE, BIOTECHNOLOGY, MUSIC, VISUAL_ARTS,
- THEATER_ARTS, MEDIA_ARTS, CREATIVE_WRITING, DANCE,
- CONSUMERS_CHEMISTRY, ELECTRONICS_ROBOTICS, RESEARCH_IV

Subjects with adequate faculty (6+):
- MATH: 28 | BASIC/ADVANCED_STATISTICS: 28+ | HG: 69 | ENG: 22 | etc.

All subjects have at least one faculty member ✅
```

**Run:** `cd atlas-server && node src/scripts/diagnose-faculty-gap.cjs`

---

### 3. **audit-specialization-mapping.cjs** *(Created but needs schema validation)*
**Location:** `atlas-server/src/scripts/audit-specialization-mapping.cjs`  
**Purpose:** Verify specialization alias coverage

**Status:** Schema mismatch encountered  
- Current `SpecializationAlias` model has only `canonical` and `alias` fields
- Script tried to access `enrollproSpecializedString` (field doesn't exist)
- Need to verify actual SpecializationAlias table structure

**To Fix:** Check schema in `prisma/schema.prisma` and adjust script accordingly

---

## Verification Steps (User Can Run)

### Step 1: Verify Teaching Load Distribution
```bash
cd d:\ATLAS\atlas-server
node src/scripts/analyze-teaching-loads.cjs
```

**Expected Output:**
- 472 total assignments (or close to it)
- 0 overlapping assignments
- 58+ faculty with 1 subject (minimum cover)
- 66 class advisers

**Validation:** If teaching load aligns with summary above, findings are confirmed.

---

### Step 2: Verify Subject Coverage Gaps
```bash
cd d:\ATLAS\atlas-server
node src/scripts/diagnose-faculty-gap.cjs
```

**Expected Output:**
- 12 subjects with 1 faculty each (arts, advanced electives)
- All other subjects with 6+ faculty
- Confirmation: "All subjects have at least one faculty member"

**Validation:** If gaps match findings, seeding issues confirmed.

---

### Step 3: Verify Class Adviser Count
```powershell
# In any terminal with database access:
psql postgresql://atlas_user:incorrect404@localhost:5432/atlas_db -c \
  "SELECT COUNT(*) as advisers FROM faculty_mirrors WHERE school_id = 1 AND is_class_adviser = true AND is_stale = false AND is_active_for_scheduling = true;"
```

**Expected:** 66 advisers

**Validation:** If count is 66, adviser count confirmed.

---

### Step 4: Verify HG Assignment Mismatch
```powershell
# Check HG faculty count
psql postgresql://atlas_user:incorrect404@localhost:5432/atlas_db -c \
  "SELECT COUNT(DISTINCT faculty_id) as hg_faculty FROM faculty_subjects WHERE school_id = 1 AND subject_id = (SELECT id FROM subjects WHERE school_id = 1 AND code = 'HG');"
```

**Expected:** ~69 (should be ~66, but is higher due to non-adviser assignments)

**Validation:** If count is significantly higher than 66, disconnect confirmed.

---

## Current Seeding Pipeline (For Reference)

The seeding that created the current 472-row state was:

1. **cleanup-bloated.cjs** → Deleted 2,773 bloated rows
2. **auto-assign-subjects.mjs** → Created 142 BEC subject assignments (specialization-matched)
3. **extend-electives.cjs** → Created 318 elective/research/advanced assignments (fallback logic)
4. **minimum-cover.cjs** → Created 12 orphan-subject assignments (one faculty each)

**Result:** 472 total rows (0 + 142 + 318 + 12)

---

## Proposed Seeding Pipeline (Wave 4.6)

Replace with:

1. **adviser-hg-mapper.cjs** → Create ~66 HG assignments linked to advisers
2. **smart-load-seeder.mjs** → Create realistic 120-130 faculty assignments with load balancing
   - Uses expanded specialization mapping (all 34 subjects)
   - Respects 30-40h/week workload range
   - Validates no overlapping assignments
3. **verify-seeding-quality.cjs** → Audit the result
   - Check teaching load distribution
   - Check adviser-HG link
   - Check specialization coverage
   - Confirm 0 overlapping assignments

---

## Key Metrics to Track

### Before (Current State)
| Metric | Value |
|--------|-------|
| Total assignments | 472 |
| Faculty with 1 subject | 58 (40%) |
| Faculty with 4+ subjects | 62 (44%) |
| Subjects with 1 faculty | 12 |
| Class advisers with HG | Unknown (likely <66) |
| Average teaching load | ~3.3 subjects/person |
| Hard violations (Run 14) | 0 ✅ |
| Soft violations (Run 14) | 114 |
| Unassigned sections (Run 13) | 1752 / 2912 (60%) |

### After Wave 4.6 (Target)
| Metric | Target |
|--------|--------|
| Total assignments | 140-180 (realistic) |
| Faculty with 1 subject | <10% |
| Faculty with 4+ subjects | <20% |
| Subjects with 1 faculty | 0 |
| Class advisers with HG | 66 (100% link) |
| Average teaching load | ~2.5-3 subjects/person |
| Hard violations | 0-5 |
| Soft violations | <50 |
| Unassigned sections | <300 / 2912 (10%) |

---

## Questions for Implementation Planning

### Priority 1: Clarify scope
1. **Teaching hours basis:** `subject.minMinutesPerWeek` or derived from section count?
2. **Adviser role:** HG-only or can teach other subjects?
3. **Smart subject mapping:** Auto-enable all specialization subjects or just primary?

### Priority 2: Clarify tolerance
4. **Building seed blocker:** Is it prerequisite or parallel?
5. **Unassigned target:** 0 or acceptable % (5-10%)?

### Priority 3: Implementation sequencing
6. Which task should run first? (Recommend: 4.6.2, then 4.6.3, then 4.6.1)
7. Should we test each task independently or as a pipeline?
8. Target timeline for completion?

---

## Related Documents

- **Full Analysis:** `docs/phases/phase-4-seeding-findings-2026-05-12.md`
- **Summary:** `docs/progress/seeding-quality-findings-summary-2026-05-12.md`
- **Phase Plan Entry:** `docs/phases/phase-4-review.md` → Wave 4.6 section
- **Evidence Log:** `docs/verification/evidence-log.md` (to be updated)

---

## Next Steps

1. **User reviews findings** via scripts above
2. **User clarifies 5 questions** (teaching hours, adviser role, smart mapping, building priority, unassigned tolerance)
3. **Agent plans implementation** based on clarifications
4. **Each task runs independently** with generation test
5. **Acceptance gate passes** when:
   - Target metrics achieved
   - 0 hard violations maintained
   - Unassigned sections reduced
   - No regression on other fronts
