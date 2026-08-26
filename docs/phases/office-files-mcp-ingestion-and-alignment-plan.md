# Office Files MCP Ingestion and Alignment Plan

## Purpose
Capture stakeholder schedule-document structure from `office-files/` and align ATLAS outputs/UI to familiar formats without exposing real names.

## MCP Setup Status

Configured in `C:/Users/njgro/.cursor/mcp.json`:
- `word-document-server` -> `python D:/ATLAS/mcp-servers/Office-Word-MCP-Server/word_mcp_server.py`
- `excel` -> `python -m excel_mcp stdio` (from `haris-musa/excel-mcp-server`)
- `pdf-reader` -> `cmd /c npx --yes @sylphx/pdf-reader-mcp --allow-dir=D:/ATLAS/office-files`

Smoke-test results:
- Word MCP: startup successful (FastMCP stdio server banner observed).
- PDF MCP: command starts and stays active (no startup crash).
- Excel MCP (haris-musa): module starts in stdio mode (`python -m excel_mcp stdio`) and remains active.

Note:
- Cursor MCP descriptors for these new servers may require Cursor MCP refresh/restart to appear under `mcps/*`.
- Prior Excel MCP candidate (`@negokaz/excel-mcp-server`) failed on this machine due missing packaged binary; replaced with Python-based server.

## Extracted File Inventory (Current Quantity/Structure)

## Word (`.docx`)
1. `BLDG3-BLDG-9-occupancy-plan-2023-24.docx`
   - Paragraphs: 132
   - Tables: 6
   - Table shapes: five `11x6` + one `13x6`
   - Embedded images: 2
2. `GARDE-8-OCCUPANCY-PLAN.docx`
   - Paragraphs: 16
   - Tables: 1
   - Table shape: `13x6`
   - Embedded images: 9
3. `OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx`
   - Paragraphs: 137
   - Tables: 6
   - Table shapes: five `11x6` + one `13x6`
   - Embedded images: 2

## Excel (`.xlsx`)
`CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- Sheet count: 14
- Summary sheets: 3 (`SUMMARY Q1 PAGE1/2/3`)
- Subject sheets: 10 (`Q1-BIOLOGY`, `Q2-CHEMISTRY`, `Q3-EARTH & SPACE`, `Q4-PHYSICS`, `MATH.`, `ENG`, `ESP.`, `AP.`, `FIL`, `MAPEH.`)
- Consolidated sheet: `CLASS SCHEDULES`
- Non-empty row signals:
  - Subject sheets mostly ~35 non-empty rows each
  - `CLASS SCHEDULES`: 76 non-empty rows

## PDF (`.pdf`)
1. `CamScanner-04-16-2026-14.38.pdf`
   - Pages: 7
   - Extracted text chars: 77 (mostly scanned)
   - Embedded images: 14
2. `GRADE-7-OCCUPANCY-PLAN.pdf`
   - Pages: 4
   - Extracted text chars: 1787
   - Embedded images: 6

## Stakeholder Format Signals Observed
- Occupancy plans are form/table heavy with repeated building blocks.
- Frequent `6-column` occupancy grid pattern, including `11-row` and `13-row` variants.
- Grade/program schedules are workbook-oriented:
  - per-subject tabs + summary pages + consolidated class schedule.
- Some PDFs are scan-heavy, so image-first extraction is necessary for format fidelity checks.
- `CLASS SCHEDULES` sheet contains dense multi-section timetable blocks with repeated `time/subject/teacher` triplets; this should inform ATLAS print/export structure.

## Workflow Match vs ATLAS (Gap Scan)

Matches:
- ATLAS already has map/building/room concepts that map to occupancy-plan intent.
- ATLAS schedule review flows can represent class-program tabular outputs.

Gaps:
1. Output familiarity gap:
   - ATLAS UI is workflow-first; stakeholder artifacts are print/report-first.
2. Multi-sheet expectation gap:
   - Stakeholders use per-subject/per-quarter tabs; ATLAS views are route-centric and interactive.
3. Scan-derived format gap:
   - Image-dominant PDFs require template recreation from visual structure, not just text extraction.
4. Occupancy form parity gap:
   - Repeated `11x6`/`13x6` table templates are not yet formalized as export-ready report templates.
5. Dense class-program layout gap:
   - Stakeholder workbook uses horizontally repeated section blocks in one sheet (`CLASS SCHEDULES`) that ATLAS does not currently mirror in report/export views.

## Implementation Plan (Placeholder Names, Real Quantities)

## Phase 1 - Ingestion Reliability
1. Fix Excel MCP startup:
   - Verify package version and binary download behavior.
   - If needed, pin a working version or run from repo build artifact.
2. Refresh Cursor MCP server registry so `word-document-server`, `excel`, `pdf-reader` descriptors are available.
3. Add automated extraction commands (or MCP prompt recipes) for recurring office-file scans.

## Phase 2 - Canonical Format Schema
1. Define `stakeholder_format_schema` from extracted quantities:
   - document type
   - sections
   - table dimensions
   - page/sheet counts
   - visual blocks (logos, signature lines, occupancy grid)
2. Store schema in a docs contract for UI/export parity decisions.

## Phase 3 - ATLAS Output Alignment
1. Build export templates matching stakeholder familiarity:
   - Occupancy report template (`11x6`, `13x6` variants)
   - Class-program workbook export (summary pages + subject tabs + consolidated schedule)
   - Consolidated multi-section timetable export patterned after the `CLASS SCHEDULES` sheet (`time/subject/teacher` repeated columns).
2. Keep names placeholderized in generated outputs while preserving real row/section quantities.
3. Add side-by-side QA checklist:
   - source office file vs ATLAS export parity (structure/layout/counts).

## Phase 4 - UI Polish Using Familiar Structure
1. Faculty/scheduler views:
   - add optional “document-style” mode/cards reflecting occupancy and class-program mental model.
   - add optional `Class Program` matrix view using grouped section bands similar to stakeholder workbook blocks.
   - add `Occupancy Form Preview` mode for building/room assignment pages to mirror `11x6`/`13x6` expectations.
2. Keep workflow UX modern, but expose recognizable report groupings and labels.
3. Validate with manual QA screenshots and stakeholder review rubric.

## MCP Usage Instructions (Operational)
1. Ensure `C:/Users/njgro/.cursor/mcp.json` contains the three office servers.
2. Restart/refresh Cursor MCP servers so descriptors are generated.
3. Before each MCP tool call:
   - inspect tool schema descriptor under `C:/Users/njgro/.cursor/projects/d-ATLAS/mcps/<server>/tools/*.json`
4. Extract from `D:/ATLAS/office-files`:
   - Word: text/outline/tables/comments/images
   - Excel: sheet metadata + ranges + screenshot captures
   - PDF: full text + page ranges + image extraction
5. Log extraction evidence and feed quantities into output-template planning.

