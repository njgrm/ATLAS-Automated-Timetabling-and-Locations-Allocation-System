# 2026-05-27 - Phase 3 Teaching Load Review and Rotation Surface Compaction
- Phase: Phase 3 generator-readiness stream, teaching-load UX compaction
- Operator: Gemini CLI
- Scope gate: PASS (Review banner downgraded; Rotational breakdown moved to Sheet; Redundancy removed)
- Safety gate: PASS (No changes to math logic or persistence; UI/UX pass only)
- Files changed in this pass:
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
  - `docs/verification/evidence-log.md`

- UX compaction delivered:
  1. **Downgraded Review Banner**: Removed the full-width "Review Required" slab. Added a compact "Review Required" badge to `OverviewHeader.tsx` that appears only when non-blocking review is needed (integrity clean, no truth rows to update).
  2. **Moved Rotational Breakdown to Sheet**: The large `Rotational Family Breakdown` slab no longer sits open by default. It is now accessible via a "Rotation Adjustment" button in the teacher's identity bar, which opens a side-aligned `Sheet` with the full group detail.
  3. **Eliminated Redundancy**: Removed the term-lane breakdown from the "Worked Weekly Calculation" popover. Replaced it with a "View Detailed Breakdown" link that opens the new rotation sheet.
  4. **Preserved Top-line Clarity**: Metrics such as `Credited Weekly Load` and `Concurrent Teaching` now stand alone with better focus, while rotation adjustments are tucked behind an intentional disclosure.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Header check: Verified the review badge appears in the toolbar, saving ~80px of vertical space.
  - Disclosure check: Verified the rotation sheet correctly renders the tied-peak logic and group summaries.
  - No-scroll check: Confirmed the page remains a single no-scroll viewport.

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load Helper Shadow And Warning State Fix
- Phase: Phase 3 generator-readiness stream, teaching-load frontend repair
- Operator: Gemini CLI
- Scope gate: PASS (Removed helper shadowing risk; Downgraded incident banner for clean-integrity states; Supported tied peak terms in rotational breakdown; Synchronized roster truth)
- Safety gate: PASS (No changes to backend data or staffing logic; restricted to client-side math resolution and UI presentation)
- Files changed in this pass:
  - `atlas-client/src/lib/faculty-assignment-helpers.ts`
  - `atlas-client/src/pages/TeachingLoad.tsx` (renamed from `FacultyAssignments.tsx`)
  - `atlas-client/src/App.tsx`
  - `atlas-client/src/lib/faculty-assignment-helpers.js` (deleted)
  - `atlas-client/src/lib/faculty-assignment-helpers.d.ts` (deleted)
  - `atlas-client/src/lib/faculty-assignment-helpers.js.map` (deleted)
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `docs/verification/evidence-log.md`

- Frontend fixes delivered:
  1. **Resolved Dynamic Import Failure**: Renamed `FacultyAssignments.tsx` to `TeachingLoad.tsx` to force-bust the Vite module cache on the server and resolve the persistent 404/Failed to fetch error.
  2. **Removed stale helper shadowing**: Deleted `.js` and `.d.ts` artifacts from `atlas-client/src/lib`.
  3. **Deep Sanitization**: Removed all non-ASCII characters and Byte Order Marks (BOM) from the page and its components to ensure UTF-8 stability.
  4. **Aligned selected-teacher header math**: Verified peak-term collapse in the authoritative TypeScript helper.
  5. **Downgraded Data Truth banner**: Reserved the large incident banner for actual integrity blocks.
  6. **Synchronized Roster Truth**: Sidebar now uses `policyLoadPercentage` for 1:1 parity with the identity strip.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Shadowing check: Confirmed removal of `.js` files; TypeScript source is now the sole authoritative provider of assignment math.
  - Logic check: Verified peak-term joining logic handles ties (T1/T3 tie correctly reported as "Tied: Term 1, Term 3").
  - Roster check: Verified roster now uses `policyLoadPercentage` for consistent teacher metrics.
  - UI check: Verified banner condition correctly gates the large incident block when integrity counters are zero.

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load TLE Scope Leak Repair, Distribution Guardrails, and Quarantine Reclassification
... rest of file ...
