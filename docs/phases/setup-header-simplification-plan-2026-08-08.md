# Setup Header Simplification Plan

Date: 2026-08-08  
Target pages: Sections, Subjects, Teachers, Teaching Load.

## Goal

Make setup pages match the SMART-family one-decision pattern: compact header, one primary action, source status visible, secondary details hidden behind Help or More, and the working list/table visible earlier.

## Implementation Rules

- Visible setup header shall show page title, compact source/status chip, one primary action, Help, and More.
- Long page descriptions shall move into Help.
- Long source-truth explanations shall move into a source details popover.
- Metrics shall render as a compact readiness strip below the command header.
- Search and filters shall remain in a local content toolbar below the command header.
- Secondary and advanced actions shall move into More.
- Existing routes and source-of-truth behavior shall not change.

## Page Decisions

### Sections

- Keep `Sync sections` visible as the primary data action.
- Move `Browse room map` into More.
- Keep room assignment work in the row/list content.

### Subjects

- Keep `Refresh offerings` visible as the primary data action.
- Move `Add subject` into More unless the page is empty in a future pass.
- Keep coverage review in the list rows/cards.

### Teachers

- Keep `Review load` visible as the primary workflow action.
- Move `Create Placeholder` into More.
- Move `Refresh teacher roster` into More.

### Teaching Load

- Keep one visible primary action: `Suggest Teaching Load draft`, `Save draft`, or `Retry source`.
- Move coverage snapshot, staffing audit, view mode, jump list, staffing mode, reconcile, and global reset into More.
- Keep the guided repair queue as the first work-area object.

## Test Requirements

- Setup header desktop height is at or under 88px.
- Setup header mobile portrait height is at or under 104px.
- Setup header mobile landscape height is at or under 76px.
- Teaching Load header desktop height is at or under 96px.
- Teaching Load header mobile portrait height is at or under 112px.
- Teaching Load header mobile landscape height is at or under 84px.
- No global browser scrollbar.
- No horizontal page overflow.
- No visible `Source truth:` sentence in the command header.
- More exposes the hidden secondary actions.
- Help opens page guidance.
- Existing sync, refresh, placeholder, room-map, and Teaching Load suggestion actions remain reachable.
