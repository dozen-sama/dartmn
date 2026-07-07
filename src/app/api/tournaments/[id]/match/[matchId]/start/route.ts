import { createClient, createAdminClient } from "@/lib/supabase/server"
import { generateRoomCode } from "@/lib/utils/format"
import { NextRequest, NextResponse } from "next/server"

// Тэмцээний bracket match-г online room болгож эхлүүлнэ. Хоёр талын тоглогчдыг
// room_players-т (team 0 = side1, team 1 = side2) урьдчилан суулгаад, дараа нь
// одоо байгаа /play/[roomId] ready→play урсгал ажиллана. Idempotent: room аль
// хэдийн байвал түүнийг буцаана.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id: tournamentId, matchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id, format, first_to, rr_first_to, bracket_type, double_out, limit_rounds, bull_finish_at_limit, loser_first, type, sets_enabled, legs_per_set, rr_sets_enabled, rr_legs_per_set")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })

  const { data: m } = await admin.from("tournament_matches")
    .select("id, tournament_id, status, room_id, side1_entrant_id, side2_entrant_id, group_no, stage_id")
    .eq("id", matchId).single()
  if (!m || m.tournament_id !== tournamentId) return NextResponse.json({ error: "Match олдсонгүй" }, { status: 404 })
  if (!m.side1_entrant_id || !m.side2_entrant_id) return NextResponse.json({ error: "Хоёр тал бүрэн тодороогүй байна" }, { status: 409 })

  // Аль хэдийн room-тай бол шалгана: room байвал тоглогчийг дахин нэмж буцаана,
  // room устгагдсан бол match-г reset хийж доор шинэ room үүсгэнэ
  if (m.room_id) {
    const { data: existingRoom } = await admin.from("online_rooms")
      .select("id, status").eq("id", m.room_id).maybeSingle()
    if (existingRoom) {
      // Тоглогч room-аас гарсан тохиолдолд дахин нэмнэ
      const { data: inRoom } = await admin.from("room_players")
        .select("player_id").eq("room_id", m.room_id).eq("player_id", user.id).maybeSingle()
      if (!inRoom) {
        const { data: myEp } = await admin.from("tournament_entrant_players")
          .select("entrant_id, player_id")
          .in("entrant_id", [m.side1_entrant_id, m.side2_entrant_id])
          .eq("player_id", user.id).maybeSingle()
        if (myEp) {
          const team = myEp.entrant_id === m.side1_entrant_id ? 0 : 1
          await admin.from("room_players").upsert(
            { room_id: m.room_id, player_id: user.id, team, slot: 0, is_ready: false },
            { onConflict: "room_id,player_id" }
          )
        }
      }
      return NextResponse.json({ ok: true, roomId: m.room_id })
    }
    // Room устгагдсан — match reset хийж доор шинэ үүсгэнэ
    await admin.from("tournament_matches")
      .update({ status: "pending", room_id: null }).eq("id", matchId)
  } else if (m.status === "ongoing") {
    // room_id-гүйгээр "ongoing" болсон (өрөө хэзээ ч зөв тохируулагдаагүй) —
    // тасарсан төлөв, pending болгож доор шинэ өрөө үүсгэнэ
    await admin.from("tournament_matches")
      .update({ status: "pending" }).eq("id", matchId)
  }

  // Талуудын тоглогчид (team 0 = side1, team 1 = side2)
  const { data: eps } = await admin.from("tournament_entrant_players")
    .select("entrant_id, player_id, slot")
    .in("entrant_id", [m.side1_entrant_id, m.side2_entrant_id])
  if (!eps || eps.length < 2) return NextResponse.json({ error: "Оролцогч тодорхойгүй" }, { status: 409 })

  // Зөвхөн уг match-ийн тоглогч эсвэл зохион байгуулагч эхлүүлж болно
  const isParticipant = eps.some((e: { player_id: string }) => e.player_id === user.id)
  if (!isParticipant && t.organizer_id !== user.id) {
    return NextResponse.json({ error: "Зөвхөн оролцогч эсвэл зохион байгуулагч" }, { status: 403 })
  }

  const perSide = Math.max(
    eps.filter((e: { entrant_id: string }) => e.entrant_id === m.side1_entrant_id).length,
    eps.filter((e: { entrant_id: string }) => e.entrant_id === m.side2_entrant_id).length,
  )
  const mode = perSide >= 3 ? "3v3" : perSide === 2 ? "2v2" : "1v1"

  // Матчийн формат (first_to/sets): олон шатны тэмцээнд шатныхаа config-оос
  // (group/swiss — sets хэзээ ч байхгүй, зөвхөн legs), эс бөгөөс flat тэмцээний
  // талбараас (Round Robin ба бүлэг+шигшээний бүлгийн RR матч нь rr_* талбар,
  // шигшээ матч энгийн талбар ашиглана — өмнөх first_to/rr_first_to сонголттой ижил).
  let firstTo: number, setsEnabled: boolean, legsPerSet: number
  if (m.stage_id) {
    const { data: stage } = await admin.from("tournament_stages")
      .select("stage_type, config").eq("id", m.stage_id).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = stage?.config ?? {}
    if (stage?.stage_type === "group") {
      firstTo = c.rr_first_to ?? 2; setsEnabled = false; legsPerSet = 3
    } else if (stage?.stage_type === "swiss") {
      firstTo = c.first_to ?? 2; setsEnabled = false; legsPerSet = 3
    } else {
      firstTo = c.first_to ?? 2; setsEnabled = !!c.sets_enabled; legsPerSet = c.legs_per_set ?? 3
    }
  } else {
    // Round Robin ба бүлэг+шигшээний бүлгийн RR матч (group_no != null) нь өөрийн
    // rr_first_to тохиргоотой; шигшээ (KO) матч энгийн first_to ашиглана.
    const usesRrFirstTo = t.bracket_type === "round_robin" || (t.bracket_type === "groups_knockout" && m.group_no != null)
    firstTo = usesRrFirstTo ? (t.rr_first_to ?? t.first_to ?? 2) : (t.first_to ?? 2)
    setsEnabled = usesRrFirstTo ? !!t.rr_sets_enabled : !!t.sets_enabled
    legsPerSet = (usesRrFirstTo ? t.rr_legs_per_set : t.legs_per_set) ?? 3
  }
  const bestOf = Math.max(1, firstTo * 2 - 1)

  // Room үүсгэх (давхцахгүй код)
  let roomId: string | null = null
  let roomCode = ""
  for (let i = 0; i < 5 && !roomId; i++) {
    roomCode = generateRoomCode()
    const { data, error } = await admin.from("online_rooms").insert({
      room_code: roomCode,
      host_id: t.organizer_id,
      format: t.format,
      best_of: bestOf,
      mode,
      double_out: t.double_out !== false,
      limit_rounds: t.limit_rounds ?? null,
      bull_finish: t.limit_rounds != null && t.bull_finish_at_limit === true,
      loser_first: t.loser_first === true,
      start_method: "bulloff",
      status: "waiting",
      tournament_match_id: matchId,
      legs_per_set: setsEnabled ? legsPerSet : null,
    }).select("id").single()
    if (data && !error) roomId = data.id
  }
  if (!roomId) return NextResponse.json({ error: "Өрөө үүсгэхэд алдаа гарлаа" }, { status: 500 })

  // Match-г claim (зөвхөн pending→ongoing нэг удаа). Хоживол orphan room устгана.
  const { data: claimed } = await admin.from("tournament_matches")
    .update({ status: "ongoing", room_id: roomId })
    .eq("id", matchId).eq("status", "pending").select("id")
  if (!claimed || claimed.length === 0) {
    await admin.from("online_rooms").delete().eq("id", roomId)
    const { data: cur } = await admin.from("tournament_matches").select("room_id").eq("id", matchId).single()
    if (cur?.room_id) return NextResponse.json({ ok: true, roomId: cur.room_id })
    return NextResponse.json({ error: "Match эхлүүлэх боломжгүй" }, { status: 409 })
  }

  // room_players: side1 → team 0, side2 → team 1 (slot эрэмбээр)
  const sideSlots: Record<string, number> = {}
  const players = eps.map((e: { entrant_id: string; player_id: string }) => {
    const team = e.entrant_id === m.side1_entrant_id ? 0 : 1
    const key = `${team}`
    const slot = sideSlots[key] ?? 0
    sideSlots[key] = slot + 1
    return { room_id: roomId, player_id: e.player_id, team, slot, is_ready: false }
  })
  const { error: pErr } = await admin.from("room_players").insert(players)
  if (pErr) {
    // room_players амжилтгүй — match-г буцаан pending болгож, room устгана
    await admin.from("tournament_matches").update({ status: "pending", room_id: null }).eq("id", matchId)
    await admin.from("online_rooms").delete().eq("id", roomId)
    return NextResponse.json({ error: "Тоглогч нэмэхэд алдаа гарлаа" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, roomId })
}
