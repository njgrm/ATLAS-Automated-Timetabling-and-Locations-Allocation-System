# ATLAS Older-User Session Validation Remediation Plan

Date: 2026-07-28  
Source audit: `docs/verification/older-user-session-validation-codex-2026-07-28.md`  
Shared protocol: `docs/prompts/older-user-session-validation-shared-protocol-2026-07-28.md`  
Execution target: `https://njgrm.buru-degree.ts.net`

## Purpose

This stream addresses the bounded issues found by the Codex older-user self-audit while preserving the useful outcomes of the former timetable cockpit. It is deliberately separate from the canonical generator-readiness phase in `phasePlan.md`; it must not change source ownership, generation rules, or persisted timetable data unless a later finding proves that necessary.

The stream is complete only when the technical proxy gates pass **and** moderated older-user evidence satisfies the shared protocol. Automated browser success alone cannot produce Product GO.

## Progress

- **Phase 0 — GO (2026-07-28):** Read-only fixture, frozen task/capability contracts, write guard, focus trace, and scroll diagnostics passed `9/9` across all three Tailnet viewport projects. Closure: `docs/verification/older-user-session-remediation-phase-0-closure-2026-07-28.md`.
- **Phase 1 — GO (2026-07-28):** Shared six-state `TimetableStatusLegend` is reachable in Simple and Advanced views across all Tailnet viewport projects. Pointer-wide guidance was moved off React drag-start state and the mandatory performance matrix passed `42/42`. Closure: `docs/verification/older-user-session-remediation-phase-1-closure-2026-07-28.md`.
- **Phase 2 — GO (2026-07-28):** Dashboard now separates source connection from setup repair steps, gives explicit wait-versus-repair guidance for saved/unavailable source states, and lazy-loads lower campus room details to protect first-action timing. Closure: `docs/verification/older-user-session-remediation-phase-2-closure-2026-07-28.md`.
- **Phase 3 — GO (2026-07-29):** Generated placement, generated occupied-slot swap, and draft placement review dialogs now capture the invoking control, focus the review sheet deterministically, announce preview loading/error state, and restore focus after Escape/Cancel across all Tailnet viewport projects. Closure: `docs/verification/older-user-session-remediation-phase-3-closure-2026-07-29.md`.
- **Phase 4 — GO (2026-07-29):** Generated-unassigned touch scrolling now advances the virtualized queue on mobile portrait and landscape without global page scroll; click-to-place remains usable after scrolling; 200% reflow checks pass for the drawer, queue, status key, and review sheet. Closure: `docs/verification/older-user-session-remediation-phase-4-closure-2026-07-29.md`.
- **Phase 5 — GO WITH LIMITATION (2026-07-29):** Real Scheduler Officer sessions were unavailable, so Codex completed a simulated five-participant validation using the shared T01–T12 protocol, browser-proxy evidence, and static/build gates. The stream is technically ready to move forward, but full Product GO remains unclaimed unless stakeholder accepts simulated evidence as sufficient. Closure: `docs/verification/older-user-session-validation-final-simulated-2026-07-29.md`.

## Audit findings mapped to work

| Finding | Required outcome | Planned phase |
|---|---|---|
| OUSER-001: status meaning is hidden or incomplete in Simple/mobile | All six states are discoverable without switching modes, color, or hover | Phase 1 |
| OUSER-002: source uncertainty competes with repair urgency | Dashboard gives one explicit wait-versus-repair decision and separates source health from setup work | Phase 2 |
| OUSER-003: controlled dialogs do not prove focus restoration | Placement/swap dialogs contain focus, support Escape, and return focus to the invoking control | Phase 3 |
| Mobile scroll is only partially represented by mouse-wheel proxy | Real touch scrolling is verified against a stable reversible fixture; code changes happen only if touch fails | Phase 4 |
| Human thresholds are unvalidated | Five or more representative schedulers complete T01–T12 with exact wording and scores | Phase 5 |

## Execution rules

1. Execute one phase at a time.
2. After each phase, run its focused gate, the local gates, and the relevant regression matrix before starting the next phase.
3. Use Admin QA only and intercept or cancel every write-sensitive timetable action.
4. Do not use a fixture that changes the live source-of-truth dataset.
5. Preserve click/tap alternatives for every drag action.
6. Keep the grid status key outside the per-cell hot render path.
7. Do not reintroduce timetable-owned teacher assignment.
8. Follow the ATLAS no-scroll architecture, Radix/shadcn controls, visible focus rules, and 24px minimum / 44px task-control target guidance.

## Phase 0 — Baseline, fixtures, and test-contract hardening

### Objective

Create stable, evidence-first contracts for the remediation work before changing UI code.

### Work

- Add a shared audit fixture helper that records the active run, school year, queue count, and source state without mutating data.
- Add explicit test helpers for `Simple`, `Advanced`, task drawer, placement review, swap review, and safe cancellation.
- Add a mobile touch-scroll probe that uses a real touch gesture where Playwright supports it; retain programmatic scroll only as a diagnostic.
- Add a focus probe that records the invoking element, first dialog focus, Tab progression, Escape close, and restored focus identity.
- Mark all tests as `Browser proxy` evidence and keep human scores separate.
- Freeze the T01–T12 task wording and cockpit capability-parity matrix in the test artifact.

### Acceptance gate

- `older-user-session-validation-codex.spec.ts` runs all three viewport projects without writes.
- The fixture reports the same run/source context before and after every task.
- A test fails if a placement or swap commit endpoint is called.
- A test can distinguish “touch gesture unsupported by the runner” from “scrollable region failed.”
- No product component code changes are required in this phase.

### Exit evidence

`docs/verification/older-user-session-remediation-phase-0-closure-2026-07-28.md` plus JSON artifacts under `qa-artifacts/older-user-session-remediation/phase-0/`.

## Phase 1 — Six-state status guidance in Simple and mobile views

### Objective

Make `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, and `Current` understandable at the point of work without switching to Advanced mode or relying on color/hover.

### Work

- Extract a memoized `TimetableStatusLegend` component from the existing header copy.
- Place it in the Simple task prompt/drawer as a compact disclosure or popover reachable at every viewport.
- Include plain-language definitions for all six states, including contextual `Occupied` and `Current`.
- Keep the full grid-wide guidance behavior and do not recompute conflicts from the legend.
- Preserve `aria-describedby`, visible focus, and an accessible name for the disclosure.
- Keep the default Simple header compact.

### Acceptance gate

- Desktop, mobile portrait, and mobile landscape can reach all six definitions from Simple without entering Advanced.
- The key is not communicated by color alone and remains readable at 200% zoom.
- Grid render containment and performance gates remain green.
- Existing placement, swap, draft, and drag tests remain green.

### Exit evidence

Focused spec: `older-user-status-guidance.spec.ts`.  
Expected local gates: UX guardrails, timetable conflict, TypeScript, build.  
Expected Tailnet gate: T06–T10 subset across all three viewport projects.

## Phase 2 — Dashboard source-health versus repair clarity

### Objective

Help an older operator decide whether to repair saved setup data now or wait for the EnrollPro/source connection, without changing ownership or fallback behavior.

### Work

- Separate source-health status from the setup repair steps in the Dashboard readiness hub.
- Add one explicit decision sentence for unavailable/stale source states.
- Keep the current source badge, stale/read-only meaning, and direct repair links.
- Add distinct states for verified, stale/cached, unavailable, and checking.
- Reuse the runtime source-of-truth map; do not introduce a second resolver or silently switch school years.

### Acceptance gate

- A source-unavailable fixture shows a clear wait-versus-repair instruction and still exposes repair links.
- A verified-source fixture does not show outage language.
- Dashboard readiness remains visible within the existing first-action budget and has no global scrollbar.
- No API ownership, persistence, or school-year selection behavior changes.

### Exit evidence

Focused spec: `dashboard-source-health-guidance.spec.ts`.  
Runtime proof: `/api/v1/health` and the exact runtime-context route remain healthy.

## Phase 3 — Controlled-dialog focus restoration

### Objective

Make placement and swap review sheets fully keyboard-safe and predictable after Cancel or Escape.

### Work

- Store the invoking queue button or grid-cell element when opening generated placement, draft placement, and occupied-slot swap review.
- Ensure the dialog receives focus and keeps focus contained while open.
- Restore focus to the invoking control after Escape, Cancel, or a failed preview.
- Preserve existing controlled `open` / `onOpenChange` cleanup and explicit save/commit boundaries.
- Add accessible status text for preview-loading and preview-error transitions.
- Verify that focus restoration survives rerenders caused by async preview responses.

### Acceptance gate

- Each review surface passes: focus enters dialog, Tab remains within dialog, Escape closes, focus returns to the exact source control.
- Cancel never calls a write endpoint.
- Save/Swap remains the only commit path.
- Generated, draft, and occupied-slot swap flows pass on desktop and mobile keyboard emulation.
- Existing no-teacher-assignment and visual-review contracts remain green.

### Exit evidence

Focused spec: `timetable-review-focus-and-cancel.spec.ts`.  
Required artifacts: focus trace JSON, failed-focus screenshot/trace if any, and the Phase 0–3 regression matrix.

## Phase 4 — Touch scrolling and responsive interaction proof

### Objective

Prove that the unassigned queue is usable by touch and that compact mobile surfaces do not hide the only path to the next action.

### Work

- Run the generated-unassigned list with a real touch gesture on mobile emulation or a physical-device/browser proxy that supports it.
- Verify the list’s scroll container, touch-action, pointer capture, and nested drawer boundaries.
- If touch scrolling fails, make the smallest scoped fix in `VirtualizedRailList.tsx` / `GeneratedRunRailPanels.tsx`.
- Do not replace virtualization or add a page-level scrollbar.
- Verify click-to-place remains available when dragging is unavailable.
- Repeat 200% zoom/reflow checks for the task drawer, queue, status key, and review sheet.

### Acceptance gate

- A touch gesture visibly advances the unassigned queue on portrait and landscape profiles.
- The page root remains non-scrolling.
- Only the intended queue/drawer region scrolls.
- The queue remains usable with 365+ unassigned items and no excessive render work.
- T07–T12 pass with no mutation and no stale selection after scrolling.

### Exit evidence

Focused spec: `timetable-touch-queue-and-reflow.spec.ts`.  
Artifacts: touch scroll metrics, viewport screenshots, and performance trace summary.

## Phase 5 — Moderated older-user and external closure

### Objective

Determine whether the simplified interface is genuinely easier for older, non-technical schedulers rather than merely passing automation.

### Work

- Run T01–T12 with at least five representative Scheduler Officers or equivalent operators.
- Record exact participant wording, hesitation, hints, errors, and whether a capability was missing versus merely hard to find.
- Run Antigravity’s independent Browser Playwright protocol against the same phase artifacts.
- Reconcile Codex, Antigravity, and participant findings without averaging away a critical safety failure.
- Update the audit report and phase ledger only after evidence is complete.

### Product gate

- Product GO requires:
  - at least 80% of T01–T08 and T12 completed independently or with one hint by each participant;
  - at least 90% correct interpretation of the six statuses;
  - no participant believes timetable placement assigns teachers;
  - no critical action depends on color alone;
  - no participant is unable to cancel a risky action safely;
  - no cockpit capability is removed as a shortcut to better timing.
- If the technical gates pass but human thresholds do not, mark `GO WITH FIXES` or `NO-GO` and create a new bounded remediation phase.

### Exit evidence

- `docs/verification/older-user-session-validation-final-2026-07-28.md`
- Antigravity report artifact
- Participant score sheets with anonymized roles/device profiles
- Updated `docs/verification/evidence-log.md`

## Verification matrix

Every implementation phase must run the following unless a phase-specific note narrows it:

```text
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build

cd D:\ATLAS
npx playwright test -c playwright.config.ts \
  qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts \
  --workers=1
```

Then run the phase-specific Tailnet spec across `desktop`, `mobile-portrait`, and `mobile-landscape`, followed by the relevant timetable workflow/performance regression specs. All write-sensitive tests must intercept generation mutations or stop before Save/Swap.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Status key adds visual density | Use a compact disclosure/popover, not a persistent card; keep Simple header height budget unchanged |
| Focus restoration races async preview | Capture the ref before opening; restore in a guarded close effect after state settles |
| Source wording implies wrong authority | Reuse runtime source-of-truth contract and test verified/stale/unavailable fixtures separately |
| Mobile queue fix reintroduces page scroll | Assert root scroll metrics on all profiles and inspect only the queue scroll container |
| Automation overstates older-user success | Keep browser proxy and human evidence separate; do not issue Product GO from Playwright alone |
| Cleanup changes remove cockpit capability | Maintain the capability-parity matrix and require placement/swap/cancel/advanced outcomes in every regression run |

## Planned sequence

`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5`

Phase 0 is a prerequisite for reliable measurements. Phases 1–3 are implementation phases. Phase 4 is conditional: if touch scrolling passes, record evidence and avoid unnecessary code changes. Phase 5 is the final product decision gate.
