# Copilot Execution Prompt: Faculty UX/UI Hardening Pass

## Title
`refactor(faculty-ui): mobile-first room requests with guided flow and top hamburger drawer`

You are doing a dedicated UX/UI hardening pass for faculty room requests.

## Spec References (Read First)
Before coding, compare your findings against:
- `docs/DESIGN.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`
- this prompt file

If your audit differs from these references, explicitly document where and why before implementation.

## Non-negotiable UX goal
Design for non-tech-savvy faculty users.
No assumptions. No discovery burden.
Every step must be obvious and guided.

## 1) Start with UX audit, then implement
Before coding, run a quick UX audit in shared browser for:
- `/my`
- `/my/preferences`
- `/my/room-preferences`

Viewports:
- desktop
- mobile portrait
- mobile landscape

Credentials:
- faculty: `maria.santos@deped.edu.ph` / `DepEd2026!`
- admin: `admin@deped.edu.ph` / `Incorrect_404`

Log top UX blockers and map each blocker to a concrete fix before writing code.

## 2) Mandatory UI architecture changes (faculty mobile)

### A. Replace mobile sidebar with top hamburger drawer
On mobile/tablet breakpoints:
- hide persistent left sidebar rail
- show top app bar with hamburger button
- open nav as framer-motion slide-down/overlay drawer from top

On desktop:
- keep existing sidebar behavior

Ensure no duplicated nav items for faculty.

### B. Remove mobile broken grid behavior in room requests
- Do not force desktop-width grid (`minWidth` patterns that cause unusable scrolling).
- Replace with mobile-first stacked workflow:
  - Step 1: Select my class session
  - Step 2: Select target slot/room
  - Step 3: Review conflicts + submit request
- Use bottom sheet/modal stepper for action composition.
- Keep desktop enhanced layout, but make mobile single-column and readable.

### C. One obvious action per screen
- `/my`: one dominant CTA at top (`Manage My Room Requests`).
- `/my/room-preferences`: show a persistent current-step indicator.
- Add plain-language helper text at each step.

### D. Simplify language to layman terms
Replace technical copy with plain language:
- `Cannot load session context` -> `We couldn't load your account details. Please tap Retry.`
- `No completed timetable run...` -> `Your schedule isn't ready yet. Please wait for the scheduler to generate the draft.`

Keep messages short and actionable.

### E. Improve mobile touch ergonomics
- Larger tap targets (comfortable mobile size).
- More spacing between session cards.
- Clear selected state and conflict warning states.
- Avoid cramped multi-column card layouts on small screens.

## 3) Keep existing behavior working
Do not regress:
- active-draft-only data context
- SSE/WebSocket live updates
- offline queue + auto-sync
- request decision propagation
- generation decision gate rules

## 4) Required verification

### Automated
Run full build + existing phase suites.

### Manual QA (shared browser)
Verify with screenshots:
- mobile portrait: hamburger opens/closes and routes correctly
- mobile landscape: no broken clipping/overlap
- `/my/room-preferences` step flow is clear and operable
- offline submit shows `waiting for connection before submitting`
- reconnect auto-sync visibly resolves queued action
- desktop still works (no regressions)

Update `docs/verification/evidence-log.md` with pass/fail and screenshot links.

## Acceptance criteria
Pass only if:
- faculty can complete room request on mobile without guessing,
- left icon rail is replaced by top hamburger drawer on mobile,
- no broken desktop-width grid behavior on phone sizes,
- copy is plain-language and actionable,
- all tests and manual QA pass.

## Required output from this pass
1. UX audit findings (before coding), compared against `faculty-mobile-wireframe-spec.md`.
2. List of implemented changes mapped to each blocker.
3. Automated test summary.
4. Manual QA summary with screenshot references.
5. Final pass/fail decision.
