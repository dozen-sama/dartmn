export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          description: string
          icon: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          category?: string
          description: string
          icon: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          description?: string
          icon?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      caller_clips: {
        Row: {
          ext: string
          key: string
          updated_at: string
        }
        Insert: {
          ext?: string
          key: string
          updated_at?: string
        }
        Update: {
          ext?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_join_requests: {
        Row: {
          club_id: string
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_join_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          player_id: string
          role: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          player_id: string
          role?: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          player_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      club_messages: {
        Row: {
          body: string
          club_id: string
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      club_subscriptions: {
        Row: {
          amount: number
          club_id: string
          expires_at: string
          id: string
          payment_id: string | null
          plan: string
          started_at: string
          status: string
        }
        Insert: {
          amount: number
          club_id: string
          expires_at: string
          id?: string
          payment_id?: string | null
          plan: string
          started_at?: string
          status?: string
        }
        Update: {
          amount?: number
          club_id?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          plan?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          address: string | null
          city: string | null
          club_rank: number | null
          club_score: number
          cover_url: string | null
          created_at: string
          description: string | null
          email: string | null
          equipped_frame: string | null
          features: Json | null
          id: string
          is_verified: boolean
          logo_url: string | null
          member_count: number
          name: string
          name_animated: boolean
          name_color: string | null
          name_effect: string | null
          name_font: string | null
          owner_id: string
          phone: string | null
          slug: string
          social_discord: string | null
          social_facebook: string | null
          social_instagram: string | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          tag: string | null
          tag_color: string | null
          tagline: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          club_rank?: number | null
          club_score?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          equipped_frame?: string | null
          features?: Json | null
          id?: string
          is_verified?: boolean
          logo_url?: string | null
          member_count?: number
          name: string
          name_animated?: boolean
          name_color?: string | null
          name_effect?: string | null
          name_font?: string | null
          owner_id: string
          phone?: string | null
          slug: string
          social_discord?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          tag?: string | null
          tag_color?: string | null
          tagline?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          club_rank?: number | null
          club_score?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          equipped_frame?: string | null
          features?: Json | null
          id?: string
          is_verified?: boolean
          logo_url?: string | null
          member_count?: number
          name?: string
          name_animated?: boolean
          name_color?: string | null
          name_effect?: string | null
          name_font?: string | null
          owner_id?: string
          phone?: string | null
          slug?: string
          social_discord?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          tag?: string | null
          tag_color?: string | null
          tagline?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      cosmetic_effects: {
        Row: {
          created_at: string
          fit: string
          id: string
          is_active: boolean
          key: string
          lottie_url: string
          name: string
          offset_x: number
          offset_y: number
          pass_id: string | null
          scale: number
          scale_y: number
          scope: string
          sort_order: number
          xp: number
        }
        Insert: {
          created_at?: string
          fit?: string
          id?: string
          is_active?: boolean
          key: string
          lottie_url: string
          name: string
          offset_x?: number
          offset_y?: number
          pass_id?: string | null
          scale?: number
          scale_y?: number
          scope?: string
          sort_order?: number
          xp?: number
        }
        Update: {
          created_at?: string
          fit?: string
          id?: string
          is_active?: boolean
          key?: string
          lottie_url?: string
          name?: string
          offset_x?: number
          offset_y?: number
          pass_id?: string | null
          scale?: number
          scale_y?: number
          scope?: string
          sort_order?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "cosmetic_effects_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "cosmetic_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetic_passes: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
        }
        Relationships: []
      }
      league_standings: {
        Row: {
          drawn: number
          id: string
          league_id: string
          legs_lost: number
          legs_won: number
          lost: number
          played: number
          player_id: string
          points: number
          updated_at: string
          won: number
        }
        Insert: {
          drawn?: number
          id?: string
          league_id: string
          legs_lost?: number
          legs_won?: number
          lost?: number
          played?: number
          player_id: string
          points?: number
          updated_at?: string
          won?: number
        }
        Update: {
          drawn?: number
          id?: string
          league_id?: string
          legs_lost?: number
          legs_won?: number
          lost?: number
          played?: number
          player_id?: string
          points?: number
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_standings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_standings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_standings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          format: string
          id: string
          max_teams: number
          name: string
          season: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          format: string
          id?: string
          max_teams?: number
          name: string
          season: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          format?: string
          id?: string
          max_teams?: number
          name?: string
          season?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      local_session_sync: {
        Row: {
          data: Json
          password_hash: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          data: Json
          password_hash?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          password_hash?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_legs: {
        Row: {
          created_at: string
          id: string
          leg_number: number
          match_id: string
          player1_darts: number
          player1_score: number
          player2_darts: number
          player2_score: number
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          leg_number: number
          match_id: string
          player1_darts?: number
          player1_score?: number
          player2_darts?: number
          player2_score?: number
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          leg_number?: number
          match_id?: string
          player1_darts?: number
          player1_score?: number
          player2_darts?: number
          player2_score?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_legs_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_legs_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      match_stat_details: {
        Row: {
          avg_first9: number
          avg3: number
          band_100: number
          band_120: number
          band_140: number
          band_170: number
          band_60: number
          band_80: number
          best_leg_darts: number | null
          break_attempts: number
          break_makes: number
          checkout_attempts: number
          checkout_makes: number
          context_label: string | null
          count_100_finishes: number
          count_180: number
          created_at: string
          darts_thrown: number
          double_out: boolean
          format: string
          high_finish: number
          id: string
          keep_attempts: number
          keep_makes: number
          legs_against: number
          legs_for: number
          local_match_id: string | null
          local_session_id: string | null
          match_key: string
          opponent_id: string | null
          opponent_name: string
          player_id: string
          points_scored: number
          room_id: string | null
          source: string
          tournament_match_id: string | null
          won: boolean
          worst_leg_darts: number | null
        }
        Insert: {
          avg_first9: number
          avg3: number
          band_100?: number
          band_120?: number
          band_140?: number
          band_170?: number
          band_60?: number
          band_80?: number
          best_leg_darts?: number | null
          break_attempts?: number
          break_makes?: number
          checkout_attempts?: number
          checkout_makes?: number
          context_label?: string | null
          count_100_finishes?: number
          count_180?: number
          created_at?: string
          darts_thrown: number
          double_out: boolean
          format: string
          high_finish?: number
          id?: string
          keep_attempts?: number
          keep_makes?: number
          legs_against: number
          legs_for: number
          local_match_id?: string | null
          local_session_id?: string | null
          match_key: string
          opponent_id?: string | null
          opponent_name: string
          player_id: string
          points_scored: number
          room_id?: string | null
          source: string
          tournament_match_id?: string | null
          won: boolean
          worst_leg_darts?: number | null
        }
        Update: {
          avg_first9?: number
          avg3?: number
          band_100?: number
          band_120?: number
          band_140?: number
          band_170?: number
          band_60?: number
          band_80?: number
          best_leg_darts?: number | null
          break_attempts?: number
          break_makes?: number
          checkout_attempts?: number
          checkout_makes?: number
          context_label?: string | null
          count_100_finishes?: number
          count_180?: number
          created_at?: string
          darts_thrown?: number
          double_out?: boolean
          format?: string
          high_finish?: number
          id?: string
          keep_attempts?: number
          keep_makes?: number
          legs_against?: number
          legs_for?: number
          local_match_id?: string | null
          local_session_id?: string | null
          match_key?: string
          opponent_id?: string | null
          opponent_name?: string
          player_id?: string
          points_scored?: number
          room_id?: string | null
          source?: string
          tournament_match_id?: string | null
          won?: boolean
          worst_leg_darts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_stat_details_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stat_details_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_stat_details_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stat_details_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_stat_details_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stat_details_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          best_of: number
          completed_at: string | null
          created_at: string
          format: string
          id: string
          league_id: string | null
          match_number: number | null
          player1_id: string
          player1_legs: number
          player2_id: string | null
          player2_legs: number
          round: number | null
          started_at: string | null
          status: string
          tournament_id: string | null
          winner_id: string | null
        }
        Insert: {
          best_of?: number
          completed_at?: string | null
          created_at?: string
          format: string
          id?: string
          league_id?: string | null
          match_number?: number | null
          player1_id: string
          player1_legs?: number
          player2_id?: string | null
          player2_legs?: number
          round?: number | null
          started_at?: string | null
          status?: string
          tournament_id?: string | null
          winner_id?: string | null
        }
        Update: {
          best_of?: number
          completed_at?: string | null
          created_at?: string
          format?: string
          id?: string
          league_id?: string | null
          match_number?: number | null
          player1_id?: string
          player1_legs?: number
          player2_id?: string | null
          player2_legs?: number
          round?: number | null
          started_at?: string | null
          status?: string
          tournament_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          best_of: number
          double_out: boolean
          format: string
          id: string
          joined_at: string
          last_seen_at: string
          player_id: string
          rating_points: number
          room_id: string | null
          status: string
        }
        Insert: {
          best_of?: number
          double_out?: boolean
          format?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          player_id: string
          rating_points: number
          room_id?: string | null
          status?: string
        }
        Update: {
          best_of?: number
          double_out?: boolean
          format?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          player_id?: string
          rating_points?: number
          room_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          icon: string | null
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          icon?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          icon?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      online_rooms: {
        Row: {
          best_of: number
          bull_finish: boolean
          created_at: string
          decide_vote_at: string | null
          decide_vote_by: string | null
          decide_vote_team: number | null
          double_out: boolean
          format: string
          guest_id: string | null
          host_id: string
          id: string
          legs_per_set: number | null
          limit_rounds: number | null
          loser_first: boolean
          match_id: string | null
          mode: string
          room_code: string
          start_method: string
          starter_team: number | null
          status: string
          tournament_match_id: string | null
          winner_team: number | null
        }
        Insert: {
          best_of?: number
          bull_finish?: boolean
          created_at?: string
          decide_vote_at?: string | null
          decide_vote_by?: string | null
          decide_vote_team?: number | null
          double_out?: boolean
          format: string
          guest_id?: string | null
          host_id: string
          id?: string
          legs_per_set?: number | null
          limit_rounds?: number | null
          loser_first?: boolean
          match_id?: string | null
          mode?: string
          room_code: string
          start_method?: string
          starter_team?: number | null
          status?: string
          tournament_match_id?: string | null
          winner_team?: number | null
        }
        Update: {
          best_of?: number
          bull_finish?: boolean
          created_at?: string
          decide_vote_at?: string | null
          decide_vote_by?: string | null
          decide_vote_team?: number | null
          double_out?: boolean
          format?: string
          guest_id?: string | null
          host_id?: string
          id?: string
          legs_per_set?: number | null
          limit_rounds?: number | null
          loser_first?: boolean
          match_id?: string | null
          mode?: string
          room_code?: string
          start_method?: string
          starter_team?: number | null
          status?: string
          tournament_match_id?: string | null
          winner_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "online_rooms_decide_vote_by_fkey"
            columns: ["decide_vote_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_rooms_decide_vote_by_fkey"
            columns: ["decide_vote_by"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "online_rooms_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_rooms_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "online_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "online_rooms_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_rooms_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          organizer_id: string
          payout_status: string | null
          rater_id: string
          rating: number
          tournament_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          organizer_id: string
          payout_status?: string | null
          rater_id: string
          rating: number
          tournament_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          organizer_id?: string
          payout_status?: string | null
          rater_id?: string
          rating?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_ratings_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_ratings_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "organizer_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "organizer_ratings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          consumed_at: string | null
          created_at: string
          currency: string
          deep_link: string | null
          id: string
          invoice_id: string | null
          metadata: Json
          player_id: string
          provider: string
          qr_text: string | null
          status: string
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          consumed_at?: string | null
          created_at?: string
          currency?: string
          deep_link?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          player_id: string
          provider: string
          qr_text?: string | null
          status?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          consumed_at?: string | null
          created_at?: string
          currency?: string
          deep_link?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          player_id?: string
          provider?: string
          qr_text?: string | null
          status?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "payment_transactions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_match_results: {
        Row: {
          created_at: string
          format: string | null
          id: string
          opponent_id: string
          payload: Json
          reporter_id: string
          status: string
          winner_id: string
        }
        Insert: {
          created_at?: string
          format?: string | null
          id?: string
          opponent_id: string
          payload: Json
          reporter_id: string
          status?: string
          winner_id: string
        }
        Update: {
          created_at?: string
          format?: string | null
          id?: string
          opponent_id?: string
          payload?: Json
          reporter_id?: string
          status?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_match_results_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_match_results_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pending_match_results_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_match_results_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pending_match_results_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_match_results_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_key: string
          earned_at: string
          id: string
          player_id: string
        }
        Insert: {
          achievement_key: string
          earned_at?: string
          id?: string
          player_id: string
        }
        Update: {
          achievement_key?: string
          earned_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "player_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      player_subscriptions: {
        Row: {
          amount: number
          expires_at: string
          id: string
          payment_id: string | null
          player_id: string
          started_at: string
          status: string
        }
        Insert: {
          amount?: number
          expires_at: string
          id?: string
          payment_id?: string | null
          player_id: string
          started_at?: string
          status?: string
        }
        Update: {
          amount?: number
          expires_at?: string
          id?: string
          payment_id?: string | null
          player_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_subscriptions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_subscriptions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      player_unlocks: {
        Row: {
          id: string
          item_key: string
          item_kind: string
          player_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          item_key: string
          item_kind: string
          player_id: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          item_key?: string
          item_kind?: string
          player_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_unlocks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_unlocks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          headline_metric: number
          id: string
          mode: string
          player_id: string
          summary: Json
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          headline_metric: number
          id?: string
          mode: string
          player_id: string
          summary?: Json
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          headline_metric?: number
          id?: string
          mode?: string
          player_id?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_score: number
          avraga_wins: number
          best_leg: number
          bio: string | null
          career_darts: number
          career_points: number
          checkout_percentage: number
          city: string | null
          count_180: number
          cover_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          equipped_frame: string | null
          gender: string | null
          highest_checkout: number
          id: string
          is_premium: boolean
          matches_played: number
          matches_won: number
          name_animated: boolean
          name_color: string | null
          name_effect: string | null
          name_font: string | null
          phone: string | null
          premium_expires_at: string | null
          primary_club_id: string | null
          primary_club_logo: string | null
          primary_club_tag: string | null
          primary_club_tag_color: string | null
          province: string | null
          rating_points: number
          role: string
          tournament_wins: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          average_score?: number
          avraga_wins?: number
          best_leg?: number
          bio?: string | null
          career_darts?: number
          career_points?: number
          checkout_percentage?: number
          city?: string | null
          count_180?: number
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          equipped_frame?: string | null
          gender?: string | null
          highest_checkout?: number
          id: string
          is_premium?: boolean
          matches_played?: number
          matches_won?: number
          name_animated?: boolean
          name_color?: string | null
          name_effect?: string | null
          name_font?: string | null
          phone?: string | null
          premium_expires_at?: string | null
          primary_club_id?: string | null
          primary_club_logo?: string | null
          primary_club_tag?: string | null
          primary_club_tag_color?: string | null
          province?: string | null
          rating_points?: number
          role?: string
          tournament_wins?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          average_score?: number
          avraga_wins?: number
          best_leg?: number
          bio?: string | null
          career_darts?: number
          career_points?: number
          checkout_percentage?: number
          city?: string | null
          count_180?: number
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          equipped_frame?: string | null
          gender?: string | null
          highest_checkout?: number
          id?: string
          is_premium?: boolean
          matches_played?: number
          matches_won?: number
          name_animated?: boolean
          name_color?: string | null
          name_effect?: string | null
          name_font?: string | null
          phone?: string | null
          premium_expires_at?: string | null
          primary_club_id?: string | null
          primary_club_logo?: string | null
          primary_club_tag?: string | null
          primary_club_tag_color?: string | null
          province?: string | null
          rating_points?: number
          role?: string
          tournament_wins?: number
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_club_id_fkey"
            columns: ["primary_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_history: {
        Row: {
          change: number
          created_at: string
          id: string
          match_id: string | null
          opponent_id: string | null
          player_id: string
          rating_after: number
          rating_before: number
          reason: string
          room_id: string | null
          won: boolean | null
        }
        Insert: {
          change: number
          created_at?: string
          id?: string
          match_id?: string | null
          opponent_id?: string | null
          player_id: string
          rating_after: number
          rating_before: number
          reason?: string
          room_id?: string | null
          won?: boolean | null
        }
        Update: {
          change?: number
          created_at?: string
          id?: string
          match_id?: string | null
          opponent_id?: string | null
          player_id?: string
          rating_after?: number
          rating_before?: number
          reason?: string
          room_id?: string | null
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "rating_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "rating_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          room_id: string
          slot: number
          status: string
          team: number
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          room_id: string
          slot: number
          status?: string
          team: number
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          room_id?: string
          slot?: number
          status?: string
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "room_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "room_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          bulloff: number | null
          id: string
          is_ready: boolean
          joined_at: string
          player_id: string
          room_id: string
          slot: number
          team: number
        }
        Insert: {
          bulloff?: number | null
          id?: string
          is_ready?: boolean
          joined_at?: string
          player_id: string
          room_id: string
          slot: number
          team: number
        }
        Update: {
          bulloff?: number | null
          id?: string
          is_ready?: boolean
          joined_at?: string
          player_id?: string
          room_id?: string
          slot?: number
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_visits: {
        Row: {
          created_at: string
          created_by: string
          darts: number
          id: string
          points: number
          room_id: string
          seq: number
          slot: number
          team: number
        }
        Insert: {
          created_at?: string
          created_by: string
          darts?: number
          id?: string
          points: number
          room_id: string
          seq: number
          slot: number
          team: number
        }
        Update: {
          created_at?: string
          created_by?: string
          darts?: number
          id?: string
          points?: number
          room_id?: string
          seq?: number
          slot?: number
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "room_visits_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      synced_local_sessions: {
        Row: {
          session_id: string
          synced_at: string
        }
        Insert: {
          session_id: string
          synced_at?: string
        }
        Update: {
          session_id?: string
          synced_at?: string
        }
        Relationships: []
      }
      throws: {
        Row: {
          created_at: string
          darts_used: number
          id: string
          is_checkout: boolean
          leg_id: string
          player_id: string
          remaining: number
          score: number
          throw_number: number
        }
        Insert: {
          created_at?: string
          darts_used?: number
          id?: string
          is_checkout?: boolean
          leg_id: string
          player_id: string
          remaining: number
          score: number
          throw_number: number
        }
        Update: {
          created_at?: string
          darts_used?: number
          id?: string
          is_checkout?: boolean
          leg_id?: string
          player_id?: string
          remaining?: number
          score?: number
          throw_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "throws_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "match_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "throws_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "throws_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      tournament_entrant_players: {
        Row: {
          entrant_id: string
          id: string
          player_id: string
          slot: number
        }
        Insert: {
          entrant_id: string
          id?: string
          player_id: string
          slot?: number
        }
        Update: {
          entrant_id?: string
          id?: string
          player_id?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entrant_players_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "tournament_entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entrant_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entrant_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
      tournament_entrants: {
        Row: {
          created_at: string
          display_name: string
          group_no: number | null
          id: string
          seed: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          group_no?: number | null
          id?: string
          seed: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          group_no?: number | null
          id?: string
          seed?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entrants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          created_at: string
          group_no: number | null
          id: string
          is_losers_bracket: boolean
          loser_entrant_id: string | null
          match_number: number
          next_loser_match_id: string | null
          next_match_id: string | null
          room_id: string | null
          round: number
          side1_entrant_id: string | null
          side1_legs: number
          side2_entrant_id: string | null
          side2_legs: number
          stage_id: string | null
          status: string
          tournament_id: string
          winner_entrant_id: string | null
        }
        Insert: {
          created_at?: string
          group_no?: number | null
          id?: string
          is_losers_bracket?: boolean
          loser_entrant_id?: string | null
          match_number: number
          next_loser_match_id?: string | null
          next_match_id?: string | null
          room_id?: string | null
          round: number
          side1_entrant_id?: string | null
          side1_legs?: number
          side2_entrant_id?: string | null
          side2_legs?: number
          stage_id?: string | null
          status?: string
          tournament_id: string
          winner_entrant_id?: string | null
        }
        Update: {
          created_at?: string
          group_no?: number | null
          id?: string
          is_losers_bracket?: boolean
          loser_entrant_id?: string | null
          match_number?: number
          next_loser_match_id?: string | null
          next_match_id?: string | null
          room_id?: string | null
          round?: number
          side1_entrant_id?: string | null
          side1_legs?: number
          side2_entrant_id?: string | null
          side2_legs?: number
          stage_id?: string | null
          status?: string
          tournament_id?: string
          winner_entrant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_loser_entrant_id_fkey"
            columns: ["loser_entrant_id"]
            isOneToOne: false
            referencedRelation: "tournament_entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_next_loser_match_id_fkey"
            columns: ["next_loser_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "online_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_side1_entrant_id_fkey"
            columns: ["side1_entrant_id"]
            isOneToOne: false
            referencedRelation: "tournament_entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_side2_entrant_id_fkey"
            columns: ["side2_entrant_id"]
            isOneToOne: false
            referencedRelation: "tournament_entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "tournament_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_entrant_id_fkey"
            columns: ["winner_entrant_id"]
            isOneToOne: false
            referencedRelation: "tournament_entrants"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_payout_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at: string
          iban: string | null
          id: string
          player_id: string
          tournament_id: string
        }
        Insert: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at?: string
          iban?: string | null
          id?: string
          player_id: string
          tournament_id: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          iban?: string | null
          id?: string
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_payout_accounts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_payout_accounts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournament_payout_accounts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          id: string
          payment_id: string | null
          payment_status: string
          player_id: string
          registered_at: string
          seed: number | null
          tournament_id: string
        }
        Insert: {
          id?: string
          payment_id?: string | null
          payment_status?: string
          player_id: string
          registered_at?: string
          seed?: number | null
          tournament_id: string
        }
        Update: {
          id?: string
          payment_id?: string | null
          payment_status?: string
          player_id?: string
          registered_at?: string
          seed?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_stages: {
        Row: {
          config: Json
          created_at: string
          id: string
          order_no: number
          stage_type: string
          status: string
          tournament_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          order_no?: number
          stage_type: string
          status?: string
          tournament_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          order_no?: number
          stage_type?: string
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_stages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          allow_participant_score: boolean
          auto_complete: boolean
          banner_url: string | null
          bracket_type: string
          bull_finish_at_limit: boolean
          club_id: string | null
          confirm_opponent: boolean
          created_at: string
          current_players: number
          current_stage_id: string | null
          description: string | null
          double_in: boolean
          double_out: boolean
          enable_draw: boolean
          end_date: string | null
          entry_fee: number
          first_to: number
          format: string
          group_advance: number
          groups_count: number
          id: string
          is_private: boolean
          join_code: string | null
          legs_per_set: number
          limit_rounds: number | null
          location: string | null
          loser_first: boolean
          max_players: number
          name: string
          organizer_account_holder: string | null
          organizer_account_number: string | null
          organizer_bank_name: string | null
          organizer_iban: string | null
          organizer_id: string
          password: string | null
          platform_fee: number
          platform_fee_paid: boolean
          players_per_group: number
          point_draw: number
          point_lost: number
          point_won: number
          prize_pool: number
          registration_deadline: string | null
          rr_first_to: number
          rr_legs_per_set: number
          rr_sets_enabled: boolean
          rules: string | null
          sets_enabled: boolean
          show_average: boolean
          show_index: boolean
          start_date: string
          stats_enabled: boolean
          status: string
          third_place_match: boolean
          tournament_type: string
          type: string
          updated_at: string
          uses_stages: boolean | null
          win_points_are_legs: boolean
        }
        Insert: {
          allow_participant_score?: boolean
          auto_complete?: boolean
          banner_url?: string | null
          bracket_type?: string
          bull_finish_at_limit?: boolean
          club_id?: string | null
          confirm_opponent?: boolean
          created_at?: string
          current_players?: number
          current_stage_id?: string | null
          description?: string | null
          double_in?: boolean
          double_out?: boolean
          enable_draw?: boolean
          end_date?: string | null
          entry_fee?: number
          first_to?: number
          format: string
          group_advance?: number
          groups_count?: number
          id?: string
          is_private?: boolean
          join_code?: string | null
          legs_per_set?: number
          limit_rounds?: number | null
          location?: string | null
          loser_first?: boolean
          max_players?: number
          name: string
          organizer_account_holder?: string | null
          organizer_account_number?: string | null
          organizer_bank_name?: string | null
          organizer_iban?: string | null
          organizer_id: string
          password?: string | null
          platform_fee?: number
          platform_fee_paid?: boolean
          players_per_group?: number
          point_draw?: number
          point_lost?: number
          point_won?: number
          prize_pool?: number
          registration_deadline?: string | null
          rr_first_to?: number
          rr_legs_per_set?: number
          rr_sets_enabled?: boolean
          rules?: string | null
          sets_enabled?: boolean
          show_average?: boolean
          show_index?: boolean
          start_date: string
          stats_enabled?: boolean
          status?: string
          third_place_match?: boolean
          tournament_type?: string
          type?: string
          updated_at?: string
          uses_stages?: boolean | null
          win_points_are_legs?: boolean
        }
        Update: {
          allow_participant_score?: boolean
          auto_complete?: boolean
          banner_url?: string | null
          bracket_type?: string
          bull_finish_at_limit?: boolean
          club_id?: string | null
          confirm_opponent?: boolean
          created_at?: string
          current_players?: number
          current_stage_id?: string | null
          description?: string | null
          double_in?: boolean
          double_out?: boolean
          enable_draw?: boolean
          end_date?: string | null
          entry_fee?: number
          first_to?: number
          format?: string
          group_advance?: number
          groups_count?: number
          id?: string
          is_private?: boolean
          join_code?: string | null
          legs_per_set?: number
          limit_rounds?: number | null
          location?: string | null
          loser_first?: boolean
          max_players?: number
          name?: string
          organizer_account_holder?: string | null
          organizer_account_number?: string | null
          organizer_bank_name?: string | null
          organizer_iban?: string | null
          organizer_id?: string
          password?: string | null
          platform_fee?: number
          platform_fee_paid?: boolean
          players_per_group?: number
          point_draw?: number
          point_lost?: number
          point_won?: number
          prize_pool?: number
          registration_deadline?: string | null
          rr_first_to?: number
          rr_legs_per_set?: number
          rr_sets_enabled?: boolean
          rules?: string | null
          sets_enabled?: boolean
          show_average?: boolean
          show_index?: boolean
          start_date?: string
          stats_enabled?: boolean
          status?: string
          third_place_match?: boolean
          tournament_type?: string
          type?: string
          updated_at?: string
          uses_stages?: boolean | null
          win_points_are_legs?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "tournament_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "province_rankings"
            referencedColumns: ["player_id"]
          },
        ]
      }
    }
    Views: {
      province_rankings: {
        Row: {
          avatar_url: string | null
          average_score: number | null
          display_name: string | null
          matches_played: number | null
          matches_won: number | null
          player_id: string | null
          province: string | null
          province_rank: number | null
          rating_points: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_tournament_match: {
        Args: {
          p_match_id: string
          p_side1_legs: number
          p_side2_legs: number
          p_winning_side: number
        }
        Returns: undefined
      }
      apply_match_result: {
        Args: { p_history: Json; p_updates: Json }
        Returns: undefined
      }
      calculate_elo_change: {
        Args: {
          k_factor?: number
          opponent_rating: number
          player_rating: number
          won: boolean
        }
        Returns: number
      }
      check_achievements: { Args: { p_player_id: string }; Returns: string[] }
      club_tier_idx: { Args: { score: number }; Returns: number }
      get_player_stat_summary: {
        Args: { p_player_id: string }
        Returns: {
          avg_first9: number
          avg3: number
          band_100: number
          band_120: number
          band_140: number
          band_170: number
          band_60: number
          band_80: number
          best_leg_darts: number
          break_attempts: number
          break_makes: number
          checkout_attempts: number
          checkout_makes: number
          count_100_finishes: number
          count_180: number
          darts_thrown: number
          high_finish: number
          keep_attempts: number
          keep_makes: number
          legs_against: number
          legs_for: number
          matches: number
          points_scored: number
          worst_leg_darts: number
        }[]
      }
      get_practice_stat_summary: {
        Args: { p_player_id: string }
        Returns: {
          best_metric: number
          last_played: string
          mode: string
          session_count: number
          worst_metric: number
        }[]
      }
      matchmaking_claim_match: {
        Args: {
          p_best_of: number
          p_double_out: boolean
          p_elo_window: number
          p_format: string
          p_player_id: string
          p_rating: number
        }
        Returns: {
          matched: boolean
          room_id: string
        }[]
      }
      matchmaking_heartbeat: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      matchmaking_join_queue: {
        Args: {
          p_best_of: number
          p_double_out: boolean
          p_format: string
          p_player_id: string
          p_rating: number
        }
        Returns: undefined
      }
      refresh_premium_status: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      seed_knockout: {
        Args: { p_assignments: Json; p_tournament_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_tournament: {
        Args: {
          p_entrant_players: Json
          p_entrants: Json
          p_matches: Json
          p_tournament_id: string
        }
        Returns: undefined
      }
      undo_last_room_visit: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: {
          created_at: string
          created_by: string
          darts: number
          id: string
          points: number
          room_id: string
          seq: number
          slot: number
          team: number
        }[]
        SetofOptions: {
          from: "*"
          to: "room_visits"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_club_score: { Args: { p_club_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]

export type Profile = Tables<"profiles">
export type Club = Tables<"clubs">
export type ClubMember = Tables<"club_members">
export type Tournament = Tables<"tournaments">
export type TournamentStatus = "draft" | "registration" | "ongoing" | "completed" | "cancelled"
export type TournamentRegistration = Tables<"tournament_registrations">
export type Match = Tables<"matches">
export type MatchLeg = Tables<"match_legs">
export type Throw = Tables<"throws">
export type League = Tables<"leagues">
export type LeagueStanding = Tables<"league_standings">
export type RatingHistory = Tables<"rating_history">
export type PaymentTransaction = Tables<"payment_transactions">
export type OnlineRoom = Tables<"online_rooms">
export type RoomPlayer = Tables<"room_players">
export type RoomInvite = Tables<"room_invites">
export type RoomVisit = Tables<"room_visits">
export type MatchStatDetail = Tables<"match_stat_details">
export type PracticeSession = Tables<"practice_sessions">
