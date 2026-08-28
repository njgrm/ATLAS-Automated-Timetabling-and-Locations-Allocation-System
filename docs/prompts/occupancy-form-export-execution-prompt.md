# Copilot Execution Prompt: Occupancy Form Export Templates (`11x6` / `13x6`)

## Goal
Implement stakeholder-familiar occupancy export templates in ATLAS that match the observed occupancy-plan structure patterns.

Primary output:
- Export templates (and optional preview mode) aligned to recurring occupancy block shapes:
  - `11x6`
  - `13x6`

## Scope
In scope:
- Occupancy export template definitions and rendering path.
- Data mapping from ATLAS schedules/rooms into occupancy-form structure.
- Template-level visual parity checks against stakeholder files.
- Validation against:
  - `office-files/BLDG3-BLDG-9-occupancy-plan-2023-24.docx`
  - `office-files/OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx`
  - `office-files/GARDE-8-OCCUPANCY-PLAN.docx`
  - `office-files/GRADE-7-OCCUPANCY-PLAN.pdf`

Out of scope:
- Changing schedule generation logic.
- Real stakeholder names in generated artifacts (placeholder names only).

---

## Mandatory References
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md`
- `docs/context7-library-map.md`
- `docs/verification/evidence-log.md`

---

## MCP Requirement (Non-Negotiable)

Before implementation:
1. **Word MCP** (`word-document-server`)
   - Extract table counts/shapes and repeated block layout signals.
2. **PDF MCP** (`pdf-reader`)
   - Validate page-level structure and image-heavy sections for layout cues.
3. **Excel MCP** optional for cross-checking class-program source alignment.

After implementation:
- Re-run MCP checks on generated templates/previews (if exported to docx/pdf) to confirm structure and counts.

If MCP tools fail:
- include exact failure reason,
- continue with fallback extraction only for that tool,
- mark final gate as conditional unless parity can still be proven.

---

## Context7 Preflight (Required)
Pull references for:
- printable tabular layout standards,
- document-style hierarchy and spacing,
- accessibility/readability for dense forms.

Include applied pattern mapping in output summary.

---

## Implementation Requirements

1. **Template Family**
   - Define occupancy template variants for `11x6` and `13x6`.
   - Ensure deterministic row/column mapping.

2. **Data Mapping**
   - Map ATLAS room/schedule assignments into occupancy cells.
   - Keep placeholders for names while preserving real quantity distribution.

3. **Visual Familiarity**
   - Keep recognizable occupancy-form cues:
     - heading blocks,
     - building-level segmentation,
     - table geometry,
     - signature/prepared-by style placeholders where needed.

4. **Preview/Export Behavior**
   - Provide at least one reliable output path (PDF and/or DOCX).
   - Ensure print-friendly output with stable pagination.

5. **Desktop + Mobile Consideration**
   - UI preview mode must be inspectable on desktop and readable on mobile via progressive sections (not a tiny full table squeeze).

---

## Verification Gates

### Automated
- Run affected build/tests.

### MCP Structural Validation
- Confirm generated artifacts preserve:
  - intended table geometry (`11x6`/`13x6`),
  - expected block repetitions,
  - section/order consistency.

### Manual QA
- Capture screenshots:
  - template preview desktop,
  - template preview mobile,
  - sample exported artifact rendering.

### Evidence Logging
- Update `docs/verification/evidence-log.md` with:
  - source file -> template mapping,
  - quantity parity checks,
  - MCP verification output,
  - final GO/NO-GO.

---

## GO/NO-GO
- NO-GO if `11x6` and `13x6` variants are not both implemented and verified.
- NO-GO if export geometry deviates from stakeholder pattern family.
- NO-GO if MCP verification step is omitted.
- GO only if structure parity + readability + evidence all pass.

