# Phase 5 Faculty Assignment Fixes - Tailnet QA Report

Date: 2026-05-14
Environment: https://njgrm.buru-degree.ts.net
Tester: Copilot (GPT-5.3-Codex)

## Scope
- AC-06 live Tailnet validation for faculty assignment coverage/collision checks.
- FR-06 UI verification for assignment history controls (Undo/Redo/Reset + keyboard shortcuts presence).

## Accounts Tested
- admin@deped.edu.ph / Incorrect_404 -> failed on this environment (invalid credentials response).
- maria.santos@deped.edu.ph / DepEd2026! -> login successful (faculty portal).
- admin@deped.edu.ph / AdminSY2026! -> login successful (officer/admin portal).

## Validation Steps
1. Logged in as admin and navigated to `/assignments`.
2. Verified page-level controls for FR-06 are visible:
   - `Undo`
   - `Redo`
   - `Reset Assignments`
3. Triggered `Auto-Fill Remaining` and confirmed modal action `Run Auto-Fill` is available.
4. Read overview banner values after triggering auto-fill.

## Observed Results
- Teaching Load overview text after run trigger:
  - `0 / 1357 assigned`
  - `66 / 142 faculty assigned`
  - auto-fill button state remained `Running...` during observation window.
- No collision warning text was surfaced in the current viewport snapshot, but coverage criteria were not met.

### Follow-up Stable Snapshot (same environment/session)
- Re-opened `/assignments` after auto-fill activity settled.
- Stable overview values observed:
  - `774 / 1357 assigned`
  - `142 / 142 faculty assigned`
  - `Running...` state no longer present.
- FR-06 controls remained visible in page text:
  - `Undo`
  - `Redo`
  - `Reset Assignments`
- UI text scan showed no explicit `collision` or `conflict` banner text in the current page state.
- Additional observation: a reload during a subsequent auto-fill re-trigger showed an aborted request event (`POST /api/v1/faculty-assignments/auto-fill` aborted), indicating run stability issues may still exist under repeated triggers.

## AC-06 Gate Outcome
Status: FAIL (not yet satisfied in live Tailnet)

Reason:
- AC-06 requires all required subjects assigned and all faculty with at least one assigned subject.
- Latest stable values improved faculty coverage to full (`142 / 142`) but still fail required subject coverage (`774 / 1357`, not complete).
- Therefore, AC-06 is still not satisfied because complete subject assignment coverage is mandatory.

## Notes / Follow-ups
- Investigate why auto-fill converges to partial subject coverage (`774 / 1357`) despite full faculty utilization.
- Investigate long-running/re-trigger stability in the live environment (`Running...` persistence and aborted re-trigger request observed).
- Re-run AC-06 after backend/algorithm remediation and verify:
  - full pair coverage,
  - full faculty coverage,
  - no unresolved collision conflicts in UI.
