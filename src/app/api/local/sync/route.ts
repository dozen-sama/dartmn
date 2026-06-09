import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { LocalSession, LocalMatch, LocalPlayer } from "@/lib/local-game/types"
import { canDoubleOut } from "@/lib/local-game/checkouts"
import { calculateEloChange } from "@/lib/rating"

interface SyncPayload {
  session: LocalSession
}

// Count stats for a player from completed matches
function calcPlayerStats(playerId: string, matches: LocalMatch[], players: LocalPlayer[]) {
  const completed = matches.filter(
    (m) => m.status === "completed" &&
    (m.player1Id === playerId || m.player2Id === playerId) &&
    m.player1Id !== "bye" && m.player2Id !== "bye"
  )

  let matchesPlayed = 0
  let matchesWon = 0
  let legsWon = 0
  let legsLost = 0

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  // [opponentProfileId, won, opponentRatingEstimate]
  const matchResults: { oppProfileId: string | null; won: boolean; isP1: boolean }[] = []

  for (const m of completed) {
    const isP1 = m.player1Id === playerId
    const won = m.winnerId === playerId
    const oppId = isP1 ? m.player2Id : m.player1Id
    const opp = oppId ? playerMap[oppId] : null

    matchesPlayed++
    if (won) matchesWon++
    legsWon += isP1 ? m.player1Legs : m.player2Legs
    legsLost += isP1 ? m.player2Legs : m.player1Legs

    matchResults.push({
      oppProfileId: opp?.profileId ?? null,
      won,
      isP1,
    })
  }

  return { matchesPlayed, matchesWon, legsWon, legsLost, matchResults }
}

// Шидэлт бүрээс дартсны статистик (180, дундаж, checkout, сайн лег)
function calcDartStats(playerId: string, matches: LocalMatch[], startScore: number) {
  let count180 = 0, highestCheckout = 0, totalPoints = 0, totalDarts = 0
  let bestLeg = Infinity, checkoutHits = 0, checkoutAttempts = 0

  for (const m of matches) {
    if (m.status !== "completed") continue
    if (m.player1Id !== playerId && m.player2Id !== playerId) continue
    for (const leg of m.legs) {
      const throws = (leg.throws?.[playerId] ?? []) as { score: number; remaining: number; darts?: number; bust?: boolean }[]
      if (throws.length === 0) continue
      let before = startScore
      let legDarts = 0
      for (const t of throws) {
        const darts = t.darts ?? 3
        legDarts += darts
        totalDarts += darts
        if (!t.bust) totalPoints += t.score
        if (t.score === 180) count180++
        // Checkout оролдлого: ээлжийн өмнө finishable байсан эсэх
        if (before <= 170 && canDoubleOut(before)) checkoutAttempts++
        if (!t.bust && t.remaining === 0) {
          checkoutHits++
          if (t.score > highestCheckout) highestCheckout = t.score
        }
        before = t.bust ? before : t.remaining
      }
      if (leg.winnerId === playerId && legDarts > 0) bestLeg = Math.min(bestLeg, legDarts)
    }
  }
  return {
    count180, highestCheckout, totalPoints, totalDarts,
    bestLeg: bestLeg === Infinity ? 0 : bestLeg,
    checkoutHits, checkoutAttempts,
  }
}

export async function POST(req: NextRequest) {
  const { session } = (await req.json()) as SyncPayload

  if (!session || session.status !== "completed") {
    return NextResponse.json({ error: "Session not completed" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Get linked players (those with profileId)
  const linkedPlayers = session.players.filter((p) => p.profileId)
  if (linkedPlayers.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  // Fetch current ratings for all linked players
  const profileIds = linkedPlayers.map((p) => p.profileId!)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, rating_points, matches_played, matches_won, count_180, highest_checkout, tournament_wins, best_leg, career_points, career_darts, checkout_hits, checkout_attempts")
    .in("id", profileIds)

  if (!profiles) return NextResponse.json({ error: "Profiles not found" }, { status: 404 })

  const ratingMap = Object.fromEntries(profiles.map((p) => [p.id, p.rating_points]))
  const profileMap = Object.fromEntries(session.players.filter((p) => p.profileId).map((p) => [p.profileId!, p]))

  let synced = 0
  const historyEntries: any[] = []

  for (const player of linkedPlayers) {
    const profileId = player.profileId!
    const currentProfile = profiles.find((p) => p.id === profileId)
    if (!currentProfile) continue

    const stats = calcPlayerStats(player.id, session.matches, session.players)
    if (stats.matchesPlayed === 0) continue

    // Дартсны статистик (career-cumulative)
    const dart = calcDartStats(player.id, session.matches, session.startScore)
    const newCareerPoints = currentProfile.career_points + dart.totalPoints
    const newCareerDarts = currentProfile.career_darts + dart.totalDarts
    const newCheckoutHits = currentProfile.checkout_hits + dart.checkoutHits
    const newCheckoutAttempts = currentProfile.checkout_attempts + dart.checkoutAttempts
    const newAvg = newCareerDarts > 0 ? (newCareerPoints / newCareerDarts) * 3 : 0
    const newCheckoutPct = newCheckoutAttempts > 0 ? newCheckoutHits / newCheckoutAttempts : 0
    const newHighest = Math.max(currentProfile.highest_checkout, dart.highestCheckout)
    const prevBest = currentProfile.best_leg
    const newBest = dart.bestLeg > 0 ? (prevBest > 0 ? Math.min(prevBest, dart.bestLeg) : dart.bestLeg) : prevBest

    let newRating = currentProfile.rating_points
    let totalEloChange = 0

    // Calculate ELO change for each match
    for (const result of stats.matchResults) {
      const oppRating = result.oppProfileId
        ? (ratingMap[result.oppProfileId] ?? 1000)
        : 1000 // Guest default rating

      const change = calculateEloChange(newRating, oppRating, result.won)
      totalEloChange += change
      newRating += change

      // Record ELO history entry
      historyEntries.push({
        player_id: profileId,
        rating_before: newRating - change,
        rating_after: newRating,
        change,
        reason: `Local тэмцээн: ${session.name}`,
      })
    }

    // Check if tournament winner
    const isTournamentWinner = session.winnerId === player.id

    // Update profile stats
    const { error } = await supabase
      .from("profiles")
      .update({
        rating_points: Math.max(0, newRating),
        matches_played: currentProfile.matches_played + stats.matchesPlayed,
        matches_won: currentProfile.matches_won + stats.matchesWon,
        tournament_wins: currentProfile.tournament_wins + (isTournamentWinner ? 1 : 0),
        count_180: currentProfile.count_180 + dart.count180,
        highest_checkout: newHighest,
        best_leg: newBest,
        average_score: newAvg,
        checkout_percentage: newCheckoutPct,
        career_points: newCareerPoints,
        career_darts: newCareerDarts,
        checkout_hits: newCheckoutHits,
        checkout_attempts: newCheckoutAttempts,
      })
      .eq("id", profileId)

    if (!error) {
      synced++
      // Check achievements
      await (supabase as any).rpc("check_achievements", { p_player_id: profileId })
    }
  }

  // Insert rating history
  if (historyEntries.length > 0) {
    await supabase.from("rating_history").insert(historyEntries)
  }

  return NextResponse.json({ synced, players: linkedPlayers.length })
}
