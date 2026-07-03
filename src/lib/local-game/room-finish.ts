import { applyMatchResult, type MatchPlayer } from "./match-stats"
import { computeMatchStatDetails, type StatLeg } from "./match-stat-details"
import type { X01State, X01Visit } from "./x01"

// Дууссан онлайн өрөөг хаах + ELO/статистик (claim-first → нэг л удаа).
// state = одоогийн replay төлөв (стат/шидэлтийг үүнээс авна); winnerTeam = ялагч баг
// (хэвийн дуусгал, эсвэл бууж өгөх/идэвхгүйн ялалтаар албадан тогтоосон).
export async function finishOnlineRoom(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  roomId: string,
  state: X01State,
  winnerTeam: number,
  players: { player_id: string; team: number; slot: number }[],
  visits: X01Visit[],
  mode: string,
): Promise<boolean> {
  // Claim — зөвхөн ongoing→completed нэг удаа амжина (ELO давхар орохоос сэргийлнэ)
  const { data: claimed } = await admin.from("online_rooms")
    .update({ status: "completed", winner_team: winnerTeam })
    .eq("id", roomId).eq("status", "ongoing").select("id")
  if (!claimed || claimed.length === 0) return true  // өөр хүсэлт аль хэдийн хаасан

  const flat = state.legsView.flat()
  const matchPlayers: MatchPlayer[] = players.map((p) => ({
    profileId: p.player_id,
    team: p.team,
    isWinner: winnerTeam === p.team,
    throws: flat.filter((v) => v.team === p.team && v.player === p.slot).map((v) => ({
      score: v.points,
      darts: visits[v.idx]?.darts ?? 3,
      bust: v.bust,
      before: v.bust ? v.remaining : v.remaining + v.points,
    })),
  }))
  await applyMatchResult(admin, matchPlayers, `${mode} онлайн тоглолт`, roomId)

  // Тэмцээний match бол ялагчийг bracket-ийн дараагийн шатанд дэвшүүлнэ (атомик).
  // team 0 = side1, team 1 = side2 (match-start route-ийн суулгацтай нийцнэ).
  const { data: room } = await admin.from("online_rooms")
    .select("tournament_match_id, legs_per_set, format, double_out").eq("id", roomId).single()

  // Дэлгэрэнгүй match статистик ("Үр дүнг харуулах" popup) — зөвхөн 1v1 (2 тоглогчтой
  // тэмцээн) дээр л 2 талт харьцуулалт утга учиртай. state.legsView (flat()-аас өмнөх,
  // leg-ээр бүлэглэсэн) ашиглана.
  if (mode === "1v1" && players.length === 2) {
    try {
      const profileIds = players.map((p) => p.player_id)
      const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", profileIds)
      const nameById = new Map<string, string>((profs ?? []).map((pr: { id: string; display_name: string }) => [pr.id, pr.display_name]))

      let contextLabel: string | null = null
      if (room?.tournament_match_id) {
        const { data: tm } = await admin.from("tournament_matches")
          .select("round, group_no, tournaments(name)")
          .eq("id", room.tournament_match_id).single()
        if (tm) {
          const tName = (tm.tournaments as { name?: string } | null)?.name ?? "Тэмцээн"
          contextLabel = tm.group_no ? `${tName} · Group ${tm.group_no}` : `${tName} · Round ${tm.round}`
        }
      }

      const rows = players.map((p) => {
        const opponent = players.find((o) => o.team !== p.team)!
        const statLegs: StatLeg[] = state.legsView.map((legVisits, i) => ({
          starter: legVisits[0]?.team === p.team,
          won: state.legWinners[i] === p.team,
          visits: legVisits.filter((v) => v.team === p.team && v.player === p.slot).map((v) => ({
            points: v.points, darts: visits[v.idx]?.darts ?? 3, bust: v.bust,
            before: v.bust ? v.remaining : v.remaining + v.points,
          })),
        }))
        const stats = computeMatchStatDetails(statLegs)
        return {
          player_id: p.player_id,
          opponent_id: opponent.player_id,
          opponent_name: nameById.get(opponent.player_id) ?? "Тодорхойгүй",
          won: winnerTeam === p.team,
          legs_for: stats.legsFor,
          legs_against: stats.legsAgainst,
          source: "online",
          room_id: roomId,
          tournament_match_id: room?.tournament_match_id ?? null,
          context_label: contextLabel,
          match_key: `room:${roomId}`,
          format: room?.format ?? "501",
          double_out: room?.double_out ?? true,
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
      await admin.from("match_stat_details").upsert(rows, { onConflict: "player_id,match_key" })
    } catch (e) {
      console.error("[finishOnlineRoom] match_stat_details write failed:", e)
    }
  }

  if (room?.tournament_match_id) {
    // sets горимд bracket-д хожсон SET тоог бичнэ (legs биш) — group/RR
    // standings-ийн diff тооцоолол sets горимд ч тохирсон утга авах ёстой
    const usesSets = room.legs_per_set != null
    await admin.rpc("advance_tournament_match", {
      p_match_id: room.tournament_match_id,
      p_winning_side: winnerTeam + 1,
      p_side1_legs: usesSets ? state.sets[0] : state.legs[0],
      p_side2_legs: usesSets ? state.sets[1] : state.legs[1],
    })
  }
  return true
}
