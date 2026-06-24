import { createClient, createAdminClient } from "@/lib/supabase/server"
import { generateRoomCode } from "@/lib/utils/format"
import { NextRequest, NextResponse } from "next/server"

const ELO_WINDOW = 300  // ±300 ELO-тай тоглогчтой таарна

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const format: "501" | "301" | "170" = ["501", "301", "170"].includes(body.format) ? (body.format as "501" | "301" | "170") : "501"
  const bestOf: number = [1, 3, 5, 7].includes(body.bestOf) ? body.bestOf : 3
  const doubleOut: boolean = body.doubleOut !== false

  const admin = await createAdminClient()

  // Тоглогчийн одоогийн рейтинг татна
  const { data: profile } = await admin
    .from("profiles")
    .select("rating_points")
    .eq("id", user.id)
    .single()

  const rating = profile?.rating_points ?? 1000

  // Хэрэв аль хэдийн дараалалд байвал шинэчлэнэ
  await admin.from("matchmaking_queue").upsert({
    player_id: user.id,
    rating_points: rating,
    format,
    best_of: bestOf,
    double_out: doubleOut,
    status: "searching",
    room_id: null,
    joined_at: new Date().toISOString(),
  }, { onConflict: "player_id" })

  // Таарах тоглогч хайна (өмнө орсон, ойролцоо ELO)
  const { data: opponent } = await admin
    .from("matchmaking_queue")
    .select("id, player_id, rating_points")
    .eq("status", "searching")
    .neq("player_id", user.id)
    .gte("rating_points", rating - ELO_WINDOW)
    .lte("rating_points", rating + ELO_WINDOW)
    .order("joined_at")
    .limit(1)
    .maybeSingle()

  if (!opponent) {
    return NextResponse.json({ matched: false })
  }

  // Таарсан — өрөө үүсгэнэ (өмнө орсон тоглогч host)
  let roomId: string | null = null
  for (let i = 0; i < 5 && !roomId; i++) {
    const code = generateRoomCode()
    const { data: room } = await admin.from("online_rooms").insert({
      room_code: code,
      host_id: opponent.player_id,
      format,
      best_of: bestOf,
      mode: "1v1",
      double_out: doubleOut,
      limit_rounds: null,
      bull_finish: false,
      start_method: "random",
      status: "waiting",
    }).select("id").single()
    if (room) roomId = room.id
  }

  if (!roomId) {
    return NextResponse.json({ error: "Өрөө үүсгэхэд алдаа гарлаа" }, { status: 500 })
  }

  // Хоёр тоглогчийг өрөөнд нэмнэ
  await admin.from("room_players").insert([
    { room_id: roomId, player_id: opponent.player_id, team: 0, slot: 0, is_ready: false },
    { room_id: roomId, player_id: user.id, team: 1, slot: 0, is_ready: false },
  ])

  // Дараалал дахь хоёр entry-ийг matched болгоно
  await admin.from("matchmaking_queue")
    .update({ status: "matched", room_id: roomId })
    .in("player_id", [user.id, opponent.player_id])

  return NextResponse.json({ matched: true, roomId })
}
