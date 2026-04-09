## agent_rules
  id: integer = nextval('agent_rules_id_seq'::regclass)
  agent_name: text
  rule_key: text
  rule_config: jsonb? = '{}'::jsonb
  weight: double precision? = 1.0
  times_fired: integer? = 0
  times_succeeded: integer? = 0
  last_fired_at: timestamp without time zone?
  created_at: timestamp without time zone? = now()

## agent_state
  id: integer = nextval('agent_state_id_seq'::regclass)
  agent_name: text
  run_at: timestamp without time zone? = now()
  observations: jsonb? = '{}'::jsonb
  decisions: jsonb? = '{}'::jsonb
  actions_taken: jsonb? = '[]'::jsonb
  outcome: jsonb? = '{}'::jsonb
  learning_updates: jsonb? = '{}'::jsonb

## analytics_events
  id: integer = nextval('analytics_events_id_seq'::regcl
  event_type: text
  contact_id: integer?
  session_id: text?
  metadata: jsonb? = '{}'::jsonb
  ip_hash: text?
  user_agent: text?
  referrer: text?
  created_at: timestamp without time zone? = now()

## answer_history
  id: integer = nextval('answer_history_id_seq'::regclas
  contact_id: integer
  question_id: text
  answer_value: integer
  assessment_id: integer?
  answered_at: timestamp with time zone? = now()

## assessment_progress
  id: integer = nextval('assessment_progress_id_seq'::re
  contact_id: integer?
  answers: jsonb? = '{}'::jsonb
  current_question_index: integer? = 0
  mode: text? = 'individual'::text
  depth: text? = 'extensive'::text
  total_questions: integer? = 0
  updated_at: timestamp with time zone? = now()

## assessments
  id: integer = nextval('assessments_id_seq'::regclass)
  contact_id: integer
  completed_at: text
  mode: text = 'individual'::text
  team_id: integer?
  is_team_creator: integer? = 0
  time_awareness: integer
  time_allocation: integer
  time_protection: integer
  time_leverage: integer
  five_hour_leak: integer
  value_per_hour: integer
  time_investment: integer
  downtime_quality: integer
  foresight: integer
  time_reallocation: integer
  time_total: integer
  trust_investment: integer
  boundary_quality: integer
  network_depth: integer
  relational_roi: integer
  people_audit: integer
  alliance_building: integer
  love_bank_deposits: integer
  communication_clarity: integer
  restraint_practice: integer
  value_replacement: integer
  people_total: integer
  leadership_level: integer
  integrity_alignment: integer
  professional_credibility: integer
  empathetic_listening: integer
  gravitational_center: integer
  micro_honesties: integer
  word_management: integer
  personal_responsibility: integer
  adaptive_influence: integer
  influence_multiplier: integer
  influence_total: integer
  financial_awareness: integer
  goal_specificity: integer
  investment_logic: integer
  measurement_habit: integer
  cost_vs_value: integer
  number_one_clarity: integer
  small_improvements: integer
  negative_math: integer
  income_multiplier: integer
  negotiation_skill: integer
  numbers_total: integer
  learning_hours: integer
  application_rate: integer
  bias_awareness: integer
  highest_best_use: integer
  supply_and_demand: integer
  substitution_risk: integer
  double_jeopardy: integer
  knowledge_compounding: integer
  weighted_analysis: integer
  perception_vs_perspective: integer
  knowledge_total: integer
  time_multiplier: real
  raw_score: integer
  master_score: real
  score_range: text
  weakest_pillar: text
  prescription: text
  overlay_answers: text?
  overlay_total: integer?
  depth: text? = 'extensive'::text
  focus_pillar: text?
  report_unlocked: boolean? = false
  privacy_level: text? = 'self_only'::text

## challenges
  id: integer = nextval('challenges_id_seq'::regclass)
  contact_id: integer
  baseline_assessment_id: integer
  enrolled_at: timestamp with time zone? = now()
  day_90_date: timestamp with time zone
  reassessment_id: integer?
  status: text? = 'active'::text

## cherish_honor_matrix
  id: integer = nextval('cherish_honor_matrix_id_seq'::r
  contact_id: integer
  gender: text
  cherish_words: integer? = 0
  cherish_time: integer? = 0
  cherish_service: integer? = 0
  cherish_gifts: integer? = 0
  cherish_touch: integer? = 0
  cherish_total: integer? = 0
  honor_words: integer? = 0
  honor_time: integer? = 0
  honor_service: integer? = 0
  honor_gifts: integer? = 0
  honor_touch: integer? = 0
  honor_total: integer? = 0
  completed_at: timestamp with time zone? = now()

## coaching_requests
  id: integer = nextval('coaching_requests_id_seq'::regc
  assessment_id: text?
  contact_id: integer?
  name: text
  email: text
  track: text
  goals: text
  questions: text
  biggest_challenge: text
  re_years: text?
  re_specialty: text?
  re_volume: text?
  company_name: text?
  company_role: text?
  company_size: text?
  company_department: text?
  verification_token: text?
  verified: boolean? = false
  verified_at: timestamp with time zone?
  report_sent: boolean? = false
  report_sent_at: timestamp with time zone?
  created_at: timestamp with time zone? = now()

## coaching_sequences
  id: integer = nextval('coaching_sequences_id_seq'::reg
  email: text
  assessment_id: integer
  current_day: integer? = 0
  last_sent_at: timestamp without time zone?
  started_at: timestamp without time zone? = now()
  unsubscribed: boolean? = false
  created_at: timestamp without time zone? = now()
  engagement_score: double precision? = 0
  email_variant: text? = 'default'::text
  persona: text? = 'standard'::text

## commissions
  id: integer = nextval('commissions_id_seq'::regclass)
  partner_id: integer
  referral_id: integer?
  type: text
  amount_cents: integer
  description: text?
  period_start: date?
  period_end: date?
  status: text? = 'pending'::text
  paid_at: timestamp with time zone?
  created_at: timestamp with time zone? = now()

## contacts
  id: integer = nextval('contacts_id_seq'::regclass)
  first_name: text
  last_name: text
  email: text
  phone: text?
  created_at: text
  hubspot_synced: integer? = 0
  pin_hash: text?
  pin_set_at: timestamp without time zone?

## couple_challenge_responses
  id: integer = nextval('couple_challenge_responses_id_s
  challenge_id: integer
  contact_id: integer
  day_number: integer
  prompt_text: text
  response_text: text?
  completed: boolean? = false
  completed_at: timestamp with time zone?

## couple_challenges
  id: integer = nextval('couple_challenges_id_seq'::regc
  couple_profile_id_a: integer
  couple_profile_id_b: integer
  start_date: date
  end_date: date
  current_day: integer? = 1
  status: text? = 'active'::text
  baseline_matrix_a: integer?
  baseline_matrix_b: integer?
  created_at: timestamp with time zone? = now()

## couples
  id: integer = nextval('couples_id_seq'::regclass)
  initiator_contact_id: integer
  partner_email: text
  partner_contact_id: integer?
  partner_name: text
  invite_code: text
  status: text? = 'pending'::text
  created_at: timestamp with time zone? = now()
  completed_at: timestamp with time zone?

## digital_purchases
  id: integer = nextval('digital_purchases_id_seq'::regc
  email: character varying
  product_id: character varying
  stripe_product_id: character varying?
  stripe_payment_intent: character varying?
  granted_by: character varying? = 'purchase'::character varying
  granted_at: timestamp with time zone? = now()

## email_engagement
  id: integer = nextval('email_engagement_id_seq'::regcl
  contact_id: integer?
  email: text
  coaching_day: integer?
  sent_at: timestamp without time zone? = now()
  opened_at: timestamp without time zone?
  clicked_at: timestamp without time zone?
  action_completed: boolean? = false
  retook_assessment: boolean? = false
  email_variant: text? = 'default'::text
  metadata: jsonb? = '{}'::jsonb

## email_log
  id: integer = nextval('email_log_id_seq'::regclass)
  recipient: text
  email_type: text
  subject: text?
  contact_id: integer?
  assessment_id: integer?
  status: text? = 'sent'::text
  metadata: jsonb?
  sent_at: timestamp without time zone? = now()

## feedback
  id: integer = nextval('feedback_id_seq'::regclass)
  contact_id: integer?
  assessment_id: integer?
  weakest_pillar: text
  weakest_sub_categories: jsonb?
  score_range: text?
  created_at: timestamp with time zone? = now()

## free_book_signups
  id: integer = nextval('free_book_signups_id_seq'::regc
  email: text
  name: text
  token: text
  verified: boolean? = false
  created_at: timestamp with time zone? = now()
  verified_at: timestamp with time zone?

## funnel_summary
  event_type: text?
  total_events: bigint?
  unique_contacts: bigint?
  unique_sessions: bigint?
  event_date: timestamp without time zone?

## intimacy_results
  id: integer = nextval('intimacy_results_id_seq'::regcl
  contact_id: integer
  partner_contact_id: integer?
  comfort_safety: integer? = 0
  touch_pace: integer? = 0
  initiation_roles: integer? = 0
  rhythm_frequency: integer? = 0
  exploration_feedback: integer? = 0
  total_score: integer? = 0
  consent_both_partners: boolean? = false
  completed_at: timestamp with time zone? = now()

## love_language_results
  id: integer = nextval('love_language_results_id_seq'::
  contact_id: integer
  words_of_affirmation_give: integer? = 0
  words_of_affirmation_receive: integer? = 0
  quality_time_give: integer? = 0
  quality_time_receive: integer? = 0
  acts_of_service_give: integer? = 0
  acts_of_service_receive: integer? = 0
  gifts_give: integer? = 0
  gifts_receive: integer? = 0
  physical_touch_give: integer? = 0
  physical_touch_receive: integer? = 0
  primary_give_language: text?
  primary_receive_language: text?
  completed_at: timestamp with time zone? = now()

## member_referral_rewards
  id: integer = nextval('member_referral_rewards_id_seq'
  contact_id: integer
  referred_contact_id: integer
  referral_link_code: text
  credit_amount_cents: integer? = 0
  status: text? = 'pending'::text
  created_at: timestamp with time zone? = now()

## page_analytics
  id: integer = nextval('page_analytics_id_seq'::regclas
  page_path: text
  period_start: date
  period_end: date
  views: integer? = 0
  unique_visitors: integer? = 0
  bounce_rate: double precision? = 0
  conversion_rate: double precision? = 0
  drop_off_rate: double precision? = 0
  insights: jsonb? = '{}'::jsonb

## partner_profiles
  id: integer = nextval('partner_profiles_id_seq'::regcl
  contact_id: integer
  referral_code: text
  partner_type: text? = 'affiliate'::text
  status: text? = 'pending'::text
  profession: text?
  license_info: text?
  coaching_split: integer? = 80
  total_referrals: integer? = 0
  total_earnings_cents: integer? = 0
  royalty_tier: text? = 'none'::text
  applied_at: timestamp with time zone? = now()
  approved_at: timestamp with time zone?
  created_at: timestamp with time zone? = now()
  updated_at: timestamp with time zone? = now()

## peer_ratings
  id: integer = nextval('peer_ratings_id_seq'::regclass)
  team_id: integer
  rater_id: integer
  target_id: integer
  ratings: text
  ratings_total: integer
  created_at: text

## privacy_preferences
  id: integer = nextval('privacy_preferences_id_seq'::re
  contact_id: integer
  team_id: integer?
  share_time: boolean? = true
  share_people: boolean? = false
  share_influence: boolean? = true
  share_numbers: boolean? = false
  share_knowledge: boolean? = true
  share_sub_categories: boolean? = false
  share_prescriptions: boolean? = false
  updated_at: timestamp without time zone? = now()

## question_bank
  id: text
  pillar: text
  sub_category: text
  field_name: text
  question: text
  description: text
  options: jsonb
  is_active: boolean? = true
  is_overlay: boolean? = false
  overlay_type: text?
  created_at: timestamp with time zone? = now()
  sort_order: integer? = 0

## referrals
  id: integer = nextval('referrals_id_seq'::regclass)
  partner_id: integer
  referred_contact_id: integer
  referred_email: text
  membership_tier: text?
  stripe_subscription_id: text?
  status: text? = 'signed_up'::text
  referral_code_used: text
  signed_up_at: timestamp with time zone? = now()
  activated_at: timestamp with time zone?
  churned_at: timestamp with time zone?

## relationship_matrix
  id: integer = nextval('relationship_matrix_id_seq'::re
  contact_id: integer
  partner_contact_id: integer?
  gender: text
  practical_give: integer? = 0
  practical_receive: integer? = 0
  mental_load_give: integer? = 0
  mental_load_receive: integer? = 0
  financial_give: integer? = 0
  financial_receive: integer? = 0
  relational_give: integer? = 0
  relational_receive: integer? = 0
  growth_give: integer? = 0
  growth_receive: integer? = 0
  give_total: integer? = 0
  receive_total: integer? = 0
  domain_gap: integer? = 0
  completed_at: timestamp with time zone? = now()

## rfm_chapters
  id: integer = nextval('rfm_chapters_id_seq'::regclass)
  chapter_number: integer
  title: text
  book_page: integer?
  word_count: integer?
  themes: ARRAY? = '{}'::text[]
  bible_verses: ARRAY? = '{}'::text[]
  summary: text?
  reflection_prompt: text?
  created_at: timestamp with time zone? = now()

## rfm_devotionals
  id: integer = nextval('rfm_devotionals_id_seq'::regcla
  chapter_id: integer?
  day_number: integer
  title: text
  theme: text
  scripture_reference: text?
  scripture_text: text?
  reflection: text
  prayer: text?
  action_step: text?
  podcast_topic: text?
  social_media_post: text?
  is_published: boolean? = false
  scheduled_date: date?
  created_at: timestamp with time zone? = now()

## rfm_subscriber_progress
  id: integer = nextval('rfm_subscriber_progress_id_seq'
  email: text
  current_day: integer? = 1
  started_at: timestamp with time zone? = now()
  last_sent_at: timestamp with time zone?
  is_active: boolean? = true

## system_health_log
  id: integer = nextval('system_health_log_id_seq'::regc
  checked_at: timestamp without time zone? = now()
  service: text
  status: text
  response_time_ms: integer?
  details: jsonb? = '{}'::jsonb
  alert_sent: boolean? = false
  auto_healed: boolean? = false
  heal_action: text?

## team_members
  id: integer = nextval('team_members_id_seq'::regclass)
  team_id: integer
  contact_id: integer
  member_number: integer
  current_focus: text? = ''::text
  end_year_goals: text? = ''::text
  department: text? = ''::text
  role_title: text? = ''::text
  custom_code: text? = ''::text
  notes: text? = ''::text
  joined_at: timestamp without time zone? = now()
  updated_at: timestamp without time zone? = now()
  visibility_consent: boolean? = false
  consent_given_at: timestamp without time zone?

## teams
  id: integer = nextval('teams_id_seq'::regclass)
  name: text
  created_by: integer
  mode: text
  invite_code: text
  created_at: text
  company_email: text? = ''::text
  company_name: text? = ''::text
  company_domain: text? = ''::text
  admin_contact_name: text? = ''::text
  billing_email: text? = ''::text
  integration_webhook: text? = ''::text
  report_frequency: text? = 'monthly'::text
  auto_report_enabled: boolean? = false

## user_profiles
  id: integer = nextval('user_profiles_id_seq'::regclass
  contact_id: integer
  date_of_birth: date?
  age: integer?
  gender: text?
  membership_tier: text? = 'free'::text
  stripe_customer_id: text?
  stripe_subscription_id: text?
  partner_id: integer?
  parent_id: integer?
  is_dependent: boolean? = false
  consent_given: boolean? = false
  consent_given_at: timestamp with time zone?
  faith_disclaimer_accepted: boolean? = false
  created_at: timestamp with time zone? = now()
  updated_at: timestamp with time zone? = now()

## vault_content
  id: integer = nextval('vault_content_id_seq'::regclass
  file_path: text
  folder: text?
  title: text?
  content: text?
  word_count: integer? = 0
  tags: ARRAY? = '{}'::text[]
  links: ARRAY? = '{}'::text[]
  frontmatter: jsonb? = '{}'::jsonb
  content_hash: text?
  last_synced: timestamp without time zone? = now()
  created_at: timestamp without time zone? = now()
