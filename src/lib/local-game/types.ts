import type { TournamentStage } from "@/lib/tournament/stage-types"

export type GameFormat = "501" | "301" | "170" | "121"
export type BracketType = "single_elimination" | "double_elimination" | "round_robin" | "groups_knockout" | "swiss"
export type MatchStatus = "pending" | "ongoing" | "completed"

// n01darts-style phase flow
export type SessionPhase =
  | "preparing"         // Step 2: settings
  | "accepting_entries" // Step 3: adding players
  | "making_bracket"    // Step 4: bracket editor
  | "in_session"        // Step 5: tournament running
  | "completed"
  // legacy (backward compat)
  | "setup" | "group_stage" | "knockout"

export interface LocalPlayer {
  id: string
  name: string
  seed: number
  profileId?: string | null      // DartMN user ID (холбогдсон бол)
  profileUsername?: string | null // @username
  avatarUrl?: string | null
}

export interface LegThrow {
  score: number
  remaining: number
  darts: number
  bust?: boolean   // bust бол оноо тоологдохгүй (remaining ээлжийн эхэнд буцна)
}

export interface LocalLeg {
  legNumber: number
  throws: Record<string, LegThrow[]>
  winnerId: string | null
  startedAt: string
  starterId: string | null  // энэ leg-ийг эхэлсэн тоглогч — match-stat-details-ийн Keep/Break-д
}

export interface LocalMatch {
  id: string
  round: number
  matchNumber: number
  groupId?: string
  player1Id: string | "bye" | null
  player2Id: string | "bye" | null
  player1Legs: number
  player2Legs: number
  player1Sets: number
  player2Sets: number
  winnerId: string | null
  loserId: string | null
  status: MatchStatus
  legs: LocalLeg[]
  isLosersBracket?: boolean
  nextMatchId?: string | null
  nextLoserMatchId?: string | null
  stageIndex?: number  // олон шаттай session-д: session.stages[stageIndex]-д харьяалагдана
}

export interface LocalGroup {
  id: string
  name: string
  playerIds: string[]
  stageIndex?: number  // олон шаттай session-д: session.stages[stageIndex]-д харьяалагдана
}

export interface StandingRow {
  playerId: string
  played: number
  won: number
  lost: number
  legsWon: number
  legsLost: number
  points: number
}

export interface LocalSession {
  id: string
  name: string
  joinPassword: string
  joinCode?: string          // 6-char share code → /local/join/[code]
  description: string
  createdAt: string
  updatedAt: string

  // Game format
  format: GameFormat
  startScore: number

  // RR match format (Round Robin phase)
  rrFirstTo: number
  rrSetsEnabled: boolean
  rrLegsPerSet: number
  rrEnableDraw: boolean
  rrSchedule: boolean

  // KO match format (Knockout / SE phase)
  firstTo: number           // legacy + KO
  setsEnabled: boolean
  legsPerSet: number

  doubleOut: boolean
  doubleIn: boolean
  loserFirst: boolean
  limitRounds: number | null
  bullFinishAtLimit: boolean  // limit хүрмэгц зөвхөн Bull finish шаарддаг
  thirdPlaceMatch: boolean

  // Options
  showAverage: boolean
  autoComplete: boolean
  allowParticipantScore: boolean
  showIndex: boolean
  enableDraw: boolean

  // Point system
  pointWon: number
  pointDraw: number
  pointLost: number
  winPointsAreLegs: boolean

  // Bracket config
  bracketType: BracketType
  playersPerGroup: number     // n01darts: players per group
  groupsCount: number
  groupAdvance: number

  // Concurrent matches per group
  concurrentMatchesPerGroup: Record<string, number>

  players: LocalPlayer[]
  matches: LocalMatch[]
  groups: LocalGroup[]
  standings: Record<string, StandingRow>

  phase: SessionPhase
  status: "active" | "completed"
  winnerId: string | null

  // Олон шаттай тэмцээн (сонголтоор) — байхгүй/хоосон бол ганц-bracket горим
  stages?: TournamentStage[]
  currentStageIndex?: number
}

export interface SessionSummary {
  id: string
  name: string
  format: GameFormat
  bracketType: BracketType
  playerCount: number
  phase: SessionPhase
  status: "active" | "completed"
  createdAt: string
  winnerId: string | null
  winnerName?: string
}
