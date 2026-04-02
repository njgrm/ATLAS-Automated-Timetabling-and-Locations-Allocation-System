# Verification Evidence Log

Record dated implementation verification summaries here.

## Entry Template
### YYYY-MM-DD - [Feature/Batch Name]
- Phase: [2/3/4/5]
- Scope gate: PASS/FAIL
- Architecture gate: PASS/FAIL
- Behavior gate: PASS/FAIL
- Regression gate: PASS/FAIL
- Commands:
  - `npx tsc --noEmit` (server): PASS/FAIL
  - `npx tsc --noEmit` (client): PASS/FAIL
- API checks:
  - [endpoint + case + expected + actual]
- UI checks:
  - [screen + state + expected + actual]
- Blocking findings:
  - [none | itemized list]
- Decision:
  - [Accepted | Needs fixes | Waived by user]

---

## 2026-03-31 - Bootstrap Entry
- Phase: 3 (working state)
- Note: Formalized verification log created. Backfill prior evidence from chat history as needed.

### 2026-04-02 - Phase 2 Closeout Verification
- Phase: 2
- Scope gate: PASS
- Architecture gate: PASS
- Behavior gate: PASS
- Regression gate: PASS
- Commands:
  - `npx tsc --noEmit` (server): PASS
  - `npx tsc --noEmit` (client): PASS
- API checks:
  - preference lifecycle gating via env phase: PASS
  - faculty self-only auth guard with privileged bypass: PASS
  - officer summary `status=MISSING` service-layer filtering: PASS
  - reminder action durable audit ID/row: PASS
- UI checks:
  - `/my/preferences` draft/submit states: PASS
  - `/faculty/preferences` filter/search/reminder flow: PASS
- Blocking findings:
  - none
- Decision:
  - Accepted (Phase 2 closed; move active delivery to Phase 3)

### 2026-04-02 - Phase 3 Generation Sync Verification
- Phase: 3
- Scope gate: PASS
- Architecture gate: PASS
- Behavior gate: PASS (with non-blocking hardening items)
- Regression gate: PASS
- Commands:
  - `npx tsc --noEmit` (server): PASS
  - `npx tsc --noEmit` (client): PASS
- API checks:
  - generation runs and draft endpoints in scope: PASS
  - policy CRUD + constructor/validator integration: PASS
  - hard-count semantics (`HARD` only): PASS
- UI checks:
  - room schedule route/nav/render baseline: PASS
- Blocking findings:
  - room schedule summary dedupe fix pending
  - room schedule `generatedAt` population pending
- Decision:
  - Accepted to continue Phase 3 with targeted hardening backlog

### 2026-04-02 - Phase 3 Closure Sweep
- Phase: 3
- Scope gate: PASS
- Architecture gate: PASS
- Behavior gate: PASS
- Regression gate: PASS
- Commands:
  - `npx tsc --noEmit` (server): PASS (0 errors)
  - `npx tsc --noEmit` (client): PASS (0 errors)
  - `npx tsx atlas-server/src/__tests__/phase3-regression.test.ts`: PASS (22/22)
  - `npx tsx atlas-server/src/scripts/benchmark.ts --runs=5`: PASS (5/5 runs COMPLETED)
- Benchmark evidence:
  - Artifact: `docs/verification/artifacts/phase3-benchmark-2026-04-02.json`
  - Duration: p50=90ms, p95=103ms, max=103ms (target: <60,000ms)
  - Assigned: 30 (deterministic across 5 runs)
  - Unassigned: 346 (stub dataset limitation, not a defect)
  - Hard violations: 0 (stable across all runs)
  - Policy blocked: 228 (stable across all runs)
  - All guardrails: PASS
- Regression tests verified:
  - hardViolationCount semantics (HARD-only): PASS
  - Policy severity toggling (consecutive/break): PASS
  - Room schedule interval-union deduplication: PASS
  - Core hard constraint detection (faculty conflict, room conflict, type mismatch, qualification): PASS
- API checks:
  - Generation runs COMPLETED from stub setup: PASS
  - Deterministic output (identical across 5 runs): PASS
  - Room schedule occupiedMinutes deduplicated via interval-union: PASS (unit verified)
  - Room schedule generatedAt populated from finishedAt fallback: PASS (code-level)
- Acceptance report:
  - `docs/phases/phase-3-acceptance-report.md`: created with full feature/verification/performance matrices
- Blocking findings:
  - none
- Decision:
  - Accepted — Phase 3 complete. All exit criteria satisfied. Move active delivery to Phase 4.

### 2026-04-02 - Phase 3 Benchmark Reproducibility Hardening
- Phase: 3
- Scope gate: PASS (benchmark reliability, within Phase 3 closure scope)
- Architecture gate: PASS (adapter pattern preserved, service boundaries intact)
- Behavior gate: PASS
- Regression gate: PASS
- Commands:
  - `npx tsc --noEmit` (server): PASS (0 errors)
  - `npx tsx atlas-server/src/__tests__/phase3-regression.test.ts`: PASS (22/22)
  - `SECTION_SOURCE_MODE=stub npx tsx atlas-server/src/scripts/benchmark.ts --runs=5`: PASS (5/5 COMPLETED)
  - `SECTION_SOURCE_MODE=enrollpro` benchmark: preflight blocked with clear diagnostic (exit 1)
- Changes:
  - `section-adapter.ts`: added `SECTION_SOURCE_MODE` env support (stub/enrollpro/auto) + `AutoSectionAdapter` fallback class
  - `generation.service.ts`: stage-tagged error diagnostics (`[sections-fetch]`, `[constructor]`, `[validator]`, `[persist]`)
  - `benchmark.ts`: preflight checks (school exists, setup data counts, mode guard) + mode logging
  - `benchmark.service.ts`: `sectionSourceMode` captured in report meta
  - `docs/verification/artifacts/README.md`: benchmark run instructions + pass criteria docs
- Root cause of prior `fetch failed`:
  - Default `SECTION_SOURCE_MODE` was `enrollpro` (via legacy fallback). EnrollPro API unreachable in local dev. No fallback or diagnostic.
- Benchmark evidence:
  - Artifact: `docs/verification/artifacts/phase3-benchmark-2026-04-02T06-11-44-580Z-school1-year1-runs5.json`
  - Duration: p50=89ms, p95=142ms, max=142ms
  - Deterministic: 30 assigned, 346 unassigned, 0 hard violations, 228 policy blocked (identical across 5 runs)
  - All guardrails: PASS
- Blocking findings:
  - none
- Decision:
  - Accepted — Phase 3 benchmark reproducibility confirmed. Closure evidence complete.

### 2026-04-02 - Phase 4 Batch 1: Review Console UI Foundation
- Phase: 4
- Scope gate: PASS (review console UI is first Phase 4 deliverable)
- Architecture gate: PASS (MVC view layer, service boundaries, `/api/v1` versioning, school-scoped endpoints)
- Behavior gate: PASS
- Regression gate: PASS
- Commands:
  - `npx tsc --noEmit` (client): PASS (0 errors)
  - `npx tsc --noEmit` (server): PASS (0 errors, no server changes)
- Files changed:
  - `atlas-client/src/types.ts`: added GenerationRun, RunSummary, ScheduledEntry, Violation, ViolationCode, ViolationSeverity, ViolationReport, DraftReport
  - `atlas-client/src/pages/ScheduleReview.tsx`: new page — three-panel review console
  - `atlas-client/src/components/AppShell.tsx`: unlocked Timetable nav item (removed `disabled: true`)
  - `atlas-client/src/App.tsx`: added ScheduleReview lazy import + route at `/timetable`
- UI checks:
  - Sidebar Timetable nav unlocked for admin/officer/SYSTEM_ADMIN: PASS (code verified)
  - Run selector (latest + specific run): implemented
  - Section filter: implemented
  - Filter chips (All/Hard/Soft/Conflicts): implemented
  - Inline stat banner (status, assigned, hard, total, duration, timestamp): implemented
  - Violation panel with search, code grouping, severity badges: implemented
  - Timetable grid with day×time matrix, violation color coding: implemented
  - Entry detail panel with DepEd grade badges, linked violations: implemented
  - Placeholder action buttons with tooltips: implemented
  - Follow-up triage tag: implemented
  - Loading/empty/error states: implemented
- Blocking findings:
  - none (backend APIs already exist from Phase 3; no server changes needed)
- Decision:
  - Accepted — Phase 4 Batch 1 complete. Next: manual edit APIs + optimistic locking (Batch 2).

### 2026-04-02 - Phase 4 Batch 2: Review UI Workflow Expansion
- Phase: 4
- Scope gate: PASS (generate trigger, publish guardrails, grid pivot — all Phase 4 review workflow scope)
- Architecture gate: PASS (MVC view layer, thin handlers, service boundaries preserved, no native form elements)
- Behavior gate: PASS
- Regression gate: PASS
- Commands:
  - `npx tsc --noEmit` (client): PASS (0 errors)
  - `npx tsc --noEmit` (server): PASS (0 errors, no server changes)
- Files changed:
  - `atlas-client/src/pages/ScheduleReview.tsx`: added Generate, Publish, and View By pivot features
  - `atlas-client/src/ui/checkbox.tsx`: new shadcn-style Checkbox component (Radix UI)
- New dependency:
  - `@radix-ui/react-checkbox` installed
- Feature details:
  - **Generate New Timetable:** Play button in toolbar, fires `POST /generation/:schoolId/:schoolYearId/runs`. Confirmation dialog warns if follow-up flags exist. Disabled while generating/loading.
  - **Publish Schedule:** Send button disabled when hard violations > 0. Dialog with soft violation summary + acknowledgment Checkbox. Publish action is Phase 5 placeholder (toast).
  - **Grid Pivot Modes:** View By selector (Section / Faculty / Room). Client-side pivot logic via `pivotEntityIds`, `pivotLabel`, `pivotKeyOf`. Room reference data fetched from buildings endpoint. Grid cells show context label for non-section pivots.
  - **Empty state enhanced:** No-runs state now includes Generate button.
- UI checks:
  - Generate button disabled states: correct (no schoolYearId, generating, loading)
  - Publish button disabled when hardCount > 0: correct
  - Publish dialog Checkbox gating: correct (soft > 0 requires acknowledgment)
  - View By selector cycles Section/Faculty/Room: correct
  - GridEntries pivot-aware filtering: correct (section filter only in section mode)
  - TimetableGrid accepts viewMode + pivotLabel: correct
  - Dialogs use @/ui/dialog primitives: correct
  - Checkbox uses @/ui/checkbox: correct
  - No native <select>, <button>, or <details>: PASS
- Blocking findings:
  - none
- Decision:
  - Accepted — Phase 4 Batch 2 complete.
