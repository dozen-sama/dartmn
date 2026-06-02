"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Loader2, Monitor, Plus, Search, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"
import { OnlineRoom, Profile } from "@/types/database"
import { generateRoomCode } from "@/lib/utils/format"

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
  const [format, setFormat] = useState<"501" | "301" | "cricket">("501")
  const [bestOf, setBestOf] = useState("3")
  const [createdCode, setCreatedCode] = useState<string | null>(null)

  async function handleCreateRoom() {
    if (!profile) return toast.error("Нэвтрэх шаардлагатай")
    setCreating(true)
    const supabase = createClient()
    const code = generateRoomCode()

    const { data, error } = await supabase
      .from("online_rooms")
      .insert({
        room_code: code,
        host_id: profile.id,
        format,
        best_of: parseInt(bestOf),
        status: "waiting",
      })
      .select("id")
      .single()

    if (error || !data) {
      toast.error("Өрөө үүсгэхэд алдаа гарлаа")
      setCreating(false)
      return
    }

    setCreatedCode(code)
    setCreating(false)
    router.push(`/play/${data.id}`)
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

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success(mn.play.codeCopied)
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
              <Label className="text-sm">Тоглоомын формат</Label>
              <Select value={format} onValueChange={(v) => v && setFormat(v as typeof format)}>
                <SelectTrigger className="bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="501">501</SelectItem>
                  <SelectItem value="301">301</SelectItem>
                  <SelectItem value="cricket">Cricket</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Best of</Label>
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
