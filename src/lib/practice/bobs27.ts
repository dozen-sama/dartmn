// Bob's 27 — 1-20 + Bull дараалалтайгаар double бүрийг оролдоно.
// Онох бол double-ийн үнэ (D1=2 ... D20=40, Bull=50) нэмнэ, 3 сумаар бүгд алдвал хасна.
export type Bobs27Target = number | "bull"

export const BOBS27_SEQUENCE: Bobs27Target[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, "bull",
]

function doubleValue(target: Bobs27Target): number {
  return target === "bull" ? 50 : target * 2
}

export interface Bobs27HistoryEntry {
  target: Bobs27Target
  hit: boolean
  delta: number
}

export interface Bobs27State {
  idx: number
  total: number
  finished: boolean
  history: Bobs27HistoryEntry[]
}

export function initBobs27State(): Bobs27State {
  return { idx: 0, total: 27, finished: false, history: [] }
}

export function currentBobs27Target(state: Bobs27State): Bobs27Target | null {
  return state.finished ? null : BOBS27_SEQUENCE[state.idx]
}

export function applyBobs27Target(state: Bobs27State, hit: boolean): Bobs27State {
  if (state.finished) return state
  const target = BOBS27_SEQUENCE[state.idx]
  const value = doubleValue(target)
  const delta = hit ? value : -value
  const idx = state.idx + 1
  return {
    idx,
    total: state.total + delta,
    finished: idx >= BOBS27_SEQUENCE.length,
    history: [...state.history, { target, hit, delta }],
  }
}
