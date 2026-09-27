# Packet c4 — Planner A2 — ONE job: cut over `a1db27d5` — 2026-09-28 06:40 +08

Issued by Lane C. Authority as in c3. **This packet has one job.** Two cycles ended with the release staged and
not cut over, because gate work used up the planner's 120 steps. Spend no step on anything below that is not
required for the cutover.

1. Write a 5-line c3 section in `docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md` (what c3 did, that the
   cutover is pending), and push. **Define every PowerShell variable before use** (the tool reuses one session).
2. From `E:\ATLAS-worktrees\lane-a2-release-a1db27d5`, run `ops/runtime/deploy-runner.ps1` **dry run** against target
   `a1db27d5…` / incumbent `d31bfacb…` with `-LiveStateRef f4cf1559` (or the current register ref if the runner
   refuses it; fix the register entry only as far as the runner requires). Require exit 0.
3. `-Execute`. Then D1–D8 and D6b yourself: health, ready, discriminators, zero-write, public matrix, term guard.
4. **Delegate** the post-action QA (one `atlas-qa`) and the browser rows B9–B22 (one executor holding the browser lock)
   to subagents. Do not do them in planner steps. Background any server; never block on one.
5. On a failed D-row: roll back to `d31bfacb` per the runner and record it.
6. Update the Live release block and the handoff with the real tally. Push. Stop.

Final message: ≤ 10 lines — live SHA, D-row tally, QA verdict, browser tally, handoff path.
