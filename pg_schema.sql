--
-- PostgreSQL database dump
--

\restrict 3dPgA3Gym2P2gdcBnJC8aMOLVS1ae4n88YoICPQhIONMcWt65gimxhXJ0Ih48rm

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: atlas_user
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO atlas_user;
















SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: atlas_auth_accounts; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.atlas_auth_accounts (
    id integer NOT NULL,
    school_id integer NOT NULL,
    faculty_id integer,
    email character varying(254) NOT NULL,
    role character varying(32) NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    failed_login_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp(3) without time zone,
    last_login_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    account_name text,
    employee_id character varying(7)
);


ALTER TABLE public.atlas_auth_accounts OWNER TO atlas_user;

--
-- Name: atlas_auth_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.atlas_auth_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.atlas_auth_accounts_id_seq OWNER TO atlas_user;

--
-- Name: atlas_auth_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.atlas_auth_accounts_id_seq OWNED BY public.atlas_auth_accounts.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer,
    action character varying(50) NOT NULL,
    actor_id integer NOT NULL,
    target_ids integer[],
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO atlas_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO atlas_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: buildings; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.buildings (
    id integer NOT NULL,
    school_id integer NOT NULL,
    name text NOT NULL,
    short_code character varying(20),
    x double precision DEFAULT 0 NOT NULL,
    y double precision DEFAULT 0 NOT NULL,
    width double precision DEFAULT 200 NOT NULL,
    height double precision DEFAULT 120 NOT NULL,
    rotation double precision DEFAULT 0 NOT NULL,
    color text DEFAULT '#2563eb'::text NOT NULL,
    floor_count integer DEFAULT 1 NOT NULL,
    is_teaching_building boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.buildings OWNER TO atlas_user;

--
-- Name: buildings_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.buildings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.buildings_id_seq OWNER TO atlas_user;

--
-- Name: buildings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.buildings_id_seq OWNED BY public.buildings.id;


--
-- Name: class_template_subjects; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.class_template_subjects (
    id integer NOT NULL,
    template_id integer NOT NULL,
    subject_id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.class_template_subjects OWNER TO atlas_user;

--
-- Name: class_template_subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.class_template_subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.class_template_subjects_id_seq OWNER TO atlas_user;

--
-- Name: class_template_subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.class_template_subjects_id_seq OWNED BY public.class_template_subjects.id;


--
-- Name: class_templates; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.class_templates (
    id integer NOT NULL,
    school_id integer NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    program_type public.program_type NOT NULL,
    grade_applicability integer[],
    period_length_minutes integer DEFAULT 50 NOT NULL,
    periods_per_day integer DEFAULT 8 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.class_templates OWNER TO atlas_user;

--
-- Name: class_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.class_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.class_templates_id_seq OWNER TO atlas_user;

--
-- Name: class_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.class_templates_id_seq OWNED BY public.class_templates.id;


--
-- Name: faculty_mirrors; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.faculty_mirrors (
    id integer NOT NULL,
    external_id integer NOT NULL,
    school_id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    department text,
    specialization text,
    employment_status text DEFAULT 'PERMANENT'::text NOT NULL,
    contact_info text,
    avatar_url text,
    local_notes text,
    is_active_for_scheduling boolean DEFAULT true NOT NULL,
    is_class_adviser boolean DEFAULT false NOT NULL,
    advisory_equivalent_hours integer DEFAULT 0 NOT NULL,
    can_teach_outside_department boolean DEFAULT false NOT NULL,
    max_hours_per_week integer DEFAULT 30 NOT NULL,
    last_synced_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_stale boolean DEFAULT false NOT NULL,
    stale_reason text,
    stale_at timestamp(3) without time zone,
    advised_section_id integer,
    advised_section_name text,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    employee_id character varying(7)
);


ALTER TABLE public.faculty_mirrors OWNER TO atlas_user;

--
-- Name: faculty_mirrors_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.faculty_mirrors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faculty_mirrors_id_seq OWNER TO atlas_user;

--
-- Name: faculty_mirrors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.faculty_mirrors_id_seq OWNED BY public.faculty_mirrors.id;


--
-- Name: faculty_preferences; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.faculty_preferences (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    faculty_id integer NOT NULL,
    status public.preference_status DEFAULT 'DRAFT'::public.preference_status NOT NULL,
    notes text,
    submitted_at timestamp(3) without time zone,
    version integer DEFAULT 1 NOT NULL,
    pregnancy_support boolean DEFAULT false NOT NULL,
    physical_ailment_support boolean DEFAULT false NOT NULL,
    minimize_travel_time boolean DEFAULT false NOT NULL,
    avoid_upper_floors boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.faculty_preferences OWNER TO atlas_user;

--
-- Name: faculty_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.faculty_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faculty_preferences_id_seq OWNER TO atlas_user;

--
-- Name: faculty_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.faculty_preferences_id_seq OWNED BY public.faculty_preferences.id;


--
-- Name: faculty_room_preferences; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.faculty_room_preferences (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    run_id integer NOT NULL,
    entry_id character varying(64) NOT NULL,
    faculty_id integer NOT NULL,
    subject_id integer NOT NULL,
    section_id integer NOT NULL,
    current_room_id integer NOT NULL,
    requested_room_id integer NOT NULL,
    day public.day_of_week NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    rationale text,
    status public.room_preference_status DEFAULT 'DRAFT'::public.room_preference_status NOT NULL,
    submitted_at timestamp(3) without time zone,
    version integer DEFAULT 1 NOT NULL,
    reviewer_id integer,
    decision_status public.room_preference_decision_status DEFAULT 'PENDING'::public.room_preference_decision_status NOT NULL,
    reviewer_notes text,
    reviewed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.faculty_room_preferences OWNER TO atlas_user;

--
-- Name: faculty_room_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.faculty_room_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faculty_room_preferences_id_seq OWNER TO atlas_user;

--
-- Name: faculty_room_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.faculty_room_preferences_id_seq OWNED BY public.faculty_room_preferences.id;


--
-- Name: faculty_snapshots; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.faculty_snapshots (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    fetched_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source text DEFAULT 'enrollpro'::text NOT NULL,
    checksum text,
    schema_version integer DEFAULT 1 NOT NULL,
    payload jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.faculty_snapshots OWNER TO atlas_user;

--
-- Name: faculty_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.faculty_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faculty_snapshots_id_seq OWNER TO atlas_user;

--
-- Name: faculty_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.faculty_snapshots_id_seq OWNED BY public.faculty_snapshots.id;


--
-- Name: faculty_subjects; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.faculty_subjects (
    id integer NOT NULL,
    faculty_id integer NOT NULL,
    subject_id integer NOT NULL,
    school_id integer NOT NULL,
    grade_levels integer[],
    section_ids integer[] DEFAULT ARRAY[]::integer[],
    assigned_by integer NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.faculty_subjects OWNER TO atlas_user;

--
-- Name: faculty_subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.faculty_subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faculty_subjects_id_seq OWNER TO atlas_user;

--
-- Name: faculty_subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.faculty_subjects_id_seq OWNED BY public.faculty_subjects.id;


--
-- Name: follow_up_flags; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.follow_up_flags (
    id integer NOT NULL,
    run_id integer NOT NULL,
    entry_id character varying(64) NOT NULL,
    note text,
    created_by integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.follow_up_flags OWNER TO atlas_user;

--
-- Name: follow_up_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.follow_up_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.follow_up_flags_id_seq OWNER TO atlas_user;

--
-- Name: follow_up_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.follow_up_flags_id_seq OWNED BY public.follow_up_flags.id;


--
-- Name: generation_runs; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.generation_runs (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    status public.generation_run_status DEFAULT 'QUEUED'::public.generation_run_status NOT NULL,
    run_type character varying(20) DEFAULT 'FULL'::text NOT NULL,
    triggered_by integer NOT NULL,
    started_at timestamp(3) without time zone,
    finished_at timestamp(3) without time zone,
    duration_ms integer,
    summary jsonb,
    violations jsonb,
    draft_entries jsonb,
    unassigned_items jsonb,
    error text,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.generation_runs OWNER TO atlas_user;

--
-- Name: generation_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.generation_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.generation_runs_id_seq OWNER TO atlas_user;

--
-- Name: generation_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.generation_runs_id_seq OWNED BY public.generation_runs.id;


--
-- Name: grade_shift_windows; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.grade_shift_windows (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    grade_level integer NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.grade_shift_windows OWNER TO atlas_user;

--
-- Name: grade_shift_windows_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.grade_shift_windows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grade_shift_windows_id_seq OWNER TO atlas_user;

--
-- Name: grade_shift_windows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.grade_shift_windows_id_seq OWNED BY public.grade_shift_windows.id;


--
-- Name: instructional_cohorts; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.instructional_cohorts (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    cohort_code character varying(50) NOT NULL,
    specialization_code character varying(20) NOT NULL,
    specialization_name text NOT NULL,
    grade_level integer NOT NULL,
    member_section_ids integer[],
    expected_enrollment integer DEFAULT 0 NOT NULL,
    preferred_room_type public.room_type,
    is_active boolean DEFAULT true NOT NULL,
    source_ref text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.instructional_cohorts OWNER TO atlas_user;

--
-- Name: instructional_cohorts_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.instructional_cohorts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.instructional_cohorts_id_seq OWNER TO atlas_user;

--
-- Name: instructional_cohorts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.instructional_cohorts_id_seq OWNED BY public.instructional_cohorts.id;


--
-- Name: locked_session_actions; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.locked_session_actions (
    id integer NOT NULL,
    lock_id integer,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    actor_id integer NOT NULL,
    action_type character varying(50) NOT NULL,
    before_payload jsonb,
    after_payload jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.locked_session_actions OWNER TO atlas_user;

--
-- Name: locked_session_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.locked_session_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locked_session_actions_id_seq OWNER TO atlas_user;

--
-- Name: locked_session_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.locked_session_actions_id_seq OWNED BY public.locked_session_actions.id;


--
-- Name: locked_sessions; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.locked_sessions (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    entry_kind public.pre_generation_draft_entry_kind DEFAULT 'SECTION'::public.pre_generation_draft_entry_kind NOT NULL,
    section_id integer NOT NULL,
    subject_id integer NOT NULL,
    faculty_id integer,
    room_id integer,
    cohort_code character varying(50),
    status public.pre_generation_draft_status DEFAULT 'DRAFT'::public.pre_generation_draft_status NOT NULL,
    locked_run_id integer,
    notes text,
    version integer DEFAULT 1 NOT NULL,
    day public.day_of_week NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    created_by integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.locked_sessions OWNER TO atlas_user;

--
-- Name: locked_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.locked_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locked_sessions_id_seq OWNER TO atlas_user;

--
-- Name: locked_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.locked_sessions_id_seq OWNED BY public.locked_sessions.id;


--
-- Name: manual_schedule_edits; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.manual_schedule_edits (
    id integer NOT NULL,
    run_id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    actor_id integer NOT NULL,
    edit_type public.manual_edit_type NOT NULL,
    before_payload jsonb NOT NULL,
    after_payload jsonb NOT NULL,
    validation_summary jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.manual_schedule_edits OWNER TO atlas_user;

--
-- Name: manual_schedule_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.manual_schedule_edits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.manual_schedule_edits_id_seq OWNER TO atlas_user;

--
-- Name: manual_schedule_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.manual_schedule_edits_id_seq OWNED BY public.manual_schedule_edits.id;


--
-- Name: preference_reviews; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.preference_reviews (
    id integer NOT NULL,
    preference_id integer NOT NULL,
    reviewer_id integer NOT NULL,
    review_status public.review_status DEFAULT 'PENDING'::public.review_status NOT NULL,
    reviewer_notes text,
    reviewed_at timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.preference_reviews OWNER TO atlas_user;

--
-- Name: preference_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.preference_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.preference_reviews_id_seq OWNER TO atlas_user;

--
-- Name: preference_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.preference_reviews_id_seq OWNED BY public.preference_reviews.id;


--
-- Name: preference_time_slots; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.preference_time_slots (
    id integer NOT NULL,
    preference_id integer NOT NULL,
    day public.day_of_week NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    preference public.time_slot_preference DEFAULT 'AVAILABLE'::public.time_slot_preference NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.preference_time_slots OWNER TO atlas_user;

--
-- Name: preference_time_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.preference_time_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.preference_time_slots_id_seq OWNER TO atlas_user;

--
-- Name: preference_time_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.preference_time_slots_id_seq OWNED BY public.preference_time_slots.id;


--
-- Name: room_request_appeal_history; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.room_request_appeal_history (
    id integer NOT NULL,
    appeal_id integer NOT NULL,
    actor_id integer NOT NULL,
    action public.room_request_appeal_history_action NOT NULL,
    from_status public.room_request_appeal_status,
    to_status public.room_request_appeal_status,
    note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.room_request_appeal_history OWNER TO atlas_user;

--
-- Name: room_request_appeal_history_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.room_request_appeal_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.room_request_appeal_history_id_seq OWNER TO atlas_user;

--
-- Name: room_request_appeal_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.room_request_appeal_history_id_seq OWNED BY public.room_request_appeal_history.id;


--
-- Name: room_request_appeals; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.room_request_appeals (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    run_id integer NOT NULL,
    request_id integer NOT NULL,
    requester_id integer NOT NULL,
    reason text NOT NULL,
    status public.room_request_appeal_status DEFAULT 'OPEN'::public.room_request_appeal_status NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.room_request_appeals OWNER TO atlas_user;

--
-- Name: room_request_appeals_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.room_request_appeals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.room_request_appeals_id_seq OWNER TO atlas_user;

--
-- Name: room_request_appeals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.room_request_appeals_id_seq OWNED BY public.room_request_appeals.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.rooms (
    id integer NOT NULL,
    building_id integer NOT NULL,
    name text NOT NULL,
    floor integer DEFAULT 1 NOT NULL,
    type public.room_type DEFAULT 'CLASSROOM'::public.room_type NOT NULL,
    capacity integer,
    is_teaching_space boolean DEFAULT true NOT NULL,
    floor_position integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    features text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public.rooms OWNER TO atlas_user;

--
-- Name: rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rooms_id_seq OWNER TO atlas_user;

--
-- Name: rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.rooms_id_seq OWNED BY public.rooms.id;


--
-- Name: scheduling_policies; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.scheduling_policies (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    teacher_move_enabled boolean DEFAULT true NOT NULL,
    max_consecutive_teaching_minutes_before_break integer DEFAULT 120 CONSTRAINT scheduling_policies_max_consecutive_teaching_minutes_b_not_null NOT NULL,
    min_break_minutes_after_consecutive_block integer DEFAULT 15 CONSTRAINT scheduling_policies_min_break_minutes_after_consecutiv_not_null NOT NULL,
    max_teaching_minutes_per_day integer DEFAULT 400 NOT NULL,
    earliest_start_time text DEFAULT '07:00'::text NOT NULL,
    latest_end_time text DEFAULT '17:00'::text NOT NULL,
    enforce_consecutive_break_as_hard boolean DEFAULT false NOT NULL,
    enable_travel_wellbeing_checks boolean DEFAULT true NOT NULL,
    max_walking_distance_meters_per_transition integer DEFAULT 120 CONSTRAINT scheduling_policies_max_walking_distance_meters_per_tr_not_null NOT NULL,
    max_building_transitions_per_day integer DEFAULT 4 NOT NULL,
    max_back_to_back_transitions_without_buffer integer DEFAULT 2 CONSTRAINT scheduling_policies_max_back_to_back_transitions_witho_not_null NOT NULL,
    max_idle_gap_minutes_per_day integer DEFAULT 60 NOT NULL,
    avoid_early_first_period boolean DEFAULT false NOT NULL,
    avoid_late_last_period boolean DEFAULT false NOT NULL,
    enable_vacant_aware_constraints boolean DEFAULT false NOT NULL,
    target_faculty_daily_vacant_minutes integer DEFAULT 60 CONSTRAINT scheduling_policies_target_faculty_daily_vacant_minute_not_null NOT NULL,
    target_section_daily_vacant_periods integer DEFAULT 1 CONSTRAINT scheduling_policies_target_section_daily_vacant_period_not_null NOT NULL,
    max_compressed_teaching_minutes_per_day integer DEFAULT 300 CONSTRAINT scheduling_policies_max_compressed_teaching_minutes_pe_not_null NOT NULL,
    lunch_start_time text DEFAULT '11:55'::text NOT NULL,
    lunch_end_time text DEFAULT '12:55'::text NOT NULL,
    enforce_lunch_window boolean DEFAULT true NOT NULL,
    show_special_events_in_grid boolean DEFAULT true NOT NULL,
    enable_flag_ceremony boolean DEFAULT true NOT NULL,
    flag_ceremony_start_time text DEFAULT '07:00'::text NOT NULL,
    flag_ceremony_end_time text DEFAULT '07:30'::text NOT NULL,
    enable_recess boolean DEFAULT true NOT NULL,
    recess_start_time text DEFAULT '09:45'::text NOT NULL,
    recess_end_time text DEFAULT '10:00'::text NOT NULL,
    enable_lunch_window boolean DEFAULT true NOT NULL,
    enable_tle_two_pass_priority boolean DEFAULT true NOT NULL,
    allow_flexible_subject_assignment boolean DEFAULT false NOT NULL,
    allow_consecutive_lab_sessions boolean DEFAULT false NOT NULL,
    constraint_config jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.scheduling_policies OWNER TO atlas_user;

--
-- Name: scheduling_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.scheduling_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduling_policies_id_seq OWNER TO atlas_user;

--
-- Name: scheduling_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.scheduling_policies_id_seq OWNED BY public.scheduling_policies.id;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.schools (
    id integer NOT NULL,
    name text NOT NULL,
    "shortName" character varying(50) NOT NULL,
    campus_image_url text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.schools OWNER TO atlas_user;

--
-- Name: schools_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.schools_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schools_id_seq OWNER TO atlas_user;

--
-- Name: schools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.schools_id_seq OWNED BY public.schools.id;


--
-- Name: section_mirrors; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.section_mirrors (
    id integer NOT NULL,
    external_id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    name text NOT NULL,
    grade_level_id integer NOT NULL,
    grade_level_name text NOT NULL,
    display_order integer NOT NULL,
    max_capacity integer NOT NULL,
    enrolled_count integer NOT NULL,
    program_type text,
    program_code text,
    program_name text,
    is_special_program boolean DEFAULT false NOT NULL,
    is_active_for_scheduling boolean DEFAULT true NOT NULL,
    preferred_room_id integer,
    last_synced_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_stale boolean DEFAULT false NOT NULL,
    stale_reason text,
    stale_at timestamp(3) without time zone,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.section_mirrors OWNER TO atlas_user;

--
-- Name: section_mirrors_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.section_mirrors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.section_mirrors_id_seq OWNER TO atlas_user;

--
-- Name: section_mirrors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.section_mirrors_id_seq OWNED BY public.section_mirrors.id;


--
-- Name: section_snapshots; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.section_snapshots (
    id integer NOT NULL,
    school_id integer NOT NULL,
    school_year_id integer NOT NULL,
    fetched_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source text DEFAULT 'enrollpro'::text NOT NULL,
    checksum text,
    schema_version integer DEFAULT 1 NOT NULL,
    payload jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.section_snapshots OWNER TO atlas_user;

--
-- Name: section_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.section_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.section_snapshots_id_seq OWNER TO atlas_user;

--
-- Name: section_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.section_snapshots_id_seq OWNED BY public.section_snapshots.id;


--
-- Name: specialization_aliases; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.specialization_aliases (
    id integer NOT NULL,
    school_id integer NOT NULL,
    canonical text NOT NULL,
    alias text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.specialization_aliases OWNER TO atlas_user;

--
-- Name: specialization_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.specialization_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.specialization_aliases_id_seq OWNER TO atlas_user;

--
-- Name: specialization_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.specialization_aliases_id_seq OWNED BY public.specialization_aliases.id;


--
-- Name: subject_section_ownerships; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.subject_section_ownerships (
    id integer NOT NULL,
    school_id integer NOT NULL,
    faculty_subject_id integer NOT NULL,
    faculty_id integer NOT NULL,
    subject_id integer NOT NULL,
    section_id integer NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.subject_section_ownerships OWNER TO atlas_user;

--
-- Name: subject_section_ownerships_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.subject_section_ownerships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subject_section_ownerships_id_seq OWNER TO atlas_user;

--
-- Name: subject_section_ownerships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.subject_section_ownerships_id_seq OWNED BY public.subject_section_ownerships.id;


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: atlas_user
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    school_id integer NOT NULL,
    code character varying(32) NOT NULL,
    name text NOT NULL,
    min_minutes_per_week integer NOT NULL,
    preferred_room_type public.room_type DEFAULT 'CLASSROOM'::public.room_type NOT NULL,
    session_pattern public.session_pattern DEFAULT 'ANY'::public.session_pattern NOT NULL,
    grade_levels integer[],
    is_active boolean DEFAULT true NOT NULL,
    is_seedable boolean DEFAULT false NOT NULL,
    inter_section_enabled boolean DEFAULT false NOT NULL,
    inter_section_grade_levels integer[] DEFAULT ARRAY[]::integer[],
    program_scopes public.program_type[] DEFAULT ARRAY['REGULAR'::public.program_type],
    allowed_specializations text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    required_features text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public.subjects OWNER TO atlas_user;

--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: atlas_user
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_id_seq OWNER TO atlas_user;

--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: atlas_user
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: atlas_auth_accounts id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.atlas_auth_accounts ALTER COLUMN id SET DEFAULT nextval('public.atlas_auth_accounts_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: buildings id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.buildings ALTER COLUMN id SET DEFAULT nextval('public.buildings_id_seq'::regclass);


--
-- Name: class_template_subjects id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_template_subjects ALTER COLUMN id SET DEFAULT nextval('public.class_template_subjects_id_seq'::regclass);


--
-- Name: class_templates id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_templates ALTER COLUMN id SET DEFAULT nextval('public.class_templates_id_seq'::regclass);


--
-- Name: faculty_mirrors id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_mirrors ALTER COLUMN id SET DEFAULT nextval('public.faculty_mirrors_id_seq'::regclass);


--
-- Name: faculty_preferences id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_preferences ALTER COLUMN id SET DEFAULT nextval('public.faculty_preferences_id_seq'::regclass);


--
-- Name: faculty_room_preferences id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_room_preferences ALTER COLUMN id SET DEFAULT nextval('public.faculty_room_preferences_id_seq'::regclass);


--
-- Name: faculty_snapshots id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_snapshots ALTER COLUMN id SET DEFAULT nextval('public.faculty_snapshots_id_seq'::regclass);


--
-- Name: faculty_subjects id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_subjects ALTER COLUMN id SET DEFAULT nextval('public.faculty_subjects_id_seq'::regclass);


--
-- Name: follow_up_flags id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.follow_up_flags ALTER COLUMN id SET DEFAULT nextval('public.follow_up_flags_id_seq'::regclass);


--
-- Name: generation_runs id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.generation_runs ALTER COLUMN id SET DEFAULT nextval('public.generation_runs_id_seq'::regclass);


--
-- Name: grade_shift_windows id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.grade_shift_windows ALTER COLUMN id SET DEFAULT nextval('public.grade_shift_windows_id_seq'::regclass);


--
-- Name: instructional_cohorts id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.instructional_cohorts ALTER COLUMN id SET DEFAULT nextval('public.instructional_cohorts_id_seq'::regclass);


--
-- Name: locked_session_actions id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.locked_session_actions ALTER COLUMN id SET DEFAULT nextval('public.locked_session_actions_id_seq'::regclass);


--
-- Name: locked_sessions id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.locked_sessions ALTER COLUMN id SET DEFAULT nextval('public.locked_sessions_id_seq'::regclass);


--
-- Name: manual_schedule_edits id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.manual_schedule_edits ALTER COLUMN id SET DEFAULT nextval('public.manual_schedule_edits_id_seq'::regclass);


--
-- Name: preference_reviews id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.preference_reviews ALTER COLUMN id SET DEFAULT nextval('public.preference_reviews_id_seq'::regclass);


--
-- Name: preference_time_slots id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.preference_time_slots ALTER COLUMN id SET DEFAULT nextval('public.preference_time_slots_id_seq'::regclass);


--
-- Name: room_request_appeal_history id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeal_history ALTER COLUMN id SET DEFAULT nextval('public.room_request_appeal_history_id_seq'::regclass);


--
-- Name: room_request_appeals id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeals ALTER COLUMN id SET DEFAULT nextval('public.room_request_appeals_id_seq'::regclass);


--
-- Name: rooms id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.rooms ALTER COLUMN id SET DEFAULT nextval('public.rooms_id_seq'::regclass);


--
-- Name: scheduling_policies id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.scheduling_policies ALTER COLUMN id SET DEFAULT nextval('public.scheduling_policies_id_seq'::regclass);


--
-- Name: schools id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.schools ALTER COLUMN id SET DEFAULT nextval('public.schools_id_seq'::regclass);


--
-- Name: section_mirrors id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.section_mirrors ALTER COLUMN id SET DEFAULT nextval('public.section_mirrors_id_seq'::regclass);


--
-- Name: section_snapshots id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.section_snapshots ALTER COLUMN id SET DEFAULT nextval('public.section_snapshots_id_seq'::regclass);


--
-- Name: specialization_aliases id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.specialization_aliases ALTER COLUMN id SET DEFAULT nextval('public.specialization_aliases_id_seq'::regclass);


--
-- Name: subject_section_ownerships id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.subject_section_ownerships ALTER COLUMN id SET DEFAULT nextval('public.subject_section_ownerships_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: atlas_auth_accounts atlas_auth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.atlas_auth_accounts
    ADD CONSTRAINT atlas_auth_accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);


--
-- Name: class_template_subjects class_template_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_template_subjects
    ADD CONSTRAINT class_template_subjects_pkey PRIMARY KEY (id);


--
-- Name: class_templates class_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_templates
    ADD CONSTRAINT class_templates_pkey PRIMARY KEY (id);


--
-- Name: faculty_mirrors faculty_mirrors_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_mirrors
    ADD CONSTRAINT faculty_mirrors_pkey PRIMARY KEY (id);


--
-- Name: faculty_preferences faculty_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_preferences
    ADD CONSTRAINT faculty_preferences_pkey PRIMARY KEY (id);


--
-- Name: faculty_room_preferences faculty_room_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_room_preferences
    ADD CONSTRAINT faculty_room_preferences_pkey PRIMARY KEY (id);


--
-- Name: faculty_snapshots faculty_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_snapshots
    ADD CONSTRAINT faculty_snapshots_pkey PRIMARY KEY (id);


--
-- Name: faculty_subjects faculty_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_subjects
    ADD CONSTRAINT faculty_subjects_pkey PRIMARY KEY (id);


--
-- Name: follow_up_flags follow_up_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.follow_up_flags
    ADD CONSTRAINT follow_up_flags_pkey PRIMARY KEY (id);


--
-- Name: generation_runs generation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.generation_runs
    ADD CONSTRAINT generation_runs_pkey PRIMARY KEY (id);


--
-- Name: grade_shift_windows grade_shift_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.grade_shift_windows
    ADD CONSTRAINT grade_shift_windows_pkey PRIMARY KEY (id);


--
-- Name: instructional_cohorts instructional_cohorts_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.instructional_cohorts
    ADD CONSTRAINT instructional_cohorts_pkey PRIMARY KEY (id);


--
-- Name: locked_session_actions locked_session_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.locked_session_actions
    ADD CONSTRAINT locked_session_actions_pkey PRIMARY KEY (id);


--
-- Name: locked_sessions locked_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.locked_sessions
    ADD CONSTRAINT locked_sessions_pkey PRIMARY KEY (id);


--
-- Name: manual_schedule_edits manual_schedule_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.manual_schedule_edits
    ADD CONSTRAINT manual_schedule_edits_pkey PRIMARY KEY (id);


--
-- Name: preference_reviews preference_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.preference_reviews
    ADD CONSTRAINT preference_reviews_pkey PRIMARY KEY (id);


--
-- Name: preference_time_slots preference_time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.preference_time_slots
    ADD CONSTRAINT preference_time_slots_pkey PRIMARY KEY (id);


--
-- Name: room_request_appeal_history room_request_appeal_history_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeal_history
    ADD CONSTRAINT room_request_appeal_history_pkey PRIMARY KEY (id);


--
-- Name: room_request_appeals room_request_appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeals
    ADD CONSTRAINT room_request_appeals_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: scheduling_policies scheduling_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.scheduling_policies
    ADD CONSTRAINT scheduling_policies_pkey PRIMARY KEY (id);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: section_mirrors section_mirrors_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.section_mirrors
    ADD CONSTRAINT section_mirrors_pkey PRIMARY KEY (id);


--
-- Name: section_snapshots section_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.section_snapshots
    ADD CONSTRAINT section_snapshots_pkey PRIMARY KEY (id);


--
-- Name: specialization_aliases specialization_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.specialization_aliases
    ADD CONSTRAINT specialization_aliases_pkey PRIMARY KEY (id);


--
-- Name: subject_section_ownerships subject_section_ownerships_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.subject_section_ownerships
    ADD CONSTRAINT subject_section_ownerships_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: atlas_auth_accounts_email_key; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX atlas_auth_accounts_email_key ON public.atlas_auth_accounts USING btree (email);


--
-- Name: atlas_auth_accounts_faculty_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX atlas_auth_accounts_faculty_id_idx ON public.atlas_auth_accounts USING btree (faculty_id);


--
-- Name: atlas_auth_accounts_school_id_role_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX atlas_auth_accounts_school_id_role_idx ON public.atlas_auth_accounts USING btree (school_id, role);


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_school_id_action_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX audit_logs_school_id_action_idx ON public.audit_logs USING btree (school_id, action);


--
-- Name: class_template_subjects_subject_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX class_template_subjects_subject_id_idx ON public.class_template_subjects USING btree (subject_id);


--
-- Name: class_template_subjects_template_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX class_template_subjects_template_id_idx ON public.class_template_subjects USING btree (template_id);


--
-- Name: class_templates_school_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX class_templates_school_id_idx ON public.class_templates USING btree (school_id);


--
-- Name: faculty_mirrors_school_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_mirrors_school_id_idx ON public.faculty_mirrors USING btree (school_id);


--
-- Name: faculty_mirrors_school_id_is_stale_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_mirrors_school_id_is_stale_idx ON public.faculty_mirrors USING btree (school_id, is_stale);


--
-- Name: faculty_preferences_faculty_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_preferences_faculty_id_idx ON public.faculty_preferences USING btree (faculty_id);


--
-- Name: faculty_preferences_school_id_school_year_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_preferences_school_id_school_year_id_idx ON public.faculty_preferences USING btree (school_id, school_year_id);


--
-- Name: faculty_room_preferences_requested_room_id_day_start_time_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_room_preferences_requested_room_id_day_start_time_idx ON public.faculty_room_preferences USING btree (requested_room_id, day, start_time);


--
-- Name: faculty_room_preferences_run_id_faculty_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_room_preferences_run_id_faculty_id_idx ON public.faculty_room_preferences USING btree (run_id, faculty_id);


--
-- Name: faculty_room_preferences_school_id_school_year_id_decision__idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_room_preferences_school_id_school_year_id_decision__idx ON public.faculty_room_preferences USING btree (school_id, school_year_id, decision_status);


--
-- Name: faculty_room_preferences_school_id_school_year_id_status_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_room_preferences_school_id_school_year_id_status_idx ON public.faculty_room_preferences USING btree (school_id, school_year_id, status);


--
-- Name: faculty_snapshots_school_id_fetched_at_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_snapshots_school_id_fetched_at_idx ON public.faculty_snapshots USING btree (school_id, fetched_at);


--
-- Name: faculty_subjects_faculty_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_subjects_faculty_id_idx ON public.faculty_subjects USING btree (faculty_id);


--
-- Name: faculty_subjects_school_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_subjects_school_id_idx ON public.faculty_subjects USING btree (school_id);


--
-- Name: faculty_subjects_subject_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX faculty_subjects_subject_id_idx ON public.faculty_subjects USING btree (subject_id);


--
-- Name: follow_up_flags_run_id_entry_id_key; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX follow_up_flags_run_id_entry_id_key ON public.follow_up_flags USING btree (run_id, entry_id);


--
-- Name: follow_up_flags_run_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX follow_up_flags_run_id_idx ON public.follow_up_flags USING btree (run_id);


--
-- Name: generation_runs_school_id_school_year_id_createdAt_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX "generation_runs_school_id_school_year_id_createdAt_idx" ON public.generation_runs USING btree (school_id, school_year_id, "createdAt");


--
-- Name: generation_runs_status_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX generation_runs_status_idx ON public.generation_runs USING btree (status);


--
-- Name: grade_shift_windows_school_id_school_year_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX grade_shift_windows_school_id_school_year_id_idx ON public.grade_shift_windows USING btree (school_id, school_year_id);


--
-- Name: instructional_cohorts_school_id_school_year_id_grade_level_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX instructional_cohorts_school_id_school_year_id_grade_level_idx ON public.instructional_cohorts USING btree (school_id, school_year_id, grade_level);


--
-- Name: locked_session_actions_lock_id_createdAt_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX "locked_session_actions_lock_id_createdAt_idx" ON public.locked_session_actions USING btree (lock_id, "createdAt");


--
-- Name: locked_session_actions_school_id_school_year_id_createdAt_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX "locked_session_actions_school_id_school_year_id_createdAt_idx" ON public.locked_session_actions USING btree (school_id, school_year_id, "createdAt");


--
-- Name: locked_sessions_locked_run_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX locked_sessions_locked_run_id_idx ON public.locked_sessions USING btree (locked_run_id);


--
-- Name: locked_sessions_school_id_school_year_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX locked_sessions_school_id_school_year_id_idx ON public.locked_sessions USING btree (school_id, school_year_id);


--
-- Name: locked_sessions_school_id_school_year_id_status_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX locked_sessions_school_id_school_year_id_status_idx ON public.locked_sessions USING btree (school_id, school_year_id, status);


--
-- Name: manual_schedule_edits_run_id_createdAt_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX "manual_schedule_edits_run_id_createdAt_idx" ON public.manual_schedule_edits USING btree (run_id, "createdAt");


--
-- Name: manual_schedule_edits_school_id_school_year_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX manual_schedule_edits_school_id_school_year_id_idx ON public.manual_schedule_edits USING btree (school_id, school_year_id);


--
-- Name: preference_reviews_review_status_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX preference_reviews_review_status_idx ON public.preference_reviews USING btree (review_status);


--
-- Name: preference_reviews_reviewer_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX preference_reviews_reviewer_id_idx ON public.preference_reviews USING btree (reviewer_id);


--
-- Name: preference_time_slots_preference_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX preference_time_slots_preference_id_idx ON public.preference_time_slots USING btree (preference_id);


--
-- Name: room_request_appeal_history_appeal_id_created_at_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX room_request_appeal_history_appeal_id_created_at_idx ON public.room_request_appeal_history USING btree (appeal_id, created_at);


--
-- Name: room_request_appeals_request_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX room_request_appeals_request_id_idx ON public.room_request_appeals USING btree (request_id);


--
-- Name: room_request_appeals_requester_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX room_request_appeals_requester_id_idx ON public.room_request_appeals USING btree (requester_id);


--
-- Name: room_request_appeals_school_id_school_year_id_run_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX room_request_appeals_school_id_school_year_id_run_id_idx ON public.room_request_appeals USING btree (school_id, school_year_id, run_id);


--
-- Name: scheduling_policies_school_id_school_year_id_key; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX scheduling_policies_school_id_school_year_id_key ON public.scheduling_policies USING btree (school_id, school_year_id);


--
-- Name: section_mirrors_school_id_school_year_id_external_id_key; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX section_mirrors_school_id_school_year_id_external_id_key ON public.section_mirrors USING btree (school_id, school_year_id, external_id);


--
-- Name: section_mirrors_school_id_school_year_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX section_mirrors_school_id_school_year_id_idx ON public.section_mirrors USING btree (school_id, school_year_id);


--
-- Name: section_snapshots_school_id_fetched_at_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX section_snapshots_school_id_fetched_at_idx ON public.section_snapshots USING btree (school_id, fetched_at);


--
-- Name: specialization_aliases_school_id_canonical_alias_key; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX specialization_aliases_school_id_canonical_alias_key ON public.specialization_aliases USING btree (school_id, canonical, alias);


--
-- Name: specialization_aliases_school_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX specialization_aliases_school_id_idx ON public.specialization_aliases USING btree (school_id);


--
-- Name: subject_section_ownerships_faculty_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX subject_section_ownerships_faculty_id_idx ON public.subject_section_ownerships USING btree (faculty_id);


--
-- Name: subject_section_ownerships_faculty_subject_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX subject_section_ownerships_faculty_subject_id_idx ON public.subject_section_ownerships USING btree (faculty_subject_id);


--
-- Name: subject_section_ownerships_school_id_subject_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX subject_section_ownerships_school_id_subject_id_idx ON public.subject_section_ownerships USING btree (school_id, subject_id);


--
-- Name: subjects_school_id_idx; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE INDEX subjects_school_id_idx ON public.subjects USING btree (school_id);


--
-- Name: uq_auth_account_name; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_auth_account_name ON public.atlas_auth_accounts USING btree (account_name);


--
-- Name: uq_auth_employee_id; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_auth_employee_id ON public.atlas_auth_accounts USING btree (employee_id);


--
-- Name: uq_class_template_school_program; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_class_template_school_program ON public.class_templates USING btree (school_id, program_type);


--
-- Name: uq_cohort_code; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_cohort_code ON public.instructional_cohorts USING btree (school_id, school_year_id, cohort_code);


--
-- Name: uq_faculty_employee_id; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_faculty_employee_id ON public.faculty_mirrors USING btree (employee_id);


--
-- Name: uq_faculty_school_external; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_faculty_school_external ON public.faculty_mirrors USING btree (school_id, external_id);


--
-- Name: uq_faculty_snapshot_school_year; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_faculty_snapshot_school_year ON public.faculty_snapshots USING btree (school_id, school_year_id);


--
-- Name: uq_faculty_subject; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_faculty_subject ON public.faculty_subjects USING btree (faculty_id, subject_id);


--
-- Name: uq_grade_shift_window; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_grade_shift_window ON public.grade_shift_windows USING btree (school_id, school_year_id, grade_level);


--
-- Name: uq_locked_session; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_locked_session ON public.locked_sessions USING btree (school_id, school_year_id, entry_kind, section_id, subject_id, cohort_code, day, start_time);


--
-- Name: uq_preference_review; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_preference_review ON public.preference_reviews USING btree (preference_id);


--
-- Name: uq_preference_school_year_faculty; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_preference_school_year_faculty ON public.faculty_preferences USING btree (school_id, school_year_id, faculty_id);


--
-- Name: uq_room_preference_run_entry; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_room_preference_run_entry ON public.faculty_room_preferences USING btree (run_id, entry_id);


--
-- Name: uq_section_snapshot_school_year; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_section_snapshot_school_year ON public.section_snapshots USING btree (school_id, school_year_id);


--
-- Name: uq_subject_section_owner; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_subject_section_owner ON public.subject_section_ownerships USING btree (school_id, subject_id, section_id);


--
-- Name: uq_subjects_school_code; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_subjects_school_code ON public.subjects USING btree (school_id, code);


--
-- Name: uq_template_subject; Type: INDEX; Schema: public; Owner: atlas_user
--

CREATE UNIQUE INDEX uq_template_subject ON public.class_template_subjects USING btree (template_id, subject_id);


--
-- Name: atlas_auth_accounts atlas_auth_accounts_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.atlas_auth_accounts
    ADD CONSTRAINT atlas_auth_accounts_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty_mirrors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: atlas_auth_accounts atlas_auth_accounts_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.atlas_auth_accounts
    ADD CONSTRAINT atlas_auth_accounts_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: buildings buildings_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_template_subjects class_template_subjects_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_template_subjects
    ADD CONSTRAINT class_template_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_template_subjects class_template_subjects_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_template_subjects
    ADD CONSTRAINT class_template_subjects_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.class_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_templates class_templates_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.class_templates
    ADD CONSTRAINT class_templates_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_mirrors faculty_mirrors_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_mirrors
    ADD CONSTRAINT faculty_mirrors_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_preferences faculty_preferences_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_preferences
    ADD CONSTRAINT faculty_preferences_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty_mirrors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_room_preferences faculty_room_preferences_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_room_preferences
    ADD CONSTRAINT faculty_room_preferences_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty_mirrors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_room_preferences faculty_room_preferences_requested_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_room_preferences
    ADD CONSTRAINT faculty_room_preferences_requested_room_id_fkey FOREIGN KEY (requested_room_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_room_preferences faculty_room_preferences_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_room_preferences
    ADD CONSTRAINT faculty_room_preferences_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.generation_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_subjects faculty_subjects_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_subjects
    ADD CONSTRAINT faculty_subjects_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty_mirrors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faculty_subjects faculty_subjects_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.faculty_subjects
    ADD CONSTRAINT faculty_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: locked_session_actions locked_session_actions_lock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.locked_session_actions
    ADD CONSTRAINT locked_session_actions_lock_id_fkey FOREIGN KEY (lock_id) REFERENCES public.locked_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: manual_schedule_edits manual_schedule_edits_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.manual_schedule_edits
    ADD CONSTRAINT manual_schedule_edits_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.generation_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: preference_reviews preference_reviews_preference_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.preference_reviews
    ADD CONSTRAINT preference_reviews_preference_id_fkey FOREIGN KEY (preference_id) REFERENCES public.faculty_preferences(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: preference_time_slots preference_time_slots_preference_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.preference_time_slots
    ADD CONSTRAINT preference_time_slots_preference_id_fkey FOREIGN KEY (preference_id) REFERENCES public.faculty_preferences(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_request_appeal_history room_request_appeal_history_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeal_history
    ADD CONSTRAINT room_request_appeal_history_appeal_id_fkey FOREIGN KEY (appeal_id) REFERENCES public.room_request_appeals(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_request_appeals room_request_appeals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeals
    ADD CONSTRAINT room_request_appeals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.faculty_room_preferences(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_request_appeals room_request_appeals_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.room_request_appeals
    ADD CONSTRAINT room_request_appeals_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.faculty_mirrors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rooms rooms_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: section_mirrors section_mirrors_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.section_mirrors
    ADD CONSTRAINT section_mirrors_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: specialization_aliases specialization_aliases_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.specialization_aliases
    ADD CONSTRAINT specialization_aliases_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subject_section_ownerships subject_section_ownerships_faculty_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.subject_section_ownerships
    ADD CONSTRAINT subject_section_ownerships_faculty_subject_id_fkey FOREIGN KEY (faculty_subject_id) REFERENCES public.faculty_subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subjects subjects_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: atlas_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: atlas_user
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict 3dPgA3Gym2P2gdcBnJC8aMOLVS1ae4n88YoICPQhIONMcWt65gimxhXJ0Ih48rm

