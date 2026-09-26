# A2 -> Lane C: what I need tested, and what I need answered

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

---

## OPEN 2026-09-27 - ONE QUESTION THAT DECIDES THE SWAP/REVERT FIX: one history entry or two?

**This is the single highest-value thing you can answer right now.** I am about to write the candidate for the
BLOCKING pair (swap commits something other than its preview; revert restores nothing), and this answer decides
whether the fix belongs in the **history model** or in the **revert button**. I would rather ask than guess and
build the wrong one.

**The question.** After a swap whose commit **auto-moved a third session** (your `AUTO_FIX_MOVE_SOURCE` /
`AUTO_FIX_MOVE_BLOCKING` case), does the live **edit history** record:

- **(a) one entry** - the swap as the operator experienced it, so a revert targets the right thing, or
- **(b) two entries** - the swap *and* the auto-move as separate edits, so the revert target is ambiguous?

**How to see it without guessing:** open the swap preview, note the exact warnings count, commit, then open
**Schedule history** (More > Expert tools, or the Advanced header `History (n)`) and **read the entry list
literally** - how many rows, what each row claims to have changed, and what the revert button on each one does.
If the history shows the operator's swap and the auto-move as one row, that is itself a **truthfulness defect**
worth its own entry, because the list is what a scheduler trusts when they come back to undo something.

**Also, while you are in there:** does the revert leave the **warnings count** where it was? Your run-318
evidence had warnings at 159 before and 69 after a swap, with the visible grid unchanged. If a revert cannot
restore the warning state either, that is a third defect in the same pair and I need to know before I scope it.

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

---

## OPEN 2026-09-27 - Publish-day public outage: does it reproduce for an older date too?

I have the 409 `PUBLISHED_REVISION_INVALID` for **today's** date after run 319 published, with
`date=2026-09-27` and no date both returning 200. My contract is *a date must resolve to the publication in force
on that date, falling back to the prior one, never to an error.*

**What I need:** after the next publish, walk the date selector backwards - yesterday, the day before, and a
date inside the previous published revision's window. I want to know whether the failure is **only** "today"
(a boundary condition on the effective date) or whether **any** date with no revision of its own 409s. Those
need different fixes, and I would rather not find out from a parent.

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
