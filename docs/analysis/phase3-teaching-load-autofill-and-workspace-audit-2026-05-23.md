# Phase 3 Teaching Load Auto-Fill and Workspace Audit

Date: 2026-05-23
Scope: investigate the live `Auto-Fill` failure and audit the current scheduler usability regression on `Teaching Load`

## Verdict

Two separate regressions are now present on `Teaching Load`:

1. `Auto-Fill` is failing with a real server-side `500`
2. the subject-assignment workspace became too vertically expensive for practical manual scheduling

The first is a concrete transaction bug.

The second is a UX/UI density regression caused by the most recent recovery pass over-correcting toward explanation cards and decorative hierarchy.

## Functional Investigation

### 1. `Auto-Fill` is truly broken live

Live Tailnet verification:

- `POST /api/v1/faculty-assignments/auto-fill`
- result: `500`

This is not a bad client message or a preview-only misunderstanding.

The write path is failing.

### 2. The failure is in the apply transaction, not in staffing preview

The staffing/reporting path still works:

- `POST /api/v1/faculty-assignments/report/staffing-needs`

So the recent truth-model work did not destroy the read-side logic.

The failure begins only when `autoFill(..., { previewOnly: false })` tries to persist assignments.

### 3. Root cause found locally

Direct local service invocation against the current DB reproduces the failure:

- `autoFill(1, 55, undefined, { previewOnly: false })`

Observed exception:

- `PrismaClientUnknownRequestError`
- underlying Postgres error:
  - `25P02`
  - `current transaction is aborted, commands ignored until end of transaction block`

The failing region is in:

- [teaching-load-automation.service.ts](/d:/ATLAS/atlas-server/src/services/teaching-load-automation.service.ts:664)
- specifically the loop around:
  - [line 701](/d:/ATLAS/atlas-server/src/services/teaching-load-automation.service.ts:701)

### 4. Why the transaction abort happens

The current code attempts this pattern:

- `subjectSectionOwnership.create(...)`
- catch Prisma `P2002`
- continue the same transaction

That is not safe here.

Once Postgres throws an error inside the transaction, the transaction is aborted. Even if application code catches the Prisma exception, the transaction cannot continue normally.

So the most likely real sequence is:

1. one `subjectSectionOwnership.create()` hits a duplicate or another DB error
2. the code catches it locally
3. the next DB call runs inside an already-aborted transaction
4. Postgres returns `25P02`
5. the whole request becomes `500`

This means the current duplicate-handling strategy is wrong for this transaction design.

## UX/UI Audit

## Main usability verdict

The page is now less workable for manual assignment, even though some explanation became clearer.

The scheduler lost usable assignment surface area.

### 1. The selected-teacher card became too tall

Current structure in [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1458):

- a large summary card
- a `md:grid-cols-4` breakdown section
- a large persistent explanation block spanning two columns
- extra alert strips below it

This improves explanation, but it consumes too much vertical space before the scheduler even reaches the assignment workspace.

### 2. The assignment-toolbar band is too tall for the amount of control it provides

The assignment workspace now uses:

- one header row for actions
- one filter row below it
- large padding and stronger card framing

See:

- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1593)
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1624)

This reduces the visible assignment area too much on common laptop heights.

### 3. Subject rows became prettier but less dense

The current `SubjectRow` is now card-based and taller:

- larger identity header
- larger counters
- larger action buttons
- larger section cards

See:

- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty-assignments/SubjectRow.tsx:196)

The section grid now uses:

- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

This is visually clean, but too space-hungry for a page whose core task is fast manual allocation across many subjects and sections.

### 4. The page is solving readability by spending vertical space instead of using better density rules

Instead of:

- lighter hierarchy
- cleaner typography
- calmer grouping

the current pass often uses:

- larger cards
- more padding
- more row separation
- more stacked explanation surfaces

That makes the page feel polished in isolation but slower to operate as a scheduling tool.

### 5. The assignment actions are now clearer, but the workspace is less efficient

`Take` and `Override` are more discoverable than before, but the total section-management surface is now slower to scan because:

- fewer section tiles fit at once
- more scrolling is needed
- more of the page is consumed by supporting interpretation

### 6. The new top-band and data-health treatments are not the main problem anymore

The latest pass did improve:

- truth separation
- maintenance demotion
- durable explanation

But the selected-teacher area and assignment workspace over-expanded to compensate.

So the page is now less of a raw diagnostics console, but still not operationally efficient enough.

## What should happen next

The next fixes should be split:

### A. Copilot/backend narrow fix

Fix `Auto-Fill` first by repairing the transaction strategy.

Target:

- no more `500`
- no catch-and-continue on aborted transaction paths
- explicit live verification on Tailnet

### B. Gemini/frontend narrow recovery

Do a density recovery pass for the assignment workspace.

Target:

- keep the newer truth model and durable explanation
- reclaim vertical space
- make subject-section placement practical again
- keep the page scheduler-first rather than presentation-first

## Final conclusion

`Teaching Load` is currently in a split-failure state:

- backend apply flow is broken
- manual assignment UI is too expanded

Do not treat this as one broad “polish” issue.

It needs:

1. a narrow transaction fix
2. a separate workspace-density recovery pass
