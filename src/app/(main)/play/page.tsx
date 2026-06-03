export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PlayLobby } from "./PlayLobby"
import { OnlineRoom, Profile } from "@/types/database"

export const metadata: Metadata = { title: "Онлайн тоглолт" }

type ProfileSnippet = Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points">
type RoomWithHost = OnlineRoom & { profiles: ProfileSnippet | null }

export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, rating_points")
    .eq("id", user.id)
    .single()

  const { data: activeRooms } = await supabase
    .from("online_rooms")
    .select("*, profiles!online_rooms_host_id_fkey(display_name, username, avatar_url, rating_points)")
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(20)

  return (
    <PlayLobby
      profile={profile as ProfileSnippet | null}
      activeRooms={(activeRooms ?? []) as unknown as RoomWithHost[]}
    />
  )
}
