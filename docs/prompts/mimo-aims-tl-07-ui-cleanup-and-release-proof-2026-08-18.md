# Mimo Prompt 07 — UI Cleanup and Release Proof

## Role

You are the ATLAS final proof executor for this AIMS/Teaching Load integration sequence.

Do not begin this prompt until Prompt 06 receives Codex QA `GO`.

## Scope

This prompt closes small UI compliance debt from Teaching Load suggestion preview and proves the full AIMS contract end to end.

## Target files

- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- Any tests added in prior prompts
- `docs/verification/evidence-log.md`

## UI cleanup requirements

- Rename code comment `Preview Suggested Rows` to `Preview New Assignments`.
- Replace raw `title={...}` attributes in the suggested assignment preview list with project-approved `Tooltip`, `HoverCard`, or visible accessible text.
- Do not change counts, API behavior, or modal control flow.
- Do not add visual clutter to the modal.

## Release proof requirements

### Backend proof

- The default public published schedule endpoint returns active-year only or `CURRENT_PUBLISHED_RUN_NOT_FOUND`.
- Explicit school-year published routes return only the requested school year.
- Historical published schedules are reachable only through explicit school-year routes.
- Term filtering is no longer confused with school-year filtering.
- Public payloads include external IDs needed by AIMS.
- Teaching Load proposal preview/cancel does not mutate canonical Teaching Load.
- Teaching Load proposal preview/cancel does not mutate public published schedule output.

### Browser/Tailnet proof

Use:

```text
https://njgrm.buru-degree.ts.net
1000001 / AdminSY2026!
```

Simulate:

1. Login as Admin.
2. Open `/teaching-load`.
3. Click `Suggest Teaching Load draft`.
4. Confirm modal shows `Preview New Assignments`.
5. Confirm visible text does not include `suggested rows` or `New Rows`.
6. Confirm modal counts match the proposal API breakdown.
7. Close/cancel without applying.
8. Confirm Teaching Load counts are unchanged.
9. Probe current published schedule endpoint.
10. Probe explicit school-year published schedule endpoint.
11. Confirm AIMS-facing payload includes external IDs.

## Verification commands

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/teaching-load-suggestion-preview.test.ts
```

Run every new backend test added by Prompts 01-05.

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run any Playwright specs added for the Teaching Load suggestion modal and AIMS contract.

## Evidence log

Append to `docs/verification/evidence-log.md`:

- date/time
- active school year from runtime context
- published endpoint outputs
- explicit school-year endpoint outputs
- proposal preview before/after counts
- cleanup proof
- command results
- remaining caveats

## Acceptance criteria

- No raw `title=` remains in the touched Teaching Load modal preview rows.
- No stale visible `suggested rows` or `New Rows` wording appears in the modal.
- AIMS current endpoint is active-year safe.
- AIMS explicit school-year endpoint works.
- AIMS payload contains EnrollPro-compatible external IDs.
- Proposal preview remains isolated from canonical Teaching Load and public schedules.
- All test gates pass.

## Final report required

Return:

1. `GO` or `NO-GO`.
2. Exact endpoint outputs.
3. Exact files changed.
4. Exact tests and results.
5. Cleanup evidence.
6. Whether this sequence can be considered closed.
