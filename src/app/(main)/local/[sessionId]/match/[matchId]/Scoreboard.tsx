"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, Delete, Trophy, Volume2, VolumeX } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { broadcastSession } from "@/lib/local-game/sync"
import type { LegThrow, LocalLeg } from "@/lib/local-game/types"
import { getCheckout, IMPOSSIBLE_CHECKOUTS, VALID_DOUBLES, classifyTurn, isPossibleVisitScore } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { useCaller } from "@/hooks/useCaller"
import { BullOff } from "@/components/game/BullOff"
import { DartSelector } from "@/components/game/DartSelector"
import { toast } from "sonner"

const KEYPAD = [[1,2,3],[4,5,6],[7,8,9],["*",0,"DEL"]] as const
const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]

export function Scoreboard() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const router = useRouter()
  const tableRef = useRef<HTMLDivElement>(null)
  const { enabled: callerOn, supported: callerSupported, toggle: toggleCaller, announce } = useCaller()

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
  const currentLeg: Pick<LocalLeg, "throws" | "winnerId"> = match?.legs[currentLegIndex] ?? { throws: {}, winnerId: null }

  const p1Throws: LegThrow[] = currentLeg.throws?.[p1Id] ?? []
  const p2Throws: LegThrow[] = currentLeg.throws?.[p2Id] ?? []

  function getRemaining(playerId: string): number {
    if (!session) return 0
    const throws: LegThrow[] = currentLeg.throws?.[playerId] ?? []
    return session.startScore - throws.reduce((a, t) => a + (t.bust ? 0 : t.score), 0)
  }

  const activePlayerId = activePlayer === 0 ? p1Id : p2Id
  const remaining  = getRemaining(activePlayerId)
  const inputNum   = parseInt(input) || 0
  const afterScore = remaining - inputNum

  const doubleOutEnabled     = session?.doubleOut ?? true
  const doubleInEnabled      = session?.doubleIn ?? false
  const atLimit              = limitRounds !== null && visitRound >= limitRounds
  const requireBullFinish    = atLimit && (session?.bullFinishAtLimit ?? false)
  // Engine-ийн нэг эх сурвалж — bust/checkout-ийг classifyTurn шийднэ
  const outcome = input !== "" ? classifyTurn(remaining, inputNum, { doubleOut: doubleOutEnabled, requireBullFinish }) : null
  const isBust               = outcome?.type === "bust"
  const isCheckoutScore      = outcome?.type === "checkout"
  const isPlayerOpen = (id: string) => !doubleInEnabled || !!playerOpened[id]

  const checkoutHint = getCheckout(remaining)
  const inputHint    = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null
  const isOnImpossiblePosition = remaining > 1 && IMPOSSIBLE_CHECKOUTS.has(remaining)

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
  }, [p1Throws.length, p2Throws.length])

  const kbInput  = useCallback((d: string) => setInput(p => { const n = p + d; return parseInt(n) > 180 ? p : n }), [])
  const kbDelete = useCallback(() => setInput(p => p.slice(0, -1)), [])
  const kbClear  = useCallback(() => setInput(""), [])

  function submitScore() {
    if (!session || !match) return
    const score = parseInt(input)
    if (isNaN(score) || !isPossibleVisitScore(score)) {
      toast.error("3 дартаар гаргах боломжгүй оноо"); setInput(""); return
    }

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

    // bust/checkout/энгийн оноо — бүгдийг classifyTurn (isBust/isCheckoutScore) шийднэ.
    // Bust ч бүртгэгдэж, ээлж дамжина (оноо нь revert).
    recordThrow(sessionId, matchId, currentLegIndex, activePlayerId, score, dartsUsed, isBust)

    // Дуут caller — шидсэн хүний оноо, дараа нь ээлж нь болсон тоглогчийн үлдэгдэл
    const otherId = activePlayerId === p1Id ? p2Id : p1Id
    announce({
      points: score,
      outcome: isCheckoutScore ? "checkout" : isBust ? "bust" : "score",
      nextRemaining: getRemaining(otherId),
    })

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
      if (isBust) toast.error("Bust!")
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

  // Any scoring device broadcasts session changes to Supabase for live sync
  useEffect(() => {
    if (!mounted || !session) return
    broadcastSession(session)
  }, [session, mounted, sessionId])

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

  // ── TV-style history / average helpers ──
  const activeRound = (activePlayer === 0 ? p1Throws.length : p2Throws.length) + 1
  const rowCount = Math.max(p1Throws.length, p2Throws.length, activeRound)
  const avgOf = (throws: LegThrow[]) => {
    const darts = throws.reduce((a, t) => a + (t.darts ?? 3), 0)
    const pts = throws.reduce((a, t) => a + (t.bust ? 0 : t.score), 0)
    return darts ? Math.round((pts / darts) * 3) : 0
  }
  const avg1 = avgOf(p1Throws)
  const avg2 = avgOf(p2Throws)
  const activeName = activePlayer === 0 ? p1?.name : p2?.name

  const histCell = (t: LegThrow | undefined, side: 0 | 1) => {
    if (!t) return <div className="h-9" />
    const checkout = !t.bust && t.remaining === 0
    return (
      <div className={cn("h-9 flex items-center", side === 0 ? "justify-end pr-3" : "justify-start pl-3")}>
        <span className={cn("text-3xl font-bold score-display leading-none",
          t.bust ? "text-destructive/50 line-through" : checkout ? "text-green-400" : "text-foreground/85")}>
          {t.score}
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto space-y-3 pb-4">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 pt-2">
        <button onClick={() => router.push(`/local/${sessionId}`)} className="text-muted-foreground hover:text-foreground shrink-0"><ArrowLeft className="h-5 w-5" /></button>
        <p className="flex-1 text-center text-xs text-muted-foreground truncate">
          {session.format.toUpperCase()} · {legsToWin} leg хожно · Leg {currentLegIndex + 1}
          {limitRounds && <span className={cn("ml-1", visitRound >= limitRounds ? "text-destructive" : "")}>· R{visitRound}/{limitRounds}</span>}
        </p>
        {callerSupported && (
          <button onClick={toggleCaller} title={callerOn ? "Дуут зарлагч унтраах" : "Дуут зарлагч асаах"} className="text-muted-foreground hover:text-foreground shrink-0">
            {callerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        )}
        <Badge className="bg-primary/15 text-primary border-primary/30 pulse-live text-xs shrink-0">LIVE</Badge>
      </div>

      {/* ── TV scoreboard ── */}
      <div className="rounded-xl overflow-hidden border border-border/40">
        {/* Name panels */}
        <div className="grid grid-cols-2">
          {[0, 1].map((side) => {
            const name = side === 0 ? p1?.name : p2?.name
            const active = activePlayer === side
            const legs = side === 0 ? match.player1Legs : match.player2Legs
            return (
              <div key={side} className={cn("py-2.5 px-3 text-center min-w-0 transition-colors",
                active ? (side === 0 ? "bg-primary text-primary-foreground" : "bg-blue-600 text-white") : "bg-secondary/60 text-muted-foreground")}>
                <p className="text-base font-extrabold truncate leading-tight">{name}</p>
                <div className="flex gap-1 justify-center mt-1">
                  {Array.from({ length: legsToWin }).map((_, i) => (
                    <div key={i} className={cn("h-1.5 rounded-full transition-all", i < legs ? "bg-current w-3.5" : "bg-current/30 w-2.5")} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Remaining score row */}
        <div className="grid grid-cols-2 bg-card">
          {[0, 1].map((side) => {
            const active = activePlayer === side
            const rem = side === 0 ? rem1 : rem2
            const avg = side === 0 ? avg1 : avg2
            return (
              <div key={side} className={cn("flex items-center gap-2 px-3 py-2 border-border/40", side === 0 ? "border-r" : "", active ? "bg-foreground" : "")}>
                {side === 1 && <span className={cn("text-[11px] font-mono shrink-0", active ? "text-background/50" : "text-muted-foreground/50")}>{avg}</span>}
                <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
                  {active && <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-background" />}
                  <span className={cn("text-5xl font-black score-display leading-none", active ? "text-background" : "text-foreground/55")}>{rem}</span>
                </div>
                {side === 0 && <span className={cn("text-[11px] font-mono shrink-0", active ? "text-background/50" : "text-muted-foreground/50")}>{avg}</span>}
              </div>
            )
          })}
        </div>

        {/* Legs row */}
        <div className="flex items-center justify-center gap-3 bg-secondary/40 py-1 text-xs">
          <span className={cn("font-black tabular-nums", activePlayer === 0 ? "text-primary" : "text-muted-foreground")}>{match.player1Legs}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Legs</span>
          <span className={cn("font-black tabular-nums", activePlayer === 1 ? "text-blue-400" : "text-muted-foreground")}>{match.player2Legs}</span>
        </div>

        {/* History rows: left score | round# | right score */}
        <div ref={tableRef} className="py-2 max-h-40 overflow-y-auto overscroll-contain">
          {Array.from({ length: rowCount }).map((_, i) => {
            const isActiveRow = i === activeRound - 1 && match.status === "ongoing"
            const first = i === 0
            const last = i === rowCount - 1
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center">
                {histCell(p1Throws[i], 0)}
                <div className="relative flex items-center justify-center w-12">
                  {isActiveRow && (
                    <span className={cn("absolute text-yellow-400 text-xs", activePlayer === 0 ? "-left-0.5" : "-right-0.5")}>
                      {activePlayer === 0 ? "◀" : "▶"}
                    </span>
                  )}
                  <span className={cn("h-9 w-7 flex items-center justify-center text-sm font-bold bg-zinc-800 text-zinc-300",
                    first && "rounded-t-md", last && "rounded-b-md", isActiveRow && "text-white")}>
                    {i + 1}
                  </span>
                </div>
                {histCell(p2Throws[i], 1)}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Checkout hint / impossible warning ── */}
      {checkoutHint && !isBust && !input && (
        <p className="text-center text-[11px] font-mono text-[oklch(0.78_0.16_85)] font-bold">🎯 {checkoutHint}</p>
      )}
      {isOnImpossiblePosition && !input && (
        <p className="text-center text-[11px] text-orange-400">Энэ оноо checkout боломжгүй</p>
      )}

      {/* ── Input row ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground truncate">▶ {activeName}</span>
        <div className="flex items-center gap-2">
          {isBust && <Badge className="bg-destructive/15 text-destructive border-destructive/30">BUST</Badge>}
          {isCheckoutScore && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">CHECKOUT</Badge>}
          {!isBust && !isCheckoutScore && input && (
            <span className="text-xs font-mono text-muted-foreground">→ {afterScore}{inputHint ? ` · ${inputHint}` : ""}</span>
          )}
          <span className={cn("w-20 text-right text-3xl font-black score-display tabular-nums leading-none",
            isBust ? "text-destructive" : isCheckoutScore ? "text-green-400" : "")}>
            {input || "0"}
          </span>
        </div>
      </div>

      {/* ── Dart selector — only on checkout ── */}
      {isCheckoutScore && (
        <DartSelector value={dartsUsed} onChange={setDartsUsed} label="Хэдэн дартаар checkout хийв?" />
      )}

      {/* ── Quick scores ── */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {QUICK_SCORES.map(s => (
          <button key={s} onClick={() => setInput(String(s))}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40 transition-colors">{s}</button>
        ))}
      </div>

      {/* ── Keypad ── */}
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.flat().map((k, i) => (
          <button key={i} onClick={() => handleKeypad(k)} onMouseDown={(e) => e.preventDefault()}
            className={cn("h-12 rounded-xl text-lg font-bold transition-all active:scale-95",
              k === "DEL" ? "bg-secondary/80 text-destructive" :
              k === "*" ? "bg-secondary/80 text-muted-foreground" :
              "bg-secondary/50 hover:bg-secondary border border-border/30")}>
            {k === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : k === "*" ? "C" : k}
          </button>
        ))}
      </div>

      {/* ── Submit ── */}
      <Button className={cn("w-full", isCheckoutScore ? "bg-green-600 hover:bg-green-700 text-white" : isBust ? "bg-destructive text-white hover:bg-destructive/90" : "glow-primary")}
        disabled={!input} onClick={submitScore} size="lg">
        {isCheckoutScore ? <><Check className="h-4 w-4 mr-1.5" />Checkout!</> : isBust ? "Bust — ээлж алдах" : "Оруулах"}
      </Button>

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
