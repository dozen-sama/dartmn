import { createClient, createAdminClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import { NextRequest, NextResponse } from "next/server"

interface Throw { score: number; darts: number; bust?: boolean; before: number }
interface PlayerResult { profileId: string; team?: number; throws: Throw[]; isWinner: boolean }

// "Хамтдаа тоглох" (1v1 ба багийн 2v2/3v3, бүх тоглогч бүртгэлтэй) дуусахад үр
// дүнг ХҮЛЭЭГДЭЖ БУЙ болгож, ЭСРЭГ БАГИЙН гишүүдэд баталгаажуулах хүсэлт
// (notification) явуулна. Эсрэг багийн АЛЬ НЭГ гишүүн баталгаажуулсны дараа л
// ELO/статистик орно (/api/play/confirm-result).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { players, teamNames, mode } = (await req.json()) as {
    players: PlayerResult[]; teamNames?: string[]; mode?: string
  }
  if (!Array.isArray(players) || players.length < 2) {
    return NextResponse.json({ error: "Тоглогч хүрэлцэхгүй" }, { status: 400 })
  }
  const teamOf = (p: PlayerResult, i: number) => p.team ?? i
  const ids = players.map((p) => p.profileId)
  if (ids.some((x) => !x) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Тоглогч бүр өөр бүртгэлтэй байх ёстой" }, { status: 400 })
  }
  // Мэдээлэгч нь оролцогчдын нэг байх ёстой
  const reporterIdx = players.findIndex((p) => p.profileId === user.id)
  if (reporterIdx < 0) return NextResponse.json({ error: "Эрхгүй" }, { status: 403 })
  const reporterTeam = teamOf(players[reporterIdx], reporterIdx)

  const winnerIdx = players.findIndex((p) => p.isWinner)
  if (winnerIdx < 0) return NextResponse.json({ error: "Ялагч тодорхойгүй" }, { status: 400 })
  const winnerTeam = teamOf(players[winnerIdx], winnerIdx)
  const winnerId = players[winnerIdx].profileId  // schema-д төлөөлөл (ялсан багийн нэг)

  // Эсрэг баг(ууд)ын гишүүд — эдгээрийн аль нэг нь баталгаажуулна
  const confirmerIds = players.filter((p, i) => teamOf(p, i) !== reporterTeam).map((p) => p.profileId)
  if (confirmerIds.length === 0) {
    return NextResponse.json({ error: "Эсрэг баг алга" }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: pending, error } = await admin.from("pending_match_results").insert({
    reporter_id: user.id,
    opponent_id: confirmerIds[0],  // schema-д төлөөлөл; баталгаажуулалт confirmerIds-ээр шалгана
    winner_id: winnerId,
    format: mode ?? null,
    payload: { players, teamNames, mode, reporterTeam, winnerTeam, confirmerIds } as unknown as Json,
    status: "pending",
  }).select("id").single()
  if (error || !pending) return NextResponse.json({ error: "Хадгалахад алдаа гарлаа" }, { status: 500 })

  const { data: reporter } = await admin.from("profiles").select("display_name, username").eq("id", user.id).single()
  const rName = reporter?.display_name || reporter?.username || "Тоглогч"
  const isTeam = confirmerIds.length > 1 || players.length > 2
  await admin.from("notifications").insert(confirmerIds.map((uid) => ({
    user_id: uid,
    type: "match_confirm",
    title: "Тоглолтын үр дүн баталгаажуулах",
    body: isTeam
      ? `${rName} та бүхэнтэй тоглосон багийн үр дүнг бүртгэлээ. Зөв бол баталгаажуулна уу.`
      : `${rName} тантай тоглосон үр дүнг бүртгэлээ. Зөв бол баталгаажуулна уу.`,
    icon: "🎯",
    link: `/play/confirm/${pending.id}`,
    data: { pending_id: pending.id },
  })))

  return NextResponse.json({ ok: true, pending: true })
}
