# ATLAS Older-User Session Validation — Codex Self-Audit

Date: 2026-07-28  
Environment: `https://njgrm.buru-degree.ts.net`  
Role: Admin QA (`1000001`)  
Protocol: `docs/prompts/older-user-session-validation-shared-protocol-2026-07-28.md`

## Decision

**Technical browser-proxy decision: GO WITH FIXES.**

All twelve task paths were exercised without committing timetable data on desktop, mobile portrait, and mobile landscape. Core cockpit outcomes remain reachable: readiness repair, unresolved-session placement, grid conflict feedback, visual swap review, cancellation, and Advanced/Simple reversibility. Two bounded accessibility/clarity follow-ups remain:

1. The persistent status legend is not present in Simple mode and is CSS-hidden below the `lg` breakpoint, so mobile users cannot see the legend without entering Advanced mode.
2. The browser proxy did not observe focus returning to the invoking grid control after Escape from placement or swap review. Radix focus handling is present, but these dialogs are controlled programmatically rather than opened by a `DialogTrigger`; this needs an explicit keyboard regression test and, if confirmed with a keyboard user, focus restoration to the source cell.

This is **not Product GO**. No real older-user participant was available in this run, so cognitive-load, wording hesitation, and the 80%/90% human thresholds remain unvalidated.

## Evidence classification

| Evidence | Classification | Result |
|---|---|---|
| Playwright T01–T12, three viewports | Browser proxy | 36/36 audit executions completed; no writes, API 5xx, page errors, or global overflow |
| Existing Tailnet preflight | Browser proxy | 3/3 passed |
| TypeScript, UX guardrails, conflict tests, production build | Static/build | All passed: 32 UX tests, 10 conflict tests, build clean |
| Click-path handler trace | Static code | No dead save path or teacher-assignment detour found; explicit cancel/commit boundaries remain |
| Screenshot and visible text inspection | Browser proxy | Captured per viewport under `qa-artifacts/older-user-session-validation-codex/` |
| Older-user cognitive evaluation | Human participant | Not run; product-level verdict intentionally withheld |

## T01–T12 browser-proxy scorecard

`Independent` below means the automated browser completed the neutral task path without a moderator hint. It is **not** a human independence score.

| ID | Task outcome | Desktop 1366×768 | Mobile portrait 390×844 | Mobile landscape 844×390 |
|---|---|---:|---:|---:|
| T01 | Dashboard readiness and first repair | Independent, 0.84s | Independent, 1.08s | Independent, 1.01s |
| T02 | Find Sections | Independent, 1.03s | Independent, 0.87s | Independent, 0.82s |
| T03 | Find subject needing attention | Independent, 2.27s | Independent, 2.25s | Independent, 2.14s |
| T04 | Find teacher / Teaching Load repair path | Independent, 3.12s | Independent, 2.89s | Independent, 2.70s |
| T05 | Find room readiness before map | Independent, 1.36s | Independent, 1.18s | Independent, 1.03s |
| T06 | Identify timetable next action | Independent, 2.59s | Independent, 3.80s | Independent, 1.58s |
| T07 | Find an unplaced session | Independent, 3.19s | Independent, 2.90s | Independent, 2.36s |
| T08 | Open placement review, then cancel | Independent, 2.11s | Independent, 1.77s | Independent, 1.50s |
| T09 | Explain six grid statuses | Partial: four-state legend only in Advanced; 5.03s | Partial: legend hidden below `lg`; 3.67s | Partial: legend hidden below `lg`; 2.37s |
| T10 | Open visual occupied-slot swap, then cancel | Independent, 3.35s | Independent, 2.99s | Independent, 2.38s |
| T11 | Advanced then Simple | Independent, 3.00s | Independent, 2.87s | Independent, 2.47s |
| T12 | Leave safely without saving | Independent, 2.54s | Independent, 1.90s | Independent, 2.62s |

### Scroll evidence

The generated unassigned list is structurally scrollable on all profiles. On desktop the proxy measured a `246px` viewport over `28,482px` of content; a pointer wheel moved `scrollTop` to `240` and a programmatic check moved it to `600`. Mobile emulation reported the same long content and a `220px` viewport; programmatic scroll moved to `600`. Mouse-wheel movement is not a faithful touch gesture proxy, so a real touch-device session must still verify finger scrolling.

## Findings

### OUSER-001 — Status guidance disappears from the default/mobile context

- Surface: `/timetable`
- Task(s): T09
- Evidence type: Browser proxy + static
- Severity: Medium
- Result: Partial (all six states cannot be explained from the default view)
- Time: Advanced legend appeared in 5.03s desktop; the mobile proxy found the element but it was hidden at both mobile breakpoints.
- Exact observed UI: `Can place = empty slot. Can swap = occupied slot. Blocked = fix first. Warning = review only.` is rendered in `ScheduleReviewWorkspaceHeader.tsx` as `className="hidden ... lg:block"`; Simple mode has no visible `timetable-status-legend` (`count=0`). `Occupied` and `Current` appear only contextually in grid cells.
- Expected: A user should be able to interpret every visible status without switching modes or relying on color/hover.
- Actual: Desktop Advanced exposes four states; mobile hides that legend; Simple provides task-specific guidance but not the six-state legend.
- Cockpit capability preserved?: Partially. The underlying conflict/status calculations remain; discoverability is reduced.
- Root cause or likely cause: Responsive hiding of the legend and separation of contextual cell states from persistent help.
- Recommended fix: Add a compact, collapsible status key to Simple mode and expose it at mobile widths; include text definitions for `Occupied` and `Current` while keeping it out of the grid’s hot render path.
- Regression test needed: Assert the legend is visible or reachable from Simple at all three profiles and that all six labels have text definitions without requiring hover.

### OUSER-002 — Source uncertainty and repair urgency are presented together

- Surface: `/` Dashboard
- Task(s): T01
- Evidence type: Browser proxy + inference
- Severity: Medium
- Result: Browser proxy completed the path; human comprehension is unvalidated.
- Time: 0.84–1.08s to readiness hub.
- Exact observed UI: `Using saved ATLAS data`, `Enrollment unavailable`, `0 of 7 ready`, and `Check sections` appear in the same readiness surface.
- Expected: An older operator should immediately know whether to repair data now or wait for the source to recover.
- Actual: The first repair link is clear, but the source outage and repair instruction compete for priority.
- Cockpit capability preserved?: Yes, with ambiguity risk.
- Root cause or likely cause: Readiness cards combine source-state and setup-state copy without a single “wait / repair” decision sentence.
- Recommended fix: Add one explicit sentence such as “Source unavailable: review saved data now; wait for EnrollPro before final sync” and visually separate source health from operator repairs.
- Regression test needed: Route-smoke assertion for source-unavailable copy and a fixture covering both “repair now” and “wait for source” states.

### OUSER-003 — Focus return after controlled dialogs is not proven

- Surface: generated placement and occupied-slot swap dialogs
- Task(s): T08, T10, T12
- Evidence type: Browser proxy + static
- Severity: Medium
- Result: Dialogs opened, Tab moved within dialog controls, and Escape closed them; focus returned to a body/navigation-level element rather than a clearly identified invoking grid cell in the proxy.
- Time: T08 1.50–2.11s; T10 2.38–3.35s.
- Exact observed UI: Before Tab, placement focus was `Select room`; swap focus was `Cancel`; after Escape the active element was reported as a body-level/navigation text node rather than a source-cell label.
- Expected: Escape should close the review and return focus to the cell or queue control that opened it.
- Actual: Safe cancellation works, but focus restoration is not deterministic from the controlled-dialog path.
- Cockpit capability preserved?: Yes; keyboard continuity is at risk.
- Root cause or likely cause: `Dialog` surfaces in `TimetablePlacementDialogs.tsx` are controlled with `open={...}` and `onOpenChange` callbacks, without a colocated `DialogTrigger` for the grid invocation.
- Recommended fix: Store the invoking control reference when opening a review, restore focus after close, and test Escape/Tab on desktop and mobile keyboard emulation.
- Regression test needed: Assert focus is inside the review, trapped while open, and restored to the exact invoking control after Escape and Cancel.

## Capability-parity matrix

| Former cockpit outcome | Current Simple/Advanced path | Preserved? | Evidence |
|---|---|---|---|
| Find readiness blockers | Dashboard Setup readiness + direct repair links | Yes | T01, route smoke |
| Inspect unresolved sessions | More → Place unresolved sessions → task drawer | Yes | T07; list has long scroll content |
| Preview placement before save | Queue item → slot → Review generated placement | Yes | T08; write interceptor saw no commit |
| Read conflict guidance | Advanced legend + contextual grid labels | Partial discoverability | T09 / OUSER-001 |
| Preview an occupied-session swap | Select two occupied entries → Review occupied-slot swap | Yes | T10 |
| Cancel risky actions | Escape/Cancel on review sheets | Yes | T08, T10, T12 |
| Reach expert controls | Simple → Advanced → Simple | Yes | T11 |
| Preserve teacher ownership in Teaching Load | Review copy states teacher is locked from Teaching Load; no teacher/room assignment detour | Yes | T08, static grep, existing workflow gates |

## Click-path and state audit

- `TimetableSimpleHeader.startTask` routes Place, Swap, Review, Draft, and Publish into explicit task/presentation state (`TimetableSimpleHeader.tsx:146–181`). No sequential undo or hidden commit is executed by task selection.
- Grid click/keyboard placement routes through `handleKbPlace` in `useScheduleReviewWorkspaceState.ts:937–995`; it creates preview state and only the review sheet’s explicit save action commits.
- Generated placement cancel clears assignment target, selected room/faculty state, preview result, and drag state (`TimetablePlacementDialogs.tsx:162–170`). Draft placement cancel clears confirmation and preview state (`:102–113`).
- Swap review uses controlled preview and explicit `executeSwapAction`/`executeRegularSwap` buttons (`TimetablePlacementDialogs.tsx:342–457`); no timetable-owned teacher assignment control is introduced.
- Existing `timetable-workflow-phase01`, Phase 5, and Phase 6 harnesses had stale assumptions about Advanced being the default. The audit updated them to opt into Advanced explicitly or use the current Simple “More” path. This was a verification-only correction; no timetable data was changed.

## Accessibility checks

- No global vertical or horizontal overflow was detected in any audited viewport.
- Primary task controls use large targets; the only sub-24px visible item reported was the non-actionable ATLAS wordmark (`40×20px`).
- `More` and `Why?` expose `aria-expanded`; `Why?` exposes `aria-controls`.
- Review dialogs accept keyboard Tab and Escape. Focus containment worked for the observed Tab step; deterministic return to the invoking cell remains the OUSER-003 follow-up.
- Status meaning is not color-only where labels are rendered, but the persistent legend discoverability is the OUSER-001 gap.
- A full real-user 200% zoom session and assistive-technology session were not available; do not infer conformance beyond the proxy checks above.

## Artifacts

- Browser proxy spec: `qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts`
- JSON evidence and viewport screenshots: `qa-artifacts/older-user-session-validation-codex/`
- Shared protocol: `docs/prompts/older-user-session-validation-shared-protocol-2026-07-28.md`
- External AG protocol prompt: `docs/prompts/antigravity-older-user-session-validation-2026-07-28.md`

## Next bounded fixes

1. Make the six-state status key reachable from Simple on desktop and mobile, with `Occupied` and `Current` definitions.
2. Add source-health decision copy to the Dashboard readiness hub.
3. Add invoking-control focus restoration and a keyboard regression test for every review sheet.
4. Repeat T01–T12 with at least five representative older scheduler participants. Record their exact wording and score the human thresholds before declaring Product GO.
