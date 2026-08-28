# Setup Header Density Audit

Date: 2026-08-08  
Pages audited: Sections, Subjects, Teachers, Teaching Load.

## Verdict

NO-GO before this simplification pass.

The setup headers had become visually noisy and unpleasant to scan. The issue was not spacing alone. The header pattern was carrying page title, long instructions, source-truth explanations, metrics, Help, secondary actions, primary actions, search, and filters in the first visible band.

## Concrete Findings

### Sections

- The header displayed a long setup instruction beside the title.
- The source chip and full `Source truth` sentence competed for attention.
- Metrics such as section count and home-room count appeared in the same band as primary actions.
- `Help`, `Browse room map`, and `Sync sections` all looked like comparable top-level actions.
- Search and filters extended the header into a second large band.

### Subjects

- The header exposed curriculum explanation text before users saw the list.
- `Refresh offerings` and `Add subject` competed as header-level actions.
- Subject metrics crowded the command row instead of supporting the content area.

### Teachers

- `Create Placeholder` and `Refresh teacher roster` appeared as peer primary actions.
- The page did not make `Review load` the first obvious teacher-workflow decision.
- Roster source details were visible as long text instead of being tucked behind source details.

### Teaching Load

- The toolbar exposed source text, status, review warning, view mode, Help, More, and primary action at once.
- Coverage stats and mode controls were reachable but visually too prominent.
- The guided repair queue was present, but the header still felt like an expert cockpit.

## Root Cause

The shared setup header pattern allowed too many concerns to render together:

- title;
- long description;
- long source-truth sentence;
- source chip;
- metrics;
- Help;
- secondary action;
- primary action;
- search/filter toolbar.

This breaks the SMART-family one-decision rule and makes the setup pages harder for older non-technical users to parse.

## Required UX Correction

- Keep the command header to one decision.
- Move source detail into a click/tap source popover.
- Move metrics into a readiness strip below the command header.
- Move secondary actions into More.
- Keep search and filters in the content toolbar, not the command header.
- Keep Help available without making explanatory text visible by default.
