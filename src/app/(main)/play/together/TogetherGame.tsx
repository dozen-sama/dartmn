"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Check, Delete, Minus, Plus, RotateCcw, Users, Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getCheckout } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { BullOff } from "@/components/game/BullOff"
import { VisitLimitPicker } from "@/components/game/VisitLimitPicker"
import { toast } from "sonner"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

type GameMode = "1v1" | "2v2" | "3v3" | "free"
type GameFormat = "501" | "301" | "170"
type Phase = "setup" | "bulloff" | "game" | "finished"

interface Team {
  name: string
  players: string[]
  score: number        // remaining
  legs: number
  currentPlayer: number // index in players array
}

interface Leg {
  winner: 0 | 1
}

const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180]
const KEYPAD = [[7,8,9],[4,5,6],[1,2,3],["*",0,"DEL"]] as const

export function TogetherGame() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("setup")

  // Setup state
  const [mode, setMode] = useState<GameMode>("1v1")
  const [format, setFormat] = useState<GameFormat>("501")
  const [bestOf, setBestOf] = useState(3)
  const [doubleOut, setDoubleOut] = useState(true)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)
  const [bullFinishAtLimit, setBullFinishAtLimit] = useState(false)
  const [teams, setTeams] = useState([
    { name: "Баг 1", players: [""] },
    { name: "Баг 2", players: [""] },
  ])

  // Game state
  const [gameTeams, setGameTeams] = useState<Team[]>([])
  const [activeTeam, setActiveTeam] = useState(0)
  const [input, setInput] = useState("")
  const [legs, setLegs] = useState<Leg[]>([])
  const [dartsUsed, setDartsUsed] = useState(1)  // 1st dart in visit
  const [visitRound, setVisitRound] = useState(1)
  const [winner, setWinner] = useState<number | null>(null)

  const legsToWin = Math.ceil(bestOf / 2)
  const startScore = parseInt(format)

  // ── Setup helpers ──────────────────────────────────────
  function setTeamName(i: number, name: string) {
    setTeams(prev => prev.map((t, idx) => idx === i ? { ...t, name } : t))
  }
  function setPlayer(teamIdx: number, playerIdx: number, name: string) {
    setTeams(prev => prev.map((t, i) => i !== teamIdx ? t : {
      ...t,
      players: t.players.map((p, j) => j === playerIdx ? name : p),
    }))
  }
  function addPlayer(teamIdx: number) {
    setTeams(prev => prev.map((t, i) => i !== teamIdx ? t : { ...t, players: [...t.players, ""] }))
  }
  function removePlayer(teamIdx: number, playerIdx: number) {
    setTeams(prev => prev.map((t, i) => i !== teamIdx ? t : {
      ...t, players: t.players.filter((_, j) => j !== playerIdx),
    }))
  }

  function applyMode(m: GameMode) {
    setMode(m)
    const counts: Record<GameMode, number[]> = { "1v1": [1,1], "2v2": [2,2], "3v3": [3,3], "free": [1,1] }
    const c = counts[m]
    setTeams([
      { name: "Баг 1", players: Array(c[0]).fill("") },
      { name: "Баг 2", players: Array(c[1]).fill("") },
    ])
  }

  function startGame() {
    setPhase("bulloff")  // Bull-off эхлэнэ
  }

  function onBullOffSelect(starterTeamId: string) {
    const starterIdx = teams.findIndex(t => t.name === starterTeamId)
    const gt: Team[] = teams.map(t => ({
      name: t.name,
      players: t.players.map((p, i) => p.trim() || `Тоглогч ${i + 1}`),
      score: startScore,
      legs: 0,
      currentPlayer: 0,
    }))
    setGameTeams(gt)
    setActiveTeam(starterIdx >= 0 ? starterIdx : 0)
    setInput("")
    setLegs([])
    setWinner(null)
    setPhase("game")
  }

  // ── Scoreboard logic ───────────────────────────────────
  const active = gameTeams[activeTeam]
  const opponent = gameTeams[activeTeam === 0 ? 1 : 0]

  const inputNum = parseInt(input) || 0
  const afterScore = active ? active.score - inputNum : 0
  const isBust = afterScore < 0 || afterScore === 1
  const isCheckout = afterScore === 0
  const checkoutHint = active ? getCheckout(active.score) : null
  const inputHint = input && !isBust && afterScore > 0 ? getCheckout(afterScore) : null

  function keypad(k: number | string) {
    if (k === "DEL") { setInput(p => p.slice(0, -1)); return }
    if (k === "*") { setInput(""); return }
    const next = input + k
    if (parseInt(next) > 180) return
    setInput(next)
  }

  // Keyboard shortcuts — computer дээр оноо оруулах
  const kbInput = useCallback((d: string) => {
    setInput(p => { const next = p + d; return parseInt(next) > 180 ? p : next })
  }, [])
  const kbDelete = useCallback(() => setInput(p => p.slice(0, -1)), [])
  const kbClear = useCallback(() => setInput(""), [])
  useScoreboardKeyboard({
    onInput: kbInput,
    onDelete: kbDelete,
    onClear: kbClear,
    onSubmit: submit,
    enabled: phase === "game",
  })

  // Bull finish check
  const isAtLimit = limitRoundsEnabled && visitRound >= limitRounds
  const bullRequired = isAtLimit && bullFinishAtLimit
  const isBullInput = parseInt(input) === 50 || parseInt(input) === 25

  function submit() {
    if (!active) return
    const score = parseInt(input) || 0
    if (isBust) { toast.error("Bust! Дахин шидэнэ"); setInput(""); return }

    // Bull finish check
    if (bullRequired && isCheckout && !isBullInput) {
      toast.error("⚠️ Bull-off (хязгаарт хүрмэгц)! Зөвхөн 50 (Bull) эсвэл 25 (Half)")
      setInput("")
      return
    }

    const newScore = active.score - score

    if (isCheckout) {
      const newLegs = active.legs + 1
      if (newLegs >= legsToWin) {
        setGameTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, score: 0, legs: newLegs } : t))
        setWinner(activeTeam)
        setPhase("finished")
        return
      }
      toast.success(`${active.name} leg хожлоо!`)
      setGameTeams(prev => prev.map(t => ({
        ...t,
        score: startScore,
        legs: t === active ? newLegs : t.legs,
        currentPlayer: (t.currentPlayer + 1) % t.players.length,
      })))
      setLegs(prev => [...prev, { winner: activeTeam as 0 | 1 }])
      setActiveTeam(prev => prev === 0 ? 1 : 0)
      setVisitRound(1)  // leg шинэ → round reset
    } else {
      setGameTeams(prev => prev.map((t, i) => {
        if (i !== activeTeam) return t
        return {
          ...t,
          score: newScore,
          currentPlayer: (t.currentPlayer + 1) % t.players.length,
        }
      }))
      // Both teams visited → round++
      if (activeTeam === 1) setVisitRound(r => r + 1)
      setActiveTeam(prev => prev === 0 ? 1 : 0)
    }
    setInput("")
    setDartsUsed(1)  // Next visit starts from dart 1
  }

  function resetGame() {
    setPhase("setup")
    setGameTeams([])
    setWinner(null)
  }

  // ── BULL-OFF SCREEN ───────────────────────────────────
  if (phase === "bulloff") {
    const bullPlayers = teams.map(t => ({
      id: t.name,
      name: t.players[0]?.trim() || t.name,
      teamName: teams.length > 1 && t.players.length > 1 ? t.name : undefined,
    }))
    return (
      <div className="max-w-sm mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase("setup")}
            className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Bull-off</h1>
        </div>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5">
            <BullOff
              players={bullPlayers}
              onSelect={onBullOffSelect}
              purpose="start"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── SETUP SCREEN ───────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/play" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Хамтдаа тоглох
            </h1>
            <p className="text-muted-foreground text-sm">Нэг төхөөрөмж дээр ээлжлэн шидэнэ</p>
          </div>
        </div>

        {/* Mode */}
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Тоглолтын хэлбэр</p>
            <div className="grid grid-cols-4 gap-2">
              {(["1v1", "2v2", "3v3", "free"] as GameMode[]).map(m => (
                <button key={m} onClick={() => applyMode(m)}
                  className={cn("py-2.5 rounded-lg border-2 text-sm font-bold transition-all",
                    mode === m ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                  {m === "free" ? "Чөлөөт" : m}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "free" ? "Тоглогчдыг гараар тохируулна" : `${mode} — Баг тус бүрт ${mode.split("v")[0]} тоглогч`}
            </p>
          </CardContent>
        </Card>

        {/* Game format */}
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-semibold">Тоглолтын тохиргоо</p>
            <div className="grid grid-cols-3 gap-2">
              {(["501", "301", "170"] as GameFormat[]).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={cn("py-2 rounded-lg border-2 text-sm font-bold transition-all",
                    format === f ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Best of</p>
                <div className="flex gap-1.5">
                  {[1, 3, 5, 7].map(n => (
                    <button key={n} onClick={() => setBestOf(n)}
                      className={cn("h-8 px-2.5 rounded-md text-xs font-bold border-2 transition-all",
                        bestOf === n ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      BO{n}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={doubleOut} onChange={e => setDoubleOut(e.target.checked)} className="accent-primary" />
                <span className="text-sm">Double out</span>
              </label>
            </div>

            {/* Visit limit + Bull-off */}
            <div className="border-t border-border/40 pt-3">
              <VisitLimitPicker
                enabled={limitRoundsEnabled}
                onToggle={v => { setLimitRoundsEnabled(v); if (!v) setBullFinishAtLimit(false) }}
                value={limitRounds}
                onChange={setLimitRounds}
                bullOff={bullFinishAtLimit}
                onBullOffToggle={setBullFinishAtLimit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Teams */}
        <div className="grid grid-cols-2 gap-3">
          {teams.map((team, ti) => (
            <Card key={ti} className={cn("border-2",
              ti === 0 ? "border-primary/30 bg-primary/5" : "border-blue-500/30 bg-blue-500/5")}>
              <CardContent className="p-4 space-y-3">
                <input value={team.name} onChange={e => setTeamName(ti, e.target.value)}
                  className="w-full bg-transparent text-sm font-bold border-b border-border/40 pb-1 focus:outline-none focus:border-primary" />
                <div className="space-y-1.5">
                  {team.players.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-1.5">
                      <span className={cn("text-[10px] font-bold w-4 text-center", ti === 0 ? "text-primary" : "text-blue-400")}>{pi + 1}</span>
                      <input value={p} onChange={e => setPlayer(ti, pi, e.target.value)}
                        placeholder={`Тоглогч ${pi + 1}`}
                        className="flex-1 bg-secondary/50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary border border-border/40" />
                      {team.players.length > 1 && (
                        <button onClick={() => removePlayer(ti, pi)} className="text-muted-foreground hover:text-destructive">
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {(mode === "free" || team.players.length < parseInt(mode.split("v")[0] || "4")) && (
                    <button onClick={() => addPlayer(ti)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors mt-1">
                      <Plus className="h-3 w-3" />Нэмэх
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <button onClick={startGame}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base glow-primary transition-all hover:bg-primary/90 flex items-center justify-center gap-2">
          <Zap className="h-5 w-5" />
          Тоглолт эхлүүлэх!
        </button>
      </div>
    )
  }

  // ── FINISHED ───────────────────────────────────────────
  if (phase === "finished" && winner !== null) {
    const w = gameTeams[winner]
    return (
      <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="text-6xl">🏆</div>
        <div>
          <p className="text-muted-foreground text-sm mb-1">Ялагч</p>
          <h1 className="text-3xl font-black text-[oklch(0.78_0.16_85)]">{w.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {w.players.join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-6 text-lg font-bold">
          <span className={cn(winner === 0 ? "text-[oklch(0.78_0.16_85)]" : "text-muted-foreground/50")}>
            {gameTeams[0]?.legs}
          </span>
          <span className="text-muted-foreground text-sm">—</span>
          <span className={cn(winner === 1 ? "text-[oklch(0.78_0.16_85)]" : "text-muted-foreground/50")}>
            {gameTeams[1]?.legs}
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={startGame}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary">
            <RotateCcw className="h-4 w-4" />
            Дахин тоглох
          </button>
          <button onClick={resetGame}
            className="px-5 py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-secondary transition-colors">
            Тохиргоо
          </button>
        </div>
      </div>
    )
  }

  // ── SCOREBOARD ─────────────────────────────────────────
  if (phase === "game" && gameTeams.length === 2) {
    const t0 = gameTeams[0]
    const t1 = gameTeams[1]

    function TeamScore({ team, idx }: { team: Team; idx: number }) {
      const isActive = idx === activeTeam
      const currentPlayerName = team.players[team.currentPlayer]
      const tier = isActive ? "border-primary shadow-lg shadow-primary/20" : "border-border/30 opacity-70"

      return (
        <div className={cn("flex flex-col rounded-xl border-2 p-3 transition-all", tier, isActive ? "bg-primary/5" : "bg-card/50")}>
          {/* Team name + leg dots */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold truncate">{team.name}</p>
            <div className="flex gap-1">
              {Array.from({ length: legsToWin }).map((_, i) => (
                <div key={i} className={cn("h-2 w-2 rounded-full", i < team.legs ? "bg-primary" : "bg-border/50")} />
              ))}
            </div>
          </div>
          {/* Remaining score */}
          <p className={cn("text-4xl font-black score-display text-center my-1",
            isActive ? "text-primary" : "text-foreground/60")}>{team.score}</p>
          {/* Current player */}
          <p className="text-center text-[11px] text-muted-foreground truncate">
            {isActive ? <span className="text-primary font-semibold">▶ {currentPlayerName}</span> : currentPlayerName}
          </p>
          {/* Checkout hint */}
          {isActive && checkoutHint && (
            <div className="mt-1.5 bg-[oklch(0.78_0.16_85)]/15 rounded px-2 py-1 text-center">
              <p className="text-[10px] font-mono text-[oklch(0.78_0.16_85)] font-bold">{checkoutHint}</p>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="max-w-sm mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button onClick={resetGame} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground">{format} · BO{bestOf}</p>
            {limitRoundsEnabled && (
              <p className={cn("text-[10px] font-semibold",
                isAtLimit ? "text-destructive" : "text-muted-foreground/60")}>
                Round {visitRound}/{limitRounds}{isAtLimit && bullFinishAtLimit ? " 🎯" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="hidden sm:inline text-[9px] border border-border/50 rounded px-1 py-0.5 bg-secondary/50 text-muted-foreground">0-9</kbd>
            <kbd className="hidden sm:inline text-[9px] border border-border/50 rounded px-1 py-0.5 bg-secondary/50 text-muted-foreground">↵</kbd>
            <Badge className="bg-primary/15 text-primary border-primary/30 pulse-live text-xs">LIVE</Badge>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-2">
          <TeamScore team={t0} idx={0} />
          <TeamScore team={t1} idx={1} />
        </div>

        {/* Active player + dart counter */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-primary">
            {gameTeams[activeTeam]?.name} — {gameTeams[activeTeam]?.players[gameTeams[activeTeam]?.currentPlayer]}
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
          </div>
        </div>

        {/* Bull finish warning */}
        {bullRequired && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            <span className="text-lg">🎯</span>
            <p className="text-xs font-bold text-destructive">Bull Finish — зөвхөн 50 эсвэл 25!</p>
          </div>
        )}

        {/* Input display */}
        <Card className={cn("border-2",
          isBust ? "border-destructive bg-destructive/5" :
          isCheckout ? "border-green-500 bg-green-500/5" :
          "border-border/50")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className={cn("text-4xl font-black score-display",
                isBust ? "text-destructive" : isCheckout ? "text-green-400" : "")}>
                {input || "0"}
              </p>
              <div className="text-right">
                {isBust && <Badge className="bg-destructive/15 text-destructive border-destructive/30">BUST!</Badge>}
                {isCheckout && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">CHECKOUT!</Badge>}
                {!isBust && !isCheckout && input && afterScore > 0 && (
                  <div>
                    <p className="text-sm font-bold score-display">{afterScore}</p>
                    {inputHint && <p className="text-[10px] font-mono text-[oklch(0.78_0.16_85)]">{inputHint}</p>}
                  </div>
                )}
              </div>
            </div>
            {/* Darts selector for checkout */}
            {isCheckout && (
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-muted-foreground">Дарт:</p>
                {[1,2,3].map(n => (
                  <button key={n} onClick={() => setDartsUsed(n)}
                    className={cn("h-7 w-7 rounded-md text-xs font-bold border-2 transition-all",
                      dartsUsed === n ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground")}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            <button onClick={submit} disabled={!input || isBust}
              className={cn("w-full py-2.5 rounded-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                isCheckout ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary text-primary-foreground glow-primary")}>
              {isCheckout ? "✓ Checkout!" : "Оруулах"}
            </button>
          </CardContent>
        </Card>

        {/* Quick scores */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_SCORES.map(s => (
            <button key={s} onClick={() => setInput(String(s))}
              className="px-2 py-1 text-xs font-mono font-semibold rounded bg-secondary/70 hover:bg-secondary border border-border/40 transition-colors">
              {s}
            </button>
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {KEYPAD.flat().map((k, i) => (
            <button key={i} onClick={() => keypad(k)}
              className={cn("h-14 rounded-xl text-lg font-bold transition-all active:scale-95",
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

  return null
}
