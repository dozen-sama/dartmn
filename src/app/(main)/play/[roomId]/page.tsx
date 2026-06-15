import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { OnlineRoom, type RoomPlayerView } from "./OnlineRoom"

export const metadata: Metadata = { title: "Онлайн тоглолт" }

export const dynamic = "force-dynamic"

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: room } = await supabase.from("online_rooms").select("*").eq("id", roomId).single()
  if (!room) notFound()

  const { data: rp } = await supabase.from("room_players").select("*").eq("room_id", roomId)
  const players = rp ?? []

  const ids = [...new Set([room.host_id, ...players.map((p) => p.player_id)])]
  const { data: profs } = await supabase
    .from("profiles").select("id, display_name, username, avatar_url, rating_points").in("id", ids)
  const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))

  const playerViews: RoomPlayerView[] = players.map((p) => ({
    player_id: p.player_id,
    team: p.team,
    slot: p.slot,
    is_ready: p.is_ready,
    profile: byId[p.player_id] ?? null,
  }))

  // Энэ хэрэглэгчид ирсэн хүлээгдэж буй урилга (уригдсан ч ороогүй бол)
  const { data: invite } = await supabase
    .from("room_invites")
    .select("id, team, slot, status")
    .eq("room_id", roomId).eq("invitee_id", user.id).eq("status", "pending")
    .maybeSingle()

  return (
    <OnlineRoom
      room={room}
      players={playerViews}
      myInvite={invite ?? null}
      currentUserId={user.id}
      hostName={byId[room.host_id]?.display_name || byId[room.host_id]?.username || "Host"}
    />
  )
}
