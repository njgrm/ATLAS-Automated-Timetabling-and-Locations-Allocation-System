# Technical Guide: Fetching Published Schedules (AIMS Integration)

This document serves as the integration specification for sister systems (e.g., AIMS) needing to retrieve finalized academic schedules from ATLAS.

## 1. Integration Overview

ATLAS exposes **unauthenticated public REST endpoints** for retrieving schedules that have reached the `PUBLISHED` lifecycle state. These endpoints are designed for consumption by downstream systems and public portals.

**Base URL:** `https://njgrm.buru-degree.ts.net/api/v1`
**Environment:** Live Tailnet (Tailscale required)

---

## 2. Public API Endpoints  

The following endpoints do not require a Bearer token and return only data that has been explicitly finalized and published by a Scheduling Officer.

### A. School-wide Published Schedule
Retrieve the entire published dataset for a school.
- **Endpoint:** `GET /schools/:schoolId/schedules/published`
- **Use Case:** Full system synchronization or bulk data exports.

### B. Term-specific Published Schedule
Retrieve the schedule for a specific academic term (e.g., Quarter 1).
- **Endpoint:** `GET /schools/:schoolId/schedules/published/:termId`
- **Use Case:** Term-based reporting or grade-level filtering.

### C. Specific Entity Views
Filter the published schedule by Section, Faculty, or Room.
- **Section View:** `GET /schools/:schoolId/schedules/published/sections/:sectionId`
- **Faculty View:** `GET /schools/:schoolId/schedules/published/faculty/:facultyId`
- **Room View:** `GET /schools/:schoolId/schedules/published/rooms/:roomId`

---

## 3. Data Schema (Response)

All published endpoints return a standardized JSON payload.

```json
{
  "schoolId": 1,
  "termId": 1,
  "publishedAt": "2026-05-11T03:30:00.000Z",
  "entries": [
    {
      "sectionId": "ep-101",
      "sectionName": "7-Rizal",
      "gradeLevel": "GRADE_7",
      "facultyId": 7947,
      "facultyName": "SANTOS, MARIA S.",
      "roomId": 3,
      "roomName": "Room 101",
      "day": "MONDAY",
      "startTime": "07:00",
      "endTime": "08:00",
      "subjectCode": "ENG",
      "subjectName": "English"
    }
  ]
}
```

---

## 4. Current System State & Caveats

Sister systems should be aware of the following operational context:

1. **"Published" Gate:** If a school has not completed the `Review` phase and clicked **Publish**, these endpoints will return an empty `entries` array or a `404 Not Found` for that specific term.
2. **Specialization Mapping Sync:** The manual process for **Specialization Mapping** and **Teaching Load** reconciliation is currently being finalized. This means that while the API is ready, the *content* of the schedules may change as we refine the 1-to-Many mapping logic (e.g., ensuring a "Science" teacher is correctly assigned to Bio/Chem modules).
3. **Draft Data Isolation:** Under no circumstances will draft schedules or generation runs in progress be exposed via these public endpoints.
4. **Consistency:** Once a schedule is published, its `publishedAt` timestamp acts as a version marker. If a Scheduling Officer makes a manual edit and re-publishes, this timestamp will update.

---

## 5. Connectivity & Troubleshooting

- **Tailscale Required:** Ensure the AIMS agent or system is connected to the same Tailnet to resolve `njgrm.buru-degree.ts.net`.
- **Latency:** These endpoints are optimized for speed; however, school-wide fetches for large schools (100+ sections) may take 200-500ms.
- **Support:** For API inconsistencies or schema questions, refer to `ATLAS-PUBLIC-API.md` in the project root.
