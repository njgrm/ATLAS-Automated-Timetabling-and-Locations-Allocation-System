# Faculty Mobile Wireframe Spec (Room Requests + My Portal)

## Purpose
This spec defines the target mobile-first faculty UX for:
- `/my`
- `/my/preferences`
- `/my/room-preferences`

Use this as the visual/interaction baseline before coding. The audience is non-tech-savvy faculty users, so flows must be explicit, guided, and low-friction.

## UX Principles (Non-Negotiable)
- One obvious next action per screen.
- No hidden assumptions or discovery burden.
- Plain-language terms only.
- Mobile-first interaction first; desktop enhancements second.
- Keep users oriented at all times (where they are, what step they are in, what happens next).

## Global Mobile Shell

### Top App Bar (fixed)
- Left: hamburger menu button.
- Center: page title (`My Dashboard`, `My Preferences`, `My Room Requests`).
- Right: compact connectivity state chip (`Online`, `Offline`, `Syncing`).

### Mobile Navigation Drawer
- Use framer-motion slide-down (or top overlay sheet).
- Entries:
  - `My Dashboard`
  - `My Preferences`
  - `My Room Requests`
  - `Back to EnrollPro`
  - `Sign out`
- Remove duplicate faculty nav entries.
- Close drawer on route change and backdrop tap.

### Scroll Rules
- Desktop: preserve no-scroll architecture behavior.
- Mobile/tablet: allow one primary vertical content scroll region.
- Avoid nested-scroll traps in request builder UI.

## `/my` (Faculty Dashboard) Wireframe

### Content Order
1. Greeting and draft context (single compact hero)
   - Example: `Hello, Maria`
   - Example: `You are working on Draft Run #85`
2. Primary CTA (full width)
   - `Manage My Room Requests`
3. Compact status tiles (2x2)
   - Scheduled, Pending, Approved, Rejected
4. Schedule snapshot list (compact rows)
   - `Section · Subject · Day Time + status badge`
5. Plain-language notice/error block with Retry.

### Do Not
- Put dense analytics cards above the main CTA.
- Show verbose multi-panel comparison blocks by default on phones.

## `/my/preferences` Wireframe

### Content Order
1. One-line purpose text.
2. Time preference section (simple add/edit rows).
3. Well-being toggles section:
   - Pregnancy support
   - Physical ailment support
   - Minimize travel time
   - Avoid upper floors
4. Sticky action bar:
   - `Save Draft` (secondary)
   - `Submit` (primary)

### Offline Behavior
- If offline on submit: show plain disclaimer
  - `Waiting for connection before submitting.`

## `/my/room-preferences` Wireframe (Guided Flow)

### Overall Pattern
Use a 3-step guided flow for mobile instead of a desktop grid squeezed into narrow screens.

### Header
- Title: `My Room Requests`
- Subtext: `Follow these 3 steps to request a room/time change.`
- Step indicator chips:
  - `1 Select Class`
  - `2 Choose Target`
  - `3 Review & Submit`

### Step 1: Select My Class
- Show faculty-owned sessions first.
- Card content:
  - Subject + section
  - Day/time
  - Current room
  - Status badge
- Tap to select source session.
- Continue button: `Next: Choose Target`

Optional toggle:
- `Show full schedule context` (read-only for non-owned sessions).

### Step 2: Choose Target Slot/Room
- Mobile default: time-block list (not forced desktop-width matrix).
- Each target item shows:
  - Day/time
  - `Free` or `Occupied`
  - if occupied, short occupant summary
- Tap target opens bottom sheet:
  - action type suggestion (`Move` for free, `Swap` for occupied)
  - room selector when needed.

### Step 3: Review Conflicts + Submit
- Show:
  - request summary (`From` -> `To`)
  - conflict inspector:
    - hard conflicts (blocking direct apply path)
    - soft warnings (non-blocking)
  - reason text field (required only for conflict-causing swaps)
- Primary submit button.
- Scheduler approval expectation note.
- Offline disclaimer if disconnected.

## Realtime + Offline UX

### Persistent Sync Status Rail
Single visible strip near top of page:
- `Connected`
- `Saving changes...`
- `Queued (N) — waiting for internet`
- `Synced`
- `Could not sync (Try again)`

### Live Collaboration
- Compact `Live: N users` chip.
- Tap chip opens presence details.
- Subtle selection/viewing indicators only; avoid visual clutter.

## Plain-Language Copy Rules
- Replace technical terms with user language.
- Every error must include:
  1) what happened,
  2) what to do now,
  3) who to contact if still blocked.

Examples:
- `Cannot load session context` -> `We couldn't load your account details. Please tap Retry.`
- `No completed timetable run` -> `Your schedule isn't ready yet. Please wait for the scheduler to generate the draft.`

## UI Consistency Rules
- Status badges use consistent semantics:
  - Pending (neutral/blue)
  - Approved (green)
  - Rejected (amber/red)
  - Draft (outline)
- Use large touch targets and generous spacing.
- Preserve visible selected/active/focus states.

## Mandatory Manual QA Screenshots
1. Mobile portrait with hamburger drawer open.
2. Mobile portrait Step 1 (selected class).
3. Mobile portrait Step 2 (target chooser sheet).
4. Mobile portrait Step 3 (conflict review + reason field).
5. Mobile portrait offline queued state.
6. Mobile portrait reconnect synced state.
7. Desktop non-regression state.

## Acceptance Criteria
- Faculty can complete a room/time request on mobile without guessing.
- Mobile nav uses hamburger drawer, not persistent icon rail.
- No forced desktop-width layout on phones.
- Copy is plain-language and actionable.
- Existing active-draft, realtime, offline, and decision-gate behaviors remain intact.
