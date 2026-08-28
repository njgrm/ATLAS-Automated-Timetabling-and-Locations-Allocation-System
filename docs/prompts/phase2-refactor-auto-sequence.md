# Phase 2 Refactor Auto Sequence

Use this sequence instead of the one-shot mega prompt when running Copilot Auto.

## Why this sequence exists
The one-shot prompt was broad enough that Auto completed only the easiest local slices:
- shared-facility schema and seed wiring
- program-aware shift-window shape
- partial quarter-to-term renaming

It did not finish the two hardest closure blockers:
- full tri-sem replacement
- home-room KPI recovery

## Recommended request budget
Use 3 requests total:
1. tri-sem contract reset
2. home-room KPI recovery
3. final closure gate

This is the lowest request count that still isolates the two highest-risk failures and prevents shallow self-certification.

## Exact run order
1. `execute @file:phase2-trisem-contract-reset-prompt.md`
2. `execute @file:phase2-home-room-kpi-recovery-prompt.md`
3. `execute @file:phase2-refactor-closure-gate-prompt.md`

## Operating rules for each run
- Do not skip ahead if the current prompt returns `NO-GO`.
- Do not let Auto rewrite evidence as if the phase is complete when the prompt only covered one slice.
- If a prompt finishes unusually fast, inspect whether it avoided the required first-step audit or omitted the requested verification.

## What "efficient" means here
Efficient does not mean one huge request.
Efficient means each request has:
- one dominant objective,
- one hard acceptance decision,
- no room to hide partial work behind broad summaries.

## Expected outcomes by prompt

### Prompt 1
- either removes the remaining active quarter-era contract or returns a blocker list by file

### Prompt 2
- either raises and proves the home-room KPI or returns a blocker list tied to measured results

### Prompt 3
- either closes the phase honestly or produces a final NO-GO report with evidence-quality corrections
