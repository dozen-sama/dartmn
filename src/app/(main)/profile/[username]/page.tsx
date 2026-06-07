export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProfileContent } from "./ProfileContent"
import { Match, Profile, Tournament, TournamentRegistration } from "@/types/database"
import { isPassActive, type EffectRow, type PassRow } from "@/lib/cosmetics"

type MatchWithWinner = Match & {
  winner: { display_name: string; username: string } | null
}
type RegistrationWithTournament = TournamentRegistration & {
  tournaments: Pick<Tournament, "id" | "name" | "status" | "start_date"> | null
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  return { title: `@${username}` }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("username", username).single()
  if (!profile) notFound()

  const [matchesResult, tournamentResult, clubResult, allAchievementsResult, earnedResult, unlocksResult, effectsResult, passesResult] = await Promise.all([
    supabase.from("matches")
      .select("*, winner:profiles!matches_winner_id_fkey(display_name, username)")
      .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
      .eq("status", "completed").order("completed_at", { ascending: false }).limit(10),
    supabase.from("tournament_registrations")
      .select("*, tournaments(id, name, status, start_date)")
      .eq("player_id", profile.id).order("registered_at", { ascending: false }).limit(10),
    supabase.from("club_members").select("clubs(name)").eq("player_id", profile.id).limit(1).single(),
    supabase.from("achievements").select("*").order("sort_order"),
    supabase.from("player_achievements")
      .select("achievement_key, earned_at").eq("player_id", profile.id),
    supabase.from("player_unlocks").select("item_key").eq("player_id", profile.id).eq("item_kind", "effect"),
    supabase.from("cosmetic_effects").select("key, name, lottie_url, xp, fit, scale, offset_x, offset_y, scope, pass_id, is_active, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("cosmetic_passes").select("id, name, starts_at, ends_at"),
  ])

  const clubName = (clubResult.data?.clubs as unknown as { name: string } | null)?.name ?? null
  const ownedEffects = (unlocksResult.data ?? []).map((u) => u.item_key)
  const passMap = new Map(((passesResult.data ?? []) as PassRow[]).map((p) => [p.id, p]))
  const effects = ((effectsResult.data ?? []) as EffectRow[]).map((e) => ({
    ...e,
    passActive: isPassActive(e.pass_id ? passMap.get(e.pass_id) : null),
  }))

  return (
    <ProfileContent
      profile={profile as Profile}
      isOwner={user?.id === profile.id}
      clubName={clubName}
      recentMatches={(matchesResult.data ?? []) as unknown as MatchWithWinner[]}
      tournaments={(tournamentResult.data ?? []) as unknown as RegistrationWithTournament[]}
      allAchievements={(allAchievementsResult.data ?? []) as any[]}
      earnedAchievements={(earnedResult.data ?? []) as { achievement_key: string; earned_at: string }[]}
      ownedEffects={ownedEffects}
      effects={effects}
    />
  )
}
