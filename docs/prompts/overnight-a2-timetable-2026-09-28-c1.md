# Overnight packet c1 — Planner A2 (timetable) — 2026-09-28 00:10 +08 → 06:30 +08

Issued by Lane C (overnight manager) after reviewing c0 (`overnight-a2-timetable-2026-09-27.md`, session
`ses_f1ccfb677ffe2OdBUU7IleK4hV`; verdict in `docs/handoffs/lane-c-to-a2.md` → "Lane C review of A2 c0").
**Operator authorization, in chat with Lane C, 2026-09-27: "go, deploys authorised overnight"; drafts and publish
authorized; live data is test data.** The operator is asleep: nobody will answer a question tonight. Where this packet
says decide, decide, record why in your handoff, and keep going. Stop only at a real blocker, recorded as
`BLOCKED(<reason>)` with evidence.

**Demo: Wednesday 2026-09-30.** Older, mouse-first schedulers. UX weighs as much as function.

## Efficiency — read this twice (c0 hit the 120-step cap with four deliverables unwritten)

- **Keep each planner turn efficient: 120 steps is the cap.** Delegate every implementation to an `atlas-executor`
  (one candidate each), every MEDIUM QA to `atlas-qa`, every HIGH pre/post review to `atlas-reviewer-high`, every
  browser pass to one runner with exact steps. The planner decides, integrates, records.
- **Do not spend planner steps reading large files you do not need** (`live-state.md` is 3 000+ lines: read the
  `## Live release` and `## Lane A2` sections by line range only; `findings.md` via `grep -n`, not whole).
- **Write deliverables as you go**, not at the end: after (a) is LIVE, write (b) immediately and push. If you reach
  step ~100 with work left, stop starting new items and finish the handoff.

## State at issue (verified by Lane C, 2026-09-28 00:00 +08)

- **LIVE `c0d91827`**: machine `ATLAS_RUNTIME_RELEASE_SHA=c0d91827…`, source dir `lane-a2-release-c0d91827`; served
  `index-WFjDBxxH.js` matches its `dist`; audit `C:\ProgramData\ATLAS\release-audit\c0d91827-20260927-224517`,
  incumbent/rollback basis **`9b28c572`** (dir retained). Health ok; public matrix 09-20/25/26/27/28 → runs
  315/317/319/320/320, rev 42/43/44/46/46, fallback T/T/T/F/F, no 409.
- **`docs/plans/live-state.md` → Live release still says `9b28c572` LIVE. That record is false and must be fixed
  first** — `deploy-runner.ps1` `Assert-LiveReleaseRecorded` also needs the next target named in that section.
- `origin/main` = `a56ac86d` (A2 batch `c35ee9f2` + A3 `1e417694`), built in `lane-a2-release-a56ac86d`
  (`index-CIHphcTQ.js`), **not deployed**. Its packet `docs/prompts/a2-release-a56ac86d-2026-09-28.md` exists only
  **uncommitted** in `lane-a2-docs-20260928`.
- The item-2 QA tally (ACCEPT_READY 8/8/0/0) is **not recorded on `origin/main`** — only in your c0 session. Record it.
- E: has **35 GiB free** (threshold 25). Release dirs `0da104f9`, `b0736007`, `c5a9e832` are neither live nor
  rollback: retire them with `atlas-worktree-reclaim` before any new release build.

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

- **A3 runs in parallel** (`docs/prompts/overnight-a3-ui-ux-2026-09-28-c1.md`) on non-timetable surfaces, disjoint
  files per `planner-a3-non-timetable-ui-ux-handoff.md` → Ownership boundary. A3 will post
  `A3 integrated for release at <sha>` in `lane-a-to-c.md` (target by 04:30 +08).
- **Browser custody, one agent per profile (§12):** before any browser session create `E:/ATLAS-worktrees/.browser-lock`
  containing `A2 <ISO time> <purpose>`. If it names A3 and is younger than 45 min, do other work and retry. Delete it
  when done; older than 45 min is stale — overwrite and say so. Lane C runs no browser tonight. (At issue the lock is
  A3's, written 2026-09-27T23:49:59+08:00.)
- **You own every deploy tonight**, including A3's integrated work. Before a cutover, enumerate the range and name
  A3's commits in it.
- **#3 residual belongs to A3:** your `c35ee9f2` emits `returnTo` but `TeachingLoad.tsx` (A3's) never renders the way
  back. Post the request in `lane-a-to-c.md` with the exact prop contract.

## Queue, in order — each item ends integrated on `main` with its QA verdict, or `BLOCKED` with evidence

**(a) Release the current `origin/main` tip (HIGH).** Pin the tip at the moment you start (`git rev-parse origin/main`;
record it) — it must carry your item-2 batch **and** A3's `1e417694` and any later A3 integration line. Commit the stale
`a2-release-a56ac86d-2026-09-28.md` as history marked `SUPERSEDED by <tip>` (unless tip == `a56ac86d`, then it is the
packet: refresh it). Fix the Live release block first (c0d91827 LIVE, rollback `9b28c572`; next target `<tip>`,
rollback `c0d91827`), push, then: pre-action review → `deploy-runner.ps1` dry run → `-Execute` → D1–D12 (D5b zero-write
window counts) → **live browser acceptance on the Tailnet origin**: your item-2 rows (#57/#44 wording in dialog, toast,
checklist and badge; second swap persists a notification row; #2 no cross-term daily-load sum; #3 Change owner lands on
the right teacher; #41/#51 run line and badge on a Draft and on a Published run), plus **A3's 9 steps** in
`planner-a3-non-timetable-ui-ux-handoff.md` → "Rows needing live acceptance" (B5 included; #52 stays `UNPERFORMED`
unless actually performed). Real tally, evidence paths.

**(b) The four c0 deliverables, immediately after (a):** handoff
`docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md` with the **reconcile table** (#1–#64 + inventory
§16a/§16a-bis non-OK rows → `LIVE_VERIFIED` / `FIXED_NOT_LIVE <sha>` / `OPEN` / `WONTFIX <reason>`; delegate the
grep-and-classify to an executor/search agent), the item-2 QA tally, both releases; `**A2 ack:**` lines in
`lane-c-to-a2.md` (#53 → A3, #56–#59, #61–#64, the A3 hand-back, and this packet); `live-state.md` Lane A2 section and
Live release block dated. Push. Update all three again at the end.

**(c) #62 root cause** (159 → 68 → 69: swap + revert not net-neutral on warnings). Find the cause from source + one
reproduction; fix it, or make the UI say what the number is if it is not a pure function of entry slots. **D10
stale-selection sub-row** with **two browser contexts** in your own profile (one armed in swap selection, one
committing a swap that moves that class): record the notice text and whether the selection releases.

**(d) Older-user UX batch, in full (MEDIUM; grade by fewer words, one verb per action, a visual cue beside every
status):** #49, #50, #56, #58, #59 + #17, #43, #55, inventory rows 37 / 40 (hand to A3 if theirs) / 46, and the #64
Redo tooltip → "Nothing to redo." **Plus Lane C's grading of your own item-2 wording** (truthful, but engineer-ish):
- U1 header prints **"Run: Run 321 · Draft"** (`ScheduleReviewWorkspaceHeader.tsx` label + `runStateSentence`) —
  doubled word, and "run" is jargon. Say what it means: e.g. "Draft — teachers cannot see it yet" /
  "Published — everyone can see it", number secondary.
- U2 the state badge has **one colour for Draft and Published** — add a distinct icon + colour per state.
- U3 generate dialog adds a **35-word note** to explain two numbers; badge "weekly sessions not yet placed"; checklist
  "N sessions this run could not place must be placed before…" is ungrammatical. Aim for: dialog "Classes to schedule:
  1295" (no note); after a run "All classes placed ✓" or "12 classes need a time slot"; checklist "12 classes still
  need a time slot." Pick one noun (class vs session) for the whole timetable and use it everywhere.
- U4 notification "Generation run #N completed with N session(s) this run could not place." → plain, e.g.
  "New schedule ready. All classes placed." U5 "Planning draft — no generated run yet" → "No schedule made yet."

**(e) Timetable demo-walkthrough script.** Write `docs/reviews/demo-walkthrough-timetable-2026-09-28.md`: the
operator's path — generate → review → fix a conflict → swap / move → undo → publish → public view → exports — each step
with the exact clicks, what the screen must say, and a grade (words on screen, clicks, hunts, visual cue). **Walk it live**
on the Tailnet origin (generate and publish are authorized; read the public matrix before/after publish). Every
stumble is fixed in this packet or listed with its owner and a proposed fix. This is the demo; treat it as P0 after (a).

**(f) A3 term contract (test, not live):** staged term contract whose active term differs from the publication's;
assert `/timetable` header term and public `source.termIndex`.

**(g) Second release by ~05:30 +08 (HIGH)** carrying everything integrated since (a), including A3 c1 work (if A3 has
not posted its line by 04:30, release without it and say so). Full gates, cutover, D-rows, then live browser acceptance
for every row fixed since (a) plus A3's listed rows. Real tally. If (g) cannot finish by 06:00, do not start the
cutover: stage, record, hand off.

Keep going until 06:30 +08, then finish the handoff.

## Deliverables (Lane C reads these when your run ends)

1. `docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md`: reconcile table; per item candidate SHA, merge SHA, QA
   verdict + tally; each release SHA and state (`LIVE` / `STAGED BLOCKED(...)`), rollback basis; browser tally with
   evidence paths; the walkthrough grade; every `BLOCKED` with evidence; what the morning must do, in order.
2. `**A2 ack:**` lines in `docs/handoffs/lane-c-to-a2.md` (see (b)).
3. `docs/plans/live-state.md` Lane A2 section and Live release block updated and dated.
4. Everything pushed to `origin/main`; nothing left only in a worktree.

Your final message: ≤ 15 lines — done / blocked / not reached per item (a)–(g), live release SHA, rollback basis,
browser tally, handoff path.
