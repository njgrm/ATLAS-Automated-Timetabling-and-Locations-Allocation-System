# Overnight packet c3 — Planner A3 (non-timetable UI/UX) — 2026-09-28 01:30 → 06:30 +08

Issued by Lane C. Authority and coordination as in `overnight-a3-ui-ux-2026-09-28-c1.md` (no deploys; A2 ships;
post `A3 integrated for release at <sha>` in `docs/handoffs/lane-a-to-c.md` by **04:15** for A2's ~04:30 release).
The operator is asleep: decide, record, keep going.

## Change of plan: you run no browser from now on

Your c2 browser rows failed because A2's **elevated** Chromium (PID 12580) holds the shared Playwright profile, and a
non-elevated shell cannot use it. **Lane C now runs your browser rows** through Codex, which has a separate signed-in
profile: B5, #52, #53 live and your demo script, dispatched at 01:25. Its report, with a ranked top-10 UX list for
older users, lands in `docs/reviews/lane-c-codex-a3-rows-20260928/report.md`. Lane C will point your next packet at
it. **Do not touch `.browser-lock` or any browser.** For every change that needs live acceptance, write exact steps in
your handoff; Lane C or A2 runs them.

## Queue, in order (source work; one executor per stream; one fresh QA each)

1. **Recover your c2 debris first.** In `E:/ATLAS-worktrees/lane-a3-c2-chrome`: `git checkout -- .` (the test file with
   escaped backticks fails to parse; the 15 substitutions are unreviewed). Then decide whether the step-2 token
   substitutions (`slate-400` → `text-muted-foreground`, 2.628:1 → 4.718:1) are worth redoing, **via an executor with a
   clean test**, and do it if yes. Note the `--muted`/`--secondary` surface stays below 4.5:1 (2.390 → 4.268); fix the
   token itself only if the fix is local to your routes and QA can prove no timetable surface moves.
2. **Title-pattern consolidation**, deferred in c2. Do it now; rows 14/16 need listed browser steps rather than a waiver.
3. `uxc01-derived-setup-surface.test.ts`, if still owed.
4. The **"returnTo" row**: A2's premise was falsified (0 occurrences). Record the row as `WONTFIX` or `A2-OWED` with the
   reason, and tell A2 in `lane-a-to-c.md` if A2 must emit it.
5. Remaining **UX-R02–R05 / UX-R03c** items from `docs/reviews/a3-c1-audit-20260928/route-table.md`, source-verifiable
   ones first, graded for older, mouse-first users (fewer words, one verb per action, a visual cue beside every status).
6. **Housekeeping before 06:30:** retire your worktrees (`lane-a3-c1-docs`, `-c1-integ`, `-c1-s-e`, `-c1-ux`,
   `-c2-chrome`, `-c2-integ`, plus any c3 ones), running `cmd /c rmdir` on every `node_modules` junction first and
   never `git worktree remove` on a junction; delete `E:/ATLAS-worktrees/.a3-browser/`. Handoff c3 section (SHAs, QA
   tallies, browser steps for live acceptance), `live-state.md` Lane A3. Everything pushed. **Use the Write/Edit tool
   for long appends, never a heredoc, and never an Edit that escapes backticks.**

Final message: ≤ 15 lines — done / blocked / not reached, last integrated SHA, handoff path.
