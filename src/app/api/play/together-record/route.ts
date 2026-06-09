import { createClient, createAdminClient } from "@/lib/supabase/server"
import { canDoubleOut } from "@/lib/local-game/checkouts"
import { calculateEloChange } from "@/lib/rating"
import { NextRequest, NextResponse } from "next/server"

interface Throw { score: number; darts: number; bust?: boolean; before: number }
interface PlayerResult { profileId: string; throws: Throw[]; isWinner: boolean }

function dartStats(throws: Throw[]) {
  let count180 = 0, highestCheckout = 0, points = 0, darts = 0, hits = 0, attempts = 0
  for (const t of throws) {
    darts += t.darts || 3
    if (!t.bust) points += t.score
    if (t.score === 180) count180++
    if (t.before <= 170 && canDoubleOut(t.before)) attempts++
    if (!t.bust && t.before - t.score === 0) {
      hits++
      if (t.score > highestCheckout) highestCheckout = t.score
    }
  }
  return { count180, highestCheckout, points, darts, hits, attempts }
}

// "Хамтдаа тоглох" 1v1 (хоёулаа DartMN бүртгэлтэй) дуусахад ELO + статистик бүртгэнэ.
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
  // Зөвхөн тухайн тоглолтод оролцсон хүн л бүртгэнэ
  if (user.id !== a.profileId && user.id !== b.profileId) {
    return NextResponse.json({ error: "Эрхгүй" }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { data: profs } = await admin.from("profiles")
    .select("id, rating_points, matches_played, matches_won, count_180, highest_checkout, career_points, career_darts, checkout_hits, checkout_attempts, average_score, checkout_percentage")
    .in("id", [a.profileId, b.profileId])
  if (!profs || profs.length !== 2) return NextResponse.json({ error: "Профайл олдсонгүй" }, { status: 404 })

  const byId = Object.fromEntries(profs.map((p) => [p.id, p]))
  const ratingA = byId[a.profileId].rating_points
  const ratingB = byId[b.profileId].rating_points
  const history: { player_id: string; rating_before: number; rating_after: number; change: number; reason: string }[] = []

  for (const pl of players) {
    const cur = byId[pl.profileId]
    const opp = pl.profileId === a.profileId ? ratingB : ratingA
    const change = calculateEloChange(cur.rating_points, opp, pl.isWinner)
    const newRating = Math.max(0, cur.rating_points + change)
    const ds = dartStats(pl.throws)
    const newCareerPoints = cur.career_points + ds.points
    const newCareerDarts = cur.career_darts + ds.darts
    const newHits = cur.checkout_hits + ds.hits
    const newAttempts = cur.checkout_attempts + ds.attempts

    await admin.from("profiles").update({
      rating_points: newRating,
      matches_played: cur.matches_played + 1,
      matches_won: cur.matches_won + (pl.isWinner ? 1 : 0),
      count_180: cur.count_180 + ds.count180,
      highest_checkout: Math.max(cur.highest_checkout, ds.highestCheckout),
      average_score: newCareerDarts > 0 ? (newCareerPoints / newCareerDarts) * 3 : cur.average_score,
      checkout_percentage: newAttempts > 0 ? newHits / newAttempts : cur.checkout_percentage,
      career_points: newCareerPoints,
      career_darts: newCareerDarts,
      checkout_hits: newHits,
      checkout_attempts: newAttempts,
    }).eq("id", pl.profileId)

    history.push({ player_id: pl.profileId, rating_before: cur.rating_points, rating_after: newRating, change, reason: "Хамтдаа тоглох (1v1)" })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).rpc("check_achievements", { p_player_id: pl.profileId })
  }

  if (history.length) await admin.from("rating_history").insert(history)
  return NextResponse.json({ ok: true })
}
