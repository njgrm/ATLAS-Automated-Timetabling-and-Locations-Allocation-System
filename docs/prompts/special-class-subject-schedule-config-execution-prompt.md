# Copilot Execution Prompt: Special Class Subject and Schedule Config (Configurable School Profiles)

## Goal
Implement configurable special-class support in ATLAS so each school can define the class types, subject bundles, and schedule profiles it actually uses instead of relying on hardcoded STE/SPA assumptions.

Primary output:
- A school-configurable template system for regular and special classes.
- Subjects page support for class-type membership, subject scope visibility, and editable template bundles.
- Schedule generation support for template-driven period counts and period lengths.

## Scope
In scope:
- Configurable class templates for regular and special sections.
- Explicit subject-to-program scope mapping.
- School-level overrides for subject bundles and schedule profiles.
- Subjects page UI that shows which subjects belong to each class type.
- Generation flow updates so timetable shape follows the selected schedule profile.

Out of scope:
- Hardcoding one school's exact subject list into the product.
- Replacing the existing subject or generation workflows entirely.
- Introducing a new scheduling algorithm.
- Non-ATLAS enrollment, grading, or attendance features.

## Required References
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/phase-4-review.md`
- `docs/phases/ux-refactor-master-plan.md`
- `docs/phases/phase-4-priority-realignment-2026-05-07.md`
- `docs/prompts/class-program-matrix-execution-prompt.md`
- `docs/verification/evidence-log.md`

## Source Pattern Reference
Use the authoritative class-program workbook extracts in:
- `office-files/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- `CLASS-PROGRAM-SY-2025-2026-GRADE-8.md`
- `ClassProgram_Grade_7v3.md`

Use those files only as the current pattern baseline. The implementation must still allow each school to override the template bundle and bell structure where its actual practice differs.

## Context7 Preflight (Required)
Before coding UI or state-management changes, resolve library IDs from `docs/context7-library-map.md` for:
1. Radix / shadcn UI primitives for selects, tabs, dialogs, and responsive disclosure.
2. Motion / Framer Motion for step transitions and template panel changes.
3. WAI-ARIA Authoring Practices for accessible selector and tab behavior.

Pull 2-3 references for each concern and include a short summary in your implementation notes:
- Applied pattern
- ATLAS surface where applied
- Expected user outcome

## Mandatory Skills (Order)
1. `atlas-design-system-enforcer`
2. `atlas-mvc-enforcement`
3. `atlas-prisma-database`
4. `atlas-react-view-patterns`
5. `atlas-copy-and-microcopy`
6. `atlas-phase-gate-enforcer`

## Implementation Requirements

### 1) Configurable Template Model
- Add a first-class concept for a class template or schedule profile that can be defined per school.
- Keep regular, STE, SPA, and custom special-class templates data-driven instead of hardcoded.
- Store the template label, class type, grade applicability, subject bundle, and period structure as configurable values.
- Allow a school to clone a default workbook-derived template and edit the result.
- Preserve the ability to fall back to inferred values when legacy data is missing, but treat that as compatibility only.

### 2) Subjects Page Template Binding
- Show each subject's class-type membership explicitly on the Subjects page.
- Allow a subject to be visible in one or more program scopes.
- Make special-class-only subjects clearly distinguishable from regular-core subjects.
- Provide a configurable template panel or section where schedulers can inspect which subjects belong to each class type.
- Let schedulers update the school's bundle without editing unrelated subjects.

### 3) Schedule Profile Behavior
- Use the selected template to determine the number of periods per day and the length of each period.
- Keep the regular BEC pattern available as a configurable default profile.
- Keep STE and SPA as separate special profiles, but allow a school to rename or replace them if its curriculum differs.
- Prevent demand construction from assigning subjects that are outside the active template scope.
- Ensure schedule generation and preview output use the same profile definition.

### 4) School-Specific Overrides
- Allow each school to define its own special-class bundle and schedule profile names.
- Allow each school to mark a template as active, inactive, or default.
- Allow each school to define a custom special-class template without changing the core ATLAS model.
- Keep workbook-derived presets as the starting point, not as a permanent lock.

### 5) Validation and Safety
- Reject a template that has no subject bundle.
- Reject a template whose schedule profile does not define a valid period count and period length.
- Prevent special-class subjects from appearing in the regular bundle unless the school explicitly configures that behavior.
- Preserve current regular-section behavior when no special template is selected.

## Verification Gates

### Automated
- Run affected build/tests for backend and frontend surfaces.
- Add regression tests for:
  - regular bundle resolution,
  - STE bundle resolution,
  - SPA bundle resolution,
  - custom template fallback behavior,
  - schedule profile slot generation.

### Manual QA
- Verify the Subjects page can show regular and special-class membership clearly.
- Verify a school-configured template can be edited without breaking unrelated subjects.
- Verify special-class generation uses the configured period count and period length.

### Evidence Logging
- Update `docs/verification/evidence-log.md` with:
  - source pattern -> configurable template mapping,
  - UI behavior change summary,
  - test results,
  - remaining risks,
  - final decision.

## GO/NO-GO
- NO-GO if special-class behavior is still hardcoded to one workbook pattern.
- NO-GO if the Subjects page does not expose program-scope membership clearly.
- NO-GO if schedule generation ignores the selected template profile.
- NO-GO if school overrides cannot change the bundle or bell structure.
- GO only if configurable defaults exist, school overrides work, and the Subjects page reflects the template accurately.
