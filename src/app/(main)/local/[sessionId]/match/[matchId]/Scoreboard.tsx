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

const KEYPAD = [
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
  ["*", 0, "DEL"],
]

// Common quick-score buttons
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

export function Scoreboard() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const router = useRouter()
  const session = useLocalGame((s) => s.sessions[sessionId])
  const startMatch = useLocalGame((s) => s.startMatch)
  const recordThrow = useLocalGame((s) => s.recordThrow)
  const completeLeg = useLocalGame((s) => s.completeLeg)
  const completeMatch = useLocalGame((s) => s.completeMatch)

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0)
  const [dartsUsed, setDartsUsed] = useState(1)  // current dart in visit (1, 2, 3)
  const [confirmWinner, setConfirmWinner] = useState<string | null>(null)
  const [showCheckoutHint, setShowCheckoutHint] = useState(true)
  const [showBullOff, setShowBullOff] = useState(true)
  const [visitRound, setVisitRound] = useState(1)  // current round/visit number

  const match = session?.matches.find((m) => m.id === matchId)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && match && match.status === "pending") {
      startMatch(sessionId, matchId)
    }
  }, [])

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>

  if (!session || !match) {
    return <div className="text-center py-20 text-muted-foreground">Тоглолт олдсонгүй</div>
  }

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const p1Id = match.player1Id as string
  const p2Id = match.player2Id as string
  const p1 = playerMap[p1Id]
  const p2 = playerMap[p2Id]
  const legsToWin = session.firstTo  // First to N legs/sets

  const currentLegIndex = match.legs.filter((l) => l.winnerId !== null).length
  const currentLeg = match.legs[currentLegIndex] ?? { throws: {}, winnerId: null, legNumber: currentLegIndex + 1 }

  function getRemaining(playerId: string): number {
    if (session.format === "cricket" || session.format === "cutthroat") return 0
    const throws = currentLeg.throws[playerId] ?? []
    return session.startScore - throws.reduce((a, t) => a + t.score, 0)
  }

  const activePlayerId = activePlayer === 0 ? p1Id : p2Id
  const remaining = getRemaining(activePlayerId)
  const inputNum = parseInt(input) || 0
  const afterScore = remaining - inputNum
  const isBust = afterScore < 0 || afterScore === 1
  const isCheckoutScore = afterScore === 0
  const checkoutHint = showCheckoutHint ? getCheckout(remaining) : null
  const inputCheckoutHint = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null

  function handleKeypad(key: number | string) {
    if (key === "DEL") {
      setInput((prev) => prev.slice(0, -1))
    } else if (key === "*") {
      setInput("")
    } else {
      const next = input + key
      if (parseInt(next) > 180) return
      setInput(next)
    }
  }

  function handleQuickScore(score: number) {
    setInput(String(score))
  }

  // Keyboard input — computer дээр ашиглахад
  const kbInput = useCallback((d: string) => {
    setInput(p => { const next = p + d; return parseInt(next) > 180 ? p : next })
  }, [])
  useScoreboardKeyboard({
    onInput: kbInput,
    onDelete: useCallback(() => setInput(p => p.slice(0, -1)), []),
    onClear: useCallback(() => setInput(""), []),
    onSubmit: submitScore,
    enabled: !showBullOff,
  })

  // Bull-off screen
  if (showBullOff && p1 && p2) {
    const players = [
      { id: p1Id, name: p1.name },
      { id: p2Id, name: p2.name },
    ]
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
              players={players}
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

  // Limit round-д хүрмэгц bull-off хийнэ
  const isAtLimit = session.limitRounds !== null && visitRound > session.limitRounds
  const bullOffAtLimit = isAtLimit && (session as any).bullFinishAtLimit === true
  const [showLimitBullOff, setShowLimitBullOff] = useState(false)

  function submitScore() {
    const score = parseInt(input)
    if (isNaN(score) || score < 0 || score > 180) return
    if (isBust) { toast.error("Bust! Оноо хэтэрсэн"); setInput(""); return }

    recordThrow(sessionId, matchId, currentLegIndex, activePlayerId, score, dartsUsed)

    if (isCheckoutScore) {
      completeLeg(sessionId, matchId, currentLegIndex, activePlayerId)
      const newP1Legs = match!.player1Legs + (activePlayerId === p1Id ? 1 : 0)
      const newP2Legs = match!.player2Legs + (activePlayerId === p2Id ? 1 : 0)

      if (newP1Legs >= legsToWin || newP2Legs >= legsToWin) {
        const winnerId = activePlayerId
        completeMatch(sessionId, matchId, winnerId)
        toast.success(`🏆 ${playerMap[winnerId]?.name} тэмцэнд ялав!`)
        router.push(`/local/${sessionId}`)
        return
      }
      toast.success(`Leg ${currentLegIndex + 1} — ${playerMap[activePlayerId]?.name} хожлоо!`)
      setActivePlayer(activePlayer === 0 ? 1 : 0)
      setVisitRound(1)  // leg шинэ → round reset
    } else {
      // Turn switches — next player's visit
      setActivePlayer((prev) => (prev === 0 ? 1 : 0))
      // Both players completed one visit → round++
      if (activePlayer === 1) {
        const newRound = visitRound + 1
        setVisitRound(newRound)
        // Limit-д хүрмэгц bull-off
        if (bullOffAtLimit || (session.limitRounds !== null && newRound > session.limitRounds && (session as any).bullFinishAtLimit)) {
          setShowLimitBullOff(true)
        }
      }
    }
    setInput("")
    setDartsUsed(1)
  }

  // Limit bull-off: хожигч сонгох
  function handleLimitBullOff(winnerId: string) {
    setShowLimitBullOff(false)
    completeLeg(sessionId, matchId, currentLegIndex, winnerId)
    const newP1Legs = match!.player1Legs + (winnerId === p1Id ? 1 : 0)
    const newP2Legs = match!.player2Legs + (winnerId === p2Id ? 1 : 0)
    if (newP1Legs >= legsToWin || newP2Legs >= legsToWin) {
      completeMatch(sessionId, matchId, winnerId)
      toast.success(`🏆 ${playerMap[winnerId]?.name} тэмцэнд ялав!`)
      router.push(`/local/${sessionId}`)
      return
    }
    toast.success(`Leg — ${playerMap[winnerId]?.name} хожлоо! (Bull-off)`)
    setActivePlayer(winnerId === p1Id ? 1 : 0)
    setVisitRound(1)
  }

  function handleManualWin(playerId: string) {
    // Manual match winner (for forfeit / walkover)
    completeMatch(sessionId, matchId, playerId)
    toast.success(`${playerMap[playerId]?.name} ялагч боллоо`)
    router.push(`/local/${sessionId}`)
  }

  // Limit bull-off screen
  if (showLimitBullOff && p1 && p2) {
    return (
      <div className="max-w-sm mx-auto space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-bold text-sm">Round хязгаарт хүрлээ!</p>
            <p className="text-xs text-muted-foreground">
              Round {visitRound}/{session.limitRounds} · {p1.name} vs {p2.name}
            </p>
          </div>
        </div>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 pb-2">
            <p className="text-xs text-destructive font-medium text-center">
              ⚠️ Хэн ч финишлаагүй — Bull-off-оор хожигчийг тодорхойлно
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5">
            <BullOff
              players={[{ id: p1Id, name: p1.name }, { id: p2Id, name: p2.name }]}
              onSelect={handleLimitBullOff}
              purpose="win"
            />
          </CardContent>
        </Card>
      </div>
    )
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {session.format.toUpperCase()} · BO{session.firstTo} · Leg {currentLegIndex + 1}
            </p>
            {/* Round counter */}
            {session.limitRounds && (
              <span className={cn("text-xs font-semibold",
                isAtLimit ? "text-destructive" : "text-muted-foreground")}>
                Round {visitRound}/{session.limitRounds}
                {isAtLimit && (session as any).bullFinishAtLimit && " 🎯"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <kbd className="hidden sm:inline text-[9px] border border-border/50 rounded px-1 py-0.5 bg-secondary/50 text-muted-foreground">0-9 ↵</kbd>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary pulse-live">LIVE</Badge>
        </div>
      </div>

      {/* Bull-off warning — limit ойртож байна */}
      {session.limitRounds && (session as any).bullFinishAtLimit && visitRound >= session.limitRounds - 1 && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          <span className="text-lg">🎯</span>
          <div>
            <p className="text-xs font-bold text-yellow-400">
              {visitRound >= session.limitRounds ? "Bull-off раунд!" : `Bull-off ойртож байна (${session.limitRounds - visitRound} раунд үлдсэн)`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {visitRound >= session.limitRounds
                ? "Энэ visit-ийн дараа Bull-off хийж хожигчийг тодорхойлно"
                : "Хязгаарт хүрэхэд финишлаагүй бол Bull-off хийнэ"}
            </p>
          </div>
        </div>
      )}

      {/* Score display */}
      <div className="grid grid-cols-2 gap-3">
        {[{ id: p1Id, player: p1, legs: match.player1Legs, side: 0 }, { id: p2Id, player: p2, legs: match.player2Legs, side: 1 }].map(({ id, player, legs, side }) => {
          const rem = getRemaining(id)
          const isActive = activePlayer === side
          const co = isActive && showCheckoutHint ? getCheckout(rem) : null
          return (
            <Card key={id} className={cn("border-2 transition-all", isActive ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border/50 bg-card/80")}>
              <CardContent className="p-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{player?.name ?? "?"}</p>
                  {isActive && <Zap className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>

                {/* Leg score */}
                <div className="flex items-center justify-center gap-2 my-1">
                  {Array.from({ length: session.firstTo }).map((_, i) => (
                    <div key={i} className={cn("h-2 w-2 rounded-full", i < legs ? "bg-primary" : "bg-secondary")} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{legs} leg</p>

                {/* Remaining */}
                <p className={cn("text-5xl font-black score-display tracking-tight",
                  isActive ? "text-primary" : "text-foreground/80")}>
                  {rem}
                </p>

                {/* Checkout hint */}
                {co && (
                  <div className="bg-[oklch(0.78_0.16_85)]/15 rounded px-2 py-1">
                    <p className="text-[11px] font-mono text-[oklch(0.78_0.16_85)] font-semibold">{co}</p>
                  </div>
                )}

                {/* Last throw */}
                {(() => {
                  const throws = currentLeg.throws[id] ?? []
                  const last = throws[throws.length - 1]
                  return last ? (
                    <p className="text-xs text-muted-foreground">Last: <span className="font-semibold">{last.score}</span></p>
                  ) : null
                })()}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Active player indicator + dart counter */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-primary">
          ↑ {activePlayer === 0 ? p1?.name : p2?.name}-ийн ээлж
        </p>
        {/* Dart counter: ●●○ */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Дарт:</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setDartsUsed(n)}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-all",
                  n <= dartsUsed ? "bg-primary border-primary" : "bg-transparent border-border/50"
                )} />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">{dartsUsed}/3</span>
        </div>
      </div>

      {/* Input display */}
      <Card className={cn("border-2 transition-colors", isBust ? "border-destructive bg-destructive/5" : isCheckoutScore ? "border-green-500 bg-green-500/5" : "border-border/50")}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className={cn("text-4xl font-black score-display min-w-[80px]",
                isBust ? "text-destructive" : isCheckoutScore ? "text-green-400" : "text-foreground")}>
                {input || "0"}
              </p>
              {isBust && <Badge className="bg-destructive/15 text-destructive border-destructive/30">BUST!</Badge>}
              {isCheckoutScore && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">CHECKOUT!</Badge>}
            </div>
            {afterScore > 0 && !isBust && input && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Үлдэх</p>
                <p className="text-xl font-bold score-display">{afterScore}</p>
                {inputCheckoutHint && <p className="text-[11px] font-mono text-[oklch(0.78_0.16_85)]">{inputCheckoutHint}</p>}
              </div>
            )}
          </div>

          {/* Darts used selector — always visible */}
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-muted-foreground">
              {isCheckoutScore ? "Хэдэн дартаар checkout хийв?" : "Энэ visit-т хэдэн дарт:"}
            </p>
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setDartsUsed(n)}
                className={cn("h-7 w-7 rounded-md text-xs font-bold border transition-colors",
                  dartsUsed === n ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:border-border")}>
                {n}
                </button>
              ))}
          </div>

          {/* Submit */}
          <Button
            className={cn("w-full", isCheckoutScore ? "bg-green-600 hover:bg-green-700 text-white" : "glow-primary")}
            disabled={!input || isBust}
            onClick={submitScore}
            size="lg"
          >
            {isCheckoutScore ? <><Check className="h-4 w-4 mr-1.5" />Checkout!</> : "Оруулах"}
          </Button>
        </CardContent>
      </Card>

      {/* Quick scores */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_SCORES.map((s) => (
          <button key={s} onClick={() => handleQuickScore(s)}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40 transition-colors">
            {s}
          </button>
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.flat().map((key, i) => (
          <button
            key={i}
            onClick={() => handleKeypad(key)}
            className={cn(
              "h-14 rounded-xl text-lg font-bold transition-all active:scale-95",
              key === "DEL" ? "bg-secondary/80 text-destructive hover:bg-secondary text-base" :
              key === "*" ? "bg-secondary/80 text-muted-foreground hover:bg-secondary text-base" :
              "bg-secondary/50 hover:bg-secondary border border-border/30"
            )}
          >
            {key === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : key === "*" ? "C" : key}
          </button>
        ))}
      </div>

      {/* Manual win */}
      <div className="pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground text-center mb-2">Эсвэл ялагчийг шууд тохируулах</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: p1Id, name: p1?.name }, { id: p2Id, name: p2?.name }].map(({ id, name }) => (
            <button key={id} onClick={() => handleManualWin(id)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border/40 text-sm text-muted-foreground hover:border-[oklch(0.78_0.16_85)]/40 hover:text-[oklch(0.78_0.16_85)] transition-colors">
              <Trophy className="h-3.5 w-3.5" />
              {name} ялав
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
