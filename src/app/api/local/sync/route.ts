import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { LocalSession, LocalMatch, LocalPlayer } from "@/lib/local-game/types"

interface SyncPayload {
  session: LocalSession
}

// ELO calculation
function eloChange(myRating: number, oppRating: number, won: boolean, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400))
  return Math.round(k * ((won ? 1 : 0) - expected))
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
    .select("id, rating_points, matches_played, matches_won, count_180, highest_checkout, tournament_wins")
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

    let newRating = currentProfile.rating_points
    let totalEloChange = 0

    // Calculate ELO change for each match
    for (const result of stats.matchResults) {
      const oppRating = result.oppProfileId
        ? (ratingMap[result.oppProfileId] ?? 1000)
        : 1000 // Guest default rating

      const change = eloChange(newRating, oppRating, result.won)
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
        rating_points: Math.max(0, newRating) as any,
        matches_played: (currentProfile.matches_played + stats.matchesPlayed) as any,
        matches_won: (currentProfile.matches_won + stats.matchesWon) as any,
        tournament_wins: (currentProfile.tournament_wins + (isTournamentWinner ? 1 : 0)) as any,
      })
      .eq("id", profileId)

    if (!error) {
      synced++
      // Check achievements
      await supabase.rpc("check_achievements", { p_player_id: profileId })
    }
  }

  // Insert rating history
  if (historyEntries.length > 0) {
    await supabase.from("rating_history").insert(historyEntries)
  }

  return NextResponse.json({ synced, players: linkedPlayers.length })
}
