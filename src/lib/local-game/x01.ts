import { classifyTurn } from "./checkouts"

// x01 онооны engine — Together БА Online хоёр хуваалцана. Зөвхөн points+darts-аас
// (event-sourced) үлдсэн оноо/bust/checkout/leg/winner-ийг replay-ээр гаргана.
// classifyTurn (lib/checkouts) нь дартсны дүрмийн НЭГ эх сурвалж.

export interface X01Visit { points: number; darts: number }

// Replay-ийн нэг ээлжийн харагдац
export interface X01VisitView {
  team: number
  player: number
  points: number
  remaining: number  // ээлжийн дараах үлдсэн оноо (bust→before, checkout→0)
  bust: boolean
  checkout: boolean
  idx: number        // visits массив дахь индекс
}

export interface X01Config {
  startScore: number
  doubleOut: boolean
  legsToWin: number
  starterTeam: number
  teamSizes: [number, number]  // баг тус бүрийн тоглогчийн тоо
  limitRoundsEnabled?: boolean
  limitRounds?: number
  bullFinishAtLimit?: boolean
}

export interface X01State {
  scores: [number, number]
  legs: [number, number]
  currentPlayer: [number, number]  // идэвхтэй slot баг тус бүрд
  activeTeam: number
  winner: number | null
  legsView: X01VisitView[][]
  currentRound: number
}

export function deriveX01(visits: X01Visit[], cfg: X01Config): X01State {
  const { startScore, doubleOut, legsToWin, starterTeam, teamSizes } = cfg
  const sc: [number, number] = [startScore, startScore]
  const lg: [number, number] = [0, 0]
  const cp: [number, number] = [0, 0]
  let active = starterTeam
  let winner: number | null = null
  const legsView: X01VisitView[][] = []
  let curLeg: X01VisitView[] = []
  legsView.push(curLeg)

  const pcount = (t: number) => Math.max(1, teamSizes[t] ?? 1)

  for (let i = 0; i < visits.length; i++) {
    if (winner !== null) break
    const v = visits[i]
    const before = sc[active]
    // curLeg-д хоёр баг ээлжлэн ордог тул round = хагасласан урт + 1
    const roundForThis = Math.floor(curLeg.length / 2) + 1
    const atLimit = !!cfg.limitRoundsEnabled && cfg.limitRounds !== undefined && roundForThis >= cfg.limitRounds
    const outcome = classifyTurn(before, v.points, {
      doubleOut,
      requireBullFinish: atLimit && !!cfg.bullFinishAtLimit,
    })
    const bust = outcome.type === "bust"
    const checkout = outcome.type === "checkout"
    const remaining = outcome.remaining
    curLeg.push({ team: active, player: cp[active], points: v.points, remaining, bust, checkout, idx: i })

    if (checkout) {
      lg[active]++
      if (lg[active] >= legsToWin) { winner = active; break }
      // Шинэ leg — оноо reset, тоглогч эргэлдэнэ, эхлэгч солигдоно
      sc[0] = startScore; sc[1] = startScore
      cp[0] = (cp[0] + 1) % pcount(0)
      cp[1] = (cp[1] + 1) % pcount(1)
      active = active === 0 ? 1 : 0
      curLeg = []
      legsView.push(curLeg)
    } else {
      sc[active] = remaining
      cp[active] = (cp[active] + 1) % pcount(active)
      active = active === 0 ? 1 : 0
    }
  }

  const currentRound = Math.floor(curLeg.length / 2) + 1
  return { scores: sc, legs: lg, currentPlayer: cp, activeTeam: active, winner, legsView, currentRound }
}
