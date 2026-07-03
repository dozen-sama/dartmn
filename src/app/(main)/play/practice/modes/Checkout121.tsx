"use client"

import { useState } from "react"
import { Flag, Trophy } from "lucide-react"
import { getCheckout } from "@/lib/local-game/checkouts"
import { ScoreInput } from "@/components/game/ScoreInput"
import { useCaller } from "@/hooks/useCaller"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import { initCheckout121State, applyCheckout121Visit, type Checkout121State } from "@/lib/practice/checkout121"
import { toast } from "sonner"

export function Checkout121({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<Checkout121State>(initCheckout121State)
  const [ended, setEnded] = useState(false)
  const caller = useCaller()

  function handleScore(score: number) {
    const next = applyCheckout121Visit(state, score)
    setState(next)
    if (next.status === "success") {
      toast.success(`✅ ${state.target} checkout! Дараагийнх: ${next.target}`)
      caller.announce({ points: score, outcome: "checkout", nextRemaining: 0 })
    } else if (next.status === "fail") {
      toast.error(`❌ ${state.target}-г 3 visit-д хаагдсангүй — дахин 121-с`)
      caller.announce({ points: score, outcome: "score", nextRemaining: next.remaining })
    } else {
      caller.announce({ points: score, outcome: "score", nextRemaining: next.remaining })
    }
  }

  function endSession() {
    setEnded(true)
    void savePracticeSession({
      mode: "checkout121",
      headlineMetric: state.bestStreak,
      summary: { bestStreak: state.bestStreak, attempts: state.attempts, streak: state.streak },
    })
  }

  if (ended) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">Session дууслаа!</h2>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-secondary/40 rounded-xl py-3">
          <p className="text-xl font-black score-display">{state.bestStreak}</p>
          <p className="text-xs text-muted-foreground">Хамгийн сайн streak</p>
        </div>
        <div className="bg-secondary/40 rounded-xl py-3">
          <p className="text-xl font-black score-display">{state.streak}</p>
          <p className="text-xs text-muted-foreground">Одоогийн streak</p>
        </div>
        <div className="bg-secondary/40 rounded-xl py-3">
          <p className="text-xl font-black score-display">{state.attempts}</p>
          <p className="text-xs text-muted-foreground">Унасан удаа</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setState(initCheckout121State()); setEnded(false) }}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">Дахин</button>
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-border/60 font-medium">Гарах</button>
      </div>
    </div>
  )

  const checkoutHint = getCheckout(state.remaining)

  return (
    <ScoreInput
      onBack={onBack}
      onSubmit={handleScore}
      caller={{ enabled: caller.enabled, supported: caller.supported, onToggle: caller.toggle }}
      title={
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-primary score-display">{state.remaining}</span>
          <div className="text-xs text-muted-foreground">
            <p>Зорилт: {state.target} · Visit {state.visitsUsed + 1}/3</p>
            <p>Streak: {state.streak} (best {state.bestStreak}){checkoutHint ? ` · 🎯 ${checkoutHint}` : ""}</p>
          </div>
          <button onClick={endSession} title="Session дуусгах"
            className="ml-auto shrink-0 text-muted-foreground hover:text-destructive p-1">
            <Flag className="h-4 w-4" />
          </button>
        </div>
      }
      subtitle="121 Checkout — дараалсан тоог 3 visit-д хаа"
    />
  )
}
