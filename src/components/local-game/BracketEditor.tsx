"use client"

import { useState } from "react"
import { ChevronRight, Minus, Plus, RotateCcw, Shuffle, Trash2, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { LocalSession, LocalMatch } from "@/lib/local-game/types"
import { toast } from "sonner"

interface Props {
  session: LocalSession
  sessionId: string
}

// Player dropdown selector
function PlayerSelect({ value, players, onChange, placeholder = "— TBD —" }: {
  value: string | null
  players: { id: string; name: string }[]
  onChange: (id: string | null) => void
  placeholder?: string
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-8 flex-1 min-w-0 rounded-md border border-border/60 bg-secondary/50 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
    >
      <option value="">{placeholder}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}

export function BracketEditor({ session, sessionId }: Props) {
  const movePlayerToGroup = useLocalGame((s) => s.movePlayerToGroup)
  const assignBracketSlot = useLocalGame((s) => s.assignBracketSlot)
  const autoAssignKnockout = useLocalGame((s) => s.autoAssignKnockout)
  const setConcurrentMatches = useLocalGame((s) => s.setConcurrentMatches)
  const rebuildKnockout = useLocalGame((s) => s.rebuildKnockout)

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const allPlayers = session.players

  // Concurrent matches бүлэгт (stored in session as any)
  const concurrentMap: Record<string, number> = (session as any).concurrentMatchesPerGroup ?? {}

  function handleAutoAssign() {
    const hasStandings = Object.values(session.standings).some((s) => s.played > 0)
    if (!hasStandings && session.bracketType === "groups_knockout") {
      toast.error("Бүлгийн шатны тоглолтууд дуусаагүй байна")
      return
    }
    autoAssignKnockout(sessionId)
    toast.success("Knockout bracket автоматаар нөхөгдлөө")
  }

  function handleRandomGroups() {
    // Shuffle players and distribute evenly to groups
    const shuffled = [...session.players].sort(() => Math.random() - 0.5)
    const groupIds = session.groups.map((g) => g.id)
    shuffled.forEach((player, i) => {
      const targetGroupId = groupIds[i % groupIds.length]
      movePlayerToGroup(sessionId, player.id, targetGroupId)
    })
    toast.success("Тоглогчид санамсаргүй байдлаар бүлэгт хуваарилагдлаа")
  }

  function handleClearGroups() {
    // Move all players to first group (clear assignments)
    if (session.groups.length === 0) return
    const firstGroupId = session.groups[0].id
    session.players.forEach((player) => {
      movePlayerToGroup(sessionId, player.id, firstGroupId)
    })
    toast.success("Бүлгийн хуваарилалт цэвэрлэгдлээ")
  }

  // ── ROUND ROBIN / GROUPS: group assignment editor
  const hasGroups = session.groups.length > 0
  const hasKnockout = session.matches.some((m) => m.round >= 100)
  const koMatches = session.matches.filter((m) => m.round >= 100).sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber)
  const koRounds = [...new Set(koMatches.map((m) => m.round))].sort((a, b) => a - b)
  const maxKoRound = koRounds.length > 0 ? Math.max(...koRounds) : 0

  function koRoundLabel(round: number) {
    const dist = maxKoRound - round
    if (dist === 0) return "Final"
    if (dist === 1) return "Semi-final"
    if (dist === 2) return "Quarter-final"
    return `Round of ${Math.pow(2, dist + 1)}`
  }

  return (
    <div className="space-y-6">

      {/* ── GROUP ASSIGNMENT ── */}
      {hasGroups && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">
                Round Robin ({session.setsEnabled
                  ? `First to ${session.firstTo} Sets`
                  : `First to ${session.firstTo} Legs`})
              </h3>
            </div>
            {/* n01дартс шиг товчнууд */}
            <div className="flex gap-2">
              <button onClick={handleRandomGroups}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
                <Shuffle className="h-3.5 w-3.5" />
                Automatic assignment
                <span className="opacity-60 text-[10px]">Random</span>
              </button>
              <button onClick={handleClearGroups}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-xs font-medium transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {session.groups.map((group) => {
              const concurrent = concurrentMap[group.id] ?? 1
              const groupPlayers = group.playerIds.map((id) => playerMap[id]).filter(Boolean)

              return (
                <Card key={group.id} className="border-border/50 bg-card/80">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">{group.name}</p>
                      <Badge variant="outline" className="text-xs border-border/60">{groupPlayers.length} тоглогч</Badge>
                    </div>

                    {/* Players with group dropdown */}
                    <div className="space-y-1.5">
                      {groupPlayers.map((player, i) => (
                        <div key={player.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                          <div className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30 text-sm font-medium truncate">
                            {player.name}
                          </div>
                          {/* Move to group dropdown */}
                          <select
                            value={group.id}
                            onChange={(e) => {
                              if (e.target.value !== group.id) {
                                movePlayerToGroup(sessionId, player.id, e.target.value)
                                toast.success(`${player.name} → ${session.groups.find(g => g.id === e.target.value)?.name}`)
                              }
                            }}
                            className="h-7 w-24 rounded-md border border-border/60 bg-secondary/50 px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {session.groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Concurrent matches */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                      <span className="text-xs text-muted-foreground flex-1">Нэгэн зэрэг явагдах тоглолт</span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setConcurrentMatches(sessionId, group.id, Math.max(1, concurrent - 1))}
                          className="h-6 w-6 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary text-xs"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <div className="h-6 w-8 flex items-center justify-center border-y border-border/60 bg-primary/15 text-primary text-xs font-bold">
                          {concurrent}
                        </div>
                        <button
                          type="button"
                          onClick={() => setConcurrentMatches(sessionId, group.id, Math.min(groupPlayers.length, concurrent + 1))}
                          className="h-6 w-6 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary text-xs"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* ── KNOCKOUT BRACKET EDITOR ── */}
      {hasKnockout && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
            <h3 className="font-bold text-sm">Knockout шат</h3>
          </div>

          {/* Auto-assign controls */}
          {hasGroups && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40">
              <Button size="sm" onClick={handleAutoAssign}
                className="bg-blue-500 hover:bg-blue-600 text-white border-0 h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Round Robin-аас хуваарилах
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Бүлгээс гарах тоо:</span>
                <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
                  <button type="button"
                    onClick={() => {
                      const next = Math.max(1, session.groupAdvance - 1)
                      rebuildKnockout(sessionId, next)
                      toast.success(`Top ${next} болов — KO bracket дахин үүслээ`)
                    }}
                    className="h-7 w-6 flex items-center justify-center hover:bg-secondary border-r border-border/60 text-xs">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="h-7 px-3 flex items-center text-primary font-bold text-sm bg-primary/10">
                    Top {session.groupAdvance}
                  </span>
                  <button type="button"
                    onClick={() => {
                      const maxAdv = Math.max(1, session.groups[0]?.playerIds.length - 1 || 1)
                      const next = Math.min(maxAdv, session.groupAdvance + 1)
                      rebuildKnockout(sessionId, next)
                      toast.success(`Top ${next} болов — KO bracket дахин үүслээ`)
                    }}
                    className="h-7 w-6 flex items-center justify-center hover:bg-secondary border-l border-border/60 text-xs">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground/60">
                  = KO шатанд {session.groups.length * session.groupAdvance} тоглогч
                </span>
              </div>
            </div>
          )}

          {/* Bracket slots with dropdowns */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-0 min-w-max">
              {koRounds.map((round, ri) => {
                const roundMatches = koMatches.filter((m) => m.round === round)
                const isLast = ri === koRounds.length - 1
                const label = koRoundLabel(round)
                const matchH = 72
                const gap = ri === 0 ? 8 : ((koRounds[ri - 1] ? koMatches.filter(m => m.round === koRounds[ri - 1]).length : 1) / roundMatches.length - 1) * matchH + 8

                return (
                  <div key={round} className="flex">
                    {/* Round column */}
                    <div className="flex flex-col min-w-[200px]">
                      <div className="text-center pb-3 px-2">
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {session.setsEnabled
                            ? `First to ${session.firstTo} Sets`
                            : `First to ${session.firstTo} Legs`}
                        </p>
                      </div>
                      <div className="flex flex-col" style={{ gap }}>
                        {roundMatches.map((match) => (
                          <KnockoutSlotEditor
                            key={match.id}
                            match={match}
                            players={allPlayers}
                            onAssignP1={(id) => assignBracketSlot(sessionId, match.id, "p1", id)}
                            onAssignP2={(id) => assignBracketSlot(sessionId, match.id, "p2", id)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Arrow connector */}
                    {!isLast && (
                      <div className="flex items-center justify-center w-8 self-stretch">
                        <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}

                    {/* Winner column after final */}
                    {isLast && (
                      <div className="flex flex-col min-w-[120px] ml-0">
                        <div className="text-center pb-3">
                          <p className="text-xs font-semibold">Winner</p>
                          <p className="text-[10px] text-muted-foreground opacity-0">-</p>
                        </div>
                        <div className="flex flex-col justify-center" style={{ gap }}>
                          {roundMatches.map((match) => (
                            <div key={match.id} className="flex items-center gap-2 h-[68px]">
                              <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-[oklch(0.78_0.16_85)]/30 bg-[oklch(0.78_0.16_85)]/5 h-10 min-w-[100px]">
                                <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)] shrink-0" />
                                <span className="text-xs font-semibold text-[oklch(0.78_0.16_85)] truncate">
                                  {match.winnerId
                                    ? playerMap[match.winnerId]?.name ?? "?"
                                    : "Тодорхойгүй"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* RR only (no groups, no knockout) */}
      {!hasGroups && !hasKnockout && session.bracketType === "round_robin" && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">Round Robin</h3>
          </div>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 space-y-3">
              {/* Seed reorder */}
              {session.players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30 text-sm font-medium">
                    {p.name}
                  </div>
                  <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                    seed {p.seed}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Single/Double Elimination bracket editor */}
      {!hasGroups && hasKnockout && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
            <h3 className="font-bold text-sm">
              {session.bracketType === "double_elimination" ? "Double Elimination" : "Single Elimination"} Bracket
            </h3>
          </div>

          {/* Round 1 slot editor */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Round 1-д тоглогчдыг гараар тохируулна</p>
            {koMatches.filter((m) => m.round === Math.min(...koRounds)).map((match, i) => (
              <Card key={match.id} className="border-border/50 bg-card/80">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="text-xs text-muted-foreground shrink-0">Match {i + 1}</span>
                  <PlayerSelect
                    value={match.player1Id === "bye" ? null : match.player1Id}
                    players={allPlayers}
                    onChange={(id) => assignBracketSlot(sessionId, match.id, "p1", id)}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">vs</span>
                  <PlayerSelect
                    value={match.player2Id === "bye" ? null : match.player2Id}
                    players={allPlayers}
                    onChange={(id) => assignBracketSlot(sessionId, match.id, "p2", id)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Knockout slot editor ─────────────────────────────────────────

function KnockoutSlotEditor({ match, players, onAssignP1, onAssignP2 }: {
  match: LocalMatch
  players: { id: string; name: string }[]
  onAssignP1: (id: string | null) => void
  onAssignP2: (id: string | null) => void
}) {
  const isDone = match.status === "completed"
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  return (
    <div className={cn(
      "border-2 rounded-lg overflow-hidden",
      isDone ? "border-green-500/30 opacity-70" : "border-border/50"
    )}>
      {/* Slot 1 */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-card border-b border-border/30 h-9">
        {isDone ? (
          <span className={cn("text-xs font-medium flex-1 truncate",
            match.winnerId === match.player1Id ? "text-green-400 font-bold" : "text-muted-foreground")}>
            {match.player1Id ? playerMap[match.player1Id]?.name ?? "?" : "Тодорхойгүй"}
          </span>
        ) : (
          <PlayerSelect
            value={match.player1Id === "bye" || !match.player1Id ? null : match.player1Id}
            players={players}
            onChange={onAssignP1}
          />
        )}
      </div>
      {/* Slot 2 */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-card h-9">
        {isDone ? (
          <span className={cn("text-xs font-medium flex-1 truncate",
            match.winnerId === match.player2Id ? "text-green-400 font-bold" : "text-muted-foreground")}>
            {match.player2Id ? playerMap[match.player2Id]?.name ?? "?" : "Тодорхойгүй"}
          </span>
        ) : (
          <PlayerSelect
            value={match.player2Id === "bye" || !match.player2Id ? null : match.player2Id}
            players={players}
            onChange={onAssignP2}
          />
        )}
      </div>
    </div>
  )
}
