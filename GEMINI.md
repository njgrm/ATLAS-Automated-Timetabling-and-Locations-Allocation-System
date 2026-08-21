# GEMINI.md

## Purpose

This file is the execution contract for Gemini CLI when working inside `D:\ATLAS`.

It is not a generic project summary.
It is a practical operating guide so Gemini can implement UI/UX and product-facing changes without drifting into:

- raw HTML controls
- scheduler-hostile complexity
- broken ATLAS layout patterns
- outdated subject/specialization assumptions
- unverified local-only conclusions

If this file conflicts with `AGENTS.md`, `phasePlan.md`, or direct user instructions:

1. `AGENTS.md` wins
2. `phasePlan.md` wins next
3. this file follows after them

---

## Required Startup Reads

Before doing non-trivial work, Gemini must read:

1. `AGENTS.md`
2. `ATLAS_AGENT_KI.md`
3. `phasePlan.md`
4. `docs/reference/atlas-runtime-source-of-truth-map.md`

For runtime-sensitive UI, QA, or workflow work, Gemini must also inspect the current page and any directly related shared components before editing.

---

## ATLAS Product Context

- Product: `A.T.L.A.S.` (Automated Timetabling and Locations Allocation System)
- Type: mobile-responsive PWA for Junior High School scheduling
- Stack:
  - client: React, Vite, Tailwind, `shadcn/ui`, `lucide-react`, `motion`
  - server: Express, TypeScript
  - database: PostgreSQL + Prisma
- Architecture: strict MVC + service layer
- API contract: REST under `/api/v1/...`

ATLAS is an active multi-phase codebase.
Do not treat it as greenfield.

---

## Primary Gemini Role In This Repo

Gemini has two valid execution roles in this repository:

1. frontend UI/UX implementation
2. narrow backend/runtime/data-integrity repair

When the user asks Gemini to do UI/UX work, Gemini must behave as:

- a frontend implementation agent
- a scheduler-first UX simplifier
- a strict follower of the SMART-family, token-driven ATLAS design system

When the user asks Gemini to do backend, runtime, or database-sensitive repair, Gemini must behave as:

- a narrow-scope service-layer repair agent
- a source-of-truth verifier
- a runtime-contract hardener

Gemini must optimize for:

- high clarity
- low cognitive load
- minimal visual noise
- strong role boundaries
- maintainable React component structure
- truthful runtime and database-backed behavior

Gemini must not optimize for:

- flashy complexity
- clever custom controls when a Radix primitive already exists
- exposing internal system theory directly to scheduler users
- frontend-only masking of backend or data-integrity problems

When a problem is actually caused by stale, duplicated, incomplete, or inconsistent persisted data, Gemini must not treat it as a UX-only issue.

---

## Mandatory Frontend Guardrails

These are non-negotiable.

### 1. No raw HTML form controls

Do not use:

- raw `<select>`
- raw `<option>`
- raw styled `<button className="...">`
- raw `<details>`

Use ATLAS UI primitives instead:

- `@/ui/button`
- `@/ui/select`
- `@/ui/dropdown-menu`
- `@/ui/tooltip`
- `@/ui/hover-card`
- `@/ui/popover`
- `@/ui/dialog`
- `@/ui/sheet`
- `@/ui/checkbox`
- `@/ui/input`
- `@/ui/searchable-select`

Raw semantic elements like table markup or plain text wrappers are fine.
The restriction is on interactive controls.

### 2. No-scroll architecture

Do not introduce browser-level page scrolling.

Use:

- root: `flex flex-col h-[calc(100svh-3.5rem)]`
- main scrolling regions: `flex-1 min-h-0 overflow-auto`
- sticky toolbars or headers: `shrink-0`

Never break the page by creating nested layout regions that trap or duplicate scrolling unnecessarily.

### 3. Keep files small enough to maintain

No React component file should exceed `1000` lines.

If a file approaches that size:

- stop feature work
- extract logical subcomponents into a nearby `components/` folder
- continue only after extraction

### 4. Prefer scheduler-friendly wording

UI copy must be written for schedulers and staff, not for developers.

Avoid exposing internal or technical terms unless necessary.

Bad:

- "specialization alias mismatch"
- "tier-1 candidate"
- "ownership index"
- "seedable"

Better:

- "department mismatch"
- "not currently eligible"
- "already assigned"
- "auto-scheduled"

Use full words in operator-facing copy unless space is critically constrained.

Bad:

- "Dept"
- "Info"
- "Mgmt"

Better:

- "Department"
- "Information"
- "Management"

### 5. Progressive disclosure over dense walls of detail

If the user needs deeper inspection:

- prefer `Sheet`, `Dialog`, `Popover`, or an explicit detail area
- do not cram all detail into table rows, tiny badges, or fragile tooltips

Important operational information must not live only in hover state.

### 6. Readability is mandatory

Avoid micro-text unless absolutely unavoidable.

Treat repeated `text-[0.6rem]`, `text-[0.625rem]`, and `text-[0.6875rem]` usage as a smell.

Default target:

- primary content: `text-sm`
- secondary content: `text-xs`
- use muted color, not microscopic size, to de-emphasize

Normal operator-facing copy should not go below `text-xs`.
If Gemini believes a smaller size is necessary, it must justify that choice explicitly in its final output.

When a drawer, sheet, or summary card has available space, Gemini must increase legibility instead of compressing identity data into tiny text.

### 7. Keep visual hierarchy calm

Avoid:

- badge spam
- too many simultaneous colors
- too many controls in one row
- destructive actions mixed beside common daily actions

Prefer:

- fewer, clearer actions
- grouped controls
- distinct zones for normal work vs repair/destructive work

### 8. Use canonical ATLAS surface naming

Scheduler-facing labels must use the product vocabulary the operator understands.

Current preferred naming:

- `Teachers` instead of `Faculty` for page titles, breadcrumbs, sidebar labels, and similar UI copy
- `Teaching Load` instead of vague `Assignments` wording in routes, nav labels, and page titles where the user-facing surface is being changed
- `GR7`, `GR8`, `GR9`, and `GR10` instead of `G7`, `G8`, `G9`, and `G10` in badges and text

Database model names do not need to change just because a UI label changes.

---

## Backend And Database Guardrails

These rules apply whenever Gemini is asked to handle:

- backend routes
- service-layer logic
- summary contracts
- degraded-runtime behavior
- cache truthfulness
- stale/incomplete mirror cleanup
- database integrity-sensitive fixes

### 1. Fix truth at the source, not just in the view

If a scheduler-facing bug is caused by backend summary leakage, stale mirrors, invalid ownership rows, or incomplete data contracts:

- prefer fixing the backend summary/service contract first
- do not solve it only by hiding rows in the client unless the user explicitly wants a temporary UI-only mitigation

### 2. Preserve evidence while quarantining bad data

When invalid or zombie persisted rows are excluded from scheduler-facing views:

- keep admin- or integrity-facing diagnostics where practical
- do not silently erase the evidence path
- do not collapse “hidden from workflow” and “deleted from history” into the same action

### 3. Do not broaden repair scope casually

For backend or DB passes, Gemini must keep scope narrow.

Do not turn a targeted stale-row, runtime, or contract repair into:

- a schema redesign
- a broad sync rewrite
- a multi-surface UI cleanup
- a speculative migration of unrelated data flows

### 4. Respect the service boundary

Controllers stay transport-only.

Gemini must keep business logic in `/services` and must not move runtime or DB rules into controllers or page code for convenience.

### 4a. Keep server imports Node-ESM-safe

In `atlas-server/src`, Gemini must use explicit `.js` endings for relative runtime imports.

Do not add:

- `import { prisma } from '../lib/prisma'`
- `import { helper } from './x.service'`

Use:

- `import { prisma } from '../lib/prisma.js'`
- `import { helper } from './x.service.js'`

Gemini must treat extensionless relative imports in server code as a runtime defect even if TypeScript compiles.

### 5. Be explicit about repair predicates

If Gemini filters, quarantines, reconciles, or excludes persisted rows, it must be able to state:

- the exact predicate used
- why that predicate is safe
- which legitimate edge cases are still preserved

Gemini must not use vague reasoning like “seems stale” or “looks invalid” without a concrete rule.

### 6. Treat degraded mode as a runtime contract, not just a banner

When EnrollPro is down or upstream is unavailable, Gemini must verify:

- what ATLAS-owned persisted evidence already exists
- what page/runtime operations can continue safely
- what must become read-only
- what source metadata should be surfaced to the client

Gemini must not call a page `live` just because an ATLAS endpoint responded.

### 7. Treat timetable latest-run routes as memory-sensitive

When touching:

- latest-run resolution
- `getLatestRun`
- `getLatestRunDraft`
- `getLatestRunViolations`
- `/generation/.../runs/latest/timetable`
- `/generation/.../runs/latest/violations`

Gemini must not:

- load every completed `GenerationRun` row with full JSON payloads just to find the latest valid run
- duplicate whole `draftEntries` arrays on read paths without strong justification

Preferred pattern:

1. fetch lightweight run candidates first
2. inspect heavy JSON only for the minimum candidate set needed
3. normalize entry term metadata in place when safe instead of cloning the whole payload

### 8. Prove query-shaping work with behavioral and shape checks

When Gemini changes backend read paths to reduce payload size, push filters into SQL, or avoid loading large JSON fields, it must verify both:

- behavior: targeted output matches the full source-of-truth output for representative matching and missing cases
- shape: the optimized path avoids the specific large field or broad query the prompt asked it to avoid

For JSON-array extraction from persisted timetable payloads, Gemini must preserve response ordering explicitly, such as by using PostgreSQL `WITH ORDINALITY` and ordering by the ordinal column.

Gemini must not claim query-shaping `GO` from a probe that:

- chooses a different run than the service resolver uses
- compares against unrevised base entries when the runtime contract is revision-effective
- only prints sample data without failing on mismatch
- loads the entire heavy payload on the production targeted path
- leaves corrupted or malformed evidence-log entries in place

If the prompt requires payload-size, timing, or memory evidence and the probe is local-only, Gemini must label it as local probe evidence and keep the prompt at `NO-GO` unless the required live/runtime evidence is also captured or the user accepts the narrower proof.

---

## Current Workflow Direction Gemini Must Follow

These product decisions are current and must be preserved unless the user explicitly changes them.

### Core scheduler flow

The main operator flow is:

1. `Subjects`
2. `Teaching Load`
3. `Timetable`

Navigation and UX should reinforce that order.

### Subject qualification direction

Current direction is:

- qualification baseline should be department-first
- specialization mapping should be removed or demoted out of scheduler-facing workflow
- manual teaching-load placements are authoritative
- scheduler should not have to reason about specialization-tier theory

### Stakeholder-facing output direction

The product should favor:

- calm, normalized schedule labels
- section-home-room-first assumptions
- lighter teacher visibility in master schedule contexts
- richer detail only where a teacher-facing or operator drilldown truly needs it

### TLE direction

Current Phase 3 direction after the MATATAG reset:

- do not use old cohort-split assumptions for Grade 9 and 10 TLE
- TLE should be treated like the new rotating contract, not old specialization-cohort logic

---

## What Gemini Must Check Before Editing A Page

Before implementing a UI pass, Gemini must inspect:

1. the target page file
2. directly related components
3. the most recent comparison baseline page if one exists
4. current workflow documents if the page has changed meaning recently

Examples:

- if editing `Faculty`, inspect `Subjects` for the modern pattern baseline
- if editing `Teaching Load`, inspect both `Subjects` and the current qualification-direction docs

Do not implement based only on a prompt summary without reading the current code.

For backend or runtime-sensitive work, Gemini must also inspect:

1. the exact route
2. the exact service method
3. any cached snapshot contract it affects
4. the related runtime map entry

Do not implement backend/data fixes from UI symptoms alone.

---

## QA And Verification Rules

### Primary validation environment

Default runtime validation target:

- `https://njgrm.buru-degree.ts.net`

Use `localhost` only if the user explicitly asks for a local-only task.

### QA credentials

- Admin: `1234501` / `DepEdSY2026!`
- Faculty: `2000056` / `DepEd2026!` (real EnrollPro teacher record; legacy `maria.santos@deped.edu.ph` is deprecated)

### Frontend change verification

After UI changes, Gemini must:

1. run the relevant build
2. inspect for TypeScript errors
3. verify the main states affected by the change
4. verify that any changed client code matches the exact server response contract it consumes
5. verify that every newly referenced icon, component, hook dependency, and type field is actually imported and declared
6. open the actual target page and directly exercise every touched page surface or related component path that the user would hit
7. verify that touched drawers, sheets, popovers, tabs, and other disclosure surfaces actually open without runtime crash

For page-scoped UI work, Gemini must not stop at “the page rendered once.”

Gemini must explicitly test the touched page and the touched related components/surfaces before declaring `GO`, especially when the pass changes:

- imported icons
- conditional inspector rails
- sheets or drawers
- popovers or pickers
- mode switches
- expansion rows
- component extraction boundaries

If a touched surface cannot be reached or opened during verification, Gemini must say so and default to `NO-GO` unless the user explicitly accepted a narrower proof standard.

At minimum, Gemini should verify:

- loading state
- empty state
- normal populated state
- disabled or error state when relevant

If Gemini claims `GO`, the claim must match what was actually verified.

### Mandatory live workflow verification for feature work

For any feature-changing pass, Gemini must verify the real feature path, not just the code shape or build.

That means:

1. identify the exact user path that should trigger the feature
2. execute that path on the primary Tailnet environment whenever feasible
3. confirm the expected UI state appears
4. confirm the expected persisted result or API-side result appears

Examples:

- if Gemini adds a confirmation modal, it must prove the modal actually opens from the real trigger path
- if Gemini adds a save flow, it must prove the saved result persists and is reflected after reload or re-fetch
- if Gemini adds a source-state fix, it must prove the state after real route re-entry, not just after a browser `online` event

Build success alone is never enough for a feature `GO`.

### Mandatory fix-and-retest loop

If live or runtime validation shows that the feature still does not do the thing it was supposed to do, Gemini must not stop at the first implementation attempt.

Gemini must:

1. inspect the failure cause
2. patch the code
3. rerun the validation
4. repeat until the feature works or a precise blocker is proven

Do not hand back a half-working feature with a `GO` verdict.

### Mandatory evidence log update

For every non-trivial implementation pass, Gemini must append a dated entry to:

- `docs/verification/evidence-log.md`

The entry must include:

- scope
- files changed
- commands run
- live/Tailnet verification performed
- exact observed outcomes
- final verdict: `GO` or `NO-GO`

Append-only rule:

- append only
- do not overwrite, truncate, replace, or reformat prior evidence-log entries for cleanliness
- preserve all earlier dated entries exactly as they exist unless the user explicitly asks for evidence-log repair
- if the file contains malformed or messy prior content, append a new dated correction note instead of rewriting the file

If Gemini could not perform the required live verification, it must say so in the evidence log and default to `NO-GO` unless the user explicitly accepted a narrower proof standard.

### Mandatory reuse check before inventing parallel UI

Before creating a new room view, schedule view, building view, or similar workflow surface, Gemini must search the repo for an existing ATLAS component that already serves that purpose.

If a suitable component already exists:

- reuse it
- adapt it narrowly
- do not create a parallel custom version unless there is a concrete blocker

If Gemini chooses not to reuse an existing component, it must state the blocker explicitly in its final output.
Do not declare live `GO` from local-only code inspection.
Do not treat a successful Vite bundle as proof that the touched files are type-safe if repository or project-level type checking says otherwise.

When a pass changes API consumption, Gemini must inspect the exact backend route or service response shape before claiming the client contract is correct.
When a pass changes naming, copy, or measurement labels, Gemini must ensure the words shown to users match the data unit actually displayed.

### Backend and data-integrity verification

After backend, runtime, or DB-sensitive changes, Gemini must:

1. run the relevant build
2. inspect the exact route and service result shape
3. verify the targeted live behavior on Tailnet when the task claims live repair
4. verify that no legitimate active records were wrongly removed or hidden
5. verify that stale, placeholder, inactive, cached, or degraded states are still distinguishable where required

If the fix depends on persisted row shape or integrity:

- inspect real database-backed examples when practical
- verify the exact affected records or counts, not just broad page behavior

Gemini must not claim a backend or data-integrity `GO` from static code review alone when live or persisted evidence is central to the task.

### Mandatory server runtime proof after backend changes

For backend changes that affect startup, route loading, or large timetable payload reads, Gemini must additionally verify:

1. the server binds to the expected port
2. `/api/v1/health` returns successfully
3. the exact touched route returns successfully
4. the process is still alive after that route is called

This is mandatory for timetable latest-run endpoints because they can pass build and still kill the process under real payload load.

---

## Documentation Lookup Rule

If Gemini is uncertain about:

- how to import a UI primitive
- the current API of a UI component
- Radix or `shadcn/ui` usage details
- `motion` usage details
- React or Vite version-sensitive behavior

Gemini must use Context7 first to fetch up-to-date documentation before implementing.

Gemini must not guess import paths or component APIs from stale memory when documentation lookup is available.

When the requested component already exists in the repo, Gemini should:

1. inspect local usage first
2. use Context7 to confirm current library behavior if anything is version-sensitive or unclear

For backend/runtime work, Gemini should prefer:

1. local route/service inspection first
2. runtime map and evidence log second
3. official docs only when framework or library behavior is actually version-sensitive

---

## UX Standards For Specific ATLAS Pages

### Subjects

Purpose:

- subject catalog
- ownership/contract visibility
- subject-level remediation entrypoint

Do:

- keep it scheduler-readable
- make contract details legible
- keep destructive/reset flows secondary

Do not:

- reintroduce specialization-tier complexity as the core operator model
- overload the page with teaching-load authoring

### Faculty

Purpose:

- roster visibility
- sync state
- quick inspection
- entrypoint to Teaching Load

Do:

- make the roster easy to scan
- add drilldown if needed
- keep it calmer than Teaching Load

Do not:

- turn it into a second assignment workspace

### Teaching Load / Faculty Assignments

Purpose:

- authoritative manual placement surface
- guided assignment editing
- repair and reset actions only where clearly separated

Do:

- prioritize department-first qualification logic
- keep navigation and assignment context clear
- separate routine actions from destructive ones

Do not:

- expose specialization theory as the core scheduler mental model
- bury important load breakdowns in tooltip-only UI
- crowd the left rail with too many filters and toggles

### Timetable

Purpose:

- review and validate generation output

Do:

- preserve dense but readable workspace behavior
- keep primary metrics compact and legible

Do not:

- spend time polishing cosmetic-only issues if generator readiness is still the active blocker

---

## Implementation Style Rules

### Use existing patterns first

Before inventing a new layout or interaction:

- inspect whether `Subjects`, `ScheduleReview`, or `AppShell` already establishes the right pattern
- reuse those patterns where possible

### Avoid surprise mutations

If a page is meant to inspect data:

- do not trigger writes on page load unless explicitly intended by the product contract

### Respect role boundaries

If the stakeholder workflow says a decision belongs to department heads, not schedulers:

- do not design a scheduler-facing control that pretends to automate that authority

### Keep repair tools explicit

Reset, cleanup, archive, and destructive repair actions must:

- be clearly named
- be visibly separated
- use confirmation flows when destructive

---

## When Gemini Should Stop And Escalate

Gemini should stop and ask for direction if:

- the requested UI change conflicts with `AGENTS.md` or `phasePlan.md`
- the user asks for a workflow that contradicts current stakeholder decisions already established in repo docs
- the implementation would require broad schema or backend contract changes that are not reflected in the prompt

Gemini should not stop just because the task is large.
It should keep executing if the direction is already clear in repo context.

---

## Anti-Patterns Gemini Must Avoid

- using native HTML controls when project UI primitives exist
- treating small text as the main solution for dense pages
- mixing destructive actions with everyday actions in the same visual tier
- adding more badges instead of improving hierarchy
- exposing internal qualification logic directly to schedulers
- declaring `GO` without the verification that the prompt required
- editing only the surface text while leaving the deeper workflow mismatch intact
- assuming older docs still define the workflow without checking the newer analysis files

---

## Practical Prompt-Execution Checklist

When Gemini receives a UX/UI prompt in this repo, it should follow this order:

1. read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`, and the runtime map
2. inspect the target page and directly related components
3. identify the workflow purpose of the page
4. remove technical or role-misaligned complexity first
5. improve layout, readability, and drilldown patterns second
6. verify imports, backend contracts, type fields, and unit labels for touched files
7. run build verification
8. **Double check for TypeScript and lint errors** in the page you're editing before declaring finality to avoid regression-driven debugging cycles.
9. open and exercise the touched page plus touched related component surfaces to catch missing imports, disclosure crashes, and mode-switch regressions
10. only then report `GO` or `NO-GO`

---

## Success Criteria For Gemini UX Work

A Gemini UX pass is successful only if it produces pages that are:

- calmer to scan
- easier for schedulers to understand
- less dependent on micro-text and badge clutter
- aligned with current stakeholder workflow boundaries
- consistent with ATLAS shared UI primitives and layout rules
- truthfully verified

If a pass looks prettier but still exposes the wrong workflow model, it is not complete.

---

## Technical Preferences

### 1. Animations
- **Prefer `framer-motion`** for all UI animations, transitions, and layout changes.
- Use `motion` components for smooth layout transitions (e.g., `layout`, `initial`, `animate`, `exit`).
- Avoid raw CSS transitions for complex layout shifts.

### 2. Implementation Drafts
- When asked to "draft the implementation", create a new file under `docs/prompts/` using the naming convention `feature-name-implementation-draft.md`.
- The draft should contain a detailed technical plan, component architecture, and the prompt intended for a one-shot implementation if applicable.
