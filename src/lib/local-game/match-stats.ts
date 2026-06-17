import { calculateEloChange } from "@/lib/rating"

export interface MatchThrow { score: number; darts: number; bust?: boolean; before: number }
// team — багийн индекс (0/1). Байхгүй бол массив дахь индексээ баг гэж үзнэ
// (1v1 → баг тус бүр нэг хүн, хуучин үр дүнтэй нийцнэ).
export interface MatchPlayer { profileId: string; team?: number; throws: MatchThrow[]; isWinner: boolean }

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

// Тоглолтын үр дүнг бүх тоглогчид хэрэглэнэ: ELO + статистик + rating history.
// 1v1 ба багийн (2v2/3v3) тоглолтыг хоёуланг нь зохицуулна — тоглогч бүр
// ӨРСӨЛДӨГЧ БАГИЙН ДУНДАЖ rating-тай харьцаж ELO авна (1v1 → өрсөлдөгчийнхөө
// rating, өөрчлөлтгүй). admin = service-role client. Idempotency-г дуудагч
// хариуцна (зөвхөн status='pending' үед нэг удаа дуудна).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyMatchResult(admin: any, players: MatchPlayer[], reason = "Тоглолт"): Promise<boolean> {
  if (players.length < 2) return false
  const ids = players.map((p) => p.profileId)
  if (new Set(ids).size !== ids.length) return false  // давхар тоглогч
  const { data: profs } = await admin.from("profiles")
    .select("id, rating_points, matches_played, matches_won, count_180, highest_checkout, career_points, career_darts, average_score")
    .in("id", ids)
  if (!profs || profs.length !== ids.length) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = Object.fromEntries(profs.map((p: any) => [p.id, p]))
  const teamOf = (pl: MatchPlayer, i: number) => pl.team ?? i
  // Баг тус бүрийн rating-ийн жагсаалт (дундажийг өрсөлдөгчид нь тооцоход)
  const ratingsByTeam = new Map<number, number[]>()
  players.forEach((pl, i) => {
    const t = teamOf(pl, i)
    const arr = ratingsByTeam.get(t) ?? []
    arr.push(byId[pl.profileId].rating_points)
    ratingsByTeam.set(t, arr)
  })
  const avg = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length
  // 1v1 үед өрсөлдөгчийг түүхэнд тэмдэглэнэ (багийн үед нэг өрсөлдөгч утгагүй)
  const soloOpponentId = players.length === 2
    ? (id: string) => players.find((q) => q.profileId !== id)!.profileId : null
  const history: { player_id: string; rating_before: number; rating_after: number; change: number; reason: string; opponent_id: string | null; won: boolean }[] = []

  await Promise.all(players.map(async (pl, i) => {
    const cur = byId[pl.profileId]
    const myTeam = teamOf(pl, i)
    // Өрсөлдөгч багуудын бүх тоглогчийн rating-ийн дундаж
    const oppRatings: number[] = []
    ratingsByTeam.forEach((arr, t) => { if (t !== myTeam) oppRatings.push(...arr) })
    const change = calculateEloChange(cur.rating_points, avg(oppRatings), pl.isWinner)
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
    history.push({
      player_id: pl.profileId, rating_before: cur.rating_points, rating_after: newRating, change, reason,
      opponent_id: soloOpponentId ? soloOpponentId(pl.profileId) : null, won: pl.isWinner,
    })
    await admin.rpc("check_achievements", { p_player_id: pl.profileId })
  }))

  if (history.length) await admin.from("rating_history").insert(history)
  return true
}
