"use client"

import { useState } from "react"
import { RefreshCw, Trophy } from "lucide-react"
import { getCheckout, randomCheckout } from "@/lib/local-game/checkouts"
import { ScoreInput } from "@/components/game/ScoreInput"
import { useCaller } from "@/hooks/useCaller"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const LENGTH_PRESETS = [10, 15, 20, 30]

export function CheckoutDrill({ onBack }: { onBack: () => void }) {
  const [sessionLength, setSessionLength] = useState(15)
  const [target, setTarget] = useState(randomCheckout)
  const [attempts, setAttempts] = useState(0)
  const [successes, setSuccesses] = useState(0)
  const [finished, setFinished] = useState(false)
  const caller = useCaller()

  function finishSession(finalAttempts: number, finalSuccesses: number) {
    setFinished(true)
    const pct = Math.round((finalSuccesses / finalAttempts) * 100)
    void savePracticeSession({
      mode: "checkout_drill",
      headlineMetric: pct,
      summary: { attempts: finalAttempts, successes: finalSuccesses, sessionLength },
    })
  }

  function handleScore(score: number) {
    const isCheckout = score === target
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    if (isCheckout) {
      setSuccesses(s => s + 1)
      toast.success(`✅ ${target} checkout! Сайн байна!`)
      caller.announce({ points: score, outcome: "checkout", nextRemaining: 0 })
    } else {
      toast.error(`❌ Болсонгүй (${score})`)
      caller.announce({ points: score, outcome: "score", nextRemaining: target })
    }
    if (nextAttempts >= sessionLength) {
      finishSession(nextAttempts, successes + (isCheckout ? 1 : 0))
      return
    }
    setTarget(randomCheckout())
  }

  const pct = attempts > 0 ? Math.round((successes / attempts) * 100) : 0

  if (finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">Дуусгалаа!</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-secondary/40 rounded-xl py-3">
          <p className="text-xl font-black score-display">{successes}/{attempts}</p>
          <p className="text-xs text-muted-foreground">Амжилт</p>
        </div>
        <div className="bg-secondary/40 rounded-xl py-3">
          <p className="text-xl font-black score-display">{pct}%</p>
          <p className="text-xs text-muted-foreground">Хувь</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setAttempts(0); setSuccesses(0); setTarget(randomCheckout()); setFinished(false) }}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">Дахин</button>
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-border/60 font-medium">Гарах</button>
      </div>
    </div>
  )

  return (
    <ScoreInput
      onBack={onBack}
      onSubmit={(score) => handleScore(score)}
      caller={{ enabled: caller.enabled, supported: caller.supported, onToggle: caller.toggle }}
      title={
        <div className="flex items-center gap-3">
          <div className="text-center bg-primary/15 rounded-lg px-3 py-1.5 border border-primary/30">
            <p className="text-3xl font-black text-primary score-display">{target}</p>
            <p className="text-[10px] text-primary/70">Checkout хий</p>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Checkout hint: <span className="text-foreground font-mono">{getCheckout(target) ?? "—"}</span></p>
            <p>Амжилт: {successes}/{attempts} ({pct}%) · {attempts}/{sessionLength}</p>
          </div>
          <button onClick={() => setTarget(randomCheckout())}
            className="ml-auto text-muted-foreground hover:text-foreground p-1">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          Checkout дадлага ·
          {LENGTH_PRESETS.map(n => (
            <button key={n} onClick={() => setSessionLength(n)}
              className={cn("px-1.5 rounded text-[10px] font-semibold border",
                sessionLength === n ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground")}>
              {n}
            </button>
          ))}
        </span>
      }
    />
  )
}
