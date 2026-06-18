"use client"

import { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AtSign, Check, ChevronDown, ChevronUp, Copy, Download,
  Minus, Plus, RefreshCw, Search, Upload, UserCheck, Users, X,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { BracketType, GameFormat, SessionPhase } from "@/lib/local-game/types"
import { BracketEditor } from "@/components/local-game/BracketEditor"
import { VisitLimitPicker } from "@/components/game/VisitLimitPicker"
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

// ── Step indicator ────────────────────────────────────────────────
const PHASES: { key: string; label: string }[] = [
  { key: "type", label: "Төрөл" },
  { key: "settings", label: "Тохиргоо" },
  { key: "players", label: "Тоглогчид" },
  { key: "bracket", label: "Bracket үүсгэх" },
]

type Step = "type" | "settings" | "players" | "bracket" | "bracket-making"
type CompFormat = BracketType | "rr_ko" | "rr_ko2"

const COMPETITION_FORMATS: { value: BracketType | "rr_ko" | "rr_ko2"; label: string }[] = [
  { value: "single_elimination", label: "Single Elimination" },
  { value: "double_elimination", label: "Double Elimination" },
  { value: "groups_knockout", label: "Round Robin + Knockout шат" },
  { value: "rr_ko2", label: "Round Robin + Knockout шат x 2" },
  { value: "round_robin", label: "Round Robin (matches only)" },
  { value: "swiss", label: "Swiss" },
]

function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase() }

function Num({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center border border-border/60 rounded-md overflow-hidden w-20">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="h-8 w-7 flex items-center justify-center hover:bg-secondary shrink-0 text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
      </button>
      <input type="number" value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
        className="flex-1 h-8 text-center text-sm font-semibold bg-secondary/30 focus:outline-none w-0 min-w-0" />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="h-8 w-7 flex items-center justify-center hover:bg-secondary shrink-0 text-muted-foreground">
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function Chk({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-primary" />
      <div>
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </label>
  )
}

function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="radio" checked={checked} onChange={onChange} className="accent-primary" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}

export function SetupWizard() {
  const router = useRouter()
  const createSession = useLocalGame((s) => s.createSession)
  const setPhase = useLocalGame((s) => s.setPhase)
  const sessions = useLocalGame((s) => s.sessions)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("type")
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [joinCode] = useState(generateCode())

  // Step 1: Type
  const [compFormat, setCompFormat] = useState<CompFormat>("single_elimination")
  const [isSingleGame, setIsSingleGame] = useState(true)

  // Step 2: Settings
  const [name, setName] = useState("")
  const [joinPassword, setJoinPassword] = useState("")
  const [description, setDescription] = useState("")

  // RR match format
  const [hasRR, setHasRR] = useState(false)
  const [rrGroups, setRRGroups] = useState(2)
  const [rrPlayersPerGroup, setRRPlayersPerGroup] = useState(4)
  const [rrGroupAdvance, setRRGroupAdvance] = useState(1)
  const [rrMatchType, setRRMatchType] = useState<"legs" | "sets" | "schedule">("legs")
  const [rrFirstTo, setRRFirstTo] = useState(2)
  const [rrLegsPerSet, setRRLegsPerSet] = useState(2)
  const [rrEnableDraw, setRREnableDraw] = useState(false)

  // KO / SE match format
  const [hasSE1, setHasSE1] = useState(true)
  const [seNumPlayers, setSENumPlayers] = useState(4)
  const [se3rdPlace, setSE3rdPlace] = useState(false)
  const [hasSE2, setHasSE2] = useState(false)
  const [hasDE, setHasDE] = useState(false)
  const [hasStepladder, setHasStepladder] = useState(false)
  const [koMatchType, setKOMatchType] = useState<"legs" | "sets" | "schedule">("legs")
  const [koFirstTo, setKOFirstTo] = useState(2)
  const [koLegsPerSet, setKOLegsPerSet] = useState(2)

  const [startScore, setStartScore] = useState(501)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)
  const [bullFinishAtLimit, setBullFinishAtLimit] = useState(false)
  const [pointWon, setPointWon] = useState(2)
  const [pointDraw, setPointDraw] = useState(1)
  const [pointLost, setPointLost] = useState(0)

  // Options
  const [showAverage, setShowAverage] = useState(true)
  const [autoComplete, setAutoComplete] = useState(true)
  const [allowParticipantScore, setAllowParticipantScore] = useState(false)
  const [showIndex, setShowIndex] = useState(true)

  // Step 3: Players
  const [players, setPlayers] = useState<PlayerEntry[]>([{ name: "" }, { name: "" }])
  const [newPlayerName, setNewPlayerName] = useState("")
  const [batchText, setBatchText] = useState("")
  const [showBatch, setShowBatch] = useState(false)

  // @username search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; display_name: string; avatar_url: string | null; rating_points: number }[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const validPlayers = players.filter((p) => p.name.trim())

  // Search DartMN profiles by username
  const searchProfiles = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, rating_points")
      .ilike("username", `%${q.replace("@", "")}%`)
      .limit(5)
    setSearchResults(data ?? [])
    setSearching(false)
  }, [])

  function addLinkedPlayer(profile: { id: string; username: string; display_name: string; avatar_url: string | null; rating_points: number }) {
    // Check if already added
    if (players.some((p) => p.profileId === profile.id)) {
      toast.error(`@${profile.username} аль хэдийн нэмэгдсэн байна`)
      return
    }
    setPlayers((prev) => [...prev, {
      name: profile.display_name,
      profileId: profile.id,
      profileUsername: profile.username,
      avatarUrl: profile.avatar_url,
      isLinked: true,
    }])
    setSearchQuery("")
    setSearchResults([])
    setShowSearch(false)
  }

  function addPlayer(nm?: string) {
    const n = (nm ?? newPlayerName).trim() || `Тоглогч ${players.length + 1}`
    setPlayers((prev) => [...prev, { name: n }])
    setNewPlayerName("")
  }
  function removePlayer(i: number) { setPlayers((prev) => prev.filter((_, idx) => idx !== i)) }
  function movePlayer(i: number, d: -1 | 1) {
    setPlayers((prev) => { const next = [...prev]; const j = i + d; if (j < 0 || j >= next.length) return prev; [next[i], next[j]] = [next[j], next[i]]; return next })
  }
  function updatePlayer(i: number, val: string) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, name: val } : p))
  }
  function unlinkPlayer(i: number) {
    setPlayers((prev) => prev.map((p, idx) => idx === i
      ? { name: p.name, profileId: null, profileUsername: null, avatarUrl: null, isLinked: false }
      : p))
  }
  function batchAdd() {
    const names = batchText.split("\n").map((s) => s.trim()).filter(Boolean)
    setPlayers((prev) => [...prev, ...names.map((n) => ({ name: n }))])
    setBatchText(""); setShowBatch(false)
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
    reader.readAsText(file); e.target.value = ""
  }


  // Helper: is this a round-robin based format
  const isRRFormat = (f: CompFormat) => ["groups_knockout", "rr_ko", "rr_ko2", "round_robin"].includes(f)
  const isKOFormat = (f: CompFormat) => ["single_elimination", "double_elimination", "groups_knockout", "rr_ko", "rr_ko2"].includes(f)

  // Determine actual bracket type from step 1 selections
  function getActualBracketType(): BracketType {
    if (isRRFormat(compFormat)) return "groups_knockout"
    return compFormat as BracketType
  }

  // Make Bracket — create session and go to bracket editor
  function handleMakeBracket() {
    if (!name.trim()) { toast.error("Тэмцээний нэр оруулна уу"); return }
    if (validPlayers.length < 2) { toast.error("Дор хаяж 2 тоглогч хэрэгтэй"); return }

    const bt = getActualBracketType()
    const isRR = bt === "round_robin" || bt === "groups_knockout"
    const groupsCount = isRR ? rrGroups : 1
    const ppg = isRR ? rrPlayersPerGroup : validPlayers.length

    const id = createSession({
      name: name.trim(),
      joinPassword,
      description,
      format: "501",
      startScore,
      rrFirstTo,
      rrSetsEnabled: rrMatchType === "sets",
      rrLegsPerSet,
      rrEnableDraw,
      firstTo: koFirstTo,
      setsEnabled: koMatchType === "sets",
      legsPerSet: koLegsPerSet,
      doubleOut: true,
      doubleIn: false,
      loserFirst: false,
      thirdPlaceMatch: se3rdPlace,
      limitRounds: limitRoundsEnabled ? limitRounds : null,
      bullFinishAtLimit,
      enableDraw: rrEnableDraw,
      showAverage,
      autoComplete,
      allowParticipantScore,
      showIndex,
      pointWon,
      pointDraw,
      pointLost,
      winPointsAreLegs: false,
      bracketType: bt,
      playersPerGroup: ppg,
      groupsCount,
      groupAdvance: isRR ? rrGroupAdvance : 1,
      players: validPlayers,
      startWithPhase: "making_bracket",
    })
    setCreatedId(id)
    setStep("bracket")
  }

  // Done — move to in_session
  function handleDone() {
    if (!createdId) return
    setPhase(createdId, "in_session")
    router.push(`/local/${createdId}`)
  }

  const stepIdx = ["type", "settings", "players", "bracket"].indexOf(step)

  // ── Bracket editor (setting_table.php) ───────────────────────────
  if (step === "bracket" && createdId) {
    const session = sessions[createdId]
    if (!session) return null

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header — n01дартс шиг */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <button onClick={() => setStep("players")} className="text-sm text-muted-foreground hover:text-foreground border border-border/60 px-3 py-1 rounded-md">
            ← Буцах
          </button>
          <div className="text-center">
            <h1 className="font-bold">{session.name}</h1>
            <p className="text-xs text-muted-foreground">(Bracket үүсгэж байна)</p>
          </div>
          <button onClick={handleDone}
            className="text-sm font-semibold bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md transition-colors">
            Дуусгах
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">Тоглогчдыг тохируулаад Дуусгах товч дарна уу</p>

        <BracketEditor session={session} sessionId={createdId} />

        <div className="flex gap-3 pt-2 border-t border-border/50">
          <button onClick={() => setStep("players")}
            className="px-4 py-2 rounded-md bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium">
            ← Буцах
          </button>
          <button onClick={handleDone}
            className="flex-1 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
            Тэмцээн эхлүүлэх →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <Link href="/local" className="text-sm text-muted-foreground hover:text-foreground border border-border/60 px-3 py-1 rounded-md">
          ← Буцах
        </Link>
        <div className="text-center">
          <h1 className="font-bold">Setting</h1>
          <p className="text-xs text-muted-foreground">
            {step === "type" ? "" : step === "settings" ? "(Бэлтгэл)" : step === "players" ? "(Бүртгэл)" : "(Bracket үүсгэж байна)"}
          </p>
        </div>
        {step !== "type" && (
          <div className="w-20" />
        )}
        {step === "type" && <div className="w-20" />}
      </div>

      {/* Phase progress */}
      {step !== "type" && (
        <div className="text-sm text-muted-foreground space-y-0.5 border-b border-border/40 pb-3">
          <p className="font-medium text-xs uppercase tracking-wide">Тэмцээний явц</p>
          {[
            { n: 1, label: "Тэмцээний тохиргоо", active: step === "settings" },
            { n: 2, label: "Бүртгэл — Тоглогч гараар нэмэх", active: step === "players" },
            { n: 3, label: "Bracket үүсгэх", active: step === "bracket" },
            { n: 4, label: "Явагдаж байна" },
            { n: 5, label: "Дууссан" },
          ].map((ph) => (
            <p key={ph.n} className={cn("text-xs", ph.active ? "text-primary font-semibold" : "")}>
              {ph.n}. {ph.label}
            </p>
          ))}
        </div>
      )}

      {/* ── STEP 1: Type ── */}
      {step === "type" && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-3">Тэмцээний төрлийг сонгоно уу.</p>
            <div className="flex flex-wrap gap-2">
              {["Дартс", "Soft-tip Дартс", "Бусад"].map((t) => (
                <button key={t} type="button"
                  className={cn("px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                    t === "Дартс" ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3">Тэмцээний форматыг сонгоно уу.</p>
            <div className="flex flex-wrap gap-2">
              {COMPETITION_FORMATS.map((f) => (
                <button key={f.value} type="button" onClick={() => setCompFormat(f.value as BracketType)}
                  className={cn("px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                    compFormat === f.value ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsSingleGame(true)}
                className={cn("px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                  isSingleGame ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                Single game
              </button>
              <button type="button" onClick={() => setIsSingleGame(false)}
                className={cn("px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                  !isSingleGame ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                Team game
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Doubles тэмцээнд 'Ганцаарчилсан' сонгоод нэр дор хоёр нэр бичнэ.</p>
          </div>

          <button onClick={() => setStep("settings")}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors">
            Next
          </button>
        </div>
      )}

      {/* ── STEP 2: Settings (Бэлтгэл) ── */}
      {step === "settings" && (
        <div className="space-y-0 divide-y divide-border/40">
          {/* Тэмцээний тохиргоо */}
          <div className="py-4 space-y-3">
            <p className="text-sm font-semibold">Тэмцээний тохиргоо</p>
            <div className="space-y-1.5">
              <Label className="text-sm">Тэмцээний нэр *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                className="bg-secondary/50 border-border/60" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Join нууц үг *</Label>
              <Input value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="password" className="bg-secondary/50 border-border/60 w-48" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Тэмцээний тайлбар</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          </div>

          {/* Round Robin config */}
          {(compFormat === "groups_knockout" || compFormat === "round_robin" || isRRFormat(compFormat) || isRRFormat(compFormat)) && (
            <div className="py-4 space-y-3">
              <Chk checked={true} onChange={() => {}} label="Round Robin" />
              <div className="pl-4 space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Бүлгийн тоо</Label>
                    <Num value={rrGroups} onChange={setRRGroups} min={1} max={16} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Бүлэгт тоглогчийн тоо</Label>
                    <Num value={rrPlayersPerGroup} onChange={setRRPlayersPerGroup} min={2} max={20} />
                  </div>
                  {compFormat === "groups_knockout" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Бүлгээс гарах тоо</Label>
                      <Num value={rrGroupAdvance} onChange={setRRGroupAdvance} min={1} max={Math.max(1, rrPlayersPerGroup - 1)} />
                    </div>
                  )}
                </div>
                <div className="text-xs text-primary/80 font-medium">
                  = {rrGroups * rrPlayersPerGroup} нийт тоглогч · {rrGroups} бүлэг · тус бүрт {rrPlayersPerGroup} тоглогч
                  {compFormat === "groups_knockout" && (
                    <span className="ml-2 text-yellow-400">
                      → KO шатанд {rrGroups * rrGroupAdvance} тоглогч орно
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Match format — RR */}
          {(compFormat === "groups_knockout" || compFormat === "round_robin" || isRRFormat(compFormat) || isRRFormat(compFormat)) && (
            <div className="py-4 space-y-2">
              <Radio checked={rrMatchType === "legs"} onChange={() => setRRMatchType("legs")} label="Limit Legs" />
              {rrMatchType === "legs" && (
                <div className="pl-4 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">First to</span>
                  <Num value={rrFirstTo} onChange={setRRFirstTo} min={1} max={11} />
                  <span className="text-sm text-muted-foreground">Legs</span>
                  <Chk checked={rrEnableDraw} onChange={setRREnableDraw} label="Draw зөвшөөрөх" />
                </div>
              )}
              <Radio checked={rrMatchType === "sets"} onChange={() => setRRMatchType("sets")} label="Limit Sets" />
              {rrMatchType === "sets" && (
                <div className="pl-4 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">First to</span>
                  <Num value={rrFirstTo} onChange={setRRFirstTo} min={1} max={11} />
                  <span className="text-sm text-muted-foreground">Sets /</span>
                  <Num value={rrLegsPerSet} onChange={setRRLegsPerSet} min={1} max={11} />
                  <span className="text-sm text-muted-foreground">Legs</span>
                </div>
              )}
              <Radio checked={rrMatchType === "schedule"} onChange={() => setRRMatchType("schedule")} label="Хуваарь" />
            </div>
          )}

          {/* Start Score + Visit хязгаар */}
          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Start Score</Label>
              <div className="flex gap-2">
                {[501, 301, 170, 121].map((s) => (
                  <button key={s} type="button" onClick={() => setStartScore(s)}
                    className={cn("flex-1 py-2 rounded-lg border-2 text-sm font-bold transition-all",
                      startScore === s
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-border")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <VisitLimitPicker
              enabled={limitRoundsEnabled}
              onToggle={(v) => { setLimitRoundsEnabled(v); if (!v) setBullFinishAtLimit(false) }}
              value={limitRounds}
              onChange={setLimitRounds}
              bullOff={bullFinishAtLimit}
              onBullOffToggle={setBullFinishAtLimit}
            />
          </div>

          {/* SE / KO section */}
          {(compFormat === "single_elimination" || isRRFormat(compFormat)) && (
            <div className="py-4 space-y-3">
              <Chk checked={hasSE1} onChange={setHasSE1} label="Single Elimination 1" />
              {hasSE1 && (
                <div className="pl-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Тоглогчийн тоо</Label>
                      <select value={seNumPlayers} onChange={(e) => setSENumPlayers(parseInt(e.target.value))}
                        className="h-8 border border-border/60 rounded-md bg-secondary/50 px-2 text-sm">
                        {[2, 4, 8, 16, 32, 64].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <Chk checked={se3rdPlace} onChange={setSE3rdPlace} label="3-р байрны тоглолт" />
                  </div>

                  <Radio checked={koMatchType === "legs"} onChange={() => setKOMatchType("legs")} label="Limit Legs" />
                  {koMatchType === "legs" && (
                    <div className="pl-4 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">First to</span>
                      <Num value={koFirstTo} onChange={setKOFirstTo} min={1} max={11} />
                      <span className="text-sm text-muted-foreground">Legs</span>
                    </div>
                  )}
                  <Radio checked={koMatchType === "sets"} onChange={() => setKOMatchType("sets")} label="Limit Sets" />
                  {koMatchType === "sets" && (
                    <div className="pl-4 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">First to</span>
                      <Num value={koFirstTo} onChange={setKOFirstTo} min={1} max={11} />
                      <span className="text-sm text-muted-foreground">Sets /</span>
                      <Num value={koLegsPerSet} onChange={setKOLegsPerSet} min={1} max={11} />
                      <span className="text-sm text-muted-foreground">Legs</span>
                    </div>
                  )}
                  <Radio checked={koMatchType === "schedule"} onChange={() => setKOMatchType("schedule")} label="Хуваарь" />
                </div>
              )}
              <Chk checked={hasSE2} onChange={setHasSE2} label="Single Elimination 2" />
              <Chk checked={hasDE} onChange={setHasDE} label="Double Elimination" />
              <Chk checked={hasStepladder} onChange={setHasStepladder} label="Тоглолт (Stepladder)" />
            </div>
          )}

          {/* Оноо тооцоо for RR */}
          {(compFormat === "groups_knockout" || compFormat === "round_robin") && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium">Оноо тооцоо</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-8">Won</span><Num value={pointWon} onChange={setPointWon} min={0} max={10} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-8">Draw</span><Num value={pointDraw} onChange={setPointDraw} min={0} max={10} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-8">Lost</span><Num value={pointLost} onChange={setPointLost} min={0} max={10} /></div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 space-y-2">
            <button onClick={() => toast.success("Тохиргоо хадгалагдлаа")}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
              Save Тэмцээний тохиргоо
            </button>
            <div className="flex gap-2">
              <button onClick={() => setStep("type")}
                className="px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium">
                Prev
              </button>
              <button onClick={() => { if (!name.trim()) { toast.error("Тэмцээний нэр оруулна уу"); return } setStep("players") }}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
                Next (Бүртгэл)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Players (Бүртгэл) ── */}
      {step === "players" && (
        <div className="space-y-0 divide-y divide-border/40">
          {/* Тэмцээний холбоос */}
          <div className="py-4 space-y-2">
            <p className="text-sm font-medium">Тэмцээний холбоос</p>
            <div className="flex items-center gap-2">
              <Input value={`${typeof window !== "undefined" ? window.location.origin : ""}/local/join/${joinCode}`}
                readOnly className="bg-secondary/30 border-border/60 text-xs" />
              <button onClick={() => { navigator.clipboard.writeText(joinCode); toast.success("Join Code хуулагдлаа") }}
                className="shrink-0 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1">
                <Copy className="h-3 w-3" /> Хуулах
              </button>
            </div>
            {joinPassword && <p className="text-xs text-muted-foreground">Join нууц үг: <span className="font-semibold text-foreground">{joinPassword}</span></p>}
          </div>

          {/* Тоглогчдын жагсаалт */}
          <div className="py-4 space-y-3">
            <p className="text-sm font-medium">Тоглогчдын жагсаалт</p>
            <div className="space-y-1.5">
              <Chk checked={allowParticipantScore} onChange={setAllowParticipantScore}
                label="Нэвтрэхэд тоглогч сонгохгүй (Оролцогч бүр оноо оруулах боломжтой)" />
              <Chk checked={showIndex} onChange={setShowIndex} label="Жагсаалтад дугаар харуулах" />
            </div>

            {/* Player list */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {players.map((p, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                  p.isLinked ? "border-primary/30 bg-primary/5" : "border-transparent"
                )}>
                  {showIndex && <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>}
                  <div className="flex flex-col gap-0 shrink-0">
                    <button onClick={() => movePlayer(i, -1)} disabled={i === 0} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronUp className="h-2.5 w-2.5" /></button>
                    <button onClick={() => movePlayer(i, 1)} disabled={i === players.length - 1} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronDown className="h-2.5 w-2.5" /></button>
                  </div>

                  {/* Linked player: avatar + name */}
                  {p.isLinked ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={p.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px] bg-primary/20">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-primary">@{p.profileUsername}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-primary/30 text-primary shrink-0">
                        <UserCheck className="h-2.5 w-2.5 mr-0.5" />DartMN
                      </Badge>
                    </div>
                  ) : (
                    <Input value={p.name} onChange={(e) => updatePlayer(i, e.target.value)}
                      placeholder={`Тоглогч ${i + 1}`}
                      className="flex-1 h-8 text-sm bg-secondary/50 border-border/60" />
                  )}

                  {p.isLinked && (
                    <button onClick={() => unlinkPlayer(i)} title="Холболт таслах"
                      className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => removePlayer(i)} disabled={players.length <= 2}
                    className="disabled:opacity-20 text-muted-foreground hover:text-destructive p-1 shrink-0">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add controls */}
            <div className="space-y-2">
              {/* Guest player */}
              <div className="flex gap-2">
                <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Зочин тоглогч нэмэх..."
                  className="flex-1 h-8 text-sm bg-secondary/50 border-border/60"
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
                <button onClick={() => addPlayer()}
                  className="shrink-0 px-3 h-8 rounded-md border border-border/60 text-sm hover:bg-secondary whitespace-nowrap">
                  + Нэмэх
                </button>
              </div>

              {/* DartMN account search */}
              <div className="space-y-1.5">
                <button onClick={() => setShowSearch(!showSearch)}
                  className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
                    showSearch ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                  <AtSign className="h-3.5 w-3.5" />
                  DartMN хэрэглэгч холбох (stats хөтлөгдөнө)
                </button>

                {showSearch && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          searchProfiles(e.target.value)
                        }}
                        placeholder="@username хайх..."
                        className="pl-8 h-8 text-sm bg-secondary/50 border-primary/30"
                      />
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
                              <p className="text-xs text-muted-foreground">@{profile.username} · {profile.rating_points} pts</p>
                            </div>
                            <span className="text-xs text-primary shrink-0">+ Нэмэх</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowBatch(!showBatch)}
                className="flex-1 py-2 rounded-md border border-border/60 text-sm hover:bg-secondary">
                Олноор нэмэх
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1 px-3 py-2 rounded-md border border-border/60 text-xs hover:bg-secondary text-muted-foreground">
                <Download className="h-3 w-3" /> CSV татах
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 px-3 py-2 rounded-md border border-border/60 text-xs hover:bg-secondary text-muted-foreground">
                <Upload className="h-3 w-3" /> CSV оруулах
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
            </div>

            {showBatch && (
              <div className="space-y-2">
                <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} rows={4}
                  placeholder={"Нэг мөрт нэг тоглогч:\nБат\nДорж\nЭнх"}
                  className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none resize-none" />
                <button onClick={batchAdd}
                  className="w-full py-2 rounded-md border border-primary/30 text-primary text-sm hover:bg-primary/10">
                  {batchText.split("\n").filter((s) => s.trim()).length} тоглогч нэмэх
                </button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Тэмцээнд бүртгүүлэх холбоосыг хуваалцана уу.</p>
          </div>

          {/* Buttons */}
          <div className="pt-4 space-y-2">
            <button onClick={() => toast.success("Entry list хадгалагдлаа")}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
              Save Тоглогчдын жагсаалт
            </button>
            <div className="flex gap-2">
              <button onClick={() => setStep("settings")}
                className="px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium">
                Prev
              </button>
              <button onClick={() => setStep("bracket-making")}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
                Next (Bracket үүсгэж байна)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3.5: Making Bracket (before editor) ── */}
      {(step as string) === "bracket-making" && (
        <div className="space-y-4">
          {/* URL */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Тэмцээний холбоос</p>
            <div className="flex items-center gap-2">
              <Input value={`${typeof window !== "undefined" ? window.location.origin : ""}/local/join/${joinCode}`}
                readOnly className="bg-secondary/30 border-border/60 text-xs" />
              <button onClick={() => { navigator.clipboard.writeText(joinCode); toast.success("Хуулагдлаа") }}
                className="shrink-0 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs flex items-center gap-1">
                <Copy className="h-3 w-3" /> Хуулах
              </button>
            </div>
          </div>

          <button onClick={handleMakeBracket}
            className="w-full py-4 rounded-lg font-bold text-white text-base transition-colors"
            style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}>
            Make Bracket
          </button>

          <div className="flex gap-2">
            <button onClick={() => setStep("players")}
              className="px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium">
              Prev
            </button>
            <button onClick={handleMakeBracket}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
              Next (Явагдаж байна) →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
