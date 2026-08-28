# Copilot Execution Prompt: Phase 3 Timetable Swap Regression Repair One-Shot

## Mission

Execute a narrow timetable interaction-repair pass focused on swap behavior.

This pass exists because swap behavior in both:

- post-generation `/timetable`
- pre-generation draft workspace

has regressed from the previously working flow.

Current observed failures:

1. in post-timetable, swap controls now feel non-existent because the swap modal does not reliably appear
2. in pre-generation, dragging into an occupied slot often produces overlap/double-booking behavior instead of opening the swap flow
3. fresh pre-generation sessions appear to be treated like normal move conflicts unless they already resolve as `draft-placement-*` entries

Your objectives:

1. restore reliable swap modal entry points in post-timetable
2. restore reliable occupied-slot swap routing in pre-generation
3. prevent occupied-slot interactions from silently degrading into ordinary overlap/double-book conflicts when swap should be offered first
4. add regression coverage for both flows

---

## Scope

### In Scope

- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx`
- `atlas-client/src/components/timetable/RightPanel.tsx` only if needed for an explicit swap action entry point
- `atlas-client/src/components/timetable/CenterWorkspace.tsx` only if needed for pre-gen interaction parity
- targeted tests for swap entry and occupied-slot behavior
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad timetable UI redesign
- new scheduling algorithms
- G9 placement, capacity, or special-program plotting logic unless directly needed to validate swap routing

---

## Current Verified Problems

Treat these as already verified from source audit:

### 1. Post-timetable swap still exists in code, but its trigger path is too narrow

- `openRegularSwapPrompt(...)` still exists
- the regular swap dialog still exists
- but it is only reliably opened from narrow occupied-cell drag/drop branches in:
  - `ScheduleReviewWorkspace.tsx`

Implication:

- if those branches are missed, the user gets normal conflict behavior instead of any visible swap path
- this makes swap look removed even though the modal code is still present

### 2. Pre-generation swap currently depends too heavily on `draftPlacement` identity

- in pre-generation, generated entries are only rerouted to pre-gen placement handling if `entryId` parses as `draft-placement-*`
- fresh pre-generation interactions can therefore miss the swap path and fall through into ordinary move/conflict handling

Implication:

- the user can enter pre-generation and immediately get overlap/double-book behavior instead of swap even though the workspace should still behave as a draft-edit surface

### 3. Occupied-slot detection is scoped too narrowly

- current occupied-slot swap detection is scoped to same-pivot entity filtering (`section`, `faculty`, or `room`) in the active view mode

Implication:

- real visible occupied-slot conflicts can fail to open swap if they do not match that narrow filtered branch exactly

### 4. Once swap is missed, the UI falls back to normal overlap/double-book reasoning

- conflict-map and preview logic still produce ordinary hard-conflict messaging like:
  - faculty overlap
  - room occupied
  - section occupied

Implication:

- swap-worthy interactions degrade into “blocked move” behavior instead of offering the operator a swap workflow first

---

## Required Product Decisions

Follow these decisions exactly:

### 1. Occupied-slot interaction should prefer swap before generic conflict handling

If an operator drags or keyboard-places an entry into an occupied slot and the action is logically swappable, the system should offer swap first.

It must not immediately degrade into generic overlap handling unless swap is truly impossible.

### 2. Pre-generation is a draft-edit surface and must not depend on stale identity shape

The pre-generation workspace must treat entries consistently as draft-editable even when they originate from freshly entered/generated context.

Do not require `draft-placement-*` identity as the only way to reach swap-safe behavior.

### 3. Post-timetable needs a visible, reliable swap path

Drag/drop alone is not sufficient if the branch is fragile.

This pass should either:

- repair drag/drop so swap opens reliably
- or add an explicit swap action entry from the manual-edit/right-panel path

Prefer both if the code remains clear and scoped.

### 4. A missed swap must not silently become double-booking

If swap routing fails, the user should see an honest message or fallback action.

Do not let the system behave like “drop succeeded into overlap” or “hard conflict only” when the correct operator intent was a swap.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly before editing:

- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx`
- any related timetable interaction tests

---

## Required Outcomes

### 1. Restore reliable regular swap modal entry in post-timetable

Required result:

- dragging an entry into an occupied slot in post-timetable reliably opens the regular swap dialog when appropriate
- swap should not feel “missing” due to narrow branch conditions
- if needed, an explicit swap action is available from the current manual-edit/right-panel workflow

### 2. Restore reliable occupied-slot swap behavior in pre-generation

Required result:

- pre-generation occupied-slot interactions route through swap logic even when the source entry does not already carry `draft-placement-*` identity
- fresh pre-gen workspace use no longer degrades into overlap/double-book handling on first interactions

### 3. Keep overlap reasoning as secondary, not primary, for swappable interactions

Required result:

- overlap/double-book previews only dominate when swap is actually invalid or impossible
- swappable interactions offer swap before generic hard-conflict fallback

### 4. Preserve existing preview/validation rigor

Required result:

- swap preview still evaluates hard and soft conflicts honestly
- no fake swap approval
- no bypass of legitimate hard blockers

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-client run build`
2. add/update targeted regression coverage for:
   - post-timetable occupied-slot drag opens regular swap
   - pre-generation occupied-slot interaction opens swap even for fresh entries
   - missed-swap paths do not silently degrade into double-book commit behavior

### Live checks

Test directly on Tailnet:

1. post-timetable:
   - drag an entry into an occupied slot
   - verify the regular swap dialog appears
2. pre-generation:
   - begin from a fresh pre-draft state
   - drag into an occupied slot
   - verify swap behavior triggers instead of direct overlap/double-book handling
3. verify keyboard placement path also honors swap where applicable
4. verify swap preview still shows honest conflict details and only enables confirm when valid

### Evidence requirements

Document:

- exact prior failure path reproduced before the fix
- what branch/identity condition caused swap to be skipped
- whether an explicit swap action was added
- before/after behavior in post-timetable
- before/after behavior in pre-generation
- final verdict: `GO` or `NO-GO`

---

## Documentation Updates

Update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Append only for `evidence-log.md`.

---

## GO / NO-GO Rule

Declare `GO` only if:

1. post-timetable occupied-slot interactions reliably open swap
2. pre-generation occupied-slot interactions reliably open swap
3. swap no longer silently regresses into plain overlap/double-book behavior for valid swap scenarios
4. regression coverage exists for both interaction paths

Otherwise declare `NO-GO` with the exact remaining blocker set.
