import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { TournamentsContent } from "./TournamentsContent"
import { Tournament } from "@/types/database"

export const metadata: Metadata = { title: "Тэмцээнүүд" }

type TournamentWithRelations = Tournament & {
  profiles: { display_name: string; username: string; avatar_url: string | null } | null
  clubs: { name: string; logo_url: string | null } | null
}

export default async function TournamentsPage() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select(`
      *,
      profiles!tournaments_organizer_id_fkey(display_name, username, avatar_url),
      clubs(name, logo_url)
    `)
    .order("start_date", { ascending: false })
    .limit(50)

  return <TournamentsContent tournaments={(tournaments ?? []) as unknown as TournamentWithRelations[]} />
}
