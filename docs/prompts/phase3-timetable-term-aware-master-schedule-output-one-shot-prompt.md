# Copilot Execution Prompt: Phase 3 Timetable Term-Aware Master-Schedule Output One-Shot

## Mission

Execute the third timetable re-entry pass.

This pass exists to align timetable output with stakeholder expectations for rotating `SCIENCE` and `TLE` families.

The key stakeholder rule is:

- the timetable slot stays stable all year
- the teacher and concrete subject identity can change by term inside that same slot

Your objectives:

1. preserve real backend term-aware truth
2. support stakeholder-style umbrella master-schedule output for rotating `SCIENCE` and `TLE`
3. expose a separate rotational-detail view or equivalent contract for per-term subject and teacher identity

---

## Scope

### In Scope

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- timetable review/runtime contract surfaces needed for term-aware output
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/`
- `atlas-client/src/pages/ScheduleReview.tsx` or current `/timetable` shell only where required
- tests for term-aware output contract
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad building/topology reseed work
- broad room-demand contraction
- unrelated timetable UI redesign

---

## Current Verified Facts

Treat these as already verified:

- backend/generation code already supports:
  - `termIndex`
  - `termCounts`
  - modular rotation-family handling
- runtime docs already state TLE cohort fallback is retired and rotation-family logic is the active path
- current product gap is not “no term-awareness exists”
- the real gap is “term-aware truth is not yet exposed in a stakeholder-honest timetable presentation”

---

## Required Product Contract

### 1. Stable umbrella master schedule

The master schedule may show normalized umbrella labels like:

- `SCIENCE`
- `TLE`

for rotating families where that matches stakeholder files.

### 2. Separate rotational detail

The system must still preserve and expose:

- which concrete subject applies in Term 1 / 2 / 3
- which teacher applies in Term 1 / 2 / 3
- for the same stable slot

### 3. Do not destroy term truth to simplify display

You must not flatten away the real per-term identity just because the stakeholder-facing master schedule becomes simpler.

### 4. Keep teacher and section schedules derivable from the same truth

The timetable contract should still support honest downstream:

- section schedule
- teacher schedule

from the same rotational truth.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`

Inspect directly before editing:

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/`
- current `/timetable` shell and supporting views

---

## Required Outcomes

### 1. Preserve term-aware runtime truth

Ensure the runtime contract still preserves:

- term-specific slot identity
- concrete subject identity
- teacher identity

for rotating science/TLE families.

### 2. Add stakeholder-honest master-schedule presentation

Required result:

- stable slot can render as `SCIENCE` / `TLE` in the main master schedule view when appropriate

### 3. Add rotational detail visibility

Required result:

- users can inspect the same slot and understand:
  - Term 1 subject/teacher
  - Term 2 subject/teacher
  - Term 3 subject/teacher

This can be a separate timetable detail surface or equivalent runtime-backed contract, but it must be real and verified.

### 4. Do not regress existing timetable feasibility data

This pass is presentation/contract alignment on top of existing term-aware truth.
Do not reopen unrelated feasibility logic unless necessary.

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. run relevant tests for term-aware output contract
4. add/update targeted tests if the timetable output contract changes

### Live checks

1. verify current timetable still loads
2. verify stable umbrella `SCIENCE` / `TLE` master-schedule behavior where appropriate
3. verify rotational detail view/contract shows term-specific subject and teacher changes for the same slot
4. verify teacher and section schedule derivation remains coherent

### Evidence requirements

Document:

- what the master schedule now shows for rotating science/TLE slots
- where the term-specific detail is exposed
- whether the same-slot-per-year stakeholder expectation is satisfied
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

1. timetable preserves real term-aware truth
2. master schedule can present rotating `SCIENCE` / `TLE` slots in stakeholder-familiar umbrella form
3. a separate verified detail surface/contract exposes concrete per-term subject and teacher identity

Otherwise declare `NO-GO` with the exact missing product gap.
