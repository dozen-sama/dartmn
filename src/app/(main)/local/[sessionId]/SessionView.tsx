"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ChevronRight, ListOrdered, Minus, Plus, RotateCcw,
  Save, Settings, Trophy, Users, Zap,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { LocalMatch, LocalPlayer } from "@/lib/local-game/types"
import { BracketView } from "@/components/local-game/BracketView"
import { toast } from "sonner"

const BRACKET_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  groups_knockout: "Groups + Knockout",
  swiss: "Swiss",
}

export function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const session = useLocalGame((s) => s.sessions[sessionId])
  const addSwissRound = useLocalGame((s) => s.addSwissRound)
  const advanceGroupsToKnockout = useLocalGame((s) => s.advanceGroupsToKnockout)
  const updateSession = useLocalGame((s) => s.updateSession)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Edit state — initialized after mount (uses session values)
  const [editName, setEditName] = useState("")
  const [editFirstTo, setEditFirstTo] = useState(2)
  const [editSetsEnabled, setEditSetsEnabled] = useState(false)
  const [editLegsPerSet, setEditLegsPerSet] = useState(3)
  const [editDoubleOut, setEditDoubleOut] = useState(true)
  const [editDoubleIn, setEditDoubleIn] = useState(false)
  const [editLoserFirst, setEditLoserFirst] = useState(false)
  const [editLimitEnabled, setEditLimitEnabled] = useState(false)
  const [editLimitRounds, setEditLimitRounds] = useState(15)
  const [editShowAvg, setEditShowAvg] = useState(true)
  const [editAutoComplete, setEditAutoComplete] = useState(true)
  const [editAllowParticipant, setEditAllowParticipant] = useState(false)
  const [editShowIndex, setEditShowIndex] = useState(true)
  const [editPointWon, setEditPointWon] = useState(2)
  const [editPointDraw, setEditPointDraw] = useState(1)
  const [editPointLost, setEditPointLost] = useState(0)
  const [settingsInitialized, setSettingsInitialized] = useState(false)

  useEffect(() => {
    if (session && !settingsInitialized) {
      setEditName(session.name)
      setEditFirstTo(session.firstTo)
      setEditSetsEnabled(session.setsEnabled)
      setEditLegsPerSet(session.legsPerSet)
      setEditDoubleOut(session.doubleOut)
      setEditDoubleIn(session.doubleIn)
      setEditLoserFirst(session.loserFirst)
      setEditLimitEnabled(!!session.limitRounds)
      setEditLimitRounds(session.limitRounds ?? 15)
      setEditShowAvg(session.showAverage)
      setEditAutoComplete(session.autoComplete)
      setEditAllowParticipant(session.allowParticipantScore)
      setEditShowIndex(session.showIndex)
      setEditPointWon(session.pointWon)
      setEditPointDraw(session.pointDraw)
      setEditPointLost(session.pointLost)
      setSettingsInitialized(true)
    }
  }, [session, settingsInitialized])

  function saveSettings() {
    if (!editName.trim()) return toast.error("Нэр оруулна уу")
    updateSession(sessionId, {
      name: editName.trim(),
      firstTo: editFirstTo,
      setsEnabled: editSetsEnabled,
      legsPerSet: editLegsPerSet,
      doubleOut: editDoubleOut,
      doubleIn: editDoubleIn,
      loserFirst: editLoserFirst,
      limitRounds: editLimitEnabled ? editLimitRounds : null,
      showAverage: editShowAvg,
      autoComplete: editAutoComplete,
      allowParticipantScore: editAllowParticipant,
      showIndex: editShowIndex,
      pointWon: editPointWon,
      pointDraw: editPointDraw,
      pointLost: editPointLost,
    })
    toast.success("Тохиргоо хадгалагдлаа")
  }

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Тоглолт олдсонгүй</p>
        <Link href="/local" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Буцах</Link>
      </div>
    )
  }

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const pendingMatches = session.matches.filter((m) => m.status === "pending" && m.player1Id && m.player2Id && m.player1Id !== "bye" && m.player2Id !== "bye")
  const ongoingMatches = session.matches.filter((m) => m.status === "ongoing")
  const completedMatches = session.matches.filter((m) => m.status === "completed")

  const rounds = [...new Set(session.matches.map((m) => m.round))].sort((a, b) => a - b)
  const allCurrentRoundDone = session.bracketType === "swiss"
    ? pendingMatches.filter((m) => m.round === Math.max(...session.matches.map((m) => m.round))).length === 0
    : false

  const groupStageComplete = session.bracketType === "groups_knockout"
    && session.phase === "group_stage"
    && session.matches.filter((m) => m.round < 100 && m.player1Id !== "bye" && m.player2Id !== "bye").every((m) => m.status === "completed")

  function pName(id: string | "bye" | null): string {
    if (!id) return "TBD"
    if (id === "bye") return "BYE"
    return playerMap[id]?.name ?? "?"
  }

  function matchStatusColor(m: LocalMatch) {
    if (m.status === "completed") return "bg-green-500/10 border-green-500/20"
    if (m.status === "ongoing") return "bg-primary/10 border-primary/20"
    if (!m.player1Id || !m.player2Id) return "bg-secondary/30 border-border/20 opacity-50"
    return "bg-card/80 border-border/40 hover:border-border card-hover"
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/local" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 mt-0.5")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs border-border/60">{session.format.toUpperCase()}</Badge>
              <Badge variant="outline" className="text-xs border-border/60">{BRACKET_LABELS[session.bracketType]}</Badge>
              <Badge variant="outline" className="text-xs border-border/60">BO{session.firstTo}</Badge>
              {session.status === "active" ? (
                <Badge className="text-xs bg-primary/15 text-primary border-primary/30 pulse-live">Явагдаж байна</Badge>
              ) : (
                <Badge className="text-xs bg-green-500/15 text-green-400 border-green-500/30">Дууссан</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Swiss: add round */}
        {session.bracketType === "swiss" && allCurrentRoundDone && session.status === "active" && (
          <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 shrink-0"
            onClick={() => { addSwissRound(sessionId); toast.success("Шинэ Swiss round нэмэгдлээ") }}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Дараагийн round
          </Button>
        )}

        {/* Groups → Knockout */}
        {groupStageComplete && (
          <Button size="sm" className="glow-primary shrink-0"
            onClick={() => { advanceGroupsToKnockout(sessionId); toast.success("Knockout шат эхэллээ!") }}>
            <ChevronRight className="h-4 w-4 mr-1.5" />
            Knockout эхлүүлэх
          </Button>
        )}
      </div>

      {/* Winner banner */}
      {session.status === "completed" && session.winnerId && (
        <Card className="border-[oklch(0.78_0.16_85)]/40 bg-[oklch(0.78_0.16_85)]/5">
          <CardContent className="flex items-center gap-4 p-5">
            <Trophy className="h-10 w-10 text-[oklch(0.78_0.16_85)]" />
            <div>
              <p className="text-sm text-muted-foreground">Ялагч</p>
              <p className="text-2xl font-bold text-[oklch(0.78_0.16_85)]">{pName(session.winnerId)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="bracket">
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="bracket">
            <Trophy className="h-4 w-4 mr-1.5" />
            Bracket
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <ListOrdered className="h-4 w-4 mr-1.5" />
            Хуваарь
          </TabsTrigger>
          {(session.bracketType === "round_robin" || session.bracketType === "swiss" || session.bracketType === "groups_knockout") && (
            <TabsTrigger value="standings">
              <Trophy className="h-4 w-4 mr-1.5" />
              Байрлал
            </TabsTrigger>
          )}
          <TabsTrigger value="players">
            <Users className="h-4 w-4 mr-1.5" />
            Тоглогчид
          </TabsTrigger>
          <TabsTrigger value="settings" className="ml-auto">
            <Settings className="h-4 w-4 mr-1.5" />
            Засах
          </TabsTrigger>
        </TabsList>

        {/* Bracket */}
        <TabsContent value="bracket" className="mt-4">
          <BracketView session={session} sessionId={sessionId} />
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          {rounds.map((round) => {
            const roundMatches = session.matches.filter((m) => m.round === round)
            if (roundMatches.length === 0) return null

            const isKnockoutRound = round >= 100
            const roundLabel = isKnockoutRound
              ? round === 99 ? "Grand Final"
                : `Knockout Round ${round - 99}`
              : session.bracketType === "single_elimination" || session.bracketType === "double_elimination"
                ? `Round ${round}`
                : session.bracketType === "swiss"
                  ? `Swiss Round ${round}`
                  : session.bracketType === "groups_knockout" && round < 100
                    ? "Group Stage"
                    : `Round ${round}`

            return (
              <div key={round}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{roundLabel}</p>
                <div className="space-y-2">
                  {roundMatches.map((match) => {
                    const canClick = match.status !== "completed"
                      && match.player1Id && match.player1Id !== "bye"
                      && match.player2Id && match.player2Id !== "bye"

                    return (
                      <div key={match.id} className={cn("rounded-lg border p-3 transition-all", matchStatusColor(match))}>
                        <div className="flex items-center gap-3">
                          {/* Player 1 */}
                          <div className={cn("flex-1 text-right", match.winnerId === match.player1Id && "font-bold text-green-400")}>
                            <p className="text-sm truncate">{pName(match.player1Id)}</p>
                            {match.status === "completed" && (
                              <p className="text-xl font-bold score-display">{match.player1Legs}</p>
                            )}
                          </div>

                          {/* VS / Score */}
                          <div className="flex flex-col items-center shrink-0 w-20">
                            {match.status === "pending" && <p className="text-xs text-muted-foreground">VS</p>}
                            {match.status === "ongoing" && (
                              <div className="flex items-center gap-1">
                                <span className="text-lg font-bold score-display text-primary">{match.player1Legs}</span>
                                <span className="text-muted-foreground">:</span>
                                <span className="text-lg font-bold score-display text-primary">{match.player2Legs}</span>
                              </div>
                            )}
                            {match.status === "completed" && (
                              <p className="text-xs text-muted-foreground">FINAL</p>
                            )}
                            {canClick && (
                              <Link
                                href={`/local/${sessionId}/match/${match.id}`}
                                className={cn(buttonVariants({ size: "sm" }), "mt-1 text-xs glow-primary")}
                              >
                                {match.status === "ongoing" ? <><Zap className="h-3 w-3 mr-1" />Үргэлжлэх</> : "Тоглох →"}
                              </Link>
                            )}
                          </div>

                          {/* Player 2 */}
                          <div className={cn("flex-1 text-left", match.winnerId === match.player2Id && "font-bold text-green-400")}>
                            <p className="text-sm truncate">{pName(match.player2Id)}</p>
                            {match.status === "completed" && (
                              <p className="text-xl font-bold score-display">{match.player2Legs}</p>
                            )}
                          </div>
                        </div>
                        {match.player1Id === "bye" || match.player2Id === "bye" ? (
                          <p className="text-center text-xs text-muted-foreground mt-1">BYE</p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </TabsContent>

        {/* Standings */}
        <TabsContent value="standings" className="mt-4">
          {session.bracketType === "groups_knockout" ? (
            <div className="space-y-4">
              {session.groups.map((group) => (
                <Card key={group.id} className="border-border/50 bg-card/80">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">{group.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <StandingsTable
                      playerIds={group.playerIds}
                      standings={session.standings}
                      playerMap={playerMap}
                      advanceCount={session.groupAdvance}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-0">
                <StandingsTable
                  playerIds={session.players.map((p) => p.id)}
                  standings={session.standings}
                  playerMap={playerMap}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Players */}
        <TabsContent value="players" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {session.players.map((p, i) => {
                const stats = session.standings[p.id]
                const wr = stats && stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
                    <span className="text-sm font-bold w-5 text-center text-muted-foreground">{p.seed}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      {stats && stats.played > 0 && (
                        <p className="text-xs text-muted-foreground">{stats.won}W {stats.lost}L · {wr}% WR</p>
                      )}
                    </div>
                    {session.winnerId === p.id && (
                      <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings / Edit */}
        <TabsContent value="settings" className="mt-4">
          <Card className="border-primary/20 bg-card/80">
            <CardContent className="p-5 space-y-5">
              <h2 className="font-bold flex items-center gap-2 text-primary">
                <Settings className="h-4 w-4" />
                Detail Setting
              </h2>

              {/* Name */}
              <div className="space-y-1.5">
                <Label>Competition Title</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>

              {/* Match format */}
              <div className="space-y-2">
                <Label>Match Format</Label>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">First to</span>
                    <div className="flex items-center">
                      <button type="button" onClick={() => setEditFirstTo((n) => Math.max(1, n - 1))}
                        className="h-8 w-8 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary">
                        <Minus className="h-3 w-3" />
                      </button>
                      <div className="h-8 w-12 flex items-center justify-center border-y border-border/60 bg-secondary/50 text-sm font-bold">{editFirstTo}</div>
                      <button type="button" onClick={() => setEditFirstTo((n) => Math.min(11, n + 1))}
                        className="h-8 w-8 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <button type="button" onClick={() => setEditSetsEnabled(!editSetsEnabled)}
                      className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all",
                        editSetsEnabled ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      Sets
                    </button>
                    <span className="text-muted-foreground">/</span>
                    {editSetsEnabled ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Legs/set</span>
                        <div className="flex items-center">
                          <button type="button" onClick={() => setEditLegsPerSet((n) => Math.max(1, n - 1))}
                            className="h-8 w-8 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary">
                            <Minus className="h-3 w-3" />
                          </button>
                          <div className="h-8 w-12 flex items-center justify-center border-y border-border/60 bg-secondary/50 text-sm font-bold">{editLegsPerSet}</div>
                          <button type="button" onClick={() => setEditLegsPerSet((n) => Math.min(11, n + 1))}
                            className="h-8 w-8 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground font-medium mb-5">Legs</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-primary/80">
                  {editSetsEnabled ? `First to ${editFirstTo} sets · ${editLegsPerSet} legs/set` : `First to ${editFirstTo} legs`}
                </p>
              </div>

              {/* Rules */}
              {(session.format === "501" || session.format === "301" || session.format === "170" || session.format === "121") && (
                <div className="space-y-2">
                  <Label>Дүрэм</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Double out", val: editDoubleOut, set: setEditDoubleOut },
                      { label: "Double in", val: editDoubleIn, set: setEditDoubleIn },
                      { label: "Loser First", val: editLoserFirst, set: setEditLoserFirst },
                    ].map(({ label, val, set }) => (
                      <label key={label} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="accent-primary" />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editLimitEnabled} onChange={(e) => setEditLimitEnabled(e.target.checked)} className="accent-primary" />
                      <span className="text-sm">Limit Rounds</span>
                    </label>
                    {editLimitEnabled && (
                      <Input type="number" value={editLimitRounds} onChange={(e) => setEditLimitRounds(parseInt(e.target.value) || 15)}
                        min={1} max={50} className="h-7 w-20 text-xs bg-secondary/50 border-border/60" />
                    )}
                  </div>
                </div>
              )}

              {/* Point system */}
              {(session.bracketType === "round_robin" || session.bracketType === "swiss" || session.bracketType === "groups_knockout") && (
                <div className="space-y-2">
                  <Label>Point System</Label>
                  <div className="flex gap-6">
                    {[
                      { label: "Won", val: editPointWon, set: setEditPointWon },
                      { label: "Draw", val: editPointDraw, set: setEditPointDraw },
                      { label: "Lost", val: editPointLost, set: setEditPointLost },
                    ].map(({ label, val, set }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <div className="flex items-center">
                          <button type="button" onClick={() => set(Math.max(0, val - 1))}
                            className="h-7 w-7 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary text-xs">
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <div className="h-7 w-10 flex items-center justify-center border-y border-border/60 bg-secondary/50 text-sm font-bold">{val}</div>
                          <button type="button" onClick={() => set(Math.min(10, val + 1))}
                            className="h-7 w-7 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary text-xs">
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="space-y-2">
                <Label>Competition Options</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: "Show average", val: editShowAvg, set: setEditShowAvg },
                    { label: "Automatic complete", val: editAutoComplete, set: setEditAutoComplete },
                    { label: "Participants can enter scores", val: editAllowParticipant, set: setEditAllowParticipant },
                    { label: "Show index in entry list", val: editShowIndex, set: setEditShowIndex },
                  ].map(({ label, val, set }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="accent-primary" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={saveSettings} className="w-full glow-primary">
                <Save className="h-4 w-4 mr-1.5" />
                Хадгалах (Done)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StandingsTable({ playerIds, standings, playerMap, advanceCount }: {
  playerIds: string[]
  standings: Record<string, import("@/lib/local-game/types").StandingRow>
  playerMap: Record<string, LocalPlayer>
  advanceCount?: number
}) {
  const rows = playerIds
    .map((id) => standings[id])
    .filter(Boolean)
    .sort((a, b) => b.points - a.points || b.legsWon - a.legsLost)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {["#", "Тоглогч", "T", "W", "L", "Leg+", "Leg-", "Pts"].map((h) => (
              <th key={h} className="text-left text-xs text-muted-foreground font-medium px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.playerId} className={cn(
              "border-b border-border/20 last:border-0",
              advanceCount && i < advanceCount ? "bg-green-500/5" : ""
            )}>
              <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2.5 font-medium">
                <div className="flex items-center gap-1.5">
                  {advanceCount && i < advanceCount && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                  {playerMap[row.playerId]?.name ?? "?"}
                </div>
              </td>
              <td className="px-3 py-2.5 score-display">{row.played}</td>
              <td className="px-3 py-2.5 score-display text-green-400">{row.won}</td>
              <td className="px-3 py-2.5 score-display text-destructive">{row.lost}</td>
              <td className="px-3 py-2.5 score-display">{row.legsWon}</td>
              <td className="px-3 py-2.5 score-display">{row.legsLost}</td>
              <td className="px-3 py-2.5 font-bold score-display text-primary">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
