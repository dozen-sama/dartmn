import { createClient, createAdminClient } from "@/lib/supabase/server"
import { deriveX01, x01LegsConfig, type X01Visit } from "@/lib/local-game/x01"
import { teamSize, type RoomMode } from "@/lib/local-game/room"
import { finishOnlineRoom } from "@/lib/local-game/room-finish"
import { NextRequest, NextResponse } from "next/server"

// Visit/round хязгаарт хүрсэн leg-ийн ялагчийг гараар (bull finish) сонгох.
// Зөвхөн legAtLimit үед, оролцогч тоглогч сонгоно. points=-1 sentinel visit бичнэ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const winnerTeam = Number((await req.json()).winnerTeam)
  if (winnerTeam !== 0 && winnerTeam !== 1) return NextResponse.json({ error: "Буруу баг" }, { status: 400 })

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("*").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "ongoing") return NextResponse.json({ error: "Тоглолт идэвхгүй" }, { status: 409 })

  const [{ data: rp }, { data: rv }] = await Promise.all([
    admin.from("room_players").select("player_id, team, slot").eq("room_id", id),
    admin.from("room_visits").select("seq, team, points, darts").eq("room_id", id).order("seq"),
  ])
  const players = rp ?? []
  if (!players.some((p) => p.player_id === user.id)) {
    return NextResponse.json({ error: "Та энэ өрөөнд байхгүй" }, { status: 403 })
  }
  const visits: X01Visit[] = (rv ?? []).map((v) =>
    v.points === -1 ? { points: 0, darts: 0, decide: v.team } : { points: v.points, darts: v.darts })

  const ts = teamSize(room.mode as RoomMode)
  const cfg = {
    startScore: parseInt(room.format) || 501,
    doubleOut: room.double_out,
    ...x01LegsConfig(room),
    starterTeam: room.starter_team ?? 0,
    teamSizes: [ts, ts] as [number, number],
    limitRoundsEnabled: room.limit_rounds != null,
    limitRounds: room.limit_rounds ?? undefined,
    bullFinishAtLimit: room.bull_finish,
  }

  const state = deriveX01(visits, cfg)
  if (!state.legAtLimit) return NextResponse.json({ error: "Шийдвэр хүлээх leg алга" }, { status: 409 })

  const seq = visits.length
  const { error: insErr } = await admin.from("room_visits").insert({
    room_id: id, seq, team: winnerTeam, slot: 0, points: -1, darts: 0, created_by: user.id,
  })
  if (insErr) return NextResponse.json({ error: "Дахин оролдоно уу" }, { status: 409 })

  const after = deriveX01([...visits, { points: 0, darts: 0, decide: winnerTeam }], cfg)
  let completed = false
  if (after.winner !== null) {
    completed = await finishOnlineRoom(admin, id, after, after.winner, players, [...visits, { points: 0, darts: 0, decide: winnerTeam }], room.mode)
  }

  return NextResponse.json({ ok: true, completed })
}
