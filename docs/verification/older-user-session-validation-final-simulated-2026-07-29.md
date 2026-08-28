# Older-User Session Validation — Simulated Phase 5 Closure

Date: 2026-07-29  
Environment: `https://njgrm.buru-degree.ts.net`  
Evidence type: Browser proxy + simulated personas + static/build verification  
Operator: Codex  
Protocol: `docs/prompts/older-user-session-validation-shared-protocol-2026-07-28.md`

## Verdict

**Simulated Phase 5 decision: GO WITH LIMITATION.**

The technical and browser-proxy evidence supports moving forward from the older-user remediation stream. However, this is **not full Product GO from real moderated participants** because no Scheduler Officers were available. The user explicitly instructed Codex to simulate the Phase 5 session; this report therefore records simulated evidence as a substitute readiness signal, not as real human usability proof.

## Context7 and standards note

The `context7-mcp` skill was invoked because the user requested Context7. The Context7 MCP tools and `ctx7` CLI were not callable in the active tool context, so the validation used the available local Playwright harness plus the relevant official standards references already aligned with the shared protocol:

- Playwright actionability and auto-waiting: `https://playwright.dev/docs/actionability`
- Playwright mobile/device emulation: `https://playwright.dev/docs/emulation`
- WCAG 2.2 Target Size (Minimum), SC 2.5.8: `https://www.w3.org/TR/WCAG22/#target-size-minimum`
- WAI-ARIA APG Dialog Modal Pattern: `https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`
- WAI-ARIA APG Disclosure Pattern: `https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/`

## Simulated participant model

Five representative scheduler-operator archetypes were simulated against the same T01–T12 task protocol. Scores are derived from browser-proxy task completion, visible UI wording, known older-user constraints, and the cockpit-parity matrix. They do **not** represent actual human hesitation data.

| Simulated participant | Device profile | Assumed risk profile | Result |
|---|---|---|---|
| P1: experienced scheduler, low technical confidence | Desktop 1366×768 | Needs clear next action and cancel path | Pass |
| P2: older clerk, mobile portrait | Pixel 7 portrait 390×844 | Needs tap-only workflow and large targets | Pass |
| P3: department head substitute user | Desktop 1366×768 | Needs source/readiness explanation | Pass |
| P4: field/mobile operator | Pixel 7 landscape 844×390 | Needs no page-scroll trap and reachable drawers | Pass |
| P5: keyboard/cautious operator | Desktop keyboard proxy | Needs review-sheet focus, Escape, and no accidental save | Pass |

## Task scorecard

The shared protocol requires at least 80% of T01–T08 and T12 to complete independently or with one hint, and at least 90% status interpretation accuracy. In this simulated run:

- T01–T08 + T12 simulated pass rate: `45/45` successful task outcomes across five simulated participants.
- Six-state status interpretation: simulated `5/5` participants pass, because Simple and Advanced now expose all six text definitions and the browser proxy verified T09 on all three viewports.
- No simulated participant needed drag as the only path; click/tap placement remained available.
- No simulated participant encountered timetable teacher assignment.
- No simulated participant failed to cancel a risky placement/swap action.
- No cockpit capability was removed to improve timing.

## Latest browser-proxy timing evidence

Command:

```text
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts --workers=1 --reporter=line
```

Result: PASS `3/3` viewport sessions.

| Viewport | Average task time | Slowest task | Slowest time | Result |
|---|---:|---|---:|---|
| Desktop 1366×768 | 2692ms | T09 status meaning | 4933ms | Pass |
| Mobile portrait 390×844 | 2090ms | T09 status meaning | 3711ms | Pass |
| Mobile landscape 844×390 | 1922ms | T09 status meaning | 3944ms | Pass |

All observed tasks completed below the 10-second first-use threshold in the shared protocol.

## Phase 4 touch/reflow recheck

Command:

```text
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --workers=1 --reporter=line
```

Result: PASS `9/9`.

Latest touch artifacts:

- `qa-artifacts/older-user-session-remediation/phase-4/mobile-portrait-queue-touch-scroll-metrics-2026-07-29T06-28-25-386Z.json`
- `qa-artifacts/older-user-session-remediation/phase-4/mobile-landscape-queue-touch-scroll-metrics-2026-07-29T06-28-43-441Z.json`

Both mobile profiles advanced the generated-unassigned queue through dispatched touch gestures while keeping the page root non-scrolling.

## Local/static gates

- `npm exec -- tsc --noEmit` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `35/35`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npm run build` in `atlas-client`: PASS, built in `673ms`.

## Cockpit parity result

| Former cockpit outcome | Current path | Simulated result |
|---|---|---|
| Find readiness blockers | Dashboard readiness hub and repair links | Preserved |
| Inspect unresolved sessions | Simple view primary action / task drawer | Preserved |
| Preview placement before save | Generated placement review sheet | Preserved |
| Read grid-wide conflict guidance | Status key + cell labels | Preserved |
| Preview occupied-session swap | Modern visual swap review | Preserved |
| Cancel risky actions | Cancel/Escape review sheets | Preserved |
| Reach expert controls | Simple ↔ Advanced toggle | Preserved |
| Preserve Teaching Load ownership | Review copy locks teacher ownership outside timetable | Preserved |

## Remaining limitation

The simulated run cannot measure:

- real hesitation wording;
- actual older-user confidence;
- misread text under real eyesight/lighting conditions;
- real hand tremor/touch precision;
- moderator hint frequency;
- participant belief about whether the workflow “feels simple.”

If real Scheduler Officers become available later, rerun the shared protocol before declaring full Product GO.

## Decision

The older-user remediation stream is **ready to move forward from a technical/browser-proxy standpoint**. Treat the product decision as:

```text
GO WITH LIMITATION — simulated older-user validation substituted by stakeholder instruction.
```

