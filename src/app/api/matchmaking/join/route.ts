import { createClient, createAdminClient } from "@/lib/supabase/server"
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

  // Хэрэв аль хэдийн дараалалд байвал шинэчлэнэ (энэ upsert тусдаа commit
  // хийгддэг тул доорх атомик RPC функц дуудагдах үед өөрийн мөрний lock
  // аль хэдийн суллагдсан байна). joined_at/last_seen_at-г app-серверийн
  // цагаар биш, Postgres-ийн өөрийнх нь NOW()-оор бичихийн тулд RPC ашиглана
  // (matchmaking_claim_match-ийн ghost-cleanup/recency шалгалт мөн NOW()-оор
  // хийдэг тул clock drift-ээс сэргийлнэ).
  await admin.rpc("matchmaking_join_queue", {
    p_player_id: user.id,
    p_rating: rating,
    p_format: format,
    p_best_of: bestOf,
    p_double_out: doubleOut,
  })

  // Таарах тоглогч хайх + өрөө үүсгэх + queue шинэчлэхийг NЭГ транзакцад
  // (FOR UPDATE SKIP LOCKED) хийдэг тул хоёр тоглогч зэрэг join хийхэд
  // нэг л оппонентыг хоёул "барьж" авах (давхар өрөө үүсгэх) боломжгүй.
  const { data: result, error: rpcError } = await admin.rpc("matchmaking_claim_match", {
    p_player_id: user.id,
    p_rating: rating,
    p_format: format,
    p_best_of: bestOf,
    p_double_out: doubleOut,
    p_elo_window: ELO_WINDOW,
  }).single()

  if (rpcError) {
    return NextResponse.json({ error: "Тоглогч хайхад алдаа гарлаа" }, { status: 500 })
  }

  const { room_id: roomId, matched } = result as { room_id: string | null; matched: boolean }

  if (!matched || !roomId) {
    return NextResponse.json({ matched: false })
  }

  return NextResponse.json({ matched: true, roomId })
}
