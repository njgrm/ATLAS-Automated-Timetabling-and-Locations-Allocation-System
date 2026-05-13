# ATLAS Level 1 DFD — Normalized Horizontal Data Flows

> **Rule applied to every process:** Only stores that are genuine read/write partners get their own arrow.
> Tightly-coupled store pairs are merged. Pure lookup/context stores are absorbed into labels.
> No double-headed arrows — all flows are unidirectional.

---

## Data Store Index

| ID | Table |
|----|-------|
| D1 | `schools` |
| D2 | `buildings` |
| D3 | `rooms` |
| D4 | `subjects` |
| D5 | `faculty_mirrors` |
| D6 | `atlas_auth_accounts` |
| D7 | `faculty_subjects` |
| D8 | `faculty_preferences` |
| D9 | `preference_time_slots` |
| D10 | `preference_reviews` |
| D11 | `faculty_room_preferences` |
| D12 | `room_request_appeals` |
| D13 | `room_request_appeal_history` |
| D14 | `scheduling_policies` |
| D15 | `generation_runs` |
| D16 | `manual_schedule_edits` |
| D17 | `audit_logs` |
| D18 | `follow_up_flags` |
| D19 | `locked_sessions` |
| D20 | `locked_session_actions` |
| D21 | `grade_shift_windows` |
| D22 | `faculty_snapshots` |
| D23 | `section_snapshots` |
| D24 | `instructional_cohorts` |
| D25 | `class_templates` |
| D26 | `class_template_subjects` |
| D27 | `section_mirrors` |
| D28 | `specialization_aliases` |

---

## Cluster A: Identity & System Basics

**Processes:** P1.0, P2.0

---

### P1.0 — User Authentication
*(3 arrows — already minimal, nothing to absorb)*

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D6 → P1.0 | Stored Account Credentials, Role, and Lock Status |
| 2 | P1.0 → D6 | Updated Failed Login Count / Lock Expiry |
| 3 | P1.0 → D17 | Authentication Event Record (success, failure, or lockout) |

---

### P2.0 — Manage System Settings & Sync
*(7 arrows — down from 13)*
> **Merges:** D1+D28 → one "settings" pair (school profile + aliases are both system config). D5+D22 → faculty sync pair (mirror + snapshot always travel together). D27+D23 → section sync pair (same pattern).

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D1, D28 → P2.0 | Current System Settings (school profile and specialization alias mappings) |
| 2 | P2.0 → D1, D28 | Updated System Setting (school profile or alias entry) |
| 3 | D5, D22 → P2.0 | Existing Faculty Records and Last Sync Snapshot (for diff and checksum comparison) |
| 4 | P2.0 → D5, D22 | Synced Faculty Profile Data and New Snapshot Record |
| 5 | D27, D23 → P2.0 | Existing Section Records and Last Sync Snapshot (for diff and checksum comparison) |
| 6 | P2.0 → D27, D23 | Synced Section Profile Data and New Snapshot Record |
| 7 | P2.0 → D17 | Audit Record of Sync Operations and Setting Changes |

---

## Cluster B: Resource & Preference Management

**Processes:** P3.0, P4.0, P5.0

---

### P3.0 — Manage Academic Resources
*(7 arrows — down from 18)*
> **Merges:** D4+D25+D26 → academic programme (subjects, templates, bindings). D7+D24 → teaching assignments (faculty–subject pairings and cohorts).
> **Absorbed (no arrow):** D5 (faculty lookup context), D27 (section scoping), D28 (alias matching) — referenced within labels.

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D2, D3 → P3.0 | Current Campus Infrastructure (building layouts, room types, capacities, features) |
| 2 | P3.0 → D2, D3 | Updated Infrastructure Record (new or revised building or room) |
| 3 | D4, D25, D26 → P3.0 | Current Academic Programme Data (subjects with grade levels; class templates and bindings) |
| 4 | P3.0 → D4, D25, D26 | Updated Academic Programme Record (subject, template, or binding) |
| 5 | D7, D24 → P3.0 | Current Teaching Assignments (faculty–subject pairings and inter-section cohort definitions) |
| 6 | P3.0 → D7, D24 | New or Updated Teaching Assignment or Cohort |
| 7 | P3.0 → D17 | Audit Record of All Resource Changes |

---

### P4.0 — Configure Priority Parameters
*(3 arrows — down from 5)*
> **Merged:** D14+D21 → one scheduling configuration pair (policy rules and grade-shift windows are always configured together).

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D14, D21 → P4.0 | Current Scheduling Configuration (policy constraint rules and grade-level shift windows) |
| 2 | P4.0 → D14, D21 | Updated Scheduling Configuration Record |
| 3 | P4.0 → D17 | Audit Record of Policy and Window Changes |

---

### P5.0 — Process Teacher Preferences
*(7 arrows — down from 14)*
> **Merged:** D8+D9 → preference submission pair (form and its time slots are always read/written together). D11+D12+D13 → room request chain (request, appeal, history form a single escalation flow).
> **Absorbed (no arrow):** D5 (faculty identity lookup) — referenced in Step 1 label.

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D8, D9 → P5.0 | Existing Preference Submissions (faculty preference forms and their time slot entries; faculty identity from D5 used as context) |
| 2 | P5.0 → D8, D9 | New or Updated Preference Submission and Time Slot Entries |
| 3 | D10 → P5.0 | Existing Preference Review Record (status and reviewer notes) |
| 4 | P5.0 → D10 | Updated Review Decision |
| 5 | D11, D12, D13 → P5.0 | Room Request and Appeal Records (requests, appeals, and status history) |
| 6 | P5.0 → D11, D12, D13 | New or Updated Room Request, Appeal, or History Entry |
| 7 | P5.0 → D17 | Audit Record of Preference Submissions and Review Events |

---

## Cluster C: Engine & Distribution

**Processes:** P6.0, P7.0, P8.0

---

### P6.0 — Algorithmic Timetable Generation
*(8 arrows — down from 16)*
> **Merged:** D5+D7+D8+D9 → faculty input pack (profiles, assignments, preferences, time slots — all consumed as one faculty dataset). D4+D25 → academic programme (subjects and templates define what gets scheduled). D24+D27 → section/cohort definitions (who gets scheduled).
> **Absorbed (no arrow):** D1 (school_id is implicit scoping on every query — not a meaningful input to draw), D26 (template–subject bindings are consumed as part of D25).

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D2, D3 → P6.0 | Campus Infrastructure (building coordinates for travel calculation; room types, capacities, features) |
| 2 | D4, D25 → P6.0 | Academic Programme Data (subjects with minute requirements and patterns; class templates with period config) |
| 3 | D5, D7, D8, D9 → P6.0 | Faculty Input Pack (profiles with load limits; assignments; submitted preference forms and time slot ratings) |
| 4 | D14, D21 → P6.0 | Scheduling Rules (hard and soft policy constraints; per-grade shift windows) |
| 5 | D19 → P6.0 | Locked Session Constraints (pre-pinned timeslots that must not be moved) |
| 6 | D24, D27 → P6.0 | Section and Cohort Definitions (enrolled counts, program types, TLE inter-section groups) |
| 7 | P6.0 → D15 | Generated Draft Schedule (entries, constraint violations, summary metrics) |
| 8 | P6.0 → D17 | Audit Record of Generation Run (actor, duration, status) |

---

### P7.0 — Manual Schedule Refinement
*(8 arrows — down from 12)*
> **Merged:** D19+D20 → locked session layer (session record and its action history always accessed together). D11+D18 → review items (room requests and follow-up flags are both pending review work addressed in this phase).

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D15 → P7.0 | Draft Schedule Entries (for display and manual editing) |
| 2 | P7.0 → D15 | Updated Draft Entries (after move, swap, room change, or revert) |
| 3 | P7.0 → D16 | Manual Edit Log Entry (edit type, before and after payloads) |
| 4 | D19, D20 → P7.0 | Locked Sessions and Action History (existing locks and their change log) |
| 5 | P7.0 → D19, D20 | Updated Lock Status and New Action Record |
| 6 | D11, D18 → P7.0 | Pending Review Items (room preference requests and follow-up flags) |
| 7 | P7.0 → D11, D18 | Review Decision or New Flag (approved/rejected room change; new follow-up marker) |
| 8 | P7.0 → D17 | Audit Record of Manual Edits and Review Decisions |

---

### P8.0 — Data Synchronization & Distribution
*(3 arrows — down from 6)*
> **Merged:** D3+D4+D5+D27 → schedule enrichment data (rooms, subjects, faculty, sections are all read-only lookups used to render human-readable published schedule output).

| Step | Flow | Data Label |
|------|------|------------|
| 1 | D15 → P8.0 | Finalized Generation Run Data (completed draft entries marked for publication) |
| 2 | D3, D4, D5, D27 → P8.0 | Schedule Enrichment Data (room details, subject names, faculty profiles, section names — for human-readable output) |
| 3 | P8.0 → D17 | Audit Record of Publication and Distribution Event |

---

## Flow Count Summary

| Process | Original | Normalized | Reduction |
|---------|---------|------------|-----------|
| P1.0 | 3 | 3 | — |
| P2.0 | 13 | 7 | −6 |
| P3.0 | 18 | 7 | −11 |
| P4.0 | 5 | 3 | −2 |
| P5.0 | 14 | 7 | −7 |
| P6.0 | 16 | 8 | −8 |
| P7.0 | 12 | 8 | −4 |
| P8.0 | 6 | 3 | −3 |
| **Total** | **87** | **46** | **−41** |

## Absorbed Stores by Process

| Process | Absorbed Stores | Reason |
|---------|----------------|--------|
| P2.0 | — | All stores are genuine sync targets |
| P3.0 | D5, D27, D28 | Read-only lookup context (faculty identity, section scope, alias matching) |
| P5.0 | D5 | Faculty identity lookup only — no preference data written to D5 |
| P6.0 | D1, D26 | D1 = implicit school scoping; D26 = consumed as part of D25 template reads |
| P7.0 | — | All stores are genuine edit/decision targets |
| P8.0 | — | Enrichment stores merged, not absorbed |
