# ATLAS vs SMART UX/UI Comparison Audit - 2026-05-29

## Scope

This report compares ATLAS against the SMART reference branch pulled from:

`https://github.com/njgrm/FINAL-CAPSTONE-SMART/tree/LATEST-SMART-PRE-ORAL-DONE-29-05-2026-4-25PM`

The branch was cloned into `external-references/FINAL-CAPSTONE-SMART` for read-only review. The comparison focuses on UX/UI identity, simplicity, efficiency, and usability for everyday users.

## Executive Verdict

SMART currently communicates its product purpose more clearly than ATLAS, especially in teacher-facing areas. Its pages usually start from a recognizable user job: manage class records, view advisory students, check grading status, or sync enrollment data. ATLAS often starts from system state: runs, runtime context, mirrors, contracts, violations, and source metadata.

ATLAS is technically more ambitious and has deeper scheduler workflows, but the UX currently makes users carry too much of the system model. SMART is not perfect; it is often visually over-decorated, uses oversized rounded cards, duplicates layout code, and exposes integration terms in registrar/admin areas. Still, SMART gives ATLAS an important lesson: role-specific pages should begin with what the user is trying to accomplish, not with how the backend is assembled.

## Identity Comparison

| Dimension | SMART | ATLAS | Audit Judgment |
|---|---|---|---|
| Primary identity | Academic records and grading portal | Timetabling, room, and scheduling operations | SMART is easier to explain at a glance. ATLAS needs a simpler scheduling identity. |
| Role separation | Separate teacher, registrar, admin route trees and layouts | Shared app shell with role-dependent links plus public/faculty/admin surfaces | SMART has clearer mental separation. ATLAS feels like one dense control panel. |
| First-screen clarity | Teacher dashboard greets the user and offers `My Advisory` and `Class Records` | Dashboard presents KPI cards, lifecycle, map/setup data | SMART better answers `what do I do now?` |
| Copy tone | More human, sometimes too enthusiastic | More technical and operational | ATLAS should adopt SMART's role language without copying its decorative excess. |
| Visual style | Emerald/white, large rounded cards, heavy shadows, expressive hero panels | More restrained shadcn/Tailwind system, dense tables, compact controls | SMART is more memorable; ATLAS is more work-like but currently too dry and crowded. |
| Efficiency | Teacher tasks are obvious, but some pages are visually large | Admin/scheduler tools are compact and powerful, but crowded | ATLAS has better density for expert work; SMART is better for initial comprehension. |
| Accessibility risk | Raw buttons, title attributes, hover-only archived delete, heavy animations | Raw buttons, hover-only actions, small controls, missing reduced-motion strategy | Both need accessibility hardening. |
| Maintainability | Fewer severe file-size violations, but still has large pages | More files violate 1000-line rule | ATLAS has the larger refactor burden. |

## What SMART Does Right

### 1. Role-Specific Navigation Is Easier to Understand

SMART uses separate layouts for teacher, registrar, and admin users:

- `external-references/FINAL-CAPSTONE-SMART/src/layouts/TeacherLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/RegistrarLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/AdminLayout.tsx`

Each role gets its own navigation language. Teachers see `Dashboard`, `Class Records`, `Attendance`, `Attendance Reports`, and `My Advisory`. This is immediately understandable.

ATLAS has role-aware routes, but the product still feels like scheduler/admin infrastructure is bleeding into faculty and public surfaces.

### 2. Teacher Dashboard Starts With the User, Not the Database

SMART's teacher dashboard opens with a greeting, current term, school year, total students, classes, and two obvious actions: `My Advisory` and `Class Records`.

This is a strong pattern for ATLAS faculty pages. ATLAS faculty pages should similarly start from:

- `Do I have a schedule?`
- `Do I need to submit anything?`
- `Do I have a pending room request?`
- `What changed?`

### 3. SMART Uses Familiar Education Terms

SMART uses terms like:

- Class Records
- Attendance
- My Advisory
- Grading Status
- Performance Mastery
- Active Students
- Handled Classes
- Critical Cases

These are more understandable than ATLAS terms such as:

- generation run
- latest run
- hard violation
- soft violation
- offering contract
- runtime context
- mirror
- upstream unavailable

### 4. SMART Builds Stronger Task Cards

Class records and advisory pages use cards that represent user work: a subject, a section, enrolled learners, grade weights, and record status. This is easier to scan than generic system metrics.

ATLAS can reuse this principle without copying the oversized styling: cards should represent a real task or object, not every statistic.

### 5. SMART Has Better Empty/Error Tone in Some Teacher Areas

SMART teacher dashboard error copy says `Oops! Something's wrong` and `We couldn't load your dashboard data right now.` This is more human than ATLAS states like `Dashboard unavailable`, though SMART's wording is still a bit casual for an official school system.

Recommended ATLAS tone:

- `We could not load your schedule right now.`
- `Your official schedule is not published yet.`
- `Enrollment data cannot be reached right now.`
- `Try again, or contact the scheduling office if this keeps happening.`

## What SMART Does Wrong

### 1. It Is Often Overdecorated

SMART uses large rounded cards, strong shadows, big hero sections, floating/blurred decorative elements, and expressive animations. Examples include login pages and teacher dashboards.

This gives SMART a more memorable identity, but it can reduce operational efficiency. ATLAS should not copy this wholesale. Scheduling tools need a quieter, denser, more work-focused interface.

### 2. Login Pages Have the Same Decorative Imbalance as ATLAS

SMART login pages use a 55 percent decorative/branding panel and a 45 percent form panel, with animated gradients, floating blobs, and feature cards. ATLAS has a similar issue. For faculty and school staff, the login task should be visually dominant.

### 3. SMART Also Leaks Integration Terms

SMART registrar/admin areas expose terms such as:

- `EnrollPro-backed student metrics`
- `Sync with EnrollPro`
- `Source: EnrollPro (real-time)`
- `SMART DB fallback`
- `Atlas removal detected`
- `generic WW/PT/TA fallback active`

These are more tolerable for admins than for teachers, but they should still be translated into operational meaning.

### 4. SMART Has Accessibility Issues

Patterns found in SMART include:

- raw `<button>` and `<input>` usage in layouts and mobile cards
- `title` attributes for collapsed navigation and unavailable states
- hover-only destructive action on archived class cards
- heavy use of animation and pulsing loaders
- repeated decorative blur/orb elements

ATLAS should not inherit these patterns.

### 5. SMART Still Has Large Files

SMART has fewer severe file-size problems than ATLAS, but it still has violations or near-violations:

| SMART File | Lines | Status |
|---|---:|---|
| `external-references/FINAL-CAPSTONE-SMART/src/pages/registrar/SchoolForms.tsx` | 1851 | Violates |
| `external-references/FINAL-CAPSTONE-SMART/src/pages/admin/TemplateManager.tsx` | 1158 | Violates |
| `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/ClassRecordView.tsx` | 1016 | Violates |
| `external-references/FINAL-CAPSTONE-SMART/src/pages/admin/ECRTemplateManager.tsx` | 971 | Near limit |
| `external-references/FINAL-CAPSTONE-SMART/src/pages/admin/SystemSettings.tsx` | 955 | Near limit |
| `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/components/ClassRecordTable.tsx` | 910 | Near limit |
| `external-references/FINAL-CAPSTONE-SMART/src/pages/registrar/StudentRecords.tsx` | 906 | Near limit |

## What ATLAS Does Right Compared With SMART

### 1. ATLAS Has Better Operational Density Potential

ATLAS pages are denser and more compact. For scheduler officers, this can become a strength if paired with better hierarchy and progressive disclosure.

### 2. ATLAS Is Already Closer to a Workbench Model

Timetable review, room schedules, map editing, sections, and teaching load are real operational workspaces. SMART's teacher pages are more presentation-heavy, while ATLAS has the building blocks for efficient scheduling operations.

### 3. ATLAS Uses Existing shadcn/Radix Primitives in Many Places

ATLAS has a local `src/ui` system and already uses Select, Card, Sheet, Tooltip, ScrollArea, and Button primitives widely. The problem is inconsistent enforcement, not total absence of design-system plumbing.

### 4. ATLAS Has Stronger Phase/Architecture Discipline

ATLAS has explicit project rules for PWA behavior, phase gates, no-scroll architecture, and component extraction. SMART gives useful UX inspiration, but ATLAS has better documented guardrails.

## What ATLAS Does Wrong Compared With SMART

### 1. ATLAS Makes Users Understand the System Internals

SMART teacher pages mostly speak in class and grading terms. ATLAS public and faculty pages still speak in run/source/sync/generation terms.

The biggest ATLAS UX correction is a language layer:

| Current ATLAS Term | User-Facing Replacement |
|---|---|
| Published run | Official schedule |
| Run ID | Schedule version, hidden in details |
| Upstream unavailable | Enrollment data cannot be reached |
| Saved data | Showing the last saved copy |
| Hard violation | Must fix before publishing |
| Soft violation | Warning |
| Offering contract | Subject requirements |
| Runtime context | Current school year |

### 2. ATLAS Lacks One Obvious Next Action

SMART teacher dashboard immediately offers `My Advisory` and `Class Records`. ATLAS dashboard asks users to interpret multiple KPIs and lifecycle indicators.

ATLAS should lead with a single action block:

- `Finish setup`
- `Collect teacher preferences`
- `Generate schedule`
- `Fix blockers`
- `Publish schedule`

### 3. ATLAS Public UX Is Too Technical

SMART has no exact public schedule equivalent, but its user-facing teacher copy is much more recognizable. ATLAS `/public/schedules` should be rebuilt around one task: `Find your class schedule`.

### 4. ATLAS Faculty UX Is Less Warm Than SMART Teacher UX

SMART uses role-aware teacher greetings and task cards. ATLAS faculty dashboard has a good CTA, but failure states and schedule status language are too dry.

### 5. ATLAS Has More Severe Refactoring Debt

ATLAS has more files above the 1000-line guardrail, and those files are concentrated in core UX areas: dashboard, shell, timetable, teaching load, faculty room requests, and manual edit panels.

## System-by-System Audit Summary

### SMART UX/UI Audit

What SMART does right:

- Clearer role-specific navigation.
- Teacher pages are built around recognizable school tasks.
- Stronger first-screen user orientation.
- More memorable visual identity.
- Better use of object/task cards in teacher workflows.

What SMART does wrong:

- Overly decorative heroes and shadows.
- Very large rounded card style reduces density.
- Login pages prioritize decoration too much.
- Admin/registrar areas still expose integration and fallback terms.
- Accessibility issues from raw elements, title attributes, hover-only actions, and heavy animation.
- Some pages violate or approach the 1000-line rule.

SMART overall UX gate: CONDITIONAL GO for teacher-facing inspiration, NO-GO as a pattern to copy directly.

### ATLAS UX/UI Audit

What ATLAS does right:

- Deep operational functionality exists.
- Many design-system primitives are already present.
- Scheduler workbench density can become an advantage.
- Architecture and UX guardrails are explicit.

What ATLAS does wrong:

- Too much technical/system language.
- Public/faculty pages expose backend details.
- Dashboard lacks priority and next action.
- Empty/error states are not standardized.
- Mobile touch targets are too small in dense tools.
- Accessibility gaps repeat across pages.
- Core components exceed maintainability limits.

ATLAS overall UX gate: NO-GO for broad release, GO for planned rehaul.

## Design Direction For ATLAS Based On SMART

ATLAS should borrow SMART's role clarity, not its decorative scale.

Adopt from SMART:

- Role-specific language.
- Human first-screen summaries.
- Task cards for real user objects.
- Direct primary actions.
- School branding that feels official.

Avoid from SMART:

- Huge rounded card style everywhere.
- Decorative blobs/orbs and animated login backgrounds.
- Oversized dashboards for operational tools.
- Hover-only actions.
- Raw buttons/inputs outside primitives.
- System integration terms exposed to everyday users.

## Recommended ATLAS UX Identity

ATLAS should feel like a calm scheduling operations system:

- Official, not flashy.
- Plain-language, not technical.
- Dense for scheduler officers, simple for faculty/students.
- One obvious next action per page.
- Advanced/debug controls available but hidden.
- Mobile-first for faculty.
- Public schedule pages focused on fast lookup.

Recommended identity phrase:

`ATLAS helps the school prepare, review, and publish schedules without making teachers or students understand the scheduling engine.`