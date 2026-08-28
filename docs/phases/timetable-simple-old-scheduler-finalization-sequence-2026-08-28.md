# Timetable Simple Old-Scheduler Finalization Sequence - 2026-08-28

## Purpose

This sequence finishes the Simple timetable UX so scheduler officers, including older and non-technical users, always know what to do next without reading dense diagnostic text.

The current Simple timetable is visually usable, and the generated swap modal has improved, but the broader operating experience still has confirmed readiness gaps:

- Help is not reliably reachable from every advertised entry point.
- Status explanations are sometimes nested behind a second control.
- The next-step strip hides important helper copy from sighted users.
- The More menu is too dense and can bury Help below the visible area.
- Some primary timetable controls remain too small for the target user group.
- Advanced view contains useful guidance that is visually hidden.
- Regression specs still permit old swap-review weaknesses.

Run the prompts in order as one continuous executor sequence. Do not stop for Codex QA between prompts. Do stop when an internal gate fails in a way that makes later prompts invalid.

## Sequence

| Iteration | Prompt file | Scope | Internal gate before continuing |
|---:|---|---|---|
| 00 | `docs/prompts/timetable-simple-old-scheduler-finalization-00-regression-baseline-2026-08-28.md` | Freeze source and browser regression contracts | Guards catch broken tutorial, nested status key, hidden helper copy, tiny critical controls, wall-of-text risks, and weak swap assertions |
| 01 | `docs/prompts/timetable-simple-old-scheduler-finalization-01-help-and-status-key-2026-08-28.md` | Repair tutorial, tips, status key, and touch-friendly help | All help paths open useful content directly across desktop, portrait, and landscape |
| 02 | `docs/prompts/timetable-simple-old-scheduler-finalization-02-next-action-guidance-2026-08-28.md` | Make the next action persistent and visible | Every Simple state shows one direct next action, one visible reason, and a large primary control |
| 03 | `docs/prompts/timetable-simple-old-scheduler-finalization-03-more-menu-decompression-2026-08-28.md` | Decompress the More menu | Daily tasks and Help are visible without hunting; expert tools are separated |
| 04 | `docs/prompts/timetable-simple-old-scheduler-finalization-04-decision-state-parity-2026-08-28.md` | Apply decision-first UX to modal/drawer states | Swap, draft, publish blocker, manual fix, auto-fix, and blocked states avoid wall-of-text primary views |
| 05 | `docs/prompts/timetable-simple-old-scheduler-finalization-05-cumulative-release-proof-2026-08-28.md` | Final Technical GO / NO-GO proof | Static gates, source guards, focused Playwright gates, Tailnet 3-viewport proof, and evidence doc are complete |
| 06 | `docs/prompts/timetable-simple-old-scheduler-finalization-06-no-go-remediation-2026-08-28.md` | Remediate independent Codex NO-GO | Status key, More-layer lifecycle, swap preview failure, and stale tests are fixed |
| 07 | `docs/prompts/timetable-simple-old-scheduler-finalization-07-exhaustive-surface-proof-2026-08-28.md` | Exhaustive old-scheduler surface proof | Every reachable non-destructive timetable surface is opened and measured for wall-of-text, overflow, and next-action clarity |

## Current evidence to preserve

Treat these as baseline findings from 2026-08-28. Refresh before final proof.

- Tailnet route: `https://njgrm.buru-degree.ts.net/timetable`
- Baseline artifact folder: `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\`
- Known issues:
  - `More -> Help -> Tutorial` currently closes the menu without opening the tutorial.
  - Simple status key currently nests a second status-key trigger before definitions are visible.
  - Simple task prompt helper copy is hidden from sighted users.
  - Critical Simple actions use compact `h-7` / `h-8` sizing.
  - Advanced foolproof guidance is hidden with `sr-only`.
  - Swap visual-decision spec still accepts a weak primary-region count.
  - Independent Codex QA after Prompt 05 found the sequence still `NO-GO` because help/status layering and swap preview failure remained confusing.
  - Prompt 06 and Prompt 07 are required before renewed Technical GO.

## Global rules

- Preserve Simple timetable as the default scheduler path.
- Preserve Advanced view as expert mode.
- Keep publish hard blockers hard.
- Do not change generation algorithm semantics.
- Do not change Teaching Load or EnrollPro ownership contracts.
- Do not commit live timetable writes in browser proof.
- Use `@/ui/*` primitives, `lucide-react`, existing ATLAS tokens, and no-scroll layout rules.
- Do not add raw styled controls, native selects, raw title tooltips, or native details.
- Do not use smaller text or hidden content to fake viewport fit.
- Keep test gates stronger than the known regressions.
- Keep Product GO separate from Technical GO unless real moderated older-scheduler validation occurs.

## Required final evidence

The final report must include:

- prompt-by-prompt GO/NO-GO ledger;
- files changed;
- commands and results;
- viewport screenshots;
- source guard results;
- live Tailnet route evidence;
- fixture-limited states;
- final Technical GO / NO-GO;
- Product GO status.

## Independent QA correction

The Prompt 00-05 completion report must not be treated as final release proof. Independent Codex QA on 2026-08-28 opened the live timetable surfaces and found remaining old-scheduler blockers even though static gates and focused browser tests passed. The accepted continuation is Prompt 06 followed by Prompt 07.

## Suggested final commit

```text
refactor(timetable): finalize simple scheduler guidance
```
