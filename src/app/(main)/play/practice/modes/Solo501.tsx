"use client"

import { useState } from "react"
import { Trophy } from "lucide-react"
import { getCheckout, classifyTurn } from "@/lib/local-game/checkouts"
import { ScoreInput } from "@/components/game/ScoreInput"
import { useCaller } from "@/hooks/useCaller"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function Solo501({ onBack }: { onBack: () => void }) {
  const [remaining, setRemaining] = useState(501)
  const [visits, setVisits] = useState(0)
  const [totalDarts, setTotalDarts] = useState(0)
  const [throws, setThrows] = useState<number[]>([])  // bust бус онооны нийлбэр (дундажид)
  const [finished, setFinished] = useState(false)
  const [doubleOut, setDoubleOut] = useState(true)
  const caller = useCaller()

  function handleScore(score: number, darts: number) {
    const outcome = classifyTurn(remaining, score, { doubleOut })
    // Bust ч гэсэн шидсэн дарт/visit тоологдоно (бодит дадлага) — зөвхөн оноо revert.
    // Дасгал нь ӨӨРӨӨ оруулдаг тул profile/leaderboard статистикт БҮРТГЭГДЭХГҮЙ —
    // зөвхөн тухайн session-д (болон хувийн Дэвшил-д) харагдана (хуурамчлахаас сэргийлсэн).
    setVisits(v => v + 1)
    setTotalDarts(d => d + darts)
    if (outcome.type === "bust") {
      toast.error("Bust! — оноо хэвээр")
      caller.announce({ points: score, outcome: "bust", nextRemaining: remaining })
      return
    }
    setThrows(prev => [...prev, score])
    setRemaining(outcome.remaining)
    caller.announce({ points: score, outcome: outcome.type, nextRemaining: outcome.remaining })
    if (outcome.type === "checkout") {
      setFinished(true)
      const avgVal = (throws.reduce((a, s) => a + s, 0) + score) / (totalDarts + darts) * 3
      void savePracticeSession({
        mode: "solo501",
        headlineMetric: Math.round(avgVal * 100) / 100,
        summary: { visits: visits + 1, darts: totalDarts + darts, doubleOut },
      })
    }
  }

  const avg = totalDarts > 0 ? (throws.reduce((a, s) => a + s, 0) / totalDarts * 3).toFixed(1) : "—"
  const dartsUsed = totalDarts
  const checkoutHint = remaining <= 170 ? getCheckout(remaining) : null

  if (finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <Trophy className="h-12 w-12 text-[oklch(0.78_0.16_85)] mx-auto" />
      <h2 className="text-2xl font-black">Дуусгалаа!</h2>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Visit", value: visits },
          { label: "Дарт", value: dartsUsed },
          { label: "Дундаж", value: avg },
        ].map(s => (
          <div key={s.label} className="bg-secondary/40 rounded-xl py-3">
            <p className="text-xl font-black score-display">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setRemaining(501); setVisits(0); setTotalDarts(0); setThrows([]); setFinished(false) }}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">
          Дахин
        </button>
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-border/60 font-medium">
          Гарах
        </button>
      </div>
    </div>
  )

  return (
    <ScoreInput
      onBack={onBack}
      onSubmit={handleScore}
      caller={{ enabled: caller.enabled, supported: caller.supported, onToggle: caller.toggle }}
      title={
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-primary score-display">{remaining}</span>
          <div className="text-xs text-muted-foreground">
            <p>Visit: {visits} · Дундаж: {avg}</p>
            <p>Дарт: {dartsUsed}{checkoutHint ? ` · 🎯 ${checkoutHint}` : ""}</p>
          </div>
          <button onClick={() => setDoubleOut(v => !v)}
            className={cn("ml-auto shrink-0 text-[10px] font-bold px-2 py-1 rounded border transition-colors",
              doubleOut ? "border-primary text-primary bg-primary/10" : "border-border/50 text-muted-foreground")}>
            DO {doubleOut ? "ON" : "OFF"}
          </button>
        </div>
      }
      subtitle="501 ганцаарчилсан бэлтгэл"
    />
  )
}
