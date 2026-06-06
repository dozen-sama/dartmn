"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, Delete, Trophy, Zap } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { getCheckout, IMPOSSIBLE_CHECKOUTS, VALID_DOUBLES, canDoubleOut } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { BullOff } from "@/components/game/BullOff"
import { toast } from "sonner"

const KEYPAD = [[7,8,9],[4,5,6],[1,2,3],["*",0,"DEL"]] as const
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

// Dart icon SVG
function DartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 3L3 10.5l7.5 3L21 3zm0 0l-7.5 10.5 3 7.5L21 3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <circle cx="10.5" cy="13.5" r="1.5"/>
    </svg>
  )
}

export function Scoreboard() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const router = useRouter()
  const tableBodyRef = useRef<HTMLDivElement>(null)

  const session = useLocalGame((s) => s.sessions[sessionId])
  const startMatch = useLocalGame((s) => s.startMatch)
  const recordThrow = useLocalGame((s) => s.recordThrow)
  const completeLeg = useLocalGame((s) => s.completeLeg)
  const completeMatch = useLocalGame((s) => s.completeMatch)

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0)
  const [dartsUsed, setDartsUsed] = useState(3)
  const [showBullOff, setShowBullOff] = useState(true)
  const [showWinnerSelect, setShowWinnerSelect] = useState(false)
  const [visitRound, setVisitRound] = useState(1)
  const [playerOpened, setPlayerOpened] = useState<Record<string, boolean>>({})

  const match = session?.matches.find((m) => m.id === matchId)
  const playerMap = session ? Object.fromEntries(session.players.map((p) => [p.id, p])) : {}
  const p1Id = (match?.player1Id ?? "") as string
  const p2Id = (match?.player2Id ?? "") as string
  const p1 = playerMap[p1Id]
  const p2 = playerMap[p2Id]
  const legsToWin = session?.firstTo ?? 1
  const limitRounds = session?.limitRounds ?? null
  const startScore = session?.startScore ?? 501

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

  const isImpossibleCheckout = afterScore > 1 && IMPOSSIBLE_CHECKOUTS.has(afterScore)
  const isBust = afterScore < 0 || afterScore === 1 || isImpossibleCheckout
  const isCheckoutScore = afterScore === 0
  const doubleOutEnabled = session?.doubleOut ?? true
  const cannotDoubleOut = isCheckoutScore && doubleOutEnabled && !canDoubleOut(remaining)
  const checkoutHint = getCheckout(remaining)
  const inputHint = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null
  const isOnImpossiblePosition = remaining > 1 && IMPOSSIBLE_CHECKOUTS.has(remaining)
  const doubleInEnabled = session?.doubleIn ?? false
  const isPlayerOpen = (id: string) => !doubleInEnabled || !!playerOpened[id]

  // Throw history for table display
  const p1Throws = (currentLeg as any).throws?.[p1Id] ?? []
  const p2Throws = (currentLeg as any).throws?.[p2Id] ?? []
  const maxVisits = Math.max(p1Throws.length, p2Throws.length)

  // Total darts thrown in current leg
  const totalDartsInLeg = (p1Throws.length + p2Throws.length) * 3

  function getP1Remaining(visitIdx: number): number {
    const throws = (currentLeg as any).throws?.[p1Id] ?? []
    return startScore - throws.slice(0, visitIdx + 1).reduce((a: any, t: any) => a + t.score, 0)
  }
  function getP2Remaining(visitIdx: number): number {
    const throws = (currentLeg as any).throws?.[p2Id] ?? []
    return startScore - throws.slice(0, visitIdx + 1).reduce((a: any, t: any) => a + t.score, 0)
  }

  const kbInput = useCallback((d: string) => {
    setInput(p => { const next = p + d; return parseInt(next) > 180 ? p : next })
  }, [])
  const kbDelete = useCallback(() => setInput(p => p.slice(0, -1)), [])
  const kbClear = useCallback(() => setInput(""), [])

  function submitScore() {
    if (!session || !match) return
    const score = parseInt(input)
    if (isNaN(score) || score < 0 || score > 180) return

    if (doubleInEnabled && !isPlayerOpen(activePlayerId)) {
      if (VALID_DOUBLES.has(score)) {
        setPlayerOpened(prev => ({ ...prev, [activePlayerId]: true }))
        toast.success("Double орлоо — тоглолт эхэллээ!")
      } else {
        toast(`Double-in шаардлагатай — энэ visit алдагдлаа (${score})`)
        setInput("")
        setActivePlayer((prev) => (prev === 0 ? 1 : 0))
        if (activePlayer === 1) setVisitRound(r => r + 1)
        return
      }
    }

    if (afterScore < 0 || afterScore === 1) { toast.error("Bust! Оноо хэтэрсэн"); setInput(""); return }
    if (isImpossibleCheckout) { toast.error(`${afterScore} — checkout боломжгүй`); setInput(""); return }
    if (isCheckoutScore && doubleOutEnabled && !canDoubleOut(remaining)) {
      toast.error(`${remaining} — double-out боломжгүй`); setInput(""); return
    }

    recordThrow(sessionId, matchId, currentLegIndex, activePlayerId, score, dartsUsed)

    if (isCheckoutScore) {
      completeLeg(sessionId, matchId, currentLegIndex, activePlayerId)
      const newP1Legs = match.player1Legs + (activePlayerId === p1Id ? 1 : 0)
      const newP2Legs = match.player2Legs + (activePlayerId === p2Id ? 1 : 0)
      if (newP1Legs >= legsToWin || newP2Legs >= legsToWin) {
        completeMatch(sessionId, matchId, activePlayerId)
        toast.success(`${playerMap[activePlayerId]?.name} тэмцэнд ялав!`)
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
        if (limitRounds !== null && newRound > limitRounds) {
          setShowWinnerSelect(true)
        }
      }
    }
    setInput("")
    setDartsUsed(3)
    setTimeout(() => tableBodyRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50)
  }

  useScoreboardKeyboard({
    onInput: kbInput, onDelete: kbDelete, onClear: kbClear, onSubmit: submitScore,
    enabled: mounted && !showBullOff && !showWinnerSelect,
  })

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (mounted && match && match.status === "pending") startMatch(sessionId, matchId)
  }, [mounted])

  if (!mounted) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
  if (!session || !match) return <div className="text-center py-20 text-muted-foreground">Тоглолт олдсонгүй</div>

  // ── Bull-off ──
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
              onSelect={(starterId) => { setActivePlayer(starterId === p1Id ? 0 : 1); setShowBullOff(false) }}
              purpose="start"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Visit limit winner selector ──
  if (showWinnerSelect && p1 && p2) {
    return (
      <div className="max-w-sm mx-auto pt-6 px-4 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-lg font-bold">Visit хязгаарт хүрлээ</p>
          <p className="text-sm text-muted-foreground">
            {visitRound}/{limitRounds} visit · Хожигчийг тохируулна уу
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {[{ id: p1Id, player: p1 }, { id: p2Id, player: p2 }].map(({ id, player }) => (
            <button
              key={id}
              onClick={() => {
                setShowWinnerSelect(false)
                completeLeg(sessionId, matchId, currentLegIndex, id)
                const newP1Legs = match.player1Legs + (id === p1Id ? 1 : 0)
                const newP2Legs = match.player2Legs + (id === p2Id ? 1 : 0)
                if (newP1Legs >= legsToWin || newP2Legs >= legsToWin) {
                  completeMatch(sessionId, matchId, id)
                  toast.success(`${playerMap[id]?.name} тэмцэнд ялав!`)
                  router.push(`/local/${sessionId}`)
                  return
                }
                toast.success(`${player?.name} хожлоо!`)
                setActivePlayer(id === p1Id ? 1 : 0)
                setVisitRound(1)
              }}
              className="flex items-center gap-3 w-full border border-border/50 rounded-xl px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
              <Trophy className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{player?.name}</p>
                <p className="text-xs text-muted-foreground">Хожлоо</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => {
              setShowWinnerSelect(false)
              // Тэнцсэн: leg-ийг хэнд ч өгөхгүй, шинэ leg эхлэнэ
              toast("Тэнцсэн — шинэ leg")
              setVisitRound(1)
              setActivePlayer(0)
            }}
            className="flex items-center justify-center gap-2 w-full border border-border/30 rounded-xl px-4 py-2.5 hover:border-border hover:bg-secondary/30 transition-all text-muted-foreground text-sm">
            Тэнцсэн / Дахин тоглох
          </button>
        </div>
      </div>
    )
  }

  function handleKeypad(key: number | string) {
    if (key === "DEL") { setInput(p => p.slice(0, -1)); return }
    if (key === "*") { setInput(""); return }
    const next = input + key
    if (parseInt(next) > 180) return
    setInput(next)
  }

  const rem1 = getRemaining(p1Id)
  const rem2 = getRemaining(p2Id)

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-0">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-1 py-2">
        <button onClick={() => router.push(`/local/${sessionId}`)}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-bold truncate">{session.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {session.format.toUpperCase()} · {legsToWin} Leg авна · Leg {currentLegIndex + 1}
            {limitRounds && <span className={cn("ml-2 font-semibold", visitRound >= limitRounds ? "text-yellow-400" : "")}>
              {visitRound}/{limitRounds}v
            </span>}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary pulse-live shrink-0">LIVE</Badge>
      </div>

      {/* ── Leg score ── */}
      <div className="flex items-center justify-center gap-6 py-2 border-y border-border/40 bg-secondary/20 mb-0">
        <div className="text-center">
          <p className={cn("text-3xl font-black score-display", activePlayer === 0 ? "text-primary" : "text-foreground/50")}>
            {match.player1Legs}
          </p>
          <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{p1?.name}</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Leg</p>
          <div className="flex gap-1 mt-0.5">
            {Array.from({ length: legsToWin }).map((_, i) => (
              <div key={i} className={cn("h-1.5 w-4 rounded-full transition-all",
                i < match.player1Legs ? "bg-primary" : "bg-border/40")} />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: legsToWin }).map((_, i) => (
              <div key={i} className={cn("h-1.5 w-4 rounded-full transition-all",
                i < match.player2Legs ? "bg-primary" : "bg-border/40")} />
            ))}
          </div>
        </div>
        <div className="text-center">
          <p className={cn("text-3xl font-black score-display", activePlayer === 1 ? "text-primary" : "text-foreground/50")}>
            {match.player2Legs}
          </p>
          <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{p2?.name}</p>
        </div>
      </div>

      {/* ── Throw table ── */}
      <div className="border border-border/30 rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] bg-secondary/40 border-b border-border/30 text-[11px] text-muted-foreground font-medium">
          <div className="grid grid-cols-2 divide-x divide-border/20">
            <div className="px-2 py-1.5 text-center">{p1?.name?.split(" ")[0] ?? "P1"}</div>
            <div className="px-2 py-1.5 text-center">Үлдсэн</div>
          </div>
          <div className="px-3 py-1.5 text-center text-[10px] border-x border-border/30">🎯</div>
          <div className="grid grid-cols-2 divide-x divide-border/20">
            <div className="px-2 py-1.5 text-center">Үлдсэн</div>
            <div className="px-2 py-1.5 text-center">{p2?.name?.split(" ")[0] ?? "P2"}</div>
          </div>
        </div>

        {/* Starting score row */}
        <div className="grid grid-cols-[1fr_auto_1fr] border-b border-border/20 bg-card/30">
          <div className="grid grid-cols-2 divide-x divide-border/10">
            <div className="px-2 py-1.5 text-center text-sm text-muted-foreground/40">—</div>
            <div className="px-2 py-1.5 text-center text-sm font-bold">{startScore}</div>
          </div>
          <div className="px-3 py-1.5 text-center text-[10px] text-muted-foreground/30 border-x border-border/20">0</div>
          <div className="grid grid-cols-2 divide-x divide-border/10">
            <div className="px-2 py-1.5 text-center text-sm font-bold">{startScore}</div>
            <div className="px-2 py-1.5 text-center text-sm text-muted-foreground/40">—</div>
          </div>
        </div>

        {/* Visit rows */}
        <div ref={tableBodyRef} className="max-h-40 overflow-y-auto">
          {Array.from({ length: maxVisits }).map((_, i) => {
            const t1 = p1Throws[i]
            const t2 = p2Throws[i]
            const dartCount = (i + 1) * 3
            const isLastP1 = i === p1Throws.length - 1 && t1
            const isLastP2 = i === p2Throws.length - 1 && t2

            return (
              <div key={i} className={cn(
                "grid grid-cols-[1fr_auto_1fr] border-b border-border/10 text-sm",
                (isLastP1 || isLastP2) && "bg-primary/3"
              )}>
                <div className="grid grid-cols-2 divide-x divide-border/10">
                  <div className={cn("px-2 py-1.5 text-center font-mono",
                    t1?.score > 100 ? "text-primary font-bold" : t1 ? "text-foreground" : "text-muted-foreground/20")}>
                    {t1 ? t1.score : "·"}
                  </div>
                  <div className="px-2 py-1.5 text-center font-mono text-muted-foreground">
                    {t1 ? getP1Remaining(i) : ""}
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1.5 text-center text-[11px] font-mono border-x border-border/20",
                  activePlayer === 0 && i === p1Throws.length && i === p2Throws.length
                    ? "text-primary font-bold" : "text-muted-foreground/50"
                )}>
                  {dartCount}
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/10">
                  <div className="px-2 py-1.5 text-center font-mono text-muted-foreground">
                    {t2 ? getP2Remaining(i) : ""}
                  </div>
                  <div className={cn("px-2 py-1.5 text-center font-mono",
                    t2?.score > 100 ? "text-primary font-bold" : t2 ? "text-foreground" : "text-muted-foreground/20")}>
                    {t2 ? t2.score : "·"}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Active player row (empty, with indicator) */}
          {match.status === "ongoing" && (
            <div className="grid grid-cols-[1fr_auto_1fr] bg-primary/5">
              <div className="grid grid-cols-2 divide-x divide-border/10">
                <div className="px-2 py-2 text-center">
                  {activePlayer === 0 && <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="px-2 py-2" />
              </div>
              <div className="px-3 py-2 border-x border-border/20 text-center text-[11px] text-primary/50 font-mono">
                {totalDartsInLeg + (activePlayer === 0 ? p2Throws.length * 3 : p1Throws.length * 3)}
              </div>
              <div className="grid grid-cols-2 divide-x divide-border/10">
                <div className="px-2 py-2" />
                <div className="px-2 py-2 text-center">
                  {activePlayer === 1 && <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Big remaining scores ── */}
      <div className="grid grid-cols-2 gap-2 py-2">
        {[{ id: p1Id, rem: rem1, side: 0 }, { id: p2Id, rem: rem2, side: 1 }].map(({ id, rem, side }) => {
          const isActive = activePlayer === side
          const co = isActive ? checkoutHint : getCheckout(rem)
          return (
            <div key={id} className={cn(
              "text-center py-2 rounded-lg border-2 transition-all",
              isActive ? "border-primary bg-primary/5" : "border-border/30 bg-secondary/20"
            )}>
              <p className={cn("text-5xl font-black score-display leading-none",
                isActive ? "text-primary" : "text-foreground/60")}>{rem}</p>
              {co && isActive && (
                <p className="text-xs font-mono text-[oklch(0.78_0.16_85)] mt-1 font-bold">{co}</p>
              )}
              {isOnImpossiblePosition && isActive && (
                <p className="text-[10px] text-orange-400 mt-0.5">Checkout боломжгүй</p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Input + dart selector ── */}
      <Card className={cn("border-2 transition-colors",
        isBust ? "border-destructive bg-destructive/5" :
        isCheckoutScore ? "border-green-500 bg-green-500/5" : "border-border/50")}>
        <CardContent className="p-3 space-y-3">
          {/* Input display */}
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

          {/* Dart count selector */}
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {isCheckoutScore ? "Хэдэн дартаар checkout хийв?" : "Хэдэн дарт шидэв?"}
            </p>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setDartsUsed(n)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all",
                    dartsUsed === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  )}>
                  <div className="flex gap-0.5">
                    {Array.from({ length: n }).map((_, i) => (
                      <DartIcon key={i} className="h-4 w-4" />
                    ))}
                  </div>
                  <span className="text-xs font-bold">{n} дарт</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            className={cn("w-full", isCheckoutScore ? "bg-green-600 hover:bg-green-700 text-white" : "glow-primary")}
            disabled={!input || isBust}
            onClick={submitScore}
            size="lg">
            {isCheckoutScore ? <><Check className="h-4 w-4 mr-1.5" />Checkout!</> : "Оруулах"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Quick scores ── */}
      <div className="flex gap-1.5 flex-wrap pt-1">
        {QUICK_SCORES.map(s => (
          <button key={s} onClick={() => setInput(String(s))}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40 transition-colors">
            {s}
          </button>
        ))}
      </div>

      {/* ── Keypad ── */}
      <div className="grid grid-cols-3 gap-2 pt-1">
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

      {/* ── Manual win ── */}
      <div className="pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground text-center mb-2">Ялагчийг шууд тохируулах</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: p1Id, name: p1?.name }, { id: p2Id, name: p2?.name }].map(({ id, name }) => (
            <button key={id}
              onClick={() => { completeMatch(sessionId, matchId, id); toast.success(`${name} ялагч боллоо`); router.push(`/local/${sessionId}`) }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border/40 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
              <Trophy className="h-3.5 w-3.5" />{name} ялав
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
