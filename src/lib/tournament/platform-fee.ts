import type { StageType, StageConfig, EliminationStageConfig } from "./stage-types"

export function computeMultiStageFee(
  stages: { stage_type: StageType; config: StageConfig }[],
  maxPlayers: number,
): number {
  if (stages.some((s) => s.stage_type === "group")) return 10000
  if (stages.some((s) => s.stage_type === "round_robin")) return 8000
  if (stages.some((s) => s.stage_type === "swiss")) return 8000
  if (stages.some((s) => s.stage_type === "elimination" && (s.config as EliminationStageConfig).max_losses >= 2)) return 8000
  // SE / semifinal / final only
  if (maxPlayers <= 8) return 0
  if (maxPlayers <= 16) return 5000
  return 8000
}

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
