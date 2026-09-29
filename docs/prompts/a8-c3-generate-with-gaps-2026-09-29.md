# A8 packet c3 — DEMO BLOCKER: 50 unstaffed classes must not block the whole timetable; blockers grouped by cause

Issued by Lane C, 14:30. New branch/worktree from the main tip. Server (+ the client readiness panel, coordinated with
A2 via `lane-c-to-a2.md`). Risk **HIGH** (generation gate): one `atlas-reviewer-high` pass. Deadline: on main by
**17:00** (train 10). Browser/API proof with REAL staging data (staging QA login; staging = 2023-2024 after train 9's
re-stream from live). Shell calls are force-killed at 20 min; run builds and suites detached at BelowNormal priority.

## Evidence — live, S.Y. 2023-2024, 14:25 (`GET /api/v1/generation/1/2/readiness/diagnostic`)
status BLOCKED, generateAllowed false, schedulerExecuted true. Blockers (651 shown to the operator as 651 identical
rows "A session could not be placed with the current setup", each with its own "Recheck generation readiness"):
- DATA_GAP / TL_NO_QUALIFIED_OWNER — **570** (the sessions of the uncovered pairs, x3 terms)
- DATA_GAP / TL_DEMAND_UNCOVERED — **50** (teachingLoadCoverage: requiredPairs 264, ownedPairs 214, missingPairs 50)
- POLICY_BLOCKER / WORKLOAD_POLICY_BLOCK — 15
- ALGORITHM_LIMIT / FACULTY_SUBJECT_NOT_QUALIFIED — 12
- ALGORITHM_LIMIT / FACULTY_OVERLOAD — 4 (e.g. 2250 min vs 1800 max)
Operator (14:10): "Why can't I generate a schedule? … This state is unacceptable."

## Target
1. **Generate with teacher gaps.** When the only blockers are teacher coverage (TL_DEMAND_UNCOVERED /
   TL_NO_QUALIFIED_OWNER and the workload/qualification items that follow from them), generation is ALLOWED: the
   uncovered classes are placed in time and room with the teacher shown as "Teacher to be assigned" (reuse A6 c5's
   placeholder concept if it fits the engine; otherwise leave them unplaced and list them) — never silently dropped.
   The run result names them in plain words ("50 classes placed without a teacher yet: MAPEH 7-A …"). Hard
   infeasibility (no room/time at all, broken policy) still blocks. Decide and justify the exact rule in the HIGH review.
2. **Group blockers by cause** in the diagnostic (`groups: [{cause, count, examples, action}]`), one group per root
   cause, not per session. The operator panel shows at most one line per group, e.g.
   - "50 classes need a teacher (MAPEH 30, English 12, …)" -> **Assign teachers** (opens Teaching Load's who-needs list)
   - "4 teachers are over 30 hours" -> **Review their load**
   - "12 classes are with a teacher outside their subjects" -> **Review**
   One "Check again" button for the whole panel, not one per row. Counts are classes, not sessions.
3. `blockerCount`/gating stays honest: the client's `timetable-capabilities.ts:177` gate follows the server's new
   `generateAllowed`, not a raw count.

## Rules
- Zero-write preflight stays zero-write. No schema change unless the HIGH review accepts it.
- Proof on staging: Generate enabled on 2023-2024 with the 50 gaps; a run completes; the gaps are listed in the result.
