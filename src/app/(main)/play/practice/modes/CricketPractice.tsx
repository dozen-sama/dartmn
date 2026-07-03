"use client"

import { useState } from "react"
import { ArrowLeft, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import { CRICKET_NUMBERS, initCricketState, applyCricketDart, type CricketState, type CricketTarget } from "@/lib/practice/cricket"

const COLUMNS: { label: string; mult: 1 | 2 | 3 }[] = [
  { label: "S", mult: 1 },
  { label: "D", mult: 2 },
  { label: "T", mult: 3 },
]

function rowLabel(t: CricketTarget): string {
  return t === "bull" ? "Bull" : String(t)
}

function MarkTally({ n }: { n: number }) {
  if (n >= 3) return <span className="text-green-400 font-bold text-sm">✓ хаагдсан</span>
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map(i => (
        <span key={i} className={cn("h-2 w-2 rounded-full", i < n ? "bg-primary" : "bg-secondary")} />
      ))}
    </span>
  )
}

export function CricketPractice({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<CricketState>(initCricketState)

  function handleDart(target: CricketTarget, mult: 1 | 2 | 3) {
    const next = applyCricketDart(state, target, mult)
    setState(next)
    if (next.finished) {
      void savePracticeSession({
        mode: "cricket",
        headlineMetric: next.dartsThrown,
        summary: { dartsThrown: next.dartsThrown },
      })
    }
  }

  function handleMiss() {
    setState(applyCricketDart(state, "miss", 1))
  }

  if (state.finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">Бүх тоо хаагдлаа!</h2>
      <div className="bg-secondary/40 rounded-xl py-4">
        <p className="text-4xl font-black score-display">{state.dartsThrown}</p>
        <p className="text-sm text-muted-foreground mt-1">нийт дарт</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setState(initCricketState())}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">Дахин</button>
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-border/60 font-medium">Гарах</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-bold">Cricket Practice</h1>
          <p className="text-xs text-muted-foreground">{state.dartsThrown} дарт · бүх тоог хамгийн хурдан хаа</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 overflow-hidden">
        {CRICKET_NUMBERS.map((n, i) => (
          <div key={String(n)} className={cn("grid grid-cols-[1fr_auto_2fr] items-center px-3 py-2 gap-2",
            i % 2 === 0 ? "bg-secondary/20" : "")}>
            <span className="font-bold text-sm score-display">{rowLabel(n)}</span>
            <MarkTally n={state.marks[String(n)] ?? 0} />
            <div className="flex gap-1.5 justify-end">
              {COLUMNS.map(c => {
                const disabled = n === "bull" && c.mult === 3
                return (
                  <button key={c.label} disabled={disabled} onClick={() => handleDart(n, c.mult)}
                    className={cn("h-8 w-9 rounded-md text-xs font-bold border transition-colors",
                      disabled ? "opacity-20 cursor-not-allowed border-border/20" :
                      "border-border/40 bg-secondary/40 hover:bg-primary/20 hover:border-primary/40")}>
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleMiss}
        className="w-full py-3 rounded-xl bg-secondary border border-border/60 text-muted-foreground font-medium hover:bg-secondary/80">
        Miss
      </button>
    </div>
  )
}
