import { createClient, createAdminClient } from "@/lib/supabase/server"
import { deriveX01, x01LegsConfig, type X01Visit } from "@/lib/local-game/x01"
import { isPossibleVisitScore } from "@/lib/local-game/checkouts"
import { teamSize, type RoomMode } from "@/lib/local-game/room"
import { finishOnlineRoom } from "@/lib/local-game/room-finish"
import { NextRequest, NextResponse } from "next/server"

// Нэг ээлж (visit) илгээх. Replay-ээр хэний ээлж болохыг шалгаж, зөвхөн идэвхтэй
// тоглогч өөрийнхөө ээлжийг оруулна (anti-cheat + дараалал). Дуусвал status=completed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { points, darts } = await req.json()
  const pts = Number(points)
  const drt = Math.min(3, Math.max(1, Number(darts) || 3))
  if (!Number.isInteger(pts) || pts < 0 || pts > 180 || !isPossibleVisitScore(pts)) {
    return NextResponse.json({ error: "Буруу оноо" }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("*").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "ongoing") return NextResponse.json({ error: "Тоглолт идэвхгүй" }, { status: 409 })

  const [{ data: rp }, { data: rv }] = await Promise.all([
    admin.from("room_players").select("player_id, team, slot").eq("room_id", id),
    admin.from("room_visits").select("seq, team, points, darts").eq("room_id", id).order("seq"),
  ])
  const players = rp ?? []
  // points === -1 → гараар шийдсэн (bull finish) ялагч баг
  const visits: X01Visit[] = (rv ?? []).map((v) =>
    v.points === -1 ? { points: 0, darts: 0, decide: v.team } : { points: v.points, darts: v.darts })

  const mode = room.mode as RoomMode
  const ts = teamSize(mode)
  const cfg = {
    startScore: parseInt(room.format) || 501,
    doubleOut: room.double_out,
    ...x01LegsConfig(room),
    starterTeam: room.starter_team ?? 0,
    teamSizes: [ts, ts] as [number, number],
    limitRoundsEnabled: room.limit_rounds != null,
    limitRounds: room.limit_rounds ?? undefined,
    bullFinishAtLimit: room.bull_finish,
    loserFirst: room.loser_first,
  }

  const state = deriveX01(visits, cfg)
  if (state.winner !== null) return NextResponse.json({ error: "Тоглолт аль хэдийн дууссан" }, { status: 409 })
  if (state.legAtLimit) return NextResponse.json({ error: "Хязгаарт хүрсэн — ялагчийг сонгоно уу" }, { status: 409 })

  // Идэвхтэй тоглогч = (activeTeam, currentPlayer[activeTeam])
  const activeTeam = state.activeTeam
  const activeSlot = state.currentPlayer[activeTeam]
  const activePlayer = players.find((p) => p.team === activeTeam && p.slot === activeSlot)
  if (!activePlayer) return NextResponse.json({ error: "Идэвхтэй тоглогч тодорхойгүй" }, { status: 409 })
  if (activePlayer.player_id !== user.id) {
    return NextResponse.json({ error: "Таны ээлж биш" }, { status: 403 })
  }

  const seq = visits.length
  const { error: insErr } = await admin.from("room_visits").insert({
    room_id: id, seq, team: activeTeam, slot: activeSlot, points: pts, darts: drt, created_by: user.id,
  })
  if (insErr) {
    // unique(room_id, seq) — зэрэг оролдлого; client дахин уншиж дахин оролдоно
    return NextResponse.json({ error: "Дахин оролдоно уу" }, { status: 409 })
  }

  // Шинэ visit-ийг нэмж дахин replay — winner гарвал өрөөг дуусгана
  const after = deriveX01([...visits, { points: pts, darts: drt }], cfg)
  let completed = false
  if (after.winner !== null) {
    completed = await finishOnlineRoom(admin, id, after, after.winner, players, [...visits, { points: pts, darts: drt }], room.mode)
  }

  return NextResponse.json({
    ok: true, completed,
    visit: { seq, team: activeTeam, slot: activeSlot, points: pts, darts: drt },
  })
}
