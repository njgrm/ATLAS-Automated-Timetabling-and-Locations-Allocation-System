# Copilot Gate-Closure Prompt: Class Program Matrix + Occupancy Export Parity

Run this only after completing:
- `docs/prompts/class-program-matrix-execution-prompt.md`
- `docs/prompts/occupancy-form-export-execution-prompt.md`

This is a strict combined closure gate for both deliverables.

---

## Required Inputs
- `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md`
- `docs/context7-library-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/verification/evidence-log.md`
- Source office files in `office-files/`

---

## Mandatory Skills (order)
1. `atlas-design-system-enforcer`
2. `atlas-ux-audit-gate`
3. `atlas-copy-and-microcopy`
4. `atlas-shared-browser-qa`
5. `atlas-phase-gate-enforcer`

---

## Mandatory MCP Verification (Hard Requirement)

You must run and report MCP-assisted checks for:

1. **Excel MCP**
   - Validate Class Program Matrix mapping against workbook structure:
     - sheet families (summary/subject/consolidated),
     - section-band groupings,
     - quantity parity (rows/blocks where applicable).

2. **Word MCP + PDF MCP**
   - Validate occupancy output structure against source patterns:
     - `11x6` and `13x6` template family present,
     - repeated block order and form segmentation,
     - export readability and pagination behavior.

If a specific MCP server/tool fails:
- include exact error output,
- add fallback verification notes,
- mark gate as `CONDITIONAL GO` or `NO-GO` unless parity can still be proven.

---

## What to Validate

## A) Class Program Matrix Mode
- Desktop matrix is scannable and structurally aligned to stakeholder workbook mental model.
- Mobile matrix is usable via condensed/progressive sections (not compressed desktop grid).
- Labels and groupings are familiar and plain-language.

## B) Occupancy Export Templates
- Both `11x6` and `13x6` variants exist and are selectable/deterministic.
- Data mapping preserves real structural quantities with placeholder identities.
- Export/preview output is print-friendly and visually stable.

## C) Cross-Cutting
- No regressions to existing scheduling workflow paths.
- Accessibility and focus/scroll behavior remain acceptable.
- Evidence log is complete and audit-friendly.

---

## Required Automated Checks
- Run affected frontend/server build/tests.
- Run any export validation scripts introduced by implementation.
- Report exact commands and pass/fail.

---

## Required Screenshots and Artifacts

Save screenshots under:
- `qa-artifacts/screenshots/class-program/`
- `qa-artifacts/screenshots/occupancy-export/`

Minimum captures:
- Class Program Matrix desktop
- Class Program Matrix mobile portrait
- Occupancy template `11x6` preview
- Occupancy template `13x6` preview
- Exported artifact render sample(s)

Naming:
- `YYYYMMDD-surface-viewport-step-result.png`

---

## Evidence Log Update (Required)

Update `docs/verification/evidence-log.md` with:
- source-file pattern -> implemented output mapping
- MCP verification details and outputs
- automated checks
- manual QA findings
- unresolved risks
- final decision (`GO` / `CONDITIONAL GO` / `NO-GO`)

---

## Hard NO-GO Conditions
- Missing MCP verification for either deliverable.
- Missing `11x6` or `13x6` occupancy template support.
- Class Program Matrix does not align to workbook structure family.
- Screenshot/artifact set incomplete.
- Completion claim without evidence-log update.

## GO Criteria
- Both deliverables pass structural parity, usability, and evidence requirements.
- MCP checks confirm source-to-output mapping integrity.
- No critical blockers remain.

