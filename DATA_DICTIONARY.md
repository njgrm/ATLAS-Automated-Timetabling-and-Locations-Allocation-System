# ATLAS Data Dictionary

This dictionary documents all Prisma models in schema.prisma and serves as a bridge between the system's design and implementation. Field Name uses database column names (mapped names where applicable).

## Table 1: SCHOOLS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the school. |
| name | VARCHAR | --- | Full legal name of the school. |
| shortName | VARCHAR | 50 | Short name or abbreviation for the school. |
| campus_image_url | VARCHAR | --- | Optional; URL of the campus map image. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 2: BUILDINGS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the building. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| name | VARCHAR | --- | Building name. |
| short_code | VARCHAR | 20 | Optional; short building code. |
| x | FLOAT | --- | X coordinate on the campus map. |
| y | FLOAT | --- | Y coordinate on the campus map. |
| width | FLOAT | --- | Width of the building on the map. |
| height | FLOAT | --- | Height of the building on the map. |
| rotation | FLOAT | --- | Rotation angle for map rendering. |
| color | VARCHAR | --- | Hex color used for map rendering. |
| floor_count | INT | --- | Number of floors. |
| is_teaching_building | BOOLEAN | --- | True when the building contains teaching spaces. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 3: ROOMS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the room. |
| building_id | INT (FK) | --- | Reference to the building containing the room. |
| name | VARCHAR | --- | Room name or number. |
| floor | INT | --- | Floor number where the room is located. |
| type | ENUM | --- | Room type (RoomType enum). |
| capacity | INT | --- | Optional; maximum occupancy capacity. |
| is_teaching_space | BOOLEAN | --- | True when the room can be scheduled for classes. |
| floor_position | INT | --- | Ordering position of the room on its floor. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 4: SUBJECTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the subject. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| code | VARCHAR | 32 | Subject code (unique within the school). |
| name | VARCHAR | --- | Subject name. |
| min_minutes_per_week | INT | --- | Required minimum instructional minutes per week. |
| preferred_room_type | ENUM | --- | Preferred room type (RoomType enum). |
| session_pattern | ENUM | --- | Preferred session pattern (SessionPattern enum). |
| grade_levels | INT[] | --- | Grade levels this subject applies to. |
| is_active | BOOLEAN | --- | True when the subject is active and usable. |
| is_seedable | BOOLEAN | --- | True when subject can be included in seed data sets. |
| inter_section_enabled | BOOLEAN | --- | True when inter-section grouping is allowed. |
| inter_section_grade_levels | INT[] | --- | Grade levels allowed for inter-section grouping. |
| program_scopes | ENUM[] | --- | Program types this subject applies to (ProgramType enum). |
| allowed_specializations | VARCHAR[] | --- | Faculty specializations allowed to teach the subject. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 5: FACULTY_MIRRORS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique local identifier for a faculty member. |
| external_id | INT | --- | External LIS/HR identifier. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| first_name | VARCHAR | --- | Faculty first name. |
| last_name | VARCHAR | --- | Faculty last name. |
| department | VARCHAR | --- | Optional; department name. |
| specialization | VARCHAR | --- | Optional; specialization name. |
| employment_status | VARCHAR | --- | Employment status label (e.g., PERMANENT). |
| contact_info | VARCHAR | --- | Optional; contact details. |
| avatar_url | VARCHAR | --- | Optional; profile image URL. |
| local_notes | VARCHAR | --- | Optional; school-specific notes. |
| is_active_for_scheduling | BOOLEAN | --- | True when included in scheduling. |
| is_class_adviser | BOOLEAN | --- | True when assigned as a class adviser. |
| advisory_equivalent_hours | INT | --- | Advisory hours credited in workload. |
| can_teach_outside_department | BOOLEAN | --- | True when allowed to teach outside department. |
| max_hours_per_week | INT | --- | Maximum teaching hours per week. |
| last_synced_at | DATETIME | --- | Last sync time with LIS/HR source. |
| is_stale | BOOLEAN | --- | True when mirror data is stale. |
| stale_reason | VARCHAR | --- | Optional; reason for staleness. |
| stale_at | DATETIME | --- | Optional; time the record was marked stale. |
| advised_section_id | INT | --- | Optional; section ID advised. |
| advised_section_name | VARCHAR | --- | Optional; cached advised section name. |
| version | INT | --- | Revision counter for this record. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 6: ATLAS_AUTH_ACCOUNTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the auth account. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| faculty_id | INT (FK) | --- | Optional; linked faculty mirror ID. |
| email | VARCHAR | 254 | Unique login email. |
| role | VARCHAR | 32 | Role label for access control. |
| password_hash | VARCHAR | --- | Hashed password. |
| is_active | BOOLEAN | --- | True when the account is active. |
| must_change_password | BOOLEAN | --- | True when a password reset is required on next login. |
| failed_login_count | INT | --- | Consecutive failed login attempts. |
| locked_until | DATETIME | --- | Optional; lockout expiration time. |
| last_login_at | DATETIME | --- | Optional; last successful login time. |
| created_at | DATETIME | --- | Record creation timestamp. |
| updated_at | DATETIME | --- | Record last update timestamp. |

## Table 7: FACULTY_SUBJECTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the assignment. |
| faculty_id | INT (FK) | --- | Linked faculty member. |
| subject_id | INT (FK) | --- | Linked subject. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| grade_levels | INT[] | --- | Grade levels covered by the assignment. |
| section_ids | INT[] | --- | Section IDs assigned under this pairing. |
| assigned_by | INT | --- | ID of the staff who made the assignment. |
| assigned_at | DATETIME | --- | Assignment timestamp. |
| version | INT | --- | Revision counter for this record. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 8: FACULTY_PREFERENCES

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the preference form. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| faculty_id | INT (FK) | --- | Submitting faculty member. |
| status | ENUM | --- | Preference status (PreferenceStatus enum). |
| notes | VARCHAR | --- | Optional; faculty notes or constraints. |
| submitted_at | DATETIME | --- | Optional; submission timestamp. |
| version | INT | --- | Revision counter for this record. |
| pregnancy_support | BOOLEAN | --- | Indicates pregnancy-related support request. |
| physical_ailment_support | BOOLEAN | --- | Indicates physical ailment accommodation request. |
| minimize_travel_time | BOOLEAN | --- | Indicates preference to reduce travel time. |
| avoid_upper_floors | BOOLEAN | --- | Indicates preference to avoid upper floors. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 9: PREFERENCE_TIME_SLOTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the time slot. |
| preference_id | INT (FK) | --- | Reference to the faculty preference record. |
| day | ENUM | --- | Day of week (DayOfWeek enum). |
| start_time | VARCHAR | --- | Start time in HH:MM format. |
| end_time | VARCHAR | --- | End time in HH:MM format. |
| preference | ENUM | --- | Preference rating (TimeSlotPreference enum). |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 10: PREFERENCE_REVIEWS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the review. |
| preference_id | INT (FK) | --- | Reference to the faculty preference record. |
| reviewer_id | INT | --- | Reviewer identifier. |
| review_status | ENUM | --- | Review status (ReviewStatus enum). |
| reviewer_notes | VARCHAR | --- | Optional; reviewer notes. |
| reviewed_at | DATETIME | --- | Optional; time review was completed. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 11: FACULTY_ROOM_PREFERENCES

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the room preference. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| run_id | INT (FK) | --- | Reference to the generation run. |
| entry_id | VARCHAR | 64 | Entry identifier from the generation draft. |
| faculty_id | INT (FK) | --- | Faculty member requesting the change. |
| subject_id | INT (FK) | --- | Subject tied to the request. |
| section_id | INT | --- | Section identifier tied to the request. |
| current_room_id | INT | --- | Current assigned room ID. |
| requested_room_id | INT | --- | Requested room ID. |
| day | ENUM | --- | Day of week (DayOfWeek enum). |
| start_time | VARCHAR | --- | Start time in HH:MM format. |
| end_time | VARCHAR | --- | End time in HH:MM format. |
| rationale | VARCHAR | --- | Optional; justification for the request. |
| status | ENUM | --- | Submission status (RoomPreferenceStatus enum). |
| submitted_at | DATETIME | --- | Optional; time request was submitted. |
| version | INT | --- | Revision counter for this record. |
| reviewer_id | INT | --- | Optional; reviewer identifier. |
| decision_status | ENUM | --- | Decision status (RoomPreferenceDecisionStatus enum). |
| reviewer_notes | VARCHAR | --- | Optional; reviewer notes. |
| reviewed_at | DATETIME | --- | Optional; review completion time. |
| created_at | DATETIME | --- | Record creation timestamp. |
| updated_at | DATETIME | --- | Record last update timestamp. |

## Table 12: ROOM_REQUEST_APPEALS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the appeal. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| run_id | INT (FK) | --- | Reference to the generation run. |
| request_id | INT (FK) | --- | Reference to the room preference request. |
| requester_id | INT (FK) | --- | Faculty member who filed the appeal. |
| reason | VARCHAR | --- | Stated reason for the appeal. |
| status | ENUM | --- | Appeal status (RoomRequestAppealStatus enum). |
| created_at | DATETIME | --- | Record creation timestamp. |
| updated_at | DATETIME | --- | Record last update timestamp. |

## Table 13: ROOM_REQUEST_APPEAL_HISTORY

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for a history entry. |
| appeal_id | INT (FK) | --- | Reference to the appeal. |
| actor_id | INT | --- | Identifier of the actor who made the change. |
| action | ENUM | --- | Action taken (RoomRequestAppealHistoryAction enum). |
| from_status | ENUM | --- | Optional; previous status (RoomRequestAppealStatus enum). |
| to_status | ENUM | --- | Optional; new status (RoomRequestAppealStatus enum). |
| note | VARCHAR | --- | Optional; free-form note. |
| created_at | DATETIME | --- | Record creation timestamp. |

## Table 14: SCHEDULING_POLICIES

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the policy. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| teacher_move_enabled | BOOLEAN | --- | Allows teachers to move between rooms. |
| max_consecutive_teaching_minutes_before_break | INT | --- | Maximum consecutive teaching minutes before break. |
| min_break_minutes_after_consecutive_block | INT | --- | Minimum break minutes after a block. |
| max_teaching_minutes_per_day | INT | --- | Maximum teaching minutes per day. |
| earliest_start_time | VARCHAR | --- | Earliest start time in HH:MM format. |
| latest_end_time | VARCHAR | --- | Latest end time in HH:MM format. |
| enforce_consecutive_break_as_hard | BOOLEAN | --- | Treat missing break as a hard constraint. |
| enable_travel_wellbeing_checks | BOOLEAN | --- | Enable travel and wellbeing constraints. |
| max_walking_distance_meters_per_transition | INT | --- | Max walking distance per transition. |
| max_building_transitions_per_day | INT | --- | Max building transitions per day. |
| max_back_to_back_transitions_without_buffer | INT | --- | Max back-to-back transitions without buffer. |
| max_idle_gap_minutes_per_day | INT | --- | Max idle gap minutes per day. |
| avoid_early_first_period | BOOLEAN | --- | Avoid early first period for faculty. |
| avoid_late_last_period | BOOLEAN | --- | Avoid late last period for faculty. |
| enable_vacant_aware_constraints | BOOLEAN | --- | Enable vacant-aware constraints. |
| target_faculty_daily_vacant_minutes | INT | --- | Target daily vacant minutes for faculty. |
| target_section_daily_vacant_periods | INT | --- | Target daily vacant periods for sections. |
| max_compressed_teaching_minutes_per_day | INT | --- | Max compressed teaching minutes per day. |
| lunch_start_time | VARCHAR | --- | Lunch window start time in HH:MM format. |
| lunch_end_time | VARCHAR | --- | Lunch window end time in HH:MM format. |
| enforce_lunch_window | BOOLEAN | --- | Enforce lunch window as a constraint. |
| show_special_events_in_grid | BOOLEAN | --- | Display special events in schedule grids. |
| enable_flag_ceremony | BOOLEAN | --- | Enable flag ceremony time block. |
| flag_ceremony_start_time | VARCHAR | --- | Flag ceremony start time in HH:MM format. |
| flag_ceremony_end_time | VARCHAR | --- | Flag ceremony end time in HH:MM format. |
| enable_recess | BOOLEAN | --- | Enable recess time block. |
| recess_start_time | VARCHAR | --- | Recess start time in HH:MM format. |
| recess_end_time | VARCHAR | --- | Recess end time in HH:MM format. |
| enable_lunch_window | BOOLEAN | --- | Enable lunch window time block. |
| enable_tle_two_pass_priority | BOOLEAN | --- | Enable two-pass priority for TLE scheduling. |
| allow_flexible_subject_assignment | BOOLEAN | --- | Allow flexible subject assignment rules. |
| allow_consecutive_lab_sessions | BOOLEAN | --- | Allow consecutive lab sessions. |
| constraint_config | JSON | --- | Optional; JSON blob for additional constraint config. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 15: GENERATION_RUNS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the generation run. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| status | ENUM | --- | Run status (GenerationRunStatus enum). |
| run_type | VARCHAR | 20 | Run type label (e.g., FULL). |
| triggered_by | INT | --- | Actor identifier who triggered the run. |
| started_at | DATETIME | --- | Optional; run start timestamp. |
| finished_at | DATETIME | --- | Optional; run end timestamp. |
| duration_ms | INT | --- | Optional; run duration in milliseconds. |
| summary | JSON | --- | Optional; run summary payload. |
| violations | JSON | --- | Optional; constraint violations payload. |
| draft_entries | JSON | --- | Optional; draft schedule entries payload. |
| unassigned_items | JSON | --- | Optional; unassigned items payload. |
| error | VARCHAR | --- | Optional; failure error message. |
| version | INT | --- | Revision counter for this record. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 16: MANUAL_SCHEDULE_EDITS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the manual edit. |
| run_id | INT (FK) | --- | Reference to the generation run. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| actor_id | INT | --- | Actor identifier who made the edit. |
| edit_type | ENUM | --- | Edit type (ManualEditType enum). |
| before_payload | JSON | --- | Snapshot before the edit. |
| after_payload | JSON | --- | Snapshot after the edit. |
| validation_summary | JSON | --- | Optional; validation summary after the edit. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 17: AUDIT_LOGS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the audit entry. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | Optional; school year context identifier. |
| action | VARCHAR | 50 | Action label. |
| actor_id | INT | --- | Actor identifier for the action. |
| target_ids | INT[] | --- | Target entity IDs associated with the action. |
| metadata | JSON | --- | Optional; metadata payload. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 18: FOLLOW_UP_FLAGS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the follow-up flag. |
| run_id | INT (FK) | --- | Reference to the generation run. |
| entry_id | VARCHAR | 64 | Entry identifier in the draft schedule. |
| note | VARCHAR | --- | Optional; follow-up note. |
| created_by | INT | --- | Actor identifier who created the flag. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 19: LOCKED_SESSIONS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the locked session. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| entry_kind | ENUM | --- | Entry type (PreGenerationDraftEntryKind enum). |
| section_id | INT | --- | Section identifier. |
| subject_id | INT | --- | Subject identifier. |
| faculty_id | INT | --- | Optional; faculty identifier. |
| room_id | INT | --- | Optional; room identifier. |
| cohort_code | VARCHAR | 50 | Optional; cohort code for grouped sessions. |
| status | ENUM | --- | Draft status (PreGenerationDraftStatus enum). |
| locked_run_id | INT | --- | Optional; generation run that locked the entry. |
| notes | VARCHAR | --- | Optional; notes for the locked session. |
| version | INT | --- | Revision counter for this record. |
| day | ENUM | --- | Day of week (DayOfWeek enum). |
| start_time | VARCHAR | --- | Start time in HH:MM format. |
| end_time | VARCHAR | --- | End time in HH:MM format. |
| created_by | INT | --- | Actor identifier who created the lock. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 20: LOCKED_SESSION_ACTIONS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the lock action. |
| lock_id | INT (FK) | --- | Optional; reference to the locked session. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| actor_id | INT | --- | Actor identifier who performed the action. |
| action_type | VARCHAR | 50 | Action type label. |
| before_payload | JSON | --- | Optional; payload before action. |
| after_payload | JSON | --- | Optional; payload after action. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 21: GRADE_SHIFT_WINDOWS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the grade shift window. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| grade_level | INT | --- | Grade level the window applies to. |
| start_time | VARCHAR | --- | Window start time in HH:MM format. |
| end_time | VARCHAR | --- | Window end time in HH:MM format. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 22: FACULTY_SNAPSHOTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the snapshot. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| fetched_at | DATETIME | --- | Snapshot fetch timestamp. |
| source | VARCHAR | --- | Source system label. |
| checksum | VARCHAR | --- | Optional; checksum of the payload. |
| schema_version | INT | --- | Snapshot schema version. |
| payload | JSON | --- | Snapshot payload. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 23: SECTION_SNAPSHOTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the snapshot. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| fetched_at | DATETIME | --- | Snapshot fetch timestamp. |
| source | VARCHAR | --- | Source system label. |
| checksum | VARCHAR | --- | Optional; checksum of the payload. |
| schema_version | INT | --- | Snapshot schema version. |
| payload | JSON | --- | Snapshot payload. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Table 24: INSTRUCTIONAL_COHORTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the cohort. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| school_year_id | INT | --- | School year context identifier. |
| cohort_code | VARCHAR | 50 | Cohort code identifier. |
| specialization_code | VARCHAR | 20 | Specialization code. |
| specialization_name | VARCHAR | --- | Specialization name. |
| grade_level | INT | --- | Grade level. |
| member_section_ids | INT[] | --- | Section IDs in the cohort. |
| expected_enrollment | INT | --- | Expected total enrollment. |
| preferred_room_type | ENUM | --- | Optional; preferred room type (RoomType enum). |
| is_active | BOOLEAN | --- | True when the cohort is active. |
| source_ref | VARCHAR | --- | Optional; source reference label. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 25: CLASS_TEMPLATES

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the class template. |
| school_id | INT (FK) | --- | Reference to the owning school. |
| name | VARCHAR | --- | Template name. |
| label | VARCHAR | --- | Display label for the template. |
| program_type | ENUM | --- | Program type (ProgramType enum). |
| grade_applicability | INT[] | --- | Grade levels this template applies to. |
| period_length_minutes | INT | --- | Length of each period in minutes. |
| periods_per_day | INT | --- | Number of periods per day. |
| is_active | BOOLEAN | --- | True when the template is active. |
| is_default | BOOLEAN | --- | True when the template is the default. |
| createdAt | DATETIME | --- | Record creation timestamp. |
| updatedAt | DATETIME | --- | Record last update timestamp. |

## Table 26: CLASS_TEMPLATE_SUBJECTS

| Field Name | Data Type | Length | Description |
| ---------- | --------- | ------ | ----------- |
| id | INT (PK) | --- | Unique identifier for the template binding. |
| template_id | INT (FK) | --- | Reference to the class template. |
| subject_id | INT (FK) | --- | Reference to the subject. |
| createdAt | DATETIME | --- | Record creation timestamp. |

## Enum Reference

| Enum | Values |
| ---- | ------ |
| RoomType | CLASSROOM, LABORATORY, COMPUTER_LAB, TLE_WORKSHOP, LIBRARY, GYMNASIUM, FACULTY_ROOM, OFFICE, OTHER |
| SessionPattern | MWF, TTH, ANY |
| PreferenceStatus | DRAFT, SUBMITTED |
| DayOfWeek | MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY |
| TimeSlotPreference | PREFERRED, AVAILABLE, UNAVAILABLE |
| ReviewStatus | PENDING, REVIEWED, NEEDS_FOLLOW_UP |
| RoomPreferenceStatus | DRAFT, SUBMITTED |
| RoomPreferenceDecisionStatus | PENDING, APPROVED, REJECTED |
| RoomRequestAppealStatus | OPEN, UNDER_REVIEW, UPHELD, DENIED |
| RoomRequestAppealHistoryAction | CREATED, STATUS_CHANGED, NOTE_ADDED, DECISION_RECORDED |
| GenerationRunStatus | QUEUED, RUNNING, COMPLETED, FAILED |
| ManualEditType | PLACE_UNASSIGNED, MOVE_ENTRY, CHANGE_ROOM, CHANGE_FACULTY, CHANGE_TIMESLOT, SWAP_ENTRIES, REVERT |
| PreGenerationDraftStatus | DRAFT, LOCKED_FOR_RUN, ARCHIVED |
| PreGenerationDraftEntryKind | SECTION, COHORT |
| ProgramType | REGULAR, STE, SPS, SPA, OTHER |