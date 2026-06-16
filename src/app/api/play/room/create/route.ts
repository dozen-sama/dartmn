import { createClient, createAdminClient } from "@/lib/supabase/server"
import { generateRoomCode } from "@/lib/utils/format"
import { type RoomMode } from "@/lib/local-game/room"
import { NextRequest, NextResponse } from "next/server"

const MODES: RoomMode[] = ["1v1", "2v2", "3v3"]
const FORMATS = ["501", "301", "170"]
const BEST_OF = [1, 3, 5, 7]

// Онлайн өрөө үүсгэх — host өөрөө team0/slot0-д room_player болж орно.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { mode, format, bestOf, doubleOut, limitRounds, bullFinish, startMethod } = await req.json()
  if (!MODES.includes(mode)) return NextResponse.json({ error: "Буруу горим" }, { status: 400 })
  if (!FORMATS.includes(format)) return NextResponse.json({ error: "Буруу формат" }, { status: 400 })
  const bo = BEST_OF.includes(bestOf) ? bestOf : 3
  // Visit/round хязгаар — 5..30, null = унтраалттай
  const lr = Number.isInteger(limitRounds) && limitRounds >= 5 && limitRounds <= 30 ? limitRounds : null
  const bf = lr !== null && bullFinish === true

  const admin = await createAdminClient()

  // Давхцахгүй код (хэдэн оролдлого)
  let roomId: string | null = null
  let roomCode = ""
  for (let i = 0; i < 5 && !roomId; i++) {
    roomCode = generateRoomCode()
    const { data, error } = await admin.from("online_rooms").insert({
      room_code: roomCode,
      host_id: user.id,
      format,
      best_of: bo,
      mode,
      double_out: doubleOut !== false,
      limit_rounds: lr,
      bull_finish: bf,
      start_method: startMethod === "bulloff" ? "bulloff" : "random",
      status: "waiting",
    }).select("id").single()
    if (data && !error) roomId = data.id
  }
  if (!roomId) return NextResponse.json({ error: "Өрөө үүсгэхэд алдаа гарлаа" }, { status: 500 })

  const { error: pErr } = await admin.from("room_players").insert({
    room_id: roomId, player_id: user.id, team: 0, slot: 0, is_ready: false,
  })
  if (pErr) {
    await admin.from("online_rooms").delete().eq("id", roomId)
    return NextResponse.json({ error: "Өрөө үүсгэхэд алдаа гарлаа" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: roomId, room_code: roomCode })
}
