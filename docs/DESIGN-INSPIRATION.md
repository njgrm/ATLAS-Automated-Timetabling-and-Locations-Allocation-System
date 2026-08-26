# ATLAS Design Inspiration and Pattern Mapping

## Purpose
This document translates proven product design patterns into practical implementation guidance for ATLAS.

Use this together with:
- `docs/DESIGN.md` (authoritative system rules)
- `docs/phases/faculty-mobile-wireframe-spec.md` (faculty interaction blueprint)

## How To Use This File
For each UX problem:
1. Find a matching pattern family below.
2. Apply the "ATLAS translation" notes, not direct UI cloning.
3. Validate against the target role for the surface (scheduler/admin/faculty/public).

---

## Pattern Family 1: Guided Complex Workflows
### Inspiration
- Atlassian onboarding and spotlight tour patterns (multi-step "Next/Back/Done")
- Step indicators with explicit progress

### Why it matters for ATLAS
Faculty room/time requests and scheduler review/decision workflows are multi-step and high-stakes. Users must understand sequence and status immediately.

### ATLAS translation
- Require visible step state: `1 Select Class`, `2 Choose Target`, `3 Review & Submit`.
- Add first-visit auto-tour + replay button.
- Keep each tour step short, task-focused, and action-led.
- Avoid long static instructions above fold.
- Apply equivalent guided flows for scheduler decision queues and admin setup/configuration flows where complexity is high.

---

## Pattern Family 2: Admin-Style Clarity Without Overload
### Inspiration
- Shopify Polaris page hierarchy and empty-state/action patterns
- "One dominant action + supporting context"

### Why it matters for ATLAS
ATLAS spans multiple roles with different complexity needs. Faculty/public pages risk overload, while scheduler/admin pages risk clutter and unclear prioritization.

### ATLAS translation
- Default to "My schedule first"; global context is optional.
- Keep one dominant CTA above fold.
- Use plain-language empty/error states with explicit next actions.
- Provide secondary "Learn more" only when needed.
- On scheduler/admin pages, preserve dense data but make "what needs action now" obvious through hierarchy and gate indicators.

---

## Pattern Family 3: Responsive Dense Data Layouts
### Inspiration
- Carbon responsive grid and enterprise shell patterns
- Breakpoint-specific layout behavior, not one layout stretched everywhere

### Why it matters for ATLAS
Scheduler and admin workspaces are data-dense by necessity; faculty/public workflows should remain focused and guided.

### ATLAS translation
- Mobile: stacked, guided, single primary scroll.
- Desktop: split workspace maximizing schedule area and request panel.
- Do not force desktop-width grids onto mobile.
- Keep desktop and mobile as first-class, intentionally different layouts.
- Separate role defaults:
  - Faculty/Public: focused context first.
  - Scheduler/Admin: operational context first with progressive detail controls.

---

## Pattern Family 4: Realtime Collaboration Feedback
### Inspiration
- Live presence indicators in collaborative tools
- Minimal, non-intrusive "who is viewing/editing"

### Why it matters for ATLAS
Faculty and schedulers operate on shared draft context; admins may monitor operational health and decisions.

### ATLAS translation
- Show compact `Live N` indicator and optional participant details.
- Keep cell/session focus indicators subtle.
- If channel disconnects, show a clear fallback state and retry behavior.
- Ensure role-appropriate visibility:
  - faculty: minimal collaboration cues,
  - scheduler/admin: richer operational context where needed.

---

## Pattern Family 5: Offline Confidence UX
### Inspiration
- Action-state feedback in resilient SaaS tools
- Queue/sync state visibility

### Why it matters for ATLAS
All operational roles need confidence in action durability, especially faculty and scheduler users on unstable networks.

### ATLAS translation
- Always show one sync status rail:
  - `Queued`, `Syncing`, `Synced`, `Failed`.
- Require plain-language offline disclaimer on submit:
  - "Waiting for connection before submitting."
- Provide obvious retry action for failures.

---

## Pattern Family 6: Plain-Language Copy System
### Inspiration
- Task-oriented product copy standards across enterprise SaaS

### Why it matters for ATLAS
Low digital literacy users should not decode technical phrases; even advanced roles benefit from concise action-led language.

### ATLAS translation
Every important message must include:
1. What happened
2. What to do now
3. Who to contact if blocked

Avoid terms like:
- "context hydration"
- "active draft run" (as primary user-facing phrase)
- "generation gate blocked"

Prefer:
- "Your schedule is still being reviewed."
- "Choose one class to continue."
- "Submit your request and wait for scheduler decision."

---

## Recommended Product References (Behavioral)
Use for inspiration, not pixel-level copying:
- Zapier (guided setup, progressive disclosure)
- Atlassian Jira/Confluence patterns (onboarding tours, complex workflow hinting)
- Shopify Admin (action hierarchy, empty/error states)
- Carbon enterprise dashboards (dense data layout discipline)

## Role-to-Pattern Mapping

### Faculty
- Guided step flows, plain-language helper copy, compact status rails.
- Progressive disclosure of global schedule context.
- Strong offline queue/sync messaging.

### Scheduler
- Queue-first command center patterns:
  - pending decision queues,
  - conflict panels,
  - explicit gate blockers before generate/publish.
- Dense but scannable desktop workspace layouts.

### Admin
- Settings layout patterns:
  - sectioned configuration forms,
  - impact-aware confirmations,
  - audit and policy visibility.
- Avoid timetable-density unless admin is acting as scheduler.

### Public/Student
- Search-first and read-only patterns.
- Simple context chips (school/year/section).
- Fast loading and minimal branching.

---

## Design Review Checklist (Quick)
- Is the first action obvious in under 5 seconds?
- Does mobile avoid nested scroll traps?
- Is global schedule optional for faculty by default?
- Are all critical messages plain-language and actionable?
- Can a first-time faculty user complete one request without guessing?
- Does scheduler see action-priority signals before detail noise?
- Does admin configuration flow communicate impact and safety clearly?
- Is public/student schedule lookup fast and simple with no internal jargon?

If any answer is "no", iterate before feature expansion.
