# Phase 3 Teaching Load UX Audit

Date: 2026-05-23
Scope: scheduler-first UX/UI audit of `Teaching Load` after the recent staffing and truth-contract passes

## Verdict

`Teaching Load` is functionally powerful, but still not scheduler-friendly enough.

The page now exposes more honest staffing and load truth than before, but it still does not present that truth with enough hierarchy or clarity. The result is a workspace that feels:

- technically rich
- cognitively heavy
- only partially trustworthy

The biggest current UX problem is not just visual density. It is that the page still asks the scheduler to interpret multiple competing models at once:

- assignment completeness
- current-year ownership integrity
- concurrent weekly load
- policy credited load
- staffing shortage
- manual override state

Those concepts are all valid, but the page does not teach them well.

## High-severity findings

### 1. The top-page overview still looks authoritative even when the underlying metrics disagree

The current top banner shows:

- `real staffed`
- `synthetic`
- `unowned`
- `total pairs`
- `teachers assigned`

This is too compressed and too jargon-heavy for such an important control surface.

Worse, the headline currently sits next to `View Staffing Needs`, even though the page can still show:

- one set of pair totals in the header
- another uncovered truth in the staffing modal

That means the first thing the scheduler sees is still not the most trustworthy thing.

### 2. Critical explanation is trapped in a tooltip

The selected-teacher panel hides important load truth behind `Breakdown` tooltip content:

- section-based teaching load
- raw vs credited vs adjusted
- rotation-family overlap
- section-level breakdown

That is too much critical reasoning for a transient tooltip.

This content should live in a durable surface:

- expandable inline panel
- persistent explainer block
- pinned detail surface

Right now the page still requires precision hovering to understand the most important load math.

### 3. The left rail is too dense and too small

The teacher list still relies on very small text sizes and compressed identity stacks.

Problems:

- specialization is present, but tiny
- department is tiny
- status is mostly encoded as micro bars and percentages
- multiple filter controls are permanently visible in the same narrow rail

This makes the rail feel like a debugging navigator rather than a calm roster workspace.

### 4. The page still mixes routine actions with destructive or high-risk actions too closely

The current top header places:

- `Reset Global Load`
- `View Staffing Needs`
- `Auto-Fill Remaining`

in the same high-visibility action band.

That is poor scheduler ergonomics.

`Reset Global Load` is an advanced repair action, not a peer of routine daily actions.

### 5. The staffing-needs modal is still hard to trust at a glance

Even after the recent parity improvements, the modal still has UX problems:

- it leads with hire-count style framing
- it does not yet clearly distinguish:
  - raw uncovered rows
  - concurrent weekly shortage
- it still uses the phrase `full-time faculty slots` without enough context
- it still contains visible mojibake in the shortage badge row (`Â·`)

So even when the backend improves, the modal still feels more alarming than explanatory.

### 6. Subject assignment rows are still too noisy for fast manual editing

`SubjectRow` currently shows many concepts at once:

- subject name
- code
- outside department
- selected count
- select-all action
- blocked count
- DB conflicts
- hours per section
- expandable grade groups
- section ownership state

This is technically useful, but visually exhausting.

It still feels closer to an inspector/debugger than to a scheduler's editing surface.

### 7. Integrity diagnostics are accurate but not well-integrated into workflow

The `Current-Year Teaching Load Integrity` panel is valuable, but it currently behaves like a technical status slab inserted above the workspace.

It does not yet connect naturally to:

- what the scheduler should do next
- which subjects are affected
- whether autofill is safe

So it adds honesty, but also cognitive load.

## Medium-severity findings

### 8. The page still uses too much microtext

Examples:

- tiny department and specialization lines
- tiny load labels
- tiny subject-row helper labels
- tiny filter chip labels

This is especially problematic on a page that is already concept-dense.

### 9. Filter architecture is still weak for a long-lived workspace

The left rail currently carries:

- search
- assignment status
- department filter
- sort
- load filter

This is a lot of always-on filtering in a narrow rail. It takes useful vertical space away from the actual teacher list.

This page would benefit from the same progressive-disclosure pattern already used better elsewhere in the app.

### 10. Status labels are still not explained enough

Labels like:

- `Excluded`
- `Draft`
- `Placeholder`
- `Outside Dept.`
- `blocked`
- `DB conflict`

are understandable to developers, but still need stronger operator meaning in context.

The page assumes too much prior knowledge.

### 11. The teacher rail and selected-teacher pane still feel like two different products

The left rail behaves like a compressed control panel:

- search
- assignment-status toggles
- department filter
- sort control
- load filter
- grouped department headings
- tiny load chips

The selected-teacher pane is calmer and more legible, but the two sides do not yet feel like one coherent workflow.

The rail still behaves more like a mini diagnostics navigator than a roster-first scheduler workspace.

### 12. Manual workflow is powerful but not yet intuitive

The page supports:

- direct section picking
- ownership swap
- undo/redo
- draft discard
- save

But the visual workflow does not strongly guide a scheduler through:

1. inspect load
2. inspect uncovered subject
3. choose teacher
4. assign or swap
5. save
6. verify staffing impact

It is all present, but not choreographed.

## What is already good

These should be preserved:

- selected-teacher header with actual/raw/credited values
- explicit rotation adjustment badge
- synthetic coverage quarantine
- subject focus deep-link behavior
- draft/undo/redo support
- section-level ownership conflict prevention
- adviser visibility
- read-only/offline protection messaging

The next pass should simplify and clarify, not flatten the page.

## Recommended UX closure direction

### 1. Rebuild the top banner around dual truth

The header should clearly separate:

- assignment completeness
- concurrent weekly shortage

and stop compressing both into one small band of badges.

### 2. Promote load explanation into a durable panel

Move the current breakdown/rotation explanation out of the tooltip into:

- a persistent explainer block
- an expandable detail panel in the selected-teacher area

### 3. Demote advanced repair actions

Move:

- `Reset Global Load`

into an advanced tools menu or repair drawer, away from the primary toolbar.

### 4. Simplify the teacher rail

Make the rail more roster-like:

- larger specialization text
- fewer tiny secondary lines
- fewer always-on controls
- better empty / overload / excluded states
- clearer group-heading hierarchy without microtext

### 5. Turn staffing-needs into a clearer diagnostic surface

The modal should present:

- raw uncovered completeness
- concurrent weekly shortage
- affected subject families
- what the scheduler can do next

instead of leading so quickly with hire framing.

### 6. Reduce subject-row badge and action noise

The row should foreground:

- subject identity
- current ownership count
- assignment state

and demote the rest into secondary reveal patterns where possible.

### 7. Demote integrity diagnostics into an advanced operator surface

The page should keep integrity honesty, but it should not force technical reconciliation counters into the main workflow band by default.

Better options:

- collapsible `Data Health` strip
- admin-only expandable diagnostic section
- compact summary with a drilldown link

### 8. Remove remaining encoding drift and minimum-size violations

The page should not ship with visible mojibake or sub-`text-xs` operator-facing text in normal workflow surfaces.

## Final conclusion

The page is no longer crude, but it is still too close to an internal operations console.

To become scheduler-friendly, it needs one more pass focused on:

- visual hierarchy
- persistent explanation
- action safety
- reduced microtext
- clearer distinction between completeness and weekly load truth
