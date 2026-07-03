"use client"

import { useState } from "react"
import { ArrowLeft, Check, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"
import { savePracticeSession, type PracticeMode } from "@/lib/practice/practice-stats"

// Around the board targets (1-20 then bull)
const AROUND_TARGETS: (number | "bull")[] = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,"bull"]

type Variant = "singles" | "doubles" | "trebles"

const VARIANT_LABEL: Record<Variant, string> = { singles: "Singles", doubles: "Doubles", trebles: "Trebles" }
const VARIANT_MODE: Record<Variant, PracticeMode> = {
  singles: "around_clock_singles", doubles: "around_clock_doubles", trebles: "around_clock_trebles",
}

export function AroundTheBoard({ onBack }: { onBack: () => void }) {
  const [variant, setVariant] = useState<Variant>("singles")
  const [currentIdx, setCurrentIdx] = useState(0)
  const [darts, setDarts] = useState(0)
  const [finished, setFinished] = useState(false)

  const current = AROUND_TARGETS[currentIdx]
  const started = currentIdx > 0 || darts > 0

  function handleHit(dartsUsed: number) {
    const newDarts = darts + dartsUsed
    setDarts(newDarts)
    if (currentIdx >= AROUND_TARGETS.length - 1) {
      setFinished(true)
      void savePracticeSession({
        mode: VARIANT_MODE[variant],
        headlineMetric: newDarts,
        summary: { darts: newDarts, variant },
      })
    } else {
      setCurrentIdx(i => i + 1)
    }
    toast.success(`✅ ${current === "bull" ? "Bull" : current} онолоо!`)
  }

  function handleMiss() {
    setDarts(d => d + 3)
    toast(`Miss — ${current === "bull" ? "Bull" : current} дахин шидэнэ`)
  }

  if (finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">Around the Board!</h2>
      <div className="bg-secondary/40 rounded-xl py-4">
        <p className="text-4xl font-black score-display">{darts}</p>
        <p className="text-sm text-muted-foreground mt-1">нийт дарт · {VARIANT_LABEL[variant]}</p>
      </div>
      <p className="text-xs text-muted-foreground">Хамгийн бага: 21 дарт (тус бүр 1 дартаар)</p>
      <div className="flex gap-3">
        <button onClick={() => { setCurrentIdx(0); setDarts(0); setFinished(false) }}
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
        <h1 className="font-bold">Around the Board</h1>
      </div>

      {!started && (
        <div className="flex gap-2">
          {(Object.keys(VARIANT_LABEL) as Variant[]).map(v => (
            <button key={v} onClick={() => setVariant(v)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all",
                variant === v ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground")}>
              {VARIANT_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      {/* Target display */}
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-2">Одоогийн зорилт · {VARIANT_LABEL[variant]}</p>
        <div className="text-7xl font-black text-primary score-display">
          {current === "bull" ? "🎯" : current}
        </div>
        {current === "bull" && <p className="text-lg font-bold text-primary mt-2">Bull</p>}
      </div>

      {/* Progress */}
      <div className="flex gap-1 flex-wrap justify-center">
        {AROUND_TARGETS.map((t, i) => (
          <div key={i} className={cn("h-2 w-5 rounded-full transition-all",
            i < currentIdx ? "bg-green-400" :
            i === currentIdx ? "bg-primary" : "bg-secondary")}>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">{currentIdx + 1} / {AROUND_TARGETS.length} · {darts} дарт</p>

      {/* Hit/Miss buttons */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => handleHit(n)}
            className="flex flex-col items-center py-4 rounded-xl bg-green-500/15 border-2 border-green-500/30 hover:bg-green-500/25 transition-colors">
            <Check className="h-5 w-5 text-green-400 mb-1" />
            <span className="text-sm font-bold text-green-400">{n} дартаар</span>
          </button>
        ))}
      </div>
      <button onClick={handleMiss}
        className="w-full py-3 rounded-xl bg-secondary border border-border/60 text-muted-foreground font-medium hover:bg-secondary/80">
        Miss (3 дарт алдалаа)
      </button>
    </div>
  )
}
