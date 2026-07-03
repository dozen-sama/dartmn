// Shanghai — round бүрт тухайн тооны single/double/treble-ийг оролдоно (roundNumber = 1..20).
// Нэг visit-д гурвыг нь бүгдийг нь оносон бол шууд "Shanghai" (instant win).
export interface ShanghaiVisit {
  singles: number
  doubles: number
  trebles: number
}

export interface ShanghaiHistoryEntry {
  round: number
  visit: ShanghaiVisit
  roundScore: number
}

export interface ShanghaiState {
  round: number
  totalScore: number
  shanghaiHit: boolean
  finished: boolean
  history: ShanghaiHistoryEntry[]
}

export function initShanghaiState(): ShanghaiState {
  return { round: 1, totalScore: 0, shanghaiHit: false, finished: false, history: [] }
}

export function applyShanghaiRound(state: ShanghaiState, visit: ShanghaiVisit): ShanghaiState {
  if (state.finished) return state
  const { round } = state
  const roundScore = round * (visit.singles + 2 * visit.doubles + 3 * visit.trebles)
  const totalScore = state.totalScore + roundScore
  const history = [...state.history, { round, visit, roundScore }]
  const isShanghai = visit.singles >= 1 && visit.doubles >= 1 && visit.trebles >= 1
  if (isShanghai) {
    return { round, totalScore, shanghaiHit: true, finished: true, history }
  }
  const nextRound = round + 1
  return { round: nextRound, totalScore, shanghaiHit: false, finished: nextRound > 20, history }
}
