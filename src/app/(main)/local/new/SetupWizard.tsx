"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp,
  Download, Globe, Lock, Minus, Plus, Target, Trophy, Upload, Users, Zap,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { BracketType, GameFormat } from "@/lib/local-game/types"
import Link from "next/link"

type Step = "name" | "players" | "format" | "bracket" | "options" | "review"
const STEPS: Step[] = ["name", "players", "format", "bracket", "options", "review"]
const STEP_LABELS = ["Нэр", "Тоглогчид", "Формат", "Bracket", "Тохиргоо", "Review"]

const FORMATS: { value: GameFormat; label: string; score: number; desc: string }[] = [
  { value: "501", label: "501", score: 501, desc: "Классик. 501-с 0 болгоно" },
  { value: "301", label: "301", score: 301, desc: "Хурдан. 301-с эхэлнэ" },
  { value: "170", label: "170", score: 170, desc: "Max checkout" },
  { value: "121", label: "121", score: 121, desc: "Doubles in" },
  { value: "cricket", label: "Cricket", score: 0, desc: "15-20 болон Bull" },
  { value: "cutthroat", label: "Cutthroat", score: 0, desc: "Гурван тоглогч" },
]

const BRACKETS: { value: BracketType; label: string; badge?: string; desc: string; min: number }[] = [
  { value: "single_elimination", label: "Single Elimination 1", badge: "SE1", desc: "Нэг алдлаар унана", min: 2 },
  { value: "double_elimination", label: "Double Elimination", badge: "DE", desc: "Хоёр алдлаар унана", min: 4 },
  { value: "round_robin", label: "Round Robin", badge: "RR", desc: "Бүгд бүгдтэйгээ", min: 3 },
  { value: "groups_knockout", label: "Groups + Knockout", badge: "GK", desc: "Бүлгийн шат → Knockout", min: 4 },
  { value: "swiss", label: "Swiss (Matches)", badge: "SW", desc: "Ижил оноотой тулалд", min: 4 },
]

function Stepper({ value, onChange, min = 1, max = 99, label }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary">
          <Minus className="h-3 w-3" />
        </button>
        <div className="h-8 w-12 flex items-center justify-center border-y border-border/60 bg-secondary/50 text-sm font-bold">{value}</div>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="h-8 w-8 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary">
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function CheckRow({ label, checked, onChange, sub }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; sub?: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-primary" />
      <div>
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </label>
  )
}

// Smart group calculator
function calcGroups(playerCount: number, groupsCount: number): { perGroup: number; remainder: number } {
  const perGroup = Math.floor(playerCount / groupsCount)
  const remainder = playerCount % groupsCount
  return { perGroup, remainder }
}

export function SetupWizard() {
  const router = useRouter()
  const createSession = useLocalGame((s) => s.createSession)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("name")
  const [name, setName] = useState("")
  const [players, setPlayers] = useState([{ name: "" }, { name: "" }])
  const [newName, setNewName] = useState("")
  const [batchText, setBatchText] = useState("")
  const [showBatch, setShowBatch] = useState(false)

  // Format
  const [format, setFormat] = useState<GameFormat>("501")
  const [startScore, setStartScore] = useState(501)
  const [firstTo, setFirstTo] = useState(2)
  const [setsEnabled, setSetsEnabled] = useState(false)
  const [legsPerSet, setLegsPerSet] = useState(3)
  const [doubleOut, setDoubleOut] = useState(true)
  const [doubleIn, setDoubleIn] = useState(false)
  const [loserFirst, setLoserFirst] = useState(false)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)

  // Bracket
  const [bracketType, setBracketType] = useState<BracketType>("single_elimination")
  const [groupsCount, setGroupsCount] = useState(2)
  const [groupAdvance, setGroupAdvance] = useState(1)
  const [pointWon, setPointWon] = useState(2)
  const [pointDraw, setPointDraw] = useState(1)
  const [pointLost, setPointLost] = useState(0)
  const [winPointsAreLegs, setWinPointsAreLegs] = useState(false)

  // Options
  const [isPrivate, setIsPrivate] = useState(false)
  const [showAverage, setShowAverage] = useState(true)
  const [autoComplete, setAutoComplete] = useState(true)
  const [confirmOpponent, setConfirmOpponent] = useState(false)
  const [loserFirstOption, setLoserFirstOption] = useState(false)
  const [allowParticipantScore, setAllowParticipantScore] = useState(false)
  const [showIndex, setShowIndex] = useState(true)
  const [markWinsPlus, setMarkWinsPlus] = useState(false)
  const [enableChat, setEnableChat] = useState(false)

  const stepIndex = STEPS.indexOf(step)
  const validPlayers = players.filter((p) => p.name.trim())
  const pCount = validPlayers.length

  // Smart group suggestions
  const groupOptions = [2, 3, 4, 6, 8].filter((g) => pCount >= g * 2).map((g) => {
    const { perGroup, remainder } = calcGroups(pCount, g)
    return { groups: g, perGroup, remainder }
  })
  const currentGroupInfo = calcGroups(pCount, groupsCount)

  function addPlayer(nm?: string) {
    const n = (nm ?? newName).trim() || `Тоглогч ${players.length + 1}`
    setPlayers((prev) => [...prev, { name: n }])
    setNewName("")
  }
  function removePlayer(i: number) { setPlayers((prev) => prev.filter((_, idx) => idx !== i)) }
  function movePlayer(i: number, d: -1 | 1) {
    setPlayers((prev) => {
      const next = [...prev]; const j = i + d
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]; return next
    })
  }
  function updatePlayer(i: number, val: string) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { name: val } : p))
  }
  function batchAdd() {
    const names = batchText.split("\n").map((s) => s.trim()).filter(Boolean)
    setPlayers((prev) => [...prev, ...names.map((n) => ({ name: n }))])
    setBatchText("")
    setShowBatch(false)
  }
  function handleFormatChange(f: GameFormat) {
    setFormat(f)
    const opt = FORMATS.find((x) => x.value === f)
    if (opt && opt.score > 0) setStartScore(opt.score)
  }
  function exportCSV() {
    const csv = validPlayers.map((p, i) => `${i + 1},${p.name}`).join("\n")
    const a = document.createElement("a"); a.href = `data:text/csv;charset=utf-8,#,Name\n${csv}`
    a.download = `${name || "players"}.csv`; a.click()
  }
  function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split("\n").slice(1)
      const names = lines.map((l) => l.split(",")[1]?.trim()).filter(Boolean)
      setPlayers((prev) => [...prev, ...names.map((n) => ({ name: n }))])
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  function canNext() {
    if (step === "name") return name.trim().length >= 2
    if (step === "players") return pCount >= 2
    if (step === "bracket") return pCount >= (BRACKETS.find((b) => b.value === bracketType)?.min ?? 2)
    return true
  }
  function next() { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) setStep(STEPS[i + 1]) }
  function back() { const i = STEPS.indexOf(step); if (i > 0) setStep(STEPS[i - 1]) }

  function handleStart() {
    const id = createSession({
      name: name.trim(), format, startScore,
      firstTo, setsEnabled, legsPerSet,
      doubleOut, doubleIn, loserFirst: loserFirst || loserFirstOption,
      limitRounds: limitRoundsEnabled ? limitRounds : null,
      showAverage, autoComplete, allowParticipantScore, showIndex,
      pointWon, pointDraw, pointLost, winPointsAreLegs,
      bracketType, groupsCount, groupAdvance,
      players: validPlayers,
    })
    router.push(`/local/${id}`)
  }

  const matchFmt = setsEnabled
    ? `First to ${firstTo} sets · ${legsPerSet} legs/set`
    : `First to ${firstTo} legs`

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/local" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary shrink-0" />
            Detail Setting
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {name || "Шинэ тоглолт"} · {STEP_LABELS[stepIndex]} ({stepIndex + 1}/{STEPS.length})
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <button key={s} type="button" onClick={() => i < stepIndex && setStep(s)}
            className={cn("flex-1 h-1.5 rounded-full transition-all",
              i < stepIndex ? "bg-primary cursor-pointer" : i === stepIndex ? "bg-primary/50" : "bg-secondary")} />
        ))}
      </div>

      {/* ── NAME ── */}
      {step === "name" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <div className="text-center py-2">
              <Trophy className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="font-bold text-lg">Competition Title</h2>
              <p className="text-xs text-muted-foreground mt-1">Тэмцээн, лиг, эсвэл найзуудтайгаа тоглолт</p>
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="жнь. Пабын аварга, Долоо хоногийн лиг..."
              className="bg-secondary/50 border-border/60 text-center text-base"
              autoFocus onKeyDown={(e) => e.key === "Enter" && canNext() && next()} />
          </CardContent>
        </Card>
      )}

      {/* ── PLAYERS ── */}
      {step === "players" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-bold">Entry List</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary">{pCount} тоглогч</Badge>
              </div>
            </div>

            {/* Player list */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {showIndex && <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>}
                  <div className="flex flex-col">
                    <button onClick={() => movePlayer(i, -1)} disabled={i === 0} className="disabled:opacity-20 hover:text-foreground text-muted-foreground p-0.5">
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                    <button onClick={() => movePlayer(i, 1)} disabled={i === players.length - 1} className="disabled:opacity-20 hover:text-foreground text-muted-foreground p-0.5">
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <Input value={p.name} onChange={(e) => updatePlayer(i, e.target.value)}
                    placeholder={`Тоглогч ${i + 1}`}
                    className="flex-1 h-8 text-sm bg-secondary/50 border-border/60" />
                  <button onClick={() => removePlayer(i)} disabled={players.length <= 2}
                    className="disabled:opacity-20 text-muted-foreground hover:text-destructive p-1">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add player */}
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Тоглогч нэмэх..."
                className="flex-1 h-8 text-sm bg-secondary/50 border-border/60"
                onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
              <Button size="sm" variant="outline" onClick={() => addPlayer()}
                className="border-primary/30 text-primary hover:bg-primary/10 h-8 shrink-0">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Player
              </Button>
            </div>

            {/* Batch / CSV */}
            <div className="flex gap-2 pt-1 border-t border-border/40">
              <button type="button" onClick={() => setShowBatch(!showBatch)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Users className="h-3.5 w-3.5" />
                Batch Add
              </button>
              <span className="text-border">|</span>
              <button type="button" onClick={exportCSV}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <span className="text-border">|</span>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
            </div>

            {showBatch && (
              <div className="space-y-2">
                <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} rows={4}
                  placeholder={"Нэг мөрт нэг тоглогч:\nБат\nДорж\nЭнх"}
                  className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                <Button size="sm" variant="outline" className="w-full border-primary/30 text-primary" onClick={batchAdd}>
                  {batchText.split("\n").filter((s) => s.trim()).length} тоглогч нэмэх
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── FORMAT ── */}
      {step === "format" && (
        <div className="space-y-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-4">
              <h2 className="font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Game Setting</h2>

              {/* Game types */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Available game types</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => (
                    <button key={f.value} type="button" onClick={() => handleFormatChange(f.value)}
                      className={cn("flex flex-col items-center py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                        format === f.value ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      <span className="font-bold">{f.label}</span>
                      <span className="text-[10px] opacity-70 mt-0.5 text-center leading-tight">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* First to / Sets / Legs */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Match Format</Label>
                <div className="flex items-end gap-3 flex-wrap">
                  <Stepper value={firstTo} onChange={setFirstTo} min={1} max={11} label="First to" />
                  <div className="flex items-center gap-2 mb-1">
                    <button type="button" onClick={() => setSetsEnabled(!setsEnabled)}
                      className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all",
                        setsEnabled ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      Sets
                    </button>
                    <span className="text-muted-foreground">/</span>
                    {setsEnabled
                      ? <Stepper value={legsPerSet} onChange={setLegsPerSet} min={1} max={11} label="Legs/set" />
                      : <span className="text-sm text-muted-foreground font-medium mb-5">Legs</span>
                    }
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs font-medium">
                  <Check className="h-3 w-3" /> {matchFmt}
                </div>
              </div>

              {/* Start Score */}
              {(format === "501" || format === "301") && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Start Score</Label>
                  <div className="flex gap-2">
                    {[501, 301, 170, 121].map((s) => (
                      <button key={s} type="button" onClick={() => setStartScore(s)}
                        className={cn("flex-1 py-1.5 text-xs font-bold rounded-md border-2 transition-all",
                          startScore === s ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(format === "501" || format === "301" || format === "170" || format === "121") && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-bold text-sm">Дүрэм</h2>
                <div className="grid grid-cols-2 gap-3">
                  <CheckRow label="Double out" checked={doubleOut} onChange={setDoubleOut} />
                  <CheckRow label="Double in" checked={doubleIn} onChange={setDoubleIn} />
                  <CheckRow label="Loser First" checked={loserFirst} onChange={setLoserFirst}
                    sub="Хожигдсон тоглогч эхэлнэ" />
                  <div className="flex items-center gap-2">
                    <CheckRow label="Limit Rounds" checked={limitRoundsEnabled} onChange={setLimitRoundsEnabled} />
                    {limitRoundsEnabled && (
                      <Input type="number" value={limitRounds} onChange={(e) => setLimitRounds(parseInt(e.target.value) || 15)}
                        min={1} max={50} className="w-16 h-7 text-xs bg-secondary/50 border-border/60" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── BRACKET ── */}
      {step === "bracket" && (
        <div className="space-y-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-2">
              <h2 className="font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Bracket Type</h2>
              <div className="grid grid-cols-1 gap-2">
                {BRACKETS.map((bt) => {
                  const disabled = pCount < bt.min
                  return (
                    <label key={bt.value} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      bracketType === bt.value && !disabled ? "border-primary bg-primary/10" : "border-border/40 bg-secondary/20",
                      disabled ? "opacity-40 cursor-not-allowed" : "hover:border-border"
                    )}>
                      <input type="radio" name="bracket" value={bt.value} checked={bracketType === bt.value}
                        disabled={disabled} onChange={() => setBracketType(bt.value)} className="accent-primary" />
                      <Badge variant="outline" className={cn("text-[10px] font-mono shrink-0 w-8 justify-center",
                        bracketType === bt.value && !disabled ? "border-primary text-primary" : "border-border/60 text-muted-foreground")}>
                        {bt.badge}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold", bracketType === bt.value && !disabled && "text-primary")}>{bt.label}</p>
                        <p className="text-xs text-muted-foreground">{bt.desc}{disabled ? ` · Хамгийн багадаа ${bt.min} тоглогч` : ""}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Groups config — SMART */}
          {bracketType === "groups_knockout" && (
            <Card className="border-primary/20 bg-card/80">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Бүлгийн тохиргоо
                  <span className="text-xs text-muted-foreground font-normal">({pCount} тоглогч)</span>
                </h2>

                {/* Visual group presets */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Бүлгийн тоо сонгох</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].filter((g) => pCount >= g * 2).map((g) => {
                      const { perGroup, remainder } = calcGroups(pCount, g)
                      const isSelected = groupsCount === g
                      return (
                        <button key={g} type="button" onClick={() => setGroupsCount(g)}
                          className={cn("flex flex-col items-center py-3 rounded-lg border-2 transition-all",
                            isSelected ? "border-primary bg-primary/10" : "border-border/50 hover:border-border bg-secondary/30")}>
                          <span className={cn("text-2xl font-black", isSelected ? "text-primary" : "")}>{g}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {remainder === 0
                              ? `${perGroup} хүн/бүлэг`
                              : `${perGroup}-${perGroup + 1} хүн`}
                          </span>
                        </button>
                      )
                    })}
                    {/* Custom */}
                    <div className="flex flex-col items-center py-2 rounded-lg border-2 border-border/40 bg-secondary/20">
                      <span className="text-[10px] text-muted-foreground mb-1">Custom</span>
                      <div className="flex items-center">
                        <button type="button" onClick={() => setGroupsCount((n) => Math.max(2, n - 1))}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground flex items-center justify-center">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center">{groupsCount}</span>
                        <button type="button" onClick={() => setGroupsCount((n) => Math.min(Math.floor(pCount / 2), n + 1))}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground flex items-center justify-center">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group composition preview */}
                <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Бүлгийн бүрэлдэхүүн</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Array.from({ length: groupsCount }).map((_, gi) => {
                      const isLarger = gi < currentGroupInfo.remainder
                      const size = currentGroupInfo.perGroup + (isLarger ? 1 : 0)
                      return (
                        <div key={gi} className="bg-card rounded-md px-3 py-2 text-center border border-border/30">
                          <p className="text-xs font-semibold text-primary">Бүлэг {String.fromCharCode(65 + gi)}</p>
                          <p className="text-lg font-black">{size}</p>
                          <p className="text-[10px] text-muted-foreground">тоглогч</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Advance count */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Бүлгийн дараагийн шатанд гарах тоо</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3].filter((a) => a < currentGroupInfo.perGroup).map((a) => (
                      <button key={a} type="button" onClick={() => setGroupAdvance(a)}
                        className={cn("flex-1 flex flex-col items-center py-2 rounded-lg border-2 transition-all",
                          groupAdvance === a ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                        <span className="text-lg font-black">Top {a}</span>
                        <span className="text-[10px] mt-0.5">
                          → {groupsCount * a} knockout
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    {groupsCount} бүлэг · топ {groupAdvance} тоглогч гарна → <strong>{groupsCount * groupAdvance}</strong> тоглогч Knockout шатанд
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Point system */}
          {(bracketType === "round_robin" || bracketType === "swiss" || bracketType === "groups_knockout") && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-bold text-sm">Point System</h2>
                <div className="flex gap-6">
                  <Stepper value={pointWon} onChange={setPointWon} min={0} max={10} label="Won" />
                  <Stepper value={pointDraw} onChange={setPointDraw} min={0} max={10} label="Draw" />
                  <Stepper value={pointLost} onChange={setPointLost} min={0} max={10} label="Lost" />
                </div>
                <CheckRow label="Win points are legs" checked={winPointsAreLegs} onChange={setWinPointsAreLegs}
                  sub="Оноог хожсон leg-ийн тоогоор тооцно" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── OPTIONS ── */}
      {step === "options" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Competition Options</h2>

            {/* Public/Private */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: false, icon: Globe, label: "Public", desc: "Бүх хүн харна" },
                { val: true, icon: Lock, label: "Private", desc: "Код шаардлагатай" },
              ].map(({ val, icon: Icon, label, desc }) => (
                <button key={String(val)} type="button" onClick={() => setIsPrivate(val)}
                  className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                    isPrivate === val ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <div><p className="text-xs font-semibold">{label}</p><p className="text-[10px] opacity-70">{desc}</p></div>
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              <CheckRow label="Show average" checked={showAverage} onChange={setShowAverage} />
              <CheckRow label="Automatic complete" checked={autoComplete} onChange={setAutoComplete}
                sub="Бүх leg дуусахад тоглолт автоматаар дуусна" />
              <CheckRow label="Confirm opponent when starting" checked={confirmOpponent} onChange={setConfirmOpponent} />
              <CheckRow label="Loser First" checked={loserFirstOption} onChange={setLoserFirstOption}
                sub="Leg хожигдсон тоглогч дараагийн leg-ийг эхэлнэ" />
              <CheckRow label="Do not select player when join (all can enter scores)"
                checked={allowParticipantScore} onChange={setAllowParticipantScore} />
              <CheckRow label="Show index in entry list" checked={showIndex} onChange={setShowIndex} />
              <CheckRow label="Mark wins as + and losses as *" checked={markWinsPlus} onChange={setMarkWinsPlus} />
              <CheckRow label="Enable Chat" checked={enableChat} onChange={setEnableChat} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── REVIEW ── */}
      {step === "review" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-center text-lg">{name}</h2>

            <div className="space-y-1.5">
              {[
                ["Game Type", format.toUpperCase()],
                ["Match Format", matchFmt],
                ...(format !== "cricket" && format !== "cutthroat" ? [["Start Score", String(startScore)]] : []),
                ["Double out / in", `${doubleOut ? "D.out" : "Straight"}${doubleIn ? " · D.in" : ""}`],
                ...(limitRoundsEnabled ? [["Limit Rounds", String(limitRounds)]] : []),
                ["Bracket", BRACKETS.find((b) => b.value === bracketType)?.label ?? bracketType],
                ...(bracketType === "groups_knockout" ? [
                  ["Groups", `${groupsCount} бүлэг · ${currentGroupInfo.perGroup}${currentGroupInfo.remainder > 0 ? `-${currentGroupInfo.perGroup + 1}` : ""} хүн/бүлэг`],
                  ["Advance", `Top ${groupAdvance} → ${groupsCount * groupAdvance} knockout`],
                ] : []),
                ...((bracketType === "round_robin" || bracketType === "swiss" || bracketType === "groups_knockout") ? [
                  ["Points", `W:${pointWon} D:${pointDraw} L:${pointLost}`],
                ] : []),
                ["Visibility", isPrivate ? "Private" : "Public"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" /> Тоглогчид ({pCount})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {validPlayers.map((p, i) => (
                  <span key={i} className="text-xs bg-secondary px-2 py-1 rounded-md">
                    {showIndex && <span className="text-muted-foreground mr-1">{i + 1}.</span>}
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {stepIndex > 0 && (
          <Button variant="outline" className="border-border/60 px-4" onClick={back}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Буцах
          </Button>
        )}
        {step !== "review" ? (
          <Button className="glow-primary flex-1" onClick={next} disabled={!canNext()}>
            Үргэлжлэх <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button className="glow-primary flex-1" size="lg" onClick={handleStart}>
            <Zap className="h-4 w-4 mr-1.5" />
            Тоглолт эхлүүлэх!
          </Button>
        )}
      </div>
    </div>
  )
}
