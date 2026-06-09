import { createClient } from "@/lib/supabase/server"
import { canDoubleOut } from "@/lib/local-game/checkouts"
import { NextRequest, NextResponse } from "next/server"

interface Visit { score: number; darts: number; bust?: boolean; before: number }

// Дасгалын (501 Solo) онооноос нэвтэрсэн тоглогчийн ХУВИЙН дартсны статистикийг
// бүртгэнэ. Өрсөлдөгчгүй тул matches/ELO-д НӨЛӨӨЛӨХГҮЙ — зөвхөн шидэлтийн статистик.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { visits, finished } = (await req.json()) as { visits: Visit[]; finished: boolean }
  if (!Array.isArray(visits) || visits.length === 0) {
    return NextResponse.json({ error: "Өгөгдөл байхгүй" }, { status: 400 })
  }

  let count180 = 0, highestCheckout = 0, points = 0, darts = 0, checkoutHits = 0, checkoutAttempts = 0
  for (const v of visits) {
    const d = v.darts || 3
    darts += d
    if (!v.bust) points += v.score
    if (v.score === 180) count180++
    if (v.before <= 170 && canDoubleOut(v.before)) checkoutAttempts++
    if (!v.bust && v.before - v.score === 0) {
      checkoutHits++
      if (v.score > highestCheckout) highestCheckout = v.score
    }
  }
  const bestLeg = finished && darts > 0 ? darts : 0

  const { data: p } = await supabase
    .from("profiles")
    .select("highest_checkout, best_leg, count_180, career_points, career_darts, checkout_hits, checkout_attempts")
    .eq("id", user.id).single()
  if (!p) return NextResponse.json({ error: "Профайл олдсонгүй" }, { status: 404 })

  const newCareerPoints = p.career_points + points
  const newCareerDarts = p.career_darts + darts
  const newHits = p.checkout_hits + checkoutHits
  const newAttempts = p.checkout_attempts + checkoutAttempts
  const newAvg = newCareerDarts > 0 ? (newCareerPoints / newCareerDarts) * 3 : 0
  const newPct = newAttempts > 0 ? newHits / newAttempts : 0
  const newHighest = Math.max(p.highest_checkout, highestCheckout)
  const newBest = bestLeg > 0 ? (p.best_leg > 0 ? Math.min(p.best_leg, bestLeg) : bestLeg) : p.best_leg

  const { error } = await supabase.from("profiles").update({
    count_180: p.count_180 + count180,
    highest_checkout: newHighest,
    best_leg: newBest,
    average_score: newAvg,
    checkout_percentage: newPct,
    career_points: newCareerPoints,
    career_darts: newCareerDarts,
    checkout_hits: newHits,
    checkout_attempts: newAttempts,
  }).eq("id", user.id)
  if (error) return NextResponse.json({ error: "Хадгалахад алдаа" }, { status: 500 })

  return NextResponse.json({ ok: true, count180, highestCheckout })
}
