// Multi-stage tournament pipeline types.
// Шат бүрийн тохиргоо, pipeline validation, player flow тооцоо.

export type StageType = "group" | "elimination" | "round_robin" | "swiss" | "semifinal" | "final"

export type GameFormat = "501" | "301" | "170"

// ── Нийтлэг тоглолтын дүрэм (шат бүрт тусдаа) ───────────────────────────────

export interface GameRules {
  format: GameFormat
  start_score: number
  double_out: boolean
  double_in: boolean
  loser_first: boolean
  limit_rounds: number | null
  bull_finish_at_limit: boolean
}

const DEFAULT_GAME_RULES: GameRules = {
  format: "501",
  start_score: 501,
  double_out: true,
  double_in: false,
  loser_first: false,
  limit_rounds: null,
  bull_finish_at_limit: false,
}

// ── Stage config types ────────────────────────────────────────────────────────

export interface GroupStageConfig extends GameRules {
  groups_count: number       // бүлгийн тоо (2–16)
  players_per_group: number  // бүлэг бүрт хэдэн тоглогч (3–16)
  advance_count: number      // бүлгээс гарах тоглогчийн тоо
  rr_first_to: number        // бүлгийн доторх тоглолт (first to N legs)
  enable_draw: boolean
}

export interface EliminationStageConfig extends GameRules {
  max_losses: number         // хэдэн хожигдоод хасагдах (1=SE, 2=DE, 3+)
  has_third_place: boolean
  first_to: number
  sets_enabled: boolean
  legs_per_set: number
}

export interface RoundRobinStageConfig extends GameRules {
  first_to: number
  sets_enabled: boolean
  legs_per_set: number
  point_won: number
  point_draw: number
  point_lost: number
  advance_count: number      // 0 = тэмцээн дуусна (финал)
  enable_draw: boolean
}

export interface SwissStageConfig extends GameRules {
  rounds_count: number
  first_to: number
  advance_count: number      // 0 = тэмцээн дуусна
}

export interface SemiFinalStageConfig extends GameRules {
  first_to: number
  sets_enabled: boolean
  legs_per_set: number
  has_third_place: boolean   // 3-р байрны тоглолт (default: true)
}

export interface FinalStageConfig extends GameRules {
  first_to: number
  sets_enabled: boolean
  legs_per_set: number
}

export type StageConfig =
  | GroupStageConfig
  | EliminationStageConfig
  | RoundRobinStageConfig
  | SwissStageConfig
  | SemiFinalStageConfig
  | FinalStageConfig

// ── Stage definition ─────────────────────────────────────────────────────────

export interface TournamentStage {
  id: string
  tournament_id: string
  order_no: number
  stage_type: StageType
  config: StageConfig
  status: "pending" | "active" | "completed"
}

// ── Default configs ───────────────────────────────────────────────────────────

export const DEFAULT_CONFIGS: Record<StageType, StageConfig> = {
  group: {
    ...DEFAULT_GAME_RULES,
    groups_count: 4,
    players_per_group: 4,
    advance_count: 2,
    rr_first_to: 2,
    enable_draw: false,
  } satisfies GroupStageConfig,
  elimination: {
    ...DEFAULT_GAME_RULES,
    max_losses: 1,
    has_third_place: false,
    first_to: 2,
    sets_enabled: false,
    legs_per_set: 3,
  } satisfies EliminationStageConfig,
  round_robin: {
    ...DEFAULT_GAME_RULES,
    first_to: 2,
    sets_enabled: false,
    legs_per_set: 3,
    point_won: 2,
    point_draw: 1,
    point_lost: 0,
    advance_count: 0,
    enable_draw: false,
  } satisfies RoundRobinStageConfig,
  swiss: {
    ...DEFAULT_GAME_RULES,
    rounds_count: 4,
    first_to: 2,
    advance_count: 0,
  } satisfies SwissStageConfig,
  semifinal: {
    ...DEFAULT_GAME_RULES,
    first_to: 2,
    sets_enabled: false,
    legs_per_set: 3,
    has_third_place: true,
  } satisfies SemiFinalStageConfig,
  final: {
    ...DEFAULT_GAME_RULES,
    first_to: 3,
    sets_enabled: false,
    legs_per_set: 3,
  } satisfies FinalStageConfig,
}

export const STAGE_LABELS: Record<StageType, string> = {
  group:       "Хэсгийн шат",
  elimination: "Хасагдах шат",
  round_robin: "Тойрог",
  swiss:       "Свисс",
  semifinal:   "Хагас финал",
  final:       "Финал",
}

export const STAGE_ICONS: Record<StageType, string> = {
  group:       "🏟",
  elimination: "⚔️",
  round_robin: "🔄",
  swiss:       "🇨🇭",
  semifinal:   "4️⃣",
  final:       "🏆",
}

// ── Player flow calculator ────────────────────────────────────────────────────

export interface StageFlow {
  stageType: StageType
  playersIn: number
  playersOut: number   // 0 = тэмцээн дуусна (финал)
  matchCount: number
  description: string
}

export function calculatePlayerFlow(
  stages: { stage_type: StageType; config: StageConfig }[],
  initialPlayers: number
): StageFlow[] {
  let current = initialPlayers
  return stages.map(({ stage_type, config }) => {
    let out = 0
    let matches = 0
    let desc = ""

    if (stage_type === "group") {
      const c = config as GroupStageConfig
      out = c.groups_count * c.advance_count
      matches = c.groups_count * Math.round(c.players_per_group * (c.players_per_group - 1) / 2)
      desc = `${c.groups_count} бүлэг × ${c.players_per_group} тоглогч, дээрээс ${c.advance_count} дэвших`
    } else if (stage_type === "elimination") {
      const c = config as EliminationStageConfig
      out = 1
      if (c.max_losses === 1) {
        matches = current - 1 + (c.has_third_place ? 1 : 0)
        desc = `Single Elimination${c.has_third_place ? " + 3-р байр" : ""}`
      } else if (c.max_losses === 2) {
        matches = (current - 1) * 2 + (c.has_third_place ? 1 : 0)
        desc = `Double Elimination${c.has_third_place ? " + 3-р байр" : ""}`
      } else {
        matches = current * c.max_losses
        desc = `${c.max_losses} хожигдоод хасагдах`
      }
    } else if (stage_type === "round_robin") {
      const c = config as RoundRobinStageConfig
      out = c.advance_count || 0
      matches = Math.round(current * (current - 1) / 2)
      desc = c.advance_count > 0 ? `Бүгд нэг нэгтэйгээ, дээрээс ${c.advance_count} дэвших` : "Бүгд нэг нэгтэйгээ (финал)"
    } else if (stage_type === "swiss") {
      const c = config as SwissStageConfig
      out = c.advance_count || 0
      matches = current * c.rounds_count / 2
      desc = `${c.rounds_count} Swiss тойрог${c.advance_count > 0 ? `, дээрээс ${c.advance_count} дэвших` : ""}`
    } else if (stage_type === "semifinal") {
      const c = config as SemiFinalStageConfig
      out = 1
      matches = 2 + 1 + (c.has_third_place ? 1 : 0) // 2 хагас финал + 1 финал + 3-р байр
      desc = `4 тоглогч → 2 хагас финал → финал${c.has_third_place ? " + 3-р байр" : ""}`
    } else if (stage_type === "final") {
      out = 1
      matches = 1
      desc = "2 тоглогч → финал"
    }

    const flow: StageFlow = { stageType: stage_type, playersIn: current, playersOut: out, matchCount: matches, description: desc }
    current = out
    return flow
  })
}

// ── Pipeline validator ────────────────────────────────────────────────────────

export interface ValidationError {
  stageIndex: number
  message: string
}

export function validatePipeline(
  stages: { stage_type: StageType; config: StageConfig }[],
  initialPlayers: number
): ValidationError[] {
  const errors: ValidationError[] = []
  if (stages.length === 0) {
    errors.push({ stageIndex: -1, message: "Хамгийн багадаа нэг шат байх ёстой" })
    return errors
  }

  const flow = calculatePlayerFlow(stages, initialPlayers)

  stages.forEach(({ stage_type, config }, i) => {
    const playersIn = flow[i].playersIn

    if (stage_type === "group") {
      const c = config as GroupStageConfig
      if (playersIn < c.groups_count * 2) errors.push({ stageIndex: i, message: `${c.groups_count} бүлэгт хамгийн багадаа ${c.groups_count * 2} тоглогч хэрэгтэй` })
      if (c.advance_count >= c.players_per_group) errors.push({ stageIndex: i, message: "Дэвших тоо нь бүлгийн хүн тооноос бага байх ёстой" })
    }
    if (stage_type === "elimination") {
      if (playersIn < 2) errors.push({ stageIndex: i, message: "Хасагдах шатанд хамгийн багадаа 2 тоглогч хэрэгтэй" })
    }
    if (stage_type === "round_robin" || stage_type === "swiss") {
      if (playersIn < 2) errors.push({ stageIndex: i, message: "Хамгийн багадаа 2 тоглогч хэрэгтэй" })
    }
    if (stage_type === "semifinal") {
      if (playersIn !== 4) errors.push({ stageIndex: i, message: "Хагас финалд яг 4 тоглогч хэрэгтэй" })
    }
    if (stage_type === "final") {
      if (playersIn !== 2) errors.push({ stageIndex: i, message: "Финалд яг 2 тоглогч хэрэгтэй" })
    }

    if (i < stages.length - 1 && flow[i].playersOut === 0) {
      errors.push({ stageIndex: i, message: "Энэ шатнаас дэвших тоглогч 0 байна — дараагийн шатанд хүн байхгүй" })
    }
  })

  return errors
}
