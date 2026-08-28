# DeepSeek Prompt 04 — Full System Lifecycle Release Proof

## Role

You are the implementation executor for ATLAS. Codex is acting as QA/reviewer after you finish. Implement only this prompt, then stop and report.

## Preconditions

Do not start this prompt until:

- Prompt 01 Dashboard first-screen recovery is `GO`.
- Prompt 02 runtime context vs rollover status alignment is `GO`.
- Prompt 03 older-user validation realignment is `GO`.
- EnrollPro and SMART dummy rollover blockers are either resolved or explicitly documented as external blockers.

## Objective

Prove the current system lifecycle with dummy/test data:

EnrollPro active school year → ATLAS rollover status → Sections/Teachers sync → Teaching Load review/build → timetable generation → review blockers/unassigned handling → publish gate behavior → faculty/public schedule visibility where applicable.

This prompt is primarily verification and release-proof work. Only fix concrete failures discovered during the proof.

## Scope

Pages and domains:

- Dashboard
- Sections
- Subjects
- Teachers
- Teaching Load
- Timetable
- Schedules/Publish
- Faculty schedule
- Public schedule
- Runtime rollover APIs
- Generation readiness/publish gates

## Required Lifecycle Assertions

### Runtime/source truth

- EnrollPro active school year is visible and current.
- ATLAS runtime context and rollover status agree.
- Dashboard does not show stale/misleading aligned state.
- If EnrollPro is unavailable, the UI explains saved-data limitations.

### Setup readiness

- Sections show EnrollPro-backed current-year section data.
- Teachers show current EnrollPro-backed faculty data.
- Subjects are loaded and explain missing/optional upstream subject-offering limitations.
- Teaching Load clearly states whether it is empty, draft, saved, or review-required.

### Teaching Load

- `Suggest Teaching Load draft` remains officer-reviewed, not silent.
- Preview happens before apply.
- Applying suggestion does not become final without officer review/save.
- Disabled actions show plain reasons.
- If a reversible Teaching Load fixture is used, it must clean up.

### Timetable

- Generation is blocked if Teaching Load/setup readiness is not sufficient.
- When fixture setup is sufficient, generation produces a current-year run.
- Timetable Simple view shows the current year/run clearly.
- Generated placement, drag placement, generated swap, draft planning, draft swap, teacher-departure discovery, and published revision discovery still work or are classified with exact fixture limitations.
- No post-swap regression of teacher/section/break/lunch metadata occurs.

### Publish/faculty/public

- Publish remains blocked when hard violations exist.
- Soft-warning acknowledgement is required when applicable.
- Published schedule routes remain readable.
- If no valid published current-year run exists, faculty/public pages show a plain empty state rather than fabricated current data.

## Test Strategy

Prefer non-destructive read-only proof first. Use reversible fixtures only where existing fixtures are already designed for cleanup.

Allowed fixture categories:

- Existing reversible Teaching Load save/revert fixture.
- Existing timetable draft swap reversible fixture.
- Existing teacher-departure performance fixture.

Do not create a new destructive data reset flow in this prompt.

## Required Commands

Static gates:

```powershell
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
```

Tailnet browser gates:

```powershell
cd D:\ATLAS
$env:PLAYWRIGHT_ADMIN_EMAIL='1234501'
$env:PLAYWRIGHT_ADMIN_PASSWORD='DepEdSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/cross-page-ux-release-readiness.spec.ts qa-artifacts/playwright/specs/smart-parity-cross-page.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/enrollpro-new-year-readiness.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts qa-artifacts/playwright/specs/timetable-finalization-grid-overflow.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1 --reporter=line
```

Optional write-fixture gates only if safe and already implemented:

```powershell
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/teaching-load-reversible-save-fixture.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-draft-swap-live-reversible.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts --workers=1 --reporter=line
```

## Required API Probes

Use authenticated probes with `1234501 / DepEdSY2026!`:

- `/api/v1/runtime/context?schoolId=1&verifyUpstream=true`
- `/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true`
- `/api/v1/sections/summary/3?schoolId=1`
- `/api/v1/faculty?schoolId=1&schoolYearId=3&page=1&pageSize=5`
- `/api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=3`
- `/api/v1/generation/1/3/runs`
- `/api/v1/generation/1/3/runs/latest/draft`
- relevant published schedule endpoints if a valid published current-year run exists.

## Acceptance Criteria

- All static gates pass.
- Runtime context and rollover status agree.
- Dashboard/cross-page UX budgets pass.
- Older-user browser proxy spec passes or returns only documented proxy limitations.
- Current-year setup state is clear and not misleading.
- Generation/publish gating returns plain-language next steps.
- Timetable function matrix and performance matrix pass.
- Any reversible fixture writes clean up after themselves.
- Faculty/public current-year views are correct for the actual published/no-published state.
- No app-critical console/page/network errors appear.

## Product GO Rule

Do not claim full Product GO from automated tests alone. If all technical gates pass but no real older scheduler officer has validated the flow, return:

```text
Technical GO; Product GO pending moderated older-user validation or stakeholder acceptance of simulated evidence.
```

## Do Not Do

- Do not run destructive dummy reset.
- Do not bypass publish gates.
- Do not fabricate published current-year data.
- Do not silently seed Teaching Load as final truth.
- Do not weaken tests to force a green run.

## Final Report Format

Return:

1. `GO`, `CONDITIONAL GO`, or `NO-GO`.
2. Lifecycle stage table:
   - EnrollPro active year
   - ATLAS rollover
   - Sections
   - Teachers
   - Subjects
   - Teaching Load
   - Generation
   - Timetable review
   - Publish
   - Faculty/public schedule
3. Exact command results.
4. Endpoint probe outputs summarized.
5. Browser artifact paths.
6. Reversible fixture cleanup proof.
7. Remaining blockers and who owns them: ATLAS, EnrollPro, SMART, or Product validation.

