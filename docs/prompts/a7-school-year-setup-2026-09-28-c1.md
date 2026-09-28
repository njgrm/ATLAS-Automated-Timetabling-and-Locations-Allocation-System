# Packet A7 c1 — School Year Setup, in plain words (new lane, demo-critical)

Issued by Lane C 22:50 +08. FRESH session, `--agent atlas-planner`, non-elevated, source only (A4 deploys). Follow
AGENTS.md §11 Throughput rules and the server-lifecycle rule. Never end a run to wait for Lane C.
Your surface: `atlas-client/src/pages/AdminYearSetup.tsx` and the components it renders (and the server message
strings they show, e.g. `enrollpro-rollover.service.ts` drift/sync messages). Other lanes own other pages; A5 owns
EnrollPro timeouts — do not touch adapters.

**Why now:** the Wednesday 2026-09-30 demo shows a NEW school: EnrollPro was wiped and the operator syncs ATLAS
year by year through four rollovers on THIS page, live, in front of an audience of older school schedulers.

**Operator's words (2026-09-28):** "we really need to improve school year setup in both UX/UI and clarity of words
used/layman's terms. We don't need to get technical." Screenshot: `docs/reviews/operator-school-year-setup-20260928/school-year-setup-live.png`.

What the screenshot shows that fails that bar (fix all, judge against the words above):
1. Intro paragraph is system talk ("moves the old school year to read-only history (Archive and sync)", "Normal setup
   pages link here so year actions never appear beside routine work", "advanced destructive reset ... disposable test
   data"). Replace with one short sentence a principal understands, e.g. "Start the new school year in ATLAS after
   EnrollPro moves to it. Last year's schedules are kept for reference."
2. The status card: two badges + a heading + two helper lines + "Automatic year sync is off. Sync stays manual." +
   three buttons (Preview / Sync now / Year setup). Make it ONE clear next step: what happened ("EnrollPro has moved to
   2022-2023"), what to do ("Start 2022-2023 in ATLAS"), one primary button, and a plain secondary "See what will
   change first". "Year setup" link on the Year Setup page is circular — remove or rename to where it actually goes.
3. After the click: a plain confirmation of what changed (years, number of sections and teachers brought in) and the
   next thing to do (review sections → Teaching Load → make the timetable). No IDs, codes, "sync", "mirror", "election",
   "drift", "archive" jargon anywhere on the page; "Archived school years" → "Past school years"; "never win the
   active-year election" → gone.
4. "Start from last year (optional)" / "carry-forward" / "compatible assignments map into the current empty Teaching
   Load" → plain words ("Copy last year's teacher assignments as a starting point"), and say it is safe (nothing changes
   until you confirm).
5. Visual: one primary action per card, calm colours (no crimson for a safe preview), readable at 1366x768 without
   scrolling for the main step, mouse-first targets.
6. Server-side strings this page renders (drift/sync messages) must read the same plain way.

Behaviour must not change: same endpoints, same gates, same confirmations. Tests: update the page's tests for the new
words; add one that forbids the jargon list above in rendered text. One fresh QA. Real-route smoke per AGENTS.md.
Post `A7 ready for release at <sha>` in `docs/handoffs/lane-a-to-c.md` with before/after wording table.
Final message: ≤ 8 lines — ready SHA, what changed, what is left.
