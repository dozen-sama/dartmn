"use client"

import { useCallback, useState } from "react"
import { ArrowLeft, Delete, Volume2, VolumeX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { isPossibleVisitScore } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { DartSelector } from "@/components/game/DartSelector"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"

const KEYPAD = [[1, 2, 3], [4, 5, 6], [7, 8, 9], ["*", 0, "DEL"]] as const
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

interface ScoreInputProps {
  onSubmit: (score: number, darts: number) => void
  onBack: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  showDartSelector?: boolean
  caller?: { enabled: boolean; supported: boolean; onToggle: () => void }
}

// Бүх x01-төрлийн бэлтгэлийн горим (Solo501, CheckoutDrill, 121 Checkout) хуваалцах
// оноо-оруулах widget. Core механик (isPossibleVisitScore шалгалт, keypad) өөрчлөгдөөгүй.
export function ScoreInput({ onSubmit, onBack, title, subtitle, showDartSelector = true, caller }: ScoreInputProps) {
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
        <div className="flex-1">
          <div className="font-bold text-base">{title}</div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {caller?.supported && (
          <button onClick={caller.onToggle}
            title={caller.enabled ? "Дуут зарлагч унтраах" : "Дуут зарлагч асаах"}
            className="text-muted-foreground hover:text-foreground shrink-0">
            {caller.enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        )}
      </div>

      {showDartSelector && (
        <DartSelector value={dartsUsed} onChange={setDartsUsed} label="Хэдэн дарт шидэв?" />
      )}

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
