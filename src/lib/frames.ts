// Cosmetic nameplate frames — каталог нь кодод, нээлт нь статистикаас динамикаар тооцоологдоно

export type FrameScope = "profile" | "club"

export type UnlockRule =
  | { type: "free" }
  | { type: "rating"; min: number }
  | { type: "subscription" }
  | { type: "verified" }

export interface FrameDef {
  key: string
  name: string
  scope: FrameScope
  theme: string // globals.css дахь np-<theme> класс
  emoji?: string
  unlock: UnlockRule
  desc: string
}

export const PROFILE_FRAMES: FrameDef[] = [
  { key: "none", name: "Энгийн", scope: "profile", theme: "none", unlock: { type: "free" }, desc: "Бүгдэд нээлттэй" },
  { key: "bronze", name: "Хүрэл", scope: "profile", theme: "bronze", unlock: { type: "rating", min: 1200 }, desc: "Рейтинг 1200+" },
  { key: "silver", name: "Мөнгө", scope: "profile", theme: "silver", unlock: { type: "rating", min: 1500 }, desc: "Рейтинг 1500+" },
  { key: "gold", name: "Алт", scope: "profile", theme: "gold", unlock: { type: "rating", min: 2000 }, desc: "Рейтинг 2000+" },
  { key: "electric", name: "Аянга", scope: "profile", theme: "electric", emoji: "⚡", unlock: { type: "subscription" }, desc: "Subscription" },
  { key: "inferno", name: "Инферно", scope: "profile", theme: "inferno", emoji: "🔥", unlock: { type: "subscription" }, desc: "Subscription" },
  { key: "champion", name: "Аварга", scope: "profile", theme: "champion", emoji: "👑", unlock: { type: "subscription" }, desc: "Subscription" },
  { key: "premium", name: "Premium", scope: "profile", theme: "premium", emoji: "✨", unlock: { type: "subscription" }, desc: "Subscription" },
  { key: "legend", name: "Домог", scope: "profile", theme: "legend", emoji: "🏅", unlock: { type: "subscription" }, desc: "Subscription" },
]

export const CLUB_FRAMES: FrameDef[] = [
  { key: "club_none", name: "Энгийн", scope: "club", theme: "none", unlock: { type: "free" }, desc: "Бүгдэд нээлттэй" },
  { key: "club_verified", name: "Verified", scope: "club", theme: "verified", emoji: "✔", unlock: { type: "verified" }, desc: "Баталгаажсан клуб" },
  { key: "club_electric", name: "Аянга", scope: "club", theme: "electric", emoji: "⚡", unlock: { type: "subscription" }, desc: "Subscription" },
  { key: "club_inferno", name: "Гал", scope: "club", theme: "inferno", emoji: "🔥", unlock: { type: "subscription" }, desc: "Subscription" },
  { key: "club_premium", name: "Pro", scope: "club", theme: "premium", emoji: "✨", unlock: { type: "subscription" }, desc: "Subscription" },
]

const ALL_FRAMES = [...PROFILE_FRAMES, ...CLUB_FRAMES]

export function getFrame(key?: string | null): FrameDef | undefined {
  if (!key) return undefined
  return ALL_FRAMES.find((f) => f.key === key)
}

export interface UnlockContext {
  rating?: number
  isPremium?: boolean
  isVerified?: boolean
}

export function isFrameUnlocked(f: FrameDef, ctx: UnlockContext): boolean {
  switch (f.unlock.type) {
    case "free": return true
    case "rating": return (ctx.rating ?? 0) >= f.unlock.min
    case "subscription": return !!ctx.isPremium
    case "verified": return !!ctx.isVerified
  }
}
