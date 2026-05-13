# ATLAS Level 1 DFD — Aggregated Data Flows

**Normalization rules applied:**
1. Max ONE read arrow + ONE write arrow between any Process and any Store.
2. Minor read-only lookups (UI enrichment, scoping) are absorbed — no arrow drawn.
3. Flow labels name a logical *Data Packet*, not individual columns.

---

## Cluster A — Identity & System Basics

### P1.0 User Authentication
*(3 flows — already minimal)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D6 → P1.0 | **Saved Login Details** | Reads account email, password hash, role, lock status, and failed login count in one fetch. |
| 2 | P1.0 → D6 | **Failed Attempt Count or Account Lock** | Writes back failed login count increment or lock expiry — single targeted update. |
| 3 | P1.0 → D17 | **Login Activity Record** | One audit write per authentication attempt (success, failure, or lockout). |

---

### P2.0 Manage System Settings & Sync
*(5 flows — down from 13)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D1, D28 → P2.0 | **Current School Settings** | School profile (D1) and specialization alias mappings (D28) are both system-wide settings — loaded together in one admin read. |
| 2 | P2.0 → D1, D28 | **Saved School Settings** | Either a school profile field or an alias entry is saved — one logical write. |
| 3 | D5, D22, D27, D23 → P2.0 | **Current Teacher and Section List** | Faculty mirrors + faculty snapshot (D5, D22) and section mirrors + section snapshot (D27, D23) follow the identical sync pattern: fetch current state, compare checksum. Merged into one read. |
| 4 | P2.0 → D5, D22, D27, D23 | **Updated Teacher and Section Records** | Writes updated mirror rows and a new snapshot record for both faculty and sections after sync completes. Same target group as the read. |
| 5 | P2.0 → D17 | **Record of Settings and Sync Changes** | One audit write covering setting changes and sync runs. |

---

## Cluster B — Resource & Preference Management

### P3.0 Manage Academic Resources
*(5 flows — down from 18)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D2, D3, D4, D25, D7, D24 → P3.0 | **Current List of Rooms, Subjects, and Teacher Assignments** | All managed resource types (infrastructure, programme, assignments) are read together on page load. D26 absorbed into D25 (junction table, always fetched with its parent template). D5, D27, D28 absorbed — read-only lookup context, not resource targets. |
| 2 | P3.0 → D2, D3 | **New or Revised Room or Building** | Writes to a building or room record (create, edit, or delete). |
| 3 | P3.0 → D4, D25 | **New or Revised Subject or Class Schedule Template** | Writes to a subject, class template, or their binding (D26 written implicitly via D25 operations). |
| 4 | P3.0 → D7, D24 | **New or Revised Teacher Assignment** | Writes a faculty–subject assignment or an instructional cohort definition. |
| 5 | P3.0 → D17 | **Record of Resource Changes** | One audit write per create/update/delete action. |

---

### P4.0 Configure Priority Parameters
*(3 flows — already minimal)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D14, D21 → P4.0 | **Current Scheduling Rules** | Policy rules (D14) and grade-level shift windows (D21) are always read together — both define when and how classes can be scheduled. |
| 2 | P4.0 → D14, D21 | **Saved Scheduling Rules** | Writes either a revised policy record or a new shift window — same logical operation. |
| 3 | P4.0 → D17 | **Record of Rule Changes** | One audit write per configuration update. |

---

### P5.0 Process Teacher Preferences
*(4 flows — down from 14)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D8, D9, D10, D11, D12, D13 → P5.0 | **Current Teacher Requests and Preferences** | All active preference and request records are loaded together: forms (D8), time slots (D9), review status (D10), room requests (D11), appeals (D12), and appeal history (D13). D5 absorbed — faculty identity is implicit lookup context. |
| 2 | P5.0 → D8, D9, D10 | **Submitted Preference Form or Review Decision** | Covers both faculty submission (writes form + time slots to D8, D9) and officer review (writes decision to D10). One logical preference workflow write. |
| 3 | P5.0 → D11, D12, D13 | **New Room Request or Appeal** | Covers new request (D11), appeal filing (D12), and history entry (D13) — one escalation-chain write. |
| 4 | P5.0 → D17 | **Record of Preference Submissions and Reviews** | One audit write per submission or review action. |

---

## Cluster C — Engine & Distribution

### P6.0 Algorithmic Timetable Generation
*(6 flows — down from 16)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D5, D7, D24, D27 → P6.0 | **List of Teachers, Sections, and Class Groups** | Answers *who*: faculty profiles and load limits (D5), their subject assignments (D7), inter-section cohorts (D24), and enrolled section records (D27). D1 absorbed — school_id is implicit query scope, not a meaningful algorithm input. |
| 2 | D4, D25 → P6.0 | **Subject Details and Class Schedule Templates** | Answers *what*: subject minute requirements and session patterns (D4), plus period-length and periods-per-day config from class templates (D25). D26 absorbed into D25. |
| 3 | D2, D3 → P6.0 | **Building and Room Details** | Answers *where*: building coordinates for travel-time calculations (D2), room types, capacities, and feature tags (D3). |
| 4 | D8, D9, D14, D19, D21 → P6.0 | **Teacher Preferences and Scheduling Rules** | Answers *when and under what rules*: submitted preference forms and time-slot ratings (D8, D9), hard/soft policy rules (D14), pre-pinned locked sessions (D19), and grade-level shift windows (D21). |
| 5 | P6.0 → D15 | **Newly Created Draft Timetable** | Writes the complete draft: timetable entries, constraint violations, and run summary. |
| 6 | P6.0 → D17 | **Record of Schedule Generation** | One audit write: actor, trigger time, duration, and run status. |

---

### P7.0 Manual Schedule Refinement
*(5 flows — down from 12)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D15, D19, D11, D18 → P7.0 | **Draft Timetable, Locked Slots, and Pending Requests** | Everything displayed to the scheduler on load: draft entries (D15), locked sessions (D19), pending room requests (D11), and open follow-up flags (D18). D20 absorbed — lock action history is fetched as part of D19 display. |
| 2 | P7.0 → D15 | **Adjusted Timetable Entry** | Writes the modified timetable slot (move, swap, room change, or revert). |
| 3 | P7.0 → D19, D20 | **Updated Class Lock and Change History** | Writes the revised lock record (D19) and its corresponding action history entry (D20) — always co-written. |
| 4 | P7.0 → D11, D18 | **Room Request Decision or Follow-Up Note** | Writes a room request decision (approved/rejected to D11) or a new follow-up marker (D18) — both are resolution outputs of the review phase. |
| 5 | P7.0 → D16, D17 | **Record of Manual Adjustments** | Co-writes the detailed before/after payload (D16) and the general system event entry (D17) — both triggered by the same edit action. |

---

### P8.0 Data Synchronization & Distribution
*(2 flows — down from 6)*

| # | Direction | Data Packet | Justification |
|---|-----------|-------------|---------------|
| 1 | D15, D3, D4, D5, D27 → P8.0 | **Final Schedule with Teacher, Room, and Section Details** | The finalized draft schedule (D15) combined with all enrichment lookups needed to render human-readable output: room details (D3), subject names (D4), faculty profiles (D5), section names (D27). Merged — all are read-only inputs consumed in one publication pipeline. |
| 2 | P8.0 → D17 | **Record of Schedule Publication** | One audit write recording the distribution event. |

---

## Summary

| Process | Original | Final | Reduction |
|---------|----------|-------|-----------|
| P1.0 | 3 | 3 | — |
| P2.0 | 13 | 5 | −8 |
| P3.0 | 18 | 5 | −13 |
| P4.0 | 5 | 3 | −2 |
| P5.0 | 14 | 4 | −10 |
| P6.0 | 16 | 6 | −10 |
| P7.0 | 12 | 5 | −7 |
| P8.0 | 6 | 2 | −4 |
| **Total** | **87** | **33** | **−54 (−62%)** |

### Absorbed Stores (no arrow drawn)

| Store | Absorbed in | Reason |
|-------|-------------|--------|
| D1 (schools) | P6.0 read | Implicit school_id query scope — not a meaningful algorithm input |
| D5 (faculty_mirrors) | P3.0 read, P5.0 read | Read-only identity lookup; never written by these processes |
| D20 (locked_session_actions) | P7.0 read (via D19) | History always fetched alongside its parent locked session |
| D26 (class_template_subjects) | P3.0, P6.0 (via D25) | Junction table always accessed as part of parent template operations |
| D27 (section_mirrors) | P3.0 read | Section scoping context only; P3.0 does not manage section records |
| D28 (specialization_aliases) | P3.0 read | Alias matching is internal validation context, not a managed resource |
