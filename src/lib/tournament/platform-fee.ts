export function computePlatformFee(bracketType: string, maxPlayers: number): number {
  if (bracketType === "single_elimination") {
    if (maxPlayers <= 8) return 0
    if (maxPlayers <= 16) return 5000
    return 8000
  }
  if (bracketType === "double_elimination") return 8000
  if (bracketType === "round_robin" || bracketType === "swiss") return 8000
  if (bracketType === "groups_knockout") return 10000
  return 0
}

export const PLATFORM_FEE_LABELS: Record<string, string> = {
  single_elimination: "SE",
  double_elimination: "DE",
  round_robin: "RR",
  swiss: "Swiss",
  groups_knockout: "Groups+KO",
}
