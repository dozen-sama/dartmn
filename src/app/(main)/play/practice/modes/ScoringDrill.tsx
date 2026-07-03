"use client"

import { useState } from "react"
import { ScoreInput } from "@/components/game/ScoreInput"
import { savePracticeSession } from "@/lib/practice/practice-stats"
import { cn } from "@/lib/utils"

const ROUND_PRESETS = [5, 10, 15, 20]

export function ScoringDrill({ onBack }: { onBack: () => void }) {
  const [totalVisits, setTotalVisits] = useState(10)
  const [scores, setScores] = useState<number[]>([])
  const [finished, setFinished] = useState(false)

  function handleScore(score: number) {
    const newScores = [...scores, score]
    setScores(newScores)
    if (newScores.length >= totalVisits) {
      setFinished(true)
      const avg = newScores.reduce((a, s) => a + s, 0) / newScores.length
      void savePracticeSession({
        mode: "scoring_drill",
        headlineMetric: Math.round(avg * 100) / 100,
        summary: {
          total: newScores.reduce((a, s) => a + s, 0),
          max: Math.max(...newScores),
          count180: newScores.filter(s => s === 180).length,
          roundCount: totalVisits,
        },
      })
    }
  }

  const total = scores.reduce((a, s) => a + s, 0)
  const avg = scores.length > 0 ? (total / scores.length).toFixed(1) : "—"
  const max = scores.length > 0 ? Math.max(...scores) : 0

  if (finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <div className="text-5xl font-black text-primary score-display">{total}</div>
      <p className="text-muted-foreground">{totalVisits} visit-ийн нийт оноо</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Дундаж", value: avg },
          { label: "Хамгийн сайн", value: max },
          { label: "180-ийн тоо", value: scores.filter(s => s === 180).length },
        ].map(s => (
          <div key={s.label} className="bg-secondary/40 rounded-xl py-3">
            <p className="text-xl font-black score-display">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {scores.map((s, i) => (
          <span key={i} className={cn("text-xs font-mono px-2 py-1 rounded border",
            s === 180 ? "border-primary bg-primary/15 text-primary" :
            s >= 100 ? "border-green-500/30 text-green-400" : "border-border/40 text-muted-foreground")}>
            {s}
          </span>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setScores([]); setFinished(false) }}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary">Дахин</button>
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-border/60 font-medium">Гарах</button>
      </div>
    </div>
  )

  return (
    <ScoreInput
      onBack={onBack}
      onSubmit={handleScore}
      title={
        <div className="flex items-center gap-3">
          <div className="text-center bg-secondary rounded-lg px-3 py-1.5">
            <p className="text-2xl font-black score-display">{scores.length + 1}</p>
            <p className="text-[10px] text-muted-foreground">/ {totalVisits}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>Нийт: {total} оноо</p>
            <p>Average: {avg}</p>
          </div>
        </div>
      }
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          Хамгийн өндөр оноо ·
          {ROUND_PRESETS.map(n => (
            <button key={n} disabled={scores.length > 0} onClick={() => setTotalVisits(n)}
              className={cn("px-1.5 rounded text-[10px] font-semibold border disabled:opacity-40",
                totalVisits === n ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground")}>
              {n}
            </button>
          ))}
        </span>
      }
    />
  )
}
