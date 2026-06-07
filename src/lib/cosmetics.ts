// Cosmetic effect-ийн төрөл ба логик (каталог нь DB-д — cosmetic_effects)

export type Fit = "cover" | "contain" | "stretch"

export interface EffectRow {
  key: string
  name: string
  lottie_url: string
  xp: number
  fit: Fit
  scale: number
  scale_y: number
  offset_x: number
  offset_y: number
  scope: string
  pass_id: string | null
  is_active: boolean
  sort_order: number
}

export interface PassRow {
  id: string
  name: string
  starts_at: string | null
  ends_at: string | null
}

export interface XpStats {
  matches_played?: number
  matches_won?: number
  count_180?: number
  tournament_wins?: number
  avraga_wins?: number
}

// XP нь статистикаас тооцоологдоно
export function computeXp(s: XpStats): number {
  return (s.matches_played ?? 0) * 10
    + (s.matches_won ?? 0) * 15
    + (s.count_180 ?? 0) * 20
    + (s.tournament_wins ?? 0) * 100
    + (s.avraga_wins ?? 0) * 150
}

// Pass идэвхтэй (сезон нээлттэй) эсэх
export function isPassActive(p: PassRow | null | undefined, now = Date.now()): boolean {
  if (!p) return true // pass-гүй = үргэлж нээлттэй
  const s = p.starts_at ? new Date(p.starts_at).getTime() : -Infinity
  const e = p.ends_at ? new Date(p.ends_at).getTime() : Infinity
  return now >= s && now <= e
}

// Нээсэн effect-үүдэд зарцуулсан нийт XP
export function spentXp(ownedKeys: string[], effects: { key: string; xp: number }[]): number {
  const m = new Map(effects.map((e) => [e.key, e.xp]))
  return ownedKeys.reduce((sum, k) => sum + (m.get(k) ?? 0), 0)
}

export type EffectState = "owned" | "claimable" | "need_xp" | "need_sub" | "pass_closed"

export function effectState(
  e: { xp: number },
  ctx: { owned: boolean; isPremium: boolean; available: number; passActive: boolean }
): EffectState {
  if (ctx.owned) return "owned"
  if (!ctx.passActive) return "pass_closed"
  if (!ctx.isPremium) return "need_sub"
  if (ctx.available < e.xp) return "need_xp"
  return "claimable"
}
