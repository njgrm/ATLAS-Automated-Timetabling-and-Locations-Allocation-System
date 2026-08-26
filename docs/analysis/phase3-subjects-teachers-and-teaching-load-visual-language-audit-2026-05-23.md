# Phase 3 Subjects, Teachers, and Teaching Load Visual Language Audit

Date: 2026-05-23
Scope: verify current UI drift and define the next Gemini-led semantic identity and scheduler-UX cleanup passes for `Subjects`, `Teachers`, and `Teaching Load`

## Verdict

The current concern is valid.

The recent cleanup passes improved structure in several places, but they also stripped away too much semantic identity. The result is:

- `Subjects` became too flat and text-heavy
- `Teachers` stayed more usable, but still has identity and typography drift
- `Teaching Load` remains the least scheduler-friendly page and needs a stricter UI recovery pass

This is not mainly a spacing problem anymore. It is a visual-language problem.

## Verification Summary

### 1. Gemini is right about the core failure on `Subjects`

The current `SubjectRow` confirms the page lost too much semantic chunking:

- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/subjects/SubjectRow.tsx:18) still imports `PROGRAM_SCOPE_BADGE`, `SUBJECT_OWNER_BADGE`, and `GRADE_COLORS`
- but the row no longer uses those dictionaries for its visible identity signals
- grades are now rendered as one plain neutral token
- owner department is plain text
- program scopes are plain text separated by bullets

That means the previous pass kept the data, but removed the visual grouping that made dense subject rows scannable.

I agree with Gemini's diagnosis here.

### 2. `Teachers` survived better because the data already has stronger natural anchors

The current `Teachers` row still has:

- a rounded avatar
- stronger human name shape
- centered count chip
- color-coded load value

See:

- [FacultyRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyRow.tsx:18)

So yes, the same flattening did less damage there because people rows already have:

- names
- initials
- numeric load
- naturally distinct shapes

I agree with Gemini's "false equivalence" point.

### 3. The current `Subjects` icon treatment is generic and does not help scanning

Gemini is also right that the current subject icon block adds very little scanning value:

- every subject uses the same blue `BookOpen` icon box
- the color does not encode department, program, or status

See:

- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/subjects/SubjectRow.tsx:55)

That gives the row decoration, but not identity.

### 4. The current typography is too heavy, but the problem is bigger than font choice

The app currently uses `Instrument Sans`:

- [index.css](/d:/ATLAS/atlas-client/src/index.css:3)
- [index.css](/d:/ATLAS/atlas-client/src/index.css:8)

But the heavier look is not only because of the typeface.

More importantly:

- `body` is globally set to `font-medium`
  - [index.css](/d:/ATLAS/atlas-client/src/index.css:109)
- `.font-normal` is remapped to `font-medium`
  - [index.css](/d:/ATLAS/atlas-client/src/index.css:116)

So the current system is effectively overweight by default before individual tables add:

- `font-bold`
- uppercase labels
- mono IDs
- colored emphasis

This is why the tables feel visually loud.

### 5. The current `Teachers` identity stack is still not right

The current row still gives too much attention to employee ID:

- [FacultyRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyRow.tsx:45)

and not enough to the actual scheduling-relevant secondary identity:

- specialization
- department
- advisory role

The drawer has the same issue:

- [FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:61)

So I agree with your earlier direction:

- specialization should matter more than employee ID
- teacher identity should be scheduling-first, not HR-first

### 6. The `Subjects` drawer still needs stronger section visibility

The current `Subjects` coverage drawer does show sections, but only as one compressed line per teacher:

- [Subjects.tsx](/d:/ATLAS/atlas-client/src/pages/Subjects.tsx:597)

That is weaker than the structured section list already used in the teacher drawer:

- [FacultyProfileSheet.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyProfileSheet.tsx:167)

So your requested follow-up is valid:

- the `Subjects` drawer should show section ownership in a more explicit, structured way
- it should mirror the stronger assignment-list treatment already present in `Teachers`

### 7. `Teaching Load` still has the heaviest visual burden

Even after the truth-model improvements, `Teaching Load` still suffers from:

- microtext-heavy rails
- too many badges and counters
- high-risk actions too close to routine ones
- integrity diagnostics in the main workflow band
- both a tooltip explanation and an inline explanation, which is duplication rather than clarity

The current page still reads more like an internal operations console than a scheduler workspace.

## Where I agree with Gemini

I agree with these points:

- `Subjects` lost too much semantic badging
- `Teachers` currently has the better row identity pattern
- semantic color should be reused across both pages
- the current subject icon treatment is too generic
- the current typography is too heavy
- using fewer but stronger badges is the right direction

## Where I would correct Gemini slightly

### 1. Do not restore the old page by just adding more badges

The fix is not "bring all badges back."

The fix is:

- fewer badges
- stronger meaning
- consistent cross-page color dictionaries
- better typography hierarchy

### 2. Font choice matters less than weight policy

I do not think the current problem is mostly solved by switching from `Instrument Sans` to `Inter`.

The bigger issue is:

- medium weight everywhere
- too many `font-bold` labels
- too much microtext

So the next pass must fix:

- font weights
- text sizing
- badge contrast
- row hierarchy

not just the font family.

### 3. I would not choose `Inter`

For this system:

- `Inter` is safe but generic
- `Geist` is clean but leans more technical/startup than institutional
- `Public Sans` is the best fit of the three for a scheduler-facing, DepEd-adjacent system

My preference is:

1. `Public Sans`
2. `Geist`
3. `Inter`

If the team wants a more official and trustworthy look, `Public Sans` is the strongest option.

## Recommended Next-Pass Split

The clean split is:

### Prompt 1: `Subjects + Teachers` visual-language uniformity

This pass should:

- restore semantic badges with restraint
- create one shared department color dictionary
- rebuild `Subjects` identity rhythm
- fix teacher secondary identity hierarchy
- improve the `Subjects` coverage drawer section overview
- tighten typography hierarchy across both pages

### Prompt 2: `Teaching Load` strict UX/UI recovery

This pass should:

- keep the new truth math
- remove the main-workflow clutter
- demote integrity and maintenance signals
- simplify teacher rail and subject-row presentation
- make the page feel scheduler-friendly instead of operator-technical

## Final Recommendation

Do not let Copilot handle this UI cleanup.

Use Gemini for:

- semantic identity
- badge/color restoration with restraint
- typography hierarchy
- table uniformity
- strict `Teaching Load` visual workflow cleanup

Keep Copilot on truth-model and service-layer work.
