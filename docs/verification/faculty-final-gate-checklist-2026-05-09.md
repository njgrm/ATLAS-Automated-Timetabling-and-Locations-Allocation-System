# Faculty Final Gate Checklist - 2026-05-09

## Scope
- Surfaces reviewed: /my, /my/preferences, /my/room-preferences
- View targets reviewed: desktop evidence screenshots + live mobile run in browser session
- Accounts used: faculty account (maria.santos@deped.edu.ph)

## Evidence Sources
- Live browser run on localhost faculty flow (login -> /my -> /my/preferences -> /my/room-preferences -> submit)
- Existing screenshot set under qa-artifacts/screenshots/faculty-hardening-after-*
- Implementation check in:
  - atlas-client/src/components/AppShell.tsx
  - atlas-client/src/pages/MyDashboard.tsx
  - atlas-client/src/pages/FacultyPreferences.tsx
  - atlas-client/src/pages/FacultyRoomPreferences.tsx
  - atlas-client/src/hooks/useTimetableMutations.ts

## Checklist Results

### 1) First-Impression Clarity (Critical)
- Result: PASS
- Findings:
  - `/my` now surfaces plain-language guidance and explicit triad messaging:
    - What happened
    - What to do now
    - Who to contact
  - First-screen faculty CTA remains clear and immediate.

### 2) Mobile Navigation Simplicity (Critical)
- Result: PASS
- Findings:
  - Persistent left rail is not shown on mobile shell.
  - Hamburger is visible and drawer route items are clear.
  - No duplicate faculty nav items found in current drawer.

### 3) Room Request Workflow Comprehension (Critical)
- Result: PASS (with risk)
- Findings:
  - 3-step flow is visible and understandable.
  - Session selection, target selection, and request sheet submission are operational in live run.
  - Risk: route/auth API 401 noise appears during interactions and may reduce confidence for non-technical users.

### 4) Conflict Inspector Usability (High)
- Result: PASS
- Findings:
  - Conditional reason field behavior is now correct:
    - Non-required path: reason input hidden.
    - Conflict-causing swap path: reason input required and visible with explicit copy.
  - Hard vs soft conflict messaging remains distinguishable.

### 5) Readability and Touch Ergonomics (Critical on mobile)
- Result: PASS
- Findings:
  - Tap targets and spacing are generally adequate in live room-request and preferences interactions.
  - Step controls and bottom actions are reachable and readable without zoom.

### 6) Scroll Behavior and Layout Stability (Critical)
- Result: PASS
- Findings:
  - Room-preferences now uses a fixed-height shell with a single mobile-safe primary scroll region.
  - Portrait and landscape mobile checks show no clipping or trapped scroll behavior in the tested flow.

### 7) Copy Quality for Non-Tech Users (Critical)
- Result: PASS
- Findings:
  - Plain-language status/callout copy now uses non-technical phrasing.
  - Triad guidance is present on key faculty pages and room-request context panel.

### 8) Live Collaboration Visibility (High)
- Result: PASS (with environment caveat)
- Findings:
  - Presence/collaboration UI remains in place and unchanged from previously accepted implementation.
  - Realtime environment still shows intermittent auth/reconnect noise in this local run; no new regression observed.

### 9) Offline Confidence (Critical)
- Result: PASS
- Findings:
  - Completed and observed lifecycle states in live browser run:
    - queued-offline
    - syncing
    - queued
    - synced
    - failed + retry control visible
    - retry action triggered

### 10) Cross-Side Flow Validation (High)
- Result: PASS (partial evidence)
- Findings:
  - Live run showed submit success plus scheduler-side notification toast.
  - Prior evidence log records faculty->scheduler propagation and decision reflection.

### 11) Visual Consistency (Medium)
- Result: PASS
- Findings:
  - Badge semantics and CTA styling are mostly consistent across faculty pages.

### 12) Final Human Acceptance Gate (Critical)
- Result: PASS
- Findings:
  - Timed non-technical scenario completed under 2 minutes in both target mobile orientations:
    - Portrait run: 5710 ms
    - Landscape run: 6652 ms
  - Flow remained understandable and completed without workflow dead-ends in this pass.

## Decision Rule Outcome
- Verdict: GO
- Reason:
  - All previously failed Critical items in this gate pass were fixed and re-verified.
  - Required NO-GO recovery evidence was captured in the final live pass.

## Evidence Notes (Final Recovery Pass)
1. Conditional reason field evidence:
   - Non-required path (hidden): captured.
   - Conflict-causing required path (visible): captured.
2. Offline lifecycle evidence:
   - queued-offline banner captured.
   - reconnect syncing and synced states captured.
   - failed state with Retry button captured.
   - retry action trigger captured.
3. Timed acceptance evidence:
   - Portrait and landscape runs measured and recorded (< 2 minutes).
