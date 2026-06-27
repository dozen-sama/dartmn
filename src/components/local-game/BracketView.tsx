"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { LocalMatch, LocalPlayer, LocalSession, StandingRow } from "@/lib/local-game/types"

interface Props {
  session: LocalSession
  sessionId: string
}

export function BracketView({ session, sessionId }: Props) {
  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))

  if (session.bracketType === "round_robin") {
    return (
      <section className="space-y-2">
        <SectionHeader title={`Round Robin · First to ${session.rrFirstTo || session.firstTo} ${session.rrSetsEnabled || session.setsEnabled ? "Sets" : "Legs"}`} />
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
          <SectionHeader title="Бүлгийн шат" />
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
            <SectionHeader title="Knockout шат" />
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
        <SectionHeader title={`Swiss · First to ${session.firstTo} ${session.setsEnabled ? "Sets" : "Legs"}`} />
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

  // Single / Double Elimination
  return (
    <section className="space-y-3">
      <SectionHeader title={`${session.bracketType === "double_elimination" ? "Double" : "Single"} Elimination · First to ${session.firstTo} ${session.setsEnabled ? "Sets" : "Legs"}`} />
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

function matchAvg(m: LocalMatch, pid: string): string {
  const throws = m.legs.flatMap((l) => l.throws[pid] ?? [])
  if (!throws.length) return ""
  const pts = throws.reduce((a, t) => a + (t.bust ? 0 : t.score), 0)
  return (pts / throws.length * 3).toFixed(2)
}

function RRGrid({ playerIds, matches, standings, playerMap, sessionId }: {
  playerIds: string[]
  matches: LocalMatch[]
  standings: Record<string, StandingRow>
  playerMap: Record<string, LocalPlayer>
  sessionId: string
}) {
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
              <th key={i} className="px-1 py-2 text-center text-[11px] text-muted-foreground font-medium w-12">{i + 1}</th>
            ))}
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-12">W - L</th>
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-12">Legs</th>
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-12">Rank</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pid, rowIdx) => {
            const player = playerMap[pid]
            const st = standings[pid]
            return (
              <tr key={pid} className="border-t border-border/25 hover:bg-secondary/10 transition-colors">
                <td className="px-2 py-2 text-xs text-muted-foreground text-center">{rowIdx + 1}</td>
                <td className="px-3 py-2 font-medium text-sm truncate max-w-[130px]">
                  {player?.name ?? "?"}
                </td>
                {sorted.map((cpid) => {
                  if (pid === cpid) return <td key={cpid} className="bg-secondary/40" />

                  const m = lookup[`${pid}_${cpid}`]
                  if (!m) return <td key={cpid} />

                  const myLegs  = m.player1Id === pid ? m.player1Legs : m.player2Legs
                  const oppLegs = m.player1Id === pid ? m.player2Legs : m.player1Legs
                  const iWon    = m.status === "completed" && m.winnerId === pid
                  const iLost   = m.status === "completed" && m.winnerId === cpid
                  const isLive  = m.status === "ongoing"
                  const avg     = m.status === "completed" ? matchAvg(m, pid) : ""

                  return (
                    <td key={cpid} className="px-0.5 py-1 text-center w-12">
                      <Link href={`/local/${sessionId}/match/${m.id}/live`}>
                        {m.status === "completed" ? (
                          <div className={cn(
                            "flex flex-col items-center justify-center min-h-[40px] rounded text-[11px] font-bold px-1 py-0.5 transition-all",
                            iWon  ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" :
                            iLost ? "bg-destructive/10 text-destructive/80 hover:bg-destructive/15" :
                            "text-muted-foreground hover:bg-secondary/40"
                          )}>
                            <span className="score-display text-sm leading-tight">{myLegs} - {oppLegs}</span>
                            {avg && <span className="text-[9px] font-normal text-muted-foreground/70 leading-tight">({avg})</span>}
                          </div>
                        ) : isLive ? (
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 border-2 border-primary pulse-live mx-auto">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-8 h-8 rounded-full border border-border/50 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 mx-auto transition-all">
                            {matchNumber[m.id] ?? "?"}
                          </div>
                        )}
                      </Link>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center text-xs font-semibold">
                  {st ? (
                    <><span className="text-green-400">{st.won}</span>
                    <span className="text-muted-foreground"> - </span>
                    <span className="text-destructive/80">{st.lost}</span></>
                  ) : ""}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted-foreground score-display">
                  {st ? `${st.legsWon} - ${st.legsLost}` : ""}
                </td>
                <td className="px-2 py-2 text-center text-sm font-bold text-primary">
                  {st ? rowIdx + 1 : ""}
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

  const winnerRounds = [...new Set(
    matches.filter((m) => !m.isLosersBracket).map((m) => m.round)
  )].sort((a, b) => a - b)

  const loserRounds = [...new Set(
    matches.filter((m) => m.isLosersBracket).map((m) => m.round)
  )].sort((a, b) => a - b)

  const totalWinnerRounds = winnerRounds.length

  function getRoundLabel(idx: number, total: number) {
    const fromEnd = total - 1 - idx
    if (fromEnd === 0) return "Финал"
    if (fromEnd === 1) return "Хагас финал"
    if (fromEnd === 2) return "Улирал финал"
    const playerCount = Math.pow(2, fromEnd + 1)
    return `Round of ${Number.isFinite(playerCount) && playerCount < 1e9 ? playerCount : idx + 1}`
  }

  const winnerMatchesByRound = winnerRounds.map((r, idx) => ({
    round: r,
    label: getRoundLabel(idx, totalWinnerRounds),
    matches: matches.filter((m) => !m.isLosersBracket && m.round === r),
  }))

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-0 min-w-max">
        {winnerMatchesByRound.map(({ round, label, matches: roundMatches }, roundIdx) => {
          const isLast = roundIdx === winnerMatchesByRound.length - 1
          const prevCount = roundIdx > 0 ? winnerMatchesByRound[roundIdx - 1].matches.length : roundMatches.length * 2
          const matchHeight = 72
          const gap = roundIdx === 0 ? 8 : (prevCount / roundMatches.length - 1) * matchHeight + 8

          return (
            <div key={round} className="flex">
              <div className="flex flex-col" style={{ minWidth: 160 }}>
                <div className="text-center pb-2 px-2">
                  <p className="text-xs font-semibold text-foreground/80">{label}</p>
                  <p className="text-[10px] text-muted-foreground">First to {firstTo} {legLabel}</p>
                </div>
                <div className="flex flex-col" style={{ gap }}>
                  {roundMatches.map((match) => (
                    <MatchSlot key={match.id} match={match} playerMap={playerMap} sessionId={sessionId} />
                  ))}
                </div>
              </div>
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

// ── Match slot (Elimination) ──────────────────────────────────────────────────

function MatchSlot({ match: m, playerMap, sessionId, compact = false }: {
  match: LocalMatch
  playerMap: Record<string, LocalPlayer>
  sessionId: string
  compact?: boolean
}) {
  function pName(id: string | "bye" | null) {
    if (!id) return "Тодорхойгүй"
    if (id === "bye") return "BYE"
    return playerMap[id]?.name ?? "?"
  }

  const isLive = m.status === "ongoing"
  const isDone = m.status === "completed"
  const isTBD  = !m.player1Id || !m.player2Id
  const isBye  = m.player1Id === "bye" || m.player2Id === "bye"
  const slotH  = compact ? "h-5" : "h-7"
  const textSz = compact ? "text-[11px]" : "text-xs"

  const inner = (
    <div className={cn(
      "border-2 rounded-lg overflow-hidden transition-all",
      isLive ? "border-primary shadow-md shadow-primary/20" :
      isDone ? "border-green-500/30 hover:border-green-500/50" :
      isTBD  ? "border-border/30 opacity-60" :
      "border-border/50 hover:border-primary/40"
    )}>
      {[{ id: m.player1Id, legs: m.player1Legs }, { id: m.player2Id, legs: m.player2Legs }].map((p, side) => (
        <div key={side}>
          {side === 1 && <div className="h-px bg-border/40" />}
          <div className={cn(
            "flex items-center justify-between gap-2 px-2.5 bg-card", slotH,
            isDone && m.winnerId === p.id ? "bg-green-500/10" : "",
            isDone && m.winnerId !== p.id && m.winnerId !== null ? "opacity-50" : "",
          )}>
            <span className={cn("truncate font-medium", textSz,
              isDone && m.winnerId === p.id ? "text-green-400" : "")}>
              {pName(p.id)}
            </span>
            {(isLive || isDone) && p.id !== "bye" && (
              <span className={cn("font-bold score-display shrink-0", textSz,
                isDone && m.winnerId === p.id ? "text-green-400" : "text-muted-foreground")}>
                {p.legs}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // TBD болон BYE: link байхгүй
  if (isTBD || isBye) return inner

  // Бусад бүх match (pending/ongoing/completed): live view
  return (
    <Link href={`/local/${sessionId}/match/${m.id}/live`} className="block">
      {inner}
    </Link>
  )
}

// ── Bracket connector lines ───────────────────────────────────────────────────

function BracketConnector({ matchCount, matchHeight, gap, nextGap }: {
  matchCount: number; matchHeight: number; gap: number; nextGap: number
}) {
  const pairs = matchCount / 2
  const pairHeight = matchHeight * 2 + gap
  return (
    <div className="flex flex-col relative" style={{ width: 24 }}>
      {Array.from({ length: pairs }).map((_, i) => (
        <div key={i} className="relative" style={{ height: pairHeight, marginBottom: i < pairs - 1 ? nextGap : 0 }}>
          <div className="absolute right-0 bg-border/60" style={{ width: 2, top: matchHeight / 2, height: (pairHeight - matchHeight) / 2 }} />
          <div className="absolute right-0 bg-border/60" style={{ width: 2, top: pairHeight / 2, height: (pairHeight - matchHeight) / 2 }} />
          <div className="absolute bg-border/60" style={{ height: 2, right: 0, left: 0, top: pairHeight / 2 - 1 }} />
        </div>
      ))}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}
