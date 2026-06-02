import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProfileContent } from "./ProfileContent"
import { Match, Profile, Tournament, TournamentRegistration } from "@/types/database"

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
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  const [matchesResult, tournamentResult, clubResult] = await Promise.all([
    supabase
      .from("matches")
      .select("*, winner:profiles!matches_winner_id_fkey(display_name, username)")
      .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
    supabase
      .from("tournament_registrations")
      .select("*, tournaments(id, name, status, start_date)")
      .eq("player_id", profile.id)
      .order("registered_at", { ascending: false })
      .limit(10),
    supabase
      .from("club_members")
      .select("clubs(name)")
      .eq("player_id", profile.id)
      .limit(1)
      .single(),
  ])

  const clubName = (clubResult.data?.clubs as { name: string } | null)?.name ?? null

  return (
    <ProfileContent
      profile={profile as Profile}
      isOwner={user?.id === profile.id}
      clubName={clubName}
      recentMatches={(matchesResult.data ?? []) as unknown as MatchWithWinner[]}
      tournaments={(tournamentResult.data ?? []) as unknown as RegistrationWithTournament[]}
    />
  )
}
