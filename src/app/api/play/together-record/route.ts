import { createClient, createAdminClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import { NextRequest, NextResponse } from "next/server"

interface Throw { score: number; darts: number; bust?: boolean; before: number }
interface PlayerResult { profileId: string; throws: Throw[]; isWinner: boolean }

// "Хамтдаа тоглох" 1v1 (хоёулаа бүртгэлтэй) дуусахад үр дүнг ХҮЛЭЭГДЭЖ БУЙ болгож,
// өрсөлдөгчид баталгаажуулах хүсэлт (notification) явуулна. Зөвхөн өрсөлдөгч
// баталгаажуулсны дараа ELO/статистик орно (/api/play/confirm-result).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { players } = (await req.json()) as { players: PlayerResult[] }
  if (!Array.isArray(players) || players.length !== 2) {
    return NextResponse.json({ error: "1v1 биш" }, { status: 400 })
  }
  const [a, b] = players
  if (!a.profileId || !b.profileId || a.profileId === b.profileId) {
    return NextResponse.json({ error: "Хоёр өөр бүртгэл хэрэгтэй" }, { status: 400 })
  }
  // Мэдээлэгч нь оролцогчдын нэг байх ёстой
  if (user.id !== a.profileId && user.id !== b.profileId) {
    return NextResponse.json({ error: "Эрхгүй" }, { status: 403 })
  }

  const reporterId = user.id
  const opponentId = reporterId === a.profileId ? b.profileId : a.profileId
  const winnerId = players.find((p) => p.isWinner)?.profileId
  if (!winnerId) return NextResponse.json({ error: "Ялагч тодорхойгүй" }, { status: 400 })

  const admin = await createAdminClient()

  const { data: pending, error } = await admin.from("pending_match_results").insert({
    reporter_id: reporterId,
    opponent_id: opponentId,
    winner_id: winnerId,
    payload: { players } as unknown as Json,
    status: "pending",
  }).select("id").single()
  if (error || !pending) return NextResponse.json({ error: "Хадгалахад алдаа гарлаа" }, { status: 500 })

  const { data: reporter } = await admin.from("profiles").select("display_name, username").eq("id", reporterId).single()
  const rName = reporter?.display_name || reporter?.username || "Тоглогч"
  await admin.from("notifications").insert({
    user_id: opponentId,
    type: "match_confirm",
    title: "Тоглолтын үр дүн баталгаажуулах",
    body: `${rName} тантай тоглосон үр дүнг бүртгэлээ. Зөв бол баталгаажуулна уу.`,
    icon: "🎯",
    link: `/play/confirm/${pending.id}`,
    data: { pending_id: pending.id },
  })

  return NextResponse.json({ ok: true, pending: true })
}
