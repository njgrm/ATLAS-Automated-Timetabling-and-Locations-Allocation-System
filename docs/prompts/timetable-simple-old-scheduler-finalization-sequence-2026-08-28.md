# Timetable Simple Old-Scheduler Finalization Sequence - 2026-08-28

Use this sequence to finish the Simple timetable experience so older scheduler officers can operate the timetable without wall-of-text states, hidden help, confusing menus, or unclear next actions.

This sequence extends the prior swap-review work. The swap modal is much cleaner now, but the broader Simple timetable shell still has old-scheduler readiness gaps:

- the `More` menu is acting like a second control panel;
- `More -> Help -> Tutorial` closes the menu without opening the tutorial;
- the Simple status key opens a dialog that contains another status-key popover trigger instead of showing the meanings directly;
- the visible next-step strip hides useful helper text from sighted users;
- several primary timetable actions still use small `h-7` / `h-8` controls;
- Advanced view guidance exists but is screen-reader-only;
- current swap regression specs still allow weaker region assertions and stale diagnostic copy checks.

Run these prompts in order as one continuous executor sequence. Do not stop for Codex QA between prompts. After each prompt, run that prompt's required tests and record evidence. Only move to the next prompt when the prompt's internal gate passes. If a failed gate makes later prompts invalid, stop and report the blocker with exact evidence.

## Sequence

| Iteration | Prompt file | Scope | Internal gate before continuing |
|---:|---|---|---|
| 00 | `docs/prompts/timetable-simple-old-scheduler-finalization-00-regression-baseline-2026-08-28.md` | Freeze old-scheduler UX regression tests and source guards before broader UI changes | Baseline/source guards fail on current known weaknesses or are updated to fail on reintroduction of wall-of-text, weak swap assertions, nested help, broken tutorial, and tiny critical controls |
| 01 | `docs/prompts/timetable-simple-old-scheduler-finalization-01-help-and-status-key-2026-08-28.md` | Make tutorial, tips, status key, and help entry points direct and visible | Tutorial opens from every visible Help/Tutorial entry, status meanings render directly, Help is reachable on desktop/mobile without menu hunting, and 3-viewport proof passes |
| 02 | `docs/prompts/timetable-simple-old-scheduler-finalization-02-next-action-guidance-2026-08-28.md` | Make each Simple timetable state expose one clear visible next action | The task prompt shows one recommended action plus one short visible helper line; primary actions are old-scheduler-sized; loading/empty/error/blocked states remain direct |
| 03 | `docs/prompts/timetable-simple-old-scheduler-finalization-03-more-menu-decompression-2026-08-28.md` | Reorganize the More menu so daily tasks and help are not buried under expert controls | Daily actions, help, and advanced/expert actions are visually separated; mobile portrait and landscape can reach Help without clipped menu sections |
| 04 | `docs/prompts/timetable-simple-old-scheduler-finalization-04-decision-state-parity-2026-08-28.md` | Apply the concise decision pattern beyond generated swap | Generated swap, draft review, blocked recovery, publish blockers, manual fixes, auto-fix suggestions, and task drawer states avoid wall-of-text layouts and show direct next actions |
| 05 | `docs/prompts/timetable-simple-old-scheduler-finalization-05-cumulative-release-proof-2026-08-28.md` | Run cumulative old-scheduler release proof | Static gates, focused Playwright gates, source guards, live Tailnet 3-viewport proof, and screenshot evidence are recorded in one final report |
| 06 | `docs/prompts/timetable-simple-old-scheduler-finalization-06-no-go-remediation-2026-08-28.md` | Close independent Codex NO-GO issues after Prompt 05 | Status key shows definitions directly, More closes before child layers, swap preview failure has a useful action, and stale/weak tests are hardened |
| 07 | `docs/prompts/timetable-simple-old-scheduler-finalization-07-exhaustive-surface-proof-2026-08-28.md` | Open every reachable timetable surface and prove there are no wall-of-text states | Exhaustive non-mutating Tailnet proof passes across desktop, mobile portrait, and mobile landscape with screenshots and metrics |

## Current live/source evidence to preserve

Treat this as baseline evidence from 2026-08-28, not permanent constants. Refresh live values before claiming GO.

- Tailnet target: `https://njgrm.buru-degree.ts.net`
- Route: `/timetable`
- Baseline screenshots:
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\desktop-01-initial.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\desktop-02-more-menu.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\desktop-04-status-key.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\mobile-portrait-01-initial.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\mobile-portrait-02-more-menu.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\mobile-portrait-03-tutorial.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\mobile-landscape-02-more-menu.png`
  - `D:\ATLAS\qa-artifacts\timetable-simple-final-audit\mobile-landscape-05-swap-modal.png`
- Known source defects:
  - `TimetableSimpleHeader.tsx`: `More -> Tutorial` only calls `setMoreOpen(false)`.
  - `TimetableSimpleHeader.tsx`: status-key dialog renders `<TimetableStatusLegend compact />`, which requires a second click to show meanings.
  - `TimetableSimpleHeader.tsx`: task helper copy is `sr-only`.
  - `TimetableSimpleHeader.tsx`: key Simple actions use `h-7` / `h-8`.
  - `ScheduleReviewWorkspaceHeader.tsx`: `timetable-foolproof-help` is `sr-only`.
- `timetable-swap-visual-decision.spec.ts`: stale guard accepts `primaryRegionCount >= 1` and still checks old `Blocking 0` copy.

Independent Codex QA follow-up from 2026-08-28:

- Prompts 00-05 are not sufficient for release.
- Static gates passed, and a broad focused Playwright run passed `72 passed / 3 skipped`.
- Live old-scheduler sweep still found:
  - Status key definitions are hidden behind a second `Status key / 6 states` trigger.
  - Tutorial, Status key, and Filters opened from More leave the More menu visually present behind the child layer.
  - Manual swap preview failure can show `Unable to preview swap` with a disabled-looking `Swap sessions` action.
  - Active specs still contain stale or weak assertions such as `primaryRegionCount >= 1`.
- Prompt 06 must fix these before any final release proof.
- Prompt 07 must open every reachable timetable surface and measure wall-of-text risk before claiming Technical GO.

## Global executor rules

- Start every prompt by reading this sequence, the prompt file being executed, `ATLAS_AGENT_KI.md`, and `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Check git state before every prompt and do not revert unrelated user work.
- Keep `/timetable` Simple mode as the primary scheduler workflow.
- Preserve Advanced view for expert workflows, but do not force ordinary scheduler tasks through Advanced view.
- Do not change generation algorithm semantics, publish rules, Teaching Load ownership, EnrollPro ownership, role permissions, or persisted timetable contracts unless a prompt explicitly requires it.
- Do not commit live timetable writes in browser proof. Intercept, cancel, or use non-mutating fixtures.
- Use `@/ui/*` primitives only. Do not introduce raw styled `<button>`, native `<select>`, raw `title`, or native `<details>`.
- Use `Tooltip`, `Popover`, `Dialog`, `Sheet`, or existing project primitives for help and explanation.
- Keep no-scroll architecture intact: root work areas must use `flex-1 min-h-0 overflow-auto`; no global browser overflow.
- Keep critical timetable actions old-scheduler-sized. Use `h-10` or `h-11` unless there is measured evidence that a smaller non-critical chip is needed and still passes accessibility gates.
- Do not solve density by shrinking text below readable sizes, hiding primary facts, or moving essential help behind hover-only affordances.
- Update `docs/reference/atlas-runtime-source-of-truth-map.md` only if runtime ownership, fallback behavior, or page dependencies change.
- Do not stage generated `dist` files, screenshots, or unrelated local changes unless the prompt specifically requests an artifact commit.

## Required per-prompt evidence log

Executor must keep a compact ledger for the final handoff:

1. `GO` or `NO-GO`.
2. Investigation summary and blockers found before implementation.
3. Files changed.
4. Exact commands run and results.
5. Tailnet viewport evidence and screenshot paths.
6. Tests added or updated.
7. Whether the executor continued or stopped.
8. Remaining caveats.

## Required minimum command gates

Run the prompt-specific tests first, then these broader gates where applicable:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run the timetable browser gates from repo root when a prompt changes timetable UI or Playwright specs:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts timetable-draft-review-visual-parity.spec.ts timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Each prompt may add additional focused specs. Run those before moving forward.

## Required Tailnet proof

Use live Tailnet by default:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account from ATLAS project instructions

Before browser QA:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

Required viewport evidence for prompts 01-07:

- `1366x768`
- `390x844`
- `844x390`

## Final expected outcome

At the end of this sequence, ATLAS should:

- show one obvious next action in every Simple timetable state;
- let schedulers find tutorial, tips, and status meanings without hunting;
- avoid wall-of-text modals, drawers, popovers, and menu states;
- keep critical actions large enough for older scheduler officers;
- present auto-fix and manual-fix options as direct decisions;
- keep expert tools discoverable without making them the default path;
- pass source guards, static gates, focused Playwright gates, and live 3-viewport Tailnet proof;
- pass an exhaustive non-mutating surface proof that opens all reachable timetable components;
- remain Technical GO only until real older-scheduler moderated validation is completed or explicitly deferred.

## Suggested final commit

```text
refactor(timetable): finalize simple scheduler guidance
```
