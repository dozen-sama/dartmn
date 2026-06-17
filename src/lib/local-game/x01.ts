import { classifyTurn } from "./checkouts"

// x01 онооны engine — Together БА Online хоёр хуваалцана. Зөвхөн points+darts-аас
// (event-sourced) үлдсэн оноо/bust/checkout/leg/winner-ийг replay-ээр гаргана.
// classifyTurn (lib/checkouts) нь дартсны дүрмийн НЭГ эх сурвалж.

// decide — visit/round хязгаарт хүрэхэд leg-ийг гараар (bull finish) шийдсэн ялагч баг.
export interface X01Visit { points: number; darts: number; decide?: number }

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
  // Хязгаарт хүрсэн (bull finish) — гараар ялагч сонгох хүртэл зогсоно
  legAtLimit: boolean
}

export function deriveX01(visits: X01Visit[], cfg: X01Config): X01State {
  const { startScore, doubleOut, legsToWin, starterTeam, teamSizes } = cfg
  const limitEnabled = !!cfg.limitRoundsEnabled && cfg.limitRounds !== undefined && cfg.limitRounds > 0
  const limit = cfg.limitRounds ?? 0
  const bullFinish = !!cfg.bullFinishAtLimit
  const sc: [number, number] = [startScore, startScore]
  const lg: [number, number] = [0, 0]
  const cp: [number, number] = [0, 0]
  let legStarter = starterTeam
  let active = starterTeam
  let winner: number | null = null
  let legAtLimit = false
  const legsView: X01VisitView[][] = []
  let curLeg: X01VisitView[] = []
  legsView.push(curLeg)

  const pcount = (t: number) => Math.max(1, teamSizes[t] ?? 1)

  // Шинэ leg — оноо reset, тоглогч эргэлдэнэ, эхлэгч ЭЭЛЖИЛНЭ (стандарт дартс)
  function advanceLeg() {
    sc[0] = startScore; sc[1] = startScore
    cp[0] = (cp[0] + 1) % pcount(0)
    cp[1] = (cp[1] + 1) % pcount(1)
    legStarter = legStarter === 0 ? 1 : 0
    active = legStarter
    curLeg = []
    legAtLimit = false
    legsView.push(curLeg)
  }
  // Leg-ийг багт олгож, матч дуусвал true
  function awardLeg(team: number): boolean {
    lg[team]++
    if (lg[team] >= legsToWin) { winner = team; return true }
    advanceLeg()
    return false
  }

  for (let i = 0; i < visits.length; i++) {
    if (winner !== null) break
    const v = visits[i]
    // Гараар шийдсэн (хязгаар/bull finish) — ялагчид leg олгоно
    if (v.decide !== undefined) { if (awardLeg(v.decide)) break; continue }
    if (legAtLimit) continue  // шийдвэр (decide) хүлээж байгаа тул нормал ээлж тоохгүй

    const before = sc[active]
    const outcome = classifyTurn(before, v.points, { doubleOut })
    const bust = outcome.type === "bust"
    const checkout = outcome.type === "checkout"
    const remaining = outcome.remaining
    curLeg.push({ team: active, player: cp[active], points: v.points, remaining, bust, checkout, idx: i })

    if (checkout) {
      if (awardLeg(active)) break
    } else {
      sc[active] = remaining
      cp[active] = (cp[active] + 1) % pcount(active)
      active = active === 0 ? 1 : 0
      // Хязгаар нь ЗӨВХӨН bull finish-тэй хослоход үйлчилнэ: баг бүр limit удаа
      // шидээд checkout болоогүй бол гараар ялагч сонгоно. Bull finish ОFF бол
      // хязгаар нөлөөгүй — double-out хийх хүртэл (хязгааргүй) үргэлжилнэ.
      if (limitEnabled && bullFinish && curLeg.length >= limit * 2) {
        legAtLimit = true  // гараар ялагч сонгох хүртэл зогсоно
      }
    }
  }

  const currentRound = Math.floor(curLeg.length / 2) + 1
  return { scores: sc, legs: lg, currentPlayer: cp, activeTeam: active, winner, legsView, currentRound, legAtLimit }
}
