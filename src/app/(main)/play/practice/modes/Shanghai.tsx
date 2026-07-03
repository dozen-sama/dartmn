"use client"

import { useState } from "react"
import { ArrowLeft, Minus, Plus, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import { initShanghaiState, applyShanghaiRound, type ShanghaiState, type ShanghaiVisit } from "@/lib/practice/shanghai"

const FIELDS: { key: keyof ShanghaiVisit; label: string }[] = [
  { key: "singles", label: "Single" },
  { key: "doubles", label: "Double" },
  { key: "trebles", label: "Treble" },
]

export function Shanghai({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<ShanghaiState>(initShanghaiState)
  const [visit, setVisit] = useState<ShanghaiVisit>({ singles: 0, doubles: 0, trebles: 0 })

  const dartsUsed = visit.singles + visit.doubles + visit.trebles

  function bump(key: keyof ShanghaiVisit, delta: number) {
    setVisit(v => {
      const nextVal = Math.max(0, v[key] + delta)
      const others = FIELDS.filter(f => f.key !== key).reduce((a, f) => a + v[f.key], 0)
      if (nextVal + others > 3) return v
      return { ...v, [key]: nextVal }
    })
  }

  function submitRound() {
    const next = applyShanghaiRound(state, visit)
    setState(next)
    setVisit({ singles: 0, doubles: 0, trebles: 0 })
    if (next.finished) {
      void savePracticeSession({
        mode: "shanghai",
        headlineMetric: next.totalScore,
        summary: { totalScore: next.totalScore, shanghaiHit: next.shanghaiHit, rounds: next.history.length },
      })
    }
  }

  if (state.finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">{state.shanghaiHit ? "Shanghai!! 🎉" : "Дуусгалаа!"}</h2>
      <div className="bg-secondary/40 rounded-xl py-4">
        <p className="text-4xl font-black score-display">{state.totalScore}</p>
        <p className="text-sm text-muted-foreground mt-1">нийт оноо · {state.history.length} round</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setState(initShanghaiState())}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">Дахин</button>
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-border/60 font-medium">Гарах</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-sm mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-bold">Shanghai</h1>
          <p className="text-xs text-muted-foreground">Round {state.round} / 20 · Нийт: {state.totalScore}</p>
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-1">Энэ round-ийн зорилт</p>
        <div className="text-6xl font-black text-primary score-display">{state.round}</div>
      </div>

      <div className="space-y-2">
        {FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
            <span className="text-sm font-medium">{f.label} {state.round}</span>
            <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
              <button onClick={() => bump(f.key, -1)} className="h-8 w-8 flex items-center justify-center hover:bg-secondary text-muted-foreground">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <div className="h-8 w-9 flex items-center justify-center border-x border-border/60 bg-background/40">
                <span className="font-black">{visit[f.key]}</span>
              </div>
              <button onClick={() => bump(f.key, 1)} className="h-8 w-8 flex items-center justify-center hover:bg-secondary text-muted-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">Дарт ашигласан: {dartsUsed}/3</p>

      <button onClick={submitRound}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">
        Round-ийг бүртгэх
      </button>
    </div>
  )
}
