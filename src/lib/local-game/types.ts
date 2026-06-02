export type GameFormat = "501" | "301" | "170" | "121" | "cricket" | "cutthroat"
export type BracketType = "single_elimination" | "double_elimination" | "round_robin" | "groups_knockout" | "swiss"
export type MatchStatus = "pending" | "ongoing" | "completed"
export type SessionPhase = "setup" | "group_stage" | "knockout" | "completed"

export interface LocalPlayer {
  id: string
  name: string
  seed: number
}

export interface LegThrow {
  score: number        // оноо
  remaining: number    // үлдсэн
  darts: number        // хичнээн дарт хэрэглэсэн
}

export interface LocalLeg {
  legNumber: number
  throws: Record<string, LegThrow[]>  // playerId → throws
  winnerId: string | null
  startedAt: string
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
  winnerId: string | null
  loserId: string | null
  status: MatchStatus
  legs: LocalLeg[]
  isLosersBracket?: boolean   // double elimination
  nextMatchId?: string | null
  nextLoserMatchId?: string | null
}

export interface LocalGroup {
  id: string
  name: string
  playerIds: string[]
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
  createdAt: string
  updatedAt: string

  // Game config
  format: GameFormat
  startScore: number
  firstTo: number             // first to N sets/legs
  setsEnabled: boolean        // use sets
  legsPerSet: number          // legs per set
  doubleOut: boolean
  doubleIn: boolean
  loserFirst: boolean
  limitRounds: number | null  // max rounds per leg
  showAverage: boolean
  autoComplete: boolean
  allowParticipantScore: boolean
  showIndex: boolean
  // Point system
  pointWon: number
  pointDraw: number
  pointLost: number
  winPointsAreLegs: boolean

  // Bracket config
  bracketType: BracketType
  groupsCount: number         // groups_knockout
  groupAdvance: number        // groups_knockout: топ N гарна

  players: LocalPlayer[]
  matches: LocalMatch[]
  groups: LocalGroup[]
  standings: Record<string, StandingRow>  // playerId → standing (RR / group)

  phase: SessionPhase
  status: "active" | "completed"
  winnerId: string | null
}

export interface SessionSummary {
  id: string
  name: string
  format: GameFormat
  bracketType: BracketType
  playerCount: number
  status: "active" | "completed"
  createdAt: string
  winnerId: string | null
  winnerName?: string
}
