# UX Refactor Master Plan

## Purpose
This plan defines the execution order, scope, and acceptance gates for UX/UI refactoring across all ATLAS user sides:
- Scheduler
- Admin
- Faculty
- Public/Student

It aligns implementation with:
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- existing phase constraints and verification standards

## Global Non-Regression Constraints
- Keep role permissions and lifecycle gating intact.
- Do not break offline queue and sync behavior where already implemented.
- Keep realtime collaboration flows functional where already implemented.
- Preserve active-draft-only logic for drafting workflows.
- **Primary accent theme must remain sourced from EnrollPro public settings** and applied consistently across pages.
  - No fallback to hardcoded brand color when valid EnrollPro accent exists.
  - Cached accent behavior must avoid default-color flash on load.

## Delivery Strategy
Refactor role-by-role to reduce blast radius and keep reviewable increments.

Execution order:
1. Scheduler UX refactor
2. Admin UX refactor
3. Faculty UX refactor
4. Public/Student UX refactor
5. Cross-role polish and consistency pass

---

## Phase UX-1: Scheduler UX Refactor

### Scope
- Timetable/review workspace clarity and action hierarchy.
- Queue-first prioritization (what needs action now).
- Conflict surfacing readability and decision ergonomics.
- Generate/publish blockers made explicit and actionable.

### Key Outcomes
- Scheduler can identify and act on highest-priority items within 5 seconds.
- Dense data remains scannable without removing required operational detail.

### Acceptance Gates
- Primary action visibility and blocker clarity pass.
- No regression in generation/publish guard rules.
- Manual QA: desktop-first scheduler flow completes without confusion.

---

## Phase UX-2: Admin UX Refactor

### Scope
- Account and platform configuration surfaces.
- Safe defaults and impact-aware confirmations.
- Policy/settings structure and readability.
- Audit visibility and operational trust cues.

### Key Outcomes
- Admin can configure critical settings safely with clear impact messaging.
- Dangerous operations always require explicit confirmation and context.

### Acceptance Gates
- Admin settings are sectioned and understandable.
- Confirmations and rollback/retry cues are present.
- No regression in admin capabilities and role gating.

---

## Phase UX-3: Faculty UX Refactor

### Scope
- `/my`, `/my/preferences`, `/my/room-preferences`.
- Mobile-first flow quality and desktop role-appropriate clarity.
- Guided request workflow and plain-language messaging.
- Offline confidence and collaboration visibility.

### Key Outcomes
- Faculty can complete core request flows without guessing.
- Mobile and desktop are both first-class, not stretched variants.

### Acceptance Gates
- One obvious action per screen.
- Guided room-request flow is operable and understandable.
- Offline queue/sync statuses are visible and clear.
- Realtime updates are visible and trustworthy.

---

## Phase UX-4: Public/Student UX Refactor

### Scope
- Public schedule lookup and read-only timetable access.
- Search/filter simplicity and performance.
- Minimal branching and no internal jargon.

### Key Outcomes
- Public users can find schedule information quickly without training.
- Read-only surfaces remain fast and clean.

### Acceptance Gates
- Search-first flow clarity and speed.
- No leakage of internal draft/review terminology.
- Accessibility and readability pass for mobile and desktop.

---

## Phase UX-5: Cross-Role Consistency Pass

### Scope
- Shared component consistency (badges, status chips, notices, buttons).
- Copy system normalization (plain language across all roles).
- Responsive and spacing consistency.
- Theme consistency and accent token propagation.

### Key Outcomes
- UI feels cohesive across all role surfaces.
- Status semantics are consistent and predictable.

### Acceptance Gates
- Shared design tokens/variants used consistently.
- Cross-role terminology consistency validated.
- EnrollPro accent source and propagation verified across audited pages.

---

## Verification Protocol (Every UX Phase)

### Automated
- Run full build and relevant test suites for touched surfaces.
- Keep role auth and lifecycle regression suites green.

### Manual QA
- Test desktop + mobile portrait + mobile landscape.
- Validate first-time user flow clarity with role-specific scenarios.
- Capture screenshots and summarize pass/fail in `docs/verification/evidence-log.md`.

### Required Evidence Entries
- What changed (UX blocker -> implementation mapping)
- What passed
- What failed
- Remaining blockers
- Final go/no-go decision

---

## Accent and Brand Integrity Checklist
- EnrollPro public settings fetch succeeds.
- Accent token applied to key controls and highlights.
- Accent is cached and reused at startup.
- No hardcoded fallback overwrites valid EnrollPro accent.
- Visual parity checks include at least one screenshot per role side.

---

## Change Management Rules
- Do not combine multiple role refactors into one unbounded patch.
- Keep each role phase reviewable and reversible.
- Prefer incremental merges with evidence over one large rewrite.
- If a phase fails acceptance gates, fix before moving to next phase.

---

## Suggested Execution Cadence
- UX-1 Scheduler: stabilize operational clarity first.
- UX-2 Admin: reduce configuration risk.
- UX-3 Faculty: maximize guided usability and mobile success.
- UX-4 Public: optimize discovery and readability.
- UX-5 Consistency: unify experience and branding.

This plan is complete when all role phases pass and cross-role consistency is verified.
