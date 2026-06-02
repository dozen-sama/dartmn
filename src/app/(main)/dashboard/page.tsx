import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "./DashboardContent"
import { Profile, Tournament } from "@/types/database"

export const metadata: Metadata = { title: "Нүүр хуудас" }

type TournamentWithOrganizer = Tournament & {
  profiles: { display_name: string; avatar_url: string | null; username: string } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [profileResult, tournamentsResult, ratingsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("tournaments")
      .select("*, profiles!tournaments_organizer_id_fkey(display_name, avatar_url, username)")
      .in("status", ["registration", "ongoing"])
      .order("start_date", { ascending: true })
      .limit(6),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, rating_points, matches_played, matches_won")
      .order("rating_points", { ascending: false })
      .limit(10),
  ])

  return (
    <DashboardContent
      profile={profileResult.data as Profile | null}
      tournaments={(tournamentsResult.data ?? []) as unknown as TournamentWithOrganizer[]}
      topPlayers={ratingsResult.data ?? []}
    />
  )
}
