# ATLAS Complete UX/UI Audit — 2026-07-11

## Executive Verdict

ATLAS has a recognizable SMART-family foundation, but it is not yet consistently foolproof for older or low-confidence users. The shell, school-token branding, shadcn/Radix control usage, role separation, and task-oriented timetable work are strong. The system is currently a **conditional UX/UI NO-GO** for broad rollout because information density, small controls, inconsistent page framing, unresolved phase ownership, and incomplete live multi-viewport evidence remain material risks.

Overall source-based score: **6.4/10**.

| Dimension | Score | Assessment |
|---|---:|---|
| SMART-family identity | 7.0 | Token branding and shared primitives are established, but page rhythm and headings drift. |
| KISS / cognitive load | 5.8 | Simple faculty/public concepts coexist with dense operator surfaces and jargon. |
| Consistency | 6.5 | Shared shell is strong; page headers, filters, empty states, and status treatments vary. |
| Older-user usability | 5.4 | Frequent `text-xs`, 28–32px controls, compact tables, and icon actions increase error risk. |
| Accessibility | 6.1 | Semantics and Radix foundations are present; target size, title attributes, zoom/reflow, and keyboard proof remain open. |
| Responsive behavior | 6.3 | Role-aware mobile patterns exist, but dense tables and no-scroll workspaces need viewport evidence. |
| Trust and recovery | 7.1 | Offline/sync and blocker states are comparatively mature; recovery copy is not uniform. |
| Maintainability | 5.9 | Several pages approach 1,000 lines and `ManualEditPanel.tsx` exceeds the mandatory limit. |

## Evidence and Limitations

- Audited all routes declared in `atlas-client/src/App.tsx` and the non-routed `MapView.tsx` and `SpecializationMapping.tsx` surfaces.
- Audited the shell, design playbook, UX master plan, phase ledger, and runtime source-of-truth map.
- Static checks found no native `<select>`, raw `<button>`, or `<details>` elements in page files.
- `FacultyPreferences.tsx`, `FacultyRoomPreferences.tsx`, `MyDashboard.tsx`, `MySchedule.tsx`, `SpecializationMapping.tsx`, and `TeachingLoad.tsx` still contain native `title` attributes.
- The live Tailnet health probe returned `502 Bad Gateway` during this audit.
- The in-app browser was blocked before the Tailnet page loaded. Therefore screenshots, keyboard traversal, axe results, and viewport behavior are **not verified** in this report.
- Existing uncommitted timetable and campus-map work was preserved and not modified.

## System-Wide Findings

### What already expresses SMART identity

- School identity is token-driven through EnrollPro public settings instead of a fixed green brand.
- The shell is role-aware and provides faculty mobile navigation, school-year context, connection state, and reduced-motion support.
- Pages consistently use project `Button`, `Select`, `Dialog`, `Tooltip`, `Popover`, and related primitives.
- Grade semantics are correctly represented in the reviewed section and room-schedule surfaces: G7 green, G8 yellow, G9 red, G10 blue.
- Timetable work follows a task-first command hierarchy and has recently reduced secondary-action clutter.
- Public and faculty routes have explicit loading, empty, and unpublished states.

### Critical gaps

1. **The phase story is contradictory.** `phasePlan.md` identifies Phase 4 closure in its header, Phase 2 and Phase 3 as in progress later, while current project knowledge points to Phase 3 generator readiness. UX work cannot be governed reliably until one active UX stream is recorded.
2. **Older-user ergonomics are not enforced.** Many operator controls use `h-7` or `h-8`, while WCAG 2.2 requires at least 24x24 CSS pixels and the project goal should use a 40–44px default for high-frequency primary actions.
3. **Tiny text is overused.** `text-xs` is appropriate for metadata but currently carries instructions, statuses, filter labels, and important explanations on several pages.
4. **Dense pages lack a universal progressive-disclosure contract.** Tables, filters, pagination, alerts, and detail actions compete above the fold.
5. **Page framing drifts.** Titles range from `text-lg` to `text-3xl`; some pages follow the SMART rhythm while others use workspace-specific headers without a shared contract.
6. **Maintainability threatens consistency.** `ManualEditPanel.tsx` is 1,125 lines, violating the 1,000-line rule. Multiple pages and components sit between 920 and 999 lines.
7. **Accessibility proof is incomplete.** Source semantics are promising, but keyboard order, focus restoration, 200–400% zoom, touch targets, contrast, and screen-reader announcements are not evidenced page by page.

## Page-by-Page Scorecard

Ratings are source-based: **PASS**, **PARTIAL**, **REHAUL**, or **DEFER/REMOVE**.

| Page / route | KISS | SMART | Older-user fit | Verdict and priority improvement |
|---|---|---|---|---|
| Login `/login` | PASS | PASS | PARTIAL | Strong branded entry. Reduce promotional density on small screens; make help/recovery and identifier guidance unmistakable. |
| Dashboard `/` | PARTIAL | PASS | PARTIAL | Strong SMART cards, but oversized metric-card patterns conflict with the newer inline-stat rule. Convert readiness into one clear next-action path. |
| Teachers `/teachers` | PARTIAL | PARTIAL | PARTIAL | Dense filters and status banners compete. Use a basic filter row by default, advanced filters in a popover, and larger row actions. |
| Subjects `/subjects` | REHAUL | PARTIAL | REHAUL | 939-line page with dense table, filters, pagination, coverage analysis, and instructional copy. Split list/detail workflows and remove metadata-sized instructional text. |
| Sections `/sections` | REHAUL | PARTIAL | REHAUL | 981-line page with many compact filter buttons and table actions. Replace filter button walls with one grade control, one program control, and a clear reset. |
| Teaching Load `/teaching-load` | PARTIAL | PARTIAL | REHAUL | Operationally capable but conceptually difficult. Add a guided default mode, plain-language readiness summary, and progressive expert controls. |
| Campus Map `/map` | PARTIAL | PASS | PARTIAL | Read/edit modes and tooltips are sound. Older users need larger mode targets, explicit save state, and task-based editor steps. |
| Timetable `/timetable` | PARTIAL | PASS | REHAUL | Strongest specialist workspace, but still the highest cognitive-load surface. Preserve power-user density while adding guided triage and a beginner-safe review mode. |
| How Timetabling Works `/timetabling/how-it-works` | PASS | PARTIAL | PARTIAL | Helpful but uses dense `text-xs` explanations. Rewrite as short task-based guidance with a glossary and replayable walkthrough. |
| Room Schedules `/room-schedules`, `/schedules` | REHAUL | PARTIAL | REHAUL | 922-line dense grid. Add search-first selection, readable day cards on narrow screens, larger conflict actions, and explicit legends. |
| Audit `/audit` | PARTIAL | PASS | PARTIAL | Good actionable grouping, but 798 lines and many evidence concepts. Default to “Fix these first” and hide technical evidence behind disclosure. |
| Preferences queue `/faculty/preferences` | PARTIAL | PARTIAL | PARTIAL | Queue semantics need one obvious decision per item, plain filters, and consistent before/after preview. |
| Room request queue `/faculty/room-preferences` | PARTIAL | PARTIAL | REHAUL | Terms such as “Hard Δ” and “Soft Δ” are not suitable for low-tech users. Use “new blocking conflicts” and “new warnings.” |
| Faculty home `/my` | PASS | PASS | PASS | Good role-appropriate starting point. Keep one dominant action and verify touch/zoom behavior. |
| My Schedule `/my/schedule` | PASS | PASS | PASS | Appropriate scope and clear states. Increase any instruction conveyed through `text-xs`; remove native title usage. |
| My Preferences `/my/preferences` | PARTIAL | PARTIAL | PARTIAL | Guided intent exists, but title-based help and compact labels need accessible replacements and stronger save confirmation. |
| My Room Preferences `/my/room-preferences` | REHAUL | PARTIAL | REHAUL | 994 lines is too complex for a faculty task. Convert to a three-step wizard: class, requested room/time, review and submit. |
| Public schedules `/public/schedules` | PARTIAL | PASS | PARTIAL | Search-first foundation is good, but section/teacher/room branching is still broad. Default to class/section lookup and place advanced modes behind “Search another way.” |
| Coming Soon | PASS | PARTIAL | PASS | Simple and safe; ensure it never appears as a dead-end primary destination. |
| `MapView.tsx` | PARTIAL | PARTIAL | PARTIAL | Clarify whether this is an embedded component or obsolete page. Preserve only one authoritative read-only map experience. |
| `SpecializationMapping.tsx` | FAIL | FAIL | FAIL | Removed from normal product flow and nearly 1,000 lines. Mark compatibility-only, remove user-facing navigation, and avoid investing in redesign unless reactivated by an approved requirement. |

## Foolproof-Use Standard

Every primary workflow should pass all of these gates before rollout:

1. A first-time user can identify the next action in five seconds.
2. The primary action uses a 40px or larger target; mobile targets use 44px where space allows.
3. Instructions and error recovery use at least body-sized text; `text-xs` is metadata only.
4. Every error states what happened, what to do, and whether work was saved.
5. Technical terms are removed or explained inline in plain language.
6. Destructive or schedule-changing actions show a plain before/after review.
7. Keyboard, screen-reader, 200% zoom, 400% reflow, and reduced-motion behavior are verified.
8. Desktop, 768px, 375px portrait, and mobile landscape evidence is captured.

## Recommended Sequence

1. UX-00: phase alignment, inventory, and shared usability baseline.
2. UX-01: shell, navigation, typography, targets, status, and accessibility foundations.
3. UX-02: scheduler setup and data-management simplification.
4. UX-03: timetable, audit, and request-decision workspaces.
5. UX-04: faculty portal foolproofing.
6. UX-05: public schedule simplicity and cross-role consistency.
7. UX-06: live Tailnet verification, older-user usability sessions, and closure.

The executable prompts are indexed in `docs/prompts/atlas-ux-overhaul/README.md`.
