# Phase 3 Teaching Load Staffing Blocker Audit

Date: 2026-05-23
Scope: live Tailnet audit of current staffing blockers in `Teaching Load`

## Verdict

The staffing problem is now more honest, but not solved.

The important improvement is that synthetic placeholder coverage is no longer hiding the truth:

- `assignedPairs = 1018`
- `realFacultyAssignedPairs = 1018`
- `syntheticPlaceholderPairs = 0`
- `unassignedPairs = 2`

So the current blocker is no longer `Teacher X`.

The current blocker is a mix of:

1. uncovered real ownership for specific subjects
2. empty seeded or baseline assignment rows with no section ownership
3. cross-department qualification leakage in some subject families
4. a blocker-classification endpoint that is currently under-reporting real causes

## High-signal live findings

### 1. Placeholder masking is gone

Live summary now shows:

- `placeholders = 0`
- `syntheticPlaceholderPairs = 0`

This is a real improvement.

So any remaining staffing problem is now visible as either:

- uncovered pairs
- weak ownership distribution
- bad integrity state

### 2. The biggest uncovered subjects are now explicit

Live `coverage/summary` shows:

| Subject | Owned | Uncovered | Status |
|---|---:|---:|---|
| `SCI_ES` | `0 / 82` | `82` | `ZERO` |
| `TLE_FCS_EXP` | `4 / 58` | `54` | `PARTIAL` |
| `SCI_CHEM` | `47 / 82` | `35` | `PARTIAL` |
| `ENG` | `59 / 82` | `23` | `PARTIAL` |
| `FIL` | `60 / 82` | `22` | `PARTIAL` |
| `MATH` | `70 / 82` | `12` | `PARTIAL` |
| `AP` | `76 / 82` | `6` | `PARTIAL` |
| `HG` | `79 / 82` | `3` | `PARTIAL` |
| `STE_ROBOTICS` | `0 / 2` | `2` | `ZERO` |

This means the current blocker mass is concentrated in:

- `SCI_ES`
- `TLE_FCS_EXP`
- `SCI_CHEM`
- then secondarily `ENG`, `FIL`, `MATH`, `AP`, `HG`

## Root-cause clusters

### Cluster A. Science is not a raw teacher-count shortage; it is ownership topology plus capacity pressure

Live department signal:

- `SCI` teachers: `17`
- `zeroLoad = 0`
- `under15 = 0`
- `avgLoad = 32.8`
- `maxLoad = 36`

Live subject ownership signal:

- `SCI_BIO`
  - `19` teachers have assignment rows
  - `82` owned sections total
- `SCI_CHEM`
  - `19` teachers have assignment rows
  - only `47` owned sections total
- `SCI_ES`
  - `17` teachers have assignment rows
  - `0` owned sections total

Interpretation:

- Science teachers are already heavily loaded.
- `SCI_ES` is not failing because the system cannot “see” science teachers.
- It is failing because the assignment/ownership topology never actually maps current-year sections to `SCI_ES`.
- `SCI_CHEM` shows the same problem at partial scale.

So the science blocker is:

- **ownership-distribution failure first**
- **capacity ceiling second**

It is not just “not enough science teachers” in the simplest sense.

### Cluster B. TLE has full family visibility but the FCS strand is nearly unowned

Live department signal:

- `TLE` teachers: `22`
- `zeroLoad = 0`
- `under15 = 0`
- `avgLoad = 30.2`
- `maxLoad = 32.3`

Live subject ownership signal:

- `TLE`
  - `22` teachers with assignment rows
  - `58` owned sections
- `TLE_AFA_EXP`
  - `22` teachers with assignment rows
  - `58` owned sections
- `TLE_ICT_EXP`
  - `22` teachers with assignment rows
  - `66` owned sections
- `TLE_FCS_EXP`
  - `22` teachers with assignment rows
  - only `4` owned sections

Interpretation:

- The entire TLE department is visible in the load model.
- The problem is not missing TLE teachers.
- The problem is that `TLE_FCS_EXP` ownership is barely distributed at all.
- Since department-first qualification is the baseline, this is more a **strand ownership / assignment topology failure** than a simple qualification absence.

So the TLE blocker is:

- **family-member distribution failure**
- with likely **load-capacity pressure** layered on top

### Cluster C. Filipino is badly under-distributed and also leaking outside its department

Live department signal:

- `FIL` teachers: `11`
- `zeroLoad = 2`
- `under15 = 9`
- `avgLoad = 6.5`
- `maxLoad = 13.5`

Live subject ownership signal:

- `FIL`
  - `60 / 82` covered
  - `22` uncovered

But live assignment-row signal is more revealing:

- `38` teachers have `FIL` assignment rows
- those include teachers from:
  - `ENG`
  - `MAPEH`
  - `FIL`

Live low-load examples:

- `BELTRAN, URSULA` (`FIL`) -> `0h`, `0 subjects`, `0 sections`
- `ENRIQUEZ, TOMAS` (`FIL`) -> `0h`, `0 subjects`, `0 sections`
- multiple `FIL` teachers sit at `6` to `7.5` credited hours only

Integrity signal:

- `missingOwnershipSamples` still includes:
  - `SANTOS, MARIA`
  - `subjectCode = FIL`
  - `sectionCount = 5`

Interpretation:

- Filipino is not blocked by a raw shortage of department teachers.
- It is under-distributed within its own department.
- At the same time, the teaching-load baseline is leaking `FIL` assignment rows outside the department-first model.

So the Filipino blocker is:

- **bad ownership reconciliation**
- **cross-department assignment leakage**
- **stranded in-department low-load teachers**

### Cluster D. MAPEH is not a coverage blocker, but it is a serious load-distribution smell

Live department signal:

- `MAPEH` teachers: `29`
- `zeroLoad = 7`
- `under15 = 5`
- `avgLoad = 20.1`
- `maxLoad = 43.5`

Coverage signal:

- `MAPEH = FULL`
- `SPA_SPEC = FULL`
- `SPS_SPEC = FULL`

Interpretation:

- MAPEH is not currently failing the coverage surface.
- But the internal distribution is highly uneven.
- Some MAPEH teachers are overloaded while seven have `0h`.

So this is not the main coverage blocker, but it is a major staffing-quality and fairness blocker.

### Cluster E. HG is close to closure, but the live apply result did not stick

Current live `HG` state:

- `79 / 82`
- `3` uncovered

Recovery preview currently plans exactly three `HG` uncovered assignments:

- `ARROYO, MANUEL`
- `DUTERTE, RODRIGO`
- `ESTRADA, PERLA`

But live state still remains `79 / 82`.

Interpretation:

- `HG` is not a depth problem.
- It is either:
  - unapplied recovery
  - non-persisting recovery
  - or a mismatch between preview logic and committed ownership state

So `HG` is a small but high-confidence reconciliation bug, not a strategic shortage.

## Integrity blockers

Live summary still shows:

- `emptySectionRows = 160`
- `currentYearRowsMissingOwnership = 1`
- `currentYearMissingOwnershipPairs = 5`

This matters because many teachers still carry subject assignment rows that own no sections.

Examples from `emptySectionSamples`:

- `ALVAREZ, MILAGROS` -> `TLE_FCS_EXP`, `TLE`
- `AQUINO, ELPIDIO` -> `SCI_ES`, `STE_BIOTECH`, `STE_ENV_SCI`, `STE_APPLIED_PHYS`, `STE_ROBOTICS`
- multiple science teachers with `SCI_ES` rows but `0` owned sections

Interpretation:

- the system still stores too many baseline subject rows that have not been reconciled into real section ownership
- this distorts operator trust and complicates recovery

## Broken blocker classification

The new recovery preview endpoint currently reports:

- `trueDepartmentShortage = 0`
- `skewedAssignmentTopology = 0`
- `unresolvedAutomationSeedBias = 0`
- `rotationFamilyModelingGap = 0`
- `subjectContractGap = 0`

while the live system still clearly has:

- `SCI_ES = 0 / 82`
- `TLE_FCS_EXP = 4 / 58`
- `SCI_CHEM = 47 / 82`
- `FIL` under-distribution with stranded `FIL` teachers
- `160` empty assignment rows

So the blocker classifier is currently under-reporting real causes and should not be trusted as-is.

## What is actually working

These parts now look healthy enough to keep:

- placeholder masking is removed
- real vs synthetic coverage truth is honest
- `SPA_SPEC` and `SPS_SPEC` are fully covered by real faculty
- specialization identity is persisted at assignment level
- rotation-aware load accounting is live in summary output

## Staffing blocker summary

### Primary blockers

1. **Science ownership topology failure**
   - `SCI_ES` has department visibility but zero real ownership
   - `SCI_CHEM` is only partially distributed

2. **TLE family-member distribution failure**
   - `TLE_FCS_EXP` is almost entirely unowned despite full TLE department participation in other TLE family members

3. **Filipino ownership leakage and under-distribution**
   - many low-load `FIL` teachers
   - live missing-ownership sample still present
   - `FIL` rows leaked into non-`FIL` departments

4. **Integrity debt**
   - `160` empty section rows remain

5. **Broken blocker-classification output**
   - recovery endpoint currently claims no blockers even when live data clearly shows them

### Secondary blockers

1. `HG` reconciliation gap
2. `MAPEH` distribution fairness problem
3. `STE_ROBOTICS` zero-coverage contract question

## Recommended next work direction

Do not treat the remaining problem as one generic “staffing shortage.”

The next repair chain should separate:

1. **ownership-reconciliation cleanup**
   - reduce empty assignment rows
   - fix missing ownership
   - make preview/apply parity truthful

2. **science-family ownership redistribution**
   - especially `SCI_ES`
   - then `SCI_CHEM`

3. **TLE family-member redistribution**
   - especially `TLE_FCS_EXP`

4. **Filipino qualification and leakage correction**
   - pull `FIL` ownership back toward actual `FIL` department teachers
   - recover stranded low-load `FIL` teachers

5. **blocker-classifier repair**
   - current counts are not analytically trustworthy

## Decision

The live teaching-load truth is much better than before.

But the staffing problem is still active, and the main blocker is now:

- not placeholder masking
- not page runtime
- but **real ownership distribution and integrity debt**

That is the correct place to work next.
