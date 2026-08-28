# Prompt UX-06 — Live Verification and Closure

## Objective

Replace source-based confidence with live Tailnet evidence and close the UX overhaul only when representative users can succeed.

## Verification Matrix

- Roles: scheduler/admin, faculty, unauthenticated public user.
- Viewports: 1440 desktop, 768 tablet, 375 portrait, mobile landscape.
- Input: mouse, keyboard-only, and touch emulation.
- Accessibility: axe or equivalent, screen-reader landmarks, focus order, visible focus, 200% zoom, 400% reflow, reduced motion, and contrast.
- States: loading, empty, error, offline, queued, syncing, success, blocked, stale, and destructive confirmation.

## Required Journeys

1. Scheduler identifies the next readiness blocker and reaches the correct fixing page.
2. Scheduler reviews an issue, previews a safe change, confirms it, and sees the saved result.
3. Scheduler understands why publish is allowed or blocked.
4. Faculty finds today’s schedule.
5. Faculty submits a room request online and queues one offline.
6. Public user finds a section schedule without signing in.

## Older-User Sessions

Run at least five moderated sessions with representative low-confidence users. Do not teach the interface during the task. Record completion, errors, hesitation points, help requests, and user wording.

Target gates:

- At least 90% completion for core faculty and public tasks.
- At least 85% completion for scheduler readiness and review tasks.
- Zero critical accessibility blockers.
- Zero page-level horizontal overflow at required viewports.
- Median first-action discovery under five seconds.
- No participant loses work without a visible recovery path.

## Evidence Rules

- Use the live Tailnet environment by default.
- Record exact URL, role, viewport, date, result, and artifact link in `docs/verification/evidence-log.md`.
- Label localhost or source-only results as local evidence.
- Keep the phase NO-GO while Tailnet evidence is missing unless the stakeholder explicitly accepts narrower proof.

## Exit Gate

Update phase status only after all required journeys and accessibility gates pass with evidence. Record unresolved findings as owned backlog items with severity and target phase.
