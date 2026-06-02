export type RatingTier =
  | "Beginner"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Grand Master"

export interface TierInfo {
  tier: RatingTier
  min: number
  max: number
  color: string
  bg: string
  border: string
  icon: string
  nextMin: number | null
}

export const TIERS: TierInfo[] = [
  { tier: "Beginner",    min: 0,    max: 999,  color: "text-slate-400",  bg: "bg-slate-400/15",  border: "border-slate-400/30",  icon: "🎯", nextMin: 1000 },
  { tier: "Bronze",      min: 1000, max: 1199, color: "text-amber-700",  bg: "bg-amber-700/15",  border: "border-amber-700/30",  icon: "🥉", nextMin: 1200 },
  { tier: "Silver",      min: 1200, max: 1399, color: "text-slate-300",  bg: "bg-slate-300/15",  border: "border-slate-300/30",  icon: "🥈", nextMin: 1400 },
  { tier: "Gold",        min: 1400, max: 1599, color: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400/30", icon: "🥇", nextMin: 1600 },
  { tier: "Platinum",    min: 1600, max: 1799, color: "text-cyan-400",   bg: "bg-cyan-400/15",   border: "border-cyan-400/30",   icon: "💠", nextMin: 1800 },
  { tier: "Diamond",     min: 1800, max: 1999, color: "text-blue-400",   bg: "bg-blue-400/15",   border: "border-blue-400/30",   icon: "💎", nextMin: 2000 },
  { tier: "Master",      min: 2000, max: 2199, color: "text-purple-400", bg: "bg-purple-400/15", border: "border-purple-400/30", icon: "🔮", nextMin: 2200 },
  { tier: "Grand Master",min: 2200, max: 9999, color: "text-primary",    bg: "bg-primary/15",    border: "border-primary/30",    icon: "👑", nextMin: null },
]

export function getTier(rating: number): TierInfo {
  return TIERS.findLast((t) => rating >= t.min) ?? TIERS[0]
}

export function getProgress(rating: number): number {
  const tier = getTier(rating)
  if (!tier.nextMin) return 100
  return Math.min(100, Math.round(((rating - tier.min) / (tier.nextMin - tier.min)) * 100))
}

// ELO change calculation (mirrors Supabase function)
export function calculateEloChange(playerRating: number, opponentRating: number, won: boolean, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  const actual = won ? 1 : 0
  return Math.round(k * (actual - expected))
}

export const MONGOLIAN_PROVINCES = [
  "Улаанбаатар",
  "Архангай",
  "Баян-Өлгий",
  "Баянхонгор",
  "Булган",
  "Говь-Алтай",
  "Говьсүмбэр",
  "Дархан-Уул",
  "Дорноговь",
  "Дорнод",
  "Дундговь",
  "Завхан",
  "Орхон",
  "Өвөрхангай",
  "Өмнөговь",
  "Сүхбаатар",
  "Сэлэнгэ",
  "Төв",
  "Увс",
  "Ховд",
  "Хөвсгөл",
  "Хэнтий",
] as const

export type Province = typeof MONGOLIAN_PROVINCES[number]
