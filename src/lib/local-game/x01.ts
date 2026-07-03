import { classifyTurn } from "./checkouts"
import type { LocalMatch, LocalSession } from "./types"

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
  legsToWin: number  // sets горимд: 1 SET хожихын тулд шаардагдах leg тоо
  starterTeam: number
  teamSizes: [number, number]  // баг тус бүрийн тоглогчийн тоо
  limitRoundsEnabled?: boolean
  limitRounds?: number
  bullFinishAtLimit?: boolean
  setsToWin?: number  // заасан бол sets горим: legsToWin-д хүрэхэд SET шилжинэ
}

export interface X01State {
  scores: [number, number]
  legs: [number, number]  // ОДООГИЙН SET-ийн leg тоо (sets горимд set бүрт reset хийгдэнэ)
  sets: [number, number]  // нийт хожсон SET (sets горимгүй үед ашиглагдахгүй, [0,0])
  currentPlayer: [number, number]  // идэвхтэй slot баг тус бүрд
  activeTeam: number
  winner: number | null
  legsView: X01VisitView[][]
  currentRound: number
  // Хязгаарт хүрсэн (bull finish) — гараар ялагч сонгох хүртэл зогсоно
  legAtLimit: boolean
  legWinners: number[]  // leg бүрийг хожсон баг (индекс = leg дугаар) — match-stat-details-д ашиглана
}

// online_rooms.best_of/legs_per_set-ээс deriveX01-д дамжуулах legsToWin/setsToWin-г
// тооцоолно. legs_per_set байвал sets горим идэвхжинэ: best_of нь "хэдэн SET хожвол",
// legs_per_set нь "SET дотор хэдэн leg хожвол" — хоёуланд нь ижил Math.ceil(x/2) томьёо.
export function x01LegsConfig(room: { best_of: number; legs_per_set: number | null }): { legsToWin: number; setsToWin?: number } {
  if (room.legs_per_set) {
    return { legsToWin: Math.ceil(room.legs_per_set / 2), setsToWin: Math.ceil(room.best_of / 2) }
  }
  return { legsToWin: Math.ceil(room.best_of / 2) }
}

// match.round-оос тухайн match RR (бүлгийн) шат мөн эсэхийг тодорхойлно.
// groups_knockout: round<100 бол group stage (RR тохиргоо), round>=100 бол KO.
// round_robin/swiss: бүх match RR тохиргоотой. single/double_elimination: үргэлж KO.
export function isLocalRrPhase(session: Pick<LocalSession, "bracketType">, match: Pick<LocalMatch, "round">): boolean {
  if (session.bracketType === "groups_knockout") return match.round < 100
  return session.bracketType === "round_robin" || session.bracketType === "swiss"
}

// Local session-ий rr*/KO талбаруудаас (аль хэдийн "first to N" утга, best_of биш)
// deriveX01/Scoreboard-д хэрэглэх { legsToWin, setsToWin? }-г гаргаж өгнө.
export function localX01Config(session: LocalSession, isRrPhase: boolean): { legsToWin: number; setsToWin?: number } {
  const setsEnabled = isRrPhase ? session.rrSetsEnabled : session.setsEnabled
  const legsPerSet = isRrPhase ? session.rrLegsPerSet : session.legsPerSet
  const firstTo = isRrPhase ? session.rrFirstTo : session.firstTo
  if (setsEnabled) {
    return { legsToWin: Math.max(1, legsPerSet), setsToWin: Math.max(1, firstTo) }
  }
  return { legsToWin: Math.max(1, firstTo) }
}

export function deriveX01(visits: X01Visit[], cfg: X01Config): X01State {
  const { startScore, doubleOut, legsToWin, starterTeam, teamSizes, setsToWin } = cfg
  const limitEnabled = !!cfg.limitRoundsEnabled && cfg.limitRounds !== undefined && cfg.limitRounds > 0
  const limit = cfg.limitRounds ?? 0
  const bullFinish = !!cfg.bullFinishAtLimit
  const sc: [number, number] = [startScore, startScore]
  const lg: [number, number] = [0, 0]
  const st: [number, number] = [0, 0]
  const cp: [number, number] = [0, 0]
  let legStarter = starterTeam
  let active = starterTeam
  let winner: number | null = null
  let legAtLimit = false
  const legWinners: number[] = []
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
    legWinners.push(team)
    lg[team]++
    if (lg[team] >= legsToWin) {
      if (setsToWin) {
        st[team]++
        if (st[team] >= setsToWin) { winner = team; return true }
        lg[0] = 0; lg[1] = 0
        advanceLeg()
        return false
      }
      winner = team; return true
    }
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
  return { scores: sc, legs: lg, sets: st, currentPlayer: cp, activeTeam: active, winner, legsView, currentRound, legAtLimit, legWinners }
}
