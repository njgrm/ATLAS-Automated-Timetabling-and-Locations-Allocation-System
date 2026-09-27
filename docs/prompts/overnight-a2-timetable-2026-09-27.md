# Overnight packet — Planner A2 (timetable) — 2026-09-27 22:00 +08 → 2026-09-28 07:00 +08

Issued by Lane C (overnight manager). **Operator authorization, in chat with Lane C, 2026-09-27: "go, deploys
authorised overnight"; drafts and publish authorized; live data is test data.** The operator is asleep: nobody will
answer a question tonight. Where this packet says decide, decide, record why in your handoff, and keep going. Stop
only at a real blocker, recorded as `BLOCKED(<reason>)` with evidence.

## Authority

- **Standing HIGH authorization** (`live-state.md` → Operator decisions, 2026-09-20) plus tonight's explicit deploy
  authorization: deploy, generation, publication and live-data writes without a round-trip, **with every gate
  retained** (pre-action review, one executor per candidate, fresh post-action QA, labelled browser rows, real
  `passed/blocked/unperformed` tally, recorded rollback basis). Standing authorization removes waiting, never evidence.
- You run **elevated** (admin `opencode serve` on 127.0.0.1:4097), so the cutover is possible. If it still fails on
  elevation, stage fully, record `BLOCKED(ELEVATION)` and continue.
- **Publishing:** allowed. Post run id, revision and time to `docs/handoffs/lane-a-to-c.md`, and read the public matrix
  (`/api/v1/schools/1/schedules/published?date=` 09-20/09-25/09-26/09-27/09-28) before and after. No 409, fallback true
  for dates before the new revision.
- Out of bounds: EnrollPro/SMART/AIMS writes (READ_ONLY), `ATLAS_SYSTEM_TOKEN` rotation, pushing
  `fix/committed-credential-scrub-20260926`, history rewrites, removing anything outside your own retired worktrees.
  **E: capacity (§3):** check before any release build; below 25 GiB fail closed.

## Coordination

- **A3 runs in parallel** on non-timetable surfaces (`docs/prompts/overnight-a3-ui-ux-2026-09-27.md`), disjoint files
  per `planner-a3-non-timetable-ui-ux-handoff.md` → Ownership boundary. **BuildingView / campus-map utilisation (#52,
  #53) is A3's tonight.**
- **Browser custody, one agent per profile (§12):** before any browser session create `E:/ATLAS-worktrees/.browser-lock`
  containing `A2 <ISO time> <purpose>`. If it names A3 and is younger than 45 min, do other work and retry. Delete it
  when done; older than 45 min is stale — overwrite and say so. Lane C runs no browser tonight.
- **You own every deploy tonight**, including A3's integrated work. Before a cutover, enumerate the range and name
  A3's commits in it.

## Queue, in order — each item ends integrated on `main` with its QA verdict, or `BLOCKED` with evidence

**0. Reconcile (one pass, source + live).** In your handoff, one table: every finding in
`docs/reviews/timetable-manual-controls-20260926/findings.md` (#1–#64) and every non-`OK` row of
`docs/reviews/timetable-control-inventory-2026-09-26.md` §16a/§16a-bis → `LIVE_VERIFIED` / `FIXED_NOT_LIVE <sha>` /
`OPEN` / `WONTFIX <reason>`. Do not re-fix what is fixed. This table is the night's scope.

**1. Release what is already on `main`** (`af1451a3`/`b289bc05` single Undo + strategy validation, `d1bf04a1`,
A3's `16961054`) — packet, pre-action review, cutover, D-rows, live browser acceptance. Early, so later QA runs on it.

**2. Truthfulness defects (HIGH), in order:**
- **#57/#44** — one meaning and one number for "unassigned" across generate dialog, finish toast and publish checklist
  ("1295" vs "0").
- **Notification dedupe collision** (your 20:59 trace): the key omits `editId`, so every swap on a run by one actor
  after the first is silently dropped by `skipDuplicates`. Fix; prove a second swap persists a row.
- **#62** — 159 → 68 → 69: swap + revert is not net-neutral on warnings though the entry set round-trips. Find the
  cause; fix it, or make the UI say what the number is if it is not a pure function of entry slots.
- **#2** — "Daily load hard cap 11.3h (max 8h)" on a same-day swap (load summed across terms). **#3** — "Change owner"
  lands on `/teaching-load` showing a different teacher, with no way back.
- **#51** — Expert labels a published run "Draft". **#41** — the screen never says which run, and whether it is Draft or
  Published; add one plain line.
- **D10 stale-selection sub-row** — prove it with **two browser contexts** in your own profile (one armed in swap
  selection, one committing a swap that moves that class). Record the notice and whether the selection releases.

**3. Older-user UX (MEDIUM; grade by fewer words, one verb per action, a visual cue beside every status):**
#49 ("Advanced rules" strands users in Expert; the way back is a 12 px button), #50 (More menu is a 510 px scroll box
hiding two-thirds of its items), #56 (New version / Generate / Generate schedule → one verb), #58 (three toasts for one
generate), #59 + #17 (stale drift banner right after generating; unexplained 69 → 159 jump), #43 (generate dialog 116
words; "Actor school year", "Term authority: Saved ATLAS data"), #55 (bare warning triangle; screen reader counts one
issue twice), inventory row 37 (tutorial names a menu path that does not exist), row 40 (`/faculty/concerns` shows the
class grid; hand to A3 in `lane-a-to-c.md` if it is theirs), row 46 (Refresh school names gives no feedback), #64
remainder (Redo tooltip "This undo cannot be undone. This control is inert…" → "Nothing to redo.").

**4. A3 term authority** (handed back 2026-09-27 08:00): staged term contract whose active term differs from the
publication's; assert `/timetable` header term and public `source.termIndex`. In a test, not on live.

**5. Second release** once 2–3 are integrated and A3 has posted "A3 integrated for release at <sha>" in
`lane-a-to-c.md` (if A3 has not by 04:30 +08, release without it and say so). Full gates, then **live Tailnet browser
acceptance** for every row you fixed tonight plus every A3 row they list for live acceptance. Real tally.

**6. If time remains:** untested inventory rows by risk (§16a order), then timetable-owned `UX-R03c` (`/timetable/runs`).
Keep going until 06:30 +08, then write the handoff.

## Deliverables (Lane C reads these when your run ends)

1. `docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md`: the reconcile table; per item candidate SHA, merge SHA,
   QA verdict + tally; each release SHA and state (`LIVE` / `STAGED BLOCKED(...)`), rollback basis; browser tally with
   evidence paths; every `BLOCKED` with evidence; what the morning must do, in order.
2. `**A2 ack:**` lines in `docs/handoffs/lane-c-to-a2.md` for #53 (→ A3), #56–#59, #61–#64 and the A3 hand-back.
3. `docs/plans/live-state.md` Lane A2 section and Live release block updated and dated.
4. Everything pushed to `origin/main`; nothing left only in a worktree.

Your final message: ≤ 15 lines — done / blocked / not reached, live release SHA, handoff path.
