// Cricket darts game logic

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, "bull"] as const
export type CricketTarget = typeof CRICKET_NUMBERS[number]

export interface CricketMark {
  marks: number  // 0=open, 1=/, 2=X, 3+=closed
  closed: boolean
}

export interface CricketPlayerState {
  marks: Record<string, CricketMark>  // "20", "19", ..., "bull"
  score: number
}

export function initCricketState(): CricketPlayerState {
  const marks: Record<string, CricketMark> = {}
  CRICKET_NUMBERS.forEach((n) => {
    marks[String(n)] = { marks: 0, closed: false }
  })
  return { marks, score: 0 }
}

// Calculate hit result for Cricket
export function applyCricketHit(
  myState: CricketPlayerState,
  oppState: CricketPlayerState,
  target: CricketTarget,
  times: number  // how many times target was hit (1=single, 2=double, 3=triple)
): { myState: CricketPlayerState; oppState: CricketPlayerState } {
  const key = String(target)
  const myMark = { ...myState.marks[key] }
  const prevMarks = myMark.marks

  myMark.marks = Math.min(myMark.marks + times, 99)
  const alreadyClosed = prevMarks >= 3
  const nowClosed = myMark.marks >= 3
  myMark.closed = nowClosed

  let scoringHits = 0
  if (!alreadyClosed && nowClosed) {
    // Just closed — extra hits score if opponent not closed
    scoringHits = myMark.marks - 3
  } else if (alreadyClosed) {
    // Already closed — all hits score if opponent not closed
    scoringHits = times
  }

  let newScore = myState.score
  if (scoringHits > 0 && !oppState.marks[key].closed) {
    const pointValue = target === "bull" ? 50 : Number(target)
    newScore += pointValue * scoringHits
  }

  return {
    myState: {
      marks: { ...myState.marks, [key]: myMark },
      score: newScore,
    },
    oppState,
  }
}

export function getCricketWinner(
  p1State: CricketPlayerState,
  p2State: CricketPlayerState
): "p1" | "p2" | null {
  const p1AllClosed = CRICKET_NUMBERS.every((n) => p1State.marks[String(n)].closed)
  const p2AllClosed = CRICKET_NUMBERS.every((n) => p2State.marks[String(n)].closed)

  if (p1AllClosed && p1State.score >= p2State.score) return "p1"
  if (p2AllClosed && p2State.score >= p1State.score) return "p2"
  return null
}

export function getMarkSymbol(marks: number): string {
  if (marks === 0) return ""
  if (marks === 1) return "/"
  if (marks === 2) return "X"
  return "●"  // closed (3+)
}

export function getMarkColor(marks: number): string {
  if (marks === 0) return "text-muted-foreground/30"
  if (marks === 1) return "text-yellow-400"
  if (marks === 2) return "text-orange-400"
  return "text-green-400"
}
