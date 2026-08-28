# Phase 2 Kickoff Summary: Home-Room-First Algorithm
**Date:** 2026-05-16  
**Status:** Ready to Start  
**Prepared for:** Stakeholder Validation & Engineering Kickoff

---

## Executive Briefing

**What:** Replace universal room-search generation with a home-room-first algorithm that respects pre-assigned section locations.

**Why:** 
- Current system treats all 500+ sections as room-search problems (slow: 55–70s)
- Schools assign home rooms to sections annually before year starts (unused)
- New algorithm: Lock home rooms first → solve only exceptions (fast: <40s, more stable)

**Result:**
- ⚡ **30% faster generation** (55–70s → 32–38s)
- 📍 **More stable schedules** (sections keep home rooms unless hard conflicts)
- 📊 **Transparent assignment rationale** (see WHY each room was chosen)
- ⚖️ **Better zone distribution** (buildings used evenly)

---

## Phase 2 Documents — Your Reading Guide

### 1. **Master Plan** (20-30 min read)
📄 [`docs/phases/phase-2-home-room-algorithm-2026-05-16.md`](../phases/phase-2-home-room-algorithm-2026-05-16.md)

**What you'll find:**
- High-level algorithm strategy (4 phases: home-room → singletons → general pool → zone balance)
- Complete pseudocode
- 8 concrete implementation tasks (2a–2h) with acceptance criteria
- Testing strategy (unit, integration, manual QA)
- Risk register & mitigation
- Rollout & deployment sequence

**Read this first if:** You need the full technical roadmap and task breakdown

---

### 2. **Validation & Behavior Guide** (15-20 min read)
📄 [`docs/phases/phase-2-validation-behavior-guide.md`](../phases/phase-2-validation-behavior-guide.md)

**What you'll find:**
- Exact UI changes (pre-generation modal, metrics card, violations panel)
- Step-by-step QA validation workflow for scheduler officers
- Backend QA checklist for auditors
- Performance targets & success metrics
- Troubleshooting guide
- Sign-off checklist for all stakeholders

**Read this if:** You want to know what to expect when Phase 2 is done, how to validate it, and what to look for

---

### 3. **Updated phasePlan.md**
📄 [`phasePlan.md`](../../phasePlan.md) — Lines 155–185

**Changes:**
- Phase 2 marked "✅ READY TO START"
- Links to full plan + validation guide
- Key deliverables and success metrics listed
- Dependency status confirmed (Phase 1d ✅ complete)

---

## Key Concepts Explained Simply

### What Is "Home-Room First"?

**Analogy:** 
- **Old way (UNIVERSAL):** Throw 500 room assignments into a mixer, hope for optimal blend (slow, unpredictable)
- **New way (HOME_ROOM_FIRST):** Lock 380 sections into their pre-assigned rooms first, then solve the remaining 120 (fast, predictable, respects existing assignments)

### The 4-Phase Algorithm

```
Phase A: Home-Room Batch         →  ~340/380 sections locked ✓
Phase B: Singleton/Special       →  ~30 lab/gym sections placed ✓
Phase C: General Pool (reduced)  →  Remaining 130 sections GA-solved
Phase D: Zone Balancing          →  Verify buildings used evenly ✓
```

### New User-Facing Terms

| Term | Meaning | You'll See |
|------|---------|-----------|
| **Rooming Strategy** | Algorithm choice (UNIVERSAL vs HOME_ROOM_FIRST) | Pre-generation modal |
| **Home-Room Success Rate** | % of sections assigned to their designated room | Metrics card (target 70–85%) |
| **Room Assignment Reason** | WHY a room was chosen (e.g., "HOME_ROOM_ASSIGNED", "ZONE_BALANCED") | Violations panel, tooltips |
| **Zone Distribution** | How evenly sections spread across building zones (NORTH/SOUTH/EAST) | Metrics card chart |
| **Room Churn** | % of sections that change rooms across terms | Metrics card (low = good) |

---

## What Will Change for You (User Impact)

### For Scheduler Officers
**Before Phase 2:**
```
Click Generate → Wait 55–70s → Review schedule
```

**After Phase 2:**
```
Click Generate → Choose strategy (HOME_ROOM_FIRST ← new!)
               → See "Balance by Zone?" checkbox (new!)
               → Wait 32–38s ← faster!
               → Review schedule + new metrics (homeroom % rate, zone distribution)
```

### For QA/Auditors
**New checklist items:**
- Metrics card visible & accurate?
- Home-room success rate 70–85%?
- Zone distribution balanced (no zone >50%)?
- Assignment reasons displayed correctly?
- Generation <40s?

### For EnrollPro Integration
**No change needed** — Already syncing homeRoomId via migration 0028  
Just verify: `SectionMirror.homeRoomId` is populated from CSV/API

---

## Implementation Timeline

### Week 0 (Database Migrations — MUST COMPLETE BEFORE Week 1)
**🚨 CRITICAL SCHEMA PREREQUISITES:**
- Add `isPlaceholder: Boolean` to Faculty model (default: false) — unblocks Teacher X placeholders
- Add `isSharedFacility: Boolean` to Room model (default: false) — flags gym/lab/kitchen for double-booking prevention
- Validate `modularGroupId` now supports Tri-Sem (3 terms, not 4 quarters) — test term index 1/2/3 parsing
- Verify `ancillaryMinutesPerWeek` read-only sync from EnrollPro to FacultyMirror

**Acceptance Criteria:**
- Migrations 0029–0031 applied to `atlas_db`
- Prisma client regenerated with new fields
- Test: Faculty with `isPlaceholder=true` created and retrieved correctly
- Test: Rooms with `isSharedFacility=true` flagged in room resolver

### Week 1 (Tasks 2a–2c + Shift Windows ENFORCEMENT)
- ✓ RoomingStrategy enum + policy framework
- ✓ Shift window policy enforcement (Grade 7/8 MORNING, Grade 9/10 AFTERNOON, STE OVERLAP) — **NO DEFERMENT TO PHASE 7**
- ✓ Home-room batch assignment logic
- ✓ Singleton/lab room detection + shared facility double-booking prevention
- ✓ DepEd DO 005 workload validation (1,800-min standard cap, 2,400-min hard cap)

### Week 2 (Tasks 2d–2f)
- ✓ Zone balancing algorithm
- ✓ API schema extensions (roomerStrategy, roomAssignmentReason, metrics)

### Week 3 (Tasks 2g–2h)
- ✓ Regression test suite
- ✓ Performance benchmarks
- ✓ Manual QA & evidence collection
- ✓ Phase 2 gates PASS → Merged & Deployed

**Estimated Completion:** June 1, 2026

---

## Success Metrics You'll Validate

| What | Target | How You'll Know |
|-----|--------|-----------------|
| **Speed** | <40s | Timer in UI + benchmark logs |
| **Home-Room Success** | 70–85% assigned | Metrics card percentage |
| **Zone Balance** | <10% imbalance | Metrics card chart |
| **DepEd DO 005 Compliance** | 0 teachers exceed 2,400 min | Workload validation log + audit report |
| **Shift Window Enforcement** | 100% sections in correct shift | Grade 7/8 MORNING only, Grade 9/10 AFTERNOON only, STE OVERLAP flagged |
| **Shared Facility Safety** | 0 double-bookings on isSharedFacility=true rooms | Gym/Lab/Kitchen collision test suite |
| **Test Coverage** | >90% | Jest coverage report |
| **Manual QA Pass** | 100% of spot-checks correct | QA auditor validation log |

---

## Questions You Might Have

### Q: Will my existing schedules break?
**A:** No. UNIVERSAL mode (current behavior) is unchanged and backward compatible. HOME_ROOM_FIRST is opt-in.

### Q: What if a section has no home room?
**A:** It skips Phase A and enters Phase B (singletons) or Phase C (general pool). No change in outcome, just takes shorter path.

### Q: What about shift windows and zone constraints?
**A:** **Shift windows are ENFORCED in Phase 2 (not deferred).** Grade 7/8 classes must be scheduled only in MORNING slots (08:00–12:00), Grade 9/10 only in AFTERNOON slots (13:00–17:00), and STE (Special Technical Education) in OVERLAP slots. This is a legal requirement under DepEd labor law and cannot wait until Phase 7. Zone balancing in Phase 2 is soft-only (warning if imbalanced, but doesn't block publish).

### Q: Why does this matter operationally?
**A:** Schools pre-assign home rooms to sections (part of setup). Current system ignored this assignment. New system respects it, making schedules more stable and aligned with admin reality. Additionally, DepEd requires shift windows and workload caps to be enforced to protect teacher well-being and comply with labor laws.

### Q: Can I still manually edit rooms after generation?
**A:** Yes. Manual editing workflow unchanged. You can still drag-drop sections to different rooms in review panel.

---

## Next Steps for Approval

### For Stakeholder/Product Lead
1. ✅ Read **Validation & Behavior Guide** (phase-2-validation-behavior-guide.md)
2. ✅ Confirm performance targets align with expectations (<40s, 70–85% home-room success)
3. ✅ Approve scope (in/out boundaries confirmed)
4. ✅ Approve rollout plan (opt-in HOME_ROOM_FIRST, backward-compatible UNIVERSAL)

### For Backend Engineering Lead
1. ✅ Read **Master Plan** (phase-2-home-room-algorithm-2026-05-16.md)
2. ✅ Review task breakdown (2a–2h); estimate team capacity
3. ✅ Confirm test strategy adequacy (unit + integration + manual)
4. ✅ Set sprint cadence & milestone dates

### For QA Lead
1. ✅ Read **Validation & Behavior Guide** (section 7–10: Backend QA, troubleshooting, sign-off)
2. ✅ Prepare manual QA environment (Tailnet access, test scripts)
3. ✅ Create test matrix for scheduler officers & auditors

---

## Key Documents Ready for You

```
docs/
├── phases/
│   ├── phase-2-home-room-algorithm-2026-05-16.md          [Master Plan]
│   ├── phase-2-validation-behavior-guide.md               [User Behaviors]
│   └── README.md                                           [Phase Docs Index]
├── verification/
│   ├── evidence-log.md                                    [← Updates go here]
│   ├── phase-gates.md                                     [Gate checklist]
├── plans/
│   └── STAKEHOLDER_UPDATE_COMPARISON_AND_REFACTOR_PLAN.md [Context]
└─ phasePlan.md                                            [Master Tracker]
```

---

## Approvals & Sign-Off Template

**To confirm Phase 2 is ready to proceed, reply with:**

```markdown
Phase 2 Approval Checklist:

[ ] Stakeholder: I've read the Validation Guide and approve the scope
[ ] Stakeholder: Performance targets (<40s, >70% home-room success) meet my expectations
[ ] Stakeholder: Backward compatibility (UNIVERSAL mode) acceptable for rollout
[ ] Backend Lead: I've reviewed the Master Plan and estimate team capacity
[ ] Backend Lead: Test strategy is adequate (unit + integration + manual)
[ ] QA Lead: I'm prepared to execute manual validation workflow
[ ] QA Lead: Sign-off checklist is clear and achievable

All approvals obtained: ✓ PROCEED TO PHASE 2 IMPLEMENTATION
```

---

## Quick Reference: What to Validate When Phase 2 Ships

### UI Checklist (Open ATLAS and run Phase 2 QA)
- [ ] Pre-generation modal has "Home-Room First" option
- [ ] Generation completes in <40 seconds
- [ ] Metrics card shows home-room success rate (70–85% range)
- [ ] Zone distribution chart visible
- [ ] Violations panel filters by "Room Assignment Reason"
- [ ] Spot-check: 5–10 sections with HOME_ROOM_ASSIGNED reason are in correct rooms

### Backend Checklist (Run tests)
```bash
npm run test -- phase2-home-room-integration  # All tests PASS
npm run benchmark -- --strategy HOME_ROOM_FIRST  # <40s confirmed
```

### Evidence (Capture for Phase 2 Closure)
- Screenshots: Metrics card, violations panel, zone distribution
- Logs: Generation time, home-room success %, test coverage
- Spot-checks: 5–10 manual verifications logged
- Sign-off: Stakeholder + QA signatures

---

## Final Notes

**This is a foundational refactor that unblocks Phase 3 (Teacher X) and beyond.** 

Phase 2 introduces:
- ✅ Cleaner algorithm (easier to maintain, extend to shift windows in Phase 7)
- ✅ Transparent decision-making (auditable reasoning per room assignment)
- ✅ Better performance (foundation for handling 1000+ section datasets)
- ✅ Operational alignment (respects school's pre-assigned room structure)

Once Phase 2 gates close, **Phase 3 (Teacher X placeholders) and Phase 5 (Publish) are unblocked and can proceed in parallel.**

---

**Questions?** Contact Engineering Team or refer to full documents linked above.

**Ready to proceed?** Reply with approval checklist above.

---

**Document:** Phase 2 Kickoff Summary  
**Status:** Ready for Review  
**Last Updated:** 2026-05-16  
**Next Milestone:** Approval → Implementation Kickoff (Week 1)
