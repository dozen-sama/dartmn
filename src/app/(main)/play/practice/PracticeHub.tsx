"use client"

import { useCallback, useState } from "react"
import { ArrowLeft, BarChart3, Check, Delete, RefreshCw, Target, Trophy, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getCheckout, classifyTurn, isPossibleVisitScore, randomCheckout } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { DartSelector } from "@/components/game/DartSelector"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

type Mode = "menu" | "501" | "checkout" | "scoring" | "around"

const KEYPAD = [[7,8,9],[4,5,6],[1,2,3],["*",0,"DEL"]] as const
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

// Around the board targets (1-20 then bull)
const AROUND_TARGETS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,"bull"]

export function PracticeHub() {
  const [mode, setMode] = useState<Mode>("menu")

  if (mode === "menu") return <ModeSelector onSelect={setMode} />
  if (mode === "501") return <Solo501 onBack={() => setMode("menu")} />
  if (mode === "checkout") return <CheckoutDrill onBack={() => setMode("menu")} />
  if (mode === "scoring") return <ScoringDrill onBack={() => setMode("menu")} />
  if (mode === "around") return <AroundTheBoard onBack={() => setMode("menu")} />
  return null
}

// ── Mode selector ──────────────────────────────────────────────────
function ModeSelector({ onSelect }: { onSelect: (m: Mode) => void }) {
  const modes = [
    { key: "501" as Mode, icon: "🎯", title: "501 Solo", desc: "Ганцаараа 501 тоглож дундаж оноогоо шалга" },
    { key: "checkout" as Mode, icon: "✅", title: "Checkout Drill", desc: "Random checkout тоог дадлага хий" },
    { key: "scoring" as Mode, icon: "💯", title: "Scoring Drill", desc: "10 visit-т хамгийн өндөр оноо авах" },
    { key: "around" as Mode, icon: "🔄", title: "Around the Board", desc: "1-20 болон Bull-д дараалан оно" },
  ]

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/play" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Бэлтгэл тоглолт
          </h1>
          <p className="text-muted-foreground text-sm">Ганцаараа дадлага хийх</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modes.map((m) => (
          <button key={m.key} onClick={() => onSelect(m.key)}
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-border/50 bg-card/80 hover:border-primary/40 hover:bg-primary/5 transition-all text-left card-hover">
            <span className="text-3xl shrink-0">{m.icon}</span>
            <div>
              <p className="font-bold text-sm">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Shared scoreboard input ────────────────────────────────────────
function ScoreInput({ onSubmit, onBack, title, subtitle }: {
  onSubmit: (score: number, darts: number) => void
  onBack: () => void
  title: React.ReactNode
  subtitle?: string
}) {
  const [input, setInput] = useState("")
  const [dartsUsed, setDartsUsed] = useState(3)

  function handleSubmit() {
    const score = parseInt(input)
    if (isNaN(score)) return
    if (!isPossibleVisitScore(score)) { toast.error("3 дартаар гаргах боломжгүй оноо"); return }
    onSubmit(score, dartsUsed)
    setInput("")
    setDartsUsed(3)
  }

  const kbInput = useCallback((d: string) => {
    setInput(p => { const next = p + d; return parseInt(next) > 180 ? p : next })
  }, [])
  useScoreboardKeyboard({
    onInput: kbInput,
    onDelete: useCallback(() => setInput(p => p.slice(0, -1)), []),
    onClear: useCallback(() => setInput(""), []),
    onSubmit: handleSubmit,
    enabled: true,
  })

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="font-bold text-base">{title}</div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <DartSelector
        value={dartsUsed}
        onChange={setDartsUsed}
        label="Хэдэн дарт шидэв?"
      />

      <Card className="border-border/50">
        <CardContent className="p-3">
          <p className="text-4xl font-black score-display mb-2">{input || "0"}</p>
          <button onClick={handleSubmit} disabled={!input}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold glow-primary disabled:opacity-40">
            Оруулах
          </button>
        </CardContent>
      </Card>

      <div className="flex gap-1.5 flex-wrap">
        {QUICK_SCORES.map(s => (
          <button key={s} onClick={() => setInput(String(s))}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40">
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.flat().map((k, i) => (
          <button key={i} onClick={() => {
            if (k === "DEL") setInput(p => p.slice(0, -1))
            else if (k === "*") setInput("")
            else { const next = input + k; if (parseInt(next) <= 180) setInput(next) }
          }} className={cn("h-14 rounded-xl text-lg font-bold transition-all active:scale-95",
            k === "DEL" ? "bg-secondary/80 text-destructive" :
            k === "*" ? "bg-secondary/80 text-muted-foreground" :
            "bg-secondary/50 hover:bg-secondary border border-border/30")}>
            {k === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : k === "*" ? "C" : k}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 501 Solo ──────────────────────────────────────────────────────
function Solo501({ onBack }: { onBack: () => void }) {
  const [remaining, setRemaining] = useState(501)
  const [visits, setVisits] = useState(0)
  const [totalDarts, setTotalDarts] = useState(0)
  const [throws, setThrows] = useState<number[]>([])  // bust бус онооны нийлбэр (дундажид)
  const [finished, setFinished] = useState(false)
  const [doubleOut, setDoubleOut] = useState(true)

  function handleScore(score: number, darts: number) {
    const outcome = classifyTurn(remaining, score, { doubleOut })
    // Bust ч гэсэн шидсэн дарт/visit тоологдоно (бодит дадлага) — зөвхөн оноо revert
    setVisits(v => v + 1)
    setTotalDarts(d => d + darts)
    if (outcome.type === "bust") { toast.error("Bust! — оноо хэвээр"); return }
    setThrows(prev => [...prev, score])
    setRemaining(outcome.remaining)
    if (outcome.type === "checkout") setFinished(true)
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
      subtitle="501 Solo бэлтгэл"
    />
  )
}

// ── Checkout Drill ────────────────────────────────────────────────
function CheckoutDrill({ onBack }: { onBack: () => void }) {
  const [target, setTarget] = useState(randomCheckout)
  const [attempts, setAttempts] = useState(0)
  const [successes, setSuccesses] = useState(0)
  const [history, setHistory] = useState<{ target: number; success: boolean }[]>([])

  function handleScore(score: number) {
    const isCheckout = score === target
    setAttempts(a => a + 1)
    if (isCheckout) {
      setSuccesses(s => s + 1)
      toast.success(`✅ ${target} checkout! Сайн байна!`)
      setHistory(h => [...h, { target, success: true }])
    } else {
      toast.error(`❌ Болсонгүй (${score})`)
      setHistory(h => [...h, { target, success: false }])
    }
    setTarget(randomCheckout())
  }

  const pct = attempts > 0 ? Math.round((successes / attempts) * 100) : 0

  return (
    <ScoreInput
      onBack={onBack}
      onSubmit={(score) => handleScore(score)}
      title={
        <div className="flex items-center gap-3">
          <div className="text-center bg-primary/15 rounded-lg px-3 py-1.5 border border-primary/30">
            <p className="text-3xl font-black text-primary score-display">{target}</p>
            <p className="text-[10px] text-primary/70">Checkout хий</p>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Checkout hint: <span className="text-foreground font-mono">{getCheckout(target) ?? "—"}</span></p>
            <p>Амжилт: {successes}/{attempts} ({pct}%)</p>
          </div>
          <button onClick={() => setTarget(randomCheckout())}
            className="ml-auto text-muted-foreground hover:text-foreground p-1">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
      subtitle="Checkout дадлага"
    />
  )
}

// ── Scoring Drill ─────────────────────────────────────────────────
function ScoringDrill({ onBack }: { onBack: () => void }) {
  const TOTAL_VISITS = 10
  const [currentVisit, setCurrentVisit] = useState(1)
  const [scores, setScores] = useState<number[]>([])
  const [finished, setFinished] = useState(false)

  function handleScore(score: number) {
    const newScores = [...scores, score]
    setScores(newScores)
    if (currentVisit >= TOTAL_VISITS) {
      setFinished(true)
    } else {
      setCurrentVisit(v => v + 1)
    }
  }

  const total = scores.reduce((a, s) => a + s, 0)
  const avg = scores.length > 0 ? (total / scores.length).toFixed(1) : "—"
  const max = scores.length > 0 ? Math.max(...scores) : 0

  if (finished) return (
    <div className="max-w-sm mx-auto space-y-5 py-10 text-center">
      <div className="text-5xl font-black text-primary score-display">{total}</div>
      <p className="text-muted-foreground">10 visit-ийн нийт оноо</p>
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
        <button onClick={() => { setScores([]); setCurrentVisit(1); setFinished(false) }}
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
            <p className="text-2xl font-black score-display">{currentVisit}</p>
            <p className="text-[10px] text-muted-foreground">/ {TOTAL_VISITS}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>Нийт: {total} оноо</p>
            <p>Average: {avg}</p>
          </div>
        </div>
      }
      subtitle="10 visit — хамгийн өндөр оноо"
    />
  )
}

// ── Around the Board ──────────────────────────────────────────────
function AroundTheBoard({ onBack }: { onBack: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [darts, setDarts] = useState(0)
  const [finished, setFinished] = useState(false)

  const current = AROUND_TARGETS[currentIdx]

  function handleHit(dartsUsed: number) {
    const newDarts = darts + dartsUsed
    setDarts(newDarts)
    if (currentIdx >= AROUND_TARGETS.length - 1) {
      setFinished(true)
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
        <p className="text-sm text-muted-foreground mt-1">нийт дарт</p>
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

      {/* Target display */}
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-2">Одоогийн зорилт</p>
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
