# Phase 3 Post-Run72 Final Blocker Assessment

Date: 2026-05-19

Primary evidence:
- `docs/verification/evidence-log.md`
  - `2026-05-19 - Phase 3 Faculty Feasibility + Final Contraction One-Shot (Tailnet + DB)`
- supporting assessments:
  - `docs/analysis/phase3-post-run64-drift-assessment-2026-05-19.md`
  - `docs/analysis/phase3-post-run68-faculty-feasibility-assessment-2026-05-19.md`
  - `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
  - `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`

## Executive Summary

Run `72` confirms that faculty feasibility was a real blocker, but it is **not** the main remaining blocker anymore.

What improved materially:
- `NO_QUALIFIED_FACULTY: 388 -> 180` (`-208`)
- `policyBlockedCount: 1430 -> 383` (`-1047`)
- `hardViolationCount: 1072 -> 1039` (`-33`)
- `UNASSIGNED_SECTION: 1072 -> 1039` (`-33`)

What did **not** improve materially enough:
- `LACKING_FACULTY` stayed flat at `68`
- `FACULTY_EXCESSIVE_IDLE_GAP` worsened slightly
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` worsened slightly
- unresolved cohort fallback rows stayed flat at `8`
- `NO_AVAILABLE_SLOT` became even more dominant:
  - `811 -> 987`

So the next phase is **not** mainly a faculty bottleneck pass.
It is now primarily a:
- slot-fit / packing
- fallback resolution
- cohort completion
- residual closure contraction

problem.

## What This Means

### 1. Faculty was necessary, but no longer primary
The faculty pass clearly worked on its own terms:
- qualification mass shrank hard
- policy-block accounting became cleaner

But because:
- `LACKING_FACULTY` is still flat
- `NO_AVAILABLE_SLOT` is now the biggest visible reason class

the remaining failure is better described as **feasibility geometry** than raw faculty shortage.

### 2. The unresolved cohort rows still matter
The remaining `8` unresolved cohort rows are still:
- `entryKind=COHORT`
- `NO_AVAILABLE_SLOT`
- `FALLBACK_UNRESOLVED`

They are not the only blocker mass, but they are still a clean unresolved cluster that the next pass should explicitly target.

### 3. The stakeholder files still support the same scheduling posture
The stakeholder class-program files still support:
- classroom/home-room-first master scheduling
- coherent daily section packing
- reduced unnecessary movement
- protected late-day blocks

They do **not** suggest another pivot back to specialized-room-first or teacher-identity-heavy outputs.

## Final Diagnosis After Run 72

The remaining blocker order is now:

1. `NO_AVAILABLE_SLOT` / slot scarcity / packing contraction
2. unresolved cohort fallback completion
3. final contraction of `UNASSIGNED_SECTION` and `hardViolationCount`
4. only then any last faculty/travel optimization if still needed

## Recommended Next Prompt Shape

Use one strong-model prompt that merges:
1. slot-fit and packing contraction
2. unresolved cohort fallback resolution
3. final pre-closure contraction gate

Do **not** split these again unless the next pass isolates a new dominant cluster.

## Baseline To Use Next

Use `run 72` as the baseline:
- `assigned=2309`
- `unassigned=1167`
- `hard=1039`
- `homeRoom=46.50`
- `policyBlocked=383`
- `cohortized=8`
- `term={2228,37,44}`
- `SPECIALIZED_ROOM_UNAVAILABLE=128`
- `LACKING_FACULTY=68`
- `FACULTY_EXCESSIVE_IDLE_GAP=372`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=731`
- `NO_AVAILABLE_SLOT=987`
- `NO_QUALIFIED_FACULTY=180`

## Decision

The next prompt should go all-in on:
- slot scarcity
- fallback resolution
- cohort completion
- final contraction

and should explicitly use the stakeholder-file assessments as guardrails so it does not regress into non-faithful scheduling behavior.
