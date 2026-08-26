# Phase 2: Home-Room Algorithm — Validation & Behavior Guide
**Purpose:** Document the exact user-facing behaviors and validation workflows for Phase 2 implementation  
**Date:** 2026-05-16  
**Audience:** Scheduler Officers, QA Auditors, Stakeholder Validators

---

## 1. Pre-Generation Configuration (UI Update)

### What You'll See
When a scheduler officer navigates to `/timetable` and clicks **Generate Schedule**, a new modal section will appear:

```
┌─────────────────────────────────────────┐
│ Schedule Generation Configuration        │
├─────────────────────────────────────────┤
│                                         │
│ Rooming Strategy:                       │
│                                         │
│ ○ Universal Room Search                 │
│   (Legacy: every section searches for  │
│    compatible rooms; slower but more    │
│    flexible)                            │
│                                         │
│ ● Home-Room First (NEW)                 │
│   (Sections use assigned home rooms;   │
│    only unassigned/special sections    │
│    enter general solving)               │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Advanced Options:                       │
│ ☑ Balance Section Distribution by Zone │
│ ☑ Enforce Shift Windows                │ ← MANDATORY (DepEd Compliance)
│   Grade 7/8: MORNING only (from Shift Settings)│
│   Grade 9/10: AFTERNOON only (from Shift Settings)│
│   STE: OVERLAP (allowed in both)        │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│         [Cancel]  [Generate]            │
│                                         │
└─────────────────────────────────────────┘
```

### How You'll Use It
1. **Typical Case (New Default):** Leave "Home-Room First" selected, toggle "Balance by Zone" ON
2. **Testing Universal Behavior:** Click "Universal Room Search" to run comparison (backward compat test)
3. **Click Generate:** System will begin generation run

### What This Means
- **Selecting HOME_ROOM_FIRST** tells the system: "Respect section home-room assignments from EnrollPro. Only resolve unassigned or special-requirement sections."
- **Balancing by Zone** adds a soft constraint: "Spread sections across building zones evenly (warn if >50% in one zone)"
- **Enforcing Shift Windows** is MANDATORY: "Use active Grade Shift Window settings (admin-configurable) to lock each grade/program to valid time bounds. Reject any schedule that violates these bounds (hard constraint under DepEd law)."

---

## 2. Generation Run (Process Changes)

### What's Happening Behind the Scenes

#### Before (UNIVERSAL mode — unchanged for backward compat):
```
Input: 500 sections, no home room guidance
↓
Genetic Algorithm: Try to assign each of 500 sections to 150 available rooms
↓
Constraint check: Capacity, features, time conflicts
↓
Output: After 55–70 seconds, schedule with ~95% sections assigned
```

#### New (HOME_ROOM_FIRST mode):
```
Input: 500 sections, 380 have homeRoomId pre-assigned
↓
Phase A (Home-Room Batch): Lock 380 sections to their home rooms
  - Check: Room capacity, features, time conflicts
  - Result: 340 sections locked (~90% of 380)
  - Moved to fallback: 40 sections (room conflict or unavailable)
↓
Phase B (Singletons): Assign lab/gym sections to specialized rooms
  - Result: 30 specialized sections assigned
  - Unresolved: 5 sections (lab fully booked)
↓
Phase C (General Pool, Reduced): GA solves remaining 135 sections
  - Faster: Only 135 variables vs 500 (73% reduction in complexity)
  - Result: 130 sections assigned; 5 unassigned (conflicts)
↓
Phase D (Zone Balancing): Verify distribution
  - NORTH: 42%, SOUTH: 38%, EAST: 20% ✓ (within 5%)
↓
Output: After 32–38 seconds, schedule with 99%+ sections assigned
```

### User Impact
- **Faster:** Generation completes ~30–40% faster (32–38s vs 55–70s)
- **More Stable:** Sections keep their home rooms; fewer surprise room changes
- **Transparent:** Metrics show exactly what happened (breakdown of assignment sources)

---

## 3. Generation Complete — Review Panel (New Output Fields)

### Review Panel — Metrics Card

After generation completes, the **Review Panel** (middle of three-panel workspace) shows a new **Rooming Metrics** card:

```
┌─────────────────────────────────────────────────────────────────┐
│ Generation Complete: run-2026-05-16-00142                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Status:  ✓ SUCCESS                                              │
│ Strategy: Home-Room First (NEW)                                 │
│ Time:    38.2 seconds                                           │
│                                                                 │
│ ─────── Rooming Metrics ───────                                 │
│                                                                 │
│ Home-Room Success Rate: 72%                                     │
│ [████████████░░░] 340 / 380 sections assigned to home room      │
│ • 340 sections locked to home room ✓                            │
│ • 40 sections home room unavailable (moved to pool)             │
│                                                                 │
│ Zone Distribution (Term 1):                                     │
│ ■ NORTH:  42% [████████░] (165 sections)                        │
│ ■ SOUTH:  38% [███████░░] (149 sections)                        │
│ ■ EAST:   20% [███░░░░░░] (78 sections)                         │
│ Imbalance: 22% (within acceptable range ✓)                      │
│                                                                 │
│ Room Churn (Sections changing rooms across terms):              │
│ Average: 8% (32 sections, acceptable)                           │
│                                                                 │
│ ─────── Violations Summary ───────                              │
│ Hard Violations: 3                                              │
│ • 2 unassigned sections (no compatible room found)              │
│ • 1 DepEd DO 005 violation (teacher over 2,400-min hard cap)    │
│                                                                 │
│ Soft Warnings: 5                                                │
│ • 3 sections: home room moved to fallback                       │
│ • 2 sections: zone imbalance (moved to under-loaded zone)       │
│                                                                 │
│ ─────── Confidence ───────                                      │
│ Ready to Publish: NO                                            │
│ (Hard violations must be 0 before publish)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### What Each Metric Means

| Metric | What It Measures | Green Zone | Yellow Zone | Red Zone |
|--------|-----------------|-----------|-----------|----------|
| **Home-Room Success Rate** | % sections with homeRoomId that got their home room | 70–85% | 50–69% | <50% |
| **Zone Distribution** | How evenly sections spread across buildings | <10% imbalance | 10–20% | >20% |
| **Room Churn** | How many sections change rooms across terms | <10% | 10–15% | >15% |
| **Generation Time** | Total time to generate (Phase 2 goal) | <40s | 40–55s | >55s |
| **Shift Window Compliance** | % sections in correct shift (Grade 7/8→MORNING, Grade 9/10→AFTERNOON) | 100% | 95–99% | <95% (ILLEGAL) |
| **DepEd DO 005 Workload** | Teachers exceeding 2,400-min hard cap | 0 | N/A | >0 (HARD VIOLATION) |
| **Shared Facility Safety** | Double-bookings on gym/lab/kitchen (isSharedFacility=true rooms) | 0 | N/A | >0 (HARD VIOLATION) |

---

## 4. Violations Panel — New "Room Assignment Reason" Field

### Violations Tab Details

When you scroll through the **Violations** panel, each entry now shows WHY its room was assigned:

#### Example Violation Entry (Hard — Unassigned):
```
┌───────────────────────────────────────────────┐
│ ✗ HARD: Unassigned Section                    │
├───────────────────────────────────────────────┤
│ Section: Grade 7 – Mathematics                │
│ Term: 1                                       │
│ Time: MWF 08:00–09:00                         │
│                                               │
│ Issue: No compatible room found               │
│ • Home room (ID 45) occupied by other section │
│ • No alternative lab/standard room available  │
│ • Suggested action: Adjust section time slot  │
│   or request manual room override             │
│                                               │
│ Room Assignment Reason: FALLBACK_UNRESOLVED   │
│ [icon] Tooltip: "Section had no available    │
│        room after all phases"                 │
└───────────────────────────────────────────────┘
```

#### Example Violation Entry (Soft — Home Room Moved):
```
┌───────────────────────────────────────────────┐
│ ⚠ SOFT: Home Room Unavailable                 │
├───────────────────────────────────────────────┤
│ Section: Grade 8 – Science                    │
│ Term: 1                                       │
│ Time: TTH 10:00–11:30                         │
│ Assigned Room: 67 (SOUTH zone)                │
│                                               │
│ Issue: Home room (ID 46) occupied by          │
│ conflicting schedule; assigned alternative    │
│ in same zone                                  │
│                                               │
│ Home Room Reason: HOME_ROOM_UNAVAILABLE       │
│ [icon] Tooltip: "Original home room (46) had  │
│        conflict; moved to alternate (67)"     │
│                                               │
│ [Revert] [Accept] [Lock Override]             │
└───────────────────────────────────────────────┘
```

#### Example Success Entry (Soft Warning — Zone Imbalance):
```
┌───────────────────────────────────────────────┐
│ ✓ ASSIGNED (Soft Warning)                     │
├───────────────────────────────────────────────┤
│ Section: Grade 9 – English                    │
│ Term: 1                                       │
│ Time: MWF 14:00–15:00                         │
│ Assigned Room: 89 (EAST zone)                 │
│                                               │
│ Note: Zone normally lighter; section moved    │
│ here to balance NORTH zone overcrowding       │
│ (NORTH was at 45%, moved to 42%)              │
│                                               │
│ Room Assignment Reason: ZONE_BALANCED         │
│ [icon] Tooltip: "Assigned to balance zone     │
│        distribution while respecting home     │
│        room constraints"                      │
│                                               │
│ Status: OK for publishing                     │
└───────────────────────────────────────────────┘
```

### Color-Coded "Room Assignment Reason"

**Legend (visible as tooltips or in filter chips):**
- 🏠 `HOME_ROOM_ASSIGNED` — Section assigned to its home room (green checkmark)
- 🔬 `SPECIALIZED_ROOM` — Section assigned to lab/gym/specialty room (blue tag)
- 🎯 `GENERAL_POOL` — Section assigned from general constraint solving (neutral tag)
- ↔️ `ZONE_BALANCED` — Section moved to balance zone distribution (orange tag, soft)
- ⏰ `SHIFT_WINDOW_LOCKED` — Section time locked to Grade 7/8 MORNING, Grade 9/10 AFTERNOON, or STE OVERLAP per DepEd law (purple tag, hard constraint)
- 💼 `WORKLOAD_SAFE` — Teacher within 2,400-min hard cap after ancillary deductions (green tag, verified)
- ⚠️ `HOME_ROOM_UNAVAILABLE` — Home room had conflict; alternate assigned (yellow tag, soft)
- ⚠️ `SHARED_FACILITY_CONFLICT` — Lab/gym/kitchen double-booking prevented; moved to backup time (yellow tag, hard error)
- ❌ `FALLBACK_UNRESOLVED` — No room found even in general pool (red tag, hard)
- ❌ `WORKLOAD_VIOLATION` — Teacher exceeds 2,400-min hard cap; schedule cannot publish (red tag, hard error)
- ❌ `SHIFT_WINDOW_VIOLATION` — Section scheduled outside allowed time window (red tag, hard error)

---

## 5. Filter by Assignment Reason (New UI Feature)

In the **Violations Panel**, a new filter bar will appear:

```
Show violations where Room Assignment Reason is:
[All] [Home-Room ✓] [Singletons 🔬] [General 🎯] [Zone-Balanced ↔️] [Issues ⚠️❌]
```

### Use Cases for Filters
- **"Home-Room ✓"** — Spot-check: Are home rooms being assigned as expected?
- **"Singletons 🔬"** — Verify: Lab/gym sections in correct rooms?
- **"General 🎯"** — How many sections needed general solving? (Low % = good)
- **"Zone-Balanced ↔️"** — See which sections were moved for zone load balance
- **"Issues ⚠️❌"** — Focus on problems that need manual intervention

---

## 6. Validation Workflow: Scheduler Officer QA

### Step-by-Step Validation Script

**Setup:**
1. Login to Tailnet ATLAS: https://njgrm.buru-degree.ts.net
   - Admin: admin@deped.edu.ph / Incorrect_404
   - Or Faculty: maria.santos@deped.edu.ph / DepEd2026!
2. Navigate to `/timetable` (Schedule Review page)

**Validation Run:**

```
✓ Step 1: Check Pre-Generation Config
   Action: Click [Generate Schedule] button
   Verify:
   - Modal shows "Rooming Strategy" options
   - "Home-Room First" is the default (NEW)
   - "Balance Section Distribution by Zone" checkbox visible
   Expected: Both options present and clickable

✓ Step 2: Generate with HOME_ROOM_FIRST + Shift Windows Enforced
   Action:
   - Select "Home-Room First"
   - Verify "Enforce Shift Windows" is CHECKED (mandatory)
   - Toggle "Balance by Zone" ON
   - Click [Generate]
   Expected:
   - Generation starts (spinner visible)
   - Completes in <40 seconds (timer visible)
   - Success message shown
  - Shift windows are enforced from active Shift Settings
  - No section is scheduled outside its configured grade/program window

✓ Step 3: Review Metrics Card
   Action: Wait for generation to complete; metrics card appears
   Verify:
   - Home-Room Success Rate displayed (target 70–85%)
   - Zone Distribution chart visible (3 bars: NORTH, SOUTH, EAST)
   - Room Churn percentage shown
   - Generation Time shows <40s
   Expected:
   - All metrics visible and reasonable
   - No errors in metrics calculation

✓ Step 4: Verify Shift Window Enforcement + Workload Compliance
   Action:
   - Click "Violations" tab
   - Use filter bar to show "Issues ⚠️❌" to spot check violations
   - Look for any "SHIFT_WINDOW_VIOLATION" or "WORKLOAD_VIOLATION" entries
  Verify:
  - NO entries show "SHIFT_WINDOW_VIOLATION" (all sections in configured windows)
  - NO entries show "WORKLOAD_VIOLATION" (all teachers within 2,400-min hard cap)
  - NO entries show "SHARED_FACILITY_CONFLICT" (gym/lab/kitchen not double-booked)
   Expected:
   - 0 shift window violations
   - 0 workload violations
   - 0 shared facility conflicts

✓ Step 5: Spot-Check Manual Assignments + Shift Window Compliance
   Action:
  - Pick 3 Grade 7 sections; verify all times fall within configured Grade 7 window
  - Pick 3 Grade 9 sections; verify all times fall within configured Grade 9 window
   - Pick 3 sections with "HOME_ROOM_ASSIGNED" reason
   - Cross-reference SectionMirror.homeRoomId with assigned room
   Verify:
  - All Grade 7/8 times fall in configured MORNING window (from Shift Settings)
  - All Grade 9/10 times fall in configured AFTERNOON window (from Shift Settings)
   - SectionMirror homeRoomId matches assigned room
   - Room is in correct zone
   Expected:
   - Perfect match (100% spot-check pass)
   - NO shift window violations

✓ Step 6: Compare Zone Distribution
   Action:
   - Check Zone Distribution metrics
   - Manually count sections per zone (visual estimate from timetable grid)
   Verify:
   - Percentages roughly match visible distribution
   - No zone >50%
   Expected:
   - Zone balance within 10% variance

✓ Step 7: Test Backward Compat (UNIVERSAL mode)
   Action:
   - Generate again with "Universal Room Search" selected
   Verify:
   - Generation completes (may take 55–70s)
   - Schedule produced
   - No crashes or errors
   Expected:
   - UNIVERSAL mode still functional

✓ Step 8: Document Evidence + DepEd Compliance
   Action:
   - Take screenshots:
     1. Metrics card (full view, including shift window status)
     2. Violations tab with 0 shift window violations
     3. Violations tab with 0 workload violations
     4. Zone distribution chart
     5. Generation time timer (showing <40s)
     6. DepEd DO 005 compliance badge (if applicable)
   - Note any observations
   - Verify: "Ready to Publish" only if all hard constraints passed
   Expected:
   - All screenshots capture clearly
   - No visual glitches or truncation
   - Shift window enforcement VISIBLE in UI
   - Workload compliance summary displayed

Validation Result: ✓ PASS / ✗ FAIL
Notes: [Capture any issues, deviations, or positive observations]
```

---

## 7. Backend Validation: QA Auditor Checklist

### Automated Test Execution

```bash
# Run Phase 2 test suite (INCLUDING DepEd compliance)
npm run test -- phase2-home-room-integration

# Expected output:
# ✓ Home-Room Assignment (Test: 50 sections, 40 home rooms)
#   - 90%+ assigned to home room
# ✓ Shift Window Enforcement (Test: 100 Grade 7/8, 100 Grade 9/10)
#   - 100% Grade 7/8 in MORNING only
#   - 100% Grade 9/10 in AFTERNOON only
#   - STE marked OVERLAP
# ✓ Shared Facility Safety (Test: 10 lab sections, 2 labs)
#   - 0 double-bookings on isSharedFacility=true rooms
#   - Conflicts detected, fallback to backup time
# ✓ DepEd DO 005 Workload (Test: 50 teachers with ancillary deductions)
#   - 0 teachers exceed 2,400-min hard cap
#   - Ancillary loads correctly deduct from teaching capacity
#   - Synced from EnrollPro (read-only)
# ✓ Reduced Complexity (Test: 500-section dataset)
#   - Generation <40s
# ✓ Zone Balancing (Test: 300 sections, 3 zones)
#   - Distribution within 10% variance
# ✓ API Contract (Test: POST/GET with roomerStrategy + shiftWindowPolicy)
#   - Backward compatible (no roomerStrategy = UNIVERSAL; shiftWindows default ENFORCED)
# ✓ Violation Classification (Test: violations grouped by reason)
#   - Hard vs Soft violations correctly categorized
#   - SHIFT_WINDOW_VIOLATION correctly marked as HARD
#   - WORKLOAD_VIOLATION correctly marked as HARD
#   - SHARED_FACILITY_CONFLICT correctly marked as HARD

# Run benchmark
npm run benchmark -- --dataset typical-500-sections --strategy HOME_ROOM_FIRST

# Expected output:
# Generation Time: 32–38s
# Home-Room Success Rate: 72–82%
# Zone Imbalance: 8–12%
# Shift Window Compliance: 100%
# Workload Violations: 0
# Shared Facility Conflicts: 0
```

### Manual Backend Checks

```typescript
// Check 1: Verify migrations 0028–0031 applied
SELECT * FROM section_mirrors WHERE home_room_id IS NOT NULL LIMIT 5;
// Expected: 80%+ of sections have homeRoomId

SELECT * FROM faculty WHERE is_placeholder = true LIMIT 5;
// Expected: can retrieve placeholder faculty (for Teacher X)

SELECT * FROM rooms WHERE is_shared_facility = true LIMIT 5;
// Expected: gym, lab, kitchen flagged as shared facility

// Check 2: Verify Prisma schema generated correctly
import { SectionMirror, FacultyMirror, Room } from '@prisma/client';
const section: SectionMirror; // Should have homeRoomId, buildingZoneId fields
const faculty: FacultyMirror; // Should have ancillaryMinutesPerWeek, ancillaryLoadSource fields
const room: Room; // Should have buildingZoneId and teaching-space metadata fields

// Check 3: Verify GenerationRun.metrics contains rooming + compliance data
const run = await prisma.generationRun.findUnique({
  where: { id: 'run-2026-05-16-001' }
});
console.log(run.metrics.homeRoomSuccessRate); // Should be 0.72 (72%)
console.log(run.metrics.zoneDistribution);  // Should be { NORTH: 0.42, SOUTH: 0.38, ... }
console.log(run.metrics.shiftWindowCompliance); // Should be 1.0 (100% in correct shifts)
console.log(run.metrics.workloadComplianceCount); // Should be { withinCap: 48, exceededCap: 0 }

// Check 4: Verify shift window enforcement (use configured window bounds)
const gradeWindows = await prisma.gradeShiftWindow.findMany({
  where: { schoolId: 1, schoolYearId: 1 },
});
const grade7Window = gradeWindows.find((w) => w.gradeLevel === 7);
if (!grade7Window) throw new Error('Missing Grade 7 shift window config');

const grade7Sections = await prisma.scheduledEntry.findMany({
  where: {
    generationRunId: 'run-2026-05-16-001',
    section: { gradeLevel: 7 },
  },
});
for (const entry of grade7Sections) {
  if (entry.startTime < grade7Window.startTime || entry.endTime > grade7Window.endTime) {
    throw new Error(`Grade 7 section outside configured window ${grade7Window.startTime}-${grade7Window.endTime}`);
  }
}
console.log(`✓ All Grade 7 sections in configured window (${grade7Window.startTime}-${grade7Window.endTime})`);

// Check 5: Verify entry.roomAssignmentReason + shift window reason
const entries = await prisma.scheduledEntry.findMany({
  where: { generationRunId: 'run-2026-05-16-001' },
  take: 5
});
console.log(entries.map(e => ({ reason: e.roomAssignmentReason, shiftLocked: e.shiftWindowLocked }))); // Should show assignment reasons + shift lock status

// Check 6: Verify shared facility conflicts prevented
const sharedRoomConflicts = await prisma.scheduledEntry.findMany({
  where: {
    generationRunId: 'run-2026-05-16-001',
    room: { isSharedFacility: true },
  },
});
const conflictCount = /* calculate overlapping times on same room */;
if (conflictCount > 0) throw new Error(`Found ${conflictCount} shared facility double-bookings!`);
console.log('✓ 0 double-bookings on shared facility rooms');

// Check 7: Verify DepEd DO 005 workload compliance
const teacherWorkloads = await /* aggregate teaching minutes per teacher including ancillary */;
for (const [teacherId, totalMinutes] of Object.entries(teacherWorkloads)) {
  if (totalMinutes > 2400) throw new Error(`Teacher ${teacherId} exceeds 2,400-min hard cap with ${totalMinutes} min!`);
}
console.log('✓ All teachers within 2,400-min hard cap (DepEd DO 005 compliant)');
```

---

## 8. Expected Behavioral Changes

### What WILL Change
✓ **Faster generation** — 32–38s instead of 55–70s  
✓ **More stable room assignments** — Sections keep home rooms unless conflicts  
✓ **Transparent rationale** — Every assignment shows WHY it was made  
✓ **Better zone balance** — Sections spread more evenly across building  
✓ **New config option** — Rooming strategy selector in pre-generation UI  

### What WON'T Change
✗ Existing violation checking logic (hard constraints still apply)  
✗ Manual edit workflow (drag-drop still works the same)  
✗ Published schedule export format (optional backward compat)  
✗ Phase ordering (Setup → Preference → Generation → Review → Publish)  
✗ UNIVERSAL mode behavior (backward compatible for clients that don't set roomerStrategy)  

---

## 9. Performance Targets for Phase 2

| Metric | Previous | Target | Evidence Source |
|--------|----------|--------|-----------------|
| Generation Time (300–500 sections) | 55–70s | <40s | Benchmark script log |
| Home-Room Success Rate | N/A | 70–85% | GenerationRun.metrics |
| Zone Distribution Balance | N/A | <10% imbalance | GenerationRun.metrics |
| Unassigned Sections | <2% | <1% | Violation count / total sections |
| Test Coverage | N/A | >90% | Jest coverage report |

---

## 10. Troubleshooting Guide

### Problem: Shift Window Violations (Grade 7 classes scheduled after 12:00 PM)
**Likely Cause:** Shift window enforcement not applied to generation policy; or section constraints conflicting with shift window  
**Check:**
```sql
SELECT COUNT(*) FROM scheduled_entries WHERE grade_level = 7 AND EXTRACT(hour FROM start_time) >= 12;
```
**Fix:** Ensure `generateSchedule()` applies shift window hard constraint FIRST (before home-room placement) using active `GradeShiftWindow` records from settings, never hardcoded constants.

### Problem: Home-Room Success Rate Too Low (<50%)
**Likely Cause:** SectionMirror.homeRoomId not populated from EnrollPro sync  
**Check:**
```sql
SELECT COUNT(*) FROM section_mirrors WHERE home_room_id IS NULL;
```
**Fix:** Verify faculty sync is pulling homeRoomId from EnrollPro CSV/API

### Problem: Teachers Exceeding 2,400-Min Hard Cap (Workload Violation)
**Likely Cause:** Ancillary loads not deducted from teaching capacity; or synced ancillary values incorrect  
**Check:**
```sql
SELECT faculty_id, SUM(duration_minutes) as total_teaching_minutes FROM scheduled_entries
JOIN faculty_mirrors ON faculty_id = faculty_mirrors.id
GROUP BY faculty_id
HAVING SUM(duration_minutes) + COALESCE(faculty_mirrors.ancillary_minutes_per_week, 0) * 36 > 2400;
```
**Fix:** Verify `FacultyMirror.ancillaryMinutesPerWeek` synced from EnrollPro and marked as `ancillaryLoadSource = 'HR'` (read-only). Adjust section placement or ancillary deductions.

### Problem: Shared Facility Double-Booking (Gym/Lab/Kitchen Conflicts)
**Likely Cause:** isSharedFacility flag not set on gym/lab/kitchen rooms; or conflict detection missing  
**Check:**
```sql
SELECT r.id, COUNT(*) as conflict_count FROM scheduled_entries se1
JOIN rooms r ON se1.room_id = r.id
JOIN scheduled_entries se2 ON se1.room_id = se2.room_id AND se1.id != se2.id
WHERE r.is_shared_facility = true
AND (se1.start_time, se1.end_time) OVERLAP (se2.start_time, se2.end_time)
GROUP BY r.id HAVING COUNT(*) > 1;
```
**Fix:** Ensure all shared facilities (gym, lab, kitchen, music room) are marked `isSharedFacility = true`. Add hard constraint check in room resolver: if room is shared facility AND time overlaps existing entry, reject assignment.

### Problem: Generation Still Takes >40s
**Likely Cause:** Zone balancing enabled but too aggressive; or singleton conflicts blocking resolution  
**Check:**
- Disable "Balance by Zone" and re-run; if <40s, tuning needed
- Count singleton room conflicts; if >50 sections, lab scheduling conflict
**Fix:** Adjust zone balance threshold or add more singleton rooms

### Problem: Zone Distribution Severely Imbalanced
**Likely Cause:** Home rooms concentrated in one building; or zone definition missing  
**Check:**
```sql
SELECT building_zone_id, COUNT(*) FROM section_mirrors GROUP BY building_zone_id;
```
**Fix:** Ensure Room.buildingZoneId populated correctly; verify section homeRoomId distribution

### Problem: Violations Show "FALLBACK_UNRESOLVED"
**Likely Cause:** Section has no compatible room even after general solving  
**Action:** Manual intervention required
- Check section requirements (features, capacity, time)
- Check room availability
- Consider splitting section or adjusting time slot

---

## 11. Sign-Off Checklist

**For Scheduler Officer:**
- [ ] I can select "Home-Room First" strategy before generation
- [ ] Shift Windows enforcement checkbox is CHECKED (mandatory, not optional)
- [ ] Generation completes <40 seconds
- [ ] Metrics card shows Home-Room Success Rate, Zone Distribution, Room Churn
- [ ] I can filter violations by "Room Assignment Reason"
- [ ] 5–10 spot checks confirm home-room assignments are correct
- [ ] Zone distribution is balanced (no zone >50%)
- [ ] I understand the difference between hard violations (blocking) and soft warnings (informational)

**For QA Auditor:**
- [ ] Test suite runs to completion (all tests PASS), including new shift window & workload tests
- [ ] Benchmark confirms <40s generation time
- [ ] Benchmark confirms 100% shift window compliance (Grade 7/8 MORNING only, Grade 9/10 AFTERNOON only)
- [ ] Benchmark confirms 0 shared facility double-bookings
- [ ] Benchmark confirms 0 teachers exceed 2,400-min hard cap (DepEd DO 005 compliant)
- [ ] Home-room success rate 70–85% (as expected)
- [ ] Zone distribution within 10% variance
- [ ] API schema extended correctly (roomerStrategy, roomAssignmentReason, shiftWindowPolicy, workloadCompliance)
- [ ] Backward compatibility verified (UNIVERSAL mode unaffected; shiftWindows default ENFORCED)
- [ ] Manual QA workflow validates all hard constraints (shift window, workload, shared facility)
- [ ] Evidence logged to docs/verification/evidence-log.md

**For Phase Sponsor:**
- [ ] Phase 2 gates (2a–2h) all PASS, including new DepEd compliance gates
- [ ] No shift window violations (100% Grade 7/8 MORNING, 100% Grade 9/10 AFTERNOON)
- [ ] No workload violations (0 teachers exceed 2,400-min hard cap)
- [ ] No shared facility double-bookings (gym/lab/kitchen conflicts prevented)
- [ ] Manual QA evidence captured (screenshots, logs, DepEd compliance report)
- [ ] No blocking violations in test suite
- [ ] Performance targets met (<40s, >70% home-room success)
- [ ] Documentation complete (phase plan, API docs, validation guide)
- [ ] DepEd DO 005 compliance verified and signed off
- [ ] Approval to move to Phase 3 (Teacher X placeholders — unblocked by Week 0 isPlaceholder migration)

---

**End of Validation & Behavior Guide**

Questions or issues? Contact the Backend/Algorithm Team.
