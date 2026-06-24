"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Camera, ChevronRight, Globe, Loader2, Plus, Search,
  Target, Users, Video, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { VisitLimitPicker } from "@/components/game/VisitLimitPicker"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"
import { OnlineRoom, Profile } from "@/types/database"
import { MatchmakingSection } from "@/components/play/MatchmakingSection"
import { CameraSetup } from "@/components/play/CameraSetup"

type ProfileSnippet = Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points">
type RoomWithHost = OnlineRoom & { profiles: ProfileSnippet | null }

interface Props {
  profile: ProfileSnippet | null
  activeRooms: RoomWithHost[]
}

type Mode = "practice" | "together" | "camera" | "online" | null
type CamFlow = "idle" | "setup" | "ready"

// ── Mode card config ──────────────────────────────────────────────────────────
const MODES = [
  {
    id: "practice" as const,
    icon: Target,
    label: "Дадлага",
    desc: "Solo — 501, Checkout drill",
    color: "text-yellow-400",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/8",
    activeBg: "bg-yellow-500/12",
  },
  {
    id: "together" as const,
    icon: Users,
    label: "Хамтдаа",
    desc: "Нэг утас дээр, 1v1–3v3",
    color: "text-green-400",
    border: "border-green-500/30",
    bg: "bg-green-500/8",
    activeBg: "bg-green-500/12",
  },
  {
    id: "camera" as const,
    icon: Camera,
    label: "Камертай",
    desc: "Dart тус бүр харагдана",
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/8",
    activeBg: "bg-blue-500/12",
    badge: "Beta",
  },
  {
    id: "online" as const,
    icon: Globe,
    label: "Онлайн",
    desc: "Өрөө үүсгэх · ELO хайлт",
    color: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/8",
    activeBg: "bg-primary/12",
    live: true,
  },
]

export function PlayLobby({ profile, activeRooms }: Props) {
  const router = useRouter()

  // Mode selection
  const [activeMode, setActiveMode] = useState<Mode>(null)
  const [camFlow, setCamFlow] = useState<CamFlow>("idle")

  // Online room state
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [mode, setMode] = useState<"1v1" | "2v2" | "3v3">("1v1")
  const [format, setFormat] = useState<"501" | "301" | "170">("501")
  const [bestOf, setBestOf] = useState("3")
  const [doubleOut, setDoubleOut] = useState(true)
  const [limitRoundsEnabled, setLimitRoundsEnabled] = useState(false)
  const [limitRounds, setLimitRounds] = useState(15)
  const [bullFinish, setBullFinish] = useState(false)
  const [startMethod, setStartMethod] = useState<"random" | "bulloff">("random")
  const [showCreateForm, setShowCreateForm] = useState(false)

  function selectMode(id: Mode) {
    if (id === "practice") { router.push("/play/practice"); return }
    if (id === "together") { router.push("/play/together"); return }
    setActiveMode((prev) => (prev === id ? null : id))
  }

  async function handleCreateRoom() {
    if (!profile) return toast.error("Нэвтрэх шаардлагатай")
    setCreating(true)
    const res = await fetch("/api/play/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode, format, bestOf: parseInt(bestOf), doubleOut,
        limitRounds: limitRoundsEnabled ? limitRounds : null,
        bullFinish: limitRoundsEnabled && bullFinish,
        startMethod,
      }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error ?? "Өрөө үүсгэхэд алдаа гарлаа")
      setCreating(false)
      return
    }
    const { id } = await res.json()
    setCreating(false)
    router.push(`/play/${id}`)
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return toast.error("Өрөөний код оруулна уу")
    setJoining(true)
    const supabase = createClient()
    const { data: room } = await supabase
      .from("online_rooms")
      .select("id, status")
      .eq("room_code", joinCode.toUpperCase())
      .eq("status", "waiting")
      .single()
    if (!room) {
      toast.error("Өрөө олдсонгүй эсвэл дүүрсэн байна")
      setJoining(false)
      return
    }
    router.push(`/play/${room.id}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-8">
      {/* ── Header ── */}
      <div className="pt-1">
        <h1 className="text-xl font-bold">Тоглох</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Тоглолтын төрлөө сонгоно уу</p>
      </div>

      {/* ── Mode grid 2×2 ── */}
      <div className="grid grid-cols-2 gap-3">
        {MODES.map((m) => {
          const Icon = m.icon
          const isActive = activeMode === m.id
          return (
            <button
              key={m.id}
              onClick={() => selectMode(m.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-2xl border-2 px-4 py-4 text-left transition-all active:scale-[0.97]",
                isActive
                  ? `${m.border} ${m.activeBg}`
                  : `border-border/40 ${m.bg} hover:border-border/70`
              )}
            >
              {/* Live dot */}
              {m.live && (
                <span className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {/* Badge */}
              {m.badge && (
                <span className="absolute top-3 right-3 text-[9px] font-bold border border-current/30 rounded px-1.5 py-0.5 text-blue-400">
                  {m.badge}
                </span>
              )}
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", m.activeBg, m.border, "border")}>
                <Icon className={cn("h-5 w-5", m.color)} />
              </div>
              <div>
                <p className={cn("text-sm font-bold", isActive ? m.color : "text-foreground")}>{m.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
              </div>
              {(m.id === "camera" || m.id === "online") && (
                <ChevronRight className={cn(
                  "absolute bottom-3.5 right-3 h-3.5 w-3.5 transition-transform",
                  isActive ? `${m.color} rotate-90` : "text-muted-foreground/40"
                )} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Camera expand ── */}
      {activeMode === "camera" && (
        <div className="rounded-2xl border border-blue-500/25 bg-card/80 overflow-hidden">
          {camFlow === "idle" && (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Камераар дартын самбарыг зөв байрлуулж тохируулсны дараа тоглолт эхлэнэ.
                Dart шидэх бүрд оноо + сектор харагдана.
              </p>
              <button
                onClick={() => setCamFlow("setup")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold text-sm hover:bg-blue-500/15 transition-all"
              >
                <Video className="h-4 w-4" />
                Камер тохируулах эхлэх
              </button>
            </div>
          )}

          {camFlow === "setup" && (
            <div className="p-4">
              <CameraSetup
                onConfirmed={() => setCamFlow("ready")}
                onBack={() => setCamFlow("idle")}
              />
            </div>
          )}

          {camFlow === "ready" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-bold text-green-400">Камер бэлэн</span>
                <button
                  onClick={() => { setCamFlow("idle"); sessionStorage.removeItem("cam-ready") }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Дахин тохируулах
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => router.push("/play/camera")}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-green-500/30 bg-green-500/8 hover:bg-green-500/12 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-green-400" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-green-400">Дадлага тоглолт</p>
                      <p className="text-[11px] text-muted-foreground">Dart тус бүр оноо + сектор</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
                <button
                  onClick={() => { setActiveMode("online"); setCamFlow("ready") }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/8 hover:bg-blue-500/12 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-blue-400">Онлайн өрөө / ELO</p>
                      <p className="text-[11px] text-muted-foreground">Камертай онлайн тоглолт</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Online expand ── */}
      {activeMode === "online" && (
        <div className="space-y-4">
          {/* ELO Matchmaking */}
          {profile && (
            <MatchmakingSection
              userId={profile.id}
              ratingPoints={profile.rating_points}
              displayName={profile.display_name}
            />
          )}

          {/* Join by code */}
          <div className="rounded-2xl border border-border/40 bg-card/80 p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-400" />
              Кодоор нэгдэх
            </p>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="bg-secondary/50 border-border/60 text-center text-lg font-bold tracking-widest score-display uppercase"
              />
              <Button
                onClick={handleJoinRoom}
                disabled={joining || !joinCode.trim()}
                variant="outline"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 px-5 shrink-0"
              >
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Орох"}
              </Button>
            </div>
          </div>

          {/* Create room */}
          <div className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/20 transition-colors"
            >
              <span className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Өрөө үүсгэх
              </span>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground/50 transition-transform", showCreateForm && "rotate-90")} />
            </button>

            {showCreateForm && (
              <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
                {/* Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Хэлбэр</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["1v1", "2v2", "3v3"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setMode(m)}
                        className={cn("py-2 rounded-lg border-2 text-sm font-bold transition-all",
                          mode === m ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format + Best of */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Формат</Label>
                    <Select value={format} onValueChange={(v) => v && setFormat(v as typeof format)}>
                      <SelectTrigger className="bg-secondary/50 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="501">501</SelectItem>
                        <SelectItem value="301">301</SelectItem>
                        <SelectItem value="170">170</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Best of</Label>
                    <Select value={bestOf} onValueChange={(v) => v && setBestOf(v)}>
                      <SelectTrigger className="bg-secondary/50 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Best of 1</SelectItem>
                        <SelectItem value="3">Best of 3</SelectItem>
                        <SelectItem value="5">Best of 5</SelectItem>
                        <SelectItem value="7">Best of 7</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Options row */}
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={doubleOut} onChange={(e) => setDoubleOut(e.target.checked)} className="accent-primary" />
                    <span className="text-sm">Double out</span>
                  </label>
                  <div className="flex gap-2">
                    {([["random", "Санамсаргүй"], ["bulloff", "Bull-off"]] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setStartMethod(v)}
                        className={cn("px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                          startMethod === v ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <VisitLimitPicker
                  enabled={limitRoundsEnabled}
                  onToggle={(v) => { setLimitRoundsEnabled(v); if (!v) setBullFinish(false) }}
                  value={limitRounds}
                  onChange={setLimitRounds}
                  bullOff={bullFinish}
                  onBullOffToggle={setBullFinish}
                />

                <Button className="w-full glow-primary" onClick={handleCreateRoom} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Zap className="h-4 w-4 mr-1.5" />
                  Өрөө үүсгэх
                </Button>
              </div>
            )}
          </div>

          {/* Active rooms */}
          {activeRooms.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5 flex items-center gap-2">
                Нээлттэй өрөөнүүд
                <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">{activeRooms.length}</Badge>
              </p>
              <div className="space-y-2">
                {activeRooms.map((room) => (
                  <div key={room.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/80 px-4 py-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={room.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-secondary text-xs">
                        {room.profiles?.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{room.profiles?.display_name}</p>
                      <p className="text-[11px] text-muted-foreground">{room.format} · BO{room.best_of}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/play/${room.id}`)}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
                    >
                      Орох
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
