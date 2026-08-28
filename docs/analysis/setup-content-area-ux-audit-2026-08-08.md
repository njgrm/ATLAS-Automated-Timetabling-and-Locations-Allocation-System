# Setup Content-Area UX/UI Audit

Date: 2026-08-08
Audited surfaces: Sections, Subjects, Teachers (Faculty), Teaching Load -- every element below the already-simplified command header and readiness strip.
Primary user lens: 55+ non-technical DepEd scheduler officer.
Predecessor audits: `docs/analysis/setup-header-density-audit-2026-08-08.md`, `docs/analysis/setup-header-residual-density-audit-2026-08-08.md`.
Source audits (full per-page detail): explore-agent runs against `Sections.tsx`, `Subjects.tsx`, `Faculty.tsx`, `TeachingLoad.tsx` plus their imported row/modal/sheet/grid components and `RolloverGuidanceCard.tsx`.

## Verdict

CONDITIONAL GO for the command header band (now compact), but the content areas beneath are still **NO-GO for the primary persona**. The same density/jargon/a11y pattern that produced the header bloat repeated one band lower: sub-10px uppercase tracked text, raw department/program codes never expanded, tooltips as the *only* storage for essential metrics (and keyboard-inaccessible at that), an intrusive undismissable `RolloverGuidanceCard` with a destructive reset surfaced on routine pages, icon-only buttons without aria-labels, no `aria-sort` on sortable tables, and per-page jargon (`Teacher X`, `split-brain`, `quarantine`, `Hard Cap`, `Load State`, `Displaced Section`) that a non-technical DepEd officer cannot parse.

This pass consolidates findings into cross-cutting themes (the same root cause repeating on every page) then per-page specifics. Severity: **High** blocks or seriously misleads the persona; **Medium** adds friction; **Low** is polish.

---

## Cross-Cutting Findings (Root Causes Repeating On Every Page)

### CC-1. Sub-10px uppercase tracked text is the dominant label type -- fails the persona
- **Where (representative):** `SubjectFormModal.tsx:246,257,298,344,391,413,421,458,476,558,567,585`; `FacultyRow.tsx:58-81` (three `[0.6-0.65rem]` caption lines per row); `SectionRoomPicker.tsx:105,181,209,217,218`; `SectionHomeRoomModals.tsx:62,77,81,91`; `SectionRow.tsx:100,106,125`; `StaffingAuditSheet.tsx` section headers; `TeachingLoadTaskGuide.tsx; TeachingLoadRepairQueue.tsx` micro-labels.
- **What:** Field labels, badge sub-text, helper copy, and section headers consistently render at `text-[0.55rem]`-`text-[0.7rem]` (~=9-11px), `font-bold`, `uppercase tracking-wide`/`tracking-widest`, often `text-muted-foreground`.
- **Why High:** Below WCAG 1.4.4 once the user agent zooms to 200%; uppercase destroys word-shape cues; muted-on-background at small sizes fails contrast for presbyopic eyes. The persona's lifeline (help text under fields) is rendered at the *least* readable size on the page.

### CC-2. Raw department codes (SCI/MATH/ENG/FIL/ESP/AP/MAPEH/TLE) never expanded anywhere
- **Where:** `FacultyRow.tsx:90` (row badge prints `subject.ownerDepartment || 'GENERAL'` verbatim); `CreatePlaceholderDialog.tsx:170-180` (Select options are the bare codes); `Subjects.tsx` row badge (`SubjectRow.tsx:115`); `Faculty.tsx:661` (filter Select options).
- **What:** `normalizeDepartmentCode` (`faculty-assignment-helpers.ts:21-46`) canonicalises to `SCI`, `MATH`, `ENG`, `FIL`. These are *not* DepEd acronyms. The real learning-area names are Science, Mathematics, English, Filipino, Araling Panlipunan (AP), Edukasyon sa Pagpapakatao (ESP), MAPEH, Technology and Livelihood Education (TLE). AP/ESP/MAPEH/TLE are real DepEd acronyms users know; SCI/ENG/FIL are not.
- **Why High:** A 55-year-old officer who learned "Filipino" cannot tell that `FIL` = Filipino without remembering the mapping. No tooltip expands them anywhere on any page.

### CC-3. Raw special-program codes (STE/SPA/SPS/SPJ/SPFL/SPTVE) never expanded
- **Where:** `Sections.tsx:839-850` (filter); `subject-constants.ts:18-24` (constants); surfaced in row badges, modal toggles, coverage drawer.
- **What:** Six unexplained acronyms (Science-Tech-Engineering; Special Program in the Arts; in Sports; in Journalism; in Foreign Language; in Tech-Voc Education). None are expanded anywhere, no tooltip, no HoverCard.
- **Why High:** The single most opaque filter on the Sections page. The 6-letter `SPTVE` also truncates inside a `text-[0.6rem]` 4-line badge.

### CC-4. `RolloverGuidanceCard` is intrusive, undismissable, and exposes a destructive `RESET_DUMMY_SCHOOL_YEAR_1` token on routine content pages
- **Where:** `RolloverGuidanceCard.tsx:173-308`; mounted on Sections (`Sections.tsx:867`), Subjects (`Subjects.tsx` content top), Teachers (`Faculty.tsx:679`), Teaching Load (`TeachingLoad.tsx:886`), Dashboard, ScheduleReview header.
- **What:** (a) `compact` only collapses the card to a pill *when drift is `aligned`*; every *non-aligned* state renders the full multi-button card permanently above the table -- ~110-150px of vertical real estate that erodes the table area and breaks the No-Scroll Architecture rule. (b) No X / dismiss / "remind me later" affordance. (c) A `variant="destructive"` `Reset dummy data` button sits *inline* on routine pages beside non-destructive actions. (d) Reset confirmation requires the non-technical user to type `RESET_DUMMY_SCHOOL_YEAR_1` (all-caps snake_case) -- engineering scaffolding surfaced to end users. (e) Reset count rows (`RolloverGuidanceCard.tsx:45-58`) list `Section mirrors`, `Generation runs`, `Follow-up flags`, `Teaching Load owners`, `Draft locks`, `Cohorts`, `Old audit rows` -- backend domain language. (f) Status badges leak `Migration needed`, `Source not verified`, `drift`, `enrollpro-unreachable`.
- **Why High:** Compounds page-after-page: the same blocking card appears on four setup pages. The persona will either ignore it (missing real year-rollover warnings) or click `Reset dummy data` (catastrophic for a real school's data) without understanding it's destructive.

### CC-5. Pagination icon-only buttons lack aria-labels and visible tooltips -- direct AGENTS.md violation
- **Where:** `Subjects.tsx:711-716` (ChevronsLeft / ChevronLeft / ChevronRight / ChevronsRight, `size="icon"`, no aria-label); `Sections.tsx:906` (same four, no aria-label, no tooltip); `AdminDataTable.tsx:157-163` (Faculty/Teachers -- has aria-label but no visible tooltip); `TeachingLoad` grid uses custom divs (separate a11y failure).
- **Why High:** AGENTS.md rule "icon-only buttons need tooltips" is explicit. WCAG 4.1.2 also fails (SR announces "button"). Touch targets at 28-32px also breach 44px guidance for older users.

### CC-6. Sortable tables miss `aria-sort` and sort-button `aria-label` across all four pages
- **Where:** `Subjects.tsx:738-757`; `Sections.tsx:928-942`; `AdminDataTable.tsx:226-245` (Faculty); Teaching Load grids use div onClick (no sort semantics at all).
- **Why High:** SR users have no programmatic indication of which column is sorted and in which direction. Also no visible tooltip "Sort by X" -- the only affordance is a 12px icon swap.

### CC-7. DepEd G9=Red collides with error/fill-state red on the same page
- **Where:** `SectionRow.tsx:26` (G9 = red per rule), `:45` (fill >=95% = red fill pill), `Sections.tsx:889` (blocked-edit red banner). Three semantically different things all use red, two of which violate the AGENTS rule that grade colors are reserved for *grade-level meaning only*.
- **Why High:** WCAG 1.4.1 (Use of Color) plus the project's own grade-color reservation rule. The persona cannot form a stable "red = problem" mental model.

### CC-8. Tooltip-only storage for essential metrics, keyboard-inaccessible
- **Where:** `FacultyRow.tsx:128-144` -- `FacultyLoadStateBadge` wraps a `<Badge>` (span, not focusable) in a Radix Tooltip; the *only* place the 30h standard and 40h cap are explained. Keyboard users can never trigger it. `SubjectRow.tsx` "Rotating Term Lane" tooltip similar. `Subjects.tsx` "+N room features" sub-label has *no* tooltip despite being the only signal that feature requirements exist.
- **Why High:** Violates WCAG 1.4.13 (tooltip content keyboard-accessible) and 2.1.1 (keyboard-operable). The standard/cap that the persona needs to interpret "Below standard - 18h" is locked behind hover.

### CC-9. "Coverage" is one word used for three concepts
- **Where:** "teacher coverage" (a teacher assigned to a subject), "grade coverage" (every grade has a teacher), "program coverage" (every program scope has a teacher). `Subjects.tsx:875,886,917,925,945`; row action aria-label says "Review teacher coverage" (`SubjectRow.tsx:195`).
- **Why Medium-High:** The persona cannot tell from a "Coverage" column header which dimension is meant. The Subjects coverage drawer even claims "All listed grades have assigned coverage" green-check (line 939) while silently ignoring program-scope gaps.

### CC-10. Dead/duplicate/divergent code paths
- **Subjects:** `SubjectAddForm.tsx` (252 lines) not imported by `Subjects.tsx`; uses `G7` shorthand vs `Grade 7` in modal vs `GR7` in `gradeLabel()` -- three divergent shorthand styles.
- **`grade-labels.ts:7-9`:** JSDoc claims `Gx` (G7, G8...) but function returns `GR${grade}` -- `GR7`. Misaligned with the documented intent.
- **`QUALIFICATION_PRIORITY_OPTIONS`** (`subject-constants.ts:94-96`): defines `SPECIALIZATION_PRIMARY` but never exposes it; dead type.
- **Why Medium:** Maintenance hazard; divergent shorthand will drift further.

### CC-11. Icon-only action buttons with no tooltip or aria-label (besides pagination)
- **Where:** `TeacherGridMode.tsx:410-411` (Undo/Redo, `size="icon-xs"`, no aria-label, no Tooltip -- direct AGENTS violation); `SubjectRow.tsx` kebab trigger has `aria-label` but no visible Tooltip; row-name buttons (`SectionRow.tsx:84-110`, `FacultyRow.tsx`) have `aria-label` only, inconsistent with sibling icon buttons that have both.
- **Why Medium-High:** The Undo/Redo buttons in the Teaching Load expanded action bar are the worst -- the persona has no clue what the curved-arrow icons do.

### CC-12. `EnrollPro` and `Sync` never explained to the user
- **Where:** `Sections.tsx:880` ("EnrollPro is temporarily unavailable"); `Faculty.tsx:783` ("Sync from EnrollPro"); RolloverGuidanceCard badges; source-state popovers.
- **What:** A DepEd scheduler may have heard of EnrollPro (the DepEd enrollment system) but the relationship "ATLAS uses EnrollPro as roster source" is never stated on any page. "Run a sync" appears in error banners as if self-evident.
- **Why Medium:** First-time users assume the two products are unrelated.

---

## Page-Specific Findings

### A. Sections (`Sections.tsx` + `SectionRow.tsx`, `SectionRoomPicker.tsx`, `SectionHomeRoomModals.tsx`, `SectionDetailsSheet.tsx`)

- **S-1 (High) -- Home-room picker doesn't look interactive.** `SectionRoomPicker.tsx:92-122`: trigger is a `Button variant="outline"` showing room name or italic "Choose home room" with a `size-3 opacity-40` chevron. The page's central workflow's discoverability signal is the smallest widget on the row. Picking an *occupied* room silently escalates to a swap modal with no upfront "this will swap" cue.
- **S-2 (High) -- No "start here" guidance for the core workflow.** Readiness strip says "Need rooms: N" but nothing in the content area tells the user where to click to fix that.
- **S-3 (High) -- `SwapConfirmationModal` "Final Outcome" sentence is grammatically broken.** `SectionHomeRoomModals.tsx:105-113`: renders *"Rizal becomes moved to Room 101"* or *"Rizal becomes Unassigned"*. "becomes moved to" is not valid English. This is the key summary line in the page's only destructive-shift confirmation.
- **S-4 (High) -- Displaced-section "Unassigned" path lacks explicit consequence.** When `currentRoomName === null` the displaced section becomes *unassigned* -- a genuine regression -- but the modal only shows small italic "Unassigned" without telescoping "Rizal now has no home room -- it must be reassigned before generation."
- **S-5 (High) -- `SectionRoomPicker` breaks the ARIA combobox pattern.** `:92-122` declares `role="combobox"` + `aria-expanded` but options are plain `<Button>`s inside a `ScrollArea` -- no `role="listbox"`, no `role="option"`, no `aria-selected`. The `onOpenAutoFocus={(e) => e.preventDefault()}` (`:126`) intentionally suppresses the popover's focus trap.
- **S-6 (High) -- Unassign Confirmation Modal has inverted destructive-action order.** `SectionHomeRoomModals.tsx:149-175`: "Unassign Room" (destructive) is *first/top*, "Keep Assignment" (safe) is *second/bottom/ghost*. Standard a11y guidance is the opposite order -- destructive and visually distinct, safe first.
- **S-7 (Medium) -- "Status" column header is misleading; shows fill-rate.** `Sections.tsx:941` header `Status`, cell renders `{fill}%` (`SectionRow.tsx:137-139`). Should be `% Full` / `Filled`.
- **S-8 (Medium) -- Triple-redundant row actions to two destinations.** `SectionRow.tsx:84-110` (section name -> details), `:168-217` (Users icon -> details, ClipboardList -> teaching-load, MoreVertical -> details + teaching-load). Four doorways to two rooms.
- **S-9 (Medium) -- "Displaced Section" / "Source Section" vocabulary is technical.** `SectionHomeRoomModals.tsx:62,77`.
- **S-10 (Medium) -- Rollover stacks with status banner and empty-state panel on degraded pages.** `Sections.tsx:866-868` (card) + `:871-883` (banners) + `:952-953` (empty panel) = three "things are off" surfaces stacked.
- **S-11 (Medium) -- `no-year` message uses "sync" jargon.** `Sections.tsx:228-232`: "Run at least one successful sync, then retry." Should be plain: "Ask your IT admin to set the active year in Settings, then return here."
- **S-12 (Medium) -- `unavailable` fallback banner says "EnrollPro is temporarily unavailable" + retry button at `h-7` (28px, below touch target).** `Sections.tsx:877-883`.
- **S-13 (Medium) -- Home-room cell `min-w-56` (224px) forces 7-column horizontal overflow on tablets.** `SectionRow.tsx:142`. The `hidden md:table` switch helps phones, but 768-900px viewports scroll horizontally.
- **S-14 (Medium) -- No per-row "queued for sync" affordance on offline save failure.** `Sections.tsx:385-396` queues locally; only the top banner tells the user. Older user walks away thinking they saved server-side.
- **S-15 (Medium) -- "Reset all"/"All teachers" chip secretly resets the department filter too.** Disguised "reset everything" -- surprising for what looks like a chip toggle.

### B. Subjects (`Subjects.tsx` + `SubjectRow.tsx`, `SubjectFormModal.tsx`, `SubjectAddForm.tsx`)

- **Sub-1 (High) -- Add/Edit modal presents ~14 inputs across 4 numbered sections with no progress/stepper.** `SubjectFormModal.tsx:237-616`. The "Advanced scheduling rules" section (lines 500-616) alone contains inter-section pooling, modular rotation, and room features -- three paragraphs of concepts. No "optional / skip if unsure" gate.
- **Sub-2 (High) -- Validation is silent; Save button just disables.** `SubjectFormModal.tsx:156-159,623` (`canSave` -> `disabled`). No inline field-level error text, no tooltip on the disabled button explaining why. Directly violates AGENTS "disabled states explicit."
- **Sub-3 (High) -- Time-unit toggle footgun.** Modal defaults to `minutes` (`SubjectFormModal.tsx:82`) with tiny `min`/`hr` pills; the numeric suffix renders `minutes`/`hours` literally (lines 334-336). *Three* abbreviations for the same concept (`min`, `minutes`, `hr`, `hours`) appear in a ~30-line span. The list (post our recent fix) is hardcoded to hours, but the modal still defaults to minutes -- so a user entering `240` thinking hours stores 240 minutes = 4 hours.
- **Sub-4 (High) -- Coverage drawer always shows "Term rotation" panel even for non-rotating subjects.** `Subjects.tsx:817-852` unconditional render. Opening coverage for a regular Math subject shows a violet "Term rotation" panel telling the user rotating subjects share time -- confusing and irrelevant.
- **Sub-5 (High) -- Coverage fetch failure is visually indistinguishable from "no teachers assigned."** `Subjects.tsx:221-225` catches and toasts, then `setCoverageLoading(false)`; the drawer renders an empty `assigned` array -> falls through to "No teachers assigned to this subject yet." (line 903). A network failure is misclassified as a coverage gap -- the user clicks "Fix in Teaching Load" thinking they have a gap when really the fetch failed.
- **Sub-6 (High) -- "Uncovered scope" panel only checks grades, silently ignores program-scope gaps.** `Subjects.tsx:914-957` heading promises both, body only evaluates grades. STE/SPA/SPS program-specific gaps produce a false green "All listed grades have assigned coverage" check.
- **Sub-7 (High) -- Table omits Owner/Program/Coverage columns.** `SubjectRow.tsx:98-184` only shows Subject & Code, Weekly time, Room need, Grades, Actions. The readiness strip urges fixing "Missing coverage" and "Room constrained" but the table gives no at-a-glance Coverage column; Owner/Program scope are buried as 0.55rem badges behind a tooltip.
- **Sub-8 (High) -- Field labels and help text in the modal are 0.7rem / 0.65rem uppercase.** See CC-1.
- **Sub-9 (High) -- `isSeedable` defaults to `false`; "Schedulable" badge has no tooltip.** `subject-constants.ts:132`; `SubjectRow.tsx:138-142`. A newly-added subject shows no `Schedulable` badge -> user assumes creation failed. Three labels for the same flag ("Can be scheduled" in modal, "Schedulable" in row, "isSeedable" in code); tooltip mentions "HG, Consult" unexpanded.
- **Sub-10 (High) -- Coverage drawer `w-100 sm:w-135` are non-default Tailwind classes** (`Subjects.tsx:798`). Silently fall back to default Radix width.
- **Sub-11 (Medium) -- Error banner has no "Try again" button; sync-error banner does.** `Subjects.tsx:669-687` vs `:669-677`. Inconsistent recovery UX on the same page.
- **Sub-12 (Medium) -- "Missing coverage" stat can render the literal string `"Checking"` as a value.** `Subjects.tsx:432`. Information-poor; a spinner/skeleton would be clearer.
- **Sub-13 (Medium) -- `Reset all` does not clear the search query.** `Subjects.tsx:653-659`. A user who typed a search and clicked "Reset all" is confused why the list is still filtered.
- **Sub-14 (Medium) -- Filter category label "All attention states" is jargon.** `Subjects.tsx:606-613`. The option text is plain but the category label is internal vocabulary.
- **Sub-15 (Medium) -- "Room need" column leaks raw enum when label mapping is missing.** `SubjectRow.tsx:86-88` falls back to `subject.preferredRoomType` -- the raw SCREAMING_SNAKE.
- **Sub-16 (Medium) -- Mobile modal grid stays 2-col on narrow screens.** `SubjectFormModal.tsx:244,342,389,425` use `grid-cols-2` with no `sm:`/`md:` breakpoint. On a 400px phone, Code and Name cram at ~190px each.
- **Sub-17 (Medium) -- `+N room features` sub-label has no tooltip listing them.** `SubjectRow.tsx:175-177`.
- **Sub-18 (Medium) -- "Schedulable" / Program-scope / "Rotation family" badges jargon.** See CC and Sec 12 jargon table.
- **Sub-19 (Medium) -- Subject code is read-only in edit mode with no explanation.** `SubjectFormModal.tsx:250-252` looks disabled but no tooltip says why.
- **Sub-20 (Low) -- Weekly-time sub-caption `Weekly time` repeats the column header redundantly.** `SubjectRow.tsx:167-168`.
- **Sub-21 (Low) -- Mobile card missing rotation/program-scope signals desktop shows.** `Subjects.tsx:497-504` -- inconsistent mental model.
- **Sub-22 (Low) -- Mobile sort unavailable on cards; sort is desktop-only.** `Subjects.tsx:720-734`.

### C. Teachers / Faculty (`Faculty.tsx` + `FacultyRow.tsx`, `CreatePlaceholderDialog.tsx`, `FacultyProfileSheet.tsx`)

- **T-1 (High) -- Desktop table omits subject count, section count, and weekly hours as their own columns.** `Faculty.tsx:462-488` mounts only Teacher, Department, Load State. The `FacultyTeachingLoadCell` and `FacultyWeeklyLoadCell` components exist (`FacultyRow.tsx:101-126`) but are imported and *never mounted* on desktop -- only on mobile cards. Desktop users must hover the Load State badge to see hours. Cannot compare weekly hours across rows at a glance.
- **T-2 (High) -- "Load State" column header uses the two terms it fails to define.** `Faculty.tsx:481-482`: "Readiness against standard and cap." -- `standard` (30h) and `cap` (40h) appear only inside the hover tooltip, which is keyboard-inaccessible (CC-8).
- **T-3 (High) -- "Teacher X" badge has no tooltip.** `FacultyRow.tsx:67`. Means a placeholder for a to-be-hired teacher. Three labels for the same concept ("Teacher X", "placeholder", "synthetic placeholder" in code); none explained.
- **T-4 (High) -- Placeholders are visually indistinguishable from real unassigned teachers.** `FacultyRow.tsx:128-144` + `:67`. Only a tiny violet badge differentiates. No row-level background tint, no purple left-border, no "temporary" label in the Load State column. Placeholder renders with `loadRank=4` ("No teaching load") -- same as a real newly-synced teacher.
- **T-5 (High) -- Attention chips "Needs load" vs "No active load" are indistinguishable.** `Faculty.tsx:565-571`. "Needs load" = `subjectCount === 0`; "No active load" = `sectionCount === 0`. Both read as "this teacher has no teaching." No tooltips.
- **T-6 (High) -- "All teachers" chip secretly resets the department filter.** `Faculty.tsx:570, applyAttentionFilter` resets `schedulingFilter/assignmentFilter/departmentFilter`. Surprising for what looks like a chip toggle.
- **T-7 (High) -- "Next teacher to fix" strip perpetually says "Load data is still loading." even when the roster is empty (not loading).** `Faculty.tsx:697` + `:516-524` returns null when no active teachers. False "loading" message after loading is done.
- **T-8 (High) -- Tooltip-only storage for the 30h standard / 40h cap; keyboard-inaccessible.** `FacultyRow.tsx:128-144` wraps a non-focusable `<Badge>` in a Radix Tooltip. CC-8.
- **T-9 (High) -- `CreatePlaceholderDialog` defaults `firstName='Teacher', lastName='X'`.** `CreatePlaceholderDialog.tsx:65-66`. Pre-fills the form with the literal brand string "Teacher X", compounds the jargon. Should default to empty with placeholder hint "To Be Hired (Math)".
- **T-10 (High) -- Department Select in placeholder dialog shows bare codes (SCI/MATH/ENG/FIL).** `CreatePlaceholderDialog.tsx:170-180`. CC-2.
- **T-11 (Medium) -- No inline field-level validation errors; toasts auto-dismiss.** `CreatePlaceholderDialog.tsx:79-90`. Older user scrolled to a different field misses the toast.
- **T-12 (Medium) -- "Max Hours/Week" silently clamps out-of-range input.** `CreatePlaceholderDialog.tsx:208-223` clamps to [1,60] with no feedback. User types 75 -> silently becomes 60. Confusing.
- **T-13 (Medium) -- "Teach Outside Dept" label uses "Dept" abbreviation; Switch is buried in a bordered box.** `CreatePlaceholderDialog.tsx:225-235`.
- **T-14 (Medium) -- No `<form>` wrapper; Enter key doesn't submit.** `CreatePlaceholderDialog.tsx:130-260`. Older users press Enter to save.
- **T-15 (Medium) -- Attention chips have no `aria-pressed`; SR can't tell which is selected.** Only the visual `variant` changes.
- **T-16 (Medium) -- Attention chips hidden helper text below md.** `Faculty.tsx:694` (`md:inline`). Tablet/short laptop loses the most important explanatory sentence.
- **T-17 (Medium) -- `Reset all` button loses the department filter the user may have intentionally set.** `Faculty.tsx:665-673`.
- **T-18 (Medium) -- `RolloverGuidanceCard` on the Teachers page pulls cognitive load away from reviewing teachers.** CC-4.
- **T-19 (Medium) -- "Credited workload" / "policyCreditedHours" / "Advisory Credit" never explained.** `FacultyProfileSheet.tsx:143,149,162,166`; "Credited workload" caption on mobile `FacultyRow.tsx:167`.
- **T-20 (Medium) -- `hard repair limit` is engineer-speak.** `FacultyProfileSheet.tsx:168`. "Repair" used as a verb (`:44`, `:127`) is engineering vocabulary, not DepEd.
- **T-21 (Medium) -- Employee ID `tracking-tighter` on 10.4px mono is hard to read.** `FacultyRow.tsx:76`.
- **T-22 (Medium) -- Desktop `min-w-60`/`min-w-52` force horizontal scroll at 768-820px.** `Faculty.tsx:468,476`.
- **T-23 (Medium) -- "Above standard - approval needed" doesn't say from whom.** ATLAS has no approver role surfaced to a scheduler.
- **T-24 (Low) -- Avatar initials crash on empty `firstName`.** `FacultyRow.tsx:61-63` `firstName[0]` is `undefined` if empty during edit.

### D. Teaching Load (`TeachingLoad.tsx` + `WorkspaceToolbar`, `TeachingLoadTaskGuide`, `TeachingLoadRepairQueue`, `TeacherGridMode`, `SubjectRow`, `SectionGridMode`, `StaffingAuditSheet`, `TeachingLoadDraftActionBar`)

- **TL-1 (High) -- `TeachingLoadTaskGuide` duplicates both the readiness strip *and* the repair queue.** `TeachingLoadTaskGuide.tsx:40-56` shows "next fix" with a primary button; `TeachingLoadRepairQueue.tsx:99-166` shows the same "next fix" + primary button; the readiness strip (post our recent fix) shows `% staffed` + `Unassigned pairs` + alert chip. Three "next-step" surfaces stacked vertically before any actual content.
- **TL-2 (High) -- Repair queue is labeled "guided" but shows up to 4 items at once.** `TeachingLoadRepairQueue.tsx:195-216` lists 3 "next items" alongside the current item; `useTeachingLoadRepairQueue.ts:82-156` builds up to 11 items. Not one-decision-at-a-time.
- **TL-3 (High) -- "Skip" button is `sm:hidden` (mobile-only); on desktop/short laptops it's buried/unreachable.** `TeachingLoadRepairQueue.tsx:149` (`sm:hidden`) and `:218-220` (the only other Skip, hidden `xl:flex`). On a 13" laptop (<=800px tall) `[@media(max-height:800px)]:hidden` on the "Next items" panel hides the only desktop Skip.
- **TL-4 (High) -- Current-item description and status vanish on viewports <=800px tall.** `TeachingLoadRepairQueue.tsx:122-123` (`line-clamp-1 ... [@media(max-height:800px)]:hidden`). The guidance a non-technical user needs before pressing the button is hidden precisely on common laptop heights.
- **TL-5 (High) -- Five different "Save" buttons on screen simultaneously.** `TeachingLoadDraftActionBar.tsx:50-53` (footer Save Draft); `TeacherGridMode.tsx:436-444` (per-teacher Save Draft); `SectionGridMode.tsx:225-237` (Save All pill); repair queue "Save N"; Task Guide "Save N". Labels vary ("Save draft", "Save Draft", "Save All", "Save N", "Save 3"). The persona cannot tell whether each saves a different scope.
- **TL-6 (High) -- Footer save/discard/undo buttons hide on viewports <=500px tall.** `TeachingLoadDraftActionBar.tsx:43,47,50` (`[@media(max-height:500px)]:hidden`). No way to save in landscape/split-screen except via per-teacher expanded Save.
- **TL-7 (High) -- `Discard draft` has no confirmation; one click destroys all drafts.** `TeachingLoadDraftActionBar.tsx:47` -> `discardAllDrafts` (`TeachingLoad.tsx:533-539`) immediately clears everything with only an undo via history. Misclick = minutes of work lost. Older users are more prone to misclicks.
- **TL-8 (High) -- Save-warning modal is verbose and uses "displaced" jargon.** `TeachingLoad.tsx:1098-1106`: "Saving these changes will make the current active draft timetable stale. Any sessions whose teachers or subject allocations were modified will be displaced to the unassigned list once the timetable is synced." The persona cannot evaluate this.
- **TL-9 (High) -- Split-brain toasts use engineering vocabulary.** `TeachingLoad.tsx:175` ("Saved-truth reconcile requires writable runtime evidence. Refresh and try again."); `:189` ("Saved coverage reconcile applied. Reloading current Teaching Load truth."); `:624` ("Repair saved scope drift before changing assignments."). "Saved-truth", "writable runtime evidence", "scope drift", "reconcile" -- backend vocabulary surfaced to end users.
- **TL-10 (High) -- `Quarantined` badge appears with no in-line explanation.** `SubjectRow.tsx:319-321` red badge, no tooltip; toast fallback "Assignments temporarily locked while data review finishes" (`:220-221`) is passive with no agent -- nobody knows who is reviewing or what to do.
- **TL-11 (High) -- Section assignment is not keyboard operable.** `SubjectRow.tsx:516-524` Checkbox has `pointer-events-none`; only the wrapping div's onClick works; the div has no `tabIndex`, no `onKeyDown`, no `role="checkbox"`. Keyboard-only users cannot assign any section. Major a11y failure.
- **TL-12 (High) -- Department-group collapse and teacher-row expand use div onClick with no role/tabIndex/keyboard handler.** `TeacherGridMode.tsx:313-323, 346-352`; `SectionGridMode.tsx:269-272`; `SubjectRow.tsx:397-404`. Same a11y failure as TL-11.
- **TL-13 (High) -- Undo/Redo icon buttons in expanded action bar lack aria-labels AND tooltips.** `TeacherGridMode.tsx:410-411` -- `size="icon-xs"`, no aria-label, no Tooltip. Direct AGENTS violation.
- **TL-14 (High) -- Right inspector panel is hard-cut below `lg` with no mobile drawer fallback.** `TeachingLoad.tsx:1031` `hidden ... lg:block`. Mobile users cannot access the load profile, cross-department toggle, or quarantine reason.
- **TL-15 (High) -- Subject rows in the grid carry up to 7 badges simultaneously; teacher row carries 5+.** `SubjectRow.tsx:280-379` badges: Outside Dept, Rotating Term Lane + tooltip, Term label, Requires Specialization, Quarantined, code, minutes/week, Assigned/Total, Select All, global chevron. Plus section cells add more colors (system-assigned amber, hard-conflict rose, perfect-match emerald, rotational violet). The persona cannot triage which color/badge deserves attention first.
- **TL-16 (High) -- "DB Conflict" badge + "Ownership conflict: X already owns this" toast.** `SubjectRow.tsx:459, 578-579, 261`. "DB Conflict" sounds like a database catastrophe to a 55-year-old, not "two teachers were both saved as owner for the same class".
- **TL-17 (High) -- Coverage mode labels are unexplained jargon.** `TeachingLoad.tsx:46-59`: "Hard Cap Utilization (40h)", "Hybrid Staffing (Real + Temp)", "Teacher X". The "40h legal limit" refers to DO 16 s. 2017 / Magna Carta but is never tied to DepEd terms.
- **TL-18 (High) -- `RESET_DUMMY_SCHOOL_YEAR_1` confirmation token on routine Teaching Load page.** `RolloverGuidanceCard.tsx:183,284,289,302`. CC-4 -- compounds on this page because the user is mid-assignment.
- **TL-19 (High) -- Reset count rows list backend domain objects.** `RolloverGuidanceCard.tsx:45-58`: `Section mirrors`, `Generation runs`, `Follow-up flags`, `Teaching Load owners`, `Draft locks`, `Cohorts`, `Old audit rows` -- none have user-facing plain equivalents.
- **TL-20 (Medium) -- "Fix first" / "More Teaching Load fixes" jargon.** `TeachingLoadTaskGuide.tsx:73,95`. "Fix" implies breakage; for an empty Teaching Load it's accusatory.
- **TL-21 (Medium) -- Coverage % badge hidden on mobile.** `TeachingLoadTaskGuide.tsx:76` (`hidden ... sm:inline-flex`). The most useful at-a-glance progress signal vanishes on phones.
- **TL-22 (Medium) -- "Skip" semantics unclear.** `TeachingLoadRepairQueue.tsx:221` "Skipping only changes this local queue order." No explanation of whether a skipped item will return, persist across reloads, or still block generation.
- **TL-23 (Medium) -- "Coverage" never defined.** "coverage" / "pairs" / "staffed" used as headline metrics without a gloss. CC-9.
- **TL-24 (Medium) -- Empty-state hardcodes the school year.** `TeachingLoad.tsx:583` hardcodes "2026-2027". Violates school-agnostic rule.
- **TL-25 (Medium) -- SubjectRow empty-state uses `subject.code` not `subject.name`.** `SubjectRow.tsx:383-386`. "ESP860" tells the persona nothing.
- **TL-26 (Medium) -- Read-only banner reuses workspace-state strings verbatim.** "Verifies the live source", "writable", "snapshot" -- datastore vocabulary. Need "Saving is off until ATLAS reconnects to EnrollPro. Your work is safe to review."
- **TL-27 (Medium) -- `StaffingAuditSheet` title and headers are IT/HR jargon.** `StaffingAuditSheet.tsx:64,67,83,107,112,118,123,129,135,148,161,167,194,207`. "Operational report", "Temp Roles / Teacher X Assignments", "Active Faculty / Excluding Placeholders", "Overload States", "Roster Capacity".
- **TL-28 (Medium) -- `StaffingAuditSheet` violates the "no giant cards" rule.** `:103-125` two `rounded-2xl border` cards each holding a 3xl-font metric. Should be inline stat banner.
- **TL-29 (Medium) -- "Allocated/Section Allocation/Allocation Workflow" never defined.** `StaffingAuditSheet.tsx:187,207`. Technical scheduling vocabulary.
- **TL-30 (Medium) -- Colour-only "completed" dot has no text alternative.** `SubjectRow.tsx:526`, `SectionGridMode.tsx:282`, `TeacherGridMode.tsx`. WCAG 1.4.1.
- **TL-31 (Medium) -- Multiple concurrent `aria-live="polite"` regions compete.** `TeachingLoad.tsx:922`, `TeachingLoadRepairQueue.tsx:123`, `TeachingLoadDraftActionBar.tsx:36` all read status -- can double-speak to SR users.
- **TL-32 (Low) -- Skeletons are plain rectangles with no structural hint.** `TeacherGridMode.tsx:159-171`; `SectionGridMode.tsx:169-181`.

---

## Jargon Master List (cross-page, ordered by severity)

| Term | Pages | Plain-language fix |
|---|---|---|
| `Teacher X` / `placeholder` / `synthetic placeholder` | All 4 | "Temporary (to be hired)" with tooltip -- never "Teacher X" as a default name |
| `SCI`/`MATH`/`ENG`/`FIL`/`ESP`/`AP`/`MAPEH`/`TLE` raw codes | Teachers, Subjects | Expand to Science/Mathematics/English/Filipino/etc. in visible labels; keep real DepEd acronyms (AP/ESP/MAPEH/TLE) but spell out SCI/ENG/FIL |
| `STE`/`SPA`/`SPS`/`SPJ`/`SPFL`/`SPTVE` | Sections, Subjects | Expand in a label+tooltip pair or show "Special Program -- {full name}" |
| `EnrollPro` / `Sync` / `Run a sync` | All 4 | One-time intro tooltip "ATLAS uses EnrollPro (the DepEd enrollment system) as its teacher roster source" |
| `Rollover` / `drift` / `mapping-conflict` / `atlas-stale` / `enrollpro-unreachable` / `Migration needed` | All 4 via Rollover card | Replace with "New school year setup needed" / "Source not reachable" -- and surface only to admins |
| `RESET_DUMMY_SCHOOL_YEAR_1` / reset count rows | All 4 via Rollover card | Sentence-based confirmation ("I understand this will erase ATLAS test data"); hide count rows behind a "Show what will be erased" disclosure; gate the whole reset behind admin-only UI |
| `Load State` / `standard` (30h) / `cap` (40h) | Teachers | "Teaching Load Status" with `18h / 30h standard` visible in-cell, not in a keyboard-inaccessible tooltip |
| `Over cap - must fix` / `Above standard - approval needed` | Teachers | "Above weekly maximum -- reduce hours before generating"; "approval" -- from whom? No approver UI exists |
| `Credited workload` / `policyCreditedHours` / `Advisory Credit` / `hard repair limit` | Teachers | "Total weekly hours (incl. advisory credit)"; "the absolute max before ATLAS cannot generate the timetable" |
| `Schedulable` / `Can be scheduled` / `isSeedable` | Subjects | One label only ("Available for timetable"); tooltip expands "HG"="Homeroom Guidance", "Consult"=consultation |
| `Rotation family` / `modular family` / `Term Rank` / `Rotates by term` | Subjects | "Subjects that share a weekly slot across quarters" + flowplain explanation |
| `Shared class session` / `Pool` / `G7 Pool` | Subjects | "One teacher, multiple sections at once (combined class)" -- drop "Pool" verb |
| `Coverage` (overloaded 3 ways) | Subjects, Teaching Load | Split into "Teacher assigned", "Grade coverage", "Program coverage" -- never bare "Coverage" |
| `Displaced Section` / `Source Section` / `Final Outcome` | Sections | "The other section that currently uses this room" / "This section" / "After this swap" |
| `becomes moved to` (grammatically broken) | Sections | Rewrite the entire sentence: "Rizal will move to Room 101" / "Rizal will have no home room (reassign before generation)" |
| `split-brain` / `saved-truth` / `writable runtime evidence` / `scope drift` / `reconcile` | Teaching Load | "ATLAS found two saved versions of the same class assignment. Choose which one to keep." |
| `Quarantined` / `Assignments temporarily locked while data review finishes` | Teaching Load | "Editing locked -- ATLAS is checking saved assignments" + an explicit "What should I do?" line |
| `DB Conflict` / `Ownership conflict` / `Pending conflict` | Teaching Load | "Two teachers are both saved as the owner of this class" + the resolution action |
| `Hard Cap Utilization (40h)` / `Hybrid Staffing (Real + Temp)` / `Standard Teacher Load (30h)` | Teaching Load | "Real teachers first, up to 30h/week" / "Maximum allowed teaching hours (40h)" / "Real teachers first, then substitutes" -- tie 40h to DO 16 s. 2017 / Magna Carta |
| `allocation` / `Section Allocation` / `Allocation Workflow` | Teaching Load | "Classes" / "By section" / "Assign by section" |
| `Staffing Health Audit` / `Operational report` / `Temp Roles` / `Overload States` / `Roster Capacity` / `Excluding Placeholders` | Teaching Load (sheet) | "Staffing summary"; inline banner instead of metric cards; "Temporary teachers", "Over the weekly max", "Active teachers", "Real teachers only" |
| `HG` / `Consult` (tooltip) | Subjects | "Homeroom Guidance", "consultation period" |
| `drift` / `verified live` / `Using saved data` / `Checking source` | All 4 (source chip) | Already friendly-ish from prior pass; keep but add one-time intro on first use |
| `Rows per page` (no aria-label) | All 4 tables | Add `aria-label` and 44px touch target |
| `home room` | Sections | "Advisory room" (more DepEd-native) or keep "home room" but consistent |
| `Match` / `preview` / `Reset dummy data` | All 4 via Rollover | "Sample/test data" not "dummy"; "Preview changes" not bare "Preview" |

---

## Root-Cause Summary

1. **The command-header simplification did not propagate to the content area.** Every band below kept the same density/jargon/a11y anti-patterns the header band was fixed for.
2. **Tooltips are used as the *storage* for essential metrics**, not as supplementary help -- and they are keyboard-inaccessible because they wrap non-focusable elements.
3. **DepEd domain language was never layered in.** Internal scheduler vocabulary (`isSeedable`, `rotationFamily`, `split-brain`, `quarantine`, `Hard Cap`, `Teacher X`, `Load State`, `Displaced Section`) ships verbatim. Real DepEd names (Science, Filipino, Araling Panlipunan) are replaced with made-up codes (SCI, FIL, AP-when-AP-is-actually-real).
4. **`RolloverGuidanceCard` is the single worst cross-page offender** -- undismissable, intrusive on every setup page, with a destructive reset surfaced to non-admins via a type-a-developer-token confirmation.
5. **Keyboard a11y is broken on the most important interactions** -- sortable tables (no aria-sort), pagination (no aria-label), Teaching Load section assignment (Checkbox pointer-events-none with no fallback), department/teacher/grade row expand (div onClick with no role/tabIndex).
6. **Same colour is reused for three+ meanings** -- grade red (G9), fill-state red, error red -- violating both the project's own grade-color reservation rule and WCAG 1.4.1.
7. **Sub-10px uppercase tracked text is the *default* label style** -- the least-readable style on the page is used for the persona's lifeline (help text) and for the most common labels.

The next pass needs an ATLAS-wide DepEd glossary, a tooltip-on-focusable-elements rule, a colour-reservation audit, and a `RolloverGuidanceCard` reset/admin split -- not just per-page polish.