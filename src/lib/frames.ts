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

// Customize — нэрний өнгөний бэлэн сонголтууд
export const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Үндсэн", value: "" },
  { label: "Цагаан", value: "#ffffff" },
  { label: "Алт", value: "#f5c542" },
  { label: "Улбар шар", value: "#ff8a1f" },
  { label: "Улаан", value: "#ff4d4d" },
  { label: "Ягаан", value: "#ff6ec7" },
  { label: "Нил", value: "#a855f7" },
  { label: "Цэнхэр", value: "#4da3ff" },
  { label: "Цайвар цэнхэр", value: "#22d3ee" },
  { label: "Ногоон", value: "#34d399" },
  { label: "Лайм", value: "#a3e635" },
  { label: "Хар саарал", value: "#cbd5e1" },
]

// Customize — фонтын сонголтууд
export const FONT_OPTIONS: { key: string; label: string }[] = [
  { key: "", label: "Энгийн" },
  { key: "oswald", label: "Oswald" },
  { key: "russo", label: "Russo" },
  { key: "montserrat", label: "Montserrat" },
  { key: "rubik", label: "Rubik" },
  { key: "exo2", label: "Exo 2" },
  { key: "mono", label: "Моно" },
]

export function isUnlocked(rule: UnlockRule, ctx: UnlockContext): boolean {
  switch (rule.type) {
    case "free": return true
    case "rating": return (ctx.rating ?? 0) >= rule.min
    case "subscription": return !!ctx.isPremium
    case "verified": return !!ctx.isVerified
  }
}

export function isFrameUnlocked(f: FrameDef, ctx: UnlockContext): boolean {
  return isUnlocked(f.unlock, ctx)
}

// ===== XP — статистикаас тооцоолно =====
export interface XpStats {
  matches_played?: number
  matches_won?: number
  count_180?: number
  tournament_wins?: number
  avraga_wins?: number
}

export function computeXp(s: XpStats): number {
  return (s.matches_played ?? 0) * 10
    + (s.matches_won ?? 0) * 15
    + (s.count_180 ?? 0) * 20
    + (s.tournament_wins ?? 0) * 100
    + (s.avraga_wins ?? 0) * 150
}

// ===== Animation effect-үүд (хүрээнээс хамааралгүй, тусдаа сонгоно) =====
// Шинэ effect нэмэх: /public/lottie/<key>.json файл тавиад энд бичнэ.
// xp = нээхэд шаардлагатай XP (subscription заавал). 0 = үнэгүй.
export interface EffectDef {
  key: string
  name: string
  file: string // /public доторх Lottie зам ("" = байхгүй)
  xp: number
}

export const EFFECTS: EffectDef[] = [
  { key: "none", name: "Байхгүй", file: "", xp: 0 },
  { key: "campfire", name: "Бамбар", file: "/lottie/campfire.json", xp: 300 },
  { key: "fire", name: "Гал", file: "/lottie/fire.json", xp: 500 },
  { key: "lightning1", name: "Цахилгаан 1", file: "/lottie/lightning1.json", xp: 700 },
  { key: "lightning2", name: "Цахилгаан 2", file: "/lottie/lightning2.json", xp: 700 },
  { key: "lightning3", name: "Цахилгаан 3", file: "/lottie/lightning3.json", xp: 700 },
  { key: "neon", name: "Неон", file: "/lottie/neon.json", xp: 900 },
  { key: "wave", name: "Долгион", file: "/lottie/wave.json", xp: 1000 },
  { key: "rainbow", name: "Солонго", file: "/lottie/rainbow.json", xp: 1200 },
  { key: "fx14", name: "FX 14", file: "/lottie/fx14.json", xp: 1500 },
  { key: "fxa", name: "Эффект A", file: "/lottie/fxa.json", xp: 600 },
  { key: "fxb", name: "Эффект B", file: "/lottie/fxb.json", xp: 600 },
  { key: "fxc", name: "Эффект C", file: "/lottie/fxc.json", xp: 600 },
  { key: "fxd", name: "Эффект D", file: "/lottie/fxd.json", xp: 600 },
  { key: "fxe", name: "Эффект E", file: "/lottie/fxe.json", xp: 600 },
  { key: "fxf", name: "Эффект F", file: "/lottie/fxf.json", xp: 600 },
]

export function getEffect(key?: string | null): EffectDef | undefined {
  if (!key) return undefined
  return EFFECTS.find((e) => e.key === key)
}

// Нээсэн effect-үүдэд зарцуулсан нийт XP
export function spentXp(ownedKeys: string[]): number {
  return ownedKeys.reduce((sum, k) => sum + (getEffect(k)?.xp ?? 0), 0)
}

// Effect-ийн төлөв (дэлгүүр логик — available = олсон - зарцуулсан)
export type EffectState = "owned" | "claimable" | "need_xp" | "need_sub"

export function effectState(e: EffectDef, ctx: { owned: boolean; isPremium: boolean; available: number }): EffectState {
  if (e.key === "none" || ctx.owned) return "owned"
  if (!ctx.isPremium) return "need_sub"
  if (ctx.available < e.xp) return "need_xp"
  return "claimable"
}
