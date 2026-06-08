// Common checkout combinations for 501/301
const CHECKOUTS: Record<number, string> = {
  170: "T20 T20 Bull",
  167: "T20 T19 Bull",
  164: "T20 T18 Bull",
  161: "T20 T17 Bull",
  160: "T20 T20 D20",
  158: "T20 T20 D19",
  157: "T20 T19 D20",
  156: "T20 T20 D18",
  155: "T20 T19 D19",
  154: "T20 T18 D20",
  153: "T20 T19 D18",
  152: "T20 T20 D16",
  151: "T20 T17 D20",
  150: "T20 T18 D18",
  149: "T20 T19 D16",
  148: "T20 T16 D20",
  147: "T20 T17 D18",
  146: "T20 T18 D16",
  145: "T20 T15 D20",
  144: "T20 T20 D12",
  143: "T20 T17 D16",
  142: "T20 T14 D20",
  141: "T20 T19 D12",
  140: "T20 T20 D10",
  139: "T19 T14 D20",
  138: "T20 T18 D12",
  137: "T20 T19 D10",
  136: "T20 T20 D8",
  135: "T20 T17 D12",
  134: "T20 T14 D16",
  133: "T20 T19 D8",
  132: "T20 T16 D12",
  131: "T20 T13 D16",
  130: "T20 T18 D8",
  129: "T19 T16 D12",
  128: "T20 T20 D4",
  127: "T20 T17 D8",
  126: "T19 T19 D6",
  125: "T20 T15 D10",
  124: "T20 T16 D8",
  123: "T19 T16 D9",
  122: "T18 T18 D7",
  121: "T20 T11 D14",
  120: "T20 S20 D20",
  119: "T19 T12 D13",
  118: "T20 S18 D20",
  117: "T20 S17 D20",
  116: "T20 S16 D20",
  115: "T20 S15 D20",
  114: "T20 S14 D20",
  113: "T20 S13 D20",
  112: "T20 S12 D20",
  111: "T20 S11 D20",
  110: "T20 S10 D20",
  109: "T20 S9 D20",
  108: "T20 S8 D20",
  107: "T19 S18 D16",
  106: "T20 S6 D20",
  105: "T20 S5 D20",
  104: "T18 S18 D16",
  103: "T19 S6 D20",
  102: "T20 S10 D16",
  101: "T17 S10 D20",
  100: "T20 D20",
  99: "T19 S10 D16",
  98: "T20 D19",
  97: "T19 D20",
  96: "T20 D18",
  95: "T19 D19",
  94: "T18 D20",
  93: "T19 D18",
  92: "T20 D16",
  91: "T17 D20",
  90: "T18 D18",
  89: "T19 D16",
  88: "T16 D20",
  87: "T17 D18",
  86: "T18 D16",
  85: "T15 D20",
  84: "T20 D12",
  83: "T17 D16",
  82: "T14 D20",
  81: "T19 D12",
  80: "T20 D10",
  79: "T19 D11",
  78: "T18 D12",
  77: "T19 D10",
  76: "T20 D8",
  75: "T17 D12",
  74: "T14 D16",
  73: "T19 D8",
  72: "T16 D12",
  71: "T13 D16",
  70: "T18 D8",
  69: "T19 D6",
  68: "T20 D4",
  67: "T17 D8",
  66: "T10 D18",
  65: "T19 D4",
  64: "T16 D8",
  63: "T17 D6",
  62: "T10 D16",
  61: "T15 D8",
  60: "S20 D20",
  59: "S19 D20",
  58: "S18 D20",
  57: "S17 D20",
  56: "T16 D4",
  55: "S15 D20",
  54: "S14 D20",
  53: "S13 D20",
  52: "T12 D8",
  51: "S11 D20",
  50: "S10 D20",
  49: "S9 D20",
  48: "S16 D16",
  47: "S15 D16",
  46: "S6 D20",
  45: "S13 D16",
  44: "S12 D16",
  43: "S11 D16",
  42: "S10 D16",
  41: "S9 D16",
  40: "D20",
  39: "S7 D16",
  38: "D19",
  37: "S5 D16",
  36: "D18",
  35: "S3 D16",
  34: "D17",
  33: "S1 D16",
  32: "D16",
  31: "S15 D8",
  30: "D15",
  29: "S13 D8",
  28: "D14",
  27: "S11 D8",
  26: "D13",
  25: "S9 D8",
  24: "D12",
  23: "S7 D8",
  22: "D11",
  21: "S5 D8",
  20: "D10",
  18: "D9",
  16: "D8",
  14: "D7",
  12: "D6",
  10: "D5",
  8: "D4",
  6: "D3",
  4: "D2",
  2: "D1",
}

// Impossible checkouts — these scores cannot be finished with any combination of 3 darts ending on a double
export const IMPOSSIBLE_CHECKOUTS = new Set([169, 168, 166, 165, 163, 162, 159])

// Totals that CANNOT be scored with 3 darts (each dart ≤ 60). Entering one is a mis-entry.
export const IMPOSSIBLE_VISIT_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179])

// A single 3-dart visit total must be 0..180 and not one of the impossible totals.
export function isPossibleVisitScore(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 180 && !IMPOSSIBLE_VISIT_SCORES.has(n)
}

// Valid double scores: D1(2)..D20(40) + Bull(50)
export const VALID_DOUBLES = new Set([
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20,
  22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  50,
])

export function getCheckout(remaining: number): string | null {
  return CHECKOUTS[remaining] ?? null
}

export function getImpossibleCheckoutWarning(afterScore: number): string | null {
  if (IMPOSSIBLE_CHECKOUTS.has(afterScore)) {
    return `${afterScore} — checkout боломжгүй утга. Дахин тооцоолно уу.`
  }
  if (afterScore === 1) return "1 — checkout боломжгүй. (Хамгийн бага checkout: D1 = 2)"
  return null
}

// Whether `remaining` can be finished on a double in ≤3 darts.
// Every number in [2,170] is a valid double-out finish EXCEPT the impossible set.
// NOTE: do NOT derive this from the CHECKOUTS suggestion table above — that table
// has gaps (e.g. odd numbers 3..19 such as 19 = S3 D8) and would wrongly reject them.
export function canDoubleOut(remaining: number): boolean {
  return remaining >= 2 && remaining <= 170 && !IMPOSSIBLE_CHECKOUTS.has(remaining)
}

export interface TurnRules {
  doubleOut: boolean
  // House rule: at the round limit the leg must be finished on the bull (25 or 50).
  requireBullFinish?: boolean
}

export type TurnOutcome =
  | { type: "score"; remaining: number }    // normal turn — score subtracted, play passes on
  | { type: "bust"; remaining: number }      // foul — score reverts to start-of-turn value
  | { type: "checkout"; remaining: 0 }       // leg won

// Single source of truth for classifying an x01 turn from the total visit score.
// Used by BOTH the live replay engine and the input preview so they can never disagree.
// `before` is the remaining score at the start of the turn; `points` is the visit total.
export function classifyTurn(before: number, points: number, rules: TurnRules): TurnOutcome {
  const after = before - points
  // Overthrow → bust (score reverts).
  if (after < 0) return { type: "bust", remaining: before }
  if (after === 0) {
    // Bull-finish house rule overrides double-out: must land exactly on 25 or 50.
    if (rules.requireBullFinish) {
      return points === 25 || points === 50
        ? { type: "checkout", remaining: 0 }
        : { type: "bust", remaining: before }
    }
    // Reached 0 from a number you cannot finish on a double → bust.
    if (rules.doubleOut && !canDoubleOut(before)) return { type: "bust", remaining: before }
    return { type: "checkout", remaining: 0 }
  }
  // Left exactly 1 with double-out on → cannot finish (min double is D1 = 2) → bust.
  if (rules.doubleOut && after === 1) return { type: "bust", remaining: before }
  return { type: "score", remaining: after }
}

// Score segment parsing: "T20" → 60, "D16" → 32, "Bull" → 50, "S15" → 15
export function parseSegment(seg: string): number {
  if (seg === "Bull" || seg === "BULL") return 50
  if (seg === "bull" || seg === "25") return 25
  const m = seg.match(/^([TDS])(\d+)$/)
  if (!m) return parseInt(seg) || 0
  const n = parseInt(m[2])
  if (m[1] === "T") return n * 3
  if (m[1] === "D") return n * 2
  return n
}
