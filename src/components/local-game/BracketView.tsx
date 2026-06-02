"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { LocalMatch, LocalPlayer, LocalSession, LocalGroup, StandingRow } from "@/lib/local-game/types"
import { ChevronRight } from "lucide-react"

interface Props {
  session: LocalSession
  sessionId: string
}

export function BracketView({ session, sessionId }: Props) {
  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))

  if (session.bracketType === "round_robin") {
    return (
      <section className="space-y-2">
        <CollapsibleHeader title={`Round Robin (First to ${session.firstTo} ${session.setsEnabled ? "Sets" : "Legs"})`} />
        <RRGrid
          playerIds={session.players.map((p) => p.id)}
          matches={session.matches}
          standings={session.standings}
          playerMap={playerMap}
          sessionId={sessionId}
        />
      </section>
    )
  }

  if (session.bracketType === "groups_knockout") {
    const groupMatches = session.matches.filter((m) => m.round < 100)
    const koMatches = session.matches.filter((m) => m.round >= 100 && m.round !== 999)
    const finalMatch = session.matches.find((m) => m.round === 999)

    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <CollapsibleHeader title={`Round Robin (First to ${session.firstTo} ${session.setsEnabled ? "Sets" : "Legs"})`} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {session.groups.map((group) => (
              <div key={group.id}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{group.name}</p>
                <RRGrid
                  playerIds={group.playerIds}
                  matches={groupMatches.filter((m) => m.groupId === group.id)}
                  standings={session.standings}
                  playerMap={playerMap}
                  sessionId={sessionId}
                />
              </div>
            ))}
          </div>
        </section>

        {session.phase === "knockout" && (
          <section className="space-y-3">
            <CollapsibleHeader title="Knockout Stage" />
            <EliminationBracket
              matches={[...koMatches, ...(finalMatch ? [finalMatch] : [])]}
              playerMap={playerMap}
              sessionId={sessionId}
              firstTo={session.firstTo}
              setsEnabled={session.setsEnabled}
            />
          </section>
        )}
      </div>
    )
  }

  if (session.bracketType === "swiss") {
    return (
      <section className="space-y-3">
        <CollapsibleHeader title={`Swiss (First to ${session.firstTo} ${session.setsEnabled ? "Sets" : "Legs"})`} />
        <RRGrid
          playerIds={session.players.map((p) => p.id)}
          matches={session.matches}
          standings={session.standings}
          playerMap={playerMap}
          sessionId={sessionId}
        />
      </section>
    )
  }

  // Single Elimination / Double Elimination
  return (
    <section className="space-y-3">
      <CollapsibleHeader title={`${session.bracketType === "double_elimination" ? "Double" : "Single"} Elimination (First to ${session.firstTo} ${session.setsEnabled ? "Sets" : "Legs"})`} />
      <EliminationBracket
        matches={session.matches}
        playerMap={playerMap}
        sessionId={sessionId}
        firstTo={session.firstTo}
        setsEnabled={session.setsEnabled}
      />
    </section>
  )
}

// ── Round Robin Cross-Table ───────────────────────────────────────────────────

function RRGrid({ playerIds, matches, standings, playerMap, sessionId }: {
  playerIds: string[]
  matches: LocalMatch[]
  standings: Record<string, StandingRow>
  playerMap: Record<string, LocalPlayer>
  sessionId: string
}) {
  // Build match lookup: "p1Id_p2Id" → match (both directions)
  const lookup: Record<string, LocalMatch> = {}
  const matchNumber: Record<string, number> = {}
  let num = 1
  matches.forEach((m) => {
    if (m.player1Id && m.player2Id && m.player1Id !== "bye" && m.player2Id !== "bye") {
      lookup[`${m.player1Id}_${m.player2Id}`] = m
      lookup[`${m.player2Id}_${m.player1Id}`] = m
      matchNumber[m.id] = num++
    }
  })

  // Sort by standing points desc
  const sorted = [...playerIds].sort((a, b) => {
    const sa = standings[a]; const sb = standings[b]
    if (!sa || !sb) return 0
    return sb.points - sa.points || (sb.legsWon - sb.legsLost) - (sa.legsWon - sa.legsLost)
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/80">
      <table className="border-collapse w-full text-sm">
        <thead>
          <tr className="bg-secondary/60">
            <th className="px-2 py-2 text-left text-[11px] text-muted-foreground font-medium w-7">#</th>
            <th className="px-3 py-2 text-left text-[11px] text-muted-foreground font-medium min-w-[120px]">Name</th>
            {sorted.map((_, i) => (
              <th key={i} className="px-1 py-2 text-center text-[11px] text-muted-foreground font-medium w-9">{i + 1}</th>
            ))}
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-10">W-L</th>
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-10">Legs</th>
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-12">Points</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pid, rowIdx) => {
            const player = playerMap[pid]
            const st = standings[pid]
            return (
              <tr key={pid} className="border-t border-border/25 hover:bg-secondary/20 transition-colors">
                <td className="px-2 py-2 text-xs text-muted-foreground text-center">{rowIdx + 1}</td>
                <td className="px-3 py-2 font-medium text-sm">
                  <div className="flex items-center gap-1.5">
                    <span>{player?.name ?? "?"}</span>
                    {st && st.played > 0 && <span className="text-[10px] text-muted-foreground">({(st.legsWon / Math.max(st.played * 3, 1) * 100).toFixed(0)}%)</span>}
                  </div>
                </td>
                {sorted.map((cpid, colIdx) => {
                  // Diagonal
                  if (pid === cpid) {
                    return <td key={cpid} className="w-9 bg-secondary/50" />
                  }
                  const m = lookup[`${pid}_${cpid}`]
                  if (!m) return <td key={cpid} className="w-9" />

                  const myLegs = m.player1Id === pid ? m.player1Legs : m.player2Legs
                  const oppLegs = m.player1Id === pid ? m.player2Legs : m.player1Legs
                  const iWon = m.status === "completed" && m.winnerId === pid
                  const iLost = m.status === "completed" && m.winnerId === cpid
                  const isLive = m.status === "ongoing"
                  const isPending = m.status === "pending"

                  return (
                    <td key={cpid} className="px-0.5 py-1.5 text-center w-9">
                      <Link href={`/local/${sessionId}/match/${m.id}`}>
                        <div className={cn(
                          "flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold mx-auto transition-all cursor-pointer",
                          isLive ? "bg-primary/25 text-primary border-2 border-primary pulse-live" :
                          iWon ? "bg-green-500/20 text-green-400 border border-green-500/40" :
                          iLost ? "bg-destructive/15 text-destructive/80 border border-destructive/25" :
                          "border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                        )}>
                          {m.status === "completed"
                            ? `${myLegs}`
                            : matchNumber[m.id] ?? "?"}
                        </div>
                      </Link>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center text-xs font-semibold">
                  {st ? <><span className="text-green-400">{st.won}</span><span className="text-muted-foreground">-</span><span className="text-destructive/80">{st.lost}</span></> : ""}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted-foreground score-display">
                  {st ? `${st.legsWon}` : ""}
                </td>
                <td className="px-2 py-2 text-center text-sm font-bold text-primary score-display">
                  {st ? st.points : ""}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Single/Double Elimination Bracket ────────────────────────────────────────

function EliminationBracket({ matches, playerMap, sessionId, firstTo, setsEnabled }: {
  matches: LocalMatch[]
  playerMap: Record<string, LocalPlayer>
  sessionId: string
  firstTo: number
  setsEnabled: boolean
}) {
  const legLabel = setsEnabled ? "Sets" : "Legs"

  // Get unique rounds sorted
  const winnerRounds = [...new Set(
    matches.filter((m) => !m.isLosersBracket).map((m) => m.round)
  )].sort((a, b) => a - b)

  const loserRounds = [...new Set(
    matches.filter((m) => m.isLosersBracket).map((m) => m.round)
  )].sort((a, b) => a - b)

  const maxRound = Math.max(...winnerRounds)

  function getRoundLabel(round: number, max: number) {
    const dist = max - round
    if (dist === 0) return "Final"
    if (dist === 1) return "Semi-final"
    if (dist === 2) return "Quarter-final"
    return `Round of ${Math.pow(2, dist + 1)}`
  }

  const winnerMatchesByRound = winnerRounds.map((r) => ({
    round: r,
    label: getRoundLabel(r, maxRound),
    matches: matches.filter((m) => !m.isLosersBracket && m.round === r),
  }))

  return (
    <div className="overflow-x-auto pb-2">
      {/* Winner bracket */}
      <div className="flex gap-0 min-w-max">
        {winnerMatchesByRound.map(({ round, label, matches: roundMatches }, roundIdx) => {
          const isLast = roundIdx === winnerMatchesByRound.length - 1
          const prevCount = roundIdx > 0 ? winnerMatchesByRound[roundIdx - 1].matches.length : roundMatches.length * 2
          const matchHeight = 72  // px per match slot
          const gap = roundIdx === 0 ? 8 : (prevCount / roundMatches.length - 1) * matchHeight + 8

          return (
            <div key={round} className="flex">
              {/* Round column */}
              <div className="flex flex-col" style={{ minWidth: 160 }}>
                {/* Header */}
                <div className="text-center pb-2 px-2">
                  <p className="text-xs font-semibold text-foreground/80">{label}</p>
                  <p className="text-[10px] text-muted-foreground">First to {firstTo} {legLabel}</p>
                </div>

                {/* Matches */}
                <div className="flex flex-col" style={{ gap }}>
                  {roundMatches.map((match) => (
                    <MatchSlot
                      key={match.id}
                      match={match}
                      playerMap={playerMap}
                      sessionId={sessionId}
                    />
                  ))}
                </div>
              </div>

              {/* Connector lines between rounds */}
              {!isLast && (
                <BracketConnector
                  matchCount={roundMatches.length}
                  matchHeight={matchHeight}
                  gap={gap}
                  nextGap={roundIdx + 1 < winnerMatchesByRound.length - 1
                    ? (roundMatches.length / winnerMatchesByRound[roundIdx + 1].matches.length - 1) * matchHeight + 8
                    : gap}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Loser bracket label */}
      {loserRounds.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/40">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Losers Bracket</p>
          <div className="flex gap-0 min-w-max">
            {loserRounds.map((r, i) => {
              const lMatches = matches.filter((m) => m.isLosersBracket && m.round === r)
              return (
                <div key={r} className="flex">
                  <div className="flex flex-col min-w-[160px]">
                    <div className="text-center pb-2">
                      <p className="text-xs text-muted-foreground">LR {i + 1}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {lMatches.map((m) => (
                        <MatchSlot key={m.id} match={m} playerMap={playerMap} sessionId={sessionId} compact />
                      ))}
                    </div>
                  </div>
                  {i < loserRounds.length - 1 && (
                    <BracketConnector matchCount={lMatches.length} matchHeight={56} gap={8} nextGap={8} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single match slot ─────────────────────────────────────────────────────────

function MatchSlot({ match: m, playerMap, sessionId, compact = false }: {
  match: LocalMatch
  playerMap: Record<string, LocalPlayer>
  sessionId: string
  compact?: boolean
}) {
  function pName(id: string | "bye" | null) {
    if (!id) return "TBD"
    if (id === "bye") return "BYE"
    return playerMap[id]?.name ?? "?"
  }

  const p1Name = pName(m.player1Id)
  const p2Name = pName(m.player2Id)
  const isLive = m.status === "ongoing"
  const isDone = m.status === "completed"
  const isTBD = !m.player1Id || !m.player2Id
  const isBye = m.player1Id === "bye" || m.player2Id === "bye"

  const slotH = compact ? "h-5" : "h-7"
  const textSz = compact ? "text-[11px]" : "text-xs"

  const content = (
    <div className={cn(
      "border-2 rounded-lg overflow-hidden transition-all",
      isLive ? "border-primary shadow-md shadow-primary/20" :
      isDone ? "border-green-500/30" :
      isTBD ? "border-border/30 opacity-60" :
      "border-border/50 hover:border-primary/40"
    )}>
      {/* Player 1 */}
      <div className={cn(
        "flex items-center justify-between gap-2 px-2.5 bg-card",
        slotH,
        isDone && m.winnerId === m.player1Id ? "bg-green-500/10" : "",
        isDone && m.winnerId !== m.player1Id && m.winnerId !== null ? "opacity-50" : ""
      )}>
        <span className={cn("truncate font-medium", textSz,
          isDone && m.winnerId === m.player1Id ? "text-green-400" : ""
        )}>
          {p1Name}
        </span>
        {(isLive || isDone) && m.player1Id !== "bye" && (
          <span className={cn("font-bold score-display shrink-0", textSz,
            isDone && m.winnerId === m.player1Id ? "text-green-400" : "text-muted-foreground"
          )}>
            {m.player1Legs}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Player 2 */}
      <div className={cn(
        "flex items-center justify-between gap-2 px-2.5 bg-card",
        slotH,
        isDone && m.winnerId === m.player2Id ? "bg-green-500/10" : "",
        isDone && m.winnerId !== m.player2Id && m.winnerId !== null ? "opacity-50" : ""
      )}>
        <span className={cn("truncate font-medium", textSz,
          isDone && m.winnerId === m.player2Id ? "text-green-400" : ""
        )}>
          {p2Name}
        </span>
        {(isLive || isDone) && m.player2Id !== "bye" && (
          <span className={cn("font-bold score-display shrink-0", textSz,
            isDone && m.winnerId === m.player2Id ? "text-green-400" : "text-muted-foreground"
          )}>
            {m.player2Legs}
          </span>
        )}
      </div>
    </div>
  )

  if (isTBD || isBye || isDone) return content

  return (
    <Link href={`/local/${sessionId}/match/${m.id}`} className="block">
      {content}
    </Link>
  )
}

// ── Bracket connector lines ───────────────────────────────────────────────────

function BracketConnector({ matchCount, matchHeight, gap, nextGap }: {
  matchCount: number
  matchHeight: number
  gap: number
  nextGap: number
}) {
  // For each pair of matches, draw a connector
  const pairs = matchCount / 2
  const pairHeight = matchHeight * 2 + gap

  return (
    <div className="flex flex-col relative" style={{ width: 24 }}>
      {Array.from({ length: pairs }).map((_, i) => (
        <div key={i} className="relative" style={{ height: pairHeight, marginBottom: i < pairs - 1 ? nextGap : 0 }}>
          {/* Top half vertical line */}
          <div className="absolute right-0 bg-border/60" style={{
            width: 2, top: matchHeight / 2, height: (pairHeight - matchHeight) / 2,
          }} />
          {/* Bottom half vertical line */}
          <div className="absolute right-0 bg-border/60" style={{
            width: 2, top: pairHeight / 2, height: (pairHeight - matchHeight) / 2,
          }} />
          {/* Horizontal connector at midpoint */}
          <div className="absolute bg-border/60" style={{
            height: 2, right: 0, left: 0, top: pairHeight / 2 - 1,
          }} />
        </div>
      ))}
    </div>
  )
}

// ── Collapsible header ────────────────────────────────────────────────────────

function CollapsibleHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}
