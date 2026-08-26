# Phase 3 Teaching Load Runtime + Teachers Follow-Up Audit — 2026-05-22

## Verdict

`NO-GO` for the latest `Teachers` follow-up pass.

The codebase is closer, but the reported completion is overstated.
The visible `Teachers` surface and the connected `Teaching Load` page still have important drift and likely runtime fragility.

## What Actually Landed

The following claims are materially true:

- `Teachers` and `/teaching-load` naming landed in the frontend routes and shell.
- the `Contact` column is removed from the `Teachers` table header
- `Excluded` was renamed to `Excluded in EnrollPro`
- `FacultyProfileSheet` now imports `GRADE_COLORS`
- `FacultyProfileSheet` renders color classes on section badges
- `Faculty` still builds successfully
- `Teaching Load` still builds successfully

So this was not a total miss.

## What Gemini Overclaimed Or Got Wrong

### 1. Advisory section visibility is still not actually solved on `Teachers`

The summary claimed advisory visibility was fixed.
That is only partially true.

Current state:

- `FacultyRow.tsx` shows a star for advisers
- `FacultyProfileSheet.tsx` shows advisory credit text
- `FacultyAssignments.tsx` can show `Adviser of GRX - Section`

But the `Teachers` row and profile drawer still do **not** explicitly show the advisory section in a durable way.

That means the `Teachers` surface still tells the operator:

- this teacher is an adviser

without clearly telling them:

- which section they advise

### 2. The claimed department-first reset in `Teaching Load` is incomplete

This is the biggest miss.

`FacultyAssignments.tsx` still uses specialization-first machinery:

- `specializationFilter`
- `useSpecializationAliases`
- `getQualificationTier`
- `specializationAliases`
- `aliasesLoading`
- specialization-based filtering and qualification fallback

Even though some visible grouping labels were renamed to:

- `Department Subjects`
- `Outside Department`

the actual qualification logic is still driven through specialization alias logic.

So the page was relabeled more than it was simplified.

### 3. `Excluded in EnrollPro` is clearer text, but still a weak product explanation

The rename is an improvement, but it does not fully resolve the issue.

The page still surfaces a filter/state that:

- looks actionable
- but is not controlled from this page

That means the operator still lacks clear explanation of what to do with it.

### 4. GR color parity is only partial

The summary implies broad parity.
What actually landed is narrower:

- section badges in the drawer now use grade colors

That is good, but it does not mean the full `Teachers` surface is now parity-clean with `Subjects`.

### 5. `Teaching Load` likely did not "crash" from a compile error

`npm --prefix atlas-client run build` still passes.

So the likely cause is **not**:

- syntax failure
- bundling failure
- missing import in the touched code

The more plausible causes are:

- runtime state assumptions
- overly dense conditional rendering still tied to the old specialization-first flow
- a browser-only render/path issue not caught by Vite build

## Likely Runtime-Error Source In Teaching Load

I could not reproduce a compile-time crash, but the strongest candidate introduced by the recent pass is:

### Specialization cleanup was only superficial

The page still carries the older specialization-driven state model while the surrounding product has been renamed and reframed toward:

- `Teachers`
- `Teaching Load`
- department-first qualification

That mismatch increases the chance of runtime issues because the page now mixes:

- renamed surface labels
- department language
- older specialization alias logic
- newer route retargeting behavior

The crash is therefore most likely a **runtime logic/render-state problem**, not a failed build.

In other words:

- Gemini changed the page language and some grouping names
- but did not fully remove the older specialization-heavy assumptions underneath

That is the most credible explanation for a page that still "breaks" in use even though it builds.

## Confirmed Remaining Problems

### Teachers page

- advisory section still under-exposed
- row still uses micro-text in important identity areas
- `Dept / Specialization` emphasis is still too close to the old model
- `Excluded in EnrollPro` is clearer but still not fully operator-friendly

### Teaching Load page

- specialization alias machinery still active
- specialization filter still active
- `getQualificationTier` still active
- visible specialization-heavy grouping logic still present under renamed labels
- micro-text remains widespread
- page still contains dense, fragile operator-facing complexity

### Shared shell / surface

- route rename landed
- shell naming moved in the right direction
- but this does not by itself prove workflow simplification is complete

## What The Next Pass Must Do

1. Fix `Teaching Load` as a runtime/workflow surface, not just a label surface.
2. Remove or decisively demote specialization-first state and filtering where the scheduler should now think department-first.
3. Make the advisory section explicitly visible on `Teachers`.
4. Tighten the `Excluded in EnrollPro` explanation or demote that state from primary prominence.
5. Reduce micro-text and leftover density in both `Teachers` and `Teaching Load`.
6. Verify the page in a runtime/browser path if available, not just via Vite build.

## Outcome

The pass is a partial improvement.

It is not closure-grade because:

- the `Teachers` surface still hides advisory section identity too much
- the `Teaching Load` page still materially depends on specialization-first logic
- the claimed completion overstates what was actually simplified
