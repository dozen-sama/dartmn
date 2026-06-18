import { applyMatchResult, type MatchPlayer } from "./match-stats"
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
    .select("tournament_match_id").eq("id", roomId).single()
  if (room?.tournament_match_id) {
    await admin.rpc("advance_tournament_match", {
      p_match_id: room.tournament_match_id,
      p_winning_side: winnerTeam + 1,
      p_side1_legs: state.legs[0],
      p_side2_legs: state.legs[1],
    })
  }
  return true
}
