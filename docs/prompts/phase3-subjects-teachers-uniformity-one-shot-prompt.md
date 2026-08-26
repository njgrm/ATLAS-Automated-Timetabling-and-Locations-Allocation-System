# Gemini Execution Prompt: Phase 3 Subjects + Teachers Semantic Identity Uniformity One-Shot

## Objective

Repair the visual-language drift between `/subjects` and `/teachers` so both pages feel like part of one scheduler-facing catalog system.

This is not a generic polish pass.

This pass must specifically correct the over-minimal cleanup that flattened `Subjects` and left both pages with heavier-than-needed typography.

The goal is:

- keep the current stronger structural layout
- restore semantic identity and scanability
- unify department color language across both pages
- make both tables calmer, more professional, and easier to scan
- improve the `Subjects` coverage drawer so it shows taught sections more clearly

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-subjects-and-teachers-uniformity-audit-2026-05-23.md`
- `docs/analysis/phase3-subjects-teachers-and-teaching-load-visual-language-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/index.css`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`

## Facts To Treat As Settled

- Scheduler-facing naming is:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- `Subjects` is the structural baseline for catalog pages.
- `Teachers` currently has the better natural identity anchors.
- The previous cleanup pass removed too much semantic chunking from `Subjects`.
- Do not add fake parity actions just to make the pages look alike.

## Scope

### In Scope

#### A. Restore semantic identity in `Subjects`

Required:

- restore semantic badge containers to `Subjects`, but with restraint
- do not return to badge spam
- keep consolidated strings like:
  - `GR7-10`
  - shared program-scope summaries
- put those consolidated strings back into meaningful visual containers
- make subject identity easier to scan than it is now

#### B. Unify department color language across `Subjects` and `Teachers`

Required:

- create one shared department color dictionary
- use the same department color meaning on both pages
- if `SCI` is one color in `Subjects`, it must mean the same thing in `Teachers`
- use lower-saturation professional tints, not loud primary-color blocks

#### C. Improve row identity anchors

Required:

- keep teacher avatars
- improve subject identity blocks so they are not generic blue icon boxes
- use subject identity treatments that carry domain meaning
- if icon-box tinting is used, tie it to real subject identity such as owner department

#### D. Tighten typography hierarchy

Required:

- treat this as a typography pass as well as a table pass
- reduce the overall visual heaviness of the tables
- do not rely on `font-bold` as the default emphasis tool
- use a clearer weight ladder:
  - headers lighter than primary identity
  - primary identity semibold, not shouting
  - secondary metadata clearly demoted
  - badge text legible without over-bolding
- review `atlas-client/src/index.css` and fix any global weight choices that are making the whole app heavier than intended

#### E. Keep `Teachers` scheduling-first

Required:

- reduce employee-ID emphasis in `Teachers`
- promote specialization and department as the more useful secondary identity
- keep adviser context visible
- do not make the row feel like an HR table

#### F. Improve the `Subjects` coverage drawer

Required:

- make the subject coverage drawer show taught sections more explicitly
- use a clearer section-overview pattern like the one already used in the teacher profile drawer
- keep it read-only
- make section ownership easier to scan than a single compressed text line

#### G. Keep structural consistency

Required:

- keep `Subjects` and `Teachers` on one coherent:
  - header rhythm
  - sticky table-header treatment
  - pagination language
  - empty/loading-state quality bar
- do not flatten their domain differences

### Out Of Scope

Do not:

- redesign `Teaching Load` in this pass
- add new row actions
- re-open domain logic for subjects or teachers
- switch routes or page names again
- add decorative badge noise that does not help scanning

## Font Direction

Treat these as recommendations for this pass:

- preferred font direction: `Public Sans`
- acceptable fallback direction: keep `Instrument Sans` but fix hierarchy and weight policy properly
- do not switch to `Inter` unless there is a very strong repo-local reason

If a font-family switch is too broad for this pass, at minimum:

- correct the weight system
- reduce global heaviness
- improve table hierarchy with the existing typeface

## Implementation Direction

### 1. `Subjects`

- bring back semantic scan anchors
- use stronger but fewer badges
- keep program scope visible
- keep owner-department visible, but make it supportive rather than dominant

### 2. `Teachers`

- keep human identity first
- convert department treatment into the same semantic visual language used by `Subjects`
- demote ID-first presentation

### 3. Shared system

- same department palette
- same typography rules
- same table chrome
- same pagination feel

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive elements were introduced
- verify both pages still preserve no-scroll architecture
- verify both pages still use local scroll and sticky headers
- verify the current `Subjects` coverage drawer now shows sections in a clearer structured way
- verify both pages now feel visually related without becoming clones
- verify `Teachers` did not lose:
  - quick profile flow
  - teaching-load deep link
  - live/cached/no-cache signaling

## Required Output

Return:

1. files changed
2. semantic identity changes made
3. shared department-color system adopted
4. typography and weight changes made
5. `Subjects` coverage drawer improvements
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `Subjects` is materially easier to scan than before
- `Teachers` keeps its strengths while becoming visually more aligned with `Subjects`
- the two pages share one clear department color language
- the tables feel lighter and more professional, not heavier
- the `Subjects` coverage drawer gives a clearer sections-taught overview
- no badge-spam regression was introduced
