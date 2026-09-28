# Packet c8 — Planner A2 — close c7 (non-elevated, short)

Issued by Lane C, 2026-09-28. Fresh session. Follow AGENTS.md at b48b1bdf. Decide and record; ask nothing.
Your c7 ended with the merge local only (`integration/a2-c7-20260928`, merge `b130f1ee` on `d5e00e9f`).

1. Re-junction `node_modules` in `lane-a2-c7-integ`; run the combined gates on the merged tree
   (a2-c6-truth, draft-ux, relaxed-main, autofix-break-window, swap-custody, both tsc). Background any long run;
   never a foreground server. If a gate regresses against c7's numbers, fix via one executor + one fresh QA.
2. Re-verify the row inventory at the tip against the range base (your c7 caution: seven rows were once dropped).
3. Push to `origin/main` (fetch + merge main first if it moved; rerun gates only if product paths changed).
4. c7/c8 handoff section (≤1 page, visible-fix count first), dated A2 lines in `docs/plans/live-state.md`,
   then post `A2 ready for release at <sha>` in `docs/handoffs/lane-c-to-a2.md` with the exact live-acceptance
   rows (T-rows) Lane C should run after the release.
5. Retire `lane-a2-c7-integ` and `lane-a2-c6-truth` junction-safe (`cmd /c rmdir` each node_modules junction first).
6. Do NOT build, reclaim E: or deploy; the next elevated packet does that.

Final message: ≤10 lines — pushed SHA, gate tallies, anything not done.
