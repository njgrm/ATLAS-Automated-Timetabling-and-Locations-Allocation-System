# Planner A2 handoff — authenticated timetable browser QA (2026-09-26)

**Scope:** timetable and publication-facing presentation only.  
**Live release observed:** `26f7c907a37185e036e71cf0d82423794689b318` on the Tailnet origin.  
**Method:** authenticated, read-only browser QA as an older, mouse-first scheduler; desktop and a `390 x 844` responsive viewport. No schedule was generated, regenerated, edited, saved, downloaded, or published. No source files were changed.

## Verdict

Two defects are confirmed as release-blocking for scheduler trust:

1. Room Schedules mixes all three terms and invents hard conflicts. **FIXED by A2 (`e4989b72`, live 17:24). The page itself awaits redesign.**
2. The same schedule lifecycle is described inconsistently by the dashboard, timetable, teacher view, and public schedule.

The remaining work below is deliberately ordered so the term invariant and the user-visible truth are fixed before lower-risk responsive and loading polish.

## Required implementation order

| Order | Finding and observed evidence | Proposed outcome | Priority |
| --- | --- | --- | --- |
| 1 | **FIXED by A2 (`8b706ca7`/`400a6909`/`e4989b72`).** **Room Schedules invents conflicts by merging terms.** With G7 Room 103 selected, the page reported 10 conflicts. Its conflict inspector showed three copies of AP and three copies of Math in the same Monday slot, with links to T1, T2, and T3. The timetable itself shows one selected-term schedule. The page exposes a term selector for download only, not for the view. | Make the on-screen Room, Teacher, and Section schedule views select **one verified ordered term**. Default to the verified active term; send that term in the view request; do not use an all-term read as a normal schedule view. Make the selected term visible in the header. | **BLOCKING** |
| 2 | **Lifecycle statements contradict each other.** Dashboard says “Schedule is published” / Phase 5 of 5. Timetable shows run 318 as reviewing with “Publish schedule.” `/my` says “Review draft ready” but every class row says “Live.” | Derive one lifecycle presentation model from canonical publication/run facts, then consume it in dashboard, timetable, `/my`, and public. A reviewing draft must never be labelled Live. When both exist, say both plainly: published schedule (date and term) and newer draft in review. | **BLOCKING** |
| 3 | **Public term authority and retention are wrong.** With no `term` parameter, the public schedule previously rendered Term 1 while the school’s active term is T2. Changing the term also clears the selected section and moves a valid Luna selection to Aguinaldo. | Diagnose the published-schedule term resolver before changing it. A missing term must resolve to a verified authority or show an actionable unresolved state — never silently Term 1. Keep a selected section when it exists in the newly selected term; only fall back when it is not valid. | **HIGH** |
| 4 | **The drift banner is not legible on mobile.** At 390 x 844, “Schedule information changed” and its message were squeezed into a near one-word-wide column beside Preview impact and Regenerate to apply. | Below the small breakpoint, stack the message and action controls (or wrap a dedicated action row) so each label remains readable and tappable. Preserve the existing explicit-confirmation flow: regeneration remains operator-triggered and is never automatic. | **HIGH** |
| 5 | **Runs briefly claims there are none.** `/timetable/runs` displayed “No generation runs yet” before its request finished, then correctly rendered five runs several seconds later. | Treat this as loading until the request settles. Render the empty state only after a successful settled response with zero runs. | **MEDIUM** |

## Implementation constraints

### 1. Term scope is an invariant, not a display filter

- The contract is one selected, verified term. It applies equally to Rooms, Teachers, and Sections, not only the first tab fixed.
- Preserve the identity tuple from one source run: `(termIndex, day, interval, section, subject, faculty, room)`.
- A missing term must not become Term 1. If the active term cannot be proven, fail closed with an understandable selection/retry state; never merge all terms to fill the gap.
- Do not use the existing export-only term selector as a substitute for a view selector.
- Source leads from the walk: `atlas-client/src/pages/RoomSchedules.tsx` makes the display request without a term near the existing source selector, while its export dialog receives `termIndex` near line 578. Lane C traced the matching server all-term behavior to `room-schedule.service.ts:228-239`.

### 2. Lifecycle wording needs a shared model, not matching copy pasted four times

The UI must be able to distinguish at least:

- a published schedule: publication date and the term it represents;
- a newer generated schedule awaiting review/publication;
- the visible audience of each page.

Use this model in the dashboard, timetable, teacher portal, and public schedule. Do not infer “Live” from the existence of a row. If the underlying facts are insufficient to answer, display that uncertainty rather than asserting a completed publication.

### 3. Public schedule must retain meaning through controls

The public section picker itself **worked in the authenticated re-check**: choosing Luna changed both the page and its URL. Do not spend a candidate on the earlier “picker is dead” report without reproducing it. The confirmed regression is narrower: the term switch intentionally clears `sectionId` at `atlas-client/src/pages/PublicPublishedSchedule.tsx:523`. Retain a valid section and allow the existing invalid-selection fallback only when necessary.

### 4. Responsive banner source lead

The controls in `atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx:147` use fixed, nonshrinking actions near lines 229 and 252–263. Correct the layout at the component boundary; do not weaken its regeneration guards or turn its read-only preview into a write.

## Acceptance packet for each candidate

### Room Schedules candidate

1. Add focused client/server coverage proving each Room, Teacher, and Section view sends/uses the explicit selected term.
2. Add an adversarial fixture where the same room, teacher, and section appear in the same interval in three different terms. Selecting T2 must show only its T2 entry and must not report the other terms as a collision.
3. Prove parity with the selected timetable run using the complete identity tuple and order, not screenshots or sampled rows.
4. Browser QA: default opens the verified active term; changing to T1/T2/T3 updates the visible term and conflicts; the user never sees an all-term merged weekly schedule.
5. Do not generate, publish, or mutate production schedule data during QA.

### Lifecycle candidate

1. Unit/component tests cover published-only, reviewing-draft-only, and published-plus-newer-draft states.
2. In the published-plus-draft state, dashboard, timetable, `/my`, and public make compatible statements about the same dates/terms/run. Draft rows are not marked Live.
3. Browser QA covers the four routes, including a public deep link.

### Public term/section candidate

1. A missing `term` never yields a hard-coded Term 1. Test verified active term, an explicit term, and unavailable authority.
2. Changing term keeps Luna selected when Luna exists in the target term; a valid fallback is chosen only when it does not.
3. Confirm URL, selected combobox values, heading, and rendered schedule agree.

### Mobile banner and runs candidates

1. At 390 x 844, the drift title, explanatory sentence, Preview impact, and Regenerate to apply are readable, reachable, and not horizontally clipped. The page retains the no-global-scroll architecture.
2. Add a deferred-request test: while runs are pending, no “No generation runs yet” state is announced; after an empty fulfilled response it is announced exactly once.
3. Independent browser QA at 1366 x 768 and 390 x 844 records console errors, responsive behavior, and network evidence where capture is available.

## Findings re-checked and reduced in priority

- **Draft / pre-generation:** the empty grid is intentional and now explains that it is a separate working copy, that the published schedule is unchanged, and that nothing is placed yet. A later copy/navigation cleanup may rename “Draft” more consistently with “Pre-Generation,” but this is not evidence of lost work.
- **Policies:** loaded successfully in roughly five seconds in the authenticated check. Do not implement a speculative “never loads” correction without a timed reproduction and request instrumentation.
- **Dashboard Help:** worked in the authenticated re-check. Preserve any prior crash trace, but do not assign an A2 timetable candidate based only on the earlier intermittent report.

## Handoff instruction for A2

Start with a read-only source map of the Room Schedules request and term resolver, then take one candidate at a time in the order above. Load `atlas-timetable-invariants` before changing any term query or schedule view. Keep the existing A2 timetable worktree as its sole writer. Before integration, ask Planner C for an independent range review and browser acceptance of the corresponding packet.

**Disposition:** `PRESERVE_FOR_DECISION` — this is a standalone QA handoff artifact, not a code candidate and not a change to Planner A2’s worktree.

## Lane C acceptance (2026-09-26)

Accepted into project docs by Lane C (Claude Code QA). The three source leads were checked on `main`
`a94e2aa5`:

- `PublicPublishedSchedule.tsx:523`: the term `Select` calls `updateSearchParams({ term: value, sectionId: null })`.
- `SimpleDriftBanner.tsx:226-263`: the title, Preview impact and Regenerate to apply are all `shrink-0`.
- `TimetableRunsPane.tsx:73-77`: the empty text renders on `runs.length === 0`, with no pending state.

This handoff **supersedes** these system-walk findings, which could not be reproduced in the
authenticated re-check: `docs/reviews/system-walk-20260926/03-timetable-rest.md` #2 (Policies) and #3
(Draft), and `04-what-others-see.md` #3 (public section picker) and #5 (Help). Those files now point
here. Items 1–2 above are the same as system-walk 03 #1 and 04 #1.

Since the walk, `main` also carries `9b1ec14a` (the lunch-window label plus the guard that every
violation code has a client label). It is not yet live.

## Item 3 diagnosis — public default term (Lane C + Codex CLI, 2026-09-26)

Read-only source diagnosis by an independent Codex CLI runner, checked by Lane C: **a defect, not "only Term 1
is published."** A missing `term` correctly becomes `termIndex=active` (`public-schedule-term-scope.ts:4-11`,
`PublicPublishedSchedule.tsx:150,187,204-205`, `published-schedule.router.ts:66-72,100`). But for a published
(frozen) run, `published-schedule.service.ts:758-773` resolves `active` from the **frozen** contract's
`activeTermOrder`, which is the term that was active *at publication*. A schedule published during Term 1
therefore keeps defaulting to Term 1 after the school moves to Term 2. The non-frozen branch
(`:774-783`) already resolves the live verified active term and fails closed.

Direction (A2 to packet; §7 applies): for `active`, resolve the **current** verified active term, and fail
closed with `TERM_SELECTION_REQUIRED` when it is unavailable or not covered by the publication. Keep the frozen
contract for explicit-term validation and immutable publication content. This touches the C08
frozen-authority design, so the packet must show that per-term archived reads and exports are unchanged.
Browser confirmation is still owed; the CLI runner had no browser surface.

**Browser confirmation (Codex CLI + chrome-devtools, live `26f7c907`, 2026-09-26, read-only, 0 console errors).**
With no query string, `/public/schedules` settles on `?sectionId=143` with "Published term" = "TERM 1". The options are TERM 1–3, and **every term renders a published schedule** (Aguinaldo: "40 published classes are shown." in T1, T2 and T3). So the Term 1 default is the frozen-active-term defect, not "only Term 1 is published."

**Conflicting evidence on section retention (item 3b):** in this run, selecting Luna and then switching the term **kept** Luna (`?sectionId=141&term=3` → `?sectionId=141&term=1`), although `PublicPublishedSchedule.tsx:523` clears `sectionId` on the header term `Select`. The page may have more than one term control. Reproduce with the exact control before packeting a fix.

**Narrow width:** `resize_page 390×844` produced a 502 px viewport (window minimum). At 502 px, `scrollWidth == clientWidth == 502`, the section list is available and the schedule stacks by day. **390 px is still unverified.**
