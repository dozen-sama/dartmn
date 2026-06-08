// Клубын зэрэглэл — club_score-оос хамаарна. Неон хүрээний өнгийг тодорхойлно.
export interface ClubTier {
  key: string
  name: string
  color: string // неон өнгө
  min: number
}

export const CLUB_TIERS: ClubTier[] = [
  { key: "bronze", name: "Хүрэл", color: "#d08a4a", min: 0 },
  { key: "silver", name: "Мөнгө", color: "#cbd5e1", min: 500 },
  { key: "gold", name: "Алт", color: "#f5c542", min: 1500 },
  { key: "diamond", name: "Алмаз", color: "#34d3ee", min: 3000 },
  { key: "master", name: "Мастер", color: "#b06cff", min: 6000 },
]

export function getClubTier(score: number): ClubTier {
  let tier = CLUB_TIERS[0]
  for (const t of CLUB_TIERS) {
    if (score >= t.min) tier = t
  }
  return tier
}

export function clubTierIndex(score: number): number {
  return CLUB_TIERS.findIndex((t) => t.key === getClubTier(score).key)
}

// Tag өнгө бүр клубын цолоор нээгдэнэ (tier = шаардлагатай зэрэглэлийн index)
export interface TagColor { label: string; value: string; tier: number }
export const CLUB_TAG_COLORS: TagColor[] = [
  { label: "Цэнхэр", value: "#34d3ee", tier: 0 },
  { label: "Хөх", value: "#4da3ff", tier: 0 },
  { label: "Ногоон", value: "#34d399", tier: 1 },
  { label: "Алт", value: "#f5c542", tier: 1 },
  { label: "Нил", value: "#b06cff", tier: 2 },
  { label: "Ягаан", value: "#ff6ec7", tier: 2 },
  { label: "Улбар шар", value: "#ff8a1f", tier: 3 },
  { label: "Улаан", value: "#ff4d4d", tier: 3 },
]

// Тухайн өнгийг клубын score-оор нээх боломжтой эсэх (server validation)
export function isTagColorUnlocked(color: string | null, score: number): boolean {
  if (!color) return true // default (өнгөгүй) үргэлж зөвшөөрнө
  const c = CLUB_TAG_COLORS.find((x) => x.value.toLowerCase() === color.toLowerCase())
  if (!c) return false // мэдэгдэхгүй өнгө — зөвшөөрөхгүй
  return c.tier <= clubTierIndex(score)
}
