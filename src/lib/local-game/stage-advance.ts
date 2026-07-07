import type { LocalSession, LocalMatch, LocalPlayer, LocalGroup, StandingRow, BracketType, GameFormat } from "./types"
import type {
  TournamentStage, GroupStageConfig, EliminationStageConfig,
  RoundRobinStageConfig, SwissStageConfig, SemiFinalStageConfig, FinalStageConfig,
} from "@/lib/tournament/stage-types"
import { computeStandings, type StandingMatch } from "@/lib/tournament/standings"
import { computePlayInPlan } from "@/lib/tournament/play-in"
import {
  generateSingleElimination, generateDoubleElimination,
  generateRoundRobin, generateGroupsKnockout, generateSwissRound1,
} from "./bracket"

// advance-stage/route.ts (online)-той ижил branching, гэхдээ Supabase-гүй, pure
// функцаар LocalSession дээр шууд ажиллана.

// Double Elimination бүтээх боломжтой мөн үү (клиг тоглолттой ч гэсэн) —
// bracket-server.ts::isDoubleEliminationEligible-тэй ижил зарчим.
function isDoubleEliminationEligible(n: number): boolean {
  return computePlayInPlan(n).targetSize >= 4
}

// LocalMatch → StandingMatch adapter — standings.ts-ийн computeStandings-г дахин ашиглана
function toStandingMatch(m: LocalMatch): StandingMatch {
  return {
    side1_entrant_id: m.player1Id && m.player1Id !== "bye" ? m.player1Id : null,
    side2_entrant_id: m.player2Id && m.player2Id !== "bye" ? m.player2Id : null,
    side1_legs: m.player1Legs,
    side2_legs: m.player2Legs,
    winner_entrant_id: m.winnerId,
    status: m.status,
  }
}

// Тухайн шатнаас дараагийн шатанд дэвших тоглогчдын id-г тодорхойлно
export function computeQualifiedPlayerIds(session: LocalSession, stageIndex: number): string[] {
  const stage = (session.stages ?? [])[stageIndex]
  if (!stage) return []
  const stageMatches = session.matches.filter((m) => (m.stageIndex ?? 0) === stageIndex)

  if (stage.stage_type === "group") {
    const c = stage.config as GroupStageConfig
    const advanceCount = Math.max(1, c.advance_count ?? 1)
    const stageGroups = (session.groups ?? []).filter((g) => (g.stageIndex ?? 0) === stageIndex)
    const qualified: string[] = []
    for (const group of stageGroups) {
      const gMatches = stageMatches.filter((m) => m.groupId === group.id)
      const standings = computeStandings(group.playerIds, gMatches.map(toStandingMatch))
      qualified.push(...standings.slice(0, advanceCount).map((s) => s.entrantId))
    }
    return qualified
  }

  if (stage.stage_type === "elimination") {
    // Double elimination-д round 200 бол Их Финал — тэрнийг л финал гэж үзнэ.
    // Single elimination-д round 200 байхгүй тул гол bracket-ын хамгийн сүүлийн round нь финал
    // (round 998 нь 3-р байрны тоглолт тул жинхэнэ финал биш, maxRound тооцооноос хасна).
    const grandFinalMs = stageMatches.filter((m) => m.round === 200)
    const finalMs = grandFinalMs.length
      ? grandFinalMs
      : (() => {
          const mainMs = stageMatches.filter((m) => !m.isLosersBracket && m.round < 200 && m.round !== 998)
          if (mainMs.length === 0) return []
          const maxRound = Math.max(...mainMs.map((m) => m.round))
          return mainMs.filter((m) => m.round === maxRound)
        })()
    return finalMs.map((m) => m.winnerId).filter((id): id is string => !!id)
  }

  if (stage.stage_type === "round_robin" || stage.stage_type === "swiss") {
    const c = stage.config as RoundRobinStageConfig | SwissStageConfig
    const advanceCount = Math.max(1, c.advance_count ?? 1)
    const allIds = [...new Set(
      stageMatches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id && id !== "bye")
    )]
    const standings = computeStandings(allIds, stageMatches.map(toStandingMatch))
    return standings.slice(0, advanceCount).map((s) => s.entrantId)
  }

  if (stage.stage_type === "semifinal") {
    // 3-р байрны тоглолт (round 998) дэмжигдээгүй (double-elim losers routing-той ижил хамрахгүй зүйл)
    const mainMs = stageMatches.filter((m) => m.round !== 998)
    if (mainMs.length === 0) return []
    const maxRound = Math.max(...mainMs.map((m) => m.round))
    return mainMs.filter((m) => m.round < maxRound).map((m) => m.winnerId).filter((id): id is string => !!id)
  }

  return []
}

// stage_type → local BracketType (Scoreboard/LiveView/SessionView-ийн одоо байгаа
// bracketType-суурьтай render/engine-г шат бүрт дахин ашиглана)
function stageTypeToBracketType(stage: TournamentStage): BracketType {
  if (stage.stage_type === "group") return "groups_knockout"
  if (stage.stage_type === "round_robin") return "round_robin"
  if (stage.stage_type === "swiss") return "swiss"
  if (stage.stage_type === "elimination") {
    const c = stage.config as EliminationStageConfig
    return (c.max_losses ?? 1) >= 2 ? "double_elimination" : "single_elimination"
  }
  // semifinal/final — жижиг single-elimination bracket-аар хэрэгжинэ
  return "single_elimination"
}

// Тухайн шатны төрөл/тохиргоо, тоглогчдын жагсаалтаас local bracket.ts-ийн
// generator-уудыг дуудаж match/group/standings үүсгэнэ — эхний (0-р) шат үүсгэхэд
// (SetupWizard) БОЛОН дараагийн шатанд шилжихэд (advanceToNextStage) хоёуланд нь
// ижил дараалалаар ашиглагдана.
export function buildStageMatches(
  stage: TournamentStage,
  seededPlayers: LocalPlayer[]
): { matches: LocalMatch[]; groups: LocalGroup[]; standings: Record<string, StandingRow> } | { error: string } {
  let matches: LocalMatch[] = []
  let groups: LocalGroup[] = []
  let standings: Record<string, StandingRow> = {}

  if (stage.stage_type === "group") {
    const c = stage.config as GroupStageConfig
    const gk = generateGroupsKnockout(seededPlayers, Math.max(2, c.groups_count), Math.max(1, c.advance_count))
    matches = gk.matches.filter((m) => m.round < 100)
    groups = gk.groups
    standings = gk.standings
  } else if (stage.stage_type === "elimination") {
    const c = stage.config as EliminationStageConfig
    if ((c.max_losses ?? 1) >= 2) {
      if (!isDoubleEliminationEligible(seededPlayers.length)) return { error: "Double elimination-д хамгийн багадаа 3 оролцогч хэрэгтэй" }
      matches = generateDoubleElimination(seededPlayers)
    } else {
      matches = generateSingleElimination(seededPlayers, c.has_third_place)
    }
  } else if (stage.stage_type === "round_robin") {
    const rr = generateRoundRobin(seededPlayers)
    matches = rr.matches
    standings = rr.standings
  } else if (stage.stage_type === "swiss") {
    const sw = generateSwissRound1(seededPlayers)
    matches = sw.matches
    standings = sw.standings
  } else if (stage.stage_type === "semifinal") {
    if (seededPlayers.length !== 4) return { error: "Хагас финалд яг 4 тоглогч хэрэгтэй" }
    const c = stage.config as SemiFinalStageConfig
    matches = generateSingleElimination(seededPlayers, c.has_third_place)
  } else if (stage.stage_type === "final") {
    if (seededPlayers.length !== 2) return { error: "Финалд яг 2 тоглогч хэрэгтэй" }
    matches = generateSingleElimination(seededPlayers)
  } else {
    return { error: "Дэмжигдээгүй шатны төрөл" }
  }

  return { matches, groups, standings }
}

// Шинэ идэвхтэй шатны дүрмүүдийг session-ий "flat" талбаруудад буулгана (Scoreboard/
// LiveView/localX01Config эдгээр талбаруудыг л уншдаг тул шат бүрд дахин бичнэ)
export function buildSessionPatch(stage: TournamentStage): Partial<LocalSession> {
  const cfg = stage.config
  let firstTo = 2, setsEnabled = false, legsPerSet = 3
  let groupsCount: number | undefined, groupAdvance: number | undefined
  let pointWon = 2, pointDraw = 1, pointLost = 0, enableDraw = false
  let hasThirdPlace = false

  if (stage.stage_type === "group") {
    const c = cfg as GroupStageConfig
    firstTo = c.rr_first_to
    groupsCount = c.groups_count
    groupAdvance = c.advance_count
    enableDraw = c.enable_draw
  } else if (stage.stage_type === "elimination") {
    const c = cfg as EliminationStageConfig
    firstTo = c.first_to; setsEnabled = c.sets_enabled; legsPerSet = c.legs_per_set
    hasThirdPlace = c.has_third_place
  } else if (stage.stage_type === "round_robin") {
    const c = cfg as RoundRobinStageConfig
    firstTo = c.first_to; setsEnabled = c.sets_enabled; legsPerSet = c.legs_per_set
    pointWon = c.point_won; pointDraw = c.point_draw; pointLost = c.point_lost; enableDraw = c.enable_draw
  } else if (stage.stage_type === "swiss") {
    const c = cfg as SwissStageConfig
    firstTo = c.first_to
  } else if (stage.stage_type === "semifinal") {
    const c = cfg as SemiFinalStageConfig
    firstTo = c.first_to; setsEnabled = c.sets_enabled; legsPerSet = c.legs_per_set
    hasThirdPlace = c.has_third_place
  } else if (stage.stage_type === "final") {
    const c = cfg as FinalStageConfig
    firstTo = c.first_to; setsEnabled = c.sets_enabled; legsPerSet = c.legs_per_set
  }

  return {
    bracketType: stageTypeToBracketType(stage),
    format: cfg.format as GameFormat,
    startScore: cfg.start_score,
    doubleOut: cfg.double_out,
    doubleIn: cfg.double_in,
    loserFirst: cfg.loser_first,
    limitRounds: cfg.limit_rounds,
    bullFinishAtLimit: cfg.bull_finish_at_limit,
    thirdPlaceMatch: hasThirdPlace,
    firstTo, setsEnabled, legsPerSet,
    rrFirstTo: firstTo, rrSetsEnabled: setsEnabled, rrLegsPerSet: legsPerSet, rrEnableDraw: enableDraw,
    ...(groupsCount !== undefined ? { groupsCount } : {}),
    ...(groupAdvance !== undefined ? { groupAdvance } : {}),
    pointWon, pointDraw, pointLost, enableDraw,
    phase: "in_session",
  }
}

export interface StageAdvanceResult {
  matches: LocalMatch[]
  groups: LocalGroup[]
  standings: Record<string, StandingRow>
  stages: TournamentStage[]
  currentStageIndex: number
  sessionPatch: Partial<LocalSession>
}

export function advanceToNextStage(session: LocalSession): StageAdvanceResult | { error: string } {
  const stages = session.stages ?? []
  const currentIdx = session.currentStageIndex ?? 0
  const nextIdx = currentIdx + 1
  const nextStage = stages[nextIdx]
  if (!nextStage) return { error: "Сүүлийн шат байна" }

  const currentStageMatches = session.matches.filter((m) => (m.stageIndex ?? 0) === currentIdx)
  const unfinished = currentStageMatches.filter((m) =>
    m.status !== "completed" && m.player1Id && m.player2Id && m.player1Id !== "bye" && m.player2Id !== "bye"
  )
  if (unfinished.length > 0) return { error: `${unfinished.length} тоглолт дуусаагүй байна` }

  const qualifiedIds = computeQualifiedPlayerIds(session, currentIdx)
  if (qualifiedIds.length < 2) return { error: `Дараагийн шатанд хангалттай тоглогч байхгүй (${qualifiedIds.length})` }

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const seededPlayers: LocalPlayer[] = qualifiedIds
    .map((id) => playerMap[id])
    .filter((p): p is LocalPlayer => !!p)
    .map((p, i) => ({ ...p, seed: i + 1 }))

  const built = buildStageMatches(nextStage, seededPlayers)
  if ("error" in built) return built

  const newMatches = built.matches.map((m) => ({ ...m, stageIndex: nextIdx }))
  const newGroups = built.groups.map((g) => ({ ...g, stageIndex: nextIdx }))
  const newStandings = built.standings

  const updatedStages = stages.map((s, i) =>
    i === currentIdx ? { ...s, status: "completed" as const }
      : i === nextIdx ? { ...s, status: "active" as const }
        : s
  )

  return {
    matches: [...session.matches, ...newMatches],
    groups: [...session.groups, ...newGroups],
    standings: { ...session.standings, ...newStandings },
    stages: updatedStages,
    currentStageIndex: nextIdx,
    sessionPatch: buildSessionPatch(nextStage),
  }
}
