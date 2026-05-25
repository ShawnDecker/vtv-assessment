--
-- PostgreSQL database dump
--

\restrict CIegZH6EJjVqMmgIIKSaWku1fTIpUDyJ9dtVdChEA62bShmFx7caKeq5WItUnbL

-- Dumped from database version 17.8 (ad62774)
-- Dumped by pg_dump version 17.9

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_rules (
    id integer NOT NULL,
    agent_name text NOT NULL,
    rule_key text NOT NULL,
    rule_config jsonb DEFAULT '{}'::jsonb,
    weight double precision DEFAULT 1.0,
    times_fired integer DEFAULT 0,
    times_succeeded integer DEFAULT 0,
    last_fired_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: agent_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_rules_id_seq OWNED BY public.agent_rules.id;


--
-- Name: agent_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_state (
    id integer NOT NULL,
    agent_name text NOT NULL,
    run_at timestamp without time zone DEFAULT now(),
    observations jsonb DEFAULT '{}'::jsonb,
    decisions jsonb DEFAULT '{}'::jsonb,
    actions_taken jsonb DEFAULT '[]'::jsonb,
    outcome jsonb DEFAULT '{}'::jsonb,
    learning_updates jsonb DEFAULT '{}'::jsonb
);


--
-- Name: agent_state_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_state_id_seq OWNED BY public.agent_state.id;


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id integer NOT NULL,
    event_type text NOT NULL,
    contact_id integer,
    session_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_hash text,
    user_agent text,
    referrer text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: analytics_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analytics_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_events_id_seq OWNED BY public.analytics_events.id;


--
-- Name: answer_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answer_history (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    question_id text NOT NULL,
    answer_value integer NOT NULL,
    assessment_id integer,
    answered_at timestamp with time zone DEFAULT now()
);


--
-- Name: answer_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.answer_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: answer_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.answer_history_id_seq OWNED BY public.answer_history.id;


--
-- Name: assessment_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_progress (
    id integer NOT NULL,
    contact_id integer,
    answers jsonb DEFAULT '{}'::jsonb,
    current_question_index integer DEFAULT 0,
    mode text DEFAULT 'individual'::text,
    depth text DEFAULT 'extensive'::text,
    total_questions integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: assessment_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessment_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessment_progress_id_seq OWNED BY public.assessment_progress.id;


--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    completed_at text NOT NULL,
    mode text DEFAULT 'individual'::text NOT NULL,
    team_id integer,
    is_team_creator integer DEFAULT 0,
    time_awareness integer NOT NULL,
    time_allocation integer NOT NULL,
    time_protection integer NOT NULL,
    time_leverage integer NOT NULL,
    five_hour_leak integer NOT NULL,
    value_per_hour integer NOT NULL,
    time_investment integer NOT NULL,
    downtime_quality integer NOT NULL,
    foresight integer NOT NULL,
    time_reallocation integer NOT NULL,
    time_total integer NOT NULL,
    trust_investment integer NOT NULL,
    boundary_quality integer NOT NULL,
    network_depth integer NOT NULL,
    relational_roi integer NOT NULL,
    people_audit integer NOT NULL,
    alliance_building integer NOT NULL,
    love_bank_deposits integer NOT NULL,
    communication_clarity integer NOT NULL,
    restraint_practice integer NOT NULL,
    value_replacement integer NOT NULL,
    people_total integer NOT NULL,
    leadership_level integer NOT NULL,
    integrity_alignment integer NOT NULL,
    professional_credibility integer NOT NULL,
    empathetic_listening integer NOT NULL,
    gravitational_center integer NOT NULL,
    micro_honesties integer NOT NULL,
    word_management integer NOT NULL,
    personal_responsibility integer NOT NULL,
    adaptive_influence integer NOT NULL,
    influence_multiplier integer NOT NULL,
    influence_total integer NOT NULL,
    financial_awareness integer NOT NULL,
    goal_specificity integer NOT NULL,
    investment_logic integer NOT NULL,
    measurement_habit integer NOT NULL,
    cost_vs_value integer NOT NULL,
    number_one_clarity integer NOT NULL,
    small_improvements integer NOT NULL,
    negative_math integer NOT NULL,
    income_multiplier integer NOT NULL,
    negotiation_skill integer NOT NULL,
    numbers_total integer NOT NULL,
    learning_hours integer NOT NULL,
    application_rate integer NOT NULL,
    bias_awareness integer NOT NULL,
    highest_best_use integer NOT NULL,
    supply_and_demand integer NOT NULL,
    substitution_risk integer NOT NULL,
    double_jeopardy integer NOT NULL,
    knowledge_compounding integer NOT NULL,
    weighted_analysis integer NOT NULL,
    perception_vs_perspective integer NOT NULL,
    knowledge_total integer NOT NULL,
    time_multiplier real NOT NULL,
    raw_score integer NOT NULL,
    master_score real NOT NULL,
    score_range text NOT NULL,
    weakest_pillar text NOT NULL,
    prescription text NOT NULL,
    overlay_answers text,
    overlay_total integer,
    depth text DEFAULT 'extensive'::text,
    focus_pillar text,
    report_unlocked boolean DEFAULT false,
    privacy_level text DEFAULT 'self_only'::text
);


--
-- Name: assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessments_id_seq OWNED BY public.assessments.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    action text NOT NULL,
    actor text,
    target_table text,
    target_id integer,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: birthday_reward_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_reward_log (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    partner_brand_id integer,
    coupon_code text,
    coupon_value text,
    sent_at timestamp without time zone DEFAULT now(),
    redeemed_at timestamp without time zone,
    email_status text DEFAULT 'sent'::text,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: birthday_reward_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.birthday_reward_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: birthday_reward_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.birthday_reward_log_id_seq OWNED BY public.birthday_reward_log.id;


--
-- Name: birthday_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_rewards (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    birth_month integer NOT NULL,
    birth_day integer NOT NULL,
    birth_year integer,
    reward_optin boolean DEFAULT true,
    partner_consent jsonb DEFAULT '{}'::jsonb,
    last_reward_sent_at timestamp without time zone,
    last_reward_year integer,
    zip_code text,
    consent_ip_hash text,
    consent_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT birthday_rewards_birth_day_check CHECK (((birth_day >= 1) AND (birth_day <= 31))),
    CONSTRAINT birthday_rewards_birth_month_check CHECK (((birth_month >= 1) AND (birth_month <= 12)))
);


--
-- Name: birthday_rewards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.birthday_rewards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: birthday_rewards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.birthday_rewards_id_seq OWNED BY public.birthday_rewards.id;


--
-- Name: ceo_todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ceo_todos (
    id integer NOT NULL,
    task text NOT NULL,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'pending'::text,
    due_date date,
    created_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone
);


--
-- Name: ceo_todos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ceo_todos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ceo_todos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ceo_todos_id_seq OWNED BY public.ceo_todos.id;


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    baseline_assessment_id integer NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now(),
    day_90_date timestamp with time zone NOT NULL,
    reassessment_id integer,
    status text DEFAULT 'active'::text
);


--
-- Name: challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.challenges_id_seq OWNED BY public.challenges.id;


--
-- Name: cherish_honor_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cherish_honor_matrix (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    gender text NOT NULL,
    cherish_words integer DEFAULT 0,
    cherish_time integer DEFAULT 0,
    cherish_service integer DEFAULT 0,
    cherish_gifts integer DEFAULT 0,
    cherish_touch integer DEFAULT 0,
    cherish_total integer DEFAULT 0,
    honor_words integer DEFAULT 0,
    honor_time integer DEFAULT 0,
    honor_service integer DEFAULT 0,
    honor_gifts integer DEFAULT 0,
    honor_touch integer DEFAULT 0,
    honor_total integer DEFAULT 0,
    completed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cherish_honor_matrix_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);


--
-- Name: cherish_honor_matrix_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cherish_honor_matrix_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cherish_honor_matrix_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cherish_honor_matrix_id_seq OWNED BY public.cherish_honor_matrix.id;


--
-- Name: coaching_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaching_replies (
    id integer NOT NULL,
    contact_id integer,
    email text NOT NULL,
    coaching_day integer,
    response text NOT NULL,
    mood text DEFAULT 'neutral'::text,
    action_completed boolean DEFAULT false,
    weakest_pillar text,
    sentiment text DEFAULT 'neutral'::text,
    key_themes text[] DEFAULT '{}'::text[],
    coaching_insight text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: coaching_replies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coaching_replies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coaching_replies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coaching_replies_id_seq OWNED BY public.coaching_replies.id;


--
-- Name: coaching_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaching_requests (
    id integer NOT NULL,
    assessment_id text,
    contact_id integer,
    name text NOT NULL,
    email text NOT NULL,
    track text NOT NULL,
    goals text NOT NULL,
    questions text NOT NULL,
    biggest_challenge text NOT NULL,
    re_years text,
    re_specialty text,
    re_volume text,
    company_name text,
    company_role text,
    company_size text,
    company_department text,
    verification_token text,
    verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    report_sent boolean DEFAULT false,
    report_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coaching_requests_track_check CHECK ((track = ANY (ARRAY['real_estate'::text, 'personal'::text, 'company'::text])))
);


--
-- Name: coaching_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coaching_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coaching_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coaching_requests_id_seq OWNED BY public.coaching_requests.id;


--
-- Name: coaching_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaching_sequences (
    id integer NOT NULL,
    email text NOT NULL,
    assessment_id integer NOT NULL,
    current_day integer DEFAULT 0,
    last_sent_at timestamp without time zone,
    started_at timestamp without time zone DEFAULT now(),
    unsubscribed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    engagement_score double precision DEFAULT 0,
    email_variant text DEFAULT 'default'::text,
    persona text DEFAULT 'standard'::text
);


--
-- Name: coaching_sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coaching_sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coaching_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coaching_sequences_id_seq OWNED BY public.coaching_sequences.id;


--
-- Name: commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissions (
    id integer NOT NULL,
    partner_id integer NOT NULL,
    referral_id integer,
    type text NOT NULL,
    amount_cents integer NOT NULL,
    description text,
    period_start date,
    period_end date,
    status text DEFAULT 'pending'::text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text]))),
    CONSTRAINT commissions_type_check CHECK ((type = ANY (ARRAY['signup_recurring'::text, 'vip_split'::text, 'upgrade_bonus'::text, 'royalty_bonus'::text, 'coach_override'::text, 'member_reward_credit'::text])))
);


--
-- Name: commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commissions_id_seq OWNED BY public.commissions.id;


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    created_at text NOT NULL,
    hubspot_synced integer DEFAULT 0,
    pin_hash text,
    pin_set_at timestamp without time zone,
    deleted_at timestamp with time zone,
    pin_reset_token text,
    pin_reset_expires timestamp with time zone,
    devotional_opt_out boolean DEFAULT false,
    disabled boolean DEFAULT false
);


--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;


--
-- Name: couple_challenge_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.couple_challenge_responses (
    id integer NOT NULL,
    challenge_id integer NOT NULL,
    contact_id integer NOT NULL,
    day_number integer NOT NULL,
    prompt_text text NOT NULL,
    response_text text,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone
);


--
-- Name: couple_challenge_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.couple_challenge_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: couple_challenge_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.couple_challenge_responses_id_seq OWNED BY public.couple_challenge_responses.id;


--
-- Name: couple_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.couple_challenges (
    id integer NOT NULL,
    couple_profile_id_a integer NOT NULL,
    couple_profile_id_b integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    current_day integer DEFAULT 1,
    status text DEFAULT 'active'::text,
    baseline_matrix_a integer,
    baseline_matrix_b integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT couple_challenges_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: couple_challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.couple_challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: couple_challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.couple_challenges_id_seq OWNED BY public.couple_challenges.id;


--
-- Name: couples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.couples (
    id integer NOT NULL,
    initiator_contact_id integer NOT NULL,
    partner_email text NOT NULL,
    partner_contact_id integer,
    partner_name text NOT NULL,
    invite_code text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: couples_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.couples_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: couples_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.couples_id_seq OWNED BY public.couples.id;


--
-- Name: dating_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_blocks (
    id integer NOT NULL,
    blocker_id integer NOT NULL,
    blocked_id integer NOT NULL,
    reason text,
    blocked_at timestamp with time zone DEFAULT now()
);


--
-- Name: dating_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_blocks_id_seq OWNED BY public.dating_blocks.id;


--
-- Name: dating_email_verify; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_email_verify (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    verified_at timestamp with time zone
);


--
-- Name: dating_email_verify_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_email_verify_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_email_verify_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_email_verify_id_seq OWNED BY public.dating_email_verify.id;


--
-- Name: dating_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_matches (
    id integer NOT NULL,
    profile_a_id integer NOT NULL,
    profile_b_id integer NOT NULL,
    matched_at timestamp with time zone DEFAULT now(),
    match_type text DEFAULT 'mutual_swipe'::text,
    unmatched boolean DEFAULT false,
    unmatched_at timestamp with time zone
);


--
-- Name: dating_matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_matches_id_seq OWNED BY public.dating_matches.id;


--
-- Name: dating_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_messages (
    id integer NOT NULL,
    match_id integer NOT NULL,
    sender_id integer NOT NULL,
    message text NOT NULL,
    read_at timestamp with time zone,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: dating_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_messages_id_seq OWNED BY public.dating_messages.id;


--
-- Name: dating_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_profiles (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    display_name text NOT NULL,
    gender text NOT NULL,
    seeking text NOT NULL,
    date_of_birth date,
    age integer,
    height_inches integer,
    weight_lbs integer,
    body_type text,
    faith text DEFAULT 'Christian'::text NOT NULL,
    denomination text,
    faith_importance text DEFAULT 'very_important'::text,
    bio text,
    photo_urls jsonb DEFAULT '[]'::jsonb,
    recreation_interests jsonb DEFAULT '[]'::jsonb,
    general_interests jsonb DEFAULT '[]'::jsonb,
    location_lat double precision,
    location_lng double precision,
    location_city text,
    location_state text,
    search_radius_miles integer DEFAULT 50,
    show_on_map boolean DEFAULT true,
    show_distance boolean DEFAULT true,
    age_min integer DEFAULT 18,
    age_max integer DEFAULT 65,
    is_active boolean DEFAULT true,
    last_active timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    trial_start timestamp with time zone DEFAULT now(),
    trial_ends timestamp with time zone,
    is_paid boolean DEFAULT false,
    stripe_subscription_id text,
    email_verified boolean DEFAULT false,
    CONSTRAINT dating_profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text]))),
    CONSTRAINT dating_profiles_seeking_check CHECK ((seeking = ANY (ARRAY['male'::text, 'female'::text])))
);


--
-- Name: dating_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_profiles_id_seq OWNED BY public.dating_profiles.id;


--
-- Name: dating_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_reports (
    id integer NOT NULL,
    reporter_id integer NOT NULL,
    reported_id integer NOT NULL,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dating_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_reports_id_seq OWNED BY public.dating_reports.id;


--
-- Name: dating_swipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dating_swipes (
    id integer NOT NULL,
    swiper_id integer NOT NULL,
    swiped_id integer NOT NULL,
    direction text NOT NULL,
    swiped_at timestamp with time zone DEFAULT now(),
    CONSTRAINT dating_swipes_direction_check CHECK ((direction = ANY (ARRAY['left'::text, 'right'::text])))
);


--
-- Name: dating_swipes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dating_swipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dating_swipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dating_swipes_id_seq OWNED BY public.dating_swipes.id;


--
-- Name: digital_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_purchases (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    product_id character varying(100) NOT NULL,
    stripe_product_id character varying(100),
    stripe_payment_intent character varying(100),
    granted_by character varying(50) DEFAULT 'purchase'::character varying,
    granted_at timestamp with time zone DEFAULT now()
);


--
-- Name: digital_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.digital_purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: digital_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.digital_purchases_id_seq OWNED BY public.digital_purchases.id;


--
-- Name: email_engagement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_engagement (
    id integer NOT NULL,
    contact_id integer,
    email text NOT NULL,
    coaching_day integer,
    sent_at timestamp without time zone DEFAULT now(),
    opened_at timestamp without time zone,
    clicked_at timestamp without time zone,
    action_completed boolean DEFAULT false,
    retook_assessment boolean DEFAULT false,
    email_variant text DEFAULT 'default'::text,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: email_engagement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_engagement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_engagement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_engagement_id_seq OWNED BY public.email_engagement.id;


--
-- Name: email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_log (
    id integer NOT NULL,
    recipient text NOT NULL,
    email_type text NOT NULL,
    subject text,
    contact_id integer,
    assessment_id integer,
    status text DEFAULT 'sent'::text,
    metadata jsonb,
    sent_at timestamp without time zone DEFAULT now(),
    sent_date date GENERATED ALWAYS AS ((((sent_at AT TIME ZONE 'UTC'::text) AT TIME ZONE 'America/New_York'::text))::date) STORED
);


--
-- Name: email_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_log_id_seq OWNED BY public.email_log.id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    contact_id integer,
    assessment_id integer,
    weakest_pillar text NOT NULL,
    weakest_sub_categories jsonb,
    score_range text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
-- Name: free_book_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.free_book_signups (
    id integer NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    token text NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    verified_at timestamp with time zone
);


--
-- Name: free_book_signups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.free_book_signups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: free_book_signups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.free_book_signups_id_seq OWNED BY public.free_book_signups.id;


--
-- Name: funnel_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.funnel_summary AS
 SELECT event_type,
    count(*) AS total_events,
    count(DISTINCT contact_id) AS unique_contacts,
    count(DISTINCT session_id) AS unique_sessions,
    date_trunc('day'::text, created_at) AS event_date
   FROM public.analytics_events
  WHERE (created_at > (now() - '90 days'::interval))
  GROUP BY event_type, (date_trunc('day'::text, created_at))
  ORDER BY (date_trunc('day'::text, created_at)) DESC, event_type;


--
-- Name: intimacy_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intimacy_results (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    partner_contact_id integer,
    comfort_safety integer DEFAULT 0,
    touch_pace integer DEFAULT 0,
    initiation_roles integer DEFAULT 0,
    rhythm_frequency integer DEFAULT 0,
    exploration_feedback integer DEFAULT 0,
    total_score integer DEFAULT 0,
    consent_both_partners boolean DEFAULT false,
    completed_at timestamp with time zone DEFAULT now()
);


--
-- Name: intimacy_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intimacy_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intimacy_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intimacy_results_id_seq OWNED BY public.intimacy_results.id;


--
-- Name: love_language_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.love_language_results (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    words_of_affirmation_give integer DEFAULT 0,
    words_of_affirmation_receive integer DEFAULT 0,
    quality_time_give integer DEFAULT 0,
    quality_time_receive integer DEFAULT 0,
    acts_of_service_give integer DEFAULT 0,
    acts_of_service_receive integer DEFAULT 0,
    gifts_give integer DEFAULT 0,
    gifts_receive integer DEFAULT 0,
    physical_touch_give integer DEFAULT 0,
    physical_touch_receive integer DEFAULT 0,
    primary_give_language text,
    primary_receive_language text,
    completed_at timestamp with time zone DEFAULT now()
);


--
-- Name: love_language_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.love_language_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: love_language_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.love_language_results_id_seq OWNED BY public.love_language_results.id;


--
-- Name: page_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_analytics (
    id integer NOT NULL,
    page_path text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    views integer DEFAULT 0,
    unique_visitors integer DEFAULT 0,
    bounce_rate double precision DEFAULT 0,
    conversion_rate double precision DEFAULT 0,
    drop_off_rate double precision DEFAULT 0,
    insights jsonb DEFAULT '{}'::jsonb
);


--
-- Name: page_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.page_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.page_analytics_id_seq OWNED BY public.page_analytics.id;


--
-- Name: partner_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_brands (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    logo_url text,
    website text,
    category text,
    values_alignment text[],
    geo_zone text,
    offer_template text,
    contact_email text,
    status text DEFAULT 'pending'::text,
    contract_start date,
    contract_end date,
    revenue_model text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT partner_brands_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'rejected'::text])))
);


--
-- Name: partner_brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partner_brands_id_seq OWNED BY public.partner_brands.id;


--
-- Name: partner_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_invites (
    id integer NOT NULL,
    inviter_email text NOT NULL,
    partner_email text NOT NULL,
    inviter_name text,
    created_at timestamp without time zone DEFAULT now(),
    accepted_at timestamp without time zone
);


--
-- Name: partner_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partner_invites_id_seq OWNED BY public.partner_invites.id;


--
-- Name: partner_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_profiles (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    referral_code text NOT NULL,
    partner_type text DEFAULT 'affiliate'::text,
    status text DEFAULT 'pending'::text,
    profession text,
    license_info text,
    coaching_split integer DEFAULT 80,
    total_referrals integer DEFAULT 0,
    total_earnings_cents integer DEFAULT 0,
    royalty_tier text DEFAULT 'none'::text,
    applied_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT partner_profiles_partner_type_check CHECK ((partner_type = ANY (ARRAY['affiliate'::text, 'coach_associate'::text, 'coach_certified'::text, 'coach_master'::text]))),
    CONSTRAINT partner_profiles_royalty_tier_check CHECK ((royalty_tier = ANY (ARRAY['none'::text, 'bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text]))),
    CONSTRAINT partner_profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text])))
);


--
-- Name: partner_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partner_profiles_id_seq OWNED BY public.partner_profiles.id;


--
-- Name: peer_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_ratings (
    id integer NOT NULL,
    team_id integer NOT NULL,
    rater_id integer NOT NULL,
    target_id integer NOT NULL,
    ratings text NOT NULL,
    ratings_total integer NOT NULL,
    created_at text NOT NULL
);


--
-- Name: peer_ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.peer_ratings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: peer_ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.peer_ratings_id_seq OWNED BY public.peer_ratings.id;


--
-- Name: privacy_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.privacy_preferences (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    team_id integer,
    share_time boolean DEFAULT true,
    share_people boolean DEFAULT false,
    share_influence boolean DEFAULT true,
    share_numbers boolean DEFAULT false,
    share_knowledge boolean DEFAULT true,
    share_sub_categories boolean DEFAULT false,
    share_prescriptions boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: privacy_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.privacy_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: privacy_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.privacy_preferences_id_seq OWNED BY public.privacy_preferences.id;


--
-- Name: question_bank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_bank (
    id text NOT NULL,
    pillar text NOT NULL,
    sub_category text NOT NULL,
    field_name text NOT NULL,
    question text NOT NULL,
    description text NOT NULL,
    options jsonb NOT NULL,
    is_active boolean DEFAULT true,
    is_overlay boolean DEFAULT false,
    overlay_type text,
    created_at timestamp with time zone DEFAULT now(),
    sort_order integer DEFAULT 0
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    partner_id integer NOT NULL,
    referred_contact_id integer NOT NULL,
    referred_email text NOT NULL,
    membership_tier text,
    stripe_subscription_id text,
    status text DEFAULT 'signed_up'::text,
    referral_code_used text NOT NULL,
    signed_up_at timestamp with time zone DEFAULT now(),
    activated_at timestamp with time zone,
    churned_at timestamp with time zone,
    CONSTRAINT referrals_status_check CHECK ((status = ANY (ARRAY['signed_up'::text, 'active'::text, 'churned'::text, 'upgraded'::text])))
);


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: relationship_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relationship_matrix (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    partner_contact_id integer,
    gender text NOT NULL,
    practical_give integer DEFAULT 0,
    practical_receive integer DEFAULT 0,
    mental_load_give integer DEFAULT 0,
    mental_load_receive integer DEFAULT 0,
    financial_give integer DEFAULT 0,
    financial_receive integer DEFAULT 0,
    relational_give integer DEFAULT 0,
    relational_receive integer DEFAULT 0,
    growth_give integer DEFAULT 0,
    growth_receive integer DEFAULT 0,
    give_total integer DEFAULT 0,
    receive_total integer DEFAULT 0,
    domain_gap integer DEFAULT 0,
    completed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT relationship_matrix_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);


--
-- Name: relationship_matrix_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.relationship_matrix_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: relationship_matrix_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.relationship_matrix_id_seq OWNED BY public.relationship_matrix.id;


--
-- Name: rfm_chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfm_chapters (
    id integer NOT NULL,
    chapter_number integer NOT NULL,
    title text NOT NULL,
    book_page integer,
    word_count integer,
    themes text[] DEFAULT '{}'::text[],
    bible_verses text[] DEFAULT '{}'::text[],
    summary text,
    reflection_prompt text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: rfm_chapters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rfm_chapters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rfm_chapters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rfm_chapters_id_seq OWNED BY public.rfm_chapters.id;


--
-- Name: rfm_devotionals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfm_devotionals (
    id integer NOT NULL,
    chapter_id integer,
    day_number integer NOT NULL,
    title text NOT NULL,
    theme text NOT NULL,
    scripture_reference text,
    scripture_text text,
    reflection text NOT NULL,
    prayer text,
    action_step text,
    podcast_topic text,
    social_media_post text,
    is_published boolean DEFAULT false,
    scheduled_date date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: rfm_devotionals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rfm_devotionals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rfm_devotionals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rfm_devotionals_id_seq OWNED BY public.rfm_devotionals.id;


--
-- Name: rfm_subscriber_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfm_subscriber_progress (
    id integer NOT NULL,
    email text NOT NULL,
    current_day integer DEFAULT 1,
    started_at timestamp with time zone DEFAULT now(),
    last_sent_at timestamp with time zone,
    is_active boolean DEFAULT true
);


--
-- Name: rfm_subscriber_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rfm_subscriber_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rfm_subscriber_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rfm_subscriber_progress_id_seq OWNED BY public.rfm_subscriber_progress.id;


--
-- Name: system_health_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_health_log (
    id integer NOT NULL,
    checked_at timestamp without time zone DEFAULT now(),
    service text NOT NULL,
    status text NOT NULL,
    response_time_ms integer,
    details jsonb DEFAULT '{}'::jsonb,
    alert_sent boolean DEFAULT false,
    auto_healed boolean DEFAULT false,
    heal_action text
);


--
-- Name: system_health_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_health_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_health_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_health_log_id_seq OWNED BY public.system_health_log.id;


--
-- Name: system_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_registry (
    id integer NOT NULL,
    system_name text NOT NULL,
    system_type text NOT NULL,
    category text DEFAULT 'local'::text,
    endpoint text,
    status text DEFAULT 'unknown'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    last_reported_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: system_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_registry_id_seq OWNED BY public.system_registry.id;


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    contact_id integer NOT NULL,
    member_number integer NOT NULL,
    current_focus text DEFAULT ''::text,
    end_year_goals text DEFAULT ''::text,
    department text DEFAULT ''::text,
    role_title text DEFAULT ''::text,
    custom_code text DEFAULT ''::text,
    notes text DEFAULT ''::text,
    joined_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    visibility_consent boolean DEFAULT false,
    consent_given_at timestamp without time zone
);


--
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name text NOT NULL,
    created_by integer NOT NULL,
    mode text NOT NULL,
    invite_code text NOT NULL,
    created_at text NOT NULL,
    company_email text DEFAULT ''::text,
    company_name text DEFAULT ''::text,
    company_domain text DEFAULT ''::text,
    admin_contact_name text DEFAULT ''::text,
    billing_email text DEFAULT ''::text,
    integration_webhook text DEFAULT ''::text,
    report_frequency text DEFAULT 'monthly'::text,
    auto_report_enabled boolean DEFAULT false
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: user_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_feedback (
    id integer NOT NULL,
    contact_id integer,
    email text NOT NULL,
    first_name text,
    category text DEFAULT 'feedback'::text,
    feedback_type text DEFAULT 'evening_checkin'::text,
    question text,
    response text NOT NULL,
    severity text DEFAULT 'low'::text,
    status text DEFAULT 'new'::text,
    page_url text,
    device_info text,
    resolved_at timestamp without time zone,
    admin_notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_feedback_id_seq OWNED BY public.user_feedback.id;


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    date_of_birth date,
    age integer,
    gender text,
    membership_tier text DEFAULT 'free'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    partner_id integer,
    parent_id integer,
    is_dependent boolean DEFAULT false,
    consent_given boolean DEFAULT false,
    consent_given_at timestamp with time zone,
    faith_disclaimer_accepted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferences jsonb DEFAULT '{}'::jsonb,
    terms_accepted_at timestamp with time zone,
    privacy_accepted_at timestamp with time zone,
    role text DEFAULT 'member'::text,
    CONSTRAINT user_profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text]))),
    CONSTRAINT user_profiles_membership_tier_check CHECK ((membership_tier = ANY (ARRAY['free'::text, 'individual'::text, 'couple'::text, 'premium'::text]))),
    CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'team_admin'::text, 'member'::text, 'free'::text])))
);


--
-- Name: user_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_profiles_id_seq OWNED BY public.user_profiles.id;


--
-- Name: vault_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_content (
    id integer NOT NULL,
    file_path text NOT NULL,
    folder text,
    title text,
    content text,
    word_count integer DEFAULT 0,
    tags text[] DEFAULT '{}'::text[],
    links text[] DEFAULT '{}'::text[],
    frontmatter jsonb DEFAULT '{}'::jsonb,
    content_hash text,
    last_synced timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: vault_content_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vault_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vault_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vault_content_id_seq OWNED BY public.vault_content.id;


--
-- Name: agent_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_rules ALTER COLUMN id SET DEFAULT nextval('public.agent_rules_id_seq'::regclass);


--
-- Name: agent_state id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_state ALTER COLUMN id SET DEFAULT nextval('public.agent_state_id_seq'::regclass);


--
-- Name: analytics_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events ALTER COLUMN id SET DEFAULT nextval('public.analytics_events_id_seq'::regclass);


--
-- Name: answer_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_history ALTER COLUMN id SET DEFAULT nextval('public.answer_history_id_seq'::regclass);


--
-- Name: assessment_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_progress ALTER COLUMN id SET DEFAULT nextval('public.assessment_progress_id_seq'::regclass);


--
-- Name: assessments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments ALTER COLUMN id SET DEFAULT nextval('public.assessments_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: birthday_reward_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_reward_log ALTER COLUMN id SET DEFAULT nextval('public.birthday_reward_log_id_seq'::regclass);


--
-- Name: birthday_rewards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_rewards ALTER COLUMN id SET DEFAULT nextval('public.birthday_rewards_id_seq'::regclass);


--
-- Name: ceo_todos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ceo_todos ALTER COLUMN id SET DEFAULT nextval('public.ceo_todos_id_seq'::regclass);


--
-- Name: challenges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges ALTER COLUMN id SET DEFAULT nextval('public.challenges_id_seq'::regclass);


--
-- Name: cherish_honor_matrix id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cherish_honor_matrix ALTER COLUMN id SET DEFAULT nextval('public.cherish_honor_matrix_id_seq'::regclass);


--
-- Name: coaching_replies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_replies ALTER COLUMN id SET DEFAULT nextval('public.coaching_replies_id_seq'::regclass);


--
-- Name: coaching_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_requests ALTER COLUMN id SET DEFAULT nextval('public.coaching_requests_id_seq'::regclass);


--
-- Name: coaching_sequences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_sequences ALTER COLUMN id SET DEFAULT nextval('public.coaching_sequences_id_seq'::regclass);


--
-- Name: commissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions ALTER COLUMN id SET DEFAULT nextval('public.commissions_id_seq'::regclass);


--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);


--
-- Name: couple_challenge_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenge_responses ALTER COLUMN id SET DEFAULT nextval('public.couple_challenge_responses_id_seq'::regclass);


--
-- Name: couple_challenges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenges ALTER COLUMN id SET DEFAULT nextval('public.couple_challenges_id_seq'::regclass);


--
-- Name: couples id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couples ALTER COLUMN id SET DEFAULT nextval('public.couples_id_seq'::regclass);


--
-- Name: dating_blocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_blocks ALTER COLUMN id SET DEFAULT nextval('public.dating_blocks_id_seq'::regclass);


--
-- Name: dating_email_verify id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_email_verify ALTER COLUMN id SET DEFAULT nextval('public.dating_email_verify_id_seq'::regclass);


--
-- Name: dating_matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_matches ALTER COLUMN id SET DEFAULT nextval('public.dating_matches_id_seq'::regclass);


--
-- Name: dating_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_messages ALTER COLUMN id SET DEFAULT nextval('public.dating_messages_id_seq'::regclass);


--
-- Name: dating_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_profiles ALTER COLUMN id SET DEFAULT nextval('public.dating_profiles_id_seq'::regclass);


--
-- Name: dating_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_reports ALTER COLUMN id SET DEFAULT nextval('public.dating_reports_id_seq'::regclass);


--
-- Name: dating_swipes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_swipes ALTER COLUMN id SET DEFAULT nextval('public.dating_swipes_id_seq'::regclass);


--
-- Name: digital_purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_purchases ALTER COLUMN id SET DEFAULT nextval('public.digital_purchases_id_seq'::regclass);


--
-- Name: email_engagement id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_engagement ALTER COLUMN id SET DEFAULT nextval('public.email_engagement_id_seq'::regclass);


--
-- Name: email_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log ALTER COLUMN id SET DEFAULT nextval('public.email_log_id_seq'::regclass);


--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- Name: free_book_signups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_book_signups ALTER COLUMN id SET DEFAULT nextval('public.free_book_signups_id_seq'::regclass);


--
-- Name: intimacy_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intimacy_results ALTER COLUMN id SET DEFAULT nextval('public.intimacy_results_id_seq'::regclass);


--
-- Name: love_language_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.love_language_results ALTER COLUMN id SET DEFAULT nextval('public.love_language_results_id_seq'::regclass);


--
-- Name: page_analytics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_analytics ALTER COLUMN id SET DEFAULT nextval('public.page_analytics_id_seq'::regclass);


--
-- Name: partner_brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_brands ALTER COLUMN id SET DEFAULT nextval('public.partner_brands_id_seq'::regclass);


--
-- Name: partner_invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_invites ALTER COLUMN id SET DEFAULT nextval('public.partner_invites_id_seq'::regclass);


--
-- Name: partner_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profiles ALTER COLUMN id SET DEFAULT nextval('public.partner_profiles_id_seq'::regclass);


--
-- Name: peer_ratings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings ALTER COLUMN id SET DEFAULT nextval('public.peer_ratings_id_seq'::regclass);


--
-- Name: privacy_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privacy_preferences ALTER COLUMN id SET DEFAULT nextval('public.privacy_preferences_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: relationship_matrix id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_matrix ALTER COLUMN id SET DEFAULT nextval('public.relationship_matrix_id_seq'::regclass);


--
-- Name: rfm_chapters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_chapters ALTER COLUMN id SET DEFAULT nextval('public.rfm_chapters_id_seq'::regclass);


--
-- Name: rfm_devotionals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_devotionals ALTER COLUMN id SET DEFAULT nextval('public.rfm_devotionals_id_seq'::regclass);


--
-- Name: rfm_subscriber_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_subscriber_progress ALTER COLUMN id SET DEFAULT nextval('public.rfm_subscriber_progress_id_seq'::regclass);


--
-- Name: system_health_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_log ALTER COLUMN id SET DEFAULT nextval('public.system_health_log_id_seq'::regclass);


--
-- Name: system_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_registry ALTER COLUMN id SET DEFAULT nextval('public.system_registry_id_seq'::regclass);


--
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: user_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedback ALTER COLUMN id SET DEFAULT nextval('public.user_feedback_id_seq'::regclass);


--
-- Name: user_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles ALTER COLUMN id SET DEFAULT nextval('public.user_profiles_id_seq'::regclass);


--
-- Name: vault_content id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_content ALTER COLUMN id SET DEFAULT nextval('public.vault_content_id_seq'::regclass);


--
-- Name: agent_rules agent_rules_agent_name_rule_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_rules
    ADD CONSTRAINT agent_rules_agent_name_rule_key_key UNIQUE (agent_name, rule_key);


--
-- Name: agent_rules agent_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_rules
    ADD CONSTRAINT agent_rules_pkey PRIMARY KEY (id);


--
-- Name: agent_state agent_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_state
    ADD CONSTRAINT agent_state_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: answer_history answer_history_contact_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_history
    ADD CONSTRAINT answer_history_contact_id_question_id_key UNIQUE (contact_id, question_id);


--
-- Name: answer_history answer_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_history
    ADD CONSTRAINT answer_history_pkey PRIMARY KEY (id);


--
-- Name: assessment_progress assessment_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_progress
    ADD CONSTRAINT assessment_progress_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: birthday_reward_log birthday_reward_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_reward_log
    ADD CONSTRAINT birthday_reward_log_pkey PRIMARY KEY (id);


--
-- Name: birthday_rewards birthday_rewards_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_rewards
    ADD CONSTRAINT birthday_rewards_contact_id_key UNIQUE (contact_id);


--
-- Name: birthday_rewards birthday_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_rewards
    ADD CONSTRAINT birthday_rewards_pkey PRIMARY KEY (id);


--
-- Name: ceo_todos ceo_todos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ceo_todos
    ADD CONSTRAINT ceo_todos_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_contact_id_baseline_assessment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_contact_id_baseline_assessment_id_key UNIQUE (contact_id, baseline_assessment_id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: cherish_honor_matrix cherish_honor_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cherish_honor_matrix
    ADD CONSTRAINT cherish_honor_matrix_pkey PRIMARY KEY (id);


--
-- Name: coaching_replies coaching_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_replies
    ADD CONSTRAINT coaching_replies_pkey PRIMARY KEY (id);


--
-- Name: coaching_requests coaching_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_requests
    ADD CONSTRAINT coaching_requests_pkey PRIMARY KEY (id);


--
-- Name: coaching_requests coaching_requests_verification_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_requests
    ADD CONSTRAINT coaching_requests_verification_token_key UNIQUE (verification_token);


--
-- Name: coaching_sequences coaching_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_sequences
    ADD CONSTRAINT coaching_sequences_pkey PRIMARY KEY (id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: couple_challenge_responses couple_challenge_responses_challenge_id_contact_id_day_numb_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenge_responses
    ADD CONSTRAINT couple_challenge_responses_challenge_id_contact_id_day_numb_key UNIQUE (challenge_id, contact_id, day_number);


--
-- Name: couple_challenge_responses couple_challenge_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenge_responses
    ADD CONSTRAINT couple_challenge_responses_pkey PRIMARY KEY (id);


--
-- Name: couple_challenges couple_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenges
    ADD CONSTRAINT couple_challenges_pkey PRIMARY KEY (id);


--
-- Name: couples couples_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couples
    ADD CONSTRAINT couples_invite_code_key UNIQUE (invite_code);


--
-- Name: couples couples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couples
    ADD CONSTRAINT couples_pkey PRIMARY KEY (id);


--
-- Name: dating_blocks dating_blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_blocks
    ADD CONSTRAINT dating_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: dating_blocks dating_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_blocks
    ADD CONSTRAINT dating_blocks_pkey PRIMARY KEY (id);


--
-- Name: dating_email_verify dating_email_verify_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_email_verify
    ADD CONSTRAINT dating_email_verify_contact_id_key UNIQUE (contact_id);


--
-- Name: dating_email_verify dating_email_verify_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_email_verify
    ADD CONSTRAINT dating_email_verify_pkey PRIMARY KEY (id);


--
-- Name: dating_matches dating_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_matches
    ADD CONSTRAINT dating_matches_pkey PRIMARY KEY (id);


--
-- Name: dating_matches dating_matches_profile_a_id_profile_b_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_matches
    ADD CONSTRAINT dating_matches_profile_a_id_profile_b_id_key UNIQUE (profile_a_id, profile_b_id);


--
-- Name: dating_messages dating_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_messages
    ADD CONSTRAINT dating_messages_pkey PRIMARY KEY (id);


--
-- Name: dating_profiles dating_profiles_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_profiles
    ADD CONSTRAINT dating_profiles_contact_id_key UNIQUE (contact_id);


--
-- Name: dating_profiles dating_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_profiles
    ADD CONSTRAINT dating_profiles_pkey PRIMARY KEY (id);


--
-- Name: dating_reports dating_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_reports
    ADD CONSTRAINT dating_reports_pkey PRIMARY KEY (id);


--
-- Name: dating_swipes dating_swipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_swipes
    ADD CONSTRAINT dating_swipes_pkey PRIMARY KEY (id);


--
-- Name: dating_swipes dating_swipes_swiper_id_swiped_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_swipes
    ADD CONSTRAINT dating_swipes_swiper_id_swiped_id_key UNIQUE (swiper_id, swiped_id);


--
-- Name: digital_purchases digital_purchases_email_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_email_product_id_key UNIQUE (email, product_id);


--
-- Name: digital_purchases digital_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_pkey PRIMARY KEY (id);


--
-- Name: email_engagement email_engagement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_engagement
    ADD CONSTRAINT email_engagement_pkey PRIMARY KEY (id);


--
-- Name: email_log email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: free_book_signups free_book_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_book_signups
    ADD CONSTRAINT free_book_signups_pkey PRIMARY KEY (id);


--
-- Name: free_book_signups free_book_signups_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_book_signups
    ADD CONSTRAINT free_book_signups_token_key UNIQUE (token);


--
-- Name: intimacy_results intimacy_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intimacy_results
    ADD CONSTRAINT intimacy_results_pkey PRIMARY KEY (id);


--
-- Name: love_language_results love_language_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.love_language_results
    ADD CONSTRAINT love_language_results_pkey PRIMARY KEY (id);


--
-- Name: page_analytics page_analytics_page_path_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_analytics
    ADD CONSTRAINT page_analytics_page_path_period_start_key UNIQUE (page_path, period_start);


--
-- Name: page_analytics page_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_analytics
    ADD CONSTRAINT page_analytics_pkey PRIMARY KEY (id);


--
-- Name: partner_brands partner_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_brands
    ADD CONSTRAINT partner_brands_pkey PRIMARY KEY (id);


--
-- Name: partner_brands partner_brands_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_brands
    ADD CONSTRAINT partner_brands_slug_key UNIQUE (slug);


--
-- Name: partner_invites partner_invites_inviter_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_invites
    ADD CONSTRAINT partner_invites_inviter_email_key UNIQUE (inviter_email);


--
-- Name: partner_invites partner_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_invites
    ADD CONSTRAINT partner_invites_pkey PRIMARY KEY (id);


--
-- Name: partner_profiles partner_profiles_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profiles
    ADD CONSTRAINT partner_profiles_contact_id_key UNIQUE (contact_id);


--
-- Name: partner_profiles partner_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profiles
    ADD CONSTRAINT partner_profiles_pkey PRIMARY KEY (id);


--
-- Name: partner_profiles partner_profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profiles
    ADD CONSTRAINT partner_profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: peer_ratings peer_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings
    ADD CONSTRAINT peer_ratings_pkey PRIMARY KEY (id);


--
-- Name: privacy_preferences privacy_preferences_contact_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privacy_preferences
    ADD CONSTRAINT privacy_preferences_contact_id_team_id_key UNIQUE (contact_id, team_id);


--
-- Name: privacy_preferences privacy_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privacy_preferences
    ADD CONSTRAINT privacy_preferences_pkey PRIMARY KEY (id);


--
-- Name: question_bank question_bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: relationship_matrix relationship_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_matrix
    ADD CONSTRAINT relationship_matrix_pkey PRIMARY KEY (id);


--
-- Name: rfm_chapters rfm_chapters_chapter_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_chapters
    ADD CONSTRAINT rfm_chapters_chapter_number_key UNIQUE (chapter_number);


--
-- Name: rfm_chapters rfm_chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_chapters
    ADD CONSTRAINT rfm_chapters_pkey PRIMARY KEY (id);


--
-- Name: rfm_devotionals rfm_devotionals_day_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_devotionals
    ADD CONSTRAINT rfm_devotionals_day_number_key UNIQUE (day_number);


--
-- Name: rfm_devotionals rfm_devotionals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_devotionals
    ADD CONSTRAINT rfm_devotionals_pkey PRIMARY KEY (id);


--
-- Name: rfm_subscriber_progress rfm_subscriber_progress_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_subscriber_progress
    ADD CONSTRAINT rfm_subscriber_progress_email_key UNIQUE (email);


--
-- Name: rfm_subscriber_progress rfm_subscriber_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_subscriber_progress
    ADD CONSTRAINT rfm_subscriber_progress_pkey PRIMARY KEY (id);


--
-- Name: system_health_log system_health_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_log
    ADD CONSTRAINT system_health_log_pkey PRIMARY KEY (id);


--
-- Name: system_registry system_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_registry
    ADD CONSTRAINT system_registry_pkey PRIMARY KEY (id);


--
-- Name: system_registry system_registry_system_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_registry
    ADD CONSTRAINT system_registry_system_name_key UNIQUE (system_name);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_contact_id_key UNIQUE (team_id, contact_id);


--
-- Name: team_members team_members_team_id_member_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_member_number_key UNIQUE (team_id, member_number);


--
-- Name: teams teams_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_invite_code_key UNIQUE (invite_code);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_feedback user_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedback
    ADD CONSTRAINT user_feedback_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_contact_id_key UNIQUE (contact_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: vault_content vault_content_file_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_content
    ADD CONSTRAINT vault_content_file_path_key UNIQUE (file_path);


--
-- Name: vault_content vault_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_content
    ADD CONSTRAINT vault_content_pkey PRIMARY KEY (id);


--
-- Name: email_log_dedup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_log_dedup_idx ON public.email_log USING btree (lower(recipient), email_type, sent_date) WHERE (status = 'sent'::text);


--
-- Name: idx_agent_state_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_state_name ON public.agent_state USING btree (agent_name);


--
-- Name: idx_analytics_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_contact ON public.analytics_events USING btree (contact_id);


--
-- Name: idx_analytics_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_created ON public.analytics_events USING btree (created_at);


--
-- Name: idx_analytics_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_event_type ON public.analytics_events USING btree (event_type);


--
-- Name: idx_answer_history_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answer_history_contact ON public.answer_history USING btree (contact_id);


--
-- Name: idx_answer_history_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answer_history_question ON public.answer_history USING btree (question_id);


--
-- Name: idx_assessments_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_contact_id ON public.assessments USING btree (contact_id);


--
-- Name: idx_assessments_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_team_id ON public.assessments USING btree (team_id);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at);


--
-- Name: idx_birthday_log_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_birthday_log_contact ON public.birthday_reward_log USING btree (contact_id);


--
-- Name: idx_birthday_log_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_birthday_log_sent ON public.birthday_reward_log USING btree (sent_at);


--
-- Name: idx_birthday_month_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_birthday_month_day ON public.birthday_rewards USING btree (birth_month, birth_day);


--
-- Name: idx_birthday_optin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_birthday_optin ON public.birthday_rewards USING btree (reward_optin) WHERE (reward_optin = true);


--
-- Name: idx_challenge_responses_challenge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_responses_challenge ON public.couple_challenge_responses USING btree (challenge_id);


--
-- Name: idx_challenge_responses_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_responses_contact ON public.couple_challenge_responses USING btree (contact_id);


--
-- Name: idx_challenges_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenges_contact ON public.challenges USING btree (contact_id);


--
-- Name: idx_challenges_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenges_status ON public.challenges USING btree (status);


--
-- Name: idx_cherish_honor_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cherish_honor_contact ON public.cherish_honor_matrix USING btree (contact_id);


--
-- Name: idx_coaching_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_email ON public.coaching_sequences USING btree (email);


--
-- Name: idx_coaching_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_coaching_email_unique ON public.coaching_sequences USING btree (email);


--
-- Name: idx_coaching_replies_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_replies_email ON public.coaching_replies USING btree (email);


--
-- Name: idx_coaching_replies_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_replies_email_lower ON public.coaching_replies USING btree (lower(email));


--
-- Name: idx_coaching_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_requests_email ON public.coaching_requests USING btree (email);


--
-- Name: idx_coaching_requests_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_requests_token ON public.coaching_requests USING btree (verification_token);


--
-- Name: idx_coaching_sequences_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaching_sequences_email_lower ON public.coaching_sequences USING btree (lower(email));


--
-- Name: idx_commissions_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_partner ON public.commissions USING btree (partner_id);


--
-- Name: idx_commissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_status ON public.commissions USING btree (status);


--
-- Name: idx_contacts_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email_lower ON public.contacts USING btree (lower(email));


--
-- Name: idx_contacts_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contacts_email_unique ON public.contacts USING btree (lower(email));


--
-- Name: idx_couple_challenges_profile_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_couple_challenges_profile_a ON public.couple_challenges USING btree (couple_profile_id_a);


--
-- Name: idx_couple_challenges_profile_b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_couple_challenges_profile_b ON public.couple_challenges USING btree (couple_profile_id_b);


--
-- Name: idx_couple_challenges_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_couple_challenges_status ON public.couple_challenges USING btree (status);


--
-- Name: idx_dating_profiles_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dating_profiles_contact_id ON public.dating_profiles USING btree (contact_id);


--
-- Name: idx_devotionals_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devotionals_day ON public.rfm_devotionals USING btree (day_number);


--
-- Name: idx_devotionals_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devotionals_scheduled ON public.rfm_devotionals USING btree (scheduled_date) WHERE (is_published = true);


--
-- Name: idx_dp_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dp_email ON public.digital_purchases USING btree (email);


--
-- Name: idx_dp_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dp_product ON public.digital_purchases USING btree (product_id);


--
-- Name: idx_email_engagement_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_engagement_email ON public.email_engagement USING btree (email);


--
-- Name: idx_email_engagement_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_engagement_email_lower ON public.email_engagement USING btree (lower(email));


--
-- Name: idx_email_log_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_log_recipient ON public.email_log USING btree (recipient);


--
-- Name: idx_email_log_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_log_sent ON public.email_log USING btree (sent_at DESC);


--
-- Name: idx_email_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_log_type ON public.email_log USING btree (email_type);


--
-- Name: idx_feedback_assessment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_assessment ON public.feedback USING btree (assessment_id);


--
-- Name: idx_feedback_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_contact ON public.feedback USING btree (contact_id);


--
-- Name: idx_feedback_pillar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_pillar ON public.feedback USING btree (weakest_pillar);


--
-- Name: idx_free_book_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_free_book_email ON public.free_book_signups USING btree (email);


--
-- Name: idx_free_book_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_free_book_token ON public.free_book_signups USING btree (token);


--
-- Name: idx_health_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_service ON public.system_health_log USING btree (service);


--
-- Name: idx_intimacy_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intimacy_contact ON public.intimacy_results USING btree (contact_id);


--
-- Name: idx_intimacy_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intimacy_partner ON public.intimacy_results USING btree (partner_contact_id);


--
-- Name: idx_love_language_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_love_language_contact ON public.love_language_results USING btree (contact_id);


--
-- Name: idx_partner_profiles_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_profiles_contact ON public.partner_profiles USING btree (contact_id);


--
-- Name: idx_partner_profiles_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_profiles_referral_code ON public.partner_profiles USING btree (referral_code);


--
-- Name: idx_progress_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_progress_contact ON public.assessment_progress USING btree (contact_id);


--
-- Name: idx_question_bank_pillar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_bank_pillar ON public.question_bank USING btree (pillar);


--
-- Name: idx_referrals_code_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_code_used ON public.referrals USING btree (referral_code_used);


--
-- Name: idx_referrals_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_partner ON public.referrals USING btree (partner_id);


--
-- Name: idx_referrals_referred_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referred_contact ON public.referrals USING btree (referred_contact_id);


--
-- Name: idx_relationship_matrix_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationship_matrix_contact ON public.relationship_matrix USING btree (contact_id);


--
-- Name: idx_relationship_matrix_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationship_matrix_partner ON public.relationship_matrix USING btree (partner_contact_id);


--
-- Name: idx_subscriber_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_active ON public.rfm_subscriber_progress USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_system_registry_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_registry_type ON public.system_registry USING btree (system_type);


--
-- Name: idx_team_members_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_contact ON public.team_members USING btree (contact_id);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_uf_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uf_category ON public.user_feedback USING btree (category);


--
-- Name: idx_uf_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uf_created ON public.user_feedback USING btree (created_at DESC);


--
-- Name: idx_uf_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uf_email ON public.user_feedback USING btree (email);


--
-- Name: idx_uf_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uf_status ON public.user_feedback USING btree (status);


--
-- Name: idx_user_profiles_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_contact ON public.user_profiles USING btree (contact_id);


--
-- Name: idx_user_profiles_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_contact_id ON public.user_profiles USING btree (contact_id);


--
-- Name: idx_user_profiles_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_parent ON public.user_profiles USING btree (parent_id);


--
-- Name: idx_user_profiles_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_partner ON public.user_profiles USING btree (partner_id);


--
-- Name: idx_vault_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_folder ON public.vault_content USING btree (folder);


--
-- Name: idx_vault_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_search ON public.vault_content USING gin (to_tsvector('english'::regconfig, content));


--
-- Name: idx_vault_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_tags ON public.vault_content USING gin (tags);


--
-- Name: answer_history answer_history_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_history
    ADD CONSTRAINT answer_history_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id);


--
-- Name: answer_history answer_history_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_history
    ADD CONSTRAINT answer_history_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: answer_history answer_history_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_history
    ADD CONSTRAINT answer_history_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id);


--
-- Name: assessment_progress assessment_progress_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_progress
    ADD CONSTRAINT assessment_progress_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: challenges challenges_baseline_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_baseline_assessment_id_fkey FOREIGN KEY (baseline_assessment_id) REFERENCES public.assessments(id);


--
-- Name: challenges challenges_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: challenges challenges_reassessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_reassessment_id_fkey FOREIGN KEY (reassessment_id) REFERENCES public.assessments(id);


--
-- Name: cherish_honor_matrix cherish_honor_matrix_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cherish_honor_matrix
    ADD CONSTRAINT cherish_honor_matrix_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: commissions commissions_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partner_profiles(id);


--
-- Name: commissions commissions_referral_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.referrals(id);


--
-- Name: couple_challenge_responses couple_challenge_responses_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenge_responses
    ADD CONSTRAINT couple_challenge_responses_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.couple_challenges(id);


--
-- Name: couple_challenge_responses couple_challenge_responses_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenge_responses
    ADD CONSTRAINT couple_challenge_responses_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: couple_challenges couple_challenges_baseline_matrix_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenges
    ADD CONSTRAINT couple_challenges_baseline_matrix_a_fkey FOREIGN KEY (baseline_matrix_a) REFERENCES public.relationship_matrix(id);


--
-- Name: couple_challenges couple_challenges_baseline_matrix_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenges
    ADD CONSTRAINT couple_challenges_baseline_matrix_b_fkey FOREIGN KEY (baseline_matrix_b) REFERENCES public.relationship_matrix(id);


--
-- Name: couple_challenges couple_challenges_couple_profile_id_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenges
    ADD CONSTRAINT couple_challenges_couple_profile_id_a_fkey FOREIGN KEY (couple_profile_id_a) REFERENCES public.user_profiles(id);


--
-- Name: couple_challenges couple_challenges_couple_profile_id_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.couple_challenges
    ADD CONSTRAINT couple_challenges_couple_profile_id_b_fkey FOREIGN KEY (couple_profile_id_b) REFERENCES public.user_profiles(id);


--
-- Name: dating_email_verify dating_email_verify_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_email_verify
    ADD CONSTRAINT dating_email_verify_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: dating_profiles dating_profiles_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dating_profiles
    ADD CONSTRAINT dating_profiles_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: feedback feedback_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id);


--
-- Name: feedback feedback_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: intimacy_results intimacy_results_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intimacy_results
    ADD CONSTRAINT intimacy_results_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: intimacy_results intimacy_results_partner_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intimacy_results
    ADD CONSTRAINT intimacy_results_partner_contact_id_fkey FOREIGN KEY (partner_contact_id) REFERENCES public.contacts(id);


--
-- Name: love_language_results love_language_results_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.love_language_results
    ADD CONSTRAINT love_language_results_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: partner_profiles partner_profiles_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profiles
    ADD CONSTRAINT partner_profiles_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: referrals referrals_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partner_profiles(id);


--
-- Name: referrals referrals_referred_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_contact_id_fkey FOREIGN KEY (referred_contact_id) REFERENCES public.contacts(id);


--
-- Name: relationship_matrix relationship_matrix_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_matrix
    ADD CONSTRAINT relationship_matrix_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: relationship_matrix relationship_matrix_partner_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_matrix
    ADD CONSTRAINT relationship_matrix_partner_contact_id_fkey FOREIGN KEY (partner_contact_id) REFERENCES public.contacts(id);


--
-- Name: rfm_devotionals rfm_devotionals_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfm_devotionals
    ADD CONSTRAINT rfm_devotionals_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.rfm_chapters(id);


--
-- Name: user_profiles user_profiles_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: user_profiles user_profiles_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.user_profiles(id);


--
-- Name: user_profiles user_profiles_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.user_profiles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict CIegZH6EJjVqMmgIIKSaWku1fTIpUDyJ9dtVdChEA62bShmFx7caKeq5WItUnbL

