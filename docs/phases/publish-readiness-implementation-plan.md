# Publish Readiness Implementation Plan

> **Status:** Active  
> **Phase Scope:** Phase 4 → Phase 5 bridge  
> **Goal:** Drive the ATLAS scheduling workflow from seeded data through schedule generation, constraint review, and final publish — producing a live published schedule accessible via the public API.

---

## 0. Prerequisites (Completed)

| Item | Status | Notes |
|------|--------|-------|
| Compilation blockers cleared | ✅ | Audit.tsx, OfficerPreferences.tsx, SpecializationMapping.tsx all fixed |
| DB seed | ✅ | 27 subjects, 5 buildings, 32 rooms, 20 faculty, 16 aliases, 2 auth accounts |
| Specialization aliases | ✅ | 16 correct canonical mappings seeded (Values→ESP, etc.) |
| Faculty auth infrastructure | ✅ | Delegated ATLAS login, JWT token identity, protected routes working |
| Admin credentials (post-seed) | ✅ | `admin@deped.edu.ph / AdminSY2026!` |
| Faculty credentials | ✅ | `maria.santos@deped.edu.ph / DepEd2026!` |

---

## 1. Environment Setup

### 1.1 Start the Server in Stub Mode

When EnrollPro is not available, set `SECTION_SOURCE_MODE=stub` so the section adapter returns the 10 built-in stub sections (Grades 7–10, including STE/SPS/SPA programs) instead of calling the EnrollPro API.

```powershell
# atlas-server/.env or inline override
SECTION_SOURCE_MODE=stub

# Start server
npm --prefix atlas-server run dev

# Start client
npm --prefix atlas-client run dev
```

Alternatively, if EnrollPro is running at `http://localhost:5000`, leave `SECTION_SOURCE_MODE` unset (defaults to `auto`, which tries EnrollPro and falls back to cached snapshot).

### 1.2 Confirm Active School Year ID

The `schoolYearId` in ATLAS is an external reference integer sourced from EnrollPro. In stub mode or dev operation, use `schoolYearId = 1` for all generation and publish API calls.

To confirm the active school year when EnrollPro is available:
```powershell
# GET EnrollPro active school year
Invoke-RestMethod -Uri "http://localhost:5000/api/integration/v1/school-year" -Headers @{ Authorization = "Bearer $ENROLLPRO_SERVICE_TOKEN" }
```

**Dev default:** `schoolId = 1`, `schoolYearId = 1`

---

## 2. Pre-Generation Data Checks

Before triggering generation, verify all prerequisites are met.

### 2.1 Faculty Subject Assignments

At least some faculty must have active subject assignments. Check via the ATLAS dashboard setup checklist or:
```powershell
$token = (Invoke-RestMethod -Uri "http://localhost:5001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@deped.edu.ph","password":"AdminSY2026!"}').token
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/faculty-assignments/1" -Headers @{ Authorization = "Bearer $token" }
```

### 2.2 Faculty Preferences (Optional but Recommended)

Generation runs without preferences (ignores constraint if no preferences exist). For better schedule quality, preferences should be submitted. Use the OfficerPreferences page **Dev: Submit All Drafts** button to bulk-convert draft preferences to submitted.

Or via API:
```powershell
# GET preference summary
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/preferences/1/1/summary" -Headers @{ Authorization = "Bearer $token" }
```

### 2.3 Room Preference Gate Check

The generation endpoint will be blocked if any **submitted, pending-decision** room preference requests exist. Check and resolve before generating:

```powershell
# GET gate status
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs/gate" -Headers @{ Authorization = "Bearer $token" }
# { blocked: false } = clear to generate
# { blocked: true, openCount: N } = resolve N room requests first
```

To bypass the gate (for dev/testing), pass `ignoreRoomRequestGate: true` in the generate body (step 3).

---

## 3. Trigger Schedule Generation

```powershell
# Authenticate (save token for subsequent calls)
$body = '{"email":"admin@deped.edu.ph","password":"AdminSY2026!"}'
$resp = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
$token = $resp.token

# Trigger generation (with gate bypass for dev)
$genBody = '{"ignoreRoomRequestGate": true}'
$run = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $genBody
Write-Host "Run ID:" $run.run.id
Write-Host "Status:" $run.run.status
```

The run executes synchronously within the request. On success, the run will have `status: "COMPLETED"`.

Generation summary fields to check:
- `run.summary.assignedCount` — number of successfully placed sessions
- `run.summary.unassignedCount` — sessions that could not be placed
- `run.summary.hardViolationCount` — **must be 0 to publish**
- `run.summary.policyBlockedCount` — sessions blocked by daily load policy

---

## 4. Review Hard Constraint Violations

If `hardViolationCount > 0`, the run **cannot be published** until violations are resolved.

```powershell
# GET violations for the run
$runId = $run.run.id
$detail = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs/$runId" -Headers @{ Authorization = "Bearer $token" }
$detail.violations | Where-Object { $_.severity -eq "HARD" } | Format-Table
```

### Common Hard Violation Codes

| Code | Meaning | Resolution |
|------|---------|-----------|
| `FACULTY_DOUBLE_BOOKING` | Faculty assigned two sessions at the same time | Manual edit: move one session to a different slot |
| `ROOM_DOUBLE_BOOKING` | Two sessions in the same room at the same time | Manual edit: reassign a room |
| `SECTION_DOUBLE_BOOKING` | Section assigned two sessions simultaneously | Manual edit: move one session |
| `FACULTY_OVER_MAX_HOURS` | Faculty exceeds `maxHoursPerWeek` | Check faculty max hours or reassign a session |

### Resolution Options

**Option A — Manual Edit (preferred for real data):**
1. Open `/timetable` in the browser
2. Find the conflicting slot in the review grid
3. Drag-and-drop or use the edit panel to move the offending session
4. Revalidate from the UI

**Option B — Relax Scheduling Policy (for dev stub testing):**  
Adjust policy to increase `maxTeachingMinutesPerDay` or disable specific hard constraint codes via the scheduling policy settings, then regenerate.

**Option C — Re-trigger with fresh generation:**
```powershell
# Re-trigger (new run replaces old active run)
$run2 = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $genBody
```

---

## 5. Publish the Schedule

Once `hardViolationCount === 0`:

```powershell
# Publish the run
$runId = $run.run.id   # or $run2.run.id if re-triggered
$published = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs/$runId/publish" -Method POST -Headers @{ Authorization = "Bearer $token" }
Write-Host "Published at:" $published.run.summary.publishedAt
Write-Host "Published by actor:" $published.run.publishedBy
```

The server will:
1. Verify run status is `COMPLETED`
2. Verify `summary.hardViolationCount === 0` (returns `422 PUBLISH_BLOCKED_HARD_VIOLATIONS` if not)
3. Set `summary.isPublished = true`, `summary.publishedAt`, `summary.publishedBy`
4. Write an `GENERATION_RUN_PUBLISHED` audit log entry

---

## 6. Verify Published Schedule

### 6.1 Public Payload API

```powershell
# No auth required — public endpoint
$schedule = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/schools/1/schedules/published"
Write-Host "Run ID:" $schedule.source.runId
Write-Host "Published at:" $schedule.source.publishedAt
Write-Host "Entry count:" $schedule.entries.Count
```

### 6.2 Section-Scoped View

```powershell
# Published schedule for section ID 1 (7-Rizal in stub mode)
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/schools/1/schedules/published/sections/1"
```

### 6.3 Faculty-Scoped View

```powershell
# Published schedule for a specific faculty (facultyId from DB)
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/schools/1/schedules/published/faculty/1"
```

### 6.4 UI Smoke Check

Open in browser:
- `/timetable` — should show the published run with the Published badge
- `/audit` — should reflect the published state

---

## 7. Remaining Phase 5 Deliverables

These items are **not blocking publish** but are required for Phase 5 completion:

| Deliverable | Route | Status | Priority |
|-------------|-------|--------|---------|
| Faculty dashboard | `/my/dashboard` | Not started | High |
| Faculty personal schedule | `/my/schedule` | Not started | High |
| Faculty assignment view | `/my/assignments` | Not started | Medium |
| Public section schedule page | `/s/:schoolSlug/section/:id` | Not started | Medium |
| Push notification on publish | (server event) | Not started | Medium |
| PWA service worker baseline | (client sw.js) | Not started | Medium |

---

## 8. Known Risks and Blockers

### Risk 1: Unassigned Sessions (policyBlockedCount > 0)

With stub data (10 sections, 20 faculty, 27 subjects), there may be subjects with no qualified faculty assigned. The constructor will leave these unassigned.

**Detection:** Check `run.summary.unassignedCount` and `run.summary.resourceDiagnostics.unassignedBySubjectGrade`.

**Resolution:** Add faculty-subject assignments for uncovered subjects via `/subjects` UI, then regenerate.

### Risk 2: Faculty Over Max Hours

If `maxHoursPerWeek` for a faculty member is too low for the assigned sections, sessions will be policy-blocked.

**Detection:** `run.summary.policyBlockedCount > 0`, or `FACULTY_OVER_MAX_HOURS` hard violations.

**Resolution:** Update faculty `maxHoursPerWeek` or redistribute assignments.

### Risk 3: Section Source Mode Mismatch

If `SECTION_SOURCE_MODE` is not set to `stub` and EnrollPro is unavailable, generation will fail at the `sections-fetch` stage.

**Detection:** Run status `FAILED` with `error: "[sections-fetch] UPSTREAM_UNAVAILABLE..."`.

**Resolution:** Set `SECTION_SOURCE_MODE=stub` in `atlas-server/.env` and restart.

---

## 9. Quick Command Reference

```powershell
# Full test sequence
# 1. Get token
$body = '{"email":"admin@deped.edu.ph","password":"AdminSY2026!"}'
$token = (Invoke-RestMethod -Uri "http://localhost:5001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body).token

# 2. Check gate
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs/gate" -Headers @{ Authorization = "Bearer $token" }

# 3. Generate
$run = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body '{"ignoreRoomRequestGate":true}'
$runId = $run.run.id
Write-Host "hardViolationCount:" $run.run.summary.hardViolationCount

# 4. Publish (only if hardViolationCount = 0)
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/generation/1/1/runs/$runId/publish" -Method POST -Headers @{ Authorization = "Bearer $token" }

# 5. Verify
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/schools/1/schedules/published"
```

---

## 10. Acceptance Criteria

| Criterion | Pass Condition |
|-----------|---------------|
| Generation completes | Run status = `COMPLETED` |
| Zero hard violations | `summary.hardViolationCount = 0` |
| Publish succeeds | `summary.isPublished = true`, `publishedAt` set |
| Public endpoint returns data | GET `/api/v1/schools/1/schedules/published` → 200 with entries |
| Section view works | GET `.../published/sections/1` → 200 with schedule entries |
| Faculty view works | GET `.../published/faculty/1` → 200 with schedule entries |
| Audit log written | `GENERATION_RUN_PUBLISHED` event in audit_logs |

---

*Created during Phase 4 → Phase 5 transition. See `phasePlan.md` for overall phase tracking and `docs/verification/phase-gates.md` for gate evidence requirements.*
