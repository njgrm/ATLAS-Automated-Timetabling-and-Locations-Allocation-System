# EnrollPro REST API Reference

This file documents the currently mounted EnrollPro backend API surface from the server router map.

## Runtime Endpoints

- Main API base (Tailnet): `http://100.120.169.123:5000/api`
- Integration API base (Tailnet): `http://100.120.169.123:5000/api/integration/v1`
- Local base: `http://localhost:5000/api`

## Auth Model

- Protected endpoints require `Authorization: Bearer <jwt>`.
- JWT is issued by `POST /api/auth/login`.
- Role checks are enforced per route (`REGISTRAR`, `SYSTEM_ADMIN`, `TEACHER`).

## Response Conventions

- Success responses are JSON unless noted (CSV export endpoints).
- Most validation/business failures return `{ "message": "..." }`.
- Integration endpoints may return envelope-style errors:
  - `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`

---

## 1) Platform Health

### `GET /api/health`

- Auth: None
- Expected response: `200 OK`

```json
{ "ok": true }
```

---

## 2) Authentication (`/api/auth`)

| Method | Path                        | Auth     | Expected response            |
| ------ | --------------------------- | -------- | ---------------------------- |
| POST   | `/api/auth/login`           | None     | `200` with `{ token, user }` |
| GET    | `/api/auth/me`              | Required | `200` with `{ user }`        |
| PATCH  | `/api/auth/change-password` | Required | `200` with `{ token, user }` |

### Sample success (`POST /api/auth/login`)

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "firstName": "SYSTEM",
    "lastName": "ADMINISTRATOR",
    "email": "admin@example.com",
    "role": "SYSTEM_ADMIN",
    "mustChangePassword": false
  }
}
```

---

## 3) Settings (`/api/settings`)

| Method | Path                       | Auth         | Expected response                                        |
| ------ | -------------------------- | ------------ | -------------------------------------------------------- |
| GET    | `/api/settings/public`     | None         | `200` school branding + active school-year snapshot      |
| GET    | `/api/settings/scp-config` | None         | `200` with `{ scpProgramConfigs: [...] }`                |
| PUT    | `/api/settings/identity`   | SYSTEM_ADMIN | `200` updated `SchoolSetting` object                     |
| POST   | `/api/settings/logo`       | SYSTEM_ADMIN | `200` with `{ logoUrl, colorScheme, selectedAccentHsl }` |
| DELETE | `/api/settings/logo`       | SYSTEM_ADMIN | `200` with logo/accent reset values                      |
| PUT    | `/api/settings/accent`     | SYSTEM_ADMIN | `200` with `{ selectedAccentHsl, colorScheme }`          |

### Sample success (`GET /api/settings/public`)

```json
{
  "schoolName": "EnrollPro Integrated School",
  "logoUrl": "/uploads/logo-abc.webp",
  "colorScheme": { "palette": [] },
  "selectedAccentHsl": "221 83% 53%",
  "activeSchoolYearId": 12,
  "activeSchoolYearLabel": "2026-2027",
  "enrollmentPhase": "OPEN"
}
```

---

## 4) Dashboard (`/api/dashboard`)

| Method | Path                   | Auth                             | Expected response             |
| ------ | ---------------------- | -------------------------------- | ----------------------------- |
| GET    | `/api/dashboard/stats` | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` with `{ stats: {...} }` |

### Sample success

```json
{
  "stats": {
    "totalPending": 10,
    "totalEnrolled": 220,
    "totalPreRegistered": 45,
    "sectionsAtCapacity": 2,
    "earlyRegistration": {
      "submitted": 40,
      "verified": 35,
      "inPipeline": 12,
      "total": 90
    }
  }
}
```

---

## 5) School Years (`/api/school-years`)

| Method | Path                              | Auth                             | Expected response                               |
| ------ | --------------------------------- | -------------------------------- | ----------------------------------------------- |
| GET    | `/api/school-years`               | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` with `{ years: [...] }`                   |
| GET    | `/api/school-years/next-defaults` | SYSTEM_ADMIN                     | `200` defaults object                           |
| GET    | `/api/school-years/:id`           | SYSTEM_ADMIN                     | `200` with `{ year }`                           |
| POST   | `/api/school-years/activate`      | SYSTEM_ADMIN                     | `201` with `{ year }`                           |
| PUT    | `/api/school-years/:id`           | SYSTEM_ADMIN                     | `200` with `{ year }`                           |
| PATCH  | `/api/school-years/:id/status`    | SYSTEM_ADMIN                     | `200` with `{ year }`                           |
| PATCH  | `/api/school-years/:id/override`  | SYSTEM_ADMIN                     | `200` with `{ year }`                           |
| PATCH  | `/api/school-years/:id/dates`     | SYSTEM_ADMIN                     | `200` with `{ year }`                           |
| DELETE | `/api/school-years/:id`           | SYSTEM_ADMIN                     | `200` with `{ message: "School year deleted" }` |

---

## 6) Curriculum (`/api/curriculum`)

| Method | Path                                 | Auth                    | Expected response                               |
| ------ | ------------------------------------ | ----------------------- | ----------------------------------------------- |
| GET    | `/api/curriculum/:ayId/grade-levels` | SYSTEM_ADMIN            | `200` with `{ gradeLevels: [...] }`             |
| POST   | `/api/curriculum/:ayId/grade-levels` | SYSTEM_ADMIN            | `201` with `{ gradeLevel }`                     |
| PUT    | `/api/curriculum/grade-levels/:id`   | SYSTEM_ADMIN            | `200` with `{ gradeLevel }`                     |
| DELETE | `/api/curriculum/grade-levels/:id`   | SYSTEM_ADMIN            | `200` with `{ message: "Grade level deleted" }` |
| GET    | `/api/curriculum/:ayId/scp-config`   | REGISTRAR, SYSTEM_ADMIN | `200` with `{ scpProgramConfigs: [...] }`       |
| PUT    | `/api/curriculum/:ayId/scp-config`   | SYSTEM_ADMIN            | `200` with `{ scpProgramConfigs: [...] }`       |

---

## 7) Sections (`/api/sections`)

| Method | Path                     | Auth                    | Expected response                           |
| ------ | ------------------------ | ----------------------- | ------------------------------------------- |
| GET    | `/api/sections/teachers` | REGISTRAR, SYSTEM_ADMIN | `200` with `{ teachers: [...] }`            |
| GET    | `/api/sections`          | REGISTRAR, SYSTEM_ADMIN | `200` with `{ sections: [...] }`            |
| GET    | `/api/sections/:ayId`    | REGISTRAR, SYSTEM_ADMIN | `200` with `{ sections: [...] }`            |
| POST   | `/api/sections`          | REGISTRAR, SYSTEM_ADMIN | `201` with `{ section }`                    |
| PUT    | `/api/sections/:id`      | REGISTRAR, SYSTEM_ADMIN | `200` with `{ section }`                    |
| DELETE | `/api/sections/:id`      | REGISTRAR, SYSTEM_ADMIN | `200` with `{ message: "Section deleted" }` |

---

## 8) Students (`/api/students`)

All student endpoints require authentication first.

| Method | Path                                      | Auth                             | Expected response                            |
| ------ | ----------------------------------------- | -------------------------------- | -------------------------------------------- |
| GET    | `/api/students`                           | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` with `{ students: [...], pagination }` |
| GET    | `/api/students/:id`                       | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` with `{ student }`                     |
| PUT    | `/api/students/:id`                       | REGISTRAR, SYSTEM_ADMIN          | `410` legacy action unavailable              |
| GET    | `/api/students/:id/health-records`        | REGISTRAR, SYSTEM_ADMIN, TEACHER | `410` legacy action unavailable              |
| POST   | `/api/students/:id/health-records`        | REGISTRAR, SYSTEM_ADMIN          | `410` legacy action unavailable              |
| PUT    | `/api/students/:id/health-records/:recId` | REGISTRAR, SYSTEM_ADMIN          | `410` legacy action unavailable              |
| POST   | `/api/students/:id/reset-portal-pin`      | REGISTRAR, SYSTEM_ADMIN          | `410` legacy action unavailable              |

### Sample unavailable response

```json
{
  "message": "Health records is unavailable after legacy applicant stack removal."
}
```

---

## 9) Applications / Admission Lane (`/api/applications`)

### Public endpoints

| Method | Path                                      | Auth | Expected response                                   |
| ------ | ----------------------------------------- | ---- | --------------------------------------------------- |
| POST   | `/api/applications`                       | None | `201` created application/early-registration record |
| GET    | `/api/applications/track/:trackingNumber` | None | `200` tracked application summary                   |
| GET    | `/api/applications/lookup-lrn/:lrn`       | None | `200` lookup result                                 |
| GET    | `/api/applications/lookup-by-lrn/:lrn`    | None | `200` lookup result                                 |

### Protected endpoints (REGISTRAR, SYSTEM_ADMIN unless noted)

| Method | Path                                            | Auth                    | Expected response                  |
| ------ | ----------------------------------------------- | ----------------------- | ---------------------------------- |
| POST   | `/api/applications/f2f`                         | REGISTRAR, SYSTEM_ADMIN | `201` created walk-in application  |
| POST   | `/api/applications/batch-assign-section`        | REGISTRAR, SYSTEM_ADMIN | `200` batch assignment summary     |
| POST   | `/api/applications/batch-process`               | REGISTRAR, SYSTEM_ADMIN | `200` batch lifecycle summary      |
| GET    | `/api/applications/scp-rankings`                | REGISTRAR, SYSTEM_ADMIN | `200` with `{ rankings, total }`   |
| GET    | `/api/applications/exports/lis-master`          | REGISTRAR, SYSTEM_ADMIN | `200` CSV payload                  |
| GET    | `/api/applications`                             | REGISTRAR, SYSTEM_ADMIN | `200` list payload                 |
| GET    | `/api/applications/:id`                         | REGISTRAR, SYSTEM_ADMIN | `200` application details          |
| GET    | `/api/applications/:id/detailed`                | REGISTRAR, SYSTEM_ADMIN | `200` expanded detail payload      |
| GET    | `/api/applications/:id/timeline`                | REGISTRAR, SYSTEM_ADMIN | `200` with `{ timeline }`          |
| GET    | `/api/applications/:id/sections`                | REGISTRAR, SYSTEM_ADMIN | `200` assignable sections payload  |
| GET    | `/api/applications/:id/requirements`            | REGISTRAR, SYSTEM_ADMIN | `200` with `{ requirements }`      |
| GET    | `/api/applications/:id/navigate`                | REGISTRAR, SYSTEM_ADMIN | `200` prev/next navigation payload |
| POST   | `/api/applications/:id/documents`               | REGISTRAR, SYSTEM_ADMIN | `200` uploaded document metadata   |
| DELETE | `/api/applications/:id/documents`               | REGISTRAR, SYSTEM_ADMIN | `200` deletion confirmation        |
| PUT    | `/api/applications/:id`                         | REGISTRAR, SYSTEM_ADMIN | `200` updated application          |
| PATCH  | `/api/applications/:id/profile-lock`            | SYSTEM_ADMIN            | `200` updated lock state           |
| PATCH  | `/api/applications/:id/approve`                 | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/verify`                  | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/enroll`                  | REGISTRAR, SYSTEM_ADMIN | `200` updated enrollment status    |
| PATCH  | `/api/applications/:id/unenroll`                | REGISTRAR, SYSTEM_ADMIN | `200` updated enrollment status    |
| POST   | `/api/applications/special-enrollment`          | REGISTRAR, SYSTEM_ADMIN | `201` special enrollment result    |
| PATCH  | `/api/applications/:id/temporarily-enroll`      | REGISTRAR, SYSTEM_ADMIN | `200` updated application          |
| PATCH  | `/api/applications/:id/assign-lrn`              | REGISTRAR, SYSTEM_ADMIN | `200` updated learner/application  |
| PATCH  | `/api/applications/:id/checklist`               | REGISTRAR, SYSTEM_ADMIN | `200` checklist update result      |
| PATCH  | `/api/applications/:id/reject`                  | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/revision`                | REGISTRAR, SYSTEM_ADMIN | `200` revision request result      |
| PATCH  | `/api/applications/:id/withdraw`                | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/offer-regular`           | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/mark-eligible`           | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/schedule-assessment`     | REGISTRAR, SYSTEM_ADMIN | `200` updated assessment schedule  |
| PATCH  | `/api/applications/:id/record-step-result`      | REGISTRAR, SYSTEM_ADMIN | `200` updated assessment result    |
| PATCH  | `/api/applications/:id/reschedule-assessment`   | REGISTRAR, SYSTEM_ADMIN | `200` updated assessment schedule  |
| PATCH  | `/api/applications/:id/schedule-exam`           | REGISTRAR, SYSTEM_ADMIN | `200` updated exam schedule        |
| PATCH  | `/api/applications/:id/reschedule-exam`         | REGISTRAR, SYSTEM_ADMIN | `200` updated exam schedule        |
| PATCH  | `/api/applications/:id/schedule-interview`      | REGISTRAR, SYSTEM_ADMIN | `200` updated interview schedule   |
| PATCH  | `/api/applications/:id/record-interview-result` | REGISTRAR, SYSTEM_ADMIN | `200` updated interview result     |
| PATCH  | `/api/applications/:id/mark-interview-passed`   | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/record-result`           | REGISTRAR, SYSTEM_ADMIN | `200` updated assessment result    |
| PATCH  | `/api/applications/:id/pass`                    | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |
| PATCH  | `/api/applications/:id/fail`                    | REGISTRAR, SYSTEM_ADMIN | `200` updated application status   |

---

## 10) Admin (`/api/admin`)

All endpoints below require SYSTEM_ADMIN role.

| Method | Path                                  | Expected response                                       |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/admin/users`                    | `200` paged/list user payload                           |
| POST   | `/api/admin/users`                    | `201` created user object                               |
| PUT    | `/api/admin/users/:id`                | `200` updated user object                               |
| PATCH  | `/api/admin/users/:id/deactivate`     | `200` updated user object                               |
| PATCH  | `/api/admin/users/:id/reactivate`     | `200` updated user object                               |
| PATCH  | `/api/admin/users/:id/reset-password` | `200` with `{ message: "Password reset successfully" }` |
| GET    | `/api/admin/email-logs`               | `200` with `{ logs, total, page, limit }`               |
| GET    | `/api/admin/email-logs/export`        | `200` CSV payload                                       |
| GET    | `/api/admin/email-logs/:id`           | `200` single email-log object                           |
| PATCH  | `/api/admin/email-logs/:id/resend`    | `200` with `{ message, newLogId }`                      |
| GET    | `/api/admin/system/health`            | `200` system health object                              |
| GET    | `/api/admin/dashboard/stats`          | `200` admin dashboard stats object                      |
| GET    | `/api/admin/atlas/health`             | `200` ATLAS connectivity status                         |
| GET    | `/api/admin/atlas/events`             | `200` ATLAS event list payload                          |
| GET    | `/api/admin/atlas/events/:id`         | `200` with `{ event }`                                  |

---

## 11) Audit Logs (`/api/audit-logs`)

| Method | Path                     | Auth                    | Expected response            |
| ------ | ------------------------ | ----------------------- | ---------------------------- |
| GET    | `/api/audit-logs`        | REGISTRAR, SYSTEM_ADMIN | `200` audit log list payload |
| GET    | `/api/audit-logs/export` | SYSTEM_ADMIN            | `200` CSV export             |

---

## 12) Teachers (`/api/teachers`)

All endpoints below require SYSTEM_ADMIN role.

| Method | Path                                     | Expected response                                       |
| ------ | ---------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/teachers`                          | `200` with `{ scope, teachers: [...] }`                 |
| GET    | `/api/teachers/atlas/faculty-sync`       | `200` ATLAS sync health/status payload                  |
| POST   | `/api/teachers/atlas/push`               | `200` batch ATLAS push result                           |
| POST   | `/api/teachers/:id/atlas/push`           | `200` single teacher push result                        |
| GET    | `/api/teachers/:id/designation`          | `200` with `{ scope, teacher, designation, atlasSync }` |
| POST   | `/api/teachers/:id/designation/validate` | `200` designation validation result                     |
| PUT    | `/api/teachers/:id/designation`          | `200` updated designation payload                       |
| GET    | `/api/teachers/:id`                      | `200` with `{ teacher }`                                |
| POST   | `/api/teachers`                          | `201` with `{ teacher, atlasSync }`                     |
| PUT    | `/api/teachers/:id`                      | `200` with `{ teacher, atlasSync }`                     |
| PATCH  | `/api/teachers/:id/deactivate`           | `200` with `{ teacher, atlasSync }`                     |
| PATCH  | `/api/teachers/:id/reactivate`           | `200` with `{ teacher, atlasSync }`                     |

---

## 13) Learner Portal (`/api/learner`)

| Method | Path                  | Auth | Expected response                                              |
| ------ | --------------------- | ---- | -------------------------------------------------------------- |
| POST   | `/api/learner/lookup` | None | `200` learner lookup result (identity + portal access context) |

---

## 14) Early Registration Lane (`/api/early-registrations`)

### Public endpoints

| Method | Path                                      | Auth | Expected response                                           |
| ------ | ----------------------------------------- | ---- | ----------------------------------------------------------- |
| GET    | `/api/early-registrations/check-lrn/:lrn` | None | `200` existence check, typically `{ exists: boolean, ... }` |
| POST   | `/api/early-registrations`                | None | `201` created early-registration submission                 |

### Protected endpoints (REGISTRAR, SYSTEM_ADMIN unless noted)

| Method | Path                                                      | Auth                             | Expected response                    |
| ------ | --------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| POST   | `/api/early-registrations/f2f`                            | REGISTRAR, SYSTEM_ADMIN          | `201` created walk-in registration   |
| GET    | `/api/early-registrations`                                | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` list payload                   |
| GET    | `/api/early-registrations/:id`                            | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` single registration            |
| PATCH  | `/api/early-registrations/:id/verify`                     | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| POST   | `/api/early-registrations/:id/documents`                  | REGISTRAR, SYSTEM_ADMIN          | `200` uploaded document metadata     |
| DELETE | `/api/early-registrations/:id/documents`                  | REGISTRAR, SYSTEM_ADMIN          | `200` deletion confirmation          |
| PATCH  | `/api/early-registrations/:id/checklist`                  | REGISTRAR, SYSTEM_ADMIN          | `200` checklist update confirmation  |
| PATCH  | `/api/early-registrations/batch-process`                  | REGISTRAR, SYSTEM_ADMIN          | `200` batch process summary          |
| POST   | `/api/early-registrations/batch/verify-documents/preview` | REGISTRAR, SYSTEM_ADMIN          | `200` preview result                 |
| PATCH  | `/api/early-registrations/batch/verify-documents`         | REGISTRAR, SYSTEM_ADMIN          | `200` batch verification summary     |
| PATCH  | `/api/early-registrations/batch/assign-regular-section`   | REGISTRAR, SYSTEM_ADMIN          | `200` section assignment summary     |
| PATCH  | `/api/early-registrations/batch/schedule-step`            | REGISTRAR, SYSTEM_ADMIN          | `200` scheduling summary             |
| PATCH  | `/api/early-registrations/batch/save-scores`              | REGISTRAR, SYSTEM_ADMIN          | `200` score update summary           |
| PATCH  | `/api/early-registrations/batch/finalize-interview`       | REGISTRAR, SYSTEM_ADMIN          | `200` interview-finalization summary |
| GET    | `/api/early-registrations/:id/detailed`                   | REGISTRAR, SYSTEM_ADMIN, TEACHER | `200` expanded detail payload        |
| PATCH  | `/api/early-registrations/:id/reject`                     | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/withdraw`                   | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/mark-eligible`              | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/schedule-assessment`        | REGISTRAR, SYSTEM_ADMIN          | `200` updated assessment schedule    |
| PATCH  | `/api/early-registrations/:id/record-step-result`         | REGISTRAR, SYSTEM_ADMIN          | `200` updated assessment result      |
| PATCH  | `/api/early-registrations/:id/pass`                       | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/fail`                       | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/approve`                    | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/temporarily-enroll`         | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/enroll`                     | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |
| PATCH  | `/api/early-registrations/:id/assign-lrn`                 | REGISTRAR, SYSTEM_ADMIN          | `200` updated learner/registration   |
| PATCH  | `/api/early-registrations/:id/mark-interview-passed`      | REGISTRAR, SYSTEM_ADMIN          | `200` updated registration           |

---

## 15) EOSY (`/api/eosy`)

| Method | Path                              | Auth                    | Expected response                     |
| ------ | --------------------------------- | ----------------------- | ------------------------------------- |
| GET    | `/api/eosy/sections`              | REGISTRAR, SYSTEM_ADMIN | `200` EOSY section summary list       |
| GET    | `/api/eosy/sections/:id/records`  | REGISTRAR, SYSTEM_ADMIN | `200` section record payload          |
| PATCH  | `/api/eosy/records/:id`           | REGISTRAR, SYSTEM_ADMIN | `200` updated EOSY record             |
| POST   | `/api/eosy/sections/:id/finalize` | REGISTRAR, SYSTEM_ADMIN | `200` section finalization result     |
| POST   | `/api/eosy/sections/:id/reopen`   | SYSTEM_ADMIN            | `200` section reopen result           |
| POST   | `/api/eosy/school-year/finalize`  | SYSTEM_ADMIN            | `200` school-year finalization result |

---

## 16) Integration v1 (`/api/integration/v1`)

All integration endpoints are public read-only.

| Method | Path                                               | Auth | Expected response                                                  |
| ------ | -------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| GET    | `/api/integration/v1/sample/teachers`              | None | `200` with `{ data: [...], meta? }` sample teachers                |
| GET    | `/api/integration/v1/sample/staff`                 | None | `200` with `{ data: [...], meta? }` sample staff                   |
| GET    | `/api/integration/v1/sample/students`              | None | `200` with `{ data: [...], meta? }` sample students                |
| GET    | `/api/integration/v1/health`                       | None | `200` (or `503` degraded) with `{ data: { status, db, ... } }`     |
| GET    | `/api/integration/v1/learners`                     | None | `200` with `{ data: [...], meta }`                                 |
| GET    | `/api/integration/v1/students`                     | None | `200` alias of learners response                                   |
| GET    | `/api/integration/v1/faculty`                      | None | `200` with `{ data: [...], meta }`                                 |
| GET    | `/api/integration/v1/teachers`                     | None | `200` alias of faculty response                                    |
| GET    | `/api/integration/v1/staff`                        | None | `200` with `{ data: [...], meta }`                                 |
| GET    | `/api/integration/v1/sections`                     | None | `200` with `{ data: [...], meta }`                                 |
| GET    | `/api/integration/v1/sections/:sectionId/learners` | None | `200` with section + learners payload                              |
| GET    | `/api/integration/v1/default/atlas/faculty`        | None | `200` with `{ data: [...], meta: { sourceSystem: "ATLAS", ... } }` |
| GET    | `/api/integration/v1/default/smart/students`       | None | `200` with `{ data: [...], meta: { sourceSystem: "SMART", ... } }` |
| GET    | `/api/integration/v1/default/aims/context`         | None | `200` with `{ data: [...], meta: { sourceSystem: "AIMS", ... } }`  |

---

## Common Error Responses

| Status | Typical payload                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------- |
| 400    | `{ "message": "..." }` or integration `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401    | `{ "message": "Unauthorized" }` or auth message                                                       |
| 403    | `{ "message": "Forbidden" }`                                                                          |
| 404    | `{ "message": "... not found" }`                                                                      |
| 409    | conflict/duplicate/version mismatch payload                                                           |
| 410    | legacy endpoint removed/unavailable                                                                   |
| 422    | schema validation payload (when validator triggers)                                                   |
| 500    | `{ "message": "Internal server error" }` (or feature-specific error message)                          |
| 503    | upstream/service degraded or disabled mode                                                            |

---

## Notes

1. This document reflects currently mounted routes in `server/src/app.ts` and feature router files.
2. Legacy contract variance exists across modules (some use envelope keys like `data`, others return domain keys like `students`, `teacher`, `year`, etc.).
3. For partner subsystem consumption, prefer `/api/integration/v1/*` routes.
