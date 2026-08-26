# ATLAS Run 14-15 Analysis: Seeding Quality Findings & Next Steps
**Date:** May 12, 2026  
**Status:** Discovery Phase — Pending Clarifications Before Implementation

---

## Current State (Verified)

### ✅ What's Working
- **Generation algorithm:** 0 hard violations in Run 14 (confirmed via database)
- **Pre-generation UI:** Wave 4.5c complete with teaching load policy (6h standard, 8h hard block)
- **Faculty authentication:** Standalone ATLAS login operational for 142 active faculty
- **Specialization mapping:** 61 aliases covering basic BEC subjects

### ⚠️ What Needs Attention
1. **Non-realistic teaching loads:** 58 faculty teaching 1 subject (minimum), 62 teaching 4+ (overloaded)
2. **Adviser-HG disconnect:** 66 class advisers not linked to HG assignments
3. **Building/room data gaps:** 20-24 floors per grade not seeded
4. **Unassigned sections:** 60% unassigned (1752/2912) despite 0 hard violations

---

## Root Cause Analysis

### Teaching Load Distribution
```
Current Seeding:
- Average: 3.3 subjects/faculty
- Min: 1 subject | Max: 10 subjects
- 58/142 faculty = 1 subject (minimum cover only)
- 62/142 faculty = 4+ subjects (potentially overloaded)

Realistic Target:
- Most faculty: 2-4 subjects
- 30-40h/week workload range
- 6h/day standard, ≤8h capped
```

**Impact:** Algorithm can't optimize bad input. Wave 4.5's load policy is implemented but seeding doesn't respect it.

### Adviser-HG Missing Link
```
Current State:
- 66 class advisers (isClassAdviser=true from EnrollPro)
- HG has 69 faculty assigned (random allocation)
- No relationship between adviser and HG assignment

Expected Behavior:
- Section → adviser → HG assignment
- 66 HG slots filled deterministically
- Every homeroom has its section's adviser
```

**Impact:** Sections with advisers may have wrong HG instructor, creating unassigned HG cascade.

### Specialization Mapping Incomplete
```
Current Coverage:
- 61 aliases mapped (19 BEC subjects)
- 12 subjects with only 1 faculty (minimum cover hack)
- 15 advanced/elective subjects underrepresented

Missing:
- ADVANCED_CHEMISTRY, ADVANCED_PHYSICS, ADVANCED_STATISTICS
- RESEARCH_I, II, III, IV
- BIOTECHNOLOGY, ENVIRONMENTAL_SCIENCE, ICT, etc.
```

**Impact:** Only minimum viable seeding; no intelligent distribution across advanced curriculum.

---

## Proposed Solution Track: Wave 4.6

### Four Implementation Tasks

#### **Task 4.6.1: Smart Load-Based Seeding** 
**What:** Replace blanket minimum-cover seeding with workload-aware allocation

**How:**
```
For each faculty with specialization:
1. Match specialization → teaching subjects
2. Calculate hours per subject per grade level
3. Assign subjects until 30-35h/week (optimal)
4. Hard-cap at 40h/week
5. Never overlap same subject × same grade for one faculty
6. Auto-assign HG if isClassAdviser=true
```

**Expected Outcome:**
- 120-130 faculty with realistic 2-4 subject loads
- All teaching loads within 30-40h/week
- 50-60 HG assignments (advisers only)
- 0 overlapping assignments

---

#### **Task 4.6.2: Adviser-HG Mapping Service** 
**What:** Link class advisers to HG assignments explicitly

**How:**
```
For each Section with adviserId:
1. Find FacultyMirror where id = section.adviserId
2. Create FacultySubject(faculty=adviser, subject=HG, grades=[section grade])
3. Mark as ADVISER_MANDATORY (for manual-edit guards)
```

**Expected Outcome:**
- 66 HG assignments (one per adviser)
- Every homeroom has exactly one instructor
- No unassigned HG cascade

---

#### **Task 4.6.3: Expand Specialization Mapping** 
**What:** Cover all 34 subjects, not just 19 BEC basics

**Phase breakdown:**
```
Phase 1 (Core BEC):
- Current 61 aliases (FIL, ENG, MATH, SCI, AP, MAPEH, ESP, TLE, HG)

Phase 2 (Advanced):
- ADVANCED_CHEMISTRY → SCI specialization
- ADVANCED_PHYSICS → SCI specialization
- ADVANCED_STATISTICS → MATH specialization
- RESEARCH_I, II, III → SCI/MATH specialization

Phase 3 (Electives):
- ICT → TLE specialization
- CREATIVE_WRITING → ENG specialization
- MEDIA_ARTS → AP or ENG specialization
- MUSIC, DANCE, THEATER_ARTS → AP specialization
- etc.
```

**Expected Outcome:**
- All 34 subjects have ≥1 alias mapping
- No single-faculty minimum-cover hacks
- Better distribution of advanced subjects

---

#### **Task 4.6.4: Backend Teaching Load Validation** 
**What:** Add hard guards to prevent invalid assignments

**Checks:**
```
validateTeachingLoad():
- Daily limit: ≤8h hard block, 6h standard
- Weekly limit: ≤40h hard block
- No overlapping same subject × same grade for one faculty

validateAdviserLoad():
- Class adviser can teach other subjects
- But total load must still respect 40h/week
```

**Where:**
- Pre-generation confirm flow
- Publish workflow validation
- Generation room assignment service

---

#### **Task 4.6.5: Specialization Mapping UI Redesign** 
**Current:** Dropdown-to-dropdown (overwhelming)
**Target:** Cards + auto-population + batch save

```
NEW DESIGN:
┌─────────────────────────────────────────┐
│ Specialization Mappings  [Global Save]  │
│                          [Undo Changes] │
├─────────────────────────────────────────┤
│ MAJOR IN MATHEMATICS                    │ ← From EnrollPro
│ ✓ MATH, ✓ BASIC_STATS, ✓ ADVANCED_STATS│ ← Preset checkboxes
│ ○ RESEARCH_III, ○ RESEARCH_IV           │
├─────────────────────────────────────────┤
│ MAJOR IN ENGLISH                        │
│ ✓ ENG, ○ CREATIVE_WRITING,              │
│ ○ MEDIA_ARTS, ○ THEATER_ARTS            │
└─────────────────────────────────────────┘
[Unsaved changes — confirm before leaving]
```

---

## Before We Start: Required Clarifications

**Question 1: Teaching Hours Calculation**
- Should we use `subject.minMinutesPerWeek` as the workload basis?
- Or derive from section count (e.g., 5 sections × 50min = 250min/week)?
- How should we account for prep time, grading, etc.?

**Question 2: Adviser Scope**
- Can a class adviser also teach other subjects, or is HG-only?
- If can teach other subjects, does their HG role count toward their 40h/week load?
- Should adviser role be protected (cannot change) or mutable (officer can reassign)?

**Question 3: Smart Subject Suggestion**
- When user enables a specialization, should we auto-enable ALL related subjects?
- Or only primary specialization?
- Should department be a filter (if known) or secondary selector?

**Question 4: Building Seed Priority**
- Is building/room seeding a blocker for teaching load fixes?
- Or can they run in parallel?
- Should we audit current building structure first?

**Question 5: Unassigned Tolerance**
- Target: 0 unassigned sections?
- Or acceptable % (5-10% for hard-to-schedule constraints)?
- Should violations take priority over unassigned count?

---

## Affected Components & Risks

### Backend Impact
- **Services:** New smart-seeding service, adviser-HG mapper, teaching load validator
- **Migrations:** Potentially add flags for ADVISER_MANDATORY assignments
- **APIs:** `/api/v1/faculty-subject/*` may need enhanced validation
- **Risk:** Could break existing manual assignments if not careful with backwards compatibility

### Frontend Impact
- **Pages:** `/map/specialization-mapping` (UI redesign)
- **Components:** Specialization mapping interface, teaching load display in pre-gen
- **Risk:** Users may expect old UI behavior

### Generation Impact
- **Service:** `generation.service.ts` and `pre-generation-draft.service.ts` may need updated faculty queries
- **Risk:** Could change violation counts or unassigned distribution significantly

---

## Next Steps (After Clarifications)

1. **User provides answers to 5 questions above**
2. **Implementation order decided:**
   - Task 4.6.2 (Adviser-HG) — fastest, lowest risk, immediate impact
   - Task 4.6.3 (Specialization expand) — prerequisite for 4.6.1
   - Task 4.6.1 (Smart load seeding) — core fix
   - Task 4.6.4 (Backend validation) — gates unsafe assignments
   - Task 4.6.5 (UI redesign) — user-facing polish
3. **Each task runs independently → generation test → acceptance gate**

---

## Implementation Plan Drafted

The execution plan now lives in `docs/phases/wave-4-6-execution-plan-2026-05-12.md`.

### Plan Focus
- Use EnrollPro-fetched faculty mirrors and snapshots as the source of truth for teaching-load seeding.
- Expand specialization mapping until every active subject has at least one mapped specialization.
- Seed teaching load toward 120-130 faculty with realistic 2-4 subject loads and 30-40h/week caps.
- Auto-map advisers to HG assignments and preserve other adviser teaching assignments when capacity allows.
- Verify the realistic campus seed covers all sessions before retrying generation.
- Rerun generation and log any stubborn unassigned classes by root cause if the target still fails.

---

## Supporting Documentation

- **Full findings:** `docs/phases/phase-4-seeding-findings-2026-05-12.md`
- **Phase plan entry:** `docs/phases/phase-4-review.md` → Wave 4.6 section
- **Analysis scripts:**
  - `analyze-teaching-loads.cjs` — Shows current load distribution
  - `diagnose-faculty-gap.cjs` — Identifies subjects with low faculty coverage
  - `audit-specialization-mapping.cjs` — Checks mapping completeness
