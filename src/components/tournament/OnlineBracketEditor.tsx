"use client"

import { useState, useEffect } from "react"
import { ChevronRight, Minus, Plus, RotateCcw, Save, Shuffle, Trash2, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { BracketMatch, BracketEntrant } from "@/hooks/useTournamentBracket"

interface Props {
  tournamentId: string
  bracketType: string
  groupsCount: number
  groupAdvance: number
  firstTo: number
  setsEnabled: boolean
  entrants: Record<string, BracketEntrant>
  matches: BracketMatch[]
  onRefresh: () => Promise<void>
}

const groupLabel = (gno: number) => `Бүлэг ${String.fromCharCode(64 + gno)}`

function EntrantSelect({ value, entrants, onChange, placeholder = "— TBD —" }: {
  value: string | null
  entrants: BracketEntrant[]
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
      {entrants.map((e) => (
        <option key={e.id} value={e.id}>{e.display_name}</option>
      ))}
    </select>
  )
}

export function OnlineBracketEditor({ tournamentId, bracketType, groupsCount, groupAdvance, firstTo, setsEnabled, entrants, matches, onRefresh }: Props) {
  const allEntrants = Object.values(entrants).sort((a, b) => a.seed - b.seed)

  // Local group assignment state (entrantId → groupNo)
  const [groupAssignments, setGroupAssignments] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init: Record<string, number> = {}
    for (const e of allEntrants) {
      if (e.group_no != null) init[e.id] = e.group_no
    }
    setGroupAssignments(init)
    setDirty(false)
  }, [entrants]) // eslint-disable-line react-hooks/exhaustive-deps

  function moveToGroup(entrantId: string, gno: number) {
    setGroupAssignments((prev) => ({ ...prev, [entrantId]: gno }))
    setDirty(true)
  }

  function handleRandom() {
    const shuffled = [...allEntrants].sort(() => Math.random() - 0.5)
    const next: Record<string, number> = {}
    shuffled.forEach((e, i) => { next[e.id] = (i % groupsCount) + 1 })
    setGroupAssignments(next); setDirty(true)
    toast.success("Тоглогчид санамсаргүй байдлаар бүлэгт хуваарилагдлаа")
  }

  function handleClear() {
    const sorted = [...allEntrants].sort((a, b) => a.seed - b.seed)
    const next: Record<string, number> = {}
    sorted.forEach((e, i) => { next[e.id] = (i % groupsCount) + 1 })
    setGroupAssignments(next); setDirty(true)
    toast.success("Бүлгийн хуваарилалт цэвэрлэгдлээ")
  }

  async function handleSave() {
    setSaving(true)
    const assignments = Object.entries(groupAssignments).map(([entrantId, groupNo]) => ({ entrantId, groupNo }))
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket/assign-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    })
    const j = await res.json()
    if (!res.ok) toast.error(j.error ?? "Алдаа гарлаа")
    else { toast.success("Хуваарилалт хадгалагдлаа"); setDirty(false); await onRefresh() }
    setSaving(false)
  }

  async function assignSlot(matchId: string, side: 1 | 2, entrantId: string | null) {
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket/assign-slot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, side, entrantId }),
    })
    const j = await res.json()
    if (!res.ok) toast.error(j.error ?? "Алдаа гарлаа")
    else await onRefresh()
  }

  async function handleAutoKO() {
    const res = await fetch(`/api/tournaments/${tournamentId}/advance-knockout`, { method: "POST" })
    const j = await res.json()
    if (!res.ok) toast.error(j.error ?? "Алдаа гарлаа")
    else { toast.success("Knockout bracket автоматаар нөхөгдлөө"); await onRefresh() }
  }

  // ── Groups + Knockout ────────────────────────────────────────────────────────
  if (bracketType === "groups_knockout") {
    const groupNos = Array.from({ length: groupsCount }, (_, i) => i + 1)
    const koMatches = matches.filter((m) => m.group_no == null).sort((a, b) => a.round - b.round || a.match_number - b.match_number)
    const koRounds = [...new Set(koMatches.map((m) => m.round))].sort((a, b) => a - b)
    const maxKoRound = koRounds[koRounds.length - 1] ?? 0
    const koSeeded = koMatches.some((m) => m.side1_entrant_id || m.side2_entrant_id)

    function koRoundLabel(round: number) {
      const dist = maxKoRound - round
      if (dist === 0) return "Final"
      if (dist === 1) return "Semi-final"
      if (dist === 2) return "Quarter-final"
      return `Round of ${Math.pow(2, dist + 1)}`
    }

    const groupMatchesAny = matches.some((m) => m.group_no != null && m.status !== "pending")

    return (
      <div className="space-y-6">
        {/* ── GROUP ASSIGNMENT ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">
                Round Robin ({setsEnabled ? `First to ${firstTo} Sets` : `First to ${firstTo} Legs`})
              </h3>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRandom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
                <Shuffle className="h-3.5 w-3.5" />
                Automatic assignment
                <span className="opacity-60 text-[10px]">Random</span>
              </button>
              <button onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-xs font-medium transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          {groupMatchesAny && (
            <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2">
              Зарим бүлгийн тоглолт аль хэдийн эхэлсэн тул хуваарилалт өөрчлөх боломжгүй.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groupNos.map((gno) => {
              const groupEnts = allEntrants.filter((e) => (groupAssignments[e.id] ?? e.group_no) === gno)
              return (
                <Card key={gno} className="border-border/50 bg-card/80">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">{groupLabel(gno)}</p>
                      <Badge variant="outline" className="text-xs border-border/60">{groupEnts.length} тоглогч</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {groupEnts.length === 0 ? (
                        <p className="text-xs text-muted-foreground/50 text-center py-2">Тоглогч байхгүй</p>
                      ) : groupEnts.map((e, i) => (
                        <div key={e.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                          <div className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30 text-sm font-medium truncate">
                            {e.display_name}
                          </div>
                          <select
                            value={gno}
                            disabled={groupMatchesAny}
                            onChange={(ev) => {
                              const newGno = parseInt(ev.target.value)
                              if (newGno !== gno) moveToGroup(e.id, newGno)
                            }}
                            className="h-7 w-24 rounded-md border border-border/60 bg-secondary/50 px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          >
                            {groupNos.map((g) => (
                              <option key={g} value={g}>{groupLabel(g)}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {dirty && !groupMatchesAny && (
            <Button onClick={handleSave} disabled={saving} className="w-full glow-primary">
              {saving ? <RotateCcw className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Хуваарилалт хадгалах
            </Button>
          )}
        </section>

        {/* ── KNOCKOUT ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
            <h3 className="font-bold text-sm">Knockout шат</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40">
            <Button size="sm" onClick={handleAutoKO}
              className="bg-blue-500 hover:bg-blue-600 text-white border-0 h-7 text-xs">
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Round Robin-аас хуваарилах
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Булгээс гарах тоо:</span>
              <span className="h-7 px-3 flex items-center text-primary font-bold text-sm bg-primary/10 rounded-lg border border-primary/30">
                Top {groupAdvance}
              </span>
              <span className="text-xs text-muted-foreground/60">
                = KO шатанд {groupsCount * groupAdvance} тоглогч
              </span>
            </div>
          </div>

          {koRounds.length > 0 && (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-0 min-w-max">
                {koRounds.map((round, ri) => {
                  const roundMatches = koMatches.filter((m) => m.round === round)
                  const isLast = ri === koRounds.length - 1
                  const label = koRoundLabel(round)
                  const matchH = 72
                  const prevCount = ri > 0 ? koMatches.filter((m) => m.round === koRounds[ri - 1]).length : roundMatches.length * 2
                  const gap = ri === 0 ? 8 : (prevCount / roundMatches.length - 1) * matchH + 8

                  return (
                    <div key={round} className="flex">
                      <div className="flex flex-col min-w-[200px]">
                        <div className="text-center pb-3 px-2">
                          <p className="text-xs font-semibold">{label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {setsEnabled ? `First to ${firstTo} Sets` : `First to ${firstTo} Legs`}
                          </p>
                        </div>
                        <div className="flex flex-col" style={{ gap }}>
                          {roundMatches.map((m) => (
                            <KnockoutSlotEditor
                              key={m.id}
                              match={m}
                              entrants={allEntrants}
                              onAssign={(side, id) => assignSlot(m.id, side, id)}
                            />
                          ))}
                        </div>
                      </div>

                      {!isLast && (
                        <div className="flex items-center justify-center w-8 self-stretch">
                          <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}

                      {isLast && (
                        <div className="flex flex-col min-w-[120px] ml-0">
                          <div className="text-center pb-3">
                            <p className="text-xs font-semibold">Winner</p>
                            <p className="text-[10px] text-muted-foreground opacity-0">-</p>
                          </div>
                          <div className="flex flex-col justify-center" style={{ gap }}>
                            {roundMatches.map((m) => (
                              <div key={m.id} className="flex items-center gap-2 h-[68px]">
                                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-[oklch(0.78_0.16_85)]/30 bg-[oklch(0.78_0.16_85)]/5 h-10 min-w-[100px]">
                                  <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)] shrink-0" />
                                  <span className="text-xs font-semibold text-[oklch(0.78_0.16_85)] truncate">
                                    {m.winner_entrant_id
                                      ? entrants[m.winner_entrant_id]?.display_name ?? "?"
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
          )}

          {!koSeeded && koRounds.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Бүлгийн шат дуусахад KO bracket нөхөгдөнө
            </p>
          )}
        </section>
      </div>
    )
  }

  // ── Single / Double Elimination ────────────────────────────────────────────
  if (bracketType === "single_elimination" || bracketType === "double_elimination") {
    const allRounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
    const r1 = allRounds[0]
    const r1Matches = matches.filter((m) => m.round === r1 && !m.is_losers_bracket).sort((a, b) => a.match_number - b.match_number)

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
          <h3 className="font-bold text-sm">
            {bracketType === "double_elimination" ? "Double" : "Single"} Elimination — Round 1
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">Round 1-д тоглогчдыг гараар тохируулна</p>
        <div className="space-y-2">
          {r1Matches.map((m, i) => (
            <Card key={m.id} className="border-border/50 bg-card/80">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-xs text-muted-foreground shrink-0">Match {i + 1}</span>
                <EntrantSelect
                  value={m.side1_entrant_id}
                  entrants={allEntrants}
                  onChange={(id) => assignSlot(m.id, 1, id)}
                />
                <span className="text-xs text-muted-foreground shrink-0">vs</span>
                <EntrantSelect
                  value={m.side2_entrant_id}
                  entrants={allEntrants}
                  onChange={(id) => assignSlot(m.id, 2, id)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Round Robin / Swiss — entrant жагсаалт ─────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="font-bold text-sm">{bracketType === "swiss" ? "Swiss" : "Round Robin"}</h3>
      </div>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 space-y-3">
          {allEntrants.map((e, i) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
              <div className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30 text-sm font-medium">
                {e.display_name}
              </div>
              <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                seed {e.seed}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Knockout slot editor ──────────────────────────────────────────────────────

function KnockoutSlotEditor({ match: m, entrants, onAssign }: {
  match: BracketMatch
  entrants: BracketEntrant[]
  onAssign: (side: 1 | 2, id: string | null) => void
}) {
  const isDone = m.status === "completed"
  const entrantMap = Object.fromEntries(entrants.map((e) => [e.id, e]))

  return (
    <div className={cn(
      "border-2 rounded-lg overflow-hidden",
      isDone ? "border-green-500/30 opacity-70" : "border-border/50"
    )}>
      {([1, 2] as const).map((side) => {
        const id = side === 1 ? m.side1_entrant_id : m.side2_entrant_id
        const isWinner = isDone && m.winner_entrant_id === id
        return (
          <div key={side}>
            {side === 2 && <div className="h-px bg-border/30" />}
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-card h-9">
              {isDone ? (
                <span className={cn("text-xs font-medium flex-1 truncate",
                  isWinner ? "text-green-400 font-bold" : "text-muted-foreground")}>
                  {id ? (entrantMap[id]?.display_name ?? "?") : "Тодорхойгүй"}
                </span>
              ) : (
                <select
                  value={id ?? ""}
                  onChange={(e) => onAssign(side, e.target.value || null)}
                  className="h-7 flex-1 min-w-0 rounded border border-border/60 bg-secondary/50 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="">— TBD —</option>
                  {entrants.map((e) => (
                    <option key={e.id} value={e.id}>{e.display_name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
