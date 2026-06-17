import { createClient, createAdminClient } from "@/lib/supabase/server"
import { deriveX01, type X01Visit } from "@/lib/local-game/x01"
import { teamSize, type RoomMode } from "@/lib/local-game/room"
import { finishOnlineRoom } from "@/lib/local-game/room-finish"
import { NextRequest, NextResponse } from "next/server"

// Бууж өгөх — дуудагч бууж өгч, ӨРСӨЛДӨГЧ баг ялна (ELO хэвийн орно).
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
    admin.from("room_visits").select("seq, team, points, darts").eq("room_id", id).order("seq"),
  ])
  const players = rp ?? []
  const me = players.find((p) => p.player_id === user.id)
  if (!me) return NextResponse.json({ error: "Та энэ өрөөнд байхгүй" }, { status: 403 })

  const winnerTeam = me.team === 0 ? 1 : 0  // өрсөлдөгч баг ялна
  const ts = teamSize(room.mode as RoomMode)
  const visits: X01Visit[] = (rv ?? []).map((v) =>
    v.points === -1 ? { points: 0, darts: 0, decide: v.team } : { points: v.points, darts: v.darts })
  const state = deriveX01(visits, {
    startScore: parseInt(room.format) || 501, doubleOut: room.double_out,
    legsToWin: Math.ceil(room.best_of / 2), starterTeam: room.starter_team ?? 0,
    teamSizes: [ts, ts], limitRoundsEnabled: room.limit_rounds != null,
    limitRounds: room.limit_rounds ?? undefined, bullFinishAtLimit: room.bull_finish,
  })
  await finishOnlineRoom(admin, id, state, winnerTeam, players, visits, room.mode)
  return NextResponse.json({ ok: true })
}
