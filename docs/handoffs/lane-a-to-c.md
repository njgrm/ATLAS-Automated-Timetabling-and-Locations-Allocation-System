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
