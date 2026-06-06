"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, Delete, Trophy, Zap } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { getCheckout, IMPOSSIBLE_CHECKOUTS, VALID_DOUBLES, canDoubleOut } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { BullOff } from "@/components/game/BullOff"
import { toast } from "sonner"

const KEYPAD = [[7,8,9],[4,5,6],[1,2,3],["*",0,"DEL"]] as const
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

export function Scoreboard() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const router = useRouter()
  const tableRef = useRef<HTMLDivElement>(null)

  const session   = useLocalGame((s) => s.sessions[sessionId])
  const startMatch  = useLocalGame((s) => s.startMatch)
  const recordThrow = useLocalGame((s) => s.recordThrow)
  const completeLeg = useLocalGame((s) => s.completeLeg)
  const completeMatch = useLocalGame((s) => s.completeMatch)

  const [mounted, setMounted]               = useState(false)
  const [input, setInput]                   = useState("")
  const [activePlayer, setActivePlayer]     = useState<0 | 1>(0)
  const [dartsUsed, setDartsUsed]           = useState(3)
  const [showBullOff, setShowBullOff]       = useState(true)
  const [showWinnerSelect, setShowWinnerSelect] = useState(false)
  const [visitRound, setVisitRound]         = useState(1)
  const [playerOpened, setPlayerOpened]     = useState<Record<string, boolean>>({})

  const match      = session?.matches.find((m) => m.id === matchId)
  const playerMap  = session ? Object.fromEntries(session.players.map((p) => [p.id, p])) : {}
  const p1Id       = (match?.player1Id ?? "") as string
  const p2Id       = (match?.player2Id ?? "") as string
  const p1         = playerMap[p1Id]
  const p2         = playerMap[p2Id]
  const legsToWin  = session?.firstTo ?? 1
  const limitRounds = session?.limitRounds ?? null
  const startScore  = session?.startScore ?? 501

  const currentLegIndex = match ? match.legs.filter((l) => l.winnerId !== null).length : 0
  const currentLeg = match?.legs[currentLegIndex] ?? { throws: {}, winnerId: null }

  const p1Throws: any[] = (currentLeg as any).throws?.[p1Id] ?? []
  const p2Throws: any[] = (currentLeg as any).throws?.[p2Id] ?? []

  function getRemaining(playerId: string): number {
    if (!session || session.format === "cricket") return 0
    const throws = (currentLeg as any).throws?.[playerId] ?? []
    return session.startScore - throws.reduce((a: number, t: any) => a + t.score, 0)
  }

  const activePlayerId = activePlayer === 0 ? p1Id : p2Id
  const remaining  = getRemaining(activePlayerId)
  const inputNum   = parseInt(input) || 0
  const afterScore = remaining - inputNum

  const isImpossibleCheckout = afterScore > 1 && IMPOSSIBLE_CHECKOUTS.has(afterScore)
  const isBust               = afterScore < 0 || afterScore === 1 || isImpossibleCheckout
  const isCheckoutScore      = afterScore === 0
  const doubleOutEnabled     = session?.doubleOut ?? true
  const doubleInEnabled      = session?.doubleIn ?? false
  const isPlayerOpen = (id: string) => !doubleInEnabled || !!playerOpened[id]

  const checkoutHint = getCheckout(remaining)
  const inputHint    = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null
  const isOnImpossiblePosition = remaining > 1 && IMPOSSIBLE_CHECKOUTS.has(remaining)

  // ── Visit history: alternating P1, P2 per row ──
  const maxVisits = Math.max(p1Throws.length, p2Throws.length)
  type VisitRow = { dartNo: number; p1score?: number; p1rem?: number; p2score?: number; p2rem?: number }
  const visitRows: VisitRow[] = []
  for (let i = 0; i < maxVisits; i++) {
    const t1 = p1Throws[i]
    const t2 = p2Throws[i]
    const p1rem = t1 ? startScore - p1Throws.slice(0, i + 1).reduce((a: number, t: any) => a + t.score, 0) : undefined
    const p2rem = t2 ? startScore - p2Throws.slice(0, i + 1).reduce((a: number, t: any) => a + t.score, 0) : undefined
    // P1 visit row
    if (t1) visitRows.push({ dartNo: (i * 2 + 1) * 3, p1score: t1.score, p1rem })
    // P2 visit row
    if (t2) visitRows.push({ dartNo: (i + 1) * 6, p2score: t2.score, p2rem })
  }
  const totalDarts = (p1Throws.length + p2Throws.length) * 3

  // ── Safety: show winner select if limit exceeded ──
  useEffect(() => {
    if (limitRounds !== null && visitRound > limitRounds && !showWinnerSelect && !showBullOff && mounted) {
      setShowWinnerSelect(true)
    }
  }, [visitRound, limitRounds, showWinnerSelect, showBullOff, mounted])

  // ── Auto-scroll table to bottom ──
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight
    }
  }, [visitRows.length])

  const kbInput  = useCallback((d: string) => setInput(p => { const n = p + d; return parseInt(n) > 180 ? p : n }), [])
  const kbDelete = useCallback(() => setInput(p => p.slice(0, -1)), [])
  const kbClear  = useCallback(() => setInput(""), [])

  function submitScore() {
    if (!session || !match) return
    const score = parseInt(input)
    if (isNaN(score) || score < 0 || score > 180) return

    if (doubleInEnabled && !isPlayerOpen(activePlayerId)) {
      if (VALID_DOUBLES.has(score)) {
        setPlayerOpened(prev => ({ ...prev, [activePlayerId]: true }))
        toast.success("Double орлоо!")
      } else {
        toast(`Double-in шаардлагатай (${score} алдагдлаа)`)
        setInput("")
        setActivePlayer(p => p === 0 ? 1 : 0)
        if (activePlayer === 1) setVisitRound(r => r + 1)
        return
      }
    }
    if (afterScore < 0 || afterScore === 1)   { toast.error("Bust!"); setInput(""); return }
    if (isImpossibleCheckout)                  { toast.error(`${afterScore} — checkout боломжгүй`); setInput(""); return }
    if (isCheckoutScore && doubleOutEnabled && !canDoubleOut(remaining)) {
      toast.error(`${remaining} — double-out боломжгүй`); setInput(""); return
    }

    recordThrow(sessionId, matchId, currentLegIndex, activePlayerId, score, dartsUsed)

    if (isCheckoutScore) {
      completeLeg(sessionId, matchId, currentLegIndex, activePlayerId)
      const newP1 = match.player1Legs + (activePlayerId === p1Id ? 1 : 0)
      const newP2 = match.player2Legs + (activePlayerId === p2Id ? 1 : 0)
      if (newP1 >= legsToWin || newP2 >= legsToWin) {
        completeMatch(sessionId, matchId, activePlayerId)
        toast.success(`${playerMap[activePlayerId]?.name} ялав!`)
        router.push(`/local/${sessionId}`)
        return
      }
      toast.success(`Leg ${currentLegIndex + 1} — ${playerMap[activePlayerId]?.name} хожлоо!`)
      setActivePlayer(p => p === 0 ? 1 : 0)
      setVisitRound(1)
    } else {
      setActivePlayer(p => p === 0 ? 1 : 0)
      if (activePlayer === 1) {
        const nr = visitRound + 1
        setVisitRound(nr)
        if (limitRounds !== null && nr > limitRounds) {
          setShowWinnerSelect(true)
        }
      }
    }
    setInput("")
    setDartsUsed(3)
  }

  useScoreboardKeyboard({ onInput: kbInput, onDelete: kbDelete, onClear: kbClear, onSubmit: submitScore,
    enabled: mounted && !showBullOff && !showWinnerSelect })

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (mounted && match?.status === "pending") startMatch(sessionId, matchId) }, [mounted])

  function declareWinner(winnerId: string) {
    setShowWinnerSelect(false)
    completeLeg(sessionId, matchId, currentLegIndex, winnerId)
    const newP1 = match!.player1Legs + (winnerId === p1Id ? 1 : 0)
    const newP2 = match!.player2Legs + (winnerId === p2Id ? 1 : 0)
    if (newP1 >= legsToWin || newP2 >= legsToWin) {
      completeMatch(sessionId, matchId, winnerId)
      toast.success(`${playerMap[winnerId]?.name} тэмцэнд ялав!`)
      router.push(`/local/${sessionId}`)
      return
    }
    toast.success(`${playerMap[winnerId]?.name} хожлоо!`)
    // Хожигч leg дууссаны дараа эсрэг тоглогч эхэлнэ
    if (winnerId === p1Id) setActivePlayer(1)
    else if (winnerId === p2Id) setActivePlayer(0)
    setVisitRound(1)
  }

  // ── Loading ──
  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
  if (!session || !match) return <div className="text-center py-20 text-muted-foreground">Тоглолт олдсонгүй</div>

  const rem1 = getRemaining(p1Id)
  const rem2 = getRemaining(p2Id)

  // ── Bull-off screen ──
  if (showBullOff && p1 && p2) {
    return (
      <div className="max-w-sm mx-auto space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/local/${sessionId}`)} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}><ArrowLeft className="h-4 w-4" /></button>
          <div><p className="font-semibold text-sm">{p1.name} vs {p2.name}</p><p className="text-xs text-muted-foreground">{session.format} · First to {session.firstTo}</p></div>
        </div>
        <Card className="border-border/50 bg-card/80"><CardContent className="p-5">
          <BullOff players={[{ id: p1Id, name: p1.name }, { id: p2Id, name: p2.name }]}
            onSelect={(id) => { setActivePlayer(id === p1Id ? 0 : 1); setShowBullOff(false) }} purpose="start" />
        </CardContent></Card>
      </div>
    )
  }

  // ── Winner select screen ──
  if (showWinnerSelect && p1 && p2) {
    return (
      <div className="max-w-sm mx-auto pt-8 px-4 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-xl font-bold">Visit хязгаарт хүрлээ</p>
          <p className="text-sm text-muted-foreground">{visitRound}/{limitRounds} visit — Хожигчийг сонгоно уу</p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          {[{ id: p1Id, player: p1, rem: rem1 }, { id: p2Id, player: p2, rem: rem2 }].map(({ id, player, rem }) => (
            <button key={id} onClick={() => declareWinner(id)}
              className="flex items-center justify-between w-full border-2 border-border/50 rounded-2xl px-5 py-4 hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98]">
              <div className="text-left">
                <p className="font-bold text-lg">{player?.name}</p>
                <p className="text-sm text-muted-foreground">Үлдсэн: {rem}</p>
              </div>
              <div className="flex items-center gap-2 text-primary">
                <Trophy className="h-5 w-5" />
                <span className="font-semibold">Хожлоо</span>
              </div>
            </button>
          ))}
          <button onClick={() => { setShowWinnerSelect(false); setVisitRound(1); toast("Тэнцсэн — шинэ leg") }}
            className="flex items-center justify-center gap-2 w-full border border-border/30 rounded-xl px-4 py-3 hover:bg-secondary/40 transition-all text-muted-foreground text-sm">
            Тэнцсэн / Дахин тоглох
          </button>
        </div>
      </div>
    )
  }

  function handleKeypad(key: number | string) {
    if (key === "DEL") { setInput(p => p.slice(0, -1)); return }
    if (key === "*") { setInput(""); return }
    const next = input + key; if (parseInt(next) > 180) return; setInput(next)
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-2 pb-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 pt-2 pb-1">
        <button onClick={() => router.push(`/local/${sessionId}`)} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1 text-center min-w-0">
          <p className="text-sm font-bold truncate">{session.name}</p>
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <span>{session.format.toUpperCase()} · {legsToWin} Leg авна</span>
            <span>·</span>
            <span>Leg {currentLegIndex + 1}</span>
            {limitRounds && (
              <span className={cn("font-bold", visitRound >= limitRounds ? "text-yellow-400" : "")}>
                Round {visitRound}/{limitRounds}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-bold border border-primary/40 text-primary rounded px-1.5 py-0.5 shrink-0 pulse-live">LIVE</span>
      </div>

      {/* ── Leg progress ── */}
      <div className="grid grid-cols-2 gap-2 text-center">
        {[{ name: p1?.name, legs: match.player1Legs, side: 0 }, { name: p2?.name, legs: match.player2Legs, side: 1 }].map(({ name, legs, side }) => (
          <div key={side} className={cn("rounded-lg py-1.5 px-2 border", activePlayer === side ? "border-primary/40 bg-primary/5" : "border-border/30")}>
            <p className="text-xs font-semibold truncate">{name}</p>
            <div className="flex gap-1 justify-center mt-1">
              {Array.from({ length: legsToWin }).map((_, i) => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all", i < legs ? "bg-primary w-4" : "bg-border/40 w-3")} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Throw table — image style ── */}
      <div className="border border-border/40 rounded-lg overflow-hidden text-sm">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_44px_1fr] bg-secondary/50 text-[11px] text-muted-foreground font-semibold border-b border-border/30">
          <div className="grid grid-cols-2">
            <div className="px-2 py-1.5 text-center border-r border-border/20">Оноо</div>
            <div className="px-2 py-1.5 text-center">Үлдсэн</div>
          </div>
          <div className="px-1 py-1.5 text-center border-x border-border/30 text-[10px]">🎯</div>
          <div className="grid grid-cols-2">
            <div className="px-2 py-1.5 text-center border-l border-border/20">Үлдсэн</div>
            <div className="px-2 py-1.5 text-center">Оноо</div>
          </div>
        </div>

        {/* Starting row */}
        <div className="grid grid-cols-[1fr_44px_1fr] border-b border-border/20 bg-secondary/20">
          <div className="grid grid-cols-2">
            <div className="px-2 py-1.5 text-center text-muted-foreground/30 border-r border-border/10">—</div>
            <div className="px-2 py-1.5 text-center font-bold">{startScore}</div>
          </div>
          <div className="px-1 py-1.5 text-center text-[10px] text-muted-foreground/30 border-x border-border/20">0</div>
          <div className="grid grid-cols-2">
            <div className="px-2 py-1.5 text-center font-bold border-l border-border/10">{startScore}</div>
            <div className="px-2 py-1.5 text-center text-muted-foreground/30">—</div>
          </div>
        </div>

        {/* Visit rows (per-visit, alternating P1/P2) */}
        <div ref={tableRef} className="max-h-32 sm:max-h-52 overflow-y-auto overscroll-contain">
          {visitRows.map((row, i) => {
            const isP1 = row.p1score !== undefined
            const isLast = i === visitRows.length - 1
            return (
              <div key={i} className={cn("grid grid-cols-[1fr_44px_1fr] border-b border-border/10 transition-colors",
                isLast ? "bg-primary/5" : "")}>
                {/* P1 side */}
                <div className="grid grid-cols-2">
                  <div className={cn("px-2 py-1.5 text-center font-mono border-r border-border/10",
                    isP1 ? row.p1score! >= 100 ? "text-primary font-bold" : "text-foreground" : "text-muted-foreground/20")}>
                    {isP1 ? row.p1score : "·"}
                  </div>
                  <div className="px-2 py-1.5 text-center font-mono text-muted-foreground/70">
                    {isP1 && row.p1rem !== undefined ? row.p1rem : ""}
                  </div>
                </div>
                {/* Dart count */}
                <div className="px-1 py-1.5 text-center text-[11px] font-mono text-muted-foreground/60 border-x border-border/20">
                  {row.dartNo}
                </div>
                {/* P2 side */}
                <div className="grid grid-cols-2">
                  <div className="px-2 py-1.5 text-center font-mono text-muted-foreground/70 border-l border-border/10">
                    {!isP1 && row.p2rem !== undefined ? row.p2rem : ""}
                  </div>
                  <div className={cn("px-2 py-1.5 text-center font-mono",
                    !isP1 ? row.p2score! >= 100 ? "text-primary font-bold" : "text-foreground" : "text-muted-foreground/20")}>
                    {!isP1 ? row.p2score : "·"}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Active player indicator row */}
          {match.status === "ongoing" && (
            <div className="grid grid-cols-[1fr_44px_1fr] bg-primary/3">
              <div className="grid grid-cols-2">
                <div className="px-2 py-2 text-center border-r border-border/10">
                  {activePlayer === 0 && <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="px-2 py-2" />
              </div>
              <div className="px-1 py-2 text-center text-[10px] text-primary/50 font-mono border-x border-border/20">
                {totalDarts + 3}
              </div>
              <div className="grid grid-cols-2">
                <div className="px-2 py-2 border-l border-border/10" />
                <div className="px-2 py-2 text-center">
                  {activePlayer === 1 && <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Remaining scores ── */}
      <div className="grid grid-cols-2 gap-2">
        {[{ id: p1Id, rem: rem1, side: 0 }, { id: p2Id, rem: rem2, side: 1 }].map(({ id, rem, side }) => {
          const isActive = activePlayer === side
          const co = isActive ? checkoutHint : null
          return (
            <div key={id} className={cn("text-center py-2 rounded-xl border-2 transition-all",
              isActive ? "border-primary bg-primary/5" : "border-border/30 bg-secondary/20")}>
              <p className={cn("text-[52px] font-black score-display leading-none",
                isActive ? "text-primary" : "text-foreground/50")}>{rem}</p>
              {co && <p className="text-xs font-mono text-[oklch(0.78_0.16_85)] mt-0.5 font-bold">{co}</p>}
              {isOnImpossiblePosition && isActive && <p className="text-[10px] text-orange-400 mt-0.5">Checkout боломжгүй</p>}
            </div>
          )
        })}
      </div>

      {/* ── Input + dart selector ── */}
      <Card className={cn("border-2 transition-colors",
        isBust ? "border-destructive bg-destructive/5" : isCheckoutScore ? "border-green-500 bg-green-500/5" : "border-border/50")}>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className={cn("text-5xl font-black score-display", isBust ? "text-destructive" : isCheckoutScore ? "text-green-400" : "")}>
              {input || "0"}
            </p>
            <div className="text-right space-y-1">
              {isBust && <p className="text-xs font-bold text-destructive">BUST!</p>}
              {isCheckoutScore && <p className="text-xs font-bold text-green-400">CHECKOUT!</p>}
              {!isBust && !isCheckoutScore && input && afterScore > 0 && (
                <><p className="text-sm font-bold score-display">{afterScore}</p>
                {inputHint && <p className="text-[10px] font-mono text-[oklch(0.78_0.16_85)]">{inputHint}</p>}</>
              )}
            </div>
          </div>

          {/* Dart count */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              {isCheckoutScore ? "Хэдэн дартаар checkout хийв?" : "Хэдэн дарт шидэв?"}
            </p>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setDartsUsed(n)}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-sm font-bold transition-all",
                    dartsUsed === n ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                  {Array.from({ length: n }).map((_, i) => <span key={i} className="text-base">🎯</span>)}
                  <span>{n}</span>
                </button>
              ))}
            </div>
          </div>

          <Button className={cn("w-full", isCheckoutScore ? "bg-green-600 hover:bg-green-700 text-white" : "glow-primary")}
            disabled={!input || isBust} onClick={submitScore} size="lg">
            {isCheckoutScore ? <><Check className="h-4 w-4 mr-1.5" />Checkout!</> : "Оруулах"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Quick scores ── */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_SCORES.map(s => (
          <button key={s} onClick={() => setInput(String(s))}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40 transition-colors">{s}</button>
        ))}
      </div>

      {/* ── Keypad ── */}
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.flat().map((k, i) => (
          <button key={i} onClick={() => handleKeypad(k)}
            className={cn("h-14 rounded-xl text-xl font-bold transition-all active:scale-95",
              k === "DEL" ? "bg-secondary/80 text-destructive hover:bg-secondary" :
              k === "*" ? "bg-secondary/80 text-muted-foreground hover:bg-secondary" :
              "bg-secondary/50 hover:bg-secondary border border-border/30")}>
            {k === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : k === "*" ? "C" : k}
          </button>
        ))}
      </div>

      {/* ── Manual win ── */}
      <div className="pt-1 border-t border-border/40">
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
