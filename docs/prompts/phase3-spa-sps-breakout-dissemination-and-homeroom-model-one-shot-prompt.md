# Copilot Execution Prompt: Phase 3 SPA/SPS Breakout Dissemination And Homeroom Model One-Shot

## Mission

Replace the current too-coarse `SPA_SPEC` / `SPS_SPEC` staffing model with the real school model:

- `MAPEH` is the default staffing pool for both regular `MAPEH` and `SPA/SPS` tracks
- `SPA` and `SPS` must expose real specialization breakout lanes
- sections split into concurrent specialization subgroups
- teachers must be assigned to explicit specialization lanes
- the generator and Teaching Load must remain honest about concurrent teacher demand

This pass must also push ATLAS toward the correct homeroom-centric scheduling model:

- sections are docked to a homeroom
- the hard scheduling problem is primarily teacher routing and teacher availability
- not per-period room collision solving for every `SPA/SPS` breakout

This is now the correct direction. The previous approval-gated `MAPEH -> SPS_SPEC` workflow is too strict and should not be the active model.

---

## Clarified Domain Rules You Must Implement

These are now authoritative for this pass:

1. **MAPEH eligibility**
   - Any `MAJOR IN MAPEH` teacher is eligible by default for `SPA/SPS` staffing.
   - Remove the capability-approval gate as the default requirement for `SPA/SPS` staffing.
   - The current live `SPECIAL_PROGRAM_APPROVAL_REQUIRED` / `specialProgramApprovalCandidates` behavior is not acceptable under the target model and must be removed for normal `MAPEH` staffing.

2. **Specialization treatment**
   - `SPA/SPS` must be represented as separate schedulable specialization lanes.
   - Those lanes still draw from the broader `MAPEH` teacher pool.
   - The umbrella subject ownership and auto-assigned department identity for `SPA_SPEC` / `SPS_SPEC` must normalize to `MAPEH`, not synthetic `SPA` or `SPS` departments.

3. **Real scheduling unit**
   - The whole section splits into concurrent specialization subgroups.
   - Use the `Instructional Cohorts` logic for these subgroup splits.
   - The system must catch teacher double-bookings and concurrent teacher demand.
   - The system does **not** need strict hard spatial collision solving for each specialization breakout room in this pass.

4. **Teaching Load assignment target**
   - Teaching Load must assign teachers to explicit specialization rows, not a single umbrella `SPA_SPEC` / `SPS_SPEC` row.
   - Teachers must be able to see the actual specialization they are carrying.

5. **Track exposure**
   - If EnrollPro indicates multiple active `SPA` or `SPS` specializations, ATLAS must expose them individually.
   - Generic coarse subject rows are misleading and must not remain the primary scheduling truth.

6. **Priority**
   - Fix the data model and scheduling truth for `SPA/SPS` breakout dissemination first.
   - Do not preserve the old approval-gated fallback model as the primary path.

---

## Current Problem To Fix

Right now the system is misleading because:

- there are only coarse specialization subject assignments
- the student reality is concurrent specialization breakout
- the faculty loading truth is therefore too blunt
- idle `MAPEH` teachers look unusable under the wrong model
- Teaching Load and downstream schedule views cannot honestly show who teaches which actual specialization lane

This pass must correct that model.

---

## Hard Scope

Touch the backend and frontend necessary to make the breakout model real.

Likely files:

- `prisma/schema.prisma`
- relevant seed files and seed contracts if specialization-lane materialization cannot be represented cleanly with the current schema
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/generation*`
- any cohort-generation or section-splitting logic still relevant
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`
- any specialization or cohort-related shared type files
- API docs and runtime docs

Update only what is needed, but own the full stack for this correction.

Schema and migration rule:

- If explicit `SPA/SPS` breakout specialization lanes cannot be represented cleanly with the existing subject, ownership, specialization, and section-facing fields, then update:
  - `prisma/schema.prisma`
  - the necessary Prisma migrations
  - the relevant seeders / seed contracts
- If the current schema can represent the breakout truth cleanly, do **not** force a migration just for the sake of one.

---

## Required System Changes

### 1. Remove approval-gated `MAPEH` fallback as the primary model

Required outcome:

- `SPA/SPS` staffing must no longer assume a separate approval-only gate for normal `MAPEH` eligibility.
- `MAJOR IN MAPEH` faculty must be eligible by default for `SPA/SPS` breakout staffing.
- If any override concept remains, it must be secondary and not the default path for ordinary `MAPEH` staffing.
- The live split-brain / staffing preview must stop reporting `SPECIAL_PROGRAM_APPROVAL_REQUIRED` for ordinary `MAPEH` candidates under this model.
- `specialProgramApprovalCandidates` should not remain non-zero merely because a teacher is `MAJOR IN MAPEH` and the constrained subject is `SPS_SPEC` or `SPA_SPEC`.

### 1a. Normalize subject-sync owner-department truth for SPA/SPS

Required outcome:

- any subject-sync or materialization path that currently auto-assigns `SPA_SPEC` or `SPS_SPEC` to synthetic `SPA` / `SPS` owner departments must be corrected
- `SPA_SPEC` and `SPS_SPEC` must normalize to `MAPEH` as their owner-department truth in ATLAS
- downstream qualification, candidate discovery, and Teaching Load grouping must no longer inherit fake `SPA` / `SPS` department ownership from sync

This specifically includes the subject-sync behavior surfaced on the `Subjects` page.

### 2. Materialize explicit `SPA/SPS` specialization lanes

Required outcome:

- ATLAS must expose each active specialization track individually.
- These lanes must reflect the active programs/signals coming from EnrollPro.
- Do not leave a single coarse umbrella subject row as the only schedulable representation.

Examples of what the system must make possible:

- `SPA - Visual Arts`
- `SPA - Music`
- `SPA - Theater`
- `SPS - Athletics`
- or whatever the actual active EnrollPro-driven tracks are

The exact names should be derived from the real available specialization source contract, not hardcoded.

### 3. Restore or adapt cohort-style breakout scheduling for `SPA/SPS`

Required outcome:

- A section can split into concurrent specialization subgroups.
- Those subgroups must be schedulable as concurrent instructional lanes.
- The system must detect teacher collisions across those concurrent subgroup lanes.
- The system must not treat the section as staying intact when the real instruction splits.

Collision definition for this pass:

- A collision is strictly defined as scheduling the same `teacher_id` to two different concurrent specialization subgroup lanes at the same time.
- Do **not** fail schedule generation only because multiple specialization subgroup lanes:
  - share the same `room_id`
  - inherit the same homeroom
  - or do not yet have a dedicated breakout room assignment

Room-sharing or absent breakout-room assignment is **not** the hard failure signal in this pass.

If an older cohort primitive exists and is still usable, adapt it.
If it is stale only for old TLE logic, revive the concept specifically for `SPA/SPS` breakout dissemination rather than for the obsolete TLE contract.
Do **not** blindly resurrect stale TLE-era cohort assumptions. Reuse the pattern only if it can be isolated cleanly from the obsolete MATATAG TLE contract.

### 4. Make Teaching Load specialization-honest

Required outcome:

- Teaching Load must show explicit specialization rows for `SPA/SPS` breakout assignments.
- A teacher must see what specialization lane they are actually teaching.
- Load math must still be concurrent-honest for those lanes.
- The page must stop implying that one generic `SPA_SPEC` block is the whole truth.

Implementation preference:

- Prefer reusing the current persisted specialization-aware assignment fields and related ownership contract where possible before inventing an entirely separate lane model.
- Only introduce a new persisted lane shape if the current specialization fields cannot represent the breakout truth without ambiguity.

### 5. Make section-facing views specialization-honest

Required outcome:

- section details must show the actual breakout specialization lanes carried by that section
- not just a generic umbrella row

### 6. Make published/downstream APIs ready for sister systems

Required outcome:

- the public/teaching-load-facing contracts must expose the explicit specialization lanes
- sister systems must be able to tell which specialization lanes are active and how they are staffed

Update the relevant API docs in the same pass.

### 7. Push toward the homeroom-centric model

Required outcome:

- preserve the principle that sections are docked to a homeroom
- treat teacher routing and teacher availability as the primary optimization concern for these breakouts
- do not reintroduce strict per-breakout hard room-collision solving as the main blocker in this pass

This should affect system assumptions and any user-facing wording that still implies ATLAS is trying to room every specialization breakout as a hard NP-hard rooming problem.

---

## Required Documentation Updates

Update in the same pass:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `ATLAS-PUBLIC-API.md`
- `api/ATLAS-PUBLIC-API.md`
- any existing teaching-load / section-first API contract docs touched by this change
- `docs/verification/evidence-log.md`

The runtime/source map must clearly state:

- `SPA/SPS` now use explicit breakout specialization lanes
- `MAPEH` is the default staffing pool
- breakout lanes are concurrent teacher-demand truth
- homeroom-centric assumptions still apply

---

## Tailnet Verification Requirements

You must test directly on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

You must prove all of the following:

1. `SPA/SPS` no longer appear only as misleading coarse umbrella staffing truth.
2. Active specialization tracks are exposed individually in the affected UI/API surfaces.
3. `MAPEH` teachers are eligible by default without the old approval-gate assumption.
4. Teaching Load can show explicit specialization-lane staffing.
5. Section-facing detail surfaces reflect the breakout truth.
6. The system preserves teacher-concurrency truth for concurrent subgroup instruction.
7. Subject sync no longer materializes `SPA_SPEC` / `SPS_SPEC` under fake `SPA` / `SPS` department ownership and instead normalizes them to `MAPEH`.
8. Live preview no longer reports `SPECIAL_PROGRAM_APPROVAL_REQUIRED` or a lingering `specialProgramApprovalCandidates` queue for ordinary `MAPEH` staffing.

If the first implementation still leaves `SPA/SPS` coarse or misleading, keep fixing in the same pass.

---

## Build And Test Requirements

Run and record:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- any directly relevant Teaching Load / faculty assignment regression tests touched by this pass

If you add new contract-sensitive logic, add or update regression coverage for it.

---

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files changed
- what old `SPA/SPS` coarse model was replaced
- how active specialization tracks are now exposed
- how `MAPEH` default eligibility is now handled
- what UI/API surfaces now reflect breakout truth
- Tailnet verification results
- final verdict: `GO` or `NO-GO`

Strict logging rule:

- append only
- do not overwrite, truncate, replace, or "rewrite for cleanliness" any prior evidence entries
- preserve all earlier dated entries exactly as they exist unless the user explicitly asks for evidence-log repair
- if the file contains malformed prior text, append a new dated correction entry instead of rewriting the file

Do not claim `GO` unless the old misleading umbrella-lane behavior is materially gone.
