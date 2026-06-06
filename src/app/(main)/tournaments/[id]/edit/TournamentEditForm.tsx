"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Calendar, ChevronDown, ChevronRight, Copy, Eye, EyeOff,
  Globe, Lock, Loader2, Minus, Plus, RefreshCw, Save, Trash2, Trophy,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Tournament } from "@/types/database"
import { mn } from "@/locales/mn"
import Link from "next/link"

interface Props {
  tournament: Tournament
  clubs: { id: string; name: string }[]
}

function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase() }

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="border-border/50 bg-card/80 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/20 transition-colors">
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

function CheckRow({ label, checked, onChange, sub }: { label: string; checked: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-primary" />
      <div>
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </label>
  )
}

function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-0">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary">
          <Minus className="h-3 w-3" />
        </button>
        <input type="number" value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
          className="h-8 w-12 text-center text-sm font-bold border-y border-border/60 bg-secondary/50 focus:outline-none" />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="h-8 w-8 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary">
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export function TournamentEditForm({ tournament: t, clubs }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Pre-populate with existing values
  const [name, setName] = useState(t.name)
  const [description, setDescription] = useState(t.description ?? "")
  const [clubId, setClubId] = useState(t.club_id ?? "")
  const [startDate, setStartDate] = useState(t.start_date.slice(0, 16))
  const [regDeadline, setRegDeadline] = useState(t.registration_deadline?.slice(0, 16) ?? "")
  const [location, setLocation] = useState(t.location ?? "")
  const [titleImageUrl, setTitleImageUrl] = useState(t.banner_url ?? "")
  const [rules, setRules] = useState(t.rules ?? "")

  const [format, setFormat] = useState(t.format)
  const [startScore, setStartScore] = useState(t.first_to ?? 501)
  const [firstTo, setFirstTo] = useState(t.first_to ?? 2)
  const [setsEnabled, setSetsEnabled] = useState(t.sets_enabled ?? false)
  const [legsPerSet, setLegsPerSet] = useState(t.legs_per_set ?? 3)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(!!t.limit_rounds)
  const [limitRounds, setLimitRounds] = useState(t.limit_rounds ?? 15)
  const [loserFirst, setLoserFirst] = useState(t.loser_first ?? false)

  const [bracketType, setBracketType] = useState(t.bracket_type)
  const [maxPlayers, setMaxPlayers] = useState(t.max_players)
  const [entryFee, setEntryFee] = useState(t.entry_fee)
  const [prizePool, setPrizePool] = useState(t.prize_pool)

  const [pointWon, setPointWon] = useState(t.point_won ?? 2)
  const [pointDraw, setPointDraw] = useState(t.point_draw ?? 1)
  const [pointLost, setPointLost] = useState(t.point_lost ?? 0)
  const [winPointsAreLegs, setWinPointsAreLegs] = useState(t.win_points_are_legs ?? false)

  const [isPrivate, setIsPrivate] = useState(t.is_private)
  const [joinCode, setJoinCode] = useState(t.join_code ?? generateCode())
  const [password, setPassword] = useState(t.password ?? "")
  const [showAverage, setShowAverage] = useState(t.show_average ?? true)
  const [autoComplete, setAutoComplete] = useState(t.auto_complete ?? true)
  const [confirmOpponent, setConfirmOpponent] = useState(t.confirm_opponent ?? false)
  const [allowParticipantScore, setAllowParticipantScore] = useState(t.allow_participant_score ?? false)
  const [showIndex, setShowIndex] = useState(t.show_index ?? true)

  const BRACKET_OPTIONS = [
    { value: "single_elimination", label: "Single Elimination" },
    { value: "double_elimination", label: "Double Elimination" },
    { value: "round_robin", label: "Round Robin" },
    { value: "swiss", label: "Swiss" },
  ] as const

  const FORMAT_OPTIONS = [
    { value: "501", label: "501", score: 501 },
    { value: "301", label: "301", score: 301 },
    { value: "cricket", label: "Cricket", score: 0 },
    { value: "cutthroat", label: "Cutthroat", score: 0 },
  ]

  const statusColors: Record<Tournament["status"], string> = {
    draft: "bg-muted text-muted-foreground",
    registration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    ongoing: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-green-500/15 text-green-400 border-green-500/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error("Тэмцээний нэр оруулна уу")
    if (!startDate) return toast.error("Эхлэх огноо оруулна уу")

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("tournaments")
      .update({
        name: name.trim(),
        description: description || null,
        club_id: clubId || null,
        format,
        bracket_type: bracketType,
        max_players: maxPlayers,
        entry_fee: entryFee,
        prize_pool: prizePool,
        start_date: startDate,
        registration_deadline: regDeadline || null,
        location: location || null,
        banner_url: titleImageUrl || null,
        rules: rules || null,
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
      .eq("id", t.id)

    if (error) {
      toast.error("Хадгалахад алдаа гарлаа")
    } else {
      toast.success("Тэмцээн амжилттай хадгалагдлаа")
      router.push(`/tournaments/${t.id}`)
      router.refresh()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`"${t.name}" тэмцээнийг устгах уу? Энэ үйлдлийг буцааж болохгүй.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from("tournaments").delete().eq("id", t.id)
    if (error) { toast.error("Устгахад алдаа гарлаа"); setDeleting(false) }
    else { toast.success("Тэмцээн устгагдлаа"); router.push("/tournaments") }
  }

  async function handleCopy() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name: `${name} (хуулбар)`,
        description: description || null,
        organizer_id: user.id,
        format, bracket_type: bracketType,
        status: "draft" as const,
        max_players: maxPlayers,
        entry_fee: entryFee,
        prize_pool: prizePool,
        start_date: startDate,
        location: location || null,
        rules: rules || null,
        join_code: generateCode(),
        is_private: isPrivate,
        first_to: firstTo,
        sets_enabled: setsEnabled,
        legs_per_set: legsPerSet,
        point_won: pointWon,
        point_draw: pointDraw,
        point_lost: pointLost,
      })
      .select("id")
      .single()

    if (!error && data) {
      toast.success("Тэмцээн хуулагдлаа!")
      router.push(`/tournaments/${data.id}/edit`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/tournaments/${t.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Тэмцээн засах
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-xs ${statusColors[t.status]}`}>
                {mn.tournament.status[t.status]}
              </Badge>
              <span className="text-xs text-muted-foreground">{t.name}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy}
            className="border-border/60 hidden sm:flex">
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Хуулах
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}
            className="border-destructive/30 text-destructive hover:bg-destructive/10">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {/* ── COMPETITION SETTING ── */}
        <Section title="Тэмцээний тохиргоо">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Тэмцээний нэр <span className="text-primary">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                className="bg-secondary/50 border-border/60" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Join нууц үг</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="нууц үгтэй бол..."
                    className="bg-secondary/50 border-border/60 pr-9" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Байршил</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Баннер зурагны холбоос</Label>
                <Input value={titleImageUrl} onChange={(e) => setTitleImageUrl(e.target.value)}
                  placeholder="https://..." className="bg-secondary/50 border-border/60" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Дүрэм</Label>
              <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3}
                placeholder="Тэмцээний дүрэм, тайлбар..."
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>

            {clubs.length > 0 && (
              <div className="space-y-1.5">
                <Label>Клуб</Label>
                <Select value={clubId} onValueChange={(v) => v && setClubId(v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60">
                    <SelectValue placeholder="Клуб сонгох" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Section>

        {/* ── GAME SETTING ── */}
        <Section title="Game Setting">
          <div className="space-y-1.5">
            <Label>Тоглолтын төрөл</Label>
            <div className="flex gap-2 flex-wrap">
              {FORMAT_OPTIONS.map((f) => (
                <button key={f.value} type="button"
                  onClick={() => { setFormat(f.value as typeof format); if (f.score > 0) setStartScore(f.score) }}
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
            <p className="text-xs text-primary/80">
              {setsEnabled ? `First to ${firstTo} sets · ${legsPerSet} legs/set` : `First to ${firstTo} legs`}
            </p>
          </div>

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
                <input type="radio" name="bracket" value={bt.value} checked={bracketType === bt.value}
                  onChange={() => setBracketType(bt.value)} className="accent-primary" />
                <span className={cn("text-sm font-semibold", bracketType === bt.value && "text-primary")}>{bt.label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1.5">
              <Label>Тоглогчийн тоо</Label>
              <Select value={String(maxPlayers)} onValueChange={(v) => v && setMaxPlayers(parseInt(v))}>
                <SelectTrigger className="bg-secondary/50 border-border/60"><SelectValue /></SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label>Шагналын сан (₮)</Label>
              <Input type="number" min={0} value={prizePool}
                onChange={(e) => setPrizePool(parseInt(e.target.value) || 0)}
                className="bg-secondary/50 border-border/60" />
            </div>
          </div>
        </Section>

        {/* ── POINT SYSTEM ── */}
        {(bracketType === "round_robin" || bracketType === "swiss") && (
          <Section title="Оноо тооцоо" defaultOpen={false}>
            <div className="grid grid-cols-3 gap-4">
              <Stepper value={pointWon} onChange={setPointWon} min={0} max={10} label="Хожил" />
              <Stepper value={pointDraw} onChange={setPointDraw} min={0} max={10} label="Тэнцэл" />
              <Stepper value={pointLost} onChange={setPointLost} min={0} max={10} label="Хохирол" />
            </div>
            <CheckRow label="Оноог leg-ийн тоогоор тооцох" checked={winPointsAreLegs} onChange={setWinPointsAreLegs} />
          </Section>
        )}

        {/* ── COMPETITION OPTIONS ── */}
        <Section title="Тэмцээний нэмэлт тохиргоо" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button type="button" onClick={() => setIsPrivate(false)}
              className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                !isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
              <Globe className="h-4 w-4" />
              <div className="text-left"><p className="text-sm font-semibold">Public</p><p className="text-[11px] opacity-70">Бүх хүн харна</p></div>
            </button>
            <button type="button" onClick={() => setIsPrivate(true)}
              className={cn("flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
              <Lock className="h-4 w-4" />
              <div className="text-left"><p className="text-sm font-semibold">Private</p><p className="text-[11px] opacity-70">Join code шаардлагатай</p></div>
            </button>
          </div>
          <div className="space-y-3">
            <CheckRow label="Average харуулах" checked={showAverage} onChange={setShowAverage} />
            <CheckRow label="Автоматаар дуусгах" checked={autoComplete} onChange={setAutoComplete} />
            <CheckRow label="Тоглолт эхлэхэд өрсөлдөгчийг баталгаажуулах" checked={confirmOpponent} onChange={setConfirmOpponent} />
            <CheckRow label="Loser First" checked={loserFirst} onChange={setLoserFirst} />
            <CheckRow label="Нэвтрэхэд тоглогч сонгохгүй" checked={allowParticipantScore} onChange={setAllowParticipantScore}
              sub="Бүх оролцогч оноо оруулах боломжтой" />
            <CheckRow label="Жагсаалтад дугаар харуулах" checked={showIndex} onChange={setShowIndex} />
          </div>
        </Section>

        {/* Save / Cancel */}
        <div className="flex gap-3 pt-2">
          <Link href={`/tournaments/${t.id}`} className={cn(buttonVariants({ variant: "outline" }), "border-border/60 px-5")}>
            Буцах
          </Link>
          <Button type="submit" className="flex-1 glow-primary" size="lg" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Хадгалах
          </Button>
        </div>
      </form>
    </div>
  )
}
