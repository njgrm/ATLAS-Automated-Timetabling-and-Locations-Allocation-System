# ATLAS Seeding & Generation - Findings & Recommendations
**Date:** May 12, 2026 | **Based on:** Run 14 analysis + Run 15 feedback

---

## Executive Summary

The current seeding approach is **too blunt and incomplete**:
1. ✅ Eliminated hard violations (Run 14: 0 violations)
2. ❌ But seeding is non-realistic:   - 58/142 faculty teaching only 1 subject (minimum cover only)
   - 62/142 faculty teaching 4+ subjects (overloaded)
   - No teaching load management (should target 30h/week optimal, max 40h/week)
   - Adviser assignments not automatically mapped to HG
   - Unassigned sections remain high (1752/2912 in Run 13)

3. ❌ Specialization mapping incomplete:
   - Only 61 aliases mapped
   - Doesn't cover updated subject list (advanced/electives/research)
   - Only BEC basic subjects covered initially

4. ❌ Building/room seeding missing:
   - No 20-24 floor per-grade building seed
   - Contributing to unassigned section cascade

---

## CONCERN #1: Teaching Load Management

### Current State
- Min: 1 subject | Max: 10 subjects | Average: 3.3
- 58 faculty at minimum (1 subject)
- 62 faculty overloaded (4+ subjects)
- No hour-based validation

### Problem
- Seeding doesn't reflect realistic workloads
- Algorithm can't optimize because input is garbage
- No front-end control to prevent backend bypass
- Backend blindly accepts all assignments

### Recommendation
**Smart Load-Based Seeding:**
```
For each faculty member:
1. Fetch their specialization → map to teaching subjects
2. Calculate expected hours per subject per grade level
3. Assign subjects until reaching 30-35h/week (optimal zone)
4. Do NOT exceed 40h/week hard limit
5. NEVER assign overlapping sections for same subject in same grade level
6. Auto-assign HG to designated class advisers
```

**Example - Diego Aquino (Math + Statistics)**
- Subject: MATH (5h/week × grades 7-10 = 20h)
- Subject: BASIC_STATISTICS (4h/week × grade 10 = 4h)
- Subject: ADVANCED_STATISTICS (4h/week × grade 10 = 4h)
- **Total: ~28h/week** ✅ (within optimal 30-35h zone)
- HG assignment if `isClassAdviser=true` (+2-3h)

---

## CONCERN #2: Adviser-to-HG Mapping

### Current State
- 66 class advisers from EnrollPro (`isClassAdviser=true`)
- HG has 69 faculty assigned (mostly bloat)
- No relationship between section adviser and HG assignment

### Problem
- HG should NOT be randomly assigned
- Each section should have exactly 1 HG instructor = the section adviser from EnrollPro
- Current approach creates unassigned HG sections

### Recommendation
**Explicit Adviser-HG Mapping:**
```sql
For each Section with adviserId:
1. Find FacultyMirror where id = section.adviserId
2. Create FacultySubject(faculty=adviser, subject=HG, grades=[as per section])
3. Mark assignment as "ADVISER_MANDATORY"
```

This eliminates confusion and ensures every homeroom has exactly 1 instructor.

---

## CONCERN #3: Specialization Mapping Incomplete

### Current Findings
- **Aliases configured:** 61 (only basic BEC subjects)
- **Subjects with 0 aliases:** 12 (CREATIVE_WRITING, DANCE, ICT, MUSIC, etc.)
- **Subjects with 1 alias only:** All specialized/elective subjects

### Problem
- Mapping script runs but doesn't cover extended subject catalog
- Advanced subjects seeded via "minimum cover" hack (1 faculty)
- No smart clustering (ADVANCED_CHEMISTRY, ADVANCED_PHYSICS shouldn't go to same pool as basic CHEM)

### Recommendation
**Expand & Organize Specialization Mapping:**
```
Phase 1: Core BEC (current 61 aliases)
Phase 2: Advanced/Research subjects (map to BEC base)
  - ADVANCED_CHEMISTRY → SCI specialization
  - ADVANCED_PHYSICS → SCI specialization
  - ADVANCED_STATISTICS → MATH specialization
  - RESEARCH_I/II/III → SCI/MATH specialization
Phase 3: Electives (map contextually or randomly)
  - ICT → TLE specialization
  - CREATIVE_WRITING → ENG specialization
  - MEDIA_ARTS → AP or ENG specialization
  - etc.
```

---

## CONCERN #4: UI/UX for Specialization Mapping

### Current State
- Double dropdown: "Add new mapping" container overwhelms users
- EnrollPro term + ATLAS area terminology (too technical)
- Manual "Quick resolve & map orphans" link
- No global save/unsaved changes confirmation

### Problems Identified
1. **Terminology:** "EnrollPro term" and "ATLAS area" aren't user-facing concepts
   - Should be: "Specialization" (left) → "Subjects" (right)
2. **Design:** Dropdown-to-dropdown is abstract
   - Cards with auto-populated specializations would be clearer
3. **Workflow:** No bulk save or unsaved state tracking
   - Users can get confused about what's saved
4. **Missing:** Department grouping (not exposed by EnrollPro yet)
   - When available, auto-group specializations by department

### Recommendation
**Redesign Mapping UI:**
```
OLD (Dropdown → Dropdown):
┌─────────────────────────────────────┐
│ Add New Mapping                     │
│ [Dropdown: Pick Specialization]     │
│ [Dropdown: Pick Subject]            │
│ [Dropdown: Pick Subject]            │
│ [+] [Cancel]                        │
└─────────────────────────────────────┘

NEW (Cards + Auto-Population):
┌─────────────────────────────────────┐
│ Specialization Mappings             │
│ [Global Save] [Undo Changes]        │
├─────────────────────────────────────┤
│ MAJOR IN MATHEMATICS                │  ← From EnrollPro
│ ✓ MATH, ✓ BASIC_STATS,              │  ← Auto-populated subjects
│ ✓ ADVANCED_STATS,                   │  ← Checkboxes
│ ○ RESEARCH_III                      │
├─────────────────────────────────────┤
│ MAJOR IN ENGLISH                    │
│ ✓ ENG, ○ CREATIVE_WRITING,          │
│ ○ MEDIA_ARTS, ○ THEATER_ARTS        │
├─────────────────────────────────────┤
│ [Unsaved changes detected]          │  ← Confirmation on nav away
└─────────────────────────────────────┘
```

**Key improvements:**
- Auto-populate specializations from EnrollPro (not manual)
- Group by department when available (future)
- Checkboxes to select/unselect subjects per specialization
- Global Save button (batch operation)
- Unsaved changes warning before navigation

---

## CONCERN #5: Building & Room Seeding

### Current State
- 20-24 floors per grade level not seeded
- Causing room capacity/availability issues
- Cascading unassigned sections

### Problem
- Generation can't assign because no rooms available
- Unknown current floor/room structure

### Recommendation
**Check & seed building structure:**
1. Audit existing buildings (which grades, how many floors)
2. Seed per-grade floors if missing
3. Add room capacity mapping

---

## CONCERN #6: Unassigned Sections Cascade

### Current Data
- Run 14: 1752 unassigned / 2912 total (60% unassigned)
- Run 13: Same cascade problem
- Root cause: insufficient faculty + room constraints

### Problem
- Hard violations = 0 (good)
- But 60% sections still unassigned (bad for practical scheduling)
- Soft violations don't explain this volume

### Recommendations
1. **Fix teaching load seeding** (smart load distribution)
2. **Ensure room/building data complete**
3. **Validate section->subject-grade mapping** (are all sections valid?)
4. **Check session patterns** (are time slots realistic?)
5. **Consider policy constraints** (are they too strict?)

---

## Summary of Action Items

### High Priority (Blockers for realistic seeding)
- [ ] Implement smart load-based seeding (30-35h optimal, 40h max)
- [ ] Auto-map class advisers to HG assignments
- [ ] Expand specialization mapping to advanced/elective subjects
- [ ] Verify & seed building/room structure

### Medium Priority (UX improvements)
- [ ] Redesign specialization mapping UI (cards + auto-population)
- [ ] Change terminology: "Specialization" + "Subjects" instead of "Term" + "Area"
- [ ] Add global Save button + unsaved changes detection
- [ ] Remove "Quick resolve" (replace with better audit)

### Low Priority (Future)
- [ ] Department-based specialization grouping (when EnrollPro exposes)
- [ ] Hour-based teaching load UI for verification
- [ ] Audit tool for unassigned sections + root cause analysis

---

## Questions for Clarification

1. **Teaching hours calculation:**  
   - Should we use subject.minMinutesPerWeek as the base?
   - Or use section counts (each section = ~2.5-3h/week assuming 50min periods)?

2. **Adviser conflict:**
   - Can a class adviser also teach other subjects?
   - Or should adviser role be dedicated HG-only?
   - If adviser teaches other subjects, how do we balance load?

3. **Specialization mapping scope:**
   - Should we pre-map ALL subjects to at least one specialization?
   - Or allow "unqualified" electives that system auto-assigns?

4. **Room/building data:**
   - Should rooms be per-grade-level or school-wide?
   - Current: 20-24 floors per grade — is this per building or total?

5. **Unassigned section tolerance:**
   - Target: 0 unassigned? Or acceptable % (e.g., 5-10% for constraints)?
