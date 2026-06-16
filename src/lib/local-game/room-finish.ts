import { applyMatchResult, type MatchPlayer } from "./match-stats"
import type { X01State, X01Visit } from "./x01"

// Дууссан онлайн өрөөг хаах + ELO/статистик (claim-first → нэг л удаа).
// after = winner гарсан replay төлөв; visits = деривт орсон visit массив (idx-д тааруулна).
export async function finishOnlineRoom(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  roomId: string,
  after: X01State,
  players: { player_id: string; team: number; slot: number }[],
  visits: X01Visit[],
  mode: string,
): Promise<boolean> {
  if (after.winner === null) return false
  // Claim — зөвхөн ongoing→completed нэг удаа амжина (ELO давхар орохоос сэргийлнэ)
  const { data: claimed } = await admin.from("online_rooms")
    .update({ status: "completed", winner_team: after.winner })
    .eq("id", roomId).eq("status", "ongoing").select("id")
  if (!claimed || claimed.length === 0) return true  // өөр хүсэлт аль хэдийн хаасан

  const flat = after.legsView.flat()
  const matchPlayers: MatchPlayer[] = players.map((p) => ({
    profileId: p.player_id,
    team: p.team,
    isWinner: after.winner === p.team,
    throws: flat.filter((v) => v.team === p.team && v.player === p.slot).map((v) => ({
      score: v.points,
      darts: visits[v.idx]?.darts ?? 3,
      bust: v.bust,
      before: v.bust ? v.remaining : v.remaining + v.points,
    })),
  }))
  await applyMatchResult(admin, matchPlayers, `${mode} онлайн тоглолт`)
  return true
}
