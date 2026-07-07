import { canDoubleOut, isPossibleVisitScore } from "./checkouts"
import type { LocalLeg } from "./types"

// Тоглолт дуусахад гарах дэлгэрэнгүй статистик ("Үр дүнг харуулах" popup). Online (room-finish.ts)
// болон local (Scoreboard.tsx → /api/local/match-stats) хоёулаа энэ нэг цэвэр функцийг
// жижиг adapter-аар дамжуулж ашиглана — bust/checkout логикыг давхардуулахгүй.

export interface StatVisit {
  points: number
  darts: number
  bust: boolean
  before: number  // энэ ээлжийн эхэнд үлдсэн байсан оноо
}

export interface StatLeg {
  starter: boolean  // энэ тоглогч уг leg-ийг эхэлсэн үү
  won: boolean       // энэ тоглогч уг leg-ийг хожсон уу
  visits: StatVisit[]
}

export interface MatchStatDetails {
  legsFor: number
  legsAgainst: number
  dartsThrown: number
  pointsScored: number
  avg3: number
  avgFirst9: number
  band60: number
  band80: number
  band100: number
  band120: number
  band140: number
  band170: number
  count180: number
  highFinish: number
  count100Finishes: number
  bestLegDarts: number | null
  worstLegDarts: number | null
  checkoutAttempts: number
  checkoutMakes: number
  keepAttempts: number
  keepMakes: number
  breakAttempts: number
  breakMakes: number
}

// Local match-ийн LocalLeg[]-ийг тухайн тоглогчийн өнцгөөс StatLeg[]-д хөрвүүлнэ —
// /api/local/match-stats route (server) болон Scoreboard.tsx (client, шууд popup) хоёуланд ашиглана.
export function localLegsToStatLegs(legs: LocalLeg[], playerId: string): StatLeg[] {
  return legs.filter((l) => l.winnerId !== null).map((l) => ({
    starter: l.starterId === playerId,
    won: l.winnerId === playerId,
    visits: (l.throws[playerId] ?? []).map((t) => ({
      points: t.score, darts: t.darts, bust: !!t.bust,
      before: t.bust ? t.remaining : t.remaining + t.score,
    })),
  }))
}

// `doubleOut` тохиргоог заавал дамжуулна: double-out бол зөвхөн double-ээр
// дуусгаж болох үлдэгдэл (canDoubleOut) checkout attempt тооцогдоно; straight/master-out
// бол ямар ч 1..180 (боломжит visit оноо) үлдэгдэл attempt тооцогдоно — эс тэгвэл
// straight-out тоглолтын checkout% дутуу/буруу гарна.
export function computeMatchStatDetails(legs: StatLeg[], doubleOut: boolean): MatchStatDetails {
  let legsFor = 0, legsAgainst = 0
  let dartsThrown = 0, pointsScored = 0
  let band60 = 0, band80 = 0, band100 = 0, band120 = 0, band140 = 0, band170 = 0, count180 = 0
  let highFinish = 0, count100Finishes = 0
  let bestLegDarts: number | null = null, worstLegDarts: number | null = null
  let checkoutAttempts = 0, checkoutMakes = 0
  let keepAttempts = 0, keepMakes = 0
  let breakAttempts = 0, breakMakes = 0
  const first9Averages: number[] = []

  for (const leg of legs) {
    if (leg.won) legsFor++
    else legsAgainst++

    if (leg.starter) {
      keepAttempts++
      if (leg.won) keepMakes++
    } else {
      breakAttempts++
      if (leg.won) breakMakes++
    }

    let legDarts = 0
    if (leg.visits.length > 0) {
      const first9 = leg.visits.slice(0, 3)
      const first9Points = first9.reduce((a, v) => a + (v.bust ? 0 : v.points), 0)
      const first9Darts = first9.reduce((a, v) => a + v.darts, 0)
      if (first9Darts > 0) first9Averages.push((first9Points / first9Darts) * 3)
    }

    for (const v of leg.visits) {
      legDarts += v.darts
      dartsThrown += v.darts

      const isCheckoutAttempt = doubleOut
        ? canDoubleOut(v.before)
        : v.before > 0 && isPossibleVisitScore(v.before)
      if (isCheckoutAttempt) checkoutAttempts++

      if (v.bust) continue

      pointsScored += v.points
      const isCheckout = v.before - v.points === 0

      if (v.points >= 60 && v.points < 80) band60++
      else if (v.points >= 80 && v.points < 100) band80++
      else if (v.points >= 100 && v.points < 120) band100++
      else if (v.points >= 120 && v.points < 140) band120++
      else if (v.points >= 140 && v.points < 170) band140++
      else if (v.points >= 170 && v.points < 180) band170++
      else if (v.points === 180) count180++

      if (isCheckout) {
        if (isCheckoutAttempt) checkoutMakes++
        if (v.points > highFinish) highFinish = v.points
        if (v.points >= 100) count100Finishes++
      }
    }

    if (leg.won && legDarts > 0) {
      bestLegDarts = bestLegDarts === null ? legDarts : Math.min(bestLegDarts, legDarts)
      worstLegDarts = worstLegDarts === null ? legDarts : Math.max(worstLegDarts, legDarts)
    }
  }

  const avg3 = dartsThrown > 0 ? (pointsScored / dartsThrown) * 3 : 0
  const avgFirst9 = first9Averages.length > 0
    ? first9Averages.reduce((a, b) => a + b, 0) / first9Averages.length
    : 0

  return {
    legsFor, legsAgainst, dartsThrown, pointsScored, avg3, avgFirst9,
    band60, band80, band100, band120, band140, band170, count180,
    highFinish, count100Finishes, bestLegDarts, worstLegDarts,
    checkoutAttempts, checkoutMakes, keepAttempts, keepMakes, breakAttempts, breakMakes,
  }
}
