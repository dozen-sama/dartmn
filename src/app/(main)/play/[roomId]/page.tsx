import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { OnlineRoom } from "./OnlineRoom"

export const metadata: Metadata = { title: "Онлайн тоглолт" }

export const dynamic = "force-dynamic"

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: room } = await supabase
    .from("online_rooms")
    .select("*, host:profiles!online_rooms_host_id_fkey(id, display_name, username, avatar_url, rating_points), guest:profiles!online_rooms_guest_id_fkey(id, display_name, username, avatar_url, rating_points)")
    .eq("id", roomId)
    .single()

  if (!room) notFound()

  // If guest slot is empty and current user is not host, join as guest
  if (!room.guest_id && room.host_id !== user.id && room.status === "waiting") {
    await supabase.from("online_rooms").update({ guest_id: user.id, status: "ongoing" }).eq("id", roomId)
  }

  const { data: profile } = await supabase.from("profiles")
    .select("id, display_name, username, avatar_url, rating_points").eq("id", user.id).single()

  return (
    <OnlineRoom
      room={room as any}
      currentUserId={user.id}
      currentProfile={profile as any}
    />
  )
}
