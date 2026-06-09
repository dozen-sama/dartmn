import { calculateEloChange } from "@/lib/rating"

export interface MatchThrow { score: number; darts: number; bust?: boolean; before: number }
export interface MatchPlayer { profileId: string; throws: MatchThrow[]; isWinner: boolean }

// Шидэлтээс дартсны статистик. checkout % нь нийт-оноо оруулгаас найдвартай
// тооцоологдохгүй (аль дарт double руу шидсэнийг мэдэхгүй) тул бодохгүй —
// зөвхөн 180, дээд checkout, оноо/дарт (дундаж бодоход).
export function dartStats(throws: MatchThrow[]) {
  let count180 = 0, highestCheckout = 0, points = 0, darts = 0
  for (const t of throws) {
    darts += t.darts || 3
    if (!t.bust) points += t.score
    if (t.score === 180) count180++
    if (!t.bust && t.before - t.score === 0 && t.score > highestCheckout) highestCheckout = t.score
  }
  return { count180, highestCheckout, points, darts }
}

// 1v1 тоглолтын үр дүнг хоёр тоглогчид хэрэглэнэ: харилцан ELO + статистик +
// rating history. admin = service-role client. Idempotency-г дуудагч хариуцна
// (зөвхөн status='pending' үед нэг удаа дуудна).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyMatchResult(admin: any, players: MatchPlayer[], reason = "1v1 тоглолт"): Promise<boolean> {
  if (players.length !== 2) return false
  const [a, b] = players
  const { data: profs } = await admin.from("profiles")
    .select("id, rating_points, matches_played, matches_won, count_180, highest_checkout, career_points, career_darts, average_score")
    .in("id", [a.profileId, b.profileId])
  if (!profs || profs.length !== 2) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = Object.fromEntries(profs.map((p: any) => [p.id, p]))
  const ratingA = byId[a.profileId].rating_points
  const ratingB = byId[b.profileId].rating_points
  const history: { player_id: string; rating_before: number; rating_after: number; change: number; reason: string }[] = []

  await Promise.all(players.map(async (pl) => {
    const cur = byId[pl.profileId]
    const opp = pl.profileId === a.profileId ? ratingB : ratingA
    const change = calculateEloChange(cur.rating_points, opp, pl.isWinner)
    const newRating = Math.max(0, cur.rating_points + change)
    const ds = dartStats(pl.throws)
    const newCareerPoints = cur.career_points + ds.points
    const newCareerDarts = cur.career_darts + ds.darts
    await admin.from("profiles").update({
      rating_points: newRating,
      matches_played: cur.matches_played + 1,
      matches_won: cur.matches_won + (pl.isWinner ? 1 : 0),
      count_180: cur.count_180 + ds.count180,
      highest_checkout: Math.max(cur.highest_checkout, ds.highestCheckout),
      average_score: newCareerDarts > 0 ? (newCareerPoints / newCareerDarts) * 3 : cur.average_score,
      career_points: newCareerPoints,
      career_darts: newCareerDarts,
    }).eq("id", pl.profileId)
    history.push({ player_id: pl.profileId, rating_before: cur.rating_points, rating_after: newRating, change, reason })
    await admin.rpc("check_achievements", { p_player_id: pl.profileId })
  }))

  if (history.length) await admin.from("rating_history").insert(history)
  return true
}
