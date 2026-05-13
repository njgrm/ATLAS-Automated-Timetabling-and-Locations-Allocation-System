# ATLAS Level 1 DFD — Horizontal Data Flows (Process ↔ Data Store)

> All flows are **unidirectional** (no double-headed arrows).
> Direction notation: **Source → Destination: *Data Label***

---

## Data Store Index (D1–D28)

| ID | Table | Description |
|----|-------|-------------|
| D1 | `schools` | School profiles |
| D2 | `buildings` | Campus buildings |
| D3 | `rooms` | Rooms per building |
| D4 | `subjects` | Subject catalogue |
| D5 | `faculty_mirrors` | Synced faculty profiles |
| D6 | `atlas_auth_accounts` | Local auth credentials |
| D7 | `faculty_subjects` | Faculty–subject assignments |
| D8 | `faculty_preferences` | Faculty preference forms |
| D9 | `preference_time_slots` | Time slot preference entries |
| D10 | `preference_reviews` | Officer reviews of preference forms |
| D11 | `faculty_room_preferences` | Room change requests |
| D12 | `room_request_appeals` | Appeals on rejected room requests |
| D13 | `room_request_appeal_history` | Appeal status history entries |
| D14 | `scheduling_policies` | Scheduling constraint rules |
| D15 | `generation_runs` | Timetable generation run records |
| D16 | `manual_schedule_edits` | Manual edit audit trail |
| D17 | `audit_logs` | System-wide action audit log |
| D18 | `follow_up_flags` | Entries flagged for follow-up |
| D19 | `locked_sessions` | Pre-generation locked session slots |
| D20 | `locked_session_actions` | Locked session action history |
| D21 | `grade_shift_windows` | Grade-level scheduling windows |
| D22 | `faculty_snapshots` | Durable faculty sync cache |
| D23 | `section_snapshots` | Durable section sync cache |
| D24 | `instructional_cohorts` | TLE inter-section cohorts |
| D25 | `class_templates` | Schedule profile templates |
| D26 | `class_template_subjects` | Template–subject bindings |
| D27 | `section_mirrors` | Synced section records |
| D28 | `specialization_aliases` | Faculty specialization alias mappings |

---

## Process Index (P1.0–P8.0)

| ID | Process |
|----|---------|
| P1.0 | User Authentication |
| P2.0 | Manage System Settings & Sync |
| P3.0 | Manage Academic Resources |
| P4.0 | Configure Priority Parameters |
| P5.0 | Process Teacher Preferences |
| P6.0 | Algorithmic Timetable Generation |
| P7.0 | Manual Schedule Refinement |
| P8.0 | Data Synchronization & Distribution |

---

## Cluster A: Identity & System Basics

**Processes:** P1.0, P2.0
**Data Stores:** D1, D5, D6, D17, D22, D23, D27, D28

### P1.0 — User Authentication

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D6 → P1.0 | Stored Account Credentials, Role, and Lock Status |
| 2 | P1.0 → D6 | Updated Failed Login Count / Lock Expiry Timestamp |
| 3 | P1.0 → D17 | Record of Authentication Event (success, failure, or lockout) |

### P2.0 — Manage System Settings & Sync

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D1 → P2.0 | Current School Profile (name, shortName, campus map URL) |
| 2 | P2.0 → D1 | Updated School Profile |
| 3 | D5 → P2.0 | Existing Faculty Mirror Records (for diff comparison) |
| 4 | P2.0 → D5 | Synced Faculty Profile Data (from LIS/stub) |
| 5 | D22 → P2.0 | Last Faculty Snapshot (checksum, payload) |
| 6 | P2.0 → D22 | New Faculty Snapshot Record |
| 7 | D27 → P2.0 | Existing Section Mirror Records (for diff comparison) |
| 8 | P2.0 → D27 | Synced Section Profile Data (from EnrollPro/stub) |
| 9 | D23 → P2.0 | Last Section Snapshot (checksum, payload) |
| 10 | P2.0 → D23 | New Section Snapshot Record |
| 11 | D28 → P2.0 | Existing Specialization Alias Mappings |
| 12 | P2.0 → D28 | New or Updated Specialization Alias Entry |
| 13 | P2.0 → D17 | Record of Sync Operations and Setting Changes |

---

## Cluster B: Resource & Preference Management

**Processes:** P3.0, P4.0, P5.0
**Data Stores:** D2, D3, D4, D5, D7, D8, D9, D10, D11, D12, D13, D14, D17, D21, D24, D25, D26, D27, D28

### P3.0 — Manage Academic Resources

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D2 → P3.0 | Existing Building Records (name, coordinates, floor count) |
| 2 | P3.0 → D2 | New or Updated Building Record |
| 3 | D3 → P3.0 | Existing Room Records (type, capacity, features, floor) |
| 4 | P3.0 → D3 | New or Updated Room Record |
| 5 | D4 → P3.0 | Existing Subject Records (code, name, grade levels, pattern) |
| 6 | P3.0 → D4 | New or Updated Subject Record |
| 7 | D5 → P3.0 | Faculty Mirror Records (for assignment reference) |
| 8 | D7 → P3.0 | Existing Faculty–Subject Assignments |
| 9 | P3.0 → D7 | New or Updated Faculty–Subject Assignment |
| 10 | D24 → P3.0 | Existing Instructional Cohort Records |
| 11 | P3.0 → D24 | New or Updated Instructional Cohort |
| 12 | D25 → P3.0 | Existing Class Templates |
| 13 | P3.0 → D25 | New or Updated Class Template |
| 14 | D26 → P3.0 | Existing Template–Subject Bindings |
| 15 | P3.0 → D26 | New Template–Subject Binding |
| 16 | D27 → P3.0 | Section Mirror Records (for section-scoped resource lookup) |
| 17 | D28 → P3.0 | Specialization Aliases (for faculty assignment matching) |
| 18 | P3.0 → D17 | Record of Resource Create/Update/Delete Events |

### P4.0 — Configure Priority Parameters

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D14 → P4.0 | Existing Scheduling Policy (constraint thresholds, flags) |
| 2 | P4.0 → D14 | Updated Scheduling Policy Rules |
| 3 | D21 → P4.0 | Existing Grade Shift Windows (start/end times per grade level) |
| 4 | P4.0 → D21 | New or Updated Grade Shift Window |
| 5 | P4.0 → D17 | Record of Policy and Window Configuration Changes |

### P5.0 — Process Teacher Preferences

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D5 → P5.0 | Faculty Mirror Records (identity and school context) |
| 2 | D8 → P5.0 | Existing Faculty Preference Form (status, notes, well-being flags) |
| 3 | P5.0 → D8 | New or Updated Faculty Preference Form |
| 4 | D9 → P5.0 | Existing Time Slot Preference Entries |
| 5 | P5.0 → D9 | New or Updated Preferred Time Slots |
| 6 | D10 → P5.0 | Existing Preference Review Record (status, reviewer notes) |
| 7 | P5.0 → D10 | New or Updated Preference Review Decision |
| 8 | D11 → P5.0 | Existing Room Change Requests |
| 9 | P5.0 → D11 | New Room Preference Request or Updated Decision |
| 10 | D12 → P5.0 | Existing Room Request Appeals |
| 11 | P5.0 → D12 | New Room Request Appeal Record |
| 12 | D13 → P5.0 | Existing Appeal History Entries |
| 13 | P5.0 → D13 | New Appeal History Entry (status change or note) |
| 14 | P5.0 → D17 | Record of Preference Submissions and Review Events |

---

## Cluster C: Engine & Distribution

**Processes:** P6.0, P7.0, P8.0
**Data Stores:** D1, D2, D3, D4, D5, D7, D8, D9, D14, D15, D16, D17, D18, D19, D20, D21, D24, D25, D27

### P6.0 — Algorithmic Timetable Generation

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D1 → P6.0 | School Context (id, name — for run scoping) |
| 2 | D2 → P6.0 | Building Data (coordinates for travel-distance calculations) |
| 3 | D3 → P6.0 | Room Data (type, capacity, features, floor) |
| 4 | D4 → P6.0 | Subject Data (minutes/week, session pattern, required features) |
| 5 | D5 → P6.0 | Faculty Data (load limits, specializations, adviser flag) |
| 6 | D7 → P6.0 | Faculty–Subject Assignments (who teaches what sections) |
| 7 | D8 → P6.0 | Submitted Faculty Preference Forms (well-being flags) |
| 8 | D9 → P6.0 | Faculty Time Slot Preferences (PREFERRED / AVAILABLE / UNAVAILABLE) |
| 9 | D14 → P6.0 | Scheduling Policy Rules (hard and soft constraint config) |
| 10 | D19 → P6.0 | Locked Session Constraints (pre-pinned slots) |
| 11 | D21 → P6.0 | Grade Shift Windows (per-grade earliest/latest time bounds) |
| 12 | D24 → P6.0 | Instructional Cohort Definitions (TLE cross-section groups) |
| 13 | D25 → P6.0 | Class Templates (period length, periods per day) |
| 14 | D27 → P6.0 | Section Mirror Records (enrolled count, program type) |
| 15 | P6.0 → D15 | Newly Generated Draft Schedule (entries, violations, summary) |
| 16 | P6.0 → D17 | Record of Generation Run Event (triggered_by, duration, status) |

### P7.0 — Manual Schedule Refinement

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D15 → P7.0 | Draft Schedule Entries (for display and manual editing) |
| 2 | P7.0 → D15 | Updated Draft Entries (after move, swap, or room change) |
| 3 | P7.0 → D16 | Log of Manual Schedule Adjustment (before/after payloads) |
| 4 | D19 → P7.0 | Existing Locked Session Records |
| 5 | P7.0 → D19 | New or Updated Locked Session (status, day, timeslot) |
| 6 | D20 → P7.0 | Locked Session Action History |
| 7 | P7.0 → D20 | New Locked Session Action Entry (actor, before/after payload) |
| 8 | D18 → P7.0 | Existing Follow-Up Flags for Draft Entries |
| 9 | P7.0 → D18 | New Follow-Up Flag (entry_id, note) |
| 10 | D11 → P7.0 | Pending Room Preference Requests (for officer review) |
| 11 | P7.0 → D11 | Room Preference Decision (APPROVED/REJECTED, reviewer notes) |
| 12 | P7.0 → D17 | Record of Manual Edit and Room Decision Events |

### P8.0 — Data Synchronization & Distribution

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D15 → P8.0 | Finalized Generation Run Data (completed draft entries) |
| 2 | D4 → P8.0 | Subject Catalogue (for published schedule enrichment) |
| 3 | D5 → P8.0 | Faculty Profile Data (for teacher-facing schedule views) |
| 4 | D27 → P8.0 | Section Mirror Data (for student/section schedule views) |
| 5 | D3 → P8.0 | Room Data (for location display in published schedule) |
| 6 | P8.0 → D17 | Record of Publication and Distribution Events |

---

## Summary: Data Store Cluster Membership

| Data Store | Cluster A | Cluster B | Cluster C |
|------------|:---------:|:---------:|:---------:|
| D1 (schools) | ✓ | | ✓ |
| D2 (buildings) | | ✓ | ✓ |
| D3 (rooms) | | ✓ | ✓ |
| D4 (subjects) | | ✓ | ✓ |
| D5 (faculty_mirrors) | ✓ | ✓ | ✓ |
| D6 (atlas_auth_accounts) | ✓ | | |
| D7 (faculty_subjects) | | ✓ | ✓ |
| D8 (faculty_preferences) | | ✓ | ✓ |
| D9 (preference_time_slots) | | ✓ | ✓ |
| D10 (preference_reviews) | | ✓ | |
| D11 (faculty_room_preferences) | | ✓ | ✓ |
| D12 (room_request_appeals) | | ✓ | |
| D13 (room_request_appeal_history) | | ✓ | |
| D14 (scheduling_policies) | | ✓ | ✓ |
| D15 (generation_runs) | | | ✓ |
| D16 (manual_schedule_edits) | | | ✓ |
| D17 (audit_logs) | ✓ | ✓ | ✓ |
| D18 (follow_up_flags) | | | ✓ |
| D19 (locked_sessions) | | | ✓ |
| D20 (locked_session_actions) | | | ✓ |
| D21 (grade_shift_windows) | | ✓ | ✓ |
| D22 (faculty_snapshots) | ✓ | | |
| D23 (section_snapshots) | ✓ | | |
| D24 (instructional_cohorts) | | ✓ | ✓ |
| D25 (class_templates) | | ✓ | ✓ |
| D26 (class_template_subjects) | | ✓ | |
| D27 (section_mirrors) | ✓ | ✓ | ✓ |
| D28 (specialization_aliases) | ✓ | ✓ | |
