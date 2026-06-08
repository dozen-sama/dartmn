import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { RatingsContent } from "./RatingsContent"

export const metadata: Metadata = { title: "Рейтинг" }

export const revalidate = 60

export default async function RatingsPage() {
  const supabase = await createClient()

  const [playersResult, clubsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, rating_points, matches_played, matches_won, average_score, count_180, highest_checkout, city, province, primary_club_logo, primary_club_tag, primary_club_tag_color, equipped_frame, name_effect, name_color, name_font, name_animated")
      .order("rating_points", { ascending: false })
      .limit(200),
    supabase
      .from("clubs")
      .select("id, name, tag, tag_color, logo_url, club_score, member_count, city")
      .order("club_score", { ascending: false })
      .limit(50),
  ])

  return (
    <RatingsContent
      players={playersResult.data ?? []}
      clubs={clubsResult.data ?? []}
    />
  )
}
