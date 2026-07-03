// Cricket Practice — 20,19,18,17,16,15,Bull тоо бүрийг 3 mark хүртэл хаана.
// Headline metric = dartsThrown (бага байх тусам сайн — бүх тоог хамгийн хурдан хаах).
export type CricketTarget = number | "bull"

export const CRICKET_NUMBERS: CricketTarget[] = [20, 19, 18, 17, 16, 15, "bull"]

export interface CricketState {
  marks: Record<string, number>
  dartsThrown: number
  finished: boolean
}

export function initCricketState(): CricketState {
  const marks: Record<string, number> = {}
  for (const n of CRICKET_NUMBERS) marks[String(n)] = 0
  return { marks, dartsThrown: 0, finished: false }
}

export function applyCricketDart(
  state: CricketState,
  target: CricketTarget | "miss",
  multiplier: 1 | 2 | 3
): CricketState {
  if (state.finished) return state
  const dartsThrown = state.dartsThrown + 1
  if (target === "miss") {
    return { ...state, dartsThrown }
  }
  const key = String(target)
  const current = state.marks[key] ?? 0
  const marks = { ...state.marks, [key]: Math.min(3, current + multiplier) }
  const finished = CRICKET_NUMBERS.every((n) => marks[String(n)] >= 3)
  return { marks, dartsThrown, finished }
}
