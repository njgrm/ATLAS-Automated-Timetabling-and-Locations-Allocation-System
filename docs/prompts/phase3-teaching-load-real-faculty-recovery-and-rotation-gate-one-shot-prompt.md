# Copilot Execution Prompt: Phase 3 Teaching Load Real Faculty Recovery + Rotation Gate One-Shot

## Objective

After the runtime/truth pass and specialization-assignment contract pass land, recover real-faculty teaching ownership and prove whether Science and TLE rotation behavior is actually working end-to-end.

This pass exists because the current live system still has:

- real teachers with `0h` or near-`0h` load
- placeholder-owned coverage masking real staffing gaps
- unresolved uncertainty about whether TLE and Science tri-term rotation are only modeled in data or are actually working through runtime behavior

This is the real-faculty recovery and closure pass for `Teaching Load`.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-post-rotation-audit-2026-05-23.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/analysis/phase3-teaching-load-bottleneck-audit-2026-05-22.md`
- latest results of:
  - `phase3-teaching-load-runtime-and-placeholder-truth-one-shot-prompt.md`
  - `phase3-teaching-load-specialization-assignment-contract-one-shot-prompt.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- any API or helper that computes:
  - real owned coverage
  - placeholder-covered pairs
  - zero-load or low-load faculty
  - rotation-family demand behavior

## Facts To Treat As Settled

- Placeholder coverage must no longer be treated as real staffing closure.
- Real teachers with zero or near-zero load are still a high-signal problem.
- Current live zero-load concentration is especially in:
  - `MAPEH`
  - `FIL`
- Current live placeholder-heavy target subjects include:
  - `SCI_ES`
  - `TLE_FCS_EXP`
  - `SCI_CHEM`
  - `HG`
- `SCIENCE` and `TLE_ROTATION` are real tri-term rotation families in the subject contract.
- Department-first qualification remains the scheduler baseline.
- Manual scheduler placements remain authoritative.

## Scope

### In Scope

#### A. Recover real-faculty ownership where placeholders are masking gaps

Required:
- inspect the current placeholder-owned coverage for:
  - `SCI_ES`
  - `TLE_FCS_EXP`
  - `SCI_CHEM`
  - `HG`
- convert placeholder-owned pairs to real-faculty ownership where the current department baseline and real-teacher depth support it
- if full conversion is not possible, classify the exact remaining shortage by department and subject

#### B. Rebalance zero-load and near-zero-load teachers where appropriate

Required:
- inspect the current `0h` and low-load real teachers
- recover meaningful owned load for the most obvious stranded teachers where legitimate
- do not force fake balance if the department truly lacks coverage depth

#### C. Prove whether Science and TLE tri-term rotation are actually functioning in runtime behavior

Required:
- do not stop at “the subject rows have `termCount=3`”
- verify whether the current assignment and generation/runtime paths are honoring:
  - family-aware load accounting
  - non-concurrent rotation interpretation
  - realistic ownership distribution across rotation-family members

For this pass, “working” must mean more than just a subject contract field existing.

#### D. Produce an honest blocker classification if real coverage still fails

Required:
- if real-faculty recovery cannot eliminate the placeholder dependence, classify the remaining blocker as one or more of:
  - true department shortage
  - skewed assignment topology
  - unresolved automation/seed bias
  - rotation-family modeling gap
  - subject-contract gap

### Out Of Scope

Do not:
- rebuild shell/sidebar UI
- re-open specialization mapping
- revert the current department-first baseline
- claim full closure if placeholder reliance remains operationally significant

## Implementation Direction

- Treat placeholder removal as a truth-recovery problem, not a cosmetic one.
- Prefer real teacher ownership wherever the current faculty baseline supports it.
- If the live school truly lacks depth for a subject family, make that shortage explicit instead of hiding it with Teacher X.
- Rotation “working” should be proven from runtime behavior and ownership/load signals, not only from static subject metadata.

## Verification Gates

Required:
- client build if touched
- server build/typecheck
- live Tailnet verification of:
  - zero-load / low-load teacher changes
  - placeholder-heavy subject changes
  - one science-family teacher
  - one TLE-family teacher
- direct proof of:
  - reduced placeholder dependence where legitimately possible
  - exact remaining placeholder dependence where not possible
  - current real-faculty versus placeholder-owned coverage by target subject
  - current runtime evidence for Science and TLE tri-term rotation behavior
- if generation/runtime verification is used, state exactly what was validated and what was not

Do not return `GO` from local-only reasoning.

## Required Output

Return:
1. real-faculty recovery changes made
2. files changed
3. zero-load / low-load teacher recovery results
4. placeholder reduction results by subject
5. exact remaining blocker classification for unrecovered pairs
6. verdict on whether Science tri-term rotation is actually working now
7. verdict on whether TLE tri-term rotation is actually working now
8. live verification results
9. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- placeholder coverage is no longer hiding the main staffing truth
- zero-load / near-zero-load real teachers are meaningfully improved where legitimately possible
- remaining shortages are explicitly classified instead of hidden
- Science and TLE rotation behavior is validated with runtime evidence, not only schema-level evidence

If not, return `NO-GO` with the exact remaining blocker.
