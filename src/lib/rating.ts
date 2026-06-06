export type RatingTier =
  | "Залуу"
  | "Начин"
  | "Харцага"
  | "Заан"
  | "Гарьд"
  | "Арслан"
  | "Дархан"

export interface TierInfo {
  tier: RatingTier
  min: number
  max: number
  color: string
  bg: string
  border: string
  icon: string
  nextMin: number | null
  description: string
}

export const TIERS: TierInfo[] = [
  {
    tier: "Залуу",
    min: 0,    max: 999,
    color: "text-slate-400",
    bg: "bg-slate-400/15",
    border: "border-slate-400/30",
    icon: "🎯",
    nextMin: 1000,
    description: "Шинэхэн тоглогч",
  },
  {
    tier: "Начин",
    min: 1000, max: 1199,
    color: "text-sky-400",
    bg: "bg-sky-400/15",
    border: "border-sky-400/30",
    icon: "🦅",
    nextMin: 1200,
    description: "Хурдан, оновчтой",
  },
  {
    tier: "Харцага",
    min: 1200, max: 1399,
    color: "text-emerald-400",
    bg: "bg-emerald-400/15",
    border: "border-emerald-400/30",
    icon: "🦆",
    nextMin: 1400,
    description: "Хурц нүдтэй",
  },
  {
    tier: "Заан",
    min: 1400, max: 1599,
    color: "text-amber-500",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    icon: "🐘",
    nextMin: 1600,
    description: "Хүчтэй, тогтвортой",
  },
  {
    tier: "Гарьд",
    min: 1600, max: 1799,
    color: "text-orange-400",
    bg: "bg-orange-400/15",
    border: "border-orange-400/30",
    icon: "⚡",
    nextMin: 1800,
    description: "Домгийн шувуу",
  },
  {
    tier: "Арслан",
    min: 1800, max: 2099,
    color: "text-red-400",
    bg: "bg-red-400/15",
    border: "border-red-400/30",
    icon: "🦁",
    nextMin: 2100,
    description: "Хаан зэргийн тоглогч",
  },
  {
    tier: "Дархан",
    min: 2100, max: 9999,
    color: "text-yellow-400",
    bg: "bg-yellow-400/15",
    border: "border-yellow-400/30",
    icon: "👑",
    nextMin: null,
    description: "Дархан мэргэн",
  },
]

// Аврага шатлал — 32+ тоглогчтой тэмцээн хожсон тоогоороо
export interface AvragaTitle {
  label: string
  icon: string
  color: string
  bg: string
  border: string
  minWins: number
}

export const AVRAGA_TITLES: AvragaTitle[] = [
  { minWins: 1,  label: "Аврага",        icon: "🏆", color: "text-amber-400",  bg: "bg-amber-400/15",  border: "border-amber-400/40"  },
  { minWins: 3,  label: "Улсын Аврага",  icon: "🏆", color: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400/40" },
  { minWins: 5,  label: "Далай Аврага",  icon: "🏆", color: "text-cyan-300",   bg: "bg-cyan-300/15",   border: "border-cyan-300/40"   },
  { minWins: 8,  label: "Даян Аврага",   icon: "🏆", color: "text-violet-400", bg: "bg-violet-400/15", border: "border-violet-400/40" },
  { minWins: 12, label: "Дархан Аврага", icon: "🏆", color: "text-yellow-300", bg: "bg-yellow-300/15", border: "border-yellow-300/50"  },
]

export function getAvragaTitle(avragaWins: number): AvragaTitle | null {
  if (avragaWins <= 0) return null
  return [...AVRAGA_TITLES].reverse().find((t) => avragaWins >= t.minWins) ?? null
}

export function getTier(rating: number): TierInfo {
  return TIERS.findLast((t) => rating >= t.min) ?? TIERS[0]
}

export function getProgress(rating: number): number {
  const tier = getTier(rating)
  if (!tier.nextMin) return 100
  return Math.min(100, Math.round(((rating - tier.min) / (tier.nextMin - tier.min)) * 100))
}

export function calculateEloChange(playerRating: number, opponentRating: number, won: boolean, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  const actual = won ? 1 : 0
  return Math.round(k * (actual - expected))
}

export { PROVINCE_NAMES as MONGOLIAN_PROVINCES } from "./provinces"
