import { createClient, createAdminClient } from "@/lib/supabase/server"
import { deriveX01, x01LegsConfig, type X01Visit } from "@/lib/local-game/x01"
import { teamSize, type RoomMode } from "@/lib/local-game/room"
import { finishOnlineRoom } from "@/lib/local-game/room-finish"
import { NextRequest, NextResponse } from "next/server"

const IDLE_MS = 90_000  // эсрэг тал баталгаажуулахгүй бол саналыг илгээгч timeout-оор өөрөө баталгаажуулна

// Visit/round хязгаарт хүрсэн leg-ийн ялагчийг гараар (bull finish) сонгох.
// Зөвхөн legAtLimit үед, оролцогч тоглогч сонгоно. points=-1 sentinel visit бичнэ.
//
// Аюулгүй байдал: нэг талын тоглогч ганцаараа шууд ялагчаа зарлаж чадахгүй байх —
// эсрэг багийн (өөр team) тоглогч ижил үр дүнгээр баталгаажуулсны дараа л visit бичигдэнэ.
// Санал зөрвөл (эсвэл өөрийн багийн хүн дахин л дарвал) pending санал цуцлагдана.
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
  const me = players.find((p) => p.player_id === user.id)
  if (!me) return NextResponse.json({ error: "Та энэ өрөөнд байхгүй" }, { status: 403 })
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
    loserFirst: room.loser_first,
  }

  const state = deriveX01(visits, cfg)
  if (!state.legAtLimit) return NextResponse.json({ error: "Шийдвэр хүлээх leg алга" }, { status: 409 })

  // Хүлээгдэж буй санал байхгүй бол — миний саналыг бүртгээд эсрэг багийн
  // баталгаажуулалт хүлээнэ.
  if (room.decide_vote_team === null || room.decide_vote_by === null) {
    const { data: voted, error: voteErr } = await admin.from("online_rooms")
      .update({ decide_vote_team: winnerTeam, decide_vote_by: user.id, decide_vote_at: new Date().toISOString() })
      .eq("id", id).is("decide_vote_team", null).select("id")
    if (voteErr || !voted?.length) return NextResponse.json({ error: "Дахин оролдоно уу" }, { status: 409 })
    return NextResponse.json({ ok: true, pending: true })
  }

  // Эсрэг тал (tab хаасан гэх мэт) удаан хариу өгөхгүй бол саналаа илгээсэн тал
  // IDLE_MS хугацааны дараа өөрийн саналаараа timeout-оор үргэлжлүүлж болно.
  const votedIdleMs = room.decide_vote_at ? Date.now() - new Date(room.decide_vote_at).getTime() : 0
  const isTimeoutSelfConfirm = room.decide_vote_by === user.id && votedIdleMs >= IDLE_MS
  if (room.decide_vote_by === user.id && !isTimeoutSelfConfirm) {
    return NextResponse.json({ error: "Эсрэг талынхны баталгаажуулалтыг хүлээнэ үү" }, { status: 409 })
  }
  if (!isTimeoutSelfConfirm) {
    const voter = players.find((p) => p.player_id === room.decide_vote_by)
    if (!voter || voter.team === me.team) {
      return NextResponse.json({ error: "Эсрэг багийн тоглогч баталгаажуулах ёстой" }, { status: 403 })
    }
  }
  if (winnerTeam !== room.decide_vote_team) {
    // Санал зөрлөө — өөрийн уншсан санал хэвээр байгаа тохиолдолд л цуцална
    // (guard-гүй бол шинэ (дараагийн leg-ийн) pending саналыг стал disagreement
    // request буруу арилгах race үүсдэг байсан).
    await admin.from("online_rooms").update({ decide_vote_team: null, decide_vote_by: null, decide_vote_at: null })
      .eq("id", id).eq("decide_vote_team", room.decide_vote_team).eq("decide_vote_by", room.decide_vote_by)
    return NextResponse.json({ error: "Тал бүрийн сонголт зөрж байна — дахин оролдоно уу" }, { status: 409 })
  }

  const seq = visits.length
  const { error: insErr } = await admin.from("room_visits").insert({
    room_id: id, seq, team: winnerTeam, slot: 0, points: -1, darts: 0, created_by: user.id,
  })
  if (insErr) return NextResponse.json({ error: "Дахин оролдоно уу" }, { status: 409 })
  await admin.from("online_rooms").update({ decide_vote_team: null, decide_vote_by: null, decide_vote_at: null }).eq("id", id)

  const after = deriveX01([...visits, { points: 0, darts: 0, decide: winnerTeam }], cfg)
  let completed = false
  if (after.winner !== null) {
    completed = await finishOnlineRoom(admin, id, after, after.winner, players, [...visits, { points: 0, darts: 0, decide: winnerTeam }], room.mode)
  }

  return NextResponse.json({ ok: true, completed })
}
