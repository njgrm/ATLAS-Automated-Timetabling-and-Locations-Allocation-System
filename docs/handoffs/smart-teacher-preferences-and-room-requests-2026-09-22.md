# SMART handoff — teacher preferences and room requests (ATLAS consumes; SMART owns the teacher side)

**To:** the SMART owner. **From:** ATLAS (Lane A), 2026-09-22. **Updated:** 2026-09-23.
**Status:** direction agreed with the ATLAS operator, and the §5 contract decision is now **RESOLVED —
option (a)**: SMART owns submission only; ATLAS owns review, appeal and every scheduling consequence. The
login split confirms it — **the teacher login lives in SMART; the scheduler login lives in ATLAS.**

---

## 1. The direction

ATLAS and SMART currently hold **overlapping teacher-side data**, and ATLAS's teacher-facing forms are
redundant next to SMART's existing teacher side. The agreed split:

- **SMART owns the teacher-facing side** — the forms a teacher fills in, and the data they produce.
- **ATLAS consumes those submissions** and keeps what only ATLAS can do: **turn them into scheduling
  consequences** (generation inputs, readiness, room/placement decisions) and expose them to the
  scheduler in the Timetable workspace.
- ATLAS's own teacher-facing pages (`/my/preferences`, `/my/room-preferences`) are **superseded** by
  your side and will not be developed further.

ATLAS is **not** asking SMART to change its scheduling behaviour — only to own the teacher-facing
submission surface and publish it to ATLAS in a stable contract.

## 2. What ATLAS has today (so you can mirror or improve it)

Both features are fully built and **currently unused** — every table is empty. They are gated to the
faculty role, which is why the ATLAS operator could not see them. Treat this as the **functional
baseline**, not as a design to copy blindly.

### 2.1 Teacher preferences (`faculty_preferences` + `preference_time_slots`)

One record per **(school, school year, teacher)** — unique on that triple — with a submitted version:

| field | meaning |
| --- | --- |
| `pregnancySupport`, `physicalAilmentSupport`, `minimizeTravelTime`, `avoidUpperFloors` | boolean **well-being toggles** |
| `notes` | free text |
| `status` | `DRAFT` → `SUBMITTED` |
| `version` | increments on resubmission |
| `submittedAt` | when submitted |

Plus **per-timeslot availability**, one row per (day, start, end):

| field | meaning |
| --- | --- |
| `day` | weekday |
| `startTime` / `endTime` | the slot |
| `preference` | **`PREFERRED` / `AVAILABLE` / `UNAVAILABLE`** |

And an **officer review** record: `reviewStatus` = `PENDING` / `REVIEWED` / `NEEDS_FOLLOW_UP`, plus
`reviewerNotes`, `reviewerId`, `reviewedAt`.

### 2.2 Room requests (`faculty_room_preferences` + appeals)

One request **per timetable entry** — it names the class being moved, not just a room:

| field | meaning |
| --- | --- |
| `runId`, `entryId` | the published/draft timetable run and the specific session |
| `facultyId`, `subjectId`, `sectionId` | who/what/whom |
| `currentRoomId` → `requestedRoomId` | the move being asked for |
| `day`, `startTime`, `endTime`, `termIndex` | exactly which session, in which ordered term |
| `rationale` | free text |
| `status`, `version`, `reviewerId` | draft → submitted → reviewed |
| `submittedAt` | when submitted |

Plus **appeals**: a request can be appealed (`reason`), with status
`OPEN` → `UNDER_REVIEW` → `UPHELD` / `DENIED`, and an append-only **history** of each transition.

**That is the ticketing system the operator remembers**: submit → review → appeal → resolution, with
history.

## 3. What we need from SMART

A teacher-facing surface that captures the **same substance** and publishes it to ATLAS. Concretely:

1. **A preferences form** capturing the well-being toggles, notes, and per-timeslot
   `PREFERRED`/`AVAILABLE`/`UNAVAILABLE` — scoped to a **school year**.
2. **A room-request form** that lets a teacher ask to move **one named class session** to a different
   room, with a rationale, scoped to a **run + entry + ordered term**.
3. **An appeal path** on a decided request, with a reason and a visible status.
4. **A submission identity** stable across systems — the teacher's `employeeId` (and/or your external
   faculty id). ATLAS matches on those, never on a local surrogate.
5. **A published contract** ATLAS can read: either a pull endpoint, a push/webhook, or a shared
   schedule. Tell us which and we will adapt; do not assume ATLAS can read your database.

## 4. What ATLAS keeps

- The **scheduling consequence**: these submissions feed generation inputs and readiness, and the
  Timetable workspace shows them where a scheduler acts on them.
- The **run/entry binding** (`runId` + `entryId` + `termIndex`): a room request is meaningless without
  the exact session, and that identity lives in ATLAS.
- The **officer-side review, appeal and resolution** — confirmed ATLAS-owned (§5, resolved).

## 5. The decision — RESOLVED 2026-09-23: option (a)

**ATLAS owns review and appeal; SMART owns submission only.** The split follows the logins:

| | SMART | ATLAS |
| --- | --- | --- |
| **Login** | teacher | scheduler / privileged staff |
| **Owns** | the teacher-facing forms and the data they produce — well-being toggles, notes, per-slot `PREFERRED`/`AVAILABLE`/`UNAVAILABLE`, room-change requests, and appeals raised by the teacher | consuming those submissions, officer review, appeal adjudication and resolution, and every scheduling consequence |

ATLAS-side consequences, recorded so nobody reopens them:

1. **ATLAS keeps and develops its review surface** (`/faculty/preferences`, `/faculty/room-preferences`).
   Its audience is now the **scheduler**, not faculty, so it should be reached from the scheduler's own
   navigation rather than a faculty-named path.
2. **ATLAS's teacher-facing submission pages (`/my/preferences`, `/my/room-preferences`) retire.** With the
   teacher login in SMART, a teacher no longer reaches ATLAS by design, so these are unreachable rather
   than merely superseded — as is any ATLAS surface that assumed a signed-in teacher. Retirement is
   **gated on the adviser**: do not delete them yet. They stay frozen, and they are the cheapest fallback
   if SMART slips before a demo.
3. **The submission channel is machine-to-machine and must be authenticated.** ATLAS must never expose an
   open write endpoint for preferences or room requests — without an authenticated companion caller,
   anyone could post preferences as any teacher. Use the existing system-caller pattern (service token or
   a verified companion identity). ATLAS still matches the submitting teacher on a stable external
   identifier and **fails closed with a typed error** when it cannot, never attaching a submission to a
   guessed teacher.
4. **The public published schedule is unaffected** — `/public/schedules` is public by contract and needs no
   login.

What we still need from you is otherwise unchanged (§3.1–§3.4): the forms, the appeal path, the stable
submission identity, and the published contract ATLAS can read.

## 6. Acceptance tests

1. A teacher submits preferences for a school year; ATLAS can read them, keyed by `employeeId`, with
   the toggles, notes and per-slot preferences intact.
2. Resubmission increments a version rather than silently replacing — ATLAS must be able to tell.
3. A teacher submits a room request naming **one session**; ATLAS can resolve it to that run, entry and
   ordered term.
4. A decided request can be appealed with a reason, and the status transitions are visible to ATLAS.
5. **Identity:** a teacher ATLAS cannot match on `employeeId` fails closed with a typed error — it must
   not silently attach to the wrong person.
6. **Scope:** a submission for one school year never appears under another.

## 7. Out of scope for this handoff

SSO federation (separate handoffs: `docs/handoffs/smart-direct-federation-c04.md`) and the published
schedule feed (`docs/reference/aims-smart-term-aware-published-schedule-handoff-2026-09-22.md`).
