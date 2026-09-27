# Overnight packet c2 — Planner A2 (timetable + releases) — 2026-09-28 00:45 → 06:30 +08

Issued by Lane C (overnight manager). The Authority and Coordination rules of
`docs/prompts/overnight-a2-timetable-2026-09-28-c1.md` apply unchanged (elevated; deploys, drafts and publish
authorised; every gate retained). The operator is asleep: decide, record, keep going. **Keep planner turns lean
(120-step cap): delegate implementation to executors and QA to atlas-qa; read only the file sections you need.**

## Browser custody tonight — scheduled, not contended

**A3 holds the browser until 02:45 +08** (its browser rows were blocked all of c1). **Do not take the lock before
02:45.** Do source-only work until then. From 02:45 the browser is yours: write `.browser-lock` as usual.

## Lane C review of your c1 (00:40): accepted

`d31bfacb` is live; health 200; public matrix 315/317/319/320/320, fallback T/T/T/F/F. Handoff, acks and register
are done. **Carry forward the wording review from Lane C's c0 review:** "Run: Run 321 · Draft" says "Run" twice;
the Draft and Published badges share one colour (Published should read as the settled, calm state and Draft as
work-in-progress); the generate dialog's added 35-word note is too long for older users; the publish-checklist
sentence is ungrammatical. Fix all four in item 2.

## Queue, in order

1. **Reclaim (now, cheap):** retire `lane-a2-release-0da104f9`, `-b0736007`, `-c5a9e832`, `-a56ac86d` per your
   handoff §1.3 (`atlas-worktree-reclaim`, lifecycle doc). Keep `d31bfacb`, `c0d91827`, `9b28c572`.
2. **Item (d), the older-user UX batch, source-only until 02:45:** #49, #50, #56, #58, #59 + #17, #43, #55, rows 37,
   40 (or hand it to A3), 46, the Redo tooltip, #51 (not disproven live), plus the four wording items above. Grade by
   fewer words, one verb per action, a visual cue beside every status, less is more. One consolidated stream per
   surface, one executor each, one fresh QA.
3. **#62 root cause** (your handoff §6 lead). Fix it, or make the UI say what the number is.
4. **From 02:45, browser:** the D10 grid-gesture half and the stale-selection sub-row (two contexts in your
   profile); then the **timetable demo walkthrough** (generate → review → fix a conflict → swap/move → undo → publish
   → public view → exports), walked live and graded for older users, with every stumble fixed or listed.
5. **Release at ~04:30 +08**, re-pinned to the `origin/main` tip at that moment. It must carry item 2–3 work, A3's
   `c5cffa72` and `dd5b2366`, and any later A3 integration posted by 04:15. Full gates, cutover, D-rows, then live
   acceptance for every row fixed tonight plus A3's listed rows. Real tally.
6. A3 term-contract test (item f), if time remains.
7. Deliverables before 06:30: append a c2 section to `docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md`
   (per-item SHAs, QA tallies, release state, browser tally, what the morning must do); acks in `lane-c-to-a2.md`;
   `live-state.md` Live release + Lane A2. Everything pushed.

Final message: ≤ 15 lines — done / blocked / not reached, live release SHA, handoff path.
