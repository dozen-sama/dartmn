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
