import { createClient, createAdminClient } from "@/lib/supabase/server"
import { nextOpenSlot, type RoomMode } from "@/lib/local-game/room"
import { NextRequest, NextResponse } from "next/server"

// Кодоор/жагсаалтаас орсон тоглогчийг дараагийн нээлттэй slot-д оруулна.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("id, mode, status").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "waiting") return NextResponse.json({ error: "Тоглолт эхэлсэн" }, { status: 409 })

  const { data: players } = await admin.from("room_players").select("player_id, team, slot").eq("room_id", id)
  // Аль хэдийн орсон бол ok (idempotent)
  if ((players ?? []).some((p) => p.player_id === user.id)) return NextResponse.json({ ok: true })

  const open = nextOpenSlot(room.mode as RoomMode, players ?? [])
  if (!open) return NextResponse.json({ error: "Өрөө дүүрсэн байна" }, { status: 409 })

  const { error } = await admin.from("room_players").insert({
    room_id: id, player_id: user.id, team: open.team, slot: open.slot, is_ready: false,
  })
  if (error) return NextResponse.json({ error: "Орох боломжгүй — дахин оролдоно уу" }, { status: 409 })

  return NextResponse.json({ ok: true })
}
