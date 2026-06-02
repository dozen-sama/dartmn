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

  const { data: clubs } = await supabase
    .from("clubs")
    .select("*, profiles(display_name, username, avatar_url)")
    .order("member_count", { ascending: false })
    .limit(50)

  return <ClubsContent clubs={(clubs ?? []) as unknown as ClubWithOwner[]} />
}
