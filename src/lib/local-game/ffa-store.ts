"use client"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nanoid } from "nanoid"
import type { FFAGame, FFAFormat, FFALeg } from "./ffa-types"
import { broadcastFFA } from "./ffa-sync"

interface FFAStore {
  games: Record<string, FFAGame>
  createGame: (config: {
    name: string
    format: FFAFormat
    startScore: number
    players: string[]
    firstTo: number
    doubleOut: boolean
    doubleIn: boolean
    joinCode: string
    joinPassword: string
  }) => string
  recordThrow: (gameId: string, score: number, darts: number, bust: boolean) => void
  completeLeg: (gameId: string, winnerId: string) => void
  completeGame: (gameId: string, winnerId: string) => void
  deleteGame: (id: string) => void
  importGame: (game: FFAGame) => void
}

function makeFirstLeg(playerCount: number): FFALeg {
  return { throws: {}, currentPlayerIndex: 0, winnerId: null }
}

export const useFFAStore = create<FFAStore>()(
  persist(
    (set, get) => ({
      games: {},

      createGame({ name, format, startScore, players, firstTo, doubleOut, doubleIn, joinCode, joinPassword }) {
        const id = nanoid(10)
        const game: FFAGame = {
          id, type: "freeforall", name, format, startScore,
          players: players.map((n) => ({ id: nanoid(6), name: n })),
          firstTo, doubleOut, doubleIn, joinCode, joinPassword,
          status: "active", winnerId: null,
          legs: [makeFirstLeg(players.length)],
          wins: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ games: { ...s.games, [id]: game } }))
        return id
      },

      recordThrow(gameId, score, darts, bust) {
        set((s) => {
          const game = s.games[gameId]
          if (!game || game.status !== "active") return s
          const legIdx = game.legs.findIndex((l) => !l.winnerId)
          if (legIdx === -1) return s
          const leg = game.legs[legIdx]
          const player = game.players[leg.currentPlayerIndex]
          if (!player) return s

          const prevThrows = leg.throws[player.id] ?? []
          const newLeg: FFALeg = {
            ...leg,
            throws: {
              ...leg.throws,
              [player.id]: [...prevThrows, { score, darts, bust }],
            },
            currentPlayerIndex: (leg.currentPlayerIndex + 1) % game.players.length,
          }
          const newLegs = game.legs.map((l, i) => i === legIdx ? newLeg : l)
          const updated: FFAGame = { ...game, legs: newLegs, updatedAt: new Date().toISOString() }
          broadcastFFA(updated)
          return { games: { ...s.games, [gameId]: updated } }
        })
      },

      completeLeg(gameId, winnerId) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          const legIdx = game.legs.findIndex((l) => !l.winnerId)
          if (legIdx === -1) return s

          const newWins = { ...game.wins, [winnerId]: (game.wins[winnerId] ?? 0) + 1 }
          const updatedLeg: FFALeg = { ...game.legs[legIdx], winnerId }

          // Check if game over
          const gameWon = newWins[winnerId] >= game.firstTo
          const newLegs = game.legs.map((l, i) => i === legIdx ? updatedLeg : l)
          if (!gameWon) {
            newLegs.push(makeFirstLeg(game.players.length))
          }

          const updated: FFAGame = {
            ...game,
            legs: newLegs,
            wins: newWins,
            status: gameWon ? "completed" : "active",
            winnerId: gameWon ? winnerId : null,
            updatedAt: new Date().toISOString(),
          }
          broadcastFFA(updated)
          return { games: { ...s.games, [gameId]: updated } }
        })
      },

      completeGame(gameId, winnerId) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          const updated: FFAGame = { ...game, status: "completed", winnerId, updatedAt: new Date().toISOString() }
          broadcastFFA(updated)
          return { games: { ...s.games, [gameId]: updated } }
        })
      },

      deleteGame(id) {
        set((s) => {
          const { [id]: _, ...rest } = s.games
          return { games: rest }
        })
      },

      importGame(game) {
        set((s) => ({ games: { ...s.games, [game.id]: game } }))
      },
    }),
    { name: "dartmn-ffa-games" }
  )
)
