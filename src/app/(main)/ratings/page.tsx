import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { RatingsContent } from "./RatingsContent"

export const metadata: Metadata = { title: "Рейтинг" }

export default async function RatingsPage() {
  const supabase = await createClient()

  const { data: players } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, rating_points, matches_played, matches_won, average_score, count_180, highest_checkout, city")
    .order("rating_points", { ascending: false })
    .limit(100)

  return <RatingsContent players={players ?? []} />
}
