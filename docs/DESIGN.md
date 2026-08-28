# ATLAS Design System Playbook

## Purpose
This document is the primary UI/UX direction for ATLAS. It replaces ad-hoc design choices with clear rules for building scheduler, admin, faculty, and public/student experiences that are easy to understand and operationally safe.

Use this document as a required reference before implementing any major UI surface.

## Visual Identity (SMART-family aligned)
ATLAS shares SMART's product-family feel so users perceive both products as part of one campus system. SMART alignment means layout rhythm, token architecture, role-specific portals, clear task cards, and modern shadcn/Radix interactions. It does not mean copying SMART's grading domain or hard-coding SMART's default green palette.

EnrollPro/HNHS remains the source for school identity tokens where available. On Tailnet HNHS, primary brand surfaces must render from the maroon token (`--primary = 360 75% 30%`), not emerald. Emerald is reserved for universal success/correctness signals such as done states, ready states, and zero-blocker states.

### Brand surface
- Page wash: token-tinted light slate/white canvas, defined globally in `index.css`, using `hsl(var(--primary) / 0.04-0.07)` rather than a fixed emerald wash.
- Primary brand color: the configured school token. Use `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `text-primary-foreground`, `shadow-primary-glow`, `hsl(var(--primary))`, or SMART-compatible aliases derived from those tokens.
- Secondary accents: `sky-500/600` for read/info, `violet-500/600` for student-context, `amber-500/600` for warnings, `red-500/600` for destructive only, and emerald for success/correctness.
- Never use hard-coded `bg-emerald-*`, `text-emerald-*`, `from-emerald-*`, or `shadow-emerald-*` for brand/primary identity. Use emerald only when the state means ready, done, valid, active school year, or zero blockers.
- Never reach for raw `slate-900` text. Use `text-slate-900` for headings, `text-slate-500` for body, `text-slate-400` for muted.

### Typography
- Font family: `Instrument Sans` (variable), already loaded via `@fontsource-variable/instrument-sans`. Fallback to `Geist Variable`, system.
- Letter-spacing: `0` on body text, headings, buttons, navigation labels, and compact UI. Do not use negative letter spacing or viewport-scaled typography.
- Heading scale: `h1 = text-3xl font-bold text-slate-900`, `h2 = text-xl font-bold`, `h3 = text-lg font-semibold`. Page titles always use `text-3xl font-bold`.
- Body: 16px base (15px on ≤640px), `line-height: 1.6`, weight 500 by default.

### Cards and surfaces
- Default card: `border-0 shadow-soft rounded-2xl bg-white`. Use `shadow-soft-xl` for primary feature cards.
- Padding: `p-5` for compact status cards, `p-6` for stat tiles, `p-6 lg:p-8` for large feature/banner cards.
- Card headers: optional `<CardHeader>` with `border-b border-slate-100 px-6 py-4`. Tint feature-card headers with `bg-primary/5` when marking a primary action card.
- Empty card padding override: when nesting a `<ScrollArea>` or list, set the card to `p-0` and pad inside.
- Hover state: stat tiles and quick-action cards use `hover:shadow-soft-xl transition-all duration-300`. Icon inside a tile uses `group-hover:scale-110 transition-transform`.

### Stat tiles (SMART pattern)
- Layout: `grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6`.
- Each tile: white card, label (`text-sm font-medium text-slate-500`), value (`text-3xl font-bold text-slate-900 tabular-nums`), icon in a `p-3 rounded-xl text-white shadow-lg ring-4 ring-{tone}-100 bg-{tone}-500` square at top-right.
- Footer divider: `mt-5 pt-4 border-t border-slate-100`, with a `CheckCircle2` or `AlertTriangle` icon followed by tone-colored caption text.

### Buttons and CTAs
- Primary CTA: `bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-primary-glow gap-2`. Always paired with a leading `lucide-react` icon and optional trailing `ArrowRight` for forward navigation.
- Secondary: `variant="ghost"` with `rounded-lg text-slate-500 hover:text-slate-900 gap-1` and a trailing `ChevronRight`.
- Pills/badges: `border-0 rounded-full bg-primary/10 text-primary` for selected brand state; `bg-emerald-50 text-emerald-700` for success; `bg-amber-100 text-amber-700` for warnings; `bg-white/15 text-white backdrop-blur` on top of token-gradient banners.

### Lifecycle / progress banners
- Use a single token-gradient feature card per page when surfacing lifecycle context: an inline or utility gradient based on `hsl(var(--primary))`, `hsl(var(--primary) / 0.92)`, and `hsl(var(--primary) / 0.78)`.
- Inside the banner, render steps as a horizontal list with three tones: active (`bg-white text-slate-900`), done (`bg-white/15 text-white backdrop-blur`), upcoming (`bg-white/5 text-emerald-50/70`).
- Never stack two gradient banners on the same page.

### Navigation And Workflow IA
- Sidebar order must follow the scheduler's workflow, not module ownership: Dashboard -> School Setup -> Teachers and Rooms -> Timetable -> Review and Publish -> Audit.
- Keep sidebar links few and action-oriented. Do not expose locked/disabled future modules such as Analytics in the primary sidebar.
- Do not keep Input Collection and Room Requests as separate admin sidebar destinations. Preference collection, room requests, and scheduling exceptions should live inside the Timetable workspace as tabs, panels, or contextual queues unless a task has a strong standalone reason.
- Campus and rooms belongs near setup/readiness and should also be reachable from dashboard and Timetable context where room readiness affects generation.
- Cross-app EnrollPro return links should live in a user/system menu or low-emphasis switcher, not as prominent primary navigation.

### Campus Map And Room Editor
- The dashboard must still contain a campus/map interface, but it should be a simplified readiness preview, not a crowded editor. Show a clean campus preview, selected building summary, readiness chips, and one obvious action.
- `/map` must default to a read-first campus overview. Editor mode is explicit and task-based.
- The map editor must organize controls by task: Select, Draw, Rooms, Photo, History, Save. Avoid one long toolbar.
- Building details should start with plain fields users understand: building name, teaching-room readiness, floors, and room list. Advanced placement fields (`X`, `Y`, `Width`, `Height`, rotation) stay collapsed under `Advanced placement`.
- Building colors should be calm and named. Avoid rainbow-first palettes. Use token primary only for selected/active state, not random building fills.
- Room and building copy must be human-readable: `Room label prefix`, `Capacity`, `Campus photo`, `Draw building`, `Teaching room`, `Not used for scheduling`. Avoid `Short Code`, `Cap:`, seeded matching, coordinate labels, or implementation details in the primary path.
- Icon-only map controls must use `Button` plus `Tooltip` and `aria-label`. Never use native `title` attributes.

### Spacing rhythm
- Page container: `max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8`.
- Stat row → status row → feature row → lifecycle banner is the canonical SMART-family page rhythm. Reuse this skeleton for admin/scheduling pages.

### Animation
- All page roots: `animate-fade-in` (defined in `index.css`).
- Cards: `transition-all duration-300` for shadow/scale hover only. No bouncing, no parallax.

### Anti-patterns banned by this section
- Sharp 4px or 8px radii on cards (use `rounded-2xl` minimum).
- Heavy borders (`border` + `border-slate-200`) on stat cards — use shadow instead.
- Decorative oversized hero blocks with no information density.
- Flat white shells without the body gradient — the gradient must show at the page edges.
- Multiple competing primary CTAs in a single header.
- Stale EnrollPro-style admin chrome as the visual target. Preserve useful constraints and school tokens, but do not make ATLAS look like an EnrollPro back-office extension.
- Standalone sidebar links for every internal queue when the work belongs inside Timetable.

## Design Goals
- Make first-time usage obvious in under 5 seconds.
- Reduce cognitive load on data-dense scheduling workflows.
- Keep mobile and desktop as separate first-class experiences, not one stretched layout.
- Use plain language and explicit next actions.
- Keep collaboration and offline behavior visible and trustworthy.

## Audience Assumption (Default)
Design for mixed digital literacy across all roles:
- Faculty and public/student users may be low-tech and easily overwhelmed.
- Scheduler and admin users may be operationally experienced but still need speed, clarity, and low error risk.

Design for guided success, not discovery.

## Core Interaction Principles

### 1) One Obvious Next Action
Each screen must have one dominant primary action.

Do:
- Put the primary CTA above fold.
- Keep secondary actions visually lighter.

Do not:
- Present multiple equal-priority actions at once.

### 2) Progressive Disclosure
Show only what users need now.

Do:
- Default faculty views to "My schedule" first.
- Hide global/full context behind an explicit toggle.

Do not:
- Force scheduler-level density by default on faculty pages.
- Force faculty/public simplifications onto scheduler/admin power workflows.

### 3) Guided Steps for Complex Tasks
For complex flows (room/time requests), use step-based UX:
1. Select class
2. Choose target
3. Review conflicts and submit

Do:
- Show current step persistently.
- Explain what to do in one sentence per step.

### 4) Plain-Language Copy
All user-facing text must answer:
1) What happened
2) What to do now
3) Who to contact if still blocked

Preferred wording:
- "Your schedule is still being reviewed."
- "Choose one class to continue."
- "Waiting for connection before submitting."

Avoid:
- "context hydration"
- "active draft run" as leading message
- "generation gate blocked" without explanation

### 5) Trust Through Status Visibility
Realtime and offline behavior must be explicit:
- Connected / Offline
- Queued / Syncing / Synced / Failed
- Retry action when failed

Users should never wonder if their request was saved.

### 6) Role-Appropriate Complexity
Complexity is allowed only where role responsibility requires it.

Do:
- Keep faculty and public surfaces simple, guided, and action-first.
- Keep scheduler/admin surfaces information-rich but organized with clear control hierarchy.

Do not:
- Flatten all roles into one UX model.
- Expose advanced controls to roles that do not need them.

## Responsive Layout Rules

### Mobile (Primary for faculty)
- Top app bar + hamburger drawer (no persistent icon rail).
- Single primary vertical scroll region.
- Large touch targets and clear selected states.
- Bottom sheet/stepper for request composition.

### Desktop
- Maximize content area.
- Use role-appropriate layouts:
  - Faculty: own schedule + request builder (not global overload by default).
  - Scheduler: data-dense review workspace with strong conflict visibility and fast triage actions.
  - Admin: account/governance/configuration views with safe defaults and audit visibility.
  - Public/Student: search-first, read-only schedule lookup with minimal branching.
- Keep desktop non-scroll architecture where intended, but never at cost of operability.

## Pattern Library (Recommended)

### Onboarding / Tours
Reference: Atlassian spotlight/onboarding patterns.

Apply in ATLAS:
- first-visit guided tour on complex pages,
- 3-5 short steps,
- explicit "Next", "Back", "Done",
- optional replay button.

### Empty/Error States
Reference: Shopify Polaris Empty State guidance.

Apply in ATLAS:
- one-line heading,
- clear action button,
- secondary "Learn more" link when needed,
- no dead-end error blocks.

### Data-Dense Layouts
Reference: Carbon grid and shell patterns.

Apply in ATLAS:
- responsive column behavior by breakpoint,
- clear hierarchy between workspace and supporting panels,
- consistent notification styles (inline/toast/actionable).

## Product Inspiration Targets
Use these products as behavioral inspiration, not visual cloning:
- Zapier: guided task building and progressive setup.
- Atlassian: onboarding spotlights for complex interfaces.
- Shopify Admin/Polaris: actionable empty states and admin clarity.
- Carbon enterprise apps: structured dense data layout.

## Role-Specific Experience Standards

### Scheduler Experience Standards
- Default workspace should prioritize queue, conflicts, and decisions requiring action.
- High-density data must still preserve scannability:
  - compact stat banner,
  - clear severity grouping,
  - obvious blocking states before generate/publish.
- Decision workflows must be keyboard/mouse efficient on desktop.
- Where mobile scheduler access is needed, provide reduced but safe control set.

### Admin Experience Standards
- Configuration and account management should follow "safe by default" patterns:
  - clear impact messaging,
  - explicit confirmation for destructive actions,
  - strong audit visibility.
- Admin pages should be form-centric and sectioned (settings layout pattern), not timetable-centric.
- Keep policy/state controls understandable without backend jargon.

### Faculty Experience Standards

### `/my`
- greeting + current context in plain language,
- one dominant CTA,
- compact summary tiles,
- short schedule preview list.

### `/my/preferences`
- clear section grouping,
- sticky action area for save/submit,
- plain-language field labels.

### `/my/room-preferences`
- default to "My classes" list,
- optional "Show full schedule context" toggle,
- guided 3-step request flow,
- conflict inspector with clear hard vs soft treatment,
- reason required only for conflict-causing swaps.

### Public/Student Experience Standards
- Public schedules must be read-only, fast, and searchable.
- Prioritize:
  - simple search and filtering,
  - clear current context (school/year/section),
  - printable/shareable view.
- Avoid exposing internal draft/review concepts in public views.

## Collaboration UX Standards
- Presence indicators must be visible but low-noise.
- "Live N" should be understandable and not block work.
- Selection indicators should identify actor + target briefly.
- Realtime failures must degrade gracefully with clear fallback notice.

## Governance and Safety UX Standards
- Any gate rule (e.g., "all requests decided before generate") must be visible as:
  - current status,
  - blocking reason,
  - exact next action.
- System-level errors should be separated from user-action errors.
- Use role-appropriate escalation text ("Contact scheduling officer" vs "Contact IT admin").

## Accessibility and Ergonomics
- Maintain readable text size on mobile without zoom.
- Keep touch targets comfortably large.
- Ensure visible focus/active states for keyboard and touch.
- Preserve meaningful contrast on status chips and warnings.

## Anti-Patterns (Do Not Ship)
- Desktop matrix forced onto phone screens.
- Multiple stacked warning banners above primary actions.
- Duplicate navigation entries.
- Technical error language without user next step.
- Hidden state changes (no visible sync/progress status).
- Role mismatch UIs (faculty forced into scheduler-grade global density, or scheduler hidden from required detail).

## QA Gate for Design Sign-off
A surface is not design-ready unless all pass:
- First action obvious in under 5 seconds.
- User can complete core flow without trial-and-error confusion.
- Mobile portrait and landscape are both operable.
- Offline and realtime states are visibly understandable.
- Copy is plain-language and actionable.
- Role-specific workflow goals are satisfied (scheduler/admin/faculty/public) without exposing unnecessary complexity.

## Required Workflow Before Implementation
1. Run UX audit (desktop + mobile portrait + landscape).
2. Compare findings against this DESIGN.md.
3. Implement fixes mapped to each blocker.
4. Re-run manual QA with screenshots.
5. Update `docs/verification/evidence-log.md`.

---

This file is authoritative for UX decisions unless superseded by an explicit product decision record.
