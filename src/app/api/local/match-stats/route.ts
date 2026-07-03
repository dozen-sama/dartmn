import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { LocalSession } from "@/lib/local-game/types"
import { computeMatchStatDetails, localLegsToStatLegs } from "@/lib/local-game/match-stat-details"

interface SyncPayload {
  session: LocalSession
  matchId: string
}

// Local match дуусангуут (session бүтэн синк хийхийг хүлээхгүйгээр) дэлгэрэнгүй статистикийг
// ("Үр дүнг харуулах" popup) бичнэ — зөвхөн DartMN акаунттай (profileId бүхий) тоглогчид.
export async function POST(req: NextRequest) {
  const { session, matchId } = (await req.json()) as SyncPayload
  const match = session?.matches.find((m) => m.id === matchId)
  if (!session || !match || match.status !== "completed") {
    return NextResponse.json({ error: "Match дуусаагүй" }, { status: 400 })
  }

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const p1 = match.player1Id && match.player1Id !== "bye" ? playerMap[match.player1Id] : null
  const p2 = match.player2Id && match.player2Id !== "bye" ? playerMap[match.player2Id] : null
  if (!p1 || !p2) return NextResponse.json({ synced: 0 })

  const linked = [p1, p2].filter((p) => p.profileId)
  if (linked.length === 0) return NextResponse.json({ synced: 0 })

  const group = match.groupId ? session.groups.find((g) => g.id === match.groupId) : null
  const contextLabel = `${session.name}${group ? ` · ${group.name}` : ` · Round ${match.round}`}`

  const admin = await createAdminClient()

  const rows = linked.map((player) => {
    const opponent = player.id === p1.id ? p2 : p1
    const statLegs = localLegsToStatLegs(match.legs, player.id)
    const stats = computeMatchStatDetails(statLegs)
    return {
      player_id: player.profileId!,
      opponent_id: opponent.profileId ?? null,
      opponent_name: opponent.name,
      won: match.winnerId === player.id,
      legs_for: stats.legsFor,
      legs_against: stats.legsAgainst,
      source: "local" as const,
      local_session_id: session.id,
      local_match_id: match.id,
      context_label: contextLabel,
      match_key: `local:${session.id}:${match.id}`,
      format: session.format,
      double_out: session.doubleOut,
      darts_thrown: stats.dartsThrown,
      points_scored: stats.pointsScored,
      avg3: stats.avg3,
      avg_first9: stats.avgFirst9,
      band_60: stats.band60, band_80: stats.band80, band_100: stats.band100,
      band_120: stats.band120, band_140: stats.band140, band_170: stats.band170,
      count_180: stats.count180,
      high_finish: stats.highFinish,
      count_100_finishes: stats.count100Finishes,
      best_leg_darts: stats.bestLegDarts,
      worst_leg_darts: stats.worstLegDarts,
      checkout_attempts: stats.checkoutAttempts,
      checkout_makes: stats.checkoutMakes,
      keep_attempts: stats.keepAttempts,
      keep_makes: stats.keepMakes,
      break_attempts: stats.breakAttempts,
      break_makes: stats.breakMakes,
    }
  })

  const { error } = await admin.from("match_stat_details").upsert(rows, { onConflict: "player_id,match_key" })
  if (error) return NextResponse.json({ error: "Стат бичихэд алдаа гарлаа", detail: error.message }, { status: 500 })

  return NextResponse.json({ synced: rows.length })
}
