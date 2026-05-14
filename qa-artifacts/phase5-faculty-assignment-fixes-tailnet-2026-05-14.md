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
- Follow-up investigation completed (details below).

## Follow-up Remediation Pass (2026-05-14)

### Implemented Remediation
- Backend auto-fill service hardened:
  - replaced per-candidate DB qualification lookups with in-memory alias resolution,
  - switched section universe source to active section roster by school-year,
  - enforced outside-specialization behavior through faculty toggle semantics.
- Teaching Load UI hardened:
  - qualification sections now show specialization-based labels (removed Tier/alias jargon in headings),
  - outside-specialization rows are explicitly separated and disabled when override is off,
  - faculty list load percentage and bar now use **actual teaching hours** (not credited hours).
- Load threshold colors updated:
  - `<=100%` = green,
  - `101%-150%` = yellow,
  - `>150%` = red.

### Live Re-Run (Tailnet API Evidence)
- Login: `POST /api/v1/auth/login` (admin) -> PASS
- AC-06 baseline snapshot (`GET /api/v1/faculty-assignments/summary`):
  - `774 / 1357` assigned pairs
  - `142 / 142` faculty assigned
- Auto-fill re-run (`POST /api/v1/faculty-assignments/auto-fill`):
  - elapsed: `0.07s`
  - `created = 0`
  - `unresolved = 583`
  - warnings emitted: `139`
- Post-run snapshot:
  - `774 / 1357` assigned pairs (unchanged)
  - `142 / 142` faculty assigned (unchanged)
- Collision verification:
  - duplicate subject-section ownership pairs: `0`

### Root-Cause Blockers Confirmed
1. **Qualification coverage gap for unresolved subjects**
   - The unresolved cluster is dominated by subjects with zero qualified faculty under current specialization mappings.
   - Confirmed examples with `strictQualifiedFaculty = 0`:
     - `ADVANCED_CHEMISTRY`
     - `ADVANCED_PHYSICS`
     - `ELECTRONICS`
     - `BIOTECHNOLOGY`
     - `CONSUMERS_CHEMISTRY`
     - `DEVL_READING`
     - `ELECTRONICS_ROBOTICS`
     - `ENV_SCI`
     - `ENVIRONMENTAL_SCIENCE`
     - `STE_RESEARCH`
   - `SCI_ES` currently has partial alias coverage (`strictQualifiedFaculty = 5`) but remains fully unassigned (`0 / 66`).

2. **Outside-specialization override disabled globally in current data**
   - `outsideEnabledFaculty = 0` across active faculty in this environment.
   - With no override-enabled teachers, auto-fill cannot bridge unmapped subjects.

3. **Specialization mapping data, not solver runtime, is the current gate**
   - Auto-fill now completes quickly and deterministically in this environment.
   - The prior long-running symptom was remediated in code, but AC-06 still fails due to unresolved qualification supply.

### Grace Aquino Validation (Discrepancy Follow-up)
- Faculty: `AQUINO, GRACE`
- Specialization: `MAJOR IN VALUES EDUCATION`
- Alias mappings for this specialization (live): `ESP` only
- Load math in UI after patch:
  - actual: `25h`
  - credited: `30h` (includes advisory equivalent)
  - list bar/percent now reflects actual (`83%`) instead of credited (`100%`)

## AC-06 Gate Outcome (After Remediation)
Status: FAIL (still not satisfied)

Reason:
- Full faculty coverage is met (`142 / 142`).
- Full pair coverage remains unmet (`774 / 1357`) because multiple subjects still have no qualified faculty under current specialization mapping and override configuration.
- No unresolved DB ownership collisions are present.

## Required Next Data/Workflow Checks
- Subject workflow:
  - populate specialization mappings for unresolved subject codes listed above,
  - verify each unresolved subject has at least one qualified faculty path.
- Faculty workflow:
  - decide and configure which teachers can be marked `canTeachOutsideDepartment=true` for controlled override coverage.
- Specialization mapping workflow:
  - reconcile canonical subject codes against actual subject catalog entries,
  - ensure mapping entries exist for the advanced/modular science and technology subjects that remain at `0` coverage.
