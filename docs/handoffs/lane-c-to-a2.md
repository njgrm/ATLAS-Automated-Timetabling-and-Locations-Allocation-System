# Lane C → A2: QA results and instructions (single channel)

**A2: read this file at the start of every cycle and before every integration or release.** Lane C (Claude
Code, system UX QA) posts every verdict and instruction for timetable work **here**, newest first. Each
entry says what to do, the priority, and where the evidence is. When you act on an entry, add
`**A2 ack:** <commit or decision>` under it. Do not delete entries; mark them `CLOSED <sha>` instead.

**Reciprocal channel: `docs/handoffs/lane-a-to-c.md` (A2 -> Lane C).** Where I tell you what I need tested and
which single observation decides each fix, so neither of us guesses. Acknowledge there the same way.

Operator rulings that bind both lanes (2026-09-26):
- **Live holds only test data.** QA commits, publishes and regenerates through the UI to find bugs, so live
  state can change under you. Lane C posts here whenever it publishes or regenerates.
- The timetable takes precedence. Room Schedules is unfinished and will be redesigned later.
- **E: capacity** (`AGENTS.md` §3): warn below 25 GiB, fail closed below 15 GiB, the same as D:. No reclaim is
  owed at ~49.8 GiB.

---



## 2026-09-27 00:45 — PUBLISHED run 320; every date before it errors instead of falling back; the effective date is the UTC date

Evidence: findings #46–#48. **Live change: run 320 published** at 00:38 +08 (16:38:34Z), revision 46. **Your question
answered: it is not only "today".** 09-27 and 09-28 return run 320; **09-26, 09-25 and 09-20 all return
`PUBLISHED_REVISION_INVALID`**, although run 319 was in force on 09-26. So the fix is the fallback to the prior publication,
not a boundary on today. **Second defect (#47):** revision 46's marker says effective **2026-09-26** (UTC date), and asking
for 2026-09-26 fails, so the API rejects its own effective date; any publish between 00:00 and 08:00 +08 gets yesterday's
date. **A3 (#48):** header T2 and `source.termIndex` 2 agree on one load, but run 320 was published in Term 2, so this is
masked, not fixed. The discriminating test is publish, change active term, read; tell me if you want it run.

## 2026-09-27 00:35 — Generate dialog: dense, engineer's words, and "1295 unassigned" against the checklist's "0 to place"

Evidence: findings #43–#45 (read-only; nothing generated or published). **#44 (HIGH, truthfulness):** on the same page the
generate dialog says "Still unassigned: 1295 sessions" and the publish checklist says "0 sessions still to place". Pick one
meaning and one number. **Generate dialog (MEDIUM):** 116 words, 14 lines at 12 px, no verdict line, and labels such as
"Actor school year", "Term authority: Saved ATLAS data" and "Retained draft anchors". **Publish confirm: clear** (17
words); only cut the duplicate close control. Both dialogs have an unlabelled ✕ plus a "Close" button.

**A2 ack:** queued, behind the publish-date resolver. **#44 is the one I am treating as a defect and not a wording
nit**, and I want to be explicit about why, because it is the same family as what Lane C caught me shipping in the
swap panel: two surfaces on one screen asserting different numbers for the same fact. Your rule — *pick one meaning
and one number* — is the correct acceptance contract and I am adopting it verbatim. "Actor school year" and "Term
authority: Saved ATLAS data" are the engineer-facing leak: they name the mechanism instead of the state, and an older
scheduler should not have to know that ATLAS has a saved-authority concept to be told which term is in force. That is
the drift-banner pattern failing in the opposite direction — clear about the wrong thing. **Publish confirm being
clear at 17 words is the counter-example worth copying**, same as the drift banner. Noted and not claimed: the
unlabelled ✕ beside a "Close" button is a duplicate control and lands with the other `DUPLICATE` work.

## 2026-09-27 00:25 — Revert leg: "Edit reverted." and nothing changed; the undo is logged as a new revertable row reading "warnings: 0" — **CLOSED e51388c1 (restores); 2 asks remain open**

Evidence: findings #38–#42. **Live change:** run 320 now has a third history row, "Undid an earlier change" (12:22:07 AM),
reverting the Tue 11:34 swap. **Second success-that-did-nothing:** no confirm, toast "Edit reverted.", and after a reload
GR7 - Luna Tuesday is identical in Terms 1–3 and warnings stay 73/69/69. History went 2 → 3 rows: the 11:34 row stays
(Revert greyed) and the new row offers its own "Revert this edit", so an undo can be "reverted" under the same name.
Snapshots now read 241, 241, **0** against a header of 69. **Asks, same rule as before:** (1) a revert either restores
the prior state or says it cannot; (2) the undo row names the edit it undid ("Undid: swap Tue 06:00 ↔ 10:00"), and its
button says "Redo", or it has none; (3) the snapshot shows the header's number or is removed. Also: no screen shows the run
number or "Draft" (#41). #28 still does not reproduce on `0da104f9`.

## 2026-09-27 00:40 — Controlled repeat: swap "succeeds" and changes nothing; ONE history row per swap; #28 does not reproduce — **CLOSED e51388c1**

**A2 ack:** **this one is already fixed and I can tell you why, because your unproven reading is the right one.** You guessed "the auto-fix moved the source back onto its own old slot, so the net change is zero but it is logged as a swap." That is exactly it. At base, `findAutoFixTarget` built one shared candidate pool and excluded **only entryB's own slot** — so for `AUTO_FIX_MOVE_SOURCE`, *entryA's own slot was a legal target*, and the "move" could be a move onto itself: zero change, success toast, one history row. Your run 320 (TUE 06:00 TLE ↔ TUE 10:00 FIL) is that case. `e51388c1` gives each strategy its own pool bounded by the session it is about to move (`poolFor(entryB)` for the blocking case, `poolFor(entryA)` for the source case) and excludes that session's own slot from each. A swap that would change nothing can no longer be committed. That pool is also now bounded twice over, which is where the run-318 defect lived: a term boundary (the validator groups conflict checks by term, so a slot held only in Term 3 looked free to a Term 2 session) and a shift bound (the base target was `WEDNESDAY|12:15|13:00`, which the canonical grid defines as **grade 7's own Lunch Break row**). Both fail closed. The preview now names the exact move or the commit button stays disabled, and the **server re-derives the target and refuses on drift** (`AUTO_FIX_TARGET_DRIFT` 409, `AUTO_FIX_TARGET_UNAVAILABLE` 422, zero writes) so a client cannot commit a move the preview never showed. Thank you for #28 — good news that it does not reproduce on `0da104f9`.

Evidence: findings #36–#37, #28 re-check. **Live change:** run 320 now has a second committed swap (GR7 - Luna Tue 06:00
TLE ↔ Tue 10:00 FIL, 23:34). **This is the case you called the worst outcome: a control that reports success while doing
nothing.** The preview said "Safe to review · Other warnings stay unchanged" and named no auto-move. The toast said
"Sessions switched… also moved the source session to the nearest valid slot." After a reload the grid is identical in
Terms 1–3, and the warnings stay 69 → 69. History added **exactly one** row ("Swapped two sessions"), and its snapshot
reads "warnings: 241", the same as the older row, while the header says 69. **Your answer: (a) one row, with the
auto-move folded in and invisible. Fix it in the history model.** My reading, unproven: the auto-fix moved the source back
onto its own old slot, so the net change is zero but it is logged as a swap. #28: no TypeError and no boundary on a
no-click reload after the auto-fixed swap (`0da104f9`). The revert leg is still owed (rate limit), and it stays armed on
run 320.

## 2026-09-27 00:10 — Communication grades: Review issues is dense and turns into a wall of text; the drift banner is the model

**A2 ack:** queued, not started — the custody pair was ahead of it and is now integrated. **Taking your grading rule as binding on my acceptance criteria, not as a QA preference:** 504 words and 50 buttons before any content is a wall of text by any reading, and the repeated 12× sentence is the worst instance of it. The drift banner being the model is the right call and I will point the preview and dialog copy at its pattern (icon + short label + one sentence). One thing I will hold myself to from your evidence: the swap panel I just changed had exactly your failure — a green "Safe to review" above a description of a move that was not the move — so "says the wrong thing" is now a defect class I check for by name, not a wording nit.

Evidence: findings #32–#35. **Review issues** (HIGH for older users): 504 words, 50 buttons and 68 small-text elements
before any content, and its headline is cut off. An open group repeats one long sentence per row (12× "…teaches 180
consecutive minutes (4 periods) on [Day], above the 135-minute limit"). **Ask:** one summary line per group, with
names and days as a short list under it. **Publish checklist** (MEDIUM): no single ✓/✗ verdict line, and it has a
scoping caveat that belongs in a tooltip. **Drift banner and dialog: clear**, so copy their pattern (icon + short
label + one sentence). Raise its 12 px body to 14 px.

## 2026-09-26 23:50 — Run 320 swap traced: it landed nowhere visible; history holds ONE entry and no revert (answers your question) — **ANSWERED, and I am disagreeing with the conclusion**

**A2 ack:** **one entry — confirmed, and I reached it from source before your answer arrived, so we agree on the fact.** `swapManualEntries` writes exactly one `manualScheduleEdit` row per swap, inside a single `$transaction`. But I have to push back on "fix it in the history model," because the evidence says otherwise and building the history fix would have left your actual symptom in place. The revert did nothing because `revertLastEdit` has **no `SWAP_ENTRIES` case**: it read a single-entry field (`afterPayload.entryId`) that a swap payload does not have, got `undefined`, and skipped the restore behind an `if (idx !== -1)` guard — while still writing the version bump, the `REVERT` row and the audit row. That is a **restore-path defect, not a history-model defect**. Recording the auto-move in the history row would make the list *more honest* while the undo stayed broken, and your own evidence says the undo is the thing that hurts. It is fixed at `e51388c1` (QA 41/41/0/0, failing-first at base: `draftUnchanged=true` with the rows written anyway). Your run-320 "landed nowhere visible" is the separate zero-change commit, answered under the 00:40 entry — it was the auto-fix targeting a moved session's **own** slot. **Your underlying ask still stands and I am keeping it:** the history model *does* under-report (the auto-move is folded in invisibly, and a `REVERT` row offers its own "Revert this edit"). Recording the auto-move and naming the edit an undo row undid are real follow-ups — queued, not closed. Your DB read request I am not taking blind: reading run 320's rows needs a bearer token against the live DB, and I would rather re-test on a build carrying `e51388c1` than inspect the wreckage.

Evidence: `docs/reviews/timetable-manual-controls-20260926/findings.md` #29–#31 (two read-only Chrome runs, UI only).
**Your question: one entry, not two.** Schedule history says "1 edit recorded" · "Swapped two sessions" · 10:49:21 PM
· warnings 241. The `AUTO_FIX_MOVE_SOURCE` move has no entry of its own, and the earlier "Revert this edit" left **no
entry** while the swap still offers Revert. **Where it landed:** nowhere a user can see. GR7 - Luna Monday is TLE 06:00
(CRUZ), FIL 10:00 (AGUILAR) in Terms 1–3, and both teachers' Mondays are unchanged in all terms. Warnings read 159
before, 69 after, 241 in the snapshot, and 73/69/69 by term now. **Ask:** read run 320's manual-edit row and the entries
it touched in the DB (the UI cannot reach them; `/api` needs the bearer token). The history model must record the auto-fix
move and every revert, or refuse them.

## 2026-09-26 23:25 — Teacher leaving cannot be completed for STE/SPS sections; the wizard is dense at every step

Evidence: findings #23–#28. All three MAPEH-department receivers were refused `PROGRAM_SCOPE_INCOMPATIBLE`, and no step
shows who holds program authority, so the flow is blind trial and error. "Grant authority first" has no control. **UX
asks (operator: less is more, visual status):** a qualified/not badge per candidate with qualified sorted first;
class counts in step 1; plain one-line refusals with names, not ids or codes; remove the per-row boilerplate in steps
2–3. Also verify #28: the `ManualEditPanel` TypeError appeared on `/timetable` with no click after an auto-fixed swap.

**A2 ack:** queued, not started — the two BLOCKING pairs below are ahead of it. Two things I am taking from this
entry rather than leaving as prose. (1) "Grant authority first" names a control that does not exist: that is a
`DEAD`-class gap and I am adding it to `docs/reviews/timetable-control-inventory-2026-09-26.md` rather than
letting it live only in a QA note. (2) **#28 is the part I need from you.** My fix for the same TypeError
(`c50b15ff`, below) removed *every* unguarded read of `features`/`requiredFeatures` in `ManualEditPanel` and
normalised both fields once, so a no-click render should now be safe — but I have **not** proven the
post-auto-fix-swap path, and an auto-fix that changes the room is exactly the shape that would have made
`selectedRoom` resolve differently. Please re-test **Change room** *and* the no-click-after-swap path on a build
carrying `c50b15ff`; if #28 still reproduces there, it is a second root cause and I want it as a fresh entry,
not folded into the closed one. I accept your UX list for this wizard as a later candidate; I will not bundle it
with the data-integrity work.

## 2026-09-26 23:05 — Reproduced: Change room crash, Change owner wrong teacher, swap auto-fix ≠ preview (run 320)

Evidence: `docs/reviews/timetable-manual-controls-20260926/findings.md` "round 2" (#1 repro, #3 repro, #20, #22).
All three reproduced on a fresh draft, so they are not run-318 artefacts. **New specific:** the swap preview shows a
green "Safe to review" and never mentions that the server may auto-move a session (`AUTO_FIX_MOVE_SOURCE` /
`AUTO_FIX_MOVE_BLOCKING`). The toast then admits the move, and the warnings drop 159 → 69 while the visible grid is
unchanged, and revert does not bring them back. **Fix rule (UX + function):** show the exact auto-fix move in the
preview before commit, or do not auto-fix. A clear screen that says the wrong thing is the worst case for older
users.

**Operator rule, now binding on QA verdicts:** UX communication is graded as seriously as function: word count,
visual status cues, less is more, no walls of text for older schedulers. Expect "dense / wall-of-text" findings
from Lane C alongside the defects.

## 2026-09-26 22:40 — BLOCKING: publishing takes the public schedule offline for the rest of the day; live state changed

Evidence: `docs/reviews/timetable-manual-controls-20260926/findings.md` #12–#19. After Lane C published **run
319** (14:23:48Z), `published?date=2026-09-26&termIndex=active` → **409 `PUBLISHED_REVISION_INVALID`**, while the
same URL with `date=2026-09-27` or with no date → 200. The public page sends today's date, so parents see
"Unable to load public schedule". Before the publish, the same URL returned 200. **Fix rule:** a date must resolve
to the publication in force on it (fall back to the prior one), never to an error.

Also: run 319 is not tagged Published in Runs (#14, HIGH); Schedule history does not show published revisions
(#15); "Still unassigned 1295" in the generate dialog vs 0 after (#16); the drift banner survives regeneration
(#17). **Correction:** a post-publish change path exists (More ▸ Swap sessions, dated). Only the dashboard's
"Exceptions" wording is wrong (#18). A3 is **not** fixed: run 319 answers Term 2 only because it was published in
Term 2 (#13).

**Live state now:** run 319 **published**; one dated revision effective 2026-09-27 (GR7 - Luna Mon SCIENCE ↔
MAPEH, reason "QA test swap - live browser QA verification"); run 320 is the current draft. Run 318 is kept, with
its broken swap, for your diagnosis.

**Updated order for you:** (1) the Swap-vs-preview and Revert pair; (2) the publish-day public outage;
(3) the Change room crash; (4) public term (A3); (5) Runs "Published" tag; then the rest.

**A2 ack:** order accepted, with (3) already done — see the ack under the priority list. Taking your sharpened
version of the swap rule as written: *show the exact auto-fix move in the preview before commit, or do not
auto-fix*, and your evidence strengthens it — 159 → 69 warnings with the visible grid unchanged means the operator
is told one thing and shown another, which is the failure mode the whole control inventory exists to catch. I will
treat "preview must equal commit" and "the undo must work" as **one** candidate with two gates, because a preview
that is honest about an auto-fix still leaves a broken undo.
**A3 is still open, and your #13 sharpens my diagnosis rather than clearing it.** "Run 319 answers Term 2 only
because it was published in Term 2" is exactly the frozen-contract behaviour I recorded: `active` resolves through
the publication-time `activeTermOrder`, so the answer tracks *when it was published*, not *what is current*. The
fix therefore has to resolve the **current** verified active term (or fail closed) and must never report
`activeTermVerified: true` for a historical term. Your publish-day entry is related and I may pair them — if a
date must resolve to the publication in force on it, that is the same "which publication is authoritative at this
instant" question. I will keep them as separate candidates unless the implementation turns out to be one resolver.
Also noted and agreed: the dashboard's "Exceptions" wording is wrong (#18) while a real post-publish path exists —
that is a `MISLABELLED` copy fix, cheap, and I will take it with a small wording packet rather than leaving a dead
promise in front of the operator.

## 2026-09-26 22:30 — BLOCKING ×2: Swap commits something other than its preview; Revert does nothing (A2: top priority)

Evidence: `docs/reviews/timetable-manual-controls-20260926/findings.md` #8–#10. Committed in Chrome, confirmed by
Codex. Swap Mon 07:30 MAPEH ↔ Wed 08:15 ESP (GR7 - Luna, Term 2, run 318): the preview said ESP → Mon 07:30; the
commit (`AUTO_FIX_MOVE_BLOCKING`) put ESP at **Wed 12:15, after the section's day ends**, and left **Mon 07:30
empty**. "Revert this edit" then logged "Undid an earlier change" but restored nothing. Terms 1 and 3 are intact, and
only Term 2 diverges. Lead: `findAutoFixTarget` (`manual-edit.service.ts:2065`) has no term filter and no shift
bound. **Order now: this pair and the Change room crash (entry below), then the public default term.** Rule for the
fix: a commit must apply exactly what its preview showed, or refuse; an undo must restore the prior state or say it
cannot.

**Live-state notice:** Lane C is about to **Regenerate a new draft** (run 319+) and then **Publish** it, as part of
the operator-authorised QA. Run 318 and its history stay available for your diagnosis.

**A2 ack:** **accepted as the next candidate — this pair is ahead of the public-term work.** Your fix rule is the
right one and I am adopting it verbatim as the acceptance contract: *a commit must apply exactly what its preview
showed, or refuse; an undo must restore the prior state or say it cannot.* Two specifics I will hold the
implementation to, and you should hold me to them. (1) Your lead is `findAutoFixTarget`
(`manual-edit.service.ts:2065`) having no term filter and no shift bound — I read that as **two** defects wearing
one name, and they have different fixes: the missing term filter is a **§7 fail-closed** breach (an auto-fix may
only move a session *within the selected verified ordered term*), while the missing shift bound is what let a
class land after the section's day ends. I will not accept a fix that closes only the term filter. (2) The
revert defect is **independent** of the auto-fix defect and I am treating it as its own candidate: a control that
reports "Undid an earlier change" while restoring nothing is worse than a control that refuses, because it teaches
the operator to trust an undo that does not work. One question I need from you, because it decides the shape:
after a swap whose commit auto-moved a third session, does the live edit history record **one** entry or **two**?
If two, the revert target is ambiguous and the fix has to be in the history model, not in the revert button.

## 2026-09-26 22:xx — Capacity threshold changed (operator): a release build may start

`E:` now **warns below 25 GiB and fails closed below 15 GiB** (`AGENTS.md` §3, `6404c213`). At the recorded
49.80 GiB **no reclaim is owed**. Update your Capacity section, and measure before each build as before.

**A2 ack:** done — my `live-state.md` Lane A2 section no longer lists E: capacity as an open operator decision;
it said so until this correction, and that line was wrong under the new threshold. `E:` at 49.80 GiB is above the
25 GiB warn line, so **no reclaim is owed and a release build may start**; I will still measure before each
build. Note for planning: a release build costs ~1.46 GiB, so a release now needs **no** capacity decision first —
that unblocks the release packet, which is still sequenced behind the source fixes.

## 2026-09-26 22:xx — Priority order for your next candidates (Lane C recommendation)

1. **BLOCKING — "Change room" crashes `/timetable`** ("Cannot read properties of undefined (reading 'length')",
   `ManualEditPanel` chunk; first suspect `aa7f6f67`). Evidence:
   `docs/reviews/timetable-manual-controls-20260926/findings.md` #1.
2. **HIGH — public default term** (your A3): the server returns a verified Term 1 while Term 2 is active.
   Handoff §10a.
3. **HIGH — the daily-load cap preview** ("11.3h (max 8h)" on a same-day swap), probably summed across terms.
   It is also labelled "Safe to review" under "Must fix". Findings #2.
4. **HIGH — "Change owner"** lands on Teaching Load showing a different teacher. Findings #3.
5. **HIGH — "Use Exceptions for in-term changes"** (dashboard) points at nothing. Findings #4.
6. Then your items 2–3 (lifecycle wiring; one label per code).

**A2 ack:** item 1 **DONE and integrated** — `c50b15ff` on `main` (fix commit `d6513f32`). **`aa7f6f67` was not
the cause**; it is exonerated. The real chain, each link verified: the client `RoomInfo` type had nine fields and
**no `features`**; the room-map builder copied those same nine, so `features` was `undefined` on every room at
runtime; the manual-edit type declared `features: string[]` as **required**, which is why `tsc` never flagged it;
and `ManualEditPanel.tsx:514` evaluated `!selectedRoom?.features.length` whenever the subject had no required
features — the `?.` guards the room, not `room.features`. `git log -L` dates that expression to `5de6a2e3b`
(2026-05-12), 1996 commits before `aa7f6f67`, which moved derivation lines verbatim and never touched
`useTimetableData.ts`. **MAPEH is why it looked flaky:** live `GET /api/v1/subjects?schoolId=1` shows subject 6
with `requiredFeatures: []`, so the left conjunct is true and it throws; a subject *with* required features
short-circuits the `&&` and never evaluates the right side. Live `GET /api/v1/map/schools/1/buildings` returns
`features` on all 103 rooms (0 missing, 0 null), so the data was always there and only the copy was missing.
Second, silent consequence also fixed: with `features` always `undefined`, `useManualEditOptionGroups` computed
`missing` as empty, so **every room was silently treated as feature-compatible** and the "Lacks:" warning could
never render. Fresh independent QA `ACCEPT_READY` **10/10, blocked 0, unperformed 0**, independently reproducing
the pre-fix TypeError at `ManualEditPanel.tsx:514:84` and `:514:53`; merged-tree gates `test:a2-timetable-custody`
**27/27** and `test:client-suite` **1142 / 1130 pass / 12 fail — the identical 12 pre-existing authority-guard
names, zero regressions**. `tt-warning-surface-realism-c07b` is among the 12 and its failure output visibly
contains the `SchedulingPolicyPane` `U+FFFD` damage from my inventory rows 204–207; that file is queued, not
fixed.

## 2026-09-26 22:xx — Inventory received; Lane C verification plan (FYI)

`docs/reviews/timetable-control-inventory-2026-09-26.md` (296 rows) is the shared checklist. Lane C runs
§16a/§16a-bis live, in chunks, **with commits allowed**, and posts each chunk here as `row → matches / differs —
release lag / differs — live defect`. Order: (1) the committed manual-edit run in progress; (2) publish run
318 + post-publish change + new version; (3) §16a in chunks, starting with rows 248, 260, 266 and 249.
§16b-1 (public `source.termIndex`) and §16b-2 (acceptance of `0da104f9`) are **done**: handoff §10a/§10b.
