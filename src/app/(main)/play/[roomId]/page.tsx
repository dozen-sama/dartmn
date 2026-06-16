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

  // Бие даасан query-г зэрэг (навигацийн саатлыг багасгана)
  const [{ data: room }, { data: rp }, { data: invite }] = await Promise.all([
    supabase.from("online_rooms").select("*").eq("id", roomId).single(),
    supabase.from("room_players").select("*").eq("room_id", roomId),
    supabase.from("room_invites")
      .select("id, team, slot, status")
      .eq("room_id", roomId).eq("invitee_id", user.id).eq("status", "pending")
      .maybeSingle(),
  ])
  if (!room) notFound()

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
