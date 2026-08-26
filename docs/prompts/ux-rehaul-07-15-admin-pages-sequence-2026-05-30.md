# UX Rehaul Prompts 07-15: Admin Pages From Sections Through Audit

## Purpose

Use this sequence to update all admin pages from `Sections` through `Audit`, while explicitly excluding `/timetable` because that page has a separate plan.

The sequence converts the setup/review pages from isolated dense tables into SMART-family ATLAS pages with clear purpose, source-state honesty, task-first hierarchy, and consistent shadcn/Radix interaction patterns.

## In Scope

- `/sections`
- `/subjects`
- `/teachers`
- `/teaching-load`
- `/map`
- `/map?mode=editor`
- `/schedules`
- `/audit`

## Out Of Scope

- `/timetable`
- faculty `/my/*` pages
- public/student pages
- backend scheduling algorithms
- Prisma schema changes
- auth changes

## Audit Summary Behind This Sequence

Live Tailnet sampling on 2026-05-30 found:

- Sections, Subjects, Teachers, Teaching Load, Schedules, and Audit did not consistently expose strong semantic page framing in the sampled viewport.
- Several pages communicate in implementation language: `Saved Data`, `Verifying runtime`, `Run ID`, `Mismatches`, `Clashes`, `READ-ONLY`, and `0 / 0`.
- Teaching Load can open in a confusing read-only/zeroed state without enough recovery guidance.
- Schedules starts with `Select a room`, but the selector and page purpose need more hierarchy.
- Audit can appear nearly blank and logged duplicate-key warnings.
- The map restoration is on the right path, but `/map` still benefits from focused polish around mode copy, selected-building summary, readiness chips, and editor task grouping.

## Queue Order

1. `docs/prompts/ux-rehaul-07-admin-shared-list-pattern-one-shot-prompt.md`
   - Build the shared admin page pattern for Sections, Subjects, and Teachers.
   - Do this first so the next prompts do not invent three slightly different page frames.

2. `docs/prompts/ux-rehaul-08-sections-smart-setup-one-shot-prompt.md`
   - Apply the shared pattern to `/sections`.
   - Focus on roster readiness, home-room progress, source honesty, and section detail clarity.

3. `docs/prompts/ux-rehaul-09-subjects-smart-curriculum-one-shot-prompt.md`
   - Apply the shared pattern to `/subjects`.
   - Focus on curriculum readiness, coverage, subject status language, and clearer add/sync/archive actions.

4. `docs/prompts/ux-rehaul-10-teachers-roster-health-one-shot-prompt.md`
   - Apply the shared pattern to `/teachers`.
   - Focus on roster health, load readiness, sync/source copy, and teacher profile clarity.

5. `docs/prompts/ux-rehaul-11-teaching-load-state-clarity-one-shot-prompt.md`
   - Harden `/teaching-load` state communication.
   - Keep the dense operator workspace but explain read-only, degraded, zero-coverage, and mode states.

6. `docs/prompts/ux-rehaul-12-campus-rooms-polish-one-shot-prompt.md`
   - Polish `/map` overview/editor.
   - Preserve the restored original map behavior, zoom/pan, building click, and room schedule drilldown.

7. `docs/prompts/ux-rehaul-13-schedules-browser-one-shot-prompt.md`
   - Redesign `/schedules` as a schedule browser for rooms, teachers, and sections.
   - Clarify selector hierarchy, latest vs run ID, and empty/error states.

8. `docs/prompts/ux-rehaul-14-audit-readiness-report-one-shot-prompt.md`
   - Rebuild `/audit` as an operator readiness report.
   - Fix duplicate-key warnings, blank/weak loading states, and unclear finding groups.

9. `docs/prompts/ux-rehaul-15-admin-pages-cross-qa-gate-prompt.md`
   - Run the cross-page QA gate and repair loop.
   - Final answer must include route-by-route GO/NO-GO.

## Sequencing Notes

- Prompt 07 should land before 08-10.
- Prompts 08-10 can be run sequentially or in separate focused chats after 07.
- Prompt 11 should run after 10 because it bridges teacher roster/load language.
- Prompt 12 can run independently after the current map restoration work.
- Prompt 13 should run after 12 because it shares room schedule language.
- Prompt 14 should run after 08-13 so Audit can link to the repaired pages.
- Prompt 15 must run last.

## Standard Verification For Every Prompt

Every implementation prompt must return:

1. files changed
2. UX findings resolved
3. SMART design mapping
4. source-state/copy changes
5. accessibility and primitive-compliance notes
6. line count table for touched React files
7. build result from `npm --prefix atlas-client run build`
8. Tailnet/browser smoke-check result where applicable
9. screenshot evidence for major UI claims
10. prompt-scope `GO` or `NO-GO`
