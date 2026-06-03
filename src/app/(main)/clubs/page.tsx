export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ClubsContent } from "./ClubsContent"
import { Club, Profile } from "@/types/database"

export const metadata: Metadata = { title: "Клубууд" }

type ClubWithOwner = Club & {
  profiles: Pick<Profile, "display_name" | "username" | "avatar_url"> | null
}

export default async function ClubsPage() {
  const supabase = await createClient()

  // Explicit FK hint to avoid ambiguous join errors
  const { data: clubs, error } = await supabase
    .from("clubs")
    .select("*, profiles!clubs_owner_id_fkey(display_name, username, avatar_url)")
    .order("member_count", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[clubs/page] Supabase error:", error)
    // Fallback: fetch clubs without profiles join
    const { data: clubsOnly } = await supabase
      .from("clubs")
      .select("*")
      .order("member_count", { ascending: false })
      .limit(50)
    return <ClubsContent clubs={(clubsOnly ?? []) as unknown as ClubWithOwner[]} />
  }

  return <ClubsContent clubs={(clubs ?? []) as unknown as ClubWithOwner[]} />
}
