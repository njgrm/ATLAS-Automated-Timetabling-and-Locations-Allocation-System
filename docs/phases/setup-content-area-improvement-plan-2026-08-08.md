# Setup Content-Area Improvement Plan

Date: 2026-08-08 (revised after user approval pass)
Target pages: Sections, Subjects, Teachers (Faculty), Teaching Load, plus shared components (`RolloverGuidanceCard`, `AdminDataTable`, `AdminWorkspaceFrame`).
Driver audit: `docs/analysis/setup-content-area-ux-audit-2026-08-08.md` (cited as "Audit" with finding IDs CC-1...CC-12, S-1...S-15, Sub-1...Sub-22, T-1...T-24, TL-1...TL-32).
Persona: 55+ non-technical DepEd scheduler officer.
Predecessor plans: `docs/phases/setup-header-simplification-plan-2026-08-08.md`, `docs/phases/setup-header-residual-simplification-plan-2026-08-08.md` (both header-only).

## Goal

Fix the content areas beneath the now-simplified command headers. The audit found the same density/jargon/a11y anti-patterns repeated one band lower. This plan attacks the cross-cutting root causes first (because they repeat on every page), then per-page specifics. Work is phased so that **Phase 0** (cross-cutting infrastructure) unblocks every page fix and prevents regression.

This revision splits Phase 0 into 0A / 0B / 0C so the obvious page-level improvements in Phase 1+ are not blocked on the larger rollover-reset routing work, and folds in the six user-locked decisions plus an explicit "fix" language reduction rule.

## Resolved Decisions (Locked By User)

| # | Question | Decision |
|---|---|---|
| 1 | Admin-only reset route | **Dedicated route `/admin/year-setup`.** Setup pages show only a small dismissible "new year needs setup" banner with "Open year setup" link. Reset/sync tooling lives only at `/admin/year-setup`, admin-only, not visually prominent in the main scheduler workflow. |
| 2 | `isSeedable` default | **Flip default to `true`.** Modal shows a clear toggle labeled `Available for timetable` with helper "Turn this off only if this subject should not appear in schedule generation." Disabling shows an explicit confirmation/helper state, not a hidden technical default. |
| 3 | "Above standard - approval needed" | **Remove the approval framing.** Replace with `Above standard -- review before generating`; severe case becomes `Over maximum -- move classes before generating`. No new approver role. |
| 4 | `SubjectAddForm.tsx` deletion | **Delete if the implementation pass re-confirms no imports.** Keep only the active `SubjectFormModal` path. Add a guardrail test so stale duplicate forms do not reappear. |
| 5 | Grade-label fix scope | **Keep `GR[grade]` as the official compact grade format.** Use `Grade [level]` only in full explanatory text where space is not constrained. Do not use `G7`. |
| 6 | Tooltip vs Popover for help | **Hybrid `AccessibleInfo` component.** EnrollPro intro: persistent Popover, one-time dismissible. Coverage gloss and similar important explanations: `AccessibleInfo` (Tooltip on hover/focus PLUS Popover on click/tap). Important explanations are never hover-only. Every help trigger must be keyboard-focusable with an accessible name. |

## "Fix" Language Reduction Rule (Locked By User)

Reduce the word "fix" in user-facing copy. For older non-technical users, "Fix first" sounds like they broke something. Preferred replacements, in order of fit:

- `Next step` (replaces "Fix first", "Next fix")
- `Needs review` (replaces "needs to be fixed")
- `Review before generating` (replaces "must be repaired/fixed before generation")
- `Choose a home room` / `Choose a teacher` (replaces "fix room assignment")
- `Assign a teacher` (replaces "fix missing load")
- `Move classes before generating` (replaces "reduce overload", "repair over cap")

This rule applies to ALL phases below. Page-specific "fix" replacements are spelled out where the audit found the worst offenders (Teaching Load Task Guide, repair queue, "hard repair limit", "Over cap - must fix").

## Phasing

- **Phase 0A** -- Readable labels, glossary, AccessibleInfo, AdminDataTable a11y. Lowest blast radius; unblocks every per-page label/jargon fix.
- **Phase 0B** -- `RolloverGuidanceCard` split and the new `/admin/year-setup` route. Larger blast radius (admin route, role guard); isolated from 0A and 0C.
- **Phase 0C** -- Color-reservation audit + dead-code cleanup. Independent cleanup pass; no per-page work should wait on it.
- **Phase 0 (free)** -- First-use EnrollPro intro popover; small enough to bundle with 0A or land with 0C, implementation pass decides.
- **Phase 1** -- Sections (the page whose central workflow is hardest to discover).
- **Phase 2** -- Subjects (densest form + a coverage drawer that misclassifies failures).
- **Phase 3** -- Teachers (the table that hides its three most important numbers).
- **Phase 4** -- Teaching Load (worst jargon/a11y offender; depends on Phase 0A glossary and AccessibleInfo).

Each phase lists scope, decisions, test gates, and acceptance. Out-of-scope and open questions are at the end. **Per-page phases (1+) may not begin until Phase 0A lands; they may begin before 0B and 0C provided the per-page work does not itself depend on rollover reset or color cleanup.**

---

## Phase 0A -- Readable Labels, Glossary, AccessibleInfo, AdminDataTable A11y

### 0A.1 ATLAS DepEd glossary module

- **Scope:** New file `atlas-client/src/lib/deped-glossary.ts` exporting:
  - `DEPARTMENT_LABELS: Record<string, string>` mapping canonical codes to plain DepEd names: `SCI -> Science`, `MATH -> Mathematics`, `ENG -> English`, `FIL -> Filipino`, `AP -> Araling Panlipunan`, `ESP -> Edukasyon sa Pagpapakatao`, `MAPEH -> MAPEH`, `TLE -> Technology and Livelihood Education`, `GENERAL -> General`. Keep real DepEd acronyms (AP/ESP/MAPEH/TLE) as-is; spell out the made-up ones (SCI/ENG/FIL).
  - `PROGRAM_LABELS: Record<string, { short: string; full: string }>`: `STE -> { short: 'STE', full: 'Science, Technology, Engineering' }`, `SPA -> { short: 'SPA', full: 'Special Program in the Arts' }`, `SPS -> { short: 'SPS', full: 'Special Program in Sports' }`, `SPJ -> { short: 'SPJ', full: 'Special Program in Journalism' }`, `SPFL -> { short: 'SPFL', full: 'Special Program in Foreign Language' }`, `SPTVE -> { short: 'SPTVE', full: 'Special Program in Technical-Vocational Education' }`, `REGULAR -> { short: 'Regular', full: 'Regular Program' }`.
  - `GRADE_COMPACT = (n: number) => 'GR' + n` and `GRADE_LONG = (n: number) => 'Grade ' + n` (Decision 5: keep `GR7`, drop `G7`).
  - `TEACHER_X_LABEL = 'Temporary (to be hired)'` (replaces the default placeholder name; "Teacher X" stays as a *badge label only* with tooltip, never as a default first/last name).
- **Consumers:** `FacultyRow.tsx`, `CreatePlaceholderDialog.tsx`, `Faculty.tsx` (filter), `subject-constants.ts`, `Sections.tsx` (filter + row badges), `SubjectRow.tsx`, `StaffingAuditSheet.tsx`, `grade-labels.ts`.
- **Resolves audit findings:** CC-2, CC-3.
- **Test gate:** Unit test `deped-glossary.test.ts` asserting every code maps to a non-code label; `DEPARTMENT_LABELS['FIL'] === 'Filipino'`; `GRADE_COMPACT(7) === 'GR7'`; no value is a 2-4-letter all-caps string (excluding real DepEd acronyms AP/ESP/MAPEH/TLE/STE/SPA/SPS/SPJ/SPFL/SPTVE).

### 0A.2 Label text-size and case floor

- **Scope:** Repo-wide sweep of label/help text classes.
- **Rule (new):**
  - Field labels: `text-sm` (14px) minimum, `font-semibold`, sentence case, `text-foreground` (not `text-muted-foreground`).
  - Helper text under fields: `text-xs` (12px) minimum, sentence case.
  - Badge sub-labels in readiness strips and inline stat banners may stay at `text-[0.65rem]` *only* if the badge also renders a numeric value at `text-sm` and a tooltip -- never for the only copy on a surface.
  - Section headers in modals and sheets: `text-sm font-semibold` minimum, sentence case.
  - Forbidden classes on user-visible text below `text-[0.7rem]`: `tracking-widest`, `tracking-[0.2em]`. Replace with `tracking-normal` or `tracking-tight`.
  - Forbidden on user-visible copy: `uppercase` applied to whole sentences (still allowed on <=3-word micro-labels paired with a numeric value).
- **Resolves:** CC-1.
- **Test gate:** `ux-guardrails.test.ts` assertion that grepping `atlas-client/src` for `text-\[0\.[0-5]` and `text-\[0\.6[0-4]?rem\]` + `uppercase` in label/help contexts fails if matches are found outside an allowlist (the readiness-strip numeric badges).

### 0A.3 `AccessibleInfo` keyboard-a11y helper

- **Scope:** New component `atlas-client/src/components/smart/AccessibleInfo.tsx` implementing Decision 6:
  - A `<Button variant="ghost" size="icon-sm">` trigger (keyboard-focusable, has an accessible name).
  - Shows a `<Tooltip>` on hover AND on keyboard focus.
  - Opens a `<Popover>` on `Enter` / `Space` / click for longer help text.
  - Props: `label: string` (accessible name), `shortHelp: ReactNode` (tooltip content), `longHelp?: ReactNode` (popover content; when omitted, click also just toggles the tooltip).
  - No "important explanation" anywhere may be Tooltip-only after this lands.
- **Audit every existing `<Tooltip>` whose `TooltipTrigger asChild` wraps a `<Badge>`, `<span>`, or `<div>`.** Wrap those in `AccessibleInfo` (or in a `<Button variant="ghost" size="icon-sm">` if only a tooltip is needed) so the tooltip is keyboard-triggerable.
- **Resolves:** CC-8, CC-11, T-8, TL-13 (partial).
- **Test gate:** `ux-guardrails.test.ts` assertion that no `<Tooltip>` in the audited files wraps a non-focusable child; Playwright keyboard-tab test reaches the Teachers Load State badge and triggers help without a mouse.

### 0A.4 `AdminDataTable` a11y + touch-target baseline

- **Scope:** Refactor shared `AdminDataTable.tsx` (used by Faculty and similar tables):
  - Add `aria-sort="ascending | descending | none"` on `<th>` driven by the current sort field/direction.
  - Add `aria-label` to sort buttons: `Sort by {column}, currently {direction}`.
  - Add visible `<Tooltip>` ("Sort by {column}") on each sort button.
  - Pagination icon buttons: add `aria-label` ("First page", "Previous page", "Next page", "Last page") AND visible `<Tooltip>`; bump touch target to `h-9 w-9` (36px -- closer to 44px while staying compact).
  - Page-size `Select`: associate "Rows per page" via `aria-label` or `aria-labelledby`; bump trigger to `h-9`.
- **Resolves:** CC-5, CC-6 (Faculty/Teachers rows). Per-page table fixes (Sections, Subjects) follow the same pattern in Phase 1/2 since they don't use `AdminDataTable`.
- **Test gate:** Playwright tab-through asserts the sort button announces direction; pagination buttons announce "First page" etc.; no `<th>` lacks `aria-sort` when its column is sortable.

### 0A.5 First-use EnrollPro intro popover (bundle here or with 0C)

- **Scope:** One-time intro `<Popover>` on the source-state chip (or on first sync button) explaining: "ATLAS uses EnrollPro -- the DepEd enrollment system -- as its teacher and section roster source." Dismissed once per user (localStorage). Provide a re-trigger in Help.
- **Resolves:** CC-12.
- **Test gate:** Playwright test on a fresh browser profile asserts the intro Popover appears once and dismisses for the session.

---

## Phase 0B -- RolloverGuidanceCard Split and `/admin/year-setup` Route

Depends on 0A.1 (glossary) for the friendly drift labels. Otherwise independent.

### 0B.1 Status banner on setup pages (dismissible, non-destructive)

- **Scope:** `RolloverGuidanceCard.tsx` rewrite of the `compact`/non-aligned path:
  - Compact, dismissible (per-session AND persisted "don't show again for this drift status"). Stores a localStorage key per drift status.
  - Shows only the friendly drift label + a one-sentence plain-English next step + a single affordance: "Open year setup" linking to `/admin/year-setup`.
  - NO destructive button. NO reset count rows. NO `Migration needed` / `drift` / `enrollpro-unreachable` strings.
  - Jargon replacements via Phase 0A.1 glossary: `drift` -> "year status"; `atlas-stale` -> "New year needs setup"; `mapping-conflict` -> "Old year's data needs clearing"; `enrollpro-unreachable` -> "Can't reach EnrollPro right now"; `Migration needed` -> "Move to the new school year".
- **Resolves:** CC-4 (the single worst cross-page offender), TL-18, TL-19, S-10 (partial), T-18.
- **Test gate:** Playwright test that `RolloverGuidanceCard` on `/sections`, `/subjects`, `/teachers`, `/teaching-load` (a) is dismissible, (b) contains no destructive button, (c) contains none of the strings `RESET_DUMMY_SCHOOL_YEAR_1`, `Migration needed`, `drift`, `dummy data`, `Reset dummy data`.

### 0B.2 Reset flow at `/admin/year-setup` (admin-only)

- **Scope:** New admin-only route. Auth guard restricts to IT Admin role (mirrors the existing admin role check).
  - Renders the full reset card (preview + reset + confirmation) on this dedicated page, not inline above any setup table.
  - Confirmation switches from type-the-snake-case-token to a two-step dialog:
    - Step 1: checkbox "I understand this will erase ATLAS test data, including teachers, classes, and timetables set up for the old school year." (mandatory).
    - Step 2: a "Yes, erase and sync" button (default focus NOT on it).
  - Reset count rows hidden behind a "Show what will be erased" disclosure with friendly names only: "Sections", "Generated timetables", "Teaching Load assignments", "Policies", "Notes and flags". Drop the internal labels (`Section mirrors`, `Generation runs`, `Follow-up flags`, `Teaching Load owners`, `Draft locks`, `Cohorts`, `Old audit rows`).
  - The admin route is not surfaced in the main scheduler nav. Setup pages link to it with "Open year setup" only.
- **Resolves:** TL-18, TL-19 (admin side), Decision 1.
- **Test gate:** Playwright test that `/admin/year-setup` requires the admin role (redirects a Faculty-role user); the reset dialog has a checkbox + a non-default-focused confirm button; `RESET_DUMMY_SCHOOL_YEAR_1` does not appear anywhere on the page; the "Show what will be erased" disclosure opens to friendly names only.

---

## Phase 0C -- Color-Reservation Audit and Dead-Code Cleanup

Independent of 0A and 0B. May run in parallel.

### 0C.1 DepEd color reservation audit

- **Scope:** Audit every use of the four grade colors (green/yellow/red/blue) and replace non-grade uses:
  - **Fill-state red** (`SectionRow.tsx:45`, >=95% fill): switch to a *neutral intensity* scale (e.g. `bg-slate-100` to `bg-slate-300` for over-full) -- not red.
  - **Error/blocked-edit red** (`Sections.tsx:889`): switch `border-red-200 bg-red-50` to the `destructive` semantic token used elsewhere; reserve pure red for the destructive action button only.
  - **Completion dots** (`SubjectRow.tsx:526`, `SectionGridMode.tsx:282`): add a text alternative ("Assigned" / "Pending") alongside the dot, OR use icon-based status (`CheckCircle2` / `Clock`) rather than color alone.
- **Resolves:** CC-7, TL-30.
- **Test gate:** `ux-guardrails.test.ts` assertion that `bg-red-*` / `text-red-*` outside of `variant="destructive"` contexts and outside the grade-color map fails.

### 0C.2 Dead/duplicate code cleanup

- **Scope:**
  - Delete `atlas-client/src/components/subjects/SubjectAddForm.tsx` (252 lines) after re-confirming no imports (Decision 4). Add a guardrail test in `ux-guardrails.test.ts` asserting the file does not reappear and that `Subjects.tsx` imports only `SubjectFormModal`.
  - Fix `grade-labels.ts` per Decision 5: function returns `GR${grade}` (already does); update the JSDoc comment to match the locked decision (compact = `GR7`, long = `Grade 7`, never `G7`). Sweep all consumers for stray `G7` and replace with `GR7` (compact) or `Grade 7` (long) based on context.
  - Remove `QUALIFICATION_PRIORITY_OPTIONS[SPECIALIZATION_PRIMARY]` dead branch in `subject-constants.ts` or surface it if needed; either way the dead type goes away.
- **Resolves:** CC-10.
- **Test gate:** Build + existing tests pass; `grep` for `SubjectAddForm` returns no imports; `grep` for `\bG7\b` (word boundary) in `atlas-client/src` returns no matches; `gradeLabel(7) === 'GR7'`.

---

## Phase 1 -- Sections

Depends on Phase 0A. May begin before 0B and 0C.

### 1.1 Home-room assignment discoverability

- Replace the combobox trigger styling so it visibly reads as an interactive control: chevron `size-4 opacity-100`, an explicit "Choose" verb on empty rows ("+ Choose home room"), a subtle ring on hover, and a default-tooltip "Choose a home room for this section."
- Add an inline "start here" banner above the table when `sectionsNeedingRooms > 0`: plain "N sections still need a home room. Use the Choose home room control on each row." (Dismisses once the count hits 0.) Uses the "Choose" verb per the fix-language rule.
- **Resolves:** S-1, S-2.
- **Test gate:** Playwright test that the picker trigger has a visible chevron >=16px and an `aria-label` containing "home room"; the "start here" banner renders while `sectionsNeedingRooms > 0`.

### 1.2 Repair `SwapConfirmationModal` copy + a11y

- Rewrite the "Final Outcome" sentence to plain English: "{sectionName} will move to {roomName}" or "{sectionName} will have no home room -- reassign before generation." (Fixes the ungrammatical "becomes moved to".)
- Rename labels: `Source Section` -> `This section`; `Displaced Section` -> `The other section that uses this room`; `Final Outcome` -> `After this swap`.
- When `currentRoomName === null` (displaced section becomes unassigned), add an explicit amber warning block: "Warning: {sectionName} will no longer have a home room. Reassign it before generating the timetable."
- **Resolves:** S-3, S-4, S-9.
- **Test gate:** Playwright assertion that the swap modal contains none of `becomes moved to`, `Displaced Section`, `Source Section`, `Final Outcome`; and that the unassigned path shows "Reassign" text.

### 1.3 Invert destructive-action order on `UnassignConfirmationModal`

- Footer order: "Keep Assignment" (safe, primary) *first*; "Unassign Room" (destructive, `variant="destructive"`) *second* and visually distinct. Default focus on the safe button.
- **Resolves:** S-6.
- **Test gate:** Playwright assertion that the safe button precedes the destructive button in DOM order and tab order; the destructive button is not the default focus.

### 1.4 Make `SectionRoomPicker` a real ARIA combobox or a `Popover` listbox

- Either implement Radix `Popover` with `role="listbox"` + `role="option"` + `aria-selected` on the room list, or replace with a searchable `Command` (shadcn cmdk primitive) which gives combobox semantics for free.
- Remove the `onOpenAutoFocus={(e) => e.preventDefault()}` focus-trap suppression; let Radix manage focus, and focus the search input on open.
- **Resolves:** S-5.
- **Test gate:** Keyboard-tab Playwright test reaches the picker, opens it, arrow-keys through options, and announces selection via `aria-selected`.

### 1.5 Sections table a11y + label fixes

- Add `aria-sort` + `aria-label` on sortable columns (mirrors Phase 0A.4).
- Rename `Status` column -> `% Full` (or `Filled`).
- Rename `Home-room readiness` -> `Home room` (sentence case, no hyphen).
- Add per-row "queued for sync" badge on the picker when an offline save is queued (`offline-queued` chip on the room row, not only the top banner).
- Drop the `min-w-56` home-room cell minimum; let it wrap on tablet widths.
- **Resolves:** S-7, S-13, S-14, parts of CC-5/CC-6.
- **Test gate:** `aria-sort` present on sortable `<th>`; no `min-w-56` on the home-room cell; `Status` header text replaced.

### 1.6 Deduplicate row actions

- Drop one of the three redundant details entry points (section-name button + Users icon + MoreVertical details). Keep: section-name button (primary "view") + `MoreVertical` (with "Open teaching load" moved in). Users icon becomes redundant -- remove.
- Add `AccessibleInfo` (Phase 0A.3) tooltip on the section-name button ("View section details").
- **Resolves:** S-8.
- **Test gate:** Row has at most one icon button plus the kebab; section-name button has an accessible tooltip.

### 1.7 Plain-language filter labels + program-code tooltips

- Program filter `<SelectItem>` renders `{PROGRAM_LABELS[p].short}` with an `AccessibleInfo` long-help showing `{PROGRAM_LABELS[p].full}` (Decision 6).
- Home-room filter copy already plain -- no change.
- "Reset all" should also clear the search query (or be renamed "Reset filters" matching what it does).
- **Resolves:** S-15, parts of CC-3 for this page.

---

## Phase 2 -- Subjects

Depends on Phase 0A (glossary, AccessibleInfo, label floor). May begin before 0B and 0C.

### 2.1 Modal: stepper + plain labels + default hours + Available-for-timetable default

- Refactor `SubjectFormModal.tsx`:
  - Convert the 4 numbered sections into a `Stepper` (shadcn pattern): identity -> time/room -> programs/owner -> advanced. Show step indicator; allow back/next; "Advanced" is collapsed by default with a "Skip if unsure -- these are optional scheduling rules" gate.
  - Field labels -> `text-sm font-semibold` sentence case (Phase 0A.2).
  - Default `timeMode` to `'hours'` to match the list render (currently `'minutes'` at `SubjectFormModal.tsx:82`). Single unit display: show `hr`/`hrs` or the word `hours` consistently -- not `min`/`minutes`/`hr` together.
  - Save button shows a 200ms inline "Saved" confirmation before closing.
  - First input (Code) gets `autoFocus` in add mode.
  - Modal grid -> `grid-cols-1 sm:grid-cols-2` so phones don't cram two columns.
  - **Decision 2:** `isSeedable` default flips from `false` to `true`. The toggle is labeled `Available for timetable` with helper "Turn this off only if this subject should not appear in schedule generation." Disabling shows an explicit confirmation/helper state ("This subject will be excluded from schedule generation. Existing assignments are kept."), not a hidden technical default. The "HG" and "Consult" examples in the existing tooltip are expanded to "Homeroom Guidance" and "consultation period".
- **Resolves:** Sub-1, Sub-2, Sub-3, Sub-8, Sub-9, Sub-16.
- **Test gate:** Playwright asserts the modal renders a Stepper; `timeMode` defaults to hours; `grid-cols-1` at `sm:` breakpoint base before `sm:grid-cols-2`; the `Available for timetable` toggle defaults to on; disabling it shows the confirmation/helper state and no "HG"/"Consult" unexpanded acronyms.

### 2.2 Inline validation messaging

- Add inline `aria-live` error text under each required field when `canSave` is false -- show "Code is required", "Name is required", "Pick at least one program" inline, not as toasts.
- Tooltip on the disabled Save button stating *why* it's disabled (Phase 0A.3 `AccessibleInfo`).
- **Resolves:** Sub-2.
- **Test gate:** Playwright: clear the Code field -> inline error appears and the Save button tooltip names the missing field.

### 2.3 Coverage drawer: conditional panels + failure-vs-empty distinction

- Only render the "Term rotation" panel when `coverageSubject.rotationFamily` is truthy -- not unconditionally.
- On coverage fetch failure, render an in-drawer amber error panel ("Couldn't load coverage right now -- try again") NOT the same view as "No teachers assigned." Distinct testid so tests can tell them apart.
- The "Uncovered scope" panel must check *both* grade coverage and program-scope coverage; if either has a gap, do not show the green "All listed grades have assigned coverage" check. Replace with "Coverage gaps:" + the specific gap list.
- Render "Resource requirements" panel whenever `requiredFeatures.length > 0`, not gated on `preferredRoomType !== 'CLASSROOM'`.
- Fix `w-100 sm:w-135` non-Tailwind classes -> proper `w-full sm:max-w-xl` (or the actual intended width).
- **Resolves:** Sub-4, Sub-5, Sub-6, Sub-10.
- **Test gate:** Playwright asserts the drawer does not render the Term rotation panel for a non-rotating subject; asserts an in-drawer error (not the empty-state) renders on coverage fetch failure (mock); asserts program-scope gaps block the green "all covered" check.

### 2.4 Subjects table: add Coverage / Program-scope columns

- Add a `Coverage` column that shows a status chip at a glance: "Teacher assigned" (green), "Missing teacher" (amber), or "Checking" (spinner) -- driven by the same logic as the readiness strip.
- Add a `Program` column showing `PROGRAM_LABELS[code].short` with an `AccessibleInfo` long-help for the full name (Decision 6).
- Move the Owner department badge to its own cell, expanded via `DEPARTMENT_LABELS`.
- Add `aria-sort` + sort-button `aria-label`s.
- **Resolves:** Sub-7, parts of CC-2/CC-3/CC-6.
- **Test gate:** Playwright asserts the new columns render and the Coverage chip matches the readiness-strip "Missing coverage" count for a known seed.

### 2.5 Error state retry + `Reset all` semantics + "Checking" string

- Error banner (`Subjects.tsx:669-687`) gains a "Try again" `Button` matching the sync-error banner.
- "Reset all" also clears the search query.
- The readiness-strip "Missing coverage" stat renders a skeleton/spinner while `coverageRiskCount === null` rather than the literal string "Checking" as a value.
- **Resolves:** Sub-11, Sub-12, Sub-13.
- **Test gate:** Playwright asserts the "Try again" button on the general error banner; asserts "Reset all" clears the search input; asserts the strip shows a spinner (not the text "Checking") while coverage is in-flight.

### 2.6 Code/enum fallback + grade-label consistency

- `SubjectRow.tsx:86-88` `ROOM_TYPE_LABELS[preferredRoomType] ?? 'Room not set'` (never the raw enum).
- Align grade shorthand per Decision 5: `GR7` in dense tables/list rows, `Grade 7` in the modal/coverage drawer/audit sheet where space is not constrained. Per Phase 0C.2 sweep.
- "+N room features" gets an `AccessibleInfo` long-help listing them.
- Subject code read-only in edit mode gets a tooltip "The subject code can't be changed after creation because it's referenced in saved schedules."
- **Resolves:** Sub-15, Sub-17, Sub-19, CC-10.

---

## Phase 3 -- Teachers

Depends on Phase 0A (glossary, label floor, AccessibleInfo, AdminDataTable a11y which this table uses).

### 3.1 Restore the three hidden desktop columns

- Mount `FacultyTeachingLoadCell` (subjects count) and `FacultyWeeklyLoadCell` (hours over cap) as actual desktop columns, not just mobile. Add a `Standard` column showing `{creditedHours}h / 30h std` inline -- not in a keyboard-inaccessible tooltip.
- Rename `Load State` column -> `Teaching Load` (the value plus the standard/cap visible in the cell: `Below standard -- 18h / 30h`).
- **Resolves:** T-1, T-2, T-8.
- **Test gate:** Playwright asserts the desktop table renders columns `Teacher | Department | Teaching Load | Subjects | Hours`; the standard/cap values are visible in-cell without hover.

### 3.2 Placeholder visual distinction

- Replace the small violet "Teacher X" badge with a row-level treatment: violet `border-l-2` left border on `FacultyRow` + a "Temporary" label in the Teaching Load cell + an `AccessibleInfo` tooltip "This is a placeholder for a teacher who hasn't been hired yet. Replace before publishing."
- The badge label becomes "Temporary" (Decision shorthand: `TEACHER_X_LABEL`); "Teacher X" no longer appears as a default first/last name anywhere.
- **Resolves:** T-3, T-4.
- **Test gate:** Playwright asserts a placeholder row has a left-border tint and a "Temporary" label distinct from a real unassigned teacher; "Teacher X" does not appear as a default name in `CreatePlaceholderDialog`.

### 3.3 Attention chips: rename + tooltips + `aria-pressed` + no-silent-reset

- Rename: "Needs load" -> "No subjects assigned"; "No active load" -> "No sections assigned" (the actual `subjectCount` vs `sectionCount` distinction, made plain). Add `AccessibleInfo` to each.
- All chips gain `aria-pressed={attentionFilter === chip.id}`.
- "All teachers" chip no longer silently resets `departmentFilter` -- only `attentionFilter`. (Or rename to "Reset attention" if a true reset is wanted.)
- **Resolves:** T-5, T-6, T-15.
- **Test gate:** Playwright asserts clicking "All teachers" keeps the department filter intact; asserts `aria-pressed` toggles.

### 3.4 Fix the perpetual "Load data is still loading."

- When loading is done AND there are zero active teachers, the "Next teacher to review" strip shows "No active teachers to review. Sync the roster first." -- not the loading string. Strip heading renamed from "Next teacher to fix" to "Next teacher to review" (fix-language rule).
- **Resolves:** T-7.
- **Test gate:** Mock empty roster loaded -> strip asserts the "No active teachers" copy, not "Load data is still loading."

### 3.5 `CreatePlaceholderDialog` defaults + labels + Enter-to-save

- Default `firstName`/`lastName` to empty strings; placeholder hint "e.g. To Be Hired (Math)". Dialog opens with focus in the First name field.
- Department `Select` renders `DEPARTMENT_LABELS[code]` not the bare code (per Phase 0A.1).
- Inline field-level validation errors replace toasts.
- "Max Hours/Week" -> "Maximum weekly hours" with helper "Default 30h. Cap is 40h per DepEd policy." Out-of-range input shows an inline error instead of silent clamping.
- "Teach Outside Dept" -> "Can teach outside their department" (full word); Switch label adjacent to the toggle, not buried.
- Wrap the inputs in a `<form>` with `onSubmit={handleSave}` so Enter saves.
- **Resolves:** T-9, T-10, T-11, T-12, T-13, T-14.
- **Test gate:** Playwright asserts the dialog opens with empty name fields; assert Enter key in the First name field submits; assert an out-of-range max hours shows an inline error.

### 3.6 Rename "Credited workload" / "hard repair limit" / approval framing

- Profile sheet: "Credited workload" -> "Total weekly hours (incl. advisory credit)"; add a one-line helper "Advisers get up to 5 hours/week credited toward the standard."
- "hard repair limit" -> "the absolute maximum before ATLAS cannot generate the timetable."
- "Excluded" -> "Excluded from scheduling" everywhere.
- **Decision 3:** "Above standard - approval needed" -> `Above standard -- review before generating`. Severe case: `Over maximum -- move classes before generating`. No approver role added.
- **Resolves:** T-19, T-20, T-23.
- **Test gate:** Playwright asserts the renamed labels and the absence of `hard repair limit`, bare `Excluded`, `approval needed`.

### 3.7 Teachers `RolloverGuidanceCard`

- Replaced by Phase 0B.1 dismissible banner. No per-page rollover card mount on Teachers.
- **Resolves:** T-18.

---

## Phase 4 -- Teaching Load

Depends on Phase 0A.1 (glossary), 0A.3 (`AccessibleInfo`), 0B.1 (Rollover banner), 0C.1 (color reservation).

### 4.1 Collapse `TeachingLoadTaskGuide` into the repair queue

- Delete the standalone `TeachingLoadTaskGuide` render OR fold its only-unique element (the `% staffed` badge) into the readiness strip (which already shows it post the header simplification pass). The "next step" prompt now lives only in `TeachingLoadRepairQueue`.
- Rename per the fix-language rule: "Fix first" / "More fixes" -> `Next step` / `More options`. "Fix", "repair", "fixes" removed from all user-visible text on this page.
- **Resolves:** TL-1, TL-20, and the fix-language rule for this page.
- **Test gate:** Playwright asserts only one "next step" surface; the strings `Fix`, `repair`, `fixes` do not appear in user-visible text on `/teaching-load`.

### 4.2 Make the repair queue truly one-at-a-time

- Render only the current item by default. The "Next items" panel collapses behind a "Show next 3 items" disclosure (closed by default).
- "Skip" button visible at *all* breakpoints (remove `sm:hidden` and the `[@media(max-height:800px)]:hidden` on the panel that hid Skip).
- Description and status text: remove the `[@media(max-height:800px)]:hidden` hide; keep them visible (allow wrapping instead).
- Add explicit "Skipped items still need action before generation" note next to Skip.
- **Resolves:** TL-2, TL-3, TL-4, TL-22.
- **Test gate:** Playwright on a 800px-tall viewport asserts Skip is visible and the description is not hidden.

### 4.3 Single source of truth for Save + Discard confirmation

- Keep only *two* save affordances: the footer action bar (always visible at all viewport heights -- remove `[@media(max-height:500px)]:hidden`) and the per-teacher expanded action bar. Remove the repair-queue and Task-Guide save buttons (they delegate to the footer or signal the count). Labels: "Save N draft changes" everywhere (consistent).
- `Discard` opens a `ConfirmationModal`: "Discard all {N} draft changes? This can't be undone." Two buttons: "Keep changes" (safe, default focus) / "Discard all" (destructive).
- Save-warning modal rewritten in plain DepEd English: "Saving now will update the timetable's unassigned list when ATLAS next syncs (any class whose teacher you changed will be moved back to unassigned). Continue?" No `stale`, `subject allocations`, `displaced` jargon.
- **Resolves:** TL-5, TL-6, TL-7, TL-8.
- **Test gate:** Playwright asserts (a) only two Save buttons, (b) Discard opens a confirm modal with safe button first, (c) save-warning modal contains none of `stale`, `subject allocations`, `displaced`.

### 4.4 Split-brain / quarantine plain-language card

- New in-content card (not just the toolbar badge) when `splitBrainIncident` is present:
  - Title: "Two saved versions of the same class assignment were found."
  - Body: "ATLAS keeps two copies when a sync is interrupted. Choose which one to keep, then continue assigning."
  - Action: "Review and reconcile" (calls `onReconcileClick`).
- `Quarantined` badge in `SubjectRow` gains an `AccessibleInfo` tooltip (Phase 0A.3): "Editing this subject's assignments is temporarily locked while ATLAS checks the saved version. Ask your IT admin if it stays locked."
- Toasts rewritten: "Saved-truth reconcile requires writable runtime evidence" -> "Reconcile needs a live connection. Refresh and try again."; "Reloading current Teaching Load truth." -> "Reloaded the saved assignments."
- **Resolves:** TL-9, TL-10.
- **Test gate:** Playwright asserts the new card copy; asserts the toast strings no longer contain `saved-truth`, `writable runtime evidence`, `scope drift`.

### 4.5 Coverage mode plain labels + "coverage" gloss

- `COVERAGE_MODE_CONFIG` labels become:
  - "Real teachers first, up to 30h/week" (was "Standard Teacher Load (30h)")
  - "Maximum allowed hours (40h)" (was "Hard Cap Utilization (40h)") -- description ties 40h to "DepEd Magna Carta cap".
  - "Real teachers first, then substitutes" (was "Hybrid Staffing (Real + Temp)").
- Add a one-time gloss `AccessibleInfo` (Decision 6) near the "% staffed" chip: "Coverage = how many class-sections have a teacher assigned. 'Staffed' includes real teachers and substitutes." Tooltip on hover/focus, Popover on click.
- **Resolves:** TL-17, TL-23.
- **Test gate:** Playwright asserts the new coverage-mode labels; the gloss `AccessibleInfo` trigger is keyboard-focusable and opens a Popover on Enter.

### 4.6 Keyboard-operable section assignment + row expand

- `SubjectRow.tsx:484-613` section cell div: add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space toggles), focus ring (`focus-visible:ring-2`).
- `TeacherGridMode.tsx:313-323` department collapse + `:346-352` teacher expand: same -- add `role="button"`, `tabIndex={0}`, `onKeyDown`, `aria-expanded`.
- Remove `pointer-events-none` from the `Checkbox` (or wrap it so the visible checkbox is the click target but stays keyboard-focusable).
- `TeacherGridMode.tsx:410-411` Undo/Redo: add `aria-label` + `AccessibleInfo` tooltip (Phase 0A.3).
- **Resolves:** TL-11, TL-12, TL-13.
- **Test gate:** Playwright keyboard-only test assigns a section via Enter; expands a teacher via Enter; Undo button announces "Undo" and has a tooltip.

### 4.7 Reduce subject-row badge density

- Cap at 3 simultaneous badges per subject row by default: Code, Coverage (assigned/total), and one priority alert (Quarantined > DB Conflict > Rotating > Outside Dept). Other badges move into an `AccessibleInfo` long-help (Phase 0A.3).
- "DB Conflict" -> "Two teachers both saved as owner" (badge + `AccessibleInfo` explaining the resolution). No "DB Conflict" string anywhere.
- **Resolves:** TL-15, TL-16.
- **Test gate:** Playwright asserts at most 3 badges render by default; `DB Conflict` string is absent.

### 4.8 Mobile inspector drawer + responsive row collapse

- Below `lg`, render the inspector (`WorkloadInspector` / `SectionInspector`) in a `Sheet` opened by a "View profile" button on each row, instead of hard-cutting it.
- Teacher row header collapses to a stacked layout below `sm` (avatar + name on top row; numeric signals + chevron on a second row).
- **Resolves:** TL-14, mobile responsive finding 12.2.
- **Test gate:** Playwright on mobile portrait asserts the inspector opens as a Sheet; the teacher row stacks.

### 4.9 `StaffingAuditSheet` refactor

- Replace the 2-col metric cards with an inline stat banner (`scale-100` style, dense) per AGENTS "no giant cards" rule.
- Rename headers per the fix-language rule and glossary: "Staffing Health Audit" -> `Staffing summary`; "Operational report on current school year teaching load coverage." -> `Overview of teaching coverage for {activeYear}.`; "Temp Roles / Teacher X Assignments" -> `Temporary teachers`; "Active Faculty / Excluding Placeholders" -> `Real teachers (no substitutes)`; "Overload States" -> `Above the weekly max`; "Overload Review / Teachers above 30h" -> `Teachers above 30h standard`; "Special Programs / SPA, SPS, STE Staffing" -> uses Phase 0A.1 program labels.
- "Go to Allocation Workflow" -> `Assign by section` (links to section view).
- **Resolves:** TL-27, TL-28, TL-29.
- **Test gate:** Playwright asserts the sheet uses inline stat banner classes (not `rounded-2xl border` metric cards); asserts the renamed headers; the strings `Operational report`, `Temp Roles`, `Overload States` are absent.

### 4.10 Teaching Load state copy cleanup

- Empty-state: replace hardcoded "2026-2027" (`TeachingLoad.tsx:583`) with the dynamic `activeSchoolYearLabel`.
- `SubjectRow` empty-state: use `subject.name` not `subject.code`.
- Read-only banner: "Saving is off until ATLAS reconnects to EnrollPro. Your work is safe to review." instead of "Verifies the live source... writable... snapshot."
- Add an in-content offline banner when `!isOnline` (not only the toolbar).
- **Resolves:** TL-24, TL-25, TL-26.
- **Test gate:** Playwright asserts no hardcoded year; read-only banner contains "reconnects to EnrollPro" not "live source".

---

## Out of Scope

- New source-of-truth, routing, or backend behavior beyond: (a) the new `/admin/year-setup` route + role guard (Phase 0B), (b) surfacing dynamic `activeSchoolYearLabel` (Phase 4.10), (c) driving the coverage-drawer failure-vs-empty distinction (mocked in tests).
- Mobile-native or PWA shell changes beyond the inspector drawer in Phase 4.8.
- ScheduleReview / Dashboard / Map pages (only the four setup pages are in scope).
- Cosmetic-only timetable polish the priority override already defers.
- Localization infrastructure (English-only is the v1 contract); the glossary is the v1 way to make English plainer for the persona.

## Open Questions

All six prior open questions are **resolved and locked** above (Decisions 1-6, fix-language rule). No remaining open questions block implementation.

## Acceptance

- Phase 0A gates pass before any per-page phase begins.
- Phases 1+ may begin before 0B and 0C provided the per-page work does not itself depend on rollover reset or color cleanup (call this out per phase above).
- Each per-page phase passes its own test gates + the predecessor header-simplification spec.
- Visual scan across all four pages confirms: no sub-0.7rem uppercase-tracked sentence labels; no raw SCI/MATH/ENG/FIL codes visible; no `RESET_DUMMY_SCHOOL_YEAR_1` token on any setup page; sort/pagination controls are keyboard-announced; `RolloverGuidanceCard` is dismissible and non-destructive on setup pages; "Fix"/"repair"/"fixes" absent from user-visible copy.
- No new global scrollbars; no horizontal page overflow at 360px mobile portrait, 768px tablet, and 1366px laptop.
- All existing `ux-guardrails.test.ts` tests continue to pass.
- All six Resolved Decisions and the fix-language rule are honored in the final rendered UI (verified by the per-phase test gates).

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-08-08 | atlas-uiux-expert | Initial plan from the setup content-area UX audit. Phased 0-4 with cross-cutting Phase 0 first. Open questions listed. |
| 2026-08-08 | atlas-uiux-expert | User-approved revision: split Phase 0 into 0A/0B/0C; folded in six locked decisions; added explicit "fix" language reduction rule; cleaned non-ASCII punctuation (arrows, em/en dashes, ellipses, middots, curly quotes, no-break space) to ASCII equivalents so the file is safe to use as an implementation prompt. |