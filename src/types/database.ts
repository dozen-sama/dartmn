export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string
          avatar_url: string | null
          cover_url: string | null
          phone: string | null
          gender: "male" | "female" | "other" | null
          date_of_birth: string | null
          city: string | null
          province: string | null
          bio: string | null
          role: "player" | "club_admin" | "admin"
          rating_points: number
          matches_played: number
          matches_won: number
          tournament_wins: number
          average_score: number
          checkout_percentage: number
          highest_checkout: number
          best_leg: number
          count_180: number
          is_premium: boolean
          premium_expires_at: string | null
          primary_club_id: string | null
          primary_club_logo: string | null
          primary_club_tag: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name: string
          avatar_url?: string | null
          cover_url?: string | null
          phone?: string | null
          gender?: "male" | "female" | "other" | null
          date_of_birth?: string | null
          city?: string | null
          province?: string | null
          bio?: string | null
          role?: "player" | "club_admin" | "admin"
        }
        Update: {
          username?: string
          display_name?: string
          avatar_url?: string | null
          cover_url?: string | null
          phone?: string | null
          gender?: "male" | "female" | "other" | null
          date_of_birth?: string | null
          city?: string | null
          province?: string | null
          bio?: string | null
          role?: "player" | "club_admin" | "admin"
          rating_points?: number
          average_score?: number
          checkout_percentage?: number
          highest_checkout?: number
          best_leg?: number
          count_180?: number
          matches_played?: number
          matches_won?: number
          tournament_wins?: number
          is_premium?: boolean
          premium_expires_at?: string | null
          primary_club_id?: string | null
          primary_club_logo?: string | null
          primary_club_tag?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          cover_url: string | null
          address: string | null
          city: string | null
          phone: string | null
          email: string | null
          website: string | null
          owner_id: string
          member_count: number
          is_verified: boolean
          club_score: number
          club_rank: number | null
          tag: string | null
          tagline: string | null
          features: Json
          social_discord: string | null
          social_facebook: string | null
          social_instagram: string | null
          subscription_plan: "basic" | "pro" | "enterprise" | null
          subscription_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          cover_url?: string | null
          address?: string | null
          city?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          owner_id: string
          tag?: string | null
          tagline?: string | null
          features?: Json
          social_discord?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          logo_url?: string | null
          cover_url?: string | null
          address?: string | null
          city?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          is_verified?: boolean
          tag?: string | null
          tagline?: string | null
          features?: Json
          social_discord?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          subscription_plan?: "basic" | "pro" | "enterprise" | null
          subscription_expires_at?: string | null
        }
        Relationships: []
      }
      club_members: {
        Row: {
          id: string
          club_id: string
          player_id: string
          role: "owner" | "admin" | "member"
          joined_at: string
        }
        Insert: {
          id?: string
          club_id: string
          player_id: string
          role?: "owner" | "admin" | "member"
        }
        Update: {
          role?: "owner" | "admin" | "member"
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          id: string
          name: string
          description: string | null
          club_id: string | null
          organizer_id: string
          format: "501" | "301" | "cricket" | "cutthroat"
          type: "singles" | "doubles" | "team"
          bracket_type: "single_elimination" | "double_elimination" | "round_robin" | "swiss"
          status: "draft" | "registration" | "ongoing" | "completed" | "cancelled"
          max_players: number
          current_players: number
          entry_fee: number
          prize_pool: number
          start_date: string
          end_date: string | null
          registration_deadline: string | null
          location: string | null
          banner_url: string | null
          rules: string | null
          join_code: string | null
          password: string | null
          is_private: boolean
          first_to: number
          sets_enabled: boolean
          legs_per_set: number
          limit_rounds: number | null
          loser_first: boolean
          show_average: boolean
          auto_complete: boolean
          confirm_opponent: boolean
          allow_participant_score: boolean
          show_index: boolean
          point_won: number
          point_draw: number
          point_lost: number
          win_points_are_legs: boolean
          tournament_type: "open" | "league" | "national" | "club" | "friendly"
          platform_fee: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          club_id?: string | null
          organizer_id: string
          format: "501" | "301" | "cricket" | "cutthroat"
          type?: "singles" | "doubles" | "team"
          bracket_type?: "single_elimination" | "double_elimination" | "round_robin" | "swiss"
          status?: "draft" | "registration" | "ongoing" | "completed" | "cancelled"
          max_players?: number
          entry_fee?: number
          prize_pool?: number
          start_date: string
          end_date?: string | null
          registration_deadline?: string | null
          location?: string | null
          banner_url?: string | null
          rules?: string | null
          join_code?: string | null
          password?: string | null
          is_private?: boolean
          first_to?: number
          sets_enabled?: boolean
          legs_per_set?: number
          limit_rounds?: number | null
          loser_first?: boolean
          show_average?: boolean
          auto_complete?: boolean
          confirm_opponent?: boolean
          allow_participant_score?: boolean
          show_index?: boolean
          point_won?: number
          point_draw?: number
          point_lost?: number
          win_points_are_legs?: boolean
        }
        Update: {
          name?: string
          description?: string | null
          status?: "draft" | "registration" | "ongoing" | "completed" | "cancelled"
          max_players?: number
          entry_fee?: number
          prize_pool?: number
          start_date?: string
          end_date?: string | null
          registration_deadline?: string | null
          club_id?: string | null
          location?: string | null
          banner_url?: string | null
          rules?: string | null
          join_code?: string | null
          password?: string | null
          is_private?: boolean
          format?: "501" | "301" | "cricket" | "cutthroat"
          bracket_type?: "single_elimination" | "double_elimination" | "round_robin" | "swiss"
          first_to?: number
          sets_enabled?: boolean
          legs_per_set?: number
          limit_rounds?: number | null
          loser_first?: boolean
          show_average?: boolean
          auto_complete?: boolean
          confirm_opponent?: boolean
          allow_participant_score?: boolean
          show_index?: boolean
          point_won?: number
          point_draw?: number
          point_lost?: number
          win_points_are_legs?: boolean
        }
        Relationships: []
      }
      tournament_registrations: {
        Row: {
          id: string
          tournament_id: string
          player_id: string
          seed: number | null
          payment_status: "pending" | "paid" | "refunded"
          payment_id: string | null
          registered_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          player_id: string
          seed?: number | null
          payment_status?: "pending" | "paid" | "refunded"
          payment_id?: string | null
        }
        Update: {
          seed?: number | null
          payment_status?: "pending" | "paid" | "refunded"
          payment_id?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          id: string
          tournament_id: string | null
          league_id: string | null
          round: number | null
          match_number: number | null
          player1_id: string
          player2_id: string | null
          format: "501" | "301" | "cricket" | "cutthroat"
          best_of: number
          player1_legs: number
          player2_legs: number
          winner_id: string | null
          status: "scheduled" | "ongoing" | "completed" | "cancelled"
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id?: string | null
          league_id?: string | null
          round?: number | null
          match_number?: number | null
          player1_id: string
          player2_id?: string | null
          format: "501" | "301" | "cricket" | "cutthroat"
          best_of?: number
          winner_id?: string | null
          status?: "scheduled" | "ongoing" | "completed" | "cancelled"
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          player1_legs?: number
          player2_legs?: number
          winner_id?: string | null
          status?: "scheduled" | "ongoing" | "completed" | "cancelled"
          started_at?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      match_legs: {
        Row: {
          id: string
          match_id: string
          leg_number: number
          player1_score: number
          player2_score: number
          winner_id: string | null
          player1_darts: number
          player2_darts: number
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          leg_number: number
          player1_score?: number
          player2_score?: number
          winner_id?: string | null
          player1_darts?: number
          player2_darts?: number
        }
        Update: {
          player1_score?: number
          player2_score?: number
          winner_id?: string | null
          player1_darts?: number
          player2_darts?: number
        }
        Relationships: []
      }
      throws: {
        Row: {
          id: string
          leg_id: string
          player_id: string
          throw_number: number
          score: number
          darts_used: number
          remaining: number
          is_checkout: boolean
          created_at: string
        }
        Insert: {
          id?: string
          leg_id: string
          player_id: string
          throw_number: number
          score: number
          darts_used?: number
          remaining: number
          is_checkout?: boolean
        }
        Update: Record<string, never>
        Relationships: []
      }
      leagues: {
        Row: {
          id: string
          name: string
          description: string | null
          season: string
          format: "501" | "301" | "cricket"
          status: "upcoming" | "ongoing" | "completed"
          max_teams: number
          start_date: string
          end_date: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          season: string
          format: "501" | "301" | "cricket"
          status?: "upcoming" | "ongoing" | "completed"
          max_teams?: number
          start_date: string
          end_date?: string | null
          created_by: string
        }
        Update: {
          name?: string
          description?: string | null
          status?: "upcoming" | "ongoing" | "completed"
          end_date?: string | null
        }
        Relationships: []
      }
      league_standings: {
        Row: {
          id: string
          league_id: string
          player_id: string
          played: number
          won: number
          lost: number
          drawn: number
          legs_won: number
          legs_lost: number
          points: number
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          player_id: string
          played?: number
          won?: number
          lost?: number
          drawn?: number
          legs_won?: number
          legs_lost?: number
          points?: number
        }
        Update: {
          played?: number
          won?: number
          lost?: number
          drawn?: number
          legs_won?: number
          legs_lost?: number
          points?: number
        }
        Relationships: []
      }
      rating_history: {
        Row: {
          id: string
          player_id: string
          rating_before: number
          rating_after: number
          change: number
          match_id: string | null
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          rating_before: number
          rating_after: number
          change: number
          match_id?: string | null
          reason?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      payment_transactions: {
        Row: {
          id: string
          player_id: string
          tournament_id: string | null
          amount: number
          currency: string
          provider: "qpay" | "socialpay"
          status: "pending" | "paid" | "failed" | "refunded"
          invoice_id: string | null
          qr_text: string | null
          deep_link: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          tournament_id?: string | null
          amount: number
          currency?: string
          provider: "qpay" | "socialpay"
          status?: "pending" | "paid" | "failed" | "refunded"
          invoice_id?: string | null
          qr_text?: string | null
          deep_link?: string | null
          metadata?: Json
        }
        Update: {
          status?: "pending" | "paid" | "failed" | "refunded"
          invoice_id?: string | null
          qr_text?: string | null
          deep_link?: string | null
        }
        Relationships: []
      }
      online_rooms: {
        Row: {
          id: string
          room_code: string
          host_id: string
          guest_id: string | null
          format: "501" | "301" | "cricket"
          best_of: number
          status: "waiting" | "ongoing" | "completed"
          match_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_code: string
          host_id: string
          guest_id?: string | null
          format: "501" | "301" | "cricket"
          best_of?: number
          status?: "waiting" | "ongoing" | "completed"
          match_id?: string | null
        }
        Update: {
          guest_id?: string | null
          status?: "waiting" | "ongoing" | "completed"
          match_id?: string | null
        }
        Relationships: []
      }
      achievements: {
        Row: {
          key: string
          name: string
          description: string
          icon: string
          category: string
          sort_order: number
        }
        Insert: {
          key: string
          name: string
          description: string
          icon: string
          category?: string
          sort_order?: number
        }
        Update: { name?: string; description?: string; icon?: string; sort_order?: number }
        Relationships: []
      }
      player_achievements: {
        Row: {
          id: string
          player_id: string
          achievement_key: string
          earned_at: string
        }
        Insert: {
          id?: string
          player_id: string
          achievement_key: string
          earned_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          is_read: boolean
          link: string | null
          icon: string | null
          data: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          is_read?: boolean
          link?: string | null
          icon?: string | null
          data?: Json
        }
        Update: { is_read?: boolean }
        Relationships: []
      }
      player_subscriptions: {
        Row: {
          id: string
          player_id: string
          status: "active" | "cancelled" | "expired"
          started_at: string
          expires_at: string
          amount: number
          payment_id: string | null
        }
        Insert: {
          id?: string
          player_id: string
          status?: "active" | "cancelled" | "expired"
          expires_at: string
          amount?: number
          payment_id?: string | null
        }
        Update: {
          status?: "active" | "cancelled" | "expired"
          expires_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]

export type Profile = Tables<"profiles">
export type Club = Tables<"clubs">
export type ClubMember = Tables<"club_members">
export type Tournament = Tables<"tournaments">
export type TournamentRegistration = Tables<"tournament_registrations">
export type Match = Tables<"matches">
export type MatchLeg = Tables<"match_legs">
export type Throw = Tables<"throws">
export type League = Tables<"leagues">
export type LeagueStanding = Tables<"league_standings">
export type RatingHistory = Tables<"rating_history">
export type PaymentTransaction = Tables<"payment_transactions">
export type OnlineRoom = Tables<"online_rooms">
