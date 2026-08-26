# Mimo Prompt 01 — Baseline and Teaching Load Proposal Isolation

## Role

You are the ATLAS executor for AIMS integration safety. This first prompt is mostly proof and test hardening. Do not change public schedule behavior yet except where tests require harmless helpers.

## Problem

A scheduler reported that running `Suggest Teaching Load draft` appears to make AIMS already see those assignments even before the officer applies/saves the suggestion.

Codex Tailnet probe on 2026-08-18 found:

- Suggestion preview did not mutate canonical Teaching Load counts.
- Public AIMS endpoint still returned an old published schedule from another school year.

This prompt must lock that distinction with tests so future fixes do not regress it.

## Target files

- `atlas-server/src/services/teaching-load-suggestion-proposal.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/__tests__/teaching-load-suggestion-preview.test.ts`
- Add a focused backend test file if cleaner:
  - `atlas-server/src/__tests__/aims-teaching-load-proposal-isolation.test.ts`

## Requirements

### Functional requirements

- When `POST /api/v1/faculty-assignments/suggestion-proposals` is called, the system shall persist a proposal record without creating `FacultySubject` rows.
- When `POST /api/v1/faculty-assignments/suggestion-proposals` is called, the system shall persist a proposal record without creating `SubjectSectionOwnership` rows.
- When `POST /api/v1/faculty-assignments/suggestion-proposals` is called, the system shall leave public published schedule payloads unchanged.
- When a pending proposal is cancelled, the system shall set its status to `CANCELLED`.
- When `POST /api/v1/faculty-assignments/suggestion-proposals/:proposalId/apply` is called, the system shall be the only suggestion-proposal route that writes canonical Teaching Load rows.
- If a proposal is not pending, then the system shall reject apply with a plain conflict response.

### Non-functional requirements

- Tests shall derive the active school year dynamically from runtime context or controlled fixtures.
- Tests shall clean up any created proposal in `finally`.
- Tests shall fail if preview/cancel changes canonical Teaching Load counts.

## Implementation guidance

- Use direct Prisma counts for `FacultySubject`, `SubjectSectionOwnership`, and `TeachingLoadSuggestionProposal`.
- Capture public schedule response source and entry count before preview and after preview.
- Do not rely only on UI tests; this is a backend contract.
- Do not apply suggestions in live Tailnet for this prompt.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/teaching-load-suggestion-preview.test.ts
```

Run the new isolation test directly.

Live Tailnet probe:

1. Login as Admin.
2. Resolve active school year from `/api/v1/runtime/context?schoolId=1&verifyUpstream=true`.
3. Capture `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=<activeSchoolYearId>&pageSize=1`.
4. Capture `GET /api/v1/schools/1/schedules/published`.
5. Create suggestion proposal.
6. Capture the same two reads again.
7. Cancel the proposal.
8. Capture the same reads again.

## Acceptance criteria

- Canonical Teaching Load counts do not change after preview.
- Public published schedule source and entry count do not change after preview.
- Proposal status becomes `CANCELLED` after cleanup.
- Test output distinguishes proposal state from canonical Teaching Load.
- No source code path claims suggestion preview is final AIMS truth.

## Final report required

Report the exact before/after counts and whether any live proposal remains pending.
