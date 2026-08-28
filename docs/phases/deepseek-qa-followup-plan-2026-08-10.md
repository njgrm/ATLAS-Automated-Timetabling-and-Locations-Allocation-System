# DeepSeek QA Follow-Up Plan — Dashboard, Rollover, Older-User Validation, Lifecycle Proof

Date: 2026-08-10  
Owner: DeepSeek Flash executor  
Reviewer: Codex QA/reviewer  
Target environment: `https://njgrm.buru-degree.ts.net`

## Purpose

This packet converts the latest Codex QA findings into four sequential DeepSeek Flash execution prompts. The current mandate is not another broad redesign. The work should close concrete release blockers found during the read-only QA pass:

1. Dashboard first-screen content is still too low and visually too heavy.
2. Runtime context and rollover status disagree about active-year alignment.
3. Older-user browser validation uses stale Simple-view timetable selectors.
4. The full EnrollPro → ATLAS → Teaching Load → timetable lifecycle is not yet proven end-to-end.

## Current Evidence Snapshot

### Passing gates

- `atlas-client npx tsc --noEmit`: PASS.
- `atlas-client npm run test:ux-guardrails`: PASS (`79/79`).
- `atlas-client npm run test:timetable-conflict`: PASS (`10/10`).
- `atlas-client npm run build`: PASS.
- `atlas-server npx tsc --noEmit`: PASS.
- `atlas-server npm run build`: PASS.
- Tailnet preflight: PASS.
- SMART parity browser checks did not produce failures in the combined run.

### Current blockers

- `cross-page-ux-release-readiness.spec.ts` fails Dashboard first-useful-content budgets:
  - desktop `/`: `288px`, budget `<=260px`.
  - mobile portrait `/`: `456px`, budget `<=260px`.
  - mobile landscape `/`: `238px`, budget `<=180px`.
  - mobile landscape `/sections`: `252px`, budget `<=250px` minor miss.
- Dashboard screenshots show the `Year aligned` card consumes a full row even when alignment is normal. This pushes the real `Your next step` card below the first screen, especially on mobile portrait.
- Authenticated runtime probes disagree:
  - `/api/v1/runtime/context?schoolId=1&verifyUpstream=true` reports `activeYearDrift.status=aligned`.
  - `/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true` reports `drift.status=mapping-conflict`, `recommendedAction=RESET_DUMMY_YEAR`, and `SECTION_ID_COLLISION`.
- Rollover preview reports current conflicting SY `3` data:
  - `generationRuns=2`
  - `manualScheduleEdits=1`
  - `lockedSessions=4`
  - `lockedSessionActions=18`
  - `teachingLoadFacultySubjects=48`
  - `teachingLoadOwnerships=265`
  - `publishedResetBlocked=false`
- Older-user validation fails because the spec waits for `data-testid="timetable-layout-toggle"`, which no longer exists in the current Simple timetable header. The visible current controls are `Tutorial`, `Generate`, and `More`.
- Latest SY `3` draft is reviewable but not lifecycle-complete:
  - `assignedCount=830`
  - `unassignedCount=95`
  - `hardViolationCount=0`
  - `violationCounts` still include warning/review pressure.

## Execution Order

Run these prompts sequentially. Do not start the next prompt until the previous prompt returns `GO` or a clearly reviewable `NO-GO` with exact blockers.

1. `docs/prompts/deepseek-qa-01-dashboard-first-screen-recovery-2026-08-10.md`
2. `docs/prompts/deepseek-qa-02-rollover-status-context-alignment-2026-08-10.md`
3. `docs/prompts/deepseek-qa-03-older-user-validation-realignment-2026-08-10.md`
4. `docs/prompts/deepseek-qa-04-system-lifecycle-release-proof-2026-08-10.md`

## Global Constraints For DeepSeek

- Preserve planning/reviewer handoff discipline: implement only the prompt currently assigned.
- Do not reset unrelated worktree changes.
- Do not delete or rewrite generated timetable data except where a prompt explicitly authorizes a reversible fixture.
- Do not run destructive rollover reset against Tailnet unless the prompt explicitly permits it and the reset is confirmed safe.
- Do not change generation truth, Teaching Load ownership truth, publish gates, role permissions, or EnrollPro ownership rules unless the prompt explicitly scopes that server-side correction.
- Keep SMART-family UI rules:
  - compact command bar;
  - one obvious next action;
  - source/status chip;
  - More/help for secondary information;
  - local scrolling, no global page scrollbar;
  - no horizontal overflow;
  - no text overlap;
  - older-user plain language.
- Treat automated browser success as technical evidence, not moderated Product GO.

## Review Contract

Every DeepSeek prompt must return:

1. `GO` or `NO-GO`.
2. Files changed.
3. Exact command results.
4. Browser evidence and screenshot/trace artifact paths when relevant.
5. Remaining blockers with exact reproduction steps.
6. Whether the work changed source ownership, generation truth, or runtime data behavior.

