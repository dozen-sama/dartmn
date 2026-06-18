"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Monitor, Plus, Search, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { VisitLimitPicker } from "@/components/game/VisitLimitPicker"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"
import { OnlineRoom, Profile } from "@/types/database"

type ProfileSnippet = Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points">

type RoomWithHost = OnlineRoom & {
  profiles: ProfileSnippet | null
}

interface Props {
  profile: ProfileSnippet | null
  activeRooms: RoomWithHost[]
}

export function PlayLobby({ profile, activeRooms }: Props) {
  const router = useRouter()
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

  async function handleCreateRoom() {
    if (!profile) return toast.error("Нэвтрэх шаардлагатай")
    setCreating(true)
    const res = await fetch("/api/play/room/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Monitor className="h-6 w-6 text-primary" />
          {mn.play.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Дэлхийн дурын тоглогчтой онлайнаар тоглох</p>
      </div>

      {/* ── Бэлтгэл тоглолт ── */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="font-semibold text-sm">Бэлтгэл тоглолт</p>
            <p className="text-xs text-muted-foreground">501 Solo, Checkout drill, Around the board</p>
          </div>
        </div>
        <Link href="/play/practice" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-border/60 shrink-0")}>
          Дадлага хийх →
        </Link>
      </div>

      {/* ── ХАМТДАА ТОГЛОХ — featured section ── */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <h2 className="text-lg font-bold">Хамтдаа тоглох</h2>
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">Шинэ</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Нэг өрөөнд байгаа найзуудтайгаа <strong className="text-foreground">нэг телефон дээр</strong> тоглоно.
              Код шаардахгүй — тоглогч бүр оноо оруулаад дараагийн хүнд дамжуулна.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 bg-secondary/50 rounded-full px-2.5 py-1">✓ 1v1, 2v2, 3v3</span>
              <span className="flex items-center gap-1 bg-secondary/50 rounded-full px-2.5 py-1">✓ Багаар тоглох</span>
              <span className="flex items-center gap-1 bg-secondary/50 rounded-full px-2.5 py-1">✓ Интернэт шаардахгүй</span>
              <span className="flex items-center gap-1 bg-secondary/50 rounded-full px-2.5 py-1">✓ Checkout hint</span>
            </div>
          </div>
          <Link href="/play/together"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm glow-primary hover:bg-primary/90 transition-all shrink-0">
            <Users className="h-5 w-5" />
            Хамтдаа тоглох
          </Link>
        </div>
      </div>

      {/* How it works info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: "🔗", title: "Өрөө үүсгэх", desc: "Code үүсгэж найздаа илгээнэ" },
          { icon: "🎯", title: "Оноо оруулах", desc: "Тоглолт бүрийн дараа гараар оноо оруулна" },
          { icon: "📊", title: "Realtime", desc: "Оноо, bracket шууд шинэчлэгдэнэ" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 bg-secondary/30 rounded-lg px-3 py-2.5">
            <span className="text-lg shrink-0">{item.icon}</span>
            <div>
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming features notice */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
        <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20">
          <p className="text-sm font-semibold flex items-center gap-2">
            🚀 Удахгүй нэмэгдэх
          </p>
        </div>
        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              icon: "📷",
              title: "Камерийн оноо уншилт",
              desc: "Телефоны камераар дартын онооны хэсгийг автоматаар таниж оноог оруулна. E-dart board холболт.",
              status: "Хөгжүүлж байна",
            },
            {
              icon: "🏟️",
              title: "Online тэмцээн",
              desc: "Олон тоглогчтой online тэмцээн. Автомат bracket, live standings.",
              status: "Төлөвлөгдсөн",
            },
            {
              icon: "📊",
              title: "Статистик шинжилгээ",
              desc: "Тоглолт бүрийн нарийн статистик, checkout heat map, throw analysis.",
              status: "Судалж байна",
            },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-xl shrink-0">{f.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-semibold">{f.title}</p>
                  <span className="text-[10px] text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">
                    {f.status}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-primary/20 bg-secondary/10">
          <p className="text-[11px] text-muted-foreground">
            💡 Одоогоор тоглогчид <strong className="text-foreground">гараар оноо оруулна</strong>.
            Платформ хөгжихийн хэрээр шинэ боломжууд нэмэгдэх болно. Санал хүсэлтээ хуваалцаарай!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Create Room */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {mn.play.createRoom}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Тоглолтын хэлбэр</Label>
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

            <div className="space-y-1.5">
              <Label className="text-sm">Тоглоомын формат</Label>
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

            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1.5">
                <Label className="text-sm">Best of</Label>
                <Select value={bestOf} onValueChange={(v) => v && setBestOf(v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60 w-36">
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
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input type="checkbox" checked={doubleOut} onChange={(e) => setDoubleOut(e.target.checked)} className="accent-primary" />
                <span className="text-sm">Double out</span>
              </label>
            </div>

            {/* Visit/round хязгаар + хязгаарт bull finish */}
            <div className="border-t border-border/40 pt-3">
              <VisitLimitPicker
                enabled={limitRoundsEnabled}
                onToggle={(v) => { setLimitRoundsEnabled(v); if (!v) setBullFinish(false) }}
                value={limitRounds}
                onChange={setLimitRounds}
                bullOff={bullFinish}
                onBullOffToggle={setBullFinish}
              />
            </div>

            {/* Эхлэгчийг тодорхойлох арга */}
            <div className="space-y-1.5">
              <Label className="text-sm">Хэн эхлэх</Label>
              <div className="grid grid-cols-2 gap-2">
                {([["random", "Санамсаргүй"], ["bulloff", "Bull-off"]] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setStartMethod(v)}
                    className={cn("py-2 rounded-lg border-2 text-sm font-bold transition-all",
                      startMethod === v ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full glow-primary"
              onClick={handleCreateRoom}
              disabled={creating}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Zap className="h-4 w-4 mr-1.5" />
              Өрөө үүсгэх
            </Button>
          </CardContent>
        </Card>

        {/* Join Room */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-400" />
              {mn.play.joinRoom}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">{mn.play.roomCode}</Label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="bg-secondary/50 border-border/60 text-center text-xl font-bold tracking-widest score-display uppercase"
              />
            </div>

            <Button
              variant="outline"
              className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={handleJoinRoom}
              disabled={joining}
            >
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Орох
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Rooms */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Нээлттэй өрөөнүүд
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
              {activeRooms.length}
            </Badge>
          </h2>
        </div>

        {activeRooms.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Monitor className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">Одоогоор нээлттэй өрөө байхгүй байна</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Өрөө үүсгэж найзаа урина уу</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeRooms.map((room) => (
              <Card key={room.id} className="card-hover border-border/50 bg-card/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={room.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-xs">
                      {room.profiles?.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{room.profiles?.display_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{room.format}</span>
                      <span>•</span>
                      <span>BO{room.best_of}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => router.push(`/play/${room.id}`)}
                  >
                    Орох
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
