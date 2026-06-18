import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  LocalSession, LocalPlayer, LocalMatch, LocalLeg, SessionSummary,
  BracketType, GameFormat, StandingRow, SessionPhase,
} from "./types"
import { broadcastSession, deleteRemoteSession } from "./sync"
import {
  generateSingleElimination, generateDoubleElimination,
  generateRoundRobin, generateGroupsKnockout, generateSwissRound1,
  generateSwissNextRound, updateStandings,
} from "./bracket"

interface LocalGameStore {
  sessions: Record<string, LocalSession>

  // Session management
  createSession: (config: {
    name: string
    joinPassword: string
    description: string
    format: GameFormat
    startScore: number
    // RR format
    rrFirstTo: number
    rrSetsEnabled: boolean
    rrLegsPerSet: number
    rrEnableDraw: boolean
    // KO format
    firstTo: number
    setsEnabled: boolean
    legsPerSet: number
    doubleOut: boolean
    doubleIn: boolean
    loserFirst: boolean
    thirdPlaceMatch: boolean
    limitRounds: number | null
    bullFinishAtLimit: boolean
    enableDraw: boolean
    showAverage: boolean
    autoComplete: boolean
    allowParticipantScore: boolean
    showIndex: boolean
    pointWon: number
    pointDraw: number
    pointLost: number
    winPointsAreLegs: boolean
    bracketType: BracketType
    playersPerGroup: number
    groupsCount: number
    groupAdvance: number
    players: { name: string; profileId?: string | null; profileUsername?: string | null; avatarUrl?: string | null }[]
    startWithPhase?: SessionPhase
  }) => string

  deleteSession: (id: string) => void
  setPhase: (sessionId: string, phase: SessionPhase) => void
  updateSession: (id: string, patch: Partial<Pick<LocalSession,
    "name" | "joinPassword" | "description"
    | "rrFirstTo" | "rrSetsEnabled" | "rrLegsPerSet" | "rrEnableDraw"
    | "firstTo" | "setsEnabled" | "legsPerSet" | "doubleOut" | "doubleIn"
    | "loserFirst" | "thirdPlaceMatch" | "limitRounds" | "bullFinishAtLimit" | "enableDraw"
    | "showAverage" | "autoComplete" | "allowParticipantScore" | "showIndex"
    | "pointWon" | "pointDraw" | "pointLost" | "winPointsAreLegs"
  >>) => void

  rebuildKnockout: (sessionId: string, newGroupAdvance: number) => void

  // Bracket editing
  movePlayerToGroup: (sessionId: string, playerId: string, targetGroupId: string) => void
  assignBracketSlot: (sessionId: string, matchId: string, slot: "p1" | "p2", playerId: string | null) => void
  autoAssignKnockout: (sessionId: string) => void
  setConcurrentMatches: (sessionId: string, groupId: string, count: number) => void

  getSummaries: () => SessionSummary[]

  // Match management
  startMatch: (sessionId: string, matchId: string) => void
  recordThrow: (sessionId: string, matchId: string, legIndex: number, playerId: string, score: number, dartsUsed: number, bust?: boolean) => void
  completeLeg: (sessionId: string, matchId: string, legIndex: number, winnerId: string) => void
  completeMatch: (sessionId: string, matchId: string, winnerId: string) => void
  addSwissRound: (sessionId: string) => void
  advanceGroupsToKnockout: (sessionId: string) => void
}

let _pid = 0
function playerId() { return `p${Date.now()}${++_pid}` }
function sessionId() { return `s${Date.now()}` }

export const useLocalGame = create<LocalGameStore>()(
  persist(
    (set, get) => ({
      sessions: {},

      createSession: (config) => {
        const id = sessionId()
        const players: LocalPlayer[] = config.players.map((p, i) => ({
          id: playerId(),
          name: p.name,
          seed: i + 1,
          profileId: p.profileId ?? null,
          profileUsername: p.profileUsername ?? null,
          avatarUrl: p.avatarUrl ?? null,
        }))

        let matches: LocalMatch[] = []
        let groups: import("./types").LocalGroup[] = []
        let standings: Record<string, StandingRow> = {}

        switch (config.bracketType) {
          case "single_elimination":
            matches = generateSingleElimination(players)
            break
          case "double_elimination":
            matches = generateDoubleElimination(players)
            break
          case "round_robin": {
            const rr = generateRoundRobin(players)
            matches = rr.matches
            standings = rr.standings
            break
          }
          case "groups_knockout": {
            const gk = generateGroupsKnockout(players, config.groupsCount, config.groupAdvance)
            matches = gk.matches
            groups = gk.groups
            standings = gk.standings
            break
          }
          case "swiss": {
            const sw = generateSwissRound1(players)
            matches = sw.matches
            standings = sw.standings
            break
          }
        }

        const session: LocalSession = {
          id,
          name: config.name,
          joinPassword: config.joinPassword,
          description: config.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          format: config.format,
          startScore: config.startScore,
          rrFirstTo: config.rrFirstTo,
          rrSetsEnabled: config.rrSetsEnabled,
          rrLegsPerSet: config.rrLegsPerSet,
          rrEnableDraw: config.rrEnableDraw,
          rrSchedule: false,
          firstTo: config.firstTo,
          setsEnabled: config.setsEnabled,
          legsPerSet: config.legsPerSet,
          doubleOut: config.doubleOut,
          doubleIn: config.doubleIn,
          loserFirst: config.loserFirst,
          thirdPlaceMatch: config.thirdPlaceMatch,
          limitRounds: config.limitRounds,
          bullFinishAtLimit: config.bullFinishAtLimit,
          enableDraw: config.enableDraw,
          showAverage: config.showAverage,
          autoComplete: config.autoComplete,
          allowParticipantScore: config.allowParticipantScore,
          showIndex: config.showIndex,
          pointWon: config.pointWon,
          pointDraw: config.pointDraw,
          pointLost: config.pointLost,
          winPointsAreLegs: config.winPointsAreLegs,
          bracketType: config.bracketType,
          playersPerGroup: config.playersPerGroup,
          groupsCount: config.groupsCount,
          groupAdvance: config.groupAdvance,
          concurrentMatchesPerGroup: {},
          players,
          matches,
          groups,
          standings,
          phase: config.startWithPhase ?? "in_session",
          status: "active",
          winnerId: null,
        }

        set((s) => ({ sessions: { ...s.sessions, [id]: session } }))
        broadcastSession(session)
        // Owner flag — энэ device дээр үүсгэсэн session-уудын жагсаалт
        try {
          const owned = JSON.parse(localStorage.getItem("owned-sessions") ?? "[]") as string[]
          if (!owned.includes(id)) localStorage.setItem("owned-sessions", JSON.stringify([...owned, id]))
        } catch {}
        return id
      },

      deleteSession: (id) => {
        set((s) => {
          const next = { ...s.sessions }
          delete next[id]
          return { sessions: next }
        })
        deleteRemoteSession(id)
        try {
          const owned = JSON.parse(localStorage.getItem("owned-sessions") ?? "[]") as string[]
          localStorage.setItem("owned-sessions", JSON.stringify(owned.filter((o) => o !== id)))
        } catch {}
      },

      setPhase: (sessionId, phase) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          return { sessions: { ...s.sessions, [sessionId]: { ...session, phase, updatedAt: new Date().toISOString() } } }
        })
      },

      updateSession: (id, patch) => {
        set((s) => {
          const session = s.sessions[id]
          if (!session) return s
          return {
            sessions: {
              ...s.sessions,
              [id]: { ...session, ...patch, updatedAt: new Date().toISOString() },
            },
          }
        })
      },

      rebuildKnockout: (sessionId, newGroupAdvance) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session || session.bracketType !== "groups_knockout") return s
          // RR match-уудыг хадгалж, KO match-уудыг дахин үүсгэнэ
          const rrMatches = session.matches.filter((m) => m.round < 100)
          const newKO = generateGroupsKnockout(session.players, session.groupsCount, newGroupAdvance)
          const koOnly = newKO.matches.filter((m: LocalMatch) => m.round >= 100)
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                groupAdvance: newGroupAdvance,
                matches: [...rrMatches, ...koOnly],
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
        const updated = get().sessions[sessionId]
        if (updated) broadcastSession(updated)
      },

      movePlayerToGroup: (sessionId, playerId, targetGroupId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          const groups = session.groups.map((g) => ({
            ...g,
            playerIds: g.id === targetGroupId
              ? [...g.playerIds.filter((id) => id !== playerId), playerId]
              : g.playerIds.filter((id) => id !== playerId),
          }))
          return { sessions: { ...s.sessions, [sessionId]: { ...session, groups, updatedAt: new Date().toISOString() } } }
        })
      },

      assignBracketSlot: (sessionId, matchId, slot, playerId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          const matches = session.matches.map((m) => {
            if (m.id !== matchId) return m
            return slot === "p1"
              ? { ...m, player1Id: playerId }
              : { ...m, player2Id: playerId }
          })
          return { sessions: { ...s.sessions, [sessionId]: { ...session, matches, updatedAt: new Date().toISOString() } } }
        })
      },

      autoAssignKnockout: (sessionId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session || session.bracketType !== "groups_knockout") return s

          // Get top N from each group by standing
          const advancing: string[] = []
          for (const group of session.groups) {
            const sorted = group.playerIds
              .map((id) => session.standings[id])
              .filter(Boolean)
              .sort((a, b) => b.points - a.points || b.legsWon - a.legsLost)
            advancing.push(...sorted.slice(0, session.groupAdvance).map((st) => st.playerId))
          }

          // Fill knockout round 1 slots
          const koR1 = session.matches
            .filter((m) => m.round >= 100 && m.round < 200)
            .sort((a, b) => a.matchNumber - b.matchNumber)

          let idx = 0
          const matches = session.matches.map((m) => {
            const isKoR1 = koR1.some((km) => km.id === m.id)
            if (!isKoR1) return m
            const p1 = advancing[idx++] ?? null
            const p2 = advancing[idx++] ?? null
            return { ...m, player1Id: p1, player2Id: p2 }
          })

          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...session, matches, phase: "knockout" as const, updatedAt: new Date().toISOString() },
            },
          }
        })
      },

      setConcurrentMatches: (sessionId, groupId, count) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          const concurrentMap: Record<string, number> = {
            ...(session as any).concurrentMatchesPerGroup,
            [groupId]: count,
          }
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...session, concurrentMatchesPerGroup: concurrentMap, updatedAt: new Date().toISOString() },
            },
          }
        })
      },

      getSummaries: () => {
        const sessions = get().sessions
        return Object.values(sessions)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((s) => ({
            id: s.id,
            name: s.name,
            format: s.format,
            bracketType: s.bracketType,
            playerCount: s.players.length,
            phase: s.phase,
            status: s.status,
            createdAt: s.createdAt,
            winnerId: s.winnerId,
            winnerName: s.winnerId ? s.players.find((p) => p.id === s.winnerId)?.name : undefined,
          }))
      },

      startMatch: (sessionId, matchId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          const matches = session.matches.map((m) =>
            m.id === matchId ? { ...m, status: "ongoing" as const } : m
          )
          return { sessions: { ...s.sessions, [sessionId]: { ...session, matches, updatedAt: new Date().toISOString() } } }
        })
        const updated = get().sessions[sessionId]
        if (updated) broadcastSession(updated)
      },

      recordThrow: (sessionId, matchId, legIndex, playerId, score, dartsUsed, bust = false) => {
        set((s) => {
          const session = { ...s.sessions[sessionId] }
          if (!session) return s
          const matches = session.matches.map((m) => {
            if (m.id !== matchId) return m
            const legs = [...m.legs]
            if (!legs[legIndex]) {
              legs[legIndex] = {
                legNumber: legIndex + 1,
                throws: {},
                winnerId: null,
                startedAt: new Date().toISOString(),
              }
            }
            const leg = { ...legs[legIndex] }
            const playerThrows = leg.throws[playerId] ?? []
            // bust-ийн оноо тоологдохгүй — өмнөх bust бус онооноос л үлдэгдлийг бодно
            const preTurn = session.startScore - playerThrows.reduce((a, t) => a + (t.bust ? 0 : t.score), 0)
            const remaining = bust ? preTurn : preTurn - score
            const newThrow = { score, remaining, darts: dartsUsed, bust }
            leg.throws = { ...leg.throws, [playerId]: [...playerThrows, newThrow] }
            legs[legIndex] = leg
            return { ...m, legs }
          })
          return { sessions: { ...s.sessions, [sessionId]: { ...session, matches, updatedAt: new Date().toISOString() } } }
        })
        const updated = get().sessions[sessionId]
        if (updated) broadcastSession(updated)
      },

      completeLeg: (sessionId, matchId, legIndex, winnerId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          const matches = session.matches.map((m) => {
            if (m.id !== matchId) return m
            const legs = [...m.legs]
            if (legs[legIndex]) {
              legs[legIndex] = { ...legs[legIndex], winnerId }
            }
            const isP1Win = winnerId === m.player1Id
            return {
              ...m,
              legs,
              player1Legs: isP1Win ? m.player1Legs + 1 : m.player1Legs,
              player2Legs: !isP1Win ? m.player2Legs + 1 : m.player2Legs,
            }
          })
          return { sessions: { ...s.sessions, [sessionId]: { ...session, matches, updatedAt: new Date().toISOString() } } }
        })
        const updated = get().sessions[sessionId]
        if (updated) broadcastSession(updated)
      },

      completeMatch: (sessionId, matchId, winnerId) => {
        set((s) => {
          const session = { ...s.sessions[sessionId] }
          if (!session) return s

          const match = session.matches.find((m) => m.id === matchId)
          if (!match) return s
          const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id

          let matches = session.matches.map((m) =>
            m.id === matchId
              ? { ...m, status: "completed" as const, winnerId, loserId: loserId ?? null }
              : m
          )

          // Advance winner to next match (single/double elimination)
          if (match.nextMatchId) {
            matches = matches.map((m) => {
              if (m.id !== match.nextMatchId) return m
              const isSlot1 = m.player1Id === null
              return { ...m, player1Id: isSlot1 ? winnerId : m.player1Id, player2Id: isSlot1 ? m.player2Id : winnerId }
            })
          }

          // Update standings (RR / groups / swiss)
          let standings = { ...session.standings }
          if (["round_robin", "groups_knockout", "swiss"].includes(session.bracketType)) {
            const completedMatch = matches.find((m) => m.id === matchId)!
            standings = updateStandings(standings, completedMatch)
          }

          // Check if tournament is complete
          const allMatchesDone = matches.filter((m) => m.player1Id && m.player2Id && m.player1Id !== "bye" && m.player2Id !== "bye")
            .every((m) => m.status === "completed" || m.player1Id === "bye" || m.player2Id === "bye")

          const finalMatch = [...matches].filter((m) => !m.nextMatchId && m.status === "completed").pop()
          const sessionWinnerId = finalMatch?.winnerId ?? null

          const updatedSession: LocalSession = {
            ...session,
            matches,
            standings,
            status: allMatchesDone ? "completed" : "active",
            winnerId: allMatchesDone ? sessionWinnerId : null,
            phase: session.bracketType === "groups_knockout" && session.phase === "group_stage"
              ? "group_stage"  // stays until manually advanced
              : session.phase,
            updatedAt: new Date().toISOString(),
          }
          return { sessions: { ...s.sessions, [sessionId]: updatedSession } }
        })
        const updated = get().sessions[sessionId]
        if (updated) broadcastSession(updated)
      },

      addSwissRound: (sessionId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session) return s
          const currentRound = Math.max(...session.matches.map((m) => m.round))
          const newMatches = generateSwissNextRound(session.players, session.standings, currentRound, session.matches)
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...session, matches: [...session.matches, ...newMatches], updatedAt: new Date().toISOString() },
            },
          }
        })
      },

      advanceGroupsToKnockout: (sessionId) => {
        set((s) => {
          const session = s.sessions[sessionId]
          if (!session || session.bracketType !== "groups_knockout") return s

          // Get top N from each group
          const advancingIds: string[] = []
          for (const group of session.groups) {
            const groupStandings = group.playerIds
              .map((id) => session.standings[id])
              .filter(Boolean)
              .sort((a, b) => b.points - a.points || b.legsWon - a.legsWon)
            advancingIds.push(...groupStandings.slice(0, session.groupAdvance).map((s) => s.playerId))
          }

          // Fill knockout round 1 slots
          const koMatches = session.matches.filter((m) => m.round >= 100)
          const koR1 = koMatches.filter((m) => m.round === 100)
          let slotIndex = 0
          const updatedKo = koMatches.map((m) => {
            if (m.round !== 100) return m
            const p1 = advancingIds[slotIndex++] ?? "bye"
            const p2 = advancingIds[slotIndex++] ?? "bye"
            return { ...m, player1Id: p1, player2Id: p2 }
          })

          const matches = [
            ...session.matches.filter((m) => m.round < 100),
            ...updatedKo,
          ]

          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...session, matches, phase: "knockout", updatedAt: new Date().toISOString() },
            },
          }
        })
      },
    }),
    { name: "dartmn-local-games" }
  )
)
