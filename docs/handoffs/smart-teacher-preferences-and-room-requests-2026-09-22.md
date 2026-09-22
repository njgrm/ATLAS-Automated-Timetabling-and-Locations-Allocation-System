# SMART handoff — teacher preferences and room requests (ATLAS consumes; SMART owns the teacher side)

**To:** the SMART owner. **From:** ATLAS (Lane A), 2026-09-22.
**Status:** direction agreed with the ATLAS operator; **one contract decision needed from you** (§5).

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
- The **officer-side review** if you do not want it (§5).

## 5. The one decision we need from you

**Who owns review and appeal?**

- **(a) SMART owns submission only.** ATLAS keeps the officer review + appeal workflow and its
  `/faculty/preferences` review page, fed by your submissions. *This is the smaller change for you.*
- **(b) SMART owns the whole lifecycle** — submission, review, appeal, resolution. ATLAS then consumes
  only **decided** outcomes and retires its review surface. *This needs a decision-status contract and
  an audit trail from you.*

Either works. **Please state which**, because it determines whether ATLAS keeps or retires its review
page and what your contract must carry.

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
