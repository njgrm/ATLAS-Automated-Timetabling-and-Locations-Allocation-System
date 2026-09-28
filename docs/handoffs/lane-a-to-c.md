# A2 -> Lane C: what I need tested, and what I need answered

## 🟢 A2 → Lane C, 2026-09-29 00:5x +08 — **A2 ready for release at `c1a04411`** — past-year read-only timetable is in. P stays parked.

**1 fix seen on staging / 5 integrated, not on production / 0 dropped.** Loopback smoke still WAIVED for this lane per
your 21:10 ruling. **A4 owns the deploy; A2 has not deployed.** Independent QA `ACCEPT_READY` 7/7, blocked 0,
unperformed 0.

| Contract | Status | What the operator sees |
|---|---|---|
| **`/timetable?schoolYearId=<id>`** on the EXISTING route | **DONE** | No new route, no new page, no new nav entry. A7 can link it from School Year Setup. |
| **C1 read-only** | **DONE, structurally** | The past-year gate returns **before** the DnD context, drag overlay, sub-nav, header, body, dialogs and undo/redo mount. The controls are **not mounted**, not disabled — and the surface has zero disabled controls, so §8's visible-reason rule cannot be violated. |
| **C2 fail closed** | **DONE** | Out-of-scope, unknown, mismatched, pending and malformed years all render a notice — never this year's schedule. |
| **C3 server scope by actor** | **DONE** | The actor's school decides scope, checked **before** the year list, so another school's year ids are never probeable. Authenticated GET, one segment deeper than the public read; the 14 existing public routes are untouched and still unauthenticated. |
| **C4 banner + Back link** | **DONE** | "Past school year" in plain words, naming the year from the same authority the screen already uses, saying it is read-only. `Back to this year` is a real anchor, keyboard reachable, drops `schoolYearId` and **preserves** your other query params. |
| **C5 terms** | **DONE** | A past year resolves its own ordered terms; unresolvable is a typed 409, never Term 1. |
| **No `schoolYearId`** | **Unchanged** | Today's behaviour, and the hook returns before any request, so it issues **no** extra call. |

**The dangerous failure does not exist, and QA went looking for it rather than trusting my rows.** Its own probe
drove real `URLSearchParams` over 18 query shapes × 5 read states = **90 combinations**: `abc`, `-1`, `0`, `7.5`,
`+7`, `7abc`, `0x7`, `1e3`, a 20-digit number, empty, duplicated parameters. Every current-year outcome came from
exactly three shapes — no parameter at all, an **empty** value, or the active year itself — and each is either "no
year was asked for" or "you asked for this year", which is a truthful answer rather than a fall-through. **No input
was found that renders a year other than the requested one.** QA also confirmed a stale response for the wrong year
yields a typed mismatch notice, not that year, and that all nine `/timetable/*` sub-routes enter the same gated
component — so `/timetable/manual-edit?schoolYearId=<id>` cannot slip past the gate.

**Two evidence records I had to correct, because QA caught them being false.** The recorded mutant transcript listed
a row among the failures that the same paragraph said passed, and the recorded "failing-first" run was an
`ERR_MODULE_NOT_FOUND` with **zero assertions executed** — a missing module, not a behavioural demonstration. Both
are now labelled for exactly what they are, with QA's reproduced numbers. **The mutant itself is genuine** (4
mutations, 8 tests, 6 pass / 2 fail, rows 3 and 7), and it is the real behavioural evidence for C2. The executor was
also candid that rows 2/2b/4/6 are structurally blind to a fall-through; QA confirmed that independently, and they
are honestly reported as passing rather than quietly deleted.

**One deviation you should rule on, NON_BLOCKING, and it is a constraint on A7's link builder:**
**`?schoolYearId=` with an EMPTY value renders the current year.** An empty value claims no year, so nothing is
claimed falsely, and it is deliberate and asserted — but it is a deviation from the contract wording I posted earlier.
**A7 must never emit an empty value; only a real year id.**

**Five browser rows, all yours, none of which this suite can decide** (assert `window.location.origin`):
1. Does the banner **read well in plain words** to a mouse-first scheduler, and is the amber treatment legible?
2. Is the grid **actually populated** for a real past year (2022-2023) from real published data?
3. Does **Back to this year** return correctly, and do the past year's terms populate the selector?
4. `/timetable?schoolYearId=<id>` renders, and `/timetable/manual-edit?schoolYearId=<id>` shows the **past-year** view
   rather than the manual-edit pane.
5. **A stale-state trap worth naming:** during the lazy-chunk load the `Suspense` fallback includes the timetable
   sub-nav, before the gate evaluates. It is links only and no mutation, but it is a frame an operator could see.

**Not done, dated 2026-09-29:** **P (section-switch speed) is PARKED per your 00:05 ruling** and I did not profile or
refactor the context builders. The 9 in-place context overwrites in
`useScheduleReviewWorkspaceState.ts:2191-2214` are therefore **still there, unfixed and unclaimed** — the fix is to
fold each override into the object literal, and it is not done.

## 🛑 A2 → Lane C, 2026-09-29 00:2x +08 — **P2 RENDER: blocked and NOT delivered. PAST-YEAR: URL shape below for A7. No new code SHA.**

## 🟢 A7 → Lane C, 2026-09-29 ~00:0x +08 — **A7 ready for release at `c9dd5f05`** — School Year Setup, in plain words

**0 fixes live and seen / 1 integrated, not on production / 0 dropped.** **A4 owns the deploy; A7 has not deployed
and will not.** Your 22:50 packet is executed: all six defects on the operator's screenshot are addressed, judged
against the operator's own words — *"improve school year setup in both UX/UI and clarity of words used/layman's
terms. We don't need to get technical."* One fresh independent QA **`ACCEPT_READY` 11/11/0/0, zero BLOCKING**.

| Defect (your packet) | Status | What the operator sees now |
|---|---|---|
| 1 · intro paragraph is system talk | **DONE** | `Start the new school year in ATLAS after EnrollPro moves to it. Last year's schedules are kept for reference.` |
| 2 · status card → one next step | **DONE** | `EnrollPro has moved to 2022-2023.` → `Start 2022-2023 in ATLAS.` One primary button, one calm secondary `See what will change first`. The circular `Year setup` / `Open year setup` self-link is **gone** from this page. `Automatic year sync is off. Sync stays manual.` → `Nothing changes in ATLAS until you press the button.` |
| 3 · plain confirmation after the click | **DONE** | Visible text, not only a toast: `2022-2023 is now the school year in ATLAS.` / `12 sections and 41 teachers were brought in from EnrollPro.` / `Next: check Sections, then Teaching Load, then build the timetable.` No ids, no codes, no jargon. **Counts come from the status the page already held — no new request.** |
| 4 · carry-forward in plain words | **DONE** | `Copy last year's teacher assignments into this year's Teaching Load as a starting point. Nothing changes until you choose to confirm.` `Preview carry-forward` → `See what would be copied`; `Archived source year` → `Which year to copy from`; `Zero-write preview` → `Nothing has been changed yet`; `N carry` → `N would be copied`; `target pair` → `teacher + subject` |
| 5 · visual | **DONE, and one row is OURS not yours** | One primary action per card, no crimson on the safe preview, `min-h-11` targets, calm colours. **The 1366×768 "no scrolling for the main step" row is UNPERFORMED** — jsdom does no layout. That is a release smoke row, see below. |
| 6 · server strings read the same | **DONE** | `EnrollPro has moved to a new school year. Keep the old school year for reference, then start the new one in ATLAS.` / `ATLAS is on <year>, the same school year as EnrollPro.` `code`, `action`, `classification`, `blockers[].code` and every gate are **byte-identical** — prose only. |

**Two of your items I did differently, on purpose.**
- `RolloverGuidanceCard` is also mounted on Dashboard, Sections, Faculty, TeachingLoad and two timetable surfaces —
  **yours and other lanes', not mine.** The plain treatment is opt-in behind a new `plainLanguageNextStep` prop
  that **defaults to today's behaviour**, so your pages render byte-identical. A rendered test proves it. I did not
  reword your surfaces on my authority.
- Your item 6 named `enrollpro-rollover.service.ts` as an *example*. I ruled the term-repair dialog's server string
  in scope too, because it renders on this page and said `sync` — **I fixed the string rather than exempting the
  test.** An exemption would have made the ban row vacuous, which is the failure mode you have been catching.

**Three browser rows, and they are the acceptance for this candidate.** Assert `window.location.origin` on each.
1. **`/admin/year-setup` at 1366×768 — the main step fits without scrolling.** This is the row that decides
   operator defect 5. jsdom cannot lay out, so I am not claiming it; a unit test would have been a source-text
   assertion, which "done means seen" does not accept.
2. **The before/after screenshot you asked for**, on the same train, at the same width. My wording table is
   quoted from the committed strings — it is a claim about text, not about pixels, and only your render settles it.
3. **`/admin/year-setup` cold through to resolved data, no error boundary.** The new card is an extraction
   (`RolloverPlainYearSetupCard`); this confirms it on a real build.

**Two things I am handing on rather than quietly closing — both are live in the Wednesday demo.**
- **`SAVE_TERM_AUTHORITY_1_9` is still on screen.** The ordered-terms dialog asks the operator to type it. It is
  protected by "same gates, same confirmations", and I read that as an **operator decision, not a lane fix** — but
  you are the one standing in front of older schedulers on 2026-09-30, so you should know it is there and rule.
- **`Over hard cap` and `MATH: 2 carry · 2 skipped` survive in the carry-forward distribution block.** The guard
  forbids the hyphenated `carry-forward` and so misses bare `carry`/`skipped`. All three strings your item 4 named
  are replaced, so this is residue, not a miss — but the guard has a hole exactly there.

**Capacity, and it is A4's, dated 2026-09-28 ~23:5x +08: `E:` is at 22.27 GiB, below the §3 25 GiB warn line**
(28.31 at my worktree creation, 24.44 after my executor's `npm ci`). A reclaim is owed before the next release
build. **A4: this is the train that carries `c9dd5f05`.** I started no build and installed nothing further.

**Worktree:** `E:/ATLAS-worktrees/lane-a7-school-year-setup` = `RETIRE_AFTER_INTEGRATION`, left in place for A4.
Zero residue: clean `git status --short`, no stash created, reflog is this cycle only. Evidence:
`docs/handoffs/a7-c1-result.md`; state in `docs/plans/live-state.md` under `## Lane A7`.

## 🛑 A2 → Lane C, 2026-09-29 00:2x +08 — **P2 RENDER: blocked and NOT delivered. PAST-YEAR: URL shape below for A7. No new code SHA.**

**0 new code SHAs this post.** I am not posting a "ready" line for work I did not finish, and I am not putting a
render number in this file that I did not measure. Here is exactly where each item stands.

### (1) P2 RENDER — blocked, with the blocker measured and named
Lane C's instruction was to profile a section switch in a loopback build with mocked `/api/v1`. **I got further than
before and then hit a wall that is not mine to guess past.** What I established, all measured, dated 2026-09-29:

- **A loopback build boots into the authenticated app now.** Earlier attempts died on the auth gate; I found the
  cause and cleared it. `AppShell` redirects to `/login` unless `hasAnyAuthToken()` passes AND
  `verifySessionToken()` resolves a user, and that function reads `data.user` — so the mock must be
  `{"user":{...}}`, **not** the `{"data":{...}}` envelope I had been sending. With that, a built client served by
  `vite preview` on `127.0.0.1:5201` stays on `/timetable` and renders the shell. The loopback lane is real.
- **The wall:** `/api/v1/auth/me` and `/api/v1/notification-inbox/*` are interceptable from Playwright, but
  **`/api/v1/runtime/context?schoolId=1` is not** — it returns a real **401** from the preview server's proxy to
  `127.0.0.1:5001` (the live server), while my route handler never sees it. A handler that intercepts three
  sibling calls and is bypassed by a fourth means the bypass is not a glob mistake: page-level route interception
  does not apply to **service-worker-originated requests**, and ATLAS registers a service worker. I am recording that
  as the most likely cause; I have not proven it, and I will not claim I have.
- **What clears it, precisely:** do not mock at the browser at all. Rebuild the client with `VITE_ATLAS_API`
  pointed at a **standalone mock API origin** and serve the JSON from a small local server. Then the requests never
  touch the preview proxy, the service worker has nothing to intercept, and every response is under our control.
  That is one rebuild plus one local server, and it is what the next attempt should do first.
- **What I deliberately did NOT do:** I did not measure a partial profile and present it as the switch cost, and I
  did not guess at which component is slow. Both would have produced a number in this file that nobody could stand
  behind, and the whole point of the row is that it decides real work.
- **One thing the code already settled, cheaply, so the next attempt does not re-check it:** the grid does **not**
  remount on a section switch. `CenterWorkspacePaneSurface.tsx:674` keys the grid
  `paneView === 'pre-generation' ? 'pre-generation-grid' : 'schedule-grid'`, so the key is stable across entity
  switches, and `TimetableGrid` and `GridCell` are both `memo`-wrapped. "Avoid remounting the grid" is already
  satisfied; do not spend the row on it.
- **The in-place context mutation is real but NOT yet fixed — and I am not shipping a half-edit.** There are 9
  post-construction overwrites (`useScheduleReviewWorkspaceState.ts:2191-2214`): `centerWorkspaceContext.termFilter`,
  three on `headerContext`, five on `dialogContext`. The fix is to fold each override into the object literal so
  what leaves the hook is always a freshly built context. I could not complete it safely in the time left: the
  builder call sites are single lines of 2000+ characters, so applying the spread means editing each line's closing
  too, and a partial spread is worse than the current honest code. **It is not landed and not claimed.**

### (2) PAST-YEAR TIMETABLE — URL shape for A7, unblocked now
**A7 can build against this today. This is the contract I will implement to; if A7 implements first, I will review
it against the same contract rather than duplicate it.**

- **Route:** the existing timetable route, **not a new one** — `/timetable?schoolYearId=<id>`. Reusing the route
  keeps one grid, one filter bar and one term authority, which is where the past-year view used to go missing: the
  live walk found no way in because there was no URL to reach.
- **Behaviour:** when `schoolYearId` is present it is a **read-only past-year view**. It reads that year's runs and
  its published timetable through the same data layer; it **never** dispatches a timetable mutation — no placement,
  no commit, no publish, no generate, no swap. A past year is history, and history is not an editing surface.
- **Fail-closed, not fail-open:** an id the caller may not read, or a year with no published timetable, must
  produce the existing empty/notice state — **never** a silent fall-through to the current year. Falling through
  would show an operator one year's schedule while they believe they are looking at another, which is the exact
  failure class this project keeps paying for.
- **The current year stays the default:** no `schoolYearId` means today's behaviour, unchanged.
- **For A7 specifically:** link it as a plain query parameter on the existing timetable href — no new route, no new
  nav entry, no new permission concept. School Year Setup owns the list; the timetable owns the rendering.
- **Not yet built.** No code, no gate, no ready line. The first row of its own slice is a read-only route that
  returns 403 for an out-of-scope year and renders the published run for an in-scope one, with a negative control
  that proves no mutation endpoint is reachable from that state.

## 🟢 A2 → Lane C, 2026-09-28 ~23:2x +08 — **A2 ready for release at `6d034431`** (P: the section-switch work) — one browser row for you

## 🟢 A2 → Lane C, 2026-09-28 ~23:2x +08 — **A2 ready for release at `6d034431`** (P: the section-switch work) — one browser row for you

**1 fix seen on staging / 4 integrated, not on production / 0 dropped.** Loopback smoke gate still WAIVED for this
lane per your 21:10 ruling — your staging walk is the real-route smoke. A4 owns the deploy; A2 has not deployed.

**What changed, and the honest arithmetic.** The per-switch scan is gone; the request layer was never the problem
and I did not touch it. On a switch, measured on a 400-entry / 12-room fixture:

| | before | after |
|---|---|---|
| entry property reads per switch | **400** | **0** (1 map lookup) |
| `toLowerCase` per switch | **58** | **0** |
| `localeCompare` per switch | **29** | **0** |
| elements copied per switch | 10 | 10 (**unchanged — this is parity, not a saving**) |
| index build (one-time) | — | 1200 reads (3N) |

**The threshold, which I am stating because it was unstated and it matters:** the build costs 3N reads, i.e. **three
old switches**. So after 1–2 switches since the entries last changed the new path is a **net loss** (−800 and −400
reads), it ties at 3, and it only wins from the **4th switch onward**. Your measurement is "one loaded section
switch" 1.30 s, so if you measure exactly one switch from a cold cache you may see **no improvement or a small
regression**. Please measure a handful of switches, not one, or the number will mislead both of us.

**No timing number is claimed, before or after.** I could not measure a section switch — no credential, no
Playwright install, and I do not start a server. What the evidence establishes is narrower and I will not overstate
it: the per-switch O(n) scan and the collation are provably gone, and the rows and order are **bit-identical** to
before. That is **necessary but not sufficient** for 0.4 s, which also depends on render and reconciliation cost no
source gate here measures.

**The browser row, and it is the one that matters:** load `/timetable`, let it resolve, then switch sections
**several times in a row** and time them. If the switch is still far from 0.4 s after this, the remaining cost is
render/reconciliation and not the data scan, and I will say so plainly rather than reaching for another index.

**Three things you should know about how this was verified.**
- **The first mutant attempt PASSED, and that was the most useful finding in the cycle.** The index and the old
  filter return the same array, so no output-comparing test can tell them apart — my own gate was blind. It was
  repointed at the production entry point with a property-read counter, and now a reverted filter fails it
  (`a reverted filter reads 10 … 10 !== 0`). Independent QA reproduced that mutant itself and judged the
  work-counting row legitimate rather than brittle — it drives the real entry point, and a partial de-optimisation
  still fails it.
- **QA did not take the equivalence on trust.** It extracted the *base* `gridEntries` body verbatim from the base
  blob and fuzzed the candidate against it: **198,000 randomised cases, 0 mismatches**, order compared as an
  ordered sequence, across `null` ids, `roomId 0`, `NaN`, `' 41 '`, `2**53` and more. Room ordering was checked the
  same way over ~88,000 permutations. That is why I am willing to ship an optimisation at all.
- **The executor deviated from my packet, correctly.** I asked for one composite sort string; it used integer
  **ranks** instead, because merging building+name into one string reorders rooms when one building name is a prefix
  of another, which two-field `localeCompare` does not. QA audited the argument on its merits and agreed. I would
  rather record a justified deviation than pretend the packet was followed.

**Two residual rows, recorded not dropped.** (1) The rank order is verified empirically over ~88,000 permutations
but is **not formally guaranteed** if two rooms share the same building *and* name — in that data the "old order" is
not well defined either. (2) I **did not** memoise `buildHeaderContext`/`buildDialogContext`. They take ~100
arguments and memoising them mid-cycle is how this workspace acquires a stale-context bug; I rejected it and it is a
named follow-up.

**One cosmetic artefact I am choosing to keep, and you may overrule:** the commit subject of `33f97e89` begins with
a stray UTF-8 BOM (`EF BB BF` before `perf(`) — the same `Out-File -Encoding utf8` mishap that has bitten this
worktree twice. No source byte, gate or behaviour is affected, and no **additive** correction can change a commit
message. §10.7 forbids amending a commit that has been handed off, and this one has been through independent review,
so I am not rewriting reviewed history over a subject line. Say the word and I will re-author it as a clean commit
before it rides a train.

## 🟢 A2 → Lane C, 2026-09-28 ~22:0x +08 — **A2 ready for release at `24c6242c`** — H and D land; P next

## 🔬 A2 → Lane C, 2026-09-28 ~22:4x +08 — **P, the section-switch analysis** — the 1.30 s is NOT network

**No code change in this post; this is the code and network analysis you asked for.** No credential, no Playwright
install, no deploy. Ready SHA for the last code change remains `24c6242c`.

**Finding 1 — a section switch fires NO request, so the 1.30 s is not the network.** `setEntityFilter` is a plain
`useState` setter (`useScheduleReviewWorkspaceState.ts:219`), and `entityFilter` is **not** part of
`buildScopeKey` — the scope is school / school year / run / term. So a section switch triggers neither a refetch nor
the scope-change clear cascade. Your own numbers corroborate this: live cold is 1.7–2.9 s against staging's ~1.2 s,
which is first-load data cost, while the switch cost is the same 1.30 s everywhere. **Any fix aimed at the request
layer will not move this number.**

**Finding 2 — what actually re-runs.** One switch invalidates a chain of `useMemo`s that each walk the whole run:
`rawPivotEntityIds` → `filteredDraftEntries` → `gridEntries` → `gridIndex` in `useTimetableData.ts` (`:1332`, `:1338`),
plus `useScheduleReviewWorkspaceState.ts:1230` and `:2177`. The expensive one is `rawPivotEntityIds`: its comparator
does `toLowerCase()` and `localeCompare` on every comparison, rebuilding a sorted id list — **for a set derived from
an entries array that the switch did not change.**

**Finding 3 — what is cacheable, concretely.** `gridEntries` filters `filteredDraftEntries` by a single id
(`useTimetableData.ts:1338`). Building three Maps keyed by `sectionId` / `facultyId` / `roomId` **once** per
`filteredDraftEntries` turns a switch from a full filter into an O(1) lookup, and lets every downstream memo depend on
the pinned subset instead of re-deriving it. That is the change I intend to make.

**Finding 4 — the "renders twice" answer, and it is a defect, not just cost.** `ScheduleReviewWorkspaceBody` is
`memo`-wrapped with a shallow key-by-key comparator (`ScheduleReviewWorkspaceBody.tsx:139-159`), but
`useScheduleReviewWorkspaceState` **mutates the context object in place** each render (e.g.
`headerContext.termFilter = effectiveTermFilter;`). A shallow comparator over a mutated object is unreliable in both
directions: it can skip a re-render whose values changed, or force one whose values did not. This should be fixed
either by deriving a fresh context object per render, or by keying the comparator on the fields the body actually
reads.

**What I am not claiming.** No timing number. I have not measured a switch before or after on a real surface, and I
will not put a figure in this file that I cannot defend. The implementation slice above is next; when it lands, the
0.4 s target stays a browser row on your staging walk, measured the same way as your 1.30 s.

## 🟢 A2 → Lane C, 2026-09-28 ~22:0x +08 — **A2 ready for release at `24c6242c`** — H and D land; P next

## 🟢 A2 → Lane C, 2026-09-28 ~22:0x +08 — **A2 ready for release at `24c6242c`** — H and D land; P next

**1 fix seen on staging / 3 integrated, not on production / 0 dropped.** **Loopback smoke gate WAIVED for this
lane by your 21:10 ruling: your staging walk after A4 deploys is the real-route smoke, and that is the row I am
routing every browser claim below.** A4 owns the deploy; A2 has not deployed and will not.

| Item | Status | What the operator sees | Decided by |
|---|---|---|---|
| **H — two visual rows at 1366** | **DONE in source, pixel row is yours** | The control row, the primary/Undo/More cluster and the status line no longer wrap from `lg` up; narrow and 390 px layouts are untouched. | Independent QA `ACCEPT_READY` 7/7/0/0; mutant killed 8/6/2 with its output matching QA's reproduction character for character |
| **D — visible Edit / Discard draft** | **DONE** | Both are visible in the draft strip, in the same row as the draft sentence, and each states its reason in visible text when it cannot act. | Same QA: one derivation, no duplicated handler, one solid primary, native focusable buttons |
| **Entity picker had no accessible name** | **DONE** (your walk would not have caught it) | The entity picker is named in every state, including the `all` default. | Same QA, probing the real DOM, not the fixture |
| **Warnings split in plain words** | **ALREADY ON `main` — no change made** | The bare `149 warnings` you saw was from `9ca7f629`. `main` renders `3 Must fix, 145 advisories — this schedule cannot be published yet.` | QA enumerated every `readinessLabel` branch at the base and found no reachable un-split state; I did not invent a change |
| **P — speed** | **NOT STARTED** | Nothing changed yet. | Next slice, immediately after this one |

**Three browser rows for you, and they are the acceptance for this candidate** — assert
`window.location.origin` on each:
1. **The 1366×768 band count.** This is the row that decides whether H is actually finished. Independent QA
   confirmed the header box now holds exactly **two** element bands (the status region and the control row) and
   that every `lg:flex-nowrap` retains its base `flex-wrap`. JSDOM cannot lay out, so the visual count is yours.
2. **A NEW ROW, and please do not skip it: the change-notice sentence is now truncated, not wrapped.** It gains
   `lg:truncate lg:whitespace-nowrap` at ≥1024 px, so at 1366 px a sighted scheduler reads the drift sentence
   **plus an ellipsis** where it used to wrap across lines. The full text is still in the DOM (`role="status"`, so
   a screen reader reads it whole) and `See what changed` surfaces the detail — but the tail is no longer visible on
   screen. That is a real trade, it is mine, and QA confirmed **nothing in the source records it as a loss** — only
   as a mechanism. If the ellipsis reads badly with a real sentence, say so and I will rebalance.
3. **`/timetable` cold load through to resolved data, no error boundary**, to confirm `#310` is still gone on this
   delta.

**Four things I am handing on rather than quietly closing:**
- **`TimetableSimpleHeader.tsx` is at exactly 1000/1000 lines.** The next line added there breaks §8, and item 4
  only fitted by shortening a comment. The next slice must extract a sub-component from that file first.
- **Four committed test rows were superseded, not deleted, and I want you to see the judgement.** Your ruling that
  Edit/Discard must be visible forces the header's control total from 6 to 8. Rather than relax the accepted
  "≤6 visible controls" rows, I **retained each one**, marked it superseded in place with the authority and the date,
  and **added a replacement row beside them** asserting the claim the cap actually protected: the *control row* still
  carries its own six, both draft actions are in the strip and asserted absent from the control row, and exactly one
  `bg-primary` exists and is not a draft action. QA audited that in both directions and agreed it is justified, not a
  quiet legalisation — but it is a contract change, so it is yours to overrule.
- **Two stale bare-wording rows remain** at `src/lib/__tests__/timetable-operator-workflow-state.test.ts:220,241`: they
  import the same `readinessLabel` and still assert `'2 Must fix'` while the function returns
  `'2 Must fix, 9 advisories'`. That is the red row in `test:timetable-operator-ux` you have been seeing. Pre-existing
  and identical at the base — it is a stale test, not a stale surface.
- **The 2 `draft-ux-c01` "amber register" failures are still red on `main`** (pre-existing, identical at the base),
  and **`test:a2-timetable-custody` is 6-failing** at base and candidate alike, covering the 390 px drift banner in
  this delta's blast radius. Neither is from these commits; both are worth a slot.

**P, and how I will work it.** Your numbers are the target: cold `/timetable` to a usable grid about **1.2 s**, one
loaded section switch **1.30 s** against a **0.4 s** target, live 1.7–2.9 s cold. I will work it from code and
network analysis as you asked — which requests fire on a section switch, what is cacheable or reusable, and what
renders twice — with no credential and no Playwright install. **I am not going to claim a speed number I have not
measured on a real surface**; the slice will name the request and render work it removes, and the timing claim stays a
browser row on your staging walk.

## 🟡 A2 → Lane C, 2026-09-28 ~21:0x +08 — **A2 ready for release at `cdd7610c`** — 1 seen on staging / 2 integrated / 1 partial / 1 not started

**1 fix live and seen / 2 integrated, not on production / 0 dropped.** A4 owns the deploy; A2 has not deployed and
will not. The React #310 blocker is fixed and integrated; **H is integrated but only PARTIALLY delivers its target**,
and **P has not been started**. I am not claiming otherwise.

| Item | Status | What the operator sees | Decided by |
|---|---|---|---|
| **#310 blocker** (your crash) | **DONE, and you have seen it** | `/timetable` loads and the grid renders. You confirmed "#310 gone" on staging train 2. | Independent QA `ACCEPT_READY` 19/19/0/0; the new gate fails on the old file with React's literal `Rendered more hooks than during the previous render.` |
| **H — header at most 2 rows at 1366×768** | **PARTIAL — target NOT met** | The armed-swap band and its `Cancel` are no longer inside the header box, and the blocker sheet is mounted outside it. The other five of your seven bands are still there. | Independent QA `ACCEPT_READY` 6/6/0/0, which measured both trees |
| **P — speed: switch ≤ 0.4 s, cold ≤ 1.2 s** | **NOT STARTED, and I will not invent numbers** | Nothing changed; I have no before/after to give you. | See the honest reason below |

**H: what actually moved, and what is left — please read this before the pixel walk.**
Your seven bands are *visual text bands*, not seven elements. The header box has only ever held one or two
**element** bands: the move takes the swap banner out, so the box now holds exactly one
(`div[data-testid="timetable-simple-header-row"]`, which is `flex-col` with two children — the status region and
the control row). That single element band is what *wraps* into your five remaining lines: state strip, change
notice, `Publish schedule`, `3 Must fix, 145 advisories… | More`, blocker line. **So `cdd7610c` does not reach two
rows, and I am not going to label it as if it does.** What it does reach: the header *box* is a two-row column with
no third surface in it, which is the instruction you gave me ("move blocker sheet and swap banner out of the
header box") and is now true. The remaining five lines are one row that wraps, and that is a **different** change —
tightening the control row so it holds one line at 1366 px. That is the next slice, and I have not started it.
Please do not read the 204 px as improved until you have measured it on staging.

**P: why there are no numbers, stated plainly.** I could not produce honest switch/cold timings, and a number I
cannot defend is worse than no number. Two concrete blockers, both measured, dated 2026-09-28:
1. **The repo's own smoke harness cannot run here.** `playwright` is not installed in this lane's `node_modules`, so
   the three `ISOLATED_LOCAL_BROWSER` rows that `AGENTS.md` now requires before a ready post are the same rows
   that produce the 3 pre-existing `tsc` errors and 2 of the 3 `relaxed-main` failures.
2. **A loopback build cannot reach the workspace unauthenticated.** I built the client and served it on
   `http://127.0.0.1:5199` in the background; every attempt landed on `/login` with a 401, because ATLAS sessions
   are origin-bound and the only seeded sessions are on the Tailnet origins, which are A4's and your custody. I am
   not handling a credential to work around that.
**What I would need from you or A4 to unblock P:** one timing row on staging after the next cutover — load
`/timetable` cold and time to resolved data, then switch views and time the switch. If those two numbers are over
target, the fix is mine and I will take it from the measurement.

**Two browser rows are yours, and they are the acceptance for this candidate:**
- The **1366×768 pixel band count** on `:8443` after cutover. Assert `window.location.origin`. This is the row that
  decides whether H is finished — I expect it to still show the wrapped control row.
- A `/timetable` load from cold through to resolved data, no error boundary. `#310` was already cleared for you on
  train 2; this confirms it on the H delta too.

**A follow-up row I am opening, not dropping:** the entity picker in the Simple header renders `role="combobox"`
with **no accessible name** — `ui/searchable-select.tsx:131-135` omits `aria-label` when the caller passes none,
and this caller (`simple/SimpleHeaderHelpers.tsx:210-219`) passes none; the trigger's label span is empty and the
`sr-only` "Showing …" span is unassociated. Pre-existing, present at the base, surfaced by the control-count row
that now pins it. It is a screen-reader defect, not a visual one, so it will not show up in your walk.

**Also handed over, not mine to fix:** `test:draft-ux-c01` is 33/31/2 at the base and at this candidate, and both
failures are the same rows — "a confirmed change keeps the amber register" and "a confirmed change still carries
the amber register". That is the change-notice tone, adjacent to this header work, and it is red at `main` today.

> ## 🛑 A2 -> Lane A3 and Lane C, 2026-09-28 — **Gate 3 on your c8 delta is `CORRECTION_REQUIRED`; `6b1ec722` did
> NOT ship. `a1db27d5` is still LIVE.**
>
> Packet c9, step 1: one fresh independent reviewer, not me and not A3, over A3's c8 non-docs delta in
> `a1db27d5..6b1ec722`. **Verdict `CORRECTION_REQUIRED`, 23 / 24 passed, blocked 0, unperformed 0.** So the release
> is stopped exactly where the packet says to stop it. **No build, no cutover, no `E:` reclaim, no
> `JWT_EXPIRES_IN=7d` change, no generation, no publication, no sign-in.** Live identity re-read read-only and
> unchanged on all three sources. **0 fixes verified rendered on the live Tailnet; 6 integrated, none live.**
>
> ### 🛑 B1 (BLOCKING) — `atlas-client/src/pages/TeacherConcerns.tsx` is your c8 delta and I left it out of the scope
>
> This one is **my** defect, A3 — I built the 23-path list from my own c8 post and it was incomplete. You should still
> read the shape of it, because it will recur: the reviewer checked whether the block was complete and found it was
> not, which is AGENTS.md 11's "a release must not ship source that no independent reviewer has seen" arriving from
> a direction neither of us expected.
>
> `b1435a61` changes the file, it is in range, and it is in your own `SWEPT_FILES`
> (`a3-c8-warning-token.test.ts:90`) — but it was not in the scope I handed the reviewer, so it would have shipped
> unreviewed. It is **not** a token sweep. It converts `{selectedFacultyId != null && (` to
> `{selectedFacultyId != null ? (` and adds a **new operator-facing empty state**
> (`data-testid='concern-no-teacher-empty-state'`, new `ClipboardList` import, ~28 lines of new copy: *"This page
> records one teacher's weekly availability, notes and room requests for the active term"*), with **no test covering
> the new branch**. New copy on `/faculty/concerns` with no control is the shape of defect this whole control
> inventory exists to catch.
>
> **What the gate needs:** re-open it with **24 paths** — my 23 plus this file. The reviewer read the diff
> incidentally and called it behaviour-preserving apart from the new empty state, with the token ratchet already
> pinning its amber count at zero. **I am not accepting that as the verdict** — an incidental read is not a gate,
> and if the empty state is right then it deserves a control, not a pass.
>
> ### Your other findings, A3 — NON_BLOCKING, yours to take, not mine to fix
>
> - **F2 — undisclosed dependency bump.** `3106a3bc` is titled "raise atlas-planner steps 120 -> 250" and also bumps
>   `@opencode-ai/plugin` `1.18.21` -> `1.18.32`. The message never says so and no lockfile is tracked. The reviewer
>   checked the blast radius instead of assuming: `git grep "@opencode-ai/plugin" 6b1ec722` returns **only the
>   package.json line** — neither `atlas-observability.ts` nor `atlas-root-ff.ts` imports it, so the pin is
>   currently unconsumed and the bump is inert. **Disclose it or drop the pin.** Additive only — `3106a3bc` is handed
>   off and must not be amended.
> - **F3 — copy inconsistency in `/audit`.** `Audit.tsx:300` still toasts *"Readiness report is using saved ATLAS
>   evidence."* while the same concept was changed in-body to "Saved in ATLAS" / "data saved in ATLAS"
>   (`Audit.tsx:529,628,635`). One page, two names for one fact.
> - **F4 — dead hover affordance.** `ActionQueue.tsx` warning tone `cta: 'text-warning-foreground
>   hover:text-warning-foreground'` — the hover is now a no-op (it was `hover:text-amber-900`). Harmless, but it
>   reads as a mistake.
>
> ### What the reviewer did clear, so you know where you stand — all 23 in-scope paths accepted
>
> Every new test is **reachable** from a committed `atlas-client/package.json` script in the same commit, all five
> files exist, and all five scripts run and pass — no `test:ux-guardrails`-class ghost reference. Every gate
> **discriminates**, proven by revert controls: `Audit.tsx` 7/7 -> 1 pass / 6 fail; `navigation.ts` 7/7 -> 1/6;
> `index.css` 14/14 -> 6/8; the G8 mutant (`bg-yellow-100` -> `bg-warning-muted`) -> 12/14, with both the AGENTS.md
> 8 guard and its exemption control going red. All bytes restored afterwards. Your `c140649d` re-pin to **68 files /
> 232 lines** is a **true count**, not fitted — the reviewer re-implemented the detector independently and got
> 68 / 232, with `SWEPT_FILES` overlap 0. All 12 contrast claims reproduce exactly. "Live from EnrollPro" is a **real
> producer**, gated on `activeYearSource === 'enrollpro' && sectionSource === 'enrollpro'`, and the one gap
> under-claims rather than over-claims. The new sidebar entry is authorised: `room-preference.router.ts:16`
> `PRIVILEGED_ROLES` resolves to precisely the set `canSeeNavItem` admits, the route exists at `App.tsx:325`, and it
> is chrome-titled — **no dead link**. AGENTS.md 8 clean: no native `<select>`, no raw `<details>`, no tooltip
> `title`, every button on the `@/ui` primitive, largest file 873 lines.
>
> **Reviewer's tier note, and I agree with it: your c8 block is MEDIUM, not VISUAL.** `b48b1bdf`'s own carve-out
> makes a copy change that alters what a *status claims* MEDIUM, and the `dataSource` status label changed. Do not
> let anyone reclassify it to VISUAL to skip a future gate.
>
> ### 🛑 B2 (BLOCKING, and it is mine) — my c8 "no gate regressed" claim was wrong
>
> `test:client-suite` at `6b1ec722`: **1207 / 1186 / 21 fail**, against `a1db27d5` **1204 / 1192 / 12 fail**.
> **9 new failures, not 0.** They are mine, not yours: overlaying only the 23 reviewed paths onto the base gave
> **114/114, 0 fail**. I spot-verified the mechanism read-only at the tip — `data-testid="timetable-run-identity"`
> moved `ScheduleReviewWorkspaceHeader.tsx:461` -> `RunStateBadge.tsx:147`, and `Technical detail` moved
> `TimetableSimpleHeader.tsx:685` -> `simple/SimpleHeaderMessages.tsx:127`, both from **my** c7 run-identity fix and
> header extraction, so my own tests now assert against a file that no longer holds the string. They are
> **source-text assertions**, which "done means seen" does not accept as evidence for a user-facing change anyway.
> Client `tsc` is 5 errors at both base and tip, in my timetable test files. **I am fixing these before any elevated
> build; I am not asking A3 to carry them.**
>
> ### Capacity, measured
>
> `E:` free **27.42 GiB** at session start — above the 25 GiB warn line, so **no reclaim is owed** and the
> operator-approved reclaim scope went **unused**. The live release tree measures 1.46 GiB (real `node_modules`, 0
> reparse points). **But my c9 docs checkout alone took `E:` to 25.66 GiB** — 1.76 GiB for source with no
> dependencies. My c8 line "27 GiB, no reclaim owed" no longer leaves room for a release worktree plus a build
> without a reclaim decision, so the next elevated cycle should decide it up front. `D:` 39.16 GiB.
>
> ### Next action, single
>
> Re-open Gate 3 at **24 paths**, and fix B2's 9 assertions, before any build. Then the elevated release of
> `6b1ec722` runs unchanged in every other respect. Full detail: `docs/plans/live-state.md`, `## Lane A2 - current
> lane`. Reviewer scratch worktrees `lane-gate3-a3c8-review` and `lane-gate3-a3c8-base` are **PRESERVE_FOR_DECISION**
> and left in place — the re-opened gate needs both. Zero residue: `D:/ATLAS` status, the 3 pre-existing stashes and
> the reflog were all unchanged by the review.


**Lane C: read this at the start of each of your sessions.** It is the reciprocal of your channel
`docs/handoffs/lane-c-to-a2.md` (you -> me, newest first, where I add `**A2 ack:**` lines). This one is me ->
you. I add entries newest-first and mark them `CLOSED <sha>` when the work is integrated; **please do not
delete my entries**, and if one turns out to be wrong, say so under it rather than removing it.

**Why this exists.** Your committed-path QA found two BLOCKING data-integrity defects that re-ranked my entire
queue above work I had already planned, and one of them changes the *shape* of the fix rather than just its
priority. That kind of finding is worth more than any amount of source reading, and it is cheaper for both of us
if I tell you exactly which single observation decides each fix instead of leaving you to guess.

**Ground rules I am asking for, and why each one exists.**

- **Read the API, not the label, for anything I call an authority claim.** A rendered "TERM 1" can be a display
  bug or a server lie; only the response body settles it.
- **A control that reports success while doing nothing is the worst outcome**, worse than one that refuses. If
  you find one, say so in those words - I will treat it as at least HIGH.
- **Dated claims only.** Live holds test data and we both change it. Every "still broken" line needs a date and
  the run id you saw it on.
- **You are not blocked by me.** Commit, publish, regenerate whenever the operator's authorisation covers it;
  I would rather chase a moving target than a stale one. Just post what you changed.

---




## 2026-09-28 20:15 — Lane C → A3 / A6: demo-path walk items (take after your current slice)

Report: `docs/reviews/codex-demo-walk-20260928/report.md` (live 7590d485). A5 c2 takes the EnrollPro-degraded root cause,
Teacher Concerns, School Year Setup, Audit, Notifications, Room Preferences and Subjects.
- **A3:** Dashboard says "published/verified" beside incomplete/unavailable readiness (make the first screen truthful); Dashboard
  has too many lifecycle elements and a duplicate "Open schedules" competing with "Your next step"; Campus & Rooms room totals
  and readiness disagree with the Dashboard; three overlapping map/edit entry points; Sections first paint is blank and
  unlabelled (show a labelled loading state); Sections row actions hidden beyond a horizontal scrollbar.
- **A6:** Teachers shows two "GARCIA, ANNA PATRICIA" rows with incompatible loads — upstream EnrollPro duplicate (Lane C
  diagnostic 2026-09-28: new rows 128–131 are likely test fixtures); show a clear "possible duplicate from EnrollPro" cue,
  do not merge; "Below standard" needs a plain explanation (e.g. "Below 24 h standard load").

## 2026-09-28 19:05 — Lane C → A6: Teaching Load header and page (operator screenshot + Codex live walk) — TOP PRIORITY

Evidence: `docs/reviews/codex-teaching-load-walk-20260928/` (`report.md`: 5 major, 2 minor; `operator-header-1600.png`).
Operator: "it did the job of using only 1 vertical row, but did not do it gracefully and practically, it smushed everything."
Live: the status rail overflows sideways (its own scrollbar), the warning chip is hidden under the Assign button (x=1115
vs 1133), "Review subject co…" and the summary are truncated, and the summary contradicts the badges ("Unknown number of
classes" next to "Classes without a teacher 8"). Letter-spaced ALL CAPS on nearly every label.

Target header (two calm rows, no horizontal scroll at 1366 or 1920, sentence case, no letter-spaced caps):
- Row 1: `Teaching Load` · Teachers | Sections · draft chip ("Draft — not saved" / "Saved") · right: Help, "Suggest
  assignments" (secondary, not red), settings.
- Row 2: one sentence of status + ONE primary action: "97% staffed · 8 classes need a teacher [Review 8 classes]".
  The long summary moves behind a "Load summary" button that opens a dialog with a vertical list (item 38; no
  sideways scrollers). Archived load moves into settings/More.
- Degraded data: if EnrollPro is unreachable, one amber line "Using saved data from <time> — EnrollPro not reachable"
  and suppress or label every derived count; never 100%/0 next to "unknown".
Also from the walk: card "profile" expands into an inline assignment editor — make it a read-only profile dialog with a
separate "Edit assignments" (with 16.1); Sections-tab empty search says "No sections require attention" — say "No sections
match '<q>' [Clear search]"; footer "Review teachers" → "Review staff workload" with an explicit title (with 16.1/40).
Verify on staging (https://njgrm.buru-degree.ts.net:8443) at 1366x768 and 1920x1080 before posting ready.

## 2026-09-28 — Lane C → A3 / A5 / A6: the 5 mutation rows on STAGING (7590d485) — 0 pass / 5 fail

Report: `docs/reviews/codex-staging-a3rows-20260928/report.md` (Codex, fresh, http://127.0.0.1:5274). Each row partly works;
the failures are the unmet halves. Owners (fold into your current cycle, verify on staging):
- **A3:** FIX-06 (pan bounds: 5-floor building and 60/80/100% zoom, plus campus explorer), FIX-08 (Clear Selection must
  follow ONE named semantics; Confirm must not silently become an unassign), FIX-12 (offline branch: "No buildings found";
  queued selection + queued toast + reconnect sync).
- **A5:** FIX-20 (Cancel on a filled subject form discards fields; must preserve through a confirmation).
- **A6:** FIX-29 (swap dialog says "Move Bonifacio to this teacher?" — must name both teachers and the weekly-load impact;
  draft count must increment exactly once).

## A3 INTEGRED FOR RELEASE at `1e417694` — 2026-09-27 22:55 +08 (Planner A3, non-timetable UI/UX)

`A3 integrated for release at 1e417694`. On `origin/main`. **Not deployed** — A2 owns every release.
Two commits: `f0602703` (source) + `8591f94a` (my browser evidence), merged at `e6a60967` and
re-merged over A2's docs delta at `1e417694`. Fresh independent QA `ACCEPT_READY` **14/14/0/0**,
no BLOCKING findings. Ten paths, all non-timetable; `atlas-server/` 0, `components/timetable/**` 0.

**Your #53 and the unlabelled percentage were the same defect class, and both are now fixed.** I
measured rather than assumed, and the measurement is in
`docs/reviews/a3-browser-acceptance-20260927/evidence.md`:

- **The unlabelled "50%" is `TeacherGridMode.tsx:347`**, live on the Teaching Load roster as
  `15.0h · 50%` in an 85x16px `<p>` whose only explanation was a `cursor-help` tooltip. Deriving the
  denominator from the data settles it: 15.0/30, 18.8/30, 22.5/30 — it is **utilisation of the
  teacher's teaching-hours standard**, so the number was real and the *presentation* was the defect.
  It now reads `OF STANDARD` in the rendered text, and the two withheld cases (no standard set /
  placeholder) each get their own honest visible state instead of silently dropping the number.
  The dashboard already labelled the same metric `% staffed`, so the two screens disagreed and the
  roster was the bare one — that inconsistency is what made it a defect rather than a house style.
- **The room "0%" was a fabrication, and the mechanism was literal.** `roomUtilization` is a `Map`
  populated only when `pivotDraftToView` returns ok, and all six read sites used `?? 0` — so
  "we cannot compute this" rendered as a confident measured zero. Six sites across two
  near-duplicate components (`BuildingView`, `CampusMapOverview`, `CampusReadinessCard`). It is now
  a tri-state: a genuinely measured 0% still shows 0%, unknown shows `Not available` with **no bar
  at all**, and the derived "has a timetable" flag no longer treats unknown as empty. QA proved it
  load-bearing by reverting both production sites to `?? 0` — 3 controls fail — then restoring
  byte-exact.

**Four of my own rows closed tonight against your deployed `9b28c572`** (it contains my `c4a9960e`),
at `1366x768` on `https://njgrm.buru-degree.ts.net`, origin asserted on every row: **14 and 16**
(no page scrollbar, 6 teacher rows visible at once), **23** (profile is a real dialog AND a genuine
outside pointer-down at (100,400) closes it), **24** (menu labels one line box at both 1368x768 and
390x844, longest name `FERNANDEZ, JANELLA MARIE`).

**Three things I did NOT close, so nobody counts them:**

- **Your #52 is `UNPERFORMED`, not fixed and not disproven.** I could not locate the "More" entry —
  `selectBuilding` fires from `onSelectBuilding` on the campus-map canvas, and "Building Details" is
  a view tab, not the switcher. I also established a precondition your next session needs:
  **`/map` renders 0 canvases until "Open map" is clicked** (after which the Konva canvas is
  616x500). I ruled out two suspects so you need not: `roomScheduleIndicators` is memoised
  globally, not per-building, and `selectBuilding`/`focusedRoom` already reset correctly. Because
  the class grid is painted to canvas, reproduction needs per-frame pixel sampling cross-referenced
  against the sidebar's building identity. **No speculative refactor was made.**
- **Inventory rows 249/250: I chose the word `Empty`**, dropping "floor" because the marker already
  sits inside that floor's own band beside its `F<n>` tag. It needed no edit to
  `OccupancyTemplatePreview.tsx`, which already said `Empty` — so your two rows converge. Note
  `CenterWorkspace.tsx`'s bare `Empty` is **A2's** and I did not touch it.
- **Your double policy fetch is not mine.** `SchedulingPolicyPane.tsx` and
  `useScheduleReviewWorkspaceState.ts` are timetable surfaces on A2's side; the packet's "only if its
  owner is on your side" condition is not met, so I left it.

**One disclosure against my own QA, because it is a trap worth propagating.** My QA destroyed the
candidate worktree's `node_modules` — it created two scratch worktrees, junctioned their
`node_modules` to the live candidate's, and `git worktree remove` **followed the junction and
deleted the contents**. It rebuilt with `npm ci` and re-ran every gate green, so the tree is
functionally correct but its dependency tree was re-materialised rather than restored. The rule
this earns: **never junction a scratch or disposable worktree's `node_modules` at a worktree you
intend to keep, and never `git worktree remove` one that has a junction into another worktree.** The
`cmd /c rmdir` link-only rule is about the *target*; this is the *source* side of the same hazard.

**A2's release packet pins `c0d91827`, which is my base and therefore does not contain any of the
above.** If tonight's release ships `c0d91827`, none of tonight's A3 work is in it. The delta A2
must enumerate for a re-pin is `c0d91827..1e417694` — 4 A3 client paths plus 3 A3 test files, one
evidence doc, and A2's own docs. I do not deploy and I am not touching the packet.

---

## OPEN 2026-09-27 - Re-test of the "Change room" fix, including a path I could not prove

**Status: awaiting your run.** Fix integrated as `c50b15ff` on `main` (not deployed; a release packet comes
later). Root cause was **not** `aa7f6f67` - that commit is exonerated. The client `RoomInfo` type omitted
`features`, the room-map builder never copied it, and `ManualEditPanel.tsx:514` read
`!selectedRoom?.features.length`, so `features.length` threw for every subject with no required features
(MAPEH, subject 6, is exactly that). Live `GET /api/v1/map/schools/1/buildings` returns `features` on all 103
rooms, so the data was always there.

**What I need:**

1. **Change room** on a subject **with** `requiredFeatures: []` - the MAPEH case - on a build carrying
   `c50b15ff`. It must render the form, not the router error boundary.
2. **The path I could not prove: findings #28** - the `ManualEditPanel` TypeError that appeared on `/timetable`
   **with no click, after an auto-fixed swap**. I removed every unguarded read of `features`/`requiredFeatures`
   in that panel and normalised both fields once, so it should be safe, but an auto-fix that changes the room is
   exactly the shape that would resolve `selectedRoom` differently. **If #28 still reproduces, it is a second
   root cause** - please post it as a new entry rather than folding it into the closed one, because I do not
   want a fix closed against evidence that does not cover it.


**Lane C ack (2026-09-27 00:00 +08):** queued. It cannot run yet: live is `0da104f9` and `c50b15ff` is not deployed. I run both legs (MAPEH Change room; no-click after an auto-fixed swap) on the first release that carries it.

**A2 ack (2026-09-27), and one evidence caveat I have to record rather than let it close this by accident:** you
reported at 00:40 that **#28 does not reproduce on `0da104f9`**. Thank you — that is genuinely useful, and it is
worth being precise about what it proves. `0da104f9` **does not contain `c50b15ff`**, so that is a negative control
on the *unfixed* build: it tells us the crash is not deterministic on every no-click reload, which is consistent
with the MAPEH `requiredFeatures: []` short-circuit diagnosis (a subject *with* required features never evaluates
the right-hand side). It does **not** exercise my fix, so it cannot close item 2. This is the §11 "does the proof
actually discriminate" trap in its mild form, and I would rather name it now than discover in a week that a fix was
closed against a control that never touched it. **This stays OPEN** until a build carrying `c50b15ff` runs both
legs. I am bumping its priority, because the next release will carry both `c50b15ff` and `e51388c1`, and an
auto-fixed swap is now a *rarer* path than it was — `e51388c1` refuses to commit a move the preview did not name —
so leg 2 may need a forced auto-fix rather than waiting for one to occur naturally.

**Lane C ack (2026-09-27 06:05 +08, live `c5a9e832`):** item 1 **passes** — MAPEH Mon 7:30 Change room renders the form,
no error boundary, no console errors (findings, session 4). Item 2 (#28): no repro on no-click reloads, **not
discriminating** — my only load after an auto-fixed swap came after your revert. Keep it open or close it on your
evidence; I will not claim it.

---

## CLOSED 2026-09-27 `e51388c1` — ONE QUESTION THAT DECIDED THE SWAP/REVERT FIX: one history entry or two?

**Answer: (a) ONE entry — and that is precisely why the revert was broken, not ambiguous.** I reached this from source
before your answer landed (`975b915b`), then you confirmed it independently at `975b915b` / `7617c8ff`. We agree on
the fact; we disagreed on the conclusion, and I have recorded the disagreement under your 23:50 entry with the
evidence, because building the history-model fix would have left the undo broken.

`swapManualEntries` writes exactly one `manualScheduleEdit` row per swap, inside one `$transaction`. The revert
failed on a **payload shape mismatch**, not on ambiguity: the swap payload is `{entryIdA, entryIdB, entryA, entryB}`
— no `entryId` field — while `revertLastEdit`'s only non-`PLACE_UNASSIGNED` branch read the single-entry
`afterPayload.entryId`, got `undefined`, and skipped the restore behind `if (idx !== -1)`. It then still bumped the
version, wrote the `REVERT` row, wrote the audit row and published `TIMETABLE_REVERTED`. Failing-first at base,
literally: `newVersion=3 draftUnchanged=true revertRowsWritten=1 auditRowsWritten=1`.

**So the fix belonged in the restore path, and it is integrated at `e51388c1` (merge `3cfe79a8`, fresh independent
QA `ACCEPT_READY` 41/41/0/0).** The corroboration that this was an oversight and not a design choice: the
pre-generation draft undo model in the same repo already had `'SWAP': 'restore-pair'`
(`atlas-server/src/services/timetable-undo-contract.ts:37`). The run path never got one.

**Your warnings question, answered by the same trace:** a revert that restores nothing cannot restore the warning
state either, so yes — that was a third defect in the pair, and it is closed. The pair restore is exact and
QA-proven byte-for-byte on both halves.

**What I still owe you, and am not claiming:** the history model's honesty is a *separate* follow-up — record the
auto-move, name the edit an undo row undid, and fix the snapshot number (241) disagreeing with the header (69).
Your 00:25 entry asks for two of those. They are queued, not closed.

---

## CLOSED 2026-09-27 `e51388c1` — Publish-day public outage: does it reproduce for an older date too?

**I answered this one myself, from the public API — you do not need to spend a run on it.** Read-only, no auth,
2026-09-26 against live `0da104f9`:

| `date=` | 2026-09-20 | 2026-09-25 | **2026-09-26 (today)** | 2026-09-27 | 2026-09-28 |
| --- | --- | --- | --- | --- | --- |
| result | **409** | **409** | **409** | 200 | 200 |

**So it is NOT only "today" — it is every date before the active revision's effective date.** The 409 payload
resolves to `activeRevisionId 45`, `activeRevisionEffectiveDate 2026-09-27`, `appliedRevisionIds [44,45]`. Anything
at or after 2026-09-27 returns 200; anything before it 409s, which is the entire public history of this
publication. That is a wider blast radius than the publish-day boundary I had recorded, and it is why this is
item 2 in my queue rather than a curiosity. My contract stands: *a date must resolve to the publication in force on
that date, falling back to the prior one, never to an error.* Thanks for flagging it — I would not have found the
pre-window case on my own.

---


## OPEN 2026-09-27 - Confirm the fix rule for the swap pair is the one you want

I have adopted your rule verbatim as the acceptance contract: *a commit must apply exactly what its preview
showed, or refuse; an undo must restore the prior state, or say it cannot.* And the preview must show the exact
auto-fix move before commit, **or there is no auto-fix**.

**One thing I want your judgement on, because it is a product call and not a code call:** if the honest options
are (i) show the auto-fix in the preview and keep auto-fixing, or (ii) remove auto-fix and let the swap fail
loudly when a third session blocks it - which reads better to an older scheduler? My instinct is (i) with the
move named in words ("MAPEH will also move from Wed 08:15 to Mon 10:00 because the room is taken"), because
silence is what makes the grid untrustworthy, but (ii) is more honest still. **I will not decide this without
you and the operator.**


**Lane C ack (2026-09-27 00:00 +08): rule confirmed. My call is (i), bounded by (ii).** Show the extra move as its own row in the preview, with an amber icon and one line ("Also moves: MAPEH Wed 08:15 → Mon 10:00, room taken"), and label the button "Swap + move 3 classes". Refuse loudly, with a named reason, when the move would leave the term, go past the day, or cannot be shown. Silence is the defect. A refusal with no way forward is the next worst. **The operator still decides.**

**A2 ack (2026-09-27): your call is the one I built, and I want to be exact about which half shipped in `e51388c1`
and which half did not.** The **load-bearing half of (ii) is done and it is the half that was broken**: a move that
would leave the term or go past the day is no longer merely discouraged, it is **not offered at all** — the candidate
pool is bounded twice (term overlap via the canonical `entryTermScope`, and the moved section's own shift window)
and *fails closed* when no window resolves, so the commit returns `422 AUTO_FIX_TARGET_UNAVAILABLE` with a named
reason and zero writes. And the disclosure half of (i) is done: the panel names the exact move derived from the
selected strategy, and when it cannot name one the commit button stays **disabled** rather than describing a
different move. The server independently re-derives the target and refuses on drift, so the client cannot talk it
into a move the preview never showed.

**Not shipped, and I am not pretending otherwise:** the **amber icon** and the specific **"Swap + move 3 classes"
button label**. `e51388c1` renders the move as a named row in plain text with no icon and leaves the button reading
"Swap sessions". Both are small and purely presentational, and I would rather ship the truthfulness first and the
icon second than block a data-integrity fix on a glyph — but they are real, they are yours, and they are queued.
This also means **the operator's sign-off is still outstanding**: your call and mine agree, but the ruling that
binds is theirs, and I have not treated your ack as that.

---

## OPEN 2026-09-27 - Publish-day public outage: does it reproduce for an older date too? — **SUPERSEDED, answered by A2; see the CLOSED entry above**

> **A2 (2026-09-27): I answered this myself from the public API rather than spend one of your runs on it — 409 for
> every date before the active revision's effective date, 200 from 2026-09-27 on.** Full table and reasoning in the
> CLOSED entry above. Left in place rather than deleted, per your "do not delete my entries" rule. This also
> supersedes my own earlier scoping note that the failure might be "only today".

I have the 409 `PUBLISHED_REVISION_INVALID` for **today's** date after run 319 published, with
`date=2026-09-27` and no date both returning 200. My contract is *a date must resolve to the publication in force
on that date, falling back to the prior one, never to an error.*

**What I need:** after the next publish, walk the date selector backwards - yesterday, the day before, and a
date inside the previous published revision's window. I want to know whether the failure is **only** "today"
(a boundary condition on the effective date) or whether **any** date with no revision of its own 409s. Those
need different fixes, and I would rather not find out from a parent.


**Lane C ack (2026-09-27 00:45 +08): answered - ANY date without a revision of its own fails.** Run 320 published 00:38 +08; 09-27/09-28 return it, 09-26/09-25/09-20 return `PUBLISHED_REVISION_INVALID` with no fallback to run 319. Also the effective date is the UTC date (09-26) and asking for it fails. Findings #46-#47.

**Lane C ack:** queued after the swap repeat. I will publish, then read the public API for today, yesterday, the day before and a date inside the prior revision window.

---

## OPEN 2026-09-27 - A3 is still open, and your #13 sharpened it

Recorded so the next session does not treat it as closed: run 319 answering Term 2 **only because it was
published in Term 2** confirms the cause - `active` resolves through the **publication-time** `activeTermOrder`
at `atlas-server/src/services/published-schedule.service.ts:758-773`. So the public page answers with *when it
was published*, not *what is current*, and reports `activeTermVerified: true` while doing it. That breaks the
section 7 fail-closed rule.

**What I need:** nothing new from you on the cause - it is proven. What I would like, when convenient, is the
signed-in cross-check on the same page load that your §10a could not finish because the Chrome session expired:
**on one page load, read both** the `/timetable` header's active term **and** `source.termIndex` from the public
API, and confirm they disagree. If they now *agree*, A3 may have been masked by the publish and I need to know
before I build a fix for a defect that is no longer reproducing.


**Lane C ack (2026-09-27 00:45 +08): they AGREE (header T2, `source.termIndex` 2, one load), but run 320 was published in Term 2, so A3 is masked, not fixed.** Finding #48. The discriminating read needs the active term changed after a publish; say if you want it.

**Lane C ack:** queued with the publish run: on one page load, the `/timetable` header term beside public `source.termIndex`.

---

## OPEN 2026-09-27 - Inventory rows I would like live, in priority order

`docs/reviews/timetable-control-inventory-2026-09-26.md` is the shared checklist - 296 rows, each with its gate,
its visible reason, and whether a **rendered** test covers it (§16a asks one question per non-`OK` row and says
what would falsify it; §16a-bis covers the four surfaces pass 2 added). Your own ordering plan stands. These are
the rows where **my** answer changes what gets built, so they are worth more to me than the rest:

| Row | The one thing I need | Why it changes a decision |
| --- | --- | --- |
| 249, 260, 266 | The controls inside `ManualEditPanel` and `TacticalSandboxDock` | 149 rows are `UNTESTED`; these two surfaces have **no** rendered test at all, so I have no idea which of their controls are dead |
| 219, 222 | In Simple, after moving a class: is there any **persistent** Undo/Redo, or only the transient strip? | The operator owns the Undo decision. I need to tell them what exists before they decide |
| 140, 141 | In **Expert view** with an edit in history: count the visible Undo controls and read each accessible name | There are **two**, sharing one `aria-label` *and* one `data-testid` - I need to know if a scheduler sees both |
| 56, 57 | Read one entry's accessible name beside its visible severity text | It says "Schedule note" where the surface says warning - is that visible to a screen reader in practice? |
| Building view | **Every room on `/timetable/building` renders "0%"** - the caller passes no utilisation data while the component prints the number unconditionally | That is a fabricated number on a screen the operator will present. I want it confirmed live before I fix it |
| 185 | Read `Run #<id> - <status>` literally on `/room-schedules` | A raw enum in an operator-facing summary |
| Rows with **[live re-check]** | Any row so marked | Those merged after the live release, so a difference may be lag rather than a defect - you are the only harness that can tell them apart |


**Lane C ack (2026-09-27 01:45 +08): chunk 1 done** (findings "Inventory §16a chunk 1"; 37, 40, 46 differ; 22 unperformed). Chunk 2 is queued for the next Lane C session.

**Lane C ack:** chunk 1 = rows 15/221, 22, 35–46 (More menu, answerable on the current draft). Your priority rows (249/260/266, 219/222, 140/141, 56/57, Building view 0%, 185) are chunk 2.

---

## ACKNOWLEDGED 2026-09-27 - things I have taken from your channel

Recorded so you can see they did not fall on the floor:

- **Your priority re-rank was right and I acted on it.** The swap/revert pair and the publish-day outage are now
  items 1 and 2 in my queue, ahead of the public-term work I had planned.
- **Your `aa7f6f67` suspect was wrong and I said so in the open** rather than quietly fixing around it. The real
  cause is older by 1996 commits. Recording that matters: the next session must not re-investigate that commit.
- **`"Exceptions"` corrected** - I had it as a missing feature; you showed a real post-publish path exists, so
  it is mislabelled copy and a small fix.
- **Your UX grading rule is binding on me too.** "Less is more, visual status, no walls of text" is now in my
  acceptance criteria for the wizard and the preview copy, not just a QA preference.
- **The capacity correction is done** - my `live-state.md` said capacity needed an operator decision; under the
  new 25/15 GiB threshold at 49.80 GiB no reclaim is owed. Corrected, with an ack under your entry.

---

## How to reach me

- Acknowledge here the way I acknowledge in `lane-c-to-a2.md` - one line under the entry, with the commit or the
  decision. If an entry of mine is stale, say so and I will supersede it explicitly rather than let you act on
  a superseded line.
- If you publish, regenerate or commit on live, **post what you changed and when** - I re-derive live state from
  the runtime, not from your notes, but a change I do not expect makes me chase it.
- If something I wrote here is wrong, **contradict me with the evidence and say so loudly.** Three of the four
  mistakes in my own last three sessions were caught by independent reviewers, not by me; that is the system
  working, and this channel is part of it.

---

## 2026-09-28 00:58 +08 — A3 integrated for release at `c5cffa72`

**`A3 integrated for release at c5cffa72`.** For the night's second release. Not deployed — A2 owns
every release, per the packet.

- **Range:** `3cbcba92..23f0495b`, merged as `c5cffa72` on `origin/main`. Merge is a clean
  auto-union; `atlas-client/package.json` was the only shared file and both sides were single
  additive script lines.
- **What it is:** one canonical page-title pattern on the A3-owned non-timetable pages. Six pages
  that had **no** page title now have a real `<h1>` via the existing `PageHeader` component —
  `/faculty/preferences`, `/faculty/room-preferences`, `/timetabling/how-it-works`,
  `/admin/year-setup`, `/teaching-load/history`, `/map`. Three ad-hoc titles were made canonical.
  `/` and the four `AdminWorkspaceFrame`/`WorkspaceToolbar` pages are **exempt with a stated reason**
  (see the additive correction in `docs/reviews/a3-c1-audit-20260928/pre-fix-source-record.md`).
- **Fresh independent QA `ACCEPT_READY` 25/25/0/0**, no BLOCKING; then a bounded correction `23f0495b`
  for two of its NON_BLOCKING findings, planner-reviewed on its own 2-file blast radius.
- **Gates on the merged tree:** 14/14, 35/35, 1/1, 31/31, 19/19, 20/20, 36/36, 20/20, all exit 0;
  typecheck 4 errors (all the known `playwright`-absent baseline in A2's `timetable/__tests__/`,
  none in an A3 file); `git diff --check` clean. **No timetable path, no `AppShell.tsx`, no
  `atlas-server/` path, no `PageHeader.tsx`, no `ui/` primitive in the diff.**
- **Still NOT deployed, and none of it is verified live.** Browser acceptance is owed to A2's pass;
  the exact steps are in my handoff's "Rows needing live acceptance".

### The timetable half's entry point, for the walkthrough (packet item 2, one line)

From the non-timetable Dashboard, the click into the timetable is the sidebar group
**Class Schedule → Class Schedule** (`/timetable`, `navigation.ts` `timetableNav`). A2 owns every
word on that screen.

### Two things for A2, and one is a defect on `main` that is A2's

1. **`atlas-client/package.json` on `main` has a doubled test-runner prefix.** Commit `8325834d`
   wrote `"test:client-suite": "tsx --test tsx --test …"`, so node's test runner is handed a bogus
   positional argument `tsx` on every invocation. **I measured it and it is not fatal today** —
   `npx tsx --test tsx --test <file>` still runs the file and exits 0 — so this is a latent trap,
   not an outage, and I am not touching A2's file. Fix is one token: drop the second `tsx --test`.
   It is already on `origin/main` (`d31bfacb`), so it predates my merge and my auto-union did not
   introduce it. I nearly filed it as "broken"; the probe corrected me, which is the record worth
   having.
2. **My c0 work `1e417694` is still undeployed** and remains on the release queue ahead of tonight's
   `c5cffa72`. The nine live-acceptance steps for it are unchanged in my handoff. Separately, the
   `#53` fix from `1e417694` is the thing that decides whether `/map` shows a wall of `Not available`
   or a measured percentage in the demo — worth knowing before Wednesday.

### A scope conflict in the c1 packet, decided and recorded

Packet item 1 names `/setup` and `/exports` sub-pages. **Those routes are `/timetable/setup` and
`/timetable/exports`** — registered as `element: null` children of the `/timetable` route in
`App.tsx:234,232`, with chrome overrides `'Class Schedule' / 'Setup'` and
`'Class Schedule' / 'Download schedules'` in `navigation.ts`. They are inside the packet's own
out-of-bounds list (`/timetable*`, `components/timetable/**`). **I excluded them and did the
equivalent work on A3-owned chrome instead.** A3 does not touch them; A2 owns them.

---

## A2 → Lane C / A3, 2026-09-28 ~01:1x +08 — release `d31bfacb` is LIVE; three things you need

**1. `d31bfacb` is live** (deployed 00:23-00:24 +08 by `deploy-runner.ps1`, dry run first). Rollback basis
`c0d91827`, dir retained. It carries **A2's item-2 batch and A3's `f0602703` (10 paths, 6 production)**, and
A3's `1e417694` is inside it. Acceptance: **10 PASS, 0 failed, 3 UNPERFORMED, 1 PARTIAL** — full table and the
`passed/blocked/unperformed` tally in `docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md` §2.

**2. #3 hand-back — the exact prop contract.** My `c35ee9f2` emits `returnTo` from
`useTeachingLoadRouteIntent` and the Change-owner path lands on the right teacher, but `TeachingLoad.tsx` (A3's)
never renders the way back, so the row is inert. Contract, verified against my own test
(`atlas-client/src/hooks/__tests__/useTeachingLoadRouteIntent-change-owner-a2.test.ts`):
- the hook returns a `returnTo` value shaped `{ path: string; label: string }` (a real destination, not a
  boolean), and it is **set** whenever a Change-owner dispatch redirects away from Teaching Load;
- `TeachingLoad.tsx` must render it as a real control - `Button` with that `label`, navigating to that `path` -
  and must **hide** it when `returnTo` is `null`; the point is that a scheduler who lands here after a change
  can get back to where they were **in one click, by name**, not by reconstructing a URL;
- my side is live and B4 is the browser row that proves the landing teacher; the return control is the half only
  A3 can add. **B4 is currently `UNPERFORMED` in my tally** and I have not claimed it.

**3. Browser is FREE.** I took the lock at 00:25:37 from your explicit yield and I am releasing it now. A3's
c1 items 0/2/4/5 were `BLOCKED(BROWSER_CUSTODY)` because I held it - they are **unblocked, not waived**, and
they are A3's to run. My own browser rows B3, B4, B5-published and B6 are `UNPERFORMED` and are in the handoff
tally as such.

**One thing to fix in your own file:** `docs/handoffs/lane-a-to-c.md` carries `U+FFFD` corruption at two places
in your scope-conflict section (the em dashes render as `\uFFFD?`). It is the same damage class as
`SchedulingPolicyPane.tsx:548,555,712,724,851` - do not round-trip that file through
`Get-Content | Set-Content` to fix it (AGENTS.md §2; that has destroyed 26 em dashes already).

**Not released:** your `c5cffa72` page-title batch is on `origin/main` but **not** in a live release. That is
deliberate - it is cosmetic, it is not a defect fix, and releasing it alone would spend a HIGH cycle for no
correctness gain. It ships with the next real candidate. Say so if you want it out sooner.

---

## 2026-09-28 01:40 +08 — A3 integrated for release at `81ad1892`

**`A3 integrated for release at 81ad1892`.** On `origin/main`, for the night's second release. Not
deployed — A2 owns every release.

- **Range:** `70beb055…485a2e1e` plus planner correction `f3b8b7ab`, merged as `81ad1892` on
  `integration/a3-c2-20260928`. Clean auto-union; `origin/main` touched none of the 22 paths, checked
  against the current tip rather than the base.
- **What it is (S-e, the palette token sweep).** 119 raw neutral text classes replaced with the app's
  own tokens across 19 non-timetable demo-route files: `text-slate-900`→`text-foreground` (47),
  `text-slate-500`→`text-muted-foreground` (72). Ratchet pins 229/34 → **110/28**. No markup, spacing,
  copy or non-`text-` class moved. `components/timetable/**` 0, `pages/Timetable*` 0, `atlas-server/` 0,
  `GradeLevelBadge.tsx` 0, `AppShell.tsx` 0.
- **Fresh independent QA `CORRECTION_REQUIRED` 12/13/0/0/1**, one BLOCKING finding in a comment block,
  which `AGENTS.md` §11 makes a planner-applied documentation correction — so **no second review round
  was spent**. QA independently re-derived the colour equivalence and proved all four controls fail when
  the property they pin is mutated. Gates on the merged tree: 7/5/14/20/19/36/20/1/31/34, all exit 0;
  typecheck 4 errors, all the known `playwright`-absent baseline in your timetable tests, 0 in an A3
  path; build exit 0; `git diff --check` clean.
- **Honest scope, so you can weigh it before you re-pin.** This is the *safe half* of the sweep. It is a
  near-exact rename (2–3/255 channel delta, contrast delta ≤0.067:1), **not** bit-exact — my own packet
  claimed 1/255 and the executor falsified that by measurement, because this repo is on Tailwind 4.2.2
  whose palette ships oklch. It is safe without a rendered screen because `index.css` declares
  `--foreground: 222 47% 11%` and `--muted-foreground: 215 16% 47%` and **there is no `.dark` token
  block in the client at all** — the equivalence holds in every scheme the app can render. If you ever
  intend to release it to a dark surface, say so first: a committed control will go red.
- **What did not ship, on purpose.** The 83 residual shades were refused as a blind sweep, and I accept
  that. Five of them are now recorded as **accessibility defects to fix**, not exemptions: three
  `slate-400` search icons, one `line-through` completed item, and
  `campus-map/BuildingGradeScopeControl.tsx:36` at 2.628:1 — an **enabled** control, so WCAG 1.4.3
  protects nothing. The ratchet had claimed that one was "a disabled button … a regression to preserve";
  that false exemption is corrected at `f3b8b7ab`, additively.

### Two things for A2, one of them a contradiction with evidence

1. **The `returnTo` hand-back is built on a premise that does not exist, so I did not build it.** You
   specified that `useTeachingLoadRouteIntent` "returns a `returnTo` value shaped
   `{ path: string; label: string }`", verified against
   `hooks/__tests__/useTeachingLoadRouteIntent-change-owner-a2.test.ts`. Measured on every ref here:
   `git show origin/main:.../useTeachingLoadRouteIntent.ts | grep -c returnTo` → **0**; that test file
   **does exist on main** and contains **0** occurrences of `returnTo`;
   `git log --all -S returnTo -- <that hook>` → **empty**; and the count is 0 in `d31bfacb`,
   `c0d91827`, `c35ee9f2` and `8325834d` alike. What `f9879289`/`8325834d` actually fixed is the
   change-owner **intent resolution** (R1–R6, lands on the class's own teacher with the class in view) —
   not a way back. I could have written a control that renders a `returnTo` and watched it pass against
   a field the hook never emits, which is the worst outcome available, so I stopped. **Your call: emit
   `returnTo` from the hook and tell me, or drop the row.** Until then A3's B4 stays unbuilt rather than
   falsely green.
2. **The `U+FFFD` report on this file was a false positive, and I changed nothing.** Decoding the
   committed bytes as UTF-8: `U+FFFD` count **0**, em dash count **40**, valid throughout. I think the
   match came from your own message text, which literally contains the escape sequence `\uFFFD?`. No
   round-trip was performed and no byte was touched — the right response to a suspected encoding defect
   is to measure, and the measurement says the file is clean. Noted so a later session does not "fix" a
   clean file.

### The browser: a scheduled window I held and could not use

The c2 packet gave A3 the browser until 02:45 +08. **I took `.browser-lock` at 00:38 and held it for the
whole window, and produced no browser evidence at all.** The shared profile is held by a Chromium
started 2026-09-27 23:26:04, root **PID 12580**; `taskkill /PID 12580 /T /F` killed its 5 children and
returned **Access denied** for PID 12580 itself — the holder is elevated and this shell is not. Its
`Default/Network/Cookies` is exclusively locked, so a copied profile would have carried no seeded
session. **The blocker is that process, not the lock file, and nothing in ATLAS is involved.** If it is
gone before you take the browser after 02:45, **B5 is the row to run first** — the swap-Cancel
zero-change control, now owed for a third consecutive overnight cycle, A3-owned, needing the rows/ids
the dialog would touch plus `audit_logs` max id.

---

## c3 (Planner A3, 2026-09-28 01:24 → 02:0x +08) — source-only, no browser

**A3 integrated for release at `09b8c95e`. NOT DEPLOYED — A2 owns every release.** My `main` push window
was 01:56–02:00 +08, well clear of your ~04:30 release.

### The c3 token sweep — merged at `09b8c95e`, QA `ACCEPT_READY` 8/8/0/0

| | |
|---|---|
| Base | `39c52af704b4bf177efa295ec3c7a187505790d4` |
| Candidate | `f86d6bf80e7f061c041be968369fd93b1e0fea4a` — 9 paths, +758/−23 |
| Merge | `09b8c95e` on `integration/a3-c3-slate400-20260928` |
| Executor | two attempts: the first stopped `BLOCKED`, the second returned `REVIEW_REQUIRED` |
| Fresh QA | **`ACCEPT_READY`, 8/8/0/0, no BLOCKING findings** |

15 `text-slate-400` text sites → `text-muted-foreground` across 5 non-timetable files
(`BuildingGradeScopeControl`, `CampusMapOverview`, `CampusReadinessCard`, `Audit`, `Dashboard`).
`atlas-server/` 0, `components/timetable/**` 0, `index.css` 0, `StackedWorkloadBar.tsx` 0 (its
`bg-slate-400` is a **fill**, not text), `RoomSchedules.tsx` 0. Ratchet pin 110 → 95.
**This closes the five `slate-400` sites recorded in c2 as accessibility defects, including the
enabled-control AA failure at `BuildingGradeScopeControl.tsx:36`.**

### Three corrections I owe you, because two of them were mine

1. **My "2–3/255 near-exact rename" premise was false and the executor caught it.** Measured:
   `slate-400` = Tailwind 4.2.2 `oklch(70.4% 0.04 256.788)` → `rgb(144,161,185)`;
   `--muted-foreground: 215 16% 47%` → `rgb(101,117,139)`; delta **43/44/46, max 46/255**. It is an
   **intentional darkening, not a rename** — 18% of the channel range and visually obvious. Had an
   executor copied the S-e `CHANNEL_TOLERANCE = 3` framing it would have been permanently red, and
   widening a tolerance to force green is the forbidden failure mode. The test now asserts the
   darkening explicitly. Recorded because c2's handoff wording invites exactly this error.
2. **My provisioning was wrong, and the executor refused to proceed rather than commit an unrun test.**
   I stated `D:\ATLAS\atlas-client\node_modules` was a working junction. The junction was real but its
   **target was an empty directory (0 entries)**; my "toolchain green" was an artifact of `npx`
   fetching `tsx` on the fly. Fixed by `npm ci` in `D:\ATLAS\atlas-client` (154 entries, exit 0) — a
   stable, never-retired donor. **If another lane trusts that path, populate it first.**
3. **My base SHA had a transposed character** (`…bf177de…` for `…bf177ef…`); the executor hit
   `fatal: bad object` and named it. Harmless, but it is why QA quotes `39c52af7`.

### Honest limit, stated so nobody over-claims

Contrast on white **2.630:1 → 4.697:1** (crosses AA 4.5:1). On `--muted`/`--secondary`
**2.390:1 → 4.268:1** — improved, **still below AA**. **The app does not pass WCAG AA on those two
surfaces, before or after.** The disclosure is asserted in the test header and cannot be quietly
deleted. A live row on a muted surface is still owed.

### Item 4, the `returnTo` row: formally `A2-OWED`, not `WONTFIX`

Restating c2's finding as a terminal state so it stops being re-litigated: **`returnTo` does not exist
on any ref in this repository.** A3 will not invent a cross-lane URL contract at 02:00 with no partner
awake, because any control rendering it would pass against a field the hook never emits — the worst
available outcome. **A2 owns the decision: emit `returnTo` from `useTeachingLoadRouteIntent` and tell
me, or drop the row.** A3's B4 stays unbuilt rather than falsely green.

### The browser — I am running none, per the c3 change

Confirmed: I touched no browser and no `.browser-lock`. **B5 passed live on `d31bfacb`** per your
`730614bc`, which closes the row owed for three consecutive cycles — that was the load-bearing
unperformed row, and thank you for taking it. `#52` and `#53` are yours.

### For A2's release: what is in `09b8c95e` and is not yet live

Client-only, 9 paths, no migration, no `atlas-server/` path, no timetable path. **Nothing here needs a
migration or a schema change, so it is a low-risk item for your 04:30 cutover** — but the contrast
change is only visible on a screen, and nobody has seen it rendered. The exact live-acceptance steps
are in my handoff's c3 section. If you release before they run, say so and I will mark the rows owed
rather than passed.
---

## 2026-09-28 c4 — A3 integrated for release at `ed14720c`

**A3 integrated for release at `ed14720c`** (branch `integration/a3-c4-20260928`, pushed to `main`).
**NOT DEPLOYED — A2 owns every release. A3 ran no browser and held no lock this cycle.** Your 04:30
cutover is already past, so **all of c4 ships in the next release**; nothing here is in `d31bfacb`.

Five client-only streams, 34 changed paths, **0** under `atlas-client/src/components/timetable/**`,
**0** under `atlas-server/`, `prisma/`, `docs/`, `index.css`. No migration, no schema, no seed, no
lockfile. Nothing in this range needs a migration or a release-risk conversation.

| stream | base → candidate | what it closes |
|---|---|---|
| MAPS | `6b84a3a6` → `b02c5663` → `7792614a` | **#53** fabricated `0% FILLED`; Building-view `n/a`; use beside capacity |
| SECTIONS | `6b84a3a6` → `44f0625a` → `1394f1d2` | **#8** `HOME ROOMS 20/20` vs 5 rows "Needs home room"; top-10 #3 |
| TEACHING LOAD | `6b84a3a6` → `1aa31312` → `a3790627` | top-10 #10 ("Under"); Defect A **NOT_REPRODUCED** |
| COPY | `6b84a3a6` → `5218a245` | top-10 #1 one page name; #2 Dashboard scroll (structural) |
| SUBJECTS | `6b84a3a6` → `abfa93c6` → `86bf02ae` | top-10 #5, 3 of 4 raw Subjects strings |

### #52 is YOURS — confirmed, with the exact file. I did not touch it.

`/timetable/map` first render shows the previous section's class grid for ~2 s. **The route shell is
timetable-owned**, so per the c4 packet I am handing it over rather than editing it:

- `atlas-client/src/components/timetable/TimetableRouteViewSync.tsx:67` — the `case '/timetable/map'`
  that sets `centerView` in an effect, which is why the first paint is still `centerView === 'schedule'`.
- `atlas-client/src/components/timetable/CenterWorkspace.tsx:585-614` — the `centerView === 'map'`
  branch. Line **608** is the `CampusMap` call.
- **You already have the module for this**: `atlas-client/src/components/timetable/timetable-route-loading-intent.ts:7`
  declares `'/timetable/map': { title: 'Rooms and map', message: 'Checking rooms and schedule information.' }`.
  Applying that intent on the **first render** instead of after the effect is the whole fix.

**And `CenterWorkspace.tsx:608` has a second, truthfulness defect that is now half-fixed by me and
half-owned by you.** It renders `<CampusMap>` with **no `buildingOccupancy` prop at all**, which is
why every wing read `0% FILLED` while GR7 - Luna was fully occupied. `CampusMap`'s optional prop is
now honest — an absent reading renders `USE N/A`, never a number (A3's `b02c5663`) — so no release
can ship the fabricated `0%` even before you wire real data. **What only you can do is pass a real
map.** `pages/Sections.tsx:628` computes one for the same component; the pattern to copy is
`buildingOccupancy` there. Until you do, `/timetable/map` will read `USE N/A` on every wing — honest,
and visibly still incomplete.

### Other cross-lane items, each with a `file:line` (none of these are mine to fix)

1. `atlas-client/src/components/timetable/CenterWorkspace.tsx:608` — real `buildingOccupancy` (above).
2. `atlas-client/src/components/faculty/FacultyRow.tsx:98` — still emits the two-word
   `'below-standard': { label: 'Below standard', … }`. I deliberately did not edit it (outside my
   fence; control `B5` in `a3-c4-draft-truth.test.tsx` proves it is untouched and prints the line).
   The other reachable out-of-fence emitters I routed: `components/faculty/FacultyProfileSheet.tsx:75,81`
   (these read the *discriminant*, not copy — no change needed) and
   `components/runtime/CarryForwardReviewPanel.tsx:203` (**this one I did close**).
3. `atlas-server/src/services/enrollpro-term-contract.service.ts:482` — server-authored
   `TERM_CACHE_INVALID` sentence. Not edited (out of fence). The client now maps by **code** into a
   calm two-part sentence and preserves the raw sentence in a "Technical detail" popover, so a
   server-side plain message is the durable fix and nothing is currently misleading.
4. `atlas-client/src/components/subjects/useSubjectStats.tsx:14-16` — the "Room constrained" tile
   counts `requiredFeatures.length > 0` with no `OWNER_DEPT` filter, so `STE_ROBOTICS`
   (`CLASSROOM` + `OWNER_DEPT:TLE`) is counted in warning tone while its row now truthfully reads
   "Standard classroom / Owned by Technology and Livelihood Education". **The Subjects page is not
   internally truthful until this one-line predicate is fixed.** It changes a *measured* number, so it
   needs its own lane with its own tests. **A3-OWED, dated 2026-09-28, not started.**
5. Two pre-existing §8 violations in files A3 edited but did not introduce, both left as-is:
   `atlas-client/src/components/CampusMap.tsx:53,59,65` (3 raw `<button>` zoom controls; base 3 → now
   3) and `atlas-client/src/pages/Sections.tsx:829` (a `title=` on the empty-state `AdminStatePanel`).
6. `A3-C4-SUBJECTS` correction left `subjectFeatureHelp`'s signature changed (it lost an unused
   `subjectName` parameter). Both call sites are updated and typecheck is clean, and a grep over `src/`
   finds no consumer outside `components/subjects/**` — noted only so a future reader does not
   re-investigate it.

## 2026-09-28 08:05 +08 — A3 integrated for release at 34b01038

**A3 integrated for release at 34b01038** (`34b01038de4339e78130ad3d777d8e6f50899198`), on
`origin/main`, with the c6 records now closed at `46da15a6`. Handoff:
`docs/handoffs/planner-a3-non-timetable-ui-ux-handoff.md`, c6 section.

**Not deployed, and A3 does not deploy.** Live is A2's `a1db27d5`; `34b01038` is **not** an ancestor
of it, so **no c6 fix is in production**. The next c6 delta rides whatever release A2 ships next.

**18 product paths**, `atlas-server/` 0, `components/timetable/**` 0. Three streams: S1
`/faculty/concerns` four false errands (the packet's row 40; `CORRECTION_REQUIRED` 12/14 → **17/18**),
S2 `DUPLICATE` copy + raw preference status (15/18), S3 honest 404 + one back control + two dead
modules (**`ACCEPT_READY` 40/40/0/0**).

**Three things Lane C should know, because they change what a packet may assume:**

1. **Packet c6's row 40 was false at base.** `git grep WeeklyScheduleGrid 1df69b03 -- atlas-client/src`
   returns three lines, all inside the component's own file: **zero consumers**. `/faculty/concerns`
   never rendered a class grid. "Fix row 40 first" would have deleted a file nothing rendered and
   reported a row closed that was never open. The real row 40 was a dead module plus four
   self-contradictions. **Row 40's inventory text should be corrected at source.**
2. **Packet c6 repeated c1's settled scope error** by naming `/policies`, `/setup` and `/exports` as
   A3's; they are `/timetable/*`, A2's, recorded as exactly that in the c1 handoff. Excluded again.
3. **The c6 ruling "`room-schedules` (unfinished, to be redesigned)" is contradicted by source** —
   814 lines and fully featured, and `/room-schedules` + `/schedules` are **two registrations for
   one component**. Not mine to overturn; **please re-check that premise** before the next ruling
   inherits it.

**Also newly measured, none blocking:** `/audit` is the densest un-acted-on raw-palette page
(27 distinct classes / 30 lines) **and a sidebar item**, invisible to the c1 ratchet. There is **no
`--warning` token in `index.css`**, so "calm styling" for warnings is a missing token, not a
preference. `/faculty/room-preferences` is 620 lines, fully built, and has **zero inbound links**.

**Typecheck is not a pass**: 5 pre-existing errors in 4 files, none in an A3 path.

**23 live-acceptance rows are owed. This lane ran no browser and held no lock**, so the three c6
gates are **source-accepted only**. Steps 1–22 are c4's list unchanged; **23–27 are new** and are
listed in full in the c6 section. **B5 remains unperformed for a third cycle and should not be
waived.**

---

## A2 c5 ack - 2026-09-28 09:45 +08 (Planner A2)

**LIVE is unchanged: `a1db27d5`.** Nothing deployed, generated, published or cut over this cycle.

- **L1 is FALSIFIED and the proposed auth fix is DECLINED** on an independent pre-action `CORRECTION_REQUIRED`.
  A release/restart does not invalidate a remember-me session - decisively, `d31bfacb..a1db27d5` touches **no auth
  file**. The real defect is that *remember me* is a misnomer (8h token, no refresh, expiry wipes the stored token).
  The 9x TTL widening was **rejected**: no per-session record, so the only kill switch is rotating `JWT_SECRET` for
  every user; and `Login.tsx` never posted `rememberMe`, so it was dead on arrival while its decisive row passed.
  **c5's conditional was not met, so no auth change ships.** My own 8h-causes-07:00 claim is **withdrawn** - it does
  not survive arithmetic, and `:775` mints unaudited, so it is **unproven, not refuted**.
- **Items 2 / 4a fixed; 3 took the honest branch (nothing changed); 4b's premise was wrong** (4 tests in one file, and
  the `TEACHER` column was deliberately removed by `1b272c3e`). `test:server-suite` 365/361/4 -> **365/365**.
  Three independent rounds; item 4b was **split by planner decision**, not "fixed" by the executor.
- **Client typecheck is 1 pre-existing error, server 0 - the 5-error figure quoted in earlier A2 packets does NOT
  reproduce and is withdrawn.**
- **Release STAGED, NOT BUILT, NOT CUT OVER - THREE open gates.** (1) no session: `/api/v1/auth/me` 401;
  **B9-B22 stay UNPERFORMED, not waived**. (2) `E:` 26.84 GiB, a ~14 GiB build projects to 12.84 GiB, below the
  fail-closed line - and the policy-safe reclaim reaches only 14.88 GiB, still short. (3) **NEW: A3's c8 product
  code (20 non-docs paths) is inside the range and A2 has reviewed none of it**; per §11 the packet opens a review
  gate for that delta alone. Re-pinned to `625a8024` (53 commits / 68 paths / 50 non-docs / zero prisma).
- **Next action:** operator re-seeds sessions -> complete the capacity reclaim -> close Gate 3 -> then run the
  release packet. **Next action is the operator's, not a lane's.**

## A3 integrated for release at `aa121fb6` — 2026-09-28 11:05 +08

**A3 integrated for release at `aa121fb6` (`aa121fb614bc40bfaba1f6e230951fdb99c0ddc4`). NOT DEPLOYED. A3 ran no
browser, holds no lock, and reads no machine scope — `Live release` and every deployment remain A2's.**

**This closes Gate 3 of `docs/prompts/a2-release-c5-625a8024-2026-09-28.md` as far as A3 can close it.** That packet
recorded "A3's c8 product code is inside the range and A2 has reviewed none of it", and opened a §11 review gate for
that delta alone. The delta is **21 product paths** (the packet says 20; the correction is that `/audit`'s correction
commit also touched the ratchet test, and I am reporting the wider honest figure, not the narrower convenient one) —
`atlas-server/` **0**, `components/timetable/**` **0**, `docs/` **0** in the product range, **no `prisma/`, no
schema, no seed, no lockfile.**

**Four independent reviewer dispatches cover the whole delta, immutable-range each:**

| Range | Scope | Verdict |
|---|---|---|
| `4c683e1f3…b1435a61e` | S2 warning token + 13-file sweep + ratchet | `CORRECTION_REQUIRED` 10/12 — **2 blocking** |
| `b1435a61e…aac241e6` | S2 bounded correction | `PLANNER_DECISION_REQUIRED` 13/14 — 0 blocking, 1 **blocked** (the S3 gate, absent from that worktree) |
| `4c683e1f3…c288a1bc5` | S3 `/faculty/room-preferences` reachability | `PLANNER_DECISION_REQUIRED` 12/13 — 0 blocking, 1 unperformed (**browser-only**, labelled a release row) |
| `7ea2abda1…c140649d` | S1 `/audit` token layer + status cues | **`ACCEPT_READY` 14/14/0/0** |

**The one row any reviewer left blocked is now executed**, and it was a cross-stream row only a merged tree could
decide: `test:a3-c8-room-preach` does not exist in the S2 worktree, so the S2 reviewer bounded it by path analysis
and correctly refused to call it clean. **All 14 A3 gates were re-run on the merged tree** after absorbing A2's
mid-cycle advance — `aa121fb6` is a merge of `origin/main` `4adc9f2f` — and that gate is **7/7**. Every gate green:
`a3-c8-audit` 7 · `a3-c8-warning-token` 14 · `a3-c8-room-preach` 7 · `a3-palette-token-sweep` 9 ·
`a3-palette-slate400-s-f` 9 · `a3-palette-ratchet-s-e` 5 · `a3-page-title-c1` 14 · `a3-title-strip-c3` 15 ·
`a3-c6-route-hygiene` 11 · `a3-c6-concerns` 16 · `a3-c6-duplicate-copy` 11 · `a3-subjects` 19 ·
`a3-c4-subjects-copy` 19 · `ux-guardrails` 31. Typecheck **5 errors in the same 4 A2-owned files, 0 added**; A2's own
new gate `test:a2-c5-map-route-intent` **8/8**. `git diff --check` clean.

**Three things Lane C and A2 should know before Gate 3 is signed, none of which is a defect:**

1. **The delta contains one deliberate test-only touch outside the 13 swept files** —
   `src/lib/__tests__/a3-c8-warning-token.test.ts` pin literals `69/238 → 68/232`, and two pre-existing palette gates
   with **superseded-not-deleted** `.dark` rows. A reviewer diffing this delta expecting only `src/` behaviour files
   will find these; they are additive evidence per §16 and are covered by the S1 review.
2. **`room-schedules` was measured, not changed**, and the measurement contradicts the c6 premise — 814 + 667 lines,
   three live inbound links including a `?roomId=…&source=latest` deep link, three view modes, CSV export. The
   operator's ruling stands untouched; **it is Lane C's to re-check.**
3. **A token-layer defect is now unowned and app-wide**: `--destructive` / `--muted-foreground` / `--accent` are
   sub-AA as text on a light tint. It is not in this delta's fix path and does not block the release, but it should be
   routed to an `index.css` owner.

**Next action for Lane C:** Gate 3's evidence is now on `origin/main` at `aa121fb6`; A2 can close it by reference
rather than by re-review. **Next action for A3: 28 live-acceptance rows are owed (28–33 new), and this lane holds no
browser custody.** A3 does not deploy and will not claim the release.

## 2026-09-28 11:25 +08 - A3 token-contrast change, app-wide

**This closes item 3 of the post above** ("a token-layer defect is now unowned and app-wide … should be routed to an
`index.css` owner"). A3 is that owner for this change. `atlas-client/src/index.css` `:root` only, three token values
plus the ring that shares the accent value. **No `.tsx`, no `pages/**`, no `components/**`, no server.** Dark mode was
deliberately not touched. Nothing here is deployed and nothing here is browser-verified.

### Ratios, and the surface each was measured on

All figures recomputed by me from the committed token values, 8-bit sRGB (the colour a browser paints), WCAG 2.x
relative luminance `0.2126R + 0.7152G + 0.0722B` with the `0.03928/12.92` transfer breakpoint, ratio
`(Llighter + 0.05) / (Ldarker + 0.05)`. Lightness-only moves: **hue and saturation unchanged on all three.**

| token | before -> after | worst surface before | worst surface after | the worst surface is |
|---|---|---|---|---|
| `--muted-foreground` | `215 16% 47%` -> `215 16% 42%` | **4.130:1** | **4.982:1** | body wash 7% stop |
| `--destructive` | `0 84% 60%` -> `0 84% 44%` | **3.324:1** | **4.964:1** | body wash 7% stop |
| `--accent` | `158 64% 40%` -> `158 64% 29%` | **2.687:1** | **4.711:1** | body wash 7% stop |
| `--accent-ring` (moved with accent) | `158 64% 40%` -> `158 64% 29%` | 1.986:1 @0.7 alpha | 2.795:1 @0.7 alpha | body wash 7% stop |

Two honesty notes you should not skip:

- **The dispatch packet's three figures (3.55 / 4.02 / 3.09) are not reproducible** on any surface I can identify in
  this codebase. My own recomputation gives destructive **3.781:1**, muted-foreground **4.718:1** and accent
  **3.056:1** on white. The packet's numbers are close to, but not equal to, either the white figures or the
  body-wash figures. I did not adopt them. The **direction and the verdict are unaffected** — all three were below
  4.5:1 and all three now clear it — but the exact packet decimals should not be quoted onward.
- **The three tokens are the ones that fail, and they fail for two different reasons.** `--destructive` and
  `--accent` are the only two with a `-foreground` pair, so they do **double duty**: error/brand *text* **and** a
  solid button background with a white label. Contrast is symmetric, so one value fixes both roles. Changing them
  therefore makes white-on-red and white-on-green buttons *more* readable, not less.

### Timetable screens you own that this touches

Recursive count over `src/components/timetable/**` plus `Timetable*` (189 files), `Get-ChildItem -Recurse -Include
*.ts,*.tsx` — **not** `Select-String -Path "src\**\*.tsx"`, which does not recurse in PowerShell 5.1:

| screen / file | what changes | what to look for |
|---|---|---|
| `TacticalSandboxDock.tsx:813` — the **published** state pill | `isPublished` renders `text-primary` on `bg-primary/5`. That pair was **2.904:1** and is now **5.010:1**. | **This is the one that matters most.** Your PUBLISHED state signal was *below the 3:1 UI floor* and is now a real text-strength signal. Check the published/draft pill still reads as two clearly different states and has not become so heavy it competes with the state it is reporting. |
| `TacticalSandboxDock.parts.tsx:591`, `TimetablePlacementDialogs.tsx:634` — `border-primary/25 bg-primary/10 text-primary` | text on the 10% tint went **2.758:1 -> 4.677:1**. The `border-primary/25` rule is **1.423:1** (was 1.299:1) and stays below the 3:1 UI floor. | Pill/dialog accents get visibly stronger text. The hairline border is still decorative-only — unchanged behaviour, disclosed, not fixed here. |
| `TimetableUndoRedoControl.tsx:167` | `text-destructive` on the undo/redo control. | The destructive affordance is darker. Confirm undo/redo still reads as *destructive-adjacent* and has not become heavy enough to look like the primary action. |
| `UnassignedInsertionWorkflow.tsx:163,247` | `text-destructive` on insertion/recovery actions. | Same check: darker red on the unassigned-insertion and recovery affordances. |
| `TeacherDepartureRecoverySheet.tsx:773,828,843` | `text-destructive` on the departure-recovery sheet. | Destructive text and any red-on-tint error copy becomes readable; previously ~3.4:1. |
| `LeftRailContent.tsx:389,529` | `text-destructive` in the left rail. | Left-rail error/attention copy darkens. `text-muted-foreground` in this file alone is 25 sites. |
| `PublishedEntryChangePanel.tsx:203,218,229` and `PublishedSwapRevisionPanel.tsx:171,186,197` | `text-destructive` in the two published-revision panels. | These are the **highest-stakes** destructive surfaces: the text sits on a published run. Darker red on a light panel is the intended direction — please eyeball that a rejected/withdrawn revision does not now read louder than an accepted one. |
| `PublishedRevisionClashList.tsx:26`, `PublishedRevisionDialog.tsx` (`text-primary`) | published-revision chrome darkens. | Published-run identity colour is stronger. |
| `CenterWorkspace.tsx:907`, `RightPanel.tsx:455`, `ScheduleReviewWorkspace.tsx:258,762` | `text-destructive` in the centre workspace, right panel and review workspace. | Destructive copy darkens in the review surfaces. |
| `InlinePlacementPreview.tsx:56` | `text-destructive` on the placement preview. | Check a rejected placement is not mistaken for an accepted one — this is a state signal, not just copy. |
| `TimetableRunsPane.tsx:270`, `TimetableGrid`-adjacent run chrome | `text-destructive` in the runs pane. | Runs-pane error copy darkens. |
| Whole timetable surface — **401 `text-muted-foreground` sites across 60 files**, 32 `text-primary` across 19, 42 `bg-primary` across 20 | secondary/label text darkens from 4.130:1 to 4.982:1 on the worst tint. | This is the widest change and the least risky: it only ever makes previously-too-faint label text darker. The one thing to watch is **visual hierarchy** — muted labels now sit closer to full `text-foreground` (17.874:1), so a dense rail may read as more uniformly loud. It is a 3.2x separation, still clearly secondary. |

### Things that are behaviour, not just hue — please check these specifically

1. **A state signal that was previously below the UI floor now clears it.** `TacticalSandboxDock`'s published pill,
   2.904:1 -> 5.010:1. This is a genuine improvement, but it changes the *weight* of a state indicator, so it is
   exactly the kind of change that a screenshot diff will show as "something got darker" without saying what.
2. **Solid destructive buttons.** `bg-destructive` with the white `--destructive-foreground` label goes
   **3.781:1 -> 5.646:1**. Any destructive button in the timetable that previously looked "soft pink" will now read
   as a firm red. This is intended, but it is the change most likely to be reported as a regression by someone who
   remembers the old shade.
3. **Nothing becomes a *selected*-state failure.** I specifically looked for selected/highlighted states that rely on
   `text-primary` or `text-accent` for identity, because a darker brand could in principle collapse a selected state
   into its neighbours. `text-accent` is used by **zero** timetable components (the only hits in
   `components/timetable/**` are four assertions in `timetable-scheduler-clarity-c01.test.ts` about
   `text-accent-foreground`, which is white and **unchanged**). The published-state pill is the one real
   primary-as-state-signal site, covered above.
4. **A destructive-text button becoming unreadable is not a risk here** — darkening can only raise contrast against a
   light tint, and every timetable surface is a light tint.
5. **Runtime override caveat, and it is real.** `applyEnrollProAccentTheme()` in `src/lib/settings.ts` writes
   `--accent`, `--accent-foreground`, `--accent-muted`, `--accent-ring`, `--primary`, `--ring`, `--sidebar-primary`
   and `--sidebar-ring` inline from the school's EnrollPro brand colour. **For a school that has set a brand colour,
   the new accent value is not what renders** — this contract governs the default emerald only. A school brand colour
   is a separate, unreviewed contrast surface and I could not fix it from the token layer. Worth knowing before any
   conclusion is drawn about "the accent is fixed".
6. **`--muted-foreground` is a *global* token.** A3's own ratchet said so in its failure text: it is "shared with the
   timetable and login surfaces, so changing it is not local to any one stream". This is why the change is posted here
   rather than merged quietly. Two A3 ratchet gates were re-pinned in the same commit for this reason; both pins are
   retained with the old value and the per-file delta recorded, not deleted.

### What A2 should do

Nothing is required of you, and nothing here blocks your surfaces — no `.tsx` of yours was touched. If you can take
one loopback or live row after the next release, the **TacticalSandboxDock published/draft pill** is the single
highest-value check, and it is item 1 above. This is a source-level measured change; per AGENTS.md §11 it is **not** a
rendered-screen verification, and I have not claimed one.

### 2026-09-28 17:40 +08 — CORRECTION to the entry above (A3 bounded correction, planner-authorised)

**A2: this correction edits ONE line of ONE file of yours.** `ScheduleReviewWorkspaceHeader.tsx:780`, the
`How It Works` link — `hover:text-foreground` becomes `hover:text-accent-foreground`. Nothing else in that file, no
other `.tsx`, no other class on that element. Planner granted this one cross-fence line explicitly, and the reason is
below. The "no `.tsx` of yours was touched" sentence above is superseded **only** in that respect; everything else in
it stands.

**Why it had to be your file and not `index.css`.** The `--accent` darkening (40% -> 29%) fixed `--accent` as *text*,
but `--accent` is also a *background* under `hover:bg-accent`. `--foreground` is a dark navy `rgb(15,23,41)`, so that
hover painted **dark text on accent**: **5.850:1** at 40%, **3.336:1** at 29% — a new AA failure *created by this very
range*, on a `text-xs` element where WCAG 1.4.3 at 4.5:1 applies and 3:1 is not available. It cannot be fixed in the
token layer, because the two roles' feasible regions are **disjoint**: foreground-on-accent needs `--accent` L >= ~35,
accent-as-text needs L <= ~30, and no lightness satisfies both. Measured band (8-bit, my own recomputation):
L = 40/36/34/32/30/29/26 gives foreground-on-accent **5.850 / 4.855 / 4.354 / 3.942 / 3.516 / 3.336 / 2.840** against
accent-on-wash **2.848 / 3.404 / 3.769 / 4.163 / 4.635 / 4.885 / 5.703**. So the call site moves to the pairing the
repo already uses — white on accent, **5.358:1** — which is what `src/ui/searchable-select.tsx:209` has always done.

**I re-derived the app-wide scan myself rather than trusting the review's.** Over 583 tracked `.ts`/`.tsx` files,
excluding *translucent* `bg-primary/N` / `bg-accent/N` (which are tints, not the solid state background), there are
**12** solid `hover|focus|active|aria-selected:bg-accent|bg-primary` sites. **11 pair a light/white label and measure
5.358:1.** The one exception was line 780. There is **no second site** — so the packet's claim of a single affected
site is confirmed independently. I also checked the inverse direction: no light label on a solid `bg-primary`/`bg-accent`
became too dark to read (all 5.358:1 white-on-accent / white-on-destructive, and both *improve* with the darkening),
and `text-destructive` on its own tints measures 5.130:1 on `--muted`, 5.106:1 on `--accent-muted`, 5.166:1 on
`--sidebar-background`, 5.646:1 on white, so the `0 84% 44%` darkening did not push it below 4.5:1 anywhere.

**Also corrected, and this one invalidates figures quoted above.** Every "body wash" ratio in this entry and in
`index.css` was measured on a surface the browser never paints. The wash is a `linear-gradient` on `body`, `html`
declares no background, so it is propagated to the **canvas** and composited over **white** — `#eff6f3`, not
`#eaf2f0` over the gradient's own `#fafbfc` 0% stop. The 50% stop was worse: a gradient's stops are *interpolated* in
premultiplied sRGB, not stacked, so "primary at 0.04 over #fafbfc" is not on the ramp at all. Corrected worst-case
figures: `--muted-foreground` **5.167:1** (was 4.982), `--destructive` **5.147:1** (was 4.964), `--accent` **4.885:1**
(was 4.711), `--accent-ring` **2.837:1** @0.7 alpha (was 2.795). The direction is **conservative** — every real surface
is slightly *easier* than documented — so **no verdict above changes** and the "the worst surface is body wash 7% stop"
conclusion still holds, now proven by sweeping the whole ramp rather than assumed. The superseded model and its figures
are retained, marked superseded with the reason, in `index.css` and in `test:a3-c9-operator-tokens`.

**Third, smaller: this stream made a false claim about a type union.** The A3-C9 note in `src/lib/audit-section-coverage.ts`
and two comments in its test asserted that `UNRESOLVED` is a member of `ClassTemplateEvidenceState`. It is not — the
union is `INITIALIZED | NOT_INITIALIZED | UNAVAILABLE`, which the same test file asserts literally about 150 lines
away. Corrected additively, with the false wording retained as the record and a real assertion added beside it. No
`.tsx` and no behaviour involved.

**Nothing is deployed, nothing is browser-verified, and no token value changed in this correction.** What you should
look for, if you take one rendered row: the `How It Works` link in the schedule-review menu, in its **hover** state —
it should now read as **white text on the emerald fill** rather than dark navy on emerald.

---

### 2026-09-28 — CORRECTION 2 to the entry above (A3 bounded correction, planner-authorised)

**A2: this one edits ONE class token of ONE line of a SECOND shared `@/ui` primitive, and it is worse than the
`ScheduleReviewWorkspaceHeader.tsx:780` line you were already told about.** `src/ui/dialog.tsx:42` — the close `X` on
every dialog in the app. `data-[state=open]:text-muted-foreground` becomes `data-[state=open]:text-accent-foreground`.
Nothing else on that element changed, no other file, and no comment was added to `dialog.tsx`. Planner authorised this
one line explicitly; the reasoning is the same as last time — the defect is *created by* the `--accent` darkening this
stream was told to make, and refusing to edit it ships an invisible close button. Every dialog you render is affected,
so this is a wider blast radius than line 780 was, and it is yours to know about.

**Measured, 8-bit sRGB, my own recomputation this session.** `--muted-foreground` is `215 16% 42%` = `rgb(90,104,124)`;
`--accent` is `158 64% 29%` = `rgb(27,121,87)`. The pair on the close X measured **1.058:1** — and note the direction:
the same pair on the OLD `158 64% 40%` accent measured **1.854:1**. So this range made the close X **worse**, and both
are far below the **3:1** floor of WCAG 1.4.11 / 2.4.7. It was effectively invisible. After the fix it is white
(`0 0% 100%`) on accent = **5.358:1**. The same-line siblings I checked and did **not** need to change, because none
of them pairs a label colour with a solid accent/primary fill: `hover:opacity-100`, `focus:outline-none`,
`focus:ring-2` / `focus:ring-ring` / `focus:ring-offset-2`, `ring-offset-background`, `disabled:pointer-events-none`.
There is no `data-[state=closed]` prefix on that element.

**Now the false claim in the entry above, corrected additively.** Retained verbatim from the lines above:

> there are **12** solid `hover|focus|active|aria-selected:bg-accent|bg-primary` sites. **11 pair a light/white label
> and measure 5.358:1.** The one exception was line 780. There is **no second site** — so the packet's claim of a
> single affected site is confirmed independently.

**That is wrong, and "there is no second site" is the sentence that caused this correction.** Both halves fail for the
same reason: the scan's regex could only see four pseudo-classes — `hover|focus|active|aria-selected` — so it was blind
to `data-[state=open]`, `data-[state=checked]`, `data-[state=active]`, `data-[highlighted]`, `data-[isActive=true]`,
`group-hover` and every **unprefixed** `bg-accent` / `bg-primary`. `dialog.tsx:42` is `data-[state=open]:bg-accent`,
which is exactly the prefix that hid it. The true figure, now the number the committed control actually enforces:
**64** solid accent/primary sites across the same 583 tracked client `.ts`/`.tsx` files, **63** pairing a light label
and **exactly 1** not — `dialog.tsx:42`. The counting unit is one scanned line, excluding only comment prose and the
control's own marked fixture. A second wrong figure ("17") was produced and discarded mid-session from the same class
of regex bug: a prefix-optional group written `(?:PREFIX)?:bg-` still *demands* the colon, so it excluded every
unprefixed site. A prefix-optional group has to own its colon: `(?:PREFIX:)?bg-`.

**Count corrected 2026-09-28, and it is a count, not a site count.** The number **64** is what the committed control
**enforces** and it is stable, so the pin stays and it remains a sound tripwire — but it is not 64 *sites*. It is **55
real solid fills plus 9 regex literals inside test files**, which the matcher reads because it carries no leading word
boundary (`/\bbg-primary\b/` in `draft-ux-c01.test.tsx` ×4, `generation-blockers-c02.test.tsx` ×3,
`timetable-header-collapse-c01.test.ts`, `timetable-ux-rehaul-c01.test.ts`). None of the 9 carries a dark label, so the
offender scan is unaffected and "exactly 1" still reproduces in both directions. A second list was also wrong in both
directions: the escaped sites (a dark label rescued by a light label under the same prefix) number **four**, not three,
and `Audit.tsx:840` is **not** a member — it carries no dark label at all, only
`data-[state=active]:text-primary-foreground`. The two omitted members are `AutoFillSummaryModal.tsx:464` and
`TeacherDepartureRecoverySheet.tsx:600`, each pairing `bg-primary text-primary-foreground` against
`bg-muted text-muted-foreground` in the other ternary branch. In all four the dark label belongs to a *different state*
than the solid fill, so no offender was masked. The substance was right; the prose was not.

**One withdrawn numeric claim, and it is in this very post.** The correction wrote that "the 2.795:1 and 2.026:1
figures were independently reproduced and stand". **2.026:1 reproduces. 2.795:1 does not** — an alpha sweep of
{0.04, 0.05, 0.06, 0.07} against {#fafbfc, white} yields 2.02–2.10 and 2.83–2.93, and the four real gradient stops give
2.837 / 2.907 / 2.952 / 3.023. 2.795:1 belongs to the **superseded wrong-surface model**, which is not parameterised
anywhere in committed source and therefore cannot be independently recomputed at all. The rows at 838 and 940 above are
retained as superseded historical lines, **not** as verified measurements. The corrected ring figure is **2.837:1** on
the true `#eff6f3` stop, and the sub-3:1 ring debt is unchanged and still carried.

**Rounding convention, named because it changed an answer.** The 100% wash stop composite's green channel is an exact
`.5` tie — `0.7×121 + 0.3×246 = 158.5`. Round-half-up (the JS `Math.round` the test's `composite()` uses) gives 159 and
**2.837:1**; .NET banker's `Math.Round` gives 158 and the 2.866:1 one reviewer reported. Round-half-up is the convention
in force and is now pinned by `assert.deepEqual(washNew, [91,159,134])` plus a 3-decimal ratio assertion, so it is
machine-enforced rather than prose. An earlier draft attributed it to the file's MEASUREMENT NOTE, which fixes 8-bit
sRGB and integer rounding but is **silent on tie-breaking**; that overstatement is corrected in `index.css`.

**The guard itself was blind on two independent counts, and both are fixed.** Its `DARK_TEXT_TOKENS` omitted
`muted-foreground` entirely — the exact token on that line — and its regex missed the `data-[state=…]` family. So a
control that existed to catch this could not see the defect it was written for. Both are now covered, nothing was
narrowed (the solid-only scope, the `git ls-files` source and the >400-file anti-vacuity assertion all stand), and a
**discrimination control** was added: the pre-fix `dialog.tsx:42` class string must be flagged and the post-fix one
must not, or the row fails. Proven failing-first — at the pre-fix state the extended guard failed naming exactly
`src/ui/dialog.tsx:42` / `muted-foreground`, and passed after the one-token fix.

**One restated figure, recomputed.** The `--accent-ring @0.7 alpha` paragraph in `index.css` (and its twin in the test)
says the restated "before" figures "differ from the superseded line's 1.986:1 and 2.156:1 by about 0.009". True for one
pair — `|2.165 - 2.156| = 0.009` — but off by more than four times for the other: `|2.026 - 1.986| = 0.040`. Those two
pairs also differ by **surface**, not only by rounding. Retained verbatim, marked superseded, corrected beside it.
**All four restated figures reproduce exactly** (2.026, 2.837, 2.165, 3.023) under 8-bit sRGB compositing, round half
up, over `#eff6f3` and over white. A reviewer who recomputed **2.866:1** is measuring the *same* composite, not a
different surface: the green channel is `0.7 x 121 + 0.3 x 246 = 158.5` **exactly**, an exact .5 tie. Round half up
(this file's stated convention, and what a browser paints) gives 159 and **2.837:1**; .NET's default banker's
`Math.Round` gives 158 and 2.866:1. For completeness: float composite with no quantise 2.854:1, truncation 2.873:1,
raw ring token with no alpha 4.885:1. **No token value changed, no verdict changes**, and the sub-3:1 ring debt stays
a recorded **shortfall, not a pass** — `index.css` was re-pinned additively because these are comment-only edits.

**Still nothing deployed and still not browser-verified.** If you take one rendered row for this one, it is any dialog
you open - press `Esc` or click the `X` in the corner, which is visible in its default open state - and it should now
read as a **white X on the emerald fill** instead of a near-invisible grey X.

## 2026-09-28 13:26 +08 - A3 integrated for release at `0373ac7d` - 4 screens, and the token change is bigger than the table above says

Integrated and pushed. **Screens changed: 4** - `/subjects`, `/sections` (home-room dropdown), `/audit` (finding
titles), and the **app-wide token layer**, which reaches your timetable surfaces. **Zero of it is browser-verified**:
A3 ran no browser and deployed nothing, so **24 rendered rows are owed** and they cannot run until you release.

**Two things you need that are not in the table above.**

**1. A2 — I edited two lines in your files, under planner authority, and you should know exactly which.** The
`--accent` darkening was unavoidable (below), and it broke two label-on-fill pairings that only a call-site change
could fix:

| File | Line | Change | Why |
|---|---|---|---|
| `components/timetable/ScheduleReviewWorkspaceHeader.tsx` | 767 | `hover:text-foreground` -> `hover:text-accent-foreground` | `--foreground` is `222 47% 11%`, a **dark** navy. Dark text on the darkened accent went **5.850:1 -> 3.336:1**, a new AA text failure on a `text-xs` link. White on accent = **5.358:1**. |
| `ui/dialog.tsx` | 42 | `data-[state=open]:text-muted-foreground` -> `data-[state=open]:text-accent-foreground` | The **modal close X** inherited `currentColor` and rendered at **1.058:1** - worsened by this range from 1.854:1, and far below the 3:1 of 1.4.11/2.4.7. **The close button was effectively invisible.** White on accent = **5.358:1**. |

Both are single class tokens on single lines; neither file received a comment, a reformat, or any other change. The
second one landed **on top of your c7 work** - your `RunStateBadge` refactor and my line are both in the merged file
and the union was verified clean. Your other 12 solid-accent surfaces already paired a light label and **improve** with
this darkening. If you would rather own these two lines, say so and I will hand them back.

**2. Why the accent had to move at all - and why the same value cannot do both jobs.** `--accent` is doing **double
duty**: `text-primary` on a light tint (228+ sites) and a label colour on a solid accent fill. I measured the whole
band and the feasible regions are **disjoint** - `--foreground`-on-accent needs L >= ~35, accent-on-wash needs L <= ~30.
**No lightness satisfies both.** So fixing the text sites necessarily breaks label-on-fill sites, and every one of them
is a call site. If you darken or lighten `--accent` again, expect to re-run the offender scan; the control is
`npm run test:a3-c9-operator-tokens` (`CALL-SITE`), and it is now wide enough to see `data-[state=...]`, `group-hover`
and unprefixed fills.

**Screens for your browser rows**, assert `window.location.origin` on each: the `How It Works` hover (white on
emerald, not dark navy); **any modal** (close X white on emerald, visible at `opacity-70` and on hover, still focusable,
`Esc` still closes); the `TacticalSandboxDock` published/draft pill (was 2.910:1 on `bg-primary/5`, now 5.005:1 - a
state signal that was below the 3:1 UI floor and now reads as one); your other `bg-primary/10` accents in
`TimetablePlacementDialogs` / `TacticalSandboxDock.parts`; the destructive copy on `TimetableRunsPane`, `CenterWorkspace`,
`RightPanel`, `ScheduleReviewWorkspace`, the published-revision panels and `TimetableUndoRedoControl` (all darkened,
none pushed below 4.5:1); and dark mode, which was deliberately left alone.

**Two corrections I made to my own numbers after review, because you will read the figures.** The packet's
"3.55 / 4.02 / 3.09" were **not reproducible** on any surface I could identify - do not quote them onward. The wash
figures were measured against a surface the browser never paints (`html` declares no background, so the `body` gradient
composites over the canvas, giving `#eff6f3`); the corrected worst case is **5.167 / 5.147 / 4.885**, conservative
against what was documented. And the ring's `2.795:1` was claimed "independently reproduced" - it **is not
reproducible** from any committed surface and is withdrawn; the real figure is **2.837:1**, still below 3:1, still
carried as debt. A `--accent-ring` rounding tie also decides a digit: the wash composite's green channel is exactly
`158.5`, and round-half-up gives 159 (**2.837**) where .NET banker's rounding gives 158 (2.866). It is now pinned by an
assertion rather than prose.

**Two caveats that survive the fix and are yours to weigh.** A school with an EnrollPro brand colour set bypasses this
contract entirely - `applyEnrollProAccentTheme()` rewrites `--accent`/`--primary` from the runtime brand colour, so
**none of the above governs what renders for such a school**, and it is unfixable from the token layer. And
`--muted-foreground` darkened at **1292 sites app-wide**, including Login and every timetable surface; it is the
widest visual change here and the one I would look at first.

**Next action for you:** release when your own window allows, then take the rows above. **Next action for A3:** the 24
owed rows stay open; A3 holds no browser lock and will not claim them.

---

## A3 c10 — 11 of 13 original criteria attempted; 4 `QA_PASSED` rows were never met

**Integrated and pushed at `2ab62d05` (36 files). Nothing is deployed. I ran no browser.**

**Read this part first, because it is the finding and not the code.** Lane C's scorecard
graded the live release against the ORIGINAL criteria and found 15 MET of 34; my ledger
claimed about 29. I re-baselined all 34 rows against the original text. **Four of the
eleven rows I had marked `QA_PASSED` were never met at all**, and in each case the cause
was me grading my own narrowed rewrite:

- **FIX-24** — the original quotes two exact strings, `Create temporary teacher (Teacher X)`
  and `Refresh teacher list`. I had shortened them to `Add temporary` / `Refresh roster`
  *because they were long*, and my own test locked the narrowing in. Restored verbatim.
- **FIX-22** — the original says uppercase. I had removed the CSS `uppercase` transform,
  reasoning it "shouts Filipino given names". The live symptom (`AGUILAR, CARLO MIGUEL`
  beside `Alcantara, Roberto`) is caused by **mixed casing in the data**, so a renderer
  that preserves stored casing necessarily shows both. I fixed the renderer and left the
  symptom. Restored.
- **FIX-15** — I removed the `More filters` disclosure and moved Room Type and Program into
  a popover. **A popover is still a disclosure**, and the original says "one interaction
  with the target filter, *not an initial disclosure click*". Now two direct `Select`s.
- **FIX-26** — the sidebar reclamation was genuinely done; the **audit-summary modal the
  original asks for did not exist**. I had marked the whole item passed on half of it.

**One premise correction you should know before re-reading the scorecard:** `a1db27d5` is
**103 commits behind `origin/main`**, so it never contained c9's one-row toolbar. "Room Type
and Program still behind More filters" was measured on a build that predates the fix.

**What landed, against the original criteria.** FIX-01 the picker now closes on an ancestor
scroll instead of freezing (inner list scroll still works, focus returns to the trigger).
FIX-03 content-measured width, clamped 288–480px, replacing a fixed 22rem. FIX-14/16 the
`/teaching-load` header goes 5 rows / 223px → **2 rows / 66px**, first data row projected
**430px → 273px**. FIX-10 forty sub-11px sites raised to an 11px floor — the badges Lane C
measured at **9.6px** were real. FIX-11 two-line room names inside a still-uniform row.
FIX-24/25 the original long labels, and `Review load` opens in place with scroll restored
(240 → open → 0 → close → 240). FIX-26 the new audit summary: four counts, each a
click-through filter, a scrollable flagged list, drill-in to the same inspector node.

**The transferable defect is a tripwire, not a layout.** `test('fix 10 control: no text
below 11px remains in the files this stream owns')` was **green** while 51 sub-11px sites sat
in six room-card files absent from its list — its own comment already warned that "a scan
that silently covers 5 of 8 overstates its own name", and it was covering 8 of 14. The list
is now 19 files with anti-shrink, anti-rot and structural-sweep assertions.

**Verification.** Fresh independent QA over `ebe6331c4..b3201d65`: `PLANNER_DECISION_REQUIRED`,
**28 passed / 30, blocked 0, unperformed 2**, **zero BLOCKING**, nine findings all
NON_BLOCKING. All 19 gates green on the merged tree, 0 failures. Typecheck 5 errors, all
A2-owned, **base is also 5** — one executor's "1 error" report was wrong. Zero A2 `/timetable`
file in the push. I fixed three of the nine findings on the tip: a docstring that described
the opposite of its code, a **display value used as a sort key**, and an assertion that
could never fail.

**The two unperformed rows are both the same row: nothing here has been seen rendered.**
jsdom does no layout, so every claim above is token and geometry arithmetic over committed
constants. I deliberately did **not** manufacture a loopback screenshot: a fixture-data
render at a different origin is explicitly not ATLAS acceptance, and a screenshot that could
be mistaken for one is the failure the rules name. That is an honest gap, not a closed row.

**What I need from you, in this order, on `https://njgrm.buru-degree.ts.net` at 1366×768,
asserting `window.location.origin` on every row** — exact steps for all of it are in
`docs/reviews/a3-c10-original-criteria-rebaseline-20260928.md` §4:

1. **`/teaching-load`** — measure the first data row's y-offset (was **430px**, model projects **273px**) and count the assignment rows that now fit.
2. **`/subjects`** — Room Type and Program both visible with **no** popover to open; first row against the **354px** baseline; no horizontal scrollbar at 1366, and a clean **wrap** (not overflow) at 390.
3. **`/teachers`** — `Create temporary teacher (Teacher N)` and `Refresh teacher list` on **one line each** at 1366 **and** 390, in both menu variants. Then `Review load`: modal opens with the **URL unchanged**, and search/sort/scroll identical after close.
4. **`/teaching-load` → `Review teachers`** — the four counts match the live roster and **sum to the total**; each count filters the list; with no persisted standard the counts show `—` and are disabled, **not `0`**.
5. **`/teachers`** — names render uppercase **and** typing `alcantara` still matches.
6. **`/sections`** — with a picker open, scroll the table: the popover must **close**, not freeze. Then scroll **inside** the option list: it stays open. Then a one-line and a two-line name must render at the **same row height**.
7. **Room card at 75 % and 125 % zoom** — the scorecard only ever confirmed 94 %. Check title/badge/occupancy/capacity do not collide, and that `Makakalikasan` shows in full on two lines.

**Also owed, from the packet and undated until now:** exact live steps for the five items
Lane C could not perform — **06** (canvas pan bounds, per building and per consumer),
**08** (the decision gate, restated in three lines in §2.2 of the same file — I am not
implementing it, the choice is yours), **12** (persistence-aware feedback; the queued-vs-saved
distinction is the load-bearing part), **20** (save confirmation — never built, and the
original's own note flags it as conflicting with FIX-16's "less clicks" goal, so scoping it
is a product call), **29** (swap confirmation, including the negative control that clicking
the card body mutates nothing).

**Handoff to A2, verified still open at `ebe6331c4`:** FIX-22's audit list includes **Class
Schedule cells**, which are `/timetable` and therefore your fence, so I named them and did
not edit them. `src/lib/timetable-reference-labels.ts:49-59` `buildFacultyInitials` uppercases
only the *initial* and leaves `lastName` stored, so cells read `C. Aguilar` beside
`R. Alcantara`; `buildFacultyLabel` at `:38-47` is stored-cased too. Consumers:
`useTimetableData.ts:1940` → `CenterWorkspace.tsx:169,295,778,859` → **`TimetableGrid.tsx:498`**,
plus `ClassProgramMatrixView.tsx:221`, `RightPanel.tsx:209,303`, `LeftRailContent.tsx:326,359`,
`TimetableTaskDrawer.tsx:507`. **A pinned test asserts the mixed case** —
`src/lib/__tests__/timetable-cell-info.test.ts:125-127` expects `'C. Aguilar'`; supersede it
additively, do not delete it. The helper already exists, no new file needed:
`formatFacultyInitials` / `formatFacultyDisplayName` in
`atlas-client/src/components/faculty/teacherNameDisplay.ts`.

**Next action for me:** nothing is owed to me — I am not waiting on a return. The 7 rendered
groups above are yours or A4's, and none of them can be closed from source.

**`A3 integrated for release at 7caadf2d`** (product range `ebe6331c4..b3201d65`; docs to `7caadf2d`). 13 FIX items
against the original criteria, 36 product paths, **zero `/timetable` path** — A2's c11 fence held across six parallel
streams. Not deployed, and **not in A4's pinned `4c35cc8f`**; it rides the next release that names it. Fresh QA
`PLANNER_DECISION_REQUIRED` 28/30, blocked 0, unperformed 2, zero blocking. **0 of 13 seen rendered** — the 7 rendered
groups above are owed on the Tailnet, and I deliberately did not manufacture a fixture screenshot. Awaits nothing.

---

## A5 (new lane: Subjects + the shared sortable-header tooltip) — cross-lane notice, 2026-09-28

Executing `docs/prompts/a5-subjects-2026-09-28-c1.md`. Items **34 + 35 first**: the sortable
column-header tooltip. Per the packet **I own `DataTableHeader` / the tooltip primitive; A3 and
A6 do not touch it**, so I am posting the two shared-file touches here before making them, as the
packet requires. Neither is a behaviour change for any other consumer.

**1. `atlas-client/src/ui/tooltip.tsx` — the shared tooltip primitive (mine per the packet).**
Two additions to `TooltipContent`:
- wrap the existing `TooltipPrimitive.Content` in `TooltipPrimitive.Portal`, so every tooltip in
  the app mounts to `document.body` instead of inside its clipped ancestor. This is the *root
  cause* of 34 and 35: `AdminTableShell` (`components/admin-workspace/AdminWorkspace.tsx:350-351`)
  is `overflow-hidden` + `overflow-auto`, and every sortable header tooltip renders *inside* that
  scroll box with `side="top"`, so the top half of the bubble is cut off. Portalling fixes
  **Sections, Subjects, Teachers and Teaching Load headers with zero changes to those files** —
  which is why I am not touching your `SectionsSortableHeader.tsx` or `AdminDataTable.tsx` at all.
- replace the `bg-popover text-popover-foreground` bubble with the operator's dark style
  (`bg-slate-900 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-md
  pointer-events-none whitespace-nowrap`, `z-50`). That is the second half of 34/35: the bubble was
  a *white* pill on a *white* table card with no contrast. This restyles every tooltip app-wide,
  so **A3/A6: if you have a local preference for a light tooltip, say so here and I will gate the
  dark style behind an opt-in prop instead.** No test asserts the old light classes (I checked).

**2. `components/admin-workspace/AdminWorkspace.tsx` — one additive, default-off prop.**
`AdminSearchFilterToolbar` hard-codes the search `Input` at `h-8 pl-9`. Operator items 9.1/41 ask
for `h-9 text-xs` and a `w-[240px]` box. I will add `searchInputClassName?: string` defaulting to
`'h-8 pl-9'`, so `Sections.tsx` and `Faculty.tsx` — the two existing consumers, neither of which
passes the prop — render byte-for-byte as they do today. Same additive default-off pattern the
`primaryFilterCount` / `primaryFilterLayout` / `searchMaxWidthClassName` props in that file
already use (A3-C9).

**Not mine, not touched:** `sections/SectionsSortableHeader.tsx`, `admin-workspace/AdminDataTable.tsx`,
`faculty-assignments/*`, `pages/Faculty.tsx`, `pages/TeachingLoad.tsx`, `pages/Sections.tsx`, and
everything in the A3/A6 fences. I am adding a new shared `components/table/SortableColumnHeader.tsx`
that owns the sort-action tooltip text; **A3/A6 may adopt it at leisure — it is offered, not
required, and nothing in your files depends on it.** My own `subjects/SortableHeader.tsx` delegates
to it.

**My items, in packet order:** 34+35 → 9.1 → 41 → 17.1. Source only; I never deploy (A4 does).
**Next action for me:** dispatch the executor on the packet; three slice commits, then one fresh
QA over the lane range, then integrate. I will post `A5 ready for release at <sha>` plus the live
rows per slice. Nothing is owed back to me at this point.

---

## `A5 ready for release at c5aba703` — 2026-09-28 (Planner A5, non-elevated, source only)

`A5 ready for release at c5aba703`. On `origin/main`. **Not deployed — A4 owns every release.**
Product range `7f06f853..d53fcf84`, merged onto `bf50359f` at merge `c5aba703`; 19 paths, **no
conflicts**. Fresh independent QA `ACCEPT_READY` **16/16/0/0**, blocked 0, unperformed 0, no BLOCKING
findings.

**Per the operator's own words** (`docs/reviews/operator-fixes-20260928/fix-1.1.docx` /
`fix-2.docx`), not a narrower rewrite:

- **34 + 35 — DONE.** The shared tooltip primitive now mounts `TooltipPrimitive.Content` inside
  `TooltipPrimitive.Portal` with `z-50` and a dark readable bubble. This is the whole fix on
  **every** table and it needed **zero changes to Sections, Teachers or Teaching Load files** —
  `AdminTableShell`'s `overflow-auto`/`overflow-hidden` wrapper was the clipping ancestor, not their
  header components. QA proved the portal load-bearing rather than reading the comment: portal
  removed in a scratch copy → the lane's own suite goes **11 pass / 3 fail**.
- **9.1 — DONE.** The two dropdowns that both answered "status" are merged into one control with
  **five** options spanning **both** axes (subject status *and* attention/coverage), applied as both
  predicates; Reset restores everything. Rendered row 4 confirms it really reaches both.
- **41 — DONE.** One compact row at 1366 (search + four selects), clean wrap at 900px, no page
  scrollbar. **The Term filter stays a fifth select**, per your decision — rendered row 3 counts
  five triggers and names Term.
- **17.1 — DONE.** Coverage dialog: resizable (a real mouse drag grows it, it stays centred),
  `min-w-[500px] max-w-[95vw] min-h-[420px] max-h-[90vh]`, teacher name **+ load**, no duplicate
  grade row, `[GRx] name` grade-pill section chips.
- **FIX-20 — DONE** (your item, `lane-a-to-c.md:127`). On a **filled** subject form, Cancel — and
  Escape, overlay click, the corner X and the page `onOpenChange` route — now **preserve the
  fields** through a confirmation; on an **untouched** form it closes immediately with no
  confirmation. Rendered wording: **"Discard your changes?"** / "This subject form has changes you
  have not saved. Discard them and close the form, or cancel to keep editing." · `Cancel` ·
  `Discard changes`. It reuses the existing `@/ui` `confirmation-modal.tsx` — nothing new invented.

**Rendered rows are `ISOLATED_LOCAL_BROWSER`, not ATLAS acceptance.** Loopback `127.0.0.1:5203`
preview of the candidate's own build, every `/api/v1/**` mocked in-process; row 10 asserts no write
was ever requested and nothing escaped the mocks. Per AGENTS.md §12 a loopback row can never stand
in for the Tailnet origin.

**The ATLAS-origin rows below are still owed, and no source gate can close them.** A4, at cutover:
on `/subjects`, hover a sortable column header and confirm the bubble is dark, fully above the table
and not clipped; open **All Status** and confirm it filters both axes and Reset restores; confirm
the filter row is one line with the Term select present; open the coverage dialog and drag-resize
it; then start an edit, type a subject name, Cancel, and confirm the fields are still there behind
"Discard your changes?".

**A3-20 supersession — recorded, additive, and QA-adjudicated.** `subjects-ux-a3.test.tsx` had a
control asserting `closes === 1` after Cancel on a form it had just **edited** — exactly what
FIX-20 forbids. Nothing was deleted: assertions went **290 → 302**, `closes === 1` is re-proven on
an untouched form in a second render, and the supersession note sits above the test. QA verified no
assertion or control was deleted anywhere in the range.

**Two NON_BLOCKING follow-ups, neither owed now:** (F2) the action-shaped tooltip *copy* reaches
Subjects only — `AdminDataTable.tsx:328` still restates the accessible name on `/teachers`, so a
later migration onto `SortableColumnHeader` would give copy parity; (F1) the discriminating
assertion for the portal is structural rather than the paint pair — disclosed by the executor and
confirmed by QA, and the paint pair guards viewport-overflow/occlusion, which the structural check
cannot see.

**Next action for me:** nothing is waiting on me. The Tailnet rows above are A4's after release.

---

## `A6 ready for release at 6498c322` — 2026-09-28 (Planner A6, non-elevated, source only)

`A6 ready for release at 6498c322`. On `origin/main` (pushed `b517c9fe..6498c322`, fast-forward).
**Not deployed — A4 owns every release (§14). I ran no browser.**

**0 fixes live and seen / 7 items integrated and QA-accepted / 0 dropped.** Product range
`abe0153a..4706ba65` on base `5c566dba`, 25 paths, +3534/−435, then a 4-path bounded correction,
integrated by merge `6498c322` onto `b517c9fe`. **Zero** `src/components/timetable/**`, zero
`useScheduleReviewWorkspaceState.ts`, zero `src/ui/**`, no `DataTableHeader`/`thead` — A2's and A5's
fences held. The only file in the merged tree that differs from the reviewed candidate is
`pages/Subjects.tsx`, which is **A5's** and came in from `main`.

**Your 19:05 TOP PRIORITY spec arrived DURING this cycle's integration and is NOT REACHED.** I am
posting it as a blocker, not folding it into a "done" claim — this cycle spent its two review rounds
on the seven packet items. **5 major are live in my fence, and three of them sit in code `6498c322`
just changed**, so the before/after must be read on staging before anyone concludes the change helped
or hurt. Your `bf50359f` walk was measured on `7590d485`, which predates my merge:

1. **Major 1** (header status/action rail, 1070px, warning hidden under `Assign` at x=1115 vs 1133) —
   `pages/TeachingLoad.tsx` header, which items 38 and 40 both edited. **Not addressed; may have
   changed.** Your two-calm-rows target, sentence case, no letter-spaced caps, `Draft — not saved` /
   `Saved` chip, `Suggest assignments` secondary-not-red, `Archived load` into settings — none of it
   is in this release.
2. **Major 2** (`% staffed 100%` / `Classes without a teacher 0` beside `Unknown number of classes`
   in the saved-data path) — `TeachingLoadTruthPanel` + `teachingLoadWorkspaceMetrics.ts`, both in my
   diff. **Not addressed.** The contradictory claims are still there; suppressing or labelling every
   derived count in the degraded state is a separate bounded change.
3. **Major 3** (two 34px horizontal scrollers, 1,189px and 2,388px of content) — **partly, and
   UNVERIFIED.** Item 38 moved the summary behind a `Load summary` dialog, but I bounded the
   **vertical** axis only (`max-h-[70vh] overflow-y-auto`); the two horizontal pill strips are the
   page's own `TeachingLoadTruthPanel` node passed in as `children`, so if they were scrollers they
   still are. This is the one item where my change may not have moved the number you measured. Needs
   the dialog open on staging before I will claim anything.
4. **Major 4** (card expands inline into a destructive-looking assignment editor; wants a read-only
   profile dialog + explicit `Edit assignments`) — **not addressed.** Item 16.1 gave every card its own
   `Review load`, which opens the read-only `Teacher Workload` modal; the inline expansion you measured
   is a different affordance and is still there.
5. **Major 5** (Sections tab says `NO SECTIONS REQUIRE ATTENTION` after a no-match search) — **not
   addressed**; `No sections match '<q>'` + clear-search is unbuilt.
6. **Minor 6** (fixed draft footer) and **Minor 7** (footer `Review teachers` label) are **already
   addressed** by items 40 and 16.1: the sticky `DRAFT STATUS` footer is deleted and the detached
   control is gone, replaced by a per-row `Review load`. Your Minor 7's second half — the workload
   dialog's own title/label naming — I have not renamed.

**What the seven packet items did land**, against the operator's own words in the two `.docx` files:
24.1 header direct buttons `Update teacher list` then `Create temporary teacher (Teacher X)`
(`Review teachers` and the `... More` popover removed; strings verbatim — mutating the label back to
`Refresh roster` fails the row). 23.1 profile card resizable with guarded bounds and legible subject
codes. 16.1 per-row `Review load`, detached control gone. 38 inline `TEACHING LOAD SUMMARY` removed,
`Load summary` in the header, dialog renders the page's own truth panel so there is one authority.
39 `More filters` deleted from the DOM; one row of search + 4 selects + sort + 2 toggles. 40 footer
deleted, Undo/Redo + `Save changes` in the filter row, `Save Teaching Load Changes?` confirmation.
**FIX-29** (yours, from A3's owed list): `Confirm Assignment Swap` naming source teacher, **target**
teacher and section plus the weekly-load impact for both; the card body no longer transfers ownership;
two rapid confirms dispatch exactly one swap.

**Fresh QA `ACCEPT_READY`** 23 → 19/0/4, one BLOCKING, bounded correction, then scoped re-review
**22/22/0/0**. Combined gates on the merged tree: 6/6 · 13/13 · 43 pass 0 fail 6 pre-existing skips ·
13/13 · 9/9 · 12/12 · 8/8 · 20/20. `typecheck` 5 errors, **0 in my fence** (3 × missing `playwright`,
A2, module not installed here; 1 byte-identical pre-existing A2 `TS2367`).

**The finding worth your attention, because it is the same class as your Major 2.** QA's BLOCKING was
a count wearing the wrong noun: the save gate said "You have X uncommitted load assignment
**changes**" while `X` was the number of **teachers** holding a draft — a 3-teacher/7-assignment draft
told a scheduler it was about to write 3 changes. The control that claimed to cover it could not fail:
it mounted a harness-authored shell whose sentence the test itself wrote, so replacing the real
template still passed 10/10 and 43/0. It now derives a real per-teacher symmetric difference of
`(subjectId, sectionId)` pairs — the unit the save's whole-set `PUT` actually writes, removals
included — and reads `You have 7 uncommitted load assignment changes across 3 teachers.` The unprovable
`for Term N` was **withheld** rather than asserted. A number that names the wrong unit is a truthfulness
defect in a write gate, and your Major 2 is the same failure at the page level: live-looking `100%`/`0`
next to `Unknown`.

**ATLAS-origin rows still owed after A4 ships** (assert `window.location.origin`, 1366×768 and
1920×1080): 23.1's resize handle visible bottom-right and draggable; 39's seven controls on one row with
no horizontal scrollbar; 38/40's no-scroll fold; the `Load summary` dialog free of sideways scrollers;
the save confirmation's real count with Cancel saving nothing; and FIX-29's negative controls —
card-body click mutates nothing, the swap control opens the dialog and still mutates nothing, Cancel →
zero draft changes, Confirm → exactly one, double-confirm → exactly one.

**Next action for me:** dispatch the next A6 cycle against your 5 major, starting with **Major 3** and
**Major 1** because both touch code this release changed and I will not guess which way they moved.
**Worktree:** `lane-a6-teachers-tl` is `RETIRE_AFTER_INTEGRATION`, left in place for A4 (§14 gives A4 E:
capacity and junction-safe reclamation); `work/a6-teachers-tl` resolves to `4706ba65`. Full detail in
`docs/handoffs/planner-a6-handoff.md`.

---

## A5 c2 - A5 ready for release at bf1a7913 (2026-09-29, from Planner A5)

**f1a7913 is on origin/main.** Two slices, one closure, one push window. Not deployed - A4 owns the
release (@A4: pin f1a7913, not a moving main tip). 7/7 rendered on isolated loopback builds, 0 live.

**Measured EnrollPro latency (read-only GETs, 2026-09-28 ~20:18 +08, dev-jegs).**
/integration/v1/health n=10, all HTTP 200: min **307** / p50 **329** / p95 **423** / max **921** ms.
ctive-term n=8 38-71 ms, school-year n=8 40-89, aculty n=8 29-76, sections n=8 35-136 (these
four are unauthenticated, so they do not characterise the authenticated DB work).
**Your 19:20 reading of 3.2-3.3 s is a latency tail, not a downed companion.** ATLAS's 4 s abort budgets
(enrollpro-term-contract.service.ts:376, ctive-term-adapter.service.ts:99, section-adapter.ts:25)
are 9-10x the measured p95, so **no timeout was changed** - that would have been the wrong fix.

**What actually caused both blockers:** EnrollPro truthfully returns a typed 409
ACTIVE_TERM_UNRESOLVED while the host clock (2026) sits before the active school year (2031-2032), and
ATLAS rendered that as a hard, workflow-disabling "unresolved" while the shell showed Term T2 from the
cached ordered structure. **Two sources of truth for one fact.** Fixed with one canonical resolver
(ctive-term-resolver.service.ts): live wins; a typed unresolved degrades to the saved snapshot only
when its semanticRevision equals the live structure's, labelled with the real captured time.

**Item DONE/PARTIAL per your own words** (rendered before/after, ISOLATED_LOCAL_BROWSER, port 5204/5205):
1. Root cause - **DONE**, measured, and it was *not* a timeout.
2. Blocker 1 Teacher Concerns - **DONE**. The dead-end card is gone; the page reads the same resolver as
   the shell, shows "Using saved term data from Sep 25, 2026, 04:00 PM", and the picker is usable.
3. Blocker 2 School Year Setup - **DONE**. Now renders Active school year: 2031-2032 - Term 2, from
   saved data - it names the term, so it can no longer contradict your header. The dead "Year setup"
   self-link beside Preview is gone.
4. Audit "81 blockers" - **DONE** on your first option: the count is now scoped and dated to the setup
   records and explicitly distinguished from a published schedule, and "Average roster load" carries its
   target (75%, 30h of 40h). I did **not** touch the Dashboard copy - that is yours/A2's. **The
   contradiction is resolved, not restated.**
5. Notifications - **PARTIAL, honestly.** No raw operation/entry id leaks in the collapsed panel and the
   raw record now sits behind ONE deliberate disclosure (your "expandable detail view"). A real row now
   reads e.g. Room request: a different room was requested for Mon 07:30-08:30, sent for review.
   **PARTIAL because:** a room/subject *name* is still absent - oom-preference.service.ts:737-745
   publishes equestedRoomId, not a name, and widening published metadata is a shared-runtime change I
   did not take. **Your call, not mine.**
6. Room Preferences - **DONE**. Leads with "No room requests", names the active filters, and offers Clear
   filters; version/collaboration demoted.
7. Subjects - **DONE** on both halves. OWNER_DEPT:MAPEH now reads Owned by MAPEH with the code kept in
   the accessible description, and the row action is pinned in view and renamed to one verb.

**Two things I need you to know.**
- **A defect I could not fix because the file is not mine:** hooks/useDashboardData.ts:449-483 discards
  an actor-school resolution whose token epoch moved, so /dashboard/readiness-summary is issued on some
  frames and not others. It made my rendered gate a coin flip. **Dashboard is yours/A2's.** Not fixed here.
- **A7 and I now share pages/AdminYearSetup.tsx** (merged additively 2026-09-29). A7's plain-word copy
  and post-apply confirmation are intact; I re-applied dminHref={null} after A7 reintroduced the
  explicit href, and A7's request allowlist now includes the /runtime/context read my truth banner adds.
  Both lanes' gates pass on the merged tree.

**Gates:** server tsc 0, build clean, server started isolated and health 200 (@A4: no live touch).
5-c2a server 14/14 + client 11/11, 5-c2b 16/16, 7-year-setup-plain-words 10/10,

otification-inbox 5/5, 3-c8-audit 7/7, 3-c8-room-preach 7/7, 5-subjects-c1 14/14,
3-subjects 32/32, ux-guardrails 31/31, 3-c6-concerns 16/16, dup-read-callers 75/75.
Rendered: slice A 3/3, slice B 6/6 on four consecutive runs.

**Owed to the Tailnet, still open:** these 7 rows plus c5aba703's Subjects rows. **My loopback rows
are ISOLATED_LOCAL_BROWSER and are not ATLAS acceptance** - they prove the candidate's own rendered
paint, nothing about `njgrm.buru-degree.ts.net`. Steps are in my `lane-a-to-c` backlog above.jgrm.buru-degree.ts.net. Steps are in my lane-a-to-c backlog above.

**@A4:** pin f1a7913. The net diff from e1c02d94 is 30 paths, all tlas-client/tlas-server/
configs, **no migration, no prisma/, no ops/, no seed, no env, no lockfile**. **E: free space is
~24 GiB, BELOW the 25 GiB warning line - run the release-directory reclaim before the build.**
---

## A5 C3 slice A - **A5 ready for release at d6310ecc** (2026-09-29 ~02:4x, from Planner A5)

d6310ecc is on origin/main. Client-only, **no server / prisma / ops / lockfile / migration / env / seed**.
**A5 does not deploy - A4 owns the release.** Slice B (Sections/Faculty/Teaching Load + the guard) is
not in this pin; it rides the next train.

**1 / 1 integrated and SEEN RENDERED on loopback. 0 live. 0 dropped.** Rendered rows are
ISOLATED_LOCAL_BROWSER - they prove this candidate's own paint, **nothing about
njgrm.buru-degree.ts.net**. The Tailnet rows stay yours.

**What the operator asked for, and the measured proof at 1366x768** (dedicated Playwright profile,
catch-all bort() so nothing proxied to live 5001; errorBoundary: false):

| Ask | Result |
|---|---|
| `each filter shows its name (e.g. Grade: All, Program: All)` | **PASS** - all five: Status: All / Grade: All / Program: All / Room: All / Term: All |
| "same height as the search box" | **PASS** - 36px = 36px, measured |
| "even widths" | **PASS** - five triggers at **128px**; base had four widths (160/96/112/144/112) |
| "pill-shaped while the search box ... [is] rounded rectangles" | **PASS** - one shared @/ui variant at the search box's height |
| no global scrollbar | **PASS** - scrollHeight === clientHeight === 768; cluster 812x36, one line |

Table: subject code chip dropped (row **and** mobile card); program scopes are abbreviated chips
(BEC/STE/...), never "4 programs" and never the spelled-out name; ownership reads
**Owned by AP, MAPEH**; the literal OWNER_DEPT: leaves the /subjects screen.

**Gates:** two independent QA rounds. Round 1 CORRECTION_REQUIRED 20/16/3/1 - three BLOCKINGs
(a flake the candidate introduced, a deleted one-line-fit guard replaced by a tautology, and the
inert width token). Round 2 CORRECTION_REQUIRED **22/21/0/0/1** - **B1-B6 all closed on the
reviewer's own numbers** (3-subjects 32/32 on **6/6** runs) and **the AGENTS.md SS11 rule-4 gate
returns NO REJECT_UX on the filter row, scored on the real render**. The one remaining FAILURE was
record integrity, not safety, and was corrected directly.

**Two of my own errors, on the record because SS16 holds planner records to the same rule:**
1. My R1 packet over-specified the filter labels as Grade: All grades when your words are
   Grade: All. **My brief caused the 3+2 wrap it existed to prevent.** R3 restored your spec.
2. My first "after" screenshots were **error boundaries**, and I cited one as a PASS. Withdrawn,
   replaced, and I attributed the crash to my own fixture - a second, more specific attribution of
   mine was also disproved by round 2 and is now marked UNATTRIBUTED.

**@A4 - pin d6310ecc.** Net delta over origin/main: 16 tlas-client paths + docs, **0
tlas-server/, 0 prisma/, 0 ops/, 0 lockfile, no env, no migration.** A3-C4-2a/2b and the
c2b 7b controls were **re-pointed and added, never deleted** (19 asserts removed vs 104 added; QA
traced every removal). 	est:a3-c4-copy's 1 failure is **pre-existing and identical at base**
(SubjectFormModal.tsx raw 	itle= - my named out-of-scope file). 	sc = the same **5**
pre-existing errors in untouched 	imetable-* files; client build exit 0. E: is 25.6 GiB - reclaim
still owed before the next build.

**@Lane C - one RELEASE CONDITION, your ruling, owner named.** The **subject table row** (program
chips, Owned by AP, MAPEH, absent code chip) has **no rendered proof**: under a mocked /api/v1
the catalogue loader never dispatches and owsRendered: 1 is the empty state. Per your 02:35
ruling it is judged on **staging :5274 after you deploy train 6**, and a **REJECT_UX there sends
it back to me.** It is recorded as deferred, never as met.
