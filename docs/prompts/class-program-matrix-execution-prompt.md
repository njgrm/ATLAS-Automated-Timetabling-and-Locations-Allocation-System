# Copilot Execution Prompt: Class Program Matrix Mode (Stakeholder-Familiar Workbook View)

## Goal
Implement a **Class Program Matrix mode** in ATLAS that mirrors stakeholder workbook familiarity (summary + section-band matrix patterns) while preserving ATLAS workflow UX.

Primary output:
- A UI mode for scheduler/faculty-facing schedule presentation aligned to stakeholder class-program structure.

## Scope
In scope:
- Matrix-style view model and UI for class program presentation.
- Section-band grouping that reflects workbook-style repeated blocks.
- Export-friendly data shaping and print/readability considerations.
- Verification against `office-files/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`.

Out of scope:
- Replacing current primary workflow pages.
- Identity-level stakeholder names in output (use placeholders).
- New scheduling algorithm behavior.

---

## Mandatory References
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md`
- `docs/context7-library-map.md`
- `docs/verification/evidence-log.md`

---

## MCP Requirement (Non-Negotiable)

Use Office MCP servers to validate format/quantities before and after implementation.

1. **Excel MCP** (`excel` / `python -m excel_mcp stdio`)
   - Inspect workbook sheet names/counts and representative ranges.
   - Confirm structure for:
     - summary sheets
     - subject sheets
     - consolidated `CLASS SCHEDULES` pattern
2. **PDF MCP** (`pdf-reader`) if exported previews are generated as PDF.
3. **Word MCP** only if Word-format parity artifacts are generated in this pass.

If any MCP call fails:
- capture error details,
- continue with fallback extraction only for that step,
- mark gate as conditional and explain the risk.

---

## Context7 Preflight (Required)
Resolve IDs and pull 2-3 references for:
- responsive dense data layout behavior,
- data-grid readability patterns,
- accessibility for large tabular navigation.

In summary, include:
- Applied pattern
- Where used in ATLAS
- Expected user outcome

---

## Implementation Requirements

1. **Matrix Mode Architecture**
   - Add a dedicated "Class Program Matrix" presentation mode.
   - Keep existing default workflow mode untouched.
   - Support clear mode switching.

2. **Workbook Familiarity Mapping**
   - Reflect stakeholder workbook mental model:
     - summary grouping
     - section-band layout
     - time/subject/teacher triplet readability
   - Preserve ATLAS naming/privacy rules using placeholders.

3. **Desktop + Mobile**
   - Desktop: high-density matrix with strong scanning hierarchy.
   - Mobile: usable condensed mode (chunked section bands, progressive reveal), no unusable squeezed grid.

4. **Accessibility + Clarity**
   - keyboard traversal cues,
   - visible focus states,
   - clear sticky headers/labels where applicable,
   - no nested-scroll trap.

---

## Verification Gates

### Automated
- Run affected build/tests.
- If relevant, run existing Playwright visual checks.

### MCP Validation
- Re-read workbook structure post-implementation and confirm:
  - sheet-family parity assumptions hold,
  - section-band quantities are represented correctly,
  - matrix grouping matches source pattern logic.

### Manual QA
- Desktop + mobile portrait + mobile landscape screenshots.
- Confirm first action is obvious and matrix is scannable.
- Confirm no cognitive overload regressions.

### Evidence Logging
- Update `docs/verification/evidence-log.md` with:
  - MCP extraction notes (what was checked),
  - mapping from source structure -> UI structure,
  - pass/fail + blockers,
  - GO/NO-GO.

---

## GO/NO-GO
- NO-GO if matrix mode does not reflect workbook structure family.
- NO-GO if mobile mode is still compressed desktop grid.
- NO-GO if MCP verification is skipped.
- GO only if structure mapping, usability, and evidence all pass.

