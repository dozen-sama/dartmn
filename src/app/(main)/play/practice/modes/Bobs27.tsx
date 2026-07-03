"use client"

import { useState } from "react"
import { ArrowLeft, Check, Trophy, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import {
  BOBS27_SEQUENCE, initBobs27State, applyBobs27Target, currentBobs27Target, type Bobs27State,
} from "@/lib/practice/bobs27"

function targetLabel(t: number | "bull"): string {
  return t === "bull" ? "Bull" : `D${t}`
}

export function Bobs27({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<Bobs27State>(initBobs27State)
  const target = currentBobs27Target(state)

  function handle(hit: boolean) {
    const next = applyBobs27Target(state, hit)
    setState(next)
    if (target !== null) toast(hit ? `✅ D${target === "bull" ? "Bull" : target} онолоо!` : `❌ Алдлаа`)
    if (next.finished) {
      void savePracticeSession({
        mode: "bobs27",
        headlineMetric: next.total,
        summary: { total: next.total, hits: next.history.filter(h => h.hit).length },
      })
    }
  }

  if (state.finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">Bob&apos;s 27 дууслаа!</h2>
      <div className="bg-secondary/40 rounded-xl py-4">
        <p className={cn("text-4xl font-black score-display", state.total >= 27 ? "text-green-400" : "text-destructive")}>
          {state.total}
        </p>
        <p className="text-sm text-muted-foreground mt-1">эцсийн оноо (27-с эхэлсэн)</p>
      </div>
      <div className="flex gap-1.5 flex-wrap justify-center">
        {state.history.map((h, i) => (
          <span key={i} className={cn("text-xs font-mono px-1.5 py-0.5 rounded border",
            h.hit ? "border-green-500/30 text-green-400" : "border-destructive/30 text-destructive")}>
            {targetLabel(h.target)}
          </span>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => setState(initBobs27State())}
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
        <h1 className="font-bold">Bob&apos;s 27</h1>
      </div>

      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-2">Одоогийн зорилт</p>
        <div className="text-7xl font-black text-primary score-display">
          {target === "bull" ? "🎯" : `D${target}`}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Оноо: <span className={cn("font-black text-base", state.total >= 27 ? "text-green-400" : "text-destructive")}>{state.total}</span></p>
      </div>

      <div className="flex gap-1 flex-wrap justify-center">
        {BOBS27_SEQUENCE.map((_, i) => (
          <div key={i} className={cn("h-2 w-4 rounded-full transition-all",
            i < state.idx ? (state.history[i]?.hit ? "bg-green-400" : "bg-destructive/60") :
            i === state.idx ? "bg-primary" : "bg-secondary")} />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">{state.idx + 1} / {BOBS27_SEQUENCE.length}</p>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => handle(true)}
          className="flex flex-col items-center py-5 rounded-xl bg-green-500/15 border-2 border-green-500/30 hover:bg-green-500/25 transition-colors">
          <Check className="h-6 w-6 text-green-400 mb-1" />
          <span className="text-sm font-bold text-green-400">Онолоо</span>
        </button>
        <button onClick={() => handle(false)}
          className="flex flex-col items-center py-5 rounded-xl bg-destructive/10 border-2 border-destructive/30 hover:bg-destructive/20 transition-colors">
          <X className="h-6 w-6 text-destructive mb-1" />
          <span className="text-sm font-bold text-destructive">Алдлаа (3 сум)</span>
        </button>
      </div>
    </div>
  )
}
