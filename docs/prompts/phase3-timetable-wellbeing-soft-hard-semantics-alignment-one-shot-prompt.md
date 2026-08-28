# Copilot Execution Prompt: Phase 3 Timetable Wellbeing Soft/Hard Semantics Alignment One-Shot

## Mission

Close the remaining live timetable blocker honestly.

Do not use inflated scheduling-policy values as the primary escape hatch.

This pass exists because the live Tailnet generator already proved that `0 unassigned` is possible, but that closure was achieved under temporarily widened faculty-day controls:

- `maxTeachingMinutesPerDay=600`
- `maxConsecutiveTeachingMinutesBeforeBreak=600`
- `minBreakMinutesAfterConsecutiveBlock=5`

The current persisted live policy has reverted to more realistic values:

- `maxTeachingMinutesPerDay=480`
- `maxConsecutiveTeachingMinutesBeforeBreak=120`
- `minBreakMinutesAfterConsecutiveBlock=15`

and the residual blocker cluster returned immediately in the latest live run.

The goal of this pass is to make constructor placement honor the system's intended soft-vs-hard wellbeing semantics consistently so ATLAS can reach `0 unassigned` under realistic policy values, or else surface the exact remaining true hard blockers honestly.

---

## Scope

### In Scope

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- targeted regression tests for constructor + validator policy semantics
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad timetable UX redesign
- published schedule UI
- teaching-load workflow changes
- room inventory reseed
- reintroducing flexible subject assignment
- changing subject minute contracts to cheat closure

Do not solve this by keeping `600 / 600 / 5` as the new normal unless live evidence proves the stakeholder contract truly requires it.

---

## Current Verified Live Findings

Treat the following as already verified on live Tailnet for `(schoolId=1, schoolYearId=55)`.

### 1. The historical zero-unassigned run is real but not the current live state

- `runId=121` finished with:
  - `assigned=3455`
  - `unassigned=0`
  - `hardViolationCount=0`
  - `policyBlockedCount=0`
- `runId=124` is the current latest completed run and has:
  - `assigned=3425`
  - `unassigned=30`
  - `hardViolationCount=30`
  - `policyBlockedCount=30`

So the system regressed after the historical closure run.

### 2. The regression lines up exactly with policy reversion

Live evidence shows:

- `runId=121` closure relied on:
  - `maxTeachingMinutesPerDay=600`
  - `maxConsecutiveTeachingMinutesBeforeBreak=600`
  - `minBreakMinutesAfterConsecutiveBlock=5`
- current persisted live policy is now:
  - `maxTeachingMinutesPerDay=480`
  - `maxConsecutiveTeachingMinutesBeforeBreak=120`
  - `minBreakMinutesAfterConsecutiveBlock=15`

The policy row update timestamp immediately precedes the regressed rerun.

### 3. The remaining blockers are not room-hardness anymore

Latest live run `124` violations show:

- `UNASSIGNED_SECTION=30` as `HARD`
- `ROOM_CAPACITY_EXCEEDED=480` as `SOFT`
- `ROOM_TYPE_MISMATCH=410` as `SOFT`

So the remaining blocker is not room-capacity hardness.

### 4. The remaining blocker cluster is a faculty-slot feasibility lane

All remaining unassigned rows are currently concentrated in six section-subject lanes, five sessions each:

- `sectionId=2721`, `subjectId=7 (ESP)`
- `sectionId=2764`, `subjectId=7 (ESP)`
- `sectionId=2969`, `subjectId=7 (ESP)`
- `sectionId=2978`, `subjectId=7 (ESP)`
- `sectionId=2981`, `subjectId=7 (ESP)`
- `sectionId=2971`, `subjectId=3079 (DEVL_READING)`

Current unassigned reason signature is consistently:

- `reason = NO_AVAILABLE_SLOT`
- `roomAssignmentReason = FACULTY_SLOT_UNAVAILABLE`
- `homeRoomFallbackCause = POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`

### 5. The current fallback reason is stale or overstated

The latest run summary also shows:

- `shiftWindowPolicy = DISABLED`
- `configuredShiftWindowCount = 0`

So the current `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` label is no longer an honest explanation for these rows.

### 6. The system currently has a semantic mismatch between constructor and validator

Live code-path audit already shows:

- the constructor rejects placements when:
  - daily faculty minutes would exceed `policy.maxTeachingMinutesPerDay`
  - consecutive teaching would exceed `policy.maxConsecutiveTeachingMinutesBeforeBreak`
- the validator treats break/consecutive wellbeing through configurable review semantics and only hardens some checks conditionally

This means ATLAS is still using review-level wellbeing rules as hard placement gates during generation.

That is the main defect to repair.

---

## Required Product Decisions

Follow these decisions exactly.

### 1. Real hard constraints remain hard

Do not weaken:

- faculty double-booking
- section double-booking
- room double-booking
- true room/shared-facility collisions
- subject qualification authority

### 2. Review-level wellbeing constraints must not silently act as constructor hard blockers

If a wellbeing rule is configured as review-level or soft in the active policy/validator contract, the constructor shall not strand otherwise-placeable rows solely because of that rule.

The generator may still:

- score such placements worse
- emit explicit soft violations
- report them honestly for review

But it must not leave those rows unassigned if a valid time/teacher/room placement exists.

### 3. The realistic active policy is the target baseline

Target closure under the current realistic values:

- `maxTeachingMinutesPerDay=480`
- `maxConsecutiveTeachingMinutesBeforeBreak=120`
- `minBreakMinutesAfterConsecutiveBlock=15`
- `allowFlexibleSubjectAssignment=false`

Do not declare success using relaxed `600 / 600 / 5` unless you also prove why the realistic baseline is mathematically impossible.

### 4. Diagnostics must become honest

If the real failure is:

- no qualified teacher slot
- daily hard max
- consecutive-break review pressure
- another concrete cause

then the emitted reason must say that.

Do not keep using `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` as a generic bucket when shift windows are disabled.

---

## Required Changes

### 1. Align constructor placement gating with configured hard-vs-soft semantics

In the generation path:

- stop treating review-level wellbeing thresholds as unconditional hard placement blockers
- preserve true hard guards
- allow placement to continue where the only contradiction is a soft/review wellbeing rule

The constructor and validator must use the same semantic contract.

### 2. Separate true hard daily limits from soft review thresholds cleanly

If needed, introduce explicit distinction between:

- review-target thresholds
- actual hard placement ceilings

Do this cleanly and transparently.

Do not hide the behavior behind accidental numeric inflation.

### 3. Correct failure taxonomy for residual lanes

Required outcome:

- the six residual lanes no longer collapse into a stale `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` reason
- if they still fail after alignment, the new reason must identify the true remaining hard cause

### 4. Re-run generation on live Tailnet under realistic policy

Required proof target:

- use the realistic active policy values
- keep `allowFlexibleSubjectAssignment=false`
- execute a fresh rerun
- prove whether the remaining `30` rows place successfully

### 5. If closure still fails, isolate the exact remaining hard blockers

If `0 unassigned` is still not achieved after semantic alignment:

- enumerate the exact remaining rows
- prove the exact hard reason
- explain why those rows are truly impossible under the realistic contract

Do not blur real impossibility together with soft-review ergonomics.

---

## Required Verification

### Automated

- `npm --prefix atlas-server run build`
- targeted regression tests for constructor/validator soft-vs-hard alignment

### Live Tailnet Verification

Using the active Tailnet environment:

1. capture baseline current latest run before the fix
2. verify active policy values before the rerun
3. execute a fresh generation rerun with realistic policy values
4. inspect:
   - latest draft summary
   - latest violations
   - latest unassigned rows
5. compare before vs after on:
   - `assignedCount`
   - `unassignedCount`
   - `hardViolationCount`
   - `policyBlockedCount`
   - residual `UNASSIGNED_SECTION` taxonomy

### Specific Proof Requirements

Evidence must explicitly state:

- whether constructor hard gating on daily/consecutive wellbeing was changed
- whether validator semantics remained consistent
- whether realistic `480 / 120 / 15` policy achieved `0 unassigned`
- if not, which exact rows still remain and why
- whether `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` was removed or narrowed to honest use

---

## Documentation Updates

Update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Append only in the evidence log.

The evidence entry must include:

- touched files
- baseline live run id and metrics
- rerun id and metrics
- realistic policy values used during verification
- whether closure happened without inflated policy
- exact remaining blockers if any
- final verdict: `GO` or `NO-GO`

---

## GO / NO-GO

### GO only if

- the constructor no longer hard-blocks placement on review-level wellbeing semantics
- a realistic-policy rerun materially improves the residual lane
- and ideally reaches `0 unassigned` without using inflated `600 / 600 / 5`

### NO-GO if

- closure still depends on policy inflation
- constructor and validator semantics still disagree
- or the residual rows still fail under a stale generic blocker label

---

## Completion Rule

This is not a “make the numbers look better” pass.

This is a semantics-correction pass.

The real success condition is:

- ATLAS stops confusing soft review ergonomics with hard feasibility
- and the timetable outcome under realistic policy becomes honestly explainable

