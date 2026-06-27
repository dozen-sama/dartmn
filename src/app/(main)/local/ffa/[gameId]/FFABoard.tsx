"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useFFAStore } from "@/lib/local-game/ffa-store"
import { broadcastFFA, fetchRemoteFFA, subscribeToFFA } from "@/lib/local-game/ffa-sync"
import { classifyTurn, getCheckout, isPossibleVisitScore } from "@/lib/local-game/checkouts"
import { toast } from "sonner"

const KEYPAD = [[1,2,3],[4,5,6],[7,8,9],["*",0,"UNDO"]] as const

export function FFABoard() {
  const { gameId } = useParams<{ gameId: string }>()
  const router = useRouter()
  const game = useFFAStore((s) => s.games[gameId])
  const recordThrow = useFFAStore((s) => s.recordThrow)
  const undoThrow = useFFAStore((s) => s.undoThrow)
  const completeLeg = useFFAStore((s) => s.completeLeg)
  const importGame = useFFAStore((s) => s.importGame)

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [dartsUsed, setDartsUsed] = useState(3)
  const currentRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Broadcast on mount for newly created games (owner only)
  useEffect(() => {
    if (!mounted || !game) return
    let owned: string[] = []
    try { owned = JSON.parse(localStorage.getItem("owned-ffa") ?? "[]") } catch {}
    if (!owned.includes(gameId)) return
    broadcastFFA(game)
  }, [mounted]) // eslint-disable-line

  // Viewer: poll + realtime
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

  // Current тоглогчийн мөр рүү автоматаар скролл (throw хийх бүрт game өөрчлөгдөнө)
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [game])

  const kbInput  = useCallback((d: string) => setInput((p) => { const n = p + d; return parseInt(n) > 180 ? p : n }), [])
  const kbDelete = useCallback(() => setInput((p) => p.slice(0, -1)), [])

  if (!mounted) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
  if (!game) return <div className="text-center py-20 text-muted-foreground">Тоглолт олдсонгүй</div>

  const legIdx = game.legs.findIndex((l) => !l.winnerId)
  const isGameOver = game.status === "completed"
  const leg = isGameOver ? null : game.legs[legIdx]
  const currentPlayer = leg ? game.players[leg.currentPlayerIndex] : null
  const legCount = game.legs.filter((l) => l.winnerId).length

  function getRemaining(playerId: string): number {
    if (!leg) return game.startScore
    return game.startScore - (leg.throws[playerId] ?? []).reduce((s, t) => s + (t.bust ? 0 : t.score), 0)
  }

  function getPlayerAvg(playerId: string): number {
    let pts = 0, darts = 0
    for (const l of game.legs) {
      for (const t of (l.throws[playerId] ?? [])) {
        if (!t.bust) pts += t.score
        darts += t.darts
      }
    }
    return darts ? Math.round((pts / darts) * 3) : 0
  }

  // Буцааж болох throw байгаа эсэх
  const canUndo = (() => {
    if (!leg) return false
    const prevIdx = (leg.currentPlayerIndex - 1 + game.players.length) % game.players.length
    return (leg.throws[game.players[prevIdx].id] ?? []).length > 0
  })()

  const remaining = currentPlayer ? getRemaining(currentPlayer.id) : 0
  const inputNum = parseInt(input) || 0
  const afterScore = remaining - inputNum
  const outcome = input ? classifyTurn(remaining, inputNum, { doubleOut: game.doubleOut, requireBullFinish: false }) : null
  const isBust = outcome?.type === "bust"
  const isCheckout = outcome?.type === "checkout"
  const checkoutHint = currentPlayer ? getCheckout(remaining) : null
  const inputHint = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null

  function submitScore() {
    if (!currentPlayer || !leg) return
    const score = parseInt(input)
    if (isNaN(score) || !isPossibleVisitScore(score)) {
      toast.error("3 дартаар гаргах боломжгүй оноо"); setInput(""); return
    }
    recordThrow(gameId, score, dartsUsed, isBust)
    if (isCheckout) {
      const newWins = (game.wins[currentPlayer.id] ?? 0) + 1
      completeLeg(gameId, currentPlayer.id)
      toast.success(newWins >= game.firstTo ? `🏆 ${currentPlayer.name} ялав!` : `Leg ${legIdx + 1} — ${currentPlayer.name} хожлоо!`)
    } else if (isBust) {
      toast.error("Bust!")
    }
    setInput("")
    setDartsUsed(3)
  }

  // ── Game over ──
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
                p.id === game.winnerId
                  ? "bg-[oklch(0.78_0.16_85)]/10 border border-[oklch(0.78_0.16_85)]/30"
                  : "bg-secondary/30")}>
                <span className="font-medium text-sm">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">avg {getPlayerAvg(p.id) || "—"}</span>
                  <span className="font-bold score-display text-primary">{game.wins[p.id] ?? 0} leg</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-2.5 pb-3 h-[calc(100dvh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2 shrink-0">
        <button onClick={() => router.push("/local")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-bold text-sm">{game.name}</p>
          <p className="text-xs text-muted-foreground">{game.startScore} · First to {game.firstTo} · Leg {legCount + 1}</p>
        </div>
        <button
          onClick={kbDelete}
          disabled={input.length === 0}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-lg leading-none"
          title="Сүүлийн оронг устгах">
          ⌫
        </button>
      </div>

      {/* TV Scoreboard — скроллтой хайрцаг */}
      <div className="rounded-xl overflow-hidden border border-border/40 flex-1 min-h-0 flex flex-col">
        <div className="bg-zinc-900 grid grid-cols-[1fr_auto] px-3 py-1 shrink-0">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Тоглогч</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Үлдсэн</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {game.players.map((player, idx) => {
            const rem = getRemaining(player.id)
            const wins = game.wins[player.id] ?? 0
            const isCurrent = leg?.currentPlayerIndex === idx
            const throws = leg?.throws[player.id] ?? []
            const lastThrow = throws[throws.length - 1]
            const avg = getPlayerAvg(player.id)

            return (
              <div key={player.id} ref={isCurrent ? currentRowRef : undefined} className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-3 border-b border-border/20 transition-all",
                isCurrent
                  ? "bg-primary/8 border-l-[3px] border-l-primary"
                  : "border-l-[3px] border-l-transparent"
              )}>
                <div className="min-w-0">
                  <p className={cn("font-bold text-sm leading-tight truncate",
                    isCurrent ? "text-primary" : "text-muted-foreground/70")}>
                    {isCurrent && <span className="mr-1">▶</span>}{player.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground/50">avg {avg || "—"}</span>
                    {lastThrow && (
                      <span className={cn("text-xs", lastThrow.bust ? "text-destructive/60" : "text-muted-foreground/50")}>
                        {lastThrow.bust ? "Bust" : `−${lastThrow.score}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    "font-black score-display leading-tight",
                    isCurrent ? "text-2xl" : "text-xl",
                    rem <= 32 && rem > 0 ? "text-green-400" : isCurrent ? "text-foreground" : "text-muted-foreground/40"
                  )}>
                    {rem}
                  </p>
                  <div className="flex gap-0.5 justify-end mt-0.5">
                    {Array.from({ length: game.firstTo }).map((_, i) => (
                      <div key={i} className={cn("h-1.5 w-1.5 rounded-full",
                        i < wins ? "bg-primary" : "bg-border/30")} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Input display */}
      {currentPlayer && (
        <div className="rounded-xl border border-border/40 bg-card/80 px-3 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{currentPlayer.name}</p>
              {checkoutHint && !input && (
                <p className="text-xs text-green-400/80 mt-0.5">🎯 {checkoutHint}</p>
              )}
              {inputHint && (
                <p className="text-xs text-primary/70 mt-0.5">{inputHint}</p>
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

      {/* Dart selector — checkout үед л харагдана */}
      {isCheckout && (
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-xs text-muted-foreground">Дарт:</p>
          {[1, 2, 3].map((n) => (
            <button key={n} onClick={() => setDartsUsed(n)}
              className={cn("h-7 w-7 rounded-full border text-xs font-bold transition-colors",
                dartsUsed === n ? "border-primary bg-primary/20 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Keypad */}
      <div className="space-y-1.5 shrink-0">
        {KEYPAD.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-1.5">
            {row.map((key) => (
              <button key={key}
                disabled={key === "UNDO" && !canUndo}
                onClick={() => {
                  if (key === "UNDO") { undoThrow(gameId); setInput(""); setDartsUsed(3) }
                  else if (key === "*") submitScore()
                  else kbInput(String(key))
                }}
                className={cn(
                  "h-12 rounded-xl font-bold text-lg border transition-all active:scale-95",
                  key === "*"
                    ? "border-primary/50 bg-primary/20 text-primary hover:bg-primary/30 glow-primary"
                    : key === "UNDO"
                      ? "border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                      : "border-border/40 bg-card/80 hover:bg-secondary/50 score-display"
                )}>
                {key === "*" ? "OK" : key === "UNDO" ? <RotateCcw className="h-5 w-5 mx-auto" /> : key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
