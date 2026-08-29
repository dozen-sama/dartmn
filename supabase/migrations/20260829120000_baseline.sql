-- ============================================================================
-- DartMN — Clean Baseline Migration
-- ============================================================================
-- Represents the CURRENT live application schema on Supabase project
-- `idomtybdmqhsxbuttubk` (mongol-darts) as of 2026-08-29, AFTER the
-- 2026-08-29 security hotfix (see supabase/migration-archive/security/
-- 20260829_security_hotfix_rpc_storage.sql) was applied live.
--
-- This migration is a reconstruction from live pg_catalog / information_schema
-- introspection (read-only), not a replay of history. It intentionally does
-- NOT reproduce the pre-hotfix vulnerable RPC/storage grants.
--
-- Ordering (dependency-safe):
--   1. Extensions
--   2. Tables (columns only)
--   3. Constraints (PK/UNIQUE/CHECK, then FK)
--   4. Indexes (non-constraint-backed)
--   5. Functions
--   6. Triggers
--   7. RLS enable
--   8. RLS policies
--   9. Grants / RPC EXECUTE restrictions
--   10. View(s)
--   11. auth.users trigger attachment
--   12. Storage bucket configuration
--   13. Storage policies
--   14. Realtime publication membership
--
-- Do NOT re-apply supabase/migration-archive/security/20260829_security_hotfix_rpc_storage.sql
-- after this baseline — its effects are already baked in here.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


-- ============================================================================
-- 2. TABLES (columns only — constraints added separately below)
-- ============================================================================

CREATE TABLE public.achievements (
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text DEFAULT 'general'::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.caller_clips (
  key text NOT NULL,
  ext text DEFAULT 'webm'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.club_join_requests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.club_members (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  role text DEFAULT 'member'::text NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.club_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.club_subscriptions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  club_id uuid NOT NULL,
  plan text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  amount integer NOT NULL,
  payment_id uuid
);

CREATE TABLE public.clubs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  logo_url text,
  cover_url text,
  address text,
  city text,
  phone text,
  email text,
  website text,
  owner_id uuid NOT NULL,
  member_count integer DEFAULT 1 NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  club_score integer DEFAULT 0 NOT NULL,
  club_rank integer,
  subscription_plan text,
  subscription_expires_at timestamp with time zone,
  tag text,
  tagline text,
  features jsonb DEFAULT '[]'::jsonb,
  social_discord text,
  social_facebook text,
  social_instagram text,
  equipped_frame text,
  name_color text,
  name_font text,
  name_animated boolean DEFAULT true NOT NULL,
  name_effect text,
  tag_color text
);

CREATE TABLE public.cosmetic_effects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pass_id uuid,
  key text NOT NULL,
  name text NOT NULL,
  lottie_url text NOT NULL,
  xp integer DEFAULT 0 NOT NULL,
  fit text DEFAULT 'cover'::text NOT NULL,
  scale numeric DEFAULT 1 NOT NULL,
  scope text DEFAULT 'profile'::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  offset_x numeric DEFAULT 0 NOT NULL,
  offset_y numeric DEFAULT 0 NOT NULL,
  scale_y numeric DEFAULT 1 NOT NULL
);

CREATE TABLE public.cosmetic_passes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.league_standings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  league_id uuid NOT NULL,
  player_id uuid NOT NULL,
  played integer DEFAULT 0 NOT NULL,
  won integer DEFAULT 0 NOT NULL,
  lost integer DEFAULT 0 NOT NULL,
  drawn integer DEFAULT 0 NOT NULL,
  legs_won integer DEFAULT 0 NOT NULL,
  legs_lost integer DEFAULT 0 NOT NULL,
  points integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leagues (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  description text,
  season text NOT NULL,
  format text NOT NULL,
  status text DEFAULT 'upcoming'::text NOT NULL,
  max_teams integer DEFAULT 16 NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.local_session_sync (
  session_id text NOT NULL,
  data jsonb NOT NULL,
  password_hash text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.match_legs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  match_id uuid NOT NULL,
  leg_number integer NOT NULL,
  player1_score integer DEFAULT 0 NOT NULL,
  player2_score integer DEFAULT 0 NOT NULL,
  winner_id uuid,
  player1_darts integer DEFAULT 0 NOT NULL,
  player2_darts integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.match_stat_details (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  player_id uuid NOT NULL,
  opponent_id uuid,
  opponent_name text NOT NULL,
  won boolean NOT NULL,
  legs_for smallint NOT NULL,
  legs_against smallint NOT NULL,
  source text NOT NULL,
  room_id uuid,
  local_session_id text,
  local_match_id text,
  tournament_match_id uuid,
  context_label text,
  match_key text NOT NULL,
  format text NOT NULL,
  double_out boolean NOT NULL,
  darts_thrown integer NOT NULL,
  points_scored integer NOT NULL,
  avg3 numeric NOT NULL,
  avg_first9 numeric NOT NULL,
  band_60 smallint DEFAULT 0 NOT NULL,
  band_80 smallint DEFAULT 0 NOT NULL,
  band_100 smallint DEFAULT 0 NOT NULL,
  band_120 smallint DEFAULT 0 NOT NULL,
  band_140 smallint DEFAULT 0 NOT NULL,
  band_170 smallint DEFAULT 0 NOT NULL,
  count_180 smallint DEFAULT 0 NOT NULL,
  high_finish smallint DEFAULT 0 NOT NULL,
  count_100_finishes smallint DEFAULT 0 NOT NULL,
  best_leg_darts smallint,
  worst_leg_darts smallint,
  checkout_attempts smallint DEFAULT 0 NOT NULL,
  checkout_makes smallint DEFAULT 0 NOT NULL,
  keep_attempts smallint DEFAULT 0 NOT NULL,
  keep_makes smallint DEFAULT 0 NOT NULL,
  break_attempts smallint DEFAULT 0 NOT NULL,
  break_makes smallint DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.matches (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  tournament_id uuid,
  league_id uuid,
  round integer,
  match_number integer,
  player1_id uuid NOT NULL,
  player2_id uuid,
  format text NOT NULL,
  best_of integer DEFAULT 3 NOT NULL,
  player1_legs integer DEFAULT 0 NOT NULL,
  player2_legs integer DEFAULT 0 NOT NULL,
  winner_id uuid,
  status text DEFAULT 'scheduled'::text NOT NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.matchmaking_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  player_id uuid NOT NULL,
  rating_points integer NOT NULL,
  format text DEFAULT '501'::text NOT NULL,
  best_of integer DEFAULT 3 NOT NULL,
  double_out boolean DEFAULT true NOT NULL,
  room_id uuid,
  status text DEFAULT 'searching'::text NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean DEFAULT false NOT NULL,
  link text,
  icon text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.online_rooms (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  room_code text NOT NULL,
  host_id uuid NOT NULL,
  guest_id uuid,
  format text NOT NULL,
  best_of integer DEFAULT 3 NOT NULL,
  status text DEFAULT 'waiting'::text NOT NULL,
  match_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  mode text DEFAULT '1v1'::text NOT NULL,
  double_out boolean DEFAULT true NOT NULL,
  starter_team smallint,
  winner_team smallint,
  limit_rounds smallint,
  bull_finish boolean DEFAULT false NOT NULL,
  start_method text DEFAULT 'random'::text NOT NULL,
  tournament_match_id uuid,
  legs_per_set smallint,
  decide_vote_team smallint,
  decide_vote_by uuid,
  loser_first boolean DEFAULT false NOT NULL,
  decide_vote_at timestamp with time zone
);

CREATE TABLE public.organizer_ratings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  tournament_id uuid NOT NULL,
  organizer_id uuid NOT NULL,
  rater_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  payout_status text
);

CREATE TABLE public.payment_transactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  player_id uuid NOT NULL,
  tournament_id uuid,
  amount integer NOT NULL,
  currency text DEFAULT 'MNT'::text NOT NULL,
  provider text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  invoice_id text,
  qr_text text,
  deep_link text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  consumed_at timestamp with time zone
);

CREATE TABLE public.pending_match_results (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  reporter_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  winner_id uuid NOT NULL,
  format text,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.player_achievements (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  player_id uuid NOT NULL,
  achievement_key text NOT NULL,
  earned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.player_subscriptions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  player_id uuid NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  amount integer DEFAULT 9900 NOT NULL,
  payment_id uuid
);

CREATE TABLE public.player_unlocks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  player_id uuid NOT NULL,
  item_kind text NOT NULL,
  item_key text NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.practice_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  player_id uuid NOT NULL,
  mode text NOT NULL,
  headline_metric numeric NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb NOT NULL,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  cover_url text,
  phone text,
  gender text,
  date_of_birth date,
  city text,
  bio text,
  role text DEFAULT 'player'::text NOT NULL,
  rating_points integer DEFAULT 1000 NOT NULL,
  matches_played integer DEFAULT 0 NOT NULL,
  matches_won integer DEFAULT 0 NOT NULL,
  tournament_wins integer DEFAULT 0 NOT NULL,
  average_score numeric(5,2) DEFAULT 0 NOT NULL,
  checkout_percentage numeric(5,4) DEFAULT 0 NOT NULL,
  highest_checkout integer DEFAULT 0 NOT NULL,
  count_180 integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  province text,
  best_leg integer DEFAULT 0 NOT NULL,
  is_premium boolean DEFAULT false NOT NULL,
  premium_expires_at timestamp with time zone,
  primary_club_id uuid,
  primary_club_logo text,
  primary_club_tag text,
  avraga_wins integer DEFAULT 0 NOT NULL,
  equipped_frame text,
  name_color text,
  name_font text,
  name_animated boolean DEFAULT true NOT NULL,
  name_effect text,
  primary_club_tag_color text,
  career_points integer DEFAULT 0 NOT NULL,
  career_darts integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.rating_history (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  player_id uuid NOT NULL,
  rating_before integer NOT NULL,
  rating_after integer NOT NULL,
  change integer NOT NULL,
  match_id uuid,
  reason text DEFAULT 'match'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  opponent_id uuid,
  won boolean,
  room_id uuid
);

CREATE TABLE public.room_invites (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  room_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  team smallint NOT NULL,
  slot smallint NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.room_players (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  room_id uuid NOT NULL,
  player_id uuid NOT NULL,
  team smallint NOT NULL,
  slot smallint NOT NULL,
  is_ready boolean DEFAULT false NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  bulloff smallint
);

CREATE TABLE public.room_visits (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  room_id uuid NOT NULL,
  seq integer NOT NULL,
  team smallint NOT NULL,
  slot smallint NOT NULL,
  points integer NOT NULL,
  darts smallint DEFAULT 3 NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.synced_local_sessions (
  session_id uuid NOT NULL,
  synced_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.throws (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  leg_id uuid NOT NULL,
  player_id uuid NOT NULL,
  throw_number integer NOT NULL,
  score integer NOT NULL,
  darts_used integer DEFAULT 3 NOT NULL,
  remaining integer NOT NULL,
  is_checkout boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tournament_entrant_players (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  entrant_id uuid NOT NULL,
  player_id uuid NOT NULL,
  slot smallint DEFAULT 0 NOT NULL
);

CREATE TABLE public.tournament_entrants (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  tournament_id uuid NOT NULL,
  display_name text NOT NULL,
  seed integer NOT NULL,
  group_no integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tournament_matches (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  tournament_id uuid NOT NULL,
  round integer NOT NULL,
  match_number integer NOT NULL,
  is_losers_bracket boolean DEFAULT false NOT NULL,
  group_no integer,
  side1_entrant_id uuid,
  side2_entrant_id uuid,
  side1_legs integer DEFAULT 0 NOT NULL,
  side2_legs integer DEFAULT 0 NOT NULL,
  winner_entrant_id uuid,
  loser_entrant_id uuid,
  status text DEFAULT 'pending'::text NOT NULL,
  next_match_id uuid,
  next_loser_match_id uuid,
  room_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  stage_id uuid
);

CREATE TABLE public.tournament_payout_accounts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  tournament_id uuid NOT NULL,
  player_id uuid NOT NULL,
  bank_name text NOT NULL,
  iban text,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tournament_registrations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  tournament_id uuid NOT NULL,
  player_id uuid NOT NULL,
  seed integer,
  payment_status text DEFAULT 'pending'::text NOT NULL,
  payment_id uuid,
  registered_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tournament_stages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tournament_id uuid NOT NULL,
  order_no integer DEFAULT 0 NOT NULL,
  stage_type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tournaments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  description text,
  club_id uuid,
  organizer_id uuid NOT NULL,
  format text NOT NULL,
  type text DEFAULT 'singles'::text NOT NULL,
  bracket_type text DEFAULT 'single_elimination'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  max_players integer DEFAULT 16 NOT NULL,
  current_players integer DEFAULT 0 NOT NULL,
  entry_fee integer DEFAULT 0 NOT NULL,
  prize_pool integer DEFAULT 0 NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  registration_deadline timestamp with time zone,
  location text,
  banner_url text,
  rules text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  join_code text,
  password text,
  is_private boolean DEFAULT false NOT NULL,
  first_to integer DEFAULT 2 NOT NULL,
  sets_enabled boolean DEFAULT false NOT NULL,
  legs_per_set integer DEFAULT 3 NOT NULL,
  limit_rounds integer,
  loser_first boolean DEFAULT false NOT NULL,
  show_average boolean DEFAULT true NOT NULL,
  auto_complete boolean DEFAULT true NOT NULL,
  confirm_opponent boolean DEFAULT false NOT NULL,
  allow_participant_score boolean DEFAULT false NOT NULL,
  show_index boolean DEFAULT true NOT NULL,
  point_won integer DEFAULT 2 NOT NULL,
  point_draw integer DEFAULT 1 NOT NULL,
  point_lost integer DEFAULT 0 NOT NULL,
  win_points_are_legs boolean DEFAULT false NOT NULL,
  tournament_type text DEFAULT 'open'::text NOT NULL,
  platform_fee integer DEFAULT 0 NOT NULL,
  double_out boolean DEFAULT true NOT NULL,
  double_in boolean DEFAULT false NOT NULL,
  bull_finish_at_limit boolean DEFAULT false NOT NULL,
  enable_draw boolean DEFAULT false NOT NULL,
  third_place_match boolean DEFAULT false NOT NULL,
  groups_count integer DEFAULT 1 NOT NULL,
  group_advance integer DEFAULT 1 NOT NULL,
  players_per_group integer DEFAULT 4 NOT NULL,
  rr_first_to integer DEFAULT 2 NOT NULL,
  rr_sets_enabled boolean DEFAULT false NOT NULL,
  rr_legs_per_set integer DEFAULT 3 NOT NULL,
  organizer_bank_name text,
  organizer_iban text,
  organizer_account_number text,
  organizer_account_holder text,
  platform_fee_paid boolean DEFAULT false NOT NULL,
  stats_enabled boolean DEFAULT false NOT NULL,
  uses_stages boolean DEFAULT false,
  current_stage_id uuid
);


-- ============================================================================
-- 3. CONSTRAINTS (PK, UNIQUE, CHECK, then FK)
-- ============================================================================

ALTER TABLE ONLY public.achievements ADD CONSTRAINT achievements_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.caller_clips ADD CONSTRAINT caller_clips_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.club_join_requests ADD CONSTRAINT club_join_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_messages ADD CONSTRAINT club_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_subscriptions ADD CONSTRAINT club_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cosmetic_effects ADD CONSTRAINT cosmetic_effects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cosmetic_passes ADD CONSTRAINT cosmetic_passes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.league_standings ADD CONSTRAINT league_standings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leagues ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.local_session_sync ADD CONSTRAINT local_session_sync_pkey PRIMARY KEY (session_id);
ALTER TABLE ONLY public.match_legs ADD CONSTRAINT match_legs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.matchmaking_queue ADD CONSTRAINT matchmaking_queue_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pending_match_results ADD CONSTRAINT pending_match_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.player_achievements ADD CONSTRAINT player_achievements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.player_subscriptions ADD CONSTRAINT player_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.player_unlocks ADD CONSTRAINT player_unlocks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.practice_sessions ADD CONSTRAINT practice_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.rating_history ADD CONSTRAINT rating_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.room_invites ADD CONSTRAINT room_invites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.room_players ADD CONSTRAINT room_players_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.room_visits ADD CONSTRAINT room_visits_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.synced_local_sessions ADD CONSTRAINT synced_local_sessions_pkey PRIMARY KEY (session_id);
ALTER TABLE ONLY public.throws ADD CONSTRAINT throws_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournament_entrant_players ADD CONSTRAINT tournament_entrant_players_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournament_entrants ADD CONSTRAINT tournament_entrants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournament_payout_accounts ADD CONSTRAINT tournament_payout_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournament_registrations ADD CONSTRAINT tournament_registrations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournament_stages ADD CONSTRAINT tournament_stages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_join_requests ADD CONSTRAINT club_join_requests_club_id_player_id_key UNIQUE (club_id, player_id);
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_club_id_player_id_key UNIQUE (club_id, player_id);
ALTER TABLE ONLY public.club_subscriptions ADD CONSTRAINT club_subscriptions_club_id_key UNIQUE (club_id);
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_tag_key UNIQUE (tag);
ALTER TABLE ONLY public.cosmetic_effects ADD CONSTRAINT cosmetic_effects_key_key UNIQUE (key);
ALTER TABLE ONLY public.league_standings ADD CONSTRAINT league_standings_league_id_player_id_key UNIQUE (league_id, player_id);
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_player_id_match_key_key UNIQUE (player_id, match_key);
ALTER TABLE ONLY public.matchmaking_queue ADD CONSTRAINT matchmaking_queue_player_id_unique UNIQUE (player_id);
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_room_code_key UNIQUE (room_code);
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_tournament_id_rater_id_key UNIQUE (tournament_id, rater_id);
ALTER TABLE ONLY public.player_achievements ADD CONSTRAINT player_achievements_player_id_achievement_key_key UNIQUE (player_id, achievement_key);
ALTER TABLE ONLY public.player_subscriptions ADD CONSTRAINT player_subscriptions_player_id_key UNIQUE (player_id);
ALTER TABLE ONLY public.player_unlocks ADD CONSTRAINT player_unlocks_player_id_item_kind_item_key_key UNIQUE (player_id, item_kind, item_key);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE ONLY public.room_invites ADD CONSTRAINT room_invites_room_id_invitee_id_key UNIQUE (room_id, invitee_id);
ALTER TABLE ONLY public.room_players ADD CONSTRAINT room_players_room_id_player_id_key UNIQUE (room_id, player_id);
ALTER TABLE ONLY public.room_players ADD CONSTRAINT room_players_room_id_team_slot_key UNIQUE (room_id, team, slot);
ALTER TABLE ONLY public.room_visits ADD CONSTRAINT room_visits_room_id_seq_key UNIQUE (room_id, seq);
ALTER TABLE ONLY public.tournament_entrant_players ADD CONSTRAINT tournament_entrant_players_entrant_id_player_id_key UNIQUE (entrant_id, player_id);
ALTER TABLE ONLY public.tournament_entrant_players ADD CONSTRAINT tournament_entrant_players_entrant_id_slot_key UNIQUE (entrant_id, slot);
ALTER TABLE ONLY public.tournament_payout_accounts ADD CONSTRAINT tournament_payout_accounts_tournament_id_player_id_key UNIQUE (tournament_id, player_id);
ALTER TABLE ONLY public.tournament_registrations ADD CONSTRAINT tournament_registrations_tournament_id_player_id_key UNIQUE (tournament_id, player_id);
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_join_code_key UNIQUE (join_code);
ALTER TABLE ONLY public.achievements ADD CONSTRAINT achievements_category_check CHECK ((category = ANY (ARRAY['match'::text, 'tournament'::text, 'score'::text, 'rating'::text, 'special'::text])));
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])));
ALTER TABLE ONLY public.club_messages ADD CONSTRAINT club_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)));
ALTER TABLE ONLY public.club_subscriptions ADD CONSTRAINT club_subscriptions_plan_check CHECK ((plan = ANY (ARRAY['basic'::text, 'pro'::text, 'enterprise'::text])));
ALTER TABLE ONLY public.club_subscriptions ADD CONSTRAINT club_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text])));
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_subscription_plan_check CHECK ((subscription_plan = ANY (ARRAY['basic'::text, 'pro'::text, 'enterprise'::text, NULL::text])));
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_tag_format CHECK (((tag IS NULL) OR (tag ~ '^[A-Z0-9]{2,5}$'::text)));
ALTER TABLE ONLY public.leagues ADD CONSTRAINT leagues_format_check CHECK ((format = ANY (ARRAY['501'::text, '301'::text, 'cricket'::text])));
ALTER TABLE ONLY public.leagues ADD CONSTRAINT leagues_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'ongoing'::text, 'completed'::text])));
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_source_check CHECK ((source = ANY (ARRAY['online'::text, 'local'::text])));
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_format_check CHECK ((format = ANY (ARRAY['501'::text, '301'::text, 'cricket'::text, 'cutthroat'::text])));
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'ongoing'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_format_check CHECK ((format = ANY (ARRAY['501'::text, '301'::text, '170'::text, 'cricket'::text])));
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_mode_check CHECK ((mode = ANY (ARRAY['1v1'::text, '2v2'::text, '3v3'::text])));
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_start_method_check CHECK ((start_method = ANY (ARRAY['random'::text, 'bulloff'::text])));
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'bulloff'::text, 'ongoing'::text, 'completed'::text])));
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_check CHECK ((rater_id <> organizer_id));
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_payout_status_check CHECK ((payout_status = ANY (ARRAY['paid'::text, 'unpaid'::text])));
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_provider_check CHECK ((provider = ANY (ARRAY['qpay'::text, 'socialpay'::text])));
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE ONLY public.player_subscriptions ADD CONSTRAINT player_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text])));
ALTER TABLE ONLY public.practice_sessions ADD CONSTRAINT practice_sessions_mode_check CHECK ((mode = ANY (ARRAY['solo501'::text, 'checkout_drill'::text, 'scoring_drill'::text, 'around_clock_singles'::text, 'around_clock_doubles'::text, 'around_clock_trebles'::text, 'bobs27'::text, 'checkout121'::text, 'cricket'::text, 'shanghai'::text])));
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])));
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['player'::text, 'club_admin'::text, 'admin'::text, 'owner'::text])));
ALTER TABLE ONLY public.room_invites ADD CONSTRAINT room_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])));
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ongoing'::text, 'completed'::text])));
ALTER TABLE ONLY public.tournament_registrations ADD CONSTRAINT tournament_registrations_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text])));
ALTER TABLE ONLY public.tournament_stages ADD CONSTRAINT tournament_stages_stage_type_check CHECK ((stage_type = ANY (ARRAY['group'::text, 'elimination'::text, 'round_robin'::text, 'swiss'::text, 'semifinal'::text, 'final'::text])));
ALTER TABLE ONLY public.tournament_stages ADD CONSTRAINT tournament_stages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text])));
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_bracket_type_check CHECK ((bracket_type = ANY (ARRAY['single_elimination'::text, 'double_elimination'::text, 'round_robin'::text, 'groups_knockout'::text, 'swiss'::text])));
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_format_check CHECK ((format = ANY (ARRAY['501'::text, '301'::text, 'cricket'::text, 'cutthroat'::text])));
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'registration'::text, 'ongoing'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_tournament_type_check CHECK ((tournament_type = ANY (ARRAY['open'::text, 'league'::text, 'national'::text, 'club'::text, 'friendly'::text])));
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_type_check CHECK ((type = ANY (ARRAY['singles'::text, 'doubles'::text, 'team'::text])));
ALTER TABLE ONLY public.club_join_requests ADD CONSTRAINT club_join_requests_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_join_requests ADD CONSTRAINT club_join_requests_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_messages ADD CONSTRAINT club_messages_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_messages ADD CONSTRAINT club_messages_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_subscriptions ADD CONSTRAINT club_subscriptions_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_subscriptions ADD CONSTRAINT club_subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payment_transactions(id);
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.cosmetic_effects ADD CONSTRAINT cosmetic_effects_pass_id_fkey FOREIGN KEY (pass_id) REFERENCES cosmetic_passes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.league_standings ADD CONSTRAINT league_standings_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.league_standings ADD CONSTRAINT league_standings_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leagues ADD CONSTRAINT leagues_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.match_legs ADD CONSTRAINT match_legs_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.match_legs ADD CONSTRAINT match_legs_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.match_stat_details ADD CONSTRAINT match_stat_details_tournament_match_id_fkey FOREIGN KEY (tournament_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.matches ADD CONSTRAINT matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.matchmaking_queue ADD CONSTRAINT matchmaking_queue_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.matchmaking_queue ADD CONSTRAINT matchmaking_queue_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_decide_vote_by_fkey FOREIGN KEY (decide_vote_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.online_rooms ADD CONSTRAINT online_rooms_tournament_match_id_fkey FOREIGN KEY (tournament_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_ratings ADD CONSTRAINT organizer_ratings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_match_results ADD CONSTRAINT pending_match_results_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pending_match_results ADD CONSTRAINT pending_match_results_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pending_match_results ADD CONSTRAINT pending_match_results_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.player_achievements ADD CONSTRAINT player_achievements_achievement_key_fkey FOREIGN KEY (achievement_key) REFERENCES achievements(key) ON DELETE CASCADE;
ALTER TABLE ONLY public.player_achievements ADD CONSTRAINT player_achievements_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.player_subscriptions ADD CONSTRAINT player_subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payment_transactions(id);
ALTER TABLE ONLY public.player_subscriptions ADD CONSTRAINT player_subscriptions_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.player_unlocks ADD CONSTRAINT player_unlocks_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.practice_sessions ADD CONSTRAINT practice_sessions_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_primary_club_id_fkey FOREIGN KEY (primary_club_id) REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.rating_history ADD CONSTRAINT rating_history_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.rating_history ADD CONSTRAINT rating_history_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.rating_history ADD CONSTRAINT rating_history_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.rating_history ADD CONSTRAINT rating_history_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.room_invites ADD CONSTRAINT room_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.room_invites ADD CONSTRAINT room_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.room_invites ADD CONSTRAINT room_invites_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.room_players ADD CONSTRAINT room_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.room_players ADD CONSTRAINT room_players_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.room_visits ADD CONSTRAINT room_visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.room_visits ADD CONSTRAINT room_visits_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.throws ADD CONSTRAINT throws_leg_id_fkey FOREIGN KEY (leg_id) REFERENCES match_legs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.throws ADD CONSTRAINT throws_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_entrant_players ADD CONSTRAINT tournament_entrant_players_entrant_id_fkey FOREIGN KEY (entrant_id) REFERENCES tournament_entrants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_entrant_players ADD CONSTRAINT tournament_entrant_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_entrants ADD CONSTRAINT tournament_entrants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_loser_entrant_id_fkey FOREIGN KEY (loser_entrant_id) REFERENCES tournament_entrants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_next_loser_match_id_fkey FOREIGN KEY (next_loser_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_next_match_id_fkey FOREIGN KEY (next_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_room_id_fkey FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_side1_entrant_id_fkey FOREIGN KEY (side1_entrant_id) REFERENCES tournament_entrants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_side2_entrant_id_fkey FOREIGN KEY (side2_entrant_id) REFERENCES tournament_entrants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES tournament_stages(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_matches ADD CONSTRAINT tournament_matches_winner_entrant_id_fkey FOREIGN KEY (winner_entrant_id) REFERENCES tournament_entrants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournament_payout_accounts ADD CONSTRAINT tournament_payout_accounts_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_payout_accounts ADD CONSTRAINT tournament_payout_accounts_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_registrations ADD CONSTRAINT tournament_registrations_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_registrations ADD CONSTRAINT tournament_registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournament_stages ADD CONSTRAINT tournament_stages_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_current_stage_id_fkey FOREIGN KEY (current_stage_id) REFERENCES tournament_stages(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tournaments ADD CONSTRAINT tournaments_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ============================================================================
-- 4. INDEXES (non-constraint-backed; PK/UNIQUE indexes created automatically above)
-- ============================================================================

CREATE INDEX club_join_requests_club_idx ON public.club_join_requests USING btree (club_id);
CREATE INDEX club_members_club_idx ON public.club_members USING btree (club_id);
CREATE INDEX club_members_player_idx ON public.club_members USING btree (player_id);
CREATE INDEX club_messages_club_created_idx ON public.club_messages USING btree (club_id, created_at DESC);
CREATE INDEX clubs_tag_idx ON public.clubs USING btree (tag);
CREATE INDEX standings_league_idx ON public.league_standings USING btree (league_id, points DESC);
CREATE INDEX leagues_status_idx ON public.leagues USING btree (status);
CREATE INDEX match_legs_match_idx ON public.match_legs USING btree (match_id);
CREATE INDEX match_stat_details_player_idx ON public.match_stat_details USING btree (player_id, created_at DESC);
CREATE INDEX match_stat_details_room_idx ON public.match_stat_details USING btree (room_id) WHERE (room_id IS NOT NULL);
CREATE INDEX matches_player1_idx ON public.matches USING btree (player1_id);
CREATE INDEX matches_player2_idx ON public.matches USING btree (player2_id);
CREATE INDEX matches_tournament_idx ON public.matches USING btree (tournament_id);
CREATE INDEX idx_matchmaking_queue_searching ON public.matchmaking_queue USING btree (status, rating_points, joined_at) WHERE (status = 'searching'::text);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX online_rooms_code_idx ON public.online_rooms USING btree (room_code);
CREATE INDEX online_rooms_status_idx ON public.online_rooms USING btree (status);
CREATE INDEX organizer_ratings_organizer_idx ON public.organizer_ratings USING btree (organizer_id);
CREATE INDEX pmr_opponent_idx ON public.pending_match_results USING btree (opponent_id, status);
CREATE INDEX player_unlocks_player_idx ON public.player_unlocks USING btree (player_id);
CREATE INDEX practice_sessions_player_mode_idx ON public.practice_sessions USING btree (player_id, mode, created_at DESC);
CREATE INDEX profiles_rating_idx ON public.profiles USING btree (rating_points DESC);
CREATE INDEX profiles_username_idx ON public.profiles USING btree (username);
CREATE INDEX rating_history_player_idx ON public.rating_history USING btree (player_id, created_at DESC);
CREATE INDEX room_invites_invitee_idx ON public.room_invites USING btree (invitee_id);
CREATE INDEX room_players_room_idx ON public.room_players USING btree (room_id);
CREATE INDEX room_visits_room_idx ON public.room_visits USING btree (room_id, seq);
CREATE INDEX throws_leg_idx ON public.throws USING btree (leg_id);
CREATE INDEX throws_player_idx ON public.throws USING btree (player_id);
CREATE INDEX tournament_entrant_players_entrant_idx ON public.tournament_entrant_players USING btree (entrant_id);
CREATE INDEX tournament_entrant_players_player_idx ON public.tournament_entrant_players USING btree (player_id);
CREATE INDEX tournament_entrants_tournament_idx ON public.tournament_entrants USING btree (tournament_id);
CREATE INDEX idx_tournament_matches_stage ON public.tournament_matches USING btree (stage_id);
CREATE INDEX tournament_matches_tournament_idx ON public.tournament_matches USING btree (tournament_id, round, match_number);
CREATE INDEX payout_accounts_tournament_idx ON public.tournament_payout_accounts USING btree (tournament_id);
CREATE INDEX idx_tournament_stages_order ON public.tournament_stages USING btree (tournament_id, order_no);
CREATE INDEX idx_tournament_stages_tournament ON public.tournament_stages USING btree (tournament_id);
CREATE INDEX tournaments_join_code_idx ON public.tournaments USING btree (join_code);
CREATE INDEX tournaments_start_date_idx ON public.tournaments USING btree (start_date DESC);
CREATE INDEX tournaments_status_idx ON public.tournaments USING btree (status);


-- ============================================================================
-- 5. FUNCTIONS (application-owned; pg_trgm extension functions excluded)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.advance_tournament_match(p_match_id uuid, p_winning_side smallint, p_side1_legs integer, p_side2_legs integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m public.tournament_matches;
  v_winner uuid;
  v_loser uuid;
  v_bracket text;
  v_remaining int;
  v_uses_stages boolean;
  v_current_stage_id uuid;
  v_current_stage_order int;
  v_max_stage_order int;
  v_is_last_stage boolean;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.status = 'completed' THEN RETURN; END IF;

  v_winner := CASE WHEN p_winning_side = 1 THEN m.side1_entrant_id ELSE m.side2_entrant_id END;
  v_loser  := CASE WHEN p_winning_side = 1 THEN m.side2_entrant_id ELSE m.side1_entrant_id END;

  UPDATE public.tournament_matches
    SET status = 'completed', winner_entrant_id = v_winner, loser_entrant_id = v_loser,
        side1_legs = p_side1_legs, side2_legs = p_side2_legs
    WHERE id = p_match_id;

  IF m.next_match_id IS NOT NULL AND v_winner IS NOT NULL THEN
    UPDATE public.tournament_matches SET
      side1_entrant_id = CASE WHEN side1_entrant_id IS NULL THEN v_winner ELSE side1_entrant_id END,
      side2_entrant_id = CASE WHEN side1_entrant_id IS NOT NULL AND side2_entrant_id IS NULL THEN v_winner ELSE side2_entrant_id END
      WHERE id = m.next_match_id;
  END IF;

  IF m.next_loser_match_id IS NOT NULL AND v_loser IS NOT NULL THEN
    UPDATE public.tournament_matches SET
      side1_entrant_id = CASE WHEN side1_entrant_id IS NULL THEN v_loser ELSE side1_entrant_id END,
      side2_entrant_id = CASE WHEN side1_entrant_id IS NOT NULL AND side2_entrant_id IS NULL THEN v_loser ELSE side2_entrant_id END
      WHERE id = m.next_loser_match_id;
  END IF;

  SELECT bracket_type, uses_stages, current_stage_id INTO v_bracket, v_uses_stages, v_current_stage_id
    FROM public.tournaments WHERE id = m.tournament_id;

  -- Олон шаттай тэмцээн: одоогийн шат хамгийн сүүлийн (order_no хамгийн их) шат
  -- мөн эсэхийг шалгана. Ганц-шаттай (uses_stages=false) бол үргэлж "сүүлийн шат".
  v_is_last_stage := true;
  IF v_uses_stages AND v_current_stage_id IS NOT NULL THEN
    SELECT order_no INTO v_current_stage_order FROM public.tournament_stages WHERE id = v_current_stage_id;
    SELECT max(order_no) INTO v_max_stage_order FROM public.tournament_stages WHERE tournament_id = m.tournament_id;
    v_is_last_stage := (v_current_stage_order IS NOT NULL AND v_max_stage_order IS NOT NULL AND v_current_stage_order >= v_max_stage_order);
  END IF;

  IF v_is_last_stage THEN
    IF v_bracket = 'round_robin' THEN
      -- Бүх match дуусахад л тэмцээн дуусна
      SELECT count(*) INTO v_remaining FROM public.tournament_matches
        WHERE tournament_id = m.tournament_id AND status <> 'completed';
      IF v_remaining = 0 THEN
        UPDATE public.tournaments SET status = 'completed'
          WHERE id = m.tournament_id AND status <> 'completed';
      END IF;
    ELSIF v_bracket = 'swiss' THEN
      -- Авто-дуусгахгүй: тойргийн тоог зохион байгуулагч шийднэ (/finish route).
      NULL;
    ELSE
      -- SE/DE/groups: дэвших заагчгүй, losers бус, бүлгийн бус match = финал
      IF m.next_match_id IS NULL AND m.is_losers_bracket = false AND m.group_no IS NULL THEN
        UPDATE public.tournaments SET status = 'completed'
          WHERE id = m.tournament_id AND status <> 'completed';
      END IF;
    END IF;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.apply_match_result(p_updates jsonb, p_history jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  u jsonb;
begin
  -- Тоглогч бүрийн профайл (эцсийн утгууд)
  for u in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update public.profiles set
      rating_points    = (u->>'rating_points')::int,
      matches_played   = (u->>'matches_played')::int,
      matches_won      = (u->>'matches_won')::int,
      count_180        = (u->>'count_180')::int,
      highest_checkout = (u->>'highest_checkout')::int,
      average_score    = (u->>'average_score')::numeric,
      career_points    = (u->>'career_points')::int,
      career_darts     = (u->>'career_darts')::int
    where id = (u->>'id')::uuid;
  end loop;

  -- Rating түүх (нэг bulk insert)
  if coalesce(jsonb_array_length(p_history), 0) > 0 then
    insert into public.rating_history
      (player_id, rating_before, rating_after, change, reason, opponent_id, won, room_id)
    select (h->>'player_id')::uuid, (h->>'rating_before')::int, (h->>'rating_after')::int,
           (h->>'change')::int, h->>'reason', nullif(h->>'opponent_id','')::uuid,
           (h->>'won')::boolean, nullif(h->>'room_id','')::uuid
    from jsonb_array_elements(p_history) h;
  end if;

  -- Амжилтын тэмдэг (idempotent) — мөн адил транзакцид
  for u in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    perform public.check_achievements((u->>'id')::uuid);
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_elo_change(player_rating integer, opponent_rating integer, won boolean, k_factor integer DEFAULT 32)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  expected NUMERIC;
  actual NUMERIC;
  change INTEGER;
BEGIN
  expected := 1.0 / (1.0 + power(10.0, (opponent_rating::NUMERIC - player_rating::NUMERIC) / 400.0));
  actual := CASE WHEN won THEN 1.0 ELSE 0.0 END;
  change := ROUND(k_factor * (actual - expected));
  RETURN change;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_achievements(p_player_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  newly_earned TEXT[] := '{}';
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_player_id;
  IF NOT FOUND THEN RETURN newly_earned; END IF;

  IF p.matches_played >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_match') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_match'); END IF;
  END IF;

  IF p.matches_won >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_win') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_win'); END IF;
  END IF;

  IF p.matches_won >= 10 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_10') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_10'); END IF;
  END IF;

  IF p.matches_won >= 50 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_50') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_50'); END IF;
  END IF;

  IF p.matches_won >= 100 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_100') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_100'); END IF;
  END IF;

  IF p.matches_won >= 500 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_500') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_500'); END IF;
  END IF;

  IF p.count_180 >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_180') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_180'); END IF;
  END IF;

  IF p.count_180 >= 10 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, '180_times_10') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, '180_times_10'); END IF;
  END IF;

  IF p.count_180 >= 50 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, '180_times_50') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, '180_times_50'); END IF;
  END IF;

  IF p.highest_checkout >= 100 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'checkout_100') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'checkout_100'); END IF;
  END IF;

  IF p.highest_checkout >= 150 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'checkout_150') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'checkout_150'); END IF;
  END IF;

  IF p.highest_checkout >= 170 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'checkout_170') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'checkout_170'); END IF;
  END IF;

  IF p.tournament_wins >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_champion') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_champion'); END IF;
  END IF;

  IF p.tournament_wins >= 5 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'champion_5') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'champion_5'); END IF;
  END IF;

  IF p.rating_points >= 1000 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_bronze') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_bronze'); END IF;
  END IF;

  IF p.rating_points >= 1400 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_gold') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_gold'); END IF;
  END IF;

  IF p.rating_points >= 1800 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_diamond') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_diamond'); END IF;
  END IF;

  IF p.rating_points >= 2000 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_master') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_master'); END IF;
  END IF;

  IF p.rating_points >= 2200 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_grandmaster') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_grandmaster'); END IF;
  END IF;

  RETURN newly_earned;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_avraga_on_tournament_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t_player_count integer;
  t_winner_id uuid;
BEGIN
  -- Зөвхөн status 'completed' болсон тэмцээнд хэрэглэнэ
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Тэмцээний бодит тоглогчийн тоо
    SELECT COUNT(*) INTO t_player_count
    FROM tournament_registrations
    WHERE tournament_id = NEW.id;

    -- 32+ тоглогчтой бол эцсийн match-ийн ялагчийг олно
    IF t_player_count >= 32 THEN
      SELECT m.winner_id INTO t_winner_id
      FROM matches m
      WHERE m.tournament_id = NEW.id
        AND m.round = (SELECT MAX(round) FROM matches WHERE tournament_id = NEW.id)
        AND m.winner_id IS NOT NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      IF t_winner_id IS NOT NULL THEN
        UPDATE public.profiles
        SET avraga_wins = avraga_wins + 1
        WHERE id = t_winner_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.club_tier_idx(score integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when score >= 6000 then 4
    when score >= 3000 then 3
    when score >= 1500 then 2
    when score >=  500 then 1
    else 0 end;
$function$;

CREATE OR REPLACE FUNCTION public.get_player_stat_summary(p_player_id uuid)
 RETURNS TABLE(matches bigint, legs_for bigint, legs_against bigint, darts_thrown bigint, points_scored bigint, avg3 numeric, avg_first9 numeric, band_60 bigint, band_80 bigint, band_100 bigint, band_120 bigint, band_140 bigint, band_170 bigint, count_180 bigint, high_finish integer, count_100_finishes bigint, best_leg_darts integer, worst_leg_darts integer, checkout_attempts bigint, checkout_makes bigint, keep_attempts bigint, keep_makes bigint, break_attempts bigint, break_makes bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT count(*), COALESCE(sum(legs_for), 0), COALESCE(sum(legs_against), 0), COALESCE(sum(darts_thrown), 0), COALESCE(sum(points_scored), 0),
         CASE WHEN sum(darts_thrown) > 0 THEN sum(points_scored)::numeric / sum(darts_thrown) * 3 ELSE 0 END,
         COALESCE(avg(avg_first9), 0),
         COALESCE(sum(band_60), 0), COALESCE(sum(band_80), 0), COALESCE(sum(band_100), 0), COALESCE(sum(band_120), 0), COALESCE(sum(band_140), 0), COALESCE(sum(band_170), 0), COALESCE(sum(count_180), 0),
         COALESCE(max(high_finish), 0), COALESCE(sum(count_100_finishes), 0),
         min(best_leg_darts), max(worst_leg_darts),
         COALESCE(sum(checkout_attempts), 0), COALESCE(sum(checkout_makes), 0), COALESCE(sum(keep_attempts), 0), COALESCE(sum(keep_makes), 0), COALESCE(sum(break_attempts), 0), COALESCE(sum(break_makes), 0)
  FROM public.match_stat_details WHERE player_id = p_player_id
$function$;

CREATE OR REPLACE FUNCTION public.get_practice_stat_summary(p_player_id uuid)
 RETURNS TABLE(mode text, session_count integer, best_metric numeric, worst_metric numeric, last_played timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT mode, count(*)::int, max(headline_metric), min(headline_metric), max(created_at)
  FROM public.practice_sessions WHERE player_id = p_player_id GROUP BY mode
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  final_username := base_username;

  -- username давхцвал дугаар нэмж өвөрмөц болгоно
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''), final_username)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.matchmaking_claim_match(p_player_id uuid, p_rating integer, p_format text, p_best_of integer, p_double_out boolean, p_elo_window integer)
 RETURNS TABLE(room_id uuid, matched boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_self RECORD;
  v_opponent RECORD;
  v_room_id UUID;
  v_code TEXT;
  i INT;
BEGIN
  -- Serialize the whole matching decision across ALL concurrent callers (any
  -- player), not just duplicate calls for the same player_id. Without this,
  -- two players joining at nearly the same moment each lock their own row
  -- first (see below) and then look for each other with FOR UPDATE SKIP
  -- LOCKED — each sees the other's row as locked-by-someone-else and skips
  -- it, so both report "no opponent found" even though they were a perfect
  -- match (livelock). The advisory lock makes claim attempts run one at a
  -- time, so SKIP LOCKED below never has a same-instant competitor to skip.
  PERFORM pg_advisory_xact_lock(hashtext('matchmaking_claim_match'));

  -- Lock own queue row first: a concurrent duplicate call for the same
  -- player_id (double-click, retry) must serialize here, not race below.
  SELECT * INTO v_self FROM matchmaking_queue WHERE player_id = p_player_id FOR UPDATE;

  IF v_self.id IS NULL OR v_self.status <> 'searching' THEN
    RETURN QUERY SELECT v_self.room_id, COALESCE(v_self.status = 'matched', false);
    RETURN;
  END IF;

  -- Self-heal: opportunistically clear out ghost entries (abandoned tabs that
  -- never called /leave) so they stop being offered as opponents to anyone.
  -- SKIP LOCKED so this never blocks on a row another concurrent claim call
  -- is actively evaluating.
  DELETE FROM matchmaking_queue
  WHERE id IN (
    SELECT id FROM matchmaking_queue
    WHERE status = 'searching'
      AND player_id <> p_player_id
      AND last_seen_at < NOW() - INTERVAL '30 seconds'
    FOR UPDATE SKIP LOCKED
  );

  -- FOR UPDATE SKIP LOCKED: if another concurrent caller is already
  -- evaluating this same candidate, skip it instead of double-claiming it.
  -- Only consider opponents seen recently (excludes ghosts whose heartbeat
  -- lapsed but haven't been swept by the DELETE above yet).
  SELECT * INTO v_opponent
  FROM matchmaking_queue
  WHERE status = 'searching'
    AND player_id <> p_player_id
    AND format = p_format
    AND best_of = p_best_of
    AND double_out = p_double_out
    AND rating_points BETWEEN p_rating - p_elo_window AND p_rating + p_elo_window
    AND last_seen_at > NOW() - INTERVAL '15 seconds'
  ORDER BY joined_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_opponent.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false;
    RETURN;
  END IF;

  FOR i IN 1..5 LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO online_rooms (room_code, host_id, format, best_of, mode, double_out, limit_rounds, bull_finish, start_method, status)
      VALUES (v_code, v_opponent.player_id, p_format, p_best_of, '1v1', p_double_out, NULL, false, 'random', 'waiting')
      RETURNING id INTO v_room_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_room_id := NULL;
    END;
  END LOOP;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'matchmaking: room code collision retries exhausted';
  END IF;

  INSERT INTO room_players (room_id, player_id, team, slot, is_ready)
  VALUES (v_room_id, v_opponent.player_id, 0, 0, false),
         (v_room_id, p_player_id, 1, 0, false);

  UPDATE matchmaking_queue
  SET status = 'matched', room_id = v_room_id
  WHERE player_id IN (p_player_id, v_opponent.player_id);

  RETURN QUERY SELECT v_room_id, true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.matchmaking_heartbeat(p_player_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE matchmaking_queue
  SET last_seen_at = NOW()
  WHERE player_id = p_player_id AND status = 'searching';
$function$;

CREATE OR REPLACE FUNCTION public.matchmaking_join_queue(p_player_id uuid, p_rating integer, p_format text, p_best_of integer, p_double_out boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO matchmaking_queue (player_id, rating_points, format, best_of, double_out, status, room_id, joined_at, last_seen_at)
  VALUES (p_player_id, p_rating, p_format, p_best_of, p_double_out, 'searching', NULL, NOW(), NOW())
  ON CONFLICT (player_id) DO UPDATE SET
    rating_points = EXCLUDED.rating_points,
    format = EXCLUDED.format,
    best_of = EXCLUDED.best_of,
    double_out = EXCLUDED.double_out,
    status = 'searching',
    room_id = NULL,
    joined_at = NOW(),
    last_seen_at = NOW();
$function$;

CREATE OR REPLACE FUNCTION public.notify_achievement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  ach RECORD;
BEGIN
  SELECT * INTO ach FROM public.achievements WHERE key = NEW.achievement_key;
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, link)
    VALUES (
      NEW.player_id, 'achievement_earned',
      'Achievement нээгдлээ!',
      ach.icon || ' ' || ach.name || ' — ' || ach.description,
      ach.icon,
      '/profile'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_club_joined()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Notify the club owner about new member
  INSERT INTO public.notifications (user_id, type, title, body, icon, link)
  SELECT
    c.owner_id,
    'club_joined',
    'Клубт шинэ гишүүн нэгдлээ',
    (SELECT display_name FROM public.profiles WHERE id = NEW.player_id) || ' таны клубт нэгдлээ',
    '🏠',
    '/clubs/' || c.id
  FROM public.clubs c
  WHERE c.id = NEW.club_id
    AND c.owner_id != NEW.player_id;  -- Don't notify if owner joins their own club
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_club_tier_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  old_idx int := public.club_tier_idx(coalesce(old.club_score, 0));
  new_idx int := public.club_tier_idx(coalesce(new.club_score, 0));
begin
  if new_idx > old_idx then
    insert into public.notifications (user_id, type, title, body, icon, link, data)
    select cm.player_id, 'club_tier',
           'Клубын цол ахилаа! 🎉',
           new.name || ' клуб дээшиллээ — шинэ tag өнгө нээгдлээ. Сонгож гишүүддээ зүүлгээрэй.',
           '🏅',
           '/clubs/' || new.id || '/edit',
           jsonb_build_object('club_id', new.id, 'tier', new_idx)
    from public.club_members cm
    where cm.club_id = new.id and cm.role in ('owner','admin');
  end if;
  return new;
end;$function$;

CREATE OR REPLACE FUNCTION public.notify_tournament_registered()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, icon, link)
  SELECT
    NEW.player_id,
    'tournament_registered',
    'Тэмцээнд бүртгүүллээ',
    (SELECT name FROM public.tournaments WHERE id = NEW.tournament_id),
    '🏆',
    '/tournaments/' || NEW.tournament_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_tournament_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.status = 'ongoing' AND OLD.status = 'registration' THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, link)
    SELECT
      tr.player_id,
      'tournament_starting',
      'Тэмцээн эхэллээ! 🚀',
      NEW.name || ' тэмцээн эхэллээ. Bracket шалгаарай.',
      '🎯',
      '/tournaments/' || NEW.id
    FROM public.tournament_registrations tr
    WHERE tr.tournament_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_profile_stats_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.check_achievements(NEW.id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_rating_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update club scores for all clubs this player belongs to
  PERFORM public.update_club_score(cm.club_id)
  FROM public.club_members cm
  WHERE cm.player_id = NEW.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_premium_status(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET
    is_premium = EXISTS (
      SELECT 1 FROM public.player_subscriptions
      WHERE player_id = p_player_id
        AND status = 'active'
        AND expires_at > NOW()
    ),
    premium_expires_at = (
      SELECT expires_at FROM public.player_subscriptions
      WHERE player_id = p_player_id AND status = 'active' AND expires_at > NOW()
      ORDER BY expires_at DESC LIMIT 1
    )
  WHERE id = p_player_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_knockout(p_tournament_id uuid, p_assignments jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.tournament_matches tm SET
    side1_entrant_id = NULLIF(a->>'side1','')::uuid,
    side2_entrant_id = NULLIF(a->>'side2','')::uuid
  FROM jsonb_array_elements(p_assignments) a
  WHERE tm.id = (a->>'match_id')::uuid
    AND tm.tournament_id = p_tournament_id
    AND tm.group_no IS NULL
    AND tm.status = 'pending'
    AND tm.side1_entrant_id IS NULL
    AND tm.side2_entrant_id IS NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public.start_tournament(p_tournament_id uuid, p_entrants jsonb, p_entrant_players jsonb, p_matches jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.tournaments SET status = 'ongoing'
    WHERE id = p_tournament_id AND status IN ('draft', 'registration', 'ongoing');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament % not startable (wrong status)', p_tournament_id;
  END IF;

  INSERT INTO public.tournament_entrants (id, tournament_id, display_name, seed, group_no)
  SELECT (e->>'id')::uuid, p_tournament_id, e->>'display_name', (e->>'seed')::int,
         NULLIF(e->>'group_no','')::int
  FROM jsonb_array_elements(p_entrants) e;

  INSERT INTO public.tournament_entrant_players (entrant_id, player_id, slot)
  SELECT (ep->>'entrant_id')::uuid, (ep->>'player_id')::uuid, (ep->>'slot')::smallint
  FROM jsonb_array_elements(p_entrant_players) ep;

  INSERT INTO public.tournament_matches
    (id, tournament_id, round, match_number, is_losers_bracket, group_no,
     side1_entrant_id, side2_entrant_id, side1_legs, side2_legs,
     winner_entrant_id, loser_entrant_id, status, next_match_id, next_loser_match_id)
  SELECT (m->>'id')::uuid, p_tournament_id, (m->>'round')::int, (m->>'match_number')::int,
         (m->>'is_losers_bracket')::boolean, NULLIF(m->>'group_no','')::int,
         NULLIF(m->>'side1_entrant_id','')::uuid, NULLIF(m->>'side2_entrant_id','')::uuid,
         (m->>'side1_legs')::int, (m->>'side2_legs')::int,
         NULLIF(m->>'winner_entrant_id','')::uuid, NULLIF(m->>'loser_entrant_id','')::uuid,
         m->>'status', NULLIF(m->>'next_match_id','')::uuid, NULLIF(m->>'next_loser_match_id','')::uuid
  FROM jsonb_array_elements(p_matches) m;
END; $function$;

CREATE OR REPLACE FUNCTION public.sync_club_logo_to_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url OR NEW.tag IS DISTINCT FROM OLD.tag THEN
    UPDATE public.profiles
    SET primary_club_logo = NEW.logo_url,
        primary_club_tag  = NEW.tag
    WHERE primary_club_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_primary_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET
      primary_club_id = NEW.club_id,
      primary_club_logo = (SELECT logo_url FROM public.clubs WHERE id = NEW.club_id),
      primary_club_tag  = (SELECT tag FROM public.clubs WHERE id = NEW.club_id),
      primary_club_tag_color = (SELECT tag_color FROM public.clubs WHERE id = NEW.club_id)
    WHERE id = NEW.player_id
      AND primary_club_id IS NULL;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET
      primary_club_id   = (SELECT club_id FROM public.club_members WHERE player_id = OLD.player_id LIMIT 1),
      primary_club_logo = (SELECT c.logo_url FROM public.clubs c JOIN public.club_members cm ON cm.club_id = c.id WHERE cm.player_id = OLD.player_id LIMIT 1),
      primary_club_tag  = (SELECT c.tag FROM public.clubs c JOIN public.club_members cm ON cm.club_id = c.id WHERE cm.player_id = OLD.player_id LIMIT 1),
      primary_club_tag_color = (SELECT c.tag_color FROM public.clubs c JOIN public.club_members cm ON cm.club_id = c.id WHERE cm.player_id = OLD.player_id LIMIT 1)
    WHERE id = OLD.player_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.undo_last_room_visit(p_room_id uuid, p_user_id uuid)
 RETURNS SETOF room_visits
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.room_visits rv
  WHERE rv.room_id = p_room_id
    AND rv.created_by = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.room_visits rv2
      WHERE rv2.room_id = rv.room_id AND rv2.seq > rv.seq
    )
  RETURNING rv.*;
$function$;

CREATE OR REPLACE FUNCTION public.update_club_member_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_club_id uuid;
BEGIN
  target_club_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.club_id ELSE NEW.club_id END;

  UPDATE public.clubs
  SET member_count = (
    SELECT COUNT(*) FROM public.club_members WHERE club_id = target_club_id
  )
  WHERE id = target_club_id;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_club_score(p_club_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  avg_rating NUMERIC;
  member_cnt INTEGER;
BEGIN
  SELECT AVG(pr.rating_points), COUNT(*)
  INTO avg_rating, member_cnt
  FROM public.club_members cm
  JOIN public.profiles pr ON pr.id = cm.player_id
  WHERE cm.club_id = p_club_id;

  UPDATE public.clubs
  SET club_score = COALESCE(ROUND(avg_rating), 0)
  WHERE id = p_club_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tournament_player_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tournaments SET current_players = current_players + 1 WHERE id = NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tournaments SET current_players = GREATEST(current_players - 1, 0) WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;


-- ============================================================================
-- 6. TRIGGERS (application-owned; storage/realtime-managed system triggers excluded)
-- ============================================================================

CREATE TRIGGER club_member_sync_club AFTER INSERT OR DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.sync_primary_club();
CREATE TRIGGER club_members_count_trigger AFTER INSERT OR DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();
CREATE TRIGGER on_club_member_joined AFTER INSERT ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.notify_club_joined();
CREATE TRIGGER club_logo_sync AFTER UPDATE OF logo_url, tag ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.sync_club_logo_to_members();
CREATE TRIGGER club_tier_up_trigger AFTER UPDATE OF club_score ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.notify_club_tier_up();
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER on_achievement_earned AFTER INSERT ON public.player_achievements FOR EACH ROW EXECUTE FUNCTION public.notify_achievement();
CREATE TRIGGER profile_rating_change AFTER UPDATE OF rating_points ON public.profiles FOR EACH ROW WHEN ((old.rating_points IS DISTINCT FROM new.rating_points)) EXECUTE FUNCTION public.on_rating_change();
CREATE TRIGGER profile_stats_achievement_check AFTER UPDATE OF matches_played, matches_won, count_180, highest_checkout, tournament_wins, rating_points ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.on_profile_stats_change();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER on_tournament_registered AFTER INSERT ON public.tournament_registrations FOR EACH ROW EXECUTE FUNCTION public.notify_tournament_registered();
CREATE TRIGGER tournament_registration_count_trigger AFTER INSERT OR DELETE ON public.tournament_registrations FOR EACH ROW EXECUTE FUNCTION public.update_tournament_player_count();
CREATE TRIGGER on_tournament_completed AFTER UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.check_avraga_on_tournament_complete();
CREATE TRIGGER on_tournament_status_change AFTER UPDATE OF status ON public.tournaments FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.notify_tournament_status();
CREATE TRIGGER tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================================
-- 7. RLS ENABLE (all 39 public tables)
-- ============================================================================

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caller_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_session_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_stat_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_local_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.throws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entrant_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 8. RLS POLICIES (public schema)
-- ============================================================================

CREATE POLICY public_read_achievements ON public.achievements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "caller_clips public read" ON public.caller_clips FOR SELECT TO public USING (true);
CREATE POLICY club_join_requests_delete ON public.club_join_requests FOR DELETE TO public USING ((auth.uid() = player_id));
CREATE POLICY club_join_requests_insert ON public.club_join_requests FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY club_join_requests_select ON public.club_join_requests FOR SELECT TO public USING (((auth.uid() = player_id) OR (EXISTS ( SELECT 1
   FROM club_members m
  WHERE ((m.club_id = club_join_requests.club_id) AND (m.player_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "Club members viewable by everyone" ON public.club_members FOR SELECT TO public USING (true);
CREATE POLICY "Users can join clubs" ON public.club_members FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY "Users can leave clubs" ON public.club_members FOR DELETE TO public USING ((auth.uid() = player_id));
CREATE POLICY "club members read messages" ON public.club_messages FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (club_members cm
     JOIN clubs c ON ((c.id = cm.club_id)))
  WHERE ((cm.club_id = club_messages.club_id) AND (cm.player_id = auth.uid()) AND (c.subscription_plan IS NOT NULL)))));
CREATE POLICY "club members send messages" ON public.club_messages FOR INSERT TO public WITH CHECK (((player_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (club_members cm
     JOIN clubs c ON ((c.id = cm.club_id)))
  WHERE ((cm.club_id = club_messages.club_id) AND (cm.player_id = auth.uid()) AND (c.subscription_plan IS NOT NULL))))));
CREATE POLICY "Club subscriptions viewable by everyone" ON public.club_subscriptions FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can create clubs" ON public.clubs FOR INSERT TO public WITH CHECK ((auth.uid() = owner_id));
CREATE POLICY "Club deputies can update" ON public.clubs FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM club_members cm
  WHERE ((cm.club_id = clubs.id) AND (cm.player_id = auth.uid()) AND (cm.role = 'admin'::text)))));
CREATE POLICY "Club owners can delete" ON public.clubs FOR DELETE TO public USING ((auth.uid() = owner_id));
CREATE POLICY "Club owners can update" ON public.clubs FOR UPDATE TO public USING ((auth.uid() = owner_id));
CREATE POLICY "Clubs are viewable by everyone" ON public.clubs FOR SELECT TO public USING (true);
CREATE POLICY "public read effects" ON public.cosmetic_effects FOR SELECT TO public USING (true);
CREATE POLICY "public read passes" ON public.cosmetic_passes FOR SELECT TO public USING (true);
CREATE POLICY "Standings viewable by everyone" ON public.league_standings FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT TO public WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "League creators can manage" ON public.leagues FOR ALL TO public USING ((auth.uid() = created_by));
CREATE POLICY "Leagues viewable by everyone" ON public.leagues FOR SELECT TO public USING (true);
CREATE POLICY "anyone can read live sessions" ON public.local_session_sync FOR SELECT TO public USING (true);
CREATE POLICY "anyone can update live sessions" ON public.local_session_sync FOR UPDATE TO public USING (true);
CREATE POLICY "anyone can upsert live sessions" ON public.local_session_sync FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Match legs viewable by everyone" ON public.match_legs FOR SELECT TO public USING (true);
CREATE POLICY "Match players can insert legs" ON public.match_legs FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = match_legs.match_id) AND ((auth.uid() = m.player1_id) OR (auth.uid() = m.player2_id))))));
CREATE POLICY "Match stat details viewable by everyone" ON public.match_stat_details FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can create matches" ON public.matches FOR INSERT TO public WITH CHECK ((auth.uid() = player1_id));
CREATE POLICY "Matches viewable by everyone" ON public.matches FOR SELECT TO public USING (true);
CREATE POLICY "Players can update their own matches" ON public.matches FOR UPDATE TO public USING (((auth.uid() = player1_id) OR (auth.uid() = player2_id)));
CREATE POLICY "delete own entry" ON public.matchmaking_queue FOR DELETE TO public USING ((player_id = auth.uid()));
CREATE POLICY "insert own entry" ON public.matchmaking_queue FOR INSERT TO public WITH CHECK ((player_id = auth.uid()));
CREATE POLICY "see own entry" ON public.matchmaking_queue FOR SELECT TO public USING ((player_id = auth.uid()));
CREATE POLICY "update own entry" ON public.matchmaking_queue FOR UPDATE TO public USING ((player_id = auth.uid()));
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Authenticated users can create rooms" ON public.online_rooms FOR INSERT TO public WITH CHECK ((auth.uid() = host_id));
CREATE POLICY "Waiting rooms viewable by everyone" ON public.online_rooms FOR SELECT TO public USING (true);
CREATE POLICY "Rater inserts own rating" ON public.organizer_ratings FOR INSERT TO public WITH CHECK (((auth.uid() = rater_id) AND (EXISTS ( SELECT 1
   FROM tournament_registrations r
  WHERE ((r.tournament_id = organizer_ratings.tournament_id) AND (r.player_id = auth.uid()))))));
CREATE POLICY "Rater updates own rating" ON public.organizer_ratings FOR UPDATE TO public USING ((auth.uid() = rater_id));
CREATE POLICY "Ratings viewable by everyone" ON public.organizer_ratings FOR SELECT TO public USING (true);
CREATE POLICY "Users can create their own transactions" ON public.payment_transactions FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY "Users can view their own transactions" ON public.payment_transactions FOR SELECT TO public USING ((auth.uid() = player_id));
CREATE POLICY pmr_select ON public.pending_match_results FOR SELECT TO public USING (((auth.uid() = reporter_id) OR (auth.uid() = opponent_id)));
CREATE POLICY "Achievements viewable by everyone" ON public.player_achievements FOR SELECT TO public USING (true);
CREATE POLICY "Player subscriptions viewable by owner" ON public.player_subscriptions FOR SELECT TO public USING ((auth.uid() = player_id));
CREATE POLICY "read own unlocks" ON public.player_unlocks FOR SELECT TO public USING ((player_id = auth.uid()));
CREATE POLICY "Players insert own practice sessions" ON public.practice_sessions FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY "Players view own practice sessions" ON public.practice_sessions FOR SELECT TO public USING ((auth.uid() = player_id));
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "Rating history viewable by everyone" ON public.rating_history FOR SELECT TO public USING (true);
CREATE POLICY "Invitee responds" ON public.room_invites FOR UPDATE TO public USING ((auth.uid() = invitee_id));
CREATE POLICY "Inviter creates invite" ON public.room_invites FOR INSERT TO public WITH CHECK ((auth.uid() = inviter_id));
CREATE POLICY "Invites viewable by everyone" ON public.room_invites FOR SELECT TO public USING (true);
CREATE POLICY "Player or host removes player" ON public.room_players FOR DELETE TO public USING (((auth.uid() = player_id) OR (auth.uid() = ( SELECT r.host_id
   FROM online_rooms r
  WHERE (r.id = room_players.room_id)))));
CREATE POLICY "Room players viewable by everyone" ON public.room_players FOR SELECT TO public USING (true);
CREATE POLICY "Visits viewable by everyone" ON public.room_visits FOR SELECT TO public USING (true);
CREATE POLICY "Players can insert their own throws" ON public.throws FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY "Throws viewable by everyone" ON public.throws FOR SELECT TO public USING (true);
CREATE POLICY "Entrant players viewable by everyone" ON public.tournament_entrant_players FOR SELECT TO public USING (true);
CREATE POLICY "Entrants viewable by everyone" ON public.tournament_entrants FOR SELECT TO public USING (true);
CREATE POLICY "Tournament matches viewable by everyone" ON public.tournament_matches FOR SELECT TO public USING (true);
CREATE POLICY "Payout account: self inserts" ON public.tournament_payout_accounts FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY "Payout account: self or organizer reads" ON public.tournament_payout_accounts FOR SELECT TO public USING (((auth.uid() = player_id) OR (auth.uid() = ( SELECT t.organizer_id
   FROM tournaments t
  WHERE (t.id = tournament_payout_accounts.tournament_id)))));
CREATE POLICY "Payout account: self updates" ON public.tournament_payout_accounts FOR UPDATE TO public USING ((auth.uid() = player_id));
CREATE POLICY "Organizers can update registrations" ON public.tournament_registrations FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_registrations.tournament_id) AND (t.organizer_id = auth.uid())))));
CREATE POLICY "Registrations viewable by everyone" ON public.tournament_registrations FOR SELECT TO public USING (true);
CREATE POLICY "Users can register themselves" ON public.tournament_registrations FOR INSERT TO public WITH CHECK ((auth.uid() = player_id));
CREATE POLICY "Users can unregister themselves" ON public.tournament_registrations FOR DELETE TO public USING ((auth.uid() = player_id));
CREATE POLICY tournament_stages_delete ON public.tournament_stages FOR DELETE TO public USING ((auth.uid() = ( SELECT tournaments.organizer_id
   FROM tournaments
  WHERE (tournaments.id = tournament_stages.tournament_id))));
CREATE POLICY tournament_stages_insert ON public.tournament_stages FOR INSERT TO public WITH CHECK ((auth.uid() = ( SELECT tournaments.organizer_id
   FROM tournaments
  WHERE (tournaments.id = tournament_stages.tournament_id))));
CREATE POLICY tournament_stages_select ON public.tournament_stages FOR SELECT TO public USING (true);
CREATE POLICY tournament_stages_update ON public.tournament_stages FOR UPDATE TO public USING ((auth.uid() = ( SELECT tournaments.organizer_id
   FROM tournaments
  WHERE (tournaments.id = tournament_stages.tournament_id))));
CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments FOR INSERT TO public WITH CHECK ((auth.uid() = organizer_id));
CREATE POLICY "Organizers can manage tournaments" ON public.tournaments FOR ALL TO public USING ((auth.uid() = organizer_id));
CREATE POLICY "Tournaments viewable by everyone" ON public.tournaments FOR SELECT TO public USING (true);


-- ============================================================================
-- 9. GRANTS / RPC EXECUTE RESTRICTIONS
-- ============================================================================
-- Postgres grants EXECUTE to PUBLIC by default on CREATE FUNCTION. The
-- functions below were explicitly locked down (security hotfix, 2026-08-29,
-- plus one earlier hardening migration for matchmaking_join_queue) to
-- service_role only — anon/authenticated cannot call them directly as RPCs.
-- All other application functions keep the Postgres default (PUBLIC execute).

REVOKE EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_avraga_on_tournament_complete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_avraga_on_tournament_complete() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_achievement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_achievement() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_club_joined() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_club_joined() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_club_tier_up() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_club_tier_up() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_tournament_registered() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_tournament_registered() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_tournament_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_tournament_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.on_profile_stats_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_profile_stats_change() TO service_role;

REVOKE EXECUTE ON FUNCTION public.on_rating_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_rating_change() TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_premium_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_club_logo_to_members() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_club_logo_to_members() TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_primary_club() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_primary_club() TO service_role;

REVOKE EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_club_member_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_member_count() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_club_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_score(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_tournament_player_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tournament_player_count() TO service_role;


-- ============================================================================
-- 10. VIEW
-- ============================================================================
-- security_invoker=true so the view respects the querying role's own RLS,
-- not the view owner's (Postgres 15+ view-RLS-bypass hardening).

CREATE VIEW public.province_rankings WITH (security_invoker = true) AS
 SELECT province,
    id AS player_id,
    username,
    display_name,
    avatar_url,
    rating_points,
    matches_played,
    matches_won,
    average_score,
    row_number() OVER (PARTITION BY province ORDER BY rating_points DESC) AS province_rank
   FROM public.profiles
  WHERE province IS NOT NULL
  ORDER BY province, rating_points DESC;


-- ============================================================================
-- 11. AUTH TRIGGER ATTACHMENT (public.handle_new_user on auth.users)
-- ============================================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 12. STORAGE BUCKET CONFIGURATION
-- ============================================================================
-- Application configuration (rows) attached to the Supabase-managed
-- storage.buckets table. The storage schema/tables themselves are
-- Supabase-managed and are NOT created here.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
VALUES
  ('caller-voice', 'caller-voice', true, NULL, NULL, false),
  ('clubs', 'clubs', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'], false),
  ('cosmetics', 'cosmetics', true, NULL, NULL, false),
  ('tournaments', 'tournaments', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'], false)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  avif_autodetection = EXCLUDED.avif_autodetection;


-- ============================================================================
-- 13. STORAGE POLICIES (storage.objects; post-hotfix hardened state)
-- ============================================================================

CREATE POLICY "Anyone can view tournament images" ON storage.objects FOR SELECT TO public USING ((bucket_id = 'tournaments'::text));
CREATE POLICY "Club image delete by owner or admin" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'clubs'::text) AND (EXISTS ( SELECT 1
   FROM clubs c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND ((c.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM club_members cm
          WHERE ((cm.club_id = c.id) AND (cm.player_id = auth.uid()) AND (cm.role = 'admin'::text))))))))));
CREATE POLICY "Club image update by owner or admin" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'clubs'::text) AND (EXISTS ( SELECT 1
   FROM clubs c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND ((c.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM club_members cm
          WHERE ((cm.club_id = c.id) AND (cm.player_id = auth.uid()) AND (cm.role = 'admin'::text)))))))))) WITH CHECK (((bucket_id = 'clubs'::text) AND (EXISTS ( SELECT 1
   FROM clubs c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND ((c.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM club_members cm
          WHERE ((cm.club_id = c.id) AND (cm.player_id = auth.uid()) AND (cm.role = 'admin'::text))))))))));
CREATE POLICY "Club image upload by owner or admin" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'clubs'::text) AND (EXISTS ( SELECT 1
   FROM clubs c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND ((c.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM club_members cm
          WHERE ((cm.club_id = c.id) AND (cm.player_id = auth.uid()) AND (cm.role = 'admin'::text))))))))));
CREATE POLICY "Club images public read" ON storage.objects FOR SELECT TO public USING ((bucket_id = 'clubs'::text));
CREATE POLICY "Tournament banner delete by owner path" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'tournaments'::text) AND (name ~~ (('banners/'::text || (auth.uid())::text) || '-%'::text))));
CREATE POLICY "Tournament banner update by owner path" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'tournaments'::text) AND (name ~~ (('banners/'::text || (auth.uid())::text) || '-%'::text)))) WITH CHECK (((bucket_id = 'tournaments'::text) AND (name ~~ (('banners/'::text || (auth.uid())::text) || '-%'::text))));
CREATE POLICY "Tournament banner upload by owner path" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'tournaments'::text) AND (name ~~ (('banners/'::text || (auth.uid())::text) || '-%'::text))));


-- ============================================================================
-- 14. REALTIME PUBLICATION MEMBERSHIP
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.club_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.local_session_sync;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_legs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.online_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.throws;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_entrants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;

-- room_visits and local_session_sync require REPLICA IDENTITY FULL for realtime
-- UPDATE/DELETE payloads to include old row values.
ALTER TABLE public.room_visits REPLICA IDENTITY FULL;
ALTER TABLE public.local_session_sync REPLICA IDENTITY FULL;
