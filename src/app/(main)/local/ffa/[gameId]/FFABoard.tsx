"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useFFAStore } from "@/lib/local-game/ffa-store"
import { fetchRemoteFFA, subscribeToFFA } from "@/lib/local-game/ffa-sync"
import { classifyTurn, getCheckout, isPossibleVisitScore, IMPOSSIBLE_CHECKOUTS } from "@/lib/local-game/checkouts"
import type { FFAGame } from "@/lib/local-game/ffa-types"
import { toast } from "sonner"

const KEYPAD = [[1,2,3],[4,5,6],[7,8,9],["*",0,"DEL"]] as const

export function FFABoard() {
  const { gameId } = useParams<{ gameId: string }>()
  const router = useRouter()
  const game = useFFAStore((s) => s.games[gameId])
  const recordThrow = useFFAStore((s) => s.recordThrow)
  const completeLeg = useFFAStore((s) => s.completeLeg)
  const completeGame = useFFAStore((s) => s.completeGame)
  const importGame = useFFAStore((s) => s.importGame)

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [dartsUsed, setDartsUsed] = useState(3)

  useEffect(() => setMounted(true), [])

  // Sync: viewer polling
  useEffect(() => {
    if (!mounted) return
    let owned: string[] = []
    try { owned = JSON.parse(localStorage.getItem("owned-ffa") ?? "[]") } catch {}
    if (owned.includes(gameId)) return
    fetchRemoteFFA(gameId).then((g) => { if (g) importGame(g) })
    const poll = setInterval(() => fetchRemoteFFA(gameId).then((g) => { if (g) importGame(g) }), 3000)
    const unsub = subscribeToFFA(gameId, importGame)
    return () => { clearInterval(poll); unsub() }
  }, [mounted, gameId]) // eslint-disable-line

  const kbInput  = useCallback((d: string) => setInput((p) => { const n = p + d; return parseInt(n) > 180 ? p : n }), [])
  const kbDelete = useCallback(() => setInput((p) => p.slice(0, -1)), [])

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
  if (!game) return <div className="text-center py-20 text-muted-foreground">Тоглолт олдсонгүй</div>

  // Current leg
  const legIdx = game.legs.findIndex((l) => !l.winnerId)
  const isGameOver = game.status === "completed"
  const leg = isGameOver ? null : game.legs[legIdx]
  const currentPlayer = leg ? game.players[leg.currentPlayerIndex] : null

  function getRemaining(playerId: string): number {
    if (!leg) return game.startScore
    const throws = leg.throws[playerId] ?? []
    return game.startScore - throws.reduce((s, t) => s + (t.bust ? 0 : t.score), 0)
  }

  const remaining = currentPlayer ? getRemaining(currentPlayer.id) : 0
  const inputNum = parseInt(input) || 0
  const afterScore = remaining - inputNum
  const outcome = input !== "" ? classifyTurn(remaining, inputNum, { doubleOut: game.doubleOut, requireBullFinish: false }) : null
  const isBust = outcome?.type === "bust"
  const isCheckout = outcome?.type === "checkout"
  const checkoutHint = currentPlayer ? getCheckout(remaining) : null
  const inputHint = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null
  const isImpossible = remaining > 1 && IMPOSSIBLE_CHECKOUTS.has(remaining)

  function submitScore() {
    if (!currentPlayer || !leg) return
    const score = parseInt(input)
    if (isNaN(score) || !isPossibleVisitScore(score)) {
      toast.error("3 дартаар гаргах боломжгүй оноо"); setInput(""); return
    }

    recordThrow(gameId, score, dartsUsed, isBust)

    if (isCheckout) {
      const newWins = (game.wins[currentPlayer.id] ?? 0) + 1
      if (newWins >= game.firstTo) {
        completeLeg(gameId, currentPlayer.id)
        toast.success(`🏆 ${currentPlayer.name} ялав!`)
      } else {
        completeLeg(gameId, currentPlayer.id)
        toast.success(`Leg ${legIdx + 1} — ${currentPlayer.name} хожлоо!`)
      }
    } else if (isBust) {
      toast.error("Bust!")
    }

    setInput("")
    setDartsUsed(3)
  }

  // ── Game over screen ──
  if (isGameOver && game.winnerId) {
    const winner = game.players.find((p) => p.id === game.winnerId)
    return (
      <div className="max-w-md mx-auto space-y-5 pt-4">
        <button onClick={() => router.push("/local")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Card className="border-[oklch(0.78_0.16_85)]/40 bg-[oklch(0.78_0.16_85)]/5">
          <CardContent className="p-8 text-center space-y-3">
            <Trophy className="h-14 w-14 text-[oklch(0.78_0.16_85)] mx-auto" />
            <p className="text-muted-foreground text-sm">Ялагч</p>
            <p className="text-3xl font-bold text-[oklch(0.78_0.16_85)]">{winner?.name}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">Эцсийн байдал</p>
            {game.players.map((p) => (
              <div key={p.id} className={cn("flex items-center justify-between py-2 px-3 rounded-lg",
                p.id === game.winnerId ? "bg-[oklch(0.78_0.16_85)]/10 border border-[oklch(0.78_0.16_85)]/30" : "bg-secondary/30")}>
                <span className="font-medium text-sm">{p.name}</span>
                <span className="font-bold score-display text-primary">{game.wins[p.id] ?? 0} leg</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const legCount = game.legs.filter((l) => l.winnerId).length

  return (
    <div className="max-w-md mx-auto flex flex-col gap-3 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 pt-1">
        <button onClick={() => router.push("/local")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-bold text-sm">{game.name}</p>
          <p className="text-xs text-muted-foreground">{game.format} · First to {game.firstTo} · Leg {legCount + 1}</p>
        </div>
        <div className="w-6" />
      </div>

      {/* Players scores */}
      <div className={cn(
        "grid gap-2",
        game.players.length <= 4 ? "grid-cols-2" : "grid-cols-1"
      )}>
        {game.players.map((player, idx) => {
          const rem = getRemaining(player.id)
          const wins = game.wins[player.id] ?? 0
          const isCurrent = leg?.currentPlayerIndex === idx
          const throws = leg?.throws[player.id] ?? []
          const lastThrow = throws[throws.length - 1]

          return (
            <div key={player.id} className={cn(
              "rounded-xl border p-3 transition-all",
              isCurrent
                ? "border-primary/60 bg-primary/8 shadow-[0_0_12px_oklch(0.7_0.22_260/0.15)]"
                : "border-border/40 bg-card/60"
            )}>
              <div className="flex items-center justify-between mb-1">
                <p className={cn("text-xs font-semibold truncate", isCurrent ? "text-primary" : "text-muted-foreground")}>
                  {isCurrent && <span className="mr-1">▶</span>}{player.name}
                </p>
                <div className="flex gap-0.5">
                  {Array.from({ length: game.firstTo }).map((_, i) => (
                    <div key={i} className={cn("h-2 w-2 rounded-full", i < wins ? "bg-primary" : "bg-border/40")} />
                  ))}
                </div>
              </div>
              <p className={cn("font-bold score-display leading-none",
                isCurrent ? "text-3xl text-foreground" : "text-2xl text-muted-foreground/70",
                rem <= 32 && rem > 0 ? "text-green-400" : ""
              )}>
                {rem}
              </p>
              {lastThrow && (
                <p className={cn("text-xs mt-0.5", lastThrow.bust ? "text-destructive" : "text-muted-foreground/60")}>
                  {lastThrow.bust ? "Bust" : `−${lastThrow.score}`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Input display */}
      {currentPlayer && (
        <div className="rounded-xl border border-border/40 bg-card/80 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{currentPlayer.name} — ээлж</p>
              {checkoutHint && !input && (
                <p className="text-xs text-green-400/80 mt-0.5">{checkoutHint}</p>
              )}
              {inputHint && (
                <p className="text-xs text-primary/70 mt-0.5">{inputHint}</p>
              )}
              {isImpossible && !input && (
                <p className="text-xs text-destructive/70 mt-0.5">Checkout боломжгүй позиц</p>
              )}
            </div>
            <div className="text-right">
              <p className={cn("text-4xl font-bold score-display", isBust ? "text-destructive" : "text-primary")}>
                {input || "—"}
              </p>
              {input && (
                <p className={cn("text-xs", isBust ? "text-destructive" : isCheckout ? "text-green-400" : "text-muted-foreground")}>
                  {isBust ? "Bust" : isCheckout ? "Checkout!" : `→ ${afterScore}`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Darts used */}
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">Дарт:</p>
        {[1, 2, 3].map((n) => (
          <button key={n} onClick={() => setDartsUsed(n)}
            className={cn("h-7 w-7 rounded-full border text-xs font-bold transition-colors",
              dartsUsed === n ? "border-primary bg-primary/20 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
            {n}
          </button>
        ))}
      </div>

      {/* Keypad */}
      <div className="space-y-1.5">
        {KEYPAD.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-1.5">
            {row.map((key) => (
              <button key={key}
                onClick={() => {
                  if (key === "DEL") kbDelete()
                  else if (key === "*") submitScore()
                  else kbInput(String(key))
                }}
                className={cn(
                  "h-14 rounded-xl font-bold text-lg border transition-all active:scale-95",
                  key === "*"
                    ? "border-primary/50 bg-primary/20 text-primary hover:bg-primary/30 glow-primary"
                    : key === "DEL"
                      ? "border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      : "border-border/40 bg-card/80 hover:bg-secondary/50 score-display"
                )}>
                {key === "*" ? "OK" : key === "DEL" ? "⌫" : key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
