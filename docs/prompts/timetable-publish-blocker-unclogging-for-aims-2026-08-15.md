# Prompt — Timetable Publish Blocker Unclogging for AIMS Validation

## Role

You are the ATLAS timetable publish-readiness executor. Your task is to clear the current live hard blockers enough to produce and publish a valid `2026-2027` timetable run so AIMS can test its downstream connection to ATLAS published schedule endpoints.

Do not weaken publish rules. Do not mark hard violations as soft just to publish. Do not bypass the existing publish guard. AIMS validation must use a legitimately published ATLAS run.

## Live target

Use the Tailnet environment:

```text
https://njgrm.buru-degree.ts.net
```

Use scheduler/admin login:

```text
1000001 / AdminSY2026!
```

## Current live evidence captured by Codex on 2026-08-15

Runtime:

- Active school year: `5`
- Active school year label: `2026-2027`
- Runtime drift: `aligned`
- Latest completed run: `424`
- Latest run status: `COMPLETED`

Latest run summary:

- Assigned entries: `780`
- Unassigned sessions: `145`
- Hard violations: `145`
- Soft warnings: `278`
- Publish attempt result: `PUBLISH_BLOCKED_HARD_VIOLATIONS`

All hard violations are currently `UNASSIGNED_SECTION`.

Unassigned root reasons:

| Reason | Count |
|---|---:|
| `FACULTY_OVERLOADED` | `75` |
| `NO_QUALIFIED_FACULTY` | `40` |
| `NO_AVAILABLE_SLOT` | `30` |

Top subject blockers:

| Subject ID | Subject | Count | Reasons |
|---:|---|---:|---|
| `6` | `MAPEH — MAPEH` | `40` | `NO_QUALIFIED_FACULTY:40` |
| `3079` | `DEVL_READING — Developmental Reading` | `30` | `FACULTY_OVERLOADED:15`, `NO_AVAILABLE_SLOT:15` |
| `3` | `MATH — Mathematics` | `20` | `FACULTY_OVERLOADED:20` |
| `7` | `ESP — ESP/GMRC` | `20` | `FACULTY_OVERLOADED:20` |
| `5754` | `SPS_SPEC — Special Program in Sports: Specialization` | `20` | `FACULTY_OVERLOADED:20` |
| `5746` | `STE_ENV_SCI — Environmental Science` | `5` | `NO_AVAILABLE_SLOT:5` |
| `5747` | `STE_BIOTECH — Biotechnology` | `5` | `NO_AVAILABLE_SLOT:5` |
| `11796` | `STE_ROBOTICS — Robotics` | `5` | `NO_AVAILABLE_SLOT:5` |

Top affected sections:

| Section ID | Grade | Count | Reasons |
|---:|---:|---:|---|
| `118` | `10` | `25` | `FACULTY_OVERLOADED:20`, `NO_QUALIFIED_FACULTY:5` |
| `113` | `9` | `20` | `FACULTY_OVERLOADED:20` |
| `108` | `8` | `15` | `FACULTY_OVERLOADED:15` |
| `112` | `9` | `15` | `FACULTY_OVERLOADED:10`, `NO_QUALIFIED_FACULTY:5` |
| `103` | `7` | `10` | `FACULTY_OVERLOADED:5`, `NO_AVAILABLE_SLOT:5` |
| `111` | `9` | `10` | `FACULTY_OVERLOADED:5`, `NO_QUALIFIED_FACULTY:5` |
| `117` | `10` | `10` | `NO_AVAILABLE_SLOT:5`, `NO_QUALIFIED_FACULTY:5` |

Teaching Load state:

- Coverage pairs: `257 / 265`
- Unassigned Teaching Load pairs: `8`
- Empty-section assignment rows: `13`
- Stale ownership rows: `0`
- Quarantined zombie rows: `3`
- Several faculty are over cap at about `42.5 / 30h` (`142%`), including MATH, ESP, ENG/Developmental Reading, MAPEH, SCI, TLE/Special Program lanes.

Fix-suggestion probes show:

- `FACULTY_OVERLOADED` items have candidate faculty suggestions, but current qualified teachers are at or above cap.
- `NO_QUALIFIED_FACULTY` MAPEH items have candidate teachers at other grade levels, meaning the issue is likely Teaching Load scope/coverage rather than absent roster data.
- `NO_AVAILABLE_SLOT` items recommend next-best slot or policy review, but these should be handled after Teaching Load overload/no-qualified lanes are corrected.

Quick-place preview caveat:

- `POST /api/v1/generation/1/5/runs/424/quick-place/preview` did not return within 60 seconds during Codex’s read-only probe.
- Do not depend on bulk quick-place until it has bounded timing or the blocker set has been reduced.

## Objective

Clear the hard blocker count from `145` to `0`, generate a new completed run, and publish it for AIMS validation.

The final published run may still contain soft warnings only if:

- the publish endpoint accepts `acknowledgeSoftViolations=true`;
- the UI/API clearly reports those soft warnings;
- the run has `0` hard violations.

## Scope

### In scope

- Read-only diagnosis of the latest run, violations, Teaching Load, policy, grade windows, section setup, room setup, and subject coverage.
- Teaching Load coverage repair for the specific blocker lanes.
- Rebalancing overloaded faculty assignments through existing ATLAS Teaching Load flows.
- Removing empty-section assignment rows if they are causing false qualification/coverage.
- Fixing MAPEH grade/section Teaching Load scope so the generator does not report `NO_QUALIFIED_FACULTY`.
- Fixing Developmental Reading, MATH, ESP, SPS specialization, and STE special-subject lanes enough to remove unassigned sessions.
- Rerunning generation after setup/Teaching Load corrections.
- Publishing only after the publish guard confirms zero hard violations.
- Verifying AIMS-facing published schedule endpoints return a non-empty current published schedule.

### Out of scope

- Bypassing publish hard-violation rules.
- Downgrading `UNASSIGNED_SECTION` hard violations to soft warnings just to publish.
- Deleting live EnrollPro data.
- Writing back to EnrollPro, SMART, or AIMS.
- Large timetable UI redesign.
- Workbook/class-program export implementation.
- Policy relaxation that changes school behavior without explicit evidence and documentation.

## Required execution sequence

### Phase 0 — Lock baseline

Run read-only probes and save the outputs in the final report:

```http
GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true
GET /api/v1/generation/1/5/runs/latest
GET /api/v1/generation/1/5/runs/latest/violations
GET /api/v1/generation/1/5/runs/latest/draft
GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=5&pageSize=200
POST /api/v1/generation/1/5/runs/424/publish
```

Expected baseline: publish returns `PUBLISH_BLOCKED_HARD_VIOLATIONS`.

Do not proceed unless your baseline agrees that the current blocker set is `UNASSIGNED_SECTION` with the three reasons above, or you explicitly report the changed live state.

### Phase 1 — Diagnose Teaching Load truth before touching the timetable

For each blocker subject, determine:

- current subject metadata;
- grade/program scope;
- saved Teaching Load owners;
- empty-section assignment rows;
- overloaded owners;
- candidate replacement teachers;
- whether candidate teachers are active and non-stale;
- whether the subject is a normal year-long subject, modular subject, special-program subject, or term/rotation subject.

Priority diagnosis order:

1. `MAPEH — MAPEH` (`subjectId=6`, `40` no-qualified sessions).
2. `DEVL_READING — Developmental Reading` (`subjectId=3079`, `30` sessions).
3. `MATH — Mathematics` (`subjectId=3`, `20` sessions).
4. `ESP — ESP/GMRC` (`subjectId=7`, `20` sessions).
5. `SPS_SPEC — Special Program in Sports: Specialization` (`subjectId=5754`, `20` sessions).
6. STE special subjects: `5746`, `5747`, `11796`.

Output a table: subject, affected sections, current owner(s), owner load, candidate owner(s), proposed correction.

### Phase 2 — Repair Teaching Load in reviewed, reversible steps

Use existing Teaching Load endpoints and flows. Prefer proposal/preview/review paths over direct writes.

Required behavior:

- Every write must have before/after counts.
- Every write must be attributable to this AIMS validation closure.
- Do not assign to inactive or stale faculty.
- Do not create Teacher X placeholders unless there is no real active candidate and the user explicitly approves.
- Do not silently increase teacher max hours just to remove overload.
- If a policy relaxation is truly required, document the exact policy field, current value, proposed value, and why it matches school scheduling practice.

Repair order:

1. Resolve `MAPEH` no-qualified coverage.
2. Rebalance the over-cap lanes.
3. Resolve empty-section assignment rows if they are corrupting coverage truth.
4. Re-run Teaching Load summary and confirm:
   - no blocker-relevant missing ownership;
   - no stale ownership;
   - no lock/reconcile state;
   - load warnings are either resolved or intentionally soft.

### Phase 3 — Generate and compare

Trigger a new generation run after Teaching Load/setup repairs.

Use:

```http
POST /api/v1/generation/1/5/runs
```

Then compare latest run against run `424`:

- assigned count;
- unassigned count;
- hard violation count;
- soft warning count;
- blocker reasons;
- by-subject and by-section residuals.

Gate:

- If hard violations remain, do not publish.
- Diagnose residuals and repeat repair/generate until hard violations are `0`, or report exact blockers that need user decision.

### Phase 4 — Publish for AIMS validation

Only after a completed run has `0` hard violations:

```http
POST /api/v1/generation/1/5/runs/:runId/publish
```

Use `acknowledgeSoftViolations=true` only if the endpoint first reports soft-warning acknowledgement is required.

After publish, verify:

```http
GET /api/v1/schools/1/schedules/published
GET /api/v1/generation/1/5/runs/:runId
```

Also verify at least one section/faculty/public schedule route expected by AIMS returns non-empty published schedule data. If the exact AIMS endpoint contract is in the repo, use that. If not, report the exact published endpoint payloads AIMS should consume.

### Phase 5 — Browser smoke

On `https://njgrm.buru-degree.ts.net/timetable`, verify:

- Simple mode shows the latest generated/published run.
- Publish state is visible.
- No hard blocker banner remains.
- Soft warnings, if present, are readable and non-technical.
- Published schedule is visibly distinguishable from draft/generated state.

## Required code/test gates

Run if source code changes:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run browser/API smoke after generation/publish work:

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
```

If these specs are stale because the UI has moved, fix the specs only when the product behavior is already proven correct and explain the selector drift.

## Acceptance criteria

This prompt is complete only when all are true:

- Runtime is aligned for active SY `2026-2027`.
- Latest generated run has `0` hard violations.
- Publish endpoint succeeds without bypassing guards.
- Public/AIMS-facing published schedule endpoint returns current non-empty schedule data.
- Teaching Load repairs are documented with before/after counts.
- No active/stale faculty mismatch is introduced.
- No hard violation is reclassified as soft only for AIMS testing.
- Soft warnings, if any, are acknowledged through the existing publish contract.
- Evidence log is updated.

## Final report format

Return:

1. GO / NO-GO.
2. Exact baseline endpoint outputs.
3. Root-cause table by blocker subject.
4. Files changed, if any.
5. Teaching Load repairs applied.
6. New generation run ID and before/after metrics.
7. Publish endpoint result.
8. AIMS-facing endpoint proof.
9. Browser smoke result.
10. Remaining blockers, if NO-GO, with exact user decision needed.
