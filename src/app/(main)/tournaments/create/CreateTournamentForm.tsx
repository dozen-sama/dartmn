"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Calendar, ChevronDown, ChevronRight, Copy, Eye, EyeOff,
  Globe, Lock, Loader2, Minus, Plus, RefreshCw, Trophy, Users,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Props {
  userId: string
  clubs: { id: string; name: string }[]
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Collapsible section
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="border-border/50 bg-card/80">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors rounded-t-lg"
      >
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <>
          <Separator />
          <CardContent className="p-4 space-y-4">{children}</CardContent>
        </>
      )}
    </Card>
  )
}

// Checkbox row
function CheckRow({ label, checked, onChange, sub }: { label: string; checked: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded accent-primary"
      />
      <div>
        <span className="text-sm group-hover:text-foreground transition-colors">{label}</span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </label>
  )
}

// Number stepper
function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-0">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary transition-colors">
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
          className="h-8 w-12 text-center text-sm font-bold border-y border-border/60 bg-secondary/50 focus:outline-none"
        />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="h-8 w-8 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary transition-colors">
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export function CreateTournamentForm({ userId, clubs }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Basic info
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [clubId, setClubId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [regDeadline, setRegDeadline] = useState("")
  const [location, setLocation] = useState("")
  const [titleImageUrl, setTitleImageUrl] = useState("")

  // Format
  const [format, setFormat] = useState<"501" | "301" | "cricket" | "cutthroat">("501")
  const [startScore, setStartScore] = useState(501)
  const [firstTo, setFirstTo] = useState(2)
  const [setsEnabled, setSetsEnabled] = useState(false)
  const [legsPerSet, setLegsPerSet] = useState(3)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)
  const [loserFirst, setLoserFirst] = useState(false)

  // Bracket
  const [bracketType, setBracketType] = useState<"single_elimination" | "double_elimination" | "round_robin" | "swiss">("single_elimination")
  const [maxPlayers, setMaxPlayers] = useState(16)

  // Оноо тооцоо (RR/Swiss)
  const [pointWon, setPointWon] = useState(2)
  const [pointDraw, setPointDraw] = useState(1)
  const [pointLost, setPointLost] = useState(0)
  const [winPointsAreLegs, setWinPointsAreLegs] = useState(false)

  // Options
  const [isPrivate, setIsPrivate] = useState(false)
  const [joinCode, setJoinCode] = useState(generateCode())
  const [password, setPassword] = useState("")
  const [showAverage, setShowAverage] = useState(true)
  const [autoComplete, setAutoComplete] = useState(true)
  const [confirmOpponent, setConfirmOpponent] = useState(false)
  const [allowParticipantScore, setAllowParticipantScore] = useState(false)
  const [showIndex, setShowIndex] = useState(true)

  // Players
  const [entryFee, setEntryFee] = useState(0)
  const [prizePool, setPrizePool] = useState(0)

  // Batch add
  const [batchText, setBatchText] = useState("")
  const [showBatch, setShowBatch] = useState(false)

  const BRACKET_OPTIONS = [
    { value: "single_elimination", label: "Single Elimination", desc: "Нэг алдлаар унана" },
    { value: "double_elimination", label: "Double Elimination", desc: "Хоёр алдлаар унана" },
    { value: "round_robin", label: "Round Robin", desc: "Бүгд бүгдтэйгээ тоглоно" },
    { value: "swiss", label: "Swiss (Matches)", desc: "Ижил оноотой тоглогчид тулалдана" },
  ] as const

  const FORMAT_OPTIONS = [
    { value: "501", label: "501", score: 501 },
    { value: "301", label: "301", score: 301 },
    { value: "170", label: "170", score: 170 },
    { value: "cricket", label: "Cricket", score: 0 },
    { value: "cutthroat", label: "Cutthroat", score: 0 },
  ]

  function handleFormatChange(val: string) {
    const opt = FORMAT_OPTIONS.find((f) => f.value === val)
    if (!opt) return
    setFormat(val as typeof format)
    if (opt.score > 0) setStartScore(opt.score)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error("Тэмцээний нэр оруулна уу")
    if (!startDate) return toast.error("Эхлэх огноо оруулна уу")

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name: name.trim(),
        description: description || null,
        club_id: clubId || null,
        organizer_id: userId,
        format,
        type: "singles",
        bracket_type: bracketType,
        status: "draft",
        max_players: maxPlayers,
        entry_fee: entryFee,
        prize_pool: prizePool,
        start_date: startDate,
        registration_deadline: regDeadline || null,
        location: location || null,
        banner_url: titleImageUrl || null,
        join_code: joinCode,
        password: password || null,
        is_private: isPrivate,
        first_to: firstTo,
        sets_enabled: setsEnabled,
        legs_per_set: legsPerSet,
        limit_rounds: limitRoundsEnabled ? limitRounds : null,
        loser_first: loserFirst,
        show_average: showAverage,
        auto_complete: autoComplete,
        confirm_opponent: confirmOpponent,
        allow_participant_score: allowParticipantScore,
        show_index: showIndex,
        point_won: pointWon,
        point_draw: pointDraw,
        point_lost: pointLost,
        win_points_are_legs: winPointsAreLegs,
      })
      .select("id")
      .single()

    if (error || !data) {
      toast.error("Тэмцээн үүсгэхэд алдаа гарлаа")
      setLoading(false)
      return
    }

    toast.success("Тэмцээн амжилттай үүслээ!")
    router.push(`/tournaments/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Тэмцээн үүсгэх
          </h1>
          <p className="text-muted-foreground text-sm">Дэлгэрэнгүй тохиргоо</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* ── COMPETITION SETTING ── */}
        <Section title="Тэмцээний тохиргоо">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Тэмцээний нэр <span className="text-primary">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Монголын нээлттэй чемпионат 2026"
                className="bg-secondary/50 border-border/60" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Join нууц үг</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="нууц үгтэй бол..."
                    className="bg-secondary/50 border-border/60 pr-9" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Join Code</Label>
                <div className="flex gap-1.5">
                  <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={8} className="bg-secondary/50 border-border/60 font-mono text-center font-bold tracking-widest" />
                  <button type="button" onClick={() => setJoinCode(generateCode())}
                    className="shrink-0 h-9 w-9 border border-border/60 rounded-md flex items-center justify-center hover:bg-secondary">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date <span className="text-primary">*</span></Label>
                <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Бүртгэлийн дедлайн</Label>
                <Input type="datetime-local" value={regDeadline} onChange={(e) => setRegDeadline(e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Тэмцээний тайлбар</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} placeholder="Тэмцээний дэлгэрэнгүй мэдээлэл..."
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Байршил</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="DartMN Клуб, УБ" className="bg-secondary/50 border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Баннер зурагны холбоос</Label>
                <Input value={titleImageUrl} onChange={(e) => setTitleImageUrl(e.target.value)}
                  placeholder="https://..." className="bg-secondary/50 border-border/60" />
              </div>
            </div>

            {clubs.length > 0 && (
              <div className="space-y-1.5">
                <Label>Клуб</Label>
                <Select value={clubId} onValueChange={(v) => v && setClubId(v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60">
                    <SelectValue placeholder="Клуб сонгох (сонголтоор)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Section>

        {/* ── GAME SETTING ── */}
        <Section title="Game Setting">
          {/* Format */}
          <div className="space-y-1.5">
            <Label>Тоглолтын төрөл</Label>
            <div className="flex gap-2 flex-wrap">
              {FORMAT_OPTIONS.map((f) => (
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
            <Label>Тоглолтын формат</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Stepper value={firstTo} onChange={setFirstTo} min={1} max={11} label="First to" />
              <div className="flex items-center gap-2 mt-4">
                <button type="button" onClick={() => setSetsEnabled(!setsEnabled)}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                    setsEnabled ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                  Sets
                </button>
                <span className="text-muted-foreground text-sm">/</span>
                {setsEnabled && <Stepper value={legsPerSet} onChange={setLegsPerSet} min={1} max={11} label="Legs per set" />}
                {!setsEnabled && <span className="text-sm text-muted-foreground mt-4">Legs</span>}
              </div>
            </div>
          </div>

          {/* Start Score + Round хязгаар */}
          {(format === "501" || format === "301") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Score</Label>
                <div className="flex gap-1.5">
                  {[501, 301, 170, 121].map((s) => (
                    <button key={s} type="button" onClick={() => setStartScore(s)}
                      className={cn("flex-1 py-1.5 text-xs font-bold rounded-md border-2 transition-all",
                        startScore === s ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label>Round хязгаар</Label>
                  <input type="checkbox" checked={limitRoundsEnabled} onChange={(e) => setLimitRoundsEnabled(e.target.checked)} className="accent-primary" />
                </div>
                {limitRoundsEnabled && (
                  <Input type="number" value={limitRounds} onChange={(e) => setLimitRounds(parseInt(e.target.value) || 15)}
                    min={1} max={50} className="bg-secondary/50 border-border/60" />
                )}
              </div>
            </div>
          )}

          {/* Loser First */}
          <CheckRow label="Loser First" checked={loserFirst} onChange={setLoserFirst}
            sub="Өмнөх leg-ийг хожигдсон тоглогч эхэлнэ" />
        </Section>

        {/* ── BRACKET TYPE ── */}
        <Section title="Bracket төрөл">
          <div className="space-y-2">
            {BRACKET_OPTIONS.map((bt) => (
              <label key={bt.value} className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                bracketType === bt.value ? "border-primary bg-primary/10" : "border-border/40 hover:border-border bg-secondary/20"
              )}>
                <input type="radio" name="bracket" value={bt.value}
                  checked={bracketType === bt.value}
                  onChange={() => setBracketType(bt.value)}
                  className="accent-primary" />
                <div>
                  <p className={cn("text-sm font-semibold", bracketType === bt.value && "text-primary")}>{bt.label}</p>
                  <p className="text-xs text-muted-foreground">{bt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Тоглогчийн тоо</Label>
              <Select value={String(maxPlayers)} onValueChange={(v) => v && setMaxPlayers(parseInt(v))}>
                <SelectTrigger className="bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 8, 16, 32, 64, 128].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} тоглогч</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Оролцооны хураамж (₮)</Label>
              <Input type="number" min={0} value={entryFee}
                onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                className="bg-secondary/50 border-border/60" />
              {entryFee > 0 && (
                <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-2.5 py-1.5 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Тоглогч төлөх дүн</span>
                    <span className="font-medium">{entryFee.toLocaleString()}₮</span>
                  </div>
                  <div className="flex justify-between text-primary/70">
                    <span>+ Платформын шимтгэл</span>
                    <span>1,000₮</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-border/40 pt-1 mt-1">
                    <span>Нийт</span>
                    <span className="text-primary">{(entryFee + 1000).toLocaleString()}₮</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Шагналын сан (₮)</Label>
            <Input type="number" min={0} value={prizePool}
              onChange={(e) => setPrizePool(parseInt(e.target.value) || 0)}
              className="bg-secondary/50 border-border/60" />
          </div>
        </Section>

        {/* ── POINT SYSTEM (RR/Swiss) ── */}
        {(bracketType === "round_robin" || bracketType === "swiss") && (
          <Section title="Оноо тооцоо">
            <div className="grid grid-cols-3 gap-4">
              <Stepper value={pointWon} onChange={setPointWon} min={0} max={10} label="Хожил" />
              <Stepper value={pointDraw} onChange={setPointDraw} min={0} max={10} label="Тэнцэл" />
              <Stepper value={pointLost} onChange={setPointLost} min={0} max={10} label="Хохирол" />
            </div>
            <CheckRow label="Оноог leg-ийн тоогоор тооцох" checked={winPointsAreLegs} onChange={setWinPointsAreLegs}
              sub="Оноог хожсон leg-ийн тоогоор тооцно" />
          </Section>
        )}

        {/* ── COMPETITION OPTIONS ── */}
        <Section title="Тэмцээний нэмэлт тохиргоо">
          {/* Public / Private */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button type="button" onClick={() => setIsPrivate(false)}
              className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                !isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
              <Globe className="h-4 w-4" />
              <div className="text-left">
                <p className="text-sm font-semibold">Public</p>
                <p className="text-[11px] opacity-70">Бүх хүн харна</p>
              </div>
            </button>
            <button type="button" onClick={() => setIsPrivate(true)}
              className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
              <Lock className="h-4 w-4" />
              <div className="text-left">
                <p className="text-sm font-semibold">Private</p>
                <p className="text-[11px] opacity-70">Join code шаардлагатай</p>
              </div>
            </button>
          </div>

          <div className="space-y-3">
            <CheckRow label="Average харуулах" checked={showAverage} onChange={setShowAverage} />
            <CheckRow label="Автоматаар дуусгах"  checked={autoComplete} onChange={setAutoComplete}
              sub="Бүх leg дуусахад тоглолт автоматаар дуусна" />
            <CheckRow label="Тоглолт эхлэхэд өрсөлдөгчийг баталгаажуулах" checked={confirmOpponent} onChange={setConfirmOpponent} />
            <CheckRow label="Loser First" checked={loserFirst} onChange={setLoserFirst}
              sub="Leg хожигдсон тоглогч дараагийн leg-ийг эхэлнэ" />
            <CheckRow label="Нэвтрэхэд тоглогч сонгохгүй (Оролцогч бүр оноо оруулах боломжтой)"
              checked={allowParticipantScore} onChange={setAllowParticipantScore} />
            <CheckRow label="Жагсаалтад дугаар харуулах" checked={showIndex} onChange={setShowIndex} />
          </div>
        </Section>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Link href="/tournaments" className={cn(buttonVariants({ variant: "outline" }), "border-border/60")}>
            Cancel
          </Link>
          <Button type="submit" className="flex-1 glow-primary" size="lg" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Тэмцээн үүсгэх
          </Button>
        </div>
      </form>
    </div>
  )
}
