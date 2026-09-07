-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('CLASSROOM', 'LABORATORY', 'COMPUTER_LAB', 'TLE_WORKSHOP', 'LIBRARY', 'GYMNASIUM', 'FACULTY_ROOM', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "subject_qualification_priority" AS ENUM ('DEPARTMENT_FIRST', 'SPECIALIZATION_PRIMARY');

-- CreateEnum
CREATE TYPE "ancillary_load_source" AS ENUM ('HR', 'LOCAL', 'NONE');

-- CreateEnum
CREATE TYPE "teaching_load_cycle_state" AS ENUM ('EMPTY', 'POPULATED');

-- CreateEnum
CREATE TYPE "teaching_load_suggestion_status" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "preference_status" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "day_of_week" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateEnum
CREATE TYPE "time_slot_preference" AS ENUM ('PREFERRED', 'AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'REVIEWED', 'NEEDS_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "room_preference_status" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "room_preference_decision_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "room_request_appeal_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'DENIED');

-- CreateEnum
CREATE TYPE "room_request_appeal_history_action" AS ENUM ('CREATED', 'STATUS_CHANGED', 'NOTE_ADDED', 'DECISION_RECORDED');

-- CreateEnum
CREATE TYPE "generation_run_status" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "manual_edit_type" AS ENUM ('PLACE_UNASSIGNED', 'MOVE_ENTRY', 'CHANGE_ROOM', 'CHANGE_FACULTY', 'CHANGE_TIMESLOT', 'SWAP_ENTRIES', 'REVERT');

-- CreateEnum
CREATE TYPE "published_revision_status" AS ENUM ('DRAFT', 'SCHEDULED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "pre_generation_draft_status" AS ENUM ('DRAFT', 'LOCKED_FOR_RUN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "pre_generation_draft_entry_kind" AS ENUM ('SECTION', 'COHORT');

-- CreateEnum
CREATE TYPE "program_type" AS ENUM ('REGULAR', 'STE', 'SPS', 'SPA', 'OTHER');

-- CreateEnum
CREATE TYPE "class_program_slot_kind" AS ENUM ('CLASS', 'BREAK', 'SPECIAL_EVENT', 'CONFLICT');

-- CreateEnum
CREATE TYPE "offering_classification" AS ENUM ('CORE', 'SPECIALIZATION', 'EXPLORATORY', 'OTHER');

-- CreateEnum
CREATE TYPE "term_mode" AS ENUM ('ALL', 'ROTATING_FAMILY_MEMBER', 'EMPTY');

-- CreateTable
CREATE TABLE "schools" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" VARCHAR(50) NOT NULL,
    "campus_image_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollpro_school_year_mirrors" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "enrollpro_school_year_id" INTEGER NOT NULL,
    "year_label" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "source_endpoint" VARCHAR(200) NOT NULL DEFAULT '/api/integration/v1/school-year',
    "faculty_count" INTEGER NOT NULL DEFAULT 0,
    "section_count" INTEGER NOT NULL DEFAULT 0,
    "sync_status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "last_failure_summary" VARCHAR(500),
    "last_sync_metadata" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "archived_by" INTEGER,
    "archive_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollpro_school_year_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_mirrors" (
    "id" SERIAL NOT NULL,
    "external_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "grade_level_id" INTEGER NOT NULL,
    "grade_level_name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "max_capacity" INTEGER NOT NULL,
    "enrolled_count" INTEGER NOT NULL,
    "program_type" TEXT,
    "program_code" TEXT,
    "program_name" TEXT,
    "is_special_program" BOOLEAN NOT NULL DEFAULT false,
    "tle_program_id" INTEGER,
    "tle_specialization" TEXT,
    "tle_program_category" TEXT,
    "is_active_for_scheduling" BOOLEAN NOT NULL DEFAULT true,
    "preferred_room_id" INTEGER,
    "home_room_id" INTEGER,
    "building_zone_id" VARCHAR(32),
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "stale_reason" TEXT,
    "stale_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialization_aliases" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "canonical" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialization_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "short_code" VARCHAR(20),
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "floor_count" INTEGER NOT NULL DEFAULT 1,
    "is_teaching_building" BOOLEAN NOT NULL DEFAULT true,
    "grade_scope" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "building_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "floor_number" INTEGER,
    "building_zone_id" VARCHAR(32),
    "type" "room_type" NOT NULL DEFAULT 'CLASSROOM',
    "capacity" INTEGER,
    "is_teaching_space" BOOLEAN NOT NULL DEFAULT true,
    "is_shared_facility" BOOLEAN NOT NULL DEFAULT false,
    "floor_position" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "output_label" VARCHAR(64),
    "name" TEXT NOT NULL,
    "owner_department" VARCHAR(32),
    "qualification_priority" "subject_qualification_priority" NOT NULL DEFAULT 'DEPARTMENT_FIRST',
    "rotation_family" VARCHAR(64),
    "min_minutes_per_week" INTEGER NOT NULL,
    "preferred_room_type" "room_type" NOT NULL DEFAULT 'CLASSROOM',
    "modular_group_id" VARCHAR(64),
    "modular_order" INTEGER,
    "term_group_id" VARCHAR(64),
    "term_count" INTEGER NOT NULL DEFAULT 3,
    "grade_levels" INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_seedable" BOOLEAN NOT NULL DEFAULT false,
    "is_system_managed" BOOLEAN NOT NULL DEFAULT false,
    "inter_section_enabled" BOOLEAN NOT NULL DEFAULT false,
    "inter_section_grade_levels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "program_scopes" "program_type"[] DEFAULT ARRAY['REGULAR']::"program_type"[],
    "allowed_specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_mirrors" (
    "id" SERIAL NOT NULL,
    "external_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(7),
    "school_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "department" TEXT,
    "specialization" TEXT,
    "employment_status" TEXT NOT NULL DEFAULT 'PERMANENT',
    "contact_info" TEXT,
    "avatar_url" TEXT,
    "local_notes" TEXT,
    "is_active_for_scheduling" BOOLEAN NOT NULL DEFAULT true,
    "is_class_adviser" BOOLEAN NOT NULL DEFAULT false,
    "advisory_equivalent_hours" INTEGER NOT NULL DEFAULT 0,
    "ancillary_minutes_per_week" INTEGER,
    "ancillary_load_source" "ancillary_load_source" NOT NULL DEFAULT 'NONE',
    "can_teach_outside_department" BOOLEAN NOT NULL DEFAULT false,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "max_hours_per_week" INTEGER NOT NULL DEFAULT 30,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "stale_reason" TEXT,
    "stale_at" TIMESTAMP(3),
    "advised_section_id" INTEGER,
    "advised_section_name" TEXT,
    "plantilla_position" TEXT,
    "designation_title" TEXT,
    "undergraduate_degree" TEXT,
    "postgraduate_degree" TEXT,
    "major_specialization" TEXT,
    "minor_specialization" TEXT,
    "ancillary_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_auth_accounts" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "faculty_id" INTEGER,
    "email" VARCHAR(254) NOT NULL,
    "employee_id" VARCHAR(7),
    "account_name" TEXT,
    "role" VARCHAR(32) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_subjects" (
    "id" SERIAL NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER,
    "grade_levels" INTEGER[],
    "section_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "assigned_by" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_section_ownerships" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER,
    "faculty_subject_id" INTEGER NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "specialization_code" VARCHAR(64),
    "specialization_label" VARCHAR(128),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_section_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_load_cycles" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "state" "teaching_load_cycle_state" NOT NULL DEFAULT 'EMPTY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "initialized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_load_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_load_suggestion_proposals" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "coverage_mode" VARCHAR(48) NOT NULL,
    "status" "teaching_load_suggestion_status" NOT NULL DEFAULT 'PENDING',
    "preview_payload" JSONB NOT NULL,
    "refreshed_preview_payload" JSONB,
    "apply_payload" JSONB,
    "section_source" VARCHAR(48),
    "section_fallback_reason" VARCHAR(500),
    "suggested_assignment_count" INTEGER NOT NULL DEFAULT 0,
    "unresolved_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "applied_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "teaching_load_suggestion_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_preferences" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "status" "preference_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "pregnancy_support" BOOLEAN NOT NULL DEFAULT false,
    "physical_ailment_support" BOOLEAN NOT NULL DEFAULT false,
    "minimize_travel_time" BOOLEAN NOT NULL DEFAULT false,
    "avoid_upper_floors" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_time_slots" (
    "id" SERIAL NOT NULL,
    "preference_id" INTEGER NOT NULL,
    "day" "day_of_week" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "preference" "time_slot_preference" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preference_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_reviews" (
    "id" SERIAL NOT NULL,
    "preference_id" INTEGER NOT NULL,
    "reviewer_id" INTEGER NOT NULL,
    "review_status" "review_status" NOT NULL DEFAULT 'PENDING',
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preference_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_room_preferences" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "run_id" INTEGER NOT NULL,
    "entry_id" VARCHAR(64) NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "current_room_id" INTEGER NOT NULL,
    "requested_room_id" INTEGER NOT NULL,
    "day" "day_of_week" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "term_index" INTEGER NOT NULL DEFAULT 1,
    "rationale" TEXT,
    "status" "room_preference_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewer_id" INTEGER,
    "decision_status" "room_preference_decision_status" NOT NULL DEFAULT 'PENDING',
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_room_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_request_appeals" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "run_id" INTEGER NOT NULL,
    "request_id" INTEGER NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "room_request_appeal_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_request_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_request_appeal_history" (
    "id" SERIAL NOT NULL,
    "appeal_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action" "room_request_appeal_history_action" NOT NULL,
    "from_status" "room_request_appeal_status",
    "to_status" "room_request_appeal_status",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_request_appeal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_policies" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "teacher_move_enabled" BOOLEAN NOT NULL DEFAULT true,
    "period_length_minutes" INTEGER NOT NULL DEFAULT 45,
    "periods_per_day" INTEGER NOT NULL DEFAULT 10,
    "max_consecutive_teaching_minutes_before_break" INTEGER NOT NULL DEFAULT 120,
    "min_break_minutes_after_consecutive_block" INTEGER NOT NULL DEFAULT 15,
    "max_teaching_minutes_per_day" INTEGER NOT NULL DEFAULT 400,
    "earliest_start_time" TEXT NOT NULL DEFAULT '07:00',
    "latest_end_time" TEXT NOT NULL DEFAULT '18:30',
    "enforce_consecutive_break_as_hard" BOOLEAN NOT NULL DEFAULT false,
    "enable_travel_wellbeing_checks" BOOLEAN NOT NULL DEFAULT true,
    "max_walking_distance_meters_per_transition" INTEGER NOT NULL DEFAULT 120,
    "max_building_transitions_per_day" INTEGER NOT NULL DEFAULT 4,
    "max_back_to_back_transitions_without_buffer" INTEGER NOT NULL DEFAULT 2,
    "max_idle_gap_minutes_per_day" INTEGER NOT NULL DEFAULT 60,
    "avoid_early_first_period" BOOLEAN NOT NULL DEFAULT false,
    "avoid_late_last_period" BOOLEAN NOT NULL DEFAULT false,
    "enable_vacant_aware_constraints" BOOLEAN NOT NULL DEFAULT false,
    "target_faculty_daily_vacant_minutes" INTEGER NOT NULL DEFAULT 60,
    "target_section_daily_vacant_periods" INTEGER NOT NULL DEFAULT 1,
    "max_compressed_teaching_minutes_per_day" INTEGER NOT NULL DEFAULT 300,
    "lunch_start_time" TEXT NOT NULL DEFAULT '11:55',
    "lunch_end_time" TEXT NOT NULL DEFAULT '12:55',
    "enforce_lunch_window" BOOLEAN NOT NULL DEFAULT true,
    "show_special_events_in_grid" BOOLEAN NOT NULL DEFAULT true,
    "enable_flag_ceremony" BOOLEAN NOT NULL DEFAULT true,
    "flag_ceremony_start_time" TEXT NOT NULL DEFAULT '07:00',
    "flag_ceremony_end_time" TEXT NOT NULL DEFAULT '07:30',
    "enable_recess" BOOLEAN NOT NULL DEFAULT true,
    "recess_start_time" TEXT NOT NULL DEFAULT '09:45',
    "recess_end_time" TEXT NOT NULL DEFAULT '10:00',
    "enable_lunch_window" BOOLEAN NOT NULL DEFAULT true,
    "enable_tle_two_pass_priority" BOOLEAN NOT NULL DEFAULT true,
    "allow_flexible_subject_assignment" BOOLEAN NOT NULL DEFAULT false,
    "allow_consecutive_lab_sessions" BOOLEAN NOT NULL DEFAULT false,
    "constraint_config" JSONB,
    "teaching_standard_minutes" INTEGER NOT NULL DEFAULT 1800,
    "advisory_credit_minutes" INTEGER NOT NULL DEFAULT 300,
    "hard_cap_minutes" INTEGER NOT NULL DEFAULT 2400,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_special_events" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "event_type" VARCHAR(48) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "grade_group" VARCHAR(24),
    "program_type" VARCHAR(24),
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_special_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "status" "generation_run_status" NOT NULL DEFAULT 'QUEUED',
    "run_type" VARCHAR(20) NOT NULL DEFAULT 'FULL',
    "triggered_by" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "summary" JSONB,
    "violations" JSONB,
    "draft_entries" JSONB,
    "unassigned_items" JSONB,
    "error" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_schedule_edits" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "edit_type" "manual_edit_type" NOT NULL,
    "before_payload" JSONB NOT NULL,
    "after_payload" JSONB NOT NULL,
    "validation_summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_schedule_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_schedule_revisions" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "source_run_id" INTEGER NOT NULL,
    "source_revision_id" INTEGER,
    "status" "published_revision_status" NOT NULL DEFAULT 'SCHEDULED',
    "effective_date" TIMESTAMP(3) NOT NULL,
    "actor_id" INTEGER,
    "reason" VARCHAR(500) NOT NULL,
    "change_set" JSONB NOT NULL,
    "change_summary" JSONB,
    "previous_values" JSONB NOT NULL,
    "new_values" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_schedule_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "target_ids" INTEGER[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_flags" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "entry_id" VARCHAR(64) NOT NULL,
    "note" TEXT,
    "created_by" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locked_sessions" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "entry_kind" "pre_generation_draft_entry_kind" NOT NULL DEFAULT 'SECTION',
    "section_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "faculty_id" INTEGER,
    "room_id" INTEGER,
    "cohort_code" VARCHAR(50),
    "status" "pre_generation_draft_status" NOT NULL DEFAULT 'DRAFT',
    "locked_run_id" INTEGER,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "day" "day_of_week" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "term_index" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locked_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locked_session_actions" (
    "id" SERIAL NOT NULL,
    "lock_id" INTEGER,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "before_payload" JSONB,
    "after_payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locked_session_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_shift_windows" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "program_type" "program_type",
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_shift_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_snapshots" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'enrollpro',
    "checksum" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_snapshots" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'enrollpro',
    "checksum" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructional_cohorts" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "cohort_code" VARCHAR(50) NOT NULL,
    "specialization_code" VARCHAR(20) NOT NULL,
    "specialization_name" TEXT NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "member_section_ids" INTEGER[],
    "expected_enrollment" INTEGER NOT NULL DEFAULT 0,
    "preferred_room_type" "room_type",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructional_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_templates" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "program_type" "program_type" NOT NULL,
    "grade_applicability" INTEGER[],
    "period_length_minutes" INTEGER NOT NULL DEFAULT 50,
    "periods_per_day" INTEGER NOT NULL DEFAULT 8,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_template_subjects" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_template_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_program_slots" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "program_type" "program_type",
    "day_of_week" VARCHAR(16),
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "row_kind" "class_program_slot_kind" NOT NULL,
    "subject_family" VARCHAR(64),
    "subject_label" VARCHAR(128),
    "source_label" VARCHAR(64) NOT NULL DEFAULT 'TEMPLATE',
    "source_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_program_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_year_term_configs" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "term_count" INTEGER NOT NULL,
    "term_identities" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_year_term_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_year_offerings" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "term_config_id" INTEGER NOT NULL,
    "subjectId" INTEGER,
    "grade_level" INTEGER NOT NULL,
    "program_type" "program_type" NOT NULL,
    "section_mirror_id" INTEGER,
    "cohort_id" INTEGER,
    "classification" "offering_classification" NOT NULL,
    "weekly_minutes" INTEGER NOT NULL DEFAULT 0,
    "rotation_family" VARCHAR(64),
    "rotation_order" INTEGER,
    "term_mode" "term_mode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "retired_at" TIMESTAMP(3),
    "retired_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_year_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_term_assignments" (
    "id" SERIAL NOT NULL,
    "offering_id" INTEGER NOT NULL,
    "term_identity" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_term_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_aliases" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "alias" VARCHAR(64) NOT NULL,
    "department" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_labels" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_owner_prefixes" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "department" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_owner_prefixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_scope_rules" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "program_type" "program_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_scope_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_department_permissions" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_department_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_enrollpro_school_year_mirror_active" ON "enrollpro_school_year_mirrors"("school_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollpro_school_year_mirror" ON "enrollpro_school_year_mirrors"("school_id", "enrollpro_school_year_id");

-- CreateIndex
CREATE INDEX "section_mirrors_school_id_school_year_id_idx" ON "section_mirrors"("school_id", "school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "section_mirrors_school_id_school_year_id_external_id_key" ON "section_mirrors"("school_id", "school_year_id", "external_id");

-- CreateIndex
CREATE INDEX "specialization_aliases_school_id_idx" ON "specialization_aliases"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "specialization_aliases_school_id_canonical_alias_key" ON "specialization_aliases"("school_id", "canonical", "alias");

-- CreateIndex
CREATE INDEX "subjects_school_id_idx" ON "subjects"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subjects_school_code" ON "subjects"("school_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_employee_id" ON "faculty_mirrors"("employee_id");

-- CreateIndex
CREATE INDEX "faculty_mirrors_school_id_idx" ON "faculty_mirrors"("school_id");

-- CreateIndex
CREATE INDEX "faculty_mirrors_school_id_is_stale_idx" ON "faculty_mirrors"("school_id", "is_stale");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_school_external" ON "faculty_mirrors"("school_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_auth_accounts_email_key" ON "atlas_auth_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_employee_id" ON "atlas_auth_accounts"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_account_name" ON "atlas_auth_accounts"("account_name");

-- CreateIndex
CREATE INDEX "atlas_auth_accounts_school_id_role_idx" ON "atlas_auth_accounts"("school_id", "role");

-- CreateIndex
CREATE INDEX "atlas_auth_accounts_faculty_id_idx" ON "atlas_auth_accounts"("faculty_id");

-- CreateIndex
CREATE INDEX "faculty_subjects_school_id_school_year_id_idx" ON "faculty_subjects"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "faculty_subjects_faculty_id_idx" ON "faculty_subjects"("faculty_id");

-- CreateIndex
CREATE INDEX "faculty_subjects_subject_id_idx" ON "faculty_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_subject_year" ON "faculty_subjects"("faculty_id", "subject_id", "school_year_id");

-- CreateIndex
CREATE INDEX "subject_section_ownerships_faculty_subject_id_idx" ON "subject_section_ownerships"("faculty_subject_id");

-- CreateIndex
CREATE INDEX "subject_section_ownerships_school_id_school_year_id_subject_idx" ON "subject_section_ownerships"("school_id", "school_year_id", "subject_id");

-- CreateIndex
CREATE INDEX "subject_section_ownerships_faculty_id_idx" ON "subject_section_ownerships"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subject_section_owner_year" ON "subject_section_ownerships"("school_id", "school_year_id", "subject_id", "section_id");

-- CreateIndex
CREATE INDEX "teaching_load_cycles_school_id_school_year_id_state_idx" ON "teaching_load_cycles"("school_id", "school_year_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teaching_load_cycle" ON "teaching_load_cycles"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "idx_teaching_load_suggestion_scope_status" ON "teaching_load_suggestion_proposals"("school_id", "school_year_id", "status");

-- CreateIndex
CREATE INDEX "idx_teaching_load_suggestion_created_by" ON "teaching_load_suggestion_proposals"("created_by");

-- CreateIndex
CREATE INDEX "faculty_preferences_school_id_school_year_id_idx" ON "faculty_preferences"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "faculty_preferences_faculty_id_idx" ON "faculty_preferences"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_preference_school_year_faculty" ON "faculty_preferences"("school_id", "school_year_id", "faculty_id");

-- CreateIndex
CREATE INDEX "preference_time_slots_preference_id_idx" ON "preference_time_slots"("preference_id");

-- CreateIndex
CREATE INDEX "preference_reviews_reviewer_id_idx" ON "preference_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "preference_reviews_review_status_idx" ON "preference_reviews"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_preference_review" ON "preference_reviews"("preference_id");

-- CreateIndex
CREATE INDEX "faculty_room_preferences_school_id_school_year_id_status_idx" ON "faculty_room_preferences"("school_id", "school_year_id", "status");

-- CreateIndex
CREATE INDEX "faculty_room_preferences_school_id_school_year_id_decision__idx" ON "faculty_room_preferences"("school_id", "school_year_id", "decision_status");

-- CreateIndex
CREATE INDEX "faculty_room_preferences_run_id_faculty_id_idx" ON "faculty_room_preferences"("run_id", "faculty_id");

-- CreateIndex
CREATE INDEX "faculty_room_preferences_requested_room_id_day_start_time_idx" ON "faculty_room_preferences"("requested_room_id", "day", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "uq_room_preference_run_entry" ON "faculty_room_preferences"("run_id", "entry_id");

-- CreateIndex
CREATE INDEX "room_request_appeals_school_id_school_year_id_run_id_idx" ON "room_request_appeals"("school_id", "school_year_id", "run_id");

-- CreateIndex
CREATE INDEX "room_request_appeals_request_id_idx" ON "room_request_appeals"("request_id");

-- CreateIndex
CREATE INDEX "room_request_appeals_requester_id_idx" ON "room_request_appeals"("requester_id");

-- CreateIndex
CREATE INDEX "room_request_appeal_history_appeal_id_created_at_idx" ON "room_request_appeal_history"("appeal_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_policies_school_id_school_year_id_key" ON "scheduling_policies"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "idx_policy_special_events_scope" ON "policy_special_events"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "generation_runs_school_id_school_year_id_createdAt_idx" ON "generation_runs"("school_id", "school_year_id", "createdAt");

-- CreateIndex
CREATE INDEX "generation_runs_status_idx" ON "generation_runs"("status");

-- CreateIndex
CREATE INDEX "manual_schedule_edits_run_id_createdAt_idx" ON "manual_schedule_edits"("run_id", "createdAt");

-- CreateIndex
CREATE INDEX "manual_schedule_edits_school_id_school_year_id_idx" ON "manual_schedule_edits"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_school_id_school_year_id_effec_idx" ON "published_schedule_revisions"("school_id", "school_year_id", "effective_date");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_source_run_id_effective_date_idx" ON "published_schedule_revisions"("source_run_id", "effective_date");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_source_revision_id_idx" ON "published_schedule_revisions"("source_revision_id");

-- CreateIndex
CREATE INDEX "published_schedule_revisions_status_idx" ON "published_schedule_revisions"("status");

-- CreateIndex
CREATE INDEX "audit_logs_school_id_action_idx" ON "audit_logs"("school_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "follow_up_flags_run_id_idx" ON "follow_up_flags"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_flags_run_id_entry_id_key" ON "follow_up_flags"("run_id", "entry_id");

-- CreateIndex
CREATE INDEX "locked_sessions_school_id_school_year_id_idx" ON "locked_sessions"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "locked_sessions_school_id_school_year_id_status_idx" ON "locked_sessions"("school_id", "school_year_id", "status");

-- CreateIndex
CREATE INDEX "locked_sessions_locked_run_id_idx" ON "locked_sessions"("locked_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_locked_session" ON "locked_sessions"("school_id", "school_year_id", "entry_kind", "section_id", "subject_id", "cohort_code", "day", "start_time");

-- CreateIndex
CREATE INDEX "locked_session_actions_lock_id_createdAt_idx" ON "locked_session_actions"("lock_id", "createdAt");

-- CreateIndex
CREATE INDEX "locked_session_actions_school_id_school_year_id_createdAt_idx" ON "locked_session_actions"("school_id", "school_year_id", "createdAt");

-- CreateIndex
CREATE INDEX "grade_shift_windows_school_id_school_year_id_idx" ON "grade_shift_windows"("school_id", "school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grade_shift_window" ON "grade_shift_windows"("school_id", "school_year_id", "grade_level", "program_type");

-- CreateIndex
CREATE INDEX "faculty_snapshots_school_id_fetched_at_idx" ON "faculty_snapshots"("school_id", "fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_snapshot_school_year" ON "faculty_snapshots"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "section_snapshots_school_id_fetched_at_idx" ON "section_snapshots"("school_id", "fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_section_snapshot_school_year" ON "section_snapshots"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "instructional_cohorts_school_id_school_year_id_grade_level_idx" ON "instructional_cohorts"("school_id", "school_year_id", "grade_level");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cohort_code" ON "instructional_cohorts"("school_id", "school_year_id", "cohort_code");

-- CreateIndex
CREATE INDEX "class_templates_school_id_idx" ON "class_templates"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_class_template_school_program" ON "class_templates"("school_id", "program_type");

-- CreateIndex
CREATE INDEX "class_template_subjects_template_id_idx" ON "class_template_subjects"("template_id");

-- CreateIndex
CREATE INDEX "class_template_subjects_subject_id_idx" ON "class_template_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_template_subject" ON "class_template_subjects"("template_id", "subject_id");

-- CreateIndex
CREATE INDEX "class_program_slots_school_id_school_year_id_grade_level_pr_idx" ON "class_program_slots"("school_id", "school_year_id", "grade_level", "program_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_class_program_slot" ON "class_program_slots"("school_id", "school_year_id", "grade_level", "program_type", "day_of_week", "start_time", "row_kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_term_config_school_year" ON "school_year_term_configs"("school_id", "school_year_id");

-- CreateIndex
CREATE INDEX "idx_offering_demand" ON "school_year_offerings"("school_id", "school_year_id", "is_active", "grade_level", "program_type");

-- CreateIndex
CREATE INDEX "idx_offering_subject" ON "school_year_offerings"("subjectId");

-- CreateIndex
CREATE INDEX "idx_offering_section" ON "school_year_offerings"("school_id", "school_year_id", "section_mirror_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_offering_scope" ON "school_year_offerings"("school_id", "school_year_id", "subjectId", "grade_level", "program_type", "section_mirror_id", "cohort_id", "rotation_family");

-- CreateIndex
CREATE INDEX "idx_offering_term_assignments" ON "offering_term_assignments"("term_identity");

-- CreateIndex
CREATE UNIQUE INDEX "uq_offering_term_assignment" ON "offering_term_assignments"("offering_id", "term_identity");

-- CreateIndex
CREATE UNIQUE INDEX "uq_department_alias_school_alias" ON "department_aliases"("school_id", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "uq_department_label_school_code" ON "department_labels"("school_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subject_owner_prefix_school_prefix" ON "subject_owner_prefixes"("school_id", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "uq_program_scope_rule" ON "program_scope_rules"("school_id", "subject_id", "program_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cross_dept_permission" ON "cross_department_permissions"("school_id", "faculty_id", "subject_id");

-- AddForeignKey
ALTER TABLE "enrollpro_school_year_mirrors" ADD CONSTRAINT "enrollpro_school_year_mirrors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_mirrors" ADD CONSTRAINT "section_mirrors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialization_aliases" ADD CONSTRAINT "specialization_aliases_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_mirrors" ADD CONSTRAINT "faculty_mirrors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_auth_accounts" ADD CONSTRAINT "atlas_auth_accounts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_auth_accounts" ADD CONSTRAINT "atlas_auth_accounts_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_subjects" ADD CONSTRAINT "faculty_subjects_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_subjects" ADD CONSTRAINT "faculty_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_section_ownerships" ADD CONSTRAINT "subject_section_ownerships_faculty_subject_id_fkey" FOREIGN KEY ("faculty_subject_id") REFERENCES "faculty_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_load_cycles" ADD CONSTRAINT "teaching_load_cycles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_load_suggestion_proposals" ADD CONSTRAINT "teaching_load_suggestion_proposals_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_preferences" ADD CONSTRAINT "faculty_preferences_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_time_slots" ADD CONSTRAINT "preference_time_slots_preference_id_fkey" FOREIGN KEY ("preference_id") REFERENCES "faculty_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_reviews" ADD CONSTRAINT "preference_reviews_preference_id_fkey" FOREIGN KEY ("preference_id") REFERENCES "faculty_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_room_preferences" ADD CONSTRAINT "faculty_room_preferences_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_room_preferences" ADD CONSTRAINT "faculty_room_preferences_requested_room_id_fkey" FOREIGN KEY ("requested_room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_room_preferences" ADD CONSTRAINT "faculty_room_preferences_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_appeals" ADD CONSTRAINT "room_request_appeals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "faculty_room_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_appeals" ADD CONSTRAINT "room_request_appeals_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_appeal_history" ADD CONSTRAINT "room_request_appeal_history_appeal_id_fkey" FOREIGN KEY ("appeal_id") REFERENCES "room_request_appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_schedule_edits" ADD CONSTRAINT "manual_schedule_edits_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_schedule_revisions" ADD CONSTRAINT "published_schedule_revisions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_schedule_revisions" ADD CONSTRAINT "published_schedule_revisions_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "generation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_schedule_revisions" ADD CONSTRAINT "published_schedule_revisions_source_revision_id_fkey" FOREIGN KEY ("source_revision_id") REFERENCES "published_schedule_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locked_session_actions" ADD CONSTRAINT "locked_session_actions_lock_id_fkey" FOREIGN KEY ("lock_id") REFERENCES "locked_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_template_subjects" ADD CONSTRAINT "class_template_subjects_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "class_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_template_subjects" ADD CONSTRAINT "class_template_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_program_slots" ADD CONSTRAINT "class_program_slots_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_year_term_configs" ADD CONSTRAINT "school_year_term_configs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_year_offerings" ADD CONSTRAINT "school_year_offerings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_year_offerings" ADD CONSTRAINT "school_year_offerings_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_year_offerings" ADD CONSTRAINT "school_year_offerings_term_config_id_fkey" FOREIGN KEY ("term_config_id") REFERENCES "school_year_term_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_term_assignments" ADD CONSTRAINT "offering_term_assignments_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "school_year_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_aliases" ADD CONSTRAINT "department_aliases_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_labels" ADD CONSTRAINT "department_labels_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_owner_prefixes" ADD CONSTRAINT "subject_owner_prefixes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_scope_rules" ADD CONSTRAINT "program_scope_rules_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_scope_rules" ADD CONSTRAINT "program_scope_rules_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_department_permissions" ADD CONSTRAINT "cross_department_permissions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_department_permissions" ADD CONSTRAINT "cross_department_permissions_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_department_permissions" ADD CONSTRAINT "cross_department_permissions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

