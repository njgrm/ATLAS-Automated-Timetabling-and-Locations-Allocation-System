# Copilot Execution Prompt: Phase 2 Template + Subject Tailnet Repair Loop

Run this after:
- `docs/prompts/phase2-template-subject-contract-reset-prompt.md`

Do not run this as a broad refactor. This is a narrow runtime-repair pass driven by verified live Tailnet failures.

## Goal
Repair the live Tailnet subject/template/runtime mismatches left behind by the prior template-subject reset pass, then prove the repaired behavior on the live ATLAS Tailnet surface before claiming success.

This prompt is not complete when local build passes. It is only complete when the live runtime evidence matches the intended contract or the agent returns a precise `NO-GO`.

## Scope

In scope:
- live subject inventory parity
- live class-template parity
- EnrollPro-driven TLE activation/materialization parity
- SPS/SPA/STE template-subject binding parity
- latest generation runtime verification
- Tailnet API/runtime proof for the scheduling surfaces affected by this pass

Out of scope:
- broad policy/window UX work
- final Phase 2 closure claim
- unrelated publish/faculty/student UX work

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase2-template-subject-contract-reset-prompt.md`
- `ATLAS-PUBLIC-API.md`
- `prisma/seed.js`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject-program-scope.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/generation.service.ts`
- `EnrollPro/docs/features/integration/ENROLLPRO-API.md`

## Live Failures To Treat As Fact
These were manually verified on the live ATLAS Tailnet environment on `2026-05-17`.

### 1. Subject inventory is only partially reset
Live `GET /api/v1/subjects?schoolId=1` still shows:
- `SCI_PHYS` active
- legacy `SCI` inactive
- legacy `RESEARCH_I..IV` inactive
- no active exploratory TLE rows such as:
  - `TLE_ICT_EXP`
  - `TLE_AFA_EXP`
  - `TLE_FCS_EXP`
  - `TLE_IA_EXP`

### 2. Live templates do not match the intended contract
Live `GET /api/v1/class-templates?schoolId=1` shows:
- `REGULAR` template only binds `SCI_BIO`, `SCI_CHEM`, `SCI_ES`
- `STE` template does not include the claimed grade-specific STE overlay set
- `SPS` template has no SPS-specific subject row
- `SPA` template has `SPA_SPEC`, but parity still needs runtime proof

### 3. Runtime generation is still in a broken state
Live `GET /api/v1/generation/1/55/runs/latest` currently shows:
- `run.id = 38`
- `homeRoomSuccessRate = 24.3`
- `assignedCount = 939`
- `unassignedCount = 1937`
- `hardViolationCount = 811`
- `SPECIALIZED_ROOM_UNAVAILABLE = 1126`
- `termCounts = { term1: 939, term2: 0, term3: 0 }`

This prompt is not responsible for solving every KPI issue, but it must not ignore subject/template/runtime mismatches that are clearly contributing to bad generation state.

### 4. Timetable API verification gap exists
Live `GET /api/v1/generation/1/55/runs/latest/timetable` returned `404 Cannot GET ...` despite being documented in `ATLAS-PUBLIC-API.md`.

You must determine whether:
- the route is broken,
- the route path changed without docs update,
- or the live deployment is serving stale/incorrect routing.

Do not ignore this. It blocks runtime verification.

### 5. Grade 9 building is not the root problem
Live `GET /api/v1/sections/summary/55?schoolId=1` shows valid Grade 9 sections with:
- `buildingZoneId = G9`
- valid `homeRoomId`

Therefore do not spend this pass "fixing missing Grade 9 buildings." The pressure is downstream from generation compatibility, subject/template alignment, or slot feasibility.

## Mandatory Behavior: Repair Loop, Not One Shot
You must behave as a repair loop.

Required execution pattern:
1. Audit live state first.
2. Compare live state to the intended contract.
3. Implement the minimum code/data fixes required.
4. Run local verification.
5. Run live Tailnet verification.
6. If live findings still show a concrete local bug or contract mismatch introduced or left unresolved by this pass:
   - fix it immediately if it is local and low-risk,
   - rerun the relevant verification,
   - update evidence with what was discovered and repaired.
7. Only stop when:
   - the scoped runtime mismatches are genuinely fixed and proven, or
   - a clear external blocker remains and you return `NO-GO`.

Do not stop after the first local green build.
Do not stop after writing an evidence note.
Do not claim success if live Tailnet still contradicts the intended contract.

## Incidental Error Recovery Rule
If you discover a concrete compile error, contract mismatch, stale API docs drift, routing bug, or adjacent regression while executing this prompt:
- fix it in the same pass when the fix is local and low-risk,
- explicitly log it in evidence as:
  - `discovered out-of-scope issue`
  - `why it blocked verification or runtime parity`
  - `how it was fixed`
  - `what verification was rerun`

If it is too large or risky to absorb safely:
- stop and return `NO-GO`
- list the blocker with file references and exact failed verification step

## Required Direction

### A. Restore live subject inventory parity
- Ensure live active subject rows reflect the intended Phase 2 contract.
- Do not leave `SCI_PHYS` silently active as part of the regular tri-sem runtime unless you intentionally preserve it and explain exactly why.
- If regular science is truly 3-slice in the current contract, the live active inventory and templates must reflect that consistently.
- If exploratory TLE rows are part of the intended contract, they must be present and activatable in live runtime data, not just implied in code comments or prompt text.

### B. Restore live class-template parity
- `REGULAR`, `STE`, `SPA`, and `SPS` templates must each bind to a coherent live subject bundle.
- `SPS` must not remain a regular-only bundle with no SPS-specific subject.
- `STE` must not stop at vague research-only parity if the intended contract includes grade-specific STE overlays.
- If the current schema cannot express the full target contract cleanly, return `NO-GO` and name the exact schema limitation.

### C. Verify EnrollPro-driven TLE materialization actually works
- Confirm the live EnrollPro-driven section feed and TLE catalog produce the expected ATLAS subject activation/materialization behavior.
- If the logic only exists in code but is not being triggered in the live generation lifecycle, fix that.
- Prove whether grades, program scopes, and specialization ownership are being interpreted correctly from live upstream data.

### D. Resolve or explain the timetable API gap
- Verify the intended latest-timetable route from live Tailnet.
- If the documented route is wrong, fix the docs and verify the real route.
- If the code route is wrong or missing, fix it and verify the live route.
- Do not leave runtime verification blocked by a silent docs-vs-route mismatch.

### E. Re-test live generation after the repair
- Trigger or verify a fresh relevant generation run after the subject/template repair.
- Capture the latest run summary.
- Compare it to the prior known-bad baseline.
- You are not required to fully close Phase 2 KPI here, but you must show whether the subject/template repair improved or corrected the specific scoped mismatches.

## Tailnet QA Requirements
Primary environment:
- `https://njgrm.buru-degree.ts.net`

ATLAS login:
- `identifier = 1000001`
- `password = AdminSY2026!`

Minimum live checks:
1. `POST /api/v1/auth/login`
2. `GET /api/v1/subjects?schoolId=1`
3. `GET /api/v1/class-templates?schoolId=1`
4. `GET /api/v1/sections/summary/55?schoolId=1`
5. `GET /api/v1/generation/1/55/runs/latest`
6. `GET` the latest timetable route that is supposed to exist
7. if needed, trigger a fresh generation pass and re-check the above

You must include exact endpoint results in your final report, not just "manual QA passed."

## Verification Gates
- touched server build/typecheck
- touched client build/typecheck if client/API contract changed
- diagnostics for touched files
- live Tailnet API verification for all required endpoints above
- explicit before/after comparison for:
  - subject activation set
  - template bundles
  - latest generation summary
  - timetable route availability

## Evidence Update
Append a narrow evidence entry that records:
- exact files changed
- exact commands run
- exact live endpoints checked
- exact before/after runtime differences
- any discovered out-of-scope issue fixed during the pass
- whether a second repair iteration was needed
- final `GO` or `NO-GO`

## GO / NO-GO
Return `GO` only if all of the following are true:
- live subject inventory now matches the intended scoped contract
- live class templates now match the intended scoped contract
- EnrollPro-driven TLE materialization/activation is proven on live runtime or correctly proven unnecessary for the current live data
- the timetable verification route is working or the docs/runtime mismatch is explicitly fixed and verified
- the final report includes live endpoint evidence, not just local build results

Return `NO-GO` if any of the following remain true:
- `SCI_PHYS` / TLE / SPS / STE template parity is still inconsistent in live runtime
- the live timetable verification route is still unresolved
- the agent did not perform live Tailnet verification
- the runtime still contradicts the claimed repair
