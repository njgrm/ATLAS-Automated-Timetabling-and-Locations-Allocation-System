# Copilot Execution Prompt: Phase 3 Teaching Load Closure Read/Write, STE Contract, And MAPEH Redistribution One-Shot

## Mission

Close the remaining high-severity Teaching Load blockers so the workspace becomes operationally trustworthy before the team moves back to the timetabling stream.

This pass must fix the current live problems together, not as isolated patches:

- Teaching Load still falls into false read-only mode and blocks normal CRUD
- `Section Allocation` still overstates some section demand, especially STE rows like `13 / 17`
- `SPA/SPS` normalization landed, but `MAPEH` utilization is still not acceptable because multiple active `MAPEH` teachers remain at `0` load
- section-first assignment/save/swap behavior still depends too much on teacher-centric assumptions

This is now a closure pass. Do not treat it as another cosmetic or exploratory iteration.

---

## Outcome Standard

This pass is only `GO` if all of the following are true at the end:

1. Teaching Load is writable under the verified active year and warning-only integrity state.
2. STE section counts in `Section Allocation` match the real grade-scoped coverage contract instead of broad local demand math.
3. `Section Allocation` behaves as a real saveable workspace.
4. `MAPEH` special-program utilization is materially redistributed and no active eligible `MAPEH` teachers remain at `0` load.
5. The page stops misrepresenting special-program breakout truth while staying aligned to the real coverage contract.

If any active eligible `MAPEH` teachers still remain at `0` load, do **not** declare `GO` unless you explicitly prove that:

- they are not actually eligible for any current live coverage-contract demand
- or they should be reclassified out of active scheduling

You must name them and explain why.

---

## Required References

Read and follow before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect at minimum:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/SectionInspector.tsx`
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/subject.service.ts`
- any section-summary / assignment-summary contracts touched by this fix

---

## Current Verified Reality

Treat these as already verified facts:

1. The old persisted STE grade-scope leak is largely repaired at the saved ownership level.
2. The current `13 / 17` STE symptom is still happening in `Section Allocation` because the page rebuilds per-section subject demand too broadly in the client.
3. Teaching Load still enters false read-only mode because frontend writability is still gated through bootstrap/source-state logic instead of the real runtime write contract.
4. `SPA_SPEC` / `SPS_SPEC` owner-department normalization to `MAPEH` has landed.
5. The old `SPECIAL_PROGRAM_APPROVAL_REQUIRED` path has been removed for ordinary MAPEH staffing.
6. But `MAPEH` redistribution is still incomplete:
   - active `MAPEH` faculty count is still non-trivial
   - multiple active `MAPEH` teachers remain at `0` load
   - `SPS_SPEC` is still concentrated in too few teachers
7. Current saved specialization ownership truth is still too coarse to satisfy the operator goal if it leaves idle MAPEH rows while only a few teachers carry all special-program work.

---

## Hard Scope

You may touch both frontend and backend as needed for this closure pass.

Likely files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/components/faculty-assignments/*`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/subject.service.ts`
- any directly relevant assignment or section-summary route/service contract
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Do not expand scope into unrelated timetabling generation work in this pass.

---

## Non-Negotiable Product Decisions

### 1. Teaching Load should be writable under healthy runtime

If the runtime year is verified, integrity is warning-only or clean, and the backend accepts writes, the page must allow CRUD.

Do not keep using a brittle frontend-only source badge or warm-load bootstrap state as the thing that disables the page.

### 2. `Section Allocation` must use the exact real coverage contract

If a subject-section pair is not part of the real saved coverage contract, it must not appear as active staffing demand in `Section Allocation`.

Do not show broad program-compatible rows and pretend they are unstaffed work.

### 3. STE counts must be grade-scoped and honest

If a subject does not apply to that grade, it must not contribute to the section’s total-count denominator in `Section Allocation`.

The specific live symptom `13 / 17` for STE is not acceptable if the real section contract is smaller.

### 4. `MAPEH` zero-load rows are not acceptable as a steady state

This pass must aggressively reduce current zero-load `MAPEH` rows through valid redistribution and breakout-lane ownership.

Do **not** solve this by inventing fake demand outside the real coverage contract.

You must instead:

- use valid current `SPA/SPS` specialization demand
- use explicit specialization ownership truth
- spread eligible work across the real MAPEH pool where valid

If any active eligible `MAPEH` teachers remain at `0`, the pass is not done.

### 5. `Section Allocation` must be an actual operator workspace

It must support:

- assignment
- swap
- visible draft state
- visible save
- trustworthy section-side inspection

Do not leave it as a partial view over hidden teacher-driven state.

---

## Required Fixes

### 1. Remove false read-only mode and restore CRUD

Required outcome:

- `Teaching Load` no longer becomes read-only in the current verified active year when integrity is warning-only
- teacher-mode and section-mode assignment changes are both allowed
- save/reset/draft controls become usable again under the real runtime contract

Implementation direction:

- make writability depend on actual verified runtime/year/integrity/backend reachability
- not on a narrow `dataSource === 'live'` style assumption

### 2. Fix `Section Allocation` demand shaping to the true contract

Required outcome:

- the section rows derive from the same real coverage contract as the headline coverage totals
- section totals use grade-scoped and program-scoped truth
- STE counts no longer inflate from unrelated scoped subjects

Do not rebuild section subject totals from a broader subject catalog filter if that causes denominator drift.

### 3. Make section mode save/swap behavior fully real

Required outcome:

- section-mode assignments create clear draft state
- section-mode users can save from section mode directly
- swap updates both losing and gaining owners immediately in visible draft state
- section-side panel and row state stay consistent after swap

### 4. Finish MAPEH redistribution for current special-program demand

Required outcome:

- active eligible `MAPEH` teachers should no longer sit at `0` load while special-program work is concentrated in only a few rows
- `SPS_SPEC` distribution must stop being effectively owned by only a tiny subset if valid candidates exist
- `SPA_SPEC` / `SPS_SPEC` utilization should better reflect the available MAPEH pool and persisted specialization signals

You must use the real live contract, not a fake balancing story.

Explicitly verify and improve:

- zero-load `MAPEH` count
- specialization-row distribution breadth
- `SPA_SPEC` teacher spread
- `SPS_SPEC` teacher spread

### 5. Keep the special-program model honest

Required outcome:

- do not regress owner-department normalization away from `MAPEH`
- do not reintroduce approval-gated ordinary MAPEH staffing
- do not regress explicit specialization identity already present in saved ownership rows

### 6. Preserve section/teacher inspector honesty

Required outcome:

- teacher mode keeps teacher-centric detail
- section mode keeps section-centric detail
- candidate rows in section mode clearly show current ownership and meaningful load signals

---

## Required Verification

You must verify directly against the current live Tailnet environment and the active ATLAS data.

Use:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

You must prove all of the following:

1. Teaching Load is writable again in the current verified school year.
2. Draft changes can be created and saved in `By Teacher`.
3. Draft changes can be created and saved in `Section Allocation`.
4. An STE section no longer shows inflated counts like `13 / 17` if the real grade-scoped contract is smaller.
5. `Section Allocation` only shows rows from the real coverage contract.
6. Zero-load active eligible `MAPEH` teachers are eliminated or explicitly proven impossible and reclassified/documented.
7. `SPA_SPEC` and `SPS_SPEC` remain normalized under `MAPEH`.
8. `SPS_SPEC` distribution is no longer unjustifiably concentrated if valid MAPEH candidates exist.
9. Swap behavior visibly updates both source and destination ownership before save, and persists correctly after save.

Where possible, include before/after evidence for:

- zero-load `MAPEH` teacher count
- `SPA_SPEC` and `SPS_SPEC` teacher breadth
- one STE section total-count example

---

## Build And Test Requirements

Run and record:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- any directly relevant faculty-assignment / teaching-load regression tests touched by this pass

Add or update regression tests if you change contract-sensitive logic for:

- writability gating
- section-demand shaping
- MAPEH redistribution
- swap/save behavior

---

## Documentation Updates

Update in the same pass:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Evidence-log rule:

- append only
- do not overwrite or rewrite prior entries

The evidence entry must state explicitly:

- whether Teaching Load CRUD is restored
- whether STE section-count inflation is removed
- how many active `MAPEH` teachers were at `0` before
- how many remain after the pass
- whether any remaining zero-load rows are justified and why

---

## Completion Rule

Do not stop at partial cleanup.

This pass should only end as `GO` if Teaching Load is operational enough to stop blocking the team from returning to the timetabling stream.

If one of the three major closure targets is still open:

- false read-only behavior
- STE section-count inflation
- zero-load `MAPEH` redistribution

then keep fixing in the same pass.
