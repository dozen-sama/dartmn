import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Өрөөнөөс гарах. Host гарвал өрөө цуцлагдана (cascade).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("id, host_id, status").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ ok: true })  // аль хэдийн алга
  if (room.status === "ongoing") return NextResponse.json({ error: "Тоглолт явагдаж байна" }, { status: 409 })

  if (room.host_id === user.id) {
    await admin.from("online_rooms").delete().eq("id", id)  // room_players/invites cascade
  } else {
    await admin.from("room_players").delete().eq("room_id", id).eq("player_id", user.id)
  }
  return NextResponse.json({ ok: true })
}
