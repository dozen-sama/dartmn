"use client"

import { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AtSign, ChevronDown, ChevronUp, Copy, Download,
  Minus, Plus, Search, Upload, UserCheck, Users, X, QrCode,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { BracketType } from "@/lib/local-game/types"
import { BracketEditor } from "@/components/local-game/BracketEditor"
import { VisitLimitPicker } from "@/components/game/VisitLimitPicker"
import { StageBuilder, type LocalStage } from "@/components/tournament/StageBuilder"
import { validatePipeline, type TournamentStage } from "@/lib/tournament/stage-types"
import { computePlayInPlan } from "@/lib/tournament/play-in"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { toast } from "sonner"

interface PlayerEntry {
  name: string
  profileId?: string | null
  profileUsername?: string | null
  avatarUrl?: string | null
  isLinked?: boolean
}

function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase() }

function Num({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center border border-border/60 rounded-md overflow-hidden w-24">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="h-9 w-8 flex items-center justify-center hover:bg-secondary shrink-0 text-muted-foreground">
        <Minus className="h-3 w-3" />
      </button>
      <input type="number" value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
        className="flex-1 h-9 text-center text-sm font-semibold bg-secondary/30 focus:outline-none w-0 min-w-0" />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="h-9 w-8 flex items-center justify-center hover:bg-secondary shrink-0 text-muted-foreground">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}

const FORMAT_OPTIONS: { value: BracketType; label: string; sub: string }[] = [
  { value: "single_elimination", label: "Single Elim", sub: "Шуурхай хаалт" },
  { value: "round_robin",        label: "Round Robin", sub: "Бүгд бүгдтэй" },
  { value: "groups_knockout",    label: "Бүлэг + KO",  sub: "Group stage" },
  { value: "swiss",              label: "Swiss",        sub: "Оноогоор таарна" },
  { value: "double_elimination", label: "Double Elim",  sub: "Давхар хаалт" },
]

export function SetupWizard() {
  const router = useRouter()
  const createSession = useLocalGame((s) => s.createSession)
  const setPhase = useLocalGame((s) => s.setPhase)
  const sessions = useLocalGame((s) => s.sessions)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<"setup" | "bracket">("setup")
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [joinCode] = useState(generateCode)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showQR, setShowQR] = useState(false)

  // Core settings
  const [name, setName] = useState("")
  const [bracketType, setBracketType] = useState<BracketType>("single_elimination")
  const [startScore, setStartScore] = useState(501)
  const [firstTo, setFirstTo] = useState(2)
  const [setsEnabled, setSetsEnabled] = useState(false)
  const [legsPerSet, setLegsPerSet] = useState(3)

  // Multi-stage (олон шат) горим
  const [multiStage, setMultiStage] = useState(false)
  const [stages, setStages] = useState<LocalStage[]>([])

  // Advanced settings
  const [joinPassword, setJoinPassword] = useState("")
  const [doubleOut, setDoubleOut] = useState(true)
  const [doubleIn, setDoubleIn] = useState(false)
  const [thirdPlace, setThirdPlace] = useState(false)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)
  const [bullFinishAtLimit, setBullFinishAtLimit] = useState(false)
  const [enableDraw, setEnableDraw] = useState(false)
  const [pointWon, setPointWon] = useState(2)
  const [pointDraw, setPointDraw] = useState(1)
  const [pointLost, setPointLost] = useState(0)
  const [rrGroups, setRRGroups] = useState(2)
  const [rrGroupAdvance, setRRGroupAdvance] = useState(1)

  // Players
  const [players, setPlayers] = useState<PlayerEntry[]>([{ name: "" }, { name: "" }])
  const [newPlayerName, setNewPlayerName] = useState("")
  const [batchText, setBatchText] = useState("")
  const [showBatch, setShowBatch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; display_name: string; avatar_url: string | null; rating_points: number }[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const validPlayers = players.filter((p) => p.name.trim())
  const isRR = bracketType === "round_robin" || bracketType === "groups_knockout" || bracketType === "swiss"
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/local/join/${joinCode}` : `https://dartmn.com/local/join/${joinCode}`

  const searchProfiles = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase.from("profiles")
      .select("id, username, display_name, avatar_url, rating_points")
      .ilike("username", `%${q.replace("@", "")}%`).limit(5)
    setSearchResults(data ?? [])
    setSearching(false)
  }, [])

  function addLinkedPlayer(profile: { id: string; username: string; display_name: string; avatar_url: string | null; rating_points: number }) {
    if (players.some((p) => p.profileId === profile.id)) { toast.error(`@${profile.username} аль хэдийн нэмэгдсэн`); return }
    setPlayers((prev) => [...prev, { name: profile.display_name, profileId: profile.id, profileUsername: profile.username, avatarUrl: profile.avatar_url, isLinked: true }])
    setSearchQuery(""); setSearchResults([]); setShowSearch(false)
  }
  function addPlayer(nm?: string) {
    const n = (nm ?? newPlayerName).trim() || `Тоглогч ${players.length + 1}`
    setPlayers((prev) => [...prev, { name: n }]); setNewPlayerName("")
  }
  function removePlayer(i: number) { setPlayers((prev) => prev.filter((_, idx) => idx !== i)) }
  function movePlayer(i: number, d: -1 | 1) {
    setPlayers((prev) => { const next = [...prev]; const j = i + d; if (j < 0 || j >= next.length) return prev; [next[i], next[j]] = [next[j], next[i]]; return next })
  }
  function updatePlayer(i: number, val: string) { setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, name: val } : p)) }
  function unlinkPlayer(i: number) { setPlayers((prev) => prev.map((p, idx) => idx === i ? { name: p.name, profileId: null, profileUsername: null, avatarUrl: null, isLinked: false } : p)) }
  function batchAdd() {
    const names = batchText.split("\n").map((s) => s.trim()).filter(Boolean)
    setPlayers((prev) => [...prev, ...names.map((n) => ({ name: n }))])
    setBatchText(""); setShowBatch(false)
  }
  function exportCSV() {
    const csv = validPlayers.map((p, i) => `${i + 1},${p.name}`).join("\n")
    const a = document.createElement("a"); a.href = `data:text/csv;charset=utf-8,#,Name\n${csv}`; a.download = `${name || "players"}.csv`; a.click()
  }
  function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split("\n").slice(1)
      const names = lines.map((l) => l.split(",")[1]?.trim()).filter(Boolean)
      setPlayers((prev) => [...prev, ...names.map((n) => ({ name: n }))])
    }
    reader.readAsText(file); e.target.value = ""
  }

  function handleCreate() {
    if (!name.trim()) { toast.error("Тэмцээний нэр оруулна уу"); return }
    if (validPlayers.length < 2) { toast.error("Дор хаяж 2 тоглогч хэрэгтэй"); return }
    if (!multiStage && bracketType === "double_elimination" && computePlayInPlan(validPlayers.length).targetSize < 4) {
      toast.error("Double elimination-д хамгийн багадаа 3 оролцогч хэрэгтэй"); return
    }

    if (multiStage) {
      if (stages.length === 0) { toast.error("Хамгийн багадаа нэг шат нэмнэ үү"); return }
      const errors = validatePipeline(stages, validPlayers.length)
      if (errors.length > 0) { toast.error(errors[0].message); return }

      const tournamentStages: TournamentStage[] = stages.map((s, i) => ({
        id: s._id,
        tournament_id: "",
        order_no: i,
        stage_type: s.stage_type,
        config: s.config,
        status: i === 0 ? "active" : "pending",
      }))

      const id = createSession({
        name: name.trim(),
        joinPassword,
        joinCode,
        description: "",
        format: "501",
        startScore: 501,
        rrFirstTo: 2, rrSetsEnabled: false, rrLegsPerSet: 3, rrEnableDraw: false,
        firstTo: 2, setsEnabled: false, legsPerSet: 3,
        doubleOut: true, doubleIn: false, loserFirst: false, thirdPlaceMatch: false,
        limitRounds: null, bullFinishAtLimit: false, enableDraw: false,
        showAverage: true, autoComplete: true, allowParticipantScore: false, showIndex: true,
        pointWon: 2, pointDraw: 1, pointLost: 0, winPointsAreLegs: false,
        bracketType: "single_elimination",
        playersPerGroup: validPlayers.length, groupsCount: 1, groupAdvance: 1,
        players: validPlayers,
        stages: tournamentStages,
      })
      router.push(`/local/${id}`)
      return
    }

    const groupsCount = bracketType === "groups_knockout" ? rrGroups : 1
    const ppg = bracketType === "groups_knockout" ? Math.ceil(validPlayers.length / rrGroups) : validPlayers.length

    const id = createSession({
      name: name.trim(),
      joinPassword,
      joinCode,
      description: "",
      format: "501",
      startScore,
      rrFirstTo: firstTo,
      rrSetsEnabled: setsEnabled,
      rrLegsPerSet: legsPerSet,
      rrEnableDraw: enableDraw,
      firstTo,
      setsEnabled,
      legsPerSet,
      doubleOut,
      doubleIn,
      loserFirst: false,
      thirdPlaceMatch: thirdPlace,
      limitRounds: limitRoundsEnabled ? limitRounds : null,
      bullFinishAtLimit,
      enableDraw,
      showAverage: true,
      autoComplete: true,
      allowParticipantScore: false,
      showIndex: true,
      pointWon,
      pointDraw,
      pointLost,
      winPointsAreLegs: false,
      bracketType,
      playersPerGroup: ppg,
      groupsCount,
      groupAdvance: bracketType === "groups_knockout" ? rrGroupAdvance : 1,
      players: validPlayers,
      startWithPhase: "making_bracket",
    })
    setCreatedId(id)
    setStep("bracket")
  }

  function handleDone() {
    if (!createdId) return
    setPhase(createdId, "in_session")
    router.push(`/local/${createdId}`)
  }

  // ── Bracket step ─────────────────────────────────────────────────
  if (step === "bracket" && createdId) {
    const session = sessions[createdId]
    if (!session) return null
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <button onClick={() => setStep("setup")} className="text-sm text-muted-foreground hover:text-foreground border border-border/60 px-3 py-1.5 rounded-md">
            ← Буцах
          </button>
          <div className="text-center">
            <h1 className="font-bold">{session.name}</h1>
            <p className="text-xs text-muted-foreground">Bracket тохируулах</p>
          </div>
          <button onClick={handleDone} className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
            Эхлүүлэх →
          </button>
        </div>

        <BracketEditor session={session} sessionId={createdId} />

        {/* Join URL + QR */}
        <div className="border border-border/40 rounded-xl p-4 space-y-3 bg-card/60">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Оролцогчдод хуваалцах</p>
            <button onClick={() => setShowQR(!showQR)}
              className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors",
                showQR ? "border-primary/50 text-primary bg-primary/10" : "border-border/50 text-muted-foreground hover:border-border")}>
              <QrCode className="h-3.5 w-3.5" />QR код
            </button>
          </div>

          {showQR && (
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-secondary/20 rounded-lg">
              <div className="p-3 bg-white rounded-xl shrink-0">
                <QRCodeSVG value={joinUrl} size={160} level="M" />
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-sm font-semibold">Камераар скан хийж орно</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{joinUrl}</p>
                {joinPassword && <p className="text-xs text-muted-foreground">Нууц үг: <span className="font-semibold text-foreground">{joinPassword}</span></p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input value={joinUrl} readOnly className="bg-secondary/30 border-border/60 text-xs h-8" />
            <button onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Холбоос хуулагдлаа") }}
              className="shrink-0 px-3 h-8 rounded-md bg-secondary hover:bg-secondary/80 text-xs flex items-center gap-1.5 border border-border/50">
              <Copy className="h-3 w-3" />Хуулах
            </button>
          </div>
          {joinPassword && !showQR && <p className="text-xs text-muted-foreground">Нууц үг: <span className="font-semibold text-foreground">{joinPassword}</span></p>}
        </div>

        <button onClick={handleDone}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors">
          Тэмцээн эхлүүлэх →
        </button>
      </div>
    )
  }

  // ── Setup step ────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/local" className="text-sm text-muted-foreground hover:text-foreground border border-border/60 px-3 py-1.5 rounded-md">
          ← Буцах
        </Link>
        <h1 className="font-bold">Шинэ тэмцээн</h1>
        <div className="w-20" />
      </div>

      {/* Tournament name */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Тэмцээний нэр <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Жишээ: Аварга шалгаруулах тэмцээн"
          className="bg-secondary/50 border-border/60 h-11 text-base" autoFocus />
      </div>

      {/* Горим сонголт */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Тэмцээний горим</Label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMultiStage(false)}
            className={cn("flex flex-col items-center py-3 px-2 rounded-xl border-2 text-center transition-all",
              !multiStage ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground")}>
            <span className="text-sm font-semibold">Ганц bracket</span>
            <span className="text-[10px] mt-0.5 opacity-70">Нэг л шат</span>
          </button>
          <button type="button" onClick={() => setMultiStage(true)}
            className={cn("flex flex-col items-center py-3 px-2 rounded-xl border-2 text-center transition-all",
              multiStage ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground")}>
            <span className="text-sm font-semibold">Олон шат</span>
            <span className="text-[10px] mt-0.5 opacity-70">Group → KO гэх мэт</span>
          </button>
        </div>
      </div>

      {!multiStage && (
        <>
          {/* Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Тэмцээний хэлбэр</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button key={f.value} type="button" onClick={() => setBracketType(f.value)}
                  className={cn("flex flex-col items-center py-3 px-2 rounded-xl border-2 text-center transition-all",
                    bracketType === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground")}>
                  <span className="text-sm font-semibold">{f.label}</span>
                  <span className="text-[10px] mt-0.5 opacity-70">{f.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Core match settings */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start Score</Label>
              <div className="flex gap-1.5">
                {[501, 301].map((s) => (
                  <button key={s} type="button" onClick={() => setStartScore(s)}
                    className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-all",
                      startScore === s ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">First to</Label>
              <div className="flex items-center gap-2">
                <Num value={firstTo} onChange={setFirstTo} min={1} max={11} />
                <span className="text-sm text-muted-foreground">{setsEnabled ? "Sets" : "Legs"}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {multiStage && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Шатнууд</Label>
          <StageBuilder stages={stages} onChange={setStages} initialPlayers={validPlayers.length} />
        </div>
      )}

      {/* Players */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Тоглогчид
            {validPlayers.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({validPlayers.length})</span>}
          </Label>
          <div className="flex gap-1.5">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/50 text-xs text-muted-foreground hover:bg-secondary">
              <Upload className="h-3 w-3" />CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
            <button onClick={exportCSV}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/50 text-xs text-muted-foreground hover:bg-secondary">
              <Download className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {players.map((p, i) => (
            <div key={i} className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors",
              p.isLinked ? "border-primary/30 bg-primary/5" : "border-transparent")}>
              <div className="flex flex-col shrink-0">
                <button onClick={() => movePlayer(i, -1)} disabled={i === 0} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={() => movePlayer(i, 1)} disabled={i === players.length - 1} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronDown className="h-3 w-3" /></button>
              </div>
              <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>

              {p.isLinked ? (
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={p.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[9px] bg-primary/20">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className="text-[10px] text-primary shrink-0">@{p.profileUsername}</span>
                </div>
              ) : (
                <Input value={p.name} onChange={(e) => updatePlayer(i, e.target.value)}
                  placeholder={`Тоглогч ${i + 1}`}
                  className="flex-1 h-8 text-sm bg-secondary/50 border-border/60" />
              )}

              {p.isLinked && (
                <button onClick={() => unlinkPlayer(i)} className="text-muted-foreground hover:text-destructive p-0.5 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => removePlayer(i)} disabled={players.length <= 2}
                className="disabled:opacity-20 text-muted-foreground hover:text-destructive p-0.5 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add player */}
        <div className="flex gap-2">
          <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Тоглогч нэмэх..."
            className="flex-1 h-9 text-sm bg-secondary/50 border-border/60"
            onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
          <button onClick={() => addPlayer()}
            className="px-3 h-9 rounded-md border border-border/60 text-sm hover:bg-secondary whitespace-nowrap">
            + Нэмэх
          </button>
        </div>

        {/* Batch add */}
        <div className="flex gap-2">
          <button onClick={() => setShowBatch(!showBatch)}
            className="text-xs text-muted-foreground hover:text-foreground border border-border/40 px-2.5 py-1.5 rounded-md">
            Олноор нэмэх
          </button>
          <button onClick={() => setShowSearch(!showSearch)}
            className={cn("flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors",
              showSearch ? "border-primary/50 text-primary bg-primary/5" : "border-border/40 text-muted-foreground hover:text-foreground")}>
            <AtSign className="h-3 w-3" />DartMN
          </button>
        </div>

        {showBatch && (
          <div className="space-y-1.5">
            <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} rows={4}
              placeholder={"Нэг мөрт нэг тоглогч:\nБат\nДорж\nЭнх"}
              className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none resize-none" />
            <button onClick={batchAdd}
              className="w-full py-2 rounded-md border border-primary/30 text-primary text-sm hover:bg-primary/10">
              {batchText.split("\n").filter((s) => s.trim()).length} тоглогч нэмэх
            </button>
          </div>
        )}

        {showSearch && (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); searchProfiles(e.target.value) }}
                placeholder="@username хайх..."
                className="pl-8 h-9 text-sm bg-secondary/50 border-primary/30" />
            </div>
            {searching && <p className="text-xs text-muted-foreground">Хайж байна...</p>}
            {searchResults.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                {searchResults.map((profile) => (
                  <button key={profile.id} onClick={() => addLinkedPlayer(profile)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/50 transition-colors text-left border-b border-border/30 last:border-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-secondary">{profile.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profile.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{profile.username} · {profile.rating_points}</p>
                    </div>
                    <span className="text-xs text-primary shrink-0">+ Нэмэх</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced toggle */}
      <div className="border border-border/40 rounded-xl overflow-hidden">
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-secondary/30 transition-colors">
          <span className="font-medium text-muted-foreground">Дэлгэрэнгүй тохиргоо</span>
          {showAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4 divide-y divide-border/30">
            {/* Password */}
            <div className="space-y-1.5 pb-4">
              <Label className="text-sm">Нэвтрэх нууц үг</Label>
              <Input value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Хоосон бол нээлттэй"
                className="bg-secondary/50 border-border/60 w-48" />
            </div>

            {!multiStage && (
              <>
                {/* Start score extra options */}
                <div className="space-y-1.5 py-4">
                  <Label className="text-sm">Start Score</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[501, 301, 170, 121].map((s) => (
                      <button key={s} type="button" onClick={() => setStartScore(s)}
                        className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-all",
                          startScore === s ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sets mode */}
                <div className="py-4 space-y-2">
                  <Label className="text-sm">Match горим</Label>
                  <div className="flex gap-2">
                    <button onClick={() => setSetsEnabled(false)}
                      className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                        !setsEnabled ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground")}>
                      Legs
                    </button>
                    <button onClick={() => setSetsEnabled(true)}
                      className={cn("px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                        setsEnabled ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground")}>
                      Sets
                    </button>
                  </div>
                  {setsEnabled && (
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-xs text-muted-foreground">Set дотор first to</span>
                      <Num value={legsPerSet} onChange={setLegsPerSet} min={1} max={11} />
                      <span className="text-xs text-muted-foreground">legs</span>
                    </div>
                  )}
                </div>

                {/* Double out/in */}
                <div className="py-4 space-y-2">
                  <Label className="text-sm">Finish горим</Label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={doubleOut} onChange={(e) => setDoubleOut(e.target.checked)} className="accent-primary" />
                      Захаар гарах
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={doubleIn} onChange={(e) => setDoubleIn(e.target.checked)} className="accent-primary" />
                      Double In
                    </label>
                  </div>
                </div>

                {/* Visit limit */}
                <div className="py-4">
                  <VisitLimitPicker
                    enabled={limitRoundsEnabled}
                    onToggle={(v) => { setLimitRoundsEnabled(v); if (!v) setBullFinishAtLimit(false) }}
                    value={limitRounds}
                    onChange={setLimitRounds}
                    bullOff={bullFinishAtLimit}
                    onBullOffToggle={setBullFinishAtLimit}
                  />
                </div>

                {/* 3rd place (SE only) */}
                {bracketType === "single_elimination" && (
                  <div className="py-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} className="accent-primary" />
                      3-р байрны тоглолт
                    </label>
                  </div>
                )}

                {/* Groups config (groups_knockout only) */}
                {bracketType === "groups_knockout" && (
                  <div className="py-4 space-y-3">
                    <Label className="text-sm">Бүлгийн тохиргоо</Label>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Бүлгийн тоо</Label>
                        <Num value={rrGroups} onChange={setRRGroups} min={2} max={16} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Бүлгээс гарах</Label>
                        <Num value={rrGroupAdvance} onChange={setRRGroupAdvance} min={1} max={8} />
                      </div>
                    </div>
                  </div>
                )}

                {/* RR/Swiss: draw + points */}
                {isRR && (
                  <div className="py-4 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={enableDraw} onChange={(e) => setEnableDraw(e.target.checked)} className="accent-primary" />
                      Draw зөвшөөрөх
                    </label>
                    <div className="space-y-1">
                      <Label className="text-sm">Оноо тооцоо</Label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-8">Won</span><Num value={pointWon} onChange={setPointWon} min={0} max={10} /></div>
                        <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-8">Draw</span><Num value={pointDraw} onChange={setPointDraw} min={0} max={10} /></div>
                        <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-8">Lost</span><Num value={pointLost} onChange={setPointLost} min={0} max={10} /></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create button */}
      <button onClick={handleCreate}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors">
        {multiStage ? "Тэмцээн эхлүүлэх →" : "Bracket үүсгэх →"}
      </button>
    </div>
  )
}
