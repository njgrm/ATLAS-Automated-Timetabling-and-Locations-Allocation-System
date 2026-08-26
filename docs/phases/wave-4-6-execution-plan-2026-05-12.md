# Wave 4.6 Execution Plan: Accurate Teaching Load, Specialization Coverage, and Full-Room Generation

**Date:** 2026-05-12
**Status:** Draft for execution
**Goal:** Replace inflated or synthetic teaching-load seeding with EnrollPro-sourced faculty data, complete specialization coverage, seed sufficient buildings and rooms, and rerun generation until the draft reaches zero unassigned classes or exposes the remaining root cause.

## Objective

This wave will make the seeding layer reflect the real faculty, adviser, subject, and room inventory used by generation. The end state is a schedule run where teaching-load assignments are realistic, HG is mapped from advisers, specialization options are complete enough for teachers to appear as valid load-assignment choices, and the room seed can support all sessions.

The operational target for scheduling is 142 faculty. The upstream EnrollPro mirror may still return 145 faculty for traceability, but the 3 ASDF test records shall be excluded from operational teaching-load seeding, timetabling, and publish metrics.

## Previous Pass Baseline (2026-05-12 Run — Learn From Mistakes)

The metrics below are from the first Wave 4.6 execution pass on the same day. **This execution pass must produce measurable improvement on every line.**

| Metric | Previous Pass | Target This Pass |
|--------|--------------|------------------|
| Faculty in mirror | 145 (incl. 3 ASDF) | 145 in mirror, 142 operational |
| Faculty without assignments | 145 → 89 (post-repair) → 0 (post-ASDF filter) | 0 |
| FacultySubject rows seeded | 0 → 183 → 269 | ≥ 300 (broader specialization coverage) |
| Unassigned teaching-load pairs | 1863 → 1135 → 1049 | < 200 |
| Generation assigned | 1160 | > 1160 |
| Generation unassigned | 1752 | < 1752 (target: 0) |
| Hard violations | 497 | < 497 (target: 0) |
| Policy blocked | 236251 | Track; do not increase |
| Generation runtime | 183845 ms (FAIL > 60 000 ms) | < 60 000 ms |
| Precision test | 14/14 PASS | 14/14 PASS (no regression) |

### What went wrong in the previous pass (root causes)

1. **schoolYearId hardcoded as `1`** — commands used `--schoolYearId=1` without verifying that EnrollPro's active school year resolves to the same integer. If EnrollPro uses a different ID, seeds target the wrong school year. **Fix: fetch the active school year from EnrollPro live before every seed command.**
2. **Specialization-aware matching added late** — the first seeding run produced 0 assignments because department fields were null. The service had to be patched mid-pass, forcing two extra reseed cycles.
3. **ASDF quarantine placed in wrong layer** — the filter was added to `faculty-adapter.ts` (sync layer) instead of the seeding layer, meaning only 142 faculty were ever mirrored instead of the correct 145. This must be corrected so all 145 are in the mirror but 3 are excluded only from assignment seeding.
4. **Generation runtime 3× over budget** — 183 845 ms indicates the generation algorithm is exploring too much search space. Root cause must be profiled in this pass.

## Scope

### In Scope
- Recompute teaching load from EnrollPro-sourced faculty and section data.
- Enforce realistic load distribution with a target of 120-130 faculty carrying 2-4 subjects each.
- Cap teaching loads to the 30-40 hour weekly range.
- Map class advisers to HG assignments from the EnrollPro advisory source.
- Expand specialization mapping so all existing subjects have at least one mapped specialization.
- Seed or verify buildings and rooms from the realistic campus seed so generation has enough coverage for all sessions.
- Rerun generation and isolate any persistent unassigned sections with a root-cause audit.
- Log each struggle, fallback, and mismatch encountered during execution.

### Out of Scope
- Smart subject suggestion UI.
- New generation heuristics unrelated to seeding and validation.
- Cosmetic timetable changes.
- Manual schedule editing workflow changes.
- Public publish or dissemination work beyond verifying the generated draft.

## Source-of-Truth Rules

- Faculty data shall come from EnrollPro-fetched mirrors and snapshots, not from synthetic seeding data, when assigning teaching load.
- Section adviser data shall come from the EnrollPro advisory source used by the current seed pipeline.
- Subject coverage and specialization options shall be reconciled against the live subject list in the ATLAS database.
- Room availability shall be validated against the realistic campus seed file before any generation retry.
- The upstream mirror shall remain unchanged for traceability even when operational records are excluded from assignment selection.
- The funnel-hosted client and server shall read the same ATLAS database and the same EnrollPro API base before any seeded execution is accepted.
- **`schoolYearId` shall never be hardcoded.** Before any seed or generation command, the active school year must be fetched live from `GET /api/integration/v1/school-year` on the active EnrollPro host, and the returned `data.id` used in all subsequent commands.
- Department data for faculty matching shall be sourced from `GET /api/integration/v1/faculty` fields `departmentCode`, `departmentName`, and `departmentId` (no separate departments endpoint is currently exposed under integration v1).

## Execution Order

### Step 0: Resolve active schoolYearId from EnrollPro (MANDATORY before any seed command)
- Call `GET /api/integration/v1/school-year` on `http://dev-jegs.buru-degree.ts.net:5002/api`.
- Read `data.id` from the response and note its integer value.
- Use this resolved ID as `--schoolYearId=<resolved>` in all subsequent seed and generation commands.
- **Do not proceed to Step 1 until this value is confirmed.** Document the resolved ID at the top of the execution log.

### Step 1: Verify current inputs
- Confirm the EnrollPro-sourced faculty mirror set is the active input for load seeding.
- Confirm the current subject list and section snapshots are in sync.
- Confirm the realistic campus seed file is the authoritative room source for the retry.
- Confirm the funnel-hosted client is using the same runtime base URLs as the ATLAS server.
- Confirm the JWT used for timetabling is present in the browser session and is forwarded on every protected request.
- Confirm the resolved `schoolYearId` from Step 0 matches the school year shown in the ATLAS client UI.

### Step 2: Fix specialization coverage
- Expand specialization mapping until every subject in the active subject list has at least one mapped specialization.
- Verify that each subject can appear as an enabled option in load assignment flows.
- Record any subject whose mapping must remain a fallback and why.
- Treat `SpecializationAlias` as the canonical mapping source for advanced, specialty, research, ICT, journalism, and arts-like tracks.
- Record a verification summary showing matched specializations, fallback-only matches, and still-unmapped subjects.

### Step 3: Seed teaching load accurately
- Build faculty load from EnrollPro-fetched faculty records and current section demand.
- Assign subjects by specialization match first, then remaining capacity.
- Keep most faculty in the 2-4 subject band.
- Keep all teaching loads within the 30-40 hour weekly band.
- Prevent overlapping assignments for the same faculty and subject.
- Exclude the 3 ASDF traceability records from assignment selection while keeping them in the upstream mirror.
- Ensure every operational faculty member receives at least one assignment row after seeding.

### Step 4: Map advisers to HG
- Use the EnrollPro adviser-to-section relation as the source of truth.
- Create HG assignments for advisers only.
- Preserve other subject teaching assignments for advisers when capacity allows.
- Verify adviser-linked HG coverage in the post-seed diagnostic output.

### Step 5: Seed and verify buildings
- Use the existing realistic campus seed file as the building and room seed source.
- Verify each grade-level wing and specialized facility has enough room inventory for the current section demand.
- Add or correct rooms only if the realistic seed is missing coverage required by generation.
- Confirm room coverage is sufficient for the computed section-subject session count before rerunning generation.

### Step 6: Rerun generation
- Run a fresh generation pass after the seed updates.
- Check the draft for hard violations, unassigned classes, and any faculty overload overlap.
- If unassigned classes remain, isolate them by subject, room type, adviser status, and grade level.
- Capture the benchmark runtime, assigned count, unassigned count, hard violations, and policy-blocked count.

### Step 7: Root-cause logging
- Document each mismatch, missing mapping, room shortage, or load conflict.
- Distinguish between data-source issues, seeding issues, and generation-rule issues.
- Preserve the final evidence trail in the phase docs and progress log.
- Log whether each remaining issue belongs to upstream data, local seeding, or funnel/auth transport.

## Implementation Checklist

### Source Alignment
- [ ] Verify `ENROLLPRO_API` on the funnel-hosted client and server points to the same Tailscale EnrollPro base.
- [ ] Verify `DATABASE_URL` on the funnel-hosted client/server pair resolves to the intended ATLAS database.
- [ ] **Fetch active `schoolYearId` live from `GET /api/integration/v1/school-year` before any seed command.** Record `data.id`.
- [ ] Use the resolved `schoolYearId` in `--schoolYearId=<resolved>` for every seed and benchmark command — never hardcode `1`.
- [ ] Confirm the active school year used by the ATLAS client UI matches the resolved ID.
- [ ] Confirm the browser session used for timetabling is carrying the JWT and forwarding it as `Authorization: Bearer ...`.

### Faculty Mirror and Seeding
- [ ] Remove the ASDF quarantine filter from `faculty-adapter.ts` so all 145 faculty are synced to the mirror.
- [ ] Add ASDF exclusion at the seeding layer (`seeded-teaching-load.service.ts`) so the 3 ASDF records are skipped only during assignment building.
- [ ] Treat 142 faculty as the operational scheduling target.
- [ ] Re-run EnrollPro-source sync from dev-jegs using the resolved `schoolYearId` from Step 0.
- [ ] Rebuild teaching-load rows from the synced faculty mirror.
- [ ] Confirm no operational faculty remain without assignments after seeding.
- [ ] Confirm improvement vs previous pass: seeded rows > 269, unassigned pairs < 1049.

### Specialization Mapping
- [ ] Expand canonical mapping for advanced, specialty, research, ICT, journalism, and arts-like tracks.
- [ ] Use `SpecializationAlias` as the canonical source for subject qualification.
- [ ] Use EnrollPro faculty `departmentCode`/`departmentName` fields from `/api/integration/v1/faculty` as fallback match dimensions when specialization is null.
- [ ] Add a verification pass that reports matched, fallback-only, and unmapped specializations.
- [ ] Confirm every active subject has at least one viable specialization mapping.

### Timetabling Auth and UI
- [ ] Trace the request path that returns `NO_TOKEN`.
- [ ] Confirm the timetabling page uses the same signed-in browser session as the rest of the funnel.
- [ ] Confirm the proxy/funnel layer preserves the `Authorization` header.
- [ ] Add a UI error state for missing token, expired token, and wrong environment/session.
- [ ] Add or update the source badge in the timetabling/teaching-load UI.

### Generation Validation
- [ ] Confirm session count equals section demand times subject coverage for the active dataset.
- [ ] Rerun generation after the cleaned seed using the resolved `schoolYearId`.
- [ ] Capture assigned, unassigned, hard-violation, and policy-blocked counts.
- [ ] Re-run the benchmark and record runtime against the 60-second target.
- [ ] Confirm improvement vs previous pass: assigned > 1160, unassigned < 1752, hard violations < 497, runtime < 183845ms.
- [ ] If runtime still exceeds 60 000 ms, profile the generation loop and document the bottleneck.
- [ ] If unassigned sessions remain, document the root cause and classify it as upstream data, seeding, or generation logic.

### Evidence and Traceability
- [ ] Update `docs/verification/evidence-log.md` with the seed, auth, and benchmark outcomes.
- [ ] Update the phase progress note after each major step.
- [ ] Record the exact upstream host and auth path used for the authoritative run.

## Expected Outcomes

- 120-130 faculty with realistic 2-4 subject loads.
- All teaching loads within 30-40h/week.
- 50-60 HG assignments, limited to advisers.
- 0 overlapping assignments for the same faculty and subject.
- All existing subjects accounted for by specialization mapping.
- Sufficient room/building seed coverage for all sessions.
- A generation run that reaches 0 unassigned classes, or a documented root cause if the target is not yet reachable.

## Verification Gates

### Teaching Load Gate
- The load distribution shall show most faculty in the 2-4 subject range.
- No faculty shall exceed the weekly cap.
- No faculty shall receive overlapping same-subject assignments.

### Specialization Gate
- Every active subject shall have at least one specialization mapping.
- Assignment screens shall expose each subject as an enabled choice when a matching faculty specialization exists.

### Adviser Gate
- Every adviser-linked section shall produce an HG assignment.
- HG assignments shall remain tied to adviser data from EnrollPro.

### Building Gate
- The realistic campus seed shall provide enough room inventory for all sessions in the retry.
- Any shortage shall be logged with the missing room type and grade level.

### Generation Gate
- The retry shall be considered successful only if unassigned classes reach 0.
- If unassigned classes persist, the remaining blockers shall be grouped by root cause and documented.

## Logging Plan

- Add a short progress note after each major step in the phase docs.
- Record any failed assumption before changing implementation.
- Log the exact source of each fix: EnrollPro mirror, advisory data, specialization map, or realistic campus seed.
- Capture the final before/after metrics for load distribution, adviser coverage, room coverage, and generation unassigned count.

## Open Questions

- Which specific EnrollPro faculty snapshot should be treated as the canonical input if multiple cached copies exist?
A: The one that is being fetched right now through tailscale
- Whether any subject mappings should remain fallback-only if no exact EnrollPro specialization label exists.
A: I can confirmatively say that all subjects can be mapped to at least one specialization, so no fallback-only mappings are needed.
- Whether a remaining unassigned class should block the wave or move to a documented follow-up if it is caused by a hard data gap.
A: If the unassigned class is caused by a hard data gap that cannot be fixed within the scope of this wave, it should be documented as a follow-up issue with a clear description of the gap and its impact on scheduling. The wave can be considered successful if all other targets are met and the remaining unassigned class is transparently logged for future resolution.