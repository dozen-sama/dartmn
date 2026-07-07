import { createClient, createAdminClient } from "@/lib/supabase/server"
import { deriveX01, x01LegsConfig, type X01Visit } from "@/lib/local-game/x01"
import { teamSize, type RoomMode } from "@/lib/local-game/room"
import { finishOnlineRoom } from "@/lib/local-game/room-finish"
import { NextRequest, NextResponse } from "next/server"

const IDLE_MS = 90_000  // өрсөлдөгч идэвхгүй гэж үзэх босго (1.5 мин)

// Идэвхгүйн ялалт — өрсөлдөгч өөрийн ээлжийг удаан (≥90с) шидэхгүй бол хүлээж буй
// тоглогч ялалт нэхнэ. Зөвхөн дуудагч хүлээж байгаа (өрсөлдөгчийн ээлж) үед.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("*").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "ongoing") return NextResponse.json({ error: "Тоглолт идэвхгүй" }, { status: 409 })

  const [{ data: rp }, { data: rv }] = await Promise.all([
    admin.from("room_players").select("player_id, team, slot").eq("room_id", id),
    admin.from("room_visits").select("seq, team, points, darts, created_at").eq("room_id", id).order("seq"),
  ])
  const players = rp ?? []
  const me = players.find((p) => p.player_id === user.id)
  if (!me) return NextResponse.json({ error: "Та энэ өрөөнд байхгүй" }, { status: 403 })

  const ts = teamSize(room.mode as RoomMode)
  const visits: X01Visit[] = (rv ?? []).map((v) =>
    v.points === -1 ? { points: 0, darts: 0, decide: v.team } : { points: v.points, darts: v.darts })
  const { legsToWin, setsToWin } = x01LegsConfig(room)
  const state = deriveX01(visits, {
    startScore: parseInt(room.format) || 501, doubleOut: room.double_out,
    legsToWin, setsToWin, starterTeam: room.starter_team ?? 0,
    teamSizes: [ts, ts], limitRoundsEnabled: room.limit_rounds != null,
    limitRounds: room.limit_rounds ?? undefined, bullFinishAtLimit: room.bull_finish,
    loserFirst: room.loser_first,
  })

  // Дуудагч хүлээж байгаа (идэвхтэй нь өрсөлдөгч) байх ёстой
  if (state.activeTeam === me.team) {
    return NextResponse.json({ error: "Таны ээлж — хүлээх шаардлагагүй" }, { status: 409 })
  }
  // Сүүлийн идэвхээс хойш хугацаа
  const lastAt = (rv ?? []).length ? new Date((rv ?? [])[(rv ?? []).length - 1].created_at).getTime() : null
  if (lastAt === null) {
    return NextResponse.json({ error: "Тоглолт сая эхэлсэн — түр хүлээнэ үү" }, { status: 409 })
  }
  if (Date.now() - lastAt < IDLE_MS) {
    return NextResponse.json({ error: "Өрсөлдөгч идэвхгүй болоогүй байна" }, { status: 409 })
  }

  // Идэвхгүйн ялалтыг walkover-оор тооцно: sets горимд ялагчийг setsToWin,
  // эс бөгөөс legsToWin хүртэл хожсон гэж bracket-д бичнэ (standings-ийн
  // leg/set diff тэнцвэргүй болохоос сэргийлнэ — forfeit-тэй ижил логик)
  if (setsToWin) {
    if (state.sets[me.team] < setsToWin) state.sets[me.team] = setsToWin
  } else {
    if (state.legs[me.team] < legsToWin) state.legs[me.team] = legsToWin
  }
  await finishOnlineRoom(admin, id, state, me.team, players, visits, room.mode)
  return NextResponse.json({ ok: true })
}
