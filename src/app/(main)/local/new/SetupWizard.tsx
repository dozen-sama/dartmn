"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp,
  Globe, GripVertical, Lock, Minus, Plus, Target, Trophy, Users, Zap,
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

type Step = "name" | "players" | "format" | "bracket" | "review"
const STEPS: Step[] = ["name", "players", "format", "bracket", "review"]

const FORMATS: { value: GameFormat; label: string; desc: string }[] = [
  { value: "501", label: "501", desc: "Классик. 501-с эхлэж 0 болгоно" },
  { value: "301", label: "301", desc: "Хурдан тоглолт. 301-с эхэлнэ" },
  { value: "170", label: "170", desc: "Максимум checkout-аас эхэлнэ" },
  { value: "121", label: "121", desc: "Doubles-оор эхлэх" },
  { value: "cricket", label: "Cricket", desc: "15-20 болон Bull онооны тоглолт" },
]

const BRACKET_TYPES: { value: BracketType; label: string; desc: string; minPlayers: number }[] = [
  { value: "single_elimination", label: "Single Elimination", desc: "Нэг алдлаар тэмцээнгүй унана", minPlayers: 2 },
  { value: "double_elimination", label: "Double Elimination", desc: "Хоёр алдлаар унана — шударга", minPlayers: 4 },
  { value: "round_robin", label: "Round Robin", desc: "Бүгд бүгдтэйгээ тоглоно", minPlayers: 3 },
  { value: "groups_knockout", label: "Groups + Knockout", desc: "Бүлгийн шат → Knockout", minPlayers: 6 },
  { value: "swiss", label: "Swiss", desc: "Ижил оноотой тоглогчид тулалдана", minPlayers: 4 },
]

const BEST_OF_OPTIONS = [1, 3, 5, 7, 9, 11]

export function SetupWizard() {
  const router = useRouter()
  const createSession = useLocalGame((s) => s.createSession)

  const [step, setStep] = useState<Step>("name")
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState("")
  const [players, setPlayers] = useState<{ name: string }[]>([{ name: "" }, { name: "" }])
  const [newPlayerName, setNewPlayerName] = useState("")
  const [format, setFormat] = useState<GameFormat>("501")
  const [bestOf, setBestOf] = useState(3)
  const [doubleOut, setDoubleOut] = useState(true)
  const [doubleIn, setDoubleIn] = useState(false)
  const [bracketType, setBracketType] = useState<BracketType>("single_elimination")
  const [groupsCount, setGroupsCount] = useState(2)
  const [groupAdvance, setGroupAdvance] = useState(2)

  const stepIndex = STEPS.indexOf(step)
  const validPlayers = players.filter((p) => p.name.trim())

  function addPlayer() {
    const n = newPlayerName.trim() || `Тоглогч ${players.length + 1}`
    setPlayers((prev) => [...prev, { name: n }])
    setNewPlayerName("")
  }

  function removePlayer(i: number) {
    setPlayers((prev) => prev.filter((_, idx) => idx !== i))
  }

  function movePlayer(i: number, dir: -1 | 1) {
    setPlayers((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function updatePlayerName(i: number, val: string) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { name: val } : p))
  }

  function canNext(): boolean {
    if (step === "name") return name.trim().length >= 2
    if (step === "players") return validPlayers.length >= 2
    if (step === "bracket") {
      const bt = BRACKET_TYPES.find((b) => b.value === bracketType)
      return validPlayers.length >= (bt?.minPlayers ?? 2)
    }
    return true
  }

  function next() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  function back() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  function handleStart() {
    setCreating(true)
    const startScore = format === "cricket" || format === "cutthroat" ? 0 : parseInt(format) || 501
    const id = createSession({
      name: name.trim(),
      format,
      startScore,
      bestOf,
      doubleOut,
      doubleIn,
      bracketType,
      groupsCount,
      groupAdvance,
      players: validPlayers,
    })
    router.push(`/local/${id}`)
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/local" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Тоглолт үүсгэх
          </h1>
          <p className="text-muted-foreground text-sm">Алхам {stepIndex + 1} / {STEPS.length}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors",
            i < stepIndex ? "bg-primary" : i === stepIndex ? "bg-primary/60" : "bg-secondary")} />
        ))}
      </div>

      {/* ── STEP: Name ── */}
      {step === "name" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-4">
            <div className="text-center py-3">
              <Trophy className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="text-lg font-bold">Тоглолтын нэр</h2>
              <p className="text-sm text-muted-foreground mt-1">Тэмцээн, лиг, эсвэл найзуудтайгаа тоглолтод нэр өгнө үү</p>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="жнь. Долоо хоногийн лиг, Найзуудын тэмцээн..."
              className="bg-secondary/50 border-border/60 text-center text-base"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && canNext() && next()}
            />
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
                <h2 className="font-bold">Тоглогчид</h2>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">{validPlayers.length} тоглогч</Badge>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => movePlayer(i, -1)} className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30" disabled={i === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => movePlayer(i, 1)} className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30" disabled={i === players.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                  <Input
                    value={p.name}
                    onChange={(e) => updatePlayerName(i, e.target.value)}
                    placeholder={`Тоглогч ${i + 1}`}
                    className="flex-1 bg-secondary/50 border-border/60 h-8 text-sm"
                  />
                  <button onClick={() => removePlayer(i)} disabled={players.length <= 2}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-30 p-1">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add player */}
            <div className="flex gap-2 pt-1 border-t border-border/40">
              <Input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Шинэ тоглогч нэмэх..."
                className="flex-1 bg-secondary/50 border-border/60 h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              />
              <Button size="sm" variant="outline" onClick={addPlayer} className="border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: Format ── */}
      {step === "format" && (
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-3">
              <h2 className="font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Тоглоомын формат
              </h2>
              <div className="space-y-2">
                {FORMATS.map((f) => (
                  <button key={f.value} onClick={() => setFormat(f.value)}
                    className={cn("w-full flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all",
                      format === f.value ? "border-primary bg-primary/10" : "border-border/40 hover:border-border bg-secondary/30")}>
                    <span className={cn("text-base font-bold w-10 shrink-0", format === f.value ? "text-primary" : "")}>{f.label}</span>
                    <span className="text-sm text-muted-foreground">{f.desc}</span>
                    {format === f.value && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {(format === "501" || format === "301" || format === "170" || format === "121") && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-bold">Тоглолтын дүрэм</h2>
                {/* Best of */}
                <div className="space-y-2">
                  <Label className="text-sm">Best of (leg тоо)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {BEST_OF_OPTIONS.map((n) => (
                      <button key={n} onClick={() => setBestOf(n)}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium border-2 transition-all",
                          bestOf === n ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground")}>
                        BO{n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Double In/Out */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={doubleOut} onChange={(e) => setDoubleOut(e.target.checked)}
                      className="rounded accent-primary" />
                    <span className="text-sm">Double out</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={doubleIn} onChange={(e) => setDoubleIn(e.target.checked)}
                      className="rounded accent-primary" />
                    <span className="text-sm">Double in</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── STEP: Bracket ── */}
      {step === "bracket" && (
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-3">
              <h2 className="font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Хаалтын төрөл
              </h2>
              <div className="space-y-2">
                {BRACKET_TYPES.map((bt) => {
                  const disabled = validPlayers.length < bt.minPlayers
                  return (
                    <button key={bt.value} onClick={() => !disabled && setBracketType(bt.value)}
                      disabled={disabled}
                      className={cn("w-full flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all",
                        bracketType === bt.value && !disabled ? "border-primary bg-primary/10" : "border-border/40 bg-secondary/30",
                        disabled ? "opacity-40 cursor-not-allowed" : "hover:border-border")}>
                      <div className="flex-1">
                        <p className={cn("text-sm font-semibold", bracketType === bt.value && !disabled ? "text-primary" : "")}>{bt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{bt.desc}</p>
                        {disabled && <p className="text-xs text-destructive mt-0.5">Хамгийн багадаа {bt.minPlayers} тоглогч хэрэгтэй</p>}
                      </div>
                      {bracketType === bt.value && !disabled && <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {bracketType === "groups_knockout" && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-bold">Бүлгийн тохиргоо</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Бүлгийн тоо</Label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setGroupsCount((n) => Math.max(2, n - 1))}
                        className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center hover:bg-secondary">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-lg font-bold w-8 text-center">{groupsCount}</span>
                      <button onClick={() => setGroupsCount((n) => Math.min(8, n + 1))}
                        className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center hover:bg-secondary">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Бүлгээс гарах тоо</Label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setGroupAdvance((n) => Math.max(1, n - 1))}
                        className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center hover:bg-secondary">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-lg font-bold w-8 text-center">{groupAdvance}</span>
                      <button onClick={() => setGroupAdvance((n) => Math.min(4, n + 1))}
                        className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center hover:bg-secondary">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Нийт {groupsCount} бүлэг · Бүлэг тус бүрийн топ {groupAdvance} → Knockout
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── STEP: Review ── */}
      {step === "review" && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-5 space-y-5">
            <h2 className="font-bold text-lg text-center">{name}</h2>

            <div className="space-y-3">
              <ReviewRow label="Формат" value={format.toUpperCase()} />
              <ReviewRow label="Best of" value={`BO${bestOf} · ${Math.ceil(bestOf / 2)} leg хожлоор дуусна`} />
              {(format !== "cricket" && format !== "cutthroat") && (
                <ReviewRow label="Дүрэм" value={`${doubleOut ? "Double out" : "Straight out"}${doubleIn ? " · Double in" : ""}`} />
              )}
              <ReviewRow label="Bracket" value={BRACKET_TYPES.find((b) => b.value === bracketType)?.label ?? bracketType} />
              {bracketType === "groups_knockout" && (
                <ReviewRow label="Бүлгүүд" value={`${groupsCount} бүлэг · топ ${groupAdvance} гарна`} />
              )}
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs text-muted-foreground mb-2">Тоглогчид ({validPlayers.length})</p>
                <div className="flex flex-wrap gap-2">
                  {validPlayers.map((p, i) => (
                    <span key={i} className="text-xs bg-secondary px-2 py-1 rounded-md font-medium">
                      {i + 1}. {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {stepIndex > 0 && (
          <Button variant="outline" className="border-border/60 flex-1" onClick={back}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Буцах
          </Button>
        )}
        {step !== "review" ? (
          <Button className="glow-primary flex-1" onClick={next} disabled={!canNext()}>
            Үргэлжлэх
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button className="glow-primary flex-1" onClick={handleStart} disabled={creating}>
            <Zap className="h-4 w-4 mr-1.5" />
            Тоглолт эхлүүлэх!
          </Button>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}
