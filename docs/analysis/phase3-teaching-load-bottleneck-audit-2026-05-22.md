# Phase 3 Teaching Load Bottleneck Audit - 2026-05-22

## Scope

This audit covers the live `Teachers` / `Teaching Load` state for:

- term-rotation subject handling
- teacher load truthfulness
- zero-load / zero-section teacher cases
- `assigned / total` overview accuracy
- `SPA_SPEC` and `SPS_SPEC` handling
- current DB integrity drift that affects scheduler trust

Evidence sources used:

- live Tailnet APIs at `https://njgrm.buru-degree.ts.net`
- direct DB inspection through the current ATLAS Prisma runtime
- current server/client code paths that build `Teaching Load`

## Verdict

The current `Teaching Load` data is not yet trustworthy enough to use as the canonical staffing baseline.

The main problem is not one single bug. It is a stack of four drifts:

1. the page overview counter is overstating the denominator
2. rotation-family subjects are still being counted like concurrent rows in teacher load
3. several faculty now have seeded subject rows with empty `sectionIds`
4. `FacultySubject` and `SubjectSectionOwnership` are no longer fully aligned

## Highest-Signal Findings

### 1. The current `assigned / total` overview is materially misleading

The live page currently reports:

- `787 / 1476 assigned`

That denominator is not the real current-year teachable universe.

What the current page is doing:

- it builds `totalPairs` by matching subject grade levels against all sections
- it does **not** respect `programScopes`
- this inflates `totalPairs` for subjects that only apply to `STE`, `SPA`, or `SPS`

Live calculations:

- page-style naive total: `1476`
- page-style naive assigned: `787`
- program-scoped total: `1026`
- program-scoped assigned from `FacultySubject`: `779`
- program-scoped assigned from current ownership truth: `778`

So the current page is understating completion by using the wrong denominator.

The more honest current-year coverage number is approximately:

- `778 / 1026` based on ownership truth
- about `75.8%`

not `787 / 1476` (`53.3%`).

### 2. `Teaching Load` is mixing current-year staffing with rotation-family overcount

Active rotating subjects in the DB are currently modeled as full `225` minute rows:

- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `TLE`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`

All of these are active and carry:

- `minMinutesPerWeek = 225`
- `termCount = 3`
- `rotationFamily` set (`SCIENCE` or `TLE_ROTATION`)

But the live `Teaching Load` summary computes:

- `sectionTeachingHours` by summing `subject.minMinutesPerWeek * sectionCount`
- per `FacultySubject` row
- without collapsing rows that belong to the same rotation family

That means a teacher who owns:

- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`

for overlapping sections is credited as if those rows are concurrent weekly load, not a rotating lane.

Example from live DB and Tailnet:

- `Elpidio Aquino`
  - live `Teaching Load`: `31h actual`, `36h credited`
  - family breakdown shows:
    - `SCIENCE`: `6` section refs across `SCI_BIO`, `SCI_CHEM`, `SCI_ES`
    - `STE_APPLIED_CHEM`: `1`
    - `STE_RESEARCH`: `1`
    - `HG`: `1`

This matches your earlier concern: the page can show heavy science overload because the term-rotation family is still counted row-by-row.

The same pattern exists for TLE:

- `TLE_ROTATION` still includes:
  - `TLE`
  - `TLE_ICT_EXP`
  - `TLE_AFA_EXP`
  - `TLE_FCS_EXP`

and some TLE teachers currently hold multiple rows inside that same family.

### 3. The "teachers with no load" problem is real, but it is not "no subject rows"

Live Tailnet summary shows:

- `146` faculty rows
- `0` teachers with `subjectCount = 0`
- `9` teachers with `sectionCount = 0`

So the real problem is:

- not missing `FacultySubject` rows
- but **empty** `FacultySubject.sectionIds`

These `9` teachers are currently zero-load:

- `2` in `FIL`
- `7` in `MAPEH`

All of them have persisted subject rows like:

- `FIL` with `sectionIds=[]`
- `MAPEH` with `sectionIds=[]`

Those rows were created at:

- `2026-05-22T12:00:12Z`
- with `assignedBy = 0`

So these are seeded/system-written baseline rows, not manual scheduler placements.

This is why the page can show:

- `subjectCount > 0`
- but `sectionCount = 0`
- and `policyCreditedHours = 0`

This is a real workflow smell because it makes a teacher look "assigned" at the subject level while still having no actual teaching ownership.

### 4. Coverage gaps are now concentrated, not universal

Live coverage summary shows only two fully zero-covered active subjects:

- `SCI_ES` with `82 / 82` uncovered
- `TLE_FCS_EXP` with `58 / 58` uncovered

Partially covered active subjects:

- `SCI_CHEM` with `45 / 82` owned
- `ENG` with `59 / 82` owned
- `FIL` with `60 / 82` owned
- `HG` with `65 / 82` owned
- `MATH` with `70 / 82` owned
- `TLE_AFA_EXP` with `50 / 58` owned
- `AP` with `76 / 82` owned

Fully covered subjects include:

- `ESP`
- `MAPEH`
- `SCI_BIO`
- `TLE`
- `TLE_ICT_EXP`
- `SPA_SPEC`
- `SPS_SPEC`
- all current `STE_*` special subjects

So the bottleneck is not "everything is missing."
It is now very specific:

- Earth Science is completely unmapped
- TLE Family and Consumer Science is completely unmapped
- Chemistry, English, Filipino, HG, Math, AP, and TLE AFA are only partially resolved

### 5. `SPA_SPEC` and `SPS_SPEC` are active, current-year, and classroom-default

Live DB contract:

- `SPA_SPEC`
  - active
  - `225` minutes
  - `outputLabel = SPECIALIZATION`
  - `ownerDepartment = MAPEH`
  - `preferredRoomType = CLASSROOM`
  - `programScopes = [SPA]`
- `SPS_SPEC`
  - active
  - `225` minutes
  - `outputLabel = SPECIALIZATION`
  - `ownerDepartment = MAPEH`
  - `preferredRoomType = CLASSROOM`
  - `programScopes = [SPS]`

Current live ownership:

- `SPA_SPEC`
  - `8` owned sections
  - spread across `7` teachers
- `SPS_SPEC`
  - `8` owned sections
  - concentrated into `2` teachers

Exact `SPS_SPEC` distribution:

- `Patricia Castillo`: `4` sections
- `Sofia Quirino`: `4` sections

This is operationally valid, but it makes the MAPEH department load distribution very uneven:

- `2` MAPEH teachers are at `37.5h`
- `7` other MAPEH teachers are at `0h`

So the current issue is not that SPS/SPA are missing.
It is that the current load distribution is extremely concentrated and likely not what schedulers want as a baseline.

### 6. The DB now has seeded empty rows and ownership drift at the same time

Current DB totals:

- `498` `FacultySubject` rows
- `153` of those have `sectionIds = []`
- `967` `SubjectSectionOwnership` rows

The empty-row concentration is strongest in:

- `TLE_FCS_EXP`: `22` empty rows
- `SCI_ES`: `19`
- `STE_ENV_SCI`: `17`
- `STE_APPLIED_CHEM`: `17`
- `STE_APPLIED_PHYS`: `17`
- `STE_BIOTECH`: `17`
- `STE_RESEARCH`: `11`
- `TLE`: `9`
- `HG`: `8`
- `MAPEH`: `7`
- `TLE_AFA_EXP`: `5`
- `FIL`: `2`

This means the current baseline is not "cleanly assigned" and not "cleanly unassigned."
It is a mixed state of:

- real section ownership
- empty qualification/seed rows
- partial family coverage

There is also direct integrity drift:

- `FacultySubject` current-year section refs without matching ownership rows: `6`
  - `FIL`: `5`
  - `HG`: `1`
- `SubjectSectionOwnership` rows without matching `FacultySubject.sectionIds`: `53`
  - all historical/non-current-year ownership
  - concentrated in:
    - `ENG`: `29`
    - `FIL`: `16`
    - `MAPEH`: `5`
    - `MATH`: `3`

This is important:

- current-year `Teaching Load` is being read mainly from `FacultySubject`
- but the summary route still returns `ownershipIndex` by `schoolId` only
- so ownership state is not fully school-year-clean

## Why Science And TLE Look Especially Bad

### Science

Science currently has:

- `19` science teachers
- `170` `FacultySubject` rows
- `161` owned section refs
- `18` teachers over `100%` policy load on live Tailnet

This is not just a staffing shortage story.
It is a modeling story:

- all three `SCIENCE` term rows are active at once
- Earth Science has zero ownership
- Chemistry is only partially owned
- load calculation still sums full subject minutes across the family

### TLE

TLE currently has:

- `22` teachers
- `90` `FacultySubject` rows
- `176` owned section refs
- `2` teachers over `100%`

TLE looks better than Science on overload, but its data model is also mixed:

- `TLE`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`

all remain active under `TLE_ROTATION`

and `TLE_FCS_EXP` is fully uncovered while many teachers still hold empty seeded rows for it.

## Root Causes

### Root Cause 1: The overview math is using the wrong teachable universe

The live page is still counting teachable pairs by grade only.
That inflates the denominator from `1026` to `1476`.

### Root Cause 2: Rotation families are not collapsed in load accounting

`SCIENCE` and `TLE_ROTATION` rows are still counted as full concurrent weekly load in `Teaching Load`.

### Root Cause 3: Department-baseline seeding created empty assignment rows

The new department-baseline reset created many `FacultySubject` rows with no sections.
Those rows are useful as latent qualification hints, but they pollute scheduler understanding if treated as actual load rows.

### Root Cause 4: Ownership truth is not fully school-year-clean

Current-year operational truth is split between:

- `FacultySubject.sectionIds`
- `SubjectSectionOwnership`

and the summary path still carries `53` historical ownership rows outside the active year.

## Decision Implications

### What should not be treated as the source of truth

Do not treat the current `787 / 1476` page badge as the authoritative staffing completion number.

### What is the more accurate current baseline

For current-year staffing truth, use:

- current-year program-scoped pairs
- current-year ownership rows
- explicit inspection of empty `FacultySubject` rows

That yields the more honest baseline:

- `1026` relevant current-year non-HG pairs
- `778` currently owned by current-year ownership truth

### What must be repaired before trusting load balancing

1. overview pair math
2. rotation-family load accounting
3. seeded empty-row treatment in `Teaching Load`
4. current-year ownership reconciliation
5. concentrated MAPEH special-program distribution review

## Recommended Next Repair Order

1. Fix `Teaching Load` overview math so `totalPairs` respects `programScopes`.
2. Add an explicit distinction between:
   - subject-qualified baseline rows
   - actual section-owned teaching load rows
3. Collapse or reinterpret `rotationFamily` rows in the teacher-load calculation so term-rotation subjects do not count like simultaneous weekly rows.
4. Reconcile `FacultySubject.sectionIds` against current-year `SubjectSectionOwnership`.
5. Run a focused load redistribution pass for:
   - `SCI_ES`
   - `TLE_FCS_EXP`
   - `SCI_CHEM`
   - `FIL`
   - `ENG`
   - `HG`
   - `MAPEH` `SPA_SPEC` / `SPS_SPEC`

## Bottom Line

The current `Teaching Load` page is closer than before, but it is still mixing:

- qualification baseline
- current-year ownership truth
- term-rotation rows
- historical ownership drift

into one surface.

The biggest current blocker to "accurate teaching loads" is not just missing assignments.
It is that the system still does not cleanly separate:

- who is qualified
- who actually owns sections this year
- which subjects rotate by term rather than run concurrently

