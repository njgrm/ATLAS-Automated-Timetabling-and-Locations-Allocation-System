# Timetable Swap Old-Scheduler UX Sequence - 2026-08-26

## Purpose

This sequence redesigns timetable swap review from a text-heavy confirmation sheet into a visual, decision-first workflow for scheduler officers, including older and non-technical users.

The immediate concern is confirmed by live Tailnet evidence: generated occupied-slot swap is reachable, but the review modal currently presents five stacked sections, dense explanatory copy, disabled strategy rows, and a scrollable body during the highest-risk confirmation step. The goal is to preserve the safe server-controlled swap contract while making the UI answer three questions quickly:

- What two classes are affected?
- What will ATLAS do if I continue?
- If this is blocked, what is the next useful action?

Run these prompts in order as one continuous executor sequence. After each prompt, record the result and evidence in the final handoff notes, then continue only when that prompt's internal gate passes. Stop early when a failed gate makes later prompts invalid.

## Sequence

| Iteration | Prompt file | Scope | Internal gate before continuing |
|---:|---|---|---|
| 01 | `docs/prompts/timetable-swap-old-scheduler-01-baseline-and-fixture-2026-08-26.md` | Capture current live/source baseline and freeze a non-mutating swap fixture | Baseline spec opens generated swap review on Tailnet across desktop, mobile portrait, and mobile landscape without committing writes |
| 02 | `docs/prompts/timetable-swap-old-scheduler-02-generated-swap-visual-decision-2026-08-26.md` | Replace generated swap body with a visual decision panel and selected-strategy summary | Generated swap has no more than three primary visual regions, selected strategy drives visible status, and live 3-viewport gate passes |
| 03 | `docs/prompts/timetable-swap-old-scheduler-03-draft-review-parity-2026-08-26.md` | Apply the same concise visual pattern to draft placement and draft swap | Draft placement/swap reviews preserve ownership rules, reduce text density, and pass source plus live fixture gates |
| 04 | `docs/prompts/timetable-swap-old-scheduler-04-blocked-autofix-manual-actions-2026-08-26.md` | Add blocked-state auto-fix and manual-fix guidance that gives a next action | Blocked generated swap shows at least one useful manual next action and never leaves only disabled swap controls |
| 05 | `docs/prompts/timetable-swap-old-scheduler-05-release-proof-2026-08-26.md` | Run cumulative live, source, accessibility, and regression proof | Final proof passes static gates, live 3-viewport swap journey, no write leakage, and documents remaining Product GO limitations |
| 06 | `docs/prompts/timetable-swap-old-scheduler-06-qa-blocker-fix-2026-08-27.md` | Fix QA NO-GO blockers found after Prompt 05 verification | Raw native controls are removed, the actual modal body and footer geometry are measured, blocked recovery is genuinely proven or kept NO-GO, draft skips are reported honestly, and committed-scope evidence is corrected |
| 07 | `docs/prompts/timetable-swap-old-scheduler-07-mobile-landscape-decision-fit-2026-08-27.md` | Close the remaining mobile-landscape old-scheduler QA blocker | At `844x390`, strategy rows and selected blocker/warning status are visible before scrolling, the footer does not hide decision content, and tests fail on the Prompt 06 screenshot failure |
| 08 | `docs/prompts/timetable-swap-old-scheduler-08-landscape-action-sheet-pattern-2026-08-27.md` | Replace the failing short-height landscape modal pattern | At `844x390`, the recommended strategy row is fully above the footer, selected status is visible before scroll, no primary decision content intersects the footer, and the fix is not achieved with unreadably tiny text |
| 09 | `docs/prompts/timetable-swap-old-scheduler-09-decision-clarity-release-closure-2026-08-27.md` | Close Prompt 08 NO-GO by making the swap review decision-first instead of diagnostic-first | Generated swap exposes three explicit primary regions, both affected classes and selected status are fully visible at `844x390`, body scroll is not required for the primary decision, warning copy is calm, and the full swap browser gate passes |
| 10 | `docs/prompts/timetable-swap-old-scheduler-10-regression-proof-and-real-footer-closure-2026-08-27.md` | Close Prompt 09 regression by making the tests measure the real footer and exact region contract | Current Prompt 09 failure is reproduced first, the real action bar carries `generated-swap-action-region`, exactly three primary regions render, `844x390` needs no primary-decision scroll, mobile portrait has no clipping, and the hardened full browser gate passes |

## Current live evidence to preserve

Treat these values as baseline evidence from 2026-08-26, not permanent constants. Every prompt must refresh live runtime values before claiming GO.

- Tailnet target: `https://njgrm.buru-degree.ts.net`
- Route: `/timetable`
- Admin login used for QA: documented ATLAS admin test account
- Observed run: `Run #427`
- Header state: `Using saved ATLAS data`, `105 blockers`, `Names loaded`
- Default first task: `Place unresolved`
- Swap task path: `More -> Daily tasks -> Swap sessions`
- Live generated swap fixture:
  - first session: `TLE` for `Rizal - SPA`, `Monday 7:30 AM-8:15 AM`
  - second session: `FIL` for `Rizal - SPA`, `Tuesday 8:15 AM-9:00 AM`
  - modal title: `Review occupied-slot swap`
  - review type: `generated-swap`
  - section count: `5`
  - visible dialog text length: `846`
  - desktop dialog height: about `676px`
  - desktop review sheet scroll: `scrollHeight 674`, `clientHeight 522`
  - mobile portrait review sheet scroll: `scrollHeight 793`, `clientHeight 549`
  - mobile landscape review sheet scroll: `scrollHeight 674`, `clientHeight 265`
  - direct swap status: `Blocking 2 - Warnings 272`
  - auto-fix rows shown as disabled/unavailable: `Blocking - - Warnings -`
- Observed caveat: no app-critical console errors appeared during this swap-open path.
- Observed caveat: draft planning opened an empty selected-section draft grid and a large draft queue, but a natural draft swap fixture was not available in this live slice.

Prompt 08 follow-up QA from 2026-08-27:

- Prompt 08 remains `NO-GO` for old-scheduler release readiness.
- Full swap Playwright gate produced `6 failed / 6 passed / 3 skipped`, not a clean timeout-only result.
- Failing generated-swap specs reported `sectionCount=0` across desktop, mobile portrait, and mobile landscape after the component rewrite.
- Live `844x390` probe showed the right-side strategy rows visible, but the body still required local scroll (`scrollHeight 283`, `clientHeight 191`).
- The second affected-class chip and selected-status area intersected the footer/action band in the live `844x390` screenshot.
- The primary status still used diagnostic-feeling copy like `Blocking 0 • Warnings 890`.
- Prompt 09 must replace the fragile section-count instrumentation with explicit primary-region test IDs and make the generated swap review a three-region decision panel.

Prompt 09 follow-up QA from 2026-08-27:

- Prompt 09 remains `NO-GO` for old-scheduler release readiness even though the full swap Playwright group reported `12 passed / 3 skipped`.
- The spec accepted `primaryRegionCount >= 1`; the component rendered only one `generated-swap-primary-region` instead of the required three.
- The tested `generated-swap-action-region` was an inner placeholder, not the real footer containing `Cancel` and `Swap sessions`.
- Live `844x390` target-user probe showed body scroll still required (`scrollHeight 326`, `clientHeight 191`).
- The real footer began at `286.5px`, while the recommended region ended at `360.5px` and selected status ended at `348.5px`.
- Mobile portrait showed horizontal clipping in the affected-class and warning/status areas.
- Prompt 10 must prove this candidate fails before fixing it, then harden tests against this exact regression.

## Global executor rules

- Investigate blockers before implementing each prompt.
- Do not stop for Codex QA between prompts.
- Do not commit live timetable writes unless a prompt explicitly requires a reversible fixture and proves restoration.
- Default swap browser gates must intercept or cancel before commit.
- Do not change generation truth, publish lifecycle gates, role permissions, persisted source ownership, or Teaching Load ownership rules.
- Do not reintroduce timetable-owned teacher assignment controls into placement or swap reviews.
- Keep EnrollPro as source authority for roster and active year context.
- Keep ATLAS as owner of timetable draft/edit state.
- Use `@/ui/*` primitives for controls. Do not add native `<select>` or raw styled buttons.
- Use `lucide-react` icons when icon buttons or visual status marks are needed.
- Keep no-scroll architecture intact: root work areas must use `flex-1 min-h-0 overflow-auto`; do not create global browser overflow.
- Preserve click/tap swap as the primary old-scheduler path; drag-to-swap may remain a shortcut.
- Keep focus recovery, Escape cancel, and `aria-live` status announcements test-covered.
- Do not stage generated `dist` files or unrelated local changes.
- Update `docs/reference/atlas-runtime-source-of-truth-map.md` only if page dependencies, runtime ownership, or fallback behavior changes.

## Required per-prompt evidence log

Executor must keep a compact per-prompt evidence log for the final handoff:

1. `GO` or `NO-GO`.
2. Investigation summary and blockers found before implementation.
3. Files changed.
4. Exact commands run and results.
5. Tailnet viewport evidence and screenshot/artifact paths.
6. Tests added or updated.
7. Whether the executor continued or stopped.
8. Remaining caveats.

## Required minimum command gates

Run targeted prompt-specific tests first, then the broader gates.

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

If a prompt changes backend swap preview or commit behavior, also run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Backend changes are not complete until the built server can start and the touched `/api/v1` route responds.

## Final expected outcome

At the end of this sequence, ATLAS should be able to:

- Let schedulers start swap from the Simple timetable without precision dragging.
- Show a visual before/after swap outcome instead of a wall of review text.
- Label the recommended strategy clearly.
- Show conflict and warning counts for the selected strategy, not only direct swap.
- Distinguish auto-fix options from manual next actions.
- Give a clear next action when a swap is blocked.
- Preserve generated-run swap, draft placement, and draft swap safety semantics.
- Pass live Tailnet checks on desktop, mobile portrait, and mobile landscape.
- Remain Technical GO only until real older-scheduler moderated evidence is captured or explicitly deferred.

## Suggested final commit

```text
refactor(timetable): simplify swap review for scheduler usability
```
