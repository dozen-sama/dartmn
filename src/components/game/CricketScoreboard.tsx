"use client"

import { useState } from "react"
import { RotateCcw, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  CRICKET_NUMBERS, CricketTarget, CricketPlayerState,
  initCricketState, applyCricketHit, getCricketWinner,
  getMarkSymbol, getMarkColor,
} from "@/lib/cricket"
import { toast } from "sonner"

interface Player {
  id: string
  name: string
}

interface Props {
  players: [Player, Player]
  onWin: (winnerId: string) => void
}

const TARGET_LABELS: Record<string, string> = {
  "20": "20", "19": "19", "18": "18", "17": "17",
  "16": "16", "15": "15", "bull": "Bull",
}

export function CricketScoreboard({ players, onWin }: Props) {
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0)
  const [states, setStates] = useState<[CricketPlayerState, CricketPlayerState]>([
    initCricketState(), initCricketState(),
  ])
  const [pendingThrows, setPendingThrows] = useState<{ target: CricketTarget; times: number }[]>([])
  const [selectedTarget, setSelectedTarget] = useState<CricketTarget | null>(null)
  const [selectedTimes, setSelectedTimes] = useState<1 | 2 | 3>(1)
  const [winner, setWinner] = useState<string | null>(null)

  const p = players[activePlayer]
  const opp = players[activePlayer === 0 ? 1 : 0]

  function addThrow() {
    if (!selectedTarget) { toast.error("Тоо сонгоно уу"); return }
    if (pendingThrows.length >= 3) { toast.error("3 дарт дуусгасан"); return }
    const existing = pendingThrows.findIndex(t => t.target === selectedTarget)
    if (existing >= 0) {
      // Add more marks to same target
      const updated = [...pendingThrows]
      updated[existing].times = Math.min(3, updated[existing].times + selectedTimes)
      setPendingThrows(updated)
    } else {
      setPendingThrows([...pendingThrows, { target: selectedTarget, times: selectedTimes }])
    }
    setSelectedTarget(null)
  }

  function submitVisit() {
    if (pendingThrows.length === 0) {
      // Empty visit — just switch
      setActivePlayer(prev => prev === 0 ? 1 : 0)
      return
    }

    let newStates: [CricketPlayerState, CricketPlayerState] = [...states] as [CricketPlayerState, CricketPlayerState]

    pendingThrows.forEach(({ target, times }) => {
      const { myState, oppState } = applyCricketHit(
        newStates[activePlayer],
        newStates[activePlayer === 0 ? 1 : 0],
        target,
        times
      )
      newStates[activePlayer] = myState
      newStates[activePlayer === 0 ? 1 : 0] = oppState
    })

    setStates(newStates)
    setPendingThrows([])

    // Check winner
    const w = getCricketWinner(newStates[0], newStates[1])
    if (w) {
      const wId = w === "p1" ? players[0].id : players[1].id
      setWinner(wId)
      onWin(wId)
    } else {
      setActivePlayer(prev => prev === 0 ? 1 : 0)
    }
  }

  function resetGame() {
    setStates([initCricketState(), initCricketState()])
    setPendingThrows([])
    setSelectedTarget(null)
    setActivePlayer(0)
    setWinner(null)
  }

  if (winner) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)]" />
        <p className="text-2xl font-black text-[oklch(0.78_0.16_85)]">
          {players.find(p => p.id === winner)?.name} — Ялагч!
        </p>
        <button onClick={resetGame}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary">
          <RotateCcw className="h-4 w-4" />
          Дахин тоглох
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Cricket grid */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-3 py-2 text-left text-xs text-muted-foreground w-16">{players[0].name.slice(0, 8)}</th>
                <th className="px-3 py-2 text-center text-xs font-bold w-16">Оноо</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide w-16">№</th>
                <th className="px-3 py-2 text-center text-xs font-bold w-16">Оноо</th>
                <th className="px-3 py-2 text-right text-xs text-muted-foreground w-16">{players[1].name.slice(0, 8)}</th>
              </tr>
            </thead>
            <tbody>
              {CRICKET_NUMBERS.map((num) => {
                const key = String(num)
                const p1Mark = states[0].marks[key]
                const p2Mark = states[1].marks[key]
                const isPending = pendingThrows.some(t => String(t.target) === key)

                return (
                  <tr key={key} className={cn(
                    "border-b border-border/20 last:border-0",
                    isPending ? "bg-primary/10" : ""
                  )}>
                    {/* P1 marks */}
                    <td className="px-3 py-2 text-center">
                      <span className={cn("text-lg font-bold", getMarkColor(p1Mark.marks))}>
                        {getMarkSymbol(p1Mark.marks) || "·"}
                      </span>
                    </td>
                    {/* P1 score (if any) */}
                    <td className="px-3 py-2 text-center text-xs font-semibold">
                      {states[0].score > 0 || true ? "" : ""}
                    </td>
                    {/* Number */}
                    <td className="px-3 py-2 text-center font-black text-base">{TARGET_LABELS[key]}</td>
                    {/* P2 score */}
                    <td className="px-3 py-2 text-center text-xs font-semibold"></td>
                    {/* P2 marks */}
                    <td className="px-3 py-2 text-center">
                      <span className={cn("text-lg font-bold", getMarkColor(p2Mark.marks))}>
                        {getMarkSymbol(p2Mark.marks) || "·"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 border-t border-border/50">
                <td colSpan={2} className="px-3 py-2 text-center">
                  <span className="text-xl font-black text-primary score-display">{states[0].score}</span>
                </td>
                <td className="px-3 py-2 text-center text-xs text-muted-foreground">Оноо</td>
                <td colSpan={2} className="px-3 py-2 text-center">
                  <span className="text-xl font-black text-primary score-display">{states[1].score}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Active player */}
      <div className="text-center">
        <p className="text-sm font-bold text-primary">↑ {p.name}-ийн ээлж</p>
        {pendingThrows.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingThrows.map(t => `${TARGET_LABELS[String(t.target)]}×${t.times}`).join(" + ")}
          </p>
        )}
      </div>

      {/* Target selector */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 space-y-3">
          {/* Number grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {CRICKET_NUMBERS.map((num) => {
              const key = String(num)
              const myMark = states[activePlayer].marks[key]
              const isClosed = myMark.closed

              return (
                <button key={key} onClick={() => setSelectedTarget(num)}
                  className={cn(
                    "flex flex-col items-center py-2 rounded-lg border-2 text-xs font-bold transition-all",
                    selectedTarget === num ? "border-primary bg-primary/15 text-primary" :
                    isClosed ? "border-green-500/30 bg-green-500/10 text-green-400" :
                    "border-border/50 text-muted-foreground hover:border-border"
                  )}>
                  <span className={cn("text-base font-black", isClosed ? "text-green-400" : "")}>
                    {TARGET_LABELS[key]}
                  </span>
                  <span className={cn("text-[10px]", getMarkColor(myMark.marks))}>
                    {getMarkSymbol(myMark.marks) || "○"}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Times selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Удаа:</span>
            {([1, 2, 3] as const).map((n) => (
              <button key={n} onClick={() => setSelectedTimes(n)}
                className={cn("h-8 w-8 rounded-lg border-2 text-sm font-bold transition-all",
                  selectedTimes === n ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                ×{n}
              </button>
            ))}
            <button onClick={addThrow} disabled={!selectedTarget || pendingThrows.length >= 3}
              className="ml-auto flex-1 py-2 rounded-lg bg-secondary border border-border/60 text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40">
              + Нэмэх
            </button>
          </div>

          {/* Pending throws */}
          {pendingThrows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingThrows.map((t, i) => (
                <Badge key={i} variant="outline" className="border-primary/30 text-primary text-xs">
                  {TARGET_LABELS[String(t.target)]} ×{t.times}
                  <button onClick={() => setPendingThrows(prev => prev.filter((_, idx) => idx !== i))}
                    className="ml-1 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
          )}

          {/* Submit */}
          <button onClick={submitVisit}
            className={cn("w-full py-3 rounded-xl font-bold text-sm transition-all",
              pendingThrows.length > 0 ? "bg-primary text-primary-foreground glow-primary" :
              "bg-secondary border border-border/60 text-muted-foreground")}>
            {pendingThrows.length > 0 ? "Visit дуусгах →" : "Miss (хоосон visit) →"}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
