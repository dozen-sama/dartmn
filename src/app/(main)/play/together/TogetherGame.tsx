"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  ArrowLeft, Delete, Minus, Pencil, Plus, RotateCcw, Users, X, Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getCheckout, classifyTurn, isPossibleVisitScore } from "@/lib/local-game/checkouts"
import { useScoreboardKeyboard } from "@/hooks/useScoreboardKeyboard"
import { BullOff } from "@/components/game/BullOff"
import { VisitLimitPicker } from "@/components/game/VisitLimitPicker"
import { DartSelector } from "@/components/game/DartSelector"
import { AccountLinkPicker, type LinkedAccount } from "@/components/game/AccountLinkPicker"
import { toast } from "sonner"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

type GameMode = "1v1" | "2v2" | "3v3" | "free"
type GameFormat = "501" | "301" | "170"
type Phase = "setup" | "bulloff" | "game"

// Нэг ээлж (visit) — зөвхөн оноо + дарт. Багийн ээлж, bust/checkout, leg-ийг replay-ээр тооцно.
interface Visit {
  points: number
  darts: number
}

// Replay-ийн үр дүн — нэг ээлжийн харагдац (хүснэгтэд)
interface VisitView {
  team: number
  player: number
  points: number
  remaining: number  // ээлжийн дараах үлдсэн оноо
  bust: boolean
  checkout: boolean
  idx: number        // visits массив дахь индекс (засахад хэрэгтэй)
}

interface Roster { name: string; players: string[] }

const KEYPAD = [[7,8,9],[4,5,6],[1,2,3],["*",0,"DEL"]] as const

export function TogetherGame() {
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

  // Game state (event-sourced — visits-ээс бусдыг replay-ээр гаргана)
  const [roster, setRoster] = useState<Roster[]>([])
  const [starterTeam, setStarterTeam] = useState(0)
  const [visits, setVisits] = useState<Visit[]>([])
  const [input, setInput] = useState("")
  const [dartsUsed, setDartsUsed] = useState(3)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // Засах горимд эхний цохилт хуучин утгыг орлох эсэх
  const freshRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // 1v1 DartMN бүртгэл холболт (ELO/статистикт бүртгэх)
  const [link0, setLink0] = useState<LinkedAccount | null>(null)
  const [link1, setLink1] = useState<LinkedAccount | null>(null)
  const recordedRef = useRef(false)

  const legsToWin = Math.ceil(bestOf / 2)
  const startScore = parseInt(format) || 501

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
    setRoster(teams.map(t => ({
      name: t.name,
      players: t.players.map((p, i) => p.trim() || `Тоглогч ${i + 1}`),
    })))
    setStarterTeam(starterIdx >= 0 ? starterIdx : 0)
    setVisits([])
    setInput("")
    setEditingIndex(null)
    setDartsUsed(3)
    recordedRef.current = false
    setPhase("game")
  }

  // ── Replay: visits → бүх төлөв ──────────────────────────
  function derive() {
    const sc: [number, number] = [startScore, startScore]
    const lg: [number, number] = [0, 0]
    const cp: [number, number] = [0, 0]
    let active = starterTeam
    let legStarter = starterTeam
    let winner: number | null = null
    const legsView: VisitView[][] = []
    let curLeg: VisitView[] = []
    legsView.push(curLeg)

    const pcount = (t: number) => Math.max(1, roster[t]?.players.length ?? 1)

    for (let i = 0; i < visits.length; i++) {
      if (winner !== null) break
      const v = visits[i]
      const before = sc[active]
      // Энэ ээлжийн round (bull-finish house rule-д). curLeg-д хоёр баг ээлжлэн ордог.
      const roundForThis = Math.floor(curLeg.length / 2) + 1
      const atLimit = limitRoundsEnabled && roundForThis >= limitRounds
      const outcome = classifyTurn(before, v.points, {
        doubleOut,
        requireBullFinish: atLimit && bullFinishAtLimit,
      })
      const bust = outcome.type === "bust"
      const checkout = outcome.type === "checkout"
      const remaining = outcome.remaining  // score→after, bust→before, checkout→0
      curLeg.push({ team: active, player: cp[active], points: v.points, remaining, bust, checkout, idx: i })

      if (checkout) {
        lg[active]++
        if (lg[active] >= legsToWin) { winner = active; break }
        // Шинэ leg — оноо reset, тоглогч эргэлдэнэ, эхлэгч солигдоно
        sc[0] = startScore; sc[1] = startScore
        cp[0] = (cp[0] + 1) % pcount(0)
        cp[1] = (cp[1] + 1) % pcount(1)
        legStarter = active === 0 ? 1 : 0
        active = legStarter
        curLeg = []
        legsView.push(curLeg)
      } else {
        sc[active] = remaining
        cp[active] = (cp[active] + 1) % pcount(active)
        active = active === 0 ? 1 : 0
      }
    }

    const currentRound = Math.floor(curLeg.length / 2) + 1
    return { scores: sc, legs: lg, currentPlayer: cp, activeTeam: active, winner, legsView, currentRound }
  }

  const d = derive()

  // 1v1 + хоёулаа бүртгэлтэй бол тоглолт дуусахад ELO/статистик нэг удаа илгээх
  useEffect(() => {
    if (d.winner === null || recordedRef.current) return
    if (mode !== "1v1" || !link0 || !link1) return
    recordedRef.current = true
    const flat = d.legsView.flat()
    const teamThrows = (team: number) => flat.filter(v => v.team === team).map(v => ({
      score: v.points,
      darts: visits[v.idx]?.darts ?? 3,
      bust: v.bust,
      before: v.bust ? v.remaining : v.remaining + v.points,
    }))
    fetch("/api/play/together-record", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: [
        { profileId: link0.id, throws: teamThrows(0), isWinner: d.winner === 0 },
        { profileId: link1.id, throws: teamThrows(1), isWinner: d.winner === 1 },
      ] }),
    }).then(r => r.ok && toast.success("ELO ба статистик бүртгэгдлээ")).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.winner])

  // Засаж буй ээлжийн контекст (өмнөх үлдсэн оноо)
  const editingView = editingIndex !== null
    ? d.legsView.flat().find(v => v.idx === editingIndex) ?? null
    : null
  const ctxTeam = editingView ? editingView.team : d.activeTeam
  const ctxBefore = editingView
    ? (editingView.bust ? editingView.remaining : editingView.remaining + editingView.points)
    : d.scores[ctxTeam]

  // Засаж буй ээлжийн round (bull-finish дүрэм энэ ээлжид мөрдөгдөх эсэхэд)
  let editRound: number | null = null
  if (editingIndex !== null) {
    for (const leg of d.legsView) {
      const pos = leg.findIndex(v => v.idx === editingIndex)
      if (pos >= 0) { editRound = Math.floor(pos / 2) + 1; break }
    }
  }
  const ctxAtLimit = limitRoundsEnabled && (editingView
    ? editRound !== null && editRound >= limitRounds
    : d.currentRound >= limitRounds)

  const hasInput = input !== ""
  const inputNum = parseInt(input) || 0
  const afterScore = ctxBefore - inputNum
  // Engine-тэй ижил логик — preview ба replay хэзээ ч зөрөхгүй
  const preview = hasInput
    ? classifyTurn(ctxBefore, inputNum, { doubleOut, requireBullFinish: ctxAtLimit && bullFinishAtLimit })
    : null
  const isBust = preview?.type === "bust"
  const isCheckout = preview?.type === "checkout"
  const checkoutHint = ctxBefore <= 170 ? getCheckout(ctxBefore) : null

  // Bull finish сануулга (зөвхөн шинэ ээлж дээр харуулна)
  const isAtLimit = limitRoundsEnabled && d.currentRound >= limitRounds && editingIndex === null
  const bullRequired = isAtLimit && bullFinishAtLimit

  function keypad(k: number | string) {
    if (k === "DEL") { freshRef.current = false; setInput(p => p.slice(0, -1)); return }
    if (k === "*") { freshRef.current = false; setInput(""); return }
    // Засах горимд эхний цохилт хуучин утгыг орлоно
    if (freshRef.current) { freshRef.current = false; setInput(String(k)); return }
    setInput(p => { const next = p + k; return parseInt(next) > 180 ? p : next })
  }

  const kbInput = useCallback((dg: string) => {
    if (freshRef.current) { freshRef.current = false; setInput(dg); return }
    setInput(p => { const next = p + dg; return parseInt(next) > 180 ? p : next })
  }, [])
  const kbDelete = useCallback(() => { freshRef.current = false; setInput(p => p.slice(0, -1)) }, [])
  const kbClear = useCallback(() => { freshRef.current = false; setInput("") }, [])
  useScoreboardKeyboard({
    onInput: kbInput,
    onDelete: kbDelete,
    onClear: kbClear,
    onSubmit: submit,
    enabled: phase === "game" && d.winner === null,
  })

  function submit() {
    if (!hasInput || roster.length !== 2) return
    const score = inputNum

    // 3 дартаар гаргах боломжгүй оноо бол хорино (mis-entry). Bust/checkout-ийг
    // classifyTurn (derive + preview) шийднэ — энд давхар шалгахгүй.
    if (!isPossibleVisitScore(score)) {
      toast.error(`${score} — 3 дартаар гаргах боломжгүй оноо. Дахин шалгана уу.`)
      return
    }

    if (editingIndex !== null) {
      setVisits(prev => prev.map((v, i) => i === editingIndex ? { points: score, darts: dartsUsed } : v))
      setEditingIndex(null)
    } else {
      setVisits(prev => [...prev, { points: score, darts: dartsUsed }])
    }
    setInput("")
    setDartsUsed(3)
    freshRef.current = false
  }

  function startEdit(v: VisitView) {
    setEditingIndex(v.idx)
    setInput(String(v.points))
    setDartsUsed(visits[v.idx]?.darts ?? 3)
    freshRef.current = true  // эхний цохилт хуучин оноог орлоно
    // input-д focus + select → шинэ тоо бичихэд хуучин нь орлогдоно
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }
  function cancelEdit() {
    setEditingIndex(null)
    setInput("")
    setDartsUsed(3)
    freshRef.current = false
  }
  function undoLast() {
    setVisits(prev => prev.slice(0, -1))
    setEditingIndex(null)
    setInput("")
    freshRef.current = false
  }

  function resetGame() {
    setPhase("setup")
    setRoster([])
    setVisits([])
    setEditingIndex(null)
    setInput("")
    setLink0(null)
    setLink1(null)
    recordedRef.current = false
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
                {mode === "1v1" && (
                  <AccountLinkPicker
                    value={ti === 0 ? link0 : link1}
                    onChange={(a) => {
                      if (ti === 0) setLink0(a); else setLink1(a)
                      if (a) setPlayer(ti, 0, a.name)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {mode === "1v1" && (
          <p className="text-[11px] text-center text-muted-foreground">
            Хоёр тоглогчийг DartMN бүртгэлд холбовол ELO ба статистик автоматаар бүртгэгдэнэ.
          </p>
        )}

        <button onClick={startGame}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base glow-primary transition-all hover:bg-primary/90 flex items-center justify-center gap-2">
          <Zap className="h-5 w-5" />
          Тоглолт эхлүүлэх!
        </button>
      </div>
    )
  }

  // ── FINISHED ───────────────────────────────────────────
  if (phase === "game" && d.winner !== null && roster.length === 2) {
    const w = roster[d.winner]
    return (
      <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="text-6xl">🏆</div>
        <div>
          <p className="text-muted-foreground text-sm mb-1">Ялагч</p>
          <h1 className="text-3xl font-black text-[oklch(0.78_0.16_85)]">{w.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{w.players.join(", ")}</p>
        </div>
        <div className="flex items-center gap-6 text-lg font-bold">
          <span className={cn(d.winner === 0 ? "text-[oklch(0.78_0.16_85)]" : "text-muted-foreground/50")}>{d.legs[0]}</span>
          <span className="text-muted-foreground text-sm">—</span>
          <span className={cn(d.winner === 1 ? "text-[oklch(0.78_0.16_85)]" : "text-muted-foreground/50")}>{d.legs[1]}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={undoLast}
            className="px-5 py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Сүүлийнхийг буцаах
          </button>
          <button onClick={resetGame}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary">
            Шинэ тоглолт
          </button>
        </div>
      </div>
    )
  }

  // ── SCOREBOARD ─────────────────────────────────────────
  if (phase === "game" && roster.length === 2) {
    const curLegView = d.legsView[d.legsView.length - 1] ?? []
    const t0Visits = curLegView.filter(v => v.team === 0)
    const t1Visits = curLegView.filter(v => v.team === 1)
    // Идэвхтэй багийн дараагийн round (сум энд зааж байна)
    const activeRound = (d.activeTeam === 0 ? t0Visits.length : t1Visits.length) + 1
    const rowCount = Math.max(t0Visits.length, t1Visits.length, activeRound)

    // Багийн leg-ийн жинхэнэ 3 дартын дундаж (= нийт оноо / шидсэн дарт × 3).
    // Bust → 0 оноо, гэхдээ шидсэн дарт тоологдоно. Checkout → бодит дарт (1–3).
    const statAvg = (vs: VisitView[]) => {
      const darts = vs.reduce((a, v) => a + (visits[v.idx]?.darts ?? 3), 0)
      const pts = vs.reduce((a, v) => a + (v.bust ? 0 : v.points), 0)
      return darts ? Math.round((pts / darts) * 3) : 0
    }
    const avg0 = statAvg(t0Visits)
    const avg1 = statAvg(t1Visits)

    // Тоглогчийн нэр (1 хүнтэй бол хүний нэр том, олонтой бол багийн нэр)
    const bigName = (i: number) => roster[i].players.length === 1 ? roster[i].players[0] : roster[i].name
    const subName = (i: number) => roster[i].players.length === 1 ? null : roster[i].players[d.currentPlayer[i]]

    // Нэг талын оноо нүд (дарж засна)
    const scoreCell = (v: VisitView | undefined, side: 0 | 1) => {
      if (!v) return <div className="h-9" />
      const editing = editingIndex === v.idx
      return (
        <button onClick={() => startEdit(v)}
          className={cn("h-9 w-full flex items-center transition-colors rounded-md",
            side === 0 ? "justify-end pr-3" : "justify-start pl-3",
            editing ? "bg-primary/20 ring-1 ring-primary" : "active:bg-secondary/60")}>
          <span className={cn("text-3xl font-bold score-display leading-none",
            v.bust ? "text-destructive/50 line-through" : v.checkout ? "text-green-400" : "text-foreground/85")}>
            {v.points}
          </span>
        </button>
      )
    }

    return (
      <div className="max-w-sm mx-auto space-y-3">
        {/* Top bar */}
        <div className="flex items-center gap-2">
          <button onClick={resetGame} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="flex-1 text-center text-xs text-muted-foreground">
            {format} · BO{bestOf} · {legsToWin} leg хожно
            {limitRoundsEnabled && <span className={cn("ml-1", isAtLimit ? "text-destructive" : "")}>· R{d.currentRound}/{limitRounds}</span>}
          </p>
          <div className="flex items-center gap-1.5">
            {visits.length > 0 && editingIndex === null && (
              <button onClick={undoLast} title="Сүүлийнхийг буцаах" className="text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <Badge className="bg-primary/15 text-primary border-primary/30 pulse-live text-xs">LIVE</Badge>
          </div>
        </div>

        {/* ── TV scoreboard ── */}
        <div className="rounded-xl overflow-hidden border border-border/40">
          {/* Name panels */}
          <div className="grid grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className={cn("py-2.5 px-3 text-center min-w-0 transition-colors",
                d.activeTeam === i
                  ? (i === 0 ? "bg-primary text-primary-foreground" : "bg-blue-600 text-white")
                  : "bg-secondary/60 text-muted-foreground")}>
                <p className="text-base font-extrabold truncate leading-tight">{bigName(i)}</p>
                {subName(i) && <p className="text-[11px] opacity-80 truncate">{subName(i)}</p>}
              </div>
            ))}
          </div>

          {/* Remaining score row */}
          <div className="grid grid-cols-2 bg-card">
            {[0, 1].map((i) => {
              const active = d.activeTeam === i
              const avg = i === 0 ? avg0 : avg1
              return (
                <div key={i} className={cn("flex items-center gap-2 px-3 py-2 border-border/40",
                  i === 0 ? "border-r" : "",
                  active ? "bg-foreground" : "")}>
                  {i === 1 && (
                    <span className={cn("text-[11px] font-mono shrink-0", active ? "text-background/50" : "text-muted-foreground/50")}>{avg}</span>
                  )}
                  <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
                    {active && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", active ? "bg-background" : "bg-primary")} />}
                    <span className={cn("text-5xl font-black score-display leading-none",
                      active ? "text-background" : "text-foreground/55")}>{d.scores[i]}</span>
                  </div>
                  {i === 0 && (
                    <span className={cn("text-[11px] font-mono shrink-0", active ? "text-background/50" : "text-muted-foreground/50")}>{avg}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legs + checkout hint */}
          <div className="flex items-center justify-center gap-3 bg-secondary/40 py-1 text-xs">
            <span className={cn("font-black tabular-nums", d.activeTeam === 0 ? "text-primary" : "text-muted-foreground")}>{d.legs[0]}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Legs</span>
            <span className={cn("font-black tabular-nums", d.activeTeam === 1 ? "text-blue-400" : "text-muted-foreground")}>{d.legs[1]}</span>
          </div>

          {/* History rows: left score | round# | right score */}
          <div className="py-2">
            {Array.from({ length: rowCount }).map((_, i) => {
              const isActiveRow = i === activeRound - 1
              const first = i === 0
              const last = i === rowCount - 1
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center">
                  {scoreCell(t0Visits[i], 0)}
                  {/* center round column */}
                  <div className="relative flex items-center justify-center w-12">
                    {isActiveRow && (
                      <span className={cn("absolute text-yellow-400 text-xs",
                        d.activeTeam === 0 ? "-left-0.5" : "-right-0.5")}>
                        {d.activeTeam === 0 ? "◀" : "▶"}
                      </span>
                    )}
                    <span className={cn("h-9 w-7 flex items-center justify-center text-sm font-bold bg-zinc-800 text-zinc-300",
                      first && "rounded-t-md", last && "rounded-b-md",
                      isActiveRow && "text-white")}>
                      {i + 1}
                    </span>
                  </div>
                  {scoreCell(t1Visits[i], 1)}
                </div>
              )
            })}
          </div>
        </div>

        {/* Checkout hint */}
        {checkoutHint && editingIndex === null && !isBust && (
          <p className="text-center text-[11px] font-mono text-[oklch(0.78_0.16_85)] font-bold">🎯 {checkoutHint}</p>
        )}

        {/* Bull finish warning */}
        {bullRequired && editingIndex === null && (
          <div className="flex items-center justify-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-1.5">
            <span>🎯</span>
            <p className="text-xs font-bold text-destructive">Bull Finish — зөвхөн 50/25!</p>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center justify-between px-1">
          {editingIndex !== null ? (
            <button onClick={cancelEdit} className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Pencil className="h-3.5 w-3.5" /> Засаж байна <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground truncate">
              ▶ {roster[d.activeTeam].players[d.currentPlayer[d.activeTeam]]}
            </span>
          )}
          <div className="flex items-center gap-2">
            {isBust && <Badge className="bg-destructive/15 text-destructive border-destructive/30">BUST</Badge>}
            {isCheckout && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">CHECKOUT</Badge>}
            {!isBust && !isCheckout && hasInput && <span className="text-xs font-mono text-muted-foreground">→ {afterScore}</span>}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "")
                freshRef.current = false
                if (v === "") { setInput(""); return }
                if (parseInt(v) > 180) return
                setInput(v)
              }}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit() } }}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              aria-label="Оноо"
              className={cn("w-20 bg-transparent text-right text-3xl font-black score-display tabular-nums outline-none placeholder:text-muted-foreground/40",
                isBust ? "text-destructive" : isCheckout ? "text-green-400" : "")}
            />
          </div>
        </div>

        {/* Dart selector — зөвхөн checkout үед */}
        {isCheckout && (
          <DartSelector value={dartsUsed} onChange={setDartsUsed} label="Хэдэн дартаар checkout хийв?" />
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {KEYPAD.flat().map((k, i) => (
            <button key={i} onClick={() => keypad(k)} onMouseDown={(e) => e.preventDefault()}
              className={cn("h-12 rounded-xl text-lg font-bold transition-all active:scale-95",
                k === "DEL" ? "bg-secondary/80 text-destructive" :
                k === "*" ? "bg-secondary/80 text-muted-foreground" :
                "bg-secondary/50 hover:bg-secondary border border-border/30")}>
              {k === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : k === "*" ? "C" : k}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button onClick={submit} disabled={!hasInput}
          className={cn("w-full py-3 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            isCheckout ? "bg-green-600 hover:bg-green-700 text-white" :
            isBust ? "bg-destructive text-white" :
            "bg-primary text-primary-foreground glow-primary")}>
          {editingIndex !== null ? "Засах ✓" : isCheckout ? "✓ Checkout!" : isBust ? "Bust — ээлж алдах" : "Оруулах"}
        </button>
      </div>
    )
  }

  return null
}
