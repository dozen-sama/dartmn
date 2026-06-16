import { createClient, createAdminClient } from "@/lib/supabase/server"
import { totalPlayers, type RoomMode } from "@/lib/local-game/room"
import { NextRequest, NextResponse } from "next/server"

// Тоглогч "Бэлэн" төлвөө солих. Бүх slot дүүрсэн БА бүгд бэлэн бол өрөө эхэлнэ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { ready } = await req.json()

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("id, mode, status, start_method").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "waiting") return NextResponse.json({ error: "Тоглолт эхэлсэн" }, { status: 409 })

  const { data: mine } = await admin.from("room_players")
    .update({ is_ready: ready !== false }).eq("room_id", id).eq("player_id", user.id).select("id")
  if (!mine || mine.length === 0) return NextResponse.json({ error: "Та энэ өрөөнд байхгүй" }, { status: 403 })

  // Бүгд орсон + бэлэн болсон эсэх
  const { data: players } = await admin.from("room_players").select("is_ready").eq("room_id", id)
  const need = totalPlayers(room.mode as RoomMode)
  const allIn = (players?.length ?? 0) === need
  const allReady = allIn && players!.every((p) => p.is_ready)

  if (allReady) {
    // Claim — зөвхөн status='waiting' үед нэг л шилжүүлэг амжина
    if (room.start_method === "bulloff") {
      await admin.from("online_rooms").update({ status: "bulloff" }).eq("id", id).eq("status", "waiting")
    } else {
      const starter = Math.random() < 0.5 ? 0 : 1
      await admin.from("online_rooms")
        .update({ status: "ongoing", starter_team: starter })
        .eq("id", id).eq("status", "waiting")
    }
  }

  return NextResponse.json({ ok: true })
}
