"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, Delete, Trophy, Zap } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { getCheckout } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { BullOff } from "@/components/game/BullOff"
import { toast } from "sonner"

const KEYPAD = [[7,8,9],[4,5,6],[1,2,3],["*",0,"DEL"]] as const
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

export function Scoreboard() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const router = useRouter()

  // Store
  const session = useLocalGame((s) => s.sessions[sessionId])
  const startMatch = useLocalGame((s) => s.startMatch)
  const recordThrow = useLocalGame((s) => s.recordThrow)
  const completeLeg = useLocalGame((s) => s.completeLeg)
  const completeMatch = useLocalGame((s) => s.completeMatch)

  // ── ALL hooks at top level (no conditionals before hooks) ──
  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0)
  const [dartsUsed, setDartsUsed] = useState(1)
  const [showBullOff, setShowBullOff] = useState(true)
  const [showLimitBullOff, setShowLimitBullOff] = useState(false)
  const [visitRound, setVisitRound] = useState(1)

  const match = session?.matches.find((m) => m.id === matchId)
  const playerMap = session ? Object.fromEntries(session.players.map((p) => [p.id, p])) : {}
  const p1Id = (match?.player1Id ?? "") as string
  const p2Id = (match?.player2Id ?? "") as string
  const p1 = playerMap[p1Id]
  const p2 = playerMap[p2Id]
  const legsToWin = session?.firstTo ?? 1
  const limitRounds = session?.limitRounds ?? null
  const bullOffEnabled = !!(session as any)?.bullFinishAtLimit

  const currentLegIndex = match ? match.legs.filter((l) => l.winnerId !== null).length : 0
  const currentLeg = match?.legs[currentLegIndex] ?? { throws: {}, winnerId: null }

  function getRemaining(playerId: string): number {
    if (!session || session.format === "cricket" || session.format === "cutthroat") return 0
    const throws = (currentLeg as any).throws?.[playerId] ?? []
    return session.startScore - throws.reduce((a: number, t: any) => a + t.score, 0)
  }

  const activePlayerId = activePlayer === 0 ? p1Id : p2Id
  const remaining = getRemaining(activePlayerId)
  const inputNum = parseInt(input) || 0
  const afterScore = remaining - inputNum
  const isBust = afterScore < 0 || afterScore === 1
  const isCheckoutScore = afterScore === 0
  const checkoutHint = getCheckout(remaining)
  const inputHint = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null

  // Keyboard callbacks — must be at top level
  const kbInput = useCallback((d: string) => {
    setInput(p => { const next = p + d; return parseInt(next) > 180 ? p : next })
  }, [])
  const kbDelete = useCallback(() => setInput(p => p.slice(0, -1)), [])
  const kbClear = useCallback(() => setInput(""), [])

  // submitScore defined before keyboard hook
  function submitScore() {
    if (!session || !match) return
    const score = parseInt(input)
    if (isNaN(score) || score < 0 || score > 180) return
    if (isBust) { toast.error("Bust! Оноо хэтэрсэн"); setInput(""); return }

    recordThrow(sessionId, matchId, currentLegIndex, activePlayerId, score, dartsUsed)

    if (isCheckoutScore) {
      completeLeg(sessionId, matchId, currentLegIndex, activePlayerId)
      const newP1Legs = match.player1Legs + (activePlayerId === p1Id ? 1 : 0)
      const newP2Legs = match.player2Legs + (activePlayerId === p2Id ? 1 : 0)

      if (newP1Legs >= legsToWin || newP2Legs >= legsToWin) {
        completeMatch(sessionId, matchId, activePlayerId)
        toast.success(`🏆 ${playerMap[activePlayerId]?.name} тэмцэнд ялав!`)
        router.push(`/local/${sessionId}`)
        return
      }
      toast.success(`Leg ${currentLegIndex + 1} — ${playerMap[activePlayerId]?.name} хожлоо!`)
      setActivePlayer(activePlayer === 0 ? 1 : 0)
      setVisitRound(1)
    } else {
      setActivePlayer((prev) => (prev === 0 ? 1 : 0))
      if (activePlayer === 1) {
        const newRound = visitRound + 1
        setVisitRound(newRound)
        if (bullOffEnabled && limitRounds !== null && newRound > limitRounds) {
          setShowLimitBullOff(true)
        }
      }
    }
    setInput("")
    setDartsUsed(1)
  }

  // Keyboard hook — AFTER submitScore, but still at top level (no conditional returns before this)
  useScoreboardKeyboard({
    onInput: kbInput,
    onDelete: kbDelete,
    onClear: kbClear,
    onSubmit: submitScore,
    enabled: mounted && !showBullOff && !showLimitBullOff,
  })

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && match && match.status === "pending") {
      startMatch(sessionId, matchId)
    }
  }, [mounted])

  // ── RENDER ──
  if (!mounted) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
  }

  if (!session || !match) {
    return <div className="text-center py-20 text-muted-foreground">Тоглолт олдсонгүй</div>
  }

  // Bull-off before match starts
  if (showBullOff && p1 && p2) {
    return (
      <div className="max-w-sm mx-auto space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/local/${sessionId}`)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="font-semibold text-sm">{p1.name} vs {p2.name}</p>
            <p className="text-xs text-muted-foreground">{session.format} · First to {session.firstTo}</p>
          </div>
        </div>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5">
            <BullOff
              players={[{ id: p1Id, name: p1.name }, { id: p2Id, name: p2.name }]}
              onSelect={(starterId) => {
                setActivePlayer(starterId === p1Id ? 0 : 1)
                setShowBullOff(false)
              }}
              purpose="start"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Limit bull-off
  if (showLimitBullOff && p1 && p2) {
    return (
      <div className="max-w-sm mx-auto space-y-4 pt-4">
        <div>
          <p className="font-bold text-sm">Visit хязгаарт хүрлээ!</p>
          <p className="text-xs text-muted-foreground">{visitRound}/{limitRounds} visit · {p1.name} vs {p2.name}</p>
        </div>
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-3">
            <p className="text-xs text-yellow-400 font-medium text-center">
              ⚠️ Хэн ч финишлаагүй — Bull-off-оор хожигч тодорхойлно
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5">
            <BullOff
              players={[{ id: p1Id, name: p1.name }, { id: p2Id, name: p2.name }]}
              onSelect={(winnerId) => {
                setShowLimitBullOff(false)
                completeLeg(sessionId, matchId, currentLegIndex, winnerId)
                const newP1Legs = match.player1Legs + (winnerId === p1Id ? 1 : 0)
                const newP2Legs = match.player2Legs + (winnerId === p2Id ? 1 : 0)
                if (newP1Legs >= legsToWin || newP2Legs >= legsToWin) {
                  completeMatch(sessionId, matchId, winnerId)
                  toast.success(`🏆 ${playerMap[winnerId]?.name} тэмцэнд ялав!`)
                  router.push(`/local/${sessionId}`)
                  return
                }
                toast.success(`Leg — ${playerMap[winnerId]?.name} хожлоо! (Bull-off)`)
                setActivePlayer(winnerId === p1Id ? 1 : 0)
                setVisitRound(1)
              }}
              purpose="win"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── MAIN SCOREBOARD ──
  function handleKeypad(key: number | string) {
    if (key === "DEL") { setInput(p => p.slice(0, -1)); return }
    if (key === "*") { setInput(""); return }
    const next = input + key
    if (parseInt(next) > 180) return
    setInput(next)
  }

  function handleManualWin(playerId: string) {
    completeMatch(sessionId, matchId, playerId)
    toast.success(`${playerMap[playerId]?.name} ялагч боллоо`)
    router.push(`/local/${sessionId}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/local/${sessionId}`)}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">{session.name}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{session.format.toUpperCase()} · BO{session.firstTo} · Leg {currentLegIndex + 1}</p>
            {limitRounds && (
              <span className={cn("text-xs font-semibold",
                visitRound >= limitRounds ? "text-yellow-400" : "text-muted-foreground")}>
                {visitRound}/{limitRounds}v{bullOffEnabled && visitRound >= limitRounds ? " 🎯" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <kbd className="hidden sm:inline text-[9px] border border-border/50 rounded px-1 py-0.5 bg-secondary/50 text-muted-foreground">0-9 ↵</kbd>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary pulse-live">LIVE</Badge>
        </div>
      </div>

      {/* Bull-off warning */}
      {limitRounds && bullOffEnabled && visitRound >= limitRounds - 1 && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          <span>🎯</span>
          <p className="text-xs font-semibold text-yellow-400">
            {visitRound >= limitRounds
              ? `${visitRound}/${limitRounds} visit — Bull-off дараа хийгдэнэ`
              : `Bull-off ойртож байна — ${limitRounds - visitRound} visit үлдсэн`}
          </p>
        </div>
      )}

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3">
        {[{ id: p1Id, player: p1, legs: match.player1Legs, side: 0 }, { id: p2Id, player: p2, legs: match.player2Legs, side: 1 }].map(({ id, player, legs, side }) => {
          const rem = getRemaining(id)
          const isActive = activePlayer === side
          const co = isActive ? getCheckout(rem) : null
          return (
            <Card key={id} className={cn("border-2 transition-all", isActive ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border/50 bg-card/80")}>
              <CardContent className="p-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{player?.name ?? "?"}</p>
                  {isActive && <Zap className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
                <div className="flex items-center justify-center gap-1.5 my-1">
                  {Array.from({ length: legsToWin }).map((_, i) => (
                    <div key={i} className={cn("h-2 w-2 rounded-full", i < legs ? "bg-primary" : "bg-secondary")} />
                  ))}
                </div>
                <p className={cn("text-5xl font-black score-display tracking-tight",
                  isActive ? "text-primary" : "text-foreground/80")}>{rem}</p>
                {co && (
                  <div className="bg-[oklch(0.78_0.16_85)]/15 rounded px-2 py-1">
                    <p className="text-[11px] font-mono text-[oklch(0.78_0.16_85)] font-bold">{co}</p>
                  </div>
                )}
                {(() => {
                  const throws = (currentLeg as any).throws?.[id] ?? []
                  const last = throws[throws.length - 1]
                  return last ? <p className="text-xs text-muted-foreground">Last: <span className="font-semibold">{last.score}</span></p> : null
                })()}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Active player + dart counter */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-primary">
          ↑ {activePlayer === 0 ? p1?.name : p2?.name}-ийн ээлж
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Дарт:</span>
          <div className="flex gap-1">
            {[1,2,3].map(n => (
              <button key={n} onClick={() => setDartsUsed(n)}
                className={cn("h-5 w-5 rounded-full border-2 transition-all",
                  n <= dartsUsed ? "bg-primary border-primary" : "bg-transparent border-border/50")} />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">{dartsUsed}/3</span>
        </div>
      </div>

      {/* Input */}
      <Card className={cn("border-2 transition-colors",
        isBust ? "border-destructive bg-destructive/5" :
        isCheckoutScore ? "border-green-500 bg-green-500/5" : "border-border/50")}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className={cn("text-4xl font-black score-display",
              isBust ? "text-destructive" : isCheckoutScore ? "text-green-400" : "")}>
              {input || "0"}
            </p>
            <div className="text-right space-y-1">
              {isBust && <Badge className="bg-destructive/15 text-destructive border-destructive/30">BUST!</Badge>}
              {isCheckoutScore && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">CHECKOUT!</Badge>}
              {!isBust && !isCheckoutScore && input && afterScore > 0 && (
                <>
                  <p className="text-sm font-bold score-display">{afterScore}</p>
                  {inputHint && <p className="text-[10px] font-mono text-[oklch(0.78_0.16_85)]">{inputHint}</p>}
                </>
              )}
            </div>
          </div>

          {/* Dart count label */}
          <p className="text-[11px] text-muted-foreground">
            {isCheckoutScore ? "Хэдэн дартаар checkout хийв?" : "Энэ visit-т хэдэн дарт:"}
          </p>

          <Button
            className={cn("w-full", isCheckoutScore ? "bg-green-600 hover:bg-green-700 text-white" : "glow-primary")}
            disabled={!input || isBust}
            onClick={submitScore}
            size="lg">
            {isCheckoutScore ? <><Check className="h-4 w-4 mr-1.5" />Checkout!</> : "Оруулах"}
          </Button>
        </CardContent>
      </Card>

      {/* Quick scores */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_SCORES.map(s => (
          <button key={s} onClick={() => setInput(String(s))}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40 transition-colors">
            {s}
          </button>
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.flat().map((k, i) => (
          <button key={i} onClick={() => handleKeypad(k)}
            className={cn("h-14 rounded-xl text-lg font-bold transition-all active:scale-95",
              k === "DEL" ? "bg-secondary/80 text-destructive hover:bg-secondary" :
              k === "*" ? "bg-secondary/80 text-muted-foreground hover:bg-secondary" :
              "bg-secondary/50 hover:bg-secondary border border-border/30")}>
            {k === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : k === "*" ? "C" : k}
          </button>
        ))}
      </div>

      {/* Manual win */}
      <div className="pt-1 border-t border-border/40">
        <p className="text-xs text-muted-foreground text-center mb-2">Эсвэл ялагчийг шууд тохируулах</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: p1Id, name: p1?.name }, { id: p2Id, name: p2?.name }].map(({ id, name }) => (
            <button key={id} onClick={() => handleManualWin(id)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border/40 text-sm text-muted-foreground hover:border-[oklch(0.78_0.16_85)]/40 hover:text-[oklch(0.78_0.16_85)] transition-colors">
              <Trophy className="h-3.5 w-3.5" />{name} ялав
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
