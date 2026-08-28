# Phase 3 Subject Contract And Teaching Load Term Audit

Date: 2026-05-23
Scope: live subject-contract drift plus term-rotation reflection in Teaching Load

## Verdict

Yes, there is a subject-contract problem that should be fixed before trusting more staffing repair work.

The most important one is:

- `TLE` is still modeled as a protected seedable core subject

That is why it cannot be deleted like the exploratory TLE family members.

At the same time:

- regular BEC core subjects are intentionally protected from deletion
- so the right fix is **not** “make all core subjects deletable”
- the right fix is to stop treating `TLE` like a standard seedable core row if the MATATAG contract no longer wants it as one

## What I verified

### 1. Why `TLE` still cannot be deleted

Current live and code contract both still treat `TLE` as seedable:

- [prisma/seed.js](/d:/ATLAS/prisma/seed.js:45)
- [subject.service.ts](/d:/ATLAS/atlas-server/src/services/subject.service.ts:49)

Both define:

- `code = TLE`
- `isSeedable = true`

Delete behavior in [subject.service.ts](/d:/ATLAS/atlas-server/src/services/subject.service.ts:972) hard-blocks deletion for any seedable subject:

- if `subject.isSeedable`
- return `SEEDABLE_SUBJECT`
- error: `DepEd standard subjects cannot be deleted.`

So the current system is behaving consistently with its own contract.

The contract itself is what is stale.

### 2. Core BEC delete protection is still deliberate

Current seed/default contract still treats these as protected seedable rows:

- `FIL`
- `ENG`
- `MATH`
- `AP`
- `ESP`
- `MAPEH`
- `TLE`

This means:

- deleting true core rows is currently intentionally forbidden
- if the school wants to change the catalog shape, that should happen through contract reset, not by quietly weakening delete protection globally

### 3. `TLE` is the wrong member of that protected set now

The MATATAG/TLE reset already moved the real active model toward:

- `TLE_ROTATION`
- `TLE_AFA_EXP`
- `TLE_ICT_EXP`
- `TLE_FCS_EXP`

But the umbrella `TLE` row is still:

- active
- seedable
- regular-scope
- protected from delete

That is stale with the direction you have been enforcing.

So the right subject-contract correction is:

- retire `TLE` as a seedable core subject
- keep or demote it only if it still has a clean umbrella/reference role
- stop letting it block catalog cleanup through core-subject protection

## Are per-term teaching loads actually being reflected?

### Short answer

**Partially yes.**

### What is working

Live `Teaching Load` summary does show family-aware credited load behavior:

- `SCIENCE`
  - example: `AQUINO, ELPIDIO`
  - `sectionTeachingHoursRaw = 31`
  - `sectionTeachingHours = 27.3`
  - `rotationFamilyOvercountHours = 3.8`
  - `rotationFamilyLoadDetails` includes `SCI_BIO`, `SCI_CHEM`
- `TLE_ROTATION`
  - example: `ALVAREZ, MILAGROS`
  - `sectionTeachingHoursRaw = 30`
  - `sectionTeachingHours = 30`
  - `rotationFamilyOvercountHours = 0`
  - `rotationFamilyLoadDetails` includes `TLE_AFA_EXP`, `TLE_ICT_EXP`

So yes:

- term-family load accounting is being reflected in summary output
- non-concurrent family collapse is visible in runtime fields

### What is not working

That reflection is not the same as healthy ownership distribution.

Current live coverage still shows:

- `SCI_ES = 0 / 82`
- `TLE_FCS_EXP = 4 / 58`
- `SCI_CHEM = 47 / 82`

So the term model is reflected in load accounting, but it is **not** reflected in balanced current-year ownership.

Meaning:

- per-term teaching load math: partly working
- real ownership across family members: not working well enough

## Updated blocker interpretation

This is still not one generic shortage problem.

It splits into:

### 1. Science-family ownership topology failure

- `SCI_BIO` is fully owned
- `SCI_CHEM` is partial
- `SCI_ES` is zero

So family visibility exists, but distribution across members is broken.

### 2. TLE family-member distribution failure

- `TLE`
- `TLE_AFA_EXP`
- `TLE_ICT_EXP`

all have broad ownership

but:

- `TLE_FCS_EXP` is almost entirely unowned

So the family exists, but one strand is not actually distributed.

### 3. Filipino leakage and stranded in-department load

Live state still shows:

- low-load and zero-load `FIL` teachers
- missing ownership sample still present for `FIL`
- `FIL` assignment rows leaking outside the `FIL` department

So this is not a department-count problem first. It is an ownership and reconciliation problem.

### 4. Integrity and reconciliation debt

Live summary still has:

- `emptySectionRows = 160`
- `currentYearRowsMissingOwnership = 1`
- `currentYearMissingOwnershipPairs = 5`

That means there is still too much baseline row debt distorting the operator view.

## Recommended next fix order

### First

Fix the subject contract around `TLE`:

- remove `TLE` from the protected seedable-core set
- align the subject catalog with the active MATATAG rotation-family model
- make delete/archive semantics honest again

### Then

Run a targeted Teaching Load reconciliation pass aimed at:

- science-family ownership redistribution
- TLE family-member redistribution
- Filipino ownership leakage
- integrity cleanup
- blocker-classifier repair

## Decision

Yes, the `TLE` core/seedable contract should be fixed first.

And yes, per-term teaching load is now reflected in runtime summary math, but not yet in healthy family-member ownership distribution.
