"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Calendar, ChevronDown, ChevronRight, Copy, Eye, EyeOff,
  Globe, Lock, Loader2, Minus, Plus, RefreshCw, Trophy, Users,
  Upload, X, Building2, User,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Props {
  userId: string
  userProfile: { display_name: string; username: string; avatar_url: string | null }
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

export function CreateTournamentForm({ userId, userProfile }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Basic info
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [clubId, setClubId] = useState("")
  const [clubName, setClubName] = useState("")
  const [clubSearch, setClubSearch] = useState("")
  const [clubResults, setClubResults] = useState<{ id: string; name: string; logo_url: string | null }[]>([])
  const [showClubDropdown, setShowClubDropdown] = useState(false)
  // Date: тусдаа date + time state
  const [startDateD, setStartDateD] = useState("")
  const [startDateT, setStartDateT] = useState("12:00")
  const [deadlineDateD, setDeadlineDateD] = useState("")
  const [deadlineDateT, setDeadlineDateT] = useState("23:59")
  const startDate = startDateD ? `${startDateD}T${startDateT}` : ""
  const regDeadline = deadlineDateD ? `${deadlineDateD}T${deadlineDateT}` : ""
  const [location, setLocation] = useState("")
  const [titleImageUrl, setTitleImageUrl] = useState("")
  const [imagePreview, setImagePreview] = useState("")

  // Format
  const [format, setFormat] = useState<"501" | "301" | "cricket" | "cutthroat">("501")
  const [startScore, setStartScore] = useState(501)
  // KO тохиргоо
  const [firstTo, setFirstTo] = useState(2)
  const [setsEnabled, setSetsEnabled] = useState(false)
  const [legsPerSet, setLegsPerSet] = useState(3)
  const [doubleOut, setDoubleOut] = useState(true)
  const [doubleIn, setDoubleIn] = useState(false)
  const [loserFirst, setLoserFirst] = useState(false)
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)
  const [bullFinishAtLimit, setBullFinishAtLimit] = useState(false)
  // RR тохиргоо
  const [rrFirstTo, setRrFirstTo] = useState(2)
  const [rrSetsEnabled, setRrSetsEnabled] = useState(false)
  const [rrLegsPerSet, setRrLegsPerSet] = useState(3)
  const [enableDraw, setEnableDraw] = useState(false)
  const [groupsCount, setGroupsCount] = useState(2)
  const [groupAdvance, setGroupAdvance] = useState(1)
  const [playersPerGroup, setPlayersPerGroup] = useState(4)

  // Bracket
  const [bracketType, setBracketType] = useState<"single_elimination" | "double_elimination" | "round_robin" | "swiss" | "groups_knockout">("single_elimination")
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

  const isRR = bracketType === "round_robin" || bracketType === "swiss" || bracketType === "groups_knockout"

  const BRACKET_OPTIONS = [
    { value: "single_elimination", label: "Single Elimination", desc: "Нэг алдлаар унана" },
    { value: "double_elimination", label: "Double Elimination", desc: "Хоёр алдлаар унана" },
    { value: "round_robin", label: "Round Robin", desc: "Бүгд бүгдтэйгээ тоглоно" },
    { value: "groups_knockout", label: "Бүлэг + Knockout", desc: "Бүлгийн шат → Knockout шат" },
    { value: "swiss", label: "Swiss", desc: "Ижил оноотой тоглогчид тулалдана" },
  ] as const

  const FORMAT_OPTIONS = [
    { value: "501", label: "501", score: 501 },
    { value: "301", label: "301", score: 301 },
    { value: "170", label: "170", score: 170 },
    { value: "cricket", label: "Cricket", score: 0 },
    { value: "cutthroat", label: "Cutthroat", score: 0 },
  ]

  // Клуб хайлт
  const searchClubs = useCallback(async (q: string) => {
    if (q.length < 1) { setClubResults([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from("clubs")
      .select("id, name, logo_url")
      .ilike("name", `%${q}%`)
      .limit(8)
    setClubResults(data ?? [])
  }, [])

  // Файл upload
  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Зөвхөн зураг оруулна уу"); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("Зургийн хэмжээ 5MB-аас бага байх ёстой"); return }

    setUploadingImage(true)
    const supabase = createClient()
    const ext = file.name.split(".").pop()
    const path = `banners/${userId}-${Date.now()}.${ext}`

    const { error } = await supabase.storage.from("tournaments").upload(path, file, { upsert: true })
    if (error) { toast.error("Зураг upload хийхэд алдаа гарлаа"); setUploadingImage(false); return }

    const { data: { publicUrl } } = supabase.storage.from("tournaments").getPublicUrl(path)
    setTitleImageUrl(publicUrl)
    setImagePreview(URL.createObjectURL(file))
    setUploadingImage(false)
    toast.success("Зураг амжилттай оруулагдлаа")
  }

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
        double_out: doubleOut,
        double_in: doubleIn,
        loser_first: loserFirst,
        third_place_match: thirdPlaceMatch,
        limit_rounds: limitRoundsEnabled ? limitRounds : null,
        bull_finish_at_limit: limitRoundsEnabled ? bullFinishAtLimit : false,
        enable_draw: enableDraw,
        groups_count: groupsCount,
        group_advance: groupAdvance,
        players_per_group: playersPerGroup,
        rr_first_to: rrFirstTo,
        rr_sets_enabled: rrSetsEnabled,
        rr_legs_per_set: rrLegsPerSet,
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

            {/* Зохион байгуулагч */}
            <div className="space-y-1.5">
              <Label>Зохион байгуулагч</Label>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/40 border border-border/40">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={userProfile.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-secondary">
                    {userProfile.display_name?.slice(0,2).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userProfile.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{userProfile.username}</p>
                </div>
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </div>

            {/* Эхлэх огноо */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Эхлэх огноо <span className="text-primary">*</span></Label>
                <div className="flex gap-1.5">
                  <Input type="date" value={startDateD} onChange={(e) => setStartDateD(e.target.value)}
                    className="bg-secondary/50 border-border/60 flex-1" />
                  <Input type="time" value={startDateT} onChange={(e) => setStartDateT(e.target.value)}
                    className="bg-secondary/50 border-border/60 w-24" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Бүртгэлийн дедлайн</Label>
                <div className="flex gap-1.5">
                  <Input type="date" value={deadlineDateD} onChange={(e) => setDeadlineDateD(e.target.value)}
                    className="bg-secondary/50 border-border/60 flex-1" />
                  <Input type="time" value={deadlineDateT} onChange={(e) => setDeadlineDateT(e.target.value)}
                    className="bg-secondary/50 border-border/60 w-24" />
                </div>
              </div>
            </div>

            {/* Тайлбар */}
            <div className="space-y-1.5">
              <Label>Тэмцээний тайлбар</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} placeholder="Тэмцээний дэлгэрэнгүй мэдээлэл..."
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>

            {/* Байршил + Клуб хайлт */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Байршил</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="DartMN Клуб, УБ" className="bg-secondary/50 border-border/60" />
              </div>

              {/* Клуб хайлт */}
              <div className="space-y-1.5 relative">
                <Label>Клуб <span className="text-muted-foreground text-xs">(сонголтоор)</span></Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={clubId ? clubName : clubSearch}
                    onChange={(e) => {
                      if (clubId) { setClubId(""); setClubName("") }
                      setClubSearch(e.target.value)
                      setShowClubDropdown(true)
                      searchClubs(e.target.value)
                    }}
                    onFocus={() => { if (!clubId) setShowClubDropdown(true) }}
                    placeholder="Клуб хайх..."
                    className="bg-secondary/50 border-border/60 pl-9 pr-7"
                  />
                  {clubId && (
                    <button type="button" onClick={() => { setClubId(""); setClubName(""); setClubSearch("") }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {showClubDropdown && clubResults.length > 0 && !clubId && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border/60 rounded-lg shadow-lg overflow-hidden">
                    {clubResults.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setClubId(c.id); setClubName(c.name); setShowClubDropdown(false); setClubSearch("") }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/50 transition-colors text-left text-sm">
                        {c.logo_url
                          ? <img src={c.logo_url} className="h-5 w-5 rounded object-cover" alt="" />
                          : <Building2 className="h-4 w-4 text-muted-foreground" />}
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Баннер зураг */}
            <div className="space-y-1.5">
              <Label>Баннер зураг</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
              <div className="flex gap-2">
                <Input value={titleImageUrl} onChange={(e) => { setTitleImageUrl(e.target.value); setImagePreview("") }}
                  placeholder="https://... эсвэл доороос файл оруулна уу"
                  className="bg-secondary/50 border-border/60 flex-1" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-md border border-border/60 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50">
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Файл
                </button>
              </div>
              {(imagePreview || titleImageUrl) && (
                <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border/40 bg-secondary/20">
                  <img src={imagePreview || titleImageUrl} alt="preview"
                    className="w-full h-full object-cover" onError={() => setImagePreview("")} />
                  <button type="button" onClick={() => { setTitleImageUrl(""); setImagePreview("") }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
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

          {/* Start Score */}
          {(format === "501" || format === "301") && (
            <div className="space-y-1.5">
              <Label>Start Score</Label>
              <div className="flex gap-1.5">
                {[501, 301, 170, 121].map((s) => (
                  <button key={s} type="button" onClick={() => setStartScore(s)}
                    className={cn("flex-1 py-1.5 text-sm font-bold rounded-md border-2 transition-all",
                      startScore === s ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RR тохиргоо */}
          {isRR && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Round Robin тохиргоо</p>
              <div className="flex items-center gap-3 flex-wrap">
                <Stepper value={rrFirstTo} onChange={setRrFirstTo} min={1} max={11} label="First to" />
                <div className="flex items-center gap-2 mt-4">
                  <button type="button" onClick={() => setRrSetsEnabled(!rrSetsEnabled)}
                    className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                      rrSetsEnabled ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                    Sets
                  </button>
                  {rrSetsEnabled && <Stepper value={rrLegsPerSet} onChange={setRrLegsPerSet} min={1} max={11} label="Legs/set" />}
                  {!rrSetsEnabled && <span className="text-sm text-muted-foreground mt-4">Legs</span>}
                </div>
                <CheckRow label="Тэнцэл зөвшөөрөх" checked={enableDraw} onChange={setEnableDraw} />
              </div>
            </div>
          )}

          {/* Groups тохиргоо */}
          {bracketType === "groups_knockout" && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Бүлгийн тохиргоо</p>
              <div className="flex items-center gap-4 flex-wrap">
                <Stepper value={groupsCount} onChange={setGroupsCount} min={2} max={16} label="Бүлгийн тоо" />
                <Stepper value={playersPerGroup} onChange={setPlayersPerGroup} min={2} max={20} label="Бүлэгт тоглогч" />
                <Stepper value={groupAdvance} onChange={setGroupAdvance} min={1} max={Math.max(1, playersPerGroup - 1)} label="Гарах тоо" />
              </div>
              <p className="text-xs text-primary/80 font-medium">
                = {groupsCount * playersPerGroup} нийт · KO шатанд {groupsCount * groupAdvance} тоглогч
              </p>
            </div>
          )}

          {/* KO тохиргоо */}
          {!isRR && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Knockout тохиргоо</p>
              <div className="flex items-center gap-3 flex-wrap">
                <Stepper value={firstTo} onChange={setFirstTo} min={1} max={11} label="First to" />
                <div className="flex items-center gap-2 mt-4">
                  <button type="button" onClick={() => setSetsEnabled(!setsEnabled)}
                    className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                      setsEnabled ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                    Sets
                  </button>
                  {setsEnabled && <Stepper value={legsPerSet} onChange={setLegsPerSet} min={1} max={11} label="Legs/set" />}
                  {!setsEnabled && <span className="text-sm text-muted-foreground mt-4">Legs</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <CheckRow label="3-р байрны тоглолт" checked={thirdPlaceMatch} onChange={setThirdPlaceMatch} />
              </div>
            </div>
          )}

          {/* Double Out / In */}
          {(format === "501" || format === "301") && (
            <div className="flex gap-4 flex-wrap">
              <CheckRow label="Double Out" checked={doubleOut} onChange={setDoubleOut}
                sub="Финиш double-аас байх ёстой" />
              <CheckRow label="Double In" checked={doubleIn} onChange={setDoubleIn}
                sub="Double-аас тоглолт эхэлнэ" />
              <CheckRow label="Loser First" checked={loserFirst} onChange={setLoserFirst}
                sub="Leg хожигдсон тоглогч эхэлнэ" />
            </div>
          )}

          {/* Visit хязгаар */}
          {(format === "501" || format === "301") && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="limitRounds" checked={limitRoundsEnabled}
                  onChange={(e) => setLimitRoundsEnabled(e.target.checked)} className="accent-primary" />
                <label htmlFor="limitRounds" className="text-sm font-medium cursor-pointer">Visit хязгаар</label>
              </div>
              {limitRoundsEnabled && (
                <div className="pl-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <Stepper value={limitRounds} onChange={setLimitRounds} min={5} max={99} label="Хамгийн их visit" />
                  </div>
                  <CheckRow label="Bull-off-оор дуусгах" checked={bullFinishAtLimit} onChange={setBullFinishAtLimit}
                    sub="Visit хязгаарт хүрэхэд Bull-off хийнэ" />
                </div>
              )}
            </div>
          )}
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
            Буцах
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
