# Timetable manual controls — preview-only walk (live `0da104f9`, 2026-09-26)

**Method:** Claude in Chrome, signed in, `/timetable` Term 2 · Section · GR7 - Luna, draft run 318 (reviewing).
Each control was walked **to its preview and cancelled**. Nothing was saved, published or generated. The one
crash was client-side, and a reload showed the draft unchanged. **Not covered:** what happens after a commit
(the change lands, Undo, what teachers and the public see). That needs a safe environment: see "Next".

## Findings

| # | Control | Finding | Severity |
|---|---|---|---|
| 1 | **Change room** | Clicking "Change room" in the session dialog **crashes the page**: "This page hit an unexpected error / Cannot read properties of undefined (reading 'length')", a TypeError in the `ManualEditPanel` chunk caught by the router error boundary. A scheduler cannot change a room from the dialog at all. The last change to that panel is `aa7f6f67` (the line-cap split that moved the option groups into `manual-edit/useManualEditOptionGroups.ts`). It is the first suspect, not a proven cause. | **BLOCKING** |
| 2 | **Move time → occupied slot** | Moving Mon 07:30 MAPEH (I. GARCIA) onto Mon 10:00 MATH opens "Swap class times" with "Must fix: … Daily load hard cap: I. GARCIA would reach **11.3h (max 8h)**", on a day whose classes run 6:00–12:15. A same-day swap cannot raise one teacher's single-term daily load to 11.3 h, so this looks like **load summed across terms**: the same false-conflict class as the old Room Schedules and published-swap defects. The same preview also says "Safe to review · No blocking conflict", directly under a "Must fix" line. | **HIGH** |
| 3 | **Change owner** | Leaves the dialog and navigates to `/teaching-load?facultyId=19&sectionId=141&subjectId=6&task=missing-load`. That page shows **a different teacher** (AGUILAR, CARLO MIGUEL · FIL), not the class's teacher (GARCIA · MAPEH), and there is no way back to the class. | **HIGH** |
| 4 | **Changes after publishing** | The dashboard tells schedulers "Use Exceptions for in-term changes", but **no "Exceptions" exists** in the sidebar, the tabs, the More menu or Runs. A scheduler with a published schedule has no discoverable way to make an in-term change. (Run 318 is a draft, so a published-only control may exist elsewhere. If it does, it is not findable.) | **HIGH** |
| 5 | **Teacher leaving / Reassign load** | This is a 5-step wizard. The replacement picker (step 3) shows no qualification or load hints, and "Use for all" lets you pick an unqualified teacher. The refusal only comes at preview (step 4). The refusal is correct, but it reads "Target faculty 1 is not qualified for subject 6 in this section program (NOT_QUALIFIED)", using ids and a code instead of names. | MEDIUM |
| 6 | **Swap** | The dialog "Swap" and More ▸ "Swap sessions" open the same flow (a duplicate entry). It accepts a swap that changes nothing visible (Mon MAPEH ↔ Tue MAPEH, same teacher, same time) as "Safe to review". "Checking options…" took ~7 s. | LOW |
| 7 | **Move time** | GR7 - Luna's day is fully booked 6:00–12:15, so "Move time" on this section can only swap. A free-slot move could not be shown here; test it on a section with gaps. | note |

## Keep

- Teacher leaving refuses an unqualified replacement before saving, with the reason: "Choose a qualified receiver, or grant authority first."
- The occupied-slot explanation is specific: section occupied, room occupied, and the teacher's daily cap with hours.
- Every dialog says "Nothing changes until you confirm" / "Safe to review", and Cancel always returned a clean draft.

## Next

1. **A2:** fix #1 (the crash) first, then #2 (verify the cross-term load hypothesis on the server), #3 and #4. Put all
   of them in the control inventory.
2. **Committed-path QA needs an operator decision.** Either (a) a local copy of ATLAS with a snapshot of the
   database, where Lane C can commit, undo, publish and make post-publish changes freely (recommended), or (b)
   commits on live with explicit approval per action. Commits touch real teachers' and the public's schedule.

Cost (`subagent_tokens`): 190,509 (115 tool calls).

## Committed actions, round 1 (live `0da104f9`, draft run 318, 2026-09-26 22:06–22:08 +08)

The operator ruled live holds test data, so commits are authorised. Committed with Claude in Chrome, then
**independently verified read-only by Codex CLI** in a separate browser. Only facts both runners agree on are
recorded as confirmed.

| # | Action | Finding | Severity |
|---|---|---|---|
| 8 | **Swap (class dialog), GR7 - Luna Term 2: Mon 07:30 MAPEH (I. GARCIA) ↔ Wed 08:15 ESP (J. Cruz)** | The preview promised "Class A moves to WEDNESDAY 8:15–9:00, Class B moves to MONDAY 7:30–8:15 · Safe to review · No blocking conflict". The commit toasted "Swap applied with blocking-session auto-fix relocation. / Sessions switched. ATLAS also relocated the blocking session." and did something else: MAPEH went to Wed 08:15, **but ESP was moved to Wed 12:15, after GR7 Luna's day ends**, and **Mon 07:30 was left empty**. GR7 Luna now has MAPEH at Wed 07:30 and 08:15. **What was committed is not what was previewed**, and a class is lost from Monday. Strategy `AUTO_FIX_MOVE_BLOCKING` (`useTimetableMutations.ts:1818-1822`). Lead: `findAutoFixTarget` (`manual-edit.service.ts:2065`) builds its occupied-slot set from every entry with no term filter, and did not keep the relocation inside the section's shift. | **BLOCKING** |
| 9 | **Revert this edit (More ▸ Expert tools ▸ Schedule history)** | It toasts "Edit reverted." and logs "Undid an earlier change", but **Term 2 is not restored**, and it stays wrong after a reload. Terms 1 and 3 still show the original Mon MAPEH and Wed ESP; only Term 2 diverges. The undo that is supposed to rescue a scheduler from #8 does not work. | **BLOCKING** |
| 10 | **Warning counts after the edit** | Header 194 before → 93 after, for a two-session swap. History records "warnings: 331" on the swap and "warnings: 0" on the undo. 331 may be the whole-year figure, but "0" after an undo that changed nothing is false. | MEDIUM |
| 11 | **Move time, free slot** | Could not be tested: every GR7–GR10 section in Term 2 is fully booked, AM and PM shifts. | note |

**Live state left behind:** draft run 318 Term 2 GR7 - Luna is as described in #8, and the app's own revert
does not fix it. Lane C will regenerate a new draft for further QA rather than keep editing 318. Run 318 and its
history stay available for diagnosis.

Cost (`subagent_tokens`): Claude runner 163,514; Codex verifier 2.29 M input (95 % cached).

## Generate, publish, change after publishing, new version (live `0da104f9`, 2026-09-26 22:18–22:36 +08)

Claude in Chrome, with commits authorised. The public API was re-probed from the host with `curl` at 14:36Z.
**Live state now: run 319 PUBLISHED (14:23:48Z); one dated revision (SCIENCE ↔ MAPEH, GR7 - Luna, Monday,
effective 2026-09-27, reason "QA test swap - live browser QA verification"); run 320 is the current draft.**

| # | Step | Finding | Severity |
|---|---|---|---|
| 12 | **Publish → public page** | Straight after publishing run 319, `/public/schedules` shows "Unable to load public schedule / The immutable publication revision is unavailable for the requested date." The page sends today's date. `curl`: `published?date=2026-09-26&termIndex=active` → **409 `PUBLISHED_REVISION_INVALID`** (also with termIndex 1 and 2). The same URL with `date=2026-09-27` or with **no date** → 200 (run 319). Two hours earlier, before this publish, `date=2026-09-26` returned 200. **Publishing takes the public schedule offline for the rest of the publish day**: parents and students get an error. It must fall back to the publication in force that day, or make the new one effective at once. | **BLOCKING** |
| 13 | **Public default term after republishing** | With no date, run 319 now returns `termIndex: 2, activeTermVerified: true`. The earlier "Term 1" came from the old publication's **frozen** `activeTermOrder`, which confirms the diagnosis in handoff §10a. Republishing hid the symptom; the next term change will bring it back. **Do not close A3 on this.** | HIGH (unchanged) |
| 14 | **Runs after publishing** | Run 319 is still tagged "Latest · Reviewing" after being published. No run in Runs is marked Published, so a scheduler cannot tell which run teachers see. | HIGH |
| 15 | **Schedule history after a published change** | After "Published schedule has been revised (effective date: 2026-09-27)…", More ▸ Expert tools ▸ Schedule history still says "Nothing to show yet: no class has been moved, swapped or given a new room in this schedule." Revisions are invisible. | MEDIUM |
| 16 | **Generate dialog numbers** | The pre-generation dialog says "Still unassigned 1295 sessions"; the finished run has 0 unassigned. The number shown before generating means nothing to a scheduler, or is wrong. | MEDIUM |
| 17 | **Drift banner** | "Schedule information changed… Regenerate to apply" stays up, unchanged, after two successful generations (319, 320). | MEDIUM |
| 18 | **Correction to #4** | A change-after-publishing path **does** exist: More ▸ "Swap sessions" on a published schedule asks for a start date and reason and creates a dated revision. The defect is narrower: the dashboard calls it "Exceptions", a name that exists nowhere in the UI. | MEDIUM (was HIGH) |
| 19 | **Revision start date** | A plain date field (dd/mm/yyyy) accepted typed input as "272026" with no inline error. | LOW |

**Worked well:** generate and publish dialogs state exact counts and say publishing is separate. Publish is
gated behind acknowledging the warnings ("159 warnings must be acknowledged…"). Post-publish swap conflict checks
were correct twice (a named teacher double-booked in another section), and a clean swap was allowed. The dated
revision leaves today's schedule unchanged and says so. The dashboard stayed "Published" through the new draft.

Cost (`subagent_tokens`): 216,395 (184 tool calls).

## Committed actions, round 2 (draft run 320, 2026-09-26 ~23:00 +08)

| # | Action | Finding | Severity |
|---|---|---|---|
| 1 (repro) | **Change room** | Crashed again on run 320: `TypeError: Cannot read properties of undefined (reading 'length')` at `ManualEditPanel-DjRgXRma.js:1:12213`. **Confirmed on two runs.** The More menu on this draft has no "Tools ▸ Manual edit" entry, so there is no working way to change a room from `/timetable`. | **BLOCKING** |
| 3 (repro) | **Change owner** | From Mon 06:00 TLE (P. CRUZ) it opened `/teaching-load?facultyId=9&sectionId=141&subjectId=12&task=missing-load`, showing **AGUILAR, CARLO MIGUEL — FILIPINO**. **Confirmed on two classes.** The URL carries the right subject (12) but the page shows another teacher, and it offers no targeted owner-change step. | **HIGH** |
| 20 | **Move onto an occupied slot → Swap (GR7 - Luna Mon 06:00 TLE ↔ Mon 10:00 FIL)** | The preview said "Safe to review · No blocking conflict" and did **not** mention an automatic move. The commit toasted "Sessions switched. ATLAS also moved the source session to the nearest valid slot." / "Source session auto-fixed to the nearest valid slot." (strategy `AUTO_FIX_MOVE_SOURCE`). Header warnings went 159 → 69, yet the GR7 - Luna Term 2 grid looked **unchanged**. After "Revert this edit" the warnings stayed at 69. **Second instance of #8:** the swap's hidden auto-fix changes something other than what the preview showed, and revert does not restore it. Where the change landed is being traced (Codex, read-only). | **BLOCKING** (same defect as #8) |
| 21 | **Communication, session dialog** | 43 words, 7 buttons, labelled CLASS/TEACHER/ROOM/TIME fields with icons, no small text: **clear**. Cut: "Class summary. Each action below opens its usual review before anything is saved." (the layout already says it). | note |
| 22 | **Communication, swap preview** | A/B cards, a before→after block and a green one-line "Safe to review" banner: visually **clear**, but the green banner is **misleading** whenever the server may auto-fix. A clear screen that is wrong is worse than a dense one. The preview must show the auto-fix move, or the commit must not make it. | HIGH (with #8/#20) |

Unperformed in this round (budget): Teacher leaving to Save, and the communication grading of the readiness sheet, the
Review-issues panel, the drift banner and the generate dialog. Re-dispatched as smaller runs.

Cost (`subagent_tokens`): see the Lane C channel.

## Teacher leaving / Reassign load: commit attempt + communication grading (draft run 320, ~23:20 +08)

**Function:** could not commit. Leaving teacher **Rizal, Jose (MAPEH)**. Step 2 lists 4 classes / 60 weekly meetings,
including MAPEH · GR7-Bonifacio-STE and MAPEH · GR8-Makakalikasan-SPS. Three MAPEH-department replacements
(Ocampo, Frederick; Garcia, Isabella Joy; Garcia, Anna Patricia) were **all refused at Preview**: "The selected
teacher is not qualified for this subject through department, program, or specialization authority. Choose a
qualified receiver, or grant authority first." Toast: "Target faculty 26 is not qualified for subject 21 in this
section program (PROGRAM_SCOPE_INCOMPATIBLE)". Nothing was saved.

| # | Finding | Severity |
|---|---|---|
| 23 | **A departure touching a specialized-program section (STE/SPS) cannot be completed from the wizard.** No step shows who holds program authority, and "grant authority first" names an action that has no control in this flow. The only way to find a valid receiver is trial and error, blind. | **HIGH** |
| 24 | **The replacement picker (step 3) is a flat alphabetical name list** with no qualification, program-authority or load signal. Refusal comes only after Preview. Mark each candidate qualified/not (icon + colour) and sort qualified first; hide or disable the ineligible ones with a one-word reason. | **HIGH** (UX) |
| 25 | **The leaving-teacher list (step 1) shows no class count or load.** The runner had to leave the wizard for `/teaching-load` to choose. | MEDIUM |
| 26 | **The refusal is prose plus engine ids and a code** ("Target faculty 26 … subject 21 … PROGRAM_SCOPE_INCOMPATIBLE"). Use names and one plain line: "Not allowed to teach STE sections." | MEDIUM |
| 27 | **The wizard is dense at every step.** Words / buttons / text under 14 px / visual status: step 1 88/3/13/none; step 2 147/10/22/none; step 3 131/14/26/none; step 4 ~90 words of refusal, no icon (**wall of text**). Step 2 repeats the same boilerplate on each class row; step 3 repeats per group. | **HIGH** (older users) |
| 28 | **The Change room crash can appear without clicking it.** After the round-2 swap, `/timetable` carried the `ManualEditPanel` TypeError and a floating "Source session auto-fixed to the nearest valid slot." toast before any action in this run. The crashing panel may mount on its own once an auto-fixed entry exists (not isolated). | HIGH (verify) |

Cost (`subagent_tokens`): see the channel.

## Trace of run 320's swap (#20), read-only (live `0da104f9`, 2026-09-26 ~23:45 +08)

Two Claude-in-Chrome runs, UI only. The JSON reads were not possible: `/api/v1/...` needs the app's bearer token
(`NO_TOKEN` on a plain same-origin fetch), and the runner rightly did not read it.

| # | Finding | Severity |
|---|---|---|
| 29 | **The committed swap is invisible everywhere.** GR7 - Luna Monday is the same in Terms 1, 2 and 3: TLE 06:00 (P. CRUZ), FIL 10:00 (C. AGUILAR). The Monday cells for CRUZ and AGUILAR are the same in all three terms too, with no overlap and nothing outside the day. The only difference between terms is unrelated: Mon 06:45 SCIENCE is J. Villanueva in Term 1 and R. Santos in Terms 2–3. Either the swap never applied and the history lies, or it changed a row that no section or teacher view shows. | **BLOCKING** (with #8/#20) |
| 30 | **The history records one entry and no revert.** Modal: "1 edit recorded" · "Swapped two sessions" · 9/26/2026 10:49:21 PM · "All serious problems: 0, warnings: 241". The earlier "Revert this edit" (#20) left **no entry**, and the swap still offers Revert. The auto-fix move has **no entry of its own**. | **BLOCKING** (with #9) |
| 31 | **Four warning counts disagree.** Before the swap 159; after it 69 in the header; 241 in the history snapshot; per term now T1 73, T2 69, T3 69. The user cannot tell which number to trust or what the swap did to it. | HIGH |

Cost (`subagent_tokens`): 109,335 + 127,889.

## Communication grading: publish checklist, Review issues, drift banner (draft run 320, 2026-09-27 ~00:10 +08)

Read-only Chrome run. Columns: words / buttons / icons / text under 14 px / visual status.

| # | Surface | Measure | Verdict and one cut | Severity |
|---|---|---|---|---|
| 32 | **Publish checklist** (the only readiness surface; there is no separate "Readiness" item) | ~109 / 2 / 0 / 5 / partial: counts "Must fix 0 · Warnings 69" and an amber callout, but no single ✓/✗ verdict | **Dense.** Cut: "Problems listed below are scoped to TERM 2; the publish gate above is always the whole year." Add one line at the top with an icon: "✓ Ready to publish" or "✗ 2 must-fix left". | MEDIUM |
| 33 | **Review issues, as first shown** | 504 / 50 / 5 / **68** / partial: amber "Warning" pill, no icon | **Dense.** Filter chips, search and four groups before any content, and 68 small-text elements. The headline is cut off in the UI ("Warnings…"). | HIGH (older users) |
| 34 | **Review issues, one group open** ("Long teaching block", 12 rows) | 176 / 11 / 0 / – / none | **Wall of text.** The same sentence 12 times: "[Teacher] teaches 180 consecutive minutes (4 periods) on [Day], above the 135-minute limit." Cut: one line "12 teachers go over 135 min in a row" plus a list of names and days. | HIGH (older users) |
| 35 | **Drift banner** + "Regenerate to apply" dialog | banner 30 / 2 / 2 / 2 / **yes**; dialog 90 / 3 / 1 / 7 | **Clear.** This is the model the other surfaces should follow. Cut: "A published schedule is never regenerated automatically; published changes go through a dated revision instead." (it adds nothing in a draft dialog). Banner body text is 12 px; raise it to 14. | note |

Not yet graded: the generate dialog and the publish confirm step (Codex was blocked by auto mode; queued for a Claude
runner). Cost (`subagent_tokens`): not reported for background runs.
