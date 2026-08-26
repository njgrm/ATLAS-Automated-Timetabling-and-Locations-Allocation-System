# Prompt 04 — Focused Release Proof After Lost-Scheduler Fixes

## Goal

Re-run the full focused release proof after fixing the three concrete failures. This prompt is verification-first and should only change code for concrete regressions discovered during the proof.

## Scope

Verification and evidence. Do not add new UX features in this prompt.

## Required local gates

```powershell
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

## Required Tailnet health gate

```powershell
Invoke-WebRequest -Uri 'https://njgrm.buru-degree.ts.net/api/v1/health' -UseBasicParsing -TimeoutSec 20
```

Expected:

```text
200
{"status":"ok","service":"atlas"}
```

## Required Playwright gates

Set credentials first:

```powershell
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
```

Run:

```powershell
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Required source guard

```powershell
cd D:\ATLAS\atlas-client
rg -n 'G\{[^}]*grade|G\{g\}|`G\$\{|\bG7\b|\bG8\b|\bG9\b|\bG10\b' src/components/timetable src/hooks/useTimetableLookupHelpers.ts src/components/LockPanel.tsx src/components/ManualEditPanel.tsx
```

This command must not show user-visible compact `G{grade}` labels.

## Required proof points

The report must explicitly prove:

- Scenario 7 `Keyboard select-then-place` passes in `timetable-performance.spec.ts`.
- Scenarios 8–14 run after Scenario 7 and are not skipped because of Scenario 7 failure.
- Mobile-landscape More trigger is inside the visible viewport.
- The lost-scheduler spec does not merely log More overflow and pass.
- Simple mode still exposes blocker context, reason stack, mobile lifecycle action, tutorial, schedule switching, selected-class details, generated placement, generated swap, draft planning, and teacher-departure entry.
- No global scrollbar.
- No horizontal page overflow.
- No obsolete assignment modal language.
- No user-visible compact `G7/G8/G9/G10` labels.

## Evidence log

Append a concise verification entry to:

- `docs/verification/evidence-log.md`

Include:

- commit hash;
- school year/run ID tested;
- exact command results;
- artifact paths;
- remaining caveats;
- final `GO` / `NO-GO`.

## Acceptance criteria

- All local gates pass.
- All required Playwright gates pass.
- `timetable-performance.spec.ts` passes 42/42.
- Mobile-landscape More overflow is fixed and enforced by tests.
- GR label cleanup is complete or any remaining source matches are proven non-rendered.
- No generated `atlas-client/dist` artifacts are newly committed unless explicitly required by the repository.

## Report requirements

Return:

- final `GO` / `NO-GO`;
- prompt-by-prompt fix summary;
- command result table;
- performance matrix result;
- source guard result;
- artifact paths;
- remaining caveats;
- whether Codex QA can sign off the Simple timetable lost-scheduler sequence.
