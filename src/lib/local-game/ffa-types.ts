export type FFAFormat = "501" | "301" | "170" | "121" | "custom"

export interface FFAPlayer {
  id: string
  name: string
}

export interface FFAThrow {
  score: number
  darts: number
  bust: boolean
}

export interface FFALeg {
  throws: Record<string, FFAThrow[]>
  currentPlayerIndex: number
  winnerId: string | null
}

export interface FFAGame {
  id: string
  type: "freeforall"
  name: string
  format: FFAFormat
  startScore: number
  players: FFAPlayer[]
  firstTo: number
  doubleOut: boolean
  doubleIn: boolean
  joinCode: string
  joinPassword: string
  status: "active" | "completed"
  winnerId: string | null
  legs: FFALeg[]
  wins: Record<string, number>
  createdAt: string
  updatedAt: string
}
