# Copilot Execution Prompt: Phase 3 Teaching Load Helper Shadow And Warning State Fix One-Shot

## Mission

Repair the remaining Teaching Load frontend truth drift now that live Tailnet data is stable for `schoolId=1`, `schoolYearId=55`.

This is **not** another backend math pass. The live API already shows the corrected year-55 truth:

- `assignedPairs = 962`
- `unassignedPairs = 0`
- split-brain preview returns:
  - `quarantine.required = false`
  - `severity = WARNING`
  - `truthRowsToUpdate = 0`
  - all integrity counters = `0`
  - only warning reasons remain:
    - `FACULTY_LOAD_REVIEW_REQUIRED`
    - `SPECIAL_PROGRAM_APPROVAL_REQUIRED`

However, the Teaching Load page is still misleading because the frontend contract is broken in three specific ways:

1. **Selected-teacher math is still using stale additive logic somewhere in the client bundle.**
   - The repo still contains `atlas-client/src/lib/faculty-assignment-helpers.js` and `atlas-client/src/lib/faculty-assignment-helpers.d.ts` beside the real source file `atlas-client/src/lib/faculty-assignment-helpers.ts`.
   - The stale `.js` file still computes:
     - `actualTeachingHours` as a raw sum of all rows
     - status from raw teaching hours
     - no rotation-family peak-term collapse
   - This is consistent with the broken UI seen on Tailnet, where a teacher such as `ELLA RIVERA` can show:
     - roster = `92%`
     - selected header = `57.5h`, `52.5h`, `192% cap`
   - Live backend truth for `ELLA RIVERA` is actually:
     - `policyCreditedHours = 27.5`
     - `sectionTeachingHours = 22.5`
     - `policyLoadPercentage = 92`

2. **The page still renders a prominent Data Truth warning even though quarantine is no longer required.**
   - Current live state is warning-only and integrity-clean.
   - The current big amber banner implies active repair debt when there is none.

3. **Rotational peak presentation is still semantically sloppy for tied peaks.**
   - Live `ELLA RIVERA` Science breakdown is:
     - `Term 1 = 18.8h`
     - `Term 2 = 11.3h`
     - `Term 3 = 18.8h`
   - The current banner still presents only `Peak: Term 1`, even though `Term 1` and `Term 3` are tied.

Your job is to fix the actual frontend truth contract and prove it on Tailnet in the same pass.

---

## Hard Scope

Touch only what is necessary to repair:

- Teaching Load selected-teacher math truth
- Teaching Load warning/quarantine presentation
- rotational tied-peak presentation
- source-file shadowing / module resolution risk in the client
- evidence and docs updates for this exact issue

Do **not** reopen:

- backend teaching-load math
- staffing shortage logic
- auto-fill algorithm design
- science/TLE assignment distribution policy
- special-program approval workflow design
- broad page redesign

---

## Files Likely In Scope

- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.js`
- `atlas-client/src/lib/faculty-assignment-helpers.d.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `docs/verification/evidence-log.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

Update any other directly affected frontend file only if required, but keep scope narrow.

---

## Required Fixes

### 1. Remove stale helper shadowing risk

You must ensure the browser cannot keep executing the old additive helper logic.

Required outcome:

- There is only one authoritative source for Teaching Load helper math in the client.
- The stale sibling helper artifacts in `src/lib` must no longer be able to shadow the TypeScript source.
- If removing those shadow files is correct, remove them.
- If explicit import resolution is additionally needed, do it.

At the end of the pass, it must be impossible for `FacultyAssignments.tsx` to resolve stale additive math from the old helper.

### 2. Make the selected-teacher strip match live summary/detail truth

The selected-teacher strip must stop contradicting the roster and the live API.

Required outcome:

- For stable saved state, the selected-teacher header numbers must match the corrected live contract.
- `Credited Weekly Load` must reflect the same policy-credited load basis as the roster percentage.
- `Concurrent Teaching` must reflect the corrected concurrent weekly classroom load, not the raw summed rotational rows.
- `% cap` and remaining capacity must be computed from the same truthful basis as the visible top-line metric.
- The strip must not inflate rotational teachers into impossible concurrent weekly loads.

You must verify this with a real teacher on Tailnet, including `ELLA RIVERA`.

### 3. Remove the big Data Truth warning when only review-level warnings remain

The current banner is too severe for the current state.

Required outcome:

- If `quarantine.required = false`
- and integrity counters are zero
- and `truthRowsToUpdate = 0`

then the page must **not** render the current large amber incident banner.

Replace it with one of these approaches:

- no banner at all, if the remaining state is not worth page-level interruption
- or a much smaller, non-alarmist review badge / inline notice for:
  - overload review
  - special-program approval workflow

The page must no longer frame this as a live data-truth incident once integrity is clean.

### 4. Make tied rotational peaks honest

The rotational breakdown must stop implying a single winner when the peak is tied.

Required outcome:

- If multiple terms share the same peak credited contribution, the UI must present that honestly.
- Example:
  - `Peak Terms: Term 1, Term 3`
  - or another equally clear tied-peak wording
- Do not leave a false single `Peak: Term 1` label when `Term 3` is equally high.

This tied-peak rule must apply to the visible rotational family surface wherever the dominant term is shown.

### 5. Keep the page compact

Do not redesign the page.

Required outcome:

- preserve the compact Teaching Load workspace
- do not reintroduce duplicated term-total surfaces
- do not add another large explanation slab
- do not add new scrolling regions outside the existing local scroll architecture

---

## Tailnet Verification Requirements

You must test this directly on the live Tailnet environment after making the changes.

Use:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

You must verify all of the following:

1. The selected-teacher strip for `ELLA RIVERA` no longer shows impossible values such as `57.5h / 52.5h / 192%`.
2. The selected-teacher strip matches live API truth for `ELLA RIVERA`:
   - `policyCreditedHours = 27.5`
   - `sectionTeachingHours = 22.5`
   - `policyLoadPercentage = 92`
3. The roster percentage and selected-teacher strip no longer contradict each other for the same teacher.
4. The big `Data Truth Warning` banner is gone or correctly downgraded when split-brain preview remains warning-only and non-blocking.
5. The rotational family surface handles tied peaks honestly for a teacher whose peak term is tied.

If your first implementation still fails any of the above, keep fixing in the same pass. Do not stop at build success.

---

## Build And Test Requirements

Run and record:

- `npm --prefix atlas-client run build`

If you add or remove client source files, ensure the build still passes cleanly afterward.

---

## Evidence Log Requirements

Append a new entry to `docs/verification/evidence-log.md`.

Your evidence must include:

- what stale helper shadowing issue existed
- what was changed to prevent the wrong helper from executing
- exact Tailnet verification result for `ELLA RIVERA`
- whether the page-level warning banner was removed or downgraded
- whether tied-peak presentation now handles `Term 1` / `Term 3` ties honestly
- final verdict: `GO` or `NO-GO`

Do not claim `GO` unless the live Tailnet UI actually reflects the corrected values.

---

## Runtime Map Update

Because this changes scheduler-page truth presentation and warning semantics, update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`

Add or revise the Teaching Load note so it reflects:

- integrity-clean warning-only state no longer showing an incident-style banner
- selected-teacher strip now aligned to the corrected client helper contract

---

## Constraints

- Use project UI primitives only
- preserve no-scroll architecture
- do not introduce native controls
- do not reopen backend teaching-load logic
- do not invent a new metric taxonomy
- do not leave source-shadow duplicates in place if they can keep poisoning runtime truth

---

## Deliverable

Provide:

1. files changed
2. what frontend truth bug was fixed
3. Tailnet verification results
4. evidence-log confirmation
5. `GO` / `NO-GO`
