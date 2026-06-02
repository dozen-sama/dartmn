"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Globe,
  Lock, Minus, Plus, Target, Trophy, Users, Zap,
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

const FORMATS: { value: GameFormat; label: string; score: number }[] = [
  { value: "501", label: "501", score: 501 },
  { value: "301", label: "301", score: 301 },
  { value: "170", label: "170", score: 170 },
  { value: "121", label: "121", score: 121 },
  { value: "cricket", label: "Cricket", score: 0 },
  { value: "cutthroat", label: "Cutthroat", score: 0 },
]

const BRACKETS: { value: BracketType; label: string; desc: string; min: number }[] = [
  { value: "single_elimination", label: "Single Elimination 1", desc: "Нэг алдлаар унана. Шилдэг нь хожно.", min: 2 },
  { value: "double_elimination", label: "Double Elimination", desc: "Хоёр алдлаар унана. Winners + Losers bracket.", min: 4 },
  { value: "round_robin", label: "Round Robin (Matches)", desc: "Бүгд бүгдтэйгээ тоглоно. Standings-аар эрэмбэлэгдэнэ.", min: 3 },
  { value: "groups_knockout", label: "Groups + Knockout", desc: "Бүлгийн шат дараа Knockout.", min: 6 },
  { value: "swiss", label: "Swiss", desc: "Ижил оноотой тоглогчид тулалдана.", min: 4 },
]

function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0">
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

function CheckRow({ label, checked, onChange, sub }: { label: string; checked: boolean; onChange: (v: boolean) => void; sub?: string }) {
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

export function SetupWizard() {
  const router = useRouter()
  const createSession = useLocalGame((s) => s.createSession)

  const [step, setStep] = useState<Step>("name")

  // Step 1
  const [name, setName] = useState("")

  // Step 2 — Players
  const [players, setPlayers] = useState([{ name: "" }, { name: "" }])
  const [newName, setNewName] = useState("")
  const [batchText, setBatchText] = useState("")
  const [showBatch, setShowBatch] = useState(false)

  // Step 3 — Format
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

  // Step 4 — Bracket
  const [bracketType, setBracketType] = useState<BracketType>("single_elimination")
  const [groupsCount, setGroupsCount] = useState(2)
  const [groupAdvance, setGroupAdvance] = useState(2)
  const [pointWon, setPointWon] = useState(2)
  const [pointDraw, setPointDraw] = useState(1)
  const [pointLost, setPointLost] = useState(0)
  const [winPointsAreLegs, setWinPointsAreLegs] = useState(false)

  // Step 5 — Options
  const [showAverage, setShowAverage] = useState(true)
  const [autoComplete, setAutoComplete] = useState(true)
  const [confirmOpponent, setConfirmOpponent] = useState(false)
  const [allowParticipantScore, setAllowParticipantScore] = useState(false)
  const [showIndex, setShowIndex] = useState(true)
  const [isPrivate, setIsPrivate] = useState(false)

  const stepIndex = STEPS.indexOf(step)
  const validPlayers = players.filter((p) => p.name.trim())

  function addPlayer(nm?: string) {
    const n = (nm ?? newName).trim() || `Тоглогч ${players.length + 1}`
    setPlayers((prev) => [...prev, { name: n }])
    setNewName("")
  }

  function batchAdd() {
    const names = batchText.split("\n").map((s) => s.trim()).filter(Boolean)
    setPlayers((prev) => [...prev, ...names.map((n) => ({ name: n }))])
    setBatchText("")
    setShowBatch(false)
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
  function handleFormatChange(f: GameFormat) {
    setFormat(f)
    const opt = FORMATS.find((x) => x.value === f)
    if (opt && opt.score > 0) setStartScore(opt.score)
  }

  function canNext() {
    if (step === "name") return name.trim().length >= 2
    if (step === "players") return validPlayers.length >= 2
    if (step === "bracket") return validPlayers.length >= (BRACKETS.find((b) => b.value === bracketType)?.min ?? 2)
    return true
  }

  function next() { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) setStep(STEPS[i + 1]) }
  function back() { const i = STEPS.indexOf(step); if (i > 0) setStep(STEPS[i - 1]) }

  function handleStart() {
    const id = createSession({
      name: name.trim(), format, startScore,
      firstTo, setsEnabled, legsPerSet,
      doubleOut, doubleIn, loserFirst,
      limitRounds: limitRoundsEnabled ? limitRounds : null,
      showAverage, autoComplete, allowParticipantScore, showIndex,
      pointWon, pointDraw, pointLost, winPointsAreLegs,
      bracketType, groupsCount, groupAdvance,
      players: validPlayers,
    })
    router.push(`/local/${id}`)
  }

  const matchFormat = setsEnabled
    ? `First to ${firstTo} sets (${legsPerSet} legs/set)`
    : `First to ${firstTo} legs`

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/local" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Тоглолт үүсгэх
          </h1>
          <p className="text-xs text-muted-foreground">Detail Setting — {STEP_LABELS[stepIndex]} ({stepIndex + 1}/{STEPS.length})</p>
        </div>
      </div>

      {/* Progress tabs */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <button key={s} type="button" onClick={() => i < stepIndex && setStep(s)}
            className={cn("flex-1 h-1.5 rounded-full transition-all",
              i < stepIndex ? "bg-primary cursor-pointer" : i === stepIndex ? "bg-primary/60" : "bg-secondary")}>
          </button>
        ))}
      </div>

      {/* ── STEP: Name ── */}
      {step === "name" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <div className="text-center py-2">
              <Trophy className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="font-bold text-lg">Competition Title</h2>
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="жнь. Долоо хоногийн лиг, Пабын аварга..."
              className="bg-secondary/50 border-border/60 text-center text-base"
              autoFocus onKeyDown={(e) => e.key === "Enter" && canNext() && next()} />
          </CardContent>
        </Card>
      )}

      {/* ── STEP: Players ── */}
      {step === "players" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-bold">Entry List</h2>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">{validPlayers.length}</Badge>
            </div>

            {/* Player list */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  {showIndex && <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => movePlayer(i, -1)} disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                    <button onClick={() => movePlayer(i, 1)} disabled={i === players.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <Input value={p.name} onChange={(e) => updatePlayer(i, e.target.value)}
                    placeholder={`Тоглогч ${i + 1}`}
                    className="flex-1 h-8 text-sm bg-secondary/50 border-border/60" />
                  <button onClick={() => removePlayer(i)} disabled={players.length <= 2}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-20 p-1">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add single */}
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Шинэ тоглогч нэмэх..."
                className="flex-1 h-8 text-sm bg-secondary/50 border-border/60"
                onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
              <Button size="sm" variant="outline" onClick={() => addPlayer()}
                className="border-primary/30 text-primary hover:bg-primary/10 shrink-0 h-8">
                <Plus className="h-3.5 w-3.5" />
                Add Player
              </Button>
            </div>

            {/* Batch add */}
            <div>
              <button type="button" onClick={() => setShowBatch(!showBatch)}
                className="text-xs text-muted-foreground hover:text-foreground underline">
                Batch Add (олон нэрийг нэгэн зэрэг)
              </button>
              {showBatch && (
                <div className="mt-2 space-y-2">
                  <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)}
                    rows={4} placeholder={"Нэг мөрт нэг тоглогч:\nБат\nДорж\nЭнх"}
                    className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  <Button size="sm" onClick={batchAdd} variant="outline" className="w-full border-primary/30 text-primary">
                    Batch нэмэх ({batchText.split("\n").filter(s => s.trim()).length} тоглогч)
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: Format ── */}
      {step === "format" && (
        <div className="space-y-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-4">
              <h2 className="font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Game Setting</h2>

              {/* Game type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Available game types</Label>
                <div className="flex gap-2 flex-wrap">
                  {FORMATS.map((f) => (
                    <button key={f.value} type="button" onClick={() => handleFormatChange(f.value)}
                      className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                        format === f.value ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* First to / Sets / Legs */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Match Format</Label>
                <div className="flex items-end gap-3 flex-wrap">
                  <Stepper value={firstTo} onChange={setFirstTo} min={1} max={11} label="First to" />
                  <button type="button" onClick={() => setSetsEnabled(!setsEnabled)}
                    className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all mb-0.5",
                      setsEnabled ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                    Sets
                  </button>
                  {setsEnabled
                    ? <><span className="text-muted-foreground text-sm mb-1">/</span><Stepper value={legsPerSet} onChange={setLegsPerSet} min={1} max={11} label="Legs/Set" /></>
                    : <span className="text-sm text-muted-foreground mb-1">Legs</span>
                  }
                </div>
                <p className="text-xs text-primary/80">{matchFormat}</p>
              </div>

              {/* Start Score */}
              {(format === "501" || format === "301" || format === "170" || format === "121") && (
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

              {/* Limit Rounds */}
              <div className="flex items-center gap-3">
                <CheckRow label="Limit Rounds" checked={limitRoundsEnabled} onChange={setLimitRoundsEnabled} />
                {limitRoundsEnabled && (
                  <Input type="number" value={limitRounds} onChange={(e) => setLimitRounds(parseInt(e.target.value) || 15)}
                    min={1} max={50} className="w-20 h-7 text-sm bg-secondary/50 border-border/60" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rules */}
          {(format === "501" || format === "301" || format === "170" || format === "121") && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-bold text-sm">Дүрэм</h2>
                <div className="grid grid-cols-2 gap-3">
                  <CheckRow label="Double out" checked={doubleOut} onChange={setDoubleOut} />
                  <CheckRow label="Double in" checked={doubleIn} onChange={setDoubleIn} />
                  <CheckRow label="Loser First" checked={loserFirst} onChange={setLoserFirst}
                    sub="Leg хожигдсон тоглогч эхэлнэ" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── STEP: Bracket ── */}
      {step === "bracket" && (
        <div className="space-y-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-2">
              <h2 className="font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Bracket Type</h2>
              {BRACKETS.map((bt) => {
                const disabled = validPlayers.length < bt.min
                return (
                  <label key={bt.value} className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    bracketType === bt.value && !disabled ? "border-primary bg-primary/10" : "border-border/40 bg-secondary/20",
                    disabled ? "opacity-40 cursor-not-allowed" : "hover:border-border"
                  )}>
                    <input type="radio" name="bracket" value={bt.value}
                      checked={bracketType === bt.value} disabled={disabled}
                      onChange={() => setBracketType(bt.value)} className="mt-0.5 accent-primary" />
                    <div>
                      <p className={cn("text-sm font-semibold", bracketType === bt.value && !disabled && "text-primary")}>{bt.label}</p>
                      <p className="text-xs text-muted-foreground">{bt.desc}</p>
                      {disabled && <p className="text-xs text-destructive">Хамгийн багадаа {bt.min} тоглогч</p>}
                    </div>
                  </label>
                )
              })}
            </CardContent>
          </Card>

          {bracketType === "groups_knockout" && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-bold text-sm">Бүлгийн тохиргоо</h2>
                <div className="flex gap-6">
                  <Stepper value={groupsCount} onChange={setGroupsCount} min={2} max={8} label="Бүлгийн тоо" />
                  <Stepper value={groupAdvance} onChange={setGroupAdvance} min={1} max={4} label="Бүлгээс гарах" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {groupsCount} бүлэг · топ {groupAdvance} тоглогч гарна → Knockout
                </p>
              </CardContent>
            </Card>
          )}

          {(bracketType === "round_robin" || bracketType === "swiss") && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-4">
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

      {/* ── STEP: Options ── */}
      {step === "options" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Competition Options</h2>

            {/* Private toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsPrivate(false)}
                className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  !isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground")}>
                <Globe className="h-4 w-4 shrink-0" />
                <div><p className="text-xs font-semibold">Public</p><p className="text-[10px] opacity-70">Бүх хүн харна</p></div>
              </button>
              <button type="button" onClick={() => setIsPrivate(true)}
                className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground")}>
                <Lock className="h-4 w-4 shrink-0" />
                <div><p className="text-xs font-semibold">Private</p><p className="text-[10px] opacity-70">Код шаардлагатай</p></div>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <CheckRow label="Show average" checked={showAverage} onChange={setShowAverage} />
              <CheckRow label="Automatic complete" checked={autoComplete} onChange={setAutoComplete}
                sub="Бүх leg дуусахад тоглолт автоматаар дуусна" />
              <CheckRow label="Confirm opponent when starting" checked={confirmOpponent} onChange={(v) => setConfirmOpponent(v)} />
              <CheckRow label="Do not select player when join (Participants can enter scores for all players)"
                checked={allowParticipantScore} onChange={setAllowParticipantScore} />
              <CheckRow label="Show index in entry list" checked={showIndex} onChange={setShowIndex} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: Review ── */}
      {step === "review" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-center text-lg">{name}</h2>

            <div className="space-y-2">
              {[
                ["Game Type", format.toUpperCase()],
                ["Match Format", matchFormat],
                ...(format !== "cricket" && format !== "cutthroat" ? [["Start Score", String(startScore)]] : []),
                ["Double out", doubleOut ? "Тийм" : "Үгүй"],
                ...(limitRoundsEnabled ? [["Limit Rounds", String(limitRounds)]] : []),
                ["Bracket", BRACKETS.find((b) => b.value === bracketType)?.label ?? bracketType],
                ...(bracketType === "groups_knockout" ? [["Groups", `${groupsCount} бүлэг · топ ${groupAdvance} гарна`]] : []),
                ...(bracketType === "round_robin" || bracketType === "swiss" ? [["Point System", `W:${pointWon} D:${pointDraw} L:${pointLost}`]] : []),
                ["Loser First", loserFirst ? "Тийм" : "Үгүй"],
                ["Show Average", showAverage ? "Тийм" : "Үгүй"],
                ["Visibility", isPrivate ? "Private" : "Public"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2">Тоглогчид ({validPlayers.length})</p>
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
          <Button variant="outline" className="border-border/60" onClick={back}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Буцах
          </Button>
        )}
        {step !== "review" ? (
          <Button className="glow-primary flex-1" onClick={next} disabled={!canNext()}>
            Үргэлжлэх <ArrowRight className="h-4 w-4 ml-1" />
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
